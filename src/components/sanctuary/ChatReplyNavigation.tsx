import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowUpCircle } from 'lucide-react';

interface ChatReplyNavigationProps {
  replyToMessageId: string;
  onNavigateToMessage: (messageId: string) => void;
  replyToContent?: string;
  replyToSender?: string;
}

export const ChatReplyNavigation: React.FC<ChatReplyNavigationProps> = ({
  replyToMessageId,
  onNavigateToMessage,
  replyToContent,
  replyToSender
}) => {
  const handleNavigate = () => {
    const messageElement = document.getElementById(`message-${replyToMessageId}`);
    if (messageElement) {
      // Smooth scroll to the message
      messageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
      
      // Add highlight animation
      messageElement.classList.add('animate-pulse', 'bg-primary/10');
      
      setTimeout(() => {
        messageElement.classList.remove('animate-pulse', 'bg-primary/10');
      }, 2000);
      
      onNavigateToMessage(replyToMessageId);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleNavigate}
      className="flex items-center space-x-2 text-muted-foreground hover:text-foreground p-2 rounded-md hover:bg-muted/50 transition-colors"
    >
      <ArrowUpCircle className="h-3 w-3" />
      <div className="text-left min-w-0 flex-1">
        <div className="text-xs font-medium truncate">
          {replyToSender ? `@${replyToSender}` : 'Original message'}
        </div>
        {replyToContent && (
          <div className="text-xs text-muted-foreground truncate max-w-32">
            {replyToContent.length > 50 ? `${replyToContent.substring(0, 50)}...` : replyToContent}
          </div>
        )}
      </div>
    </Button>
  );
};

// Enhanced message component with reply navigation
interface MessageWithReplyProps {
  message: {
    id: string;
    senderAlias: string;
    content: string;
    timestamp: Date;
    replyTo?: string;
    replyToMessage?: {
      id: string;
      content: string;
      senderAlias: string;
    };
  };
  onNavigateToMessage?: (messageId: string) => void;
  onReply?: (messageId: string) => void;
}

export const MessageWithReply: React.FC<MessageWithReplyProps> = ({
  message,
  onNavigateToMessage,
  onReply
}) => {
  return (
    <div 
      id={`message-${message.id}`} 
      className="p-3 rounded-lg transition-colors duration-200"
    >
      {/* Reply Context */}
      {message.replyTo && message.replyToMessage && onNavigateToMessage && (
        <div className="mb-2">
          <ChatReplyNavigation
            replyToMessageId={message.replyTo}
            onNavigateToMessage={onNavigateToMessage}
            replyToContent={message.replyToMessage.content}
            replyToSender={message.replyToMessage.senderAlias}
          />
        </div>
      )}
      
      {/* Message Content */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{message.senderAlias}</span>
          <span className="text-xs text-muted-foreground">
            {message.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <p className="text-sm">{message.content}</p>
        
        {/* Reply Button */}
        {onReply && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onReply(message.id)}
            className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Reply
          </Button>
        )}
      </div>
    </div>
  );
};