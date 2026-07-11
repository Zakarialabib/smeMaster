import { useMemo, useRef } from 'react';
import { usePlatform } from '@/shared/hooks/usePlatform';
import { FloatingFormatBar } from '@/shared/components/ui/FloatingFormatBar';
import type { FormatAction } from '@/shared/components/ui/FloatingFormatBar';

interface MobileEditorProps {
  children: React.ReactNode;
  className?: string;
}

/** Safe wrapper around document.queryCommandState (throws in JSDOM). */
function queryState(cmd: string): boolean {
  try {
    return document.queryCommandState(cmd);
  } catch {
    return false;
  }
}

export function MobileEditor({ children, className = '' }: MobileEditorProps) {
  const { screen } = usePlatform();
  const editorRef = useRef<HTMLDivElement>(null);
  const isMobile = screen.category === 'phone' || screen.category === 'phone-folded';

  const formatActions: FormatAction[] = useMemo(() => [
    { id: 'bold', label: 'Bold', icon: <span className="font-bold">B</span>, onAction: () => document.execCommand('bold'), isActive: queryState('bold') },
    { id: 'italic', label: 'Italic', icon: <span className="italic">I</span>, onAction: () => document.execCommand('italic'), isActive: queryState('italic') },
    { id: 'underline', label: 'Underline', icon: <span className="underline">U</span>, onAction: () => document.execCommand('underline'), isActive: queryState('underline') },
    { id: 'link', label: 'Link', icon: <span>🔗</span>, onAction: () => {
      const url = prompt('Enter URL:');
      if (url) document.execCommand('createLink', false, url);
    }},
    { id: 'heading', label: 'Heading', icon: <span className="font-bold text-xs">H</span>, onAction: () => document.execCommand('formatBlock', false, '<h2>') },
  ], []);

  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div className={`relative ${className}`}>
      <FloatingFormatBar actions={formatActions} targetRef={editorRef as React.RefObject<HTMLElement | null>} />
      <div
        ref={editorRef}
        className="prose prose-sm dark:prose-invert max-w-none"
        style={{
          fontSize: 'clamp(16px, 4vw, 18px)',
          lineHeight: 1.7,
          padding: '24px 16px',
        }}
      >
        {children}
      </div>
    </div>
  );
}