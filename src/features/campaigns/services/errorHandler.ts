/**
 * Campaigns error handling utilities.
 *
 * Re-exports from the shared safeDbOperation module so that campaigns
 * can import from its own path for convenience.
 *
 * Every create/update/delete operation in the campaigns feature should use
 * `safeDbOperation` to guarantee consistent error surfacing.
 */
export {
  safeDbOperation,
  extractTechnicalError,
  getUserFriendlyErrorMessage,
  type DbResult,
  type SafeDbOptions,
} from "@shared/services/error/safeDbOperation";
