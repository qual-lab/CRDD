/**
 * coordinator:system:dynamic-fake-provider-cancellation-verificationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:dynamic-fake-provider-cancellation-verificationが所有する検証責務を実行する。
 * @trace PRL-ST-003
 * @level ST
 * @scope dynamic、fake、provider、cancellation、verification
 * @boundary PRL-ST-003の部分根拠: 固定planner構成と入口形だけを確認し、実Runtimeは未検証。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { runDynamicFakeProviderCancellationVerification } from "../../src/diagnostics/isolation-probe.ts";
import { verifyDynamicFakeProviderCancellation } from "../../scripts/verify-dynamic-fake-provider-cancellation.ts";
import { planDockerProbeCreation } from "../../../docker-isolation/src/index.ts";

const MOUNTS = Object.freeze({
  workspace: "C:\\crdd\\workspace",
  providerHome: "C:\\crdd\\provider-home",
  tmp: "C:\\crdd\\tmp",
  events: "C:\\crdd\\events",
  projection: "C:\\crdd\\projection",
  management: "C:\\crdd\\management",
});

/**
 * 取消verificationは固定image・network none・固定SIGTERM handlerだけを構成するを検証する。
 *
 * @responsibility 取消verificationは固定image・network none・固定SIGTERM handlerだけを構成するの合否判定を所有する。
 * @trace PRL-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消verificationは固定image・network none・固定SIGTERM handlerだけを構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-003=Direct Boundary: DI root plannerの純粋構成確認。System/E2E成立は主張しない。
 */
test("取消verificationは固定image・network none・固定SIGTERM handlerだけを構成する", () => {
  const args = planDockerProbeCreation("cancellation", "fixture", {
    workspace: MOUNTS.workspace,
    providerHome: MOUNTS.providerHome,
    tmp: MOUNTS.tmp,
  });
  assert.equal(args.includes("--pull=never"), true);
  assert.equal(args.includes("--network=none"), true);
  assert.equal(args.includes("--read-only"), true);
  assert.equal(args.includes("--cap-drop=ALL"), true);
  assert.equal(args.includes("--security-opt=no-new-privileges"), true);
  assert.equal(args.includes("python"), true);
  const source = args.at(-1) ?? "";
  assert.match(source, /SIGTERM/u);
  assert.match(source, /crdd-coordinator-cancellation-v1/u);
  assert.equal(
    source.indexOf("signal.signal") < source.lastIndexOf("print(json.dumps"),
    true,
  );
  assert.equal(runDynamicFakeProviderCancellationVerification.length, 1);
  assert.equal(verifyDynamicFakeProviderCancellation.length, 0);
});
