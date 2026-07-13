import { create } from "zustand";
import type { EmailBlock, BlockType } from "../components/editor/types";
import { createBlock } from "../components/editor/blockDefaults";
import { renderEmailHtml } from "../services/emailRenderer";

export type Step = "audience" | "template" | "schedule" | "review";
export type AudienceMode = "contacts" | "group" | "segment";
export type ScheduleMode = "immediate" | "scheduled" | "recurring";
export type RecurringFrequency = "daily" | "weekly" | "monthly";

export interface ABVariantContent {
  subject: string;
  body: string;
}

export interface CampaignComposerState {
  isOpen: boolean;
  step: Step;
  name: string;
  subject: string;
  audienceMode: AudienceMode;
  selectedContactIds: string[];
  selectedGroupId: string;
  selectedSegmentId: string;
  scheduleMode: ScheduleMode;
  scheduledDate: string;
  scheduledTime: string;
  recurringFrequency: RecurringFrequency;
  trackingEnabled: boolean;
  gdprConsent: boolean;
  templateId: string;
  abEnabled: boolean;

  // Block editor state (Paperling-grade)
  blocks: EmailBlock[];
  selectedBlockId: string | null;
  configOpenBlockId: string | null;
  history: EmailBlock[][];
  historyIndex: number;
  variantA: ABVariantContent;
  variantB: ABVariantContent;
  splitRatio: number;
  testDuration: number;
}

export interface CampaignComposerActions {
  open: () => void;
  close: () => void;
  setStep: (step: Step) => void;
  setName: (name: string) => void;
  setSubject: (subject: string) => void;
  setAudienceMode: (mode: AudienceMode) => void;
  setSelectedContactIds: (ids: string[]) => void;
  toggleContact: (id: string) => void;
  toggleAllContacts: (filteredIds: string[]) => void;
  allSelected: (filteredIds: string[]) => boolean;
  setSelectedGroupId: (id: string) => void;
  setSelectedSegmentId: (id: string) => void;
  setScheduleMode: (mode: ScheduleMode) => void;
  setScheduledDate: (date: string) => void;
  setScheduledTime: (time: string) => void;
  setRecurringFrequency: (freq: RecurringFrequency) => void;
  setTrackingEnabled: (enabled: boolean) => void;
  setGdprConsent: (consent: boolean) => void;
  setTemplateId: (id: string) => void;
  setAbEnabled: (enabled: boolean) => void;
  setVariantA: (content: ABVariantContent) => void;
  setVariantB: (content: ABVariantContent) => void;
  setSplitRatio: (ratio: number) => void;
  setTestDuration: (duration: number) => void;

  // Block editor actions
  addBlock: (type: BlockType, afterIndex?: number) => void;
  removeBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  moveBlock: (activeId: string, overId: string) => void;
  updateBlock: (id: string, changes: Partial<EmailBlock>) => void;
  selectBlock: (id: string | null) => void;
  toggleConfig: (id: string | null) => void;
  loadBlocks: (blocks: EmailBlock[]) => void;
  clearBlocks: () => void;
  undo: () => void;
  redo: () => void;
  getBodyHtml: () => string;
  _pushHistory: () => void;
}

type CampaignComposerStore = CampaignComposerState & CampaignComposerActions;

const initialState: CampaignComposerState = {
  isOpen: false,
  step: "audience",
  name: "",
  subject: "",
  audienceMode: "contacts",
  selectedContactIds: [],
  selectedGroupId: "",
  selectedSegmentId: "",
  scheduleMode: "immediate",
  scheduledDate: "",
  scheduledTime: "",
  recurringFrequency: "weekly",
  trackingEnabled: false,
  gdprConsent: false,
  templateId: "",
  abEnabled: false,

  blocks: [],
  selectedBlockId: null,
  configOpenBlockId: null,
  history: [[]],
  historyIndex: 0,
  variantA: { subject: "", body: "" },
  variantB: { subject: "", body: "" },
  splitRatio: 50,
  testDuration: 24,
};

export const useCampaignComposerStore = create<CampaignComposerStore>((set, get) => ({
  ...initialState,

  open: () => {
    const state = get();
    // Only reset if not already open — prevents infinite loop from re-render
    if (!state.isOpen) {
      set({ ...initialState, isOpen: true });
    }
  },

  close: () => set({ isOpen: false }),

  setStep: (step) => set({ step }),

  setName: (name) => set({ name }),
  setSubject: (subject) => set({ subject }),

  setAudienceMode: (audienceMode) => set({ audienceMode }),

  setSelectedContactIds: (selectedContactIds) => set({ selectedContactIds }),

  toggleContact: (id) => {
    const { selectedContactIds } = get();
    if (selectedContactIds.includes(id)) {
      set({ selectedContactIds: selectedContactIds.filter((s) => s !== id) });
    } else {
      set({ selectedContactIds: [...selectedContactIds, id] });
    }
  },

  toggleAllContacts: (filteredIds) => {
    const { selectedContactIds } = get();
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedContactIds.includes(id));
    if (allSelected) {
      set({ selectedContactIds: selectedContactIds.filter((s) => !filteredIds.includes(s)) });
    } else {
      const newIds = new Set(selectedContactIds);
      for (const id of filteredIds) newIds.add(id);
      set({ selectedContactIds: [...newIds] });
    }
  },

  allSelected: (filteredIds) => {
    const { selectedContactIds } = get();
    return filteredIds.length > 0 && filteredIds.every((id) => selectedContactIds.includes(id));
  },

  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),

  setSelectedSegmentId: (selectedSegmentId) => set({ selectedSegmentId }),

  setScheduleMode: (scheduleMode) => set({ scheduleMode }),

  setScheduledDate: (scheduledDate) => set({ scheduledDate }),

  setScheduledTime: (scheduledTime) => set({ scheduledTime }),

  setRecurringFrequency: (recurringFrequency) => set({ recurringFrequency }),

  setTrackingEnabled: (trackingEnabled) => {
    if (!trackingEnabled) {
      set({ trackingEnabled: false, gdprConsent: false });
    } else {
      set({ trackingEnabled });
    }
  },

  setGdprConsent: (gdprConsent) => set({ gdprConsent }),

  setTemplateId: (templateId) => set({ templateId }),

  setAbEnabled: (abEnabled) => set({ abEnabled }),

  setVariantA: (variantA) => set({ variantA }),

  setVariantB: (variantB) => set({ variantB }),

  setSplitRatio: (splitRatio) => set({ splitRatio }),

  setTestDuration: (testDuration) => set({ testDuration }),

  // Block editor actions
  addBlock: (type, afterIndex) => {
    const { blocks } = get();
    const block = createBlock(type);
    const idx = afterIndex === undefined ? blocks.length - 1 : afterIndex;
    const next = [...blocks];
    next.splice(idx + 1, 0, block);
    set({ blocks: next, selectedBlockId: block.id });
    get()._pushHistory();
  },
  removeBlock: (id) => {
    set((st) => ({ blocks: st.blocks.filter((b) => b.id !== id), selectedBlockId: null, configOpenBlockId: null }));
    get()._pushHistory();
  },
  duplicateBlock: (id) => {
    const { blocks } = get();
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const src = blocks[idx];
    if (!src) return;
    const copy = { ...src, id: createBlock(src.type).id } as EmailBlock;
    const next = [...blocks];
    next.splice(idx + 1, 0, copy);
    set({ blocks: next, selectedBlockId: copy.id });
    get()._pushHistory();
  },
  moveBlock: (activeId, overId) => {
    const { blocks } = get();
    const from = blocks.findIndex((b) => b.id === activeId);
    const to = blocks.findIndex((b) => b.id === overId);
    if (from === -1 || to === -1 || from === to) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    set({ blocks: next });
    get()._pushHistory();
  },
  updateBlock: (id, changes) => {
    set((st) => ({ blocks: st.blocks.map((b) => (b.id === id ? ({ ...b, ...changes } as EmailBlock) : b)) }));
    get()._pushHistory();
  },
  selectBlock: (id) => set({ selectedBlockId: id }),
  toggleConfig: (id) => set((st) => ({ configOpenBlockId: st.configOpenBlockId === id ? null : id })),
  loadBlocks: (blocks) => set({ blocks, history: [blocks], historyIndex: 0, selectedBlockId: null, configOpenBlockId: null }),
  clearBlocks: () => set({ blocks: [], selectedBlockId: null, configOpenBlockId: null, history: [[]], historyIndex: 0 }),
  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;
    const prev = historyIndex - 1;
    set({ historyIndex: prev, blocks: history[prev], selectedBlockId: null, configOpenBlockId: null });
  },
  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const next = historyIndex + 1;
    set({ historyIndex: next, blocks: history[next], selectedBlockId: null, configOpenBlockId: null });
  },
  getBodyHtml: () => renderEmailHtml(get().blocks),
  _pushHistory: () => {
    const { blocks, history, historyIndex } = get();
    const trimmed = history.slice(0, historyIndex + 1);
    const next = [...trimmed, blocks];
    const capped = next.length > 50 ? next.slice(next.length - 50) : next;
    set({ history: capped, historyIndex: capped.length - 1 });
  },
}));
