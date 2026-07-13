import type { ReactNode } from "react";

interface MainWorkspaceProps {
  children: ReactNode;
}

export function MainWorkspace({ children }: MainWorkspaceProps) {
  return (
    <main
      id="main-content"
      className="flex-1 min-w-0 overflow-hidden flex flex-col"
      role="main"
    >
      {children}
    </main>
  );
}
