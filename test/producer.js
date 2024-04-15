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
    await stompClient.publish(mq.queue + '-test', JSON.stringify({date: moment()}), {AMQ_SCHEDULED_DELAY: 30000});

    const jobs = await getJobs();
    if (!jobs || !jobs.data || !jobs.data.length) {
        console.log("No jobs found");
    }
    for (let i in jobs.data) {
        const notification = {
            label: "received new print order",
            jobId: jobs.data[i]["jobId"],
        };
        await stompClient.publish(mq.queue + '-test', JSON.stringify(notification));
    }
    stompClient.disconnect();
});

