import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { isDockerIsolationRecoveryIdCandidate } from "../security/docker-isolation.ts";
import { snapshotPlainArray } from "../security/plain-data-snapshot.ts";
import { inspectRepositoryRevisionCandidate } from "../security/repository-operation-runtime.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../security/repository-root-resolution.ts";
import { isCanonicalSignedRunnerRecoveryId } from "../security/signed-runner-safety-observation.ts";
import { isSupportedCoordinatorNodeRuntime } from "./node-runtime-version.ts";

const CONTRACT = "crdd-coordinator/local-verification-record";
const MAX_RECORD_BYTES = 32 * 1024;
const MAX_EXISTING_ENTRIES = 256;
const REASONS = new Set([
  "signed_route_matrix_completed",
  "signed_route_matrix_incomplete",
  "signed_route_matrix_failed_closed",
  "signed_route_matrix_arguments_invalid",
  "signed_recovery_matrix_verified",
  "signed_recovery_matrix_failed_closed",
  "signed_recovery_matrix_node_version_unsupported",
  "signed_general_task_verification_completed",
  "signed_general_task_candidate_content_mismatch",
  "signed_general_task_result_contract_mismatch",
  "signed_general_task_execution_repository_changed",
  "signed_general_task_execution_repository_observation_unknown",
  "coordinator_task_independent_review_not_approved",
  "coordinator_task_remediated_candidate_invalid",
  "coordinator_task_repository_preflight_failed",
  "coordinator_task_external_send_confirmation_unavailable",
  "coordinator_task_external_send_confirmation_reader_failed",
  "coordinator_task_release_verification_required",
  "provider_turn_limit_exceeded",
  "provider_process_exit_nonzero",
  "docker_process_controller_recovery_conflict",
  "docker_process_controller_recovery_identity_mismatch",
  "docker_process_controller_recovery_unavailable",
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

function known(value: unknown, allowed: ReadonlySet<string>) {
  return typeof value === "string" && allowed.has(value) ? value : "unknown";
}

/** Non-authoritative observation only. Never serialize the original object. */
export function projectVerificationResult(
  value: unknown,
  shouldIncludeChildren = true,
) {
  const summary: Record<string, unknown> = {
    status: known(ownValue(value, "status"), STATUSES),
    reason: known(ownValue(value, "reason"), REASONS),
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

type DirectoryIdentity = Readonly<{
  target: string;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;
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
function lastDirectory(directories: readonly DirectoryIdentity[]) {
  const directory = directories.at(-1);
  if (!directory) throw new Error("verification_record_directory_missing");
  return directory.target;
}
function appendDirectory(parents: readonly DirectoryIdentity[], name: string) {
  recheck(parents);
  const target = path.join(lastDirectory(parents), name);
  try {
    fs.mkdirSync(target);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "EEXIST"
    )
      throw error;
  }
  recheck(parents);
  return [...parents, observeDirectory(target)];
}
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

export async function runRecordedVerification<T, E>(
  kind: "routes" | "recovery",
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
      (kind !== "routes" && kind !== "recovery")
    )
      throw new Error("verification_record_input_invalid");
    const root =
      resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
    const revision = inspectRepositoryRevisionCandidate(root);
    if (!revision) throw new Error("verification_record_revision_unavailable");
    directories = appendDirectory([observeDirectory(root)], ".crdd");
    directories = appendDirectory(directories, "verification-results");
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
      contractRevision: 1,
      recordId,
      kind,
      startedAt: new Date().toISOString(),
      repositoryAtStart: { commit: revision.commit, tree: revision.tree },
      repositoryRevisionIsExecutionVersion: false,
      authorityConferred: false,
    });
    writeNewRecord(directories, "started.json", started);
  } catch {
    return {
      result: null,
      recordId,
      executionOutcome: "not_started" as const,
      recordingOutcome: "start_failed" as const,
      exitCode: 2,
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
      contractRevision: 1,
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
      `記録: .crdd/verification-results/${outcome.recordId}/\n`,
    );
}
