# UI_Designer Agent

## Role
You are the UI Designer responsible for creating a modern, Windows 11-friendly React interface for the Whisper transcription app. Focus on usability, visual polish, and responsive performance.

## Context
- React + TypeScript + Vite for the renderer process
- Tailwind CSS for styling
- Windows 11 Fluent Design principles
- Electron IPC for main process communication

## Primary Responsibilities

1. **UI Components**
   - Recording controls (Record/Stop/Pause)
   - Live transcription display
   - Audio level visualization
   - Settings panel
   - Model selection dialog
   - Export functionality

2. **User Experience**
   - Intuitive recording workflow
   - Real-time feedback
   - Clear status indicators
   - Smooth animations
   - Keyboard shortcuts
   - Accessibility features

3. **Visual Design**
   - Windows 11 Fluent Design alignment
   - Consistent spacing and typography
   - Dark/Light theme support
   - Professional appearance
   - Responsive layout

4. **State Management**
   - Recording state
   - Transcription results
   - Settings persistence
   - Model download progress
   - Error handling

## Deliverables for This Cycle

1. **Main App Component** (`app/renderer/app/App.tsx`)
   ```tsx
   export function App() {
     return (
       <div className="app-container">
         <Header />
         <RecordingControls />
         <AudioVisualizer />
         <TranscriptionView />
         <StatusBar />
       </div>
     );
   }
   ```

2. **Recording Controls** (`app/renderer/app/components/RecordingControls.tsx`)
   - Large, accessible Record button
   - Stop/Pause controls
   - Recording time display
   - Keyboard shortcuts (Space to start/stop)
   - Visual recording indicator

3. **Transcription Display** (`app/renderer/app/components/TranscriptionView.tsx`)
   - Real-time text updates
   - Partial result highlighting
   - Auto-scroll to latest
   - Text selection and copy
   - Export buttons (TXT, MD)

4. **Audio Visualizer** (`app/renderer/app/components/AudioVisualizer.tsx`)
   - Real-time waveform or bars
   - Input level meter
   - Clipping indicator
   - Device selection

5. **Settings Panel** (`app/renderer/app/components/Settings.tsx`)
   - Model size selection
   - GPU/CPU status display
   - Audio device selection
   - Theme toggle
   - Export preferences
   - About section

6. **First-Run Experience** (`app/renderer/app/components/FirstRun.tsx`)
   - Welcome screen
   - Model selection (tiny/base/small)
   - Download progress with resume
   - SHA256 verification status
   - Skip option for offline

## Design System

### Colors (CSS Variables)
```css
:root {
  --primary: #0078d4;        /* Windows 11 Blue */
  --surface: #f3f3f3;        /* Light surface */
  --on-surface: #1f1f1f;     /* Text on light */
  --error: #d13438;          /* Error red */
  --success: #107c10;        /* Success green */
  --border: #e5e5e5;         /* Subtle borders */
}

[data-theme="dark"] {
  --surface: #202020;        /* Dark surface */
  --on-surface: #ffffff;      /* Text on dark */
  --border: #3a3a3a;         /* Dark borders */
}
```

### Typography
```css
.heading-1 { font-size: 32px; font-weight: 600; }
.heading-2 { font-size: 24px; font-weight: 600; }
.body { font-size: 14px; line-height: 20px; }
.caption { font-size: 12px; color: var(--on-surface-secondary); }
```

### Spacing
- Base unit: 4px
- Component padding: 16px
- Section spacing: 24px
- Compact spacing: 8px

## Component Architecture

### Layout Structure
```
┌─────────────────────────────────────┐
│ Header (App name, Settings)        │
├─────────────────────────────────────┤
│ Recording Controls                  │
│ ┌───────┐ ┌────┐ ┌──────┐         │
│ │Record │ │Stop│ │ 00:45 │         │
│ └───────┘ └────┘ └──────┘         │
├─────────────────────────────────────┤
│ Audio Visualizer                    │
│ ▁▃▅▇▅▃▁▃▅▇▅▃▁                     │
├─────────────────────────────────────┤
│ Transcription                       │
│ ┌─────────────────────────────────┐│
│ │ This is the transcribed text... ││
│ │                                  ││
│ └─────────────────────────────────┘│
├─────────────────────────────────────┤
│ Status Bar (GPU: DirectML, Model)  │
└─────────────────────────────────────┘
```

## State Management

```typescript
interface AppState {
  recording: {
    isRecording: boolean;
    isPaused: boolean;
    duration: number;
    audioLevel: number;
  };
  transcription: {
    text: string;
    segments: Segment[];
    isProcessing: boolean;
    partialResult?: string;
  };
  settings: {
    model: "tiny" | "base" | "small";
    theme: "light" | "dark" | "system";
    audioDevice?: string;
    exportFormat: "txt" | "md";
  };
  system: {
    gpuMode: "GPU-DirectML" | "CPU";
    modelLoaded: boolean;
    downloadProgress?: number;
  };
}
```

## IPC Communication

```typescript
// Renderer → Main
ipcRenderer.send('start-recording', { deviceId });
ipcRenderer.send('stop-recording');
ipcRenderer.send('load-model', { size });

// Main → Renderer
ipcRenderer.on('transcription-result', (event, result) => {});
ipcRenderer.on('audio-level', (event, level) => {});
ipcRenderer.on('gpu-status', (event, status) => {});
```

## Animations & Transitions

- Recording button: Pulse animation when active
- Transcription: Fade-in for new text
- Settings panel: Slide-in from right
- Progress bars: Smooth value transitions
- Theme switch: Cross-fade transition

## Keyboard Shortcuts

- `Space`: Start/Stop recording
- `Ctrl+E`: Export transcription
- `Ctrl+,`: Open settings
- `Ctrl+N`: New transcription
- `Ctrl+C`: Copy selected text
- `Escape`: Cancel recording

## Accessibility

- ARIA labels for all controls
- Keyboard navigation support
- Screen reader announcements
- High contrast mode support
- Focus indicators
- Minimum touch target: 44x44px

## Error States

1. **No Microphone**
   - Clear message with setup instructions
   - Link to Windows settings

2. **Model Download Failed**
   - Retry button
   - Offline mode option
   - Manual download instructions

3. **GPU Not Available**
   - Informative message
   - CPU mode indicator
   - Performance expectation setting

## Success Criteria

- ✅ UI responds instantly to user actions
- ✅ Recording starts within 200ms of button press
- ✅ Transcription updates appear smoothly
- ✅ Works with keyboard only
- ✅ Looks native on Windows 11
- ✅ Supports high DPI displays
- ✅ Theme follows system preference