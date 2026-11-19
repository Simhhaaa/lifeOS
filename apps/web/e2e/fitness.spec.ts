import { expect, test, type Page } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

test.skip(!USERNAME || !PASSWORD, "Set E2E_USERNAME and E2E_PASSWORD (or LIFEOS_DEV_OWNER_* in backend/.env)");

async function login(page: Page, next: string) {
  await page.goto(next);
  await page.waitForURL(/\/login\?next=/);
  await page.fill("#username", USERNAME);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === next);
}

// Records are named "E2E …" and stay on the account (there are no delete endpoints for them yet).
// Assertions avoid anything earlier runs could change (e.g. whether a set is an all-time PR);
// the PR rules themselves are covered by backend/tests/test_fitness.py.
test("fitness: exercise, split, plan, workout from a split, body measurement", async ({ page }) => {
  const id = String(Date.now()).slice(-6);
  const bench = `E2E Bench ${id}`;
  const split = `E2E Push ${id}`;
  await login(page, "/fitness");
  const dialog = page.getByRole("dialog");

  // Exercise, tracked as the bench press.
  await page.getByRole("button", { name: "Exercise", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill(bench);
  await dialog.getByLabel("Muscle group").selectOption("chest");
  await dialog.getByLabel("Equipment").fill("Barbell");
  await dialog.getByLabel("Tracked lift").selectOption("bench");
  await dialog.getByRole("button", { name: "Add exercise" }).click();
  await expect(dialog).toHaveCount(0);
  const libraryRow = page.locator("tr", { hasText: bench });
  await expect(libraryRow).toContainText("tracked");

  // A split with that exercise, two target sets.
  await page.getByRole("button", { name: "Split", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill(split);
  await dialog.getByRole("checkbox", { name: bench }).check();
  await dialog.getByLabel(`${bench} target sets`).fill("2");
  await dialog.getByRole("button", { name: "Add split" }).click();
  await expect(dialog).toHaveCount(0);

  // Plan: train today, rotating through the new split only.
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  await page.getByRole("button", { name: "Plan", exact: true }).click();
  const day = dialog.getByRole("button", { name: today, exact: true });
  if ((await day.getAttribute("aria-pressed")) !== "true") await day.click();
  while ((await dialog.getByRole("button", { name: /from rotation$/ }).count()) > 0) {
    await dialog.getByRole("button", { name: /from rotation$/ }).first().click();
  }
  await dialog.getByLabel("Add to rotation").selectOption({ label: split });
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(`Split: ${split} on`)).toBeVisible();
  await expect(page.getByText(`next: ${split}`)).toBeVisible();

  // Log a workout: the suggested split pre-fills two sets of the bench.
  await page.locator("header").getByRole("button", { name: "Log workout" }).click();
  await expect(dialog.getByLabel("Split")).toHaveValue(/.+/);
  await expect(dialog.getByLabel("Set 1 exercise")).toHaveValue(/.+/);
  await dialog.getByLabel("Set 1 kg").fill("100");
  await dialog.getByLabel("Set 1 reps").fill("5");
  await dialog.getByLabel("Set 2 kg").fill("105");
  await dialog.getByLabel("Set 2 reps").fill("5");
  await dialog.getByLabel("Set 2 RPE").fill("8.5");
  await dialog.getByRole("button", { name: "Add set" }).click();
  await dialog.getByLabel("Set 3 kg").fill("60");
  await dialog.getByLabel("Set 3 reps").fill("10");
  await dialog.getByLabel("Set 3 is a warm-up").check();
  await dialog.getByRole("button", { name: "Save workout" }).click();
  await expect(dialog).toHaveCount(0);

  // Newest session: split name, 2 working sets, volume 1,025 kg shown as 1.02 t (warm-up excluded), est. 1RM 122.5 on the top set.
  const latest = page.locator("details").first();
  await expect(latest).toContainText(split);
  await expect(latest).toContainText("2 sets");
  await expect(latest).toContainText("1.02 t");
  await expect(latest.locator("tr", { hasText: "Top" })).toContainText("122.5");
  await expect(libraryRow).toContainText("122.5 kg");

  // Body measurement.
  await page.getByRole("button", { name: "Log", exact: true }).last().click();
  await dialog.getByLabel("Bodyweight").fill("80.4");
  await dialog.getByLabel("Waist").fill("84");
  await dialog.getByRole("button", { name: "Save measurement" }).click();
  await expect(dialog).toHaveCount(0);
  const stats = page.locator('section[aria-label="Key figures"]');
  await expect(stats).toContainText("80.4");

  // Everything survives a reload (it came from the server, not local state).
  await page.reload();
  await expect(page.locator("details").first()).toContainText(split);
  await expect(page.locator("tr", { hasText: bench })).toContainText("122.5 kg");
});
