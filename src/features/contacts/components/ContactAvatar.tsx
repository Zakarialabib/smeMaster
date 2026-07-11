import { memo, useMemo } from "react";

interface ContactAvatarProps {
  /** Image URL (e.g. from gravatar). If null, shows initial letter fallback. */
  imageUrl?: string | null;
  /** Display name used to extract the initial letter */
  name: string | null | undefined;
  /** Email used as fallback for initial extraction */
  email?: string | null;
  /** Size of the avatar (both width and height). Default: 64px (w-16 h-16) */
  size?: number;
  /** Additional class names */
  className?: string;
}

const ContactAvatar = memo(function ContactAvatar({
  imageUrl,
  name,
  email,
  size = 64,
  className = "",
}: ContactAvatarProps) {
  const initial = useMemo(() => {
    const source = name || email || "?";
    return source[0]?.toUpperCase() ?? "?";
  }, [name, email]);

  const sizeClass =
    size === 64
      ? "w-16 h-16"
      : size === 40
        ? "w-10 h-10"
        : size === 32
          ? "w-8 h-8"
          : size === 24
            ? "w-6 h-6"
            : size === 20
              ? "w-5 h-5"
              : "";

  const textClass =
    size === 64
      ? "text-xl"
      : size === 40
        ? "text-base"
        : size === 32
          ? "text-sm"
          : "text-xs";

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name || email || ""}
        className={`rounded-full object-cover ${sizeClass} ${className}`}
        style={sizeClass ? undefined : { width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-accent/20 text-accent flex items-center justify-center font-semibold ${sizeClass} ${textClass} ${className}`}
      style={sizeClass ? undefined : { width: size, height: size }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
});
export { ContactAvatar };
