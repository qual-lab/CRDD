/**
 * 登録済みRepositoryの内容公開範囲を明示更新する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { projectManagementOperationResult } from "../authorization/management.ts";
import type { ManagementOperationOutcome } from "../permission/types.ts";
import { executeRepositoryExposureMutation } from "./register.ts";
import type { RepositoryExposureManagementResult } from "./types.ts";

/**
 * 登録済みRepositoryの明示公開範囲を更新する。
 * @responsibility 空集合を含む明示範囲だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存Repository ID、workspaceIds。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function saveExposure(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  workspaceIds: unknown,
): RepositoryExposureManagementResult {
  return executeRepositoryExposureMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "updateExposure", repositoryId, workspaceIds },
  );
}

/**
 * 登録済みRepositoryの明示公開範囲を更新する。
 * @responsibility 空集合を含む明示範囲だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存Repository ID、workspaceIds。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function updateExposure(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  workspaceIds: unknown,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveExposure(
      root,
      token,
      expectedRevision,
      operationId,
      repositoryId,
      workspaceIds,
    ),
  );
}
