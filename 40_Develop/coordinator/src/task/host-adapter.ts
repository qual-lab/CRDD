/**
 * 上位実行の時刻・識別子とCoordinatorのProcess安全操作を接続する。
 *
 * @responsibility CoordinatorExecutionHostAdapterOptionsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { CoordinatorClockIdentityPort } from "../identity/clock-and-hash.ts";
import type { CoordinatorProcessSafetyPort } from "../process/safety-contract.ts";
import {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../execution/process-safety-state.ts";

/**
 * execution-host-adapterで使用するCoordinator Execution Host Adapter Optionsの値契約を定義する。
 *
 * @responsibility Coordinator Execution Host Adapter OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorExecutionHostAdapterOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionHostAdapterOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorExecutionHostAdapterOptionsの宣言は外部境界を開かない。
 * @security CoordinatorExecutionHostAdapterOptionsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorExecutionHostAdapterOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionHostAdapterOptions = Readonly<{
  now?: CoordinatorClockIdentityPort["now"];
  poisonAfterCleanupUnknown?: CoordinatorProcessSafetyPort["poisonAfterCleanupUnknown"];
}>;

/**
 * Build the Host-owned capabilities required by Coordinator execution.
 *
 * @responsibility Coordinator Execution Host Portsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input options: CoordinatorExecutionHostAdapterOptions
 * @returns createCoordinatorExecutionHostPortsの計算結果を返す。
 * @precondition 「options: CoordinatorExecutionHostAdapterOptions」がcreateCoordinatorExecutionHostPortsの入力契約を満たす。
 * @postcondition createCoordinatorExecutionHostPortsの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorExecutionHostPortsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createCoordinatorExecutionHostPortsは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorExecutionHostPortsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createCoordinatorExecutionHostPortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCoordinatorExecutionHostPortsは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorExecutionHostPorts(
  options: CoordinatorExecutionHostAdapterOptions = {},
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
    }) satisfies CoordinatorClockIdentityPort,
    processSafety: Object.freeze({
      getProcessInstanceIdentity: getRuntimeProcessInstanceIdentity,
      createRecoveryIdentity: createRuntimeProcessRecoveryIdentity,
      inspectRecoveryIdentity: inspectRuntimeProcessRecoveryIdentity,
      poisonAfterCleanupUnknown:
        options.poisonAfterCleanupUnknown ??
        poisonRuntimeProcessAfterCleanupUnknown,
    }) satisfies CoordinatorProcessSafetyPort,
  });
}
