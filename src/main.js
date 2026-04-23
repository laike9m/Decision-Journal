const { app, BrowserWindow, ipcMain, dialog, Menu, shell, session } = require('electron');
app.name = 'Decision Journal';
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { startServer, stopServer, updateScores, openUrlInExtension } = require('./ws_server');
const os = require('os');

let mainWindow;
let chromeProfileDir = null; // Cached Chrome profile directory for laike9m@gmail.com

// ─── Chrome Profile Detection ─────────────────────────────────────────

const TARGET_EMAIL = 'laike9m@gmail.com';

/**
 * Read the app's config.json, preserving all existing fields.
 */
function readConfig() {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (e) {
      console.error('Error parsing config:', e);
    }
  }
  return {};
}

/**
 * Merge updates into config.json without overwriting unrelated fields.
 */
function writeConfig(updates) {
  const configPath = path.join(app.getPath('userData'), 'config.json');
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const existing = readConfig();
  const merged = { ...existing, ...updates };
  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Scan Chrome profile directories to find the one logged in as TARGET_EMAIL.
 * Returns the directory name (e.g. "Profile 1") or null if not found.
 */
function detectChromeProfileDir() {
  const chromeDir = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');
  if (!fs.existsSync(chromeDir)) return null;

  const candidates = fs.readdirSync(chromeDir).filter(name =>
    name === 'Default' || name.startsWith('Profile ')
  );

  for (const dir of candidates) {
    const prefsPath = path.join(chromeDir, dir, 'Preferences');
    try {
      const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
      const accounts = prefs.account_info || [];
      if (accounts.some(a => a.email === TARGET_EMAIL)) {
        console.log(`[chrome-profile] Found ${TARGET_EMAIL} in "${dir}"`);
        return dir;
      }
    } catch (e) {
      // Skip unreadable profiles
    }
  }

  console.warn(`[chrome-profile] Could not find profile for ${TARGET_EMAIL}`);
  return null;
}

/**
 * Ensure chromeProfileDir is set: read from config cache, or detect + persist.
 */
function ensureChromeProfile() {
  const config = readConfig();
  if (config.chromeProfileDir) {
    chromeProfileDir = config.chromeProfileDir;
    console.log(`[chrome-profile] Using cached profile: "${chromeProfileDir}"`);
    return;
  }

  chromeProfileDir = detectChromeProfileDir();
  if (chromeProfileDir) {
    writeConfig({ chromeProfileDir });
    console.log(`[chrome-profile] Detected and saved profile: "${chromeProfileDir}"`);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    icon: path.join(__dirname, '..', 'assets', 'app_icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    },
    titleBarStyle: 'hiddenInset' // Premium macOS look
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Open DevTools if needed
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  // Set Dock icon on macOS (needed for dev mode since there's no .app bundle)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(path.join(__dirname, '..', 'assets', 'app_icon_dock.png'));
  }

  // Detect Chrome profile for laike9m@gmail.com (first launch only)
  if (process.platform === 'darwin') {
    ensureChromeProfile();
  }

  // Start WebSocket server for Chrome extension communication
  startServer();

  createWindow();

  // Application menu with Find support
  const template = [
    { role: 'appMenu' },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('toggle-find');
            }
          }
        }
      ]
    },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));

  // Forward native found-in-page results to renderer
  mainWindow.webContents.on('found-in-page', (event, result) => {
    mainWindow.webContents.send('found-in-page-results', {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches,
      finalUpdate: result.finalUpdate
    });
  });

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

// File Watcher
let fileWatcher = null;

function watchFile(filePath) {
  if (fileWatcher) {
    fileWatcher.close();
  }
  
  if (!fs.existsSync(filePath)) return;

  fileWatcher = fs.watch(filePath, (eventType, filename) => {
    if (eventType === 'change') {
      if (mainWindow) {
        mainWindow.webContents.send('file-changed', filePath);
      }
    }
  });
}

// IPC Handlers
ipcMain.handle('get-default-path', () => {
  return path.join(app.getPath('home'), 'decision_journal.csv');
});

ipcMain.handle('get-config', () => {
  return readConfig();
});

ipcMain.handle('save-config', (event, csvPath, scoringCsvPath, holdingsCsvPath) => {
  console.log('save-config received csvPath:', csvPath, 'scoringCsvPath:', scoringCsvPath, 'holdingsCsvPath:', holdingsCsvPath);
  writeConfig({ csvPath, scoringCsvPath, holdingsCsvPath });
  return true;
});

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }
    watchFile(filePath); // Watch file on read
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    watchFile(filePath); // Ensure we watch it if it was just created
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'openDirectory'],
    filters: [{ name: 'CSV Files', extensions: ['csv'] }]
  });
  if (result.canceled) {
    return null;
  }
  
  const selectedPath = result.filePaths[0];
  try {
    const stats = fs.statSync(selectedPath);
    if (stats.isDirectory()) {
      return path.join(selectedPath, 'decision_journal.csv');
    }
  } catch (e) {
    // Ignore errors
  }
  return selectedPath;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('toggle-fullscreen', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('update-scores', async (event, ticker) => {
  try {
    const userDataPath = app.getPath('userData');
    const onProgress = (msg) => {
      console.log('[ws_server]', msg);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('score-progress', msg);
      }
    };
    const results = await updateScores(ticker, userDataPath, onProgress);
    return results;
  } catch (error) {
    console.error('Error updating scores:', error);
    throw error;
  }
});

// Native Find in Page IPC handlers
ipcMain.handle('find-in-page', (event, text, options) => {
  if (mainWindow && text) {
    mainWindow.webContents.findInPage(text, options || {});
  }
});

ipcMain.handle('stop-find-in-page', () => {
  if (mainWindow) {
    mainWindow.webContents.stopFindInPage('clearSelection');
  }
});

ipcMain.handle('open-external', (event, url) => {
  // Try to open via extension first (opens in background tab)
  if (openUrlInExtension(url)) {
    return;
  }

  if (process.platform === 'darwin' && chromeProfileDir) {
    // Use `open -g` to launch Chrome in the background without stealing focus
    const escaped = url.replace(/"/g, '\\"');
    exec(`open -g -a "Google Chrome" "${escaped}" --args --profile-directory="${chromeProfileDir}"`);
    return;
  }
  return shell.openExternal(url);
});
