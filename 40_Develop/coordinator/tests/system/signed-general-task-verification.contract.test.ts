/**
 * coordinator:system:signed-general-task-verificationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:signed-general-task-verificationが所有する検証責務を実行する。
 * @trace ERB-ST-005
 * @trace EST-ST-003
 * @trace PRL-ST-001
 * @trace PRL-ST-003
 * @trace PRL-ST-004
 * @level ST
 * @scope signed、general、task、verification
 * @boundary EST-ST-003=System/E2E: 公開入口→同意Gate→Provider→結果帰還 / PRL-ST-001=System/E2E: 公開入口→Orchestrator→Execution→受入
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { observeRuntimeOwnedDevelopmentSource } from "../../src/task/development-source-observation.ts";
import { inspectRepositoryRevisionCandidate } from "../../src/repository-operation/binding.ts";
import {
  isCallExpression,
  isExportDeclaration,
  isImportDeclaration,
  isImportTypeNode,
  isLiteralTypeNode,
  isStringLiteral,
  type Node,
  SyntaxKind,
} from "typescript/unstable/ast";
import { createVirtualFileSystem } from "typescript/unstable/fs";
import { API, Snapshot } from "typescript/unstable/sync";

import {
  bindSignedGeneralTaskCancellation,
  createSignedGeneralTaskVerificationRequest,
  describeSignedGeneralTaskVerificationContract,
  runSignedGeneralTaskVerification,
} from "../../scripts/verify-general-task.ts";

const TARGET_PATH =
  "40_Develop/coordinator/tests/fixtures/general-task-verification.txt";
const BASE_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_BASE\n";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const coordinatorRoot = path.resolve(import.meta.dirname, "../..");
const candidateId = "11111111-1111-4111-8111-111111111111";
const baseCommit = "a".repeat(40);
const baseTree = "b".repeat(40);
const runnerSourceCommit = "1".repeat(40);
const runnerSourceTree = "2".repeat(40);
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

/**
 * importedModuleSpecifiersのTest準備責務を実行する。
 *
 * @responsibility importedModuleSpecifiersがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus 既存TypeScript APIの仮想Fileを構文解析してModule参照を列挙する。
 * @observation 静的／型／動的importの文字列と非literal sentinel。
 * @oracle 文字列・正規表現の偽importを拾わず、構文不正は拒否する。
 * @cleanup finallyでSnapshotをdisposeしてからAPIをcloseする。実Fileは作成しない。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
function importedModuleSpecifiers(source: string) {
  const specifiers: string[] = [];
  const virtual = path
    .join(coordinatorRoot, ".crdd-module-oracle.ts")
    .replaceAll("\\", "/");
  const config = path
    .join(coordinatorRoot, ".crdd-module-oracle.json")
    .replaceAll("\\", "/");
  const api = new API({
    cwd: coordinatorRoot,
    fs: createVirtualFileSystem({
      [virtual]: source,
      [config]: JSON.stringify({
        files: [virtual],
        compilerOptions: { noLib: true, noResolve: true, noEmit: true },
      }),
    }),
  });
  try {
    const snapshot = api.updateSnapshot({ openProjects: [config] });
    try {
      const project = snapshot.getProject(config);
      const file = project?.program.getSourceFile(virtual);
      assert.ok(file);
      assert.equal(project?.program.getSyntacticDiagnostics(virtual).length, 0);
      const pending: Node[] = [file];
      while (pending.length > 0) {
        const node = pending.pop();
        assert.ok(node);
        if (isImportDeclaration(node) || isExportDeclaration(node)) {
          if (node.moduleSpecifier && isStringLiteral(node.moduleSpecifier))
            specifiers.push(node.moduleSpecifier.text);
        } else if (
          isCallExpression(node) &&
          node.expression.kind === SyntaxKind.ImportKeyword
        ) {
          const argument = node.arguments[0];
          specifiers.push(
            argument && isStringLiteral(argument)
              ? argument.text
              : NONLITERAL_DYNAMIC_IMPORT,
          );
        } else if (isImportTypeNode(node)) {
          specifiers.push(
            isLiteralTypeNode(node.argument) &&
              isStringLiteral(node.argument.literal)
              ? node.argument.literal.text
              : NONLITERAL_DYNAMIC_IMPORT,
          );
        }
        const children: Node[] = [];
        node.forEachChild((child) => {
          children.push(child);
        });
        for (let index = children.length - 1; index >= 0; index -= 1) {
          const child = children[index];
          if (child) pending.push(child);
        }
      }
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
  return specifiers;
}

/**
 * resolvesToForbiddenWindowsAsciiModuleのTest準備責務を実行する。
 *
 * @responsibility resolvesToForbiddenWindowsAsciiModuleがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resolvesToForbiddenWindowsAsciiModuleを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * sourceのTest準備責務を実行する。
 *
 * @responsibility sourceがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus sourceを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
function source(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    scope: "crdd-development-source-snapshot/v1",
    sourceSha256: "0".repeat(64),
    sourceIdentitySha256: "9".repeat(64),
    crddCommit: baseCommit,
    crddTree: baseTree,
    ...overrides,
  });
}

/**
 * taskResultのTest準備責務を実行する。
 *
 * @responsibility taskResultがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus taskResultを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
function taskResult(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_workspace_review_completed",
    workspaceResult: Object.freeze({
      workspaceId: candidateId,
      changedPaths: Object.freeze([TARGET_PATH]),
      canonicalRepositoryChanged: false,
      workspaceDeletionIssued: false,
    }),
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

/**
 * candidateのTest準備責務を実行する。
 *
 * @responsibility candidateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus candidateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
function candidate(content = EXPECTED_CONTENT) {
  const bytes = Buffer.from(content, "utf8");
  return Object.freeze({
    status: "observed",
    workspaceId: candidateId,
    baseCommit,
    head: baseCommit,
    changedPaths: Object.freeze([TARGET_PATH]),
    byteLength: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    contentBase64: bytes.toString("base64"),
  });
}

/**
 * dependenciesのTest準備責務を実行する。
 *
 * @responsibility dependenciesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus dependenciesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
function dependencies(
  options: {
    source?: Readonly<Record<string, unknown>>;
    sourceSequence?: readonly unknown[];
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
    sourceObservations: 0,
    starts: 0,
    reads: 0,
    discards: 0,
    repositoryRevisionObservations: 0,
    bound: 0,
    unbound: 0,
    cancels: 0,
    taskArgumentCount: 0,
    passedRequest: null as unknown,
  };
  return Object.freeze({
    calls,
    value: Object.freeze({
      observeSource: () => {
        calls.events.push("source");
        calls.sourceObservations += 1;
        const observed =
          options.sourceSequence &&
          calls.sourceObservations <= options.sourceSequence.length
            ? options.sourceSequence[calls.sourceObservations - 1]
            : (options.source ?? source());
        if (observed instanceof Error) throw observed;
        return observed;
      },
      prepareWorkspace: (root: string, commit: string) => ({
        prepared: true,
        cleanupConfirmed: false,
        target: {
          workspaceId: candidateId,
          ownerRepositoryRoot: root,
          executionTree: path.join(
            root,
            ".crdd",
            "workspaces",
            candidateId,
            "worktree",
          ),
          baseCommit: commit,
          head: commit,
        },
      }),
      startTask: (...args: [unknown, string, unknown]) => {
        const [request] = args;
        calls.events.push("task");
        calls.starts += 1;
        calls.passedRequest = request;
        calls.taskArgumentCount = args.length;
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
      readWorkspaceOutput: () => {
        calls.reads += 1;
        if (options.readThrows) throw new Error("fixture_read_failed");
        return options.candidate === undefined
          ? candidate()
          : options.candidate;
      },
      closeWorkspace: () => {
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

/**
 * 作成済み領域を結果欠測で未作成扱いせず、一次失敗と回収失敗を分離する。
 * @responsibility 上位所有対象の参照・回収状態とTask理由の返却を確認する。
 * @trace EST-ST-003
 * @precondition 固定Worktree対象と外部Effectのない代役。
 * @stimulus Workspace結果欠測、回収失敗、Taskとの複合失敗を返す。
 * @observation 最終理由、元UUID、回収状態、処置回数。
 * @oracle 作成済みUUIDは常に保持し、回収失敗を完了へ畳まず元Task理由を失わない。
 * @cleanup Process-localの代役のみで物理資源を作らない。
 * @boundary 検証Runner→既存Task結果とTool所有の作業領域終了。
 */
test("作成済みWorktreeの結果欠測と複合失敗は元対象と一次理由を保持する", async () => {
  for (const result of [
    taskResult({ workspaceResult: null }),
    taskResult({
      status: "blocked",
      reason: "coordinator_task_independent_review_not_approved",
    }),
  ]) {
    const fixture = dependencies({
      result,
      discard: { status: "retained", cleanupConfirmed: false },
    });
    const observed = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(observed.status, "blocked");
    assert.equal(observed.workspaceId, candidateId);
    assert.equal(observed.cleanupConfirmed, false);
    assert.equal(observed.workspaceCleanupConfirmed, false);
    assert.equal(observed.candidateIdForManualDiscard, candidateId);
    assert.equal(
      observed.workspaceCleanupReason,
      "verification_workspace_retained",
    );
    assert.equal(fixture.calls.discards, 1);
    if ((result as Record<string, unknown>).status === "blocked")
      assert.equal(observed.reason, result.reason);
  }
});

/**
 * 固定公開Taskをprocess内で構成しShell搬送を契約から除外するを検証する。
 *
 * @responsibility 固定公開Taskをprocess内で構成しShell搬送を契約から除外するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定公開Taskをprocess内で構成しShell搬送を契約から除外するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定公開Taskをprocess内で構成しShell搬送を契約から除外する", (t) => {
  const parserFixture = [
    'import "./side.ts"; import type { T } from "./type.ts";',
    'type X = import("./type-expression.ts").X;',
    `const v = \`head \${import("./dynamic.ts")} \${\`nested \${({ v: 1 }).v}\`}\\n\`;`,
    'if (x) /import\\("\\.\\/fake-control.ts"\\)/.test(y);',
    '{ x(); } /import\\("\\.\\/fake-block.ts"\\)/.test(y);',
    "const x1 = f() / 2; const x2 = ({ v: 8 }).v / 2;",
    'const literal = `import("./fake-literal.ts")`;',
    'void import(`./template.ts`); void import("./" + name);',
    'export { x } from "./after.ts";',
  ].join("\n");
  assert.deepEqual(importedModuleSpecifiers(parserFixture), [
    "./side.ts",
    "./type.ts",
    "./type-expression.ts",
    "./dynamic.ts",
    NONLITERAL_DYNAMIC_IMPORT,
    NONLITERAL_DYNAMIC_IMPORT,
    "./after.ts",
  ]);
  const cleanupEvents: string[] = [];
  const originalClose = API.prototype.close;
  const originalDispose = Snapshot.prototype.dispose;
  const close = t.mock.method(API.prototype, "close", function (this: API) {
    cleanupEvents.push("api_close");
    return originalClose.call(this);
  });
  const dispose = t.mock.method(
    Snapshot.prototype,
    "dispose",
    function (this: Snapshot) {
      cleanupEvents.push("snapshot_dispose");
      return originalDispose.call(this);
    },
  );
  try {
    assert.throws(
      () => importedModuleSpecifiers("const = ;"),
      /AssertionError/u,
    );
    assert.equal(dispose.mock.calls.length, 1);
    assert.equal(close.mock.calls.length, 1);
    assert.deepEqual(cleanupEvents, ["snapshot_dispose", "api_close"]);
  } finally {
    dispose.mock.restore();
    close.mock.restore();
  }
  const update = t.mock.method(API.prototype, "updateSnapshot", () => {
    throw new Error("parser_snapshot_failure");
  });
  cleanupEvents.length = 0;
  const closeAfterFailure = t.mock.method(
    API.prototype,
    "close",
    function (this: API) {
      cleanupEvents.push("api_close");
      return originalClose.call(this);
    },
  );
  try {
    assert.throws(
      () => importedModuleSpecifiers(""),
      /parser_snapshot_failure/u,
    );
    assert.equal(closeAfterFailure.mock.calls.length, 1);
    assert.deepEqual(cleanupEvents, ["api_close"]);
  } finally {
    closeAfterFailure.mock.restore();
    update.mock.restore();
  }
  const verificationFixture = fs.readFileSync(
    path.join(coordinatorRoot, "tests/fixtures/general-task-verification.txt"),
  );
  assert.deepEqual(verificationFixture, Buffer.from(BASE_CONTENT, "utf8"));
  assert.equal(verificationFixture.byteLength, 35);
  assert.match(
    fs.readFileSync(
      path.resolve(coordinatorRoot, "../..", ".gitattributes"),
      "utf8",
    ),
    /^40_Develop\/coordinator\/tests\/fixtures\/general-task-verification\.txt text eol=lf$/m,
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
    readPaths: [
      "06_Architecture/Details/coordinator/02_Activity_Context.md",
      TARGET_PATH,
    ],
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
  assert.equal(contract.contractRevision, 28);
  assert.equal(
    contract.verificationFixture,
    "tracked_base_marker_exact_token_replacement_with_independent_final_byte_verification",
  );
  assert.equal(
    contract.boundedRemediation,
    "zero_or_one_runtime_owned_remediation_then_same_independent_reviewer_approval_required",
  );
  assert.equal(
    contract.taskFailureReasonProjection,
    "known_task_failure_reason_preserved_candidate_integrity_failure_distinct_from_reviewer_semantic_rejection",
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
    contract.sourceObservation,
    "fixed_module_root_source_and_git_before_task_and_after_settlement_not_execution_authority",
  );
  const runnerPath = path.join(
    coordinatorRoot,
    "scripts/verify-general-task.ts",
  );
  const source = fs.readFileSync(runnerPath, "utf8");
  const forbiddenConsoleModule = "../src/cli/interactive-console.ts";
  const equivalentConsoleModule = "../src/cli/./INTERACTIVE-console.ts";
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
      "../src/cli/interactive-console-reader.ts",
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

/**
 * CLIは余分argvを単一JSONとexit 2でEffect前に拒否するを検証する。
 *
 * @responsibility CLIは余分argvを単一JSONとexit 2でEffect前に拒否するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLIは余分argvを単一JSONとexit 2でEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLIは余分argvを単一JSONとexit 2でEffect前に拒否する", () => {
  const script = path.join(coordinatorRoot, "scripts/verify-general-task.ts");
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

/**
 * CLIのRoute grammarは引数なしと三つのexact profileだけを許可するを検証する。
 *
 * @responsibility CLIのRoute grammarは引数なしと三つのexact profileだけを許可するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLIのRoute grammarは引数なしと三つのexact profileだけを許可するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLIのRoute grammarは引数なしと三つのexact profileだけを許可する", () => {
  const script = path.join(coordinatorRoot, "scripts/verify-general-task.ts");
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

/**
 * Node GateとSource観測はTask前に拒否しavailability-only Console Effectを持たないを検証する。
 *
 * @responsibility Node GateとSource観測はTask前に拒否しavailability-only Console Effectを持たないの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Node GateとSource観測はTask前に拒否しavailability-only Console Effectを持たないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
test("Node GateとSource観測はTask前に拒否しavailability-only Console Effectを持たない", async () => {
  for (const fixture of [
    dependencies({ runtimeVersion: "24.11.9" }),
    dependencies({ runtimeVersion: "22.18.0" }),
  ]) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(fixture.calls.sourceObservations, 0);
    assert.equal(fixture.calls.starts, 0);
    assert.deepEqual(fixture.calls.events, ["node"]);
  }
});

/**
 * 初回同意のConsole不成立はTask所有Gateの結果としてFail Closedに伝播するを検証する。
 *
 * @responsibility 初回同意のConsole不成立はTask所有Gateの結果としてFail Closedに伝播するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 初回同意のConsole不成立はTask所有Gateの結果としてFail Closedに伝播するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
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
  assert.deepEqual(fixture.calls.events, ["node", "source", "task", "source"]);
});

/**
 * Source観測不成立時はTaskを開始しないを検証する。
 *
 * @responsibility Source観測不成立時はTaskを開始しないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Source観測不成立時はTaskを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Source観測不成立時はTaskを開始しない", async () => {
  const fixture = dependencies({
    source: source({ scope: "unknown" }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "signed_general_task_source_observation_unknown");
  assert.equal(fixture.calls.starts, 0);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 0);
  assert.deepEqual(fixture.calls.events, ["node", "source"]);
});

/**
 * 初回Source観測の不正値をTask開始前に拒否する。
 * @responsibility Scope・内容・内部実体・Gitの欠測と例外を同じ開始境界で反証する。
 * @trace PRL-ST-001
 * @precondition 固定Source fixtureと既存Task模擬依存を使用する。
 * @stimulus 各必須fieldの不正値、null、例外、getter、Proxyを渡す。
 * @observation 開始・候補読取り・候補破棄とgetter呼出し数。
 * @oracle 全て開始0で停止し、getterとProxyを実行しない。
 * @cleanup N/A: 局所値だけで外部資源を作らない。
 * @boundary Source観測→検証RunnerのTask開始。
 */
test("Source初回観測の欠測・例外・不正値はTask開始0で閉じる", async () => {
  let getterCalls = 0;
  const getter = {
    get scope() {
      getterCalls += 1;
      return "crdd-development-source-snapshot/v1";
    },
  };
  for (const observed of [
    null,
    new Error("fixed_observation_failure"),
    source({ scope: "other" }),
    source({ sourceSha256: "x" }),
    source({ sourceIdentitySha256: undefined }),
    source({ crddCommit: undefined }),
    source({ crddTree: "invalid" }),
    getter,
    new Proxy(
      {},
      {
        get() {
          throw new Error("must_not_run");
        },
      },
    ),
  ]) {
    const fixture = dependencies({ sourceSequence: [observed] });
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(
      result.reason,
      "signed_general_task_source_observation_unknown",
    );
    assert.equal(result.status, "blocked");
    assert.equal(fixture.calls.starts, 0);
    assert.equal(fixture.calls.reads, 0);
    assert.equal(fixture.calls.discards, 0);
    assert.equal(fixture.calls.sourceObservations, 1);
  }
  assert.equal(getterCalls, 0);
});

/**
 * 本番Source観測の固定RootとGit前後照合を実本文で確認する。
 * @responsibility 引数の対象RepositoryでなくRunner自身を観測し、Git変化を受理しない。
 * @trace PRL-ST-001
 * @precondition 現在RepositoryのSourceとGit改訂を読取り観測できる。
 * @stimulus 実観測と固定欠測・前後改訂差、照合省略変異を与える。
 * @observation 観測Root、呼出し順序、返された五値とnull。
 * @oracle 固定Rootの二Git観測と既存Source観測だけを使い、差分と欠測を拒否する。
 * @cleanup N/A: Repository内の読取りだけ。Docker・Provider・書込みはない。
 * @boundary 本番依存のSource観測callback→既存Git／Source Reader。
 */
test("Source本番観測は固定module RootとGit前後照合を使用する", () => {
  const scriptUrl = new URL(
    "../../scripts/verify-general-task.ts",
    import.meta.url,
  );
  const text = fs.readFileSync(scriptUrl, "utf8");
  const start = text.indexOf("  observeSource: () => {");
  const end = text.indexOf("\n  prepareWorkspace:", start);
  assert.ok(start > 0 && end > start);
  const body = text
    .slice(start, end)
    .trim()
    .replace(/^observeSource: /u, "")
    .replace(/,$/u, "")
    .replace("import.meta.url", JSON.stringify(scriptUrl.href));
  const root = path.resolve(coordinatorRoot, "../..");
  const expectedSource = observeRuntimeOwnedDevelopmentSource();
  const expectedGit = inspectRepositoryRevisionCandidate(root);
  assert.ok(expectedSource && expectedGit?.status === "candidate");
  const order: string[] = [];
  const observe = runInNewContext(stripTypeScriptTypes(`(${body})`), {
    URL,
    fileURLToPath,
    inspectRepositoryRevisionCandidate: (observed: string) => {
      assert.equal(path.resolve(observed), root);
      order.push("git");
      return inspectRepositoryRevisionCandidate(observed);
    },
    observeRuntimeOwnedDevelopmentSource: () => {
      order.push("source");
      return observeRuntimeOwnedDevelopmentSource();
    },
  }) as () => Record<string, unknown> | null;
  assert.deepEqual(JSON.parse(JSON.stringify(observe())), {
    scope: expectedSource.scope,
    sourceSha256: expectedSource.sourceSha256,
    sourceIdentitySha256: expectedSource.sourceIdentitySha256,
    crddCommit: expectedGit.commit,
    crddTree: expectedGit.tree,
  });
  assert.deepEqual(order, ["git", "source", "git"]);
  for (const [before, after, observed] of [
    [null, expectedGit, expectedSource],
    [expectedGit, null, expectedSource],
    [expectedGit, { ...expectedGit, commit: "e".repeat(40) }, expectedSource],
    [expectedGit, { ...expectedGit, tree: "e".repeat(40) }, expectedSource],
    [expectedGit, expectedGit, null],
  ] as const) {
    let count = 0;
    const fixture = runInNewContext(stripTypeScriptTypes(`(${body})`), {
      URL,
      fileURLToPath,
      inspectRepositoryRevisionCandidate: () =>
        count++ === 0 ? before : after,
      observeRuntimeOwnedDevelopmentSource: () => observed,
    }) as () => unknown;
    assert.equal(fixture(), null);
    assert.equal(count, 2);
  }
});

/**
 * 終了後Sourceの各差分と欠測を候補破棄後の検証不成立へ分ける。
 * @responsibility 内容・同bytes実体交換・Git差と観測不能を独立期待で照合する。
 * @trace PRL-ST-001
 * @precondition Taskと候補の安全な終了fixtureを使用する。
 * @stimulus 最終観測の差分・null・例外を渡す。
 * @observation 破棄・解除の先行、固定理由、Source状態と公開field。
 * @oracle 対象Repository変更やEffect不明を捏造せず、内部実体・旧署名情報を公開しない。
 * @cleanup N/A: 模擬処理だけで実Providerを使わない。
 * @boundary Task settlement→Source最終照合→公開結果。
 */
test("Source終了観測は破棄・解除後に五値を照合し内部値を公開しない", async () => {
  for (const [observed, state] of [
    [source({ sourceSha256: "e".repeat(64) }), "changed"],
    [source({ sourceIdentitySha256: "e".repeat(64) }), "changed"],
    [source({ crddCommit: "e".repeat(40) }), "changed"],
    [source({ crddTree: "e".repeat(40) }), "changed"],
    [null, "unavailable"],
    [new Error("fixed_observation_failure"), "unavailable"],
    [source({ scope: "other" }), "unavailable"],
  ] as const) {
    const fixture = dependencies();
    let count = 0;
    const result = await runSignedGeneralTaskVerification(path.resolve("."), {
      ...fixture.value,
      observeSource: () => {
        count += 1;
        if (count === 1) return source();
        assert.equal(fixture.calls.discards, 1);
        assert.equal(fixture.calls.unbound, 1);
        if (observed instanceof Error) throw observed;
        return observed;
      },
    });
    assert.equal(count, 2);
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      state === "changed"
        ? "signed_general_task_source_changed"
        : "signed_general_task_source_observation_unknown",
    );
    assert.equal(result.sourceObservationStatus, state);
    assert.equal(result.candidateDiscarded, true);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(result.effectStateUnknown, false);
    assert.equal(result.canonicalRepositoryChanged, false);
    assert.equal(result.sourceScope, "crdd-development-source-snapshot/v1");
    assert.equal(result.sourceSha256, "0".repeat(64));
    assert.equal(result.signatureRequired, false);
    for (const key of [
      "sourceIdentitySha256",
      "manifestHash",
      "packageContentRootSha256",
      "runtimeExecutionIdentitySha256",
      "crddVersion",
      "releaseSequence",
    ])
      assert.equal(Object.hasOwn(result, key), false, key);
  }
});

/**
 * Source不成立でもTask一次失敗と取消・清掃結果を維持する。
 * @responsibility Source検証を既存のTask／候補／取消結果から分離する。
 * @trace PRL-ST-001
 * @precondition 既存の失敗・取消fixtureを使用する。
 * @stimulus 同じSource差分を業務拒否・候補破棄失敗・取消へ重ねる。
 * @observation 一次理由、回復分類、候補破棄・取消・解除数。
 * @oracle 一次理由は変わらず、Source差分は独立fieldだけに残る。
 * @cleanup N/A: 模擬処理だけ。
 * @boundary Task／取消settlement→Source最終観測。
 */
test("Source差分は一次失敗や取消を上書きせず回収を省略しない", async () => {
  for (const mode of ["refused", "discard", "cancel"] as const) {
    const options = {
      ...(mode === "refused"
        ? {
            result: taskResult({
              status: "blocked",
              reason: "coordinator_task_independent_review_not_approved",
              candidateId: null,
              candidateDisposition: "not_issued",
            }),
          }
        : {}),
      ...(mode === "discard" ? { discardThrows: true } : {}),
      ...(mode === "cancel" ? { cancellationRequested: true } : {}),
    };
    const baseline = await runSignedGeneralTaskVerification(
      path.resolve("."),
      dependencies(options).value,
    );
    const fixture = dependencies({
      ...options,
      sourceSequence: [
        source(),
        source({ sourceIdentitySha256: "e".repeat(64) }),
      ],
    });
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(
      result.reason,
      mode === "refused"
        ? "coordinator_task_independent_review_not_approved"
        : mode === "discard"
          ? "signed_general_task_candidate_discard_failed"
          : "signed_general_task_cancelled",
    );
    assert.equal(result.sourceObservationStatus, "changed");
    assert.equal(fixture.calls.sourceObservations, 2);
    assert.equal(fixture.calls.unbound, 1);
    assert.equal(fixture.calls.discards, 1);
    assert.equal(fixture.calls.cancels, mode === "cancel" ? 1 : 0);
    for (const key of [
      "cleanupConfirmed",
      "manualRecoveryRequired",
      "effectStateUnknown",
      "canonicalRepositoryChanged",
      "hostRecoveryId",
      "dockerRecoveryId",
    ])
      assert.equal(result[key], baseline[key], `${mode}:${key}`);
  }
});

/**
 * SHA-256 CRDD Source Identityはv1能力外としてTask Effect前に明示拒否するを検証する。
 *
 * @responsibility SHA-256 CRDD Source Identityはv1能力外としてTask Effect前に明示拒否するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus SHA-256 CRDD Source Identityはv1能力外としてTask Effect前に明示拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("SHA-256 CRDD Source Identityはv1能力外としてTask Effect前に明示拒否する", async () => {
  const fixture = dependencies({
    source: source({
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
  assert.equal(fixture.calls.sourceObservations, 1);
  assert.equal(fixture.calls.starts, 0);
  assert.equal(fixture.calls.bound, 0);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 0);
  assert.deepEqual(fixture.calls.events, ["node", "source"]);
});

/**
 * 固定基準byteのCRLF変換・欠落・読取失敗はProvider Effect前に停止するを検証する。
 *
 * @responsibility 固定基準byteのCRLF変換・欠落・読取失敗はProvider Effect前に停止するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定基準byteのCRLF変換・欠落・読取失敗はProvider Effect前に停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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
    assert.deepEqual(fixture.calls.events, ["node", "source"]);
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

/**
 * Claude実装、Codex独立Review、exact Candidate、discardを一つのPassへ結合するを検証する。
 *
 * @responsibility Claude実装、Codex独立Review、exact Candidate、discardを一つのPassへ結合するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude実装、Codex独立Review、exact Candidate、discardを一つのPassへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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
  assert.deepEqual(fixture.calls.events, ["node", "source", "task", "source"]);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.canonicalRepositoryChanged, false);
  assert.deepEqual(result.changedPaths, [TARGET_PATH]);
  assert.equal(result.crddCommit, baseCommit);
  assert.equal(result.crddTree, baseTree);
  assert.equal(result.executionCommit, baseCommit);
  assert.equal(result.executionTree, baseTree);
  assert.equal(fixture.calls.starts, 1);
  assert.equal(fixture.calls.taskArgumentCount, 3);
  assert.equal(fixture.calls.reads, 1);
  assert.equal(fixture.calls.discards, 1);
  assert.equal(fixture.calls.bound, 1);
  assert.equal(fixture.calls.unbound, 1);
  assert.equal(fixture.calls.repositoryRevisionObservations, 2);
});

/**
 * 実行Sourceと作業対象Execution Revisionを分離し候補を後者へ結合するを検証する。
 *
 * @responsibility 実行Sourceと作業対象Execution Revisionを分離し候補を後者へ結合するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行Sourceと作業対象Execution Revisionを分離し候補を後者へ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("実行Sourceと作業対象Execution Revisionを分離し候補を後者へ結合する", async () => {
  const fixture = dependencies({
    source: source({
      crddCommit: runnerSourceCommit,
      crddTree: runnerSourceTree,
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.crddCommit, runnerSourceCommit);
  assert.equal(result.crddTree, runnerSourceTree);
  assert.equal(result.executionCommit, baseCommit);
  assert.equal(result.executionTree, baseTree);
  assert.equal(fixture.calls.repositoryRevisionObservations, 2);
  assert.equal(fixture.calls.discards, 1);
});

/**
 * 候補が作業対象Revisionでなく実行Sourceをbaseにした場合は破棄して拒否するを検証する。
 *
 * @responsibility 候補が作業対象Revisionでなく実行Sourceをbaseにした場合は破棄して拒否するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 候補が作業対象Revisionでなく実行Sourceをbaseにした場合は破棄して拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("候補が作業対象Revisionでなく実行Sourceをbaseにした場合は破棄して拒否する", async () => {
  const fixture = dependencies({
    source: source({
      crddCommit: runnerSourceCommit,
      crddTree: runnerSourceTree,
    }),
    candidate: { ...candidate(), baseCommit: runnerSourceCommit },
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.candidateContractMismatch, "workspace_base_commit");
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.cleanupConfirmed, true);
});

/**
 * 実行中にCanonical RepositoryのCommitが変化した場合は候補破棄後に拒否するを検証する。
 *
 * @responsibility 実行中にCanonical RepositoryのCommitが変化した場合は候補破棄後に拒否するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行中にCanonical RepositoryのCommitが変化した場合は候補破棄後に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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
  assert.equal(result.canonicalRepositoryChanged, true);
  assert.equal(result.effectStateUnknown, false);
  assert.equal(
    result.reason,
    "signed_general_task_execution_repository_changed",
  );
  assert.equal(result.executionCommit, baseCommit);
  assert.equal(result.executionTree, baseTree);
  assert.equal(fixture.calls.repositoryRevisionObservations, 2);
});

/**
 * Task後の作業対象Revision観測不能は候補回収後も状態不明を保持するを検証する。
 *
 * @responsibility Task後の作業対象Revision観測不能は候補回収後も状態不明を保持するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task後の作業対象Revision観測不能は候補回収後も状態不明を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task後の作業対象Revision観測不能は候補回収後も状態不明を保持する", async () => {
  const fixture = dependencies({
    repositoryRevisions: Object.freeze([
      Object.freeze({
        status: "candidate",
        commit: baseCommit,
        tree: baseTree,
      }),
      null,
    ]),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "signed_general_task_execution_repository_observation_unknown",
  );
  assert.equal(
    result.resultContractMismatch,
    "execution_repository_revision_observation_unknown",
  );
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.canonicalRepositoryChanged, null);
  assert.equal(result.effectStateUnknown, true);
});

/**
 * 安全なTask拒否より作業対象Revision変化を優先して再試行可能にしないを検証する。
 *
 * @responsibility 安全なTask拒否より作業対象Revision変化を優先して再試行可能にしないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 安全なTask拒否より作業対象Revision変化を優先して再試行可能にしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("安全なTask拒否より作業対象Revision変化を優先して再試行可能にしない", async () => {
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_independent_review_not_approved",
      candidateId: null,
      candidateDisposition: "not_issued",
    }),
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
  assert.equal(
    result.reason,
    "signed_general_task_execution_repository_changed",
  );
  assert.equal(
    result.resultContractMismatch,
    "execution_repository_commit_changed",
  );
  assert.equal(result.candidateDisposition, "discarded");
  assert.equal(result.canonicalRepositoryChanged, true);
  assert.equal(result.effectStateUnknown, false);
});

/**
 * 候補破棄失敗と作業対象Revision観測不能を別軸で保持するを検証する。
 *
 * @responsibility 候補破棄失敗と作業対象Revision観測不能を別軸で保持するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 候補破棄失敗と作業対象Revision観測不能を別軸で保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("候補破棄失敗と作業対象Revision観測不能を別軸で保持する", async () => {
  const fixture = dependencies({
    discardThrows: true,
    repositoryRevisions: Object.freeze([
      Object.freeze({
        status: "candidate",
        commit: baseCommit,
        tree: baseTree,
      }),
      null,
    ]),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.reason, "signed_general_task_candidate_discard_failed");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.candidateDiscarded, false);
  assert.equal(result.canonicalRepositoryChanged, null);
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.executionCommit, baseCommit);
  assert.equal(result.executionTree, baseTree);
});

/**
 * 実行Repository RevisionをTask前に観測できなければProvider Effectを発行しないを検証する。
 *
 * @responsibility 実行Repository RevisionをTask前に観測できなければProvider Effectを発行しないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行Repository RevisionをTask前に観測できなければProvider Effectを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 一回是正後の同じ独立Reviewer承認もexact Candidate成功として保持するを検証する。
 *
 * @responsibility 一回是正後の同じ独立Reviewer承認もexact Candidate成功として保持するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 一回是正後の同じ独立Reviewer承認もexact Candidate成功として保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 安全な業務拒否は空Recoveryを曖昧化せず再実行可否を判定可能にするを検証する。
 *
 * @responsibility 安全な業務拒否は空Recoveryを曖昧化せず再実行可否を判定可能にするの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 安全な業務拒否は空Recoveryを曖昧化せず再実行可否を判定可能にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("安全な業務拒否は空Recoveryを曖昧化せず再実行可否を判定可能にする", async () => {
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_independent_review_not_approved",
      candidateId: null,
      candidateDisposition: "not_issued",
      remediationPerformed: true,
      reviewerResult: Object.freeze({
        decision: "changes_requested",
        findingCount: 1,
      }),
      reviewerProjectionEvidence: Object.freeze({
        totalBytes: Buffer.byteLength(EXPECTED_CONTENT),
        contentReported: false,
        files: Object.freeze([
          Object.freeze({
            path: TARGET_PATH,
            state: "present",
            byteLength: Buffer.byteLength(EXPECTED_CONTENT),
            sha256: createHash("sha256")
              .update(Buffer.from(EXPECTED_CONTENT, "utf8"))
              .digest("hex"),
            encoding: "utf-8",
          }),
        ]),
      }),
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
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.candidateDisposition, "discarded");
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
  assert.equal(result.reviewerDecision, "changes_requested");
  assert.equal(result.reviewerFindingCount, 1);
  assert.equal(result.reviewerProjectedTargetExact, true);
  assert.equal(result.reviewerProjectedTargetClassification, "exact");
  assert.equal(result.remediationPerformed, true);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 1);
});

/**
 * Reviewer投影の既知byte差をProvider本文なしで固定分類するを検証する。
 *
 * @responsibility Reviewer投影の既知byte差をProvider本文なしで固定分類するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewer投影の既知byte差をProvider本文なしで固定分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Reviewer投影の既知byte差をProvider本文なしで固定分類する", async () => {
  const missingLf = EXPECTED_CONTENT.trimEnd();
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_independent_review_not_approved",
      candidateId: null,
      candidateDisposition: "not_issued",
      remediationPerformed: true,
      reviewerResult: Object.freeze({
        decision: "changes_requested",
        findingCount: 1,
      }),
      reviewerProjectionEvidence: Object.freeze({
        totalBytes: Buffer.byteLength(missingLf),
        contentReported: false,
        files: Object.freeze([
          Object.freeze({
            path: TARGET_PATH,
            state: "present",
            byteLength: Buffer.byteLength(missingLf),
            sha256: createHash("sha256").update(missingLf).digest("hex"),
            encoding: "utf-8",
          }),
        ]),
      }),
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.reviewerProjectedTargetExact, false);
  assert.equal(result.reviewerProjectedTargetClassification, "missing_lf");
});

/**
 * Candidate整合性不成立はReviewer拒否へ畳まず検証結果へ伝播するを検証する。
 *
 * @responsibility Candidate整合性不成立はReviewer拒否へ畳まず検証結果へ伝播するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate整合性不成立はReviewer拒否へ畳まず検証結果へ伝播するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Candidate整合性不成立はReviewer拒否へ畳まず検証結果へ伝播する", async () => {
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_candidate_verification_failed",
      candidateId: null,
      candidateDisposition: "not_issued",
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_task_candidate_verification_failed");
  assert.equal(result.candidateDisposition, "discarded");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.effectStateUnknown, false);
});

/**
 * exact Candidate破棄後の内容不一致は候補Recoveryを残存扱いしないを検証する。
 *
 * @responsibility exact Candidate破棄後の内容不一致は候補Recoveryを残存扱いしないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact Candidate破棄後の内容不一致は候補Recoveryを残存扱いしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 公開fixtureの改行・終端・未置換差はbyteを出さず固定分類するを検証する。
 *
 * @responsibility 公開fixtureの改行・終端・未置換差はbyteを出さず固定分類するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開fixtureの改行・終端・未置換差はbyteを出さず固定分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * Reviewer承認済みでもRunnerがbyte長・digestの不一致を独立拒否するを検証する。
 *
 * @responsibility Reviewer承認済みでもRunnerがbyte長・digestの不一致を独立拒否するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewer承認済みでもRunnerがbyte長・digestの不一致を独立拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Reviewer承認済みでもRunnerがbyte長・digestの不一致を独立拒否する", async () => {
  for (const [field, value, expectedMismatch] of [
    ["byteLength", 32, "candidate_byte_length"],
    ["sha256", "0".repeat(64), "candidate_sha256"],
  ] as const) {
    const valid = candidate();
    const fixture = dependencies({
      candidate: {
        ...valid,
        [field]: value,
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

/**
 * 変更Pathの最終Authorityは複製Resultでなくexact Candidate Bundleに固定するを検証する。
 *
 * @responsibility 変更Pathの最終Authorityは複製Resultでなくexact Candidate Bundleに固定するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 変更Pathの最終Authorityは複製Resultでなくexact Candidate Bundleに固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 正常候補の契約差はProvider本文を出さず固定field名だけで診断するを検証する。
 *
 * @responsibility 正常候補の契約差はProvider本文を出さず固定field名だけで診断するの合否判定を所有する。
 * @trace ERB-ST-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 正常候補の契約差はProvider本文を出さず固定field名だけで診断するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-ST-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("正常候補の契約差はProvider本文を出さず固定field名だけで診断する", async () => {
  const fixture = dependencies({
    result: taskResult({
      workspaceResult: {
        workspaceId: candidateId,
        canonicalRepositoryChanged: false,
        workspaceDeletionIssued: true,
      },
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "signed_general_task_result_contract_mismatch");
  assert.equal(result.resultContractMismatch, "workspace_observation");
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.rawProviderOutputReported, false);
  assert.equal(result.hostPathReported, false);
  assert.equal(result.credentialReported, false);
});

/**
 * 是正履歴の欠落または型差を成功へ昇格しないを検証する。
 *
 * @responsibility 是正履歴の欠落または型差を成功へ昇格しないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 是正履歴の欠落または型差を成功へ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * Claude Front、Codex実装、Claude独立Reviewを同じ一般Task検証Runner契約へ結合するを検証する。
 *
 * @responsibility Claude Front、Codex実装、Claude独立Reviewを同じ一般Task検証Runner契約へ結合するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Claude Front、Codex実装、Claude独立Reviewを同じ一般Task検証Runner契約へ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Claude Front、Codex実装、Claude独立Reviewを同じ一般Task検証Runner契約へ結合する", async () => {
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

/**
 * 明示Codex制約の検証はCodex Executorと独立Claude Reviewへ固定するを検証する。
 *
 * @responsibility 明示Codex制約の検証はCodex Executorと独立Claude Reviewへ固定するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示Codex制約の検証はCodex Executorと独立Claude Reviewへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 明示Claude制約の検証はClaude Executorと独立Codex Reviewへ固定するを検証する。
 *
 * @responsibility 明示Claude制約の検証はClaude Executorと独立Codex Reviewへ固定するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示Claude制約の検証はClaude Executorと独立Codex Reviewへ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 関数境界も未知Route ProfileをEffect前に拒否するを検証する。
 *
 * @responsibility 関数境界も未知Route ProfileをEffect前に拒否するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 関数境界も未知Route ProfileをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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
  assert.equal(fixture.calls.sourceObservations, 0);
  assert.equal(fixture.calls.starts, 0);
});

/**
 * Route、cleanup、RecoveryまたはCandidate byte差をFail Closedにするを検証する。
 *
 * @responsibility Route、cleanup、RecoveryまたはCandidate byte差をFail Closedにするの合否判定を所有する。
 * @trace PRL-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Route、cleanup、RecoveryまたはCandidate byte差をFail Closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-004=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * SourceとCandidate RevisionのIdentity欠落・差を拒否しCandidateをdiscardするを検証する。
 *
 * @responsibility SourceとCandidate RevisionのIdentity欠落・差を拒否しCandidateをdiscardするの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus SourceとCandidate RevisionのIdentity欠落・差を拒否しCandidateをdiscardするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("SourceとCandidate RevisionのIdentity欠落・差を拒否しCandidateをdiscardする", async () => {
  const exportedCandidate = candidate();
  const cases = [
    dependencies({ source: source({ crddCommit: undefined }) }),
    dependencies({
      candidate: { ...exportedCandidate, baseCommit: "9".repeat(40) },
    }),
    dependencies({ candidate: { ...exportedCandidate, head: "8".repeat(40) } }),
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

/**
 * Task開始後のrestart矛盾・結果不明は独立Processでpoisonし全入口を閉じるを検証する。
 *
 * @responsibility Task開始後のrestart矛盾・結果不明は独立Processでpoisonし全入口を閉じるの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task開始後のrestart矛盾・結果不明は独立Processでpoisonし全入口を閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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
    "unbind_throw_repository_changed",
    "unbind_throw_repository_unknown",
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
    assert.equal(observed.taskReads, 0, scenario);
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
    if (scenario.startsWith("unbind_throw_repository_")) {
      assert.equal(
        result.reason,
        "signed_general_task_cancellation_unbind_unknown",
        scenario,
      );
      assert.equal(result.candidateDiscarded, true, scenario);
      assert.equal(
        result.canonicalRepositoryChanged,
        scenario.endsWith("changed") ? true : null,
        scenario,
      );
      assert.equal(result.cleanupConfirmed, false, scenario);
      assert.equal(result.manualRecoveryRequired, true, scenario);
      assert.equal(result.effectStateUnknown, true, scenario);
      assert.deepEqual(result.hostRecoveryIds, [], scenario);
      assert.deepEqual(result.dockerRecoveryIds, [], scenario);
      assert.deepEqual(result.candidateRecoveryIds, [], scenario);
      assert.deepEqual(result.candidateStoreRecoveryIds, [], scenario);
    }
    if (scenario === "control_missing_completion_recovery") {
      assert.equal(result.hostRecoveryId, hostRecoveryA, scenario);
      assert.equal(result.manualRecoveryRequired, true, scenario);
    }
    assert.equal(
      observed.taskReason,
      "coordinator_task_process_restart_required",
      scenario,
    );
  }
});

/**
 * 安全観測がexactな業務不適合は共有Processをpoisonしないを検証する。
 *
 * @responsibility 安全観測がexactな業務不適合は共有Processをpoisonしないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 安全観測がexactな業務不適合は共有Processをpoisonしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 取消、Candidate Store例外をPassへ流さないを検証する。
 *
 * @responsibility 取消、Candidate Store例外をPassへ流さないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消、Candidate Store例外をPassへ流さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * production grace内の遅延取消receiptを短い旧上限で誤poisonしないを検証する。
 *
 * @responsibility production grace内の遅延取消receiptを短い旧上限で誤poisonしないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production grace内の遅延取消receiptを短い旧上限で誤poisonしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 終了未観測receiptはexact cleanupだけで既知取消へ収束するを検証する。
 *
 * @responsibility 終了未観測receiptはexact cleanupだけで既知取消へ収束するの合否判定を所有する。
 * @trace PRL-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 終了未観測receiptはexact cleanupだけで既知取消へ収束するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-003=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * Candidate discard不成立は残存0とせず手動処置対象を返すを検証する。
 *
 * @responsibility Candidate discard不成立は残存0とせず手動処置対象を返すの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate discard不成立は残存0とせず手動処置対象を返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * Taskとdiscardの複合Recoveryは全IDを保持し競合を明示するを検証する。
 *
 * @responsibility Taskとdiscardの複合Recoveryは全IDを保持し競合を明示するの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Taskとdiscardの複合Recoveryは全IDを保持し競合を明示するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * SIGINT／SIGTERMはrequested latchだけをexact onceにしunbind後は不発火にするを検証する。
 *
 * @responsibility SIGINT／SIGTERMはrequested latchだけをexact onceにしunbind後は不発火にするの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus SIGINT／SIGTERMはrequested latchだけをexact onceにしunbind後は不発火にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * 二本目Signal登録失敗は一本目をrollbackしlistenerを残さないを検証する。
 *
 * @responsibility 二本目Signal登録失敗は一本目をrollbackしlistenerを残さないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 二本目Signal登録失敗は一本目をrollbackしlistenerを残さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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

/**
 * completion確定とunbindの間のsignal latchを成功へ取り逃がさないを検証する。
 *
 * @responsibility completion確定とunbindの間のsignal latchを成功へ取り逃がさないの合否判定を所有する。
 * @trace PRL-ST-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus completion確定とunbindの間のsignal latchを成功へ取り逃がさないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-001=Direct Boundary: coordinator Test Source→対象契約
 */
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
