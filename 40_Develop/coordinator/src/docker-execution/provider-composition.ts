/**
 * Docker準備の本番依存をCoordinator所有の操作へ結合する。
 *
 * @responsibility 両Providerで共通のMount、Packet、選定、時計とAuthority接続を一箇所で所有する。
 * @trace ARCH-000015
 */
import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { verifyOwnedOperationManagementMountBinding } from "../host-execution/operation-workspace-lifecycle.ts";
import { consumeRuntimeOwnedDelegationSelectionGrant } from "../provider/delegation-selection-grant.ts";
import {
  issueRuntimeOwnedProviderAuthority,
  revokeRuntimeOwnedProviderAuthority,
} from "../provider/authority-grant.ts";
import {
  activateRuntimeOwnedProviderHomeMount,
  borrowRuntimeOwnedActiveProviderHomeMountSource,
  completeRuntimeOwnedProviderHomeMount,
} from "../provider/home-mount-authorization.ts";
import { consumeRuntimeOwnedProviderTaskPacket } from "../provider/task-packet.ts";
import { consumeRuntimeOwnedWorkbenchAiAdvicePacket } from "../workbench-ai/advice-packet.ts";
import type {
  ProviderDockerPreparedPlan,
  ProviderDockerRuntimeDependencies,
} from "./types.ts";

/**
 * 一つのProvider準備Ownerの独立した状態を構築する。
 *
 * @responsibility 候補と管理参照の二StoreをOwnerごとに一度生成する。
 * @trace ARCH-000015
 * @input dependencies: 固定Providerの準備依存。Storeは入力に含めない。
 * @returns 具体Provider型を保持した凍結済み状態。
 * @precondition dependenciesは本番固定組立てまたは用途限定の局所試験から渡す。
 * @postcondition 呼出しごとに独立した二WeakMapを保持する。
 * @effect Process内の二WeakMapを生成する。資源取得やAuthority発行は実行しない。
 * @failure N/A: 入力を動的な外部接続先として解決しない。
 * @invariant Storeの合成・複製・Provider間共有を行わない。
 * @boundary 共通準備状態と固定Providerの呼出し側の間。
 * @security 候補・管理参照を外部へ公開または永続化しない。
 * @concurrency 準備・取消・消費は既存の同期Store操作で直列化する。
 */
export function createProviderDockerRuntimeState<P extends "codex" | "claude">(
  dependencies: ProviderDockerRuntimeDependencies<P>,
) {
  return Object.freeze({
    prepared: new WeakMap<object, ProviderDockerPreparedPlan<P>>(),
    managementCapabilities: new WeakMap<object, object>(),
    ...dependencies,
  });
}

/**
 * 固定二Providerの本番準備依存を取得する。
 *
 * @responsibility 共通の本番操作を同じ関数参照で提供し、準備Storeとは分離する。
 * @trace ARCH-000015
 * @input N/A: 外部入力または接続先指定を受け取らない。
 * @returns 凍結した本番依存の組。
 * @precondition Coordinatorの同じ改訂版から呼ぶ。
 * @postcondition Mount、Packet、選定、Authorityと二時計を既存Ownerへ接続する。
 * @effect N/A: 関数参照の組立てだけを行い、取得・消費・発行を実行しない。
 * @failure N/A: 動的な解決やfallbackを行わない。
 * @invariant ProviderごとのStoreと管理対応を共有・生成しない。
 * @boundary Coordinator内の共通組立てと既存資源Ownerの間。
 * @security Capability、秘密値または任意の接続先を公開しない。
 * @concurrency N/A: 同期組立てであり可変状態を追加しない。
 */
export function createProviderDockerRuntimeDependencies() {
  return Object.freeze({
    verifyOperationMount: verifyOwnedOperationManagementMountBinding,
    activateMount: activateRuntimeOwnedProviderHomeMount,
    borrowMountSource: borrowRuntimeOwnedActiveProviderHomeMountSource,
    completeMount: completeRuntimeOwnedProviderHomeMount,
    wallNow: Date.now,
    monotonicNow: performance.now.bind(performance),
    randomBytes,
    consumeModelSelection: consumeRuntimeOwnedDelegationSelectionGrant,
    consumeTaskPacket: consumeRuntimeOwnedProviderTaskPacket,
    consumeAdvicePacket: consumeRuntimeOwnedWorkbenchAiAdvicePacket,
    issueProviderAuthority: issueRuntimeOwnedProviderAuthority,
    revokeProviderAuthority: revokeRuntimeOwnedProviderAuthority,
  });
}
