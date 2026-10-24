/**
 * coordinator:system:coordinator-launchの検証範囲を定義する。
 * @packageDocumentation
 * @responsibility 公開CLIの文法・端末条件・入力搬送・失敗表示を実Processで確認する。
 * @trace PRL-ST-001
 * @level ST
 * @scope coordinator、cli
 * @boundary PRL-ST-001=System: 公開入口と正式API。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveCoordinatorLaunch } from "../../src/cli/command.ts";
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const root = path.resolve(packageRoot, "../..");
const launcher = path.join(packageRoot, "bin/coordinator.ts");
const terminal = {
  nodeVersion: "24.19.0",
  stdinIsTty: true,
  stdoutIsTty: true,
  stdoutWritable: true,
};

/**
 * 新文法は対象と操作を一意に解決し機械出力条件を維持する。
 * @responsibility 公開CLIの受付保証を検証する。
 * @trace PRL-ST-001
 * @precondition 合成入力・有限代役だけを使用する。
 * @stimulus 正常・拒否・失敗の対象入力を渡す。
 * @observation 出力、終了値、配送値と呼出し回数。
 * @oracle 本文の期待値と一致し秘密値を公開しない。
 * @cleanup 子Process終了。Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=System: CLIと正式APIの接続。
 */
test("新文法は対象と操作を一意に解決し機械出力条件を維持する", () => {
  for (const args of [
    ["task", "run", "--request-stdin", "--json"],
    ["project", "run", "--request-stdin", "--json"],
  ]) {
    assert.equal(resolveCoordinatorLaunch(args, terminal).status, "blocked");
    const result = resolveCoordinatorLaunch(args, {
      ...terminal,
      stdoutIsTty: false,
    });
    assert.equal(result.status, "ready");
    if (result.status === "ready") assert.deepEqual(result.forwardedArgs, args);
  }
  assert.equal(
    resolveCoordinatorLaunch(["project", "init", "--json"], terminal).status,
    "ready",
  );
  for (const args of [
    ["task", "--request-stdin", "--json"],
    ["project", "--initialize", "--json"],
    ["automation", "capabilities", "--json"],
    ["interactive", "doctor"],
    ["verify-routes"],
    ["verify-recovery"],
    ["sign-release"],
    ["promote-release"],
  ])
    assert.equal(resolveCoordinatorLaunch(args, terminal).status, "blocked");
});

/**
 * Node版・制御文字・出力不能をEffect前に拒否する。
 * @responsibility 公開CLIの受付保証を検証する。
 * @trace PRL-ST-001
 * @precondition 合成入力・有限代役だけを使用する。
 * @stimulus 正常・拒否・失敗の対象入力を渡す。
 * @observation 出力、終了値、配送値と呼出し回数。
 * @oracle 本文の期待値と一致し秘密値を公開しない。
 * @cleanup 子Process終了。Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=System: CLIと正式APIの接続。
 */
test("Node版・制御文字・出力不能をEffect前に拒否する", () => {
  assert.equal(
    resolveCoordinatorLaunch(["help"], { ...terminal, nodeVersion: "22.0.0" })
      .status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["help", "a\0b"], terminal).status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["help"], { ...terminal, stdoutWritable: false })
      .status,
    "blocked",
  );
  assert.equal(
    resolveCoordinatorLaunch(["auth", "login", "codex"], {
      ...terminal,
      stdinIsTty: false,
    }).status,
    "blocked",
  );
});

/**
 * 公開helpと能力一覧は新文法だけを案内する。
 * @responsibility 公開CLIの受付保証を検証する。
 * @trace PRL-ST-001
 * @precondition 合成入力・有限代役だけを使用する。
 * @stimulus 正常・拒否・失敗の対象入力を渡す。
 * @observation 出力、終了値、配送値と呼出し回数。
 * @oracle 本文の期待値と一致し秘密値を公開しない。
 * @cleanup 子Process終了。Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=System: CLIと正式APIの接続。
 */
test("公開helpと能力一覧は新文法だけを案内する", () => {
  for (const args of [[], ["help"], ["--help"], ["-h"]]) {
    const child = spawnSync(process.execPath, [launcher, ...args], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    });
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /task run --request-stdin --json/);
    assert.doesNotMatch(
      child.stdout,
      /automation|interactive|verify-routes|sign-release/,
    );
  }
  const child = spawnSync(
    process.execPath,
    [launcher, "capabilities", "--json"],
    { encoding: "utf8", windowsHide: true, timeout: 15000 },
  );
  assert.equal(child.status, 0, child.stderr);
  const value = JSON.parse(child.stdout);
  assert.equal(value.contractRevision, 5);
  assert.equal(value.executionAuthorityIssued, false);
  assert.ok(value.operations.includes("runTask"));
  assert.ok(
    value.commands.some(
      (c: { invocation: string }) =>
        c.invocation === "recovery resume <id> [--json]",
    ),
  );
});

/**
 * 認証CLIは不正Provider・余剰引数・非TTYログインを拒否する。
 * @responsibility 公開CLIの受付保証を検証する。
 * @trace PRL-ST-001
 * @precondition 合成入力・有限代役だけを使用する。
 * @stimulus 正常・拒否・失敗の対象入力を渡す。
 * @observation 出力、終了値、配送値と呼出し回数。
 * @oracle 本文の期待値と一致し秘密値を公開しない。
 * @cleanup 子Process終了。Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=System: CLIと正式APIの接続。
 */
test("認証CLIは不正Provider・余剰引数・非TTYログインを拒否する", () => {
  for (const args of [
    ["auth", "status", "other"],
    ["auth", "status", "codex", "--secret=fixture"],
    ["auth", "login", "codex"],
    ["auth", "login", "claude", "--json"],
    ["authenticate-claude"],
  ]) {
    const child = spawnSync(process.execPath, [launcher, ...args], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
    });
    assert.equal(child.status, 64, child.stderr);
    assert.doesNotMatch(child.stdout + child.stderr, /fixture|at file:/);
  }
});

/**
 * 認証statusは正式APIを一回待機し単一JSONだけを返す。
 * @responsibility 公開CLIの受付保証を検証する。
 * @trace PRL-ST-001
 * @precondition 合成入力・有限代役だけを使用する。
 * @stimulus 正常・拒否・失敗の対象入力を渡す。
 * @observation 出力、終了値、配送値と呼出し回数。
 * @oracle 本文の期待値と一致し秘密値を公開しない。
 * @cleanup 子Process終了。Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=System: CLIと正式APIの接続。
 */
test("認証statusは正式APIを一回待機し単一JSONだけを返す", () => {
  const api = pathToFileURL(path.join(packageRoot, "src/api.ts")).href;
  const command = pathToFileURL(
    path.join(packageRoot, "src/cli/command.ts"),
  ).href;
  const script = `import {mock} from "node:test";import assert from "node:assert/strict";
 const api=await import(${JSON.stringify(api)});
 mock.module(${JSON.stringify(api)},{namedExports:{...api,getAuthenticationStatus:async(r,s)=>{assert.deepEqual(r,{provider:"codex"});assert.ok(s instanceof AbortSignal);return {status:"completed",authenticationStatus:"confirmed",cleanupConfirmed:true};},authenticateProvider:()=>{throw Error("unexpected_login");}}});
 const {runCoordinatorCommand}=await import(${JSON.stringify(command)});await runCoordinatorCommand(["auth","status","codex","--json"]);`;
  const child = spawnSync(
    process.execPath,
    ["--experimental-test-module-mocks", "--input-type=module", "-e", script],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 15000 },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), {
    status: "completed",
    authenticationStatus: "confirmed",
    cleanupConfirmed: true,
  });
  assert.equal(child.stdout.trim().split("\n").length, 1);
});

/**
 * 同一Processの配送はPID・引数・stdin・cwdを維持し例外を秘匿する。
 * @responsibility 公開CLIの受付保証を検証する。
 * @trace PRL-ST-001
 * @precondition 合成入力・有限代役だけを使用する。
 * @stimulus 正常・拒否・失敗の対象入力を渡す。
 * @observation 出力、終了値、配送値と呼出し回数。
 * @oracle 本文の期待値と一致し秘密値を公開しない。
 * @cleanup 子Process終了。Docker・認証・外部AIなし。
 * @boundary PRL-ST-001=System: CLIと正式APIの接続。
 */
test("同一Processの配送はPID・引数・stdin・cwdを維持し例外を秘匿する", () => {
  const request = pathToFileURL(
    path.join(packageRoot, "src/cli/request.ts"),
  ).href;
  const command = pathToFileURL(
    path.join(packageRoot, "src/cli/command.ts"),
  ).href;
  for (const fail of [false, true]) {
    const script = `import {mock} from"node:test";
 mock.module(${JSON.stringify(request)},{namedExports:{runProjectCommand:async()=>{},runSingleTaskCommand:async(args)=>{if(${fail})throw Error("PRIVATE_FIXTURE_DETAIL");const chunks=[];for await(const c of process.stdin)chunks.push(c);console.log(JSON.stringify({pid:process.pid,args,cwd:process.cwd(),input:Buffer.concat(chunks).toString("hex")}));process.exitCode=37;}}});
 const {runCoordinatorCommand}=await import(${JSON.stringify(command)});await runCoordinatorCommand(["task","run","--request-stdin","--json"]);`;
    const input = Buffer.from('{"text":"日本語"}\n');
    const child = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        "--disable-warning=ExperimentalWarning",
        "--input-type=module",
        "-e",
        script,
      ],
      { cwd: root, input, encoding: "utf8", windowsHide: true, timeout: 15000 },
    );
    assert.equal(child.status, fail ? 2 : 37, child.stderr);
    if (fail) {
      assert.equal(child.stdout, "");
      assert.match(child.stderr, /coordinator_launch_entry_failed/);
      assert.doesNotMatch(child.stderr, /PRIVATE_FIXTURE_DETAIL|at file:/);
    } else
      assert.deepEqual(JSON.parse(child.stdout), {
        pid: child.pid,
        args: ["run", "--request-stdin", "--json"],
        cwd: root,
        input: input.toString("hex"),
      });
  }
});
