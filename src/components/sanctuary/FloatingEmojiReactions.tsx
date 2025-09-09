import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FloatingEmoji {
  id: string;
  emoji: string;
  startX: number;
  startY: number;
  targetX?: number;
  targetY?: number;
  participantName?: string;
  timestamp: number;
}

interface FloatingEmojiReactionsProps {
  reactions: FloatingEmoji[];
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const FloatingEmojiReactions: React.FC<FloatingEmojiReactionsProps> = ({
  reactions,
  containerRef
}) => {
  const [activeReactions, setActiveReactions] = useState<FloatingEmoji[]>([]);

  useEffect(() => {
    // Update active reactions when new ones come in
    const newReactions = reactions.filter(
      reaction => !activeReactions.some(active => active.id === reaction.id)
    );
    
    if (newReactions.length > 0) {
      setActiveReactions(prev => [...prev, ...newReactions]);
      
      // Auto-remove after animation duration
      newReactions.forEach(reaction => {
        setTimeout(() => {
          setActiveReactions(prev => prev.filter(r => r.id !== reaction.id));
        }, 4000);
      });
    }
  }, [reactions]);

  const getRandomFloatPath = () => {
    const paths = [
      // Gentle arc upward
      { x: [0, 20, -10, 30, 0], y: [0, -30, -60, -90, -120] },
      // Spiral float
      { x: [0, -15, 25, -20, 15, 0], y: [0, -20, -40, -65, -85, -110] },
      // Simple rise with wobble
      { x: [0, 15, -10, 20, -5], y: [0, -25, -50, -75, -100] },
      // Wide arc
      { x: [0, -25, 35, -15, 10], y: [0, -15, -35, -70, -95] }
    ];
    return paths[Math.floor(Math.random() * paths.length)];
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-[60] overflow-hidden">
      <AnimatePresence>
        {activeReactions.map((reaction) => {
          const floatPath = getRandomFloatPath();
          const randomRotation = (Math.random() - 0.5) * 30;
          
          return (
            <motion.div
              key={reaction.id}
              initial={{
                x: reaction.startX,
                y: reaction.startY,
                scale: 0.5,
                opacity: 0,
                rotate: 0
              }}
              animate={{
                x: floatPath.x,
                y: floatPath.y,
                scale: [0.5, 1.2, 1, 0.8, 0.6],
                opacity: [0, 1, 1, 0.7, 0],
                rotate: [0, randomRotation, randomRotation * 1.5, randomRotation * 0.5, 0]
              }}
              exit={{
                scale: 0,
                opacity: 0,
                y: reaction.startY - 150
              }}
              transition={{
                duration: 4,
                ease: "easeOut",
                times: [0, 0.1, 0.3, 0.7, 1]
              }}
              className="absolute"
              style={{
                left: reaction.startX,
                top: reaction.startY
              }}
            >
              <div className="relative flex flex-col items-center">
                {/* Main Emoji */}
                <div className="text-4xl drop-shadow-lg filter">
                  {reaction.emoji}
                </div>
                
                {/* Participant Name (if provided) */}
                {reaction.participantName && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -10] }}
                    transition={{ duration: 2.5, times: [0, 0.2, 0.8, 1] }}
                    className="absolute -bottom-8 bg-black/70 text-white px-2 py-1 rounded-full text-xs whitespace-nowrap"
                  >
                    {reaction.participantName}
                  </motion.div>
                )}
                
                {/* Sparkle Effect */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ 
                    scale: [0, 1.5, 0],
                    opacity: [0, 0.6, 0],
                    rotate: [0, 180, 360]
                  }}
                  transition={{ duration: 1.5, delay: 0.2 }}
                  className="absolute inset-0 text-yellow-300"
                  style={{ fontSize: '2rem' }}
                >
                  ✨
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// Hook for managing emoji reactions
export const useFloatingEmojiReactions = () => {
  const [reactions, setReactions] = useState<FloatingEmoji[]>([]);

  const addReaction = (
    emoji: string, 
    sourceElement?: HTMLElement | null,
    participantName?: string
  ) => {
    const container = document.body;
    const rect = sourceElement?.getBoundingClientRect() || {
      left: window.innerWidth / 2,
      top: window.innerHeight / 2,
      width: 40,
      height: 40
    };

    const newReaction: FloatingEmoji = {
      id: `reaction-${Date.now()}-${Math.random()}`,
      emoji,
      startX: rect.left + (rect.width / 2),
      startY: rect.top + (rect.height / 2),
      participantName,
      timestamp: Date.now()
    };

    setReactions(prev => [...prev, newReaction]);

    // Auto-cleanup
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, 5000);
  };

  return {
    reactions,
    addReaction,
    clearReactions: () => setReactions([])
  };
};