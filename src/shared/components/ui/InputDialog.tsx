import { useState, useEffect, useRef, useCallback } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { INPUT_BASE } from "@shared/styles/ui-tokens";

interface InputField {
  key: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

interface InputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => void;
  title: string;
  fields: InputField[];
  submitLabel?: string;
}

export function InputDialog({
  isOpen,
  onClose,
  onSubmit,
  title,
  fields,
  submitLabel = "Save",
}: InputDialogProps) {
  const buildInitial = useCallback(
    () =>
      Object.fromEntries(
        fields.map((f) => [f.key, f.defaultValue ?? ""]),
      ),
    [fields],
  );

  const [values, setValues] = useState<Record<string, string>>(buildInitial);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValues(buildInitial());
      const id = setTimeout(() => firstInputRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [isOpen, buildInitial]);

  const isValid = fields.every((f) => {
    const required = f.required ?? true;
    return !required || values[f.key]?.trim();
  });

  const handleSubmit = () => {
    if (!isValid) return;
    onSubmit(values);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && fields.length === 1 && isValid) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} width="w-96" liquidGlass>
      <div className="p-5 space-y-4" onKeyDown={handleKeyDown}>
        {fields.map((field, i) => (
          <div key={field.key}>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              {field.label}
            </label>
            <input
              ref={i === 0 ? firstInputRef : undefined}
              type="text"
              value={values[field.key] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
              }
              placeholder={field.placeholder}
              className={INPUT_BASE}
            />
          </div>
        ))}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!isValid}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
