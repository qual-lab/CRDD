/**
 * Project ContextのSourceを読取り投影する。
 *
 * @packageDocumentation
 * @responsibility 不完全なSource状態を保持し、非開示情報を除いた投影を返す。
 * @trace ARCH-000005
 * @trace ARCH-000016
 * @boundary 正本Sourceと読取り投影の境界。
 * @effect N/A: 入力値だけを変換する。
 * @security 制限されたSourceやAuthorityを補完しない。
 */
import type {
  ProjectOperationSource,
  ProjectOperationProjectionItem,
  ProjectOperationProjection,
} from "./types.ts";

/**
 * 部分Source集合から根拠付きProject Viewを生成する。
 *
 * @responsibility 不完全状態を個別に保持し、restricted Sourceの詳細を除去した読取りProjectionを返す。
 * @trace ARCH-000005
 * @input projectId: 対象Project、projectionId: 投影Identity、sources: Source観測集合。
 * @returns 完全性と項目別状態を持つProjectOperationProjection。
 * @precondition Project、Projectionおよびfield Identityが空でなく、fieldIdが重複しない。
 * @postcondition 入力順を保ち、complete以外を完全状態へ畳まない。
 * @effect N/A: 入力値から新しい読取り値を構築するだけである。
 * @failure 不正Identityまたは重複fieldIdは例外で拒否し、部分Projectionを返さない。
 * @invariant restricted項目からSource、Revision、時点および値を公開しない。
 * @boundary 複数Source ReaderとProject Management Projectionの直接境界。
 * @security 非開示SourceのIdentity、Revision、値を結果へ含めない。
 * @concurrency N/A: 不変Snapshotの同期変換だけを行う。
 */
export function projectProjectOperationSources(
  projectId: string,
  projectionId: string,
  sources: readonly ProjectOperationSource[],
): ProjectOperationProjection {
  if (!projectId || !projectionId || sources.some((source) => !source.fieldId))
    throw new Error("project_operation_projection_input_invalid");
  if (new Set(sources.map((source) => source.fieldId)).size !== sources.length)
    throw new Error("project_operation_projection_field_duplicate");
  const items = sources.map((source): ProjectOperationProjectionItem => {
    const isRestricted = source.state === "restricted";
    return Object.freeze({
      fieldId: source.fieldId,
      state: source.state,
      sourceId: isRestricted ? null : (source.sourceId ?? null),
      sourceRevision: isRestricted ? null : (source.sourceRevision ?? null),
      observedAt: isRestricted ? null : (source.observedAt ?? null),
      value: isRestricted ? null : (source.value ?? null),
    });
  });
  return Object.freeze({
    projectId,
    projectionId,
    status: items.every((item) => item.state === "complete")
      ? "complete"
      : "partial",
    items: Object.freeze(items),
  });
}
