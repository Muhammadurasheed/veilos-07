const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const LiveSanctuarySession = require('../models/LiveSanctuarySession');
const ScheduledSession = require('../models/ScheduledSession');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');
const { generateRtcToken } = require('../utils/agoraTokenGenerator');
const redisService = require('../services/redisService');
const elevenLabsService = require('../services/elevenLabsService');
const aiModerationService = require('../services/aiModerationService');

// 🎯 FLAGSHIP ROUTES - Anonymous Live Audio Sanctuary

// Helper function to convert scheduled session to live
async function convertScheduledToLive(sessionId, userId, res = null, internalCall = false) {
  try {
    console.log('🔄 Converting scheduled session to live:', sessionId);
    
    const scheduledSession = await ScheduledSession.findOne({ id: sessionId });
    
    if (!scheduledSession) {
      const error = 'Scheduled session not found';
      if (internalCall) throw new Error(error);
      return res?.status(404).json({ success: false, message: error });
    }
    
    // Check if already converted
    if (scheduledSession.liveSessionId) {
      const result = {
        liveSessionId: scheduledSession.liveSessionId,
        redirectTo: `/flagship-sanctuary/${scheduledSession.liveSessionId}`
      };
      if (internalCall) return result;
      return res?.status(200).json({ success: true, message: 'Already converted', data: result });
    }

    const now = new Date();
    const sessionDuration = scheduledSession.duration * 60; // convert to seconds
    
    // Generate Agora tokens
    const channelName = scheduledSession.agoraChannelName;
    let agoraToken, hostToken;
    
    try {
      agoraToken = generateRtcToken(channelName, 0, 'subscriber', sessionDuration);
      hostToken = generateRtcToken(channelName, userId, 'publisher', sessionDuration);
    } catch (agoraError) {
      console.warn('⚠️ Agora token generation failed:', agoraError.message);
      agoraToken = `temp_token_${nanoid(16)}`;
      hostToken = `temp_host_token_${nanoid(16)}`;
    }

    // Create live session
    const liveSession = new LiveSanctuarySession({
      id: `flagship-${nanoid(8)}`,
      topic: scheduledSession.topic,
      description: scheduledSession.description,
      emoji: scheduledSession.emoji,
      hostId: scheduledSession.hostId,
      hostAlias: scheduledSession.hostAlias,
      hostToken,
      agoraChannelName: channelName,
      agoraToken,
      maxParticipants: scheduledSession.maxParticipants,
      allowAnonymous: scheduledSession.allowAnonymous,
      moderationEnabled: scheduledSession.moderationEnabled,
      emergencyContactEnabled: true,
      recordingEnabled: scheduledSession.recordingEnabled,
      expiresAt: new Date(now.getTime() + (sessionDuration * 1000)),
      participants: [],
      status: 'active',
      isActive: true,
      startTime: now
    });

    await liveSession.save();

    // Update scheduled session
    await scheduledSession.startLiveSession(liveSession.id);

    // Update Redis cache
    await redisService.setSessionState(liveSession.id, {
      type: 'live',
      topic: liveSession.topic,
      hostId: liveSession.hostId,
      participants: liveSession.participants,
      status: 'active',
      agoraChannelName: liveSession.agoraChannelName,
      agoraToken: liveSession.agoraToken,
      expiresAt: liveSession.expiresAt,
      maxParticipants: liveSession.maxParticipants,
      allowAnonymous: liveSession.allowAnonymous,
      moderationEnabled: liveSession.moderationEnabled
    }, sessionDuration);

    console.log('✅ Scheduled session converted to live:', liveSession.id);

    const result = {
      liveSessionId: liveSession.id,
      redirectTo: `/flagship-sanctuary/${liveSession.id}`,
      session: liveSession
    };
    
    if (internalCall) return result;
    
    if (res) {
      return res.status(200).json({
        success: true,
        message: 'Session converted successfully',
        data: result
      });
    }
    
    return result;
    
  } catch (error) {
    console.error('❌ Session conversion error:', error);
    if (internalCall) throw error;
    if (res) {
      return res.status(500).json({
        success: false,
        message: 'Conversion failed: ' + error.message
      });
    }
    throw error;
  }
}

// ================== INSTANT SESSION CREATION ==================

// Create instant live session (immediate start)
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const {
      topic,
      description,
      emoji = '🎙️',
      duration = 60, // minutes
      maxParticipants = 50,
      allowAnonymous = true,
      moderationEnabled = true,
      recordingEnabled = false,
      voiceModulationEnabled = true,
      aiModerationEnabled = true,
      accessType = 'public',
      tags = [],
      category = 'support'
    } = req.body;

    console.log('🎯 Creating instant flagship session:', { 
      topic, 
      duration,
      hostId: req.user.id 
    });

    // Validate required fields
    if (!topic || topic.trim().length < 5) {
      return res.error('Topic must be at least 5 characters', 400);
    }

    // Generate unique identifiers
    const sessionId = `flagship-${nanoid(8)}`;
    const channelName = `flagship_${sessionId}`;
    
    // Generate Agora tokens
    const sessionDurationSeconds = duration * 60;
    let agoraToken, hostToken;
    
    try {
      agoraToken = generateRtcToken(channelName, 0, 'subscriber', sessionDurationSeconds);
      hostToken = generateRtcToken(channelName, req.user.id, 'publisher', sessionDurationSeconds);
    } catch (agoraError) {
      console.warn('⚠️ Agora token generation failed:', agoraError.message);
      agoraToken = `temp_token_${nanoid(16)}`;
      hostToken = `temp_host_token_${nanoid(16)}`;
    }

    // Create live session
    const liveSession = new LiveSanctuarySession({
      id: sessionId,
      topic: topic.trim(),
      description: description?.trim(),
      emoji: emoji || '🎙️',
      hostId: req.user.id,
      hostAlias: req.user.alias || `Host_${nanoid(4)}`,
      hostToken,
      agoraChannelName: channelName,
      agoraToken,
      maxParticipants,
      allowAnonymous,
      moderationEnabled,
      emergencyContactEnabled: true,
      isRecorded: recordingEnabled,
      expiresAt: new Date(Date.now() + (sessionDurationSeconds * 1000)),
      participants: [{
        id: req.user.id,
        alias: req.user.alias || `Host_${nanoid(4)}`,
        isHost: true,
        isModerator: true,
        joinedAt: new Date(),
        avatarIndex: req.user.avatarIndex || 1
      }],
      status: 'active',
      isActive: true,
      startTime: new Date(),
      tags,
      estimatedDuration: duration,
      language: 'en'
    });

    await liveSession.save();

    // Cache session data in Redis
    await redisService.setSessionState(sessionId, {
      type: 'flagship-live',
      topic: liveSession.topic,
      hostId: liveSession.hostId,
      participants: liveSession.participants,
      status: 'active',
      voiceModulationEnabled,
      aiModerationEnabled
    }, sessionDurationSeconds);

    // Save session to user's history for My Sanctuaries tracking
    const userSessionKey = `user-sanctuaries-${req.user.id}`;
    const userSessions = await redisService.getSessionState(userSessionKey) || [];
    userSessions.push({
      sessionId: liveSession.id,
      topic: liveSession.topic,
      emoji: liveSession.emoji,
      mode: 'live-audio',
      createdAt: new Date().toISOString(),
      isHost: true,
      type: 'instant'
    });
    await redisService.setSessionState(userSessionKey, userSessions);
    console.log('💾 Instant session saved to user history:', req.user.id);

    console.log('✅ Instant flagship session created:', {
      sessionId,
      channelName,
      duration
    });

    res.success({
      session: {
        id: liveSession.id,
        topic: liveSession.topic,
        description: liveSession.description,
        emoji: liveSession.emoji,
        hostAlias: liveSession.hostAlias,
        hostToken: liveSession.hostToken,
        agoraChannelName: liveSession.agoraChannelName,
        agoraToken: liveSession.agoraToken,
        maxParticipants: liveSession.maxParticipants,
        currentParticipants: liveSession.currentParticipants,
        participants: liveSession.participants,
        status: liveSession.status,
        startTime: liveSession.startTime,
        expiresAt: liveSession.expiresAt,
        voiceModulationEnabled,
        aiModerationEnabled,
        type: 'flagship-audio'
      }
    }, 'Flagship session created successfully');

  } catch (error) {
    console.error('❌ Flagship session creation error:', error);
    res.error('Failed to create flagship session: ' + error.message, 500);
  }
});

// ================== VOICE MODULATION ==================

// Get available ElevenLabs voices
router.get('/voices', async (req, res) => {
  try {
    console.log('🎭 Getting available voices');
    
    const voices = await elevenLabsService.getAvailableVoices();
    
    res.success(voices, 'Available voices retrieved successfully');
    
  } catch (error) {
    console.error('❌ Get voices error:', error);
    res.error('Failed to retrieve voices: ' + error.message, 500);
  }
});

// Get session by ID
router.get('/:sessionId', optionalAuthMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log('🔍 Getting flagship session:', sessionId);

    // Try to get from live sessions first
    let session = await LiveSanctuarySession.findOne({ id: sessionId });
    
    if (!session) {
      // Try scheduled sessions
      const scheduledSession = await ScheduledSession.findOne({ 
        $or: [
          { id: sessionId },
          { liveSessionId: sessionId }
        ]
      });
      
      if (scheduledSession) {
        if (scheduledSession.liveSessionId) {
          session = await LiveSanctuarySession.findOne({ id: scheduledSession.liveSessionId });
        }
        
        if (!session) {
          // Return scheduled session data with full session structure
          console.log('📋 Returning scheduled session data for:', sessionId);
          return res.success({
            session: {
              id: scheduledSession.id,
              topic: scheduledSession.topic,
              description: scheduledSession.description,
              emoji: scheduledSession.emoji,
              hostId: scheduledSession.hostId,
              hostAlias: scheduledSession.hostAlias,
              hostToken: null, // No token until live
              agoraChannelName: scheduledSession.agoraChannelName,
              agoraToken: null, // Generated when going live
              maxParticipants: scheduledSession.maxParticipants,
              currentParticipants: scheduledSession.preRegisteredParticipants.length,
              participantCount: scheduledSession.preRegisteredParticipants.length,
              participants: scheduledSession.preRegisteredParticipants.map(p => ({
                id: p.id,
                alias: p.alias,
                avatarIndex: 1,
                joinedAt: p.registeredAt,
                isHost: p.id === scheduledSession.hostId,
                isMuted: false,
                isModerator: false,
                isBanned: false,
                audioLevel: 0,
                connectionStatus: 'disconnected',
                handRaised: false,
                speakingTime: 0,
                reactions: []
              })),
              allowAnonymous: scheduledSession.allowAnonymous,
              moderationEnabled: scheduledSession.moderationEnabled,
              emergencyContactEnabled: scheduledSession.emergencyContactEnabled,
              isRecorded: scheduledSession.recordingEnabled,
              recordingEnabled: scheduledSession.recordingEnabled,
              status: scheduledSession.status,
              isActive: false,
              startTime: null,
              actualStartTime: scheduledSession.actualStartTime,
              endedAt: scheduledSession.actualEndTime,
              expiresAt: scheduledSession.estimatedEndTime,
              scheduledAt: scheduledSession.scheduledDateTime,
              scheduledDateTime: scheduledSession.scheduledDateTime,
              estimatedDuration: scheduledSession.duration,
              duration: scheduledSession.duration,
              tags: scheduledSession.tags || [],
              language: scheduledSession.language || 'en',
              audioOnly: scheduledSession.audioOnly,
              moderationLevel: 'standard',
              emergencyProtocols: [],
              aiMonitoring: scheduledSession.moderationEnabled,
              moderationEnabled: scheduledSession.moderationEnabled,
              accessType: scheduledSession.accessType,
              invitationCode: scheduledSession.invitationCode,
              category: scheduledSession.category,
              createdAt: scheduledSession.createdAt,
              updatedAt: scheduledSession.updatedAt
            }
          }, 'Scheduled session retrieved');
        }
      }
    }

    if (!session) {
      return res.error('Session not found', 404);
    }

    // Check if user has access to this session
    if (!session.allowAnonymous && !req.user) {
      return res.error('Authentication required', 401);
    }

    console.log('✅ Session retrieved:', {
      sessionId: session.id,
      participantCount: session.participants.length,
      status: session.status
    });

    res.success({
      session: {
        id: session.id,
        topic: session.topic,
        description: session.description,
        emoji: session.emoji,
        hostId: session.hostId,
        hostAlias: session.hostAlias,
        hostToken: session.hostToken,
        agoraChannelName: session.agoraChannelName,
        agoraToken: session.agoraToken,
        maxParticipants: session.maxParticipants,
        currentParticipants: session.currentParticipants,
        participants: session.participants,
        allowAnonymous: session.allowAnonymous,
        moderationEnabled: session.moderationEnabled,
        emergencyContactEnabled: session.emergencyContactEnabled,
        isRecorded: session.isRecorded,
        status: session.status,
        isActive: session.isActive,
        startTime: session.startTime,
        endedAt: session.endedAt,
        expiresAt: session.expiresAt,
        scheduledAt: session.scheduledAt,
        estimatedDuration: session.estimatedDuration,
        tags: session.tags,
        language: session.language,
        audioOnly: session.audioOnly,
        moderationLevel: session.moderationLevel,
        emergencyProtocols: session.emergencyProtocols,
        aiMonitoring: session.aiMonitoring
      }
    }, 'Session retrieved successfully');

  } catch (error) {
    console.error('❌ Get session error:', error);
    res.error('Failed to retrieve session: ' + error.message, 500);
  }
});

// ================== SCHEDULING SYSTEM ==================

// Create scheduled session
router.post('/schedule', authMiddleware, async (req, res) => {
  try {
    const {
      topic,
      description,
      emoji,
      scheduledDateTime,
      duration = 60, // minutes
      maxParticipants = 50,
      allowAnonymous = true,
      moderationEnabled = true,
      recordingEnabled = false,
      accessType = 'public',
      tags = [],
      category = 'support'
    } = req.body;

    console.log('📅 Creating scheduled session:', { 
      topic, 
      scheduledDateTime,
      hostId: req.user.id 
    });

    // Validate required fields
    if (!topic || !scheduledDateTime) {
      return res.error('Topic and scheduled date/time are required', 400);
    }

    // Validate scheduled time (must be in future)
    const scheduledDate = new Date(scheduledDateTime);
    if (scheduledDate <= new Date()) {
      return res.error('Scheduled time must be in the future', 400);
    }

    // Generate unique identifiers
    const sessionId = `scheduled-${nanoid(8)}`;
    const invitationCode = nanoid(6).toUpperCase();
    const channelName = `sanctuary_${sessionId}`;

    // Create scheduled session
    const scheduledSession = new ScheduledSession({
      id: sessionId,
      topic: topic.trim(),
      description: description?.trim(),
      emoji: emoji || '🎙️',
      hostId: req.user.id,
      hostAlias: req.user.alias || `Host_${nanoid(4)}`,
      scheduledDateTime: scheduledDate,
      duration,
      maxParticipants,
      allowAnonymous,
      moderationEnabled,
      recordingEnabled,
      accessType,
      invitationCode,
      agoraChannelName: channelName,
      tags,
      category,
      status: 'scheduled'
    });

    await scheduledSession.save();

    // Cache session data in Redis for quick access
    await redisService.setSessionState(sessionId, {
      type: 'scheduled',
      topic,
      scheduledDateTime: scheduledDate.toISOString(),
      hostId: req.user.id,
      invitationCode,
      status: 'scheduled'
    }, 7 * 24 * 3600); // Cache for 7 days

    // Save session to user's history for My Sanctuaries tracking
    const userSessionKey = `user-sanctuaries-${req.user.id}`;
    const userSessions = await redisService.getSessionState(userSessionKey) || [];
    userSessions.push({
      sessionId: scheduledSession.id,
      topic: scheduledSession.topic,
      emoji: scheduledSession.emoji,
      mode: 'live-audio',
      createdAt: new Date().toISOString(),
      isHost: true,
      type: 'scheduled'
    });
    await redisService.setSessionState(userSessionKey, userSessions);
    console.log('💾 Scheduled session saved to user history:', req.user.id);

    console.log('✅ Scheduled session created:', {
      sessionId,
      invitationCode,
      scheduledDateTime: scheduledDate
    });

    res.success({
      session: {
        id: scheduledSession.id,
        topic: scheduledSession.topic,
        description: scheduledSession.description,
        emoji: scheduledSession.emoji,
        hostAlias: scheduledSession.hostAlias,
        scheduledDateTime: scheduledSession.scheduledDateTime,
        duration: scheduledSession.duration,
        invitationCode: scheduledSession.invitationCode,
        invitationLink: scheduledSession.invitationLink,
        maxParticipants: scheduledSession.maxParticipants,
        status: scheduledSession.status,
        accessType: scheduledSession.accessType
      }
    }, 'Scheduled session created successfully');

  } catch (error) {
    console.error('❌ Scheduled session creation error:', error);
    res.error('Failed to create scheduled session: ' + error.message, 500);
  }
});

// Get scheduled session by invitation code
router.get('/invitation/:code', optionalAuthMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    
    console.log('🎫 Looking up invitation:', code);
    
    const session = await ScheduledSession.findByInvitationCode(code);
    
    if (!session) {
      return res.error('Invalid invitation code', 404);
    }

    // Check if session is still valid
    const now = new Date();
    const sessionStart = new Date(session.scheduledDateTime);
    const sessionEnd = new Date(sessionStart.getTime() + (session.duration * 60 * 1000));

    let sessionStatus = 'scheduled';
    let timeInfo = {};

    if (now < sessionStart) {
      sessionStatus = 'scheduled';
      timeInfo = {
        timeUntilStart: Math.ceil((sessionStart - now) / (1000 * 60)), // minutes
        canJoinEarly: false
      };
    } else if (now >= sessionStart && now <= sessionEnd && session.status === 'live') {
      sessionStatus = 'live';
      timeInfo = {
        timeRemaining: Math.ceil((sessionEnd - now) / (1000 * 60)), // minutes
        canJoin: true
      };
    } else if (now > sessionEnd || session.status === 'completed') {
      sessionStatus = 'completed';
      timeInfo = {
        ended: true,
        canJoin: false
      };
    }

    res.success({
      session: {
        id: session.id,
        topic: session.topic,
        description: session.description,
        emoji: session.emoji,
        hostAlias: session.hostAlias,
        scheduledDateTime: session.scheduledDateTime,
        duration: session.duration,
        maxParticipants: session.maxParticipants,
        currentParticipants: session.preRegisteredParticipants.length,
        allowAnonymous: session.allowAnonymous,
        moderationEnabled: session.moderationEnabled,
        recordingEnabled: session.recordingEnabled,
        status: sessionStatus,
        liveSessionId: session.liveSessionId,
        ...timeInfo
      }
    }, 'Session invitation retrieved');

  } catch (error) {
    console.error('❌ Invitation lookup error:', error);
    res.error('Failed to retrieve session invitation: ' + error.message, 500);
  }
});

// Join scheduled session (pre-registration)
router.post('/invitation/:code/register', optionalAuthMiddleware, async (req, res) => {
  try {
    const { code } = req.params;
    const { alias, message } = req.body;

    const session = await ScheduledSession.findByInvitationCode(code);
    
    if (!session) {
      return res.error('Invalid invitation code', 404);
    }

    if (session.status !== 'scheduled') {
      return res.error('Session is not accepting registrations', 400);
    }

    const participantId = req.user?.id || `guest_${nanoid(8)}`;
    const participantAlias = alias || req.user?.alias || `Guest_${nanoid(4)}`;

    // Check if already registered
    const existing = session.preRegisteredParticipants.find(p => p.id === participantId);
    if (existing) {
      return res.error('Already registered for this session', 400);
    }

    // Add to appropriate list based on session settings
    if (session.requireApproval) {
      await session.addToWaitingList({
        id: participantId,
        alias: participantAlias,
        message: message || ''
      });
      
      res.success({
        status: 'pending_approval',
        message: 'Registration request submitted for approval'
      }, 'Added to waiting list');
    } else {
      await session.addParticipant({
        id: participantId,
        alias: participantAlias,
        email: req.user?.email
      });
      
      res.success({
        status: 'registered',
        session: {
          id: session.id,
          topic: session.topic,
          scheduledDateTime: session.scheduledDateTime
        }
      }, 'Successfully registered for session');
    }

  } catch (error) {
    console.error('❌ Session registration error:', error);
    res.error('Failed to register for session: ' + error.message, 500);
  }
});

// Start scheduled session (convert to live)
router.post('/schedule/:sessionId/start', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const scheduledSession = await ScheduledSession.findOne({ id: sessionId });
    
    if (!scheduledSession) {
      return res.error('Scheduled session not found', 404);
    }

    // Verify host
    if (scheduledSession.hostId !== req.user.id) {
      return res.error('Only the host can start the session', 403);
    }

    // Check if can start (within 15 minutes of scheduled time)
    const now = new Date();
    const scheduledTime = new Date(scheduledSession.scheduledDateTime);
    const timeDiff = Math.abs(now - scheduledTime) / (1000 * 60); // minutes
    
    if (timeDiff > 15 && now < scheduledTime) {
      return res.error('Session can only be started within 15 minutes of scheduled time', 400);
    }

    // Generate Agora tokens
    const channelName = scheduledSession.agoraChannelName;
    const sessionDuration = scheduledSession.duration * 60; // convert to seconds
    
    let agoraToken, hostToken;
    try {
      agoraToken = generateRtcToken(channelName, 0, 'subscriber', sessionDuration);
      hostToken = generateRtcToken(channelName, req.user.id, 'publisher', sessionDuration);
    } catch (agoraError) {
      console.warn('⚠️ Agora token generation failed:', agoraError.message);
      agoraToken = `temp_token_${nanoid(16)}`;
      hostToken = `temp_host_token_${nanoid(16)}`;
    }

    // Create live session
    const liveSession = new LiveSanctuarySession({
      id: `live-${nanoid(8)}`,
      topic: scheduledSession.topic,
      description: scheduledSession.description,
      emoji: scheduledSession.emoji,
      hostId: scheduledSession.hostId,
      hostAlias: scheduledSession.hostAlias,
      hostToken,
      agoraChannelName: channelName,
      agoraToken,
      maxParticipants: scheduledSession.maxParticipants,
      allowAnonymous: scheduledSession.allowAnonymous,
      moderationEnabled: scheduledSession.moderationEnabled,
      emergencyContactEnabled: true,
      recordingEnabled: scheduledSession.recordingEnabled,
      expiresAt: new Date(now.getTime() + (sessionDuration * 1000)),
      participants: [{
        id: req.user.id,
        alias: scheduledSession.hostAlias,
        isHost: true,
        isModerator: true,
        joinedAt: now,
        avatarIndex: req.user.avatarIndex || 1
      }],
      status: 'active',
      isActive: true,
      startTime: now
    });

    await liveSession.save();

    // Update scheduled session
    await scheduledSession.startLiveSession(liveSession.id);

    // Update Redis cache
    await redisService.setSessionState(liveSession.id, {
      type: 'live',
      topic: liveSession.topic,
      hostId: liveSession.hostId,
      participants: liveSession.participants,
      status: 'active'
    }, sessionDuration);

    console.log('✅ Scheduled session started as live session:', {
      scheduledId: sessionId,
      liveId: liveSession.id
    });

    res.success({
      liveSession: {
        id: liveSession.id,
        topic: liveSession.topic,
        agoraChannelName: liveSession.agoraChannelName,
        agoraToken: liveSession.agoraToken,
        hostToken: liveSession.hostToken,
        participants: liveSession.participants
      }
    }, 'Session started successfully');

  } catch (error) {
    console.error('❌ Session start error:', error);
    res.error('Failed to start session: ' + error.message, 500);
  }
});

// ================== ENHANCED LIVE SESSIONS ==================

// Fix the join endpoint to support optional auth for instant sessions
router.post('/:sessionId/join', optionalAuthMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { 
      alias, 
      isAnonymous = false, 
      voiceModulation = null,
      acknowledged = false
    } = req.body;
    
    console.log('🚪 Enhanced join request:', {
      sessionId,
      userId: req.user?.id || 'anonymous',
      acknowledged,
      voiceModulation: voiceModulation?.voiceId
    });

    // Check if it's a scheduled session that needs conversion
    const scheduledSession = await ScheduledSession.findOne({ id: sessionId });
    
    if (scheduledSession) {
      // If already converted, redirect to live session
      if (scheduledSession.liveSessionId) {
        console.log('🔄 Session already converted, redirecting to:', scheduledSession.liveSessionId);
        return res.status(200).json({
          success: true,
          message: 'Redirecting to live session',
          data: {
            liveSessionId: scheduledSession.liveSessionId,
            redirectTo: `/flagship-sanctuary/${scheduledSession.liveSessionId}`,
            needsRedirect: true
          }
        });
      }
      
      // Check if it's time to convert (scheduled time has passed or is within 1 minute)
      const now = new Date();
      const scheduledTime = new Date(scheduledSession.scheduledDateTime);
      const timeDiff = scheduledTime.getTime() - now.getTime();
      
      if (timeDiff <= 60000) { // Within 1 minute or past scheduled time
        console.log('🔄 Auto-converting scheduled session to live');
        
        try {
          const conversionResult = await convertScheduledToLive(sessionId, req.user?.id || scheduledSession.hostId, null, true);
          
          if (conversionResult && conversionResult.liveSessionId) {
            console.log('✅ Session converted successfully, redirecting to:', conversionResult.liveSessionId);
            return res.status(200).json({
              success: true,
              message: 'Session converted and redirecting',
              data: {
                liveSessionId: conversionResult.liveSessionId,
                redirectTo: `/flagship-sanctuary/${conversionResult.liveSessionId}`,
                needsRedirect: true
              }
            });
          } else {
            return res.status(500).json({
              success: false,
              message: 'Failed to convert session',
              error: 'Session conversion failed'
            });
          }
        } catch (conversionError) {
          console.error('❌ Session conversion error:', conversionError);
          return res.status(500).json({
            success: false,
            message: 'Session conversion failed',
            error: conversionError.message
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Session not yet ready',
          data: {
            scheduledDateTime: scheduledSession.scheduledDateTime,
            timeRemaining: timeDiff
          }
        });
      }
    }

    // Try to get from live sessions (MongoDB)
    let session = await LiveSanctuarySession.findOne({ id: sessionId });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Validate session status
    if (session.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Session is not active'
      });
    }

    if (new Date() > new Date(session.expiresAt)) {
      return res.status(410).json({
        success: false,
        message: 'Session has expired'
      });
    }

    if ((session.participants?.length || 0) >= session.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'Session is full'
      });
    }

    // Generate user ID for anonymous users
    const userId = req.user?.id || `anon_${nanoid(8)}`;
    
    // Check if already in session (more robust check)
    let existingParticipant = session.participants.find(p => p.id === userId);
    
    // Additional check with string comparison to avoid type mismatches
    if (!existingParticipant) {
      existingParticipant = session.participants.find(p => String(p.id) === String(userId));
    }
    
    if (existingParticipant) {
      console.log('🔄 User already in session, returning existing participant:', userId);
      return res.success({
        participant: existingParticipant,
        session: {
          id: session.id,
          topic: session.topic,
          agoraChannelName: session.agoraChannelName,
          agoraToken: session.agoraToken,
          moderationEnabled: session.moderationEnabled,
          voiceModulationAvailable: !!process.env.ELEVENLABS_API_KEY
        }
      }, 'Already in session');
    }

    // Create participant alias
    const participantAlias = alias || req.user?.alias || `Participant_${nanoid(4)}`;
    
    // Moderate join request
    const moderationResult = await aiModerationService.moderateContent(
      `Join request: ${participantAlias}`,
      sessionId,
      userId,
      'join_request'
    );

    if (!moderationResult.approved) {
      return res.error('Join request rejected by moderation system', 403);
    }

    // Create participant object
    const participant = {
      id: userId,
      alias: participantAlias,
      isHost: session.hostId === userId,
      isModerator: session.hostId === userId,
      isMuted: true, // Start muted for better audio management
      isAnonymous,
      isBanned: false,
      handRaised: false,
      joinedAt: new Date(),
      avatarIndex: req.user?.avatarIndex || Math.floor(Math.random() * 12) + 1,
      connectionStatus: 'connected',
      audioLevel: 0,
      speakingTime: 0,
      messageCount: 0,
      reactions: [],
      selectedVoiceId: voiceModulation?.voiceId,
      voiceSettings: voiceModulation?.settings,
      voiceModulation: voiceModulation ? {
        enabled: true,
        voiceId: voiceModulation.voiceId,
        settings: voiceModulation.settings || {}
      } : null
    };

    // Add participant to session
    session.participants.push(participant);
    session.currentParticipants = session.participants.length;
    await session.save();

    // Update Redis cache
    await redisService.addParticipant(sessionId, participant);
    await redisService.publishEvent(`session:${sessionId}`, 'participant_joined', {
      participant,
      sessionId,
      timestamp: new Date().toISOString()
    });

    console.log('✅ Enhanced join successful:', {
      sessionId,
      userId,
      voiceModulation: !!voiceModulation,
      participantCount: session.currentParticipants
    });

    res.success({
      participant,
      session: {
        id: session.id,
        topic: session.topic,
        agoraChannelName: session.agoraChannelName,
        agoraToken: session.agoraToken,
        moderationEnabled: session.moderationEnabled,
        voiceModulationAvailable: !!process.env.ELEVENLABS_API_KEY
      }
    }, 'Successfully joined live session');

  } catch (error) {
    console.error('❌ Enhanced join error:', error);
    res.error('Failed to join session: ' + error.message, 500);
  }
});

// Update voice modulation during session
router.post('/:sessionId/voice-modulation', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { voiceId, settings = {} } = req.body;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Find participant
    const participantIndex = session.participants.findIndex(p => p.id === req.user.id);
    if (participantIndex === -1) {
      return res.error('Not a participant in this session', 400);
    }

    // Update voice modulation settings
    session.participants[participantIndex].voiceModulation = {
      enabled: !!voiceId,
      voiceId,
      settings,
      updatedAt: new Date()
    };

    await session.save();

    // Update Redis cache
    await redisService.addParticipant(sessionId, session.participants[participantIndex]);

    console.log('🎤 Voice modulation updated:', {
      sessionId,
      userId: req.user.id,
      voiceId
    });

    res.success({
      voiceModulation: session.participants[participantIndex].voiceModulation
    }, 'Voice modulation updated');

  } catch (error) {
    console.error('❌ Voice modulation update error:', error);
    res.error('Failed to update voice modulation: ' + error.message, 500);
  }
});

// ================== SESSION ANALYTICS ==================

// Get session analytics
router.get('/:sessionId/analytics', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Check if user is host or admin
    if (session.hostId !== req.user.id && req.user.role !== 'admin') {
      return res.error('Access denied - host or admin only', 403);
    }

    // Get moderation analytics
    const moderationAnalytics = await aiModerationService.getSessionModerationAnalytics(sessionId);
    
    // Get Redis counters
    const redisCounters = await redisService.getCounters(`analytics:${sessionId}`);

    const analytics = {
      session: {
        id: session.id,
        topic: session.topic,
        startTime: session.startTime,
        duration: session.endedAt ? 
          Math.ceil((session.endedAt - session.startTime) / (1000 * 60)) : 
          Math.ceil((new Date() - session.startTime) / (1000 * 60)),
        status: session.status
      },
      participants: {
        total: session.participants.length,
        current: session.currentParticipants,
        peak: Math.max(session.currentParticipants, session.participants.length),
        voiceModulationUsers: session.participants.filter(p => p.voiceModulation?.enabled).length
      },
      engagement: {
        messagesCount: parseInt(redisCounters.messages) || 0,
        reactionsCount: parseInt(redisCounters.reactions) || 0,
        handRaisesCount: parseInt(redisCounters.handRaises) || 0,
        averageStayDuration: 0 // TODO: Calculate from participant data
      },
      moderation: moderationAnalytics.success ? moderationAnalytics.analytics : null,
      voiceAnalytics: {
        totalVoiceTime: parseInt(redisCounters.voiceTime) || 0,
        uniqueVoices: session.participants.map(p => p.voiceModulation?.voiceId).filter(Boolean).length
      }
    };

    res.success({ analytics }, 'Session analytics retrieved');

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.error('Failed to get session analytics: ' + error.message, 500);
  }
});

// ================== EMERGENCY PROTOCOLS ==================

// Handle emergency alert
router.post('/:sessionId/emergency', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { alertType, message, severity = 'high' } = req.body;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Verify participant
    const participant = session.participants.find(p => p.id === req.user.id);
    if (!participant) {
      return res.error('Not a participant in this session', 400);
    }

    // Log emergency alert
    console.log(`🚨 EMERGENCY ALERT in session ${sessionId}:`, {
      alertType,
      fromUser: req.user.id,
      severity
    });

    // Process through AI moderation for crisis detection
    const moderationResult = await aiModerationService.moderateContent(
      `Emergency alert: ${message}`,
      sessionId,
      req.user.id,
      'emergency_alert'
    );

    // Publish emergency event
    await redisService.publishEvent(`session:${sessionId}`, 'emergency_alert', {
      alertType,
      message,
      severity,
      fromParticipant: req.user.id,
      fromAlias: participant.alias,
      timestamp: new Date().toISOString(),
      moderationResult
    });

    // Increment emergency counter
    await redisService.incrementCounter(`analytics:${sessionId}`, 'emergencyAlerts');

    res.success({
      alertId: `alert_${nanoid(8)}`,
      status: 'sent',
      severity
    }, 'Emergency alert sent');

  } catch (error) {
    console.error('❌ Emergency alert error:', error);
    res.error('Failed to send emergency alert: ' + error.message, 500);
  }
});

// ================== LEAVE SESSION ==================

// Leave flagship sanctuary session
router.post('/:sessionId/leave', optionalAuthMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id || req.body.participantId;
    
    console.log('👋 Leave request for session:', sessionId, 'User:', userId);

    // Use atomic findOneAndUpdate to prevent version conflicts
    const session = await LiveSanctuarySession.findOneAndUpdate(
      { 
        id: sessionId,
        'participants.id': userId
      },
      { 
        $pull: { participants: { id: userId } },
        $inc: { currentParticipants: -1 }
      },
      { 
        new: true,
        runValidators: true
      }
    );
    
    if (!session) {
      // If no session found or user not in participants, still return success
      console.log('⚠️ Session not found or user not in participants:', sessionId, userId);
      return res.json({
        success: true,
        message: 'Successfully left session',
        data: { sessionId, userId, remainingParticipants: 0 }
      });
    }

    console.log('✅ Participant removed from session:', {
      sessionId,
      userId,
      remainingParticipants: session.currentParticipants
    });

    // Update Redis cache
    await redisService.removeParticipant(sessionId, userId);

    return res.json({
      success: true,
      message: 'Successfully left session',
      data: {
        sessionId,
        remainingParticipants: session.currentParticipants
      }
    });

  } catch (error) {
    console.error('❌ Leave session error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to leave session',
      error: error.message
    });
  }
});

// ================== MY SANCTUARIES TRACKING ==================

// Get user's flagship sanctuary sessions for My Sanctuaries page
router.get('/user/sessions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    console.log('📋 Getting user flagship sanctuary sessions:', userId);
    
    // Get sessions from Redis user history
    const userSessionKey = `user-sanctuaries-${userId}`;
    const userSessions = await redisService.getSessionState(userSessionKey) || [];
    
    // Get live sessions this user is hosting or has joined
    const liveSessions = await LiveSanctuarySession.find({
      $or: [
        { hostId: userId },
        { 'participants.id': userId }
      ]
    }).sort({ createdAt: -1 }).limit(50);
    
    // Get scheduled sessions this user created
    const scheduledSessions = await ScheduledSession.find({
      hostId: userId
    }).sort({ createdAt: -1 }).limit(50);
    
    // Combine and format sessions
    const allSessions = [];
    
    // Add live sessions
    liveSessions.forEach(session => {
      const participant = session.participants.find(p => p.id === userId);
      const isHost = session.hostId === userId;
      
      allSessions.push({
        id: session.id,
        topic: session.topic,
        description: session.description,
        emoji: session.emoji || '🎙️',
        mode: 'live-audio',
        createdAt: session.startTime || session.createdAt,
        expiresAt: session.expiresAt,
        isExpired: new Date() > session.expiresAt,
        submissionCount: session.participants.length,
        participantCount: session.participants.length,
        uniqueParticipants: session.participants.length,
        recentActivity: isHost ? session.participants.length : 0,
        lastActivity: session.endedAt || session.updatedAt,
        timeRemaining: Math.max(0, Math.ceil((session.expiresAt - new Date()) / (1000 * 60))),
        engagementScore: Math.min(100, (session.participants.length / session.maxParticipants) * 100),
        averageMessageLength: 50, // Placeholder
        hostToken: isHost ? session.hostToken : null,
        status: session.status === 'active' ? 'active' : 'expired',
        type: 'flagship-live'
      });
    });
    
    // Add scheduled sessions
    scheduledSessions.forEach(session => {
      const now = new Date();
      const scheduledTime = new Date(session.scheduledDateTime);
      const endTime = new Date(scheduledTime.getTime() + (session.duration * 60 * 1000));
      
      let status = 'expired';
      if (session.status === 'live') {
        status = 'active';
      } else if (now < scheduledTime) {
        status = 'active';
      } else if (session.status === 'scheduled' && now >= scheduledTime) {
        status = 'expiring_soon';
      }
      
      allSessions.push({
        id: session.id,
        topic: session.topic,
        description: session.description,
        emoji: session.emoji || '📅',
        mode: 'live-audio',
        createdAt: session.createdAt,
        expiresAt: endTime,
        isExpired: status === 'expired',
        submissionCount: session.preRegisteredParticipants.length,
        participantCount: session.preRegisteredParticipants.length,
        uniqueParticipants: session.preRegisteredParticipants.length,
        recentActivity: session.preRegisteredParticipants.length,
        lastActivity: session.updatedAt,
        timeRemaining: status === 'expired' ? 0 : Math.max(0, Math.ceil((endTime - new Date()) / (1000 * 60))),
        engagementScore: Math.min(100, (session.preRegisteredParticipants.length / session.maxParticipants) * 100),
        averageMessageLength: 50, // Placeholder
        hostToken: session.invitationCode,
        status,
        type: 'flagship-scheduled',
        scheduledDateTime: session.scheduledDateTime,
        liveSessionId: session.liveSessionId
      });
    });
    
    // Sort by creation date (newest first)
    allSessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Calculate analytics
    const analytics = {
      total: allSessions.length,
      active: allSessions.filter(s => s.status === 'active').length,
      expiringSoon: allSessions.filter(s => s.status === 'expiring_soon').length,
      expired: allSessions.filter(s => s.status === 'expired').length,
      totalMessages: allSessions.reduce((sum, s) => sum + s.submissionCount, 0),
      totalParticipants: allSessions.reduce((sum, s) => sum + s.uniqueParticipants, 0),
      averageEngagement: allSessions.length > 0 ? 
        Math.round(allSessions.reduce((sum, s) => sum + s.engagementScore, 0) / allSessions.length) : 0,
      mostActiveSession: allSessions.length > 0 ? 
        allSessions.reduce((prev, current) => 
          current.participantCount > prev.participantCount ? current : prev
        ) : null
    };
    
    console.log('✅ User sessions retrieved:', {
      userId,
      totalSessions: allSessions.length,
      active: analytics.active
    });
    
    res.success({
      data: allSessions,
      analytics
    }, 'User flagship sanctuary sessions retrieved');
    
  } catch (error) {
    console.error('❌ Get user sessions error:', error);
    res.error('Failed to retrieve user sessions: ' + error.message, 500);
  }
});

// Add session start/conversion endpoint
router.post('/:sessionId/start', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Get the scheduled session
    let session = await redisService.getSessionState(sessionId);
    if (!session) {
      // Try MongoDB as fallback
      const dbSession = await ScheduledSession.findOne({ id: sessionId });
      if (dbSession) {
        session = dbSession.toObject();
        session.id = dbSession.id;
      }
    }
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled session not found'
      });
    }
    
    // Check if already converted
    if (session.liveSessionId) {
      return res.status(200).json({
        success: true,
        message: 'Session already converted',
        data: {
          liveSessionId: session.liveSessionId,
          redirectTo: `/flagship-sanctuary/${session.liveSessionId}`,
          agoraToken: null // Will be generated on join
        }
      });
    }

    const now = new Date();
    
    // Create live session from scheduled session
    const liveSessionData = {
      id: `flagship-${nanoid(8)}`,
      topic: session.topic,
      description: session.description,
      emoji: session.emoji,
      hostId: session.hostId,
      hostAlias: session.hostAlias,
      hostAvatarIndex: session.hostAvatarIndex || 1,
      accessType: session.accessType,
      maxParticipants: session.maxParticipants,
      allowAnonymous: session.allowAnonymous,
      moderationEnabled: session.moderationEnabled,
      recordingEnabled: session.recordingEnabled,
      voiceModulationEnabled: session.voiceModulationEnabled,
      tags: session.tags,
      category: session.category,
      language: session.language || 'en',
      duration: session.duration,
      participants: [],
      participantCount: 0,
      status: 'active',
      actualStartTime: now,
      createdAt: now,
      expiresAt: new Date(now.getTime() + (session.duration * 60 * 1000)),
      
      // Audio/Agora settings
      agoraChannelName: `flagship_${nanoid(12)}`,
      agoraToken: '', // Will be generated when needed
      hostToken: '', // Will be generated when needed
      audioOnly: true,
      
      // Features
      emergencyProtocols: session.emergencyProtocols || [],
      emergencyContactEnabled: session.emergencyContactEnabled || false,
      breakoutRoomsEnabled: false,
      breakoutRooms: []
    };
    
    // Save live session
    await redisService.setSessionState(liveSessionData.id, liveSessionData);
    
    // Update scheduled session with live session reference
    const updatedScheduledSession = { ...session, status: 'live', liveSessionId: liveSessionData.id, actualStartTime: now };
    await redisService.setSessionState(sessionId, updatedScheduledSession);
    
    console.log('✅ Scheduled session converted to live:', liveSessionData.id);
    
    // Add to user's session history
    if (req.user?.id) {
      const userSessionKey = `user-sanctuaries-${req.user.id}`;
      const userSessions = await redisService.getSessionState(userSessionKey) || [];
      userSessions.push({
        sessionId: liveSessionData.id,
        originalScheduledId: sessionId,
        topic: liveSessionData.topic,
        emoji: liveSessionData.emoji,
        mode: 'live-audio',
        createdAt: now.toISOString(),
        isHost: true
      });
      await redisService.setSessionState(userSessionKey, userSessions);
      console.log('💾 Session saved to user history:', req.user.id);
    }
    
    return res.status(200).json({
      success: true,
      message: 'Session converted to live',
      data: {
        liveSessionId: liveSessionData.id,
        redirectTo: `/flagship-sanctuary/${liveSessionData.id}`,
        session: liveSessionData,
        agoraToken: null // Will be generated on actual join
      }
    });
    
  } catch (conversionError) {
    console.error('❌ Session conversion error:', conversionError);
    return res.status(500).json({
      success: false,
      message: 'Failed to convert session: ' + conversionError.message
    });
  }
});

module.exports = router;