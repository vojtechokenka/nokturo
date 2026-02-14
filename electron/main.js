const { app, BrowserWindow, session, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { autoUpdater } = require('electron-updater');

console.log('[Nokturo] process.type:', process.type);
console.log('[Nokturo] app exists:', !!app);

// Prevent uncaught errors from crashing the app (e.g. after long inactivity)
process.on('uncaughtException', (err) => {
  console.error('[Nokturo] Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Nokturo] Unhandled rejection:', reason);
});

if (!app) {
  console.error('[Nokturo] FATAL: electron app module not available.');
  process.exit(1);
}

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

function createStaticServer(distPath) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let p = req.url.split('?')[0] || '/';
      if (p === '/') p = '/index.html';
      const filePath = path.join(distPath, p.replace(/^\//, ''));
      const ext = path.extname(filePath);
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(5173, '127.0.0.1', () => {
      resolve({ server, url: 'http://127.0.0.1:5173' });
    });
    server.on('error', reject);
  });
}

function sendUpdateStatus(status, info) {
  const wins = BrowserWindow.getAllWindows();
  for (const win of wins) {
    win.webContents.send('update-status', status, info);
  }
}

function setupAutoUpdater() {
  // Auto-update: check on launch (packaged only), but always register IPC handlers
  autoUpdater.autoDownload = false; // Don't auto-download; let user decide
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Nokturo] Checking for updates...');
    sendUpdateStatus('checking');
  });
  autoUpdater.on('update-available', (info) => {
    console.log('[Nokturo] Update available:', info.version);
    sendUpdateStatus('available', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => {
    console.log('[Nokturo] App is up to date.');
    sendUpdateStatus('up-to-date');
  });
  autoUpdater.on('download-progress', (progress) => {
    sendUpdateStatus('downloading', { percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Nokturo] Update downloaded:', info.version);
    sendUpdateStatus('downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    console.error('[Nokturo] Update error:', err);
    sendUpdateStatus('error', { message: err?.message || 'Unknown error' });
  });

  // IPC: renderer can request update actions
  ipcMain.handle('update-check', async () => {
    if (!app.isPackaged) return { status: 'dev' };
    try {
      const result = await autoUpdater.checkForUpdates();
      return { status: 'ok', version: result?.updateInfo?.version };
    } catch (err) {
      return { status: 'error', message: err?.message };
    }
  });

  ipcMain.handle('update-download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { status: 'ok' };
    } catch (err) {
      return { status: 'error', message: err?.message };
    }
  });

  ipcMain.handle('update-install', () => {
    autoUpdater.quitAndInstall(false, true);
  });

  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Auto-check on launch (packaged only)
  if (app.isPackaged) {
    app.whenReady().then(() => autoUpdater.checkForUpdates().catch(() => {}));
  }
}

function createWindow(loadUrl) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Nokturo',
    backgroundColor: '#fafafa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      partition: 'persist:main',
    },
  });
  win.loadURL(loadUrl);
  // DevTools: v dev módu vždy, v buildu otevři F12 pro debug ENV CHECK
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  } else {
    win.webContents.on('before-input-event', (_, input) => {
      if (input.key === 'F12') win.webContents.openDevTools();
    });
  }

  // Network failure logging – exact Electron error code (e.g. ERR_CONNECTION_REFUSED)
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('[Nokturo] did-fail-load:', { errorCode, errorDescription, validatedURL });
  });
}

setupAutoUpdater();

let staticServer = null;

app.whenReady().then(async () => {
  // Root cause: Chromium proxy negotiation causes fetch to hang on Windows.
  // Force direct connection so Supabase/auth requests complete reliably.
  await session.defaultSession.setProxy({ mode: 'direct' });

  // Dev: Vite server. Prod: lokální HTTP server (file:// by rozbil localStorage/Supabase auth)
  const LOAD_URL = 'http://127.0.0.1:5173';
  if (app.isPackaged) {
    const distPath = path.join(__dirname, '..', 'dist');
    console.log('[Nokturo] Serving dist from:', distPath);
    const { server } = await createStaticServer(distPath);
    staticServer = server;
  }
  createWindow(LOAD_URL);
});

app.on('window-all-closed', () => {
  if (staticServer) staticServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow('http://127.0.0.1:5173');
  }
});
