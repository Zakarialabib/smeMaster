import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

const alias = {
  "@": path.resolve(__dirname, "./src"),
  "@core": path.resolve(__dirname, "./src/core"),
  "@features": path.resolve(__dirname, "./src/features"),
  "@shared": path.resolve(__dirname, "./src/shared"),
  "@test": path.resolve(__dirname, "./src/test"),
};

export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  // Integration suites import `node:sqlite` (a Node builtin). Vite's SSR
  // transform would otherwise try to bundle the builtin and fail with
  // "Cannot bundle built-in module". Externalize all `node:` builtins so the
  // Node runtime resolves them natively.
  ssr: {
    external: [/^node:/],
  },
  test: {
    // Two independent projects:
    //  1. unit — jsdom (browser) env for component/unit tests.
    //  2. integration — node env for the SQL-backed integration suites that use
    //     `node:sqlite`. Each project has its own setup file and include globs.
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "jsdom",
          environmentOptions: { jsdom: { url: "http://localhost" } },
          include: ["src/**/*.{test,spec}.{ts,tsx}"],
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            "**/target/**",
            "**/e2e/**",
            "**/__tests__/integration/**",
          ],
          setupFiles: [
            "./src/test/mocks/tauri.mock.ts",
            "./src/test/setup.ts",
          ],
          globals: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["src/**/__tests__/integration/**/*.test.ts"],
          exclude: ["**/node_modules/**", "**/dist/**", "**/target/**"],
          setupFiles: ["./src/test/setup.node.ts"],
          globals: true,
        },
      },
    ],
  },
});
