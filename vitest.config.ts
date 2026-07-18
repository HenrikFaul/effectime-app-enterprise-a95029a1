import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/**/*.test.*", "src/**/*.d.ts"],
      reporter: ["text-summary", "json-summary", "html"],
      reportsDirectory: "coverage",
      thresholds: {
        statements: 28,
        branches: 47,
        functions: 13,
        lines: 28,
      },
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
