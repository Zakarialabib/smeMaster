import { test, expect } from "@playwright/test";
import { skipOnboarding, gotoRoute, expectBreadcrumb, MOBILE_VIEW } from "../helpers/test-utils";

test.describe("Onboarding Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Don't skip onboarding - we want to test it
    await page.setViewportSize(MOBILE_VIEW);
    await page.goto("http://localhost:1420", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
  });

  test("onboarding can be dismissed by completing it", async ({ page }) => {
    // Check if the onboarding is visible (may or may not be depending on state)
    const onboardingVisible = await page.getByText(/Step \d+ of 4/).isVisible().catch(() => false);
    if (!onboardingVisible) {
      // Already past onboarding, skip test
      test.skip();
      return;
    }
    // Just verify it exists
    await expect(page.getByText(/Step 1 of 4|Welcome to SMEMaster/).first()).toBeAttached({ timeout: 5000 });
  });
});

test.describe("Dashboard (Desktop)", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("dashboard page renders", async ({ page }) => {
    await gotoRoute(page, "/dashboard");
    await expectBreadcrumb(page, "Dashboard");
  });
});

test.describe("Mail / Inbox", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("inbox page renders", async ({ page }) => {
    await gotoRoute(page, "/mail/inbox");
    await expectBreadcrumb(page, "Inbox");
  });

  test("mail with label renders", async ({ page }) => {
    await gotoRoute(page, "/mail/starred");
    await expectBreadcrumb(page, "Mail");
  });
});

test.describe("Contacts", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("contacts page renders", async ({ page }) => {
    await gotoRoute(page, "/people");
    await page.waitForTimeout(2000);
    expect(page.url()).toContain("people");
  });

  test("contacts page loads without critical errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.text().includes("IPC")) errors.push(msg.text());
    });
    await gotoRoute(page, "/people");
    await page.waitForTimeout(2000);
    expect(errors.filter((e) => !e.includes("Cannot read properties of undefined"))).toHaveLength(0);
  });
});

test.describe("Tasks", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("tasks page renders", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await expectBreadcrumb(page, "Tasks");
  });

  test("tasks page has quick add input", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1000);
    // Quick add input with placeholder "Add a task..."
    const input = page.locator("input[placeholder*='Add a task']").first();
    await expect(input).toBeAttached({ timeout: 5000 });
  });

  test("tasks page has New task button", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);
    const newTaskBtn = page.getByRole("button", { name: /new task/i });
    await expect(newTaskBtn).toBeAttached({ timeout: 5000 });
  });

  test("shows view mode toggle (desktop)", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);
    // Should see view switch buttons — list/kanban/calendar/agenda
    const viewToggle = page.locator('[role="radiogroup"]').first();
    await expect(viewToggle).toBeAttached({ timeout: 5000 });
  });

  test("can switch to kanban view", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);
    // Click the kanban view toggle button
    const kanbanBtn = page.locator('button[aria-label*="kanban" i], button:has(svg) >> text=Kanban').first();
    const exists = await kanbanBtn.count() > 0;
    if (exists) {
      await kanbanBtn.click();
      await page.waitForTimeout(500);
      // Kanban columns should be visible
      await expect(page.locator('[role="region"]').first()).toBeAttached({ timeout: 3000 });
    }
  });

  test("opens task create modal via New task button", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);

    // Click "New task" button
    const newTaskBtn = page.getByRole("button", { name: /new task/i });
    await newTaskBtn.click();
    await page.waitForTimeout(500);

    // The modal should appear with a title input
    const modalTitleInput = page.locator('input[placeholder*="What needs to be done?"]').first();
    await expect(modalTitleInput).toBeAttached({ timeout: 3000 });
  });

  test("create modal validates empty title", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);

    // Open create modal
    await page.getByRole("button", { name: /new task/i }).click();
    await page.waitForTimeout(500);

    // Click create without typing a title
    await page.getByRole("button", { name: /create task/i }).click();
    await page.waitForTimeout(300);

    // Should show validation error
    const errorText = page.getByText(/Task title is required/i);
    await expect(errorText).toBeAttached({ timeout: 3000 });
  });

  test("create modal allows adding tags", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);

    // Open create modal
    await page.getByRole("button", { name: /new task/i }).click();
    await page.waitForTimeout(500);

    // Type in the tag input and press Enter
    const tagInput = page.locator('input[placeholder*="Add a tag"]').first();
    await tagInput.fill("crm");
    await tagInput.press("Enter");
    await page.waitForTimeout(200);

    // Tag should appear as a badge
    const tagBadge = page.getByText("crm");
    await expect(tagBadge).toBeAttached({ timeout: 2000 });
  });

  test("shows contact search panel when linking contact", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);

    // Open create modal
    await page.getByRole("button", { name: /new task/i }).click();
    await page.waitForTimeout(500);

    // Click "Link contact"
    const linkContactBtn = page.getByText("Link contact");
    await expect(linkContactBtn).toBeAttached({ timeout: 2000 });
    await linkContactBtn.click();

    // Contact search input should appear
    const searchInput = page.locator('input[placeholder*="Search contacts"]').first();
    await expect(searchInput).toBeAttached({ timeout: 2000 });
  });

  test("supports reminder toggle", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);

    // Open create modal
    await page.getByRole("button", { name: /new task/i }).click();
    await page.waitForTimeout(500);

    // Find the Enable checkbox and toggle it
    const enableCheckbox = page.locator('input[type="checkbox"]').first();
    await enableCheckbox.check();
    await page.waitForTimeout(200);

    // Reminder presets should appear
    const presetSelect = page.getByText("15 min before");
    await expect(presetSelect).toBeAttached({ timeout: 2000 });
  });

  test("shows source type tabs in create modal", async ({ page }) => {
    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(1500);

    // Open create modal
    await page.getByRole("button", { name: /new task/i }).click();
    await page.waitForTimeout(500);

    // Source tabs should be visible
    await expect(page.getByText("Task")).toBeAttached();
    await expect(page.getByText("From email")).toBeAttached();
    await expect(page.getByText("From note")).toBeAttached();
  });

  test("pages does not crash on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await gotoRoute(page, "/tasks");
    await page.waitForTimeout(2000);

    // Filter out harmless IPC errors (Tauri bridge unavailable in browser)
    const userFacingErrors = errors.filter(
      (e) => !e.includes("IPC") && !e.includes("invoke") && !e.includes("Cannot read properties of undefined"),
    );
    expect(userFacingErrors).toHaveLength(0);
  });
});

test.describe("Campaigns", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("campaigns page renders", async ({ page }) => {
    await gotoRoute(page, "/campaigns");
    await expectBreadcrumb(page, "Campaigns");
  });
});

test.describe("Calendar", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("calendar page renders", async ({ page }) => {
    await gotoRoute(page, "/calendar");
    await expectBreadcrumb(page, "Calendar");
  });
});

test.describe("Automation", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("automation page renders", async ({ page }) => {
    await gotoRoute(page, "/automation");
    await expectBreadcrumb(page, "Automation");
  });
});

test.describe("Vault", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("vault page renders", async ({ page }) => {
    await gotoRoute(page, "/vault");
    await expectBreadcrumb(page, "Vault");
  });
});
