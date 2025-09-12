const { contextBridge, ipcRenderer } = require('electron');

console.log('MVP-Echo: Preload script loaded successfully');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // STT functions
  startRecording: () => ipcRenderer.invoke('start-recording'),
  stopRecording: () => ipcRenderer.invoke('stop-recording'),
  processAudio: (audioArray) => ipcRenderer.invoke('processAudio', audioArray),
  onTranscriptionResult: (callback) => ipcRenderer.on('transcription-result', callback),
  
  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // File operations
  exportText: (content, filename) => ipcRenderer.invoke('export-text', content, filename),
  copyToClipboard: (text) => ipcRenderer.invoke('copy-to-clipboard', text),
  
  // Global shortcut event listeners
  onGlobalShortcutToggle: (callback) => {
    // Remove any existing listeners to prevent accumulation
    ipcRenderer.removeAllListeners('global-shortcut-toggle');
    return ipcRenderer.on('global-shortcut-toggle', callback);
  },
});