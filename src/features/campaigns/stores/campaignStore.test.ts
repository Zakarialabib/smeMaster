import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCampaignStore } from "./campaignStore";

vi.mock("@shared/services/db/db-invoke", () => ({
  listCampaigns: vi.fn(),
}));

vi.mock("@shared/services/db/invoke/command", () => ({
  invokeCommand: vi.fn(),
}));

import { invokeCommand } from "@shared/services/db/invoke/command";
import { listCampaigns } from "@shared/services/db/db-invoke";

beforeEach(() => {
  useCampaignStore.setState({
    campaigns: [],
    stats: {},
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
});

describe("campaignStore — withMutation wiring", () => {
  it("isLoading is true while loadCampaigns is pending", async () => {
    let resolveFn: (v: unknown[]) => void = () => {};
    vi.mocked(listCampaigns).mockReturnValue(
      new Promise<unknown[]>((resolve) => {
        resolveFn = resolve;
      }) as never,
    );

    const p = useCampaignStore.getState().loadCampaigns("acc-1");
    expect(useCampaignStore.getState().isLoading).toBe(true);

    resolveFn([]);
    await p;
    expect(useCampaignStore.getState().isLoading).toBe(false);
  });

  it("createCampaign returns empty id and sets error on failure", async () => {
    vi.mocked(invokeCommand).mockRejectedValue(new Error("DB down"));

    const id = await useCampaignStore.getState().createCampaign({
      accountId: "acc-1",
      name: "My Campaign",
    });

    expect(id).toBe("");
    const s = useCampaignStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("DB down");
  });

  it("deleteCampaign sets error on failure and leaves isLoading false", async () => {
    vi.mocked(invokeCommand).mockRejectedValue(new Error("Delete failed"));

    await useCampaignStore.getState().deleteCampaign("c1");

    const s = useCampaignStore.getState();
    expect(s.isLoading).toBe(false);
    expect(s.error).toBe("Delete failed");
  });
});
