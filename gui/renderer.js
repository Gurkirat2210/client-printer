const {ipcRenderer} = require("electron");
const moment = require("moment");
window.$ = window.jQuery = require("jquery");
const {pollInterval, activeMq, printService, printer, maxLogSize, maxAttempts} = require("../config.json");

ipcRenderer.on("log", (event, data) => {
    const logsTA = $("textarea#logs");
    logsTA.append(`${moment()} - ${data}`);
    logsTA.append("\n");
    if (logsTA.text().length > maxLogSize) {
        ipcRenderer.send('export-logs', logsTA.text())
        logsTA.text('');
    }
    if (logsTA[0]) {
        logsTA.scrollTop(logsTA[0].scrollHeight);
    }
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
    statsTA.append(`Status: ${data.last.status}`);
});

ipcRenderer.on("status", (event, data) => {
    const status = $("label.status");
    status.removeClass('green')
    if (!data.success) {
        status.text('Failed, ' + data.error);
        status.addClass('red')
    } else {
        status.text(data.status);
    }
});

$(function () {
    const testBtn = $("button#test");
    const testJobId = $("input#testJobId");
    testBtn.off("click");
    testBtn.on("click", (event) => {
        if (testJobId.val() > 0) {
            ipcRenderer.send("test", {jobId: testJobId.val()});
        }
    });

    const pollCheckbox = $("input[name='poll'][type='checkbox']");
    pollCheckbox.on("change", (event) => {
        ipcRenderer.send(pollCheckbox.prop("checked") ? 'startPoll' : 'stopPoll');
    });

    const clearBtn = $("button#clear");
    clearBtn.off("click");
    clearBtn.on("click", (event) => {
        const logsTA = $("textarea#logs");
        ipcRenderer.send('export-logs', logsTA.text())
        logsTA.text('');
    });

    const resetBtn = $("button#reset");
    resetBtn.off("click");
    resetBtn.on("click", (event) => {
        ipcRenderer.send('reset');
    });

    const host = $("input[name='host']");
    const port = $("input[name='port']");
    const url = $("input[name='url']");
    const uuid = $("input[name='uuid']");
    const password = $("input[name='password']");
    const queue = $("input[name='queue']");
    const interval = $("input[name='interval']");
    const retries = $("input[name='retries']");

    interval.val(pollInterval);
    host.val(activeMq.host);
    port.val(activeMq.port);
    url.val(printService.url);
    uuid.val(printer.uuid);
    password.val(printer.password);
    queue.val(activeMq.queue);
    retries.val(maxAttempts);

    ipcRenderer.send('dom-ready');
});

