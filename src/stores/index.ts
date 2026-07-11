// Core stores (already in canonical location)
export { useConfigStore, useFeatureFlagStore, useUIStore } from "./core";
export type {
  ThemeMode,
  FontScale,
  ReadingPanePosition,
  ReadFilter,
  EmailDensity,
  DefaultReplyMode,
  MarkAsReadBehavior,
  InboxViewMode,
  FeatureUsage,
} from "./core";

// Mail stores - direct imports from feature locations
export { useComposerStore, type ComposerMode, type ComposerViewMode, type ComposerAttachment } from "@features/mail/stores/composerStore";
export { useThreadStore as useThreadsStore, type Thread } from "@features/mail/stores/threadStore";
export type { Account } from "@features/accounts/stores/accountStore";
export { useAccountStore } from "@features/accounts/stores/accountStore";
export { useLabelStore as useLabelsStore, type Label, isSystemLabel } from "@features/mail/stores/labelStore";
export { useSmartFolderStore, type SmartFolder } from "@features/mail/stores/smartFolderStore";

// Contacts stores - direct imports from feature location
export { useContactStore as useContactsStore, type ContactTag, type ContactGroup, type ContactSegment } from "@features/contacts/stores/contactStore";
export { useContactStore as useGroupsStore } from "@features/contacts/stores/contactStore";
export { useContactStore as useSegmentsStore } from "@features/contacts/stores/contactStore";

// Campaigns stores - direct import from canonical location
export { useCampaignsStore, type Campaign, type CampaignStat } from "./campaigns";

// Vault stores - direct import from feature location
export { useVaultStore, type VaultFileItem, type VaultViewMode, type VaultSortField, type VaultSortDirection } from "@features/vault/stores/vaultStore";

// Shared stores - direct imports from canonical location
export { useSyncStore, initSyncStoreEvents } from "@shared/stores/syncStore";
export { useNotificationStore as useNotificationsStore, type NotificationItem } from "@shared/stores/notificationStore";
