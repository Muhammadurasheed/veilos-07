import React, { useState, useRef, useCallback } from 'react';
import { Maximize2, Minimize2, GripVertical } from 'lucide-react';
import { EnhancedChatPanel } from './EnhancedChatPanel';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface ResizableChatPanelProps {
  sessionId: string;
  isVisible?: boolean;
  onToggle?: () => void;
  messages?: any[];
  participants: any[];
  currentUserAlias?: string;
  onSendMessage?: (content: string, type?: 'text' | 'emoji-reaction' | 'media', attachment?: any, replyTo?: string) => void;
}

export const ResizableChatPanel: React.FC<ResizableChatPanelProps> = ({
  sessionId,
  isVisible = true,
  onToggle = () => {},
  messages = [],
  participants,
  currentUserAlias = '',
  onSendMessage = () => {}
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [width, setWidth] = useState(320); // Default width
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(320);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = startXRef.current - e.clientX; // Reverse for left resize
      const newWidth = Math.max(280, Math.min(600, startWidthRef.current + deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [width]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  if (isFullscreen) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">Chat - Fullscreen</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="h-8 w-8 p-0"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <EnhancedChatPanel
              isVisible={isVisible}
              onToggle={onToggle}
              messages={messages}
              participants={participants}
              currentUserAlias={currentUserAlias}
              sessionId={sessionId}
              onSendMessage={onSendMessage}
            />
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      className="relative flex bg-background border border-border rounded-lg overflow-hidden"
      style={{ width: `${width}px` }}
      animate={{ width }}
      transition={{ duration: isResizing ? 0 : 0.2 }}
    >
      {/* Resize Handle */}
      <div
        ref={resizeRef}
        className={`
          absolute left-0 top-0 bottom-0 w-1 cursor-col-resize 
          bg-transparent hover:bg-primary/20 transition-colors z-10
          ${isResizing ? 'bg-primary/30' : ''}
        `}
        onMouseDown={handleMouseDown}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-border rounded-full opacity-0 hover:opacity-100 transition-opacity">
          <GripVertical className="h-3 w-3 text-muted-foreground absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Chat Panel Container */}
      <div className="flex-1 flex flex-col overflow-hidden ml-1">
        {/* Header with Fullscreen Toggle */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-medium text-foreground text-sm">Live Chat</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="h-6 w-6 p-0"
          >
            <Maximize2 className="h-3 w-3" />
          </Button>
        </div>

        {/* Chat Panel */}
        <div className="flex-1 overflow-hidden">
          <EnhancedChatPanel
            isVisible={isVisible}
            onToggle={onToggle}
            messages={messages}
            participants={participants}
            currentUserAlias={currentUserAlias}
            sessionId={sessionId}
            onSendMessage={onSendMessage}
          />
        </div>
      </div>
    </motion.div>
  );
};