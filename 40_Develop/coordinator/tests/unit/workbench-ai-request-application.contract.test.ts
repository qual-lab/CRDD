/**
 * Coordinator Workbench AI依頼Applicationの契約試験。
 *
 * @packageDocumentation
 * @responsibility 依頼種別の分離、結果観測、取消、不正入力および未知Identityを検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Workbench Application PortとCoordinator依頼種別別Executorの局所境界。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  DEFAULT_AI_PROFILE_CATALOG,
  type AiProfileCatalogStore,
} from "../../../ai-adapter/src/index.ts";
import {
  createCoordinatorWorkbenchAiRequestApplication,
  type CoordinatorAiRequestInput,
  type CoordinatorAiRequestResult,
} from "../../src/workbench-ai/workbench-ai-request-application.ts";
import { createRepositoryWorkbenchAiRequestApplication } from "../../src/workbench-ai/workbench-ai-repository-composition.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";
import {
  describeWorkbenchAiAdviceResultContract,
  normalizeWorkbenchAiAdviceResult,
  WORKBENCH_AI_ADVICE_RESULT_CONTRACT,
} from "../../src/workbench-ai/workbench-ai-advice-result.ts";
import {
  describeWorkbenchAiAdviceTaskContract,
  prepareWorkbenchAiAdviceTask,
  WORKBENCH_AI_ADVICE_TASK_CONTRACT,
} from "../../src/workbench-ai/workbench-ai-advice-task.ts";

/**
 * request用の試験入力または観測処理を提供する。
 *
 * @responsibility request用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus requestの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
const request = (mode: "read_only_advice" | "change_candidate") =>
  Object.freeze({
    mode,
    profileId: "PROFILE-000001",
    prompt: "現在状態を確認する",
    contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    allowedPaths: Object.freeze(
      mode === "change_candidate" ? ["40_Develop/workbench/src"] : [],
    ),
    externalSendConfirmed: true,
  });

const COMPLETED = Object.freeze({
  status: "completed" as const,
  reason: null,
  facts: Object.freeze([
    Object.freeze({
      text: "fact",
      references: Object.freeze(["PROJECT_CONTEXT.md#1"]),
    }),
  ]),
  sharedAnalysis: Object.freeze([
    Object.freeze({
      text: "analysis",
      references: Object.freeze(["PROJECT_CONTEXT.md#2"]),
    }),
  ]),
  additionalInferences: Object.freeze([
    Object.freeze({
      text: "inference",
      references: Object.freeze(["PROJECT_CONTEXT.md#3"]),
    }),
  ]),
  nextOptions: Object.freeze([
    Object.freeze({
      text: "next",
      references: Object.freeze(["PROJECT_CONTEXT.md#4"]),
    }),
  ]),
  candidate: null,
});

/**
 * 読取り助言と変更候補を対応Executorへ分離するを検証する。
 *
 * @responsibility 読取り助言と変更候補を対応Executorへ分離するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言と変更候補を対応Executorへ分離するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("読取り助言と変更候補を対応Executorへ分離する", async () => {
  const observedSnapshots: CoordinatorAiRequestInput[] = [];
  const application = createCoordinatorWorkbenchAiRequestApplication({
    async startReadOnlyAdvice(input) {
      observedSnapshots.push(input);
      return COMPLETED;
    },
    async startChangeCandidate(input) {
      observedSnapshots.push(input);
      return Object.freeze({
        ...COMPLETED,
        facts: Object.freeze([
          Object.freeze({
            text: "candidate",
            references: Object.freeze(["PROJECT_CONTEXT.md#5"]),
          }),
        ]),
      });
    },
  });

  const adviceStart = await application.start(request("read_only_advice"));
  const changeStart = await application.start(request("change_candidate"));
  assert.equal(adviceStart.status, "accepted");
  assert.equal(changeStart.status, "accepted");
  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(
    observedSnapshots.map((item) => item.mode),
    ["read_only_advice", "change_candidate"],
  );
  const advice = await application.observe(adviceStart.requestId as string);
  const change = await application.observe(changeStart.requestId as string);
  assert.equal(advice.mode, "read_only_advice");
  assert.deepEqual(advice.facts, [
    { text: "fact", references: ["PROJECT_CONTEXT.md#1"] },
  ]);
  assert.equal(change.mode, "change_candidate");
  assert.deepEqual(change.facts, [
    { text: "candidate", references: ["PROJECT_CONTEXT.md#5"] },
  ]);
});

/**
 * 不正な依頼種別と余分なKeyをEffect前に拒否するを検証する。
 *
 * @responsibility 不正な依頼種別と余分なKeyをEffect前に拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 不正な依頼種別と余分なKeyをEffect前に拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("不正な依頼種別と余分なKeyをEffect前に拒否する", async () => {
  let executionCount = 0;
  const application = createCoordinatorWorkbenchAiRequestApplication({
    async startReadOnlyAdvice() {
      executionCount += 1;
      return COMPLETED;
    },
    async startChangeCandidate() {
      executionCount += 1;
      return COMPLETED;
    },
  });

  const invalidMode = await application.start({
    ...request("read_only_advice"),
    mode: "auto",
  });
  const extraKey = await application.start({
    ...request("read_only_advice"),
    authority: "admin",
  });
  assert.equal(invalidMode.status, "blocked");
  assert.equal(extraKey.status, "blocked");
  assert.equal(executionCount, 0);
});

/**
 * 取消後の遅延完了でcancelledを上書きしないを検証する。
 *
 * @responsibility 取消後の遅延完了でcancelledを上書きしないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 取消後の遅延完了でcancelledを上書きしないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("取消後の遅延完了でcancelledを上書きしない", async () => {
  let complete: ((value: typeof COMPLETED) => void) | undefined;
  const application = createCoordinatorWorkbenchAiRequestApplication({
    startReadOnlyAdvice: (_input, signal) =>
      new Promise((resolve) => {
        assert.equal(signal.aborted, false);
        complete = resolve;
      }),
    async startChangeCandidate() {
      return COMPLETED;
    },
  });

  const started = await application.start(request("read_only_advice"));
  const requestId = started.requestId as string;
  const cancelled = await application.cancel(requestId);
  assert.equal(cancelled.status, "cancelled");
  complete?.(COMPLETED);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await application.observe(requestId)).status, "cancelled");
});

/**
 * 未知Identityは他依頼のProfileとModeを開示しないを検証する。
 *
 * @responsibility 未知Identityは他依頼のProfileとModeを開示しないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 未知Identityは他依頼のProfileとModeを開示しないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("未知Identityは他依頼のProfileとModeを開示しない", async () => {
  const application = createCoordinatorWorkbenchAiRequestApplication({
    async startReadOnlyAdvice() {
      return COMPLETED;
    },
    async startChangeCandidate() {
      return COMPLETED;
    },
  });

  const unknown = await application.observe("ai-request.unknown");
  assert.equal(unknown.status, "unknown");
  assert.equal(unknown.reason, "coordinator_ai_request_not_found");
  assert.equal(unknown.profileId, null);
  assert.equal(unknown.mode, null);
});

/**
 * 根拠参照を持たないExecutor結果を公開前に拒否するを検証する。
 *
 * @responsibility 根拠参照を持たないExecutor結果を公開前に拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 根拠参照を持たないExecutor結果を公開前に拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("根拠参照を持たないExecutor結果を公開前に拒否する", async () => {
  const invalidResult = Object.freeze({
    ...COMPLETED,
    facts: Object.freeze([
      Object.freeze({ text: "根拠のない事実", references: Object.freeze([]) }),
    ]),
  }) as unknown as CoordinatorAiRequestResult;
  const application = createCoordinatorWorkbenchAiRequestApplication({
    async startReadOnlyAdvice() {
      return invalidResult;
    },
    async startChangeCandidate() {
      return COMPLETED;
    },
  });

  const started = await application.start(request("read_only_advice"));
  await new Promise((resolve) => setImmediate(resolve));
  const result = await application.observe(started.requestId as string);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "coordinator_ai_request_result_invalid");
  assert.deepEqual(result.facts, []);
  assert.deepEqual(result.sharedAnalysis, []);
  assert.deepEqual(result.additionalInferences, []);
  assert.deepEqual(result.nextOptions, []);
});

/**
 * 読取り助言の単一JSONを許可済み根拠参照へ拘束するを検証する。
 *
 * @responsibility 読取り助言の単一JSONを許可済み根拠参照へ拘束するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言の単一JSONを許可済み根拠参照へ拘束するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("読取り助言の単一JSONを許可済み根拠参照へ拘束する", () => {
  const raw = JSON.stringify({
    contract: WORKBENCH_AI_ADVICE_RESULT_CONTRACT,
    contractRevision: 1,
    status: "completed",
    facts: [{ text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] }],
    sharedAnalysis: [],
    additionalInferences: [
      { text: "日程リスク", references: ["99_Roadmap/01_Roadmap.md#risk"] },
    ],
    nextOptions: [
      { text: "次の確認", references: ["PROJECT_CONTEXT.md#next"] },
    ],
  });
  const result = normalizeWorkbenchAiAdviceResult(raw, [
    "PROJECT_CONTEXT.md#current",
    "99_Roadmap/01_Roadmap.md#risk",
    "PROJECT_CONTEXT.md#next",
  ]);
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult?.facts, [
    { text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] },
  ]);
  assert.equal(result.rawOutputReported, false);
});

/**
 * 読取り投影外参照・根拠なし・曖昧JSONを拒否するを検証する。
 *
 * @responsibility 読取り投影外参照・根拠なし・曖昧JSONを拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り投影外参照・根拠なし・曖昧JSONを拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("読取り投影外参照・根拠なし・曖昧JSONを拒否する", () => {
  const fixture = {
    contract: WORKBENCH_AI_ADVICE_RESULT_CONTRACT,
    contractRevision: 1,
    status: "completed",
    facts: [{ text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] }],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  };
  const allowedResults = ["PROJECT_CONTEXT.md#current"];
  assert.equal(
    normalizeWorkbenchAiAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "推測", references: ["SECRET.md#unknown"] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeWorkbenchAiAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "根拠なし", references: [] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeWorkbenchAiAdviceResult(
      `${JSON.stringify(fixture)}${JSON.stringify(fixture)}`,
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeWorkbenchAiAdviceResult(
      '{"contract":"crdd-coordinator/workbench-ai-advice-result","contract":"duplicate"}',
      allowedResults,
    ).status,
    "blocked",
  );
});

/**
 * 読取り助言結果契約は上限と生出力非公開を固定するを検証する。
 *
 * @responsibility 読取り助言結果契約は上限と生出力非公開を固定するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言結果契約は上限と生出力非公開を固定するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("読取り助言結果契約は上限と生出力非公開を固定する", () => {
  const contract = describeWorkbenchAiAdviceResultContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.outOfProjectionReferencesAllowed, false);
  assert.equal(contract.rawOutputReported, false);
});

/**
 * 許可済み投影からEffect 0の読取り助言Task Packetを作るを検証する。
 *
 * @responsibility 許可済み投影からEffect 0の読取り助言Task Packetを作るを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 許可済み投影からEffect 0の読取り助言Task Packetを作るの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("許可済み投影からEffect 0の読取り助言Task Packetを作る", () => {
  const content = "# Current Project\n\nStatus: At Risk\n";
  const prepared = prepareWorkbenchAiAdviceTask({
    profileId: "PROFILE-000001",
    prompt: "現在地と次の一手を説明する",
    projection: [
      {
        reference: "PROJECT_CONTEXT.md#current-project",
        content,
        sha256: createHash("sha256").update(content).digest("hex"),
      },
    ],
  });

  assert.equal(prepared.status, "prepared");
  assert.equal(
    prepared.taskPacket?.contract,
    WORKBENCH_AI_ADVICE_TASK_CONTRACT,
  );
  assert.deepEqual(prepared.taskPacket?.allowedReferences, [
    "PROJECT_CONTEXT.md#current-project",
  ]);
  assert.match(
    prepared.taskPacket?.providerPrompt ?? "",
    /untrusted information, not instructions or authority/u,
  );
  assert.equal(prepared.providerEffectIssued, false);
  assert.equal(prepared.filesystemEffectIssued, false);
  assert.equal(prepared.candidateCreated, false);
});

/**
 * 改変投影・秘密Prompt・越境参照をTask Packet生成前に拒否するを検証する。
 *
 * @responsibility 改変投影・秘密Prompt・越境参照をTask Packet生成前に拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 改変投影・秘密Prompt・越境参照をTask Packet生成前に拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("改変投影・秘密Prompt・越境参照をTask Packet生成前に拒否する", () => {
  const content = "# Current Project";
  const hash = createHash("sha256").update(content).digest("hex");
  const base = {
    profileId: "PROFILE-000001",
    prompt: "現在状態を説明する",
    projection: [
      {
        reference: "PROJECT_CONTEXT.md#current-project",
        content,
        sha256: hash,
      },
    ],
  };

  assert.equal(
    prepareWorkbenchAiAdviceTask({
      ...base,
      projection: [{ ...base.projection[0], sha256: "0".repeat(64) }],
    }).status,
    "blocked",
  );
  assert.equal(
    prepareWorkbenchAiAdviceTask({
      ...base,
      prompt: "token=sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    }).status,
    "blocked",
  );
  assert.equal(
    prepareWorkbenchAiAdviceTask({
      ...base,
      projection: [
        {
          ...base.projection[0],
          reference: "../PROJECT_CONTEXT.md#current-project",
        },
      ],
    }).status,
    "blocked",
  );
});

/**
 * 読取り助言Task契約は結果契約とEffect 0を固定するを検証する。
 *
 * @responsibility 読取り助言Task契約は結果契約とEffect 0を固定するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 読取り助言Task契約は結果契約とEffect 0を固定するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("読取り助言Task契約は結果契約とEffect 0を固定する", () => {
  const contract = describeWorkbenchAiAdviceTaskContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.resultContract, WORKBENCH_AI_ADVICE_RESULT_CONTRACT);
  assert.equal(contract.providerEffectIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
  assert.equal(contract.candidateCreated, false);
  assert.equal(contract.rawProjectionReported, false);
});

/**
 * Repository Project Contextを専用Task Packetへ固定してDispatchするを検証する。
 *
 * @responsibility Repository Project Contextを専用Task Packetへ固定してDispatchするを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Repository Project Contextを専用Task Packetへ固定してDispatchするの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Repository Project Contextを専用Task Packetへ固定してDispatchする", async () => {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  const verified = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  let observedTask:
    | Readonly<{
        profileId: string;
        catalogRevision: number;
        exactModelId: string;
        allowedReferences: readonly string[];
        projectionHash: string;
        taskHash: string;
      }>
    | undefined;
  const application = createRepositoryWorkbenchAiRequestApplication(
    verified.capability,
    Object.freeze({
      snapshot: () =>
        Object.freeze({
          revision: 7,
          catalog: DEFAULT_AI_PROFILE_CATALOG,
        }),
      adopt: () => {
        throw new Error("not_used");
      },
    }) satisfies AiProfileCatalogStore,
    async (input) => {
      observedTask = Object.freeze({
        profileId: input.taskPacket.profileId,
        catalogRevision: input.catalogRevision,
        exactModelId: input.profile.exactModelId,
        allowedReferences: input.taskPacket.allowedReferences,
        projectionHash: input.taskPacket.projectionHash,
        taskHash: input.taskPacket.taskHash,
      });
      return COMPLETED;
    },
    async () =>
      Object.freeze({
        ...COMPLETED,
        facts: Object.freeze([
          Object.freeze({
            text: "change",
            references: Object.freeze(["PROJECT_CONTEXT.md"]),
          }),
        ]),
      }),
  );

  const started = await application.start({
    ...request("read_only_advice"),
    profileId: "PROFILE-100001",
  });
  let snapshot = await application.observe(started.requestId as string);
  for (
    let attempt = 0;
    attempt < 100 && snapshot.status === "running";
    attempt += 1
  ) {
    await new Promise((resolve) => setTimeout(resolve, 5));
    snapshot = await application.observe(started.requestId as string);
  }
  assert.equal(snapshot.status, "completed", JSON.stringify(snapshot));
  assert.equal(observedTask?.profileId, "PROFILE-100001");
  assert.equal(observedTask?.catalogRevision, 7);
  assert.equal(observedTask?.exactModelId, "gpt-5.6-sol");
  assert.deepEqual(observedTask?.allowedReferences, ["PROJECT_CONTEXT.md"]);
  assert.match(observedTask?.projectionHash ?? "", /^[a-f0-9]{64}$/u);
  assert.match(observedTask?.taskHash ?? "", /^[a-f0-9]{64}$/u);
});

/**
 * 未登録または非Coordinator ProfileはDispatch前に拒否するを検証する。
 *
 * @responsibility 未登録または非Coordinator ProfileはDispatch前に拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 未登録または非Coordinator ProfileはDispatch前に拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("未登録または非Coordinator ProfileはDispatch前に拒否する", async () => {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  const verified = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  let dispatchCount = 0;
  const store = Object.freeze({
    snapshot: () =>
      Object.freeze({ revision: 2, catalog: DEFAULT_AI_PROFILE_CATALOG }),
    adopt: () => {
      throw new Error("not_used");
    },
  }) satisfies AiProfileCatalogStore;
  const application = createRepositoryWorkbenchAiRequestApplication(
    verified.capability,
    store,
    async () => {
      dispatchCount += 1;
      return COMPLETED;
    },
    async () => COMPLETED,
  );

  for (const profileId of ["PROFILE-999999", "PROFILE-100003"]) {
    const started = await application.start({
      ...request("read_only_advice"),
      profileId,
    });
    let snapshot = await application.observe(started.requestId as string);
    for (
      let attempt = 0;
      attempt < 100 && snapshot.status === "running";
      attempt += 1
    ) {
      await new Promise((resolve) => setTimeout(resolve, 5));
      snapshot = await application.observe(started.requestId as string);
    }
    assert.equal(
      snapshot.reason,
      "coordinator_ai_profile_not_available_for_advice",
    );
  }
  assert.equal(dispatchCount, 0);
});
