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

// Records created here are named "E2E …". Only subjects can be deleted through the API, so a local
// run leaves its records on the account it signs in with; CI runs against a fresh database.
test("academics: subject, session, assignment, DSA problem, milestone, semester", async ({ page }) => {
  const id = String(Date.now()).slice(-6);
  const short = `E2E${id}`;
  const name = `E2E Subject ${id}`;
  await login(page, "/academics");
  const dialog = page.getByRole("dialog");

  // Subject, then one syllabus unit done.
  await page.getByRole("button", { name: "Subject", exact: true }).click();
  await dialog.getByLabel("Name", { exact: true }).fill(name);
  await dialog.getByLabel("Short name").fill(short);
  await dialog.getByLabel("Credits").fill("4");
  await dialog.getByLabel("Syllabus units").fill("6");
  await dialog.getByRole("button", { name: "Add subject" }).click();
  await expect(dialog).toHaveCount(0);
  const subjectRow = page.locator("tr", { hasText: short });
  await expect(subjectRow).toContainText("0/6");
  await subjectRow.getByRole("button", { name: `One more unit done for ${short}` }).click();
  await expect(subjectRow).toContainText("1/6");

  // A 45-minute study session for that subject counts toward its 28-day figures.
  await page.locator("header").getByRole("button", { name: "Log session" }).click();
  await dialog.getByLabel("Subject").selectOption({ label: `${short} · ${name}` });
  await dialog.getByLabel("Focused minutes").fill("45");
  await dialog.getByRole("button", { name: "Save session" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(subjectRow).toContainText("1×");

  // Assignment due today, then moved to In progress from its status chip.
  const assignment = `E2E assignment ${id}`;
  await page.getByRole("button", { name: "Assignment", exact: true }).click();
  await dialog.getByLabel("Subject").selectOption({ label: `${short} · ${name}` });
  await dialog.getByLabel("Title", { exact: true }).fill(assignment);
  await dialog.getByRole("button", { name: "Add assignment" }).click();
  await expect(dialog).toHaveCount(0);
  const assignmentRow = page.locator("li", { hasText: assignment });
  await expect(assignmentRow).toContainText("Due today");
  await assignmentRow.getByRole("button", { name: new RegExp(`Status of ${assignment}`) }).click();
  await page.getByRole("menuitem", { name: "In progress" }).click();
  await expect(assignmentRow).toContainText("In progress");

  // A solved problem raises the lifetime count; the same URL a second time is refused.
  const solved = page.locator('section[aria-label="Key figures"] > div').nth(2);
  await expect(solved).toContainText(/\d/);
  const before = Number((await solved.locator("span").first().textContent()) ?? "0");
  const url = `https://example.com/problems/e2e-${id}`;
  for (const attempt of [1, 2]) {
    await page.getByRole("button", { name: "Problem", exact: true }).click();
    await dialog.getByRole("radio", { name: "Hard" }).click();
    await dialog.getByLabel("Topic").fill("E2E Graphs");
    await dialog.getByLabel("Problem URL").fill(url);
    await dialog.getByRole("button", { name: "Log problem" }).click();
    if (attempt === 1) {
      await expect(dialog).toHaveCount(0);
      await expect(solved.locator("span").first()).toHaveText(String(before + 1));
    } else {
      await expect(dialog.getByRole("alert")).toBeVisible();
      await dialog.getByRole("button", { name: "Close" }).click();
    }
  }

  // Learning milestone, ticked done.
  const milestone = `E2E milestone ${id}`;
  await page.getByRole("button", { name: "Milestone", exact: true }).click();
  await dialog.getByLabel("Title", { exact: true }).fill(milestone);
  await dialog.getByRole("button", { name: "Add milestone" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: `Mark “${milestone}” done` }).click();
  await expect(page.getByRole("button", { name: `Mark “${milestone}” not done` })).toBeVisible();

  // Semester with an SGPA, then the SGPA corrected inline; it persists across a reload.
  await page.getByRole("button", { name: "Semester", exact: true }).click();
  const label = ((await dialog.getByRole("heading").textContent()) ?? "").replace("Add ", "");
  await dialog.getByLabel("Credits").fill("20");
  await dialog.getByLabel("SGPA").fill("8.5");
  await dialog.getByRole("button", { name: "Add semester" }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: `Edit ${label} SGPA` }).click();
  await page.getByRole("spinbutton", { name: `${label} SGPA` }).fill("9");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: `Edit ${label} SGPA` })).toHaveText("9.00");
  await page.reload();
  await expect(page.getByRole("button", { name: `Edit ${label} SGPA` })).toHaveText("9.00");
  await expect(page.locator("tr", { hasText: short })).toContainText("1/6");
});
