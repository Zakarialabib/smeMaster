// NOTE: The legacy `useCampaignsStore` (src/stores/campaigns/campaignStore.ts) was
// removed. The canonical campaign store now lives at
// `@features/campaigns/stores/campaignStore`. Types `Campaign` and `CampaignStat`
// are re-exported from their canonical sources below for backward compatibility.
export type { Campaign } from "@shared/services/db/schema";
export type { CampaignStat } from "@features/campaigns/stores/campaignStore";
