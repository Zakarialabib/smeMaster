import { create } from "zustand";
import { invokeCommand } from "@shared/services/db/invoke/command";
import { listCampaigns } from "@shared/services/db/db-invoke";
import type { Campaign } from "@shared/services/db/schema";

export type { Campaign };

export interface CampaignStat {
  total: number;
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
}

interface CampaignsState {
  campaigns: Campaign[];
  stats: Record<string, CampaignStat>;
  isLoading: boolean;
  error: string | null;

  loadCampaigns: (companyId: string) => Promise<void>;
  loadStats: (campaignId: string) => Promise<void>;
  createCampaign: (input: { companyId: string; name: string; templateId?: string; segmentId?: string }) => Promise<string>;
  deleteCampaign: (id: string) => Promise<void>;
}

export const useCampaignsStore = create<CampaignsState>()((set) => ({
  campaigns: [],
  stats: {},
  isLoading: false,
  error: null,

  loadCampaigns: async (companyId: string) => {
    set({ isLoading: true, error: null });
    try {
      const rows = await listCampaigns(companyId);
      set({ campaigns: rows });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  loadStats: async (campaignId: string) => {
    try {
      const rows = await invokeCommand<{ status: string; count: number }[]>("db_get_campaign_stats_by_status", { campaignId });
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
    try {
      const created = await invokeCommand<Campaign>("db_create_campaign", {
        companyId: input.companyId,
        name: input.name,
        templateId: input.templateId ?? null,
        segmentId: input.segmentId ?? null,
      });
      if (created) set((s) => ({ campaigns: [created, ...s.campaigns] }));
      return created.id;
    } catch (err) {
      console.error("Failed to create campaign:", err);
      return "";
    }
  },

  deleteCampaign: async (id: string) => {
    try {
      await invokeCommand<void>("db_delete_campaign", { id });
      set((s) => ({
        campaigns: s.campaigns.filter((c) => c.id !== id),
        stats: Object.fromEntries(Object.entries(s.stats).filter(([k]) => k !== id)),
      }));
    } catch (err) {
      console.error("Failed to delete campaign:", err);
    }
  },
}));
