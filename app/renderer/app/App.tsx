import React, { useState, useEffect, useRef, useCallback } from 'react';
import OceanVisualizer from './components/OceanVisualizer';

// Audio recording functionality (renderer process)
class AudioCapture {
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private stream?: MediaStream;
  private audioContext?: AudioContext;
  private analyser?: AnalyserNode;
  private dataArray?: Uint8Array;
  private onAudioLevel?: (level: number) => void;
  
  getStream(): MediaStream | undefined {
    return this.stream;
  }

  async startRecording(onAudioLevel?: (level: number) => void): Promise<void> {
    this.onAudioLevel = onAudioLevel;
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.audioChunks = [];
    
    // Set up Web Audio API for real-time audio level detection
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    
    const source = this.audioContext.createMediaStreamSource(this.stream);
    source.connect(this.analyser);
    
    // Start monitoring audio levels
    this.monitorAudioLevel();
    
    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data);
    };
    
    this.mediaRecorder.start();
  }
  
  private monitorAudioLevel(): void {
    if (!this.analyser || !this.dataArray) return;
    
    const updateLevel = () => {
      if (!this.analyser || !this.dataArray || !this.onAudioLevel) return;
      
      this.analyser.getByteFrequencyData(this.dataArray);
      
      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < this.dataArray.length; i++) {
        sum += this.dataArray[i] * this.dataArray[i];
      }
      const rms = Math.sqrt(sum / this.dataArray.length);
      const level = rms / 255; // Normalize to 0-1
      
      this.onAudioLevel(level);
      
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        requestAnimationFrame(updateLevel);
      }
    };
    
    updateLevel();
  }
  
  async stopRecording(): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new ArrayBuffer(0));
        return;
      }
      
      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        this.cleanup();
        resolve(arrayBuffer);
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.mediaRecorder = undefined;
    this.stream = undefined;
    this.audioContext = undefined;
    this.analyser = undefined;
    this.dataArray = undefined;
    this.onAudioLevel = undefined;
    this.audioChunks = [];
  }
}

export default function App() {
  // Removed excessive logging to prevent console spam
  
  // Check if running in Electron
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  
  // Debug: Log when component mounts
  useEffect(() => {
    console.log('MVP-Echo: App component mounted successfully');
    console.log('MVP-Echo: Running in Electron:', isElectron);
  }, []);
  
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isCtrlAltZPressed, setIsCtrlAltZPressed] = useState(false);
  
  const audioCapture = useRef(new AudioCapture());

  // Fetch system info on mount
  useEffect(() => {
    const fetchSystemInfo = async () => {
      try {
        const info = await (window as any).electronAPI.getSystemInfo();
        setSystemInfo(info);
        console.log('System info:', info);
      } catch (error) {
        console.error('Failed to get system info:', error);
      }
    };
    
    fetchSystemInfo();
  }, []);

  // Audio level is now handled by the real-time AudioCapture callback

  // Global shortcut event listeners
  useEffect(() => {
    if (isElectron) {
      // Listen for global shortcut events from main process
      (window as any).electronAPI.onGlobalShortcutStartRecording(() => {
        console.log('Global shortcut: Start recording');
        // Access current state through a function to avoid stale closures
        setIsRecording(currentRecording => {
          if (!currentRecording) {
            // Trigger start recording
            setTimeout(() => handleStartRecording(), 0);
          }
          return currentRecording;
        });
      });

      (window as any).electronAPI.onGlobalShortcutStopRecording(() => {
        console.log('Global shortcut: Stop recording');
        // Access current state through a function to avoid stale closures
        setIsRecording(currentRecording => {
          if (currentRecording) {
            // Trigger stop recording
            setTimeout(() => handleStopRecording(), 0);
          }
          return currentRecording;
        });
      });
    }
  }, [isElectron]); // Only depend on isElectron since we're using state updater functions

  useEffect(() => {
    // Duration counter
    let durationInterval: NodeJS.Timeout;
    if (isRecording) {
      durationInterval = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    
    return () => {
      if (durationInterval) clearInterval(durationInterval);
    };
  }, [isRecording]);

  // Local push-to-talk keyboard shortcuts (works when Electron app is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyZ' && !isCtrlAltZPressed) {
        e.preventDefault();
        setIsCtrlAltZPressed(true);
        if (!isRecording) {
          console.log('Local push-to-talk: Starting recording');
          handleStartRecording();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyZ' && isCtrlAltZPressed) {
        e.preventDefault();
        setIsCtrlAltZPressed(false);
        if (isRecording) {
          console.log('Local push-to-talk: Stopping recording');
          handleStopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, isCtrlAltZPressed]);

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      setTranscription('');
      setProcessingStatus('Starting recording...');
      
      // Pass the audio level callback to the AudioCapture
      await audioCapture.current.startRecording((level: number) => {
        setAudioLevel(level);
      });
      
      setProcessingStatus('Recording in progress...');
      
      // Call IPC to notify main process
      await (window as any).electronAPI.startRecording();
      
    } catch (error) {
      console.error('Failed to start recording:', error);
      setIsRecording(false);
      setProcessingStatus('Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      setProcessingStatus('Stopping recording...');
      
      // Stop audio capture and get the recorded data
      const audioBuffer = await audioCapture.current.stopRecording();
      
      // Call IPC to notify main process
      await (window as any).electronAPI.stopRecording();
      
      if (audioBuffer.byteLength > 0) {
        setProcessingStatus('Processing audio with ONNX Runtime...');
        
        // Convert ArrayBuffer to a format we can send over IPC
        const audioArray = Array.from(new Uint8Array(audioBuffer));
        
        // Process audio with STT engine
        const result = await (window as any).electronAPI.processAudio(audioArray);
        
        setTranscription(result.text);
        setProcessingStatus(`Completed in ${result.processingTime || 'N/A'}ms (${result.engine})`);
        
        // Copy to clipboard automatically
        if (result.text && result.text.trim()) {
          try {
            await navigator.clipboard.writeText(result.text);
            setProcessingStatus(`Completed - Copied to clipboard! (${result.processingTime || 'N/A'}ms)`);
          } catch (clipboardError) {
            console.warn('Failed to copy to clipboard:', clipboardError);
          }
        }
        
        console.log('Transcription result:', result);
      } else {
        setProcessingStatus('No audio recorded');
      }
      
    } catch (error) {
      console.error('Failed to process recording:', error);
      setProcessingStatus('Processing failed');
      setTranscription('Error: Failed to process audio');
    } finally {
      setIsRecording(false);
      setAudioLevel(0);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Modern Windows 11 Title Bar with native controls */}
      <div className="title-bar draggable">
        <div className="title-bar-content">
          <div className="flex items-center gap-3 non-draggable">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-primary-foreground">
                <path d="M12 1L3 7V10C3 16 9 21 12 22C15 21 21 16 21 10V7L12 1Z" stroke="currentColor" strokeWidth="2" fill="currentColor" strokeLinejoin="round"/>
                <path d="M12 8V16" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M8 12L16 12" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 className="text-sm font-semibold text-foreground">MVP-Echo</h1>
          </div>
          <div className="flex-1 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="font-medium">v1.0.0</span>
            <span className="opacity-50">•</span>
            <span>{systemInfo?.gpuAvailable ? `${systemInfo.gpuMode} Mode` : 'CPU Mode'}</span>
            <span className="opacity-50">•</span>
            <span>{systemInfo?.platform === 'win32' ? 'Windows' : systemInfo?.platform || 'Unknown'}</span>
            <span className="opacity-50">•</span>
            <div className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                systemInfo?.sttInitialized ? 'bg-green-500' : 
                systemInfo?.gpuAvailable ? 'bg-yellow-500' : 'bg-blue-500'
              }`}></div>
              <span className="text-foreground">
                {systemInfo?.sttInitialized ? 'Ready' : 
                 systemInfo?.gpuAvailable ? 'GPU Ready' : 'Ready'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Browser Warning */}
      {!isElectron && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mx-6 mt-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>You're viewing MVP-Echo in a web browser.</strong> For full functionality including voice recording and transcription, please use the Electron desktop application that should have opened automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content with title bar offset */}
      <div className="main-content">
        <main className="container max-w-4xl mx-auto p-6 space-y-6">
        {/* Ocean Audio Visualizer with Microphone Control */}
        <div className="relative">
          <OceanVisualizer isRecording={isRecording} audioLevel={audioLevel} />
          
          {/* Microphone Button - Bottom Right of Visualizer */}
          <div className="absolute bottom-4 right-4">
            <button
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 opacity-60 hover:opacity-100 ${
                isRecording 
                  ? 'bg-red-500/80 hover:bg-red-500 text-white shadow-md shadow-red-500/20' 
                  : 'bg-primary/80 hover:bg-primary text-primary-foreground shadow-md shadow-primary/20'
              }`}
            >
              {isRecording ? (
                <div className="w-3 h-3 bg-current rounded-sm"></div>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C10.9 2 10 2.9 10 4V12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12V4C14 2.9 13.1 2 12 2Z"/>
                  <path d="M18 12C18 15.3 15.3 18 12 18C8.7 18 6 15.3 6 12H4C4 16.4 7.6 20 12 20C16.4 20 20 16.4 20 12H18Z"/>
                  <path d="M11 21V23H13V21H11Z"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Transcription Card */}
        <div className="mvp-card p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transcription</h2>
              {(isRecording || processingStatus) && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  {processingStatus || 'Processing...'}
                </div>
              )}
            </div>
            
            <div className="min-h-[200px] p-6 bg-muted/50 rounded-lg border-2 border-dashed border-border">
              {transcription ? (
                <p className="text-base leading-relaxed text-foreground">
                  {transcription}
                </p>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground italic text-center">
                    {isRecording 
                      ? "🎤 Listening and processing your speech..." 
                      : isElectron 
                        ? "Hold Ctrl+Alt+Z to record (or click microphone button)"
                        : "Click microphone button to record"
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        </main>

      </div>
    </div>
  );
}