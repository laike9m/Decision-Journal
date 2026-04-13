const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  onFileChanged: (callback) => ipcRenderer.on('file-changed', (event, path) => callback(path)),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (csvPath) => ipcRenderer.invoke('save-config', csvPath)
});
