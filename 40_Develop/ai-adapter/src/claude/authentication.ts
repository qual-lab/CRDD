/**
 * Claude Subscriptionの認証方式と結果解釈を所有する。
 *
 * @packageDocumentation
 * @responsibility CLI引数・固定認証環境とProbe判定を公開し、Process・Home・回収を所有しない。
 * @trace ARCH-000010
 * @boundary Claude CLIとCoordinatorの認証実行の間。
 */

/**
 * Claude Subscriptionの認証用CLI引数を記述する。
 *
 * @responsibility loginとnetwork-none status ProbeのProvider固有引数・固定環境だけを所有する。
 * @trace ARCH-000010
 * @input N/A: 固定公式CLIの認証方式を記述する。
 * @returns 不変なlogin／status引数、固定認証環境と専用Homeの相対名。
 * @precondition N/A: Home、秘密値、実行Capabilityを受け取らない。
 * @postcondition Docker資源名・Mount・Proxy Tokenを含まない。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant API Key認証や別OfferingへのFallbackを追加しない。
 * @boundary AI AdapterのCLI記述とCoordinatorの認証実行の間。
 * @security SecretとHost Pathを返さない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeClaudeSubscriptionAuthenticationCli() {
  return Object.freeze({
    loginArgv: Object.freeze(["auth", "login", "--claudeai"]),
    statusArgv: Object.freeze(["auth", "status", "--json"]),
    homeDirectoryName: "claude" as const,
    environment: Object.freeze({
      DISABLE_AUTOUPDATER: "1",
      DISABLE_UPDATES: "1",
      DISABLE_TELEMETRY: "1",
      DISABLE_ERROR_REPORTING: "1",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
    }),
  });
}

/**
 * Claude認証ProbeがMax契約を確認したか判定する。
 *
 * @responsibility Provider出力を固定4 Propertyの成功条件へ縮約する。
 * @trace ARCH-000010
 * @input stdout: network-none ProbeのJSON出力
 * @returns exactなClaude Max状態だけでtrueを返す。
 * @precondition 出力は未信頼文字列として扱う。
 * @postcondition trueは四つの固定値がすべて一致した場合に限る。
 * @effect N/A: 入力文字列だけを解析する。
 * @failure JSON不正や値不一致はfalseへ閉じる。
 * @invariant 部分一致や追加の認証方式を成功へ昇格しない。
 * @boundary Claude CLI出力から認証Domain判定への境界。
 * @security 生出力を例外または公開結果へ含めない。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
export function isClaudeSubscriptionAuthenticationConfirmed(stdout: string) {
  try {
    const value = JSON.parse(stdout) as Record<string, unknown>;
    return (
      value.loggedIn === true &&
      value.authMethod === "claude.ai" &&
      value.apiProvider === "firstParty" &&
      value.subscriptionType === "max"
    );
  } catch {
    return false;
  }
}
