import { expect, type Page, test } from "@playwright/test";

/** Number of updates y-indexeddb has stored for the scratch document. */
const storedUpdates = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("lockstep:scratch");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("updates")) {
            db.close();
            resolve(0);
            return;
          }
          const count = db.transaction("updates", "readonly").objectStore("updates").count();
          count.onsuccess = () => {
            db.close();
            resolve(count.result);
          };
          count.onerror = () => reject(count.error);
        };
      }),
  );

const editor = (page: Page) => page.getByRole("textbox", { name: "scratch.ts" });

async function openScratch(page: Page) {
  await page.goto("/scratch");
  await expect(editor(page)).toBeVisible();
  // The TypeScript grammar is a lazy chunk; let it arrive before going offline.
  await page.waitForLoadState("networkidle");
}

/** Types into the editor and waits until IndexedDB holds the new updates. */
async function typeAndPersist(page: Page, text: string) {
  const before = await storedUpdates(page);
  await editor(page).click();
  await page.keyboard.type(text);
  await expect.poll(() => storedUpdates(page)).toBeGreaterThan(before);
}

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
