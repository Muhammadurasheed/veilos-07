// Session State Manager for persistent host actions
interface SessionState {
  sessionId: string;
  mutedParticipants: string[];
  kickedParticipants: string[];
  lastUpdated: string;
}

class SessionStateManager {
  private readonly CACHE_KEY_PREFIX = 'session_state_';
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  getCacheKey(sessionId: string): string {
    return `${this.CACHE_KEY_PREFIX}${sessionId}`;
  }

  saveSessionState(sessionId: string, mutedParticipants: string[], kickedParticipants: string[]): void {
    try {
      const state: SessionState = {
        sessionId,
        mutedParticipants,
        kickedParticipants,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.getCacheKey(sessionId), JSON.stringify(state));
      console.log('💾 Session state saved:', state);
    } catch (error) {
      console.warn('Failed to save session state:', error);
    }
  }

  loadSessionState(sessionId: string): SessionState | null {
    try {
      const stateData = localStorage.getItem(this.getCacheKey(sessionId));
      if (!stateData) return null;

      const state: SessionState = JSON.parse(stateData);
      
      // Check if cache is expired
      const cacheAge = Date.now() - new Date(state.lastUpdated).getTime();
      if (cacheAge > this.CACHE_EXPIRY) {
        this.clearSessionState(sessionId);
        return null;
      }

      console.log('📖 Session state loaded:', state);
      return state;
    } catch (error) {
      console.warn('Failed to load session state:', error);
      return null;
    }
  }

  addMutedParticipant(sessionId: string, participantId: string): void {
    const state = this.loadSessionState(sessionId) || {
      sessionId,
      mutedParticipants: [],
      kickedParticipants: [],
      lastUpdated: new Date().toISOString()
    };
    
    if (!state.mutedParticipants.includes(participantId)) {
      state.mutedParticipants.push(participantId);
      this.saveSessionState(sessionId, state.mutedParticipants, state.kickedParticipants);
    }
  }

  removeMutedParticipant(sessionId: string, participantId: string): void {
    const state = this.loadSessionState(sessionId);
    if (state) {
      state.mutedParticipants = state.mutedParticipants.filter(id => id !== participantId);
      this.saveSessionState(sessionId, state.mutedParticipants, state.kickedParticipants);
    }
  }

  addKickedParticipant(sessionId: string, participantId: string): void {
    const state = this.loadSessionState(sessionId) || {
      sessionId,
      mutedParticipants: [],
      kickedParticipants: [],
      lastUpdated: new Date().toISOString()
    };
    
    if (!state.kickedParticipants.includes(participantId)) {
      state.kickedParticipants.push(participantId);
      this.saveSessionState(sessionId, state.mutedParticipants, state.kickedParticipants);
    }
  }

  isParticipantMuted(sessionId: string, participantId: string): boolean {
    const state = this.loadSessionState(sessionId);
    return state ? state.mutedParticipants.includes(participantId) : false;
  }

  isParticipantKicked(sessionId: string, participantId: string): boolean {
    const state = this.loadSessionState(sessionId);
    return state ? state.kickedParticipants.includes(participantId) : false;
  }

  clearSessionState(sessionId: string): void {
    localStorage.removeItem(this.getCacheKey(sessionId));
  }

  clearAllSessionStates(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.CACHE_KEY_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
}

export const sessionStateManager = new SessionStateManager();
export type { SessionState };