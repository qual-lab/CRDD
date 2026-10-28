/**
 * 元の実行OwnerをDomainの用途固定保存入力へ接続する。
 * @responsibility 操作相関とfresh借用、未発行通知の既存照合を搬送し保存状態を所有しない。
 * @trace ARCH-000004、ARCH-000008
 */
import * as runtimeStore from "../../../domain-model/src/index.ts";
import { verifyRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { verifyRuntimeOwnedDockerUnissuedNotice } from "./provider-executor.ts";
import { borrowRuntimeOwnedCoordinatorStateRepository } from "./operation.ts";

/**
 * Hostが選択したRepositoryを既存VCの真正参照へ固定する。
 * @responsibility 生PathをDomain保存APIへ渡さず、保存Portが同じ参照を保持できるようにする。
 * @trace ARCH-000004、ARCH-000008
 * @input workingDirectory: 既存Host入口が選択したRepository内の起点。
 * @returns VCが発行した同一性参照。
 * @precondition 呼出し元が内容認可・実行Authorityを別に検査する。
 * @postcondition 新しい資格・State・登録を発行しない。
 * @effect 既存VCの読取りだけ。
 * @failure 不明RootはEffect前の例外で停止する。
 * @invariant Repository参照を実行許可にしない。
 * @boundary Coordinator HostとDomain保存。
 * @security 外部JSONから参照Objectを構築しない。
 * @concurrency 保存Portは返却参照を保持し、各操作のDomain側で再観測する。
 */
export function verifyRuntimePersistenceRepository(workingDirectory: string) {
  const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  return verified.capability;
}

/**
 * saveRuntimeOwnedCoordinatorOperationStartへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function saveRuntimeOwnedCoordinatorOperationStart(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.saveRuntimeOwnedCoordinatorOperationStart
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.saveRuntimeOwnedCoordinatorOperationStart(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * readRuntimeOwnedCoordinatorStateSnapshotへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function readRuntimeOwnedCoordinatorStateSnapshot(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.readRuntimeOwnedCoordinatorStateSnapshot
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.readRuntimeOwnedCoordinatorStateSnapshot(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * readRuntimeOwnedCoordinatorResourceRequestsへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function readRuntimeOwnedCoordinatorResourceRequests(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.readRuntimeOwnedCoordinatorResourceRequests
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.readRuntimeOwnedCoordinatorResourceRequests(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * checkpointRuntimeOwnedCoordinatorResourceNotIssuedへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function checkpointRuntimeOwnedCoordinatorResourceNotIssued(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.checkpointRuntimeOwnedCoordinatorResourceNotIssued
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.checkpointRuntimeOwnedCoordinatorResourceNotIssued(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * saveRuntimeOwnedCoordinatorHostCleanupPreparationへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function saveRuntimeOwnedCoordinatorHostCleanupPreparation(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.saveRuntimeOwnedCoordinatorHostCleanupPreparation
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.saveRuntimeOwnedCoordinatorHostCleanupPreparation(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * checkpointRuntimeOwnedCoordinatorRestartへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function checkpointRuntimeOwnedCoordinatorRestart(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.checkpointRuntimeOwnedCoordinatorRestart
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.checkpointRuntimeOwnedCoordinatorRestart(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * checkpointRuntimeOwnedCoordinatorResourceへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function checkpointRuntimeOwnedCoordinatorResource(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.checkpointRuntimeOwnedCoordinatorResource
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.checkpointRuntimeOwnedCoordinatorResource(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * checkpointRuntimeOwnedCoordinatorCleanupへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function checkpointRuntimeOwnedCoordinatorCleanup(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.checkpointRuntimeOwnedCoordinatorCleanup
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.checkpointRuntimeOwnedCoordinatorCleanup(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * checkpointRuntimeOwnedCoordinatorHostへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function checkpointRuntimeOwnedCoordinatorHost(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.checkpointRuntimeOwnedCoordinatorHost
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.checkpointRuntimeOwnedCoordinatorHost(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * checkpointRuntimeOwnedCoordinatorLifecycleへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function checkpointRuntimeOwnedCoordinatorLifecycle(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.checkpointRuntimeOwnedCoordinatorLifecycle
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.checkpointRuntimeOwnedCoordinatorLifecycle(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}

/**
 * checkpointRuntimeOwnedCoordinatorReferencesへ元操作の観測を接続する。
 * @responsibility 保存Ownerを再発行せず元の操作相関をDomainへ渡す。
 * @trace ARCH-000008
 * @input managementCapability: 既存操作、args: 用途固定の保存入力。
 * @returns Domainの保存結果。
 * @precondition 元の操作Ownerが現在の実行を管理する。
 * @postcondition 保存結果から実行又は回復Authorityを生成しない。
 * @effect 既存の用途固定保存処理だけ。
 * @failure 元Owner又は保存検査の拒否を維持する。
 * @invariant Mapのkeyは元Capabilityそのもの。
 * @boundary Coordinatorの実行観測とDomain保存。
 * @security 生Writer、短期Owner、任意取引callbackを返さない。
 * @concurrency 観測はDomainが元の照合位置で呼ぶ。
 */
export function checkpointRuntimeOwnedCoordinatorReferences(
  managementCapability: unknown,
  ...args: Parameters<
    typeof runtimeStore.checkpointRuntimeOwnedCoordinatorReferences
  > extends [unknown, ...infer Args]
    ? Args
    : never
) {
  return runtimeStore.checkpointRuntimeOwnedCoordinatorReferences(
    {
      identity: managementCapability as object,
      observeRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
        return observed
          ? {
              purpose: "execution" as const,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            }
          : null;
      },
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: string,
        operationId: unknown,
        recoveryId: string,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          recoveryId,
        ),
    },
    ...args,
  );
}
