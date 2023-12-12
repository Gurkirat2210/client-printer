const { ipcRenderer } = require("electron");
window.$ = window.jQuery = require("jquery");

ipcRenderer.on("print-order", (event, data) => {
  const logsTA = $("textarea#logs");
  logsTA.append(data);
  logsTA.append("\n");
});

$(function () {

  const testBtn = $("button#test");
  testBtn.off("click");
  testBtn.on("click", (event) => {
    ipcRenderer.send("test-activeMq");
  });

  
});

ipcRenderer.send("connect-activeMq");
