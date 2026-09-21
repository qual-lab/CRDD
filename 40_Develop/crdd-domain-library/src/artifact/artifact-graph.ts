/**
 * artifact-graphに属する責務をまとめる。
 *
 * @responsibility ArtifactGraphを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { ArtifactModel } from "./artifact-model.ts";
import type { DomainIssue, DomainOutcome } from "../outcome.ts";

/**
 * artifact-graphで使用するArtifact Graphの値契約を定義する。
 *
 * @responsibility Artifact GraphのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactGraphが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactGraphで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactGraphの宣言は外部境界を開かない。
 * @security N/A: ArtifactGraphはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactGraphの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactGraph = Readonly<{
  artifactsById: ReadonlyMap<string, ArtifactModel>;
  incoming: ReadonlyMap<string, readonly ArtifactModel[]>;
}>;

/**
 * artifact-graphで使用するBuild Artifact Graph Requestの値契約を定義する。
 *
 * @responsibility Build Artifact Graph RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape BuildArtifactGraphRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant BuildArtifactGraphRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: BuildArtifactGraphRequestの宣言は外部境界を開かない。
 * @security N/A: BuildArtifactGraphRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility BuildArtifactGraphRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type BuildArtifactGraphRequest = Readonly<{
  artifacts: readonly ArtifactModel[];
}>;

/**
 * artifact-graphで使用するArtifact Graph 結果の値契約を定義する。
 *
 * @responsibility Artifact Graph 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactGraphResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactGraphResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactGraphResultの宣言は外部境界を開かない。
 * @security N/A: ArtifactGraphResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactGraphResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactGraphResult = DomainOutcome<ArtifactGraph>;

/**
 * Artifact Graphを構築する。
 *
 * @responsibility Artifact Graphの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input request: BuildArtifactGraphRequest
 * @returns ArtifactGraphResultを返す。
 * @precondition 「request: BuildArtifactGraphRequest」がbuildArtifactGraphの入力契約を満たす。
 * @postcondition buildArtifactGraphの責務を完了した結果だけを返す。
 * @effect N/A: buildArtifactGraphは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: buildArtifactGraphは独自の失敗分岐を所有しない。
 * @invariant buildArtifactGraphは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: buildArtifactGraphはProcess内の同一Subsystemで完結する。
 * @security N/A: buildArtifactGraphはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: buildArtifactGraphは共有非同期状態を持たない同期処理である。
 */
export function buildArtifactGraph(
  request: BuildArtifactGraphRequest,
): ArtifactGraphResult {
  const issues: DomainIssue[] = [];
  const artifactsById = new Map<string, ArtifactModel>();
  const incoming = new Map<string, ArtifactModel[]>();
  for (const artifact of request.artifacts) {
    if (!artifact.canonicalId) continue;
    if (artifactsById.has(artifact.canonicalId))
      issues.push({
        kind: "artifact.relation.canonical-id-duplicate",
        targetIdentity: artifact.canonicalId,
        location: artifact.sourceLocation,
        reason: "canonical_identity_not_unique",
        details: { canonicalId: artifact.canonicalId },
      });
    else artifactsById.set(artifact.canonicalId, artifact);
  }
  for (const artifact of request.artifacts)
    for (const relation of artifact.relations) {
      if (!artifactsById.has(relation.target)) continue;
      const sources = incoming.get(relation.target) ?? [];
      sources.push(artifact);
      incoming.set(relation.target, sources);
    }
  return {
    status: issues.length === 0 ? "complete" : "partial",
    result: { artifactsById, incoming },
    issues,
  };
}
