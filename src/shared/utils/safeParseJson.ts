/**
 * Safely parse a JSON string with a fallback value.
 *
 * - Returns `fallback` for `null`, `undefined`, empty string, or invalid JSON.
 * - Optional `validate` predicate narrows the result to a specific shape.
 *
 * @example
 *   const obj = safeParseJson<TaskStep[]>(rule.actions, []);
 *   const validated = safeParseJson<{ name: string }>(raw, null, (v): v is { name: string } =>
 *     typeof v === "object" && v !== null && "name" in v,
 *   );
 */
export function safeParseJson<T>(value: string | null | undefined, fallback: T): T;
export function safeParseJson<T>(
  value: string | null | undefined,
  fallback: T,
  validate: (v: unknown) => v is T,
): T;
export function safeParseJson<T>(
  value: string | null | undefined,
  fallback: T,
  validate?: (v: unknown) => v is T,
): T {
  if (value == null || value === "") return fallback;
  try {
    const parsed: unknown = JSON.parse(value);
    if (validate) {
      return validate(parsed) ? parsed : fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

