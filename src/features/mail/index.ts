export type {
  ComposerAttachment,
  ComposerMode,
  ComposerViewMode,
} from "./stores/composerStore";

export type { Thread } from "./stores/threadStore";

export type { Label } from "./stores/labelStore";

export { useThreadStore } from "./stores/threadStore";
export { useComposerStore } from "./stores/composerStore";
export { useLabelStore } from "./stores/labelStore";

export { isSystemLabel } from "./stores/labelStore";

export {
  archiveThread,
  trashThread,
  permanentDeleteThread,
  markThreadRead,
  starThread,
  spamThread,
  addThreadLabel,
  removeThreadLabel,
  sendEmail,
  createDraft,
  updateDraft,
  deleteDraft,
} from "./services/emailActions";
