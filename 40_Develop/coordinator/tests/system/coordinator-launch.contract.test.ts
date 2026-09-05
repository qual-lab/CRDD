import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  COORDINATOR_LAUNCH_ENTRIES,
  resolveCoordinatorLaunch,
} from "../../src/core/coordinator-launch.ts";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = path.resolve(packageRoot, "../..");
const launcher = path.join(packageRoot, "bin/launch.ts");
const terminal = {
  nodeVersion: "24.19.0",
  stdinIsTty: true,
  stdoutIsTty: true,
  stdoutWritable: true,
};

test("共通Launcherの実行入口を一つの正本から解決する", () => {
  assert.deepEqual(COORDINATOR_LAUNCH_ENTRIES, {
    task: "./coordinator.ts",
    interactive: "./coordinator.ts",
    automation: "./coordinator.ts",
    "verify-routes": "../scripts/verify-signed-route-matrix.ts",
    "verify-recovery": "../scripts/verify-signed-recovery-matrix.ts",
    "sign-release": "../scripts/sign-release-manifest.ts",
    "promote-release": "../scripts/promote-release-manifest.ts",
  });
  assert.equal(Object.isFrozen(COORDINATOR_LAUNCH_ENTRIES), true);
});

test("用途ごとの入力と端末条件を区別し、内部Recovery引数を公開しない", () => {
  for (const mode of ["interactive", "verify-routes", "sign-release"]) {
    assert.equal(resolveCoordinatorLaunch([mode], terminal).status, "ready");
    assert.equal(
      resolveCoordinatorLaunch([mode], { ...terminal, stdoutIsTty: false })
        .status,
      "blocked",
    );
    assert.equal(
      resolveCoordinatorLaunch([mode], { ...terminal, stdoutWritable: false })
        .status,
      "blocked",
    );
  }
  assert.equal(
    resolveCoordinatorLaunch(["task", "--request-stdin", "--json"], {
      ...terminal,
      stdinIsTty: false,
      stdoutIsTty: false,
    }).status,
    "ready",
  );
  assert.equal(
    resolveCoordinatorLaunch(["task", "--request-stdin"], {
      ...terminal,
      stdinIsTty: false,
      stdoutIsTty: false,
    }).status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["task", "--request-stdin", "--json"], terminal)
      .status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["interactive", "task", "--request-stdin"], {
      ...terminal,
      stdinIsTty: false,
    }).status,
    "ready",
  );
  assert.equal(
    resolveCoordinatorLaunch(["sign-release"], {
      ...terminal,
      stdinIsTty: false,
    }).status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["promote-release"], {
      ...terminal,
      stdinIsTty: false,
      stdoutIsTty: false,
    }).status,
    "ready",
  );
  assert.equal(
    resolveCoordinatorLaunch(
      ["promote-release", "--distribution-root", "C:\\fixed-staging"],
      terminal,
    ).status,
    "blocked",
  );
  for (const mode of ["verify-routes", "verify-recovery"]) {
    assert.equal(
      resolveCoordinatorLaunch([mode, "--internal-child"], terminal).status,
      "blocked",
    );
  }
  assert.equal(
    resolveCoordinatorLaunch(["verify-recovery"], {
      ...terminal,
      stdinIsTty: false,
      stdoutIsTty: false,
    }).status,
    "ready",
  );
  assert.equal(
    resolveCoordinatorLaunch(["automation", "doctor", "--json"], {
      ...terminal,
      stdoutIsTty: false,
    }).status,
    "ready",
  );
  assert.equal(
    resolveCoordinatorLaunch(["automation", "doctor", "--json"], terminal)
      .status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["automation", "doctor"], terminal).status,
    "blocked",
  );
});

test("不正用途、未対応Node、NULを拒否し引数の空白・Unicodeを変えない", () => {
  for (const mode of [
    "",
    "../scripts/sign-release-manifest.ts",
    "__proto__",
    "constructor",
  ]) {
    assert.equal(resolveCoordinatorLaunch([mode], terminal).status, "blocked");
  }
  assert.equal(
    resolveCoordinatorLaunch(["interactive"], {
      ...terminal,
      nodeVersion: "24.11.0",
    }).status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["interactive", "a\0b"], terminal).status,
    "blocked",
  );
  const args = ["task", "", "日本語 空白", '"quoted"', "$HOME;echo", "--json"];
  const plan = resolveCoordinatorLaunch(["interactive", ...args], terminal);
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") assert.fail();
  assert.deepEqual(plan.forwardedArgs, args);
  assert.ok(Object.isFrozen(plan.forwardedArgs));
});

test("推奨Task入口は一般Taskの固定引数だけを追加する", () => {
  const plan = resolveCoordinatorLaunch(["task", "--request-stdin", "--json"], {
    ...terminal,
    stdinIsTty: false,
    stdoutIsTty: false,
  });
  assert.equal(plan.status, "ready");
  if (plan.status !== "ready") assert.fail();
  assert.deepEqual(plan.forwardedArgs, ["task", "--request-stdin", "--json"]);
});

test("実CLIのhelpは起動Directoryに依存せず、自動処理から到達する", () => {
  for (const cwd of [repositoryRoot, packageRoot]) {
    const result = spawnSync(
      process.execPath,
      [launcher, "automation", "--help", "--json"],
      { cwd, encoding: "utf8", timeout: 30_000, windowsHide: true },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Coordinator Runtime/);
  }
});

test("実Processのredirectでは対話入口を対象import前に拒否し、秘密候補を出さない", () => {
  for (const mode of ["interactive", "verify-routes", "sign-release"]) {
    const result = spawnSync(process.execPath, [launcher, mode], {
      cwd: repositoryRoot,
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true,
    });
    assert.equal(result.status, 64);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /coordinator_launch_terminal_output_required/);
    assert.doesNotMatch(result.stderr, /passphrase|AssertionError|at file:/);
  }
  const invalid = spawnSync(
    process.execPath,
    [launcher, "not-an-entry", "DO_NOT_REPORT_ARGUMENT"],
    { encoding: "utf8", timeout: 30_000, windowsHide: true },
  );
  assert.equal(invalid.status, 64);
  assert.doesNotMatch(invalid.stderr, /DO_NOT_REPORT_ARGUMENT/);
});

test("実子で同一PID・引数・stdin byte・cwd・終了コードを保持し、import例外を成功にしない", () => {
  const tempParent = path.join(repositoryRoot, ".crdd", "test-tmp");
  fs.mkdirSync(tempParent, { recursive: true });
  assert.equal(fs.realpathSync.native(tempParent), tempParent);
  const root = fs.mkdtempSync(path.join(tempParent, "launch-contract-"));
  try {
    for (const relative of [
      "bin/launch.ts",
      "src/core/coordinator-launch.ts",
      "src/core/node-runtime-version.ts",
    ]) {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(packageRoot, relative), target);
    }
    const entry = path.join(root, "bin/coordinator.ts");
    fs.writeFileSync(
      entry,
      `import { fileURLToPath } from 'node:url';
const chunks=[]; for await (const chunk of process.stdin) chunks.push(chunk);
console.log(JSON.stringify({pid:process.pid, args:process.argv.slice(2), entryMatched:process.argv[1]===fileURLToPath(import.meta.url), cwd:process.cwd(), input:Buffer.concat(chunks).toString('hex')}));
process.stderr.write('FIXTURE_STDERR'); process.exitCode=37;`,
    );
    const args = [
      "task",
      "",
      "日本語 空白",
      '"quoted"',
      "$HOME;echo",
      "--json",
    ];
    const input = Buffer.from('{"text":"日本語"}\n', "utf8");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "bin/launch.ts"), "automation", ...args],
      {
        cwd: root,
        input,
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
      },
    );
    assert.equal(result.status, 37, result.stderr);
    assert.equal(result.stderr, "FIXTURE_STDERR");
    assert.deepEqual(JSON.parse(result.stdout), {
      pid: result.pid,
      args,
      entryMatched: true,
      cwd: root,
      input: input.toString("hex"),
    });
    fs.writeFileSync(entry, "throw new Error('PRIVATE_FIXTURE_DETAIL');");
    const failure = spawnSync(
      process.execPath,
      [path.join(root, "bin/launch.ts"), "automation", "--json"],
      { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true },
    );
    assert.equal(failure.status, 2);
    assert.equal(failure.stdout, "");
    assert.match(failure.stderr, /実行状態と資源回収は未確認/);
    assert.doesNotMatch(
      failure.stderr,
      /PRIVATE_FIXTURE_DETAIL|cleanupConfirmed|at file:/,
    );
  } finally {
    assert.ok(root.startsWith(`${tempParent}${path.sep}`));
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  }
});
