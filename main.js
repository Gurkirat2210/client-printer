const {app, BrowserWindow, ipcMain} = require("electron");
// const AutoLaunch = require("auto-launch");
const path = require("node:path");
const {queue, activeMq, printService, printer, maxAttempts, window} = require("./config.json");
const Stomp = require("stomp-client");
const {handlePayload, validatePayload} = require("./service");
const stompClient = new Stomp(activeMq.host, activeMq.port);
const createWindow = () => {
    const mainWindow = new BrowserWindow({
        ...window,
        webPreferences: {
            preload: path.join(__dirname, "gui/preload.js"),
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    mainWindow.loadFile("gui/index.html");
    mainWindow.on("close", (ev) => {
        // ev.sender.hide();
        ev.preventDefault();
    });

    ipcMain.on("connect", async (event, args) => {
        stompClient.connect((sessionId) => {
            event.reply("log", `consumer connected, session: ${sessionId}, printer: ${printer.uuid}`);
            stompClient.subscribe(queue, async (body, headers) => {
                await handlePayload(JSON.parse(body), event);
            });
        });
    });

    ipcMain.on("test", async (event, args) => {
        stompClient.publish(queue, JSON.stringify({
            label: "received new print order",
            jobId: args.jobId,
        }));
    });
};

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