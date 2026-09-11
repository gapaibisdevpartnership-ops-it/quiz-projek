import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup/load-env.ts"],
          testTimeout: 20_000,
          hookTimeout: 20_000,
          // Sessions/RLS state is shared; keep it serial and predictable.
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "chaos",
          environment: "node",
          include: ["tests/chaos/**/*.test.ts"],
          setupFiles: ["tests/setup/load-env.ts"],
          // Concurrency scenarios need headroom; not part of the default gate.
          testTimeout: 30_000,
          hookTimeout: 30_000,
          fileParallelism: false,
        },
      },
    ],
  },
});
