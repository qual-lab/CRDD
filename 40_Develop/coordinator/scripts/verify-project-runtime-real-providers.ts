import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  cancelRuntimeOwnedDevelopmentProjectRuntimeTask,
  startRuntimeOwnedDevelopmentProjectRuntimeTask,
} from "../src/security/coordinator-task-runtime.ts";
import {
  cancelRuntimeOwnedDevelopmentMeasurementSession,
  requestRuntimeOwnedDevelopmentMeasurementSession,
} from "../src/security/development-measurement-session.ts";
import {
  inspectBundledCoordinatorPackageFilesystemCandidate,
  inspectFixedDevelopmentCoordinatorPackageCandidate,
  inspectVerifiedNativeDistributionCandidate,
} from "../src/security/platform-provisioner-package-filesystem.ts";
import {
  buildProjectRuntimeCoordinatorTaskRequest,
  createDevelopmentProjectRuntimePublicObjectiveCandidate,
} from "../src/security/project-runtime-public-runtime.ts";
import { runMcpProjectRuntimeStdio } from "../src/security/mcp-project-runtime-stdio.ts";
import { openRuntimeOwnedWindowsProjectDecisionStore } from "../src/security/project-runtime-windows-decision-store.ts";
import { inspectRepositoryIdentityCandidate } from "../src/security/repository-operation-runtime.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../src/security/repository-root-resolution.ts";

const MARKER =
  "40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-verification.txt";
const BASE = "CRDD_PROJECT_RUNTIME_BASE\n";
const FINAL = "CRDD_PROJECT_RUNTIME_REAL_PROVIDER_OK\n";
const sourceDistributionRoot = path.resolve(
  fileURLToPath(new URL("../../..", import.meta.url)),
);

function stableDirectory(value: string) {
  const metadata = fs.lstatSync(value);
  assert.equal(metadata.isDirectory() && !metadata.isSymbolicLink(), true);
  assert.equal(fs.realpathSync.native(value), value);
}

async function main() {
  if (process.argv.length !== 3)
    throw new Error(
      "usage: verify-project-runtime-real-providers <v0.18.1-native-distribution-root>",
    );
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  const nativeDistributionRoot = path.resolve(process.argv[2] ?? "");
  stableDirectory(nativeDistributionRoot);
  const repository = inspectRepositoryIdentityCandidate(repositoryRoot);
  assert.equal(repository?.status, "candidate");
  if (repository?.status !== "candidate")
    throw new Error("repository_identity_not_verified");
  const commit = repository.commit;
  const tree = repository.tree;
  assert.equal(
    fs.readFileSync(path.join(repositoryRoot, ...MARKER.split("/")), "utf8"),
    BASE,
  );
  const runtimeRoot = path.join(repositoryRoot, ".crdd");
  const verificationRoot = path.join(runtimeRoot, "verification-results");
  for (const directory of [runtimeRoot, verificationRoot]) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    stableDirectory(directory);
  }

  const nativeModule = (await import(
    pathToFileURL(
      path.join(
        nativeDistributionRoot,
        "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts",
      ),
    ).href
  )) as {
    verifyBundledCoordinatorPackageFromFixedManifestCandidate: (input: {
      evaluationTime: string;
    }) => Readonly<Record<string, unknown>>;
  };
  const native =
    nativeModule.verifyBundledCoordinatorPackageFromFixedManifestCandidate({
      evaluationTime: new Date().toISOString(),
    });
  assert.equal(native.status, "candidate", String(native.reason));
  const expectedNativeRelease = Object.freeze(
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
  const packageObservation =
    inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(packageObservation.status, "candidate");
  if (packageObservation.status !== "candidate")
    throw new Error(packageObservation.reason);
  assert.equal(
    inspectFixedDevelopmentCoordinatorPackageCandidate({
      distributionRoot: sourceDistributionRoot,
      expectedPackageContentRootSha256:
        packageObservation.packageContentRootSha256,
    }).status,
    "candidate",
  );
  assert.equal(
    inspectVerifiedNativeDistributionCandidate({
      distributionRoot: nativeDistributionRoot,
      evaluationTime: new Date().toISOString(),
      expectedRelease: expectedNativeRelease,
    }).status,
    "candidate",
  );

  const common = Object.freeze({
    repositoryRevision: commit,
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
    originLane: "interactive" as const,
  });
  const runId = randomUUID().replaceAll("-", "").slice(0, 16);
  const objectives = Object.freeze([
    Object.freeze({
      ...common,
      requestId: `project-runtime-real-codex-${runId}`,
      projectId: `crdd-project-runtime-real-codex-${runId}`,
      milestoneId: "real-provider-codex",
      requestedExecutorProvider: "codex" as const,
      adoptResult: false,
    }),
    Object.freeze({
      ...common,
      requestId: `project-runtime-real-claude-${runId}`,
      projectId: `crdd-project-runtime-real-claude-${runId}`,
      milestoneId: "real-provider-claude",
      requestedExecutorProvider: "claude" as const,
      adoptResult: true,
    }),
  ]);
  const tasks = objectives.map((objective) =>
    buildProjectRuntimeCoordinatorTaskRequest(
      objective,
      objective.requestedExecutorProvider === "codex" ? "claude" : "codex",
    ),
  );
  const controller = new AbortController();
  const admission = await requestRuntimeOwnedDevelopmentMeasurementSession(
    {
      repositoryRoot,
      expectedCommit: commit,
      expectedTree: tree,
      expectedPackageContentRootSha256:
        packageObservation.packageContentRootSha256,
      nativeDistributionRoot,
      expectedNativeRelease,
      tasks,
      expiresAtMs: Date.now() + 3_600_000,
    },
    controller.signal,
  );
  if (admission.status !== "authorized" || !admission.capability) {
    process.stdout.write(`${JSON.stringify(admission, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }
  const capability = admission.capability;
  const decisionStore = openRuntimeOwnedWindowsProjectDecisionStore({
    developmentContext: capability,
    initializeIfMissing: false,
  });
  assert.equal(decisionStore.status, "completed");
  if (decisionStore.status !== "completed")
    throw new Error("development_decision_store_not_verified");
  const runtime = createDevelopmentProjectRuntimePublicObjectiveCandidate({
    issueTaskAuthority: () => Object.freeze({}),
    startTask: (request, root) =>
      startRuntimeOwnedDevelopmentProjectRuntimeTask(request, root, capability),
    cancelTask: cancelRuntimeOwnedDevelopmentProjectRuntimeTask,
    frontProviderForTask: (provider) =>
      provider === "codex" ? "claude" : "codex",
    openDecisionStore: () => decisionStore,
  });
  const input = new PassThrough();
  const output = new PassThrough();
  output.setEncoding("utf8");
  let pending = "";
  const responses: unknown[] = [];
  output.on("data", (chunk) => {
    pending += String(chunk);
    for (;;) {
      const newline = pending.indexOf("\n");
      if (newline < 0) break;
      const line = pending.slice(0, newline).replace(/\r$/u, "");
      pending = pending.slice(newline + 1);
      if (line) responses.push(JSON.parse(line));
    }
  });
  const mcp = runMcpProjectRuntimeStdio(
    {
      authenticateClient: () =>
        Object.freeze({
          status: "verified",
          principalId: decisionStore.principalId,
        }),
      runObjective: (request, signal) =>
        runtime.run(request, signal, repositoryRoot),
      submitDecision: (request) =>
        Promise.resolve(runtime.runDecision(request, repositoryRoot)),
    },
    input,
    output,
  );
  const envelope = Object.freeze({
    "io.modelcontextprotocol/protocolVersion": "2026-07-28",
    "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
  });
  const waitForResponse = async (count: number) => {
    const deadline = Date.now() + 30 * 60_000;
    while (responses.length < count && Date.now() < deadline)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(responses.length >= count, true);
  };
  const send = (id: string, name: string, request: unknown) =>
    input.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id,
        method: "tools/call",
        params: { _meta: envelope, name, arguments: request },
      })}\n`,
      "utf8",
    );
  try {
    for (let index = 0; index < objectives.length; index += 1) {
      send(`objective-${index + 1}`, "crdd.run_objective", objectives[index]);
      await waitForResponse(index + 1);
    }
    send("decision", "crdd.submit_decision", {
      decisionId: "nonexistent-decision",
      projectId: "nonexistent-project",
      milestoneId: "nonexistent-milestone",
      generation: 1,
      repositoryRevision: commit,
      selectedOption: "cancel",
      continuationCapability: "non-authority-probe",
    });
    await waitForResponse(3);
    input.end();
    const transportResult = await mcp;
    assert.equal(transportResult.status, "completed");
  } finally {
    if (!input.destroyed) input.destroy();
    cancelRuntimeOwnedDevelopmentMeasurementSession(capability);
  }
  const results = responses
    .slice(0, 2)
    .map((response) =>
      response && typeof response === "object" && "result" in response
        ? (response as { result?: { structuredContent?: unknown } }).result
            ?.structuredContent
        : null,
    );
  const decision = responses[2] as
    | { result?: { structuredContent?: { reason?: unknown } } }
    | undefined;
  assert.equal(
    decision?.result?.structuredContent?.reason,
    "project_runtime_decision_not_observed",
  );
  const completed = results.every(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "status" in entry &&
      entry.status === "completed" &&
      "reason" in entry &&
      entry.reason === "project_runtime_milestone_accepted",
  );
  const finalBytes = fs.readFileSync(
    path.join(repositoryRoot, ...MARKER.split("/")),
    "utf8",
  );
  const report = Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 1,
    status: completed && finalBytes === FINAL ? "completed" : "blocked",
    reason:
      completed && finalBytes === FINAL
        ? "project_runtime_real_providers_verified"
        : "project_runtime_real_provider_verification_incomplete",
    sourceCommit: commit,
    sourceTree: tree,
    runId,
    providers: Object.freeze(["codex", "claude"]),
    projectRuntimeOwnedIntegration: true,
    canonicalAdoptionObserved: finalBytes === FINAL,
    mcpProcess: Object.freeze({
      transport: "bounded_stdio_process_contract",
      authenticatedPrincipalObserved: true,
      semanticObjectiveCount: 2,
      invalidDecisionEffect: "no_effect",
      parentEofJoined: true,
    }),
    releaseAuthorityConferred: false,
    results: Object.freeze(results),
  });
  const reportDirectory = path.join(
    verificationRoot,
    `project-runtime-real-providers-${Date.now()}`,
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
