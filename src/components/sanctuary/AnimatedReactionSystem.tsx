import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  timestamp: number;
}

interface AnimatedReactionSystemProps {
  sessionId: string;
  onSendReaction: (emoji: string) => void;
  className?: string;
}

const REACTION_EMOJIS = [
  { emoji: '👍', label: 'Thumbs up' },
  { emoji: '👏', label: 'Clap' },
  { emoji: '❤️', label: 'Heart' },
  { emoji: '😊', label: 'Smile' },
  { emoji: '🤔', label: 'Thinking' },
  { emoji: '🔥', label: 'Fire' },
  { emoji: '✨', label: 'Sparkles' },
  { emoji: '💡', label: 'Idea' },
  { emoji: '🙏', label: 'Pray' }
];

export const AnimatedReactionSystem = ({ 
  sessionId, 
  onSendReaction, 
  className 
}: AnimatedReactionSystemProps) => {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});

  // Add floating reaction
  const addFloatingReaction = useCallback((emoji: string) => {
    const reaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random()}`,
      emoji,
      x: Math.random() * 300 + 50, // Random x position
      y: Math.random() * 100 + 100, // Random y position
      timestamp: Date.now()
    };

    setFloatingReactions(prev => [...prev, reaction]);

    // Update reaction count
    setReactionCounts(prev => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1
    }));

    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
    }, 3000);
  }, []);

  // Handle reaction click
  const handleReactionClick = useCallback((emoji: string) => {
    onSendReaction(emoji);
    addFloatingReaction(emoji);
  }, [onSendReaction, addFloatingReaction]);

  // Socket integration for receiving reactions
  useEffect(() => {
    // Listen for reactions from other participants
    const handleIncomingReaction = (data: { emoji: string; userId: string }) => {
      addFloatingReaction(data.emoji);
    };

    // Socket listener would be set up here
    // socket.on('reaction_received', handleIncomingReaction);

    return () => {
      // socket.off('reaction_received', handleIncomingReaction);
    };
  }, [addFloatingReaction]);

  return (
    <div className={cn("relative", className)}>
      {/* Floating Reactions Container */}
      <div className="fixed inset-0 pointer-events-none z-[9998]">
        <AnimatePresence>
          {floatingReactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              initial={{ 
                opacity: 0, 
                scale: 0.5, 
                x: reaction.x, 
                y: reaction.y 
              }}
              animate={{ 
                opacity: [0, 1, 1, 0], 
                scale: [0.5, 1.2, 1, 0.8],
                y: reaction.y - 200,
                rotate: [0, 10, -10, 0]
              }}
              exit={{ opacity: 0, scale: 0 }}
              transition={{ 
                duration: 3,
                ease: "easeOut"
              }}
              className="absolute text-4xl font-bold"
              style={{
                filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))'
              }}
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick Reactions Panel */}
      <Card className="glass border-primary/20 bg-background/95 backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Quick Reactions</h3>
            <div className="text-xs text-muted-foreground">
              Tap to send
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            {REACTION_EMOJIS.map(({ emoji, label }) => (
              <motion.div key={emoji} className="relative">
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReactionClick(emoji)}
                    className="h-12 w-full text-2xl hover:bg-primary/10 hover:scale-110 transition-all duration-200"
                    title={label}
                  >
                    {emoji}
                  </Button>
                </motion.div>
                
                {/* Reaction Count Badge */}
                {reactionCounts[emoji] > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-xs w-5 h-5 flex items-center justify-center font-bold"
                  >
                    {reactionCounts[emoji]}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Recent Reactions Summary */}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span>Recent:</span>
              <div className="flex space-x-1">
                {Object.entries(reactionCounts)
                  .sort(([,a], [,b]) => b - a)
                  .slice(0, 5)
                  .map(([emoji, count]) => (
                    <motion.span
                      key={emoji}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center space-x-1"
                    >
                      <span>{emoji}</span>
                      <span className="text-xs">{count}</span>
                    </motion.span>
                  ))
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnimatedReactionSystem;