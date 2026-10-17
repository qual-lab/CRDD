/**
 * 実行環境修復の有限な技術checkpointを検査する。
 * @packageDocumentation
 * @responsibility 要求意図・発行・結果と退避実体の相関を保存Ownerへ渡す。
 * @trace ARCH-000008
 * @boundary 純粋な技術値だけ。保存、許可、人間判断とOS処置は所有しない。
 */
import { types } from "node:util";

const actions = [
  "stop_runtime",
  "terminate_runtime",
  "stop_backend",
  "retain_runtime",
  "start_runtime",
  "stop_failed_runtime",
  "retain_failed_runtime",
  "retain_auxiliary_runtime",
  "restart_runtime",
] as const;
const directories = ["primary", "failed", "auxiliary"] as const;

/**
 * 一技術処置の保存意図、発行観測、結果観測を分離する。
 * @responsibility 未発行と発行不明を同じ値へ畳まない。
 * @trace ARCH-000008
 * @shape intent、request、resultの有限な組。
 * @invariant 値は実処置許可や実完了の証明ではない。
 * @boundary 保存Ownerと修復Machineの値契約。
 * @security 任意コマンド・Path・生応答を持たない。
 * @compatibility 最新構造だけを受理する。
 */
type RepairAction = Readonly<{
  intent: "not_saved" | "saved";
  request: "not_issued" | "issued" | "unknown";
  result: "unobserved" | "not_required" | "confirmed" | "unknown";
}>;

/**
 * 処置対象Directoryの非秘密な実体相関。
 * @responsibility 同名の別実体を期待した対象と混同しない。
 * @trace ARCH-000008
 * @shape dev、ino、birthtimeNsの正の十進文字列。
 * @invariant HashやPathだけを実体確認へ代用しない。
 * @boundary 技術観測と保存値。
 * @security 生Pathと処置Authorityを持たない。
 * @compatibility OS数値を丸めない文字列表現だけ。
 */
type DirectoryIdentity = Readonly<{
  dev: string;
  ino: string;
  birthtimeNs: string;
}>;

/**
 * 不存在、未観測、観測不能と存在を区別する。
 * @responsibility 不明値を不存在へ変換しない。
 * @trace ARCH-000008
 * @shape stateと存在時だけのidentity。
 * @invariant present以外に実体値を捏造しない。
 * @boundary 現在観測の値契約。
 * @security 値から削除・再利用許可を発行しない。
 * @compatibility 最新の四状態だけ。
 */
type DirectoryObservation = Readonly<{
  state: "unobserved" | "absent" | "present" | "unknown";
  identity: DirectoryIdentity | null;
}>;

/**
 * 修復Machineが所有し保存Ownerへ渡す技術状態。
 * @responsibility 固定九処置と三用途の世代実体、現在結果と回収失敗を保持する。
 * @trace ARCH-000008
 * @shape actions、directories、engine、stale、hostSafety、cleanup、cleanupFailure。
 * @invariant 人間の保持判断・Task/Home/Provider・任意Pathは含めない。
 * @boundary 下位Machineと上位の永続化境界。
 * @security 復号成功は実資源観測・排他・実行許可ではない。
 * @compatibility 旧Journal・署名chain・OS別phaseを受理しない。
 */
export type DockerRuntimeRepairCheckpoint = Readonly<{
  actions: Readonly<Record<(typeof actions)[number], RepairAction>>;
  directories: Readonly<
    Record<
      (typeof directories)[number],
      Readonly<{
        expected: DirectoryIdentity | null;
        source: DirectoryObservation;
        retained: DirectoryObservation;
      }>
    >
  >;
  engine: "unobserved" | "ready" | "unavailable" | "unknown";
  stale: "absent" | "retained" | "unknown";
  hostSafety: "safe" | "manual_recovery_required" | "unknown";
  cleanup: "not_requested" | "pending" | "confirmed" | "unknown";
  cleanupFailure:
    | "helper_cleanup_unknown"
    | "helper_protocol_failed"
    | "observation_cleanup_unknown"
    | null;
}>;

/**
 * 元修復結果とは独立した三退避先の回収進捗。
 * @responsibility 意図保存・要求履歴・不存在観測を分離する。
 * @trace ARCH-000008
 * @shape 固定三用途ごとにintent、request、absenceを保持する。
 * @invariant 過去の要求不明を現在の不存在確認で消さない。
 * @boundary DIの純粋技術値と上位の専用保存Owner。
 * @security 実体、Scope、Path、Authority、保持判断を複製しない。
 * @compatibility 元の九処置checkpointとは別の最新値契約。
 */
export type DockerRuntimeRepairDisposalCheckpoint = Readonly<{
  directories: Readonly<
    Record<
      (typeof directories)[number],
      Readonly<{
        intent: "not_saved" | "saved";
        request: "not_issued" | "issued" | "unknown";
        absence: "unobserved" | "confirmed_absent" | "unknown";
      }>
    >
  >;
}>;

/**
 * 明示保持する三退避先の非Authority照合値。
 * @responsibility 用途内の明示不存在と全体の観測失敗を区別する。
 * @trace ARCH-000008
 * @shape 三用途それぞれにNode実体または明示不存在のnull。
 * @invariant Path・Scope・処置許可を持たず、NodeとNativeの単位を混用しない。
 * @boundary DI固定読取りと上位の明示保持receipt。
 * @security 明示保持限定の非秘密metadata。
 * @compatibility 現行checkpointと固定nonceの三用途だけ。
 */
export type DockerRuntimeRepairRetentionTargets = Readonly<
  Record<(typeof directories)[number], DirectoryIdentity | null>
>;

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
function capture(
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
function identity(value: unknown): DirectoryIdentity | null {
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
function observation(value: unknown): DirectoryObservation | null {
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
function settled(action: RepairAction): boolean {
  return action.result === "confirmed" || action.result === "not_required";
}

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
export function validateDockerRuntimeRepairCheckpointTransition(
  beforeValue: unknown,
  afterValue: unknown,
): boolean {
  const before = decodeDockerRuntimeRepairCheckpoint(beforeValue);
  const after = decodeDockerRuntimeRepairCheckpoint(afterValue);
  if (!before || !after) return false;
  for (const key of actions) {
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
  for (const key of directories) {
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
 * @invariant actions・Directory実体・Engine・保持・安全性・失敗を変更しない。
 * @boundary fresh準備の技術候補と保存Owner。
 * @security 候補は取得・保存・実処置Authorityではない。
 * @concurrency N/A: 共有状態なし。
 */
export function prepareDockerRuntimeRepairSessionCheckpoint(
  value: unknown,
): DockerRuntimeRepairCheckpoint | null {
  const before = decodeDockerRuntimeRepairCheckpoint(value);
  if (before?.cleanup !== "confirmed" || before.cleanupFailure !== null)
    return null;
  return decodeDockerRuntimeRepairCheckpoint({ ...before, cleanup: "pending" });
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
export function validateDockerRuntimeRepairSessionCheckpoint(
  beforeValue: unknown,
  afterValue: unknown,
): boolean {
  const expected = prepareDockerRuntimeRepairSessionCheckpoint(beforeValue);
  const after = decodeDockerRuntimeRepairCheckpoint(afterValue);
  return (
    expected !== null &&
    after !== null &&
    JSON.stringify(expected) === JSON.stringify(after)
  );
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
export function createDockerRuntimeRepairDisposalCheckpoint(): DockerRuntimeRepairDisposalCheckpoint {
  const result = {} as Record<
    (typeof directories)[number],
    DockerRuntimeRepairDisposalCheckpoint["directories"]["primary"]
  >;
  for (const purpose of directories)
    result[purpose] = Object.freeze({
      intent: "not_saved",
      request: "not_issued",
      absence: "unobserved",
    });
  return Object.freeze({ directories: Object.freeze(result) });
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
export function validateDockerRuntimeRepairDisposalTransition(
  beforeValue: unknown,
  afterValue: unknown,
  purpose: unknown,
): boolean {
  const before = decodeDockerRuntimeRepairDisposalCheckpoint(beforeValue);
  const after = decodeDockerRuntimeRepairDisposalCheckpoint(afterValue);
  if (
    !before ||
    !after ||
    !directories.includes(purpose as (typeof directories)[number])
  )
    return false;
  for (const key of directories) {
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
