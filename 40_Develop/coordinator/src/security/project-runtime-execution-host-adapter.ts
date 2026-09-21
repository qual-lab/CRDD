/**
 * project-runtime-execution-host-adapterに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeExecutionHostAdapterOptionsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import type {
  ProjectRuntimeClockIdentityPort,
  ProjectRuntimeProcessSafetyPort,
} from "../../../project-runtime/src/index.ts";
import {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";

/**
 * project-runtime-execution-host-adapterで使用するProject Runtime Execution Host Adapter Optionsの値契約を定義する。
 *
 * @responsibility Project Runtime Execution Host Adapter OptionsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeExecutionHostAdapterOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeExecutionHostAdapterOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeExecutionHostAdapterOptionsの宣言は外部境界を開かない。
 * @security ProjectRuntimeExecutionHostAdapterOptionsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProjectRuntimeExecutionHostAdapterOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeExecutionHostAdapterOptions = Readonly<{
  now?: ProjectRuntimeClockIdentityPort["now"];
  poisonAfterCleanupUnknown?: ProjectRuntimeProcessSafetyPort["poisonAfterCleanupUnknown"];
}>;

/**
 * Build the Host-owned capabilities required by Project Runtime execution.
 *
 * @responsibility Project Runtime Execution Host Portsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input options: ProjectRuntimeExecutionHostAdapterOptions
 * @returns createProjectRuntimeExecutionHostPortsの計算結果を返す。
 * @precondition 「options: ProjectRuntimeExecutionHostAdapterOptions」がcreateProjectRuntimeExecutionHostPortsの入力契約を満たす。
 * @postcondition createProjectRuntimeExecutionHostPortsの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeExecutionHostPortsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimeExecutionHostPortsは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimeExecutionHostPortsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createProjectRuntimeExecutionHostPortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeExecutionHostPortsは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeExecutionHostPorts(
  options: ProjectRuntimeExecutionHostAdapterOptions = {},
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
    }) satisfies ProjectRuntimeClockIdentityPort,
    processSafety: Object.freeze({
      getProcessInstanceIdentity: getRuntimeProcessInstanceIdentity,
      createRecoveryIdentity: createRuntimeProcessRecoveryIdentity,
      inspectRecoveryIdentity: inspectRuntimeProcessRecoveryIdentity,
      poisonAfterCleanupUnknown:
        options.poisonAfterCleanupUnknown ??
        poisonRuntimeProcessAfterCleanupUnknown,
    }) satisfies ProjectRuntimeProcessSafetyPort,
  });
}
