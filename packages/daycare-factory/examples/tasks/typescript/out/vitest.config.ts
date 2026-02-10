import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["sources/**/*.spec.ts"]
  }
});
