/**
 * platform-contractに属する責務をまとめる。
 *
 * @responsibility OrchestratorPlatformBoundaryを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { types as utilTypes } from "node:util";

export const ORCHESTRATOR_PLATFORM_CONTRACT =
  "crdd-coordinator/orchestrator-platform-contract" as const;
export const ORCHESTRATOR_PLATFORM_CONTRACT_REVISION = 1;

/**
 * OrchestratorのIF-PLATFORM境界群。
 * The lock_lease family is declared here because
 * the contract owns the closed family population. The Windows adapter now
 * supplies owner-liveness observation; resolution still fails closed for
 * unsupported families instead of narrowing the population.
 */
export const ORCHESTRATOR_PLATFORM_BOUNDARIES = Object.freeze([
  "principal_provider_home",
  "filesystem_repository",
  "lock_lease",
  "process_cancellation",
  "container_host",
  "runtime_root_recovery",
] as const);

/**
 * platform-contractで使用するOrchestrator Platform Boundaryの値契約を定義する。
 *
 * @responsibility Orchestrator Platform BoundaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPlatformBoundaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPlatformBoundaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPlatformBoundaryの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPlatformBoundaryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPlatformBoundaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPlatformBoundary =
  (typeof ORCHESTRATOR_PLATFORM_BOUNDARIES)[number];

/**
 * Closed operation-name population per boundary for contract revision 1.
 * Boundary support is resolved by exact match against this population, so a
 * family whose required set is empty is unresolvable by every adapter — an
 * empty set means "cannot resolve", never "trivially satisfied". Adding
 * operations to a family is a contract-revision decision of the implementing
 * stage.
 */
export const ORCHESTRATOR_PLATFORM_BOUNDARY_OPERATIONS = Object.freeze({
  principal_provider_home: Object.freeze(["observeProviderHomeCandidate"]),
  filesystem_repository: Object.freeze(["resolveRepositoryRoot"]),
  lock_lease: Object.freeze(["observeLeaseOwner"]),
  process_cancellation: Object.freeze(["deriveChildEnvironment"]),
  container_host: Object.freeze(["observeContainerHostRecoveryState"]),
  runtime_root_recovery: Object.freeze(["compileRootObservationCandidate"]),
} as const satisfies Readonly<
  Record<OrchestratorPlatformBoundary, readonly string[]>
>);

/**
 * Architecture-owned guarantees for each IF-PLATFORM boundary.  These are
 * deliberately broader than the currently extracted operation population:
 * an adapter may expose a useful operation candidate without claiming that
 * the whole boundary is ready for Orchestrator effects.
 */
export const ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES = Object.freeze({
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
  Record<OrchestratorPlatformBoundary, readonly string[]>
>);

/**
 * platform-contractで使用するOrchestrator Platform Guaranteeの値契約を定義する。
 *
 * @responsibility Orchestrator Platform GuaranteeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPlatformGuaranteeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPlatformGuaranteeで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPlatformGuaranteeの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPlatformGuaranteeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPlatformGuaranteeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPlatformGuarantee =
  (typeof ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES)[OrchestratorPlatformBoundary][number];

/**
 * platform-contractで使用するOrchestrator Platform Adapter Descriptionの値契約を定義する。
 *
 * @responsibility Orchestrator Platform Adapter DescriptionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPlatformAdapterDescriptionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPlatformAdapterDescriptionで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPlatformAdapterDescriptionの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPlatformAdapterDescriptionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPlatformAdapterDescriptionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPlatformAdapterDescription = Readonly<{
  contract: typeof ORCHESTRATOR_PLATFORM_CONTRACT;
  contractRevision: number;
  platformFamily: string;
  supportedBoundaries: readonly OrchestratorPlatformBoundary[];
  satisfiedGuarantees: Readonly<
    Partial<
      Record<
        OrchestratorPlatformBoundary,
        readonly OrchestratorPlatformGuarantee[]
      >
    >
  >;
  authorityGeneration: "none";
  unsupportedPlatformFallback: "none";
}>;

/**
 * platform-contractで使用するOrchestrator Platform Adapterの値契約を定義する。
 *
 * @responsibility Orchestrator Platform AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPlatformAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPlatformAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPlatformAdapterの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPlatformAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPlatformAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPlatformAdapter = Readonly<{
  describe: () => OrchestratorPlatformAdapterDescription;
  operations: Readonly<
    Partial<Record<OrchestratorPlatformBoundary, Readonly<object>>>
  >;
}>;

/**
 * platform-contractで使用するOrchestrator Platform Resolutionの値契約を定義する。
 *
 * @responsibility Orchestrator Platform ResolutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPlatformResolutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPlatformResolutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPlatformResolutionの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPlatformResolutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPlatformResolutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPlatformResolution =
  | Readonly<{ status: "resolved"; adapter: OrchestratorPlatformAdapter }>
  | Readonly<{
      status: "blocked";
      reason:
        | "platform_request_invalid"
        | "platform_identity_unknown"
        | "platform_adapter_unavailable"
        | "platform_adapter_conflict"
        | "platform_boundary_unsupported";
      unsupportedBoundaries: readonly OrchestratorPlatformBoundary[];
    }>;

const MAXIMUM_PLATFORM_FAMILY_LENGTH = 128;

const boundarySet: ReadonlySet<string> = new Set(
  ORCHESTRATOR_PLATFORM_BOUNDARIES,
);

/**
 * platform-contractで使用するAdapter Snapshotの値契約を定義する。
 *
 * @responsibility Adapter SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape AdapterSnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant AdapterSnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: AdapterSnapshotの宣言は外部境界を開かない。
 * @security N/A: AdapterSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility AdapterSnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type AdapterSnapshot = Readonly<{
  platformFamily: string;
  supportedBoundaries: ReadonlySet<OrchestratorPlatformBoundary>;
  satisfiedGuarantees: ReadonlyMap<
    OrchestratorPlatformBoundary,
    ReadonlySet<OrchestratorPlatformGuarantee>
  >;
}>;

/**
 * platform-contractを停止結果として構築する。
 *
 * @responsibility platform-contractの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: | "platform_request_invalid" | "platform_identity_unknown" | "platform_adapter_unavailable" | "platform_adapter_conflict" | "platform_boundary_unsupported"、unsupportedBoundaries: readonly OrchestratorPlatformBoundary[]
 * @returns OrchestratorPlatformResolutionを返す。
 * @precondition 「reason: | "platform_request_invalid" | "platform_identity_unknown" | "platform_adapter_unavailable" | "platform_adapter_conflict" | "platform_boundary_unsupported"、unsupportedBoundaries: readonly OrchestratorPlatformBoundary[]」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  reason:
    | "platform_request_invalid"
    | "platform_identity_unknown"
    | "platform_adapter_unavailable"
    | "platform_adapter_conflict"
    | "platform_boundary_unsupported",
  unsupportedBoundaries: readonly OrchestratorPlatformBoundary[] = Object.freeze(
    [],
  ),
): OrchestratorPlatformResolution {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    unsupportedBoundaries: Object.freeze([...unsupportedBoundaries]),
  });
}

/**
 * Platform Familyが有効か判定する。
 *
 * @responsibility Platform Familyの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidPlatformFamilyの入力契約を満たす。
 * @postcondition validPlatformFamilyの責務を完了した結果だけを返す。
 * @effect N/A: validPlatformFamilyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validPlatformFamilyは独自の失敗分岐を所有しない。
 * @invariant validPlatformFamilyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validPlatformFamilyはProcess内の同一Subsystemで完結する。
 * @security N/A: validPlatformFamilyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validPlatformFamilyは共有非同期状態を持たない同期処理である。
 */
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
 *
 * @responsibility platform-contractの入力からown Data Propertyを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input container: object、key: string
 * @returns unknownを返す。
 * @precondition 「container: object、key: string」がownDataPropertyの入力契約を満たす。
 * @postcondition ownDataPropertyの責務を完了した結果だけを返す。
 * @effect N/A: ownDataPropertyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownDataPropertyは独自の失敗分岐を所有しない。
 * @invariant ownDataPropertyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownDataPropertyはProcess内の同一Subsystemで完結する。
 * @security N/A: ownDataPropertyはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ownDataPropertyは共有非同期状態を持たない同期処理である。
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

/**
 * Plain Containerかを判定する。
 *
 * @responsibility Plain Containerの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainContainerの入力契約を満たす。
 * @postcondition isPlainContainerの責務を完了した結果だけを返す。
 * @effect N/A: isPlainContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainContainerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlainContainerはProcess内の同一Subsystemで完結する。
 * @security N/A: isPlainContainerはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isPlainContainerは共有非同期状態を持たない同期処理である。
 */
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
 *
 * @responsibility platform-contractの入力からdescribed Adapter Snapshotを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input candidate: unknown
 * @returns AdapterSnapshot | nullを返す。
 * @precondition 「candidate: unknown」がdescribedAdapterSnapshotの入力契約を満たす。
 * @postcondition describedAdapterSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: describedAdapterSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure describedAdapterSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant describedAdapterSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describedAdapterSnapshotはProcess内の同一Subsystemで完結する。
 * @security N/A: describedAdapterSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describedAdapterSnapshotは共有非同期状態を持たない同期処理である。
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
        ORCHESTRATOR_PLATFORM_CONTRACT ||
      ownDataProperty(description, "contractRevision") !==
        ORCHESTRATOR_PLATFORM_CONTRACT_REVISION ||
      ownDataProperty(description, "authorityGeneration") !== "none" ||
      ownDataProperty(description, "unsupportedPlatformFallback") !== "none" ||
      !validPlatformFamily(platformFamily) ||
      !Array.isArray(supportedBoundaries) ||
      utilTypes.isProxy(supportedBoundaries) ||
      !isPlainContainer(satisfiedGuarantees)
    )
      return null;
    const boundaries = new Set<OrchestratorPlatformBoundary>();
    for (let index = 0; index < supportedBoundaries.length; index += 1) {
      const boundary = ownDataProperty(supportedBoundaries, String(index));
      if (
        typeof boundary !== "string" ||
        !boundarySet.has(boundary) ||
        boundaries.has(boundary as OrchestratorPlatformBoundary)
      )
        return null;
      boundaries.add(boundary as OrchestratorPlatformBoundary);
    }
    const guaranteeSnapshot = new Map<
      OrchestratorPlatformBoundary,
      ReadonlySet<OrchestratorPlatformGuarantee>
    >();
    for (const boundary of ORCHESTRATOR_PLATFORM_BOUNDARIES) {
      const rawGuarantees = ownDataProperty(satisfiedGuarantees, boundary);
      if (rawGuarantees === undefined) continue;
      if (!Array.isArray(rawGuarantees) || utilTypes.isProxy(rawGuarantees))
        return null;
      const allowed = new Set<string>(
        ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES[boundary],
      );
      const observed = new Set<OrchestratorPlatformGuarantee>();
      for (let index = 0; index < rawGuarantees.length; index += 1) {
        const guarantee = ownDataProperty(rawGuarantees, String(index));
        if (
          typeof guarantee !== "string" ||
          !allowed.has(guarantee) ||
          observed.has(guarantee as OrchestratorPlatformGuarantee)
        )
          return null;
        observed.add(guarantee as OrchestratorPlatformGuarantee);
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
 *
 * @responsibility platform-contractの入力からsupports Boundaryを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input adapter: OrchestratorPlatformAdapter、snapshot: AdapterSnapshot、boundary: OrchestratorPlatformBoundary
 * @returns booleanを返す。
 * @precondition 「adapter: OrchestratorPlatformAdapter、snapshot: AdapterSnapshot、boundary: OrchestratorPlatformBoundary」がsupportsBoundaryの入力契約を満たす。
 * @postcondition supportsBoundaryの責務を完了した結果だけを返す。
 * @effect N/A: supportsBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure supportsBoundaryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant supportsBoundaryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: supportsBoundaryはProcess内の同一Subsystemで完結する。
 * @security N/A: supportsBoundaryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: supportsBoundaryは共有非同期状態を持たない同期処理である。
 */
function supportsBoundary(
  adapter: OrchestratorPlatformAdapter,
  snapshot: AdapterSnapshot,
  boundary: OrchestratorPlatformBoundary,
): boolean {
  try {
    const requiredOperations =
      ORCHESTRATOR_PLATFORM_BOUNDARY_OPERATIONS[boundary];
    if (
      requiredOperations.length === 0 ||
      !snapshot.supportedBoundaries.has(boundary)
    )
      return false;
    const satisfiedGuarantees = snapshot.satisfiedGuarantees.get(boundary);
    const requiredGuarantees =
      ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES[boundary];
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

/**
 * resolved Adapter Snapshotを決定する。
 *
 * @responsibility resolved Adapter Snapshotの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input adapter: OrchestratorPlatformAdapter、snapshot: AdapterSnapshot、resolvedBoundaries: readonly OrchestratorPlatformBoundary[]
 * @returns OrchestratorPlatformAdapter | nullを返す。
 * @precondition 「adapter: OrchestratorPlatformAdapter、snapshot: AdapterSnapshot、resolvedBoundaries: readonly OrchestratorPlatformBoundary[]」がresolvedAdapterSnapshotの入力契約を満たす。
 * @postcondition resolvedAdapterSnapshotの責務を完了した結果だけを返す。
 * @effect N/A: resolvedAdapterSnapshotは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolvedAdapterSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolvedAdapterSnapshotは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolvedAdapterSnapshotはProcess内の同一Subsystemで完結する。
 * @security N/A: resolvedAdapterSnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolvedAdapterSnapshotは共有非同期状態を持たない同期処理である。
 */
function resolvedAdapterSnapshot(
  adapter: OrchestratorPlatformAdapter,
  snapshot: AdapterSnapshot,
  resolvedBoundaries: readonly OrchestratorPlatformBoundary[],
): OrchestratorPlatformAdapter | null {
  try {
    const rawOperations = ownDataProperty(adapter, "operations");
    if (!isPlainContainer(rawOperations)) return null;
    const operations: Partial<
      Record<OrchestratorPlatformBoundary, Readonly<object>>
    > = {};
    const satisfiedGuarantees: Partial<
      Record<
        OrchestratorPlatformBoundary,
        readonly OrchestratorPlatformGuarantee[]
      >
    > = {};
    for (const boundary of resolvedBoundaries) {
      const rawGroup = ownDataProperty(rawOperations, boundary);
      if (!isPlainContainer(rawGroup)) return null;
      const group: Record<string, unknown> = {};
      for (const operationName of ORCHESTRATOR_PLATFORM_BOUNDARY_OPERATIONS[
        boundary
      ]) {
        const operation = ownDataProperty(rawGroup, operationName);
        if (typeof operation !== "function") return null;
        group[operationName] = operation;
      }
      operations[boundary] = Object.freeze(group);
      satisfiedGuarantees[boundary] =
        ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES[boundary];
    }
    const description = Object.freeze({
      contract: ORCHESTRATOR_PLATFORM_CONTRACT,
      contractRevision: ORCHESTRATOR_PLATFORM_CONTRACT_REVISION,
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
 *
 * @responsibility Orchestrator Platform Adapterの候補集合、解決規則、曖昧時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input observedPlatformFamily: unknown、registeredAdapters: readonly OrchestratorPlatformAdapter[]、requiredBoundaries: readonly OrchestratorPlatformBoundary[]
 * @returns OrchestratorPlatformResolutionを返す。
 * @precondition 「observedPlatformFamily: unknown、registeredAdapters: readonly OrchestratorPlatformAdapter[]、requiredBoundaries: readonly OrchestratorPlatformBoundary[]」がresolveOrchestratorPlatformAdapterの入力契約を満たす。
 * @postcondition resolveOrchestratorPlatformAdapterの責務を完了した結果だけを返す。
 * @effect N/A: resolveOrchestratorPlatformAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveOrchestratorPlatformAdapterは独自の失敗分岐を所有しない。
 * @invariant resolveOrchestratorPlatformAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveOrchestratorPlatformAdapterはProcess内の同一Subsystemで完結する。
 * @security N/A: resolveOrchestratorPlatformAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resolveOrchestratorPlatformAdapterは共有非同期状態を持たない同期処理である。
 */
export function resolveOrchestratorPlatformAdapter(
  observedPlatformFamily: unknown,
  registeredAdapters: readonly OrchestratorPlatformAdapter[],
  requiredBoundaries: readonly OrchestratorPlatformBoundary[],
): OrchestratorPlatformResolution {
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
    adapter: OrchestratorPlatformAdapter;
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

/**
 * Orchestrator Platform 契約の公開契約を記述する。
 *
 * @responsibility Orchestrator Platform 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeOrchestratorPlatformContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeOrchestratorPlatformContractの入力契約を満たす。
 * @postcondition describeOrchestratorPlatformContractの責務を完了した結果だけを返す。
 * @effect N/A: describeOrchestratorPlatformContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeOrchestratorPlatformContractは独自の失敗分岐を所有しない。
 * @invariant describeOrchestratorPlatformContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeOrchestratorPlatformContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeOrchestratorPlatformContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeOrchestratorPlatformContractは共有非同期状態を持たない同期処理である。
 */
export function describeOrchestratorPlatformContract() {
  return Object.freeze({
    contract: ORCHESTRATOR_PLATFORM_CONTRACT,
    contractRevision: ORCHESTRATOR_PLATFORM_CONTRACT_REVISION,
    boundaries: ORCHESTRATOR_PLATFORM_BOUNDARIES,
    boundaryOperations: ORCHESTRATOR_PLATFORM_BOUNDARY_OPERATIONS,
    boundaryGuarantees: ORCHESTRATOR_PLATFORM_BOUNDARY_GUARANTEES,
    boundarySupport:
      "declared_boundary_and_all_architecture_guarantees_and_exact_operation_name_match",
    emptyOperationPopulation: "unresolvable_never_trivially_satisfied",
    authorityGeneration: "none",
    unsupportedPlatformFallback: "none",
    unresolvedPlatformEffect: "zero_project_task_and_provider_effect",
  });
}
