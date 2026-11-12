/**
 * Current Release Projectionの固定Markdown契約を推測なしで読み取る。
 *
 * @packageDocumentation
 * @responsibility Release Projectionから現在Version、期限、Scope、依存および判断を推測なしで構造化する。
 * @trace ARCH-000005
 * @boundary 99_Roadmap/03_Releases.mdとConsumer Read Modelの境界。
 * @effect N/A: 受け取った文字列だけを解析する。
 * @security Link先を取得せず、記載されていない計画または判断を補完しない。
 */
import type { RepositoryReleaseProjection } from "./types.ts";

/**
 * Release正本からProject Planへ投影する境界で使用するMarkdownTableの構造を固定する。
 *
 * @responsibility Release正本からProject Planへ投影する境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000005
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

type MarkdownTable = Readonly<{
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}>;

/**
 * Markdown Inline記法を表示文字へ限定変換する。
 *
 * @responsibility CodeとLinkの表示名だけを残し、URLと実行可能Markupを除外する。
 * @trace ARCH-000005
 * @input valueに一つのMarkdown Cellを受け取る。
 * @returns 表示用Textを返す。
 * @precondition valueは一つの表Cellである。
 * @postcondition Link URLとBacktickを結果へ残さない。
 * @effect N/A: 文字列を変換するだけである。
 * @failure N/A: 未知記法はTextとして保持する。
 * @invariant 表示文字の順序を変えない。
 * @boundary Markdown CellとConsumer表示Textの境界。
 * @security Link先やHTMLを評価しない。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function toDisplayText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .trim();
}

/**
 * 固定H2 Section内の最初のMarkdown表を解析する。
 *
 * @responsibility 見出し範囲、列数および行順を検証してRead Modelへ変換する。
 * @trace ARCH-000005
 * @input markdown、headingを受け取る。
 * @returns 列名と行を持つMarkdownTableを返す。
 * @precondition headingは完全一致するH2である。
 * @postcondition 全行の列数がHeaderと一致する。
 * @effect N/A: 入力文字列を変更しない。
 * @failure 見出し、表、区切りまたは列数が不正ならErrorで拒否する。
 * @invariant 後続Sectionの表を対象Sectionへ混入しない。
 * @boundary Markdown Sectionと構造化Tableの境界。
 * @security Cell内容をCodeまたはHTMLとして実行しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
function parseSectionTable(markdown: string, heading: string): MarkdownTable {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const headingIndex = lines.indexOf(heading);
  if (headingIndex < 0) throw new Error("release_projection_section_missing");
  const nextHeading = lines.findIndex(
    (line, index) => index > headingIndex && /^##\s+/u.test(line),
  );
  const sectionLines = lines.slice(
    headingIndex + 1,
    nextHeading < 0 ? lines.length : nextHeading,
  );
  const headerIndex = sectionLines.findIndex(
    (line, index) =>
      /^\|.*\|$/u.test(line.trim()) &&
      index + 1 < sectionLines.length &&
      /^\|(?:\s*:?-+:?\s*\|)+$/u.test(sectionLines[index + 1]?.trim() ?? ""),
  );
  if (headerIndex < 0) throw new Error("release_projection_table_missing");
  const splitRow = (line: string): readonly string[] =>
    Object.freeze(line.trim().slice(1, -1).split("|").map(toDisplayText));
  const columns = splitRow(sectionLines[headerIndex] ?? "");
  const rows: (readonly string[])[] = [];
  for (const line of sectionLines.slice(headerIndex + 2)) {
    if (!/^\|.*\|$/u.test(line.trim())) break;
    const rowCells = splitRow(line);
    if (rowCells.length !== columns.length)
      throw new Error("release_projection_table_column_mismatch");
    rows.push(rowCells);
  }
  return Object.freeze({ columns, rows: Object.freeze(rows) });
}

/**
 * Current Release Projection Markdownを共通Read Modelへ変換する。
 *
 * @responsibility 固定三表から現在計画を決定論的に取得し、欠落を拒否する。
 * @trace ARCH-000005
 * @input markdownに99_Roadmap/03_Releases.mdのUTF-8本文を受け取る。
 * @returns RepositoryReleaseProjectionを返す。
 * @precondition 現行Templateの現在状態、現在Scope、依存と判断の表が存在する。
 * @postcondition 必須六項目と全Scope／依存行を入力順で返す。
 * @effect N/A: Markdownを読取り専用で解析する。
 * @failure 必須項目、列、Versionまたは日付が不正ならErrorで拒否する。
 * @invariant Release状態、日付、Riskまたは判断をAI推論で補完しない。
 * @boundary Current Release Projection MarkdownとConsumer共通契約の直接境界。
 * @security Linkを取得せず、HTMLを実行せず、非開示Scopeを推測しない。
 * @concurrency 一つの不変Snapshotを同期解析する。
 */
export function parseRepositoryReleaseProjectionMarkdown(
  markdown: string,
): RepositoryReleaseProjection {
  const current = parseSectionTable(markdown, "## 1. 現在状態");
  const scope = parseSectionTable(markdown, "## 2. 現在Scope");
  const dependencies = parseSectionTable(markdown, "## 3. 依存と判断");
  if (
    current.columns.join("\0") !== ["項目", "現在値", "正本"].join("\0") ||
    scope.columns.join("\0") !==
      ["段階", "範囲", "現在状態", "正本"].join("\0") ||
    dependencies.columns.join("\0") !==
      ["項目", "現在状態", "次の処置／判断"].join("\0")
  )
    throw new Error("release_projection_columns_invalid");
  const values = new Map(
    current.rows.map((rowCells) => [rowCells[0], rowCells[1]]),
  );
  const required = (key: string): string => {
    const value = values.get(key);
    if (value === undefined || value.length === 0)
      throw new Error("release_projection_value_missing");
    return value;
  };
  const publishedBaseline = required("公開済みBaseline");
  const targetVersion = required("次の対象");
  const rawDate = required("目標リリース日");
  if (
    !/^v\d+\.\d+\.\d+$/u.test(publishedBaseline) ||
    !/^v\d+\.\d+\.\d+$/u.test(targetVersion)
  )
    throw new Error("release_projection_version_invalid");
  if (rawDate !== "未設定" && !/^\d{4}-\d{2}-\d{2}$/u.test(rawDate))
    throw new Error("release_projection_date_invalid");
  if (
    scope.rows.length === 0 ||
    dependencies.rows.length === 0 ||
    scope.rows.some((rowCells) =>
      rowCells.some((value) => value.length === 0),
    ) ||
    dependencies.rows.some((rowCells) =>
      rowCells.some((value) => value.length === 0),
    )
  )
    throw new Error("release_projection_row_invalid");
  return Object.freeze({
    publishedBaseline,
    targetVersion,
    targetReleaseDate: rawDate === "未設定" ? null : rawDate,
    workState: required("現在の作業状態"),
    releaseDecision: required("リリース判断"),
    scheduleRisk: required("日程リスク"),
    scope: Object.freeze(
      scope.rows.map((rowCells) =>
        Object.freeze({
          stage: rowCells[0] ?? "",
          scope: rowCells[1] ?? "",
          state: rowCells[2] ?? "",
          owner: rowCells[3] ?? "",
        }),
      ),
    ),
    dependencies: Object.freeze(
      dependencies.rows.map((rowCells) =>
        Object.freeze({
          item: rowCells[0] ?? "",
          state: rowCells[1] ?? "",
          next: rowCells[2] ?? "",
        }),
      ),
    ),
  });
}
