/**
 * 単発診断のOperation・観測・回収とreadiness結果を構成する。
 *
 * @responsibility 単発Operationの取得・下位観測・必要な隔離Probeを編成し、受付失敗と非秘密の診断結果を投影する。
 * @trace ARCH-000004
 */

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Writable } from "node:stream";
import { types } from "node:util";
import {
  getAuthenticationDefinition,
  getBillingPolicy,
} from "../../../ai-adapter/src/index.ts";
import { describeIsolationConfiguration } from "../../../docker-isolation/src/index.ts";
import {
  applyResourceEvent,
  applyResourceCleanup,
} from "../../../execution-model/src/index.ts";
import {
  type CompletionResult,
  cleanupResources,
  createExecutor,
  type Executor,
  type ExecutorRequest,
  type IsolationProbeFacts,
  type IsolationProbeOptions,
  type ResourceTarget,
} from "../../../executor/src/index.ts";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "../../../version-control/src/index.ts";
import { snapshotPlainArray } from "../input/snapshot.ts";
import type { CoordinatorExecutionPublicationObservation } from "../task/types.ts";
import {
  describeProviderHomeContract,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "./authority.ts";
import { getIsolationSettings } from "./configuration.ts";
import { observeLeaseOwner } from "./kernel-lock.ts";
import {
  acquireHostOperationRecoveryGeneration,
  borrowHostRecoveryManagementDirectory,
  classifyOwnedCoordinatorOperationCreationFailure,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationManagementCapability,
  createRuntimeOwnedCoordinatorOperation,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy,
  getOwnedHostRecoveryId,
  recoverOwnedOperationDirectories,
  releaseHostOperationRecoveryGeneration,
  readOwnedHostOperation,
  recordOwnedHostResources,
  readHostRecoveryOperation,
  observeHostRecoveryRoot,
  recordHostRecoveryResources,
  verifyOwnedMountCapability,
} from "./operation.ts";

/**
 * 現在実装した公開操作とCLI相当だけを返す。
 * @responsibility 能力の表示と今回の操作許可を区別する。
 * @trace ARCH-000004
 * @input N/A: 外部入力を受けない。
 * @returns 自身を除く完成操作とCLI呼出し例の不変集合。要求・結果の補助受付は含めない。
 * @precondition 固定候補で全操作の接続を検証する。
 * @postcondition 未接続のinspect・候補CLIを一覧へ含めない。
 * @effect N/A: 固定記述の生成のみ。
 * @failure N/A: 観測やI/Oを行わない。
 * @invariant 一覧表示からAuthorityを発行しない。
 * @boundary 正式APIと利用者向け能力表示。
 * @security 秘密・Root・認証状態を含めない。
 * @concurrency 不変の局所値。
 */
export function getCapabilities() {
  return Object.freeze({
    contract: "crdd-coordinator/capabilities",
    contractRevision: 11,
    profile: "local_personal",
    commands: Object.freeze(
      [
        "run task --request-stdin --json --principal-id <local.email.address>",
        "run objective --request-stdin --json --principal-id <local.email.address>",
        "run advice --request-stdin --json --principal-id <local.email.address>",
        "doctor [--isolation] [--json]",
        "recovery resume <id> [--restart-docker] [--json]",
        "recovery inspect <id> [--json]",
        "maintenance repair [--retain <id>] [--json]",
        "auth status codex|claude [--json]",
        "auth login codex|claude",
        "capabilities --json",
      ].map((invocation) =>
        Object.freeze({
          command: invocation
            .split(" ")
            .slice(0, /^(capabilities|doctor) /u.test(invocation) ? 1 : 2)
            .join(" "),
          availability: "available",
          invocation,
        }),
      ),
    ),
    operations: Object.freeze([
      "runObjective",
      "runTask",
      "openTaskSession",
      "submitDecision",
      "acceptResult",
      "executeWorkspace",
      "queryState",
      "queryActivity",
      "readRepositoryNetworkHosts",
      "diagnoseEnvironment",
      "recoverExecution",
      "readRecovery",
      "restartDockerForRecovery",
      "repairDockerRuntime",
      "retainRepair",
      "getAuthenticationStatus",
      "authenticateProvider",
    ]),
    executionAuthorityIssued: false,
  });
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
  const identity = readRepositorySnapshot(getRepository(cwd).capability);

  return {
    gitAvailable: identity?.status === "observed",
    identityAvailable: identity?.status === "observed",
    headCommit: identity?.revisionIdentity ?? null,
    headTree: identity?.snapshotIdentity ?? null,
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
      types.isProxy(rawOptions) ||
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
 * @concurrency 同じOperationの隔離試験・終了整理を待機してから結果を返す。
 */
export async function runDoctor(options: unknown = {}, signal?: AbortSignal) {
  const normalizedOptions = normalizeDoctorOptions(options);
  const isIsolationActive = normalizedOptions.activeIsolation;
  const cwd = normalizedOptions.cwd;
  const repositoryLocation = getRepositoryFromWorkingDirectory(cwd);
  let operation: ReturnType<
    typeof createRuntimeOwnedCoordinatorOperation
  > | null = null;
  if (isIsolationActive) {
    try {
      if (repositoryLocation.status !== "completed")
        throw Error("repository_identity_unavailable");
      const repository = repositoryLocation.capability;
      const root = resolveVerifiedRepositoryRoot(repository);
      if (!root) throw Error("repository_identity_unavailable");
      operation = createRuntimeOwnedCoordinatorOperation({
        root: repository,
        purpose: "isolation_probe",
        recordingCurrent: () =>
          resolveVerifiedRepositoryRoot(repository) === root,
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      projectDoctorOperationCreationFailure(error);
    }
  }
  const operationDirectories = operation?.owned.directories ?? null;
  if (operation && !operationDirectories)
    throw new Error("owned_operation_directory_identity_required");
  const credentialNames = credentialEnvironmentNamesPresent(process.env);
  const repository = probeGitRepository(cwd);
  const providers = Object.freeze({
    codex: discoverCommand("codex"),
    claude: discoverCommand("claude"),
  });

  const isolation = operation
    ? await runDockerIsolationProbe(operation.owned, signal)
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
  const shouldRetainOperationDirectories =
    operation !== null && isolation.hostCleanupCompleted !== true;
  const isolationCheckStatus: CheckStatus =
    isolation.status === "confirmed"
      ? "confirmed"
      : isolation.status === "not_implemented"
        ? "not_implemented"
        : "blocked";
  const checks = [
    check(
      "runtime.node",
      isSupportedNodeRuntime(process.versions.node) ? "confirmed" : "blocked",
      isSupportedNodeRuntime(process.versions.node)
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
      operation ? "confirmed" : "not_implemented",
      operation
        ? "owned_operation_directories_created"
        : "owned_operation_directories_not_requested",
    ),
    check("execution.filesystem", isolationCheckStatus, isolation.reason),
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
    reportVersion: 17,
    diagnosticMode: isIsolationActive
      ? "docker_fake_provider_probe"
      : "passive_preflight",
    status: readiness.status,
    platform: process.platform,
    node: {
      version: process.version,
      supported: isSupportedNodeRuntime(process.versions.node),
    },
    repository,
    credentials: {
      detectedNames: credentialNames,
      valuesRecorded: false,
      isolationEnforcement:
        isIsolationActive && isolation.status === "confirmed"
          ? "confirmed_for_fake_probe"
          : "not_implemented",
    },
    filesystem: {
      policy:
        operation && operationDirectories
          ? reportableFilesystemPolicy(
              describeFilesystemPolicy(operationDirectories),
              operation.owned.root,
            )
          : null,
      enforcement: isolation.status,
      profile: isIsolationActive ? DOCKER_ISOLATION_PROFILE : null,
    },
    repositoryLocation: {
      status: repositoryLocation.status,
      contract: repositoryLocation.capability?.contract ?? null,
      pathReported: false,
    },
    providerLifecycle: describeProviderLifecycleContract(),
    fakeProviderLifecycle: isolation.fakeProviderLifecycle,
    egress: {
      providerAllowlist: "not_implemented",
      fakeProbeNetwork:
        isIsolationActive && isolation.status === "confirmed"
          ? "blocked"
          : "not_evaluated",
      proxyTopology: describeIsolationConfiguration("claude").proxy,
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
  return report;
}

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
  facts: IsolationProbeFacts,
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
    "docker_probe_checkpoint_unconfirmed",
    "docker_probe_cleanup_failed",
    "docker_probe_receipt_mismatch",
    "docker_recovery_container_identity_unknown",
    "docker_recovery_boundary_failed",
    "docker_recovery_host_generation_active_or_unknown",
  ]);
  const message = isolationProbeErrorMessage(error);
  return message && known.has(message) ? message : fallback;
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
 * DIの同じ実行結果とEMの資源記録を閉じてからHostを回収する。
 * @responsibility Intent・Receiptの必須保存と、技術終了・実体清掃の共同成立を所有する。
 * @trace ARCH-000008
 * @effect DI固定Probeの実行、EM更新、元Hostの清掃。
 * @failure 保存・ID・終了・回収の不明は同じ回復参照で保持する。
 */
async function runDockerIsolationScenario(
  owned: unknown,
  create: (
    request: ExecutorRequest<"isolation_probe">,
    options: IsolationProbeOptions,
  ) => Executor<"isolation_probe"> | null = createExecutor,
  signal?: AbortSignal,
): Promise<DockerProbeResult> {
  const probeId = randomUUID();
  const recoveryId = getOwnedHostRecoveryId(owned);
  let executor: Executor<"isolation_probe"> | null = null;
  let outcome: CompletionResult<"isolation_probe"> | null = null;
  let submitted = false;
  let receiptId: string | null = null;
  let notificationFailed = false;
  let result = isolationProbeBlocked(
    "docker_isolation_probe_failed",
    probeId,
    true,
    recoveryId,
  );
  const onAbort = () => {
    void executor?.cancel();
  };
  try {
    const mount = createOwnedMountCapability(owned);
    const context = createOwnedOperationContextCapability(owned);
    const management = createOwnedOperationManagementCapability(context, mount);
    const mounts = verifyOwnedMountCapability(mount);
    const saveEvent = (
      event: "submission" | "receipt",
      target: ResourceTarget<"snapshot", "cleanup">,
    ) => {
      try {
        verifyOwnedMountCapability(mount);
        if (
          target.managementDirectory !== mounts.management ||
          target.unreceiptedAbsence !== "retain"
        )
          throw Error("docker_probe_recovery_boundary_failed");
        const {
          managementDirectory: _directory,
          resources: snapshot,
          previouslyAbsent: _absent,
          ...cleanup
        } = target;
        const current = readOwnedHostOperation(management);
        const next = applyResourceEvent(current.record.resources, {
          event,
          key: "probe",
          snapshot,
          cleanup,
        });
        if (!next) throw Error("docker_probe_checkpoint_unconfirmed");
        recordOwnedHostResources(management, next);
      } catch (error) {
        notificationFailed = true;
        throw error;
      }
    };
    executor = create(
      { kind: "isolation_probe", probeId },
      {
        settings: getIsolationSettings(),
        mounts: {
          management: mounts.management,
          workspace: mounts.workspace,
          providerHome: mounts.providerHome,
          tmp: mounts.tmp,
        },
      },
    );
    if (!executor) throw Error("docker_isolation_probe_failed");
    signal?.addEventListener("abort", onAbort, { once: true });
    const started = executor.start({
      ...(signal ? { signal } : {}),
      callbacks: {
        onCommandSubmitting: (purpose, target) => {
          if (purpose !== "create_isolation_probe")
            throw Error("docker_probe_profile_invalid");
          saveEvent("submission", target);
          submitted = true;
        },
        onResourceCreated: (id, target) => {
          if (
            target.resources.resources.find((r) => r.key === "probe")?.identity
              .dockerId !== id
          )
            throw Error("docker_probe_receipt_mismatch");
          saveEvent("receipt", target);
          receiptId = id;
        },
      },
    });
    if (started.status !== "started") throw Error(started.reason);
    if (signal?.aborted) onAbort();
    outcome = await started.completion;
    if (notificationFailed) throw Error("docker_probe_checkpoint_unconfirmed");
    const facts = outcome.facts;
    result = isolationProbeBlocked(
      outcome.reason ?? "docker_isolation_probe_failed",
      probeId,
      true,
      recoveryId,
    );
    const isolationConfirmed =
      facts !== null &&
      outcome.reason === facts.isolation.reason &&
      facts.isolation.status === "confirmed" &&
      !outcome.cancelled &&
      outcome.processCompletionConfirmed;

    // 元Completionが明示した未発行だけを保存する。通知の開始やReceipt欠測からは推測しない。
    if (
      submitted &&
      !outcome.creationAttempted &&
      outcome.processCompletionConfirmed &&
      outcome.cleanupConfirmed &&
      outcome.resourceSnapshot?.resources.length === 1 &&
      outcome.resourceSnapshot.resources[0]?.key === "probe" &&
      outcome.resourceSnapshot.resources[0].request === "not_issued" &&
      outcome.resourceSnapshot.resources[0].identity.dockerId === null
    ) {
      const current = readOwnedHostOperation(management);
      const book = applyResourceEvent(current.record.resources, {
        event: "not_issued",
        key: "probe",
      });
      if (!book) throw Error("docker_probe_checkpoint_unconfirmed");
      recordOwnedHostResources(management, book);
      cleanupOwnedOperationDirectories(owned);
      result = {
        ...result,
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      };
    }

    // Receipt欠測や終了不明を、Cleanupの成功だけで不存在へ変換しない。
    if (
      receiptId &&
      outcome.containerId === receiptId &&
      outcome.resourceSnapshot &&
      outcome.processCompletionConfirmed &&
      outcome.cleanupConfirmed
    ) {
      verifyOwnedMountCapability(mount);
      const current = readOwnedHostOperation(management);
      if (!current.record.resources)
        throw Error("docker_probe_checkpoint_unconfirmed");
      const book = applyResourceCleanup(
        current.record.resources,
        outcome.resourceSnapshot,
        [{ key: "probe", observation: "absent" }],
        { recoveryId, previousPayloadSha256: current.payloadSha256 },
      );
      if (!book?.checkpoints.every((c) => c.observation === "absent"))
        throw Error("docker_probe_cleanup_failed");
      recordOwnedHostResources(management, book);
      cleanupOwnedOperationDirectories(owned);
      result = {
        ...result,
        status: isolationConfirmed ? "confirmed" : "blocked",
        hostCleanupCompleted: true,
        retainOperationDirectories: false,
        recoveryId: null,
        cleanup: "confirmed",
      };
      if (facts) {
        const observed = projectProbeExecutionFacts(facts);
        const verified =
          result.status === "confirmed" &&
          facts.lifecycleStatus === "candidate" &&
          typeof facts.elapsedMs === "number" &&
          Number.isSafeInteger(facts.elapsedMs) &&
          facts.elapsedMs >= 0 &&
          facts.elapsedMs <= 30_000;
        result = {
          ...result,
          status: verified ? result.status : "blocked",
          reason: verified ? result.reason : facts.lifecycleReason,
          fakeProviderLifecycle: Object.freeze({
            ...observed,
            provenance: "repository_owned_docker_fake_provider",
            status: verified ? "verified" : "blocked",
            fakeProviderExecuted: verified,
            resultNormalizationVerified: verified,
            containerAbsenceVerified: true,
            processTreeAbsenceVerified: true,
            hostCleanupVerified: true,
          }),
        };
      }
    }
  } catch (error) {
    result = isolationProbeBlocked(
      normalizeFailure(error, "docker_isolation_probe_failed"),
      probeId,
      true,
      recoveryId,
    );
  } finally {
    signal?.removeEventListener("abort", onAbort);
    if (!submitted && !outcome?.creationAttempted)
      result = finishPreSubmissionCleanup(owned, recoveryId, result, probeId);
  }
  return {
    ...result,
    fakeProviderLifecycle: Object.freeze({
      ...result.fakeProviderLifecycle,
      diagnosticDockerContainerEffectIssued:
        outcome?.creationAttempted === true,
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
 * @concurrency 同じExecutorのcompletionと取消Listener解除を待ち、Host終了判断まで返却しない。
 */
export async function runDockerIsolationProbe(
  owned: unknown,
  signal?: AbortSignal,
): Promise<DockerProbeResult> {
  return runDockerIsolationScenario(owned, createExecutor, signal);
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
 * @concurrency 固定故障Profileも同じ非同期completionと上位終了判断まで待機する。
 */
export async function runDynamicFakeProviderFailureScenario(
  owned: unknown,
  scenario: DynamicFakeProviderFailureScenario,
  create: (
    request: ExecutorRequest<"isolation_probe">,
    options: IsolationProbeOptions,
  ) => Executor<"isolation_probe"> | null,
): Promise<DockerProbeResult> {
  if (!DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS.includes(scenario))
    throw new Error("docker_probe_profile_invalid");
  return runDockerIsolationScenario(owned, create);
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
 * 元Host記録のSnapshotを同じDI回収契約へ渡す。
 * @responsibility 同じRepository・操作・実LockとReceiptを照合し、資源の終了保存後だけHostを回収する。
 * @trace ARCH-000008
 * @effect 明示要求されたProbe資源の回収とEMの同一記録更新。
 * @failure ID欠測・観測不能・保存失敗では同じ参照を保持する。
 */
export async function recoverDockerIsolationProbe(
  recoveryId: string,
  repository: Repository,
  recordingCurrent: () => boolean,
  signal?: AbortSignal,
) {
  let generation: object | null = null;
  let result: Readonly<{
    status: string;
    reason: string;
    recoveryId: string | null;
    hostCleanupCompleted: boolean;
  }> = {
    status: "blocked",
    reason: "docker_probe_recovery_failed",
    recoveryId,
    hostCleanupCompleted: false,
  };
  try {
    signal?.throwIfAborted();
    generation = acquireHostOperationRecoveryGeneration(
      repository,
      recoveryId,
      recordingCurrent,
    );
    if (!generation)
      throw Error("docker_recovery_host_generation_active_or_unknown");
    const initial = readHostRecoveryOperation(generation);
    if (initial?.record.purpose !== "isolation_probe")
      throw Error("docker_recovery_boundary_failed");
    const resources = initial.record.resources;
    const savedResourcesSettled = resources?.checkpoints.every(
      (c) =>
        c.submission === "none" ||
        c.submission === "not_issued" ||
        (c.receiptSource !== null && c.observation === "absent"),
    );
    const closedRootAbsent =
      savedResourcesSettled && observeHostRecoveryRoot(generation) === "absent";
    if (resources && !closedRootAbsent) {
      // Receiptなしで構成や名前から自動的に対象を採用しない。
      if (
        resources.checkpoints.some(
          (c) => c.submission === "intent_saved" && c.receiptSource === null,
        )
      )
        throw Error("docker_recovery_container_identity_unknown");
      const borrowed = borrowHostRecoveryManagementDirectory(
        recoveryId,
        generation,
      );
      if (!borrowed) throw Error("docker_recovery_boundary_failed");
      const target: ResourceTarget<"snapshot"> = {
        ...resources.cleanup,
        managementDirectory: borrowed.directory,
        resources: resources.snapshot,
        previouslyAbsent: resources.checkpoints
          .filter((c) => c.observation === "absent")
          .map((c) => c.key),
      };
      let closedSaved = false;
      const execution = cleanupResources(target, getIsolationSettings(), {
        onCleanupSubmitting: () => {
          signal?.throwIfAborted();
          if (!borrowed.assertCurrent() || !recordingCurrent())
            throw Error("docker_recovery_boundary_failed");
        },
        onResourcesClosed: (snapshot, observations) => {
          if (!borrowed.assertCurrent() || !recordingCurrent())
            throw Error("docker_recovery_boundary_failed");
          const current = readHostRecoveryOperation(generation);
          if (!current?.record.resources)
            throw Error("docker_probe_checkpoint_unconfirmed");
          const book = applyResourceCleanup(
            current.record.resources,
            snapshot,
            observations.map((o) => ({
              key: o.key,
              observation: o.observation,
            })),
            { recoveryId, previousPayloadSha256: current.payloadSha256 },
          );
          if (!book) throw Error("docker_probe_checkpoint_unconfirmed");
          recordHostRecoveryResources(generation, book);
          closedSaved = book.checkpoints.every(
            (c) => c.observation === "absent" || c.submission === "not_issued",
          );
        },
      });
      const cancel = () => {
        void execution.cancel();
      };
      signal?.addEventListener("abort", cancel, { once: true });
      let completion: Awaited<typeof execution.completion>;
      try {
        if (signal?.aborted) cancel();
        completion = await execution.completion;
      } finally {
        signal?.removeEventListener("abort", cancel);
      }
      if (
        !closedSaved ||
        !completion.processTerminationConfirmed ||
        !completion.cleanup.confirmed
      )
        throw Error("docker_probe_cleanup_failed");
    }
    const recovered = recoverOwnedOperationDirectories(recoveryId, generation);
    result = {
      ...recovered,
      recoveryId: recovered.status === "recovered" ? null : recoveryId,
      hostCleanupCompleted: recovered.status === "recovered",
    };
  } catch (error) {
    result = {
      status: "blocked",
      reason: normalizeFailure(error, "docker_probe_recovery_failed"),
      recoveryId,
      hostCleanupCompleted: false,
    };
  } finally {
    if (generation && !releaseHostOperationRecoveryGeneration(generation))
      result = {
        status: "blocked",
        reason: "docker_recovery_host_generation_release_unconfirmed",
        recoveryId,
        hostCleanupCompleted: false,
      };
  }
  return result;
}

export const DOCKER_ISOLATION_PROFILE = Object.freeze({
  ...describeIsolationConfiguration().runtimeProfile,
  dynamicFakeProviderProcessImplemented: true,
  realProviderProcessesExecuted: false,
});

export const PROVIDER_LIFECYCLE_CONTRACT =
  "crdd-coordinator/provider-lifecycle";

export const PROVIDER_LIFECYCLE_CONTRACT_REVISION = 8;

const PROVIDERS = Object.freeze(["codex", "claude"] as const);

const MODES = Object.freeze(["login", "run"] as const);

const billingPolicy = getBillingPolicy();

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
    implementationState: "repository_owned_docker_fake_observation",
    providers: PROVIDERS,
    modes: MODES,
    authPolicies: Object.freeze({
      codex: getAuthenticationDefinition("codex").policy,
      claude: getAuthenticationDefinition("claude").policy,
    }),
    authenticationPolicyState: "approved_policy_only",
    dedicatedProviderHome: describeProviderHomeContract(),
    limits: null,
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
    syntheticFakeObservationState: "retired",
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
 * @returns isSupportedNodeRuntimeの計算結果を返す。
 * @precondition 「value: unknown」がisSupportedNodeRuntimeの入力契約を満たす。
 * @postcondition isSupportedNodeRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedNodeRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedNodeRuntimeは独自の失敗分岐を所有しない。
 * @invariant isSupportedNodeRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedNodeRuntimeはProcess内の同一Subsystemで完結する。
 * @security N/A: isSupportedNodeRuntimeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSupportedNodeRuntimeは共有非同期状態を持たない同期処理である。
 */
export function isSupportedNodeRuntime(value: unknown) {
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
  if (!isSupportedNodeRuntime(value)) {
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

export const COORDINATOR_PLATFORM_CONTRACT_REVISION = 3;

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
 * Closed operation-name population per boundary for contract revision 3.
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
  process_cancellation: Object.freeze([]),
  container_host: Object.freeze(["observeContainerHostRecoveryState"]),
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
      types.isProxy(value)
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
      types.isProxy(supportedBoundaries) ||
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
      if (!Array.isArray(rawGuarantees) || types.isProxy(rawGuarantees))
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
    }),
  });
}
