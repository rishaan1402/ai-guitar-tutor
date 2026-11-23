import { expect, test, type Page } from "@playwright/test";

/**
 * The journeys a learner can't do without. Each runs against the real backend
 * (see playwright.config.ts) and fails on any uncaught page error.
 */

const API = "http://localhost:8100";

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test.beforeEach(async ({ context }) => {
  // skip the landing intro animation
  await context.addInitScript(() => {
    try {
      localStorage.setItem("os:intro-seen", "1");
    } catch {
      /* storage blocked */
    }
  });
});

test("landing page leads into the studio", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.getByRole("link", { name: /start in 30 seconds/i }).first()).toBeVisible();
  await page.goto("/studio");
  // first visit: the welcome card, then the room with its hint and a list of everything in it
  await expect(page.getByRole("dialog", { name: "Your practice room" })).toBeVisible();
  await page.getByRole("button", { name: /I.ll explore/ }).click();
  await expect(page.getByText(/drag the pick around the room/i)).toBeVisible();
  await page.getByRole("button", { name: "see a list" }).click();
  await page.getByRole("dialog", { name: "Everything in the room" }).getByRole("button", { name: /Chords/ }).click();
  await page.waitForURL(/\/practice/);
  expect(errors).toEqual([]);
});

test("sign up, then stay signed in after a reload", async ({ page }) => {
  const errors = watchErrors(page);
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel(/name/i).first().fill("E2E Player");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/^password/i).first().fill("guitar123");
  const confirm = page.getByLabel(/confirm/i);
  if (await confirm.count()) await confirm.fill("guitar123");
  await page.getByRole("button", { name: /create account|sign up/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"));
  await page.goto("/practice");
  await expect(page.getByText("E2E Player").first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("E2E Player").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("practise a chord: record it and get it graded", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/practice?chord=G_major");
  await expect(page.getByText(/Step 1 of 3/)).toBeVisible();
  await page.getByRole("button", { name: /next/i }).click();
  await expect(page.getByText(/Step 2 of 3/)).toBeVisible();
  // the microphone plays a reference recording of G major
  await page.getByRole("button", { name: "Record your chord" }).click();
  await expect(page.getByText(/Step 3 of 3/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/what the engine heard/i)).toBeVisible();
  await expect(page.getByText(/All 3 expected notes were found/i)).toBeVisible();
  expect(errors).toEqual([]);
});

test("learn a song: it opens from the song library, saves, and survives a reload", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/practice?mode=song");
  const box = page.locator('input[type="text"], input[type="search"]').first();
  await box.fill("let it be by the beatles");
  await box.press("Enter");
  await expect(page.getByRole("heading", { name: "Let It Be" })).toBeVisible();
  await expect(page.getByText("Well-known chords")).toBeVisible();
  await page.getByRole("button", { name: /save this song/i }).click();
  await expect(page.getByRole("button", { name: /✓ Saved/ })).toBeVisible();
  // leave and come back: the song (and the saved list) are still there
  await page.goto("/path");
  await page.goto("/practice?mode=song");
  await expect(page.getByRole("heading", { name: "Let It Be" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /your saved songs/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("lessons: open the path and start the first lesson", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/path");
  await expect(page.getByRole("heading", { name: "Lessons" })).toBeVisible();
  await page.getByRole("link", { name: /up next/i }).click();
  await page.waitForURL(/\/path\/session/);
  await expect(page.locator("main")).toBeVisible();
  expect(errors).toEqual([]);
});

test("password reset request is accepted without revealing accounts", async ({ page, request }) => {
  const errors = watchErrors(page);
  await page.goto("/forgot-password");
  await page.getByLabel(/email/i).fill("nobody@example.com");
  await page.getByRole("button", { name: /send|reset/i }).click();
  await expect(page.getByRole("status").filter({ hasText: /has an account, we.ve sent a link/i })).toBeVisible();
  // the API answers the same for unknown addresses
  const r = await request.post(`${API}/api/auth/password-reset/request`, { data: { email: "nobody@example.com" } });
  expect(r.status()).toBe(202);
  expect(errors).toEqual([]);
});
