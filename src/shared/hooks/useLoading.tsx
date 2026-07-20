import React, { createContext, useContext, ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage?: string;
  setLoadingMessage: (message?: string) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingMessage, setLoadingMessageState] = React.useState<string | undefined>(undefined);

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
    if (!loading) {
      setLoadingMessageState(undefined);
    }
  };

  const setLoadingMessage = (message?: string) => {
    setLoadingMessageState(message);
  };

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading, loadingMessage, setLoadingMessage }}>
      {children}
      {isLoading && <GlobalLoadingSpinner message={loadingMessage} />}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

interface GlobalLoadingSpinnerProps {
  message?: string;
}

const GlobalLoadingSpinner: React.FC<GlobalLoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full border-4 border-transparent border-t-blue-600 w-12 h-12" />
        {message && <p className="text-gray-600 font-medium">{message}</p>}
      </div>
    </div>
  );
};
