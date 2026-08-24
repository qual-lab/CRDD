import { createHash } from "node:crypto";

import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { readGitCommitFileCandidate } from "./git-object-reader.ts";
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
export const EXTERNAL_SEND_POLICY_RUNTIME_CONTRACT_REVISION = 1;
export const EXTERNAL_SEND_POLICY_FILE = ".crdd-external-send-policy.json";

const TOP_LEVEL_KEYS = new Set([
  "schema",
  "policyId",
  "informationClassification",
  "decisionAuthority",
  "candidatePersistenceAllowed",
  "candidateRetentionHours",
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
]);
const PURPOSES = Object.freeze([
  "task_execution",
  "independent_review",
  "bounded_remediation",
]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._/:@+-]{0,255}$/u;

type Provider = "codex" | "claude";
type Destination = Readonly<{
  provider: Provider;
  accountTenantBoundary: string;
  subscriptionOffering: "chatgpt" | "claude_max" | "claude_pro";
  purposeOperations: readonly string[];
  retentionDeletion: string;
  secondaryUseTraining: string;
  onwardTransferSubprocessing: string;
  termsPolicyIdentity: string;
}>;
export type ExternalSendPolicy = Readonly<{
  schema: "crdd-coordinator/external-send-policy/v1";
  policyId: string;
  informationClassification: "public" | "internal" | "confidential";
  decisionAuthority: "authenticated_local_user";
  candidatePersistenceAllowed: boolean;
  candidateRetentionHours: number;
  destinations: readonly Destination[];
  policyHash: string;
  sourceRevision: string;
  sourceFileHash: string;
}>;
type PolicyRecord = Readonly<{
  managementCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  policy: ExternalSendPolicy;
}>;

const policies = new WeakMap<object, PolicyRecord>();

function safeIdentifier(value: unknown) {
  return typeof value === "string" && SAFE_ID.test(value) ? value : null;
}

function normalizeDestination(raw: unknown): Destination | null {
  const value = snapshotPlainRecord(raw, DESTINATION_KEYS);
  const purposes = value
    ? snapshotPlainArray<string>(value.purposeOperations, PURPOSES.length)
    : null;
  const provider = value?.provider;
  const offering = value?.subscriptionOffering;
  if (
    !value ||
    (provider !== "codex" && provider !== "claude") ||
    !safeIdentifier(value.accountTenantBoundary) ||
    !safeIdentifier(value.retentionDeletion) ||
    !safeIdentifier(value.secondaryUseTraining) ||
    !safeIdentifier(value.onwardTransferSubprocessing) ||
    !safeIdentifier(value.termsPolicyIdentity) ||
    purposes?.status !== "ok" ||
    purposes.value.length !== PURPOSES.length ||
    purposes.value.some((item, index) => item !== PURPOSES[index]) ||
    (provider === "codex"
      ? offering !== "chatgpt"
      : offering !== "claude_max" && offering !== "claude_pro")
  ) {
    return null;
  }
  return Object.freeze({
    provider,
    accountTenantBoundary: value.accountTenantBoundary as string,
    subscriptionOffering: offering as "chatgpt" | "claude_max" | "claude_pro",
    purposeOperations: PURPOSES,
    retentionDeletion: value.retentionDeletion as string,
    secondaryUseTraining: value.secondaryUseTraining as string,
    onwardTransferSubprocessing: value.onwardTransferSubprocessing as string,
    termsPolicyIdentity: value.termsPolicyIdentity as string,
  });
}

function canonicalPolicyPayload(
  policy: Omit<ExternalSendPolicy, "policyHash">,
) {
  return JSON.stringify({
    schema: policy.schema,
    policyId: policy.policyId,
    informationClassification: policy.informationClassification,
    decisionAuthority: policy.decisionAuthority,
    candidatePersistenceAllowed: policy.candidatePersistenceAllowed,
    candidateRetentionHours: policy.candidateRetentionHours,
    destinations: policy.destinations.map((destination) => ({
      provider: destination.provider,
      accountTenantBoundary: destination.accountTenantBoundary,
      subscriptionOffering: destination.subscriptionOffering,
      purposeOperations: destination.purposeOperations,
      retentionDeletion: destination.retentionDeletion,
      secondaryUseTraining: destination.secondaryUseTraining,
      onwardTransferSubprocessing: destination.onwardTransferSubprocessing,
      termsPolicyIdentity: destination.termsPolicyIdentity,
    })),
    sourceRevision: policy.sourceRevision,
    sourceFileHash: policy.sourceFileHash,
  });
}

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
    value?.schema !== "crdd-coordinator/external-send-policy/v1" ||
    !safeIdentifier(value.policyId) ||
    !["public", "internal", "confidential"].includes(
      value.informationClassification as string,
    ) ||
    value.decisionAuthority !== "authenticated_local_user" ||
    typeof value.candidatePersistenceAllowed !== "boolean" ||
    !Number.isSafeInteger(value.candidateRetentionHours) ||
    (value.candidateRetentionHours as number) < 1 ||
    (value.candidateRetentionHours as number) > 168 ||
    !destinations ||
    destinations.length !== 2 ||
    destinations.some((item) => item === null) ||
    destinations[0]?.provider !== "codex" ||
    destinations[1]?.provider !== "claude"
  ) {
    return null;
  }
  const withoutHash = Object.freeze({
    schema: "crdd-coordinator/external-send-policy/v1" as const,
    policyId: value.policyId as string,
    informationClassification: value.informationClassification as
      | "public"
      | "internal"
      | "confidential",
    decisionAuthority: "authenticated_local_user" as const,
    candidatePersistenceAllowed: value.candidatePersistenceAllowed,
    candidateRetentionHours: value.candidateRetentionHours as number,
    destinations: Object.freeze(destinations as Destination[]),
    sourceRevision,
    sourceFileHash,
  });
  return Object.freeze({
    ...withoutHash,
    policyHash: createHash("sha256")
      .update("crdd-external-send-policy-v1\0")
      .update(canonicalPolicyPayload(withoutHash))
      .digest("hex"),
  });
}

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
    const file = readGitCommitFileCandidate({
      commonDirectory: source.commonDirectory,
      revision: source.revision,
      relativePath: EXTERNAL_SEND_POLICY_FILE,
    });
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
      sourceRevision: policy.sourceRevision,
      hostPathReported: false,
      rawPolicyReported: false,
    });
  } catch {
    return null;
  }
}

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
    hostPathReported: false,
  });
}
