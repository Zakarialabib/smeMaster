import { expect, type Page } from "@playwright/test";

const BASE = "http://localhost:1420";

/** Set mobile viewport (375x812) */
export const MOBILE_VIEW = { width: 375, height: 812 };

/**
 * Seed localStorage with onboarding done flag.
 * Call this once per describe block in a beforeAll or beforeEach.
 * Uses addInitScript to run BEFORE every navigation, avoiding race conditions.
 */
export async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("smemaster.onboarding.done", "true");
  });
}

/**
 * Navigate to a hash route.
 * Uses domcontentloaded instead of networkidle for speed,
 * then waits briefly for React to hydrate.
 */
export async function gotoRoute(page: Page, route: string) {
  await page.goto(`${BASE}/#${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
}

/**
 * Navigate to the base URL to let addInitScript seed localStorage.
 */
export async function initPage(page: Page) {
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}

/** Assert TopBar breadcrumb shows expected text */
export async function expectBreadcrumb(page: Page, text: string) {
  await expect(
    page.locator("header span.text-text-tertiary").first(),
  ).toContainText(text);
}

/** Get the current URL hash path */
export function getHashPath(url: string): string {
  try {
    const u = new URL(url);
    return u.hash.replace(/^#/, "") || "/";
  } catch {
    return url;
  }
}
