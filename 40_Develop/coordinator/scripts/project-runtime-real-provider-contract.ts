import {
  type ChildProcessWithoutNullStreams,
  execFileSync,
} from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";

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
  const grace = options.terminationGraceMs ?? 5_000;

  const closeInput = () => {
    if (inputEofIssued) return;
    inputEofIssued = true;
    child.stdin.end();
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
        forcedTerminationIssued = child.kill();
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
  });
}

export function captureCanonicalRepositorySnapshot(repositoryRoot: string) {
  const run = (args: readonly string[]) =>
    execFileSync("git", [...args], {
      cwd: repositoryRoot,
      encoding: "buffer",
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
    });
  const status = run([
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]);
  const workingDiff = run(["diff", "--binary", "HEAD", "--"]);
  const stagedDiff = run(["diff", "--cached", "--binary", "HEAD", "--"]);
  const untracked = run(["ls-files", "--others", "--exclude-standard", "-z"])
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .sort();
  const hash = createHash("sha256");
  hash.update(status);
  hash.update(workingDiff);
  hash.update(stagedDiff);
  for (const relativePath of untracked) {
    hash.update(relativePath);
    const absolutePath = `${repositoryRoot}/${relativePath.replaceAll("\\", "/")}`;
    const metadata = fs.lstatSync(absolutePath);
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      hash.update("non-regular");
      continue;
    }
    hash.update(fs.readFileSync(absolutePath));
  }
  return Object.freeze({
    sha256: hash.digest("hex"),
    untrackedPathCount: untracked.length,
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
  return structured &&
    typeof structured === "object" &&
    !Array.isArray(structured)
    ? (structured as JsonRecord)
    : null;
}

export function buildProjectRuntimeRealProviderReport(
  input: Readonly<{
    runId: string;
    sourceIdentity: JsonRecord;
    distributionIdentity: JsonRecord;
    normal: PublicProcessObservation;
    cancellation: PublicProcessObservation;
    cancellationRequestedAfterSelection: boolean;
    normalExpectedIds: readonly string[];
    cancellationExpectedId: string;
    canonicalAdoptionObserved: boolean;
    cancellationSnapshotBefore: Readonly<{ sha256: string }>;
    cancellationSnapshotAfter: Readonly<{ sha256: string }>;
    dockerRecovery: JsonRecord;
  }>,
) {
  const problems: string[] = [];
  const processProblems = (prefix: string, value: PublicProcessObservation) => {
    if (!value.joined) problems.push(`${prefix}_child_not_joined`);
    if (value.exit?.code !== 0 || value.exit.signal !== null)
      problems.push(`${prefix}_child_exit`);
    if (value.launchError !== null) problems.push(`${prefix}_launch_error`);
    if (!value.outputWithinLimit) problems.push(`${prefix}_output_limit`);
    if (value.timedOut) problems.push(`${prefix}_timeout`);
    if (value.parseFailure) problems.push(`${prefix}_response_parse`);
  };
  processProblems("normal", input.normal);
  processProblems("cancellation", input.cancellation);
  const normalResults = input.normalExpectedIds.map((id, index) =>
    semanticResult(input.normal.responses[index], id),
  );
  if (input.normal.responses.length !== input.normalExpectedIds.length)
    problems.push("normal_response_count");
  if (normalResults.some((value) => value === null))
    problems.push("normal_response_envelope");
  if (
    normalResults.some(
      (value) =>
        value?.status !== "completed" ||
        value.reason !== "project_runtime_milestone_accepted" ||
        value.cleanupConfirmed !== true ||
        value.manualRecoveryRequired !== false,
    )
  )
    problems.push("normal_semantic_result");
  const cancellationResult = semanticResult(
    input.cancellation.responses[0],
    input.cancellationExpectedId,
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
    cancellationResult.cleanupConfirmed !== true ||
    cancellationResult.manualRecoveryRequired !== false
  )
    problems.push("cancellation_semantic_result");
  const canonicalRepositoryChanged =
    input.cancellationSnapshotBefore.sha256 !==
    input.cancellationSnapshotAfter.sha256;
  if (canonicalRepositoryChanged)
    problems.push("cancellation_canonical_repository_changed");
  if (!input.canonicalAdoptionObserved)
    problems.push("canonical_adoption_not_observed");
  if (input.dockerRecovery.status !== "completed")
    problems.push("post_run_recovery_state_not_clean");
  const completed = problems.length === 0;
  return Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 5,
    status: completed ? "completed" : "blocked",
    reason: completed
      ? "project_runtime_public_mcp_real_providers_and_cancellation_verified"
      : "project_runtime_public_mcp_verification_incomplete",
    problems: Object.freeze(problems),
    runId: input.runId,
    sourceIdentity: input.sourceIdentity,
    distributionIdentity: input.distributionIdentity,
    providers: Object.freeze(["codex", "claude"]),
    publicMcpProcess: Object.freeze({
      actualChildProcess: true,
      transport: "stdio",
      completedObjectiveCount: normalResults.filter(
        (value) => value?.status === "completed",
      ).length,
      childJoined: input.normal.joined,
      inputEofIssued: input.normal.inputEofIssued,
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
    releaseAuthorityConferred: false,
    rawProviderOutputReported: false,
    results: Object.freeze(normalResults),
  });
}
