const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset' // Premium macOS look
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools if needed
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
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
