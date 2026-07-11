/**
 * Database migrations are now handled automatically by the Rust backend.
 * The migrations module in src-tauri/src/db/migrations.rs runs on startup.
 * 
 * This file is kept for backward compatibility with any remaining imports.
 * If you see this warning, the file still has old usages that need migration.
 */
export async function runMigrations(): Promise<void> {
  console.warn("[db] Frontend runMigrations() called - migrations are handled by Rust backend automatically");
}

/**
 * Split SQL into individual statements, respecting BEGIN…END blocks
 * so trigger bodies survive intact.
 * @deprecated No longer needed - Rust handles migrations
 */
export function splitStatements(_sql: string): string[] {
  return [];
}
