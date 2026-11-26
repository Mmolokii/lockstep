import { defineConfig } from "vitest/config";
import { integrationGlob, standardCoverage } from "../../vitest.shared.ts";

export default defineConfig({
  test: {
    // CodeMirror needs a DOM; happy-dom provides one without a browser.
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    exclude: [integrationGlob],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
      thresholds: standardCoverage,
    },
  },
});
