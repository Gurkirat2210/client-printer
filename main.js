const {app, BrowserWindow, Tray, ipcMain, ipcRenderer} = require("electron");
const path = require("node:path");
const {activeMq, window, pollInterval, fileNameTimestampFmt} = require("./config.json");
const fs = require("fs");
const Stomp = require("stomp-client");
const moment = require("moment");
const {handlePayload, getJobs, testRetrieveJob} = require("./service");
const stompClient = new Stomp({
    host: activeMq.host,
    port: activeMq.port,
});
const stats = {
    received: 0,
    processed: 0,
    failed: 0,
    last: {
        at: null,
        jobId: 0,
        success: null
    }
}

let isQuiting;
let tray;
let mainWindow;
let pollTimeout;
let stompSession;
let domReady;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        ...window,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
    });
    mainWindow.webContents.openDevTools();
    mainWindow.loadFile("gui/index.html");

    mainWindow.on('minimize', (ev) => {
        mainWindow.hide();
        ev.preventDefault();
    });

    mainWindow.on("close", (ev) => {
        if (!isQuiting) {
            mainWindow.hide();
            ev.preventDefault();
            ev.returnValue = false;
        }
    });

    ipcMain.on("test", async (ipc, args) => {
        try {
            ipc.reply("log", `Job#TEST: Attempt#1/1: retrieving pdf..`);
            const pdfStream = await testRetrieveJob(ipc);
            const fileName = `${__dirname}/pdf/${moment().format(fileNameTimestampFmt)}_TEST.pdf`;
            ipc.reply("log", `Job#TEST: Attempt#1/1: printing pdf ${fileName}..`);
            await fs.writeFileSync(fileName, pdfStream);
            stompClient.publish(activeMq.queue, JSON.stringify({
                label: "This is test message is pushed to validate if the consumer is working, pushed at: " + new Date(),
                jobId: -1,
            }))
        } catch (error) {
            ipc.reply("log", error?.message);
        }
    });

    ipcMain.on("startPoll", async (ipc, args) => {
        const poll = async () => {
            const jobs = await getJobs(ipc);
            if (!jobs.length) {
                ipc.reply("log", "No jobs found");
            }
            for (let i in jobs) {
                await handlePayload(JSON.stringify(jobs[i]), ipc)
            }
            ipc.reply("log", `Sleeping for ${pollInterval / 1000} seconds..`);
        }
        try {
            await poll();
            pollTimeout = setInterval(poll, pollInterval);
            ipc.reply("status", {
                success: true,
                type: 'poll',
                status: `Polling new jobs every ${pollInterval / 1000} seconds..`
            });
        } catch (error) {
            ipc.reply("status", {
                success: false, type: 'poll',
                error: error.message
            });
        }
    });

    ipcMain.on("stopPoll", async (ipc, args) => {
        clearInterval(pollTimeout);
        ipc.reply("log", `Polling for new jobs STOPPED`);
        ipc.reply("status", {
            success: true,
            type: 'poll',
            status: ''
        });
    });

    ipcMain.on("reset", async (ipc, args) => {
        stats.received = 0;
        stats.processed = 0;
        stats.failed = 0;
        stats.last = {}
        const fileName = `${__dirname}/logs/${moment().format(fileNameTimestampFmt)}.logs`;
        await fs.writeFileSync(fileName, args);
        ipc.reply("stats", stats);
    });

    mainWindow.webContents.on('did-finish-load', () => {
        domReady = true;
        if (pollTimeout?._onTimeout) {
            ipc.send("status", {
                success: true,
                type: 'poll',
                status: `Polling new jobs every ${pollInterval / 1000} seconds..`
            });
        }
        if (stompSession) {
            ipc.send("status", {
                success: true,
                type: 'mq',
                status: `Connected, ${stompSession}`
            });
        }
    });
};

function setupTray() {
    tray = new Tray(path.join(__dirname, 'gui/tray.png'));
    tray.on("click", () => {
        if (mainWindow) {
            mainWindow.show();
        }
    })
}

const ipc = {
    send: (channel, data) => {
        setTimeout(() => mainWindow.webContents.send(channel, data), domReady ? 0 : 5000);
    }
}

app.whenReady().then(async () => {
    await setupTray();
    await createWindow();

    stompClient.connect((sessionId) => {
        stompSession = sessionId;
        ipc.send("status", {
            success: true,
            type: 'mq',
            status: `Connected, ${sessionId}`
        });
        stompClient.subscribe(activeMq.queue, async (body, headers) => {
            try {
                stats.received++;
                ipc.send("log", `Received message, ${body}`);
                body = JSON.parse(body);
                if (body.jobId < 0) {
                    return true;
                }
                stats.last.at = moment().toLocaleString();
                stats.last.jobId = body.jobId;
                const success = await handlePayload(body, ipc);
                stats.last.status = success ? 'Printed' : 'Failed';
                if (success) {
                    stats.processed++;
                } else {
                    stats.failed++;
                }
            } catch (error) {
                ipc.send("log", `handling failed, ERROR: ${error.message}`);
            }
            ipc.send("stats", stats);
        });
    }, (error) => {
        ipc.send("status", {
            success: false,
            error: error?.message,
            type: 'mq'
        });
    });


    app.on("activate", () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('before-quit', async function () {
    isQuiting = true;
    await stompClient.unsubscribe(activeMq.queue);
    await stompClient.disconnect();
    await clearInterval(pollTimeout);
});