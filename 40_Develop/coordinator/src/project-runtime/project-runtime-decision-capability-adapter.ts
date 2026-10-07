/**
 * project-runtime-decision-capability-adapterに属する責務をまとめる。
 *
 * @responsibility hashを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000005
 */
import { createHash, randomBytes } from "node:crypto";

import type { ProjectRuntimeDecisionCapabilityPort } from "../../../project-runtime/src/index.ts";

/**
 * hashを決定する。
 *
 * @responsibility hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input value: string
 * @returns hashの計算結果を返す。
 * @precondition 「value: string」がhashの入力契約を満たす。
 * @postcondition hashの責務を完了した結果だけを返す。
 * @effect N/A: hashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hashは独自の失敗分岐を所有しない。
 * @invariant hashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security hashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hashは共有非同期状態を持たない同期処理である。
 */
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Supply cryptographic capability generation without exposing Node APIs to Project Runtime.
 *
 * @responsibility Project Runtime Decision Capability Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000005
 * @input N/A: 実行時引数を受け取らない。
 * @returns ProjectRuntimeDecisionCapabilityPortを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateProjectRuntimeDecisionCapabilityAdapterの入力契約を満たす。
 * @postcondition createProjectRuntimeDecisionCapabilityAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createProjectRuntimeDecisionCapabilityAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createProjectRuntimeDecisionCapabilityAdapterは独自の失敗分岐を所有しない。
 * @invariant createProjectRuntimeDecisionCapabilityAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createProjectRuntimeDecisionCapabilityAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeDecisionCapabilityAdapterは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeDecisionCapabilityAdapter(): ProjectRuntimeDecisionCapabilityPort {
  return Object.freeze({
    issue: () => {
      const secret = randomBytes(32).toString("base64url");
      return Object.freeze({ secret, hash: hash(secret) });
    },
    hash,
  });
}
