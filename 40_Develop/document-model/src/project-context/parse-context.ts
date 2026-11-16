/**
 * Repository Project Contextの固定Markdown契約を推測なしで読み取る。
 *
 * @packageDocumentation
 * @responsibility 人間可読な固定MarkdownからIdentityと五場面を推測なしで構造化する。
 * @trace ARCH-000005
 * @boundary Repository Project Context MarkdownとConsumer Read Modelの境界。
 * @effect N/A: 受け取った文字列だけを解析する。
 * @security 宣言されていないContext、RepositoryまたはAuthorityを補完しない。
 */
import type {
  ArtifactSource,
  DocumentIssue,
  ParseResult,
} from "../artifact/types.ts";
import type {
  RepositoryProjectContext,
  RepositoryProjectContextScene,
  RepositoryProjectContextTable,
} from "./types.ts";

const SCENE_DEFINITIONS = Object.freeze([
  Object.freeze({ key: "current", heading: "## 1. 今どうなっているか" }),
  Object.freeze({
    key: "risk",
    heading: "## 2. 何が危ない、または止まっているか",
  }),
  Object.freeze({
    key: "decision",
    heading: "## 3. 今、人間が決めることは何か",
  }),
  Object.freeze({
    key: "reason",
    heading: "## 4. なぜこの状態・判断になったか",
  }),
  Object.freeze({ key: "next", heading: "## 5. 次に何をすべきか" }),
] as const);

/**
 * MarkdownのInline装飾を表示用Textへ限定変換する。
 *
 * @responsibility CodeとLinkの表示文字だけを残し、Consumerへ実行可能なMarkupを渡さない。
 * @trace ARCH-000005
 * @input valueに一つのMarkdown Cellまたは段落を受け取る。
 * @returns Inline Code記号を除きLinkを表示名へ変えたTextを返す。
 * @precondition valueはRepository Project Contextから切り出した一行である。
 * @postcondition Markdown Link URLとBacktickを結果へ残さない。
 * @effect N/A: 文字列を変換するだけである。
 * @failure N/A: 未知のInline記法はTextとして保持する。
 * @invariant 表示文字の順序を変えない。
 * @boundary Markdown Reader内部とConsumer表示Textの境界。
 * @security Link先やHTMLを評価・取得しない。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function toDisplayText(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .trim();
}

/**
 * 固定場面内の最初のMarkdown表を解析する。
 *
 * @responsibility 列数を検証し、固定表を順序保持したRead Modelへ変換する。
 * @trace ARCH-000005
 * @input linesに一場面のMarkdown行を受け取る。
 * @returns 列名と行を持つRepositoryProjectContextTableを返す。
 * @precondition 場面には一つ以上のMarkdown表が存在する。
 * @postcondition 全行の列数がHeaderと一致する。
 * @effect N/A: 入力配列を変更しない。
 * @failure 表欠落、区切り不正または列数不一致をErrorで拒否する。
 * @invariant 空Cellを既知値へ補完しない。
 * @boundary Markdown Tableと構造化Tableの境界。
 * @security Cell内容をCodeまたはHTMLとして実行しない。
 * @concurrency N/A: 同期的な純粋解析である。
 */
function parseFirstTable(
  lines: readonly string[],
): RepositoryProjectContextTable {
  const headerIndex = lines.findIndex(
    (line, index) =>
      /^\|.*\|$/u.test(line.trim()) &&
      index + 1 < lines.length &&
      /^\|(?:\s*:?-+:?\s*\|)+$/u.test(lines[index + 1]?.trim() ?? ""),
  );
  if (headerIndex < 0) throw new Error("project_context_table_missing");
  const splitRow = (line: string): readonly string[] =>
    Object.freeze(line.trim().slice(1, -1).split("|").map(toDisplayText));
  const columns = splitRow(lines[headerIndex] ?? "");
  const rows: (readonly string[])[] = [];
  for (const line of lines.slice(headerIndex + 2)) {
    if (!/^\|.*\|$/u.test(line.trim())) break;
    const rowCells = splitRow(line);
    if (rowCells.length !== columns.length)
      throw new Error("project_context_table_column_mismatch");
    rows.push(rowCells);
  }
  return Object.freeze({ columns, rows: Object.freeze(rows) });
}

/**
 * Repository Project Context Markdownを共通Read Modelへ変換する。
 *
 * @responsibility 三つのIdentityと五つの固定場面を決定論的に解析する。
 * @trace ARCH-000005
 * @input markdownにPROJECT_CONTEXT.mdのUTF-8本文を受け取る。
 * @returns Identity、要約および表を持つRepositoryProjectContextを返す。
 * @precondition 現行TemplateのIdentity行、五つの見出しおよび各場面の表が存在する。
 * @postcondition 五場面を固定順で返し、記載のない情報を追加しない。
 * @effect N/A: Markdownを読取り専用で解析する。
 * @failure 必須Identity、見出し、表または順序が不正ならErrorで拒否する。
 * @invariant Project Context固有ID、観測時点またはRole外Contextを生成しない。
 * @boundary Repository Project Context MarkdownとConsumer共通契約の直接境界。
 * @security Linkを取得せず、HTMLを実行せず、非開示Contextを推測しない。
 * @concurrency N/A: 一つの不変Snapshotを同期解析する。
 */
function captureProjectContext(markdown: string): RepositoryProjectContext {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const readIdentity = (label: string): string => {
    const prefix = `${label}:`;
    const line = lines.find((candidate) => candidate.startsWith(prefix));
    if (line === undefined) throw new Error("project_context_identity_missing");
    const value = toDisplayText(line.slice(prefix.length))
      .replace(/（.*$/u, "")
      .trim();
    if (!value) throw new Error("project_context_identity_invalid");
    return value;
  };
  const headingIndexes: readonly number[] = SCENE_DEFINITIONS.map(
    ({ heading }) => lines.indexOf(heading),
  );
  if (
    headingIndexes.some((index) => index < 0) ||
    headingIndexes.some(
      (index, position) =>
        position > 0 && index <= (headingIndexes[position - 1] ?? -1),
    )
  )
    throw new Error("project_context_scene_invalid");
  const scenes: readonly RepositoryProjectContextScene[] =
    SCENE_DEFINITIONS.map((definition, position) => {
      const start: number = (headingIndexes[position] ?? -1) + 1;
      const end: number = headingIndexes[position + 1] ?? lines.length;
      const sceneLines = lines.slice(start, end);
      const summaryHeading = sceneLines.findIndex(
        (line) => line === "### 結論" || line === "### 保存済みの次候補",
      );
      const summary =
        summaryHeading >= 0 && sceneLines[summaryHeading] === "### 結論"
          ? toDisplayText(
              sceneLines
                .slice(summaryHeading + 1)
                .find((line) => line.trim()) ?? "",
            ) || null
          : null;
      return Object.freeze({
        key: definition.key,
        title: definition.heading.replace(/^## \d+\. /u, ""),
        summary,
        table: parseFirstTable(sceneLines),
      });
    });
  return Object.freeze({
    projectId: readIdentity("Project ID"),
    repositoryId: readIdentity("Repository ID"),
    repositoryRole: readIdentity("Repository Role"),
    scenes: Object.freeze(scenes),
  });
}

function projectionContractInvalid(
  content: string,
  isTemplate: boolean,
): boolean {
  const headings = [
    "## 1. 今どうなっているか",
    "## 2. 何が危ない、または止まっているか",
    "## 3. 今、人間が決めることは何か",
    "## 4. なぜこの状態・判断になったか",
    "## 5. 次に何をすべきか",
    "## Checklist",
  ];
  const checklistItems = [
    "Project ID、Repository IDおよびRepository Roleを評価した。",
    "三つのIdentityがRepository Manifestと一致している。",
    "五場面を省略せず、結論を先に示した。",
    "現在事実と共有分析を区別した。",
    "正本が存在する内容をOwner Relationへ接続した。",
    "Project Context固有の安定IDを追加していない。",
    "項目単位の閲覧権限、観測時刻およびLive運用状態を追加していない。",
    "確認済みの該当なし、不明およびOPENを空欄へ畳んでいない。",
    "Owner Artifactとの競合時はProject Contextを現在値として使わない。",
    "保存済みの次候補と対話時の追加提案を区別できる。",
    "Gateを閉じる前に再投影要否を評価する。",
  ];

  const lines = content.split(/\r?\n/u);
  const identityLabels = ["Project ID", "Repository ID", "Repository Role"];
  const isIdentityInvalid = identityLabels.some((label) => {
    const matches = lines.filter((line) => line.startsWith(`${label}: `));
    return (
      matches.length !== 1 ||
      (matches[0] as string).slice(label.length + 2).trim() === ""
    );
  });
  const headingPositions = headings.map((heading) => lines.indexOf(heading));
  const isHeadingOrderInvalid =
    headingPositions.some((position) => position < 0) ||
    headingPositions.some(
      (position, index) =>
        index > 0 && position <= (headingPositions[index - 1] as number),
    ) ||
    headings.some(
      (heading) => lines.filter((line) => line === heading).length !== 1,
    );
  const isChecklistInvalid = checklistItems.some((item) => {
    const expected = isTemplate ? `- [ ] ${item}` : `- [x] ${item}`;
    return !lines.includes(expected);
  });

  return isIdentityInvalid || isHeadingOrderInvalid || isChecklistInvalid;
}
/**
 * Project Contextを内容モデルと文書単体の診断へ受け付ける。
 * @responsibility 単体条件と解析失敗を保持し、外部Manifest照合や認可を行わない。
 * @trace ARCH-000005
 * @input markdown: 取得済み本文。options: ひな型方式と相対出典。
 * @returns 解析可能な部分内容と診断。構造不成立時は結果nullと元の理由を返す。
 * @effect N/A: 取得済み文字列のみ。File・外部サービスへ接続しない。
 * @failure 契約にない例外は伝播し、既知の文書不正と混同しない。
 */
export function parseRepositoryProjectContextMarkdown(
  markdown: string,
  options: Readonly<{
    mode?: "template" | "evaluated";
    sourcePath?: string;
  }> = {},
): ParseResult<RepositoryProjectContext> &
  Readonly<{
    source: ArtifactSource;
    manifestIdentity: Readonly<{
      projectId: string;
      repositoryId: string;
      repositoryRole: string;
    }>;
  }> {
  const source = {
    path: options.sourcePath ?? "PROJECT_CONTEXT.md",
    content: markdown,
  };
  const identity = (label: string) =>
    markdown
      .split(/\r?\n/u)
      .find((line) => line.startsWith(`${label}: `))
      ?.match(/`([^`]+)`/u)?.[1] ?? "";
  const manifestIdentity = {
    projectId: identity("Project ID"),
    repositoryId: identity("Repository ID"),
    repositoryRole: identity("Repository Role"),
  };
  const issues: DocumentIssue[] = [];
  if (projectionContractInvalid(markdown, options.mode === "template"))
    issues.push({
      kind: "artifact.project-context.projection-contract-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: "project-context-projection-contract-invalid",
      details: {},
    });
  let result: RepositoryProjectContext | null = null;
  try {
    result = captureProjectContext(markdown);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      ![
        "project_context_table_missing",
        "project_context_table_column_mismatch",
        "project_context_identity_missing",
        "project_context_identity_invalid",
        "project_context_scene_invalid",
      ].includes(error.message)
    )
      throw error;
    issues.push({
      kind: "artifact.project-context.projection-model-invalid",
      targetIdentity: source.path,
      location: { path: source.path },
      reason: error.message,
      details: {},
    });
  }
  return {
    status:
      result === null ? "invalid" : issues.length ? "partial" : "complete",
    result,
    issues,
    source,
    manifestIdentity,
  };
}
