import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { selectProviderModelCandidate } from "./provider-model-selection-runtime.ts";

export const DELEGATION_ROUTE_SELECTION_CONTRACT =
  "crdd-coordinator/delegation-route-selection";
export const DELEGATION_ROUTE_SELECTION_CONTRACT_REVISION = 1;

const MAXIMUM_DELEGATION_DEPTH = 2;
const MAXIMUM_ANCESTOR_OPERATIONS = 2;
const OPERATION_ID = /^OP-[0-9]{6,}$/u;
const REQUEST_KEYS = new Set([
  "frontProvider",
  "requestedExecutorProvider",
  "subjectProvider",
  "requiresIndependentProvider",
  "role",
  "workClass",
  "planState",
  "risk",
  "difficulty",
  "decisionImpact",
  "isLocalCandidateOnly",
  "hasUnresolvedDirection",
  "requiresCrossContextAlignment",
  "operationId",
  "parentOperationId",
  "ancestorOperationIds",
  "delegationDepth",
]);
const OBSERVATION_KEYS = new Set(["availableProviders"]);
const PROVIDERS = new Set(["codex", "claude"]);
const REQUESTED_PROVIDERS = new Set(["auto", "codex", "claude"]);
const ROLES = new Set([
  "coordinator",
  "executor",
  "independent_reviewer",
  "result_integration",
]);
const WORK_CLASSES = new Set([
  "bounded_implementation",
  "bounded_verification",
  "diagnosis",
  "design_alignment",
  "architecture_review",
  "security_review",
  "gap_impact_audit",
]);
const PLAN_STATES = new Set(["complete", "partial", "open"]);
const RISKS = new Set(["low", "material", "high"]);
const DIFFICULTIES = new Set(["low", "medium", "high"]);
const DECISION_IMPACTS = new Set(["limited", "material", "critical"]);

type Provider = "codex" | "claude";

function createBlockedResult(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    frontProvider: null,
    executorProvider: null,
    route: null,
    selectionReasonCodes: Object.freeze([] as string[]),
    selectionNotice: null,
    modelSelection: null,
    modelSelectionBasis: null,
    delegationDepth: null,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
    directProviderSpawnAllowed: false,
  });
}

function isProvider(value: unknown): value is Provider {
  return typeof value === "string" && PROVIDERS.has(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function selectPreferredProvider(
  role: unknown,
  workClass: unknown,
  subjectProvider: Provider | null,
  shouldUseIndependentProvider: boolean,
): Provider {
  if (shouldUseIndependentProvider && subjectProvider) {
    return subjectProvider === "codex" ? "claude" : "codex";
  }
  if (
    role === "independent_reviewer" ||
    role === "result_integration" ||
    role === "coordinator" ||
    workClass === "bounded_verification" ||
    workClass === "diagnosis" ||
    workClass === "design_alignment" ||
    workClass === "architecture_review" ||
    workClass === "security_review" ||
    workClass === "gap_impact_audit"
  ) {
    return "codex";
  }
  return "claude";
}

function selectExecutorProvider(
  requestedProvider: "auto" | Provider,
  preferredProvider: Provider,
  availableProviders: ReadonlySet<Provider>,
  subjectProvider: Provider | null,
  shouldUseIndependentProvider: boolean,
) {
  const candidates = (["codex", "claude"] as const).filter(
    (provider) =>
      availableProviders.has(provider) &&
      (!shouldUseIndependentProvider || provider !== subjectProvider),
  );
  if (requestedProvider !== "auto") {
    return candidates.includes(requestedProvider)
      ? Object.freeze({
          provider: requestedProvider,
          reason: "user_executor_constraint_satisfied",
        })
      : null;
  }
  if (candidates.includes(preferredProvider)) {
    return Object.freeze({
      provider: preferredProvider,
      reason: "role_and_work_class_preference",
    });
  }
  const alternateProvider = candidates[0];
  return alternateProvider
    ? Object.freeze({
        provider: alternateProvider,
        reason: "preferred_provider_unavailable_before_selection",
      })
    : null;
}

function validateOperationChain(
  operationId: unknown,
  parentOperationId: unknown,
  rawAncestorOperationIds: unknown,
  delegationDepth: unknown,
) {
  if (
    typeof operationId !== "string" ||
    !OPERATION_ID.test(operationId) ||
    !Number.isSafeInteger(delegationDepth) ||
    typeof delegationDepth !== "number" ||
    delegationDepth < 0 ||
    delegationDepth >= MAXIMUM_DELEGATION_DEPTH
  ) {
    return null;
  }
  const ancestors = snapshotPlainArray<unknown>(
    rawAncestorOperationIds,
    MAXIMUM_ANCESTOR_OPERATIONS,
  );
  if (
    ancestors.status !== "ok" ||
    !ancestors.value.every(
      (ancestor): ancestor is string =>
        typeof ancestor === "string" && OPERATION_ID.test(ancestor),
    ) ||
    new Set(ancestors.value).size !== ancestors.value.length ||
    ancestors.value.includes(operationId) ||
    ancestors.value.length !== delegationDepth
  ) {
    return null;
  }
  if (
    (delegationDepth === 0 && parentOperationId !== null) ||
    (delegationDepth > 0 &&
      (typeof parentOperationId !== "string" ||
        parentOperationId !== ancestors.value.at(-1)))
  ) {
    return null;
  }
  return Object.freeze({
    operationId,
    parentOperationId: parentOperationId as string | null,
    ancestorOperationIds: ancestors.value,
    delegationDepth,
  });
}

function describeSelectionNotice(
  frontProvider: Provider,
  executorProvider: Provider,
  route: string,
  reasonCodes: readonly string[],
  modelNotice: string,
) {
  return [
    `[委譲経路選定] front=${frontProvider} executor=${executorProvider} route=${route}`,
    `経路選定理由=${reasonCodes.join(",")}`,
    modelNotice,
    "再選定条件=availability_change,scope_change,authority_change,policy_conflict",
  ].join("\n");
}

export function selectDelegationRouteCandidate(
  rawRequest: unknown,
  rawRuntimeObservation: unknown,
) {
  const request = snapshotPlainRecord(rawRequest, REQUEST_KEYS);
  const observation = snapshotPlainRecord(
    rawRuntimeObservation,
    OBSERVATION_KEYS,
  );
  if (!request || !observation) {
    return createBlockedResult("delegation_route_shape_invalid");
  }
  if (
    !isProvider(request.frontProvider) ||
    typeof request.requestedExecutorProvider !== "string" ||
    !REQUESTED_PROVIDERS.has(request.requestedExecutorProvider) ||
    (request.subjectProvider !== null &&
      !isProvider(request.subjectProvider)) ||
    !isBoolean(request.requiresIndependentProvider) ||
    !ROLES.has(request.role as string) ||
    !WORK_CLASSES.has(request.workClass as string) ||
    !PLAN_STATES.has(request.planState as string) ||
    !RISKS.has(request.risk as string) ||
    !DIFFICULTIES.has(request.difficulty as string) ||
    !DECISION_IMPACTS.has(request.decisionImpact as string) ||
    !isBoolean(request.isLocalCandidateOnly) ||
    !isBoolean(request.hasUnresolvedDirection) ||
    !isBoolean(request.requiresCrossContextAlignment)
  ) {
    return createBlockedResult("delegation_route_request_invalid");
  }
  if (
    (request.requiresIndependentProvider === true &&
      request.subjectProvider === null) ||
    (request.role === "independent_reviewer" &&
      request.requiresIndependentProvider !== true)
  ) {
    return createBlockedResult("delegation_route_independence_invalid");
  }
  const operationChain = validateOperationChain(
    request.operationId,
    request.parentOperationId,
    request.ancestorOperationIds,
    request.delegationDepth,
  );
  if (!operationChain) {
    return createBlockedResult("delegation_route_operation_chain_invalid");
  }
  const available = snapshotPlainArray<unknown>(
    observation.availableProviders,
    PROVIDERS.size,
  );
  if (
    available.status !== "ok" ||
    !available.value.every(isProvider) ||
    new Set(available.value).size !== available.value.length
  ) {
    return createBlockedResult("delegation_route_availability_invalid");
  }
  const subjectProvider = request.subjectProvider as Provider | null;
  const preferredProvider = selectPreferredProvider(
    request.role,
    request.workClass,
    subjectProvider,
    request.requiresIndependentProvider,
  );
  const selected = selectExecutorProvider(
    request.requestedExecutorProvider as "auto" | Provider,
    preferredProvider,
    new Set(available.value),
    subjectProvider,
    request.requiresIndependentProvider,
  );
  if (!selected) {
    return createBlockedResult("delegation_route_executor_unavailable");
  }
  const executorProvider = selected.provider;
  const modelSelectionBasis = Object.freeze({
    provider: executorProvider,
    role: request.role,
    workClass: request.workClass,
    planState: request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: request.isLocalCandidateOnly,
    hasUnresolvedDirection: request.hasUnresolvedDirection,
    requiresCrossContextAlignment: request.requiresCrossContextAlignment,
  });
  const modelSelection = selectProviderModelCandidate(modelSelectionBasis);
  if (
    modelSelection.status !== "candidate" ||
    !modelSelection.selectionNotice
  ) {
    return createBlockedResult("delegation_route_model_selection_invalid");
  }
  const route = `front_${request.frontProvider}__executor_${executorProvider}`;
  const selectionReasonCodes = Object.freeze([
    selected.reason,
    request.requiresIndependentProvider
      ? "independent_provider_required"
      : "same_provider_route_allowed",
    `work_class_${request.workClass}`,
  ]);
  return Object.freeze({
    status: "candidate" as const,
    reason: "runtime_owned_selection_grant_required",
    frontProvider: request.frontProvider,
    executorProvider,
    route,
    selectionReasonCodes,
    selectionNotice: describeSelectionNotice(
      request.frontProvider,
      executorProvider,
      route,
      selectionReasonCodes,
      modelSelection.selectionNotice,
    ),
    modelSelection,
    modelSelectionBasis,
    operationId: operationChain.operationId,
    parentOperationId: operationChain.parentOperationId,
    ancestorOperationIds: operationChain.ancestorOperationIds,
    delegationDepth: operationChain.delegationDepth + 1,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
    directProviderSpawnAllowed: false,
  });
}

export function describeDelegationRouteSelectionContract() {
  return Object.freeze({
    contract: DELEGATION_ROUTE_SELECTION_CONTRACT,
    contractRevision: DELEGATION_ROUTE_SELECTION_CONTRACT_REVISION,
    supportedRoutes: Object.freeze([
      "front_codex__executor_codex",
      "front_codex__executor_claude",
      "front_claude__executor_codex",
      "front_claude__executor_claude",
    ]),
    frontAndExecutorIndependentAxes: true,
    automaticSelection: "before_provider_effect_from_closed_runtime_facts",
    explicitUserExecutorConstraint:
      "restricts_candidates_never_silently_ignored",
    ordinaryImplementationPreference: "claude",
    verificationCoordinationAndReviewPreference: "codex",
    independentReview: "subject_provider_excluded",
    sameProviderRoute: "allowed_through_coordinator_gate_only",
    maximumDelegationDepth: MAXIMUM_DELEGATION_DEPTH,
    cyclicOperationChainAllowed: false,
    directProviderSpawnAllowed: false,
    availabilityChangeAfterSelection:
      "return_to_coordinator_for_superseding_selection_grant",
    callerAvailabilityClaimTrusted: false,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}
