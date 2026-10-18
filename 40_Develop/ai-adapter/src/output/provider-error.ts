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
  const stderrReason = classifyDiagnostic(execution.stderr);
  if (stderrReason !== "provider_process_exit_nonzero" || provider !== "codex")
    return stderrReason;
  const messages = codexErrorMessages(execution.stdout);
  return messages === null ? stderrReason : classifyDiagnostic(messages);
}

/**
 * 固定Codexのエラーイベントだけを容量上限内で抽出する。
 * @responsibility 通常回答や未知イベントをエラー説明へ読み替えない。
 * @trace ARCH-000010
 * @input 同じ非0終了の標準出力。
 * @returns 一時的な分類入力、又は不正・欠測のnull。本文は保存しない。
 * @effect N/A: 文字列解析だけ。
 * @failure 過大・NUL・曖昧JSON・未知イベント・不正messageはnull。
 */
function codexErrorMessages(raw: string): string | null {
  if (raw.includes("\0") || Buffer.byteLength(raw, "utf8") > 65_536)
    return null;
  const lines = raw.split(/\r?\n/u).filter((line) => line.length > 0);
  if (lines.length === 0 || lines.length > 128) return null;
  const known = new Set([
    "thread.started",
    "turn.started",
    "turn.completed",
    "turn.failed",
    "error",
    "item.started",
    "item.updated",
    "item.completed",
  ]);
  const messages: string[] = [];
  for (const line of lines) {
    if (Buffer.byteLength(line, "utf8") > 8_192) return null;
    const event = parseUnambiguousJsonDocument(line);
    if (!event || typeof event !== "object" || Array.isArray(event))
      return null;
    const record = event as Record<string, unknown>;
    if (typeof record.type !== "string" || !known.has(record.type)) return null;
    let message: unknown;
    if (record.type === "error") message = record.message;
    else if (record.type === "turn.failed") {
      if (
        !record.error ||
        typeof record.error !== "object" ||
        Array.isArray(record.error)
      )
        return null;
      message = (record.error as Record<string, unknown>).message;
    } else continue;
    if (
      typeof message !== "string" ||
      message.length === 0 ||
      Buffer.byteLength(message, "utf8") > 8_192
    )
      return null;
    messages.push(message);
  }
  const text = messages.join("\n");
  return text.length === 0 || Buffer.byteLength(text, "utf8") > 8_192
    ? null
    : text;
}

/**
 * 診断本文を既存の閉じた失敗理由へ変換する。
 * @responsibility 出力先によらず同じ分類順序を維持し、本文を返さない。
 * @trace ARCH-000010
 * @input 上限確認済みの一時的な説明。
 * @returns 固定理由のみ。
 * @effect N/A: 同期の文字列照合。
 */
function classifyDiagnostic(raw: string) {
  const diagnostic = raw.replaceAll("\r\n", "\n").trim().toLowerCase();
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
    /unknown (?:argument|option)|unexpected (?:argument|option)|invalid (?:argument|option)|json schema (?:is )?invalid|unsupported model|model (?:is )?not found/u.test(
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
