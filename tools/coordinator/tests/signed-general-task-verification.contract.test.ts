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

const TARGET_PATH = "tools/coordinator/runtime/general-task-verification.txt";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const candidateId = `candidate.${"1".repeat(64)}.${"2".repeat(64)}`;
const baseCommit = "a".repeat(40);
const baseTree = "b".repeat(40);
const baseManifestHash = "c".repeat(64);
const contentManifestHash = "d".repeat(64);
const allowedPathsHash = "e".repeat(64);
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
    runtimeVersion?: string;
    completionRejects?: boolean;
    readThrows?: boolean;
    discardThrows?: boolean;
    cancellationRequested?: boolean;
  } = {},
) {
  const calls = {
    events: [] as string[],
    verifies: 0,
    starts: 0,
    reads: 0,
    discards: 0,
    bound: 0,
    unbound: 0,
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
      cancelTask: () => Object.freeze({ status: "requested" }),
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
        });
      },
    }),
  });
}

test("固定公開Taskをprocess内で構成しShell搬送を契約から除外する", () => {
  const request = createSignedGeneralTaskVerificationRequest();
  assert.deepEqual(request, {
    frontProvider: "codex",
    objective:
      "Create the one bounded verification file with the exact required content.",
    acceptanceCriteria: [
      `The only changed path is ${TARGET_PATH}.`,
      `The file contains exactly ${JSON.stringify(EXPECTED_CONTENT)} as UTF-8 bytes.`,
    ],
    allowedPaths: [TARGET_PATH],
    readPaths: ["tools/coordinator/README.md", TARGET_PATH],
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
  assert.equal(contract.contractRevision, 9);
  assert.equal(contract.requestShellTransportAllowed, false);
  assert.equal(contract.powershellTextPipelineAllowed, false);
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
  assert.equal(result.cleanupConfirmed, true);
  assert.deepEqual(fixture.calls.events, ["node", "package", "task"]);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.canonicalRepositoryChanged, false);
  assert.deepEqual(result.changedPaths, [TARGET_PATH]);
  assert.equal(result.crddCommit, baseCommit);
  assert.equal(result.crddTree, baseTree);
  assert.equal(fixture.calls.starts, 1);
  assert.equal(fixture.calls.passedCapability, fixture.calls.issuedCapability);
  assert.equal(fixture.calls.reads, 1);
  assert.equal(fixture.calls.discards, 1);
  assert.equal(fixture.calls.bound, 1);
  assert.equal(fixture.calls.unbound, 1);
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

test("Codex特性を選ぶ具体化済み検証はCodex Executorと独立Claude Reviewへ固定する", async () => {
  const fixture = dependencies({
    result: taskResult({
      executorProvider: "codex",
      reviewerProvider: "claude",
    }),
  });
  const request = createSignedGeneralTaskVerificationRequest("same-codex");
  assert.equal(request.frontProvider, "codex");
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

test("Claude特性を選ぶ具体化済み検証はClaude Executorと独立Codex Reviewへ固定する", async () => {
  const fixture = dependencies({
    result: taskResult({
      executorProvider: "claude",
      reviewerProvider: "codex",
    }),
  });
  const request = createSignedGeneralTaskVerificationRequest("same-claude");
  assert.equal(request.frontProvider, "claude");
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
        hostRecoveryId: "host.test",
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
  for (const scenario of [
    "completed_true",
    "completed_missing",
    "completed_null",
    "completion_reject",
    "start_throw",
    "discard_true",
  ]) {
    const probe = spawnSync(
      process.execPath,
      [path.resolve("tests/fixtures/signed-general-poison-probe.ts"), scenario],
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
      hostRecoveryId: "host-recovery-task",
      dockerRecoveryId: "docker-recovery-task-a",
      dockerRecoveryIds: Object.freeze([
        "docker-recovery-task-a",
        "docker-recovery-task-b",
      ]),
      candidateRecoveryId: "candidate-recovery-task",
    }),
    discard: Object.freeze({
      status: "blocked",
      reason: "candidate_bundle_discard_recovery_required",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: "host-recovery-discard",
      dockerRecoveryId: "docker-recovery-discard",
      candidateRecoveryId: "candidate-recovery-discard",
      candidateStoreRecoveryId: "candidate-store-recovery-discard",
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
  assert.deepEqual(result.hostRecoveryIds, [
    "host-recovery-task",
    "host-recovery-discard",
  ]);
  assert.deepEqual(result.dockerRecoveryIds, [
    "docker-recovery-task-a",
    "docker-recovery-task-b",
    "docker-recovery-discard",
  ]);
  assert.equal(result.candidateRecoveryId, null);
  assert.deepEqual(result.candidateRecoveryIds, [
    "candidate-recovery-task",
    "candidate-recovery-discard",
  ]);
  assert.deepEqual(result.candidateStoreRecoveryIds, [
    "candidate-store-recovery-discard",
  ]);
  assert.equal(result.recoveryIdentityAmbiguous, true);
  assert.equal(fixture.calls.discards, 1);
});

test("SIGINT／SIGTERMは取消をexact onceにしunbind後は不発火にする", () => {
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
  assert.equal(binding.requested(), true);
  assert.equal(cancellations, 1);
  binding.unbind();
  binding.unbind();
  signals.emit("SIGTERM");
  assert.equal(cancellations, 1);
});
