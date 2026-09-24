/**
 * checker-pipelineに属する責務をまとめる。
 *
 * @responsibility CheckerPipelineResultを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */
import {
  type ArtifactModel,
  type ArtifactSchema,
  type ArtifactSource,
  parseMarkdownArtifact,
  validateArtifactSchema,
} from "../../../crdd-domain-library/src/artifact/index.ts";
import {
  type ArtifactGraph,
  buildArtifactGraph,
} from "../../../crdd-domain-library/src/artifact/index.ts";
import { mapArtifactDomainIssueToCheckerFinding } from "../adapters/artifact-relation.ts";
import {
  createFindingCollector,
  type CheckerFinding,
} from "../findings/finding-model.ts";
import { RuleRegistry } from "../rules/rule-registry.ts";

/**
 * checker-pipelineで使用するChecker Pipeline 結果の値契約を定義する。
 *
 * @responsibility Checker Pipeline 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape CheckerPipelineResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckerPipelineResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerPipelineResultの宣言は外部境界を開かない。
 * @security N/A: CheckerPipelineResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerPipelineResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerPipelineResult = Readonly<{
  artifacts: readonly ArtifactModel[];
  graph: ArtifactGraph;
  findings: readonly CheckerFinding[];
}>;

/**
 * Checker Pipelineを実行する。
 *
 * @responsibility Checker Pipelineの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000001
 * @input input: Readonly<{ sources: readonly ArtifactSource[]; schemas?: readonly ArtifactSchema[]; registry?: RuleRegistry; }>
 * @returns CheckerPipelineResultを返す。
 * @precondition 「input: Readonly<{ sources: readonly ArtifactSource[]; schemas?: readonly ArtifactSchema[]; registry?: RuleRegistry; }>」がrunCheckerPipelineの入力契約を満たす。
 * @postcondition runCheckerPipelineの責務を完了した結果だけを返す。
 * @effect N/A: runCheckerPipelineは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runCheckerPipelineは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCheckerPipelineは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCheckerPipelineはProcess内の同一Subsystemで完結する。
 * @security N/A: runCheckerPipelineはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runCheckerPipelineは共有非同期状態を持たない同期処理である。
 */
export function runCheckerPipeline(
  input: Readonly<{
    sources: readonly ArtifactSource[];
    schemas?: readonly ArtifactSchema[];
    registry?: RuleRegistry;
  }>,
): CheckerPipelineResult {
  const collector = createFindingCollector();
  const artifacts = input.sources.map(parseMarkdownArtifact);
  for (const artifact of artifacts)
    for (const schema of input.schemas ?? [])
      if (schema.matches(artifact))
        for (const issue of validateArtifactSchema(artifact, schema).issues)
          collector.add(mapArtifactDomainIssueToCheckerFinding(issue));
  const graphOutcome = buildArtifactGraph({ artifacts });
  for (const issue of graphOutcome.issues)
    collector.add(mapArtifactDomainIssueToCheckerFinding(issue));
  const graph = graphOutcome.result;
  if (!graph) throw new Error("artifact_graph_result_missing");
  const registry = input.registry ?? new RuleRegistry();
  const context = { artifacts, graph, add: collector.add };
  registry.executeStage("cross-artifact-validation", context);
  registry.executeStage("special-rules", context);
  return { artifacts, graph, findings: collector.findings };
}
