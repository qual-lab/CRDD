/**
 * Runtime Artifactの信頼軸とDeployment Owner Policyを評価する。
 *
 * @responsibility 同一Artifactの準拠、完全性、Publisherおよび品質を独立に保持し、利用者所有Policyから非Authorityの信頼判断を返す。
 * @trace ARCH-000014
 */

import { snapshotPlainRecord } from "./plain-data-snapshot.ts";

const INPUT_KEYS = new Set([
  "artifactIdentity",
  "observedAt",
  "usage",
  "axes",
  "policy",
]);
const AXIS_KEYS = new Set([
  "conformance",
  "integrity",
  "publisher",
  "publisherIdentity",
  "quality",
]);
const POLICY_KEYS = new Set([
  "revision",
  "allowedPublishers",
  "allowUnsignedLocalDevelopment",
  "requireConformance",
  "requireQualityAssurance",
]);
const HEX64 = /^[0-9a-f]{64}$/u;

/**
 * Runtime Trustを評価する。
 *
 * @responsibility 軸別観測を保持したままDeployment Owner Policyを適用し、根拠付きの信頼判断を返す。
 * @trace ARCH-000014
 * @input rawInput: unknown
 * @returns 軸別結果、Policy revision、判断理由および非Authority属性を持つ信頼判断を返す。
 * @precondition 入力は同一Artifact snapshotのIdentity、観測時点、用途、軸別観測およびPolicyを閉じた構造で渡す。
 * @postcondition trusted、not_trustedまたはunknownを返し、入力軸を一つのbooleanへ畳まない。
 * @effect N/A: 読取り評価だけを行い、Runtime Authority、Capabilityまたは外部Effectを発行しない。
 * @failure 不正入力、必須軸のunknown、Policy不一致および拒否条件を理由code付きの安全側判断へ変換する。
 * @invariant 一軸のPass、公式表示または署名だけからtrustedを導出しない。
 * @boundary Adjacent 1 Block: Artifact Evidence→Trust Evaluator→Deployment Owner Policy。
 * @security Policyは呼出し側の暗黙既定値で補わず、Publisher証明と実行許可を分離する。
 * @concurrency N/A: 入力snapshotだけを同期評価し、共有状態を持たない。
 */
export function evaluateRuntimeTrust(rawInput: unknown) {
  const input = snapshotPlainRecord(rawInput, INPUT_KEYS);
  const axes = input && snapshotPlainRecord(input.axes, AXIS_KEYS);
  const policy = input && snapshotPlainRecord(input.policy, POLICY_KEYS);
  const isInvalid =
    !input ||
    !axes ||
    !policy ||
    typeof input.artifactIdentity !== "string" ||
    !HEX64.test(input.artifactIdentity) ||
    typeof input.observedAt !== "string" ||
    Number.isNaN(Date.parse(input.observedAt)) ||
    !["official", "organization", "fork", "local_development"].includes(
      String(input.usage),
    ) ||
    !["pass", "fail", "unknown"].includes(String(axes.conformance)) ||
    !["verified", "invalid", "unknown"].includes(String(axes.integrity)) ||
    !["identified", "unidentified", "invalid"].includes(
      String(axes.publisher),
    ) ||
    !["assured", "not_assured", "unknown"].includes(String(axes.quality)) ||
    typeof policy.revision !== "string" ||
    policy.revision.length === 0 ||
    !Array.isArray(policy.allowedPublishers) ||
    !policy.allowedPublishers.every((value) => typeof value === "string") ||
    typeof policy.allowUnsignedLocalDevelopment !== "boolean" ||
    typeof policy.requireConformance !== "boolean" ||
    typeof policy.requireQualityAssurance !== "boolean";

  const base = {
    contract: "crdd-coordinator/runtime-trust-decision",
    contractRevision: 1,
    artifactIdentity:
      input && typeof input.artifactIdentity === "string"
        ? input.artifactIdentity
        : null,
    observedAt:
      input && typeof input.observedAt === "string" ? input.observedAt : null,
    policyRevision:
      policy && typeof policy.revision === "string" ? policy.revision : null,
    axes: axes
      ? Object.freeze({
          conformance: axes.conformance,
          integrity: axes.integrity,
          publisher: axes.publisher,
          publisherIdentity:
            typeof axes.publisherIdentity === "string"
              ? axes.publisherIdentity
              : null,
          quality: axes.quality,
        })
      : null,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  } as const;

  if (isInvalid)
    return Object.freeze({
      ...base,
      trust: "unknown" as const,
      reason: "runtime_trust_input_invalid",
    });

  const publisherIdentity =
    typeof axes.publisherIdentity === "string" ? axes.publisherIdentity : null;
  const unsignedLocalAllowed =
    input.usage === "local_development" &&
    policy.allowUnsignedLocalDevelopment === true &&
    axes.publisher === "unidentified";
  const isUnknown =
    axes.conformance === "unknown" ||
    axes.integrity === "unknown" ||
    axes.quality === "unknown";
  if (isUnknown)
    return Object.freeze({
      ...base,
      trust: "unknown" as const,
      reason: "runtime_trust_required_axis_unknown",
    });

  const publisherAllowed =
    unsignedLocalAllowed ||
    (axes.publisher === "identified" &&
      publisherIdentity !== null &&
      (policy.allowedPublishers as string[]).includes(publisherIdentity));
  const isTrusted =
    axes.integrity === "verified" &&
    publisherAllowed &&
    (!policy.requireConformance || axes.conformance === "pass") &&
    (!policy.requireQualityAssurance || axes.quality === "assured");
  return Object.freeze({
    ...base,
    trust: isTrusted ? ("trusted" as const) : ("not_trusted" as const),
    reason: isTrusted
      ? "runtime_trust_policy_satisfied"
      : "runtime_trust_policy_not_satisfied",
  });
}
