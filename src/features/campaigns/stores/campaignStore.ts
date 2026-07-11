/**
 * Campaigns Zustand store.
 *
 * Uses safeDbOperation for every mutation to guarantee user-friendly
 * error messages instead of [object Object] or raw exception text.
 */

import { create } from "zustand";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { listCampaigns } from "@shared/services/db/db-invoke";
import type { Campaign } from "@shared/services/db/schema";
import {
  createAsyncActions,
  initialAsyncState,
} from "@shared/stores/createAsyncStore";
import {
  safeDbOperation,
} from "@features/campaigns/services/errorHandler";
import { notify } from "@shared/services/notifications/toastHelper";

export type { Campaign };

export interface CampaignStat {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

interface CampaignState {
  campaigns: Campaign[];
  stats: Record<string, CampaignStat>;
  isLoading: boolean;
  error: string | null;
  loadCampaigns: (companyId: string) => Promise<void>;
  loadStats: (campaignId: string) => Promise<void>;
  createCampaign: (input: { companyId: string; name: string; templateId?: string; segmentId?: string }) => Promise<string>;
  deleteCampaign: (id: string) => Promise<void>;
}

export const useCampaignStore = create<CampaignState>((set) => {
  const { withLoading } = createAsyncActions(set);

  return {
    campaigns: [],
    stats: {},
    ...initialAsyncState,

    loadCampaigns: async (companyId: string) => {
      await withLoading(async () => {
        const rows = await listCampaigns(companyId);
        set({ campaigns: rows });
      });
    },

    loadStats: async (campaignId: string) => {
      try {
        const rows = await invokeCommand<{ status: string; count: number }[]>(
          "db_get_campaign_stats_by_status",
          { campaignId },
        );
        const total = rows.reduce((sum, r) => sum + r.count, 0);
        const stat: CampaignStat = {
          total,
          sent: rows.find((r) => r.status === "sent")?.count ?? 0,
          opened: rows.find((r) => r.status === "opened")?.count ?? 0,
          clicked: rows.find((r) => r.status === "clicked")?.count ?? 0,
          bounced: rows.find((r) => r.status === "bounced")?.count ?? 0,
        };
        set((s) => ({ stats: { ...s.stats, [campaignId]: stat } }));
      } catch (err) {
        console.error("Failed to load campaign stats:", err);
      }
    },

    createCampaign: async (input) => {
      const result = await safeDbOperation(
        async () => {
          const created = await invokeCommand<Campaign>("db_create_campaign", {
            companyId: input.companyId,
            name: input.name,
            templateId: input.templateId ?? null,
            segmentId: input.segmentId ?? null,
          });
          set((s) => ({ campaigns: [created, ...s.campaigns] }));
          return created.id;
        },
        { operationLabel: "create campaign" },
      );

      if (result.success) {
        set({ error: null });
        return result.data;
      }

      notify("Failed to create campaign", result.error);
      set({ error: result.technical ?? result.error });
      return "";
    },

    deleteCampaign: async (id: string) => {
      const result = await safeDbOperation(
        async () => {
          await invokeCommand<void>("db_delete_campaign", { id });
          set((s) => ({
            campaigns: s.campaigns.filter((c) => c.id !== id),
            stats: Object.fromEntries(
              Object.entries(s.stats).filter(([k]) => k !== id),
            ),
          }));
        },
        { operationLabel: "delete campaign" },
      );

      if (!result.success) {
        notify("Failed to delete campaign", result.error);
        set({ error: result.technical ?? result.error });
      }
    },
  };
});
