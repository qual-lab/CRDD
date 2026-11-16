/**
 * Qualityひな型の原文・構造と必須表現の出現を所有する。
 * @responsibility 取得済み本文から内容モデルを構築し、種類別の既存受理条件を評価する。
 * @trace ARCH-000008
 */
import {
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentTableRow,
  DocumentText,
} from "../artifact/types.ts";

/**
 * Qualityひな型の内容と局所的な必須表現の充足を保持する。
 * @responsibility 原文と検査用本文を区別し、不足と重複出現を失わない。
 * @trace ARCH-000008
 * @invariant validは固定表現の充足のみで、品質Gate・認可・実在を証明しない。
 */
export type QualityTemplate = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  kind: "verification_result" | "analysis" | "integration";
  tableRows: readonly DocumentTableRow[];
  evaluatedContent: string;
  requirements: readonly Readonly<{
    text: string;
    occurrences: readonly DocumentText[];
  }>[];
  valid: boolean;
}>;

/**
 * 三種類のQualityひな型を原文と出典付きで受け付ける。
 * @responsibility 検証結果はraw、分析・統合は可視本文の旧substring条件を適用する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。kind: 既存の三種類のひな型。
 * @returns 不足時も原文・全表・期待表現と全出現を保持する内容モデル。
 * @precondition Filesystemの観測と種類選択は呼出し元が行う。
 * @postcondition 入力を変更せず、別のChecklist受付や読取りを統合しない。
 * @effect N/A: 同期的な値処理のみ。
 * @failure 未知kindは拒否し、解析例外は伝播する。
 * @invariant 節限定・正規化・列検査・重複拒否を追加しない。
 * @boundary 取得済み本文とQualityひな型モデルの境界。
 * @security 品質全体の成立・Authorityを発行しない。
 * @concurrency N/A: 局所値だけを扱う。
 */
export function captureQualityTemplate(
  source: ArtifactSource,
  kind: QualityTemplate["kind"],
): QualityTemplate {
  if (
    kind !== "verification_result" &&
    kind !== "analysis" &&
    kind !== "integration"
  )
    throw new Error("unknown_quality_template_kind");
  const captured = { path: source.path, content: source.content };
  const evaluatedContent =
    kind === "verification_result"
      ? captured.content
      : omitMarkdownCommentsAndFencedCode(captured.content);
  const requiredTexts =
    kind === "verification_result"
      ? [
          "### 必須の適用判断",
          "| 評価対象 | 判定 | 内容／理由 | 根拠／再評価契機 |",
          ...[
            "安全上重要な層間搬送",
            "耐久状態のAuthority分類",
            "発行前失敗／発行後失敗／retry",
            "残存資源／Recovery",
            "根拠の主張軸（入口形態）",
            "根拠の主張軸（観測基盤）",
            "根拠の主張軸（成果物Identity）",
            "根拠の主張軸（lifecycle）",
            "性能試験（PT）",
            "負荷試験（LT）",
            "人間による判断",
          ].map((item) => `| ${item} | Applicable／N/A／OPEN |`),
        ]
      : kind === "analysis"
        ? ["Source Layer", "Definition／Detail", "導出元／Relation"]
        : [
            "## 3. Definition／Detail入力の統合",
            "Source Layer",
            "Same／New／Merge",
          ];
  const requirements = requiredTexts.map((text) => {
    const occurrences: DocumentText[] = [];
    let offset = evaluatedContent.indexOf(text);
    while (offset >= 0) {
      occurrences.push({
        text,
        location: {
          path: captured.path,
          line: evaluatedContent.slice(0, offset).split("\n").length,
        },
      });
      offset = evaluatedContent.indexOf(text, offset + 1);
    }
    return { text, occurrences };
  });
  return {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    kind,
    tableRows: captureDocumentTableRows(captured),
    evaluatedContent,
    requirements,
    valid: requirements.every(
      (requirement) => requirement.occurrences.length > 0,
    ),
  };
}
