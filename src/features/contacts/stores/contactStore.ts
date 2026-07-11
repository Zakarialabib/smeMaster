import { create } from "zustand";
import { getContactTags, upsertContactTag, deleteContactTag, getContactCountForTag, type DbContactTag } from "@features/contacts/db/contactTags";
import { getContactGroups, upsertContactGroup, deleteContactGroup, getContactCountForGroup, type DbContactGroup } from "@features/contacts/db/contactGroups";
import { getContactSegments, upsertContactSegment, deleteContactSegment, type DbContactSegment } from "@features/contacts/db/contactSegments";
import { createAsyncActions, initialAsyncState } from "@shared/stores/createAsyncStore";
import { createCrudSlice } from "@shared/stores/createCrudSlice";

export interface ContactTag {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  contact_count: number;
}

export interface ContactGroup {
  id: string;
  name: string;
  description: string | null;
  contact_count: number;
}

export interface ContactSegment {
  id: string;
  name: string;
  query: string;
}

function mapTag(db: DbContactTag, count: number): ContactTag {
  return { id: db.id, name: db.name, color: db.color, sort_order: db.sort_order, contact_count: count };
}

function mapGroup(db: DbContactGroup, count: number): ContactGroup {
  return { id: db.id, name: db.name, description: db.description, contact_count: count };
}

function mapSegment(db: DbContactSegment): ContactSegment {
  return { id: db.id, name: db.name, query: db.query };
}

interface ContactState {
  tags: ContactTag[];
  groups: ContactGroup[];
  segments: ContactSegment[];
  isLoading: boolean;
  error: string | null;
  loadTags: (accountId: string) => Promise<void>;
  loadGroups: (accountId: string) => Promise<void>;
  loadSegments: (accountId: string) => Promise<void>;
  createTag: (accountId: string, name: string, color?: string) => Promise<void>;
  createGroup: (accountId: string, name: string, description?: string) => Promise<void>;
  createSegment: (accountId: string, name: string, query: string) => Promise<void>;
  deleteTag: (id: string, accountId: string) => Promise<void>;
  deleteGroup: (id: string, accountId: string) => Promise<void>;
  deleteSegment: (id: string, accountId: string) => Promise<void>;
}

export const useContactStore = create<ContactState>((set, get) => {
  const { withLoading } = createAsyncActions(set);
  const crud = createCrudSlice({
    setLoading: (l) => set({ isLoading: l }),
    setError: (e) => set({ error: e }),
  });

  return {
    tags: [],
    groups: [],
    segments: [],
    ...initialAsyncState,

    loadTags: async (accountId) => {
      await withLoading(async () => {
        const dbTags = await getContactTags(accountId);
        const tags = await Promise.all(dbTags.map(async (t) => mapTag(t, await getContactCountForTag(t.id))));
        set({ tags });
      });
    },

    loadGroups: async (accountId) => {
      await withLoading(async () => {
        const dbGroups = await getContactGroups(accountId);
        const groups = await Promise.all(dbGroups.map(async (g) => mapGroup(g, await getContactCountForGroup(g.id))));
        set({ groups });
      });
    },

    loadSegments: async (accountId) => {
      await withLoading(async () => {
        const dbSegments = await getContactSegments(accountId);
        const segments = dbSegments.map(mapSegment);
        set({ segments });
      });
    },

    createTag: async (accountId, name, color) => {
      await crud.withCreate(
        () => upsertContactTag(undefined, accountId, name, color),
        () => get().loadTags(accountId),
        "Failed to create contact tag",
      );
    },

    createGroup: async (accountId, name, description) => {
      await crud.withCreate(
        () => upsertContactGroup(undefined, accountId, name, description),
        () => get().loadGroups(accountId),
        "Failed to create contact group",
      );
    },

    createSegment: async (accountId, name, query) => {
      await crud.withCreate(
        () => upsertContactSegment(undefined, accountId, name, query),
        () => get().loadSegments(accountId),
        "Failed to create contact segment",
      );
    },

    deleteTag: async (id, accountId) => {
      await crud.withDelete(
        () => deleteContactTag(id, accountId),
        () => get().loadTags(accountId),
        "Failed to delete contact tag",
      );
    },

    deleteGroup: async (id, accountId) => {
      await crud.withDelete(
        () => deleteContactGroup(id, accountId),
        () => get().loadGroups(accountId),
        "Failed to delete contact group",
      );
    },

    deleteSegment: async (id, accountId) => {
      await crud.withDelete(
        () => deleteContactSegment(id, accountId),
        () => get().loadSegments(accountId),
        "Failed to delete contact segment",
      );
    },
  };
});