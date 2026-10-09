/**
 * Provider認証Probeの出力をSubscription成立条件へ分類する。
 *
 * @packageDocumentation
 * @responsibility Provider固有の出力意味を判定し、実行・回収・Authorityを所有しない。
 * @trace ARCH-000010
 * @boundary 未信頼のCLI出力とProvider分類の境界。
 * @effect N/A: 入力文字列だけを分類する。
 * @security 生出力を公開結果や例外へ複製しない。
 */
import { parseUnambiguousJsonDocument } from "../output/unambiguous-json-document.ts";

/**
 * Provider認証Probeの出力をSubscription成立条件へ分類する。
 *
 * @responsibility 期待Offeringと固定Providerの認証Probe出力の一致を確認する。
 * @trace ARCH-000010
 * @input Provider、期待Offering、観測済みCLIの標準出力・標準エラー。
 * @returns 固定されたSubscription認証条件を満たす場合だけtrue。
 * @precondition Process終了・出力量・取消は呼出し側が先に評価する。
 * @postcondition Provider生出力と実行Authorityを返さない。
 * @effect N/A: 同期の入力分類だけを行う。
 * @failure Offering不一致、不正または未認識の出力ではfalseを返す。
 * @invariant 既存のOffering一致、出力形式と判定順序を保持する。
 * @boundary CLI出力の意味分類と実資源Lifecycleを分離する。
 * @security 秘密値、任意生出力、Process Capabilityを公開しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function isProviderSubscriptionAuthenticationConfirmed(
  provider: "codex" | "claude",
  expectedOffering: "chatgpt_subscription_oauth" | "claude_max",
  stdout: string,
  stderr: string,
) {
  if (provider === "codex") {
    if (expectedOffering !== "chatgpt_subscription_oauth") return false;
    const normalize = (value: string) => {
      if (value.includes("\0")) return null;
      const normalized = value.replaceAll("\r\n", "\n");
      if (normalized.includes("\r")) return null;
      return normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
    };
    const normalizedStdout = normalize(stdout);
    const normalizedStderr = normalize(stderr);
    if (normalizedStdout === null || normalizedStderr === null) return false;
    const status = "Logged in using ChatGPT";
    const readOnlyAliasWarning =
      "WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)";
    return (
      (normalizedStdout === status && normalizedStderr === "") ||
      (normalizedStdout === "" && normalizedStderr === status) ||
      (normalizedStdout === status &&
        normalizedStderr === readOnlyAliasWarning) ||
      (normalizedStdout === "" &&
        normalizedStderr === `${readOnlyAliasWarning}\n${status}`)
    );
  }
  if (expectedOffering !== "claude_max") return false;
  const parsed = parseUnambiguousJsonDocument(stdout);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    return false;
  const status = parsed as Record<string, unknown>;
  return (
    status.loggedIn === true &&
    status.authMethod === "claude.ai" &&
    status.apiProvider === "firstParty" &&
    status.forcedLoginMethod === "claudeai" &&
    status.subscriptionType === "max"
  );
}
