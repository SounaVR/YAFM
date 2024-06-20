const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

let mainWindow;
let watchers = [];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  watchers.forEach(watcher => watcher.close());
  watchers = [];
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

const logFilePath = path.join(app.getPath('userData'), 'file-paths.log');
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

// Function to ensure the log file exists
async function ensureLogFileExists() {
  try {
    await fs.promises.access(logFilePath, fs.constants.F_OK);
  } catch (error) {
    await fs.promises.writeFile(logFilePath, '');
  }
}

ipcMain.handle('log-file-path', async (event, filePath) => {
  await ensureLogFileExists();
  await fs.promises.appendFile(logFilePath, `${filePath}\n`);
});

async function readRecentFiles() {
  try {
    await ensureLogFileExists();
    const data = await fs.promises.readFile(logFilePath, 'utf8');
    const recentFilePaths = data.split('\n').filter(line => line.trim() !== '');
    const recentFiles = [];

    for (const filePath of recentFilePaths) {
      try {
        const stats = await fs.promises.stat(filePath);
        recentFiles.push({ path: filePath, name: path.basename(filePath), isDirectory: stats.isDirectory(), mtime: stats.mtime });
      } catch (err) {
        console.error('Error getting file stats:', err);
      }
    }

    return recentFiles;
  } catch (error) {
    console.error('Error reading recent files:', error);
    return [];
  }
}

ipcMain.handle('read-recent-files', readRecentFiles);

ipcMain.handle('clear-recent-files', async () => {
  try {
    await ensureLogFileExists();
    await fs.promises.writeFile(logFilePath, '');
    return true;
  } catch (error) {
    console.error('Error clearing recent files:', error);
    return false;
  }
});

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'multiSelections'] });
    if (result.canceled || result.filePaths.length === 0) return [];
    return result.filePaths;
  } catch (error) {
    console.error('Error selecting folder:', error);
    return [];
  }
});

const walkSync = async (dirs, listSubfolders, countFilesOnly = false) => {
  if (!Array.isArray(dirs)) {
    dirs = [dirs];
  }

  let fileCount = 0;
  const fileList = [];
  const queue = [...dirs];

  const processDir = async (dir) => {
    try {
      const files = await fs.promises.readdir(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.promises.stat(filePath);

        if (countFilesOnly) {
          fileCount++;
        } else {
          if (stats.isDirectory()) {
            fileList.push({ path: filePath, name: file, isDirectory: true, mtime: stats.mtime });
            if (listSubfolders) {
              queue.push(filePath);
            }
          } else {
            fileList.push({ path: filePath, name: file, isDirectory: false, mtime: stats.mtime });
            fileCount++;
          }
        }

        if (countFilesOnly && fileCount > 5000) {
          return { fileList, countExceeded: true, fileCount };
        }
      }
    } catch (error) {
      console.error('Error walking through directory:', error);
    }
  };

  while (queue.length) {
    const dir = queue.shift();
    await processDir(dir);
  }

  return { fileList, countExceeded: fileCount > 5000, fileCount };
};

ipcMain.handle('walk-sync', async (event, dirs, listSubfolders, countFilesOnly = false) => {
  const result = await walkSync(dirs, listSubfolders, countFilesOnly);
  return result;
});

ipcMain.handle('get-files', async (event, folderPaths, categories, listSubfolders) => {
  try {
    const { fileList, countExceeded } = await walkSync(folderPaths, listSubfolders);
    const recentFiles = await readRecentFiles();
    const categorizedFiles = { all: fileList, recent: recentFiles };

    categories.forEach(category => {
      categorizedFiles[category.name] = fileList.filter(file =>
        category.extensions.some(ext => file.path.endsWith(ext))
      );
    });

    return categorizedFiles;
  } catch (error) {
    console.error('Error getting files:', error);
    return { all: [], recent: [], ...categories.reduce((obj, category) => ({ ...obj, [category.name]: [] }), {}) };
  }
});

ipcMain.handle('open-file', async (event, filePath) => {
  try {
    require('child_process').exec(`start "" "${filePath}"`);
    return true;
  } catch (error) {
    console.error('Error opening file:', error);
    return false;
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    const { default: trash } = await import('trash');
    await trash([filePath]);
    return true;
  } catch (err) {
    console.error('Error deleting file:', err);
    return false;
  }
});

ipcMain.handle('open-location', async (event, filePath) => {
  try {
    require('child_process').exec(`explorer.exe /select,"${filePath}"`);
    return true;
  } catch (error) {
    console.error('Error opening location:', error);
    return false;
  }
});

ipcMain.handle('save-settings', async (event, settings) => {
  try {
    await fs.promises.writeFile(settingsPath, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});

ipcMain.handle('load-settings', async () => {
  try {
    await fs.promises.access(settingsPath, fs.constants.F_OK);
    const data = await fs.promises.readFile(settingsPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
});

ipcMain.handle('confirm-large-listing', async (event, count) => {
  const result = await dialog.showMessageBox({
    type: 'warning',
    buttons: ['Continue', 'Cancel'],
    defaultId: 1,
    title: 'Large Listing',
    message: `Listing ${count} items may take a while. Do you want to continue?`
  });
  return result.response === 0;
});

//watcher
ipcMain.handle('watch-folder', (event, folderPaths) => {
  // Close existing watchers
  watchers.forEach(watcher => watcher.close());
  watchers = [];

  folderPaths.forEach(folderPath => {
    const watcher = fs.watch(folderPath, (eventType, filename) => {
      if (filename && mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('refresh-files');
      }
    });

    watchers.push(watcher);
  });
});

ipcMain.handle('stop-watching', () => {
  watchers.forEach(watcher => watcher.close());
  watchers = [];
});

ipcMain.handle('open-recycle-bin', async () => {
  try {
    exec('explorer.exe shell:RecycleBinFolder');
    return true;
  } catch (error) {
    console.error('Error opening Recycle Bin:', error);
    return false;
  }
});