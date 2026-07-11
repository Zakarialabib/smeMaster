import { usePlatform } from "@shared/hooks/usePlatform";

interface AdaptiveBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  side?: "right" | "bottom";
  className?: string;
}

export function AdaptiveBottomSheet({
  isOpen,
  onClose,
  title,
  children,
  side,
  className = "",
}: AdaptiveBottomSheetProps) {
  const { screen } = usePlatform();
  const isMobile =
    screen.category === "phone" || screen.category === "phone-folded";

  // On mobile, always use bottom sheet behavior
  // On desktop, use the specified side (defaults to right)
  const effectiveSide = side ?? (isMobile ? "bottom" : "right");

  return (
    <div
      className={`fixed inset-0 z-50 ${isOpen ? "visible" : "invisible pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`absolute bg-white dark:bg-gray-800 shadow-xl transition-transform duration-300 ${
          effectiveSide === "right"
            ? "right-0 top-0 h-full w-full max-w-md"
            : "bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl"
        } ${
          isOpen
            ? "translate-x-0 translate-y-0"
            : effectiveSide === "right"
              ? "translate-x-full"
              : "translate-y-full"
        } ${className}`}
      >
        {/* Drag handle (mobile only) */}
        {effectiveSide === "bottom" && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div
          className="overflow-y-auto"
          style={{
            maxHeight:
              effectiveSide === "bottom"
                ? "calc(85vh - 60px)"
                : "calc(100vh - 60px)",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}