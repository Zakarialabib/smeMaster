import { useState, ReactNode, FormEvent } from 'react';

interface FormWrapperProps<T extends Record<string, any>> {
  onSubmit: (data: T) => Promise<void> | void;
  defaultValues?: T;
  children: (form: { values: T; setField: <K extends keyof T>(key: K, value: T[K]) => void; reset: () => void }) => ReactNode;
}

export const FormWrapper = <T extends Record<string, any>>(props: FormWrapperProps<T>) => {
  const [values, setValues] = useState<T>(() => (props.defaultValues ?? ({} as T)) as T);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setField = <K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setValues((props.defaultValues ?? ({} as T)) as T);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await props.onSubmit(values);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {props.children({ values, setField, reset })}
      {isSubmitting && <input type="hidden" disabled value="submitting" />}
    </form>
  );
};
