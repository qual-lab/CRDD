/**
 * Coordinatorの保存Bindingを導出する。
 * @responsibility 既存Compositionと活動Readerの導出式を一つにする。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";

/**
 * 検証済みRepository Rootの保存Bindingを得る。
 * @responsibility 従来のstable(binding, root)と同じbyte列・長さを保つ。
 * @trace ARCH-000004
 * @input 検証済みのexact Root文字列。
 * @returns 既存形式のbinding ID。
 * @precondition 呼出側が今回要求の入力範囲を確定している。
 * @postcondition 確認できた値だけを返し、観測不能を成功へ変換しない。
 * @effect N/A: 純粋計算だけ。
 * @failure N/A: 固定文字列をHash化する。
 * @invariant 現在状態と履歴の観測を独立保持する。
 * @boundary Coordinator活動Ownerと内部Consumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一回の要求を同期観測し、共有Cacheを持たない。
 */
export function deriveCoordinatorRepositoryBindingId(root: string): string {
  return `binding-${createHash("sha256").update(root).digest("hex").slice(0, 40)}`;
}
