/**
 * 実行状態の共有値・純粋検査を所有する。
 * @packageDocumentation
 * @responsibility 既存の保存形状・相関・三値を保持し、実行・資源観測・Authorityを発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary 保存値の意味だけ。OS・Provider・Dockerの操作は所有しない。
 */

import type { actions } from "./repair-validation.ts";
import type { directories } from "./repair-validation.ts";

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
 * 一技術処置の保存意図、発行観測、結果観測を分離する。
 * @responsibility 未発行と発行不明を同じ値へ畳まない。
 * @trace ARCH-000008
 * @shape intent、request、resultの有限な組。
 * @invariant 値は実処置許可や実完了の証明ではない。
 * @boundary 保存Ownerと修復Machineの値契約。
 * @security 任意コマンド・Path・生応答を持たない。
 * @compatibility 最新構造だけを受理する。
 */
export type RepairAction = Readonly<{
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
export type DirectoryIdentity = Readonly<{
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
export type DirectoryObservation = Readonly<{
  state: "unobserved" | "absent" | "present" | "unknown";
  identity: DirectoryIdentity | null;
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
