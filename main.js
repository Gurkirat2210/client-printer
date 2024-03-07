const {app, BrowserWindow, ipcMain} = require("electron");
// const AutoLaunch = require("auto-launch");
const path = require("node:path");
const {queue, activeMq, printService, printer} = require("./config");
const Stomp = require("stomp-client");
const stompClient = new Stomp(activeMq.host, activeMq.port);
const axios = require('axios');
const fs = require('fs');
const MAX_RETRIES = 2;

async function retrieveJob(job) {
    const jobId = job["jobId"];
    const config = {
        baseURL: printService.url,
        url: `/RetrieveJob/${jobId}?printServerPassword=${encodeURIComponent(printer.password)}`,
        method: 'get',
        responseType: 'arraybuffer',
        responseEncoding: 'binary',
    };
    const fileName = `${__dirname}/pdf/${new Date().getTime()}_${jobId}.pdf`;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const pdf = await axios(config);
            if (pdf.data && pdf.data.length > 0) {
                await fs.writeFileSync(fileName, pdf.data);
                return true;
            }
        } catch (error) {
            console.log(error);
        }
    }
    return false;
}

async function sendAck(job) {
    const config = {
        baseURL: printService.url,
        url: `/UpdatePrintJobStatus/${printer.uuid}`,
        method: 'post',
        contentType: 'application/json',
        data: job
    };
    const response = await axios(config);
    return response;

}

async function handleJob(body, event) {
    event.reply("log", `Job#${body.jobId}, PROCESSING..`);
    const ack = {
        jobId: body.jobId,
        printServerPassword: printer.password
    };
    ack.success = await retrieveJob(body);
    event.reply("log", `Job#${body.jobId}, success: ${ack.success}, sending ACK: ${JSON.stringify(ack)}`);
    ack.success = await sendAck(ack);
    if (ack.success.status === 200) {
        event.reply("log", `Job#${body.jobId}, PROCESSED.`);
    } else {
        event.reply("log", `Job#${body.jobId}, ACK FAILED.`);
    }
}

function validateEvent(body, event) {
    try {
        event.reply("log", `Received payload, ${body}`);
        body = JSON.parse(body);
        return body.jobId;
    } catch (error) {
        event.reply("log", `Invalid payload, ${body}`);
        return false;
    }
}

const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 800, height: 1000, minimizable: false, show: true, webPreferences: {
            preload: path.join(__dirname, "gui/preload.js"), nodeIntegration: true, contextIsolation: false,
        },
    });

    mainWindow.on("close", (ev) => {
        // ev.sender.hide();
        ev.preventDefault(); // prevent quit process
    });

    // and load the index.html of the app.
    mainWindow.loadFile("gui/index.html");

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    ipcMain.on("connect", async (event, args) => {
        try {
            stompClient.connect((sessionId) => {
                event.reply("log", `consumer connected, session: ${sessionId}, printer: ${printer.uuid}`);

                stompClient.subscribe(queue, async (body, headers) => {
                    if (validateEvent(body, event)) {
                        await handleJob(JSON.parse(body), event);
                    }
                });
            });
        } catch (error) {
            console.error(error);
        }
    });

    ipcMain.on("test", async (event, args) => {
        stompClient.publish(queue, JSON.stringify({
            label: "received new print order",
            jobId: args.jobId,
        }));
    });

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    // let autoLaunch = new AutoLaunch({
    //   name: "client-printer",
    //   path: app.getPath("exe"),
    // });

    // autoLaunch.isEnabled().then((isEnabled) => {
    //   if (!isEnabled) autoLaunch.enable();
    // });

    createWindow();

    app.on("activate", () => {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.setLoginItemSettings({
    openAtLogin: true,
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
    stompClient.disconnect();
    if (process.platform !== "darwin") app.quit();
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
