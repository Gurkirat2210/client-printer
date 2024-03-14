const { queue, activeMq } = require("../app-config.json");
const Stomp = require("stomp-client");
const stompClient = new Stomp(activeMq.host, activeMq.port);

stompClient.connect((sessionId) => {
  console.log("connected, " + sessionId);
  stompClient.subscribe(queue, (body, headers) => {
    const text = `\n===============\n${JSON.stringify(headers, null, 4)}\n\n${JSON.stringify(JSON.parse(body), null, 4)}\n`;
    console.log(text);
  });
  console.log("subcribed, " + queue);
});
