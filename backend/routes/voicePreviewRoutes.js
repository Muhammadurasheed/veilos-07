const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const elevenLabsService = require('../services/elevenLabsService');
const LiveSanctuarySession = require('../models/LiveSanctuarySession');

// Generate voice preview for participant selection
router.post('/:sessionId/voice-preview', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { voiceId, text } = req.body;

    // Validate session exists and user has access
    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Check if user is participant
    const participant = session.participants.find(p => p.id === req.user.id);
    if (!participant) {
      return res.error('Not a participant in this session', 403);
    }

    if (!voiceId) {
      return res.error('Voice ID is required', 400);
    }

    console.log('🎤 Generating voice preview:', { sessionId, voiceId, userId: req.user.id });

    // Generate voice preview
    const previewText = text || "Hello, this is how your voice will sound in the sanctuary.";
    const result = await elevenLabsService.generateVoicePreview(voiceId, previewText);

    if (result.success) {
      res.success({
        voiceId,
        audioPreview: result.audioPreview,
        previewText
      }, 'Voice preview generated successfully');
    } else {
      res.error('Failed to generate voice preview: ' + result.error, 500);
    }

  } catch (error) {
    console.error('❌ Voice preview error:', error);
    res.error('Failed to generate voice preview: ' + error.message, 500);
  }
});

module.exports = router;