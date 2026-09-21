/**
 * coordinator:unit:project-runtime-decision-capability-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:project-runtime-decision-capability-adapterが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope project、runtime、decision、capability、adapter
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createProjectRuntimeDecisionCapabilityAdapter } from "../../src/security/project-runtime-decision-capability-adapter.ts";

/**
 * 判断Capability Adapterは秘密値とHashを別の値として発行するを検証する。
 *
 * @responsibility 判断Capability Adapterは秘密値とHashを別の値として発行するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 判断Capability Adapterは秘密値とHashを別の値として発行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("判断Capability Adapterは秘密値とHashを別の値として発行する", () => {
  const adapter = createProjectRuntimeDecisionCapabilityAdapter();
  const first = adapter.issue();
  const second = adapter.issue();
  assert.notEqual(first.secret, first.hash);
  assert.equal(adapter.hash(first.secret), first.hash);
  assert.notEqual(first.secret, second.secret);
  assert.notEqual(first.hash, second.hash);
});
