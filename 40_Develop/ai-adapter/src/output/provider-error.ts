/**
 * Providerの非正常終了を生出力を返さず理由分類へ変換する。
 *
 * @packageDocumentation
 * @responsibility Provider固有の出力意味を判定し、実行・回収・Authorityを所有しない。
 * @trace ARCH-000010
 * @boundary 未信頼のCLI出力とProvider分類の境界。
 * @effect N/A: 入力文字列だけを分類する。
 * @security 生出力を公開結果や例外へ複製しない。
 */
import { parseUnambiguousJsonDocument } from "./unambiguous-json-document.ts";

/**
 * Providerの非正常終了を生出力を返さず理由分類へ変換する。
 *
 * @responsibility Provider固有の非正常終了出力を共通の失敗理由へ分類する。
 * @trace ARCH-000010
 * @input Providerと観測済みCLIの標準出力・標準エラー。
 * @returns 既知の失敗分類、または一般の非正常終了理由。
 * @precondition Process終了・出力量・取消は呼出し側が先に評価する。
 * @postcondition Provider生出力と実行Authorityを返さない。
 * @effect N/A: 同期の入力分類だけを行う。
 * @failure 不正または未認識の出力は一般の非正常終了理由へ分類する。
 * @invariant 出力上限、Provider固有の構造化結果と診断の判定順序を保持する。
 * @boundary CLI出力の意味分類と実資源Lifecycleを分離する。
 * @security 秘密値、任意生出力、Process Capabilityを公開しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function classifyProviderNonzeroExit(
  provider: "codex" | "claude",
  execution: Readonly<{ stdout: string; stderr: string }>,
) {
  if (provider === "claude") {
    const envelope = parseUnambiguousJsonDocument(execution.stdout);
    if (
      envelope &&
      typeof envelope === "object" &&
      !Array.isArray(envelope) &&
      (envelope as Record<string, unknown>).type === "result"
    ) {
      const subtype = (envelope as Record<string, unknown>).subtype;
      if (subtype === "error_max_budget_usd")
        return "provider_operation_budget_exceeded";
      if (subtype === "error_max_turns") return "provider_turn_limit_exceeded";
      if (subtype === "error_max_structured_output_retries")
        return "provider_structured_output_retry_exhausted";
    }
  }
  if (
    execution.stderr.includes("\0") ||
    Buffer.byteLength(execution.stderr, "utf8") > 8_192
  )
    return "provider_process_exit_nonzero";
  const diagnostic = execution.stderr
    .replaceAll("\r\n", "\n")
    .trim()
    .toLowerCase();
  if (
    /(?:usage|rate) limit|quota (?:exceeded|exhausted)|credit balance (?:is )?too low|hit your (?:current )?limit/u.test(
      diagnostic,
    )
  )
    return "provider_subscription_quota_exhausted";
  if (
    /authentication (?:failed|required)|oauth (?:token )?expired|not logged in|please (?:run )?(?:\/login|login)|invalid api key/u.test(
      diagnostic,
    )
  )
    return "provider_authentication_expired";
  if (
    /unknown (?:argument|option)|invalid (?:argument|option)|json schema (?:is )?invalid|unsupported model|model (?:is )?not found/u.test(
      diagnostic,
    )
  )
    return "provider_invocation_rejected";
  if (
    /econn(?:refused|reset)|etimedout|enotfound|network error|connection (?:refused|reset|timed out)|proxy (?:connection )?(?:failed|error)/u.test(
      diagnostic,
    )
  )
    return "provider_network_unavailable";
  if (
    /service unavailable|internal server error|overloaded|temporarily unavailable|(?:http |status (?:code )?)5\d\d/u.test(
      diagnostic,
    )
  )
    return "provider_service_unavailable";
  return "provider_process_exit_nonzero";
}
