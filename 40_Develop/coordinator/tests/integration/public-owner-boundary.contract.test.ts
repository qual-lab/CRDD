/**
 * 統合Coordinatorの業務操作・単発実行と利用側の公開境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 統合Rootの公開集合、旧入口不存在と直接利用側の接続を確認する。
 * @trace PRL-IT-012
 * @level IT
 * @scope 統合Coordinator Root、Workbench、MCP・CLI配布入口
 * @boundary PRL-IT-012=Related 2 Blocks: 利用側→業務公開入口→Coordinator。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { readExecutionCancellation } from "../../src/execution/authority.ts";
import * as coordinator from "../../src/index.ts";
import {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "../../../domain-model/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * bin・Package export・配布入口を同じ六受付経路へ接続する。
 * @responsibility 入口ごとのProject／Task分配差と入力前の端末拒否を検出する。
 * @trace PRL-IT-012
 * @precondition 合成の不正引数とredirectされた標準入出力だけを使う。
 * @stimulus 三公開入口へ直接・自動・対話のProject／Taskを渡す。
 * @observation exit、stdoutの固定JSON、stderrの端末拒否。
 * @oracle 直接／自動は同じ引数拒否、対話は処理Module実行前に端末拒否する。
 * @cleanup 子Process終了を待つ。保存・認証・外部AI・Dockerなし。
 * @boundary 実NodeのPackage解決と公開CLI受付。
 */
test("三公開CLI入口はProjectとTaskの六経路を同じ条件で受け付ける", () => {
  const packageRoot = path.join(repositoryRoot, "40_Develop/coordinator");
  const bin = path.join(packageRoot, "bin/coordinator.ts");
  const template = path.join(
    repositoryRoot,
    "template/tools/crdd-coordinator.ts",
  );
  for (const entry of ["bin", "template", "package"] as const) {
    for (const command of ["project", "task"]) {
      for (const mode of ["direct", "automation", "interactive"]) {
        const args = [
          ...(mode === "direct" ? [] : [mode]),
          command,
          "--invalid",
          "--json",
        ];
        const invocation =
          entry === "package"
            ? [
                "--input-type=module",
                "-e",
                `process.argv=[process.execPath,${JSON.stringify(bin)},...${JSON.stringify(args)}];await import("@qual-lab/crdd-coordinator/cli");`,
              ]
            : [entry === "bin" ? bin : template, ...args];
        const result = spawnSync(process.execPath, invocation, {
          cwd: packageRoot,
          input: "",
          encoding: "utf8",
          timeout: 15000,
          windowsHide: true,
        });
        assert.equal(result.error, undefined);
        assert.equal(
          result.status,
          64,
          `${entry}/${command}/${mode}: ${result.stderr}`,
        );
        assert.equal(result.stdout, "");
        assert.match(
          result.stderr,
          /coordinator_launch_(arguments|mode)_invalid/u,
        );
      }
    }
  }
});

/**
 * 認証・ProjectのCLI解除不明でも一次結果を保持する。
 * @responsibility throwと非releasedを同じ副次失敗へ閉じ、元回復参照を消さない。
 * @trace PRL-IT-012
 * @precondition 実CLIと既存API・取消bindingの有限代役。
 * @stimulus 回復必要結果の後、解除をthrow又は非releasedにする。
 * @observation stdoutの一件JSON、元field、終了値と下位一回呼出し。
 * @oracle 一次reason・exact ID・下位cleanupを保持しexit2、自動再送0。
 * @cleanup 子Process終了。実AI・認証・Docker・保存なし。
 * @boundary PRL-IT-012=Related 2 Blocks: CLI→正式API→CLI解除。
 */
test("認証とProjectは解除throwと非releasedでも一次結果と回復参照を保持する", () => {
  for (const target of ["auth", "project"]) {
    for (const failure of ["throw", "not_released"]) {
      const api = pathToFileURL(
        path.join(repositoryRoot, "40_Develop/coordinator/src/api.ts"),
      ).href;
      const options = pathToFileURL(
        path.join(repositoryRoot, "40_Develop/coordinator/src/cli/options.ts"),
      ).href;
      const cancellation = pathToFileURL(
        path.join(
          repositoryRoot,
          "40_Develop/coordinator/src/cli/cancellation.ts",
        ),
      ).href;
      const entry = pathToFileURL(
        path.join(
          repositoryRoot,
          "40_Develop/coordinator/src/cli",
          target === "auth" ? "authentication.ts" : "request.ts",
        ),
      ).href;
      const script = `import {mock} from"node:test";let calls=0;
   const actual=await import(${JSON.stringify(api)});
   const result={status:"blocked",reason:"primary_fixture_failure",recoveryId:"same-exact-fixture-id",cleanupConfirmed:false,manualRecoveryRequired:true,recoveryIds:["same-exact-fixture-id"],effectState:"unknown"};
   /**
    * 固定の一次結果を返して公開API呼出し数を数える。
    * @responsibility CLI解除故障とは独立した元結果を供給する。
    * @trace PRL-IT-012
    * @precondition 合成の固定結果だけを使用する。
    * @stimulus 実CLIから正式APIを一度呼ぶ。
    * @observation 呼出し数と返却された元結果を得る。
    * @oracle 副次失敗でも元reasonと回復参照を保持する。
    * @cleanup N/A: 子Process内のメモリ値のみ。
    * @boundary PRL-IT-012=Related 2 Blocks: CLIとAPI代役。
    */
   const operation=async()=>{calls++;return result;};
   mock.module(${JSON.stringify(api)},{exports:{...actual,runObjective:operation,getAuthenticationStatus:operation}});
   const options=await import(${JSON.stringify(options)});mock.module(${JSON.stringify(options)},{exports:{...options,readBoundedTaskRequestFromStdin:()=>({})}});
   mock.module(${JSON.stringify(cancellation)},{exports:{bindTaskCliCancellationSignals:()=>({status:"bound",unbind:()=>{if(${JSON.stringify(failure)}==="throw")throw Error("PRIVATE_DETAIL");return {status:"unknown"};}})}});
   const cli=await import(${JSON.stringify(entry)});
   if(${JSON.stringify(target)}==="auth")await cli.runAuthenticationCommand(["status","codex","--json"]);else await cli.runProjectCommand(["run","--request-stdin","--json"]);
   if(calls!==1)throw Error("incorrect_call_count");`;
      const child = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          "--disable-warning=ExperimentalWarning",
          "--input-type=module",
          "-e",
          script,
        ],
        {
          cwd: repositoryRoot,
          encoding: "utf8",
          windowsHide: true,
          timeout: 15000,
        },
      );
      assert.equal(child.status, 2, child.stderr);
      const result = JSON.parse(child.stdout);
      assert.equal(result.reason, "primary_fixture_failure");
      assert.equal(result.recoveryId, "same-exact-fixture-id");
      assert.deepEqual(result.recoveryIds, ["same-exact-fixture-id"]);
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.manualRecoveryRequired, true);
      assert.equal(result.effectState, "unknown");
      assert.equal(result.cliCleanupConfirmed, false);
      assert.ok(result.cliReason);
      if (target === "auth")
        assert.equal(child.stdout.trim().split("\n").length, 1);
      assert.doesNotMatch(child.stdout + child.stderr, /PRIVATE_DETAIL/);
    }
  }
});

/**
 * 受付Moduleのimportと不正Project入力の実出力を確認する。
 * @responsibility import-onlyの無起動と旧JSON bytes・終了値を保持する。
 * @trace PRL-IT-012
 * @precondition 実受付Moduleと合成標準入力だけを使う。
 * @stimulus importのみ、不正引数、不正JSONを別Processへ渡す。
 * @observation 標準出力・標準エラーと終了値。
 * @oracle importのみは出力なしexit0、拒否は従来の整形JSONとexit64。
 * @cleanup 子Process終了を待つ。保存物・AI・認証は使用しない。
 * @boundary 実Node入口とstdin。Docker操作なし。
 */
test("受付Moduleのimportは起動せずProject拒否JSONのbytesを維持する", () => {
  const requestUrl = pathToFileURL(
    path.join(repositoryRoot, "40_Develop/coordinator/src/cli/request.ts"),
  ).href;
  for (const example of [
    { call: "", input: "", reason: null },
    {
      call: "await runProjectCommand([]);",
      input: "",
      reason: "project_arguments_invalid",
    },
    {
      call: 'await runProjectCommand(["run", "--request-stdin", "--json"]);',
      input: "{",
      reason: "task_request_invalid_json",
    },
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const {runProjectCommand}=await import(${JSON.stringify(requestUrl)});${example.call}`,
      ],
      {
        cwd: repositoryRoot,
        input: example.input,
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.stderr, "");
    assert.equal(result.status, example.reason === null ? 0 : 64);
    assert.equal(
      result.stdout,
      example.reason === null
        ? ""
        : `${JSON.stringify({ command: "project", status: "blocked", reason: example.reason }, null, 2)}\n`,
    );
  }
});

/**
 * Task引数の拒否を廃止したParserでなく本番受付から確認する。
 * @responsibility 不正引数ではstdin読取り・Task開始前に終了することを確認する。
 * @trace PRL-IT-012
 * @precondition 実CLI関数と空の標準入力。
 * @stimulus 省略、重複、旧形式と順序違いを渡す。
 * @observation 終了値と一件の固定JSON。
 * @oracle exit64、task_arguments_invalid。stdinが空でも入力解析へ進まない。
 * @cleanup 子Processの終了を待つ。Filesystem生成なし。
 * @boundary 実CLI受付。Docker・認証・外部AIは使わない。
 */
test("Taskの不正引数は本番入口で標準入力を読む前に拒否する", () => {
  const commandUrl = pathToFileURL(
    path.join(repositoryRoot, "40_Develop/coordinator/src/cli/request.ts"),
  ).href;
  for (const args of [
    [],
    ["--json"],
    ["--request-stdin"],
    ["--request-stdin", "--request-stdin"],
    ["--request", "synthetic"],
    ["--json", "--request-stdin"],
  ]) {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const {runSingleTaskCommand}=await import(${JSON.stringify(commandUrl)}); await runSingleTaskCommand(${JSON.stringify(args)});`,
      ],
      { cwd: repositoryRoot, input: "", encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 64, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      command: "task",
      status: "blocked",
      reason: "task_arguments_invalid",
    });
  }
});

/**
 * 移管したReaderの上限・UTF-8・重複JSON拒否を実stdinで確認する。
 * @responsibility 128KiB境界と不正入力の同じ拒否理由を維持する。
 * @trace PRL-IT-012
 * @precondition 単独Readerを子Processで読み込み、合成内容だけを渡す。
 * @stimulus 上限一致、上限超過、不正UTF-8、重複keyを渡す。
 * @observation 固定結果と子Process終了。
 * @oracle 上限一致はok、他は既存の入力失敗理由。
 * @cleanup 子Process終了。保存物なし。
 * @boundary OS標準入力とReader。AI・Docker・認証なし。
 */
test("移管したTask Readerは128KiBと厳格な入力拒否を維持する", () => {
  const readerUrl = pathToFileURL(
    path.join(repositoryRoot, "40_Develop/coordinator/src/cli/options.ts"),
  ).href;
  const exact = JSON.stringify({ value: "x".repeat(128 * 1024 - 12) });
  assert.equal(Buffer.byteLength(exact), 128 * 1024);
  for (const [input, expected] of [
    [exact, "ok"],
    [`${exact} `, "task_request_too_large"],
    [Buffer.from([255]), "task_request_invalid_utf8"],
    ['{"value":1,"value":2}', "task_request_invalid_json"],
  ] as const) {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `const {readBoundedTaskRequestFromStdin}=await import(${JSON.stringify(readerUrl)});try {readBoundedTaskRequestFromStdin();process.stdout.write("ok")}catch(error){process.stdout.write(error.message)}`,
      ],
      { cwd: repositoryRoot, input, encoding: "utf8", timeout: 10000 },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, expected);
  }
});

/**
 * 受付後の例外でも元の再観測参照と終了失敗を保持する。
 * @responsibility CLI実関数のwait／close拒否を有限Ownerで反証する。
 * @trace PRL-IT-012
 * @precondition 子Process内の既存Module境界だけを代役化する。
 * @stimulus 受付成功後にwaitとcloseが例外化する。
 * @observation stdout一件、元requestId、開始／待機／終了回数。
 * @oracle 非成功、参照維持、close一回、再送なし。
 * @cleanup 子Processの終了を待ち、Filesystem生成・AI起動を行わない。
 * @boundary 実CLIと有限Owner。Docker／Provider実証ではない。
 */
test("単発操作は受付後の待機・終了例外でも元依頼IDを保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/task/requests.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    source
      .slice(source.indexOf("export async function runTask("))
      .replace("export ", ""),
  );
  for (const fault of [
    "none",
    "start",
    "wait",
    "close",
    "wait_close",
    "cancel",
  ]) {
    let starts = 0,
      waits = 0,
      closes = 0,
      opens = 0;
    const controller = new AbortController();
    if (fault === "cancel") controller.abort();
    const run = runInNewContext(body + ";runTask", {
      readExecutionCancellation,
      openTaskSession: () => {
        opens++;
        return {
          start: async () => {
            starts++;
            if (fault === "start") throw Error("PRIVATE_FIXTURE_DETAIL");
            return {
              status: "accepted",
              requestId: "request-fixture",
              reason: null,
            };
          },
          wait: async () => {
            waits++;
            if (fault.startsWith("wait")) throw Error("PRIVATE_FIXTURE_DETAIL");
            return {
              status: "completed",
              requestId: "request-fixture",
              reason: null,
              cleanupConfirmed: true,
              secondaryFailures: [],
            };
          },
          close: async () => {
            closes++;
            if (fault.includes("close")) throw Error("PRIVATE_FIXTURE_DETAIL");
          },
        };
      },
    });
    const result = await run({}, {}, controller.signal);
    assert.equal(opens, fault === "cancel" ? 0 : 1);
    assert.equal(starts, fault === "cancel" ? 0 : 1);
    assert.equal(waits, ["cancel", "start"].includes(fault) ? 0 : 1);
    assert.equal(closes, fault === "cancel" ? 0 : 1);
    assert.equal(
      result.requestId,
      ["cancel", "start"].includes(fault) ? null : "request-fixture",
    );
    assert.equal(
      result.status,
      fault === "none"
        ? "completed"
        : fault === "cancel"
          ? "blocked"
          : "unknown",
    );
    assert.deepEqual(
      Array.from(result.secondaryFailures),
      fault.includes("close") ? ["task_owner_join_unconfirmed"] : [],
    );
    if (fault.startsWith("wait"))
      assert.equal(result.reason, "task_entry_unconfirmed");
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE_FIXTURE_DETAIL/);
  }
});

/**
 * 業務操作と単発実行が単一Coordinator Rootから明示公開されることを確認する。
 *
 * @responsibility 公開値の完全集合とPackageの業務入口を照合する。
 * @trace PRL-IT-012
 * @precondition 統合後の単一公開Moduleを読込み済みである。
 * @stimulus 公開値とPackage exportsを列挙する。
 * @observation Export名、関数型と業務入口の解決先を取得する。
 * @oracle 宣言済み37実行値とexact一致し、設定保存はDomainだけが公開する。
 * @cleanup N/A: Sourceを読み取るだけで実行、書込みや資源取得を発行しない。
 * @boundary PRL-IT-012=Direct Boundary: 公開ModuleとPackage設定。
 */
test("統合Rootは業務操作と単発実行の明示公開集合を保持する", () => {
  assert.deepEqual(Object.keys(coordinator).sort(), [
    "COORDINATOR_HUMAN_DECISION_CONTRACT",
    "COORDINATOR_MAXIMUM_OBJECTIVES",
    "COORDINATOR_MAXIMUM_TASKS",
    "COORDINATOR_OBJECTIVE_INTAKE_CONTRACT",
    "COORDINATOR_PUBLIC_RUNTIME_CONTRACT",
    "acceptResult",
    "authenticateProvider",
    "diagnoseEnvironment",
    "executeWorkspace",
    "getAuthenticationStatus",
    "getCapabilities",
    "initializeProject",
    "inspectCoordinatorDecisionRequest",
    "inspectCoordinatorObjectiveRequest",
    "inspectCoordinatorStateQuery",
    "inspectCoordinatorStateQueryResult",
    "inspectCoordinatorWorkspaceResults",
    "inspectRuntimeActivityObservation",
    "inspectSingleTaskCommand",
    "inspectWorkspaceCommand",
    "isCoordinatorObjectiveProjectionCorrelationValid",
    "isCoordinatorProjectionSemanticallyValid",
    "isSupportedNodeRuntime",
    "observeClientPrincipal",
    "openTaskSession",
    "parseRuntimeActivityObservation",
    "queryActivity",
    "queryState",
    "readRepositoryNetworkPolicies",
    "recoverExecution",
    "repairDockerRuntime",
    "restartDockerForRecovery",
    "retainRepair",
    "runObjective",
    "runTask",
    "submitDecision",
  ]);
  assert.equal(Object.hasOwn(coordinator, "readRepositoryAiSelection"), false);
  assert.equal(Object.hasOwn(coordinator, "saveRepositoryAiSelection"), false);
  assert.equal(typeof readRepositoryAiSelection, "function");
  assert.equal(typeof saveRepositoryAiSelection, "function");
  for (const value of [
    coordinator.runObjective,
    coordinator.submitDecision,
    coordinator.acceptResult,
    coordinator.queryState,
    coordinator.observeClientPrincipal,
  ])
    assert.equal(typeof value, "function");
  for (const entry of [
    "src/index.ts",
    "package.json",
    "tsconfig.json",
    "symbol.json",
  ]) {
    assert.equal(
      fs.existsSync(
        path.join(repositoryRoot, "40_Develop/orchestrator", entry),
      ),
      false,
    );
  }
  const metadata = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, "40_Develop/coordinator/package.json"),
      "utf8",
    ),
  );
  assert.equal(metadata.exports["."], "./src/index.ts");
  assert.equal(metadata.exports["./application"], undefined);
});

/**
 * 直接利用側が統合Coordinatorの公開Rootへ接続することを確認する。
 *
 * @responsibility Root逆依存の再導入とWorkbench／MCPの呼出し先漏れを拒否する。
 * @trace PRL-IT-012
 * @precondition Sourceの現在PathがRepository内で固定されている。
 * @stimulus 公開Rootと二利用側のimportを読み取る。
 * @observation Module specifierと業務関数名の参照を取得する。
 * @oracle Rootに旧Package参照・自己迂回がなく、二利用側は統合Rootへ接続する。
 * @cleanup N/A: Repository Sourceの読取りだけである。
 * @boundary PRL-IT-012=Related 2 Blocks: 利用側→業務公開入口→Coordinator。
 */
test("WorkbenchとMCPは業務Ownerへ直接接続する", () => {
  const root = fs.readFileSync(
    path.join(repositoryRoot, "40_Develop/coordinator/src/index.ts"),
    "utf8",
  );
  assert.doesNotMatch(root, /orchestrator\/src/);
  const selfDetour = /\.\.\/\.\.\/coordinator\/src\//u;
  assert.doesNotMatch(root, selfDetour);
  assert.throws(() =>
    assert.doesNotMatch(
      root + '\nexport { sample } from "../../coordinator/src/task/sample.ts";',
      selfDetour,
    ),
  );
  for (const relativePath of [
    "40_Develop/workbench-server/src/server/activity/observe.ts",
    "template/tools/crdd-mcp-server.ts",
  ]) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    assert.match(source, /coordinator\/src\/index\.ts/);
  }
});

/**
 * 配布CLIから配送した業務入力が既存の不正入力境界で停止することを確認する。
 *
 * @responsibility 入口移管で標準入力の上限・UTF-8・JSONと終了コードが変わらないことを検査する。
 * @trace PRL-IT-012
 * @precondition 未署名Sourceを使い、実行要求として成立しない入力だけを渡す。
 * @stimulus 不正引数、不正JSON、不正UTF-8、128KiB超過と未対応Nodeを別子Processで確認する。
 * @observation 終了コードと安全な公開reasonを取得する。
 * @oracle 入力拒否は64、未対応Nodeは直接起動2・配送64となり、表示境界を保持してProvider実行へ進まない。
 * @cleanup 同期子Processは終了まで待ち、保存やDocker操作を発行しない。
 * @boundary PRL-IT-012=Related 2 Blocks: 配布CLI→業務CLI→共通入力Reader。
 */
test("配布CLIの上位配送は入力拒否契約を保持する", () => {
  const launcher = path.join(
    repositoryRoot,
    "template/tools/crdd-coordinator.ts",
  );
  const cases = [
    {
      args: ["project", "run", "--request-stdin", "--json"],
      input: "{",
      reason: "task_request_invalid_json",
    },
    {
      args: ["project", "run", "--request-stdin", "--json"],
      input: "{",
      reason: "task_request_invalid_json",
    },
    {
      args: ["project", "run", "--request-stdin", "--json"],
      input: Buffer.from([255]),
      reason: "task_request_invalid_utf8",
    },
    {
      args: ["project", "run", "--request-stdin", "--json"],
      input: "x".repeat(128 * 1024 + 1),
      reason: "task_request_too_large",
    },
  ];
  for (const example of cases) {
    const result = spawnSync(process.execPath, [launcher, ...example.args], {
      input: example.input,
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 64, result.stderr);
    assert.equal(JSON.parse(result.stdout).reason, example.reason);
  }
  const commandSource = fs.readFileSync(
    path.join(repositoryRoot, "40_Develop/coordinator/src/cli/request.ts"),
    "utf8",
  );
  assert.doesNotMatch(commandSource, /orchestrator\/src/);
  for (const args of [
    ["task", "run", "--request-stdin", "--json"],
    ["task", "run", "--request-stdin", "--json"],
  ]) {
    for (const input of [
      { objective: "legacy Bundle request" },
      {
        mode: "workspace_edit",
        profileId: "PROFILE-100001",
        prompt: "synthetic",
        contextReferences: ["PROJECT_CONTEXT.md"],
        allowedPaths: ["source.txt"],
        externalSendConfirmed: true,
      },
    ]) {
      const refused = spawnSync(process.execPath, [launcher, ...args], {
        input: JSON.stringify(input),
        encoding: "utf8",
        windowsHide: true,
        timeout: 15000,
      });
      assert.equal(refused.error, undefined);
      assert.equal(refused.status, 2, refused.stderr);
      assert.equal(
        JSON.parse(refused.stdout).reason,
        "task_workspace_request_required",
      );
      assert.equal(refused.stdout.trim().split("\n").length, 1);
    }
  }
  // Node拒否は表示形式にかかわらず操作前に停止する。
  for (const args of [
    ["project", "run", "--request-stdin", "--json"],
    ["task", "run", "--request-stdin", "--json"],
  ]) {
    const script = `Object.defineProperty(process.versions,"node",{value:"24.11.0"});process.argv=[process.execPath,${JSON.stringify(launcher)},...${JSON.stringify(args)}];await import(${JSON.stringify(pathToFileURL(launcher).href)});`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { encoding: "utf8", windowsHide: true, timeout: 15000 },
    );
    assert.equal(result.status, 64, result.stderr);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /coordinator_node_version_unsupported/u);
  }
});
