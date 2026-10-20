/**
 * Semantic検査のRepository入力とDomain結果を接続する。
 * @responsibility 観測順・観測不能時の停止・CompileとGraphの結果接続を所有する。
 * @trace ARCH-000008
 */
import {
  compileQualitySemanticRelations as compileDomainQualitySemanticRelations,
  type QualitySemanticRelation,
  compileSemanticIr as compileDomainSemanticIr,
  type SemanticIr,
  createSemanticCoverageGraph as createDomainSemanticCoverageGraph,
  type SemanticCoverageGraph,
  type LoadedRealitySymbolManifest,
  createFilesystemRepositoryObservationPort,
} from "../../../domain-model/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";
import { mapSemanticDomainIssueToDiagnostic } from "../report/semantic.ts";
import type { SemanticCoverageDiagnostic } from "../report/types.ts";
/**
 * Repositoryから観測したSemantic Source文書を表す。
 *
 * @responsibility 観測Pathと同じ観測で得た本文を結合する。
 * @trace ARCH-000008
 * @shape SemanticSourceDocumentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticSourceDocumentで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticSourceDocumentの宣言は外部境界を開かない。
 * @security N/A: SemanticSourceDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticSourceDocumentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SemanticSourceDocument = Readonly<{ path: string; source: string }>;

/**
 * 検証済みRepository Rootから指定文書集合を観測する。
 *
 * @responsibility 読取り成功文書と観測不能Diagnosticを同じBatch結果へ分ける。
 * @trace ARCH-000008
 * @input capability: VerifiedRepositoryRoot、paths: readonly string[]
 * @returns Readonly<{ documents: readonly SemanticSourceDocument[]; findings: readonly SemanticCoverageDiagnostic[]; }>を返す。
 * @precondition capability: VerifiedRepositoryRoot、paths: readonly string[]がobserveDocumentsの入力契約を満たす。
 * @postcondition observeDocumentsの責務を完了した結果だけを返す。
 * @effect 検証済みRepository内の指定文書を既存の有界Observerで読み取る。書込みは行わない。
 * @failure N/A: observeDocumentsは独自の失敗分岐を所有しない。
 * @invariant observeDocumentsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Repository Observation Portとの読取り境界。
 * @security N/A: observeDocumentsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observeDocumentsは共有非同期状態を持たない同期処理である。
 */
function observeDocuments(
  capability: VerifiedRepositoryRoot,
  paths: readonly string[],
): Readonly<{
  documents: readonly SemanticSourceDocument[];
  findings: readonly SemanticCoverageDiagnostic[];
}> {
  const repository = createFilesystemRepositoryObservationPort(capability);
  const documents: SemanticSourceDocument[] = [];
  const findings: SemanticCoverageDiagnostic[] = [];
  for (const path of paths) {
    const observed = repository.observeFile(path);
    if (observed.status === "resolved")
      documents.push({ path, source: observed.source });
    else
      findings.push({
        code: "semantic-source-unobservable",
        path,
        message: observed.reason,
      });
  }
  return { documents, findings };
}

/**
 * Repository文書を観測してSemantic IRへ変換する。
 *
 * @responsibility 観測不能とDomain変換失敗を同じDiagnostic契約へ投影する。
 * @trace ARCH-000008
 * @input capability: VerifiedRepositoryRoot、sourceDocument: string、subsystem: string、architectureDefinitionIds: ReadonlySet<string>
 * @returns compileSemanticIrFromRepositoryの計算結果を返す。
 * @precondition capability: VerifiedRepositoryRoot、sourceDocument: string、subsystem: string、architectureDefinitionIds: ReadonlySet<string>がcompileSemanticIrFromRepositoryの入力契約を満たす。
 * @postcondition compileSemanticIrFromRepositoryの責務を完了した結果だけを返す。
 * @effect 検証済みRepository内の指定文書を読み取る。書込みは行わない。
 * @failure N/A: compileSemanticIrFromRepositoryは独自の失敗分岐を所有しない。
 * @invariant compileSemanticIrFromRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済みRepository入力とSemantic Compilerの境界。
 * @security N/A: compileSemanticIrFromRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: compileSemanticIrFromRepositoryは共有非同期状態を持たない同期処理である。
 */
export function compileSemanticIrFromRepository(
  capability: VerifiedRepositoryRoot,
  sourceDocument: string,
  subsystem: string,
  architectureDefinitionIds: ReadonlySet<string>,
) {
  const observed = observeDocuments(capability, [sourceDocument]);
  const [document] = observed.documents;
  if (!document) return { ir: null, findings: observed.findings };
  const outcome = compileDomainSemanticIr(
    document,
    subsystem,
    architectureDefinitionIds,
  );
  return {
    ir: outcome.result,
    findings: outcome.issues.map(mapSemanticDomainIssueToDiagnostic),
  };
}

/**
 * Quality Definition群を観測してSemantic Relationへ変換する。
 *
 * @responsibility 一つでも観測不能な入力がある場合に部分Relationを返さない。
 * @trace ARCH-000008
 * @input capability: VerifiedRepositoryRoot、sourceDocuments: readonly string[]、semanticIrs: readonly SemanticIr[]
 * @returns compileQualitySemanticRelationsFromRepositoryの計算結果を返す。
 * @precondition capability: VerifiedRepositoryRoot、sourceDocuments: readonly string[]、semanticIrs: readonly SemanticIr[]がcompileQualitySemanticRelationsFromRepositoryの入力契約を満たす。
 * @postcondition compileQualitySemanticRelationsFromRepositoryの責務を完了した結果だけを返す。
 * @effect 検証済みRepository内の指定Quality文書を読み取る。書込みは行わない。
 * @failure N/A: compileQualitySemanticRelationsFromRepositoryは独自の失敗分岐を所有しない。
 * @invariant compileQualitySemanticRelationsFromRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Repository入力とQuality Relation Compilerの境界。
 * @security N/A: compileQualitySemanticRelationsFromRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: compileQualitySemanticRelationsFromRepositoryは共有非同期状態を持たない同期処理である。
 */
export function compileQualitySemanticRelationsFromRepository(
  capability: VerifiedRepositoryRoot,
  sourceDocuments: readonly string[],
  semanticIrs: readonly SemanticIr[],
) {
  const observed = observeDocuments(capability, sourceDocuments);
  if (observed.findings.length > 0)
    return { relations: null, findings: observed.findings };
  const outcome = compileDomainQualitySemanticRelations(
    observed.documents,
    semanticIrs,
  );
  return {
    relations: outcome.result,
    findings: outcome.issues.map(mapSemanticDomainIssueToDiagnostic),
  };
}

/**
 * 前提診断を確認してApplication向けCoverage Graph結果を生成する。
 *
 * @responsibility Domain Issueを公開Diagnosticへ変換し、部分Graphを公開しない。
 * @trace ARCH-000008
 * @input semanticIrs: readonly SemanticIr[]、manifests: readonly LoadedRealitySymbolManifest[]、qualityRelations: readonly QualitySemanticRelation[]、prerequisiteFindings: readonly SemanticCoverageDiagnostic[]
 * @returns Readonly<{ graph: SemanticCoverageGraph | null; findings: readonly SemanticCoverageDiagnostic[]; }>を返す。
 * @precondition Semantic IR、Symbol Manifest、Quality Relationと前提診断がそれぞれの入力契約を満たす。
 * @postcondition Graph構築結果のIssueを公開Diagnosticへ変換して返す。
 * @effect N/A: 入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 前提診断がある場合はGraphを返さず、診断を保持する。
 * @invariant 診断のある結果を完全なGraphとして公開しない。
 * @boundary Graph構築の中立結果と利用側向け診断の変換境界。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: 共有非同期状態を持たない同期処理である。
 */
export function createSemanticCoverageGraphResult(
  semanticIrs: readonly SemanticIr[],
  manifests: readonly LoadedRealitySymbolManifest[],
  qualityRelations: readonly QualitySemanticRelation[],
  prerequisiteFindings: readonly SemanticCoverageDiagnostic[],
): Readonly<{
  graph: SemanticCoverageGraph | null;
  findings: readonly SemanticCoverageDiagnostic[];
}> {
  if (prerequisiteFindings.length > 0)
    return { graph: null, findings: prerequisiteFindings };
  const outcome = createDomainSemanticCoverageGraph(
    semanticIrs,
    manifests,
    qualityRelations,
    [],
  );
  return {
    graph: outcome.result,
    findings: outcome.issues.map(mapSemanticDomainIssueToDiagnostic),
  };
}
