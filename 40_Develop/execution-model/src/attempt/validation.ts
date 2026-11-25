/**
 * Attemptの資源記録・回復結果の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  matchesOperationHistory,
  repairSummaryBytes,
} from "../history/records.ts";
import type { ExecutionStateSnapshot } from "../composition/types.ts";
import {
  encodeStateValue,
  hasExecutionStateRecordKeys,
  isSha256Hex,
  snapshotStateRecord,
} from "../composition/validation.ts";
import { inspectExecutionSelection } from "../task/validation.ts";
import type {
  DirectoryIdentity,
  DirectoryObservation,
  ExecutionOperationRecord,
  HostOperationRecord,
  OperationRecord,
  OperationResources,
  OperationState,
  RepairAction,
  RepairCheckpoint,
  RepairDisposalCheckpoint,
  RepairOperationRecord,
  RepairRetentionReceipt,
  RepairRetentionTargets,
  RestartCheckpoint,
} from "./types.ts";
import { dockerProcessControllerPublicCompletionReasons } from "./types.ts";

/** 元操作IDに属する唯一のHost保存記録を同じStateから取得する。 @trace ARCH-000008 */
export function readOperationHost(
  operations: readonly OperationRecord[],
  operation: ExecutionOperationRecord,
): HostOperationRecord | null {
  const operationId = JSON.parse(operation.identityJson).operationId;
  const hosts = operations.filter(
    (item): item is HostOperationRecord =>
      item.kind === "host_operation" && item.operationId === operationId,
  );
  return hosts.length === 1 ? (hosts[0] ?? null) : null;
}

/** 一つの状態内のHostを識別子で引く。重複は唯一のHostとみなさない。 @trace ARCH-000008 */
export function indexOperationHosts(operations: readonly OperationRecord[]) {
  const hosts = new Map<string, HostOperationRecord | null>();
  for (const operation of operations)
    if (operation.kind === "host_operation")
      hosts.set(
        operation.operationId,
        hosts.has(operation.operationId) ? null : operation,
      );
  return hosts;
}

/**
 * 有限な修復checkpointを独立した凍結DTOへ復号する。
 * @responsibility 意図・発行・結果・8処置順序と退避実体を共同検証する。
 * @trace ARCH-000008
 * @input value: 未信頼の技術checkpoint。
 * @returns 完全な固定DTO、またはnull。
 * @precondition N/A: 任意値を拒否可能。
 * @postcondition 省略・余剰・人間判断fieldを受理しない。
 * @effect N/A: 値検査だけ。Process・Filesystemは使わない。
 * @failure 不正構造、順序飛越、不整合な完了はnull。
 * @invariant 成功は処置・排他・資源不存在の証明ではない。
 * @boundary 下位技術状態と保存Owner。
 * @security Path、秘密、Task Authorityを取り込まない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function decodeEnvironmentRepairCheckpoint(
  value: unknown,
): RepairCheckpoint | null {
  const record = capture(value, [
    "actions",
    "directories",
    "engine",
    "stale",
    "hostSafety",
    "cleanup",
    "cleanupFailure",
  ]);
  if (!record) return null;
  const actionValues = capture(record.actions, REPAIR_ACTIONS);
  const directoryValues = capture(record.directories, REPAIR_DIRECTORIES);
  if (
    !actionValues ||
    !directoryValues ||
    !["unobserved", "ready", "unavailable", "unknown"].includes(
      record.engine as string,
    ) ||
    !["absent", "retained", "unknown"].includes(record.stale as string) ||
    !["safe", "manual_recovery_required", "unknown"].includes(
      record.hostSafety as string,
    ) ||
    !["not_requested", "pending", "confirmed", "unknown"].includes(
      record.cleanup as string,
    ) ||
    ![
      null,
      "operation_cleanup_unknown",
      "observation_cleanup_unknown",
    ].includes(record.cleanupFailure as null | string)
  )
    return null;
  if (
    record.cleanupFailure === "observation_cleanup_unknown" &&
    record.cleanup !== "unknown"
  )
    return null;
  if (
    record.cleanupFailure !== null &&
    record.cleanup !== "unknown" &&
    record.cleanup !== "confirmed"
  )
    return null;
  const capturedActions = {} as Record<
    (typeof REPAIR_ACTIONS)[number],
    RepairAction
  >;
  for (const [index, key] of REPAIR_ACTIONS.entries()) {
    const action = capture(actionValues[key], ["intent", "request", "result"]);
    if (
      !action ||
      !["not_saved", "saved"].includes(action.intent as string) ||
      !["not_issued", "issued", "unknown"].includes(action.request as string) ||
      !["unobserved", "not_required", "confirmed", "unknown"].includes(
        action.result as string,
      )
    )
      return null;
    if (
      action.intent === "not_saved" &&
      (action.request !== "not_issued" ||
        !["unobserved", "not_required"].includes(action.result as string))
    )
      return null;
    if (
      action.request === "unknown"
        ? action.result !== "unknown"
        : action.request === "not_issued"
          ? !["unobserved", "not_required"].includes(action.result as string)
          : action.intent !== "saved" || action.result === "not_required"
    )
      return null;
    // 明示不要の記録は新Effectを発行しない。意図保存・発行は前処置の確定後だけ。
    if (
      action.intent === "saved" &&
      !REPAIR_ACTIONS.slice(0, index).every((previous) =>
        settled(capturedActions[previous]),
      )
    )
      return null;
    capturedActions[key] = Object.freeze(action) as RepairAction;
  }
  const capturedDirectories = {} as Record<
    (typeof REPAIR_DIRECTORIES)[number],
    RepairCheckpoint["directories"]["primary"]
  >;
  for (const key of REPAIR_DIRECTORIES) {
    const pair = capture(directoryValues[key], [
      "expected",
      "source",
      "retained",
    ]);
    if (!pair) return null;
    const expected = pair.expected === null ? null : identity(pair.expected);
    const source = observation(pair.source);
    const retained = observation(pair.retained);
    if (!source || !retained || (pair.expected !== null && !expected))
      return null;
    for (const observed of [source, retained])
      if (
        observed.state === "present" &&
        JSON.stringify(observed.identity) !== JSON.stringify(expected)
      )
        return null;
    capturedDirectories[key] = Object.freeze({ expected, source, retained });
  }
  for (const [actionKey, purpose] of [
    ["retain_runtime", "primary"],
    ["retain_failed_runtime", "failed"],
    ["retain_auxiliary_runtime", "auxiliary"],
  ] as const) {
    const pair = capturedDirectories[purpose];
    if (
      capturedActions[actionKey].result === "confirmed" &&
      (!pair.expected ||
        pair.source.state !== "absent" ||
        pair.retained.state !== "present")
    )
      return null;
  }
  const retained = REPAIR_DIRECTORIES.some(
    (key) => capturedDirectories[key].retained.state === "present",
  );
  const absent = REPAIR_DIRECTORIES.every(
    (key) => capturedDirectories[key].retained.state === "absent",
  );
  if (record.stale !== (retained ? "retained" : absent ? "absent" : "unknown"))
    return null;
  return Object.freeze({
    actions: Object.freeze(capturedActions),
    directories: Object.freeze(capturedDirectories),
    engine: record.engine,
    stale: record.stale,
    hostSafety: record.hostSafety,
    cleanup: record.cleanup,
    cleanupFailure: record.cleanupFailure,
  }) as RepairCheckpoint;
}

/**
 * 回収進捗を閉じた三用途の独立コピーへ復号する。
 * @responsibility 未保存の意図と発行・観測済み値の混在を拒否する。
 * @trace ARCH-000008
 * @input value: 未信頼の回収進捗候補。
 * @returns 凍結した正規値、またはnull。
 * @precondition 実対象・元修復との相関は保存Ownerが別に確認する。
 * @postcondition 元値を保持せず、getter・Proxyを実行しない。
 * @effect N/A: メモリ内の値検査だけ。
 * @failure 欠測・余剰・未知値・不正組合せはnull。
 * @invariant 復号成功を物理回収・保存・現在許可へ昇格しない。
 * @boundary 後続回収値と上位の既存修復操作。
 * @security 任意Path・実行処理・旧形式を受け付けない。
 * @concurrency N/A: 同期の値捕捉だけ。
 */
export function decodeEnvironmentRepairDisposalCheckpoint(
  value: unknown,
): RepairDisposalCheckpoint | null {
  const record = capture(value, ["directories"]);
  const values = record
    ? capture(record.directories, REPAIR_DIRECTORIES)
    : null;
  if (!values) return null;
  const result = {} as Record<
    (typeof REPAIR_DIRECTORIES)[number],
    RepairDisposalCheckpoint["directories"]["primary"]
  >;
  for (const purpose of REPAIR_DIRECTORIES) {
    const item = capture(values[purpose], ["intent", "request", "absence"]);
    if (
      !item ||
      !["not_saved", "saved"].includes(item.intent as string) ||
      !["not_issued", "issued", "unknown"].includes(item.request as string) ||
      !["unobserved", "confirmed_absent", "unknown"].includes(
        item.absence as string,
      ) ||
      (item.intent === "not_saved" &&
        (item.request !== "not_issued" || item.absence !== "unobserved"))
    )
      return null;
    result[purpose] = Object.freeze({
      intent: item.intent as "not_saved" | "saved",
      request: item.request as "not_issued" | "issued" | "unknown",
      absence: item.absence as "unobserved" | "confirmed_absent" | "unknown",
    });
  }
  return Object.freeze({ directories: Object.freeze(result) });
}

/**
 * 三用途の保存意図と不存在確認が値上で揃ったかを検査する。
 * @responsibility 要求結果不明を残した終端と未確認を区別する。
 * @trace ARCH-000008
 * @input value: 後続回収進捗候補。
 * @returns 三用途ともsaved／confirmed_absentの場合だけtrue。
 * @precondition 実Driverのfresh観測・保存確定は別に必要。
 * @postcondition requestのunknownを消去しない。
 * @effect N/A: 純粋な値検査だけ。
 * @failure 不正値、一用途でも未確定ならfalse。
 * @invariant 元修復・Native cleanup・引渡し・Task入場の成功を判定しない。
 * @boundary 技術値の終端と上位の共同終了判定。
 * @security 保存値だけで実対象の現在不存在を証明しない。
 * @concurrency N/A: 共有状態なし。
 */
export function isRepairDisposalSettled(value: unknown): boolean {
  const checkpoint = decodeEnvironmentRepairDisposalCheckpoint(value);
  return (
    checkpoint !== null &&
    REPAIR_DIRECTORIES.every(
      (purpose) =>
        checkpoint.directories[purpose].intent === "saved" &&
        checkpoint.directories[purpose].absence === "confirmed_absent",
    )
  );
}

/**
 * 8処置が確認済みまたは明示不要であるかを検査する。
 * @responsibility 未観測を処置完了へ畳まず、技術処置の終端だけを返す。
 * @trace ARCH-000008
 * @input value: 保存または通知された技術checkpoint候補。
 * @returns 厳格復号後、全処置の結果が確定している場合だけtrue。
 * @precondition 実観測との結合は保存Ownerが別に確認する。
 * @postcondition Engine、安全性、清掃、人間判断の総合成功を判定しない。
 * @effect N/A: 純粋な値検査。
 * @failure 不正値、未観測、不明結果はfalse。
 * @invariant trueを実修復やAuthorityの証明にしない。
 * @boundary 下位技術処置の閉集合。
 * @security 任意操作や外部資源へ接続しない。
 * @concurrency N/A: 共有状態なし。
 */
export function isRepairCheckpointSettled(value: unknown): boolean {
  const checkpoint = decodeEnvironmentRepairCheckpoint(value);
  return (
    checkpoint !== null &&
    REPAIR_ACTIONS.every((key) => settled(checkpoint.actions[key]))
  );
}

export const REPAIR_ACTIONS = Object.freeze([
  "stop_runtime",
  "stop_backend",
  "retain_runtime",
  "start_runtime",
  "stop_failed_runtime",
  "retain_failed_runtime",
  "retain_auxiliary_runtime",
  "restart_runtime",
] as const);

export const REPAIR_DIRECTORIES = Object.freeze([
  "primary",
  "failed",
  "auxiliary",
] as const);

/**
 * plain dataの閉集合をgetterとProxyを実行せず一度捕捉する。
 * @responsibility 余剰・欠落・継承値を技術状態へ混ぜない。
 * @trace ARCH-000008
 * @input value: 未信頼値、keys: 内部固定key集合。
 * @returns 捕捉したown data property、またはnull。
 * @precondition keysはPackage内部で固定する。
 * @postcondition 返却値の読取りで元Objectへ再アクセスしない。
 * @effect N/A: 同期値検査だけ。
 * @failure Proxy、accessor、余剰・欠落・非plain値はnull。
 * @invariant 存在しないfieldを既定値で補完しない。
 * @boundary 未信頼Objectと局所Snapshot。
 * @security trapやgetterを呼ばない。
 * @concurrency N/A: 共有状態なし。
 */
export function capture(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> | null {
  if (
    !value ||
    typeof value !== "object" ||
    types.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(descriptors).length !== keys.length ||
    keys.some(
      (key) =>
        !Object.hasOwn(descriptors, key) ||
        !Object.hasOwn(descriptors[key] ?? {}, "value"),
    )
  )
    return null;
  return Object.fromEntries(keys.map((key) => [key, descriptors[key]?.value]));
}

/**
 * 完了または明示不要の技術処置だけを順序上の終了と判定する。
 * @responsibility unknown・未観測から次Effectを許可しない。
 * @trace ARCH-000008
 * @input action: 復号済み一処置。
 * @returns 結果confirmedまたはnot_requiredだけtrue。
 * @precondition actionは局所codecで検証済み。
 * @postcondition 実完了や保存確定を主張しない。
 * @effect N/A: 値判定のみ。
 * @failure N/A: 型内の値だけを扱う。
 * @invariant 発行不明を完了にしない。
 * @boundary 技術checkpointの順序。
 * @security 復号結果はAuthorityではない。
 * @concurrency N/A: 同期値判定。
 */
export function settled(action: RepairAction): boolean {
  return action.result === "confirmed" || action.result === "not_required";
}

/**
 * 固定Directory実体を捕捉する。
 * @responsibility 正の整数を精度損失なく保持する。
 * @trace ARCH-000008
 * @input value: 未信頼の実体値。
 * @returns 凍結実体、またはnull。
 * @precondition N/A: 不正値も受け取る。
 * @postcondition 生Pathや余分fieldを返さない。
 * @effect N/A: 値検査のみ。
 * @failure 不正構造・数値・hostile値はnull。
 * @invariant 数値文字列を丸めない。
 * @boundary 実体観測と保存DTO。
 * @security 値からAuthorityを発行しない。
 * @concurrency N/A: 共有状態なし。
 */
export function identity(value: unknown): DirectoryIdentity | null {
  const record = capture(value, ["dev", "ino", "birthtimeNs"]);
  if (
    !record ||
    !Object.values(record).every(
      (item) => typeof item === "string" && /^[1-9][0-9]{0,39}$/u.test(item),
    )
  )
    return null;
  return Object.freeze(record) as DirectoryIdentity;
}

/**
 * Directoryの四状態と実体を相関する。
 * @responsibility present以外の実体値を拒否する。
 * @trace ARCH-000008
 * @input value: 未信頼観測。
 * @returns 凍結観測、またはnull。
 * @precondition N/A: 任意値を拒否可能。
 * @postcondition 不明と不存在を分離する。
 * @effect N/A: 同期検査だけ。
 * @failure 状態・実体相関不正はnull。
 * @invariant Directory所在を保存しない。
 * @boundary 下位観測の値契約。
 * @security 復号でOSへ触れない。
 * @concurrency N/A: 共有状態なし。
 */
export function observation(value: unknown): DirectoryObservation | null {
  const record = capture(value, ["state", "identity"]);
  if (
    !record ||
    !["unobserved", "absent", "present", "unknown"].includes(
      record.state as string,
    )
  )
    return null;
  const actual = record.state === "present" ? identity(record.identity) : null;
  if (record.state === "present" ? !actual : record.identity !== null)
    return null;
  return Object.freeze({
    state: record.state as DirectoryObservation["state"],
    identity: actual,
  });
}

/**
 * 保持対象の閉じた三用途を独立コピーへ復号する。
 * @responsibility 実体の文字列表現を既存Directory契約で検査する。
 * @trace ARCH-000008
 * @input value: 未信頼の三用途値。
 * @returns 独立した凍結値、または不正値のnull。
 * @precondition 元checkpointとの相関・実観測は利用側が別に確認する。
 * @postcondition nullを観測不能や消失から補完しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 余剰・欠測・hostile値・不正実体は全体null。
 * @invariant decoder成功は保持引渡しや削除Authorityではない。
 * @boundary 保持receiptと純粋技術DTO。
 * @security Path・Owner・Scopeを受け付けない。
 * @concurrency N/A: 入力を変更しない。
 */
export function decodeEnvironmentRepairRetentionTargets(
  value: unknown,
): RepairRetentionTargets | null {
  const record = capture(value, REPAIR_DIRECTORIES);
  if (!record) return null;
  const targets: Record<
    (typeof REPAIR_DIRECTORIES)[number],
    DirectoryIdentity | null
  > = {
    primary: null,
    failed: null,
    auxiliary: null,
  };
  for (const purpose of REPAIR_DIRECTORIES) {
    const target = record[purpose] === null ? null : identity(record[purpose]);
    if (record[purpose] !== null && target === null) return null;
    targets[purpose] = target;
  }
  return Object.freeze(targets);
}

/**
 * 回収済み修復の新しい補助子を記録する候補だけを構成する。
 * @responsibility 通常遷移を緩めず、cleanup以外の保存済み技術事実を保全する。
 * @trace ARCH-000008
 * @input value: 前呼出しの固定checkpoint。
 * @returns cleanupだけpendingの凍結候補、またはnull。
 * @precondition 上位が未終端・一次失敗なし・同ID／主体／Scopeと新補助子取得を別途確認する。
 * @postcondition pending／unknownや過去の回収失敗を新取得で解消しない。
 * @effect N/A: 同期の値生成だけ。
 * @failure 不正値、cleanup未確認または失敗記録ありはnull。
 * @invariant REPAIR_ACTIONS・Directory実体・Engine・保持・安全性・失敗を変更しない。
 * @boundary fresh準備の技術候補と保存Owner。
 * @security 候補は取得・保存・実処置Authorityではない。
 * @concurrency N/A: 共有状態なし。
 */
export function prepareEnvironmentRepairSessionCheckpoint(
  value: unknown,
): RepairCheckpoint | null {
  const before = decodeEnvironmentRepairCheckpoint(value);
  if (before?.cleanup !== "confirmed" || before.cleanupFailure !== null)
    return null;
  return decodeEnvironmentRepairCheckpoint({ ...before, cleanup: "pending" });
}

/**
 * 後続回収をまだ要求していない三用途の初期値を構成する。
 * @responsibility 回収判断の保存と各用途の削除意図の保存を区別する。
 * @trace ARCH-000008
 * @input N/A: 固定三用途だけ。
 * @returns 全用途が未保存・未発行・未観測の独立した凍結値。
 * @precondition 上位が元修復と回収判断を別に確認する。
 * @postcondition 各用途のintent savedを生成しない。
 * @effect N/A: メモリ内の値生成だけ。
 * @failure N/A: 外部入力・外部処理なし。
 * @invariant 初期値は削除意図の保存確認や実処置許可ではない。
 * @boundary 技術値の初期化と上位の判断保存。
 * @security Path・Identity・Authorityを生成しない。
 * @concurrency 呼出しごとに別の凍結値を返す。
 */
export function createEnvironmentRepairDisposalCheckpoint(): RepairDisposalCheckpoint {
  const result = {} as Record<
    (typeof REPAIR_DIRECTORIES)[number],
    RepairDisposalCheckpoint["directories"]["primary"]
  >;
  for (const purpose of REPAIR_DIRECTORIES)
    result[purpose] = Object.freeze({
      intent: "not_saved",
      request: "not_issued",
      absence: "unobserved",
    });
  return Object.freeze({ directories: Object.freeze(result) });
}

/**
 * 修復専用の終端・処置・履歴条件を同じ判定で確認する。
 * @responsibility Taskの配送・ACK条件を修復へ流用せず、二つの保存codecで条件を共用する。
 * @trace ARCH-000008
 * @input operation: codec検証済み修復、snapshot: 同じ保存の回復・配送区画。
 * @returns 終了条件が成立する場合だけtrue。
 * @precondition 物理Ownerが現在の保存資格と履歴読戻しを別途確認する。
 * @postcondition 保存値や他操作を変更しない。
 * @effect N/A: メモリ内の同期比較だけ。
 * @failure 未回収かつ引渡し未確定の保持物・未終端・未確認履歴・同ID参照はfalse。
 * @invariant 通常更新の暗黙除去拒否とTask終了契約を変更しない。
 * @boundary 修復現在状態と既存completion Writer。
 * @security 候補生成を削除許可や実資源不存在の観測にしない。
 * @concurrency 元版・履歴・現在Ownerの再照合は物理Writerが所有する。
 */
export function repairCanComplete(
  operation: RepairOperationRecord,
  snapshot: Readonly<{
    unresolvedRecoveries: readonly Readonly<{ recoveryId: string }>[];
  }>,
): boolean {
  return !(
    operation.phase !== "settling" ||
    operation.outcome?.status !== "recovered" ||
    operation.outcome.reason !== "docker_repair_recovered" ||
    operation.outcome.cleanupConfirmed !== true ||
    operation.primaryFailure !== null ||
    operation.checkpoint?.engine !== "ready" ||
    operation.checkpoint.hostSafety !== "safe" ||
    operation.checkpoint.cleanup !== "confirmed" ||
    operation.checkpoint.cleanupFailure !== null ||
    !isRepairCheckpointSettled(operation.checkpoint) ||
    !(
      (operation.disposition === "not_applicable" &&
        operation.checkpoint.stale === "absent") ||
      (operation.disposition === "discard" &&
        operation.checkpoint.stale === "retained" &&
        operation.disposal !== null &&
        isRepairDisposalSettled(operation.disposal.checkpoint)) ||
      (operation.disposition === "retained_by_human_decision" &&
        operation.checkpoint.stale === "retained" &&
        operation.retention !== undefined)
    ) ||
    operation.history?.confirmed !== true ||
    JSON.parse(operation.identityJson).consumer !== "coordinator_cli" ||
    snapshot.unresolvedRecoveries.some(
      (item) => item.recoveryId === operation.recoveryId,
    )
  );
}

/**
 * 技術実行区画を保存Envelopeから独立して検証する。
 * @responsibility Operation、exact回復参照、配送待ちの構造と相関を検証する。
 * @trace ARCH-000008
 * @input snapshot: 復号済みの現在集合、repositoryBinding: 検証済みRepository結合。
 * @returns 全ての構造・相関条件が成立した版のTask参照、又はnull。
 * @precondition 入力はJSONから復号され、保存Rootの検証は呼出し側が行う。
 * @postcondition 未知区画や孤立参照を受理しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 不正構造・相関不一致はnull。
 * @invariant 保存形式の検証と実資源観測を同一視しない。
 * @boundary 保存Envelopeと技術実行モデル。
 * @security 保存内容を処置Authorityへ昇格しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function inspectExecutionState(
  snapshot: Pick<ExecutionStateSnapshot, "operations" | "unresolvedRecoveries">,
  repositoryBinding: string,
): Readonly<{
  tasks: ReadonlyMap<
    string,
    Readonly<{ operation: ExecutionOperationRecord; host: HostOperationRecord }>
  >;
  recoveryIdsByTask: ReadonlyMap<string, readonly string[]>;
}> | null {
  if (
    !Array.isArray(snapshot.operations) ||
    !Array.isArray(snapshot.unresolvedRecoveries)
  )
    return null;
  const operations = new Map<string, OperationRecord>();
  const hosts = indexOperationHosts(snapshot.operations);
  const tasks = new Map<
    string,
    { operation: ExecutionOperationRecord; host: HostOperationRecord }
  >();
  const recoveryIdsByTask = new Map<string, string[]>();
  let unresolvedRestarts = 0;
  let unresolvedRepairs = 0;
  let previousNonce = "";
  for (const operation of snapshot.operations) {
    if (operation.kind === "host_operation") {
      if (!decodeHostOperation(operation)) return null;
      const nonce = operationNonce(operation);
      if (nonce <= previousNonce) return null;
      previousNonce = nonce;
      operations.set(nonce, operation);
      continue;
    }
    if (operation.kind === "docker_repair") {
      if (!validRepairOperation(operation, repositoryBinding as string))
        return null;
      const nonce = operationNonce(operation);
      if (nonce <= previousNonce) return null;
      previousNonce = nonce;
      operations.set(nonce, operation);
      if (operation.phase !== "terminal" && ++unresolvedRepairs > 1)
        return null;
      continue;
    }
    if (operation.kind !== "docker_task") return null;
    if (
      !hasExecutionStateRecordKeys(operation, [
        "kind",
        "dockerRestart",
        "identityJson",
        "identitySha256",
        "recoveryId",
        "phase",
        "resources",
        "lease",
        "execution",
        "primaryFailure",
        "outcome",
        "summarySha256",
        "history",
      ])
    )
      return null;
    const recovery = parseDockerTaskRecoveryId(operation.recoveryId);
    if (
      !recovery ||
      recovery.operationNonce <= previousNonce ||
      typeof operation.identityJson !== "string" ||
      !operation.identityJson.endsWith("\n")
    )
      return null;
    const identity = JSON.parse(operation.identityJson);
    if (
      `${JSON.stringify(identity)}\n` !== operation.identityJson ||
      !validateOperationIdentity(
        identity,
        recovery.operationNonce,
        repositoryBinding,
      ) ||
      createHash("sha256")
        .update(operation.identityJson, "utf8")
        .digest("hex") !== operation.identitySha256 ||
      recovery.baseHash !== operation.identitySha256 ||
      recovery.stableLogicalHomeBindingHash !==
        identity.stableLogicalHomeBindingHash
    )
      return null;
    previousNonce = recovery.operationNonce;
    if (operation.dockerRestart !== null) {
      const restart = decodeDockerRestartCheckpoint(operation.dockerRestart);
      if (
        !restart ||
        restart.requestId !==
          createDockerRestartRequestId(
            repositoryBinding,
            operation.identitySha256,
            operation.recoveryId,
            restart.scopeSha256,
          )
      )
        return null;
      if (restart.result === null || !isDockerRestartCheckpointSettled(restart))
        unresolvedRestarts += 1;
      if (unresolvedRestarts > 1) return null;
    }
    operations.set(recovery.operationNonce, operation);
    if (
      !["executing", "settling", "terminal"].includes(operation.phase) ||
      !["held", "released", "unknown"].includes(operation.lease) ||
      (operation.summarySha256 !== null &&
        !isSha256Hex(operation.summarySha256))
    )
      return null;
    if (
      !validateResourceBook(operation.resources) ||
      operation.resources?.snapshot.resources.some(
        (resource: OperationResources["snapshot"]["resources"][number]) =>
          resource.identity.ownershipLabel !== identity.ownershipLabel,
      )
    )
      return null;
    const host = hosts.get(identity.operationId);
    if (!host || host.purpose === "isolation_probe") return null;
    tasks.set(operation.recoveryId, { operation, host });
    const taskId = identity.recoveryCorrelationId ?? identity.operationId;
    const recoveryIds = recoveryIdsByTask.get(taskId);
    if (recoveryIds) recoveryIds.push(operation.recoveryId);
    else recoveryIdsByTask.set(taskId, [operation.recoveryId]);
    const execution = operation.execution;
    if (
      !hasExecutionStateRecordKeys(execution, [
        "providerStart",
        "externalSend",
        "sharedWrite",
        "ownerEffect",
        "workspaceReusable",
      ]) ||
      !["not_started", "started", "unknown"].includes(
        execution.providerStart,
      ) ||
      !["not_issued", "issued", "unknown"].includes(execution.externalSend) ||
      !["not_issued", "possible", "unknown"].includes(execution.sharedWrite) ||
      !["active", "disabled", "unknown"].includes(execution.ownerEffect) ||
      execution.workspaceReusable !== false
    )
      return null;
    if (
      !validPrimaryFailure(operation.primaryFailure) ||
      !validOutcome(operation.outcome)
    )
      return null;
    if (
      Object.hasOwn(
        ATTEMPT_START_FAILURE_STAGES,
        operation.primaryFailure?.reason ?? "",
      ) &&
      (execution.providerStart !== "not_started" ||
        execution.externalSend !== "not_issued" ||
        execution.sharedWrite !== "not_issued" ||
        execution.ownerEffect !== "disabled" ||
        (operation.resources?.checkpoints.some(
          (resource: OperationResources["checkpoints"][number]) =>
            resource.submission !== "none",
        ) ??
          false))
    )
      return null;
    if (
      operation.outcome !== null &&
      (Object.hasOwn(ATTEMPT_START_FAILURE_STAGES, operation.outcome.reason) ||
        Object.hasOwn(
          ATTEMPT_START_FAILURE_STAGES,
          operation.primaryFailure?.reason ?? "",
        )) &&
      (operation.outcome.status !== "blocked" ||
        operation.outcome.reason !== operation.primaryFailure?.reason)
    )
      return null;
    if (
      host.cleanup === "confirmed" &&
      (operation.lease !== "released" ||
        execution.ownerEffect !== "disabled" ||
        !areTaskResourcesSettled(operation))
    )
      return null;
    if ((operation.summarySha256 === null) !== (operation.history === null))
      return null;
    if (operation.history !== null) {
      const history = operation.history;
      if (
        !operation.outcome ||
        !hasExecutionStateRecordKeys(history, [
          "occurredAt",
          "lineSha256",
          "confirmed",
        ]) ||
        typeof history.occurredAt !== "string" ||
        !Number.isFinite(Date.parse(history.occurredAt)) ||
        new Date(Date.parse(history.occurredAt)).toISOString() !==
          history.occurredAt ||
        !isSha256Hex(history.lineSha256) ||
        typeof history.confirmed !== "boolean" ||
        !matchesOperationHistory(operation, identity, history)
      )
        return null;
    }
  }
  let previousRecovery = "";
  for (const recovery of snapshot.unresolvedRecoveries) {
    const referencedOperation = operations.get(recovery.operationNonce);
    if (
      !hasExecutionStateRecordKeys(recovery, [
        "operationNonce",
        "recoveryId",
        "reason",
        "obligations",
      ]) ||
      recovery.operationNonce <= previousRecovery ||
      referencedOperation?.kind !== "docker_task" ||
      referencedOperation.recoveryId !== recovery.recoveryId ||
      !finalReasons.has(recovery.reason) ||
      !Array.isArray(recovery.obligations) ||
      recovery.obligations.length === 0 ||
      recovery.obligations.length > 4
    )
      return null;
    previousRecovery = recovery.operationNonce;
    let previousObligation = "";
    for (const obligation of recovery.obligations) {
      if (
        !["docker_resources", "host_cleanup", "lease_release"].includes(
          obligation,
        ) ||
        obligation <= previousObligation
      )
        return null;
      previousObligation = obligation;
    }
  }
  return { tasks, recoveryIdsByTask };
}

/**
 * 修復variantの不変Identityと技術・上位状態の相関を検査する。
 * @responsibility Task専用値を要求せず、固定Identityとexact回復IDへ結合する。
 * @trace ARCH-000008
 * @input operation: 未信頼保存値、repositoryBinding: 外側の検証済み結合。
 * @returns 完全な修復variantだけtrue。
 * @precondition 外側codecが正規JSONから復号した値である。
 * @postcondition 署名や旧記録を新形式へ補完しない。
 * @effect N/A: 値の検査だけ。
 * @failure 不正key、別結合、結果／保持判断の矛盾はfalse。
 * @invariant 復号成功を人間承認や実修復成功へ昇格しない。
 * @boundary 保存envelopeと下位の技術DTO。
 * @security 生Path、Provider、Homeを修復Identityへ入れない。
 * @concurrency N/A: 同期の値検査。
 */
export function validRepairOperation(
  operation: RepairOperationRecord,
  repositoryBinding: string,
): boolean {
  if (
    !hasExecutionStateRecordKeys(operation, [
      "kind",
      "identityJson",
      "identitySha256",
      "recoveryId",
      "phase",
      "checkpoint",
      "disposition",
      "disposal",
      ...(Object.hasOwn(operation, "retention") ? ["retention"] : []),
      "primaryFailure",
      "outcome",
      "summarySha256",
      "history",
    ]) ||
    operation.kind !== "docker_repair" ||
    typeof operation.identityJson !== "string"
  )
    return false;
  try {
    const identity = JSON.parse(operation.identityJson);
    if (
      !hasExecutionStateRecordKeys(identity, [
        "schema",
        "kind",
        "operationNonce",
        "operationId",
        "repositoryBinding",
        "consumer",
      ]) ||
      identity.schema !== "crdd-coordinator/docker-repair-identity/v3" ||
      identity.kind !== operation.kind ||
      identity.repositoryBinding !== repositoryBinding ||
      !isSha256Hex(identity.operationNonce) ||
      typeof identity.operationId !== "string" ||
      !/^OP-[0-9]{6,}$/u.test(identity.operationId) ||
      typeof identity.consumer !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(identity.consumer) ||
      `${JSON.stringify(identity)}\n` !== operation.identityJson
    )
      return false;
    const hash = createHash("sha256")
      .update(operation.identityJson, "utf8")
      .digest("hex");
    if (
      operation.identitySha256 !== hash ||
      operation.recoveryId !==
        `docker-repair.${identity.operationNonce}.${hash}` ||
      !["repairing", "settling", "awaiting_disposition", "terminal"].includes(
        operation.phase,
      ) ||
      ![
        "not_applicable",
        "pending_human_decision",
        "retained_by_human_decision",
        "discard",
      ].includes(operation.disposition)
    )
      return false;
    const checkpoint =
      operation.checkpoint === null
        ? null
        : decodeEnvironmentRepairCheckpoint(operation.checkpoint);
    if (operation.checkpoint !== null && !checkpoint) return false;
    if (
      Object.hasOwn(operation, "retention") &&
      (!validRepairRetentionReceipt(operation.retention) ||
        operation.disposition !== "retained_by_human_decision" ||
        operation.phase !== "settling" ||
        operation.disposal !== null ||
        operation.outcome?.status !== "recovered" ||
        operation.primaryFailure !== null ||
        !checkpoint ||
        !repairRetentionMatchesCheckpoint(operation.retention, checkpoint))
    )
      return false;
    if (
      (checkpoint?.stale === "retained") !==
      (operation.disposition !== "not_applicable")
    )
      return false;
    if ((operation.disposition === "discard") !== (operation.disposal !== null))
      return false;
    if (operation.disposal !== null) {
      const disposal = operation.disposal;
      if (
        !hasExecutionStateRecordKeys(disposal, ["decidedAt", "checkpoint"]) ||
        typeof disposal.decidedAt !== "string" ||
        !Number.isFinite(Date.parse(disposal.decidedAt)) ||
        new Date(disposal.decidedAt).toISOString() !== disposal.decidedAt ||
        !decodeEnvironmentRepairDisposalCheckpoint(disposal.checkpoint) ||
        (!isRepairDisposalSettled(disposal.checkpoint) &&
          (operation.summarySha256 !== null || operation.history !== null)) ||
        operation.phase !== "settling" ||
        operation.outcome?.status !== "recovered" ||
        operation.primaryFailure !== null ||
        checkpoint?.stale !== "retained"
      )
        return false;
    }
    const failure = operation.primaryFailure;
    if (
      failure !== null &&
      (!hasExecutionStateRecordKeys(failure, ["stage", "reason"]) ||
        !["preparation", "checkpoint", "repair", "delivery"].includes(
          failure.stage,
        ) ||
        !repairReasons.has(failure.reason) ||
        failure.reason === "docker_repair_recovered")
    )
      return false;
    const outcome = operation.outcome;
    if (outcome !== null) {
      if (
        !hasExecutionStateRecordKeys(outcome, [
          "status",
          "reason",
          "cleanupConfirmed",
        ]) ||
        !["recovered", "blocked", "cancelled"].includes(outcome.status) ||
        !repairReasons.has(outcome.reason) ||
        typeof outcome.cleanupConfirmed !== "boolean"
      )
        return false;
      if (
        (outcome.status === "recovered") !==
          (outcome.reason === "docker_repair_recovered") ||
        (outcome.status === "cancelled") !==
          (outcome.reason === "docker_repair_cancelled")
      )
        return false;
      if (
        outcome.cleanupConfirmed !==
        (checkpoint === null ||
          checkpoint.cleanup === "confirmed" ||
          checkpoint.cleanup === "not_requested")
      )
        return false;
      if (
        outcome.status === "recovered" &&
        (checkpoint?.engine !== "ready" ||
          checkpoint.hostSafety !== "safe" ||
          checkpoint.stale === "unknown" ||
          checkpoint.cleanup !== "confirmed" ||
          checkpoint.cleanupFailure !== null ||
          failure !== null ||
          !isRepairCheckpointSettled(checkpoint))
      )
        return false;
    }
    if (operation.phase === "repairing" ? outcome !== null : outcome === null)
      return false;
    if (
      operation.phase === "awaiting_disposition" &&
      (outcome?.status !== "recovered" ||
        operation.disposition !== "pending_human_decision")
    )
      return false;
    if (
      operation.phase === "terminal" &&
      (!outcome?.cleanupConfirmed ||
        (checkpoint !== null && checkpoint.hostSafety !== "safe") ||
        operation.disposition === "pending_human_decision")
    )
      return false;
    if ((operation.summarySha256 === null) !== (operation.history === null))
      return false;
    if (operation.history === null) return true;
    const history = operation.history;
    return (
      repairCanSummarize(operation) &&
      hasExecutionStateRecordKeys(history, [
        "occurredAt",
        "lineSha256",
        "confirmed",
      ]) &&
      typeof history.occurredAt === "string" &&
      Number.isFinite(Date.parse(history.occurredAt)) &&
      new Date(history.occurredAt).toISOString() === history.occurredAt &&
      (operation.retention === undefined ||
        history.occurredAt === operation.retention.decidedAt) &&
      typeof history.confirmed === "boolean" &&
      isSha256Hex(history.lineSha256) &&
      matchesOperationHistory(operation, identity, history)
    );
  } catch {
    return false;
  }
}

/**
 * 検査済みvariantの共通操作世代を取り出す。
 * @responsibility Task専用回復ID parserへ修復IDを渡さない。
 * @trace ARCH-000008
 * @input operation: 検査済みの一操作。
 * @returns 不変Identityに保存した64hex世代。
 * @precondition operationは現在codecが検査済み。
 * @postcondition 返却値からAuthorityを生成しない。
 * @effect N/A: 局所JSONの読取りのみ。
 * @failure 不正JSONは外側codecへ例外を返す。
 * @invariant 異なるvariantで同じ世代を重複させない。
 * @boundary 現在操作の相関と順序。
 * @security 任意PathやHomeを参照しない。
 * @concurrency N/A: 同期値読取り。
 */
export function operationNonce(operation: OperationRecord): string {
  if (operation.kind === "host_operation") return operation.operationId;
  return JSON.parse(operation.identityJson).operationNonce;
}

/**
 * Host作成IntentとReceiptを閉じた保存形として検査する。
 * @responsibility Pathや独立markerを受けず、未観測・実体・終端の相関を判定する。
 * @trace ARCH-000008
 * @boundary 値の成立は実Filesystemの現在性又は削除許可を証明しない。
 */
export function decodeHostOperation(
  value: unknown,
): HostOperationRecord | null {
  try {
    const operation = capture(value, [
      "kind",
      "operationId",
      "recoveryId",
      "purpose",
      "resources",
      ...(value !== null &&
      typeof value === "object" &&
      !types.isProxy(value) &&
      Object.hasOwn(value, "git")
        ? ["git"]
        : []),
      "createdAt",
      "phase",
      "rootIdentity",
      "childIdentities",
      "cleanup",
    ]);
    if (
      operation?.kind !== "host_operation" ||
      typeof operation.operationId !== "string" ||
      !/^OP-[0-9]{6,}$/u.test(operation.operationId) ||
      operation.recoveryId !== `host-operation.${operation.operationId}` ||
      typeof operation.purpose !== "string" ||
      !["task", "advice", "isolation_probe"].includes(operation.purpose) ||
      typeof operation.createdAt !== "string" ||
      !Number.isFinite(Date.parse(operation.createdAt)) ||
      new Date(operation.createdAt).toISOString() !== operation.createdAt ||
      typeof operation.phase !== "string" ||
      !["preparing", "active", "terminal"].includes(operation.phase) ||
      typeof operation.cleanup !== "string" ||
      !["not_requested", "pending", "confirmed", "unknown"].includes(
        operation.cleanup,
      )
    )
      return null;
    const readIdentity = (value: unknown): DirectoryIdentity | null => {
      const record = capture(value, ["dev", "ino", "birthtimeNs"]);
      if (
        !record ||
        ![record.dev, record.ino, record.birthtimeNs].every(
          (part) => typeof part === "string" && /^(0|[1-9][0-9]*)$/u.test(part),
        )
      )
        return null;
      return Object.freeze({
        dev: record.dev as string,
        ino: record.ino as string,
        birthtimeNs: record.birthtimeNs as string,
      });
    };
    const names = [
      "workspace",
      "providerHome",
      "tmp",
      "events",
      "projection",
      "management",
    ];
    const rawChildren = operation.childIdentities;
    if (
      !rawChildren ||
      typeof rawChildren !== "object" ||
      types.isProxy(rawChildren)
    )
      return null;
    const children = capture(rawChildren, Object.keys(rawChildren));
    if (
      !children ||
      Object.keys(children).some((name) => !names.includes(name))
    )
      return null;
    const receipts: Partial<
      Record<keyof HostOperationRecord["childIdentities"], DirectoryIdentity>
    > = {};
    for (const [name, value] of Object.entries(children)) {
      const receipt = readIdentity(value);
      if (!receipt) return null;
      receipts[name as keyof typeof receipts] = receipt;
    }
    const git: NonNullable<HostOperationRecord["git"]>[number][] = [];
    const hasGit = Object.hasOwn(operation, "git");
    if (hasGit) {
      if (
        operation.purpose !== "task" ||
        !Array.isArray(operation.git) ||
        types.isProxy(operation.git)
      )
        return null;
      const descriptors = Object.getOwnPropertyDescriptors(operation.git);
      const count = operation.git.length;
      if (
        Reflect.ownKeys(descriptors).some(
          (key) =>
            typeof key !== "string" ||
            (key !== "length" &&
              (!/^(0|[1-9][0-9]*)$/u.test(key) || Number(key) >= count)),
        )
      )
        return null;
      for (let index = 0; index < operation.git.length; index++) {
        const descriptor = descriptors[String(index)];
        const item =
          descriptor && "value" in descriptor
            ? capture(descriptor.value, [
                "name",
                "commitId",
                "temporary",
                "request",
                "cleanup",
              ])
            : null;
        const expected = `refs/heads/crdd/operation/${operation.operationId}/${index === 0 ? "baseline" : `candidate-${index}`}`;
        if (
          !item ||
          item.name !== expected ||
          !(
            item.commitId === null ||
            (typeof item.commitId === "string" &&
              /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(item.commitId))
          ) ||
          !["not_issued", "unknown", "confirmed"].includes(
            item.request as string,
          ) ||
          !["pending", "confirmed"].includes(item.cleanup as string) ||
          (item.request !== "not_issued" && item.commitId === null)
        )
          return null;
        const temporary =
          item.temporary === null
            ? null
            : capture(item.temporary, ["relativePath", "identity"]);
        if (
          item.temporary !== null &&
          (!temporary ||
            typeof temporary.relativePath !== "string" ||
            !new RegExp(
              `^\\.crdd/coordinator/${operation.operationId}/management/candidate-index-[A-Za-z0-9]+$`,
              "u",
            ).test(temporary.relativePath) ||
            !(temporary.identity === null || isSha256Hex(temporary.identity)))
        )
          return null;
        if (operation.cleanup === "confirmed" && item.cleanup !== "confirmed")
          return null;
        git.push(
          Object.freeze({
            name: item.name as string,
            commitId: item.commitId as string | null,
            temporary: temporary
              ? Object.freeze({
                  relativePath: temporary.relativePath as string,
                  identity: temporary.identity as string | null,
                })
              : null,
            request: item.request as "not_issued" | "unknown" | "confirmed",
            cleanup: item.cleanup as "pending" | "confirmed",
          }),
        );
      }
    }
    const root =
      operation.rootIdentity === null
        ? null
        : readIdentity(operation.rootIdentity);
    if (
      (operation.rootIdentity !== null && root === null) ||
      (root === null && Object.keys(receipts).length !== 0) ||
      (hasGit &&
        (operation.phase === "preparing" ||
          root === null ||
          Object.keys(receipts).length !== names.length))
    )
      return null;
    const resources: unknown = JSON.parse(
      encodeStateValue(operation.resources),
      (_key, value: unknown) =>
        value !== null && typeof value === "object"
          ? Object.freeze(value)
          : value,
    );
    if (
      !validateResourceBook(resources) ||
      (resources !== null &&
        (operation.purpose !== "isolation_probe" ||
          operation.phase === "preparing" ||
          root === null ||
          Object.keys(receipts).length !== names.length ||
          resources.snapshot.resources.length !== 1 ||
          resources.snapshot.resources[0]?.key !== "probe" ||
          resources.snapshot.resources[0]?.identity.kind !== "container" ||
          resources.checkpoints.some(
            (item) => item.receiptSource === "docker_observation",
          ) ||
          resources.cleanup.unreceiptedAbsence !== "retain" ||
          (operation.cleanup === "confirmed" &&
            !resources.checkpoints.every(resourceIsSettled))))
    )
      return null;
    if (
      operation.phase === "active" &&
      (root === null ||
        Object.keys(receipts).length !== names.length ||
        operation.cleanup === "confirmed")
    )
      return null;
    if (
      (operation.phase === "terminal") !==
      (operation.cleanup === "confirmed")
    )
      return null;
    return Object.freeze({
      kind: "host_operation",
      operationId: operation.operationId,
      recoveryId: operation.recoveryId as string,
      purpose: operation.purpose as HostOperationRecord["purpose"],
      resources,
      ...(hasGit ? { git: Object.freeze(git) } : {}),
      createdAt: operation.createdAt,
      phase: operation.phase as HostOperationRecord["phase"],
      rootIdentity: root,
      childIdentities: Object.freeze(receipts),
      cleanup: operation.cleanup as HostOperationRecord["cleanup"],
    });
  } catch {
    return null;
  }
}

/**
 * Docker Task 回復 Idを構造化値へ解析する。
 *
 * @responsibility Docker Task 回復 Idの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000008
 * @input token: unknown
 * @returns parseDockerTaskRecoveryIdの計算結果を返す。
 * @precondition 「token: unknown」がparseDockerTaskRecoveryIdの入力契約を満たす。
 * @postcondition parseDockerTaskRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: parseDockerTaskRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseDockerTaskRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant parseDockerTaskRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseDockerTaskRecoveryIdはProcess内の同一Subsystemで完結する。
 * @security parseDockerTaskRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseDockerTaskRecoveryIdは共有非同期状態を持たない同期処理である。
 */
export function parseDockerTaskRecoveryId(token: unknown) {
  if (typeof token !== "string") return null;
  const match = DOCKER_TASK_RECOVERY_ID.exec(token);
  return match?.[1] && match[2] && match[3]
    ? Object.freeze({
        token,
        stableLogicalHomeBindingHash: match[1],
        operationNonce: match[2],
        baseHash: match[3],
      })
    : null;
}

/**
 * 現在状態の操作IdentityをRepository結合と照合する。
 * @responsibility 旧RuntimeState証明を受け入れず、操作・Home・Host・予定資源の閉じた相関を検査する。
 * @trace ARCH-000008
 * @input value: 保存されたIdentity、nonce: 操作世代、repositoryBinding: 現在Repository結合。
 * @returns 必須項目と相関がすべて成立した場合だけtrue。
 * @precondition Repository結合は外側Snapshotの検証済み入力である。
 * @postcondition 旧形式や追加項目を新Identityとして解釈しない。
 * @effect N/A: 入力の同期検査のみ。
 * @failure 不正な形式・結合・Host相関をfalseとして返す。
 * @invariant Home・Hostの証明をRepository Hashで代替しない。
 * @boundary 保存形式と同一Process内の検査境界。
 * @security 保存Pathは処置許可を付与しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function validateOperationIdentity(
  value: unknown,
  nonce: string,
  repositoryBinding: string,
): boolean {
  const identity = value as Record<string, unknown>;
  const keys = [
    "schema",
    "operationNonce",
    "provider",
    "consumer",
    "operationId",
    "executionSelection",
    "taskAttempt",
    "stableLogicalHomeBindingHash",
    "providerHomeIdentityHash",
    "repositoryBinding",
    "ownershipLabel",
    "operationMode",
    "workspaceMountMode",
    ...(Object.hasOwn(identity, "workspaceProtected")
      ? ["workspaceProtected"]
      : []),
    ...(Object.hasOwn(identity, "workspaceProtection")
      ? ["workspaceProtection"]
      : []),
  ];
  const hasCorrelation = Object.hasOwn(identity ?? {}, "recoveryCorrelationId");
  if (
    !hasExecutionStateRecordKeys(
      value,
      hasCorrelation ? [...keys, "recoveryCorrelationId"] : keys,
    )
  )
    return false;
  return (
    identity.schema === OPERATION_IDENTITY_SCHEMA &&
    typeof identity.consumer === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(identity.consumer) &&
    identity.operationNonce === nonce &&
    identity.repositoryBinding === repositoryBinding &&
    isSha256Hex(identity.repositoryBinding) &&
    (identity.provider === "codex" || identity.provider === "claude") &&
    /^OP-[0-9]{6,}$/u.test(String(identity.operationId ?? "")) &&
    inspectExecutionSelection(identity.executionSelection)?.provider ===
      identity.provider &&
    (identity.taskAttempt === 0 || identity.taskAttempt === 1) &&
    [
      identity.stableLogicalHomeBindingHash,
      identity.providerHomeIdentityHash,
    ].every(isSha256Hex) &&
    /^crdd\.coordinator\.runtime=[a-f0-9]{16}$/u.test(
      String(identity.ownershipLabel ?? ""),
    ) &&
    ["boolean_probe", "isolated_task", "workbench_advice"].includes(
      String(identity.operationMode),
    ) &&
    (identity.workspaceMountMode === null ||
      identity.workspaceMountMode === "read_only" ||
      identity.workspaceMountMode === "read_write") &&
    (!Object.hasOwn(identity, "workspaceProtected") ||
      (identity.workspaceProtected === true &&
        identity.operationMode === "isolated_task" &&
        identity.workspaceMountMode !== null &&
        hasExecutionStateRecordKeys(identity.workspaceProtection, [
          "gitSourcePath",
          "internalSourcePath",
        ]) &&
        Object.values(
          identity.workspaceProtection as Record<string, unknown>,
        ).every(
          (item) => typeof item === "string" && !/[\0\r\n,]/u.test(item),
        ))) &&
    (!Object.hasOwn(identity, "workspaceProtection") ||
      identity.workspaceProtected === true) &&
    (!hasCorrelation ||
      (typeof identity.recoveryCorrelationId === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
          identity.recoveryCorrelationId,
        )))
  );
}

/**
 * 再起動checkpointの閉じた許容組合せを復号する。
 * @responsibility 未評価field・hostile値・偽の完了を拒否する。
 * @trace ARCH-000008
 * @input value: 未信頼の保存候補。
 * @returns 所有する固定Snapshot、またはnull。
 * @precondition N/A: 任意値を受け取り安全に拒否する。
 * @postcondition completedは要求と回収の両confirmedの場合だけ返す。
 * @effect N/A: 値の観測だけ。
 * @failure 欠落・余剰・accessor・Proxy・不正組合せはnull。
 * @invariant cleanup不要と確認を区別する。
 * @boundary 未信頼値と保存モデル。
 * @security getterやProxyの処理を実行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function decodeDockerRestartCheckpoint(
  value: unknown,
): RestartCheckpoint | null {
  const record = snapshotStateRecord(
    value,
    new Set(["requestId", "scopeSha256", "request", "cleanup", "result"]),
  );
  if (
    !record ||
    !recoveryIsSha256Hex(record.requestId) ||
    !recoveryIsSha256Hex(record.scopeSha256) ||
    !["not_issued", "unknown", "issued", "confirmed"].includes(
      record.request as string,
    ) ||
    !["not_required", "pending", "confirmed", "unknown"].includes(
      record.cleanup as string,
    )
  )
    return null;
  const result =
    record.result === null
      ? null
      : snapshotStateRecord(
          record.result,
          new Set(["status", "reason", "request", "effectOutcomeUnknown"]),
        );
  if (
    record.result !== null &&
    (!result ||
      !["completed", "blocked"].includes(result.status as string) ||
      !["not_issued", "unknown", "issued", "confirmed"].includes(
        result.request as string,
      ) ||
      typeof result.effectOutcomeUnknown !== "boolean" ||
      typeof result.reason !== "string" ||
      !/^[a-z][a-z0-9_]{0,159}$/u.test(result.reason))
  )
    return null;
  if (
    (record.request === "not_issued") !== (record.cleanup === "not_required") ||
    (result?.status === "completed" &&
      (record.request !== "confirmed" ||
        record.cleanup !== "confirmed" ||
        result.request !== "confirmed" ||
        result.effectOutcomeUnknown !== false)) ||
    (result?.request === "not_issued" &&
      ["issued", "confirmed"].includes(record.request as string)) ||
    (record.request === "not_issued" &&
      result !== null &&
      (result.request !== "not_issued" ||
        result.effectOutcomeUnknown !== false)) ||
    (record.cleanup === "unknown" && result?.status !== "blocked")
  )
    return null;
  return Object.freeze({
    requestId: record.requestId,
    scopeSha256: record.scopeSha256,
    request: record.request,
    cleanup: record.cleanup,
    result: result ? Object.freeze({ ...result }) : null,
  }) as RestartCheckpoint;
}

/**
 * 元操作と採用Scopeから再起動要求の相関Hashを再計算する。
 * @responsibility 任意64hexを同じ要求の根拠として受理しない。
 * @trace ARCH-000008
 * @input repositoryBinding、identitySha256、recoveryId、scopeSha256: 固定非秘密相関。
 * @returns 固定envelopeのSHA-256、または不正結合のnull。
 * @precondition Scopeは現在Ownerが確認した対象と既存fenceに結合する。
 * @postcondition exact回復IDの元内容Hashと一致する場合だけ相関値を返す。
 * @effect N/A: Hash計算だけ。
 * @failure 不正Hash・別Identity・不正回復参照はnull。
 * @invariant Hashは現在許可・排他・実結果の証明ではない。
 * @boundary 保存相関値の生成。
 * @security 秘密値・Path・Promptをenvelopeへ追加しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function createDockerRestartRequestId(
  repositoryBinding: unknown,
  identitySha256: unknown,
  recoveryId: unknown,
  scopeSha256: unknown,
): string | null {
  const recovery = parseDockerTaskRecoveryId(recoveryId);
  if (
    !recoveryIsSha256Hex(repositoryBinding) ||
    !recoveryIsSha256Hex(identitySha256) ||
    !recoveryIsSha256Hex(scopeSha256) ||
    !recovery ||
    recovery.baseHash !== identitySha256
  )
    return null;
  return createHash("sha256")
    .update(
      JSON.stringify({
        schema: "crdd-coordinator/docker-restart-request/v1",
        purpose: "docker_restart",
        repositoryBinding,
        identitySha256,
        recoveryId,
        scopeSha256,
      }),
      "utf8",
    )
    .digest("hex");
}

/**
 * 再起動の残存義務がTaskの終了を妨げるかを同じ条件で判定する。
 * @responsibility 履歴Readerと終端Writerの許容形を一つの純粋判定に固定する。
 * @trace ARCH-000008
 * @input value: 未信頼の再起動checkpointまたは記録なしのnull。
 * @returns 記録なし、未要求、確定再起動、確定未発行、発行済み既知失敗の終了形だけtrue。
 * @precondition 実Owner・資源・排他・Host不存在は利用側が別に確認する。
 * @postcondition blockedを再起動成功やTask成功へ変換しない。
 * @effect N/A: 値の復号と比較だけ。
 * @failure 欠測・旧形式・矛盾・Effect不明・回収不明はfalse。
 * @invariant 上位unknownをnot_issuedへ巻き戻さず、再要求を許可しない。
 * @boundary 保存モデルと終端利用側。
 * @security 保存値だけから処置Authorityを発行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function isDockerRestartCheckpointSettled(value: unknown): boolean {
  if (value === null) return true;
  const checkpoint = decodeDockerRestartCheckpoint(value);
  if (!checkpoint) return false;
  if (
    checkpoint.request === "not_issued" &&
    checkpoint.cleanup === "not_required" &&
    checkpoint.result === null
  )
    return true;
  if (
    checkpoint.cleanup !== "confirmed" ||
    checkpoint.result === null ||
    checkpoint.result.effectOutcomeUnknown !== false
  )
    return false;
  return (
    (checkpoint.request === "confirmed" &&
      checkpoint.result.request === "confirmed") ||
    (checkpoint.request === "unknown" &&
      checkpoint.result.status === "blocked" &&
      checkpoint.result.request === "not_issued") ||
    (checkpoint.request === "issued" &&
      checkpoint.result.status === "blocked" &&
      checkpoint.result.request === "issued")
  );
}

export const purposeResource = Object.freeze({
  create_egress_network: "egress",
  create_internal_network: "internal",
  create_provider: "provider",
  create_proxy: "proxy",
  create_subscription_auth_probe: "auth",
} as const);

/**
 * 一次失敗の固定分類を現在状態と履歴で共用する。
 * @responsibility 失敗の相関と許可分類を一つの値検査で維持する。
 * @trace ARCH-000008
 * @input value: JSONから得た一次失敗またはnull。
 * @returns 固定契約に適合する場合だけtrue。
 * @precondition Proxyやaccessorは上位のJSON境界で除外済み。
 * @postcondition 未知分類やreceiptだけの成功を拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure 不正shapeと分類はfalse。
 * @invariant 一次失敗を清掃結果で上書きしない。
 * @boundary 保存JSONの共通検証。
 * @security 自由な例外本文やPathを許可しない。
 * @concurrency N/A: 同期処理だけ。
 */
export function validPrimaryFailure(value: unknown): boolean {
  if (value === null) return true;
  // 既存診断にない観測値を0で補わず、追加された場合だけ閉じて検査する。
  const hasObservation =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "commandObservation");
  const hasAuthenticationStatus =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "authenticationStatus");
  const hasTurnCountDiagnostic =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "turnCountDiagnostic");
  if (
    !hasExecutionStateRecordKeys(value, [
      "purpose",
      "stage",
      "reason",
      "exceptionCode",
      "commandHandleObtained",
      "responseObserved",
      "receiptRecorded",
      ...(hasObservation ? ["commandObservation"] : []),
      ...(hasAuthenticationStatus ? ["authenticationStatus"] : []),
      ...(hasTurnCountDiagnostic ? ["turnCountDiagnostic"] : []),
    ])
  )
    return false;
  const failure = value as NonNullable<
    ExecutionOperationRecord["primaryFailure"]
  >;
  if (Object.hasOwn(ATTEMPT_START_FAILURE_STAGES, failure.reason))
    return (
      failure.purpose === null &&
      failure.stage ===
        ATTEMPT_START_FAILURE_STAGES[
          failure.reason as keyof typeof ATTEMPT_START_FAILURE_STAGES
        ] &&
      failure.exceptionCode === null &&
      failure.commandHandleObtained === false &&
      failure.responseObserved === false &&
      failure.receiptRecorded === false &&
      (!hasObservation || failure.commandObservation === null) &&
      !hasAuthenticationStatus &&
      !hasTurnCountDiagnostic
    );
  return (
    (failure.purpose === null || commandPurposes.includes(failure.purpose)) &&
    failureStages.includes(failure.stage) &&
    finalReasons.has(failure.reason) &&
    (failure.exceptionCode === null ||
      [
        "ENOENT",
        "EACCES",
        "EPERM",
        "ETIMEDOUT",
        "ECONNREFUSED",
        "EPIPE",
        "unclassified_exception",
      ].includes(failure.exceptionCode) ||
      /^docker_effect_(management_required|plan_invalid|plan_replaced|command_not_owned|platform_unsupported|cli_untrusted|cli_replaced|path_invalid|config_invalid|config_replaced|filesystem_identity_invalid)$/u.test(
        failure.exceptionCode,
      ) ||
      /^owned_operation_(management_binding_required|unknown_child|child_replaced|mount_replaced)$/u.test(
        failure.exceptionCode,
      )) &&
    [
      failure.commandHandleObtained,
      failure.responseObserved,
      failure.receiptRecorded,
    ].every((isObservedFlag) => typeof isObservedFlag === "boolean") &&
    (!failure.receiptRecorded || failure.responseObserved) &&
    (!hasAuthenticationStatus ||
      (failure.purpose === "start_subscription_auth_probe_attached" &&
        ["execution_classification", "subscription_auth_verification"].includes(
          failure.stage,
        ) &&
        failure.responseObserved &&
        failure.commandObservation != null &&
        failure.commandObservation.exitCode !== null &&
        ["confirmed", "unconfirmed", "unknown"].includes(
          failure.authenticationStatus ?? "",
        ))) &&
    (!hasTurnCountDiagnostic ||
      (failure.purpose === "start_provider_attached" &&
        failure.stage === "provider_result_normalization" &&
        failure.reason === "workbench_ai_claude_turn_count_invalid" &&
        failure.responseObserved &&
        failure.commandObservation?.exitCode === 0 &&
        hasExecutionStateRecordKeys(failure.turnCountDiagnostic, [
          "valueType",
          "numberText",
        ]) &&
        [
          "missing",
          "null",
          "boolean",
          "number",
          "string",
          "array",
          "object",
        ].includes(failure.turnCountDiagnostic?.valueType ?? "") &&
        (failure.turnCountDiagnostic?.numberText === null ||
          (failure.turnCountDiagnostic?.valueType === "number" &&
            typeof failure.turnCountDiagnostic.numberText === "string" &&
            failure.turnCountDiagnostic.numberText.length <= 32 &&
            Number.isFinite(Number(failure.turnCountDiagnostic.numberText)) &&
            String(Number(failure.turnCountDiagnostic.numberText)) ===
              failure.turnCountDiagnostic.numberText &&
            (!Number.isInteger(
              Number(failure.turnCountDiagnostic.numberText),
            ) ||
              Number(failure.turnCountDiagnostic.numberText) < 1 ||
              Number(failure.turnCountDiagnostic.numberText) > 2))))) &&
    (!hasObservation ||
      failure.commandObservation === null ||
      (failure.responseObserved &&
        hasExecutionStateRecordKeys(failure.commandObservation, [
          "exitCode",
          "stdoutBytes",
          "stderrBytes",
        ]) &&
        (failure.commandObservation?.exitCode === null ||
          (Number.isSafeInteger(failure.commandObservation?.exitCode) &&
            Number(failure.commandObservation?.exitCode) >= 0)) &&
        [
          failure.commandObservation?.stdoutBytes,
          failure.commandObservation?.stderrBytes,
        ].every((v) => Number.isSafeInteger(v) && Number(v) >= 0)))
  );
}

/**
 * 最終結果の相関を現在状態と履歴で共用する。
 * @responsibility 状態、固定理由、清掃評価の組合せを維持する。
 * @trace ARCH-000008
 * @input value: JSONから得た最終結果またはnull。
 * @returns 固定契約に適合する場合だけtrue。
 * @precondition JSON値境界で検査する。
 * @postcondition 成功・取消理由と状態の不一致を拒否する。
 * @effect N/A: 値の検査だけ。
 * @failure 不正shapeと相関はfalse。
 * @invariant 清掃評価を状態だけから推定しない。
 * @boundary 保存JSONの共通検証。
 * @security 固定理由以外の本文を許可しない。
 * @concurrency N/A: 同期処理だけ。
 */
export function validOutcome(value: unknown): boolean {
  if (value === null) return true;
  if (
    !hasExecutionStateRecordKeys(value, [
      "status",
      "reason",
      "cleanupConfirmed",
    ])
  )
    return false;
  const outcome = value as NonNullable<ExecutionOperationRecord["outcome"]>;
  return (
    typeof outcome.cleanupConfirmed === "boolean" &&
    finalReasons.has(outcome.reason) &&
    (outcome.status === "completed"
      ? outcome.reason === "provider_operation_completed"
      : outcome.status === "cancelled"
        ? outcome.reason === "provider_operation_cancelled"
        : outcome.status === "blocked" &&
          ![
            "provider_operation_completed",
            "provider_operation_cancelled",
          ].includes(outcome.reason))
  );
}

/**
 * 要求前終了・通常終端・専用認証unknown終了の資源終結を共同評価する。
 * @responsibility 後続利用側が資源一値だけから限定終了を推定しないようにする。
 * @trace ARCH-000008
 * @input operation: 現在Decoderで構造と相関を確認したTask。
 * @returns 要求前終了の限定条件、通常終端、または専用相関付きauth不存在を含む全終端ならtrue。
 * @precondition 保存の真正性と物理観測は各Ownerが確認する。
 * @postcondition Task成功・配送・Host清掃を単独で確定しない。
 * @effect N/A: 同期値判定だけ。
 * @failure 未終端・専用Hash差・限定条件差はfalse。
 * @invariant auth request unknownをidentifiedや未発行へ変更しない。
 * @boundary 保存モデルとHost・履歴・配送・次受付の共同条件。
 * @security 専用Writerを迂回する保存は別の物理Guardで拒否する。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function areTaskResourcesSettled(
  operation: ExecutionOperationRecord,
): boolean {
  const book = operation.resources;
  if (!book)
    return (
      operation.phase !== "executing" &&
      operation.execution.providerStart === "not_started" &&
      operation.execution.externalSend === "not_issued" &&
      operation.execution.sharedWrite === "not_issued" &&
      operation.execution.ownerEffect === "disabled" &&
      ((operation.outcome?.status === "blocked" &&
        operation.outcome.cleanupConfirmed) ||
        // 技術要求前の終了。実Home解放とHost回収は別条件であり、元失敗を消す必要はない。
        (operation.resources === null &&
          operation.phase === "settling" &&
          ["held", "released"].includes(operation.lease) &&
          operation.outcome === null &&
          (operation.primaryFailure === null ||
            (operation.primaryFailure.commandHandleObtained === false &&
              operation.primaryFailure.responseObserved === false &&
              operation.primaryFailure.receiptRecorded === false &&
              operation.primaryFailure.commandObservation == null)) &&
          operation.summarySha256 === null &&
          operation.history === null &&
          isDockerRestartCheckpointSettled(operation.dockerRestart)))
    );
  if (book.checkpoints.every(resourceIsSettled)) return true;
  const hash = authenticationClosureEvidence(operation);
  return (
    hash !== null &&
    book.checkpoints.every(
      (resource) =>
        resourceIsSettled(resource) ||
        (resource.key === "create_subscription_auth_probe" &&
          resource.observation === "absent" &&
          resource.absenceEvidenceSha256 === hash &&
          book.snapshot.resources.find((r) => r.key === resource.key)?.identity
            .dockerId === null),
    )
  );
}

/**
 * 保持引渡しの時刻と閉じた三用途値を検査する。
 * @responsibility 期限欠測・時刻補完・Node検査の独自再定義を拒否する。
 * @trace ARCH-000008
 * @input value: JSON境界を通ったreceipt候補。
 * @returns 正規時刻・exact7日・少なくとも一保持実体がある場合だけtrue。
 * @precondition 元checkpoint相関・実観測は別に確認する。
 * @postcondition 現在時計や期限超過から値を変更しない。
 * @effect N/A: 同期の値検査だけ。
 * @failure 不正形・日付範囲外・差1ms・三用途不正はfalse。
 * @invariant 時刻は処置Authorityや保存確定の証明ではない。
 * @boundary 条件付きreceiptの保存Schema。
 * @security Path・余剰fieldを受理しない。
 * @concurrency N/A: 入力を変更しない。
 */
export function validRepairRetentionReceipt(
  value: unknown,
): value is RepairRetentionReceipt {
  if (
    !hasExecutionStateRecordKeys(value, ["decidedAt", "reviewAfter", "targets"])
  )
    return false;
  const receipt = value as RepairRetentionReceipt;
  if (
    typeof receipt.decidedAt !== "string" ||
    typeof receipt.reviewAfter !== "string"
  )
    return false;
  const time = Date.parse(receipt.decidedAt);
  const review = Date.parse(receipt.reviewAfter);
  const targets = decodeEnvironmentRepairRetentionTargets(receipt.targets);
  return (
    Number.isFinite(time) &&
    Number.isFinite(review) &&
    review - time === 604800000 &&
    new Date(time).toISOString() === receipt.decidedAt &&
    new Date(review).toISOString() === receipt.reviewAfter &&
    targets !== null &&
    Object.values(targets).some((target) => target !== null)
  );
}

/**
 * 保持receiptを元修復の用途別実体と再照合する。
 * @responsibility present消失・用途交換・保持不要の過剰拒否を防ぐ。
 * @trace ARCH-000008
 * @input receipt: 検査済み保持値、checkpoint: 実decoderを通った元技術値。
 * @returns 三用途が対応actionと実体へ正確に投影される場合だけtrue。
 * @precondition fresh読取りと明示保持は上位が別に確認する。
 * @postcondition expected非nullの正規absentを受理する。
 * @effect N/A: 値比較のみ。
 * @failure 不明・実体差・action不一致はfalse。
 * @invariant 元presentを用途内nullへ丸めない。
 * @boundary 技術checkpointと保持引渡し候補。
 * @security 一致を実保存・削除許可にしない。
 * @concurrency N/A: 同期比較。
 */
export function repairRetentionMatchesCheckpoint(
  receipt: RepairRetentionReceipt,
  checkpoint: RepairCheckpoint,
): boolean {
  return (["primary", "failed", "auxiliary"] as const).every((purpose) => {
    const pair = checkpoint.directories[purpose];
    const action =
      checkpoint.actions[
        purpose === "primary"
          ? "retain_runtime"
          : purpose === "failed"
            ? "retain_failed_runtime"
            : "retain_auxiliary_runtime"
      ];
    const target = receipt.targets[purpose];
    return pair.retained.state === "present"
      ? action.intent === "saved" &&
          action.request === "issued" &&
          action.result === "confirmed" &&
          pair.expected !== null &&
          target !== null &&
          encodeStateValue(pair.expected) ===
            encodeStateValue(pair.retained.identity) &&
          encodeStateValue(target) === encodeStateValue(pair.expected)
      : pair.retained.state === "absent" &&
          action.request === "not_issued" &&
          action.result === "not_required" &&
          target === null;
  });
}

export const repairReasons = new Set([
  "docker_repair_recovered",
  "docker_repair_failed_closed",
  "docker_repair_boundary_unavailable",
  "docker_repair_state_unavailable",
  "docker_repair_observation_unknown",
  "docker_repair_effect_unknown",
  "docker_repair_cancelled",
  "docker_repair_cleanup_unknown",
]);

/**
 * 修復の終了要約へ進める共同条件を検査する。
 * @responsibility 保存値の終端条件をTask条件と分離する。
 * @trace ARCH-000008
 * @input operation: 復号済み修復。
 * @returns 成功終端または回収結果まで確定した失敗Snapshotだけtrue。
 * @precondition Identityとcheckpointは外側codecで確認する。
 * @postcondition 実行中・回収待ちを固定せず、失敗のunknown・判断待ちは維持する。
 * @effect N/A: 値の検査のみ。
 * @failure 共同条件の欠測・不一致はfalse。
 * @invariant trueは現在の実資源観測や引渡しの証明ではない。
 * @boundary 修復状態と非Authorityの終了要約。
 * @security 技術処置を許可しない。
 * @concurrency N/A: 同期処理。
 */
export function repairCanSummarize(operation: RepairOperationRecord): boolean {
  if (
    operation.phase === "settling" &&
    operation.disposition !== "pending_human_decision" &&
    operation.checkpoint !== null &&
    ["confirmed", "unknown"].includes(operation.checkpoint.cleanup) &&
    (operation.outcome?.status === "blocked" ||
      operation.outcome?.status === "cancelled")
  )
    return validRepairSummary(
      JSON.parse(repairSummaryBytes(operation).toString("utf8")),
    );
  return (
    operation.phase === "settling" &&
    operation.outcome?.status === "recovered" &&
    operation.outcome.cleanupConfirmed &&
    operation.primaryFailure === null &&
    operation.disposition !== "pending_human_decision" &&
    (operation.disposition !== "discard" ||
      (operation.disposal !== null &&
        isRepairDisposalSettled(operation.disposal.checkpoint))) &&
    operation.checkpoint?.engine === "ready" &&
    operation.checkpoint.hostSafety === "safe" &&
    operation.checkpoint.cleanup === "confirmed" &&
    operation.checkpoint.cleanupFailure === null &&
    isRepairCheckpointSettled(operation.checkpoint)
  );
}

/**
 * Docker Task回復IDを技術的な相関成分へ解析する。
 * @responsibility 三成分の固定文法を検査し、解析結果から操作Authorityを発行しない。
 * @trace ARCH-000008
 */
export const DOCKER_TASK_RECOVERY_ID =
  /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u;

export const OPERATION_IDENTITY_SCHEMA =
  "crdd-coordinator/operation-identity/v6";

/**
 * この保存モデルが受け取るSHA-256文字列を検査する。
 * @responsibility 一般Helperを公開せず、保存値の固定文法だけを検査する。
 * @trace ARCH-000008
 * @input value: 未信頼値。
 * @returns 小文字64桁hexの場合だけtrue。
 * @precondition 任意の値を受け取り、ObjectのPropertyを読まない。
 * @postcondition trueの場合だけ元の値を文字列として扱える。
 * @effect N/A: 共有状態や外部資源を変更しない。
 * @failure 不正文法・非文字列はfalse。強制変換や例外を使わない。
 * @invariant 大小文字・空白・桁数を補正しない。
 * @boundary N/A: 再起動要求相関の値検査だけ。
 * @security Hash文法の一致から処置許可や真正性を推定しない。
 * @concurrency N/A: 同期局所処理で共有状態を持たない。
 */
export function recoveryIsSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

export const commandPurposes = [
  ...Object.keys(purposeResource),
  "start_subscription_auth_probe_attached",
  "connect_proxy_egress",
  "start_proxy",
  "start_provider_attached",
];

export const failureStages = [
  "submission_record",
  "command_restriction",
  "command_start",
  "provider_start_observation",
  "command_wait",
  "execution_classification",
  "resource_receipt_record",
  "subscription_auth_verification",
  "provider_result_normalization",
];

/**
 * Executorが技術要求前に返す既存の拒否理由と、保存する失敗段階。
 * @responsibility 未開始結果を自由な失敗語彙へ拡張せず、元理由を保持する。
 * @trace ARCH-000008
 * @invariant この分類だけから未発行、Home解放又はHost回収を推定しない。
 */
const ATTEMPT_START_FAILURE_STAGES = Object.freeze({
  docker_process_controller_plan_invalid: "plan_validation",
  docker_process_controller_recovery_unavailable: "home_lock",
  docker_process_controller_home_lock_initialization_failed: "home_lock",
  docker_process_controller_home_lock_descriptor_close_unconfirmed: "home_lock",
});

export const finalReasons = new Set<string>([
  ...dockerProcessControllerPublicCompletionReasons,
  ...Object.keys(ATTEMPT_START_FAILURE_STAGES),
  "provider_operation_completed",
  "provider_operation_cancelled",
]);

/**
 * 復号済み資源の現在記録が既存の終了条件を満たすか判定する。
 * @responsibility 履歴・配送・操作除去・次操作で同じ資源終了条件を使用する。
 * @trace ARCH-000008
 * @input resource: 現在状態Decoderが構造と相関を確認した一資源。
 * @returns 未要求・未発行、または実ID確定後の不存在だけtrue。
 * @precondition resourceは復号済み現在操作に属する。
 * @postcondition 作成結果不明を不存在観測だけで終了可能へ変換しない。
 * @effect N/A: 同期値判定のみ。
 * @failure 未終了の要求・観測はfalse。
 * @invariant 実資源観測・保存許可を発行せず、cleanup更新入口の条件を変更しない。
 * @boundary 検証済み保存記録と終端可否の判定。
 * @security 記録の終了条件は処置Authorityや実不存在の証明ではない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function resourceIsSettled(
  resource: OperationResources["checkpoints"][number],
): boolean {
  return (
    resource.submission === "none" ||
    resource.submission === "not_issued" ||
    (resource.receiptSource !== null && resource.observation === "absent")
  );
}

/**
 * 専用不存在記録の再導出可能な相関Hashを生成する。
 * @responsibility 履歴本文を蓄積せず、同じIdentity・再起動・四観測へ結合する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderで確認済みのTask。
 * @returns 専用Hash、または限定条件不成立のnull。
 * @precondition 実観測と元版保証は専用Writerが別に所有する。
 * @postcondition 通常absenceのHash形式を変更しない。
 * @effect N/A: 同期Hash計算だけ。
 * @failure 不正Identity・限定条件不成立はnull。
 * @invariant 元版相関は既存CASへ委ね、過去本文を追加保持しない。
 * @boundary 専用記録と後続の共同終了判定。
 * @security Hashは観測の真正性やAuthorityを発行しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function authenticationClosureEvidence(
  operation: ExecutionOperationRecord,
): string | null {
  if (!canCloseUnknownAuthentication(operation)) return null;
  const identity = JSON.parse(operation.identityJson);
  const resource = operation.resources?.snapshot.resources.find(
    (item) => item.key === "create_subscription_auth_probe",
  );
  if (resource?.identity.kind !== "container" || !resource.identity.name)
    return null;
  return createHash("sha256")
    .update(
      encodeStateValue({
        domain: "crdd-coordinator/authentication-unknown-absence/v1",
        identitySha256: operation.identitySha256,
        recoveryId: operation.recoveryId,
        purpose: "create_subscription_auth_probe",
        plannedResourceName: resource.identity.name,
        ownershipLabel: identity.ownershipLabel,
        dockerId: null,
        restart: operation.dockerRestart,
        observations: [
          { round: 1, name: "absent", name_label: "absent" },
          { round: 2, name: "absent", name_label: "absent" },
        ],
      }),
    )
    .digest("hex");
}

/**
 * 現在状態を使わず修復要約の閉集合を検査する。
 * @responsibility Taskと異なるID・結果・技術投影を単独で検証する。
 * @trace ARCH-000008
 * @input value: JSONから得た要約。
 * @returns 今回の有限な修復要約だけtrue。
 * @precondition 呼出し元がcanonical JSON境界を確認する。
 * @postcondition 成功へunknownを混ぜず、失敗の未知値は有限相関のまま保持する。
 * @effect N/A: 値検査のみ。
 * @failure 不正shape・相関はfalse。
 * @invariant 復号成功を実修復や保持物引渡しにしない。
 * @boundary 履歴の自己完結する投影契約。
 * @security Path・Owner・Scope・Task情報の混入を拒否する。
 * @concurrency N/A: 同期処理。
 */
export function validRepairSummary(value: unknown): boolean {
  const hasRetention =
    value !== null &&
    typeof value === "object" &&
    Object.hasOwn(value, "retention");
  const discard =
    value !== null &&
    typeof value === "object" &&
    (value as { disposition?: unknown }).disposition === "discard";
  if (
    !hasExecutionStateRecordKeys(value, [
      "schema",
      "operationId",
      "operationNonce",
      "recoveryId",
      "identitySha256",
      "primaryFailure",
      "outcome",
      "disposition",
      "technical",
      ...(discard ? ["disposal"] : []),
      ...(hasRetention ? ["retention"] : []),
    ])
  )
    return false;
  const summary = value as {
    schema: unknown;
    operationId: unknown;
    operationNonce: unknown;
    recoveryId: unknown;
    identitySha256: unknown;
    primaryFailure: unknown;
    disposition: unknown;
    retention?: unknown;
    disposal?: {
      decidedAt: unknown;
      checkpoint: unknown;
    };
    outcome: { status: unknown; reason: unknown; cleanupConfirmed: unknown };
    technical: {
      actions: Record<
        string,
        { intent: unknown; request: unknown; result: unknown }
      >;
      engine: unknown;
      stale: unknown;
      hostSafety: unknown;
      cleanup: unknown;
      cleanupFailure: unknown;
    };
  };
  if (
    discard &&
    (!hasExecutionStateRecordKeys(summary.disposal, [
      "decidedAt",
      "checkpoint",
    ]) ||
      typeof summary.disposal?.decidedAt !== "string" ||
      !Number.isFinite(Date.parse(summary.disposal.decidedAt)) ||
      new Date(summary.disposal.decidedAt).toISOString() !==
        summary.disposal.decidedAt ||
      !decodeEnvironmentRepairDisposalCheckpoint(summary.disposal.checkpoint) ||
      !isRepairDisposalSettled(summary.disposal.checkpoint))
  )
    return false;
  const technical = summary.technical;
  if (
    hasRetention &&
    (!validRepairRetentionReceipt(summary.retention) ||
      summary.disposition !== "retained_by_human_decision" ||
      summary.outcome?.status !== "recovered" ||
      summary.primaryFailure !== null)
  )
    return false;
  const names = [
    "stop_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ];
  if (
    hasExecutionStateRecordKeys(summary.outcome, [
      "status",
      "reason",
      "cleanupConfirmed",
    ]) &&
    (summary.outcome.status === "blocked" ||
      summary.outcome.status === "cancelled")
  ) {
    const failure = summary.primaryFailure as {
      stage: unknown;
      reason: unknown;
    } | null;
    return (
      summary.schema === "crdd-coordinator/repair-summary/v1" &&
      typeof summary.operationId === "string" &&
      /^OP-[0-9]{6,}$/u.test(summary.operationId) &&
      isSha256Hex(summary.operationNonce) &&
      isSha256Hex(summary.identitySha256) &&
      summary.recoveryId ===
        `docker-repair.${summary.operationNonce}.${summary.identitySha256}` &&
      typeof summary.outcome.reason === "string" &&
      repairReasons.has(summary.outcome.reason) &&
      summary.outcome.reason !== "docker_repair_recovered" &&
      (summary.outcome.status === "cancelled") ===
        (summary.outcome.reason === "docker_repair_cancelled") &&
      (failure === null ||
        (hasExecutionStateRecordKeys(failure, ["stage", "reason"]) &&
          ["preparation", "checkpoint", "repair", "delivery"].includes(
            failure.stage as string,
          ) &&
          failure.reason === summary.outcome.reason)) &&
      (summary.outcome.status !== "cancelled" || failure === null) &&
      hasExecutionStateRecordKeys(technical, [
        "actions",
        "engine",
        "stale",
        "hostSafety",
        "cleanup",
        "cleanupFailure",
      ]) &&
      ["unobserved", "ready", "unavailable", "unknown"].includes(
        technical.engine as string,
      ) &&
      ["safe", "manual_recovery_required", "unknown"].includes(
        technical.hostSafety as string,
      ) &&
      ["confirmed", "unknown"].includes(technical.cleanup as string) &&
      [
        null,
        "operation_cleanup_unknown",
        "observation_cleanup_unknown",
      ].includes(technical.cleanupFailure as string | null) &&
      (technical.cleanupFailure !== "observation_cleanup_unknown" ||
        technical.cleanup === "unknown") &&
      summary.outcome.cleanupConfirmed ===
        (technical.cleanup === "confirmed") &&
      ((technical.stale === "retained" &&
        summary.disposition === "retained_by_human_decision") ||
        (["absent", "unknown"].includes(technical.stale as string) &&
          summary.disposition === "not_applicable")) &&
      hasExecutionStateRecordKeys(technical.actions, names) &&
      names.every((name, index) => {
        const action = technical.actions[name];
        if (
          !action ||
          !hasExecutionStateRecordKeys(action, [
            "intent",
            "request",
            "result",
          ]) ||
          !["not_saved", "saved"].includes(action.intent as string) ||
          !["not_issued", "issued", "unknown"].includes(
            action.request as string,
          ) ||
          !["unobserved", "not_required", "confirmed", "unknown"].includes(
            action.result as string,
          )
        )
          return false;
        if (
          action.intent === "not_saved" &&
          (action.request !== "not_issued" ||
            !["unobserved", "not_required"].includes(action.result as string))
        )
          return false;
        if (
          action.request === "unknown"
            ? action.result !== "unknown"
            : action.request === "not_issued"
              ? !["unobserved", "not_required"].includes(
                  action.result as string,
                )
              : action.intent !== "saved" || action.result === "not_required"
        )
          return false;
        return (
          action.intent !== "saved" ||
          names
            .slice(0, index)
            .every((previous) =>
              ["confirmed", "not_required"].includes(
                technical.actions[previous]?.result as string,
              ),
            )
        );
      }) &&
      (technical.stale !== "absent" ||
        [
          "retain_runtime",
          "retain_failed_runtime",
          "retain_auxiliary_runtime",
        ].every((name) => technical.actions[name]?.result !== "confirmed"))
    );
  }
  return (
    summary.schema === "crdd-coordinator/repair-summary/v1" &&
    typeof summary.operationId === "string" &&
    /^OP-[0-9]{6,}$/u.test(summary.operationId) &&
    isSha256Hex(summary.operationNonce) &&
    isSha256Hex(summary.identitySha256) &&
    summary.recoveryId ===
      `docker-repair.${summary.operationNonce}.${summary.identitySha256}` &&
    summary.primaryFailure === null &&
    hasExecutionStateRecordKeys(summary.outcome, [
      "status",
      "reason",
      "cleanupConfirmed",
    ]) &&
    summary.outcome.status === "recovered" &&
    summary.outcome.reason === "docker_repair_recovered" &&
    summary.outcome.cleanupConfirmed === true &&
    hasExecutionStateRecordKeys(technical, [
      "actions",
      "engine",
      "stale",
      "hostSafety",
      "cleanup",
      "cleanupFailure",
    ]) &&
    technical.engine === "ready" &&
    technical.hostSafety === "safe" &&
    technical.cleanup === "confirmed" &&
    technical.cleanupFailure === null &&
    ((technical.stale === "absent" &&
      summary.disposition === "not_applicable") ||
      (technical.stale === "retained" &&
        ["retained_by_human_decision", "discard"].includes(
          summary.disposition as string,
        ))) &&
    hasExecutionStateRecordKeys(technical.actions, names) &&
    names.every((name) => {
      const action = technical.actions[name];
      return (
        action !== undefined &&
        hasExecutionStateRecordKeys(action, ["intent", "request", "result"]) &&
        ((action.result === "confirmed" &&
          action.intent === "saved" &&
          action.request === "issued") ||
          (action.result === "not_required" &&
            (action.intent === "not_saved" || action.intent === "saved") &&
            action.request === "not_issued"))
      );
    }) &&
    (!hasRetention ||
      (["primary", "failed", "auxiliary"] as const).every((purpose) => {
        const receipt = summary.retention as RepairRetentionReceipt;
        const action =
          technical.actions[
            purpose === "primary"
              ? "retain_runtime"
              : purpose === "failed"
                ? "retain_failed_runtime"
                : "retain_auxiliary_runtime"
          ];
        return receipt.targets[purpose] === null
          ? action?.request === "not_issued" && action.result === "not_required"
          : action?.intent === "saved" &&
              action.request === "issued" &&
              action.result === "confirmed";
      })) &&
    (technical.stale !== "absent" ||
      [
        "retain_runtime",
        "retain_failed_runtime",
        "retain_auxiliary_runtime",
      ].every((name) => technical.actions[name]?.result !== "confirmed"))
  );
}

/**
 * 認証create結果不明の限定終了に必要な保存条件を共同評価する。
 * @responsibility 通常回収を緩めず、同じTaskの完全再起動と未実行条件を要求する。
 * @trace ARCH-000008
 * @input operation: 現在Decoderで相関確認済みのTask。
 * @returns 専用不存在観測へ進める保存条件だけが成立すればtrue。
 * @precondition 物理Owner・排他・CLI終端は呼出し側が別に確認する。
 * @postcondition 実不存在・保存許可・Task完了を発行しない。
 * @effect N/A: 同期値検査だけ。
 * @failure 不正相関、auth以外の未終端、未確定再起動はfalse。
 * @invariant unknownと未発行を区別し、blocked再起動をfenceにしない。
 * @boundary 現在保存値と専用回収Owner。
 * @security 保存値から物理処置Authorityを生成しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function canCloseUnknownAuthentication(
  operation: ExecutionOperationRecord,
): boolean {
  try {
    const book = operation.resources;
    const auth = book?.checkpoints.find(
      (item) => item.key === "create_subscription_auth_probe",
    );
    const authResource = book?.snapshot.resources.find(
      (item) => item.key === "create_subscription_auth_probe",
    );
    const restart = operation.dockerRestart;
    const identity = JSON.parse(operation.identityJson);
    return (
      operation.phase !== "executing" &&
      book !== null &&
      auth?.submission === "intent_saved" &&
      authResource?.identity.dockerId === null &&
      auth.receiptSource === null &&
      auth.observation !== "present" &&
      book.checkpoints.every(
        (item) => item === auth || resourceIsSettled(item),
      ) &&
      operation.execution.providerStart === "not_started" &&
      operation.execution.externalSend === "not_issued" &&
      operation.execution.sharedWrite === "not_issued" &&
      operation.execution.ownerEffect === "disabled" &&
      operation.execution.workspaceReusable === false &&
      restart?.request === "confirmed" &&
      restart.cleanup === "confirmed" &&
      restart.result?.status === "completed" &&
      restart.result.request === "confirmed" &&
      restart.result.effectOutcomeUnknown === false &&
      createDockerRestartRequestId(
        identity.repositoryBinding,
        operation.identitySha256,
        operation.recoveryId,
        restart.scopeSha256,
      ) === restart.requestId
    );
  } catch {
    return false;
  }
}

/**
 * Readerが確認した操作に同じ版の判定を添える。
 * @responsibility 既存検査を一正本のまま使用し、操作種別ごとの事実を混ぜない。
 * @trace ARCH-000008
 * @input operation: 正常Readerが取得した保存済み操作。
 * @returns 同じ操作参照と不変の判定値。
 * @precondition SnapshotのSchemaと本文はReaderが確認している。
 * @postcondition 保存本文・操作参照・実資源を変更しない。
 * @effect N/A: 同期の値投影だけ。
 * @failure 既存検査のfalseを成功へ補完しない。
 * @invariant 値上の判定を実体観測やAuthorityへ昇格しない。
 * @boundary 保存Readerから利用側への同版の観測。
 * @security 秘密値や別操作の情報を追加しない。
 * @concurrency 同じReaderの返却値と一緒にだけ使用する。
 */
export function projectOperationState(
  operation: OperationRecord,
): OperationState {
  if (operation.kind === "host_operation")
    return Object.freeze({
      kind: operation.kind,
      operation,
      cleanupSettled:
        operation.phase === "terminal" && operation.cleanup === "confirmed",
    });
  return operation.kind === "docker_task"
    ? Object.freeze({
        kind: operation.kind,
        operation,
        resourcesSettled: areTaskResourcesSettled(operation),
        restartSettled: isDockerRestartCheckpointSettled(
          operation.dockerRestart,
        ),
        authenticationClosureAllowed: canCloseUnknownAuthentication(operation),
      })
    : Object.freeze({
        kind: operation.kind,
        operation,
        disposalSettled: isRepairDisposalSettled(
          operation.disposal?.checkpoint,
        ),
      });
}

/**
 * 保存された資源集合の形と相関を確認する。実在や削除許可は判定しない。
 * @responsibility Identityの重複を作らず、非秘密Snapshotとkey別checkpointを結合する。
 * @trace ARCH-000008
 * @effect N/A: JSON値の純粋検査だけ。
 * @failure 旧配列形式、欠測・重複key、秘密値を含み得る未正規化fieldは拒否する。
 */
export function validateResourceBook(
  value: unknown,
  comparison?: Readonly<{ before: unknown }>,
): value is OperationResources | null {
  if (comparison !== undefined) {
    const captured = snapshotStateRecord(comparison, new Set(["before"]));
    return (
      captured !== null &&
      Object.hasOwn(captured, "before") &&
      validateResourceBook(captured.before) &&
      validateResourceBookTransition(
        captured.before,
        value as OperationResources | null,
      )
    );
  }
  if (value === null) return true;
  if (
    !hasExecutionStateRecordKeys(value, ["snapshot", "checkpoints", "cleanup"])
  )
    return false;
  const book = value as OperationResources;
  if (
    !hasExecutionStateRecordKeys(book.snapshot, ["resources"]) ||
    !Array.isArray(book.snapshot.resources) ||
    !Array.isArray(book.checkpoints) ||
    book.snapshot.resources.length === 0 ||
    book.snapshot.resources.length !== book.checkpoints.length ||
    !hasExecutionStateRecordKeys(book.cleanup, [
      "cleanupOrder",
      "setupTimeoutMs",
      "unreceiptedAbsence",
      "verifyLabelAbsence",
    ]) ||
    !Array.isArray(book.cleanup.cleanupOrder) ||
    !Number.isSafeInteger(book.cleanup.setupTimeoutMs) ||
    book.cleanup.setupTimeoutMs <= 0 ||
    !["retain", "observe"].includes(book.cleanup.unreceiptedAbsence) ||
    typeof book.cleanup.verifyLabelAbsence !== "boolean"
  )
    return false;
  const keys = new Set<string>();
  const resourceNames = new Set<string>();
  for (const resource of book.snapshot.resources) {
    if (
      !hasExecutionStateRecordKeys(resource, [
        "key",
        "identity",
        "request",
        "configuration",
      ]) ||
      typeof resource.key !== "string" ||
      resource.key.length === 0 ||
      keys.has(resource.key) ||
      !hasExecutionStateRecordKeys(resource.identity, [
        "kind",
        "dockerId",
        "name",
        "ownershipLabel",
      ]) ||
      !["container", "network"].includes(resource.identity.kind) ||
      (resource.identity.dockerId !== null &&
        !isSha256Hex(resource.identity.dockerId)) ||
      typeof resource.identity.name !== "string" ||
      !resource.identity.name ||
      typeof resource.identity.ownershipLabel !== "string" ||
      !resource.identity.ownershipLabel ||
      !["not_issued", "issued", "unknown"].includes(resource.request) ||
      (resource.request === "issued" && resource.identity.dockerId === null) ||
      (resource.request === "not_issued" &&
        resource.identity.dockerId !== null) ||
      !hasExecutionStateRecordKeys(resource.configuration, [
        "image",
        "command",
        "environmentNames",
        "mounts",
        "networks",
        "internal",
      ])
    )
      return false;
    const resourceName = `${resource.identity.kind}\0${resource.identity.name}`;
    if (resourceNames.has(resourceName)) return false;
    resourceNames.add(resourceName);
    keys.add(resource.key);
    const c = resource.configuration;
    if (
      (c.image !== null && typeof c.image !== "string") ||
      (c.command !== null &&
        (!Array.isArray(c.command) ||
          c.command.some((v: unknown) => v !== "<redacted>"))) ||
      (c.environmentNames !== null &&
        (!Array.isArray(c.environmentNames) ||
          c.environmentNames.some(
            (v: unknown) =>
              typeof v !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(v),
          ))) ||
      (c.networks !== null &&
        (!Array.isArray(c.networks) ||
          c.networks.some((v: unknown) => typeof v !== "string"))) ||
      (c.internal !== null && typeof c.internal !== "boolean") ||
      (c.mounts !== null &&
        (!Array.isArray(c.mounts) ||
          c.mounts.some(
            (v: unknown) =>
              !hasExecutionStateRecordKeys(v, [
                "source",
                "target",
                "readOnly",
              ]) ||
              typeof (v as { source: unknown }).source !== "string" ||
              typeof (v as { target: unknown }).target !== "string" ||
              typeof (v as { readOnly: unknown }).readOnly !== "boolean",
          )))
    )
      return false;
  }
  const checkpointKeys = new Set<string>();
  for (const checkpoint of book.checkpoints) {
    if (
      !hasExecutionStateRecordKeys(checkpoint, [
        "key",
        "submission",
        "receiptSource",
        "observation",
        "absenceEvidenceSha256",
      ]) ||
      !keys.has(checkpoint.key) ||
      checkpointKeys.has(checkpoint.key) ||
      !["none", "intent_saved", "not_issued"].includes(checkpoint.submission) ||
      (checkpoint.receiptSource !== null &&
        !["docker_create_result", "docker_observation"].includes(
          checkpoint.receiptSource,
        )) ||
      !["unobserved", "present", "absent", "unknown"].includes(
        checkpoint.observation,
      ) ||
      (checkpoint.absenceEvidenceSha256 !== null &&
        !isSha256Hex(checkpoint.absenceEvidenceSha256))
    )
      return false;
    checkpointKeys.add(checkpoint.key);
    const resource = book.snapshot.resources.find(
      (r) => r.key === checkpoint.key,
    );
    if (
      !resource ||
      (checkpoint.receiptSource !== null &&
        resource.identity.dockerId === null) ||
      (resource.identity.dockerId !== null &&
        checkpoint.receiptSource === null) ||
      (checkpoint.submission !== "intent_saved" &&
        (resource.request !== "not_issued" ||
          resource.identity.dockerId !== null ||
          checkpoint.observation !== "unobserved" ||
          checkpoint.absenceEvidenceSha256 !== null)) ||
      (checkpoint.observation === "absent") !==
        (checkpoint.absenceEvidenceSha256 !== null)
    )
      return false;
  }
  return (
    book.cleanup.cleanupOrder.length === keys.size &&
    new Set(book.cleanup.cleanupOrder).size === keys.size &&
    book.cleanup.cleanupOrder.every((key) => keys.has(key))
  );
}

/**
 * 元資源の識別情報と既知IDを保持したまま観測を更新する。
 * @responsibility 初回Intentの原子確定と既知事実の巻戻し拒否を所有する。
 * @trace ARCH-000008
 * @effect N/A: 値の比較だけ。構成差を回収拒否へ転化しない。
 * @postcondition 次値の形と遷移を一体で検査し、更新側で同じ次値を再検査しない。
 */
export function validateResourceBookTransition(
  before: OperationResources | null,
  after: unknown,
): after is OperationResources | null {
  if (!validateResourceBook(after)) return false;
  if (before === null)
    return (
      after === null ||
      (after.checkpoints.filter((c) => c.submission === "intent_saved")
        .length === 1 &&
        after.checkpoints.every(
          (c) =>
            c.submission !== "not_issued" &&
            c.receiptSource === null &&
            c.observation === "unobserved",
        ) &&
        after.snapshot.resources.every((r) => r.identity.dockerId === null))
    );
  if (
    after === null ||
    encodeStateValue(before.cleanup) !== encodeStateValue(after.cleanup) ||
    before.snapshot.resources.length !== after.snapshot.resources.length
  )
    return false;
  for (const resource of after.snapshot.resources) {
    const previous = before.snapshot.resources.find(
      (r) => r.key === resource.key,
    );
    const checkpoint = after.checkpoints.find((c) => c.key === resource.key);
    const prior = before.checkpoints.find((c) => c.key === resource.key);
    if (
      !previous ||
      !checkpoint ||
      !prior ||
      resource.identity.kind !== previous.identity.kind ||
      resource.identity.name !== previous.identity.name ||
      resource.identity.ownershipLabel !== previous.identity.ownershipLabel ||
      (previous.identity.dockerId !== null &&
        resource.identity.dockerId !== previous.identity.dockerId) ||
      (prior.receiptSource !== null &&
        checkpoint.receiptSource !== prior.receiptSource) ||
      (prior.submission !== checkpoint.submission &&
        !["none:intent_saved", "intent_saved:not_issued"].includes(
          `${prior.submission}:${checkpoint.submission}`,
        ))
    )
      return false;
  }
  return true;
}
