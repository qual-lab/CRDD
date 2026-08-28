import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";

type CreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;
const failures = new WeakMap<object, CreationFailure>();

function fail(
  cause: unknown,
  cleanupConfirmed: boolean,
  hostRecoveryId: string | null,
): never {
  const error = new Error("coordinator_operation_creation_failed", { cause });
  failures.set(
    error,
    Object.freeze({
      cleanupConfirmed,
      manualRecoveryRequired: !cleanupConfirmed,
      hostRecoveryId,
    }),
  );
  throw error;
}

export function classifyOwnedCoordinatorOperationCreationFailure(
  error: unknown,
) {
  return error && typeof error === "object"
    ? (failures.get(error) ?? null)
    : null;
}

type Dependencies = Readonly<{
  createDirectories: typeof createOwnedOperationDirectories;
  getHostRecoveryId: typeof getOwnedHostRecoveryId;
  initializeCapabilities: (
    owned: ReturnType<typeof createOwnedOperationDirectories>,
  ) => Readonly<{
    mountCapability: object;
    managementCapability: object;
    operationId: string;
  }>;
  cleanupDirectories: typeof cleanupOwnedOperationDirectories;
}>;

function createTransactional(dependencies: Dependencies) {
  const owned = dependencies.createDirectories();
  let hostRecoveryId: string | null = null;
  try {
    hostRecoveryId = dependencies.getHostRecoveryId(owned);
    return Object.freeze({
      owned,
      ...dependencies.initializeCapabilities(owned),
      hostRecoveryId,
    });
  } catch (cause) {
    try {
      dependencies.cleanupDirectories(owned);
    } catch {
      fail(cause, false, hostRecoveryId);
    }
    fail(cause, true, null);
  }
}

const productionDependencies: Dependencies = Object.freeze({
  createDirectories: createOwnedOperationDirectories,
  getHostRecoveryId: getOwnedHostRecoveryId,
  initializeCapabilities: (owned) => {
    const contextCapability = createOwnedOperationContextCapability(owned);
    const mountCapability = createOwnedMountCapability(owned);
    const managementCapability = createOwnedOperationManagementCapability(
      contextCapability,
      mountCapability,
    );
    const operation =
      verifyOwnedOperationManagementCapability(managementCapability);
    return Object.freeze({
      mountCapability,
      managementCapability,
      operationId: operation.operationId,
    });
  },
  cleanupDirectories: cleanupOwnedOperationDirectories,
});

export function createRuntimeOwnedCoordinatorOperation() {
  return createTransactional(productionDependencies);
}

export function createIsolatedCoordinatorOperationCreationCandidate(
  dependencies: Dependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    create: () => createTransactional(Object.freeze(dependencies)),
  });
}
