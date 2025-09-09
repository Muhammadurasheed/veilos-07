const axios = require('axios');

class ElevenLabsService {
  constructor() {
    this.apiKey = process.env.ELEVENLABS_API_KEY;
    this.baseUrl = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1';
    this.defaultVoiceId = process.env.ELEVENLABS_DEFAULT_VOICE_ID;
    this.model = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';
  }

  // Available voices for modulation
  getAvailableVoices() {
    return [
      { id: '9BWtsMINqrJLrRacOk9x', name: 'Aria', gender: 'female', description: 'Warm and friendly' },
      { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'male', description: 'Professional and clear' },
      { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', description: 'Energetic and youthful' },
      { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female', description: 'Calm and soothing' },
      { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male', description: 'Deep and authoritative' },
      { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', description: 'Mature and wise' },
      { id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'male', description: 'Young and dynamic' },
      { id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'neutral', description: 'Mysterious and unique' },
      { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male', description: 'Friendly and approachable' },
      { id: 'XB0fDUnXU5powFXDhCwa', name: 'Charlotte', gender: 'female', description: 'Elegant and refined' }
    ];
  }

  // Get headers for API requests
  getHeaders() {
    return {
      'xi-api-key': this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  // Validate API key
  async validateApiKey() {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: this.getHeaders()
      });
      
      console.log('✅ ElevenLabs API key validated successfully');
      return { valid: true, user: response.data };
    } catch (error) {
      console.error('❌ ElevenLabs API key validation failed:', error.message);
      return { valid: false, error: error.message };
    }
  }

  // Get voice details
  async getVoiceDetails(voiceId) {
    try {
      const response = await axios.get(`${this.baseUrl}/voices/${voiceId}`, {
        headers: this.getHeaders()
      });
      
      return { success: true, voice: response.data };
    } catch (error) {
      console.error(`❌ Failed to get voice details for ${voiceId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Text-to-Speech conversion (for voice preview)
  async textToSpeech(text, voiceId = null, options = {}) {
    try {
      const targetVoiceId = voiceId || this.defaultVoiceId;
      const voice_settings = {
        stability: options.stability || 0.5,
        similarity_boost: options.similarityBoost || 0.8,
        style: options.style || 0.0,
        use_speaker_boost: options.useSpeakerBoost || true
      };

      const response = await axios.post(
        `${this.baseUrl}/text-to-speech/${targetVoiceId}/stream`,
        {
          text,
          model_id: options.model || this.model,
          voice_settings
        },
        {
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      console.log(`🎤 Text-to-speech generated for voice ${targetVoiceId}`);
      return { success: true, audioBuffer: response.data };
    } catch (error) {
      console.error('❌ Text-to-speech conversion failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Speech-to-Speech conversion (for real-time voice modulation)
  async speechToSpeech(audioBuffer, targetVoiceId, options = {}) {
    try {
      const formData = new FormData();
      formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }));
      formData.append('model_id', options.model || 'eleven_english_sts_v2');
      
      const voice_settings = {
        stability: options.stability || 0.5,
        similarity_boost: options.similarityBoost || 0.8,
        style: options.style || 0.0
      };
      formData.append('voice_settings', JSON.stringify(voice_settings));

      const response = await axios.post(
        `${this.baseUrl}/speech-to-speech/${targetVoiceId}/stream`,
        formData,
        {
          headers: {
            'xi-api-key': this.apiKey,
            'Content-Type': 'multipart/form-data'
          },
          responseType: 'arraybuffer'
        }
      );

      console.log(`🎤 Speech-to-speech conversion completed for voice ${targetVoiceId}`);
      return { success: true, audioBuffer: response.data };
    } catch (error) {
      console.error('❌ Speech-to-speech conversion failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get user subscription info
  async getSubscriptionInfo() {
    try {
      const response = await axios.get(`${this.baseUrl}/user/subscription`, {
        headers: this.getHeaders()
      });
      
      return { success: true, subscription: response.data };
    } catch (error) {
      console.error('❌ Failed to get subscription info:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get character usage
  async getUsage() {
    try {
      const response = await axios.get(`${this.baseUrl}/user`, {
        headers: this.getHeaders()
      });
      
      const { subscription } = response.data;
      return { 
        success: true, 
        usage: {
          charactersUsed: subscription.character_count,
          charactersLimit: subscription.character_limit,
          resetDate: subscription.next_character_count_reset_unix
        }
      };
    } catch (error) {
      console.error('❌ Failed to get usage info:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Create voice clone (advanced feature)
  async createVoiceClone(name, description, audioFiles) {
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      
      audioFiles.forEach((file, index) => {
        formData.append(`files[${index}]`, file);
      });

      const response = await axios.post(`${this.baseUrl}/voices/add`, formData, {
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log(`✅ Voice clone created: ${name}`);
      return { success: true, voice: response.data };
    } catch (error) {
      console.error('❌ Voice clone creation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Delete voice clone
  async deleteVoice(voiceId) {
    try {
      await axios.delete(`${this.baseUrl}/voices/${voiceId}`, {
        headers: this.getHeaders()
      });

      console.log(`🗑️ Voice deleted: ${voiceId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Voice deletion failed for ${voiceId}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  // Generate voice preview for participant selection
  async generateVoicePreview(voiceId, previewText = "Welcome to the anonymous sanctuary. Your voice is now masked for privacy.") {
    try {
      const result = await this.textToSpeech(previewText, voiceId, {
        stability: 0.7,
        similarityBoost: 0.8,
        style: 0.2
      });

      if (result.success) {
        // Convert buffer to base64 for easy transmission
        const base64Audio = Buffer.from(result.audioBuffer).toString('base64');
        return { success: true, audioPreview: base64Audio };
      }

      return result;
    } catch (error) {
      console.error('❌ Voice preview generation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get optimal voice settings for real-time streaming
  getOptimalStreamingSettings() {
    return {
      model: 'eleven_turbo_v2_5', // Fastest model for real-time
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.7,
        style: 0.1,
        use_speaker_boost: true
      },
      output_format: 'mp3_44100_128' // Balanced quality/speed
    };
  }

  // Error handling with fallback
  async processWithFallback(operation, fallbackHandler = null) {
    try {
      return await operation();
    } catch (error) {
      console.error('❌ ElevenLabs operation failed:', error.message);
      
      if (fallbackHandler) {
        console.log('🔄 Executing fallback handler...');
        return await fallbackHandler();
      }
      
      return { success: false, error: error.message, fallback: true };
    }
  }
}

// Create singleton instance
const elevenLabsService = new ElevenLabsService();

// Validate API key on initialization
if (process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_API_KEY.startsWith('sk_')) {
  elevenLabsService.validateApiKey().then(result => {
    if (result.valid) {
      console.log('✅ ElevenLabs service initialized successfully');
    } else {
      console.warn('⚠️ ElevenLabs API key validation failed, voice modulation will be disabled');
    }
  }).catch(error => {
    console.warn('⚠️ ElevenLabs initialization error:', error.message);
  });
} else {
  console.warn('⚠️ ElevenLabs API key not found or invalid format, voice modulation will be disabled');
}

module.exports = elevenLabsService;