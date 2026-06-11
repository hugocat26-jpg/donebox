import { app, BrowserWindow, Menu, Tray, globalShortcut, ipcMain, nativeImage, shell } from 'electron';
import { electronApp, is, optimizer } from '@electron-toolkit/utils';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, isAbsolute } from 'node:path';

const icon = join(__dirname, '../../resources/icon.png');
const trayIcon = join(__dirname, '../../resources/tray-icon.png');
const rendererRoot = resolve(__dirname, '../renderer');
const safeExternalProtocols = new Set(['http:', 'https:', 'mailto:']);

app.setPath('userData', join(app.getPath('appData'), 'DoneBox'));
app.setName('DoneBox');

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let currentShortcut = 'Option+Space';

function isInsidePath(basePath: string, targetPath: string): boolean {
  const pathDelta = relative(basePath, targetPath);
  return pathDelta === '' || (!!pathDelta && !pathDelta.startsWith('..') && !isAbsolute(pathDelta));
}

function isLocalAppNavigation(rawUrl: string): boolean {
  try {
    const parsedUrl = new URL(rawUrl);
    if (parsedUrl.protocol === 'file:') return isInsidePath(rendererRoot, fileURLToPath(parsedUrl));
    if (is.dev && process.env.ELECTRON_RENDERER_URL) return parsedUrl.origin === new URL(process.env.ELECTRON_RENDERER_URL).origin;
  } catch {
    return false;
  }
  return false;
}

function openExternalIfAllowed(rawUrl: string): void {
  try {
    const parsedUrl = new URL(rawUrl);
    if (!safeExternalProtocols.has(parsedUrl.protocol)) return;
    shell.openExternal(parsedUrl.toString()).catch((error) => {
      console.error('Failed to open external URL', error);
    });
  } catch {
    return;
  }
}

function openDoneboxQuickAdd(): void {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('donebox-quick-add');
}

function registerShortcut(shortcut: string): void {
  globalShortcut.unregister(currentShortcut);
  currentShortcut = shortcut;
  try {
    globalShortcut.register(currentShortcut, openDoneboxQuickAdd);
  } catch (error) {
    console.error('Failed to register shortcut', error);
  }
}

function createTray(): void {
  const image = nativeImage.createFromPath(trayIcon).resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('DoneBox');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show App', click: openDoneboxQuickAdd },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (isLocalAppNavigation(targetUrl)) return;
    event.preventDefault();
    openExternalIfAllowed(targetUrl);
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternalIfAllowed(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron');
  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window));

  ipcMain.on('update-timer', (_, timeString: string) => {
    if (!tray) return;
    if (process.platform === 'darwin') {
      tray.setTitle(timeString);
    } else {
      tray.setToolTip(timeString ? `Timer: ${timeString}` : 'DoneBox');
    }
  });
  ipcMain.on('update-shortcut', (_, shortcut: string) => registerShortcut(shortcut));

  createWindow();
  createTray();
  registerShortcut(currentShortcut);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
