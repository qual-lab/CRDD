/**
 * 元の回復参照が不明な空Host領域の保守候補を評価する。
 *
 * @responsibility 人間の限定承認と現在の根拠条件を評価し、未確認を実行可能へ畳まない。
 * @trace ARCH-000008
 */
import { types as utilTypes } from "node:util";

/**
 * 保守候補の判定に必要な閉じた根拠集合を定義する。
 *
 * @responsibility 承認、対象、非使用、排他、耐久意図を別の条件として保持する。
 * @trace ARCH-000008
 * @shape Hashで固定した単一対象と、条件ごとの確認結果。
 * @invariant 未記載、未知値および観測不能は確認済みを意味しない。
 * @boundary 信頼された観測実装から内部判定への入力境界。
 * @security 入力自体はAuthorityではなく、判定結果から削除権限を発行しない。
 * @compatibility v1は空のhost_only領域だけに限定し、未知の資源クラスを拒否する。
 */
export type HostOrphanRecoveryEvidence = Readonly<{
  resourceClass: "empty_host_only_v1";
  snapshotSha256: string;
  approval: "fresh_exact" | "missing" | "denied" | "unknown";
  ownerScope: "confirmed" | "mismatch" | "unknown";
  identity: "exact" | "mismatch" | "unknown";
  recordState: "host_only" | "other" | "unknown";
  children: "six_empty_exact" | "different" | "unknown";
  dockerBinding: "absent" | "present" | "unknown";
  nonUse: "confirmed" | "in_use" | "unknown";
  initializationFence: "confirmed" | "missing" | "unknown";
  legacyFence: "confirmed" | "not_needed" | "missing" | "unknown";
  kernelLock: "held" | "busy" | "unknown";
  durableIntent:
    | "exact_non_authority_checkpoint"
    | "missing"
    | "mismatch"
    | "unknown";
}>;

/**
 * 実行権限を持たない候補判定を表す。
 *
 * @responsibility 条件充足と実処置・清掃完了を明示的に分離する。
 * @trace ARCH-000008
 * @shape candidate_readyまたはblocked、理由、対象Hash、非発行の固定field。
 * @invariant 全結果でAuthority非発行、清掃未確認、本番経路未接続を維持する。
 * @boundary 内部設計候補だけに利用し、公開Recovery結果として返さない。
 * @security 回復Token、Host Pathまたは削除Capabilityを含まない。
 * @compatibility 完成済みRecoveryのrecovered／cleanupConfirmed:trueへ変換してはならない。
 */
export type HostOrphanRecoveryPlan = Readonly<{
  status: "candidate_ready" | "blocked";
  reason: string;
  snapshotSha256: string | null;
  authorityConferred: false;
  cleanupConfirmed: false;
  productionConnected: false;
}>;

const REQUIRED_GATES = Object.freeze({
  approval: ["fresh_exact"],
  ownerScope: ["confirmed"],
  identity: ["exact"],
  recordState: ["host_only"],
  children: ["six_empty_exact"],
  dockerBinding: ["absent"],
  nonUse: ["confirmed"],
  initializationFence: ["confirmed"],
  legacyFence: ["confirmed", "not_needed"],
  kernelLock: ["held"],
  durableIntent: ["exact_non_authority_checkpoint"],
} as const);

/**
 * 渡された根拠集合を保守候補の条件と照合する。
 *
 * @responsibility 条件の欠落、差替え、観測不能を拒否し、充足時も候補判定だけを返す。
 * @trace ARCH-000008
 * @input 信頼された観測実装が生成する根拠集合の候補値。
 * @returns Authorityを持たない固定された候補判定。
 * @precondition N/A: 不正な値も受け取り、未知または未確認として拒否する。
 * @postcondition 元のRecovery IDを生成せず、実行や清掃成立を主張しない。
 * @effect N/A: Filesystem、Process、Lock、Providerを操作しない純粋な判定である。
 * @failure Proxy、Accessor、未知field、欠落および条件不成立をblockedとして返す。
 * @invariant inputの値や外部状態を変更せず、観測の実在性を自己証明しない。
 * @boundary 内部Policyの入力／判定境界。本番観測・CLIは未接続。
 * @security Hashや確認値をBearer権限へ変換せず、元TaskのAuthorityを再構成しない。
 * @concurrency N/A: 外部資源を所有せず、同期的に入力のown data fieldだけを照合する。
 */
export function evaluateHostOrphanRecoveryPlan(
  input: unknown,
): HostOrphanRecoveryPlan {
  let snapshotSha256: string | null = null;
  let reason = "host_orphan_evidence_invalid";
  if (
    input !== null &&
    typeof input === "object" &&
    !utilTypes.isProxy(input) &&
    !Array.isArray(input)
  ) {
    const prototype = Object.getPrototypeOf(input);
    const descriptors = Object.getOwnPropertyDescriptors(input);
    const allowed = new Set([
      "resourceClass",
      "snapshotSha256",
      ...Object.keys(REQUIRED_GATES),
    ]);
    const keys = Reflect.ownKeys(input);
    if (
      (prototype === Object.prototype || prototype === null) &&
      keys.length === allowed.size &&
      keys.every(
        (key) =>
          typeof key === "string" &&
          allowed.has(key) &&
          Object.hasOwn(descriptors[key] ?? {}, "value"),
      )
    ) {
      const hash: unknown = descriptors.snapshotSha256?.value;
      if (typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash)) {
        snapshotSha256 = hash;
        reason = "host_orphan_resource_class_unsupported";
        if (descriptors.resourceClass?.value === "empty_host_only_v1") {
          reason = "host_orphan_candidate_conditions_satisfied";
          for (const [gate, expected] of Object.entries(REQUIRED_GATES)) {
            const observed: unknown = descriptors[gate]?.value;
            if (
              typeof observed !== "string" ||
              !(expected as readonly string[]).includes(observed)
            ) {
              reason = `host_orphan_${gate}_unconfirmed`;
              break;
            }
          }
        }
      }
    }
  }
  return Object.freeze({
    status:
      reason === "host_orphan_candidate_conditions_satisfied"
        ? "candidate_ready"
        : "blocked",
    reason,
    snapshotSha256,
    authorityConferred: false,
    cleanupConfirmed: false,
    productionConnected: false,
  });
}
