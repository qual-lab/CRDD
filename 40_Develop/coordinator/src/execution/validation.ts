/**
 * execution/validation.tsの値契約と判定を所有する。
 * @responsibility 移管元と同じ状態値・相関を扱い、保存・実行Effectを発行しない。
 * @trace ARCH-000004、ARCH-000008
 */
import {
  type CoordinatorStateSnapshot,
  type CoordinatorStateTaskOperation,
  isDockerRestartCheckpointSettled,
  coordinatorOperationNonce,
  coordinatorTaskResourcesAreSettled,
} from "../../../domain-model/src/index.ts";
import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";

import { validateDockerRuntimeRepairCheckpointTransition } from "../../../docker-isolation/src/index.ts";
import { validateDockerRuntimeRepairSessionCheckpoint } from "../../../docker-isolation/src/index.ts";
import { validateDockerRestartCheckpointTransition } from "./result.ts";

/**
 * 解放済みで五資源が既知終端の操作だけをHost不存在観測へ接続する。
 * @responsibility Host清掃欄が未要求でも観測可能な限定条件を判定する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderが相関を確認したTask操作。
 * @returns 現在Host／markerの観測へ進める場合だけtrue。
 * @precondition 元token／Root結合、fresh排他と実不存在は別途確認する。
 * @postcondition trueをHost清掃・Task成功・履歴確定へ昇格しない。
 * @effect N/A: メモリ内の値判定だけ。
 * @failure 未解放・Owner有効／不明・未終端・遷移／再起動未解決はfalse。
 * @invariant 過去unknownを成功へ変換せずWorkspaceを再利用しない。
 * @boundary 保存済み終端条件と実Host観測。
 * @security 保存値だけでは処置Authorityを作らない。
 * @concurrency N/A: 実体・排他の前後照合は回収Ownerが担当する。
 */
export function coordinatorReleasedTaskCanObserveHostAbsence(
  operation: CoordinatorStateTaskOperation,
): boolean {
  return (
    operation.lease === "released" &&
    operation.execution.ownerEffect === "disabled" &&
    operation.execution.workspaceReusable === false &&
    operation.host.pendingTransitionJson === null &&
    (operation.dockerRestart === null ||
      isDockerRestartCheckpointSettled(operation.dockerRestart)) &&
    operation.resources.length === 5 &&
    operation.resources.every(
      (resource) =>
        resource.request === "identified" && resource.observation === "absent",
    ) &&
    coordinatorTaskResourcesAreSettled(operation)
  );
}

/**
 * 復号済みOperationのLifecycleと未解決義務の保全を判定する。
 * @responsibility Effect履歴、正常継続、修復専用辺と配送参照を同じ規則で検査する。
 * @trace ARCH-000008
 * @input current: 検査済み元値、next: 検査済み次値、repairSessionId: 既存専用用途。
 * @returns 既存の全遷移条件が成立した場合だけtrue。
 * @precondition byte復号・元改訂・Hash比較は保存Ownerが同じ順序で確認する。
 * @postcondition unknownと一次結果を補完せず、実資源の観測を発行しない。
 * @effect N/A: 同期値判定だけ。
 * @failure 不正遷移・相関又は解釈不能はfalse。
 * @invariant 正常継続とOwner喪失後の回復Authorityを混同しない。
 * @boundary Operationの意味と統合保存の構造・CAS。
 * @security この判定だけで実行・削除Authorityを生成しない。
 * @concurrency Writerのfresh元版検査を外へ移動しない。
 */
export function validateCoordinatorOperationTransitions(
  current: Readonly<{ snapshot: CoordinatorStateSnapshot }> | null,
  next: Readonly<{ snapshot: CoordinatorStateSnapshot }>,
  repairSessionId: string | null,
): boolean {
  try {
    const priorOperations = new Map(
      (current?.snapshot.operations ?? []).map((operation) => [
        coordinatorOperationNonce(operation),
        operation,
      ]),
    );
    const phases = ["executing", "settling", "awaiting_delivery"];
    for (const operation of next.snapshot.operations) {
      const nonce = coordinatorOperationNonce(operation);
      const prior = priorOperations.get(nonce);
      if (operation.kind === "runtime_repair") {
        if (prior === undefined) {
          if (
            operation.phase !== "repairing" ||
            operation.checkpoint !== null ||
            operation.disposition !== "not_applicable" ||
            operation.disposal !== null ||
            operation.primaryFailure !== null ||
            operation.outcome !== null ||
            operation.summarySha256 !== null ||
            operation.history !== null
          )
            return false;
        } else {
          if (
            prior.kind !== "runtime_repair" ||
            operation.identityJson !== prior.identityJson ||
            operation.identitySha256 !== prior.identitySha256 ||
            operation.recoveryId !== prior.recoveryId
          )
            return false;
          // 回収進捗は専用の完全再導出だけ。通常保存で判断・技術値を更新しない。
          if (
            encodeRuntimeStateValue(operation.retention ?? null) !==
              encodeRuntimeStateValue(prior.retention ?? null) ||
            encodeRuntimeStateValue(operation.disposal) !==
              encodeRuntimeStateValue(prior.disposal) ||
            (prior.disposal !== null &&
              encodeRuntimeStateValue({
                ...operation,
                summarySha256: null,
                history: null,
              }) !==
                encodeRuntimeStateValue({
                  ...prior,
                  summarySha256: null,
                  history: null,
                }))
          )
            return false;
          if (
            prior.disposition === "pending_human_decision" &&
            operation.disposition !== prior.disposition
          )
            return false;
          if (
            operation.phase !== prior.phase &&
            !(
              (prior.phase === "repairing" &&
                ["settling", "awaiting_disposition"].includes(
                  operation.phase,
                )) ||
              (prior.phase === "settling" &&
                operation.phase === "awaiting_delivery")
            )
          )
            return false;
          if (
            prior.checkpoint !== null
              ? !(operation.recoveryId === repairSessionId
                  ? validateDockerRuntimeRepairSessionCheckpoint(
                      prior.checkpoint,
                      operation.checkpoint,
                    )
                  : validateDockerRuntimeRepairCheckpointTransition(
                      prior.checkpoint,
                      operation.checkpoint,
                    ))
              : operation.checkpoint !== null &&
                (Object.values(operation.checkpoint.actions).some(
                  (action) =>
                    action.intent !== "not_saved" ||
                    action.request !== "not_issued" ||
                    action.result !== "unobserved",
                ) ||
                  Object.values(operation.checkpoint.directories).some(
                    (pair) =>
                      pair.expected !== null ||
                      pair.source.state !== "unobserved" ||
                      pair.retained.state !== "unobserved",
                  ))
          )
            return false;
          if (
            prior.primaryFailure !== null &&
            encodeRuntimeStateValue(prior.primaryFailure) !==
              encodeRuntimeStateValue(operation.primaryFailure)
          )
            return false;
          if (
            prior.outcome !== null &&
            (operation.outcome === null ||
              encodeRuntimeStateValue(operation.primaryFailure) !==
                encodeRuntimeStateValue(prior.primaryFailure) ||
              encodeRuntimeStateValue(operation.checkpoint?.actions ?? null) !==
                encodeRuntimeStateValue(prior.checkpoint?.actions ?? null) ||
              operation.outcome.status !== prior.outcome.status ||
              operation.outcome.reason !== prior.outcome.reason ||
              (prior.outcome.cleanupConfirmed &&
                !operation.outcome.cleanupConfirmed))
          )
            return false;
          if (
            operation.disposition === "retained_by_human_decision" &&
            prior.disposition === "not_applicable"
          )
            return false;
          if (
            prior.disposition === "retained_by_human_decision" &&
            operation.disposition !== prior.disposition
          )
            return false;
          if (
            prior.summarySha256 !== null &&
            operation.summarySha256 !== prior.summarySha256
          )
            return false;
          if (prior.history === null) {
            if (operation.history?.confirmed) return false;
          } else if (
            operation.history === null ||
            operation.history.occurredAt !== prior.history.occurredAt ||
            operation.history.lineSha256 !== prior.history.lineSha256 ||
            (prior.history.confirmed && !operation.history.confirmed)
          )
            return false;
          if (
            (prior.history !== null || operation.history !== null) &&
            encodeRuntimeStateValue({
              ...prior,
              summarySha256: null,
              history: null,
            }) !==
              encodeRuntimeStateValue({
                ...operation,
                summarySha256: null,
                history: null,
              })
          )
            return false;
        }
        priorOperations.delete(nonce);
        continue;
      }
      if (!prior) {
        const identity = JSON.parse(operation.identityJson);
        // 新操作だけを制約する。旧競合Snapshotの読取り・回収を不能にしない。
        if (
          next.snapshot.operations.some((other) => {
            if (other.recoveryId === operation.recoveryId) return false;
            if (other.kind === "runtime_repair")
              return other.phase !== "awaiting_delivery";
            if (
              JSON.parse(other.identityJson).stableLogicalHomeBindingHash !==
              identity.stableLogicalHomeBindingHash
            )
              return false;
            const before = current?.snapshot.operations.find(
              (item): item is CoordinatorStateTaskOperation =>
                item.kind === "docker_task" &&
                item.recoveryId === other.recoveryId,
            );
            if (!before) return true;
            const previousIdentity = JSON.parse(before.identityJson);
            // 同一Hostの正常技術終端は、物理Host清掃を二重に要求しない。
            // marker実体は状態遷移ごとに置換されるため、その同一性は比較しない。
            const sameHostContinuation =
              previousIdentity.operationId === identity.operationId &&
              previousIdentity.recoveryCorrelationId ===
                identity.recoveryCorrelationId &&
              previousIdentity.hostPaths.root === identity.hostPaths.root &&
              previousIdentity.hostPaths.marker === identity.hostPaths.marker &&
              previousIdentity.initialHostRecoveryId ===
                identity.initialHostRecoveryId &&
              previousIdentity.initialHostRecovery.directoryIdentity ===
                identity.initialHostRecovery.directoryIdentity &&
              encodeRuntimeStateValue(before) ===
                encodeRuntimeStateValue(other);
            // 同じ更新内の終端偽装や、二つの新規開始を受理しない。
            return (
              [before, other].some((value) => {
                const hostCleanupComplete =
                  value.phase !== "executing" &&
                  value.outcome?.cleanupConfirmed === true &&
                  value.host.cleanup === "confirmed";
                const hostCleanupDeferred =
                  sameHostContinuation &&
                  value.phase === "executing" &&
                  value.outcome === null &&
                  value.primaryFailure === null &&
                  value.summarySha256 === null &&
                  value.history === null &&
                  value.dockerRestart === null &&
                  value.execution.workspaceReusable === false &&
                  value.host.cleanup === "not_requested" &&
                  value.host.currentToken === identity.initialHostRecoveryId;
                return (
                  !(hostCleanupComplete || hostCleanupDeferred) ||
                  value.host.pendingTransitionJson !== null ||
                  value.lease !== "released" ||
                  value.execution.ownerEffect !== "disabled" ||
                  // 過去Effectの不確実性は、同Hostの正常技術終端を取り消さない。
                  // 新stageのAuthorityは開始保存前の既存実行入口が確認する。
                  (!hostCleanupDeferred &&
                    (value.execution.providerStart === "unknown" ||
                      value.execution.externalSend === "unknown" ||
                      value.execution.sharedWrite === "unknown")) ||
                  !coordinatorTaskResourcesAreSettled(value)
                );
              }) ||
              [current?.snapshot, next.snapshot].some((snapshot) =>
                snapshot?.unresolvedRecoveries.some(
                  (recovery) =>
                    recovery.recoveryId === other.recoveryId &&
                    recovery.obligations.some(
                      (obligation) => obligation !== "result_delivery",
                    ),
                ),
              )
            );
          })
        )
          return false;
        if (
          operation.phase !== "executing" ||
          operation.resources.some(
            (resource) =>
              resource.request !== "not_requested" ||
              resource.observation !== "unobserved",
          ) ||
          operation.host.currentToken !== identity.initialHostRecoveryId ||
          operation.host.pendingTransitionJson !== null ||
          operation.host.cleanup !== "not_requested" ||
          operation.lease !== "held" ||
          operation.execution.providerStart !== "not_started" ||
          operation.execution.externalSend !== "not_issued" ||
          operation.execution.sharedWrite !== "not_issued" ||
          operation.execution.ownerEffect !== "active" ||
          operation.primaryFailure !== null ||
          operation.outcome !== null ||
          operation.summarySha256 !== null ||
          operation.history !== null ||
          operation.dockerRestart !== null
        )
          return false;
        continue;
      }
      priorOperations.delete(nonce);
      if (prior.kind !== "docker_task") return false;
      if (
        !validateDockerRestartCheckpointTransition(
          prior.dockerRestart,
          operation.dockerRestart,
        )
      )
        return false;
      if (
        operation.identityJson !== prior.identityJson ||
        operation.identitySha256 !== prior.identitySha256 ||
        operation.recoveryId !== prior.recoveryId ||
        phases.indexOf(operation.phase) < phases.indexOf(prior.phase)
      )
        return false;
      if (
        prior.dockerRestart === null &&
        operation.dockerRestart !== null &&
        encodeRuntimeStateValue(operation.resources) !==
          encodeRuntimeStateValue(prior.resources)
      )
        return false;
      for (const [index, resource] of operation.resources.entries()) {
        const before = prior.resources[index];
        if (!before) return false;
        if (
          prior.dockerRestart !== null &&
          before.request !== resource.request &&
          ["intent_saved", "issued", "unknown"].includes(resource.request)
        )
          return false;
        if (
          before.request !== resource.request &&
          ![
            "not_requested:intent_saved",
            "intent_saved:issued",
            "intent_saved:identified",
            "intent_saved:not_issued",
            "intent_saved:unknown",
            "issued:unknown",
            "unknown:issued",
            "unknown:identified",
            "issued:identified",
          ].includes(`${before.request}:${resource.request}`)
        )
          return false;
        if (
          before.request === "intent_saved" &&
          resource.request === "identified" &&
          (before.observation !== "unobserved" ||
            before.absence !== null ||
            resource.receiptSource !== "docker_create_result" ||
            resource.observation !== "unobserved" ||
            resource.absence !== null)
        )
          return false;
        if (
          before.request === "identified" &&
          (resource.dockerId !== before.dockerId ||
            resource.receiptSource !== before.receiptSource)
        )
          return false;
      }
      if (
        prior.primaryFailure !== null &&
        encodeRuntimeStateValue(operation.primaryFailure) !==
          encodeRuntimeStateValue(prior.primaryFailure)
      )
        return false;
      if (
        prior.summarySha256 !== null &&
        operation.summarySha256 !== prior.summarySha256
      )
        return false;
      if (prior.history === null) {
        if (operation.history?.confirmed) return false;
      } else if (
        operation.history === null ||
        operation.history.occurredAt !== prior.history.occurredAt ||
        operation.history.lineSha256 !== prior.history.lineSha256 ||
        (prior.history.confirmed && !operation.history.confirmed)
      )
        return false;
      if (
        prior.outcome !== null &&
        (operation.outcome === null ||
          operation.outcome.status !== prior.outcome.status ||
          operation.outcome.reason !== prior.outcome.reason ||
          (prior.outcome.cleanupConfirmed &&
            !operation.outcome.cleanupConfirmed))
      )
        return false;
      for (const [field, known] of [
        ["providerStart", "started"],
        ["externalSend", "issued"],
        ["sharedWrite", "possible"],
        ["ownerEffect", "disabled"],
      ] as const) {
        if (
          prior.execution[field] === known &&
          operation.execution[field] !== known
        )
          return false;
        if (
          prior.execution[field] === "unknown" &&
          operation.execution[field] !== "unknown" &&
          operation.execution[field] !== known
        )
          return false;
      }
      if (prior.lease === "released" && operation.lease !== "released")
        return false;
      if (
        prior.host.cleanup === "confirmed" &&
        operation.host.cleanup !== "confirmed"
      )
        return false;
      const pending =
        prior.host.pendingTransitionJson === null
          ? null
          : JSON.parse(prior.host.pendingTransitionJson);
      if (
        operation.host.currentToken !== prior.host.currentToken &&
        (!pending ||
          pending.currentToken !== prior.host.currentToken ||
          operation.host.currentToken !== pending.expectedToken)
      )
        return false;
      if (
        operation.host.pendingTransitionJson !==
        prior.host.pendingTransitionJson
      ) {
        if (pending && operation.host.currentToken !== pending.expectedToken)
          return false;
        if (
          operation.host.pendingTransitionJson !== null &&
          JSON.parse(operation.host.pendingTransitionJson).currentToken !==
            operation.host.currentToken
        )
          return false;
      }
    }
    if (priorOperations.size !== 0) return false;
    for (const before of current?.snapshot.unresolvedRecoveries ?? []) {
      const after = next.snapshot.unresolvedRecoveries.find(
        (item) => item.operationNonce === before.operationNonce,
      );
      if (
        !after ||
        after.recoveryId !== before.recoveryId ||
        before.obligations.some(
          (obligation) => !after.obligations.includes(obligation),
        )
      )
        return false;
    }
    for (const before of current?.snapshot.pendingDeliveries ?? []) {
      const after = next.snapshot.pendingDeliveries.find(
        (item) =>
          item.operationNonce === before.operationNonce &&
          item.consumer === before.consumer,
      );
      if (
        !after ||
        after.recoveryId !== before.recoveryId ||
        after.resultId !== before.resultId
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
