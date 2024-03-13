const {ipcRenderer} = require("electron");
window.$ = window.jQuery = require("jquery");


const {pollInterval, activeMq, printService, printer} = require("../config.json");

ipcRenderer.on("log", (event, data) => {
    const logsTA = $("textarea#logs");
    logsTA.append(data);
    logsTA.append("\n");
});

ipcRenderer.on("mq-status", (event, data) => {
    const mqStatus = $("label[name='mq-status']");
    if (!data.success) {
        mqStatus.text('Failed, ' + data.error);
    } else {
        mqStatus.text(data.status);
        const connectBtn = $("button#connect");
        connectBtn.text(data.status === 'Disconnected' ? 'Connect' : 'Disconnect');
    }
});

ipcRenderer.on("poll-status", (event, data) => {
    const pollStatus = $("label[name='poll-status']");
    if (!data.success) {
        pollStatus.text('Failed, ' + data.error);
    } else {
        pollStatus.text(data.status);
        const startPollBtn = $("button#startPoll");
        startPollBtn.text(data.status === 'Running' ? 'Stop' : 'Start');
    }
});

$(function () {
    const testBtn = $("button#test");
    const testJobId = $("input#testJobId");
    testBtn.off("click");
    testBtn.on("click", (event) => {
        ipcRenderer.send("test", {jobId: testJobId.val()});
    });

    const startPollBtn = $("button#startPoll");
    startPollBtn.off("click");
    startPollBtn.on("click", (event) => {
        ipcRenderer.send(startPollBtn.text().toLowerCase() + 'Poll');
    });

    const clearBtn = $("button#clear");
    clearBtn.off("click");
    clearBtn.on("click", (event) => {
        const logsTA = $("textarea#logs");
        logsTA.text('');
    });

    const connectBtn = $("button#connect");
    connectBtn.off("click");
    connectBtn.on("click", (event) => {
        ipcRenderer.send(connectBtn.text().toLowerCase());
    });

    const mqConfig = $('table[name="mqConfig"]');
    const pollConfig = $('table[name="pollConfig"]');
    pollConfig.hide();
    mqConfig.hide();

    const modeRadio = $('input[type="radio"][name="mode"]');
    modeRadio.on("change", (event) => {
        pollConfig.hide();
        mqConfig.hide();
        const val = $('input[type="radio"][name="mode"]:checked').val();
        if (val == "mq") {
            mqConfig.show();
        } else {
            pollConfig.show();
        }
    });

    const host = $("input[name='host']");
    const port = $("input[name='port']");
    const url = $("input[name='url']");
    const uuid = $("input[name='uuid']");
    const password = $("input[name='password']");
    const queue = $("input[name='queue']");
    const interval = $("input[name='interval']");

    interval.val(pollInterval);
    host.val(activeMq.host);
    port.val(activeMq.port);
    url.val(printService.url);
    uuid.val(printer.uuid);
    password.val(printer.password);
    queue.val(activeMq.queue);

    clearBtn.click();

});

