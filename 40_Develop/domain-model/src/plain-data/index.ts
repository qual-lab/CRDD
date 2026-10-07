/**
 * Record／Arrayの共通入力防御だけを公開する。
 *
 * @packageDocumentation
 * @responsibility 浅い所有Snapshot化を公開し、保存・Authority・Provider実行を読み込まない。
 * @trace ARCH-000014
 * @boundary Provider計画とCoordinatorが共有する非Effectの入力検査境界。
 */
export {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
