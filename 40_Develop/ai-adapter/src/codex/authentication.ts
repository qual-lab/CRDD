/**
 * Codex Subscriptionの認証確認用CLI記述を所有する。
 *
 * @packageDocumentation
 * @responsibility Provider固有引数とHome変数名を記述し、認証の実行・観測を所有しない。
 * @trace ARCH-000010
 * @boundary AI Adapterの固定CLI記述とCoordinatorの認証確認実行の間。
 */

/**
 * Codex Subscriptionの認証確認用CLI引数とHome変数名を返す。
 *
 * @responsibility 公式CLIのlogin statusとCODEX_HOMEだけを記述する。
 * @trace ARCH-000010
 * @input N/A: 固定CLIの認証方式を記述する。
 * @returns 不変な認証確認引数、Home環境変数名と専用Homeの相対名。
 * @precondition N/A: Home実体、秘密値、実行Capabilityを受け取らない。
 * @postcondition Host Path、Docker資源名、Mountを含まない。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant API Key認証や別OfferingへのFallbackを追加しない。
 * @boundary AI AdapterのCLI記述とCoordinatorの認証確認の間。
 * @security SecretとHost Pathを返さない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeCodexSubscriptionAuthenticationCli() {
  return Object.freeze({
    statusArgv: Object.freeze(["login", "status"]),
    homeEnvironmentVariable: "CODEX_HOME" as const,
    homeDirectoryName: "codex" as const,
  });
}
