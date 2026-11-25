/**
 * 資源記録のイベント適用と遷移検査を純粋な値操作として所有する。
 * @responsibility Intent・Receipt・観測の相関を検証し、保存や実資源操作を行わない。
 * @trace ARCH-000008
 */

import type { ExecutionStateSnapshot } from "../composition/types.ts";
import { createHash } from "node:crypto";
import {
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
} from "../composition/validation.ts";
import type { ExecutionOperationRecord, OperationResources } from "./types.ts";
import {
  areTaskResourcesSettled,
  decodeDockerRestartCheckpoint,
  decodeEnvironmentRepairCheckpoint,
  decodeEnvironmentRepairDisposalCheckpoint,
  decodeHostOperation,
  indexOperationHosts,
  operationNonce,
  prepareEnvironmentRepairSessionCheckpoint,
  REPAIR_ACTIONS,
  REPAIR_DIRECTORIES,
  validateResourceBook,
  validateResourceBookTransition,
} from "./validation.ts";

/**
 * 初期Snapshotと最初のIntent、又は同じ資源の後続観測を適用する。
 * @responsibility 通知の保存断面だけを扱い、ID欠測や成功から未発行を推測しない。
 * @trace ARCH-000008
 * @input previous: 元資源記録。value: 発行前・Receipt・発見・正式未発行のイベント。
 * @returns 検査済み次値、又はnull。nullは更新拒否であり不存在ではない。
 * @effect N/A: 値変換だけ。
 */
export function applyResourceEvent(
  previous: OperationResources | null,
  value: unknown,
): OperationResources | null {
  try {
    const event = JSON.parse(encodeStateValue(value));
    if (
      !validateResourceBook(previous) ||
      typeof event.key !== "string" ||
      !["submission", "receipt", "identified", "not_issued"].includes(
        event.event,
      ) ||
      !hasExecutionStateRecordKeys(
        event,
        event.event === "not_issued"
          ? ["event", "key"]
          : ["event", "key", "snapshot", "cleanup"],
      )
    )
      return null;
    if (!previous && event.event !== "submission") return null;
    const snapshot =
      event.event === "not_issued" ? previous?.snapshot : event.snapshot;
    const cleanup =
      event.event === "not_issued" ? previous?.cleanup : event.cleanup;
    if (!snapshot || !Array.isArray(snapshot.resources)) return null;
    const checkpoints =
      previous?.checkpoints ??
      snapshot.resources.map((item: { key: string }) => ({
        key: item.key,
        submission: "none",
        receiptSource: null,
        observation: "unobserved",
        absenceEvidenceSha256: null,
      }));
    const prior = checkpoints.find(
      (item: { key: string }) => item.key === event.key,
    );
    const resource = snapshot.resources.find(
      (item: { key: string }) => item.key === event.key,
    );
    if (!prior || !resource) return null;
    let checkpoint: OperationResources["checkpoints"][number];
    if (event.event === "submission") {
      if (prior.submission !== "none" || resource.identity.dockerId !== null)
        return null;
      checkpoint = { ...prior, submission: "intent_saved" };
    } else if (event.event === "not_issued") {
      if (
        prior.submission !== "intent_saved" ||
        resource.identity.dockerId !== null ||
        resource.request !== "not_issued"
      )
        return null;
      checkpoint = { ...prior, submission: "not_issued" };
    } else {
      if (
        prior.submission !== "intent_saved" ||
        !isSha256Hex(resource.identity.dockerId)
      )
        return null;
      checkpoint = {
        ...prior,
        receiptSource:
          event.event === "receipt"
            ? "docker_create_result"
            : "docker_observation",
        observation:
          event.event === "identified" ? "present" : prior.observation,
        absenceEvidenceSha256: null,
      };
    }
    const book = {
      snapshot,
      cleanup,
      checkpoints: checkpoints.map((item: { key: string }) =>
        item.key === event.key ? checkpoint : item,
      ),
    };
    return validateResourceBookTransition(previous, book) ? book : null;
  } catch {
    return null;
  }
}

/**
 * 元Snapshotとkey別の終了観測を同じ記録へ結合する。
 * @responsibility 観測の相関だけを保存値にし、物理的不存在の観測を実行しない。
 * @trace ARCH-000008
 * @input previous: 元記録。snapshotValue・observationsValue: 同じ技術Ownerの元結果。evidence: 元版と回復参照。
 * @returns 次の資源記録、又は相関不成立のnull。
 * @effect N/A: 値と相関Hashの構築だけ。
 * @invariant IDの差替えを拒否するが現在構成の更新は許可する。
 */
export function applyResourceCleanup(
  previous: OperationResources,
  snapshotValue: unknown,
  observationsValue: unknown,
  evidence: Readonly<{ recoveryId: string; previousPayloadSha256: string }>,
): OperationResources | null {
  try {
    const snapshot = JSON.parse(
      encodeStateValue(snapshotValue),
    ) as OperationResources["snapshot"];
    const observations = JSON.parse(encodeStateValue(observationsValue));
    if (
      !validateResourceBook(previous) ||
      !snapshot ||
      !Array.isArray(snapshot.resources) ||
      !Array.isArray(observations) ||
      observations.length !== previous.checkpoints.length ||
      new Set(observations.map((item: { key: unknown }) => item.key)).size !==
        previous.checkpoints.length
    )
      return null;
    const checkpoints = previous.checkpoints.map((checkpoint) => {
      const observed = observations.find(
        (item: { key: unknown }) => item.key === checkpoint.key,
      );
      const resource = snapshot.resources.find(
        (item) => item.key === checkpoint.key,
      );
      if (
        !hasExecutionStateRecordKeys(observed, ["key", "observation"]) ||
        !resource ||
        !["not_requested", "absent", "unknown"].includes(observed.observation)
      )
        throw Error("resource_observation_invalid");
      const original = previous.snapshot.resources.find(
        (item) => item.key === checkpoint.key,
      );
      if (
        !original ||
        original.identity.dockerId !== resource.identity.dockerId
      )
        throw Error("resource_receipt_required");
      if (observed.observation === "not_requested") {
        if (
          resource.identity.dockerId !== null ||
          resource.request !== "not_issued" ||
          checkpoint.submission === "intent_saved"
        )
          throw Error("resource_observation_invalid");
        return checkpoint;
      }
      if (checkpoint.submission !== "intent_saved")
        throw Error("resource_observation_invalid");
      return {
        ...checkpoint,
        receiptSource: checkpoint.receiptSource,
        observation: observed.observation,
        absenceEvidenceSha256:
          observed.observation === "absent"
            ? checkpoint.observation === "absent" &&
              checkpoint.absenceEvidenceSha256 !== null
              ? checkpoint.absenceEvidenceSha256
              : createHash("sha256")
                  .update(
                    encodeStateValue({
                      ...evidence,
                      observation: observed,
                    }),
                  )
                  .digest("hex")
            : null,
      };
    });
    const book = { ...previous, snapshot, checkpoints };
    return validateResourceBookTransition(previous, book) ? book : null;
  } catch {
    return null;
  }
}

/** 同じ資源記録を保存する前に、未受領の不存在観測を識別する。 @trace ARCH-000008 */
export function hasAuthenticationUnknownAbsence(
  snapshot: ExecutionStateSnapshot,
): boolean {
  return snapshot.operations.some(
    (operation) =>
      operation.kind === "docker_task" &&
      (operation.resources?.checkpoints ?? []).some(
        isAuthenticationUnknownAbsence,
      ),
  );
}

function isAuthenticationUnknownAbsence(
  resource: OperationResources["checkpoints"][number],
): boolean {
  return (
    resource.submission === "intent_saved" &&
    resource.receiptSource === null &&
    resource.observation === "absent"
  );
}

/**
 * 新しい認証unknown不存在の生成・変更を一般保存から識別する。
 * @responsibility 保存済み専用値の同値保全と新しい終了辺を区別する。
 * @trace ARCH-000008
 * @input before、after: 復号済み元Snapshotと保存候補。
 * @returns 専用Contextを要する資源差分があればtrue。
 * @precondition 両Snapshotは現在codecで検査済み。
 * @postcondition 操作除去や同値保全を新しい不存在観測に数えない。
 * @effect N/A: 同期値比較だけ。
 * @failure 元操作・元資源欠落は新しい辺として拒否対象にする。
 * @invariant 複合更新でも資源差分の検査を省略しない。
 * @boundary 一般Writerと専用の一回保存Context。
 * @security 保存値・Hashだけから専用保存を許可しない。
 * @concurrency 保存排他の外側と内側で同じ差分を確認する。
 */
export function authenticationUnknownAbsenceChanged(
  before: ExecutionStateSnapshot | null,
  after: ExecutionStateSnapshot,
): boolean {
  return after.operations.some(
    (operation) =>
      operation.kind === "docker_task" &&
      (operation.resources?.checkpoints ?? []).some((resource) => {
        if (!isAuthenticationUnknownAbsence(resource)) return false;
        const previous = before?.operations.find(
          (item) =>
            item.kind === "docker_task" &&
            item.recoveryId === operation.recoveryId,
        );
        const priorResource =
          previous?.kind === "docker_task"
            ? previous.resources?.checkpoints.find(
                (item) => item.key === resource.key,
              )
            : null;
        return (
          !priorResource ||
          encodeStateValue(priorResource) !== encodeStateValue(resource)
        );
      }),
  );
}

/**
 * 一用途だけの回収進捗で既知事実の巻戻しを拒否する。
 * @responsibility 意図前の発行・観測飛越しと確定後の追加要求を防ぐ。
 * @trace ARCH-000008
 * @input beforeValue、afterValue: 前後値、purpose: 更新する固定用途。
 * @returns 正規な同値または単調な一用途遷移だけtrue。
 * @precondition 実Driverは各要求前にfreshな実体・Scope・非使用・Ownerを確認する。
 * @postcondition 他用途と過去の要求不明を保全する。
 * @effect N/A: 純粋な値比較だけ。
 * @failure 不正用途・飛越し・巻戻し・確定後変更はfalse。
 * @invariant 過去の観測不明だけで将来のfresh確認に基づく要求を永久拒否しない。
 * @boundary 値遷移だけ。保存前要求0と真正観測は後続Driver／Writerの責務。
 * @security trueは削除許可ではない。同値候補のWriterはno-op／Effect 0とする。
 * @concurrency N/A: 元版CAS・排他・実観測は外側で確認する。
 */
export function validateEnvironmentRepairDisposalTransition(
  beforeValue: unknown,
  afterValue: unknown,
  purpose: unknown,
): boolean {
  const before = decodeEnvironmentRepairDisposalCheckpoint(beforeValue);
  const after = decodeEnvironmentRepairDisposalCheckpoint(afterValue);
  if (
    !before ||
    !after ||
    !REPAIR_DIRECTORIES.includes(purpose as (typeof REPAIR_DIRECTORIES)[number])
  )
    return false;
  for (const key of REPAIR_DIRECTORIES) {
    const a = before.directories[key];
    const b = after.directories[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (key !== purpose || b.intent !== "saved") return false;
    if (a.intent === "not_saved") {
      if (b.request !== "not_issued" || b.absence !== "unobserved")
        return false;
      continue;
    }
    if (
      a.absence === "confirmed_absent" ||
      (a.request !== "not_issued" && a.request !== b.request) ||
      (a.absence === "unknown" && b.absence === "unobserved")
    )
      return false;
  }
  return true;
}

/**
 * fresh準備の一変更だけを通常checkpointと別に検査する。
 * @responsibility 同じ補助子内の巻戻しと新しい補助子の準備を混同しない。
 * @trace ARCH-000008
 * @input beforeValue: 前呼出しの回収済み状態、afterValue: 新準備候補。
 * @returns 下位が再導出した完全候補と一致する場合だけtrue。
 * @precondition 上位がfresh準備の用途と現在Ownerを照合する。
 * @postcondition 通常遷移の許可集合を拡大しない。
 * @effect N/A: 純粋な値検査だけ。
 * @failure 余剰・欠測・別技術値・不正前状態はfalse。
 * @invariant cleanup以外の変更を一つも許さない。
 * @boundary 新Session準備の値契約。
 * @security trueは実補助子の取得や現在許可を証明しない。
 * @concurrency N/A: 共有状態なし。
 */
export function validateEnvironmentRepairSessionCheckpoint(
  beforeValue: unknown,
  afterValue: unknown,
): boolean {
  const expected = prepareEnvironmentRepairSessionCheckpoint(beforeValue);
  const after = decodeEnvironmentRepairCheckpoint(afterValue);
  return (
    expected !== null &&
    after !== null &&
    JSON.stringify(expected) === JSON.stringify(after)
  );
}

/**
 * 同じ技術操作のcheckpoint間で既知事実と処置順序を保持する。
 * @responsibility unknown・発行済み・確定済みの巻戻しと実体置換を拒否する。
 * @trace ARCH-000008
 * @input beforeValue、afterValue: 前後の技術checkpoint。
 * @returns 両値が妥当で有限遷移を守る場合だけtrue。
 * @precondition 保存Ownerが元版・exact操作を別に照合する。
 * @postcondition 技術値の検査から別操作・人間判断へ拡張しない。
 * @effect N/A: 値の比較のみ。
 * @failure 不正値・飛越・巻戻し・実体差はfalse。
 * @invariant 回収成功の後着で最初の回収失敗を消さない。
 * @boundary Machineの局所遷移と保存Ownerの元版検査。
 * @security trueは実処置や現在許可を保証しない。
 * @concurrency N/A: 共有状態なし。
 */
export function validateEnvironmentRepairCheckpointTransition(
  beforeValue: unknown,
  afterValue: unknown,
): boolean {
  const before = decodeEnvironmentRepairCheckpoint(beforeValue);
  const after = decodeEnvironmentRepairCheckpoint(afterValue);
  if (!before || !after) return false;
  for (const key of REPAIR_ACTIONS) {
    const a = before.actions[key];
    const b = after.actions[key];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    const transition = `${a.intent}:${a.request}:${a.result}>${b.intent}:${b.request}:${b.result}`;
    if (
      ![
        "not_saved:not_issued:unobserved>not_saved:not_issued:not_required",
        "not_saved:not_issued:unobserved>saved:not_issued:unobserved",
        "saved:not_issued:unobserved>saved:not_issued:not_required",
        "saved:not_issued:unobserved>saved:issued:unobserved",
        "saved:not_issued:unobserved>saved:unknown:unknown",
        "saved:issued:unobserved>saved:issued:confirmed",
        "saved:issued:unobserved>saved:issued:unknown",
      ].includes(transition)
    )
      return false;
  }
  for (const key of REPAIR_DIRECTORIES) {
    const a = before.directories[key];
    const b = after.directories[key];
    if (
      a.expected !== null &&
      JSON.stringify(a.expected) !== JSON.stringify(b.expected)
    )
      return false;
    if (
      a.retained.state === "present" &&
      JSON.stringify(a.retained) !== JSON.stringify(b.retained)
    )
      return false;
  }
  if (
    before.cleanupFailure !== null &&
    after.cleanupFailure !== before.cleanupFailure
  )
    return false;
  const cleanupTransitions = {
    not_requested: ["not_requested", "pending", "confirmed", "unknown"],
    pending: ["pending", "confirmed", "unknown"],
    unknown: ["unknown", "confirmed"],
    confirmed: ["confirmed"],
  };
  if (!cleanupTransitions[before.cleanup].includes(after.cleanup)) return false;
  if (before.stale === "retained" && after.stale !== "retained") return false;
  return true;
}

/**
 * 一操作のHost IntentからReceipt・回収候補への単調な更新を検査する。
 * @responsibility IDと用途の差替え、Receipt喪失、終端の再開を拒否する。
 * @trace ARCH-000008
 * @boundary 値の遷移だけで物理削除・再実行を許可しない。
 */
export function validHostOperationTransition(
  before: unknown,
  after: unknown,
): boolean {
  const next = decodeHostOperation(after);
  if (!next) return false;
  if (before === null)
    return (
      next.phase === "preparing" &&
      next.rootIdentity === null &&
      Object.keys(next.childIdentities).length === 0 &&
      next.resources === null &&
      next.cleanup === "not_requested"
    );
  const prior = decodeHostOperation(before);
  if (!prior) return false;
  if (prior.git && (!next.git || next.git.length < prior.git.length))
    return false;
  if (
    (next.git?.length ?? 0) > (prior.git?.length ?? 0) &&
    (prior.phase !== "active" ||
      prior.cleanup !== "not_requested" ||
      next.git?.length !== (prior.git?.length ?? 0) + 1 ||
      next.git.at(-1)?.commitId !== null ||
      next.git.at(-1)?.temporary !== null ||
      next.git.at(-1)?.request !== "not_issued" ||
      next.git.at(-1)?.cleanup !== "pending")
  )
    return false;
  for (let index = 0; index < (prior.git?.length ?? 0); index++) {
    const old = prior.git?.[index],
      current = next.git?.[index];
    if (
      !old ||
      !current ||
      old.name !== current.name ||
      (old.commitId !== null && old.commitId !== current.commitId) ||
      (old.temporary !== null &&
        encodeStateValue(old.temporary) !==
          encodeStateValue(current.temporary)) ||
      (old.request !== "not_issued" && current.request === "not_issued") ||
      (old.request === "confirmed" && current.request !== "confirmed") ||
      (old.cleanup === "confirmed" &&
        encodeStateValue(old) !== encodeStateValue(current))
    )
      return false;
  }
  const priorResource = prior.resources?.snapshot.resources[0];
  const nextResource = next.resources?.snapshot.resources[0];
  if (
    priorResource &&
    priorResource.request !== "not_issued" &&
    nextResource?.request === "not_issued"
  )
    return false;
  return (
    prior.operationId === next.operationId &&
    prior.purpose === next.purpose &&
    prior.createdAt === next.createdAt &&
    validateResourceBookTransition(prior.resources, next.resources) &&
    !(
      prior.phase === "terminal" &&
      encodeStateValue(prior) !== encodeStateValue(next)
    ) &&
    !(prior.phase === "active" && next.phase === "preparing") &&
    (prior.rootIdentity === null ||
      encodeStateValue(prior.rootIdentity) ===
        encodeStateValue(next.rootIdentity)) &&
    Object.entries(prior.childIdentities).every(
      ([name, identity]) =>
        Object.hasOwn(next.childIdentities, name) &&
        encodeStateValue(identity) ===
          encodeStateValue(
            next.childIdentities[name as keyof typeof next.childIdentities],
          ),
    ) &&
    !(prior.cleanup !== "not_requested" && next.cleanup === "not_requested")
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
export function validateOperationTransitions(
  current: Readonly<{ snapshot: ExecutionStateSnapshot }> | null,
  next: Readonly<{ snapshot: ExecutionStateSnapshot }>,
  repairSessionId: string | null,
): boolean {
  try {
    const priorOperations = new Map(
      (current?.snapshot.operations ?? []).map((operation) => [
        operationNonce(operation),
        operation,
      ]),
    );
    const priorTasksByRecoveryId = new Map<string, ExecutionOperationRecord>();
    for (const operation of current?.snapshot.operations ?? [])
      if (
        operation.kind === "docker_task" &&
        !priorTasksByRecoveryId.has(operation.recoveryId)
      )
        priorTasksByRecoveryId.set(operation.recoveryId, operation);
    const nextObligationsByNonce = new Map(
      next.snapshot.unresolvedRecoveries.map((record) => [
        record.operationNonce,
        record,
      ]),
    );
    let peersByHome: Map<string, ExecutionOperationRecord[]> | undefined;
    let hosts: ReturnType<typeof indexOperationHosts> | undefined;
    let recoveryIds: Set<string> | undefined;
    const phases = ["executing", "settling", "terminal"];
    for (const operation of next.snapshot.operations) {
      const nonce = operationNonce(operation);
      const prior = priorOperations.get(nonce);
      if (operation.kind === "host_operation") {
        if (!validHostOperationTransition(prior ?? null, operation))
          return false;
        priorOperations.delete(nonce);
        continue;
      }
      if (operation.kind === "docker_repair") {
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
            prior.kind !== "docker_repair" ||
            operation.identityJson !== prior.identityJson ||
            operation.identitySha256 !== prior.identitySha256 ||
            operation.recoveryId !== prior.recoveryId
          )
            return false;
          // 回収進捗は専用の完全再導出だけ。通常保存で判断・技術値を更新しない。
          if (
            encodeStateValue(operation.retention ?? null) !==
              encodeStateValue(prior.retention ?? null) ||
            encodeStateValue(operation.disposal) !==
              encodeStateValue(prior.disposal) ||
            (prior.disposal !== null &&
              encodeStateValue({
                ...operation,
                summarySha256: null,
                history: null,
              }) !==
                encodeStateValue({
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
              (prior.phase === "settling" && operation.phase === "terminal")
            )
          )
            return false;
          if (
            prior.checkpoint !== null
              ? !(operation.recoveryId === repairSessionId
                  ? validateEnvironmentRepairSessionCheckpoint(
                      prior.checkpoint,
                      operation.checkpoint,
                    )
                  : validateEnvironmentRepairCheckpointTransition(
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
            encodeStateValue(prior.primaryFailure) !==
              encodeStateValue(operation.primaryFailure)
          )
            return false;
          if (
            prior.outcome !== null &&
            (operation.outcome === null ||
              encodeStateValue(operation.primaryFailure) !==
                encodeStateValue(prior.primaryFailure) ||
              encodeStateValue(operation.checkpoint?.actions ?? null) !==
                encodeStateValue(prior.checkpoint?.actions ?? null) ||
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
            encodeStateValue({
              ...prior,
              summarySha256: null,
              history: null,
            }) !==
              encodeStateValue({
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
        if (!peersByHome) {
          if (
            next.snapshot.operations.some(
              (other) =>
                other.kind === "docker_repair" && other.phase !== "terminal",
            )
          )
            return false;
          peersByHome = new Map();
          for (const other of next.snapshot.operations) {
            if (other.kind !== "docker_task") continue;
            const home = JSON.parse(
              other.identityJson,
            ).stableLogicalHomeBindingHash;
            const peers = peersByHome.get(home);
            if (peers) peers.push(other);
            else peersByHome.set(home, [other]);
          }
        }
        hosts ??= indexOperationHosts(next.snapshot.operations);
        recoveryIds ??= new Set(
          [
            ...(current?.snapshot.unresolvedRecoveries ?? []),
            ...next.snapshot.unresolvedRecoveries,
          ].map((record) => record.recoveryId),
        );
        const nextHost = hosts.get(identity.operationId);
        // 新操作だけを制約する。旧競合Snapshotの読取り・回収を不能にしない。
        if (
          peersByHome
            .get(identity.stableLogicalHomeBindingHash)
            ?.some((other) => {
              if (other.recoveryId === operation.recoveryId) return false;
              const before = priorTasksByRecoveryId.get(other.recoveryId);
              if (!before) return true;
              const previousIdentity = JSON.parse(before.identityJson);
              // 同一Hostの正常技術終端は、物理Host清掃を二重に要求しない。
              // marker実体は状態遷移ごとに置換されるため、その同一性は比較しない。
              const sameHostContinuation =
                previousIdentity.operationId === identity.operationId &&
                previousIdentity.recoveryCorrelationId ===
                  identity.recoveryCorrelationId &&
                encodeStateValue(before) === encodeStateValue(other);
              // 同じ更新内の終端偽装や、二つの新規開始を受理しない。
              return (
                [before, other].some((value) => {
                  const host = hosts?.get(
                    value === before
                      ? previousIdentity.operationId
                      : JSON.parse(value.identityJson).operationId,
                  );
                  const hostCleanupComplete =
                    value.phase !== "executing" &&
                    value.outcome?.cleanupConfirmed === true &&
                    host?.cleanup === "confirmed";
                  const hostCleanupDeferred =
                    sameHostContinuation &&
                    value.phase === "settling" &&
                    value.outcome === null &&
                    value.primaryFailure === null &&
                    value.summarySha256 === null &&
                    value.history === null &&
                    value.dockerRestart === null &&
                    value.execution.workspaceReusable === false &&
                    host?.cleanup === "not_requested";
                  return (
                    !(hostCleanupComplete || hostCleanupDeferred) ||
                    value.lease !== "released" ||
                    value.execution.ownerEffect !== "disabled" ||
                    // 過去Effectの不確実性は、同Hostの正常技術終端を取り消さない。
                    // 新stageのAuthorityは開始保存前の既存実行入口が確認する。
                    (!hostCleanupDeferred &&
                      (value.execution.providerStart === "unknown" ||
                        value.execution.externalSend === "unknown" ||
                        value.execution.sharedWrite === "unknown")) ||
                    !areTaskResourcesSettled(value)
                  );
                }) || recoveryIds?.has(other.recoveryId) === true
              );
            })
        )
          return false;
        if (
          operation.phase !== "executing" ||
          operation.resources !== null ||
          nextHost?.phase !== "active" ||
          nextHost?.cleanup !== "not_requested" ||
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
        encodeStateValue(operation.resources) !==
          encodeStateValue(prior.resources)
      )
        return false;
      if (
        prior.dockerRestart !== null &&
        operation.resources?.checkpoints.some(
          (checkpoint) =>
            checkpoint.submission === "intent_saved" &&
            prior.resources?.checkpoints.find(
              (before) => before.key === checkpoint.key,
            )?.submission !== "intent_saved",
        )
      )
        return false;
      if (!validateResourceBookTransition(prior.resources, operation.resources))
        return false;
      if (
        prior.primaryFailure !== null &&
        encodeStateValue(operation.primaryFailure) !==
          encodeStateValue(prior.primaryFailure)
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
    }
    if (priorOperations.size !== 0) return false;
    for (const before of current?.snapshot.unresolvedRecoveries ?? []) {
      const after = nextObligationsByNonce.get(before.operationNonce);
      if (
        !after ||
        after.recoveryId !== before.recoveryId ||
        before.obligations.some(
          (obligation) => !after.obligations.includes(obligation),
        )
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 一度だけの要求と単調な結果・回収更新を検査する。
 * @responsibility 要求置換、terminal書換え、未知値の未発行化を拒否する。
 * @trace ARCH-000008
 * @input beforeValue、afterValue: 元版と次版の単一checkpoint。
 * @returns 許可された構造的な遷移だけtrue。
 * @precondition 同じOwnerの受付観測とfresh権限は保存利用側が別に確認する。
 * @postcondition blocked後は結果不変で回収だけ進行できる。
 * @effect N/A: 値の比較だけ。
 * @failure 不正構造・別要求・逆行・二度目の要求はfalse。
 * @invariant trueは再発行許可、回収実証やWriter成功ではない。
 * @boundary 元保存値と次版候補。
 * @security 保存から生Ownerを復元しない。
 * @concurrency N/A: 元版照合と排他はWriterが所有する。
 */
export function validateDockerRestartCheckpointTransition(
  beforeValue: unknown,
  afterValue: unknown,
): boolean {
  if (beforeValue === null && afterValue === null) return true;
  const after = decodeDockerRestartCheckpoint(afterValue);
  if (!after) return false;
  if (beforeValue === null)
    return (
      after.request === "not_issued" &&
      after.cleanup === "not_required" &&
      after.result === null
    );
  const before = decodeDockerRestartCheckpoint(beforeValue);
  if (
    !before ||
    before.requestId !== after.requestId ||
    before.scopeSha256 !== after.scopeSha256 ||
    (before.result !== null &&
      (after.result?.status !== before.result.status ||
        after.result.reason !== before.result.reason ||
        after.result.request !== before.result.request ||
        after.result.effectOutcomeUnknown !==
          before.result.effectOutcomeUnknown ||
        after.request !== before.request))
  )
    return false;
  if (
    before.request !== after.request &&
    ![
      "not_issued:unknown",
      "unknown:issued",
      "unknown:confirmed",
      "issued:confirmed",
    ].includes(`${before.request}:${after.request}`)
  )
    return false;
  return (
    before.cleanup === after.cleanup ||
    ["not_required:pending", "pending:confirmed", "pending:unknown"].includes(
      `${before.cleanup}:${after.cleanup}`,
    )
  );
}
