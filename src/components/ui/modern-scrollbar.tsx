import React from 'react';
import { cn } from '@/lib/utils';

interface ModernScrollbarProps {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
  hideScrollbar?: boolean;
}

export const ModernScrollbar = ({ 
  children, 
  className, 
  maxHeight = "100%",
  hideScrollbar = false 
}: ModernScrollbarProps) => {
  return (
    <div 
      className={cn(
        "overflow-auto",
        // Modern scrollbar styles
        hideScrollbar ? "scrollbar-hide" : "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40",
        className
      )}
      style={{ maxHeight }}
    >
      {children}
    </div>
  );
};

export default ModernScrollbar;