/**
 * 工程ひな型の基本図処置表を検査する。
 *
 * @responsibility 既存七Profileの対象Path・図名・列・処置語彙と本文契約を所有する。
 * @trace ARCH-000008
 * @boundary N/A: 与えられた本文だけを検査しFilesystem・Checkerへ依存しない。
 * @effect N/A: 外部I/O・共有状態変更を行わない。
 * @security 図の実在・品質や対象Fileの存在を保証せず、ひな型の処置表契約だけを検査する。
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";

const phaseDiagramDispositions = [
  "`作成`",
  "`既存参照`",
  "`非該当`",
  "`作成不能`",
] as const;
const phaseDiagramTemplateProfiles = new Map<string, readonly string[]>([
  [
    "template/01_Discovery/01_Product_Discovery.md",
    [
      "課題・根拠・機会の関係",
      "業務範囲／入出力（SIPOC）",
      "担い手別の仕事の流れ（Swimlane）",
      "価値が届くまでの流れ",
      "現状／変更後",
      "項目間全体像",
    ],
  ],
  [
    "template/02_UX/01_User_Experience.md",
    ["利用の流れ", "重要場面・失敗／回復体験図", "サービス提供の流れ"],
  ],
  [
    "template/03_IA/01_Information_Architecture.md",
    [
      "オブジェクト／関係図",
      "情報階層図",
      "Navigation図",
      "可視性／状態概念図",
    ],
  ],
  [
    "template/04_UI/01_User_Interface.md",
    [
      "論理画面／領域構成図",
      "画面／操作Flow",
      "表示状態／Variant図",
      "主要Component関係図",
      "UI／SPEC対応図",
    ],
  ],
  [
    "template/05_SPEC/01_Behavior_Specification.md",
    [
      "Use Case／振る舞いFlow",
      "状態遷移表／状態遷移図",
      "Actor／System間Sequence図",
      "Error／Effect分岐図",
      "UI／SPEC対応図",
    ],
  ],
  [
    "template/06_Architecture/01_Architecture.md",
    [
      "全体／内部ブロック図",
      "状態遷移表／状態遷移図",
      "ブロック間シーケンス図",
      "クラス／型関係図",
      "データフロー図（DFD）",
      "エンティティ関係図（ER図）",
      "スキーマ責務図（Schema Responsibility Map）",
    ],
  ],
  [
    "template/07_Quality/03_Verification_Design.md",
    [
      "検証義務・試験Level／Boundary対応図",
      "状態・分岐・Block別Coverage図",
      "検証結果・判断接続図",
    ],
  ],
]);

/**
 * 検査対象となる既存七ひな型のPathを公開する。
 *
 * @responsibility Checkerが本文を取得する対象と従来の走査順を示す。
 * @trace ARCH-000008
 * @invariant 配列を凍結し、内部Profileを外部へ公開しない。
 * @security Path列は存在・認可・読取り可能性を表さない。
 */
export const phaseDiagramTemplatePaths: readonly string[] = Object.freeze([
  ...phaseDiagramTemplateProfiles.keys(),
]);

/**
 * 渡された既知ひな型の処置表契約を検査する。
 *
 * @responsibility 既存判定順の不足項目を一不正Source一Issueで返す。
 * @trace ARCH-000008
 * @input sources: Pathと本文の取得済み集合。
 * @returns 入力順の中立Issue。未知Pathと適合本文はIssueを生成しない。
 * @precondition Fileの選択・観測・official適用判断は呼出し元が所有する。
 * @postcondition 元PathをIdentityと位置に保持し、不足項目の順序・重複を維持する。
 * @effect N/A: 入力読取りと局所計算だけを行う。
 * @failure 既知本文の不備をcontract_incompleteのIssueで返す。
 * @invariant 入力・共有Profileを変更しない。
 * @boundary N/A: 同一Process内の純粋計算である。
 * @security 空Issue列は七Fileの存在や図の品質全体の成立を意味しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
export function inspectPhaseDiagramTemplates(
  sources: readonly ArtifactSource[],
): readonly DomainIssue[] {
  const expectedHeaders = [
    "基本図",
    "対象",
    "目的",
    "処置",
    "現行図／一意な参照／理由",
    "投影元改訂版",
    "現在状態",
    "未確認範囲",
    "次の処置・再評価契機",
  ];
  const allowedDispositions = new Set([
    "",
    "作成",
    "既存参照",
    "非該当",
    "作成不能",
  ]);
  const cells = (line: string): string[] =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`|`$/gu, ""));
  const issues: DomainIssue[] = [];
  for (const source of sources) {
    const relativePath = source.path;
    const diagrams = phaseDiagramTemplateProfiles.get(relativePath);
    if (diagrams === undefined) continue;
    const content = source.content;
    const missingItems: string[] = [];
    if (
      relativePath === "template/01_Discovery/01_Product_Discovery.md" &&
      (!content.includes("## 人間理解の確認") ||
        !content.includes("| 発火判定と理由 |") ||
        !content.includes("| 人間の確認または修正 |"))
    )
      missingItems.push("human-understanding-confirmation");
    const sectionHeading = /^## (?:[0-9]+\.\s+)?基本図の処置$/mu.exec(content);
    const sectionStart = sectionHeading?.index ?? -1;
    if (sectionStart < 0) missingItems.push("section");
    for (const disposition of phaseDiagramDispositions)
      if (!content.includes(disposition)) missingItems.push(disposition);
    const section = sectionStart < 0 ? "" : content.slice(sectionStart);
    const lines = section.split(/\r?\n/u);
    const headerIndex = lines.findIndex((line) =>
      line.startsWith("| 基本図 |"),
    );
    const headerCells = headerIndex < 0 ? [] : cells(lines[headerIndex] ?? "");
    if (
      headerCells.length !== expectedHeaders.length ||
      headerCells.some((value, index) => value !== expectedHeaders[index])
    )
      missingItems.push("header");
    const rows = new Map<string, string[]>();
    if (headerIndex >= 0) {
      for (const line of lines.slice(headerIndex + 2)) {
        if (!line.startsWith("|")) break;
        const rowCells = cells(line);
        if (rowCells[0]) rows.set(rowCells[0], rowCells);
      }
    }
    for (const diagram of diagrams) {
      const rowCells = rows.get(diagram);
      if (!rowCells) {
        missingItems.push(diagram);
        continue;
      }
      if (rowCells.length !== expectedHeaders.length)
        missingItems.push(`${diagram}:columns`);
      const disposition = rowCells[3] ?? "";
      if (!allowedDispositions.has(disposition))
        missingItems.push(`${diagram}:disposition=${disposition}`);
    }
    if (missingItems.length > 0)
      issues.push({
        kind: "artifact.phase-diagram.contract-invalid",
        targetIdentity: relativePath,
        location: { path: relativePath },
        reason: "contract_incomplete",
        details: { missingItems: missingItems.join(", ") },
      });
  }
  return issues;
}
