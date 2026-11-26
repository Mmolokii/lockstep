import { readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

/**
 * Route budgets (ADR 0009): the gzip size of every script a page downloads
 * until it's ready, measured from the built files so the number doesn't
 * depend on server compression. Sizes are the same in every browser, so this
 * runs in Chromium only.
 */
interface RouteBudget {
  readonly path: string;
  readonly ready: string;
  readonly maxKB: number;
  readonly basis: string;
}

const root = join(import.meta.dirname, "..", "..");
const chunks = join(root, "apps", "web", ".next", "static", "chunks");
const { routes } = JSON.parse(readFileSync(join(root, "bundle-budgets.json"), "utf8")) as {
  routes: RouteBudget[];
};

const gzipKB = (files: Iterable<string>) => {
  let bytes = 0;
  for (const f of files) bytes += gzipSync(readFileSync(join(chunks, f)), { level: 9 }).length;
  return Math.round((bytes / 1024) * 10) / 10;
};

test("every route has a budget entry with a basis", () => {
  expect(routes.length).toBeGreaterThan(0);
  for (const r of routes) expect(r.basis.length, r.path).toBeGreaterThan(0);
});

for (const route of routes) {
  test(`${route.path} downloads at most ${route.maxKB} KB of JavaScript (gzip)`, async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "sizes don't depend on the browser");
    const scripts = new Set<string>();
    page.on("response", (res) => {
      const match = new URL(res.url()).pathname.match(/^\/_next\/static\/chunks\/(.+\.js)$/);
      if (match?.[1]) scripts.add(decodeURIComponent(match[1]));
    });
    await page.goto(route.path);
    await page.locator(route.ready).first().waitFor();
    await page.waitForLoadState("networkidle");

    const kb = gzipKB(scripts);
    test.info().annotations.push({
      type: "bundle",
      description: `${route.path}: ${scripts.size} files, ${kb} KB gzip (budget ${route.maxKB} KB)`,
    });
    expect(scripts.size, "no scripts were observed").toBeGreaterThan(0);
    expect(kb, `${route.path}: ${scripts.size} files`).toBeLessThanOrEqual(route.maxKB);
  });
}
