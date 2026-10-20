/**
 * 読取り済み成果物の解析・Schema・関係Graphを同じ順序で検査する。
 *
 * @responsibility 既存のモデル生成と中立Issueの順序を所有し、表示・Rule登録・実行基盤を持たない。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import { buildArtifactGraph, type ArtifactGraph } from "./graph.ts";
import { parseMarkdownArtifact } from "./parse-markdown.ts";
import type { ArtifactModel, ArtifactSource } from "./types.ts";
import {
  validateArtifactSchema,
  type ArtifactSchema,
} from "./validate-schema.ts";

/**
 * 本文を解析し、指定Schemaと成果物間の関係を検査する。
 *
 * @responsibility Source順の解析、適用Schema順のIssue、Graph Issueの合成を行う。
 * @trace ARCH-000008
 * @input input: 読取り済みSourceと、呼出し元が明示した既存Schema。
 * @returns 解析済み成果物、利用可能なGraph、中立Issueの列。
 * @precondition Root・適用対象・本文の取得は呼出し元が完了している。
 * @postcondition invalidなSchema結果とpartialなGraphのIssueを落とさず、Graphがある場合だけ返す。
 * @effect N/A: 入力と局所モデルだけを扱い、File・Process・登録処理を持たない。
 * @failure Parser・Schemaの例外を伝播し、Graph欠落は既存のartifact_graph_result_missingで拒否する。
 * @invariant 表示語彙・品質採用判断・CLI固有の終了値を持たない。
 * @boundary N/A: 同一Process内の純粋なモデル検査。
 * @security 検査結果をRoot認可や品質Passへ変換しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理。
 */
export function inspectArtifactSources(
  input: Readonly<{
    sources: readonly ArtifactSource[];
    schemas?: readonly ArtifactSchema[];
  }>,
): Readonly<{
  artifacts: readonly ArtifactModel[];
  graph: ArtifactGraph;
  issues: readonly DomainIssue[];
}> {
  const artifacts = input.sources.map(parseMarkdownArtifact);
  const issues: DomainIssue[] = [];
  for (const artifact of artifacts)
    for (const schema of input.schemas ?? [])
      if (schema.matches(artifact))
        issues.push(...validateArtifactSchema(artifact, schema).issues);
  const graphOutcome = buildArtifactGraph({ artifacts });
  issues.push(...graphOutcome.issues);
  const graph = graphOutcome.result;
  if (!graph) throw new Error("artifact_graph_result_missing");
  return { artifacts, graph, issues };
}
