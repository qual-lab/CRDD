/**
 * 変更と品質状態の統合Domain境界。
 * @packageDocumentation
 * @responsibility 固定改訂版、必須確認集合、結果統合および是正後再入場を公開する。
 * @trace ARCH-000003
 * @boundary 独立確認結果と現在品質GateのDomain境界。
 * @security Release AuthorityまたはRisk受容を発行しない。
 */
export {
  fixQualityCandidate,
  integrateQualityGate,
  reenterQualityReview,
  type FixedQualityCandidate,
  type IntegratedQualityGate,
  type QualityCheckResult,
  type QualityCheckStatus,
} from "./quality-gate.ts";
