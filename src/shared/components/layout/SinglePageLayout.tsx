import type { CSSProperties } from "react";
import { SinglePageLayoutProps } from "./types";

const MAX_WIDTH_MAP: Record<string, string> = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
  "3xl": "1920px",
  "4xl": "2240px",
  "5xl": "2560px",
  "6xl": "2880px",
  "7xl": "3200px",
  full: "100%",
};

export function SinglePageLayout({
  children,
  className,
  maxWidth = "2xl",
  centerVertically = false,
  p,
  px,
  py,
}: SinglePageLayoutProps) {
  const maxWidthValue = MAX_WIDTH_MAP[maxWidth] ?? maxWidth;
  const containerClass = `flex ${centerVertically ? "items-center" : ""} justify-center min-h-screen w-full px-4 sm:px-6 lg:px-8 ${className}`;
  const contentClass = "w-full";
  const contentStyle: CSSProperties = {
    maxWidth: maxWidthValue,
    padding: typeof p === "number" ? `${p * 0.25}rem` : p,
    paddingLeft: px ? (typeof px === "number" ? `${px * 0.25}rem` : px) : undefined,
    paddingRight: px ? (typeof px === "number" ? `${px * 0.25}rem` : px) : undefined,
    paddingTop: py ? (typeof py === "number" ? `${py * 0.25}rem` : py) : undefined,
    paddingBottom: py ? (typeof py === "number" ? `${py * 0.25}rem` : py) : undefined,
  };

  return (
    <div className={containerClass}>
      <div className={contentClass} style={contentStyle}>
        {children}
      </div>
    </div>
  );
}