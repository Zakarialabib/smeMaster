import { useState, useCallback, useMemo } from 'react';

type Validator = (value: string) => string | undefined;

interface UseFormFieldOptions {
  initialValue?: string;
  validator?: Validator;
}

interface UseFormFieldReturn {
  value: string;
  error: string | undefined;
  touched: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  reset: () => void;
}

export function useFormField({
  initialValue = '',
  validator,
}: UseFormFieldOptions = {}): UseFormFieldReturn {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  const error = touched && validator ? validator(value) : undefined;

  const onChange = useCallback((newValue: string) => {
    setValue(newValue);
  }, []);

  const onBlur = useCallback(() => {
    setTouched(true);
  }, []);

  const reset = useCallback(() => {
    setValue(initialValue);
    setTouched(false);
  }, [initialValue]);

  // Memoised so the returned object is referentially stable while its
  // contents are unchanged. Without this every consumer re-created the object
  // each render, making it unusable as a hook dependency.
  return useMemo(
    () => ({ value, error, touched, onChange, onBlur, reset }),
    [value, error, touched, onChange, onBlur, reset],
  );
}
