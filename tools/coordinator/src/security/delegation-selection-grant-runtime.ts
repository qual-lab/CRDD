import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  DELEGATION_ROUTE_SELECTION_CONTRACT,
  selectDelegationRouteCandidate,
} from "./delegation-route-selection.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";

export const DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/delegation-selection-grant-runtime";
export const DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT_REVISION = 1;

const SELECTION_LIFETIME_MS = 30_000;
const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const EXACT_MODEL_ID = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

type Provider = "codex" | "claude";
type CandidateRoute = Extract<
  ReturnType<typeof selectDelegationRouteCandidate>,
  { status: "candidate" }
>;
type ResolvedModelProfile = Readonly<{
  provider: Provider;
  profileId: string;
  exactModelId: string;
  family: string;
  modelTier: string;
  speedMode: "normal";
  billingMode: "subscription_oauth";
}>;
type SelectionRecord = {
  selectionRecordId: string;
  operationId: string;
  managementCapability: object;
  route: CandidateRoute;
  profile: ResolvedModelProfile;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
  controlCapability: object;
  useCapability: object;
};
type RuntimeState = Readonly<{
  records: Map<string, SelectionRecord>;
  controlCapabilities: WeakMap<object, string>;
  useCapabilities: WeakMap<object, string>;
  verifyOperation: (
    managementCapability: unknown,
  ) => Readonly<{ operationId: string; createdAt: string }>;
  observeAvailableProviders: () => readonly Provider[] | null;
  resolveModelProfile: (route: CandidateRoute) => ResolvedModelProfile | null;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
}>;

function createRuntimeState(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
): RuntimeState {
  return Object.freeze({
    records: new Map(),
    controlCapabilities: new WeakMap(),
    useCapabilities: new WeakMap(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperation: verifyOwnedOperationManagementCapability,
  observeAvailableProviders: () => null,
  resolveModelProfile: () => null,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
});

function createBlockedResult(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    selectionRecordId: null,
    controlCapability: null,
    useCapability: null,
    operationId: null,
    frontProvider: null,
    executorProvider: null,
    route: null,
    profileId: null,
    selectedModel: null,
    selectedEffort: null,
    speedMode: null,
    selectionNotice: null,
    expiresInMs: null,
    selectionCapabilityIssued: false,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}

function performSafely<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return createBlockedResult(reason);
  }
}

function createSelectionRecordId(state: RuntimeState) {
  const value = state.randomBytes(12);
  return Buffer.isBuffer(value) && value.byteLength === 12
    ? `MODELSEL-${value.toString("hex").toUpperCase()}`
    : null;
}

function isResolvedProfileValid(
  profile: ResolvedModelProfile,
  route: CandidateRoute,
) {
  return (
    profile.provider === route.executorProvider &&
    PROFILE_ID.test(profile.profileId) &&
    EXACT_MODEL_ID.test(profile.exactModelId) &&
    profile.family === route.modelSelection.familyPreference &&
    profile.modelTier === route.modelSelection.modelTier &&
    profile.speedMode === "normal" &&
    profile.billingMode === "subscription_oauth"
  );
}

function isSelectionFresh(state: RuntimeState, record: SelectionRecord) {
  const wallAge = state.wallNow() - record.issuedWallClockMs;
  const monotonicAge = state.monotonicNow() - record.issuedMonotonicMs;
  return (
    Number.isFinite(wallAge) &&
    Number.isFinite(monotonicAge) &&
    wallAge >= 0 &&
    monotonicAge >= 0 &&
    wallAge < SELECTION_LIFETIME_MS &&
    monotonicAge < SELECTION_LIFETIME_MS
  );
}

function removeSelectionRecord(state: RuntimeState, record: SelectionRecord) {
  state.records.delete(record.selectionRecordId);
  state.controlCapabilities.delete(record.controlCapability);
  state.useCapabilities.delete(record.useCapability);
}

function issueSelectionGrant(
  state: RuntimeState,
  managementCapability: unknown,
  rawRequest: unknown,
) {
  if (!managementCapability || typeof managementCapability !== "object") {
    return createBlockedResult(
      "delegation_selection_management_capability_invalid",
    );
  }
  const operation = state.verifyOperation(managementCapability);
  const availableProviders = state.observeAvailableProviders();
  if (!availableProviders) {
    return createBlockedResult(
      "delegation_selection_provider_observation_unavailable",
    );
  }
  const route = selectDelegationRouteCandidate(rawRequest, {
    availableProviders,
  });
  if (
    route.status !== "candidate" ||
    route.operationId !== operation.operationId
  ) {
    return createBlockedResult("delegation_selection_route_invalid");
  }
  const profile = state.resolveModelProfile(route);
  if (!profile || !isResolvedProfileValid(profile, route)) {
    return createBlockedResult("delegation_selection_profile_invalid");
  }
  const issuedWallClockMs = state.wallNow();
  const issuedMonotonicMs = state.monotonicNow();
  const selectionRecordId = createSelectionRecordId(state);
  if (
    !Number.isFinite(issuedWallClockMs) ||
    !Number.isFinite(issuedMonotonicMs) ||
    issuedWallClockMs < 0 ||
    issuedMonotonicMs < 0 ||
    !selectionRecordId ||
    state.records.has(selectionRecordId)
  ) {
    return createBlockedResult("delegation_selection_runtime_state_invalid");
  }
  const controlCapability = Object.freeze({});
  const useCapability = Object.freeze({});
  const record: SelectionRecord = {
    selectionRecordId,
    operationId: operation.operationId,
    managementCapability,
    route,
    profile,
    issuedWallClockMs,
    issuedMonotonicMs,
    controlCapability,
    useCapability,
  };
  state.records.set(selectionRecordId, record);
  state.controlCapabilities.set(controlCapability, selectionRecordId);
  state.useCapabilities.set(useCapability, selectionRecordId);
  return Object.freeze({
    status: "issued" as const,
    reason: "delegation_selection_grant_issued",
    selectionRecordId,
    controlCapability,
    useCapability,
    operationId: operation.operationId,
    frontProvider: route.frontProvider,
    executorProvider: route.executorProvider,
    route: route.route,
    profileId: profile.profileId,
    selectedModel: profile.exactModelId,
    selectedEffort: route.modelSelection.effort,
    speedMode: profile.speedMode,
    selectionNotice: route.selectionNotice,
    expiresInMs: SELECTION_LIFETIME_MS,
    selectionCapabilityIssued: true,
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}

function findSelectionRecord(
  state: RuntimeState,
  capability: unknown,
  aliases: WeakMap<object, string>,
  managementCapability: unknown,
) {
  if (
    !capability ||
    typeof capability !== "object" ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return null;
  }
  const recordId = aliases.get(capability);
  const record = recordId ? state.records.get(recordId) : null;
  return record?.managementCapability === managementCapability ? record : null;
}

function consumeSelectionGrant(
  state: RuntimeState,
  useCapability: unknown,
  managementCapability: unknown,
) {
  const record = findSelectionRecord(
    state,
    useCapability,
    state.useCapabilities,
    managementCapability,
  );
  if (!record || !isSelectionFresh(state, record)) {
    if (record) removeSelectionRecord(state, record);
    return null;
  }
  removeSelectionRecord(state, record);
  return Object.freeze({
    selectionRecordId: record.selectionRecordId,
    operationId: record.operationId,
    frontProvider: record.route.frontProvider,
    executorProvider: record.route.executorProvider,
    route: record.route.route,
    profileId: record.profile.profileId,
    model: record.profile.exactModelId,
    basis: record.route.modelSelectionBasis,
    effort: record.route.modelSelection.effort,
    modelTier: record.route.modelSelection.modelTier,
    speedMode: record.profile.speedMode,
    selectionNotice: record.route.selectionNotice,
    delegationDepth: record.route.delegationDepth,
  });
}

function revokeSelectionGrant(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const record = findSelectionRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!record) {
    return createBlockedResult("delegation_selection_control_invalid");
  }
  removeSelectionRecord(state, record);
  return Object.freeze({
    ...createBlockedResult("delegation_selection_grant_revoked"),
    status: "revoked" as const,
    reason: "delegation_selection_grant_revoked",
    selectionRecordId: record.selectionRecordId,
    operationId: record.operationId,
  });
}

function supersedeSelectionGrant(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
  rawReplacementRequest: unknown,
) {
  const previousRecord = findSelectionRecord(
    state,
    controlCapability,
    state.controlCapabilities,
    managementCapability,
  );
  if (!previousRecord || !isSelectionFresh(state, previousRecord)) {
    if (previousRecord) removeSelectionRecord(state, previousRecord);
    return createBlockedResult("delegation_selection_control_invalid");
  }

  const replacement = issueSelectionGrant(
    state,
    managementCapability,
    rawReplacementRequest,
  );
  if (replacement.status !== "issued") {
    return replacement;
  }

  removeSelectionRecord(state, previousRecord);
  return Object.freeze({
    ...replacement,
    reason: "delegation_selection_grant_superseded",
    supersededSelectionRecordId: previousRecord.selectionRecordId,
  });
}

export function issueRuntimeOwnedDelegationSelectionGrant(
  managementCapability: unknown,
  rawRequest: unknown,
) {
  return performSafely("delegation_selection_issue_failed_closed", () =>
    issueSelectionGrant(productionState, managementCapability, rawRequest),
  );
}

export function consumeRuntimeOwnedDelegationSelectionGrant(
  useCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return consumeSelectionGrant(
      productionState,
      useCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

export function revokeRuntimeOwnedDelegationSelectionGrant(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return performSafely("delegation_selection_revoke_failed_closed", () =>
    revokeSelectionGrant(
      productionState,
      controlCapability,
      managementCapability,
    ),
  );
}

export function supersedeRuntimeOwnedDelegationSelectionGrant(
  controlCapability: unknown,
  managementCapability: unknown,
  rawReplacementRequest: unknown,
) {
  return performSafely("delegation_selection_supersede_failed_closed", () =>
    supersedeSelectionGrant(
      productionState,
      controlCapability,
      managementCapability,
      rawReplacementRequest,
    ),
  );
}

export function createIsolatedDelegationSelectionGrantRuntimeCandidate(
  dependencies: Omit<
    RuntimeState,
    "records" | "controlCapabilities" | "useCapabilities"
  >,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    issue: (managementCapability: unknown, rawRequest: unknown) =>
      performSafely("delegation_selection_issue_failed_closed", () =>
        issueSelectionGrant(state, managementCapability, rawRequest),
      ),
    consume: (useCapability: unknown, managementCapability: unknown) => {
      try {
        return consumeSelectionGrant(
          state,
          useCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      performSafely("delegation_selection_revoke_failed_closed", () =>
        revokeSelectionGrant(state, controlCapability, managementCapability),
      ),
    supersede: (
      controlCapability: unknown,
      managementCapability: unknown,
      rawReplacementRequest: unknown,
    ) =>
      performSafely("delegation_selection_supersede_failed_closed", () =>
        supersedeSelectionGrant(
          state,
          controlCapability,
          managementCapability,
          rawReplacementRequest,
        ),
      ),
  });
}

export function describeDelegationSelectionGrantRuntimeContract() {
  return Object.freeze({
    contract: DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT,
    contractRevision: DELEGATION_SELECTION_GRANT_RUNTIME_CONTRACT_REVISION,
    routeContract: DELEGATION_ROUTE_SELECTION_CONTRACT,
    selectionLifetimeMs: SELECTION_LIFETIME_MS,
    clocks: Object.freeze(["runtime_wall", "runtime_monotonic"]),
    aliases: Object.freeze(["control", "use"]),
    maximumUses: 1,
    operationBinding: "runtime_owned_management_capability",
    providerAvailability:
      "runtime_observation_required_production_not_connected",
    exactModelId: "verified_provider_profile_required",
    billingMode: "subscription_oauth_only",
    speedMode: "normal_only",
    selectionNotice: "issued_before_provider_effect",
    providerFallback: "forbidden_after_selection",
    reselection: "atomic_process_local_supersede_after_replacement_validation",
    providerAuthorityIssued: false,
    providerEffectAllowed: false,
  });
}
