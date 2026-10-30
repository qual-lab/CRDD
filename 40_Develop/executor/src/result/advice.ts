/**
 * AI Adapterで助言Envelopeと内容を検査する。
 * @packageDocumentation
 * @responsibility Provider差の再実装をせず、共通の試行結果へ変換する。
 * @trace ARCH-000015
 */
import { parseProviderResult } from "../../../ai-adapter/src/index.ts";
import { parseAdviceResult } from "../../../ai-adapter/src/index.ts";
/**
 * 同じ許可参照で助言内容検査まで完了する。
 * @responsibility Provider共通解析と内容検査を一つの内部処理へ接続する。
 * @trace ARCH-000015
 * @input provider、stdout、準備時に固定したallowedReferences。
 * @returns 検査済み内容又は内容なしの固定拒否理由。
 * @precondition 生出力は同じ試行から受け取る。
 * @postcondition 生Envelopeを結果へ残さない。
 * @effect N/A: メモリ内の解析だけ。
 * @failure Envelope不正・内容不正は部分成功へ補完しない。
 * @invariant Provider差と内容正規化はAI Adapterが所有する。
 * @boundary Executor内部から各内容Ownerへの接続。
 * @security 生出力・認証値を保存しない。
 * @concurrency N/A: 共有状態なし。
 */
export function normalizeProviderAdviceOutput(
  provider: "codex" | "claude",
  stdout: string,
  allowedReferences: readonly string[],
) {
  const extracted = parseProviderResult({
    provider,
    purpose: "advice",
    raw: stdout,
  });
  return extracted.status === "confirmed" && typeof extracted.value === "string"
    ? parseAdviceResult(extracted.value, allowedReferences)
    : Object.freeze({
        status: "blocked" as const,
        reason:
          extracted.error?.reason ?? "workbench_ai_provider_output_invalid",
        normalizedResult: null,
        ...(extracted.turnCountDiagnostic === undefined
          ? {}
          : { turnCountDiagnostic: extracted.turnCountDiagnostic }),
      });
}
