import { expect, test } from "@playwright/test";
import { editor, openScratch } from "../support/scratch.ts";

test("two tabs edit the same file live", async ({ context }) => {
  // Tabs in one browser context share an origin and profile, like a user's tabs.
  const tab1 = await context.newPage();
  const tab2 = await context.newPage();
  await openScratch(tab1);
  await openScratch(tab2);

  await editor(tab1).click();
  await tab1.keyboard.type("from tab one");
  await expect(editor(tab2)).toContainText("from tab one");

  await editor(tab2).click();
  await tab2.keyboard.press("ControlOrMeta+End");
  await tab2.keyboard.type(" and tab two");
  await expect(editor(tab1)).toContainText("from tab one and tab two");
});

test("a tab opened later starts with what the open tab has typed", async ({ context }) => {
  const first = await context.newPage();
  await openScratch(first);
  await editor(first).click();
  await first.keyboard.type("typed before the second tab opened");

  const second = await context.newPage();
  await openScratch(second);
  await expect(editor(second)).toContainText("typed before the second tab opened");
});
