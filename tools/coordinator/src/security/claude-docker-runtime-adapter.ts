import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

import { planClaudeReadOnlyProbe } from "./claude-execution-plan.ts";
import { consumeRuntimeOwnedDelegationSelectionGrant } from "./delegation-selection-grant-runtime.ts";
import { describeEgressProxyTopology } from "./egress-proxy-policy.ts";
import {
  type OwnedMountPaths,
  verifyOwnedOperationManagementMountBinding,
} from "./execution-environment.ts";
import {
  activateRuntimeOwnedProviderHomeMount,
  borrowRuntimeOwnedActiveProviderHomeMountSource,
  completeRuntimeOwnedProviderHomeMount,
} from "./provider-home-mount-grant-runtime.ts";
import { selectProviderModelCandidate } from "./provider-model-selection-runtime.ts";

export const CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT =
  "crdd-coordinator/claude-docker-runtime-adapter";
export const CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION = 1;

const PREPARED_LIFETIME_MS = 30_000;
const PROVIDER_HOME_DESTINATION = "/provider-home";
const TMP_DESTINATION = "/tmp";
const PROXY_PORT = 8080;
const MAXIMUM_IDENTIFIER_LENGTH = 63;
const FORBIDDEN_ENVIRONMENT_NAMES = new Set([
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "CLAUDE_CODE_OAUTH_TOKEN",
  "HTTP_PROXY",
  "NO_PROXY",
]);

type OperationBinding = Readonly<{
  operationId: string;
  createdAt: string;
  mounts: OwnedMountPaths;
}>;

type Command = Readonly<{
  purpose: string;
  argv: readonly string[];
}>;

type PreparedPlan = Readonly<{
  operationId: string;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  providerHomeSourcePath: string;
  preparedWallClockMs: number;
  preparedMonotonicMs: number;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
  selectionNotice: string;
  commands: readonly Command[];
}>;

type ConsumedModelSelection = Readonly<{
  selectionRecordId: string;
  operationId: string;
  frontProvider: "codex" | "claude";
  executorProvider: "codex" | "claude";
  route: string;
  profileId: string;
  model: string;
  basis: unknown;
  effort: "low" | "medium" | "high";
  modelTier: string;
  speedMode: "normal";
  selectionNotice: string;
  delegationDepth: number;
}>;

type RuntimeState = Readonly<{
  prepared: WeakMap<object, PreparedPlan>;
  managementCapabilities: WeakMap<object, object>;
  verifyOperationMount: (
    managementCapability: unknown,
    mountCapability: unknown,
  ) => OperationBinding;
  activateMount: (
    mountAuthorizationCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    status: string;
    grant: Readonly<{
      grantRef: string;
      provider: string;
      profileId: string;
      operationId: string;
    }> | null;
    activeMountCapability: object | null;
  }>;
  borrowMountSource: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => string | null;
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  wallNow: () => number;
  monotonicNow: () => number;
  randomBytes: (size: number) => Buffer;
  consumeModelSelection: (
    useCapability: unknown,
    managementCapability: unknown,
  ) => ConsumedModelSelection | null;
}>;

function createRuntimeState(
  dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">,
): RuntimeState {
  return Object.freeze({
    prepared: new WeakMap(),
    managementCapabilities: new WeakMap(),
    ...dependencies,
  });
}

const productionState = createRuntimeState({
  verifyOperationMount: verifyOwnedOperationManagementMountBinding,
  activateMount: activateRuntimeOwnedProviderHomeMount,
  borrowMountSource: borrowRuntimeOwnedActiveProviderHomeMountSource,
  completeMount: completeRuntimeOwnedProviderHomeMount,
  wallNow: Date.now,
  monotonicNow: performance.now.bind(performance),
  randomBytes,
  consumeModelSelection: consumeRuntimeOwnedDelegationSelectionGrant,
});

function createBlockedResult(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    preparedCapability: null,
    operationId: null,
    grantRef: null,
    selectionRecordId: null,
    selectedModel: null,
    selectedEffort: null,
    selectedModelTier: null,
    selectionNotice: null,
    providerHomeMountLeaseActive: false,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

function performSafely<T>(reason: string, action: () => T) {
  try {
    return action();
  } catch {
    return createBlockedResult(reason);
  }
}

function createRandomHex(state: RuntimeState, bytes: number) {
  const value = state.randomBytes(bytes);
  return Buffer.isBuffer(value) && value.byteLength === bytes
    ? value.toString("hex")
    : null;
}

function createSafeMount(source: string, destination: string) {
  if (
    source.length === 0 ||
    source.includes(",") ||
    source.includes("\0") ||
    source.includes("\r") ||
    source.includes("\n")
  ) {
    return null;
  }
  return `type=bind,src=${source},dst=${destination},bind-propagation=rprivate`;
}

function createCommand(purpose: string, argv: readonly string[]): Command {
  return Object.freeze({ purpose, argv: Object.freeze([...argv]) });
}

function buildExactFixedEnvironment(
  environment: Readonly<Record<string, string>>,
) {
  const entries = Object.entries(environment);
  if (
    entries.some(
      ([name, value]) =>
        FORBIDDEN_ENVIRONMENT_NAMES.has(name) ||
        typeof value !== "string" ||
        value.includes("\0"),
    )
  ) {
    return null;
  }
  return entries.flatMap(([name, value]) => ["--env", `${name}=${value}`]);
}

function normalizeExactModelId(model: string) {
  return /^[a-z0-9][a-z0-9._-]{0,127}$/.test(model) ? model : null;
}

function buildPlan(
  state: RuntimeState,
  binding: OperationBinding,
  activation: Readonly<{
    grant: Readonly<{
      grantRef: string;
      provider: string;
      profileId: string;
      operationId: string;
    }>;
    activeMountCapability: object;
  }>,
  consumedModelSelection: ConsumedModelSelection,
  providerHomeSourcePath: string,
  preparedWallClockMs: number,
  preparedMonotonicMs: number,
) {
  const claude = planClaudeReadOnlyProbe({
    provider: "claude",
    mode: "read_only_probe",
  });
  const egress = describeEgressProxyTopology();
  const selection = selectProviderModelCandidate(consumedModelSelection.basis);
  if (
    selection.status !== "candidate" ||
    selection.provider !== "claude" ||
    selection.speedMode !== "normal" ||
    !selection.selectionNotice ||
    consumedModelSelection.executorProvider !== "claude" ||
    consumedModelSelection.operationId !== binding.operationId ||
    consumedModelSelection.profileId !== activation.grant.profileId ||
    consumedModelSelection.effort !== selection.effort ||
    consumedModelSelection.modelTier !== selection.modelTier ||
    consumedModelSelection.speedMode !== selection.speedMode ||
    consumedModelSelection.selectionNotice.length === 0 ||
    !/^MODELSEL-[A-Z0-9-]{8,80}$/.test(
      consumedModelSelection.selectionRecordId,
    ) ||
    !normalizeExactModelId(consumedModelSelection.model) ||
    claude.status !== "candidate" ||
    claude.provider !== "claude" ||
    claude.distributionBinding.fixedDigestImageRequired !== true ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    egress.proxyNetworks.length !== 2
  ) {
    return null;
  }
  const fixedEnvironment = buildExactFixedEnvironment(claude.environment);
  const providerHomeMount = createSafeMount(
    providerHomeSourcePath,
    PROVIDER_HOME_DESTINATION,
  );
  const tmpMount = createSafeMount(binding.mounts.tmp, TMP_DESTINATION);
  const suffix = createRandomHex(state, 8);
  const proxyToken = createRandomHex(state, 32);
  if (
    !fixedEnvironment ||
    !providerHomeMount ||
    !tmpMount ||
    !suffix ||
    !proxyToken
  ) {
    return null;
  }
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const providerContainerName = `crdd-claude-${suffix}`;
  if (
    [
      internalNetworkName,
      egressNetworkName,
      proxyContainerName,
      providerContainerName,
    ].some((value) => value.length > MAXIMUM_IDENTIFIER_LENGTH)
  ) {
    return null;
  }
  const ownershipLabel = `crdd.coordinator.runtime=${suffix}`;
  const providerImageDigest = claude.distributionBinding.fixedImageDigest;
  const proxyImageDigest = egress.verificationAdapter.imageDigest;
  const proxyUrl = `http://crdd:${proxyToken}@proxy:${PROXY_PORT}`;
  const providerEnvironment = [
    "--env",
    `HOME=${PROVIDER_HOME_DESTINATION}`,
    "--env",
    `TMPDIR=${TMP_DESTINATION}`,
    "--env",
    `HTTPS_PROXY=${proxyUrl}`,
    ...fixedEnvironment,
  ];
  const commands = Object.freeze([
    createCommand("create_internal_network", [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      ownershipLabel,
      internalNetworkName,
    ]),
    createCommand("create_egress_network", [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      ownershipLabel,
      egressNetworkName,
    ]),
    createCommand("create_proxy", [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      proxyContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16777216",
      "--env",
      `CRDD_PROXY_AUTH=${proxyToken}`,
      proxyImageDigest,
    ]),
    createCommand("connect_proxy_internal", [
      "network",
      "connect",
      "--alias",
      "proxy",
      internalNetworkName,
      proxyContainerName,
    ]),
    createCommand("connect_proxy_egress", [
      "network",
      "connect",
      egressNetworkName,
      proxyContainerName,
    ]),
    createCommand("create_provider", [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      providerContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...providerEnvironment,
      "--mount",
      providerHomeMount,
      "--mount",
      tmpMount,
      providerImageDigest,
      "--model",
      consumedModelSelection.model,
      "--effort",
      selection.effort,
      ...claude.argv,
    ]),
    createCommand("connect_provider_internal", [
      "network",
      "connect",
      internalNetworkName,
      providerContainerName,
    ]),
    createCommand("start_proxy", ["start", proxyContainerName]),
    createCommand("start_provider_attached", [
      "start",
      "--attach",
      providerContainerName,
    ]),
  ]);
  return Object.freeze({
    operationId: binding.operationId,
    grantRef: activation.grant.grantRef,
    profileId: activation.grant.profileId,
    activeMountCapability: activation.activeMountCapability,
    providerHomeSourcePath,
    preparedWallClockMs,
    preparedMonotonicMs,
    providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    providerImageDigest,
    proxyImageDigest,
    selectionRecordId: consumedModelSelection.selectionRecordId,
    selectedModel: consumedModelSelection.model,
    selectedEffort: selection.effort,
    selectedModelTier: selection.modelTier,
    selectionNotice: consumedModelSelection.selectionNotice,
    commands,
  });
}

function prepare(
  state: RuntimeState,
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
) {
  const binding = state.verifyOperationMount(
    managementCapability,
    mountCapability,
  );
  const activation = state.activateMount(
    mountAuthorizationCapability,
    managementCapability,
  );
  if (
    activation.status !== "activated" ||
    !activation.grant ||
    !activation.activeMountCapability
  ) {
    return createBlockedResult(
      "claude_docker_runtime_mount_authorization_invalid",
    );
  }
  const activeMountCapability = activation.activeMountCapability;
  const activatedMount = Object.freeze({
    grant: activation.grant,
    activeMountCapability,
  });
  if (
    activation.grant.provider !== "claude" ||
    activation.grant.operationId !== binding.operationId
  ) {
    state.completeMount(activeMountCapability, managementCapability);
    return createBlockedResult(
      "claude_docker_runtime_mount_authorization_invalid",
    );
  }
  try {
    const consumedModelSelection = state.consumeModelSelection(
      selectionUseCapability,
      managementCapability,
    );
    if (!consumedModelSelection) {
      state.completeMount(activeMountCapability, managementCapability);
      return createBlockedResult(
        "claude_docker_runtime_model_selection_invalid",
      );
    }
    const providerHomeSourcePath = state.borrowMountSource(
      activeMountCapability,
      managementCapability,
    );
    const preparedWallClockMs = state.wallNow();
    const preparedMonotonicMs = state.monotonicNow();
    const plan =
      typeof providerHomeSourcePath === "string" &&
      Number.isFinite(preparedWallClockMs) &&
      Number.isFinite(preparedMonotonicMs) &&
      preparedWallClockMs >= 0 &&
      preparedMonotonicMs >= 0
        ? buildPlan(
            state,
            binding,
            activatedMount,
            consumedModelSelection,
            providerHomeSourcePath,
            preparedWallClockMs,
            preparedMonotonicMs,
          )
        : null;
    if (!plan) {
      state.completeMount(activeMountCapability, managementCapability);
      return createBlockedResult("claude_docker_runtime_plan_invalid");
    }
    const preparedCapability = Object.freeze({});
    state.prepared.set(preparedCapability, plan);
    state.managementCapabilities.set(
      preparedCapability,
      managementCapability as object,
    );
    return Object.freeze({
      ...createBlockedResult("claude_docker_runtime_prepared"),
      status: "prepared" as const,
      reason: "claude_docker_runtime_prepared",
      preparedCapability,
      operationId: binding.operationId,
      grantRef: activation.grant.grantRef,
      selectionRecordId: plan.selectionRecordId,
      selectedModel: plan.selectedModel,
      selectedEffort: plan.selectedEffort,
      selectedModelTier: plan.selectedModelTier,
      selectionNotice: plan.selectionNotice,
      providerHomeMountLeaseActive: true,
    });
  } catch (error) {
    state.completeMount(activeMountCapability, managementCapability);
    throw error;
  }
}

function findStoredPlan(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  if (!preparedCapability || typeof preparedCapability !== "object")
    return null;
  const plan = state.prepared.get(preparedCapability);
  const management = state.managementCapabilities.get(preparedCapability);
  if (!plan || management !== managementCapability) return null;
  return plan;
}

function isPlanFresh(state: RuntimeState, plan: PreparedPlan) {
  const wallAge = state.wallNow() - plan.preparedWallClockMs;
  const monotonicAge = state.monotonicNow() - plan.preparedMonotonicMs;
  return !(
    !Number.isFinite(wallAge) ||
    !Number.isFinite(monotonicAge) ||
    wallAge < 0 ||
    monotonicAge < 0 ||
    wallAge >= PREPARED_LIFETIME_MS ||
    monotonicAge >= PREPARED_LIFETIME_MS
  );
}

function removePrepared(state: RuntimeState, preparedCapability: object) {
  state.prepared.delete(preparedCapability);
  state.managementCapabilities.delete(preparedCapability);
}

function cancel(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  const plan = findStoredPlan(state, preparedCapability, managementCapability);
  if (!plan || !preparedCapability || typeof preparedCapability !== "object") {
    return createBlockedResult(
      "claude_docker_runtime_prepared_capability_invalid",
    );
  }
  const completed = state.completeMount(
    plan.activeMountCapability,
    managementCapability,
  );
  if (completed.status !== "completed") {
    return createBlockedResult(
      "claude_docker_runtime_mount_release_unconfirmed",
    );
  }
  removePrepared(state, preparedCapability);
  const isExpired = !isPlanFresh(state, plan);
  return Object.freeze({
    ...createBlockedResult(
      isExpired
        ? "claude_docker_runtime_preparation_expired"
        : "claude_docker_runtime_preparation_cancelled",
    ),
    status: isExpired ? ("expired" as const) : ("cancelled" as const),
    reason: isExpired
      ? "claude_docker_runtime_preparation_expired"
      : "claude_docker_runtime_preparation_cancelled",
    operationId: plan.operationId,
    grantRef: plan.grantRef,
  });
}

function consumePreparedPlan(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  const plan = findStoredPlan(state, preparedCapability, managementCapability);
  if (!plan || !preparedCapability || typeof preparedCapability !== "object") {
    return null;
  }
  if (!isPlanFresh(state, plan)) {
    const completed = state.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    if (completed.status === "completed") {
      removePrepared(state, preparedCapability);
    }
    return null;
  }
  removePrepared(state, preparedCapability);
  return plan;
}

export function prepareRuntimeOwnedClaudeDockerCandidate(
  managementCapability: unknown,
  mountCapability: unknown,
  mountAuthorizationCapability: unknown,
  selectionUseCapability: unknown,
) {
  return performSafely("claude_docker_runtime_preparation_failed_closed", () =>
    prepare(
      productionState,
      managementCapability,
      mountCapability,
      mountAuthorizationCapability,
      selectionUseCapability,
    ),
  );
}

export function cancelRuntimeOwnedClaudeDockerCandidate(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  return performSafely("claude_docker_runtime_cancellation_failed_closed", () =>
    cancel(productionState, preparedCapability, managementCapability),
  );
}

export function consumeRuntimeOwnedClaudeDockerPlanForProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return consumePreparedPlan(
      productionState,
      preparedCapability,
      managementCapability,
    );
  } catch {
    return null;
  }
}

export function createIsolatedClaudeDockerRuntimeAdapterCandidate(
  dependencies: Omit<RuntimeState, "prepared" | "managementCapabilities">,
) {
  const state = createRuntimeState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    prepare: (
      managementCapability: unknown,
      mountCapability: unknown,
      mountAuthorizationCapability: unknown,
      selectionUseCapability: unknown,
    ) =>
      performSafely("claude_docker_runtime_preparation_failed_closed", () =>
        prepare(
          state,
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
        ),
      ),
    cancel: (preparedCapability: unknown, managementCapability: unknown) =>
      performSafely("claude_docker_runtime_cancellation_failed_closed", () =>
        cancel(state, preparedCapability, managementCapability),
      ),
    consumeForProcessController: (
      preparedCapability: unknown,
      managementCapability: unknown,
    ) => {
      try {
        return consumePreparedPlan(
          state,
          preparedCapability,
          managementCapability,
        );
      } catch {
        return null;
      }
    },
  });
}

export function describeClaudeDockerRuntimeAdapterContract() {
  return Object.freeze({
    contract: CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT,
    contractRevision: CLAUDE_DOCKER_RUNTIME_ADAPTER_CONTRACT_REVISION,
    provider: "claude",
    modelSelection:
      "runtime_owned_selection_grant_consumer_connected_issuer_availability_profile_not_connected",
    coordinatorPrelaunchModelSelectionAllowed: true,
    providerAutomaticModelSwitchingAllowed: false,
    midExecutionModelSwitchingAllowed: false,
    speedMode: "normal_only",
    highCostSelection: "decisive_reason_required",
    fallbackModelArgumentAllowed: false,
    operationBinding:
      "same_runtime_owned_management_and_mount_capability_generation",
    providerHomeBinding:
      "consumed_mount_authorization_and_native_known_folder_source_hash",
    preparedLifetimeMs: PREPARED_LIFETIME_MS,
    providerImage: "fixed_digest_only_pull_never",
    proxyImage: "fixed_digest_only_pull_never",
    parentEnvironmentInherited: false,
    apiKeyEnvironmentAllowed: false,
    providerNetwork: "internal_only",
    providerDirectEgress: false,
    proxyNetworks: Object.freeze(["internal", "egress"]),
    proxyAuthentication: "runtime_random_256_bit_operation_local",
    proxyHostnameAllowlist: Object.freeze([
      "api.anthropic.com",
      "claude.ai",
      "platform.claude.com",
    ]),
    rootFilesystem: "read_only",
    linuxUser: "65534:65534",
    capabilities: "all_dropped",
    noNewPrivileges: true,
    processLimit: 64,
    providerHomeMount: "read_write_rprivate_dedicated_home",
    operationTmpMount: "read_write_rprivate_owned_operation_tmp",
    repositoryMounted: false,
    shellInvocation: false,
    pathLookup: false,
    commandPlanReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    processController:
      "candidate_consumer_implemented_production_effect_not_connected",
  });
}
