/**
 * coordinator-operation-creation-internalに属する責務をまとめる。
 *
 * @responsibility CreationFailureを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import os from "node:os";
import {
  classifyOwnedOperationDirectoryCreationFailure,
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  getOwnedHostRecoveryId,
  verifyOwnedOperationManagementCapability,
} from "../host-execution/operation-workspace-lifecycle.ts";
import { initializeHostRecoveryNamespaceWindows } from "../host-execution/recovery-namespace-windows-adapter.ts";

/**
 * coordinator-operation-creation-internalで使用するCreation 失敗の値契約を定義する。
 *
 * @responsibility Creation 失敗のProperty、Identity、状態制約を型境界として所有する。
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
 * coordinator-operation-creation-internalを失敗として終了させる。
 *
 * @responsibility coordinator-operation-creation-internalの失敗条件、診断情報、終了結果境界を所有する。
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
 * 所有 Coordinator Operation Creation 失敗を分類する。
 *
 * @responsibility 所有 Coordinator Operation Creation 失敗の分類条件、相互排他的な結果、判断不能境界を所有する。
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
 * coordinator-operation-creation-internalで使用するDependenciesの値契約を定義する。
 *
 * @responsibility DependenciesのProperty、Identity、状態制約を型境界として所有する。
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
 * Transactionalを構築する。
 *
 * @responsibility Transactionalの構築入力、生成結果、不正入力の拒否境界を所有する。
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

/**
 * 通常の作成OwnerでWindows共有管理境界を先に保護検証する。
 *
 * @responsibility Root・marker生成前に署名Native初期化を確認し、未確認の共有Effectを保持する。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input N/A: 通常producerと同じOS一時親だけを採用する。
 * @returns 既存の所有Operation Directory。
 * @precondition Task／doctor／Workbenchの通常作成Ownerから呼ぶ。
 * @postcondition Windowsは保護初期化確認後だけRoot／markerを生成する。
 * @effect Windowsの署名Native観測・固定共有child作成と、既存のOperation作成。
 * @failure 署名・親・初期化不明は清掃未確認・IDなし。下位のrollback分類は維持する。
 * @invariant 共有DirectoryのACL修復・rollback・別親fallbackを行わない。
 * @boundary 通常作成Owner→署名Native→既存Node作成primitive。
 * @security 明示試験親や未署名試験依存を本番入力として受け付けない。
 * @concurrency 同期作成前検査。初期化とRoot生成の間に連続Native handle保持を主張しない。
 */
function createProtectedRuntimeOwnedOperationDirectories() {
  if (process.platform !== "win32") return createOwnedOperationDirectories();
  let parent: string;
  try {
    parent = fs.realpathSync(os.tmpdir());
    const metadata = fs.lstatSync(parent);
    if (!metadata.isDirectory() || metadata.isSymbolicLink())
      throw new Error("temporary_parent_must_be_real_directory");
  } catch (cause) {
    fail(cause, true, null);
  }
  const initialization = initializeHostRecoveryNamespaceWindows(parent);
  if (initialization.status !== "initialized") {
    fail(
      new Error("host_recovery_namespace_initialization_failed", {
        cause: initialization,
      }),
      false,
      null,
    );
  }
  return createOwnedOperationDirectories(parent);
}

const productionDependencies: Dependencies = Object.freeze({
  createDirectories: createProtectedRuntimeOwnedOperationDirectories,
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
 * Runtime 所有 Coordinator Operationを構築する。
 *
 * @responsibility Runtime 所有 Coordinator Operationの構築入力、生成結果、不正入力の拒否境界を所有する。
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
 * Isolated Coordinator Operation Creation 候補を構築する。
 *
 * @responsibility Isolated Coordinator Operation Creation 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
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
