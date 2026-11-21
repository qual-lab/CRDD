/**
 * Coordinator試験の検証済みRepositoryとEMの保存操作を接続する。
 * @packageDocumentation
 * @responsibility 試験が旧Reader／Writerへ戻ることを防ぐ。
 * @trace PRL-IT-005
 * @level IT
 * @scope 新版保存の試験接続。
 * @boundary PRL-IT-005=Direct Boundary: 試験から統合保存。
 */

import {
  projectExecutionFixture,
  initialExecutionInput,
} from "../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  createQueue,
  type QueueEnqueueInput,
  type ProjectExecutionInitialization,
  type ProjectExecutionState,
  type LeaseKind,
  readState,
  readProjectExecutionState,
  readQueueEntry,
  saveProjectExecutionState,
  updateQueue,
  selectQueueEntry,
} from "../../../execution-model/src/index.ts";
import { chooseCoordinatorQueueOperation } from "../../src/lifecycle/execution.ts";
import { verifyRuntimePersistenceRepository } from "../../src/lifecycle/host.ts";
import { taskExecutionSelections } from "./ai-selection.ts";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import assert from "node:assert/strict";
import * as selection from "../../src/lifecycle/selection.ts";
import * as kernel from "../../src/lifecycle/host.ts";
import * as objectiveValidation from "../../src/lifecycle/validation.ts";
import * as environment from "../../src/lifecycle/environment.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../../src/lifecycle/validation.ts";
import {
  dispatchSource,
  dispatchUrl,
  sourceUrl,
} from "../support/task-requests.ts";
import type {
  CoordinatorObjectiveExecutionDependencies,
  CoordinatorRecoveryTransition,
  CoordinatorSingleTaskAttemptInput,
  CoordinatorSingleTaskResult,
  CoordinatorTaskExecution,
} from "../../src/lifecycle/types.ts";

type TestAttempt = (
  input: CoordinatorSingleTaskAttemptInput,
) => Promise<CoordinatorSingleTaskResult>;
type Operation =
  typeof import("../../src/lifecycle/execution.ts").runCoordinatorOperation;

/** 試験用のTask本文だけを差し替え、元Rootと本番の相関IDは差し替えない。 */
function buildFixtureTaskExecutions(
  raw: unknown,
  request: Parameters<
    typeof objectiveValidation.buildObjectiveTaskExecutions
  >[0],
  state: ProjectExecutionState,
  root: object | string,
): readonly CoordinatorTaskExecution[] | null {
  const prepared = objectiveValidation.buildObjectiveTaskExecutions(
    request,
    state,
    root,
  );
  const fixtures = snapshotPlainArray(raw, prepared.length);
  if (fixtures.status !== "ok" || fixtures.value.length !== prepared.length)
    return null;
  const remaining = new Map(prepared.map((entry) => [entry.taskId, entry]));
  const result: CoordinatorTaskExecution[] = [];
  for (const value of fixtures.value) {
    const captured = snapshotPlainRecord(
      value,
      new Set(["taskId", "taskRequest", "repositoryRoot"] as const),
    );
    if (!captured || typeof captured.taskId !== "string") return null;
    const entry = remaining.get(captured.taskId);
    if (!entry) return null;
    remaining.delete(captured.taskId);
    result.push(Object.freeze({ ...entry, taskRequest: captured.taskRequest }));
  }
  return Object.freeze(result);
}
type TestExecution = Omit<Parameters<Operation>[0], "kind" | "input"> & {
  runSingleTaskAttempt: TestAttempt;
};
type TestObjective = {
  authenticatedPrincipalId: string;
  verifyProjectBinding: (
    input: Readonly<{
      projectId: string;
      milestoneId: string;
      repositoryRevision: string;
    }>,
  ) => unknown;
  recoverTaskRecovery?: (id: string, signal: AbortSignal) => unknown;
  resolveTaskRecoveryCorrelations?: (ids: readonly string[]) => unknown;
  observeRecoveryTransition?: (
    event: CoordinatorRecoveryTransition,
  ) => void | Promise<void>;
  observeLeaseOwner: (
    owner: Parameters<typeof kernel.observeObjectiveLeaseOwner>[0],
  ) => unknown;
  createTaskExecutions: (
    request: Parameters<
      typeof objectiveValidation.buildObjectiveTaskExecutions
    >[0],
    state: ProjectExecutionState,
  ) => unknown;
  resolveTaskSelections: (
    request: Parameters<typeof selection.resolveObjectiveTaskSelections>[1],
  ) => unknown;
  execution: CoordinatorObjectiveExecutionDependencies["execution"] & {
    runSingleTaskAttempt: TestAttempt;
  };
};
/** 実Lifecycleの具体Task入口だけを所有者別Module代役へ結び、完了後に必ず解除する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @boundary 保存・Lease・取消・検査は実装を使い、AI・Dockerは起動しない。
 */
export async function withTestAttempt<T>(
  attempt: TestAttempt,
  invoke: (url: string) => Promise<T>,
  source = dispatchSource,
  fixtures: ReadonlyMap<string, string> = new Map(),
): Promise<T> {
  const url = new URL(`?graph-fixture=${randomUUID()}`, dispatchUrl).href;
  const replacement = mock.module(url, {
    namedExports: {
      fixtureTaskAttempt: (input: CoordinatorSingleTaskAttemptInput) =>
        attempt(input),
    },
  });
  try {
    const call = /(?<!function )\brunCoordinatorSingleTaskAttempt(?=\()/gu;
    assert.equal([...source.matchAll(call)].length, 2);
    const fixtureSource =
      `import { fixtureTaskAttempt } from "${url}";\n` +
      source.replace(call, "fixtureTaskAttempt");
    return await invoke(sourceUrl(fixtureSource, dispatchUrl, fixtures));
  } finally {
    replacement.restore();
  }
}

/** Graph結果の代役は試験だけに置き、具体Task Module以外を置換しない。
 * @trace PRL-IT-012
 */
export async function runTestCoordinatorOperation(
  dependencies: TestExecution,
  input: Parameters<Operation>[0]["input"],
) {
  const { runSingleTaskAttempt, ...values } = dependencies;
  return withTestAttempt(runSingleTaskAttempt, async (url) => {
    const actual = (await import(
      url
    )) as typeof import("../../src/lifecycle/execution.ts");
    return actual.runCoordinatorOperation({
      ...values,
      kind: "scheduled",
      input,
    });
  });
}

/** 公開受付と同じ要求検査を使い、受付済みObjective本体へ試験用Taskを接続する。
 * @trace PRL-IT-005
 * @trace PRL-ST-004
 */
export async function runTestCoordinatorObjective(
  dependencies: TestObjective,
  request: unknown,
  signal: AbortSignal,
) {
  const accepted =
    objectiveValidation.inspectCoordinatorObjectiveRequest(request);
  if (!accepted) {
    const { runObjective } = await import("../../src/lifecycle/execution.ts");
    return runObjective(request, signal, "fixture_invalid_request");
  }
  const { runSingleTaskAttempt, ...values } = dependencies.execution;
  const {
    recoverTaskRecovery,
    resolveTaskRecoveryCorrelations,
    observeRecoveryTransition,
    resolveTaskSelections,
    createTaskExecutions,
    observeLeaseOwner,
    ...context
  } = dependencies;
  const selectionUrl = new URL(
    `../../src/lifecycle/selection.ts?objective-fixture=${randomUUID()}`,
    import.meta.url,
  ).href;
  const replacement = mock.module(selectionUrl, {
    namedExports: {
      ...selection,
      resolveObjectiveTaskSelections: (
        _root: unknown,
        request: Parameters<typeof selection.resolveObjectiveTaskSelections>[1],
      ) => {
        if (!resolveTaskSelections)
          throw Error("fixture_unconfigured_objective_selection");
        return resolveTaskSelections(request);
      },
    },
  });
  let environmentReplacement: ReturnType<typeof mock.module> | null = null;
  let ownerReplacement: ReturnType<typeof mock.module> | null = null;
  let objectiveValidationReplacement: ReturnType<typeof mock.module> | null =
    null;
  try {
    const objectiveValidationUrl = new URL(
      `../../src/lifecycle/validation.ts?objective-fixture=${randomUUID()}`,
      import.meta.url,
    ).href;
    objectiveValidationReplacement = mock.module(objectiveValidationUrl, {
      namedExports: {
        ...objectiveValidation,
        buildObjectiveTaskExecutions: (
          request: Parameters<
            typeof objectiveValidation.buildObjectiveTaskExecutions
          >[0],
          state: ProjectExecutionState,
          root: object | string,
        ) => {
          if (!createTaskExecutions)
            throw Error("fixture_unconfigured_objective_tasks");
          return buildFixtureTaskExecutions(
            createTaskExecutions(request, state),
            request,
            state,
            root,
          );
        },
      },
    });
    const ownerUrl = new URL(
      `../../src/lifecycle/host.ts?objective-fixture=${randomUUID()}`,
      import.meta.url,
    ).href;
    ownerReplacement = mock.module(ownerUrl, {
      namedExports: {
        ...kernel,
        observeObjectiveLeaseOwner: (
          owner: Parameters<typeof kernel.observeObjectiveLeaseOwner>[0],
        ) => {
          if (!observeLeaseOwner)
            throw Error("fixture_unconfigured_objective_owner");
          return observeLeaseOwner(owner);
        },
      },
    });
    const environmentUrl = new URL(
      `../../src/lifecycle/environment.ts?objective-fixture=${randomUUID()}`,
      import.meta.url,
    ).href;
    environmentReplacement = mock.module(environmentUrl, {
      namedExports: {
        ...environment,
        resolveRuntimeOwnedDockerTaskCurrentCorrelations: (
          ids: readonly string[],
        ) => {
          if (!resolveTaskRecoveryCorrelations) return null;
          return resolveTaskRecoveryCorrelations(ids);
        },
        recoverRuntimeOwnedDockerTaskForCurrentConsumer: (
          id: string,
          _root: unknown,
          signal: AbortSignal,
        ) => {
          if (!recoverTaskRecovery) return null;
          return recoverTaskRecovery(id, signal);
        },
        writeCoordinatorRecoveryDiagnostic: (
          event: CoordinatorRecoveryTransition,
        ) => {
          try {
            void Promise.resolve(
              observeRecoveryTransition?.(Object.freeze({ ...event })),
            ).catch(() => {});
          } catch {
            // 試験の任意診断は製品と同じく回復を止めない。
          }
        },
      },
    });
    return await withTestAttempt(
      runSingleTaskAttempt,
      async (url) => {
        const actual = (await import(url)) as {
          createObjectiveIntake: (
            request: typeof accepted,
            binding: string,
            principal: string,
          ) => unknown;
          blocked: (
            request: typeof accepted,
            reason: string,
          ) => ReturnType<
            typeof import("../../src/lifecycle/execution.ts").createCoordinatorObjectiveResult
          >;
          executeAcceptedCoordinatorObjective: (
            dependencies: {
              authenticatedPrincipalId: string;
              binding: {
                repositoryBindingId: string;
                workingDirectory: string;
                repositoryRoot: object | string;
              };
              intake: unknown;
              execution: CoordinatorObjectiveExecutionDependencies["execution"];
            },
            request: typeof accepted,
            signal: AbortSignal,
          ) => ReturnType<
            typeof import("../../src/lifecycle/execution.ts").runObjective
          >;
        };
        let rawBinding: unknown;
        try {
          rawBinding = context.verifyProjectBinding({
            projectId: accepted.projectId,
            milestoneId: accepted.milestoneId,
            repositoryRevision: accepted.repositoryRevision,
          });
        } catch {
          rawBinding = null;
        }
        const supplied = objectiveValidation.snapshotPlainRecord(
          rawBinding,
          new Set([
            "status",
            "repositoryBindingId",
            "repositoryRevision",
            "workingDirectory",
            "repositoryRoot",
          ]),
        );
        if (
          supplied?.status !== "verified" ||
          !objectiveValidation.validIdentity(supplied.repositoryBindingId) ||
          supplied.repositoryRevision !== accepted.repositoryRevision ||
          typeof supplied.workingDirectory !== "string" ||
          !supplied.workingDirectory ||
          supplied.repositoryRoot === null ||
          (typeof supplied.repositoryRoot !== "object" &&
            typeof supplied.repositoryRoot !== "string")
        )
          return actual.blocked(accepted, "orchestrator_binding_not_verified");
        const binding = Object.freeze({
          repositoryBindingId: supplied.repositoryBindingId,
          workingDirectory: supplied.workingDirectory,
          repositoryRoot: supplied.repositoryRoot,
        });
        const intake = actual.createObjectiveIntake(
          accepted,
          binding.repositoryBindingId,
          context.authenticatedPrincipalId,
        );
        return actual.executeAcceptedCoordinatorObjective(
          {
            authenticatedPrincipalId: context.authenticatedPrincipalId,
            binding,
            intake,
            execution: values,
          },
          accepted,
          signal,
        );
      },
      `${dispatchSource}\nexport { executeAcceptedCoordinatorObjective, createObjectiveIntake, blocked };`,
      new Map([
        ["./selection.ts", selectionUrl],
        ["./validation.ts", objectiveValidationUrl],
        ["./host.ts", ownerUrl],
        ["./environment.ts", environmentUrl],
      ]),
    );
  } finally {
    try {
      environmentReplacement?.restore();
    } finally {
      try {
        ownerReplacement?.restore();
      } finally {
        try {
          objectiveValidationReplacement?.restore();
        } finally {
          replacement.restore();
        }
      }
    }
  }
}
/**
 * 初期化済みの試験Repositoryを既存の本番保存接続へ渡す。
 * @responsibility 試験準備の不存在・読取り不明・排他解放不明を準備失敗として保持する。
 * @trace PRL-IT-005
 * @precondition 呼出し元が同じ試験Rootの初期化と清掃を所有する。
 * @stimulus 既存EM Readerでexecution区画を読む。
 * @observation Readerの状態と解放確認を得る。
 * @oracle 不存在・不明を初期化済みへ補完しない。
 * @cleanup 生成物は作らず、呼出し元hookがRootを回収する。
 * @boundary 試験準備からEM読取りとCoordinator保存接続。
 */
export function createTestPersistence(root: string, binding: string) {
  const observed = readState(
    verifyRuntimePersistenceRepository(root),
    binding,
    "execution",
  );
  if (observed.reason === "orchestrator_snapshot_lock_release_unconfirmed")
    throw new Error("orchestrator_snapshot_lock_release_unconfirmed");
  if (observed.status !== "completed" || observed.value === null)
    throw new Error("orchestrator_snapshot_not_initialized");
  return Object.freeze({
    workingDirectory: root,
    repository: verifyRuntimePersistenceRepository(root),
    repositoryBindingId: binding,
    intake: undefined,
  });
}

/**
 * EMのProject読取りへ試験の対象を直接渡す。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 既存EMのProject Readerへ入力を渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験からEM完成読取り。
 */
export function readCoordinatorState(
  root: string,
  binding: string,
  projectId: string,
) {
  const context = createTestPersistence(root, binding);
  return readProjectExecutionState(
    context.repository,
    context.repositoryBindingId,
    projectId,
  );
}
/**
 * EMのQueue読取りを試験Repositoryへ直接接続する。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus EMのreadQueueEntryへ同じIDを渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function readProjectOperationQueueState(
  root: string,
  binding: string,
  queueId: string,
) {
  const state = createTestPersistence(root, binding);
  return readQueueEntry(state.repository, state.repositoryBindingId, queueId);
}
/**
 * 試験Projectの準備とEMのQueue作成を接続する。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 必要な初期化と同じQueueをEMのcreateQueueへ渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function enqueueProjectOperation(
  root: string,
  binding: string,
  input: QueueEnqueueInput,
  initialization?: ProjectExecutionInitialization,
) {
  const ports = createTestPersistence(root, binding);
  if (
    readProjectExecutionState(
      ports.repository,
      ports.repositoryBindingId,
      input.projectId,
    ).value === null
  ) {
    const created = projectExecutionFixture({
      taskExecutionSelections: taskExecutionSelections(),
      projectId: input.projectId,
      milestoneId: input.milestoneId,
      repositoryRevision: input.repositoryRevision,
      maximumConcurrency: 1,
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
      ownerGeneration: "fixture-owner",
    });
    if (created.status !== "completed")
      throw new Error("snapshot_fixture_state_failed");
    return createQueue(ports.repository, binding, {
      kind: "scheduled",
      input: [input, initialization ?? initialExecutionInput(created.state)],
    });
  }
  const fresh = createTestPersistence(root, binding);
  return createQueue(fresh.repository, binding, {
    kind: "scheduled",
    input: initialization ? [input, initialization] : [input],
  });
}
/**
 * EMのfresh選択とCoordinatorの優先方針を直接接続する。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus EMの短期Writer内で既存の優先方針を評価する。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験からEM正式Queue選択とCoordinator優先方針。
 */
export function selectNextProjectOperation(root: string, binding: string) {
  const state = createTestPersistence(root, binding);
  return selectQueueEntry(
    state.repository,
    state.repositoryBindingId,
    chooseCoordinatorQueueOperation,
  );
}
/**
 * EMのQueue回復確定を試験Repositoryへ直接接続する。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus EMのupdateQueueへ元世代と回復IDを渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から新版Port。
 */
export function settleProjectOperationQueueRecovery(
  root: string,
  binding: string,
  queueId: string,
  expectedGeneration: number,
  recoveryId: string,
) {
  const state = createTestPersistence(root, binding);
  return updateQueue(state.repository, binding, {
    kind: "recovery",
    input: [queueId, expectedGeneration, recoveryId],
  });
}
/**
 * 既存の実Lease照合付きQueue更新を試験から呼ぶ。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 元の対象・世代・更新要求を具体保存へ渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から実Lease照合付き保存。
 */
export function updateProjectOperationQueueState(
  root: string,
  binding: string,
  ...args: [
    queueId: string,
    expectedGeneration: number,
    next: Parameters<typeof kernel.updateCoordinatorQueue>[3],
  ]
) {
  return kernel.updateCoordinatorQueue(
    createTestPersistence(root, binding),
    ...args,
  );
}
/**
 * 検証済みの試験Repositoryから具体Lease取得へ接続する。
 * @responsibility 旧保存方式を使わず既存の検証入力を搬送する。
 * @trace PRL-IT-005
 * @precondition Repositoryは試験側で明示初期化済み。
 * @stimulus 元の作業Directory・bindingとLease対象を具体取得へ渡す。
 * @observation 返された保存結果を観測する。
 * @oracle 呼出し元のassertionで元の成立条件を判定する。
 * @cleanup Repository全体を試験hookで回収する。
 * @boundary PRL-IT-005=Direct Boundary: 試験から具体Lease取得と既存実Lock。
 */
export function acquireCoordinatorLease(
  root: string,
  binding: string,
  projectId: string,
  queueId: string,
  kind: LeaseKind,
) {
  const state = createTestPersistence(root, binding);
  return kernel.acquireCoordinatorSnapshotLease(
    state.workingDirectory,
    state.repositoryBindingId,
    projectId,
    queueId,
    kind,
  );
}

/**
 * 明示した再試行・差替え後の試験Queueを次の実行に備える。
 * @responsibility Classifierを作らず実EM規則へ固定刺激を渡す。
 * @trace PRL-IT-005
 * @precondition 呼出し元が失敗Taskと解放済みQueueを準備している。
 * @stimulus task_retry又はtask_replanの明示要求を保存する。
 * @observation 元世代の保存結果とQueue更新を得る。
 * @oracle 保存拒否ならQueueを進めず、EMの不明結果を補完しない。
 * @cleanup 呼出し元hookが生成Repositoryを回収する。
 * @boundary 試験準備とEMの状態・Queue完成操作。
 */
export function updateTestTaskAndQueue(
  input: Readonly<{
    workingDirectory: string;
    repositoryBindingId: string;
    projectId: string;
    milestoneId: string;
    queueId: string;
    maximumReplans: number;
  }>,
  mutation:
    | Omit<
        Extract<
          Parameters<typeof saveProjectExecutionState>[2],
          { kind: "task_retry" }
        >,
        "projectId" | "maximumReplans"
      >
    | Omit<
        Extract<
          Parameters<typeof saveProjectExecutionState>[2],
          { kind: "task_replan" }
        >,
        "projectId" | "maximumReplans"
      >,
) {
  const {
    workingDirectory: root,
    repositoryBindingId: binding,
    queueId,
  } = input;
  const request = {
    ...mutation,
    projectId: input.projectId,
    maximumReplans: input.maximumReplans,
  };
  const repository = verifyRuntimePersistenceRepository(root);
  const project = readProjectExecutionState(
    repository,
    binding,
    request.projectId,
  );
  const queue = readQueueEntry(repository, binding, queueId);
  if (
    project.status !== "completed" ||
    !project.value ||
    queue.status !== "completed"
  )
    throw new Error("fixture_state_unavailable");
  const saved = saveProjectExecutionState(
    repository,
    binding,
    request,
    project.value.generation,
  );
  if (saved.status === "completed") {
    const updated = updateQueue(repository, binding, {
      kind: "operation",
      input: [
        queueId,
        queue.value.generation,
        {
          state: "queued",
          leasePresent: false,
          leaseIsNull: true,
          resumeCondition:
            request.kind === "task_retry"
              ? "same_plan_retry"
              : "partial_replan_applied",
          resultReference:
            request.kind === "task_retry"
              ? request.taskId
              : request.failedTaskId,
        },
        {
          borrowActiveLease: () => undefined,
          isActiveLeaseObserved: () => false,
        },
      ],
    });
    if (updated.status !== "completed") throw new Error(updated.reason);
  }
  return saved;
}
