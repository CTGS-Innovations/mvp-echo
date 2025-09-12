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
   - MVP Scale aesthetic with electric blue accents (from styleGuide)
   - Windows 11 Fluent Design alignment
   - Consistent spacing and typography (Inter font)
   - Dark/Light theme support (follows system preference)
   - **CRITICAL**: Extremely responsive for frequent minimization
   - **Beautiful at any size**: Maintains visual appeal when minimized
   - **Minimal but modern**: Clean design that works in small windows

4. **State Management**
   - Recording state
   - Transcription results
   - Settings persistence
   - Model download progress
   - Error handling

## Deliverables for This Cycle

1. **Main App Component** (`app/renderer/app/App.tsx`)
   ```tsx
   import { Card } from '@/components/ui/card';
   import { ThemeProvider } from '@/components/theme-provider';
   
   export function App() {
     return (
       <ThemeProvider defaultTheme="system" storageKey="whisperwin-theme">
         <div className="min-h-screen bg-background text-foreground">
           <Header />
           <main className="container max-w-4xl mx-auto p-6 space-y-6">
             <Card className="mvp-card">
               <RecordingControls />
               <AudioVisualizer />
             </Card>
             <Card className="mvp-card">
               <TranscriptionView />
             </Card>
           </main>
           <StatusBar />
         </div>
       </ThemeProvider>
     );
   }
   ```

2. **Recording Controls** (`app/renderer/app/components/RecordingControls.tsx`)
   ```tsx
   import { Button } from '@/components/ui/button';
   import { CardHeader, CardContent } from '@/components/ui/card';
   import { Mic, Square } from 'lucide-react';
   
   export function RecordingControls({ isRecording, onRecord, onStop, duration }) {
     return (
       <>
         <CardHeader>
           <div className="flex items-center justify-between">
             <h2 className="text-xl font-semibold">Voice Recording</h2>
             <span className="text-sm text-muted-foreground">
               {formatDuration(duration)}
               {isRecording && <span className="ml-1 animate-pulse">●</span>}
             </span>
           </div>
         </CardHeader>
         <CardContent>
           <div className="flex items-center gap-4">
             <Button
               onClick={isRecording ? onStop : onRecord}
               className={isRecording ? "mvp-button-secondary" : "mvp-button-primary"}
               size="lg"
             >
               {isRecording ? <Square className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
               {isRecording ? 'Stop Recording' : 'Start Recording'}
             </Button>
           </div>
         </CardContent>
       </>
     );
   }
   ```

3. **Transcription Display** (`app/renderer/app/components/TranscriptionView.tsx`)
   ```tsx
   import { Button } from '@/components/ui/button';
   import { CardHeader, CardContent, CardFooter } from '@/components/ui/card';
   import { Download, Copy } from 'lucide-react';
   import { Skeleton } from '@/components/ui/skeleton';
   
   export function TranscriptionView({ text, isProcessing, partialText }) {
     return (
       <>
         <CardHeader>
           <h2 className="text-xl font-semibold">Transcription</h2>
         </CardHeader>
         <CardContent>
           <div className="min-h-[200px] p-4 bg-muted/50 rounded-lg">
             {isProcessing && !text ? (
               <div className="space-y-2">
                 <Skeleton className="h-4 w-full" />
                 <Skeleton className="h-4 w-3/4" />
                 <Skeleton className="h-4 w-1/2" />
               </div>
             ) : (
               <p className="text-sm leading-relaxed whitespace-pre-wrap">
                 {text}
                 {partialText && (
                   <span className="text-muted-foreground italic">
                     {partialText}
                   </span>
                 )}
               </p>
             )}
           </div>
         </CardContent>
         <CardFooter>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" disabled={!text}>
               <Copy className="w-4 h-4" />
               Copy
             </Button>
             <Button variant="outline" size="sm" disabled={!text}>
               <Download className="w-4 h-4" />
               Export TXT
             </Button>
             <Button variant="outline" size="sm" disabled={!text}>
               <Download className="w-4 h-4" />
               Export MD
             </Button>
           </div>
         </CardFooter>
       </>
     );
   }
   ```

4. **Audio Visualizer** (`app/renderer/app/components/AudioVisualizer.tsx`)
   ```tsx
   export function AudioVisualizer({ audioLevel, isRecording }) {
     // Simple bar visualization using the recording pulse
     const bars = Array.from({ length: 20 }, (_, i) => i);
     
     return (
       <div className="flex items-center justify-center gap-1 h-16">
         {bars.map((bar) => (
           <div
             key={bar}
             className={`w-2 bg-primary transition-all duration-100 ${
               isRecording ? 'recording-pulse' : ''
             }`}
             style={{
               height: `${Math.max(4, audioLevel * Math.random() * 40)}px`,
               opacity: isRecording ? 0.8 : 0.3
             }}
           />
         ))}
       </div>
     );
   }
   ```

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

## Design System (From StyleGuide)

### IMPORTANT: Use Existing StyleGuide
The project has an established design system in `/styleGuide/` that MUST be referenced for all UI decisions. This design system features:
- **MVP Scale aesthetic**: Modern, clean, with bright electric blue accents
- **Existing components**: Full shadcn/ui component library already implemented
- **Custom animations**: Recording pulse effects and smooth transitions
- **Responsive design**: Optimized for minimization and various screen sizes

### Color Palette (MVP Scale Design)
```css
/* Light Theme - Clean whites and grays */
:root {
  --background: oklch(1 0 0);           /* Pure white */
  --foreground: oklch(0.145 0 0);       /* Dark text */
  --primary: oklch(0.55 0.25 264);      /* Electric blue (#4285F4 approx) */
  --primary-foreground: oklch(1 0 0);   /* White on primary */
  --secondary: oklch(0.95 0 0);         /* Light gray */
  --muted: oklch(0.95 0 0);             /* Muted backgrounds */
  --destructive: oklch(0.577 0.245 27.325); /* Error red */
  --border: oklch(0.9 0 0);             /* Subtle borders */
  --ring: oklch(0.55 0.25 264);         /* Focus ring */
  --radius: 0.75rem;                     /* Rounded corners */
}

/* Dark Theme - Navy background with bright blue */
.dark {
  --background: oklch(0.08 0.02 264);   /* Very dark navy */
  --foreground: oklch(0.98 0 0);        /* Almost white text */
  --primary: oklch(0.65 0.25 264);      /* Brighter electric blue */
  --card: oklch(0.12 0.02 264);         /* Slightly lighter navy */
  --secondary: oklch(0.18 0.02 264);    /* Secondary navy */
  --border: oklch(0.18 0.02 264);       /* Subtle borders */
}
```

### Typography (Inter Font)
```css
/* Font stack with Inter as primary */
--font-sans: var(--font-inter), ui-sans-serif, system-ui, sans-serif;

/* Heading styles */
h1 { @apply text-3xl font-bold tracking-tight; }
h2 { @apply text-2xl font-semibold tracking-tight; }

/* Body text */
.body { font-size: 14px; line-height: 20px; }
.caption { font-size: 12px; }
```

### MVP Scale Custom Styles
```css
/* Recording pulse animation */
.recording-pulse {
  animation: recording-pulse 1.5s ease-in-out infinite;
}

/* MVP Card with hover effects */
.mvp-card {
  @apply bg-card border border-border rounded-xl transition-all duration-200;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
.mvp-card:hover {
  @apply border-primary;
  box-shadow: 0 4px 20px rgba(66, 133, 244, 0.15);
  transform: translateY(-1px);
}

/* Primary button with shadow */
.mvp-button-primary {
  @apply bg-primary text-primary-foreground font-semibold rounded-xl px-6 py-3;
  box-shadow: 0 2px 8px rgba(66, 133, 244, 0.3);
}

/* Secondary button (gray) */
.mvp-button-secondary {
  @apply bg-slate-600 text-white font-semibold rounded-xl px-6 py-3;
}
```

### Component Library (shadcn/ui)
Use existing components from `/styleGuide/components/ui/`:
- `Button` - With variants: default, destructive, outline, secondary, ghost
- `Card` - With CardHeader, CardTitle, CardDescription, CardContent
- `Dialog` - For modals and overlays
- `Sheet` - For slide-in panels (Settings)
- `Tabs` - For organized content
- `Progress` - For download/processing indicators
- `Skeleton` - For loading states
- `Toast` - For notifications
- All components support dark mode automatically

### Spacing & Layout
- Base unit: 4px (Tailwind spacing)
- Rounded corners: `rounded-xl` (12px)
- Card padding: `p-6` (24px)
- Component gaps: `gap-6` (24px)
- Compact spacing: `gap-2` (8px)

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

## StyleGuide Integration Requirements

### MANDATORY: Reference StyleGuide for All UI Decisions
- **Never modify styleGuide files** - they are read-only reference
- **Use existing components** from `/styleGuide/components/ui/`
- **Follow MVP Scale color palette** exactly as defined in globals.css
- **Use recording-pulse animation** for recording states
- **Apply mvp-card and mvp-button classes** for consistency
- **Leverage existing dark mode support** (automatic via CSS variables)

### Import Pattern
```tsx
// Always import from styleGuide path aliases
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
```

### Responsive Design for Minimization
- Use `container max-w-4xl` for main content
- Ensure UI scales gracefully from 400px to 1200px width
- Priority: Recording controls visible even when minimized
- Cards stack vertically on narrow screens
- Maintain electric blue accent visibility at all sizes

## Success Criteria

- ✅ UI responds instantly to user actions
- ✅ Recording starts within 200ms of button press
- ✅ Transcription updates appear smoothly
- ✅ **Looks beautiful when minimized** (key requirement)
- ✅ **Matches MVP Scale aesthetic exactly** from styleGuide
- ✅ Uses existing shadcn/ui components from styleGuide
- ✅ Works with keyboard only
- ✅ Supports high DPI displays
- ✅ Theme follows system preference (light/dark)
- ✅ **Electric blue primary color** visible throughout