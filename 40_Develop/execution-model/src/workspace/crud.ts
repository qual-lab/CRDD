/**
 * Workspaceと統合結果の完成した保存・読取り操作を提供する。
 * @responsibility 共通保存処理へ接続し、既存の排他・改訂検査・通知順序を維持する。
 * @trace ARCH-000008
 */

import type { Repository } from "../../../version-control/src/index.ts";
import {
  readRuntimeContent,
  withCoordinatorSnapshotOperation,
} from "../state/crud.ts";
import type { CoordinatorSnapshot, RuntimeAccess } from "../state/types.ts";
import type { StoreResult } from "../storage/lock.ts";
import { blocked, completed } from "../storage/lock.ts";
import { readCoordinatorSnapshot } from "../storage/store.ts";
import {
  prepareCoordinatorIntegrationRecordCreation,
  prepareCoordinatorWorkspaceRecordUpdate,
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
export function saveCoordinatorIntegrationRecord(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<
    typeof prepareCoordinatorIntegrationRecordCreation
  > extends [unknown, ...infer Rest]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorIntegrationRecordCreation>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorIntegrationRecordCreation(current, ...input),
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
export function saveCoordinatorWorkspaceRecord(
  workingDirectory: Repository,
  binding: string,
  ...input: Parameters<typeof prepareCoordinatorWorkspaceRecordUpdate> extends [
    unknown,
    ...infer Rest,
  ]
    ? Rest
    : never
) {
  return withCoordinatorSnapshotOperation<
    Extract<
      ReturnType<typeof prepareCoordinatorWorkspaceRecordUpdate>,
      { status: "completed" }
    >["value"]["value"]
  >(workingDirectory, binding, (current) =>
    prepareCoordinatorWorkspaceRecordUpdate(current, ...input),
  );
}

/**
 * Workspace操作に必要な保存区画だけを読む。
 * @responsibility 全Snapshotや保存Ownerを外へ渡さず用途固定の観測を返す。
 * @trace ARCH-000008
 * @input workingDirectory、binding: 現在Repositoryと期待結合。
 * @returns 選択区画、明示不存在又は元の停止結果。
 * @precondition Hostが同じRepositoryの操作認可を確認する。
 * @postcondition I/O・改訂・解放確認の既存条件を保つ。
 * @effect 単一Readerと短期排他の読取りだけ。
 * @failure 不正Root・不一致・観測不能・解放不明を元の理由で拒否する。
 * @invariant 状態変更・実行・回復Authorityを生成しない。
 * @boundary Domain保存と用途別Consumer。
 * @security 任意投影callbackを受けず、技術区画を一括返却しない。
 * @concurrency 元の短期排他を一回取得・解放する。
 */
export function readCoordinatorWorkspaceState(
  workingDirectory: Repository,
  binding: string,
): StoreResult<Pick<
  CoordinatorSnapshot,
  "projects" | "queueEntries" | "results" | "workspaces" | "snapshotRevision"
> | null> {
  if (typeof workingDirectory !== "object" || workingDirectory === null)
    return blocked("orchestrator_repository_root_invalid");
  const result = readCoordinatorSnapshot(workingDirectory, binding);
  if (result.status !== "completed") return result;
  return completed(
    result.reason,
    result.value === null
      ? null
      : {
          projects: result.value.projects,
          queueEntries: result.value.queueEntries,
          results: result.value.results,
          workspaces: result.value.workspaces,
          snapshotRevision: result.value.snapshotRevision,
        },
  );
}

/**
 * 対象に結合したWorkspaceを照会する。
 * @responsibility workspacesの有限投影だけを返す。
 * @trace ARCH-000008
 * @input access、request: Host認可と対象ID。
 * @returns 値・不存在・拒否・観測不能。
 * @precondition 既存内容権限を使用する。
 * @postcondition 値を実行又は回復Authorityにしない。
 * @effect 共通Readerの有限照会だけ。
 * @failure 現在認可・保存・排他の不明を隠さない。
 * @invariant AI・Git・Docker・自動受付を起動しない。
 * @boundary 一般QueryとDomain保存。
 * @security Snapshot全体・Host Pathを返さない。
 * @concurrency 返却前に再認可する。
 */
export function queryWorkspaces(
  access: RuntimeAccess,
  request: Readonly<{ projectId: string; milestoneId: string }>,
) {
  return readRuntimeContent(access, "workspaces", request);
}
