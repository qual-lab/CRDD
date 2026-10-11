/**
 * 明示Workspace範囲を所有済みの固定集合へ検査する。
 * @responsibility 採用済み管理契約を既存Ownerへ接続する。
 * @trace ARCH-000013
 */
import { types } from "node:util";

/**
 * Workspace配列を詳細走査前に制限して複製する。
 * @responsibility Proxy・accessor・余分field・未知値・重複を拒否する。
 * @trace ARCH-000013
 * @input 信頼しない配列。
 * @returns development／management集合、またはnull。
 * @precondition N/A: 未検査のunknownを受け取り、外部認可を判定しない。
 * @postcondition 入力状態と対象Repository本文を変更しない。
 * @effect N/A: descriptor検査とメモリだけ。
 * @failure 不正形式はnull。descriptor取得の例外は呼出し元へ伝播する。
 * @invariant 登録、公開設定、内容認可、実アクセスを同一視しない。
 * @boundary Role内容とExposureの共通入力。
 * @security 秘密・内部Pathを公開結果へ透過しない。
 * @concurrency N/A: 外部状態を持たない同期検査と複製。
 */
export function readWorkspaceIds(
  value: unknown,
): ("development" | "management")[] | null {
  if (types.isProxy(value) || !Array.isArray(value)) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isInteger(length) || length < 0 || length > 2) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).length !== length + 1) return null;
  const result: ("development" | "management")[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item: unknown = descriptor.value;
    if (item !== "development" && item !== "management") return null;
    if (result.includes(item)) return null;
    result.push(item);
  }
  return result;
}
