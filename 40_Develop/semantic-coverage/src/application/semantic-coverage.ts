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

type SemanticSourceDocument = Readonly<{ path: string; source: string }>;
export type SemanticCoverageDiagnostic = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

function stringDetail(issue: DomainIssue, name: string): string {
  const value = issue.details[name];
  if (typeof value !== "string" || value.length === 0)
    throw new Error(
      `invalid_semantic_domain_issue_detail:${issue.kind}:${name}`,
    );
  return value;
}

function numberDetail(issue: DomainIssue, name: string): number {
  const value = issue.details[name];
  if (typeof value !== "number")
    throw new Error(
      `invalid_semantic_domain_issue_detail:${issue.kind}:${name}`,
    );
  return value;
}

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
