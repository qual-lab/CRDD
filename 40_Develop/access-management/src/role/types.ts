/**
 * 採用済み三Roleの識別型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

/**
 * 最小ユーザーに割り当てる一つの管理Role。
 *
 * @responsibility 採用済み三Roleの識別値を所有する。
 * @trace ARCH-000013
 * @shape developer、manager、administratorのliteral union。
 * @invariant 一ユーザーの現在Roleは一つで、Credential別の追加Roleを作らない。
 * @boundary Access Managementの固定管理判定。
 * @security 値だけでは認証・対象存在・実行Authorityを証明しない。
 * @compatibility 旧management Profileとは別の新Role契約である。
 */
export type AccessRole = "developer" | "manager" | "administrator";
