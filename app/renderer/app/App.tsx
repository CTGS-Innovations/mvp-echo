import React, { useState, useEffect } from 'react';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);

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
    setIsRecording(true);
    setTranscription('');
    
    // Mock transcription after 2 seconds
    setTimeout(() => {
      const mockTexts = [
        "Hello, this is a test of the MVP Echo transcription system.",
        "The quick brown fox jumps over the lazy dog.",
        "MVP Echo is working great with real-time transcription.",
        "This is a demonstration of voice to text conversion.",
        "The application is running smoothly on Windows 11."
      ];
      const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
      setTranscription(randomText);
    }, 2000);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    setAudioLevel(0);
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
      {/* Header */}
      <header className="border-b border-border p-6 bg-background">
        <div className="container max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-3xl font-bold text-primary">MVP-Echo</h1>
          <div className="text-sm text-muted-foreground">
            Voice-to-Text Transcription
          </div>
        </div>
      </header>

      {/* Main Content */}
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
              {isRecording && !transcription && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                  Processing...
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
            <span>Engine: <span className="text-foreground">CPU Mode</span></span>
            <span className="opacity-50">•</span>
            <span>Platform: <span className="text-foreground">Windows 11</span></span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-foreground font-medium">Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}