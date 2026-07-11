import { useBreakpoint } from '@/shared/hooks/useBreakpoint';

export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'select' | 'textarea' | 'date' | 'toggle';

export interface FieldDefinition {
  key: string;
  label: string;
  type: FieldType;
  value: string | number | boolean;
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  section?: string;
  sectionPriority?: number;
}

interface DynamicFieldRendererProps {
  fields: FieldDefinition[];
  onChange: (key: string, value: string | number | boolean) => void;
  columns?: 1 | 2;
  className?: string;
}

function renderInput(field: FieldDefinition, onChange: (val: string | number | boolean) => void) {
  const baseClass = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent min-h-[44px]';

  switch (field.type) {
    case 'select':
      return (
        <select
          value={String(field.value)}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          required={field.required}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    case 'textarea':
      return (
        <textarea
          value={String(field.value)}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} min-h-[80px] resize-y`}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    case 'toggle':
      return (
        <button
          onClick={() => onChange(!field.value)}
          className={`relative w-10 h-6 rounded-full transition-colors ${field.value ? 'bg-accent' : 'bg-gray-300 dark:bg-gray-600'} min-h-[44px] min-w-[44px] flex items-center justify-center`}
          role="switch"
          aria-checked={Boolean(field.value)}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${field.value ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      );
    default:
      return (
        <input
          type={field.type}
          value={String(field.value)}
          onChange={(e) => onChange(e.target.value)}
          className={baseClass}
          placeholder={field.placeholder}
          required={field.required}
          inputMode={field.type === 'number' ? 'numeric' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text'}
        />
      );
  }
}

export function DynamicFieldRenderer({ fields, onChange, columns, className = '' }: DynamicFieldRendererProps) {
  const bp = useBreakpoint();
  const isMobile = bp === 'mobile';
  const effectiveColumns = columns ?? (isMobile ? 1 : 2);

  // Group by section
  const sections = fields.reduce<Record<string, FieldDefinition[]>>((acc, field) => {
    const section = field.section ?? 'General';
    if (!acc[section]) acc[section] = [];
    acc[section].push(field);
    return acc;
  }, {});

  const sortedSections = Object.entries(sections).sort(([, a], [, b]) =>
    (a[0]?.sectionPriority ?? 99) - (b[0]?.sectionPriority ?? 99)
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {sortedSections.map(([sectionName, sectionFields]) => (
        <div key={sectionName}>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-1">
            {sectionName}
          </h3>
          <div className={`grid gap-3 ${effectiveColumns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {sectionFields.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                  {field.label}
                  {field.required && <span className="text-red-500">*</span>}
                </label>
                {renderInput(field, (val) => onChange(field.key, val))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}