import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  compileProviderHomeMountGrantCandidate,
  evaluateProviderHomeMountGrantTransitionCandidate,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
  PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
  PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
} from "./provider-home-mount-grant.ts";
import {
  consumeRuntimeOwnedProviderHomeMountSourceCapability,
  consumeRuntimeOwnedProviderHomeObservationCapability,
  revokeRuntimeOwnedProviderHomeMountSourceCapability,
} from "./provider-home-windows-adapter.ts";

export const PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/provider-home-mount-grant-runtime";
export const PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT_REVISION = 2;

const PROFILE_ID = /^PROFILE-[0-9]{6,}$/u;
const MAXIMUM_IDENTIFIER_LENGTH = 64;
const GRANT_REFERENCE_DIGITS = 18;
const MAXIMUM_REFERENCE_ATTEMPTS = 8;

type Grant = Readonly<{
  contract: typeof PROVIDER_HOME_MOUNT_GRANT_CONTRACT;
  contractRevision: typeof PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION;
  grantRef: string;
  provider: string;
  profileId: string;
  operationId: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  state: string;
  issuedAt: string | null;
  expiresAt: string | null;
  consumedAt: string | null;
  revokedAt: string | null;
  usageLimit: 1;
  consumptionCount: 0 | 1;
}>;

type AliasRole = "control" | "use" | "mount_authorization" | "active_mount";

type RuntimeGrant = {
  grant: Grant;
  managementCapability: object;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
  aliases: Set<object>;
  mountActive: boolean;
  mountSourceCapability: object | null;
  activeMountSourcePath: string | null;
};

type Observation = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedProviderHomeObservationCapability>
>;

type RuntimeState = Readonly<{
  aliases: WeakMap<
    object,
    Readonly<{ role: AliasRole; runtimeGrant: RuntimeGrant }>
  >;
  activeGrants: Map<string, RuntimeGrant>;
  activeHomeBindings: Map<string, RuntimeGrant>;
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  consumeObservation: (capability: unknown) => Observation | null;
  consumeMountSource: typeof consumeRuntimeOwnedProviderHomeMountSourceCapability;
  revokeMountSource: typeof revokeRuntimeOwnedProviderHomeMountSourceCapability;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
  production: boolean;
}>;

function createRuntimeState(
  dependencies: Pick<
    RuntimeState,
    | "verifyOperation"
    | "consumeObservation"
    | "consumeMountSource"
    | "revokeMountSource"
    | "wallNow"
    | "monotonicNow"
    | "randomBytes"
    | "production"
  >,
): RuntimeState {
  return Object.freeze({
    aliases: new WeakMap(),
    activeGrants: new Map(),
    activeHomeBindings: new Map(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperation: verifyOwnedOperationManagementCapability,
  consumeObservation: consumeRuntimeOwnedProviderHomeObservationCapability,
  consumeMountSource: consumeRuntimeOwnedProviderHomeMountSourceCapability,
  revokeMountSource: revokeRuntimeOwnedProviderHomeMountSourceCapability,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
  production: true,
});

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    grant: null,
    grantRef: null,
    controlCapability: null,
    useCapability: null,
    mountAuthorizationCapability: null,
    activeMountCapability: null,
    providerHomeMountGrantIssued: false,
    mountAuthorizationIssued: false,
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    pathReported: false,
    credentialReported: false,
  });
}

function failClosed<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return blocked(reason);
  }
}

function validProfileId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= MAXIMUM_IDENTIFIER_LENGTH &&
    PROFILE_ID.test(value)
  );
}

function runtimeGrantRef(state: RuntimeState) {
  for (let attempt = 0; attempt < MAXIMUM_REFERENCE_ATTEMPTS; attempt += 1) {
    const random = state.randomBytes(8).readBigUInt64BE();
    const digits = (random % 10n ** BigInt(GRANT_REFERENCE_DIGITS))
      .toString(10)
      .padStart(GRANT_REFERENCE_DIGITS, "0");
    const grantRef = `PHMGRANT-${digits}`;
    if (!state.activeGrants.has(grantRef)) return grantRef;
  }
  return null;
}

function createAlias(
  state: RuntimeState,
  runtimeGrant: RuntimeGrant,
  role: AliasRole,
) {
  const capability = Object.freeze({});
  state.aliases.set(capability, Object.freeze({ role, runtimeGrant }));
  runtimeGrant.aliases.add(capability);
  return capability;
}

function alias(
  state: RuntimeState,
  capability: unknown,
  expectedRole: AliasRole,
): Readonly<{ role: AliasRole; runtimeGrant: RuntimeGrant }> | null {
  if (!capability || typeof capability !== "object") return null;
  const value = state.aliases.get(capability);
  return value?.role === expectedRole ? value : null;
}

function operationBinding(
  state: RuntimeState,
  managementCapability: unknown,
): Readonly<{ operationId: string; createdAt: string }> | null {
  try {
    return state.verifyOperation(managementCapability);
  } catch {
    return null;
  }
}

function grantRecord(
  binding: Readonly<{ operationId: string }>,
  profileId: string,
  observation: Observation,
  grantRef: string,
  issuedWallClockMs: number,
): Grant | null {
  const prepared: Grant = Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_CONTRACT_REVISION,
    grantRef,
    provider: observation.provider,
    profileId,
    operationId: binding.operationId,
    providerHomeIdentityHash: observation.providerHomeIdentityHash,
    providerHomeProtectionHash: observation.providerHomeProtectionHash,
    localUserBindingHash: observation.localUserBindingHash,
    stableLogicalHomeBindingHash: observation.stableLogicalHomeBindingHash,
    state: "prepared",
    issuedAt: null,
    expiresAt: null,
    consumedAt: null,
    revokedAt: null,
    usageLimit: 1,
    consumptionCount: 0,
  });
  const issued: Grant = Object.freeze({
    ...prepared,
    state: "issued",
    issuedAt: new Date(issuedWallClockMs).toISOString(),
    expiresAt: new Date(
      issuedWallClockMs + PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
    ).toISOString(),
  });
  const preparedCandidate = compileProviderHomeMountGrantCandidate(prepared);
  const transition = evaluateProviderHomeMountGrantTransitionCandidate({
    previous: prepared,
    next: issued,
  });
  return preparedCandidate.status === "candidate" &&
    transition.status === "candidate"
    ? (transition.grant as Grant)
    : null;
}

function currentRuntimeAge(state: RuntimeState, runtimeGrant: RuntimeGrant) {
  const now = state.wallNow();
  const wallAge = now - runtimeGrant.issuedWallClockMs;
  const monotonicAge = state.monotonicNow() - runtimeGrant.issuedMonotonicMs;
  if (
    !Number.isFinite(wallAge) ||
    !Number.isFinite(monotonicAge) ||
    wallAge < 0 ||
    monotonicAge < 0 ||
    wallAge >= PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS ||
    monotonicAge >= PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS
  ) {
    return null;
  }
  return Object.freeze({ wallAge, monotonicAge, now });
}

function sameManagementCapability(
  state: RuntimeState,
  runtimeGrant: RuntimeGrant,
  managementCapability: unknown,
) {
  if (
    !managementCapability ||
    typeof managementCapability !== "object" ||
    runtimeGrant.managementCapability !== managementCapability
  ) {
    return null;
  }
  const binding = operationBinding(state, managementCapability);
  return binding?.operationId === runtimeGrant.grant.operationId
    ? binding
    : null;
}

function removeAlias(
  state: RuntimeState,
  runtimeGrant: RuntimeGrant,
  capability: object,
) {
  state.aliases.delete(capability);
  runtimeGrant.aliases.delete(capability);
}

function revokeAllAliases(state: RuntimeState, runtimeGrant: RuntimeGrant) {
  for (const capability of runtimeGrant.aliases) {
    state.aliases.delete(capability);
  }
  runtimeGrant.aliases.clear();
}

function revokeMountSource(state: RuntimeState, runtimeGrant: RuntimeGrant) {
  if (runtimeGrant.mountSourceCapability) {
    state.revokeMountSource(runtimeGrant.mountSourceCapability);
    runtimeGrant.mountSourceCapability = null;
  }
}

function issue(
  state: RuntimeState,
  managementCapability: unknown,
  observationCapability: unknown,
  profileId: unknown,
) {
  if (!validProfileId(profileId)) {
    return blocked("provider_home_mount_grant_runtime_profile_invalid");
  }
  const binding = operationBinding(state, managementCapability);
  if (
    !binding ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return blocked("provider_home_mount_grant_runtime_operation_invalid");
  }
  const observation = state.consumeObservation(observationCapability);
  if (!observation) {
    return blocked("provider_home_mount_grant_runtime_observation_invalid");
  }
  const grantRef = runtimeGrantRef(state);
  if (!grantRef) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_reference_unavailable");
  }
  const issuedWallClockMs = state.wallNow();
  const issuedMonotonicMs = state.monotonicNow();
  if (
    !Number.isFinite(issuedWallClockMs) ||
    !Number.isFinite(issuedMonotonicMs) ||
    issuedWallClockMs < 0 ||
    issuedMonotonicMs < 0
  ) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_clock_invalid");
  }
  const grant = grantRecord(
    binding,
    profileId,
    observation,
    grantRef,
    issuedWallClockMs,
  );
  if (!grant) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_issuance_invalid");
  }
  const runtimeGrant: RuntimeGrant = {
    grant,
    managementCapability,
    issuedWallClockMs,
    issuedMonotonicMs,
    aliases: new Set<object>(),
    mountActive: false,
    mountSourceCapability: observation.providerHomeMountSourceCapability,
    activeMountSourcePath: null,
  };
  const controlCapability = createAlias(state, runtimeGrant, "control");
  const useCapability = createAlias(state, runtimeGrant, "use");
  state.activeGrants.set(grantRef, runtimeGrant);
  return Object.freeze({
    ...blocked("provider_home_mount_grant_runtime_issued"),
    status: "issued" as const,
    grant,
    grantRef,
    controlCapability,
    useCapability,
    providerHomeMountGrantIssued: true,
  });
}

function consume(
  state: RuntimeState,
  useCapability: unknown,
  managementCapability: unknown,
  currentObservationCapability: unknown,
) {
  const use = alias(state, useCapability, "use");
  if (
    !use ||
    !useCapability ||
    typeof useCapability !== "object" ||
    !sameManagementCapability(state, use.runtimeGrant, managementCapability)
  ) {
    return blocked("provider_home_mount_grant_runtime_use_invalid");
  }
  const runtimeGrant = use.runtimeGrant;
  if (
    runtimeGrant.grant.state !== "issued" ||
    state.activeGrants.get(runtimeGrant.grant.grantRef) !== runtimeGrant
  ) {
    return blocked("provider_home_mount_grant_runtime_not_usable");
  }
  const observation = state.consumeObservation(currentObservationCapability);
  if (!observation) {
    return blocked("provider_home_mount_grant_runtime_observation_invalid");
  }
  const age = currentRuntimeAge(state, runtimeGrant);
  if (!age) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_expired");
  }
  if (
    observation.provider !== runtimeGrant.grant.provider ||
    observation.providerHomeIdentityHash !==
      runtimeGrant.grant.providerHomeIdentityHash ||
    observation.providerHomeProtectionHash !==
      runtimeGrant.grant.providerHomeProtectionHash ||
    observation.localUserBindingHash !==
      runtimeGrant.grant.localUserBindingHash ||
    observation.stableLogicalHomeBindingHash !==
      runtimeGrant.grant.stableLogicalHomeBindingHash
  ) {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_observation_mismatch");
  }
  const next: Grant = Object.freeze({
    ...runtimeGrant.grant,
    state: "consumed",
    consumedAt: new Date(age.now).toISOString(),
    consumptionCount: 1,
  });
  const transition = evaluateProviderHomeMountGrantTransitionCandidate({
    previous: runtimeGrant.grant,
    next,
  });
  if (transition.status !== "candidate") {
    state.revokeMountSource(observation.providerHomeMountSourceCapability);
    return blocked("provider_home_mount_grant_runtime_consumption_invalid");
  }
  revokeMountSource(state, runtimeGrant);
  runtimeGrant.mountSourceCapability =
    observation.providerHomeMountSourceCapability;
  runtimeGrant.grant = transition.grant as Grant;
  removeAlias(state, runtimeGrant, useCapability);
  const mountAuthorizationCapability = createAlias(
    state,
    runtimeGrant,
    "mount_authorization",
  );
  return Object.freeze({
    ...blocked("provider_home_mount_grant_runtime_consumed"),
    status: "consumed" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
    mountAuthorizationCapability,
    providerHomeMountGrantIssued: true,
    mountAuthorizationIssued: true,
  });
}

function activateMount(
  state: RuntimeState,
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  const authorization = alias(
    state,
    mountAuthorizationCapability,
    "mount_authorization",
  );
  if (
    !authorization ||
    !mountAuthorizationCapability ||
    typeof mountAuthorizationCapability !== "object" ||
    !sameManagementCapability(
      state,
      authorization.runtimeGrant,
      managementCapability,
    ) ||
    authorization.runtimeGrant.grant.state !== "consumed" ||
    authorization.runtimeGrant.mountActive ||
    !currentRuntimeAge(state, authorization.runtimeGrant)
  ) {
    return blocked("provider_home_mount_activation_invalid");
  }
  const runtimeGrant = authorization.runtimeGrant;
  const logicalHomeBinding = runtimeGrant.grant.stableLogicalHomeBindingHash;
  const currentHomeBinding = state.activeHomeBindings.get(logicalHomeBinding);
  if (currentHomeBinding && currentHomeBinding !== runtimeGrant) {
    return blocked("provider_home_mount_logical_home_already_active");
  }
  const sourcePath = state.consumeMountSource(
    runtimeGrant.mountSourceCapability,
    runtimeGrant.grant.provider,
  );
  runtimeGrant.mountSourceCapability = null;
  if (!sourcePath) {
    return blocked("provider_home_mount_source_binding_invalid");
  }
  runtimeGrant.mountActive = true;
  runtimeGrant.activeMountSourcePath = sourcePath;
  state.activeHomeBindings.set(logicalHomeBinding, runtimeGrant);
  removeAlias(state, runtimeGrant, mountAuthorizationCapability);
  const activeMountCapability = createAlias(
    state,
    runtimeGrant,
    "active_mount",
  );
  return Object.freeze({
    ...blocked("provider_home_mount_activated"),
    status: "activated" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
    activeMountCapability,
    providerHomeMountGrantIssued: true,
    mountAuthorizationIssued: true,
  });
}

function activeMountSource(
  state: RuntimeState,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const active = alias(state, activeMountCapability, "active_mount");
  if (
    !active ||
    !sameManagementCapability(
      state,
      active.runtimeGrant,
      managementCapability,
    ) ||
    !active.runtimeGrant.mountActive ||
    !active.runtimeGrant.activeMountSourcePath
  ) {
    return null;
  }
  return active.runtimeGrant.activeMountSourcePath;
}

function inspectActiveMount(
  state: RuntimeState,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const active = alias(state, activeMountCapability, "active_mount");
  if (
    !active ||
    !sameManagementCapability(
      state,
      active.runtimeGrant,
      managementCapability,
    ) ||
    !active.runtimeGrant.mountActive ||
    !active.runtimeGrant.activeMountSourcePath ||
    !currentRuntimeAge(state, active.runtimeGrant)
  ) {
    return blocked("provider_home_active_mount_inspection_invalid");
  }
  const grant = active.runtimeGrant.grant;
  return Object.freeze({
    ...blocked("provider_home_active_mount_confirmed"),
    status: "active" as const,
    grant,
    grantRef: grant.grantRef,
    provider: grant.provider,
    profileId: grant.profileId,
    operationId: grant.operationId,
    providerHomeMountGrantIssued: true,
    providerHomeMounted: true,
    runtimeAuthorityIssued: false,
  });
}

function completeMount(
  state: RuntimeState,
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  const active = alias(state, activeMountCapability, "active_mount");
  if (
    !active ||
    !activeMountCapability ||
    typeof activeMountCapability !== "object" ||
    !sameManagementCapability(
      state,
      active.runtimeGrant,
      managementCapability,
    ) ||
    !active.runtimeGrant.mountActive ||
    !active.runtimeGrant.activeMountSourcePath
  ) {
    return blocked("provider_home_mount_completion_invalid");
  }
  const runtimeGrant = active.runtimeGrant;
  runtimeGrant.mountActive = false;
  runtimeGrant.activeMountSourcePath = null;
  state.activeHomeBindings.delete(
    runtimeGrant.grant.stableLogicalHomeBindingHash,
  );
  removeAlias(state, runtimeGrant, activeMountCapability);
  return Object.freeze({
    ...blocked("provider_home_mount_completed"),
    status: "completed" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
    providerHomeMountGrantIssued: true,
  });
}

function inspectMountAuthorization(
  state: RuntimeState,
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  const authorization = alias(
    state,
    mountAuthorizationCapability,
    "mount_authorization",
  );
  if (
    !authorization ||
    !sameManagementCapability(
      state,
      authorization.runtimeGrant,
      managementCapability,
    ) ||
    authorization.runtimeGrant.grant.state !== "consumed" ||
    authorization.runtimeGrant.mountActive ||
    !currentRuntimeAge(state, authorization.runtimeGrant)
  ) {
    return blocked("provider_home_mount_authorization_invalid");
  }
  const grant = authorization.runtimeGrant.grant;
  return Object.freeze({
    ...blocked("provider_home_mount_authorization_ready"),
    status: "authorized" as const,
    grant,
    grantRef: grant.grantRef,
    providerHomeMountGrantIssued: true,
    mountAuthorizationIssued: true,
  });
}

function revoke(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  const control = alias(state, controlCapability, "control");
  if (
    !control ||
    !sameManagementCapability(state, control.runtimeGrant, managementCapability)
  ) {
    return blocked("provider_home_mount_grant_runtime_control_invalid");
  }
  const runtimeGrant = control.runtimeGrant;
  if (runtimeGrant.mountActive) {
    return blocked("provider_home_mount_grant_runtime_unmount_required");
  }
  const now = state.wallNow();
  const next: Grant = Object.freeze({
    ...runtimeGrant.grant,
    state: "revoked",
    revokedAt: new Date(
      Math.max(now, Date.parse(runtimeGrant.grant.issuedAt as string)),
    ).toISOString(),
  });
  const transition = evaluateProviderHomeMountGrantTransitionCandidate({
    previous: runtimeGrant.grant,
    next,
  });
  if (transition.status !== "candidate") {
    return blocked("provider_home_mount_grant_runtime_revocation_invalid");
  }
  runtimeGrant.grant = transition.grant as Grant;
  revokeMountSource(state, runtimeGrant);
  revokeAllAliases(state, runtimeGrant);
  state.activeGrants.delete(runtimeGrant.grant.grantRef);
  state.activeHomeBindings.delete(
    runtimeGrant.grant.stableLogicalHomeBindingHash,
  );
  return Object.freeze({
    ...blocked("provider_home_mount_grant_runtime_revoked"),
    status: "revoked" as const,
    grant: runtimeGrant.grant,
    grantRef: runtimeGrant.grant.grantRef,
  });
}

export function issueRuntimeOwnedProviderHomeMountGrant(
  managementCapability: unknown,
  observationCapability: unknown,
  profileId: unknown,
) {
  return failClosed(
    "provider_home_mount_grant_runtime_issuance_failed_closed",
    () =>
      issue(
        productionState,
        managementCapability,
        observationCapability,
        profileId,
      ),
  );
}

export function consumeRuntimeOwnedProviderHomeMountGrant(
  useCapability: unknown,
  managementCapability: unknown,
  currentObservationCapability: unknown,
) {
  return failClosed(
    "provider_home_mount_grant_runtime_consumption_failed_closed",
    () =>
      consume(
        productionState,
        useCapability,
        managementCapability,
        currentObservationCapability,
      ),
  );
}

export function inspectRuntimeOwnedProviderHomeMountAuthorization(
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed(
    "provider_home_mount_authorization_inspection_failed_closed",
    () =>
      inspectMountAuthorization(
        productionState,
        mountAuthorizationCapability,
        managementCapability,
      ),
  );
}

export function revokeRuntimeOwnedProviderHomeMountGrant(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed(
    "provider_home_mount_grant_runtime_revocation_failed_closed",
    () => revoke(productionState, controlCapability, managementCapability),
  );
}

export function activateRuntimeOwnedProviderHomeMount(
  mountAuthorizationCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed("provider_home_mount_activation_failed_closed", () =>
    activateMount(
      productionState,
      mountAuthorizationCapability,
      managementCapability,
    ),
  );
}

export function borrowRuntimeOwnedActiveProviderHomeMountSource(
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return activeMountSource(
      productionState,
      activeMountCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

export function inspectRuntimeOwnedActiveProviderHomeMount(
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed("provider_home_active_mount_inspection_failed_closed", () =>
    inspectActiveMount(
      productionState,
      activeMountCapability,
      managementCapability,
    ),
  );
}

export function completeRuntimeOwnedProviderHomeMount(
  activeMountCapability: unknown,
  managementCapability: unknown,
) {
  return failClosed("provider_home_mount_completion_failed_closed", () =>
    completeMount(productionState, activeMountCapability, managementCapability),
  );
}

export function createIsolatedProviderHomeMountGrantRuntimeCandidate(
  dependencies: Readonly<{
    verifyOperation: RuntimeState["verifyOperation"];
    consumeObservation: RuntimeState["consumeObservation"];
    consumeMountSource: RuntimeState["consumeMountSource"];
    revokeMountSource: RuntimeState["revokeMountSource"];
    wallNow: RuntimeState["wallNow"];
    monotonicNow: RuntimeState["monotonicNow"];
    randomBytes: RuntimeState["randomBytes"];
  }>,
) {
  const state = createRuntimeState({ ...dependencies, production: false });
  return Object.freeze({
    productionAuthority: false as const,
    issue: (
      managementCapability: unknown,
      observationCapability: unknown,
      profileId: unknown,
    ) =>
      failClosed(
        "provider_home_mount_grant_runtime_issuance_failed_closed",
        () =>
          issue(state, managementCapability, observationCapability, profileId),
      ),
    consume: (
      useCapability: unknown,
      managementCapability: unknown,
      currentObservationCapability: unknown,
    ) =>
      failClosed(
        "provider_home_mount_grant_runtime_consumption_failed_closed",
        () =>
          consume(
            state,
            useCapability,
            managementCapability,
            currentObservationCapability,
          ),
      ),
    inspectMountAuthorization: (
      mountAuthorizationCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed(
        "provider_home_mount_authorization_inspection_failed_closed",
        () =>
          inspectMountAuthorization(
            state,
            mountAuthorizationCapability,
            managementCapability,
          ),
      ),
    activateMount: (
      mountAuthorizationCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed("provider_home_mount_activation_failed_closed", () =>
        activateMount(
          state,
          mountAuthorizationCapability,
          managementCapability,
        ),
      ),
    borrowActiveMountSource: (
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) => {
      try {
        return activeMountSource(
          state,
          activeMountCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
    inspectActiveMount: (
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed("provider_home_active_mount_inspection_failed_closed", () =>
        inspectActiveMount(state, activeMountCapability, managementCapability),
      ),
    completeMount: (
      activeMountCapability: unknown,
      managementCapability: unknown,
    ) =>
      failClosed("provider_home_mount_completion_failed_closed", () =>
        completeMount(state, activeMountCapability, managementCapability),
      ),
    revoke: (controlCapability: unknown, managementCapability: unknown) =>
      failClosed(
        "provider_home_mount_grant_runtime_revocation_failed_closed",
        () => revoke(state, controlCapability, managementCapability),
      ),
  });
}

export function describeProviderHomeMountGrantRuntimeContract() {
  return Object.freeze({
    contract: PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT,
    contractRevision: PROVIDER_HOME_MOUNT_GRANT_RUNTIME_CONTRACT_REVISION,
    store: "process_local_atomic_map_plus_durable_runtime_state_lease",
    clock: "runtime_owned_wall_and_monotonic",
    referenceSource: "runtime_owned_cryptographic_random_18_decimal_digits",
    observationInput: "opaque_single_use_runtime_owned_capability",
    operationInput: "opaque_runtime_owned_management_capability",
    aliases: Object.freeze([
      "control",
      "use",
      "mount_authorization",
      "active_mount",
    ]),
    controlAndUseAliasesSeparated: true,
    allAliasesRevokedTogether: true,
    lifetimeMs: PROVIDER_HOME_MOUNT_GRANT_MAXIMUM_LIFETIME_MS,
    usageLimit: 1,
    processRestartBehavior: "all_grants_lost_fail_closed",
    crashRecovery:
      "mounted_container_and_operation_cleanup_owned_by_docker_recovery_contract",
    callerSuppliedClockAccepted: false,
    callerSuppliedOperationIdAccepted: false,
    callerSuppliedObservationHashAccepted: false,
    pathReported: false,
    credentialReported: false,
    activeMountSourceLease:
      "implemented_opaque_internal_docker_adapter_handoff_candidate",
    activeMountAuthorityInspection:
      "implemented_runtime_owned_metadata_only_no_path_or_credential",
    providerHomeMounted: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    isolatedTestRuntimeCapabilitiesAcceptedByProduction: false,
  });
}
