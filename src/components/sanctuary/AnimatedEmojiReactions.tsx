import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Heart, Smile, ThumbsUp, Star, Zap, Coffee, Sun, Moon } from 'lucide-react';

interface EmojiReaction {
  id: string;
  emoji: string;
  participantId: string;
  participantAlias?: string;
  timestamp: string;
  x: number;
  y: number;
  duration: number;
}

interface AnimatedEmojiReactionsProps {
  onSendReaction: (emoji: string) => void;
  reactions: EmojiReaction[];
  className?: string;
  containerRef?: React.RefObject<HTMLDivElement>;
}

const EMOJI_SHORTCUTS = [
  { emoji: '❤️', label: 'Love', icon: Heart, color: 'text-red-500', shortcut: 'h' },
  { emoji: '😄', label: 'Happy', icon: Smile, color: 'text-yellow-500', shortcut: 's' },
  { emoji: '👍', label: 'Like', icon: ThumbsUp, color: 'text-blue-500', shortcut: 'l' },
  { emoji: '⭐', label: 'Star', icon: Star, color: 'text-purple-500', shortcut: 't' },
  { emoji: '⚡', label: 'Energy', icon: Zap, color: 'text-orange-500', shortcut: 'e' },
  { emoji: '☕', label: 'Coffee', icon: Coffee, color: 'text-amber-600', shortcut: 'c' },
  { emoji: '☀️', label: 'Sunshine', icon: Sun, color: 'text-yellow-400', shortcut: 'u' },
  { emoji: '🌙', label: 'Calm', icon: Moon, color: 'text-indigo-400', shortcut: 'm' }
];

const ADDITIONAL_EMOJIS = [
  '👏', '🙏', '💪', '🎉', '🔥', '💯', '✨', '🌟', 
  '🤝', '🫂', '💝', '🎈', '🌈', '🦋', '🌸', '🍀'
];

export const AnimatedEmojiReactions: React.FC<AnimatedEmojiReactionsProps> = ({
  onSendReaction,
  reactions,
  className,
  containerRef
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const animationContainerRef = useRef<HTMLDivElement>(null);
  const activeAnimationsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Handle keyboard shortcuts for emoji reactions
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const shortcut = EMOJI_SHORTCUTS.find(e => e.shortcut === event.key.toLowerCase());
      if (shortcut) {
        event.preventDefault();
        handleEmojiSend(shortcut.emoji);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Clean up animations when component unmounts
  useEffect(() => {
    return () => {
      activeAnimationsRef.current.forEach(timeout => clearTimeout(timeout));
      activeAnimationsRef.current.clear();
    };
  }, []);

  // Animate reactions as they come in
  useEffect(() => {
    reactions.forEach(reaction => {
      if (!activeAnimationsRef.current.has(reaction.id)) {
        animateReaction(reaction);
      }
    });
  }, [reactions]);

  const handleEmojiSend = (emoji: string) => {
    onSendReaction(emoji);
    
    // Update recent emojis
    setRecentEmojis(prev => {
      const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 6);
      return updated;
    });

    // Close picker after sending
    setShowEmojiPicker(false);

    // Show local preview animation immediately for better UX
    const previewReaction: EmojiReaction = {
      id: `preview_${Date.now()}`,
      emoji,
      participantId: 'local',
      timestamp: new Date().toISOString(),
      x: Math.random() * 80 + 10, // 10-90% of container width
      y: Math.random() * 60 + 20, // 20-80% of container height
      duration: 3000
    };
    
    animateReaction(previewReaction);
  };

  const animateReaction = (reaction: EmojiReaction) => {
    const container = containerRef?.current || animationContainerRef.current;
    if (!container) return;

    // Create floating emoji element
    const emojiElement = document.createElement('div');
    emojiElement.className = 'absolute pointer-events-none z-50 select-none';
    emojiElement.style.cssText = `
      font-size: 2.5rem;
      left: ${reaction.x}%;
      top: ${reaction.y}%;
      animation: float-up-and-fade 3s ease-out forwards;
      text-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    emojiElement.textContent = reaction.emoji;

    // Add floating animation styles if not already present
    if (!document.querySelector('#emoji-animation-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'emoji-animation-styles';
      styleSheet.textContent = `
        @keyframes float-up-and-fade {
          0% {
            transform: translateY(0) scale(0.8) rotate(-5deg);
            opacity: 0;
          }
          10% {
            transform: translateY(-10px) scale(1.2) rotate(0deg);
            opacity: 1;
          }
          50% {
            transform: translateY(-80px) scale(1) rotate(5deg);
            opacity: 0.8;
          }
          100% {
            transform: translateY(-150px) scale(0.6) rotate(10deg);
            opacity: 0;
          }
        }
        
        @keyframes pulse-glow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(var(--primary-rgb), 0.4);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 0 0 10px rgba(var(--primary-rgb), 0);
          }
        }
      `;
      document.head.appendChild(styleSheet);
    }

    container.appendChild(emojiElement);

    // Clean up after animation completes
    const timeout = setTimeout(() => {
      if (emojiElement.parentNode) {
        emojiElement.parentNode.removeChild(emojiElement);
      }
      activeAnimationsRef.current.delete(reaction.id);
    }, reaction.duration || 3000);

    activeAnimationsRef.current.set(reaction.id, timeout);
  };

  const getContainerBounds = () => {
    const container = containerRef?.current || animationContainerRef.current;
    if (!container) return { width: 300, height: 200 };
    
    const rect = container.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  return (
    <div className={cn("relative", className)}>
      {/* Animation Container */}
      <div 
        ref={animationContainerRef}
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ zIndex: 1000 }}
      />

      {/* Emoji Reaction Controls */}
      <Card className="w-full max-w-sm bg-background/95 backdrop-blur-sm border-primary/20">
        <CardContent className="p-4 space-y-4">
          {/* Quick Emoji Shortcuts */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Quick Reactions</span>
              <Badge variant="outline" className="text-xs">
                Press key shortcuts
              </Badge>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {EMOJI_SHORTCUTS.map(({ emoji, label, icon: Icon, color, shortcut }) => (
                <Button
                  key={emoji}
                  variant="ghost"
                  size="sm"
                  className="h-12 flex flex-col items-center justify-center p-1 hover:bg-primary/10 transition-all hover:scale-105 group"
                  onClick={() => handleEmojiSend(emoji)}
                  title={`${label} (Press '${shortcut}')`}
                >
                  <span className="text-lg mb-0.5">{emoji}</span>
                  <span className={cn("text-xs opacity-60 group-hover:opacity-100", color)}>
                    {shortcut}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Recent Emojis */}
          {recentEmojis.length > 0 && (
            <div>
              <span className="text-sm font-medium">Recent</span>
              <div className="flex gap-2 mt-2 flex-wrap">
                {recentEmojis.map((emoji, index) => (
                  <Button
                    key={`recent-${emoji}-${index}`}
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0 text-sm hover:scale-110 transition-transform"
                    onClick={() => handleEmojiSend(emoji)}
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* More Emojis Toggle */}
          <div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              {showEmojiPicker ? 'Hide' : 'More'} Emojis
            </Button>

            {showEmojiPicker && (
              <div className="mt-3 p-3 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-8 gap-1">
                  {ADDITIONAL_EMOJIS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-sm hover:bg-primary/20 hover:scale-110 transition-all"
                      onClick={() => handleEmojiSend(emoji)}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live Reaction Feed */}
          {reactions.length > 0 && (
            <div className="pt-2 border-t">
              <span className="text-sm font-medium mb-2 block">Live Reactions</span>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {reactions.slice(-3).map((reaction) => (
                  <div key={reaction.id} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{reaction.emoji}</span>
                    <span className="text-muted-foreground">
                      {reaction.participantAlias || 'Someone'} reacted
                    </span>
                    <span className="text-muted-foreground ml-auto">
                      {new Date(reaction.timestamp).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts Info */}
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            💡 <strong>Tip:</strong> Use keyboard shortcuts (h, s, l, t, e, c, u, m) for quick reactions!
          </div>
        </CardContent>
      </Card>
    </div>
  );
};