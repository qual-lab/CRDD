/**
 * verify-dynamic-fake-provider-failuresに属する責務をまとめる。
 *
 * @responsibility verifyDynamicFakeProviderFailuresを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createIsolationProbe } from "../../../../executor/src/lifecycle/probe.ts";

import { createOwnedOperationDirectories } from "../../../src/lifecycle/host.ts";
import { runDockerIsolationProbe } from "../../../src/lifecycle/environment.ts";
import {
  getRepositoryFromWorkingDirectory,
  resolveVerifiedRepositoryRoot,
} from "@qual-lab/crdd-version-control";

/**
 * 開発用の固定故障シナリオと期待する診断結果。
 * @trace ARCH-000004
 * @invariant CLIに任意の故障条件を追加せず、既存の実行順序と診断理由を保つ。
 */
export const DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS = Object.freeze([
  Object.freeze(["timeout", "docker_isolation_probe_timeout"] as const),
  Object.freeze([
    "output_limit",
    "docker_isolation_probe_output_too_large",
  ] as const),
  Object.freeze([
    "invalid_output",
    "docker_isolation_probe_invalid_output",
  ] as const),
  Object.freeze(["nonzero_exit", "docker_isolation_probe_failed"] as const),
]);

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
export async function verifyDynamicFakeProviderFailures() {
  const location = getRepositoryFromWorkingDirectory(process.cwd());
  if (location.status !== "completed")
    throw Error("repository_identity_unavailable");
  const repository = location.capability,
    root = resolveVerifiedRepositoryRoot(repository);
  if (!root) throw Error("repository_identity_unavailable");
  const results = [];
  for (const [
    scenario,
    expectedReason,
  ] of DYNAMIC_FAKE_PROVIDER_FAILURE_SCENARIOS) {
    const owned = createOwnedOperationDirectories({
      root: repository,
      purpose: "isolation_probe",
      recordingCurrent: () =>
        resolveVerifiedRepositoryRoot(repository) === root,
    });
    const result = await runDockerIsolationProbe(
      owned,
      undefined,
      (request, options) => createIsolationProbe(request, options, scenario),
    );
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
    results.push(
      Object.freeze({
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
        realProviderReadiness:
          result.fakeProviderLifecycle.realProviderReadiness,
        residualOperationDirectory: !isRootRemoved,
      }),
    );
  }
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
    `${JSON.stringify(await verifyDynamicFakeProviderFailures())}\n`,
  );
}
