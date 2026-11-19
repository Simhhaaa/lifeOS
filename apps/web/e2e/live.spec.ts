import { expect, test, type Page } from "@playwright/test";

const USERNAME = process.env.E2E_USERNAME ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";

test.skip(!USERNAME || !PASSWORD, "Set E2E_USERNAME and E2E_PASSWORD (or LIFEOS_DEV_OWNER_* in backend/.env)");

async function login(page: Page, next = "/") {
  await page.goto(next);
  await page.waitForURL(/\/login\?next=/);
  await page.fill("#username", USERNAME);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => u.pathname === next);
}

test("protected pages redirect to login; wrong password is rejected", async ({ page }) => {
  await page.goto("/productivity");
  await expect(page).toHaveURL(/\/login\?next=%2Fproductivity/);
  await page.fill("#username", USERNAME);
  await page.fill("#password", "definitely-not-the-password");
  await page.click("button[type=submit]");
  await expect(page.locator("#login-error")).toHaveText("That username and password don’t match.");
});

test("plan: add, complete (persists), conflict from another device, delete", async ({ page }) => {
  await login(page, "/productivity");
  const title = `E2E task ${Date.now()}`;
  await page.fill("#new-task", title);
  await page.getByRole("button", { name: "High", exact: true }).click();
  await page.getByRole("button", { name: "Add task" }).click();
  const row = page.locator("li", { hasText: title });
  await expect(row.getByText("High")).toBeVisible();

  await row.getByRole("checkbox").click();
  await expect(row.getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  await page.reload();
  await expect(page.locator("li", { hasText: title }).getByRole("checkbox")).toHaveAttribute("aria-checked", "true");

  // Another device edits the task: the stale tick must be refused, not silently overwrite.
  const status = await page.evaluate(async (t) => {
    const csrf = decodeURIComponent(document.cookie.match(/lifeos_csrf=([^;]+)/)![1]);
    const tasks = await (await fetch("/api/v1/tasks")).json();
    const task = tasks.find((x: { title: string }) => x.title === t);
    const r = await fetch(`/api/v1/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), "If-Match": String(task.version), "X-CSRF-Token": csrf },
      body: JSON.stringify({ title: `${t} (edited elsewhere)` }),
    });
    return r.status;
  }, title);
  expect(status).toBe(200);
  await page.locator("li", { hasText: title }).first().getByRole("checkbox").click();
  await expect(page.getByText("changed on another device")).toBeVisible();
  const edited = page.locator("li", { hasText: `${title} (edited elsewhere)` });
  await expect(edited).toBeVisible();

  await edited.hover();
  await edited.getByRole("button", { name: /Delete/ }).click();
  await expect(edited).toHaveCount(0);
});

test("daily check-in computes readiness; logout ends the session", async ({ page }) => {
  await login(page, "/health");
  const panel = page.locator("section", { has: page.getByRole("heading", { name: /Readiness/ }) });
  const open = panel.getByRole("button", { name: /Daily check-in|Edit check-in/ });
  await open.click();
  const dlg = page.getByRole("dialog");
  await dlg.getByRole("radiogroup", { name: "Energy" }).getByRole("radio", { name: "4" }).click();
  await dlg.getByRole("radiogroup", { name: "Recovery" }).getByRole("radio", { name: "4" }).click();
  await dlg.getByRole("button", { name: "Save check-in" }).click();
  await expect(dlg).toHaveCount(0);
  await expect(panel.getByText(/of 6 points/)).toBeVisible();

  await page.getByRole("button", { name: /Account:/ }).click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
