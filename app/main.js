const {dialog, app, BrowserWindow, Tray, ipcMain} = require("electron");
const path = require("node:path");
const {window, fileNameTimestampFmt} = require("./config.json");
const fs = require("fs");
const moment = require("moment");
const {
    subscribeToMq,
    updatePollStatus,
    startPolling,
    testRetrieveJob,
    updateMQStatus,
    initFoldersAndCfg
} = require("./service");
const cfg = initFoldersAndCfg();
const stats = {
    received: 0,
    processed: 0,
    failed: 0,
    last: {
        at: null,
        jobId: 0,
        fileName: null
    },
}

let stompClient;
let isQuiting;
let tray;
let mainWindow;
let pollingCfg;
let stompSession;
let domReady;

const createWindow = () => {
    mainWindow = new BrowserWindow({
        ...window,
        icon: path.join(__dirname, '../gui/icon.png'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // mainWindow.webContents.openDevTools();
    mainWindow.loadFile(path.join(__dirname, "../gui/index.html"));

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

    ipcMain.on("viewLatestTicket", async (ipc, args) => {
        let ticketPdf = stats.last?.fileName;
        if (!ticketPdf) {
            return;
        }
        const options = {
            title: "Save file",
            defaultPath: path.basename(ticketPdf),
            buttonLabel: "Save",

            filters: [
                {name: 'pdf', extensions: ['pdf']},
                {name: 'All Files', extensions: ['*']}
            ]
        };

        dialog.showSaveDialog(null, options).then(({filePath}) => {
            fs.copyFileSync(ticketPdf, filePath);
        });
    });

    ipcMain.on("test", async (ipc, args) => {
        try {
            ipc.reply("log", `Job#TEST: Attempt#1/1: retrieving pdf`);
            const pdfStream = await testRetrieveJob(cfg);
            const fileName = `${cfg.pdfPath}/${moment().format(fileNameTimestampFmt)}_TEST.pdf`;
            ipc.reply("log", `Job#TEST: Attempt#1/1: printing pdf ${fileName}`);
            await fs.writeFileSync(fileName, pdfStream);
            if (stompClient) {
                stompClient.publish(cfg.mq.queue, JSON.stringify({
                    label: "This is test message is pushed to validate if the consumer is working, pushed at: " + new Date(),
                    jobId: -1,
                }))
                stompClient.publish(cfg.mq.queue, JSON.stringify({
                    label: "This is test message is pushed to simulate new meal order message, pushed at: " + new Date(),
                    jobId: 0,
                }))
            }
        } catch (error) {
            ipc.reply("log", error?.message);
        }
    });

    const exportLogsStats = async (ipc, args) => {
        const fileName = `${cfg.logPath}/${moment().format(fileNameTimestampFmt)}.log`;
        await fs.writeFileSync(fileName, JSON.stringify(stats) + '\n\n' + args);
        stats.received = 0;
        stats.processed = 0;
        stats.failed = 0;
        stats.last = {}
        if (ipc) {
            ipc.reply("stats", stats);
        }
    };

    ipcMain.on("reset", exportLogsStats);

    ipcMain.on("updateAppConfig", async (ipc, args) => {
        await fs.writeFileSync(cfg.configPath, JSON.stringify(args.config));
        await exportLogsStats(null, args.logs);
        app.relaunch()
        app.exit()
    });

    ipcMain.on("domReady", async (ipc, args) => {
        domReady = true;
        if (cfg) {
            ipc.reply("cfg", cfg);
        }
        if (cfg.mq && !stompClient) {
            subscribeToMq(ipc, stats, cfg, (stomp, session) => {
                stompSession = session;
                stompClient = stomp;
            })
        }
        if (cfg.svc.poll && !pollingCfg) {
            pollingCfg = await startPolling(ipc, stats, cfg);
        }
        updatePollStatus(pollingCfg, ipc)
        updateMQStatus(stompSession, ipc)
    });
};

function setupTray() {
    tray = new Tray(path.join(__dirname, '../gui/icon.png'));
    tray.on("click", () => {
        if (mainWindow) {
            mainWindow.show();
        }
    })
}

app.whenReady().then(async () => {
    await setupTray();
    await createWindow();
    app.on("activate", () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('before-quit', async function () {
    isQuiting = true;
    if (stompClient) {
        await stompClient.unsubscribe(cfg.mq?.queue);
        await stompClient.disconnect();
    }
    if (pollingCfg?._onTimeout) {
        await clearInterval(pollingCfg);
    }
});