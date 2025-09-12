import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'default',
    show: false,
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

// IPC Handlers for MVP
ipcMain.handle('start-recording', async () => {
  console.log('Recording started');
  return { success: true, message: 'Recording started' };
});

ipcMain.handle('stop-recording', async () => {
  console.log('Recording stopped');
  return { success: true, message: 'Recording stopped' };
});

ipcMain.handle('get-system-info', async () => {
  return {
    platform: process.platform,
    version: app.getVersion(),
    gpuMode: 'CPU', // Mock for now
  };
});

// Mock transcription results
ipcMain.handle('process-audio', async (event, audioData) => {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const mockTranscriptions = [
    "Hello, this is a test of the MVP Echo transcription system.",
    "The quick brown fox jumps over the lazy dog.",
    "MVP Echo is working great with real-time transcription.",
    "This is a demonstration of voice to text conversion.",
    "The application is running smoothly on Windows 11."
  ];
  
  const randomText = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
  return { text: randomText, confidence: 0.95 };
});

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