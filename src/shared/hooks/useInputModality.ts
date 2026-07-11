import { useEffect, useState } from 'react';

export type InputModality = 'touch' | 'mouse' | 'keyboard';

/**
 * Detects the current input modality (touch, mouse, or keyboard).
 * - 'touch': user is interacting via touch screen
 * - 'mouse': user is using a mouse/pointer
 * - 'keyboard': user is navigating via keyboard (Tab/Enter)
 * 
 * Adds a data attribute `data-input-modality` to <html> element
 * for CSS targeting (e.g., `.touch .button { min-height: 44px }`).
 */
export function useInputModality(): InputModality {
  const [modality, setModality] = useState<InputModality>('mouse');

  useEffect(() => {
    const handlePointer = (e: PointerEvent) => {
      const newModality: InputModality = e.pointerType === 'touch' ? 'touch' : 'mouse';
      setModality(newModality);
      document.documentElement.setAttribute('data-input-modality', newModality);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') {
        setModality('keyboard');
        document.documentElement.setAttribute('data-input-modality', 'keyboard');
      }
    };

    const handleMouseMove = () => {
      if (modality === 'keyboard') {
        setModality('mouse');
        document.documentElement.setAttribute('data-input-modality', 'mouse');
      }
    };

    document.addEventListener('pointerdown', handlePointer);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousemove', handleMouseMove);

    // Set initial value
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const initial: InputModality = hasTouch ? 'touch' : 'mouse';
    setModality(initial);
    document.documentElement.setAttribute('data-input-modality', initial);

    return () => {
      document.removeEventListener('pointerdown', handlePointer);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [modality]);

  return modality;
}