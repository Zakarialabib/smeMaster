import { useEffect, useRef } from "react";
import type { Account } from "@features/accounts/stores/accountStore";

/**
 * Seed-on-first-run hook.
 *
 * Seeding is now handled entirely by the Rust orchestrator via bundled JSON seed
 * files (`crate::db::seed::seed_all` in `init.rs`). The orchestrator seeds all
 * demo data (company, account, labels, threads, messages, contacts, campaigns,
 * calendar, compliance profiles, etc.) atomically during the startup sequence
 * after migrations complete.
 *
 * This hook is retained as a lightweight no-op so the caller does not need to
 * change. It immediately returns `{ seeded: true }` since Rust handles seeding.
 *
 * Returns `{ seeded: boolean }`.
 */
export function useSeedOnFirstRun(_accounts: Account[]): { seeded: boolean } {
  const seeded = useRef(false);

  useEffect(() => {
    seeded.current = true;
  }, []);

  return { seeded: true };
}