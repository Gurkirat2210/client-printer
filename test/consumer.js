const {printer} = require("../app/config.json").defaultCfg;
const Stomp = require("stomp-client");
const stompClient = new Stomp(mq.host, mq.port);
const moment = require("moment");

stompClient.connect((sessionId) => {
    console.log("connected, " + sessionId);
    stompClient.subscribe(`/queue/${printer.uuid}`, (body, headers) => {
        console.dir({date: moment(), headers, body});
    });
});



