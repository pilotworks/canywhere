import { Tray, Menu, nativeImage, app, BrowserWindow } from "electron";
import path from "node:path";

export function createSystemTray(
  mainWindow: BrowserWindow,
  onRestartDaemon: () => void,
  isDaemonHealthy: () => boolean
): Tray {
  // Simple clean 16x16 icon data uri or blank image
  const icon = nativeImage.createEmpty();
  const tray = new Tray(icon);
  tray.setTitle("CW"); // Short macOS tray title

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Canywhere",
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    { type: "separator" },
    {
      label: isDaemonHealthy() ? "Daemon: Online (Port 7890)" : "Daemon: Connecting...",
      enabled: false
    },
    {
      label: "Restart Daemon",
      click: () => onRestartDaemon()
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        (app as any).isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip("Canywhere Assistant");
  tray.setContextMenu(contextMenu);

  tray.on("click", () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}
