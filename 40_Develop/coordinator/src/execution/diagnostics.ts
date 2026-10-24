/**
 * 単発診断のOperation・観測・回収とreadiness結果を構成する。
 *
 * @responsibility 単発Operationの取得・下位観測・必要な隔離Probeを編成し、受付失敗と非秘密の診断結果を投影する。
 * @trace ARCH-000004
 */

import { performance } from "node:perf_hooks";
import fs from "node:fs";
import {
  writeSync,
  opendirSync,
  lstatSync,
  realpathSync,
  type BigIntStats,
  openSync,
  constants,
  fstatSync,
  readSync,
  closeSync,
} from "node:fs";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { snapshotCoordinatorTaskRequest } from "./request.ts";
import {
  observeNativeArtifact,
  createWindowsNativeHelperEnvironment,
  createWindowsHostOperationSupervisorEnvironment,
} from "../../../platform-access/src/index.ts";
import {
  verifyOwnedOperationManagementCapability,
  borrowRuntimeOwnedRepositorySource,
  classifyOwnedCoordinatorOperationCreationFailure,
  describeFilesystemPolicy,
  createRuntimeOwnedCoordinatorOperation,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  cleanupOwnedOperationDirectories,
  transitionHostRecoveryState,
  recoverOwnedOperationDirectories,
  getOwnedHostRecoveryId,
  createOwnedMountCapability,
  verifyOwnedMountCapability,
  acquireHostOperationRecoveryGenerationByIdentity,
  releaseHostOperationRecoveryGeneration,
} from "./operation.ts";
import { createHash, randomUUID } from "node:crypto";
import {
  inspectRepositoryIdentityCandidate,
  inspectRepositoryRevisionCandidate,
  describeRepositoryLocationContract,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import { types as utilTypes } from "node:util";
import { isRuntimeProcessEffectBlocked } from "./process-safety-state.ts";
import {
  describeRootProtectionPolicyContract,
  describeAuthorityGrantVerifierContract,
  describeAuthorityTrustLoaderContract,
  describeAuthorityFileBundleContract,
  describeAuthorityPrelaunchVerifierContract,
  describeProviderHomeContract,
  describeProviderHomeMountGrantContract,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
  compileWindowsRootObservationCandidate,
} from "./authority.ts";
import { describeProviderIsolationContract } from "./preparation.ts";
import {
  describeDockerProxyTopology,
  createDockerProbeRuntimeBinding,
  type DockerProbeProfile,
  type classifyDockerProbeExecution,
  type DockerMounts,
  inspectDockerProbeContainer,
  describeDockerProbeConfiguration,
  observeDockerProbeContainerAbsence,
  cleanupDockerProbeContainer,
  observeDockerProbeEngine,
  writeDockerProbeRecoveryRecord,
  createDockerProbeContainer,
  runDockerProbeToCompletion,
  runDockerProbeCancellation,
  startDockerProbeResidue,
  parseDockerProbeRecoveryToken,
  loadDockerProbeRecoveryRecord,
  requireDockerProbeRecoveryMounts,
  describeDockerProbeResource,
} from "../../../docker-isolation/src/index.ts";
import { parseHostRecoveryToken } from "./result.ts";
import {
  describeProviderBillingPolicy,
  PROVIDER_AUTHENTICATION_POLICIES as AUTH_POLICIES,
} from "../../../ai-adapter/src/index.ts";
import type { Writable } from "node:stream";
import type { CoordinatorExecutionPublicationObservation } from "../task/types.ts";
import { observeLeaseOwner } from "./kernel-lock.ts";

const STATE_LABELS = Object.freeze({
  "STATE-ADMISSION": "受付・実行条件の確認",
  "STATE-OPERATION-ACQUIRING": "作業領域と排他制御の準備",
  "STATE-OPERATION-READY": "権限・送信許可・入力の準備",
  "STATE-TASK-AUTHORIZED": "実装段階（起動準備・回収を含む）",
  "STATE-EXECUTOR-CLEAN": "実装候補の取得・検証",
  "STATE-CANDIDATE-CAPTURED": "レビュー段階（起動準備・回収を含む）",
  "STATE-REVIEWER-CLEAN": "レビュー結果の確認・候補保存",
  "STATE-REMEDIATION-AUTHORIZED": "是正実装の準備・実行・回収",
  "STATE-REMEDIATION-EXECUTOR-CLEAN": "是正候補の取得・検証",
  "STATE-REMEDIATION-CANDIDATE-CAPTURED": "再レビューの準備・実行・回収",
  "STATE-REMEDIATION-REVIEWER-CLEAN": "再レビュー結果の確認・候補保存",
  "STATE-HOST-CLEAN": "結果の公開条件確認",
  "STATE-RESULT-PUBLISHED": "比較用候補の破棄・終了記録",
  "STATE-BLOCKED-CLEAN": "停止結果の記録（回収確認済み）",
  "STATE-PROCESS-RESTART-REQUIRED": "停止結果の記録（再起動が必要）",
  "STATE-RECOVERY-REQUIRED": "停止結果の記録（復旧が必要）",
  "STATE-OPERATOR-TRANSFER-REQUIRED": "停止結果の記録（人間への引渡しが必要）",
});

/**
 * development-execution-timingで使用するIntervalの値契約を定義する。
 *
 * @responsibility IntervalのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000018
 * @shape Intervalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Intervalで宣言した値と責務の対応を維持する。
 * @boundary N/A: Intervalの宣言は外部境界を開かない。
 * @security N/A: IntervalはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Intervalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Interval = Readonly<{
  state: string;
  elapsedMs: number | null;
}>;

/**
 * 観測用の計測だけを構築し、Authority用時計・Timer・Listener・Capabilityを追加しない。
 *
 * @responsibility Development Execution Timingの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000018
 * @input now: () => number、writeProgress: (text: string) => boolean
 * @returns createDevelopmentExecutionTimingの計算結果を返す。
 * @precondition 「now: () => number、writeProgress: (text: string) => boolean」がcreateDevelopmentExecutionTimingの入力契約を満たす。
 * @postcondition createDevelopmentExecutionTimingの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentExecutionTimingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createDevelopmentExecutionTimingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDevelopmentExecutionTimingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentExecutionTimingはProcess内の同一Subsystemで完結する。
 * @security N/A: createDevelopmentExecutionTimingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createDevelopmentExecutionTimingは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentExecutionTiming(
  now: () => number = () => performance.now(),
  writeProgress?: (text: string) => boolean,
) {
  let measurementComplete = true;
  let progressConfirmed = true;
  let isFinished = false;
  let previousTime: number | null = null;
  let stateStartedAt: number | null = null;
  let currentState: string | null = null;
  let firstStateAt: number | null = null;
  let finishedAt: number | null = null;
  let identityCount = 0;
  let identityElapsedMs = 0;
  let identityMeasurementComplete = true;
  const intervals: Interval[] = [];

  /**
   * Timeを読み取る。
   *
   * @responsibility Timeの読取り元、上限、読取不能時の結果境界を所有する。
   * @trace ARCH-000018
   * @input N/A: 実行時引数を受け取らない。
   * @returns readTimeの計算結果を返す。
   * @precondition 「N/A: 実行時引数を受け取らない。」がreadTimeの入力契約を満たす。
   * @postcondition readTimeの責務を完了した結果だけを返す。
   * @effect N/A: readTimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure readTimeは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant readTimeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: readTimeはProcess内の同一Subsystemで完結する。
   * @security N/A: readTimeはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: readTimeは共有非同期状態を持たない同期処理である。
   */
  function readTime() {
    try {
      const value = now();
      if (
        !Number.isFinite(value) ||
        value < 0 ||
        (previousTime !== null && value < previousTime)
      ) {
        measurementComplete = false;
        return null;
      }
      previousTime = value;
      return value;
    } catch {
      measurementComplete = false;
      return null;
    }
  }
  const startedAt = readTime();

  /**
   * Intervalを終了する。
   *
   * @responsibility Intervalの終了条件、資源解放、終了不能時の境界を所有する。
   * @trace ARCH-000018
   * @input time: number | null
   * @returns closeIntervalの計算結果を返す。
   * @precondition 「time: number | null」がcloseIntervalの入力契約を満たす。
   * @postcondition closeIntervalの責務を完了した結果だけを返す。
   * @effect N/A: closeIntervalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: closeIntervalは独自の失敗分岐を所有しない。
   * @invariant closeIntervalは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: closeIntervalはProcess内の同一Subsystemで完結する。
   * @security N/A: closeIntervalはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: closeIntervalは共有非同期状態を持たない同期処理である。
   */
  function closeInterval(time: number | null) {
    if (currentState === null) return;
    intervals.push(
      Object.freeze({
        state: currentState,
        elapsedMs:
          time !== null && stateStartedAt !== null
            ? time - stateStartedAt
            : null,
      }),
    );
  }

  return Object.freeze({
    /**
     * Lifecycle 状態を観測する。
     *
     * @responsibility Lifecycle 状態の観測対象、取得根拠、観測不能結果の境界を所有する。
     * @trace ARCH-000018
     * @input state: string
     * @returns observeLifecycleStateの計算結果を返す。
     * @precondition 「state: string」がobserveLifecycleStateの入力契約を満たす。
     * @postcondition observeLifecycleStateの責務を完了した結果だけを返す。
     * @effect 局所計測値を更新し、指定された進行出力callbackがある場合は固定ラベルを同期配送する。
     * @failure observeLifecycleStateは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant observeLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
     * @boundary 計測状態と呼出し元が指定した進行出力先の境界。取消・実行Authorityを発行しない。
     * @security N/A: observeLifecycleStateはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: observeLifecycleStateは共有非同期状態を持たない同期処理である。
     */
    observeLifecycleState(state: string) {
      if (isFinished || state === currentState) return;
      if (!Object.hasOwn(STATE_LABELS, state) || intervals.length >= 31) {
        measurementComplete = false;
        return;
      }
      const time = readTime();
      if (currentState === null && intervals.length === 0) firstStateAt = time;
      closeInterval(time);
      currentState = state;
      stateStartedAt = time;
      if (writeProgress && progressConfirmed) {
        try {
          progressConfirmed =
            writeProgress(
              `[進行状況] ${STATE_LABELS[state as keyof typeof STATE_LABELS]}\n`,
            ) === true;
        } catch {
          progressConfirmed = false;
        }
      }
    },
    /**
     * measure Identityを決定する。
     *
     * @responsibility measure Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000018
     * @input observe: () => Result
     * @returns Resultを返す。
     * @precondition 「observe: () => Result」がmeasureIdentityの入力契約を満たす。
     * @postcondition measureIdentityの責務を完了した結果だけを返す。
     * @effect N/A: measureIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: measureIdentityは独自の失敗分岐を所有しない。
     * @invariant measureIdentityは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: measureIdentityはProcess内の同一Subsystemで完結する。
     * @security N/A: measureIdentityはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: measureIdentityは共有非同期状態を持たない同期処理である。
     */
    measureIdentity<Result>(observe: () => Result): Result {
      if (isFinished) return observe();
      const before = readTime();
      identityCount += 1;
      try {
        return observe();
      } finally {
        const after = readTime();
        if (before === null || after === null) {
          identityMeasurementComplete = false;
        } else {
          identityElapsedMs += after - before;
        }
      }
    },
    /**
     * development-execution-timingを終了状態へ収束させる。
     *
     * @responsibility development-execution-timingの終了条件、最終状態、残存義務の境界を所有する。
     * @trace ARCH-000018
     * @input N/A: 実行時引数を受け取らない。
     * @returns finishの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がfinishの入力契約を満たす。
     * @postcondition finishの責務を完了した結果だけを返す。
     * @effect N/A: finishは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: finishは独自の失敗分岐を所有しない。
     * @invariant finishは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: finishはProcess内の同一Subsystemで完結する。
     * @security N/A: finishはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: finishは共有非同期状態を持たない同期処理である。
     */
    finish() {
      if (isFinished) return;
      finishedAt = readTime();
      closeInterval(finishedAt);
      currentState = null;
      isFinished = true;
    },
    /**
     * development-execution-timingを所有Snapshotへ変換する。
     *
     * @responsibility development-execution-timingの取得範囲、plain-data制約、拒否境界を所有する。
     * @trace ARCH-000018
     * @input N/A: 実行時引数を受け取らない。
     * @returns snapshotの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がsnapshotの入力契約を満たす。
     * @postcondition snapshotの責務を完了した結果だけを返す。
     * @effect N/A: snapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: snapshotは独自の失敗分岐を所有しない。
     * @invariant snapshotは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: snapshotはProcess内の同一Subsystemで完結する。
     * @security N/A: snapshotはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: snapshotは共有非同期状態を持たない同期処理である。
     */
    snapshot() {
      return Object.freeze({
        measurementComplete,
        progressOutputConfirmed: writeProgress ? progressConfirmed : null,
        finished: isFinished,
        totalElapsedMs:
          finishedAt !== null && startedAt !== null
            ? finishedAt - startedAt
            : null,
        initialUnattributedMs:
          firstStateAt !== null && startedAt !== null
            ? firstStateAt - startedAt
            : null,
        intervals: Object.freeze([...intervals]),
        identityObservation: Object.freeze({
          callCount: identityCount,
          elapsedMs: identityMeasurementComplete ? identityElapsedMs : null,
          measurementComplete: identityMeasurementComplete,
        }),
      });
    },
  });
}

/**
 * 現在実装した公開操作とCLI相当だけを返す。
 * @responsibility 能力の表示と今回の操作許可を区別する。
 * @trace ARCH-000004
 * @input N/A: 外部入力を受けない。
 * @returns 不変な操作名・呼出し例の集合。
 * @precondition 固定候補で全操作の接続を検証する。
 * @postcondition 未接続のinspect・候補CLIを一覧へ含めない。
 * @effect N/A: 固定記述の生成のみ。
 * @failure N/A: 観測やI/Oを行わない。
 * @invariant 一覧表示からAuthorityを発行しない。
 * @boundary 正式APIと利用者向け能力表示。
 * @security 秘密・Root・認証状態を含めない。
 * @concurrency 不変の局所値。
 */
export function getCoordinatorCapabilities() {
  return Object.freeze({
    contract: "crdd-coordinator/capabilities",
    contractRevision: 5,
    profile: "local_personal",
    commands: Object.freeze(
      [
        "task run --request-stdin --json",
        "project init --json",
        "project run --request-stdin --json",
        "doctor check [--json]",
        "doctor isolation [--json]",
        "recovery resume <id> [--json]",
        "recovery restart-docker <id> [--json]",
        "maintenance repair-docker [--json]",
        "maintenance retain-repair <id> [--json]",
        "auth status codex|claude [--json]",
        "auth login codex|claude",
        "capabilities --json",
      ].map((invocation) =>
        Object.freeze({
          command: invocation
            .split(" ")
            .slice(0, invocation.startsWith("capabilities ") ? 1 : 2)
            .join(" "),
          availability: "available",
          invocation,
        }),
      ),
    ),
    operations: Object.freeze([
      "initializeProject",
      "runObjective",
      "runTask",
      "openTaskSession",
      "submitDecision",
      "acceptResult",
      "executeWorkspace",
      "queryState",
      "queryActivity",
      "diagnoseEnvironment",
      "recoverExecution",
      "restartDockerForRecovery",
      "repairDockerRuntime",
      "retainRepair",
      "readRepositoryAiSelection",
      "saveRepositoryAiSelection",
      "getAuthenticationStatus",
      "authenticateProvider",
    ]),
    executionAuthorityIssued: false,
  });
}

/**
 * Only fixed labels generated above reach this bounded best-effort sink.
 *
 * @responsibility Development Measurement Progressの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000018
 * @input text: string
 * @returns writeDevelopmentMeasurementProgressの計算結果を返す。
 * @precondition 「text: string」がwriteDevelopmentMeasurementProgressの入力契約を満たす。
 * @postcondition writeDevelopmentMeasurementProgressの責務を完了した結果だけを返す。
 * @effect 許可した固定ラベルのUTF-8列だけをstderr descriptor 2へ同期書込みする。
 * @failure writeDevelopmentMeasurementProgressは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeDevelopmentMeasurementProgressは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 固定ラベルの計測表示とOSのstderr書込み境界。
 * @security N/A: writeDevelopmentMeasurementProgressはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeDevelopmentMeasurementProgressは共有非同期状態を持たない同期処理である。
 */
export function writeDevelopmentMeasurementProgress(text: string) {
  try {
    if (
      !Object.values(STATE_LABELS).some(
        (label) => text === `[進行状況] ${label}\n`,
      )
    )
      return false;
    const bytes = Buffer.from(text, "utf8");
    if (bytes.byteLength > 256) return false;
    return writeSync(2, bytes) === bytes.byteLength;
  } catch {
    return false;
  }
}

const HASH_PATTERN = /^[a-f0-9]{64}$/;

const MAX_DURATION_MS = 3_600_000;

const CONFIG_KEYS = new Set(["bindingSha256", "expiresAtMs", "tasks"]);

const TASK_KEYS = new Set(["scopeSha256", "executor", "reviewer"]);

const OBSERVATION_KEYS = new Set([
  "bindingSha256",
  "wallTimeMs",
  "monotonicTimeMs",
]);

/**
 * development-measurement-constraintsで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";

/**
 * development-measurement-constraintsで使用するRoleの値契約を定義する。
 *
 * @responsibility RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Roleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Roleで宣言した値と責務の対応を維持する。
 * @boundary N/A: Roleの宣言は外部境界を開かない。
 * @security RoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Roleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Role = "executor" | "reviewer";

/**
 * development-measurement-constraintsで使用するStop Reasonの値契約を定義する。
 *
 * @responsibility Stop ReasonのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StopReasonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StopReasonで宣言した値と責務の対応を維持する。
 * @boundary N/A: StopReasonの宣言は外部境界を開かない。
 * @security StopReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StopReasonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StopReason =
  | "cancelled"
  | "expired"
  | "identity_mismatch"
  | "observation_invalid"
  | "cleanup_unknown";

/**
 * development-measurement-constraintsで使用するRefusalの値契約を定義する。
 *
 * @responsibility RefusalのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Refusalが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Refusalで宣言した値と責務の対応を維持する。
 * @boundary N/A: Refusalの宣言は外部境界を開かない。
 * @security RefusalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Refusalの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Refusal = StopReason | "task_unavailable" | "invocation_unavailable";

/**
 * development-measurement-constraintsで使用するConstraint 結果の値契約を定義する。
 *
 * @responsibility Constraint 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ConstraintResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConstraintResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConstraintResultの宣言は外部境界を開かない。
 * @security ConstraintResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConstraintResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ConstraintResult<T> =
  | Readonly<{ status: "recorded"; value: T }>
  | Readonly<{ status: "blocked"; reason: Refusal }>;

/**
 * development-measurement-constraintsで使用するObservationの値契約を定義する。
 *
 * @responsibility ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Observationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Observationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Observationの宣言は外部境界を開かない。
 * @security ObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Observationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Observation = Readonly<{
  bindingSha256: string;
  wallTimeMs: number;
  monotonicTimeMs: number;
}>;

/**
 * development-measurement-constraintsで使用するTask 状態の値契約を定義する。
 *
 * @responsibility Task 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskStateの宣言は外部境界を開かない。
 * @security TaskStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskState = {
  scopeSha256: string;
  executor: Provider;
  reviewer: Provider;
  token: object | null;
  settled: boolean;
  invocationCount: number;
  pendingCount: number;
};

/**
 * development-measurement-constraintsで使用するInvocation 状態の値契約を定義する。
 *
 * @responsibility Invocation 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape InvocationStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InvocationStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: InvocationStateの宣言は外部境界を開かない。
 * @security InvocationStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InvocationStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InvocationState = {
  task: TaskState;
  provider: Provider;
  role: Role;
  phase: "reserved" | "consumed" | "settled";
};

/**
 * Observationを構造化値へ解析する。
 *
 * @responsibility Observationの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Observation | nullを返す。
 * @precondition 「raw: unknown」がparseObservationの入力契約を満たす。
 * @postcondition parseObservationの責務を完了した結果だけを返す。
 * @effect N/A: parseObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseObservationは独自の失敗分岐を所有しない。
 * @invariant parseObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseObservationはProcess内の同一Subsystemで完結する。
 * @security parseObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseObservationは共有非同期状態を持たない同期処理である。
 */
function parseObservation(raw: unknown): Observation | null {
  const record = snapshotPlainRecord(raw, OBSERVATION_KEYS);
  if (
    !record ||
    typeof record.bindingSha256 !== "string" ||
    !HASH_PATTERN.test(record.bindingSha256) ||
    typeof record.wallTimeMs !== "number" ||
    !Number.isSafeInteger(record.wallTimeMs) ||
    record.wallTimeMs < 0 ||
    typeof record.monotonicTimeMs !== "number" ||
    !Number.isFinite(record.monotonicTimeMs) ||
    record.monotonicTimeMs < 0
  )
    return null;
  return Object.freeze({
    bindingSha256: record.bindingSha256,
    wallTimeMs: record.wallTimeMs,
    monotonicTimeMs: record.monotonicTimeMs,
  });
}

/**
 * refuseを決定する。
 *
 * @responsibility refuseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input reason: Refusal
 * @returns ConstraintResult<never>を返す。
 * @precondition 「reason: Refusal」がrefuseの入力契約を満たす。
 * @postcondition refuseの責務を完了した結果だけを返す。
 * @effect N/A: refuseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: refuseは独自の失敗分岐を所有しない。
 * @invariant refuseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: refuseはProcess内の同一Subsystemで完結する。
 * @security refuseはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: refuseは共有非同期状態を持たない同期処理である。
 */
function refuse(reason: Refusal): ConstraintResult<never> {
  return Object.freeze({ status: "blocked", reason });
}

/**
 * recordを決定する。
 *
 * @responsibility recordの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: T
 * @returns ConstraintResult<T>を返す。
 * @precondition 「value: T」がrecordの入力契約を満たす。
 * @postcondition recordの責務を完了した結果だけを返す。
 * @effect N/A: recordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recordは独自の失敗分岐を所有しない。
 * @invariant recordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recordはProcess内の同一Subsystemで完結する。
 * @security recordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recordは共有非同期状態を持たない同期処理である。
 */
function record<T>(value: T): ConstraintResult<T> {
  return Object.freeze({ status: "recorded", value });
}

/**
 * I/O-free accounting only. This factory neither authenticates approval/identity
 *
 * @responsibility Development Measurement Constraintsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、initialObservation: unknown
 * @returns createDevelopmentMeasurementConstraintsの計算結果を返す。
 * @precondition 「raw: unknown、initialObservation: unknown」がcreateDevelopmentMeasurementConstraintsの入力契約を満たす。
 * @postcondition createDevelopmentMeasurementConstraintsの責務を完了した結果だけを返す。
 * @effect N/A: createDevelopmentMeasurementConstraintsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDevelopmentMeasurementConstraintsは独自の失敗分岐を所有しない。
 * @invariant createDevelopmentMeasurementConstraintsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDevelopmentMeasurementConstraintsはProcess内の同一Subsystemで完結する。
 * @security createDevelopmentMeasurementConstraintsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDevelopmentMeasurementConstraintsは共有非同期状態を持たない同期処理である。
 */
export function createDevelopmentMeasurementConstraints(
  raw: unknown,
  initialObservation: unknown,
) {
  const config = snapshotPlainRecord(raw, CONFIG_KEYS);
  const initial = parseObservation(initialObservation);
  const taskSnapshots = snapshotPlainArray(config?.tasks, 2);
  if (
    !config ||
    !initial ||
    config.bindingSha256 !== initial.bindingSha256 ||
    typeof config.expiresAtMs !== "number" ||
    !Number.isSafeInteger(config.expiresAtMs) ||
    config.expiresAtMs <= initial.wallTimeMs ||
    config.expiresAtMs - initial.wallTimeMs > MAX_DURATION_MS ||
    taskSnapshots.status !== "ok" ||
    taskSnapshots.value.length !== 2
  )
    return null;

  const tasks: TaskState[] = [];
  for (const rawTask of taskSnapshots.value) {
    const task = snapshotPlainRecord(rawTask, TASK_KEYS);
    if (
      !task ||
      typeof task.scopeSha256 !== "string" ||
      !HASH_PATTERN.test(task.scopeSha256) ||
      (task.executor !== "codex" && task.executor !== "claude") ||
      (task.reviewer !== "codex" && task.reviewer !== "claude") ||
      task.executor === task.reviewer ||
      tasks.some(
        (existing) =>
          existing.scopeSha256 === task.scopeSha256 ||
          existing.executor === task.executor,
      )
    )
      return null;
    tasks.push({
      scopeSha256: task.scopeSha256,
      executor: task.executor,
      reviewer: task.reviewer,
      token: null,
      settled: false,
      invocationCount: 0,
      pendingCount: 0,
    });
  }

  const expiresAtMs = config.expiresAtMs;
  const durationMs = expiresAtMs - initial.wallTimeMs;
  const bindingSha256 = initial.bindingSha256;
  const initialMonotonicTimeMs = initial.monotonicTimeMs;
  const taskTokens = new WeakMap<object, TaskState>();
  const invocationTokens = new WeakMap<object, InvocationState>();
  let activeTask: TaskState | null = null;
  let stopReason: StopReason | null = null;
  let lastObservation = initial;
  let invocationCount = 0;

  /**
   * Observationを検査する。
   *
   * @responsibility Observationの検査条件、違反分類、検査結果境界を所有する。
   * @trace ARCH-000004
   * @input rawObservation: unknown
   * @returns StopReason | nullを返す。
   * @precondition 「rawObservation: unknown」がcheckObservationの入力契約を満たす。
   * @postcondition checkObservationの責務を完了した結果だけを返す。
   * @effect N/A: checkObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: checkObservationは独自の失敗分岐を所有しない。
   * @invariant checkObservationは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: checkObservationはProcess内の同一Subsystemで完結する。
   * @security checkObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: checkObservationは共有非同期状態を持たない同期処理である。
   */
  function checkObservation(rawObservation: unknown): StopReason | null {
    if (stopReason) return stopReason;
    const observation = parseObservation(rawObservation);
    if (
      !observation ||
      observation.wallTimeMs < lastObservation.wallTimeMs ||
      observation.monotonicTimeMs < lastObservation.monotonicTimeMs
    ) {
      stopReason = "observation_invalid";
    } else if (observation.bindingSha256 !== bindingSha256) {
      stopReason = "identity_mismatch";
    } else {
      lastObservation = observation;
      if (
        observation.wallTimeMs >= expiresAtMs ||
        observation.monotonicTimeMs - initialMonotonicTimeMs >= durationMs
      )
        stopReason = "expired";
    }
    return stopReason;
  }

  return Object.freeze({
    productionAuthorityConferred: false as const,
    /**
     * development-measurement-constraintsを検査する。
     *
     * @responsibility development-measurement-constraintsの検査条件、違反分類、検査結果境界を所有する。
     * @trace ARCH-000004
     * @input observation: unknown
     * @returns checkの計算結果を返す。
     * @precondition 「observation: unknown」がcheckの入力契約を満たす。
     * @postcondition checkの責務を完了した結果だけを返す。
     * @effect N/A: checkは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: checkは独自の失敗分岐を所有しない。
     * @invariant checkは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: checkはProcess内の同一Subsystemで完結する。
     * @security checkはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: checkは共有非同期状態を持たない同期処理である。
     */
    check(observation: unknown) {
      const refusal = checkObservation(observation);
      return refusal ? refuse(refusal) : record(null);
    },
    /**
     * reserve Taskを決定する。
     *
     * @responsibility reserve Taskの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input scopeSha256: string、observation: unknown
     * @returns reserveTaskの計算結果を返す。
     * @precondition 「scopeSha256: string、observation: unknown」がreserveTaskの入力契約を満たす。
     * @postcondition reserveTaskの責務を完了した結果だけを返す。
     * @effect N/A: reserveTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveTaskは独自の失敗分岐を所有しない。
     * @invariant reserveTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveTaskはProcess内の同一Subsystemで完結する。
     * @security reserveTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveTaskは共有非同期状態を持たない同期処理である。
     */
    reserveTask(scopeSha256: string, observation: unknown) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const task = tasks.find((entry) => entry.scopeSha256 === scopeSha256);
      if (!task || task.token || activeTask) return refuse("task_unavailable");
      const token = Object.freeze({});
      task.token = token;
      taskTokens.set(token, task);
      activeTask = task;
      return record(token);
    },
    /**
     * reserve Invocationを決定する。
     *
     * @responsibility reserve Invocationの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input taskToken: object、provider: Provider、role: Role、observation: unknown
     * @returns reserveInvocationの計算結果を返す。
     * @precondition 「taskToken: object、provider: Provider、role: Role、observation: unknown」がreserveInvocationの入力契約を満たす。
     * @postcondition reserveInvocationの責務を完了した結果だけを返す。
     * @effect N/A: reserveInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveInvocationは独自の失敗分岐を所有しない。
     * @invariant reserveInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveInvocationはProcess内の同一Subsystemで完結する。
     * @security reserveInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveInvocationは共有非同期状態を持たない同期処理である。
     */
    reserveInvocation(
      taskToken: object,
      provider: Provider,
      role: Role,
      observation: unknown,
    ) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const task = taskTokens.get(taskToken);
      if (
        !task ||
        task !== activeTask ||
        task.settled ||
        task.pendingCount !== 0 ||
        (role !== "executor" && role !== "reviewer") ||
        task[role] !== provider ||
        task.invocationCount >= 4 ||
        invocationCount >= 8
      )
        return refuse("invocation_unavailable");
      const token = Object.freeze({});
      invocationTokens.set(token, { task, provider, role, phase: "reserved" });
      task.invocationCount += 1;
      task.pendingCount += 1;
      invocationCount += 1;
      return record(token);
    },
    /**
     * Invocationを一回限りで消費する。
     *
     * @responsibility Invocationの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
     * @trace ARCH-000004
     * @input invocationToken: object、taskToken: object、provider: Provider、role: Role、observation: unknown
     * @returns consumeInvocationの計算結果を返す。
     * @precondition 「invocationToken: object、taskToken: object、provider: Provider、role: Role、observation: unknown」がconsumeInvocationの入力契約を満たす。
     * @postcondition consumeInvocationの責務を完了した結果だけを返す。
     * @effect N/A: consumeInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: consumeInvocationは独自の失敗分岐を所有しない。
     * @invariant consumeInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: consumeInvocationはProcess内の同一Subsystemで完結する。
     * @security consumeInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: consumeInvocationは共有非同期状態を持たない同期処理である。
     */
    consumeInvocation(
      invocationToken: object,
      taskToken: object,
      provider: Provider,
      role: Role,
      observation: unknown,
    ) {
      const refusal = checkObservation(observation);
      if (refusal) return refuse(refusal);
      const invocation = invocationTokens.get(invocationToken);
      if (
        invocation?.phase !== "reserved" ||
        invocation.task !== activeTask ||
        invocation.task !== taskTokens.get(taskToken) ||
        invocation.provider !== provider ||
        invocation.role !== role
      )
        return refuse("invocation_unavailable");
      invocation.phase = "consumed";
      return record(null);
    },
    // Settlement records that the caller finished its existing lifecycle; it
    // does not prove resource absence, perform cleanup, or refund a reservation.
    /**
     * Invocationを終端状態へ確定する。
     *
     * @responsibility Invocationの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input invocationToken: object
     * @returns settleInvocationの計算結果を返す。
     * @precondition 「invocationToken: object」がsettleInvocationの入力契約を満たす。
     * @postcondition settleInvocationの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationは独自の失敗分岐を所有しない。
     * @invariant settleInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationはProcess内の同一Subsystemで完結する。
     * @security settleInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationは共有非同期状態を持たない同期処理である。
     */
    settleInvocation(invocationToken: object) {
      const invocation = invocationTokens.get(invocationToken);
      if (!invocation || invocation.phase === "settled")
        return refuse("invocation_unavailable");
      invocation.phase = "settled";
      invocation.task.pendingCount -= 1;
      return record(null);
    },
    /**
     * Taskを終端状態へ確定する。
     *
     * @responsibility Taskの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskToken: object、outcome: "finished" | "cleanup_unknown"
     * @returns settleTaskの計算結果を返す。
     * @precondition 「taskToken: object、outcome: "finished" | "cleanup_unknown"」がsettleTaskの入力契約を満たす。
     * @postcondition settleTaskの責務を完了した結果だけを返す。
     * @effect N/A: settleTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleTaskは独自の失敗分岐を所有しない。
     * @invariant settleTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleTaskはProcess内の同一Subsystemで完結する。
     * @security settleTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleTaskは共有非同期状態を持たない同期処理である。
     */
    settleTask(taskToken: object, outcome: "finished" | "cleanup_unknown") {
      const task = taskTokens.get(taskToken);
      if (
        !task ||
        task !== activeTask ||
        task.settled ||
        (outcome !== "finished" && outcome !== "cleanup_unknown") ||
        (outcome === "finished" && task.pendingCount !== 0)
      )
        return refuse("task_unavailable");
      if (outcome === "cleanup_unknown" && !stopReason)
        stopReason = "cleanup_unknown";
      task.settled = true;
      activeTask = null;
      return record(null);
    },
    /**
     * development-measurement-constraintsを取り消す。
     *
     * @responsibility development-measurement-constraintsの取消条件、終了状態、残存Effectの境界を所有する。
     * @trace ARCH-000004
     * @input N/A: 実行時引数を受け取らない。
     * @returns N/A: cancelは戻り値を返さない。
     * @precondition 「N/A: 実行時引数を受け取らない。」がcancelの入力契約を満たす。
     * @postcondition cancelの責務を完了して呼出し元へ制御を戻す。
     * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: cancelは独自の失敗分岐を所有しない。
     * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: cancelはProcess内の同一Subsystemで完結する。
     * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: cancelは共有非同期状態を持たない同期処理である。
     */
    cancel() {
      stopReason ??= "cancelled";
    },
    /**
     * development-measurement-constraintsを観測する。
     *
     * @responsibility development-measurement-constraintsの観測対象、取得根拠、観測不能結果の境界を所有する。
     * @trace ARCH-000004
     * @input N/A: 実行時引数を受け取らない。
     * @returns inspectの計算結果を返す。
     * @precondition 「N/A: 実行時引数を受け取らない。」がinspectの入力契約を満たす。
     * @postcondition inspectの責務を完了した結果だけを返す。
     * @effect N/A: inspectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: inspectは独自の失敗分岐を所有しない。
     * @invariant inspectは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: inspectはProcess内の同一Subsystemで完結する。
     * @security inspectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: inspectは共有非同期状態を持たない同期処理である。
     */
    inspect() {
      return Object.freeze({
        productionAuthorityConferred: false as const,
        invocationCount,
        reservedTaskCount: tasks.filter((task) => task.token !== null).length,
        settledTaskCount: tasks.filter((task) => task.settled).length,
        stopReason,
      });
    },
  });
}

const developmentMeasurementSessionCONFIG_KEYS = new Set([
  "repositoryRoot",
  "expectedCommit",
  "expectedTree",
  "expectedSourceSha256",
  "tasks",
  "expiresAtMs",
]);

const SHA256 = /^[a-f0-9]{64}$/u;

const COMMIT = /^[a-f0-9]{40}$/u;

const developmentMeasurementSessionMAX_DURATION_MS = 3_600_000;

const sourceDistributionRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);

/**
 * development-measurement-sessionで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type developmentMeasurementSessionProvider = "codex" | "claude";

/**
 * development-measurement-sessionで使用するRoleの値契約を定義する。
 *
 * @responsibility RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Roleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Roleで宣言した値と責務の対応を維持する。
 * @boundary N/A: Roleの宣言は外部境界を開かない。
 * @security RoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Roleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type developmentMeasurementSessionRole = "executor" | "reviewer";

/**
 * development-measurement-sessionで使用するConstraintsの値契約を定義する。
 *
 * @responsibility ConstraintsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Constraintsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Constraintsで宣言した値と責務の対応を維持する。
 * @boundary N/A: Constraintsの宣言は外部境界を開かない。
 * @security ConstraintsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Constraintsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Constraints = NonNullable<
  ReturnType<typeof createDevelopmentMeasurementConstraints>
>;

/**
 * development-measurement-sessionで使用するTask Requestの値契約を定義する。
 *
 * @responsibility Task RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskRequestの宣言は外部境界を開かない。
 * @security TaskRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskRequest = Extract<
  NonNullable<ReturnType<typeof snapshotCoordinatorTaskRequest>>,
  { status: "accepted" }
>["request"];

/**
 * development-measurement-sessionで使用するTaskの値契約を定義する。
 *
 * @responsibility TaskのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Taskが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Taskで宣言した値と責務の対応を維持する。
 * @boundary N/A: Taskの宣言は外部境界を開かない。
 * @security TaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Taskの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Task = Readonly<{
  request: TaskRequest;
  scopeSha256: string;
  executor: developmentMeasurementSessionProvider;
  reviewer: developmentMeasurementSessionProvider;
}>;

/**
 * development-measurement-sessionで使用するConfigurationの値契約を定義する。
 *
 * @responsibility ConfigurationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Configurationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Configurationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Configurationの宣言は外部境界を開かない。
 * @security ConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Configurationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Configuration = Readonly<{
  repositoryRoot: string;
  expectedCommit: string;
  expectedTree: string;
  expectedSourceSha256: string;
  tasks: readonly Task[];
  expiresAtMs: number;
}>;

/**
 * development-measurement-sessionで使用するIdentityの値契約を定義する。
 *
 * @responsibility IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Identityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Identityで宣言した値と責務の対応を維持する。
 * @boundary N/A: Identityの宣言は外部境界を開かない。
 * @security IdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Identityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Identity = Readonly<{
  sourceIdentitySha256: string;
  nativeIdentitySha256: string;
  repositoryIdentitySha256: string;
}>;

/**
 * development-measurement-sessionで使用するNative Verificationの値契約を定義する。
 *
 * @responsibility Native VerificationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape NativeVerificationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant NativeVerificationで宣言した値と責務の対応を維持する。
 * @boundary N/A: NativeVerificationの宣言は外部境界を開かない。
 * @security NativeVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility NativeVerificationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type NativeVerification = Readonly<{
  status: "candidate";
  platformAccessArtifact: NonNullable<
    ReturnType<typeof observeNativeArtifact>
  >["artifact"];
}>;

// Only the production observer can bind a verified native result to an identity.
// The exact immutable identity may be reused inside one already-verified native
// lifecycle boundary; caller claims and isolated test identities remain invalid.
const nativeVerifications = new WeakMap<
  Identity,
  Readonly<{
    verification: NativeVerification;
    identitySha256: string;
    sourceObservation: Readonly<{
      scope: NonNullable<
        ReturnType<typeof observeRuntimeOwnedDevelopmentSource>
      >["scope"];
      expectedSourceSha256: string;
    }>;
  }>
>();

/**
 * development-measurement-sessionで使用するDependenciesの値契約を定義する。
 *
 * @responsibility DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Dependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Dependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: Dependenciesの宣言は外部境界を開かない。
 * @security DependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Dependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Dependencies = Readonly<{
  observe: (
    configuration: Configuration,
    priorIdentity?: Identity,
  ) => Identity | null;
  wallNow: () => number;
  monotonicNow: () => number;
  isEffectBlocked: () => boolean;
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  borrowRepository: typeof borrowRuntimeOwnedRepositorySource;
}>;

/**
 * development-measurement-sessionで使用するSessionの値契約を定義する。
 *
 * @responsibility SessionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Sessionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sessionで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sessionの宣言は外部境界を開かない。
 * @security SessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Sessionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Session = {
  timing: ReturnType<typeof createDevelopmentExecutionTiming>;
  configuration: Configuration;
  identity: Identity;
  bindingSha256: string;
  constraints: Constraints;
  signal: AbortSignal;
  closed: boolean;
};

/**
 * development-measurement-sessionで使用するTask Bindingの値契約を定義する。
 *
 * @responsibility Task BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskBindingの宣言は外部境界を開かない。
 * @security TaskBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskBinding = {
  session: Session;
  task: Task;
  token: object;
  managementCapability: object | null;
  nativeBoundaryIdentity: Identity | null;
  cleanupBoundaryIdentity: Identity | null;
  nativeBoundaryVerified: boolean;
  cleanupBoundaryVerified: boolean;
  settled: boolean;
};

/**
 * development-measurement-sessionのHashを算出する。
 *
 * @responsibility development-measurement-sessionの入力byte列、Hash algorithm、算出結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns digestの計算結果を返す。
 * @precondition 「value: unknown」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: digestはProcess内の同一Subsystemで完結する。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

/**
 * Taskを所有Snapshotへ変換する。
 *
 * @responsibility Taskの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Task | nullを返す。
 * @precondition 「raw: unknown」がsnapshotTaskの入力契約を満たす。
 * @postcondition snapshotTaskの責務を完了した結果だけを返す。
 * @effect N/A: snapshotTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotTaskはProcess内の同一Subsystemで完結する。
 * @security snapshotTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotTaskは共有非同期状態を持たない同期処理である。
 */
function snapshotTask(raw: unknown): Task | null {
  try {
    const parsed = snapshotCoordinatorTaskRequest(raw);
    if (parsed?.status !== "accepted") return null;
    const request = parsed.request;
    if (Buffer.byteLength(JSON.stringify(request), "utf8") > 65_536)
      return null;
    const executor = request.taskExecutionSelections?.executor.provider;
    if (
      (executor !== "codex" && executor !== "claude") ||
      request.isLocalCandidateOnly !== true ||
      request.hasUnresolvedDirection !== false ||
      request.requiresCrossContextAlignment !== false ||
      request.workClass !== "bounded_implementation" ||
      request.planState !== "complete" ||
      request.risk !== "low" ||
      request.difficulty !== "low" ||
      request.decisionImpact !== "limited"
    )
      return null;
    const reviewer = request.taskExecutionSelections?.reviewer.provider;
    if (reviewer !== "codex" && reviewer !== "claude") return null;
    return Object.freeze({
      request,
      executor,
      reviewer,
      scopeSha256: digest([
        "crdd-development-task/v1",
        request,
        executor,
        reviewer,
      ]),
    });
  } catch {
    return null;
  }
}

/**
 * Configurationを所有Snapshotへ変換する。
 *
 * @responsibility Configurationの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Configuration | nullを返す。
 * @precondition 「raw: unknown」がsnapshotConfigurationの入力契約を満たす。
 * @postcondition snapshotConfigurationの責務を完了した結果だけを返す。
 * @effect N/A: snapshotConfigurationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotConfigurationは独自の失敗分岐を所有しない。
 * @invariant snapshotConfigurationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotConfigurationはProcess内の同一Subsystemで完結する。
 * @security snapshotConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotConfigurationは共有非同期状態を持たない同期処理である。
 */
function snapshotConfiguration(raw: unknown): Configuration | null {
  const config = snapshotPlainRecord(
    raw,
    developmentMeasurementSessionCONFIG_KEYS,
  );
  if (!config) return null;
  const taskInputs = snapshotPlainArray(config.tasks, 2);
  if (
    taskInputs.status !== "ok" ||
    taskInputs.value.length !== 2 ||
    typeof config.repositoryRoot !== "string" ||
    !path.isAbsolute(config.repositoryRoot) ||
    path.normalize(config.repositoryRoot) !== config.repositoryRoot ||
    typeof config.expectedCommit !== "string" ||
    !COMMIT.test(config.expectedCommit) ||
    typeof config.expectedTree !== "string" ||
    !COMMIT.test(config.expectedTree) ||
    typeof config.expectedSourceSha256 !== "string" ||
    !SHA256.test(config.expectedSourceSha256) ||
    typeof config.expiresAtMs !== "number" ||
    !Number.isSafeInteger(config.expiresAtMs)
  )
    return null;
  const tasks: Task[] = [];
  for (const input of taskInputs.value) {
    const task = snapshotTask(input);
    if (
      !task ||
      tasks.some(
        (existing) =>
          existing.executor === task.executor ||
          existing.scopeSha256 === task.scopeSha256,
      )
    )
      return null;
    tasks.push(task);
  }
  return Object.freeze({
    repositoryRoot: config.repositoryRoot,
    expectedCommit: config.expectedCommit,
    expectedTree: config.expectedTree,
    expectedSourceSha256: config.expectedSourceSha256,
    tasks: Object.freeze(tasks),
    expiresAtMs: config.expiresAtMs,
  });
}

/**
 * 固定SourceとNative実体、Task Repositoryを同じ観測区間で確認する。
 *
 * @responsibility 署名配布へ依存せず、Source期待値と元Native実体の継続性を照合する。
 * @trace ARCH-000004
 * @input configuration: 固定入力。priorIdentity: 再観測時の元admission実体。
 * @returns Identity | nullを返す。
 * @precondition 「configuration: Configuration」がobserveProductionの入力契約を満たす。
 * @postcondition observeProductionの責務を完了した結果だけを返す。
 * @effect Source、Native、Repositoryを読み、既存私有Mapへ観測を結合する。
 * @failure 欠測・期待差・元実体観測失効・観測中差替えはnull。
 * @invariant fresh Hashだけで元Native tokenの失効を上書きしない。
 * @boundary 固定Source／NativeのFilesystem観測とRepository照合。
 * @security observeProductionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 旧実体観測前後と新実体観測最終確認を重ねる。変更不能や原子的ロードは保証しない。
 */
function observeProduction(
  configuration: Configuration,
  priorIdentity?: Identity,
): Identity | null {
  const prior =
    priorIdentity === undefined ? null : nativeVerifications.get(priorIdentity);
  if (
    priorIdentity !== undefined &&
    (!prior ||
      !observeNativeArtifact(sourceDistributionRoot, prior.identitySha256))
  )
    return null;
  const repository = inspectRepositoryIdentityCandidate(
    configuration.repositoryRoot,
  );
  if (
    !repository ||
    repository.commit !== configuration.expectedCommit ||
    repository.tree !== configuration.expectedTree
  )
    return null;
  const source = observeRuntimeOwnedDevelopmentSource();
  if (!source || source.sourceSha256 !== configuration.expectedSourceSha256)
    return null;
  const native = observeNativeArtifact(sourceDistributionRoot);
  if (!native?.bootstrapVerified) return null;
  const reobserved = inspectRepositoryIdentityCandidate(
    configuration.repositoryRoot,
  );
  if (JSON.stringify(repository) !== JSON.stringify(reobserved)) return null;
  if (
    prior &&
    !observeNativeArtifact(sourceDistributionRoot, prior.identitySha256)
  )
    return null;
  if (!observeNativeArtifact(sourceDistributionRoot, native.identitySha256))
    return null;
  const identity: Identity = Object.freeze({
    sourceIdentitySha256: source.sourceIdentitySha256,
    nativeIdentitySha256: digest([
      "crdd-development-bootstrap-native/v1",
      sourceDistributionRoot,
      native.artifact,
    ]),
    repositoryIdentitySha256: digest([
      "crdd-development-repository/v1",
      configuration.repositoryRoot,
      repository,
    ]),
  });
  nativeVerifications.set(
    identity,
    Object.freeze({
      verification: Object.freeze({
        status: "candidate",
        platformAccessArtifact: native.artifact,
      }),
      identitySha256: native.identitySha256,
      sourceObservation: Object.freeze({
        scope: source.scope,
        expectedSourceSha256: source.sourceSha256,
      }),
    }),
  );
  return identity;
}

/**
 * development-measurement-sessionを停止結果として構築する。
 *
 * @responsibility development-measurement-sessionの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    capability: null,
    executionSourceKind: "fixed_development_candidate" as const,
    releaseAuthorityConferred: false,
    providerEffectIssued: false,
  });
}

/**
 * Session Runtimeを構築する。
 *
 * @responsibility Session Runtimeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createSessionRuntimeの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateSessionRuntimeの入力契約を満たす。
 * @postcondition createSessionRuntimeの責務を完了した結果だけを返す。
 * @effect createSessionRuntimeは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure createSessionRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createSessionRuntimeは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createSessionRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSessionRuntimeは共有非同期状態を持たない同期処理である。
 */
function createSessionRuntime(dependencies: Dependencies) {
  const sessions = new WeakMap<object, Session>();
  const taskBindings = new WeakMap<object, TaskBinding>();
  const operationBindings = new WeakMap<object, TaskBinding>();
  const operationContexts = new WeakMap<object, object>();
  const invocationBindings = new WeakMap<object, TaskBinding>();
  const cleanupBindings = new WeakMap<object, TaskBinding>();
  const cleanupContexts = new WeakMap<object, object>();
  let admissionStarted = false;

  /**
   * development-measurement-sessionを観測する。
   *
   * @responsibility development-measurement-sessionの観測対象、取得根拠、観測不能結果の境界を所有する。
   * @trace ARCH-000004
   * @input session: Session
   * @returns observeの計算結果を返す。
   * @precondition 「session: Session」がobserveの入力契約を満たす。
   * @postcondition observeの責務を完了した結果だけを返す。
   * @effect N/A: observeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure observeは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant observeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: observeはProcess内の同一Subsystemで完結する。
   * @security observeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: observeは共有非同期状態を持たない同期処理である。
   */
  function observe(session: Session) {
    try {
      if (
        session.signal.aborted ||
        session.closed ||
        dependencies.isEffectBlocked()
      )
        session.constraints.cancel();
      const identity = session.timing.measureIdentity(() =>
        dependencies.observe(session.configuration, session.identity),
      );
      const bindingSha256 =
        identity && digest(identity) === digest(session.identity)
          ? session.bindingSha256
          : "0".repeat(64);
      const observation = {
        bindingSha256,
        wallTimeMs: dependencies.wallNow(),
        monotonicTimeMs: dependencies.monotonicNow(),
      };
      return {
        identity,
        observation,
        result: session.constraints.check(observation),
      };
    } catch {
      session.constraints.cancel();
      return null;
    }
  }

  /**
   * Bound Sessionを検査する。
   *
   * @responsibility Bound Sessionの検査条件、違反分類、検査結果境界を所有する。
   * @trace ARCH-000004
   * @input session: Session
   * @returns checkBoundSessionの計算結果を返す。
   * @precondition 「session: Session」がcheckBoundSessionの入力契約を満たす。
   * @postcondition checkBoundSessionの責務を完了した結果だけを返す。
   * @effect N/A: checkBoundSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure checkBoundSessionは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant checkBoundSessionは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: checkBoundSessionはProcess内の同一Subsystemで完結する。
   * @security checkBoundSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: checkBoundSessionは共有非同期状態を持たない同期処理である。
   */
  function checkBoundSession(session: Session) {
    try {
      if (
        session.signal.aborted ||
        session.closed ||
        dependencies.isEffectBlocked()
      )
        session.constraints.cancel();
      const observation = {
        bindingSha256: session.bindingSha256,
        wallTimeMs: dependencies.wallNow(),
        monotonicTimeMs: dependencies.monotonicNow(),
      };
      return {
        observation,
        result: session.constraints.check(observation),
      };
    } catch {
      session.constraints.cancel();
      return null;
    }
  }

  /**
   * operation Validを決定する。
   *
   * @responsibility operation Validの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000004
   * @input binding: TaskBinding
   * @returns operationValidの計算結果を返す。
   * @precondition 「binding: TaskBinding」がoperationValidの入力契約を満たす。
   * @postcondition operationValidの責務を完了した結果だけを返す。
   * @effect N/A: operationValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure operationValidは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant operationValidは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: operationValidはProcess内の同一Subsystemで完結する。
   * @security operationValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: operationValidは共有非同期状態を持たない同期処理である。
   */
  function operationValid(binding: TaskBinding) {
    try {
      return (
        !binding.settled &&
        binding.managementCapability !== null &&
        dependencies.verifyOperation(binding.managementCapability)
          .managementScopeBound === true
      );
    } catch {
      return false;
    }
  }

  return Object.freeze({
    /**
     * development-measurement-sessionを要求する。
     *
     * @responsibility development-measurement-sessionの要求条件、受理結果、Effect未成立との分離境界を所有する。
     * @trace ARCH-000004
     * @input raw: unknown、signal: AbortSignal
     * @returns requestの計算結果を返す。
     * @precondition 「raw: unknown、signal: AbortSignal」がrequestの入力契約を満たす。
     * @postcondition requestの責務を完了した結果だけを返す。
     * @effect N/A: requestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure requestは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant requestは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: requestはProcess内の同一Subsystemで完結する。
     * @security requestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency requestは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
     */
    async request(raw: unknown, signal: AbortSignal) {
      if (admissionStarted)
        return blocked("development_measurement_admission_already_attempted");
      admissionStarted = true;
      try {
        if (
          !signal ||
          utilTypes.isProxy(signal) ||
          !(signal instanceof AbortSignal) ||
          signal.aborted ||
          dependencies.isEffectBlocked()
        )
          return blocked("development_measurement_unavailable");
        const configuration = snapshotConfiguration(raw);
        const wallTimeMs = dependencies.wallNow();
        const monotonicTimeMs = dependencies.monotonicNow();
        if (
          !configuration ||
          configuration.expiresAtMs <= wallTimeMs ||
          configuration.expiresAtMs - wallTimeMs >
            developmentMeasurementSessionMAX_DURATION_MS
        )
          return blocked("development_measurement_configuration_invalid");
        const timing = createDevelopmentExecutionTiming();
        const identity = timing.measureIdentity(() =>
          dependencies.observe(configuration),
        );
        if (!identity)
          return blocked("development_measurement_identity_not_verified");
        const bindingSha256 = digest([
          "crdd-development-session/v1",
          configuration,
          identity,
        ]);
        const constraints = createDevelopmentMeasurementConstraints(
          {
            bindingSha256,
            expiresAtMs: configuration.expiresAtMs,
            tasks: configuration.tasks.map(
              ({ scopeSha256, executor, reviewer }) => ({
                scopeSha256,
                executor,
                reviewer,
              }),
            ),
          },
          { bindingSha256, wallTimeMs, monotonicTimeMs },
        );
        if (!constraints)
          return blocked("development_measurement_configuration_invalid");
        const session: Session = {
          timing,
          configuration,
          identity,
          bindingSha256,
          constraints,
          signal,
          closed: false,
        };
        const finalObservation = observe(session);
        if (
          signal.aborted ||
          dependencies.isEffectBlocked() ||
          finalObservation?.result.status !== "recorded"
        )
          return blocked("development_measurement_admission_changed");
        const capability = Object.freeze({});
        sessions.set(capability, session);
        return Object.freeze({
          status: "authorized" as const,
          capability,
          bindingSha256,
          expiresAtMs: configuration.expiresAtMs,
          executionSourceKind: "fixed_development_candidate" as const,
          releaseAuthorityConferred: false,
          providerEffectIssued: false,
        });
      } catch {
        return blocked("development_measurement_admission_failed");
      }
    },
    /**
     * reserve Taskを決定する。
     *
     * @responsibility reserve Taskの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input sessionCapability: object、raw: unknown
     * @returns reserveTaskの計算結果を返す。
     * @precondition 「sessionCapability: object、raw: unknown」がreserveTaskの入力契約を満たす。
     * @postcondition reserveTaskの責務を完了した結果だけを返す。
     * @effect N/A: reserveTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveTaskは独自の失敗分岐を所有しない。
     * @invariant reserveTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveTaskはProcess内の同一Subsystemで完結する。
     * @security reserveTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveTaskは共有非同期状態を持たない同期処理である。
     */
    reserveTask(sessionCapability: object, raw: unknown) {
      const session = sessions.get(sessionCapability);
      const task = snapshotTask(raw);
      const observation = session && observe(session);
      if (!session || !task || observation?.result.status !== "recorded")
        return null;
      const reserved = session.constraints.reserveTask(
        task.scopeSha256,
        observation.observation,
      );
      if (reserved.status !== "recorded") return null;
      const capability = Object.freeze({});
      taskBindings.set(capability, {
        session,
        task,
        token: reserved.value,
        managementCapability: null,
        nativeBoundaryIdentity: null,
        cleanupBoundaryIdentity: null,
        nativeBoundaryVerified: false,
        cleanupBoundaryVerified: false,
        settled: false,
      });
      return capability;
    },
    /**
     * task Boundaryを決定する。
     *
     * @responsibility task Boundaryの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object
     * @returns taskBoundaryの計算結果を返す。
     * @precondition 「taskCapability: object」がtaskBoundaryの入力契約を満たす。
     * @postcondition taskBoundaryの責務を完了した結果だけを返す。
     * @effect N/A: taskBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: taskBoundaryは独自の失敗分岐を所有しない。
     * @invariant taskBoundaryは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: taskBoundaryはProcess内の同一Subsystemで完結する。
     * @security taskBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: taskBoundaryは共有非同期状態を持たない同期処理である。
     */
    taskBoundary(taskCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return null;
      return Object.freeze({
        repositoryRoot: binding.session.configuration.repositoryRoot,
        expiresAtMs: binding.session.configuration.expiresAtMs,
        signal: binding.session.signal,
        request: binding.task.request,
        checkNewWork: () =>
          !binding.settled &&
          checkBoundSession(binding.session)?.result.status === "recorded",
      });
    },
    /**
     * OperationをIdentityへ結合する。
     *
     * @responsibility Operationの結合条件、相関Identity、不一致の拒否境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、managementCapability: object、repositoryBindingCapability: object
     * @returns bindOperationの計算結果を返す。
     * @precondition 「taskCapability: object、managementCapability: object、repositoryBindingCapability: object」がbindOperationの入力契約を満たす。
     * @postcondition bindOperationの責務を完了した結果だけを返す。
     * @effect N/A: bindOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure bindOperationは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant bindOperationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: bindOperationはProcess内の同一Subsystemで完結する。
     * @security bindOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: bindOperationは共有非同期状態を持たない同期処理である。
     */
    bindOperation(
      taskCapability: object,
      managementCapability: object,
      repositoryBindingCapability: object,
    ) {
      const binding = taskBindings.get(taskCapability);
      if (
        !binding ||
        binding.settled ||
        binding.managementCapability ||
        operationBindings.has(managementCapability) ||
        observe(binding.session)?.result.status !== "recorded"
      )
        return false;
      try {
        const operation = dependencies.verifyOperation(managementCapability);
        const repository = dependencies.borrowRepository(
          repositoryBindingCapability,
          managementCapability,
        );
        if (
          !repository ||
          repository.operationId !== operation.operationId ||
          repository.repositoryRoot !==
            binding.session.configuration.repositoryRoot ||
          repository.revision !== binding.session.configuration.expectedCommit
        )
          return false;
        binding.managementCapability = managementCapability;
        operationBindings.set(managementCapability, binding);
        operationContexts.set(managementCapability, taskCapability);
        const cleanupContext = Object.freeze({});
        cleanupBindings.set(cleanupContext, binding);
        cleanupContexts.set(managementCapability, cleanupContext);
        return true;
      } catch {
        return false;
      }
    },
    /**
     * Operationを検査する。
     *
     * @responsibility Operationの検査条件、違反分類、検査結果境界を所有する。
     * @trace ARCH-000004
     * @input managementCapability: object
     * @returns checkOperationの計算結果を返す。
     * @precondition 「managementCapability: object」がcheckOperationの入力契約を満たす。
     * @postcondition checkOperationの責務を完了した結果だけを返す。
     * @effect N/A: checkOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure checkOperationは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant checkOperationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: checkOperationはProcess内の同一Subsystemで完結する。
     * @security checkOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: checkOperationは共有非同期状態を持たない同期処理である。
     */
    checkOperation(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      if (!binding || binding.settled) return false;
      try {
        dependencies.verifyOperation(managementCapability);
        return observe(binding.session)?.result.status === "recorded";
      } catch {
        return false;
      }
    },
    /**
     * operation Contextを決定する。
     *
     * @responsibility operation Contextの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input managementCapability: object
     * @returns operationContextの計算結果を返す。
     * @precondition 「managementCapability: object」がoperationContextの入力契約を満たす。
     * @postcondition operationContextの責務を完了した結果だけを返す。
     * @effect N/A: operationContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: operationContextは独自の失敗分岐を所有しない。
     * @invariant operationContextは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: operationContextはProcess内の同一Subsystemで完結する。
     * @security operationContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: operationContextは共有非同期状態を持たない同期処理である。
     */
    operationContext(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      return binding
        ? Object.freeze({
            checkNewWork: () =>
              !binding.settled &&
              checkBoundSession(binding.session)?.result.status === "recorded",
            newWorkContext: operationContexts.get(managementCapability),
            cleanupContext: cleanupContexts.get(managementCapability),
          })
        : null;
    },
    /**
     * Native Observationを一時参照として取得する。
     *
     * @responsibility Native Observationの参照条件、lifetime、所有権を移さない境界を所有する。
     * @trace ARCH-000004
     * @input context: object、shouldInitializeIfMissing: boolean
     * @returns borrowNativeObservationの計算結果を返す。
     * @precondition 「context: object、shouldInitializeIfMissing: boolean」がborrowNativeObservationの入力契約を満たす。
     * @postcondition borrowNativeObservationの責務を完了した結果だけを返す。
     * @effect N/A: borrowNativeObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure borrowNativeObservationは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant borrowNativeObservationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: borrowNativeObservationはProcess内の同一Subsystemで完結する。
     * @security borrowNativeObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: borrowNativeObservationは共有非同期状態を持たない同期処理である。
     */
    borrowNativeObservation(
      context: object,
      shouldInitializeIfMissing: boolean,
    ) {
      const session = sessions.get(context);
      const task = taskBindings.get(context);
      const cleanup = cleanupBindings.get(context);
      const binding = task ?? cleanup;
      const activeSession = session ?? binding?.session;
      if (
        !activeSession ||
        binding?.settled ||
        ((session || cleanup) && shouldInitializeIfMissing)
      )
        return null;
      try {
        let identity: Identity | null = null;
        if (session) {
          const observed = observe(session);
          if (observed?.result.status !== "recorded") return null;
          identity = observed.identity;
        }
        if (task) {
          if (!task.nativeBoundaryVerified) {
            const observed = observe(task.session);
            if (observed?.result.status !== "recorded") return null;
            identity = observed.identity;
            task.nativeBoundaryIdentity = identity;
            task.nativeBoundaryVerified = true;
          } else {
            if (checkBoundSession(task.session)?.result.status !== "recorded")
              return null;
            identity = task.nativeBoundaryIdentity;
          }
        }
        // A cleanup context permits only a read-only native observation. Its
        // owning resource lifecycle still authorizes every exact mutation.
        if (cleanup) {
          if (dependencies.isEffectBlocked()) return null;
          if (!cleanup.cleanupBoundaryVerified) {
            identity = cleanup.session.timing.measureIdentity(() =>
              dependencies.observe(
                cleanup.session.configuration,
                cleanup.session.identity,
              ),
            );
            if (digest(identity) !== digest(cleanup.session.identity))
              return null;
            cleanup.cleanupBoundaryIdentity = identity;
            cleanup.cleanupBoundaryVerified = true;
          } else {
            identity = cleanup.cleanupBoundaryIdentity;
          }
        }
        if (!identity) return null;
        return Object.freeze({
          identity,
          distributionRoot: sourceDistributionRoot,
          executionSourceKind: "fixed_development_candidate" as const,
        });
      } catch {
        return null;
      }
    },
    /**
     * reserve Invocationを決定する。
     *
     * @responsibility reserve Invocationの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、provider: Provider、role: Role
     * @returns reserveInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、provider: Provider、role: Role」がreserveInvocationの入力契約を満たす。
     * @postcondition reserveInvocationの責務を完了した結果だけを返す。
     * @effect N/A: reserveInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveInvocationは独自の失敗分岐を所有しない。
     * @invariant reserveInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveInvocationはProcess内の同一Subsystemで完結する。
     * @security reserveInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveInvocationは共有非同期状態を持たない同期処理である。
     */
    reserveInvocation(
      taskCapability: object,
      provider: developmentMeasurementSessionProvider,
      role: developmentMeasurementSessionRole,
    ) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      if (!binding || !observed || observed.result.status !== "recorded")
        return null;
      const reserved = binding.session.constraints.reserveInvocation(
        binding.token,
        provider,
        role,
        observed.observation,
      );
      if (reserved.status !== "recorded") return null;
      invocationBindings.set(reserved.value, binding);
      return reserved.value;
    },
    /**
     * Invocationを一回限りで消費する。
     *
     * @responsibility Invocationの消費条件、再利用防止、無効Capabilityの拒否境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object、provider: Provider、role: Role
     * @returns consumeInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object、provider: Provider、role: Role」がconsumeInvocationの入力契約を満たす。
     * @postcondition consumeInvocationの責務を完了した結果だけを返す。
     * @effect consumeInvocationは外部ProcessまたはRuntime境界の操作を呼び出す。
     * @failure N/A: consumeInvocationは独自の失敗分岐を所有しない。
     * @invariant consumeInvocationは宣言した境界以外へEffectを拡張しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security consumeInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: consumeInvocationは共有非同期状態を持たない同期処理である。
     */
    consumeInvocation(
      taskCapability: object,
      invocationCapability: object,
      provider: developmentMeasurementSessionProvider,
      role: developmentMeasurementSessionRole,
    ) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      if (
        !binding ||
        !observed ||
        observed.result.status !== "recorded" ||
        binding.session.constraints.consumeInvocation(
          invocationCapability,
          binding.token,
          provider,
          role,
          observed.observation,
        ).status !== "recorded"
      )
        return false;
      // The provider-effect boundary just completed a full identity check. All
      // native helper observations inside this invocation reuse that exact
      // binding while their adapters still verify the native artifact before
      // and after each helper process.
      binding.nativeBoundaryVerified = true;
      binding.nativeBoundaryIdentity = observed.identity;
      return true;
    },
    /**
     * Invocationを終端状態へ確定する。
     *
     * @responsibility Invocationの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object
     * @returns settleInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object」がsettleInvocationの入力契約を満たす。
     * @postcondition settleInvocationの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationは独自の失敗分岐を所有しない。
     * @invariant settleInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationはProcess内の同一Subsystemで完結する。
     * @security settleInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationは共有非同期状態を持たない同期処理である。
     */
    settleInvocation(taskCapability: object, invocationCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || invocationBindings.get(invocationCapability) !== binding)
        return false;
      const wasSettled =
        binding.session.constraints.settleInvocation(invocationCapability)
          .status === "recorded";
      if (wasSettled) invocationBindings.delete(invocationCapability);
      return wasSettled;
    },
    /**
     * Invocation And Verifyを終端状態へ確定する。
     *
     * @responsibility Invocation And Verifyの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object
     * @returns settleInvocationAndVerifyの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object」がsettleInvocationAndVerifyの入力契約を満たす。
     * @postcondition settleInvocationAndVerifyの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationAndVerifyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationAndVerifyは独自の失敗分岐を所有しない。
     * @invariant settleInvocationAndVerifyは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationAndVerifyはProcess内の同一Subsystemで完結する。
     * @security settleInvocationAndVerifyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationAndVerifyは共有非同期状態を持たない同期処理である。
     */
    settleInvocationAndVerify(
      taskCapability: object,
      invocationCapability: object,
    ) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || invocationBindings.get(invocationCapability) !== binding)
        return false;
      const observed = operationValid(binding) && observe(binding.session);
      const wasSettled =
        binding.session.constraints.settleInvocation(invocationCapability)
          .status === "recorded";
      if (wasSettled) invocationBindings.delete(invocationCapability);
      return Boolean(
        wasSettled && observed && observed.result.status === "recorded",
      );
    },
    /**
     * Taskを終端状態へ確定する。
     *
     * @responsibility Taskの確定条件、最終状態、未解決義務の境界を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、outcome: "finished" | "cleanup_unknown"
     * @returns settleTaskの計算結果を返す。
     * @precondition 「taskCapability: object、outcome: "finished" | "cleanup_unknown"」がsettleTaskの入力契約を満たす。
     * @postcondition settleTaskの責務を完了した結果だけを返す。
     * @effect N/A: settleTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleTaskは独自の失敗分岐を所有しない。
     * @invariant settleTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleTaskはProcess内の同一Subsystemで完結する。
     * @security settleTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleTaskは共有非同期状態を持たない同期処理である。
     */
    settleTask(
      taskCapability: object,
      outcome: "finished" | "cleanup_unknown",
    ) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return false;
      const settled = binding.session.constraints.settleTask(
        binding.token,
        outcome,
      );
      if (settled.status !== "recorded") return false;
      binding.settled = true;
      return true;
    },
    /**
     * development-measurement-sessionを取り消す。
     *
     * @responsibility development-measurement-sessionの取消条件、終了状態、残存Effectの境界を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns cancelの計算結果を返す。
     * @precondition 「capability: object」がcancelの入力契約を満たす。
     * @postcondition cancelの責務を完了した結果だけを返す。
     * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: cancelは独自の失敗分岐を所有しない。
     * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: cancelはProcess内の同一Subsystemで完結する。
     * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: cancelは共有非同期状態を持たない同期処理である。
     */
    cancel(capability: object) {
      const session = sessions.get(capability);
      if (!session) return false;
      session.closed = true;
      session.constraints.cancel();
      return true;
    },
    /**
     * development-measurement-sessionを観測する。
     *
     * @responsibility development-measurement-sessionの観測対象、取得根拠、観測不能結果の境界を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns inspectの計算結果を返す。
     * @precondition 「capability: object」がinspectの入力契約を満たす。
     * @postcondition inspectの責務を完了した結果だけを返す。
     * @effect N/A: inspectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: inspectは独自の失敗分岐を所有しない。
     * @invariant inspectは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: inspectはProcess内の同一Subsystemで完結する。
     * @security inspectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: inspectは共有非同期状態を持たない同期処理である。
     */
    inspect(capability: object) {
      const session = sessions.get(capability);
      if (!session) return null;
      checkBoundSession(session);
      return Object.freeze({
        ...session.constraints.inspect(),
        sourceObservation:
          nativeVerifications.get(session.identity)?.sourceObservation ?? null,
        identityObservation: session.timing.snapshot().identityObservation,
      });
    },
    /**
     * tasksを決定する。
     *
     * @responsibility tasksの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns tasksの計算結果を返す。
     * @precondition 「capability: object」がtasksの入力契約を満たす。
     * @postcondition tasksの責務を完了した結果だけを返す。
     * @effect N/A: tasksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: tasksは独自の失敗分岐を所有しない。
     * @invariant tasksは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: tasksはProcess内の同一Subsystemで完結する。
     * @security tasksはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: tasksは共有非同期状態を持たない同期処理である。
     */
    tasks(capability: object) {
      const session = sessions.get(capability);
      if (!session || observe(session)?.result.status !== "recorded")
        return null;
      return Object.freeze(
        session.configuration.tasks.map((task) => task.request),
      );
    },
  });
}

const productionRuntime = createSessionRuntime(
  Object.freeze({
    observe: observeProduction,
    wallNow: Date.now,
    monotonicNow: () => performance.now(),
    isEffectBlocked: isRuntimeProcessEffectBlocked,
    verifyOperation: verifyOwnedOperationManagementCapability,
    borrowRepository: borrowRuntimeOwnedRepositorySource,
  }),
);

/**
 * Runtime 所有 Development Measurement Sessionを要求する。
 *
 * @responsibility Runtime 所有 Development Measurement Sessionの要求条件、受理結果、Effect未成立との分離境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、signal: AbortSignal
 * @returns requestRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「raw: unknown、signal: AbortSignal」がrequestRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition requestRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant requestRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security requestRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function requestRuntimeOwnedDevelopmentMeasurementSession(
  raw: unknown,
  signal: AbortSignal,
) {
  return productionRuntime.request(raw, signal);
}

/**
 * Runtime 所有 Development Measurement Sessionを観測する。
 *
 * @responsibility Runtime 所有 Development Measurement Sessionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns inspectRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「capability: object」がinspectRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.inspect(capability);
}

/**
 * Runtime 所有 Development Measurement Tasksを読み取る。
 *
 * @responsibility Runtime 所有 Development Measurement Tasksの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns readRuntimeOwnedDevelopmentMeasurementTasksの計算結果を返す。
 * @precondition 「capability: object」がreadRuntimeOwnedDevelopmentMeasurementTasksの入力契約を満たす。
 * @postcondition readRuntimeOwnedDevelopmentMeasurementTasksの責務を完了した結果だけを返す。
 * @effect N/A: readRuntimeOwnedDevelopmentMeasurementTasksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readRuntimeOwnedDevelopmentMeasurementTasksは独自の失敗分岐を所有しない。
 * @invariant readRuntimeOwnedDevelopmentMeasurementTasksは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readRuntimeOwnedDevelopmentMeasurementTasksはProcess内の同一Subsystemで完結する。
 * @security readRuntimeOwnedDevelopmentMeasurementTasksはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readRuntimeOwnedDevelopmentMeasurementTasksは共有非同期状態を持たない同期処理である。
 */
export function readRuntimeOwnedDevelopmentMeasurementTasks(
  capability: object,
) {
  return productionRuntime.tasks(capability);
}

/**
 * Runtime 所有 Development Measurement Sessionを取り消す。
 *
 * @responsibility Runtime 所有 Development Measurement Sessionの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns cancelRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「capability: object」がcancelRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security cancelRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.cancel(capability);
}

/**
 * Runtime 所有 Development Native Observationを一時参照として取得する。
 *
 * @responsibility Runtime 所有 Development Native Observationの参照条件、lifetime、所有権を移さない境界を所有する。
 * @trace ARCH-000004
 * @input context: object、shouldInitializeIfMissing: boolean
 * @returns borrowRuntimeOwnedDevelopmentNativeObservationの計算結果を返す。
 * @precondition 「context: object、shouldInitializeIfMissing: boolean」がborrowRuntimeOwnedDevelopmentNativeObservationの入力契約を満たす。
 * @postcondition borrowRuntimeOwnedDevelopmentNativeObservationの責務を完了した結果だけを返す。
 * @effect N/A: borrowRuntimeOwnedDevelopmentNativeObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: borrowRuntimeOwnedDevelopmentNativeObservationは独自の失敗分岐を所有しない。
 * @invariant borrowRuntimeOwnedDevelopmentNativeObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowRuntimeOwnedDevelopmentNativeObservationはProcess内の同一Subsystemで完結する。
 * @security borrowRuntimeOwnedDevelopmentNativeObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowRuntimeOwnedDevelopmentNativeObservationは共有非同期状態を持たない同期処理である。
 */
export function borrowRuntimeOwnedDevelopmentNativeObservation(
  context: object,
  shouldInitializeIfMissing: boolean,
) {
  const observation = productionRuntime.borrowNativeObservation(
    context,
    shouldInitializeIfMissing,
  );
  const observedNative =
    observation && nativeVerifications.get(observation.identity);
  if (!observation || !observedNative) return null;
  try {
    if (
      !observeNativeArtifact(
        observation.distributionRoot,
        observedNative.identitySha256,
      )
    )
      return null;
  } catch {
    return null;
  }
  // Each borrow verifies the original native identity; the full Source snapshot
  // remains shared inside the same already-checked lifecycle boundary.
  return Object.freeze({
    distributionRoot: observation.distributionRoot,
    verification: observedNative.verification,
  });
}

/**
 * Runtime 所有 Development Operation Contextを観測する。
 *
 * @responsibility Runtime 所有 Development Operation Contextの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input managementCapability: unknown
 * @returns inspectRuntimeOwnedDevelopmentOperationContextの計算結果を返す。
 * @precondition 「managementCapability: unknown」がinspectRuntimeOwnedDevelopmentOperationContextの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedDevelopmentOperationContextの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedDevelopmentOperationContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedDevelopmentOperationContextは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedDevelopmentOperationContextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedDevelopmentOperationContextはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedDevelopmentOperationContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedDevelopmentOperationContextは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedDevelopmentOperationContext(
  managementCapability: unknown,
) {
  return managementCapability && typeof managementCapability === "object"
    ? productionRuntime.operationContext(managementCapability)
    : null;
}

/**
 * Internal Task facade; caller values cannot construct an admitted session.
 *
 * @responsibility development-measurement-sessionの入力からreserve Runtime 所有 Development Measurement Taskを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input sessionCapability: object、request: unknown、repositoryRoot: unknown
 * @returns reserveRuntimeOwnedDevelopmentMeasurementTaskの計算結果を返す。
 * @precondition 「sessionCapability: object、request: unknown、repositoryRoot: unknown」がreserveRuntimeOwnedDevelopmentMeasurementTaskの入力契約を満たす。
 * @postcondition reserveRuntimeOwnedDevelopmentMeasurementTaskの責務を完了した結果だけを返す。
 * @effect N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは独自の失敗分岐を所有しない。
 * @invariant reserveRuntimeOwnedDevelopmentMeasurementTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskはProcess内の同一Subsystemで完結する。
 * @security reserveRuntimeOwnedDevelopmentMeasurementTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは共有非同期状態を持たない同期処理である。
 */
export function reserveRuntimeOwnedDevelopmentMeasurementTask(
  sessionCapability: object,
  request: unknown,
  repositoryRoot: unknown,
) {
  const taskCapability = productionRuntime.reserveTask(
    sessionCapability,
    request,
  );
  if (!taskCapability) return null;
  const boundary = productionRuntime.taskBoundary(taskCapability);
  if (!boundary || boundary.repositoryRoot !== repositoryRoot) {
    productionRuntime.settleTask(taskCapability, "finished");
    return null;
  }
  return Object.freeze({
    ...boundary,
    context: taskCapability,
    bindOperation: (
      managementCapability: object,
      repositoryBindingCapability: object,
    ) =>
      productionRuntime.bindOperation(
        taskCapability,
        managementCapability,
        repositoryBindingCapability,
      ),
    beginInvocation: (
      provider: developmentMeasurementSessionProvider,
      role: developmentMeasurementSessionRole,
    ) => {
      const invocation = productionRuntime.reserveInvocation(
        taskCapability,
        provider,
        role,
      );
      if (!invocation) return null;
      return Object.freeze({
        commandRestriction: (purpose: string) =>
          purpose === "start_provider_attached"
            ? productionRuntime.consumeInvocation(
                taskCapability,
                invocation,
                provider,
                role,
              )
            : boundary.checkNewWork(),
        settle: () => {
          return productionRuntime.settleInvocationAndVerify(
            taskCapability,
            invocation,
          );
        },
      });
    },
    finish: (outcome: "finished" | "cleanup_unknown") =>
      productionRuntime.settleTask(taskCapability, outcome),
  });
}

/**
 * Isolated capability namespace: never accepted by the production facade.
 *
 * @responsibility Isolated Development Measurement Session 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createIsolatedDevelopmentMeasurementSessionCandidateの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateIsolatedDevelopmentMeasurementSessionCandidateの入力契約を満たす。
 * @postcondition createIsolatedDevelopmentMeasurementSessionCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDevelopmentMeasurementSessionCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedDevelopmentMeasurementSessionCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedDevelopmentMeasurementSessionCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDevelopmentMeasurementSessionCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDevelopmentMeasurementSessionCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDevelopmentMeasurementSessionCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDevelopmentMeasurementSessionCandidate(
  dependencies: Dependencies,
) {
  return createSessionRuntime(dependencies);
}

const SOURCE_SCOPE = "crdd-development-source-snapshot/v2";

const PACKAGES = [
  "access-management",
  "ai-adapter",
  "coordinator",
  "docker-isolation",
  "domain-model",
  "execution-intelligence",
  "mcp-server",
  "platform-access",
  "version-control",
] as const;

const DIRECTORIES = [
  "src",
  "bin",
  "runtime",
  "config",
  "schemas",
  "scripts",
  "policies",
] as const;

const sourceRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);

const MAX_FILES = 2048;

const MAX_DIRECTORIES = 2048;

const MAX_FILE_BYTES = 1024 * 1024;

const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

const MAX_DEPTH = 8;

/**
 * Snapshotの観測事実を保持する。実行許可や配布元真正性は表さない。
 *
 * @responsibility 再現可能な内容Hashと同Session内の実体Hashを区別する。
 * @trace ARCH-000004
 * @shape Scope、内容Hash、実体Hash、件数とbyte数を持つ不変値。
 * @invariant 内容Hashへ絶対RootとOS上の実体番号を含めない。
 * @boundary Repository内の固定Source範囲だけを表す。
 * @security 本文・秘密値・実行Authorityを返さない。
 * @compatibility Scope版が異なるHashを同じ観測契約と解釈しない。
 */
type SourceObservation = Readonly<{
  scope: typeof SOURCE_SCOPE;
  sourceSha256: string;
  sourceIdentitySha256: string;
  fileCount: number;
  totalBytes: number;
}>;

/**
 * Directory名を上限内で列挙し、同じhandleを必ず閉じる。
 *
 * @responsibility 件数拒否より先に無制限の配列を生成しない。
 * @trace ARCH-000004
 * @input directory: 固定Scope内のDirectory。
 * @returns コード単位順に並べた最大4096名。
 * @precondition 呼出し元がDirectory種別を確認している。
 * @postcondition 成功・失敗とも開いたhandleのcloseを一回試行する。
 * @effect Directoryを読取り専用で開閉する。
 * @failure 列挙・close失敗と4097件目で例外を返す。
 * @invariant 外部への書込みと永続状態を作らない。
 * @boundary Node Directory handleの所有期間。
 * @security File名だけを内部で保持し、上限を自動拡張しない。
 * @concurrency 後続の二読取りが追加・欠落差を照合する。
 */
function readBoundedDirectoryNames(directory: string): string[] {
  const handle = opendirSync(directory);
  const names: string[] = [];
  try {
    for (;;) {
      const entry = handle.readSync();
      if (!entry) break;
      if (names.length >= MAX_FILES + MAX_DIRECTORIES)
        throw new Error("development_source_directory_limit");
      names.push(entry.name);
    }
    return names.sort();
  } finally {
    handle.closeSync();
  }
}

/**
 * 固定Root以下を二度読み、途中で変化したSnapshotを拒否する。
 *
 * @responsibility 通常Fileの内容とRoot・Directory・File実体の前後一致を確認する。
 * @trace ARCH-000004
 * @input root: 内部で固定したSource Root。
 * @returns 一致した不変観測値。観測不能・不一致・上限超過はnull。
 * @precondition 呼出し元が観測対象Rootを固定している。
 * @postcondition 部分結果を成功値として返さない。
 * @effect Filesystemの読取りだけを行う。
 * @failure link、欠落、非通常File、読取り差、上限超過を拒否する。
 * @invariant 外部へ実行許可を発行せず、内容Hashと実体Hashを分ける。
 * @boundary Node Filesystemから読取り可能な固定Sourceだけを観測する。
 * @security linkを辿らず、外部Rootを返さず、書込みを行わない。
 * @concurrency 二読取りの差を拒否するが、ロード済みModuleとの原子的同一性は保証しない。
 */
function captureDevelopmentSource(root: string): SourceObservation | null {
  try {
    const passes: string[] = [];
    let result: SourceObservation | null = null;
    for (let pass = 0; pass < 2; pass += 1) {
      const content: unknown[] = [SOURCE_SCOPE, PACKAGES, DIRECTORIES];
      const identities: unknown[] = [];
      let fileCount = 0;
      let directoryCount = 0;
      let totalBytes = 0;
      const packagesWithSource = new Set<string>();
      const pending: Array<{
        absolute: string;
        relative: string;
        depth: number;
      }> = [];
      // Root parents are checked independently; root mtime is intentionally not
      // included because excluded .crdd/document updates do not change Source.
      for (const absolute of [root, path.join(root, "40_Develop")]) {
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        if (path.resolve(realpathSync(absolute)) !== path.resolve(absolute))
          return null;
        identities.push([
          absolute === root ? "." : "40_Develop",
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
      }
      for (const packageName of PACKAGES) {
        const relative = `40_Develop/${packageName}`;
        const absolute = path.join(root, "40_Develop", packageName);
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        identities.push([
          relative,
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
        pending.push({
          absolute: path.join(absolute, "package.json"),
          relative: `${relative}/package.json`,
          depth: 0,
        });
        for (const directory of DIRECTORIES) {
          const child = path.join(absolute, directory);
          let childStat: BigIntStats;
          try {
            childStat = lstatSync(child, { bigint: true });
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "ENOENT" ||
              directory === "src"
            )
              throw error;
            content.push([`${relative}/${directory}`, "absent"]);
            continue;
          }
          if (!childStat.isDirectory() || childStat.isSymbolicLink())
            return null;
          pending.push({
            absolute: child,
            relative: `${relative}/${directory}`,
            depth: 0,
          });
        }
      }
      while (pending.length > 0) {
        const entry = pending.pop();
        if (!entry) return null;
        const before = lstatSync(entry.absolute, { bigint: true });
        if (before.isSymbolicLink()) return null;
        if (entry.relative.endsWith("/package.json") && !before.isFile())
          return null;
        if (before.isDirectory()) {
          directoryCount += 1;
          if (directoryCount > MAX_DIRECTORIES || entry.depth > MAX_DEPTH)
            return null;
          const names = readBoundedDirectoryNames(entry.absolute);
          content.push([entry.relative, "directory", names]);
          identities.push([
            entry.relative,
            String(before.dev),
            String(before.ino),
            String(before.birthtimeNs),
          ]);
          for (const name of names) {
            pending.push({
              absolute: path.join(entry.absolute, name),
              relative: `${entry.relative}/${name}`,
              depth: entry.depth + 1,
            });
          }
          continue;
        }
        if (
          !before.isFile() ||
          before.nlink !== 1n ||
          entry.depth > MAX_DEPTH ||
          before.size > BigInt(MAX_FILE_BYTES)
        )
          return null;
        fileCount += 1;
        const sourcePackage = entry.relative.match(
          /^40_Develop\/([^/]+)\/src\//u,
        )?.[1];
        if (sourcePackage) packagesWithSource.add(sourcePackage);
        if (fileCount > MAX_FILES) return null;
        const descriptor = openSync(
          entry.absolute,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        let bytes: Buffer;
        let identity: string;
        try {
          const opened = fstatSync(descriptor, { bigint: true });
          identity = JSON.stringify(
            [
              before.dev,
              before.ino,
              before.size,
              before.mtimeNs,
              before.ctimeNs,
              before.birthtimeNs,
              before.nlink,
            ].map(String),
          );
          const openedIdentity = JSON.stringify(
            [
              opened.dev,
              opened.ino,
              opened.size,
              opened.mtimeNs,
              opened.ctimeNs,
              opened.birthtimeNs,
              opened.nlink,
            ].map(String),
          );
          if (
            !opened.isFile() ||
            opened.nlink !== 1n ||
            openedIdentity !== identity
          )
            return null;
          const buffer = Buffer.alloc(Number(opened.size) + 1);
          let offset = 0;
          while (offset < buffer.length) {
            const count = readSync(
              descriptor,
              buffer,
              offset,
              buffer.length - offset,
              offset,
            );
            if (count === 0) break;
            offset += count;
          }
          if (offset !== Number(opened.size)) return null;
          bytes = buffer.subarray(0, offset);
          const after = fstatSync(descriptor, { bigint: true });
          if (
            JSON.stringify(
              [
                after.dev,
                after.ino,
                after.size,
                after.mtimeNs,
                after.ctimeNs,
                after.birthtimeNs,
                after.nlink,
              ].map(String),
            ) !== identity
          )
            return null;
        } finally {
          closeSync(descriptor);
        }
        const after = lstatSync(entry.absolute, { bigint: true });
        if (
          !after.isFile() ||
          after.nlink !== 1n ||
          after.isSymbolicLink() ||
          JSON.stringify(
            [
              after.dev,
              after.ino,
              after.size,
              after.mtimeNs,
              after.ctimeNs,
              after.birthtimeNs,
              after.nlink,
            ].map(String),
          ) !== identity
        )
          return null;
        totalBytes += bytes.length;
        if (totalBytes > MAX_TOTAL_BYTES) return null;
        content.push([
          entry.relative,
          bytes.length,
          createHash("sha256").update(bytes).digest("hex"),
        ]);
        identities.push([entry.relative, identity]);
      }
      if (packagesWithSource.size !== PACKAGES.length) return null;
      content.splice(
        3,
        content.length - 3,
        ...content
          .slice(3)
          .sort((a, b) =>
            JSON.stringify(a) < JSON.stringify(b)
              ? -1
              : JSON.stringify(a) > JSON.stringify(b)
                ? 1
                : 0,
          ),
      );
      identities.sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b)
          ? -1
          : JSON.stringify(a) > JSON.stringify(b)
            ? 1
            : 0,
      );
      const sourceSha256 = createHash("sha256")
        .update(JSON.stringify(content))
        .digest("hex");
      const sourceIdentitySha256 = createHash("sha256")
        .update(JSON.stringify([sourceSha256, identities]))
        .digest("hex");
      passes.push(sourceIdentitySha256);
      result = Object.freeze({
        scope: SOURCE_SCOPE,
        sourceSha256,
        sourceIdentitySha256,
        fileCount,
        totalBytes,
      });
    }
    return passes[0] === passes[1] ? result : null;
  } catch {
    return null;
  }
}

/**
 * このModule自身が属するRepositoryの開発Sourceを観測する。
 *
 * @responsibility Sessionと入力生成Toolの固定Source観測入口を共有する。
 * @trace ARCH-000004
 * @input N/A: RootとScopeはModuleから固定し、呼出し元に選ばせない。
 * @returns 有界Snapshotの観測値。不完全な観測はnull。
 * @precondition 固定9Packageと必要Sourceが読取り可能である。
 * @postcondition 成功値は二読取りで内容・実体が一致する。
 * @effect Sourceを同期読取りする。永続状態を作らない。
 * @failure 欠落、不正実体、途中変更、上限超過はnull。
 * @invariant この値は実行Authorityでも配布署名でもない。
 * @boundary 固定RepositoryのSourceのみを読み取る。
 * @security 任意Root、期待値自動補完、Source本文の公開を許さない。
 * @concurrency Snapshot観測中の差を拒否する。将来の変更不能は保証しない。
 */
export function observeRuntimeOwnedDevelopmentSource(): SourceObservation | null {
  return captureDevelopmentSource(sourceRoot);
}

export const CHECK_STATUS = Object.freeze([
  "confirmed",
  "blocked",
  "not_implemented",
  "unknown",
] as const);

/**
 * doctorで使用するDoctor Operation Initialization 失敗の値契約を定義する。
 *
 * @responsibility Doctor Operation Initialization 失敗のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DoctorOperationInitializationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DoctorOperationInitializationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: DoctorOperationInitializationFailureの宣言は外部境界を開かない。
 * @security N/A: DoctorOperationInitializationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DoctorOperationInitializationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DoctorOperationInitializationFailure = Readonly<{
  reason: "doctor_operation_initialization_cleanup_unknown";
  manualRecoveryRequired: true;
  hostRecoveryId: string | null;
}>;

const doctorOperationInitializationFailures = new WeakMap<
  object,
  DoctorOperationInitializationFailure
>();

/**
 * Doctor Operation Initialization 失敗を分類する。
 *
 * @responsibility Doctor Operation Initialization 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns classifyDoctorOperationInitializationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyDoctorOperationInitializationFailureの入力契約を満たす。
 * @postcondition classifyDoctorOperationInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyDoctorOperationInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyDoctorOperationInitializationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyDoctorOperationInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyDoctorOperationInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: classifyDoctorOperationInitializationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: classifyDoctorOperationInitializationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyDoctorOperationInitializationFailure(error: unknown) {
  return error && typeof error === "object"
    ? (doctorOperationInitializationFailures.get(error) ?? null)
    : null;
}

/**
 * throw Doctor Operation Initialization 失敗を決定する。
 *
 * @responsibility throw Doctor Operation Initialization 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input cause: unknown、hostRecoveryId: string | null
 * @returns neverを返す。
 * @precondition 「cause: unknown、hostRecoveryId: string | null」がthrowDoctorOperationInitializationFailureの入力契約を満たす。
 * @postcondition throwDoctorOperationInitializationFailureの責務を完了した結果だけを返す。
 * @effect N/A: throwDoctorOperationInitializationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure throwDoctorOperationInitializationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant throwDoctorOperationInitializationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: throwDoctorOperationInitializationFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: throwDoctorOperationInitializationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: throwDoctorOperationInitializationFailureは共有非同期状態を持たない同期処理である。
 */
function throwDoctorOperationInitializationFailure(
  cause: unknown,
  hostRecoveryId: string | null,
): never {
  const error = new Error("doctor_operation_initialization_cleanup_unknown", {
    cause,
  });
  doctorOperationInitializationFailures.set(
    error,
    Object.freeze({
      reason: "doctor_operation_initialization_cleanup_unknown",
      manualRecoveryRequired: true,
      hostRecoveryId,
    }),
  );
  throw error;
}

/**
 * Doctor Operation Creation 失敗を公開結果へ投影する。
 *
 * @responsibility Doctor Operation Creation 失敗の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns neverを返す。
 * @precondition 「error: unknown」がprojectDoctorOperationCreationFailureの入力契約を満たす。
 * @postcondition projectDoctorOperationCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: projectDoctorOperationCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure projectDoctorOperationCreationFailureは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant projectDoctorOperationCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDoctorOperationCreationFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: projectDoctorOperationCreationFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectDoctorOperationCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function projectDoctorOperationCreationFailure(error: unknown): never {
  const creation = classifyOwnedCoordinatorOperationCreationFailure(error);
  if (creation && !creation.cleanupConfirmed)
    throwDoctorOperationInitializationFailure(error, creation.hostRecoveryId);
  throw error;
}

/**
 * doctorで使用するCheck Statusの値契約を定義する。
 *
 * @responsibility Check StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CheckStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckStatusの宣言は外部境界を開かない。
 * @security N/A: CheckStatusはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CheckStatus = "confirmed" | "blocked" | "not_implemented" | "unknown";

/**
 * doctorで使用するDiagnostic Checkの値契約を定義する。
 *
 * @responsibility Diagnostic CheckのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DiagnosticCheckが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DiagnosticCheckで宣言した値と責務の対応を維持する。
 * @boundary N/A: DiagnosticCheckの宣言は外部境界を開かない。
 * @security N/A: DiagnosticCheckはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DiagnosticCheckの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DiagnosticCheck = {
  id: string;
  status: CheckStatus;
  reason: string | null;
  followUp: string | null;
};

/**
 * doctorで使用するDiscovery 結果の値契約を定義する。
 *
 * @responsibility Discovery 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DiscoveryResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DiscoveryResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DiscoveryResultの宣言は外部境界を開かない。
 * @security N/A: DiscoveryResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DiscoveryResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DiscoveryResult = Readonly<{
  located: boolean;
  candidateCount: number;
  formats: readonly string[];
  reason: string | null;
}>;

/**
 * doctorで使用するDoctor Optionsの値契約を定義する。
 *
 * @responsibility Doctor OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DoctorOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DoctorOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: DoctorOptionsの宣言は外部境界を開かない。
 * @security N/A: DoctorOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DoctorOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DoctorOptions = Readonly<{
  activeIsolation: boolean;
  cwd: string;
}>;

/**
 * doctorで使用するDiscovery Optionsの値契約を定義する。
 *
 * @responsibility Discovery OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape DiscoveryOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DiscoveryOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: DiscoveryOptionsの宣言は外部境界を開かない。
 * @security N/A: DiscoveryOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DiscoveryOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DiscoveryOptions = Readonly<{
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  fileSystem?: typeof fs;
}>;

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security N/A: isObjectはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security N/A: ownValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security N/A: errorCodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown): string | null {
  if (!isObject(error)) return null;
  const value = ownValue(error, "code");
  return typeof value === "string" ? value : null;
}

/**
 * doctorを検査する。
 *
 * @responsibility doctorの検査条件、違反分類、検査結果境界を所有する。
 * @trace ARCH-000004
 * @input id: string、status: CheckStatus、reason: string | null、followUp: string | null
 * @returns DiagnosticCheckを返す。
 * @precondition 「id: string、status: CheckStatus、reason: string | null、followUp: string | null」がcheckの入力契約を満たす。
 * @postcondition checkの責務を完了した結果だけを返す。
 * @effect N/A: checkは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: checkは独自の失敗分岐を所有しない。
 * @invariant checkは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: checkはProcess内の同一Subsystemで完結する。
 * @security N/A: checkはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: checkは共有非同期状態を持たない同期処理である。
 */
function check(
  id: string,
  status: CheckStatus,
  reason: string | null,
  followUp: string | null = null,
): DiagnosticCheck {
  return { id, status, reason, followUp };
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security N/A: errorMessageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : null;
}

export const REQUIRED_CHECK_IDS = Object.freeze([
  "runtime.node",
  "repository.git",
  "repository.identity",
  "operation.directories",
  "execution.filesystem",
  "execution.credential_environment",
  "execution.credential_isolation",
  "execution.egress",
  "provider.codex.discovery",
  "provider.codex.authentication",
  "provider.codex.active_probe",
  "provider.codex.auto_update",
  "provider.codex.telemetry",
  "provider.codex.session_resume",
  "provider.codex.timeout",
  "provider.codex.cancel",
  "provider.codex.process_tree_termination",
  "provider.claude.discovery",
  "provider.claude.authentication",
  "provider.claude.active_probe",
  "provider.claude.auto_update",
  "provider.claude.telemetry",
  "provider.claude.session_resume",
  "provider.claude.timeout",
  "provider.claude.cancel",
  "provider.claude.process_tree_termination",
]);

/**
 * Readinessを評価する。
 *
 * @responsibility Readinessの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input checks: unknown
 * @returns evaluateReadinessの計算結果を返す。
 * @precondition 「checks: unknown」がevaluateReadinessの入力契約を満たす。
 * @postcondition evaluateReadinessの責務を完了した結果だけを返す。
 * @effect N/A: evaluateReadinessは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateReadinessは独自の失敗分岐を所有しない。
 * @invariant evaluateReadinessは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateReadinessはProcess内の同一Subsystemで完結する。
 * @security N/A: evaluateReadinessはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: evaluateReadinessは共有非同期状態を持たない同期処理である。
 */
export function evaluateReadiness(checks: unknown) {
  const expected = new Set(REQUIRED_CHECK_IDS);
  const seen = new Set<string>();
  const blockers: Array<{ id: string | null; reason: string }> = [];
  const checkSnapshot = snapshotPlainArray<unknown>(
    checks,
    REQUIRED_CHECK_IDS.length + 1,
  );
  const entries = checkSnapshot.status === "ok" ? checkSnapshot.value : [];

  for (const item of entries) {
    if (item === null || typeof item !== "object") {
      blockers.push({ id: null, reason: "unknown_check" });
      continue;
    }
    const id = Reflect.get(item, "id");
    const status = Reflect.get(item, "status");
    const reason = Reflect.get(item, "reason");
    if (typeof id !== "string" || !expected.has(id)) {
      blockers.push({
        id: typeof id === "string" ? id : null,
        reason: "unknown_check",
      });
      continue;
    }
    if (seen.has(id)) {
      blockers.push({ id, reason: "duplicate_check" });
      continue;
    }
    seen.add(id);
    if (
      typeof status !== "string" ||
      !CHECK_STATUS.some((candidate) => candidate === status)
    ) {
      blockers.push({ id, reason: "invalid_status" });
      continue;
    }
    if (status !== "confirmed") {
      blockers.push({
        id,
        reason: typeof reason === "string" ? reason : status,
      });
    }
  }

  for (const id of REQUIRED_CHECK_IDS) {
    if (!seen.has(id)) blockers.push({ id, reason: "missing_check" });
  }

  return {
    status: blockers.length === 0 ? "ready" : "blocked",
    blockers,
  };
}

/**
 * path Valueを決定する。
 *
 * @responsibility path Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input environment: NodeJS.ProcessEnv
 * @returns stringを返す。
 * @precondition 「environment: NodeJS.ProcessEnv」がpathValueの入力契約を満たす。
 * @postcondition pathValueの責務を完了した結果だけを返す。
 * @effect N/A: pathValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathValueは独自の失敗分岐を所有しない。
 * @invariant pathValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathValueはProcess内の同一Subsystemで完結する。
 * @security N/A: pathValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathValueは共有非同期状態を持たない同期処理である。
 */
function pathValue(environment: NodeJS.ProcessEnv): string {
  return environment.PATH ?? environment.Path ?? "";
}

/**
 * candidate Extensionsを決定する。
 *
 * @responsibility candidate Extensionsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input platform: NodeJS.Platform、environment: NodeJS.ProcessEnv
 * @returns string[]を返す。
 * @precondition 「platform: NodeJS.Platform、environment: NodeJS.ProcessEnv」がcandidateExtensionsの入力契約を満たす。
 * @postcondition candidateExtensionsの責務を完了した結果だけを返す。
 * @effect N/A: candidateExtensionsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: candidateExtensionsは独自の失敗分岐を所有しない。
 * @invariant candidateExtensionsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: candidateExtensionsはProcess内の同一Subsystemで完結する。
 * @security N/A: candidateExtensionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: candidateExtensionsは共有非同期状態を持たない同期処理である。
 */
function candidateExtensions(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv,
): string[] {
  if (platform !== "win32") return [""];
  const configured = environment.PATHEXT ?? ".COM;.EXE;.BAT;.CMD";
  return configured
    .split(";")
    .filter(Boolean)
    .map((value) => value.toLowerCase());
}

/**
 * command Formatを決定する。
 *
 * @responsibility command Formatの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string
 * @returns stringを返す。
 * @precondition 「candidate: string」がcommandFormatの入力契約を満たす。
 * @postcondition commandFormatの責務を完了した結果だけを返す。
 * @effect N/A: commandFormatは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: commandFormatは独自の失敗分岐を所有しない。
 * @invariant commandFormatは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: commandFormatはProcess内の同一Subsystemで完結する。
 * @security N/A: commandFormatはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: commandFormatは共有非同期状態を持たない同期処理である。
 */
function commandFormat(candidate: string): string {
  const extension = path.extname(candidate).toLowerCase().replace(/^\./u, "");
  return extension || "native";
}

/**
 * Commandを探索する。
 *
 * @responsibility Commandの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000004
 * @input command: string、options: DiscoveryOptions
 * @returns DiscoveryResultを返す。
 * @precondition 「command: string、options: DiscoveryOptions」がdiscoverCommandの入力契約を満たす。
 * @postcondition discoverCommandの責務を完了した結果だけを返す。
 * @effect discoverCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure discoverCommandは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discoverCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: discoverCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: discoverCommandは共有非同期状態を持たない同期処理である。
 */
export function discoverCommand(
  command: string,
  options: DiscoveryOptions = {},
): DiscoveryResult {
  const platform = options.platform ?? process.platform;
  const environment = options.environment ?? process.env;
  const fileSystem = options.fileSystem ?? fs;
  const candidates = [];

  for (const directory of pathValue(environment)
    .split(path.delimiter)
    .filter(Boolean)) {
    for (const extension of candidateExtensions(platform, environment)) {
      const candidate = path.join(directory, `${command}${extension}`);
      try {
        const metadata = fileSystem.lstatSync(candidate);
        if (!metadata.isFile() || metadata.isSymbolicLink()) continue;
        if (platform !== "win32" && (metadata.mode & 0o111) === 0) continue;
        candidates.push({ format: commandFormat(candidate) });
      } catch (error) {
        if (errorCode(error) !== "ENOENT" && errorCode(error) !== "ENOTDIR") {
          return {
            located: false,
            candidateCount: 0,
            formats: [],
            reason: "discovery_failed",
          };
        }
      }
    }
  }

  return {
    located: candidates.length > 0,
    candidateCount: candidates.length,
    formats: [
      ...new Set(candidates.map((candidate) => candidate.format)),
    ].sort(),
    reason: candidates.length > 0 ? null : "command_not_found",
  };
}

/**
 * probe Git Repositoryを決定する。
 *
 * @responsibility probe Git Repositoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input cwd: string
 * @returns probeGitRepositoryの計算結果を返す。
 * @precondition 「cwd: string」がprobeGitRepositoryの入力契約を満たす。
 * @postcondition probeGitRepositoryの責務を完了した結果だけを返す。
 * @effect N/A: probeGitRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: probeGitRepositoryは独自の失敗分岐を所有しない。
 * @invariant probeGitRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: probeGitRepositoryはProcess内の同一Subsystemで完結する。
 * @security N/A: probeGitRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: probeGitRepositoryは共有非同期状態を持たない同期処理である。
 */
function probeGitRepository(cwd: string) {
  const identity = inspectRepositoryRevisionCandidate(cwd);

  return {
    gitAvailable: identity?.status === "candidate",
    identityAvailable: identity?.status === "candidate",
    headCommit: identity?.commit ?? null,
    headTree: identity?.tree ?? null,
    workingState: "not_observed",
    externalGitCliUsed: false,
  };
}

/**
 * provider Checksを決定する。
 *
 * @responsibility provider Checksの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input name: string、discovery: DiscoveryResult
 * @returns DiagnosticCheck[]を返す。
 * @precondition 「name: string、discovery: DiscoveryResult」がproviderChecksの入力契約を満たす。
 * @postcondition providerChecksの責務を完了した結果だけを返す。
 * @effect N/A: providerChecksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerChecksは独自の失敗分岐を所有しない。
 * @invariant providerChecksは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: providerChecksはProcess内の同一Subsystemで完結する。
 * @security N/A: providerChecksはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: providerChecksは共有非同期状態を持たない同期処理である。
 */
function providerChecks(
  name: string,
  discovery: DiscoveryResult,
): DiagnosticCheck[] {
  return [
    check(
      `provider.${name}.discovery`,
      discovery.located ? "confirmed" : "blocked",
      discovery.reason,
      discovery.located ? null : "install_or_select_provider_outside_runtime",
    ),
    check(
      `provider.${name}.authentication`,
      "unknown",
      "subscription_oauth_explicit_login_not_evaluated",
    ),
    check(
      `provider.${name}.active_probe`,
      "not_implemented",
      "provider_egress_auth_and_fixed_image_binding_required_before_spawn",
    ),
    check(
      `provider.${name}.auto_update`,
      "not_implemented",
      "provider_fixed_image_and_auto_update_enforcement_not_implemented",
    ),
    check(
      `provider.${name}.telemetry`,
      "not_implemented",
      "provider_telemetry_policy_not_implemented",
    ),
    check(
      `provider.${name}.session_resume`,
      "not_implemented",
      "provider_session_resume_prohibited_but_not_enforced",
    ),
    check(
      `provider.${name}.timeout`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
    check(
      `provider.${name}.cancel`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
    check(
      `provider.${name}.process_tree_termination`,
      "not_implemented",
      "provider_lifecycle_core_candidate_real_binding_not_implemented",
    ),
  ];
}

/**
 * reportable Filesystem Policyを決定する。
 *
 * @responsibility reportable Filesystem Policyの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input policy: ReturnType<typeof describeFilesystemPolicy>、root: string
 * @returns reportableFilesystemPolicyの計算結果を返す。
 * @precondition 「policy: ReturnType<typeof describeFilesystemPolicy>、root: string」がreportableFilesystemPolicyの入力契約を満たす。
 * @postcondition reportableFilesystemPolicyの責務を完了した結果だけを返す。
 * @effect N/A: reportableFilesystemPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reportableFilesystemPolicyは独自の失敗分岐を所有しない。
 * @invariant reportableFilesystemPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reportableFilesystemPolicyはProcess内の同一Subsystemで完結する。
 * @security N/A: reportableFilesystemPolicyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: reportableFilesystemPolicyは共有非同期状態を持たない同期処理である。
 */
function reportableFilesystemPolicy(
  policy: ReturnType<typeof describeFilesystemPolicy>,
  root: string,
) {
  const relative = (value: string) =>
    path.relative(root, value).replaceAll("\\", "/");
  return {
    coordinatorRuntime: {
      write: policy.coordinatorRuntime.write.map(relative),
    },
    repositoryAdapter: { write: policy.repositoryAdapter.write.map(relative) },
    providerProcess: {
      write: policy.providerProcess.write.map(relative),
      deny: policy.providerProcess.deny.map(relative),
    },
    credentialBroker: policy.credentialBroker,
  };
}

const DOCTOR_OPTION_KEYS = new Set(["activeIsolation", "cwd"]);

/**
 * Doctor Optionsを固定Schemaへ正規化する。
 *
 * @responsibility Doctor Optionsの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000004
 * @input rawOptions: unknown
 * @returns DoctorOptionsを返す。
 * @precondition 「rawOptions: unknown」がnormalizeDoctorOptionsの入力契約を満たす。
 * @postcondition normalizeDoctorOptionsの責務を完了した結果だけを返す。
 * @effect normalizeDoctorOptionsは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure normalizeDoctorOptionsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeDoctorOptionsは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: normalizeDoctorOptionsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeDoctorOptionsは共有非同期状態を持たない同期処理である。
 */
function normalizeDoctorOptions(rawOptions: unknown): DoctorOptions {
  try {
    if (
      !rawOptions ||
      typeof rawOptions !== "object" ||
      utilTypes.isProxy(rawOptions) ||
      Array.isArray(rawOptions)
    ) {
      throw new Error("doctor_options_invalid");
    }
    const prototype = Object.getPrototypeOf(rawOptions);
    if (prototype !== Object.prototype && prototype !== null)
      throw new Error("doctor_options_invalid");
    const descriptors = Object.getOwnPropertyDescriptors(rawOptions);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.some(
        (key) => typeof key !== "string" || !DOCTOR_OPTION_KEYS.has(key),
      )
    ) {
      throw new Error("doctor_options_invalid");
    }
    const value = (key: string, fallback: unknown): unknown => {
      const descriptor = descriptors[key];
      if (!descriptor) return fallback;
      if (
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        throw new Error("doctor_options_invalid");
      return descriptor.value;
    };
    const isIsolationActive = value("activeIsolation", false);
    const cwd = value("cwd", process.cwd());
    if (
      typeof isIsolationActive !== "boolean" ||
      typeof cwd !== "string" ||
      !path.isAbsolute(cwd) ||
      /[\u0000-\u001f\u007f]/u.test(cwd)
    ) {
      throw new Error("doctor_options_invalid");
    }
    return Object.freeze({
      activeIsolation: isIsolationActive,
      cwd,
    });
  } catch (error) {
    if (errorMessage(error) === "doctor_options_invalid") throw error;
    throw new Error("doctor_options_invalid");
  }
}

/**
 * Doctorを実行する。
 *
 * @responsibility Doctorの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input options: unknown
 * @returns runDoctorの計算結果を返す。
 * @precondition 「options: unknown」がrunDoctorの入力契約を満たす。
 * @postcondition runDoctorの責務を完了した結果だけを返す。
 * @effect runDoctorは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure runDoctorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runDoctorは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security 秘密値はReportへ含めず、取得済みOperationの所有境界を維持する。診断成功から実Providerの成立を推定しない。
 * @concurrency N/A: runDoctorは共有非同期状態を持たない同期処理である。
 */
export function runDoctor(options: unknown = {}) {
  const normalizedOptions = normalizeDoctorOptions(options);
  const isIsolationActive = normalizedOptions.activeIsolation;
  const cwd = normalizedOptions.cwd;
  let operation: ReturnType<typeof createRuntimeOwnedCoordinatorOperation>;
  try {
    operation = createRuntimeOwnedCoordinatorOperation();
  } catch (error) {
    projectDoctorOperationCreationFailure(error);
  }
  const { owned, hostRecoveryId: initialHostRecoveryId } = operation;
  if (!owned.directories)
    throw new Error("owned_operation_directory_identity_required");
  const ownedDirectories = owned.directories;
  let shouldRetainOperationDirectories = false;
  try {
    const providerEnvironment = createProviderEnvironment(
      process.env,
      ownedDirectories,
    );
    const credentialNames = credentialEnvironmentNamesPresent(process.env);
    const forwardedCredentialNames =
      credentialEnvironmentNamesPresent(providerEnvironment);
    const repository = probeGitRepository(cwd);
    const providers = Object.freeze({
      codex: discoverCommand("codex"),
      claude: discoverCommand("claude"),
    });

    const isolation = isIsolationActive
      ? runDockerIsolationProbe(owned)
      : Object.freeze({
          status: "not_implemented",
          reason: "filesystem_boundary_not_enforced",
          hostCleanupCompleted: false,
          recoveryId: null,
          manualRecoveryRequired: false,
          fakeProviderLifecycle: Object.freeze({
            status: "not_evaluated",
            reason: "dynamic_fake_provider_not_requested",
            provenance: "repository_owned_docker_fake_provider",
            fakeProviderStartAttempted: false,
            fakeProviderExecuted: false,
            resultNormalizationVerified: false,
            containerAbsenceVerified: false,
            processTreeAbsenceVerified: false,
            hostCleanupVerified: false,
            elapsedMs: null,
            stdoutBytes: 0,
            stderrBytes: 0,
            exitCode: null,
            signal: null,
            timedOut: false,
            cancellationRequested: false,
            cancellationObservation: "not_implemented",
            diagnosticDockerContainerEffectIssued: false,
            diagnosticFilesystemEffectIssued: false,
            providerNetworkEffectIssued: false,
            runtimeAuthorityIssued: false,
            operationCapabilityIssued: false,
            realProviderReadiness: false,
          }),
        });
    shouldRetainOperationDirectories = isIsolationActive
      ? isolation.hostCleanupCompleted !== true
      : false;
    const isolationCheckStatus: CheckStatus =
      isolation.status === "confirmed"
        ? "confirmed"
        : isolation.status === "not_implemented"
          ? "not_implemented"
          : "blocked";
    const checks = [
      check(
        "runtime.node",
        isSupportedCoordinatorNodeRuntime(process.versions.node)
          ? "confirmed"
          : "blocked",
        isSupportedCoordinatorNodeRuntime(process.versions.node)
          ? null
          : "node_24_12_or_newer_required",
      ),
      check(
        "repository.git",
        repository.gitAvailable ? "confirmed" : "blocked",
        repository.gitAvailable ? null : "git_unavailable",
      ),
      check(
        "repository.identity",
        repository.identityAvailable ? "confirmed" : "blocked",
        repository.identityAvailable ? null : "repository_identity_unavailable",
      ),
      check(
        "operation.directories",
        "confirmed",
        "owned_operation_directories_created",
      ),
      check("execution.filesystem", isolationCheckStatus, isolation.reason),
      check(
        "execution.credential_environment",
        forwardedCredentialNames.length === 0 ? "confirmed" : "blocked",
        forwardedCredentialNames.length === 0
          ? null
          : "credential_environment_filter_failed",
      ),
      check(
        "execution.credential_isolation",
        isIsolationActive && isolation.status === "confirmed"
          ? "confirmed"
          : "not_implemented",
        isIsolationActive && isolation.status === "confirmed"
          ? "credential_paths_not_mounted_in_fake_probe"
          : "credential_store_isolation_not_enforced",
      ),
      check(
        "execution.egress",
        isIsolationActive && isolation.status === "confirmed"
          ? "blocked"
          : "not_implemented",
        isIsolationActive && isolation.status === "confirmed"
          ? "provider_endpoint_allowlist_not_configured"
          : "provider_egress_allowlist_not_enforced",
      ),
      ...providerChecks("codex", providers.codex),
      ...providerChecks("claude", providers.claude),
    ];
    const readiness = evaluateReadiness(checks);

    const report = {
      reportVersion: 12,
      diagnosticMode: isIsolationActive
        ? "docker_fake_provider_probe"
        : "passive_preflight",
      status: readiness.status,
      platform: process.platform,
      node: {
        version: process.version,
        supported: isSupportedCoordinatorNodeRuntime(process.versions.node),
      },
      repository,
      credentials: {
        detectedNames: credentialNames,
        forwardedNames: forwardedCredentialNames,
        valuesRecorded: false,
        environmentFiltered: forwardedCredentialNames.length === 0,
        isolationEnforcement:
          isIsolationActive && isolation.status === "confirmed"
            ? "confirmed_for_fake_probe"
            : "not_implemented",
      },
      filesystem: {
        policy: reportableFilesystemPolicy(
          describeFilesystemPolicy(ownedDirectories),
          owned.root,
        ),
        enforcement: isolation.status,
        profile: isIsolationActive ? DOCKER_ISOLATION_PROFILE : null,
      },
      rootProtectionPolicy: describeRootProtectionPolicyContract(),
      repositoryLocation: describeRepositoryLocationContract(),
      providerLifecycle: describeProviderLifecycleContract(),
      fakeProviderLifecycle: isolation.fakeProviderLifecycle,
      egress: {
        providerAllowlist: "not_implemented",
        fakeProbeNetwork:
          isIsolationActive && isolation.status === "confirmed"
            ? "blocked"
            : "not_evaluated",
        isolationProfileContract: describeProviderIsolationContract(),
        authorityVerifier: describeAuthorityGrantVerifierContract(),
        authorityTrustLoader: describeAuthorityTrustLoaderContract(),
        authorityFileBundle: describeAuthorityFileBundleContract(),
        authorityPrelaunchVerifier:
          describeAuthorityPrelaunchVerifierContract(),
        proxyTopology: describeDockerProxyTopology("claude"),
      },
      recovery: shouldRetainOperationDirectories
        ? {
            required: true,
            recoveryId: isolation.recoveryId ?? null,
            reason: isolation.reason,
            manualRecoveryRequired: isolation.manualRecoveryRequired === true,
          }
        : { required: false },
      providers,
      checks,
      blockers: readiness.blockers,
    };
    if (!isIsolationActive) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        const filesystemCheck = report.checks.find(
          (item) => item.id === "execution.filesystem",
        );
        if (!filesystemCheck)
          throw new Error("doctor_filesystem_check_missing");
        filesystemCheck.status = "blocked";
        filesystemCheck.reason = "host_operation_cleanup_failed";
        const cleanupReadiness = evaluateReadiness(report.checks);
        report.status = "blocked";
        report.blockers = cleanupReadiness.blockers;
        report.recovery = {
          required: true,
          recoveryId: initialHostRecoveryId,
          reason: "host_operation_cleanup_failed",
          manualRecoveryRequired: false,
        };
      }
    }
    return report;
  } catch (error) {
    if (!isIsolationActive && !shouldRetainOperationDirectories) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        throwDoctorOperationInitializationFailure(error, initialHostRecoveryId);
      }
    }
    throw error;
  }
}

/**
 * 下位が所有する同操作のProbe技術構成を参照する。
 *
 * @responsibility CLIと環境を上位で再構成せず、DIの返却契約だけへ依存する。
 * @trace ARCH-000008
 * @shape ProbeBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProbeBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProbeBindingの宣言は外部境界を開かない。
 * @security ProbeBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProbeBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ProbeBinding = ReturnType<typeof createDockerProbeRuntimeBinding>;

/**
 * docker-isolationで使用するContainer Identityの値契約を定義する。
 *
 * @responsibility Container IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ContainerIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ContainerIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ContainerIdentityの宣言は外部境界を開かない。
 * @security ContainerIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ContainerIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ContainerIdentity = Readonly<{
  id: string;
  probeId: string;
  profile: DockerProbeProfile | "legacy_recovery";
}>;

/**
 * docker-isolationで使用するAbsence Observationの値契約を定義する。
 *
 * @responsibility Absence ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape AbsenceObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AbsenceObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: AbsenceObservationの宣言は外部境界を開かない。
 * @security AbsenceObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility AbsenceObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AbsenceObservation = Readonly<{
  probeId: string;
  containerId: string;
  hostRecoveryId: string;
  rootName: string;
  cli: ProbeBinding;
}>;

/**
 * docker-isolationで使用するDocker Probe 失敗 状態の値契約を定義する。
 *
 * @responsibility Docker Probe 失敗 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerProbeFailureStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerProbeFailureStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerProbeFailureStateの宣言は外部境界を開かない。
 * @security DockerProbeFailureStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerProbeFailureStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerProbeFailureState = Readonly<{
  submissionStarted: boolean;
  recoveryId: string | null;
  hostRecoveryId: string;
  rollbackFailed: boolean;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Recoverable Residue 結果の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Recoverable Residue 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderRecoverableResidueResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderRecoverableResidueResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderRecoverableResidueResultの宣言は外部境界を開かない。
 * @security DynamicFakeProviderRecoverableResidueResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderRecoverableResidueResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderRecoverableResidueResult = Readonly<{
  status: "ready" | "blocked";
  reason: string;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  containerRunning: boolean;
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

const containerIdentities = new WeakMap<object, ContainerIdentity>();

const absenceCapabilities = new WeakMap<object, AbsenceObservation>();

/**
 * docker-isolationで使用するPending Dynamic Fake Provider Lifecycleの値契約を定義する。
 *
 * @responsibility Pending Dynamic Fake Provider LifecycleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PendingDynamicFakeProviderLifecycleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PendingDynamicFakeProviderLifecycleで宣言した値と責務の対応を維持する。
 * @boundary N/A: PendingDynamicFakeProviderLifecycleの宣言は外部境界を開かない。
 * @security PendingDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PendingDynamicFakeProviderLifecycleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PendingDynamicFakeProviderLifecycle = Readonly<{
  observation: DynamicFakeProviderLifecycleObservation;
  probeId: string;
  containerId: string;
  mountCapability: object;
  hostRecoveryId: string;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Finalizationの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider FinalizationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFinalizationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFinalizationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFinalizationの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFinalizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFinalizationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderFinalization = Readonly<{
  pendingCapability: object;
  probeId: string;
  containerId: string;
  mountCapability: object;
  absenceCapability: object;
  hostCleanupCapability: object;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Absenceの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider AbsenceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderAbsenceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderAbsenceで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderAbsenceの宣言は外部境界を開かない。
 * @security DynamicFakeProviderAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderAbsenceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderAbsence = Readonly<{
  probeId: string;
  containerId: string;
  initialHostRecoveryId: string;
  confirmedHostRecoveryId: string;
  root: string;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Host 清掃の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Host 清掃のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderHostCleanupが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderHostCleanupで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderHostCleanupの宣言は外部境界を開かない。
 * @security DynamicFakeProviderHostCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderHostCleanupの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderHostCleanup = Readonly<{
  probeId: string;
  confirmedHostRecoveryId: string;
  absenceCapability: object;
}>;

const pendingDynamicLifecycleObservations = new WeakMap<
  object,
  PendingDynamicFakeProviderLifecycle
>();

const dynamicLifecycleFinalizations = new WeakMap<
  object,
  DynamicFakeProviderFinalization
>();

const dynamicLifecycleAbsences = new WeakMap<
  object,
  DynamicFakeProviderAbsence
>();

const dynamicLifecycleHostCleanups = new WeakMap<
  object,
  DynamicFakeProviderHostCleanup
>();

/**
 * docker-isolationで使用するDocker Probe 結果の値契約を定義する。
 *
 * @responsibility Docker Probe 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DockerProbeResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerProbeResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerProbeResultの宣言は外部境界を開かない。
 * @security DockerProbeResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DockerProbeResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerProbeResult = Readonly<{
  status: "confirmed" | "blocked" | "recovered";
  reason: string;
  probeId: string | null;
  retainOperationDirectories: boolean;
  hostCleanupCompleted: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  fakeProviderLifecycle: DynamicFakeProviderLifecycleObservation;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Lifecycle Observationの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderLifecycleObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderLifecycleObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderLifecycleObservationの宣言は外部境界を開かない。
 * @security DynamicFakeProviderLifecycleObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderLifecycleObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderLifecycleObservation = Readonly<{
  status: "verified" | "candidate" | "blocked" | "not_evaluated";
  reason: string;
  provenance:
    | "repository_owned_docker_fake_provider"
    | "untrusted_execution_fixture";
  fakeProviderStartAttempted: boolean;
  fakeProviderExecuted: boolean;
  resultNormalizationVerified: boolean;
  containerAbsenceVerified: boolean;
  processTreeAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  elapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  cancellationRequested: false;
  cancellationObservation: "not_implemented";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

/**
 * docker-isolationで使用するDynamic Fake Provider Cancellation 結果の値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Cancellation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderCancellationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderCancellationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderCancellationResultの宣言は外部境界を開かない。
 * @security DynamicFakeProviderCancellationResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderCancellationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderCancellationResult = Readonly<{
  status: "verified" | "candidate" | "blocked";
  reason: string;
  cancellationRequested: boolean;
  cancellationSignalRequested: "SIGTERM" | null;
  readyObserved: boolean;
  cancellationAcknowledged: boolean;
  processTerminationObserved: boolean;
  attachProcessTerminationObserved: boolean;
  attachProcessTerminationRequestCount: number;
  containerAbsenceVerified: boolean;
  hostCleanupVerified: boolean;
  graceElapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  retainOperationDirectories: boolean;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  cleanup: "confirmed" | "unconfirmed" | "not_required_or_confirmed";
  diagnosticDockerContainerEffectIssued: boolean;
  diagnosticFilesystemEffectIssued: boolean;
  providerNetworkEffectIssued: false;
  runtimeAuthorityIssued: false;
  operationCapabilityIssued: false;
  realProviderReadiness: false;
}>;

/**
 * Objectかを判定する。
 *
 * @responsibility Objectの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisObjectの入力契約を満たす。
 * @postcondition isObjectの責務を完了した結果だけを返す。
 * @effect N/A: isObjectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isObjectは独自の失敗分岐を所有しない。
 * @invariant isObjectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isObjectはProcess内の同一Subsystemで完結する。
 * @security isObjectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isObjectは共有非同期状態を持たない同期処理である。
 */
function isolationProbeIsObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: object、key: string
 * @returns unknownを返す。
 * @precondition 「value: object、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security ownValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function isolationProbeOwnValue(value: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor &&
    "value" in descriptor &&
    !descriptor.get &&
    !descriptor.set
    ? descriptor.value
    : undefined;
}

/**
 * own Stringを決定する。
 *
 * @responsibility own Stringの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、key: string
 * @returns string | nullを返す。
 * @precondition 「value: unknown、key: string」がownStringの入力契約を満たす。
 * @postcondition ownStringの責務を完了した結果だけを返す。
 * @effect N/A: ownStringは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownStringは独自の失敗分岐を所有しない。
 * @invariant ownStringは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownStringはProcess内の同一Subsystemで完結する。
 * @security ownStringはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownStringは共有非同期状態を持たない同期処理である。
 */
function ownString(value: unknown, key: string): string | null {
  const candidate = isolationProbeIsObject(value)
    ? isolationProbeOwnValue(value, key)
    : undefined;
  return typeof candidate === "string" ? candidate : null;
}

/**
 * error Messageを決定する。
 *
 * @responsibility error Messageの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorMessageの入力契約を満たす。
 * @postcondition errorMessageの責務を完了した結果だけを返す。
 * @effect N/A: errorMessageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorMessageは独自の失敗分岐を所有しない。
 * @invariant errorMessageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorMessageはProcess内の同一Subsystemで完結する。
 * @security errorMessageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorMessageは共有非同期状態を持たない同期処理である。
 */
function isolationProbeErrorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : ownString(error, "message");
}

/**
 * 診断Fake Providerで選択できる固定の故障条件を示す。
 * @responsibility 上位の故障検証入口が受理する四条件を固定する。
 * @trace ARCH-000008
 * @invariant 値・順序をDIの既存profileと一致させ、任意commandを追加しない。
 * @boundary N/A: 固定値の宣言だけで外部要求は発行しない。
 * @security この一覧は実行許可や回復Authorityを発行しない。
 * @compatibility 既存の故障条件文字列と順序を維持する。
 */
export const DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS = Object.freeze([
  "timeout",
  "output_limit",
  "invalid_output",
  "nonzero_exit",
] as const);

/**
 * docker-isolationで使用するDynamic Fake Provider 失敗 Scenarioの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider 失敗 ScenarioのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFailureScenarioが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFailureScenarioで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFailureScenarioの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFailureScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFailureScenarioの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DynamicFakeProviderFailureScenario =
  (typeof DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS)[number];

const FAILURE_SCENARIO_SPECS = Object.freeze({
  timeout: Object.freeze({
    expectedReason: "docker_isolation_probe_timeout",
  }),
  output_limit: Object.freeze({
    expectedReason: "docker_isolation_probe_output_too_large",
  }),
  invalid_output: Object.freeze({
    expectedReason: "docker_isolation_probe_invalid_output",
  }),
  nonzero_exit: Object.freeze({
    expectedReason: "docker_isolation_probe_failed",
  }),
} satisfies Readonly<
  Record<
    DynamicFakeProviderFailureScenario,
    Readonly<{ expectedReason: string }>
  >
>);

/**
 * dynamic Fake Lifecycle Blockedを決定する。
 *
 * @responsibility dynamic Fake Lifecycle Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: string
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「reason: string」がdynamicFakeLifecycleBlockedの入力契約を満たす。
 * @postcondition dynamicFakeLifecycleBlockedの責務を完了した結果だけを返す。
 * @effect N/A: dynamicFakeLifecycleBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dynamicFakeLifecycleBlockedは独自の失敗分岐を所有しない。
 * @invariant dynamicFakeLifecycleBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dynamicFakeLifecycleBlockedはProcess内の同一Subsystemで完結する。
 * @security dynamicFakeLifecycleBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dynamicFakeLifecycleBlockedは共有非同期状態を持たない同期処理である。
 */
function dynamicFakeLifecycleBlocked(
  reason: string,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    status: "blocked",
    reason,
    provenance: "repository_owned_docker_fake_provider",
    fakeProviderStartAttempted: false,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    containerAbsenceVerified: false,
    processTreeAbsenceVerified: false,
    hostCleanupVerified: false,
    elapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    timedOut: false,
    cancellationRequested: false,
    cancellationObservation: "not_implemented",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

/**
 * DIの閉じた実行事実を既存lifecycle表示へ投影する。
 * @responsibility 技術分類を再解釈せず上位の公開fieldへ対応付ける。
 * @trace ARCH-000008
 * @input facts: DIの同じ要求から返された実行事実。
 * @returns 未確定の既存lifecycle観測。
 * @precondition 回収やHost清掃の成立は別途確認する。
 * @postcondition 候補をverifiedへ昇格しない。
 * @effect N/A: 局所値の投影だけ。
 * @failure 下位のblocked理由を維持する。
 * @invariant 生出力やProcess Handleを受け取らない。
 * @boundary DI技術事実とCoordinatorの公開意味。
 * @security この投影からAuthorityを発行しない。
 * @concurrency 同期投影だけ。
 */
function projectProbeExecutionFacts(
  facts: ReturnType<typeof classifyDockerProbeExecution>,
): DynamicFakeProviderLifecycleObservation {
  return Object.freeze({
    ...dynamicFakeLifecycleBlocked(facts.lifecycleReason),
    status: facts.lifecycleStatus,
    provenance: "untrusted_execution_fixture",
    fakeProviderStartAttempted: true,
    fakeProviderExecuted: false,
    resultNormalizationVerified: false,
    elapsedMs: facts.elapsedMs,
    stdoutBytes: facts.stdoutBytes,
    stderrBytes: facts.stderrBytes,
    exitCode: facts.exitCode,
    signal: facts.signal,
    timedOut: facts.timedOut,
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
  });
}

/**
 * cancellation Blockedを決定する。
 *
 * @responsibility cancellation Blockedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: string
 * @returns DynamicFakeProviderCancellationResultを返す。
 * @precondition 「reason: string」がcancellationBlockedの入力契約を満たす。
 * @postcondition cancellationBlockedの責務を完了した結果だけを返す。
 * @effect N/A: cancellationBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancellationBlockedは独自の失敗分岐を所有しない。
 * @invariant cancellationBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancellationBlockedはProcess内の同一Subsystemで完結する。
 * @security cancellationBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancellationBlockedは共有非同期状態を持たない同期処理である。
 */
function cancellationBlocked(
  reason: string,
): DynamicFakeProviderCancellationResult {
  return Object.freeze({
    status: "blocked",
    reason,
    cancellationRequested: false,
    cancellationSignalRequested: null,
    readyObserved: false,
    cancellationAcknowledged: false,
    processTerminationObserved: false,
    attachProcessTerminationObserved: false,
    attachProcessTerminationRequestCount: 0,
    containerAbsenceVerified: false,
    hostCleanupVerified: false,
    graceElapsedMs: null,
    stdoutBytes: 0,
    stderrBytes: 0,
    exitCode: null,
    signal: null,
    retainOperationDirectories: false,
    recoveryId: null,
    manualRecoveryRequired: false,
    cleanup: "not_required_or_confirmed",
    diagnosticDockerContainerEffectIssued: false,
    diagnosticFilesystemEffectIssued: false,
    providerNetworkEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    realProviderReadiness: false,
  });
}

/**
 * Cancellation 失敗を固定Schemaへ正規化する。
 *
 * @responsibility Cancellation 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown
 * @returns stringを返す。
 * @precondition 「error: unknown」がnormalizeCancellationFailureの入力契約を満たす。
 * @postcondition normalizeCancellationFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeCancellationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeCancellationFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeCancellationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeCancellationFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeCancellationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeCancellationFailureは共有非同期状態を持たない同期処理である。
 */
function normalizeCancellationFailure(error: unknown): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_container_identity_unknown",
    "docker_container_security_profile_mismatch",
    "dynamic_fake_provider_cancellation_ready_unconfirmed",
    "dynamic_fake_provider_cancellation_not_requested",
    "dynamic_fake_provider_cancellation_grace_exceeded",
    "dynamic_fake_provider_cancellation_acknowledgement_invalid",
    "dynamic_fake_provider_cancellation_termination_invalid",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = isolationProbeErrorMessage(error);
  return message && known.has(message)
    ? message
    : "dynamic_fake_provider_cancellation_verification_failed";
}

/**
 * Dynamic Fake Provider Lifecycle Capabilityを構築する。
 *
 * @responsibility Dynamic Fake Provider Lifecycle Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input facts: DIの閉じた実行事実、context: 同じProbe・Container・mount・Host相関。
 * @returns Readonly<{ kind: "dynamic_fake_provider_lifecycle" }>を返す。
 * @precondition factsとcontextは同じ保存後実行から得られている。
 * @postcondition 返却した私有参照から同じ候補登録だけを後続が取得できる。
 * @effect 同じ閉factsとcontextの私有pending登録を一回行う。Docker・Filesystem要求は発行しない。
 * @failure N/A: createDynamicFakeProviderLifecycleCapabilityは独自の失敗分岐を所有しない。
 * @invariant 生出力・別Probe・別Hostへ相関を拡張しない。
 * @boundary DIの閉factsとCoordinatorの私有lifecycle参照。
 * @security createDynamicFakeProviderLifecycleCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 新しい参照ごとに独立登録し、既存の後続消費規則を維持する。
 */
function createDynamicFakeProviderLifecycleCapability(
  facts: ReturnType<typeof classifyDockerProbeExecution>,
  context: Readonly<{
    probeId: string;
    containerId: string;
    mountCapability: object;
    hostRecoveryId: string;
  }>,
): Readonly<{ kind: "dynamic_fake_provider_lifecycle" }> {
  const normalized = projectProbeExecutionFacts(facts);
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_lifecycle" as const,
  });
  pendingDynamicLifecycleObservations.set(
    capability,
    Object.freeze({
      observation: Object.freeze({
        ...normalized,
        provenance: "repository_owned_docker_fake_provider",
        fakeProviderExecuted: false,
        resultNormalizationVerified: false,
        diagnosticDockerContainerEffectIssued: true,
        diagnosticFilesystemEffectIssued: true,
      }),
      ...context,
    }),
  );
  return capability;
}

/**
 * docker-isolationで使用するDynamic Fake Provider Finalization Eligibilityの値契約を定義する。
 *
 * @responsibility Dynamic Fake Provider Finalization EligibilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DynamicFakeProviderFinalizationEligibilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DynamicFakeProviderFinalizationEligibilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DynamicFakeProviderFinalizationEligibilityの宣言は外部境界を開かない。
 * @security DynamicFakeProviderFinalizationEligibilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DynamicFakeProviderFinalizationEligibilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DynamicFakeProviderFinalizationEligibility = Readonly<{
  hasRepositoryOwnedProvenance: boolean;
  hasExactResult: boolean;
  hasValidElapsed: boolean;
  hasPostRunMountIdentity: boolean;
  hasContainerAbsence: boolean;
  hasHostCleanup: boolean;
  hasMatchingRunIdentity: boolean;
}>;

/**
 * Dynamic Fake Provider Finalizationを評価する。
 *
 * @responsibility Dynamic Fake Provider Finalizationの評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input input: DynamicFakeProviderFinalizationEligibility
 * @returns evaluateDynamicFakeProviderFinalizationの計算結果を返す。
 * @precondition 「input: DynamicFakeProviderFinalizationEligibility」がevaluateDynamicFakeProviderFinalizationの入力契約を満たす。
 * @postcondition evaluateDynamicFakeProviderFinalizationの責務を完了した結果だけを返す。
 * @effect N/A: evaluateDynamicFakeProviderFinalizationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateDynamicFakeProviderFinalizationは独自の失敗分岐を所有しない。
 * @invariant evaluateDynamicFakeProviderFinalizationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateDynamicFakeProviderFinalizationはProcess内の同一Subsystemで完結する。
 * @security evaluateDynamicFakeProviderFinalizationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateDynamicFakeProviderFinalizationは共有非同期状態を持たない同期処理である。
 */
function evaluateDynamicFakeProviderFinalization(
  input: DynamicFakeProviderFinalizationEligibility,
) {
  const isEligible =
    input.hasRepositoryOwnedProvenance &&
    input.hasExactResult &&
    input.hasValidElapsed &&
    input.hasPostRunMountIdentity &&
    input.hasContainerAbsence &&
    input.hasHostCleanup &&
    input.hasMatchingRunIdentity;
  return Object.freeze({
    status: isEligible ? ("candidate" as const) : ("blocked" as const),
    reason: isEligible
      ? "dynamic_fake_provider_finalization_candidate"
      : "dynamic_fake_provider_finalization_incomplete",
    observationAuthority: false,
  });
}

/**
 * Dynamic Fake Provider Finalization Capabilityを構築する。
 *
 * @responsibility Dynamic Fake Provider Finalization Capabilityの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input pendingCapability: object、context: Omit<DynamicFakeProviderFinalization, "pendingCapability">
 * @returns Readonly<{ kind: "dynamic_fake_provider_finalization" }>を返す。
 * @precondition 「pendingCapability: object、context: Omit<DynamicFakeProviderFinalization, "pendingCapability">」がcreateDynamicFakeProviderFinalizationCapabilityの入力契約を満たす。
 * @postcondition createDynamicFakeProviderFinalizationCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: createDynamicFakeProviderFinalizationCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createDynamicFakeProviderFinalizationCapabilityは独自の失敗分岐を所有しない。
 * @invariant createDynamicFakeProviderFinalizationCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createDynamicFakeProviderFinalizationCapabilityはProcess内の同一Subsystemで完結する。
 * @security createDynamicFakeProviderFinalizationCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDynamicFakeProviderFinalizationCapabilityは共有非同期状態を持たない同期処理である。
 */
function createDynamicFakeProviderFinalizationCapability(
  pendingCapability: object,
  context: Omit<DynamicFakeProviderFinalization, "pendingCapability">,
): Readonly<{ kind: "dynamic_fake_provider_finalization" }> {
  const capability = Object.freeze({
    kind: "dynamic_fake_provider_finalization" as const,
  });
  dynamicLifecycleFinalizations.set(
    capability,
    Object.freeze({ pendingCapability, ...context }),
  );
  return capability;
}

/**
 * invalidate Dynamic Fake Provider Lifecycleを決定する。
 *
 * @responsibility invalidate Dynamic Fake Provider Lifecycleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input capability: object | null
 * @returns N/A: invalidateDynamicFakeProviderLifecycleは戻り値を返さない。
 * @precondition 「capability: object | null」がinvalidateDynamicFakeProviderLifecycleの入力契約を満たす。
 * @postcondition invalidateDynamicFakeProviderLifecycleの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: invalidateDynamicFakeProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: invalidateDynamicFakeProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant invalidateDynamicFakeProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: invalidateDynamicFakeProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security invalidateDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: invalidateDynamicFakeProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
function invalidateDynamicFakeProviderLifecycle(capability: object | null) {
  if (capability) pendingDynamicLifecycleObservations.delete(capability);
}

/**
 * finalize Dynamic Fake Provider Lifecycleを決定する。
 *
 * @responsibility finalize Dynamic Fake Provider Lifecycleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input pendingCapability: object、finalizationCapability: object
 * @returns DynamicFakeProviderLifecycleObservationを返す。
 * @precondition 「pendingCapability: object、finalizationCapability: object」がfinalizeDynamicFakeProviderLifecycleの入力契約を満たす。
 * @postcondition finalizeDynamicFakeProviderLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: finalizeDynamicFakeProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finalizeDynamicFakeProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant finalizeDynamicFakeProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalizeDynamicFakeProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security finalizeDynamicFakeProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalizeDynamicFakeProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
function finalizeDynamicFakeProviderLifecycle(
  pendingCapability: object,
  finalizationCapability: object,
): DynamicFakeProviderLifecycleObservation {
  const pending = pendingDynamicLifecycleObservations.get(pendingCapability);
  const finalization = dynamicLifecycleFinalizations.get(
    finalizationCapability,
  );
  pendingDynamicLifecycleObservations.delete(pendingCapability);
  dynamicLifecycleFinalizations.delete(finalizationCapability);
  const absence = finalization
    ? dynamicLifecycleAbsences.get(finalization.absenceCapability)
    : null;
  const hostCleanup = finalization
    ? dynamicLifecycleHostCleanups.get(finalization.hostCleanupCapability)
    : null;
  if (finalization) {
    dynamicLifecycleAbsences.delete(finalization.absenceCapability);
    dynamicLifecycleHostCleanups.delete(finalization.hostCleanupCapability);
  }
  if (!pending || !finalization || !absence || !hostCleanup)
    return dynamicFakeLifecycleBlocked(
      "dynamic_fake_provider_provenance_unverified",
    );
  const eligibility = evaluateDynamicFakeProviderFinalization({
    hasRepositoryOwnedProvenance:
      pending.observation.provenance ===
      "repository_owned_docker_fake_provider",
    hasExactResult: pending.observation.status === "candidate",
    hasValidElapsed:
      typeof pending.observation.elapsedMs === "number" &&
      Number.isSafeInteger(pending.observation.elapsedMs) &&
      pending.observation.elapsedMs >= 0 &&
      pending.observation.elapsedMs <= 30_000,
    hasPostRunMountIdentity:
      pending.mountCapability === finalization.mountCapability,
    hasContainerAbsence:
      absence.probeId === pending.probeId &&
      absence.containerId === pending.containerId &&
      absence.initialHostRecoveryId === pending.hostRecoveryId &&
      absence.confirmedHostRecoveryId !== absence.initialHostRecoveryId,
    hasHostCleanup:
      hostCleanup.probeId === pending.probeId &&
      hostCleanup.confirmedHostRecoveryId === absence.confirmedHostRecoveryId &&
      hostCleanup.absenceCapability === finalization.absenceCapability,
    hasMatchingRunIdentity:
      finalization.pendingCapability === pendingCapability &&
      pending.probeId === finalization.probeId &&
      pending.containerId === finalization.containerId,
  });
  if (eligibility.status !== "candidate")
    return Object.freeze({
      ...pending.observation,
      status: "blocked",
      reason: eligibility.reason,
    });
  return Object.freeze({
    ...pending.observation,
    status: "verified",
    fakeProviderExecuted: true,
    resultNormalizationVerified: true,
    containerAbsenceVerified: true,
    processTreeAbsenceVerified: true,
    hostCleanupVerified: true,
  });
}

/**
 * Docker Submissionを開始する。
 *
 * @responsibility Docker Submissionの開始条件、初期状態、開始失敗境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown」がbeginDockerSubmissionの入力契約を満たす。
 * @postcondition beginDockerSubmissionの責務を完了した結果だけを返す。
 * @effect N/A: beginDockerSubmissionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: beginDockerSubmissionは独自の失敗分岐を所有しない。
 * @invariant beginDockerSubmissionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: beginDockerSubmissionはProcess内の同一Subsystemで完結する。
 * @security beginDockerSubmissionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: beginDockerSubmissionは共有非同期状態を持たない同期処理である。
 */
function beginDockerSubmission(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "host_only",
    "docker_submission_started",
    mountCapability,
  );
}

/**
 * Docker Submission Before Createを取り消す。
 *
 * @responsibility Docker Submission Before Createの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown
 * @returns stringを返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown」がcancelDockerSubmissionBeforeCreateの入力契約を満たす。
 * @postcondition cancelDockerSubmissionBeforeCreateの責務を完了した結果だけを返す。
 * @effect N/A: cancelDockerSubmissionBeforeCreateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelDockerSubmissionBeforeCreateは独自の失敗分岐を所有しない。
 * @invariant cancelDockerSubmissionBeforeCreateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelDockerSubmissionBeforeCreateはProcess内の同一Subsystemで完結する。
 * @security cancelDockerSubmissionBeforeCreateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelDockerSubmissionBeforeCreateは共有非同期状態を持たない同期処理である。
 */
function cancelDockerSubmissionBeforeCreate(
  hostRecoveryId: string,
  mountCapability: unknown,
): string {
  return transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "host_only",
    mountCapability,
  );
}

/**
 * Docker Absenceを確認する。
 *
 * @responsibility Docker Absenceの確認根拠、成立条件、観測不能境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、mountCapability: unknown、capability: unknown、expected: Readonly<{ probeId: string; id: string; rootName: string; cli: ProbeBinding; }>
 * @returns Readonly<{ hostRecoveryId: string; lifecycleAbsenceCapability: object; }>を返す。
 * @precondition 「hostRecoveryId: string、mountCapability: unknown、capability: unknown、expected: Readonly<{ probeId: string; id: string; rootName: string; cli: ProbeBinding; }>」がconfirmDockerAbsenceの入力契約を満たす。
 * @postcondition confirmDockerAbsenceの責務を完了した結果だけを返す。
 * @effect N/A: confirmDockerAbsenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure confirmDockerAbsenceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmDockerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmDockerAbsenceはProcess内の同一Subsystemで完結する。
 * @security confirmDockerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmDockerAbsenceは共有非同期状態を持たない同期処理である。
 */
function confirmDockerAbsence(
  hostRecoveryId: string,
  mountCapability: unknown,
  capability: unknown,
  expected: Readonly<{
    probeId: string;
    id: string;
    rootName: string;
    cli: ProbeBinding;
    root: string;
  }>,
): Readonly<{
  hostRecoveryId: string;
  lifecycleAbsenceCapability: object;
}> {
  const observation = isolationProbeIsObject(capability)
    ? (absenceCapabilities.get(capability) ?? null)
    : null;
  if (
    !observation ||
    observation.hostRecoveryId !== hostRecoveryId ||
    observation.probeId !== expected.probeId ||
    observation.containerId !== expected.id ||
    observation.rootName !== expected.rootName ||
    observation.cli !== expected.cli
  )
    throw new Error("docker_absence_capability_required");
  const updated = transitionHostRecoveryState(
    hostRecoveryId,
    "docker_submission_started",
    "docker_absent_confirmed",
    mountCapability,
    expected.root,
  );
  if (isolationProbeIsObject(capability))
    absenceCapabilities.delete(capability);
  const lifecycleAbsenceCapability = Object.freeze({
    kind: "dynamic_fake_provider_absence",
  });
  dynamicLifecycleAbsences.set(
    lifecycleAbsenceCapability,
    Object.freeze({
      probeId: expected.probeId,
      containerId: expected.id,
      initialHostRecoveryId: hostRecoveryId,
      confirmedHostRecoveryId: updated,
      root: expected.root,
    }),
  );
  return Object.freeze({
    hostRecoveryId: updated,
    lifecycleAbsenceCapability,
  });
}

/**
 * 失敗を固定Schemaへ正規化する。
 *
 * @responsibility 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、fallback
 * @returns stringを返す。
 * @precondition 「error: unknown、fallback」がnormalizeFailureの入力契約を満たす。
 * @postcondition normalizeFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeFailureは共有非同期状態を持たない同期処理である。
 */
function normalizeFailure(
  error: unknown,
  fallback = "docker_isolation_probe_failed",
): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_mount_path_unsupported",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message = isolationProbeErrorMessage(error);
  return message && known.has(message) ? message : fallback;
}

/**
 * 所有 Containerを観測する。
 *
 * @responsibility 所有 Containerの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input cli: ProbeBinding、capability: object、mounts: DockerMounts
 * @returns 構成一致時のRunning肯定事実、またはnullを返す。
 * @precondition 「cli: ProbeBinding、capability: object、mounts: DockerMounts」がinspectOwnedContainerの入力契約を満たす。
 * @postcondition inspectOwnedContainerの責務を完了した結果だけを返す。
 * @effect 下位へ固定inspectとmount実体観測を委譲する。
 * @failure 私有参照欠測・構成差・観測不能はnull。下位例外は呼出し元へ伝播する。
 * @invariant inspectOwnedContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Coordinatorの私有参照とDIのDocker／Filesystem観測。
 * @security inspectOwnedContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectOwnedContainerは共有非同期状態を持たない同期処理である。
 */
function inspectOwnedContainer(
  cli: ProbeBinding,
  capability: object,
  mounts: DockerMounts,
): Readonly<{ runningConfirmed: boolean }> | null {
  const identity = containerIdentities.get(capability);
  if (!identity) return null;
  return inspectDockerProbeContainer(
    cli,
    describeDockerProbeConfiguration(
      identity.profile,
      { id: identity.id, probeId: identity.probeId },
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    ),
  );
}

/**
 * Container Absenceを観測する。
 *
 * @responsibility Container Absenceの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input cli: ProbeBinding、identity: ContainerIdentity、hostRecoveryId: string、rootName: string
 * @returns Readonly<{ kind: "docker_absence" }> | nullを返す。
 * @precondition 「cli: ProbeBinding、identity: ContainerIdentity、hostRecoveryId: string、rootName: string」がobserveContainerAbsenceの入力契約を満たす。
 * @postcondition observeContainerAbsenceの責務を完了した結果だけを返す。
 * @effect 下位の三軸一覧観測と、共同成功時だけの私有参照登録を行う。
 * @failure 三軸の共同成功でなければnull。下位例外は伝播し、参照を登録しない。
 * @invariant observeContainerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary DIの不存在観測とCoordinatorの私有相関登録。
 * @security observeContainerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeContainerAbsenceは共有非同期状態を持たない同期処理である。
 */
function observeContainerAbsence(
  cli: ProbeBinding,
  identity: ContainerIdentity,
  hostRecoveryId: string,
  rootName: string,
): Readonly<{ kind: "docker_absence" }> | null {
  const observed = observeDockerProbeContainerAbsence(cli, {
    id: identity.id,
    probeId: identity.probeId,
  });
  if (
    observed.status !== "confirmed" ||
    observed.reason !== "docker_probe_absence_confirmed"
  )
    return null;
  const capability = Object.freeze({ kind: "docker_absence" });
  absenceCapabilities.set(
    capability,
    Object.freeze({
      probeId: identity.probeId,
      containerId: identity.id,
      hostRecoveryId,
      rootName,
      cli,
    }),
  );
  return capability;
}

/**
 * 所有 Containerを清掃する。
 *
 * @responsibility 所有 Containerの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input cli: ProbeBinding、capability: object、mounts: DockerMounts、hostRecoveryId: string
 * @returns cleanupOwnedContainerの計算結果を返す。
 * @precondition 「cli: ProbeBinding、capability: object、mounts: DockerMounts、hostRecoveryId: string」がcleanupOwnedContainerの入力契約を満たす。
 * @postcondition cleanupOwnedContainerの責務を完了した結果だけを返す。
 * @effect 下位のfresh inspect・実ID限定削除・三軸不存在確認を委譲し、成功時だけ私有参照を登録する。
 * @failure 私有参照欠測・構成差・回収不成立を区別する。下位例外は伝播する。
 * @invariant cleanupOwnedContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary DIの限定回収とCoordinatorの私有参照登録・消費。
 * @security cleanupOwnedContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupOwnedContainerは共有非同期状態を持たない同期処理である。
 */
function cleanupOwnedContainer(
  cli: ProbeBinding,
  capability: object,
  mounts: DockerMounts,
  hostRecoveryId: string,
) {
  const identity = containerIdentities.get(capability);
  if (!identity)
    return { confirmed: false, reason: "docker_container_identity_unknown" };
  const cleanup = cleanupDockerProbeContainer(
    cli,
    describeDockerProbeConfiguration(
      identity.profile,
      { id: identity.id, probeId: identity.probeId },
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    ),
  );
  if (
    cleanup.confirmed !== true ||
    cleanup.reason !== "docker_probe_absence_confirmed"
  )
    return {
      confirmed: false,
      reason:
        cleanup.confirmed === false &&
        cleanup.reason === "docker_container_identity_mismatch"
          ? cleanup.reason
          : "docker_probe_cleanup_failed",
    };
  const absenceCapability = Object.freeze({ kind: "docker_absence" });
  absenceCapabilities.set(
    absenceCapability,
    Object.freeze({
      probeId: identity.probeId,
      containerId: identity.id,
      hostRecoveryId,
      rootName: path.basename(path.dirname(mounts.management)),
      cli,
    }),
  );
  containerIdentities.delete(capability);
  return {
    confirmed: true,
    reason: "docker_probe_absence_confirmed",
    absenceCapability,
  };
}

/**
 * docker-isolationを停止結果として構築する。
 *
 * @responsibility docker-isolationの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired
 * @returns DockerProbeResultを返す。
 * @precondition 「reason: string、probeId: string | null、shouldRetainOperationDirectories、recoveryId: string | null、isManualRecoveryRequired」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function isolationProbeBlocked(
  reason: string,
  probeId: string | null = null,
  shouldRetainOperationDirectories = false,
  recoveryId: string | null = null,
  isManualRecoveryRequired = false,
): DockerProbeResult {
  return {
    status: "blocked",
    reason,
    probeId,
    retainOperationDirectories: shouldRetainOperationDirectories,
    hostCleanupCompleted: false,
    recoveryId,
    manualRecoveryRequired: isManualRecoveryRequired,
    cleanup: shouldRetainOperationDirectories
      ? "unconfirmed"
      : "not_required_or_confirmed",
    fakeProviderLifecycle: dynamicFakeLifecycleBlocked(reason),
  };
}

/**
 * Docker Probe 失敗を固定Schemaへ正規化する。
 *
 * @responsibility Docker Probe 失敗の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input error: unknown、probeId: string、state: DockerProbeFailureState
 * @returns DockerProbeResultを返す。
 * @precondition 「error: unknown、probeId: string、state: DockerProbeFailureState」がnormalizeDockerProbeFailureの入力契約を満たす。
 * @postcondition normalizeDockerProbeFailureの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDockerProbeFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeDockerProbeFailureは独自の失敗分岐を所有しない。
 * @invariant normalizeDockerProbeFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDockerProbeFailureはProcess内の同一Subsystemで完結する。
 * @security normalizeDockerProbeFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDockerProbeFailureは共有非同期状態を持たない同期処理である。
 */
export function normalizeDockerProbeFailure(
  error: unknown,
  probeId: string,
  state: DockerProbeFailureState,
): DockerProbeResult {
  if (state.rollbackFailed === true) {
    return isolationProbeBlocked(
      "docker_submission_rollback_failed",
      probeId,
      true,
      null,
      true,
    );
  }
  return isolationProbeBlocked(
    normalizeFailure(error),
    probeId,
    state.submissionStarted,
    state.submissionStarted ? state.recoveryId : state.hostRecoveryId,
  );
}

/**
 * Host 回復を終了状態へ収束させる。
 *
 * @responsibility Host 回復の終了条件、最終状態、残存義務の境界を所有する。
 * @trace ARCH-000008
 * @input hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string、lifecycleAbsenceCapability: object
 * @returns Readonly<{ result: DockerProbeResult; lifecycleHostCleanupCapability: object | null; }>を返す。
 * @precondition 「hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string、lifecycleAbsenceCapability: object」がfinishHostRecoveryの入力契約を満たす。
 * @postcondition finishHostRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: finishHostRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finishHostRecoveryは独自の失敗分岐を所有しない。
 * @invariant finishHostRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finishHostRecoveryはProcess内の同一Subsystemで完結する。
 * @security finishHostRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishHostRecoveryは共有非同期状態を持たない同期処理である。
 */
function finishHostRecovery(
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
  lifecycleAbsenceCapability: object,
): Readonly<{
  result: DockerProbeResult;
  lifecycleHostCleanupCapability: object | null;
}> {
  const absence = dynamicLifecycleAbsences.get(lifecycleAbsenceCapability);
  if (
    !absence ||
    absence.probeId !== probeId ||
    absence.confirmedHostRecoveryId !== hostRecoveryId
  )
    throw new Error("docker_absence_capability_required");
  const recovered = recoverOwnedOperationDirectories(
    hostRecoveryId,
    null,
    absence.root,
  );
  const result = normalizeHostCleanupResult(
    recovered,
    hostRecoveryId,
    baseResult,
    probeId,
  );
  if (!result.hostCleanupCompleted)
    return Object.freeze({ result, lifecycleHostCleanupCapability: null });
  const lifecycleHostCleanupCapability = Object.freeze({
    kind: "dynamic_fake_provider_host_cleanup",
  });
  dynamicLifecycleHostCleanups.set(
    lifecycleHostCleanupCapability,
    Object.freeze({
      probeId,
      confirmedHostRecoveryId: hostRecoveryId,
      absenceCapability: lifecycleAbsenceCapability,
    }),
  );
  return Object.freeze({ result, lifecycleHostCleanupCapability });
}

/**
 * Host 清掃 結果を固定Schemaへ正規化する。
 *
 * @responsibility Host 清掃 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input recovered: Readonly<{ status: string; reason: string }>、hostRecoveryId: string、baseResult: Partial<DockerProbeResult>、probeId: string | null
 * @returns DockerProbeResultを返す。
 * @precondition 「recovered: Readonly<{ status: string; reason: string }>、hostRecoveryId: string、baseResult: Partial<DockerProbeResult>、probeId: string | null」がnormalizeHostCleanupResultの入力契約を満たす。
 * @postcondition normalizeHostCleanupResultの責務を完了した結果だけを返す。
 * @effect N/A: normalizeHostCleanupResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeHostCleanupResultは独自の失敗分岐を所有しない。
 * @invariant normalizeHostCleanupResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeHostCleanupResultはProcess内の同一Subsystemで完結する。
 * @security normalizeHostCleanupResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeHostCleanupResultは共有非同期状態を持たない同期処理である。
 */
export function normalizeHostCleanupResult(
  recovered: Readonly<{ status: string; reason: string }>,
  hostRecoveryId: string,
  baseResult: Partial<DockerProbeResult> = {},
  probeId: string | null = null,
): DockerProbeResult {
  return recovered?.status === "recovered"
    ? {
        ...isolationProbeBlocked(
          typeof baseResult.reason === "string"
            ? baseResult.reason
            : "host_cleanup_recovered",
          typeof baseResult.probeId === "string" ? baseResult.probeId : probeId,
        ),
        ...baseResult,
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      }
    : isolationProbeBlocked(
        recovered?.reason ?? "host_recovery_failed",
        probeId,
        true,
        hostRecoveryId,
      );
}

/**
 * Pre Submission 清掃を終了状態へ収束させる。
 *
 * @responsibility Pre Submission 清掃の終了条件、最終状態、残存義務の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、hostRecoveryId: string、baseResult: DockerProbeResult、probeId: string」がfinishPreSubmissionCleanupの入力契約を満たす。
 * @postcondition finishPreSubmissionCleanupの責務を完了した結果だけを返す。
 * @effect N/A: finishPreSubmissionCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure finishPreSubmissionCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant finishPreSubmissionCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finishPreSubmissionCleanupはProcess内の同一Subsystemで完結する。
 * @security finishPreSubmissionCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finishPreSubmissionCleanupは共有非同期状態を持たない同期処理である。
 */
function finishPreSubmissionCleanup(
  owned: unknown,
  hostRecoveryId: string,
  baseResult: DockerProbeResult,
  probeId: string,
): DockerProbeResult {
  try {
    cleanupOwnedOperationDirectories(owned);
    return {
      ...baseResult,
      hostCleanupCompleted: true,
      retainOperationDirectories: false,
      recoveryId: null,
      cleanup: "confirmed",
    };
  } catch {
    return {
      ...isolationProbeBlocked(
        "host_operation_cleanup_failed",
        probeId,
        true,
        hostRecoveryId,
      ),
    };
  }
}

/**
 * Docker Isolation Scenarioを実行する。
 *
 * @responsibility Docker Isolation Scenarioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、scenario: DynamicFakeProviderFailureScenario | null
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、scenario: DynamicFakeProviderFailureScenario | null」がrunDockerIsolationScenarioの入力契約を満たす。
 * @postcondition runDockerIsolationScenarioの責務を完了した結果だけを返す。
 * @effect N/A: runDockerIsolationScenarioは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runDockerIsolationScenarioは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runDockerIsolationScenarioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runDockerIsolationScenarioはProcess内の同一Subsystemで完結する。
 * @security runDockerIsolationScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDockerIsolationScenarioは共有非同期状態を持たない同期処理である。
 */
function runDockerIsolationScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario | null,
): DockerProbeResult {
  const probeId = randomUUID();
  let cli: ProbeBinding | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let recoveryId: string | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  let hasRollbackFailed = false;
  const recoveryNonce = randomUUID();
  let result: DockerProbeResult = isolationProbeBlocked(
    "docker_isolation_probe_failed",
  );
  let dynamicLifecycleCapability: Readonly<{
    kind: "dynamic_fake_provider_lifecycle";
  }> | null = null;
  try {
    cli = createDockerProbeRuntimeBinding(() => {
      mountCapability = createOwnedMountCapability(owned);
      mounts = verifyOwnedMountCapability(mountCapability);
      return mounts.management;
    });
    if (!mountCapability)
      throw new Error("owned_operation_mount_capability_required");
    if (!observeDockerProbeEngine(cli)) {
      result = isolationProbeBlocked(
        "local_docker_desktop_linux_engine_required",
        probeId,
      );
    } else {
      mounts = verifyOwnedMountCapability(mountCapability);
      hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
      hasSubmissionStarted = true;
      try {
        recoveryId = writeDockerProbeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          null,
        );
      } catch (error) {
        try {
          hostRecoveryId = cancelDockerSubmissionBeforeCreate(
            hostRecoveryId,
            mountCapability,
          );
          hasSubmissionStarted = false;
        } catch {
          hasRollbackFailed = true;
        }
        throw error;
      }
      hasContainerCreateAttempted = true;
      const creationCli = cli;
      const normalizedCreation = createDockerProbeContainer(
        creationCli,
        scenario ?? "normal",
        probeId,
        {
          workspace: mounts.workspace,
          providerHome: mounts.providerHome,
          tmp: mounts.tmp,
        },
      );
      if (normalizedCreation.status !== "confirmed") {
        result = isolationProbeBlocked(
          "docker_container_identity_unknown",
          probeId,
          true,
          recoveryId,
        );
      } else {
        const identity = Object.freeze({
          id: normalizedCreation.id,
          probeId,
          profile: scenario ?? "normal",
        });
        containerIdentity = identity;
        containerCapability = Object.freeze({ kind: "owned_docker_probe" });
        containerIdentities.set(containerCapability, identity);
        recoveryId = writeDockerProbeRecoveryRecord(
          mounts,
          probeId,
          recoveryNonce,
          hostRecoveryId,
          identity.id,
        );
        mounts = verifyOwnedMountCapability(mountCapability);
        if (!inspectOwnedContainer(cli, containerCapability, mounts)) {
          result = isolationProbeBlocked(
            "docker_container_security_profile_mismatch",
            probeId,
            true,
            recoveryId,
          );
        } else {
          mounts = verifyOwnedMountCapability(mountCapability);
          const executionCli = cli;
          const facts = runDockerProbeToCompletion(
            executionCli,
            scenario ?? "normal",
            identity.id,
          );
          const normalized = facts.isolation;
          result = {
            ...isolationProbeBlocked(normalized.reason, probeId),
            status: normalized.status === "confirmed" ? "confirmed" : "blocked",
            fakeProviderLifecycle: dynamicFakeLifecycleBlocked(
              "dynamic_fake_provider_absence_unconfirmed",
            ),
          };
          mounts = verifyOwnedMountCapability(mountCapability);
          dynamicLifecycleCapability =
            createDynamicFakeProviderLifecycleCapability(facts, {
              probeId,
              containerId: identity.id,
              mountCapability,
              hostRecoveryId,
            });
        }
      }
    }
  } catch (error) {
    result = normalizeDockerProbeFailure(error, probeId, {
      submissionStarted: hasSubmissionStarted,
      recoveryId,
      hostRecoveryId,
      rollbackFailed: hasRollbackFailed,
    });
  } finally {
    if (containerCapability && cli && mounts) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed) {
          invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
          result = isolationProbeBlocked(
            cleanup.reason,
            probeId,
            true,
            recoveryId,
          );
        } else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity?.id ?? "",
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
              root: path.dirname(mounts.management),
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const hostCleanup = finishHostRecovery(
            hostRecoveryId,
            result,
            probeId,
            absence.lifecycleAbsenceCapability,
          );
          result = hostCleanup.result;
          if (
            dynamicLifecycleCapability &&
            mountCapability &&
            containerIdentity &&
            result.status === "confirmed" &&
            result.hostCleanupCompleted &&
            hostCleanup.lifecycleHostCleanupCapability
          ) {
            const finalizationCapability =
              createDynamicFakeProviderFinalizationCapability(
                dynamicLifecycleCapability,
                {
                  probeId,
                  containerId: containerIdentity.id,
                  mountCapability,
                  absenceCapability: absence.lifecycleAbsenceCapability,
                  hostCleanupCapability:
                    hostCleanup.lifecycleHostCleanupCapability,
                },
              );
            const lifecycle = finalizeDynamicFakeProviderLifecycle(
              dynamicLifecycleCapability,
              finalizationCapability,
            );
            result = {
              ...result,
              status:
                lifecycle.status === "verified" ? result.status : "blocked",
              reason:
                lifecycle.status === "verified"
                  ? result.reason
                  : lifecycle.reason,
              fakeProviderLifecycle: lifecycle,
            };
          } else {
            invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
            const failureReason =
              result.status === "blocked"
                ? result.reason
                : "dynamic_fake_provider_finalization_incomplete";
            result = {
              ...result,
              status: "blocked",
              reason: failureReason,
              fakeProviderLifecycle: dynamicFakeLifecycleBlocked(failureReason),
            };
          }
        }
      } catch {
        invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
        result = isolationProbeBlocked(
          "docker_probe_cleanup_failed",
          probeId,
          true,
          recoveryId,
        );
      }
    } else if (!hasSubmissionStarted) {
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
      result = finishPreSubmissionCleanup(
        owned,
        hostRecoveryId,
        result,
        probeId,
      );
    }
    if (hasSubmissionStarted && !containerCapability)
      invalidateDynamicFakeProviderLifecycle(dynamicLifecycleCapability);
  }
  return {
    ...result,
    fakeProviderLifecycle: Object.freeze({
      ...result.fakeProviderLifecycle,
      diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
      diagnosticFilesystemEffectIssued: true,
    }),
  };
}

/**
 * Docker Isolation Probeを実行する。
 *
 * @responsibility Docker Isolation Probeの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown」がrunDockerIsolationProbeの入力契約を満たす。
 * @postcondition runDockerIsolationProbeの責務を完了した結果だけを返す。
 * @effect 同じOperationの回復記録とHost状態を更新し、固定Docker Probeの作成・観測・回収をDIへ委譲する。
 * @failure N/A: runDockerIsolationProbeは独自の失敗分岐を所有しない。
 * @invariant runDockerIsolationProbeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 私有Operation相関・回復保存とDIの固定Probe技術処置。
 * @security runDockerIsolationProbeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDockerIsolationProbeは共有非同期状態を持たない同期処理である。
 */
export function runDockerIsolationProbe(owned: unknown): DockerProbeResult {
  return runDockerIsolationScenario(owned, null);
}

/**
 * Dynamic Fake Provider 失敗 Scenarioを実行する。
 *
 * @responsibility Dynamic Fake Provider 失敗 Scenarioの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown、scenario: DynamicFakeProviderFailureScenario
 * @returns DockerProbeResultを返す。
 * @precondition 「owned: unknown、scenario: DynamicFakeProviderFailureScenario」がrunDynamicFakeProviderFailureScenarioの入力契約を満たす。
 * @postcondition runDynamicFakeProviderFailureScenarioの責務を完了した結果だけを返す。
 * @effect 固定故障Scenarioで本番Probeと同じ回復保存・Host状態・DI技術処置を実行する。
 * @failure N/A: runDynamicFakeProviderFailureScenarioは独自の失敗分岐を所有しない。
 * @invariant runDynamicFakeProviderFailureScenarioは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証専用の固定Scenarioと本番Probeと共有する私有相関Owner。Package Rootへ公開しない。
 * @security runDynamicFakeProviderFailureScenarioはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runDynamicFakeProviderFailureScenarioは共有非同期状態を持たない同期処理である。
 */
export function runDynamicFakeProviderFailureScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario,
): DockerProbeResult {
  return runDockerIsolationScenario(owned, scenario);
}

/**
 * Dynamic Fake Provider Cancellation Verificationを実行する。
 *
 * @responsibility Dynamic Fake Provider Cancellation Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns Promise<DynamicFakeProviderCancellationResult>を返す。
 * @precondition 「owned: unknown」がrunDynamicFakeProviderCancellationVerificationの入力契約を満たす。
 * @postcondition runDynamicFakeProviderCancellationVerificationの責務を完了した結果だけを返す。
 * @effect 上位二保存とHost遷移・清掃を行い、固定Docker技術処置をDIへ委譲する。
 * @failure runDynamicFakeProviderCancellationVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 同じ実ID・回復参照を保持し、下位候補だけで公開verifiedにしない。
 * @boundary 上位保存・Host所有とDI取消事実の受渡し。
 * @security runDynamicFakeProviderCancellationVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runDynamicFakeProviderCancellationVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runDynamicFakeProviderCancellationVerification(
  owned: unknown,
): Promise<DynamicFakeProviderCancellationResult> {
  const probeId = randomUUID();
  const recoveryNonce = randomUUID();
  let cli: ProbeBinding | null = null;
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let mounts: DockerMounts | null = null;
  let containerCapability: Readonly<{ kind: "owned_docker_probe" }> | null =
    null;
  let containerIdentity: ContainerIdentity | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let recoveryId: string | null = null;
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  let hasPostRunMountVerified = false;
  let hasAttachProcessTerminationObserved = false;
  let attachProcessTerminationRequestCount = 0;
  let base = cancellationBlocked(
    "dynamic_fake_provider_cancellation_verification_failed",
  );
  try {
    cli = createDockerProbeRuntimeBinding(() => {
      mountCapability = createOwnedMountCapability(owned);
      mounts = verifyOwnedMountCapability(mountCapability);
      return mounts.management;
    });
    if (!observeDockerProbeEngine(cli))
      throw new Error("docker_backend_platform_unsupported");
    mounts = verifyOwnedMountCapability(mountCapability);
    hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
    hasSubmissionStarted = true;
    try {
      recoveryId = writeDockerProbeRecoveryRecord(
        mounts,
        probeId,
        recoveryNonce,
        hostRecoveryId,
        null,
      );
    } catch (error) {
      try {
        hostRecoveryId = cancelDockerSubmissionBeforeCreate(
          hostRecoveryId,
          mountCapability,
        );
        hasSubmissionStarted = false;
      } catch {
        hasSubmissionStarted = true;
      }
      throw error;
    }
    hasContainerCreateAttempted = true;
    const creationCli = cli;
    const normalizedCreation = createDockerProbeContainer(
      creationCli,
      "cancellation",
      probeId,
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    );
    if (normalizedCreation.status !== "confirmed")
      throw new Error("docker_container_identity_unknown");
    containerIdentity = Object.freeze({
      id: normalizedCreation.id,
      probeId,
      profile: "cancellation",
    });
    containerCapability = Object.freeze({ kind: "owned_docker_probe" });
    containerIdentities.set(containerCapability, containerIdentity);
    recoveryId = writeDockerProbeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      containerIdentity.id,
    );
    const executionCli = cli;
    const executionMountCapability = mountCapability;
    const facts = await runDockerProbeCancellation(
      executionCli,
      { id: containerIdentity.id, probeId },
      () => {
        mounts = verifyOwnedMountCapability(executionMountCapability);
        return {
          workspace: mounts.workspace,
          providerHome: mounts.providerHome,
          tmp: mounts.tmp,
        };
      },
    );
    base = Object.freeze({
      ...base,
      ...facts.observation,
      status: facts.status,
      reason: facts.reason,
    });
    hasPostRunMountVerified = facts.postRunMountVerified;
    hasAttachProcessTerminationObserved =
      facts.attachProcessTerminationObserved;
    attachProcessTerminationRequestCount =
      facts.attachProcessTerminationRequestCount;
  } catch (error) {
    base = Object.freeze({
      ...base,
      status: "blocked",
      reason: normalizeCancellationFailure(error),
    });
  } finally {
    if (containerCapability && containerIdentity && cli && mounts) {
      try {
        const cleanup = cleanupOwnedContainer(
          cli,
          containerCapability,
          mounts,
          hostRecoveryId,
        );
        if (!cleanup.confirmed)
          base = Object.freeze({
            ...base,
            status: "blocked",
            reason: cleanup.reason,
            retainOperationDirectories: true,
            recoveryId,
            manualRecoveryRequired: true,
            cleanup: "unconfirmed",
          });
        else {
          const absence = confirmDockerAbsence(
            hostRecoveryId,
            mountCapability,
            cleanup.absenceCapability,
            {
              probeId,
              id: containerIdentity.id,
              rootName: path.basename(path.dirname(mounts.management)),
              cli,
              root: path.dirname(mounts.management),
            },
          );
          hostRecoveryId = absence.hostRecoveryId;
          const recovered = recoverOwnedOperationDirectories(
            hostRecoveryId,
            null,
            path.dirname(mounts.management),
          );
          const isHostCleanupVerified = recovered.status === "recovered";
          const isVerified =
            base.status === "candidate" &&
            hasPostRunMountVerified &&
            hasAttachProcessTerminationObserved &&
            isHostCleanupVerified;
          base = Object.freeze({
            ...base,
            status: isVerified ? "verified" : "blocked",
            reason: isVerified
              ? "dynamic_fake_provider_cancellation_verified"
              : isHostCleanupVerified
                ? base.reason
                : recovered.reason,
            containerAbsenceVerified: true,
            attachProcessTerminationObserved:
              hasAttachProcessTerminationObserved,
            hostCleanupVerified: isHostCleanupVerified,
            retainOperationDirectories: !isHostCleanupVerified,
            recoveryId: isHostCleanupVerified ? null : hostRecoveryId,
            manualRecoveryRequired: !isHostCleanupVerified,
            cleanup: isHostCleanupVerified ? "confirmed" : "unconfirmed",
          });
        }
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "docker_probe_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else if (!hasSubmissionStarted) {
      try {
        cleanupOwnedOperationDirectories(owned);
        base = Object.freeze({
          ...base,
          hostCleanupVerified: true,
          cleanup: "confirmed",
        });
      } catch {
        base = Object.freeze({
          ...base,
          status: "blocked",
          reason: "host_operation_cleanup_failed",
          retainOperationDirectories: true,
          recoveryId: hostRecoveryId,
          manualRecoveryRequired: true,
          cleanup: "unconfirmed",
        });
      }
    } else {
      base = Object.freeze({
        ...base,
        status: "blocked",
        retainOperationDirectories: true,
        recoveryId,
        manualRecoveryRequired: true,
        cleanup: "unconfirmed",
      });
    }
  }
  return Object.freeze({
    ...base,
    attachProcessTerminationObserved: hasAttachProcessTerminationObserved,
    attachProcessTerminationRequestCount,
    diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
    diagnosticFilesystemEffectIssued: true,
  });
}

/**
 * 回復E2E用に同じ実IDへ結合した稼働残存を一件作成する。
 *
 * @responsibility Dynamic Fake Provider Recoverable Residueの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input owned: unknown
 * @returns DynamicFakeProviderRecoverableResidueResultを返す。
 * @precondition 「owned: unknown」がcreateDynamicFakeProviderRecoverableResidueの入力契約を満たす。
 * @postcondition createDynamicFakeProviderRecoverableResidueの責務を完了した結果だけを返す。
 * @effect 二保存・Host遷移を行い、固定作成・稼働確認をDIへ委譲する。成功時は意図的に回収しない。
 * @failure createDynamicFakeProviderRecoverableResidueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 作成不明・保存失敗・稼働不明をreadyへ昇格しない。
 * @boundary 上位保存・Host所有とDIの固定稼働残存。
 * @security createDynamicFakeProviderRecoverableResidueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDynamicFakeProviderRecoverableResidueは共有非同期状態を持たない同期処理である。
 */
export function createDynamicFakeProviderRecoverableResidue(
  owned: unknown,
): DynamicFakeProviderRecoverableResidueResult {
  const probeId = randomUUID();
  const recoveryNonce = randomUUID();
  let recoveryId: string | null = null;
  let hostRecoveryId = getOwnedHostRecoveryId(owned);
  let mountCapability: Readonly<{ kind: "owned_operation_mounts" }> | null =
    null;
  let hasSubmissionStarted = false;
  let hasContainerCreateAttempted = false;
  try {
    let mounts: DockerMounts;
    const cli = createDockerProbeRuntimeBinding(() => {
      mountCapability = createOwnedMountCapability(owned);
      mounts = verifyOwnedMountCapability(mountCapability);
      return mounts.management;
    });
    if (!observeDockerProbeEngine(cli))
      throw new Error("docker_backend_platform_unsupported");
    mounts = verifyOwnedMountCapability(mountCapability);
    hostRecoveryId = beginDockerSubmission(hostRecoveryId, mountCapability);
    hasSubmissionStarted = true;
    recoveryId = writeDockerProbeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      null,
    );
    hasContainerCreateAttempted = true;
    const normalizedCreation = createDockerProbeContainer(
      cli,
      "cancellation",
      probeId,
      {
        workspace: mounts.workspace,
        providerHome: mounts.providerHome,
        tmp: mounts.tmp,
      },
    );
    if (normalizedCreation.status !== "confirmed")
      throw new Error("docker_container_identity_unknown");
    const identity = Object.freeze({
      id: normalizedCreation.id,
      probeId,
      profile: "cancellation",
    });
    const containerCapability = Object.freeze({ kind: "owned_docker_probe" });
    containerIdentities.set(containerCapability, identity);
    recoveryId = writeDockerProbeRecoveryRecord(
      mounts,
      probeId,
      recoveryNonce,
      hostRecoveryId,
      identity.id,
    );
    startDockerProbeResidue(cli, { id: identity.id, probeId }, () => {
      const current = verifyOwnedMountCapability(mountCapability);
      return {
        workspace: current.workspace,
        providerHome: current.providerHome,
        tmp: current.tmp,
      };
    });
    return Object.freeze({
      status: "ready" as const,
      reason: "dynamic_fake_provider_recoverable_residue_ready",
      recoveryId,
      manualRecoveryRequired: true,
      containerRunning: true,
      diagnosticDockerContainerEffectIssued: true,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false as const,
      runtimeAuthorityIssued: false as const,
      operationCapabilityIssued: false as const,
      realProviderReadiness: false as const,
    });
  } catch (error) {
    if (!hasSubmissionStarted) {
      try {
        cleanupOwnedOperationDirectories(owned);
      } catch {
        // The blocked result remains recovery-authoritative.
      }
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: normalizeFailure(
        error,
        "dynamic_fake_provider_recoverable_residue_failed",
      ),
      recoveryId,
      manualRecoveryRequired: recoveryId !== null || hasSubmissionStarted,
      containerRunning: false,
      diagnosticDockerContainerEffectIssued: hasContainerCreateAttempted,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false as const,
      runtimeAuthorityIssued: false as const,
      operationCapabilityIssued: false as const,
      realProviderReadiness: false as const,
    });
  }
}

/**
 * expected Dynamic Fake Provider 失敗 Reasonを決定する。
 *
 * @responsibility expected Dynamic Fake Provider 失敗 Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input scenario: DynamicFakeProviderFailureScenario
 * @returns stringを返す。
 * @precondition 「scenario: DynamicFakeProviderFailureScenario」がexpectedDynamicFakeProviderFailureReasonの入力契約を満たす。
 * @postcondition expectedDynamicFakeProviderFailureReasonの責務を完了した結果だけを返す。
 * @effect N/A: expectedDynamicFakeProviderFailureReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: expectedDynamicFakeProviderFailureReasonは独自の失敗分岐を所有しない。
 * @invariant expectedDynamicFakeProviderFailureReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: expectedDynamicFakeProviderFailureReasonはProcess内の同一Subsystemで完結する。
 * @security expectedDynamicFakeProviderFailureReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: expectedDynamicFakeProviderFailureReasonは共有非同期状態を持たない同期処理である。
 */
export function expectedDynamicFakeProviderFailureReason(
  scenario: DynamicFakeProviderFailureScenario,
): string {
  return FAILURE_SCENARIO_SPECS[scenario].expectedReason;
}

/**
 * Docker診断の回復を同じHost世代の排他内で処置する。
 *
 * @responsibility 対象を読む前の世代排他、回復記録の現在確認、Docker資源確認、Host清掃と解放を順序付ける。
 * @trace ARCH-000008
 * @input 元のexactなDocker診断回復Token。
 * @returns recoveredまたはblocked。未解決時は現在のexact参照を保持する。
 * @precondition 元Tokenを提示し、既存生成入口のUUID由来Rootと同じ世代へ結合する。Schema・Hash・対象実体は取得後に確認する。
 * @postcondition 成功はHost清掃と取得した排他の解放がともに成立した場合だけ返す。
 * @effect 回復記録の読取り、既存Host排他の取得・解放、必要なDocker回収とHost清掃。
 * @failure 不正なRoot世代、未取得、Host結合差、下位失敗、解放未確認では停止し、成功へ畳まない。
 * @invariant Root由来Host nonceをProbe nonceと混同せず、取得後の記録と照合した同じ排他をHost清掃へ渡す。
 * @boundary 公開診断回復から既存Host世代・Docker・Filesystemへの境界。
 * @security Tokenを新設せず、元Task再実行、Provider依頼、Docker再起動を行わない。
 * @concurrency 既存Host／Docker Task回復と同じ対象排他をRoot初回読取り前から清掃終了まで保持する。
 */
export function recoverDockerIsolationProbe(
  token: unknown,
  expectedRoot: unknown,
) {
  let activeRecoveryId = token;
  let generation: object | null = null;
  const result = (() => {
    try {
      const selected = parseDockerProbeRecoveryToken(token);
      const hostNonce = selected.rootName.slice(
        "crdd-coordinator-doctor-".length,
      );
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(
          hostNonce,
        )
      )
        throw new Error("docker_recovery_host_generation_mismatch");
      if (
        typeof expectedRoot !== "string" ||
        !path.isAbsolute(expectedRoot) ||
        path.resolve(expectedRoot) !== expectedRoot ||
        path.basename(expectedRoot) !== selected.rootName
      )
        throw new Error("docker_recovery_boundary_failed");
      const parent = path.dirname(expectedRoot);
      if (fs.realpathSync(parent) !== parent)
        throw new Error("docker_recovery_boundary_failed");
      generation = acquireHostOperationRecoveryGenerationByIdentity(
        path.join(parent, selected.rootName),
        hostNonce,
      );
      if (!generation)
        return {
          status: "blocked",
          reason: "docker_recovery_host_generation_active_or_unknown",
          recoveryId: activeRecoveryId,
          hostCleanupCompleted: false,
        };
      const recovery = loadDockerProbeRecoveryRecord(token, expectedRoot);
      const host = parseHostRecoveryToken(recovery.record.hostRecoveryId);
      if (
        host.rootName !== selected.rootName ||
        host.rootName !== recovery.parsed.rootName ||
        host.nonce !== hostNonce
      )
        throw new Error("docker_recovery_host_generation_mismatch");
      const cli = createDockerProbeRuntimeBinding(
        () => recovery.children.management,
      );
      const containerId = recovery.record.container.id;
      if (!containerId) {
        return {
          status: "blocked",
          reason: "docker_recovery_container_identity_unknown",
          recoveryId: token,
        };
      }
      const identity: ContainerIdentity = {
        id: containerId,
        probeId: recovery.record.probeId,
        profile: "legacy_recovery",
      };
      let absenceCapability = null;
      if (identity.id) {
        absenceCapability = observeContainerAbsence(
          cli,
          identity,
          recovery.record.hostRecoveryId,
          recovery.record.rootName,
        );
        if (!absenceCapability) {
          const mounts = requireDockerProbeRecoveryMounts(recovery);
          const capability = Object.freeze({ kind: "recovered_docker_probe" });
          containerIdentities.set(capability, Object.freeze(identity));
          const inspect = inspectOwnedContainer(cli, capability, mounts);
          if (!inspect)
            return {
              status: "blocked",
              reason: "docker_recovery_container_mismatch",
              recoveryId: token,
            };
          const cleanup = cleanupOwnedContainer(
            cli,
            capability,
            mounts,
            recovery.record.hostRecoveryId,
          );
          if (!cleanup.confirmed)
            return {
              status: "blocked",
              reason: cleanup.reason,
              recoveryId: token,
            };
          absenceCapability = cleanup.absenceCapability;
        }
      }
      const absence = confirmDockerAbsence(
        recovery.record.hostRecoveryId,
        null,
        absenceCapability,
        {
          probeId: identity.probeId,
          id: identity.id,
          rootName: recovery.record.rootName,
          cli,
          root: recovery.root,
        },
      );
      activeRecoveryId = absence.hostRecoveryId;
      const recovered = recoverOwnedOperationDirectories(
        absence.hostRecoveryId,
        generation,
      );
      const normalized = normalizeHostCleanupResult(
        recovered,
        absence.hostRecoveryId,
        {
          status: "recovered",
          reason: "docker_probe_recovery_completed",
        },
      );
      return normalized.hostCleanupCompleted
        ? normalized
        : { ...normalized, status: "blocked" };
    } catch (error) {
      return {
        status: "blocked",
        reason: normalizeFailure(error, "docker_probe_recovery_failed"),
        recoveryId: activeRecoveryId,
        hostCleanupCompleted: false,
      };
    }
  })();
  if (generation && !releaseHostOperationRecoveryGeneration(generation))
    return {
      ...result,
      status: "blocked",
      reason: "docker_recovery_host_generation_release_unconfirmed",
      recoveryId: activeRecoveryId,
      hostCleanupCompleted: false,
      cleanup: "unconfirmed",
      retainOperationDirectories: true,
      manualRecoveryRequired: true,
    };
  return result;
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  ...describeDockerProbeResource("profile").runtimeProfile,
  dynamicFakeProviderProcessImplemented: true,
  realProviderProcessesExecuted: false,
});

export const PROVIDER_LIFECYCLE_CONTRACT =
  "crdd-coordinator/provider-lifecycle";

export const PROVIDER_LIFECYCLE_CONTRACT_REVISION = 6;

const PROVIDERS = Object.freeze(["codex", "claude"] as const);

const MODES = Object.freeze(["login", "run"] as const);

const FAKE_STATES = Object.freeze([
  "prepared",
  "submission_started",
  "created",
  "inspect_verified",
  "started",
  "exited_or_terminated",
  "absence_confirmed",
  "cleanup_confirmed",
]);

const PLAN_KEYS = new Set(["provider", "mode"]);

const billingPolicy = describeProviderBillingPolicy();

const providerLifecycleOBSERVATION_KEYS = new Set([
  "contract",
  "contractRevision",
  "provider",
  "mode",
  "states",
  "stdinBytes",
  "elapsedMs",
  "cancellationElapsedMs",
  "stdoutBytes",
  "stderrBytes",
  "exitCode",
  "signal",
  "timedOut",
  "cancellationRequested",
  "processTreeTerminated",
  "containerAbsent",
  "resultCount",
  "resultFormat",
  "quotaState",
]);

export const PROVIDER_LIFECYCLE_LIMITS = Object.freeze({
  deadlineMs: 300_000,
  cancellationGraceMs: 5_000,
  stdinBytes: 1_048_576,
  stdoutBytes: 1_048_576,
  stderrBytes: 262_144,
  resultCount: 1,
});

/**
 * Memberかを判定する。
 *
 * @responsibility Memberの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input values: T、value: unknown
 * @returns value is T[number]を返す。
 * @precondition 「values: T、value: unknown」がisMemberの入力契約を満たす。
 * @postcondition isMemberの責務を完了した結果だけを返す。
 * @effect N/A: isMemberは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isMemberは独自の失敗分岐を所有しない。
 * @invariant isMemberは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isMemberはProcess内の同一Subsystemで完結する。
 * @security isMemberはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isMemberは共有非同期状態を持たない同期処理である。
 */
function isMember<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.some((item) => item === value);
}

/**
 * Bounded Integerかを判定する。
 *
 * @responsibility Bounded Integerの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum: number
 * @returns value is numberを返す。
 * @precondition 「value: unknown、maximum: number」がisBoundedIntegerの入力契約を満たす。
 * @postcondition isBoundedIntegerの責務を完了した結果だけを返す。
 * @effect N/A: isBoundedIntegerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isBoundedIntegerは独自の失敗分岐を所有しない。
 * @invariant isBoundedIntegerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isBoundedIntegerはProcess内の同一Subsystemで完結する。
 * @security isBoundedIntegerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isBoundedIntegerは共有非同期状態を持たない同期処理である。
 */
function isBoundedInteger(value: unknown, maximum: number): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= maximum
  );
}

/**
 * provider-lifecycleを停止結果として構築する。
 *
 * @responsibility provider-lifecycleの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect blockedは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function providerLifecycleBlocked(reason: string) {
  return Object.freeze({
    status: "blocked",
    reason,
    spawnAllowed: false,
    operationCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    observationAuthority: false,
    fakeProviderExecuted: false,
    processAbsenceVerified: false,
    resultNormalizationVerified: false,
    providerHomeMountGrantIssued: false,
    billingPolicy: billingPolicy,
  });
}

/**
 * plan Provider Lifecycleを決定する。
 *
 * @responsibility plan Provider Lifecycleの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns planProviderLifecycleの計算結果を返す。
 * @precondition 「candidate: unknown」がplanProviderLifecycleの入力契約を満たす。
 * @postcondition planProviderLifecycleの責務を完了した結果だけを返す。
 * @effect N/A: planProviderLifecycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: planProviderLifecycleは独自の失敗分岐を所有しない。
 * @invariant planProviderLifecycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: planProviderLifecycleはProcess内の同一Subsystemで完結する。
 * @security planProviderLifecycleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: planProviderLifecycleは共有非同期状態を持たない同期処理である。
 */
export function planProviderLifecycle(candidate: unknown) {
  const value = snapshotPlainRecord(candidate, PLAN_KEYS);
  if (!value)
    return providerLifecycleBlocked("provider_lifecycle_plan_shape_invalid");
  if (!isMember(PROVIDERS, value.provider))
    return providerLifecycleBlocked(
      "provider_lifecycle_provider_not_supported",
    );
  if (!isMember(MODES, value.mode))
    return providerLifecycleBlocked("provider_lifecycle_mode_not_supported");

  const authPolicy = AUTH_POLICIES[value.provider];
  return Object.freeze({
    ...providerLifecycleBlocked(
      value.mode === "login"
        ? "provider_explicit_login_effect_not_implemented"
        : "provider_home_protection_egress_auth_and_fixed_image_binding_not_implemented",
    ),
    provider: value.provider,
    mode: value.mode,
    authPolicy,
    fixedImageRequired: true,
    fixedImageConfigured: false,
    autoUpdateAllowed: false,
    hostCredentialImportAllowed: false,
    apiKeyAllowed: false,
    additionalCreditPurchaseAllowed: false,
    billingPolicy: billingPolicy,
    shellAllowed: false,
    pathLookupAllowed: false,
  });
}

/**
 * synthetic Fake Observation Internalを決定する。
 *
 * @responsibility synthetic Fake Observation Internalの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns syntheticFakeObservationInternalの計算結果を返す。
 * @precondition 「candidate: unknown」がsyntheticFakeObservationInternalの入力契約を満たす。
 * @postcondition syntheticFakeObservationInternalの責務を完了した結果だけを返す。
 * @effect syntheticFakeObservationInternalは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: syntheticFakeObservationInternalは独自の失敗分岐を所有しない。
 * @invariant syntheticFakeObservationInternalは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security syntheticFakeObservationInternalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: syntheticFakeObservationInternalは共有非同期状態を持たない同期処理である。
 */
function syntheticFakeObservationInternal(candidate: unknown) {
  const value = snapshotPlainRecord(
    candidate,
    providerLifecycleOBSERVATION_KEYS,
  );
  if (!value)
    return providerLifecycleBlocked(
      "provider_lifecycle_observation_shape_invalid",
    );
  if (
    value.contract !== PROVIDER_LIFECYCLE_CONTRACT ||
    value.contractRevision !== PROVIDER_LIFECYCLE_CONTRACT_REVISION ||
    value.provider !== "fake" ||
    value.mode !== "run"
  ) {
    return providerLifecycleBlocked(
      "provider_lifecycle_observation_contract_mismatch",
    );
  }
  const states = snapshotPlainArray<string>(value.states, FAKE_STATES.length);
  if (
    states.status !== "ok" ||
    states.value.length !== FAKE_STATES.length ||
    states.value.some((state, index) => state !== FAKE_STATES[index])
  ) {
    return providerLifecycleBlocked(
      "provider_lifecycle_state_sequence_invalid",
    );
  }
  if (
    !isBoundedInteger(
      value.stdinBytes,
      PROVIDER_LIFECYCLE_LIMITS.stdinBytes * 2,
    ) ||
    !isBoundedInteger(
      value.elapsedMs,
      PROVIDER_LIFECYCLE_LIMITS.deadlineMs * 2,
    ) ||
    !isBoundedInteger(
      value.stdoutBytes,
      PROVIDER_LIFECYCLE_LIMITS.stdoutBytes * 2,
    ) ||
    !isBoundedInteger(
      value.stderrBytes,
      PROVIDER_LIFECYCLE_LIMITS.stderrBytes * 2,
    ) ||
    !isBoundedInteger(value.resultCount, 2) ||
    (value.exitCode !== null && !isBoundedInteger(value.exitCode, 255)) ||
    (value.signal !== null && typeof value.signal !== "string") ||
    typeof value.timedOut !== "boolean" ||
    typeof value.cancellationRequested !== "boolean" ||
    typeof value.processTreeTerminated !== "boolean" ||
    typeof value.containerAbsent !== "boolean" ||
    typeof value.resultFormat !== "string" ||
    typeof value.quotaState !== "string"
  ) {
    return providerLifecycleBlocked(
      "provider_lifecycle_observation_value_invalid",
    );
  }
  if (
    (value.cancellationRequested === false &&
      value.cancellationElapsedMs !== null) ||
    (value.cancellationRequested === true &&
      !isBoundedInteger(
        value.cancellationElapsedMs,
        PROVIDER_LIFECYCLE_LIMITS.cancellationGraceMs * 2,
      ))
  ) {
    return providerLifecycleBlocked(
      "provider_cancellation_observation_inconsistent",
    );
  }
  if (!value.processTreeTerminated || !value.containerAbsent)
    return providerLifecycleBlocked("provider_process_absence_unconfirmed");
  if (value.stdinBytes > PROVIDER_LIFECYCLE_LIMITS.stdinBytes)
    return providerLifecycleBlocked("provider_stdin_limit_exceeded");
  if (value.stdoutBytes > PROVIDER_LIFECYCLE_LIMITS.stdoutBytes)
    return providerLifecycleBlocked("provider_stdout_limit_exceeded");
  if (value.stderrBytes > PROVIDER_LIFECYCLE_LIMITS.stderrBytes)
    return providerLifecycleBlocked("provider_stderr_limit_exceeded");
  if (value.timedOut || value.elapsedMs > PROVIDER_LIFECYCLE_LIMITS.deadlineMs)
    return providerLifecycleBlocked("provider_deadline_exceeded");
  if (value.cancellationRequested)
    return providerLifecycleBlocked(
      (value.cancellationElapsedMs as number) >
        PROVIDER_LIFECYCLE_LIMITS.cancellationGraceMs
        ? "provider_cancellation_grace_exceeded"
        : "provider_operation_cancelled",
    );
  if (value.quotaState === "exhausted")
    return providerLifecycleBlocked("provider_subscription_quota_exhausted");
  if (value.quotaState !== "available")
    return providerLifecycleBlocked(
      "provider_subscription_quota_state_unknown",
    );
  if (value.signal !== null)
    return providerLifecycleBlocked("provider_process_signalled");
  if (value.exitCode !== 0)
    return providerLifecycleBlocked("provider_process_exit_nonzero");
  if (
    value.resultCount !== PROVIDER_LIFECYCLE_LIMITS.resultCount ||
    value.resultFormat !== "exact_json_object"
  ) {
    return providerLifecycleBlocked("provider_result_invalid");
  }
  return Object.freeze({
    status: "candidate",
    reason: "synthetic_fake_observation_non_authoritative",
    spawnAllowed: false,
    syntheticFakeObservationOnly: true,
    observationAuthority: false,
    fakeProviderExecuted: false,
    processAbsenceVerified: false,
    resultNormalizationVerified: false,
    providerHomeMountGrantIssued: false,
    operationCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processTreeTerminationClaimed: true,
    containerAbsenceClaimed: true,
  });
}

/**
 * Synthetic Fake Provider Observation 候補を評価する。
 *
 * @responsibility Synthetic Fake Provider Observation 候補の評価入力、判定規則、判断不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns evaluateSyntheticFakeProviderObservationCandidateの計算結果を返す。
 * @precondition 「candidate: unknown」がevaluateSyntheticFakeProviderObservationCandidateの入力契約を満たす。
 * @postcondition evaluateSyntheticFakeProviderObservationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: evaluateSyntheticFakeProviderObservationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: evaluateSyntheticFakeProviderObservationCandidateは独自の失敗分岐を所有しない。
 * @invariant evaluateSyntheticFakeProviderObservationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: evaluateSyntheticFakeProviderObservationCandidateはProcess内の同一Subsystemで完結する。
 * @security evaluateSyntheticFakeProviderObservationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: evaluateSyntheticFakeProviderObservationCandidateは共有非同期状態を持たない同期処理である。
 */
export function evaluateSyntheticFakeProviderObservationCandidate(
  candidate: unknown,
) {
  return syntheticFakeObservationInternal(candidate);
}

/**
 * Provider Lifecycle 契約の公開契約を記述する。
 *
 * @responsibility Provider Lifecycle 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProviderLifecycleContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProviderLifecycleContractの入力契約を満たす。
 * @postcondition describeProviderLifecycleContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProviderLifecycleContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProviderLifecycleContractは独自の失敗分岐を所有しない。
 * @invariant describeProviderLifecycleContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProviderLifecycleContractはProcess内の同一Subsystemで完結する。
 * @security describeProviderLifecycleContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProviderLifecycleContractは共有非同期状態を持たない同期処理である。
 */
export function describeProviderLifecycleContract() {
  return Object.freeze({
    contract: PROVIDER_LIFECYCLE_CONTRACT,
    contractRevision: PROVIDER_LIFECYCLE_CONTRACT_REVISION,
    implementationState:
      "synthetic_candidate_and_repository_owned_docker_fake_observation",
    providers: PROVIDERS,
    modes: MODES,
    authPolicies: AUTH_POLICIES,
    authenticationPolicyState: "approved_policy_only",
    dedicatedProviderHome: describeProviderHomeContract(),
    providerHomeMountGrant: describeProviderHomeMountGrantContract(),
    limits: PROVIDER_LIFECYCLE_LIMITS,
    fixedDigestImageRequired: true,
    fixedDigestImageConfigured: false,
    providerAutoUpdateAllowed: false,
    providerSessionResumeAllowed: false,
    telemetryDecision: "not_implemented",
    realProviderSpawn: "blocked_before_spawn",
    realProviderEgress: "not_implemented",
    apiKeyAllowed: false,
    additionalCreditPurchaseAllowed: false,
    billingPolicy: billingPolicy,
    rawAuthOutputRecorded: false,
    oauthTokenReadByRuntime: false,
    syntheticFakeObservationState: "candidate_non_authoritative",
    dynamicFakeProviderObservation: Object.freeze({
      implementationState: "implemented_for_doctor_isolation_success_probe",
      provenance: "repository_owned_docker_fake_provider",
      normalExecution: "implemented_candidate",
      exactResultNormalization: "implemented_candidate",
      containerAndProcessTreeAbsence:
        "implemented_candidate_after_owned_cleanup",
      timeoutAndOutputLimitClassification: "implemented",
      inFlightCancellation: "not_implemented",
      actualFailureScenarioVerification: "not_verified",
      diagnosticDockerContainerEffectIssued: true,
      diagnosticFilesystemEffectIssued: true,
      providerNetworkEffectIssued: false,
      runtimeAuthorityIssued: false,
      operationCapabilityIssued: false,
      realProviderReadiness: false,
    }),
    fakeProviderExecution: "implemented_for_doctor_isolation_success_probe",
    fakeProviderConfersRealProviderReadiness: false,
    operationCapabilityIssued: false,
  });
}

export const COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT =
  "crdd-coordinator/node-runtime-version";

export const COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT_REVISION = 1;

export const MINIMUM_COORDINATOR_NODE_VERSION = "24.12.0";

const MINIMUM = Object.freeze({ major: 24, minor: 12, patch: 0 });

/**
 * Supported Coordinator Node Runtimeかを判定する。
 *
 * @responsibility Supported Coordinator Node Runtimeの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns isSupportedCoordinatorNodeRuntimeの計算結果を返す。
 * @precondition 「value: unknown」がisSupportedCoordinatorNodeRuntimeの入力契約を満たす。
 * @postcondition isSupportedCoordinatorNodeRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedCoordinatorNodeRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedCoordinatorNodeRuntimeは独自の失敗分岐を所有しない。
 * @invariant isSupportedCoordinatorNodeRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedCoordinatorNodeRuntimeはProcess内の同一Subsystemで完結する。
 * @security N/A: isSupportedCoordinatorNodeRuntimeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSupportedCoordinatorNodeRuntimeは共有非同期状態を持たない同期処理である。
 */
export function isSupportedCoordinatorNodeRuntime(value: unknown) {
  if (typeof value !== "string") return false;
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.exec(value);
  if (!match) return false;
  const [major, minor, patch] = match
    .slice(1)
    .map((part) => Number.parseInt(part ?? "", 10));
  if (![major, minor, patch].every(Number.isSafeInteger)) return false;
  return (
    (major ?? -1) > MINIMUM.major ||
    ((major ?? -1) === MINIMUM.major &&
      ((minor ?? -1) > MINIMUM.minor ||
        ((minor ?? -1) === MINIMUM.minor && (patch ?? -1) >= MINIMUM.patch)))
  );
}

/**
 * Supported Coordinator Node Runtimeを表明どおりか検査する。
 *
 * @responsibility Supported Coordinator Node Runtimeの必須条件と違反時の停止境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns N/A: assertSupportedCoordinatorNodeRuntimeは戻り値を返さない。
 * @precondition 「value: unknown」がassertSupportedCoordinatorNodeRuntimeの入力契約を満たす。
 * @postcondition assertSupportedCoordinatorNodeRuntimeの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: assertSupportedCoordinatorNodeRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure assertSupportedCoordinatorNodeRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant assertSupportedCoordinatorNodeRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: assertSupportedCoordinatorNodeRuntimeはProcess内の同一Subsystemで完結する。
 * @security N/A: assertSupportedCoordinatorNodeRuntimeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: assertSupportedCoordinatorNodeRuntimeは共有非同期状態を持たない同期処理である。
 */
export function assertSupportedCoordinatorNodeRuntime(value: unknown) {
  if (!isSupportedCoordinatorNodeRuntime(value)) {
    throw new Error("coordinator_node_version_unsupported");
  }
}

/**
 * Coordinator Node Runtime Version 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Node Runtime Version 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorNodeRuntimeVersionContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorNodeRuntimeVersionContractの入力契約を満たす。
 * @postcondition describeCoordinatorNodeRuntimeVersionContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorNodeRuntimeVersionContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorNodeRuntimeVersionContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorNodeRuntimeVersionContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorNodeRuntimeVersionContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCoordinatorNodeRuntimeVersionContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCoordinatorNodeRuntimeVersionContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorNodeRuntimeVersionContract() {
  return Object.freeze({
    contract: COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT,
    contractRevision: COORDINATOR_NODE_RUNTIME_VERSION_CONTRACT_REVISION,
    minimumVersion: MINIMUM_COORDINATOR_NODE_VERSION,
    checkTiming: "before_interactive_input_release_verification_or_effect",
    pathLookupAuthority: false,
    unsupportedRuntimeFallbackAllowed: false,
  });
}

export const COORDINATOR_RECOVERY_LIFECYCLE_PREFIX =
  "[Coordinator recovery] " as const;

export const COORDINATOR_EXECUTION_INTELLIGENCE_PREFIX =
  "[Coordinator execution intelligence] " as const;

const COORDINATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS = 5_000;

/**
 * 回復診断の書込み終端を表す値契約を定義する。
 *
 * @responsibility Coordinator 回復 Diagnostic OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorRecoveryDiagnosticOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorRecoveryDiagnosticOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorRecoveryDiagnosticOutcomeの宣言は外部境界を開かない。
 * @security N/A: CoordinatorRecoveryDiagnosticOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorRecoveryDiagnosticOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorRecoveryDiagnosticOutcome =
  | "success"
  | "callback_error"
  | "stream_error"
  | "stream_close"
  | "timeout"
  | "unavailable"
  | "throw";

/**
 * Coordinator Internal Diagnostic Reporterを構築する。
 *
 * @responsibility Coordinator Internal Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>
 * @returns createCoordinatorInternalDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>」がcreateCoordinatorInternalDiagnosticReporterの入力契約を満たす。
 * @postcondition createCoordinatorInternalDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect 構築時は診断値を書かず、返却Reporterが呼ばれた時だけ指定Writableへ直列書込みする。
 * @failure createCoordinatorInternalDiagnosticReporterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCoordinatorInternalDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 返却Reporterが内部診断値→指定Writableの出力境界を所有する。
 * @security N/A: createCoordinatorInternalDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 返却Reporterはcallback・error・close・timeoutを一度の終端へ収束させ、失敗後の追加書込みを止める。
 */
function createCoordinatorInternalDiagnosticReporter(
  stream: Writable,
  input: Readonly<{
    prefix: string;
    event: string;
    timeoutMs: number;
  }>,
) {
  let isUnavailable = !stream.writable || stream.destroyed;
  let isDisposed = false;
  let pending:
    | ((outcome: CoordinatorRecoveryDiagnosticOutcome) => void)
    | null = null;
  let tail = Promise.resolve();
  const onError = () => {
    isUnavailable = true;
    pending?.("stream_error");
  };
  const onClose = () => {
    isUnavailable = true;
    pending?.("stream_close");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  stream.on("error", onError);
  stream.on("close", onClose);

  const writeOne = (event: object) =>
    new Promise<CoordinatorRecoveryDiagnosticOutcome>((resolve) => {
      if (isDisposed || isUnavailable || !stream.writable || stream.destroyed) {
        resolve("unavailable");
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (
        outcome: CoordinatorRecoveryDiagnosticOutcome,
        isDisable = false,
      ) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        if (isDisable) isUnavailable = true;
        resolve(outcome);
      };
      pending = (outcome) => settle(outcome, true);
      timer = setTimeout(() => settle("timeout", true), input.timeoutMs);
      try {
        stream.write(
          `${input.prefix}${JSON.stringify({
            ...event,
            event: input.event,
          })}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle("success");
            else settle("callback_error", true);
          },
        );
      } catch {
        settle("throw", true);
      }
    });

  const report = (event: object) => {
    const result = tail.then(() => writeOne(event));
    tail = result.then(() => undefined);
    return result;
  };
  const dispose = () => {
    if (isDisposed) return;
    isDisposed = true;
    isUnavailable = true;
    pending?.("unavailable");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  return Object.freeze({ report, dispose });
}

/**
 * Coordinator 回復 Diagnostic Reporterを構築する。
 *
 * @responsibility Coordinator 回復 Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createCoordinatorRecoveryDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateCoordinatorRecoveryDiagnosticReporterの入力契約を満たす。
 * @postcondition createCoordinatorRecoveryDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect 構築時は診断値を書かず、返却Reporterが呼ばれた時だけ指定Writableへ直列書込みする。
 * @failure N/A: createCoordinatorRecoveryDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorRecoveryDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 返却Reporterが内部診断値→指定Writableの出力境界を所有する。
 * @security N/A: createCoordinatorRecoveryDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 返却Reporterはcallback・error・close・timeoutを一度の終端へ収束させ、失敗後の追加書込みを止める。
 */
export function createCoordinatorRecoveryDiagnosticReporter(
  stream: Writable,
  timeoutMs = COORDINATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createCoordinatorInternalDiagnosticReporter(stream, {
    prefix: COORDINATOR_RECOVERY_LIFECYCLE_PREFIX,
    event: "coordinator_recovery_transition",
    timeoutMs,
  });
}

/**
 * Coordinator Execution Intelligence Diagnostic Reporterを構築する。
 *
 * @responsibility Coordinator Execution Intelligence Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createCoordinatorExecutionIntelligenceDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateCoordinatorExecutionIntelligenceDiagnosticReporterの入力契約を満たす。
 * @postcondition createCoordinatorExecutionIntelligenceDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect 構築時は診断値を書かず、返却Reporterが呼ばれた時だけ指定Writableへ直列書込みする。
 * @failure N/A: createCoordinatorExecutionIntelligenceDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorExecutionIntelligenceDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 返却Reporterが内部診断値→指定Writableの出力境界を所有する。
 * @security N/A: createCoordinatorExecutionIntelligenceDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 返却Reporterはcallback・error・close・timeoutを一度の終端へ収束させ、失敗後の追加書込みを止める。
 */
export function createCoordinatorExecutionIntelligenceDiagnosticReporter(
  stream: Writable,
  timeoutMs = COORDINATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createCoordinatorInternalDiagnosticReporter(stream, {
    prefix: COORDINATOR_EXECUTION_INTELLIGENCE_PREFIX,
    event: "coordinator_execution_intelligence_publication",
    timeoutMs,
  });
}

const productionRecoveryDiagnosticReporter =
  createCoordinatorRecoveryDiagnosticReporter(process.stderr);

const productionExecutionIntelligenceDiagnosticReporter =
  createCoordinatorExecutionIntelligenceDiagnosticReporter(process.stderr);

/**
 * Coordinator 回復 Diagnosticを書き込む。
 *
 * @responsibility Coordinator 回復 Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input event: object
 * @returns N/A: writeCoordinatorRecoveryDiagnosticは戻り値を返さない。
 * @precondition 「event: object」がwriteCoordinatorRecoveryDiagnosticの入力契約を満たす。
 * @postcondition writeCoordinatorRecoveryDiagnosticの責務を完了して呼出し元へ制御を戻す。
 * @effect 既存Singleton Reporterへ診断値を渡し、指定Writableへ書き込む。
 * @failure N/A: writeCoordinatorRecoveryDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeCoordinatorRecoveryDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 内部診断値→Singleton Reporter→指定Writableの出力境界へ接続する。
 * @security N/A: writeCoordinatorRecoveryDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency Reporterの非同期完了・失敗を呼出し側へ返し、書込み順序を維持する。
 */
export async function writeCoordinatorRecoveryDiagnostic(event: object) {
  await productionRecoveryDiagnosticReporter.report(event);
}

/**
 * Coordinator Execution Intelligence Diagnosticを書き込む。
 *
 * @responsibility Coordinator Execution Intelligence Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input observation: CoordinatorExecutionPublicationObservation
 * @returns 戻り値なし。書込み完了は呼出し側へ返さない。
 * @precondition 「observation: CoordinatorExecutionPublicationObservation」がwriteCoordinatorExecutionIntelligenceDiagnosticの入力契約を満たす。
 * @postcondition completed観測は出力せず、それ以外をReporterへ委譲して即時復帰する。
 * @effect 既存Singleton Reporterへ診断値を渡し、指定Writableへ書き込む。
 * @failure N/A: writeCoordinatorExecutionIntelligenceDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeCoordinatorExecutionIntelligenceDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 内部診断値→Singleton Reporter→指定Writableの出力境界へ接続する。
 * @security N/A: writeCoordinatorExecutionIntelligenceDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 呼出し側は書込みを待たない。直列化と失敗後停止はReporterが所有する。
 */
export function writeCoordinatorExecutionIntelligenceDiagnostic(
  observation: CoordinatorExecutionPublicationObservation,
) {
  if (observation.status === "completed") return;
  void productionExecutionIntelligenceDiagnosticReporter.report(observation);
}

export const COORDINATOR_PLATFORM_CONTRACT =
  "crdd-coordinator/orchestrator-platform-contract" as const;

export const COORDINATOR_PLATFORM_CONTRACT_REVISION = 1;

/**
 * CoordinatorのIF-PLATFORM境界群。
 * The lock_lease family is declared here because
 * the contract owns the closed family population. The Windows adapter now
 * supplies owner-liveness observation; resolution still fails closed for
 * unsupported families instead of narrowing the population.
 */
export const COORDINATOR_PLATFORM_BOUNDARIES = Object.freeze([
  "principal_provider_home",
  "filesystem_repository",
  "lock_lease",
  "process_cancellation",
  "container_host",
  "runtime_root_recovery",
] as const);

/**
 * platform-contractで使用するCoordinator Platform Boundaryの値契約を定義する。
 *
 * @responsibility Coordinator Platform BoundaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPlatformBoundaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPlatformBoundaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPlatformBoundaryの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPlatformBoundaryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPlatformBoundaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPlatformBoundary =
  (typeof COORDINATOR_PLATFORM_BOUNDARIES)[number];

/**
 * Closed operation-name population per boundary for contract revision 1.
 * Boundary support is resolved by exact match against this population, so a
 * family whose required set is empty is unresolvable by every adapter — an
 * empty set means "cannot resolve", never "trivially satisfied". Adding
 * operations to a family is a contract-revision decision of the implementing
 * stage.
 */
export const COORDINATOR_PLATFORM_BOUNDARY_OPERATIONS = Object.freeze({
  principal_provider_home: Object.freeze(["observeProviderHomeCandidate"]),
  filesystem_repository: Object.freeze(["resolveRepositoryRoot"]),
  lock_lease: Object.freeze(["observeLeaseOwner"]),
  process_cancellation: Object.freeze(["deriveChildEnvironment"]),
  container_host: Object.freeze(["observeContainerHostRecoveryState"]),
  runtime_root_recovery: Object.freeze(["compileRootObservationCandidate"]),
} as const satisfies Readonly<
  Record<CoordinatorPlatformBoundary, readonly string[]>
>);

/**
 * Architecture-owned guarantees for each IF-PLATFORM boundary.  These are
 * deliberately broader than the currently extracted operation population:
 * an adapter may expose a useful operation candidate without claiming that
 * the whole boundary is ready for Coordinator effects.
 */
export const COORDINATOR_PLATFORM_BOUNDARY_GUARANTEES = Object.freeze({
  principal_provider_home: Object.freeze([
    "selected_principal_identity",
    "stable_provider_home_identity",
    "owner_writer_protection",
    "non_link_chain",
  ]),
  filesystem_repository: Object.freeze([
    "repository_root_identity",
    "repository_revision",
    "bounded_path_resolution",
    "atomic_update",
    "isolation",
  ]),
  lock_lease: Object.freeze([
    "os_exclusivity",
    "owner_generation",
    "owner_liveness",
    "non_time_only_takeover",
  ]),
  process_cancellation: Object.freeze([
    "argv",
    "environment",
    "process_tree",
    "cancellation_signal",
    "termination_observation",
    "owner_loss",
  ]),
  container_host: Object.freeze([
    "fixed_image",
    "network",
    "mount",
    "process",
    "cleanup",
  ]),
  runtime_root_recovery: Object.freeze([
    "managed_root",
    "protection",
    "resource_identity",
    "recovery_absence",
  ]),
} as const satisfies Readonly<
  Record<CoordinatorPlatformBoundary, readonly string[]>
>);

/**
 * platform-contractで使用するCoordinator Platform Guaranteeの値契約を定義する。
 *
 * @responsibility Coordinator Platform GuaranteeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPlatformGuaranteeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPlatformGuaranteeで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPlatformGuaranteeの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPlatformGuaranteeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPlatformGuaranteeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPlatformGuarantee =
  (typeof COORDINATOR_PLATFORM_BOUNDARY_GUARANTEES)[CoordinatorPlatformBoundary][number];

/**
 * platform-contractで使用するCoordinator Platform Adapter Descriptionの値契約を定義する。
 *
 * @responsibility Coordinator Platform Adapter DescriptionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPlatformAdapterDescriptionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPlatformAdapterDescriptionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPlatformAdapterDescriptionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPlatformAdapterDescriptionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPlatformAdapterDescriptionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPlatformAdapterDescription = Readonly<{
  contract: typeof COORDINATOR_PLATFORM_CONTRACT;
  contractRevision: number;
  platformFamily: string;
  supportedBoundaries: readonly CoordinatorPlatformBoundary[];
  satisfiedGuarantees: Readonly<
    Partial<
      Record<
        CoordinatorPlatformBoundary,
        readonly CoordinatorPlatformGuarantee[]
      >
    >
  >;
  authorityGeneration: "none";
  unsupportedPlatformFallback: "none";
}>;

/**
 * platform-contractで使用するCoordinator Platform Adapterの値契約を定義する。
 *
 * @responsibility Coordinator Platform AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPlatformAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPlatformAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPlatformAdapterの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPlatformAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPlatformAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPlatformAdapter = Readonly<{
  describe: () => CoordinatorPlatformAdapterDescription;
  operations: Readonly<
    Partial<Record<CoordinatorPlatformBoundary, Readonly<object>>>
  >;
}>;

/**
 * platform-contractで使用するCoordinator Platform Resolutionの値契約を定義する。
 *
 * @responsibility Coordinator Platform ResolutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorPlatformResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorPlatformResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorPlatformResolutionの宣言は外部境界を開かない。
 * @security N/A: CoordinatorPlatformResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorPlatformResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorPlatformResolution =
  | Readonly<{ status: "resolved"; adapter: CoordinatorPlatformAdapter }>
  | Readonly<{
      status: "blocked";
      reason:
        | "platform_request_invalid"
        | "platform_identity_unknown"
        | "platform_adapter_unavailable"
        | "platform_adapter_conflict"
        | "platform_boundary_unsupported";
      unsupportedBoundaries: readonly CoordinatorPlatformBoundary[];
    }>;

const MAXIMUM_PLATFORM_FAMILY_LENGTH = 128;

const boundarySet: ReadonlySet<string> = new Set(
  COORDINATOR_PLATFORM_BOUNDARIES,
);

/**
 * platform-contractで使用するAdapter Snapshotの値契約を定義する。
 *
 * @responsibility Adapter SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape AdapterSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AdapterSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: AdapterSnapshotの宣言は外部境界を開かない。
 * @security N/A: AdapterSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility AdapterSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AdapterSnapshot = Readonly<{
  platformFamily: string;
  supportedBoundaries: ReadonlySet<CoordinatorPlatformBoundary>;
  satisfiedGuarantees: ReadonlyMap<
    CoordinatorPlatformBoundary,
    ReadonlySet<CoordinatorPlatformGuarantee>
  >;
}>;

/**
 * platform-contractを停止結果として構築する。
 *
 * @responsibility platform-contractの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: | "platform_request_invalid" | "platform_identity_unknown" | "platform_adapter_unavailable" | "platform_adapter_conflict" | "platform_boundary_unsupported"、unsupportedBoundaries: readonly CoordinatorPlatformBoundary[]
 * @returns CoordinatorPlatformResolutionを返す。
 * @precondition 「reason: | "platform_request_invalid" | "platform_identity_unknown" | "platform_adapter_unavailable" | "platform_adapter_conflict" | "platform_boundary_unsupported"、unsupportedBoundaries: readonly CoordinatorPlatformBoundary[]」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function contractBlocked(
  reason:
    | "platform_request_invalid"
    | "platform_identity_unknown"
    | "platform_adapter_unavailable"
    | "platform_adapter_conflict"
    | "platform_boundary_unsupported",
  unsupportedBoundaries: readonly CoordinatorPlatformBoundary[] = Object.freeze(
    [],
  ),
): CoordinatorPlatformResolution {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    unsupportedBoundaries: Object.freeze([...unsupportedBoundaries]),
  });
}

/**
 * Platform Familyが有効か判定する。
 *
 * @responsibility Platform Familyの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidPlatformFamilyの入力契約を満たす。
 * @postcondition validPlatformFamilyの責務を完了した結果だけを返す。
 * @effect N/A: validPlatformFamilyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validPlatformFamilyは独自の失敗分岐を所有しない。
 * @invariant validPlatformFamilyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validPlatformFamilyはProcess内の同一Subsystemで完結する。
 * @security N/A: validPlatformFamilyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validPlatformFamilyは共有非同期状態を持たない同期処理である。
 */
function validPlatformFamily(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_PLATFORM_FAMILY_LENGTH &&
    !value.includes("\0")
  );
}

/**
 * Read one own data property exactly once. Accessor properties, prototype
 *
 * @responsibility platform-contractの入力からown Data Propertyを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input container: object、key: string
 * @returns unknownを返す。
 * @precondition 「container: object、key: string」がownDataPropertyの入力契約を満たす。
 * @postcondition ownDataPropertyの責務を完了した結果だけを返す。
 * @effect N/A: ownDataPropertyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownDataPropertyは独自の失敗分岐を所有しない。
 * @invariant ownDataPropertyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownDataPropertyはProcess内の同一Subsystemで完結する。
 * @security N/A: ownDataPropertyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ownDataPropertyは共有非同期状態を持たない同期処理である。
 */
function ownDataProperty(container: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (
    !descriptor ||
    !Object.hasOwn(descriptor, "value") ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    return undefined;
  return descriptor.value;
}

/**
 * Plain Containerかを判定する。
 *
 * @responsibility Plain Containerの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainContainerの入力契約を満たす。
 * @postcondition isPlainContainerの責務を完了した結果だけを返す。
 * @effect N/A: isPlainContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainContainerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlainContainerはProcess内の同一Subsystemで完結する。
 * @security N/A: isPlainContainerはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isPlainContainerは共有非同期状態を持たない同期処理である。
 */
function isPlainContainer(value: unknown): value is object {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Call describe() exactly once and validate the returned description into a
 *
 * @responsibility platform-contractの入力からdescribed Adapter Snapshotを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns AdapterSnapshot | nullを返す。
 * @precondition 「candidate: unknown」がdescribedAdapterSnapshotの入力契約を満たす。
 * @postcondition describedAdapterSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: describedAdapterSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure describedAdapterSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant describedAdapterSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describedAdapterSnapshotはProcess内の同一Subsystemで完結する。
 * @security N/A: describedAdapterSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describedAdapterSnapshotは共有非同期状態を持たない同期処理である。
 */
function describedAdapterSnapshot(candidate: unknown): AdapterSnapshot | null {
  try {
    if (!candidate || typeof candidate !== "object") return null;
    const describe = ownDataProperty(candidate, "describe");
    if (typeof describe !== "function") return null;
    const description: unknown = describe.call(candidate);
    if (!isPlainContainer(description)) return null;
    const platformFamily = ownDataProperty(description, "platformFamily");
    const supportedBoundaries = ownDataProperty(
      description,
      "supportedBoundaries",
    );
    const satisfiedGuarantees = ownDataProperty(
      description,
      "satisfiedGuarantees",
    );
    if (
      ownDataProperty(description, "contract") !==
        COORDINATOR_PLATFORM_CONTRACT ||
      ownDataProperty(description, "contractRevision") !==
        COORDINATOR_PLATFORM_CONTRACT_REVISION ||
      ownDataProperty(description, "authorityGeneration") !== "none" ||
      ownDataProperty(description, "unsupportedPlatformFallback") !== "none" ||
      !validPlatformFamily(platformFamily) ||
      !Array.isArray(supportedBoundaries) ||
      utilTypes.isProxy(supportedBoundaries) ||
      !isPlainContainer(satisfiedGuarantees)
    )
      return null;
    const boundaries = new Set<CoordinatorPlatformBoundary>();
    for (let index = 0; index < supportedBoundaries.length; index += 1) {
      const boundary = ownDataProperty(supportedBoundaries, String(index));
      if (
        typeof boundary !== "string" ||
        !boundarySet.has(boundary) ||
        boundaries.has(boundary as CoordinatorPlatformBoundary)
      )
        return null;
      boundaries.add(boundary as CoordinatorPlatformBoundary);
    }
    const guaranteeSnapshot = new Map<
      CoordinatorPlatformBoundary,
      ReadonlySet<CoordinatorPlatformGuarantee>
    >();
    for (const boundary of COORDINATOR_PLATFORM_BOUNDARIES) {
      const rawGuarantees = ownDataProperty(satisfiedGuarantees, boundary);
      if (rawGuarantees === undefined) continue;
      if (!Array.isArray(rawGuarantees) || utilTypes.isProxy(rawGuarantees))
        return null;
      const allowed = new Set<string>(
        COORDINATOR_PLATFORM_BOUNDARY_GUARANTEES[boundary],
      );
      const observed = new Set<CoordinatorPlatformGuarantee>();
      for (let index = 0; index < rawGuarantees.length; index += 1) {
        const guarantee = ownDataProperty(rawGuarantees, String(index));
        if (
          typeof guarantee !== "string" ||
          !allowed.has(guarantee) ||
          observed.has(guarantee as CoordinatorPlatformGuarantee)
        )
          return null;
        observed.add(guarantee as CoordinatorPlatformGuarantee);
      }
      guaranteeSnapshot.set(boundary, observed);
    }
    return Object.freeze({
      platformFamily,
      supportedBoundaries: boundaries,
      satisfiedGuarantees: guaranteeSnapshot,
    });
  } catch {
    return null;
  }
}

/**
 * A boundary is supported only when the snapshot declares it AND the adapter
 *
 * @responsibility platform-contractの入力からsupports Boundaryを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input adapter: CoordinatorPlatformAdapter、snapshot: AdapterSnapshot、boundary: CoordinatorPlatformBoundary
 * @returns booleanを返す。
 * @precondition 「adapter: CoordinatorPlatformAdapter、snapshot: AdapterSnapshot、boundary: CoordinatorPlatformBoundary」がsupportsBoundaryの入力契約を満たす。
 * @postcondition supportsBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: supportsBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure supportsBoundaryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant supportsBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: supportsBoundaryはProcess内の同一Subsystemで完結する。
 * @security N/A: supportsBoundaryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: supportsBoundaryは共有非同期状態を持たない同期処理である。
 */
function supportsBoundary(
  adapter: CoordinatorPlatformAdapter,
  snapshot: AdapterSnapshot,
  boundary: CoordinatorPlatformBoundary,
): boolean {
  try {
    const requiredOperations =
      COORDINATOR_PLATFORM_BOUNDARY_OPERATIONS[boundary];
    if (
      requiredOperations.length === 0 ||
      !snapshot.supportedBoundaries.has(boundary)
    )
      return false;
    const satisfiedGuarantees = snapshot.satisfiedGuarantees.get(boundary);
    const requiredGuarantees =
      COORDINATOR_PLATFORM_BOUNDARY_GUARANTEES[boundary];
    if (
      satisfiedGuarantees === undefined ||
      requiredGuarantees.some(
        (guarantee) => !satisfiedGuarantees.has(guarantee),
      )
    )
      return false;
    const operations = ownDataProperty(adapter, "operations");
    if (!isPlainContainer(operations)) return false;
    const group = ownDataProperty(operations, boundary);
    if (!isPlainContainer(group)) return false;
    const groupKeys = Object.keys(group);
    return (
      groupKeys.length === requiredOperations.length &&
      requiredOperations.every(
        (operationName) =>
          typeof ownDataProperty(group, operationName) === "function",
      )
    );
  } catch {
    return false;
  }
}

/**
 * resolved Adapter Snapshotを決定する。
 *
 * @responsibility resolved Adapter Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input adapter: CoordinatorPlatformAdapter、snapshot: AdapterSnapshot、resolvedBoundaries: readonly CoordinatorPlatformBoundary[]
 * @returns CoordinatorPlatformAdapter | nullを返す。
 * @precondition 「adapter: CoordinatorPlatformAdapter、snapshot: AdapterSnapshot、resolvedBoundaries: readonly CoordinatorPlatformBoundary[]」がresolvedAdapterSnapshotの入力契約を満たす。
 * @postcondition resolvedAdapterSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: resolvedAdapterSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolvedAdapterSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolvedAdapterSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolvedAdapterSnapshotはProcess内の同一Subsystemで完結する。
 * @security N/A: resolvedAdapterSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolvedAdapterSnapshotは共有非同期状態を持たない同期処理である。
 */
function resolvedAdapterSnapshot(
  adapter: CoordinatorPlatformAdapter,
  snapshot: AdapterSnapshot,
  resolvedBoundaries: readonly CoordinatorPlatformBoundary[],
): CoordinatorPlatformAdapter | null {
  try {
    const rawOperations = ownDataProperty(adapter, "operations");
    if (!isPlainContainer(rawOperations)) return null;
    const operations: Partial<
      Record<CoordinatorPlatformBoundary, Readonly<object>>
    > = {};
    const satisfiedGuarantees: Partial<
      Record<
        CoordinatorPlatformBoundary,
        readonly CoordinatorPlatformGuarantee[]
      >
    > = {};
    for (const boundary of resolvedBoundaries) {
      const rawGroup = ownDataProperty(rawOperations, boundary);
      if (!isPlainContainer(rawGroup)) return null;
      const group: Record<string, unknown> = {};
      for (const operationName of COORDINATOR_PLATFORM_BOUNDARY_OPERATIONS[
        boundary
      ]) {
        const operation = ownDataProperty(rawGroup, operationName);
        if (typeof operation !== "function") return null;
        group[operationName] = operation;
      }
      operations[boundary] = Object.freeze(group);
      satisfiedGuarantees[boundary] =
        COORDINATOR_PLATFORM_BOUNDARY_GUARANTEES[boundary];
    }
    const description = Object.freeze({
      contract: COORDINATOR_PLATFORM_CONTRACT,
      contractRevision: COORDINATOR_PLATFORM_CONTRACT_REVISION,
      platformFamily: snapshot.platformFamily,
      supportedBoundaries: Object.freeze([...resolvedBoundaries]),
      satisfiedGuarantees: Object.freeze(satisfiedGuarantees),
      authorityGeneration: "none" as const,
      unsupportedPlatformFallback: "none" as const,
    });
    return Object.freeze({
      describe: () => description,
      operations: Object.freeze(operations),
    });
  } catch {
    return null;
  }
}

/**
 * Fail-closed adapter resolution for IF-PLATFORM. There is no fallback path:
 *
 * @responsibility Coordinator Platform Adapterの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input observedPlatformFamily: unknown、registeredAdapters: readonly CoordinatorPlatformAdapter[]、requiredBoundaries: readonly CoordinatorPlatformBoundary[]
 * @returns CoordinatorPlatformResolutionを返す。
 * @precondition 「observedPlatformFamily: unknown、registeredAdapters: readonly CoordinatorPlatformAdapter[]、requiredBoundaries: readonly CoordinatorPlatformBoundary[]」がresolveCoordinatorPlatformAdapterの入力契約を満たす。
 * @postcondition resolveCoordinatorPlatformAdapterの責務を完了した結果だけを返す。
 * @effect N/A: resolveCoordinatorPlatformAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveCoordinatorPlatformAdapterは独自の失敗分岐を所有しない。
 * @invariant resolveCoordinatorPlatformAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveCoordinatorPlatformAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveCoordinatorPlatformAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveCoordinatorPlatformAdapterは共有非同期状態を持たない同期処理である。
 */
export function resolveCoordinatorPlatformAdapter(
  observedPlatformFamily: unknown,
  registeredAdapters: readonly CoordinatorPlatformAdapter[],
  requiredBoundaries: readonly CoordinatorPlatformBoundary[],
): CoordinatorPlatformResolution {
  if (
    !Array.isArray(registeredAdapters) ||
    !Array.isArray(requiredBoundaries) ||
    requiredBoundaries.length === 0 ||
    requiredBoundaries.some((boundary) => !boundarySet.has(boundary)) ||
    new Set(requiredBoundaries).size !== requiredBoundaries.length
  )
    return contractBlocked("platform_request_invalid");
  if (!validPlatformFamily(observedPlatformFamily))
    return contractBlocked("platform_identity_unknown");
  const matches: Readonly<{
    adapter: CoordinatorPlatformAdapter;
    snapshot: AdapterSnapshot;
  }>[] = [];
  for (const candidate of registeredAdapters) {
    const snapshot = describedAdapterSnapshot(candidate);
    if (snapshot && snapshot.platformFamily === observedPlatformFamily)
      matches.push(Object.freeze({ adapter: candidate, snapshot }));
  }
  const match = matches[0];
  if (match === undefined)
    return contractBlocked("platform_adapter_unavailable");
  if (matches.length > 1) return contractBlocked("platform_adapter_conflict");
  const unsupportedBoundaries = requiredBoundaries.filter(
    (boundary) => !supportsBoundary(match.adapter, match.snapshot, boundary),
  );
  if (unsupportedBoundaries.length > 0)
    return contractBlocked(
      "platform_boundary_unsupported",
      unsupportedBoundaries,
    );
  const adapter = resolvedAdapterSnapshot(
    match.adapter,
    match.snapshot,
    requiredBoundaries,
  );
  if (adapter === null) return contractBlocked("platform_boundary_unsupported");
  return Object.freeze({ status: "resolved" as const, adapter });
}

/**
 * Coordinator Platform 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Platform 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorPlatformContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorPlatformContractの入力契約を満たす。
 * @postcondition describeCoordinatorPlatformContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorPlatformContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorPlatformContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorPlatformContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorPlatformContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCoordinatorPlatformContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCoordinatorPlatformContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorPlatformContract() {
  return Object.freeze({
    contract: COORDINATOR_PLATFORM_CONTRACT,
    contractRevision: COORDINATOR_PLATFORM_CONTRACT_REVISION,
    boundaries: COORDINATOR_PLATFORM_BOUNDARIES,
    boundaryOperations: COORDINATOR_PLATFORM_BOUNDARY_OPERATIONS,
    boundaryGuarantees: COORDINATOR_PLATFORM_BOUNDARY_GUARANTEES,
    boundarySupport:
      "declared_boundary_and_all_architecture_guarantees_and_exact_operation_name_match",
    emptyOperationPopulation: "unresolvable_never_trivially_satisfied",
    authorityGeneration: "none",
    unsupportedPlatformFallback: "none",
    unresolvedPlatformEffect: "zero_project_task_and_provider_effect",
  });
}

const COORDINATOR_WINDOWS_PLATFORM_FAMILY = "windows" as const;

const CHILD_ENVIRONMENT_PROFILES = new Set([
  "native_helper",
  "host_operation_supervisor",
]);

/**
 * windows-platform-adapterで使用するCoordinator Windows Child Environment 結果の値契約を定義する。
 *
 * @responsibility Coordinator Windows Child Environment 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorWindowsChildEnvironmentResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorWindowsChildEnvironmentResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorWindowsChildEnvironmentResultの宣言は外部境界を開かない。
 * @security CoordinatorWindowsChildEnvironmentResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorWindowsChildEnvironmentResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorWindowsChildEnvironmentResult =
  | Readonly<{
      status: "derived";
      profile: string;
      environment: Readonly<Record<string, string>>;
    }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * derive Child Environmentを決定する。
 *
 * @responsibility derive Child Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown
 * @returns CoordinatorWindowsChildEnvironmentResultを返す。
 * @precondition 「rawRequest: unknown」がderiveChildEnvironmentの入力契約を満たす。
 * @postcondition deriveChildEnvironmentの責務を完了した結果だけを返す。
 * @effect N/A: deriveChildEnvironmentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: deriveChildEnvironmentは独自の失敗分岐を所有しない。
 * @invariant deriveChildEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security deriveChildEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: deriveChildEnvironmentは共有非同期状態を持たない同期処理である。
 */
function deriveChildEnvironment(
  rawRequest: unknown,
): CoordinatorWindowsChildEnvironmentResult {
  const blocked = (reason: string) =>
    Object.freeze({ status: "blocked" as const, reason });
  if (
    !rawRequest ||
    typeof rawRequest !== "object" ||
    Array.isArray(rawRequest)
  )
    return blocked("windows_child_environment_request_invalid");
  const request = rawRequest as Readonly<Record<string, unknown>>;
  const profile = request.profile;
  if (typeof profile !== "string" || !CHILD_ENVIRONMENT_PROFILES.has(profile))
    return blocked("windows_child_environment_request_invalid");
  let environment: Readonly<Record<string, string>> | null = null;
  if (profile === "native_helper") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsNativeHelperEnvironment();
  } else if (profile === "host_operation_supervisor") {
    if (Object.keys(request).length !== 1)
      return blocked("windows_child_environment_request_invalid");
    environment = createWindowsHostOperationSupervisorEnvironment();
  }
  if (environment === null)
    return blocked("windows_child_environment_unavailable");
  return Object.freeze({
    status: "derived" as const,
    profile,
    environment,
  });
}

/**
 * Project lease acquisition remains owned by the durable foundation.  This
 * adapter owns only the OS observation used when a later process reconciles a
 * recorded owner.  A reused PID is conservatively reported as alive, which
 * can delay recovery but can never authorize unsafe takeover.
 */
// Only Principal / Provider Home currently satisfies the complete guarantee
// population fixed by the reference architecture.  The other operation
// groups below are useful extraction candidates, but remain partial and must
// not make their whole boundary resolvable.
const SUPPORTED_BOUNDARIES = Object.freeze([
  "principal_provider_home",
  "lock_lease",
] as const satisfies readonly CoordinatorPlatformBoundary[]);

const SATISFIED_GUARANTEES = Object.freeze({
  principal_provider_home: Object.freeze([
    "selected_principal_identity",
    "stable_provider_home_identity",
    "owner_writer_protection",
    "non_link_chain",
  ]),
  lock_lease: Object.freeze([
    "os_exclusivity",
    "owner_generation",
    "owner_liveness",
    "non_time_only_takeover",
  ]),
  filesystem_repository: Object.freeze([
    "repository_root_identity",
    "bounded_path_resolution",
  ]),
  process_cancellation: Object.freeze(["environment"]),
  runtime_root_recovery: Object.freeze([
    "managed_root",
    "protection",
    "resource_identity",
  ]),
} as const);

const REPOSITORY_ROOT_BLOCKED_REASONS = new Set([
  "repository_working_directory_invalid",
  "repository_root_observation_failed",
  "verified_repository_root_required",
  "repository_root_identity_mismatch",
  "repository_boundary_invalid",
]);

/**
 * windows-platform-adapterで使用するCoordinator Windows Repository Root 結果の値契約を定義する。
 *
 * @responsibility Coordinator Windows Repository Root 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorWindowsRepositoryRootResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorWindowsRepositoryRootResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorWindowsRepositoryRootResultの宣言は外部境界を開かない。
 * @security CoordinatorWindowsRepositoryRootResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorWindowsRepositoryRootResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorWindowsRepositoryRootResult =
  | Readonly<{ status: "resolved"; repositoryRoot: string }>
  | Readonly<{ status: "blocked"; reason: string }>;

/**
 * Repository Rootを一意に解決する。
 *
 * @responsibility Repository Rootの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input workingDirectory: unknown
 * @returns CoordinatorWindowsRepositoryRootResultを返す。
 * @precondition 「workingDirectory: unknown」がresolveRepositoryRootの入力契約を満たす。
 * @postcondition resolveRepositoryRootの責務を完了した結果だけを返す。
 * @effect N/A: resolveRepositoryRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveRepositoryRootは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security resolveRepositoryRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRepositoryRootは共有非同期状態を持たない同期処理である。
 */
function resolveRepositoryRoot(
  workingDirectory: unknown,
): CoordinatorWindowsRepositoryRootResult {
  try {
    return Object.freeze({
      status: "resolved" as const,
      repositoryRoot:
        resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return Object.freeze({
      status: "blocked" as const,
      reason: REPOSITORY_ROOT_BLOCKED_REASONS.has(message)
        ? message
        : "repository_root_observation_failed",
    });
  }
}

/**
 * IF-PLATFORM Windows adapter. Every operation routes a closed request to an
 *
 * @responsibility Coordinator Windows Platform Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns CoordinatorPlatformAdapterを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateCoordinatorWindowsPlatformAdapterの入力契約を満たす。
 * @postcondition createCoordinatorWindowsPlatformAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorWindowsPlatformAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createCoordinatorWindowsPlatformAdapterは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorWindowsPlatformAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createCoordinatorWindowsPlatformAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCoordinatorWindowsPlatformAdapterは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorWindowsPlatformAdapter(): CoordinatorPlatformAdapter {
  return Object.freeze({
    describe: () =>
      Object.freeze({
        contract: COORDINATOR_PLATFORM_CONTRACT,
        contractRevision: COORDINATOR_PLATFORM_CONTRACT_REVISION,
        platformFamily: COORDINATOR_WINDOWS_PLATFORM_FAMILY,
        supportedBoundaries: SUPPORTED_BOUNDARIES,
        satisfiedGuarantees: SATISFIED_GUARANTEES,
        authorityGeneration: "none" as const,
        unsupportedPlatformFallback: "none" as const,
      }),
    operations: Object.freeze({
      principal_provider_home: Object.freeze({
        observeProviderHomeCandidate: (provider: unknown) =>
          inspectRuntimeOwnedWindowsProviderHomeCandidate(provider),
      }),
      lock_lease: Object.freeze({
        observeLeaseOwner,
      }),
      filesystem_repository: Object.freeze({
        resolveRepositoryRoot,
      }),
      process_cancellation: Object.freeze({
        deriveChildEnvironment,
      }),
      runtime_root_recovery: Object.freeze({
        compileRootObservationCandidate: (rawObservation: unknown) =>
          compileWindowsRootObservationCandidate(rawObservation),
      }),
    }),
  });
}
