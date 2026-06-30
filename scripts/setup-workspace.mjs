// Prepares a fresh checkout to run standalone. Contextual depends on two sibling
// workspace repos (hudson → hudsonkit chrome, studio → doc/shell primitives). When
// you clone only `contextual`, those are missing and `bun install` can't resolve the
// workspace deps. This script clones the siblings next to this repo (idempotent — it
// skips anything already present) and builds hudsonkit so its dist/ is importable.
//
// Run BEFORE `bun install`:   bun run setup && bun install && CONTEXTUAL_DEMO=1 bun dev

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parent = resolve(root, "..");

const SIBLINGS = [
  { name: "hudson", dir: resolve(parent, "hudson"), url: "https://github.com/arach/hudson.git" },
  { name: "studio", dir: resolve(parent, "studio"), url: "https://github.com/arach/studio.git" },
];

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  return (result.status ?? 1) === 0;
}

let ok = true;

for (const sibling of SIBLINGS) {
  if (existsSync(resolve(sibling.dir, "package.json"))) {
    console.log(`✓ ${sibling.name} already present (${sibling.dir})`);
    continue;
  }
  console.log(`→ cloning ${sibling.name} into ${sibling.dir} …`);
  if (!run("git", ["clone", "--depth", "1", sibling.url, sibling.dir])) {
    console.error(
      `✗ could not clone ${sibling.name} from ${sibling.url}\n` +
        `  Make sure you have access, then re-run \`bun run setup\`.`,
    );
    ok = false;
  }
}

// Build hudsonkit so its dist/ (the imported chrome) exists.
const hudsonkit = resolve(parent, "hudson/packages/web/hudsonkit");
if (ok && existsSync(resolve(hudsonkit, "package.json")) && !existsSync(resolve(hudsonkit, "dist/index.js"))) {
  console.log("→ building hudsonkit …");
  run("bun", ["install"], { cwd: hudsonkit });
  if (!run("bun", ["run", "build"], { cwd: hudsonkit })) {
    console.error("✗ hudsonkit build failed — try `cd ../hudson/packages/web/hudsonkit && bun install && bun run build`");
    ok = false;
  }
}

console.log(
  ok
    ? "\n✓ Workspace ready.  Next:  bun install  &&  CONTEXTUAL_DEMO=1 bun dev"
    : "\n✗ Setup incomplete — resolve the errors above and re-run `bun run setup`.",
);
process.exit(ok ? 0 : 1);
