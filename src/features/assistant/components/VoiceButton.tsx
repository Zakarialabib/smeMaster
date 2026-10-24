/**
 * VoiceButton — Reusable voice input/output button for AI surfaces.
 *
 * Two modes:
 * - `input`: Records audio, transcribes via STT, returns text
 * - `output`: Speaks text via TTS
 *
 * Uses the voiceService for provider dispatch. Gracefully degrades when
 * voice is not configured or the provider doesn't support the direction.
 *
 * @module
 */

import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { cn } from '@shared/utils/cn';
import {
  getVoiceConfig,
  transcribeSpeech,
  synthesizeSpeech,
  getVoiceCapabilities,
} from '@shared/services/ai/voiceService';

// ── Props ────────────────────────────────────────────────────────────────────

export interface VoiceButtonProps {
  /** 'input' = STT (mic), 'output' = TTS (speaker) */
  mode: 'input' | 'output';
  /** For 'input': called with transcribed text */
  onTranscript?: (text: string) => void;
  /** For 'output': text to speak */
  text?: string;
  /** Additional classes */
  className?: string;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Disable the button */
  disabled?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

export function VoiceButton({
  mode,
  onTranscript,
  text,
  className,
  size = 'md',
  disabled = false,
}: VoiceButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleInput = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setError(null);
    setIsRecording(true);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);

        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (audioBlob.size === 0) {
          setError('No audio captured');
          return;
        }

        setIsTranscribing(true);
        try {
          const config = await getVoiceConfig();
          const capabilities = getVoiceCapabilities(config);
          if (!capabilities.stt) {
            setError('STT not available for this provider');
            return;
          }
          const transcript = await transcribeSpeech(audioBlob, config);
          if (transcript) {
            onTranscript?.(transcript);
          }
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
    } catch (e) {
      setIsRecording(false);
      setError((e as Error).message);
    }
  }, [isRecording, onTranscript]);

  const handleOutput = useCallback(async () => {
    if (isSpeaking) {
      // Stop speaking
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!text) return;

    setError(null);
    setIsSpeaking(true);

    try {
      const config = await getVoiceConfig();
      const capabilities = getVoiceCapabilities(config);
      if (!capabilities.tts) {
        setError('TTS not available for this provider');
        setIsSpeaking(false);
        return;
      }

      const audio = await synthesizeSpeech(text, config);
      if (audio) {
        // Play the audio blob
        const url = URL.createObjectURL(audio);
        const audioEl = new Audio(url);
        audioEl.onended = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
        };
        audioEl.onerror = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          setError('Failed to play audio');
        };
        await audioEl.play();
      } else {
        // Browser TTS returns null (speaks directly)
        setIsSpeaking(false);
      }
    } catch (e) {
      setIsSpeaking(false);
      setError((e as Error).message);
    }
  }, [isSpeaking, text]);

  const handleClick = () => {
    if (mode === 'input') {
      void handleInput();
    } else {
      void handleOutput();
    }
  };

  const isActive = mode === 'input' ? isRecording || isTranscribing : isSpeaking;
  const Icon =
    mode === 'input'
      ? isRecording
        ? MicOff
        : isTranscribing
          ? Loader2
          : Mic
      : isSpeaking
        ? VolumeX
        : Volume2;

  return (
    <div className={cn('flex flex-col items-center gap-1', className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isTranscribing}
        aria-label={mode === 'input' ? 'Voice input' : 'Speak response'}
        className={cn(
          'flex items-center justify-center rounded-full transition-all duration-200',
          size === 'sm' ? 'w-8 h-8' : 'w-10 h-10',
          isActive
            ? 'bg-accent text-white shadow-lg shadow-accent/30'
            : 'bg-white/10 text-text-secondary hover:bg-white/20 hover:text-text-primary',
          'border border-white/20',
        )}
      >
        <Icon
          className={cn(size === 'sm' ? 'w-4 h-4' : 'w-5 h-5', isTranscribing && 'animate-spin')}
        />
      </button>
      {error && <span className="text-[10px] text-danger text-center max-w-[100px]">{error}</span>}
    </div>
  );
}
