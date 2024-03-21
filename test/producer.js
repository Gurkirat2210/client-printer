const Stomp = require("stomp-client");
const {queue, activeMq, printService, printer} = require("../app/config.json");
const axios = require("axios");
const {get} = require("axios");
const stompClient = new Stomp(activeMq.host, activeMq.port);

async function getJobs() {
    const jobs = await axios.get(`${printService.url}/PrintJobs/${printer.uuid}`, {
        headers: {
            'Authorization': printer.password
        }
    });
    return jobs;
}

stompClient.connect(async (sessionId) => {
    console.log(sessionId);

    const jobs = await getJobs();
    if (!jobs || !jobs.data || !jobs.data.length) {
        return console.log("No jobs found");
    }
    for (let i in jobs.data) {
        const notification = {
            label: "received new print order",
            jobId: jobs.data[i]["jobId"],
        };
        await stompClient.publish(queue, JSON.stringify(notification));
    }

    stompClient.disconnect();

});
