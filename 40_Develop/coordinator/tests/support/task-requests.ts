/**
 * 既存単発受付ITで選定・改訂版観測・用途実行・回復・Owner観測の五境界を所有者ごとに差し替える。
 * @responsibility 不変Sourceを一回取得しMap・保存・故障注入・実行通知は各試験で独立させる。
 * @trace PRL-IT-013
 * @boundary 既存の非公開受付ITだけ。製品Hook又は正式Package APIではない。
 * @cleanup closeの元pending終了後に当該所有者だけのModule差替えを解除する。
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { registerHooks, stripTypeScriptTypes } from "node:module";
import { mock } from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../docker-isolation/tests/support/source-declaration.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import * as versionControl from "../../../version-control/src/index.ts";
import * as selection from "../../src/lifecycle/selection.ts";
import type * as recovery from "../../src/lifecycle/environment.ts";
import type * as kernel from "../../src/lifecycle/host.ts";
import type { openExecutionHost } from "../../src/lifecycle/environment.ts";
import type {
  BorrowedExecutionTarget,
  PreparationInput,
  SingleTaskCommand,
  SingleTaskExecution,
  SingleTaskOutcome,
} from "../../src/lifecycle/types.ts";
import type { SingleTaskRecord } from "../../../execution-model/src/index.ts";
import type {
  CompletionResult,
  ProcessStartedNotice,
} from "../../../executor/src/index.ts";
import type { ProviderBoundaryDiagnosticNotice } from "../../src/lifecycle/validation.ts";
import type {
  HostOperationRecording,
  ProductionOperationFailure,
} from "../../src/lifecycle/host.ts";
import type { ProviderExecutionRecording } from "../../src/lifecycle/types.ts";
import type {
  AdviceProviderInput,
  cancelRuntimeOwnedCoordinatorTask,
  createCoordinatorTaskRequests,
  Operation,
  recoverSingleTaskOperation,
  runCoordinatorSingleTaskAttempt,
  runRepositoryAdvice,
  startRuntimeOwnedCoordinatorTask,
  TaskCompletionRecord,
} from "../../src/lifecycle/execution.ts";
import type {
  CoordinatorAiRequestInput,
  CoordinatorAiRequestResult,
  ProviderAdviceRuntimeResult,
} from "../../src/lifecycle/types.ts";
import type { ProviderAdviceExecutionInput } from "../../src/lifecycle/types.ts";

export const dispatchUrl = new URL(
  "../../src/lifecycle/execution.ts",
  import.meta.url,
);
export const dispatchSource = stripTypeScriptTypes(
  fs.readFileSync(dispatchUrl, "utf8"),
);

/** Task／Adviceの実Host作成入口を外部起動・保存の代役へ束縛する。 @trace ERB-UT-023 */
export function executionHostCreationFixture(
  purpose: "task" | "advice",
  boundaries: Record<string, unknown>,
) {
  const shared = sourceDeclaration(
    fs.readFileSync(
      new URL("../../src/lifecycle/environment.ts", import.meta.url),
      "utf8",
    ),
    "openExecutionHost",
  );
  const source = dispatchSource;
  type CreateTaskOperation = NonNullable<
    TaskFixtureDependencies["createOperation"]
  >;
  if (purpose === "advice") {
    const open = runInNewContext(
      `${shared};${sourceDeclaration(source, "openAdviceOperation")};openAdviceOperation`,
      boundaries,
    ) as (
      context: Readonly<{
        repository: unknown;
        repositoryRoot: unknown;
        recordingCurrent: unknown;
      }>,
      ...args: [AbortSignal, () => boolean]
    ) => ReturnType<CreateTaskOperation>;
    return ((signal, current) =>
      open(
        {
          repository: boundaries.repository,
          repositoryRoot: boundaries.repositoryRoot,
          recordingCurrent: boundaries.recordingCurrent,
        },
        signal,
        current,
      )) satisfies CreateTaskOperation;
  }
  return runInNewContext(
    `${shared};${sourceDeclaration(source, "openTaskOperation")};openTaskOperation`,
    boundaries,
  ) as CreateTaskOperation;
}

/** 取得済み実Sourceのimport所在だけを絶対URLへ固定する。
 * @responsibility 実装本文又は拒否条件を改変しない。
 * @trace PRL-IT-013
 */
export function sourceUrl(
  source: string,
  origin: URL,
  replacements: ReadonlyMap<string, string>,
) {
  const used = new Set<string>();
  const absolute = source.replace(
    /(from\s+)(["'])([^"']+)\2/gu,
    (match, prefix, quote, specifier: string) => {
      const replacement = replacements.get(specifier);
      if (replacement) {
        assert.equal(used.has(specifier), false);
        used.add(specifier);
        return `${prefix}${quote}${replacement}${quote}`;
      }
      return specifier.startsWith(".")
        ? `${prefix}${quote}${new URL(specifier, origin).href}${quote}`
        : match;
    },
  );
  assert.deepEqual([...used].sort(), [...replacements.keys()].sort());
  return `data:text/javascript;base64,${Buffer.from(absolute).toString("base64")}`;
}

/** 助言の失敗注入に使うCaseごとの技術境界。 @trace ERB-UT-023 */
export type TestAdviceDependencies = NonNullable<
  Parameters<typeof runRepositoryAdvice>[3]
> &
  Readonly<{
    createOperation: (
      signal: AbortSignal,
      current: () => boolean,
    ) => Promise<
      Extract<
        Awaited<ReturnType<typeof openExecutionHost>>,
        { status: "opened" }
      >["operation"]
    >;
    bindRepository: (
      managementCapability: unknown,
    ) => Readonly<{ operationId: string }> | null;
    observeProviderHome: typeof import("../../src/lifecycle/environment.ts").inspectRuntimeOwnedWindowsProviderHomeCandidate;
    preflightSelections: typeof selection.preflightRuntimeOwnedDelegationSelections;
    issuePacket: typeof selection.issueRuntimeOwnedProviderAdvicePacket;
    revokePacket: typeof selection.revokeRuntimeOwnedProviderAdvicePacket;
    startProcess: typeof import("../../src/lifecycle/execution.ts").startRuntimeOwnedDockerProcessController;
    cancelProcess: typeof recovery.cancelRuntimeOwnedExecutorAttempt;
    completeHostOperation: HostCompletionFixture;
    abandonDockerRecovery: (
      capability: unknown,
      management: unknown,
    ) => boolean;
    abandonOperation: typeof import("../../src/lifecycle/host.ts").abandonOwnedHostOperationGenerationLock;
    poisonAfterCleanupUnknown: () => void;
  }>;

type AdviceFixtureApi = Pick<
  typeof import("../../src/lifecycle/execution.ts"),
  "classifyProviderAdviceHostFailure"
> & {
  executeProviderAdvice(
    dependencies: TestAdviceDependencies,
    ...args: Parameters<TestAdviceRuntime>
  ): ReturnType<TestAdviceRuntime>;
};

type TestAdviceRuntime = (
  plan: ProviderAdviceExecutionInput,
  signal: AbortSignal,
) => Promise<ProviderAdviceRuntimeResult>;

type TestAdviceDispatch = (
  input: AdviceProviderInput,
  signal: AbortSignal,
) => Promise<unknown>;

const adviceSourceUrl = new URL(
  "../../src/lifecycle/execution.ts",
  import.meta.url,
);
const adviceSource = fs.readFileSync(adviceSourceUrl, "utf8");
const retainHostOperationSource = sourceDeclaration(
  fs.readFileSync(
    new URL("../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  ),
  "retainRuntimeOwnedHostOperation",
);

/**
 * 実行本文だけを試験代役へ束縛し、結果と私有失敗分類を同じModuleで保持する。
 * @trace ERB-UT-023
 * @boundary 本番側の操作差替え口はなく、代役は各試験呼出しだけに有効。
 */
function adviceFixtureSource() {
  const execution = sourceDeclaration(adviceSource, "executeProviderAdvice");
  return `${stripTypeScriptTypes(adviceSource)}
export { executeWithFixture as executeProviderAdvice };
function executeWithFixture(dependencies, plan, signal) {
  const openAdviceOperation = (_context, ...args) => dependencies.createOperation(...args);
  const bindRuntimeOwnedRepositoryOperation = (management) => dependencies.bindRepository(management);
  const inspectRuntimeOwnedWindowsProviderHomeCandidate = dependencies.observeProviderHome;
  const preflightRuntimeOwnedDelegationSelections = dependencies.preflightSelections;
  const issueRuntimeOwnedProviderAdvicePacket = dependencies.issuePacket;
  const revokeRuntimeOwnedProviderAdvicePacket = dependencies.revokePacket;
  const startRuntimeOwnedDockerProcessController = dependencies.startProcess;
  const cancelRuntimeOwnedExecutorAttempt = dependencies.cancelProcess;
  const completeRuntimeOwnedHostOperation = dependencies.completeHostOperation;
  const abandonRuntimeOwnedAttemptRecovery = dependencies.abandonDockerRecovery;
  const abandonOwnedHostOperationGenerationLock = dependencies.abandonOperation;
  const poisonRuntimeProcessAfterCleanupUnknown = dependencies.poisonAfterCleanupUnknown;
  ${retainHostOperationSource}
  ${execution}
  return executeProviderAdvice(dependencies, plan, signal);
}`;
}

/** 同じ助言実行本文をCaseごとの代役で実行する。 @trace ERB-UT-023 */
export async function loadAdviceRuntimeFixture(): Promise<AdviceFixtureApi> {
  return (await import(
    sourceUrl(adviceFixtureSource(), adviceSourceUrl, new Map())
  )) as AdviceFixtureApi;
}

/**
 * 受付・配送・結果の実本文を、各試験で限った通信応答に接続する。
 * @trace ARCH-000015
 * @boundary 本番の入力検査・結果判定は用い、Providerを呼ぶ箇所だけを試験値へ接続する。
 */
export async function loadAdviceDispatchFixture() {
  const declaration = (name: string) => sourceDeclaration(adviceSource, name);
  const source = `${stripTypeScriptTypes(adviceSource)}
export { dispatchWithFixture as dispatchAdviceRequest, requestWithFixture as executeAdviceRequest, acceptedWithFixture as executeAcceptedAdviceInput };
function acceptedWithFixture(runtime, input, signal) {
  const executeProviderAdvice = (invoke, plan, cancellation) => invoke(plan, cancellation);
  ${declaration("executeAcceptedAdviceInput")}
  return executeAcceptedAdviceInput(runtime, input, signal);
}
function dispatchWithFixture(deliver, input, signal) {
  const executeAcceptedAdviceInput = (invoke, accepted, cancellation) => invoke(accepted, cancellation);
  const finishAdvice = (result) => result;
  ${declaration("dispatchAdviceRequest")}
  return dispatchAdviceRequest(deliver, input, signal);
}
function requestWithFixture(repository, deliver, request, signal) {
  const dispatchAdviceRequest = dispatchWithFixture;
  const finishAdvice = (result) => result;
  ${declaration("executeAdviceRequest")}
  return executeAdviceRequest(repository, deliver, request, signal);
}`;
  return (await import(sourceUrl(source, adviceSourceUrl, new Map()))) as {
    executeAcceptedAdviceInput(
      runtime: TestAdviceRuntime,
      input: AdviceProviderInput,
      signal: AbortSignal,
    ): Promise<ProviderAdviceRuntimeResult | null>;
    dispatchAdviceRequest(
      deliver: TestAdviceDispatch,
      input: AdviceProviderInput,
      signal: AbortSignal,
    ): Promise<CoordinatorAiRequestResult>;
    executeAdviceRequest(
      repository: Parameters<typeof runRepositoryAdvice>[0],
      deliver: TestAdviceDispatch,
      request: CoordinatorAiRequestInput,
      signal: AbortSignal,
    ): Promise<CoordinatorAiRequestResult>;
  };
}

export type TestTaskAttemptDependencies = Readonly<{
  startTask: (
    ...args: Parameters<typeof startRuntimeOwnedCoordinatorTask>
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
}>;

type TestTaskAttempt = (
  dependencies: TestTaskAttemptDependencies,
  ...args: Parameters<typeof runCoordinatorSingleTaskAttempt>
) => ReturnType<typeof runCoordinatorSingleTaskAttempt>;

/** 製品の開始・取消二接続だけを試験入力に置換し、受付と完了の本体を使う。
 * @trace PRL-IT-005
 * @boundary 置換は試験Module内。依存はCaseごとの引数で渡す。
 */
export const runTestSingleTaskAttempt = await (async () => {
  let source = dispatchSource;
  for (const [before, after] of [
    [
      "function runCoordinatorSingleTaskAttempt(",
      "function runCoordinatorSingleTaskAttempt(fixture, ",
    ],
    [
      "rawStarted = startRuntimeOwnedCoordinatorTask(",
      "rawStarted = fixture.startTask(",
    ],
    ["\n    cancelRuntimeOwnedCoordinatorTask,", "\n    fixture.cancelTask,"],
  ] as const) {
    assert.equal(source.split(before).length, 2, before);
    source = source.replace(before, after);
  }
  const module = (await import(sourceUrl(source, dispatchUrl, new Map()))) as {
    runCoordinatorSingleTaskAttempt: TestTaskAttempt;
  };
  return module.runCoordinatorSingleTaskAttempt;
})();

type RuntimeRecord = Readonly<Record<string, unknown>>;
type Provider = "codex" | "claude";
type TaskRole = "executor" | "reviewer";

/** 設計上の順序・後条件を記録する試験ラベル。製品の追加状態ではない。 @trace ERB-IT-003 */
type TaskTraceState =
  | "STATE-ADMISSION"
  | "STATE-OPERATION-ACQUIRING"
  | "STATE-OPERATION-READY"
  | "STATE-TASK-AUTHORIZED"
  | "STATE-EXECUTOR-CLEAN"
  | "STATE-CANDIDATE-CAPTURED"
  | "STATE-REVIEWER-CLEAN"
  | "STATE-REMEDIATION-AUTHORIZED"
  | "STATE-REMEDIATION-EXECUTOR-CLEAN"
  | "STATE-REMEDIATION-CANDIDATE-CAPTURED"
  | "STATE-REMEDIATION-REVIEWER-CLEAN"
  | "STATE-HOST-CLEAN"
  | "STATE-RESULT-PUBLISHED"
  | "STATE-BLOCKED-CLEAN"
  | "STATE-PROCESS-RESTART-REQUIRED"
  | "STATE-RECOVERY-REQUIRED"
  | "STATE-OPERATOR-TRANSFER-REQUIRED";

/** 観測した終端結果を既存の設計追跡ラベルへ分類する。 @trace PRL-IT-012 */
export function traceTaskTerminalState(
  result: TaskCompletionRecord,
): TaskTraceState {
  const exactRecoveryAvailable =
    result.hostRecoveryId !== null ||
    result.dockerRecoveryIds.length > 0 ||
    result.candidateRecoveryId !== null ||
    result.candidateStoreRecoveryId !== null;
  if (
    result.manualRecoveryRequired === true ||
    result.cleanupConfirmed !== true ||
    exactRecoveryAvailable
  )
    return exactRecoveryAvailable
      ? ("STATE-RECOVERY-REQUIRED" as const)
      : ("STATE-OPERATOR-TRANSFER-REQUIRED" as const);
  if (result.processRestartRequired === true)
    return "STATE-PROCESS-RESTART-REQUIRED" as const;
  if (result.status === "completed") return "STATE-RESULT-PUBLISHED" as const;
  return "STATE-BLOCKED-CLEAN" as const;
}

type HostCompletionFixture = (
  target: Parameters<typeof recovery.completeRuntimeOwnedHostOperation>[0],
  observeHostCleaned?: () => void,
) => ReturnType<typeof recovery.completeRuntimeOwnedHostOperation>;

/** Taskの固定技術操作を試験内だけで代替する。 @trace ERB-IT-003 */
export type TaskFixtureDependencies = Readonly<{
  observeLifecycleState?: (state: TaskTraceState) => void;
  reportProviderBoundaryDiagnostic?: (
    notice: ProviderBoundaryDiagnosticNotice,
  ) => void | Promise<void>;
  reportSelectionNotice?: (notice: RuntimeRecord) => void | Promise<void>;
  poisonProcessAfterCleanupUnknown?: () => void;
  isProcessPoisoned?: () => boolean;
  projectReviewerReadContent: (
    workspaceCapability: object,
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
  ) => RuntimeRecord | null;
  registerReviewFindings?: (
    capability: object,
    result: CompletionResult<"attempt">,
  ) => object | null;
  abandonDockerRecovery?: (
    capability: object,
    managementCapability: unknown,
  ) => boolean;
  isolatedCancellationAckTimeoutMs?: number;
  inspectRepository: (repositoryRoot: string) => RuntimeRecord | null;
  createOperation: (
    signal: AbortSignal,
    verifyBoundary: () => boolean,
    hostInput?: HostOperationRecording,
  ) => Operation | Promise<Operation>;
  classifyOperationCreationFailure: (
    error: unknown,
  ) => ProductionOperationFailure | null;
  abandonOperation: (managementCapability: object) => Promise<unknown>;
  bindRepository: (
    managementCapability: object,
    repositoryRoot: string,
  ) => RuntimeRecord | null;
  materializeWorkspace: (
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
    borrowedTarget?: BorrowedExecutionTarget,
  ) => RuntimeRecord | null;
  preflightSelections: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  observeProviderHome: (provider: Provider) => RuntimeRecord;
  resolveExternalSendPolicy: (
    managementCapability: object,
    repositoryBindingCapability: object,
  ) => RuntimeRecord | null;
  prepareDockerRecoveryState: (repositoryRoot: string) => unknown;
  issueTaskPacket: (
    managementCapability: object,
    repositoryBindingCapability: object,
    provider: Provider,
    taskRole: TaskRole,
    taskAttempt: 0 | 1,
    externalSendPolicyCapability: object,
    remediationCapability: object | null,
    packet: RuntimeRecord,
  ) => RuntimeRecord | null;
  revokeTaskPacket: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  startProcess: (
    provider: Provider,
    input: PreparationInput,
    registerRecoveryHandoff: (
      recoveryCapability: unknown,
      recoveryId: unknown,
    ) => boolean,
    observeProviderStarted:
      | ((notice: ProcessStartedNotice) => void | Promise<void>)
      | undefined,
    executionMetadata: Readonly<Record<string, string>>,
    recordings: ProviderExecutionRecording[],
  ) => RuntimeRecord;
  cancelProcess: (
    controlCapability: object,
    managementCapability: object,
  ) => Promise<unknown>;
  captureCandidate: (
    workspaceCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    allowedPaths: readonly string[],
  ) => RuntimeRecord | null;
  verifyCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
  ) => RuntimeRecord | null;
  completeHostOperation: HostCompletionFixture;
}>;

/**
 * 本番Controllerの固定呼出しだけを、試験ごとの代役へ結ぶ。
 * @trace ERB-IT-003
 * @boundary 置換回数が変わった場合は試験用接続を再確認し、黙って本番操作を実行しない。
 */
function taskRuntimeFixtureSource(origin: URL) {
  const source = fs.readFileSync(origin, "utf8");
  let body = [
    "reportTaskDiagnostic",
    "requestControlCancellation",
    "poisonRuntimeProcess",
    "reportCandidateValidationFailure",
    "reportTaskStage",
    "executeStage",
    "runCoordinatorTaskCore",
    "runCoordinatorTask",
    "retainRuntimeRecoveryState",
    "startTask",
    "cancelTask",
  ]
    .map((name) => sourceDeclaration(source, name))
    .concat(retainHostOperationSource)
    .join("\n");
  for (const [operation, fixture, count] of [
    ["cancelRuntimeOwnedExecutorAttempt", "cancelProcess", 2],
    ["revokeRuntimeOwnedProviderTaskPacket", "revokeTaskPacket", 1],
    ["preflightRuntimeOwnedDelegationSelections", "preflightSelections", 2],
    [
      "inspectRuntimeOwnedWindowsProviderHomeCandidate",
      "observeProviderHome",
      1,
    ],
    ["issueRuntimeOwnedProviderTaskPacket", "issueTaskPacket", 1],
    ["startRuntimeOwnedDockerProcessController", "startProcess", 1],
    ["inspectRepositoryObjectFormatCandidate", "inspectRepository", 2],
    ["inspectRuntimeOwnedDockerTaskAdmission", "prepareDockerRecoveryState", 1],
    ["openTaskOperation", "createOperation", 1],
    ["bindRuntimeOwnedRepositoryOperation", "bindRepository", 1],
    ["resolveRuntimeOwnedExternalSendPolicy", "resolveExternalSendPolicy", 1],
    ["bindRuntimeOwnedExecutionSnapshot", "materializeWorkspace", 1],
    ["captureExecutionChangeSnapshot", "captureCandidate", 2],
    ["verifyExecutionChangeSnapshot", "verifyCandidate", 2],
    ["productionOperationFailure", "classifyOperationCreationFailure", 1],
    ["abandonOwnedHostOperationGenerationLock", "abandonOperation", 1],
  ] as const) {
    const call = new RegExp(`(?<!function )\\b${operation}(?=\\()`, "gu");
    assert.equal([...body.matchAll(call)].length, count, operation);
    body = body.replace(call, `dependencies.${fixture}`);
  }
  // 実製品に存在しない観測・短縮時間は、この射影内だけに戻す。
  for (const [operation, fixture] of [
    [
      "reportProviderBoundaryDiagnostic(notice)",
      "dependencies.reportProviderBoundaryDiagnostic?.(notice)",
    ],
    ["reportSelectionNotice(", "dependencies.reportSelectionNotice?.("],
    [
      "poisonRuntimeProcessAfterCleanupUnknown()",
      "dependencies.poisonProcessAfterCleanupUnknown?.()",
    ],
    [
      "registerRuntimeOwnedReviewFindings(",
      "dependencies.registerReviewFindings?.(",
    ],
    [
      "abandonRuntimeOwnedAttemptRecovery(",
      "dependencies.abandonDockerRecovery?.(",
    ],
    [
      "control.processPoisoned ||= isRuntimeProcessPoisoned();",
      "control.processPoisoned ||= dependencies.isProcessPoisoned?.() === true;",
    ],
    [
      "const timeoutMs = PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS;",
      `const timeout = dependencies.isolatedCancellationAckTimeoutMs;
      const timeoutMs = Number.isSafeInteger(timeout) && Number(timeout) > 0 ? Number(timeout) : PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS;`,
    ],
  ] as const) {
    assert.equal(body.split(operation).length, 2, operation);
    body = body.replace(operation, fixture);
  }
  // Source上の実処置を起点に観測し、存在しない製品状態を作らない。
  for (const [anchor, state, after] of [
    ["controls.set(controlCapability, control);", "STATE-ADMISSION", false],
    ["let operation", "STATE-OPERATION-ACQUIRING", false],
    [
      "control.hostRecoveryId = operation.hostRecoveryId;",
      "STATE-OPERATION-READY",
      true,
    ],
    ["const executor = await executeStage(", "STATE-TASK-AUTHORIZED", false],
    [
      "return candidateNotIssued(executor);\n    }",
      "STATE-EXECUTOR-CLEAN",
      true,
    ],
    [
      "reportTaskStage(\n      operation,\n      control.recoveryCorrelationId,\n      executor.provider,\n      0,",
      "STATE-CANDIDATE-CAPTURED",
      false,
    ],
    ["let reviewerResult", "STATE-REVIEWER-CLEAN", false],
    [
      "const remediationCapability = objectCapability(",
      "STATE-REMEDIATION-AUTHORIZED",
      false,
    ],
    ["remediationPerformed = true;", "STATE-REMEDIATION-EXECUTOR-CLEAN", false],
    [
      "reportTaskStage(\n        operation,\n        control.recoveryCorrelationId,\n        remediation.provider,\n        1,",
      "STATE-REMEDIATION-CANDIDATE-CAPTURED",
      false,
    ],
    [
      "\n      reviewerResult = reviewer.normalizedResult",
      "STATE-REMEDIATION-REVIEWER-CLEAN",
      false,
    ],
  ] as const) {
    const announce = `notify(control, "${state}");`;
    assert.equal(body.split(anchor).length, 2, anchor);
    body = body.replace(
      anchor,
      after
        ? `${anchor}\n${announce}`
        : anchor.startsWith("\n")
          ? `\n${announce}${anchor}`
          : `${announce}\n${anchor}`,
    );
  }
  for (const [operation, fixture] of [
    [
      "await completeRuntimeOwnedHostOperation(control)",
      `await dependencies.completeHostOperation(control, () => {
        const previous = observedStages.get(control);
        if (result.status === "completed" &&
            (previous === "STATE-REVIEWER-CLEAN" || previous === "STATE-REMEDIATION-REVIEWER-CLEAN"))
          notify(control, "STATE-HOST-CLEAN");
      })`,
    ],
    [
      "controls.delete(controlCapability);\n      }\n      return result;",
      "controls.delete(controlCapability);\n      }\n      notify(control, traceTaskTerminalState(result));\n      return result;",
    ],
  ] as const) {
    assert.equal(body.split(operation).length, 2, operation);
    body = body.replace(operation, fixture);
  }
  return `${stripTypeScriptTypes(source)}
export function bindTaskFixture(dependencies, traceTaskTerminalState) {
  const controls = new WeakMap();
  const observedStages = new WeakMap();
  const projectReviewerReadContent = dependencies.projectReviewerReadContent;
  const notify = (control, next) => {
    if (observedStages.get(control) === next) return;
    observedStages.set(control, next);
    try { void Promise.resolve(dependencies.observeLifecycleState?.(next)).catch(() => {}); } catch {}
  };
  ${body}
  return Object.freeze({ start: startTask.bind(undefined, controls), cancel: cancelTask.bind(undefined, controls) });
}`;
}

/**
 * 同じControllerの開始・取消を試験内だけで個別の状態へ接続する。
 * @responsibility 不変SourceはSuiteで一度だけ組み立て、制御参照と依存代役はCaseごとに分離する。
 * @trace ERB-IT-003
 * @boundary 試験内でだけ内部操作を参照し、製品の制御参照に登録しない。
 */
export async function loadTaskRuntimeFixture() {
  const origin = new URL("?task-runtime-fixture", dispatchUrl);
  const hook = registerHooks({
    load(url, context, nextLoad) {
      if (url !== origin.href) return nextLoad(url, context);
      return {
        shortCircuit: true,
        format: "module",
        source: taskRuntimeFixtureSource(origin),
      };
    },
  });
  type FixtureApi = {
    bindTaskFixture(
      dependencies: TaskFixtureDependencies,
      traceTerminal: typeof traceTaskTerminalState,
    ): Readonly<{
      start: typeof startRuntimeOwnedCoordinatorTask;
      cancel: typeof cancelRuntimeOwnedCoordinatorTask;
    }>;
  };
  let api: FixtureApi;
  try {
    api = (await import(origin.href)) as FixtureApi;
  } finally {
    hook.deregister();
  }
  return (dependencies: TaskFixtureDependencies) =>
    api.bindTaskFixture(Object.freeze(dependencies), traceTaskTerminalState);
}

/**
 * 所有領域作成の失敗を、試験だけの実Moduleとその分類器へ登録する。
 * @responsibility 本番のエラー記録を変更せず、同じ失敗分類をTaskとAdviceで検証する。
 * @trace ERB-UT-023
 * @boundary 試験用URLと、そのAdviceの直接importだけを置換する。
 */
export async function loadOperationFailureFixture() {
  type OperationModule = typeof import("../../src/lifecycle/host.ts");
  type DirectoryFailure = NonNullable<
    ReturnType<
      OperationModule["classifyOwnedOperationDirectoryCreationFailure"]
    >
  >;
  const operationUrl = new URL(
    "../../src/lifecycle/host.ts?directory-failure-fixture",
    import.meta.url,
  );
  const adviceUrl = new URL(
    "../../src/lifecycle/execution.ts?directory-failure-fixture",
    import.meta.url,
  );
  const hook = registerHooks({
    resolve(specifier, context, nextResolve) {
      if (context.parentURL === adviceUrl.href && specifier === "./host.ts")
        return nextResolve(operationUrl.href, context);
      return nextResolve(specifier, context);
    },
    load(url, context, nextLoad) {
      if (url === adviceUrl.href)
        return {
          shortCircuit: true,
          format: "module",
          source: adviceFixtureSource(),
        };
      if (url !== operationUrl.href) return nextLoad(url, context);
      return {
        shortCircuit: true,
        format: "module-typescript",
        source: `${fs.readFileSync(operationUrl, "utf8")}\nexport { throwOwnedOperationDirectoryCreationFailure };`,
      };
    },
  });
  try {
    const operation = (await import(operationUrl.href)) as OperationModule & {
      throwOwnedOperationDirectoryCreationFailure(
        cause: unknown,
        details: DirectoryFailure,
      ): never;
    };
    const advice = (await import(adviceUrl.href)) as AdviceFixtureApi;
    return { operation, advice };
  } finally {
    hook.deregister();
  }
}

/** 実Writer・Lease・受付を維持し選定・改訂版観測・用途実行・回復・Owner観測を固有Moduleへ結合する。
 * @responsibility 同じ受付と取消・待機を実行し製品への注入関数を作らない。
 * @trace PRL-IT-013
 */
export async function createTaskRequestsFixture(
  dependencies: Omit<
    Parameters<typeof createCoordinatorTaskRequests>[0],
    "rootCapability" | "consumer"
  > &
    Readonly<{
      resolveSelection: (
        command: Parameters<typeof selection.resolveSingleTaskSelection>[1],
      ) => ReturnType<typeof selection.resolveSingleTaskSelection>;
      observeRevision: () => string | null;
      observeLeaseOwner?: (
        owner: Parameters<typeof kernel.observeLeaseOwner>[0],
      ) => unknown;
      recover?: (
        record: Parameters<typeof recoverSingleTaskOperation>[1],
      ) => ReturnType<typeof recoverSingleTaskOperation>;
    }>,
  execution: (
    command: SingleTaskCommand,
    execution: SingleTaskExecution,
    signal: AbortSignal,
    started: () => Promise<void>,
    operationCreated: (
      operation: NonNullable<SingleTaskRecord["adviceOperation"]>,
    ) => Promise<void>,
  ) => Promise<SingleTaskOutcome>,
) {
  const repository = getRepository(dependencies.root);
  assert.equal(repository.status, "completed");
  if (repository.status !== "completed")
    throw Error("fixture_repository_unverified");
  const executionUrl = new URL(
    `../../src/lifecycle/execution.ts?single-task-fixture=${randomUUID()}`,
    import.meta.url,
  ).href;
  const replacement = mock.module(executionUrl, {
    namedExports: {
      executeFixtureSingleTask: (
        context: Readonly<{
          rootCapability: unknown;
          root: unknown;
          authorize: unknown;
          consumer: unknown;
        }>,
        ...args: Parameters<typeof execution>
      ) => {
        assert.equal(context.rootCapability, repository.capability);
        assert.equal(context.root, dependencies.root);
        assert.equal(context.authorize, dependencies.authorize);
        assert.equal(context.consumer, "workbench");
        return execution(...args);
      },
    },
  });
  const replacements = [replacement];
  try {
    const selectionUrl = new URL(
      `../../src/lifecycle/selection.ts?single-task-fixture=${randomUUID()}`,
      import.meta.url,
    ).href;
    replacements.push(
      mock.module(selectionUrl, {
        namedExports: {
          ...selection,
          resolveSingleTaskSelection: (
            _root: unknown,
            command: Parameters<typeof selection.resolveSingleTaskSelection>[1],
          ) => {
            assert.equal(_root, repository.capability);
            return dependencies.resolveSelection(command);
          },
        },
      }),
    );
    const revisionUrl = new URL(
      `../../../version-control/src/index.ts?single-task-fixture=${randomUUID()}`,
      import.meta.url,
    ).href;
    replacements.push(
      mock.module(revisionUrl, {
        namedExports: {
          ...versionControl,
          readRepositoryRevision: (_root: unknown) => {
            assert.equal(_root, repository.capability);
            const revision = dependencies.observeRevision();
            return revision === null ? null : { revisionIdentity: revision };
          },
        },
      }),
    );
    const recoveryUrl = new URL(
      `?single-task-recovery-fixture=${randomUUID()}`,
      dispatchUrl,
    ).href;
    replacements.push(
      mock.module(recoveryUrl, {
        namedExports: {
          recoverFixtureSingleTaskOperation: (
            context: Parameters<typeof recoverSingleTaskOperation>[0],
            record: Parameters<typeof recoverSingleTaskOperation>[1],
          ) => {
            assert.equal(context.rootCapability, repository.capability);
            assert.equal(context.authorize, dependencies.authorize);
            assert.equal(context.consumer, "workbench");
            if (!dependencies.recover)
              throw Error("fixture_recovery_unconfigured");
            return dependencies.recover(record);
          },
        },
      }),
    );
    const kernelUrl = new URL(
      `../../src/lifecycle/host.ts?single-task-fixture=${randomUUID()}`,
      import.meta.url,
    ).href;
    replacements.push(
      mock.module(kernelUrl, {
        namedExports: {
          ...(await import("../../src/lifecycle/host.ts")),
          observeLeaseOwner: (
            owner: Parameters<typeof kernel.observeLeaseOwner>[0],
          ) => {
            if (!dependencies.observeLeaseOwner)
              throw Error("fixture_owner_observation_unconfigured");
            return dependencies.observeLeaseOwner(owner);
          },
        },
      }),
    );
    const executionCall = "await executeSingleTask(";
    const recoveryCall = "await recoverSingleTaskOperation(";
    assert.equal(dispatchSource.split(executionCall).length, 2);
    assert.equal(dispatchSource.split(recoveryCall).length, 2);
    const dispatched = dispatchSource
      .replace(executionCall, "await executeFixtureSingleTask(")
      .replace(recoveryCall, "await recoverFixtureSingleTaskOperation(");
    const intake = sourceUrl(
      `${dispatched}\nimport { executeFixtureSingleTask } from "single-task-fixture";\nimport { recoverFixtureSingleTaskOperation } from "single-task-recovery-fixture";`,
      dispatchUrl,
      new Map([
        ["single-task-fixture", executionUrl],
        ["./selection.ts", selectionUrl],
        ["../../../version-control/src/index.ts", revisionUrl],
        ["single-task-recovery-fixture", recoveryUrl],
        ["./host.ts", kernelUrl],
      ]),
    );
    const source = (await import(
      intake
    )) as typeof import("../../src/lifecycle/execution.ts");
    const owner = source.createCoordinatorTaskRequests({
      ...dependencies,
      rootCapability: repository.capability,
      consumer: "workbench",
    });
    return {
      ...owner,
      close: async () => {
        try {
          await owner.close();
        } finally {
          for (const replacement of replacements.toReversed())
            replacement.restore();
        }
      },
    };
  } catch (error) {
    for (const replacement of replacements.toReversed()) replacement.restore();
    throw error;
  }
}
