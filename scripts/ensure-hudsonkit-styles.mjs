import { existsSync, lstatSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hudsonkitPkg = resolve(root, "../hudson/packages/web/hudsonkit");
const linkPath = resolve(root, "node_modules/hudsonkit");
const styles = resolve(linkPath, "dist/styles.css");

function ensureHudsonkitLink() {
  if (existsSync(linkPath)) {
    try {
      if (lstatSync(linkPath).isSymbolicLink()) return;
    } catch {
      // fall through to recreate
    }
    spawnSync("rm", ["-rf", linkPath], { stdio: "inherit" });
  }
  if (!existsSync(resolve(hudsonkitPkg, "package.json"))) {
    console.error("[contextual] Expected hudsonkit at", hudsonkitPkg);
    process.exit(1);
  }
  spawnSync("ln", ["-s", "../../hudson/packages/web/hudsonkit", linkPath], {
    cwd: root,
    stdio: "inherit",
  });
}

ensureHudsonkitLink();

if (existsSync(styles)) process.exit(0);

const hudsonkit = hudsonkitPkg;
if (!existsSync(resolve(hudsonkit, "package.json"))) {
  console.error(
    "[contextual] Missing hudsonkit styles. Install hudsonkit or run:\n" +
      "  cd ../hudson/packages/web/hudsonkit && bun run build:css",
  );
  process.exit(1);
}

console.log("[contextual] Building hudsonkit styles…");
const result = spawnSync("bun", ["run", "build:css"], {
  cwd: hudsonkit,
  stdio: "inherit",
});
process.exit(result.status ?? 1);
