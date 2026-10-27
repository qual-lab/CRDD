/**
 * 実行Ownerの終端観測をDomainへ搬送する。
 * @responsibility 保存状態を所有せず既存のHost・Controller照合を接続する。
 * @trace ARCH-000008
 */
import * as runtimeSettlement from "../../../domain-model/src/index.ts";
import {
  borrowRuntimeOwnedDockerTerminalObservations,
  verifyRuntimeOwnedDockerUnissuedNotice,
} from "./observation.ts";
import {
  borrowRuntimeOwnedCoordinatorSettlementRepository,
  borrowRuntimeOwnedCoordinatorStateRepository,
  captureOwnedOperationCleanupVerification,
} from "./operation.ts";

/**
 * 元の実行Ownerと終端観測をDomainの正常終端保存へ接続する。
 * @responsibility Host清掃・Controller観測の照合だけを保持し保存状態を所有しない。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId、consumer: 元操作とexact終了用途。
 * @returns Domainの終了保存相関、又はnull。
 * @precondition 元の操作Ownerと送信許可はCoordinatorが管理する。
 * @postcondition Domainの相関を新しい実行・清掃Authorityへ昇格しない。
 * @effect 既存の終端保存準備だけ。
 * @failure 元Owner失効・相関差・観測不能を拒否する。
 * @invariant 操作keyは元Capabilityそのもの。
 * @boundary 元の実行観測とDomain保存。
 * @security 生Snapshot Writerを公開しない。
 * @concurrency 各観測は保存側の元の照合位置で呼ぶ。
 */
export function prepareRuntimeOwnedCoordinatorSettlement(
  managementCapability: unknown,
  recoveryId: unknown,
  consumer: unknown,
) {
  return runtimeSettlement.prepareRuntimeOwnedCoordinatorSettlement(
    {
      identity: managementCapability,
      observeRepository: () =>
        borrowRuntimeOwnedCoordinatorStateRepository(managementCapability),
      observeSettlementRepository: () =>
        borrowRuntimeOwnedCoordinatorSettlementRepository(managementCapability),
      captureCleanupVerification: () =>
        captureOwnedOperationCleanupVerification(managementCapability),
      observeTerminal: (
        result: unknown,
        operationId: unknown,
        reference: unknown,
      ) =>
        borrowRuntimeOwnedDockerTerminalObservations(
          result,
          managementCapability,
          operationId,
          reference,
        ),
      verifyNotIssued: (
        notice: unknown,
        recovery: unknown,
        purpose: unknown,
        operationId: unknown,
        reference: unknown,
      ) =>
        verifyRuntimeOwnedDockerUnissuedNotice(
          notice,
          recovery,
          managementCapability,
          purpose,
          operationId,
          reference,
        ),
    },
    recoveryId,
    consumer,
  );
}
