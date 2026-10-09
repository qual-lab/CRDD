/**
 * 現在認可されたRepositoryからRuntime活動を読む。
 *
 * @responsibility Project選択と観測結果検査をTransportから分離する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 */
import type { CrosRepository } from "../access/session-context.ts";
import type { CrosRuntimeActivityReader } from "./types.ts";
import { parseCrosRuntimeActivityObservation } from "./validate.ts";

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
 * @postcondition Readerは同じProjectの許可Repositoryだけを受け取る。
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
  const observation = parseCrosRuntimeActivityObservation(
    await reader.read({ ...query, repositories: selected }),
  );
  if (observation === null)
    throw new Error("cros_runtime_activity_observation_invalid");
  return observation;
}
