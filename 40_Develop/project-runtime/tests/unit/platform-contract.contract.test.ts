import assert from "node:assert/strict";
import test from "node:test";

import {
  describeProjectRuntimePlatformContract,
  PROJECT_RUNTIME_PLATFORM_BOUNDARIES,
  PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES,
  PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS,
  PROJECT_RUNTIME_PLATFORM_CONTRACT,
  PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
  type ProjectRuntimePlatformAdapter,
  type ProjectRuntimePlatformBoundary,
  resolveProjectRuntimePlatformAdapter,
} from "../../src/index.ts";

const resolvableBoundaries = Object.freeze(
  PROJECT_RUNTIME_PLATFORM_BOUNDARIES.filter(
    (boundary) =>
      PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS[boundary].length > 0,
  ),
);

function canonicalOperations(
  boundary: ProjectRuntimePlatformBoundary,
): Readonly<object> {
  const group: Record<string, unknown> = {};
  for (const operationName of PROJECT_RUNTIME_PLATFORM_BOUNDARY_OPERATIONS[
    boundary
  ])
    group[operationName] = () => Object.freeze({ status: "blocked" });
  return Object.freeze(group);
}

function syntheticAdapter(
  platformFamily: string,
  supportedBoundaries: readonly ProjectRuntimePlatformBoundary[],
  operationOverrides: Readonly<
    Partial<Record<ProjectRuntimePlatformBoundary, Readonly<object>>>
  > = Object.freeze({}),
): ProjectRuntimePlatformAdapter {
  const operations: Partial<
    Record<ProjectRuntimePlatformBoundary, Readonly<object>>
  > = {};
  for (const boundary of supportedBoundaries) {
    operations[boundary] =
      operationOverrides[boundary] ?? canonicalOperations(boundary);
  }
  return Object.freeze({
    describe: () =>
      Object.freeze({
        contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
        contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
        platformFamily,
        supportedBoundaries,
        satisfiedGuarantees: Object.freeze(
          Object.fromEntries(
            supportedBoundaries.map((boundary) => [
              boundary,
              PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES[boundary],
            ]),
          ),
        ),
        authorityGeneration: "none" as const,
        unsupportedPlatformFallback: "none" as const,
      }),
    operations: Object.freeze(operations),
  });
}

test("Platform契約は境界母集団・操作名対応・非fallbackを閉集合で公開する", () => {
  assert.deepEqual(describeProjectRuntimePlatformContract(), {
    contract: "crdd-coordinator/project-runtime-platform-contract",
    contractRevision: 1,
    boundaries: [
      "principal_provider_home",
      "filesystem_repository",
      "lock_lease",
      "process_cancellation",
      "container_host",
      "runtime_root_recovery",
    ],
    boundaryOperations: {
      principal_provider_home: ["observeProviderHomeCandidate"],
      filesystem_repository: ["resolveRepositoryRoot"],
      lock_lease: ["observeLeaseOwner"],
      process_cancellation: ["deriveChildEnvironment"],
      container_host: ["observeContainerHostRecoveryState"],
      runtime_root_recovery: ["compileRootObservationCandidate"],
    },
    boundaryGuarantees: {
      principal_provider_home: [
        "selected_principal_identity",
        "stable_provider_home_identity",
        "owner_writer_protection",
        "non_link_chain",
      ],
      filesystem_repository: [
        "repository_root_identity",
        "repository_revision",
        "bounded_path_resolution",
        "atomic_update",
        "isolation",
      ],
      lock_lease: [
        "os_exclusivity",
        "owner_generation",
        "owner_liveness",
        "non_time_only_takeover",
      ],
      process_cancellation: [
        "argv",
        "environment",
        "process_tree",
        "cancellation_signal",
        "termination_observation",
        "owner_loss",
      ],
      container_host: ["fixed_image", "network", "mount", "process", "cleanup"],
      runtime_root_recovery: [
        "managed_root",
        "protection",
        "resource_identity",
        "recovery_absence",
      ],
    },
    boundarySupport:
      "declared_boundary_and_all_architecture_guarantees_and_exact_operation_name_match",
    emptyOperationPopulation: "unresolvable_never_trivially_satisfied",
    authorityGeneration: "none",
    unsupportedPlatformFallback: "none",
    unresolvedPlatformEffect: "zero_project_task_and_provider_effect",
  });
});

test("Platform Identity不明はfallbackなしのEffect 0で停止する", () => {
  const windows = syntheticAdapter("windows", resolvableBoundaries);
  for (const observedFamily of [
    null,
    undefined,
    "",
    7,
    {},
    Symbol("windows"),
    "w".repeat(129),
    "win\0dows",
  ])
    assert.deepEqual(
      resolveProjectRuntimePlatformAdapter(
        observedFamily,
        [windows],
        ["filesystem_repository"],
      ),
      {
        status: "blocked",
        reason: "platform_identity_unknown",
        unsupportedBoundaries: [],
      },
    );
});

test("Adapter不在の既知Platformは別PlatformへfallbackせずEffect 0で停止する", () => {
  const windows = syntheticAdapter("windows", resolvableBoundaries);
  const resolution = resolveProjectRuntimePlatformAdapter(
    "linux",
    [windows],
    ["filesystem_repository"],
  );
  assert.deepEqual(resolution, {
    status: "blocked",
    reason: "platform_adapter_unavailable",
    unsupportedBoundaries: [],
  });
});

test("必要境界の保証未成立はEffect 0で停止し未成立境界を返す", () => {
  const partial = syntheticAdapter("windows", [
    "filesystem_repository",
    "container_host",
  ]);
  const resolution = resolveProjectRuntimePlatformAdapter(
    "windows",
    [partial],
    ["filesystem_repository", "lock_lease", "process_cancellation"],
  );
  assert.deepEqual(resolution, {
    status: "blocked",
    reason: "platform_boundary_unsupported",
    unsupportedBoundaries: ["lock_lease", "process_cancellation"],
  });
});

test("lock_leaseはowner観測のexact operationと全保証が揃った場合だけ解決する", () => {
  const claimingLockLease = syntheticAdapter(
    "windows",
    resolvableBoundaries,
    Object.freeze({
      lock_lease: Object.freeze({ observeLeaseOwner: () => null }),
    }),
  );
  assert.equal(
    resolveProjectRuntimePlatformAdapter(
      "windows",
      [claimingLockLease],
      ["lock_lease"],
    ).status,
    "resolved",
  );
});

test("宣言済み境界でも操作名がexact一致しない場合は保証未成立として停止する", () => {
  const missingOperation = syntheticAdapter(
    "windows",
    ["filesystem_repository"],
    Object.freeze({ filesystem_repository: Object.freeze({}) }),
  );
  const renamedOperation = syntheticAdapter(
    "windows",
    ["filesystem_repository"],
    Object.freeze({
      filesystem_repository: Object.freeze({ resolveRoot: () => null }),
    }),
  );
  const extraOperation = syntheticAdapter(
    "windows",
    ["filesystem_repository"],
    Object.freeze({
      filesystem_repository: Object.freeze({
        resolveRepositoryRoot: () => null,
        unexpectedExtra: () => null,
      }),
    }),
  );
  const accessorOperation = Object.freeze({
    describe: syntheticAdapter("windows", ["filesystem_repository"]).describe,
    operations: Object.freeze(
      Object.defineProperty({}, "filesystem_repository", {
        enumerable: true,
        get: () =>
          Object.freeze({ resolveRepositoryRoot: () => null }) as object,
      }),
    ),
  }) as unknown as ProjectRuntimePlatformAdapter;
  for (const adapter of [
    missingOperation,
    renamedOperation,
    extraOperation,
    accessorOperation,
  ])
    assert.deepEqual(
      resolveProjectRuntimePlatformAdapter(
        "windows",
        [adapter],
        ["filesystem_repository"],
      ),
      {
        status: "blocked",
        reason: "platform_boundary_unsupported",
        unsupportedBoundaries: ["filesystem_repository"],
      },
    );
});

test("同一Platformの複数Adapterは競合としてEffect 0で停止する", () => {
  const first = syntheticAdapter("windows", resolvableBoundaries);
  const second = syntheticAdapter("windows", resolvableBoundaries);
  assert.deepEqual(
    resolveProjectRuntimePlatformAdapter(
      "windows",
      [first, second],
      ["filesystem_repository"],
    ),
    {
      status: "blocked",
      reason: "platform_adapter_conflict",
      unsupportedBoundaries: [],
    },
  );
});

test("不正なresolve要求は入力拒否としてEffect 0で停止する", () => {
  const windows = syntheticAdapter("windows", resolvableBoundaries);
  const invalidRequests: readonly (readonly [unknown, unknown])[] = [
    [[windows], []],
    [[windows], ["unknown_boundary"]],
    [[windows], ["filesystem_repository", "filesystem_repository"]],
    [[windows], "filesystem_repository"],
    [null, ["filesystem_repository"]],
  ];
  for (const [adapters, boundaries] of invalidRequests)
    assert.deepEqual(
      resolveProjectRuntimePlatformAdapter(
        "windows",
        adapters as readonly ProjectRuntimePlatformAdapter[],
        boundaries as readonly ProjectRuntimePlatformBoundary[],
      ),
      {
        status: "blocked",
        reason: "platform_request_invalid",
        unsupportedBoundaries: [],
      },
    );
});

test("契約・改訂・Authority宣言が異なるAdapterへは解決しない", () => {
  const foreignContract: ProjectRuntimePlatformAdapter = Object.freeze({
    describe: () =>
      Object.freeze({
        contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
        contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION + 1,
        platformFamily: "windows",
        supportedBoundaries: resolvableBoundaries,
        satisfiedGuarantees: Object.freeze(
          Object.fromEntries(
            resolvableBoundaries.map((boundary) => [
              boundary,
              PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES[boundary],
            ]),
          ),
        ),
        authorityGeneration: "none" as const,
        unsupportedPlatformFallback: "none" as const,
      }),
    operations: Object.freeze({}),
  });
  const authorityClaiming = Object.freeze({
    describe: () =>
      Object.freeze({
        contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
        contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
        platformFamily: "windows",
        supportedBoundaries: resolvableBoundaries,
        satisfiedGuarantees: Object.freeze(
          Object.fromEntries(
            resolvableBoundaries.map((boundary) => [
              boundary,
              PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES[boundary],
            ]),
          ),
        ),
        authorityGeneration: "adapter_issued",
        unsupportedPlatformFallback: "none" as const,
      }),
    operations: Object.freeze({}),
  }) as unknown as ProjectRuntimePlatformAdapter;
  const throwingDescribe = Object.freeze({
    describe: () => {
      throw new Error("describe_failed");
    },
    operations: Object.freeze({}),
  }) as unknown as ProjectRuntimePlatformAdapter;
  const accessorFamily = Object.freeze({
    describe: () =>
      Object.defineProperty(
        {
          contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
          contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
          supportedBoundaries: resolvableBoundaries,
          satisfiedGuarantees: Object.freeze({}),
          authorityGeneration: "none",
          unsupportedPlatformFallback: "none",
        },
        "platformFamily",
        { enumerable: true, get: () => "windows" },
      ),
    operations: Object.freeze({}),
  }) as unknown as ProjectRuntimePlatformAdapter;
  for (const adapter of [
    foreignContract,
    authorityClaiming,
    throwingDescribe,
    accessorFamily,
  ])
    assert.deepEqual(
      resolveProjectRuntimePlatformAdapter(
        "windows",
        [adapter],
        ["filesystem_repository"],
      ),
      {
        status: "blocked",
        reason: "platform_adapter_unavailable",
        unsupportedBoundaries: [],
      },
    );
});

test("describeは候補ごとに一度だけ呼ばれ、解決は検証済みsnapshotだけを使う", () => {
  let describeCallCount = 0;
  const counting: ProjectRuntimePlatformAdapter = Object.freeze({
    describe: () => {
      describeCallCount += 1;
      return Object.freeze({
        contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
        contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
        platformFamily: "windows",
        supportedBoundaries: resolvableBoundaries,
        satisfiedGuarantees: Object.freeze(
          Object.fromEntries(
            resolvableBoundaries.map((boundary) => [
              boundary,
              PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES[boundary],
            ]),
          ),
        ),
        authorityGeneration: "none" as const,
        unsupportedPlatformFallback: "none" as const,
      });
    },
    operations: Object.freeze({
      principal_provider_home: canonicalOperations("principal_provider_home"),
      filesystem_repository: canonicalOperations("filesystem_repository"),
      lock_lease: canonicalOperations("lock_lease"),
      process_cancellation: canonicalOperations("process_cancellation"),
      container_host: canonicalOperations("container_host"),
      runtime_root_recovery: canonicalOperations("runtime_root_recovery"),
    }),
  });
  const resolution = resolveProjectRuntimePlatformAdapter(
    "windows",
    [counting],
    [...resolvableBoundaries],
  );
  assert.equal(resolution.status, "resolved");
  assert.equal(describeCallCount, 1);
});

test("解決結果は登録済みAdapterのexact一致だけを返す", () => {
  const windows = syntheticAdapter("windows", resolvableBoundaries);
  const linux = syntheticAdapter("linux", resolvableBoundaries);
  const resolution = resolveProjectRuntimePlatformAdapter(
    "windows",
    [linux, windows],
    [...resolvableBoundaries],
  );
  assert.equal(resolution.status, "resolved");
  if (resolution.status === "resolved") {
    assert.notEqual(resolution.adapter, windows);
    assert.deepEqual(resolution.adapter.describe().supportedBoundaries, [
      "principal_provider_home",
      "filesystem_repository",
      "lock_lease",
      "process_cancellation",
      "container_host",
      "runtime_root_recovery",
    ]);
    assert.ok(Object.isFrozen(resolution.adapter));
    assert.ok(Object.isFrozen(resolution.adapter.operations));
  }
});

test("解決後は検証済みoperation参照を固定し元Adapterの差替えを受けない", () => {
  const original = () => Object.freeze({ status: "original" });
  const replacement = () => Object.freeze({ status: "replacement" });
  const group: { resolveRepositoryRoot: () => Readonly<{ status: string }> } = {
    resolveRepositoryRoot: original,
  };
  const operations = { filesystem_repository: group };
  const mutable = {
    describe: () => ({
      contract: PROJECT_RUNTIME_PLATFORM_CONTRACT,
      contractRevision: PROJECT_RUNTIME_PLATFORM_CONTRACT_REVISION,
      platformFamily: "windows",
      supportedBoundaries: ["filesystem_repository"],
      satisfiedGuarantees: {
        filesystem_repository:
          PROJECT_RUNTIME_PLATFORM_BOUNDARY_GUARANTEES.filesystem_repository,
      },
      authorityGeneration: "none" as const,
      unsupportedPlatformFallback: "none" as const,
    }),
    operations,
  } as unknown as ProjectRuntimePlatformAdapter;
  const resolution = resolveProjectRuntimePlatformAdapter(
    "windows",
    [mutable],
    ["filesystem_repository"],
  );
  assert.equal(resolution.status, "resolved");
  group.resolveRepositoryRoot = replacement;
  if (resolution.status === "resolved") {
    const resolvedGroup = resolution.adapter.operations
      .filesystem_repository as Readonly<Record<string, () => unknown>>;
    assert.deepEqual(resolvedGroup.resolveRepositoryRoot?.(), {
      status: "original",
    });
  }
});
