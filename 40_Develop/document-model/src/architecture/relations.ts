/**
 * Architecture登録表の内容と出現を捕捉する。
 * @responsibility 定義と入力参照の全出現を保持し、外部集合との比較を行わない。
 * @trace ARCH-000008
 */

import {
  captureDocumentSections,
  captureDocumentTableRows,
  omitMarkdownCommentsAndFencedCode,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactModel,
  ArtifactSource,
  DocumentSection,
  DocumentTableRow,
  DocumentText,
} from "../artifact/types.ts";
/**
 * Architecture登録表の定義・関係と出現列を表す。
 * @responsibility Architecture登録表の定義・関係と出現列を表す。
 * @trace ARCH-000008
 * @shape 原文、Artifact、全表行、台帳節・登録行と既存関係投影。
 * @invariant 集合と出現配列を区別し、重複を失わない。
 * @boundary N/A: 取得済み値モデル。
 * @security 認可・実在・完成を保証しない。
 * @compatibility 現行の関係照合条件を維持する。
 */
export type ArchitectureRegistryModel = Readonly<{
  artifact: ArtifactModel;
  source: ArtifactSource;
  tableRows: readonly DocumentTableRow[];
  sections: readonly DocumentSection[];
  entries: readonly Readonly<{
    definition: string;
    inputs: readonly string[];
    source: DocumentText;
  }>[];
  definitions: ReadonlySet<string>;
  definitionEntries: readonly string[];
  relations: ReadonlySet<string>;
  relationEntries: readonly string[];
}>;

/**
 * Architectureの指定Sectionを解析する。
 * @responsibility Architectureの指定Sectionを解析する。
 * @trace ARCH-000008
 * @input source: 可視本文。heading: 対象見出し。
 * @returns 最初の一致から次の第二階層見出しまでの本文。
 * @precondition 呼出し元が対象の可視本文を取得している。
 * @postcondition 最初の見出し区画だけを返し、一致しなければ空文字を返す。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 最初の一致と既存見出し境界を維持する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const _sectionBody = (source: string, heading: string): string => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    source.match(
      new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
    )?.[1] ?? ""
  );
};

/**
 * Architecture登録表の定義と入力関係を解析する。
 * @responsibility Architecture登録表の定義と入力関係を解析する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。
 * @returns 原文・出典・部分内容、集合と出現配列を保持する登録モデル。
 * @precondition 呼出し元が従来位置で対象値と診断位置を取得している。
 * @postcondition 入力を変更せず既存条件の結果を返す。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播し、不明を正常値で補完しない。
 * @invariant 各行の最初の定義Linkに、その行の全UI／SPEC出現を対応付ける。
 * @boundary N/A: Architectureの取得済み本文・集合。
 * @security 実在・認可・工程全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function captureArchitectureRegistry(
  source: ArtifactSource,
): ArchitectureRegistryModel {
  const captured = { path: source.path, content: source.content };
  const visible = {
    path: captured.path,
    content: omitMarkdownCommentsAndFencedCode(captured.content),
  };
  const sections = captureDocumentSections(visible, "Architecture定義台帳");
  const registrySection = sections[0]?.body;
  const entries: Array<ArchitectureRegistryModel["entries"][number]> = [];
  const registryDefinitions = new Set<string>();
  const registryDefinitionEntries: string[] = [];
  const registryRelationEntries: string[] = [];
  for (const [index, line] of (registrySection?.text ?? "")
    .split(/\r?\n/u)
    .entries()) {
    const definition = line.match(
      /\]\(Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/u,
    )?.[1];
    if (!definition) continue;
    registryDefinitionEntries.push(definition);
    registryDefinitions.add(definition);
    const inputs = [...line.matchAll(/(?:UI|SPEC)-[0-9]{6}/gu)].map(
      (input) => input[0],
    );
    entries.push({
      definition,
      inputs,
      source: {
        text: line,
        location: {
          path: captured.path,
          line: (registrySection?.location.line ?? 1) + index,
        },
      },
    });
    for (const input of inputs)
      registryRelationEntries.push(`${input}|${definition}`);
  }
  const registryRelations = new Set(registryRelationEntries);

  return {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(visible),
    sections,
    entries,
    definitions: registryDefinitions,
    definitionEntries: registryDefinitionEntries,
    relations: registryRelations,
    relationEntries: registryRelationEntries,
  };
}
