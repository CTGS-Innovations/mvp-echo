# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MVP-Echo is a Windows 11 desktop application for voice-to-text transcription using Whisper models. Built with Electron + React (TypeScript) + ONNX Runtime via DirectML for GPU acceleration.

## Tech Stack

- **Desktop Framework**: Electron
- **Frontend**: React + TypeScript + Vite
- **AI Runtime**: ONNX Runtime with DirectML (GPU) and CPU providers
- **Audio Processing**: MediaRecorder API, WAV/PCM format
- **Styling**: Tailwind CSS (recommended)
- **Packaging**: electron-builder with NSIS installer
- **Target Platform**: Windows 11 (primary)

## Development Commands

```bash
# Development
npm install          # Install dependencies
npm run dev          # Start Electron in development mode
npm run build        # Build production app
npm run pack         # Package into installer

# Code Quality
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript type checking
npm test            # Run tests
```

## Project Structure

```
app/
  main/                  # Electron main process
    main.ts             # Entry point
    ipc.ts              # IPC handlers
    updater.ts          # Auto-updater logic
  renderer/             # React UI
    main.tsx            # React entry point
    app/
      App.tsx           # Main app component
      components/       # UI components
      hooks/            # Custom React hooks
  audio/
    recorder.ts         # Audio capture helpers
    wav.ts              # WAV/PCM utilities
  stt/
    session.ts          # ONNX Runtime session management
    features.ts         # Audio preprocessing
    pipeline.ts         # Transcription pipeline
    health.ts           # GPU/CPU detection
  models/
    manifest.json       # Model metadata and checksums
scripts/
  build.ps1             # Windows build script
  pack.ps1              # Packaging script
tests/
  stt.test.ts
  health.test.ts
```

## Key Implementation Guidelines

### GPU Support
- Primary: DirectML execution provider for GPU acceleration
- Fallback: CPU execution provider
- Auto-detect GPU availability and display status in Settings
- Test with NVIDIA, AMD, and Intel GPUs

### Model Management
- Store models in `%LOCALAPPDATA%/<AppName>/models`
- Download on first run with SHA256 verification
- Support tiny, base, and small Whisper models
- Implement resume capability for interrupted downloads
- Use quantized INT8 models when quality is acceptable

### Audio Pipeline
- Use MediaRecorder API in renderer process
- Convert to WAV/PCM format for processing
- Stream audio chunks to main process via IPC
- Implement real-time transcription with partial results

### IPC Communication
- Keep inference in main process or worker thread
- Stream transcription results back to renderer
- Implement proper error handling and recovery
- Avoid blocking UI during processing

### UI Requirements
- Modern Windows 11-friendly design
- Core features: Record, Stop, Live transcript display
- Settings panel with GPU/CPU status
- Export functionality (TXT, MD formats)
- First-run model selection dialog with progress
- Audio level meter for visual feedback

### Packaging & Distribution
- Single installer exe under 120MB (excluding models)
- Optional portable exe version
- Code signing instructions for trusted installation
- Auto-updater using electron-updater (optional)

## Development Workflow

1. Review `/setup.md` for detailed architecture and multi-agent approach
2. Implement core STT engine with GPU detection first
3. Build minimal UI with recording functionality
4. Add model download and management
5. Package and test on fresh Windows 11 installation
6. Iterate based on performance and user feedback

## Testing Requirements

- Unit tests for STT engine and GPU detection
- Integration tests for audio pipeline
- Manual testing on Windows 11 with various GPU configurations
- Smoke test checklist for installer on fresh VM
- Performance benchmarks for different model sizes

## Important Notes

- No telemetry without explicit user opt-in
- Minimal logging, no sensitive data in logs
- Keep scope tight - no features not explicitly requested
- Maintain clean, readable, modular code
- Document Windows 11 build steps clearly
- Follow Windows 11 design guidelines for native feel