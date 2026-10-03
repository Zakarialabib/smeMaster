import React, { useState, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  children?: ReactNode;
}

const VARIANT_CLASSES: Record<NonNullable<ConfirmationDialogProps['variant']>, string> = {
  danger: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  success: 'bg-green-50 border-green-200 text-green-800',
};

const VARIANT_BUTTON: Record<NonNullable<ConfirmationDialogProps['variant']>, string> = {
  danger: 'bg-red-600 hover:bg-red-700',
  warning: 'bg-yellow-600 hover:bg-yellow-700',
  info: 'bg-blue-600 hover:bg-blue-700',
  success: 'bg-green-600 hover:bg-green-700',
};

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  onConfirm,
  onCancel,
  children,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className={`border-l-4 ${VARIANT_CLASSES[variant]} p-4 rounded-r-lg mb-4`}>
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        <p className="text-gray-600 mb-6">{message}</p>

        {children}

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            {cancelText ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-white rounded ${VARIANT_BUTTON[variant]} disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {isLoading ? t('common.processing') : (confirmText ?? t('common.confirm'))}
          </button>
        </div>
      </div>
    </div>
  );
};
