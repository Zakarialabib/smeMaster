import { useQuery } from "@tanstack/react-query";
import { getLabelsForAccount } from "@shared/services/db/labels";
import type { DbLabel } from "@shared/services/db/labels";
import type { Label } from "@features/mail/stores/labelStore";
import { queryKeys } from "@shared/query/keys";

function mapLabel(l: DbLabel): Label {
  return {
    id: l.id,
    accountId: l.account_id,
    name: l.name,
    type: l.type,
    colorBg: l.color_bg,
    colorFg: l.color_fg,
    sortOrder: l.sort_order,
  };
}

export function useLabels(accountId: string | null) {
  return useQuery({
    queryKey: queryKeys.labels.byAccount(accountId),
    queryFn: async () => {
      if (!accountId) return [];
      const rows = await getLabelsForAccount(accountId);
      return rows.map(mapLabel);
    },
    enabled: !!accountId,
    staleTime: 60_000,
    placeholderData: (previousData) => previousData,
  });
}
