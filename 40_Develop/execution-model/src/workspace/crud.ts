/**
 * Workspaceと統合結果の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import type { Repository } from "../../../version-control/src/index.ts";
import { withSnapshotOperation } from "../state/crud.ts";

import {
  prepareIntegrationRecordCreation,
  prepareWorkspaceRecordUpdate,
} from "./validation.ts";

/**
 * 同じ成果Identityの統合記録を作成する。
 * @responsibility 同内容の再送は無書込みとし、異内容の同IDとQueue結合差を拒否する。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。対象結合と統合記録。
 * @returns 既存の保存結果又は解放確認付き停止。
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @postcondition 対象外区画と元のCAS・Hash・unknownを保つ。
 * @effect 読取りと必要な場合だけ既存Writerで保存する。
 * @failure 候補不正・競合・保存又は解放不明は停止する。
 * @invariant 任意Snapshot callback・生Ownerを受付又は返却しない。
 * @boundary 固定用途と唯一の保存Owner。
 * @security 保存成功を実行Authorityや資源回収と扱わない。
 * @concurrency fresh読取りから確定まで一つの短期Ownerを使用する。
 */
export function saveIntegrationRecord(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof prepareIntegrationRecordCreation> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withSnapshotOperation<
    Extract<
      ReturnType<typeof prepareIntegrationRecordCreation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareIntegrationRecordCreation(current, ...input),
  );
}

/**
 * 同じ操作LeaseのWorkspace記録を比較更新する。
 * @responsibility 対象世代・Queue・Leaseを照合し、削除時だけ元の時計二回を使う。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory、binding: 検証対象と既存結合。Project、Queue、Owner世代、Workspace、元世代と次記録。
 * @returns 既存の保存結果又は解放確認付き停止。
 * @precondition 呼出し側が現在の操作認可を確認している。
 * @postcondition 対象外区画と元のCAS・Hash・unknownを保つ。
 * @effect 読取りと必要な場合だけ既存Writerで保存する。
 * @failure 候補不正・競合・保存又は解放不明は停止する。
 * @invariant 任意Snapshot callback・生Ownerを受付又は返却しない。
 * @boundary 固定用途と唯一の保存Owner。
 * @security 保存成功を実行Authorityや資源回収と扱わない。
 * @concurrency fresh読取りから確定まで一つの短期Ownerを使用する。
 */
export function saveWorkspaceRecord(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof prepareWorkspaceRecordUpdate> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withSnapshotOperation<
    Extract<
      ReturnType<typeof prepareWorkspaceRecordUpdate>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareWorkspaceRecordUpdate(current, ...input),
  );
}
