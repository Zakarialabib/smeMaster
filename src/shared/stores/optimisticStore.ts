import { useSyncStore } from "@/stores/shared";

export interface OptimisticOp<T = unknown> {
  id: string;
  description: string;
  /** Apply the optimistic state immediately */
  apply: () => void;
  /** Execute the actual backend/API call */
  execute: () => Promise<T>;
  /** Rollback the optimistic state on failure */
  rollback: () => void;
  /** Called on success (optional) */
  commit?: () => void;
  /** Error handler (optional) */
  onError?: (error: Error) => void;
}

type OpStatus = "pending" | "executing" | "committed" | "rolled_back";

interface TrackedOp {
  op: OptimisticOp;
  status: OpStatus;
  startedAt: number;
  error?: string;
}

class OptimisticStore {
  private ops = new Map<string, TrackedOp>();
  private counter = 0;

  /**
   * Run an operation with optimistic update + automatic rollback.
   * Returns the result of the backend call on success.
   * Throws on failure after rollback.
   */
  async run<T>(op: OptimisticOp<T>): Promise<T> {
    const id = op.id || `op_${++this.counter}`;

    // Track the operation
    this.ops.set(id, { op, status: "pending", startedAt: Date.now() });
    this.updatePendingCount();

    // Phase 1: Apply optimistic state
    try {
      op.apply();
      this.ops.get(id)!.status = "executing";
    } catch (applyErr) {
      this.ops.delete(id);
      this.updatePendingCount();
      throw applyErr;
    }

    // Phase 2: Execute backend call
    try {
      const result = await op.execute();
      const tracked = this.ops.get(id);
      if (tracked) tracked.status = "committed";

      // Phase 3: Commit (e.g., update with server response)
      if (op.commit) {
        try {
          op.commit();
        } catch {
          // silent - commit errors are non-critical
        }
      }

      this.ops.delete(id);
      this.updatePendingCount();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      // Rollback
      try {
        op.rollback();
        const tracked = this.ops.get(id);
        if (tracked) {
          tracked.status = "rolled_back";
          tracked.error = error.message;
        }
      } catch (rollbackErr) {
        console.error("Rollback failed:", rollbackErr);
      }

      // Call error handler
      if (op.onError) {
        try {
          op.onError(error);
        } catch {
          // silent
        }
      }

      // Keep in ops map for visibility, then clear after 5s
      setTimeout(() => {
        this.ops.delete(id);
        this.updatePendingCount();
      }, 5000);

      this.updatePendingCount();
      throw error;
    }
  }

  get pendingCount(): number {
    return this.ops.size;
  }

  get pendingOps(): TrackedOp[] {
    return Array.from(this.ops.values());
  }

  get hasPendingOps(): boolean {
    return this.ops.size > 0;
  }

  retryFailed(description: string): void {
    const failed = Array.from(this.ops.entries()).find(
      ([_, tracked]) =>
        tracked.status === "rolled_back" &&
        tracked.op.description === description,
    );
    if (failed) {
      const [id] = failed;
      this.ops.delete(id);
      this.updatePendingCount();
    }
  }

  private updatePendingCount(): void {
    useSyncStore.getState().setPendingOpsCount(this.ops.size);
  }
}

export const optimisticStore = new OptimisticStore();
