import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // tsconfig keeps jsx "preserve" for Next; tests need it compiled.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    // e2e/ is Playwright (npm run e2e), not vitest
    exclude: ["node_modules/**", "e2e/**", ".next/**", "out-build/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
