const path = require('node:path');
const http = require('node:http');
const { fileURLToPath, pathToFileURL } = require('node:url');
const { app, BrowserWindow, dialog, shell } = require('electron');

const APP_URL = 'http://127.0.0.1:8765/';
const APP_ORIGIN = new URL(APP_URL).origin;
let appWindow;
let ownedServer;

app.setName('拾游');
app.setPath('userData', path.join(app.getPath('appData'), '拾游'));

function findExistingShiyou() {
  return new Promise(resolve => {
    const request = http.get(APP_URL, { timeout: 1200 }, response => {
      let html = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { html += chunk; });
      response.on('end', () => resolve(response.statusCode === 200 && /<title>拾游/.test(html)));
    });
    request.on('timeout', () => { request.destroy(); resolve(false); });
    request.on('error', () => resolve(false));
  });
}

async function ensureLocalServer() {
  if (await findExistingShiyou()) return;
  const serverModulePath = path.join(app.getAppPath(), 'server.mjs');
  const { listenShiyouServer } = await import(pathToFileURL(serverModulePath).href);
  try {
    ownedServer = await listenShiyouServer({ log: false });
  } catch (error) {
    if (error.code === 'EADDRINUSE' && await findExistingShiyou()) return;
    throw error;
  }
}

function openExternal(url) {
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) shell.openExternal(parsed.href);
    else if (parsed.protocol === 'file:') shell.openPath(fileURLToPath(parsed));
  } catch {
    // Ignore malformed URLs instead of handing them to the operating system.
  }
}

function createWindow() {
  appWindow = new BrowserWindow({
    title: '拾游 · 游戏攻略档案',
    width: 1440,
    height: 940,
    minWidth: 900,
    minHeight: 640,
    autoHideMenuBar: true,
    backgroundColor: '#0b0c10',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  appWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  appWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== APP_ORIGIN) {
      event.preventDefault();
      openExternal(url);
    }
  });
  appWindow.loadURL(APP_URL);
  appWindow.on('closed', () => { appWindow = null; });
}

app.whenReady().then(async () => {
  try {
    await ensureLocalServer();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('拾游启动失败', `无法启动本地应用服务。\n${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (ownedServer?.listening) ownedServer.close();
});
