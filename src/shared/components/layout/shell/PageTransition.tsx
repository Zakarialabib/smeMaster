import { useEffect, useState, useRef } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
  /** Unique key that triggers transition when changed */
  routeKey: string;
  className?: string;
}

export function PageTransition({ children, routeKey, className = '' }: PageTransitionProps) {
  const [isEntering, setIsEntering] = useState(false);
  const prevKey = useRef(routeKey);

  useEffect(() => {
    if (prevKey.current !== routeKey) {
      setIsEntering(true);
      const timer = setTimeout(() => {
        setIsEntering(false);
      }, 300);
      prevKey.current = routeKey;
      return () => clearTimeout(timer);
    }
  }, [routeKey]);

  return (
    <div
      className={`${className} ${
        isEntering
          ? 'page-slide-enter-active'
          : ''
      }`}
      style={{
        animation: isEntering ? 'none' : undefined,
      }}
    >
      {children}
    </div>
  );
}