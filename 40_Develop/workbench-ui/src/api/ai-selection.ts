/**
 * AI設定保存の応答をWorkbenchの実送信内容へ結び付ける。
 * @packageDocumentation
 * @responsibility 画面側で確認できた結果だけを保持し、保存や認可は再実装しない。
 * @trace ARCH-000012
 * @boundary AI設定PUTの非秘密応答とWorkbenchの表示。
 */
import type { AiSelectionSaveResult } from "@qual-lab/crdd-configuration-model";
import { requestWorkbench } from "./connection.ts";
import {
  validateAiSelectionResponse,
  validateAiSelectionSnapshot,
} from "./response.ts";

/** 同じリポジトリの現在設定を明示再取得する。 @trace ARCH-000012 */
export async function requestAiSelection(
  repositoryId: string,
  signal: AbortSignal,
  browserSession: boolean,
) {
  const response = await requestWorkbench(
    `/api/repositories/${encodeURIComponent(repositoryId)}/ai-selection`,
    { signal },
    browserSession,
  );
  if (!response.ok) throw new Error("ai_selection_unavailable");
  return validateAiSelectionResponse(await response.json());
}

/**
 * 保存結果の既知成功と競合・拒否・不明を分離する。
 * @responsibility 再送を行わず、成功時の設定内容を送信した値へ照合する。
 * @trace ARCH-000012
 * @input 送信した設定値と未知JSON。
 * @returns 検査した保存結果。
 * @precondition 一回だけ明示送信済み。
 * @postcondition saved以外を保存済みとしない。
 * @effect N/A: 同期検査。
 * @failure 相関不正は固定例外。
 * @invariant 不明な応答から未保存を推定しない。
 * @boundary 設定PUTと表示。
 * @security Root・認証値を使用しない。
 * @concurrency 同じ送信内容へ相関する。
 */
export function inspectWorkbenchSelectionResult(
  config: unknown,
  value: unknown,
): AiSelectionSaveResult {
  const ordered = (entry: unknown): unknown =>
    Array.isArray(entry)
      ? entry.map(ordered)
      : isRecord(entry)
        ? Object.fromEntries(
            Object.entries(entry)
              .sort(([left], [right]) => left.localeCompare(right))
              .map(([key, item]) => [key, ordered(item)]),
          )
        : entry;
  if (
    !isRecord(value) ||
    !["saved", "conflict", "blocked", "unknown"].includes(String(value.status))
  )
    throw new Error("workbench_selection_response_invalid");
  if (value.status === "saved") {
    const snapshot = validateAiSelectionSnapshot(value.snapshot);
    if (
      value.reason !== null ||
      JSON.stringify(ordered(snapshot.config)) !==
        JSON.stringify(ordered(config))
    )
      throw new Error("workbench_selection_response_invalid");
  } else if (value.snapshot !== null || typeof value.reason !== "string")
    throw new Error("workbench_selection_response_invalid");
  return value as AiSelectionSaveResult;
}

/**
 * JSON値のObjectを配列・nullと区別する。
 * @trace ARCH-000012
 * @boundary 設定保存応答と送信したJSONの比較に限定する。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
