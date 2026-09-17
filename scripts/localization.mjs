import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

function git(args, options = {}) {
  const result = spawnSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  if (result.error) throw result.error;
  return result;
}

function checked(args, options) {
  const result = git(args, options);
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git ${args[0]} failed`);
  return result.stdout;
}

function requireClean() {
  if (checked(["status", "--porcelain", "--untracked-files=no"]).trim()) {
    throw new Error("Tracked files have changes. Commit or stash them before applying/exporting localization.");
  }
}

function apply(patchPath) {
  const patch = readFileSync(patchPath, "utf8");
  if (!patch.trim()) throw new Error("Localization patch is empty.");
  if (git(["apply", "--reverse", "--check"], { input: patch }).status === 0) {
    console.log("Chinese localization is already applied.");
    return;
  }
  let input = patch;
  if (git(["apply", "--check"], { input }).status !== 0) {
    // Resolve against HEAD in an isolated index so conflicts cannot alter the checkout.
    const temporary = mkdtempSync(join(tmpdir(), "kener-localization-"));
    const env = { ...process.env, GIT_INDEX_FILE: join(temporary, "index") };
    try {
      checked(["read-tree", "HEAD"], { env });
      const result = git(["apply", "--cached", "--3way"], { env, input });
      if (result.status !== 0) {
        throw new Error(
          `Localization conflicts with this upstream revision; no files were changed.\n${result.stderr.trim()}`,
        );
      }
      input =
        git(["diff", "--quiet"], { env }).status === 0
          ? ""
          : checked(["diff", "--cached", "--binary", "--full-index", "--no-ext-diff", "HEAD"], { env });
    } finally {
      rmSync(temporary, { recursive: true, force: true });
    }
  }
  if (!input.trim()) {
    console.log("Chinese localization is already applied.");
    return;
  }
  requireClean();
  checked(["apply", "--check"], { input });
  checked(["apply"], { input });
  console.log("Chinese localization applied. Review and commit the changes.");
}

function exportPatch(upstreamRef) {
  requireClean();
  const upstreamCommit = checked(["rev-parse", "--verify", "--end-of-options", `${upstreamRef}^{commit}`]).trim();
  if (git(["merge-base", "--is-ancestor", upstreamCommit, "HEAD"]).status !== 0) {
    throw new Error("Merge the specified upstream revision before exporting localization.");
  }
  const patch = checked([
    "diff",
    "--binary",
    "--full-index",
    "--no-ext-diff",
    upstreamCommit,
    "HEAD",
    "--",
    "src",
    "vite.config.ts",
  ]);
  if (!patch.trim()) throw new Error("No committed localization changes found.");
  mkdirSync("localization", { recursive: true });
  writeFileSync("localization/zh-CN.patch", patch);
  writeFileSync("localization/zh-CN.json", JSON.stringify({ upstreamRef, upstreamCommit }, null, 2) + "\n");
  console.log(`Exported localization/zh-CN.patch against ${upstreamCommit}.`);
}

try {
  const [command, argument, ...extra] = process.argv.slice(2);
  const patchPath = resolve(argument || "localization/zh-CN.patch");
  process.chdir(checked(["rev-parse", "--show-toplevel"]).trim());
  if (extra.length || !["apply", "export"].includes(command) || (command === "export" && !argument)) {
    throw new Error("Usage: node scripts/localization.mjs apply [patch] | export <upstream-ref>");
  }
  if (command === "apply") apply(patchPath);
  else exportPatch(argument);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
