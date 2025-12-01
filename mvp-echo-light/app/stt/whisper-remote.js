/**
 * Whisper Remote Engine - Cloud-based STT
 * Sends audio to remote endpoint for transcription
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const fetch = require('node-fetch');

class WhisperRemoteEngine {
  constructor() {
    this.endpointUrl = null;
    this.apiKey = null;
    this.selectedModel = 'Systran/faster-whisper-base';
    this.language = null;
    this.isConfigured = false;
    this.configPath = path.join(app.getPath('userData'), 'endpoint-config.json');

    // Load saved configuration
    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        this.endpointUrl = config.endpointUrl || null;
        this.apiKey = config.apiKey || null;
        this.selectedModel = config.selectedModel || 'Systran/faster-whisper-base';
        this.language = config.language || null;
        this.isConfigured = !!this.endpointUrl;
        console.log('MVP-Echo Light: Loaded endpoint config:', this.endpointUrl);
      }
    } catch (error) {
      console.error('Failed to load endpoint config:', error);
    }
  }

  saveConfig() {
    try {
      const config = {
        endpointUrl: this.endpointUrl,
        apiKey: this.apiKey,
        selectedModel: this.selectedModel,
        language: this.language
      };
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log('MVP-Echo Light: Saved endpoint config');
    } catch (error) {
      console.error('Failed to save endpoint config:', error);
    }
  }

  async configure(endpointUrl, apiKey = null, model = null) {
    this.endpointUrl = endpointUrl;
    this.apiKey = apiKey;
    if (model) this.selectedModel = model;

    // Test connection
    const health = await this.testConnection();
    if (health.success) {
      this.isConfigured = true;
      this.saveConfig();
    }

    return health;
  }

  async testConnection() {
    if (!this.endpointUrl) {
      return { success: false, error: 'No endpoint configured' };
    }

    try {
      const baseUrl = this.endpointUrl.replace('/v1/audio/transcriptions', '');
      const healthUrl = `${baseUrl}/health`;

      const response = await fetch(healthUrl);

      if (response.ok) {
        // Try to get models list
        try {
          const modelsResponse = await fetch(`${baseUrl}/v1/models`);
          const modelsData = await modelsResponse.json();
          const availableModels = modelsData.data?.map(m => m.id) || [];

          return {
            success: true,
            device: 'cloud',
            models: availableModels,
            modelCount: availableModels.length
          };
        } catch (e) {
          return {
            success: true,
            device: 'cloud'
          };
        }
      } else {
        return { success: false, error: 'Health check failed' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async transcribe(audioFilePath, options = {}) {
    if (!this.isConfigured) {
      throw new Error('Cloud endpoint not configured. Please configure in Settings.');
    }

    const startTime = Date.now();

    try {
      // Read audio file
      const audioBuffer = fs.readFileSync(audioFilePath);

      // Create form data
      const FormData = require('form-data');
      const formData = new FormData();

      formData.append('file', audioBuffer, {
        filename: 'recording.webm',
        contentType: 'audio/webm'
      });

      // Use selected model or option override
      const model = options.model || this.selectedModel;
      formData.append('model', model);

      // Request verbose_json to get language detection
      formData.append('response_format', 'verbose_json');

      // Add language if specified (forces language instead of auto-detect)
      if (options.language || this.language) {
        formData.append('language', options.language || this.language);
      }

      // Make request
      const headers = formData.getHeaders();
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: headers,
        body: formData
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      // Log the full response to see what fields the server returns
      console.log('Cloud transcription response:', JSON.stringify(result, null, 2));

      // Support various language field names from different server implementations
      let detectedLanguage = result.language
        || result.detected_language
        || result.lang
        || result.detected_lang
        || (result.segments && result.segments[0]?.language)
        || 'en';

      // Convert full language names to ISO codes (OpenAI returns "english", "spanish", etc.)
      const languageMap = {
        'english': 'en',
        'spanish': 'es',
        'french': 'fr',
        'german': 'de',
        'chinese': 'zh',
        'japanese': 'ja',
        'italian': 'it',
        'portuguese': 'pt',
        'russian': 'ru',
        'korean': 'ko',
        'dutch': 'nl',
        'polish': 'pl',
        'arabic': 'ar',
        'hindi': 'hi',
        'turkish': 'tr',
        'vietnamese': 'vi',
        'thai': 'th',
        'indonesian': 'id',
        'swedish': 'sv',
        'danish': 'da',
        'norwegian': 'no',
        'finnish': 'fi'
      };

      // Normalize to lowercase and map to ISO code if needed
      const langLower = detectedLanguage.toLowerCase();
      if (languageMap[langLower]) {
        detectedLanguage = languageMap[langLower];
      }

      return {
        text: result.text || result.transcription || '',
        language: detectedLanguage,
        duration: result.duration || 0,
        processingTime: processingTime,
        engine: `cloud (${model.split('/').pop()})`,
        model: model
      };

    } catch (error) {
      console.error('Cloud transcription failed:', error);
      throw new Error(`Cloud transcription failed: ${error.message}`);
    }
  }

  getConfig() {
    return {
      endpointUrl: this.endpointUrl,
      selectedModel: this.selectedModel,
      language: this.language,
      isConfigured: this.isConfigured
    };
  }

  setModel(model) {
    this.selectedModel = model;
    this.saveConfig();
  }

  setLanguage(language) {
    this.language = language;
    this.saveConfig();
  }
}

module.exports = WhisperRemoteEngine;
