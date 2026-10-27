/**
 * 実行環境修復の有限な技術checkpointを検査する。
 * @packageDocumentation
 * @responsibility 要求意図・発行・結果と退避実体の相関を保存Ownerへ渡す。
 * @trace ARCH-000008
 * @boundary 純粋な技術値だけ。保存、許可、人間判断とOS処置は所有しない。
 */
import {
  type DockerRuntimeRepairCheckpoint,
  type DockerRuntimeRepairDisposalCheckpoint,
  decodeDockerRuntimeRepairCheckpoint,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  RUNTIME_REPAIR_ACTIONS as actions,
  RUNTIME_REPAIR_DIRECTORIES as directories,
} from "../../../domain-model/src/index.ts";

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
