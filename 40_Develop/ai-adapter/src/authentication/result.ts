/**
 * Provider認証Probeの出力をSubscription成立条件へ分類する。
 *
 * @responsibility Provider固有の出力意味を判定し、実行・回収・Authorityを所有しない。
 * @trace ARCH-000010
 * @boundary 未信頼のCLI出力とProvider分類の境界。
 * @effect N/A: 入力文字列だけを分類する。
 * @security 生出力を公開結果や例外へ複製しない。
 */
import { parseUnambiguousJsonDocument } from "../provider/json.ts";
import type { AiProvider } from "../provider/types.ts";

/**
 * 認証確認の結果を、否定と観測不能を分けて表す。
 * @responsibility 認証確認値だけを返し、実行許可や認証情報を持たない。
 * @trace ARCH-000010
 * @shape Provider、確認状態と閉じた理由。
 * @invariant unknownを未認証の実証または確認済みへ丸めない。
 * @boundary CLI出力と認証確認利用側。
 * @security 生出力を含めない。
 * @compatibility confirmedの既存成功条件を維持する。
 */
export type ProviderAuthenticationResult = Readonly<
  {
    provider: AiProvider;
  } & (
    | { status: "confirmed"; reason: "subscription_auth_confirmed" }
    | { status: "unconfirmed"; reason: "subscription_auth_not_logged_in" }
    | {
        status: "unknown";
        reason:
          | "subscription_auth_output_invalid"
          | "subscription_auth_offering_mismatch";
      }
  )
>;

/**
 * Provider認証Probeの出力をSubscription成立条件へ分類する。
 *
 * @responsibility 期待Offeringと固定Providerの認証Probe出力の一致を確認する。
 * @trace ARCH-000010
 * @input Provider、期待Offering、観測済みCLI出力、login又はexecutionの確認目的。
 * @returns 固定条件のconfirmed、正規の否定を示すunconfirmed、観測不能のunknown。
 * @precondition Process終了・出力量・取消は呼出し側が先に評価する。
 * @postcondition Provider生出力と実行Authorityを返さない。
 * @effect N/A: 同期の入力分類だけを行う。
 * @failure Offering不一致、不正または未認識の出力はunknown。Providerの正規未ログイン出力だけをunconfirmedとする。
 * @invariant executionではforcedLoginMethodも確認する。loginも厳密JSON解析で曖昧な重複を拒否する。
 * @boundary CLI出力の意味分類と実資源Lifecycleを分離する。
 * @security 秘密値、任意生出力、Process Capabilityを公開しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function evaluateProviderAuthentication(
  provider: AiProvider,
  expectedOffering: "chatgpt_subscription_oauth" | "claude_max",
  stdout: string,
  stderr: string,
  purpose: "login" | "execution" = "execution",
): ProviderAuthenticationResult {
  const invalidOutput: ProviderAuthenticationResult = Object.freeze({
    provider,
    status: "unknown",
    reason: "subscription_auth_output_invalid",
  });
  const offeringMismatch: ProviderAuthenticationResult = Object.freeze({
    provider,
    status: "unknown",
    reason: "subscription_auth_offering_mismatch",
  });
  if (provider === "codex") {
    if (expectedOffering !== "chatgpt_subscription_oauth")
      return offeringMismatch;
    const normalize = (value: string) => {
      if (value.includes("\0")) return null;
      const normalized = value.replaceAll("\r\n", "\n");
      if (normalized.includes("\r")) return null;
      return normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
    };
    const normalizedStdout = normalize(stdout);
    const normalizedStderr = normalize(stderr);
    if (normalizedStdout === null || normalizedStderr === null)
      return invalidOutput;
    const status = "Logged in using ChatGPT";
    const readOnlyAliasWarning =
      "WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)";
    const isConfirmed =
      (normalizedStdout === status && normalizedStderr === "") ||
      (normalizedStdout === "" && normalizedStderr === status) ||
      (normalizedStdout === status &&
        normalizedStderr === readOnlyAliasWarning) ||
      (normalizedStdout === "" &&
        normalizedStderr === `${readOnlyAliasWarning}\n${status}`);
    if (isConfirmed)
      return Object.freeze({
        provider,
        status: "confirmed",
        reason: "subscription_auth_confirmed",
      });
    if (
      normalizedStdout === "" &&
      (normalizedStderr === "Not logged in" ||
        normalizedStderr === `${readOnlyAliasWarning}\nNot logged in`)
    )
      return Object.freeze({
        provider,
        status: "unconfirmed",
        reason: "subscription_auth_not_logged_in",
      });
    return invalidOutput;
  }
  if (expectedOffering !== "claude_max") return offeringMismatch;
  const parsed = parseUnambiguousJsonDocument(stdout);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return invalidOutput;
  const status = parsed as Record<string, unknown>;
  const isConfirmed =
    status.loggedIn === true &&
    status.authMethod === "claude.ai" &&
    status.apiProvider === "firstParty" &&
    (purpose === "login" || status.forcedLoginMethod === "claudeai") &&
    status.subscriptionType === "max";
  if (isConfirmed)
    return Object.freeze({
      provider,
      status: "confirmed",
      reason: "subscription_auth_confirmed",
    });
  if (status.loggedIn === false && stderr === "")
    return Object.freeze({
      provider,
      status: "unconfirmed",
      reason: "subscription_auth_not_logged_in",
    });
  return invalidOutput;
}
