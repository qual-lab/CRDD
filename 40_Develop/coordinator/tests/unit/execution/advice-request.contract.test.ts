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
import type { ExecutionSelection } from "../../../../execution-model/src/index.ts";
import assert from "node:assert/strict";
import { executionSelection } from "../../fixtures/ai-selection.ts";

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createRepositoryTestDirectory } from "../../../../execution-model/tests/support/repository-test-directory.ts";
import test from "node:test";
import { createRepositoryAdviceExecutor } from "../../../src/execution/advice.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  getRepository,
} from "../../../../version-control/src/index.ts";
import {
  describeAdviceTaskContract,
  issueRuntimeOwnedProviderAdvicePacket,
  revokeRuntimeOwnedProviderAdvicePacket,
  prepareAdviceTask,
  PROVIDER_ADVICE_TASK_CONTRACT,
} from "../../../src/execution/preparation.ts";

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
    executionSelection: executionSelection("advice"),
    prompt: "現在状態を確認する",
    contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
    allowedPaths: Object.freeze([]),
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
    executionSelection: executionSelection("advice"),
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
/**
 * 正常な旧容量超過は保存済みHashと参照を変えず準備する。
 * @responsibility Prompt・投影件数・本文・参照の量だけによる拒否を再発させない。
 * @trace ERB-UT-023
 * @precondition 非秘密の合成値だけを渡す。
 * @stimulus 65投影、各65,537byte、16KiB超Promptと512byte超参照を準備する。
 * @observation 元の許可参照、全量providerPromptとEffect非発行。
 * @oracle 全件preparedで、Hash不一致・秘密値等は別負例で拒否する。
 * @cleanup メモリ内値のみ。
 * @boundary Advice準備の純粋入力。
 */
test("助言準備は旧容量超過の正常なPromptと投影を全量保持する", () => {
  const content = "a".repeat(65_537);
  const projection = Array.from({ length: 65 }, (_, index) => ({
    reference: `${"reference".repeat(65)}-${index}.md`,
    content,
    sha256: createHash("sha256").update(content).digest("hex"),
  }));
  const prepared = prepareAdviceTask({
    executionSelection: executionSelection("advice"),
    prompt: "合成".repeat(9000),
    projection,
  });
  assert.equal(prepared.status, "prepared");
  assert.deepEqual(
    prepared.taskPacket?.allowedReferences,
    projection.map((item) => item.reference),
  );
  assert.ok(
    Buffer.byteLength(prepared.taskPacket?.providerPrompt ?? "", "utf8") >
      512 * 1024,
  );
  assert.equal(prepared.providerEffectIssued, false);
  assert.equal(prepared.filesystemEffectIssued, false);
  const issued = issueRuntimeOwnedProviderAdvicePacket({
    operationId: "OP-000999",
    executionSelection: executionSelection("advice"),
    provider: "codex",
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
    providerPrompt: prepared.taskPacket?.providerPrompt ?? "",
    allowedReferences: projection.map((item) => item.reference),
    additionalHosts: Object.freeze([]),
  });
  assert.equal(issued.status, "issued");
  assert.equal(
    revokeRuntimeOwnedProviderAdvicePacket(issued.ownerCapability),
    true,
  );
  for (const field of [
    "maximumPromptBytes",
    "maximumProjectionItemBytes",
    "maximumProjectionBytes",
    "maximumProjectionItems",
  ])
    assert.equal(Object.hasOwn(describeAdviceTaskContract(), field), false);
});

test("改変投影・秘密Prompt・越境参照をTask Packet生成前に拒否する", () => {
  const content = "# Current Project";
  const hash = createHash("sha256").update(content).digest("hex");
  const base = {
    executionSelection: executionSelection("advice"),
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
  assert.equal(contract.contractRevision, 2);
  assert.equal("resultContract" in contract, false);
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
 * @cleanup 自己生成した合成Git Repositoryだけを終了hookで回収する。
 * @boundary ERB-UT-023=Direct Boundary: 合成Repository→本番読取り境界→模擬Dispatch。外部AIなし。
 */
test("Repository Project Contextを専用Task Packetへ固定してDispatchする", async (t) => {
  const directory = createRepositoryTestDirectory("advice-packet-");
  const root = directory.path;
  t.after(directory.cleanup);
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  fs.writeFileSync(
    path.join(root, "PROJECT_CONTEXT.md"),
    "# Synthetic Project Context\nStatus: ready\n",
  );
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  let observedTask:
    | Readonly<{
        executionSelection: ExecutionSelection;
        exactModelId: string;
        allowedReferences: readonly string[];
        projectionHash: string;
        taskHash: string;
      }>
    | undefined;
  const application = createRepositoryAdviceExecutor(
    verified.capability,
    async (input) => {
      observedTask = Object.freeze({
        executionSelection: input.taskPacket.executionSelection,
        exactModelId: input.executionSelection.modelIdentifier,
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
      executionSelection: executionSelection("advice"),
    },
    new AbortController().signal,
  );
  assert.equal(snapshot.status, "completed", JSON.stringify(snapshot));
  assert.deepEqual(
    observedTask?.executionSelection,
    executionSelection("advice"),
  );
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
  const verified = getRepository(repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  let dispatchCount = 0;
  const application = createRepositoryAdviceExecutor(
    verified.capability,
    async () => {
      dispatchCount += 1;
      return COMPLETED;
    },
  );

  for (const selected of [null, executionSelection("executor")]) {
    const snapshot = await application(
      {
        ...request("read_only_advice"),
        executionSelection: selected as ExecutionSelection,
      },
      new AbortController().signal,
    );
    assert.equal(
      snapshot.reason,
      "coordinator_ai_selection_not_available_for_advice",
    );
  }
  assert.equal(dispatchCount, 0);
});
