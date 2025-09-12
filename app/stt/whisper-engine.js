// MVP-Echo Whisper Engine using Python Sidecar
// Uses reliable Python OpenAI Whisper libraries via subprocess communication
console.log('📦 MVP Whisper Engine - Python Sidecar Integration');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

/**
 * WhisperEngine - Production STT implementation using Python Whisper
 */
class WhisperEngine {
  constructor() {
    this.pythonProcess = null;
    this.isInitialized = false;
    this.modelSize = 'tiny';
    this.executionMode = 'python';
    this.requestQueue = [];
    this.isProcessing = false;
  }

  /**
   * Initialize the engine with a model
   */
  async initialize(modelSize = 'tiny') {
    try {
      console.log(`🎯 Initializing Python Whisper engine with ${modelSize} model...`);
      
      this.modelSize = modelSize;
      
      // Start Python Whisper service
      await this.startPythonService();
      
      // Test the service
      const testResult = await this.sendRequest({ action: 'ping' });
      if (!testResult.pong) {
        throw new Error('Python service ping test failed');
      }
      
      this.isInitialized = true;
      console.log(`✅ Python Whisper engine initialized successfully`);
      console.log(`🐍 Model: faster-whisper ${modelSize}`);
      console.log(`⚡ Device: CPU (int8 quantization)`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Python Whisper engine:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Start the Python Whisper service subprocess
   */
  async startPythonService() {
    if (this.pythonProcess) {
      return; // Already running
    }

    const pythonScript = path.join(__dirname, '../../python/whisper_service.py');
    
    console.log(`🐍 Starting Python Whisper service: ${pythonScript}`);
    
    // Try different Python commands
    const pythonCommands = ['python', 'python3', 'py'];
    let pythonCmd = null;
    
    for (const cmd of pythonCommands) {
      try {
        // Test if command exists
        await new Promise((resolve, reject) => {
          const testProcess = spawn(cmd, ['--version'], { stdio: 'ignore' });
          testProcess.on('close', (code) => {
            if (code === 0) resolve();
            else reject();
          });
          testProcess.on('error', reject);
        });
        pythonCmd = cmd;
        break;
      } catch (e) {
        continue;
      }
    }

    if (!pythonCmd) {
      throw new Error('Python not found. Please install Python 3.7+');
    }

    console.log(`🐍 Using Python command: ${pythonCmd}`);

    this.pythonProcess = spawn(pythonCmd, [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.dirname(pythonScript)
    });

    // Handle process events
    this.pythonProcess.on('error', (error) => {
      console.error('❌ Python process error:', error);
      this.pythonProcess = null;
    });

    this.pythonProcess.on('close', (code) => {
      console.log(`🐍 Python process closed with code ${code}`);
      this.pythonProcess = null;
    });

    // Log Python stderr (our logs)
    this.pythonProcess.stderr.on('data', (data) => {
      console.log(data.toString().trim());
    });

    // Give the process a moment to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (!this.pythonProcess) {
      throw new Error('Failed to start Python Whisper service');
    }
  }

  /**
   * Send a request to the Python service
   */
  async sendRequest(request) {
    if (!this.pythonProcess) {
      throw new Error('Python service not running');
    }

    return new Promise((resolve, reject) => {
      const requestJson = JSON.stringify(request) + '\n';
      
      // Set up response handler
      const onData = (data) => {
        try {
          const response = JSON.parse(data.toString().trim());
          this.pythonProcess.stdout.removeListener('data', onData);
          resolve(response);
        } catch (error) {
          this.pythonProcess.stdout.removeListener('data', onData);
          reject(new Error(`Invalid JSON response: ${data.toString()}`));
        }
      };

      this.pythonProcess.stdout.once('data', onData);
      
      // Send request
      this.pythonProcess.stdin.write(requestJson);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        this.pythonProcess.stdout.removeListener('data', onData);
        reject(new Error('Python service timeout'));
      }, 30000);
    });
  }

  /**
   * Get available execution providers with DirectML for GPU
   */
  async getExecutionProviders() {
    try {
      // Try different ways to get available providers based on ONNX Runtime version
      let availableProviders = [];
      
      try {
        // Try newer API first
        if (ort.env && ort.env.availableProviders) {
          availableProviders = ort.env.availableProviders;
        } else if (ort.InferenceSession && ort.InferenceSession.getAvailableProviders) {
          availableProviders = ort.InferenceSession.getAvailableProviders();
        } else {
          // Fallback: assume common providers are available
          availableProviders = ['CPUExecutionProvider'];
          if (process.platform === 'win32') {
            availableProviders.unshift('DmlExecutionProvider'); // Try DirectML first on Windows
          }
        }
      } catch (err) {
        console.log('⚠️ Could not detect providers automatically, using defaults');
        availableProviders = ['CPUExecutionProvider'];
        if (process.platform === 'win32') {
          availableProviders.unshift('DmlExecutionProvider');
        }
      }
      
      console.log('🔍 ONNX Runtime available providers:', availableProviders);
      
      const providers = [];
      
      // Prefer DirectML on Windows for GPU acceleration
      if (availableProviders.includes('DmlExecutionProvider')) {
        providers.push('DmlExecutionProvider');
        console.log('✅ DirectML provider configured - GPU acceleration enabled');
      }
      
      // Try CUDA if available (NVIDIA)
      if (availableProviders.includes('CUDAExecutionProvider')) {
        providers.push('CUDAExecutionProvider');
        console.log('✅ CUDA provider configured - NVIDIA GPU acceleration enabled');
      }
      
      // Always add CPU as fallback
      providers.push('CPUExecutionProvider');
      console.log('✅ CPU provider configured - CPU fallback available');
      
      return providers;
    } catch (error) {
      console.error('❌ Error detecting execution providers:', error);
      console.log('🔄 Falling back to CPU provider only');
      return ['CPUExecutionProvider'];
    }
  }

  /**
   * Ensure model exists, download from HuggingFace if needed
   */
  async ensureModelExists(modelSize) {
    const modelsDir = this.getModelsDirectory();
    const modelPath = path.join(modelsDir, `whisper-${modelSize}.onnx`);
    
    if (fs.existsSync(modelPath)) {
      console.log(`📁 Using existing model: ${modelPath}`);
      return modelPath;
    }
    
    // Download real Whisper ONNX model from HuggingFace
    console.log(`📥 Downloading Whisper ${modelSize} ONNX model from HuggingFace...`);
    
    try {
      return await this.downloadWhisperModel(modelSize, modelPath);
    } catch (error) {
      console.error(`❌ Failed to download Whisper model: ${error.message}`);
      console.log(`🔄 Falling back to mock model for MVP demo`);
      return await this.createMockModel(modelPath);
    }
  }

  /**
   * Get models directory in user's local app data
   */
  getModelsDirectory() {
    const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    const modelsDir = path.join(localAppData, 'MVP-Echo', 'models');
    
    if (!fs.existsSync(modelsDir)) {
      fs.mkdirSync(modelsDir, { recursive: true });
    }
    
    return modelsDir;
  }

  /**
   * Download real Whisper ONNX model from HuggingFace
   */
  async downloadWhisperModel(modelSize, modelPath) {
    const https = require('https');
    const { createWriteStream } = require('fs');
    
    // HuggingFace ONNX Community model URLs - using decoder models for transcription
    const modelUrls = {
      'tiny': 'https://huggingface.co/onnx-community/whisper-tiny.en/resolve/main/onnx/decoder_model.onnx',
      'base': 'https://huggingface.co/onnx-community/whisper-base.en/resolve/main/onnx/decoder_model.onnx', 
      'small': 'https://huggingface.co/onnx-community/whisper-small.en/resolve/main/onnx/decoder_model.onnx'
    };
    
    const modelUrl = modelUrls[modelSize];
    if (!modelUrl) {
      throw new Error(`Unsupported model size: ${modelSize}. Supported: ${Object.keys(modelUrls).join(', ')}`);
    }
    
    console.log(`🌐 Downloading from: ${modelUrl}`);
    
    return new Promise((resolve, reject) => {
      const file = createWriteStream(modelPath);
      const request = https.get(modelUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }
        
        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          if (totalSize > 0) {
            const progress = ((downloadedSize / totalSize) * 100).toFixed(1);
            process.stdout.write(`\r📦 Downloaded ${progress}% (${(downloadedSize / 1024 / 1024).toFixed(1)} MB)`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`\n✅ Successfully downloaded Whisper ${modelSize} model to ${modelPath}`);
          
          // Verify file was created and has reasonable size
          const stats = fs.statSync(modelPath);
          if (stats.size < 1024 * 1024) { // Less than 1MB seems suspicious
            reject(new Error(`Downloaded file seems too small: ${stats.size} bytes`));
          } else {
            console.log(`📊 Model file size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
            resolve(modelPath);
          }
        });
        
        file.on('error', (err) => {
          fs.unlinkSync(modelPath); // Delete partial file
          reject(err);
        });
      });
      
      request.on('error', (err) => {
        reject(err);
      });
      
      request.setTimeout(300000, () => { // 5 minute timeout
        request.destroy();
        reject(new Error('Download timeout (5 minutes)'));
      });
    });
  }

  /**
   * Create a mock ONNX model for demonstration
   * In production, this would be replaced with actual model download
   */
  async createMockModel(modelPath) {
    try {
      // For the MVP demo, we'll simulate the Whisper workflow without a real model
      // This creates a placeholder file that indicates the model "exists"
      const mockModelData = JSON.stringify({
        model_type: 'whisper_mock',
        version: '1.0.0',
        description: 'Mock Whisper model for MVP-Echo demo',
        created: new Date().toISOString()
      });
      
      fs.writeFileSync(modelPath + '.meta', mockModelData);
      
      console.log(`📝 Mock model metadata created: ${modelPath}.meta`);
      
      // Return a flag that indicates we're using mock mode
      return 'MOCK_MODEL';
    } catch (error) {
      console.error('❌ Failed to create mock model:', error);
      throw error;
    }
  }

  /**
   * Process audio and return transcription
   */
  async transcribe(audioData) {
    if (!this.isInitialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    try {
      const startTime = Date.now();
      
      // Calculate audio characteristics for debugging
      const audioEnergy = this.calculateAudioEnergy(audioData);
      const maxAmplitude = Math.max(...Array.from(audioData).map(Math.abs));
      
      console.log(`🎤 Processing audio: ${audioData.length} samples`);
      console.log(`🔊 Audio energy: ${audioEnergy.toFixed(4)}, Max amplitude: ${maxAmplitude.toFixed(4)}`);

      // Send audio to Python Whisper service
      const request = {
        action: 'transcribe',
        audio_data: Array.from(audioData), // Convert to plain array for JSON
        model: this.modelSize
      };
      
      console.log(`🐍 Sending audio to Python Whisper service...`);
      const result = await this.sendRequest(request);
      
      const processingTime = Date.now() - startTime;
      
      if (result.error) {
        throw new Error(`Python Whisper error: ${result.error}`);
      }
      
      console.log(`✅ Transcription completed in ${processingTime}ms`);
      console.log(`📝 Result: "${result.text}"`);
      
      return {
        success: true,
        text: result.text,
        confidence: result.language_probability || 0.95,
        processingTime,
        engine: `faster-whisper (${this.executionMode})`,
        modelPath: `${result.model} (Python)`,
        language: result.language,
        segments: result.segments,
        duration: result.duration,
        audioStats: {
          energy: parseFloat(audioEnergy.toFixed(4)),
          maxAmplitude: parseFloat(maxAmplitude.toFixed(4)),
          samples: audioData.length
        }
      };
      
    } catch (error) {
      console.error('❌ Transcription failed:', error);
      throw error;
    }
  }

  /**
   * Preprocess audio data for Whisper
   */
  preprocessAudio(audioData) {
    try {
      // Convert to Float32Array if needed
      let floatArray;
      
      if (audioData instanceof Float32Array) {
        floatArray = audioData;
      } else if (Array.isArray(audioData)) {
        floatArray = new Float32Array(audioData);
      } else {
        // Assume it's some kind of buffer/array-like
        floatArray = new Float32Array(audioData);
      }
      
      // Normalize audio to [-1, 1] range
      const maxVal = Math.max(...Array.from(floatArray).map(Math.abs));
      if (maxVal > 0) {
        for (let i = 0; i < floatArray.length; i++) {
          floatArray[i] /= maxVal;
        }
      }
      
      // Whisper expects 16kHz, 30-second chunks (480,000 samples)
      // For simplicity, we'll pad or trim to a reasonable size
      const targetLength = Math.min(480000, Math.max(16000, floatArray.length));
      const processed = new Float32Array(targetLength);
      
      if (floatArray.length >= targetLength) {
        processed.set(floatArray.subarray(0, targetLength));
      } else {
        processed.set(floatArray);
        // Rest stays zero-padded
      }
      
      console.log(`🔧 Preprocessed audio: ${processed.length} samples, range [${Math.min(...processed).toFixed(3)}, ${Math.max(...processed).toFixed(3)}]`);
      
      return processed;
    } catch (error) {
      console.error('❌ Audio preprocessing failed:', error);
      throw error;
    }
  }

  /**
   * Run inference (mock implementation for MVP)
   */
  async runInference(audioData) {
    // In production with real ONNX model:
    // const inputTensor = new ort.Tensor('float32', audioData, [1, audioData.length]);
    // const feeds = { 'audio_features': inputTensor };
    // const results = await this.session.run(feeds);
    // return this.decodeTokens(results);
    
    // For MVP demo, simulate realistic inference with intelligent mock responses
    await new Promise(resolve => {
      // Simulate realistic processing time based on audio length and mode
      const baseTime = this.executionMode === 'gpu' ? 500 : 1500;
      const processingTime = baseTime + (audioData.length / 1000) * (this.executionMode === 'gpu' ? 0.5 : 2);
      setTimeout(resolve, Math.min(processingTime, 3000));
    });

    // Generate contextually appropriate transcriptions
    const transcriptions = [
      "Hello, this is a test of the MVP Echo speech-to-text system.",
      "The quick brown fox jumps over the lazy dog.",
      "MVP Echo is now using ONNX Runtime with DirectML for GPU acceleration.",
      "This transcription demonstrates the real-time speech recognition capabilities.",
      "The system is working correctly with Windows 11 integration.",
      "Voice to text conversion is operating smoothly with high accuracy.",
      "The application successfully processes audio using advanced AI models.",
      "Real-time transcription is now active and ready for production use."
    ];
    
    // Add some intelligence based on audio characteristics
    let selectedText;
    const audioEnergy = this.calculateAudioEnergy(audioData);
    
    if (audioEnergy < 0.01) {
      selectedText = ""; // Low energy = silence
    } else if (audioEnergy < 0.05) {
      selectedText = transcriptions[Math.floor(Math.random() * 3)]; // Quieter speech
    } else {
      selectedText = transcriptions[Math.floor(Math.random() * transcriptions.length)];
    }
    
    const confidence = Math.min(0.95, 0.75 + audioEnergy * 10); // Higher energy = higher confidence
    
    return {
      text: selectedText,
      confidence: parseFloat(confidence.toFixed(2))
    };
  }

  /**
   * Calculate simple audio energy for mock intelligence
   */
  calculateAudioEnergy(audioData) {
    const sum = audioData.reduce((acc, sample) => acc + sample * sample, 0);
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      mode: this.executionMode,
      modelPath: this.modelPath === 'MOCK_MODEL' ? 'Mock Model' : this.modelPath,
      sessionActive: this.session !== null
    };
  }

  /**
   * Get engine status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      mode: this.executionMode,
      modelPath: `faster-whisper ${this.modelSize}`,
      sessionActive: this.pythonProcess !== null,
      pythonPid: this.pythonProcess?.pid || null
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      if (this.pythonProcess) {
        console.log('🧹 Terminating Python Whisper service...');
        this.pythonProcess.kill('SIGTERM');
        
        // Wait for graceful shutdown
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 3000);
          this.pythonProcess.on('close', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
        
        // Force kill if still running
        if (this.pythonProcess && !this.pythonProcess.killed) {
          this.pythonProcess.kill('SIGKILL');
        }
        
        this.pythonProcess = null;
      }
      
      this.isInitialized = false;
      console.log('🧹 Python Whisper engine cleaned up');
    } catch (error) {
      console.error('❌ Error during cleanup:', error);
    }
  }
}

// Export singleton instance
const whisperEngine = new WhisperEngine();

module.exports = {
  WhisperEngine,
  whisperEngine
};