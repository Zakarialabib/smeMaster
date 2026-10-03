import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { VoiceButton } from '@features/assistant/components/VoiceButton';
import { Modal } from '@shared/components/ui/Modal';
import { Button } from '@shared/components/ui/Button';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTranscribe: (text: string) => void;
}

export function VoiceModal({ isOpen, onClose, onTranscribe }: VoiceModalProps) {
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState('');
  const [lastResult, setLastResult] = useState('');

  const handleTranscript = useCallback((text: string) => {
    setTranscript((prev) => prev + (prev ? ' ' : '') + text);
    setLastResult(text);
  }, []);

  const handleClear = () => {
    setTranscript('');
    setLastResult('');
  };

  const handleInsert = () => {
    if (!transcript.trim()) return;
    onTranscribe(transcript.trim());
    setTranscript('');
    setLastResult('');
    onClose();
  };

  const handleClose = () => {
    setTranscript('');
    setLastResult('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('composer.voiceComposeTitle')}>
      <div className="space-y-4">
        {/* Transcribed text preview */}
        <div className="min-h-[80px] max-h-[200px] overflow-y-auto rounded-lg bg-bg-secondary p-3 text-sm">
          {transcript || (
            <span className="text-text-tertiary italic">
              {t('composer.voiceComposePlaceholder')}
            </span>
          )}
        </div>

        {/* Last result */}
        {lastResult && (
          <div className="text-xs text-text-tertiary">
            {t('composer.voiceComposeLastResult', { result: lastResult })}
          </div>
        )}

        {/* Voice input */}
        <div className="flex items-center justify-center gap-3">
          <VoiceButton mode="input" size="sm" onTranscript={handleTranscript} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="secondary" size="sm" onClick={handleClear}>
            <Trash2 size={14} className="mr-1" />
            {t('composer.voiceComposeClear')}
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              {t('composer.voiceComposeCancel')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleInsert}
              disabled={!transcript.trim()}
            >
              {t('composer.voiceComposeInsert')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
