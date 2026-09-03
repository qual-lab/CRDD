import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  inspectBundledCoordinatorPackageFilesystemCandidate,
  inspectVerifiedNativeDistributionCandidate,
} from "../src/security/platform-provisioner-package-filesystem.ts";
import { inspectRuntimeOwnedDockerTaskRecoveryState } from "../src/security/docker-recovery-runtime.ts";
import { inspectRepositoryIdentityCandidate } from "../src/security/repository-operation-runtime.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../src/security/repository-root-resolution.ts";

const MARKER =
  "40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-verification.txt";
const CANCELLATION_MARKER =
  "40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-cancellation.txt";
const BASE = "CRDD_PROJECT_RUNTIME_BASE\n";
const FINAL = "CRDD_PROJECT_RUNTIME_REAL_PROVIDER_OK\n";
const MAXIMUM_OUTPUT_BYTES = 4 * 1024 * 1024;
const PROCESS_TIMEOUT_MS = 45 * 60_000;
type JsonRecord = Readonly<Record<string, unknown>>;

function stableDirectory(value: string) {
  const metadata = fs.lstatSync(value);
  assert.equal(metadata.isDirectory() && !metadata.isSymbolicLink(), true);
  assert.equal(fs.realpathSync.native(value), value);
}

function appendBounded(current: string, chunk: Buffer) {
  if (Buffer.byteLength(current) + chunk.byteLength > MAXIMUM_OUTPUT_BYTES)
    throw new Error("project_runtime_public_e2e_output_too_large");
  return current + chunk.toString("utf8");
}

function mcpEnvelope(id: string, request: unknown) {
  return `${JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      name: "crdd.run_objective",
      arguments: request,
    },
  })}\n`;
}

function publicResult(response: unknown): JsonRecord | null {
  if (!response || typeof response !== "object" || !("result" in response))
    return null;
  const result = (response as { result?: unknown }).result;
  if (!result || typeof result !== "object" || !("structuredContent" in result))
    return null;
  const content = (result as { structuredContent?: unknown }).structuredContent;
  return content && typeof content === "object" && !Array.isArray(content)
    ? (content as JsonRecord)
    : null;
}

function startPublicMcpProcess(
  distributionRoot: string,
  repositoryRoot: string,
) {
  return spawn(
    process.execPath,
    [
      path.join(
        distributionRoot,
        "40_Develop",
        "coordinator",
        "bin",
        "coordinator.ts",
      ),
      "mcp",
      "--stdio",
    ],
    {
      cwd: repositoryRoot,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

async function observePublicMcpProcess(
  child: ChildProcessWithoutNullStreams,
  onStdout?: (content: string) => void,
  onStderr?: (content: string) => void,
) {
  let stdout = "";
  let stderr = "";
  let launchError: string | null = null;
  child.stdout.on("data", (chunk: Buffer) => {
    stdout = appendBounded(stdout, chunk);
    onStdout?.(stdout);
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = appendBounded(stderr, chunk);
    onStderr?.(stderr);
  });
  child.once("error", (error) => {
    launchError = error instanceof Error ? error.name : "unknown";
  });
  let timeout: NodeJS.Timeout | null = null;
  const exit = await new Promise<
    Readonly<{ code: number | null; signal: string | null }>
  >((resolve, reject) => {
    timeout = setTimeout(() => {
      child.kill();
      reject(new Error("project_runtime_public_e2e_process_timeout"));
    }, PROCESS_TIMEOUT_MS);
    child.once("close", (code, signal) => resolve({ code, signal }));
  }).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
  return Object.freeze({
    exit,
    launchError,
    responses: Object.freeze(
      stdout
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => JSON.parse(line) as unknown),
    ),
    selectionEventObserved: stderr.includes(
      '"event":"coordinator_selection_before_provider_effect"',
    ),
  });
}

function objective(
  common: JsonRecord,
  runId: string,
  provider: "codex" | "claude",
  adoptResult: boolean,
) {
  return Object.freeze({
    ...common,
    requestId: `project-runtime-public-${provider}-${runId}`,
    projectId: `crdd-project-runtime-public-${provider}-${runId}`,
    milestoneId: `public-provider-${provider}`,
    requestedExecutorProvider: provider,
    adoptResult,
  });
}

async function main() {
  if (process.argv.length !== 3)
    throw new Error(
      "usage: verify-project-runtime-real-providers <signed-distribution-root>",
    );
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  const distributionRoot = path.resolve(process.argv[2] ?? "");
  stableDirectory(distributionRoot);
  const repository = inspectRepositoryIdentityCandidate(repositoryRoot);
  assert.equal(repository?.status, "candidate");
  if (repository?.status !== "candidate")
    throw new Error("repository_identity_not_verified");
  for (const marker of [MARKER, CANCELLATION_MARKER])
    assert.equal(
      fs.readFileSync(path.join(repositoryRoot, ...marker.split("/")), "utf8"),
      BASE,
    );

  const verificationRoot = path.join(
    repositoryRoot,
    ".crdd",
    "verification-results",
  );
  fs.mkdirSync(verificationRoot, { recursive: true, mode: 0o700 });
  stableDirectory(verificationRoot);

  const nativeModule = (await import(
    pathToFileURL(
      path.join(
        distributionRoot,
        "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts",
      ),
    ).href
  )) as {
    verifyBundledCoordinatorPackageFromFixedManifestCandidate: (input: {
      evaluationTime: string;
    }) => JsonRecord;
  };
  const native =
    nativeModule.verifyBundledCoordinatorPackageFromFixedManifestCandidate({
      evaluationTime: new Date().toISOString(),
    });
  assert.equal(native.status, "candidate", String(native.reason));
  const expectedRelease = Object.freeze(
    Object.fromEntries(
      [
        "manifestHash",
        "releaseSequence",
        "crddVersion",
        "crddCommit",
        "crddTree",
        "packageContentRootSha256",
        "runtimeExecutionIdentitySha256",
      ].map((key) => [key, native[key]]),
    ),
  );
  const sourcePackage = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(sourcePackage.status, "candidate");
  assert.equal(
    inspectVerifiedNativeDistributionCandidate({
      distributionRoot,
      evaluationTime: new Date().toISOString(),
      expectedRelease,
    }).status,
    "candidate",
  );

  const runId = randomUUID().replaceAll("-", "").slice(0, 16);
  const common = Object.freeze({
    repositoryRevision: repository.commit,
    objective: `Replace ${MARKER} with the exact required single-line content.`,
    acceptanceCriteria: Object.freeze([
      `The only changed path is ${MARKER}.`,
      `The file contains exactly ${JSON.stringify(FINAL)} as UTF-8 bytes.`,
    ]),
    allowedPaths: Object.freeze([MARKER]),
    readPaths: Object.freeze([
      MARKER,
      "06_Architecture/coordinator/03_Project_Runtime_Design.md",
    ]),
    maximumConcurrency: 1,
    maximumReplans: 0,
    originLane: "interactive",
  });
  const objectives = Object.freeze([
    objective(common, runId, "codex", false),
    objective(common, runId, "claude", true),
  ]);

  const normalChild = startPublicMcpProcess(distributionRoot, repositoryRoot);
  let normalInputClosed = false;
  const normalObservation = observePublicMcpProcess(normalChild, (stdout) => {
    if (
      !normalInputClosed &&
      stdout.split(/\r?\n/u).filter(Boolean).length >= objectives.length
    ) {
      normalInputClosed = true;
      normalChild.stdin.end();
    }
  });
  normalChild.stdin.write(
    objectives
      .map((request, index) => mcpEnvelope(`objective-${index + 1}`, request))
      .join(""),
  );
  const normal = await normalObservation;
  assert.deepEqual(normal.exit, { code: 0, signal: null });
  assert.equal(normal.launchError, null);
  assert.equal(normal.responses.length, 2);
  const normalResults = normal.responses.map(publicResult);
  assert.equal(
    normalResults.every(
      (result) =>
        result?.status === "completed" &&
        result.reason === "project_runtime_milestone_accepted" &&
        result.cleanupConfirmed === true &&
        result.manualRecoveryRequired === false,
    ),
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(repositoryRoot, ...MARKER.split("/")), "utf8"),
    FINAL,
  );

  const cancellationRequest = Object.freeze({
    ...common,
    requestId: `project-runtime-public-cancel-${runId}`,
    projectId: `crdd-project-runtime-public-cancel-${runId}`,
    milestoneId: "public-provider-cancellation",
    requestedExecutorProvider: "claude",
    objective: `Replace ${CANCELLATION_MARKER} after carefully inspecting all allowed inputs.`,
    acceptanceCriteria: Object.freeze([
      `The only changed path is ${CANCELLATION_MARKER}.`,
      "The task remains active long enough for the MCP parent to cancel it.",
    ]),
    allowedPaths: Object.freeze([CANCELLATION_MARKER]),
    readPaths: Object.freeze([
      CANCELLATION_MARKER,
      "06_Architecture/coordinator/03_Project_Runtime_Design.md",
    ]),
    adoptResult: false,
  });
  const cancellationChild = startPublicMcpProcess(
    distributionRoot,
    repositoryRoot,
  );
  let cancellationRequested = false;
  const cancellationObservation = observePublicMcpProcess(
    cancellationChild,
    undefined,
    (stderr) => {
      if (
        !cancellationRequested &&
        stderr.includes(
          '"event":"coordinator_selection_before_provider_effect"',
        )
      ) {
        cancellationRequested = true;
        cancellationChild.stdin.end();
      }
    },
  );
  cancellationChild.stdin.write(
    mcpEnvelope("objective-cancellation", cancellationRequest),
  );
  const cancelled = await cancellationObservation;
  assert.equal(cancellationRequested, true);
  assert.deepEqual(cancelled.exit, { code: 0, signal: null });
  assert.equal(cancelled.launchError, null);
  assert.equal(cancelled.responses.length, 1);
  const cancellationResult = publicResult(cancelled.responses[0]);
  assert.equal(cancellationResult?.status, "cancelled");
  assert.equal(cancellationResult.cleanupConfirmed, true);
  assert.equal(cancellationResult.manualRecoveryRequired, false);
  assert.equal(
    fs.readFileSync(
      path.join(repositoryRoot, ...CANCELLATION_MARKER.split("/")),
      "utf8",
    ),
    BASE,
  );

  const dockerRecovery = inspectRuntimeOwnedDockerTaskRecoveryState();
  const report = Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 4,
    status: dockerRecovery.status === "completed" ? "completed" : "blocked",
    reason:
      dockerRecovery.status === "completed"
        ? "project_runtime_public_mcp_real_providers_and_cancellation_verified"
        : "project_runtime_public_mcp_post_run_recovery_state_not_clean",
    sourceCommit: repository.commit,
    sourceTree: repository.tree,
    runId,
    providers: Object.freeze(["codex", "claude"]),
    publicMcpProcess: Object.freeze({
      actualChildProcess: true,
      transport: "stdio",
      authenticatedSemanticResults: true,
      completedObjectiveCount: normalResults.length,
      parentEofJoined: true,
    }),
    cancellation: Object.freeze({
      providerSelectionObservedBeforeCancellation: true,
      parentEofIssued: true,
      semanticStatus: cancellationResult.status,
      cleanupConfirmed: cancellationResult.cleanupConfirmed,
      manualRecoveryRequired: cancellationResult.manualRecoveryRequired,
      canonicalRepositoryChanged: false,
    }),
    dockerRecoveryAfterRun: Object.freeze({
      status: dockerRecovery.status,
      reason: dockerRecovery.reason,
      manualRecoveryRequired: dockerRecovery.manualRecoveryRequired,
      recoverySettlementExercised: false,
    }),
    canonicalAdoptionObserved: true,
    releaseAuthorityConferred: false,
    rawProviderOutputReported: false,
    results: Object.freeze(normalResults),
  });
  const reportDirectory = path.join(
    verificationRoot,
    `project-runtime-public-real-providers-${Date.now()}`,
  );
  fs.mkdirSync(reportDirectory, { mode: 0o700 });
  fs.writeFileSync(
    path.join(reportDirectory, "result.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    { flag: "wx", encoding: "utf8", mode: 0o600 },
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === "completed" ? 0 : 2;
}

await main();
