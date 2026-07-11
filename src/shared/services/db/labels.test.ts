import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@shared/services/db/db-invoke", () => ({
  updateLabelSortOrder: vi.fn(),
}));

import { updateLabelSortOrder as dbUpdateLabelSortOrder } from "@shared/services/db/db-invoke";
import { updateLabelSortOrder } from "./labels";

describe("labels service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateLabelSortOrder", () => {
    it("executes all updates via db-invoke wrapper", async () => {
      const orders = [
        { id: "label-1", sortOrder: 0 },
        { id: "label-2", sortOrder: 1 },
        { id: "label-3", sortOrder: 2 },
      ];

      await updateLabelSortOrder("acc-1", orders);

      expect(dbUpdateLabelSortOrder).toHaveBeenCalledTimes(1);
      expect(dbUpdateLabelSortOrder).toHaveBeenCalledWith("acc-1", orders);
    });

    it("handles empty array", async () => {
      await updateLabelSortOrder("acc-1", []);
      expect(dbUpdateLabelSortOrder).not.toHaveBeenCalled();
    });
  });
});
