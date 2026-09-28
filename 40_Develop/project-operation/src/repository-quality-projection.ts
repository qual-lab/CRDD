/**
 * Current Quality Projectionの固定Markdown契約を読み取る。
 *
 * @packageDocumentation
 * @responsibility Quality Centerから現在品質、観測Coverage、Gap、次Gateおよび人間判断を推測なしで構造化する。
 * @trace ARCH-000005
 * @boundary 07_Quality/01_Quality_Center.mdとConsumer Read Modelの境界。
 * @effect N/A: 受け取った文字列だけを解析する。
 * @security Link先を取得せず、記載されていない品質状態を補完しない。
 */

/**
 * RepositoryのCurrent Quality Projectionを定義する。
 *
 * @responsibility 品質状態、対象、Coverage、Gap、Gate、人間判断および根拠を一Snapshotへ閉じる。
 * @trace ARCH-000005
 * @shape overallState、target、observed、unobserved、knownGap、nextGate、humanDecisionおよびrationaleを表す。
 * @invariant 未観測を観測済みへ、進行中GapをPassへ変換しない。
 * @boundary Quality Center ProjectionとConsumerの型境界。
 * @security Evidence本文、内部Pathまたは非開示結果を追加しない。
 * @compatibility 固定項目変更時はParserと全Consumerを再評価する。
 */
export type RepositoryQualityProjection = Readonly<{
  overallState: string;
  target: string;
  observed: string;
  unobserved: string;
  knownGap: string;
  nextGate: string;
  humanDecision: string;
  rationale: Readonly<Record<string, string>>;
}>;

const REQUIRED_KEYS = Object.freeze([
  "全体状態",
  "現在対象",
  "観測済み",
  "未観測",
  "既知Gap",
  "次Gate",
  "現在人間判断",
] as const);

/**
 * Current Quality Projection Markdownを共通Read Modelへ変換する。
 *
 * @responsibility 固定表から現在品質の必須七項目と根拠を決定論的に取得する。
 * @trace ARCH-000005
 * @input markdownに07_Quality/01_Quality_Center.mdのUTF-8本文を受け取る。
 * @returns RepositoryQualityProjectionを返す。
 * @precondition Current Quality Projection見出しと固定三列表が存在する。
 * @postcondition 必須七項目と各根拠を同じ入力Snapshotから返す。
 * @effect N/A: Markdown文字列だけを解析する。
 * @failure 見出し、表、必須値または根拠が欠ける場合はErrorで拒否する。
 * @invariant 欠落値、割合、Passまたは人間判断を推測しない。
 * @boundary Quality Center MarkdownとConsumer共通契約の直接境界。
 * @security Link表示名だけを保持し、URLやHTMLを評価しない。
 * @concurrency N/A: 共有状態を持たない同期解析である。
 */
export function parseRepositoryQualityProjectionMarkdown(
  markdown: string,
): RepositoryQualityProjection {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const headingIndex = lines.indexOf("## Current Quality Projection");
  if (headingIndex < 0) throw new Error("quality_projection_section_missing");
  const headerIndex = lines.findIndex(
    (line, index) =>
      index > headingIndex &&
      line.trim() === "| 項目 | 現在値 | 根拠・次の処置 |",
  );
  if (
    headerIndex < 0 ||
    !/^\|(?:\s*:?-+:?\s*\|)+$/u.test(lines[headerIndex + 1]?.trim() ?? "")
  )
    throw new Error("quality_projection_table_invalid");
  const values = new Map<
    string,
    Readonly<{ value: string; rationale: string }>
  >();
  for (const line of lines.slice(headerIndex + 2)) {
    if (!/^\|.*\|$/u.test(line.trim())) break;
    const cells = line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((cell) =>
        cell
          .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
          .replace(/`([^`]+)`/gu, "$1")
          .trim(),
      );
    if (cells.length !== 3 || cells.some((cell) => cell.length === 0))
      throw new Error("quality_projection_row_invalid");
    values.set(
      cells[0] ?? "",
      Object.freeze({ value: cells[1] ?? "", rationale: cells[2] ?? "" }),
    );
  }
  for (const key of REQUIRED_KEYS)
    if (!values.has(key)) throw new Error("quality_projection_value_missing");
  const value = (key: (typeof REQUIRED_KEYS)[number]) =>
    values.get(key)?.value ?? "";
  return Object.freeze({
    overallState: value("全体状態"),
    target: value("現在対象"),
    observed: value("観測済み"),
    unobserved: value("未観測"),
    knownGap: value("既知Gap"),
    nextGate: value("次Gate"),
    humanDecision: value("現在人間判断"),
    rationale: Object.freeze(
      Object.fromEntries(
        REQUIRED_KEYS.map((key) => [key, values.get(key)?.rationale ?? ""]),
      ),
    ),
  });
}
