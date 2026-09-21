/**
 * artifact-relationに属する責務をまとめる。
 *
 * @responsibility stringDetailを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */
import type { DomainIssue } from "../../../crdd-domain-library/src/index.ts";
import type { CheckerFinding } from "../findings/finding-model.ts";

/**
 * string Detailを決定する。
 *
 * @responsibility string Detailの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000001
 * @input issue: DomainIssue、name: string
 * @returns stringを返す。
 * @precondition 「issue: DomainIssue、name: string」がstringDetailの入力契約を満たす。
 * @postcondition stringDetailの責務を完了した結果だけを返す。
 * @effect N/A: stringDetailは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure stringDetailは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stringDetailは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: stringDetailはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stringDetailは共有非同期状態を持たない同期処理である。
 */
function stringDetail(issue: DomainIssue, name: string): string {
  const value = issue.details[name];
  if (typeof value !== "string" || value.length === 0)
    throw new Error(
      `invalid_artifact_domain_issue_detail:${issue.kind}:${name}`,
    );
  return value;
}

/**
 * Artifact Domain Issue To Checker Findingを対応付ける。
 *
 * @responsibility Artifact Domain Issue To Checker Findingの入力集合、対応規則、未対応結果の境界を所有する。
 * @trace ARCH-000001
 * @input issue: DomainIssue
 * @returns CheckerFindingを返す。
 * @precondition 「issue: DomainIssue」がmapArtifactDomainIssueToCheckerFindingの入力契約を満たす。
 * @postcondition mapArtifactDomainIssueToCheckerFindingの責務を完了した結果だけを返す。
 * @effect N/A: mapArtifactDomainIssueToCheckerFindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure mapArtifactDomainIssueToCheckerFindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mapArtifactDomainIssueToCheckerFindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mapArtifactDomainIssueToCheckerFindingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: mapArtifactDomainIssueToCheckerFindingは共有非同期状態を持たない同期処理である。
 */
export function mapArtifactDomainIssueToCheckerFinding(
  issue: DomainIssue,
): CheckerFinding {
  let code: string;
  let rule: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.schema.property-missing":
      code = "artifact-schema-property-missing";
      rule = stringDetail(issue, "schemaId");
      message = `Required artifact property is missing: ${stringDetail(issue, "property")}.`;
      break;
    case "artifact.schema.section-missing":
      code = "artifact-schema-section-missing";
      rule = stringDetail(issue, "schemaId");
      message = `Required artifact section is missing: ${stringDetail(issue, "section")}.`;
      break;
    case "artifact.schema.status-invalid":
      code = "artifact-schema-status-invalid";
      rule = stringDetail(issue, "schemaId");
      message = `Artifact status is outside the declared schema: ${stringDetail(issue, "status")}.`;
      break;
    case "artifact.relation.canonical-id-duplicate":
      code = "artifact-canonical-id-duplicate";
      rule = "relation.canonical-id-uniqueness";
      message = `Canonical ID is declared by more than one artifact: ${stringDetail(issue, "canonicalId")}.`;
      break;
    default:
      throw new Error(`unknown_artifact_domain_issue:${issue.kind}`);
  }
  return {
    severity: "error",
    code,
    path: issue.location.path,
    rule,
    message,
  };
}
