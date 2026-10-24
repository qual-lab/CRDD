/**
 * 単発依頼の閉入力を検証する。
 * @packageDocumentation
 * @responsibility 暗黙Context、越境Path、旧Bundle入力とgetterを実行前に拒否する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 値検査のみ。
 * @boundary Surface入力と単発Owner。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectSingleTaskCommand } from "../../../src/task/requests.ts";

/**
 * 固定ContextとmodeごとのPath条件を照合する。
 * @responsibility 作業指示のPathを技術的ACLや任意Root許可にしない。
 * @trace PRL-UT-006
 * @precondition 合成の非秘密入力だけを使う。
 * @stimulus mode、対象、同意、余剰field、getterとProxyを変更する。
 * @observation 閉じたSnapshot又はnullとgetter呼出し0。
 * @oracle 明示した入力だけ受理し旧change_candidateを拒否する。
 * @cleanup Process内値だけ。
 * @boundary 公開要求値の固定。
 */
test("単発入力はROとWorkspaceを分け越境・旧Bundle・余剰値を拒否する", () => {
  const command = {
    mode: "read_only_advice",
    workType: null,
    prompt: "合成入力",
    contextReferences: ["PROJECT_CONTEXT.md"],
    allowedPaths: [],
    externalSendConfirmed: true,
    expectedNetworkPolicyHash: "a".repeat(64),
    workspaceId: null,
  };
  assert.ok(inspectSingleTaskCommand(command));
  assert.ok(
    inspectSingleTaskCommand({
      ...command,
      mode: "workspace_edit",
      allowedPaths: ["src/file.ts"],
    }),
  );
  for (const invalid of [
    { ...command, mode: "change_candidate" },
    { ...command, externalSendConfirmed: false },
    { ...command, expectedNetworkPolicyHash: undefined },
    { ...command, expectedNetworkPolicyHash: "wrong" },
    { ...command, contextReferences: ["secret.txt"] },
    { ...command, allowedPaths: ["src"] },
    { ...command, mode: "workspace_edit" },
    { ...command, mode: "workspace_edit", allowedPaths: ["../other"] },
    { ...command, mode: "workspace_edit", allowedPaths: ["C:/other"] },
    { ...command, mode: "workspace_edit", allowedPaths: ["src", "src"] },
    { ...command, workspaceId: "wrong" },
    { ...command, candidateId: "old" },
    { ...command, profileId: "PROFILE-100001" },
    { ...command, choice: { provider: "codex" } },
    new Proxy(command, {}),
  ])
    assert.equal(inspectSingleTaskCommand(invalid), null);
  let reads = 0;
  const getter = { ...command };
  Object.defineProperty(getter, "prompt", {
    enumerable: true,
    get: () => {
      reads++;
      return "not_read";
    },
  });
  assert.equal(inspectSingleTaskCommand(getter), null);
  assert.equal(reads, 0);
});
