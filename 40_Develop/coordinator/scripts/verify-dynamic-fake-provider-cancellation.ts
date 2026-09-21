/**
 * verify-dynamic-fake-provider-cancellationに属する責務をまとめる。
 *
 * @responsibility verifyDynamicFakeProviderCancellationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runDynamicFakeProviderCancellationVerification } from "../src/security/docker-isolation.ts";
import { createOwnedOperationDirectories } from "../src/security/execution-environment.ts";

/**
 * Dynamic Fake Provider Cancellationを検証する。
 *
 * @responsibility Dynamic Fake Provider Cancellationの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns verifyDynamicFakeProviderCancellationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がverifyDynamicFakeProviderCancellationの入力契約を満たす。
 * @postcondition verifyDynamicFakeProviderCancellationの責務を完了した結果だけを返す。
 * @effect verifyDynamicFakeProviderCancellationはFilesystemの読取りまたは書込みを実行する。
 * @failure verifyDynamicFakeProviderCancellationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyDynamicFakeProviderCancellationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifyDynamicFakeProviderCancellationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency verifyDynamicFakeProviderCancellationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function verifyDynamicFakeProviderCancellation() {
  const owned = createOwnedOperationDirectories();
  const result = await runDynamicFakeProviderCancellationVerification(owned);
  const isRootRemoved = !fs.existsSync(owned.root);
  if (
    result.status !== "verified" ||
    result.reason !== "dynamic_fake_provider_cancellation_verified" ||
    result.cancellationRequested !== true ||
    result.cancellationSignalRequested !== "SIGTERM" ||
    result.readyObserved !== true ||
    result.cancellationAcknowledged !== true ||
    result.processTerminationObserved !== true ||
    result.attachProcessTerminationObserved !== true ||
    result.attachProcessTerminationRequestCount !== 0 ||
    result.containerAbsenceVerified !== true ||
    result.hostCleanupVerified !== true ||
    result.cleanup !== "confirmed" ||
    result.retainOperationDirectories !== false ||
    result.recoveryId !== null ||
    result.manualRecoveryRequired !== false ||
    result.diagnosticDockerContainerEffectIssued !== true ||
    result.diagnosticFilesystemEffectIssued !== true ||
    result.providerNetworkEffectIssued !== false ||
    result.runtimeAuthorityIssued !== false ||
    result.operationCapabilityIssued !== false ||
    result.realProviderReadiness !== false ||
    !isRootRemoved
  )
    throw new Error("dynamic Fake Provider cancellation verification failed");
  return Object.freeze({
    contract:
      "crdd-coordinator/dynamic-fake-provider-cancellation-verification",
    contractRevision: 1,
    status: result.status,
    reason: result.reason,
    cancellationSignalRequested: result.cancellationSignalRequested,
    readyObserved: result.readyObserved,
    cancellationAcknowledged: result.cancellationAcknowledged,
    processTerminationObserved: result.processTerminationObserved,
    attachProcessTerminationObserved: result.attachProcessTerminationObserved,
    attachProcessTerminationRequestCount:
      result.attachProcessTerminationRequestCount,
    containerAbsenceVerified: result.containerAbsenceVerified,
    hostCleanupVerified: result.hostCleanupVerified,
    cleanup: result.cleanup,
    graceElapsedMs: result.graceElapsedMs,
    stdoutBytes: result.stdoutBytes,
    stderrBytes: result.stderrBytes,
    exitCode: result.exitCode,
    diagnosticDockerContainerEffectIssued:
      result.diagnosticDockerContainerEffectIssued,
    diagnosticFilesystemEffectIssued: result.diagnosticFilesystemEffectIssued,
    providerNetworkEffectIssued: result.providerNetworkEffectIssued,
    runtimeAuthorityIssued: result.runtimeAuthorityIssued,
    operationCapabilityIssued: result.operationCapabilityIssued,
    realProviderReadiness: result.realProviderReadiness,
    residualOperationDirectory: !isRootRemoved,
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    `${JSON.stringify(await verifyDynamicFakeProviderCancellation())}\n`,
  );
}
