import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/SWITCH-IT-UP/",

  test: {
    setupFiles: ["./tests/setup.ts"],
  },
});
