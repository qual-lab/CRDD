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
      cleanupConfirmed: true;
      retryAllowed: false;
      manualRecoveryRequired: false;
      residualArtifactIds: readonly [];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      effectState: "no_effect" | "settled" | "unknown";
      cleanupConfirmed: boolean;
      retryAllowed: boolean;
      manualRecoveryRequired: boolean;
      residualArtifactIds: readonly string[];
    }>;

type StoreLayout = Readonly<{
  executionDirectory: string;
  eventsDirectory: string;
}>;

type MutationLock = Readonly<{
  directory: string;
  owner: string;
  identity: string;
}>;

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
): StoreLayout | null {
  const repositoryRoot = resolveVerifiedExecutionRepositoryRoot(rootCapability);
  if (repositoryRoot === null)
    throw new Error("execution_store_root_capability_invalid");
  const crddDirectory = path.join(repositoryRoot, ".crdd");
  const executionDirectory = path.join(crddDirectory, "execution");
  const eventsDirectory = path.join(executionDirectory, "events");
  for (const directory of [
    crddDirectory,
    executionDirectory,
    eventsDirectory,
  ]) {
    if (!fs.existsSync(directory)) {
      if (!shouldCreate) return null;
      ensureDirectory(directory);
    } else if (!safeDirectory(directory))
      throw new Error("execution_store_link_or_type_rejected");
  }
  return Object.freeze({ executionDirectory, eventsDirectory });
}

function acquireMutationLock(layout: StoreLayout): MutationLock | null {
  const directory = path.join(layout.executionDirectory, ".mutation-lock");
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
): ExecutionIntelligencePublicationResult {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    effectState,
    cleanupConfirmed,
    retryAllowed,
    manualRecoveryRequired: !cleanupConfirmed,
    residualArtifactIds: Object.freeze([...residualArtifactIds]),
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
        cleanupConfirmed: true as const,
        retryAllowed: false as const,
        manualRecoveryRequired: false as const,
        residualArtifactIds: Object.freeze([]) as readonly [],
      })
    : blockedPublication(
        "execution_event_identity_conflict",
        "no_effect",
        true,
        [],
      );
}

export function writeExecutionIntelligenceEvent(
  rootCapability: VerifiedExecutionRepositoryRoot,
  value: unknown,
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
    const layout = storeLayout(rootCapability, true);
    if (!layout) throw new Error("execution_store_directory_missing");
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
    const boundaryResiduals =
      error instanceof MutationBoundaryError
        ? error.residualArtifactIds
        : Object.freeze([]);
    result = blockedPublication(
      error instanceof MutationBoundaryError
        ? error.message
        : "execution_event_store_unavailable",
      effectState,
      temporary === null && boundaryResiduals.length === 0,
      [
        ...(temporary === null ? [] : [path.basename(temporary)]),
        ...boundaryResiduals,
      ],
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

function readFromDirectory(directory: string) {
  const names = fs.readdirSync(directory).sort();
  if (names.length > MAXIMUM_EVENTS)
    throw new Error("execution_store_event_limit_exceeded");
  let totalBytes = 0;
  const events: ExecutionIntelligenceEvent[] = [];
  const hashes: Record<string, string> = {};
  for (const name of names) {
    if (!/^execution-[0-9a-f]{64}\.json$/u.test(name))
      throw new Error("execution_store_filename_invalid");
    const target = path.join(directory, name);
    const status = fs.lstatSync(target);
    if (!status.isFile() || status.isSymbolicLink())
      throw new Error("execution_store_entry_type_invalid");
    totalBytes += status.size;
    if (totalBytes > MAXIMUM_TOTAL_BYTES)
      throw new Error("execution_store_byte_limit_exceeded");
    const bytes = fs.readFileSync(target);
    const event = inspectExecutionIntelligenceEvent(
      JSON.parse(bytes.toString("utf8")),
    );
    if (!event || `${event.eventId}.json` !== name)
      throw new Error("execution_store_content_invalid");
    events.push(event);
    hashes[event.eventId] = sha256(bytes);
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

export function readExecutionIntelligence(
  rootCapability: VerifiedExecutionRepositoryRoot,
):
  | ReturnType<typeof readFromDirectory>
  | Readonly<{ status: "blocked"; reason: string }> {
  try {
    const layout = storeLayout(rootCapability, false);
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
    return readFromDirectory(layout.eventsDirectory);
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_event_store_observation_failed" as const,
    });
  }
}

export function applyExecutionIntelligenceRetention(
  rootCapability: VerifiedExecutionRepositoryRoot,
  request: Readonly<{
    eventHashes: Readonly<Record<string, string>>;
    unresolvedReferenceEventIds: readonly string[];
    durableEvidenceId: string;
  }>,
) {
  const removedEventIds: string[] = [];
  const remainingEventIds: string[] = [];
  const unobservableEventIds: string[] = [];
  let lock: MutationLock | null = null;
  let requestedIds: string[] = [];
  let result: Readonly<Record<string, unknown>> | null = null;
  try {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(request.durableEvidenceId) ||
      request.unresolvedReferenceEventIds.length > 0 ||
      Object.keys(request.eventHashes).length === 0
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "execution_retention_not_safe" as const,
        effectState: "no_effect" as const,
        cleanupConfirmed: true,
        removedEventIds: Object.freeze([]),
        remainingEventIds: Object.freeze([]),
        unobservableEventIds: Object.freeze([]),
      });
    const layout = storeLayout(rootCapability, false);
    if (layout === null)
      throw new Error("execution_retention_directory_missing");
    lock = acquireMutationLock(layout);
    if (!lock)
      return Object.freeze({
        status: "blocked" as const,
        reason: "execution_store_lock_unavailable" as const,
        effectState: "no_effect" as const,
        cleanupConfirmed: false,
        removedEventIds: Object.freeze([]),
        remainingEventIds: Object.freeze(
          Object.keys(request.eventHashes).sort(),
        ),
        unobservableEventIds: Object.freeze([]),
      });
    const observed = readFromDirectory(layout.eventsDirectory);
    requestedIds = Object.keys(request.eventHashes).sort();
    const hasIdentityMismatch = requestedIds.some(
      (eventId) =>
        observed.hashes[eventId] !== request.eventHashes[eventId] ||
        !/^execution-[0-9a-f]{64}$/u.test(eventId),
    );
    if (hasIdentityMismatch)
      result = Object.freeze({
        status: "blocked" as const,
        reason: "execution_retention_identity_mismatch" as const,
        effectState: "no_effect" as const,
        cleanupConfirmed: true,
        removedEventIds: Object.freeze([]),
        remainingEventIds: Object.freeze(requestedIds),
        unobservableEventIds: Object.freeze([]),
      });
    else {
      for (const eventId of requestedIds) {
        const target = path.join(layout.eventsDirectory, `${eventId}.json`);
        const before = fs.lstatSync(target);
        if (
          !before.isFile() ||
          before.isSymbolicLink() ||
          sha256(fs.readFileSync(target)) !== request.eventHashes[eventId]
        )
          throw new Error("execution_retention_fresh_identity_mismatch");
        fs.unlinkSync(target);
        if (fs.existsSync(target))
          throw new Error("execution_retention_absence_unconfirmed");
        removedEventIds.push(eventId);
      }
      result = Object.freeze({
        status: "completed" as const,
        reason: "execution_events_removed_after_durable_evidence" as const,
        durableEvidenceId: request.durableEvidenceId,
        effectState: "settled" as const,
        cleanupConfirmed: true,
        removedEventIds: Object.freeze([...removedEventIds]),
        remainingEventIds: Object.freeze([]),
        unobservableEventIds: Object.freeze([]),
      });
    }
  } catch (error) {
    for (const eventId of requestedIds) {
      if (removedEventIds.includes(eventId)) continue;
      try {
        const layout = storeLayout(rootCapability, false);
        const target = layout
          ? path.join(layout.eventsDirectory, `${eventId}.json`)
          : null;
        if (target !== null && fs.existsSync(target))
          remainingEventIds.push(eventId);
        else unobservableEventIds.push(eventId);
      } catch {
        unobservableEventIds.push(eventId);
      }
    }
    const boundaryResiduals =
      error instanceof MutationBoundaryError
        ? error.residualArtifactIds
        : Object.freeze([]);
    result = Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof MutationBoundaryError
          ? error.message
          : ("execution_retention_cleanup_failed" as const),
      effectState: removedEventIds.length === 0 ? "no_effect" : "unknown",
      cleanupConfirmed:
        unobservableEventIds.length === 0 && boundaryResiduals.length === 0,
      removedEventIds: Object.freeze([...removedEventIds]),
      remainingEventIds: Object.freeze(remainingEventIds),
      unobservableEventIds: Object.freeze([
        ...unobservableEventIds,
        ...boundaryResiduals,
      ]),
    });
  } finally {
    if (lock !== null && !releaseMutationLock(lock))
      result = Object.freeze({
        status: "blocked" as const,
        reason: "execution_retention_lock_release_unknown" as const,
        effectState: removedEventIds.length === 0 ? "no_effect" : "unknown",
        cleanupConfirmed: false,
        removedEventIds: Object.freeze([...removedEventIds]),
        remainingEventIds: Object.freeze(remainingEventIds),
        unobservableEventIds: Object.freeze([
          ...unobservableEventIds,
          "execution-store-mutation-lock",
        ]),
      });
  }
  return result;
}
