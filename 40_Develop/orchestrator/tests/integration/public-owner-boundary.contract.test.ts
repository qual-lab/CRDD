/**
 * Orchestrator公開業務操作とCoordinator単一Task入口の依存境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 移管後の公開Export、Package接続と直接利用側が上位Ownerを参照することを確認する。
 * @trace PRL-IT-012
 * @level IT
 * @scope Orchestrator業務公開入口、Coordinator Root、Workbench、MCP・CLI配布入口
 * @boundary PRL-IT-012=Related 2 Blocks: 利用側→業務公開入口→Coordinator。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import * as coordinator from "../../../coordinator/src/index.ts";
import * as orchestrator from "../../src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * 業務操作をOrchestratorへ移し、Coordinatorが上位操作を再公開しないことを確認する。
 *
 * @responsibility 公開値の完全集合とPackageの業務入口を照合する。
 * @trace PRL-IT-012
 * @precondition 移管後の二つの公開Moduleを読込み済みである。
 * @stimulus 公開値とPackage exportsを列挙する。
 * @observation Export名、関数型と業務入口の解決先を取得する。
 * @oracle 既存Root公開集合に七業務操作だけを加え、Coordinatorに業務操作がない。
 * @cleanup N/A: Sourceを読み取るだけで実行、書込みや資源取得を発行しない。
 * @boundary PRL-IT-012=Direct Boundary: 公開ModuleとPackage設定。
 */
test("業務公開操作はOrchestratorが所有しCoordinatorから再公開しない", () => {
  assert.deepEqual(Object.keys(orchestrator).sort(), [
    "ORCHESTRATOR_ACCEPTANCE_DECISION_CONTRACT",
    "ORCHESTRATOR_ACCEPTANCE_DECISION_STORE_CONTRACT",
    "ORCHESTRATOR_CANDIDATE_ADOPTION_CONTRACT",
    "ORCHESTRATOR_EXECUTION_CONTRACT",
    "ORCHESTRATOR_HUMAN_DECISION_CONTRACT",
    "ORCHESTRATOR_INTEGRATION_BASE_RESULT_FIELDS",
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
    "adoptOrchestratorExistingCandidate",
    "applyOrchestratorAcceptanceDecision",
    "applyOrchestratorHumanDecision",
    "applyOrchestratorPartialReplan",
    "createCurrentOrchestratorPersistencePorts",
    "createOrchestratorAcceptanceAuthorityAdapter",
    "createOrchestratorDecisionCapabilityAdapter",
    "createOrchestratorExecutionAuthorizationAdapter",
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
    "describeOrchestratorExecutionContract",
    "describeOrchestratorIntegrationContract",
    "describeOrchestratorObjectiveIntakeContract",
    "describeOrchestratorPlatformContract",
    "describeOrchestratorSingleTaskAdapterContract",
    "describeOrchestratorStateContract",
    "executeOrchestratorObjective",
    "executeOrchestratorPublicAcceptanceDecision",
    "executeOrchestratorPublicStateQuery",
    "initializeOrchestratorSnapshot",
    "inspectOrchestratorDecisionRequest",
    "inspectOrchestratorExistingCandidate",
    "inspectOrchestratorIntegrationResult",
    "inspectOrchestratorObjectivePlan",
    "inspectOrchestratorObjectiveRequest",
    "inspectOrchestratorProjection",
    "inspectOrchestratorSnapshotIntake",
    "inspectOrchestratorStateQuery",
    "inspectOrchestratorStateQueryResult",
    "integrateOrchestratorOperation",
    "invalidateOrchestratorHumanDecision",
    "isOrchestratorDecisionRecord",
    "isOrchestratorObjectiveProjectionCorrelationValid",
    "isOrchestratorProjectionSemanticallyValid",
    "isOrchestratorRecoveryIdentity",
    "issueOrchestratorHumanDecision",
    "maintainOrchestratorSnapshot",
    "markProjectTaskRecoveryObligationRecovering",
    "observeProjectTaskStarted",
    "observeRuntimeOwnedProjectClientPrincipal",
    "orchestratorDecisionRecordId",
    "orchestratorIntegrationResultFields",
    "prepareProjectTaskHandoff",
    "projectOrchestratorState",
    "queryOrchestratorState",
    "readCurrentOrchestratorState",
    "readOrchestratorSnapshot",
    "recordOrchestratorAcceptanceDecision",
    "recordOrchestratorExecutionEvent",
    "recordProjectTaskOwnerLossRecoveries",
    "recoverOrchestratorHumanDecision",
    "replaceOrchestratorHumanDecision",
    "requestOrchestratorHumanDecision",
    "reserveProjectTaskStart",
    "resolveOrchestratorPlatformAdapter",
    "resolveOrchestratorReplan",
    "retryOrchestratorTask",
    "retrySettledProjectTaskRecoveries",
    "runOrchestratorOperation",
    "runOrchestratorPublicAcceptanceDecision",
    "runOrchestratorPublicDecision",
    "runOrchestratorPublicObjective",
    "runOrchestratorPublicStateQuery",
    "runOrchestratorSingleTaskAttempt",
    "selectSchedulableProjectTasks",
    "settleProjectTask",
    "settleProjectTaskBeforeEffect",
    "settleProjectTaskRecoveryObligation",
    "submitOrchestratorHumanDecision",
    "validOrchestratorAcceptanceDecisionEnvelope",
    "validOrchestratorAcceptanceDecisionRecord",
    "validOrchestratorDecisionRecoveryIntent",
    "validOrchestratorResultRecord",
  ]);
  for (const value of [
    orchestrator.executeOrchestratorPublicAcceptanceDecision,
    orchestrator.executeOrchestratorPublicStateQuery,
    orchestrator.observeRuntimeOwnedProjectClientPrincipal,
    orchestrator.runOrchestratorPublicAcceptanceDecision,
    orchestrator.runOrchestratorPublicDecision,
    orchestrator.runOrchestratorPublicObjective,
    orchestrator.runOrchestratorPublicStateQuery,
  ]) {
    assert.equal(typeof value, "function");
  }
  assert.deepEqual(Object.keys(coordinator).sort(), [
    "COORDINATOR_TASK_PRE_EFFECT_REJECTIONS",
    "acquireRuntimeOwnedOrchestratorStateKernelLock",
    "createRuntimeProcessRecoveryIdentity",
    "getRuntimeProcessInstanceIdentity",
    "inspectRuntimeProcessRecoveryIdentity",
    "isSupportedCoordinatorNodeRuntime",
    "poisonRuntimeProcessAfterCleanupUnknown",
    "runCoordinatorTaskAttempt",
  ]);
  const metadata = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, "40_Develop/orchestrator/package.json"),
      "utf8",
    ),
  );
  assert.equal(metadata.exports["."], "./src/index.ts");
  assert.equal(metadata.exports["./application"], undefined);
});

/**
 * 直接利用側がCoordinatorの旧業務再公開を利用しないことを確認する。
 *
 * @responsibility Root逆依存の再導入とWorkbench／MCPの呼出し先漏れを拒否する。
 * @trace PRL-IT-012
 * @precondition Sourceの現在PathがRepository内で固定されている。
 * @stimulus 公開Rootと二利用側のimportを読み取る。
 * @observation Module specifierと業務関数名の参照を取得する。
 * @oracle Coordinator Rootに上位importがなく、二利用側はOrchestrator業務入口へ接続する。
 * @cleanup N/A: Repository Sourceの読取りだけである。
 * @boundary PRL-IT-012=Related 2 Blocks: 利用側→業務公開入口→Coordinator。
 */
test("WorkbenchとMCPは業務Ownerへ直接接続する", () => {
  const root = fs.readFileSync(
    path.join(repositoryRoot, "40_Develop/coordinator/src/index.ts"),
    "utf8",
  );
  assert.doesNotMatch(root, /orchestrator|OrchestratorPublic/);
  for (const relativePath of [
    "40_Develop/workbench-server/src/activity/observe.ts",
    "template/tools/crdd-mcp-server.ts",
  ]) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    assert.match(source, /orchestrator\/src\/index\.ts/);
    assert.doesNotMatch(
      source,
      /import\s*\{[^}]*runOrchestratorPublic[^}]*\}\s*from\s*["'][^"']*coordinator\/src\/index\.ts["']/s,
    );
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
  assert.doesNotMatch(
    commandSource,
    /orchestrator\/src|runProjectCommand|initializeOrchestrator/,
  );
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
