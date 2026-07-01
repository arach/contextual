import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import { backendsPlugin } from "./vite-plugin-backends";

function hudsonKitStylesCandidates(): string[] {
  return [
    fileURLToPath(new URL("./node_modules/hudsonkit/dist/styles.css", import.meta.url)),
    fileURLToPath(new URL("../hudson/packages/web/hudsonkit/dist/styles.css", import.meta.url)),
  ];
}

function resolveHudsonKitStyles(): string {
  for (const path of hudsonKitStylesCandidates()) {
    if (existsSync(path)) return path;
  }

  const hudsonkit = fileURLToPath(
    new URL("../hudson/packages/web/hudsonkit", import.meta.url),
  );
  if (existsSync(fileURLToPath(new URL("./package.json", hudsonkit)))) {
    console.log("[contextual] Building hudsonkit styles…");
    const result = spawnSync("bun", ["run", "build:css"], {
      cwd: hudsonkit,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(
        "[contextual] hudsonkit build:css failed. Fix the error above, or run:\n" +
          "  cd ../hudson/packages/web/hudsonkit && bun run build:css",
      );
    }
  }

  for (const path of hudsonKitStylesCandidates()) {
    if (existsSync(path)) return path;
  }

  throw new Error(
    "[contextual] Missing hudsonkit styles. Install deps and build CSS:\n" +
      "  bun install\n" +
      "  cd ../hudson/packages/web/hudsonkit && bun run build:css",
  );
}

const hudsonStyles = resolveHudsonKitStyles();

export default defineConfig({
  plugins: [react(), tailwindcss(), backendsPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "hudsonkit/styles": hudsonStyles,
    },
  },
  server: {
    port: 5173,
  },
});
