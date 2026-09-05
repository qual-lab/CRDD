import { types as utilTypes } from "node:util";

export const PROJECT_RUNTIME_PLATFORM_CONTRACT =
  "crdd-coordinator/project-runtime-platform-contract" as const;
export const PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION = 1;

/**
 * Project RuntimeのIF-PLATFORM境界群。
 * (01_Architecture.md 14.9). The lock_lease family is declared here because
 * the contract owns the closed family population. The Windows adapter now
 * supplies owner-liveness observation; resolution still fails closed for
 * unsupported families instead of narrowing the population.
 */
export const PROJECT_RUNTIME_PLATFORM_BOUNDARIES = Object.freeze([
  "principal_provider_home",
  "filesystem_repository",
  "lock_lease",
  "process_cancellation",
  "container_host",
  "runtime_root_recovery",
] as const);

export type ProjectRuntimePlatformBoundary =
  (typeof PROJECT_RUNTIME_PLATFORM_BOUNDARIES)[number];

/**
 * Closed operation-name population per boundary for contract revision 1.
 * Boundary support is resolved by exact match against this population, so a
 * family whose required set is empty is unresolvable by every adapter — an
 * empty set means "cannot resolve", never "trivially satisfied". Adding
 * operations to a family is a contract-revision decision of the implementing
 * stage.
 */
export const PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS = Object.freeze({
  principal_provider_home: Object.freeze(["observeProviderHomeCandidate"]),
  filesystem_repository: Object.freeze(["resolveRepositoryRoot"]),
  lock_lease: Object.freeze(["observeLeaseOwner"]),
  process_cancellation: Object.freeze(["deriveChildEnvironment"]),
  container_host: Object.freeze(["observeContainerHostRecoveryState"]),
  runtime_root_recovery: Object.freeze(["compileRootObservationCandidate"]),
} as const satisfies Readonly<
  Record<ProjectRuntimePlatformBoundary, readonly string[]>
>);

/**
 * Architecture-owned guarantees for each IF-PLATFORM boundary.  These are
 * deliberately broader than the currently extracted operation population:
 * an adapter may expose a useful operation candidate without claiming that
 * the whole boundary is ready for Project Runtime effects.
 */
export const PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES = Object.freeze({
  principal_provider_home: Object.freeze([
    "selected_principal_identity",
    "stable_provider_home_identity",
    "owner_writer_protection",
    "non_link_chain",
  ]),
  filesystem_repository: Object.freeze([
    "repository_root_identity",
    "repository_revision",
    "bounded_path_resolution",
    "atomic_update",
    "isolation",
  ]),
  lock_lease: Object.freeze([
    "os_exclusivity",
    "owner_generation",
    "owner_liveness",
    "non_time_only_takeover",
  ]),
  process_cancellation: Object.freeze([
    "argv",
    "environment",
    "process_tree",
    "cancellation_signal",
    "termination_observation",
    "owner_loss",
  ]),
  container_host: Object.freeze([
    "fixed_image",
    "network",
    "mount",
    "process",
    "cleanup",
  ]),
  runtime_root_recovery: Object.freeze([
    "managed_root",
    "protection",
    "resource_identity",
    "recovery_absence",
  ]),
} as const satisfies Readonly<
  Record<ProjectRuntimePlatformBoundary, readonly string[]>
>);

export type ProjectRuntimePlatformGuarantee =
  (typeof PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES)[ProjectRuntimePlatformBoundary][number];

export type ProjectRuntimePlatformAdapterDescription = Readonly<{
  contract: typeof PROJECT_RUNTIME_PLATFORM_CONTRACT;
  contractRevision: number;
  platformFamily: string;
  supportedBoundaries: readonly ProjectRuntimePlatformBoundary[];
  satisfiedGuarantees: Readonly<
    Partial<
      Record<
        ProjectRuntimePlatformBoundary,
        readonly ProjectRuntimePlatformGuarantee[]
      >
    >
  >;
  authorityGeneration: "none";
  unsupportedPlatformFallback: "none";
}>;

export type ProjectRuntimePlatformAdapter = Readonly<{
  describe: () => ProjectRuntimePlatformAdapterDescription;
  operations: Readonly<
    Partial<Record<ProjectRuntimePlatformBoundary, Readonly<object>>>
  >;
}>;

export type ProjectRuntimePlatformResolution =
  | Readonly<{ status: "resolved"; adapter: ProjectRuntimePlatformAdapter }>
  | Readonly<{
      status: "blocked";
      reason:
        | "platform_request_invalid"
        | "platform_identity_unknown"
        | "platform_adapter_unavailable"
        | "platform_adapter_conflict"
        | "platform_boundary_unsupported";
      unsupportedBoundaries: readonly ProjectRuntimePlatformBoundary[];
    }>;

const MAXIMUM_PLATFORM_FAMILY_LENGTH = 128;

const boundarySet: ReadonlySet<string> = new Set(
  PROJECT_RUNTIME_PLATFORM_BOUNDARIES,
);

type AdapterSnapshot = Readonly<{
  platformFamily: string;
  supportedBoundaries: ReadonlySet<ProjectRuntimePlatformBoundary>;
  satisfiedGuarantees: ReadonlyMap<
    ProjectRuntimePlatformBoundary,
    ReadonlySet<ProjectRuntimePlatformGuarantee>
  >;
}>;

function blocked(
  reason:
    | "platform_request_invalid"
    | "platform_identity_unknown"
    | "platform_adapter_unavailable"
    | "platform_adapter_conflict"
    | "platform_boundary_unsupported",
  unsupportedBoundaries: readonly ProjectRuntimePlatformBoundary[] = Object.freeze(
    [],
  ),
): ProjectRuntimePlatformResolution {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    unsupportedBoundaries: Object.freeze([...unsupportedBoundaries]),
  });
}

function validPlatformFamily(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAXIMUM_PLATFORM_FAMILY_LENGTH &&
    !value.includes("\0")
  );
}

/**
 * Read one own data property exactly once. Accessor properties, prototype
 * lookups and repeated reads are rejected so a hostile object cannot return a
 * validated value first and a different value later (single-read discipline
 * shared with plain-data-snapshot.ts).
 */
function ownDataProperty(container: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (
    !descriptor ||
    !Object.hasOwn(descriptor, "value") ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    return undefined;
  return descriptor.value;
}

function isPlainContainer(value: unknown): value is object {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Call describe() exactly once and validate the returned description into a
 * local snapshot. Every adapter-derived access is caught and mapped to null so
 * a throwing or shape-shifting adapter resolves to a closed blocked result,
 * never to an escaping exception.
 */
function describedAdapterSnapshot(candidate: unknown): AdapterSnapshot | null {
  try {
    if (!candidate || typeof candidate !== "object") return null;
    const describe = ownDataProperty(candidate, "describe");
    if (typeof describe !== "function") return null;
    const description: unknown = describe.call(candidate);
    if (!isPlainContainer(description)) return null;
    const platformFamily = ownDataProperty(description, "platformFamily");
    const supportedBoundaries = ownDataProperty(
      description,
      "supportedBoundaries",
    );
    const satisfiedGuarantees = ownDataProperty(
      description,
      "satisfiedGuarantees",
    );
    if (
      ownDataProperty(description, "contract") !==
        PROJECT_RUNTIME_PLATFORM_CONTRACT ||
      ownDataProperty(description, "contractRevision") !==
        PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION ||
      ownDataProperty(description, "authorityGeneration") !== "none" ||
      ownDataProperty(description, "unsupportedPlatformFallback") !== "none" ||
      !validPlatformFamily(platformFamily) ||
      !Array.isArray(supportedBoundaries) ||
      utilTypes.isProxy(supportedBoundaries) ||
      !isPlainContainer(satisfiedGuarantees)
    )
      return null;
    const boundaries = new Set<ProjectRuntimePlatformBoundary>();
    for (let index = 0; index < supportedBoundaries.length; index += 1) {
      const boundary = ownDataProperty(supportedBoundaries, String(index));
      if (
        typeof boundary !== "string" ||
        !boundarySet.has(boundary) ||
        boundaries.has(boundary as ProjectRuntimePlatformBoundary)
      )
        return null;
      boundaries.add(boundary as ProjectRuntimePlatformBoundary);
    }
    const guaranteeSnapshot = new Map<
      ProjectRuntimePlatformBoundary,
      ReadonlySet<ProjectRuntimePlatformGuarantee>
    >();
    for (const boundary of PROJECT_RUNTIME_PLATFORM_BOUNDARIES) {
      const rawGuarantees = ownDataProperty(satisfiedGuarantees, boundary);
      if (rawGuarantees === undefined) continue;
      if (!Array.isArray(rawGuarantees) || utilTypes.isProxy(rawGuarantees))
        return null;
      const allowed = new Set<string>(
        PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES[boundary],
      );
      const observed = new Set<ProjectRuntimePlatformGuarantee>();
      for (let index = 0; index < rawGuarantees.length; index += 1) {
        const guarantee = ownDataProperty(rawGuarantees, String(index));
        if (
          typeof guarantee !== "string" ||
          !allowed.has(guarantee) ||
          observed.has(guarantee as ProjectRuntimePlatformGuarantee)
        )
          return null;
        observed.add(guarantee as ProjectRuntimePlatformGuarantee);
      }
      guaranteeSnapshot.set(boundary, observed);
    }
    return Object.freeze({
      platformFamily,
      supportedBoundaries: boundaries,
      satisfiedGuarantees: guaranteeSnapshot,
    });
  } catch {
    return null;
  }
}

/**
 * A boundary is supported only when the snapshot declares it AND the adapter
 * binds exactly the closed operation-name population of this contract
 * revision as own data-property functions. A family whose required set is
 * empty is unresolvable by construction.
 */
function supportsBoundary(
  adapter: ProjectRuntimePlatformAdapter,
  snapshot: AdapterSnapshot,
  boundary: ProjectRuntimePlatformBoundary,
): boolean {
  try {
    const requiredOperations =
      PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS[boundary];
    if (
      requiredOperations.length === 0 ||
      !snapshot.supportedBoundaries.has(boundary)
    )
      return false;
    const satisfiedGuarantees = snapshot.satisfiedGuarantees.get(boundary);
    const requiredGuarantees =
      PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES[boundary];
    if (
      satisfiedGuarantees === undefined ||
      requiredGuarantees.some(
        (guarantee) => !satisfiedGuarantees.has(guarantee),
      )
    )
      return false;
    const operations = ownDataProperty(adapter, "operations");
    if (!isPlainContainer(operations)) return false;
    const group = ownDataProperty(operations, boundary);
    if (!isPlainContainer(group)) return false;
    const groupKeys = Object.keys(group);
    return (
      groupKeys.length === requiredOperations.length &&
      requiredOperations.every(
        (operationName) =>
          typeof ownDataProperty(group, operationName) === "function",
      )
    );
  } catch {
    return false;
  }
}

function resolvedAdapterSnapshot(
  adapter: ProjectRuntimePlatformAdapter,
  snapshot: AdapterSnapshot,
  resolvedBoundaries: readonly ProjectRuntimePlatformBoundary[],
): ProjectRuntimePlatformAdapter | null {
  try {
    const rawOperations = ownDataProperty(adapter, "operations");
    if (!isPlainContainer(rawOperations)) return null;
    const operations: Partial<
      Record<ProjectRuntimePlatformBoundary, Readonly<object>>
    > = {};
    const satisfiedGuarantees: Partial<
      Record<
        ProjectRuntimePlatformBoundary,
        readonly ProjectRuntimePlatformGuarantee[]
      >
    > = {};
    for (const boundary of resolvedBoundaries) {
      const rawGroup = ownDataProperty(rawOperations, boundary);
      if (!isPlainContainer(rawGroup)) return null;
      const group: Record<string, unknown> = {};
      for (const operationName of PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS[
        boundary
      ]) {
        const operation = ownDataProperty(rawGroup, operationName);
        if (typeof operation !== "function") return null;
        group[operationName] = operation;
      }
      operations[boundary] = Object.freeze(group);
      satisfiedGuarantees[boundary] =
        PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES[boundary];
    }
    const description = Object.freeze({
      contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
      contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
      platformFamily: snapshot.platformFamily,
      supportedBoundaries: Object.freeze([...resolvedBoundaries]),
      satisfiedGuarantees: Object.freeze(satisfiedGuarantees),
      authorityGeneration: "none" as const,
      unsupportedPlatformFallback: "none" as const,
    });
    return Object.freeze({
      describe: () => description,
      operations: Object.freeze(operations),
    });
  } catch {
    return null;
  }
}

/**
 * Fail-closed adapter resolution for IF-PLATFORM. There is no fallback path:
 * an unknown platform family, a missing adapter, an ambiguous registry or an
 * unsupported required boundary each returns a closed blocked result and the
 * caller must not start any Project, Task or Provider effect (PR-A-07,
 * INV-PLATFORM-NO-FALLBACK).
 */
export function resolveProjectRuntimePlatformAdapter(
  observedPlatformFamily: unknown,
  registeredAdapters: readonly ProjectRuntimePlatformAdapter[],
  requiredBoundaries: readonly ProjectRuntimePlatformBoundary[],
): ProjectRuntimePlatformResolution {
  if (
    !Array.isArray(registeredAdapters) ||
    !Array.isArray(requiredBoundaries) ||
    requiredBoundaries.length === 0 ||
    requiredBoundaries.some((boundary) => !boundarySet.has(boundary)) ||
    new Set(requiredBoundaries).size !== requiredBoundaries.length
  )
    return blocked("platform_request_invalid");
  if (!validPlatformFamily(observedPlatformFamily))
    return blocked("platform_identity_unknown");
  const matches: Readonly<{
    adapter: ProjectRuntimePlatformAdapter;
    snapshot: AdapterSnapshot;
  }>[] = [];
  for (const candidate of registeredAdapters) {
    const snapshot = describedAdapterSnapshot(candidate);
    if (snapshot && snapshot.platformFamily === observedPlatformFamily)
      matches.push(Object.freeze({ adapter: candidate, snapshot }));
  }
  const match = matches[0];
  if (match === undefined) return blocked("platform_adapter_unavailable");
  if (matches.length > 1) return blocked("platform_adapter_conflict");
  const unsupportedBoundaries = requiredBoundaries.filter(
    (boundary) => !supportsBoundary(match.adapter, match.snapshot, boundary),
  );
  if (unsupportedBoundaries.length > 0)
    return blocked("platform_boundary_unsupported", unsupportedBoundaries);
  const adapter = resolvedAdapterSnapshot(
    match.adapter,
    match.snapshot,
    requiredBoundaries,
  );
  if (adapter === null) return blocked("platform_boundary_unsupported");
  return Object.freeze({ status: "resolved" as const, adapter });
}

export function describeProjectRuntimePlatformContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
    contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
    boundaries: PROJECT_RUNTIME_PLATFORM_BOUNDARIES,
    boundaryOperations: PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS,
    boundaryGuarantees: PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES,
    boundarySupport:
      "declared_boundary_and_all_architecture_guarantees_and_exact_operation_name_match",
    emptyOperationPopulation: "unresolvable_never_trivially_satisfied",
    authorityGeneration: "none",
    unsupportedPlatformFallback: "none",
    unresolvedPlatformEffect: "zero_project_task_and_provider_effect",
  });
}
