import { type HTMLAttributes } from "react";

export interface FrostedBackgroundProps extends HTMLAttributes<HTMLDivElement> {
  intensity?: number;
}

/**
 * FrostedBackground — Fluid animated gradient circles that render behind
 * all app content to create the signature "Frosted Glass" aesthetic.
 *
 * Design: 6 animated gradient orbs with heavy blur (80–120px),
 * slow organic drift, pointer-events: none for performance.
 * Auto-hidden on mobile (<=768px) and prefers-reduced-motion.
 */
export function FrostedBackground({
  intensity = 1,
  className,
  ...rest
}: FrostedBackgroundProps) {
  return (
    <div
      className={`frosted-bg fixed inset-0 z-0 pointer-events-none overflow-hidden ${className ?? ""}`}
      aria-hidden="true"
      style={{ opacity: intensity }}
      {...rest}
    >
      <div
        className="frosted-orb"
        style={{
          width: "560px",
          height: "560px",
          top: "-10%",
          left: "-4%",
          background:
            "radial-gradient(circle at 30% 40%, #0B57D0 0%, #1557B0 30%, #1A5CFF 50%, transparent 70%)",
          animationDuration: "26s",
          animationDelay: "0s",
          opacity: 0.45 * intensity,
        }}
      />
      <div
        className="frosted-orb"
        style={{
          width: "480px",
          height: "480px",
          top: "15%",
          right: "-6%",
          left: "auto",
          background:
            "radial-gradient(circle at 60% 30%, #C4B5FD 0%, #8B5CF6 30%, #6D28D9 50%, transparent 68%)",
          animationDuration: "22s",
          animationDelay: "-4s",
          opacity: 0.35 * intensity,
        }}
      />
      <div
        className="frosted-orb"
        style={{
          width: "440px",
          height: "440px",
          bottom: "-6%",
          left: "30%",
          top: "auto",
          background:
            "radial-gradient(circle at 40% 60%, #FBCFE8 0%, #F472B6 30%, #E11D48 50%, transparent 68%)",
          animationDuration: "28s",
          animationDelay: "-8s",
          opacity: 0.3 * intensity,
        }}
      />
      <div
        className="frosted-orb"
        style={{
          width: "400px",
          height: "400px",
          bottom: "18%",
          left: "-5%",
          top: "auto",
          background:
            "radial-gradient(circle at 50% 50%, #CCFBF1 0%, #2DD4BF 30%, #0D9488 50%, transparent 68%)",
          animationDuration: "24s",
          animationDelay: "-2s",
          opacity: 0.3 * intensity,
        }}
      />
      <div
        className="frosted-orb"
        style={{
          width: "360px",
          height: "360px",
          top: "5%",
          left: "55%",
          background:
            "radial-gradient(circle at 50% 40%, #FEF3C7 0%, #FBBF24 30%, #D97706 50%, transparent 68%)",
          animationDuration: "26s",
          animationDelay: "-6s",
          opacity: 0.25 * intensity,
        }}
      />
      <div
        className="frosted-orb"
        style={{
          width: "680px",
          height: "680px",
          top: "35%",
          left: "38%",
          background:
            "radial-gradient(circle at 50% 50%, #E0E7FF 0%, #C4B5FD 20%, #6366F1 40%, transparent 60%)",
          animation: "orbitalDrift 32s ease-in-out infinite alternate",
          animationDelay: "-12s",
          opacity: 0.12 * intensity,
          filter: "blur(120px)",
        }}
      />
    </div>
  );
}
