/**
 * Project Runtimeの耐久回復を公開Objective入口から検証する。
 *
 * @packageDocumentation
 * @responsibility 外部Effect不明時の耐久記録、exact Recovery Identity、再入場、settlementおよびretryをSystem境界で検証する。
 * @trace PRL-ST-004
 * @level ST
 * @scope Project Runtime Objective、Durable State、Recovery、Retry
 * @boundary PRL-ST-004=System/E2E: Public Objective→Durable Runtime→Recovery→Retry
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  markProjectTaskRecoveryObligationRecovering,
  type ProjectRuntimeSingleTaskResult,
  settleProjectTaskRecoveryObligation,
} from "../../../project-runtime/src/index.ts";
import { consumeDockerRecoveryReceiptAfterProjectSettlement } from "../../src/security/docker-recovery-runtime.ts";
import {
  readProjectRuntimeState,
  writeProjectRuntimeState,
} from "../../src/security/project-runtime-durable-foundation.ts";
import { createProjectRuntimeExecutionAuthorizationAdapter } from "../../src/security/project-runtime-execution-authorization-adapter.ts";
import { runProjectRuntimeObjective as runProjectRuntimeObjectiveWithPorts } from "../../src/security/project-runtime-objective-intake.ts";

const revision = "a".repeat(40);
type ObjectiveDependencies = Parameters<
  typeof runProjectRuntimeObjectiveWithPorts
>[0];
type TestObjectiveDependencies = Omit<ObjectiveDependencies, "execution"> &
  Readonly<{
    execution: Omit<ObjectiveDependencies["execution"], "authorization">;
  }>;

/**
 * Runtime-owned Authorizationを結合してObjectiveを実行する。
 *
 * @responsibility Public Objectiveから実行Authority Gateまで本番同等の接続を構築する。
 * @trace PRL-ST-004
 * @precondition Test依存は実行Authorization以外の本番Portを満たす。
 * @stimulus Objective要求と取消SignalをRuntimeへ渡す。
 * @observation Public結果と耐久状態を呼出し側へ返す。
 * @oracle Runtimeが発行・失効を所有するAuthorizationだけで実行される。
 * @cleanup 呼出し側のTestContextが一時Repositoryを清掃する。
 * @boundary PRL-ST-004=System/E2E: Public Objective→Durable Runtime→Recovery→Retry
 */
function runProjectRuntimeObjective(
  dependencies: TestObjectiveDependencies,
  rawRequest: unknown,
  cancellationSignal: AbortSignal,
) {
  return runProjectRuntimeObjectiveWithPorts(
    {
      ...dependencies,
      execution: {
        ...dependencies.execution,
        authorization: createProjectRuntimeExecutionAuthorizationAdapter({
          issueRuntimeCapability: () => Object.freeze({}),
          revokeRuntimeCapability: () => true,
        }),
      },
    },
    rawRequest,
    cancellationSignal,
  );
}

/**
 * Git Repositoryとして検証可能な一時Rootを作る。
 *
 * @responsibility Project RuntimeがRepository Root直下へ耐久状態を書くための隔離環境を作る。
 * @trace PRL-ST-004
 * @precondition Git CLIが利用可能である。
 * @stimulus 一時Directoryを作成してGit Repositoryを初期化する。
 * @observation 検証済みRoot Pathを返す。
 * @oracle 各Test Runが固有Rootを持つ。
 * @cleanup Test終了時にRoot全体を削除する。
 * @boundary PRL-ST-004=System/E2E: Public Objective→Durable Runtime→Recovery→Retry
 */
function root(t: test.TestContext) {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-recovery-"),
  );
  execFileSync("git", ["init", "--quiet", value], { windowsHide: true });
  t.after(() => fs.rmSync(value, { recursive: true, force: true }));
  return value;
}

/**
 * 固定Objective要求を作る。
 *
 * @responsibility 同じRequest Identityで再入場できる最小のProject Objectiveを構築する。
 * @trace PRL-ST-004
 * @precondition 上書き値はRequest契約のPropertyへ限定する。
 * @stimulus 基準要求へ上書きを適用する。
 * @observation Public Objective要求を返す。
 * @oracle 再入場間でRequest、Project、Milestone、Revisionが同一になる。
 * @cleanup N/A: Process内の値だけを生成する。
 * @boundary PRL-ST-004=System/E2E: Public Objective→Durable Runtime→Recovery→Retry
 */
function request(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "request-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    objective: "Create the result.",
    acceptanceCriteria: ["Result exists."],
    allowedPaths: ["result.txt"],
    readPaths: ["README.md"],
    maximumConcurrency: 1,
    maximumReplans: 0,
    originLane: "interactive",
    adoptResult: false,
    ...overrides,
  };
}

/**
 * 成功した単一Task結果を作る。
 *
 * @responsibility Runtimeから渡されたIdentityを保持した成功結果を返す。
 * @trace PRL-ST-004
 * @precondition Attempt、Operation、Authority、Revisionが発行済みである。
 * @stimulus 発行済みIdentityを成功結果へ写像する。
 * @observation settledかつcleanup済みの結果を返す。
 * @oracle 入力Identityを変更せず回復義務を残さない。
 * @cleanup N/A: Process内の値だけを生成する。
 * @boundary PRL-ST-004=System/E2E: Public Objective→Durable Runtime→Recovery→Retry
 */
async function completed(input: {
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  observeStarted?: () => Promise<boolean>;
}): Promise<ProjectRuntimeSingleTaskResult> {
  assert.equal(await input.observeStarted?.(), true);
  return {
    contract: "crdd-coordinator/project-runtime-single-task-adapter",
    attemptId: input.attemptId,
    operationId: input.operationId,
    authorityBindingId: input.authorityBindingId,
    repositoryRevision: input.repositoryRevision,
    status: "completed",
    reason: "task_completed",
    effectState: "settled",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    candidateId: "candidate-a",
    recoveryIds: [],
  };
}

/**
 * 別Processを模した再入場でRuntime Process義務をsettleする。
 *
 * @responsibility 耐久状態からexact Runtime Process義務を取得し、required→recovering→settledを同じIdentityで遷移させる。
 * @trace PRL-ST-004
 * @precondition Project Runtime Stateに未settleのRuntime Process義務が保存されている。
 * @stimulus 耐久状態を再読取りし、許可された状態遷移を書き戻す。
 * @observation Generation付きの更新結果を確認する。
 * @oracle 別IdentityやGeneration不一致を使わず一つの義務だけをsettleする。
 * @cleanup N/A: 生成した耐久状態はTest Rootのcleanup対象である。
 * @boundary PRL-ST-004=System/E2E: Public Objective→Durable Runtime→Recovery→Retry
 */
function settleRuntimeProcessAsFreshProcess(workingDirectory: string) {
  const observed = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(observed.status, "completed");
  assert.ok(observed.value);
  let state = observed.value;
  const task = state.tasks.find((entry) =>
    entry.recoveryObligations.some(
      (obligation) =>
        obligation.kind === "runtime_process" && obligation.phase !== "settled",
    ),
  );
  const obligation = task?.recoveryObligations.find(
    (entry) => entry.kind === "runtime_process" && entry.phase !== "settled",
  );
  assert.ok(task);
  assert.ok(obligation);
  if (obligation.phase === "required") {
    const recovering = markProjectTaskRecoveryObligationRecovering(
      state,
      state.generation,
      task.definition.id,
      obligation.kind,
      obligation.recoveryId,
    );
    assert.equal(recovering.status, "completed");
    assert.ok(recovering.state);
    const written = writeProjectRuntimeState(
      workingDirectory,
      "binding-a",
      recovering.state,
      state.generation,
    );
    assert.equal(written.status, "completed");
    state = written.value;
  }
  const settled = settleProjectTaskRecoveryObligation(
    state,
    state.generation,
    task.definition.id,
    obligation.kind,
    obligation.recoveryId,
  );
  assert.equal(settled.status, "completed");
  assert.ok(settled.state);
  assert.equal(
    writeProjectRuntimeState(
      workingDirectory,
      "binding-a",
      settled.state,
      state.generation,
    ).status,
    "completed",
  );
}

/**
 * 外部Effect不明後もexact Recovery Identityで再入場してretryする。
 *
 * @responsibility Effect前の耐久記録、観測不能の保持、exact回復、acknowledgement再開および一回だけのretryを検証する。
 * @trace PRL-ST-004
 * @precondition 初回TaskはDocker cleanup不明とexact Recovery Identityを返す。
 * @stimulus 同じObjectiveへ再入場し、Runtime Process義務を別Process相当でsettleして再開する。
 * @observation Public結果、回復呼出し、acknowledgement回数、attempt回数、retryCountおよび耐久義務を観測する。
 * @oracle 不明状態では再実行せず、同じIdentityのsettlement後だけ一回retryして完了する。
 * @cleanup Test Rootと全耐久状態をTest終了時に削除する。
 * @boundary PRL-ST-004=System/E2E: Public Objective→Durable Runtime→Recovery→Retry
 */
test("外部Effect不明後もexact Recovery Identityで再入場してretryする", async (t) => {
  const workingDirectory = root(t);
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  let attempts = 0;
  let recoveries = 0;
  let acknowledgements = 0;
  const dependencies = {
    authenticatedPrincipalId: "principal-a",
    verifyProjectBinding: () => ({
      status: "verified" as const,
      repositoryBindingId: "binding-a",
      repositoryRevision: revision,
      workingDirectory,
      repositoryRoot: workingDirectory,
      bindingCapability: {},
    }),
    planObjective: () => ({
      milestoneAcceptanceCriteria: ["Result exists."],
      objectives: [
        { id: "objective-a", acceptanceCriteria: ["Result exists."] },
      ],
      tasks: [
        {
          id: "task-a",
          objectiveId: "objective-a",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: ["result.txt"],
        },
      ],
    }),
    createTaskExecutions: () => [
      { taskId: "task-a", taskRequest: {}, repositoryRoot: workingDirectory },
    ],
    observeLeaseOwner: () => ({ status: "absent" as const }),
    recoverTaskRecovery: (exact: string) => {
      recoveries += 1;
      assert.equal(exact, recoveryId);
      return { status: "recovered" as const, recoveryId: null };
    },
    acknowledgeTaskRecovery: (settlement: {
      workingDirectory: string;
      repositoryBindingId: string;
      recoveryId: string;
      projectId: string;
      milestoneId: string;
      stateGeneration: number;
      taskId: string;
      attemptId: string;
      operationId: string;
      kind: "docker";
    }) => {
      acknowledgements += 1;
      const consumed =
        consumeDockerRecoveryReceiptAfterProjectSettlement(settlement);
      assert.notEqual(
        consumed.reason,
        "docker_task_recovery_settlement_not_verified",
      );
      if (acknowledgements === 1)
        return {
          status: "blocked" as const,
          reason: "acknowledgement_interrupted",
        };
      return {
        status: "completed" as const,
        reason: "acknowledged",
        acknowledgement: {
          runtimeStateBinding: {
            runtimeStateIdentityHash: "1".repeat(64),
            runtimeStateProtectionHash: "2".repeat(64),
            localUserBindingHash: "3".repeat(64),
            runtimeStateBindingHash: "4".repeat(64),
          },
          receiptContentHash: "5".repeat(64),
          receiptContentIdentity: "1:2:3",
        },
      };
    },
    finalizeTaskRecoveryAcknowledgement: () => ({
      status: "completed" as const,
      reason: "acknowledgement_collected",
    }),
    observeRecoveryTransition: async () => {
      throw new Error("diagnostic_unavailable");
    },
    execution: {
      runSingleTaskAttempt: async (input: Parameters<typeof completed>[0]) => {
        attempts += 1;
        if (attempts === 1)
          return {
            ...(await completed(input)),
            status: "blocked" as const,
            reason: "docker_cleanup_unknown",
            effectState: "unknown" as const,
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            recoveryIds: [recoveryId],
            recoveryObligations: [{ kind: "docker" as const, recoveryId }],
            candidateId: null,
          };
        return completed(input);
      },
    },
  };

  const first = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(first.reason, "project_runtime_task_recovery_required");
  assert.equal(first.manualRecoveryRequired, true);
  assert.equal(first.recoveryIds.includes(recoveryId), true);
  assert.equal(attempts, 1);

  const unresolved = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(unresolved.reason, "project_runtime_task_recovery_not_settled");
  assert.equal(recoveries, 1);
  assert.equal(attempts, 1);

  settleRuntimeProcessAsFreshProcess(workingDirectory);
  const interrupted = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(
    interrupted.reason,
    "project_runtime_task_recovery_acknowledgement_not_settled",
  );

  const completedResult = await runProjectRuntimeObjective(
    dependencies,
    request(),
    new AbortController().signal,
  );
  assert.equal(
    completedResult.status,
    "completed",
    JSON.stringify(completedResult),
  );
  assert.equal(recoveries, 1);
  assert.equal(acknowledgements, 2);
  assert.equal(attempts, 2);
  const latest = readProjectRuntimeState(
    workingDirectory,
    "binding-a",
    "project-a",
  );
  assert.equal(latest.value?.tasks[0]?.retryCount, 1);
});
