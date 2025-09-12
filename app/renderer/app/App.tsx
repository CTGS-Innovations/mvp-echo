import React, { useState, useEffect, useRef, useCallback, useReducer } from 'react';
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
  private animationId?: number;
  private sourceNode?: MediaStreamAudioSourceNode;
  
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
    
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.sourceNode.connect(this.analyser);
    
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
        this.animationId = requestAnimationFrame(updateLevel);
      }
    };
    
    updateLevel();
  }
  
  async stopRecording(): Promise<ArrayBuffer> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        this.cleanup(); // Cleanup even if no recorder
        resolve(new ArrayBuffer(0));
        return;
      }
      
      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        const arrayBuffer = await blob.arrayBuffer();
        // Cleanup AFTER we've processed the audio
        this.cleanup();
        resolve(arrayBuffer);
      };
      
      this.mediaRecorder.stop();
    });
  }
  
  cleanup(): void {
    // Cancel any pending animation frames
    if (this.animationId !== undefined) {
      cancelAnimationFrame(this.animationId);
      this.animationId = undefined;
    }
    
    // Disconnect and clear source node first
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = undefined;
    }
    
    // Stop all tracks immediately
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('MVP-Echo: Stopped track:', track.kind, track.label);
      });
      this.stream = undefined;
    }
    
    // Close audio context and wait for it to close
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().then(() => {
        console.log('MVP-Echo: AudioContext closed');
      }).catch(err => {
        console.warn('MVP-Echo: AudioContext close failed:', err);
      });
      this.audioContext = undefined;
    }
    
    // Clear all references
    this.mediaRecorder = undefined;
    this.analyser = undefined;
    this.dataArray = undefined;
    this.onAudioLevel = undefined;
    this.audioChunks = [];
    
    console.log('MVP-Echo: AudioCapture cleanup complete');
  }
}

export default function App() {
  // Removed excessive logging to prevent console spam
  
  // Check if running in Electron
  const isElectron = typeof (window as any).electronAPI !== 'undefined';
  
  // Debug: Log when component mounts and cleanup on unmount
  useEffect(() => {
    console.log('MVP-Echo: App component mounted successfully');
    console.log('MVP-Echo: Running in Electron:', isElectron);
    
    // Also cleanup on window unload/refresh
    const handleBeforeUnload = () => {
      if (audioCapture.current) {
        audioCapture.current.cleanup();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Cleanup function to ensure microphone is stopped on unmount
    return () => {
      console.log('MVP-Echo: App component unmounting, cleaning up...');
      handleBeforeUnload();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
  

  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // Sync ref when state changes
  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);
  const [transcription, setTranscription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [privacyReminder, setPrivacyReminder] = useState(false);
  const audioCapture = useRef(new AudioCapture());
  const isRecordingRef = useRef(false);


  const handleStartRecording = useCallback(async (source = 'unknown') => {
    if (isRecording) return; // Simple state check
    
    console.log(`🎤 Starting recording from: ${source}`);
    setIsRecording(true); // Update state immediately
    setTranscription('');
    setProcessingStatus('Starting...');
    
    try {
      await audioCapture.current.startRecording(setAudioLevel);
      setProcessingStatus('Recording...');
      await (window as any).electronAPI.startRecording(source);
    } catch (error) {
      console.error('Start recording failed:', error);
      setIsRecording(false);
      setProcessingStatus('Failed to start');
    }
  }, [isRecording]);

  const handleStopRecording = useCallback(async (source = 'unknown') => {
    if (!isRecording) return; // Simple state check
    
    console.log(`🛑 Stopping recording from: ${source}`);
    setProcessingStatus('Processing...');
    
    try {
      const audioBuffer = await audioCapture.current.stopRecording();
      setIsRecording(false); // Update state immediately
      setAudioLevel(0);
      
      await (window as any).electronAPI.stopRecording(source);
      
      if (audioBuffer.byteLength > 0) {
        const audioArray = Array.from(new Uint8Array(audioBuffer));
        const result = await (window as any).electronAPI.processAudio(audioArray);
        
        setTranscription(result.text);
        setProcessingStatus(`Completed (${result.engine})`);
        
        if (result.text?.trim()) {
          try {
            await (window as any).electronAPI.copyToClipboard(result.text);
            setProcessingStatus('Completed - Copied to clipboard!');
          } catch (e) {
            console.warn('Clipboard failed:', e);
          }
        }
      } else {
        setTranscription('');
        setProcessingStatus('No audio recorded');
      }
    } catch (error) {
      console.error('Stop recording failed:', error);
      setIsRecording(false);
      setProcessingStatus('Processing failed');
    }
  }, [isRecording]);

  const handleRecordingToggle = useCallback((source = 'unknown') => {
    console.log(`🔄 Toggle from ${source}, current state: ${isRecording}`);
    if (isRecording) {
      handleStopRecording(source);
    } else {
      handleStartRecording(source);
    }
  }, [isRecording, handleStartRecording, handleStopRecording]);

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

  // Global shortcut event listener - register only once on mount
  useEffect(() => {
    if (isElectron) {
      console.log('🔧 Setting up global shortcut listener (mount only)');
      
      // Listen for global shortcut toggle event from main process
      const unsubscribe = (window as any).electronAPI.onGlobalShortcutToggle(() => {
        console.log('🌐 Global shortcut toggle event received');
        
        // Check privacy mode first
        if (privacyMode) {
          console.log('🔒 Privacy mode active - showing reminder');
          setPrivacyReminder(true);
          // Clear reminder after animation
          setTimeout(() => setPrivacyReminder(false), 2000);
          return;
        }
        
        // Use ref for synchronous state check to prevent race conditions
        const currentlyRecording = isRecordingRef.current;
        console.log(`🔄 Global shortcut toggle, current state: ${currentlyRecording}`);
        
        // Prevent duplicate execution by checking ref state
        if (currentlyRecording) {
          // Stop recording
          console.log('🛑 Stopping recording from: global-shortcut');
          isRecordingRef.current = false;
          setIsRecording(false);
          setProcessingStatus('Processing...');
          setAudioLevel(0);
          
          audioCapture.current.stopRecording().then(audioBuffer => {
            (window as any).electronAPI.stopRecording('global-shortcut');
            
            if (audioBuffer.byteLength > 0) {
              const audioArray = Array.from(new Uint8Array(audioBuffer));
              (window as any).electronAPI.processAudio(audioArray).then(result => {
                setTranscription(result.text);
                setProcessingStatus(`Completed (${result.engine})`);
                
                if (result.text?.trim()) {
                  (window as any).electronAPI.copyToClipboard(result.text).then(() => {
                    setProcessingStatus('Completed - Copied to clipboard!');
                  }).catch(e => console.warn('Clipboard failed:', e));
                }
              });
            } else {
              setTranscription('');
              setProcessingStatus('No audio recorded');
            }
          }).catch(error => {
            console.error('Stop recording failed:', error);
            setProcessingStatus('Processing failed');
          });
        } else {
          // Start recording
          console.log('🎤 Starting recording from: global-shortcut');
          isRecordingRef.current = true;
          setIsRecording(true);
          setTranscription('');
          setProcessingStatus('Starting...');
          
          audioCapture.current.startRecording(setAudioLevel).then(() => {
            setProcessingStatus('Recording...');
            (window as any).electronAPI.startRecording('global-shortcut');
          }).catch(error => {
            console.error('Start recording failed:', error);
            isRecordingRef.current = false;
            setIsRecording(false);
            setProcessingStatus('Failed to start');
          });
        }
      });
      
      // Cleanup function to remove listener
      return () => {
        console.log('🔧 Cleaning up global shortcut listener (unmount only)');
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      };
    }
  }, [isElectron]); // Only depend on isElectron, not changing functions


  // Note: Local keyboard shortcuts removed - using global shortcuts from main process instead
  // This prevents conflicts between global and local handlers



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
            <span>{systemInfo?.whisperModel || 'Model loading...'}</span>
            <span className="opacity-50">•</span>
            <div className="flex items-center gap-2">
              {privacyMode ? (
                <>
                  <div className={`w-2 h-2 rounded-full ${privacyReminder ? 'bg-orange-500 animate-pulse' : 'bg-gray-500'}`}></div>
                  <span className={`font-medium ${privacyReminder ? 'text-orange-500 animate-pulse' : 'text-gray-500'}`}>
                    🔒 Privacy Mode
                  </span>
                </>
              ) : isRecording ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                  <span className="text-red-500 font-medium">🎤 Recording</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" className="text-red-500">
                    <path fill="currentColor" d="M12 14C13.66 14 15 12.66 15 11V5C15 3.34 13.66 2 12 2S9 3.34 9 5V11C9 12.66 10.34 14 12 14Z"/>
                    <path fill="currentColor" d="M17 11C17 13.76 14.76 16 12 16S7 13.76 7 11H5C5 14.53 7.61 17.43 11 17.92V21H13V17.92C16.39 17.43 19 14.53 19 11H17Z"/>
                  </svg>
                </>
              ) : processingStatus === 'Processing...' ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                  <span className="text-yellow-600 font-medium">⏳ Releasing microphone...</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-green-600 font-medium">Ready</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" className="text-muted-foreground opacity-50">
                    <path fill="currentColor" d="M19 11H17.3C17.3 11.7 17.1 12.4 16.8 13L18.2 14.4C18.7 13.4 19 12.2 19 11ZM15 11.2V11V5C15 3.3 13.7 2 12 2S9 3.3 9 5V5.2L15 11.2ZM4.3 3L3 4.3L9 10.3V11C9 12.7 10.3 14 12 14C12.2 14 12.5 14 12.7 13.9L14.8 16C13.9 16.6 13 16.9 12 17C8.7 17 6 14.3 6 11H4C4 14.5 6.6 17.4 10 17.9V21H14V17.9C14.3 17.9 14.7 17.8 15 17.7L19.7 22.4L21 21.1L4.3 3Z"/>
                  </svg>
                </>
              )}
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
              onClick={() => handleRecordingToggle('button-click')}
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
                        ? "Press Up arrow to record (or click microphone button)"
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