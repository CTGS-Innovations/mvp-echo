const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, '../preload/preload.js'),
    },
    // Modern Windows 11 styling
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',        // Clean white background matching MVP Scale
      symbolColor: '#6b7280',  // Gray window controls 
      height: 40
    },
    title: 'MVP-Echo',
    backgroundMaterial: 'mica',
    roundedCorners: true,
    // Window transparency effects
    show: false,
    // Additional modern window options
    autoHideMenuBar: true,
    // Enable modern window frame
    frame: true,
    thickFrame: true,
  });

  // Load the React app
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    app.quit();
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});