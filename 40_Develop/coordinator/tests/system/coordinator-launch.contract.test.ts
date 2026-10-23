/**
 * coordinator:system:coordinator-launchの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:coordinator-launchが所有する検証責務を実行する。
 * @trace PRL-ST-001
 * @level ST
 * @scope coordinator、launch
 * @boundary PRL-ST-001=System/E2E: 公開入口→Coordinator→Execution→受入
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  COORDINATOR_LAUNCH_ENTRIES,
  resolveCoordinatorLaunch,
} from "../../src/cli/command.ts";

const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const repositoryRoot = path.resolve(packageRoot, "../..");
const launcher = path.join(packageRoot, "bin/coordinator.ts");
const terminal = {
  nodeVersion: "24.19.0",
  stdinIsTty: true,
  stdoutIsTty: true,
  stdoutWritable: true,
};

/**
 * 共通Launcherの実行入口を一つの正本から解決するを検証する。
 *
 * @responsibility 共通Launcherの実行入口を一つの正本から解決するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共通Launcherの実行入口を一つの正本から解決するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("共通Launcherの実行入口を一つの正本から解決する", () => {
  assert.deepEqual(COORDINATOR_LAUNCH_ENTRIES, {
    task: "../src/cli/command.ts",
    interactive: "../src/cli/command.ts",
    automation: "../src/cli/command.ts",
    "verify-routes": "../scripts/verify-route-matrix.ts",
    "verify-recovery": "../scripts/verify-recovery-matrix.ts",
    "authenticate-claude": "../scripts/authenticate-claude-subscription.ts",
  });
  assert.equal(Object.isFrozen(COORDINATOR_LAUNCH_ENTRIES), true);
});

/**
 * 廃止したCoordinator専用署名入口を端末条件にかかわらず拒否する。
 * @responsibility 旧modeから秘密入力・署名・昇格処理へ到達させない。
 * @trace PRL-ST-001
 * @precondition 現行のmode解決と実bin入口を使用する。
 * @stimulus 旧二modeへ引数なし・引数あり・NULを与える。
 * @observation 解決結果、実Process終了値、出力と固定Sourceを確認する。
 * @oracle mode_invalid・64で停止し、旧Tool importもhelp案内も存在しない。
 * @cleanup N/A: 旧modeの拒否とhelpだけを実行する。
 * @boundary PRL-ST-001=Direct Boundary: 公開Launcherの廃止入口。
 */
test("旧署名とManifest昇格modeは対象Tool読込み前に拒否する", () => {
  for (const mode of ["sign-release", "promote-release"]) {
    for (const args of [
      [],
      ["--private-key", "DO_NOT_REPORT_KEY_PATH"],
      ["a\0b"],
    ]) {
      for (const isTty of [true, false]) {
        assert.deepEqual(
          resolveCoordinatorLaunch([mode, ...args], {
            ...terminal,
            stdinIsTty: isTty,
            stdoutIsTty: isTty,
          }),
          { status: "blocked", reason: "coordinator_launch_mode_invalid" },
        );
      }
      if (args.some((value) => value.includes("\0"))) continue;
      const result = spawnSync(process.execPath, [launcher, mode, ...args], {
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
      });
      assert.equal(result.status, 64, result.stderr);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /coordinator_launch_mode_invalid/u);
      assert.doesNotMatch(
        result.stderr,
        /DO_NOT_REPORT_KEY_PATH|passphrase|entry_failed/u,
      );
    }
  }
  const source = fs.readFileSync(launcher, "utf8");
  assert.doesNotMatch(
    source,
    /sign-release-manifest|promote-release-manifest|case "sign-release"|case "promote-release"/u,
  );
  const help = spawnSync(process.execPath, [launcher, "--help"], {
    encoding: "utf8",
    timeout: 30_000,
    windowsHide: true,
  });
  assert.equal(help.status, 0);
  assert.doesNotMatch(help.stdout, /sign-release|promote-release|署名済み/u);
  assert.match(help.stdout, /固定Taskの4経路E2E/u);
  assert.match(help.stdout, /固定Workerの復旧検証/u);
});

/**
 * 引数なしと従来のhelp入力を入口統合後も維持する。
 * @responsibility 既存help経路の終了値と公開案内を確認する。
 * @trace PRL-ST-001
 * @precondition 現在のCoordinator入口を使用する。
 * @stimulus 引数なし、help、-hで起動する。
 * @observation 終了値、stdout、stderrを確認する。
 * @oracle 終了値0、通常Task案内あり、stderr空である。
 * @cleanup N/A: 永続・一時資源を作成しない。
 * @boundary 実Processの公開入口。
 */
test("入口統合後も引数なしと従来helpは成功する", () => {
  for (const args of [[], ["help"], ["-h"]]) {
    const result = spawnSync(process.execPath, [launcher, ...args], {
      encoding: "utf8",
      timeout: 30_000,
      windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.match(
      result.stdout,
      /crdd-coordinator\.ts task --request-stdin --json/u,
    );
  }
});

/**
 * 用途ごとの入力と端末条件を区別し、内部Recovery引数を公開しないを検証する。
 *
 * @responsibility 用途ごとの入力と端末条件を区別し、内部Recovery引数を公開しないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 用途ごとの入力と端末条件を区別し、内部Recovery引数を公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("用途ごとの入力と端末条件を区別し、内部Recovery引数を公開しない", () => {
  for (const mode of ["interactive", "verify-routes", "authenticate-claude"]) {
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
    resolveCoordinatorLaunch(["authenticate-claude"], {
      ...terminal,
      stdinIsTty: false,
    }).status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(
      ["authenticate-claude", "--provider", "codex"],
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

/**
 * 不正用途、未対応Node、NULを拒否し引数の空白・Unicodeを変えないを検証する。
 *
 * @responsibility 不正用途、未対応Node、NULを拒否し引数の空白・Unicodeを変えないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不正用途、未対応Node、NULを拒否し引数の空白・Unicodeを変えないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 推奨Task入口は一般Taskの固定引数だけを追加するを検証する。
 *
 * @responsibility 推奨Task入口は一般Taskの固定引数だけを追加するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 推奨Task入口は一般Taskの固定引数だけを追加するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 実CLIのhelpは起動Directoryに依存せず、自動処理から到達するを検証する。
 *
 * @responsibility 実CLIのhelpは起動Directoryに依存せず、自動処理から到達するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実CLIのhelpは起動Directoryに依存せず、自動処理から到達するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 実Processのredirectでは対話入口を対象import前に拒否し、秘密候補を出さないを検証する。
 *
 * @responsibility 実Processのredirectでは対話入口を対象import前に拒否し、秘密候補を出さないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実Processのredirectでは対話入口を対象import前に拒否し、秘密候補を出さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("実Processのredirectでは対話入口を対象import前に拒否し、秘密候補を出さない", () => {
  for (const mode of ["interactive", "verify-routes"]) {
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

/**
 * 実子で同一PID・引数・stdin byte・cwd・終了コードを保持し、import例外を成功にしないを検証する。
 *
 * @responsibility 実子で同一PID・引数・stdin byte・cwd・終了コードを保持し、import例外を成功にしないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実子で同一PID・引数・stdin byte・cwd・終了コードを保持し、import例外を成功にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("実子で同一PID・引数・stdin byte・cwd・終了コードを保持し、import例外を成功にしない", () => {
  const tempParent = path.join(repositoryRoot, ".crdd", "tests");
  fs.mkdirSync(tempParent, { recursive: true });
  assert.equal(fs.realpathSync.native(tempParent), tempParent);
  const root = fs.mkdtempSync(path.join(tempParent, "coordinator-launch-"));
  try {
    for (const relative of [
      "bin/coordinator.ts",
      "src/cli/command.ts",
      "src/execution/diagnostics.ts",
    ]) {
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(packageRoot, relative), target);
    }
    // 実受付を使い、固定配送先だけを合成Scriptへ置き換える。
    const commandFile = path.join(root, "src/cli/command.ts");
    const commandSource = fs
      .readFileSync(commandFile, "utf8")
      .replace(
        /from "(\.[^"]+)"/g,
        (_match, relative: string) =>
          `from "${pathToFileURL(path.resolve(packageRoot, "src/cli", relative)).href}"`,
      );
    fs.writeFileSync(commandFile, commandSource);
    const entry = path.join(root, "scripts/verify-recovery-matrix.ts");
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(
      entry,
      `import { fileURLToPath } from 'node:url';
const chunks=[]; for await (const chunk of process.stdin) chunks.push(chunk);
console.log(JSON.stringify({pid:process.pid, args:process.argv.slice(2), entryMatched:process.argv[1]===fileURLToPath(import.meta.url), cwd:process.cwd(), input:Buffer.concat(chunks).toString('hex')}));
process.stderr.write('FIXTURE_STDERR'); process.exitCode=37;`,
    );
    const args: string[] = [];
    const input = Buffer.from('{"text":"日本語"}\n', "utf8");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "bin/coordinator.ts"), "verify-recovery", ...args],
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
      [path.join(root, "bin/coordinator.ts"), "verify-recovery"],
      { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true },
    );
    assert.equal(failure.status, 2);
    assert.equal(failure.stdout, "");
    assert.match(failure.stderr, /実行状態と資源回収は未確認/);
    assert.doesNotMatch(
      failure.stderr,
      /PRIVATE_FIXTURE_DETAIL|cleanupConfirmed|at file:/,
    );

    // 起動受付は実本文のまま、通常操作の本体だけを合成観測へ替える。
    // 製品へ注入hookを追加せず、実子でliteral argvの搬送を反証する。
    const handlerStart = commandSource.indexOf(
      "async function runRuntimeCommand(",
    );
    assert.ok(handlerStart > 0);
    fs.writeFileSync(
      commandFile,
      `${commandSource.slice(0, handlerStart)}
/**
 * 実子内で通常handlerへの配送値を観測する。
 * @responsibility 製品受付を変えず、受取値とProcess情報だけを結果へ出す。
 * @trace PRL-ST-001
 * @precondition 自己生成したCLIコピーでだけ使用する。
 * @stimulus automationから非自明argvとstdinを渡す。
 * @observation 引数、argv1、PID、cwd、入力bytesと終了値。
 * @oracle 親試験が期待値の完全一致を確認する。
 * @cleanup 親試験のfinallyで自己生成Rootを削除する。
 * @boundary 合成の通常handler。Provider・Docker・回復を実行しない。
 */
async function runRuntimeCommand(arguments_) {
const chunks=[]; for await (const chunk of process.stdin) chunks.push(chunk);
console.log(JSON.stringify({pid:process.pid, args:arguments_, argv:process.argv.slice(2), entryMatched:process.argv[1]===fileURLToPath(import.meta.url), cwd:process.cwd(), input:Buffer.concat(chunks).toString('hex')}));
process.stderr.write('FIXTURE_STDERR'); process.exitCode=37;
}`,
    );
    const forwarded = [
      "capabilities",
      "",
      "日本語 空白",
      '"quoted"',
      "$HOME;echo",
      "--json",
    ];
    const routed = spawnSync(
      process.execPath,
      [path.join(root, "bin/coordinator.ts"), "automation", ...forwarded],
      {
        cwd: root,
        input,
        encoding: "utf8",
        timeout: 30_000,
        windowsHide: true,
      },
    );
    assert.equal(routed.status, 37, routed.stderr);
    assert.equal(routed.stderr, "FIXTURE_STDERR");
    assert.deepEqual(JSON.parse(routed.stdout), {
      pid: routed.pid,
      args: forwarded,
      argv: forwarded,
      entryMatched: true,
      cwd: root,
      input: input.toString("hex"),
    });

    const imported = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `await import(${JSON.stringify(pathToFileURL(commandFile).href)}); process.stdout.write('IMPORT_ONLY');`,
      ],
      { cwd: root, encoding: "utf8", timeout: 30_000, windowsHide: true },
    );
    assert.equal(imported.status, 0, imported.stderr);
    assert.equal(imported.stdout, "IMPORT_ONLY");
    assert.equal(imported.stderr, "");
  } finally {
    assert.ok(root.startsWith(`${tempParent}${path.sep}`));
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  }
});
