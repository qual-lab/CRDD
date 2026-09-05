import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { StringDecoder } from "node:string_decoder";

import { startOwnedWindowsProcessTreeTermination } from "../src/security/docker-owned-process.ts";
import { inspectMcpProjectRuntimeObjectiveResult } from "../src/security/mcp-project-runtime-adapter.ts";
import { inspectRepositoryIdentityCandidate } from "../src/security/repository-operation-runtime.ts";

export type JsonRecord = Readonly<Record<string, unknown>>;

type SelectionRuntimeEvent = Readonly<{
  event: "selection";
  taskRole: "executor" | "reviewer";
  provider: "codex" | "claude";
  operationId: null;
}>;
type ProcessStartedRuntimeEvent = Readonly<{
  event: "process_started";
  taskRole: "executor" | "reviewer";
  provider: "codex" | "claude";
  operationId: string;
}>;
export type VerifiedRuntimeEvent =
  | SelectionRuntimeEvent
  | ProcessStartedRuntimeEvent;
type RecoveryEvent = Readonly<{
  phase:
    | "required"
    | "recovering"
    | "settled"
    | "acknowledged"
    | "verification_resources_finalized"
    | "queue_settled"
    | "retry_ready";
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskId: string | null;
  operationId: string | null;
  recoveryId: string | null;
  stateGeneration: number;
}>;

const PROJECT_OPERATION_ID = /^operation-[a-f0-9]{40}$/u;

export type PublicProcessObservation = Readonly<{
  exit: Readonly<{ code: number | null; signal: string | null }> | null;
  launchError: string | null;
  responses: readonly unknown[];
  parseFailure: boolean;
  outputWithinLimit: boolean;
  timedOut: boolean;
  inputEofIssued: boolean;
  forcedTerminationIssued: boolean;
  processTreeTerminationAttempted: boolean;
  processTreeTerminationConfirmed: boolean;
  processTreeTerminationTriggerEvent: ProcessStartedRuntimeEvent | null;
  inputCloseTriggerEvent: VerifiedRuntimeEvent | null;
  joined: boolean;
  runtimeEventProtocolViolation: boolean;
  selectionEventObserved: boolean;
  selectionEvents: readonly Readonly<{
    taskRole: "executor" | "reviewer";
    provider: "codex" | "claude";
  }>[];
  processStartEventObserved: boolean;
  processStartEvents: readonly Readonly<{
    taskRole: "executor" | "reviewer";
    provider: "codex" | "claude";
    operationId: string;
  }>[];
  runtimeEvents: readonly VerifiedRuntimeEvent[];
  recoveryEvents: readonly RecoveryEvent[];
  pidIssued: boolean;
  streamFailure: boolean;
}>;

const SELECTION_PREFIX = "[Coordinator selection] ";
const LIFECYCLE_PREFIX = "[Coordinator lifecycle] ";
const RECOVERY_PREFIX = "[Project Runtime recovery] ";
const KNOWN_PREFIXES = Object.freeze([
  SELECTION_PREFIX,
  LIFECYCLE_PREFIX,
  RECOVERY_PREFIX,
]);
const SELECTION_KEYS = Object.freeze([
  "callerDeclaredAttributes",
  "effort",
  "event",
  "highCostSelectionAllowed",
  "inputBasis",
  "model",
  "provider",
  "selectionReason",
  "speedMode",
  "taskRole",
]);
const LIFECYCLE_KEYS = Object.freeze([
  "event",
  "operationId",
  "provider",
  "taskRole",
]);
const RECOVERY_KEYS = Object.freeze([
  "event",
  "milestoneId",
  "operationId",
  "phase",
  "projectId",
  "queueId",
  "recoveryId",
  "stateGeneration",
  "taskId",
]);
const CALLER_DECLARED_ATTRIBUTES = Object.freeze([
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
]);
const RECOVERY_PHASES = new Set<RecoveryEvent["phase"]>([
  "required",
  "recovering",
  "settled",
  "acknowledged",
  "verification_resources_finalized",
  "queue_settled",
  "retry_ready",
]);

function exactKeys(record: JsonRecord, keys: readonly string[]) {
  return (
    Object.keys(record).length === keys.length &&
    Object.keys(record)
      .sort()
      .every((key, index) => key === keys[index])
  );
}
function closedId(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}
function role(value: unknown): value is "executor" | "reviewer" {
  return value === "executor" || value === "reviewer";
}
function provider(value: unknown): value is "codex" | "claude" {
  return value === "codex" || value === "claude";
}
function parseJsonRecord(value: string): JsonRecord | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as JsonRecord)
      : null;
  } catch {
    return null;
  }
}

function parseKnownDiagnosticLine(
  line: string,
):
  | Readonly<{ kind: "ignored" }>
  | Readonly<{ kind: "violation" }>
  | Readonly<{ kind: "runtime"; event: VerifiedRuntimeEvent }>
  | Readonly<{ kind: "recovery"; event: RecoveryEvent }> {
  const prefix = KNOWN_PREFIXES.find((candidate) => line.startsWith(candidate));
  if (!prefix) return Object.freeze({ kind: "ignored" as const });
  const parsed = parseJsonRecord(line.slice(prefix.length));
  if (!parsed) return Object.freeze({ kind: "violation" as const });
  if (prefix === SELECTION_PREFIX) {
    const attributes = parsed.callerDeclaredAttributes;
    if (
      !exactKeys(parsed, SELECTION_KEYS) ||
      parsed.event !== "coordinator_selection_before_provider_effect" ||
      !role(parsed.taskRole) ||
      !provider(parsed.provider) ||
      typeof parsed.model !== "string" ||
      parsed.model.length < 1 ||
      parsed.model.length > 128 ||
      typeof parsed.effort !== "string" ||
      parsed.effort.length < 1 ||
      parsed.effort.length > 32 ||
      typeof parsed.speedMode !== "string" ||
      parsed.speedMode.length < 1 ||
      parsed.speedMode.length > 32 ||
      typeof parsed.selectionReason !== "string" ||
      parsed.selectionReason.length < 1 ||
      parsed.selectionReason.length > 16_384 ||
      parsed.inputBasis !==
        "caller_declared_task_attributes_plus_runtime_owned_preselection_candidate_with_deferred_provider_preflight" ||
      !Array.isArray(attributes) ||
      attributes.length !== CALLER_DECLARED_ATTRIBUTES.length ||
      !attributes.every(
        (value, index) => value === CALLER_DECLARED_ATTRIBUTES[index],
      ) ||
      parsed.highCostSelectionAllowed !== false
    )
      return Object.freeze({ kind: "violation" as const });
    return Object.freeze({
      kind: "runtime" as const,
      event: Object.freeze({
        event: "selection" as const,
        taskRole: parsed.taskRole,
        provider: parsed.provider,
        operationId: null,
      }),
    });
  }
  if (prefix === LIFECYCLE_PREFIX) {
    if (
      !exactKeys(parsed, LIFECYCLE_KEYS) ||
      parsed.event !== "coordinator_provider_process_started" ||
      !role(parsed.taskRole) ||
      !provider(parsed.provider) ||
      typeof parsed.operationId !== "string" ||
      !/^OP-[0-9]{6,}$/u.test(parsed.operationId)
    )
      return Object.freeze({ kind: "violation" as const });
    return Object.freeze({
      kind: "runtime" as const,
      event: Object.freeze({
        event: "process_started" as const,
        taskRole: parsed.taskRole,
        provider: parsed.provider,
        operationId: parsed.operationId,
      }),
    });
  }
  if (
    !exactKeys(parsed, RECOVERY_KEYS) ||
    parsed.event !== "project_runtime_recovery_transition" ||
    typeof parsed.phase !== "string" ||
    !RECOVERY_PHASES.has(parsed.phase as RecoveryEvent["phase"]) ||
    !closedId(parsed.projectId, 128) ||
    !closedId(parsed.milestoneId, 128) ||
    !closedId(parsed.queueId, 128) ||
    !(parsed.taskId === null || closedId(parsed.taskId, 128)) ||
    !(
      parsed.operationId === null ||
      (typeof parsed.operationId === "string" &&
        PROJECT_OPERATION_ID.test(parsed.operationId))
    ) ||
    !(
      parsed.recoveryId === null ||
      (typeof parsed.recoveryId === "string" &&
        /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
          parsed.recoveryId,
        ))
    ) ||
    !Number.isSafeInteger(parsed.stateGeneration) ||
    Number(parsed.stateGeneration) < 1
  )
    return Object.freeze({ kind: "violation" as const });
  return Object.freeze({
    kind: "recovery" as const,
    event: Object.freeze({
      phase: parsed.phase as RecoveryEvent["phase"],
      projectId: parsed.projectId,
      milestoneId: parsed.milestoneId,
      queueId: parsed.queueId,
      taskId: parsed.taskId as string | null,
      operationId: parsed.operationId as string | null,
      recoveryId: parsed.recoveryId as string | null,
      stateGeneration: Number(parsed.stateGeneration),
    }),
  });
}

export async function observePublicMcpProcess(
  child: ChildProcessWithoutNullStreams,
  options: Readonly<{
    maximumOutputBytes: number;
    timeoutMs: number;
    terminationGraceMs?: number;
    closeInputWhen?: (output: Readonly<{ stdout: string }>) => boolean;
    onVerifiedRuntimeEvent?: (
      event: VerifiedRuntimeEvent,
    ) => "continue" | "close_input" | "terminate_process_tree";
    startProcessTreeTermination?: typeof startOwnedWindowsProcessTreeTermination;
  }>,
): Promise<PublicProcessObservation> {
  let stdout = "";
  let launchError: string | null = null;
  let isOutputWithinLimit = true;
  let isTimedOut = false;
  let inputEofIssued = false;
  let forcedTerminationIssued = false;
  let isProcessTreeTerminationAttempted = false;
  let processTreeTerminationConfirmed = false;
  let processTreeTerminationTriggerEvent: ProcessStartedRuntimeEvent | null =
    null;
  let inputCloseTriggerEvent: VerifiedRuntimeEvent | null = null;
  let isRuntimeEventProtocolViolation = false;
  let isStreamFailure = false;
  let terminationCompletion: Promise<boolean> | null = null;
  const pidIssued = Number.isSafeInteger(child.pid) && Number(child.pid) > 0;
  const grace = options.terminationGraceMs ?? 5_000;
  const absoluteFinalDeadline = Date.now() + options.timeoutMs + grace * 2;
  const remainingToFinalDeadline = () =>
    Math.max(0, absoluteFinalDeadline - Date.now());
  const stdoutDecoder = new StringDecoder("utf8");
  const stderrDecoder = new StringDecoder("utf8");
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let stderrPending = "";
  const selectionEvents: Readonly<{
    taskRole: "executor" | "reviewer";
    provider: "codex" | "claude";
  }>[] = [];
  const processStartEvents: Readonly<{
    taskRole: "executor" | "reviewer";
    provider: "codex" | "claude";
    operationId: string;
  }>[] = [];
  const runtimeEvents: VerifiedRuntimeEvent[] = [];
  const recoveryEvents: RecoveryEvent[] = [];

  const closeInput = () => {
    if (inputEofIssued) return;
    inputEofIssued = true;
    try {
      child.stdin.end();
    } catch {
      isStreamFailure = true;
    }
  };
  const terminateProcessTree = (event: ProcessStartedRuntimeEvent) => {
    if (
      forcedTerminationIssued ||
      isProcessTreeTerminationAttempted ||
      !pidIssued
    )
      return;
    isProcessTreeTerminationAttempted = true;
    processTreeTerminationTriggerEvent = event;
    terminationCompletion = (async () => {
      try {
        const killer = (
          options.startProcessTreeTermination ??
          startOwnedWindowsProcessTreeTermination
        )(Number(child.pid));
        if (!killer) return false;
        forcedTerminationIssued = await killer.started(
          Math.min(grace, remainingToFinalDeadline()),
        );
        if (!forcedTerminationIssued) {
          await killer.terminateAndWait(
            Math.min(grace, remainingToFinalDeadline()),
          );
          return false;
        }
        const result = await killer.wait(
          Math.min(grace, remainingToFinalDeadline()),
        );
        if (!result) {
          await killer.terminateAndWait(
            Math.min(grace, remainingToFinalDeadline()),
          );
          return false;
        }
        processTreeTerminationConfirmed =
          result.status === 0 &&
          result.signal === null &&
          !result.outputExceeded &&
          killer.closed();
        return processTreeTerminationConfirmed;
      } catch {
        isStreamFailure = true;
        return false;
      }
    })();
  };
  const acceptDiagnosticLine = (line: string) => {
    const parsed = parseKnownDiagnosticLine(
      line.endsWith("\r") ? line.slice(0, -1) : line,
    );
    if (parsed.kind === "violation") {
      isRuntimeEventProtocolViolation = true;
      return;
    }
    if (parsed.kind === "ignored") return;
    if (parsed.kind === "recovery") {
      recoveryEvents.push(parsed.event);
      return;
    }
    const event = parsed.event;
    runtimeEvents.push(event);
    if (event.event === "selection")
      selectionEvents.push(
        Object.freeze({ taskRole: event.taskRole, provider: event.provider }),
      );
    else
      processStartEvents.push(
        Object.freeze({
          taskRole: event.taskRole,
          provider: event.provider,
          operationId: event.operationId,
        }),
      );
    if (
      isRuntimeEventProtocolViolation ||
      inputCloseTriggerEvent ||
      processTreeTerminationTriggerEvent
    )
      return;
    try {
      const action = options.onVerifiedRuntimeEvent?.(event) ?? "continue";
      if (action === "close_input") {
        inputCloseTriggerEvent = event;
        closeInput();
      } else if (action === "terminate_process_tree") {
        if (event.event !== "process_started") {
          isRuntimeEventProtocolViolation = true;
          return;
        }
        terminateProcessTree(event);
      }
    } catch {
      isStreamFailure = true;
      closeInput();
    }
  };
  const accept = (stream: "stdout" | "stderr", chunk: Buffer) => {
    const currentBytes = stream === "stdout" ? stdoutBytes : stderrBytes;
    if (currentBytes + chunk.byteLength > options.maximumOutputBytes) {
      isOutputWithinLimit = false;
      closeInput();
      return;
    }
    if (stream === "stdout") {
      stdoutBytes += chunk.byteLength;
      stdout += stdoutDecoder.write(chunk);
    } else {
      stderrBytes += chunk.byteLength;
      const decoded = stderrDecoder.write(chunk);
      stderrPending += decoded;
      let newline = stderrPending.indexOf("\n");
      while (newline >= 0) {
        acceptDiagnosticLine(stderrPending.slice(0, newline));
        stderrPending = stderrPending.slice(newline + 1);
        newline = stderrPending.indexOf("\n");
      }
    }
    try {
      if (options.closeInputWhen?.({ stdout })) closeInput();
    } catch {
      closeInput();
    }
  };
  const onStdoutData = (chunk: Buffer) => accept("stdout", chunk);
  const onStderrData = (chunk: Buffer) => accept("stderr", chunk);
  const onStreamError = () => {
    if (!isProcessTreeTerminationAttempted) {
      isStreamFailure = true;
      closeInput();
    }
  };
  const onChildError = (error: Error) => {
    launchError = error instanceof Error ? error.name : "unknown";
  };
  child.stdout.on("data", onStdoutData);
  child.stderr.on("data", onStderrData);
  for (const stream of [child.stdin, child.stdout, child.stderr])
    stream.on("error", onStreamError);
  child.once("error", onChildError);

  let primaryTimer: ReturnType<typeof setTimeout> | null = null;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
  let finalTimer: ReturnType<typeof setTimeout> | null = null;
  let closeSettled = false;
  let resolveClosed:
    | ((
        value: Readonly<{ code: number | null; signal: string | null }> | null,
      ) => void)
    | null = null;
  const streams = [child.stdin, child.stdout, child.stderr] as const;
  const clearOwnedTimers = () => {
    if (primaryTimer) clearTimeout(primaryTimer);
    if (cleanupTimer) clearTimeout(cleanupTimer);
    if (finalTimer) clearTimeout(finalTimer);
    primaryTimer = null;
    cleanupTimer = null;
    finalTimer = null;
  };
  const detachResultObservation = () => {
    child.stdout.off("data", onStdoutData);
    child.stderr.off("data", onStderrData);
    for (const stream of streams) stream.off("error", onStreamError);
    child.off("error", onChildError);
    child.off("close", onChildClose);
  };
  const transferToTerminalErrorSinks = () => {
    const childErrorSink = () => {};
    child.on("error", childErrorSink);
    child.once("close", () => child.off("error", childErrorSink));
    for (const stream of streams) {
      if (stream.closed) continue;
      const errorSink = () => {};
      const releaseSink = () => stream.off("error", errorSink);
      stream.on("error", errorSink);
      stream.once("close", releaseSink);
      if (!stream.destroyed) stream.destroy();
    }
  };
  const settleCloseObservation = (
    value: Readonly<{ code: number | null; signal: string | null }> | null,
  ) => {
    if (closeSettled) return;
    closeSettled = true;
    clearOwnedTimers();
    detachResultObservation();
    if (value === null) transferToTerminalErrorSinks();
    resolveClosed?.(value);
  };
  function onChildClose(code: number | null, signal: string | null) {
    settleCloseObservation({ code, signal });
  }
  const closed = new Promise<Readonly<{
    code: number | null;
    signal: string | null;
  }> | null>((resolve) => {
    resolveClosed = resolve;
    child.once("close", onChildClose);
  });
  primaryTimer = setTimeout(() => {
    isTimedOut = true;
    closeInput();
    cleanupTimer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          forcedTerminationIssued = child.kill();
        } catch {
          isStreamFailure = true;
        }
      }
      finalTimer = setTimeout(
        () => settleCloseObservation(null),
        remainingToFinalDeadline(),
      );
    }, grace);
  }, options.timeoutMs);
  const exit = await closed;
  if (terminationCompletion) {
    const remaining = remainingToFinalDeadline();
    if (remaining > 0) {
      let helperDeadline: ReturnType<typeof setTimeout> | null = null;
      await Promise.race([
        terminationCompletion,
        new Promise<boolean>((resolve) => {
          helperDeadline = setTimeout(() => resolve(false), remaining);
        }),
      ]).finally(() => {
        if (helperDeadline) clearTimeout(helperDeadline);
      });
    }
  }
  stdout += stdoutDecoder.end();
  const stderrEnd = stderrDecoder.end();
  stderrPending += stderrEnd;
  if (stderrPending.length > 0) {
    if (KNOWN_PREFIXES.some((prefix) => stderrPending.startsWith(prefix)))
      isRuntimeEventProtocolViolation = true;
    stderrPending = "";
  }

  const responses: unknown[] = [];
  let isParseFailure = false;
  for (const line of stdout.split(/\r?\n/u).filter(Boolean)) {
    try {
      responses.push(JSON.parse(line) as unknown);
    } catch {
      isParseFailure = true;
    }
  }
  return Object.freeze({
    exit,
    launchError,
    responses: Object.freeze(responses),
    parseFailure: isParseFailure,
    outputWithinLimit: isOutputWithinLimit,
    timedOut: isTimedOut,
    inputEofIssued,
    forcedTerminationIssued,
    processTreeTerminationAttempted: isProcessTreeTerminationAttempted,
    processTreeTerminationConfirmed,
    processTreeTerminationTriggerEvent,
    inputCloseTriggerEvent,
    joined: exit !== null,
    runtimeEventProtocolViolation: isRuntimeEventProtocolViolation,
    selectionEventObserved: selectionEvents.length > 0,
    selectionEvents: Object.freeze(selectionEvents),
    processStartEventObserved: processStartEvents.length > 0,
    processStartEvents: Object.freeze(processStartEvents),
    runtimeEvents: Object.freeze(runtimeEvents),
    recoveryEvents: Object.freeze(recoveryEvents),
    pidIssued,
    streamFailure: isStreamFailure,
  });
}

export function captureCanonicalRepositorySnapshot(repositoryRoot: string) {
  const root = fs.realpathSync.native(repositoryRoot);
  const identity = inspectRepositoryIdentityCandidate(root);
  if (!identity) throw new Error("canonical_repository_identity_unavailable");
  const excludedDirectoryNames = Object.freeze([
    ".crdd",
    ".git",
    "coverage",
    "node_modules",
    "target",
  ]);
  const excluded = new Set(excludedDirectoryNames);
  const fileHashes: { relativePath: string; sha256: string }[] = [];
  const walk = (directory: string, prefix: string) => {
    for (const name of fs.readdirSync(directory).sort()) {
      if (excluded.has(name)) continue;
      const absolutePath = path.join(directory, name);
      const relativePath = prefix ? `${prefix}/${name}` : name;
      const metadata = fs.lstatSync(absolutePath);
      if (metadata.isSymbolicLink())
        throw new Error("canonical_repository_snapshot_symlink");
      if (metadata.isDirectory()) {
        walk(absolutePath, relativePath);
        continue;
      }
      if (!metadata.isFile())
        throw new Error("canonical_repository_snapshot_non_regular_path");
      fileHashes.push({
        relativePath,
        sha256: createHash("sha256")
          .update(fs.readFileSync(absolutePath))
          .digest("hex"),
      });
    }
  };
  walk(root, "");
  const hash = createHash("sha256");
  for (const file of fileHashes) {
    hash.update(file.relativePath);
    hash.update("\0");
    hash.update(file.sha256);
    hash.update("\0");
  }
  return Object.freeze({
    sha256: hash.digest("hex"),
    headCommit: identity.commit,
    headTree: identity.tree,
    fileHashes: Object.freeze(fileHashes.map((value) => Object.freeze(value))),
    excludedDirectoryNames,
  });
}

function semanticResult(
  response: unknown,
  expectedId: string,
): JsonRecord | null {
  if (!response || typeof response !== "object" || Array.isArray(response))
    return null;
  const envelope = response as JsonRecord;
  if (
    envelope.jsonrpc !== "2.0" ||
    envelope.id !== expectedId ||
    "error" in envelope ||
    !envelope.result ||
    typeof envelope.result !== "object" ||
    Array.isArray(envelope.result)
  )
    return null;
  const structured = (envelope.result as JsonRecord).structuredContent;
  return inspectMcpProjectRuntimeObjectiveResult(structured);
}

type ExpectedObjective = Readonly<{
  responseId: string;
  requestId: string;
  projectId: string;
  milestoneId: string;
  executorProvider: "codex" | "claude";
  reviewerProvider?: "codex" | "claude";
}>;
type RepositorySnapshot = Readonly<{
  sha256: string;
  headCommit: string;
  headTree: string;
  fileHashes: readonly Readonly<{ relativePath: string; sha256: string }>[];
  excludedDirectoryNames?: readonly string[];
}>;

type NormalObjectiveRun = Readonly<{
  observation: PublicProcessObservation;
  expected: ExpectedObjective;
  snapshotBefore: RepositorySnapshot;
  snapshotAfter: RepositorySnapshot;
  expectedChangedPaths: readonly string[];
  expectedCanonicalStateObserved: boolean;
}>;

type RecoverySettlementRun = Readonly<{
  parentLoss: PublicProcessObservation;
  parentTerminationRequestedAfterProcessStart: boolean;
  reentry: PublicProcessObservation;
  expected: ExpectedObjective;
  snapshotBefore: RepositorySnapshot;
  snapshotAfter: RepositorySnapshot;
  expectedCanonicalStateObserved: boolean;
}>;

function changedSnapshotPaths(
  before: RepositorySnapshot,
  after: RepositorySnapshot,
) {
  const beforeByPath = new Map(
    before.fileHashes.map((value) => [value.relativePath, value.sha256]),
  );
  const afterByPath = new Map(
    after.fileHashes.map((value) => [value.relativePath, value.sha256]),
  );
  return [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])]
    .filter((value) => beforeByPath.get(value) !== afterByPath.get(value))
    .sort();
}

function runtimeEventsExactlyMatch(
  events: PublicProcessObservation["runtimeEvents"],
  expectedValues: readonly Readonly<{
    event: "selection" | "process_started";
    taskRole: string;
    provider: string;
  }>[],
) {
  return (
    events.length === expectedValues.length &&
    events.every((event, index) => {
      const expectedEvent = expectedValues[index];
      return (
        expectedEvent !== undefined &&
        event.event === expectedEvent.event &&
        event.taskRole === expectedEvent.taskRole &&
        event.provider === expectedEvent.provider &&
        (event.event === "selection"
          ? event.operationId === null
          : typeof event.operationId === "string" &&
            /^OP-[0-9]{6,}$/u.test(event.operationId))
      );
    })
  );
}

export function buildProjectRuntimeRealProviderReport(
  input: Readonly<{
    runId: string;
    sourceIdentity: JsonRecord;
    distributionIdentity: JsonRecord;
    normalRuns: readonly NormalObjectiveRun[];
    cancellation: PublicProcessObservation;
    cancellationRequestedAfterProcessStart: boolean;
    cancellationExpected: ExpectedObjective;
    cancellationSnapshotBefore: RepositorySnapshot;
    cancellationSnapshotAfter: RepositorySnapshot;
    recoverySettlement: RecoverySettlementRun;
    dockerRecovery: JsonRecord;
  }>,
) {
  const problems: string[] = [];
  const processProblems = (prefix: string, value: PublicProcessObservation) => {
    if (!value.pidIssued) problems.push(`${prefix}_pid_not_issued`);
    if (!value.joined) problems.push(`${prefix}_child_not_joined`);
    if (value.exit?.code !== 0 || value.exit.signal !== null)
      problems.push(`${prefix}_child_exit`);
    if (value.launchError !== null) problems.push(`${prefix}_launch_error`);
    if (value.streamFailure) problems.push(`${prefix}_stream_failure`);
    if (value.runtimeEventProtocolViolation)
      problems.push(`${prefix}_runtime_event_protocol_violation`);
    if (!value.outputWithinLimit) problems.push(`${prefix}_output_limit`);
    if (value.timedOut) problems.push(`${prefix}_timeout`);
    if (value.parseFailure) problems.push(`${prefix}_response_parse`);
  };
  input.normalRuns.forEach((operationRun, index) => {
    processProblems(`normal_${index + 1}`, operationRun.observation);
  });
  processProblems("cancellation", input.cancellation);
  processProblems("recovery_reentry", input.recoverySettlement.reentry);
  const normalResults = input.normalRuns.map((operationRun, index) => {
    const { observation, expected } = operationRun;
    if (!observation.inputEofIssued)
      problems.push(`normal_${index + 1}_eof_not_issued`);
    if (observation.responses.length !== 1)
      problems.push(`normal_${index + 1}_response_count`);
    return semanticResult(observation.responses[0], expected.responseId);
  });
  if (normalResults.some((value) => value === null))
    problems.push("normal_response_envelope");
  if (
    normalResults.some((value, index) => {
      const expected = input.normalRuns[index]?.expected;
      return (
        !expected ||
        value?.status !== "completed" ||
        value.reason !== "project_runtime_milestone_accepted" ||
        value.requestId !== expected.requestId ||
        value.projectId !== expected.projectId ||
        value.milestoneId !== expected.milestoneId ||
        !value.projection ||
        typeof value.projection !== "object" ||
        (value.projection as JsonRecord).milestoneState !== "accepted"
      );
    })
  )
    problems.push("normal_semantic_result");
  for (const [index, operationRun] of input.normalRuns.entries()) {
    const expected = operationRun.expected;
    const observation = operationRun.observation;
    const expectedEvents = [
      {
        event: "selection" as const,
        taskRole: "executor",
        provider: expected.executorProvider,
      },
      {
        event: "process_started" as const,
        taskRole: "executor",
        provider: expected.executorProvider,
      },
      {
        event: "selection" as const,
        taskRole: "reviewer",
        provider: expected.reviewerProvider ?? "",
      },
      {
        event: "process_started" as const,
        taskRole: "reviewer",
        provider: expected.reviewerProvider ?? "",
      },
    ];
    if (
      !expected.reviewerProvider ||
      !runtimeEventsExactlyMatch(observation.runtimeEvents, expectedEvents)
    )
      problems.push(`normal_${index + 1}_provider_selection_mismatch`);
    const changedPaths = changedSnapshotPaths(
      operationRun.snapshotBefore,
      operationRun.snapshotAfter,
    );
    if (
      operationRun.snapshotBefore.headCommit !==
        operationRun.snapshotAfter.headCommit ||
      operationRun.snapshotBefore.headTree !==
        operationRun.snapshotAfter.headTree ||
      JSON.stringify(changedPaths) !==
        JSON.stringify(operationRun.expectedChangedPaths)
    )
      problems.push(`normal_${index + 1}_canonical_repository_change_mismatch`);
    if (!operationRun.expectedCanonicalStateObserved)
      problems.push(`normal_${index + 1}_canonical_state_mismatch`);
  }

  const cancellationResult = semanticResult(
    input.cancellation.responses[0],
    input.cancellationExpected.responseId,
  );
  if (input.cancellation.responses.length !== 1 || cancellationResult === null)
    problems.push("cancellation_response_envelope");
  if (
    !input.cancellationRequestedAfterProcessStart ||
    !input.cancellation.processStartEventObserved ||
    input.cancellation.inputCloseTriggerEvent?.event !== "process_started" ||
    input.cancellation.inputCloseTriggerEvent.taskRole !== "executor" ||
    input.cancellation.inputCloseTriggerEvent.provider !==
      input.cancellationExpected.executorProvider
  )
    problems.push("cancellation_before_provider_process_start");
  if (!input.cancellation.inputEofIssued)
    problems.push("cancellation_eof_not_issued");
  if (
    cancellationResult?.status !== "cancelled" ||
    cancellationResult.reason !== "project_runtime_operation_cancelled" ||
    cancellationResult.requestId !== input.cancellationExpected.requestId ||
    cancellationResult.projectId !== input.cancellationExpected.projectId ||
    cancellationResult.milestoneId !== input.cancellationExpected.milestoneId ||
    !cancellationResult.projection ||
    typeof cancellationResult.projection !== "object" ||
    (cancellationResult.projection as JsonRecord).milestoneState !==
      "cancelled" ||
    cancellationResult.cleanupConfirmed !== true ||
    cancellationResult.manualRecoveryRequired !== false ||
    cancellationResult.processRestartRequired !== false ||
    cancellationResult.effectState !== "settled" ||
    !Array.isArray(cancellationResult.recoveryIds) ||
    cancellationResult.recoveryIds.length !== 0 ||
    !Array.isArray(cancellationResult.recoveryObligations) ||
    cancellationResult.recoveryObligations.length !== 0
  )
    problems.push("cancellation_semantic_result");
  const expectedCancellationEvents = [
    {
      event: "selection" as const,
      taskRole: "executor",
      provider: input.cancellationExpected.executorProvider,
    },
    {
      event: "process_started" as const,
      taskRole: "executor",
      provider: input.cancellationExpected.executorProvider,
    },
  ];
  if (
    !runtimeEventsExactlyMatch(
      input.cancellation.runtimeEvents,
      expectedCancellationEvents,
    )
  )
    problems.push("cancellation_provider_lifecycle_mismatch");

  const recovery = input.recoverySettlement;
  if (!recovery.parentLoss.pidIssued)
    problems.push("recovery_parent_pid_not_issued");
  if (!recovery.parentLoss.joined) problems.push("recovery_parent_not_joined");
  if (
    recovery.parentLoss.exit === null ||
    (recovery.parentLoss.exit.code === 0 &&
      recovery.parentLoss.exit.signal === null)
  )
    problems.push("recovery_parent_not_terminated");
  if (
    recovery.parentLoss.launchError !== null ||
    recovery.parentLoss.streamFailure ||
    recovery.parentLoss.runtimeEventProtocolViolation ||
    !recovery.parentLoss.outputWithinLimit ||
    recovery.parentLoss.timedOut ||
    recovery.parentLoss.parseFailure
  )
    problems.push("recovery_parent_process_observation_invalid");
  const expectedParentLossEvents = [
    {
      event: "selection" as const,
      taskRole: "executor",
      provider: recovery.expected.executorProvider,
    },
    {
      event: "process_started" as const,
      taskRole: "executor",
      provider: recovery.expected.executorProvider,
    },
  ];
  if (
    !runtimeEventsExactlyMatch(
      recovery.parentLoss.runtimeEvents,
      expectedParentLossEvents,
    )
  )
    problems.push("recovery_parent_provider_lifecycle_mismatch");
  if (
    !recovery.parentTerminationRequestedAfterProcessStart ||
    !recovery.parentLoss.processStartEventObserved ||
    !recovery.parentLoss.forcedTerminationIssued ||
    recovery.parentLoss.inputEofIssued ||
    recovery.parentLoss.responses.length !== 0
  )
    problems.push("recovery_parent_loss_not_exercised");
  if (!recovery.reentry.inputEofIssued)
    problems.push("recovery_reentry_eof_not_issued");
  const recoveryResult = semanticResult(
    recovery.reentry.responses[0],
    recovery.expected.responseId,
  );
  if (recovery.reentry.responses.length !== 1 || recoveryResult === null)
    problems.push("recovery_reentry_response_envelope");
  if (
    recoveryResult?.status !== "completed" ||
    recoveryResult.reason !== "project_runtime_milestone_accepted" ||
    recoveryResult.requestId !== recovery.expected.requestId ||
    recoveryResult.projectId !== recovery.expected.projectId ||
    recoveryResult.milestoneId !== recovery.expected.milestoneId ||
    recoveryResult.cleanupConfirmed !== true ||
    recoveryResult.manualRecoveryRequired !== false ||
    recoveryResult.processRestartRequired !== false ||
    recoveryResult.effectState !== "settled"
  )
    problems.push("recovery_reentry_semantic_result");
  if (
    !recovery.expected.reviewerProvider ||
    !runtimeEventsExactlyMatch(recovery.reentry.runtimeEvents, [
      {
        event: "selection",
        taskRole: "executor",
        provider: recovery.expected.executorProvider,
      },
      {
        event: "process_started",
        taskRole: "executor",
        provider: recovery.expected.executorProvider,
      },
      {
        event: "selection",
        taskRole: "reviewer",
        provider: recovery.expected.reviewerProvider,
      },
      {
        event: "process_started",
        taskRole: "reviewer",
        provider: recovery.expected.reviewerProvider,
      },
    ])
  )
    problems.push("recovery_reentry_provider_lifecycle_mismatch");
  const lossProviderOperationIds = recovery.parentLoss.processStartEvents
    .filter((event) => event.taskRole === "executor")
    .map((event) => event.operationId);
  const expectedRecoveryPhases = [
    "required",
    "recovering",
    "settled",
    "acknowledged",
    "verification_resources_finalized",
    "queue_settled",
    "retry_ready",
  ] as const;
  const recoveryIds = recovery.reentry.recoveryEvents
    .map((event) => event.recoveryId)
    .filter((value): value is string => value !== null);
  const exactRecoveryId = recoveryIds[0] ?? null;
  const exactRecoveryTaskId =
    recovery.reentry.recoveryEvents[0]?.taskId ?? null;
  const exactProjectOperationId =
    recovery.reentry.recoveryEvents[0]?.operationId ?? null;
  const exactRecoveryQueueId =
    typeof recoveryResult?.queueId === "string" ? recoveryResult.queueId : null;
  const terminationTrigger =
    recovery.parentLoss.processTreeTerminationTriggerEvent;
  const isRecoveryEventsCorrelated =
    lossProviderOperationIds.length === 1 &&
    terminationTrigger?.event === "process_started" &&
    terminationTrigger.taskRole === "executor" &&
    terminationTrigger.provider === recovery.expected.executorProvider &&
    terminationTrigger.operationId === lossProviderOperationIds[0] &&
    exactRecoveryId !== null &&
    exactRecoveryQueueId !== null &&
    exactRecoveryTaskId !== null &&
    exactProjectOperationId !== null &&
    PROJECT_OPERATION_ID.test(exactProjectOperationId) &&
    /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      exactRecoveryId,
    ) &&
    recovery.reentry.recoveryEvents.length === expectedRecoveryPhases.length &&
    recovery.reentry.recoveryEvents.every((event, index) => {
      const expectedPhase = expectedRecoveryPhases[index];
      const isItemPhase = index < 5;
      return (
        event.phase === expectedPhase &&
        event.projectId === recovery.expected.projectId &&
        event.milestoneId === recovery.expected.milestoneId &&
        event.queueId === exactRecoveryQueueId &&
        (isItemPhase
          ? event.taskId === exactRecoveryTaskId &&
            event.operationId === exactProjectOperationId &&
            event.recoveryId === exactRecoveryId
          : event.taskId === null &&
            event.operationId === null &&
            event.recoveryId === null)
      );
    }) &&
    new Set(recoveryIds).size === 1 &&
    recovery.reentry.recoveryEvents.every((event, index, events) => {
      const previous = events.at(index - 1);
      return (
        index === 0 ||
        (previous !== undefined &&
          event.stateGeneration >= previous.stateGeneration)
      );
    });
  const isRecoverySettlementExercised =
    isRecoveryEventsCorrelated &&
    recovery.parentTerminationRequestedAfterProcessStart &&
    recovery.parentLoss.forcedTerminationIssued &&
    recovery.parentLoss.processTreeTerminationConfirmed &&
    recovery.parentLoss.joined &&
    !recovery.parentLoss.inputEofIssued &&
    recoveryResult?.status === "completed" &&
    recovery.reentry.joined;
  if (!isRecoverySettlementExercised)
    problems.push("recovery_settlement_lifecycle_mismatch");
  const recoveryChangedPaths = changedSnapshotPaths(
    recovery.snapshotBefore,
    recovery.snapshotAfter,
  );
  if (
    recovery.snapshotBefore.headCommit !== recovery.snapshotAfter.headCommit ||
    recovery.snapshotBefore.headTree !== recovery.snapshotAfter.headTree ||
    recoveryChangedPaths.length !== 0 ||
    !recovery.expectedCanonicalStateObserved
  )
    problems.push("recovery_canonical_repository_changed");

  // Executor and reviewer are stages of one Coordinator Task attempt and must
  // retain that attempt's Operation ID. Distinct public executions and a
  // recovery reentry are separate attempts and must never reuse it.
  const operationIdGroups = [
    ...input.normalRuns.map((operationRun) =>
      operationRun.observation.processStartEvents.map(
        (event) => event.operationId,
      ),
    ),
    input.cancellation.processStartEvents.map((event) => event.operationId),
    input.recoverySettlement.parentLoss.processStartEvents.map(
      (event) => event.operationId,
    ),
    input.recoverySettlement.reentry.processStartEvents.map(
      (event) => event.operationId,
    ),
  ];
  const attemptOperationIds = operationIdGroups
    .filter((groupItems) => groupItems.length > 0)
    .map((groupItems) => new Set(groupItems));
  if (attemptOperationIds.some((identities) => identities.size !== 1))
    problems.push("provider_operation_identity_inconsistent");
  const distinctAttemptOperationIds = attemptOperationIds.flatMap(
    (identities) => [...identities],
  );
  if (
    distinctAttemptOperationIds.some(
      (value) => !/^OP-[0-9]{6,}$/u.test(value),
    ) ||
    new Set(distinctAttemptOperationIds).size !==
      distinctAttemptOperationIds.length
  )
    problems.push("provider_operation_identity_reused");

  const isCanonicalRepositoryChanged =
    input.cancellationSnapshotBefore.sha256 !==
      input.cancellationSnapshotAfter.sha256 ||
    input.cancellationSnapshotBefore.headCommit !==
      input.cancellationSnapshotAfter.headCommit ||
    input.cancellationSnapshotBefore.headTree !==
      input.cancellationSnapshotAfter.headTree;
  if (isCanonicalRepositoryChanged)
    problems.push("cancellation_canonical_repository_changed");
  if (
    input.dockerRecovery.status !== "completed" ||
    input.dockerRecovery.reason !== "docker_task_runtime_state_clean" ||
    input.dockerRecovery.manualRecoveryRequired !== false
  )
    problems.push("post_run_recovery_state_not_clean");

  const isCompleted = problems.length === 0;
  const cleanupConfirmed =
    input.normalRuns.every((operationRun) => operationRun.observation.joined) &&
    input.cancellation.joined &&
    input.recoverySettlement.parentLoss.joined &&
    input.recoverySettlement.reentry.joined &&
    input.dockerRecovery.status === "completed" &&
    input.dockerRecovery.reason === "docker_task_runtime_state_clean" &&
    input.dockerRecovery.manualRecoveryRequired === false;
  return Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 8,
    status: isCompleted ? "completed" : "blocked",
    reason: isCompleted
      ? "project_runtime_public_mcp_real_providers_cancellation_and_recovery_verified"
      : "project_runtime_public_mcp_verification_incomplete",
    problems: Object.freeze(problems),
    cleanupConfirmed,
    manualRecoveryRequired: !cleanupConfirmed,
    processRestartRequired:
      input.normalRuns.some(
        (operationRun) => !operationRun.observation.joined,
      ) ||
      !input.cancellation.joined ||
      !input.recoverySettlement.parentLoss.joined ||
      !input.recoverySettlement.reentry.joined,
    effectState: isCompleted ? "settled" : "unknown",
    runId: input.runId,
    sourceIdentity: input.sourceIdentity,
    distributionIdentity: input.distributionIdentity,
    providers: Object.freeze(
      input.normalRuns.map((operationRun) => {
        const event = operationRun.observation.processStartEvents.find(
          (candidate) => candidate.taskRole === "executor",
        );
        return event?.provider ?? null;
      }),
    ),
    publicMcpProcess: Object.freeze({
      actualChildProcess:
        input.normalRuns.every(
          (operationRun) =>
            operationRun.observation.pidIssued &&
            operationRun.observation.joined,
        ) &&
        input.cancellation.pidIssued &&
        input.cancellation.joined &&
        input.recoverySettlement.parentLoss.pidIssued &&
        input.recoverySettlement.parentLoss.joined &&
        input.recoverySettlement.reentry.pidIssued &&
        input.recoverySettlement.reentry.joined,
      transport: "stdio",
      completedObjectiveCount: normalResults.filter(
        (value) => value?.status === "completed",
      ).length,
      runs: Object.freeze(
        input.normalRuns.map((operationRun, index) =>
          Object.freeze({
            responseId: operationRun.expected.responseId,
            childJoined: operationRun.observation.joined,
            inputEofIssued: operationRun.observation.inputEofIssued,
            selectionEvents: operationRun.observation.selectionEvents,
            processStartEvents: operationRun.observation.processStartEvents,
            changedPaths: Object.freeze(
              changedSnapshotPaths(
                operationRun.snapshotBefore,
                operationRun.snapshotAfter,
              ),
            ),
            expectedCanonicalStateObserved:
              operationRun.expectedCanonicalStateObserved,
            semanticStatus: normalResults[index]?.status ?? null,
          }),
        ),
      ),
    }),
    cancellation: Object.freeze({
      providerProcessStartObservedBeforeCancellation:
        input.cancellationRequestedAfterProcessStart &&
        input.cancellation.processStartEventObserved,
      parentEofIssued: input.cancellation.inputEofIssued,
      semanticStatus: cancellationResult?.status ?? null,
      cleanupConfirmed: cancellationResult?.cleanupConfirmed ?? null,
      manualRecoveryRequired:
        cancellationResult?.manualRecoveryRequired ?? null,
      processRestartRequired:
        cancellationResult?.processRestartRequired ?? null,
      effectState: cancellationResult?.effectState ?? null,
      recoveryIds: cancellationResult?.recoveryIds ?? null,
      recoveryObligations: cancellationResult?.recoveryObligations ?? null,
      childJoined: input.cancellation.joined,
      canonicalRepositoryChanged: isCanonicalRepositoryChanged,
      snapshotBeforeSha256: input.cancellationSnapshotBefore.sha256,
      snapshotAfterSha256: input.cancellationSnapshotAfter.sha256,
    }),
    dockerRecoveryAfterRun: Object.freeze({
      status: input.dockerRecovery.status ?? null,
      reason: input.dockerRecovery.reason ?? null,
      manualRecoveryRequired:
        input.dockerRecovery.manualRecoveryRequired ?? null,
      recoverySettlementExercised: isRecoverySettlementExercised,
      parentProcessTerminationObserved:
        recovery.parentLoss.forcedTerminationIssued &&
        recovery.parentLoss.joined,
      exactRecoveryReferenceObserved: exactRecoveryId !== null,
      recoveryReference: exactRecoveryId,
      lifecyclePhases: Object.freeze(
        recovery.reentry.recoveryEvents.map((event) => event.phase),
      ),
      freshPublicMcpReentryCompleted:
        recoveryResult?.status === "completed" && recovery.reentry.joined,
      canonicalRepositoryChanged: recoveryChangedPaths.length !== 0,
    }),
    canonicalRepositoryObservation: Object.freeze({
      normalRuns: Object.freeze(
        input.normalRuns.map((operationRun) =>
          Object.freeze({
            changedPaths: Object.freeze(
              changedSnapshotPaths(
                operationRun.snapshotBefore,
                operationRun.snapshotAfter,
              ),
            ),
            expectedChangedPaths: operationRun.expectedChangedPaths,
          }),
        ),
      ),
      excludedDirectoryNames:
        input.normalRuns[0]?.snapshotBefore.excludedDirectoryNames ?? null,
    }),
    releaseAuthorityConferred: false,
    rawProviderOutputReported: false,
    results: Object.freeze(normalResults),
  });
}
