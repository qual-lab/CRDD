/**
 * 現在認可されたRepositoryからRuntime活動を読む。
 *
 * @responsibility Project選択と観測結果検査をTransportから分離する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 */
import type { CrosRepository } from "../access/session-context.ts";
import {
  parseRuntimeActivityObservation,
  type RuntimeActivityObservation,
} from "../../../orchestrator/src/index.ts";

/**
 * 旧CROS認可集合を受ける読取り専用接続契約。
 * @responsibility 旧Transportが活動Ownerの結果契約を再定義しない接続を固定する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @shape readはProject、許可Repositoryとページを受ける。
 * @invariant 認可外Repositoryを渡さず、結果はOrchestrator契約を使用する。
 * @boundary 旧CROS認可と活動読取りの接続。
 * @security Credential・秘密値をReaderへ渡さない。
 * @compatibility 旧Transport撤去までの接続であり同型DTOを持たない。
 */
export type CrosRuntimeActivityReader = Readonly<{
  read(input: {
    projectId: string;
    repositories: readonly CrosRepository[];
    cursor?: string;
    limit: number;
  }): Promise<RuntimeActivityObservation>;
}>;

/**
 * 許可集合に含まれるProjectの活動を一回観測する。
 *
 * @responsibility 非許可ProjectをReaderへ渡さず、観測結果の閉じた契約を保持する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @input repositoriesは現在Requestの許可集合、queryはProjectとページ、readerは観測Owner。
 * @returns 検査済み観測、対象が許可集合にない場合だけnull。
 * @precondition repositoriesは現在Credentialと同じExposure Snapshotから解決済み。
 * @postcondition Readerは同じProjectの許可Repositoryだけを受け取り、返却Sourceは重複なしでその集合とexact一致する。
 * @effect Readerを最大一回呼び、完了まで待つ。正本へ書き込まない。
 * @failure Reader不在・例外・結果不正は例外。非許可と不在は同じnull。
 * @invariant 管理権限からContentを生成せず、unknownを空成功にしない。
 * @boundary CROS認可集合とRepository Runtime観測の境界。
 * @security 非許可Identityと生Provider情報を結果へ追加しない。
 * @concurrency 開始したReaderをjoinし、取消を理由に待機だけを放棄しない。
 */
export async function readCrosRuntimeActivity(
  repositories: readonly CrosRepository[],
  query: Readonly<{ projectId: string; cursor?: string; limit: number }>,
  reader: CrosRuntimeActivityReader | undefined,
) {
  const selected = repositories.filter(
    (repository) => repository.projectId === query.projectId,
  );
  if (selected.length === 0) return null;
  if (reader === undefined)
    throw new Error("cros_runtime_activity_reader_unavailable");
  const observation = parseRuntimeActivityObservation(
    await reader.read({ ...query, repositories: selected }),
  );
  if (observation === null || observation.projectId !== query.projectId)
    throw new Error("cros_runtime_activity_observation_invalid");
  const selectedIds = new Set(
    selected.map((repository) => repository.repositoryId),
  );
  if (
    selectedIds.size !== selected.length ||
    observation.sources.length !== selectedIds.size ||
    observation.sources.some((source) => !selectedIds.has(source.repositoryId))
  )
    throw new Error("cros_runtime_activity_observation_invalid");
  return observation;
}
