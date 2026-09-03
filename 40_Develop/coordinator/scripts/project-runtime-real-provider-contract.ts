import type { ChildProcessWithoutNullStreams } from "node:child_process";
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
  joined: boolean;
  selectionEventObserved: boolean;
  selectionEvents: readonly Readonly<{ taskRole: string; provider: string }>[];
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
  }>,
): Promise<PublicProcessObservation> {
  let stdout = "";
  let stderr = "";
  let launchError: string | null = null;
  let outputWithinLimit = true;
  let timedOut = false;
  let inputEofIssued = false;
  let forcedTerminationIssued = false;
  let streamFailure = false;
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
    } catch {
      closeInput();
    }
  };
  child.stdout.on("data", (chunk: Buffer) => accept("stdout", chunk));
  child.stderr.on("data", (chunk: Buffer) => accept("stderr", chunk));
  for (const stream of [child.stdin, child.stdout, child.stderr])
    stream.on("error", () => {
      streamFailure = true;
      closeInput();
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
  for (const line of stderr.split(/\r?\n/u).filter(Boolean)) {
    try {
      const objectStart = line.indexOf("{");
      if (objectStart < 0) continue;
      const parsed = JSON.parse(line.slice(objectStart)) as JsonRecord;
      if (
        parsed.event === "coordinator_selection_before_provider_effect" &&
        typeof parsed.taskRole === "string" &&
        typeof parsed.provider === "string"
      )
        selectionEvents.push(
          Object.freeze({
            taskRole: parsed.taskRole,
            provider: parsed.provider,
          }),
        );
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
    joined: exit !== null,
    selectionEventObserved: stderr.includes(
      '"event":"coordinator_selection_before_provider_effect"',
    ),
    selectionEvents: Object.freeze(selectionEvents),
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

export function buildProjectRuntimeRealProviderReport(
  input: Readonly<{
    runId: string;
    sourceIdentity: JsonRecord;
    distributionIdentity: JsonRecord;
    normal: PublicProcessObservation;
    cancellation: PublicProcessObservation;
    cancellationRequestedAfterSelection: boolean;
    normalExpected: readonly ExpectedObjective[];
    cancellationExpected: ExpectedObjective;
    canonicalAdoptionObserved: boolean;
    normalSnapshotBefore: RepositorySnapshot;
    normalSnapshotAfter: RepositorySnapshot;
    cancellationSnapshotBefore: RepositorySnapshot;
    cancellationSnapshotAfter: RepositorySnapshot;
    expectedChangedPath: string;
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
  processProblems("normal", input.normal);
  processProblems("cancellation", input.cancellation);
  if (!input.normal.inputEofIssued) problems.push("normal_eof_not_issued");

  const normalResults = input.normalExpected.map((expected, index) =>
    semanticResult(input.normal.responses[index], expected.responseId),
  );
  if (input.normal.responses.length !== input.normalExpected.length)
    problems.push("normal_response_count");
  if (normalResults.some((value) => value === null))
    problems.push("normal_response_envelope");
  if (
    normalResults.some((value, index) => {
      const expected = input.normalExpected[index];
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
  for (const expected of input.normalExpected) {
    if (
      !input.normal.selectionEvents.some(
        (event) =>
          event.taskRole === "executor" &&
          event.provider === expected.executorProvider,
      ) ||
      !input.normal.selectionEvents.some(
        (event) =>
          event.taskRole === "reviewer" &&
          event.provider === expected.reviewerProvider,
      )
    )
      problems.push("normal_provider_selection_mismatch");
  }

  const cancellationResult = semanticResult(
    input.cancellation.responses[0],
    input.cancellationExpected.responseId,
  );
  if (input.cancellation.responses.length !== 1 || cancellationResult === null)
    problems.push("cancellation_response_envelope");
  if (
    !input.cancellationRequestedAfterSelection ||
    !input.cancellation.selectionEventObserved
  )
    problems.push("cancellation_before_provider_selection");
  if (!input.cancellation.inputEofIssued)
    problems.push("cancellation_eof_not_issued");
  if (
    cancellationResult?.status !== "cancelled" ||
    cancellationResult.requestId !== input.cancellationExpected.requestId ||
    cancellationResult.projectId !== input.cancellationExpected.projectId ||
    cancellationResult.milestoneId !== input.cancellationExpected.milestoneId ||
    !cancellationResult.projection ||
    typeof cancellationResult.projection !== "object" ||
    (cancellationResult.projection as JsonRecord).milestoneState !== "cancelled"
  )
    problems.push("cancellation_semantic_result");
  if (
    !input.cancellation.selectionEvents.some(
      (event) =>
        event.taskRole === "executor" &&
        event.provider === input.cancellationExpected.executorProvider,
    )
  )
    problems.push("cancellation_provider_selection_mismatch");

  const normalChangedPaths = changedSnapshotPaths(
    input.normalSnapshotBefore,
    input.normalSnapshotAfter,
  );
  if (
    input.normalSnapshotBefore.headCommit !==
      input.normalSnapshotAfter.headCommit ||
    input.normalSnapshotBefore.headTree !==
      input.normalSnapshotAfter.headTree ||
    normalChangedPaths.length !== 1 ||
    normalChangedPaths[0] !== input.expectedChangedPath
  )
    problems.push("normal_canonical_repository_change_mismatch");
  const canonicalRepositoryChanged =
    input.cancellationSnapshotBefore.sha256 !==
      input.cancellationSnapshotAfter.sha256 ||
    input.cancellationSnapshotBefore.headCommit !==
      input.cancellationSnapshotAfter.headCommit ||
    input.cancellationSnapshotBefore.headTree !==
      input.cancellationSnapshotAfter.headTree;
  if (canonicalRepositoryChanged)
    problems.push("cancellation_canonical_repository_changed");
  if (!input.canonicalAdoptionObserved)
    problems.push("canonical_adoption_not_observed");
  if (
    input.dockerRecovery.status !== "completed" ||
    input.dockerRecovery.reason !== "docker_task_runtime_state_clean" ||
    input.dockerRecovery.manualRecoveryRequired !== false
  )
    problems.push("post_run_recovery_state_not_clean");

  const completed = problems.length === 0;
  const cleanupConfirmed =
    input.normal.joined &&
    input.cancellation.joined &&
    input.dockerRecovery.status === "completed" &&
    input.dockerRecovery.reason === "docker_task_runtime_state_clean" &&
    input.dockerRecovery.manualRecoveryRequired === false;
  return Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 6,
    status: completed ? "completed" : "blocked",
    reason: completed
      ? "project_runtime_public_mcp_real_providers_and_cancellation_verified"
      : "project_runtime_public_mcp_verification_incomplete",
    problems: Object.freeze(problems),
    cleanupConfirmed,
    manualRecoveryRequired: !cleanupConfirmed,
    processRestartRequired: !input.normal.joined || !input.cancellation.joined,
    effectState: completed ? "settled" : "unknown",
    runId: input.runId,
    sourceIdentity: input.sourceIdentity,
    distributionIdentity: input.distributionIdentity,
    providers: Object.freeze(
      input.normalExpected.map((value) => value.executorProvider),
    ),
    publicMcpProcess: Object.freeze({
      actualChildProcess:
        input.normal.pidIssued &&
        input.normal.joined &&
        input.cancellation.pidIssued &&
        input.cancellation.joined,
      transport: "stdio",
      completedObjectiveCount: normalResults.filter(
        (value) => value?.status === "completed",
      ).length,
      childJoined: input.normal.joined,
      inputEofIssued: input.normal.inputEofIssued,
      selectionEvents: input.normal.selectionEvents,
    }),
    cancellation: Object.freeze({
      providerSelectionObservedBeforeCancellation:
        input.cancellationRequestedAfterSelection &&
        input.cancellation.selectionEventObserved,
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
      recoverySettlementExercised: false,
    }),
    canonicalAdoptionObserved: input.canonicalAdoptionObserved,
    canonicalRepositoryObservation: Object.freeze({
      normalChangedPaths: Object.freeze(normalChangedPaths),
      excludedDirectoryNames:
        input.normalSnapshotBefore.excludedDirectoryNames ?? null,
    }),
    releaseAuthorityConferred: false,
    rawProviderOutputReported: false,
    results: Object.freeze(normalResults),
  });
}
