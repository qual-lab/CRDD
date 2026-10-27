/**
 * verify-orchestrator-real-providersに属する責務をまとめる。
 *
 * @responsibility stableDirectoryを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { getAiModelCatalog } from "../../ai-adapter/src/index.ts";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createFilesystemRepositoryObservationPort,
  resolveRepositoryRuntimeDataPaths,
} from "../../domain-model/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../version-control/src/index.ts";
import { readRepositoryAiSelection } from "../../domain-model/src/index.ts";
import { resolveTaskExecutionSelections } from "../src/selection/resolve.ts";
import { observeRuntimeOwnedDevelopmentSource } from "../src/execution/diagnostics.ts";
import {
  inspectRepositoryIdentityCandidate,
  inspectRepositoryRevisionCandidate,
} from "../../version-control/src/index.ts";
import {
  buildCoordinatorRealProviderReport,
  captureCanonicalRepositorySnapshot,
  type JsonRecord,
  observePublicMcpProcess,
  inspectPublishedCoordinatorIntakeEpoch,
} from "./task-real-provider-contract.ts";

const MARKER =
  "40_Develop/coordinator/tests/fixtures/task-real-provider-verification.txt";
const CANCELLATION_MARKER =
  "40_Develop/coordinator/tests/fixtures/task-real-provider-cancellation.txt";
const BASE = "CRDD_ORCHESTRATOR_BASE\n";
const FINAL = "CRDD_ORCHESTRATOR_REAL_PROVIDER_OK\n";
const VERIFICATION_CHOICES = Object.freeze({
  codex: Object.freeze({
    provider: "codex",
    model: "gpt-5.5",
    effort: "medium",
  } as const),
  claude: Object.freeze({
    provider: "claude",
    model: "opus",
    effort: "medium",
  } as const),
});

/**
 * 検証用二分類の設定とProvider対を起動前後に読取り確認する。
 * @responsibility 明示Executorと分類別Reviewerの組を既存選定Ownerへ照合する。
 * @trace ARCH-000004
 * @input root: 検証済み対象RepositoryのRoot。
 * @returns 同じ設定の内容Identity、又は確認不能のnull。
 * @precondition 二つのverification分類と反対ProviderのReviewerを人間が既存設定へ用意する。
 * @postcondition 欠測・不対応・選定不一致は起動許可へ変換しない。
 * @effect Repository設定を読取るだけ。保存・Process・AIを開始しない。
 * @failure 例外・未設定・不一致はnull。
 * @invariant 設定既定値の追加、fallback、二重Storeを作らない。
 * @boundary 検証Toolと既存設定Reader／選定Owner。
 * @security 認証情報・Repository本文を取得しない。
 * @concurrency 前後二読取りだけであり連続不変性や途中変更復元は保証しない。
 */
function readVerificationAiSelectionIdentity(root: string): string | null {
  try {
    const verified = verifyRepositoryRoot(root);
    if (verified.status !== "completed") return null;
    const read = readRepositoryAiSelection(
      verified.capability,
      getAiModelCatalog().catalog,
    );
    if (read.status !== "available") return null;
    for (const provider of ["codex", "claude"] as const) {
      const selected = resolveTaskExecutionSelections(read.snapshot.config, {
        workType: `verification-${provider}`,
        choice: VERIFICATION_CHOICES[provider],
      });
      if (
        selected.status !== "resolved" ||
        selected.value.executor.provider !== provider ||
        selected.value.reviewer.provider !==
          (provider === "codex" ? "claude" : "codex") ||
        selected.value.executor.source !== "explicit" ||
        selected.value.reviewer.source !== "work_type_override" ||
        selected.value.executor.configIdentity !== read.snapshot.identity ||
        selected.value.reviewer.configIdentity !== read.snapshot.identity
      )
        return null;
    }
    return read.snapshot.identity;
  } catch {
    return null;
  }
}
const MAXIMUM_OUTPUT_BYTES = 4 * 1024 * 1024;
const PROCESS_TIMEOUT_MS = 45 * 60_000;
let verifiedRepositoryRootForFixtureCleanup: string | null = null;
let isMcpStartRequested = false;

/**
 * 固定Checkoutの実行Sourceと公開MCP入口を読取り観測する。
 * @responsibility Source、Git改訂と固定入口の内容・実体を同じ観測へ結合する。
 * @trace ARCH-000004
 * @input N/A: module自身のCheckoutだけを使用する。
 * @returns 非公開実体情報を含む観測値、または観測不能のnull。
 * @precondition Git Rootと固定入口を確認できる。
 * @postcondition 外部へ公開する際は実体情報を除く。
 * @effect 固定SourceとGitを読取り、Processや保存を発行しない。
 * @failure 欠落・Link・複数Link・容量超過・途中差・例外はnull。
 * @invariant 内容HashとGit改訂を実行許可・署名として使用しない。
 * @boundary 選択Checkoutと検証Runner。
 * @security 絶対Root・本文・実体情報を公開しない。
 * @concurrency 前後観測を照合するが、ロード済みModuleの原子的固定を保証しない。
 */
function observeRuntimeSource() {
  try {
    const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const verified = verifyRepositoryRoot(sourceRoot);
    if (
      verified.status !== "completed" ||
      resolveVerifiedRepositoryRoot(verified.capability) !==
        path.resolve(sourceRoot)
    )
      return null;
    const before = inspectRepositoryRevisionCandidate(sourceRoot);
    const source = observeRuntimeOwnedDevelopmentSource();
    const entryPath = path.join(
      sourceRoot,
      "template",
      "tools",
      "crdd-mcp-server.ts",
    );
    const entryBefore = fs.lstatSync(entryPath, { bigint: true });
    if (
      !entryBefore.isFile() ||
      entryBefore.isSymbolicLink() ||
      entryBefore.nlink !== 1n
    )
      return null;
    const entry = createFilesystemRepositoryObservationPort(
      verified.capability,
      64 * 1024,
    ).observeFile("template/tools/crdd-mcp-server.ts");
    const entryAfter = fs.lstatSync(entryPath, { bigint: true });
    if (
      !entryAfter.isFile() ||
      entryAfter.isSymbolicLink() ||
      entryAfter.nlink !== 1n
    )
      return null;
    const entryIdentityBefore = JSON.stringify(
      [
        entryBefore.dev,
        entryBefore.ino,
        entryBefore.birthtimeNs,
        entryBefore.mtimeNs,
        entryBefore.ctimeNs,
        entryBefore.size,
        entryBefore.nlink,
      ].map(String),
    );
    const entryIdentityAfter = JSON.stringify(
      [
        entryAfter.dev,
        entryAfter.ino,
        entryAfter.birthtimeNs,
        entryAfter.mtimeNs,
        entryAfter.ctimeNs,
        entryAfter.size,
        entryAfter.nlink,
      ].map(String),
    );
    const after = inspectRepositoryRevisionCandidate(sourceRoot);
    if (
      !source ||
      entry.status !== "resolved" ||
      entryIdentityBefore !== entryIdentityAfter ||
      before?.status !== "candidate" ||
      after?.status !== "candidate" ||
      before.commit !== after.commit ||
      before.tree !== after.tree
    )
      return null;
    return Object.freeze({
      scope: source.scope,
      sourceSha256: source.sourceSha256,
      sourceIdentitySha256: source.sourceIdentitySha256,
      crddCommit: before.commit,
      crddTree: before.tree,
      // Domain Readerが返したUTF8文字列のHash。生byteの完全性証明ではない。
      mcpEntrySourceSha256: createHash("sha256")
        .update(entry.source, "utf8")
        .digest("hex"),
      mcpEntryIdentity: entryIdentityAfter,
    });
  } catch {
    return null;
  }
}

/**
 * 実Provider E2Eが所有する採用確認fixtureだけを開始前内容へ戻す。
 *
 * @responsibility 正本Repositoryへ残る試験副作用を、開始時に確認した既知内容へ限定して解消する。
 * @trace ARCH-000004
 * @input N/A: mainが検証済みRepository Rootを設定する。
 * @returns N/A: 戻り値を返さない。
 * @precondition 対象Fileは開始時にBASEと一致していた。
 * @postcondition E2Eが生成したFINALだけをBASEへ戻し、それ以外の内容は変更しない。
 * @effect E2E所有fixture一件を条件付きで書き戻す。
 * @failure Fileが存在しない、同一実体として確認できない、読取不能または既知内容以外なら失敗として停止する。
 * @invariant Cancellation fixtureおよび利用者が変更した未知内容を上書きしない。
 * @boundary 実Provider E2E Processと正本Repositoryの試験fixture境界。
 * @security Secret、Provider出力またはRepository外Pathを扱わない。
 * @concurrency 同じE2E Processが所有する終了処理から一度だけ呼び出す。
 */
function restoreOwnedAdoptionFixture(): void {
  if (verifiedRepositoryRootForFixtureCleanup === null) return;
  const markerPath = path.join(
    verifiedRepositoryRootForFixtureCleanup,
    ...MARKER.split("/"),
  );
  const before = fs.lstatSync(markerPath);
  if (!before.isFile() || before.isSymbolicLink())
    throw new Error("orchestrator_verification_fixture_invalid");
  const descriptor = fs.openSync(markerPath, "r+");
  try {
    const opened = fs.fstatSync(descriptor);
    if (opened.dev !== before.dev || opened.ino !== before.ino)
      throw new Error("orchestrator_verification_fixture_changed");
    const bytes = Buffer.alloc(opened.size);
    if (fs.readSync(descriptor, bytes, 0, bytes.length, 0) !== bytes.length)
      throw new Error("orchestrator_verification_fixture_read_incomplete");
    const current = bytes.toString("utf8");
    if (current !== BASE && current !== FINAL)
      throw new Error("orchestrator_verification_fixture_content_unknown");
    if (current === FINAL) {
      fs.ftruncateSync(descriptor, 0);
      if (fs.writeSync(descriptor, BASE, 0, "utf8") !== Buffer.byteLength(BASE))
        throw new Error("orchestrator_verification_fixture_write_incomplete");
      fs.fsyncSync(descriptor);
    }
  } finally {
    fs.closeSync(descriptor);
  }
  const after = fs.lstatSync(markerPath);
  if (
    after.dev !== before.dev ||
    after.ino !== before.ino ||
    fs.readFileSync(markerPath, "utf8") !== BASE
  )
    throw new Error("orchestrator_verification_fixture_cleanup_unconfirmed");
}

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
function mcpEnvelope(
  id: string,
  request: unknown,
  tool = "crdd.run_objective",
) {
  return `${JSON.stringify({
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
      },
      name: tool,
      arguments: request,
    },
  })}\n`;
}

/**
 * Public Mcp Processを開始する。
 *
 * @responsibility Public Mcp Processの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input sourceRoot: string、repositoryRoot: string
 * @returns startPublicMcpProcessの計算結果を返す。
 * @precondition 固定Source Rootと検証対象Rootが確認済み。
 * @postcondition startPublicMcpProcessの責務を完了した結果だけを返す。
 * @effect startPublicMcpProcessは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: startPublicMcpProcessは独自の失敗分岐を所有しない。
 * @invariant startPublicMcpProcessは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: startPublicMcpProcessはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: startPublicMcpProcessは共有非同期状態を持たない同期処理である。
 */
function startPublicMcpProcess(sourceRoot: string, repositoryRoot: string) {
  const entryPath = path.join(
    sourceRoot,
    "template",
    "tools",
    "crdd-mcp-server.ts",
  );
  isMcpStartRequested = true;
  return spawn(process.execPath, [entryPath, "--stdio"], {
    cwd: repositoryRoot,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

/**
 * 公開MCP状態取得から新Requestの受付世代を得る。
 *
 * @responsibility 認証済みQueryと子Processの終端を確認し、発行時世代を固定する。
 * @trace ARCH-000004
 * @input 固定Source Root、Repository Root、ProjectとRevisionのQuery結合。
 * @returns 検査済みの受付世代。
 * @precondition 新版保存を明示初期化済みで、送信範囲は固定検証Task内である。
 * @postcondition 同Requestの再入場では呼び直して世代を付け替えない。
 * @effect localhostの公開MCP Processを起動し、状態Queryだけを発行する。
 * @failure 相関差、通信障害、未終了、Provider起動またはQuery停止を拒否する。
 * @invariant 初期化・Provider依頼・外部送信をこのQueryへ追加しない。
 * @boundary 固定検証Toolと公開MCP状態取得。
 * @security 内部保存を直接読まず、認証・認可済みの公開DTOだけを使用する。
 * @concurrency 入力EOFと子Process終了を確認してから値を返す。
 */
async function readPublishedIntakeEpoch(
  sourceRoot: string,
  repositoryRoot: string,
  request: { projectId: string; repositoryRevision: string },
): Promise<string> {
  const child = startPublicMcpProcess(sourceRoot, repositoryRoot);
  const observed = observePublicMcpProcess(child, {
    maximumOutputBytes: MAXIMUM_OUTPUT_BYTES,
    timeoutMs: PROCESS_TIMEOUT_MS,
    closeInputWhen: ({ stdout }) => stdout.split(/\r?\n/u).some(Boolean),
  });
  child.stdin.write(
    mcpEnvelope(
      "intake-epoch",
      {
        requestId: "intake-epoch",
        projectId: request.projectId,
        repositoryRevision: request.repositoryRevision,
      },
      "crdd.get_coordinator_state",
    ),
  );
  const observation = await observed;
  const epoch = inspectPublishedCoordinatorIntakeEpoch(observation, {
    requestId: "intake-epoch",
    ...request,
  });
  if (epoch === null)
    throw new Error("orchestrator_verification_state_unconfirmed");
  return epoch;
}

/**
 * 新しい検証依頼の意味と範囲を固定する。
 * @responsibility Providerと採否を固定し、受付世代は発行直前の取得値を使う。
 * @trace ARCH-000004
 * @input 共通の検証範囲、Run Identity、Provider、採否。
 * @returns 変更不能な新Request候補。
 * @precondition 基準Revisionと検証範囲が確認済み。
 * @postcondition 受信側に世代補完を求めない。
 * @effect N/A: 値の構築のみ。
 * @failure N/A: 外部処理を呼ばない。
 * @invariant 同じ依頼の再入場でIdentityや世代を変更しない。
 * @boundary 固定検証Taskの発行境界。
 * @security 新しい送信範囲やAuthorityを生成しない。
 * @concurrency N/A: 同期構築。
 */
function objective(
  commonFields: JsonRecord,
  runId: string,
  provider: "codex" | "claude",
  shouldAdoptResult: boolean,
) {
  return Object.freeze({
    ...commonFields,
    requestId: `orchestrator-public-${provider}-${runId}`,
    projectId: `crdd-orchestrator-public-${provider}-${runId}`,
    milestoneId: `public-provider-${provider}`,
    workType: `verification-${provider}`,
    choice: VERIFICATION_CHOICES[provider],
    adoptResult: shouldAdoptResult,
  });
}

/**
 * verify-orchestrator-real-providersのCommand処理を開始する。
 *
 * @responsibility verify-orchestrator-real-providersの引数受付、終了Code、診断出力境界を所有する。
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
  if (process.argv.length !== 2)
    throw new Error("usage: verify-orchestrator-real-providers");
  if (process.platform !== "win32")
    throw new Error("orchestrator_real_recovery_e2e_windows_only");
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  const sourceRoot = fileURLToPath(new URL("../../../", import.meta.url));
  const runtimeSourceBefore = observeRuntimeSource();
  if (!runtimeSourceBefore)
    throw new Error("orchestrator_verification_source_unavailable");
  const repository = inspectRepositoryIdentityCandidate(repositoryRoot);
  assert.equal(repository?.status, "candidate");
  if (repository?.status !== "candidate")
    throw new Error("repository_identity_not_verified");
  for (const marker of [MARKER, CANCELLATION_MARKER])
    assert.equal(
      fs.readFileSync(path.join(repositoryRoot, ...marker.split("/")), "utf8"),
      BASE,
    );
  const aiSelectionIdentity =
    readVerificationAiSelectionIdentity(repositoryRoot);
  if (aiSelectionIdentity === null)
    throw new Error("orchestrator_verification_ai_selection_unavailable");
  verifiedRepositoryRootForFixtureCleanup = repositoryRoot;

  const verifiedRuntimeRoot = verifyRepositoryRoot(repositoryRoot);
  const runtimePaths =
    verifiedRuntimeRoot.status === "completed"
      ? resolveRepositoryRuntimeDataPaths(verifiedRuntimeRoot.capability)
      : null;
  if (!runtimePaths) throw new Error("orchestrator_verification_path_invalid");
  const verificationRoot = runtimePaths.tests;

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
      "06_Architecture/Details/coordinator/04_Task_Detailed_Design.md",
    ]),
    maximumConcurrency: 1,
    maximumReplans: 0,
    originLane: "interactive",
  });
  const plan = Object.freeze({
    milestoneAcceptanceCriteria: commonFields.acceptanceCriteria,
    objectives: [
      {
        id: "objective-verification",
        acceptanceCriteria: commonFields.acceptanceCriteria,
      },
    ],
    tasks: [
      {
        id: "task-verification",
        objectiveId: "objective-verification",
        dependencies: [],
        allowedPaths: commonFields.allowedPaths,
        conflictKeys: commonFields.allowedPaths,
      },
    ],
  });
  const taskInputs = [
    {
      taskId: "task-verification",
      objective: commonFields.objective,
      acceptanceCriteria: commonFields.acceptanceCriteria,
      readPaths: commonFields.readPaths,
    },
  ];
  const objectives = Object.freeze([
    objective({ ...commonFields, plan, taskInputs }, runId, "codex", false),
    objective({ ...commonFields, plan, taskInputs }, runId, "claude", true),
  ]);

  const normalRuns = [];
  for (const [index, candidate] of objectives.entries()) {
    const request = Object.freeze({
      ...candidate,
      intakeEpoch: await readPublishedIntakeEpoch(sourceRoot, repositoryRoot, {
        projectId: candidate.projectId,
        repositoryRevision: repository.commit,
      }),
    });
    const snapshotBefore = captureCanonicalRepositorySnapshot(repositoryRoot);
    const child = startPublicMcpProcess(sourceRoot, repositoryRoot);
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
          executorProvider: request.choice.provider,
          reviewerProvider:
            request.choice.provider === "codex" ? "claude" : "codex",
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
    intakeEpoch: await readPublishedIntakeEpoch(sourceRoot, repositoryRoot, {
      projectId: `crdd-orchestrator-public-cancel-${runId}`,
      repositoryRevision: repository.commit,
    }),
    requestId: `orchestrator-public-cancel-${runId}`,
    projectId: `crdd-orchestrator-public-cancel-${runId}`,
    milestoneId: "public-provider-cancellation",
    workType: "verification-claude",
    choice: VERIFICATION_CHOICES.claude,
    objective: `Replace ${CANCELLATION_MARKER} after carefully inspecting all allowed inputs.`,
    acceptanceCriteria: Object.freeze([
      `The only changed path is ${CANCELLATION_MARKER}.`,
      "The task remains active long enough for the MCP parent to cancel it.",
    ]),
    allowedPaths: Object.freeze([CANCELLATION_MARKER]),
    readPaths: Object.freeze([
      CANCELLATION_MARKER,
      "06_Architecture/Details/coordinator/04_Task_Detailed_Design.md",
    ]),
    adoptResult: false,
  });
  const cancellationChild = startPublicMcpProcess(sourceRoot, repositoryRoot);
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
    intakeEpoch: await readPublishedIntakeEpoch(sourceRoot, repositoryRoot, {
      projectId: `crdd-orchestrator-public-recovery-${runId}`,
      repositoryRevision: repository.commit,
    }),
    requestId: `orchestrator-public-recovery-${runId}`,
    projectId: `crdd-orchestrator-public-recovery-${runId}`,
    milestoneId: "public-provider-parent-loss-recovery",
    workType: "verification-claude",
    choice: VERIFICATION_CHOICES.claude,
    objective: `Inspect the allowed inputs and replace ${CANCELLATION_MARKER} with its current exact content.`,
    acceptanceCriteria: Object.freeze([
      `The only allowed path is ${CANCELLATION_MARKER}.`,
      `The file remains exactly ${JSON.stringify(BASE)} as UTF-8 bytes.`,
    ]),
    allowedPaths: Object.freeze([CANCELLATION_MARKER]),
    readPaths: Object.freeze([
      CANCELLATION_MARKER,
      "06_Architecture/Details/coordinator/04_Task_Detailed_Design.md",
    ]),
    adoptResult: false,
  });
  const recoverySnapshotBefore =
    captureCanonicalRepositorySnapshot(repositoryRoot);
  const parentLossChild = startPublicMcpProcess(sourceRoot, repositoryRoot);
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

  const reentryChild = startPublicMcpProcess(sourceRoot, repositoryRoot);
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

  const report = buildCoordinatorRealProviderReport({
    runId,
    aiSelectionObservationStatus: (() => {
      const after = readVerificationAiSelectionIdentity(repositoryRoot);
      return after === null
        ? "unavailable"
        : after === aiSelectionIdentity
          ? "matched"
          : "changed";
    })(),
    executionIdentity: Object.freeze({
      commit: repository.commit,
      tree: repository.tree,
    }),
    runtimeSource: Object.freeze({
      scope: runtimeSourceBefore.scope,
      sourceSha256: runtimeSourceBefore.sourceSha256,
      crddCommit: runtimeSourceBefore.crddCommit,
      crddTree: runtimeSourceBefore.crddTree,
      mcpEntrySourceSha256: runtimeSourceBefore.mcpEntrySourceSha256,
      observationStatus: (() => {
        const after = observeRuntimeSource();
        return after === null
          ? "unavailable"
          : JSON.stringify(after) === JSON.stringify(runtimeSourceBefore)
            ? "matched"
            : "changed";
      })(),
      signatureRequired: false,
    }),
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
  });
  fs.mkdirSync(verificationRoot, { recursive: true, mode: 0o700 });
  stableDirectory(verificationRoot);
  const reportDirectory = path.join(
    verificationRoot,
    `orchestrator-public-real-providers-${Date.now()}`,
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
  if (!isMcpStartRequested) {
    process.stdout.write(
      `${JSON.stringify(
        {
          contract: "crdd-coordinator/orchestrator-real-provider-verification",
          contractRevision: 13,
          aiSelectionObservationStatus: "unavailable",
          status: "blocked",
          reason: "orchestrator_public_mcp_verification_incomplete",
          problems: ["verification_exception"],
          phase: "verification_not_started",
          childProcessStarted: false,
          childProcessJoined: true,
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          effectState: "no_effect",
          executionIdentity: null,
          runtimeSource: null,
          releaseAuthorityConferred: false,
          rawProviderOutputReported: false,
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode = 2;
  } else {
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
      throw new Error("orchestrator_verification_path_invalid");
    const verificationRoot = runtimePaths.tests;
    fs.mkdirSync(verificationRoot, { recursive: true, mode: 0o700 });
    const report = Object.freeze({
      contract: "crdd-coordinator/orchestrator-real-provider-verification",
      contractRevision: 13,
      aiSelectionObservationStatus: "unavailable",
      status: "blocked",
      reason: "orchestrator_public_mcp_verification_incomplete",
      problems: Object.freeze(["verification_exception"]),
      phase: "verification_unknown",
      childProcessStarted: null,
      childProcessJoined: null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: true,
      effectState: "unknown",
      executionIdentity:
        repository?.status === "candidate"
          ? Object.freeze({ commit: repository.commit, tree: repository.tree })
          : null,
      runtimeSource: null,
      releaseAuthorityConferred: false,
      rawProviderOutputReported: false,
    });
    const reportDirectory = path.join(
      verificationRoot,
      `orchestrator-public-real-providers-${Date.now()}`,
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
} finally {
  if (isMcpStartRequested) restoreOwnedAdoptionFixture();
}
