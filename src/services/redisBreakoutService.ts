// Redis service extensions for breakout rooms
export interface BreakoutRoom {
  id: string;
  name: string;
  topic?: string;
  description?: string;
  parentSessionId: string;
  createdBy: string;
  creatorAlias: string;
  facilitatorId: string;
  agoraChannelName: string;
  agoraToken: string;
  maxParticipants: number;
  isPrivate: boolean;
  requiresApproval: boolean;
  participants: Array<{
    id: string;
    alias: string;
    avatarIndex: number;
    joinedAt: string;
    leftAt?: string;
    role: 'facilitator' | 'participant';
  }>;
  currentParticipants: number;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
  endedAt?: string;
}

// Mock Redis operations for breakout rooms (replace with actual Redis in production)
const breakoutRoomsStore = new Map<string, BreakoutRoom>();
const sessionRoomsIndex = new Map<string, string[]>();

export const redisBreakoutService = {
  async setBreakoutRoom(roomId: string, roomData: BreakoutRoom, ttl: number): Promise<void> {
    breakoutRoomsStore.set(roomId, roomData);
    
    // Index by session
    const sessionRooms = sessionRoomsIndex.get(roomData.parentSessionId) || [];
    if (!sessionRooms.includes(roomId)) {
      sessionRooms.push(roomId);
      sessionRoomsIndex.set(roomData.parentSessionId, sessionRooms);
    }
    
    // Auto-expire (simplified)
    setTimeout(() => {
      breakoutRoomsStore.delete(roomId);
      const rooms = sessionRoomsIndex.get(roomData.parentSessionId) || [];
      const updatedRooms = rooms.filter(id => id !== roomId);
      if (updatedRooms.length === 0) {
        sessionRoomsIndex.delete(roomData.parentSessionId);
      } else {
        sessionRoomsIndex.set(roomData.parentSessionId, updatedRooms);
      }
    }, ttl * 1000);
  },

  async getBreakoutRoom(roomId: string): Promise<BreakoutRoom | null> {
    return breakoutRoomsStore.get(roomId) || null;
  },

  async getBreakoutRooms(sessionId: string): Promise<BreakoutRoom[]> {
    const roomIds = sessionRoomsIndex.get(sessionId) || [];
    const rooms: BreakoutRoom[] = [];
    
    for (const roomId of roomIds) {
      const room = breakoutRoomsStore.get(roomId);
      if (room) {
        rooms.push(room);
      }
    }
    
    return rooms;
  },

  async deleteBreakoutRoom(roomId: string): Promise<void> {
    const room = breakoutRoomsStore.get(roomId);
    if (room) {
      const sessionRooms = sessionRoomsIndex.get(room.parentSessionId) || [];
      const updatedRooms = sessionRooms.filter(id => id !== roomId);
      if (updatedRooms.length === 0) {
        sessionRoomsIndex.delete(room.parentSessionId);
      } else {
        sessionRoomsIndex.set(room.parentSessionId, updatedRooms);
      }
    }
    breakoutRoomsStore.delete(roomId);
  }
};