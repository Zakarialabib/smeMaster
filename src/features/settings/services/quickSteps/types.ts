export type QuickStepActionType =
  | "archive"
  | "trash"
  | "markRead"
  | "markUnread"
  | "star"
  | "unstar"
  | "pin"
  | "unpin"
  | "applyLabel"
  | "removeLabel"
  | "moveToCategory"
  | "reply"
  | "replyAll"
  | "forward"
  | "snooze"
  | "spam"
  | "notSpam";

export interface QuickStepAction {
  type: QuickStepActionType;
  params?: {
    labelId?: string;
    category?: string;
    snoozeDuration?: number;
    forwardTo?: string;
  };
}

export interface QuickStep {
  id: string;
  accountId: string;
  name: string;
  description: string | null;
  shortcut: string | null;
  actions: QuickStepAction[];
  icon: string | null;
  isEnabled: boolean;
  continueOnError: boolean;
  sortOrder: number;
  createdAt: number;
}

export interface QuickStepExecutionResult {
  success: boolean;
  completedActions: number;
  totalActions: number;
  error?: string;
  failedActionIndex?: number;
}

export const ACTION_TYPE_METADATA: {
  type: QuickStepActionType;
  label: string;
  icon: string;
  requiresParams: boolean;
  removesFromView: boolean;
}[] = [
  { type: "archive", label: "Archive", icon: "Archive", requiresParams: false, removesFromView: true },
  { type: "trash", label: "Trash", icon: "Trash2", requiresParams: false, removesFromView: true },
  { type: "markRead", label: "Mark as Read", icon: "MailOpen", requiresParams: false, removesFromView: false },
  { type: "markUnread", label: "Mark as Unread", icon: "Mail", requiresParams: false, removesFromView: false },
  { type: "star", label: "Star", icon: "Star", requiresParams: false, removesFromView: false },
  { type: "unstar", label: "Remove Star", icon: "Star", requiresParams: false, removesFromView: false },
  { type: "pin", label: "Pin", icon: "Pin", requiresParams: false, removesFromView: false },
  { type: "unpin", label: "Unpin", icon: "Pin", requiresParams: false, removesFromView: false },
  { type: "applyLabel", label: "Apply Label", icon: "Tag", requiresParams: true, removesFromView: false },
  { type: "removeLabel", label: "Remove Label", icon: "Tag", requiresParams: true, removesFromView: false },
  { type: "moveToCategory", label: "Move to Category", icon: "Layers", requiresParams: true, removesFromView: false },
  { type: "reply", label: "Reply", icon: "Reply", requiresParams: false, removesFromView: false },
  { type: "replyAll", label: "Reply All", icon: "ReplyAll", requiresParams: false, removesFromView: false },
  { type: "forward", label: "Forward", icon: "Forward", requiresParams: false, removesFromView: false },
  { type: "snooze", label: "Snooze", icon: "Clock", requiresParams: true, removesFromView: true },
  { type: "spam", label: "Report Spam", icon: "Ban", requiresParams: false, removesFromView: true },
  { type: "notSpam", label: "Not Spam", icon: "Ban", requiresParams: false, removesFromView: true },
];
