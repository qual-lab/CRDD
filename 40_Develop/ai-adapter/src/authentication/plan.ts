/**
 * Providerの認証確認用CLI記述を所有する。
 *
 * @packageDocumentation
 * @responsibility Provider別の認証引数とHome変数名を記述し、認証の実行・観測を所有しない。
 * @trace ARCH-000010
 * @boundary AI Adapterの固定認証定義と、Coordinatorの認証条件・診断／Executorの認証実行の間。
 */

import type { Provider } from "../provider/types.ts";

import { PROVIDER_AUTHENTICATION_POLICIES } from "./policy.ts";

/**
 * Providerを識別できる認証方法の定義を表す。
 * @responsibility 実在する認証引数・Home設定だけを公開する。
 * @trace ARCH-000010
 * @shape Provider別の不変定義をProvider識別子で解決する型。
 * @invariant CodexにClaude固有のlogin設定を補完しない。
 * @boundary 公開定義と認証条件・診断・実行の利用側。
 * @security Secret・Host絶対Pathを持たない。
 * @compatibility 固定CLI引数・環境値を維持する。
 */
export type AuthenticationDefinition<P extends Provider = Provider> = Readonly<
  (typeof AUTHENTICATION_DEFINITIONS)[P] & {
    kind: "authentication";
    confirmationPurpose: "login" | "execution";
    policy: (typeof PROVIDER_AUTHENTICATION_POLICIES)[P];
  }
>;

const AUTHENTICATION_DEFINITIONS = Object.freeze({
  codex: Object.freeze({
    provider: "codex" as const,
    offering: "chatgpt_subscription_oauth" as const,
    authorityOrigin: "https://chatgpt.com" as const,
    loginArgv: Object.freeze(["login", "--device-auth"]),
    statusArgv: Object.freeze(["login", "status"]),
    homeEnvironmentVariable: "CODEX_HOME" as const,
    homeDirectoryName: "codex" as const,
  }),
  claude: Object.freeze({
    provider: "claude" as const,
    offering: "claude_max" as const,
    authorityOrigin: "https://claude.ai" as const,
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
  }),
});

/**
 * 指定ProviderのSubscription認証確認方法を返す。
 *
 * @responsibility 固定CLIのstatus引数、Provider固有のlogin引数とHome設定を記述する。
 * @trace ARCH-000010
 * @input provider: 対応するProviderの識別子。confirmationPurpose: login又はexecution。省略時はexecution。
 * @returns 不変な認証確認引数、Home環境変数名と専用Homeの相対名。
 * @precondition N/A: Home実体、秘密値、実行Capabilityを受け取らない。
 * @postcondition Host Path、Docker資源名、Mountを含まない。
 * @effect N/A: 固定値を返すだけである。
 * @failure 未対応Provider又は確認目的はprovider_authentication_input_invalidで拒否する。
 * @invariant API Key認証や別OfferingへのFallbackを追加しない。
 * @boundary AI Adapterの固定認証定義と、Coordinatorの認証条件・診断／Executorの認証実行の間。
 * @security SecretとHost Pathを返さない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function getAuthenticationDefinition<P extends Provider>(
  provider: P,
  confirmationPurpose: "login" | "execution" = "execution",
): AuthenticationDefinition<P> {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (confirmationPurpose !== "login" && confirmationPurpose !== "execution")
  )
    throw new Error("provider_authentication_input_invalid");
  return Object.freeze({
    ...AUTHENTICATION_DEFINITIONS[provider],
    kind: "authentication",
    confirmationPurpose,
    policy: PROVIDER_AUTHENTICATION_POLICIES[provider],
  }) as AuthenticationDefinition<P>;
}
