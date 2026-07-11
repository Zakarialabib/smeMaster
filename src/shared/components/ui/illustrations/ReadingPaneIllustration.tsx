interface Props {
  size?: number;
  className?: string;
}

export function ReadingPaneIllustration({ size = 140, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Letter peeking out */}
      <rect
        x="38"
        y="28"
        width="64"
        height="46"
        rx="4"
        fill="var(--color-bg-secondary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      {/* Letter lines */}
      <rect x="48" y="40" width="44" height="3" rx="1.5" fill="var(--color-accent)" opacity="0.3" />
      <rect x="48" y="48" width="34" height="2.5" rx="1.25" fill="var(--color-border-primary)" opacity="0.5" />
      <rect x="48" y="55" width="38" height="2.5" rx="1.25" fill="var(--color-border-primary)" opacity="0.35" />
      <rect x="48" y="62" width="26" height="2.5" rx="1.25" fill="var(--color-border-primary)" opacity="0.2" />
      {/* Envelope body */}
      <path
        d="M22 60 L70 90 L118 60 L118 105 C118 108.314 115.314 111 112 111 L28 111 C24.686 111 22 108.314 22 105 Z"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      {/* Envelope flap (slightly open) */}
      <path
        d="M22 60 L70 85 L118 60"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Subtle accent on flap edge */}
      <path
        d="M22 60 L70 85 L118 60"
        stroke="var(--color-accent)"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
        strokeLinejoin="round"
      />
      {/* Small seal / decoration */}
      <circle
        cx="70"
        cy="95"
        r="6"
        fill="var(--color-accent)"
        opacity="0.15"
      />
      <circle
        cx="70"
        cy="95"
        r="3.5"
        fill="var(--color-accent)"
        opacity="0.25"
      />
    </svg>
  );
}
