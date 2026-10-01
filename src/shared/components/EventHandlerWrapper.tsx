import React, { useEffect, useRef, ReactNode } from 'react';
import { uiBus, UiBusEventName } from '@shared/services/events/uiBus';

interface EventHandlerProps {
  event: UiBusEventName;
  handler: (...args: any[]) => void;
  dependencies?: any[];
  children?: ReactNode;
}

export const EventHandlerWrapper: React.FC<EventHandlerProps> = ({
  event,
  handler,
  dependencies = [],
  children,
}) => {
  const handlerRef = useRef(handler);
  const offRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // A spread dependency array cannot be statically verified by the linter, and
  // a caller passing a fresh array literal would resubscribe on every render.
  // Keying the subscription on a stable serialisation of the declared
  // dependencies keeps the "resubscribe when these change" contract without
  // either hazard.
  const depsKey = JSON.stringify(dependencies ?? []);

  useEffect(() => {
    offRef.current = uiBus.on(event, (...args) => {
      handlerRef.current(...args);
    });

    return () => {
      if (offRef.current) offRef.current();
    };
  }, [event, depsKey]);

  return children || null;
};
