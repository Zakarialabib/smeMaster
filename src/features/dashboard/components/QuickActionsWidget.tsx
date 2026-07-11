import { useCallback } from "react";
import { Users, CheckSquare, Zap } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { eventBus } from "@shared/services/events/eventBus";
import { navigateToLabel } from "@/router/navigate";
import { WidgetHeader } from "./WidgetHelpers";

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <Button
      onClick={onClick}
      variant="secondary"
      size="md"
      icon={icon}
    >
      {label}
    </Button>
  );
}

export function QuickActionsWidget() {
  const handleNewContact = useCallback(() => navigateToLabel("people"), []);
  const handleNewTask = useCallback(() => navigateToLabel("tasks"), []);
  const handleCompose = useCallback(() => {
    eventBus.emit("composer:open", { mode: "new" });
  }, []);

  return (
    <>
      <WidgetHeader icon={<Zap size={16} />} title="Quick Actions" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <ActionButton
          icon={<Users size={16} />}
          label="New Contact"
          onClick={handleNewContact}
        />
        <ActionButton
          icon={<CheckSquare size={16} />}
          label="New Task"
          onClick={handleNewTask}
        />
        <ActionButton
          icon={<Zap size={16} />}
          label="Compose Email"
          onClick={handleCompose}
        />
      </div>
    </>
  );
}
