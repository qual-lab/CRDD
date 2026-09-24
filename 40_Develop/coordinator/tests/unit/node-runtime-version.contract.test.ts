/**
 * coordinator:unit:node-runtime-versionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:node-runtime-versionが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope node、runtime、version
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSupportedCoordinatorNodeRuntime,
  describeCoordinatorNodeRuntimeVersionContract,
  isSupportedCoordinatorNodeRuntime,
} from "../../src/core/node-runtime-version.ts";

/**
 * Node 24.12.0以上だけをCoordinator保守Runtime候補にするを検証する。
 *
 * @responsibility Node 24.12.0以上だけをCoordinator保守Runtime候補にするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Node 24.12.0以上だけをCoordinator保守Runtime候補にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Node 24.12.0以上だけをCoordinator保守Runtime候補にする", () => {
  for (const value of ["24.12.0", "24.19.0", "25.0.0"]) {
    assert.equal(isSupportedCoordinatorNodeRuntime(value), true);
    assert.doesNotThrow(() => assertSupportedCoordinatorNodeRuntime(value));
  }
  for (const value of [
    "24.11.9",
    "23.99.99",
    "v24.12.0",
    "24.12",
    "24.12.0-pre",
    "01.2.3",
    null,
    Object.freeze({}),
  ]) {
    assert.equal(isSupportedCoordinatorNodeRuntime(value), false);
    assert.throws(
      () => assertSupportedCoordinatorNodeRuntime(value),
      /coordinator_node_version_unsupported/u,
    );
  }
});

/**
 * Node version境界はEffect前Fail ClosedとPATH非Authorityを公開するを検証する。
 *
 * @responsibility Node version境界はEffect前Fail ClosedとPATH非Authorityを公開するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Node version境界はEffect前Fail ClosedとPATH非Authorityを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("Node version境界はEffect前Fail ClosedとPATH非Authorityを公開する", () => {
  const contract = describeCoordinatorNodeRuntimeVersionContract();
  assert.equal(contract.minimumVersion, "24.12.0");
  assert.match(contract.checkTiming, /before_interactive_input/u);
  assert.equal(contract.pathLookupAuthority, false);
  assert.equal(contract.unsupportedRuntimeFallbackAllowed, false);
});
