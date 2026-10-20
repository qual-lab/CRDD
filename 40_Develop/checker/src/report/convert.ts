/**
 * ArtifactのSchema・Section・Status・Relation違反をCheckerの指摘へ変換する。
 *
 * @responsibility DomainのArtifact IssueをCheckerの表示・重要度・位置へ対応付ける。
 * @trace ARCH-000001
 */
import type { DomainIssue } from "../../../domain-model/src/index.ts";
import type { CheckerFinding, DocumentFinding } from "./types.ts";

/**
 * Architecture本文の中立Issueを既存四field診断へ変換する。
 * @responsibility 分析・定義・横断モデル・Detail本文と閉包の既存codeと文言を維持する。
 * @trace ARCH-000001
 * @input issue: Architecture本文モデルの中立Issue。
 * @returns 既存code・文言・位置・重要度の診断。
 * @precondition 対象本文は呼出し元が取得・検査している。
 * @postcondition 意味判定を再実装せず未知kindと不正な理由を拒否する。
 * @effect N/A: 局所的な表示値変換。
 * @failure 未知kind・不足するChecklist理由は例外として伝播する。
 * @invariant 診断順は呼出し元のIssue順をそのまま利用する。
 * @boundary DomainのArchitecture意味モデルとCheckerの表示境界。
 * @security 実在・認可・工程成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない同期変換。
 */
export function mapArchitectureDomainIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.architecture.analysis-contract-invalid":
    case "artifact.architecture.definition-contract-invalid": {
      const reason = issue.details.checklistFailure;
      if (typeof reason !== "string" && reason !== null)
        throw new Error("invalid_architecture_checklist_failure");
      const suffix = reason ? ` (${reason})` : "";
      if (issue.kind === "artifact.architecture.analysis-contract-invalid") {
        code = "architecture-analysis-contract-invalid";
        message = `Each Architecture analysis must use exactly its own UI or SPEC definition as formal input, evaluate all nine Architecture lenses with explicit Human Input treatment, identify one or more duplicate-free responsibility definitions, and contain one visible, fully evaluated artifact-specific Checklist with no OPEN/FAIL when Architecture Ready${suffix}.`;
      } else {
        code = "architecture-definition-contract-invalid";
        message = `Each Architecture definition must integrate at least one UI analysis and one SPEC analysis into a self-contained responsibility definition, preserve inherited unknowns and return conditions, and contain one visible, fully evaluated artifact-specific Checklist with no OPEN/FAIL when Architecture Ready${suffix}.`;
      }
      break;
    }
    case "artifact.architecture.detail-map-contract-invalid":
      code = "architecture-detail-map-contract-invalid";
      message =
        "The detail map must expose the area registry and close every canonical ARCH-ID exactly once in its definition closure table.";
      break;
    case "artifact.architecture.detail-contract-invalid": {
      const checklistError = issue.details.checklistFailure;
      if (typeof checklistError !== "string" && checklistError !== null)
        throw new Error("invalid_architecture_checklist_failure");
      code = "architecture-detail-contract-invalid";
      message = `Each detailed design area must expose unique relation states, all ten applicability decisions, all eight concern decisions, all six implementation-structure decisions, a structured Quality handoff, one visible fully evaluated Checklist, and no unresolved item when Architecture Ready${checklistError ? ` (${checklistError})` : ""}.`;
      break;
    }
    case "artifact.architecture.detail-area-coverage-mismatch":
      code = "architecture-detail-area-coverage-mismatch";
      message =
        "The detailed design registry and Details directories must be an exact set.";
      break;
    case "artifact.architecture.detail-relation-closure-mismatch":
      code = "architecture-detail-relation-closure-mismatch";
      message =
        "The detail map and area documents must expose the same many-to-many ARCH-ID relation set, covering every definition.";
      break;
    case "artifact.architecture.detail-covered-owner-missing":
      code = "architecture-detail-covered-owner-missing";
      message =
        "Every canonical ARCH-ID must have at least one Covered detailed-design owner before Architecture Ready; Partial relations may only support that owner.";
      break;
    case "artifact.architecture.analysis-coverage-mismatch":
      code = "architecture-analysis-coverage-mismatch";
      message =
        "Architecture must analyze every canonical UI and SPEC definition exactly once.";
      break;
    case "artifact.architecture.analysis-directory-coverage-mismatch":
      code = "architecture-analysis-directory-coverage-mismatch";
      message =
        "Architecture analysis directories and canonical UI/SPEC definitions must be an exact set.";
      break;
    case "artifact.architecture.definition-index-coverage-mismatch":
      code = "architecture-definition-index-coverage-mismatch";
      message =
        "The Architecture registry and responsibility definition directories must be an exact set.";
      break;
    case "artifact.architecture.component-definition-coverage-mismatch":
      code = "architecture-component-definition-coverage-mismatch";
      message =
        "The Component responsibility table must link every Architecture definition exactly once, without unknown or duplicate definitions.";
      break;
    case "artifact.architecture.relation-duplicate":
      code = "architecture-relation-duplicate";
      message =
        "Architecture registry and responsibility definitions must not repeat the same input-to-responsibility relation.";
      break;
    case "artifact.architecture.analysis-definition-closure-mismatch":
      code = "architecture-analysis-definition-closure-mismatch";
      message =
        "UI/SPEC analyses and Architecture definitions must expose the same duplicate-free input-to-responsibility relation set.";
      break;
    case "artifact.architecture.registry-relation-closure-mismatch":
      code = "architecture-registry-relation-closure-mismatch";
      message =
        "The Architecture registry must expose the same UI/SPEC-to-responsibility relation set as the analyses and definitions.";
      break;
    case "artifact.architecture.cross-model-section-missing":
      code = "architecture-cross-model-section-missing";
      message =
        "The official Architecture reconstruction must register all cross-cutting models before Architecture Ready.";
      break;
    case "artifact.architecture.cross-model-contract-invalid":
      code = "architecture-cross-model-contract-invalid";
      message =
        "Architecture cross-cutting models must be registered and expose their required responsibility, boundary, flow, failure, deployment, and Quality handoff structures.";
      break;
    case "artifact.architecture.detail-relation-contract-missing":
      code = "architecture-detail-relation-contract-missing";
      message =
        "Architecture definitions must distinguish Definition meaning from UI/SPEC Detail placement constraints and preserve the N:N relation, coverage, and gap.";
      break;
    case "artifact.architecture.detail-owner-mapping-missing":
      code = "architecture-detail-owner-mapping-missing";
      message =
        "Architecture Details must map applicable UI/SPEC Detail identities to the structure owned by each detail area.";
      break;
    default:
      throw new Error(`unknown_architecture_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}

/**
 * IA本文・関係の中立Issueを現在の文書診断へ変換する。
 *
 * @responsibility IAの七種類の違反を、既存code・文言・四fieldへ対応付ける。
 * @trace ARCH-000001
 * @input issue: IAモデル検査が返した中立Issue。
 * @returns 現在の文書診断。
 * @precondition 対象選択と本文取得は呼出し元が行っている。
 * @postcondition 未知kindや不正なChecklist理由を拒否する。
 * @effect N/A: 既存表示用Objectを局所的に構成する。
 * @failure 不明なIssueを正常診断へ丸めず例外を返す。
 * @invariant IA検査の適用条件・実行順・重要度を追加しない。
 * @boundary DomainのIAモデルとCheckerの表示境界。
 * @security 表示変換は採用や品質全体の成立を発行しない。
 * @concurrency N/A: 同期処理で共有状態を持たない。
 */
export function mapIaDomainIssueToFinding(issue: DomainIssue): DocumentFinding {
  let message: string;
  switch (issue.kind) {
    case "artifact.ia.analysis-contract-invalid":
    case "artifact.ia.definition-contract-invalid": {
      const reason = issue.details.checklistFailure;
      if (typeof reason !== "string" && reason !== null)
        throw new Error("invalid_ia_domain_issue_checklist_failure");
      message =
        issue.kind === "artifact.ia.analysis-contract-invalid"
          ? `Each UX definition must have one self-contained IA analysis with one canonical disposition, exact downstream relations, and an assessed checklist (${reason ?? "structure"}).`
          : `Each canonical IA unit must be self-contained, cite source analyses, keep exact downstream relations, and record its checklist (${reason ?? "structure"}).`;
      break;
    }
    case "artifact.ia.analysis-coverage-mismatch":
      message =
        "Every canonical UX definition must have exactly one IA analysis.";
      break;
    case "artifact.ia.definition-index-coverage-mismatch":
      message =
        "The IA registry and canonical definition directories must be an exact set.";
      break;
    case "artifact.ia.cross-projection-coverage-mismatch":
      message =
        "Every IA cross-cutting projection must process the exact canonical IA ID set once in its dedicated projection section.";
      break;
    case "artifact.ia.analysis-definition-closure-mismatch":
      message =
        "The IA registry, analysis dispositions, and definition source relations must form the same exact, duplicate-free (UX, IA) pair set in their canonical sections.";
      break;
    case "artifact.ia.object-mapping-closure-mismatch":
      message =
        "Every IA analysis object must be dispositioned exactly, and every non-N/A analysis mapping must match one canonical definition mapping with real source and target objects.";
      break;
    default:
      throw new Error(`unknown_ia_domain_issue:${issue.kind}`);
  }
  return {
    severity: "error",
    code: issue.kind.replace(/^artifact\.ia\./u, "ia-"),
    path: issue.location.path,
    message,
  };
}

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
 * @boundary N/A: DomainIssueのdetailsをProcess内で検査する。
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
 * @boundary DomainIssueと既存Rule診断の同期変換境界。
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

/**
 * UIモデルの中立Issueを既存の四項目診断へ変換する。
 * @responsibility UIモデルの既知Issueを既存のcode・severity・path・messageへ変換する。
 * @trace ARCH-000001
 * @input issue: 現在のUIモデルIssue。
 * @returns 既存のcode・path・severity・messageを持つ文書診断。
 * @precondition 現行UIモデルのIssueと、Checklist診断では理由の文字列を受ける。
 * @postcondition 対応する既存の四項目診断だけを返す。
 * @effect N/A: 入力と局所値だけを扱う純粋な同期処理。
 * @failure 未知の分類と必要な詳細の不足を例外として拒否する。
 * @invariant 既存診断の分類・文言・位置を維持する。
 * @boundary DomainモデルとChecker診断の同期変換境界。
 * @security 認可・実在確認・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function mapUiDomainIssueToFinding(issue: DomainIssue): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.ui.registry-row-invalid":
      code = "ui-registry-row-invalid";
      message =
        "Each UI registry row must identify at least one UX-view and IA-view input.";
      break;
    case "artifact.ui.detail-current-coverage-invalid":
      code = "ui-detail-current-coverage-invalid";
      message =
        "Every current UI definition must appear exactly once with one canonical SCR and PRT, a responsible Area, and a derivation reason.";
      break;
    case "artifact.ui.ux-analysis-contract-invalid":
      code = "ui-ux-analysis-contract-invalid";
      message =
        "Each UI input must be analyzed independently from exactly its own UX or IA definition and must identify at least one UI disposition.";
      break;
    case "artifact.ui.ia-analysis-contract-invalid":
      code = "ui-ia-analysis-contract-invalid";
      message =
        "Each UI input must be analyzed independently from exactly its own UX or IA definition and must identify at least one UI disposition.";
      break;
    case "artifact.ui.analysis-checklist-invalid":
      code = "ui-analysis-checklist-invalid";
      message = `Each UI analysis must expose one completed view-specific checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    case "artifact.ui.definition-contract-invalid":
      code = "ui-definition-contract-invalid";
      message =
        "Each canonical UI definition must integrate at least one UX-view analysis and one IA-view analysis.";
      break;
    case "artifact.ui.definition-checklist-invalid":
      code = "ui-definition-checklist-invalid";
      message = `Each canonical UI definition must expose one completed checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    case "artifact.ui.ux-analysis-coverage-mismatch":
      code = "ui-ux-analysis-coverage-mismatch";
      message =
        "Every canonical UX definition must have exactly one UX-view UI analysis.";
      break;
    case "artifact.ui.ia-analysis-coverage-mismatch":
      code = "ui-ia-analysis-coverage-mismatch";
      message =
        "Every canonical IA definition must have exactly one IA-view UI analysis.";
      break;
    case "artifact.ui.definition-index-coverage-mismatch":
      code = "ui-definition-index-coverage-mismatch";
      message =
        "The UI registry and canonical UI definition directories must be an exact set.";
      break;
    case "artifact.ui.analysis-definition-closure-mismatch":
      code = "ui-analysis-definition-closure-mismatch";
      message =
        "The UI registry, separate UX-view and IA-view analyses, and integrated UI definitions must form exact duplicate-free (UX, UI) and (IA, UI) relation sets.";
      break;
    default:
      throw new Error(`unknown_ui_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}

/**
 * 変更文書の中立Issueを既存四field診断へ変換する。
 * @responsibility 変更文書の中立Issueを既存四field診断へ変換する。
 * @input issue: 現行変更文書検査のIssue。
 * @returns 既存code・path・severity・messageを持つ診断。
 * @precondition 既知の変更文書検査Issueを受ける。
 * @postcondition 未知kindを拒否し、既存の文言と位置だけを返す。
 * @trace ARCH-000001
 * @effect N/A: 入力と局所値だけを扱う純粋な同期検査。
 * @failure 入力の実行時例外を伝播し、不正を成功へ補完しない。
 * @invariant 既存の診断code・文言・位置を維持する。
 * @boundary Domain IssueとChecker文書診断の同期変換境界。
 * @security 認可・採用・移行完了や品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function mapChangeDomainIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.change.impact-files-section-mismatch":
      code = "change-impact-files-section-mismatch";
      message =
        "Every canonical Change must contain exactly one '### 影響ファイル' section.";
      break;
    case "artifact.change.impact-files-contract-invalid":
      code = "change-impact-files-contract-invalid";
      message =
        "The impact-file section must use the canonical disclosure label and contain only flat affected-path, deletion, or move entries.";
      break;
    case "artifact.change.legacy-impact-heading":
      code = "legacy-change-impact-heading";
      message =
        "The legacy representative-file heading must not remain in a canonical Change.";
      break;
    case "artifact.change.phase-gate-contract-incomplete":
      code = "change-phase-gate-contract-incomplete";
      message =
        "CHG-000080以降の変更トレースは、Phase／Gateの適用判断、PhaseごとのGate、途中拡張、途中見直し、および固定前収束の必須適用判断を固定構造で保持する必要があります。";
      break;
    default:
      throw new Error(`unknown_change_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}

/**
 * UX分析・定義・正式入力・関係閉包の中立Issueを既存の表示診断へ変換する。
 * @responsibility 成果物別の文言・code・位置を保持し未知kindを拒否する。
 * @trace ARCH-000001
 * @input issue: UX本文・正式入力・関係閉包検査の中立Issue。
 * @returns 既存の四field診断。
 * @precondition 本文検査はDomainが実施している。
 * @postcondition Checklist理由を含む旧文言を返す。
 * @effect N/A: 同期的な値変換。
 * @failure 未知kindまたは不足詳細で例外を返す。
 * @invariant 成果物別の文言を他用途へ適用しない。
 * @boundary Domain IssueとChecker表示の境界。
 * @security 認可・採用・品質全体の成立を発行しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function mapUxDomainIssueToFinding(issue: DomainIssue): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.ux.requirement-formal-input-invalid":
      code = "ux-requirement-formal-input-invalid";
      message =
        "Each UX requirement analysis must use only its matching Discovery Definition as the formal input; an incomplete Definition must return to Discovery instead of being supplemented from Source Analysis.";
      break;
    case "artifact.ux.outcome-relation-closure-mismatch":
      code = "ux-outcome-relation-closure-mismatch";
      message =
        "Canonical UX outcomes and requirement-analysis New/Same relations must form an exact, bidirectional (REQ, UX) pair set.";
      break;
    case "artifact.ux.journey-relation-closure-mismatch":
      code = "ux-journey-relation-closure-mismatch";
      message =
        "The Experience Map and requirement analyses must form an exact, bidirectional (REQ, Journey) pair set.";
      break;
    case "artifact.ux.analysis-contract-invalid":
      code = "ux-requirement-analysis-contract-invalid";
      message =
        "Each UX requirement analysis must declare its REQ and preserve the six-stage visual-first analysis contract from problem and user outcome through synthesis, critical experience, validation, and downstream handoff, with one registry link.";
      break;
    case "artifact.ux.analysis-handoff-invalid":
      code = "ux-direct-downstream-handoff-reintroduced";
      message =
        "Requirement-specific UX analysis must preserve downstream meaning through IA, Quality Analysis / UX, and post-IA UI/SPEC relations rather than a direct Architecture or Verification handoff.";
      break;
    case "artifact.ux.analysis-checklist-invalid":
      code = "ux-checklist-contract-invalid";
      message = `Each canonical UX analysis must contain one visible, fully evaluated artifact-specific Checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    case "artifact.ux.analysis-relation-invalid":
      code = "ux-requirement-analysis-relation-invalid";
      message =
        "Each UX requirement analysis must connect every candidate to a canonical UX outcome and explain New or Same with requirement-specific reasoning.";
      break;
    case "artifact.ux.analysis-responsibility-header-invalid":
      code = "ux-requirement-analysis-responsibility-header-invalid";
      message =
        "Each UX requirement analysis must declare exactly one responsibility boundary table with the canonical three-column header.";
      break;
    case "artifact.ux.analysis-blueprint-disposition-invalid":
      code = "ux-requirement-analysis-blueprint-disposition-invalid";
      message =
        "Each UX requirement analysis must create a requirement-specific Service Blueprint when handoffs shape the experience, or state a reason and reevaluation condition when it is not applicable.";
      break;
    case "artifact.ux.definition-contract-invalid":
      code = "ux-definition-contract-invalid";
      message =
        "Each canonical UX outcome must have a self-contained definition.";
      break;
    case "artifact.ux.definition-handoff-invalid":
      code = "ux-direct-downstream-handoff-reintroduced";
      message =
        "Canonical UX definitions must not directly assign Architecture or Verification work; those obligations flow through IA, UI/SPEC, and Quality Analysis / UX.";
      break;
    case "artifact.ux.definition-checklist-invalid":
      code = "ux-checklist-contract-invalid";
      message = `Each canonical UX definition must contain one visible, fully evaluated artifact-specific Checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    default:
      throw new Error(`unknown_ux_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}

/**
 * Discovery分析・定義のIssueを既存診断へ変換する。
 * @responsibility 成果物別の文言・code・位置を保持し未知kindと詳細不足を拒否する。
 * @trace ARCH-000001
 * @input issue: Discovery分析または定義の中立Issue。
 * @returns 既存の四field診断。
 * @precondition 本文検査はDomainが実施している。
 * @postcondition Checklist理由を含む旧文言を返す。
 * @effect N/A: 同期的な値変換。
 * @failure 未知kind・不足詳細では例外を返す。
 * @invariant 成果物別文言を他のDiscovery用途へ適用しない。
 * @boundary Domain IssueとChecker表示の境界。
 * @security 採用・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function mapDiscoveryDomainIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.discovery.analysis-contract-invalid":
      code = "discovery-analysis-contract-invalid";
      message =
        "Each Discovery analysis must declare its phase-owned artifact type and matching exploration ID.";
      break;
    case "artifact.discovery.analysis-checklist-invalid":
      code = "discovery-checklist-contract-invalid";
      message = `Each canonical Discovery analysis must contain one visible, fully evaluated artifact-specific Checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    case "artifact.discovery.definition-contract-invalid":
      code = "discovery-requirement-definition-contract-invalid";
      message =
        "Each adopted Discovery requirement must have a self-contained canonical definition.";
      break;
    case "artifact.discovery.definition-checklist-invalid":
      code = "discovery-checklist-contract-invalid";
      message = `Each canonical Discovery requirement must contain one visible, fully evaluated artifact-specific Checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    default:
      throw new Error(`unknown_discovery_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}
/**
 * SPEC本文Issueを既存四field診断へ変換する。
 * @responsibility SPEC本文Issueを既存四field診断へ変換する。
 * @trace ARCH-000001
 * @input issue: SPEC本文解析の中立Issue。
 * @returns 既存code・文言・位置の診断。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 旧診断のcode・文言・位置だけを返し、意味検査を追加しない。
 * @effect N/A: 既読本文と局所値だけを扱う同期処理。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 用途別code・文言を維持し、未知kindと不足理由を拒否する。
 * @boundary N/A: 同一Process内のDomain IssueとChecker表示の境界。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function mapSpecDomainIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.spec.correspondence-closure-mismatch":
      code = "ui-spec-correspondence-closure-mismatch";
      message =
        "The UI/SPEC correspondence review must list the same duplicate-free pairs as both canonical definitions and the SPEC registry.";
      break;
    case "artifact.spec.correspondence-evidence-invalid":
      code = "ui-spec-correspondence-evidence-invalid";
      message =
        "Each UI/SPEC pair must record shared context, coverage, all contract review lenses, and a concrete UI fact, SPEC fact, and relation under one fixed revision.";
      break;
    case "artifact.spec.correspondence-revision-invalid": {
      const recorded = issue.details.recorded;
      if (recorded !== null && typeof recorded !== "string")
        throw new Error("invalid_spec_correspondence_recorded_fingerprint");
      code = "ui-spec-correspondence-revision-invalid";
      message = `The UI/SPEC correspondence review must pin the exact current UI/SPEC Definition-set SHA-256 fingerprint (recorded=${recorded ?? "missing"}, actual=${stringDetail(issue, "actual")}).`;
      break;
    }
    case "artifact.spec.detail-current-coverage-invalid":
      code = "spec-detail-current-coverage-invalid";
      message =
        "Every current SPEC definition must appear exactly once with one canonical BHV and a derivation reason.";
      break;
    case "artifact.spec.detail-downstream-coverage-invalid":
      code = "ui-spec-detail-downstream-coverage-invalid";
      message =
        "All issued SCR, PRT, and BHV identities must be covered by Architecture definitions and Quality definitions without set loss.";
      break;
    case "artifact.spec.detail-correspondence-state-invalid":
      code = "ui-spec-detail-correspondence-state-invalid";
      message =
        "UI/SPEC Detail correspondence must remain Pass with one unique interaction-to-BHV relation for every Definition pair and bidirectional coverage.";
      break;
    case "artifact.spec.ux-analysis-coverage-mismatch":
      code = "spec-ux-analysis-coverage-mismatch";
      message =
        "Every canonical UX definition must have exactly one UX-view SPEC analysis.";
      break;
    case "artifact.spec.analysis-relation-duplicate":
      code = "spec-analysis-relation-duplicate";
      message =
        "A SPEC disposition relation must appear exactly once in its canonical analysis section.";
      break;
    case "artifact.spec.ia-analysis-coverage-mismatch":
      code = "spec-ia-analysis-coverage-mismatch";
      message =
        "Every canonical IA definition must have exactly one IA-view SPEC analysis.";
      break;
    case "artifact.spec.definition-relation-duplicate":
      code = "spec-definition-relation-duplicate";
      message =
        "SPEC input and pairs_with relations must each appear exactly once in their canonical sections.";
      break;
    case "artifact.spec.definition-index-coverage-mismatch":
      code = "spec-definition-index-coverage-mismatch";
      message =
        "The SPEC registry and definition directories must be an exact set.";
      break;
    case "artifact.spec.root-coverage-count-mismatch":
      code = "spec-root-coverage-count-mismatch";
      message =
        "The SPEC root coverage counts must equal the current canonical definitions and analyses.";
      break;
    case "artifact.spec.analysis-definition-closure-mismatch":
      code = "spec-analysis-definition-closure-mismatch";
      message =
        "The SPEC registry, separate analyses, and definitions must form the same UX/IA-to-SPEC relation set.";
      break;
    case "artifact.spec.ui-spec-pair-duplicate":
      code = "ui-spec-pair-duplicate";
      message =
        "Each UI-to-SPEC pairs_with relation must appear exactly once in its canonical section.";
      break;
    case "artifact.spec.ui-spec-pair-closure-mismatch":
      code = "ui-spec-pair-closure-mismatch";
      message =
        "UI and SPEC definitions plus the SPEC registry must expose the same duplicate-free pairs_with relation set.";
      break;
    case "artifact.spec.ux-analysis-contract-invalid":
      code = "spec-ux-analysis-contract-invalid";
      message =
        "Each SPEC input must be analyzed independently from exactly its own UX or IA definition and must identify at least one SPEC disposition.";
      break;
    case "artifact.spec.ia-analysis-contract-invalid":
      code = "spec-ia-analysis-contract-invalid";
      message =
        "Each SPEC input must be analyzed independently from exactly its own UX or IA definition and must identify at least one SPEC disposition.";
      break;
    case "artifact.spec.analysis-checklist-invalid":
      code = "spec-analysis-checklist-invalid";
      message = `Each SPEC analysis must expose one completed view-specific checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    case "artifact.spec.registry-relation-duplicate":
      code = "spec-registry-relation-duplicate";
      message =
        "SPEC registry IDs and UX/IA/UI relations must each appear exactly once.";
      break;
    case "artifact.spec.definition-contract-invalid":
      code = "spec-definition-contract-invalid";
      message =
        "Each SPEC definition must integrate UX-view and IA-view inputs into an observable behavior contract.";
      break;
    case "artifact.spec.definition-checklist-invalid":
      code = "spec-definition-checklist-invalid";
      message = `Each canonical SPEC definition must expose one completed checklist (${stringDetail(issue, "checklistFailure")}).`;
      break;
    default:
      throw new Error(`unknown_spec_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}
