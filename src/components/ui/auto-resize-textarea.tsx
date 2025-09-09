import React, { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

interface AutoResizeTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  minRows?: number;
  maxRows?: number;
  className?: string;
}

export const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, AutoResizeTextareaProps>(
  ({ value, onChange, minRows = 1, maxRows = 10, className, ...props }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const adjustHeight = () => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      // Reset height to auto to get the natural height
      textarea.style.height = 'auto';
      
      // Calculate the new height
      const scrollHeight = textarea.scrollHeight;
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
      
      const minHeight = lineHeight * minRows;
      const maxHeight = lineHeight * maxRows;
      
      const newHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));
      
      textarea.style.height = `${newHeight}px`;
    };

    useEffect(() => {
      adjustHeight();
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e);
      // Adjust height after state update
      setTimeout(adjustHeight, 0);
    };

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        className={cn(
          "flex min-h-[40px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "resize-none overflow-hidden",
          className
        )}
        rows={minRows}
        {...props}
      />
    );
  }
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";