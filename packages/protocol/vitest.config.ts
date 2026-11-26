import { defineConfig } from "vitest/config";
import { criticalCoverage, integrationGlob } from "../../vitest.shared.ts";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [integrationGlob],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: criticalCoverage,
    },
  },
});
