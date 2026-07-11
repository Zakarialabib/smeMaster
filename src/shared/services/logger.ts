/**
 * Logger Service - Unified logging for frontend and backend
 *
 * This logger captures frontend events and sends them to the Rust backend
 * via the log_event and log_error_command IPC commands. The backend stores
 * logs in an in-memory buffer for the Logs UI.
 */

import { invokeCommand } from "@shared/services/db/invoke/command";

// ── Types ──────────────────────────────────────────────────────────────────

export type LogLevel = "debug" | "info" | "warning" | "error" | "critical";

export interface LogEntry {
  id: string;
  timestamp: string | Date;
  level: LogLevel;
  message: string;
  category?: string;
  data?: unknown;
}

interface LoggerListener {
  (logs: LogEntry[]): void;
}

// ── Logger Class ──────────────────────────────────────────────────────────

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: LoggerListener[] = [];
  private _isLoggingIpcError = false;

  /**
   * Add a log entry to the in-memory buffer
   */
  private addLog(
    level: LogLevel,
    message: string,
    category?: string,
    data?: unknown
  ): LogEntry {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      level,
      message,
      category,
      data,
    };

    this.logs.unshift(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener([...this.logs]));

    // Console output for development
    if (import.meta.env.DEV) {
      const consoleMethod =
        level === "error" || level === "critical" ? "error" : "log";
      console[consoleMethod](
        `[${level.toUpperCase()}]${category ? ` [${category}]` : ""} ${message}`,
        data ?? ""
      );
    }

    // Send error/critical logs to backend
    if (level === "error" || level === "critical") {
      this.sendToBackend(entry);
    }

    return entry;
  }

  /**
   * Send log entry to Rust backend
   */
  private async sendToBackend(entry: LogEntry) {
    if (this._isLoggingIpcError) return;

    this._isLoggingIpcError = true;

    try {
      await invokeCommand("log_error_command", {
        error: entry.message,
        stack:
          entry.data && typeof entry.data === "object"
            ? String((entry.data as Record<string, unknown>).stack ?? "")
            : undefined,
        component: entry.category ?? "frontend",
        timestamp:
          entry.timestamp instanceof Date
            ? entry.timestamp.toISOString()
            : String(entry.timestamp),
      });
    } catch {
      // Silently swallow errors to prevent infinite loops
    } finally {
      this._isLoggingIpcError = false;
    }
  }

  debug(message: string, category?: string, data?: unknown) {
    return this.addLog("debug", message, category, data);
  }

  info(message: string, category?: string, data?: unknown) {
    return this.addLog("info", message, category, data);
  }

  warn(message: string, category?: string, data?: unknown) {
    return this.addLog("warning", message, category, data);
  }

  error(message: string, category?: string, data?: unknown) {
    return this.addLog("error", message, category, data);
  }

  critical(message: string, category?: string, data?: unknown) {
    return this.addLog("critical", message, category, data);
  }

  /**
   * Log a raw event to the backend (for high-frequency events)
   */
  async logEvent(
    level: LogLevel,
    message: string,
    category?: string,
    data?: unknown
  ): Promise<void> {
    try {
      await invokeCommand("log_event", {
        level,
        message,
        category,
        data,
      });
    } catch {
      // Silently fail for event logging
    }
  }

  /**
   * Set logs from backend (used when syncing with backend buffer)
   */
  setLogs(entries: LogEntry[]) {
    this.logs = entries;
    this.listeners.forEach((listener) => listener([...this.logs]));
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs filtered by level
   */
  getLogsByLevel(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /**
   * Get all error-level logs
   */
  getErrors(): LogEntry[] {
    return this.logs.filter(
      (log) => log.level === "error" || log.level === "critical"
    );
  }

  /**
   * Get all warning-level logs
   */
  getWarnings(): LogEntry[] {
    return this.logs.filter((log) => log.level === "warning");
  }

  clearLogs() {
    this.logs = [];
    this.listeners.forEach((listener) => listener([]));
  }

  /**
   * Subscribe to log changes
   */
  subscribe(listener: LoggerListener): () => void {
    this.listeners.push(listener);
    // Immediately call with current logs
    listener([...this.logs]);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getLogCount(): number {
    return this.logs.length;
  }

  getErrorCount(): number {
    return this.logs.filter(
      (log) => log.level === "error" || log.level === "critical"
    ).length;
  }

  getWarningCount(): number {
    return this.logs.filter((log) => log.level === "warning").length;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

const logger = new Logger();

export default logger;
export { logger };
