import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["playwright/**", "node_modules/**", "dist/**"],
  },
});
