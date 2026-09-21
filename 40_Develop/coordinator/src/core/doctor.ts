/**
 * doctorに属する責務をまとめる。
 *
 * @responsibility DoctorOperationInitializationFailureを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { describeAuthorityFileBundleContract } from "../security/authority-file-bundle.ts";
import { describeAuthorityGrantVerifierContract } from "../security/authority-grant-verifier.ts";
import { describeAuthorityPrelaunchVerifierContract } from "../security/authority-prelaunch-verifier.ts";
import { describeAuthorityTrustLoaderContract } from "../security/authority-trust-loader.ts";
import {
  classifyOwnedCoordinatorOperationCreationFailure,
  createRuntimeOwnedCoordinatorOperation,
} from "../security/coordinator-operation-creation-internal.ts";
import {
  DOCKER_ISOLATION_PROFILE,
  runDockerIsolationProbe,
} from "../security/docker-isolation.ts";
import { describeEgressProxyTopology } from "../security/egress-proxy-policy.ts";
import {
  cleanupOwnedOperationDirectories,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy,
} from "../security/execution-environment.ts";
import { snapshotPlainArray } from "../security/plain-data-snapshot.ts";
import { describeProviderIsolationContract } from "../security/provider-isolation-profile.ts";
import { describeProviderLifecycleContract } from "../security/provider-lifecycle.ts";
import { describeRepositoryLocationContract } from "../../../version-control/src/repository-location.ts";
import { inspectRepositoryRevisionCandidate } from "../security/repository-operation-runtime.ts";
import { describeRootProtectionPolicyContract } from "../security/root-protection-policy.ts";
import { isSupportedCoordinatorNodeRuntime } from "./node-runtime-version.ts";

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
 * Doctor Command 失敗を人間向け表示へ整形する。
 *
 * @responsibility Doctor Command 失敗の入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns renderDoctorCommandFailureの計算結果を返す。
 * @precondition 「error: unknown」がrenderDoctorCommandFailureの入力契約を満たす。
 * @postcondition renderDoctorCommandFailureの責務を完了した結果だけを返す。
 * @effect N/A: renderDoctorCommandFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: renderDoctorCommandFailureは独自の失敗分岐を所有しない。
 * @invariant renderDoctorCommandFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: renderDoctorCommandFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: renderDoctorCommandFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: renderDoctorCommandFailureは共有非同期状態を持たない同期処理である。
 */
export function renderDoctorCommandFailure(error: unknown) {
  const doctorCreation = classifyDoctorOperationInitializationFailure(error);
  const message = errorMessage(error);
  const reason =
    typeof message === "string" && /^[a-z0-9_]+$/u.test(message)
      ? message
      : "diagnostic_failed";
  return Object.freeze({
    exitCode: 2,
    json: `${JSON.stringify(
      doctorCreation
        ? { status: "blocked", ...doctorCreation }
        : { status: "blocked", reason },
    )}\n`,
    human: doctorCreation
      ? `Coordinator診断は停止しました: ${doctorCreation.reason}; 手動回復が必要です; ホスト回復ID: ${doctorCreation.hostRecoveryId ?? "取得できません"}\n`
      : `Coordinator診断に失敗しました: ${reason}\n`,
  });
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

export const isSupportedNodeVersion = isSupportedCoordinatorNodeRuntime;

/**
 * node Supportedを決定する。
 *
 * @responsibility node Supportedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns booleanを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がnodeSupportedの入力契約を満たす。
 * @postcondition nodeSupportedの責務を完了した結果だけを返す。
 * @effect nodeSupportedは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: nodeSupportedは独自の失敗分岐を所有しない。
 * @invariant nodeSupportedは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: nodeSupportedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: nodeSupportedは共有非同期状態を持たない同期処理である。
 */
function nodeSupported(): boolean {
  return isSupportedNodeVersion(process.versions.node);
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
 * @security N/A: runDoctorはAuthority、秘密値または信頼判断を扱わない。
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
        nodeSupported() ? "confirmed" : "blocked",
        nodeSupported() ? null : "node_24_12_or_newer_required",
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
      node: { version: process.version, supported: nodeSupported() },
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
        proxyTopology: describeEgressProxyTopology(),
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
