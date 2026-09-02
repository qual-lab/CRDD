import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  ProjectRuntimeDecisionRecoveryIntent,
  ProjectRuntimeDecisionRecoveryStore,
} from "./project-runtime-human-decision.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "./repository-root-resolution.ts";

export const PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT =
  "crdd-coordinator/project-runtime-decision-recovery-store/v1" as const;

type Envelope = Readonly<{
  contract: typeof PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT;
  generation: number;
  previousHash: string | null;
  value: ProjectRuntimeDecisionRecoveryIntent;
}>;

const HASH = /^[0-9a-f]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function validIntent(
  value: unknown,
): value is ProjectRuntimeDecisionRecoveryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as ProjectRuntimeDecisionRecoveryIntent;
  return (
    [
      candidate.recoveryId,
      candidate.recordId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.queueId,
    ].every((entry) => typeof entry === "string" && ID.test(entry)) &&
    (candidate.applicationId === null || ID.test(candidate.applicationId)) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    candidate.expectedGeneration >= 1 &&
    (candidate.newGeneration === null ||
      (Number.isSafeInteger(candidate.newGeneration) &&
        candidate.newGeneration >= 2)) &&
    [
      "pending",
      "prepared",
      "finalized",
      "invalidated",
      "expired",
      "recovery_required",
      "unknown",
    ].includes(candidate.observedDisposition) &&
    typeof candidate.unknownBoundary === "string" &&
    ID.test(candidate.unknownBoundary) &&
    (candidate.disposition === "required" ||
      candidate.disposition === "settled")
  );
}
function validEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Envelope;
  return (
    candidate.contract === PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT &&
    Number.isSafeInteger(candidate.generation) &&
    candidate.generation >= 1 &&
    (candidate.previousHash === null || HASH.test(candidate.previousHash)) &&
    validIntent(candidate.value)
  );
}

function paths(repositoryRoot: string, recoveryId: string) {
  const identity = digest(recoveryId).slice(0, 40);
  const directory = path.join(
    repositoryRoot,
    ".crdd",
    "project-runtime",
    "decision-recovery",
    identity,
  );
  return Object.freeze({ directory });
}
function readChain(directory: string, recoveryId: string) {
  if (!fs.existsSync(directory)) return null;
  const metadata = fs.lstatSync(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("decision_recovery_store_boundary_invalid");
  const entries = fs.readdirSync(directory).sort();
  if (entries.some((name) => !/^[0-9]{8}\.json$/u.test(name)))
    throw new Error("decision_recovery_store_inventory_invalid");
  let previousHash: string | null = null;
  let latest: Envelope | null = null;
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index];
    if (!name || Number(name.slice(0, 8)) !== index + 1)
      throw new Error("decision_recovery_store_generation_gap");
    const bytes = fs.readFileSync(path.join(directory, name));
    if (bytes.byteLength > 32 * 1024)
      throw new Error("decision_recovery_store_record_too_large");
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (
      !validEnvelope(value) ||
      value.generation !== index + 1 ||
      value.previousHash !== previousHash ||
      value.value.recoveryId !== recoveryId
    )
      throw new Error("decision_recovery_store_chain_invalid");
    latest = value;
    previousHash = digest(bytes.toString("utf8"));
  }
  return latest;
}
function writeGeneration(
  directory: string,
  generation: number,
  previousHash: string | null,
  value: ProjectRuntimeDecisionRecoveryIntent,
) {
  fs.mkdirSync(directory, { recursive: true });
  const name = `${String(generation).padStart(8, "0")}.json`;
  const target = path.join(directory, name);
  const temporary = path.join(directory, `.${name}.${process.pid}.tmp`);
  const content = `${JSON.stringify({
    contract: PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT,
    generation,
    previousHash,
    value,
  })}\n`;
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.linkSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  const readback = readChain(directory, value.recoveryId);
  if (!readback || JSON.stringify(readback.value) !== JSON.stringify(value))
    throw new Error("decision_recovery_store_readback_failed");
  return readback;
}
function completed(value: ProjectRuntimeDecisionRecoveryIntent | null) {
  return Object.freeze({ status: "completed" as const, value });
}
function blocked() {
  return Object.freeze({ status: "blocked" as const, value: null });
}

export function createProjectRuntimeDecisionRecoveryStore(
  workingDirectory: string,
): ProjectRuntimeDecisionRecoveryStore {
  const repositoryRoot =
    resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
  function guarded<T>(recoveryId: string, operation: (directory: string) => T) {
    const location = paths(repositoryRoot, recoveryId);
    fs.mkdirSync(path.dirname(location.directory), { recursive: true });
    let current = repositoryRoot;
    for (const segment of [".crdd", "project-runtime", "decision-recovery"]) {
      current = path.join(current, segment);
      if (!fs.existsSync(current)) continue;
      const metadata = fs.lstatSync(current);
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("decision_recovery_store_boundary_invalid");
    }
    return operation(location.directory);
  }
  return Object.freeze({
    create(intent) {
      if (!validIntent(intent)) return blocked();
      try {
        return guarded(intent.recoveryId, (directory) => {
          if (readChain(directory, intent.recoveryId)) return blocked();
          writeGeneration(directory, 1, null, intent);
          return completed(intent);
        });
      } catch {
        return blocked();
      }
    },
    read(recoveryId) {
      if (!ID.test(recoveryId)) return blocked();
      try {
        return guarded(recoveryId, (directory) =>
          completed(readChain(directory, recoveryId)?.value ?? null),
        );
      } catch {
        return blocked();
      }
    },
    compareAndSet(expected, next) {
      if (
        !validIntent(expected) ||
        !validIntent(next) ||
        expected.recoveryId !== next.recoveryId
      )
        return blocked();
      try {
        return guarded(expected.recoveryId, (directory) => {
          const current = readChain(directory, expected.recoveryId);
          if (
            !current ||
            JSON.stringify(current.value) !== JSON.stringify(expected)
          )
            return blocked();
          writeGeneration(
            directory,
            current.generation + 1,
            digest(`${JSON.stringify(current)}\n`),
            next,
          );
          return completed(next);
        });
      } catch {
        return blocked();
      }
    },
  });
}

export function describeProjectRuntimeDecisionRecoveryStoreContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT,
    root: "repository_local_runtime_owned_recovery_store",
    authority: "none",
    mutation: "immutable_generation_chain_with_atomic_no_replace_publish",
    unknownState: "fail_closed",
  });
}
