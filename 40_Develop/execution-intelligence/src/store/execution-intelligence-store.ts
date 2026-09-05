import * as fs from "node:fs";
import * as path from "node:path";
import { createHash, randomUUID } from "node:crypto";

import {
  inspectExecutionIntelligenceEvent,
  summarizeExecutionIntelligence,
  type ExecutionIntelligenceEvent,
} from "../core/execution-intelligence.ts";

const MAXIMUM_EVENTS = 10_000;
const MAXIMUM_TOTAL_BYTES = 32 * 1024 * 1024;

function sha256(bytes: string | Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function checkedDirectory(repositoryRoot: string, shouldCreate: boolean) {
  const root = path.resolve(repositoryRoot);
  if (!fs.existsSync(root) || fs.lstatSync(root).isSymbolicLink())
    throw new Error("execution_store_root_invalid");
  let cursor = root;
  for (const segment of [".crdd", "execution", "events"]) {
    cursor = path.join(cursor, segment);
    if (!fs.existsSync(cursor)) {
      if (!shouldCreate) return null;
      fs.mkdirSync(cursor, { mode: 0o700 });
    }
    const status = fs.lstatSync(cursor);
    if (!status.isDirectory() || status.isSymbolicLink())
      throw new Error("execution_store_link_or_type_rejected");
  }
  return cursor;
}

export function writeExecutionIntelligenceEvent(
  repositoryRoot: string,
  value: unknown,
) {
  const event = inspectExecutionIntelligenceEvent(value);
  if (!event)
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_event_invalid" as const,
    });
  try {
    const directory = checkedDirectory(repositoryRoot, true);
    if (!directory) throw new Error("execution_store_directory_missing");
    const target = path.join(directory, `${event.eventId}.json`);
    const serialized = `${JSON.stringify(event)}\n`;
    if (fs.existsSync(target)) {
      const existing = fs.readFileSync(target);
      return existing.equals(Buffer.from(serialized, "utf8"))
        ? Object.freeze({
            status: "completed" as const,
            reason: "execution_event_already_recorded" as const,
            eventId: event.eventId,
          })
        : Object.freeze({
            status: "blocked" as const,
            reason: "execution_event_identity_conflict" as const,
          });
    }
    const temporary = path.join(
      directory,
      `.${event.eventId}.${randomUUID()}.pending`,
    );
    fs.writeFileSync(temporary, serialized, { flag: "wx", mode: 0o600 });
    fs.renameSync(temporary, target);
    const readBack = fs.readFileSync(target);
    if (!readBack.equals(Buffer.from(serialized, "utf8")))
      throw new Error("execution_event_readback_mismatch");
    return Object.freeze({
      status: "completed" as const,
      reason: "execution_event_recorded" as const,
      eventId: event.eventId,
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_event_store_unavailable" as const,
    });
  }
}

export function readExecutionIntelligence(repositoryRoot: string):
  | Readonly<{
      status: "completed";
      reason: "execution_events_observed";
      events: readonly ExecutionIntelligenceEvent[];
      hashes: Readonly<Record<string, string>>;
      summary: NonNullable<ReturnType<typeof summarizeExecutionIntelligence>>;
    }>
  | Readonly<{ status: "blocked"; reason: string }> {
  try {
    const directory = checkedDirectory(repositoryRoot, false);
    if (directory === null) {
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
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_event_store_observation_failed" as const,
    });
  }
}

export function applyExecutionIntelligenceRetention(
  repositoryRoot: string,
  request: Readonly<{
    eventHashes: Readonly<Record<string, string>>;
    unresolvedReferenceEventIds: readonly string[];
    durableEvidenceId: string;
  }>,
) {
  const removedEventIds: string[] = [];
  try {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(request.durableEvidenceId) ||
      request.unresolvedReferenceEventIds.length > 0 ||
      Object.keys(request.eventHashes).length === 0
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "execution_retention_not_safe" as const,
        removedEventIds: Object.freeze([]),
      });
    const observed = readExecutionIntelligence(repositoryRoot);
    if (observed.status !== "completed")
      return Object.freeze({
        status: "blocked" as const,
        reason: observed.reason,
        removedEventIds: Object.freeze([]),
      });
    const requestedIds = Object.keys(request.eventHashes).sort();
    if (
      requestedIds.some(
        (eventId) =>
          observed.hashes[eventId] !== request.eventHashes[eventId] ||
          !/^execution-[0-9a-f]{64}$/u.test(eventId),
      )
    )
      return Object.freeze({
        status: "blocked" as const,
        reason: "execution_retention_identity_mismatch" as const,
        removedEventIds: Object.freeze([]),
      });
    const directory = checkedDirectory(repositoryRoot, false);
    if (directory === null)
      throw new Error("execution_retention_directory_missing");
    const targets = requestedIds.map((eventId) => ({
      eventId,
      target: path.join(directory, `${eventId}.json`),
    }));
    for (const { eventId, target } of targets) {
      const status = fs.lstatSync(target);
      if (
        !status.isFile() ||
        status.isSymbolicLink() ||
        sha256(fs.readFileSync(target)) !== request.eventHashes[eventId]
      )
        throw new Error("execution_retention_fresh_identity_mismatch");
    }
    for (const { eventId, target } of targets) {
      fs.unlinkSync(target);
      if (fs.existsSync(target))
        throw new Error("execution_retention_absence_unconfirmed");
      removedEventIds.push(eventId);
    }
    return Object.freeze({
      status: "completed" as const,
      reason: "execution_events_removed_after_durable_evidence" as const,
      durableEvidenceId: request.durableEvidenceId,
      removedEventIds: Object.freeze(removedEventIds),
    });
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_retention_cleanup_failed" as const,
      removedEventIds: Object.freeze(removedEventIds),
    });
  }
}
