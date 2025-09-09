import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Image as ImageIcon, 
  Smile, 
  MoreVertical,
  Heart,
  ThumbsUp,
  Laugh,
  Frown,
  AlertTriangle,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

interface Message {
  id: string;
  userId: string;
  alias: string;
  avatar?: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'emoji-reaction';
  attachment?: {
    type: 'image' | 'file';
    url: string;
    name: string;
    size?: number;
  };
  reactions?: {
    [emoji: string]: string[]; // emoji -> array of user IDs
  };
}

interface EnhancedChatWithAutoResizeProps {
  sessionId: string;
  currentUser: {
    id: string;
    alias: string;
    avatar?: string;
  };
  messages: Message[];
  onSendMessage: (content: string, attachment?: File) => void;
  onReaction: (messageId: string, emoji: string) => void;
}

const emojiReactions = [
  { emoji: '❤️', icon: Heart, label: 'Love' },
  { emoji: '👍', icon: ThumbsUp, label: 'Like' },
  { emoji: '😂', icon: Laugh, label: 'Funny' },
  { emoji: '😢', icon: Frown, label: 'Sad' },
  { emoji: '😠', icon: AlertTriangle, label: 'Angry' },
  { emoji: '😲', icon: Zap, label: 'Surprised' }
];

export const EnhancedChatWithAutoResize = ({ 
  sessionId, 
  currentUser, 
  messages, 
  onSendMessage, 
  onReaction 
}: EnhancedChatWithAutoResizeProps) => {
  const { toast } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea functionality
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate new height (max 150px to prevent too tall)
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Adjust height when input value changes
  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((!inputValue.trim() && !selectedFile) || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSendMessage(inputValue.trim(), selectedFile || undefined);
      setInputValue('');
      setSelectedFile(null);
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast({
        title: "Failed to send message",
        description: "Please try again",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 10MB",
          variant: "destructive"
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleReaction = (messageId: string, emoji: string) => {
    onReaction(messageId, emoji);
  };

  const getReactionCount = (message: Message, emoji: string) => {
    return message.reactions?.[emoji]?.length || 0;
  };

  const hasUserReacted = (message: Message, emoji: string) => {
    return message.reactions?.[emoji]?.includes(currentUser.id) || false;
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Live Chat</CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4 mb-4">
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -20, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${message.userId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[75%] ${message.userId === currentUser.id ? 'order-1' : 'order-2'}`}>
                    {/* Message bubble */}
                    <div 
                      className={`rounded-lg p-3 ${
                        message.userId === currentUser.id 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted'
                      }`}
                    >
                      {/* User info */}
                      {message.userId !== currentUser.id && (
                        <div className="flex items-center space-x-2 mb-1">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={message.avatar} />
                            <AvatarFallback className="text-xs">
                              {message.alias.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-medium">{message.alias}</span>
                        </div>
                      )}

                      {/* Message content */}
                      {message.type === 'text' && (
                        <div className="whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      )}

                      {/* Attachment */}
                      {message.attachment && (
                        <div className="mt-2">
                          {message.attachment.type === 'image' ? (
                            <img 
                              src={message.attachment.url} 
                              alt={message.attachment.name}
                              className="max-w-full rounded-lg max-h-64 object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex items-center space-x-2 p-2 bg-background/20 rounded">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{message.attachment.name}</p>
                                {message.attachment.size && (
                                  <p className="text-xs opacity-70">
                                    {(message.attachment.size / 1024).toFixed(1)} KB
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Timestamp */}
                      <div className="text-xs opacity-70 mt-1">
                        {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                      </div>
                    </div>

                    {/* Reactions */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(message.reactions).map(([emoji, userIds]) => 
                          userIds.length > 0 && (
                            <Button
                              key={emoji}
                              variant={hasUserReacted(message, emoji) ? "default" : "outline"}
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => handleReaction(message.id, emoji)}
                            >
                              {emoji} {userIds.length}
                            </Button>
                          )
                        )}
                        
                        {/* Quick reaction buttons */}
                        <div className="flex gap-1">
                          {emojiReactions.slice(0, 3).map(({ emoji }) => (
                            <Button
                              key={emoji}
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                              onClick={() => handleReaction(message.id, emoji)}
                            >
                              {emoji}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Avatar for current user */}
                  {message.userId === currentUser.id && (
                    <Avatar className="h-8 w-8 ml-2">
                      <AvatarImage src={message.avatar} />
                      <AvatarFallback className="text-xs">
                        {message.alias.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="px-4 pb-4">
          {/* Selected file preview */}
          {selectedFile && (
            <div className="mb-2 p-2 bg-muted rounded-lg flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ImageIcon className="h-4 w-4" />
                <span className="text-sm truncate">{selectedFile.name}</span>
                <Badge variant="outline" className="text-xs">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFile(null)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          )}

          {/* Message input form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex items-end space-x-2">
              {/* Auto-resizing textarea */}
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message... (Shift+Enter for new line)"
                  className="w-full min-h-[40px] max-h-[150px] px-3 py-2 pr-20 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent overflow-y-auto"
                  disabled={isSubmitting}
                  rows={1}
                />
                
                {/* Action buttons inside textarea */}
                <div className="absolute right-2 bottom-2 flex items-center space-x-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Send button */}
              <Button 
                type="submit" 
                disabled={(!inputValue.trim() && !selectedFile) || isSubmitting}
                className="h-10 w-10 p-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Emoji picker */}
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex flex-wrap gap-2 p-2 bg-muted rounded-lg"
              >
                {emojiReactions.map(({ emoji, label }) => (
                  <Button
                    key={emoji}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => {
                      setInputValue(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    title={label}
                  >
                    {emoji}
                  </Button>
                ))}
              </motion.div>
            )}
          </form>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default EnhancedChatWithAutoResize;