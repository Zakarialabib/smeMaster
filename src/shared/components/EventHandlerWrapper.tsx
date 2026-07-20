import React, { useEffect, useRef, ReactNode } from 'react';
import { uiBus } from '@shared/services/events/uiBus';

interface EventHandlerProps {
  event: string;
  handler: (...args: any[]) => void;
  dependencies?: any[];
  children?: ReactNode;
}

export const EventHandlerWrapper: React.FC<EventHandlerProps> = ({
  event,
  handler,
  dependencies = [],
  children
}) => {
  const handlerRef = useRef(handler);
  const offRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    offRef.current = uiBus.on(event, (...args) => {
      handlerRef.current(...args);
    });

    return () => {
      if (offRef.current) offRef.current();
    };
  }, [event, ...dependencies]);

  return children || null;
};
