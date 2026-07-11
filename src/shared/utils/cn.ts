/**
 * Utility for conditionally joining class names
 * Simplified implementation without clsx dependency
 */

export function cn(...classes: (string | undefined | null | false | Record<string, boolean>)[]): string {
  const result: string[] = [];

  for (const cls of classes) {
    if (!cls) continue;

    if (typeof cls === "string") {
      result.push(cls);
    } else if (typeof cls === "object") {
      for (const [key, value] of Object.entries(cls)) {
        if (value) {
          result.push(key);
        }
      }
    }
  }

  return result.join(" ");
}
