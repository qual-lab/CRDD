/**
 * Quality状態・定義・分析・関係の中立Issueを公開診断へ変換する。
 * @responsibility 既存の診断shape・code・文言・必要値検査を所有する。
 * @trace ARCH-000001
 */
import type { DomainIssue } from "../../../domain-model/src/index.ts";
import type { DocumentFinding, CheckerFinding } from "./types.ts";
/**
 * 品質設計状態の中立Issueを既存の表示へ変換する。
 *
 * @responsibility 両readinessの文言、code・severity・Rule・Pathを維持する。
 * @trace ARCH-000001
 * @input issue: 品質状態Issue。readiness: この起動で適用する品質状態。
 * @returns 従来と同じCheckerFinding。
 * @precondition 対象選択・readinessの適用判定は呼出し元が所有する。
 * @postcondition 既知kindだけを表示へ変換する。
 * @effect N/A: 局所Objectを構成するだけである。
 * @failure 未知kindは既存のunknown_quality_design_state_issueで拒否する。
 * @invariant Graph等の別用途Issueを品質状態診断へ混入させない。
 * @boundary Domainの品質状態IssueとChecker表示の境界。
 * @security 表示への変換は品質Pass・採用・認可を発行しない。
 * @concurrency N/A: 共有状態を持たない同期処理。
 */
export function mapQualityDesignStateIssueToFinding(
  issue: DomainIssue,
  readiness: "Quality Design Ready" | "Quality Ready",
): CheckerFinding {
  if (issue.kind !== "artifact.quality-design.state-invalid")
    throw new Error(`unknown_quality_design_state_issue:${issue.kind}`);
  return {
    severity: "error",
    code: "quality-design-artifact-state-invalid",
    path: issue.location.path,
    rule: "quality.design-artifact-canonical-state",
    message: `${readiness} requires every Quality design root, Analysis, and Definition artifact to declare Canonical state.`,
  };
}

/**
 * Quality Definitionの中立Issueを既存文書診断へ変換する。
 * @responsibility Quality Definitionの中立Issueを既存文書診断へ変換する。
 * @trace ARCH-000008
 * @input issue: 本文またはLocal ID所有検査が返した中立Issue。
 * @returns 既存のcode・message・path・severityを持つ診断。
 * @precondition Domainの検査を実行したIssueである。
 * @postcondition 未知kindや動的文言の不足情報を拒否する。
 * @effect N/A: 同期的な値処理。
 * @failure 解析例外を伝播し、不明を正常値に補完しない。
 * @invariant Issueの意味を再検査せず、元の表示だけを構成する。
 * @boundary N/A: Process内のQuality文書意味検査。
 * @security 認可・実在・実行許可・品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function mapQualityDefinitionIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string, message: string;
  switch (issue.kind) {
    case "artifact.quality.definition-identity-mismatch": {
      code = "quality-definition-identity-mismatch";
      message =
        "Each Quality definition directory, H1, and Quality ID field must expose the same QA-XXXXXX canonical identity.";
      break;
    }
    case "artifact.quality.definition-source-coverage-missing": {
      code = "quality-definition-source-coverage-missing";
      message =
        "Each verification definition must expose its Source-specific conditions and Local Item relations in the canonical information-source section.";
      break;
    }
    case "artifact.quality.definition-source-local-relation-incomplete": {
      code = "quality-definition-source-local-relation-incomplete";
      message =
        "Every verification-definition source row must preserve a condition and connect it to one or more Local Items.";
      break;
    }
    case "artifact.quality.definition-detail-coverage-missing": {
      code = "quality-definition-detail-coverage-missing";
      message =
        "Each verification definition must expose the Architecture detail areas that contribute its structural verification conditions.";
      break;
    }
    case "artifact.quality.verification-state-applicability-incomplete": {
      code = "quality-verification-state-applicability-incomplete";
      message =
        "各Quality Definitionは、固定した条件区分である正常、境界、準正常、異常および回復を明示的に評価する必要があります。";
      break;
    }
    case "artifact.quality.verification-item-schema-invalid": {
      code = "quality-verification-item-schema-invalid";
      message =
        "The verification-item table must use the exact thirteen canonical axes, including separate observation, oracle, evidence, completion, and execution-mode fields.";
      break;
    }
    case "artifact.quality.verification-item-id-level-mismatch": {
      const localId = issue.details.localId;
      if (typeof localId !== "string")
        throw new Error("invalid_quality_definition_issue_details");
      code = "quality-verification-item-id-level-mismatch";
      message = `Local Item ${localId} must encode the same test level declared by its verification-item row.`;
      break;
    }
    case "artifact.quality.verification-item-axis-missing": {
      code = "quality-verification-item-axis-missing";
      message =
        "Every verification item must populate all thirteen canonical axes so the intended level, boundary, observation, oracle, evidence, and completion condition can be reconstructed.";
      break;
    }
    case "artifact.quality.verification-item-condition-class-invalid": {
      code = "quality-verification-item-condition-class-invalid";
      message =
        "検証項目の条件区分は、正常、境界、準正常、異常または回復のいずれかである必要があります。";
      break;
    }
    case "artifact.quality.verification-item-test-level-invalid": {
      code = "quality-verification-item-test-level-invalid";
      message =
        "Verification-item test level must be exactly UT, IT, ST, or UAT; create separate Local Items when independently observable levels are required.";
      break;
    }
    case "artifact.quality.verification-item-external-boundary-stage-invalid": {
      code = "quality-verification-item-external-boundary-stage-invalid";
      message =
        "Verification-item external-boundary stage must use the canonical staged-integration values.";
      break;
    }
    case "artifact.quality.verification-item-execution-mode-invalid": {
      code = "quality-verification-item-execution-mode-invalid";
      message =
        "Verification-item execution mode must be exactly Automated, Manual, or Hybrid; test level and reviewer role belong to their own contracts.";
      break;
    }
    case "artifact.quality.verification-state-applicability-invalid": {
      const { state, violation } = issue.details;
      if (
        typeof state !== "string" ||
        (violation !== "rationale" && violation !== "local-items")
      )
        throw new Error("invalid_quality_definition_issue_details");
      code = "quality-verification-state-applicability-invalid";
      message =
        violation === "rationale"
          ? `${state} applicability must include a rationale.`
          : `${state} applicability must agree with the Local Items defined by the same Quality Definition.`;
      break;
    }
    case "artifact.quality.test-level-applicability-incomplete": {
      code = "quality-test-level-applicability-incomplete";
      message =
        "Each verification definition must explicitly decide UT, IT, ST, and UAT applicability with scope, staged external-boundary reach, and rationale.";
      break;
    }
    case "artifact.quality.primary-test-level-summary-mismatch": {
      code = "quality-primary-test-level-summary-mismatch";
      message =
        "The human-readable primary-test-level summary must exactly equal the ordered set of Required UT, IT, ST, and UAT applicability rows.";
      break;
    }
    case "artifact.quality.additional-test-type-applicability-incomplete": {
      code = "quality-additional-test-type-applicability-incomplete";
      message =
        "Each Quality definition must explicitly decide RT, PT, and LT applicability and explain non-applicability.";
      break;
    }
    case "artifact.quality.expensive-test-authorization-invalid": {
      code = "quality-expensive-test-authorization-invalid";
      message =
        "PT and LT must require Human Explicit Authorization when applicable and must use N/A authorization when non-applicable.";
      break;
    }
    case "artifact.quality.test-level-applicability-conflict": {
      code = "quality-test-level-applicability-conflict";
      message =
        "Test-level applicability must agree with its Local Items: Required has an item, N/A has none, and no item exceeds the declared external-boundary reach.";
      break;
    }
    case "artifact.quality.definition-verification-items-missing": {
      code = "quality-definition-verification-items-missing";
      message =
        "Each verification definition must contain at least one locally identified verification item in its canonical '検証項目' section.";
      break;
    }
    case "artifact.quality.local-verification-id-duplicate": {
      const { localId, previousOwner } = issue.details;
      if (typeof localId !== "string" || typeof previousOwner !== "string")
        throw new Error("invalid_quality_definition_issue_details");
      code = "quality-local-verification-id-duplicate";
      message = `Local verification ID ${localId} is already owned by ${previousOwner}.`;
      break;
    }
    default:
      throw new Error(`unknown_quality_definition_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}

/**
 * Qualityの分析・有限状態Issueを既存の公開診断へ変換する。
 * @responsibility Qualityの分析・有限状態Issueを既存の公開診断へ変換する。
 * @trace ARCH-000001
 * @input issue: 対応するDomainが返した中立Issue。
 * @returns 既存のseverity・code・path・messageを持つDocumentFinding。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知kindと動的文言に必要な値の不足は例外として拒否する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function mapQualityAnalysisIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.quality-analysis.state-invalid": {
      code = "quality-state-invalid";
      message =
        "Quality Center must declare exactly one canonical finite state: Quality Design Under Review — Reality Audit Blocked, Quality Design Ready — Reality Audit Pending, or Quality Ready.";
      break;
    }
    case "artifact.quality-analysis.reality-audit-state-invalid": {
      code = "quality-reality-audit-state-invalid";
      message =
        "Reality Audit must declare exactly one canonical finite state: Blocked — Quality Design Review Pending, Pending — Not Started, In Progress, or Complete.";
      break;
    }
    case "artifact.quality-analysis.state-reality-audit-state-mismatch": {
      code = "quality-state-reality-audit-state-mismatch";
      message =
        "Quality Center and Reality Audit must use an allowed state pair: Under Review/Blocked, Design Ready/Pending or In Progress, or Quality Ready/Complete.";
      break;
    }
    case "artifact.quality-analysis.canonical-mapping-coverage-mismatch": {
      code = "quality-canonical-mapping-coverage-mismatch";
      message =
        "The Quality mapping must explicitly process every canonical REQ, UX, IA, UI, SPEC, and ARCH definition without adding an unknown ID.";
      break;
    }
    case "artifact.quality-analysis.canonical-mapping-duplicate-row": {
      code = "quality-canonical-mapping-duplicate-row";
      message =
        "The Quality mapping must not repeat an identical source-to-objective relation row.";
      break;
    }
    case "artifact.quality-analysis.canonical-source-goal-duplicate": {
      code = "quality-canonical-source-goal-duplicate";
      message =
        "The summary mapping must not repeat the same Source ID to verification-goal relation through a different row description.";
      break;
    }
    case "artifact.quality-analysis.source-local-relation-section-missing": {
      code = "quality-source-local-relation-section-missing";
      message =
        "Every phase Quality analysis must expose Source ID, QA-ID, preserved condition, test level, and Local Item relations in its canonical integration section.";
      break;
    }
    case "artifact.quality-analysis.source-local-relation-incomplete": {
      code = "quality-source-local-relation-incomplete";
      message =
        "Every Source-to-goal relation must expose its deterministic Obligation Key, derivation source, source-specific condition, test level, external-boundary stage, and one or more Local Items.";
      break;
    }
    case "artifact.quality-analysis.source-local-relation-section-missing-empty-relations": {
      code = "quality-source-local-relation-section-missing";
      message =
        "The Quality analysis must expose Source ID, verification goal, preserved condition, and Local Item relations in its canonical relation section.";
      break;
    }
    case "artifact.quality-analysis.source-relation-duplicate": {
      code = "quality-source-relation-duplicate";
      message =
        "The canonical Source relation section must not repeat a Source-to-goal or Source-to-goal-to-Local-Item relation with alternate prose.";
      break;
    }
    case "artifact.quality-analysis.source-goal-relation-closure-mismatch": {
      code = "quality-source-goal-relation-closure-mismatch";
      message =
        "The summary mapping and canonical Source-specific relation table must expose the same duplicate-free Source ID to verification-goal relation set.";
      break;
    }
    case "artifact.quality-analysis.cross-model-row-invalid": {
      code = "quality-cross-model-row-invalid";
      message =
        "Every verification goal must have exactly one Architecture cross-model row with five dispositions.";
      break;
    }
    case "artifact.quality-analysis.cross-model-goal-duplicate": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_analysis_issue_details");
      code = "quality-cross-model-goal-duplicate";
      message = `Architecture cross-model disposition is duplicated for ${issue.details.value0}.`;
      break;
    }
    case "artifact.quality-analysis.cross-model-disposition-invalid": {
      code = "quality-cross-model-disposition-invalid";
      message =
        "Each Architecture cross-model disposition must be Required or a reasoned N/A.";
      break;
    }
    case "artifact.quality-analysis.cross-model-goal-coverage-mismatch": {
      code = "quality-cross-model-goal-coverage-mismatch";
      message =
        "The Architecture cross-model matrix must process every verification goal exactly once across all five models.";
      break;
    }
    case "artifact.quality-analysis.architecture-detail-unit-row-invalid": {
      code = "quality-architecture-detail-unit-row-invalid";
      message =
        "Every Architecture detail verification-unit row must contain area, exact unit, objective, Local Item, disposition, and re-evaluation condition.";
      break;
    }
    case "artifact.quality-analysis.architecture-detail-unit-duplicate": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_analysis_issue_details");
      code = "quality-architecture-detail-unit-duplicate";
      message = `Architecture detail verification unit is duplicated: ${issue.details.value0}.`;
      break;
    }
    case "artifact.quality-analysis.architecture-detail-unit-disposition-invalid": {
      code = "quality-architecture-detail-unit-disposition-invalid";
      message =
        "Architecture detail verification-unit disposition must be Covered or OPEN.";
      break;
    }
    case "artifact.quality-analysis.architecture-detail-unit-reevaluation-missing": {
      code = "quality-architecture-detail-unit-reevaluation-missing";
      message =
        "Every Architecture detail verification unit must state no remaining condition or an explicit re-evaluation condition.";
      break;
    }
    case "artifact.quality-analysis.architecture-detail-unit-goal-duplicate": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_analysis_issue_details");
      code = "quality-architecture-detail-unit-goal-duplicate";
      message = `Architecture detail verification-unit objective is duplicated: ${issue.details.value0}.`;
      break;
    }
    case "artifact.quality-analysis.architecture-detail-unit-local-item-missing": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_analysis_issue_details");
      code = "quality-architecture-detail-unit-local-item-missing";
      message = `Architecture detail verification unit must connect to one or more Local Items: ${issue.details.value0}.`;
      break;
    }
    case "artifact.quality-analysis.architecture-detail-goal-relation-missing": {
      code = "quality-architecture-detail-goal-relation-missing";
      message =
        "Each Architecture detail area must connect to one or more canonical verification goals.";
      break;
    }
    case "artifact.quality-analysis.architecture-detail-coverage-mismatch": {
      code = "quality-architecture-detail-coverage-mismatch";
      message =
        "The Quality mapping must explicitly process every current Architecture detail area without adding an unknown area.";
      break;
    }
    default:
      throw new Error(`unknown_quality_analysis_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}

/**
 * Quality関係Issueを既存の公開診断へ変換する。
 * @responsibility Quality関係Issueを既存の公開診断へ変換する。
 * @trace ARCH-000001
 * @input issue: 対応するDomainが返した中立Issue。
 * @returns 既存のseverity・code・path・messageを持つDocumentFinding。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知kindと動的文言に必要な値の不足は例外として拒否する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function mapQualityRelationsIssueToFinding(
  issue: DomainIssue,
): DocumentFinding {
  let code: string;
  let message: string;
  switch (issue.kind) {
    case "artifact.quality-relations.definition-source-relation-duplicate": {
      code = "quality-definition-source-relation-duplicate";
      message =
        "Verification definitions must not repeat the same Source ID, goal, and Local Item relation with different descriptions.";
      break;
    }
    case "artifact.quality-relations.definition-goal-local-relation-duplicate": {
      code = "quality-definition-goal-local-relation-duplicate";
      message =
        "Verification definitions must not repeat the same verification-goal to Local Item relation.";
      break;
    }
    case "artifact.quality-relations.definition-detail-goal-relation-duplicate": {
      code = "quality-definition-detail-goal-relation-duplicate";
      message =
        "Verification definitions must not repeat the same Architecture detail to goal relation.";
      break;
    }
    case "artifact.quality-relations.detail-goal-relation-closure-mismatch": {
      code = "quality-detail-goal-relation-closure-mismatch";
      message =
        "The Quality analysis and verification definitions must expose the same duplicate-free Architecture-detail-to-goal relation set.";
      break;
    }
    case "artifact.quality-relations.source-local-relation-closure-mismatch": {
      code = "quality-source-local-relation-closure-mismatch";
      message =
        "The Quality analysis and verification definitions must expose the same duplicate-free Source ID, goal, and Local Item relation set.";
      break;
    }
    case "artifact.quality-relations.obligation-key-closure-mismatch": {
      code = "quality-obligation-key-closure-mismatch";
      message =
        "Quality Analysis and Definitions must expose the same unique deterministic Obligation Key for every Source-to-goal relation.";
      break;
    }
    case "artifact.quality-relations.source-test-level-coverage-mismatch": {
      code = "quality-source-test-level-coverage-mismatch";
      message =
        "Every test level requested by a canonical Source-to-goal mapping must be represented by a related Local Item of that same level.";
      break;
    }
    case "artifact.quality-relations.source-test-level-decomposition-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_relations_issue_details");
      code = "quality-source-test-level-decomposition-mismatch";
      message = `Canonical Source ${issue.details.value0} summary level set must equal the union of its Source-to-goal level sets.`;
      break;
    }
    case "artifact.quality-relations.definition-source-test-level-closure-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_relations_issue_details");
      if (typeof issue.details.value1 !== "string")
        throw new Error("invalid_quality_relations_issue_details");
      code = "quality-definition-source-test-level-closure-mismatch";
      message = `The Quality analysis and verification definitions must expose the same Source-to-goal test-level sets. Analysis=${issue.details.value0}; Definitions=${issue.details.value1}.`;
      break;
    }
    case "artifact.quality-relations.source-condition-closure-mismatch": {
      code = "quality-source-condition-closure-mismatch";
      message =
        "The Quality mapping and verification definitions must preserve the same normalized source-specific condition for every Source ID to verification-goal relation.";
      break;
    }
    case "artifact.quality-relations.local-verification-item-closure-mismatch": {
      code = "quality-local-verification-item-closure-mismatch";
      message =
        "The canonical Quality mapping must list the exact Local Item set owned by all current verification definitions.";
      break;
    }
    case "artifact.quality-relations.architecture-detail-unit-local-item-unknown": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_relations_issue_details");
      code = "quality-architecture-detail-unit-local-item-unknown";
      message = `Architecture detail verification unit references an unknown Local Item: ${issue.details.value0}.`;
      break;
    }
    case "artifact.quality-relations.architecture-detail-unit-level-coverage-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_relations_issue_details");
      code = "quality-architecture-detail-unit-level-coverage-mismatch";
      message = `Every test level required by an Architecture detail derivation key must have a related Local Item at that level: ${issue.details.value0}.`;
      break;
    }
    case "artifact.quality-relations.architecture-detail-unit-boundary-coverage-mismatch": {
      if (typeof issue.details.value0 !== "string")
        throw new Error("invalid_quality_relations_issue_details");
      code = "quality-architecture-detail-unit-boundary-coverage-mismatch";
      message = `Every Architecture detail derivation key must reach its declared external-boundary stage through a related Local Item: ${issue.details.value0}.`;
      break;
    }
    case "artifact.quality-relations.goal-local-relation-duplicate": {
      code = "quality-goal-local-relation-duplicate";
      message =
        "The canonical Quality mapping must not repeat the same verification-goal to Local Item relation.";
      break;
    }
    case "artifact.quality-relations.goal-local-relation-closure-mismatch": {
      code = "quality-goal-local-relation-closure-mismatch";
      message =
        "The canonical Quality mapping must preserve the exact verification-goal to Local Item relation set owned by the verification definitions; a globally equal Local ID set is not sufficient.";
      break;
    }
    default:
      throw new Error(`unknown_quality_relations_domain_issue:${issue.kind}`);
  }
  return { severity: "error", code, path: issue.location.path, message };
}
