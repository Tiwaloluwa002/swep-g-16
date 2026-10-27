import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["./vitest.global-setup.ts"],
    // Starting PGlite (Postgres in WebAssembly) takes a few seconds the first time in each file.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
