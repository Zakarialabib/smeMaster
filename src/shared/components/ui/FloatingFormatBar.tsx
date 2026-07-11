import { useState, useEffect, useRef, useCallback } from 'react';

export interface FormatAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  isActive?: boolean;
  onAction: () => void;
}

interface FloatingFormatBarProps {
  actions: FormatAction[];
  targetRef: React.RefObject<HTMLElement | null>;
  className?: string;
}

export function FloatingFormatBar({ actions, targetRef, className = '' }: FloatingFormatBarProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) {
      setPosition(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }

    const barWidth = barRef.current?.offsetWidth ?? 200;
    const barHeight = 44;
    const top = rect.top - barHeight - 8;
    const left = rect.left + rect.width / 2 - barWidth / 2;

    setPosition({
      top: Math.max(8, top),
      left: Math.max(8, Math.min(left, window.innerWidth - barWidth - 8)),
    });
  }, []);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const onMouseUp = () => {
      setTimeout(updatePosition, 0);
    };
    const onTouchEnd = () => {
      setTimeout(updatePosition, 300);
    };
    const onClick = () => {
      setPosition(null);
    };

    target.addEventListener('mouseup', onMouseUp);
    target.addEventListener('touchend', onTouchEnd);
    document.addEventListener('click', onClick);

    return () => {
      target.removeEventListener('mouseup', onMouseUp);
      target.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('click', onClick);
    };
  }, [targetRef, updatePosition]);

  if (!position) return null;

  return (
    <div
      ref={barRef}
      className={`fixed z-[9999] flex items-center gap-0.5 px-1.5 py-1 bg-gray-900 dark:bg-gray-700 rounded-lg shadow-xl border border-gray-700 dark:border-gray-600 transition-opacity ${className}`}
      style={{ top: position.top, left: position.left }}
    >
      {actions.map((action) => (
        <button
          key={action.id}
          onClick={(e) => { e.preventDefault(); action.onAction(); }}
          className={`flex items-center justify-center w-9 h-9 rounded-md text-sm transition-colors ${
            action.isActive
              ? 'bg-accent/20 text-accent'
              : 'text-gray-200 hover:bg-gray-700 dark:hover:bg-gray-600'
          }`}
          title={action.label}
          aria-label={action.label}
        >
          {action.icon}
        </button>
      ))}
    </div>
  );
}