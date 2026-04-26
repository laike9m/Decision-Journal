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
  saveConfig: (csvPath, scoringCsvPath, holdingsCsvPath) => ipcRenderer.invoke('save-config', csvPath, scoringCsvPath, holdingsCsvPath),
  onToggleFind: (callback) => ipcRenderer.on('toggle-find', () => callback()),
  findInPage: (text, options) => ipcRenderer.invoke('find-in-page', text, options),
  stopFindInPage: () => ipcRenderer.invoke('stop-find-in-page'),
  onFoundInPageResults: (callback) => ipcRenderer.on('found-in-page-results', (event, result) => callback(result)),
  onScoreProgress: (callback) => ipcRenderer.on('score-progress', (event, msg) => callback(msg)),
  updateScores: (ticker, skipCall) => ipcRenderer.invoke('update-scores', ticker, skipCall),
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
