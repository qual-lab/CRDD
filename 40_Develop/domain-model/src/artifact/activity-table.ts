/**
 * 活動Contextの固定Markdown Metadataと表構造を解析する。
 *
 * @packageDocumentation
 * @responsibility TopicとMeetingが共有する文字列解析だけを一つの実体で提供する。
 * @trace ARCH-000006
 * @boundary Topic／MeetingのCanonical Markdownと型付き意味処理の境界。
 * @effect N/A: 入力文字列または型宣言だけを扱う。
 * @security 記載されていない状態、RelationまたはAuthorityを補完しない。
 */
/**
 * 固定Metadata行から値を取得する。
 *
 * @responsibility 必須Metadataの欠落と空値を同じ失敗として拒否する。
 * @trace ARCH-000006
 * @input linesに正規化済みMarkdown行、labelに固定表示名を受け取る。
 * @returns Backtickと補足括弧を除いた値を返す。
 * @precondition labelはTopic／Meeting契約の固定Metadata名である。
 * @postcondition 空でない値を返す。
 * @effect N/A: 入力配列を変更しない。
 * @failure 欠落または空値をproject_operation_record_metadata_invalidで拒否する。
 * @invariant 推測値や既定値を生成しない。
 * @boundary Markdown Metadataと型付きRecordの境界。
 * @security 値をPathまたはCodeとして評価しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
export function readMetadata(lines: readonly string[], label: string): string {
  const prefix = `${label}:`;
  const line = lines.find((candidate) => candidate.startsWith(prefix));
  const value = line
    ?.slice(prefix.length)
    .replaceAll("`", "")
    .replace(/（.*$/u, "")
    .trim();
  if (!value) throw new Error("project_operation_record_metadata_invalid");
  return value;
}

/**
 * 固定節の先行要約を取得する。
 *
 * @responsibility `### 結論`直後の最初の本文段落だけを一覧要約として返す。
 * @trace ARCH-000006
 * @input linesに正規化済みMarkdown行を受け取る。
 * @returns 空でない先行要約を返す。
 * @precondition 正本に`### 結論`が存在する。
 * @postcondition 表や後続節を要約として取り込まない。
 * @effect N/A: 入力配列を変更しない。
 * @failure 結論欠落または空値をproject_operation_record_summary_invalidで拒否する。
 * @invariant AI要約や推測を生成しない。
 * @boundary 正本本文と一覧表示要約の境界。
 * @security MarkdownをHTMLとして実行しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
export function readSummary(lines: readonly string[]): string {
  const heading = lines.indexOf("### 結論");
  const value =
    heading < 0
      ? undefined
      : lines.slice(heading + 1).find((line) => line.trim());
  if (!value) throw new Error("project_operation_record_summary_invalid");
  return value.trim();
}

/**
 * 固定Markdown表の一つの行をCellへ分解する。
 *
 * @responsibility 外側Delimiterを除き、各Cellの前後空白を正規化する。
 * @trace ARCH-000006
 * @input lineに固定Markdown表の一行を受け取る。
 * @returns 正規化したCell配列を返す。
 * @precondition 入力はPipe区切りの表行である。
 * @postcondition 外側の空Cellを結果へ含めない。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure N/A: 構造妥当性は呼出し側が期待列数で判定する。
 * @invariant Cell内容を解釈または補完しない。
 * @boundary Meeting Markdown表と局所変換処理の境界。
 * @security CellをCodeまたはHTMLとして実行しない。
 * @concurrency N/A: 同期的な純粋変換である。
 */
export function tableCells(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());
}

/**
 * Markdown表Cellへ安全に埋め込める値かを検証する。
 *
 * @responsibility 空値、改行およびPipeによる表構造破壊をEffect前に拒否する。
 * @trace ARCH-000006
 * @input valueに候補Cell、reasonに失敗理由を受け取る。
 * @returns N/A: 妥当時は値を返さず処理を継続する。
 * @precondition reasonは利用側が識別できる固定失敗理由である。
 * @postcondition 成功時はvalueを変更しない。
 * @effect N/A: 入力検証だけを行う。
 * @failure 不正値では指定reasonを持つErrorを送出する。
 * @invariant Markdown構造を曖昧にする値を受理しない。
 * @boundary 利用側入力とCanonical Markdown表の境界。
 * @security Markup注入に利用できる構造Delimiterを拒否する。
 * @concurrency N/A: 同期的な純粋検証である。
 */
export function assertSafeCell(value: string, reason: string): void {
  if (!value.trim() || /[|\r\n]/u.test(value)) throw new Error(reason);
}

/**
 * 固定節に属する表のHeaderとData範囲を取得する。
 *
 * @responsibility 別節の類似表を誤更新せず対象表範囲を一意に決める。
 * @trace ARCH-000006
 * @input linesにMarkdown行、headingとheaderPrefixに固定識別子を受け取る。
 * @returns Header、Data開始およびData終了Indexを返す。
 * @precondition headingとheaderPrefixは現行Meeting Templateの固定値である。
 * @postcondition endは最初の非表行または文末を指す。
 * @effect N/A: 入力配列を変更しない。
 * @failure 節またはHeader欠落をMeeting Outcome不正として拒否する。
 * @invariant 別節へ探索範囲を拡大しない。
 * @boundary Meeting節構造と表変換の境界。
 * @security 入力行をPathまたはCodeとして評価しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
export function tableRange(
  lines: readonly string[],
  heading: string,
  headerPrefix: string,
): Readonly<{ header: number; start: number; end: number }> {
  const section = lines.indexOf(heading);
  const header = lines.findIndex(
    (line, index) => index > section && line.startsWith(headerPrefix),
  );
  if (section < 0 || header < 0)
    throw new Error("project_operation_meeting_outcome_invalid");
  let end = header + 2;
  while (end < lines.length && lines[end]?.trim().startsWith("|")) end += 1;
  return Object.freeze({ header, start: header + 2, end });
}
