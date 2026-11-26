import { defineConfig } from "vitest/config";
import { integrationGlob, standardCoverage } from "../vitest.shared.ts";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: [integrationGlob],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // cli.ts is exercised end to end by spawning it (cli.test.ts), which v8 can't attribute.
      exclude: ["src/**/*.test.ts", "src/cli.ts"],
      thresholds: standardCoverage,
    },
  },
});
