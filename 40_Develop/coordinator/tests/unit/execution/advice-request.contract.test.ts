/**
 * Coordinator読取り助言の入力・結果・投影契約試験。
 *
 * @packageDocumentation
 * @responsibility 依頼種別の分離、結果観測、取消、不正入力および未知Identityを検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Workbench Application PortとCoordinator依頼種別別Executorの局所境界。
 */
import assert from "node:assert/strict";
import { fixtureNetworkPolicy } from "../../fixtures/network-policy.ts";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  defaultAiProfileCatalog,
  type AiProfileCatalogStore,
} from "../../../../ai-adapter/src/index.ts";
import { createRepositoryAdviceExecutor } from "../../../src/execution/request.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../../version-control/src/index.ts";
import {
  describeAdviceResultContract,
  normalizeAdviceResult,
  PROVIDER_ADVICE_RESULT_CONTRACT,
} from "../../../src/execution/task-structured-result.ts";
import {
  describeAdviceTaskContract,
  prepareAdviceTask,
  PROVIDER_ADVICE_TASK_CONTRACT,
} from "../../../src/execution/task-packet.ts";

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
const request = (mode: "read_only_advice") =>
  Object.freeze({
    mode,
    profileId: "PROFILE-000001",
    prompt: "現在状態を確認する",
    contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    allowedPaths: Object.freeze([]),
    expectedNetworkPolicyHash: fixtureNetworkPolicy("codex").policyHash,
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
    contract: PROVIDER_ADVICE_RESULT_CONTRACT,
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
  const result = normalizeAdviceResult(raw, [
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
    contract: PROVIDER_ADVICE_RESULT_CONTRACT,
    contractRevision: 1,
    status: "completed",
    facts: [{ text: "現在状態", references: ["PROJECT_CONTEXT.md#current"] }],
    sharedAnalysis: [],
    additionalInferences: [],
    nextOptions: [],
  };
  const allowedResults = ["PROJECT_CONTEXT.md#current"];
  assert.equal(
    normalizeAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "推測", references: ["SECRET.md#unknown"] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      JSON.stringify({
        ...fixture,
        facts: [{ text: "根拠なし", references: [] }],
      }),
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
      `${JSON.stringify(fixture)}${JSON.stringify(fixture)}`,
      allowedResults,
    ).status,
    "blocked",
  );
  assert.equal(
    normalizeAdviceResult(
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
  const contract = describeAdviceResultContract();
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
  const prepared = prepareAdviceTask({
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
  assert.equal(prepared.taskPacket?.contract, PROVIDER_ADVICE_TASK_CONTRACT);
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
    prepareAdviceTask({
      ...base,
      projection: [{ ...base.projection[0], sha256: "0".repeat(64) }],
    }).status,
    "blocked",
  );
  assert.equal(
    prepareAdviceTask({
      ...base,
      prompt: "token=sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
    }).status,
    "blocked",
  );
  assert.equal(
    prepareAdviceTask({
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
  const contract = describeAdviceTaskContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.resultContract, PROVIDER_ADVICE_RESULT_CONTRACT);
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
  const application = createRepositoryAdviceExecutor(
    verified.capability,
    Object.freeze({
      snapshot: () =>
        Object.freeze({
          status: "read" as const,
          error: null,
          value: Object.freeze({
            revision: 7,
            catalog: defaultAiProfileCatalog,
          }),
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
  );

  const snapshot = await application(
    {
      ...request("read_only_advice"),
      profileId: "PROFILE-100001",
    },
    new AbortController().signal,
  );
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
      Object.freeze({
        status: "read" as const,
        error: null,
        value: Object.freeze({
          revision: 2,
          catalog: defaultAiProfileCatalog,
        }),
      }),
    adopt: () => {
      throw new Error("not_used");
    },
  }) satisfies AiProfileCatalogStore;
  const application = createRepositoryAdviceExecutor(
    verified.capability,
    store,
    async () => {
      dispatchCount += 1;
      return COMPLETED;
    },
  );

  for (const profileId of ["PROFILE-999999", "PROFILE-100003"]) {
    const snapshot = await application(
      {
        ...request("read_only_advice"),
        profileId,
      },
      new AbortController().signal,
    );
    assert.equal(
      snapshot.reason,
      "coordinator_ai_profile_not_available_for_advice",
    );
  }
  assert.equal(dispatchCount, 0);
});
