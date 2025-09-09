import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, Shield, Users, AtSign, Reply, Paperclip, Image as ImageIcon } from 'lucide-react';
import { useSocket } from '@/hooks/useSocket';
import type { SanctuaryMessage } from '@/types';

interface EnhancedRealTimeChatProps {
  sessionId: string;
  participant: {
    id: string;
    alias: string;
    avatarIndex?: number;
  } | null;
  participants: Array<{
    id: string;
    alias: string;
    avatarIndex?: number;
    isHost?: boolean;
    isModerator?: boolean;
  }>;
  isHost?: boolean;
  className?: string;
  isVisible?: boolean;
  onToggle?: () => void;
}

interface ChatMessage extends SanctuaryMessage {
  senderAlias?: string;
  senderAvatarIndex?: number;
  replyTo?: string;
  attachment?: {
    file?: string;
    fileName?: string;
    fileType?: string;
    fileSize?: number;
    url?: string;
  };
}

export const EnhancedRealTimeChat: React.FC<EnhancedRealTimeChatProps> = ({
  sessionId,
  participant,
  participants = [],
  isHost = false,
  className = "",
  isVisible = true,
  onToggle
}) => {
  const { toast } = useToast();
  const { socket, isConnected } = useSocket();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [participantCount, setParticipantCount] = useState(participants.length);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket event handlers
  useEffect(() => {
    if (!socket || !sessionId || !participant) return;

    // Join the flagship sanctuary chat
    socket.emit('join_flagship_sanctuary', {
      sessionId,
      participant: {
        id: participant.id,
        alias: participant.alias,
        avatarIndex: participant.avatarIndex || 1
      }
    });

    // Listen for new messages
    const handleNewMessage = (message: ChatMessage) => {
      setMessages(prev => [...prev, {
        ...message,
        timestamp: new Date(message.timestamp || Date.now()).toISOString()
      }]);
    };

    // Listen for typing indicators
    const handleUserTyping = (data: { userId: string; userAlias: string; isTyping: boolean }) => {
      if (data.userId === participant.id) return; // Don't show own typing
      
      setTypingUsers(prev => {
        if (data.isTyping) {
          return prev.includes(data.userAlias) ? prev : [...prev, data.userAlias];
        } else {
          return prev.filter(user => user !== data.userAlias);
        }
      });
    };

    // Listen for participant updates
    const handleParticipantJoined = (data: any) => {
      setParticipantCount(data.totalParticipants || participantCount + 1);
      addSystemMessage(`${data.participant?.alias || 'Someone'} joined the session`);
    };

    const handleParticipantLeft = (data: any) => {
      setParticipantCount(prev => Math.max(0, prev - 1));
      addSystemMessage(`${data.participantAlias || 'Someone'} left the session`);
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('participant_joined', handleParticipantJoined);
    socket.on('participant_left', handleParticipantLeft);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('participant_joined', handleParticipantJoined);
      socket.off('participant_left', handleParticipantLeft);
    };
  }, [socket, sessionId, participant, participantCount]);

  const addSystemMessage = (content: string) => {
    const message: ChatMessage = {
      id: `system-${Date.now()}`,
      participantId: "system",
      participantAlias: "System",
      content,
      timestamp: new Date().toISOString(),
      type: "system"
    };
    setMessages(prev => [...prev, message]);
  };

  // Handle input changes with mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    
    setNewMessage(value);
    setCursorPosition(position);

    // Auto-resize textarea with proper overflow handling
    e.target.style.height = 'auto';
    const newHeight = Math.min(e.target.scrollHeight, 120);
    e.target.style.height = newHeight + 'px';
    
    // Handle overflow for long content
    if (e.target.scrollHeight > 120) {
      e.target.style.overflowY = 'auto';
    } else {
      e.target.style.overflowY = 'hidden';
    }

    // Handle typing indicator
    if (socket && !isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', { sessionId });
    }

    // Clear existing typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && isTyping) {
        setIsTyping(false);
        socket.emit('typing_stop', { sessionId });
      }
    }, 2000);

    // Check for @ mentions
    const textBeforeCursor = value.substring(0, position);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  // Filter participants for mention suggestions
  const mentionSuggestions = participants.filter(p => 
    p.alias.toLowerCase().includes(mentionQuery.toLowerCase()) &&
    p.alias !== participant?.alias
  ).slice(0, 5);

  // Insert mention
  const insertMention = (participantAlias: string) => {
    const textBeforeCursor = newMessage.substring(0, cursorPosition);
    const textAfterCursor = newMessage.substring(cursorPosition);
    const beforeMention = textBeforeCursor.replace(/@\w*$/, `@${participantAlias} `);
    
    setNewMessage(beforeMention + textAfterCursor);
    setShowMentions(false);
    setMentionQuery('');
    
    // Focus back to input
    setTimeout(() => {
      inputRef.current?.focus();
      const newPosition = beforeMention.length;
      inputRef.current?.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !participant || !socket) return;

    // Clear typing indicator
    if (isTyping) {
      setIsTyping(false);
      socket.emit('typing_stop', { sessionId });
    }

    // Send message via socket
    socket.emit('flagship_send_message', {
      sessionId,
      content: newMessage.trim(),
      type: 'text',
      replyTo: replyingTo?.id
    });

    setNewMessage('');
    setReplyingTo(null);
    setShowMentions(false);
    setMentionQuery('');
    
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !socket || !participant) return;

    // Limit file size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "File size must be less than 10MB",
        variant: "destructive"
      });
      return;
    }

    // Read file as base64 for transmission
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('flagship_send_message', {
        sessionId,
        content: `Shared ${file.type.startsWith('image/') ? 'image' : 'file'}: ${file.name}`,
        type: 'media',
        attachment: {
          file: reader.result,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        },
        replyTo: replyingTo?.id
      });

      setReplyingTo(null);
      toast({
        title: "File Sent",
        description: `${file.name} has been shared`,
      });
    };
    reader.readAsDataURL(file);
    
    // Reset file input
    event.target.value = '';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showMentions && mentionSuggestions.length > 0) {
        insertMention(mentionSuggestions[0].alias);
      } else {
        handleSendMessage();
      }
    } else if (e.key === 'Escape') {
      setShowMentions(false);
      setReplyingTo(null);
    }
  };

  const handleReplyToMessage = (message: ChatMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const formatTime = (timestamp: string): string => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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

    if (message.attachment) {
      return (
        <div className="flex items-start space-x-2 hover:bg-muted/30 p-2 rounded group">
          <Avatar className="h-6 w-6 flex-shrink-0">
            <AvatarImage src={`/avatars/avatar-${message.senderAvatarIndex || 1}.svg`} />
            <AvatarFallback className="text-xs">
              {(message.senderAlias || message.participantAlias || 'U').substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1 mb-1">
              <span className="text-xs font-medium truncate">
                {message.senderAlias || message.participantAlias}
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
            
            <div className="bg-muted rounded p-2 max-w-xs">
              {message.attachment.fileType?.startsWith('image/') ? (
                <img 
                  src={message.attachment.file || message.attachment.url} 
                  alt={message.attachment.fileName || 'Shared image'}
                  className="max-w-full rounded cursor-pointer"
                  onClick={() => {
                    const img = new Image();
                    img.src = message.attachment.file || message.attachment.url;
                    const newWindow = window.open();
                    if (newWindow) {
                      newWindow.document.write(`<img src="${img.src}" style="max-width:100%;height:auto;" />`);
                    }
                  }}
                />
              ) : (
                <div className="flex items-center space-x-2 cursor-pointer hover:bg-muted-foreground/10 rounded p-1"
                     onClick={() => {
                       if (message.attachment.file) {
                         const link = document.createElement('a');
                         link.href = message.attachment.file;
                         link.download = message.attachment.fileName || 'file';
                         link.click();
                       }
                     }}>
                  <Paperclip className="h-4 w-4" />
                  <div>
                    <span className="text-sm font-medium">{message.attachment.fileName}</span>
                    <div className="text-xs text-muted-foreground">
                      {message.attachment.fileSize ? `${(message.attachment.fileSize / 1024).toFixed(1)} KB` : 'File'}
                    </div>
                  </div>
                </div>
              )}
              {message.content && message.content !== `Shared ${message.attachment.fileType?.startsWith('image/') ? 'image' : 'file'}: ${message.attachment.fileName}` && (
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
        const isCurrentUser = username === participant?.alias;
        return `<span class="bg-primary/20 text-primary font-medium px-1 rounded ${
          isCurrentUser ? 'bg-accent/30 text-accent-foreground' : ''
        }">${match}</span>`;
      });
    };

    return (
      <div className="flex items-start space-x-2 hover:bg-muted/30 p-2 rounded group">
        <Avatar className="h-6 w-6 flex-shrink-0">
          <AvatarImage src={`/avatars/avatar-${message.senderAvatarIndex || 1}.svg`} />
          <AvatarFallback className="text-xs">
            {(message.senderAlias || message.participantAlias || 'U').substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-1 mb-1">
            <span className="text-xs font-medium truncate">
              {message.senderAlias || message.participantAlias}
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
            className="text-sm break-words overflow-wrap-anywhere"
            dangerouslySetInnerHTML={{ __html: highlightMentions(message.content) }}
          />
        </div>
      </div>
    );
  };

  if (!isVisible) return null;

  if (!participant) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Join the sanctuary to start chatting</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            <span>Live Chat</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={isConnected ? "default" : "secondary"} className="text-xs">
              {isConnected ? "Connected" : "Connecting..."}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Users className="h-3 w-3 mr-1" />
              {participantCount}
            </Badge>
            {onToggle && (
              <Button variant="ghost" size="sm" onClick={onToggle}>
                ✕
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Messages Area with improved scrolling */}
        <div className="h-80 overflow-y-auto overflow-x-hidden space-y-2 px-1">
          {messages.map((message) => (
            <div key={message.id}>
              {renderMessage(message)}
            </div>
          ))}
          
          {/* Typing indicators */}
          {typingUsers.length > 0 && (
            <div className="text-xs text-muted-foreground px-2">
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Mention Suggestions */}
        {showMentions && mentionSuggestions.length > 0 && (
          <div className="border border-border rounded bg-background p-2 shadow-md">
            <div className="text-xs text-muted-foreground mb-2 flex items-center">
              <AtSign className="h-3 w-3 mr-1" />
              Mention participants
            </div>
            <div className="space-y-1">
              {mentionSuggestions.map((participant) => (
                <button
                  key={participant.id}
                  onClick={() => insertMention(participant.alias)}
                  className="w-full text-left p-2 rounded hover:bg-muted transition-colors flex items-center space-x-2"
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

        {/* Reply indicator */}
        {replyingTo && (
          <div className="flex items-center justify-between bg-muted/50 p-2 rounded">
            <div className="text-sm">
              <span className="text-muted-foreground">Replying to </span>
              <span className="font-medium">{replyingTo.senderAlias || replyingTo.participantAlias}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
              ✕
            </Button>
          </div>
        )}

        {/* Message Input - Improved with wrapping */}
        <div className="space-y-2">
          <div className="flex items-end space-x-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Type your message... (@ to mention, Enter to send)"
                className="w-full min-h-[40px] max-h-[120px] resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 overflow-y-auto"
                disabled={!isConnected}
                rows={1}
                style={{ 
                  wordBreak: 'break-word',
                  overflowWrap: 'break-word',
                  whiteSpace: 'pre-wrap'
                }}
              />
            </div>
            
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={!isConnected}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              
              <Button
                onClick={handleSendMessage}
                disabled={!newMessage.trim() || !isConnected}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {!isConnected && (
            <div className="text-center text-xs text-muted-foreground">
              Connecting to chat server...
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />
      </CardContent>
    </Card>
  );
};