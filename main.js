const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
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
    return data.split('\n').filter(line => line.trim() !== '');
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
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  } catch (error) {
    console.error('Error selecting folder:', error);
    return null;
  }
});

const walkSync = async (dir, listSubfolders, fileList = []) => {
  try {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stats = await fs.promises.stat(filePath);
      if (stats.isDirectory()) {
        fileList.push({ path: filePath, name: file, isDirectory: true });
        if (listSubfolders) {
          await walkSync(filePath, listSubfolders, fileList);
        }
      } else {
        fileList.push({ path: filePath, name: file, isDirectory: false });
      }
    }
    return fileList;
  } catch (error) {
    console.error('Error walking through directory:', error);
    return fileList;
  }
};

ipcMain.handle('get-files', async (event, folderPath, categories, listSubfolders) => {
  try {
    const allFiles = await walkSync(folderPath, listSubfolders);
    const recentFiles = await readRecentFiles();
    const categorizedFiles = { all: allFiles, recent: recentFiles };

    categories.forEach(category => {
      categorizedFiles[category.name] = allFiles.filter(file =>
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
  try {
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Continue', 'Cancel'],
      defaultId: 1,
      title: 'Large Listing',
      message: `Listing ${count} items may take a while. Do you want to continue?`
    });
    return result.response === 0;
  } catch (error) {
    console.error('Error confirming large listing:', error);
    return false;
  }
});
