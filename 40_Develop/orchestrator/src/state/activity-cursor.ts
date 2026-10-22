/**
 * 活動ページの出所相関と継続位置を共用する。
 * @responsibility ReaderとValidatorで同じbyte契約を用いる。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import { snapshotPlainArray } from "../input/plain-data-snapshot.ts";
import type { ActivitySource, RuntimeActivityEvent } from "./activity-types.ts";

/**
 * Projectと正規Sourceの相関Hashを導出する。
 * @responsibility 同じ対象集合と改訂のbyte表現を一つにする。
 * @trace ARCH-000004
 * @input Project IDとRepository ID昇順のSource。
 * @returns 64桁のSHA-256相関値。
 * @precondition 同じ要求の検査済みProjectと正規Source集合を使う。
 * @postcondition 出所・ページ境界を推測せず結合する。
 * @effect N/A: 同期値計算だけ。
 * @failure 不正入力は呼出側の境界検査で拒否する。
 * @invariant Cursorを認可や保存Snapshotにしない。
 * @boundary 活動Readerと結果Validatorの内部共用。
 * @security Root・Path・資格を符号化しない。
 * @concurrency N/A: 局所値だけ。
 */
export function deriveActivitySourceCorrelation(
  projectId: string,
  sources: readonly ActivitySource[],
): string {
  return createHash("sha256")
    .update(JSON.stringify([projectId, sources]))
    .digest("hex");
}

/**
 * 継続位置とSource相関を検査する。
 * @responsibility Source相関を認可へ変換せず不正・変更を明示拒否する。
 * @trace ARCH-000004
 * @input Cursor候補と今回の相関Hash。
 * @returns 時刻とEvent ID、または未指定のnull。
 * @precondition 呼出側が今回要求の内容認可を済ませた同ProcessのConsumerである。
 * @postcondition 観測不能を成功へ変換せず、確認した出所だけを保持する。
 * @effect N/A: 値解析だけ。
 * @failure 不正Cursor・Source不一致は固定例外。
 * @invariant 初期化・Task実行・回復・認可発行を行わない。
 * @boundary 実保存Ownerと活動読取りConsumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一要求の観測だけを返し、共有Cacheや固定Snapshotを作らない。
 */
export function decodeActivityCursor(
  cursor: string | undefined,
  sourceHash: string,
): readonly [string, string] | null {
  if (cursor === undefined) return null;
  if (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,1024}$/u.test(cursor))
    throw new Error("runtime_activity_cursor_invalid");
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("runtime_activity_cursor_invalid");
  }
  const parsed = snapshotPlainArray(raw, 3);
  if (
    parsed.status !== "ok" ||
    parsed.value.length !== 3 ||
    typeof parsed.value[0] !== "string" ||
    parsed.value[0].length === 0 ||
    parsed.value[0].length > 64 ||
    !Number.isFinite(Date.parse(parsed.value[0])) ||
    typeof parsed.value[1] !== "string" ||
    !/^execution-[0-9a-f]{64}$/u.test(parsed.value[1]) ||
    parsed.value[2] !== sourceHash
  )
    throw new Error("runtime_activity_cursor_invalid");
  return Object.freeze([parsed.value[0], parsed.value[1]]);
}

/**
 * 返却Page末尾を継続位置へ符号化する。
 * @responsibility 公開済み時刻・IDとSource相関を同じCursorへ閉じる。
 * @trace ARCH-000004
 * @input Page末尾Eventと同要求のSource Hash。
 * @returns URL安全な3要素Cursor。
 * @precondition 同じ要求の検査済みProjectと正規Source集合を使う。
 * @postcondition 出所・ページ境界を推測せず結合する。
 * @effect N/A: 同期値計算だけ。
 * @failure 不正入力は呼出側の境界検査で拒否する。
 * @invariant Cursorを認可や保存Snapshotにしない。
 * @boundary 活動Readerと結果Validatorの内部共用。
 * @security Root・Path・資格を符号化しない。
 * @concurrency N/A: 局所値だけ。
 */
export function encodeActivityCursor(
  event: Pick<RuntimeActivityEvent, "occurredAt" | "eventId">,
  sourceHash: string,
): string {
  return Buffer.from(
    JSON.stringify([event.occurredAt, event.eventId, sourceHash]),
    "utf8",
  ).toString("base64url");
}

/**
 * 活動位置を実時刻とEvent IDの降順で比較する。
 * @responsibility 表示順・ページ境界・Validatorへ同じ比較規則を提供する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @input 検査済みの日時文字列とEvent IDを持つ二位置。
 * @returns leftが先なら負、同instant・同IDなら0、後なら正。
 * @precondition 両日時はDate.parse可能で、Event IDは既存形式である。
 * @postcondition 同instantの場合だけIDを第2キーにする。
 * @effect N/A: 同期値計算だけ。
 * @failure N/A: 検査済みprimitiveを比較する。
 * @invariant 元日時の文字列とEI保存値を変更しない。
 * @boundary 活動Reader・Cursor・Validatorの内部共用。
 * @security Path・資格・Authorityを扱わない。
 * @concurrency N/A: 局所値だけ。
 */
export function compareActivityEventPositions(
  left: Pick<RuntimeActivityEvent, "occurredAt" | "eventId">,
  right: Pick<RuntimeActivityEvent, "occurredAt" | "eventId">,
): number {
  const time = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  return (
    time ||
    (left.eventId < right.eventId ? 1 : left.eventId > right.eventId ? -1 : 0)
  );
}
