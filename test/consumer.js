const {mq} = require("../app/config.json").defaultCfg;
const Stomp = require("stomp-client");
const stompClient = new Stomp(mq.host, mq.port);
const moment = require("moment");

stompClient.connect((sessionId) => {
    console.log("connected, " + sessionId);
    stompClient.subscribe(mq.queue + '-test', (body, headers) => {
        const text = `\n${moment()}: ${JSON.stringify(headers, null, 2)}\nContent: ${body}`;
        console.log(text);
    });
});
