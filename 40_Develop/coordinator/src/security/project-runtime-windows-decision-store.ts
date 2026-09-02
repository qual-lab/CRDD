import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import {
  readCommittedDockerRecoveryJson,
  writeCommittedDockerRecoveryJson,
} from "./docker-recovery-journal.ts";
import {
  isProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionRecord,
  type ProjectRuntimeDecisionStore,
} from "./project-runtime-human-decision.ts";

export const PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT =
  "crdd-coordinator/project-runtime-windows-decision-store/v1" as const;

const ENTRY = /^project-decision-([0-9a-f]{40})-([0-9]{8})\.json$/u;

type VerifiedRoot = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedRuntimeStateRootCapability>
>;
type Envelope = Readonly<{
  contract: typeof PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT;
  recordId: string;
  generation: number;
  previousHash: string | null;
  value: ProjectRuntimeDecisionRecord;
}>;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function sameRoot(left: VerifiedRoot, right: VerifiedRoot) {
  return (
    left.rootPath === right.rootPath &&
    left.runtimeStateIdentityHash === right.runtimeStateIdentityHash &&
    left.runtimeStateProtectionHash === right.runtimeStateProtectionHash &&
    left.localUserBindingHash === right.localUserBindingHash &&
    left.stableLogicalHomeBindingHash === right.stableLogicalHomeBindingHash
  );
}

function envelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join("\0") ===
      ["contract", "generation", "previousHash", "recordId", "value"]
        .sort()
        .join("\0") &&
    record.contract === PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT &&
    typeof record.recordId === "string" &&
    Number.isSafeInteger(record.generation) &&
    Number(record.generation) >= 1 &&
    (record.previousHash === null ||
      (typeof record.previousHash === "string" &&
        /^[0-9a-f]{64}$/u.test(record.previousHash))) &&
    isProjectRuntimeDecisionRecord(record.value)
  );
}

function entryName(recordId: string, generation: number) {
  return `project-decision-${hash(recordId).slice(0, 40)}-${String(generation).padStart(8, "0")}.json`;
}

function inspectRoot(initialize: boolean) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    initialize,
    new Date().toISOString(),
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  return observation.status === "candidate" &&
    observation.selectedUserBindingVerified === true &&
    observation.protectionVerified === true &&
    observation.stableIdentityObserved === true &&
    root
    ? root
    : null;
}

function current(root: VerifiedRoot, recordId: string) {
  const identity = hash(recordId).slice(0, 40);
  const candidates = fs
    .readdirSync(root.rootPath)
    .map((name) => ({ name, match: ENTRY.exec(name) }))
    .filter((entry) => entry.match?.[1] === identity)
    .sort(
      (left, right) =>
        Number(left.match?.[2] ?? 0) - Number(right.match?.[2] ?? 0),
    );
  let previousHash: string | null = null;
  let latest: Readonly<{
    envelope: Envelope;
    contentHash: string;
  }> | null = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate) throw new Error("decision_store_inventory_invalid");
    const generation = Number(candidate.match?.[2]);
    if (generation !== index + 1)
      throw new Error("decision_store_generation_gap");
    const committed = readCommittedDockerRecoveryJson(
      path.join(root.rootPath, candidate.name),
      candidate.name,
    );
    if (
      !envelope(committed.value) ||
      committed.value.recordId !== recordId ||
      committed.value.generation !== generation ||
      committed.value.previousHash !== previousHash
    )
      throw new Error("decision_store_chain_invalid");
    latest = Object.freeze({
      envelope: committed.value,
      contentHash: committed.hash,
    });
    previousHash = committed.hash;
  }
  return latest;
}

function result(value: ProjectRuntimeDecisionRecord | null) {
  return Object.freeze({ status: "completed" as const, value });
}
function unknown() {
  return Object.freeze({ status: "blocked" as const, value: null });
}

function withLock<T>(
  expectedRoot: VerifiedRoot,
  acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null,
  reobserve: () => VerifiedRoot | null,
  operation: (root: VerifiedRoot) => T,
): T | null {
  const lock = acquire(expectedRoot.stableLogicalHomeBindingHash);
  if (!lock) return null;
  let output: T | null = null;
  let failed = false;
  try {
    const rebound = reobserve();
    if (!rebound || !sameRoot(expectedRoot, rebound)) failed = true;
    else output = operation(rebound);
  } catch {
    failed = true;
  }
  let released = false;
  try {
    released = lock.release();
  } catch {
    released = false;
  }
  return failed || !released ? null : output;
}

function createStore(
  root: VerifiedRoot,
  acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null,
  reobserve: () => VerifiedRoot | null,
) {
  const store: ProjectRuntimeDecisionStore = Object.freeze({
    create(record) {
      if (!isProjectRuntimeDecisionRecord(record)) return unknown();
      return (
        withLock(root, acquire, reobserve, (lockedRoot) => {
          if (current(lockedRoot, record.recordId)) return unknown();
          const value: Envelope = Object.freeze({
            contract: PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT,
            recordId: record.recordId,
            generation: 1,
            previousHash: null,
            value: record,
          });
          const name = entryName(record.recordId, 1);
          writeCommittedDockerRecoveryJson(
            lockedRoot.rootPath,
            name,
            name,
            value,
          );
          const observed = current(lockedRoot, record.recordId);
          return observed && observed.envelope.generation === 1
            ? result(observed.envelope.value)
            : unknown();
        }) ?? unknown()
      );
    },
    read(recordId) {
      if (typeof recordId !== "string") return unknown();
      return (
        withLock(root, acquire, reobserve, (lockedRoot) =>
          result(current(lockedRoot, recordId)?.envelope.value ?? null),
        ) ?? unknown()
      );
    },
    compareAndSet(expected, next) {
      if (
        !isProjectRuntimeDecisionRecord(expected) ||
        !isProjectRuntimeDecisionRecord(next) ||
        expected.recordId !== next.recordId
      )
        return unknown();
      return (
        withLock(root, acquire, reobserve, (lockedRoot) => {
          const observed = current(lockedRoot, expected.recordId);
          if (
            !observed ||
            JSON.stringify(observed.envelope.value) !== JSON.stringify(expected)
          )
            return unknown();
          const generation = observed.envelope.generation + 1;
          const value: Envelope = Object.freeze({
            contract: PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT,
            recordId: expected.recordId,
            generation,
            previousHash: observed.contentHash,
            value: next,
          });
          const name = entryName(expected.recordId, generation);
          writeCommittedDockerRecoveryJson(
            lockedRoot.rootPath,
            name,
            name,
            value,
          );
          const readback = current(lockedRoot, expected.recordId);
          return readback && readback.envelope.generation === generation
            ? result(readback.envelope.value)
            : unknown();
        }) ?? unknown()
      );
    },
  });
  return store;
}

export function openRuntimeOwnedWindowsProjectDecisionStore():
  | Readonly<{
      status: "completed";
      store: ProjectRuntimeDecisionStore;
      principalId: string;
    }>
  | Readonly<{ status: "blocked"; store: null; principalId: null }> {
  const root = inspectRoot(true);
  if (!root)
    return Object.freeze({ status: "blocked", store: null, principalId: null });
  return Object.freeze({
    status: "completed",
    store: createStore(
      root,
      acquireRuntimeOwnedDockerRuntimeStateKernelLock,
      () => inspectRoot(false),
    ),
    principalId: root.localUserBindingHash,
  });
}

export function createProjectRuntimeWindowsDecisionStoreTestingAdapter(
  directory: string,
) {
  const resolved = fs.realpathSync.native(directory);
  const metadata = fs.lstatSync(resolved);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("decision_store_testing_root_invalid");
  const root = Object.freeze({
    rootPath: resolved,
    runtimeStateIdentityHash: "a".repeat(64),
    runtimeStateProtectionHash: "b".repeat(64),
    localUserBindingHash: "c".repeat(64),
    stableLogicalHomeBindingHash: "d".repeat(64),
  });
  return createStore(
    root,
    () => Object.freeze({ release: () => true }),
    () => root,
  );
}

export function describeProjectRuntimeWindowsDecisionStoreContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT,
    root: "runtime_owned_os_managed_protected_runtime_state",
    mutation: "immutable_generation_chain_under_kernel_lock",
    rawCapabilityPersisted: false,
    callerSuppliedPathAccepted: false,
    unsupportedPlatformFallback: "none",
  });
}
