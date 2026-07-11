/**
 * createPersistedJsonSetting — type-safe wrapper around the SQLite-backed
 * settings KV store for storing typed values as JSON.
 *
 * Replaces the repeated "getSetting → validate → set state" boilerplate
 * found in stores like `configStore.hydrate`, `featureFlagStore.init`,
 * and `licenseStore.init`. Each call site previously did its own union
 * validation and JSON parsing, which is now centralized.
 *
 * @example Basic usage with defaults
 * ```ts
 * type ThemeMode = "light" | "dark" | "system";
 * const themeSetting = createPersistedJsonSetting<ThemeMode>({
 *   key: "theme",
 *   defaultValue: "system",
 *   validate: (raw) =>
 *     raw === "light" || raw === "dark" || raw === "system" ? raw : null,
 * });
 *
 * // In hydrate:
 * set({ theme: await themeSetting.get() });
 *
 * // In setter:
 * await themeSetting.set("dark");
 * ```
 *
 * @example Custom serializer / deserializer
 * ```ts
 * const intSetting = createPersistedJsonSetting<number>({
 *   key: "email_list_width",
 *   defaultValue: 320,
 *   serialize: (n) => String(n),
 *   deserialize: (raw) => parseInt(raw, 10),
 * });
 * ```
 */
import { getSetting, setSetting } from "@features/settings/db/settings";

export interface PersistedJsonSettingOptions<T> {
  /** The settings table key this value is stored under. */
  key: string;
  /** Returned when the key is missing, the raw value is invalid, or parsing fails. */
  defaultValue: T;
  /**
   * Optional validator. Receives the raw string from the settings table
   * and should return the typed value, or `null` to fall back to the
   * default. Use this for string-union types where `JSON.parse` alone
   * isn't enough.
   */
  validate?: (raw: string) => T | null;
  /** Optional serializer (defaults to `JSON.stringify`). */
  serialize?: (value: T) => string;
  /** Optional deserializer (defaults to `JSON.parse`). */
  deserialize?: (raw: string) => T;
}

export interface PersistedJsonSetting<T> {
  /**
   * Read the persisted value. Returns `defaultValue` if the key is
   * missing, the validator returns `null`, or parsing/validation throws.
   * Never throws.
   */
  get(): Promise<T>;
  /** Persist the value, serializing it before writing to the settings table. */
  set(value: T): Promise<void>;
}

/**
 * Create a typed, persisted JSON-backed setting.
 *
 * The returned `get()` is always safe to call — it swallows any error
 * (DB unreachable, corrupt JSON, validator threw) and returns the
 * default. `set()` propagates underlying write errors.
 */
export function createPersistedJsonSetting<T>(
  options: PersistedJsonSettingOptions<T>,
): PersistedJsonSetting<T> {
  return {
    async get(): Promise<T> {
      try {
        const raw = await getSetting(options.key);
        if (raw === null) return options.defaultValue;
        if (options.validate) {
          const validated = options.validate(raw);
          return validated ?? options.defaultValue;
        }
        return options.deserialize ? options.deserialize(raw) : JSON.parse(raw);
      } catch {
        return options.defaultValue;
      }
    },
    async set(value: T): Promise<void> {
      const serialized = options.serialize ? options.serialize(value) : JSON.stringify(value);
      await setSetting(options.key, serialized);
    },
  };
}
