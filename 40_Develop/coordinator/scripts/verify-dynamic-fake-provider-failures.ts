/**
 * verify-dynamic-fake-provider-failuresに属する責務をまとめる。
 *
 * @responsibility verifyDynamicFakeProviderFailuresを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS,
  expectedDynamicFakeProviderFailureReason,
  runDynamicFakeProviderFailureScenario,
} from "../src/security/docker-isolation.ts";
import { createOwnedOperationDirectories } from "../src/security/execution-environment.ts";

/**
 * Dynamic Fake Provider Failuresを検証する。
 *
 * @responsibility Dynamic Fake Provider Failuresの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns verifyDynamicFakeProviderFailuresの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がverifyDynamicFakeProviderFailuresの入力契約を満たす。
 * @postcondition verifyDynamicFakeProviderFailuresの責務を完了した結果だけを返す。
 * @effect verifyDynamicFakeProviderFailuresはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyDynamicFakeProviderFailuresは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyDynamicFakeProviderFailuresは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifyDynamicFakeProviderFailuresはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyDynamicFakeProviderFailuresは共有非同期状態を持たない同期処理である。
 */
export function verifyDynamicFakeProviderFailures() {
  const results = DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS.map((scenario) => {
    const owned = createOwnedOperationDirectories();
    const result = runDynamicFakeProviderFailureScenario(owned, scenario);
    const expectedReason = expectedDynamicFakeProviderFailureReason(scenario);
    const isRootRemoved = !fs.existsSync(owned.root);
    const isPassed =
      result.status === "blocked" &&
      result.reason === expectedReason &&
      result.hostCleanupCompleted === true &&
      result.retainOperationDirectories === false &&
      result.recoveryId === null &&
      result.manualRecoveryRequired === false &&
      result.cleanup === "confirmed" &&
      result.fakeProviderLifecycle.status === "blocked" &&
      result.fakeProviderLifecycle.diagnosticDockerContainerEffectIssued ===
        true &&
      result.fakeProviderLifecycle.diagnosticFilesystemEffectIssued === true &&
      result.fakeProviderLifecycle.providerNetworkEffectIssued === false &&
      result.fakeProviderLifecycle.runtimeAuthorityIssued === false &&
      result.fakeProviderLifecycle.operationCapabilityIssued === false &&
      result.fakeProviderLifecycle.realProviderReadiness === false &&
      isRootRemoved;
    if (!isPassed)
      throw new Error(`dynamic failure scenario failed: ${scenario}`);
    return Object.freeze({
      scenario,
      status: result.status,
      reason: result.reason,
      cleanup: result.cleanup,
      containerEffectIssued:
        result.fakeProviderLifecycle.diagnosticDockerContainerEffectIssued,
      filesystemEffectIssued:
        result.fakeProviderLifecycle.diagnosticFilesystemEffectIssued,
      providerNetworkEffectIssued:
        result.fakeProviderLifecycle.providerNetworkEffectIssued,
      runtimeAuthorityIssued:
        result.fakeProviderLifecycle.runtimeAuthorityIssued,
      operationCapabilityIssued:
        result.fakeProviderLifecycle.operationCapabilityIssued,
      realProviderReadiness: result.fakeProviderLifecycle.realProviderReadiness,
      residualOperationDirectory: !isRootRemoved,
    });
  });
  return Object.freeze({
    contract: "crdd-coordinator/dynamic-fake-provider-failure-verification",
    contractRevision: 1,
    status: "verified",
    scenarios: Object.freeze(results),
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    `${JSON.stringify(verifyDynamicFakeProviderFailures())}\n`,
  );
}
