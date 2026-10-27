/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { DockerRuntimeRepairCheckpoint } from "./repair-types.ts";
import type { RepairAction } from "./repair-types.ts";
import type { DockerRuntimeRepairDisposalCheckpoint } from "./repair-types.ts";
import { types } from "node:util";
import type { DirectoryIdentity } from "./repair-types.ts";
import type { DirectoryObservation } from "./repair-types.ts";
import type { DockerRuntimeRepairRetentionTargets } from "./repair-types.ts";

/**
 * 有限な修復checkpointを独立した凍結DTOへ復号する。
 * @responsibility 意図・発行・結果・九処置順序と退避実体を共同検証する。
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
export function decodeDockerRuntimeRepairCheckpoint(
  value: unknown,
): DockerRuntimeRepairCheckpoint | null {
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
  const actionValues = capture(record.actions, actions);
  const directoryValues = capture(record.directories, directories);
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
      "helper_cleanup_unknown",
      "helper_protocol_failed",
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
  const capturedActions = {} as Record<(typeof actions)[number], RepairAction>;
  for (const [index, key] of actions.entries()) {
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
      !actions
        .slice(0, index)
        .every((previous) => settled(capturedActions[previous]))
    )
      return null;
    capturedActions[key] = Object.freeze(action) as RepairAction;
  }
  const capturedDirectories = {} as Record<
    (typeof directories)[number],
    DockerRuntimeRepairCheckpoint["directories"]["primary"]
  >;
  for (const key of directories) {
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
  const retained = directories.some(
    (key) => capturedDirectories[key].retained.state === "present",
  );
  const absent = directories.every(
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
  }) as DockerRuntimeRepairCheckpoint;
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
export function decodeDockerRuntimeRepairDisposalCheckpoint(
  value: unknown,
): DockerRuntimeRepairDisposalCheckpoint | null {
  const record = capture(value, ["directories"]);
  const values = record ? capture(record.directories, directories) : null;
  if (!values) return null;
  const result = {} as Record<
    (typeof directories)[number],
    DockerRuntimeRepairDisposalCheckpoint["directories"]["primary"]
  >;
  for (const purpose of directories) {
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
export function dockerRuntimeRepairDisposalIsSettled(value: unknown): boolean {
  const checkpoint = decodeDockerRuntimeRepairDisposalCheckpoint(value);
  return (
    checkpoint !== null &&
    directories.every(
      (purpose) =>
        checkpoint.directories[purpose].intent === "saved" &&
        checkpoint.directories[purpose].absence === "confirmed_absent",
    )
  );
}

/**
 * 九処置が確認済みまたは明示不要であるかを検査する。
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
export function dockerRuntimeRepairCheckpointIsSettled(
  value: unknown,
): boolean {
  const checkpoint = decodeDockerRuntimeRepairCheckpoint(value);
  return (
    checkpoint !== null &&
    actions.every((key) => settled(checkpoint.actions[key]))
  );
}

export const actions = Object.freeze([
  "stop_runtime",
  "terminate_runtime",
  "stop_backend",
  "retain_runtime",
  "start_runtime",
  "stop_failed_runtime",
  "retain_failed_runtime",
  "retain_auxiliary_runtime",
  "restart_runtime",
] as const);

export const directories = Object.freeze([
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
export function decodeDockerRuntimeRepairRetentionTargets(
  value: unknown,
): DockerRuntimeRepairRetentionTargets | null {
  const record = capture(value, directories);
  if (!record) return null;
  const targets: Record<
    (typeof directories)[number],
    DirectoryIdentity | null
  > = {
    primary: null,
    failed: null,
    auxiliary: null,
  };
  for (const purpose of directories) {
    const target = record[purpose] === null ? null : identity(record[purpose]);
    if (record[purpose] !== null && target === null) return null;
    targets[purpose] = target;
  }
  return Object.freeze(targets);
}
