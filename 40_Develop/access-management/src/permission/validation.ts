/**
 * 内容範囲と固定Roleの入力を検査する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { types } from "node:util";
import type { AccessRole } from "../role/types.ts";

/**
 * 内容範囲の配列を詳細走査前に制限して複製する。
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
export function parseContentAreaIds(
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

/**
 * Role値を固定三Roleへ限定する。
 * @responsibility 旧語彙・未知値を既定Roleへ変換しない。
 * @trace ARCH-000013
 * @input 信頼しないRole値。
 * @returns 採用済み三Roleの場合だけtrue。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 暗黙変換しない。
 * @effect N/A: primitive比較だけ。
 * @failure 不正値はfalse。
 * @invariant Role内容設定を固定管理許可にしない。
 * @boundary 通常管理のRole入力。
 * @security 認証・Authorityはこの値から作らない。
 * @concurrency N/A: 局所値だけ。
 */
export function isAccessRole(value: unknown): value is AccessRole {
  return (
    value === "developer" || value === "manager" || value === "administrator"
  );
}
