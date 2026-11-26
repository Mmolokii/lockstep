import { defineConfig } from "vitest/config";
import { integrationGlob, standardCoverage } from "../../vitest.shared.ts";

export default defineConfig({
  test: {
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
