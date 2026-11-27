/** 生成済みの秘密値と受信値を、同じ長さの場合に定数時間比較する。 @trace ARCH-000012 */
import { timingSafeEqual } from "node:crypto";

export function matchesSecret(
  received: string | null | undefined,
  expected: string,
): boolean {
  return (
    typeof received === "string" &&
    received.length === expected.length &&
    timingSafeEqual(
      Buffer.from(received, "utf16le"),
      Buffer.from(expected, "utf16le"),
    )
  );
}
