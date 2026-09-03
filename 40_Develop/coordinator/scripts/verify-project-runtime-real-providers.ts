import assert from "node:assert/strict";
import { spawn } from "node:child_process";
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
import {
  buildProjectRuntimeRealProviderReport,
  captureCanonicalRepositorySnapshot,
  observePublicMcpProcess,
  type JsonRecord,
} from "./project-runtime-real-provider-contract.ts";

const MARKER =
  "40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-verification.txt";
const CANCELLATION_MARKER =
  "40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-cancellation.txt";
const BASE = "CRDD_PROJECT_RUNTIME_BASE\n";
const FINAL = "CRDD_PROJECT_RUNTIME_REAL_PROVIDER_OK\n";
const MAXIMUM_OUTPUT_BYTES = 4 * 1024 * 1024;
const PROCESS_TIMEOUT_MS = 45 * 60_000;

function stableDirectory(value: string) {
  const metadata = fs.lstatSync(value);
  assert.equal(metadata.isDirectory() && !metadata.isSymbolicLink(), true);
  assert.equal(fs.realpathSync.native(value), value);
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
  const signedReleaseIdentity = Object.freeze(
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
      expectedRelease: signedReleaseIdentity,
    }).status,
    "candidate",
  );
  const distributionIdentity = Object.freeze({
    ...signedReleaseIdentity,
    sourcePackageStatus: sourcePackage.status,
    sourcePackageReason: sourcePackage.reason,
    verifiedDistributionStatus: "candidate",
    distributionRootReported: false,
  });

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
  const normalObservation = observePublicMcpProcess(normalChild, {
    maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
    timeoutMs: PROCESS_TIMEOUT_MS,
    closeInputWhen: ({ stdout }) => {
      const shouldClose =
        !normalInputClosed &&
        stdout.split(/\r?\n/u).filter(Boolean).length >= objectives.length;
      if (shouldClose) normalInputClosed = true;
      return shouldClose;
    },
  });
  normalChild.stdin.write(
    objectives
      .map((request, index) => mcpEnvelope(`objective-${index + 1}`, request))
      .join(""),
  );
  const normal = await normalObservation;
  const canonicalAdoptionObserved =
    fs.readFileSync(path.join(repositoryRoot, ...MARKER.split("/")), "utf8") ===
    FINAL;

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
  const cancellationSnapshotBefore =
    captureCanonicalRepositorySnapshot(repositoryRoot);
  const cancellationObservation = observePublicMcpProcess(cancellationChild, {
    maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
    timeoutMs: PROCESS_TIMEOUT_MS,
    closeInputWhen: ({ stderr }) => {
      const shouldClose =
        !cancellationRequested &&
        stderr.includes(
          '"event":"coordinator_selection_before_provider_effect"',
        );
      if (shouldClose) cancellationRequested = true;
      return shouldClose;
    },
  });
  cancellationChild.stdin.write(
    mcpEnvelope("objective-cancellation", cancellationRequest),
  );
  const cancelled = await cancellationObservation;
  const cancellationSnapshotAfter =
    captureCanonicalRepositorySnapshot(repositoryRoot);

  const dockerRecovery = inspectRuntimeOwnedDockerTaskRecoveryState();
  const report = buildProjectRuntimeRealProviderReport({
    runId,
    sourceIdentity: Object.freeze({
      commit: repository.commit,
      tree: repository.tree,
    }),
    distributionIdentity,
    normal,
    cancellation: cancelled,
    cancellationRequestedAfterSelection: cancellationRequested,
    normalExpectedIds: Object.freeze(["objective-1", "objective-2"]),
    cancellationExpectedId: "objective-cancellation",
    canonicalAdoptionObserved,
    cancellationSnapshotBefore,
    cancellationSnapshotAfter,
    dockerRecovery,
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

try {
  await main();
} catch {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  const repository = inspectRepositoryIdentityCandidate(repositoryRoot);
  const verificationRoot = path.join(
    repositoryRoot,
    ".crdd",
    "verification-results",
  );
  fs.mkdirSync(verificationRoot, { recursive: true, mode: 0o700 });
  const report = Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 5,
    status: "blocked",
    reason: "project_runtime_public_mcp_verification_incomplete",
    problems: Object.freeze(["verification_exception"]),
    sourceIdentity:
      repository?.status === "candidate"
        ? Object.freeze({ commit: repository.commit, tree: repository.tree })
        : null,
    distributionIdentity: null,
    releaseAuthorityConferred: false,
    rawProviderOutputReported: false,
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
  process.exitCode = 2;
}
