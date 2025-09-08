const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

const initializeSocket = (server) => {
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_2,
    process.env.CLIENT_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8080',
    'http://127.0.0.1:8080'
  ].filter(Boolean);

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      console.log('🔐 Socket authentication attempt:', {
        hasToken: !!token,
        tokenPrefix: token ? token.substring(0, 20) + '...' : 'none',
        socketId: socket.id
      });
      
      if (!token) {
        // Allow anonymous connections for public spaces
        socket.userId = `anonymous_${socket.id}`;
        socket.isAnonymous = true;
        console.log('👤 Anonymous socket connection allowed:', socket.userId);
        return next();
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('🔓 JWT decoded successfully:', {
        userId: decoded.user?.id,
        exp: new Date(decoded.exp * 1000)
      });
      
      const user = await User.findOne({ id: decoded.user.id });
      console.log('👤 User lookup result:', {
        found: !!user,
        userId: user?.id,
        role: user?.role,
        alias: user?.alias
      });
      
      if (!user) {
        console.log('❌ User not found in database');
        return next(new Error('Authentication error - user not found'));
      }

      socket.userId = user.id;
      socket.userAlias = user.alias;
      socket.userAvatarIndex = user.avatarIndex;
      socket.userRole = user.role; // Add role to socket for easy access
      socket.isAnonymous = false;
      
      console.log('✅ Socket authenticated successfully:', {
        userId: socket.userId,
        alias: socket.userAlias,
        role: socket.userRole
      });
      
      next();
    } catch (err) {
      console.error('❌ Socket authentication failed:', err.message);
      next(new Error('Authentication error - ' + err.message));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 User connected: ${socket.userId} (${socket.userAlias || 'Anonymous'}) - Role: ${socket.userRole || 'unknown'}`);

    // Handle joining chat sessions
    socket.on('join_chat', async (data) => {
      const { sessionId, userType } = data;
      
      socket.join(`chat_${sessionId}`);
      socket.currentChatSession = sessionId;
      
      // Notify other participants
      socket.to(`chat_${sessionId}`).emit('user_joined', {
        userId: socket.userId,
        userAlias: socket.userAlias,
        userType,
        timestamp: new Date().toISOString()
      });
      
      console.log(`User ${socket.userId} joined chat session ${sessionId}`);
    });

    // Handle chat messages
    socket.on('send_message', async (data) => {
      const { sessionId, content, type = 'text', attachment } = data;
      
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sender: {
          id: socket.userId,
          alias: socket.userAlias || 'Anonymous',
          avatarIndex: socket.userAvatarIndex,
          isExpert: data.isExpert || false
        },
        content,
        type,
        attachment,
        timestamp: new Date().toISOString(),
        sessionId
      };

      // Broadcast to all participants in the session
      io.to(`chat_${sessionId}`).emit('new_message', message);
      
      // TODO: Save message to database
      console.log(`Message sent in session ${sessionId}:`, content);
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('user_typing', {
        userId: socket.userId,
        userAlias: socket.userAlias,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('user_typing', {
        userId: socket.userId,
        userAlias: socket.userAlias,
        isTyping: false
      });
    });

    // Handle sanctuary spaces
    socket.on('join_sanctuary', async (data) => {
      const { sanctuaryId, participant } = data;
      
      socket.join(`sanctuary_${sanctuaryId}`);
      socket.currentSanctuary = sanctuaryId;
      
      // Notify other participants
      socket.to(`sanctuary_${sanctuaryId}`).emit('participant_joined', {
        participant: {
          id: socket.userId,
          alias: participant.alias || socket.userAlias || 'Anonymous',
          joinedAt: new Date().toISOString(),
          isAnonymous: socket.isAnonymous || participant.isAnonymous
        }
      });
      
      console.log(`User ${socket.userId} joined sanctuary ${sanctuaryId}`);
    });

    // Handle flagship sanctuary events with improved participant tracking
    const FlagshipSanctuarySession = require('../models/LiveSanctuarySession');
    
    // Store active participants in memory for each session
    if (!io.participantTracker) {
      io.participantTracker = new Map(); // sessionId -> Map<participantId, participantData>
    }
    
    // Store host-muted participants to prevent self-unmute
    if (!io.hostMutedParticipants) {
      io.hostMutedParticipants = new Map(); // sessionId -> Set<participantId>
    }

    socket.on('join_flagship_sanctuary', async (data) => {
      const { sessionId, participant } = data;
      
      try {
        // Get session data
        const session = await FlagshipSanctuarySession.findOne({ id: sessionId });
        if (!session) {
          socket.emit('join_error', { message: 'Session not found' });
          return;
        }

        // Join socket room
        socket.join(`flagship_${sessionId}`);
        socket.currentFlagshipSession = sessionId;
        socket.participantId = participant.id || socket.userId;
        socket.participantAlias = participant.alias || socket.userAlias;

        // Initialize participant tracker for this session if needed
        if (!io.participantTracker.has(sessionId)) {
          io.participantTracker.set(sessionId, new Map());
        }

        const sessionParticipants = io.participantTracker.get(sessionId);
        
        // Add/update participant data
        const participantData = {
          id: socket.participantId,
          alias: socket.participantAlias,
          avatarIndex: participant.avatarIndex || socket.userAvatarIndex || 1,
          isHost: participant.isHost || false,
          isModerator: participant.isModerator || false,
          isMuted: true, // Start muted by default
          handRaised: false,
          joinedAt: new Date().toISOString(),
          socketId: socket.id,
          connectionStatus: 'connected'
        };

        sessionParticipants.set(socket.participantId, participantData);

        // Broadcast to all participants in the session
        socket.to(`flagship_${sessionId}`).emit('participant_joined', {
          participant: participantData,
          totalParticipants: sessionParticipants.size
        });

        // Send confirmation with current participants list
        socket.emit('join_confirmed', {
          sessionId,
          participant: participantData,
          participants: Array.from(sessionParticipants.values()),
          totalParticipants: sessionParticipants.size
        });

        console.log(`✅ ${socket.participantAlias} joined flagship sanctuary ${sessionId}`);

      } catch (error) {
        console.error('❌ Error joining flagship sanctuary:', error);
        socket.emit('join_error', { message: 'Failed to join session' });
      }
    });

    // Enhanced chat messaging for flagship sanctuaries
    socket.on('flagship_send_message', async (data) => {
      try {
        const { sessionId, content, type = 'text', attachment, replyTo } = data;
        const participantId = socket.participantId || socket.userId;
        const participantAlias = socket.participantAlias || socket.userAlias || 'Anonymous';

        if (!sessionId || !content) {
          socket.emit('message_error', { message: 'Invalid message data' });
          return;
        }

        // Create message object (support replyTo and attachments)
        const chatMessage = {
          id: `flagship_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          senderAlias: participantAlias,
          senderAvatarIndex: socket.userAvatarIndex || 1,
          content,
          type,
          attachment,
          timestamp: new Date().toISOString(),
          participantId,
          replyTo: replyTo || null
        };

        // Emit ONLY once to prevent duplicate delivery to sockets joined in multiple rooms
        io.to(`flagship_${sessionId}`).emit('new_message', chatMessage);

        console.log(`💬 Flagship message in ${sessionId} by ${participantAlias}:`, {
          type: chatMessage.type,
          hasAttachment: !!chatMessage.attachment,
          replyTo: !!chatMessage.replyTo
        });

      } catch (error) {
        console.error('❌ Error sending flagship message:', error);
        socket.emit('message_error', { message: 'Failed to send message' });
      }
    });

    // Handle joining sanctuary as host for real-time inbox updates
    socket.on('join_sanctuary_host', async (data) => {
      const { sanctuaryId, hostToken } = data;
      
      // Verify host authorization
      const SanctuarySession = require('../models/SanctuarySession');
      const HostSession = require('../models/HostSession');
      let session;
      let isAuthorized = false;
      
      console.log(`Attempting host auth for sanctuary ${sanctuaryId}`, { 
        hostToken: hostToken ? 'provided' : 'none',
        userId: socket.userId,
        isAnonymous: socket.isAnonymous
      });
      
      // Check host token first (for anonymous hosts)
      if (hostToken) {
        session = await SanctuarySession.findOne({ 
          id: sanctuaryId,
          hostToken
        });
        
        if (session) {
          isAuthorized = true;
          console.log(`Host authenticated via hostToken for sanctuary ${sanctuaryId}`);
        } else {
          // Check if host session exists in HostSession model
          const hostSession = await HostSession.findOne({
            sanctuaryId,
            hostToken,
            isActive: true,
            expiresAt: { $gt: new Date() }
          });
          
          if (hostSession) {
            session = await SanctuarySession.findOne({ id: sanctuaryId });
            isAuthorized = true;
            console.log(`Host authenticated via HostSession for sanctuary ${sanctuaryId}`);
          }
        }
      }
      
      // Check authenticated user ownership
      if (!isAuthorized && !socket.isAnonymous) {
        session = await SanctuarySession.findOne({
          id: sanctuaryId,
          hostId: socket.userId
        });
        if (session) {
          isAuthorized = true;
          console.log(`Host authenticated via userId for sanctuary ${sanctuaryId}`);
        }
      }
      
      if (session && isAuthorized) {
        socket.join(`sanctuary_host_${sanctuaryId}`);
        socket.currentSanctuaryHost = sanctuaryId;
        
        // Update host session last access
        if (hostToken) {
          await HostSession.updateOne(
            { sanctuaryId, hostToken },
            { lastAccessedAt: new Date() }
          );
        }
        
        // Send current submissions count and session info
        socket.emit('sanctuary_host_joined', {
          sanctuaryId,
          submissionsCount: session.submissions?.length || 0,
          lastActivity: session.submissions?.length > 0 ? 
            session.submissions[session.submissions.length - 1].timestamp : 
            session.createdAt,
          sessionInfo: {
            topic: session.topic,
            description: session.description,
            emoji: session.emoji,
            expiresAt: session.expiresAt,
            mode: session.mode
          }
        });
        
        console.log(`Host ${socket.userId} joined sanctuary host room ${sanctuaryId} with ${session.submissions?.length || 0} submissions`);
      } else {
        console.log(`Host auth failed for sanctuary ${sanctuaryId}`, { 
          sessionFound: !!session,
          isAuthorized 
        });
        socket.emit('sanctuary_host_auth_failed', {
          sanctuaryId,
          error: 'Not authorized as host for this sanctuary'
        });
      }
    });

    socket.on('sanctuary_message', async (data) => {
      const { sanctuaryId, content, type = 'text', attachment, participantAlias, participantId } = data;
      
      const message = {
        id: `sanctuary_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        participantId: participantId || socket.userId,
        participantAlias: participantAlias || socket.userAlias || 'Anonymous',
        content,
        type,
        attachment,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all participants in both sanctuary and audio room channels
      io.to(`sanctuary_${sanctuaryId}`).emit('sanctuary_new_message', message);
      io.to(`audio_room_${sanctuaryId}`).emit('sanctuary_new_message', message);
      
      console.log(`Sanctuary message in ${sanctuaryId}:`, {
        type: message.type,
        hasAttachment: !!message.attachment,
        participantAlias: message.participantAlias
      });
    });

    // Handle live audio room events
    socket.on('join_audio_room', (data) => {
      const { sessionId, participant } = data;
      
      socket.join(`audio_room_${sessionId}`);
      socket.currentAudioRoom = sessionId;
      socket.participantId = participant.id || socket.userId;
      socket.participantAlias = participant.alias || socket.userAlias || 'Anonymous';

      // Update participant tracker for flagship sessions
      if (io.participantTracker && io.participantTracker.has(sessionId)) {
        const sessionParticipants = io.participantTracker.get(sessionId);
        const existingParticipant = sessionParticipants.get(socket.participantId);
        
        if (existingParticipant) {
          // Update existing participant
          sessionParticipants.set(socket.participantId, {
            ...existingParticipant,
            socketId: socket.id,
            connectionStatus: 'connected'
          });
        }
      }
      
      // Notify others of participant joining
      socket.to(`audio_room_${sessionId}`).emit('audio_participant_joined', {
        participant: {
          id: socket.participantId,
          alias: socket.participantAlias,
          isHost: participant.isHost || false,
          isModerator: participant.isModerator || false,
          joinedAt: new Date().toISOString(),
          connectionStatus: 'connected'
        }
      });
      
      console.log(`User ${socket.participantAlias} joined audio room ${sessionId}`);
    });

    socket.on('raise_hand', (data) => {
      const { sessionId, isRaised } = data;
      const participantId = socket.participantId || socket.userId;
      
      // Update participant tracker
      if (io.participantTracker && io.participantTracker.has(sessionId)) {
        const sessionParticipants = io.participantTracker.get(sessionId);
        const participant = sessionParticipants.get(participantId);
        if (participant) {
          sessionParticipants.set(participantId, {
            ...participant,
            handRaised: isRaised
          });
        }
      }
      
      // Broadcast to flagship room only (avoid duplicate events)
      io.to(`flagship_${sessionId}`).emit('hand_raised', {
        participantId,
        participantAlias: socket.participantAlias || 'Anonymous',
        isRaised,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('promote_to_speaker', (data) => {
      const { sessionId, participantId } = data;
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === participantId);
      
      if (targetSocket) {
        targetSocket.emit('promoted_to_speaker', {
          sessionId,
          promotedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
        
        // Notify room
        io.to(`audio_room_${sessionId}`).emit('speaker_promoted', {
          participantId,
          promotedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('mute_participant', (data) => {
      const { sessionId, participantId } = data;
      
      // Update participant tracker
      if (io.participantTracker && io.participantTracker.has(sessionId)) {
        const sessionParticipants = io.participantTracker.get(sessionId);
        const participant = sessionParticipants.get(participantId);
        if (participant) {
          sessionParticipants.set(participantId, {
            ...participant,
            isMuted: true
          });
        }
      }
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => (s.participantId === participantId || s.userId === participantId));
      
      if (targetSocket) {
        targetSocket.emit('force_muted', {
          sessionId,
          mutedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      }
      
      // Notify flagship room only (avoid duplicates)
      io.to(`flagship_${sessionId}`).emit('participant_muted', {
        participantId,
        mutedBy: socket.userId,
        timestamp: new Date().toISOString()
      });

      // Persist host mute to DB for refresh-proof enforcement
      try {
        await FlagshipSanctuarySession.updateOne(
          { id: sessionId },
          { $addToSet: { hostMutedParticipants: participantId } }
        );
      } catch (e) {
        console.warn('Failed to persist host mute:', e.message);
      }
    });

    // Host/moderator can unmute a participant
    socket.on('unmute_participant', (data) => {
      const { sessionId, participantId } = data;

      // Update participant tracker
      if (io.participantTracker && io.participantTracker.has(sessionId)) {
        const sessionParticipants = io.participantTracker.get(sessionId);
        const participant = sessionParticipants.get(participantId);
        if (participant) {
          sessionParticipants.set(participantId, {
            ...participant,
            isMuted: false
          });
        }
      }

      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => (s.participantId === participantId || s.userId === participantId));

      if (targetSocket) {
        targetSocket.emit('force_unmuted', {
          sessionId,
          unmutedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
      }

      // Notify flagship room
      io.to(`flagship_${sessionId}`).emit('participant_unmuted', {
        participantId,
        unmutedBy: socket.userId,
        timestamp: new Date().toISOString()
      });
    });

    // Host/moderator can unmute everyone
    socket.on('unmute_all', (data) => {
      const { sessionId } = data;

      if (io.participantTracker && io.participantTracker.has(sessionId)) {
        const sessionParticipants = io.participantTracker.get(sessionId);
        sessionParticipants.forEach((participant, pid) => {
          sessionParticipants.set(pid, { ...participant, isMuted: false });

          // Notify each participant directly
          const targetSocket = Array.from(io.sockets.sockets.values())
            .find(s => (s.participantId === pid || s.userId === pid));
          if (targetSocket) {
            targetSocket.emit('force_unmuted', {
              sessionId,
              unmutedBy: socket.userId,
              timestamp: new Date().toISOString()
            });
          }
        });
      }

      io.to(`flagship_${sessionId}`).emit('participants_unmuted', {
        sessionId,
        unmutedBy: socket.userId,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('kick_participant', (data) => {
      const { sessionId, participantId } = data;
      
      // Remove from participant tracker
      if (io.participantTracker && io.participantTracker.has(sessionId)) {
        const sessionParticipants = io.participantTracker.get(sessionId);
        sessionParticipants.delete(participantId);
      }
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => (s.participantId === participantId || s.userId === participantId));
      
      if (targetSocket) {
        targetSocket.emit('kicked_from_room', {
          sessionId,
          kickedBy: socket.userId,
          timestamp: new Date().toISOString()
        });
        
        // Remove from all rooms
        targetSocket.leave(`audio_room_${sessionId}`);
        targetSocket.leave(`flagship_${sessionId}`);
      }
      
      // Notify flagship room only (avoid duplicates)
      io.to(`flagship_${sessionId}`).emit('participant_kicked', {
        participantId,
        kickedBy: socket.userId,
        timestamp: new Date().toISOString()
      });
    });

    // Handle audio room join for flagship sanctuary  
    socket.on('join_audio_room', async (data) => {
      const { sessionId, participant } = data;
      console.log(`🔊 User attempting to join audio room ${sessionId}:`, {
        userId: socket.userId,
        userAlias: socket.userAlias,
        participantData: participant
      });

      try {
        // Check if already in room to prevent duplicates
        if (socket.currentAudioRoom === sessionId) {
          console.log(`⚠️ User ${socket.userId} already in audio room ${sessionId}`);
          return;
        }

        socket.join(`audio_room_${sessionId}`);
        socket.currentAudioRoom = sessionId;

        // Enhanced participant object with socket data
        const enhancedParticipant = {
          id: socket.userId,
          alias: participant?.alias || socket.userAlias || `Anonymous_${socket.id.substring(0, 6)}`,
          avatarIndex: socket.userAvatarIndex || Math.floor(Math.random() * 7) + 1,
          isHost: participant?.isHost || false,
          isMuted: participant?.isMuted || false,
          isAnonymous: socket.isAnonymous || false,
          joinedAt: new Date().toISOString(),
          socketId: socket.id
        };

        // Store participant in socket for easy access
        socket.audioParticipant = enhancedParticipant;

        // Get current participants before broadcasting
        const roomSockets = await io.in(`audio_room_${sessionId}`).fetchSockets();
        const currentParticipants = roomSockets
          .filter(s => s.audioParticipant && s.id !== socket.id) // Exclude current socket
          .map(s => s.audioParticipant);

        // Add current participant
        currentParticipants.push(enhancedParticipant);

        // Broadcast to others in the room (excluding sender)
        socket.to(`audio_room_${sessionId}`).emit('audio_participant_joined', {
          participant: enhancedParticipant,
          timestamp: new Date().toISOString(),
          sessionId
        });

        // Send current participants list to new joiner
        socket.emit('audio_room_state', {
          sessionId,
          participants: currentParticipants,
          timestamp: new Date().toISOString()
        });

        console.log(`✅ User ${socket.userId} joined audio room ${sessionId} successfully`, {
          participantCount: currentParticipants.length,
          participants: currentParticipants.map(p => ({ id: p.id, alias: p.alias }))
        });

      } catch (error) {
        console.error(`❌ Error joining audio room ${sessionId}:`, error);
        socket.emit('audio_room_error', {
          error: 'Failed to join audio room',
          details: error.message
        });
      }
    });

    // Handle sending messages to flagship sanctuary
    socket.on('send_flagship_message', async (data) => {
      const { sessionId, content, type = 'text', attachment, replyTo } = data;
      
      console.log(`💬 Message from ${socket.userAlias} in session ${sessionId}:`, {
        type,
        hasAttachment: !!attachment,
        contentLength: content?.length || 0
      });

      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        sessionId,
        senderAlias: socket.userAlias || `Anonymous_${socket.id.substring(0, 6)}`,
        senderAvatarIndex: socket.userAvatarIndex || Math.floor(Math.random() * 7) + 1,
        content,
        type,
        timestamp: new Date(),
        attachment,
        replyTo
      };

      // Broadcast to all participants in the audio room (including sender for confirmation)
      io.to(`audio_room_${sessionId}`).emit('flagship_new_message', message);
      
      console.log(`📨 Message broadcasted to audio room ${sessionId}`);
    });

    // Handle host controls for flagship sanctuary
    socket.on('flagship_host_action', async (data) => {
      const { sessionId, action, targetParticipantId, targetSocketId } = data;
      
      console.log(`🎛️ Host action from ${socket.userAlias}:`, {
        sessionId,
        action,
        targetParticipantId,
        targetSocketId
      });

      try {
        if (action === 'mute' || action === 'unmute') {
          // Broadcast mute/unmute to target participant
          if (targetSocketId) {
            io.to(targetSocketId).emit('flagship_host_muted', {
              action,
              sessionId,
              by: socket.userAlias,
              timestamp: new Date().toISOString()
            });
          }
          
          // Broadcast to all participants about the action
          io.to(`audio_room_${sessionId}`).emit('flagship_participant_muted', {
            participantId: targetParticipantId,
            action,
            by: socket.userAlias,
            timestamp: new Date().toISOString()
          });
          
        } else if (action === 'remove') {
          // Force remove participant from session
          if (targetSocketId) {
            // Send removal notification to target
            io.to(targetSocketId).emit('flagship_removed_from_session', {
              sessionId,
              by: socket.userAlias,
              reason: 'Removed by host',
              timestamp: new Date().toISOString()
            });
            
            // Force disconnect from audio room after a brief delay
            setTimeout(() => {
              const targetSocket = io.sockets.sockets.get(targetSocketId);
              if (targetSocket) {
                targetSocket.leave(`audio_room_${sessionId}`);
                targetSocket.currentAudioRoom = null;
                targetSocket.audioParticipant = null;
                
                // Broadcast participant left to remaining participants
                socket.to(`audio_room_${sessionId}`).emit('audio_participant_left', {
                  participantId: targetParticipantId,
                  participantAlias: targetSocket.userAlias,
                  timestamp: new Date().toISOString()
                });
              }
            }, 2000); // Give 2 seconds for the notification to show
          }
          
        } else if (action === 'unmute_all') {
          // Broadcast unmute all to all participants
          io.to(`audio_room_${sessionId}`).emit('flagship_host_unmuted_all', {
            sessionId,
            by: socket.userAlias,
            timestamp: new Date().toISOString()
          });
        }

        console.log(`✅ Host action ${action} completed for participant ${targetParticipantId}`);
        
      } catch (error) {
        console.error(`❌ Error executing host action:`, error);
        socket.emit('flagship_host_action_error', {
          error: 'Failed to execute host action',
          details: error.message
        });
      }
    });

    socket.on('send_emoji_reaction', (data) => {
      const { sessionId, emoji } = data;
      const participantId = socket.participantId || socket.userId;
      
      const reactionData = {
        participantId,
        participantAlias: socket.participantAlias || socket.userAlias || 'Anonymous',
        emoji,
        timestamp: new Date().toISOString(),
        id: `reaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
      
      // Broadcast to all rooms for this session
      io.to(`audio_room_${sessionId}`).emit('flagship_reaction', reactionData);
    });

    socket.on('emergency_alert', (data) => {
      const { sessionId, alertType, message } = data;
      
      // Send to all participants and moderators
      io.to(`audio_room_${sessionId}`).emit('emergency_alert', {
        alertType,
        message,
        fromParticipant: socket.userId,
        timestamp: new Date().toISOString()
      });
      
      console.log(`Emergency alert in ${sessionId}: ${alertType} - ${message}`);
    });

    // Handle voice chat requests
    socket.on('request_voice_chat', (data) => {
      const { targetUserId, sessionId } = data;
      
      // Find target user's socket
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('voice_chat_request', {
          fromUserId: socket.userId,
          fromUserAlias: socket.userAlias,
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
    });

    socket.on('voice_chat_response', (data) => {
      const { targetUserId, accepted, sessionId } = data;
      
      const targetSocket = Array.from(io.sockets.sockets.values())
        .find(s => s.userId === targetUserId);
      
      if (targetSocket) {
        targetSocket.emit('voice_chat_response', {
          fromUserId: socket.userId,
          fromUserAlias: socket.userAlias,
          accepted,
          sessionId,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle connection quality monitoring
    socket.on('ping_sanctuary', (data) => {
      socket.emit('pong_sanctuary', {
        ...data,
        serverTime: new Date().toISOString()
      });
    });

    // Handle message read receipts for sanctuary
    socket.on('sanctuary_message_read', (data) => {
      const { sanctuaryId, messageId, hostToken } = data;
      
      // Verify host and emit read receipt
      socket.to(`sanctuary_${sanctuaryId}`).emit('sanctuary_message_status', {
        messageId,
        status: 'read',
        timestamp: new Date().toISOString()
      });
    });

    // Handle admin panel join for real-time notifications
    socket.on('join_admin_panel', async (data) => {
      console.log('🔑 Admin attempting to join admin panel channel...', {
        socketUserId: socket.userId,
        socketAlias: socket.userAlias,
        data: data
      });
      
      try {
        // Verify admin role - check both socket user and provided data user
        let user = await User.findOne({ id: socket.userId });
        
        // If socket user doesn't match the provided data, check if provided user exists and is admin
        if (!user || user.role !== 'admin') {
          console.log('🔄 Socket user not admin, checking provided user data...');
          if (data?.userId) {
            user = await User.findOne({ id: data.userId, role: 'admin' });
          }
        }
        
        console.log('👤 User lookup result:', {
          socketUserId: socket.userId,
          providedUserId: data?.userId,
          found: !!user,
          userId: user?.id,
          role: user?.role,
          alias: user?.alias,
          email: user?.email
        });
        
        if (user && user.role === 'admin') {
          socket.join('admin_panel');
          
          // Get room info for debugging
          const adminRoom = io.sockets.adapter.rooms.get('admin_panel');
          const connectedAdmins = adminRoom ? adminRoom.size : 0;
          
          console.log(`✅ Admin ${socket.userId} (${user.alias}) successfully joined admin panel`, {
            connectedAdmins,
            roomSize: connectedAdmins,
            timestamp: new Date().toISOString()
          });
          
          // Send confirmation back to client
          socket.emit('admin_panel_joined', { 
            success: true, 
            connectedAdmins,
            timestamp: new Date().toISOString()
          });
        } else {
          console.log(`❌ User ${socket.userId} denied access to admin panel`, {
            userFound: !!user,
            role: user?.role || 'unknown',
            expected: 'admin'
          });
          socket.emit('admin_panel_joined', { 
            success: false, 
            error: 'Insufficient permissions - admin role required' 
          });
        }
      } catch (error) {
        console.error('❌ Error in join_admin_panel:', error);
        socket.emit('admin_panel_joined', { 
          success: false, 
          error: 'Database error occurred' 
        });
      }
    });

    // Handle expert joining for notifications
    socket.on('join_expert_notifications', async (data) => {
      const { expertId } = data;
      if (expertId) {
        socket.join(`expert_${expertId}`);
        console.log(`Expert ${expertId} joined for notifications`);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
      
      // Leave current chat session
      if (socket.currentChatSession) {
        socket.to(`chat_${socket.currentChatSession}`).emit('user_left', {
          userId: socket.userId,
          userAlias: socket.userAlias,
          timestamp: new Date().toISOString()
        });
      }
      
      // Leave current sanctuary
      if (socket.currentSanctuary) {
        socket.to(`sanctuary_${socket.currentSanctuary}`).emit('participant_left', {
          participantId: socket.userId,
          participantAlias: socket.userAlias,
          timestamp: new Date().toISOString()
        });
      }

      // Leave current sanctuary host room
      if (socket.currentSanctuaryHost) {
        console.log(`Host ${socket.userId} left sanctuary host room ${socket.currentSanctuaryHost}`);
      }
      
      // Leave current audio room
      if (socket.currentAudioRoom) {
        socket.to(`audio_room_${socket.currentAudioRoom}`).emit('audio_participant_left', {
          participantId: socket.userId,
          participantAlias: socket.userAlias,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Handle message delivery confirmations
    socket.on('message_delivered', (data) => {
      const { messageId, sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('message_status_update', {
        messageId,
        status: 'delivered',
        userId: socket.userId
      });
    });

    socket.on('message_read', (data) => {
      const { messageId, sessionId } = data;
      socket.to(`chat_${sessionId}`).emit('message_status_update', {
        messageId,
        status: 'read',
        userId: socket.userId
      });
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

// Notification functions for real-time updates
const notifyExpertApplicationSubmitted = (expertData) => {
  console.log('🚀 notifyExpertApplicationSubmitted called with:', expertData);
  if (!io) {
    console.error('❌ Socket.io instance not available for expert application notification');
    return;
  }

  // Get connected admins for debugging
  const adminRoom = io.sockets.adapter.rooms.get('admin_panel');
  const connectedAdmins = adminRoom ? adminRoom.size : 0;
  
  console.log(`📊 Admin panel room status:`, {
    roomName: 'admin_panel',
    connectedAdmins,
    hasRoom: !!adminRoom
  });
  
  if (connectedAdmins === 0) {
    console.warn('⚠️  No admins connected to admin_panel room - notification will not be delivered in real-time');
  }

  // Notify all admins about new expert application
  const notificationData = {
    expert: expertData,
    timestamp: new Date().toISOString(),
    type: 'new_application'
  };
  
  io.to('admin_panel').emit('expert_application_submitted', notificationData);
  
  console.log('✅ Expert application notification sent to admin_panel room:', {
    expertId: expertData.id,
    expertEmail: expertData.email,
    connectedAdmins,
    timestamp: notificationData.timestamp
  });
};

const notifyExpertStatusUpdate = (expertId, status, adminNotes) => {
  if (io) {
    // Notify specific expert about status change
    io.to(`expert_${expertId}`).emit('expert_status_updated', {
      status,
      adminNotes,
      timestamp: new Date().toISOString(),
      type: 'status_update'
    });
    
    // Also notify all admins about the status change
    io.to('admin_panel').emit('expert_status_changed', {
      expertId,
      status,
      adminNotes,
      timestamp: new Date().toISOString(),
      type: 'status_change'
    });
    
    console.log(`Notified expert ${expertId} of status update:`, status);
  }
};

const notifyAdminPanelUpdate = (data) => {
  if (io) {
    io.to('admin_panel').emit('admin_panel_update', {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
};

// Fix: Export the notification functions
module.exports = { 
  initializeSocket, 
  getIO, 
  notifyExpertApplicationSubmitted,
  notifyExpertStatusUpdate,
  notifyAdminPanelUpdate,
  // Ensure io instance is accessible for notifications
  get socketInstance() { return io; }
};