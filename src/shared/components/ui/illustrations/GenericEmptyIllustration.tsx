interface Props {
  size?: number;
  className?: string;
}

export function GenericEmptyIllustration({ size = 140, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Box back face */}
      <path
        d="M35 55 L70 40 L105 55 L105 90 L70 105 L35 90 Z"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Box center line */}
      <line
        x1="70"
        y1="70"
        x2="70"
        y2="105"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      {/* Box left-center edge */}
      <line
        x1="35"
        y1="55"
        x2="70"
        y2="70"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      {/* Box right-center edge */}
      <line
        x1="105"
        y1="55"
        x2="70"
        y2="70"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      {/* Open flap left */}
      <path
        d="M35 55 L52 38 L70 48 L70 70 L35 55"
        fill="var(--color-bg-secondary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Open flap right */}
      <path
        d="M105 55 L88 38 L70 48 L70 70 L105 55"
        fill="var(--color-bg-secondary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Floating particles */}
      <circle cx="55" cy="32" r="3" fill="var(--color-accent)" opacity="0.25" />
      <circle cx="85" cy="28" r="2.5" fill="var(--color-accent)" opacity="0.2" />
      <circle cx="70" cy="22" r="2" fill="var(--color-accent)" opacity="0.35" />
      <circle cx="45" cy="42" r="1.5" fill="var(--color-accent)" opacity="0.15" />
      <circle cx="98" cy="38" r="2" fill="var(--color-accent)" opacity="0.18" />
      <circle cx="62" cy="26" r="1.5" fill="var(--color-accent)" opacity="0.12" />
    </svg>
  );
}
