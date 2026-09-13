import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  inspectExecutionIntelligenceEvent,
  summarizeExecutionIntelligence,
  type ExecutionIntelligenceEvent,
} from "../core/execution-intelligence.ts";
import {
  resolveVerifiedExecutionRepositoryRoot,
  type VerifiedExecutionRepositoryRoot,
} from "./verified-repository-root.ts";
import {
  ensureRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-location.ts";

const MAXIMUM_EVENTS = 10_000;
const MAXIMUM_TOTAL_BYTES = 32 * 1024 * 1024;
const LOCK_ATTEMPTS = 200;
const LOCK_RETRY_MS = 10;
const waitArray = new Int32Array(new SharedArrayBuffer(4));

export type ExecutionIntelligencePublicationResult =
  | Readonly<{
      status: "completed";
      reason: "execution_event_recorded" | "execution_event_already_recorded";
      eventId: string;
      effectState: "settled";
      effectIssued: true;
      effectStateUnknown: false;
      cleanupConfirmed: true;
      retryAllowed: false;
      manualRecoveryRequired: false;
      residualArtifactIds: readonly [];
      recoveryReference: null;
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      effectState: "no_effect" | "settled" | "unknown";
      effectIssued: boolean;
      effectStateUnknown: boolean;
      cleanupConfirmed: boolean;
      retryAllowed: boolean;
      manualRecoveryRequired: boolean;
      residualArtifactIds: readonly string[];
      recoveryReference: string | null;
    }>;

type StoreLayout = Readonly<{
  executionDirectory: string;
  operationDirectory: string | null;
  eventsDirectory: string | null;
}>;

type MutationLock = Readonly<{
  directory: string;
  owner: string;
  identity: string;
}>;

type RuntimeDataAreaResolver = typeof ensureRepositoryRuntimeDataArea;

class MutationBoundaryError extends Error {
  readonly residualArtifactIds: readonly string[];

  constructor(reason: string, residualArtifactIds: readonly string[]) {
    super(reason);
    this.name = "MutationBoundaryError";
    this.residualArtifactIds = Object.freeze([...residualArtifactIds]);
  }
}

function sha256(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function samePath(left: string, right: string): boolean {
  const normalizedLeft = path.normalize(left);
  const normalizedRight = path.normalize(right);
  return process.platform === "win32"
    ? normalizedLeft.toLocaleLowerCase("en-US") ===
        normalizedRight.toLocaleLowerCase("en-US")
    : normalizedLeft === normalizedRight;
}

function safeDirectory(directory: string): boolean {
  const metadata = fs.lstatSync(directory);
  return (
    metadata.isDirectory() &&
    !metadata.isSymbolicLink() &&
    samePath(fs.realpathSync.native(directory), path.resolve(directory))
  );
}

function ensureDirectory(directory: string): void {
  try {
    fs.mkdirSync(directory, { mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
  if (!safeDirectory(directory))
    throw new Error("execution_store_link_or_type_rejected");
}

function storeLayout(
  rootCapability: VerifiedExecutionRepositoryRoot,
  shouldCreate: boolean,
  operationId: string | null = null,
  resolveArea: RuntimeDataAreaResolver = ensureRepositoryRuntimeDataArea,
): StoreLayout | null {
  const repositoryRoot = resolveVerifiedExecutionRepositoryRoot(rootCapability);
  if (repositoryRoot === null)
    throw new Error("execution_store_root_capability_invalid");
  let observedArea = resolveArea(
    rootCapability as VerifiedRepositoryRoot,
    "execution",
  );
  for (
    let attempt = 0;
    observedArea?.status === "blocked" &&
    observedArea.retryAllowed &&
    attempt < LOCK_ATTEMPTS;
    attempt += 1
  ) {
    Atomics.wait(waitArray, 0, 0, LOCK_RETRY_MS);
    observedArea = resolveArea(
      rootCapability as VerifiedRepositoryRoot,
      "execution",
    );
  }
  const area = requireReadyRepositoryRuntimeDataArea(
    observedArea,
    "execution_store_root_capability_invalid",
  );
  if (area.repositoryRoot !== repositoryRoot)
    throw new Error("execution_store_root_capability_invalid");
  const executionDirectory = area.directory;
  const operationDirectory =
    operationId === null ? null : path.join(executionDirectory, operationId);
  const eventsDirectory =
    operationDirectory === null
      ? null
      : path.join(operationDirectory, "events");
  for (const directory of [
    executionDirectory,
    operationDirectory,
    eventsDirectory,
  ].filter((value): value is string => value !== null)) {
    if (!fs.existsSync(directory)) {
      if (!shouldCreate) return null;
      ensureDirectory(directory);
    } else if (!safeDirectory(directory))
      throw new Error("execution_store_link_or_type_rejected");
  }
  return Object.freeze({
    executionDirectory,
    operationDirectory,
    eventsDirectory,
  });
}

function acquireMutationLock(layout: StoreLayout): MutationLock | null {
  if (layout.operationDirectory === null)
    throw new Error("execution_store_operation_directory_missing");
  const directory = path.join(layout.operationDirectory, ".mutation-lock");
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt += 1) {
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") throw error;
      if (!safeDirectory(directory))
        throw new Error("execution_store_lock_boundary_invalid");
      Atomics.wait(waitArray, 0, 0, LOCK_RETRY_MS);
      continue;
    }

    const identity = randomUUID();
    const owner = path.join(directory, "owner.json");
    try {
      const descriptor = fs.openSync(owner, "wx", 0o600);
      try {
        fs.writeFileSync(
          descriptor,
          `${JSON.stringify({ contract: "crdd/execution-store-lock/v1", identity })}\n`,
          "utf8",
        );
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      return Object.freeze({ directory, owner, identity });
    } catch {
      let cleanupConfirmed = false;
      try {
        if (fs.existsSync(owner)) fs.unlinkSync(owner);
        if (fs.existsSync(directory)) fs.rmdirSync(directory);
        cleanupConfirmed = !fs.existsSync(directory);
      } catch {
        cleanupConfirmed = false;
      }
      throw new MutationBoundaryError(
        "execution_store_lock_initialization_failed",
        cleanupConfirmed ? [] : ["execution-store-mutation-lock"],
      );
    }
  }
  return null;
}

function releaseMutationLock(lock: MutationLock): boolean {
  try {
    const parsed = JSON.parse(fs.readFileSync(lock.owner, "utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      (parsed as { identity?: unknown }).identity !== lock.identity
    )
      return false;
    fs.unlinkSync(lock.owner);
    fs.rmdirSync(lock.directory);
    return !fs.existsSync(lock.directory);
  } catch {
    return false;
  }
}

function blockedPublication(
  reason: string,
  effectState: "no_effect" | "settled" | "unknown",
  cleanupConfirmed: boolean,
  residualArtifactIds: readonly string[],
  retryAllowed = false,
  boundary: Readonly<{
    effectIssued?: boolean;
    effectStateUnknown?: boolean;
    recoveryReference?: string | null;
  }> = {},
): ExecutionIntelligencePublicationResult {
  const effectStateUnknown =
    boundary.effectStateUnknown ?? effectState === "unknown";
  const recoveryReference = boundary.recoveryReference ?? null;
  return Object.freeze({
    status: "blocked" as const,
    reason,
    effectState,
    effectIssued: boundary.effectIssued ?? effectState !== "no_effect",
    effectStateUnknown,
    cleanupConfirmed,
    retryAllowed,
    manualRecoveryRequired:
      effectStateUnknown || !cleanupConfirmed || recoveryReference !== null,
    residualArtifactIds: Object.freeze([...residualArtifactIds]),
    recoveryReference,
  });
}

function existingPublication(
  target: string,
  expected: Buffer,
  eventId: string,
): ExecutionIntelligencePublicationResult {
  const existing = fs.readFileSync(target);
  return existing.equals(expected)
    ? Object.freeze({
        status: "completed" as const,
        reason: "execution_event_already_recorded" as const,
        eventId,
        effectState: "settled" as const,
        effectIssued: true as const,
        effectStateUnknown: false as const,
        cleanupConfirmed: true as const,
        retryAllowed: false as const,
        manualRecoveryRequired: false as const,
        residualArtifactIds: Object.freeze([]) as readonly [],
        recoveryReference: null,
      })
    : blockedPublication(
        "execution_event_identity_conflict",
        "no_effect",
        true,
        [],
      );
}

export function writeExecutionIntelligenceEventWithRuntimeDataArea(
  rootCapability: VerifiedExecutionRepositoryRoot,
  value: unknown,
  resolveArea: RuntimeDataAreaResolver,
): ExecutionIntelligencePublicationResult {
  const event = inspectExecutionIntelligenceEvent(value);
  if (!event)
    return blockedPublication("execution_event_invalid", "no_effect", true, []);
  let lock: MutationLock | null = null;
  let temporary: string | null = null;
  let target: string | null = null;
  let expected: Buffer | null = null;
  let result: ExecutionIntelligencePublicationResult | null = null;
  let lockReleased = true;
  try {
    const layout = storeLayout(
      rootCapability,
      true,
      event.identity.operationId,
      resolveArea,
    );
    if (!layout) throw new Error("execution_store_directory_missing");
    if (layout.eventsDirectory === null)
      throw new Error("execution_store_events_directory_missing");
    lock = acquireMutationLock(layout);
    if (!lock)
      return blockedPublication(
        "execution_store_lock_unavailable",
        "no_effect",
        false,
        ["execution-store-mutation-lock"],
        true,
      );
    target = path.join(layout.eventsDirectory, `${event.eventId}.json`);
    expected = Buffer.from(`${JSON.stringify(event)}\n`, "utf8");
    if (fs.existsSync(target))
      result = existingPublication(target, expected, event.eventId);
    else {
      const temporaryIdentity = `execution-pending-${randomUUID()}`;
      temporary = path.join(layout.eventsDirectory, `.${temporaryIdentity}`);
      const descriptor = fs.openSync(temporary, "wx", 0o600);
      try {
        fs.writeFileSync(descriptor, expected);
        fs.fsyncSync(descriptor);
      } finally {
        fs.closeSync(descriptor);
      }
      try {
        fs.linkSync(temporary, target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      result = existingPublication(target, expected, event.eventId);
      fs.unlinkSync(temporary);
      temporary = null;
      if (result.status === "completed")
        result = Object.freeze({
          ...result,
          reason: "execution_event_recorded" as const,
        });
    }
  } catch (error) {
    let effectState: "no_effect" | "settled" | "unknown" = "no_effect";
    if (target !== null && expected !== null) {
      try {
        if (fs.existsSync(target) && fs.readFileSync(target).equals(expected))
          effectState = "settled";
      } catch {
        effectState = "unknown";
      }
    }
    const runtimeDataFailure =
      error instanceof RepositoryRuntimeDataAreaBlockedError ? error : null;
    const boundaryResiduals =
      error instanceof MutationBoundaryError
        ? error.residualArtifactIds
        : Object.freeze([]);
    result = blockedPublication(
      runtimeDataFailure?.reason ??
        (error instanceof MutationBoundaryError
          ? error.message
          : "execution_event_store_unavailable"),
      runtimeDataFailure?.effectStateUnknown
        ? "unknown"
        : runtimeDataFailure?.effectIssued
          ? "settled"
          : effectState,
      runtimeDataFailure?.cleanupConfirmed ??
        (temporary === null && boundaryResiduals.length === 0),
      [
        ...(temporary === null ? [] : [path.basename(temporary)]),
        ...boundaryResiduals,
      ],
      runtimeDataFailure?.retryAllowed ?? false,
      runtimeDataFailure
        ? {
            effectIssued: runtimeDataFailure.effectIssued,
            effectStateUnknown: runtimeDataFailure.effectStateUnknown,
            recoveryReference: runtimeDataFailure.recoveryReference,
          }
        : {},
    );
  } finally {
    if (temporary !== null) {
      try {
        if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
        temporary = null;
      } catch {
        // The closed result below preserves the residual identity.
      }
    }
    if (lock !== null) {
      lockReleased = releaseMutationLock(lock);
      if (!lockReleased || temporary !== null)
        result = blockedPublication(
          "execution_event_store_cleanup_unknown",
          result?.effectState ?? "unknown",
          false,
          [
            ...(temporary === null ? [] : [path.basename(temporary)]),
            ...(lockReleased ? [] : ["execution-store-mutation-lock"]),
          ],
        );
    }
  }
  if (
    result?.status === "blocked" &&
    temporary === null &&
    lockReleased &&
    result.reason === "execution_event_store_unavailable"
  )
    result = blockedPublication(result.reason, result.effectState, true, []);
  return (
    result ??
    blockedPublication(
      "execution_event_store_observation_unknown",
      "unknown",
      false,
      ["execution-store-mutation-lock"],
    )
  );
}

export function writeExecutionIntelligenceEvent(
  rootCapability: VerifiedExecutionRepositoryRoot,
  value: unknown,
): ExecutionIntelligencePublicationResult {
  return writeExecutionIntelligenceEventWithRuntimeDataArea(
    rootCapability,
    value,
    ensureRepositoryRuntimeDataArea,
  );
}

function readFromExecutionDirectory(directory: string) {
  const events: ExecutionIntelligenceEvent[] = [];
  const hashes: Record<string, string> = {};
  let totalBytes = 0;
  for (const operationId of fs.readdirSync(directory).sort()) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(operationId))
      throw new Error("execution_store_operation_directory_invalid");
    const operationDirectory = path.join(directory, operationId);
    if (!safeDirectory(operationDirectory))
      throw new Error("execution_store_operation_directory_invalid");
    const names = fs.readdirSync(operationDirectory).sort();
    if (names.length !== 1 || names[0] !== "events")
      throw new Error("execution_store_operation_shape_invalid");
    const eventsDirectory = path.join(operationDirectory, "events");
    if (!safeDirectory(eventsDirectory))
      throw new Error("execution_store_event_directory_invalid");
    for (const name of fs.readdirSync(eventsDirectory).sort()) {
      if (!/^execution-[0-9a-f]{64}\.json$/u.test(name))
        throw new Error("execution_store_filename_invalid");
      const target = path.join(eventsDirectory, name);
      const status = fs.lstatSync(target);
      if (!status.isFile() || status.isSymbolicLink())
        throw new Error("execution_store_entry_type_invalid");
      totalBytes += status.size;
      if (events.length >= MAXIMUM_EVENTS)
        throw new Error("execution_store_event_limit_exceeded");
      if (totalBytes > MAXIMUM_TOTAL_BYTES)
        throw new Error("execution_store_byte_limit_exceeded");
      const bytes = fs.readFileSync(target);
      const event = inspectExecutionIntelligenceEvent(
        JSON.parse(bytes.toString("utf8")),
      );
      if (
        !event ||
        `${event.eventId}.json` !== name ||
        event.identity.operationId !== operationId
      )
        throw new Error("execution_store_content_invalid");
      events.push(event);
      hashes[event.eventId] = sha256(bytes);
    }
  }
  const summary = summarizeExecutionIntelligence(events);
  if (!summary) throw new Error("execution_summary_invalid");
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_events_observed" as const,
    events: Object.freeze(events),
    hashes: Object.freeze(hashes),
    summary,
  });
}

export function readExecutionIntelligenceWithRuntimeDataArea(
  rootCapability: VerifiedExecutionRepositoryRoot,
  resolveArea: RuntimeDataAreaResolver,
):
  | ReturnType<typeof readFromExecutionDirectory>
  | Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }> {
  try {
    const layout = storeLayout(rootCapability, false, null, resolveArea);
    if (layout === null) {
      const emptySummary = summarizeExecutionIntelligence([]);
      if (!emptySummary) throw new Error("execution_empty_summary_invalid");
      return Object.freeze({
        status: "completed" as const,
        reason: "execution_events_observed" as const,
        events: Object.freeze([]),
        hashes: Object.freeze({}),
        summary: emptySummary,
      });
    }
    return readFromExecutionDirectory(layout.executionDirectory);
  } catch (error) {
    const runtimeDataFailure =
      error instanceof RepositoryRuntimeDataAreaBlockedError ? error : null;
    return blockedPublication(
      runtimeDataFailure?.reason ?? "execution_event_store_observation_failed",
      runtimeDataFailure?.effectStateUnknown
        ? "unknown"
        : runtimeDataFailure?.effectIssued
          ? "settled"
          : "no_effect",
      runtimeDataFailure?.cleanupConfirmed ?? true,
      [],
      runtimeDataFailure?.retryAllowed ?? false,
      runtimeDataFailure
        ? {
            effectIssued: runtimeDataFailure.effectIssued,
            effectStateUnknown: runtimeDataFailure.effectStateUnknown,
            recoveryReference: runtimeDataFailure.recoveryReference,
          }
        : {},
    ) as Extract<ExecutionIntelligencePublicationResult, { status: "blocked" }>;
  }
}

export function readExecutionIntelligence(
  rootCapability: VerifiedExecutionRepositoryRoot,
) {
  return readExecutionIntelligenceWithRuntimeDataArea(
    rootCapability,
    ensureRepositoryRuntimeDataArea,
  );
}
