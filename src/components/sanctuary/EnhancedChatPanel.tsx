import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutoResizeTextarea } from '@/components/ui/auto-resize-textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, ChevronUp, Shield, AtSign, Paperclip, Reply } from 'lucide-react';
import { MediaPreviewModal } from './MediaPreviewModal';
import { chatMessageCache, type CachedMessage } from './ChatMessageCache';
import type { LiveParticipant } from '@/types/sanctuary';

interface ChatMessage {
  id: string;
  senderAlias: string;
  senderAvatarIndex: number;
  content: string;
  timestamp: Date;
  type: 'text' | 'system' | 'emoji-reaction' | 'media';
  mentions?: string[];
  attachment?: any;
  replyTo?: string;
}

interface EnhancedChatPanelProps {
  isVisible: boolean;
  onToggle: () => void;
  messages: ChatMessage[];
  participants: LiveParticipant[];
  currentUserAlias: string;
  sessionId: string;
  onSendMessage: (content: string, type?: 'text' | 'emoji-reaction' | 'media', attachment?: any, replyTo?: string) => void;
}

export const EnhancedChatPanel = ({
  isVisible,
  onToggle,
  messages,
  participants,
  currentUserAlias,
  sessionId,
  onSendMessage
}: EnhancedChatPanelProps) => {
  const [newMessage, setNewMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [cachedMessages, setCachedMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load cached messages on mount
  useEffect(() => {
    if (!sessionId) return;
    const cached = chatMessageCache.loadMessages(sessionId);
    if (cached.length > 0) {
      const hydrated = chatMessageCache.hydrateReplyChains(cached);
      const mapped: ChatMessage[] = hydrated.map(m => ({
        id: m.id,
        senderAlias: m.senderAlias,
        senderAvatarIndex: m.senderAvatarIndex,
        content: m.content,
        timestamp: new Date(m.timestamp),
        type: m.type,
        attachment: m.attachment,
        replyTo: m.replyTo
      }));
      setCachedMessages(mapped);
      console.log('📥 Cached messages restored:', mapped.length);
    }
  }, [sessionId]);

  // Cache messages when they change
  useEffect(() => {
    if (sessionId && messages.length > 0) {
      const cachableMessages: CachedMessage[] = messages.map(msg => ({
        id: msg.id,
        senderAlias: msg.senderAlias,
        senderAvatarIndex: msg.senderAvatarIndex,
        content: msg.content,
        timestamp: msg.timestamp.toISOString(),
        type: msg.type,
        attachment: msg.attachment,
        replyTo: msg.replyTo
      }));
      chatMessageCache.saveMessages(sessionId, cachableMessages);
    }
  }, [sessionId, messages]);

  // Auto-scroll chat messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const formatTime = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Handle @ mentions
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setNewMessage(value);
    setCursorPosition(position);

    // Check for @ mentions
    const textBeforeCursor = value.substring(0, position);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
    }
  };

  // Filter participants for mention suggestions
  const mentionSuggestions = participants.filter(p => 
    p.alias.toLowerCase().includes(mentionQuery.toLowerCase()) &&
    p.alias !== currentUserAlias
  ).slice(0, 5);

  // Insert mention
  const insertMention = (participantAlias: string) => {
    const textBeforeCursor = newMessage.substring(0, cursorPosition);
    const textAfterCursor = newMessage.substring(cursorPosition);
    const beforeMention = textBeforeCursor.replace(/@\w*$/, `@${participantAlias} `);
    
    setNewMessage(beforeMention + textAfterCursor);
    setShowSuggestions(false);
    setMentionQuery('');
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newPosition = beforeMention.length;
      inputRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() && !selectedFile) return;
    
    if (selectedFile) {
      // Handle file upload
      const reader = new FileReader();
      reader.onload = () => {
        onSendMessage(newMessage.trim() || `Shared ${selectedFile.type.startsWith('image/') ? 'image' : 'file'}: ${selectedFile.name}`, 'media', {
          file: reader.result,
          fileName: selectedFile.name,
          fileType: selectedFile.type,
          fileSize: selectedFile.size
        }, replyingTo?.id);
        setSelectedFile(null);
        setNewMessage('');
        setReplyingTo(null);
        setShowSuggestions(false);
        setMentionQuery('');
      };
      reader.readAsDataURL(selectedFile);
    } else {
      onSendMessage(newMessage.trim(), 'text', undefined, replyingTo?.id);
      setNewMessage('');
      setReplyingTo(null);
      setShowSuggestions(false);
      setMentionQuery('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Limit file size to 10MB
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setSelectedFile(file);
      setShowMediaPreview(true);
    }
    // Reset file input
    event.target.value = '';
  };

  const handleMediaSend = async (file: File, caption?: string) => {
    try {
      // Upload to backend Cloudinary endpoint for robust storage
      const formData = new FormData();
      formData.append('attachment', file);
      formData.append('participantAlias', currentUserAlias);
      if (caption) formData.append('content', caption);
      if (replyingTo?.id) formData.append('replyTo', replyingTo.id);

      const response = await fetch(`/api/flagship-chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || localStorage.getItem('veilo-auth-token') || localStorage.getItem('token')}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Media uploaded successfully via backend:', result);
        // Backend will emit the message via socket, so we don't need to call onSendMessage
      } else {
        console.warn('⚠️ Backend upload failed, falling back to base64...');
        // Fallback to base64 method
        const reader = new FileReader();
        reader.onload = () => {
          onSendMessage(caption || `Shared ${file.type.startsWith('image/') ? 'image' : 'file'}: ${file.name}`, 'media', {
            file: reader.result,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size
          }, replyingTo?.id);
        };
        reader.readAsDataURL(file);
      }
      
      setSelectedFile(null);
      setShowMediaPreview(false);
      setReplyingTo(null);
    } catch (error) {
      console.error('❌ Media upload error:', error);
      
      // Fallback to base64 method
      const reader = new FileReader();
      reader.onload = () => {
        onSendMessage(caption || `Shared ${file.type.startsWith('image/') ? 'image' : 'file'}: ${file.name}`, 'media', {
          file: reader.result,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        }, replyingTo?.id);
        setSelectedFile(null);
        setShowMediaPreview(false);
        setReplyingTo(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showSuggestions && mentionSuggestions.length > 0) {
        insertMention(mentionSuggestions[0].alias);
      } else {
        handleSendMessage();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleReplyToMessage = (message: ChatMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const handleDoubleClick = (message: ChatMessage) => {
    if (message.type === 'text' || message.type === 'media') {
      handleReplyToMessage(message);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    if (message.type === 'system') {
      return (
        <div className="text-center">
          <Badge variant="outline" className="text-xs">
            <Shield className="h-3 w-3 mr-1" />
            {message.content}
          </Badge>
        </div>
      );
    }

    if (message.type === 'emoji-reaction') {
      return (
        <div className="text-center">
          <span className="text-2xl">{message.content}</span>
          <div className="text-xs text-muted-foreground">
            {message.senderAlias} • {formatTime(message.timestamp)}
          </div>
        </div>
      );
    }

    if (message.type === 'media' && message.attachment) {
      return (
        <div 
          className="flex items-start space-x-2 hover:bg-muted/30 p-1 rounded cursor-pointer group"
          onDoubleClick={() => handleDoubleClick(message)}
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={`/avatars/avatar-${message.senderAvatarIndex}.svg`} />
            <AvatarFallback className="text-xs">
              {message.senderAlias.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <span className="text-xs font-medium truncate">
                {message.senderAlias}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatTime(message.timestamp)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
                onClick={() => handleReplyToMessage(message)}
              >
                <Reply className="h-3 w-3" />
              </Button>
            </div>
            {message.replyTo && (
              <div className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 mb-1">
                ↳ Replying to previous message
              </div>
            )}
            <div className="bg-muted rounded p-2 mt-1 overflow-hidden">
              {message.attachment.fileType?.startsWith('image/') ? (
                <img 
                  src={message.attachment.file || message.attachment.url || message.attachment.preview} 
                  alt={message.attachment.fileName || 'Shared image'}
                  className="max-w-xs rounded cursor-pointer"
                  onClick={() => {
                    // Open image in new tab for full view
                    const img = new Image();
                    img.src = message.attachment.file || message.attachment.url || message.attachment.preview;
                    const newWindow = window.open();
                    newWindow?.document.write(`<img src="${img.src}" style="max-width:100%;height:auto;" />`);
                  }}
                />
              ) : (
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-muted-foreground/10 rounded p-1"
                     onClick={() => {
                       // Handle file download
                       if (message.attachment.file) {
                         const link = document.createElement('a');
                         link.href = message.attachment.file;
                         link.download = message.attachment.fileName || 'file';
                         link.click();
                       }
                     }}>
                  <span className="text-lg">📎</span>
                  <div>
                    <span className="text-sm font-medium">{message.attachment.fileName}</span>
                    <div className="text-xs text-muted-foreground">
                      {message.attachment.fileSize ? `${(message.attachment.fileSize / 1024).toFixed(1)} KB` : 'File'}
                    </div>
                  </div>
                </div>
              )}
              {message.content && (
                <div className="text-sm mt-1">{message.content}</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Highlight mentions in text messages
    const highlightMentions = (text: string) => {
      return text.replace(/@(\w+)/g, (match, username) => {
        const isCurrentUser = username === currentUserAlias;
        return `<span class="bg-primary/20 text-primary font-medium px-1 rounded ${
          isCurrentUser ? 'bg-accent/30 text-accent-foreground' : ''
        }">${match}</span>`;
      });
    };

    return (
      <div 
        className="flex items-start space-x-2 hover:bg-muted/30 p-1 rounded cursor-pointer group"
        onDoubleClick={() => handleDoubleClick(message)}
      >
        <Avatar className="h-6 w-6">
          <AvatarImage src={`/avatars/avatar-${message.senderAvatarIndex}.svg`} />
          <AvatarFallback className="text-xs">
            {message.senderAlias.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1">
            <span className="text-xs font-medium truncate">
              {message.senderAlias}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTime(message.timestamp)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100"
              onClick={() => handleReplyToMessage(message)}
            >
              <Reply className="h-3 w-3" />
            </Button>
          </div>
          {message.replyTo && (
            <div className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-2 mb-1">
              ↳ Replying to previous message
            </div>
          )}
          <div 
            className="text-sm break-words"
            dangerouslySetInnerHTML={{ __html: highlightMentions(message.content) }}
          />
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-lg">
          <span>Chat</span>
          <Button variant="ghost" size="sm" onClick={onToggle}>
            <ChevronUp className="h-4 w-4" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Messages Container with Fixed Height */}
        <div className="h-64 overflow-y-auto overflow-x-hidden space-y-3 px-4 pb-3">
          {(messages.length > 0 ? messages : cachedMessages).map((message) => (
            <div key={message.id} className="space-y-1">
              {renderMessage(message)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Mention Suggestions */}
        {showSuggestions && mentionSuggestions.length > 0 && (
          <div className="border-t border-b bg-muted/50 p-2">
            <div className="text-xs text-muted-foreground mb-2 flex items-center">
              <AtSign className="h-3 w-3 mr-1" />
              Participants
            </div>
            <div className="space-y-1">
              {mentionSuggestions.map((participant) => (
                <button
                  key={participant.id}
                  onClick={() => insertMention(participant.alias)}
                  className="w-full text-left p-2 rounded hover:bg-muted/80 transition-colors flex items-center space-x-2"
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={`/avatars/avatar-${participant.avatarIndex || 1}.svg`} />
                    <AvatarFallback className="text-xs">
                      {participant.alias.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{participant.alias}</span>
                  {participant.isHost && (
                    <Badge variant="secondary" className="text-xs px-1 py-0">Host</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Media Preview Modal */}
        <MediaPreviewModal
          isOpen={showMediaPreview}
          onClose={() => {
            setShowMediaPreview(false);
            setSelectedFile(null);
          }}
          file={selectedFile}
          onSend={handleMediaSend}
        />

        {/* Message Input with Enhanced Features */}
        <div className="border-t p-3">
          {/* Reply indicator */}
          {replyingTo && (
            <div className="bg-muted/50 p-2 text-xs border-l-2 border-primary/30 mb-2">
              <div className="flex items-center justify-between">
                <span>
                  ↳ Replying to <strong>{replyingTo.senderAlias}</strong>: 
                  {replyingTo.content.length > 50 
                    ? `${replyingTo.content.substring(0, 50)}...` 
                    : replyingTo.content
                  }
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0"
                  onClick={() => setReplyingTo(null)}
                >
                  ×
                </Button>
              </div>
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-muted-foreground hover:text-primary"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept="image/*,.pdf,.doc,.docx,.txt"
              className="hidden"
            />
            <div className="relative flex-1">
              <AutoResizeTextarea
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyPress}
                placeholder={replyingTo ? "Reply to message... (Shift+Enter for new line)" : "Type @ to mention someone... (Shift+Enter for new line)"}
                minRows={1}
                maxRows={4}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() && !selectedFile}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};