// Chat message cache for session persistence
interface CachedMessage {
  id: string;
  senderAlias: string;
  senderAvatarIndex: number;
  content: string;
  timestamp: string;
  type: 'text' | 'system' | 'emoji-reaction' | 'media';
  attachment?: any;
  replyTo?: string;
  replyToMessage?: CachedMessage; // Store full reply context
}

interface MessageCache {
  sessionId: string;
  messages: CachedMessage[];
  lastUpdated: string;
}

class ChatMessageCacheManager {
  private readonly CACHE_KEY_PREFIX = 'chat_messages_';
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  getCacheKey(sessionId: string): string {
    return `${this.CACHE_KEY_PREFIX}${sessionId}`;
  }

  saveMessages(sessionId: string, messages: CachedMessage[]): void {
    try {
      const cache: MessageCache = {
        sessionId,
        messages,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.getCacheKey(sessionId), JSON.stringify(cache));
    } catch (error) {
      console.warn('Failed to cache messages:', error);
    }
  }

  loadMessages(sessionId: string): CachedMessage[] {
    try {
      const cacheData = localStorage.getItem(this.getCacheKey(sessionId));
      if (!cacheData) return [];

      const cache: MessageCache = JSON.parse(cacheData);
      
      // Check if cache is expired
      const cacheAge = Date.now() - new Date(cache.lastUpdated).getTime();
      if (cacheAge > this.CACHE_EXPIRY) {
        this.clearMessages(sessionId);
        return [];
      }

      return cache.messages || [];
    } catch (error) {
      console.warn('Failed to load cached messages:', error);
      return [];
    }
  }

  addMessage(sessionId: string, message: CachedMessage): void {
    const existingMessages = this.loadMessages(sessionId);
    const exists = existingMessages.find(m => m.id === message.id);
    
    if (!exists) {
      // If this is a reply, find and attach the parent message
      if (message.replyTo) {
        const parentMessage = existingMessages.find(m => m.id === message.replyTo);
        if (parentMessage) {
          message.replyToMessage = parentMessage;
        }
      }
      
      const updatedMessages = [...existingMessages, message];
      this.saveMessages(sessionId, updatedMessages);
    }
  }

  // Update reply chains when loading from cache
  hydrateReplyChains(messages: CachedMessage[]): CachedMessage[] {
    return messages.map(message => {
      if (message.replyTo && !message.replyToMessage) {
        const parentMessage = messages.find(m => m.id === message.replyTo);
        if (parentMessage) {
          return { ...message, replyToMessage: parentMessage };
        }
      }
      return message;
    });
  }

  clearMessages(sessionId: string): void {
    localStorage.removeItem(this.getCacheKey(sessionId));
  }

  clearAllCache(): void {
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.CACHE_KEY_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
}

export const chatMessageCache = new ChatMessageCacheManager();
export type { CachedMessage };