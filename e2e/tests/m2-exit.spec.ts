import { expect, test } from "@playwright/test";
import { documentText, editor, openScratch, waitForWritesToSettle } from "../support/scratch.ts";

/**
 * M2 exit criterion (docs/BUILD_PROMPT.md): "two tabs edit the same file live,
 * and a reload keeps the content".
 *
 * The final check runs with every tab closed, so the content can only come
 * from IndexedDB. Reloading one tab while another is open would also pass if
 * the open tab handed the content over BroadcastChannel, which proves nothing
 * about persistence.
 */
test("M2 exit: two tabs edit the same file live, and a reload keeps the content", async ({
  context,
}) => {
  const tab1 = await context.newPage();
  const tab2 = await context.newPage();
  await openScratch(tab1);
  await openScratch(tab2);

  // Live, both directions.
  await editor(tab1).click();
  await tab1.keyboard.type("// tab one");
  await expect(editor(tab2)).toContainText("// tab one");

  await editor(tab2).click();
  await tab2.keyboard.press("ControlOrMeta+End");
  await tab2.keyboard.press("Enter");
  await tab2.keyboard.type("// tab two");
  await expect(editor(tab1)).toContainText("// tab two");

  // Concurrent typing in both tabs converges to the same document.
  await editor(tab1).click();
  await tab1.keyboard.press("ControlOrMeta+Home");
  await editor(tab2).click();
  await tab2.keyboard.press("ControlOrMeta+End");
  await Promise.all([tab1.keyboard.type("A1 A2 A3 "), tab2.keyboard.type(" B1 B2 B3")]);
  await expect
    .poll(async () => (await documentText(tab1)) === (await documentText(tab2)))
    .toBe(true);
  const converged = await documentText(tab1);
  for (const piece of ["// tab one", "// tab two", "A1 A2 A3", "B1 B2 B3"]) {
    expect(converged).toContain(piece);
  }

  // Reload one tab while the other stays open: it comes back with the same document.
  await waitForWritesToSettle(tab1);
  await tab1.reload();
  await expect(editor(tab1)).toBeVisible();
  await expect.poll(() => documentText(tab1)).toBe(converged);

  // Close every tab, then open a new one: the content can only come from IndexedDB.
  await waitForWritesToSettle(tab1);
  await tab1.close();
  await tab2.close();
  const reopened = await context.newPage();
  await openScratch(reopened);
  await expect.poll(() => documentText(reopened)).toBe(converged);
});
