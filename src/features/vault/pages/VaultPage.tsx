import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  Upload,
  Plus,
  Shield,
  ShieldOff,
  Loader2,
  Folder,
  CheckSquare,
  Trash2,
  X,
} from 'lucide-react';
import { useVaultStore } from '../stores/vaultStore';
import { useAccountStore } from '@features/accounts/stores/accountStore';
import { VaultFilePreview } from '../components/VaultFilePreview';
import { VaultBreadcrumb } from '../components/VaultBreadcrumb';
import { VaultSearchBar } from '../components/VaultSearchBar';
import { VaultFileList } from '../components/VaultFileList';
import { VaultUploadZone } from '../components/VaultUploadZone';
import { VaultEmptyState } from '../components/VaultEmptyState';
import { VaultStorageIndicator } from '../components/VaultStorageIndicator';
import { VaultToolbar } from '../components/VaultToolbar';
import { SkeletonPage, GlassPanel } from '@shared/components/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadOptions {
  visible: boolean;
  sourcePath: string;
  fileName: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VaultPage() {
  const { t } = useTranslation();
  const store = useVaultStore();
  const {
    entries,
    currentPath,
    isLoading: loading,
    error,
    bioAvailable,
    unlocked,
    pinMode,
    viewMode,
    vaultRoot,
    searchResults,
    vaultSize,
    selectionMode,
    selectedPaths,
  } = store;

  // File preview
  const [previewFile, setPreviewFile] = useState<{
    path: string;
    name: string;
  } | null>(null);

  // Upload
  const [upload, setUpload] = useState<UploadOptions | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [encryptUpload, setEncryptUpload] = useState(false);
  const [pgpKeysExist, setPgpKeysExist] = useState(false);

  // New folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const folderInputRef = useRef<HTMLInputElement>(null);

  // PIN state
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  // Active account from account store
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccount = activeAccountId
    ? accounts.find((a) => a.id === activeAccountId)
    : undefined;

  // Sync activeAccountId to vault store whenever it changes
  useEffect(() => {
    if (activeAccountId) {
      store.setActiveAccountId(activeAccountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAccountId]);

  // Initialization
  useEffect(() => {
    store.checkPinExists();
    store.loadDir('');
    store.refreshVaultSize();

    // Check if PGP keys exist
    import('@shared/services/db/pgpKeys')
      .then((mod) => mod.getPgpKeys(''))
      .then((keys) => setPgpKeysExist(keys.length > 0))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lock screen ─────────────────────────────────────────────

  const handlePinSubmit = async () => {
    setPinError(null);
    if (pinValue.length < 4) {
      setPinError('PIN must be at least 4 characters');
      return;
    }

    setPinLoading(true);
    try {
      if (pinMode === 'setup') {
        if (pinValue !== pinConfirm) {
          setPinError('PINs do not match');
          setPinLoading(false);
          return;
        }
        await store.setupPin(pinValue);
      } else {
        const valid = await store.unlockWithPin(pinValue);
        if (!valid) {
          setPinError('Incorrect PIN');
        }
      }
    } catch (e) {
      setPinError(e instanceof Error ? e.message : 'PIN operation failed');
    } finally {
      setPinLoading(false);
    }
  };

  if (!bioAvailable && !unlocked && pinMode === 'none') {
    store.checkPinExists();
  }

  if (!unlocked) {
    if (bioAvailable) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <Lock size={48} className="text-accent" />
          <h2 className="text-lg font-semibold">{t('vault.locked')}</h2>
          <p className="text-sm text-text-tertiary text-center">{t('vault.unlockDescription')}</p>
          <button
            onClick={() => store.unlock()}
            className="px-6 py-2 bg-accent text-white rounded-lg"
          >
            <Unlock size={16} className="inline mr-2" />
            {t('vault.unlock')}
          </button>
          <button
            onClick={() => {
              store.setPinMode('enter');
              setPinValue('');
              setPinError(null);
            }}
            className="mt-2 text-xs text-text-tertiary underline hover:text-text-primary"
          >
            Use PIN instead
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
        {pinMode === 'setup' ? (
          <>
            <Shield size={48} className="text-accent" />
            <h2 className="text-lg font-semibold">Set Vault PIN</h2>
            <p className="text-sm text-text-tertiary text-center">
              Create a PIN to secure your vault files
            </p>

            <div className="w-full max-w-xs space-y-3">
              <input
                type="password"
                inputMode="numeric"
                placeholder="Enter PIN (4+ characters)"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-bg-secondary border border-border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-center tracking-widest"
                autoFocus
              />
              <input
                type="password"
                inputMode="numeric"
                placeholder="Confirm PIN"
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-bg-secondary border border-border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-center tracking-widest"
              />
              {pinError && <p className="text-xs text-danger-text text-center">{pinError}</p>}
              <button
                onClick={handlePinSubmit}
                disabled={pinLoading}
                className="w-full px-6 py-2.5 bg-accent text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pinLoading ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                Set PIN
              </button>
            </div>
          </>
        ) : (
          <>
            <Lock size={48} className="text-accent" />
            <h2 className="text-lg font-semibold">Enter Vault PIN</h2>
            <p className="text-sm text-text-tertiary text-center">
              Enter your PIN to unlock the vault
            </p>

            <div className="w-full max-w-xs space-y-3">
              <input
                type="password"
                inputMode="numeric"
                placeholder="Enter PIN"
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className="w-full px-4 py-2.5 text-sm bg-bg-secondary border border-border-secondary rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/50 text-center tracking-widest"
                autoFocus
              />
              {pinError && <p className="text-xs text-danger-text text-center">{pinError}</p>}
              <button
                onClick={handlePinSubmit}
                disabled={pinLoading}
                className="w-full px-6 py-2.5 bg-accent text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {pinLoading ? <Loader2 size={16} className="animate-spin" /> : <Unlock size={16} />}
                Unlock
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Upload handlers ─────────────────────────────────────────

  const handleUploadClick = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: 'Select a file to upload to vault',
      });
      if (!selected) return;

      const path = typeof selected === 'string' ? selected : String(selected);
      const name = path.split(/[/\\]/).pop() ?? 'file';

      setUpload({ visible: true, sourcePath: path, fileName: name });
      setEncryptUpload(false);
    } catch (e) {
      console.error('File dialog failed:', e);
    }
  };

  const handleUploadConfirm = async () => {
    if (!upload) return;
    setUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(40);
      await store.uploadFile(upload.sourcePath, upload.fileName, {
        encrypt: encryptUpload,
      });
      setUploadProgress(100);
      setUpload(null);
    } catch (e) {
      console.error('Upload failed:', e);
      store.error;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDragUpload = (sourcePath: string, fileName: string) => {
    setUpload({ visible: true, sourcePath, fileName });
    setEncryptUpload(false);
  };

  // ── New folder ──────────────────────────────────────────────

  const handleNewFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await store.createFolder(newFolderName);
      setNewFolderName('');
      setShowNewFolder(false);
    } catch (e) {
      console.error('Create folder failed:', e);
    }
  };

  // ── Navigation ──────────────────────────────────────────────

  const handleNavigate = (entryPath: string) => {
    const relPath = entryPath.replace(vaultRoot, '').replace(/^[/\\]/, '');
    store.navigateTo(relPath);
  };

  // ── Display entries (search results or regular entries) ──────

  const displayEntries = searchResults
    ? searchResults.map((path) => {
        const parts = path
          .replace(vaultRoot, '')
          .replace(/^[/\\]/, '')
          .split(/[/\\]/);
        return {
          name: parts[parts.length - 1] || path,
          path,
          isDir: false,
        };
      })
    : entries;

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Upload options modal */}
      {upload && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-primary rounded-xl shadow-2xl max-w-md w-full mx-2 p-6">
            <h3 className="text-base font-semibold mb-1">Upload file</h3>
            <p className="text-xs text-text-tertiary mb-4 truncate">{upload.fileName}</p>

            {/* Encrypt checkbox */}
            {pgpKeysExist && (
              <label className="flex items-center gap-2 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={encryptUpload}
                  onChange={(e) => setEncryptUpload(e.target.checked)}
                  className="rounded border-border-secondary accent-accent"
                />
                <span className="text-sm flex items-center gap-1">
                  {encryptUpload ? (
                    <Shield size={14} className="text-accent" />
                  ) : (
                    <ShieldOff size={14} />
                  )}
                  Encrypt with PGP
                </span>
              </label>
            )}

            {/* Progress bar */}
            {uploading && (
              <div className="mb-4">
                <div className="w-full bg-bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-text-tertiary mt-1 text-right">{uploadProgress}%</p>
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setUpload(null)}
                disabled={uploading}
                className="px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover rounded-lg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadConfirm}
                disabled={uploading}
                className="px-4 py-2 text-sm bg-accent text-white rounded-lg disabled:opacity-50 flex items-center gap-1.5"
              >
                {uploading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File preview modal */}
      {previewFile && (
        <VaultFilePreview
          filePath={previewFile.path}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Header toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-secondary shrink-0">
        <VaultBreadcrumb
          currentPath={currentPath}
          onNavigate={(path) => store.navigateTo(path)}
          onNavigateUp={() => store.navigateUp()}
        />

        {activeAccount && (
          <span className="hidden sm:inline text-xs text-text-tertiary ml-auto">
            {activeAccount.email}
          </span>
        )}

        <VaultStorageIndicator usedBytes={vaultSize} className="hidden sm:flex" />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-secondary shrink-0">
        <VaultSearchBar className="flex-1" />

        <button
          onClick={handleUploadClick}
          className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          title="Upload file"
          aria-label="Upload file"
        >
          <Upload size={18} />
        </button>
        <button
          onClick={() => {
            setShowNewFolder(!showNewFolder);
            if (!showNewFolder) {
              setTimeout(() => folderInputRef.current?.focus(), 50);
            }
          }}
          className="p-1.5 text-text-tertiary hover:text-text-primary hover:bg-bg-hover rounded transition-colors"
          title="New folder"
          aria-label="Create new folder"
        >
          <Plus size={18} />
        </button>

        {/* Selection toggle */}
        {entries.length > 0 && (
          <button
            onClick={() => store.toggleSelectionMode()}
            className={`p-1.5 rounded transition-colors ${
              selectionMode
                ? 'bg-accent/10 text-accent'
                : 'text-text-tertiary hover:text-text-primary hover:bg-bg-hover'
            }`}
            title={selectionMode ? 'Exit selection mode' : 'Select files'}
            aria-label={selectionMode ? 'Exit selection mode' : 'Select files'}
          >
            {selectionMode ? <X size={18} /> : <CheckSquare size={18} />}
          </button>
        )}
      </div>

      {/* Bulk action bar */}
      {selectionMode && selectedPaths.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent/5 border-b border-accent/20 shrink-0">
          <span className="text-xs font-medium text-text-primary mr-auto">
            {selectedPaths.length} selected
          </span>
          <button
            onClick={() => store.selectAll()}
            className="px-2 py-1 text-xs text-accent hover:bg-accent/10 rounded transition-colors"
          >
            Select all
          </button>
          <button
            onClick={() => store.clearSelection()}
            className="px-2 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
          >
            Clear
          </button>
          <div className="w-px h-4 bg-border-secondary mx-1" />
          <button
            onClick={() => {
              if (window.confirm(`Delete ${selectedPaths.length} selected item(s)?`)) {
                store.deleteSelected();
              }
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs text-danger-text hover:bg-danger-bg/10 rounded transition-colors"
            title="Delete selected"
            aria-label="Delete selected items"
          >
            <Trash2 size={13} />
            Delete
          </button>
        </div>
      )}

      {/* New folder inline input */}
      {showNewFolder && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border-secondary bg-bg-secondary/50">
          <Folder size={16} className="text-accent shrink-0" aria-hidden="true" />
          <input
            ref={folderInputRef}
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleNewFolder();
              if (e.key === 'Escape') setShowNewFolder(false);
            }}
            placeholder="Folder name"
            className="flex-1 px-2 py-1 text-sm bg-transparent border border-border-secondary rounded focus:outline-none focus:ring-1 focus:ring-accent/50"
            aria-label="New folder name"
          />
          <button
            onClick={handleNewFolder}
            disabled={!newFolderName.trim()}
            className="px-3 py-1 text-xs font-medium bg-accent text-white rounded disabled:opacity-40"
          >
            Create
          </button>
        </div>
      )}

      {/* Toolbar */}
      {entries.length > 0 && (
        <VaultToolbar className="px-4 py-1.5 border-b border-border-secondary shrink-0" />
      )}

      {/* Drag-and-drop upload zone */}
      <VaultUploadZone onUpload={handleDragUpload} className="mx-4 mt-3" />

      {/* File list */}
      <GlassPanel variant="card" className="flex-1 overflow-y-auto mx-3 mb-3">
      <div
        aria-busy={loading && displayEntries.length === 0}
        aria-live="polite"
        aria-label="Vault file list"
      >
        {loading ? (
          <SkeletonPage />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-4">
            <AlertCircle size={40} className="text-danger-text opacity-60" />
            <p className="text-sm font-medium text-text-primary">Failed to load vault</p>
            <p className="text-xs text-text-tertiary text-center max-w-sm">{error}</p>
            <button
              onClick={() => store.refresh()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-accent hover:bg-accent-hover rounded-md transition-colors"
            >
              <RefreshCw size={13} />
              Retry
            </button>
          </div>
        ) : displayEntries.length === 0 ? (
          <VaultEmptyState onUpload={handleUploadClick} />
        ) : (
          <VaultFileList
            entries={displayEntries}
            viewMode={viewMode}
            onNavigate={handleNavigate}
            onPreview={(entry) => setPreviewFile({ path: entry.path, name: entry.name })}
            onDelete={(path) => store.deleteEntry(path)}
            selectionMode={selectionMode}
            selectedPaths={selectedPaths}
            onToggleSelect={(path) => store.toggleItemSelection(path)}
          />
        )}
      </div>
      </GlassPanel>
    </div>
  );
}
