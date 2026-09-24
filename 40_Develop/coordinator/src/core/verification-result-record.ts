/**
 * verification-result-recordに属する責務をまとめる。
 *
 * @responsibility ownValueを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000003
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { types as utilTypes } from "node:util";
import {
  ensureRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
  VERIFICATION_RELATIVE_PATH,
} from "../../../runtime-data/src/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";
import { isDockerIsolationRecoveryIdCandidate } from "../security/docker-isolation.ts";
import { snapshotPlainArray } from "../security/plain-data-snapshot.ts";
import { coordinatorTaskPublicReasons } from "../security/coordinator-task-result-reasons.ts";
import { inspectRepositoryRevisionCandidate } from "../security/repository-operation-runtime.ts";
import { isCanonicalSignedRunnerRecoveryId } from "../security/signed-runner-safety-observation.ts";
import { isSupportedCoordinatorNodeRuntime } from "./node-runtime-version.ts";
import {
  SIGNED_GENERAL_TASK_PUBLIC_REASONS,
  SIGNED_ROUTE_MATRIX_REASONS,
} from "./verification-result-reasons.ts";

const CONTRACT = "crdd-coordinator/local-verification-record";
const CONTRACT_REVISION = 3;
const MAX_RECORD_BYTES = 32 * 1024;
const MAX_EXISTING_ENTRIES = 256;
const reasons = new Set([
  ...Object.values(SIGNED_ROUTE_MATRIX_REASONS),
  ...SIGNED_GENERAL_TASK_PUBLIC_REASONS,
  ...coordinatorTaskPublicReasons,
  "signed_recovery_matrix_verified",
  "signed_recovery_matrix_failed_closed",
  "signed_recovery_matrix_node_version_unsupported",
  "signed_reviewer_boundary_integration_completed",
  "signed_reviewer_boundary_integration_incomplete",
  "docker_isolation_probe_timeout",
  "docker_isolation_probe_output_too_large",
  "docker_isolation_probe_invalid_output",
  "docker_isolation_probe_failed",
  "dynamic_fake_provider_cancellation_verified",
  "cleanup_observation_intentionally_withheld",
]);
const STATUSES = new Set(["completed", "blocked", "verified"]);
const ROUTES = new Set(["forward", "reverse", "same-codex", "same-claude"]);
const VALIDATION_FAILURES = new Set([
  "arguments_invalid",
  "route_nonconforming",
  "release_identity_mismatch",
  "execution_identity_mismatch",
  "runner_exception",
  "process_restart_required",
]);
const REVIEWER_TARGET_CLASSIFICATIONS = new Set([
  "exact",
  "base_unchanged",
  "crlf",
  "missing_lf",
  "extra_lf",
  "literal_lf_escape",
  "metadata_invalid",
  "other_bytes",
]);
const SCENARIOS = new Set([
  "timeout",
  "output_limit",
  "invalid_output",
  "nonzero_exit",
  "cancel",
  "cleanup_observation_unknown_then_recover",
  "parent_process_loss_then_fresh_recovery",
]);
const booleanFields = [
  "cleanupConfirmed",
  "manualRecoveryRequired",
  "processRestartRequired",
  "effectStateUnknown",
  "recoveryIdentityAmbiguous",
  "canonicalRepositoryChanged",
  "candidateDiscarded",
  "exactCandidateContentVerified",
  "remediationPerformed",
  "reviewerProjectedTargetExact",
  "freshRecoveryCompleted",
  "childProcessTerminationObserved",
  "residualOperationDirectory",
] as const;
const recoveryPairs = [
  ["hostRecoveryId", "hostRecoveryIds", "host"],
  ["dockerRecoveryId", "dockerRecoveryIds", "docker"],
  ["candidateRecoveryId", "candidateRecoveryIds", "candidate"],
  ["candidateStoreRecoveryId", "candidateStoreRecoveryIds", "candidate_store"],
] as const;

/**
 * own Valueを決定する。
 *
 * @responsibility own Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input record: unknown、key: string
 * @returns unknownを返す。
 * @precondition 「record: unknown、key: string」がownValueの入力契約を満たす。
 * @postcondition ownValueの責務を完了した結果だけを返す。
 * @effect N/A: ownValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownValueは独自の失敗分岐を所有しない。
 * @invariant ownValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownValueはProcess内の同一Subsystemで完結する。
 * @security N/A: ownValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ownValueは共有非同期状態を持たない同期処理である。
 */
function ownValue(record: unknown, key: string): unknown {
  if (
    !record ||
    typeof record !== "object" ||
    Array.isArray(record) ||
    utilTypes.isProxy(record)
  )
    return undefined;
  const prototype = Object.getPrototypeOf(record);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  return descriptor &&
    Object.hasOwn(descriptor, "value") &&
    descriptor.enumerable
    ? descriptor.value
    : undefined;
}

/**
 * knownを決定する。
 *
 * @responsibility knownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown、allowed: ReadonlySet<string>
 * @returns knownの計算結果を返す。
 * @precondition 「value: unknown、allowed: ReadonlySet<string>」がknownの入力契約を満たす。
 * @postcondition knownの責務を完了した結果だけを返す。
 * @effect N/A: knownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: knownは独自の失敗分岐を所有しない。
 * @invariant knownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: knownはProcess内の同一Subsystemで完結する。
 * @security N/A: knownはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: knownは共有非同期状態を持たない同期処理である。
 */
function known(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === "string" && allowed.has(value) ? value : "unknown";
}

/**
 * Non-authoritative observation only. Never serialize the original object.
 *
 * @responsibility Verification 結果の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown、shouldIncludeChildren
 * @returns projectVerificationResultの計算結果を返す。
 * @precondition 「value: unknown、shouldIncludeChildren」がprojectVerificationResultの入力契約を満たす。
 * @postcondition projectVerificationResultの責務を完了した結果だけを返す。
 * @effect N/A: projectVerificationResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectVerificationResultは独自の失敗分岐を所有しない。
 * @invariant projectVerificationResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectVerificationResultはProcess内の同一Subsystemで完結する。
 * @security N/A: projectVerificationResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectVerificationResultは共有非同期状態を持たない同期処理である。
 */
export function projectVerificationResult(
  value: unknown,
  shouldIncludeChildren = true,
) {
  const summary: Record<string, unknown> = {
    status: known(ownValue(value, "status"), STATUSES),
    reason: known(ownValue(value, "reason"), reasons),
  };
  for (const field of booleanFields) {
    const observed = ownValue(value, field);
    summary[field] = typeof observed === "boolean" ? observed : null;
  }
  for (const field of [
    "attemptedRouteCount",
    "completedRouteCount",
    "retryableRouteAttemptCount",
  ]) {
    const observed = ownValue(value, field);
    summary[field] =
      Number.isSafeInteger(observed) &&
      typeof observed === "number" &&
      observed >= 0 &&
      observed <= 12
        ? observed
        : null;
  }
  const reviewerDecision = ownValue(value, "reviewerDecision");
  summary.reviewerDecision =
    reviewerDecision === "approved" || reviewerDecision === "changes_requested"
      ? reviewerDecision
      : null;
  const reviewerFindingCount = ownValue(value, "reviewerFindingCount");
  summary.reviewerFindingCount =
    typeof reviewerFindingCount === "number" &&
    Number.isSafeInteger(reviewerFindingCount) &&
    reviewerFindingCount >= 0 &&
    reviewerFindingCount <= 64
      ? reviewerFindingCount
      : null;
  summary.reviewerProjectedTargetClassification = known(
    ownValue(value, "reviewerProjectedTargetClassification"),
    REVIEWER_TARGET_CLASSIFICATIONS,
  );
  for (const field of ["failedRouteProfile", "requestedRouteProfile"])
    summary[field] = known(ownValue(value, field), ROUTES);
  summary.validationFailure = known(
    ownValue(value, "validationFailure"),
    VALIDATION_FAILURES,
  );
  summary.scenario = known(ownValue(value, "scenario"), SCENARIOS);
  for (const field of [
    "manifestHash",
    "packageContentRootSha256",
    "runtimeExecutionIdentitySha256",
    "crddCommit",
    "crddTree",
    "executionCommit",
    "executionTree",
  ]) {
    const observed = ownValue(value, field);
    const pattern =
      field === "crddCommit" ||
      field === "crddTree" ||
      field === "executionCommit" ||
      field === "executionTree"
        ? /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u
        : /^[a-f0-9]{64}$/u;
    summary[field] =
      typeof observed === "string" && pattern.test(observed) ? observed : null;
  }
  let recoveryFieldsComplete = true;
  for (const [single, plural, kind] of recoveryPairs) {
    const id = ownValue(value, single);
    const ids = snapshotPlainArray<unknown>(ownValue(value, plural), 16);
    const collected = new Set<string>();
    if (isCanonicalSignedRunnerRecoveryId(id, kind)) collected.add(id);
    else if (id !== null && id !== undefined) recoveryFieldsComplete = false;
    if (ids.status === "ok") {
      for (const item of ids.value) {
        if (isCanonicalSignedRunnerRecoveryId(item, kind)) collected.add(item);
        else recoveryFieldsComplete = false;
      }
    } else if (ownValue(value, plural) !== undefined)
      recoveryFieldsComplete = false;
    summary[plural] = [...collected];
  }
  const recoveryId = ownValue(value, "recoveryId");
  summary.recoveryId =
    isCanonicalSignedRunnerRecoveryId(recoveryId, "docker") ||
    isCanonicalSignedRunnerRecoveryId(recoveryId, "host") ||
    isDockerIsolationRecoveryIdCandidate(recoveryId)
      ? recoveryId
      : null;
  if (
    recoveryId !== null &&
    recoveryId !== undefined &&
    summary.recoveryId === null
  )
    recoveryFieldsComplete = false;
  summary.recoveryFieldsComplete = recoveryFieldsComplete;
  if (shouldIncludeChildren) {
    for (const field of ["results", "scenarios"]) {
      const raw = ownValue(value, field);
      const items = snapshotPlainArray<unknown>(raw, 12);
      summary[field] =
        items.status === "ok"
          ? items.value.map((item) => projectVerificationResult(item, false))
          : [];
      summary[`${field}Complete`] = raw === undefined || items.status === "ok";
    }
  }
  return Object.freeze(summary);
}

/**
 * verification-result-recordで使用するDirectory Identityの値契約を定義する。
 *
 * @responsibility Directory IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape DirectoryIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DirectoryIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: DirectoryIdentityの宣言は外部境界を開かない。
 * @security N/A: DirectoryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DirectoryIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DirectoryIdentity = Readonly<{
  target: string;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;
/**
 * Directoryを観測する。
 *
 * @responsibility Directoryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000003
 * @input target: string
 * @returns DirectoryIdentityを返す。
 * @precondition 「target: string」がobserveDirectoryの入力契約を満たす。
 * @postcondition observeDirectoryの責務を完了した結果だけを返す。
 * @effect observeDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure observeDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: observeDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeDirectoryは共有非同期状態を持たない同期処理である。
 */
function observeDirectory(target: string): DirectoryIdentity {
  const stat = fs.lstatSync(target, { bigint: true });
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    fs.realpathSync.native(target) !== target
  )
    throw new Error("verification_record_directory_invalid");
  return {
    target,
    dev: stat.dev,
    ino: stat.ino,
    birthtimeNs: stat.birthtimeNs,
  };
}
/**
 * recheckを決定する。
 *
 * @responsibility recheckの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input directories: readonly DirectoryIdentity[]
 * @returns N/A: recheckは戻り値を返さない。
 * @precondition 「directories: readonly DirectoryIdentity[]」がrecheckの入力契約を満たす。
 * @postcondition recheckの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: recheckは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recheckは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recheckは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recheckはProcess内の同一Subsystemで完結する。
 * @security N/A: recheckはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: recheckは共有非同期状態を持たない同期処理である。
 */
function recheck(directories: readonly DirectoryIdentity[]) {
  for (const expected of directories) {
    const current = observeDirectory(expected.target);
    if (
      current.dev !== expected.dev ||
      current.ino !== expected.ino ||
      current.birthtimeNs !== expected.birthtimeNs
    )
      throw new Error("verification_record_directory_changed");
  }
}
/**
 * last Directoryを決定する。
 *
 * @responsibility last Directoryの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input directories: readonly DirectoryIdentity[]
 * @returns lastDirectoryの計算結果を返す。
 * @precondition 「directories: readonly DirectoryIdentity[]」がlastDirectoryの入力契約を満たす。
 * @postcondition lastDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: lastDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure lastDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant lastDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: lastDirectoryはProcess内の同一Subsystemで完結する。
 * @security N/A: lastDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: lastDirectoryは共有非同期状態を持たない同期処理である。
 */
function lastDirectory(directories: readonly DirectoryIdentity[]) {
  const directory = directories.at(-1);
  if (!directory) throw new Error("verification_record_directory_missing");
  return directory.target;
}
/**
 * New 記録を書き込む。
 *
 * @responsibility New 記録の書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000003
 * @input directories: readonly DirectoryIdentity[]、name: string、value: unknown
 * @returns writeNewRecordの計算結果を返す。
 * @precondition 「directories: readonly DirectoryIdentity[]、name: string、value: unknown」がwriteNewRecordの入力契約を満たす。
 * @postcondition writeNewRecordの責務を完了した結果だけを返す。
 * @effect writeNewRecordはFilesystemの読取りまたは書込みを実行する。
 * @failure writeNewRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeNewRecordは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: writeNewRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: writeNewRecordは共有非同期状態を持たない同期処理である。
 */
function writeNewRecord(
  directories: readonly DirectoryIdentity[],
  name: string,
  value: unknown,
) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (bytes.length > MAX_RECORD_BYTES)
    throw new Error("verification_record_too_large");
  recheck(directories);
  const target = path.join(lastDirectory(directories), name);
  const descriptor = fs.openSync(target, "wx+", 0o600);
  try {
    const before = fs.fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n)
      throw new Error("verification_record_file_invalid");
    fs.writeFileSync(descriptor, bytes);
    fs.fsyncSync(descriptor);
    const readback = Buffer.alloc(bytes.length);
    let offset = 0;
    while (offset < readback.length) {
      const read = fs.readSync(
        descriptor,
        readback,
        offset,
        readback.length - offset,
        offset,
      );
      if (read === 0) throw new Error("verification_record_incomplete");
      offset += read;
    }
    recheck(directories);
    const after = fs.lstatSync(target, { bigint: true });
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1n ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.birthtimeNs !== before.birthtimeNs ||
      after.size !== BigInt(bytes.length) ||
      !readback.equals(bytes)
    )
      throw new Error("verification_record_changed");
  } finally {
    fs.closeSync(descriptor);
  }
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Recorded Verificationを実行する。
 *
 * @responsibility Recorded Verificationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000003
 * @input kind: "routes" | "recovery" | "reviewer-boundary"、workingDirectory: string、executeVerification: () => Promise<T>、onException: () => E
 * @returns runRecordedVerificationの計算結果を返す。
 * @precondition 「kind: "routes" | "recovery" | "reviewer-boundary"、workingDirectory: string、executeVerification: () => Promise<T>、onException: () => E」がrunRecordedVerificationの入力契約を満たす。
 * @postcondition runRecordedVerificationの責務を完了した結果だけを返す。
 * @effect runRecordedVerificationはFilesystemの読取りまたは書込みを実行する。
 * @failure runRecordedVerificationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runRecordedVerificationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: runRecordedVerificationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runRecordedVerificationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runRecordedVerification<T, E>(
  kind: "routes" | "recovery" | "reviewer-boundary",
  workingDirectory: string,
  executeVerification: () => Promise<T>,
  onException: () => E,
) {
  let recordId: string | null = null;
  let directories: DirectoryIdentity[];
  let started: Readonly<Record<string, unknown>>;
  try {
    if (
      !isSupportedCoordinatorNodeRuntime(process.versions.node) ||
      (kind !== "routes" && kind !== "recovery" && kind !== "reviewer-boundary")
    )
      throw new Error("verification_record_input_invalid");
    const root =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
    const verifiedRuntimeRoot = verifyRepositoryRoot(root);
    if (verifiedRuntimeRoot.status !== "completed")
      throw new Error("verification_record_runtime_path_invalid");
    const verificationArea = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataArea(
        verifiedRuntimeRoot.capability,
        "verification",
      ),
      "verification_record_runtime_path_invalid",
    );
    const revision = inspectRepositoryRevisionCandidate(root);
    if (!revision) throw new Error("verification_record_revision_unavailable");
    directories = [
      observeDirectory(root),
      observeDirectory(verificationArea.directory),
    ];
    // Admission bound, not a cross-process atomic quota. Never delete old evidence.
    if (
      fs.readdirSync(lastDirectory(directories)).length >= MAX_EXISTING_ENTRIES
    )
      throw new Error("verification_record_capacity_exceeded");
    recordId = randomUUID();
    const runPath = path.join(lastDirectory(directories), recordId);
    recheck(directories);
    fs.mkdirSync(runPath); // Collision is an error; never reuse an existing run.
    directories = [...directories, observeDirectory(runPath)];
    started = Object.freeze({
      contract: CONTRACT,
      contractRevision: CONTRACT_REVISION,
      recordId,
      kind,
      startedAt: new Date().toISOString(),
      repositoryAtStart: { commit: revision.commit, tree: revision.tree },
      repositoryRevisionIsExecutionVersion: false,
      authorityConferred: false,
    });
    writeNewRecord(directories, "started.json", started);
  } catch (error) {
    return {
      result: null,
      recordId,
      executionOutcome: "not_started" as const,
      recordingOutcome: "start_failed" as const,
      exitCode: 2,
      ...(error instanceof RepositoryRuntimeDataAreaBlockedError
        ? {
            reason: error.reason,
            effectIssued: error.effectIssued,
            cleanupConfirmed: error.cleanupConfirmed,
            effectStateUnknown: error.effectStateUnknown,
            retryAllowed: error.retryAllowed,
            recoveryReference: error.recoveryReference,
          }
        : {}),
    };
  }
  let executionOutcome: "returned" | "threw" = "returned";
  let result: T | E;
  try {
    result = await executeVerification();
  } catch {
    executionOutcome = "threw";
    result = onException(); // The owning runner retains poison/recovery handling.
  }
  try {
    const resultSha256 = writeNewRecord(directories, "result.json", {
      ...started,
      finishedAt: new Date().toISOString(),
      executionOutcome,
      summary: projectVerificationResult(result),
    });
    // A valid-looking result alone is not enough: flush/read-back may have failed.
    writeNewRecord(directories, "complete.json", {
      contract: CONTRACT,
      contractRevision: CONTRACT_REVISION,
      recordId,
      kind,
      startedAt: started.startedAt,
      resultSha256,
    });
  } catch {
    return {
      result,
      recordId,
      executionOutcome,
      recordingOutcome: "finish_failed" as const,
      exitCode: 2,
    };
  }
  return {
    result,
    recordId,
    executionOutcome,
    recordingOutcome: "saved" as const,
    exitCode:
      executionOutcome === "returned" &&
      ownValue(result, "status") === "completed"
        ? 0
        : 2,
  };
}

/**
 * display Verification Recordingを決定する。
 *
 * @responsibility display Verification Recordingの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input outcome: Readonly<{ recordId: string | null; recordingOutcome: string }>
 * @returns N/A: displayVerificationRecordingは戻り値を返さない。
 * @precondition 「outcome: Readonly<{ recordId: string | null; recordingOutcome: string }>」がdisplayVerificationRecordingの入力契約を満たす。
 * @postcondition displayVerificationRecordingの責務を完了して呼出し元へ制御を戻す。
 * @effect displayVerificationRecordingは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: displayVerificationRecordingは独自の失敗分岐を所有しない。
 * @invariant displayVerificationRecordingは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: displayVerificationRecordingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: displayVerificationRecordingは共有非同期状態を持たない同期処理である。
 */
export function displayVerificationRecording(
  outcome: Readonly<{ recordId: string | null; recordingOutcome: string }>,
) {
  const message =
    outcome.recordingOutcome === "saved"
      ? "検証の最終結果を保存しました。画面を閉じても確認できます。"
      : outcome.recordingOutcome === "start_failed"
        ? "開始記録を保存できないため、検証処理は開始していません。記録領域が一部残る場合があります。"
        : "最終結果を保存できませんでした。以下の実行結果を保持してください。保存失敗から実行結果や回復状態を推定しないでください。";
  process.stderr.write(`${message}\n`);
  if (outcome.recordId)
    process.stderr.write(
      `記録: ${VERIFICATION_RELATIVE_PATH}/${outcome.recordId}/\n`,
    );
}
