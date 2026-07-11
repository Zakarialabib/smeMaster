import { useState, useCallback } from 'react';

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

export function useFormField({ initialValue = '', validator }: UseFormFieldOptions = {}): UseFormFieldReturn {
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

  return { value, error, touched, onChange, onBlur, reset };
}