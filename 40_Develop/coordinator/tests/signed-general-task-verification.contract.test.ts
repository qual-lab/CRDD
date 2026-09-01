import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createScanner, SyntaxKind } from "typescript/unstable/ast";

import {
  bindSignedGeneralTaskCancellation,
  createSignedGeneralTaskVerificationRequest,
  describeSignedGeneralTaskVerificationContract,
  runSignedGeneralTaskVerification,
} from "../scripts/verify-signed-general-task.ts";

const TARGET_PATH =
  "40_Develop/coordinator/runtime/general-task-verification.txt";
const BASE_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_BASE\n";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const candidateId = `candidate.${"1".repeat(64)}.${"2".repeat(64)}`;
const baseCommit = "a".repeat(40);
const baseTree = "b".repeat(40);
const signedSourceCommit = "1".repeat(40);
const signedSourceTree = "2".repeat(40);
const baseManifestHash = "c".repeat(64);
const contentManifestHash = "d".repeat(64);
const allowedPathsHash = "e".repeat(64);
const hostRecoveryA = `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;
const hostRecoveryB = `host.crdd-coordinator-doctor-b.12345678-1234-4234-8234-123456789abc.${"b".repeat(64)}`;
const dockerRecoveryA = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
const dockerRecoveryB = `docker-task.${"4".repeat(64)}.${"5".repeat(64)}.${"6".repeat(64)}`;
const dockerRecoveryC = `docker-task.${"7".repeat(64)}.${"8".repeat(64)}.${"9".repeat(64)}`;
const candidateRecoveryA = `candidate-recovery.${"a".repeat(64)}.${"b".repeat(64)}`;
const candidateRecoveryB = `candidate-recovery.${"c".repeat(64)}.${"d".repeat(64)}`;
const candidateStoreRecoveryA = `candidate-store-recovery.${"e".repeat(64)}`;
const patchHash = createHash("sha256")
  .update("crdd-candidate-revision-v1\0")
  .update(baseCommit)
  .update("\0")
  .update(baseTree)
  .update("\0")
  .update(baseManifestHash)
  .update("\0")
  .update(contentManifestHash)
  .update("\0")
  .update(allowedPathsHash)
  .update("\0")
  .update(TARGET_PATH)
  .digest("hex");

const NONLITERAL_DYNAMIC_IMPORT = "<nonliteral-dynamic-import>";

function importedModuleSpecifiers(source: string) {
  const scanner = createScanner(true, undefined, source);
  const tokens: Array<Readonly<{ kind: SyntaxKind; value: string }>> = [];
  for (;;) {
    const kind = scanner.scan();
    if (kind === SyntaxKind.EndOfFile) break;
    tokens.push(Object.freeze({ kind, value: scanner.getTokenValue() }));
  }
  const specifiers: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) continue;
    if (token.kind === SyntaxKind.ImportKeyword) {
      const next = tokens[index + 1];
      if (next?.kind === SyntaxKind.OpenParenToken) {
        const argument = tokens[index + 2];
        specifiers.push(
          argument?.kind === SyntaxKind.StringLiteral
            ? argument.value
            : NONLITERAL_DYNAMIC_IMPORT,
        );
        continue;
      }
      if (next?.kind === SyntaxKind.StringLiteral) {
        specifiers.push(next.value);
        continue;
      }
    }
    if (
      token.kind !== SyntaxKind.ImportKeyword &&
      token.kind !== SyntaxKind.ExportKeyword
    ) {
      continue;
    }
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const candidate = tokens[cursor];
      if (!candidate) break;
      if (candidate.kind === SyntaxKind.SemicolonToken) break;
      if (
        cursor > index + 1 &&
        (candidate.kind === SyntaxKind.ImportKeyword ||
          candidate.kind === SyntaxKind.ExportKeyword)
      ) {
        break;
      }
      if (candidate.kind !== SyntaxKind.FromKeyword) continue;
      const moduleSpecifier = tokens[cursor + 1];
      if (moduleSpecifier?.kind === SyntaxKind.StringLiteral)
        specifiers.push(moduleSpecifier.value);
      break;
    }
  }
  return specifiers;
}

function resolvesToForbiddenWindowsAsciiModule(
  importerPath: string,
  moduleSpecifier: string,
  forbiddenModuleSpecifier: string,
) {
  if (!moduleSpecifier.startsWith(".")) return false;
  const importerDirectory = path.dirname(importerPath);
  const observed = path
    .resolve(importerDirectory, moduleSpecifier)
    .toLowerCase();
  const forbidden = path
    .resolve(importerDirectory, forbiddenModuleSpecifier)
    .toLowerCase();
  return observed === forbidden;
}

function release(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    status: "candidate",
    stableFilesystemIdentityObserved: true,
    runtimeOwnedPackageRoot: true,
    manifestHash: "f".repeat(64),
    packageContentRootSha256: "0".repeat(64),
    qualLabManifestCryptographicMatch: true,
    runtimeOwnedReleaseTrustConfirmed: true,
    releaseIdentityRuntimeOwned: true,
    crddDistributionConfirmed: true,
    crddVersion: "v0.18.0",
    releaseSequence: 1,
    crddCommit: baseCommit,
    crddTree: baseTree,
    ...overrides,
  });
}

function taskResult(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_candidate_approved",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
    executorProvider: "claude",
    reviewerProvider: "codex",
    reviewerIndependence: "provider_independent",
    externalSendAuthorizationMode: "interactive_initial_consent",
    remediationPerformed: false,
    candidateRevision: Object.freeze({
      baseCommit,
      baseTree,
      patchHash,
      contentManifestHash,
      allowedPathsHash,
      changedPaths: Object.freeze([TARGET_PATH]),
    }),
    executorResult: Object.freeze({
      changedPaths: Object.freeze([TARGET_PATH]),
    }),
    reviewerResult: Object.freeze({ decision: "approved", findingCount: 0 }),
    canonicalRepositoryChanged: false,
    rawOutputReported: false,
    hostPathReported: false,
    untrustedProviderTextReported: false,
    hostRecoveryId: null,
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateStoreRecoveryId: null,
    candidateId,
    ...overrides,
  });
}

function candidate(content = EXPECTED_CONTENT) {
  const bytes = Buffer.from(content, "utf8");
  return Object.freeze({
    status: "exported",
    candidateId,
    bundle: Object.freeze({
      schema: "crdd-coordinator-candidate-bundle/v1",
      baseCommit,
      baseTree,
      baseManifestHash,
      patchHash,
      contentManifestHash,
      allowedPathsHash,
      changedPaths: Object.freeze([TARGET_PATH]),
      entries: Object.freeze([
        Object.freeze({
          relativePath: TARGET_PATH,
          operation: "upsert",
          byteLength: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          contentBase64: bytes.toString("base64"),
        }),
      ]),
    }),
  });
}

function dependencies(
  options: {
    release?: Readonly<Record<string, unknown>>;
    result?: Readonly<Record<string, unknown>>;
    candidate?: Readonly<Record<string, unknown>> | null;
    discard?: Readonly<Record<string, unknown>>;
    repositoryRevisions?: ReadonlyArray<Readonly<
      Record<string, unknown>
    > | null>;
    runtimeVersion?: string;
    completionRejects?: boolean;
    readThrows?: boolean;
    discardThrows?: boolean;
    baseContent?: string | Buffer;
    readBaseThrows?: boolean;
    cancellationRequested?: boolean;
    cancelDelayMs?: number;
    cancelReceipt?: Readonly<Record<string, unknown>>;
    isolatedSettlementTiming?: Readonly<{
      cancelAckTimeoutMs: number;
      cancelCompletionTimeoutMs: number;
      orphanedStartObservationTimeoutMs: number;
    }>;
  } = {},
) {
  const calls = {
    events: [] as string[],
    verifies: 0,
    starts: 0,
    reads: 0,
    discards: 0,
    repositoryRevisionObservations: 0,
    bound: 0,
    unbound: 0,
    cancels: 0,
    issuedCapability: null as object | null,
    passedCapability: null as unknown,
    passedRequest: null as unknown,
  };
  return Object.freeze({
    calls,
    value: Object.freeze({
      issuePackageCapability: () => {
        calls.events.push("package");
        calls.verifies += 1;
        const capability = Object.freeze({});
        calls.issuedCapability = capability;
        return Object.freeze({
          verification: options.release ?? release(),
          capability,
        });
      },
      startTask: (request: unknown, _root: string, capability: unknown) => {
        calls.events.push("task");
        calls.starts += 1;
        calls.passedRequest = request;
        calls.passedCapability = capability;
        return Object.freeze({
          controlCapability: Object.freeze({}),
          completion: options.completionRejects
            ? Promise.reject(new Error("fixture_completion_rejected"))
            : Promise.resolve(options.result ?? taskResult()),
        });
      },
      cancelTask: async () => {
        calls.cancels += 1;
        if (options.cancelDelayMs)
          await new Promise((resolve) =>
            setTimeout(resolve, options.cancelDelayMs),
          );
        return (
          options.cancelReceipt ??
          Object.freeze({
            status: "requested",
            reason: "provider_cancellation_requested",
            cancellationRequested: true,
            processTerminationObserved: true,
          })
        );
      },
      readCandidate: () => {
        calls.reads += 1;
        if (options.readThrows) throw new Error("fixture_read_failed");
        return options.candidate === undefined
          ? candidate()
          : options.candidate;
      },
      discardCandidate: () => {
        calls.discards += 1;
        if (options.discardThrows) throw new Error("fixture_discard_failed");
        return options.discard ?? Object.freeze({ status: "discarded" });
      },
      inspectRepositoryRevision: () => {
        const observationIndex = calls.repositoryRevisionObservations;
        calls.repositoryRevisionObservations += 1;
        const observations = options.repositoryRevisions;
        if (observations) return observations[observationIndex] ?? null;
        return Object.freeze({
          status: "candidate",
          commit: baseCommit,
          tree: baseTree,
        });
      },
      readBaseContent: () => {
        if (options.readBaseThrows) throw new Error("fixture_base_read_failed");
        return Buffer.isBuffer(options.baseContent)
          ? Buffer.from(options.baseContent)
          : Buffer.from(options.baseContent ?? BASE_CONTENT, "utf8");
      },
      now: () => "2026-08-25T00:00:00.000Z",
      runtimeVersion: () => {
        calls.events.push("node");
        return options.runtimeVersion ?? "24.19.0";
      },
      bindCancellation: () => {
        calls.bound += 1;
        return Object.freeze({
          unbind: () => {
            calls.unbound += 1;
          },
          requested: () => options.cancellationRequested ?? false,
          requestedPromise: options.cancellationRequested
            ? Promise.resolve()
            : new Promise<void>(() => undefined),
        });
      },
      isolatedSettlementTiming:
        options.isolatedSettlementTiming ??
        Object.freeze({
          cancelAckTimeoutMs: 100,
          cancelCompletionTimeoutMs: 100,
          orphanedStartObservationTimeoutMs: 100,
        }),
    }),
  });
}

test("固定公開Taskをprocess内で構成しShell搬送を契約から除外する", () => {
  const verificationFixture = fs.readFileSync(
    path.join(coordinatorRoot, "runtime/general-task-verification.txt"),
  );
  assert.deepEqual(verificationFixture, Buffer.from(BASE_CONTENT, "utf8"));
  assert.equal(verificationFixture.byteLength, 35);
  assert.match(
    fs.readFileSync(
      path.resolve(coordinatorRoot, "../..", ".gitattributes"),
      "utf8",
    ),
    /^40_Develop\/coordinator\/runtime\/general-task-verification\.txt text eol=lf$/m,
  );

  const request = createSignedGeneralTaskVerificationRequest();
  assert.deepEqual(request, {
    frontProvider: "codex",
    requestedExecutorProvider: "claude",
    objective:
      "Replace the one existing bounded verification marker from BASE to OK.",
    acceptanceCriteria: [
      `The visible candidate marker is located at ${TARGET_PATH}; the runtime and signed runner separately verify that no other path changed.`,
      `The base revision contains exactly ${JSON.stringify(BASE_CONTENT.trimEnd())}; replace only its final BASE token with OK instead of recreating or reformatting the file.`,
      `The visible file content is exactly the single line ${JSON.stringify(EXPECTED_CONTENT.trimEnd())}, with no additional text. Review this visible content and the bounded replacement; exact UTF-8 bytes, trailing LF, byte length and SHA-256 are separate checks owned by the route verification runner, not proof requested from the reviewer. Do not claim those separate checks have run.`,
    ],
    allowedPaths: [TARGET_PATH],
    readPaths: ["06_Architecture/coordinator/01_Architecture.md", TARGET_PATH],
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });

  const contract = describeSignedGeneralTaskVerificationContract();
  assert.equal(contract.contractRevision, 20);
  assert.equal(
    contract.verificationFixture,
    "tracked_base_marker_exact_token_replacement_with_independent_final_byte_verification",
  );
  assert.equal(
    contract.boundedRemediation,
    "zero_or_one_runtime_owned_remediation_then_same_independent_reviewer_approval_required",
  );
  assert.equal(
    contract.resultMismatchDiagnostic,
    "fixed_contract_field_identifier_only_no_provider_text_path_or_credential",
  );
  assert.equal(
    contract.candidateMismatchDiagnostic,
    "fixed_candidate_contract_or_public_fixture_byte_identifier_only_no_candidate_bytes_provider_text_path_or_credential",
  );
  assert.equal(contract.requestShellTransportAllowed, false);
  assert.equal(contract.powershellTextPipelineAllowed, false);
  assert.equal(
    contract.baseContentPreflight,
    "exact_tracked_lf_bytes_verified_before_task_or_provider_effect",
  );
  assert.equal(contract.temporaryRequestFileAllowed, false);
  assert.equal(contract.longShellCommandReconstructionAllowed, false);
  assert.equal(contract.normalTaskStdinContractChanged, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
  assert.deepEqual(contract.providerRoutes, [
    "front_codex__executor_claude__reviewer_codex",
    "front_claude__executor_codex__reviewer_claude",
    "front_codex__executor_codex__reviewer_claude",
    "front_claude__executor_claude__reviewer_codex",
  ]);
  assert.equal(contract.defaultRouteProfile, "forward");
  assert.equal(contract.minimumNodeVersion, "24.12.0");
  assert.equal(contract.nodeSelection, "absolute_preverified_executable_only");
  assert.equal(contract.availabilityOnlyConsolePreflightAllowed, false);
  assert.deepEqual(contract.cancellationSettlement, {
    acknowledgmentTimeoutMs: 10_000,
    completionTimeoutMs: 240_000,
    orphanedStartObservationTimeoutMs: 240_000,
    ordering: "acknowledgment_then_completion",
    productionOverrideAllowed: false,
  });
  assert.equal(
    contract.interactiveConsoleGate,
    "runtime_owned_initial_consent_confirmation_only_reused_consent_requires_no_console",
  );
  assert.equal(
    contract.packageCapabilityUse,
    "runtime_local_nonserializable_nonexported_passed_once_to_task_runtime_after_release_verification",
  );
  const runnerPath = path.join(
    coordinatorRoot,
    "scripts/verify-signed-general-task.ts",
  );
  const source = fs.readFileSync(runnerPath, "utf8");
  const forbiddenConsoleModule = "../src/core/interactive-console.ts";
  const equivalentConsoleModule = "../src/core/./INTERACTIVE-console.ts";
  const mutationImports = importedModuleSpecifiers(
    `import { interactiveConsoleAvailable as renamed } from ${JSON.stringify(forbiddenConsoleModule)};\n` +
      `export { interactiveConsoleAvailabilityOutcome } from ${JSON.stringify(forbiddenConsoleModule)};\n` +
      `void import(${JSON.stringify(forbiddenConsoleModule)});\n` +
      `import { interactiveConsoleAvailable as equivalent } from ${JSON.stringify(equivalentConsoleModule)};\n` +
      "void import(runtimeSelectedModule);\n",
  );
  assert.deepEqual(mutationImports, [
    forbiddenConsoleModule,
    forbiddenConsoleModule,
    forbiddenConsoleModule,
    equivalentConsoleModule,
    NONLITERAL_DYNAMIC_IMPORT,
  ]);
  const runnerImports = importedModuleSpecifiers(source);
  assert.equal(runnerImports.includes(NONLITERAL_DYNAMIC_IMPORT), false);
  assert.equal(
    mutationImports
      .slice(0, -1)
      .every((moduleSpecifier) =>
        resolvesToForbiddenWindowsAsciiModule(
          runnerPath,
          moduleSpecifier,
          forbiddenConsoleModule,
        ),
      ),
    true,
  );
  assert.equal(
    resolvesToForbiddenWindowsAsciiModule(
      runnerPath,
      "../src/core/interactive-console-reader.ts",
      forbiddenConsoleModule,
    ),
    false,
  );
  assert.equal(
    runnerImports.some((moduleSpecifier) =>
      resolvesToForbiddenWindowsAsciiModule(
        runnerPath,
        moduleSpecifier,
        forbiddenConsoleModule,
      ),
    ),
    false,
  );
});

test("CLIは余分argvを単一JSONとexit 2でEffect前に拒否する", () => {
  const script = path.join(
    coordinatorRoot,
    "scripts/verify-signed-general-task.ts",
  );
  const result = spawnSync(process.execPath, [script, "unexpected"], {
    cwd: coordinatorRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const parsed = JSON.parse(result.stdout) as Readonly<Record<string, unknown>>;
  assert.equal(parsed.status, "blocked");
  assert.equal(
    parsed.reason,
    "signed_general_task_verification_arguments_invalid",
  );
  assert.equal(parsed.canonicalRepositoryChanged, false);
});

test("CLIのRoute grammarは引数なしと三つのexact profileだけを許可する", () => {
  const script = path.join(
    coordinatorRoot,
    "scripts/verify-signed-general-task.ts",
  );
  for (const args of [
    ["--route"],
    ["--route", "forward"],
    ["--route", "claude"],
    ["--route", "same-codex", "extra"],
    ["--route", "reverse", "extra"],
  ]) {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: coordinatorRoot,
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    assert.equal(result.status, 2);
    assert.equal(result.stderr, "");
    const parsed = JSON.parse(result.stdout) as Readonly<
      Record<string, unknown>
    >;
    assert.equal(
      parsed.reason,
      "signed_general_task_verification_arguments_invalid",
    );
  }
});

test("Node GateとPackage GateはTask前に拒否しavailability-only Console Effectを持たない", async () => {
  for (const fixture of [
    dependencies({ runtimeVersion: "24.11.9" }),
    dependencies({ runtimeVersion: "22.18.0" }),
  ]) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(fixture.calls.verifies, 0);
    assert.equal(fixture.calls.starts, 0);
    assert.deepEqual(fixture.calls.events, ["node"]);
  }
});

test("初回同意のConsole不成立はTask所有Gateの結果としてFail Closedに伝播する", async () => {
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_external_send_confirmation_unavailable",
      candidateId: null,
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_external_send_confirmation_unavailable",
  );
  assert.equal(fixture.calls.starts, 1);
  assert.deepEqual(fixture.calls.events, ["node", "package", "task"]);
});

test("署名Release不成立時はTaskを開始しない", async () => {
  const fixture = dependencies({
    release: release({ runtimeOwnedReleaseTrustConfirmed: false }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "signed_general_task_release_verification_failed",
  );
  assert.equal(fixture.calls.starts, 0);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 0);
  assert.deepEqual(fixture.calls.events, ["node", "package"]);
});

test("SHA-256 CRDD Release Identityはv1能力外としてTask Effect前に明示拒否する", async () => {
  const fixture = dependencies({
    release: release({
      crddCommit: "a".repeat(64),
      crddTree: "b".repeat(64),
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "signed_general_task_git_object_format_unsupported",
  );
  assert.equal(fixture.calls.verifies, 1);
  assert.equal(fixture.calls.starts, 0);
  assert.equal(fixture.calls.bound, 0);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 0);
  assert.deepEqual(fixture.calls.events, ["node", "package"]);
});

test("固定基準byteのCRLF変換・欠落・読取失敗はProvider Effect前に停止する", async () => {
  for (const baseContent of [
    "CRDD_COORDINATOR_GENERAL_TASK_BASE\r\n",
    "CRDD_COORDINATOR_GENERAL_TASK_BASE",
    Buffer.alloc(0),
  ]) {
    const fixture = dependencies({ baseContent });
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "signed_general_task_base_content_mismatch");
    assert.equal(fixture.calls.starts, 0);
    assert.equal(fixture.calls.reads, 0);
    assert.equal(fixture.calls.discards, 0);
    assert.deepEqual(fixture.calls.events, ["node", "package"]);
  }
  const unreadable = dependencies({ readBaseThrows: true });
  const unreadableResult = await runSignedGeneralTaskVerification(
    path.resolve("."),
    unreadable.value,
  );
  assert.equal(unreadableResult.status, "blocked");
  assert.equal(
    unreadableResult.reason,
    "signed_general_task_base_content_mismatch",
  );
  assert.equal(unreadable.calls.starts, 0);
});

test("Claude実装、Codex独立Review、exact Candidate、discardを一つのPassへ結合する", async () => {
  const fixture = dependencies();
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "signed_general_task_verification_completed");
  assert.equal(result.exactCandidateContentVerified, true);
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.candidateDisposition, "discarded");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.remediationPerformed, false);
  assert.deepEqual(fixture.calls.events, ["node", "package", "task"]);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.canonicalRepositoryChanged, false);
  assert.deepEqual(result.changedPaths, [TARGET_PATH]);
  assert.equal(result.crddCommit, baseCommit);
  assert.equal(result.crddTree, baseTree);
  assert.equal(result.executionCommit, baseCommit);
  assert.equal(result.executionTree, baseTree);
  assert.equal(fixture.calls.starts, 1);
  assert.equal(fixture.calls.passedCapability, fixture.calls.issuedCapability);
  assert.equal(fixture.calls.reads, 1);
  assert.equal(fixture.calls.discards, 1);
  assert.equal(fixture.calls.bound, 1);
  assert.equal(fixture.calls.unbound, 1);
  assert.equal(fixture.calls.repositoryRevisionObservations, 2);
});

test("署名Source Aとmanifest追加後の実行Commit Bを分離し候補をBへ結合する", async () => {
  const fixture = dependencies({
    release: release({
      crddCommit: signedSourceCommit,
      crddTree: signedSourceTree,
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.crddCommit, signedSourceCommit);
  assert.equal(result.crddTree, signedSourceTree);
  assert.equal(result.executionCommit, baseCommit);
  assert.equal(result.executionTree, baseTree);
  assert.equal(fixture.calls.repositoryRevisionObservations, 2);
  assert.equal(fixture.calls.discards, 1);
});

test("候補が実行Commit Bでなく署名Source Aをbaseにした場合は破棄して拒否する", async () => {
  const fixture = dependencies({
    release: release({
      crddCommit: signedSourceCommit,
      crddTree: signedSourceTree,
    }),
    result: taskResult({
      candidateRevision: Object.freeze({
        baseCommit: signedSourceCommit,
        baseTree: signedSourceTree,
        patchHash,
        contentManifestHash,
        allowedPathsHash,
        changedPaths: Object.freeze([TARGET_PATH]),
      }),
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.resultContractMismatch, "candidate_base_commit");
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.cleanupConfirmed, true);
});

test("実行中にCanonical RepositoryのCommitが変化した場合は候補破棄後に拒否する", async () => {
  const fixture = dependencies({
    repositoryRevisions: Object.freeze([
      Object.freeze({
        status: "candidate",
        commit: baseCommit,
        tree: baseTree,
      }),
      Object.freeze({
        status: "candidate",
        commit: "9".repeat(40),
        tree: baseTree,
      }),
    ]),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.resultContractMismatch,
    "execution_repository_commit_changed",
  );
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(fixture.calls.repositoryRevisionObservations, 2);
});

test("実行Repository RevisionをTask前に観測できなければProvider Effectを発行しない", async () => {
  const fixture = dependencies({
    repositoryRevisions: Object.freeze([null]),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "signed_general_task_repository_revision_observation_failed",
  );
  assert.equal(fixture.calls.starts, 0);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 0);
});

test("一回是正後の同じ独立Reviewer承認もexact Candidate成功として保持する", async () => {
  const fixture = dependencies({
    result: taskResult({ remediationPerformed: true }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.remediationPerformed, true);
  assert.equal(result.exactCandidateContentVerified, true);
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.canonicalRepositoryChanged, false);
});

test("安全な業務拒否は空Recoveryを曖昧化せず再実行可否を判定可能にする", async () => {
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_independent_review_not_approved",
      candidateId: null,
      candidateDisposition: "not_issued",
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_independent_review_not_approved",
  );
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.candidateDiscarded, false);
  assert.equal(result.candidateDisposition, "not_issued");
  assert.equal(
    result.externalSendAuthorizationMode,
    "interactive_initial_consent",
  );
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processRestartRequired, false);
  assert.equal(result.recoveryIdentityAmbiguous, false);
  assert.equal(result.candidateRecoveryId, null);
  assert.deepEqual(result.candidateRecoveryIds, []);
  assert.equal(result.candidateStoreRecoveryId, null);
  assert.deepEqual(result.candidateStoreRecoveryIds, []);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 0);
});

test("exact Candidate破棄後の内容不一致は候補Recoveryを残存扱いしない", async () => {
  const fixture = dependencies({ candidate: candidate("different\n") });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "signed_general_task_candidate_content_mismatch");
  assert.equal(result.candidateContractMismatch, "candidate_content_bytes");
  assert.equal(
    result.externalSendAuthorizationMode,
    "interactive_initial_consent",
  );
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.candidateDisposition, "discarded");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.processRestartRequired, false);
  assert.equal(result.recoveryIdentityAmbiguous, false);
  assert.equal(result.candidateRecoveryId, null);
  assert.deepEqual(result.candidateRecoveryIds, []);
  assert.equal(result.candidateStoreRecoveryId, null);
  assert.deepEqual(result.candidateStoreRecoveryIds, []);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(fixture.calls.discards, 1);
});

test("公開fixtureの改行・終端・未置換差はbyteを出さず固定分類する", async () => {
  for (const [content, expectedMismatch] of [
    ["CRDD_COORDINATOR_GENERAL_TASK_OK\r\n", "candidate_content_crlf"],
    ["CRDD_COORDINATOR_GENERAL_TASK_OK", "candidate_content_missing_lf"],
    [BASE_CONTENT, "candidate_content_base_unchanged"],
    [`${EXPECTED_CONTENT}\n`, "candidate_content_bytes"],
    [`\ufeff${EXPECTED_CONTENT}`, "candidate_content_bytes"],
  ] as const) {
    const fixture = dependencies({ candidate: candidate(content) });
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "signed_general_task_candidate_content_mismatch",
    );
    assert.equal(result.candidateContractMismatch, expectedMismatch);
    assert.equal(result.candidateDiscarded, true);
    assert.equal(result.rawProviderOutputReported, false);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.manualRecoveryRequired, false);
  }
});

test("Reviewer承認済みでもRunnerがbyte長・digestの不一致を独立拒否する", async () => {
  for (const [field, value, expectedMismatch] of [
    ["byteLength", 32, "candidate_byte_length"],
    ["sha256", "0".repeat(64), "candidate_sha256"],
  ] as const) {
    const valid = candidate();
    const fixture = dependencies({
      candidate: {
        ...valid,
        bundle: {
          ...valid.bundle,
          entries: [{ ...valid.bundle.entries[0], [field]: value }],
        },
      },
    });
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.candidateContractMismatch, expectedMismatch);
    assert.equal(result.candidateDiscarded, true);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.manualRecoveryRequired, false);
    assert.equal(fixture.calls.discards, 1);
  }
});

test("変更Pathの最終Authorityは複製Resultでなくexact Candidate Bundleに固定する", async () => {
  const fixture = dependencies({
    result: taskResult({
      candidateRevision: Object.freeze({
        baseCommit,
        baseTree,
        patchHash,
        contentManifestHash,
        allowedPathsHash,
        changedPaths: Object.freeze([]),
      }),
      executorResult: Object.freeze({ changedPaths: Object.freeze([]) }),
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.exactCandidateContentVerified, true);
  assert.deepEqual(result.changedPaths, [TARGET_PATH]);
  assert.equal(result.candidateDiscarded, true);
  assert.equal(fixture.calls.reads, 1);
  assert.equal(fixture.calls.discards, 1);
});

test("正常候補の契約差はProvider本文を出さず固定field名だけで診断する", async () => {
  const fixture = dependencies({
    result: taskResult({
      candidateRevision: Object.freeze({
        baseCommit,
        baseTree: "9".repeat(40),
        patchHash,
        contentManifestHash,
        allowedPathsHash,
        changedPaths: Object.freeze([TARGET_PATH]),
      }),
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "signed_general_task_result_contract_mismatch");
  assert.equal(result.resultContractMismatch, "candidate_base_tree");
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.rawProviderOutputReported, false);
  assert.equal(result.hostPathReported, false);
  assert.equal(result.credentialReported, false);
});

test("是正履歴の欠落または型差を成功へ昇格しない", async () => {
  for (const remediationPerformed of [undefined, null, "true", 1]) {
    const fixture = dependencies({
      result: taskResult({ remediationPerformed }),
    });
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.resultContractMismatch, "remediation_performed");
    assert.equal(result.candidateDiscarded, true);
  }
});

test("Claude Front、Codex実装、Claude独立Reviewを同じ署名Runner契約へ結合する", async () => {
  const fixture = dependencies({
    result: taskResult({
      executorProvider: "codex",
      reviewerProvider: "claude",
    }),
  });
  const request = createSignedGeneralTaskVerificationRequest("reverse");
  assert.equal(request.frontProvider, "claude");
  assert.equal(request.requestedExecutorProvider, "codex");
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
    "reverse",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.requestedRouteProfile, "reverse");
  assert.equal(result.route, "front_claude__executor_codex__reviewer_claude");
  assert.equal(result.requestedFrontProvider, "claude");
  assert.equal(result.observedFrontProvider, null);
  assert.equal(result.frontIdentityVerified, false);
  assert.equal(result.executorProvider, "codex");
  assert.equal(result.reviewerProvider, "claude");
  assert.deepEqual(fixture.calls.passedRequest, request);
  assert.equal(fixture.calls.reads, 1);
  assert.equal(fixture.calls.discards, 1);

  for (const mismatch of [
    taskResult({ executorProvider: "claude", reviewerProvider: "claude" }),
    taskResult({ executorProvider: "codex", reviewerProvider: "codex" }),
  ]) {
    const mismatchFixture = dependencies({ result: mismatch });
    const mismatchResult = await runSignedGeneralTaskVerification(
      path.resolve("."),
      mismatchFixture.value,
      "reverse",
    );
    assert.equal(mismatchResult.status, "blocked");
    assert.equal(mismatchFixture.calls.discards, 1);
  }
});

test("明示Codex制約の検証はCodex Executorと独立Claude Reviewへ固定する", async () => {
  const fixture = dependencies({
    result: taskResult({
      executorProvider: "codex",
      reviewerProvider: "claude",
    }),
  });
  const request = createSignedGeneralTaskVerificationRequest("same-codex");
  assert.equal(request.frontProvider, "codex");
  assert.equal(request.requestedExecutorProvider, "codex");
  assert.equal(request.workClass, "bounded_verification");
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
    "same-codex",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.requestedRouteProfile, "same-codex");
  assert.equal(result.route, "front_codex__executor_codex__reviewer_claude");
  assert.equal(result.executorProvider, "codex");
  assert.equal(result.reviewerProvider, "claude");
  assert.equal(result.reviewerIndependence, "provider_independent");
  assert.deepEqual(fixture.calls.passedRequest, request);
});

test("明示Claude制約の検証はClaude Executorと独立Codex Reviewへ固定する", async () => {
  const fixture = dependencies({
    result: taskResult({
      executorProvider: "claude",
      reviewerProvider: "codex",
    }),
  });
  const request = createSignedGeneralTaskVerificationRequest("same-claude");
  assert.equal(request.frontProvider, "claude");
  assert.equal(request.requestedExecutorProvider, "claude");
  assert.equal(request.workClass, "bounded_verification");
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
    "same-claude",
  );
  assert.equal(result.status, "completed");
  assert.equal(result.requestedRouteProfile, "same-claude");
  assert.equal(result.route, "front_claude__executor_claude__reviewer_codex");
  assert.equal(result.executorProvider, "claude");
  assert.equal(result.reviewerProvider, "codex");
  assert.equal(result.reviewerIndependence, "provider_independent");
  assert.deepEqual(fixture.calls.passedRequest, request);
});

test("関数境界も未知Route ProfileをEffect前に拒否する", async () => {
  const fixture = dependencies();
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
    "unknown" as "forward",
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "signed_general_task_verification_arguments_invalid",
  );
  assert.equal(fixture.calls.verifies, 0);
  assert.equal(fixture.calls.starts, 0);
});

test("Route、cleanup、RecoveryまたはCandidate byte差をFail Closedにする", async () => {
  const cases = [
    dependencies({ result: taskResult({ executorProvider: "codex" }) }),
    dependencies({
      result: taskResult({
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        hostRecoveryId: hostRecoveryA,
      }),
    }),
    dependencies({ candidate: candidate("different\n") }),
  ];
  for (const fixture of cases) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.canonicalRepositoryChanged, false);
  }
  assert.equal(
    (
      await runSignedGeneralTaskVerification(
        path.resolve("."),
        dependencies({
          result: taskResult({
            executorProvider: "codex",
            canonicalRepositoryChanged: true,
          }),
        }).value,
      )
    ).canonicalRepositoryChanged,
    true,
  );
  assert.equal(cases[0]?.calls.reads, 1);
  assert.equal(cases[0]?.calls.discards, 1);
  assert.equal(cases[1]?.calls.reads, 1);
  assert.equal(cases[1]?.calls.discards, 1);
  assert.equal(cases[2]?.calls.discards, 1);
});

test("ReleaseとCandidate RevisionのIdentity欠落・差を拒否しCandidateをdiscardする", async () => {
  const exportedCandidate = candidate();
  const exportedBundle = exportedCandidate.bundle as Readonly<
    Record<string, unknown>
  >;
  const cases = [
    dependencies({ release: release({ crddCommit: undefined }) }),
    dependencies({
      result: taskResult({
        candidateRevision: Object.freeze({
          baseCommit: "9".repeat(40),
          baseTree,
          patchHash,
          contentManifestHash,
          allowedPathsHash,
          changedPaths: Object.freeze([TARGET_PATH]),
        }),
      }),
    }),
    dependencies({
      candidate: Object.freeze({
        ...exportedCandidate,
        bundle: Object.freeze({
          ...exportedBundle,
          patchHash: "8".repeat(64),
        }),
      }),
    }),
  ];
  for (const [index, fixture] of cases.entries()) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    if (index === 0) assert.equal(fixture.calls.starts, 0);
    else assert.equal(fixture.calls.discards, 1);
  }
});

test("Task開始後のrestart矛盾・結果不明は独立Processでpoisonし全入口を閉じる", () => {
  const scenarios = [
    "completed_true",
    "completed_missing",
    "completed_null",
    "completion_reject",
    "start_throw",
    "discard_true",
    "bind_throw",
    "bind_throw_recovery",
    "bind_throw_completion_never",
    "cancel_reject",
    "cancel_never",
    "requested_throw",
    "unbind_throw",
    "result_getter",
    "started_proxy",
    "completion_getter",
    "completion_proxy",
    "completion_subclass",
    "completion_subclass_reject",
    "completion_subclass_hostile_species",
    "control_missing_completion_recovery",
    "control_missing_completion_reject",
    "control_missing_completion_never",
    "signal_completion_never",
    "signal_completion_never_cancel_reject",
    "signal_completion_never_cancel_never",
    "signal_completion_never_cancel_malformed",
    "signal_cleanup_unknown_cancel_unobserved",
    "docker_pair_mismatch",
    ...[
      "cleanupConfirmed",
      "manualRecoveryRequired",
      "processRestartRequired",
      "canonicalRepositoryChanged",
      "rawOutputReported",
      "hostPathReported",
      "untrustedProviderTextReported",
    ].flatMap((field) => [
      `missing:${field}`,
      `null:${field}`,
      `string:${field}`,
    ]),
  ];
  for (const scenario of scenarios) {
    const probe = spawnSync(
      process.execPath,
      [
        "--unhandled-rejections=strict",
        path.resolve(
          coordinatorRoot,
          "tests/fixtures/signed-general-poison-probe.ts",
        ),
        scenario,
      ],
      { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
    );
    assert.equal(probe.status, 0, `${scenario}: ${probe.stderr}`);
    const observed = JSON.parse(probe.stdout) as Record<string, unknown>;
    const result = observed.runnerResult as Record<string, unknown>;
    assert.equal(result.status, "blocked", scenario);
    assert.equal(result.processRestartRequired, true, scenario);
    assert.equal(observed.poisoned, true, scenario);
    assert.equal(observed.packageReads, 0, scenario);
    assert.equal(observed.grantReads, 0, scenario);
    if (scenario === "completion_subclass_hostile_species")
      assert.equal(observed.hostilePromiseAccesses, 0, scenario);
    assert.ok(Number(observed.cancelAttempts) <= 1, scenario);
    if (
      scenario !== "completed_true" &&
      scenario !== "start_throw" &&
      scenario !== "discard_true" &&
      scenario !== "started_proxy" &&
      !scenario.startsWith("control_missing_completion_")
    )
      assert.equal(observed.cancelAttempts, 1, scenario);
    if (scenario === "completed_true")
      assert.equal(result.manualRecoveryRequired, false, scenario);
    if (scenario === "bind_throw_recovery") {
      assert.equal(result.manualRecoveryRequired, true, scenario);
      assert.equal(
        result.hostRecoveryId,
        `host.crdd-coordinator-doctor-a.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`,
        scenario,
      );
    }
    if (scenario === "docker_pair_mismatch") {
      assert.deepEqual(result.dockerRecoveryIds, [
        dockerRecoveryA,
        dockerRecoveryB,
      ]);
      assert.equal(result.recoveryIdentityAmbiguous, true, scenario);
    }
    if (scenario === "control_missing_completion_recovery") {
      assert.equal(result.hostRecoveryId, hostRecoveryA, scenario);
      assert.equal(result.manualRecoveryRequired, true, scenario);
    }
    assert.equal(
      observed.packageReason,
      "platform_provisioner_process_restart_required",
      scenario,
    );
    assert.equal(
      observed.taskReason,
      "coordinator_task_process_restart_required",
      scenario,
    );
  }
});

test("安全観測がexactな業務不適合は共有Processをpoisonしない", async () => {
  const fixture = dependencies({
    result: taskResult({ executorProvider: "codex" }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.processRestartRequired, false);
  assert.equal(result.manualRecoveryRequired, false);
});

test("取消、Candidate Store例外をPassへ流さない", async () => {
  const cancelled = dependencies({ cancellationRequested: true });
  const cancelledResult = await runSignedGeneralTaskVerification(
    path.resolve("."),
    cancelled.value,
  );
  assert.equal(cancelledResult.status, "blocked");
  assert.equal(cancelledResult.reason, "signed_general_task_cancelled");
  assert.equal(cancelled.calls.discards, 1);
  assert.equal(cancelled.calls.unbound, 1);

  for (const fixture of [
    dependencies({ readThrows: true }),
    dependencies({ discardThrows: true }),
  ]) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(fixture.calls.unbound, 1);
  }
});

test("production grace内の遅延取消receiptを短い旧上限で誤poisonしない", async () => {
  for (const cancelDelayMs of [1_500, 4_900]) {
    const fixture = dependencies({
      cancellationRequested: true,
      cancelDelayMs,
      isolatedSettlementTiming: Object.freeze({
        cancelAckTimeoutMs: 6_000,
        cancelCompletionTimeoutMs: 500,
        orphanedStartObservationTimeoutMs: 500,
      }),
    });
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.reason, "signed_general_task_cancelled");
    assert.equal(result.processRestartRequired, false);
    assert.equal(fixture.calls.cancels, 1);
  }
});

test("終了未観測receiptはexact cleanupだけで既知取消へ収束する", async () => {
  const receipt = Object.freeze({
    status: "requested",
    reason: "provider_cancellation_grace_exceeded",
    cancellationRequested: true,
    processTerminationObserved: false,
  });
  const known = dependencies({
    cancellationRequested: true,
    cancelReceipt: receipt,
  });
  const knownResult = await runSignedGeneralTaskVerification(
    path.resolve("."),
    known.value,
  );
  assert.equal(knownResult.reason, "signed_general_task_cancelled");
  assert.equal(knownResult.processRestartRequired, false);

  const unknownProbe = spawnSync(
    process.execPath,
    [
      path.resolve(
        coordinatorRoot,
        "tests/fixtures/signed-general-poison-probe.ts",
      ),
      "signal_cleanup_unknown_cancel_unobserved",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(unknownProbe.status, 0, unknownProbe.stderr);
  const unknown = JSON.parse(unknownProbe.stdout) as {
    runnerResult: Record<string, unknown>;
    poisoned: boolean;
  };
  assert.equal(unknown.runnerResult.processRestartRequired, true);
  assert.equal(unknown.poisoned, true);
});

test("Candidate discard不成立は残存0とせず手動処置対象を返す", async () => {
  const fixture = dependencies({
    discard: Object.freeze({
      status: "blocked",
      reason: "candidate_bundle_discard_recovery_required",
      manualRecoveryRequired: true,
      processRestartRequired: false,
      candidateRecoveryId: `candidate-recovery.${"1".repeat(64)}.${"2".repeat(64)}`,
      candidateStoreRecoveryId: null,
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "signed_general_task_candidate_discard_failed");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.processRestartRequired, false);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(
    (result as Readonly<Record<string, unknown>>).candidateIdForManualDiscard,
    candidateId,
  );
});

test("Taskとdiscardの複合Recoveryは全IDを保持し競合を明示する", async () => {
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_cleanup_unconfirmed",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: hostRecoveryA,
      dockerRecoveryId: dockerRecoveryA,
      dockerRecoveryIds: Object.freeze([dockerRecoveryA, dockerRecoveryB]),
      candidateRecoveryId: candidateRecoveryA,
    }),
    discard: Object.freeze({
      status: "blocked",
      reason: "candidate_bundle_discard_recovery_required",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: hostRecoveryB,
      dockerRecoveryId: dockerRecoveryC,
      candidateRecoveryId: candidateRecoveryB,
      candidateStoreRecoveryId: candidateStoreRecoveryA,
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    coordinatorRoot,
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, null);
  assert.deepEqual(result.hostRecoveryIds, [hostRecoveryA, hostRecoveryB]);
  assert.deepEqual(result.dockerRecoveryIds, [
    dockerRecoveryA,
    dockerRecoveryB,
    dockerRecoveryC,
  ]);
  assert.equal(result.candidateRecoveryId, null);
  assert.deepEqual(result.candidateRecoveryIds, [
    candidateRecoveryA,
    candidateRecoveryB,
  ]);
  assert.deepEqual(result.candidateStoreRecoveryIds, [candidateStoreRecoveryA]);
  assert.equal(result.recoveryIdentityAmbiguous, true);
  assert.equal(fixture.calls.discards, 1);
});

test("SIGINT／SIGTERMはrequested latchだけをexact onceにしunbind後は不発火にする", async () => {
  const signals = new EventEmitter();
  const controlCapability = Object.freeze({});
  let cancellations = 0;
  const binding = bindSignedGeneralTaskCancellation(
    signals,
    controlCapability,
    (observed) => {
      assert.equal(observed, controlCapability);
      cancellations += 1;
    },
  );
  signals.emit("SIGINT");
  signals.emit("SIGINT");
  signals.emit("SIGTERM");
  await binding.requestedPromise;
  assert.equal(binding.requested(), true);
  assert.equal(cancellations, 0);
  binding.unbind();
  binding.unbind();
  signals.emit("SIGTERM");
  assert.equal(cancellations, 0);
});

test("二本目Signal登録失敗は一本目をrollbackしlistenerを残さない", () => {
  const signals = new EventEmitter();
  const originalOn = signals.on.bind(signals);
  let registrations = 0;
  const source = Object.freeze({
    on: (signal: "SIGINT" | "SIGTERM", listener: () => void) => {
      registrations += 1;
      if (registrations === 2) throw new Error("fixed_second_bind_failure");
      return originalOn(signal, listener);
    },
    removeListener: (signal: "SIGINT" | "SIGTERM", listener: () => void) =>
      signals.removeListener(signal, listener),
  });
  assert.throws(() =>
    bindSignedGeneralTaskCancellation(source, Object.freeze({}), () => null),
  );
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

test("completion確定とunbindの間のsignal latchを成功へ取り逃がさない", () => {
  const probe = spawnSync(
    process.execPath,
    [
      path.resolve(
        coordinatorRoot,
        "tests/fixtures/signed-general-poison-probe.ts",
      ),
      "unbind_requests",
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
    },
  );
  assert.equal(probe.status, 0, probe.stderr);
  const observed = JSON.parse(probe.stdout) as {
    runnerResult: Record<string, unknown>;
    poisoned: boolean;
    cancelAttempts: number;
  };
  assert.equal(observed.runnerResult.status, "blocked");
  assert.equal(observed.runnerResult.reason, "signed_general_task_cancelled");
  assert.equal(observed.cancelAttempts, 1);
  assert.equal(observed.poisoned, false);
});
