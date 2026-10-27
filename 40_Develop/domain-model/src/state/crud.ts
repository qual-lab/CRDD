/**
 * 単一Snapshotの更新候補と元版との値比較を所有する。
 * @packageDocumentation
 * @responsibility 相互参照する候補導出・改訂・Hash・技術参照を同じ純粋閉包で検査する。
 * @trace ARCH-000004、ARCH-000008
 * @boundary メモリ内の値だけ。保存・実Owner確認・実資源観測・処置許可は発行しない。
 */
import { types } from "node:util";
import { decodeCoordinatorUnifiedSnapshot as decodeCoordinatorStateSnapshot } from "./validation.ts";
import { encodeRuntimeStateValue } from "./codec.ts";
import type { CoordinatorStateTaskOperation } from "../attempt/types.ts";
import { coordinatorAuthenticationClosureEvidence } from "../attempt/validation.ts";
import { coordinatorTaskResourcesAreSettled } from "../attempt/validation.ts";
import { isSha256Hex } from "./validation.ts";
import { purposeResource } from "../attempt/validation.ts";
import type { CoordinatorStateSnapshot } from "./types.ts";
import { COORDINATOR_STATE_SCHEMA } from "./validation.ts";
import { associateCoordinatorTaskOperations } from "../task/crud.ts";
import type { CoordinatorStateRepairOperation } from "../attempt/types.ts";
import { validCoordinatorRepairOperation } from "../attempt/validation.ts";
import { coordinatorOperationNonce } from "../attempt/validation.ts";
import { exactRecordKeys } from "./validation.ts";
import { prepareDockerRuntimeRepairSessionCheckpoint } from "../attempt/repair-validation.ts";
import { validCoordinatorRepairRetentionReceipt } from "../attempt/validation.ts";
import { dockerRuntimeRepairCheckpointIsSettled } from "../attempt/repair-validation.ts";
import { coordinatorRepairRetentionMatchesCheckpoint } from "../attempt/validation.ts";
import { createDockerRuntimeRepairDisposalCheckpoint } from "../attempt/repair-validation.ts";
import { decodeDockerRuntimeRepairDisposalCheckpoint } from "../attempt/repair-validation.ts";
import { validateDockerRuntimeRepairDisposalTransition } from "../attempt/repair-validation.ts";
import { parseDockerTaskRecoveryId } from "../attempt/validation.ts";
import { coordinatorOperationSummaryBytes } from "./validation.ts";
import { coordinatorRepairCanSummarize } from "../attempt/validation.ts";
import { coordinatorRepairSummaryBytes } from "../attempt/validation.ts";
import { coordinatorRepairHistoryLineBytes } from "../attempt/validation.ts";
import { RUNTIME_STATE_MAXIMUM_BYTES } from "./codec.ts";
import { decodeCoordinatorHistoryRows } from "./history.ts";
import { prepareCoordinatorHistoryRetention } from "./history.ts";
import { prepareCoordinatorStateHistoryLine } from "./validation.ts";
import { coordinatorHistoryLineBytes } from "./validation.ts";
import { coordinatorConsumerCompletionPolicy } from "../task/validation.ts";
import { coordinatorRepairCanComplete } from "../attempt/validation.ts";
import { validateCoordinatorOperationTransitions } from "../attempt/validation.ts";
import { createHash } from "node:crypto";

/**
 * 二組四観測を同じauth unknownへだけ保存する候補を導出する。
 * @responsibility 元結果・他資源・他操作を保持し、専用Writerの固定候補を作る。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、observationsValue、repositoryBinding: 元本文と専用観測。
 * @returns 専用次版、同値本文、または不正入力のnull。
 * @precondition 呼出し側が実観測と生成源の終端を確認している。
 * @postcondition 候補だけでは保存や限定終了を許可しない。
 * @effect N/A: 同期値変換だけ。
 * @failure 欠測・一回観測・観測不明・限定条件差はnull。
 * @invariant 過去request unknown・一次失敗・元結果を保持する。
 * @boundary 専用回収Ownerと物理Writer。
 * @security 通常resource／cleanup候補からこの辺を生成しない。
 * @concurrency 元版Hashは既存previousとCASへ結合する。
 */
export function prepareCoordinatorAuthenticationUnknownClosureSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  observationsValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (
      !current ||
      typeof recoveryId !== "string" ||
      encodeRuntimeStateValue(observationsValue) !==
        encodeRuntimeStateValue([
          { round: 1, name: "absent", name_label: "absent" },
          { round: 2, name: "absent", name_label: "absent" },
        ])
    )
      return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation) return null;
    const hash = coordinatorAuthenticationClosureEvidence(operation);
    if (!hash) return null;
    if (coordinatorTaskResourcesAreSettled(operation))
      return Buffer.from(currentBytes as Buffer);
    const identity = JSON.parse(operation.identityJson);
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : {
              ...operation,
              resources: operation.resources.map((resource) =>
                resource.purpose !== "create_subscription_auth_probe"
                  ? resource
                  : {
                      ...resource,
                      observation: "absent",
                      absence: {
                        recoveryId,
                        purpose: resource.purpose,
                        plannedResourceName: identity.resources.auth,
                        dockerId: null,
                        evidenceSha256: hash,
                      },
                    },
              ),
            },
      ),
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一回確定した操作Identityを最新Snapshotの次版へ追加する。
 * @responsibility 初回checkpointと元版Hashを構成し、既存操作・回復・搬送を保持する。
 * @trace ARCH-000008
 * @input currentBytes: 確認済み元本文または初回null、identityJson: 確定基本情報、repositoryBinding: 検証済み結合。
 * @returns 構造と遷移を検査した次版のbyte列、またはnull。
 * @precondition 呼出し元がHome Leaseを保持し、初期Hostと操作Ownerを確認している。
 * @postcondition 同じIdentityを再追加せず、他操作の現在値を変更しない。
 * @effect N/A: メモリ内の候補構築だけ。保存・Host遷移・Docker要求は発行しない。
 * @failure 不正本文、重複Identity、上限または元版不一致はnull。
 * @invariant null元版は初回Authorityを意味せず、Writerで新品領域を別確認する。
 * @boundary 固定Operation情報とRepository現在Snapshot。
 * @security JSONからAuthorityを発行せず、秘密や追加Pathを生成しない。
 * @concurrency 元版Hashを保持し、競合時に盲目的な再試行をしない。
 */
export function prepareCoordinatorStateOperationSnapshot(
  currentBytes: unknown,
  identityJson: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    if (typeof identityJson !== "string" || !isSha256Hex(repositoryBinding))
      return null;
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (currentBytes !== null && !current) return null;
    const identity = JSON.parse(identityJson);
    const identitySha256 = createHash("sha256")
      .update(identityJson, "utf8")
      .digest("hex");
    const recoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${identity.operationNonce}.${identitySha256}`;
    const operation: CoordinatorStateTaskOperation = {
      kind: "docker_task",
      dockerRestart: null,
      identityJson,
      identitySha256,
      recoveryId,
      phase: "executing",
      resources: (
        Object.keys(purposeResource) as (keyof typeof purposeResource)[]
      ).map((purpose) => ({
        purpose,
        request: "not_requested",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      })),
      host: {
        currentToken: identity.initialHostRecoveryId,
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      lease: "held",
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "active",
        workspaceReusable: false,
      },
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      history: null,
    };
    if (
      current?.snapshot.operations.some(
        (item) =>
          item.kind === "runtime_repair" && item.phase !== "awaiting_delivery",
      )
    )
      return null;
    const operations = [...(current?.snapshot.operations ?? []), operation];
    operations.sort((left, right) => {
      const a = JSON.parse(left.identityJson).operationNonce as string;
      const b = JSON.parse(right.identityJson).operationNonce as string;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    const next: CoordinatorStateSnapshot = {
      ...(current?.snapshot ?? EMPTY_COORDINATOR_TASK_SECTIONS),
      schema: COORDINATOR_STATE_SCHEMA,
      revision: (current?.snapshot.revision ?? 0) + 1,
      previous: current
        ? {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
          }
        : null,
      repositoryBinding,
      operations,
      projects: current
        ? associateCoordinatorTaskOperations(current.snapshot, operations)
        : [],
      unresolvedRecoveries: current?.snapshot.unresolvedRecoveries ?? [],
      pendingDeliveries: current?.snapshot.pendingDeliveries ?? [],
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 修復Identityを同じ現在状態へ追加する候補を構成する。
 * @responsibility Task fieldを作らず、既存全操作と参照を保存する。
 * @trace ARCH-000008
 * @input currentBytes: 元版または初回null、identityJson: 修復固定情報、repositoryBinding: 現在結合。
 * @returns 最新v2の次版、またはnull。
 * @precondition 物理Ownerが現在Root・利用者・操作Scopeを別に確認する。
 * @postcondition 同じRepository内の未終了修復は一つだけ。
 * @effect N/A: 候補生成のみ。
 * @failure 旧Schema、Identity不正、衝突、重複修復はnull。
 * @invariant 候補から処置・排他Authorityを生成しない。
 * @boundary 修復の不変情報と現在Snapshot。
 * @security Provider・Home・任意Pathを補完しない。
 * @concurrency 元版Hashへ結合し、保存側で競合照合する。
 */
export function prepareCoordinatorStateRepairSnapshot(
  currentBytes: unknown,
  identityJson: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    if (typeof identityJson !== "string" || !isSha256Hex(repositoryBinding))
      return null;
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (currentBytes !== null && !current) return null;
    const identity = JSON.parse(identityJson);
    const hash = createHash("sha256")
      .update(identityJson, "utf8")
      .digest("hex");
    const operation: CoordinatorStateRepairOperation = {
      kind: "runtime_repair",
      identityJson,
      identitySha256: hash,
      recoveryId: `docker-runtime-repair.${identity.operationNonce}.${hash}`,
      phase: "repairing",
      checkpoint: null,
      disposition: "not_applicable",
      disposal: null,
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
      history: null,
    };
    if (
      !validCoordinatorRepairOperation(operation, repositoryBinding as string)
    )
      return null;
    const operations = [
      ...(current?.snapshot.operations ?? []),
      operation,
    ].sort((a, b) =>
      coordinatorOperationNonce(a) < coordinatorOperationNonce(b)
        ? -1
        : coordinatorOperationNonce(a) > coordinatorOperationNonce(b)
          ? 1
          : 0,
    );
    const next = {
      ...(current?.snapshot ?? EMPTY_COORDINATOR_TASK_SECTIONS),
      schema: COORDINATOR_STATE_SCHEMA,
      revision: (current?.snapshot.revision ?? 0) + 1,
      previous: current
        ? {
            revision: current.snapshot.revision,
            payloadSha256: current.payloadSha256,
          }
        : null,
      repositoryBinding,
      operations,
      unresolvedRecoveries: current?.snapshot.unresolvedRecoveries ?? [],
      pendingDeliveries: current?.snapshot.pendingDeliveries ?? [],
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一修復の技術値と上位状態だけを元版へ結合する。
 * @responsibility 他Task／修復・履歴・配送を変更しない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、recoveryId: exact参照、update: 修復可変五field、repositoryBinding: 現在結合。
 * @returns 検査済み次版、またはnull。
 * @precondition 実Writerが観測・保持判断の根拠を確認する。
 * @postcondition Identity・回復ID・対象外全文を保持する。
 * @effect N/A: 値検査と候補生成だけ。
 * @failure 余剰field、別kind、巻戻し・順序違反はnull。
 * @invariant 保存候補は実処置や人間判断の証明ではない。
 * @boundary 技術通知と現在状態の更新。
 * @security 任意SnapshotやTask fieldの更新を受け付けない。
 * @concurrency 元版・revision・Hashを固定する。
 */
export function prepareCoordinatorStateRepairCheckpointSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  update: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current) return null;
    const value = JSON.parse(encodeRuntimeStateValue(update));
    if (
      !exactRecordKeys(value, [
        "phase",
        "checkpoint",
        "disposition",
        "primaryFailure",
        "outcome",
      ])
    )
      return null;
    const target = current.snapshot.operations.find(
      (item): item is CoordinatorStateRepairOperation =>
        item.kind === "runtime_repair" && item.recoveryId === recoveryId,
    );
    if (!target) return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === target ? { ...item, ...value } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ未終端修復の新しい補助子取得を次版へ結合する。
 * @responsibility 回収済みの旧呼出しと新呼出しの回収義務を分ける。
 * @trace ARCH-000008
 * @input currentBytes: 元版、recoveryId: exact修復参照、repositoryBinding: 現在結合。
 * @returns cleanupだけpendingへ変えた次版、またはnull。
 * @precondition 実Ownerが同じ主体・Scopeと新Native子の取得を別途確認する。
 * @postcondition 元の一次失敗・確定結果・他操作を変更しない。
 * @effect N/A: 純粋な保存候補生成。
 * @failure 未回収、回収失敗、終端済み、一次失敗あり、別IDはnull。
 * @invariant unknownを新取得で成功へ変えず、通常遷移を緩めない。
 * @boundary 値候補と物理Writer／実Native Session。
 * @security 戻り値は取得・処置・保存の許可ではない。
 * @concurrency 元版HashとRevisionを維持し、Writerで再照合する。
 */
export function prepareCoordinatorStateRepairSessionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const target = current.snapshot.operations.find(
      (item): item is CoordinatorStateRepairOperation =>
        item.kind === "runtime_repair" && item.recoveryId === recoveryId,
    );
    if (
      target?.phase !== "repairing" ||
      target.primaryFailure !== null ||
      target.outcome !== null
    )
      return null;
    const checkpoint = prepareDockerRuntimeRepairSessionCheckpoint(
      target.checkpoint,
    );
    if (checkpoint === null) return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === target ? { ...item, checkpoint } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransitionValue(
      currentBytes,
      bytes,
      repositoryBinding,
      recoveryId,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 未出版の保持判断待ちへ期限と用途別照合値を一度だけ結合する。
 * @responsibility 期限付き引渡し候補だけを専用保存から導入する。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact参照、receipt: 時刻と三用途、repositoryBinding: 現在結合。
 * @returns 一改訂の完全候補、または拒否のnull。
 * @precondition fresh読取り・明示保持・物理Ownerは呼出し元が確認する。
 * @postcondition 元結果・技術checkpoint・他操作・参照・配送は全文維持する。
 * @effect N/A: 純粋値だけ。物理保存は既存専用Writerが所有する。
 * @failure 既出版・既保持・時刻不正・用途差・非正規元版はnull。
 * @invariant 新しい保持期限を再入場や現在時計から補完しない。
 * @boundary 純粋引渡し候補と既存専用Writer。
 * @security 一般更新の許可集合を拡張しない。
 * @concurrency 元本文と版は物理保存時に別に再確認する。
 */
export function prepareCoordinatorStateRepairRetentionHandoffSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  receipt: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const target = current?.snapshot.operations.find(
      (operation): operation is CoordinatorStateRepairOperation =>
        operation.kind === "runtime_repair" &&
        operation.recoveryId === recoveryId,
    );
    const captured = JSON.parse(encodeRuntimeStateValue(receipt));
    if (
      !current ||
      !target ||
      !Buffer.isBuffer(currentBytes) ||
      !currentBytes.equals(
        Buffer.from(`${encodeRuntimeStateValue(current.snapshot)}\n`),
      ) ||
      target.summarySha256 !== null ||
      target.history !== null ||
      target.phase !== "awaiting_disposition" ||
      target.disposition !== "pending_human_decision" ||
      target.disposal !== null ||
      target.outcome?.status !== "recovered" ||
      target.primaryFailure !== null ||
      Object.hasOwn(target, "retention") ||
      !validCoordinatorRepairRetentionReceipt(captured) ||
      !target.checkpoint ||
      target.checkpoint.stale !== "retained" ||
      target.checkpoint.engine !== "ready" ||
      target.checkpoint.hostSafety !== "safe" ||
      target.checkpoint.cleanup !== "confirmed" ||
      target.checkpoint.cleanupFailure !== null ||
      !dockerRuntimeRepairCheckpointIsSettled(target.checkpoint) ||
      !coordinatorRepairRetentionMatchesCheckpoint(captured, target.checkpoint)
    )
      return null;
    const bytes = Buffer.from(
      `${encodeRuntimeStateValue({
        ...current.snapshot,
        revision: current.snapshot.revision + 1,
        previous: {
          revision: current.snapshot.revision,
          payloadSha256: current.payloadSha256,
        },
        operations: current.snapshot.operations.map((operation) =>
          operation.recoveryId === recoveryId
            ? {
                ...operation,
                phase: "settling",
                disposition: "retained_by_human_decision",
                retention: captured,
              }
            : operation,
        ),
      })}\n`,
    );
    return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 保持引渡し候補を元版から全文再導出する。
 * @responsibility 専用候補へ他操作や余剰更新を混入させない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、recoveryId: exact参照、repositoryBinding: 結合。
 * @returns 元版から同じreceiptを再導出した完全一致だけtrue。
 * @precondition fresh読取り・Owner・物理保存は別の責務。
 * @postcondition 一般Writerからのreceipt導入を許可しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 別ID・余剰変更・非正規本文・既出版はfalse。
 * @invariant trueを実保存・引渡し・削除許可と同一視しない。
 * @boundary 専用純粋候補と既存専用Writer境界。
 * @security 保存JSONから人間承認を復元しない。
 * @concurrency 元版の再観測は物理Writerが所有する。
 */
export function validateCoordinatorStateRepairRetentionHandoffTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): boolean {
  const next = decodeCoordinatorStateSnapshot(nextBytes, repositoryBinding);
  const target = next?.snapshot.operations.find(
    (operation): operation is CoordinatorStateRepairOperation =>
      operation.kind === "runtime_repair" &&
      operation.recoveryId === recoveryId,
  );
  if (!target?.retention || !Buffer.isBuffer(nextBytes)) return false;
  return (
    prepareCoordinatorStateRepairRetentionHandoffSnapshot(
      currentBytes,
      recoveryId,
      target.retention,
      repositoryBinding,
    )?.equals(nextBytes) === true
  );
}

/**
 * fresh再入場の完全候補を元版から独立に再導出して照合する。
 * @responsibility 専用更新へ他field変更を混入させない。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 保存候補、recoveryId: exact参照、repositoryBinding: 結合。
 * @returns 再導出したcanonical bytesと一致する場合だけtrue。
 * @precondition Writerが真正Ownerと現在Native取得を別途確認する。
 * @postcondition 通常Writerの更新許可を拡大しない。
 * @effect N/A: メモリ検査のみ。
 * @failure 不正元版、別ID、余分変更、非canonical候補はfalse。
 * @invariant cleanup以外の操作内容・参照・結果を保全する。
 * @boundary 専用候補と物理保存。
 * @security trueはAuthorityや実Session取得の証明ではない。
 * @concurrency N/A: 排他・元版再観測は保存Owner。
 */
export function validateCoordinatorStateRepairSessionTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): boolean {
  const expected = prepareCoordinatorStateRepairSessionSnapshot(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  return (
    expected !== null &&
    Buffer.isBuffer(nextBytes) &&
    expected.equals(nextBytes)
  );
}

/**
 * 未出版の保持判断待ちから通常回収の判断だけを確定する。
 * @responsibility 元修復結果を変更せず、後続進捗の初期値を同じ操作へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact対象、decidedAt: UTC判断時刻、repositoryBinding: 現在結合。
 * @returns 判断と初期進捗だけを追加した次版、またはnull。
 * @precondition 実Ownerと採用済み回収方針は保存側で確認する。
 * @postcondition 元checkpoint・結果・失敗・他操作・参照・配送を全文保持する。
 * @effect N/A: 純粋な候補生成だけ。
 * @failure 未完了、既保持、既出版、別ID、非正規元版・時刻はnull。
 * @invariant 各用途の削除意図はまだ未保存であり、物理処置を許可しない。
 * @boundary 上位の回収判断と専用Writerへ渡す値候補。
 * @security 通常checkpoint更新からこの判断を偽装できない。
 * @concurrency 元版Hash・改訂を固定し、物理保存は別途CASする。
 */
export function prepareCoordinatorStateRepairDisposalDecisionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  decidedAt: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  if (
    !current ||
    !Buffer.isBuffer(currentBytes) ||
    !currentBytes.equals(
      Buffer.from(`${encodeRuntimeStateValue(current.snapshot)}\n`),
    ) ||
    typeof recoveryId !== "string" ||
    typeof decidedAt !== "string" ||
    !Number.isFinite(Date.parse(decidedAt)) ||
    new Date(decidedAt).toISOString() !== decidedAt
  )
    return null;
  const targets = current.snapshot.operations.filter(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const target = targets[0];
  if (
    targets.length !== 1 ||
    !target ||
    target.phase !== "awaiting_disposition" ||
    target.disposition !== "pending_human_decision" ||
    target.disposal !== null ||
    target.summarySha256 !== null ||
    target.history !== null ||
    target.outcome?.status !== "recovered" ||
    target.primaryFailure !== null ||
    target.checkpoint?.stale !== "retained" ||
    target.checkpoint.engine !== "ready" ||
    target.checkpoint.hostSafety !== "safe" ||
    target.checkpoint.cleanup !== "confirmed" ||
    target.checkpoint.cleanupFailure !== null ||
    !dockerRuntimeRepairCheckpointIsSettled(target.checkpoint)
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.map((item) =>
      item === target
        ? {
            ...item,
            phase: "settling",
            disposition: "discard",
            disposal: {
              decidedAt,
              checkpoint: createDockerRuntimeRepairDisposalCheckpoint(),
            },
          }
        : item,
    ),
  };
  const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 同じ回収判断の一用途だけに単調な技術進捗を結合する。
 * @responsibility 元修復・判断時刻・履歴と別用途を変更しない。
 * @trace ARCH-000008
 * @input currentBytes: 正規元版、recoveryId: exact対象、purpose: 固定用途、checkpoint: 次の回収値、repositoryBinding: 結合。
 * @returns 検査済み次版。同値なら改訂しない元版bytes、拒否時null。
 * @precondition 実体・Owner・保存確認と処置順序はDriver／Writerが所有する。
 * @postcondition 要約確定後は同値も拒否し、元結果は全文維持する。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 判断前、別ID、用途外変更、巻戻し、後続出版済みはnull。
 * @invariant 候補生成や同値返却は保存・不存在・Effect 0の実証ではない。
 * @boundary DIの値検査と既存現在状態。
 * @security 通常更新の許可集合を広げない。
 * @concurrency 元版CASと同値時の無書込み確認は物理Writerへ接続する。
 */
export function prepareCoordinatorStateRepairDisposalProgressSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  purpose: unknown,
  checkpoint: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const captured = decodeDockerRuntimeRepairDisposalCheckpoint(checkpoint);
  if (
    !current ||
    !captured ||
    !Buffer.isBuffer(currentBytes) ||
    !currentBytes.equals(
      Buffer.from(`${encodeRuntimeStateValue(current.snapshot)}\n`),
    ) ||
    typeof recoveryId !== "string"
  )
    return null;
  const targets = current.snapshot.operations.filter(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const target = targets[0];
  if (
    targets.length !== 1 ||
    !target ||
    target.phase !== "settling" ||
    target.disposition !== "discard" ||
    !target.disposal ||
    target.summarySha256 !== null ||
    target.history !== null ||
    !validateDockerRuntimeRepairDisposalTransition(
      target.disposal.checkpoint,
      captured,
      purpose,
    )
  )
    return null;
  if (
    encodeRuntimeStateValue(target.disposal.checkpoint) ===
    encodeRuntimeStateValue(captured)
  )
    return Buffer.from(currentBytes);
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.map((item) =>
      item === target
        ? {
            ...item,
            disposal: { ...target.disposal, checkpoint: captured },
          }
        : item,
    ),
  };
  const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 専用回収候補を元版から再導出して全文照合する。
 * @responsibility decisionと一用途progressを通常保存・任意Snapshotから分離する。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、recoveryId: exact参照、purpose: decisionまたは固定用途、repositoryBinding: 結合。
 * @returns 専用候補と正規bytesが完全一致する場合だけtrue。
 * @precondition 物理Owner・CAS・purposeと保存入口の結合はWriterが別に確認する。
 * @postcondition 候補に含まれる時刻以外の新しい判断情報を推測しない。
 * @effect N/A: メモリ内の値再導出だけ。
 * @failure 別対象、別用途、他field差、非正規候補はfalse。
 * @invariant 同値progressは元版bytesだけを許し、改訂を増やさない。
 * @boundary 専用候補と物理Writer／保存再入場。
 * @security trueは処置・実保存の許可ではない。
 * @concurrency 元版・候補の複製と再観測は物理保存側の責務。
 */
export function validateCoordinatorStateRepairDisposalTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  recoveryId: unknown,
  purpose: unknown,
  repositoryBinding: unknown,
): boolean {
  const next = decodeCoordinatorStateSnapshot(nextBytes, repositoryBinding);
  const target = next?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!target?.disposal || !Buffer.isBuffer(nextBytes)) return false;
  const expected =
    purpose === "decision"
      ? prepareCoordinatorStateRepairDisposalDecisionSnapshot(
          currentBytes,
          recoveryId,
          target.disposal.decidedAt,
          repositoryBinding,
        )
      : prepareCoordinatorStateRepairDisposalProgressSnapshot(
          currentBytes,
          recoveryId,
          purpose,
          target.disposal.checkpoint,
          repositoryBinding,
        );
  return expected?.equals(nextBytes) === true;
}

/**
 * exact修復の保存途中本文を既存候補から再導出する。
 * @responsibility 出版可能なmetadataと技術再開の許可を分離する。
 * @trace ARCH-000008
 * @input currentBytes: 明示不存在または元版、pendingBytes: 短命候補、recoveryId: exact参照、repositoryBinding: 現在結合。
 * @returns 一意な出版種別と元版・候補の複製、またはnull。
 * @precondition 物理OwnerがRoot・実体・排他・markerを別に確認する。
 * @postcondition 新しい観測・処置・人間判断を生成しない。
 * @effect N/A: メモリ内の再導出だけ。
 * @failure 非canonical・別対象・非対象変更・複数解釈はnull。
 * @invariant 初回は単一の空Repairだけ、既出版同値は改訂不変。
 * @boundary pending metadataと物理Writer。
 * @security 結果はNative・Dockerの実行許可ではない。
 * @concurrency 元版と実体の再照合はWriterが行う。
 */
export function classifyCoordinatorRepairPublication(
  currentBytes: unknown,
  pendingBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
) {
  if (!Buffer.isBuffer(pendingBytes) || typeof recoveryId !== "string")
    return null;
  const next = decodeCoordinatorStateSnapshot(pendingBytes, repositoryBinding);
  const before =
    currentBytes === null
      ? null
      : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
  if (
    !next ||
    (currentBytes !== null && !before) ||
    !pendingBytes.equals(
      Buffer.from(`${encodeRuntimeStateValue(next.snapshot)}\n`),
    ) ||
    (before &&
      (!Buffer.isBuffer(currentBytes) ||
        !currentBytes.equals(
          Buffer.from(`${encodeRuntimeStateValue(before.snapshot)}\n`),
        )))
  )
    return null;
  const targets = next.snapshot.operations.filter(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (targets.length !== 1) return null;
  const target = targets[0];
  if (!target) return null;
  const modes: (
    | "initial_publication"
    | "identity"
    | "checkpoint"
    | "session_begin"
    | "retention_handoff"
    | "disposal_decision"
    | "disposal_primary"
    | "disposal_failed"
    | "disposal_auxiliary"
    | "remove_pending"
  )[] = [];
  if (Buffer.isBuffer(currentBytes) && pendingBytes.equals(currentBytes))
    modes.push("remove_pending");
  else {
    const prior = before?.snapshot.operations.find(
      (item) => item.recoveryId === recoveryId,
    );
    if (!prior) {
      const expected = prepareCoordinatorStateRepairSnapshot(
        currentBytes,
        target.identityJson,
        repositoryBinding,
      );
      if (
        expected?.equals(pendingBytes) &&
        (before !== null ||
          (next.snapshot.operations.length === 1 &&
            next.snapshot.unresolvedRecoveries.length === 0 &&
            next.snapshot.pendingDeliveries.length === 0))
      )
        modes.push(before ? "identity" : "initial_publication");
    } else if (prior.kind === "runtime_repair") {
      const expected = prepareCoordinatorStateRepairCheckpointSnapshot(
        currentBytes,
        recoveryId,
        {
          phase: target.phase,
          checkpoint: target.checkpoint,
          disposition: target.disposition,
          primaryFailure: target.primaryFailure,
          outcome: target.outcome,
        },
        repositoryBinding,
      );
      if (expected?.equals(pendingBytes)) modes.push("checkpoint");
      if (
        validateCoordinatorStateRepairRetentionHandoffTransition(
          currentBytes,
          pendingBytes,
          recoveryId,
          repositoryBinding,
        )
      )
        modes.push("retention_handoff");
      if (
        prepareCoordinatorStateRepairSessionSnapshot(
          currentBytes,
          recoveryId,
          repositoryBinding,
        )?.equals(pendingBytes)
      )
        modes.push("session_begin");
      for (const purpose of [
        "decision",
        "primary",
        "failed",
        "auxiliary",
      ] as const) {
        if (
          validateCoordinatorStateRepairDisposalTransition(
            currentBytes,
            pendingBytes,
            recoveryId,
            purpose,
            repositoryBinding,
          )
        )
          modes.push(`disposal_${purpose}`);
      }
    }
  }
  if (modes.length !== 1 || !modes[0]) return null;
  return Object.freeze({
    mode: modes[0],
    before: Buffer.isBuffer(currentBytes) ? Buffer.from(currentBytes) : null,
    candidate: Buffer.from(pendingBytes),
  });
}

/**
 * 同じ回復参照の指定checkpointだけを次のSnapshotへ接続する。
 *
 * @responsibility 要求前・発行後・作成結果と現在観測の構造的な遷移を保存候補へ搬送する。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文。recoveryId: exact参照。resourceValue: 完全評価。repositoryBinding: 検証済み結合。kind: 資源・Host・実行終端の固定種別。
 * @returns 遷移検査済みの次版byte列、またはnull。
 * @precondition 現在観測と要求の発行事実は呼出し側の実行境界で取得する。
 * @postcondition 指定したcheckpoint以外を保持し、一次失敗・確定結果の不許可更新を拒否する。
 * @effect N/A: 純粋な値変換だけ。保存やDocker要求を発行しない。
 * @failure 不正値・別参照・不正遷移・改訂上限をnullで拒否する。
 * @invariant unknownを成功や再発行許可に変換せず、既知の作成Identityを置換しない。
 * @boundary 実行境界の観測値と固定Snapshotの間。
 * @security 保存値から実資源不存在やAuthorityを推定しない。
 * @concurrency 元版相関を保持し、Writerで競合確認と排他を行う。
 */
function prepareCoordinatorStateOperationCheckpoint(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
  kind: "resource" | "host" | "lifecycle" | "restart",
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const resource = JSON.parse(encodeRuntimeStateValue(resourceValue));
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      (kind === "resource" &&
        !operation.resources.some(
          (item) => item.purpose === resource?.purpose,
        )) ||
      (kind === "lifecycle" &&
        !exactRecordKeys(resource, [
          "phase",
          "lease",
          "execution",
          "primaryFailure",
          "outcome",
          "summarySha256",
        ]))
    )
      return null;
    if (
      kind === "resource" &&
      resource?.request === "unknown" &&
      resource?.observation === "absent" &&
      !operation.resources.some(
        (item) =>
          encodeRuntimeStateValue(item) === encodeRuntimeStateValue(resource),
      )
    )
      return null;
    if (
      kind === "lifecycle" &&
      resource.summarySha256 !== operation.summarySha256
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item.kind !== "docker_task" || item !== operation
          ? item
          : {
              ...item,
              dockerRestart: kind === "restart" ? resource : item.dockerRestart,
              ...(kind === "lifecycle" ? resource : {}),
              host: kind === "host" ? resource : item.host,
              resources:
                kind !== "resource"
                  ? item.resources
                  : item.resources.map((before) =>
                      before.purpose === resource.purpose ? resource : before,
                    ),
            },
      ),
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 一資源の評価だけを次版へ搬送する。
 *
 * @responsibility 固定資源purposeと現在操作のcheckpointを相関する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。resourceValue: 一資源評価。repositoryBinding: 現在結合。
 * @returns 遷移検査済みの次版、またはnull。
 * @precondition 評価は実行Ownerが取得する。
 * @postcondition 他資源とHost・結果は変更しない。
 * @effect N/A: 純粋な値変換だけ。
 * @failure 不正値、別参照・結合と不許可遷移を拒否する。
 * @invariant ID・要求の既知事実を消さない。
 * @boundary 実行評価と保存候補。
 * @security 値変換を資源観測やAuthorityへ昇格しない。
 * @concurrency 元版Hashを保持し、Writerで競合照合する。
 */
export function prepareCoordinatorStateResourceSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  resourceValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    resourceValue,
    repositoryBinding,
    "resource",
  );
}

/**
 * Hostの処置前記録と観測済み次世代を次版へ搬送する。
 *
 * @responsibility 保存済み遷移意図を経ない世代変更と未確定意図の消去を拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。hostValue: Host現在評価。repositoryBinding: 現在結合。
 * @returns lineageと改訂遷移を検査した次版、またはnull。
 * @precondition Hostの実体、処置と受理結果は既存Host Ownerが確認する。
 * @postcondition 同じ操作のHostだけを更新し、他checkpointを保持する。
 * @effect N/A: 値変換のみ。Host処置や保存は行わない。
 * @failure 別世代、処置前記録欠測、不正本文と不許可遷移はnull。
 * @invariant 処置前意図から完了を推定せず、unknownを成功へ丸めない。
 * @boundary Host Ownerの確定記録とSnapshot候補。
 * @security Host TokenとJSONを処置Authorityとして扱わない。
 * @concurrency 元版相関を保持し、実保存時に再照合を要求する。
 */
export function prepareCoordinatorStateHostSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  hostValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    hostValue,
    repositoryBinding,
    "host",
  );
}

/**
 * 実行・Lease・一次失敗・最終結果の現在評価を次版へ搬送する。
 *
 * @responsibility 実行checkpointの閉じたfield集合を更新し、固定Identity・資源・Hostを保持する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。lifecycleValue: 固定六fieldの現在評価。repositoryBinding: 現在結合。
 * @returns 既知事実保持と改訂遷移を検査した次版、またはnull。
 * @precondition 実行とLeaseの現在事実は各Ownerが取得している。
 * @postcondition 一次失敗・確定結果・要約Hashの上書きと既知Effectの未発行化を拒否する。
 * @effect N/A: 値変換だけ。Provider実行・Lease操作・保存は行わない。
 * @failure 未評価field、不正値、別結合と不許可遷移はnull。
 * @invariant 過去unknownを未発行へ戻さず、後続回収で最初の失敗を消さない。
 * @boundary 実行Ownerの現在評価とSnapshot保存候補。
 * @security 保存結果を資源不存在、Authority失効やLease解放の実証にしない。
 * @concurrency 元版Hashへ結合し、Writerの排他とfresh照合を要求する。
 */
export function prepareCoordinatorStateLifecycleSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  lifecycleValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    lifecycleValue,
    repositoryBinding,
    "lifecycle",
  );
}

/**
 * 同じ操作の単一再起動checkpointを次版へ搬送する。
 * @responsibility 固定要求ID・Scopeと許容組合せを他の操作から分離する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、checkpoint、repositoryBinding: 元版とexact対象。
 * @returns 遷移確認済みの次版、またはnull。
 * @precondition 実行許可・同Owner観測・Host排他は呼出し側が別に確認する。
 * @postcondition Task一次失敗・結果・他操作を変更しない。
 * @effect N/A: 保存候補の値変換だけ。
 * @failure 別要求・不正組合せ・元版不一致はnull。
 * @invariant 一操作一要求。保存値から要求を再発行しない。
 * @boundary 再起動Ownerの観測と現在Snapshot。
 * @security Hash・保存成功を操作Authorityにしない。
 * @concurrency 元版相関と既存Writer排他を要求する。
 */
export function prepareCoordinatorStateRestartSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  checkpoint: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  return prepareCoordinatorStateOperationCheckpoint(
    currentBytes,
    recoveryId,
    checkpoint,
    repositoryBinding,
    "restart",
  );
}

/**
 * 五資源の回収観測を同じ改訂版へまとめる。
 *
 * @responsibility 未要求、exact IDの不存在と観測不能を区別して保存候補へ接続する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。observationsValue: 固定五資源の回収結果。repositoryBinding: 現在結合。
 * @returns 全資源の相関と遷移が成立する次版、またはnull。
 * @precondition 呼出し側が現在の回収結果を実行Ownerから取得している。
 * @postcondition 全五資源を一回の改訂で更新し、他操作とHost・実行結果を保持する。
 * @effect N/A: 値変換だけ。資源削除や保存は行わない。
 * @failure 欠測、重複、別名・別ID、未要求の偽装と不正遷移を拒否する。
 * @invariant ID未確定の不存在を通常回収の成立へ昇格しない。
 * @boundary 回収Ownerの観測と現在状態の保存候補。
 * @security 観測のHashは相関用であり、実不存在やAuthorityの証明ではない。
 * @concurrency 全結果を同じ元版へ結合し、物理Writerの競合照合を要求する。
 */
export function prepareCoordinatorStateCleanupSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  observationsValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const observations = JSON.parse(encodeRuntimeStateValue(observationsValue));
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation || !Array.isArray(observations) || observations.length !== 5)
      return null;
    const identity = JSON.parse(operation.identityJson);
    const resources = operation.resources.map((resource, index) => {
      const observed = observations[index];
      if (
        !exactRecordKeys(observed, [
          "purpose",
          "plannedResourceName",
          "dockerId",
          "observation",
        ]) ||
        observed.purpose !== resource.purpose ||
        observed.plannedResourceName !==
          identity.resources[purposeResource[resource.purpose]] ||
        observed.dockerId !== resource.dockerId ||
        !["not_requested", "absent", "unknown"].includes(observed.observation)
      )
        throw new Error("coordinator_state_cleanup_invalid");
      if (observed.observation === "not_requested") {
        if (
          !["not_requested", "not_issued"].includes(resource.request) ||
          resource.dockerId !== null
        )
          throw new Error("coordinator_state_cleanup_invalid");
        return resource;
      }
      if (
        ["not_requested", "not_issued"].includes(resource.request) ||
        (observed.observation === "absent" && resource.request !== "identified")
      )
        throw new Error("coordinator_state_cleanup_invalid");
      return {
        ...resource,
        observation: observed.observation,
        absence:
          observed.observation === "absent"
            ? {
                recoveryId,
                purpose: resource.purpose,
                plannedResourceName: observed.plannedResourceName,
                dockerId: resource.dockerId,
                evidenceSha256: createHash("sha256")
                  .update(
                    encodeRuntimeStateValue({
                      recoveryId,
                      previousPayloadSha256: current.payloadSha256,
                      observation: observed,
                    }),
                  )
                  .digest("hex"),
              }
            : null,
      };
    });
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === operation ? { ...item, resources } : item,
      ),
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 同じ操作の回収義務と結果受理checkpointを次版へ搬送する。
 *
 * @responsibility 他操作を保持し、exact回復参照と結果Identityを現在集合へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文。recoveryId: exact参照。referencesValue: recoveryとdeliveries。repositoryBinding: 現在結合。
 * @returns 構造・相関・遷移を確認した次版、またはnull。
 * @precondition 義務と耐久受理根拠は各Ownerが取得する。
 * @postcondition 同じ操作の参照だけを更新し、未確定の削除と受理Hashの巻戻しを拒否する。
 * @effect N/A: 純粋な値変換。搬送・受理・削除は発行しない。
 * @failure 不正入力、他操作参照、既知結果変更と不許可除去はnull。
 * @invariant 受理記録の存在を実受理へ読み替えず、未解決義務を期限で消さない。
 * @boundary 終端・Consumer Ownerと現在状態の参照集合。
 * @security 回復参照を新Authorityや外部への開示許可にしない。
 * @concurrency 元版Hashに結合し、Writerの競合確認を要求する。
 */
export function prepareCoordinatorStateReferencesSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  referencesValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const nonce = parseDockerTaskRecoveryId(recoveryId)?.operationNonce;
    const references = JSON.parse(encodeRuntimeStateValue(referencesValue));
    if (
      !operation ||
      !nonce ||
      !exactRecordKeys(references, ["recovery", "deliveries"]) ||
      !Array.isArray(references.deliveries)
    )
      return null;
    const recovery = references.recovery;
    if (
      (recovery !== null &&
        (recovery.operationNonce !== nonce ||
          recovery.recoveryId !== recoveryId)) ||
      references.deliveries.some(
        (delivery: { operationNonce: unknown; recoveryId: unknown } | null) =>
          !delivery ||
          delivery.operationNonce !== nonce ||
          delivery.recoveryId !== recoveryId,
      )
    )
      return null;
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      unresolvedRecoveries: [
        ...current.snapshot.unresolvedRecoveries.filter(
          (item) => item.operationNonce !== nonce,
        ),
        ...(recovery === null ? [] : [recovery]),
      ].sort((a, b) =>
        a.operationNonce < b.operationNonce
          ? -1
          : a.operationNonce > b.operationNonce
            ? 1
            : 0,
      ),
      pendingDeliveries: [
        ...current.snapshot.pendingDeliveries.filter(
          (item) => item.operationNonce !== nonce,
        ),
        ...references.deliveries,
      ].sort((a, b) => {
        const first = `${a.operationNonce}:${a.consumer}`;
        const second = `${b.operationNonce}:${b.consumer}`;
        return first < second ? -1 : first > second ? 1 : 0;
      }),
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 保存済み操作から終了要約の候補内容だけを導出する。
 * @responsibility 相関、一次失敗、最終結果と清掃状態を上書きせず要約へ分離する。
 * @trace ARCH-000008
 * @input currentBytes: 正規Snapshot、recoveryId: exact対象、repositoryBinding: 検証済み結合。
 * @returns 正規要約本文、要約Hashと導出元Hash、またはnull。
 * @precondition 対象は実行中でなく最終結果が保存されている。
 * @postcondition 元Snapshotを変更せず、固定・履歴保存の許可を発行しない。
 * @effect N/A: メモリ内の導出だけ。
 * @failure 不正Snapshot、別対象、未確定結果、確定要約との不一致はnull。
 * @invariant 一次失敗と清掃不明を保持し、返却値を要約固定・保存・操作除去の許可にしない。
 * @boundary 現在状態から非Authorityの終了履歴内容。
 * @security 任意要約、任意Path、外部出力や回復権限を受けない。
 * @concurrency 導出元Hashを返し、物理Writerで元版の再照合を要求する。
 */
export function prepareCoordinatorStateHistorySummary(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Readonly<{
  summaryBytes: Buffer;
  summarySha256: string;
  sourcePayloadSha256: string;
}> | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (!current || typeof recoveryId !== "string") return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!operation || operation.phase === "executing" || !operation.outcome)
      return null;
    const summaryBytes = coordinatorOperationSummaryBytes(operation);
    const summarySha256 = createHash("sha256")
      .update(summaryBytes)
      .digest("hex");
    if (
      operation.summarySha256 !== null &&
      operation.summarySha256 !== summarySha256
    )
      return null;
    return Object.freeze({
      summaryBytes,
      summarySha256,
      sourcePayloadSha256: current.payloadSha256,
    });
  } catch {
    return null;
  }
}

/**
 * 固定済み終端要約を結果IDとして必要搬送先を登録する候補を作る。
 *
 * @responsibility 結果本文を既存操作要約へ限定し、時刻・File Identity・全体改訂を結果IDから除外する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: exact対象、consumersValue: 必要搬送先、repositoryBinding: 現在結合。
 * @returns 同じ結果を未受理で登録する次版、同じ登録の元版、またはnull。
 * @precondition 終端要約Hashは真正終端Writerが固定済みである。
 * @postcondition 再登録で受理を巻き戻さず、結果・必要集合を差し替えない。
 * @effect N/A: メモリ内候補の構築だけ。
 * @failure 未終端・未固定、保存Consumerと異なる集合・重複・未知Consumerを拒否する。
 * @invariant 候補生成を実清掃・Consumer受理・保存成立へ昇格しない。
 * @boundary 終端要約と現在状態の結果搬送集合。
 * @security 任意結果本文・Path・受理Hashを受け付けない。
 * @concurrency 元版と真正終端の共同照合は物理Writerが行う。
 */
export function prepareCoordinatorStateResultDeliverySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  consumersValue: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const summary = prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    const operation = current?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const consumers = JSON.parse(encodeRuntimeStateValue(consumersValue));
    const identity = operation ? JSON.parse(operation.identityJson) : null;
    const requiredConsumers =
      identity?.consumer === "orchestrator" ? ["orchestrator"] : [];
    if (
      !current ||
      !summary ||
      !operation ||
      operation.summarySha256 !== summary.summarySha256 ||
      operation.outcome?.cleanupConfirmed !== true ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.lease !== "released" ||
      operation.execution.ownerEffect !== "disabled" ||
      !coordinatorTaskResourcesAreSettled(operation) ||
      !Array.isArray(consumers) ||
      encodeRuntimeStateValue(consumers) !==
        encodeRuntimeStateValue(requiredConsumers)
    )
      return null;
    const nonce = identity.operationNonce;
    if (requiredConsumers.length === 0)
      return Buffer.from(currentBytes as Buffer);
    const existingEntries = current.snapshot.pendingDeliveries.filter(
      (item) => item.operationNonce === nonce,
    );
    if (existingEntries.length !== 0) {
      return existingEntries.length === consumers.length &&
        existingEntries.every(
          (item, index) =>
            item.consumer === consumers[index] &&
            item.resultId === summary.summarySha256 &&
            item.recoveryId === recoveryId,
        )
        ? Buffer.from(currentBytes as Buffer)
        : null;
    }
    return prepareCoordinatorStateReferencesSnapshot(
      currentBytes,
      recoveryId,
      {
        recovery:
          current.snapshot.unresolvedRecoveries.find(
            (item) => item.operationNonce === nonce,
          ) ?? null,
        deliveries: consumers.map((consumer) => ({
          operationNonce: nonce,
          recoveryId,
          resultId: summary.summarySha256,
          consumer,
        })),
      },
      repositoryBinding,
    );
  } catch {
    return null;
  }
}

/**
 * 検証済み修復の非Authority要約と導出元Hashを返す。
 * @responsibility Task用要約関数へ修復を渡さない。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文、recoveryId: exact修復、repositoryBinding: 現在結合。
 * @returns 要約bytes・Hashと導出元Hash、またはnull。
 * @precondition 物理Owner・実修復は別に確認する。
 * @postcondition 固定済み要約との不一致を拒否する。
 * @effect N/A: メモリ内導出。
 * @failure 未終端・保持未決・別対象・Hash差はnull。
 * @invariant 要約生成は保存や操作除去の許可ではない。
 * @boundary 現在状態から履歴投影。
 * @security 任意要約やPathを入力に持たない。
 * @concurrency 導出元Hashを物理Writerで再照合する。
 */
export function prepareCoordinatorRepairHistorySummary(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
) {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!current || !operation || !coordinatorRepairCanSummarize(operation))
    return null;
  const summaryBytes = coordinatorRepairSummaryBytes(operation);
  const summarySha256 = createHash("sha256").update(summaryBytes).digest("hex");
  if (
    operation.summarySha256 !== null &&
    operation.summarySha256 !== summarySha256
  )
    return null;
  return Object.freeze({
    summaryBytes,
    summarySha256,
    sourcePayloadSha256: current.payloadSha256,
  });
}

/**
 * 修復の初回時刻と両Hashを固定する候補を生成する。
 * @responsibility 未確認から確認済みへの専用遷移だけを作る。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、occurredAt、confirmed、repositoryBinding: 固定元版・対象・時刻・確認値・結合。
 * @returns 次版または同じ確認状態の元版、拒否時null。
 * @precondition 実保存読戻しは専用物理Ownerが確認する。
 * @postcondition 技術値・時刻・Hash・他操作を変更しない。
 * @effect N/A: 値候補生成のみ。
 * @failure 初回true、時刻差、巻戻し、未終端はnull。
 * @invariant true候補は実保存の根拠ではない。
 * @boundary 修復終了と単一状態の履歴相関。
 * @security Task配送や架空資源情報を作らない。
 * @concurrency 元版全文は既存Writer内で再確認する。
 */
export function prepareCoordinatorRepairHistorySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  occurredAt: unknown,
  confirmed: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  const summary = prepareCoordinatorRepairHistorySummary(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  if (
    !current ||
    !operation ||
    !summary ||
    typeof occurredAt !== "string" ||
    !Number.isFinite(Date.parse(occurredAt)) ||
    new Date(occurredAt).toISOString() !== occurredAt ||
    typeof confirmed !== "boolean" ||
    (operation.retention !== undefined &&
      occurredAt !== operation.retention.decidedAt)
  )
    return null;
  if (operation.history) {
    if (
      operation.history.occurredAt !== occurredAt ||
      (operation.history.confirmed && !confirmed)
    )
      return null;
    if (operation.history.confirmed === confirmed)
      return Buffer.from(`${encodeRuntimeStateValue(current.snapshot)}\n`);
  } else if (confirmed) return null;
  const history = {
    occurredAt,
    lineSha256: createHash("sha256")
      .update(coordinatorRepairHistoryLineBytes(operation, occurredAt))
      .digest("hex"),
    confirmed,
  };
  const candidate = Buffer.from(
    `${encodeRuntimeStateValue({
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item === operation
          ? { ...item, summarySha256: summary.summarySha256, history }
          : item,
      ),
    })}\n`,
  );
  return validateCoordinatorStateTransition(
    currentBytes,
    candidate,
    repositoryBinding,
  )
    ? candidate
    : null;
}

/**
 * 修復の固定済み相関から同じ履歴行を導出する。
 * @responsibility 再入場でも初回時刻と行Hashを維持する。
 * @trace ARCH-000008
 * @input currentBytes: 現在本文、recoveryId: exact修復、repositoryBinding: 結合。
 * @returns 固定したLF付き行、またはnull。
 * @precondition 初回時刻とHashが現在状態へ保存済み。
 * @postcondition confirmedの前後で同じ行を返す。
 * @effect N/A: メモリ内導出。
 * @failure 未固定・別対象・不正相関はnull。
 * @invariant 行の存在・実保存を主張しない。
 * @boundary 現在状態と履歴Writer。
 * @security 任意本文・時刻を受け付けない。
 * @concurrency 物理照合は既存Writerが行う。
 */
export function prepareCoordinatorRepairHistoryLine(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  return operation?.history
    ? coordinatorRepairHistoryLineBytes(operation, operation.history.occurredAt)
    : null;
}

/**
 * 履歴Bufferのown methodやaccessorを評価せず内容を捕捉する。
 * @responsibility 偽equals・偽length・Proxyを保存候補比較へ使わない。
 * @trace ARCH-000008
 * @input input: 履歴canonicalまたはpendingのBuffer候補。
 * @returns 上限内の独立したBuffer、拒否時null。
 * @precondition 呼出し元が不存在を空Bufferへ明示変換する。
 * @postcondition 元Bufferやdescriptorを変更しない。
 * @effect N/A: メモリ内複製。
 * @failure Proxy・非Buffer・長さ不正・上限超過はnull。
 * @invariant 呼出し側のequals結果を信頼しない。
 * @boundary 未信頼byte入力と純粋な履歴再導出。
 * @security 外部入力のgetter・thenableを実行しない。
 * @concurrency N/A: 同期捕捉。
 */
function copyCoordinatorRepairHistoryBytes(input: unknown): Buffer | null {
  try {
    if (types.isProxy(input) || !Buffer.isBuffer(input)) return null;
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    const length = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteLength",
    )?.get?.call(input);
    if (
      !Number.isSafeInteger(length) ||
      length < 0 ||
      length > RUNTIME_STATE_MAXIMUM_BYTES
    )
      return null;
    const buffer = Object.getOwnPropertyDescriptor(
      intrinsic,
      "buffer",
    )?.get?.call(input);
    const offset = Object.getOwnPropertyDescriptor(
      intrinsic,
      "byteOffset",
    )?.get?.call(input);
    return Buffer.from(new Uint8Array(buffer, offset, length));
  } catch {
    return null;
  }
}

/**
 * 修復の未確認行と保存途中全文から専用出版候補を再導出する。
 * @responsibility 固定時刻・内容と期間整理を同じ元版へ結合する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、historyBytes、pendingBytes、retentionDays、repositoryBinding: 現在状態・対象・履歴・短命候補・日数・結合。
 * @returns 確認次版とcanonical履歴候補、またはnull。
 * @precondition 実体・Owner・設定と読戻しは専用物理Writerが確認する。
 * @postcondition 同じ行の重複追記・時刻変更を行わない。
 * @effect N/A: 独立Bufferの値導出だけ。
 * @failure 不正行、同ID異内容、重複、pending全文差、設定不正はnull。
 * @invariant 確認済み欠測を新たな出版成功へ変換しない。
 * @boundary 修復の固定履歴相関と共通JSONL保存。
 * @security Task管理資格・任意Pathを合成しない。
 * @concurrency 元版・設定・全文の再照合は既存物理Writerが行う。
 */
export function prepareCoordinatorRepairHistoryPublication(
  currentBytes: unknown,
  recoveryId: unknown,
  historyBytes: unknown,
  pendingBytes: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
) {
  const canonical = copyCoordinatorRepairHistoryBytes(historyBytes);
  const pending =
    pendingBytes === null
      ? null
      : copyCoordinatorRepairHistoryBytes(pendingBytes);
  if (!canonical || (pendingBytes !== null && !pending)) return null;
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (!current || !operation?.history || operation.history.confirmed)
    return null;
  const line = prepareCoordinatorRepairHistoryLine(
    currentBytes,
    recoveryId,
    repositoryBinding,
  );
  const snapshotBytes = prepareCoordinatorRepairHistorySnapshot(
    currentBytes,
    recoveryId,
    operation.history.occurredAt,
    true,
    repositoryBinding,
  );
  const rows = decodeCoordinatorHistoryRows(canonical);
  if (!line || !snapshotBytes || !rows) return null;
  const existing = rows.find((row) => row.recoveryId === recoveryId);
  if (existing && !Buffer.from(existing.line).equals(line)) return null;
  const candidateHistory = prepareCoordinatorHistoryRetention(
    currentBytes,
    existing ? canonical : Buffer.concat([canonical, line]),
    operation.history.occurredAt,
    retentionDays,
    repositoryBinding,
  );
  if (
    !candidateHistory ||
    (pending !== null && !pending.equals(candidateHistory))
  )
    return null;
  return Object.freeze({
    snapshotBytes,
    historyBytes: candidateHistory,
    historyChanged: !canonical.equals(candidateHistory),
  });
}

/**
 * 現在終端の履歴出版候補を固定時刻と全文から再導出する。
 * @responsibility Process内の過去試行情報を復元せず、同じ行・保持設定・pendingを照合する。
 * @trace ARCH-000008
 * @input currentBytes、recoveryId、historyBytes、pendingBytes、retentionDays、repositoryBinding: 現在状態と固定履歴入力。
 * @returns 確認済みSnapshotと履歴全文の候補、またはnull。
 * @precondition 実終端、Root、File実体、排他と現在設定は保存Ownerが別に確認する。
 * @postcondition 固定時刻・行内容を変えず、同じIDの行を再追加しない。
 * @effect N/A: 純粋な候補導出だけ。保存・削除・処置許可の発行なし。
 * @failure 不正履歴、同ID異内容、重複、pending全文差、設定差による再導出不一致はnull。
 * @invariant JSONやHashの一致を実終端やWriter Authorityへ昇格しない。
 * @boundary 現在終端の固定行と通常履歴の保存途中全文。
 * @security 未知本文を相関情報や履歴へ追加しない。
 * @concurrency 元Snapshotと全履歴・設定を実Writer内でも再照合する。
 */
export function prepareCoordinatorRecoveredHistoryPublication(
  currentBytes: unknown,
  recoveryId: unknown,
  historyBytes: unknown,
  pendingBytes: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
) {
  try {
    const copied: Buffer[] = [];
    const intrinsic = Object.getPrototypeOf(Uint8Array.prototype);
    for (const input of pendingBytes === null
      ? [historyBytes]
      : [historyBytes, pendingBytes]) {
      if (types.isProxy(input) || !Buffer.isBuffer(input)) return null;
      const length = Object.getOwnPropertyDescriptor(
        intrinsic,
        "byteLength",
      )?.get?.call(input);
      if (
        !Number.isSafeInteger(length) ||
        length < 0 ||
        length > RUNTIME_STATE_MAXIMUM_BYTES
      )
        return null;
      const buffer = Object.getOwnPropertyDescriptor(
        intrinsic,
        "buffer",
      )?.get?.call(input);
      const offset = Object.getOwnPropertyDescriptor(
        intrinsic,
        "byteOffset",
      )?.get?.call(input);
      copied.push(Buffer.from(new Uint8Array(buffer, offset, length)));
    }
    const canonical = copied[0];
    const pending = pendingBytes === null ? null : copied[1];
    if (canonical === undefined || pending === undefined) return null;
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const operation = current?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!current || !operation?.history || operation.history.confirmed)
      return null;
    const line = prepareCoordinatorStateHistoryLine(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    const snapshotBytes = prepareCoordinatorStateHistorySnapshot(
      currentBytes,
      recoveryId,
      operation.history.occurredAt,
      true,
      repositoryBinding,
    );
    const rows = decodeCoordinatorHistoryRows(canonical);
    if (!line || !snapshotBytes || !rows) return null;
    const existing = rows.find((row) => row.recoveryId === recoveryId);
    if (existing && !Buffer.from(existing.line).equals(line)) return null;
    const candidateHistory = prepareCoordinatorHistoryRetention(
      currentBytes,
      existing ? canonical : Buffer.concat([canonical, line]),
      operation.history.occurredAt,
      retentionDays,
      repositoryBinding,
    );
    if (
      !candidateHistory ||
      (pending !== null && !pending.equals(candidateHistory))
    )
      return null;
    return Object.freeze({
      snapshotBytes: Buffer.from(snapshotBytes),
      historyBytes: Buffer.from(candidateHistory),
      historyChanged: !canonical.equals(candidateHistory),
    });
  } catch {
    return null;
  }
}

/**
 * 履歴の初回固定または保存確認の候補を同じ操作へ結合する。
 * @responsibility 最初の時刻と行Hashを固定し、確認状態の巻戻しを拒否する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: 対象、occurredAt: 固定時刻、confirmed: 保存確認候補、repositoryBinding: 現在結合。
 * @returns 改訂相関を含む候補Snapshot、またはnull。
 * @precondition 実終端と保存読戻しの根拠は物理Writerで別途確認する。
 * @postcondition 他操作・資源・参照を変更しない。
 * @effect N/A: メモリ内の候補生成。
 * @failure 未終端評価、時刻不正、初回true、既存内容差はnull。
 * @invariant 候補生成を実終端・保存・除去の許可にしない。
 * @boundary 終端Ownerと単一Snapshotの短命な履歴相関。
 * @security 一般Writerは実保存根拠なしの履歴変更を拒否する。
 * @concurrency 元版Hashへ結合して物理Writerで再照合する。
 */
export function prepareCoordinatorStateHistorySnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  occurredAt: unknown,
  confirmed: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  try {
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    if (
      !current ||
      typeof recoveryId !== "string" ||
      typeof occurredAt !== "string" ||
      typeof confirmed !== "boolean"
    )
      return null;
    const time = Date.parse(occurredAt);
    if (!Number.isFinite(time) || new Date(time).toISOString() !== occurredAt)
      return null;
    const operation = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (
      !operation ||
      operation.phase === "executing" ||
      !operation.outcome?.cleanupConfirmed ||
      operation.host.cleanup !== "confirmed" ||
      operation.host.pendingTransitionJson !== null ||
      operation.lease !== "released" ||
      operation.execution.ownerEffect !== "disabled" ||
      !coordinatorTaskResourcesAreSettled(operation)
    )
      return null;
    if (!operation.history && confirmed) return null;
    const summary = prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    );
    if (!summary) return null;
    const history = {
      occurredAt,
      lineSha256: createHash("sha256")
        .update(coordinatorHistoryLineBytes(operation, occurredAt))
        .digest("hex"),
      confirmed,
    };
    const next = {
      ...current.snapshot,
      revision: current.snapshot.revision + 1,
      previous: {
        revision: current.snapshot.revision,
        payloadSha256: current.payloadSha256,
      },
      operations: current.snapshot.operations.map((item) =>
        item !== operation
          ? item
          : { ...item, summarySha256: summary.summarySha256, history },
      ),
    };
    const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
    return validateCoordinatorStateTransition(
      currentBytes,
      bytes,
      repositoryBinding,
    )
      ? bytes
      : null;
  } catch {
    return null;
  }
}

/**
 * 終端・履歴確認・全搬送受理を満たす一操作だけの終了候補を作る。
 * @responsibility 操作と同じ回復・搬送参照を一改訂で取り除く値契約を所有する。
 * @trace ARCH-000008
 * @input currentBytes: 元Snapshot、recoveryId: exact対象、repositoryBinding: 現在結合。
 * @returns 固定対象だけを除去した次Snapshot、またはnull。
 * @precondition 物理Ownerが実終端と固定利用側に必要な耐久受理根拠を別途照合する。
 * @postcondition 他操作・他参照と元版相関を保持する。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 実行中、清掃・Lease・履歴未確認、搬送未受理または不正入力はnull。
 * @invariant 候補を実終端・受理・除去Authorityへ昇格せず、一般更新の除去拒否を維持する。
 * @boundary 現在操作の閉集合と通常履歴。
 * @security unknown Createや不明Effectを成功へ丸めない。
 * @concurrency 元版と真正根拠の同時照合は物理Writerの責務。
 */
export function prepareCoordinatorStateCompletionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (value): value is CoordinatorStateTaskOperation =>
      value.kind === "docker_task" && value.recoveryId === recoveryId,
  );
  const completionPolicy = operation
    ? coordinatorConsumerCompletionPolicy(
        JSON.parse(operation.identityJson).consumer,
      )
    : null;
  if (
    !current ||
    !operation ||
    !completionPolicy ||
    operation.phase === "executing" ||
    operation.outcome?.cleanupConfirmed !== true ||
    operation.host.cleanup !== "confirmed" ||
    operation.host.pendingTransitionJson !== null ||
    operation.lease !== "released" ||
    operation.execution.ownerEffect !== "disabled" ||
    operation.history?.confirmed !== true ||
    !prepareCoordinatorStateHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    ) ||
    (completionPolicy === "durable" &&
      !current.snapshot.resultReceipts.some(
        (receipt) =>
          receipt.recoveryId === recoveryId &&
          receipt.resultId === operation.summarySha256,
      )) ||
    (completionPolicy === "transient" &&
      current.snapshot.pendingDeliveries.some(
        (delivery) => delivery.recoveryId === recoveryId,
      )) ||
    !coordinatorTaskResourcesAreSettled(operation) ||
    current.snapshot.pendingDeliveries.some(
      (delivery) =>
        delivery.recoveryId === recoveryId &&
        delivery.resultId !== operation.summarySha256,
    )
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
    unresolvedRecoveries: current.snapshot.unresolvedRecoveries.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
    pendingDeliveries: current.snapshot.pendingDeliveries.filter(
      (value) => value.recoveryId !== recoveryId,
    ),
  };
  const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 修復専用の終端条件を満たした対象だけの除去候補を作る。
 * @responsibility 共通終端検査を再利用し、Taskの受領条件で修復を代用しない。
 * @trace ARCH-000008
 * @input currentBytes: 元本文、recoveryId: exact対象、repositoryBinding: 現在結合。
 * @returns 対象だけを除去した次本文、又はnull。
 * @precondition 物理Writerが実処置と履歴出版を別途確認する。
 * @postcondition 他操作と版相関を保全する。
 * @effect N/A: 値候補の生成だけ。
 * @failure 未確定処置、未解決保持、履歴未確認、別対象はnull。
 * @invariant 値の一致から実削除や保存成功を推定しない。
 * @boundary 現在状態の修復variant。
 * @security 保存候補は回復Authorityではない。
 * @concurrency 元版と実排他の照合はWriterが所有する。
 */
export function prepareCoordinatorStateRepairCompletionSnapshot(
  currentBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeCoordinatorStateSnapshot(
    currentBytes,
    repositoryBinding,
  );
  const operation = current?.snapshot.operations.find(
    (item): item is CoordinatorStateRepairOperation =>
      item.kind === "runtime_repair" && item.recoveryId === recoveryId,
  );
  if (
    !current ||
    !operation ||
    !coordinatorRepairCanComplete(operation, current.snapshot) ||
    !prepareCoordinatorRepairHistorySummary(
      currentBytes,
      recoveryId,
      repositoryBinding,
    )
  )
    return null;
  const next = {
    ...current.snapshot,
    revision: current.snapshot.revision + 1,
    previous: {
      revision: current.snapshot.revision,
      payloadSha256: current.payloadSha256,
    },
    operations: current.snapshot.operations.filter(
      (item) => item.recoveryId !== recoveryId,
    ),
  };
  const bytes = Buffer.from(`${encodeRuntimeStateValue(next)}\n`);
  return decodeCoordinatorStateSnapshot(bytes, repositoryBinding)
    ? bytes
    : null;
}

/**
 * 同じRepositoryの現在状態更新で既知事実を保全する。
 * @responsibility exact元本文、固定Identity、確定資源と一次結果の保持を検査する。
 * @trace ARCH-000008
 * @input currentBytes: 元本文または初回のnull、nextBytes: 次本文、repositoryBinding: 現在結合。
 * @returns 許可された内容遷移だけtrue。
 * @precondition 物理Ownerが元Fileの観測と初回Root条件を確認する。
 * @postcondition 不変情報と未終了集合の暗黙除去を拒否する。
 * @effect N/A: メモリ内の比較のみ。
 * @failure 復号・改訂・遷移不一致はfalse。
 * @invariant unknownを既知事実の消去や再実行許可へ用いない。
 * @boundary 保存候補の構造と実処置前の検証。
 * @security trueは資源終端・Authority・保存確定の証明ではない。
 * @concurrency N/A: 排他とfresh観測は物理Writerの責務。
 */
export function validateCoordinatorStateTransition(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
): boolean {
  return validateCoordinatorStateTransitionValue(
    currentBytes,
    nextBytes,
    repositoryBinding,
    null,
  );
}

/**
 * 中断した単一資源の作成Receipt保存を完全本文から再導出する。
 * @responsibility exact対象・一資源差分と既出版同本文を区別する。
 * @trace ARCH-000008
 * @input currentBytes、pendingBytes: 正規本文、recoveryId: exact参照、repositoryBinding: 現在Repository結合。
 * @returns publish_pending／remove_pending、または拒否のnull。
 * @precondition 呼出し側が実体、旧Owner失効と排他を別途確認する。
 * @postcondition 他操作・状態・Authorityを変える候補を受理しない。
 * @effect N/A: メモリ内の復号・完全再導出だけ。
 * @failure 不正本文、対象差、資源差分複数、版・前版Hash不整合はnull。
 * @invariant ID受領記録を実資源の現在存在・回収証明へ昇格しない。
 * @boundary 保存候補の意味検査。物理出版と実資源処置は別Owner。
 * @security 保存本文から処置Authorityを生成しない。
 * @concurrency N/A: 物理的な元版一致と排他は保存Ownerが担当する。
 */
export function classifyCoordinatorResourcePublication(
  currentBytes: unknown,
  pendingBytes: unknown,
  recoveryId: unknown,
  repositoryBinding: unknown,
): "publish_pending" | "remove_pending" | null {
  try {
    if (!Buffer.isBuffer(currentBytes) || !Buffer.isBuffer(pendingBytes))
      return null;
    const current = decodeCoordinatorStateSnapshot(
      currentBytes,
      repositoryBinding,
    );
    const pending = decodeCoordinatorStateSnapshot(
      pendingBytes,
      repositoryBinding,
    );
    if (
      !current ||
      !pending ||
      !currentBytes.equals(
        Buffer.from(`${encodeRuntimeStateValue(current.snapshot)}\n`),
      ) ||
      !pendingBytes.equals(
        Buffer.from(`${encodeRuntimeStateValue(pending.snapshot)}\n`),
      )
    )
      return null;
    const prior = current.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const next = pending.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    if (!prior || !next || prior.identityJson !== next.identityJson)
      return null;
    if (currentBytes.equals(pendingBytes)) return "remove_pending";
    const changed = next.resources.filter(
      (resource, index) =>
        encodeRuntimeStateValue(resource) !==
        encodeRuntimeStateValue(prior.resources[index]),
    );
    const resource = changed[0];
    const previous = prior.resources.find(
      (item) => item.purpose === resource?.purpose,
    );
    if (
      changed.length !== 1 ||
      !resource ||
      previous?.request !== "intent_saved" ||
      resource.request !== "identified" ||
      resource.receiptSource !== "docker_create_result" ||
      resource.dockerId === null
    )
      return null;
    const derived = prepareCoordinatorStateResourceSnapshot(
      currentBytes,
      recoveryId,
      resource,
      repositoryBinding,
    );
    return derived?.equals(pendingBytes) ? "publish_pending" : null;
  } catch {
    return null;
  }
}

/**
 * 通常更新と用途限定の修復再入場を共通の全状態検査へ通す。
 * @responsibility 再入場対象だけ専用技術遷移を使い、他の保全条件を維持する。
 * @trace ARCH-000008
 * @input currentBytes: 元版、nextBytes: 候補、repositoryBinding: 結合、repairSessionId: 専用対象またはnull。
 * @returns 全状態と遷移が共同成立する場合だけtrue。
 * @precondition 専用呼出し側が再導出した完全候補を照合する。
 * @postcondition 通常入口ではcleanup巻戻しを許可しない。
 * @effect N/A: メモリ内の値検査だけ。
 * @failure 不正値・別対象・不正遷移はfalse。
 * @invariant Task、他修復、一次失敗と確定結果を保全する。
 * @boundary 保存値の検査。実Native取得や保存とは別。
 * @security trueを実処置Authorityへ昇格しない。
 * @concurrency N/A: 物理排他はWriterが所有。
 */
function validateCoordinatorStateTransitionValue(
  currentBytes: unknown,
  nextBytes: unknown,
  repositoryBinding: unknown,
  repairSessionId: string | null,
): boolean {
  try {
    const next = decodeCoordinatorStateSnapshot(nextBytes, repositoryBinding);
    const current =
      currentBytes === null
        ? null
        : decodeCoordinatorStateSnapshot(currentBytes, repositoryBinding);
    if (!next || (currentBytes !== null && !current)) return false;
    if (current) {
      const expectedProjects = associateCoordinatorTaskOperations(
        current.snapshot,
        next.snapshot.operations,
      );
      const businessKeys = [
        "repositoryBindingId",
        "intakeEpoch",
        "intakeBindings",
        "queueEntries",
        "workspaces",
        "leaseEvidence",
        "leaseIntents",
        "results",
        "historyPending",
        "acceptanceDecisions",
        "decisionRecoveries",
        "resultReceipts",
      ] as const;
      if (
        businessKeys.some(
          (key) =>
            encodeRuntimeStateValue(current.snapshot[key]) !==
            encodeRuntimeStateValue(next.snapshot[key]),
        ) ||
        encodeRuntimeStateValue(expectedProjects) !==
          encodeRuntimeStateValue(next.snapshot.projects)
      )
        return false;
    } else if (
      next.snapshot.repositoryBindingId !== null ||
      next.snapshot.projects.length !== 0 ||
      next.snapshot.resultReceipts.length !== 0
    )
      return false;
    if (!current) {
      if (next.snapshot.revision !== 1 || next.snapshot.previous !== null)
        return false;
    } else if (
      next.snapshot.revision !== current.snapshot.revision + 1 ||
      next.snapshot.previous?.revision !== current.snapshot.revision ||
      next.snapshot.previous.payloadSha256 !== current.payloadSha256
    )
      return false;
    return validateCoordinatorOperationTransitions(
      current,
      next,
      repairSessionId,
    );
  } catch {
    return false;
  }
}

const EMPTY_COORDINATOR_TASK_SECTIONS = {
  repositoryBindingId: null,
  intakeEpoch: null,
  intakeBindings: [],
  projects: [],
  queueEntries: [],
  workspaces: [],
  leaseEvidence: [],
  leaseIntents: [],
  results: [],
  historyPending: [],
  acceptanceDecisions: [],
  decisionRecoveries: [],
  resultReceipts: [],
} as const;
