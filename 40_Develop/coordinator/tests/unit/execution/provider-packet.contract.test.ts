/**
 * Commandを持たない助言Packetの入力相関・一回消費を検証する。
 * @packageDocumentation
 * @responsibility 選定・送信内容・参照・通信条件の固定と、旧Command入力の拒否を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 通常dataとProcess内Packetだけ。実AI・Dockerなし。
 * @boundary Coordinatorの確定入力とExecutorへ渡すPacket。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import {
  consumeRuntimeOwnedProviderAdvicePacket,
  describeProviderAdvicePacketContract,
  issueRuntimeOwnedProviderAdvicePacket,
  revokeRuntimeOwnedProviderAdvicePacket,
  type ProviderAdvicePacketInput,
} from "../../../src/execution/preparation.ts";

/**
 * 合成の確定入力を作る。
 * @responsibility 実行権限を持たない固定選定・参照・Policyを各試験へ渡す。
 * @trace ERB-UT-023
 * @precondition Test Process内だけで使う。
 * @stimulus 一つの正規入力を生成する。
 * @observation 返却した通常dataを試験が個別に変更する。
 * @oracle 未変更の入力は発行できる。
 * @cleanup 消費又は取消は呼出し試験が所有する。
 * @boundary 合成入力とPacket受付。
 */
function input(): ProviderAdvicePacketInput {
  return {
    operationId: "OP-000001",
    executionSelection: executionSelection("advice"),
    provider: "codex",
    taskHash: "a".repeat(64),
    projectionHash: "b".repeat(64),
    providerPrompt: "synthetic",
    allowedReferences: ["PROJECT_CONTEXT.md"],
    additionalHosts: Object.freeze([]),
  };
}

/**
 * 確定入力と一回消費の相関を確認する。
 * @responsibility Commandの有無を実行権限や送信成立と混同しない。
 * @trace ERB-UT-023
 * @precondition 合成選定・参照・通信条件だけを使用する。
 * @stimulus 正常発行・別Owner・再消費・取消を与える。
 * @observation Packet、元参照、返却値とEffect非発行。
 * @oracle 元Ownerだけ一回消費でき、旧Command/Hashは公開されない。
 * @cleanup 発行Packetは消費又は取消する。外部資源なし。
 * @boundary Packet Ownerと確定入力。
 */
test("助言Packetは元Ownerだけが一回消費しCommandを含まない", () => {
  const issued = issueRuntimeOwnedProviderAdvicePacket(input());
  assert.equal(issued.status, "issued");
  assert.equal(issued.providerEffectIssued, false);
  assert.equal(
    consumeRuntimeOwnedProviderAdvicePacket(issued.useCapability, {}),
    null,
  );
  const packet = consumeRuntimeOwnedProviderAdvicePacket(
    issued.useCapability,
    issued.ownerCapability,
  );
  assert.ok(packet);
  assert.equal(packet.operationId, "OP-000001");
  assert.deepEqual(packet.additionalHosts, input().additionalHosts);
  assert.equal("providerCommand" in packet, false);
  assert.equal("commandHash" in packet, false);
  assert.equal(packet.repositoryMounted, false);
  assert.equal(packet.workspaceMounted, false);
  assert.equal(packet.toolsAllowed, false);
  assert.equal(packet.sessionPersistenceAllowed, false);
  assert.match(packet.packetHash, /^[a-f0-9]{64}$/u);
  assert.equal(
    consumeRuntimeOwnedProviderAdvicePacket(
      issued.useCapability,
      issued.ownerCapability,
    ),
    null,
  );
  const cancelled = issueRuntimeOwnedProviderAdvicePacket(input());
  const result = revokeRuntimeOwnedProviderAdvicePacket(
    cancelled.ownerCapability,
  );
  assert.equal(result, true);
  assert.equal(
    consumeRuntimeOwnedProviderAdvicePacket(
      cancelled.useCapability,
      cancelled.ownerCapability,
    ),
    null,
  );
});

/**
 * 技術Commandを除いても、送信対象の全内容をPacket Hashへ結合する。
 * @responsibility 許可参照・Policy・選定・本文・操作の混入を反証する。
 * @trace ERB-UT-023
 * @precondition 消費済みPacketの元参照と合成入力だけを使う。
 * @stimulus 同じ参照のまま一項目ずつ差し替えたHashを比較する。
 * @observation 正規Hashと各変異Hash。
 * @oracle 正規だけ一致し、Commandの専用Hashを必要としない。
 * @cleanup Packetを消費する。値計算だけ。
 * @boundary Packet意味的Identity。
 */
test("Packet Hashは操作・完全選定・本文・参照・Policyを固定する", () => {
  const value = input(),
    issued = issueRuntimeOwnedProviderAdvicePacket(value);
  const packet = consumeRuntimeOwnedProviderAdvicePacket(
    issued.useCapability,
    issued.ownerCapability,
  );
  assert.ok(packet);
  const content = {
    contract: "crdd-executor/advice-input",
    contractRevision: 2,
    packetRef: packet.packetRef,
    operationId: value.operationId,
    executionSelection: value.executionSelection,
    provider: value.provider,
    taskHash: value.taskHash,
    projectionHash: value.projectionHash,
    additionalHosts: value.additionalHosts,
    providerPromptSha256: createHash("sha256")
      .update(value.providerPrompt)
      .digest("hex"),
    allowedReferences: value.allowedReferences,
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
  };
  const hash = (value: object) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(packet.packetHash, hash(content));
  for (const change of [
    { operationId: "OP-000002" },
    {
      executionSelection: {
        ...value.executionSelection,
        reasoningEffort: "high",
      },
    },
    { providerPromptSha256: "f".repeat(64) },
    { allowedReferences: ["other"] },
    { additionalHosts: ["extra.example.com"] },
  ])
    assert.notEqual(packet.packetHash, hash({ ...content, ...change }));
});

/**
 * 入力の遅延変更・不正形をEffectなしで拒否する。
 * @responsibility 新方式の確定data以外をPacketへ持ち込まない。
 * @trace ERB-UT-023
 * @precondition 合成の正常入力から一軸だけ変異させる。
 * @stimulus 別Provider、用途差、空本文、参照重複、旧Command、getter、Proxy。
 * @observation 発行結果とgetter呼出し回数。
 * @oracle 不正はblocked・Capabilityなし、getterは実行しない。
 * @cleanup 発行成功を想定せず外部資源を作らない。
 * @boundary 未確定入力とPacket受付。
 */
test("入力検査は選定・通信条件・旧Command・不正dataを拒否する", () => {
  for (const change of [
    { operationId: "wrong" },
    { provider: "claude" },
    { additionalHosts: {} },
    { executionSelection: executionSelection("executor") },
    { providerPrompt: "" },
    { providerPrompt: 123 },
    { providerPrompt: " synthetic" },
    { providerPrompt: "synthetic\0" },
    { taskHash: "wrong" },
    { projectionHash: "wrong" },
    { allowedReferences: ["same", "same"] },
    { providerCommand: { workspaceMountRequired: true } },
  ]) {
    const issued = issueRuntimeOwnedProviderAdvicePacket({
      ...input(),
      ...change,
    } as ProviderAdvicePacketInput);
    assert.equal(issued.status, "blocked");
    assert.equal(issued.ownerCapability, null);
  }
  let reads = 0;
  const accessor = { ...input() };
  Object.defineProperty(accessor, "additionalHosts", {
    enumerable: true,
    get() {
      reads++;
      throw Error("must not read");
    },
  });
  assert.equal(
    issueRuntimeOwnedProviderAdvicePacket(accessor).status,
    "blocked",
  );
  assert.equal(
    issueRuntimeOwnedProviderAdvicePacket(new Proxy(input(), {})).status,
    "blocked",
  );
  assert.equal(reads, 0);
});

/**
 * 発行後は元入力の変更を採用しない。
 * @responsibility Policy・参照を固定し、可変入力から次回許可が広がらないことを確認する。
 * @trace ERB-UT-023
 * @precondition 通常dataに複製したPolicyと参照配列を入力する。
 * @stimulus 発行後に元配列・Provider・本文を変更する。
 * @observation 消費Packetの元値と凍結状態。
 * @oracle 発行時の値だけ残り、可変参照を保持しない。
 * @cleanup Packetを消費する。外部資源なし。
 * @boundary 入力Snapshotと一回消費。
 */
test("Policy・参照・本文は発行時の値で固定する", () => {
  const value = {
    ...input(),
    allowedReferences: ["PROJECT_CONTEXT.md"],
    additionalHosts: JSON.parse(JSON.stringify(input().additionalHosts)),
  };
  const issued = issueRuntimeOwnedProviderAdvicePacket(value);
  value.allowedReferences.push("later");
  value.additionalHosts.push("later.example");
  value.providerPrompt = "later";
  value.executionSelection = executionSelection("executor");
  const packet = consumeRuntimeOwnedProviderAdvicePacket(
    issued.useCapability,
    issued.ownerCapability,
  );
  assert.ok(packet);
  assert.deepEqual(packet.allowedReferences, ["PROJECT_CONTEXT.md"]);
  assert.equal(packet.additionalHosts.includes("later.example"), false);
  assert.equal(packet.providerPrompt, "synthetic");
  assert.equal(packet.executionSelection.role, "advice");
  assert.equal(Object.isFrozen(packet.additionalHosts), true);
});

/**
 * 公開契約は非共有と一回消費を維持する。
 * @responsibility Command廃止で実行許可や共有条件を広げない。
 * @trace ERB-UT-023
 * @precondition 値記述だけを使用する。
 * @stimulus 公開契約を取得する。
 * @observation 返却fieldと固定値。
 * @oracle 非共有と一回消費が変わらない。
 * @cleanup N/A: 値だけ。
 * @boundary Packet契約の記述。
 */
test("助言Packetの非共有契約を維持する", () => {
  assert.deepEqual(describeProviderAdvicePacketContract(), {
    contract: "crdd-executor/advice-input",
    contractRevision: 2,
    singleUse: true,
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
    providerEffectIssuedByPacket: false,
  });
});
