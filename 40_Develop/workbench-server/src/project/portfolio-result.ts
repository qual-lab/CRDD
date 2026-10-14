/**
 * Portfolioの受取値をServerとBrowserの共通表示契約で検査する。
 * @packageDocumentation
 * @responsibility 五場面・Source相関・欠測と競合の表示値を補完せず確認する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary 未検査の表示JSONとWorkbench表示投影。
 * @security 認可や非開示Sourceを生成しない。
 */
import type { FederatedProjectProjection } from "../../../domain-model/src/index.ts";

/**
 * 未知値がProperty検査可能なRecordかを判定する。
 *
 * @responsibility Client Model検査でnullと配列をObject Recordへ誤認しない。
 * @trace ARCH-000012
 * @input value: 判定する未知値。
 * @returns Recordならtrueを返す。
 * @precondition N/A: 任意の未知値を受け取る。
 * @postcondition trueの場合だけProperty参照が可能である。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 配列をRecordとして受理しない。
 * @boundary JSON値と構造検査の境界。
 * @security Prototypeの内容をAuthorityとして扱わない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isProjectionRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 未知値が文字列またはnullかを判定する。
 * @responsibility JSON境界の任意文字列をnull許容Fieldと区別する。
 * @trace ARCH-000012
 * @input valueに未知値を受け取る。
 * @returns 文字列またはnullならtrueを返す。
 * @precondition N/A: 任意の未知値を受け取る。
 * @postcondition trueの場合だけ文字列またはnullとして参照できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant undefinedをnullとして受理しない。
 * @boundary JSON値とClient Modelの境界。
 * @security 値を評価または実行しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isProjectionNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/**
 * 未知値が文字列配列かを判定する。
 * @responsibility Reactが反復する配列にObjectやnullを混入させない。
 * @trace ARCH-000012
 * @input valueに未知値を受け取る。
 * @returns 全要素が文字列の配列ならtrueを返す。
 * @precondition N/A: 任意の未知値を受け取る。
 * @postcondition trueの場合だけ安全に文字列配列を反復できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 配列以外を空配列へ補正しない。
 * @boundary JSON配列とReact反復の境界。
 * @security 値を評価または実行しない。
 * @concurrency N/A: 同期純粋処理である。
 */
function isProjectionStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

/**
 * Project Contextの五場面をReactが描画できる構造として検査する。
 * @responsibility 場面、表Headerおよび全Cellの型を描画前に確定する。
 * @trace ARCH-000012
 * @input valueに未知のProject Context候補を受け取る。
 * @returns 描画に必要な全Fieldが成立する場合だけtrueを返す。
 * @precondition N/A: JSON由来の未知値を受け取る。
 * @postcondition trueではscenes、columnsおよびrowsを安全に反復できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 未知の場面Keyを受理しない。
 * @boundary Project Context JSONとReact Sceneの境界。
 * @security 表CellをTextとしてのみ検査する。
 * @concurrency N/A: 同期純粋処理である。
 */
export function isProjectContext(value: unknown): boolean {
  if (
    !isProjectionRecord(value) ||
    Object.keys(value).sort().join(",") !==
      "projectId,repositoryId,repositoryRole,scenes" ||
    typeof value.projectId !== "string" ||
    typeof value.repositoryId !== "string" ||
    typeof value.repositoryRole !== "string" ||
    !Array.isArray(value.scenes)
  )
    return false;
  const expectedKeys = ["current", "risk", "decision", "reason", "next"];
  if (
    value.scenes.length !== expectedKeys.length ||
    value.scenes.some(
      (scene, index) =>
        !isProjectionRecord(scene) || scene.key !== expectedKeys[index],
    )
  )
    return false;
  return value.scenes.every((scene) => {
    if (
      !isProjectionRecord(scene) ||
      Object.keys(scene).sort().join(",") !== "key,summary,table,title" ||
      !isProjectionRecord(scene.table)
    )
      return false;
    const table = scene.table;
    if (Object.keys(table).sort().join(",") !== "columns,rows") return false;
    if (!isProjectionStringArray(table.columns) || !Array.isArray(table.rows))
      return false;
    const columnCount = table.columns.length;
    return (
      typeof scene.title === "string" &&
      isProjectionNullableString(scene.summary) &&
      table.rows.every(
        (row) => isProjectionStringArray(row) && row.length === columnCount,
      )
    );
  });
}

/**
 * Portfolio内のProjectとSourceを描画可能な形として検査する。
 * @responsibility Source配列、状態、Roleおよび任意Contextの相関を確認する。
 * @trace ARCH-000012
 * @input valueに未知のFederated Project候補を受け取る。
 * @returns Project DetailとPortfolio一覧が安全に描画できる場合だけtrueを返す。
 * @precondition N/A: JSON由来の未知値を受け取る。
 * @postcondition trueではsourcesを安全に反復できる。
 * @effect N/A: 純粋判定である。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant 非complete SourceへContextを補完しない。
 * @boundary Portfolio JSONとServer／Browser表示の境界。
 * @security 非開示Sourceを生成しない。
 * @concurrency N/A: 同期純粋処理である。
 */
export function isFederatedProject(
  value: unknown,
): value is FederatedProjectProjection {
  if (
    !isProjectionRecord(value) ||
    Object.keys(value).sort().join(",") !== "projectId,sources,state" ||
    typeof value.projectId !== "string" ||
    !["complete", "partial", "conflicting"].includes(String(value.state)) ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0
  )
    return false;
  const repositoryIds: string[] = [];
  for (const source of value.sources) {
    if (
      !isProjectionRecord(source) ||
      Object.keys(source).sort().join(",") !==
        "context,repositoryId,repositoryRole,revision,state" ||
      typeof source.repositoryId !== "string" ||
      !isProjectionNullableString(source.revision) ||
      !["complete", "missing", "conflicting", "unavailable"].includes(
        String(source.state),
      ) ||
      !isProjectionNullableString(source.repositoryRole)
    )
      return false;
    repositoryIds.push(source.repositoryId);
    if (source.state === "complete") {
      if (
        typeof source.repositoryRole !== "string" ||
        typeof source.revision !== "string" ||
        !isProjectContext(source.context) ||
        !isProjectionRecord(source.context) ||
        source.context.projectId !== value.projectId ||
        source.context.repositoryId !== source.repositoryId ||
        source.context.repositoryRole !== source.repositoryRole
      )
        return false;
    } else if (
      source.context !== null ||
      source.repositoryRole !== null ||
      source.revision !== null
    ) {
      return false;
    }
  }
  if (
    repositoryIds.some((repositoryId, index) => {
      const sortedRepositoryIds = [...repositoryIds].sort((left, right) =>
        left.localeCompare(right),
      );
      return repositoryId !== sortedRepositoryIds[index];
    }) ||
    new Set(repositoryIds).size !== repositoryIds.length
  )
    return false;
  const derivedState = value.sources.some(
    (source) => isProjectionRecord(source) && source.state === "conflicting",
  )
    ? "conflicting"
    : value.sources.every(
          (source) => isProjectionRecord(source) && source.state === "complete",
        )
      ? "complete"
      : "partial";
  return value.state === derivedState;
}
