module.exports = {
  queue: '/queue/print-orders-123',
  activeMq: {
    host: "127.0.0.1",
    port: 61613,
  },
  // printService: {
  //   url: "https://print-service-dev.np-healthcare-compass.com",
  // },
  printService: {
    url: "http://localhost:8080",
  },
  // printer: {
  //   uuid: "982b0720-70bb-4cd7-91b3-06ba207869f2",
  //   password: "Yai!4P&P6e7"
  // },
  printer: {
    uuid: "cef8bde7-5dc6-44bb-8060-173f43a0ef24",
    password: "gk-dont-modify"
  }
};
