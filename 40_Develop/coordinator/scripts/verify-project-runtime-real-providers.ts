/**
 * verify-project-runtime-real-providersに属する責務をまとめる。
 *
 * @responsibility stableDirectoryを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveRepositoryRuntimeDataPaths } from "../../runtime-data/src/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../version-control/src/repository-location.ts";
import { inspectRuntimeOwnedDockerTaskRecoveryState } from "../src/security/docker-recovery-runtime.ts";
import {
  inspectBundledCoordinatorPackageFilesystemCandidate,
  inspectVerifiedNativeDistributionCandidate,
} from "../src/security/platform-provisioner-package-filesystem.ts";
import { inspectRepositoryIdentityCandidate } from "../src/security/repository-operation-runtime.ts";
import {
  buildProjectRuntimeRealProviderReport,
  captureCanonicalRepositorySnapshot,
  type JsonRecord,
  observePublicMcpProcess,
} from "./project-runtime-real-provider-contract.ts";

const MARKER =
  "40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-verification.txt";
const CANCELLATION_MARKER =
  "40_Develop/coordinator/tests/fixtures/project-runtime-real-provider-cancellation.txt";
const BASE = "CRDD_PROJECT_RUNTIME_BASE\n";
const FINAL = "CRDD_PROJECT_RUNTIME_REAL_PROVIDER_OK\n";
const MAXIMUM_OUTPUT_BYTES = 4 * 1024 * 1024;
const PROCESS_TIMEOUT_MS = 45 * 60_000;

/**
 * Directoryを安定Identityへ変換する。
 *
 * @responsibility Directoryの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns N/A: stableDirectoryは戻り値を返さない。
 * @precondition 「value: string」がstableDirectoryの入力契約を満たす。
 * @postcondition stableDirectoryの責務を完了して呼出し元へ制御を戻す。
 * @effect stableDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: stableDirectoryは独自の失敗分岐を所有しない。
 * @invariant stableDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: stableDirectoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableDirectoryは共有非同期状態を持たない同期処理である。
 */
function stableDirectory(value: string) {
  const metadata = fs.lstatSync(value);
  assert.equal(metadata.isDirectory() && !metadata.isSymbolicLink(), true);
  assert.equal(fs.realpathSync.native(value), value);
}

/**
 * mcp Envelopeを決定する。
 *
 * @responsibility mcp Envelopeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input id: string、request: unknown
 * @returns mcpEnvelopeの計算結果を返す。
 * @precondition 「id: string、request: unknown」がmcpEnvelopeの入力契約を満たす。
 * @postcondition mcpEnvelopeの責務を完了した結果だけを返す。
 * @effect N/A: mcpEnvelopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: mcpEnvelopeは独自の失敗分岐を所有しない。
 * @invariant mcpEnvelopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: mcpEnvelopeはProcess内の同一Subsystemで完結する。
 * @security N/A: mcpEnvelopeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: mcpEnvelopeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Public Mcp Processを開始する。
 *
 * @responsibility Public Mcp Processの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input distributionRoot: string、repositoryRoot: string
 * @returns startPublicMcpProcessの計算結果を返す。
 * @precondition 「distributionRoot: string、repositoryRoot: string」がstartPublicMcpProcessの入力契約を満たす。
 * @postcondition startPublicMcpProcessの責務を完了した結果だけを返す。
 * @effect startPublicMcpProcessは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: startPublicMcpProcessは独自の失敗分岐を所有しない。
 * @invariant startPublicMcpProcessは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: startPublicMcpProcessはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: startPublicMcpProcessは共有非同期状態を持たない同期処理である。
 */
function startPublicMcpProcess(
  distributionRoot: string,
  repositoryRoot: string,
) {
  return spawn(
    process.execPath,
    [
      path.join(distributionRoot, "template", "tools", "crdd-mcp.ts"),
      "--stdio",
    ],
    {
      cwd: repositoryRoot,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

/**
 * objectiveを決定する。
 *
 * @responsibility objectiveの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input commonFields: JsonRecord、runId: string、provider: "codex" | "claude"、shouldAdoptResult: boolean
 * @returns objectiveの計算結果を返す。
 * @precondition 「commonFields: JsonRecord、runId: string、provider: "codex" | "claude"、shouldAdoptResult: boolean」がobjectiveの入力契約を満たす。
 * @postcondition objectiveの責務を完了した結果だけを返す。
 * @effect N/A: objectiveは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: objectiveは独自の失敗分岐を所有しない。
 * @invariant objectiveは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: objectiveはProcess内の同一Subsystemで完結する。
 * @security N/A: objectiveはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: objectiveは共有非同期状態を持たない同期処理である。
 */
function objective(
  commonFields: JsonRecord,
  runId: string,
  provider: "codex" | "claude",
  shouldAdoptResult: boolean,
) {
  return Object.freeze({
    ...commonFields,
    requestId: `project-runtime-public-${provider}-${runId}`,
    projectId: `crdd-project-runtime-public-${provider}-${runId}`,
    milestoneId: `public-provider-${provider}`,
    requestedExecutorProvider: provider,
    adoptResult: shouldAdoptResult,
  });
}

/**
 * verify-project-runtime-real-providersのCommand処理を開始する。
 *
 * @responsibility verify-project-runtime-real-providersの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns mainの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了した結果だけを返す。
 * @effect mainはFilesystemの読取りまたは書込みを実行する。
 * @failure mainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  if (process.argv.length !== 3)
    throw new Error(
      "usage: verify-project-runtime-real-providers <signed-distribution-root>",
    );
  if (process.platform !== "win32")
    throw new Error("project_runtime_real_recovery_e2e_windows_only");
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

  const verifiedRuntimeRoot = verifyRepositoryRoot(repositoryRoot);
  const runtimePaths =
    verifiedRuntimeRoot.status === "completed"
      ? resolveRepositoryRuntimeDataPaths(verifiedRuntimeRoot.capability)
      : null;
  if (!runtimePaths)
    throw new Error("project_runtime_verification_path_invalid");
  const verificationRoot = runtimePaths.verification;
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
  const commonFields = Object.freeze({
    repositoryRevision: repository.commit,
    objective: `Replace ${MARKER} with the exact required single-line content.`,
    acceptanceCriteria: Object.freeze([
      `The only changed path is ${MARKER}.`,
      `The file contains exactly ${JSON.stringify(FINAL)} as UTF-8 bytes.`,
    ]),
    allowedPaths: Object.freeze([MARKER]),
    readPaths: Object.freeze([
      MARKER,
      "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
    ]),
    maximumConcurrency: 1,
    maximumReplans: 0,
    originLane: "interactive",
  });
  const objectives = Object.freeze([
    objective(commonFields, runId, "codex", false),
    objective(commonFields, runId, "claude", true),
  ]);

  const normalRuns = [];
  for (const [index, request] of objectives.entries()) {
    const snapshotBefore = captureCanonicalRepositorySnapshot(repositoryRoot);
    const child = startPublicMcpProcess(distributionRoot, repositoryRoot);
    let isInputClosed = false;
    const observationPromise = observePublicMcpProcess(child, {
      maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
      timeoutMs: PROCESS_TIMEOUT_MS,
      closeInputWhen: ({ stdout }) => {
        const shouldClose =
          !isInputClosed && stdout.split(/\r?\n/u).filter(Boolean).length >= 1;
        if (shouldClose) isInputClosed = true;
        return shouldClose;
      },
    });
    child.stdin.write(mcpEnvelope(`objective-${index + 1}`, request));
    const observation = await observationPromise;
    const snapshotAfter = captureCanonicalRepositorySnapshot(repositoryRoot);
    const expectedContent = request.adoptResult ? FINAL : BASE;
    normalRuns.push(
      Object.freeze({
        observation,
        expected: Object.freeze({
          responseId: `objective-${index + 1}`,
          requestId: request.requestId,
          projectId: request.projectId,
          milestoneId: request.milestoneId,
          executorProvider: request.requestedExecutorProvider,
          reviewerProvider:
            request.requestedExecutorProvider === "codex" ? "claude" : "codex",
        }),
        snapshotBefore,
        snapshotAfter,
        expectedChangedPaths: Object.freeze(
          request.adoptResult ? [MARKER] : [],
        ),
        expectedCanonicalStateObserved:
          fs.readFileSync(
            path.join(repositoryRoot, ...MARKER.split("/")),
            "utf8",
          ) === expectedContent,
      }),
    );
  }

  const cancellationRequest = Object.freeze({
    ...commonFields,
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
      "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
    ]),
    adoptResult: false,
  });
  const cancellationChild = startPublicMcpProcess(
    distributionRoot,
    repositoryRoot,
  );
  let isCancellationRequestedAfterProcessStart = false;
  const cancellationSnapshotBefore =
    captureCanonicalRepositorySnapshot(repositoryRoot);
  const cancellationObservation = observePublicMcpProcess(cancellationChild, {
    maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
    timeoutMs: PROCESS_TIMEOUT_MS,
    closeInputWhen: ({ stdout }) => stdout.split(/\r?\n/u).some(Boolean),
    onVerifiedRuntimeEvent: (event) => {
      const shouldClose =
        !isCancellationRequestedAfterProcessStart &&
        event.event === "process_started" &&
        event.taskRole === "executor" &&
        event.provider === "claude";
      if (shouldClose) isCancellationRequestedAfterProcessStart = true;
      return shouldClose ? "close_input" : "continue";
    },
  });
  cancellationChild.stdin.write(
    mcpEnvelope("objective-cancellation", cancellationRequest),
  );
  const cancelled = await cancellationObservation;
  const cancellationSnapshotAfter =
    captureCanonicalRepositorySnapshot(repositoryRoot);

  const recoveryRequest = Object.freeze({
    ...commonFields,
    requestId: `project-runtime-public-recovery-${runId}`,
    projectId: `crdd-project-runtime-public-recovery-${runId}`,
    milestoneId: "public-provider-parent-loss-recovery",
    requestedExecutorProvider: "claude" as const,
    objective: `Inspect the allowed inputs and replace ${CANCELLATION_MARKER} with its current exact content.`,
    acceptanceCriteria: Object.freeze([
      `The only allowed path is ${CANCELLATION_MARKER}.`,
      `The file remains exactly ${JSON.stringify(BASE)} as UTF-8 bytes.`,
    ]),
    allowedPaths: Object.freeze([CANCELLATION_MARKER]),
    readPaths: Object.freeze([
      CANCELLATION_MARKER,
      "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
    ]),
    adoptResult: false,
  });
  const recoverySnapshotBefore =
    captureCanonicalRepositorySnapshot(repositoryRoot);
  const parentLossChild = startPublicMcpProcess(
    distributionRoot,
    repositoryRoot,
  );
  let isParentTerminationRequestedAfterProcessStart = false;
  const parentLossObservationPromise = observePublicMcpProcess(
    parentLossChild,
    {
      maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
      timeoutMs: PROCESS_TIMEOUT_MS,
      closeInputWhen: ({ stdout }) => stdout.split(/\r?\n/u).some(Boolean),
      onVerifiedRuntimeEvent: (event) => {
        const shouldTerminate =
          !isParentTerminationRequestedAfterProcessStart &&
          event.event === "process_started" &&
          event.taskRole === "executor" &&
          event.provider === "claude";
        if (shouldTerminate)
          isParentTerminationRequestedAfterProcessStart = true;
        return shouldTerminate ? "terminate_process_tree" : "continue";
      },
    },
  );
  parentLossChild.stdin.write(
    mcpEnvelope("objective-recovery-interrupted", recoveryRequest),
  );
  const parentLossObservation = await parentLossObservationPromise;

  const reentryChild = startPublicMcpProcess(distributionRoot, repositoryRoot);
  let isReentryInputClosed = false;
  const reentryObservationPromise = observePublicMcpProcess(reentryChild, {
    maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
    timeoutMs: PROCESS_TIMEOUT_MS,
    closeInputWhen: ({ stdout }) => {
      const shouldClose =
        !isReentryInputClosed &&
        stdout.split(/\r?\n/u).filter(Boolean).length >= 1;
      if (shouldClose) isReentryInputClosed = true;
      return shouldClose;
    },
  });
  reentryChild.stdin.write(
    mcpEnvelope("objective-recovery-reentry", recoveryRequest),
  );
  const reentryObservation = await reentryObservationPromise;
  const recoverySnapshotAfter =
    captureCanonicalRepositorySnapshot(repositoryRoot);

  const dockerRecovery = inspectRuntimeOwnedDockerTaskRecoveryState();
  const report = buildProjectRuntimeRealProviderReport({
    runId,
    sourceIdentity: Object.freeze({
      commit: repository.commit,
      tree: repository.tree,
    }),
    distributionIdentity,
    normalRuns: Object.freeze(normalRuns),
    cancellation: cancelled,
    cancellationRequestedAfterProcessStart:
      isCancellationRequestedAfterProcessStart,
    cancellationExpected: Object.freeze({
      responseId: "objective-cancellation",
      requestId: cancellationRequest.requestId,
      projectId: cancellationRequest.projectId,
      milestoneId: cancellationRequest.milestoneId,
      executorProvider: "claude" as const,
    }),
    cancellationSnapshotBefore,
    cancellationSnapshotAfter,
    recoverySettlement: Object.freeze({
      parentLoss: parentLossObservation,
      parentTerminationRequestedAfterProcessStart:
        isParentTerminationRequestedAfterProcessStart,
      reentry: reentryObservation,
      expected: Object.freeze({
        responseId: "objective-recovery-reentry",
        requestId: recoveryRequest.requestId,
        projectId: recoveryRequest.projectId,
        milestoneId: recoveryRequest.milestoneId,
        executorProvider: "claude" as const,
        reviewerProvider: "codex" as const,
      }),
      snapshotBefore: recoverySnapshotBefore,
      snapshotAfter: recoverySnapshotAfter,
      expectedCanonicalStateObserved:
        fs.readFileSync(
          path.join(repositoryRoot, ...CANCELLATION_MARKER.split("/")),
          "utf8",
        ) === BASE,
    }),
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
  const verifiedRuntimeRoot = verifyRepositoryRoot(repositoryRoot);
  const runtimePaths =
    verifiedRuntimeRoot.status === "completed"
      ? resolveRepositoryRuntimeDataPaths(verifiedRuntimeRoot.capability)
      : null;
  if (!runtimePaths)
    throw new Error("project_runtime_verification_path_invalid");
  const verificationRoot = runtimePaths.verification;
  fs.mkdirSync(verificationRoot, { recursive: true, mode: 0o700 });
  const report = Object.freeze({
    contract: "crdd-coordinator/project-runtime-real-provider-verification",
    contractRevision: 8,
    status: "blocked",
    reason: "project_runtime_public_mcp_verification_incomplete",
    problems: Object.freeze(["verification_exception"]),
    phase: "verification_unknown",
    childProcessStarted: null,
    childProcessJoined: null,
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    effectState: "unknown",
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
