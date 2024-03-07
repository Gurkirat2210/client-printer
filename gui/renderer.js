const {ipcRenderer} = require("electron");
window.$ = window.jQuery = require("jquery");

ipcRenderer.on("log", (event, data) => {
    const logsTA = $("textarea#logs");
    logsTA.append(data);
    logsTA.append("\n");
});

$(function () {
    const testBtn = $("button#test");
    const testJobId = $("input#testJobId");
    testBtn.off("click");
    testBtn.on("click", (event) => {
        ipcRenderer.send("test", {jobId : testJobId.val()});
    });

    const clearBtn = $("button#clear");
    clearBtn.off("click");
    clearBtn.on("click", (event) => {
        const logsTA = $("textarea#logs");
        logsTA.text('');
    });
});

ipcRenderer.send("connect");
