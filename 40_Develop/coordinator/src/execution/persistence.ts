/**
 * 元の実行OwnerをDomainの用途固定保存入力へ接続する。
 * @responsibility 操作相関とfresh借用、未発行通知の既存照合を搬送し保存状態を所有しない。
 * @trace ARCH-000004、ARCH-000008
 */

import { readCoordinatorConfig } from "../../../configuration-model/src/index.ts";
import * as runtimeStore from "../../../execution-model/src/index.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import { getRepositoryFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  borrowRuntimeOwnedCoordinatorSettlementRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
  captureOwnedOperationCleanupVerification,
} from "./operation.ts";

/** 履歴を扱う呼出しだけ、確定日数と既存の同期現在性検査を結合する。 */
export function historyRepositoryInput<T>(root: T) {
  const initial = readCoordinatorConfig(root as Repository);
  return Object.freeze({
    root,
    historyRetentionDays:
      initial.status === "ready" ? initial.config.historyRetentionDays : null,
    revalidate(expectedHistoryRetentionDays?: number) {
      if (expectedHistoryRetentionDays === undefined) return true;
      const fresh = readCoordinatorConfig(root as Repository);
      return (
        fresh.status === "ready" &&
        fresh.config.historyRetentionDays === expectedHistoryRetentionDays
      );
    },
  });
}

/** 既存の実行・終端借用の再検証を、履歴確認時だけ設定現在性へ接続する。 */
export function withHistoryRetention<
  T extends Readonly<{ revalidate: () => boolean }>,
>(context: T | null, root?: unknown) {
  if (!context) return null;
  const history = historyRepositoryInput(
    root ?? (context as { root?: unknown }).root,
  );
  return Object.freeze({
    ...context,
    historyRetentionDays: history.historyRetentionDays,
    revalidate(expectedHistoryRetentionDays?: number) {
      return (
        context.revalidate() && history.revalidate(expectedHistoryRetentionDays)
      );
    },
  });
}

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
  const verified = getRepositoryFromWorkingDirectory(workingDirectory);
  if (verified.status !== "completed")
    throw new Error("orchestrator_repository_root_invalid");
  return verified.capability;
}

/**
 * saveOperationStartへ元操作の観測を接続する。
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
export function saveOperationStart(
  managementCapability: unknown,
  identityJson: unknown,
  observeTerminal: (
    result: unknown,
    operationId: unknown,
    recoveryId: unknown,
  ) => unknown,
) {
  return runtimeStore.saveOperationStart(
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
      observeSettlementRepository: () => {
        const observed =
          borrowRuntimeOwnedCoordinatorSettlementRepository(
            managementCapability,
          );
        return observed
          ? withHistoryRetention({
              purpose: observed.purpose,
              root: observed.root,
              operationId: observed.operationId,
              revalidate: observed.revalidate,
            })
          : null;
      },
      captureCleanupVerification: () =>
        captureOwnedOperationCleanupVerification(managementCapability),
      observeTerminal,
    },
    identityJson,
  );
}

/**
 * readOperationStateStageへ元操作の観測を接続する。
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
export function readOperationStateStage(
  managementCapability: unknown,
  request?:
    | Readonly<{ kind: "host_cleanup"; recoveryId: unknown }>
    | Readonly<{ kind: "operation_start"; identityJson: unknown }>,
) {
  return runtimeStore.readState(
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
    },
    { scope: "operation", input: request },
  );
}

/**
 * saveResourceNotIssuedStageへ元操作の観測を接続する。
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
export function saveResourceNotIssuedStage(
  managementCapability: unknown,
  ...args: [recoveryId: unknown, purpose: unknown]
) {
  return runtimeStore.saveRecoveryCheckpoint(
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
    },
    args[0],
    null,
    { kind: "resource_not_issued", purpose: args[1] },
  );
}

/**
 * saveHostCleanupPreparationへ元操作の観測を接続する。
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
export function saveHostCleanupPreparation(
  managementCapability: unknown,
  ...args: [recoveryId: string, beforeBytes: unknown]
) {
  return runtimeStore.saveRecoveryCheckpoint(
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
    },
    args[0],
    args[1],
    { kind: "host_cleanup_preparation" },
  );
} /**
 * saveOperationCheckpointへ元操作の観測を接続する。
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
export function saveOperationCheckpoint(
  managementCapability: unknown,
  ...args: Parameters<typeof runtimeStore.saveOperationCheckpoint> extends [
    unknown,
    ...infer Args,
  ]
    ? Args
    : never
) {
  return runtimeStore.saveOperationCheckpoint(
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
    },
    ...args,
  );
}
