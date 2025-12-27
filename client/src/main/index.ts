import { app, BrowserWindow, ipcMain, Tray, Menu, Notification, nativeImage } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';
import { getBackendUrl, setBackendUrl } from './store';

// POC: Global reference to keep window alive
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

function createTray() {
  if (tray) return;

  // Use a simple icon for now. In a real app, use a proper .png/.ico file
  // For macOS, a template image is preferred. 
  // We'll try to load an asset if it exists, otherwise potentially fail gracefully or use empty image
  const iconPath = path.join(__dirname, '../../resources/icon.png'); // Adjust path as needed
  // If icon doesn't exist, Electron might throw or show transparency. 
  // Let's assume there's an icon or use nativeImage.createEmpty() for dev if needed.
  
  try {
     const icon = nativeImage.createFromPath(iconPath);
     tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  } catch(e) {
     console.warn("Failed to create tray icon:", e);
     tray = new Tray(nativeImage.createEmpty());
  }

  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Show App', 
      click: () => mainWindow?.show() 
    },
    { 
      label: 'Quit', 
      click: () => {
        isQuitting = true;
        app.quit();
      } 
    }
  ]);

  tray.setToolTip('Naver Search Monitor');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    mainWindow?.show();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // In dev, load Vite server. In prod, load file.
  const isDev = !app.isPackaged; 
  
  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      return false;
    }
    return true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  createTray();
}

app.whenReady().then(() => {
  ipcMain.handle('backend:set_url', (_event, url) => {
    setBackendUrl(url);
    return true;
  });

  ipcMain.handle('backend:get_url', () => {
    return getBackendUrl();
  });

  ipcMain.handle('show-notification', (_event, { title, body }) => {
    new Notification({ title, body }).show();
    return true;
  });

  createWindow();

  // Auto-update check (production only)
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
    }
  });
  
  // Clean up tray on quit
  app.on('before-quit', () => {
      isQuitting = true;
  });
});

app.on('window-all-closed', () => {
  // Do not quit on window close (unless isQuitting is true, handled in 'close')
  // But strictly speacking, 'window-all-closed' happens after all windows are closed.
  // Since we preventDefault 'close', this event might not fire unless we really force closed.
  if (process.platform !== 'darwin') {
    // On Windows/Linux, if we hide the window, this event won't fire.
    // If we quit via Tray, isQuitting is true.
    // If we Cmd+Q, isQuitting is true.
  }
});
