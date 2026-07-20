import React, { FormProvider, useForm, UseFormReturn } from 'react-hook-form';
import { ReactNode } from 'react';

interface FormWrapperProps<T extends Record<string, any>> {
  onSubmit: (data: T) => Promise<void> | void;
  defaultValues?: T;
  children: (form: UseFormReturn<T>) => ReactNode;
  validationResolver?: any;
}

export const FormWrapper = <T extends Record<string, any>>(
  props: FormWrapperProps<T>
) => {
  const form = useForm<T>({
    defaultValues: props.defaultValues,
    resolver: props.validationResolver,
  });

  const handleSubmit = async (e: React.BaseSyntheticEvent) => {
    e.preventDefault();
    await form.handleSubmit(async (data) => {
      await props.onSubmit(data);
    })(e);
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit}>
        {props.children(form)}
      </form>
    </FormProvider>
  );
};
