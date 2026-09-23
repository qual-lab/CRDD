/**
 * verify-signed-general-taskに属する責務をまとめる。
 *
 * @responsibility RuntimeRecordを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../version-control/src/repository-location.ts";
import {
  isSupportedCoordinatorNodeRuntime,
  MINIMUM_COORDINATOR_NODE_VERSION,
} from "../src/core/node-runtime-version.ts";
import {
  SIGNED_GENERAL_TASK_PUBLIC_REASONS,
  type SignedGeneralTaskPublicReason,
} from "../src/core/verification-result-reasons.ts";
import {
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../src/core/runtime-process-safety-state.ts";
import {
  discardRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "../src/security/candidate-bundle-store.ts";
import {
  cancelRuntimeOwnedCoordinatorTask,
  startRuntimeOwnedCoordinatorTask,
} from "../src/security/coordinator-task-runtime.ts";
import {
  coordinatorTaskPublicReasons,
  type CoordinatorTaskPublicReason,
} from "../src/security/coordinator-task-result-reasons.ts";
import { snapshotPlainArray } from "../src/security/plain-data-snapshot.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../src/security/platform-provisioner-package-filesystem.ts";
import {
  isCanonicalCrddGitObjectId,
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/security/release-identity-grammar.ts";
import { inspectRepositoryRevisionCandidate } from "../src/security/repository-operation-runtime.ts";
import {
  evaluateSignedRunnerSafetyObservation,
  salvageSignedRunnerNullableRecovery,
  salvageSignedRunnerRecoveryPair,
} from "../src/security/signed-runner-safety-observation.ts";

export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT =
  "crdd-coordinator/signed-general-task-verification";
export const SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION = 26;

const TARGET_PATH =
  "40_Develop/coordinator/runtime/general-task-verification.txt";
const BASE_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_BASE\n";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const PRODUCTION_CANCEL_ACK_TIMEOUT_MS = 10_000;
const PRODUCTION_CANCEL_COMPLETION_TIMEOUT_MS = 240_000;
const PRODUCTION_ORPHANED_START_OBSERVATION_TIMEOUT_MS = 240_000;
const intrinsicPromiseThen = Promise.prototype.then;
const CANCELLATION_RECEIPT_KEYS = Object.freeze([
  "status",
  "reason",
  "cancellationRequested",
  "processTerminationObserved",
]);
const TASK_SAFETY_SCHEMA = Object.freeze({
  booleanFields: Object.freeze([
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
    "canonicalRepositoryChanged",
    "rawOutputReported",
    "hostPathReported",
    "untrustedProviderTextReported",
  ]),
  nullableRecoveryFields: Object.freeze([
    Object.freeze({ field: "hostRecoveryId", kind: "host" as const }),
    Object.freeze({
      field: "candidateRecoveryId",
      kind: "candidate" as const,
    }),
    Object.freeze({
      field: "candidateStoreRecoveryId",
      kind: "candidate_store" as const,
    }),
  ]),
  recoveryPairs: Object.freeze([
    Object.freeze({
      singularField: "dockerRecoveryId",
      pluralField: "dockerRecoveryIds",
      kind: "docker" as const,
    }),
  ]),
});

/**
 * verify-signed-general-taskで使用するRuntime 記録の値契約を定義する。
 *
 * @responsibility Runtime 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeRecordの宣言は外部境界を開かない。
 * @security N/A: RuntimeRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RuntimeRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeRecord = Readonly<Record<string, unknown>>;
/**
 * 署名General Taskの最終結果理由を表す。
 *
 * @responsibility 署名RunnerとCoordinator Taskの公開理由を一つの閉じた型へ統合する。
 * @trace ARCH-000004
 * @shape 二つの公開理由unionだけからなる文字列unionである。
 * @invariant 未知理由やProvider生出力を含まない。
 * @boundary Coordinator Task結果から署名検証結果への投影境界。
 * @security 固定公開理由だけを許可する。
 * @compatibility 利用側は両公開Registryに含まれる理由だけへ依存する。
 */
type SignedGeneralTaskResultReason =
  | SignedGeneralTaskPublicReason
  | CoordinatorTaskPublicReason;
const signedGeneralTaskResultReasonSet = new Set<string>([
  ...SIGNED_GENERAL_TASK_PUBLIC_REASONS,
  ...coordinatorTaskPublicReasons,
]);
/**
 * verify-signed-general-taskで使用するSigned General Task Verification 結果の値契約を定義する。
 *
 * @responsibility Signed General Task Verification 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape SignedGeneralTaskVerificationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SignedGeneralTaskVerificationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: SignedGeneralTaskVerificationResultの宣言は外部境界を開かない。
 * @security N/A: SignedGeneralTaskVerificationResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SignedGeneralTaskVerificationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SignedGeneralTaskVerificationResult = RuntimeRecord &
  Readonly<{
    status: "completed" | "blocked";
    reason: SignedGeneralTaskResultReason;
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    effectStateUnknown?: boolean;
    hostRecoveryId: string | null;
    hostRecoveryIds: readonly string[];
    dockerRecoveryId: string | null;
    dockerRecoveryIds: readonly string[];
    candidateRecoveryId: string | null;
    candidateRecoveryIds: readonly string[];
    candidateStoreRecoveryId: string | null;
    candidateStoreRecoveryIds: readonly string[];
    canonicalRepositoryChanged: boolean | null;
    rawProviderOutputReported: boolean;
    hostPathReported: boolean;
    credentialReported: boolean;
    exactCandidateContentVerified?: boolean;
    candidateDiscarded?: boolean;
    candidateDisposition?: "not_issued" | "discarded" | "recovery_required";
    changedPaths?: readonly string[];
    crddCommit?: string;
    crddTree?: string;
    executionCommit?: string;
    executionTree?: string;
    requestedRouteProfile?: SignedGeneralTaskRouteProfile;
    route?: string;
    requestedFrontProvider?: "codex" | "claude";
    observedFrontProvider?: null;
    frontIdentityVerified?: boolean;
    executorProvider?: "codex" | "claude" | null;
    reviewerProvider?: "codex" | "claude" | null;
    reviewerIndependence?: string;
    reviewerDecision?: "approved" | "changes_requested" | null;
    reviewerFindingCount?: number | null;
    reviewerProjectedTargetExact?: boolean | null;
    reviewerProjectedTargetClassification?:
      | "exact"
      | "base_unchanged"
      | "crlf"
      | "missing_lf"
      | "extra_lf"
      | "literal_lf_escape"
      | "metadata_invalid"
      | "other_bytes"
      | null;
  }>;
/**
 * verify-signed-general-taskで使用するSigned General Task Route Profileの値契約を定義する。
 *
 * @responsibility Signed General Task Route ProfileのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape SignedGeneralTaskRouteProfileが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SignedGeneralTaskRouteProfileで宣言した値と責務の対応を維持する。
 * @boundary N/A: SignedGeneralTaskRouteProfileの宣言は外部境界を開かない。
 * @security N/A: SignedGeneralTaskRouteProfileはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SignedGeneralTaskRouteProfileの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SignedGeneralTaskRouteProfile =
  | "forward"
  | "reverse"
  | "same-codex"
  | "same-claude";
/**
 * verify-signed-general-taskで使用するRoute Expectationの値契約を定義する。
 *
 * @responsibility Route ExpectationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RouteExpectationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RouteExpectationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RouteExpectationの宣言は外部境界を開かない。
 * @security N/A: RouteExpectationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RouteExpectationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RouteExpectation = Readonly<{
  profile: SignedGeneralTaskRouteProfile;
  frontProvider: "codex" | "claude";
  executorProvider: "codex" | "claude";
  reviewerProvider: "codex" | "claude";
  route: string;
}>;
/**
 * verify-signed-general-taskで使用するRelease Identityの値契約を定義する。
 *
 * @responsibility Release IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ReleaseIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ReleaseIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ReleaseIdentityの宣言は外部境界を開かない。
 * @security N/A: ReleaseIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ReleaseIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ReleaseIdentity = RuntimeRecord &
  Readonly<{
    manifestHash: string;
    packageContentRootSha256: string;
    runtimeExecutionIdentitySha256: string;
    crddVersion: string;
    releaseSequence: number;
    crddCommit: string;
    crddTree: string;
  }>;
/**
 * verify-signed-general-taskで使用するExecution Revisionの値契約を定義する。
 *
 * @responsibility Execution RevisionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ExecutionRevisionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionRevisionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionRevisionの宣言は外部境界を開かない。
 * @security N/A: ExecutionRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionRevisionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ExecutionRevision = Readonly<{
  commit: string;
  tree: string;
}>;
/**
 * verify-signed-general-taskで使用するCancellation Bindingの値契約を定義する。
 *
 * @responsibility Cancellation BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CancellationBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CancellationBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: CancellationBindingの宣言は外部境界を開かない。
 * @security N/A: CancellationBindingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CancellationBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CancellationBinding = Readonly<{
  unbind: () => void;
  requested: () => boolean;
  requestedPromise: Promise<void>;
}>;
/**
 * verify-signed-general-taskで使用するCancellation Signal Sourceの値契約を定義する。
 *
 * @responsibility Cancellation Signal SourceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CancellationSignalSourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CancellationSignalSourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: CancellationSignalSourceの宣言は外部境界を開かない。
 * @security N/A: CancellationSignalSourceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CancellationSignalSourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CancellationSignalSource = Readonly<{
  on: (signal: "SIGINT" | "SIGTERM", listener: () => void) => unknown;
  removeListener: (
    signal: "SIGINT" | "SIGTERM",
    listener: () => void,
  ) => unknown;
}>;
/**
 * verify-signed-general-taskで使用するVerification Dependenciesの値契約を定義する。
 *
 * @responsibility Verification DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape VerificationDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerificationDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerificationDependenciesの宣言は外部境界を開かない。
 * @security N/A: VerificationDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility VerificationDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type VerificationDependencies = Readonly<{
  issuePackageCapability: (
    input: Readonly<{ evaluationTime: string }>,
  ) => Readonly<{ verification: unknown; capability: unknown }>;
  startTask: (
    request: RuntimeRecord,
    repositoryRoot: string,
    verifiedPackageCapability: unknown,
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
  readCandidate: (candidateId: string) => RuntimeRecord | null;
  discardCandidate: (candidateId: string) => RuntimeRecord;
  inspectRepositoryRevision: (repositoryRoot: string) => unknown;
  readBaseContent: (repositoryRoot: string) => Buffer;
  now: () => string;
  runtimeVersion: () => string;
  bindCancellation: (
    controlCapability: object,
    cancel: (controlCapability: object) => unknown,
  ) => CancellationBinding;
  isolatedSettlementTiming?: Readonly<{
    cancelAckTimeoutMs: number;
    cancelCompletionTimeoutMs: number;
    orphanedStartObservationTimeoutMs: number;
  }>;
}>;

/**
 * Signed General Task CancellationをIdentityへ結合する。
 *
 * @responsibility Signed General Task Cancellationの結合条件、相関Identity、不一致の拒否境界を所有する。
 * @trace ARCH-000004
 * @input signalSource: CancellationSignalSource、_controlCapability: object、_cancel: (controlCapability: object) => unknown
 * @returns CancellationBindingを返す。
 * @precondition 「signalSource: CancellationSignalSource、_controlCapability: object、_cancel: (controlCapability: object) => unknown」がbindSignedGeneralTaskCancellationの入力契約を満たす。
 * @postcondition bindSignedGeneralTaskCancellationの責務を完了した結果だけを返す。
 * @effect N/A: bindSignedGeneralTaskCancellationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure bindSignedGeneralTaskCancellationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant bindSignedGeneralTaskCancellationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: bindSignedGeneralTaskCancellationはProcess内の同一Subsystemで完結する。
 * @security N/A: bindSignedGeneralTaskCancellationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency bindSignedGeneralTaskCancellationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function bindSignedGeneralTaskCancellation(
  signalSource: CancellationSignalSource,
  _controlCapability: object,
  _cancel: (controlCapability: object) => unknown,
): CancellationBinding {
  let isRequested = false;
  let resolveRequested: (() => void) | null = null;
  const requestedPromise = new Promise<void>((resolve) => {
    resolveRequested = resolve;
  });
  const requestCancellation = () => {
    if (isRequested) return;
    isRequested = true;
    resolveRequested?.();
    resolveRequested = null;
  };
  try {
    signalSource.on("SIGINT", requestCancellation);
    signalSource.on("SIGTERM", requestCancellation);
  } catch {
    let rollbackFailed = false;
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      try {
        signalSource.removeListener(signal, requestCancellation);
      } catch {
        rollbackFailed = true;
      }
    }
    throw new Error(
      rollbackFailed
        ? "signed_general_task_cancellation_binding_cleanup_unknown"
        : "signed_general_task_cancellation_binding_failed",
    );
  }
  let isBound = true;
  return Object.freeze({
    unbind: () => {
      if (!isBound) return;
      isBound = false;
      let unbindFailed = false;
      for (const signal of ["SIGINT", "SIGTERM"] as const) {
        try {
          signalSource.removeListener(signal, requestCancellation);
        } catch {
          unbindFailed = true;
        }
      }
      if (unbindFailed)
        throw new Error(
          "signed_general_task_cancellation_unbind_cleanup_unknown",
        );
    },
    requested: () => isRequested,
    requestedPromise,
  });
}

const productionDependencies: VerificationDependencies = Object.freeze({
  issuePackageCapability: issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  startTask: startRuntimeOwnedCoordinatorTask,
  cancelTask: cancelRuntimeOwnedCoordinatorTask,
  readCandidate: readRuntimeOwnedCandidateBundle,
  discardCandidate: discardRuntimeOwnedCandidateBundle,
  inspectRepositoryRevision: inspectRepositoryRevisionCandidate,
  readBaseContent: (repositoryRoot) =>
    readFileSync(path.join(repositoryRoot, ...TARGET_PATH.split("/"))),
  now: () => new Date().toISOString(),
  runtimeVersion: () => process.versions.node,
  bindCancellation: (controlCapability, cancel) =>
    bindSignedGeneralTaskCancellation(process, controlCapability, cancel),
});

/**
 * settlement Timingを決定する。
 *
 * @responsibility settlement Timingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: VerificationDependencies
 * @returns settlementTimingの計算結果を返す。
 * @precondition 「dependencies: VerificationDependencies」がsettlementTimingの入力契約を満たす。
 * @postcondition settlementTimingの責務を完了した結果だけを返す。
 * @effect N/A: settlementTimingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: settlementTimingは独自の失敗分岐を所有しない。
 * @invariant settlementTimingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: settlementTimingはProcess内の同一Subsystemで完結する。
 * @security N/A: settlementTimingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: settlementTimingは共有非同期状態を持たない同期処理である。
 */
function settlementTiming(dependencies: VerificationDependencies) {
  const production = Object.freeze({
    cancelAckTimeoutMs: PRODUCTION_CANCEL_ACK_TIMEOUT_MS,
    cancelCompletionTimeoutMs: PRODUCTION_CANCEL_COMPLETION_TIMEOUT_MS,
    orphanedStartObservationTimeoutMs:
      PRODUCTION_ORPHANED_START_OBSERVATION_TIMEOUT_MS,
  });
  if (dependencies === productionDependencies) return production;
  const isolated = dependencies.isolatedSettlementTiming;
  return isolated &&
    Number.isSafeInteger(isolated.cancelAckTimeoutMs) &&
    isolated.cancelAckTimeoutMs > 0 &&
    Number.isSafeInteger(isolated.cancelCompletionTimeoutMs) &&
    isolated.cancelCompletionTimeoutMs > 0 &&
    Number.isSafeInteger(isolated.orphanedStartObservationTimeoutMs) &&
    isolated.orphanedStartObservationTimeoutMs > 0
    ? Object.freeze({ ...isolated })
    : production;
}

/**
 * 記録をPlain Dataとして検証する。
 *
 * @responsibility 記録の許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns RuntimeRecord | nullを返す。
 * @precondition 「value: unknown」がplainRecordの入力契約を満たす。
 * @postcondition plainRecordの責務を完了した結果だけを返す。
 * @effect N/A: plainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure plainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant plainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: plainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainRecordは共有非同期状態を持たない同期処理である。
 */
function plainRecord(value: unknown): RuntimeRecord | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    ) {
      return null;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      ) {
        return null;
      }
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * Started Taskを所有Snapshotへ変換する。
 *
 * @responsibility Started Taskの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns snapshotStartedTaskの計算結果を返す。
 * @precondition 「value: unknown」がsnapshotStartedTaskの入力契約を満たす。
 * @postcondition snapshotStartedTaskの責務を完了した結果だけを返す。
 * @effect N/A: snapshotStartedTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotStartedTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotStartedTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotStartedTaskはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotStartedTaskはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency snapshotStartedTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function snapshotStartedTask(value: unknown) {
  let controlCapability: object | null = null;
  let completionObservation: ReturnType<typeof observeNativeCompletion> | null =
    null;
  let isCompletionObserverUnknown = false;
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return Object.freeze({
        controlCapability,
        completionObservation,
        completionObserverUnknown: isCompletionObserverUnknown,
      });
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
      return Object.freeze({
        controlCapability,
        completionObservation,
        completionObserverUnknown: isCompletionObserverUnknown,
      });
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const control = descriptors.controlCapability;
    if (
      control &&
      Object.hasOwn(control, "value") &&
      control.get === undefined &&
      control.set === undefined &&
      control.enumerable === true &&
      control.value &&
      typeof control.value === "object" &&
      !utilTypes.isProxy(control.value)
    )
      controlCapability = control.value;
    const observedCompletion = descriptors.completion;
    if (
      observedCompletion &&
      Object.hasOwn(observedCompletion, "value") &&
      observedCompletion.get === undefined &&
      observedCompletion.set === undefined &&
      observedCompletion.enumerable === true &&
      observedCompletion.value &&
      typeof observedCompletion.value === "object" &&
      !utilTypes.isProxy(observedCompletion.value) &&
      utilTypes.isPromise(observedCompletion.value) &&
      Object.getPrototypeOf(observedCompletion.value) === Promise.prototype &&
      Object.getOwnPropertyDescriptor(observedCompletion.value, "then") ===
        undefined
    ) {
      try {
        completionObservation = observeNativeCompletion(
          observedCompletion.value as Promise<RuntimeRecord>,
        );
      } catch {
        isCompletionObserverUnknown = true;
      }
    }
  } catch {
    // Partially observed control remains available only for bounded cancel.
    isCompletionObserverUnknown = true;
  }
  return Object.freeze({
    controlCapability,
    completionObservation,
    completionObserverUnknown: isCompletionObserverUnknown,
  });
}

/**
 * Native Completionを観測する。
 *
 * @responsibility Native Completionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input completion: Promise<RuntimeRecord>
 * @returns observeNativeCompletionの計算結果を返す。
 * @precondition 「completion: Promise<RuntimeRecord>」がobserveNativeCompletionの入力契約を満たす。
 * @postcondition observeNativeCompletionの責務を完了した結果だけを返す。
 * @effect N/A: observeNativeCompletionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeNativeCompletionは独自の失敗分岐を所有しない。
 * @invariant observeNativeCompletionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeNativeCompletionはProcess内の同一Subsystemで完結する。
 * @security N/A: observeNativeCompletionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency observeNativeCompletionは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function observeNativeCompletion(completion: Promise<RuntimeRecord>) {
  return intrinsicPromiseThen.call(
    completion,
    (value) => Object.freeze({ status: "fulfilled" as const, value }),
    () => Object.freeze({ status: "rejected" as const, value: null }),
  ) as Promise<
    Readonly<
      | { status: "fulfilled"; value: RuntimeRecord }
      | { status: "rejected"; value: null }
    >
  >;
}

/**
 * Cancellation Receiptが完全一致するか判定する。
 *
 * @responsibility Cancellation Receiptの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns exactCancellationReceiptの計算結果を返す。
 * @precondition 「value: unknown」がexactCancellationReceiptの入力契約を満たす。
 * @postcondition exactCancellationReceiptの責務を完了した結果だけを返す。
 * @effect N/A: exactCancellationReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactCancellationReceiptは独自の失敗分岐を所有しない。
 * @invariant exactCancellationReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactCancellationReceiptはProcess内の同一Subsystemで完結する。
 * @security N/A: exactCancellationReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactCancellationReceiptは共有非同期状態を持たない同期処理である。
 */
function exactCancellationReceipt(value: unknown) {
  const receipt = plainRecord(value);
  if (
    !receipt ||
    Reflect.ownKeys(receipt).length !== CANCELLATION_RECEIPT_KEYS.length ||
    CANCELLATION_RECEIPT_KEYS.some((key) => !Object.hasOwn(receipt, key)) ||
    receipt.status !== "requested" ||
    receipt.cancellationRequested !== true ||
    typeof receipt.processTerminationObserved !== "boolean" ||
    (receipt.processTerminationObserved === true &&
      receipt.reason !== "provider_cancellation_requested") ||
    (receipt.processTerminationObserved === false &&
      receipt.reason !== "provider_cancellation_grace_exceeded")
  )
    return null;
  return Object.freeze({
    processTerminationObserved: receipt.processTerminationObserved,
  });
}

/**
 * String Arrayが完全一致するか判定する。
 *
 * @responsibility String Arrayの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、expectedValues: readonly string[]
 * @returns exactStringArrayの計算結果を返す。
 * @precondition 「value: unknown、expectedValues: readonly string[]」がexactStringArrayの入力契約を満たす。
 * @postcondition exactStringArrayの責務を完了した結果だけを返す。
 * @effect N/A: exactStringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactStringArrayは独自の失敗分岐を所有しない。
 * @invariant exactStringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactStringArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: exactStringArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: exactStringArrayは共有非同期状態を持たない同期処理である。
 */
function exactStringArray(value: unknown, expectedValues: readonly string[]) {
  const snapshot = snapshotPlainArray<unknown>(value, expectedValues.length);
  return (
    snapshot.status === "ok" &&
    snapshot.value.length === expectedValues.length &&
    expectedValues.every((item, index) => snapshot.value[index] === item)
  );
}

/**
 * Reasonを安全条件の下で処理する。
 *
 * @responsibility Reasonの安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、fallback: string
 * @returns safeReasonの計算結果を返す。
 * @precondition 「value: unknown、fallback: string」がsafeReasonの入力契約を満たす。
 * @postcondition safeReasonの責務を完了した結果だけを返す。
 * @effect N/A: safeReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: safeReasonは独自の失敗分岐を所有しない。
 * @invariant safeReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: safeReasonはProcess内の同一Subsystemで完結する。
 * @security N/A: safeReasonはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: safeReasonは共有非同期状態を持たない同期処理である。
 */
function safeReason(
  value: unknown,
  fallback: SignedGeneralTaskResultReason,
): SignedGeneralTaskResultReason {
  return typeof value === "string" &&
    signedGeneralTaskResultReasonSet.has(value)
    ? (value as SignedGeneralTaskResultReason)
    : fallback;
}

/**
 * sha256を決定する。
 *
 * @responsibility sha256の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がsha256の入力契約を満たす。
 * @postcondition sha256の責務を完了した結果だけを返す。
 * @effect N/A: sha256は入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sha256は独自の失敗分岐を所有しない。
 * @invariant sha256は入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sha256はProcess内の同一Subsystemで完結する。
 * @security N/A: sha256はAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: sha256は共有非同期状態を持たない同期処理である。
 */
function sha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

/**
 * reviewer Diagnosis Projectionを決定する。
 *
 * @responsibility reviewer Diagnosis Projectionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input result: RuntimeRecord | null
 * @returns reviewerDiagnosisProjectionの計算結果を返す。
 * @precondition 「result: RuntimeRecord | null」がreviewerDiagnosisProjectionの入力契約を満たす。
 * @postcondition reviewerDiagnosisProjectionの責務を完了した結果だけを返す。
 * @effect N/A: reviewerDiagnosisProjectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reviewerDiagnosisProjectionは独自の失敗分岐を所有しない。
 * @invariant reviewerDiagnosisProjectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reviewerDiagnosisProjectionはProcess内の同一Subsystemで完結する。
 * @security N/A: reviewerDiagnosisProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: reviewerDiagnosisProjectionは共有非同期状態を持たない同期処理である。
 */
function reviewerDiagnosisProjection(result: RuntimeRecord | null) {
  const reviewerResult = plainRecord(result?.reviewerResult);
  const evidence = plainRecord(result?.reviewerProjectionEvidence);
  const files = evidence
    ? snapshotPlainArray<unknown>(evidence.files, 1)
    : null;
  const file =
    files?.status === "ok" && files.value.length === 1
      ? plainRecord(files.value[0])
      : null;
  const expectedBytes = Buffer.from(EXPECTED_CONTENT, "utf8");
  const expectedSha256 = createHash("sha256")
    .update(expectedBytes)
    .digest("hex");
  const reviewerDecision =
    reviewerResult?.decision === "approved" ||
    reviewerResult?.decision === "changes_requested"
      ? reviewerResult.decision
      : null;
  const reviewerFindingCount =
    typeof reviewerResult?.findingCount === "number" &&
    Number.isSafeInteger(reviewerResult.findingCount) &&
    reviewerResult.findingCount >= 0 &&
    reviewerResult.findingCount <= 64
      ? reviewerResult.findingCount
      : null;
  const matches = (content: string) => {
    const bytes = Buffer.from(content, "utf8");
    return (
      evidence?.totalBytes === bytes.byteLength &&
      file?.byteLength === bytes.byteLength &&
      file.sha256 === createHash("sha256").update(bytes).digest("hex")
    );
  };
  const isMetadataValid =
    evidence?.contentReported === false &&
    typeof evidence.totalBytes === "number" &&
    Number.isSafeInteger(evidence.totalBytes) &&
    evidence.totalBytes >= 0 &&
    files?.status === "ok" &&
    files.value.length === 1 &&
    file?.path === TARGET_PATH &&
    file.state === "present" &&
    typeof file.byteLength === "number" &&
    Number.isSafeInteger(file.byteLength) &&
    file.byteLength >= 0 &&
    sha256(file.sha256) &&
    file.encoding === "utf-8";
  const reviewerProjectedTargetClassification =
    evidence === null
      ? null
      : !isMetadataValid
        ? ("metadata_invalid" as const)
        : file.sha256 === expectedSha256 && matches(EXPECTED_CONTENT)
          ? ("exact" as const)
          : matches(BASE_CONTENT)
            ? ("base_unchanged" as const)
            : matches(EXPECTED_CONTENT.replace("\n", "\r\n"))
              ? ("crlf" as const)
              : matches(EXPECTED_CONTENT.trimEnd())
                ? ("missing_lf" as const)
                : matches(`${EXPECTED_CONTENT}\n`)
                  ? ("extra_lf" as const)
                  : matches(`${EXPECTED_CONTENT.trimEnd()}\\n`)
                    ? ("literal_lf_escape" as const)
                    : ("other_bytes" as const);
  const isReviewerProjectedTargetExact =
    reviewerProjectedTargetClassification === null
      ? null
      : reviewerProjectedTargetClassification === "exact";
  return Object.freeze({
    reviewerDecision,
    reviewerFindingCount,
    reviewerProjectedTargetExact: isReviewerProjectedTargetExact,
    reviewerProjectedTargetClassification,
    remediationPerformed:
      typeof result?.remediationPerformed === "boolean"
        ? result.remediationPerformed
        : null,
  });
}

/**
 * bounded 回復 Idsを決定する。
 *
 * @responsibility bounded 回復 Idsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input results: readonly (RuntimeRecord | null)[]、singularField: string、kind: "host" | "docker" | "candidate" | "candidate_store"、pluralField: string
 * @returns boundedRecoveryIdsの計算結果を返す。
 * @precondition 「results: readonly (RuntimeRecord | null)[]、singularField: string、kind: "host" | "docker" | "candidate" | "candidate_store"、pluralField: string」がboundedRecoveryIdsの入力契約を満たす。
 * @postcondition boundedRecoveryIdsの責務を完了した結果だけを返す。
 * @effect N/A: boundedRecoveryIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: boundedRecoveryIdsは独自の失敗分岐を所有しない。
 * @invariant boundedRecoveryIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: boundedRecoveryIdsはProcess内の同一Subsystemで完結する。
 * @security N/A: boundedRecoveryIdsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: boundedRecoveryIdsは共有非同期状態を持たない同期処理である。
 */
function boundedRecoveryIds(
  results: readonly (RuntimeRecord | null)[],
  singularField: string,
  kind: "host" | "docker" | "candidate" | "candidate_store",
  pluralField?: string,
) {
  const ids: string[] = [];
  let isAmbiguous = false;
  for (const result of results) {
    if (!result) continue;
    const hasSingular = Object.getOwnPropertyDescriptor(result, singularField);
    const hasPlural = pluralField
      ? Object.getOwnPropertyDescriptor(result, pluralField)
      : null;
    if (!hasSingular && !hasPlural) continue;
    if (pluralField) {
      const recovered = salvageSignedRunnerRecoveryPair(result, {
        singularField,
        pluralField,
        kind,
      });
      ids.push(...recovered.plural);
      if (recovered.ambiguous) isAmbiguous = true;
    } else {
      const recovered = salvageSignedRunnerNullableRecovery(
        result,
        singularField,
        kind,
      );
      if (recovered.id) ids.push(recovered.id);
      if (recovered.ambiguous) isAmbiguous = true;
    }
  }
  const uniqueItems = [...new Set(ids)];
  if (uniqueItems.length > 128) isAmbiguous = true;
  return Object.freeze({
    ids: Object.freeze(uniqueItems.slice(0, 128)),
    ambiguous: isAmbiguous,
  });
}

/**
 * recovery Projectionを決定する。
 *
 * @responsibility recovery Projectionの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input results: readonly (RuntimeRecord | null)[]
 * @returns recoveryProjectionの計算結果を返す。
 * @precondition 「results: readonly (RuntimeRecord | null)[]」がrecoveryProjectionの入力契約を満たす。
 * @postcondition recoveryProjectionの責務を完了した結果だけを返す。
 * @effect N/A: recoveryProjectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryProjectionは独自の失敗分岐を所有しない。
 * @invariant recoveryProjectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryProjectionはProcess内の同一Subsystemで完結する。
 * @security N/A: recoveryProjectionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recoveryProjectionは共有非同期状態を持たない同期処理である。
 */
function recoveryProjection(...results: readonly (RuntimeRecord | null)[]) {
  const sources = results.filter((result) => result !== null);
  if (
    sources.some((result) => result?.processRestartRequired === true) &&
    !isRuntimeProcessPoisoned()
  )
    ensureRuntimeProcessPoisoned();
  const hostRecovery = boundedRecoveryIds(sources, "hostRecoveryId", "host");
  const dockerRecovery = boundedRecoveryIds(
    sources,
    "dockerRecoveryId",
    "docker",
    "dockerRecoveryIds",
  );
  const candidateRecovery = boundedRecoveryIds(
    sources,
    "candidateRecoveryId",
    "candidate",
  );
  const candidateStoreRecovery = boundedRecoveryIds(
    sources,
    "candidateStoreRecoveryId",
    "candidate_store",
  );
  const hostRecoveryIds = hostRecovery.ids;
  const dockerRecoveryIds = dockerRecovery.ids;
  const candidateRecoveryIds = candidateRecovery.ids;
  const candidateStoreRecoveryIds = candidateStoreRecovery.ids;
  return Object.freeze({
    cleanupConfirmed:
      sources.length > 0 &&
      sources.every((result) => result?.cleanupConfirmed === true),
    manualRecoveryRequired: sources.some(
      (result) => result?.manualRecoveryRequired === true,
    ),
    processRestartRequired:
      isRuntimeProcessPoisoned() ||
      sources.some((result) => result?.processRestartRequired === true),
    hostRecoveryId:
      hostRecoveryIds.length === 1 ? (hostRecoveryIds[0] ?? null) : null,
    hostRecoveryIds,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
    dockerRecoveryIds,
    candidateRecoveryId:
      candidateRecoveryIds.length === 1
        ? (candidateRecoveryIds[0] ?? null)
        : null,
    candidateRecoveryIds,
    candidateStoreRecoveryId:
      candidateStoreRecoveryIds.length === 1
        ? (candidateStoreRecoveryIds[0] ?? null)
        : null,
    candidateStoreRecoveryIds,
    recoveryIdentityAmbiguous:
      hostRecovery.ambiguous ||
      dockerRecovery.ambiguous ||
      candidateRecovery.ambiguous ||
      candidateStoreRecovery.ambiguous ||
      hostRecoveryIds.length > 1 ||
      candidateRecoveryIds.length > 1 ||
      candidateStoreRecoveryIds.length > 1,
  });
}

/**
 * verify-signed-general-taskを停止結果として構築する。
 *
 * @responsibility verify-signed-general-taskの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、source: RuntimeRecord | null、extra: RuntimeRecord、additionalRecoverySources: readonly (RuntimeRecord | null)[]
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string、source: RuntimeRecord | null、extra: RuntimeRecord、additionalRecoverySources: readonly (RuntimeRecord | null)[]」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  reason: SignedGeneralTaskResultReason,
  source: RuntimeRecord | null = null,
  extra: RuntimeRecord = Object.freeze({}),
  additionalRecoverySources: readonly (RuntimeRecord | null)[] = Object.freeze(
    [],
  ),
) {
  const wasCanonicalRepositoryChanged =
    extra.canonicalRepositoryChanged === true ||
    source?.canonicalRepositoryChanged === true
      ? true
      : extra.canonicalRepositoryChanged === null
        ? null
        : extra.canonicalRepositoryChanged === false ||
            source?.canonicalRepositoryChanged === false
          ? false
          : null;
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    status: "blocked" as const,
    reason,
    ...recoveryProjection(source, ...additionalRecoverySources),
    ...extra,
    canonicalRepositoryChanged: wasCanonicalRepositoryChanged,
    effectStateUnknown:
      typeof extra.effectStateUnknown === "boolean"
        ? extra.effectStateUnknown
        : wasCanonicalRepositoryChanged === null,
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

/**
 * After Exact 候補 Discardを停止結果として構築する。
 *
 * @responsibility After Exact 候補 Discardの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、taskResult: RuntimeRecord、extra: RuntimeRecord
 * @returns blockedAfterExactCandidateDiscardの計算結果を返す。
 * @precondition 「reason: string、taskResult: RuntimeRecord、extra: RuntimeRecord」がblockedAfterExactCandidateDiscardの入力契約を満たす。
 * @postcondition blockedAfterExactCandidateDiscardの責務を完了した結果だけを返す。
 * @effect N/A: blockedAfterExactCandidateDiscardは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedAfterExactCandidateDiscardは独自の失敗分岐を所有しない。
 * @invariant blockedAfterExactCandidateDiscardは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedAfterExactCandidateDiscardはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedAfterExactCandidateDiscardはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedAfterExactCandidateDiscardは共有非同期状態を持たない同期処理である。
 */
function blockedAfterExactCandidateDiscard(
  reason: SignedGeneralTaskResultReason,
  taskResult: RuntimeRecord,
  extra: RuntimeRecord = Object.freeze({}),
) {
  const externalSendAuthorizationMode =
    taskResult.externalSendAuthorizationMode ===
      "interactive_initial_consent" ||
    taskResult.externalSendAuthorizationMode === "reused_initial_consent"
      ? taskResult.externalSendAuthorizationMode
      : null;
  const sourceAfterDiscard = Object.freeze({
    ...taskResult,
    candidateRecoveryId: null,
    candidateStoreRecoveryId: null,
  });
  return blocked(
    reason,
    sourceAfterDiscard,
    Object.freeze({
      candidateDiscarded: true,
      candidateDisposition: "discarded",
      ...(externalSendAuthorizationMode
        ? { externalSendAuthorizationMode }
        : {}),
      ...extra,
    }),
  );
}

/**
 * After Confirmed 候補 Not Issuedを停止結果として構築する。
 *
 * @responsibility After Confirmed 候補 Not Issuedの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、taskResult: RuntimeRecord、extra: RuntimeRecord
 * @returns blockedAfterConfirmedCandidateNotIssuedの計算結果を返す。
 * @precondition 「reason: string、taskResult: RuntimeRecord、extra: RuntimeRecord」がblockedAfterConfirmedCandidateNotIssuedの入力契約を満たす。
 * @postcondition blockedAfterConfirmedCandidateNotIssuedの責務を完了した結果だけを返す。
 * @effect N/A: blockedAfterConfirmedCandidateNotIssuedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedAfterConfirmedCandidateNotIssuedは独自の失敗分岐を所有しない。
 * @invariant blockedAfterConfirmedCandidateNotIssuedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedAfterConfirmedCandidateNotIssuedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedAfterConfirmedCandidateNotIssuedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedAfterConfirmedCandidateNotIssuedは共有非同期状態を持たない同期処理である。
 */
function blockedAfterConfirmedCandidateNotIssued(
  reason: SignedGeneralTaskResultReason,
  taskResult: RuntimeRecord,
  extra: RuntimeRecord = Object.freeze({}),
) {
  const externalSendAuthorizationMode =
    taskResult.externalSendAuthorizationMode ===
      "interactive_initial_consent" ||
    taskResult.externalSendAuthorizationMode === "reused_initial_consent"
      ? taskResult.externalSendAuthorizationMode
      : null;
  if (
    taskResult.candidateDisposition !== "not_issued" ||
    taskResult.candidateId !== null ||
    taskResult.candidateRecoveryId !== null ||
    taskResult.candidateStoreRecoveryId !== null ||
    taskResult.cleanupConfirmed !== true ||
    taskResult.manualRecoveryRequired !== false ||
    externalSendAuthorizationMode === null
  )
    return null;
  return blocked(
    reason,
    taskResult,
    Object.freeze({
      candidateDiscarded: false,
      candidateDisposition: "not_issued",
      externalSendAuthorizationMode,
      ...extra,
    }),
  );
}

/**
 * Runtime Process Poisonedが成立する状態を確保する。
 *
 * @responsibility Runtime Process Poisonedの成立条件、作成または再利用、失敗時の非成立境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: ensureRuntimeProcessPoisonedは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がensureRuntimeProcessPoisonedの入力契約を満たす。
 * @postcondition ensureRuntimeProcessPoisonedの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: ensureRuntimeProcessPoisonedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ensureRuntimeProcessPoisonedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ensureRuntimeProcessPoisonedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ensureRuntimeProcessPoisonedはProcess内の同一Subsystemで完結する。
 * @security N/A: ensureRuntimeProcessPoisonedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ensureRuntimeProcessPoisonedは共有非同期状態を持たない同期処理である。
 */
function ensureRuntimeProcessPoisoned() {
  poisonRuntimeProcessAfterCleanupUnknown();
  if (!isRuntimeProcessPoisoned())
    throw new Error("runtime_process_poison_transition_failed");
}

/**
 * bounded Settlementを決定する。
 *
 * @responsibility bounded Settlementの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input promise: Promise<T>、timeoutMs: number
 * @returns boundedSettlementの計算結果を返す。
 * @precondition 「promise: Promise<T>、timeoutMs: number」がboundedSettlementの入力契約を満たす。
 * @postcondition boundedSettlementの責務を完了した結果だけを返す。
 * @effect N/A: boundedSettlementは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: boundedSettlementは独自の失敗分岐を所有しない。
 * @invariant boundedSettlementは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: boundedSettlementはProcess内の同一Subsystemで完結する。
 * @security N/A: boundedSettlementはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency boundedSettlementは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function boundedSettlement<T>(promise: Promise<T>, timeoutMs: number) {
  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise.then(
        (value) => Object.freeze({ status: "fulfilled" as const, value }),
        () => Object.freeze({ status: "rejected" as const, value: null }),
      ),
      new Promise<Readonly<{ status: "timeout"; value: null }>>((resolve) => {
        timeout = setTimeout(
          () => resolve(Object.freeze({ status: "timeout", value: null })),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/**
 * post Start Unknown Blockedを決定する。
 *
 * @responsibility post Start Unknown Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、taskResult: RuntimeRecord | null、discarded: RuntimeRecord | null、isCandidateDiscarded: boolean、executionStateProjection: RuntimeRecord | null
 * @returns postStartUnknownBlockedの計算結果を返す。
 * @precondition 「reason: string、taskResult: RuntimeRecord | null、discarded: RuntimeRecord | null、isCandidateDiscarded: boolean、executionStateProjection: RuntimeRecord | null」がpostStartUnknownBlockedの入力契約を満たす。
 * @postcondition postStartUnknownBlockedの責務を完了した結果だけを返す。
 * @effect N/A: postStartUnknownBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: postStartUnknownBlockedは独自の失敗分岐を所有しない。
 * @invariant postStartUnknownBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: postStartUnknownBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: postStartUnknownBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: postStartUnknownBlockedは共有非同期状態を持たない同期処理である。
 */
function postStartUnknownBlocked(
  reason: SignedGeneralTaskResultReason,
  taskResult: RuntimeRecord | null,
  discarded: RuntimeRecord | null,
  isCandidateDiscarded: boolean,
  executionStateProjection: RuntimeRecord | null = null,
) {
  ensureRuntimeProcessPoisoned();
  const projected = blocked(
    reason,
    taskResult,
    Object.freeze({
      candidateDiscarded: isCandidateDiscarded,
      ...(executionStateProjection ?? {}),
    }),
    Object.freeze([discarded]),
  );
  return Object.freeze({
    ...projected,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    effectStateUnknown: true,
    recoveryIdentityAmbiguous: true,
  });
}

const ROUTE_EXPECTATIONS: Readonly<
  Record<SignedGeneralTaskRouteProfile, RouteExpectation>
> = Object.freeze({
  forward: Object.freeze({
    profile: "forward",
    frontProvider: "codex",
    executorProvider: "claude",
    reviewerProvider: "codex",
    route: "front_codex__executor_claude__reviewer_codex",
  }),
  reverse: Object.freeze({
    profile: "reverse",
    frontProvider: "claude",
    executorProvider: "codex",
    reviewerProvider: "claude",
    route: "front_claude__executor_codex__reviewer_claude",
  }),
  "same-codex": Object.freeze({
    profile: "same-codex",
    frontProvider: "codex",
    executorProvider: "codex",
    reviewerProvider: "claude",
    route: "front_codex__executor_codex__reviewer_claude",
  }),
  "same-claude": Object.freeze({
    profile: "same-claude",
    frontProvider: "claude",
    executorProvider: "claude",
    reviewerProvider: "codex",
    route: "front_claude__executor_claude__reviewer_codex",
  }),
});

/**
 * Signed General Task Verification Requestを構築する。
 *
 * @responsibility Signed General Task Verification Requestの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input routeProfile: SignedGeneralTaskRouteProfile
 * @returns createSignedGeneralTaskVerificationRequestの計算結果を返す。
 * @precondition 「routeProfile: SignedGeneralTaskRouteProfile」がcreateSignedGeneralTaskVerificationRequestの入力契約を満たす。
 * @postcondition createSignedGeneralTaskVerificationRequestの責務を完了した結果だけを返す。
 * @effect N/A: createSignedGeneralTaskVerificationRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSignedGeneralTaskVerificationRequestは独自の失敗分岐を所有しない。
 * @invariant createSignedGeneralTaskVerificationRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSignedGeneralTaskVerificationRequestはProcess内の同一Subsystemで完結する。
 * @security N/A: createSignedGeneralTaskVerificationRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createSignedGeneralTaskVerificationRequestは共有非同期状態を持たない同期処理である。
 */
export function createSignedGeneralTaskVerificationRequest(
  routeProfile: SignedGeneralTaskRouteProfile = "forward",
) {
  const route = ROUTE_EXPECTATIONS[routeProfile];
  return Object.freeze({
    frontProvider: route.frontProvider,
    requestedExecutorProvider: route.executorProvider,
    objective:
      "Replace the one existing bounded verification marker from BASE to OK.",
    acceptanceCriteria: Object.freeze([
      `The visible candidate marker is located at ${TARGET_PATH}; the runtime and signed runner separately verify that no other path changed.`,
      `The base revision contains exactly ${JSON.stringify(BASE_CONTENT.trimEnd())}; replace only its final BASE token with OK instead of recreating or reformatting the file.`,
      `The visible file content is exactly the single line ${JSON.stringify(EXPECTED_CONTENT.trimEnd())}, with no additional text. Review this visible content and the bounded replacement; exact UTF-8 bytes, trailing LF, byte length and SHA-256 are separate checks owned by the route verification runner, not proof requested from the reviewer. Do not claim those separate checks have run.`,
    ]),
    allowedPaths: Object.freeze([TARGET_PATH]),
    readPaths: Object.freeze([
      "06_Architecture/Details/coordinator/01_Architecture.md",
      TARGET_PATH,
    ]),
    workClass:
      routeProfile === "same-codex" || routeProfile === "same-claude"
        ? "bounded_verification"
        : "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });
}

/**
 * verified Packageを決定する。
 *
 * @responsibility verified Packageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input release: RuntimeRecord | null
 * @returns release is ReleaseIdentityを返す。
 * @precondition 「release: RuntimeRecord | null」がverifiedPackageの入力契約を満たす。
 * @postcondition verifiedPackageの責務を完了した結果だけを返す。
 * @effect N/A: verifiedPackageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifiedPackageは独自の失敗分岐を所有しない。
 * @invariant verifiedPackageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifiedPackageはProcess内の同一Subsystemで完結する。
 * @security N/A: verifiedPackageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifiedPackageは共有非同期状態を持たない同期処理である。
 */
function verifiedPackage(
  release: RuntimeRecord | null,
): release is ReleaseIdentity {
  return (
    release?.status === "candidate" &&
    release.stableFilesystemIdentityObserved === true &&
    release.runtimeOwnedPackageRoot === true &&
    sha256(release.manifestHash) &&
    sha256(release.packageContentRootSha256) &&
    sha256(release.runtimeExecutionIdentitySha256) &&
    isCanonicalCrddVersion(release.crddVersion) &&
    Number.isSafeInteger(release.releaseSequence) &&
    Number(release.releaseSequence) >= 1 &&
    isCanonicalCrddGitObjectId(release.crddCommit) &&
    isCanonicalCrddGitObjectId(release.crddTree) &&
    release.qualLabManifestCryptographicMatch === true &&
    release.runtimeOwnedReleaseTrustConfirmed === true &&
    release.runtimeExecutionIdentityRuntimeOwned === true &&
    release.crddDistributionConfirmed === true
  );
}

/**
 * task 結果 契約 Mismatchを決定する。
 *
 * @responsibility task 結果 契約 Mismatchの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input result: RuntimeRecord | null、executionRevision: ExecutionRevision、executionRevisionMismatch: string | null、route: RouteExpectation
 * @returns taskResultContractMismatchの計算結果を返す。
 * @precondition 「result: RuntimeRecord | null、executionRevision: ExecutionRevision、executionRevisionMismatch: string | null、route: RouteExpectation」がtaskResultContractMismatchの入力契約を満たす。
 * @postcondition taskResultContractMismatchの責務を完了した結果だけを返す。
 * @effect N/A: taskResultContractMismatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: taskResultContractMismatchは独自の失敗分岐を所有しない。
 * @invariant taskResultContractMismatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: taskResultContractMismatchはProcess内の同一Subsystemで完結する。
 * @security N/A: taskResultContractMismatchはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: taskResultContractMismatchは共有非同期状態を持たない同期処理である。
 */
function taskResultContractMismatch(
  result: RuntimeRecord | null,
  executionRevision: ExecutionRevision,
  executionRevisionMismatch: string | null,
  route: RouteExpectation,
) {
  const candidateRevision = plainRecord(result?.candidateRevision);
  const reviewerResult = plainRecord(result?.reviewerResult);
  if (executionRevisionMismatch !== null) return executionRevisionMismatch;
  if (result?.status !== "completed") return "status";
  if (result.reason !== "coordinator_task_candidate_approved") return "reason";
  if (result.cleanupConfirmed !== true) return "cleanup_confirmed";
  if (result.manualRecoveryRequired !== false)
    return "manual_recovery_required";
  if (result.processRestartRequired !== false)
    return "process_restart_required";
  if (result.executorProvider !== route.executorProvider)
    return "executor_provider";
  if (result.reviewerProvider !== route.reviewerProvider)
    return "reviewer_provider";
  if (result.reviewerIndependence !== "provider_independent")
    return "reviewer_independence";
  if (
    result.externalSendAuthorizationMode !== "interactive_initial_consent" &&
    result.externalSendAuthorizationMode !== "reused_initial_consent"
  )
    return "external_send_authorization_mode";
  if (typeof result.remediationPerformed !== "boolean")
    return "remediation_performed";
  if (!candidateRevision) return "candidate_revision";
  if (candidateRevision.baseCommit !== executionRevision.commit)
    return "candidate_base_commit";
  if (candidateRevision.baseTree !== executionRevision.tree)
    return "candidate_base_tree";
  if (!sha256(candidateRevision.patchHash)) return "candidate_patch_hash";
  if (!sha256(candidateRevision.contentManifestHash))
    return "candidate_content_manifest_hash";
  if (!sha256(candidateRevision.allowedPathsHash))
    return "candidate_allowed_paths_hash";
  if (reviewerResult?.decision !== "approved") return "reviewer_decision";
  if (reviewerResult.findingCount !== 0) return "reviewer_finding_count";
  if (result.canonicalRepositoryChanged !== false)
    return "canonical_repository_changed";
  if (result.rawOutputReported !== false) return "raw_output_reported";
  if (result.hostPathReported !== false) return "host_path_reported";
  if (result.untrustedProviderTextReported !== false)
    return "untrusted_provider_text_reported";
  if (result.hostRecoveryId !== null) return "host_recovery_id";
  if (result.dockerRecoveryId !== null) return "docker_recovery_id";
  if (!exactStringArray(result.dockerRecoveryIds, []))
    return "docker_recovery_ids";
  if (result.candidateRecoveryId !== null) return "candidate_recovery_id";
  if (result.candidateStoreRecoveryId !== null)
    return "candidate_store_recovery_id";
  if (typeof result.candidateId !== "string") return "candidate_id";
  return null;
}

/**
 * candidate 契約 Mismatchを決定する。
 *
 * @responsibility candidate 契約 Mismatchの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: RuntimeRecord | null、candidateId: string、taskResult: RuntimeRecord | null
 * @returns candidateContractMismatchの計算結果を返す。
 * @precondition 「candidate: RuntimeRecord | null、candidateId: string、taskResult: RuntimeRecord | null」がcandidateContractMismatchの入力契約を満たす。
 * @postcondition candidateContractMismatchの責務を完了した結果だけを返す。
 * @effect N/A: candidateContractMismatchは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: candidateContractMismatchは独自の失敗分岐を所有しない。
 * @invariant candidateContractMismatchは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: candidateContractMismatchはProcess内の同一Subsystemで完結する。
 * @security N/A: candidateContractMismatchはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: candidateContractMismatchは共有非同期状態を持たない同期処理である。
 */
function candidateContractMismatch(
  candidate: RuntimeRecord | null,
  candidateId: string,
  taskResult: RuntimeRecord | null,
) {
  const bundle = plainRecord(candidate?.bundle);
  const candidateRevision = plainRecord(taskResult?.candidateRevision);
  const entries = snapshotPlainArray<unknown>(bundle?.entries, 1);
  const entry =
    entries.status === "ok" && entries.value.length === 1
      ? plainRecord(entries.value[0])
      : null;
  const contentBase64 = entry?.contentBase64;
  if (candidate?.status !== "exported") return "candidate_status";
  if (candidate.candidateId !== candidateId) return "candidate_id";
  if (bundle?.schema !== "crdd-coordinator-candidate-bundle/v1")
    return "bundle_schema";
  if (!isCanonicalCrddGitObjectId(bundle.baseCommit)) return "base_commit";
  if (!isCanonicalCrddGitObjectId(bundle.baseTree)) return "base_tree";
  if (!sha256(bundle.baseManifestHash)) return "base_manifest_hash";
  if (!sha256(bundle.patchHash)) return "patch_hash_shape";
  if (!sha256(bundle.contentManifestHash)) return "content_manifest_hash_shape";
  if (!sha256(bundle.allowedPathsHash)) return "allowed_paths_hash_shape";
  if (bundle.baseCommit !== candidateRevision?.baseCommit)
    return "candidate_base_commit";
  if (bundle.baseTree !== candidateRevision?.baseTree)
    return "candidate_base_tree";
  if (bundle.patchHash !== candidateRevision?.patchHash)
    return "candidate_patch_hash";
  if (bundle.contentManifestHash !== candidateRevision?.contentManifestHash)
    return "candidate_content_manifest_hash";
  if (bundle.allowedPathsHash !== candidateRevision?.allowedPathsHash)
    return "candidate_allowed_paths_hash";
  if (!exactStringArray(bundle.changedPaths, [TARGET_PATH]))
    return "candidate_changed_paths";
  if (!entry) return "candidate_entry";
  if (entry.relativePath !== TARGET_PATH) return "candidate_entry_path";
  if (entry.operation !== "upsert") return "candidate_entry_operation";
  if (typeof contentBase64 !== "string") return "candidate_content_base64_type";
  if (typeof entry.byteLength !== "number") return "candidate_byte_length_type";
  if (typeof entry.sha256 !== "string") return "candidate_sha256_type";
  const expectedPatchHash = createHash("sha256")
    .update("crdd-candidate-revision-v1\0")
    .update(bundle.baseCommit)
    .update("\0")
    .update(bundle.baseTree)
    .update("\0")
    .update(bundle.baseManifestHash)
    .update("\0")
    .update(bundle.contentManifestHash)
    .update("\0")
    .update(bundle.allowedPathsHash)
    .update("\0")
    .update(TARGET_PATH)
    .digest("hex");
  const content = Buffer.from(contentBase64, "base64");
  if (bundle.patchHash !== expectedPatchHash) return "derived_patch_hash";
  if (content.toString("base64") !== contentBase64)
    return "candidate_content_base64";
  if (!content.equals(Buffer.from(EXPECTED_CONTENT, "utf8"))) {
    if (
      content.equals(
        Buffer.from(EXPECTED_CONTENT.replace("\n", "\r\n"), "utf8"),
      )
    )
      return "candidate_content_crlf";
    if (content.equals(Buffer.from(EXPECTED_CONTENT.trimEnd(), "utf8")))
      return "candidate_content_missing_lf";
    if (content.equals(Buffer.from(BASE_CONTENT, "utf8")))
      return "candidate_content_base_unchanged";
    return "candidate_content_bytes";
  }
  if (entry.byteLength !== content.byteLength) return "candidate_byte_length";
  if (entry.sha256 !== createHash("sha256").update(content).digest("hex"))
    return "candidate_sha256";
  return null;
}

/**
 * Signed General Task Verificationを実行する。
 *
 * @responsibility Signed General Task Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input repositoryRoot: string、dependencies: VerificationDependencies、routeProfile: SignedGeneralTaskRouteProfile
 * @returns Promise<SignedGeneralTaskVerificationResult>を返す。
 * @precondition 「repositoryRoot: string、dependencies: VerificationDependencies、routeProfile: SignedGeneralTaskRouteProfile」がrunSignedGeneralTaskVerificationの入力契約を満たす。
 * @postcondition runSignedGeneralTaskVerificationの責務を完了した結果だけを返す。
 * @effect N/A: runSignedGeneralTaskVerificationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runSignedGeneralTaskVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runSignedGeneralTaskVerificationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runSignedGeneralTaskVerificationはProcess内の同一Subsystemで完結する。
 * @security N/A: runSignedGeneralTaskVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runSignedGeneralTaskVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runSignedGeneralTaskVerification(
  repositoryRoot: string,
  dependencies: VerificationDependencies = productionDependencies,
  routeProfile: SignedGeneralTaskRouteProfile = "forward",
): Promise<SignedGeneralTaskVerificationResult> {
  if (
    routeProfile !== "forward" &&
    routeProfile !== "reverse" &&
    routeProfile !== "same-codex" &&
    routeProfile !== "same-claude"
  ) {
    return blocked(
      "signed_general_task_verification_arguments_invalid",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  const route = ROUTE_EXPECTATIONS[routeProfile];
  if (!path.isAbsolute(repositoryRoot)) {
    return blocked(
      "signed_general_task_repository_root_invalid",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let isSupportedRuntime = false;
  try {
    isSupportedRuntime = isSupportedCoordinatorNodeRuntime(
      dependencies.runtimeVersion(),
    );
  } catch {
    // The explicit prerequisites remain unconfirmed.
  }
  if (!isSupportedRuntime) {
    return blocked(
      "signed_general_task_node_version_unsupported",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let release: RuntimeRecord | null = null;
  let verifiedPackageCapability: unknown = null;
  try {
    const issued = dependencies.issuePackageCapability({
      evaluationTime: dependencies.now(),
    });
    release = plainRecord(issued.verification);
    verifiedPackageCapability = issued.capability;
  } catch {
    // The package verifier result remains unavailable and cannot open the gate.
  }
  if (isRuntimeProcessPoisoned()) {
    return blocked(
      "signed_general_task_process_restart_required",
      release,
      Object.freeze({
        canonicalRepositoryChanged: false,
        manualRecoveryRequired: true,
        processRestartRequired: isRuntimeProcessPoisoned(),
      }),
    );
  }
  if (
    !verifiedPackage(release) ||
    !verifiedPackageCapability ||
    typeof verifiedPackageCapability !== "object"
  ) {
    return blocked(
      "signed_general_task_release_verification_failed",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  if (
    !isSupportedCrddRuntimeGitObjectId(release.crddCommit) ||
    !isSupportedCrddRuntimeGitObjectId(release.crddTree)
  ) {
    return blocked(
      "signed_general_task_git_object_format_unsupported",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let executionRevision: ExecutionRevision | null = null;
  try {
    const observed = plainRecord(
      dependencies.inspectRepositoryRevision(repositoryRoot),
    );
    if (
      observed?.status === "candidate" &&
      isCanonicalCrddGitObjectId(observed.commit) &&
      isCanonicalCrddGitObjectId(observed.tree) &&
      isSupportedCrddRuntimeGitObjectId(observed.commit) &&
      isSupportedCrddRuntimeGitObjectId(observed.tree)
    ) {
      executionRevision = Object.freeze({
        commit: observed.commit,
        tree: observed.tree,
      });
    }
  } catch {
    // The execution repository revision remains unconfirmed.
  }
  if (!executionRevision) {
    return blocked(
      "signed_general_task_repository_revision_observation_failed",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let baseContentMatches = false;
  try {
    const baseContent = dependencies.readBaseContent(repositoryRoot);
    baseContentMatches =
      Buffer.isBuffer(baseContent) &&
      baseContent.equals(Buffer.from(BASE_CONTENT, "utf8"));
  } catch {
    // The fixed verification base remains unconfirmed.
  }
  if (!baseContentMatches) {
    return blocked(
      "signed_general_task_base_content_mismatch",
      release,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  let rawStarted: unknown;
  try {
    rawStarted = dependencies.startTask(
      createSignedGeneralTaskVerificationRequest(routeProfile),
      repositoryRoot,
      verifiedPackageCapability,
    );
  } catch {
    ensureRuntimeProcessPoisoned();
    return blocked(
      "signed_general_task_start_failed_closed",
      null,
      Object.freeze({ canonicalRepositoryChanged: false }),
    );
  }
  const started = snapshotStartedTask(rawStarted);
  const controlCapability = started.controlCapability;
  const completionObservation = started.completionObservation;
  const isCompletionObserverUnknown = started.completionObserverUnknown;
  const timing = settlementTiming(dependencies);
  let isCancelAttempted = false;
  let cancelCompletion: Promise<unknown> | null = null;
  const requestCancellation = () => {
    if (isCancelAttempted) return cancelCompletion;
    isCancelAttempted = true;
    if (!controlCapability) return null;
    try {
      cancelCompletion = Promise.resolve(
        dependencies.cancelTask(controlCapability),
      ).then(
        (value) => value,
        () => null,
      );
    } catch {
      cancelCompletion = Promise.resolve(null);
    }
    return cancelCompletion;
  };
  let cancellationBinding: CancellationBinding | null = null;
  let taskResult: RuntimeRecord | null = null;
  let discarded: RuntimeRecord | null = null;
  let isCandidateDiscarded = false;
  let cancellationRequested = false;
  let executionStateProjection: RuntimeRecord | null = null;
  let isPostStartUnknown = false;
  let postStartUnknownReason: SignedGeneralTaskPublicReason =
    "signed_general_task_post_start_observation_unknown";
  let knownOutcome: SignedGeneralTaskVerificationResult | null = null;
  let cancellationReceipt: Readonly<{
    processTerminationObserved: boolean;
  }> | null = null;
  const signalCancellation = Symbol("signedGeneralTaskSignalCancellation");
  try {
    if (!controlCapability || !completionObservation) {
      isPostStartUnknown = true;
      postStartUnknownReason = !controlCapability
        ? "signed_general_task_started_task_observation_unknown"
        : isCompletionObserverUnknown
          ? "signed_general_task_completion_observer_unknown"
          : "signed_general_task_started_task_completion_unknown";
      if (controlCapability) requestCancellation();
    } else {
      cancellationBinding = dependencies.bindCancellation(
        controlCapability,
        () => undefined,
      );
      const first = await Promise.race([
        completionObservation.then((outcome) =>
          Object.freeze({ kind: "completion" as const, outcome }),
        ),
        cancellationBinding.requestedPromise.then(() =>
          Object.freeze({ kind: "cancellation" as const, outcome: null }),
        ),
      ]);
      if (first.kind === "cancellation") {
        cancellationRequested = true;
        requestCancellation();
        throw signalCancellation;
      }
      if (first.outcome.status !== "fulfilled") {
        postStartUnknownReason = "signed_general_task_completion_rejected";
        throw new Error(postStartUnknownReason);
      }
      taskResult = plainRecord(first.outcome.value);

      if (!taskResult) {
        postStartUnknownReason = "signed_general_task_result_contract_mismatch";
        throw new Error(postStartUnknownReason);
      }

      const safety = evaluateSignedRunnerSafetyObservation(
        taskResult,
        TASK_SAFETY_SCHEMA,
      );
      if (safety.status !== "exact") {
        postStartUnknownReason =
          "signed_general_task_safety_observation_unknown";
        throw new Error(postStartUnknownReason);
      }
      if (
        taskResult.processRestartRequired === true &&
        !isRuntimeProcessPoisoned()
      )
        ensureRuntimeProcessPoisoned();

      let executionRevisionMismatch: string | null =
        "execution_repository_revision_observation_unknown";
      try {
        const observed = plainRecord(
          dependencies.inspectRepositoryRevision(repositoryRoot),
        );
        if (
          observed?.status === "candidate" &&
          isCanonicalCrddGitObjectId(observed.commit) &&
          isCanonicalCrddGitObjectId(observed.tree) &&
          isSupportedCrddRuntimeGitObjectId(observed.commit) &&
          isSupportedCrddRuntimeGitObjectId(observed.tree)
        ) {
          executionRevisionMismatch =
            observed.commit !== executionRevision.commit
              ? "execution_repository_commit_changed"
              : observed.tree !== executionRevision.tree
                ? "execution_repository_tree_changed"
                : null;
        }
      } catch {
        // Unknown observation fails closed after candidate cleanup.
      }
      executionStateProjection = Object.freeze({
        manifestHash: release.manifestHash,
        packageContentRootSha256: release.packageContentRootSha256,
        runtimeExecutionIdentitySha256: release.runtimeExecutionIdentitySha256,
        crddVersion: release.crddVersion,
        releaseSequence: release.releaseSequence,
        crddCommit: release.crddCommit,
        crddTree: release.crddTree,
        executionCommit: executionRevision.commit,
        executionTree: executionRevision.tree,
        canonicalRepositoryChanged:
          executionRevisionMismatch === null
            ? false
            : executionRevisionMismatch ===
                  "execution_repository_commit_changed" ||
                executionRevisionMismatch ===
                  "execution_repository_tree_changed"
              ? true
              : null,
        effectStateUnknown:
          executionRevisionMismatch ===
          "execution_repository_revision_observation_unknown",
      });

      const candidateId = taskResult.candidateId;
      let candidateMismatch: string | null = "candidate_not_read";
      if (typeof candidateId === "string") {
        try {
          const candidate = plainRecord(
            dependencies.readCandidate(candidateId),
          );
          candidateMismatch = candidateContractMismatch(
            candidate,
            candidateId,
            taskResult,
          );
        } catch {
          candidateMismatch = "candidate_read_failed";
        }
        try {
          discarded = plainRecord(dependencies.discardCandidate(candidateId));
        } catch {
          discarded = null;
        }
        isCandidateDiscarded = discarded?.status === "discarded";
        if (discarded?.status !== "discarded") {
          knownOutcome = blocked(
            "signed_general_task_candidate_discard_failed",
            taskResult,
            Object.freeze({
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              candidateDiscarded: false,
              candidateDisposition: "recovery_required",
              candidateIdForManualDiscard: candidateId,
              ...executionStateProjection,
            }),
            Object.freeze([discarded]),
          );
        }
      }

      if (knownOutcome) {
        // Candidate cleanup result is already the authoritative outcome.
      } else if (
        taskResultContractMismatch(
          taskResult,
          executionRevision,
          executionRevisionMismatch,
          route,
        ) !== null
      ) {
        const resultContractMismatch = taskResultContractMismatch(
          taskResult,
          executionRevision,
          executionRevisionMismatch,
          route,
        );
        const reviewerDiagnosis = reviewerDiagnosisProjection(taskResult);
        const mismatchReason = executionRevisionMismatch
          ? executionRevisionMismatch ===
            "execution_repository_revision_observation_unknown"
            ? "signed_general_task_execution_repository_observation_unknown"
            : "signed_general_task_execution_repository_changed"
          : taskResult?.status === "blocked"
            ? safeReason(
                taskResult.reason,
                "signed_general_task_result_contract_mismatch",
              )
            : "signed_general_task_result_contract_mismatch";
        knownOutcome = isCandidateDiscarded
          ? blockedAfterExactCandidateDiscard(
              mismatchReason,
              taskResult,
              Object.freeze({
                resultContractMismatch,
                ...reviewerDiagnosis,
                ...executionStateProjection,
              }),
            )
          : (blockedAfterConfirmedCandidateNotIssued(
              mismatchReason,
              taskResult,
              Object.freeze({
                resultContractMismatch,
                ...reviewerDiagnosis,
                ...executionStateProjection,
              }),
            ) ??
            blocked(
              mismatchReason,
              taskResult,
              Object.freeze({
                candidateDiscarded: false,
                candidateDisposition: "recovery_required",
                resultContractMismatch,
                ...reviewerDiagnosis,
                ...executionStateProjection,
              }),
            ));
      } else if (typeof candidateId !== "string") {
        knownOutcome = blocked(
          "signed_general_task_candidate_id_missing",
          taskResult,
          executionStateProjection,
        );
      } else if (candidateMismatch !== null) {
        knownOutcome = blockedAfterExactCandidateDiscard(
          "signed_general_task_candidate_content_mismatch",
          taskResult,
          Object.freeze({
            candidateContractMismatch: candidateMismatch,
            ...executionStateProjection,
          }),
        );
      } else {
        knownOutcome = Object.freeze({
          contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
          contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
          status: "completed" as const,
          reason: "signed_general_task_verification_completed",
          manifestHash: release.manifestHash,
          packageContentRootSha256: release.packageContentRootSha256,
          runtimeExecutionIdentitySha256:
            release.runtimeExecutionIdentitySha256,
          crddVersion: release.crddVersion,
          releaseSequence: release.releaseSequence,
          crddCommit: release.crddCommit,
          crddTree: release.crddTree,
          executionCommit: executionRevision.commit,
          executionTree: executionRevision.tree,
          requestedRouteProfile: routeProfile,
          route: route.route,
          requestedFrontProvider: route.frontProvider,
          observedFrontProvider: null,
          frontIdentityVerified: false,
          executorProvider: route.executorProvider,
          reviewerProvider: route.reviewerProvider,
          reviewerIndependence: "provider_independent" as const,
          externalSendAuthorizationMode:
            taskResult.externalSendAuthorizationMode ===
            "interactive_initial_consent"
              ? ("interactive_initial_consent" as const)
              : ("reused_initial_consent" as const),
          remediationPerformed: taskResult.remediationPerformed as boolean,
          changedPaths: Object.freeze([TARGET_PATH]),
          exactCandidateContentVerified: true,
          candidateDiscarded: true,
          candidateDisposition: "discarded" as const,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          effectStateUnknown: false,
          hostRecoveryId: null,
          hostRecoveryIds: Object.freeze([]),
          dockerRecoveryId: null,
          dockerRecoveryIds: Object.freeze([]),
          candidateRecoveryId: null,
          candidateRecoveryIds: Object.freeze([]),
          candidateStoreRecoveryId: null,
          candidateStoreRecoveryIds: Object.freeze([]),
          recoveryIdentityAmbiguous: false,
          canonicalRepositoryChanged: false,
          rawProviderOutputReported: false,
          hostPathReported: false,
          credentialReported: false,
        });
      }
    }
  } catch (error) {
    if (error !== signalCancellation) {
      isPostStartUnknown = true;
      requestCancellation();
    }
  } finally {
    if (cancellationBinding) {
      try {
        cancellationBinding.unbind();
      } catch {
        isPostStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_unbind_unknown";
      }
      try {
        cancellationRequested = cancellationBinding.requested();
      } catch {
        isPostStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_observation_unknown";
      }
    }
    if (cancellationRequested) requestCancellation();
    if (isPostStartUnknown) requestCancellation();
    if (cancelCompletion) {
      const cancelSettlement = await boundedSettlement(
        cancelCompletion,
        timing.cancelAckTimeoutMs,
      );
      cancellationReceipt =
        cancelSettlement.status === "fulfilled"
          ? exactCancellationReceipt(cancelSettlement.value)
          : null;
      if (!cancellationReceipt) {
        isPostStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_completion_unknown";
      }
    }
    if (
      completionObservation &&
      (isPostStartUnknown || cancellationRequested) &&
      taskResult === null
    ) {
      const completionSettlement = await boundedSettlement(
        completionObservation,
        controlCapability
          ? timing.cancelCompletionTimeoutMs
          : timing.orphanedStartObservationTimeoutMs,
      );
      if (
        completionSettlement.status === "fulfilled" &&
        completionSettlement.value.status === "fulfilled"
      )
        taskResult = plainRecord(completionSettlement.value.value);
      else {
        isPostStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_completion_settlement_unknown";
      }
    }
    if (taskResult && (isPostStartUnknown || cancellationRequested)) {
      const safety = evaluateSignedRunnerSafetyObservation(
        taskResult,
        TASK_SAFETY_SCHEMA,
      );
      if (safety.status !== "exact") {
        isPostStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_safety_observation_unknown";
      } else if (
        taskResult.processRestartRequired === true &&
        !isRuntimeProcessPoisoned()
      ) {
        ensureRuntimeProcessPoisoned();
      }
      if (
        cancellationReceipt?.processTerminationObserved === false &&
        taskResult.cleanupConfirmed !== true
      ) {
        isPostStartUnknown = true;
        postStartUnknownReason =
          "signed_general_task_cancellation_cleanup_unknown";
      }
    }
    if ((isPostStartUnknown || cancellationRequested) && taskResult) {
      const candidateId = taskResult.candidateId;
      if (typeof candidateId === "string" && !isCandidateDiscarded) {
        try {
          discarded = plainRecord(dependencies.discardCandidate(candidateId));
          isCandidateDiscarded = discarded?.status === "discarded";
        } catch {
          discarded = null;
        }
      }
    }
  }
  if (isPostStartUnknown)
    return postStartUnknownBlocked(
      postStartUnknownReason,
      taskResult,
      discarded,
      isCandidateDiscarded,
      executionStateProjection,
    );
  if (cancellationRequested)
    return blocked(
      "signed_general_task_cancelled",
      taskResult,
      Object.freeze({
        candidateDiscarded: isCandidateDiscarded,
        ...(executionStateProjection ?? {}),
      }),
      Object.freeze([discarded]),
    );
  if (isRuntimeProcessPoisoned())
    return blocked(
      "signed_general_task_process_restart_required",
      taskResult,
      Object.freeze({
        candidateDiscarded: isCandidateDiscarded,
        ...(executionStateProjection ?? {}),
      }),
      Object.freeze([discarded]),
    );
  if (!knownOutcome)
    return postStartUnknownBlocked(
      "signed_general_task_final_outcome_unknown",
      taskResult,
      discarded,
      isCandidateDiscarded,
      executionStateProjection,
    );
  return knownOutcome;
}

/**
 * Signed General Task Verification 契約の公開契約を記述する。
 *
 * @responsibility Signed General Task Verification 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeSignedGeneralTaskVerificationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeSignedGeneralTaskVerificationContractの入力契約を満たす。
 * @postcondition describeSignedGeneralTaskVerificationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeSignedGeneralTaskVerificationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeSignedGeneralTaskVerificationContractは独自の失敗分岐を所有しない。
 * @invariant describeSignedGeneralTaskVerificationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeSignedGeneralTaskVerificationContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeSignedGeneralTaskVerificationContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeSignedGeneralTaskVerificationContractは共有非同期状態を持たない同期処理である。
 */
export function describeSignedGeneralTaskVerificationContract() {
  return Object.freeze({
    contract: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT,
    contractRevision: SIGNED_GENERAL_TASK_VERIFICATION_CONTRACT_REVISION,
    invocation: "direct_repository_owned_node_entrypoint",
    minimumNodeVersion: MINIMUM_COORDINATOR_NODE_VERSION,
    nodeSelection: "absolute_preverified_executable_only",
    availabilityOnlyConsolePreflightAllowed: false,
    interactiveConsoleGate:
      "runtime_owned_initial_consent_confirmation_only_reused_consent_requires_no_console",
    packageCapabilityUse:
      "runtime_local_nonserializable_nonexported_passed_once_to_task_runtime_after_release_verification",
    requestConstruction: "fixed_public_request_constructed_in_process",
    requestShellTransportAllowed: false,
    powershellTextPipelineAllowed: false,
    temporaryRequestFileAllowed: false,
    longShellCommandReconstructionAllowed: false,
    normalTaskStdinContractChanged: false,
    interactiveBoundary:
      "runtime_owned_console_challenge_for_external_send_only",
    providerRoutes: Object.freeze([
      ROUTE_EXPECTATIONS.forward.route,
      ROUTE_EXPECTATIONS.reverse.route,
      ROUTE_EXPECTATIONS["same-codex"].route,
      ROUTE_EXPECTATIONS["same-claude"].route,
    ]),
    defaultRouteProfile: "forward",
    routeArgumentGrammar:
      "no_arguments_or_exact_--route_reverse_or_--route_same-codex_or_--route_same-claude",
    frontIdentityBinding:
      "not_claimed_by_runner_result_requires_separate_fixed_run_evidence",
    candidateDisposition:
      "completed_or_exactly_discarded_candidate_is_discarded_reviewer_rejection_before_persistence_is_not_issued_unknown_cleanup_is_recovery_required",
    verificationFixture:
      "tracked_base_marker_exact_token_replacement_with_independent_final_byte_verification",
    baseContentPreflight:
      "exact_tracked_lf_bytes_verified_before_task_or_provider_effect",
    identityBinding:
      "signed_distribution_source_and_manifest_only_distribution_commit_are_separate_from_work_repository_execution_revision_candidate_base_uses_execution_revision_observed_before_and_after_task",
    boundedRemediation:
      "zero_or_one_runtime_owned_remediation_then_same_independent_reviewer_approval_required",
    taskFailureReasonProjection:
      "known_task_failure_reason_preserved_candidate_integrity_failure_distinct_from_reviewer_semantic_rejection",
    resultMismatchDiagnostic:
      "fixed_contract_field_identifier_only_no_provider_text_path_or_credential",
    candidateMismatchDiagnostic:
      "fixed_candidate_contract_or_public_fixture_byte_identifier_only_no_candidate_bytes_provider_text_path_or_credential",
    processRestartProjection:
      "task_started_completion_or_restart_observation_unknown_irreversibly_poisons_shared_process_before_return_and_exact_false_plus_unpoisoned_state_required_for_success",
    cancellationSettlement: Object.freeze({
      acknowledgmentTimeoutMs: PRODUCTION_CANCEL_ACK_TIMEOUT_MS,
      completionTimeoutMs: PRODUCTION_CANCEL_COMPLETION_TIMEOUT_MS,
      orphanedStartObservationTimeoutMs:
        PRODUCTION_ORPHANED_START_OBSERVATION_TIMEOUT_MS,
      ordering: "acknowledgment_then_completion",
      productionOverrideAllowed: false,
    }),
    canonicalRepositoryEffectAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
}

/**
 * verify-signed-general-taskのCommand処理を開始する。
 *
 * @responsibility verify-signed-general-taskの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: mainは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了して呼出し元へ制御を戻す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure mainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  const args = process.argv.slice(2);
  if (
    !(
      args.length === 0 ||
      (args.length === 2 &&
        args[0] === "--route" &&
        (args[1] === "reverse" ||
          args[1] === "same-codex" ||
          args[1] === "same-claude"))
    )
  ) {
    throw new Error("signed_general_task_verification_arguments_invalid");
  }
  const routeProfile: SignedGeneralTaskRouteProfile =
    args.length === 0 ? "forward" : (args[1] as SignedGeneralTaskRouteProfile);
  const result = await runSignedGeneralTaskVerification(
    resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd()),
    productionDependencies,
    routeProfile,
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error: unknown) {
    const reason = safeReason(
      error instanceof Error ? error.message : null,
      "signed_general_task_verification_failed_closed",
    );
    process.stdout.write(
      `${JSON.stringify(
        blocked(
          reason,
          null,
          Object.freeze({ canonicalRepositoryChanged: false }),
        ),
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
  }
}
