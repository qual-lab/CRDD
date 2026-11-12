/**
 * 通信設定と読取り結果の値契約。
 * @responsibility 通信設定と読取り結果の値契約だけを所有する。
 * @trace ARCH-000011
 */
/**
 * Repositoryが宣言する非秘密の追加Hostを表す。
 * @responsibility 版と不変の文字列配列を定義し、通信許可を発行しない。
 * @trace ARCH-000011
 * @shape version=1、allowedHosts。
 * @invariant 空配列は追加Hostなし。
 * @boundary 設定JSONと利用側。
 * @security この値は認可ではない。
 * @compatibility 既存Schemaを維持する。
 */
export type NetworkPolicy = Readonly<{
  version: 1;
  allowedHosts: readonly string[];
}>;

/**
 * 設定の読取り状態を表す。
 * @responsibility 不在・有効File・不正・観測不能を分離する。
 * @trace ARCH-000011
 * @shape readyにはpolicyとsource、fileだけ生Hash。blockedには固定reasonだけ。
 * @invariant blockedに設定やHashを返さない。
 * @boundary Repository Filesystemと呼出し元。
 * @security Path・本文・認可を公開しない。
 * @compatibility 既定値は真正不存在だけ。0-byte Fileは不正。
 */
export type NetworkPolicyReadResult =
  | Readonly<
      {
        status: "ready";
        policy: NetworkPolicy;
      } & (
        | { source: "default"; sourceFileHash: null }
        | { source: "file"; sourceFileHash: string }
      )
    >
  | Readonly<{
      status: "blocked";
      reason: "network_policy_invalid" | "network_policy_unavailable";
    }>;
