const {ipcRenderer} = require("electron");
const moment = require("moment");
window.$ = window.jQuery = require("jquery");
const {maxLogSize} = require("../config.json");
let cfg = {};

let testBtn, resetBtn, saveConfigBtn, viewLatestTicketBtn, showPassBtn;
let host, port, queue;
let url, uuid, password;
let interval, retries;
let logsTA, lastStatus;
let testJobId;

function populateForm() {
    host.val(cfg.mq.host);
    port.val(cfg.mq.port);
    queue.val(cfg.mq.queue);
    url.val(cfg.svc.url);
    interval.val(cfg.svc.poll);
    retries.val(cfg.svc.attempts);
    uuid.val(cfg.printer.uuid);
    password.val(cfg.printer.password);
}

function populateStats(data) {
    // data = {processed: 9, failed: 3, last: {jobId: 1, at: moment().toLocaleString()}}
    viewLatestTicketBtn.show();
    if (data.last?.jobId) {
        lastStatus.text(`Last printed #${data.last?.jobId} at ${data.last?.at}`);
        lastStatus.show();
        viewLatestTicketBtn.show();
    } else {
        lastStatus.hide();
        viewLatestTicketBtn.hide();
    }
}

function setupCharts(data) {
    var ctx = $('#chart')[0].getContext('2d');
    var chart = new Chart(ctx, {
        type: 'doughnut', data: {
            labels: ['Printed', 'Failed'], datasets: [{
                label: 'Print Jobs', data: [data.processed, data.failed], backgroundColor: ['seagreen', 'orangered'],
            }]
        }, options: {
            // legend: false,
            responsive: true, maintainAspectRatio: false,
        }
    });
}

ipcRenderer.on("cfg", (event, data) => {
    cfg = data;
    populateForm();
});

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
    populateStats(data);
    setupCharts(data);
});

ipcRenderer.on("status", (event, data) => {
    const status = $(`label.status.${data.type}`);
    status.removeClass('green')
    if (!data.success) {
        status.text(data.error);
    } else {
        status.addClass('green')
        status.text(data.status);
    }
});


$(function () {
    testBtn = $("button#test");
    resetBtn = $("button#reset");
    saveConfigBtn = $("button#saveConfig");
    viewLatestTicketBtn = $("button#viewLatestTicket");
    showPassBtn = $("button#showPass");

    testJobId = $('input[name="testJobId"]');
    lastStatus = $("label.last.status");
    host = $("input[name='host']");
    port = $("input[name='port']");
    url = $("input[name='url']");
    uuid = $("input[name='uuid']");
    password = $("input[name='password']");
    queue = $("input[name='queue']");
    interval = $("select[name='interval']");
    retries = $("select[name='retries']");

    viewLatestTicketBtn.off("click");
    viewLatestTicketBtn.on("click", (event) => {
        ipcRenderer.send("viewLatestTicket");
    });

    testBtn.off("click");
    testBtn.on("click", (event) => {
        ipcRenderer.send("test", testJobId.val());
    });

    resetBtn.off("click");
    resetBtn.on("click", (event) => {
        logsTA = $("textarea#logs");
        ipcRenderer.send('reset', logsTA.text())
        const proceed = window.confirm("Save current logs to file before clearing?");
        if (proceed) {
            ipcRenderer.send('reset', logsTA.text())
        }
        logsTA.text('');
    });

    showPassBtn.off("click");
    showPassBtn.on("click", (event) => {
        password.attr("type", "text")
        setTimeout(() => password.attr("type", "password"), 3000)
    });

    saveConfigBtn.on("click", async (event) => {
        const proceed = window.confirm("Update config and restart app?");
        if (proceed) {
            ipcRenderer.send("updateAppConfig", {
                "mq": {
                    "host": host.val(), "port": port.val(), "queue": queue.val()
                }, "svc": {
                    "url": url.val(), "attempts": retries.val(), "poll": interval.val()
                }, "printer": {
                    "uuid": uuid.val(), "password": password.val()
                }
            });
        } else {
            populateForm(cfg)
        }
    });

    populateStats({});
    ipcRenderer.send("domReady");
});

