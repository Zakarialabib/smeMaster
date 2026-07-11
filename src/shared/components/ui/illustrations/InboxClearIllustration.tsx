interface Props {
  size?: number;
  className?: string;
}

export function InboxClearIllustration({ size = 140, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Mailbox tray */}
      <rect
        x="25"
        y="55"
        width="90"
        height="50"
        rx="8"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
      />
      {/* Tray inner shadow */}
      <rect
        x="32"
        y="62"
        width="76"
        height="36"
        rx="4"
        fill="var(--color-bg-secondary)"
      />
      {/* Open lid */}
      <path
        d="M25 63 L70 38 L115 63"
        stroke="var(--color-border-primary)"
        strokeWidth="1.5"
        fill="var(--color-bg-tertiary)"
        strokeLinejoin="round"
      />
      {/* Checkmark circle */}
      <circle
        cx="70"
        cy="72"
        r="16"
        fill="var(--color-accent)"
        opacity="0.15"
      />
      <circle
        cx="70"
        cy="72"
        r="12"
        fill="var(--color-accent)"
        opacity="0.25"
      />
      {/* Checkmark */}
      <path
        d="M62 72 L67 77 L78 66"
        stroke="var(--color-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Sparkle top-right */}
      <circle cx="102" cy="40" r="2.5" fill="var(--color-accent)" opacity="0.5" />
      <circle cx="110" cy="48" r="1.5" fill="var(--color-accent)" opacity="0.35" />
      {/* Sparkle top-left */}
      <circle cx="38" cy="35" r="2" fill="var(--color-accent)" opacity="0.4" />
      <circle cx="30" cy="44" r="1.5" fill="var(--color-accent)" opacity="0.3" />
      {/* Sparkle bottom */}
      <circle cx="95" cy="95" r="1.5" fill="var(--color-accent)" opacity="0.3" />
    </svg>
  );
}
