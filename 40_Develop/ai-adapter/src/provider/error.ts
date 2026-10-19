/**
 * Providerの非正常終了を生出力を返さず理由分類へ変換する。
 *
 * @responsibility Provider固有の出力意味を判定し、実行・回収・Authorityを所有しない。
 * @trace ARCH-000010
 * @boundary 未信頼のCLI出力とProvider分類の境界。
 * @effect N/A: 入力文字列だけを分類する。
 * @security 生出力を公開結果や例外へ複製しない。
 */
import { parseUnambiguousJsonDocument } from "./json.ts";
import type { AiProvider } from "./types.ts";

/**
 * 非正常終了から判別する共通の失敗理由を表す。
 * @responsibility 既存の理由値だけを列挙し、処置や再試行許可を表さない。
 * @trace ARCH-000010
 * @shape 閉じた文字列Union。
 * @invariant 不明な原因を既知の原因へ補完しない。
 * @boundary Provider出力と利用側の失敗理由。
 * @security 生出力・秘密値を含めない。
 * @compatibility 通信上の既存理由値を維持する。
 */
export type ProviderErrorReason =
  | "provider_operation_budget_exceeded"
  | "provider_turn_limit_exceeded"
  | "provider_structured_output_retry_exhausted"
  | "provider_subscription_quota_exhausted"
  | "provider_authentication_expired"
  | "provider_invocation_rejected"
  | "provider_network_unavailable"
  | "provider_service_unavailable"
  | "provider_process_exit_nonzero";

/**
 * Providerの失敗を利用側へ返す共通エラー値を表す。
 * @responsibility Provider識別と分類済み理由を保持する。
 * @trace ARCH-000010
 * @shape Providerと閉じた理由コードの読取り専用構造。
 * @invariant エラー値は再試行・回収の許可ではない。
 * @boundary AI Adapterの公開結果とCoordinatorの一次失敗。
 * @security 生出力・Path・秘密値を返さない。
 * @compatibility 理由値の意味と優先順位は変えない。
 */
export type ProviderError = Readonly<{
  provider: AiProvider;
  reason: ProviderErrorReason;
}>;

/**
 * Providerの非正常終了を生出力を返さず理由分類へ変換する。
 *
 * @responsibility Provider固有の非正常終了出力を共通の失敗理由へ分類する。
 * @trace ARCH-000010
 * @input Providerと観測済みCLIの標準出力・標準エラー。
 * @returns Providerと既知の失敗理由、または一般の非正常終了理由を持つ共通エラー。
 * @precondition Process終了・出力量・取消は呼出し側が先に評価する。
 * @postcondition Provider生出力と実行Authorityを返さない。
 * @effect N/A: 同期の入力分類だけを行う。
 * @failure 不正または未認識の出力は一般の非正常終了理由へ分類する。
 * @invariant 出力上限、Provider固有の構造化結果と診断の判定順序を保持する。
 * @boundary CLI出力の意味分類と実資源Lifecycleを分離する。
 * @security 秘密値、任意生出力、Process Capabilityを公開しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function convertProviderError(
  provider: AiProvider,
  execution: Readonly<{ stdout: string; stderr: string }>,
): ProviderError {
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
        return Object.freeze({
          provider,
          reason: "provider_operation_budget_exceeded",
        });
      if (subtype === "error_max_turns")
        return Object.freeze({
          provider,
          reason: "provider_turn_limit_exceeded",
        });
      if (subtype === "error_max_structured_output_retries")
        return Object.freeze({
          provider,
          reason: "provider_structured_output_retry_exhausted",
        });
    }
  }
  if (
    execution.stderr.includes("\0") ||
    Buffer.byteLength(execution.stderr, "utf8") > 8_192
  )
    return Object.freeze({ provider, reason: "provider_process_exit_nonzero" });
  const stderrReason = classifyDiagnostic(execution.stderr);
  if (stderrReason !== "provider_process_exit_nonzero" || provider !== "codex")
    return Object.freeze({ provider, reason: stderrReason });
  const messages = codexErrorMessages(execution.stdout);
  return Object.freeze({
    provider,
    reason: messages === null ? stderrReason : classifyDiagnostic(messages),
  });
}

/**
 * 固定Codexのエラーイベントだけを容量上限内で抽出する。
 * @responsibility 通常回答や未知イベントをエラー説明へ読み替えない。
 * @trace ARCH-000010
 * @input 同じ非0終了の標準出力。
 * @returns 一時的な分類入力、又は不正・欠測のnull。本文は保存しない。
 * @precondition 呼出し側がCodexの非0終了とstderrの一般分類を観測している。
 * @postcondition 既知のエラー通知だけを上限付きの分類入力へまとめる。
 * @effect N/A: 文字列解析だけ。
 * @failure 過大・NUL・曖昧JSON・未知イベント・不正messageはnull。
 * @invariant 通常のagent_messageを障害説明へ読み替えない。
 * @boundary Codex JSONLから非公開の診断分類入力への変換。
 * @security エラー本文を公開結果・永続記録へ返さない。
 * @concurrency N/A: 解析内の配列だけを使う同期処理。
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
 * @precondition 呼出し側がProviderの非0終了を観測している。
 * @postcondition quota・認証・起動・通信・serviceの既存分類順を保持する。
 * @effect N/A: 同期の文字列照合。
 * @failure 未認識の文面はprovider_process_exit_nonzeroに分類する。
 * @invariant 分類を自動再送や回復許可に変換しない。
 * @boundary 未信頼診断本文と共通の閉じた理由値の間。
 * @security 元の文面や資格情報を返さない。
 * @concurrency N/A: 文字列と正規表現の局所計算だけ。
 */
function classifyDiagnostic(raw: string): ProviderErrorReason {
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
