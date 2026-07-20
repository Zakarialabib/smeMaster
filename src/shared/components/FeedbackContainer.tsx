import React, { createContext, useContext, useEffect, ReactNode } from 'react';

interface Feedback {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface FeedbackContextType {
  feedback: Feedback | null;
  showFeedback: (feedback: Feedback) => void;
  hideFeedback: () => void;
}

const FeedbackContext = createContext<FeedbackContextType | undefined>(undefined);

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [feedback, setFeedback] = React.useState<Feedback | null>(null);

  const showFeedback = (newFeedback: Feedback) => {
    setFeedback(newFeedback);
  };

  const hideFeedback = () => {
    setFeedback(null);
  };

  return (
    <FeedbackContext.Provider value={{ feedback, showFeedback, hideFeedback }}>
      {children}
      {feedback && <FeedbackToast feedback={feedback} onClose={hideFeedback} />}
    </FeedbackContext.Provider>
  );
};

export const useFeedback = () => {
  const context = useContext(FeedbackContext);
  if (!context) {
    throw new Error('useFeedback must be used within a FeedbackProvider');
  }
  return context;
};

interface FeedbackToastProps {
  feedback: Feedback;
  onClose: () => void;
}

const FeedbackToast: React.FC<FeedbackToastProps> = ({ feedback, onClose }) => {
  useEffect(() => {
    if (feedback.duration) {
      const timer = setTimeout(onClose, feedback.duration);
      return () => clearTimeout(timer);
    }
  }, [feedback.duration, onClose]);

  const getColorClasses = () => {
    switch (feedback.type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getIcon = () => {
    switch (feedback.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '•';
    }
  };

  return (
    <div className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg border shadow-lg ${getColorClasses()} transition-all duration-300`}>
      <div className="flex items-center space-x-2">
        <span className="text-lg font-bold">{getIcon()}</span>
        <span className="font-medium">{feedback.message}</span>
        <button
          onClick={onClose}
          className="ml-2 font-bold hover:opacity-70"
        >
          ×
        </button>
      </div>
    </div>
  );
};
