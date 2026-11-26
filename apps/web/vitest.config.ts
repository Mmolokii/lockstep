import { defineConfig } from "vitest/config";
import { integrationGlob, standardCoverage } from "../../vitest.shared.ts";

export default defineConfig({
  test: {
    // IndexedDB comes from fake-indexeddb, imported by the tests that need it.
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    exclude: [integrationGlob],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: standardCoverage,
    },
  },
});
