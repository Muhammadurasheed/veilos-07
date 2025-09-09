const redis = require('redis');

class RedisService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  async connect() {
    if (this.isConnected) return this.client;

    try {
      // Create Redis client with cloud configuration
      this.client = redis.createClient({
        url: process.env.REDIS_URL,
        socket: {
          reconnectStrategy: (retries) => {
            console.log(`🔄 Redis reconnect attempt ${retries}`);
            return Math.min(retries * 50, 500);
          },
          connectTimeout: 10000,
          lazyConnect: true
        },
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('❌ Redis server refused connection');
            return 5000;
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('❌ Redis retry time exhausted');
            return null;
          }
          if (options.attempt > 10) {
            console.error('❌ Redis max attempts reached');
            return null;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      // Event handlers
      this.client.on('connect', () => {
        console.log('🟢 Redis client connecting...');
      });

      this.client.on('ready', () => {
        console.log('✅ Redis client ready');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('error', (err) => {
        console.error('❌ Redis client error:', err.message);
        this.isConnected = false;
      });

      this.client.on('end', () => {
        console.log('🔴 Redis client disconnected');
        this.isConnected = false;
      });

      // Connect to Redis
      await this.client.connect();
      return this.client;

    } catch (error) {
      console.error('❌ Redis connection failed:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      console.log('🔴 Redis client disconnected');
    }
  }

  // Session State Management
  async setSessionState(sessionId, state, expireSeconds = 3600) {
    try {
      if (!this.isConnected) return false;
      
      const key = `session:${sessionId}`;
      await this.client.setEx(key, expireSeconds, JSON.stringify(state));
      console.log(`💾 Session state saved: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis setSessionState error:', error);
      return false;
    }
  }

  async getSessionState(sessionId) {
    try {
      if (!this.isConnected) return null;
      
      const key = `session:${sessionId}`;
      const state = await this.client.get(key);
      return state ? JSON.parse(state) : null;
    } catch (error) {
      console.error('❌ Redis getSessionState error:', error);
      return null;
    }
  }

  async deleteSessionState(sessionId) {
    try {
      if (!this.isConnected) return false;
      
      const key = `session:${sessionId}`;
      await this.client.del(key);
      console.log(`🗑️ Session state deleted: ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis deleteSessionState error:', error);
      return false;
    }
  }

  // Participant Management
  async addParticipant(sessionId, participant) {
    try {
      if (!this.isConnected) return false;
      
      const key = `participants:${sessionId}`;
      await this.client.hSet(key, participant.id, JSON.stringify(participant));
      await this.client.expire(key, 3600); // Expire in 1 hour
      
      console.log(`👤 Participant added: ${participant.id} to ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis addParticipant error:', error);
      return false;
    }
  }

  async removeParticipant(sessionId, participantId) {
    try {
      if (!this.isConnected) return false;
      
      const key = `participants:${sessionId}`;
      await this.client.hDel(key, participantId);
      
      console.log(`👤 Participant removed: ${participantId} from ${sessionId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis removeParticipant error:', error);
      return false;
    }
  }

  async getParticipants(sessionId) {
    try {
      if (!this.isConnected) return [];
      
      const key = `participants:${sessionId}`;
      const participants = await this.client.hGetAll(key);
      
      return Object.values(participants).map(p => JSON.parse(p));
    } catch (error) {
      console.error('❌ Redis getParticipants error:', error);
      return [];
    }
  }

  // Real-time Event Broadcasting
  async publishEvent(channel, event, data) {
    try {
      if (!this.isConnected) return false;
      
      const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
      await this.client.publish(channel, message);
      
      console.log(`📡 Event published to ${channel}: ${event}`);
      return true;
    } catch (error) {
      console.error('❌ Redis publishEvent error:', error);
      return false;
    }
  }

  async subscribeToEvents(channel, callback) {
    try {
      if (!this.isConnected) return false;
      
      const subscriber = this.client.duplicate();
      await subscriber.connect();
      
      await subscriber.subscribe(channel, (message) => {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          console.error('❌ Redis message parse error:', error);
        }
      });
      
      console.log(`📡 Subscribed to channel: ${channel}`);
      return subscriber;
    } catch (error) {
      console.error('❌ Redis subscribeToEvents error:', error);
      return null;
    }
  }

  // Voice Chat Queue Management
  async addToVoiceQueue(sessionId, participantId, priority = 0) {
    try {
      if (!this.isConnected) return false;
      
      const key = `voice_queue:${sessionId}`;
      await this.client.zAdd(key, [{ score: priority, value: participantId }]);
      await this.client.expire(key, 3600);
      
      console.log(`🎤 Added to voice queue: ${participantId} (priority: ${priority})`);
      return true;
    } catch (error) {
      console.error('❌ Redis addToVoiceQueue error:', error);
      return false;
    }
  }

  async getVoiceQueue(sessionId) {
    try {
      if (!this.isConnected) return [];
      
      const key = `voice_queue:${sessionId}`;
      return await this.client.zRange(key, 0, -1);
    } catch (error) {
      console.error('❌ Redis getVoiceQueue error:', error);
      return [];
    }
  }

  async removeFromVoiceQueue(sessionId, participantId) {
    try {
      if (!this.isConnected) return false;
      
      const key = `voice_queue:${sessionId}`;
      await this.client.zRem(key, participantId);
      
      console.log(`🎤 Removed from voice queue: ${participantId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis removeFromVoiceQueue error:', error);
      return false;
    }
  }

  // Session Analytics
  async incrementCounter(key, field, increment = 1) {
    try {
      if (!this.isConnected) return false;
      
      await this.client.hIncrBy(key, field, increment);
      await this.client.expire(key, 86400); // Expire in 24 hours
      return true;
    } catch (error) {
      console.error('❌ Redis incrementCounter error:', error);
      return false;
    }
  }

  async getCounters(key) {
    try {
      if (!this.isConnected) return {};
      
      return await this.client.hGetAll(key);
    } catch (error) {
      console.error('❌ Redis getCounters error:', error);
      return {};
    }
  }

  // ============================
  // BREAKOUT ROOM METHODS
  // ============================
  
  async setBreakoutRoom(roomId, roomData, ttl) {
    try {
      if (!this.isConnected) return false;
      
      const key = `breakout:${roomId}`;
      await this.client.setEx(key, ttl, JSON.stringify(roomData));
      
      // Index by session
      const sessionKey = `session:${roomData.parentSessionId}:breakouts`;
      await this.client.sAdd(sessionKey, roomId);
      await this.client.expire(sessionKey, ttl);
      
      console.log(`💾 Breakout room saved: ${roomId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis setBreakoutRoom error:', error);
      return false;
    }
  }

  async getBreakoutRoom(roomId) {
    try {
      if (!this.isConnected) return null;
      
      const key = `breakout:${roomId}`;
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('❌ Redis getBreakoutRoom error:', error);
      return null;
    }
  }

  async getBreakoutRooms(sessionId) {
    try {
      if (!this.isConnected) return [];
      
      const sessionKey = `session:${sessionId}:breakouts`;
      const roomIds = await this.client.sMembers(sessionKey);
      const rooms = [];
      
      for (const roomId of roomIds) {
        const roomData = await this.getBreakoutRoom(roomId);
        if (roomData && roomData.isActive) {
          rooms.push(roomData);
        } else if (!roomData) {
          // Clean up orphaned room ID
          await this.client.sRem(sessionKey, roomId);
        }
      }
      
      console.log(`📋 Retrieved ${rooms.length} breakout rooms for session ${sessionId}`);
      return rooms;
    } catch (error) {
      console.error('❌ Redis getBreakoutRooms error:', error);
      return [];
    }
  }

  async deleteBreakoutRoom(roomId) {
    try {
      if (!this.isConnected) return false;
      
      const roomData = await this.getBreakoutRoom(roomId);
      if (roomData) {
        const sessionKey = `session:${roomData.parentSessionId}:breakouts`;
        await this.client.sRem(sessionKey, roomId);
      }
      
      const key = `breakout:${roomId}`;
      await this.client.del(key);
      
      console.log(`🗑️ Breakout room deleted: ${roomId}`);
      return true;
    } catch (error) {
      console.error('❌ Redis deleteBreakoutRoom error:', error);
      return false;
    }
  }
}

// Create singleton instance
const redisService = new RedisService();

// Initialize Redis connection
if (process.env.REDIS_ENABLED === 'true') {
  redisService.connect().catch(error => {
    console.error('❌ Failed to initialize Redis:', error.message);
  });
}

module.exports = redisService;