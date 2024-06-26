const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getFiles: (folderPath, categories, listSubfolders) => ipcRenderer.invoke('get-files', folderPath, categories, listSubfolders),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  openLocation: (filePath) => ipcRenderer.invoke('open-location', filePath),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  confirmLargeListing: (count) => ipcRenderer.invoke('confirm-large-listing', count),
  logFilePath: (filePath) => ipcRenderer.invoke('log-file-path', filePath),
  readRecentFiles: () => ipcRenderer.invoke('read-recent-files'),
  clearRecentFiles: () => ipcRenderer.invoke('clear-recent-files'),
  watchFolder: (folderPath) => ipcRenderer.invoke('watch-folder', folderPath),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  openRecycleBin: () => ipcRenderer.invoke('open-recycle-bin'),
  walkSync: (dirs, listSubfolders, countFilesOnly) => ipcRenderer.invoke('walk-sync', dirs, listSubfolders, countFilesOnly),
  onRefreshFiles: (callback) => ipcRenderer.on('refresh-files', callback) // Add this line
});
