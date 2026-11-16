/**
 * Communication文書の明示内容と配布ひな型契約を所有する。
 * @responsibility 原文・出典・節を保持し、適用判断そのものは行わない。
 * @trace ARCH-000008
 */

import { inspectTemplateApplicability } from "../artifact/document-header.ts";
import { captureDocumentSections } from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentSection,
  ParseResult,
} from "../artifact/types.ts";

/**
 * Communicationの取得済み文書。
 * @responsibility 人間の採用判断と本文の明示宣言を区別する。
 * @trace ARCH-000008
 */
export type CommunicationDocument = Readonly<{
  source: ArtifactSource;
  artifact: ArtifactModel;
  sections: readonly DocumentSection[];
}>;

/**
 * Communication文書を解析する。
 * @responsibility 局所ひな型Issueと部分モデルを返す。
 * @trace ARCH-000008
 * @input source: 取得済み本文。options: 明示したひな型モード。
 * @returns 内容と局所Issue。
 * @effect N/A: 外部I/Oなし。
 * @failure 解析例外を伝播する。
 * @security 認可・適用判断・公開判断を行わない。
 */
export function parseCommunication(
  source: ArtifactSource,
  options: Readonly<{ mode?: "template" }> = {},
): ParseResult<CommunicationDocument> & { result: CommunicationDocument } {
  const captured = { path: source.path, content: source.content };
  const artifact = parseMarkdownArtifact(captured);
  const result = {
    source: captured,
    artifact,
    sections: ["認知意図", "市場・採用探索", "人間対象調査"].flatMap(
      (heading) => captureDocumentSections(captured, heading),
    ),
  };
  const issues =
    options.mode === "template"
      ? inspectTemplateApplicability(
          captured,
          [
            "## 認知意図",
            "## 市場・採用探索",
            "## 人間対象調査",
            "適用判定: `<Applicable／N/A: 理由／OPEN: 理由・確認先・再評価契機>`",
          ],
          [
            "## 認知意図（該当する場合）",
            "## 市場・採用探索（該当する場合）",
            "必要に応じて分けた",
          ],
        )
      : [];
  return { status: issues.length ? "partial" : "complete", result, issues };
}
