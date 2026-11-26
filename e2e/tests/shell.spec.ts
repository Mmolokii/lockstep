import { expect, test } from "@playwright/test";

test("home page renders the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Lockstep");
  await expect(page.getByRole("heading", { level: 1, name: "Lockstep" })).toBeVisible();
});

test("responses carry the baseline security headers", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const headers = res.headers();
  const csp = headers["content-security-policy"] ?? "";
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).not.toContain("'unsafe-eval'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-powered-by"]).toBeUndefined();
});

test("plain-HTTP builds send no HTTPS-only headers", async ({ request }) => {
  // upgrade-insecure-requests over HTTP made WebKit fetch every script over HTTPS and fail.
  const headers = (await request.get("/")).headers();
  expect(headers["content-security-policy"]).not.toContain("upgrade-insecure-requests");
  expect(headers["strict-transport-security"]).toBeUndefined();
});

test("the page loads without console errors (including CSP violations)", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(errors).toEqual([]);
});
