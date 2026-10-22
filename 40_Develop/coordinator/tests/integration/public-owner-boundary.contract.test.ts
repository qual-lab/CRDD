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
import * as coordinator from "../../src/index.ts";

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
        if (mode === "interactive") {
          assert.equal(result.stdout, "");
          assert.match(
            result.stderr,
            /coordinator_launch_terminal_output_required/,
          );
        } else {
          assert.equal(result.stderr, "");
          assert.deepEqual(JSON.parse(result.stdout), {
            command,
            status: "blocked",
            reason: `${command}_arguments_invalid`,
          });
        }
      }
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
      call: 'await runProjectCommand(["--request-stdin", "--json"]);',
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
    path.join(
      repositoryRoot,
      "40_Develop/coordinator/src/cli/request-input.ts",
    ),
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
test("単発CLIは受付後の待機・終了例外でも元依頼IDを保持する", () => {
  /**
   * 実ModuleへのURLをRepository内の相対指定から作る。
   * @responsibility 実ModuleへのURLをRepository内の相対指定から作る。
   * @trace PRL-IT-012
   * @precondition 固定repository Rootと既知Module相対Path。
   * @stimulus pathToFileURLでModule URLへ変換する。
   * @observation mock対象のexact URL。
   * @oracle CLIと同じModuleを置換し別URLへ逸れない。
   * @cleanup N/A: URL文字列生成だけ。
   * @boundary 子Process Module接続の準備。FS変更なし。
   */
  const url = (relative: string) =>
    pathToFileURL(path.join(repositoryRoot, relative)).href;
  const script = `
    import { mock } from "node:test";
    /**
     * 子Processの既存Moduleへ有限の失敗代役を重ねる。
     * @responsibility 子Processの既存Moduleへ有限の失敗代役を重ねる。
     * @trace PRL-IT-012
     * @precondition 実Module exportsと指定override。
     * @stimulus mock.moduleで元exportsを保持して必要fieldだけ置換する。
     * @observation 実CLIの受付・wait・close回数と失敗JSON。
     * @oracle 指定故障以外の入口を消さず元request IDと一次失敗を保持する。
     * @cleanup 子Process終了でmockを破棄する。
     * @boundary 実CLI本文と有限Module代役。AI・Dockerなし。
     */
    const replace = async (url, exports) => {
      const actual = await import(url);
      mock.module(url, { exports: { ...actual, ...exports } });
    };
    let starts = 0, waits = 0, closes = 0;
    await replace(${JSON.stringify(url("40_Develop/coordinator/src/cli/request-input.ts"))}, {
      readBoundedTaskRequestFromStdin: () => ({ mode: "workspace_edit", profileId: "PROFILE-100001", prompt: "synthetic", contextReferences: ["PROJECT_CONTEXT.md"], allowedPaths: ["source.txt"], externalSendConfirmed: true, expectedNetworkPolicyHash: "a".repeat(64), workspaceId: null })
    });
    await replace(${JSON.stringify(url("40_Develop/version-control/src/index.ts"))}, {
      resolveVerifiedRepositoryRootFromWorkingDirectory: () => ${JSON.stringify(repositoryRoot)},
      verifyRepositoryRoot: () => ({ status: "completed", capability: {} })
    });
    await replace(${JSON.stringify(url("40_Develop/ai-adapter/src/index.ts"))}, {
      createRepositoryAiProfileCatalogStore: () => ({ status: "ready", store: {} })
    });
    await replace(${JSON.stringify(url("40_Develop/domain-model/src/index.ts"))}, {
      readStableBoundedFileSnapshot: () => ({ bytes: Buffer.from("synthetic") }),
      parseRepositoryProjectContextMarkdown: () => ({ projectId: "PRJ-test" })
    });
    await replace(${JSON.stringify(url("40_Develop/coordinator/src/task/request-composition.ts"))}, {
      createRepositoryTaskRequests: () => ({
        start: async () => { starts++; return { status: "accepted", requestId: "request-fixture", reason: null }; },
        wait: async () => { waits++; throw new Error("synthetic_wait_failure"); },
        close: async () => { closes++; throw new Error("synthetic_close_failure"); }
      })
    });
    const { runSingleTaskCommand } = await import(${JSON.stringify(url("40_Develop/coordinator/src/cli/request.ts"))});
    await runSingleTaskCommand(["--request-stdin", "--json"]);
    process.stderr.write(JSON.stringify({ starts, waits, closes }));
  `;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      "--disable-warning=ExperimentalWarning",
      "--input-type=module",
      "-e",
      script,
    ],
    { encoding: "utf8", windowsHide: true, timeout: 15000 },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.requestId, "request-fixture");
  assert.equal(report.status, "unknown");
  assert.equal(report.cleanupConfirmed, false);
  assert.deepEqual(report.secondaryFailures, ["task_owner_join_unconfirmed"]);
  assert.deepEqual(JSON.parse(result.stderr), {
    starts: 1,
    waits: 1,
    closes: 1,
  });
  assert.equal(result.stdout.trim().split("\n").length, 1);
});

/**
 * 業務操作と単発実行が単一Coordinator Rootから明示公開されることを確認する。
 *
 * @responsibility 公開値の完全集合とPackageの業務入口を照合する。
 * @trace PRL-IT-012
 * @precondition 統合後の単一公開Moduleを読込み済みである。
 * @stimulus 公開値とPackage exportsを列挙する。
 * @observation Export名、関数型と業務入口の解決先を取得する。
 * @oracle 宣言済み120実行値とexact一致し、旧Package入口が存在しない。
 * @cleanup N/A: Sourceを読み取るだけで実行、書込みや資源取得を発行しない。
 * @boundary PRL-IT-012=Direct Boundary: 公開ModuleとPackage設定。
 */
test("統合Rootは業務操作と単発実行の明示公開集合を保持する", () => {
  assert.deepEqual(Object.keys(coordinator).sort(), [
    "COORDINATOR_TASK_PRE_EFFECT_REJECTIONS",
    "ORCHESTRATOR_ACCEPTANCE_DECISION_CONTRACT",
    "ORCHESTRATOR_ACCEPTANCE_DECISION_STORE_CONTRACT",
    "ORCHESTRATOR_EXECUTION_CONTRACT",
    "ORCHESTRATOR_HUMAN_DECISION_CONTRACT",
    "ORCHESTRATOR_INTEGRATION_CONTRACT",
    "ORCHESTRATOR_MAXIMUM_CONCURRENCY",
    "ORCHESTRATOR_MAXIMUM_OBJECTIVES",
    "ORCHESTRATOR_MAXIMUM_TASKS",
    "ORCHESTRATOR_OBJECTIVE_INTAKE_CONTRACT",
    "ORCHESTRATOR_PLATFORM_BOUNDARIES",
    "ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES",
    "ORCHESTRATOR_PLATFORM_BOUNDARY_OPERATIONS",
    "ORCHESTRATOR_PLATFORM_CONTRACT",
    "ORCHESTRATOR_PLATFORM_CONTRACT_REVISION",
    "ORCHESTRATOR_PUBLIC_RUNTIME_CONTRACT",
    "ORCHESTRATOR_REPLANNING_CONTRACT",
    "ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT",
    "ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION",
    "ORCHESTRATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS",
    "ORCHESTRATOR_STATE_CONTRACT",
    "ORCHESTRATOR_STATE_QUERY_CONTRACT",
    "acknowledgeProjectDockerRecoveryObligation",
    "acquireRuntimeOwnedOrchestratorStateKernelLock",
    "applyOrchestratorAcceptanceDecision",
    "applyOrchestratorHumanDecision",
    "applyOrchestratorPartialReplan",
    "createCurrentOrchestratorPersistencePorts",
    "createOrchestratorAcceptanceAuthorityAdapter",
    "createOrchestratorDecisionCapabilityAdapter",
    "createOrchestratorExecutionHostPorts",
    "createOrchestratorObjectiveResult",
    "createOrchestratorSnapshotAcceptanceDecisionStore",
    "createOrchestratorSnapshotDecisionRecoveryStore",
    "createOrchestratorSnapshotIntegrationRecordPort",
    "createOrchestratorSnapshotPersistencePorts",
    "createOrchestratorState",
    "createOrchestratorTaskAttemptEvent",
    "createOrchestratorTaskExecutionSet",
    "createOrchestratorTaskRecoveryAdapter",
    "createRepositoryTaskRequests",
    "createRuntimeProcessRecoveryIdentity",
    "describeOrchestratorExecutionContract",
    "describeOrchestratorObjectiveIntakeContract",
    "describeOrchestratorPlatformContract",
    "describeOrchestratorSingleTaskAdapterContract",
    "describeOrchestratorStateContract",
    "executeOrchestratorObjective",
    "executeOrchestratorPublicAcceptanceDecision",
    "executeOrchestratorPublicStateQuery",
    "executeWorkspaceCommand",
    "getRuntimeProcessInstanceIdentity",
    "initializeOrchestratorSnapshot",
    "inspectOrchestratorDecisionRequest",
    "inspectOrchestratorObjectivePlan",
    "inspectOrchestratorObjectiveRequest",
    "inspectOrchestratorProjection",
    "inspectOrchestratorSnapshotIntake",
    "inspectOrchestratorStateQuery",
    "inspectOrchestratorStateQueryResult",
    "inspectOrchestratorWorkspaceResults",
    "inspectRuntimeActivityObservation",
    "inspectRuntimeProcessRecoveryIdentity",
    "inspectWorkspaceCommand",
    "invalidateOrchestratorHumanDecision",
    "isOrchestratorDecisionRecord",
    "isOrchestratorObjectiveProjectionCorrelationValid",
    "isOrchestratorProjectionSemanticallyValid",
    "isOrchestratorRecoveryIdentity",
    "isSupportedCoordinatorNodeRuntime",
    "issueOrchestratorHumanDecision",
    "maintainOrchestratorSnapshot",
    "manageOrchestratorWorkspace",
    "markProjectTaskRecoveryObligationRecovering",
    "observeProjectTaskStarted",
    "observeRuntimeOwnedProjectClientPrincipal",
    "observeRuntimeOwnedTransientTaskCompletion",
    "orchestratorDecisionRecordId",
    "parseRuntimeActivityObservation",
    "poisonRuntimeProcessAfterCleanupUnknown",
    "prepareProjectTaskHandoff",
    "projectOrchestratorState",
    "queryOrchestratorState",
    "readAuthorizedRuntimeActivity",
    "readCurrentOrchestratorState",
    "readOrchestratorSnapshot",
    "readRepositoryNetworkPolicies",
    "recordOrchestratorAcceptanceDecision",
    "recordOrchestratorExecutionEvent",
    "recordProjectTaskOwnerLossRecoveries",
    "recoverOrchestratorHumanDecision",
    "recoverProviderAdviceHostOperation",
    "recoverRuntimeOwnedDockerTaskForCurrentConsumer",
    "replaceOrchestratorHumanDecision",
    "requestOrchestratorHumanDecision",
    "reserveProjectTaskStart",
    "resolveOrchestratorPlatformAdapter",
    "resolveOrchestratorReplan",
    "resolveOrchestratorWorkspaceTaskTarget",
    "resolveRuntimeOwnedDockerTaskCurrentCorrelations",
    "retryOrchestratorTask",
    "retrySettledProjectTaskRecoveries",
    "runCoordinatorTaskAttempt",
    "runOrchestratorOperation",
    "runOrchestratorPublicAcceptanceDecision",
    "runOrchestratorPublicDecision",
    "runOrchestratorPublicObjective",
    "runOrchestratorPublicStateQuery",
    "runOrchestratorSingleTaskAttempt",
    "runRepositoryAdvice",
    "selectSchedulableProjectTasks",
    "settleProjectTask",
    "settleProjectTaskBeforeEffect",
    "settleProjectTaskRecoveryObligation",
    "snapshotCoordinatorWorkspaceResult",
    "submitOrchestratorHumanDecision",
    "validOrchestratorAcceptanceDecisionEnvelope",
    "validOrchestratorAcceptanceDecisionRecord",
    "validOrchestratorDecisionRecoveryIntent",
    "validOrchestratorResultRecord",
  ]);
  for (const value of [
    coordinator.executeOrchestratorPublicAcceptanceDecision,
    coordinator.executeOrchestratorPublicStateQuery,
    coordinator.observeRuntimeOwnedProjectClientPrincipal,
    coordinator.runOrchestratorPublicAcceptanceDecision,
    coordinator.runOrchestratorPublicDecision,
    coordinator.runOrchestratorPublicObjective,
    coordinator.runOrchestratorPublicStateQuery,
  ]) {
    assert.equal(typeof value, "function");
  }
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
      args: ["project", "--invalid"],
      input: "",
      reason: "project_arguments_invalid",
    },
    {
      args: ["automation", "project", "--request-stdin", "--json"],
      input: "{",
      reason: "task_request_invalid_json",
    },
    {
      args: ["project", "--request-stdin", "--json"],
      input: Buffer.from([255]),
      reason: "task_request_invalid_utf8",
    },
    {
      args: ["project", "--request-stdin", "--json"],
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
    path.join(repositoryRoot, "40_Develop/coordinator/src/cli/command.ts"),
    "utf8",
  );
  assert.doesNotMatch(commandSource, /orchestrator\/src/);
  for (const args of [
    ["task", "--request-stdin", "--json"],
    ["automation", "task", "--request-stdin", "--json"],
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
  // Node拒否を模擬するだけで、Project処理や外部Effectへ進めない。
  for (const example of [
    { args: ["project", "--invalid"], status: 2, json: false },
    { args: ["project", "--invalid", "--json"], status: 2, json: true },
    {
      args: ["automation", "project", "--request-stdin", "--json"],
      status: 64,
      json: false,
    },
  ]) {
    const script = `Object.defineProperty(process.versions, "node", { value: "24.11.0" }); process.argv = [process.execPath, ${JSON.stringify(launcher)}, ...${JSON.stringify(example.args)}]; await import(${JSON.stringify(pathToFileURL(launcher).href)});`;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 15_000,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, example.status, result.stderr);
    if (example.json) {
      assert.equal(
        JSON.parse(result.stdout).reason,
        "coordinator_node_version_unsupported",
      );
      assert.equal(result.stderr, "");
    } else {
      assert.equal(result.stdout, "");
      assert.match(
        result.stderr,
        example.status === 64
          ? /coordinator_node_version_unsupported/
          : /requires a preverified Node\.js 24\.12\.0/,
      );
    }
  }
});
