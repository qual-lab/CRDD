/**
 * Workbench助言のProvider固有出力から助言JSONだけを抽出する。
 *
 * @packageDocumentation
 * @responsibility Codex JSONLとClaude JSON envelopeの成功条件を検証し、共通Normalizerへ渡す一つのJSON文字列へ変換する。
 * @trace ARCH-000015
 * @boundary Provider CLIの生出力とWorkbench助言結果Normalizerの間。
 * @effect N/A: 生文字列を検証するだけで外部Effectを発行しない。
 * @security 生出力、Session ID、Cost、Provider metadataおよびTool出力を公開結果へ含めない。
 */
import { parseUnambiguousJsonDocument } from "../output/unambiguous-json-document.ts";

export const WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-provider-output";
export const WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_CONTRACT_REVISION = 1;

export const WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS = Object.freeze([
  "workbench_ai_provider_output_invalid",
  "workbench_ai_codex_output_invalid",
  "workbench_ai_codex_completion_invalid",
  "workbench_ai_codex_tool_event_forbidden",
  "workbench_ai_codex_final_message_invalid",
  "workbench_ai_claude_envelope_invalid",
  "workbench_ai_claude_completion_invalid",
  "workbench_ai_claude_turn_count_invalid",
  "workbench_ai_claude_metadata_invalid",
  "workbench_ai_claude_structured_output_invalid",
] as const);

const MAXIMUM_RAW_BYTES = 262_144;
const MAXIMUM_EVENTS = 4_096;

/**
 * Provider生出力から助言JSONを抽出する。
 *
 * @responsibility Providerごとの完了Envelope、Turn数、既知通知分類および一意な最終本文を確認する。
 * @trace ARCH-000015
 * @input provider: 実行済みProvider、raw: Provider CLIの標準出力。
 * @returns 共通Normalizerへ渡す助言JSON、または生出力を含まない拒否結果。
 * @precondition rawは対応する固定CLIのstdoutだけである。
 * @postcondition confirmedの場合も内容のSchema・参照許可は後段Normalizerが再検証する。
 * @effect N/A: 文字列の構文検査と安全な再直列化だけを行う。
 * @failure 過大出力、曖昧JSON、失敗Turn、未知・不正Item、複数最終本文または不正Envelopeをblockedにする。
 * @invariant Provider metadataを助言本文として扱わない。
 * @boundary Provider固有TransportとProvider非依存Result Contractの間。
 * @security Session、Cost、Token、Command、Pathおよび生Provider出力を返さない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function extractWorkbenchAiAdviceProviderOutput(
  provider: "codex" | "claude",
  raw: unknown,
) {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES
  )
    return blocked("workbench_ai_provider_output_invalid");
  return provider === "codex" ? extractCodex(raw) : extractClaude(raw);
}

/**
 * 公式Codex JSONLの内部通知と唯一の最終Agent本文を分離する。
 *
 * @responsibility 一Turn完了、失敗0、最終Agent本文1件を確認し、既知の内部通知を非公開のまま分離する。
 * @trace ARCH-000015
 * @input raw: Codex CLI JSONL。
 * @returns 最終Agent本文または拒否結果。
 * @precondition rawは`--json`出力である。
 * @postcondition confirmed時の本文はJSONL Envelopeから分離される。
 * @effect N/A: JSONLを解析するだけである。
 * @failure 不正行、複数Turn、失敗、不正・未知Itemまたは複数最終本文を拒否する。
 * @invariant 内部通知を助言へ含めず、通知だけからEffect不存在を主張しない。
 * @boundary Codex JSONLと共通助言JSONの間。
 * @security Agent本文以外のEvent内容を返さない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function extractCodex(raw: string) {
  const lines = raw.split(/\r?\n/u).filter((line) => line.length > 0);
  if (lines.length === 0 || lines.length > MAXIMUM_EVENTS)
    return blocked("workbench_ai_codex_output_invalid");
  const events = lines.map((line) => parseUnambiguousJsonDocument(line));
  if (events.some((event) => !isRecord(event)))
    return blocked("workbench_ai_codex_output_invalid");
  const records = events as Record<string, unknown>[];
  if (
    records.filter((event) => event.type === "turn.completed").length !== 1 ||
    records.some(
      (event) => event.type === "turn.failed" || event.type === "error",
    )
  )
    return blocked("workbench_ai_codex_completion_invalid");

  const itemEvents = records.filter(
    (event) => typeof event.type === "string" && event.type.startsWith("item."),
  );
  if (
    itemEvents.some(
      (event) =>
        !["item.started", "item.updated", "item.completed"].includes(
          event.type as string,
        ) ||
        !isRecord(event.item) ||
        ![
          "agent_message",
          "reasoning",
          "command_execution",
          "file_change",
          "mcp_tool_call",
          "collab_tool_call",
          "web_search",
          "todo_list",
        ].includes(event.item.type as string),
    )
  )
    return blocked("workbench_ai_codex_tool_event_forbidden");
  if (
    itemEvents.some(
      (event) =>
        event.type === "item.completed" &&
        (event.item as Record<string, unknown>).type === "agent_message" &&
        typeof (event.item as Record<string, unknown>).text !== "string",
    )
  )
    return blocked("workbench_ai_codex_final_message_invalid");
  const messages = itemEvents.filter(
    (event) =>
      event.type === "item.completed" &&
      (event.item as Record<string, unknown>).type === "agent_message" &&
      typeof (event.item as Record<string, unknown>).text === "string",
  );
  if (messages.length !== 1)
    return blocked("workbench_ai_codex_final_message_invalid");
  const message = messages[0];
  if (!message || !isRecord(message.item))
    return blocked("workbench_ai_codex_final_message_invalid");
  return confirmed(message.item.text as string);
}

/**
 * Claude JSON envelopeからSchema検証済み出力を抽出する。
 *
 * @responsibility 1〜2Turnの整数上限、非Error、有限Cost metadataおよびstructured_outputの通常Recordを確認し、最初の不成立層だけを固定理由で返す。
 * @trace ARCH-000015
 * @input raw: Claude CLI JSON envelope。
 * @returns structured_outputの一意なJSON文字列または拒否結果。
 * @precondition rawは`--output-format json`出力である。
 * @postcondition Provider metadataを除きstructured_outputだけを再直列化する。
 * @effect N/A: JSONを解析・再直列化するだけである。
 * @failure 形式、成功状態、Turn数、Cost情報、出力の順に不成立を拒否する。出力不正には欠落と非通常Recordを含む。
 * @invariant Session IDとUsageを返さない。
 * @boundary Claude JSON envelopeと共通助言JSONの間。
 * @security Provider metadataと生出力を公開しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function extractClaude(raw: string) {
  const envelope = parseUnambiguousJsonDocument(raw);
  if (!isRecord(envelope))
    return blocked("workbench_ai_claude_envelope_invalid");
  if (
    envelope.type !== "result" ||
    envelope.subtype !== "success" ||
    envelope.is_error !== false
  )
    return blocked("workbench_ai_claude_completion_invalid");
  if (
    typeof envelope.num_turns !== "number" ||
    !Number.isInteger(envelope.num_turns) ||
    envelope.num_turns < 1 ||
    envelope.num_turns > 2
  )
    return blocked("workbench_ai_claude_turn_count_invalid");
  if (
    typeof envelope.total_cost_usd !== "number" ||
    !Number.isFinite(envelope.total_cost_usd) ||
    envelope.total_cost_usd < 0
  )
    return blocked("workbench_ai_claude_metadata_invalid");
  if (!isRecord(envelope.structured_output))
    return blocked("workbench_ai_claude_structured_output_invalid");
  return confirmed(JSON.stringify(envelope.structured_output));
}

/**
 * 抽出成功結果を生成する。
 *
 * @responsibility 後段へ渡すJSON文字列と非公開条件を固定する。
 * @trace ARCH-000015
 * @input adviceJson: Provider Envelopeから分離した助言JSON。
 * @returns confirmed結果。
 * @precondition adviceJsonはProvider固有完了条件を通過している。
 * @postcondition 生Envelopeを含まない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant rawOutputReportedは常にfalseである。
 * @boundary Transport抽出とResult Schema検証の間。
 * @security Provider metadataを結果へ含めない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function confirmed(adviceJson: string) {
  return Object.freeze({
    status: "confirmed" as const,
    reason: null,
    adviceJson,
    rawOutputReported: false as const,
  });
}

/**
 * 抽出拒否結果を生成する。
 *
 * @responsibility 不正Provider出力を生値なしの理由コードへ閉じる。
 * @trace ARCH-000015
 * @input reason: 閉じた拒否理由。
 * @returns adviceJsonを含まないblocked結果。
 * @precondition reasonは秘密値やProvider本文を含まない。
 * @postcondition adviceJsonはnullである。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant rawOutputReportedは常にfalseである。
 * @boundary 内部検証と公開拒否結果の間。
 * @security 生Provider出力を返さない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function blocked(
  reason: (typeof WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS)[number],
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    adviceJson: null,
    rawOutputReported: false as const,
  });
}

/**
 * 候補が通常Recordか判定する。
 *
 * @responsibility Provider出力をProperty参照前に配列でない通常Objectへ絞る。
 * @trace ARCH-000015
 * @input value: 未信頼JSON値。
 * @returns 通常Recordならtrue。
 * @precondition valueの型を仮定しない。
 * @postcondition trueの場合だけRecordとして参照する。
 * @effect N/A: 型判定だけを行う。
 * @failure N/A: 全値をBooleanへ分類する。
 * @invariant 配列と特殊PrototypeをRecordへ含めない。
 * @boundary 未信頼JSONと検証処理の間。
 * @security Getterを持つ外部Objectを通常Recordとして扱わない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
