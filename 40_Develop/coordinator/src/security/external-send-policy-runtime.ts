/**
 * external-send-policy-runtimeに属する責務をまとめる。
 *
 * @responsibility Providerを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import { createHash } from "node:crypto";

import { EXTERNAL_SEND_POLICY_RELATIVE_PATH } from "../../../runtime-data/src/index.ts";
import { readFixedSnapshotFile } from "../../../version-control/src/fixed-snapshot.ts";
import { gitFixedSnapshotAdapter } from "../../../version-control/src/git/fixed-snapshot-adapter.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/repository-location.ts";

import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import {
  borrowRuntimeOwnedRepositorySource,
  verifyRuntimeOwnedRepositoryBindingCapability,
} from "./repository-operation-runtime.ts";

export const EXTERNAL_SEND_POLICY_RUNTIME_CONTRACT =
  "crdd-coordinator/external-send-policy-runtime";
export const EXTERNAL_SEND_POLICY_RUNTIME_CONTRACT_REVISION = 3;
export const EXTERNAL_SEND_POLICY_FILE = EXTERNAL_SEND_POLICY_RELATIVE_PATH;

const TOP_LEVEL_KEYS = new Set([
  "schema",
  "enabled",
  "policyId",
  "informationClassification",
  "decisionAuthority",
  "candidatePersistenceAllowed",
  "candidateRetentionHours",
  "candidatePhysicalDeletion",
  "destinations",
]);
const DESTINATION_KEYS = new Set([
  "provider",
  "accountTenantBoundary",
  "subscriptionOffering",
  "purposeOperations",
  "retentionDeletion",
  "secondaryUseTraining",
  "onwardTransferSubprocessing",
  "termsPolicyIdentity",
  "boundaryResolution",
]);
const PURPOSES = Object.freeze([
  "task_execution",
  "independent_review",
  "bounded_remediation",
]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._/:@+-]{0,255}$/u;

/**
 * external-send-policy-runtimeで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";
/**
 * external-send-policy-runtimeで使用するDestinationの値契約を定義する。
 *
 * @responsibility DestinationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape Destinationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Destinationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Destinationの宣言は外部境界を開かない。
 * @security DestinationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Destinationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Destination = Readonly<{
  provider: Provider;
  accountTenantBoundary: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  purposeOperations: readonly string[];
  retentionDeletion: string;
  secondaryUseTraining: string;
  onwardTransferSubprocessing: string;
  termsPolicyIdentity: string;
  boundaryResolution: "interactive_local_user_confirmation_required";
}>;
/**
 * external-send-policy-runtimeで使用するExternal Send Policyの値契約を定義する。
 *
 * @responsibility External Send PolicyのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape ExternalSendPolicyが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExternalSendPolicyで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExternalSendPolicyの宣言は外部境界を開かない。
 * @security ExternalSendPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExternalSendPolicyの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExternalSendPolicy = Readonly<{
  schema: "crdd-coordinator/external-send-policy/v2";
  enabled: boolean;
  policyId: string;
  informationClassification: "public" | "internal" | "confidential";
  decisionAuthority: "authenticated_local_user";
  candidatePersistenceAllowed: boolean;
  candidateRetentionHours: number;
  candidatePhysicalDeletion: "next_safe_runtime_entry_after_expiry_or_explicit_discard";
  destinations: readonly Destination[];
  policyHash: string;
  sourceRevision: string;
  sourceFileHash: string;
}>;
/**
 * external-send-policy-runtimeで使用するPolicy 記録の値契約を定義する。
 *
 * @responsibility Policy 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000015
 * @shape PolicyRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PolicyRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: PolicyRecordの宣言は外部境界を開かない。
 * @security PolicyRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PolicyRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PolicyRecord = Readonly<{
  managementCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  policy: ExternalSendPolicy;
}>;

const policies = new WeakMap<object, PolicyRecord>();

/**
 * Identifierを安全条件の下で処理する。
 *
 * @responsibility Identifierの安全条件、拒否条件、終了結果境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns safeIdentifierの計算結果を返す。
 * @precondition 「value: unknown」がsafeIdentifierの入力契約を満たす。
 * @postcondition safeIdentifierの責務を完了した結果だけを返す。
 * @effect N/A: safeIdentifierは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: safeIdentifierは独自の失敗分岐を所有しない。
 * @invariant safeIdentifierは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: safeIdentifierはProcess内の同一Subsystemで完結する。
 * @security safeIdentifierはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: safeIdentifierは共有非同期状態を持たない同期処理である。
 */
function safeIdentifier(value: unknown) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

/**
 * Destinationを固定Schemaへ正規化する。
 *
 * @responsibility Destinationの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns Destination | nullを返す。
 * @precondition 「raw: unknown」がnormalizeDestinationの入力契約を満たす。
 * @postcondition normalizeDestinationの責務を完了した結果だけを返す。
 * @effect N/A: normalizeDestinationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeDestinationは独自の失敗分岐を所有しない。
 * @invariant normalizeDestinationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeDestinationはProcess内の同一Subsystemで完結する。
 * @security normalizeDestinationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeDestinationは共有非同期状態を持たない同期処理である。
 */
function normalizeDestination(raw: unknown): Destination | null {
  const value = snapshotPlainRecord(raw, DESTINATION_KEYS);
  const purposes = value
    ? snapshotPlainArray<string>(value.purposeOperations, PURPOSES.length)
    : null;
  const provider = value?.provider;
  const offering = value?.subscriptionOffering;
  const expected =
    provider === "codex"
      ? Object.freeze({
          accountTenantBoundary:
            "selected_user_dedicated_provider_home_session",
          subscriptionOffering: "chatgpt_subscription_oauth",
          retentionDeletion:
            "provider_terms_and_settings_apply_runtime_not_verified",
          secondaryUseTraining:
            "provider_terms_and_settings_apply_runtime_not_verified",
          onwardTransferSubprocessing:
            "provider_terms_and_settings_apply_runtime_not_verified",
          termsPolicyIdentity:
            "openai-consumer-terms-current-at-interactive-confirmation",
        })
      : provider === "claude"
        ? Object.freeze({
            accountTenantBoundary:
              "selected_user_dedicated_provider_home_session",
            subscriptionOffering: "claude_max",
            retentionDeletion:
              "provider_terms_and_settings_apply_runtime_not_verified",
            secondaryUseTraining:
              "provider_terms_and_settings_apply_runtime_not_verified",
            onwardTransferSubprocessing:
              "provider_terms_and_settings_apply_runtime_not_verified",
            termsPolicyIdentity:
              "anthropic-consumer-terms-current-at-interactive-confirmation",
          })
        : null;
  if (
    !value ||
    !expected ||
    value.accountTenantBoundary !== expected.accountTenantBoundary ||
    value.subscriptionOffering !== expected.subscriptionOffering ||
    value.retentionDeletion !== expected.retentionDeletion ||
    value.secondaryUseTraining !== expected.secondaryUseTraining ||
    value.onwardTransferSubprocessing !==
      expected.onwardTransferSubprocessing ||
    value.termsPolicyIdentity !== expected.termsPolicyIdentity ||
    value.boundaryResolution !==
      "interactive_local_user_confirmation_required" ||
    purposes?.status !== "ok" ||
    purposes.value.length !== PURPOSES.length ||
    purposes.value.some((item, index) => item !== PURPOSES[index]) ||
    !safeIdentifier(value.accountTenantBoundary)
  ) {
    return null;
  }
  return Object.freeze({
    provider: provider as Provider,
    accountTenantBoundary: value.accountTenantBoundary as string,
    subscriptionOffering: offering as Destination["subscriptionOffering"],
    purposeOperations: PURPOSES,
    retentionDeletion: value.retentionDeletion as string,
    secondaryUseTraining: value.secondaryUseTraining as string,
    onwardTransferSubprocessing: value.onwardTransferSubprocessing as string,
    termsPolicyIdentity: value.termsPolicyIdentity as string,
    boundaryResolution: "interactive_local_user_confirmation_required",
  });
}

/**
 * canonical Policy Payloadを決定する。
 *
 * @responsibility canonical Policy Payloadの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000015
 * @input policy: Omit<ExternalSendPolicy, "policyHash">
 * @returns canonicalPolicyPayloadの計算結果を返す。
 * @precondition 「policy: Omit<ExternalSendPolicy, "policyHash">」がcanonicalPolicyPayloadの入力契約を満たす。
 * @postcondition canonicalPolicyPayloadの責務を完了した結果だけを返す。
 * @effect N/A: canonicalPolicyPayloadは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalPolicyPayloadは独自の失敗分岐を所有しない。
 * @invariant canonicalPolicyPayloadは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalPolicyPayloadはProcess内の同一Subsystemで完結する。
 * @security canonicalPolicyPayloadはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalPolicyPayloadは共有非同期状態を持たない同期処理である。
 */
function canonicalPolicyPayload(
  policy: Omit<ExternalSendPolicy, "policyHash">,
) {
  return JSON.stringify({
    schema: policy.schema,
    enabled: policy.enabled,
    policyId: policy.policyId,
    informationClassification: policy.informationClassification,
    decisionAuthority: policy.decisionAuthority,
    candidatePersistenceAllowed: policy.candidatePersistenceAllowed,
    candidateRetentionHours: policy.candidateRetentionHours,
    candidatePhysicalDeletion: policy.candidatePhysicalDeletion,
    destinations: policy.destinations.map((destination) => ({
      provider: destination.provider,
      accountTenantBoundary: destination.accountTenantBoundary,
      subscriptionOffering: destination.subscriptionOffering,
      purposeOperations: destination.purposeOperations,
      retentionDeletion: destination.retentionDeletion,
      secondaryUseTraining: destination.secondaryUseTraining,
      onwardTransferSubprocessing: destination.onwardTransferSubprocessing,
      termsPolicyIdentity: destination.termsPolicyIdentity,
      boundaryResolution: destination.boundaryResolution,
    })),
    sourceRevision: policy.sourceRevision,
    sourceFileHash: policy.sourceFileHash,
  });
}

/**
 * External Send Policy 候補を機械利用可能な契約へ変換する。
 *
 * @responsibility External Send Policy 候補の入力Schema、決定論的変換、変換不能時の拒否境界を所有する。
 * @trace ARCH-000015
 * @input raw: unknown、sourceRevision: string、sourceFileHash: string
 * @returns ExternalSendPolicy | nullを返す。
 * @precondition 「raw: unknown、sourceRevision: string、sourceFileHash: string」がcompileExternalSendPolicyCandidateの入力契約を満たす。
 * @postcondition compileExternalSendPolicyCandidateの責務を完了した結果だけを返す。
 * @effect N/A: compileExternalSendPolicyCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: compileExternalSendPolicyCandidateは独自の失敗分岐を所有しない。
 * @invariant compileExternalSendPolicyCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileExternalSendPolicyCandidateはProcess内の同一Subsystemで完結する。
 * @security compileExternalSendPolicyCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileExternalSendPolicyCandidateは共有非同期状態を持たない同期処理である。
 */
export function compileExternalSendPolicyCandidate(
  raw: unknown,
  sourceRevision: string,
  sourceFileHash: string,
): ExternalSendPolicy | null {
  const value = snapshotPlainRecord(raw, TOP_LEVEL_KEYS);
  const destinationValues = value
    ? snapshotPlainArray(value.destinations, 2)
    : null;
  const destinations =
    destinationValues?.status === "ok"
      ? destinationValues.value.map(normalizeDestination)
      : null;
  if (
    value?.schema !== "crdd-coordinator/external-send-policy/v2" ||
    typeof value.enabled !== "boolean" ||
    !safeIdentifier(value.policyId) ||
    !["public", "internal", "confidential"].includes(
      value.informationClassification as string,
    ) ||
    value.decisionAuthority !== "authenticated_local_user" ||
    typeof value.candidatePersistenceAllowed !== "boolean" ||
    !Number.isSafeInteger(value.candidateRetentionHours) ||
    (value.candidateRetentionHours as number) < 1 ||
    (value.candidateRetentionHours as number) > 168 ||
    value.candidatePhysicalDeletion !==
      "next_safe_runtime_entry_after_expiry_or_explicit_discard" ||
    !destinations ||
    destinations.length !== 2 ||
    destinations.some((item) => item === null) ||
    destinations[0]?.provider !== "codex" ||
    destinations[1]?.provider !== "claude"
  ) {
    return null;
  }
  const withoutHash = Object.freeze({
    schema: "crdd-coordinator/external-send-policy/v2" as const,
    enabled: value.enabled,
    policyId: value.policyId as string,
    informationClassification: value.informationClassification as
      | "public"
      | "internal"
      | "confidential",
    decisionAuthority: "authenticated_local_user" as const,
    candidatePersistenceAllowed: value.candidatePersistenceAllowed,
    candidateRetentionHours: value.candidateRetentionHours as number,
    candidatePhysicalDeletion:
      "next_safe_runtime_entry_after_expiry_or_explicit_discard" as const,
    destinations: Object.freeze(destinations as Destination[]),
    sourceRevision,
    sourceFileHash,
  });
  return Object.freeze({
    ...withoutHash,
    policyHash: createHash("sha256")
      .update("crdd-external-send-policy-v2\0")
      .update(canonicalPolicyPayload(withoutHash))
      .digest("hex"),
  });
}

/**
 * Runtime 所有 External Send Policyを一意に解決する。
 *
 * @responsibility Runtime 所有 External Send Policyの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、repositoryBindingCapability: unknown
 * @returns resolveRuntimeOwnedExternalSendPolicyの計算結果を返す。
 * @precondition 「managementCapability: unknown、repositoryBindingCapability: unknown」がresolveRuntimeOwnedExternalSendPolicyの入力契約を満たす。
 * @postcondition resolveRuntimeOwnedExternalSendPolicyの責務を完了した結果だけを返す。
 * @effect N/A: resolveRuntimeOwnedExternalSendPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveRuntimeOwnedExternalSendPolicyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveRuntimeOwnedExternalSendPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRuntimeOwnedExternalSendPolicyはProcess内の同一Subsystemで完結する。
 * @security resolveRuntimeOwnedExternalSendPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRuntimeOwnedExternalSendPolicyは共有非同期状態を持たない同期処理である。
 */
export function resolveRuntimeOwnedExternalSendPolicy(
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
) {
  try {
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object"
    ) {
      return null;
    }
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    const source = borrowRuntimeOwnedRepositorySource(
      repositoryBindingCapability,
      managementCapability,
    );
    const repository = verifyRuntimeOwnedRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    if (
      !source ||
      !repository ||
      source.operationId !== operation.operationId ||
      source.revision !== repository.revision
    ) {
      return null;
    }
    const verified = verifyRepositoryRoot(source.repositoryRoot);
    if (verified.status !== "completed") return null;
    const file = readFixedSnapshotFile(
      verified.capability,
      source.revision,
      EXTERNAL_SEND_POLICY_FILE,
      gitFixedSnapshotAdapter,
    );
    if (file?.mode !== "100644") return null;
    const decoded = new TextDecoder("utf-8", { fatal: true }).decode(
      file.bytes,
    );
    const policy = compileExternalSendPolicyCandidate(
      parseUnambiguousJsonDocument(decoded),
      source.revision,
      file.sha256,
    );
    const reverified = verifyRuntimeOwnedRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    if (!policy || reverified?.revision !== policy.sourceRevision) return null;
    if (!policy.enabled) {
      return Object.freeze({
        status: "disabled" as const,
        capability: null,
        policyId: policy.policyId,
        policyHash: policy.policyHash,
        sourceRevision: policy.sourceRevision,
        hostPathReported: false,
        rawPolicyReported: false,
      });
    }
    const capability = Object.freeze({});
    policies.set(
      capability,
      Object.freeze({
        managementCapability,
        repositoryBindingCapability,
        operationId: operation.operationId,
        policy,
      }),
    );
    return Object.freeze({
      status: "resolved" as const,
      capability,
      policyId: policy.policyId,
      policyHash: policy.policyHash,
      informationClassification: policy.informationClassification,
      candidatePersistenceAllowed: policy.candidatePersistenceAllowed,
      candidateRetentionHours: policy.candidateRetentionHours,
      candidatePhysicalDeletion: policy.candidatePhysicalDeletion,
      sourceRevision: policy.sourceRevision,
      hostPathReported: false,
      rawPolicyReported: false,
    });
  } catch {
    return null;
  }
}

/**
 * Runtime 所有 External Send Policyを検証する。
 *
 * @responsibility Runtime 所有 External Send Policyの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000015
 * @input capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown
 * @returns verifyRuntimeOwnedExternalSendPolicyの計算結果を返す。
 * @precondition 「capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown」がverifyRuntimeOwnedExternalSendPolicyの入力契約を満たす。
 * @postcondition verifyRuntimeOwnedExternalSendPolicyの責務を完了した結果だけを返す。
 * @effect N/A: verifyRuntimeOwnedExternalSendPolicyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure verifyRuntimeOwnedExternalSendPolicyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant verifyRuntimeOwnedExternalSendPolicyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: verifyRuntimeOwnedExternalSendPolicyはProcess内の同一Subsystemで完結する。
 * @security verifyRuntimeOwnedExternalSendPolicyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyRuntimeOwnedExternalSendPolicyは共有非同期状態を持たない同期処理である。
 */
export function verifyRuntimeOwnedExternalSendPolicy(
  capability: unknown,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
) {
  try {
    if (!capability || typeof capability !== "object") return null;
    const record = policies.get(capability);
    if (
      !record ||
      record.managementCapability !== managementCapability ||
      record.repositoryBindingCapability !== repositoryBindingCapability
    ) {
      return null;
    }
    const repository = verifyRuntimeOwnedRepositoryBindingCapability(
      repositoryBindingCapability,
      managementCapability,
    );
    return repository?.revision === record.policy.sourceRevision
      ? record.policy
      : null;
  } catch {
    return null;
  }
}

/**
 * External Send Policy Runtime 契約の公開契約を記述する。
 *
 * @responsibility External Send Policy Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeExternalSendPolicyRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeExternalSendPolicyRuntimeContractの入力契約を満たす。
 * @postcondition describeExternalSendPolicyRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeExternalSendPolicyRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeExternalSendPolicyRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeExternalSendPolicyRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeExternalSendPolicyRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeExternalSendPolicyRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeExternalSendPolicyRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeExternalSendPolicyRuntimeContract() {
  return Object.freeze({
    contract: EXTERNAL_SEND_POLICY_RUNTIME_CONTRACT,
    contractRevision: EXTERNAL_SEND_POLICY_RUNTIME_CONTRACT_REVISION,
    fixedRepositoryFile: EXTERNAL_SEND_POLICY_FILE,
    source: "exact_bound_repository_commit",
    informationClassifications: Object.freeze([
      "public",
      "internal",
      "confidential",
    ]),
    requiredBoundaryFields: Object.freeze([
      "provider",
      "account_tenant_boundary",
      "subscription_offering",
      "purpose_operations",
      "retention_deletion",
      "secondary_use_training",
      "onward_transfer_subprocessing",
      "terms_policy_identity",
    ]),
    unknownPolicy: "blocked",
    repositoryPolicyAuthority:
      "proposal_only_until_interactive_authenticated_local_user_confirmation",
    legalTermsRuntimeVerified: false,
    hostPathReported: false,
  });
}
