/**
 * Shared form validators for use with the `useFormField` hook.
 *
 * Each validator returns `undefined` when valid, or a translation KEY (string)
 * when invalid. Callers pass the key through `t()` for display, e.g.:
 *
 *   const name = useFormField({ validator: required });
 *   ...
 *   {name.error && <p className="text-danger text-xs">{t(name.error)}</p>}
 *
 * Keeping messages as i18n keys (not literals) means validation is translatable
 * out of the box across en/ar/fr/it.
 */

export type Validator = (value: string) => string | undefined;

/** Field must not be empty / whitespace-only. */
export const required: Validator = (v) =>
  v.trim().length === 0 ? "validation.required" : undefined;

/** Basic RFC-ish email shape. Empty is allowed (compose with `required`). */
export const email: Validator = (v) => {
  if (v.trim().length === 0) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    ? undefined
    : "validation.email";
};

/** Minimum length. */
export const minLength =
  (n: number): Validator =>
  (v) =>
    v.trim().length < n ? "validation.minLength" : undefined;

/** Maximum length. */
export const maxLength =
  (n: number): Validator =>
  (v) =>
    v.length > n ? "validation.maxLength" : undefined;

/** Numeric value. Empty allowed. */
export const numeric: Validator = (v) => {
  if (v.trim().length === 0) return undefined;
  return Number.isNaN(Number(v)) ? "validation.numeric" : undefined;
};

/** Positive number (> 0). Empty allowed. */
export const positive: Validator = (v) => {
  if (v.trim().length === 0) return undefined;
  const n = Number(v);
  return Number.isNaN(n) || n <= 0 ? "validation.positive" : undefined;
};

/** Compose multiple validators; returns the first error found. */
export const compose =
  (...validators: Validator[]): Validator =>
  (v) => {
    for (const validate of validators) {
      const err = validate(v);
      if (err) return err;
    }
    return undefined;
  };
