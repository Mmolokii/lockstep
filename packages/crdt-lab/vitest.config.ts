import { defineConfig } from "vitest/config";
import { integrationGlob, standardCoverage } from "../../vitest.shared.ts";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [integrationGlob],
    testTimeout: 120_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/bench.ts"],
      thresholds: standardCoverage,
    },
  },
});
