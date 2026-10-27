/** Runtime状態保存だけの既存OS排他を所有する。
 * @responsibility 保存専用namespaceと既存OS primitiveを接続する。
 * @trace ARCH-000008
 */
import { createHash } from "node:crypto";
import { acquireNamedPipeKernelLock } from "../../../platform-access/src/index.ts";

/**
 * Coordinatorの現在状態更新用に、既存OS排他の専用名前空間を取得する。
 * @responsibility Repositoryごとの短期Writerを、Project・Home・Dockerの既存排他から分離する。
 * @trace ARCH-000008
 * @input repositoryRootHash: 現在検証したRepository Rootへ結合する64桁Hash。
 * @returns 保持観測・解放handle、または取得不能のnull。
 * @precondition Rootと操作Ownerの実体確認は保存Ownerが行う。
 * @postcondition 他の既存排他の名前空間を変更せず、新しいLock Frameworkを作らない。
 * @effect 既存Workerを起動し、Windows Named Pipeを排他的に保持する。
 * @failure 非Windows、不正Hash、競合、取得観測失敗ではhandleを返さない。
 * @invariant state.lockの存在やHashだけを実効排他の証明にしない。
 * @boundary Coordinator保存Ownerから既存Windows OS排他primitiveへの境界。
 * @security Lockは保存・削除・Provider操作のAuthorityを発行しない。
 * @concurrency 同じRootの同時取得を拒否し、Writerが保持・解放確認を所有する。
 */
export function acquireRuntimeOwnedCoordinatorStateKernelLock(
  repositoryRootHash: unknown,
) {
  if (
    process.platform !== "win32" ||
    typeof repositoryRootHash !== "string" ||
    !/^[0-9a-f]{64}$/u.test(repositoryRootHash)
  )
    return null;
  const identity = createHash("sha256")
    .update("crdd-coordinator-state-kernel-lock-v1\0")
    .update(repositoryRootHash)
    .digest("hex")
    .slice(0, 32);
  return acquireNamedPipeKernelLock(
    `\\\\.\\pipe\\CRDD.Coordinator.CurrentState.${identity}`,
  );
}
