import React, { useState, useEffect, useRef } from 'react';

// Audio recording functionality (renderer process)
class AudioCapture {
  private mediaRecorder?: MediaRecorder;
  private audioChunks: Blob[] = [];
  private stream?: MediaStream;
  
  async startRecording(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.audioChunks = [];
    
    this.mediaRecorder.ondataavailable = (event) => {
      this.audioChunks.push(event.data);
    };
    
    this.mediaRecorder.start();
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
    this.mediaRecorder = undefined;
    this.stream = undefined;
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

  useEffect(() => {
    // Mock audio level updates during recording
    let levelInterval: NodeJS.Timeout;
    if (isRecording) {
      levelInterval = setInterval(() => {
        setAudioLevel(Math.random());
      }, 100);
    }
    
    return () => {
      if (levelInterval) clearInterval(levelInterval);
    };
  }, [isRecording]);

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

  const handleStartRecording = async () => {
    try {
      setIsRecording(true);
      setTranscription('');
      setProcessingStatus('Starting recording...');
      
      await audioCapture.current.startRecording();
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

  // Audio visualizer bars
  const bars = Array.from({ length: 20 }, (_, i) => i);

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
          <div className="flex-1 text-center">
            <span className="text-xs text-muted-foreground">Voice-to-Text Transcription</span>
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
        {/* Recording Card */}
        <div className="mvp-card p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Voice Recording</h2>
              <div className="text-sm text-muted-foreground font-mono">
                {formatDuration(duration)}
                {isRecording && <span className="ml-2 text-primary animate-pulse">●</span>}
              </div>
            </div>
            
            {/* Recording Controls */}
            <div className="flex items-center justify-center">
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={isRecording ? "mvp-button-secondary" : "mvp-button-primary"}
                style={{ minWidth: '200px' }}
              >
                <div className="flex items-center justify-center gap-3">
                  {isRecording ? (
                    <>
                      <div className="w-4 h-4 bg-current rounded-sm"></div>
                      Stop Recording
                    </>
                  ) : (
                    <>
                      <div className="w-5 h-5 rounded-full bg-current"></div>
                      Start Recording
                    </>
                  )}
                </div>
              </button>
            </div>
            
            {/* Audio Visualizer */}
            <div className="flex items-center justify-center gap-1 h-16 bg-muted/50 rounded-lg p-4">
              {bars.map((bar) => {
                const height = isRecording 
                  ? Math.max(8, audioLevel * Math.random() * 40 + Math.sin(Date.now() / 100 + bar) * 10)
                  : 8;
                
                return (
                  <div
                    key={bar}
                    className={`w-2 bg-primary transition-all duration-100 rounded-sm ${
                      isRecording ? 'recording-pulse' : ''
                    }`}
                    style={{
                      height: `${height}px`,
                      opacity: isRecording ? 0.8 : 0.3
                    }}
                  />
                );
              })}
            </div>
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
                      : "Click 'Start Recording' to begin transcription"
                    }
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                  transcription 
                    ? 'border-primary/50 hover:bg-primary/10 text-foreground hover:border-primary' 
                    : 'border-border text-muted-foreground cursor-not-allowed'
                }`}
                disabled={!transcription}
              >
                📋 Copy Text
              </button>
              <button 
                className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                  transcription 
                    ? 'border-primary/50 hover:bg-primary/10 text-foreground hover:border-primary' 
                    : 'border-border text-muted-foreground cursor-not-allowed'
                }`}
                disabled={!transcription}
              >
                💾 Export TXT
              </button>
              <button 
                className={`px-4 py-2 text-sm border rounded-lg transition-colors ${
                  transcription 
                    ? 'border-primary/50 hover:bg-primary/10 text-foreground hover:border-primary' 
                    : 'border-border text-muted-foreground cursor-not-allowed'
                }`}
                disabled={!transcription}
              >
                📝 Export MD
              </button>
            </div>
          </div>
        </div>
        </main>

        {/* Status Bar */}
        <footer className="border-t border-border bg-muted/30 p-4 mt-8">
          <div className="container max-w-4xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span className="font-medium">MVP-Echo v1.0.0</span>
              <span className="opacity-50">•</span>
              <span>Engine: <span className="text-foreground">
                {systemInfo?.gpuAvailable ? `${systemInfo.gpuMode} Mode` : 'CPU Mode'}
              </span></span>
              <span className="opacity-50">•</span>
              <span>Platform: <span className="text-foreground">
                {systemInfo?.platform === 'win32' ? 'Windows 11' : systemInfo?.platform || 'Unknown'}
              </span></span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                systemInfo?.sttInitialized ? 'bg-green-500' : 
                systemInfo?.gpuAvailable ? 'bg-yellow-500' : 'bg-blue-500'
              }`}></div>
              <span className="text-foreground font-medium">
                {systemInfo?.sttInitialized ? 'STT Ready' : 
                 systemInfo?.gpuAvailable ? 'GPU Ready' : 'Ready'}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}