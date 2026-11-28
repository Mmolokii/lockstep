import { expect, test } from "@playwright/test";
import { editor, openScratch, typeAndPersist } from "../support/scratch.ts";

test("reloading keeps the content", async ({ page }) => {
  await openScratch(page);
  await typeAndPersist(page, "const persisted = 1;");
  await page.reload();
  await expect(editor(page)).toContainText("const persisted = 1;");
});

test("editing works with the network disabled, and survives a reload", async ({
  page,
  context,
}) => {
  await openScratch(page);
  const offlineRequests: string[] = [];
  page.on("request", (req) => offlineRequests.push(req.url()));

  await context.setOffline(true);
  await typeAndPersist(page, "written offline");
  await expect(editor(page)).toContainText("written offline");
  // Local-first: editing never touches the network.
  expect(offlineRequests).toEqual([]);

  await context.setOffline(false);
  await page.reload();
  await expect(editor(page)).toContainText("written offline");
});

test("the theme toggle and the editor work from the keyboard alone", async ({ page }) => {
  await openScratch(page);
  const toggle = page.getByRole("button", { name: "Dark theme" });
  await toggle.focus();
  const before = await toggle.getAttribute("aria-pressed");
  await page.keyboard.press("Space");
  await expect(toggle).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");

  // Tab moves from the toggle into the editor, and typing edits the document.
  await page.keyboard.press("Tab");
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type("typed by keyboard");
  await expect(editor(page)).toContainText("typed by keyboard");
});

test("the scratch page loads without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  await openScratch(page);
  expect(errors).toEqual([]);
});
