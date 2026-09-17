import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("./localization.mjs", import.meta.url));

test("localization round trip preserves upstream additions and refuses conflicts without changes", () => {
  const cwd = mkdtempSync(join(tmpdir(), "kener-localization-test-"));
  const run = (command, args, options = {}) => spawnSync(command, args, { cwd, encoding: "utf8", ...options });
  const git = (...args) => {
    const result = run("git", args);
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const cli = (...args) => run(process.execPath, [script, ...args]);
  const commit = (message) => {
    git("add", "src", "package.json", "vite.config.ts");
    git("commit", "-qm", message);
    return git("rev-parse", "HEAD");
  };
  const file = join(cwd, "src", "page.txt");
  const base = "one\ntwo\nthree\nfour\nStatus\nsix\nseven\neight\nnine\nten\n";
  try {
    git("init", "-q");
    git("config", "user.name", "Localization test");
    git("config", "user.email", "localization@example.invalid");
    git("config", "core.autocrlf", "false");
    mkdirSync(join(cwd, "src"));
    writeFileSync(file, base);
    writeFileSync(join(cwd, "package.json"), "{}\n");
    writeFileSync(join(cwd, "vite.config.ts"), "export default { optimizeDeps: { include: [] } };\n");
    const upstream = commit("upstream");
    writeFileSync(file, base.replace("Status", "状态"));
    writeFileSync(join(cwd, "package.json"), '{"name":"excluded"}\n');
    writeFileSync(join(cwd, "vite.config.ts"), 'export default { optimizeDeps: { include: ["editor"] } };\n');
    commit("Chinese localization");
    const exported = cli("export", upstream);
    assert.equal(exported.status, 0, exported.stderr);
    const patch = join(cwd, "localization", "zh-CN.patch");
    assert.doesNotMatch(readFileSync(patch, "utf8"), /package\.json/);
    assert.match(readFileSync(patch, "utf8"), /vite\.config\.ts/);
    assert.equal(JSON.parse(readFileSync(join(cwd, "localization", "zh-CN.json"), "utf8")).upstreamCommit, upstream);

    git("reset", "--hard", upstream);
    assert.equal(cli("apply").status, 0);
    assert.match(readFileSync(file, "utf8"), /状态/);
    assert.match(readFileSync(join(cwd, "vite.config.ts"), "utf8"), /"editor"/);
    assert.match(cli("apply").stdout, /already applied/);
    git("reset", "--hard", upstream);

    const updated = base.replace("eight", "upstream addition\neight");
    writeFileSync(file, updated);
    commit("upstream addition");
    assert.notEqual(run("git", ["apply", "--check", patch]).status, 0, "exercise three-way fallback");
    const applied = cli("apply");
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(readFileSync(file, "utf8"), updated.replace("Status", "状态"));
    assert.match(cli("apply").stdout, /already applied/);
    commit("localized updated upstream");
    assert.match(cli("apply").stdout, /already applied/);

    git("reset", "--hard", upstream);
    writeFileSync(file, base.replace("Status", "Upstream conflict"));
    commit("conflicting upstream change");
    const before = readFileSync(file, "utf8");
    const beforeIndex = readFileSync(join(cwd, ".git", "index"));
    const conflict = cli("apply");
    assert.notEqual(conflict.status, 0);
    assert.match(conflict.stderr, /conflicts.*no files were changed/);
    assert.equal(readFileSync(file, "utf8"), before);
    assert.deepEqual(readFileSync(join(cwd, ".git", "index")), beforeIndex);
    assert.equal(git("status", "--porcelain", "--untracked-files=no"), "");

    git("reset", "--hard", upstream);
    writeFileSync(join(cwd, "package.json"), '{"unsaved":true}\n');
    assert.match(cli("apply").stderr, /Tracked files have changes/);
    assert.equal(readFileSync(file, "utf8"), base);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
