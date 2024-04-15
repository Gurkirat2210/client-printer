const {mq} = require("../app/config.json").defaultCfg;
const Stomp = require("stomp-client");
const moment = require("moment/moment");
const stompClient = new Stomp(mq.host, mq.port);

stompClient.connect(async (sessionId) => {
    console.log("connected, " + sessionId);
    await stompClient.publish('ActiveMQ.Scheduler.Management', null,
        {
            "reply-to": "/queue/browsedMessages",
            "AMQ_SCHEDULER_ACTION": "BROWSE"
        });
    stompClient.subscribe("/queue/browsedMessages", (body, headers) => {
        const text = `\n${moment()}: ${JSON.stringify(headers, null, 2)}\nContent: ${body}`;
        console.log(text);
    });
});
