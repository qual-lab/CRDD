/**
 * IAの固定Checklist・表・Section・局所診断の構文を所有する。
 * @responsibility 局所文法を文書解析とSemantic比較から分離する。
 * @trace ARCH-000008
 */
import {
  isMarkdownTableSeparator,
  parseMarkdownTableRow,
} from "../artifact/markdown.ts";
import type { DocumentIssue } from "../artifact/types.ts";
import type { IaChecklistRequest, IaDocument } from "./types.ts";
/**
 * IAが所有する六種類のChecklist期待項目を選択する。
 * @responsibility 元の項目と順序・受付間の独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示されたIA文書種別。
 * @returns 今回の受付が所有する期待項目配列。
 * @precondition Pathから種別を推定しない。
 * @postcondition 固定定義・別呼出しと配列を共有しない。
 * @effect N/A: 局所値の構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 六種類の項目文言・順序を変更しない。
 * @boundary IAの固定条件選択。
 * @security 期待列を品質成立やAuthorityへ変換しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
export function iaChecklistItems(kind: IaChecklistRequest["kind"]): string[] {
  const iaIndexChecklistItemTexts = [
    "全UX DefinitionをIA Analysisへ一件ずつ対応付けた",
    "全IA AnalysisをIA Definitionへ処置した",
    "IA台帳とAnalysis／Definitionsの関係が一致する",
    "全体の情報構造を個別定義の第二の正本にしていない",
    "基本図を作成・既存参照・非該当・作成不能のいずれかへ処置した",
    "未確認事項、人間判断、IAへ戻す条件を明示した",
    "UI／SPECとQuality Analysis / IAへの接続を区別した",
    "Architecture／Sourceへの直接Handoffを作っていない",
    "補足分析へ必須情報を退避していない",
  ];

  const iaObjectRelationChecklistItemTexts = [
    "全IA Definitionを一件ずつ処置した",
    "Object、Identity、Relationを混同していない",
    "DB、API、Classを情報Objectとして逆輸入していない",
    "個別IA Definitionの意味を再定義していない",
    "孤立Object、循環、関係の欠落を確認した",
    "非該当には理由を記録した",
    "補足分析へ必須情報を退避していない",
  ];

  const iaStructureNavigationChecklistItemTexts = [
    "全IA Definitionを一件ずつ処置した",
    "Priority、Grouping、Findabilityを区別した",
    "単一の画面やTreeを情報構造として先取りしていない",
    "根拠、判断、失敗時の戻り先へ到達できる",
    "個別IA Definitionの意味を再定義していない",
    "非該当には理由を記録した",
    "補足分析へ必須情報を退避していない",
  ];

  const iaStateVisibilityChecklistItemTexts = [
    "全IA Definitionを一件ずつ処置した",
    "State、Visibility、Temporal Meaningを区別した",
    "不明を正常または不存在へ丸めていない",
    "ResponsibilityとAuthorityを区別した",
    "非開示情報の存在を無断で露出していない",
    "個別IA Definitionの意味を再定義していない",
    "非該当には理由を記録した",
    "補足分析へ必須情報を退避していない",
  ];

  const iaAnalysisChecklistItemTexts = [
    "正式入力となるUX Definitionを一件だけ特定した",
    "UXの利用者成果と重要な失敗を保持した",
    "情報候補と利用者にとっての意味を特定した",
    "同じ情報と異なる情報を識別する条件を処置した",
    "情報同士の関係を処置した",
    "全Canonical Object候補を分析Objectへ対応付け、暗黙の改名・分離・統合を残していない",
    "Identity／RelationをCanonical側で再解釈させない変換根拠を残した",
    "状態と可視性を処置した",
    "時間的な意味を処置した",
    "情報の優先度・まとまり・見つけ方を評価した",
    "情報の責任者と判断権限を分けて評価した",
    "機能責任と実際の人物・組織・Componentへの割当を区別した",
    "欠損・誤認・古さ・競合・曖昧性を評価した",
    "人間判断の必要性を評価した",
    "UXから継承する未確認事項・判断者・影響とIA固有事項を区別した",
    "UI・SPEC・Quality Analysis / IAへの接続を区別した",
    "情報構造の検証意図を評価した",
    "画面・Component・DB・API・Classを先取りしていない",
    "現行UI・Architecture・Sourceから意味を逆輸入していない",
    "補足分析へ必須情報を退避していない",
  ];

  const iaDefinitionChecklistItemTexts = [
    "IA定義だけで情報契約を理解できる",
    "全入力UXの利用者成果・場面・対象・状態・導線を保持した",
    "情報Objectと利用者にとっての意味を定義した",
    "IdentityとRelationを定義した",
    "Source Identity／RelationからCanonical Identity／Relationへの変換を明示した",
    "全Canonical ObjectをSource Analysis Objectへ対応付け、暗黙の改名・分離・統合を残していない",
    "StateとVisibilityを定義した",
    "Temporal Meaningを定義した",
    "Priority・Grouping・Findabilityを定義した",
    "ResponsibilityとAuthorityを分けて定義した",
    "機能責任と実際の人物・組織・Componentへの割当を区別した",
    "Failure・Risk・Constraintを定義した",
    "Human Inputの必要性を評価した",
    "UXから継承するOpen・GapとIA固有事項を区別し、IAへ戻す条件を明示した",
    "UI・SPEC・Quality Analysis / IAへの接続を区別した",
    "Verification Intentを明示した",
    "画面・Component・DB・API・Classを先取りしていない",
    "現行UI・Architecture・Sourceを正本としていない",
    "補足分析へ必須情報を退避していない",
  ];
  const items = {
    index: iaIndexChecklistItemTexts,
    object_relation: iaObjectRelationChecklistItemTexts,
    structure_navigation: iaStructureNavigationChecklistItemTexts,
    state_visibility: iaStateVisibilityChecklistItemTexts,
    analysis: iaAnalysisChecklistItemTexts,
    definition: iaDefinitionChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind)) throw new Error("unknown_ia_checklist_kind");
  return items[kind];
}
/**
 * IAの違反理由と位置を中立Issueへ結合する。
 *
 * @responsibility 呼出し元で確定した理由・位置・詳細を中立Issueへ結合する。
 * @trace ARCH-000008
 * @input reason: 理由。sourcePath: 元Path。identity: 対象ID。details: 補足値。
 * @returns 指定した理由・位置・補足値を持つ中立Issue。
 * @precondition 理由と元位置が現在のIA検査で確定している。
 * @postcondition 呼出し元の位置と詳細をそのまま結合する。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export function iaIssue(
  reason: string,
  sourcePath: string,
  identity: string,
  details: DocumentIssue["details"] = {},
): DocumentIssue {
  return {
    kind: `artifact.ia.${reason}`,
    targetIdentity: identity,
    location: { path: sourcePath },
    reason,
    details,
  };
}
/**
 * 期待する列と一致するIA表の連続行を読む。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input content: 本文。headers: 期待列。
 * @returns 列が完全一致する連続した表行。開始条件が合わなければ空配列。
 * @precondition headersが当該IA表の期待列を表す。
 * @postcondition 最初の不一致行で止め、期待列数を満たす行だけを返す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export const tableRows = <const Headers extends readonly string[]>(
  content: string,
  headers: Headers,
): Array<{ -readonly [K in keyof Headers]: string }> => {
  const lines = content.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return (
      cells !== null &&
      cells.length === headers.length &&
      cells.every((cell, index) => cell === headers[index])
    );
  });
  if (
    headerIndex < 0 ||
    !isMarkdownTableSeparator(lines[headerIndex + 1] ?? "", headers.length)
  )
    return [];
  const rows: Array<{ -readonly [K in keyof Headers]: string }> = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = parseMarkdownTableRow(lines[index] as string);
    if (cells === null || cells.length !== headers.length) break;
    rows.push(cells as { -readonly [K in keyof Headers]: string });
  }
  return rows;
};
/**
 * IA Object名から表示用の全角括弧補足を除く。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input value: 表示されたObject名。
 * @returns 全角括弧内の表示補足を除去してtrimした文字列。
 * @precondition 取得済みのObject名を受け取る。
 * @postcondition 同一性比較に用いる既存の括弧除去だけを行う。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export const localCanonicalName = (value: string): string =>
  value.replace(/（[^）]+）/gu, "").trim();
/**
 * 一つだけ存在する完全一致の二段階Sectionを取り出す。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input source: 本文。heading: 見出しの本文。
 * @returns 見出しが一つの場合の本文。欠落・重複ならnull。
 * @precondition sourceは呼出し元が可視化したIA本文である。
 * @postcondition 次の二段階見出しで打ち切り、重複Sectionを選ばない。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export const exactSecondLevelSection = (source: string, heading: string) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const headings = [
    ...source.matchAll(new RegExp(`^## ${escaped}\\s*$`, "gmu")),
  ];
  if (headings.length !== 1) return null;
  const firstHeading = headings[0] as RegExpMatchArray;
  const start = (firstHeading.index ?? 0) + firstHeading[0].length;
  const remaining = source.slice(start);
  const nextHeading = remaining.search(/^## /mu);
  return nextHeading < 0 ? remaining : remaining.slice(0, nextHeading);
};
export const expectedIaDownstreamLabels = [
  "UI（UX＋IAの正式入力）",
  "SPEC（UX＋IAの正式入力）",
  "Quality Analysis / IA（伴走）",
];
/**
 * IAが保持する三つの正式な後続関係を比較する。
 *
 * @responsibility IA本文と関係の既存判定を所有し、観測と表示を含めない。
 * @trace ARCH-000008
 * @input section: 抽出済みSectionまたはnull。
 * @returns 正式な三つの後続ラベルが同じ順である場合だけtrue。
 * @precondition sectionは抽出済みの後続関係節またはnullである。
 * @postcondition 不足・余剰・順序違いをfalseで返す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 解析の例外を伝播し、不足や不一致を成功へ補完しない。
 * @invariant 現行のSection・表・Identity／Relation・N/Aの判定条件を変えない。
 * @boundary N/A: 同一Process内のIAモデル検査。
 * @security 品質全体の成立・認可・移行完了を発行しない。
 * @concurrency N/A: 検査呼出し間の共有可変状態を持たない。
 */
export const hasExactIaDownstream = (section: string | null) => {
  const labels = (section ?? "")
    .split(/\r?\n/u)
    .map(
      (line) => /^\| (?<label>[^|]+) \| [^|]+ \|$/u.exec(line)?.groups?.label,
    )
    .filter((label): label is string => Boolean(label) && label !== "接続先");
  return (
    labels.length === expectedIaDownstreamLabels.length &&
    labels.every((label, index) => label === expectedIaDownstreamLabels[index])
  );
};
/**
 * IaのChecklist不備を文書別診断へ変換する。
 * @responsibility 取得済み内容・出典と局所条件を所有し、外部観測を行わない。
 * @trace ARCH-000008
 */
export function iaChecklistIssues(
  document: IaDocument,
  targetIdentity = document.source.path,
): DocumentIssue[] {
  const { failure, kind, mode } = document.checklistContract;
  if (!failure) return [];
  const reason =
    mode === "template"
      ? "template-checklist-invalid"
      : `${kind}-checklist-invalid`;
  return [
    {
      kind: `artifact.ia.${reason}`,
      reason,
      targetIdentity,
      location: { path: document.source.path },
      details: { checklistFailure: failure },
    },
  ];
}
