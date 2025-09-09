import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  ThumbsUp, 
  Heart, 
  Star, 
  Zap, 
  Flame, 
  Smile,
  Target,
  Award,
  Sparkles
} from 'lucide-react';

interface FloatingReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  timestamp: number;
  color: string;
  scale: number;
}

interface ReactionConfig {
  emoji: string;
  icon: React.ComponentType<any>;
  name: string;
  color: string;
  gradient: string;
}

const reactions: ReactionConfig[] = [
  { emoji: '👏', icon: ThumbsUp, name: 'Applause', color: 'text-blue-500', gradient: 'from-blue-400 to-blue-600' },
  { emoji: '👍', icon: ThumbsUp, name: 'Like', color: 'text-green-500', gradient: 'from-green-400 to-green-600' },
  { emoji: '❤️', icon: Heart, name: 'Love', color: 'text-red-500', gradient: 'from-red-400 to-red-600' },
  { emoji: '⭐', icon: Star, name: 'Star', color: 'text-yellow-500', gradient: 'from-yellow-400 to-yellow-600' },
  { emoji: '⚡', icon: Zap, name: 'Energy', color: 'text-purple-500', gradient: 'from-purple-400 to-purple-600' },
  { emoji: '🔥', icon: Flame, name: 'Fire', color: 'text-orange-500', gradient: 'from-orange-400 to-orange-600' },
  { emoji: '😊', icon: Smile, name: 'Happy', color: 'text-pink-500', gradient: 'from-pink-400 to-pink-600' },
  { emoji: '🎯', icon: Target, name: 'Target', color: 'text-indigo-500', gradient: 'from-indigo-400 to-indigo-600' },
  { emoji: '🏆', icon: Award, name: 'Award', color: 'text-amber-500', gradient: 'from-amber-400 to-amber-600' },
  { emoji: '✨', icon: Sparkles, name: 'Magic', color: 'text-cyan-500', gradient: 'from-cyan-400 to-cyan-600' }
];

interface EnhancedAnimatedReactionSystemProps {
  sessionId: string;
  participantId?: string;
  onReactionSent?: (reaction: string) => void;
  className?: string;
}

export const EnhancedAnimatedReactionSystem: React.FC<EnhancedAnimatedReactionSystemProps> = ({
  sessionId,
  participantId,
  onReactionSent,
  className = ''
}) => {
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const createFloatingReaction = useCallback((reaction: ReactionConfig, clickX?: number, clickY?: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const id = `reaction-${Date.now()}-${Math.random()}`;
    
    // Use click position or generate random position
    const x = clickX !== undefined ? clickX - rect.left : Math.random() * (rect.width - 40);
    const y = clickY !== undefined ? clickY - rect.top : Math.random() * (rect.height - 40);
    
    const newReaction: FloatingReaction = {
      id,
      emoji: reaction.emoji,
      x,
      y,
      timestamp: Date.now(),
      color: reaction.color,
      scale: 0.8 + Math.random() * 0.4
    };

    setFloatingReactions(prev => [...prev, newReaction]);

    // Update reaction counts
    setReactionCounts(prev => ({
      ...prev,
      [reaction.emoji]: (prev[reaction.emoji] || 0) + 1
    }));

    // Remove after animation completes
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  }, []);

  const handleReactionClick = useCallback((reaction: ReactionConfig, event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX;
    const clickY = event.clientY;
    
    // Create multiple floating reactions for better effect
    const count = 2 + Math.floor(Math.random() * 3); // 2-4 reactions
    
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        createFloatingReaction(reaction, clickX + (Math.random() - 0.5) * 60, clickY + (Math.random() - 0.5) * 60);
      }, i * 100);
    }

    // Callback for parent component
    if (onReactionSent) {
      onReactionSent(reaction.emoji);
    }

    // Auto-collapse after reaction
    setTimeout(() => setIsExpanded(false), 1500);
  }, [createFloatingReaction, onReactionSent]);

  const floatingVariants = {
    initial: { 
      scale: 0, 
      y: 0, 
      opacity: 0,
      rotate: 0
    },
    animate: { 
      scale: [0, 1.2, 1],
      y: [0, -60, -120],
      opacity: [0, 1, 0.8, 0],
      rotate: [0, 10, -10, 0],
      transition: {
        duration: 3,
        ease: [0.25, 0.46, 0.45, 0.94],
        times: [0, 0.2, 0.8, 1]
      }
    }
  };

  const buttonVariants = {
    initial: { scale: 1 },
    hover: { 
      scale: 1.1,
      transition: { duration: 0.2 }
    },
    tap: { 
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  };

  const panelVariants = {
    collapsed: {
      width: "60px",
      height: "60px",
      borderRadius: "30px",
      transition: { duration: 0.3 }
    },
    expanded: {
      width: "320px",
      height: "80px", 
      borderRadius: "40px",
      transition: { duration: 0.3 }
    }
  };

  return (
    <div 
      ref={containerRef}
      className={`fixed bottom-20 right-4 z-50 ${className}`}
    >
      {/* Floating Reactions Container */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map((reaction) => (
            <motion.div
              key={reaction.id}
              className="absolute text-2xl select-none"
              style={{
                left: reaction.x,
                top: reaction.y,
                transform: `scale(${reaction.scale})`
              }}
              variants={floatingVariants}
              initial="initial"
              animate="animate"
              exit={{ opacity: 0, scale: 0 }}
            >
              {reaction.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Reaction Panel */}
      <motion.div
        className="relative"
        variants={panelVariants}
        initial="collapsed"
        animate={isExpanded ? "expanded" : "collapsed"}
      >
        <Card className="w-full h-full bg-background/95 backdrop-blur-md border-2 border-primary/20 shadow-2xl overflow-hidden">
          <div className="w-full h-full p-2 flex items-center">
            {!isExpanded ? (
              // Collapsed state - toggle button
              <motion.button
                className="w-full h-full rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center text-white shadow-lg"
                onClick={() => setIsExpanded(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Sparkles className="h-6 w-6" />
              </motion.button>
            ) : (
              // Expanded state - reaction buttons
              <div className="flex items-center justify-between w-full gap-1 px-2">
                <div className="flex items-center gap-1 flex-1">
                  {reactions.slice(0, 6).map((reaction, index) => (
                    <motion.button
                      key={reaction.emoji}
                      className={`flex-1 min-w-0 h-12 rounded-xl bg-gradient-to-br ${reaction.gradient} text-white shadow-md flex items-center justify-center text-lg font-bold hover:shadow-lg transition-all duration-200`}
                      variants={buttonVariants}
                      initial="initial"
                      whileHover="hover"
                      whileTap="tap"
                      onClick={(e) => handleReactionClick(reaction, e)}
                      style={{
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      <span className="text-base">{reaction.emoji}</span>
                      {reactionCounts[reaction.emoji] && (
                        <span className="ml-1 text-xs">
                          {reactionCounts[reaction.emoji]}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
                
                {/* Collapse button */}
                <motion.button
                  className="ml-2 w-10 h-10 rounded-xl bg-gray-600 text-white flex items-center justify-center hover:bg-gray-700 transition-colors"
                  onClick={() => setIsExpanded(false)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ×
                </motion.button>
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Reaction Stats (optional overlay) */}
      {Object.keys(reactionCounts).length > 0 && (
        <motion.div
          className="absolute -top-12 left-0 right-0 flex justify-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="bg-background/90 backdrop-blur-sm border border-border rounded-full px-3 py-1 text-xs text-muted-foreground">
            Total reactions: {Object.values(reactionCounts).reduce((a, b) => a + b, 0)}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default EnhancedAnimatedReactionSystem;