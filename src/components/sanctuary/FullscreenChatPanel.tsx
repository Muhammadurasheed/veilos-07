import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Maximize2, 
  Minimize2, 
  PanelRightClose, 
  PanelRightOpen,
  GripVertical,
  MessageSquare,
  Users,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EnhancedChatPanel } from './EnhancedChatPanel';

interface FullscreenChatPanelProps {
  isVisible: boolean;
  messages: any[];
  participants: any[];
  currentUserAlias: string;
  sessionId: string;
  onSendMessage: (content: string, type?: string, attachment?: any, replyTo?: string) => void;
  className?: string;
}

export const FullscreenChatPanel: React.FC<FullscreenChatPanelProps> = ({
  isVisible,
  messages,
  participants,
  currentUserAlias,
  sessionId,
  onSendMessage,
  className
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [width, setWidth] = useState(400);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);

  // Handle window resize in fullscreen mode
  useEffect(() => {
    const handleResize = () => {
      if (isFullscreen && panelRef.current) {
        const maxWidth = window.innerWidth - 40; // 20px margin on each side
        if (width > maxWidth) {
          setWidth(maxWidth);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isFullscreen, width]);

  // Handle escape key for fullscreen exit
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isFullscreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = width;
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = dragStartX.current - e.clientX; // Negative because we're resizing from right edge
    const newWidth = Math.max(300, Math.min(800, dragStartWidth.current + deltaX));
    setWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      setIsCollapsed(false); // Ensure it's not collapsed when going fullscreen
    }
  };

  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
    if (isCollapsed && isFullscreen) {
      setIsFullscreen(false); // Exit fullscreen if expanding from collapsed
    }
  };

  if (!isVisible) return null;

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card 
          className={cn(
            "h-full transition-all duration-300 flex flex-col overflow-hidden shadow-2xl border-2",
            isDragging && "select-none"
          )}
          style={{ 
            width: `${width}px`,
            maxWidth: '90vw'
          }}
        >
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between p-4 border-b bg-primary/5">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-lg">Chat - Fullscreen</h3>
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {participants.length}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="hover:bg-primary/10"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-primary/20 hover:bg-primary/40 transition-colors group"
            onMouseDown={handleMouseDown}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <GripVertical className="h-4 w-4 text-primary" />
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            <EnhancedChatPanel
              isVisible={true}
              onToggle={() => {}}
              messages={messages}
              participants={participants}
              currentUserAlias={currentUserAlias}
              sessionId={sessionId}
              onSendMessage={onSendMessage}
            />
          </div>
        </Card>
      </div>
    );
  }

  // Regular resizable panel mode
  return (
    <div 
      ref={panelRef}
      className={cn(
        "fixed right-0 top-0 bottom-0 z-40 transition-all duration-300 flex flex-col bg-background border-l shadow-xl",
        isCollapsed ? "w-12" : `w-[${width}px]`,
        isDragging && "select-none",
        className
      )}
      style={{ 
        width: isCollapsed ? '48px' : `${width}px`,
        minWidth: isCollapsed ? '48px' : '300px',
        maxWidth: isCollapsed ? '48px' : '50vw'
      }}
    >
      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize bg-primary/20 hover:bg-primary/40 transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <GripVertical className="h-4 w-4 text-primary" />
          </div>
        </div>
      )}

      {/* Collapsed State */}
      {isCollapsed && (
        <div className="flex flex-col items-center justify-center h-full space-y-4 p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleCollapsed}
            className="rotate-90"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col items-center space-y-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <Badge variant="outline" className="text-xs p-1 rotate-90 origin-center">
              {messages.length}
            </Badge>
          </div>

          <Badge variant="outline" className="text-xs p-1 rotate-90 origin-center">
            <Users className="h-3 w-3" />
          </Badge>
        </div>
      )}

      {/* Expanded State */}
      {!isCollapsed && (
        <>
          {/* Header Controls */}
          <div className="flex items-center justify-between p-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Chat</span>
              <Badge variant="outline" className="text-xs">
                <Users className="h-3 w-3 mr-1" />
                {participants.length}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="h-7 w-7 p-0 hover:bg-primary/10"
                title="Fullscreen"
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleCollapsed}
                className="h-7 w-7 p-0 hover:bg-primary/10"
                title="Collapse"
              >
                <PanelRightClose className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 overflow-hidden">
            <EnhancedChatPanel
              isVisible={true}
              onToggle={() => {}}
              messages={messages}
              participants={participants}
              currentUserAlias={currentUserAlias}
              sessionId={sessionId}
              onSendMessage={onSendMessage}
            />
          </div>
        </>
      )}
    </div>
  );
};