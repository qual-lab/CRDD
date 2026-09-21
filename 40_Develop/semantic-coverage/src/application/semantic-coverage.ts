import {
  compileQualitySemanticRelations as compileDomainQualitySemanticRelations,
  compileSemanticIr as compileDomainSemanticIr,
  type QualitySemanticRelation,
  type SemanticIr,
} from "../compilation/index.ts";
import {
  createSemanticCoverageGraph as createDomainSemanticCoverageGraph,
  type SemanticCoverageGraph,
} from "../coverage/index.ts";
import type { LoadedRealitySymbolManifest } from "../../../crdd-domain-library/src/reality-traceability/index.ts";
import type { DomainIssue } from "../../../crdd-domain-library/src/index.ts";
import { createFilesystemRepositoryObservationPort } from "../../../crdd-domain-library/src/repository-observation/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";

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
 * Domain Issueを利用側へ返す診断形式を表す。
 *
 * @responsibility 安定code、Pathおよび人間向けmessageを保持する。
 * @trace ARCH-000008
 * @shape SemanticCoverageDiagnosticが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticCoverageDiagnosticで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticCoverageDiagnosticの宣言は外部境界を開かない。
 * @security N/A: SemanticCoverageDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticCoverageDiagnosticの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticCoverageDiagnostic = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

/**
 * Domain Issueから必須の文字列Detailを取得する。
 *
 * @responsibility 不正なIssue shapeを診断変換前に拒否する。
 * @trace ARCH-000008
 * @input issue: DomainIssue、name: string
 * @returns stringを返す。
 * @precondition issue: DomainIssue、name: stringがstringDetailの入力契約を満たす。
 * @postcondition stringDetailの責務を完了した結果だけを返す。
 * @effect N/A: stringDetailは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 欠落または空文字列を既定値へ畳まない。
 * @invariant stringDetailは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringDetailはProcess内の同一Subsystemで完結する。
 * @security N/A: stringDetailはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stringDetailは共有非同期状態を持たない同期処理である。
 */
function stringDetail(issue: DomainIssue, name: string): string {
  const value = issue.details[name];
  if (typeof value !== "string" || value.length === 0)
    throw new Error(
      `invalid_semantic_domain_issue_detail:${issue.kind}:${name}`,
    );
  return value;
}

/**
 * Domain Issueから必須の数値Detailを取得する。
 *
 * @responsibility 不正なIssue shapeを診断変換前に拒否する。
 * @trace ARCH-000008
 * @input issue: DomainIssue、name: string
 * @returns numberを返す。
 * @precondition issue: DomainIssue、name: stringがnumberDetailの入力契約を満たす。
 * @postcondition numberDetailの責務を完了した結果だけを返す。
 * @effect N/A: numberDetailは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 非数値を変換または既定値へ畳まない。
 * @invariant numberDetailは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: numberDetailはProcess内の同一Subsystemで完結する。
 * @security N/A: numberDetailはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: numberDetailは共有非同期状態を持たない同期処理である。
 */
function numberDetail(issue: DomainIssue, name: string): number {
  const value = issue.details[name];
  if (typeof value !== "number")
    throw new Error(
      `invalid_semantic_domain_issue_detail:${issue.kind}:${name}`,
    );
  return value;
}

/**
 * 閉じたDomain Issue集合を公開Diagnosticへ変換する。
 *
 * @responsibility Issue kindごとの安定codeと必要Detailを一意に決める。
 * @trace ARCH-000008
 * @input issue: DomainIssue
 * @returns SemanticCoverageDiagnosticを返す。
 * @precondition issue: DomainIssueがmapSemanticDomainIssueToDiagnosticの入力契約を満たす。
 * @postcondition mapSemanticDomainIssueToDiagnosticの責務を完了した結果だけを返す。
 * @effect N/A: mapSemanticDomainIssueToDiagnosticは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 未知Issue kindを一般診断へ丸めず拒否する。
 * @invariant mapSemanticDomainIssueToDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: mapSemanticDomainIssueToDiagnosticはProcess内の同一Subsystemで完結する。
 * @security N/A: mapSemanticDomainIssueToDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: mapSemanticDomainIssueToDiagnosticは共有非同期状態を持たない同期処理である。
 */
export function mapSemanticDomainIssueToDiagnostic(
  issue: DomainIssue,
): SemanticCoverageDiagnostic {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "ir.source.table-missing": {
      code = "semantic-ir-source-table-missing";
      const missingPart = stringDetail(issue, "missingPart");
      message =
        missingPart === "heading"
          ? "visible semantic source table heading is missing"
          : missingPart === "table"
            ? "semantic source table is missing"
            : (() => {
                throw new Error(
                  `invalid_semantic_domain_issue_detail:${issue.kind}:missingPart`,
                );
              })();
      break;
    }
    case "ir.source.header-invalid":
      code = "semantic-ir-source-header-invalid";
      message = "semantic source table header does not match the contract";
      break;
    case "ir.source.separator-invalid":
      code = "semantic-ir-source-separator-invalid";
      message = "semantic source table separator is invalid";
      break;
    case "ir.source.row-invalid":
      code = "semantic-ir-source-row-invalid";
      message = `row ${numberDetail(issue, "row")} has ${numberDetail(issue, "cellCount")} cells`;
      break;
    case "ir.meaning.key-invalid":
      code = "semantic-ir-key-invalid";
      message = `row ${numberDetail(issue, "row")} has an invalid pilot Semantic Key`;
      break;
    case "ir.meaning.key-duplicate":
      code = "semantic-ir-key-duplicate";
      message = `Duplicate Semantic Key: ${stringDetail(issue, "semanticKey")}.`;
      break;
    case "ir.meaning.kind-invalid":
      code = "semantic-ir-kind-invalid";
      message = `row ${numberDetail(issue, "row")} has an invalid meaning kind`;
      break;
    case "ir.meaning.statement-missing":
      code = "semantic-ir-statement-missing";
      message = `row ${numberDetail(issue, "row")} has no meaning statement`;
      break;
    case "ir.meaning.architecture-id-missing":
      code = "semantic-ir-architecture-id-missing";
      message = `row ${numberDetail(issue, "row")} has no Architecture identity`;
      break;
    case "ir.meaning.architecture-id-unresolved":
      code = "semantic-ir-architecture-id-unknown";
      message = `unknown Architecture identity: ${stringDetail(issue, "archId")}`;
      break;
    case "ir.meaning.verification-invalid":
      code = "semantic-ir-verification-invalid";
      message = `row ${numberDetail(issue, "row")} has an unsupported verification value`;
      break;
    case "ir.meaning.not-applicable-reason-missing":
      code = "semantic-ir-not-applicable-reason-missing";
      message = `row ${numberDetail(issue, "row")} requires a reason for N/A verification`;
      break;
    case "ir.meaning.source-section-unresolved":
      code = "semantic-ir-source-section-missing";
      message = `row ${numberDetail(issue, "row")} refers to an unresolved source section`;
      break;
    case "ir.source.meanings-empty":
      code = "semantic-ir-source-empty";
      message = "semantic source table contains no meaning rows";
      break;
    case "quality.source.qa-id-missing":
      code = "quality-semantic-qa-id-missing";
      message = "QA identity cannot be resolved from the source path";
      break;
    case "quality.source.table-missing": {
      code = "quality-semantic-table-missing";
      const missingPart = stringDetail(issue, "missingPart");
      message =
        missingPart === "heading"
          ? "Semantic Coverage Pilot heading is missing"
          : missingPart === "table"
            ? "Semantic Coverage Pilot table is missing"
            : (() => {
                throw new Error(
                  `invalid_semantic_domain_issue_detail:${issue.kind}:missingPart`,
                );
              })();
      break;
    }
    case "quality.source.header-invalid":
      code = "quality-semantic-header-invalid";
      message =
        "Semantic Coverage Pilot table header does not match the contract";
      break;
    case "quality.source.separator-invalid":
      code = "quality-semantic-separator-invalid";
      message = "Semantic Coverage Pilot table separator is invalid";
      break;
    case "quality.source.row-invalid":
      code = "quality-semantic-row-invalid";
      message = `row ${numberDetail(issue, "row")} has ${numberDetail(issue, "cellCount")} cells`;
      break;
    case "quality.relation.local-id-invalid":
      code = "quality-semantic-local-id-invalid";
      message = `row ${numberDetail(issue, "row")} has an invalid Local ID`;
      break;
    case "quality.relation.local-item-unresolved":
      code = "quality-semantic-local-item-unknown";
      message = `Local ID ${stringDetail(issue, "localId")} does not resolve to a required pair`;
      break;
    case "quality.relation.semantic-key-missing":
      code = "quality-semantic-key-missing";
      message = `row ${numberDetail(issue, "row")} has no Semantic Key`;
      break;
    case "quality.relation.semantic-key-unresolved":
      code = "quality-semantic-key-unknown";
      message = `${stringDetail(issue, "localId")} verifies unknown Semantic Key ${stringDetail(issue, "semanticKey")}.`;
      break;
    case "quality.relation.duplicate":
      code = "quality-semantic-relation-duplicate";
      message = `Duplicate quality relation: ${stringDetail(issue, "relationKey")}.`;
      break;
    case "quality.relation.required-key-unmapped":
      code = "quality-semantic-relation-missing";
      message = `${stringDetail(issue, "semanticKey")} has no Quality Local Item relation.`;
      break;
    case "coverage.meaning.key-duplicate":
      code = "semantic-coverage-key-duplicate";
      message = `Duplicate Semantic Key: ${stringDetail(issue, "semanticKey")}.`;
      break;
    case "coverage.implementation.semantic-key-unresolved":
      code = "semantic-coverage-key-unknown";
      message = `${stringDetail(issue, "symbolId")} implements unknown Semantic Key ${stringDetail(issue, "semanticKey")}.`;
      break;
    case "coverage.quality.semantic-key-unresolved":
      code = "semantic-coverage-quality-key-unknown";
      message = `${stringDetail(issue, "qaId")}/${stringDetail(issue, "localId")} verifies unknown Semantic Key ${stringDetail(issue, "semanticKey")}.`;
      break;
    case "coverage.quality.required-relation-missing":
      code = "semantic-coverage-quality-relation-missing";
      message = `${stringDetail(issue, "semanticKey")} has no Quality Local Item relation.`;
      break;
    case "coverage.test.quality-pair-ambiguous":
      code = "semantic-coverage-test-quality-pair-ambiguous";
      message = `${stringDetail(issue, "symbolId")} cannot uniquely resolve ${stringDetail(issue, "localId")}; candidates: ${stringDetail(issue, "candidates")}.`;
      break;
    default:
      throw new Error(`unknown_semantic_domain_issue:${issue.kind}`);
  }
  return { code, path: issue.location.path, message };
}

/**
 * 検証済みRepository Rootから指定文書集合を観測する。
 *
 * @responsibility 読取り成功文書と観測不能Diagnosticを同じBatch結果へ分ける。
 * @trace ARCH-000008
 * @input capability: VerifiedRepositoryRoot、paths: readonly string[]
 * @returns Readonly<{ documents: readonly SemanticSourceDocument[]; findings: readonly SemanticCoverageDiagnostic[]; }>を返す。
 * @precondition capability: VerifiedRepositoryRoot、paths: readonly string[]がobserveDocumentsの入力契約を満たす。
 * @postcondition observeDocumentsの責務を完了した結果だけを返す。
 * @effect N/A: observeDocumentsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
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
 * @effect N/A: compileSemanticIrFromRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
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
 * @effect N/A: compileQualitySemanticRelationsFromRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
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
 * @precondition semanticIrs: readonly SemanticIr[]、manifests: readonly LoadedRealitySymbolManifest[]、qualityRelations: readonly QualitySemanticRelation[]、prerequisiteFindings: readonly SemanticCoverageDiagnostic[]がcreateSemanticCoverageGraphの入力契約を満たす。
 * @postcondition createSemanticCoverageGraphの責務を完了した結果だけを返す。
 * @effect N/A: createSemanticCoverageGraphは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createSemanticCoverageGraphは独自の失敗分岐を所有しない。
 * @invariant createSemanticCoverageGraphは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createSemanticCoverageGraphはProcess内の同一Subsystemで完結する。
 * @security N/A: createSemanticCoverageGraphはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createSemanticCoverageGraphは共有非同期状態を持たない同期処理である。
 */
export function createSemanticCoverageGraph(
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
