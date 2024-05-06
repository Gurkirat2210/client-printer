const {mq, svc, printer} = require("../app/config.json").defaultCfg;
const Stomp = require("stomp-client");
const stompClient = new Stomp(mq.host, mq.port);
const axios = require("axios");
const moment = require("moment");

async function getJobs() {
    const jobs = await axios.get(`${svc.url}/PrintJobs/${printer.uuid}`, {
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
        console.log("No jobs found");
    }
    for (let i in jobs.data) {
        const notification = {
            label: "received new print order",
            jobId: jobs.data[i]["jobId"],
        };
        await stompClient.publish(`/queue/${printer.uuid}`, JSON.stringify(notification));
    }

    setInterval(async () => {
        const message = {
            date: moment(),
            delay: Math.floor(1000 * 10 * 10 * Math.random())
        };
        console.dir(message);
        await stompClient.publish(`/queue/${printer.uuid}`, JSON.stringify(message), {AMQ_SCHEDULED_DELAY: message.delay})
    }, 60000);

    // stompClient.disconnect();
});

