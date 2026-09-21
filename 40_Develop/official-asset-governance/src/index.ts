/**
 * 公式素材の判断、改訂版競合および収載照合を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility 素材Identity、権利根拠、許可用途、判断Authorityおよび対象Revisionを一つの契約で扱う。
 * @trace ARCH-000017
 * @boundary 公式素材Governance Subsystemと利用側の公開境界。
 * @effect N/A: 公開Symbolを明示再公開するだけである。
 * @security 公開契約は法的判断、Release公開または再配布Authorityを発行しない。
 */
export {
  applyOfficialAssetDecision,
  type OfficialAssetDecision,
  type OfficialAssetDecisionInput,
  type OfficialAssetDecisionResult,
  type OfficialAssetRecord,
  type OfficialAssetState,
  type OfficialInclusionRecord,
  verifyOfficialAssetInclusion,
} from "./official-asset-governance.ts";
