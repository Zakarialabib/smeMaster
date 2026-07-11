import { useEffect, useRef } from "react";
import { useScreenInfo } from "@shared/hooks/usePlatform";
import { X } from "lucide-react";

export interface MenuAction {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number }>;
  dangerous?: boolean;
  onClick: () => void;
}

interface Props {
  actions: MenuAction[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function LongPressMenu({ actions, position, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const screen = useScreenInfo();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("touchstart", handleClickOutside, { passive: true });
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div
        ref={menuRef}
        className="absolute glass-dropdown rounded-lg py-1 min-w-[180px] animate-in fade-in duration-100"
        style={{
          left: Math.min(position.x, screen.width - 200),
          top: Math.min(position.y, screen.height - actions.length * 44 - 20),
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border-secondary">
          <span className="text-xs font-medium text-text-secondary">Actions</span>
          <button onClick={onClose} className="p-0.5 text-text-tertiary">
            <X size={14} />
          </button>
        </div>
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => { action.onClick(); onClose(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-all duration-150 ${
              action.dangerous ? "text-danger hover:glass-accent-tint" : "text-text-primary hover:glass-accent-tint"
            }`}
          >
            {action.icon && <action.icon size={16} />}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
