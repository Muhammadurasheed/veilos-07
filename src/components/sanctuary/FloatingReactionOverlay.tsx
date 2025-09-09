import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingReactionOverlayProps {
  reactions: Array<{
    id: string;
    emoji: string;
    timestamp: number;
  }>;
}

export const FloatingReactionOverlay = ({ reactions }: FloatingReactionOverlayProps) => {
  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      <AnimatePresence>
        {reactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{
              opacity: 1,
              scale: 0,
              x: Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1,
              y: window.innerHeight * 0.9,
            }}
            animate={{
              opacity: [1, 1, 0],
              scale: [0, 1.5, 1],
              y: window.innerHeight * 0.2,
              x: Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1,
              rotate: [0, Math.random() * 360 - 180],
            }}
            exit={{
              opacity: 0,
              scale: 0.5,
            }}
            transition={{
              duration: 3,
              ease: "easeOut",
              times: [0, 0.8, 1],
            }}
            className="absolute text-4xl select-none"
            style={{
              filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))',
            }}
          >
            {reaction.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};