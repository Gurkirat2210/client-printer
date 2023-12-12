const Stomp = require("stomp-client");
const { queue, activeMq } = require("./config");
const stompClient = new Stomp(activeMq.host, activeMq.port);

stompClient.connect((sessionId) => {
  console.log(sessionId);

  const notification = {
    label: "you have a new print order, " + Math.floor(Math.random() * 1000000),
  };

  stompClient.publish(queue, JSON.stringify(notification));

  stompClient.disconnect();
});
