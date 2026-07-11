import { useState, useEffect, useCallback, useRef } from "react";
import { Play, SkipForward, RotateCcw, X, Check } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import type { TemplateDemo as TemplateDemoType } from "@features/mail/constants/templateDemos";

interface TemplatePickerInfo {
  id: string;
  name: string;
}

interface TemplateDemoProps {
  demo: TemplateDemoType;
  onClose: () => void;
  onSelect?: (template: TemplatePickerInfo) => void;
  pickerTemplate?: TemplatePickerInfo | null;
}

function useTypewriter(text: string, speed = 30): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);

  useEffect(() => {
    setDisplayed("");
    indexRef.current = 0;
    if (!text) return;
    const interval = setInterval(() => {
      indexRef.current++;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return displayed;
}

export function TemplateDemo({ demo, onClose, onSelect, pickerTemplate }: TemplateDemoProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [completed, setCompleted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (paused || completed) return;
    const screen = demo.screens[currentStep];
    if (!screen) return;
    timerRef.current = setTimeout(() => {
      const next = currentStep + 1;
      if (next >= demo.screens.length) {
        setCompleted(true);
      } else {
        setCurrentStep(next);
      }
    }, screen.duration);
  }, [currentStep, demo.screens, paused, completed, clearTimer]);

  useEffect(() => {
    if (!paused && !completed) {
      startTimer();
    }
    return clearTimer;
  }, [currentStep, paused, completed, startTimer, clearTimer]);

  const handleSkip = useCallback(() => {
    clearTimer();
    setCompleted(true);
  }, [clearTimer]);

  const handleReplay = useCallback(() => {
    setCurrentStep(0);
    setCompleted(false);
    setPaused(false);
  }, []);

  const handlePauseToggle = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const screen = demo.screens[currentStep];
  const typedAction = useTypewriter(screen?.simulatedAction ?? "", 25);
  const progress = completed
    ? 100
    : ((currentStep + 1) / demo.screens.length) * 100;

  if (!screen) return null;

  return (
    <div
      className="fixed inset-0 z-50 glass-backdrop flex items-center justify-center"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      ref={containerRef}
    >
      <div className="glass-modal rounded-2xl p-8 max-w-lg w-full mx-4 border border-border-primary shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Play size={14} className="text-accent" />
            <span className="text-xs font-semibold text-text-primary">{demo.name}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-tertiary hover:text-text-primary rounded hover:bg-bg-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-6">
          {demo.screens.map((_, idx) => (
            <div
              key={idx}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                idx === currentStep
                  ? "bg-accent"
                  : idx < currentStep
                    ? "bg-accent/40"
                    : "bg-bg-tertiary"
              }`}
            />
          ))}
        </div>

        {/* Step number */}
        <div className="text-[0.625rem] font-medium text-text-tertiary uppercase tracking-wider mb-2">
          Step {currentStep + 1} of {demo.screens.length}
        </div>

        {/* Title */}
        <h3 className="text-lg font-bold text-text-primary mb-2">{screen.title}</h3>

        {/* Description */}
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">{screen.description}</p>

        {/* Simulated action */}
        <div className="bg-bg-tertiary rounded-xl p-4 mb-6 border border-border-secondary min-h-[48px]">
          <div className="flex items-start gap-2">
            <span className="text-xs text-text-tertiary font-medium shrink-0 mt-0.5">→</span>
            <p className="text-sm text-text-primary font-mono">{typedAction}<span className="animate-pulse">|</span></p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 bg-bg-tertiary rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {completed ? (
              <Button variant="primary" size="sm" onClick={handleReplay}>
                <RotateCcw size={14} />
                Replay
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={handlePauseToggle}>
                {paused ? "Resume" : "Pause"}
              </Button>
            )}
            {!completed && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <SkipForward size={14} />
                Skip
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onSelect && pickerTemplate && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onSelect(pickerTemplate);
                  onClose();
                }}
              >
                <Check size={14} />
                Insert Template
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              {completed ? "Close" : "Exit"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
