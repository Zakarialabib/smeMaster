import { invokeCommand } from "@shared/services/db/invoke/command";
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { tauriStoreStorage } from '@shared/services/storage/tauriStoreStorage';

// ── Types ──────────────────────────────────────────────────────────────

export type UpdateChannel = 'stable' | 'beta' | 'nightly';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadSize: number;
  channel: UpdateChannel;
  sha256: string;
  signature: string;
}

export interface UpdateState {
  checking: boolean;
  available: UpdateInfo | null;
  downloading: boolean;
  downloadProgress: number;
  readyToInstall: boolean;
  error: string | null;
  lastCheckDate: Date | null;
  skippedVersions: string[];
  updateHistory: UpdateHistoryEntry[];
  channel: UpdateChannel;
}

export interface UpdateHistoryEntry {
  version: string;
  date: Date;
  success: boolean;
}


// ── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY_CHANNEL = 'smemaster.updater.channel';
const STORAGE_KEY_SKIPPED = 'smemaster.updater.skippedVersions';
const STORAGE_KEY_HISTORY = 'smemaster.updater.history';
const STORAGE_KEY_LAST_VERSION = 'smemaster.updater.lastVersion';

// Track if updater plugin is available
let updaterAvailable = false;

// ── Updater Service ────────────────────────────────────────────────────

class UpdaterService {
  private state: UpdateState;
  private progressCallbacks: Array<(progress: number) => void> = [];
  private errorCallbacks: Array<(error: string) => void> = [];
  private unlisteners: UnlistenFn[] = [];
  private offlineQueue: Array<() => Promise<void>> = [];
  private onlineHandler: (() => void) | null = null;

  constructor() {
    // Synchronous first pass: localStorage (browser dev mode and a
    // safe default if the async tauri-store rehydrate hasn't completed
    // yet). The async rehydrate below upgrades the state to the
    // durable on-disk store on Tauri.
    const channel = this.loadChannel();
    this.state = {
      checking: false,
      available: null,
      downloading: false,
      downloadProgress: 0,
      readyToInstall: false,
      error: null,
      lastCheckDate: this.loadLastCheckDate(),
      skippedVersions: this.loadSkippedVersions(),
      updateHistory: this.loadUpdateHistory(),
      channel,
    };

    this.setupEventListeners();
    this.setupOfflineDetection();

    // Async rehydrate from the durable store (tauri-plugin-store on
    // Tauri; localStorage fallback in browser). Replaces the old
    // pure-localStorage path so update state survives Android "clear
    // cache" / "clear data".
    void this.rehydrateFromDurableStore();
  }

  private async rehydrateFromDurableStore(): Promise<void> {
    try {
      const [channel, skipped, history, lastCheck] = await Promise.all([
        tauriStoreStorage.getItem(STORAGE_KEY_CHANNEL),
        tauriStoreStorage.getItem(STORAGE_KEY_SKIPPED),
        tauriStoreStorage.getItem(STORAGE_KEY_HISTORY),
        tauriStoreStorage.getItem('smemaster.updater.lastCheck'),
      ]);
      if (channel === 'beta' || channel === 'nightly' || channel === 'stable') {
        this.state.channel = channel;
      }
      if (skipped) {
        try {
          this.state.skippedVersions = JSON.parse(skipped) as string[];
        } catch {
          /* ignore */
        }
      }
      if (history) {
        try {
          const parsed = JSON.parse(history) as Array<{
            version: string;
            date: string;
            success: boolean;
          }>;
          this.state.updateHistory = parsed.map((entry) => ({
            ...entry,
            date: new Date(entry.date),
          }));
        } catch {
          /* ignore */
        }
      }
      if (lastCheck) {
        const d = new Date(lastCheck);
        if (!isNaN(d.getTime())) this.state.lastCheckDate = d;
      }
    } catch {
      /* ignore — keep the localStorage-sourced defaults */
    }
  }

  // ── Channel Management ─────────────────────────────────────────────

  setChannel(channel: UpdateChannel): void {
    this.state.channel = channel;
    void tauriStoreStorage.setItem(STORAGE_KEY_CHANNEL, channel);
  }

  getChannel(): UpdateChannel {
    return this.state.channel;
  }

  // ── Core Update Flow ───────────────────────────────────────────────

  async checkForUpdate(): Promise<UpdateInfo | null> {
    // Check if updater plugin is available
    if (!updaterAvailable) {
      updaterAvailable = await this.checkUpdaterAvailability();
    }

    if (!updaterAvailable) {
      this.state.error = 'Updater plugin not available';
      this.notifyStateChange();
      return null;
    }

    if (this.state.checking) return null;

    this.state.checking = true;
    this.state.error = null;
    this.notifyStateChange();

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        const info = this.mapUpdateToInfo(update);
        this.state.available = info;
        this.state.lastCheckDate = new Date();
        this.saveLastCheckDate();
        return info;
      }

      this.state.available = null;
      this.state.lastCheckDate = new Date();
      this.saveLastCheckDate();
      return null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.state.error = errorMsg;
      this.errorCallbacks.forEach((cb) => cb(errorMsg));
      return null;
    } finally {
      this.state.checking = false;
      this.notifyStateChange();
    }
  }

  async downloadUpdate(): Promise<void> {
    if (!updaterAvailable) {
      throw new Error('Updater plugin not available');
    }

    if (!this.state.available) {
      throw new Error('No update available to download');
    }

    this.state.downloading = true;
    this.state.downloadProgress = 0;
    this.state.error = null;
    this.notifyStateChange();

    // Track download progress and total
    let totalBytes = 0;

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (!update) {
        throw new Error('Update no longer available');
      }

      // Track download progress and total
      await update.download((event: Record<string, unknown>) => {
        if (event.event === 'Started') {
          const data = event.data as { contentLength?: number };
          totalBytes = data.contentLength ?? 0;
          this.state.downloadProgress = 0;
          this.progressCallbacks.forEach((cb) => cb(0));
          this.notifyStateChange();
        } else if (event.event === 'Progress') {
          const data = event.data as { chunkLength?: number };
          if (totalBytes > 0) {
            this.state.downloadProgress = Math.min(
              0.99,
              this.state.downloadProgress + (data.chunkLength ?? 0 / totalBytes)
            );
          }
          this.progressCallbacks.forEach((cb) => cb(this.state.downloadProgress));
          this.notifyStateChange();
        }
      });

      this.state.downloading = false;
      this.state.readyToInstall = true;
      this.state.downloadProgress = 1;
      this.notifyStateChange();
    } catch (err) {
      this.state.downloading = false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.state.error = errorMsg;
      this.errorCallbacks.forEach((cb) => cb(errorMsg));
      this.notifyStateChange();
      throw err;
    }
  }

  async installUpdate(): Promise<void> {
    if (!updaterAvailable) {
      throw new Error('Updater plugin not available');
    }

    if (!this.state.readyToInstall) {
      throw new Error('No update ready to install');
    }

    try {
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        await update.install();
      }
      // After installation, the app will restart automatically
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.state.error = errorMsg;
      this.errorCallbacks.forEach((cb) => cb(errorMsg));
      this.notifyStateChange();
      throw err;
    }
  }

  // ── Rollback Support ───────────────────────────────────────────────

  async rollbackIfNeeded(): Promise<boolean> {
    try {
      const needsRollback = await invokeCommand<boolean>('needs_rollback', {});
      if (needsRollback) {
        const rollbackVersion = await invokeCommand<string | null>('get_rollback_version', {});
        if (rollbackVersion) {
          console.info(`[Updater] Rollback to version ${rollbackVersion} needed`);
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  async markSuccessful(): Promise<void> {
    try {
      await invokeCommand('mark_successful_launch', {});
    } catch {
      // Fallback: write directly to the durable store
      void tauriStoreStorage.setItem(
        STORAGE_KEY_LAST_VERSION,
        this.getAppVersion(),
      );
    }
  }

  async getRollbackVersion(): Promise<string | null> {
    try {
      return await invokeCommand<string | null>('get_rollback_version', {});
    } catch {
      return null;
    }
  }

  // ── User Actions ───────────────────────────────────────────────────

  skipVersion(version: string): void {
    const skipped = this.state.skippedVersions;
    if (!skipped.includes(version)) {
      skipped.push(version);
      this.state.skippedVersions = skipped;
      void tauriStoreStorage.setItem(STORAGE_KEY_SKIPPED, JSON.stringify(skipped));
    }
  }

  getUpdateHistory(): UpdateHistoryEntry[] {
    return [...this.state.updateHistory];
  }

  // ── State Access ───────────────────────────────────────────────────

  getState(): UpdateState {
    return { ...this.state };
  }

  onProgress(callback: (progress: number) => void): void {
    this.progressCallbacks.push(callback);
  }

  onError(callback: (error: string) => void): void {
    this.errorCallbacks.push(callback);
  }

  // ── Offline Queue ──────────────────────────────────────────────────

  async checkNow(): Promise<UpdateInfo | null> {
    if (!navigator.onLine) {
      return new Promise((resolve, reject) => {
        this.offlineQueue.push(async () => {
          try {
            const result = await this.checkForUpdate();
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      });
    }
    return this.checkForUpdate();
  }

  // ── Cleanup ────────────────────────────────────────────────────────

  destroy(): void {
    this.unlisteners.forEach((u) => u());
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
  }

  // ── Private Helpers ────────────────────────────────────────────────

  private async checkUpdaterAvailability(): Promise<boolean> {
    try {
      const module = await import('@tauri-apps/plugin-updater');
      return typeof module.check === 'function';
    } catch {
      return false;
    }
  }

  private mapUpdateToInfo(update: { version: string; date?: string; body?: string }): UpdateInfo {
    return {
      version: update.version,
      releaseDate: update.date || new Date().toISOString(),
      releaseNotes: update.body || '',
      downloadSize: 0,
      channel: this.state.channel,
      sha256: '',
      signature: '',
    };
  }

  private getAppVersion(): string {
    try {
      return '__APP_VERSION__';
    } catch {
      return '0.0.0';
    }
  }

  private async setupEventListeners(): Promise<void> {
    try {
      const unlistenAvailable = await listen<{ version: string; date?: string; body?: string }>(
        'tauri://update-available',
        (event) => {
          const payload = event.payload as { version: string; date?: string; body?: string };
          this.state.available = {
            version: payload.version,
            releaseDate: payload.date || new Date().toISOString(),
            releaseNotes: payload.body || '',
            downloadSize: 0,
            channel: this.state.channel,
            sha256: '',
            signature: '',
          };
          this.notifyStateChange();
        }
      );
      this.unlisteners.push(unlistenAvailable);

      const unlistenProgress = await listen<{ chunkLength: number; contentLength?: number }>(
        'tauri://update-download-progress',
        (event) => {
          const payload = event.payload as { chunkLength: number; contentLength?: number };
          if (payload.contentLength && payload.contentLength > 0) {
            this.state.downloadProgress = payload.chunkLength / payload.contentLength;
          }
          this.progressCallbacks.forEach((cb) => cb(this.state.downloadProgress));
          this.notifyStateChange();
        }
      );
      this.unlisteners.push(unlistenProgress);

      const unlistenStatus = await listen<string>('tauri://update-status', (event) => {
        const status = event.payload;
        if (status === 'DONE') {
          this.state.readyToInstall = true;
          this.state.downloading = false;
        } else if (status === 'ERROR') {
          this.state.error = 'Update installation failed';
          this.state.downloading = false;
          this.errorCallbacks.forEach((cb) => cb('Update installation failed'));
        }
        this.notifyStateChange();
      });
      this.unlisteners.push(unlistenStatus);
    } catch {
      // Event listeners may not be available in all contexts
    }
  }

  private setupOfflineDetection(): void {
    this.onlineHandler = () => {
      const queue = [...this.offlineQueue];
      this.offlineQueue = [];
      queue.forEach((fn) => fn());
    };
    window.addEventListener('online', this.onlineHandler);
  }

  private notifyStateChange(): void {
    // React hook subscriptions use getState() which returns a copy
  }

  // ── Persistence ────────────────────────────────────────────────────

  private loadChannel(): UpdateChannel {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CHANNEL);
      if (stored === 'beta' || stored === 'nightly') return stored;
    } catch {
      // ignore
    }
    return 'stable';
  }

  private loadSkippedVersions(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SKIPPED);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  }

  private loadUpdateHistory(): UpdateHistoryEntry[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_HISTORY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return parsed.map((entry: { version: string; date: string; success: boolean }) => ({
          ...entry,
          date: new Date(entry.date),
        }));
      }
    } catch {
      // ignore
    }
    return [];
  }

  private loadLastCheckDate(): Date | null {
    try {
      const raw = localStorage.getItem('update_last_check');
      if (raw) return new Date(raw);
    } catch {
      // ignore
    }
    return null;
  }

  private saveLastCheckDate(): void {
    if (!this.state.lastCheckDate) return;
    void tauriStoreStorage.setItem(
      'smemaster.updater.lastCheck',
      this.state.lastCheckDate.toISOString(),
    );
  }
}

export { UpdaterService };
