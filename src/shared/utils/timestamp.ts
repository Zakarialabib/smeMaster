/**
 * Get the current Unix timestamp in seconds.
 */
export function getCurrentUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}
