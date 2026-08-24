import { createHash, randomBytes } from "node:crypto";

import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  compileExternalSendScopeHash,
  consumeRuntimeOwnedExternalSendGrant,
} from "./external-send-grant-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const PROVIDER_TASK_PACKET_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-task-packet-runtime";
export const PROVIDER_TASK_PACKET_RUNTIME_CONTRACT_REVISION = 2;

const PACKET_KEYS = new Set([
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
]);
const MAXIMUM_OBJECTIVE_BYTES = 8_192;
const MAXIMUM_CRITERIA = 16;
const MAXIMUM_CRITERION_BYTES = 1_024;
const MAXIMUM_ALLOWED_PATHS = 64;
const MAXIMUM_ALLOWED_PATH_BYTES = 1_024;
const INVALID_WINDOWS_CHARACTER = /[<>:"|?*\\\x00-\x1f\x7f]/u;
const RESERVED_WINDOWS_SEGMENT =
  /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu;

type TaskRole = "executor" | "reviewer";
type TaskPacket = Readonly<{
  operationId: string;
  taskPacketRef: string;
  taskRole: TaskRole;
  objective: string;
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
  externalSendScopeHash: string;
  taskPacketHash: string;
}>;
type PacketRecord = Readonly<{
  managementCapability: object;
  packet: TaskPacket;
  controlCapability: object;
  useCapability: object;
}>;

type RuntimeState = Readonly<{
  controlRecords: WeakMap<object, PacketRecord>;
  useRecords: WeakMap<object, PacketRecord>;
  consumeExternalSendGrant: typeof consumeRuntimeOwnedExternalSendGrant;
}>;

function createState(
  consumeExternalSendGrant: typeof consumeRuntimeOwnedExternalSendGrant,
): RuntimeState {
  return Object.freeze({
    controlRecords: new WeakMap(),
    useRecords: new WeakMap(),
    consumeExternalSendGrant,
  });
}

const productionState = createState(consumeRuntimeOwnedExternalSendGrant);

function validText(value: unknown, maximumBytes: number) {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}

function validSegment(segment: string) {
  return !(
    segment.length === 0 ||
    segment === "." ||
    segment === ".." ||
    segment.toLowerCase() === ".git" ||
    Buffer.byteLength(segment, "utf8") > 255 ||
    INVALID_WINDOWS_CHARACTER.test(segment) ||
    RESERVED_WINDOWS_SEGMENT.test(segment) ||
    segment.endsWith(".") ||
    segment.endsWith(" ")
  );
}

function normalizedAllowedPath(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\\") ||
    value.startsWith("/") ||
    Buffer.byteLength(value, "utf8") > MAXIMUM_ALLOWED_PATH_BYTES
  ) {
    return null;
  }
  const isDirectory = value.endsWith("/");
  const relativePath = isDirectory ? value.slice(0, -1) : value;
  if (!relativePath.split("/").every(validSegment)) return null;
  return isDirectory ? `${relativePath}/` : relativePath;
}

function normalizedStrings(
  value: unknown,
  maximumLength: number,
  maximumBytes: number,
) {
  const snapshot = snapshotPlainArray(value, maximumLength);
  if (snapshot.status !== "ok" || snapshot.value.length === 0) return null;
  const strings = snapshot.value.map((item) =>
    validText(item, maximumBytes) ? item : null,
  );
  return strings.some((item) => item === null)
    ? null
    : Object.freeze(strings as string[]);
}

function normalizedPaths(value: unknown) {
  const snapshot = snapshotPlainArray(value, MAXIMUM_ALLOWED_PATHS);
  if (snapshot.status !== "ok" || snapshot.value.length === 0) return null;
  const paths = snapshot.value.map(normalizedAllowedPath);
  if (paths.some((item) => item === null)) return null;
  const normalized = paths as string[];
  const unique = new Set(normalized.map((item) => item.toUpperCase()));
  return unique.size === normalized.length
    ? Object.freeze([...normalized])
    : null;
}

function taskHash(
  operationId: string,
  taskRole: TaskRole,
  objective: string,
  acceptanceCriteria: readonly string[],
  allowedPaths: readonly string[],
  readPaths: readonly string[],
) {
  return createHash("sha256")
    .update("crdd-provider-task-packet-v2\0")
    .update(operationId)
    .update("\0")
    .update(taskRole)
    .update("\0")
    .update(objective)
    .update("\0")
    .update(acceptanceCriteria.join("\0"))
    .update("\0")
    .update(allowedPaths.join("\0"))
    .update("\0")
    .update(readPaths.join("\0"))
    .digest("hex");
}

function promptFor(packet: TaskPacket) {
  const roleInstruction =
    packet.taskRole === "executor"
      ? "Work only inside /work. Modify only the allowed paths. Do not access credentials, Provider Home, network, browser, MCP, plugins, skills, or external systems."
      : "Review the candidate in /work without modifying any file. Do not access credentials, Provider Home, network, browser, MCP, plugins, skills, or external systems.";
  return [
    "You are a CRDD isolated provider task.",
    roleInstruction,
    `Objective:\n${packet.objective}`,
    `Acceptance criteria:\n${packet.acceptanceCriteria.map((item) => `- ${item}`).join("\n")}`,
    `Allowed paths:\n${packet.allowedPaths.map((item) => `- ${item}`).join("\n")}`,
    `Readable paths:\n${packet.readPaths.map((item) => `- ${item}`).join("\n")}`,
    packet.taskRole === "executor"
      ? "Return the required executor JSON only after completing the local candidate."
      : "Return the required reviewer JSON only after reviewing the exact candidate.",
  ].join("\n\n");
}

function issue(
  state: RuntimeState,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  provider: unknown,
  taskRole: unknown,
  externalSendGrantCapability: unknown,
  rawPacket: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      (provider !== "codex" && provider !== "claude") ||
      (taskRole !== "executor" && taskRole !== "reviewer")
    ) {
      return null;
    }
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const value = snapshotPlainRecord(rawPacket, PACKET_KEYS);
    const acceptanceCriteria = value
      ? normalizedStrings(
          value.acceptanceCriteria,
          MAXIMUM_CRITERIA,
          MAXIMUM_CRITERION_BYTES,
        )
      : null;
    const allowedPaths = value ? normalizedPaths(value.allowedPaths) : null;
    const readPaths = value ? normalizedPaths(value.readPaths) : null;
    if (
      !value ||
      !validText(value.objective, MAXIMUM_OBJECTIVE_BYTES) ||
      !acceptanceCriteria ||
      !allowedPaths ||
      !readPaths
    ) {
      return null;
    }
    const objective = value.objective as string;
    const externalSendScopeHash = compileExternalSendScopeHash(value);
    const externalSendGrant = state.consumeExternalSendGrant(
      externalSendGrantCapability,
      managementCapability,
      repositoryBindingCapability,
      provider,
      taskRole,
      value,
    );
    if (
      !externalSendScopeHash ||
      externalSendGrant?.status !== "consumed" ||
      externalSendGrant.scopeHash !== externalSendScopeHash
    ) {
      return null;
    }
    const taskPacketHash = taskHash(
      operation.operationId,
      taskRole,
      objective,
      acceptanceCriteria,
      allowedPaths,
      readPaths,
    );
    const taskPacketRef = `TASKPKT-${randomBytes(16).toString("hex").toUpperCase()}`;
    const controlCapability = Object.freeze({});
    const useCapability = Object.freeze({});
    const packet = Object.freeze({
      operationId: operation.operationId,
      taskPacketRef,
      taskRole,
      objective,
      acceptanceCriteria,
      allowedPaths,
      readPaths,
      externalSendScopeHash,
      taskPacketHash,
    });
    const record = Object.freeze({
      managementCapability,
      packet,
      controlCapability,
      useCapability,
    });
    state.controlRecords.set(controlCapability, record);
    state.useRecords.set(useCapability, record);
    return Object.freeze({
      status: "issued" as const,
      taskPacketRef,
      taskPacketHash,
      controlCapability,
      useCapability,
      rawPromptReported: false,
    });
  } catch {
    return null;
  }
}

function consume(
  state: RuntimeState,
  useCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (!useCapability || typeof useCapability !== "object") return null;
    const record = state.useRecords.get(useCapability);
    if (!record || record.managementCapability !== managementCapability)
      return null;
    verifyOwnedOperationManagementCapability(managementCapability);
    state.controlRecords.delete(record.controlCapability);
    state.useRecords.delete(record.useCapability);
    return Object.freeze({
      ...record.packet,
      prompt: promptFor(record.packet),
      promptTransport: "provider_stdin_only" as const,
      rawPromptReported: false,
    });
  } catch {
    return null;
  }
}

function revoke(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (!controlCapability || typeof controlCapability !== "object")
      return Object.freeze({ status: "blocked" as const });
    const record = state.controlRecords.get(controlCapability);
    if (!record || record.managementCapability !== managementCapability)
      return Object.freeze({ status: "blocked" as const });
    state.controlRecords.delete(record.controlCapability);
    state.useRecords.delete(record.useCapability);
    return Object.freeze({ status: "revoked" as const });
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

export function issueRuntimeOwnedProviderTaskPacket(
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  provider: unknown,
  taskRole: unknown,
  externalSendGrantCapability: unknown,
  rawPacket: unknown,
) {
  return issue(
    productionState,
    managementCapability,
    repositoryBindingCapability,
    provider,
    taskRole,
    externalSendGrantCapability,
    rawPacket,
  );
}

export function consumeRuntimeOwnedProviderTaskPacket(
  useCapability: unknown,
  managementCapability: unknown,
) {
  return consume(productionState, useCapability, managementCapability);
}

export function revokeRuntimeOwnedProviderTaskPacket(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return revoke(productionState, controlCapability, managementCapability);
}

export function createIsolatedProviderTaskPacketRuntimeCandidate(
  consumeExternalSendGrant: typeof consumeRuntimeOwnedExternalSendGrant,
) {
  const state = createState(consumeExternalSendGrant);
  return Object.freeze({
    productionAuthority: false as const,
    issue: (
      managementCapability: unknown,
      repositoryBindingCapability: unknown,
      provider: unknown,
      taskRole: unknown,
      externalSendGrantCapability: unknown,
      rawPacket: unknown,
    ) =>
      issue(
        state,
        managementCapability,
        repositoryBindingCapability,
        provider,
        taskRole,
        externalSendGrantCapability,
        rawPacket,
      ),
    consume: (useCapability: unknown, managementCapability: unknown) =>
      consume(state, useCapability, managementCapability),
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      revoke(state, controlCapability, managementCapability),
  });
}

export function describeProviderTaskPacketRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_TASK_PACKET_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_TASK_PACKET_RUNTIME_CONTRACT_REVISION,
    roles: Object.freeze(["executor", "reviewer"]),
    externalSendAuthority:
      "opaque_interactive_local_user_grant_consumed_per_provider_and_role",
    promptTransport: "provider_stdin_only",
    promptInDockerArgvAllowed: false,
    allowedPaths: "exact_file_or_directory_prefix",
    readablePaths: "explicit_projection_exact_file_or_directory_prefix",
    singleUse: true,
    canonicalRepositoryEffectAllowed: false,
    rawPromptReported: false,
  });
}
