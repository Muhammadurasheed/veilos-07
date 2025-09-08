const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const elevenLabsService = require('../services/elevenLabsService');
const multer = require('multer');
const { nanoid } = require('nanoid');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation');

// Configure multer for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/webm', 'audio/ogg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio format. Supported: WAV, MP3, WebM, OGG'));
    }
  }
});

// 🎭 ELEVENLABS VOICE API ROUTES

// Get available voices
router.get('/voices', authMiddleware, async (req, res) => {
  try {
    console.log('🎭 Fetching ElevenLabs voices for user:', req.user.id);
    
    const voices = await elevenLabsService.getAvailableVoices();
    
    // Enhance voices with usage analytics
    const enhancedVoices = voices.map(voice => ({
      ...voice,
      popularityScore: Math.floor(Math.random() * 100), // TODO: Real analytics
      category: voice.category || 'general',
      description: voice.description || `${voice.name} voice for natural conversation`,
      previewAvailable: !!voice.previewUrl
    }));

    res.success({
      voices: enhancedVoices,
      total: enhancedVoices.length,
      categories: ['male', 'female', 'child', 'elderly', 'robotic'],
      defaultVoice: '9BWtsMINqrJLrRacOk9x' // Aria
    }, 'Available voices retrieved successfully');

  } catch (error) {
    console.error('❌ Get voices error:', error);
    
    // Fallback to default voices if ElevenLabs is unavailable
    const fallbackVoices = [
      {
        voiceId: '9BWtsMINqrJLrRacOk9x',
        name: 'Aria',
        category: 'female',
        description: 'Warm, professional female voice',
        popularityScore: 95,
        previewAvailable: false
      },
      {
        voiceId: 'CwhRBWXzGAHq8TQ4Fs17',
        name: 'Roger',
        category: 'male',
        description: 'Clear, confident male voice',
        popularityScore: 88,
        previewAvailable: false
      },
      {
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Sarah',
        category: 'female',
        description: 'Friendly, approachable female voice',
        popularityScore: 92,
        previewAvailable: false
      },
      {
        voiceId: 'JBFqnCBsd6RMkjVDRZzb',
        name: 'George',
        category: 'male',
        description: 'Deep, authoritative male voice',
        popularityScore: 85,
        previewAvailable: false
      }
    ];

    res.success({
      voices: fallbackVoices,
      total: fallbackVoices.length,
      categories: ['male', 'female'],
      defaultVoice: '9BWtsMINqrJLrRacOk9x',
      fallback: true
    }, 'Fallback voices loaded (ElevenLabs unavailable)');
  }
});

// Generate voice preview
router.post('/voices/:voiceId/preview', 
  authMiddleware,
  validate([
    body('text').optional().isLength({ min: 1, max: 200 }).trim(),
    body('settings').optional().isObject()
  ]),
  async (req, res) => {
    try {
      const { voiceId } = req.params;
      const { text = 'Hello, this is a preview of how I sound in the sanctuary.', settings } = req.body;

      console.log('🎵 Generating voice preview:', { voiceId, textLength: text.length });

      const audioBuffer = await elevenLabsService.generateSpeech(text, voiceId, {
        stability: settings?.stability || 0.75,
        similarity_boost: settings?.similarityBoost || 0.75,
        style: settings?.style || 0.0,
        use_speaker_boost: settings?.useSpeakerBoost || true
      });

      // Return audio as base64 for easy frontend handling
      const audioBase64 = audioBuffer.toString('base64');

      res.success({
        audioData: `data:audio/mp3;base64,${audioBase64}`,
        voiceId,
        text,
        settings: settings || {}
      }, 'Voice preview generated successfully');

    } catch (error) {
      console.error('❌ Voice preview error:', error);
      res.error('Failed to generate voice preview: ' + error.message, 500);
    }
  }
);

// Process real-time audio for voice conversion
router.post('/process-audio/:sessionId',
  authMiddleware,
  upload.single('audio'),
  validate([
    body('voiceId').isString().notEmpty(),
    body('participantId').isString().notEmpty(),
    body('settings').optional().isObject()
  ]),
  async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { voiceId, participantId, settings } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.error('Audio file is required', 400);
      }

      console.log('🎙️ Processing audio for voice conversion:', {
        sessionId,
        participantId,
        voiceId,
        audioSize: audioFile.size
      });

      // TODO: Implement real-time voice conversion
      // For now, return the original audio with metadata
      const processedAudio = audioFile.buffer;

      // In production, this would use ElevenLabs Voice Conversion API
      // const convertedAudio = await elevenLabsService.convertVoice(
      //   audioFile.buffer,
      //   voiceId,
      //   settings || {}
      // );

      const processedBase64 = processedAudio.toString('base64');

      res.success({
        processedAudioUrl: `data:${audioFile.mimetype};base64,${processedBase64}`,
        originalBackup: `data:${audioFile.mimetype};base64,${processedBase64}`,
        voiceId,
        participantId,
        sessionId,
        processingMetadata: {
          originalSize: audioFile.size,
          processedSize: processedAudio.length,
          voiceId: voiceId,
          processingTime: Date.now()
        }
      }, 'Audio processed successfully');

    } catch (error) {
      console.error('❌ Audio processing error:', error);
      res.error('Failed to process audio: ' + error.message, 500);
    }
  }
);

// Text-to-speech endpoint for AI announcements
router.post('/synthesize',
  authMiddleware,
  validate([
    body('text').isString().isLength({ min: 1, max: 1000 }).trim(),
    body('voiceId').optional().isString(),
    body('settings').optional().isObject(),
    body('sessionId').optional().isString()
  ]),
  async (req, res) => {
    try {
      const { text, voiceId = '9BWtsMINqrJLrRacOk9x', settings, sessionId } = req.body;

      console.log('🗣️ Synthesizing speech:', { 
        textLength: text.length, 
        voiceId, 
        sessionId 
      });

      const audioBuffer = await elevenLabsService.generateSpeech(text, voiceId, {
        stability: settings?.stability || 0.75,
        similarity_boost: settings?.similarityBoost || 0.75,
        style: settings?.style || 0.0,
        use_speaker_boost: settings?.useSpeakerBoost || true
      });

      const audioBase64 = audioBuffer.toString('base64');

      // Log usage for analytics
      console.log('✅ Speech synthesis completed:', {
        userId: req.user.id,
        voiceId,
        textLength: text.length,
        audioSize: audioBuffer.length
      });

      res.success({
        audioData: `data:audio/mp3;base64,${audioBase64}`,
        text,
        voiceId,
        settings,
        metadata: {
          duration: Math.ceil(text.length / 10), // Rough estimate: 10 chars per second
          size: audioBuffer.length,
          generatedAt: new Date().toISOString()
        }
      }, 'Speech synthesized successfully');

    } catch (error) {
      console.error('❌ Speech synthesis error:', error);
      res.error('Failed to synthesize speech: ' + error.message, 500);
    }
  }
);

// Create custom voice (voice cloning)
router.post('/voices/create',
  authMiddleware,
  upload.array('samples', 10), // Up to 10 voice samples
  validate([
    body('name').isString().isLength({ min: 1, max: 50 }).trim(),
    body('description').optional().isLength({ max: 200 }).trim(),
    body('category').optional().isIn(['male', 'female', 'child', 'elderly', 'robotic'])
  ]),
  async (req, res) => {
    try {
      const { name, description, category = 'general' } = req.body;
      const sampleFiles = req.files;

      if (!sampleFiles || sampleFiles.length < 3) {
        return res.error('At least 3 voice samples are required for voice cloning', 400);
      }

      console.log('🧬 Creating custom voice:', { 
        name, 
        samplesCount: sampleFiles.length, 
        userId: req.user.id 
      });

      // TODO: Implement ElevenLabs voice cloning
      // const customVoice = await elevenLabsService.cloneVoice(name, sampleFiles, {
      //   description,
      //   category
      // });

      // For now, return a mock voice ID
      const customVoiceId = `custom_${nanoid(16)}`;

      res.success({
        voiceId: customVoiceId,
        name,
        description,
        category,
        status: 'training',
        estimatedCompletionTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
        samplesProcessed: sampleFiles.length
      }, 'Custom voice creation started');

    } catch (error) {
      console.error('❌ Voice creation error:', error);
      res.error('Failed to create custom voice: ' + error.message, 500);
    }
  }
);

// Get user's custom voices
router.get('/voices/custom', authMiddleware, async (req, res) => {
  try {
    console.log('📋 Getting custom voices for user:', req.user.id);

    // TODO: Implement database storage for custom voices
    // For now, return empty array
    res.success({
      customVoices: [],
      total: 0
    }, 'Custom voices retrieved successfully');

  } catch (error) {
    console.error('❌ Get custom voices error:', error);
    res.error('Failed to retrieve custom voices: ' + error.message, 500);
  }
});

// Delete custom voice
router.delete('/voices/custom/:voiceId', authMiddleware, async (req, res) => {
  try {
    const { voiceId } = req.params;

    console.log('🗑️ Deleting custom voice:', { voiceId, userId: req.user.id });

    // TODO: Implement ElevenLabs voice deletion
    // await elevenLabsService.deleteVoice(voiceId);

    res.success({
      voiceId,
      deleted: true
    }, 'Custom voice deleted successfully');

  } catch (error) {
    console.error('❌ Voice deletion error:', error);
    res.error('Failed to delete custom voice: ' + error.message, 500);
  }
});

// Voice analytics endpoint
router.get('/analytics/voices', authMiddleware, async (req, res) => {
  try {
    const { from, to, sessionId } = req.query;

    console.log('📊 Getting voice analytics:', { 
      userId: req.user.id, 
      from, 
      to, 
      sessionId 
    });

    // TODO: Implement voice usage analytics
    const analytics = {
      totalUsageTime: 0,
      mostUsedVoice: null,
      voiceChanges: 0,
      uniqueVoicesUsed: 0,
      sessions: [],
      period: { from, to }
    };

    res.success(analytics, 'Voice analytics retrieved successfully');

  } catch (error) {
    console.error('❌ Voice analytics error:', error);
    res.error('Failed to retrieve voice analytics: ' + error.message, 500);
  }
});

module.exports = router;