#!/usr/bin/env python3
"""
MVP-Echo Whisper Service
Simple Python sidecar for reliable speech-to-text using OpenAI Whisper
"""

import sys
import json
import traceback
import tempfile
import os
from pathlib import Path

def log(message):
    """Log to stderr so it doesn't interfere with JSON output"""
    print(f"[Python] {message}", file=sys.stderr, flush=True)

def install_whisper():
    """Install faster-whisper if not available"""
    try:
        from faster_whisper import WhisperModel
        return WhisperModel
    except ImportError:
        log("faster-whisper not found, installing...")
        import subprocess
        
        # Try to install faster-whisper
        try:
            # Redirect pip output to stderr to avoid interfering with JSON protocol
            subprocess.check_call([sys.executable, "-m", "pip", "install", "faster-whisper"], 
                                stdout=sys.stderr, stderr=sys.stderr)
            from faster_whisper import WhisperModel
            log("✅ faster-whisper installed successfully")
            return WhisperModel
        except Exception as e:
            log(f"❌ Failed to install faster-whisper: {e}")
            return None

def transcribe_audio(audio_data, model_size="tiny"):
    """Transcribe audio data using faster-whisper"""
    try:
        WhisperModel = install_whisper()
        if not WhisperModel:
            return {"error": "Failed to load faster-whisper"}
        
        log(f"Loading faster-whisper model: {model_size}")
        # Use CPU for MVP, can be changed to "cuda" for GPU acceleration
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        
        # Save audio data to temp file
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            # Write raw audio data (assuming WAV format from Electron)
            temp_file.write(bytes(audio_data))
            temp_path = temp_file.name
        
        try:
            log(f"Transcribing audio file: {temp_path}")
            segments, info = model.transcribe(temp_path)
            
            # Collect all segments into full text
            full_text = ""
            segment_count = 0
            for segment in segments:
                full_text += segment.text
                segment_count += 1
            
            full_text = full_text.strip()
            log(f"✅ Transcription successful: '{full_text[:50]}...'")
            
            return {
                "success": True,
                "text": full_text,
                "language": info.language,
                "language_probability": info.language_probability,
                "segments": segment_count,
                "model": model_size,
                "duration": info.duration
            }
            
        finally:
            # Clean up temp file
            try:
                os.unlink(temp_path)
            except:
                pass
                
    except Exception as e:
        log(f"❌ Transcription error: {e}")
        log(traceback.format_exc())
        return {"error": str(e)}

def transcribe_audio_file(audio_file_path, model_size="tiny"):
    """Transcribe audio from file path using faster-whisper"""
    try:
        WhisperModel = install_whisper()
        if not WhisperModel:
            return {"error": "Failed to load faster-whisper"}
        
        log(f"Loading faster-whisper model: {model_size}")
        # Use CPU for MVP, can be changed to "cuda" for GPU acceleration
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        
        if not os.path.exists(audio_file_path):
            return {"error": f"Audio file not found: {audio_file_path}"}
        
        # Debug: Check file size and basic info
        import wave
        try:
            with wave.open(audio_file_path, 'rb') as wav_file:
                frames = wav_file.getnframes()
                sample_rate = wav_file.getframerate()
                channels = wav_file.getnchannels()
                duration = frames / sample_rate
                log(f"WAV file info: {frames} frames, {sample_rate}Hz, {channels} channels, {duration:.2f}s")
        except Exception as wav_error:
            log(f"Warning: Could not read WAV file info: {wav_error}")
        
        log(f"Transcribing audio file: {audio_file_path}")
        segments, info = model.transcribe(audio_file_path, 
                                        beam_size=1,  # Faster but less accurate for debugging
                                        vad_filter=False,  # Disable voice activity detection
                                        word_timestamps=False)
        
        # Collect all segments into full text
        full_text = ""
        segment_count = 0
        for segment in segments:
            full_text += segment.text
            segment_count += 1
        
        full_text = full_text.strip()
        log(f"✅ Transcription successful: '{full_text[:50]}...'")
        
        return {
            "success": True,
            "text": full_text,
            "language": info.language,
            "language_probability": info.language_probability,
            "segments": segment_count,
            "model": model_size,
            "duration": info.duration
        }
        
    except Exception as e:
        log(f"❌ File transcription error: {e}")
        log(traceback.format_exc())
        return {"error": str(e)}

def main():
    """Main service loop - read JSON requests from stdin, output JSON responses"""
    log("🎤 MVP-Echo Whisper Service starting...")
    log("Python version: " + sys.version)
    
    try:
        # Test whisper availability
        whisper = install_whisper()
        if whisper:
            log("✅ Whisper available")
            # List available models
            available_models = ["tiny", "base", "small", "medium", "large"]
            log(f"Available models: {available_models}")
        else:
            log("❌ Whisper not available")
            return
            
        log("Ready for transcription requests...")
        
        # Process requests from stdin
        for line in sys.stdin:
            try:
                request = json.loads(line.strip())
                
                if request.get("action") == "transcribe":
                    audio_data = request.get("audio_data", [])
                    model_size = request.get("model", "tiny")
                    
                    log(f"Processing transcription request: {len(audio_data)} bytes, model: {model_size}")
                    
                    result = transcribe_audio(audio_data, model_size)
                    
                    # Output JSON response
                    print(json.dumps(result), flush=True)
                    
                elif request.get("action") == "transcribe_file":
                    audio_file = request.get("audio_file", "")
                    model_size = request.get("model", "tiny")
                    
                    log(f"Processing transcription from file: {audio_file}, model: {model_size}")
                    
                    result = transcribe_audio_file(audio_file, model_size)
                    
                    # Output JSON response
                    print(json.dumps(result), flush=True)
                    
                elif request.get("action") == "ping":
                    print(json.dumps({"pong": True}), flush=True)
                    
                else:
                    print(json.dumps({"error": f"Unknown action: {request.get('action')}"}), flush=True)
                    
            except json.JSONDecodeError as e:
                log(f"❌ Invalid JSON: {e}")
                print(json.dumps({"error": "Invalid JSON request"}), flush=True)
            except Exception as e:
                log(f"❌ Request processing error: {e}")
                print(json.dumps({"error": str(e)}), flush=True)
                
    except KeyboardInterrupt:
        log("Service interrupted")
    except Exception as e:
        log(f"❌ Service error: {e}")
        log(traceback.format_exc())

if __name__ == "__main__":
    main()