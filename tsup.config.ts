import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/cli/bin.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist/cli",
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  // Don't bundle these - they're installed as dependencies
  external: [
    // Heavy dependencies that should be installed separately
    "@durable-streams/client",
    "@durable-streams/server",
    "@durable-streams/state",
    "@trpc/server",
    "@trpc/client",
    // Node builtins
    "fs",
    "path",
    "http",
    "net",
    "crypto",
    "readline",
    "url",
    "child_process",
    "fs/promises",
    "node:async_hooks",
    // These are only used by the web app, not CLI
    "react",
    "react-dom",
    "@tanstack/react-router",
    "@tanstack/react-start",
    "@tanstack/react-query",
    "@trpc/react-query",
  ],
  // Banner with shebang for executable
  banner: {
    js: "#!/usr/bin/env node",
  },
  // Ensure we can import from dist/server/server.js
  noExternal: [
    // Bundle these small CLI utilities
    "chalk",
    "ora",
    "cli-table3",
    "open",
    "ts-pattern",
  ],
})
