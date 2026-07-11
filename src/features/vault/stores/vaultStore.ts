import { create } from 'zustand';
import {
  getVaultRoot,
  listVaultDir,
  deleteFromVault,
  copyToVault,
  copyToVaultEncrypted,
  createVaultDir,
  getVaultSize,
  searchVault,
  getVaultItemsByCategory,
  authenticateBiometric,
  setVaultPin,
  verifyVaultPin,
  hasVaultPin,
  checkBiometricStatus,
  moveVaultItem,
  renameVaultItem,
  copyVaultItem,
  type VaultEntry,
  type CopyToVaultOptions,
} from '@shared/services/vault/vaultService';
import { withMutation } from '@shared/stores/createAsyncStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VaultViewMode = 'grid' | 'list';
export type VaultSortField = 'name' | 'date' | 'size';
export type VaultSortDirection = 'asc' | 'desc';

export interface VaultFileItem {
  name: string;
  path: string;
  isDir: boolean;
  category?: string;
}

export interface VaultState {
  // Data
  entries: VaultFileItem[];
  vaultRoot: string;
  currentPath: string;
  searchResults: string[] | null;
  vaultSize: number;

  // UI state
  viewMode: VaultViewMode;
  sortField: VaultSortField;
  sortDirection: VaultSortDirection;
  searchQuery: string;
  isLoading: boolean;
  error: string | null;
  selectionMode: boolean;
  selectedPaths: string[];

  // Auth state
  bioAvailable: boolean;
  unlocked: boolean;
  pinMode: 'none' | 'setup' | 'enter';

  // Account / Filter state
  activeAccountId: string;
  categoryFilter: string | null;

  // Actions
  loadDir: (dirPath: string) => Promise<void>;
  navigateTo: (dirPath: string) => void;
  navigateUp: () => void;
  navigateToBreadcrumb: (index: number) => void;
  deleteEntry: (vaultPath: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  uploadFile: (sourcePath: string, fileName: string, options?: CopyToVaultOptions) => Promise<void>;
  createFolder: (folderName: string) => Promise<void>;
  setViewMode: (mode: VaultViewMode) => void;
  setSortField: (field: VaultSortField) => void;
  toggleSortDirection: () => void;
  setSearchQuery: (query: string) => void;
  executeSearch: (pattern: string) => Promise<void>;
  clearSearch: () => void;
  refreshVaultSize: () => Promise<void>;
  setActiveAccountId: (id: string) => void;
  setCategoryFilter: (category: string | null) => void;
  unlock: () => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  setupPin: (pin: string) => Promise<void>;
  setPinMode: (mode: 'none' | 'setup' | 'enter') => void;
  checkPinExists: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  toggleSelectionMode: () => void;
  toggleItemSelection: (path: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Bulk file operations
  moveItem: (fromPath: string, toDir: string) => Promise<void>;
  renameItem: (oldPath: string, newName: string) => Promise<void>;
  copyItem: (sourcePath: string, destDir: string) => Promise<void>;
  
  /** Check biometric availability and update store. Returns true if available. */
  checkBioStatus: () => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapEntries(rawEntries: VaultEntry[], vaultRoot: string): VaultFileItem[] {
  return rawEntries.map((f) => {
    const parts = f.path
      .replace(vaultRoot, '')
      .replace(/^[/\\]/, '')
      .split(/[/\\]/);
    return {
      name: parts[parts.length - 1] || f.path,
      path: f.path,
      isDir: f.isDir,
      category: f.category,
    };
  });
}

function sortEntries(
  entries: VaultFileItem[],
  field: VaultSortField,
  direction: VaultSortDirection,
): VaultFileItem[] {
  const sorted = [...entries];

  // Always group directories first
  sorted.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;

    switch (field) {
      case 'name':
        return direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      case 'size':
        // For directories, use 0; for files, no size info from basic list
        return direction === 'asc' ? 0 : 0;
      case 'date':
        return direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  return sorted;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const initialState = {
  entries: [] as VaultFileItem[],
  vaultRoot: '',
  currentPath: '',
  searchResults: null as string[] | null,
  vaultSize: 0,
  viewMode: 'grid' as VaultViewMode,
  sortField: 'name' as VaultSortField,
  sortDirection: 'asc' as VaultSortDirection,
  searchQuery: '',
  isLoading: false,
  error: null as string | null,
  selectionMode: false,
  selectedPaths: [] as string[],
  bioAvailable: false,
  unlocked: false,
  pinMode: 'none' as 'none' | 'setup' | 'enter',
  activeAccountId: 'default',
  categoryFilter: null as string | null,
};

export const useVaultStore = create<VaultState>((set, get) => ({
  ...initialState,

  // ── Load directory ──────────────────────────────────────────
  loadDir: async (dirPath: string) => {
    await withMutation(
      async () => {
        const { activeAccountId, categoryFilter, sortField, sortDirection } = get();
        const root = await getVaultRoot(activeAccountId);
        const fullPath = dirPath ? `${root}/${dirPath}` : root;

        let rawEntries: VaultEntry[];
        if (categoryFilter) {
          const searchDir = dirPath ? `${root}/${dirPath}` : root;
          rawEntries = await getVaultItemsByCategory(categoryFilter, searchDir, activeAccountId);
        } else {
          rawEntries = await listVaultDir(fullPath, activeAccountId);
        }

        const entries = mapEntries(rawEntries, root);
        const sorted = sortEntries(entries, sortField, sortDirection);

        set({
          entries: sorted,
          vaultRoot: root,
          currentPath: dirPath,
          searchResults: null,
          searchQuery: '',
        });
      },
      {
        setLoading: (l) => set({ isLoading: l }),
        setError: (e) => set({ error: e }),
      },
    );
  },

  // ── Navigation ──────────────────────────────────────────────
  navigateTo: (dirPath: string) => {
    get().loadDir(dirPath);
  },

  navigateUp: () => {
    const { currentPath } = get();
    if (!currentPath) return;
    const parts = currentPath.split(/[/\\]/);
    parts.pop();
    get().loadDir(parts.join('/'));
  },

  navigateToBreadcrumb: (index: number) => {
    const { currentPath } = get();
    const parts = currentPath.split(/[/\\]/);
    get().loadDir(parts.slice(0, index + 1).join('/'));
  },

  // ── Delete ──────────────────────────────────────────────────
  deleteEntry: async (vaultPath: string) => {
    try {
      await deleteFromVault(vaultPath);
      await get().loadDir(get().currentPath);
      get().refreshVaultSize();
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Delete failed',
      });
    }
  },

  // ── Upload ──────────────────────────────────────────────────
  uploadFile: async (sourcePath: string, fileName: string, options?: CopyToVaultOptions) => {
    const { vaultRoot, currentPath } = get();
    if (!vaultRoot) return;

    const destDir = currentPath ? `${vaultRoot}/${currentPath}` : vaultRoot;
    const destPath = `${destDir}/${fileName}`;

    if (options?.encrypt) {
      await copyToVaultEncrypted(sourcePath, destPath, options);
    } else {
      await copyToVault(sourcePath, destPath);
    }

    await get().loadDir(currentPath);
    get().refreshVaultSize();
  },

  // ── Create folder ───────────────────────────────────────────
  createFolder: async (folderName: string) => {
    const { vaultRoot, currentPath } = get();
    if (!vaultRoot || !folderName.trim()) return;

    const fullPath = currentPath
      ? `${vaultRoot}/${currentPath}/${folderName}`
      : `${vaultRoot}/${folderName}`;

    await createVaultDir(fullPath);
    await get().loadDir(currentPath);
  },

  // ── View mode ───────────────────────────────────────────────
  setViewMode: (viewMode: VaultViewMode) => {
    set({ viewMode });
  },

  // ── Sort ────────────────────────────────────────────────────
  setSortField: (sortField: VaultSortField) => {
    const { entries, sortDirection } = get();
    const sorted = sortEntries(entries, sortField, sortDirection);
    set({ sortField, entries: sorted });
  },

  toggleSortDirection: () => {
    const { sortDirection, entries, sortField } = get();
    const newDir = sortDirection === 'asc' ? 'desc' : 'asc';
    const sorted = sortEntries(entries, sortField, newDir);
    set({ sortDirection: newDir, entries: sorted });
  },

  // ── Search ──────────────────────────────────────────────────
  setSearchQuery: (searchQuery: string) => {
    set({ searchQuery });
  },

  executeSearch: async (pattern: string) => {
    const { vaultRoot, currentPath, activeAccountId } = get();
    if (!vaultRoot || !pattern.trim()) {
      set({ searchResults: null, searchQuery: '' });
      return;
    }

    await withMutation(
      async () => {
        const searchDir = currentPath ? `${vaultRoot}/${currentPath}` : vaultRoot;
        const results = await searchVault(searchDir, pattern, activeAccountId);
        set({ searchResults: results, searchQuery: pattern });
      },
      {
        setLoading: (l) => set({ isLoading: l }),
        setError: (e) => set({ error: e }),
      },
    );
  },

  clearSearch: () => {
    set({ searchResults: null, searchQuery: '' });
  },

  // ── Account / Category ─────────────────────────────────────

  setActiveAccountId: (id: string) => {
    set({ activeAccountId: id });
    get().loadDir(get().currentPath);
  },

  setCategoryFilter: (category: string | null) => {
    set({ categoryFilter: category });
    get().loadDir(get().currentPath);
  },

  // ── Vault size ──────────────────────────────────────────────
  refreshVaultSize: async () => {
    try {
      const size = await getVaultSize();
      set({ vaultSize: size });
    } catch {
      // Silently ignore — non-critical
    }
  },

  // ── Auth ────────────────────────────────────────────────────
  unlock: async () => {
    // First check if biometric is available
    const bioAvailable = get().bioAvailable;
    if (!bioAvailable) {
      const checked = await get().checkBioStatus();
      if (!checked) {
        // Fall back to PIN mode if bio is not available
        const { pinMode } = get();
        if (pinMode === 'enter') {
          // PIN entry already visible — do nothing
          return;
        }
        // Otherwise try PIN setup/enter
        set({ pinMode: 'enter' });
        return;
      }
    }
    try {
      await authenticateBiometric('Unlock vault to access your files');
      set({ unlocked: true });
      get().loadDir('');
    } catch {
      // User cancelled or biometric failed — fallback to PIN if available
      const { pinMode } = get();
      if (pinMode === 'enter') {
        set({ pinMode: 'enter' }); // stay in enter mode
      }
    }
  },

  unlockWithPin: async (pin: string) => {
    try {
      const valid = await verifyVaultPin(pin);
      if (valid) {
        set({ unlocked: true, pinMode: 'none' });
        get().loadDir('');
      }
      return valid;
    } catch {
      return false;
    }
  },

  setupPin: async (pin: string) => {
    await setVaultPin(pin);
    set({ unlocked: true, pinMode: 'none' });
    get().loadDir('');
  },

  setPinMode: (pinMode) => set({ pinMode }),

  checkPinExists: async () => {
    // Single source of truth: the backend's `.vault_pin` file. Replaces
    // the old `localStorage` flag that desynced on Android "clear data".
    try {
      const hasPin = await hasVaultPin();
      set({ pinMode: hasPin ? 'enter' : 'setup' });
    } catch {
      set({ pinMode: 'setup' });
    }
  },

  // ── Selection / Bulk operations ──────────────────────────────
  toggleSelectionMode: () => {
    set((s) => ({ selectionMode: !s.selectionMode, selectedPaths: [] }));
  },

  toggleItemSelection: (path: string) => {
    set((s) => {
      const idx = s.selectedPaths.indexOf(path);
      if (idx >= 0) {
        return { selectedPaths: s.selectedPaths.filter((p) => p !== path) };
      }
      return { selectedPaths: [...s.selectedPaths, path] };
    });
  },

  selectAll: () => {
    set((s) => ({
      selectedPaths: s.entries.map((e) => e.path),
    }));
  },

  clearSelection: () => {
    set({ selectedPaths: [], selectionMode: false });
  },

  deleteSelected: async () => {
    const { selectedPaths } = get();
    if (selectedPaths.length === 0) return;
    try {
      for (const path of selectedPaths) {
        await deleteFromVault(path);
      }
      set({ selectedPaths: [], selectionMode: false });
      await get().loadDir(get().currentPath);
      get().refreshVaultSize();
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Bulk delete failed',
      });
    }
  },

  // ── Move ────────────────────────────────────────────────────
  moveItem: async (fromPath: string, toDir: string) => {
    try {
      await moveVaultItem(fromPath, toDir);
      await get().loadDir(get().currentPath);
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Move failed',
      });
    }
  },

  // ── Rename ──────────────────────────────────────────────────
  renameItem: async (oldPath: string, newName: string) => {
    try {
      await renameVaultItem(oldPath, newName);
      await get().loadDir(get().currentPath);
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Rename failed',
      });
    }
  },

  // ── Copy ────────────────────────────────────────────────────
  copyItem: async (sourcePath: string, destDir: string) => {
    try {
      await copyVaultItem(sourcePath, destDir);
      await get().loadDir(get().currentPath);
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : 'Copy failed',
      });
    }
  },

  // ── Biometric status check ──────────────────────────────────
  checkBioStatus: async () => {
    try {
      const result = await checkBiometricStatus();
      set({ bioAvailable: result.isAvailable });
      return result.isAvailable;
    } catch {
      set({ bioAvailable: false });
      return false;
    }
  },

  // ── Refresh ─────────────────────────────────────────────────
  refresh: async () => {
    await get().loadDir(get().currentPath);
    get().refreshVaultSize();
  },

  // ── Reset ───────────────────────────────────────────────────
  reset: () => {
    set(initialState);
  },
}));
