import { createHash, randomInt } from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import { createDevelopmentExecutionTiming } from "../core/development-execution-timing.ts";

import { isRuntimeProcessEffectBlocked } from "../core/runtime-process-safety-state.ts";
import { snapshotCoordinatorTaskRequest } from "./coordinator-task-request.ts";
import { createDevelopmentMeasurementConstraints } from "./development-measurement-constraints.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import { confirmRuntimeOwnedDevelopmentMeasurementUsingConsole } from "./external-send-grant-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import {
  inspectFixedDevelopmentCoordinatorPackageCandidate,
  inspectVerifiedNativeDistributionCandidate,
} from "./platform-provisioner-package-filesystem.ts";
import {
  borrowRuntimeOwnedRepositorySource,
  inspectRepositoryIdentityCandidate,
} from "./repository-operation-runtime.ts";

const CONFIG_KEYS = new Set([
  "repositoryRoot",
  "expectedCommit",
  "expectedTree",
  "expectedPackageContentRootSha256",
  "nativeDistributionRoot",
  "expectedNativeRelease",
  "tasks",
  "expiresAtMs",
]);
const RELEASE_KEYS = new Set([
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "packageContentRootSha256",
  "runtimeExecutionIdentitySha256",
]);
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const MAX_DURATION_MS = 3_600_000;
const sourceDistributionRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);
type Provider = "codex" | "claude";
type Role = "executor" | "reviewer";
type Constraints = NonNullable<
  ReturnType<typeof createDevelopmentMeasurementConstraints>
>;
type TaskRequest = Extract<
  NonNullable<ReturnType<typeof snapshotCoordinatorTaskRequest>>,
  { status: "accepted" }
>["request"];
type Task = Readonly<{
  request: TaskRequest;
  scopeSha256: string;
  executor: Provider;
  reviewer: Provider;
}>;
type Configuration = Readonly<{
  repositoryRoot: string;
  expectedCommit: string;
  expectedTree: string;
  expectedPackageContentRootSha256: string;
  nativeDistributionRoot: string;
  expectedNativeRelease: Readonly<Record<string, unknown>>;
  tasks: readonly Task[];
  expiresAtMs: number;
}>;
type Identity = Readonly<{
  sourceIdentitySha256: string;
  nativeIdentitySha256: string;
  repositoryIdentitySha256: string;
}>;
type NativeVerification = Extract<
  ReturnType<typeof inspectVerifiedNativeDistributionCandidate>,
  { status: "candidate" }
>;
// Only the production observer can bind its fresh native result to an identity.
// No session-wide cache, caller claim, or isolated test identity is accepted.
const nativeVerifications = new WeakMap<Identity, NativeVerification>();
type Dependencies = Readonly<{
  observe: (configuration: Configuration) => Identity | null;
  confirm: typeof confirmRuntimeOwnedDevelopmentMeasurementUsingConsole;
  wallNow: () => number;
  monotonicNow: () => number;
  randomChallenge: () => string;
  isEffectBlocked: () => boolean;
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  borrowRepository: typeof borrowRuntimeOwnedRepositorySource;
}>;
type Session = {
  timing: ReturnType<typeof createDevelopmentExecutionTiming>;
  configuration: Configuration;
  identity: Identity;
  bindingSha256: string;
  constraints: Constraints;
  signal: AbortSignal;
  closed: boolean;
};
type TaskBinding = {
  session: Session;
  task: Task;
  token: object;
  managementCapability: object | null;
  settled: boolean;
};

function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function snapshotTask(raw: unknown): Task | null {
  try {
    const parsed = snapshotCoordinatorTaskRequest(raw);
    if (parsed?.status !== "accepted") return null;
    const request = parsed.request;
    if (Buffer.byteLength(JSON.stringify(request), "utf8") > 65_536)
      return null;
    const executor = request.requestedExecutorProvider;
    if (
      (executor !== "codex" && executor !== "claude") ||
      request.frontProvider === executor ||
      request.isLocalCandidateOnly !== true ||
      request.hasUnresolvedDirection !== false ||
      request.requiresCrossContextAlignment !== false ||
      request.workClass !== "bounded_implementation" ||
      request.planState !== "complete" ||
      request.risk !== "low" ||
      request.difficulty !== "low" ||
      request.decisionImpact !== "limited"
    )
      return null;
    const reviewer = executor === "codex" ? "claude" : "codex";
    return Object.freeze({
      request,
      executor,
      reviewer,
      scopeSha256: digest([
        "crdd-development-task/v1",
        request,
        executor,
        reviewer,
      ]),
    });
  } catch {
    return null;
  }
}

function snapshotConfiguration(raw: unknown): Configuration | null {
  const config = snapshotPlainRecord(raw, CONFIG_KEYS);
  if (!config) return null;
  const release = snapshotPlainRecord(
    config.expectedNativeRelease,
    RELEASE_KEYS,
  );
  const taskInputs = snapshotPlainArray(config.tasks, 2);
  if (
    !release ||
    taskInputs.status !== "ok" ||
    taskInputs.value.length !== 2 ||
    typeof config.repositoryRoot !== "string" ||
    !path.isAbsolute(config.repositoryRoot) ||
    path.normalize(config.repositoryRoot) !== config.repositoryRoot ||
    typeof config.nativeDistributionRoot !== "string" ||
    !path.isAbsolute(config.nativeDistributionRoot) ||
    path.normalize(config.nativeDistributionRoot) !==
      config.nativeDistributionRoot ||
    config.nativeDistributionRoot === sourceDistributionRoot ||
    typeof config.expectedCommit !== "string" ||
    !COMMIT.test(config.expectedCommit) ||
    typeof config.expectedTree !== "string" ||
    !COMMIT.test(config.expectedTree) ||
    typeof config.expectedPackageContentRootSha256 !== "string" ||
    !SHA256.test(config.expectedPackageContentRootSha256) ||
    typeof config.expiresAtMs !== "number" ||
    !Number.isSafeInteger(config.expiresAtMs)
  )
    return null;
  const tasks: Task[] = [];
  for (const input of taskInputs.value) {
    const task = snapshotTask(input);
    if (
      !task ||
      tasks.some(
        (existing) =>
          existing.executor === task.executor ||
          existing.scopeSha256 === task.scopeSha256,
      )
    )
      return null;
    tasks.push(task);
  }
  // The native verifier owns release-field semantics. Snapshot primitive values
  // now so caller mutation/getters cannot change what was shown to the user.
  if (
    Object.values(release).some(
      (value) => typeof value !== "string" && typeof value !== "number",
    )
  )
    return null;
  return Object.freeze({
    repositoryRoot: config.repositoryRoot,
    expectedCommit: config.expectedCommit,
    expectedTree: config.expectedTree,
    expectedPackageContentRootSha256: config.expectedPackageContentRootSha256,
    nativeDistributionRoot: config.nativeDistributionRoot,
    expectedNativeRelease: release,
    tasks: Object.freeze(tasks),
    expiresAtMs: config.expiresAtMs,
  });
}

function observeProduction(configuration: Configuration): Identity | null {
  const repository = inspectRepositoryIdentityCandidate(
    configuration.repositoryRoot,
  );
  if (
    !repository ||
    repository.commit !== configuration.expectedCommit ||
    repository.tree !== configuration.expectedTree
  )
    return null;
  const source = inspectFixedDevelopmentCoordinatorPackageCandidate({
    distributionRoot: sourceDistributionRoot,
    expectedCrddTree: configuration.expectedTree,
    expectedPackageContentRootSha256:
      configuration.expectedPackageContentRootSha256,
  });
  if (source.status !== "candidate" || !("sourceIdentitySha256" in source))
    return null;
  const native = inspectVerifiedNativeDistributionCandidate({
    distributionRoot: configuration.nativeDistributionRoot,
    evaluationTime: new Date().toISOString(),
    expectedRelease: configuration.expectedNativeRelease,
  });
  if (native.status !== "candidate") return null;
  const reobserved = inspectRepositoryIdentityCandidate(
    configuration.repositoryRoot,
  );
  if (JSON.stringify(repository) !== JSON.stringify(reobserved)) return null;
  const identity: Identity = Object.freeze({
    sourceIdentitySha256: source.sourceIdentitySha256,
    nativeIdentitySha256: native.nativeIdentitySha256,
    repositoryIdentitySha256: digest([
      "crdd-development-repository/v1",
      configuration.repositoryRoot,
      repository,
    ]),
  });
  nativeVerifications.set(identity, native);
  return identity;
}

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    capability: null,
    executionSourceKind: "fixed_development_candidate" as const,
    releaseAuthorityConferred: false,
    providerEffectIssued: false,
  });
}

function createSessionRuntime(dependencies: Dependencies) {
  const sessions = new WeakMap<object, Session>();
  const taskBindings = new WeakMap<object, TaskBinding>();
  const operationBindings = new WeakMap<object, TaskBinding>();
  const operationContexts = new WeakMap<object, object>();
  const invocationBindings = new WeakMap<object, TaskBinding>();
  const cleanupBindings = new WeakMap<object, TaskBinding>();
  const cleanupContexts = new WeakMap<object, object>();
  let admissionStarted = false;

  function observe(session: Session) {
    try {
      if (
        session.signal.aborted ||
        session.closed ||
        dependencies.isEffectBlocked()
      )
        session.constraints.cancel();
      const identity = session.timing.measureIdentity(() =>
        dependencies.observe(session.configuration),
      );
      const bindingSha256 =
        identity && digest(identity) === digest(session.identity)
          ? session.bindingSha256
          : "0".repeat(64);
      const observation = {
        bindingSha256,
        wallTimeMs: dependencies.wallNow(),
        monotonicTimeMs: dependencies.monotonicNow(),
      };
      return {
        identity,
        observation,
        result: session.constraints.check(observation),
      };
    } catch {
      session.constraints.cancel();
      return null;
    }
  }

  function operationValid(binding: TaskBinding) {
    try {
      return (
        !binding.settled &&
        binding.managementCapability !== null &&
        dependencies.verifyOperation(binding.managementCapability)
          .managementScopeBound === true
      );
    } catch {
      return false;
    }
  }

  return Object.freeze({
    async request(raw: unknown, signal: AbortSignal) {
      if (admissionStarted)
        return blocked("development_measurement_admission_already_attempted");
      admissionStarted = true;
      try {
        if (
          !signal ||
          utilTypes.isProxy(signal) ||
          !(signal instanceof AbortSignal) ||
          signal.aborted ||
          dependencies.isEffectBlocked()
        )
          return blocked("development_measurement_unavailable");
        const configuration = snapshotConfiguration(raw);
        const wallTimeMs = dependencies.wallNow();
        const monotonicTimeMs = dependencies.monotonicNow();
        if (
          !configuration ||
          configuration.expiresAtMs <= wallTimeMs ||
          configuration.expiresAtMs - wallTimeMs > MAX_DURATION_MS
        )
          return blocked("development_measurement_configuration_invalid");
        const timing = createDevelopmentExecutionTiming();
        const identity = timing.measureIdentity(() =>
          dependencies.observe(configuration),
        );
        if (!identity)
          return blocked("development_measurement_identity_not_verified");
        const bindingSha256 = digest([
          "crdd-development-session/v1",
          configuration,
          identity,
        ]);
        const constraints = createDevelopmentMeasurementConstraints(
          {
            bindingSha256,
            expiresAtMs: configuration.expiresAtMs,
            tasks: configuration.tasks.map(
              ({ scopeSha256, executor, reviewer }) => ({
                scopeSha256,
                executor,
                reviewer,
              }),
            ),
          },
          { bindingSha256, wallTimeMs, monotonicTimeMs },
        );
        if (!constraints)
          return blocked("development_measurement_configuration_invalid");
        const session: Session = {
          timing,
          configuration,
          identity,
          bindingSha256,
          constraints,
          signal,
          closed: false,
        };
        if (observe(session)?.result.status !== "recorded")
          return blocked("development_measurement_preconfirmation_changed");
        const challenge = dependencies.randomChallenge();
        if (!/^[0-9]{6}$/u.test(challenge))
          return blocked("development_measurement_challenge_invalid");
        const notice = `開発版の限定実測（正式Releaseの署名を代替しません）\n${JSON.stringify(
          {
            repositoryRoot: configuration.repositoryRoot,
            sourceCommit: configuration.expectedCommit,
            sourceTree: configuration.expectedTree,
            packageSha256: configuration.expectedPackageContentRootSha256,
            nativeManifestHash:
              configuration.expectedNativeRelease.manifestHash,
            bindingSha256,
            expiresAt: new Date(configuration.expiresAtMs).toISOString(),
            maximumTasks: 2,
            maximumCliInvocations: 8,
            taskRetryAllowed: false,
            subscriptionOnly: true,
            apiKeyFallbackAllowed: false,
            purchasesAllowed: false,
            tasks: configuration.tasks.map((task) => ({
              request: task.request,
              executor: task.executor,
              reviewer: task.reviewer,
            })),
          },
          null,
          2,
        )}\n対象範囲内で2件を比較し、既存Subscription枠を消費します。対象外の候補清掃・Docker修復・再開は許可しません。`;
        const confirmation = await dependencies.confirm(
          notice,
          challenge,
          signal,
        );
        if (confirmation.status !== "confirmed")
          return blocked(
            `development_measurement_confirmation_${confirmation.status}`,
          );
        // The console owner returns only after reader/handles/lock cleanup.
        // No authorization exists during the human wait or failed cleanup.
        if (observe(session)?.result.status !== "recorded")
          return blocked("development_measurement_confirmation_stale");
        const capability = Object.freeze({});
        sessions.set(capability, session);
        return Object.freeze({
          status: "authorized" as const,
          capability,
          bindingSha256,
          expiresAtMs: configuration.expiresAtMs,
          executionSourceKind: "fixed_development_candidate" as const,
          releaseAuthorityConferred: false,
          providerEffectIssued: false,
        });
      } catch {
        return blocked("development_measurement_admission_failed");
      }
    },
    reserveTask(sessionCapability: object, raw: unknown) {
      const session = sessions.get(sessionCapability);
      const task = snapshotTask(raw);
      const observation = session && observe(session);
      if (!session || !task || observation?.result.status !== "recorded")
        return null;
      const reserved = session.constraints.reserveTask(
        task.scopeSha256,
        observation.observation,
      );
      if (reserved.status !== "recorded") return null;
      const capability = Object.freeze({});
      taskBindings.set(capability, {
        session,
        task,
        token: reserved.value,
        managementCapability: null,
        settled: false,
      });
      return capability;
    },
    taskBoundary(taskCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return null;
      return Object.freeze({
        repositoryRoot: binding.session.configuration.repositoryRoot,
        expiresAtMs: binding.session.configuration.expiresAtMs,
        signal: binding.session.signal,
        request: binding.task.request,
        checkNewWork: () =>
          !binding.settled &&
          observe(binding.session)?.result.status === "recorded",
      });
    },
    bindOperation(
      taskCapability: object,
      managementCapability: object,
      repositoryBindingCapability: object,
    ) {
      const binding = taskBindings.get(taskCapability);
      if (
        !binding ||
        binding.settled ||
        binding.managementCapability ||
        operationBindings.has(managementCapability) ||
        observe(binding.session)?.result.status !== "recorded"
      )
        return false;
      try {
        const operation = dependencies.verifyOperation(managementCapability);
        const repository = dependencies.borrowRepository(
          repositoryBindingCapability,
          managementCapability,
        );
        if (
          !repository ||
          repository.operationId !== operation.operationId ||
          repository.repositoryRoot !==
            binding.session.configuration.repositoryRoot ||
          repository.revision !== binding.session.configuration.expectedCommit
        )
          return false;
        binding.managementCapability = managementCapability;
        operationBindings.set(managementCapability, binding);
        operationContexts.set(managementCapability, taskCapability);
        const cleanupContext = Object.freeze({});
        cleanupBindings.set(cleanupContext, binding);
        cleanupContexts.set(managementCapability, cleanupContext);
        return true;
      } catch {
        return false;
      }
    },
    checkOperation(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      if (!binding || binding.settled) return false;
      try {
        dependencies.verifyOperation(managementCapability);
        return observe(binding.session)?.result.status === "recorded";
      } catch {
        return false;
      }
    },
    operationContext(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      return binding
        ? Object.freeze({
            checkNewWork: () =>
              !binding.settled &&
              observe(binding.session)?.result.status === "recorded",
            newWorkContext: operationContexts.get(managementCapability),
            cleanupContext: cleanupContexts.get(managementCapability),
          })
        : null;
    },
    borrowNativeObservation(
      context: object,
      shouldInitializeIfMissing: boolean,
    ) {
      const task = taskBindings.get(context);
      const cleanup = cleanupBindings.get(context);
      const binding = task ?? cleanup;
      if (!binding || binding.settled || (cleanup && shouldInitializeIfMissing))
        return null;
      try {
        let identity: Identity | null = null;
        if (task) {
          const observed = observe(binding.session);
          if (observed?.result.status !== "recorded") return null;
          identity = observed.identity;
        }
        // A cleanup context permits only a read-only native observation. Its
        // owning resource lifecycle still authorizes every exact mutation.
        if (cleanup) {
          if (dependencies.isEffectBlocked()) return null;
          identity = binding.session.timing.measureIdentity(() =>
            dependencies.observe(binding.session.configuration),
          );
          if (digest(identity) !== digest(binding.session.identity))
            return null;
        }
        if (!identity) return null;
        return Object.freeze({
          identity,
          distributionRoot:
            binding.session.configuration.nativeDistributionRoot,
          expectedRelease: binding.session.configuration.expectedNativeRelease,
          executionSourceKind: "fixed_development_candidate" as const,
        });
      } catch {
        return null;
      }
    },
    reserveInvocation(taskCapability: object, provider: Provider, role: Role) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      if (!binding || !observed || observed.result.status !== "recorded")
        return null;
      const reserved = binding.session.constraints.reserveInvocation(
        binding.token,
        provider,
        role,
        observed.observation,
      );
      if (reserved.status !== "recorded") return null;
      invocationBindings.set(reserved.value, binding);
      return reserved.value;
    },
    consumeInvocation(
      taskCapability: object,
      invocationCapability: object,
      provider: Provider,
      role: Role,
    ) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      return Boolean(
        binding &&
          observed &&
          observed.result.status === "recorded" &&
          binding.session.constraints.consumeInvocation(
            invocationCapability,
            binding.token,
            provider,
            role,
            observed.observation,
          ).status === "recorded",
      );
    },
    settleInvocation(taskCapability: object, invocationCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || invocationBindings.get(invocationCapability) !== binding)
        return false;
      const wasSettled =
        binding.session.constraints.settleInvocation(invocationCapability)
          .status === "recorded";
      if (wasSettled) invocationBindings.delete(invocationCapability);
      return wasSettled;
    },
    settleTask(
      taskCapability: object,
      outcome: "finished" | "cleanup_unknown",
    ) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return false;
      const settled = binding.session.constraints.settleTask(
        binding.token,
        outcome,
      );
      if (settled.status !== "recorded") return false;
      binding.settled = true;
      return true;
    },
    cancel(capability: object) {
      const session = sessions.get(capability);
      if (!session) return false;
      session.closed = true;
      session.constraints.cancel();
      return true;
    },
    inspect(capability: object) {
      const session = sessions.get(capability);
      if (!session) return null;
      observe(session);
      return Object.freeze({
        ...session.constraints.inspect(),
        identityObservation: session.timing.snapshot().identityObservation,
      });
    },
    tasks(capability: object) {
      const session = sessions.get(capability);
      if (!session || observe(session)?.result.status !== "recorded")
        return null;
      return Object.freeze(
        session.configuration.tasks.map((task) => task.request),
      );
    },
  });
}

const productionRuntime = createSessionRuntime(
  Object.freeze({
    observe: observeProduction,
    confirm: confirmRuntimeOwnedDevelopmentMeasurementUsingConsole,
    wallNow: Date.now,
    monotonicNow: () => performance.now(),
    randomChallenge: () => randomInt(0, 1_000_000).toString().padStart(6, "0"),
    isEffectBlocked: isRuntimeProcessEffectBlocked,
    verifyOperation: verifyOwnedOperationManagementCapability,
    borrowRepository: borrowRuntimeOwnedRepositorySource,
  }),
);

export function requestRuntimeOwnedDevelopmentMeasurementSession(
  raw: unknown,
  signal: AbortSignal,
) {
  return productionRuntime.request(raw, signal);
}

export function inspectRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.inspect(capability);
}

export function readRuntimeOwnedDevelopmentMeasurementTasks(
  capability: object,
) {
  return productionRuntime.tasks(capability);
}

export function cancelRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.cancel(capability);
}

export function borrowRuntimeOwnedDevelopmentNativeObservation(
  context: object,
  shouldInitializeIfMissing: boolean,
) {
  const observation = productionRuntime.borrowNativeObservation(
    context,
    shouldInitializeIfMissing,
  );
  const verification =
    observation && nativeVerifications.get(observation.identity);
  if (!observation || !verification) return null;
  // Consumed synchronously by the native adapter. The post-process borrow is
  // a separate fresh observation; this object is never used as its substitute.
  return Object.freeze({
    distributionRoot: observation.distributionRoot,
    expectedRelease: observation.expectedRelease,
    verification,
  });
}

export function inspectRuntimeOwnedDevelopmentOperationContext(
  managementCapability: unknown,
) {
  return managementCapability && typeof managementCapability === "object"
    ? productionRuntime.operationContext(managementCapability)
    : null;
}

/** Internal Task facade; caller values cannot construct an admitted session. */
export function reserveRuntimeOwnedDevelopmentMeasurementTask(
  sessionCapability: object,
  request: unknown,
  repositoryRoot: unknown,
) {
  const taskCapability = productionRuntime.reserveTask(
    sessionCapability,
    request,
  );
  if (!taskCapability) return null;
  const boundary = productionRuntime.taskBoundary(taskCapability);
  if (!boundary || boundary.repositoryRoot !== repositoryRoot) {
    productionRuntime.settleTask(taskCapability, "finished");
    return null;
  }
  return Object.freeze({
    ...boundary,
    context: taskCapability,
    bindOperation: (
      managementCapability: object,
      repositoryBindingCapability: object,
    ) =>
      productionRuntime.bindOperation(
        taskCapability,
        managementCapability,
        repositoryBindingCapability,
      ),
    beginInvocation: (provider: Provider, role: Role) => {
      const invocation = productionRuntime.reserveInvocation(
        taskCapability,
        provider,
        role,
      );
      if (!invocation) return null;
      return Object.freeze({
        commandRestriction: (purpose: string) =>
          purpose === "start_provider_attached"
            ? productionRuntime.consumeInvocation(
                taskCapability,
                invocation,
                provider,
                role,
              )
            : boundary.checkNewWork(),
        settle: () => {
          productionRuntime.settleInvocation(taskCapability, invocation);
        },
      });
    },
    finish: (outcome: "finished" | "cleanup_unknown") =>
      productionRuntime.settleTask(taskCapability, outcome),
  });
}

/** Isolated capability namespace: never accepted by the production facade. */
export function createIsolatedDevelopmentMeasurementSessionCandidate(
  dependencies: Dependencies,
) {
  return createSessionRuntime(dependencies);
}
