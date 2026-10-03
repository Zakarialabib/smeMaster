import { useState, useEffect, useCallback, useMemo } from 'react';

interface UsePersistentStateOptions<T> {
  key: string;
  defaultValue: T;
  storage?: 'localStorage' | 'sessionStorage' | 'memory';
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
  syncAcrossTabs?: boolean;
}

function getStorage(storage: string) {
  switch (storage) {
    case 'localStorage':
      return window.localStorage;
    case 'sessionStorage':
      return window.sessionStorage;
    case 'memory':
      return null;
    default:
      return window.localStorage;
  }
}

export const usePersistentState = <T>(
  key: string,
  defaultValue: T,
  options: Partial<UsePersistentStateOptions<T>> = {},
) => {
  const {
    storage = 'localStorage',
    serializer = JSON.stringify,
    deserializer = JSON.parse,
    syncAcrossTabs = true,
  } = options;

  const storageInstance = useMemo(() => getStorage(storage), [storage]);

  const [state, setState] = useState<T>(() => {
    if (storage === 'memory') {
      return defaultValue;
    }

    try {
      const storedValue = storageInstance?.getItem(key);
      if (storedValue != null) {
        return deserializer(storedValue) as T;
      }
    } catch (error) {
      console.error(`Error reading persistent state for key '${key}':`, error);
    }

    return defaultValue;
  });

  const setPersistentState = useCallback(
    (value: T | ((prev: T) => T)) => {
      // Functional update form: reads the previous value from React rather
      // than the render closure, so back-to-back calls cannot clobber each
      // other and `state` is not needed as a dependency.
      setState((prev) => {
        const newValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;

        try {
          if (storage !== 'memory') {
            storageInstance?.setItem(key, serializer(newValue));
          }
        } catch (error) {
          console.error(`Error writing persistent state for key '${key}':`, error);
        }

        return newValue;
      });
    },
    [key, serializer, storage, storageInstance],
  );

  useEffect(() => {
    if (!syncAcrossTabs || storage === 'memory') {
      return;
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === key && event.newValue !== null) {
        try {
          const newValue = deserializer(event.newValue) as T;
          setState(newValue);
        } catch (error) {
          console.error(`Error parsing persistent state update for key '${key}':`, error);
        }
      } else if (event.key === key && event.newValue === null) {
        setState(defaultValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, deserializer, defaultValue, syncAcrossTabs, storage]);

  return [state, setPersistentState] as const;
};
