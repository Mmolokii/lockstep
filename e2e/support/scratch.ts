import { expect, type Page } from "@playwright/test";

/** The editing surface on /scratch (CodeMirror's content, labelled by file name). */
export const editor = (page: Page) => page.getByRole("textbox", { name: "scratch.ts" });

/** The document text as the editor shows it, one line per CodeMirror line. */
export const documentText = (page: Page) =>
  page
    .locator(".cm-content .cm-line")
    .evaluateAll((lines) => lines.map((line) => line.textContent ?? "").join("\n"));

export async function openScratch(page: Page) {
  await page.goto("/scratch");
  await expect(editor(page)).toBeVisible();
  // The TypeScript grammar is a lazy chunk; let it arrive (matters before going offline).
  await page.waitForLoadState("networkidle");
}

/** Number of updates y-indexeddb has stored for the scratch document. */
export const storedUpdates = (page: Page) =>
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

/** Types into the editor and waits until IndexedDB holds the new updates. */
export async function typeAndPersist(page: Page, text: string) {
  const before = await storedUpdates(page);
  await editor(page).click();
  await page.keyboard.type(text);
  await expect.poll(() => storedUpdates(page)).toBeGreaterThan(before);
}

/**
 * Waits until IndexedDB stops receiving writes: the stored update count is
 * non-zero and unchanged across two reads 200 ms apart. Closing a tab while
 * a write is in flight could abort it.
 */
export async function waitForWritesToSettle(page: Page) {
  let last = -1;
  await expect
    .poll(
      async () => {
        const now = await storedUpdates(page);
        const settled = now > 0 && now === last;
        last = now;
        return settled;
      },
      { intervals: [200] },
    )
    .toBe(true);
}
