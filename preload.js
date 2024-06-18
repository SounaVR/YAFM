const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFiles: (folderPaths, categories, listSubfolders) => ipcRenderer.invoke('get-files', folderPaths, categories, listSubfolders),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  openLocation: (filePath) => ipcRenderer.invoke('open-location', filePath),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  confirmLargeListing: (count) => ipcRenderer.invoke('confirm-large-listing', count),
  logFilePath: (filePath) => ipcRenderer.invoke('log-file-path', filePath),
  readRecentFiles: () => ipcRenderer.invoke('read-recent-files'),
  clearRecentFiles: () => ipcRenderer.invoke('clear-recent-files'),
  watchFolder: (folderPaths) => ipcRenderer.invoke('watch-folder', folderPaths),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  onRefreshFiles: (callback) => ipcRenderer.on('refresh-files', callback),
  openRecycleBin: () => ipcRenderer.invoke('open-recycle-bin')
});