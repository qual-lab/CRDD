/**
 * 上位実行の時刻・識別子とCoordinatorのProcess安全操作を接続する。
 *
 * @responsibility OrchestratorExecutionHostAdapterOptionsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { OrchestratorClockIdentityPort } from "../identity/clock-and-hash.ts";
import type { OrchestratorProcessSafetyPort } from "../process/safety-contract.ts";
import {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../../../coordinator/src/index.ts";

/**
 * orchestrator-execution-host-adapterで使用するOrchestrator Execution Host Adapter Optionsの値契約を定義する。
 *
 * @responsibility Orchestrator Execution Host Adapter OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorExecutionHostAdapterOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionHostAdapterOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionHostAdapterOptionsの宣言は外部境界を開かない。
 * @security OrchestratorExecutionHostAdapterOptionsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OrchestratorExecutionHostAdapterOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionHostAdapterOptions = Readonly<{
  now?: OrchestratorClockIdentityPort["now"];
  poisonAfterCleanupUnknown?: OrchestratorProcessSafetyPort["poisonAfterCleanupUnknown"];
}>;

/**
 * Build the Host-owned capabilities required by Orchestrator execution.
 *
 * @responsibility Orchestrator Execution Host Portsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input options: OrchestratorExecutionHostAdapterOptions
 * @returns createOrchestratorExecutionHostPortsの計算結果を返す。
 * @precondition 「options: OrchestratorExecutionHostAdapterOptions」がcreateOrchestratorExecutionHostPortsの入力契約を満たす。
 * @postcondition createOrchestratorExecutionHostPortsの責務を完了した結果だけを返す。
 * @effect N/A: createOrchestratorExecutionHostPortsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOrchestratorExecutionHostPortsは独自の失敗分岐を所有しない。
 * @invariant createOrchestratorExecutionHostPortsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createOrchestratorExecutionHostPortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createOrchestratorExecutionHostPortsは共有非同期状態を持たない同期処理である。
 */
export function createOrchestratorExecutionHostPorts(
  options: OrchestratorExecutionHostAdapterOptions = {},
) {
  return Object.freeze({
    clockIdentity: Object.freeze({
      now:
        options.now ??
        (() =>
          Object.freeze({
            monotonicMs: performance.now(),
            iso: new Date().toISOString(),
          })),
      createStableId: (prefix: string, parts: readonly string[]) =>
        `${prefix}-${createHash("sha256")
          .update(parts.join("\0"))
          .digest("hex")
          .slice(0, 40)}`,
      createContentHash: (content: string) =>
        createHash("sha256").update(content).digest("hex"),
    }) satisfies OrchestratorClockIdentityPort,
    processSafety: Object.freeze({
      getProcessInstanceIdentity: getRuntimeProcessInstanceIdentity,
      createRecoveryIdentity: createRuntimeProcessRecoveryIdentity,
      inspectRecoveryIdentity: inspectRuntimeProcessRecoveryIdentity,
      poisonAfterCleanupUnknown:
        options.poisonAfterCleanupUnknown ??
        poisonRuntimeProcessAfterCleanupUnknown,
    }) satisfies OrchestratorProcessSafetyPort,
  });
}
