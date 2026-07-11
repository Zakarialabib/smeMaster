import { useState, useCallback } from "react";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { Search, Mail, ChevronRight, X, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@shared/components/ui/Button";
import { notify } from "@shared/services/notifications/toastHelper";

export interface DiscoveredAccount {
  email: string;
  display_name: string | null;
  source: string;
  provider_type: string;
  imap_host: string | null;
  imap_port: number | null;
  imap_security: string | null;
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_security: string | null;
  username: string | null;
  auth_method: string | null;
  oauth_provider: string | null;
}

interface DiscoveryResult {
  accounts: DiscoveredAccount[];
  sources_scanned: string[];
  errors: string[];
}

interface AccountImportScannerProps {
  onSelectAccount: (account: DiscoveredAccount) => void;
  onClose: () => void;
}

const providerColors: Record<string, string> = {
  gmail_api: "bg-red-500/15 text-red-600 dark:text-red-400",
  microsoft_graph: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  jmap: "bg-teal-500/15 text-teal-600 dark:text-teal-400",
  imap_smtp: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

const providerLabels: Record<string, string> = {
  gmail_api: "Gmail",
  microsoft_graph: "Microsoft",
  jmap: "JMAP",
  imap_smtp: "IMAP/SMTP",
};

export function AccountImportScanner({ onSelectAccount, onClose }: AccountImportScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<DiscoveryResult | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);

  const handleScan = useCallback(async () => {
    setScanning(true);
    try {
      const discoveryResult = await invokeCommand<DiscoveryResult>("scan_system_accounts");
      setResult(discoveryResult);
      if (discoveryResult.accounts.length === 0) {
        notify("Account Import", "No email accounts found on this system. You can still add accounts manually.");
      } else {
        notify("Account Import", `Found ${discoveryResult.accounts.length} account${discoveryResult.accounts.length === 1 ? "" : "s"}.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      notify("Account Import", `Scan failed: ${message}`);
      console.error("Account import scan error:", err);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleImport = useCallback(
    (account: DiscoveredAccount) => {
      onSelectAccount(account);
    },
    [onSelectAccount],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-text-primary">
            Import from System
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            We found email accounts configured on this device. Pick one to import — you'll still need to authenticate.
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2 p-3 bg-info/10 border border-info/20 rounded-lg text-xs text-text-secondary">
        <ShieldCheck className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <div>
          <strong>Privacy first:</strong> We never read or store your passwords. Only server
          settings (host, port, security) are imported. You'll be asked to authenticate
          each account separately via OAuth or app password.
        </div>
      </div>

      {/* Scan button or results */}
      {!result && !scanning && (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
            <Search className="w-6 h-6 text-text-secondary" />
          </div>
          <p className="text-sm text-text-secondary mb-4">
            Scan your system for email accounts configured in Apple Mail, Thunderbird, Outlook, or Evolution.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={handleScan}
            icon={<Search size={14} />}
          >
            Scan for accounts
          </Button>
        </div>
      )}

      {scanning && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 text-accent mx-auto mb-3 animate-spin" />
          <p className="text-sm text-text-secondary">
            Scanning for email accounts...
          </p>
        </div>
      )}

      {result && !scanning && (
        <>
          {/* Sources scanned */}
          {result.sources_scanned.length > 0 && (
            <div className="text-xs text-text-tertiary">
              Scanned: {result.sources_scanned.join(", ")}
            </div>
          )}

          {/* Errors (non-fatal) */}
          {result.errors.length > 0 && (
            <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning">
              {result.errors.length} source{result.errors.length === 1 ? "" : "s"} could not be scanned.
            </div>
          )}

          {/* Discovered accounts */}
          {result.accounts.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mx-auto mb-3">
                <Mail className="w-6 h-6 text-text-tertiary" />
              </div>
              <p className="text-sm text-text-secondary mb-2">
                No email accounts found on this system.
              </p>
              <p className="text-xs text-text-tertiary">
                You can still add accounts manually from the provider selector.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {result.accounts.map((account, idx) => {
                const isSelected = selectedEmail === account.email;
                const providerColor = providerColors[account.provider_type] || "bg-bg-tertiary text-text-secondary";
                const providerLabel = providerLabels[account.provider_type] || account.provider_type;

                return (
                  <button
                    key={`${account.email}-${idx}`}
                    onClick={() => setSelectedEmail(isSelected ? null : account.email)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                      isSelected
                        ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                        : "border-border-primary bg-bg-secondary hover:bg-bg-hover"
                    }`}
                  >
                    <div
                      className={`shrink-0 w-9 h-9 rounded-md flex items-center justify-center text-xs font-bold ${providerColor}`}
                    >
                      {providerLabel[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary truncate">
                        {account.display_name || account.email || "Unknown account"}
                      </div>
                      <div className="text-xs text-text-tertiary truncate">
                        {account.email || "No email"} · {account.source}
                      </div>
                      {account.imap_host && (
                        <div className="text-[10px] text-text-tertiary/60 truncate mt-0.5">
                          {account.imap_host}:{account.imap_port || 993} ({account.imap_security || "SSL"})
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-accent shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          {result.accounts.length > 0 && (
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={handleScan}>
                Re-scan
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!selectedEmail}
                onClick={() => {
                  const acc = result.accounts.find((a) => a.email === selectedEmail);
                  if (acc) handleImport(acc);
                }}
                icon={<ChevronRight size={14} />}
              >
                Continue
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}