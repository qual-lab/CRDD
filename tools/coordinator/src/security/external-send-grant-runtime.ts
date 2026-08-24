import { createHash, randomInt } from "node:crypto";
import fs from "node:fs";
import { performance } from "node:perf_hooks";

import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { verifyRuntimeOwnedRepositoryBindingCapability } from "./repository-operation-runtime.ts";

export const EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/external-send-grant-runtime";
export const EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT_REVISION = 1;

const GRANT_LIFETIME_MS = 300_000;
const SCOPE_KEYS = new Set([
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
]);
const PROVIDERS = new Set(["codex", "claude"]);

type Provider = "codex" | "claude";
type TaskRole = "executor" | "reviewer";
type Scope = Readonly<{
  objective: string;
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
}>;
type GrantRecord = {
  managementCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  revision: string;
  scopeHash: string;
  providers: ReadonlySet<Provider>;
  consumedRoles: Set<TaskRole>;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
};
type RuntimeDependencies = Readonly<{
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  verifyRepository: typeof verifyRuntimeOwnedRepositoryBindingCapability;
  confirm: (notice: string, challenge: string) => boolean;
  wallNow: () => number;
  monotonicNow: () => number;
  randomChallenge: () => string;
}>;
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  grants: WeakMap<object, GrantRecord>;
}>;

function normalizedStrings(
  value: unknown,
  maximum: number,
  maximumBytes: number,
) {
  const snapshot = snapshotPlainArray<string>(value, maximum);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    snapshot.value.some(
      (item) =>
        typeof item !== "string" ||
        item.length === 0 ||
        item.trim() !== item ||
        item.includes("\0") ||
        Buffer.byteLength(item, "utf8") > maximumBytes,
    )
  ) {
    return null;
  }
  return Object.freeze([...snapshot.value]);
}

function normalizedScope(rawScope: unknown): Scope | null {
  const value = snapshotPlainRecord(rawScope, SCOPE_KEYS);
  const acceptanceCriteria = value
    ? normalizedStrings(value.acceptanceCriteria, 16, 1_024)
    : null;
  const allowedPaths = value
    ? normalizedStrings(value.allowedPaths, 64, 1_024)
    : null;
  const readPaths = value
    ? normalizedStrings(value.readPaths, 64, 1_024)
    : null;
  if (
    !value ||
    typeof value.objective !== "string" ||
    value.objective.length === 0 ||
    value.objective.trim() !== value.objective ||
    value.objective.includes("\0") ||
    Buffer.byteLength(value.objective, "utf8") > 8_192 ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths
  ) {
    return null;
  }
  return Object.freeze({
    objective: value.objective,
    acceptanceCriteria,
    allowedPaths,
    readPaths,
  });
}

export function compileExternalSendScopeHash(rawScope: unknown) {
  const scope = normalizedScope(rawScope);
  return scope
    ? createHash("sha256")
        .update("crdd-external-send-scope-v1\0")
        .update(scope.objective)
        .update("\0")
        .update(scope.acceptanceCriteria.join("\0"))
        .update("\0")
        .update(scope.allowedPaths.join("\0"))
        .update("\0")
        .update(scope.readPaths.join("\0"))
        .digest("hex")
    : null;
}

function consoleConfirmation(notice: string, challenge: string) {
  const inputName = process.platform === "win32" ? "CONIN$" : "/dev/tty";
  const outputName = process.platform === "win32" ? "CONOUT$" : "/dev/tty";
  let input: number | null = null;
  let output: number | null = null;
  try {
    input = fs.openSync(inputName, "r");
    output = fs.openSync(outputName, "w");
    fs.writeSync(
      output,
      `${notice}\n外部送信を承認する場合は ${challenge} を入力してください: `,
      null,
      "utf8",
    );
    const bytes: number[] = [];
    const buffer = Buffer.alloc(1);
    while (bytes.length <= 64) {
      const readBytes = fs.readSync(input, buffer, 0, 1, null);
      if (readBytes !== 1 || buffer[0] === 0x0a) break;
      if (buffer[0] !== 0x0d) bytes.push(buffer[0] as number);
    }
    fs.writeSync(output, "\n", null, "utf8");
    return Buffer.from(bytes).toString("utf8") === challenge;
  } catch {
    return false;
  } finally {
    if (input !== null) fs.closeSync(input);
    if (output !== null) fs.closeSync(output);
  }
}

function createState(dependencies: RuntimeDependencies): RuntimeState {
  return Object.freeze({ dependencies, grants: new WeakMap() });
}

const productionState = createState(
  Object.freeze({
    verifyOperation: verifyOwnedOperationManagementCapability,
    verifyRepository: verifyRuntimeOwnedRepositoryBindingCapability,
    confirm: consoleConfirmation,
    wallNow: Date.now,
    monotonicNow: performance.now.bind(performance),
    randomChallenge: () => randomInt(0, 1_000_000).toString().padStart(6, "0"),
  }),
);

function requestGrant(
  state: RuntimeState,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  rawScope: unknown,
  rawProviders: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !Array.isArray(rawProviders)
    ) {
      return null;
    }
    const providers = [...new Set(rawProviders)];
    if (
      providers.length === 0 ||
      providers.some(
        (provider) => typeof provider !== "string" || !PROVIDERS.has(provider),
      )
    ) {
      return null;
    }
    const operation = state.dependencies.verifyOperation(managementCapability);
    const repository = state.dependencies.verifyRepository(
      repositoryBindingCapability,
      managementCapability,
    );
    const scope = normalizedScope(rawScope);
    const scopeHash = compileExternalSendScopeHash(rawScope);
    const challenge = state.dependencies.randomChallenge();
    const issuedWallClockMs = state.dependencies.wallNow();
    const issuedMonotonicMs = state.dependencies.monotonicNow();
    if (
      !repository ||
      repository.operationId !== operation.operationId ||
      !scope ||
      !scopeHash ||
      !/^[0-9]{6}$/u.test(challenge) ||
      !Number.isFinite(issuedWallClockMs) ||
      !Number.isFinite(issuedMonotonicMs)
    ) {
      return null;
    }
    const notice = [
      "Coordinator Runtime 外部送信承認",
      `Provider候補: ${providers.join(", ")}`,
      `Repository revision: ${repository.revision}`,
      `目的: ${scope.objective}`,
      `読取り範囲: ${scope.readPaths.join(", ")}`,
      "対象内容はProviderへ送信され、Subscription枠を消費する可能性があります。API key fallbackと追加購入は行いません。",
    ].join("\n");
    if (!state.dependencies.confirm(notice, challenge)) return null;
    const capability = Object.freeze({});
    state.grants.set(capability, {
      managementCapability,
      repositoryBindingCapability,
      operationId: operation.operationId,
      revision: repository.revision,
      scopeHash,
      providers: new Set(providers as Provider[]),
      consumedRoles: new Set(),
      issuedWallClockMs,
      issuedMonotonicMs,
    });
    return Object.freeze({
      status: "issued" as const,
      capability,
      scopeHash,
      revision: repository.revision,
      providerCandidates: Object.freeze(providers),
      externalSendAuthorized: true,
      apiKeyFallbackAllowed: false,
      additionalPurchaseAllowed: false,
      rawContentReported: false,
      hostPathReported: false,
    });
  } catch {
    return null;
  }
}

function consumeGrant(
  state: RuntimeState,
  capability: unknown,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  provider: unknown,
  taskRole: unknown,
  rawScope: unknown,
) {
  try {
    if (
      !capability ||
      typeof capability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      (provider !== "codex" && provider !== "claude") ||
      (taskRole !== "executor" && taskRole !== "reviewer")
    ) {
      return null;
    }
    const record = state.grants.get(capability);
    const repository = state.dependencies.verifyRepository(
      repositoryBindingCapability,
      managementCapability,
    );
    const wallAge = record
      ? state.dependencies.wallNow() - record.issuedWallClockMs
      : Number.NaN;
    const monotonicAge = record
      ? state.dependencies.monotonicNow() - record.issuedMonotonicMs
      : Number.NaN;
    if (
      !record ||
      record.managementCapability !== managementCapability ||
      record.repositoryBindingCapability !== repositoryBindingCapability ||
      !repository ||
      repository.operationId !== record.operationId ||
      repository.revision !== record.revision ||
      compileExternalSendScopeHash(rawScope) !== record.scopeHash ||
      !record.providers.has(provider) ||
      record.consumedRoles.has(taskRole) ||
      !Number.isFinite(wallAge) ||
      !Number.isFinite(monotonicAge) ||
      wallAge < 0 ||
      monotonicAge < 0 ||
      wallAge >= GRANT_LIFETIME_MS ||
      monotonicAge >= GRANT_LIFETIME_MS
    ) {
      return null;
    }
    record.consumedRoles.add(taskRole);
    if (record.consumedRoles.size === 2) state.grants.delete(capability);
    return Object.freeze({
      status: "consumed" as const,
      operationId: record.operationId,
      revision: record.revision,
      provider,
      taskRole,
      scopeHash: record.scopeHash,
      externalSendAuthorized: true,
    });
  } catch {
    return null;
  }
}

export function requestRuntimeOwnedExternalSendGrant(
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  rawScope: unknown,
  rawProviders: unknown,
) {
  return requestGrant(
    productionState,
    managementCapability,
    repositoryBindingCapability,
    rawScope,
    rawProviders,
  );
}

export function consumeRuntimeOwnedExternalSendGrant(
  capability: unknown,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  provider: unknown,
  taskRole: unknown,
  rawScope: unknown,
) {
  return consumeGrant(
    productionState,
    capability,
    managementCapability,
    repositoryBindingCapability,
    provider,
    taskRole,
    rawScope,
  );
}

export function createIsolatedExternalSendGrantRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const state = createState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    request: (
      managementCapability: unknown,
      repositoryBindingCapability: unknown,
      rawScope: unknown,
      rawProviders: unknown,
    ) =>
      requestGrant(
        state,
        managementCapability,
        repositoryBindingCapability,
        rawScope,
        rawProviders,
      ),
    consume: (
      capability: unknown,
      managementCapability: unknown,
      repositoryBindingCapability: unknown,
      provider: unknown,
      taskRole: unknown,
      rawScope: unknown,
    ) =>
      consumeGrant(
        state,
        capability,
        managementCapability,
        repositoryBindingCapability,
        provider,
        taskRole,
        rawScope,
      ),
  });
}

export function describeExternalSendGrantRuntimeContract() {
  return Object.freeze({
    contract: EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT,
    contractRevision: EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT_REVISION,
    authoritySource:
      "authenticated_local_user_interactive_console_confirmation",
    binding: Object.freeze([
      "operation",
      "repository_identity",
      "revision",
      "task_scope_hash",
      "provider",
      "task_role",
    ]),
    maximumUses: 2,
    roleUses: Object.freeze(["executor", "reviewer"]),
    lifetimeMs: GRANT_LIFETIME_MS,
    callerPolicyStringAcceptedAsAuthority: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
    rawContentReported: false,
    hostPathReported: false,
  });
}
