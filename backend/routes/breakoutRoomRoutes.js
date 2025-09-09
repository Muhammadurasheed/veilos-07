const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const LiveSanctuarySession = require('../models/LiveSanctuarySession');
const BreakoutRoom = require('../models/BreakoutRoom');
const redisService = require('../services/redisService');
const { nanoid } = require('nanoid');
const { generateRtcToken } = require('../utils/agoraTokenGenerator');

// Create breakout room
router.post('/:sessionId/breakout-rooms', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, maxParticipants = 10, autoAssign = false } = req.body;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Only host or moderator can create breakout rooms
    const participant = session.participants.find(p => p.id === req.user.id);
    if (!participant || (!participant.isHost && !participant.isModerator)) {
      return res.error('Only hosts and moderators can create breakout rooms', 403);
    }

    if (!name || name.trim().length < 2) {
      return res.error('Room name must be at least 2 characters', 400);
    }

    // Generate unique identifiers
    const roomId = `breakout_${sessionId}_${nanoid(6)}`;
    const channelName = `breakout_${roomId}`;
    
    // Generate Agora token for breakout room
    let agoraToken;
    try {
      agoraToken = generateRtcToken(channelName, 0, 'subscriber', 3600); // 1 hour
    } catch (agoraError) {
      console.warn('⚠️ Agora token generation failed for breakout room:', agoraError.message);
      agoraToken = `temp_breakout_token_${nanoid(16)}`;
    }

    // Create breakout room
    const breakoutRoom = new BreakoutRoom({
      id: roomId,
      sessionId: session.id,
      name: name.trim(),
      createdBy: req.user.id,
      creatorAlias: participant.alias,
      maxParticipants,
      agoraChannelName: channelName,
      agoraToken,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + (3600 * 1000)), // 1 hour
      participants: [],
      autoAssign
    });

    await breakoutRoom.save();

    // Add to session's breakout rooms
    session.breakoutRooms.push(breakoutRoom._id);
    await session.save();

    // Notify all participants
    await redisService.publishEvent(`session:${sessionId}`, 'breakout_room_created', {
      room: {
        id: breakoutRoom.id,
        name: breakoutRoom.name,
        creatorAlias: breakoutRoom.creatorAlias,
        maxParticipants: breakoutRoom.maxParticipants,
        currentParticipants: 0
      },
      timestamp: new Date().toISOString()
    });

    console.log('🏠 Breakout room created:', {
      sessionId,
      roomId: breakoutRoom.id,
      name: breakoutRoom.name,
      createdBy: req.user.id
    });

    res.success({
      room: {
        id: breakoutRoom.id,
        name: breakoutRoom.name,
        createdBy: breakoutRoom.createdBy,
        creatorAlias: breakoutRoom.creatorAlias,
        maxParticipants: breakoutRoom.maxParticipants,
        currentParticipants: breakoutRoom.participants.length,
        status: breakoutRoom.status,
        agoraChannelName: breakoutRoom.agoraChannelName,
        agoraToken: breakoutRoom.agoraToken,
        createdAt: breakoutRoom.createdAt
      }
    }, 'Breakout room created successfully');

  } catch (error) {
    console.error('❌ Create breakout room error:', error);
    res.error('Failed to create breakout room: ' + error.message, 500);
  }
});

// Join breakout room
router.post('/:sessionId/breakout-rooms/:roomId/join', authMiddleware, async (req, res) => {
  try {
    const { sessionId, roomId } = req.params;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Check if user is participant in main session
    const participant = session.participants.find(p => p.id === req.user.id);
    if (!participant) {
      return res.error('Must be a participant in the main session', 403);
    }

    const breakoutRoom = await BreakoutRoom.findOne({ id: roomId });
    if (!breakoutRoom) {
      return res.error('Breakout room not found', 404);
    }

    if (breakoutRoom.sessionId !== sessionId) {
      return res.error('Breakout room does not belong to this session', 400);
    }

    // Check if room is full
    if (breakoutRoom.participants.length >= breakoutRoom.maxParticipants) {
      return res.error('Breakout room is full', 400);
    }

    // Check if already in room
    const existingParticipant = breakoutRoom.participants.find(p => p.id === req.user.id);
    if (existingParticipant) {
      return res.error('Already in breakout room', 400);
    }

    // Add participant to breakout room
    const roomParticipant = {
      id: req.user.id,
      alias: participant.alias,
      avatarIndex: participant.avatarIndex,
      joinedAt: new Date(),
      isMuted: true, // Start muted in breakout room
      connectionStatus: 'connected'
    };

    breakoutRoom.participants.push(roomParticipant);
    await breakoutRoom.save();

    // Notify breakout room participants
    await redisService.publishEvent(`breakout:${roomId}`, 'participant_joined', {
      participant: roomParticipant,
      roomId: breakoutRoom.id,
      roomName: breakoutRoom.name,
      timestamp: new Date().toISOString()
    });

    // Notify main session
    await redisService.publishEvent(`session:${sessionId}`, 'breakout_room_joined', {
      roomId: breakoutRoom.id,
      roomName: breakoutRoom.name,
      participantId: req.user.id,
      participantAlias: participant.alias,
      timestamp: new Date().toISOString()
    });

    console.log('🚪 User joined breakout room:', {
      sessionId,
      roomId,
      userId: req.user.id,
      roomParticipants: breakoutRoom.participants.length
    });

    res.success({
      room: {
        id: breakoutRoom.id,
        name: breakoutRoom.name,
        agoraChannelName: breakoutRoom.agoraChannelName,
        agoraToken: breakoutRoom.agoraToken,
        participants: breakoutRoom.participants,
        maxParticipants: breakoutRoom.maxParticipants
      },
      participant: roomParticipant
    }, 'Joined breakout room successfully');

  } catch (error) {
    console.error('❌ Join breakout room error:', error);
    res.error('Failed to join breakout room: ' + error.message, 500);
  }
});

// Leave breakout room
router.post('/:sessionId/breakout-rooms/:roomId/leave', authMiddleware, async (req, res) => {
  try {
    const { sessionId, roomId } = req.params;

    const breakoutRoom = await BreakoutRoom.findOne({ id: roomId });
    if (!breakoutRoom) {
      return res.error('Breakout room not found', 404);
    }

    // Remove participant from breakout room
    const participantIndex = breakoutRoom.participants.findIndex(p => p.id === req.user.id);
    if (participantIndex === -1) {
      return res.error('Not in breakout room', 400);
    }

    const participant = breakoutRoom.participants[participantIndex];
    breakoutRoom.participants.splice(participantIndex, 1);
    await breakoutRoom.save();

    // Notify breakout room participants
    await redisService.publishEvent(`breakout:${roomId}`, 'participant_left', {
      participantId: req.user.id,
      participantAlias: participant.alias,
      roomId: breakoutRoom.id,
      timestamp: new Date().toISOString()
    });

    // Notify main session
    await redisService.publishEvent(`session:${sessionId}`, 'breakout_room_left', {
      roomId: breakoutRoom.id,
      roomName: breakoutRoom.name,
      participantId: req.user.id,
      participantAlias: participant.alias,
      timestamp: new Date().toISOString()
    });

    console.log('🚪 User left breakout room:', {
      sessionId,
      roomId,
      userId: req.user.id,
      remainingParticipants: breakoutRoom.participants.length
    });

    res.success({
      roomId: breakoutRoom.id,
      roomName: breakoutRoom.name
    }, 'Left breakout room successfully');

  } catch (error) {
    console.error('❌ Leave breakout room error:', error);
    res.error('Failed to leave breakout room: ' + error.message, 500);
  }
});

// Get session breakout rooms
router.get('/:sessionId/breakout-rooms', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Check if user is participant
    const participant = session.participants.find(p => p.id === req.user.id);
    if (!participant) {
      return res.error('Not a participant in this session', 403);
    }

    const breakoutRooms = await BreakoutRoom.find({ 
      sessionId: session.id,
      status: 'active'
    }).sort({ createdAt: 1 });

    const roomList = breakoutRooms.map(room => ({
      id: room.id,
      name: room.name,
      createdBy: room.createdBy,
      creatorAlias: room.creatorAlias,
      maxParticipants: room.maxParticipants,
      currentParticipants: room.participants.length,
      participants: room.participants.map(p => ({
        id: p.id,
        alias: p.alias,
        avatarIndex: p.avatarIndex,
        joinedAt: p.joinedAt
      })),
      createdAt: room.createdAt,
      canJoin: room.participants.length < room.maxParticipants &&
               !room.participants.find(p => p.id === req.user.id)
    }));

    res.success({
      rooms: roomList,
      totalRooms: roomList.length
    }, 'Breakout rooms retrieved successfully');

  } catch (error) {
    console.error('❌ Get breakout rooms error:', error);
    res.error('Failed to retrieve breakout rooms: ' + error.message, 500);
  }
});

// Delete breakout room (host only)
router.delete('/:sessionId/breakout-rooms/:roomId', authMiddleware, async (req, res) => {
  try {
    const { sessionId, roomId } = req.params;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Only host can delete breakout rooms
    if (session.hostId !== req.user.id) {
      return res.error('Only the host can delete breakout rooms', 403);
    }

    const breakoutRoom = await BreakoutRoom.findOne({ id: roomId });
    if (!breakoutRoom) {
      return res.error('Breakout room not found', 404);
    }

    // Update room status to closed
    breakoutRoom.status = 'closed';
    breakoutRoom.closedAt = new Date();
    await breakoutRoom.save();

    // Notify all participants in the breakout room
    await redisService.publishEvent(`breakout:${roomId}`, 'room_closed', {
      roomId: breakoutRoom.id,
      roomName: breakoutRoom.name,
      closedBy: session.hostAlias,
      timestamp: new Date().toISOString()
    });

    // Notify main session
    await redisService.publishEvent(`session:${sessionId}`, 'breakout_room_closed', {
      roomId: breakoutRoom.id,
      roomName: breakoutRoom.name,
      closedBy: session.hostAlias,
      timestamp: new Date().toISOString()
    });

    console.log('🏠 Breakout room closed:', {
      sessionId,
      roomId,
      closedBy: req.user.id
    });

    res.success({
      roomId: breakoutRoom.id,
      roomName: breakoutRoom.name
    }, 'Breakout room closed successfully');

  } catch (error) {
    console.error('❌ Delete breakout room error:', error);
    res.error('Failed to close breakout room: ' + error.message, 500);
  }
});

// Auto-assign participants to breakout rooms
router.post('/:sessionId/breakout-rooms/auto-assign', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await LiveSanctuarySession.findOne({ id: sessionId });
    if (!session) {
      return res.error('Session not found', 404);
    }

    // Only host can auto-assign
    if (session.hostId !== req.user.id) {
      return res.error('Only the host can auto-assign participants', 403);
    }

    const breakoutRooms = await BreakoutRoom.find({ 
      sessionId: session.id,
      status: 'active'
    });

    if (breakoutRooms.length === 0) {
      return res.error('No active breakout rooms found', 400);
    }

    // Get participants not in breakout rooms
    const unassignedParticipants = session.participants.filter(p => {
      return !breakoutRooms.some(room => 
        room.participants.some(rp => rp.id === p.id)
      );
    });

    if (unassignedParticipants.length === 0) {
      return res.success({ message: 'All participants are already assigned' }, 'All participants assigned');
    }

    // Distribute participants evenly
    let roomIndex = 0;
    for (const participant of unassignedParticipants) {
      const targetRoom = breakoutRooms[roomIndex % breakoutRooms.length];
      
      if (targetRoom.participants.length < targetRoom.maxParticipants) {
        const roomParticipant = {
          id: participant.id,
          alias: participant.alias,
          avatarIndex: participant.avatarIndex,
          joinedAt: new Date(),
          isMuted: true,
          connectionStatus: 'connected'
        };

        targetRoom.participants.push(roomParticipant);
        await targetRoom.save();

        // Notify participant
        await redisService.publishEvent(`user:${participant.id}`, 'auto_assigned_to_breakout', {
          roomId: targetRoom.id,
          roomName: targetRoom.name,
          timestamp: new Date().toISOString()
        });
      }
      
      roomIndex++;
    }

    console.log('🔄 Auto-assigned participants to breakout rooms:', {
      sessionId,
      assignedCount: unassignedParticipants.length,
      totalRooms: breakoutRooms.length
    });

    res.success({
      assignedCount: unassignedParticipants.length,
      totalRooms: breakoutRooms.length
    }, 'Participants auto-assigned successfully');

  } catch (error) {
    console.error('❌ Auto-assign breakout rooms error:', error);
    res.error('Failed to auto-assign participants: ' + error.message, 500);
  }
});

module.exports = router;