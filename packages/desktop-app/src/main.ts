import { app, BrowserWindow } from "electron";
import path from "node:path";
import { DaemonSupervisor } from "./daemon.js";
import { createSystemTray } from "./tray.js";

let mainWindow: BrowserWindow | null = null;
const daemon = new DaemonSupervisor(7890);

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // On macOS, close button hides window instead of quitting so background daemon stays alive
  mainWindow.on("close", (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
  });

  // Check if Vite dev server is running or load production bundle
  const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";
  if (isDev) {
    try {
      await mainWindow.loadURL("http://localhost:3000");
    } catch {
      // Fallback to desktop-ui dist if vite server is not active
      const distPath = path.resolve(__dirname, "../../desktop-ui/dist/index.html");
      await mainWindow.loadFile(distPath);
    }
  } else {
    const distPath = path.resolve(__dirname, "../../desktop-ui/dist/index.html");
    await mainWindow.loadFile(distPath);
  }
}

app.whenReady().then(async () => {
  try {
    await daemon.start();
  } catch (err) {
    console.error("[DesktopApp] Failed to start daemon supervisor:", err);
  }

  await createWindow();

  if (mainWindow) {
    createSystemTray(
      mainWindow,
      async () => {
        await daemon.stop();
        await daemon.start();
      },
      () => true
    );
  }

  app.on("activate", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("before-quit", async () => {
  (app as any).isQuitting = true;
  await daemon.stop();
});

app.on("window-all-closed", () => {
  // On macOS, keep daemon running even when all windows closed
  if (process.platform !== "darwin") {
    app.quit();
  }
});
