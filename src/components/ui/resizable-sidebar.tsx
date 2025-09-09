import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface ResizableSidebarProps {
  children: React.ReactNode;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  position?: 'left' | 'right';
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const ResizableSidebar = ({
  children,
  defaultWidth = 280,
  minWidth = 200,
  maxWidth = 500,
  className,
  position = 'left',
  collapsible = false,
  collapsed = false,
  onCollapsedChange
}: ResizableSidebarProps) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !sidebarRef.current) return;

      const sidebar = sidebarRef.current;
      const rect = sidebar.getBoundingClientRect();
      
      let newWidth;
      if (position === 'left') {
        newWidth = e.clientX - rect.left;
      } else {
        newWidth = rect.right - e.clientX;
      }

      // Constrain width within bounds
      newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(newWidth);
    },
    [isResizing, position, minWidth, maxWidth]
  );

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('mousemove', resize);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', resize);
      document.removeEventListener('mouseup', stopResizing);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, resize, stopResizing]);

  const actualWidth = collapsed ? (collapsible ? 60 : width) : width;

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "relative bg-background border-r border-border transition-all duration-200 ease-in-out",
        "z-[9999]", // High z-index to stay above components
        isResizing && "select-none",
        className
      )}
      style={{ 
        position: 'relative',
        zIndex: 9999,
        width: actualWidth,
        minWidth: collapsed && collapsible ? 60 : minWidth,
        maxWidth: collapsed && collapsible ? 60 : maxWidth
      }}
    >
      {/* Sidebar content */}
      <div className="h-full overflow-hidden">
        {children}
      </div>

      {/* Resize handle */}
      {!collapsed && (
        <div
          ref={resizerRef}
          className={cn(
            "absolute top-0 w-1 h-full cursor-col-resize bg-transparent hover:bg-primary/20 transition-colors",
            "group flex items-center justify-center",
            position === 'left' ? "right-0" : "left-0"
          )}
          onMouseDown={startResizing}
        >
          {/* Visual grip indicator */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      )}

      {/* Resizing overlay */}
      {isResizing && (
        <div className="fixed inset-0 z-[100000] cursor-col-resize" />
      )}
    </div>
  );
};

export default ResizableSidebar;