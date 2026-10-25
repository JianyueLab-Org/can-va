/**
 * Type-checks the Vue islands.
 *
 * `astro check` diagnoses .astro and .ts only; a type error in a .vue file
 * still reports "0 errors". vue-tsc covers the islands in src/components.
 *
 * Diagnostics from files under node_modules are printed as a notice and do not
 * fail the run. Anything under src/ does.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Resolved rather than shelled out to, so this works the same on Windows and
// posix and does not depend on a .bin shim being on PATH.
const require = createRequire(import.meta.url);
const vueTsc = join(
  dirname(require.resolve("vue-tsc/package.json")),
  "bin",
  "vue-tsc.js",
);

const result = spawnSync(
  process.execPath,
  [vueTsc, "--noEmit", "-p", "tsconfig.vue.json", "--pretty", "false"],
  { encoding: "utf8" },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const lines = output.split(/\r?\n/);

// Diagnostics start at a "path(line,col): error TSxxxx:" line; the indented
// lines beneath belong to whichever diagnostic opened the block.
const ours = [];
const theirs = [];
let target = null;
for (const line of lines) {
  const start = /^(\S.*?)\((\d+),(\d+)\): (error|warning)/.exec(line);
  if (start) target = start[1].includes("node_modules") ? theirs : ours;
  else if (!line.trim()) continue;
  else if (!/^\s/.test(line)) target = null;
  if (target) target.push(line);
}

if (theirs.length) {
  const files = new Set(
    theirs.flatMap((l) => /^(\S.*?)\(\d+,\d+\)/.exec(l)?.[1] ?? []),
  );
  console.log(
    `[typecheck:vue] ignoring ${theirs.length} pre-existing diagnostic(s) from ` +
      `${[...files].join(", ")} — dependency source, not this repo.`,
  );
}

if (ours.length) {
  console.error(ours.join("\n"));
  console.error(`\n[typecheck:vue] ${ours.length} error(s) in src/.`);
  process.exit(1);
}

// A non-zero exit with nothing attributable to src/ means vue-tsc itself
// failed (bad config, crash) — surface it rather than reporting success.
if (result.status !== 0 && !theirs.length) {
  console.error(output.trim() || `vue-tsc exited with ${result.status}`);
  process.exit(result.status ?? 1);
}

console.log("[typecheck:vue] 0 errors in src/.");
