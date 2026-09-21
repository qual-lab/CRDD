import {
  classifyOwnedOperationDirectoryCreationFailure,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  verifyOwnedOperationManagementCapability,
} from "./execution-environment.ts";

/**
 * CreationFailureが扱う値の構造を表す。
 *
 * @responsibility CreationFailureに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape CreationFailureが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CreationFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: CreationFailureの宣言は外部境界を開かない。
 * @security CreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CreationFailureの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CreationFailure = Readonly<{
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  hostRecoveryId: string | null;
}>;
const failures = new WeakMap<object, CreationFailure>();

/**
 * failの処理を実行する。
 *
 * @responsibility failに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input cause: unknown、cleanupConfirmed: boolean、hostRecoveryId: string | null
 * @returns neverを返す。
 * @precondition 「cause: unknown、cleanupConfirmed: boolean、hostRecoveryId: string | null」がfailの入力契約を満たす。
 * @postcondition failの責務を完了した結果だけを返す。
 * @effect N/A: failは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure failは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant failは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: failはProcess内の同一Subsystemで完結する。
 * @security failはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failは共有非同期状態を持たない同期処理である。
 */
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

/**
 * classifyOwnedCoordinatorOperationCreationFailureの処理を実行する。
 *
 * @responsibility classifyOwnedCoordinatorOperationCreationFailureに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns classifyOwnedCoordinatorOperationCreationFailureの計算結果を返す。
 * @precondition 「error: unknown」がclassifyOwnedCoordinatorOperationCreationFailureの入力契約を満たす。
 * @postcondition classifyOwnedCoordinatorOperationCreationFailureの責務を完了した結果だけを返す。
 * @effect N/A: classifyOwnedCoordinatorOperationCreationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyOwnedCoordinatorOperationCreationFailureは独自の失敗分岐を所有しない。
 * @invariant classifyOwnedCoordinatorOperationCreationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyOwnedCoordinatorOperationCreationFailureはProcess内の同一Subsystemで完結する。
 * @security classifyOwnedCoordinatorOperationCreationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyOwnedCoordinatorOperationCreationFailureは共有非同期状態を持たない同期処理である。
 */
export function classifyOwnedCoordinatorOperationCreationFailure(
  error: unknown,
) {
  if (!error || typeof error !== "object") return null;
  return (
    failures.get(error) ??
    classifyOwnedOperationDirectoryCreationFailure(error) ??
    null
  );
}

/**
 * Dependenciesが扱う値の構造を表す。
 *
 * @responsibility Dependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Dependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Dependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: Dependenciesの宣言は外部境界を開かない。
 * @security DependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Dependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * createTransactionalの処理を実行する。
 *
 * @responsibility createTransactionalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createTransactionalの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateTransactionalの入力契約を満たす。
 * @postcondition createTransactionalの責務を完了した結果だけを返す。
 * @effect N/A: createTransactionalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createTransactionalは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTransactionalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createTransactionalはProcess内の同一Subsystemで完結する。
 * @security createTransactionalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createTransactionalは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createRuntimeOwnedCoordinatorOperationの処理を実行する。
 *
 * @responsibility createRuntimeOwnedCoordinatorOperationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns createRuntimeOwnedCoordinatorOperationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateRuntimeOwnedCoordinatorOperationの入力契約を満たす。
 * @postcondition createRuntimeOwnedCoordinatorOperationの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeOwnedCoordinatorOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRuntimeOwnedCoordinatorOperationは独自の失敗分岐を所有しない。
 * @invariant createRuntimeOwnedCoordinatorOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeOwnedCoordinatorOperationはProcess内の同一Subsystemで完結する。
 * @security createRuntimeOwnedCoordinatorOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createRuntimeOwnedCoordinatorOperationは共有非同期状態を持たない同期処理である。
 */
export function createRuntimeOwnedCoordinatorOperation() {
  return createTransactional(productionDependencies);
}

/**
 * createIsolatedCoordinatorOperationCreationCandidateの処理を実行する。
 *
 * @responsibility createIsolatedCoordinatorOperationCreationCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createIsolatedCoordinatorOperationCreationCandidateの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateIsolatedCoordinatorOperationCreationCandidateの入力契約を満たす。
 * @postcondition createIsolatedCoordinatorOperationCreationCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCoordinatorOperationCreationCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedCoordinatorOperationCreationCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedCoordinatorOperationCreationCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedCoordinatorOperationCreationCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedCoordinatorOperationCreationCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCoordinatorOperationCreationCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCoordinatorOperationCreationCandidate(
  dependencies: Dependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    create: () => createTransactional(Object.freeze(dependencies)),
  });
}
