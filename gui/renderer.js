const {ipcRenderer} = require("electron");
const moment = require("moment");
window.$ = window.jQuery = require("jquery");

const {pollInterval, activeMq, printService, printer} = require("../config.json");

ipcRenderer.on("log", (event, data) => {
    const logsTA = $("textarea#logs");
    logsTA.append(`${moment()} - ${data}`);
    logsTA.append("\n");
    logsTA.scrollTop(logsTA[0].scrollHeight);
});

ipcRenderer.on("stats", (event, data) => {
    const statsTA = $("textarea#stats");
    statsTA.text("");
    statsTA.append(`Received: ${data.received}\n`);
    statsTA.append(`Processed: ${data.processed}\n`);
    statsTA.append(`Failed: ${data.failed}\n`);
    statsTA.append(`\nLast Message: \n`);
    statsTA.append(`At: ${data.last.at}\n`);
    statsTA.append(`Job Id: ${data.last.jobId}\n`);
    statsTA.append(`Status : ${data.last.success ? 'Printed' : 'Failed'}`);
});

ipcRenderer.on("mq-status", (event, data) => {
    const mqStatus = $(".mqConfig label.status");
    mqStatus.removeClass('green')
    if (!data.success) {
        mqStatus.text('Failed, ' + data.error);
        mqStatus.addClass('red')
    } else {
        mqStatus.text(data.status);
        const connectBtn = $("button#connect");
        if (data.status === 'Disconnected') {
            connectBtn.text('Connect');
        } else {
            connectBtn.text('Disconnect');
            mqStatus.addClass('green')
        }
    }
});

ipcRenderer.on("poll-status", (event, data) => {
    const pollStatus = $(".pollConfig label.status");
    pollStatus.removeClass('green')
    if (!data.success) {
        pollStatus.text('Failed, ' + data.error);
        pollStatus.addClass('red')
    } else {
        pollStatus.text(data.status);
        const startPollBtn = $("button#startPoll");
        if (data.status === 'Running') {
            startPollBtn.text('Stop');
            pollStatus.addClass('green')
        } else {
            startPollBtn.text('Start');
        }
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

    const resetBtn = $("button#reset");
    resetBtn.off("click");
    resetBtn.on("click", (event) => {
        ipcRenderer.send('reset');
    });

    const mqConfig = $('table.mqConfig');
    const pollConfig = $('table.pollConfig');
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
    ipcRenderer.send('stopPoll');
    ipcRenderer.send('disconnect');


});

