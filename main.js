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

ipcMain.handle('log-file-path', async (event, filePath) => {
  fs.appendFileSync(logFilePath, `${filePath}\n`);
});

ipcMain.handle('read-recent-files', async () => {
  if (!fs.existsSync(logFilePath)) return [];
  const data = fs.readFileSync(logFilePath, 'utf8');
  return data.split('\n').filter(line => line.trim() !== '');
});

ipcMain.handle('clear-recent-files', async () => {
  fs.writeFileSync(logFilePath, '');
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

const walkSync = (dir, listSubfolders, fileList = []) => {
  fs.readdirSync(dir).forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory() && listSubfolders) {
      walkSync(filePath, listSubfolders, fileList);
    } else if (!fs.statSync(filePath).isDirectory()) {
      fileList.push(filePath);
    }
  });
  return fileList;
};

ipcMain.handle('get-files', async (event, folderPath, categories, listSubfolders) => {
  const allFiles = walkSync(folderPath, listSubfolders).map(file => ({ path: file, name: path.basename(file), isDirectory: fs.statSync(file).isDirectory() }));
  const recentFiles = await readRecentFiles();
  const categorizedFiles = { all: allFiles, recent: recentFiles };

  categories.forEach(category => {
    categorizedFiles[category.name] = allFiles.filter(file =>
      category.extensions.some(ext => file.path.endsWith(ext))
    );
  });

  return categorizedFiles;
});

async function readRecentFiles() {
  if (!fs.existsSync(logFilePath)) return [];
  const data = fs.readFileSync(logFilePath, 'utf8');
  return data.split('\n').filter(line => line.trim() !== '');
}

ipcMain.handle('open-file', async (event, filePath) => {
  require('child_process').exec(`start "" "${filePath}"`);
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('open-location', async (event, filePath) => {
  require('child_process').exec(`explorer.exe /select,"${filePath}"`);
});

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

ipcMain.handle('save-settings', async (event, settings) => {
  fs.writeFileSync(settingsPath, JSON.stringify(settings));
});

ipcMain.handle('load-settings', async () => {
  if (!fs.existsSync(settingsPath)) return null;
  const data = fs.readFileSync(settingsPath, 'utf8');
  return JSON.parse(data);
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

