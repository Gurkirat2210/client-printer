const {ipcRenderer} = require("electron");
const moment = require("moment");
window.$ = window.jQuery = require("jquery");
const {maxLogSize} = require("../app-config.json");
let printConfig = {};

let testBtn, resetBtn, saveConfigBtn, viewLatestTicketBtn;
let host, port, queue;
let url, uuid, password;
let interval, retries;
let logsTA, stats, lastStatus;

function populateForm(printConfig) {
    interval.val(printConfig.printService.poll);
    host.val(printConfig.activeMq.host);
    port.val(printConfig.activeMq.port);
    url.val(printConfig.printService.url);
    uuid.val(printConfig.printer.uuid);
    password.val(printConfig.printer.password);
    queue.val(printConfig.activeMq.queue);
    retries.val(printConfig.printService.maxAttempts);
}

function populateStats(data) {
    stats.text("");
    data = {processed: 9, failed: 3, last: {jobId: 1, at: moment().toLocaleString()}}
    lastStatus.text(data.last?.jobId ? `Last printed #${data.last?.jobId} at ${data.last?.at}` : '');
    setupCharts(data);
}

function setupCharts(data) {
    var ctx = $('#chart')[0].getContext('2d');
    var chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Printed', 'Failed'],
            datasets: [{
                label: 'Print Jobs',
                data: [data.processed, data.failed],
                backgroundColor: ['seagreen', 'orangered'],
            }]
        },
        options: {
            // legend: false,
            responsive: true,
            maintainAspectRatio: false,
        }
    });
}

ipcRenderer.on("printConfig", (event, data) => {
    printConfig = data;
    populateForm(printConfig);
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
    populateStats(data)
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

    lastStatus = $("label.last.status");
    stats = $("p#stats");
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
        ipcRenderer.send("test");
    });

    resetBtn.off("click");
    resetBtn.on("click", (event) => {
        logsTA = $("textarea#logs");
        ipcRenderer.send('reset', logsTA.text())
        logsTA.text('');
    });

    saveConfigBtn.on("click", async (event) => {
        const proceed = window.confirm("Changes will take effect after app restart. Continue?");
        if (proceed) {
            ipcRenderer.send("updateAppConfig", {
                "activeMq": {
                    "host": host.val(),
                    "port": port.val(),
                    "queue": queue.val()
                },
                "printService": {
                    "url": url.val(),
                    "maxAttempts": retries.val(),
                    "poll": interval.val()
                },
                "printer": {
                    "uuid": uuid.val(),
                    "password": password.val()
                }
            });
        } else {
            populateForm(printConfig)
        }
    });

    populateStats({});
    ipcRenderer.send("domReady");
});

