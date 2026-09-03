import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { inspectMcpProjectRuntimeObjectiveResult } from "../src/security/mcp-project-runtime-adapter.ts";
import { inspectRepositoryIdentityCandidate } from "../src/security/repository-operation-runtime.ts";

export type JsonRecord = Readonly<Record<string, unknown>>;

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
  joined: boolean;
  selectionEventObserved: boolean;
  selectionEvents: readonly Readonly<{ taskRole: string; provider: string }>[];
  processStartEventObserved: boolean;
  processStartEvents: readonly Readonly<{
    taskRole: string;
    provider: string;
    operationId: string;
  }>[];
  runtimeEvents: readonly Readonly<{
    event: "selection" | "process_started";
    taskRole: string;
    provider: string;
    operationId: string | null;
  }>[];
  recoveryEvents: readonly Readonly<{
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
  }>[];
  pidIssued: boolean;
  streamFailure: boolean;
}>;

export async function observePublicMcpProcess(
  child: ChildProcessWithoutNullStreams,
  options: Readonly<{
    maximumOutputBytes: number;
    timeoutMs: number;
    terminationGraceMs?: number;
    closeInputWhen?: (
      output: Readonly<{ stdout: string; stderr: string }>,
    ) => boolean;
    terminateProcessTreeWhen?: (
      output: Readonly<{ stdout: string; stderr: string }>,
    ) => boolean;
  }>,
): Promise<PublicProcessObservation> {
  let stdout = "";
  let stderr = "";
  let launchError: string | null = null;
  let outputWithinLimit = true;
  let timedOut = false;
  let inputEofIssued = false;
  let forcedTerminationIssued = false;
  let processTreeTerminationAttempted = false;
  let processTreeTerminationConfirmed = false;
  let streamFailure = false;
  let terminationJoinTimeout: ReturnType<typeof setTimeout> | null = null;
  const pidIssued = Number.isSafeInteger(child.pid) && Number(child.pid) > 0;
  const grace = options.terminationGraceMs ?? 5_000;

  const closeInput = () => {
    if (inputEofIssued) return;
    inputEofIssued = true;
    try {
      child.stdin.end();
    } catch {
      streamFailure = true;
    }
  };
  const terminateProcessTree = () => {
    if (
      forcedTerminationIssued ||
      processTreeTerminationAttempted ||
      !pidIssued
    )
      return;
    processTreeTerminationAttempted = true;
    setImmediate(() => {
      try {
        if (process.platform === "win32") {
          const terminated = spawnSync(
            `${process.env.SystemRoot ?? "C:\\Windows"}\\System32\\taskkill.exe`,
            ["/PID", String(child.pid), "/T", "/F"],
            { windowsHide: true, encoding: "utf8", timeout: grace },
          );
          forcedTerminationIssued =
            !terminated.error && terminated.status === 0;
          processTreeTerminationConfirmed = forcedTerminationIssued;
          if (forcedTerminationIssued) {
            terminationJoinTimeout = setTimeout(
              () => settleClose?.(null),
              grace,
            );
          } else {
            forcedTerminationIssued = child.kill("SIGKILL");
          }
        } else {
          forcedTerminationIssued = child.kill("SIGKILL");
        }
      } catch {
        streamFailure = true;
      }
    });
  };
  const accept = (stream: "stdout" | "stderr", chunk: Buffer) => {
    const current = stream === "stdout" ? stdout : stderr;
    if (
      Buffer.byteLength(current) + chunk.byteLength >
      options.maximumOutputBytes
    ) {
      outputWithinLimit = false;
      closeInput();
      return;
    }
    if (stream === "stdout") stdout += chunk.toString("utf8");
    else stderr += chunk.toString("utf8");
    try {
      if (options.closeInputWhen?.({ stdout, stderr })) closeInput();
      if (options.terminateProcessTreeWhen?.({ stdout, stderr }))
        terminateProcessTree();
    } catch {
      closeInput();
    }
  };
  child.stdout.on("data", (chunk: Buffer) => accept("stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => accept("stderr", chunk));
  for (const stream of [child.stdin, child.stdout, child.stderr])
    stream.on("error", () => {
      if (!processTreeTerminationAttempted) {
        streamFailure = true;
        closeInput();
      }
    });
  child.once("error", (error) => {
    launchError = error instanceof Error ? error.name : "unknown";
  });

  let settleClose:
    | ((
        value: Readonly<{ code: number | null; signal: string | null }> | null,
      ) => void)
    | null = null;
  const closed = new Promise<Readonly<{
    code: number | null;
    signal: string | null;
  }> | null>((resolve) => {
    settleClose = resolve;
    child.once("close", (code, signal) => resolve({ code, signal }));
    child.once("exit", (code, signal) => {
      if (processTreeTerminationAttempted) resolve({ code, signal });
    });
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    closeInput();
    setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          forcedTerminationIssued = child.kill();
        } catch {
          streamFailure = true;
        }
        setTimeout(() => settleClose?.(null), grace);
      }
    }, grace);
  }, options.timeoutMs);
  const exit = await closed;
  clearTimeout(timeout);
  if (terminationJoinTimeout !== null) clearTimeout(terminationJoinTimeout);

  const responses: unknown[] = [];
  let parseFailure = false;
  for (const line of stdout.split(/\r?\n/u).filter(Boolean)) {
    try {
      responses.push(JSON.parse(line) as unknown);
    } catch {
      parseFailure = true;
    }
  }
  const selectionEvents: Readonly<{ taskRole: string; provider: string }>[] =
    [];
  const processStartEvents: Readonly<{
    taskRole: string;
    provider: string;
    operationId: string;
  }>[] = [];
  const runtimeEvents: Array<{
    event: "selection" | "process_started";
    taskRole: string;
    provider: string;
    operationId: string | null;
  }> = [];
  const recoveryEvents: Array<
    PublicProcessObservation["recoveryEvents"][number]
  > = [];
  for (const line of stderr.split(/\r?\n/u).filter(Boolean)) {
    try {
      const selectionPrefix = "[Coordinator selection] ";
      const lifecyclePrefix = "[Coordinator lifecycle] ";
      const recoveryPrefix = "[Project Runtime recovery] ";
      if (line.startsWith(selectionPrefix)) {
        const parsed = JSON.parse(
          line.slice(selectionPrefix.length),
        ) as JsonRecord;
        if (
          parsed.event !== "coordinator_selection_before_provider_effect" ||
          typeof parsed.taskRole !== "string" ||
          typeof parsed.provider !== "string"
        )
          continue;
        selectionEvents.push(
          Object.freeze({
            taskRole: parsed.taskRole,
            provider: parsed.provider,
          }),
        );
        runtimeEvents.push(
          Object.freeze({
            event: "selection" as const,
            taskRole: parsed.taskRole,
            provider: parsed.provider,
            operationId: null,
          }),
        );
        continue;
      }
      if (line.startsWith(lifecyclePrefix)) {
        const parsed = JSON.parse(
          line.slice(lifecyclePrefix.length),
        ) as JsonRecord;
        if (
          parsed.event !== "coordinator_provider_process_started" ||
          typeof parsed.taskRole !== "string" ||
          typeof parsed.provider !== "string" ||
          typeof parsed.operationId !== "string" ||
          !/^OP-[0-9]{6,}$/u.test(parsed.operationId)
        )
          continue;
        processStartEvents.push(
          Object.freeze({
            taskRole: parsed.taskRole,
            provider: parsed.provider,
            operationId: parsed.operationId,
          }),
        );
        runtimeEvents.push(
          Object.freeze({
            event: "process_started" as const,
            taskRole: parsed.taskRole,
            provider: parsed.provider,
            operationId: parsed.operationId,
          }),
        );
        continue;
      }
      if (line.startsWith(recoveryPrefix)) {
        const parsed = JSON.parse(
          line.slice(recoveryPrefix.length),
        ) as JsonRecord;
        const phases = new Set([
          "required",
          "recovering",
          "settled",
          "acknowledged",
          "verification_resources_finalized",
          "queue_settled",
          "retry_ready",
        ]);
        if (
          parsed.event !== "project_runtime_recovery_transition" ||
          typeof parsed.phase !== "string" ||
          !phases.has(parsed.phase) ||
          typeof parsed.projectId !== "string" ||
          typeof parsed.milestoneId !== "string" ||
          typeof parsed.queueId !== "string" ||
          !(parsed.taskId === null || typeof parsed.taskId === "string") ||
          !(
            parsed.operationId === null ||
            typeof parsed.operationId === "string"
          ) ||
          !(
            parsed.recoveryId === null || typeof parsed.recoveryId === "string"
          ) ||
          !Number.isSafeInteger(parsed.stateGeneration) ||
          Number(parsed.stateGeneration) < 1
        )
          continue;
        recoveryEvents.push(
          Object.freeze({
            phase:
              parsed.phase as PublicProcessObservation["recoveryEvents"][number]["phase"],
            projectId: parsed.projectId,
            milestoneId: parsed.milestoneId,
            queueId: parsed.queueId,
            taskId: parsed.taskId as string | null,
            operationId: parsed.operationId as string | null,
            recoveryId: parsed.recoveryId as string | null,
            stateGeneration: Number(parsed.stateGeneration),
          }),
        );
      }
    } catch {
      // Non-JSON diagnostic lines are not selection evidence.
    }
  }
  return Object.freeze({
    exit,
    launchError,
    responses: Object.freeze(responses),
    parseFailure,
    outputWithinLimit,
    timedOut,
    inputEofIssued,
    forcedTerminationIssued,
    processTreeTerminationAttempted,
    processTreeTerminationConfirmed,
    joined: exit !== null,
    selectionEventObserved: selectionEvents.length > 0,
    selectionEvents: Object.freeze(selectionEvents),
    processStartEventObserved: processStartEvents.length > 0,
    processStartEvents: Object.freeze(processStartEvents),
    runtimeEvents: Object.freeze(runtimeEvents),
    recoveryEvents: Object.freeze(recoveryEvents),
    pidIssued,
    streamFailure,
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
  expected: readonly Readonly<{
    event: "selection" | "process_started";
    taskRole: string;
    provider: string;
  }>[],
) {
  return (
    events.length === expected.length &&
    events.every((event, index) => {
      const expectedEvent = expected[index];
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
    if (!value.outputWithinLimit) problems.push(`${prefix}_output_limit`);
    if (value.timedOut) problems.push(`${prefix}_timeout`);
    if (value.parseFailure) problems.push(`${prefix}_response_parse`);
  };
  input.normalRuns.forEach((run, index) => {
    processProblems(`normal_${index + 1}`, run.observation);
  });
  processProblems("cancellation", input.cancellation);
  processProblems("recovery_reentry", input.recoverySettlement.reentry);
  const normalResults = input.normalRuns.map((run, index) => {
    const { observation, expected } = run;
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
  for (const [index, run] of input.normalRuns.entries()) {
    const { expected, observation } = run;
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
      run.snapshotBefore,
      run.snapshotAfter,
    );
    if (
      run.snapshotBefore.headCommit !== run.snapshotAfter.headCommit ||
      run.snapshotBefore.headTree !== run.snapshotAfter.headTree ||
      JSON.stringify(changedPaths) !== JSON.stringify(run.expectedChangedPaths)
    )
      problems.push(`normal_${index + 1}_canonical_repository_change_mismatch`);
    if (!run.expectedCanonicalStateObserved)
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
    !input.cancellation.processStartEventObserved
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
    !recovery.parentLoss.outputWithinLimit ||
    recovery.parentLoss.timedOut ||
    recovery.parentLoss.parseFailure
  )
    problems.push("recovery_parent_process_observation_invalid");
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
  const lossOperationIds = recovery.parentLoss.processStartEvents
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
  const recoveryEventsCorrelated =
    lossOperationIds.length === 1 &&
    exactRecoveryId !== null &&
    /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      exactRecoveryId,
    ) &&
    recovery.reentry.recoveryEvents.length === expectedRecoveryPhases.length &&
    recovery.reentry.recoveryEvents.every((event, index) => {
      const expectedPhase = expectedRecoveryPhases[index];
      const itemPhase = index < 5;
      return (
        event.phase === expectedPhase &&
        event.projectId === recovery.expected.projectId &&
        event.milestoneId === recovery.expected.milestoneId &&
        (itemPhase
          ? event.taskId !== null &&
            event.operationId === lossOperationIds[0] &&
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
  const recoverySettlementExercised =
    recoveryEventsCorrelated &&
    recovery.parentTerminationRequestedAfterProcessStart &&
    recovery.parentLoss.forcedTerminationIssued &&
    recovery.parentLoss.processTreeTerminationConfirmed &&
    recovery.parentLoss.joined &&
    !recovery.parentLoss.inputEofIssued &&
    recoveryResult?.status === "completed" &&
    recovery.reentry.joined;
  if (!recoverySettlementExercised)
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

  const allOperationIds = [
    ...input.normalRuns.flatMap((run) =>
      run.observation.processStartEvents.map((event) => event.operationId),
    ),
    ...input.cancellation.processStartEvents.map((event) => event.operationId),
    ...input.recoverySettlement.parentLoss.processStartEvents.map(
      (event) => event.operationId,
    ),
    ...input.recoverySettlement.reentry.processStartEvents.map(
      (event) => event.operationId,
    ),
  ];
  if (
    allOperationIds.some((value) => !/^OP-[0-9]{6,}$/u.test(value)) ||
    new Set(allOperationIds).size !== allOperationIds.length
  )
    problems.push("provider_operation_identity_reused");

  const canonicalRepositoryChanged =
    input.cancellationSnapshotBefore.sha256 !==
      input.cancellationSnapshotAfter.sha256 ||
    input.cancellationSnapshotBefore.headCommit !==
      input.cancellationSnapshotAfter.headCommit ||
    input.cancellationSnapshotBefore.headTree !==
      input.cancellationSnapshotAfter.headTree;
  if (canonicalRepositoryChanged)
    problems.push("cancellation_canonical_repository_changed");
  if (
    input.dockerRecovery.status !== "completed" ||
    input.dockerRecovery.reason !== "docker_task_runtime_state_clean" ||
    input.dockerRecovery.manualRecoveryRequired !== false
  )
    problems.push("post_run_recovery_state_not_clean");

  const completed = problems.length === 0;
  const cleanupConfirmed =
    input.normalRuns.every((run) => run.observation.joined) &&
    input.cancellation.joined &&
    input.recoverySettlement.parentLoss.joined &&
    input.recoverySettlement.reentry.joined &&
    input.dockerRecovery.status === "completed" &&
    input.dockerRecovery.reason === "docker_task_runtime_state_clean" &&
    input.dockerRecovery.manualRecoveryRequired === false;
  return Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 8,
    status: completed ? "completed" : "blocked",
    reason: completed
      ? "project_runtime_public_mcp_real_providers_cancellation_and_recovery_verified"
      : "project_runtime_public_mcp_verification_incomplete",
    problems: Object.freeze(problems),
    cleanupConfirmed,
    manualRecoveryRequired: !cleanupConfirmed,
    processRestartRequired:
      input.normalRuns.some((run) => !run.observation.joined) ||
      !input.cancellation.joined ||
      !input.recoverySettlement.parentLoss.joined ||
      !input.recoverySettlement.reentry.joined,
    effectState: completed ? "settled" : "unknown",
    runId: input.runId,
    sourceIdentity: input.sourceIdentity,
    distributionIdentity: input.distributionIdentity,
    providers: Object.freeze(
      input.normalRuns.map((run) => {
        const event = run.observation.processStartEvents.find(
          (candidate) => candidate.taskRole === "executor",
        );
        return event?.provider ?? null;
      }),
    ),
    publicMcpProcess: Object.freeze({
      actualChildProcess:
        input.normalRuns.every(
          (run) => run.observation.pidIssued && run.observation.joined,
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
        input.normalRuns.map((run, index) =>
          Object.freeze({
            responseId: run.expected.responseId,
            childJoined: run.observation.joined,
            inputEofIssued: run.observation.inputEofIssued,
            selectionEvents: run.observation.selectionEvents,
            processStartEvents: run.observation.processStartEvents,
            changedPaths: Object.freeze(
              changedSnapshotPaths(run.snapshotBefore, run.snapshotAfter),
            ),
            expectedCanonicalStateObserved: run.expectedCanonicalStateObserved,
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
      canonicalRepositoryChanged,
      snapshotBeforeSha256: input.cancellationSnapshotBefore.sha256,
      snapshotAfterSha256: input.cancellationSnapshotAfter.sha256,
    }),
    dockerRecoveryAfterRun: Object.freeze({
      status: input.dockerRecovery.status ?? null,
      reason: input.dockerRecovery.reason ?? null,
      manualRecoveryRequired:
        input.dockerRecovery.manualRecoveryRequired ?? null,
      recoverySettlementExercised,
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
        input.normalRuns.map((run) =>
          Object.freeze({
            changedPaths: Object.freeze(
              changedSnapshotPaths(run.snapshotBefore, run.snapshotAfter),
            ),
            expectedChangedPaths: run.expectedChangedPaths,
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
