import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useSocket } from '@/hooks/useSocket';

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  participantAlias: string;
  timestamp: number;
  velocity: { x: number; y: number };
  scale: number;
  opacity: number;
  rotation: number;
  life: number;
}

interface AnimatedReactionSystemProps {
  sessionId: string;
  currentUserAlias: string;
  isEnabled?: boolean;
  containerRef?: React.RefObject<HTMLElement>;
}

const REACTION_EMOJIS = [
  '👏', '❤️', '😂', '😍', '🤗', '👍', '👎', '😢', '😮', '🔥',
  '✨', '💪', '🙏', '👀', '💯', '🎉', '🤝', '💝', '🌟', '⚡'
];

const REACTION_LIFETIME = 4000; // 4 seconds
const MAX_REACTIONS = 50;

export const AnimatedReactionSystem: React.FC<AnimatedReactionSystemProps> = ({
  sessionId,
  currentUserAlias,
  isEnabled = true,
  containerRef
}) => {
  const { toast } = useToast();
  const { socket, isConnected } = useSocket();
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [isQuickReactVisible, setIsQuickReactVisible] = useState(false);
  const animationFrameRef = useRef<number>();
  const reactionContainerRef = useRef<HTMLDivElement>(null);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      setReactions(prev => {
        const now = Date.now();
        return prev
          .map(reaction => {
            const age = now - reaction.timestamp;
            const progress = age / REACTION_LIFETIME;
            
            if (progress >= 1) return null;
            
            // Update position
            const newY = reaction.y + reaction.velocity.y;
            const newX = reaction.x + reaction.velocity.x;
            
            // Update properties based on age
            const opacity = Math.max(0, 1 - (progress * 1.5));
            const scale = reaction.scale + (progress * 0.3);
            const rotation = reaction.rotation + (reaction.velocity.x * 0.5);
            
            return {
              ...reaction,
              x: newX,
              y: newY,
              opacity,
              scale,
              rotation,
              life: progress
            };
          })
          .filter(Boolean) as FloatingReaction[];
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Socket event handlers for reactions
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleReactionReceived = (data: {
      emoji: string;
      participantAlias: string;
      participantId: string;
      timestamp: string;
    }) => {
      if (!isEnabled) return;
      
      createFloatingReaction(data.emoji, data.participantAlias);
      
      // Show toast for reactions from others
      if (data.participantAlias !== currentUserAlias) {
        toast({
          title: `${data.participantAlias} reacted`,
          description: data.emoji,
          duration: 2000
        });
      }
    };

    socket.on('reaction_received', handleReactionReceived);
    socket.on('sanctuary:reaction_sent', handleReactionReceived);

    return () => {
      socket.off('reaction_received', handleReactionReceived);
      socket.off('sanctuary:reaction_sent', handleReactionReceived);
    };
  }, [socket, isConnected, isEnabled, currentUserAlias, toast]);

  const createFloatingReaction = (emoji: string, participantAlias: string) => {
    const container = containerRef?.current || reactionContainerRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    
    // Random starting position within container
    const startX = Math.random() * (containerRect.width - 60) + 30;
    const startY = containerRect.height - 100;
    
    // Random velocity for natural movement
    const velocityX = (Math.random() - 0.5) * 4;
    const velocityY = -2 - Math.random() * 2;
    
    const newReaction: FloatingReaction = {
      id: `reaction-${Date.now()}-${Math.random()}`,
      emoji,
      x: startX,
      y: startY,
      participantAlias,
      timestamp: Date.now(),
      velocity: { x: velocityX, y: velocityY },
      scale: 1 + Math.random() * 0.5,
      opacity: 1,
      rotation: Math.random() * 360,
      life: 0
    };

    setReactions(prev => {
      // Keep only the most recent reactions to prevent memory issues
      const filtered = prev.slice(-MAX_REACTIONS);
      return [...filtered, newReaction];
    });
  };

  const sendReaction = async (emoji: string) => {
    if (!socket || !isConnected) {
      toast({
        title: "Connection Lost",
        description: "Cannot send reactions while disconnected",
        variant: "destructive"
      });
      return;
    }

    try {
      // Send via socket
      socket.emit('flagship_send_reaction', {
        sessionId,
        emoji,
        participantAlias: currentUserAlias,
        timestamp: new Date().toISOString()
      });

      // Create local reaction immediately for better UX
      createFloatingReaction(emoji, currentUserAlias);
      setIsQuickReactVisible(false);

    } catch (error) {
      console.error('Failed to send reaction:', error);
      toast({
        title: "Reaction Failed",
        description: "Could not send reaction",
        variant: "destructive"
      });
    }
  };

  const handleQuickReaction = (emoji: string) => {
    sendReaction(emoji);
  };

  if (!isEnabled) return null;

  return (
    <>
      {/* Floating Reactions Container */}
      <div 
        ref={reactionContainerRef}
        className="fixed inset-0 pointer-events-none z-50 overflow-hidden"
        style={{ 
          position: containerRef ? 'absolute' : 'fixed',
          inset: containerRef ? '0' : 'auto'
        }}
      >
        {reactions.map(reaction => (
          <div
            key={reaction.id}
            className="absolute pointer-events-none"
            style={{
              left: `${reaction.x}px`,
              top: `${reaction.y}px`,
              transform: `scale(${reaction.scale}) rotate(${reaction.rotation}deg)`,
              opacity: reaction.opacity,
              fontSize: '2rem',
              zIndex: 1000,
              textShadow: '0 0 10px rgba(0,0,0,0.3)',
              transition: 'none'
            }}
          >
            {reaction.emoji}
          </div>
        ))}
      </div>

      {/* Quick Reaction Panel */}
      <div className="fixed bottom-20 right-4 z-40">
        {isQuickReactVisible && (
          <Card className="p-2 mb-2 animate-scale-in">
            <div className="grid grid-cols-5 gap-1">
              {REACTION_EMOJIS.slice(0, 10).map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-lg hover:scale-110 transition-transform"
                  onClick={() => handleQuickReaction(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
            
            {/* Extended reactions */}
            <div className="grid grid-cols-5 gap-1 mt-1">
              {REACTION_EMOJIS.slice(10).map((emoji) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-lg hover:scale-110 transition-transform"
                  onClick={() => handleQuickReaction(emoji)}
                >
                  {emoji}
                </Button>
              ))}
            </div>
          </Card>
        )}

        {/* Reaction Toggle Button */}
        <Button
          onClick={() => setIsQuickReactVisible(!isQuickReactVisible)}
          className="h-12 w-12 rounded-full shadow-lg"
          disabled={!isConnected}
        >
          {isQuickReactVisible ? '✕' : '😊'}
        </Button>
      </div>

      {/* Quick access reactions (always visible) */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-40">
        <div className="flex items-center space-x-2 bg-background/90 backdrop-blur rounded-full px-4 py-2 shadow-lg border">
          {REACTION_EMOJIS.slice(0, 6).map((emoji) => (
            <Button
              key={emoji}
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-lg hover:scale-125 transition-all duration-200 hover:bg-primary/20"
              onClick={() => handleQuickReaction(emoji)}
              disabled={!isConnected}
            >
              {emoji}
            </Button>
          ))}
          
          <div className="w-px h-6 bg-border mx-2" />
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-sm hover:scale-110 transition-transform"
            onClick={() => setIsQuickReactVisible(!isQuickReactVisible)}
            disabled={!isConnected}
          >
            +
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
        
        .reaction-trail {
          filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
        }
      `}</style>
    </>
  );
};
