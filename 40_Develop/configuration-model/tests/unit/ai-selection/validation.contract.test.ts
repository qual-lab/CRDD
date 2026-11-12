/**
 * 選定値の純粋検査と内容Hashの共有Ownerを検証する。
 * @packageDocumentation
 * @responsibility Coordinator非読込、閉形式拒否、入力独立性と既存Hash byteを反証する。
 * @trace RCM-UT-001
 * @level UT
 * @scope ai-selection/validationの明示選択と保存値Identity。
 * @boundary Domain Rootと同期値検査。外部AI・Docker・保存I/Oは使わない。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { inspectAiSelectionChoice } from "../../../src/index.ts";

/**
 * 実行機構なしで明示選択を検査できることを確認する。
 * @responsibility Coordinatorへの推移的な読込を子Processで拒否する。
 * @trace RCM-UT-001
 * @precondition Node標準のModule hookが利用可能。
 * @stimulus Coordinator importを拒否してDomain Rootから検査する。
 * @observation 子Process終了値と検査結果。
 * @oracle Coordinatorなしで同じ選択値を返す。
 * @cleanup 子Processは同期joinされ、試験Fileは作らない。
 * @boundary 子ProcessとDomain Root。
 */
test("選択値の検査はCoordinatorを読込み不能にしても成立する", () => {
  const root = new URL("../../../src/index.ts", import.meta.url).href;
  execFileSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import { registerHooks } from "node:module";
     import assert from "node:assert/strict";
     registerHooks({ resolve(specifier, context, next) {
       if (specifier.includes("coordinator/")) throw new Error("coordinator_unavailable");
       return next(specifier, context);
     }});
     const domain = await import(${JSON.stringify(root)});
     assert.deepEqual(domain.inspectAiSelectionChoice({provider:"codex",model:"example",effort:"medium"}),
       {provider:"codex",model:"example",effort:"medium"});`,
    ],
    { stdio: "pipe", timeout: 30_000 },
  );
});

/**
 * 未信頼値を実行せず閉じた選択値へ固定する。
 * @responsibility Getter・Proxy・過剰field拒否と入力独立性を検証する。
 * @trace RCM-UT-001
 * @precondition 合成の選択値だけを使用。
 * @stimulus 元値変更、不正field、Getter、Proxyを渡す。
 * @observation 独立Snapshot、拒否とhook呼出し数。
 * @oracle 正常値以外はnullでhook呼出し零。
 * @cleanup N/A: 同期値だけ。
 * @boundary 未信頼ObjectとDomain検査。
 */
test("明示選択は閉形式と不変Snapshotを維持する", () => {
  const choice = { provider: "claude", model: "example", effort: "medium" };
  const result = inspectAiSelectionChoice(choice);
  assert.deepEqual(result, choice);
  assert.ok(Object.isFrozen(result));
  choice.model = "changed";
  assert.equal(result?.model, "example");
  let effects = 0;
  const getter = { ...choice };
  Object.defineProperty(getter, "model", {
    enumerable: true,
    get() {
      effects++;
      return "example";
    },
  });
  const proxy = new Proxy(choice, {
    ownKeys() {
      effects++;
      return [];
    },
  });
  for (const value of [
    getter,
    proxy,
    { ...choice, authority: true },
    { ...choice, effort: "invalid" },
    { ...choice, provider: "other" },
    null,
  ])
    assert.equal(inspectAiSelectionChoice(value), null);
  assert.equal(effects, 0);
});
