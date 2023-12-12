const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("node:path");
const { queue, activeMq } = require("./config");
const Stomp = require("stomp-client");
const stompClient = new Stomp(activeMq.host, activeMq.port);

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "gui/preload.js"),
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // and load the index.html of the app.
  mainWindow.loadFile("gui/index.html");

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  ipcMain.on("connect-activeMq", async (event, args) => {
    try {
      stompClient.connect((sessionId) => {
        stompClient.subscribe(queue, (body, headers) => {
          const text = `\n===============\n${JSON.stringify(
            headers,
            null,
            4
          )}\n\n${JSON.stringify(JSON.parse(body), null, 4)}\n`;
          event.reply("print-order", text);
        });
        event.reply(
          "print-order",
          "consumer connected, session id: " + sessionId
        );
      });
    } catch (error) {
      console.error(error);
    }
  });

  ipcMain.on("test-activeMq", async (event, args) => {
    stompClient.publish(
      queue,
      JSON.stringify({ label: "Test print-order notification, " + new Date() })
    );
  });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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
