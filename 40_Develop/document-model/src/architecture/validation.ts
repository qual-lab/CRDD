/**
 * Architecture文書の種別と局所Checklist期待集合を対応付ける。
 * @packageDocumentation
 * @trace ARCH-000008
 */
import type { ArchitectureChecklistRequest } from "./types.ts";

/**
 * Architectureが所有する期待項目を選択する。
 * @responsibility 旧文言・順序・派生列と受付間の独立性を維持する。
 * @trace ARCH-000008
 * @input kind: 明示された文書種別。
 * @returns 今回の受付だけが所有する期待項目配列。
 * @precondition 種別を方式やPathから推定しない。
 * @postcondition 固定定義・別受付と配列を共有しない。
 * @effect N/A: 固定値の局所構築のみ。
 * @failure 未知kindを拒否する。
 * @invariant 通常用とTemplate専用の期待列を自動統合しない。
 * @boundary Architectureの固定条件選択。
 * @security 期待列から品質成立やAuthorityを発行しない。
 * @concurrency N/A: 共有可変値を持たない。
 */
export function architectureChecklistItems(
  kind: ArchitectureChecklistRequest["kind"],
): string[] {
  const architectureUiAnalysisChecklistItemTexts = [
    "自分自身のUI定義だけを正式入力として処置した",
    "利用者が得る結果、認識、操作、Feedbackおよび状態差を保持した",
    "Architectureが担う責務と担わない責務を評価した",
    "Boundary、主要ComponentおよびInterfaceの必要性を評価した",
    "Data／State Ownershipを評価した",
    "Authority、Effectおよび開示境界を評価した",
    "Failure BoundaryとRecovery責任を評価した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性を評価した",
    "Open／GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを評価した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "SPEC観点との統合時に確認する事項を明示した",
  ];

  const architectureSpecAnalysisChecklistItemTexts = [
    "自分自身のSPEC定義だけを正式入力として処置した",
    "契機、事前条件、Authority、状態、結果およびEffectを保持した",
    "Architectureが担う責務と担わない責務を評価した",
    "Boundary、主要ComponentおよびInterfaceの必要性を評価した",
    "Data／State Ownershipを評価した",
    "External Boundaryと終了後観測を評価した",
    "Failure BoundaryとRecovery責任を評価した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性を評価した",
    "Open／GapとOwner工程へ戻す条件を明示した",
    "Verification Intentを評価した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "UI観点との統合時に確認する事項を明示した",
  ];

  const architectureDefinitionChecklistItemTexts = [
    "UI分析とSPEC分析だけを正式入力として統合した",
    "UI ContractとSPEC Contractを入力別に保持した",
    "独立したArchitecture Responsibilityを説明できる",
    "所有する責務、所有しない責務およびBoundaryを明示した",
    "Major Component、Interfaceおよび依存方向を明示した",
    "Data／State Ownershipを明示した",
    "Authority、EffectおよびLifecycleを入力別に評価した",
    "Failure Boundary、Recovery責任および観測を明示した",
    "Security／TrustとQuality Constraintを評価した",
    "Human Inputの必要性とOpen／Gapを評価した",
    "DetailsへのHandoffを明示した",
    "Qualityへ渡すVerification Intentを明示した",
    "現行Sourceや実装構造から意味を逆輸入していない",
    "上流の観測可能な振る舞いをArchitectureで変更していない",
  ];

  const architectureDefinitionTemplateChecklistItemTexts = [
    "UI／SPEC Definitionの意味統合と、適用するUI／SPEC Detailの配置制約を区別した",
    "UI ContractとSPEC Contractを入力別に保持した",
    "SCR／PRT／Interaction／BHVのN:N Relation、CoverageおよびGapを保持した",
    ...architectureDefinitionChecklistItemTexts.slice(2),
  ];

  const architectureDetailChecklistItemTexts = [
    "関連するARCH-IDと担当する責務断面を明示した",
    "10種類の詳細成果物を全数Applicability判定した",
    "Requiredを実在する節または成果物へ接続した",
    "N/AにArchitecture上の理由を記録した",
    "8種類のEngineering Concernを全数評価した",
    "PASSを設計済みの意味に限定した",
    "Component、Interface、Data／StateおよびSequenceを必要な粒度で具体化した",
    "Failure／Recovery、ObservabilityおよびSecurity Boundaryを具体化した",
    "7種類のImplementation Structure観点を全数Applicability判定した",
    "二つ目の具象実装がある責務で、共通契約への昇格または非昇格理由を評価した",
    "Qualityへ渡す設計項目を局所的な導出キーまたは同等に一意な参照へ接続した",
    "Qualityへ対象、正常条件、反証する失敗、観測および終了後条件を渡した",
    "Human Inputの必要性とOpen／Gapを評価した",
    "現行実装との照合をReality Auditとして分離した",
    "Source構造をCanonical詳細設計へ逆輸入していない",
  ];

  const architectureDetailTemplateChecklistItemTexts = [
    architectureDetailChecklistItemTexts[0] as string,
    "適用するUI／SPEC Detailと担当構造の逆引きを保持した",
    ...architectureDetailChecklistItemTexts.slice(1),
  ];
  const items = {
    analysis_ui: architectureUiAnalysisChecklistItemTexts,
    analysis_spec: architectureSpecAnalysisChecklistItemTexts,
    definition: architectureDefinitionChecklistItemTexts,
    definition_template: architectureDefinitionTemplateChecklistItemTexts,
    detail: architectureDetailChecklistItemTexts,
    detail_template: architectureDetailTemplateChecklistItemTexts,
  };
  if (!Object.hasOwn(items, kind))
    throw new Error("unknown_architecture_checklist_kind");
  return items[kind];
}
