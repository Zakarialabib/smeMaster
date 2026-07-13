/**
 * LicensePage — Full-page license management
 *
 * A composable page that the settings router mounts at the
 * `settings.license` route. It composes:
 *   - LicenseBanner (dismissible trial + upgrade prompt)
 *   - Current license status card
 *   - License key activation form
 *   - Free trial CTA
 *   - Tier comparison
 *   - Deactivation (danger zone)
 *   - Developer tools (dev builds only)
 *
 * Patterned after `Simple-Signage/src/components/settings/cards/LicenseCard.tsx`
 * but adapted to SMEMaster's settings tab architecture and the
 * Ed25519 + hardware-bound Rust backend in `src-tauri/src/licensing`.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Check,
  Calendar,
  Clock,
  Key,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
  X,
  Info,
  Copy,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@shared/components/ui/Button';
import { HelpCard } from '@features/settings/components/HelpCard';
import { SettingGroup, InfoRow } from '@features/settings/components/SettingsHelpers';
import { useLicenseStore, type LicenseTier } from '@shared/stores/licenseStore';
import { notify } from '@shared/services/notifications/toastHelper';
import { licenseAdapter } from '@core/adapters/tauri/LicenseTauriAdapter';
import { TIER_RANK_ALIAS } from '@features/settings/types/license';
import { LicenseBanner } from './LicenseBanner';

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

const TIER_DESCRIPTIONS: Record<LicenseTier, string> = {
  trial: 'All Pro features active for 14 days. No credit card needed.',
  basic: 'Core email & CRM features. Some advanced features are limited.',
  pro: 'All features unlocked: AI, campaigns, workflows, advanced analytics.',
  enterprise: 'Reserved for special deployments. Contact us for details.',
};

const TIER_BADGE: Record<LicenseTier, { color: string; label: string }> = {
  trial: { color: 'bg-warning/10 text-warning border-warning/20', label: 'Trial' },
  basic: { color: 'bg-bg-tertiary text-text-secondary border-border-primary', label: 'Basic' },
  pro: { color: 'bg-accent/10 text-accent border-accent/20', label: 'Pro' },
  enterprise: {
    color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    label: 'Enterprise',
  },
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export interface LicensePageProps {
  /** Optional embedded mode — hide the page header if mounted inside a settings tab. */
  embedded?: boolean;
}

export function LicensePage({ embedded = false }: LicensePageProps) {
  const { t } = useTranslation();
  const license = useLicenseStore((s) => s.license);
  const loading = useLicenseStore((s) => s.loading);
  const error = useLicenseStore((s) => s.error);
  const activateTrial = useLicenseStore((s) => s.activateTrial);
  const activateLicenseKey = useLicenseStore((s) => s.activateLicenseKey);
  const deactivate = useLicenseStore((s) => s.deactivate);
  const revalidate = useLicenseStore((s) => s.revalidate);

  const [keyInput, setKeyInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hardwareId, setHardwareId] = useState<string | null>(null);
  const [devTier, setDevTier] = useState<'free' | 'professional' | 'enterprise'>('professional');
  const [devValidDays, setDevValidDays] = useState(7);
  const [devBusy, setDevBusy] = useState(false);

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  // Fetch the hardware ID once so we can show it in the UI (matters for
  // license transfer / device management).
  useEffect(() => {
    let cancelled = false;
    licenseAdapter
      .getHardwareId()
      .then((id) => {
        if (!cancelled) setHardwareId(id || null);
      })
      .catch(() => {
        if (!cancelled) setHardwareId(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-format key input as XXXX-XXXX-XXXX-XXXX
  useEffect(() => {
    const cleaned = keyInput
      .replace(/[^A-Z0-9]/gi, '')
      .toUpperCase()
      .slice(0, 16);
    const groups: string[] = [];
    for (let i = 0; i < cleaned.length; i += 4) {
      groups.push(cleaned.slice(i, i + 4));
    }
    const formatted = groups.join('-');
    if (formatted !== keyInput) {
      setKeyInput(formatted);
    }
    // We intentionally only sync the formatted version back; the
    // user-typed value remains in `keyInput` while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyInput.length]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleActivateKey = useCallback(async () => {
    if (keyInput.replace(/[^A-Z0-9]/gi, '').length < 16) {
      notify(
        'Invalid key format',
        'Please enter a complete 16-character key (XXXX-XXXX-XXXX-XXXX).',
      );
      return;
    }
    setBusy(true);
    try {
      await activateLicenseKey(keyInput);
      notify('License activated', 'Welcome to Pro! All features are now unlocked.');
      setKeyInput('');
    } catch (e) {
      notify('Activation failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }, [keyInput, activateLicenseKey]);

  const handleStartTrial = useCallback(async () => {
    setBusy(true);
    try {
      await activateTrial();
      notify('Trial started', 'Enjoy 14 days of Pro features!');
    } finally {
      setBusy(false);
    }
  }, [activateTrial]);

  const handleDeactivate = useCallback(async () => {
    if (!window.confirm('Deactivating will remove your license key from this device. Continue?')) {
      return;
    }
    setBusy(true);
    try {
      await deactivate();
      notify('License deactivated', 'Your license has been removed.');
    } finally {
      setBusy(false);
    }
  }, [deactivate]);

  const handleRevalidate = useCallback(async () => {
    setBusy(true);
    try {
      const updated = await revalidate();
      if (updated) {
        notify('License revalidated', 'License status checked successfully.');
      } else {
        notify('Revalidation failed', 'Could not reach the licensing service.');
      }
    } finally {
      setBusy(false);
    }
  }, [revalidate]);

  const handleGenerateTestKey = useCallback(async () => {
    if (!import.meta.env.DEV) return;
    setDevBusy(true);
    try {
      const key = await licenseAdapter.generateTestLicense(devTier, 'developer', devValidDays);
      setKeyInput(key);
      try {
        const { copyToClipboard } = await import("@shared/hooks/useClipboard");
        await copyToClipboard(key);
      } catch {
        /* clipboard may be unavailable in some sandboxes */
      }
      notify(
        'Test key generated',
        'Copied to clipboard. Paste it into the activation field to test.',
      );
    } catch (e) {
      notify('Test key generation failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setDevBusy(false);
    }
  }, [devTier, devValidDays]);

  const copyHardwareId = useCallback(() => {
    if (!hardwareId) return;
    import("@shared/hooks/useClipboard").then(({ copyToClipboard }) =>
      copyToClipboard(hardwareId).then(() => notify('Hardware ID copied', 'Use this when transferring a license.'))
    ).catch(() => notify('Copy failed', 'Clipboard unavailable.'));
  }, [hardwareId]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return <div className="text-sm text-text-tertiary py-8 text-center">Loading license...</div>;
  }

  const currentTier: LicenseTier = license?.tier ?? 'basic';
  const badge = TIER_BADGE[currentTier];
  const isPro = currentTier === 'pro' || currentTier === 'enterprise' || currentTier === 'trial';
  const isOnTrial =
    !!license?.trialStartedAt && currentTier === 'pro' && (license.trialDaysRemaining ?? 0) > 0;

  return (
    <div className="space-y-4">
      {!embedded && <LicenseBanner />}

      {/* Current Status */}
      <SettingGroup title={t('settings.licenseCurrent') || 'Current License'}>
        <div className="px-4 py-4 bg-bg-secondary rounded-lg space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-bg-tertiary flex items-center justify-center">
                {isPro ? (
                  <ShieldCheck size={18} className="text-accent" />
                ) : (
                  <Shield size={18} className="text-text-tertiary" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-text-primary">
                    {TIER_BADGE[currentTier].label}
                  </span>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}
                  >
                    {badge.label}
                  </span>
                  {isOnTrial && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/20">
                      <Clock size={9} className="inline -mt-0.5 mr-1" />
                      Trial
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {TIER_DESCRIPTIONS[currentTier]}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRevalidate}
              disabled={busy}
              icon={<RefreshCw size={13} />}
            >
              Revalidate
            </Button>
          </div>

          {/* Trial countdown */}
          {isOnTrial && license?.trialDaysRemaining !== null && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-warning/5 border border-warning/20 text-xs">
              <Calendar size={13} className="text-warning shrink-0" />
              <span className="text-text-secondary">
                {license.trialDaysRemaining > 0 ? (
                  <>
                    <strong className="text-warning">
                      {license.trialDaysRemaining} day
                      {license.trialDaysRemaining !== 1 ? 's' : ''}
                    </strong>{' '}
                    remaining in your Pro trial
                  </>
                ) : (
                  <>Your trial has ended. Activate a key to keep Pro features.</>
                )}
              </span>
            </div>
          )}

          {/* License key fingerprint */}
          {license?.keyFingerprint && (
            <InfoRow
              label="License Key"
              value={
                <span className="font-mono text-xs">••••••••••••{license.keyFingerprint}</span>
              }
            />
          )}
          {license?.activatedAt && (
            <InfoRow
              label="Activated"
              value={
                <span className="text-xs text-text-secondary">
                  {new Date(license.activatedAt).toLocaleDateString()}
                </span>
              }
            />
          )}
          {license?.expiresAt && (
            <InfoRow
              label="Expires"
              value={
                <span className="text-xs text-text-secondary">
                  {new Date(license.expiresAt).toLocaleDateString()}
                </span>
              }
            />
          )}
          {license?.lastValidatedAt && (
            <InfoRow
              label="Last validated"
              value={
                <span className="text-xs text-text-secondary">
                  {new Date(license.lastValidatedAt).toLocaleString()}
                </span>
              }
            />
          )}

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-danger/5 border border-danger/20 text-xs">
              <AlertTriangle size={13} className="text-danger shrink-0 mt-0.5" />
              <span className="text-text-secondary">{error}</span>
            </div>
          )}
        </div>
      </SettingGroup>

      {/* Education: Licensing */}
      <HelpCard
        items={[
          { type: "why", text: "Licensing manages your subscription tier — Basic (free) or Pro (paid). Your tier determines which features (AI, campaigns, workflows, deliverability suite) are available." },
          { type: "how", text: "Your license key is verified using Ed25519 cryptography and bound to your device's hardware ID. Activate a key to unlock Pro. Trial users get 14 days of full Pro access." },
          { type: "when", text: "Set up your license on first use. Start a trial to evaluate Pro before purchasing. Upgrade from Basic to Pro when you need advanced features like AI, campaigns, or the deliverability suite." },
          { type: "tip", text: "Hardware ID is used for license binding. If you upgrade your computer, deactivate the license first on the old device, then activate on the new one using the same key." },
        ]}
      />

      {/* Hardware ID — needed for license transfer / support */}
      {hardwareId && (
        <SettingGroup title="Hardware ID">
          <div className="px-4 py-3 bg-bg-secondary rounded-lg space-y-2">
            <p className="text-xs text-text-secondary leading-relaxed">
              This fingerprint identifies the device used for license binding. Provide it when
              transferring a license to a new machine.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary text-xs font-mono overflow-x-auto">
                {hardwareId}
              </code>
              <Button variant="ghost" size="sm" onClick={copyHardwareId} icon={<Copy size={13} />}>
                Copy
              </Button>
            </div>
          </div>
        </SettingGroup>
      )}

      {/* Activate License Key */}
      <SettingGroup title="Activate License Key">
        <div className="px-4 py-3 bg-bg-secondary rounded-lg space-y-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            Enter your license key in the format{' '}
            <code className="px-1.5 py-0.5 rounded bg-bg-tertiary text-text-primary font-mono text-[11px]">
              XXXX-XXXX-XXXX-XXXX
            </code>
            . Keys are verified against the issuer's Ed25519 public key embedded in this build and
            bound to this device.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="flex-1 px-3 py-2 rounded-lg border border-border-primary bg-bg-primary text-text-primary text-sm font-mono tracking-wider focus:ring-1 focus:ring-accent/30 focus:outline-none transition-colors"
              disabled={busy}
              aria-label="License key"
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleActivateKey}
              disabled={busy || keyInput.replace(/[^A-Z0-9]/gi, '').length < 16}
              icon={<Key size={14} />}
            >
              Activate
            </Button>
          </div>
        </div>
      </SettingGroup>

      {/* Start Trial (if eligible) */}
      {!isPro && !isOnTrial && (
        <SettingGroup title="Free Pro Trial">
          <div className="px-4 py-4 bg-bg-secondary rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center ring-1 ring-accent/20">
                <Sparkles size={18} className="text-accent" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-text-primary">Try Pro for 14 days</h4>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Unlock all features: AI, campaigns, workflows, advanced analytics, and more. No
                  credit card needed. Downgrades automatically to Basic at the end.
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={handleStartTrial}
              disabled={busy}
              icon={<Zap size={14} />}
            >
              Start Free Trial
            </Button>
          </div>
        </SettingGroup>
      )}

      {/* Tier Comparison */}
      <SettingGroup title="Tier Comparison">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 px-1">
          <TierCard
            tier="basic"
            current={currentTier === 'basic'}
            features={[
              'Up to 2 email accounts',
              'Up to 5 templates',
              'Core notifications & snooze',
              'Manual CRM',
              'No AI features',
            ]}
          />
          <TierCard
            tier="pro"
            current={currentTier === 'pro' || currentTier === 'enterprise' || isOnTrial}
            features={[
              'Unlimited accounts & templates',
              'AI writer, smart labels, triage',
              'Campaigns & advanced workflows',
              'Deliverability suite (DNS, DKIM, warmup)',
              'Priority support',
            ]}
            highlighted
          />
        </div>
      </SettingGroup>

      {/* Danger Zone */}
      {license?.keyFingerprint && (
        <SettingGroup title="Danger Zone">
          <div className="px-4 py-3 bg-bg-secondary rounded-lg">
            <div className="flex items-start gap-3 mb-3">
              <Info size={14} className="text-text-tertiary mt-0.5" />
              <p className="text-xs text-text-secondary leading-relaxed">
                Deactivating will remove your license key from this device. You can re-activate
                later with the same key. Your data is never affected.
              </p>
            </div>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDeactivate}
              disabled={busy}
              icon={<X size={14} />}
            >
              Deactivate License
            </Button>
          </div>
        </SettingGroup>
      )}

      {/* Developer Tools (only in dev) */}
      {import.meta.env.DEV && (
        <SettingGroup title="Developer Tools">
          <div className="px-4 py-4 bg-bg-secondary rounded-lg space-y-3">
            <div className="flex items-start gap-2 text-xs text-text-tertiary">
              <AlertCircle size={12} className="mt-0.5" />
              <p>
                These tools are only compiled into development builds. Use them to generate a signed
                test key, paste it into the activation field above, and verify the Ed25519 +
                hardware-binding round-trip end-to-end.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <select
                value={devTier}
                onChange={(e) =>
                  setDevTier(e.target.value as 'free' | 'professional' | 'enterprise')
                }
                className="bg-bg-primary border border-border-primary text-text-primary px-3 py-2 rounded-lg focus:ring-1 focus:ring-accent/30 focus:outline-none text-sm"
              >
                <option value="free">Free</option>
                <option value="professional">Professional</option>
                <option value="enterprise">Enterprise</option>
              </select>
              <input
                type="number"
                min={0}
                value={devValidDays}
                onChange={(e) => setDevValidDays(Number(e.target.value))}
                placeholder="Valid days (0 = lifetime)"
                className="bg-bg-primary border border-border-primary text-text-primary px-3 py-2 rounded-lg focus:ring-1 focus:ring-accent/30 focus:outline-none text-sm"
              />
              <Button
                variant="secondary"
                size="md"
                onClick={handleGenerateTestKey}
                disabled={devBusy}
                icon={<Key size={13} />}
              >
                {devBusy ? 'Generating...' : 'Generate Test Key'}
              </Button>
            </div>
          </div>
        </SettingGroup>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierCard({
  tier,
  current,
  features,
  highlighted,
}: {
  tier: LicenseTier;
  current: boolean;
  features: string[];
  highlighted?: boolean;
}) {
  const badge = TIER_BADGE[tier];
  // Compare against the alias rank table (the LicenseTier we received
  // is the alias form — "trial" | "basic" | "pro" | "enterprise").
  const tierRank = TIER_RANK_ALIAS[tier];
  const isPaidTier = tierRank >= TIER_RANK_ALIAS.pro;

  return (
    <div
      className={`relative rounded-lg border p-4 ${
        highlighted ? 'border-accent/30 bg-accent/5' : 'border-border-primary bg-bg-secondary'
      }`}
    >
      {current && (
        <div className="absolute -top-2 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20 flex items-center gap-1">
          <Check size={9} /> Current
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        {isPaidTier ? (
          <ShieldCheck size={16} className="text-accent" />
        ) : (
          <Shield size={16} className="text-text-tertiary" />
        )}
        <span className="text-sm font-semibold text-text-primary">{badge.label}</span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.color}`}
        >
          {isPaidTier ? 'Paid' : 'Free'}
        </span>
      </div>
      <ul className="space-y-1.5 mt-3">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-text-secondary">
            <Check size={12} className="text-success shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

