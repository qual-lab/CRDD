import { createHash, randomBytes } from "node:crypto";

import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";

export const PROVIDER_TASK_PACKET_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-task-packet-runtime";
export const PROVIDER_TASK_PACKET_RUNTIME_CONTRACT_REVISION = 1;

const PACKET_KEYS = new Set([
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "contentPolicy",
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
  contentPolicy: "authenticated_local_user_approved";
  taskPacketHash: string;
}>;
type PacketRecord = Readonly<{
  managementCapability: object;
  packet: TaskPacket;
  controlCapability: object;
  useCapability: object;
}>;

const controlRecords = new WeakMap<object, PacketRecord>();
const useRecords = new WeakMap<object, PacketRecord>();

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
) {
  return createHash("sha256")
    .update("crdd-provider-task-packet-v1\0")
    .update(operationId)
    .update("\0")
    .update(taskRole)
    .update("\0")
    .update(objective)
    .update("\0")
    .update(acceptanceCriteria.join("\0"))
    .update("\0")
    .update(allowedPaths.join("\0"))
    .update("\0authenticated_local_user_approved")
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
    packet.taskRole === "executor"
      ? "Return the required executor JSON only after completing the local candidate."
      : "Return the required reviewer JSON only after reviewing the exact candidate.",
  ].join("\n\n");
}

export function issueRuntimeOwnedProviderTaskPacket(
  managementCapability: unknown,
  taskRole: unknown,
  rawPacket: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
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
    if (
      !value ||
      !validText(value.objective, MAXIMUM_OBJECTIVE_BYTES) ||
      !acceptanceCriteria ||
      !allowedPaths ||
      value.contentPolicy !== "authenticated_local_user_approved"
    ) {
      return null;
    }
    const objective = value.objective as string;
    const taskPacketHash = taskHash(
      operation.operationId,
      taskRole,
      objective,
      acceptanceCriteria,
      allowedPaths,
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
      contentPolicy: "authenticated_local_user_approved" as const,
      taskPacketHash,
    });
    const record = Object.freeze({
      managementCapability,
      packet,
      controlCapability,
      useCapability,
    });
    controlRecords.set(controlCapability, record);
    useRecords.set(useCapability, record);
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

export function consumeRuntimeOwnedProviderTaskPacket(
  useCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (!useCapability || typeof useCapability !== "object") return null;
    const record = useRecords.get(useCapability);
    if (!record || record.managementCapability !== managementCapability)
      return null;
    verifyOwnedOperationManagementCapability(managementCapability);
    controlRecords.delete(record.controlCapability);
    useRecords.delete(record.useCapability);
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

export function revokeRuntimeOwnedProviderTaskPacket(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  try {
    if (!controlCapability || typeof controlCapability !== "object")
      return Object.freeze({ status: "blocked" as const });
    const record = controlRecords.get(controlCapability);
    if (!record || record.managementCapability !== managementCapability)
      return Object.freeze({ status: "blocked" as const });
    controlRecords.delete(record.controlCapability);
    useRecords.delete(record.useCapability);
    return Object.freeze({ status: "revoked" as const });
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

export function describeProviderTaskPacketRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_TASK_PACKET_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_TASK_PACKET_RUNTIME_CONTRACT_REVISION,
    roles: Object.freeze(["executor", "reviewer"]),
    contentPolicy: "authenticated_local_user_approved",
    promptTransport: "provider_stdin_only",
    promptInDockerArgvAllowed: false,
    allowedPaths: "exact_file_or_directory_prefix",
    singleUse: true,
    canonicalRepositoryEffectAllowed: false,
    rawPromptReported: false,
  });
}
