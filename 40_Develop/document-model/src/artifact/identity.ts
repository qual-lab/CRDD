/**
 * 文書の安定Identityに関する明示内容と出典を捕捉する。
 * @responsibility 共通ID文法・宣言・コードフェンス外リンクの観測を工程間の意味判断から分離する。
 * @trace ARCH-000008
 */

import { omitMarkdownFencedCode } from "./anchors.ts";

import { captureDocumentTableRows, parseMarkdownFences } from "./markdown.ts";
import type {
  ArtifactSource,
  DocumentIssue,
  DocumentTableRow,
  DocumentText,
  ParseResult,
} from "./types.ts";

/**
 * 観測済み成果物名の共通配置規則を照合する。
 * @responsibility 安定IDを本文に置く規則とEvidence名の文法だけを所有する。
 * @trace ARCH-000008
 * @input request: 相対Pathと対象名規則。
 * @returns 中立Issue。
 * @effect N/A: Filesystemへアクセスしない。
 * @security 対象範囲・実体の安全性はCallerが確認する。
 */
export function inspectArtifactPlacement(
  request: Readonly<{ path: string; kind: "filename" | "evidence_name" }>,
): readonly DocumentIssue[] {
  const name = request.path.split("/").at(-1) ?? "";
  const stableId = name.match(/\b(?:REQ|UX|IA|UI|SPEC)-\d{6}\b/gu)?.[0];
  if (request.kind === "filename")
    return stableId
      ? [
          {
            kind: "artifact.document-identity.stable-id-in-filename",
            targetIdentity: request.path,
            location: { path: request.path },
            reason: "stable-id-in-filename",
            details: { value0: stableId },
          },
        ]
      : [];
  if (request.kind !== "evidence_name")
    throw new Error("unknown_artifact_placement_kind");
  return /^\d{6}(?:-\d{4})?_[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d{2})?\.(?:md|json|tap|txt|log)$/u.test(
    name,
  )
    ? []
    : [
        {
          kind: "artifact.document-identity.noncanonical-evidence-filename",
          targetIdentity: request.path,
          location: { path: request.path },
          reason: "noncanonical-evidence-filename",
          details: {},
        },
      ];
}

/**
 * 原文から観測できたIdentityと宣言を保持する。
 * @responsibility raw出現・Fence除去後宣言・コードフェンス外リンクを区別する。
 * @trace ARCH-000008
 * @invariant 出現を定義所有・実在・認可の証明へ変換しない。
 */
export type IdentityDocument = Readonly<{
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  occurrences: readonly string[];
  declarations: readonly DocumentText[];
  manualRevisions: readonly DocumentText[];
  stableIdDefinitions: ReadonlyMap<string, readonly string[]>;
  links: readonly Readonly<{
    identity: string;
    target: string;
    source: DocumentText;
  }>[];
}>;

/**
 * 取得済み文書のIdentity内容を出典付きで受け付ける。
 * @responsibility 一般の明示宣言と手動改訂を解析し、工程固有の所有判断は行わない。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。
 * @returns 原文・内容モデルと既存の手動改訂Issueを分離したOutcome。
 * @precondition Fileの観測・対象選択は呼出し元が所有する。
 * @postcondition 重複・順序・raw／Fence境界・行番号を維持する。
 * @effect N/A: 取得済み値だけを扱う。
 * @failure 解析例外は伝播し、未知・不足を補完しない。
 * @invariant コメント除去や新しいID文法を追加しない。
 * @boundary 文書内容とIdentity観測の境界。
 * @security 所有・公開許可・品質成立を発行しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function captureArtifactIdentity(
  source: ArtifactSource,
): ParseResult<IdentityDocument> & { result: IdentityDocument } {
  const captured = { path: source.path, content: source.content };
  const text = captured.content,
    file = captured.path;
  const issues: DocumentIssue[] = [];
  const stableIdDefinitions = new Map<string, string[]>();
  const declarations: DocumentText[] = [];
  const manualRevisions: DocumentText[] = [];
  const meaningfulText = omitMarkdownFencedCode(text);
  for (const match of meaningfulText.matchAll(
    /\b(?:REQ|UX|IA|UI|SPEC)-\d{6}@\d+\b/gu,
  )) {
    manualRevisions.push({
      text: match[0],
      location: {
        path: file,
        line: meaningfulText.slice(0, match.index).split("\n").length,
      },
    });
    issues.push({
      kind: "artifact.document-identity.stable-id-manual-revision",
      targetIdentity: file,
      location: { path: file },
      reason: "stable-id-manual-revision",
      details: { value0: String(match[0]) },
    });
  }
  const definitionLines = meaningfulText.split(/\r?\n/u);
  for (let lineIndex = 0; lineIndex < definitionLines.length; lineIndex += 1) {
    const line = definitionLines[lineIndex] as string;
    const match =
      line.match(
        /^\s*(?:id|context_id):\s*((?:REQ|UX|IA|UI|SPEC)-\d{6})\s*$/u,
      ) ?? line.match(/^#{1,6}\s+((?:REQ|UX|IA|UI|SPEC)-\d{6})(?:\s|$)/u);
    if (!match) continue;
    const identity = match[1] as string;
    const definitions = stableIdDefinitions.get(identity) ?? [];
    definitions.push(`${file}:${lineIndex + 1}`);
    stableIdDefinitions.set(identity, definitions);
    declarations.push({
      text: identity,
      location: { path: file, line: lineIndex + 1 },
    });
  }
  const links: Array<
    Readonly<{ identity: string; target: string; source: DocumentText }>
  > = [];
  const markdown = parseMarkdownFences(
    text.replace(/^\uFEFF/u, "").split(/\r?\n/u),
  );
  for (const entry of markdown.entries) {
    if (!entry.outside) continue;
    for (const match of entry.text.matchAll(
      /\[\x60?((?:REQ|UX|IA|UI|SPEC)-[0-9]{6})\x60?\]\(([^)]+)\)/gu,
    ))
      links.push({
        identity: match[1] as string,
        target: match[2] as string,
        source: {
          text: match[0],
          location: { path: file, line: entry.index + 1 },
        },
      });
  }
  return {
    status: issues.length ? "partial" : "complete",
    result: {
      source: captured,
      tableRows: captureDocumentTableRows(captured),
      occurrences: Array.from(
        text.matchAll(/\b(?:REQ|UX|IA|UI|SPEC)-\d{6}\b/gu),
        (match) => match[0],
      ),
      declarations,
      manualRevisions,
      stableIdDefinitions,
      links,
    },
    issues,
  };
}
