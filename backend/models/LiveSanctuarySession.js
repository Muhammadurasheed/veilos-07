const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const liveSanctuarySessionSchema = new mongoose.Schema({
  id: {
    type: String,
    default: () => `live-sanctuary-${nanoid(8)}`,
    unique: true,
    required: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  emoji: {
    type: String
  },
  hostId: {
    type: String
  },
  hostToken: {
    type: String
  },
  hostIp: {
    type: String
  },
  agoraChannelName: {
    type: String,
    required: true,
    unique: true
  },
  agoraToken: {
    type: String,
    required: true
  },
  maxParticipants: {
    type: Number,
    default: 50,
    min: 2,
    max: 200
  },
  currentParticipants: {
    type: Number,
    default: 0
  },
  allowAnonymous: {
    type: Boolean,
    default: true
  },
  audioOnly: {
    type: Boolean,
    default: true
  },
  moderationEnabled: {
    type: Boolean,
    default: true
  },
  emergencyContactEnabled: {
    type: Boolean,
    default: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  scheduledAt: {
    type: Date
  },
  participants: [{
    id: String,
    alias: String,
    isHost: { type: Boolean, default: false },
    isModerator: { type: Boolean, default: false },
    isMuted: { type: Boolean, default: false },
    isHostMuted: { type: Boolean, default: false }, // Host-enforced mute
    isBlocked: { type: Boolean, default: false },
    isKicked: { type: Boolean, default: false }, // Kicked by host
    handRaised: { type: Boolean, default: false },
    joinedAt: { type: Date, default: Date.now },
    avatarIndex: { type: Number, default: 1 },
    connectionStatus: { type: String, default: 'connected' },
    audioLevel: { type: Number, default: 0 },
    speakingTime: { type: Number, default: 0 }
  }],
  // Persistent moderation state
  hostMutedParticipants: [{ type: String }],
  bannedParticipants: [{ type: String }],
  hostAlias: {
    type: String
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'paused'],
    default: 'active'
  },
  isRecorded: {
    type: Boolean,
    default: false
  },
  recordingConsent: [{
    type: String
  }],
  breakoutRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BreakoutRoom'
  }],
  moderationLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  emergencyProtocols: {
    type: Boolean,
    default: true
  },
  aiMonitoring: {
    type: Boolean,
    default: true
  },
  estimatedDuration: {
    type: Number // in minutes
  },
  tags: [{
    type: String
  }],
  language: {
    type: String,
    default: 'en'
  }
});

// TTL index for auto-cleanup
liveSanctuarySessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('LiveSanctuarySession', liveSanctuarySessionSchema);