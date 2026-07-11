import { useTranslation } from "react-i18next";

interface ComposerSubjectFieldProps {
  subject: string;
  onChange: (subject: string) => void;
}

export function ComposerSubjectField({ subject, onChange }: ComposerSubjectFieldProps) {
  const { t } = useTranslation();

  return (
    <div className="px-5 py-2 border-b border-border-secondary">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-tertiary w-8 shrink-0">
          {t('composer.sub')}
        </span>
        <input
          type="text"
          value={subject}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('composer.subject')}
          className="flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
        />
      </div>
    </div>
  );
}
