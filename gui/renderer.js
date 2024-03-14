const {ipcRenderer} = require("electron");
const moment = require("moment");
window.$ = window.jQuery = require("jquery");
const {pollInterval, activeMq, printService, printer, maxLogSize, maxAttempts} = require("../config.json");

let testBtn, resetBtn;
let pollCheckbox;
let host, port, queue;
let url, uuid, password;
let interval, retries;
let logsTA, stats;

ipcRenderer.on("log", (event, data) => {
    logsTA = $("textarea#logs");
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
    stats = $("p#stats");
    stats.text("");
    stats.append(`Received: ${data.received || ''}</br>`);
    stats.append(`Processed: ${data.processed || ''}</br>`);
    stats.append(`Failed: ${data.failed || ''}</br>`);
    stats.append(`</br>Last Message: </br>`);
    stats.append(`At: ${data.last?.at || ''}</br>`);
    stats.append(`Job Id: ${data.last?.jobId || ''}</br>`);
    stats.append(`Status: ${data.last?.status || ''}`);
});

ipcRenderer.on("status", (event, data) => {
    const status = $(`label.status.${data.type}`);
    status.removeClass('green')
    if (!data.success) {
        status.text('Failed, ' + data.error);
    } else {
        status.addClass('green')
        status.text(data.status);
        if (data.type == 'poll' && data.status != '') {
            pollCheckbox.prop('checked', true);
        }
    }
});

$(function () {
    testBtn = $("button#test");
    testBtn.off("click");
    testBtn.on("click", (event) => {
        ipcRenderer.send("test");
    });

    pollCheckbox = $("input[name='poll'][type='checkbox']");
    pollCheckbox.on("change", (event) => {
        ipcRenderer.send(pollCheckbox.prop("checked") ? 'startPoll' : 'stopPoll');
    });

    resetBtn = $("button#reset");
    resetBtn.off("click");
    resetBtn.on("click", (event) => {
        logsTA = $("textarea#logs");
        ipcRenderer.send('reset', logsTA.text())
        logsTA.text('');
    });

    host = $("input[name='host']");
    port = $("input[name='port']");
    url = $("input[name='url']");
    uuid = $("input[name='uuid']");
    password = $("input[name='password']");
    queue = $("input[name='queue']");
    interval = $("input[name='interval']");
    retries = $("input[name='retries']");

    interval.val(pollInterval);
    host.val(activeMq.host);
    port.val(activeMq.port);
    url.val(printService.url);
    uuid.val(printer.uuid);
    password.val(printer.password);
    queue.val(activeMq.queue);
    retries.val(maxAttempts);

});

