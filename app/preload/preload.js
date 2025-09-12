const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Future STT functions
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  onTranscriptionResult: (callback) => ipcRenderer.on('transcription-result', callback),
  
  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // File operations
  exportText: (content, filename) => ipcRenderer.invoke('export-text', content, filename),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
});