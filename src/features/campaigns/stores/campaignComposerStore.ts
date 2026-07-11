import { create } from "zustand";

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
}

type CampaignComposerStore = CampaignComposerState & CampaignComposerActions;

const initialState: CampaignComposerState = {
  isOpen: false,
  step: "audience",
  name: "",
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
}));
