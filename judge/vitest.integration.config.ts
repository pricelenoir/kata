import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["judge/test/integration/**/*.test.ts"],
    testTimeout: 120_000,
    // Sequential: parallel sandboxes would compete for CPU and make the
    // time-limit assertions flaky.
    fileParallelism: false,
  },
});
