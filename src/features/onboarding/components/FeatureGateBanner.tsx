// src/features/onboarding/components/FeatureGateBanner.tsx
import { useState, useEffect, type ReactNode } from "react";
import { X, Mail } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { AddAccount } from "@features/accounts/components/AddAccount";

interface FeatureGateBannerProps {
  featureName: string;
  icon?: ReactNode;
  storageKey?: string;
}

const SESSION_PREFIX = "smemaster.feature-banner.dismissed.";

export function FeatureGateBanner({
  featureName,
  icon,
  storageKey,
}: FeatureGateBannerProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      const key = storageKey ?? featureName.toLowerCase().replace(/\s+/g, "-");
      return sessionStorage.getItem(SESSION_PREFIX + key) === "true";
    } catch {
      return false;
    }
  });
  const [showAddAccount, setShowAddAccount] = useState(false);

  // Reset dismissed if component re-renders (e.g. during hot reload)
  useEffect(() => {
    // No-op, state is already initialized
  }, []);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      const key = storageKey ?? featureName.toLowerCase().replace(/\s+/g, "-");
      sessionStorage.setItem(SESSION_PREFIX + key, "true");
    } catch { /* noop */ }
    setDismissed(true);
  };

  return (
    <>
      <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 flex items-center gap-3">
        <div className="shrink-0">
          {icon ?? (
            <div className="rounded-md p-1.5 bg-accent/10">
              <Mail className="h-4 w-4 text-accent" />
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground flex-1">
          Connect your email to use <span className="font-medium text-foreground">{featureName}</span> features
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddAccount(true)}
          >
            Connect Email
          </Button>
          <button
            onClick={handleDismiss}
            className="rounded-md p-1.5 text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted transition-all duration-200"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Add Account Modal */}
      {showAddAccount && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          style={{ animation: "fadeIn 200ms ease-out both" }}
        >
          <div className="relative rounded-2xl border border-border bg-card p-6 shadow-2xl w-full max-w-md">
            <button
              onClick={() => setShowAddAccount(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
            >
              <X className="h-4 w-4" />
            </button>
            <AddAccount
              onSuccess={() => setShowAddAccount(false)}
              onClose={() => setShowAddAccount(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
