/**
 * Taskと助言のProvider出力を共通結果へ抽出する。
 *
 * @responsibility 用途ごとの容量・Envelope・拒否順序を区別し、生出力を公開しない。
 * @trace ARCH-000015
 */
import { parseUnambiguousJsonDocument } from "./json.ts";
import type { AiProvider } from "./types.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
const TASK_MAXIMUM_RAW_BYTES = 65_536;

/**
 * 用途別の結果解析入力を表す。
 * @responsibility Task役割・受理Turn上限と助言入力を区別する。
 * @trace ARCH-000015
 * @shape purposeで識別する閉じた入力。
 * @invariant 用途ごとの容量・受理条件を共有しない。
 * @boundary Provider出力と共通解析入口。
 * @security 入力は未信頼の値として検証する。
 * @compatibility 既存Task／助言の受理条件を維持する。
 */
export type ProviderResultInput =
  | Readonly<{ provider: AiProvider; purpose: "advice"; raw: unknown }>
  | Readonly<{
      provider: AiProvider;
      purpose: "task";
      taskRole: "executor" | "reviewer";
      resultAcceptanceMaximumTurns: number;
      raw: string;
    }>;

/**
 * 解析の拒否理由を表す。
 * @responsibility 既存の閉じた理由と共通入力拒否を区別する。
 * @trace ARCH-000015
 * @shape 既存抽出器の理由Union。
 * @invariant Provider本文を理由へ埋め込まない。
 * @boundary 共通解析結果と利用側。
 * @security 自由文を返さない。
 * @compatibility 既存の理由文字列を維持する。
 */
export type ProviderResultReason =
  | Exclude<ReturnType<typeof extractProviderTaskEnvelope>["reason"], null>
  | (typeof WORKBENCH_AI_ADVICE_PROVIDER_OUTPUT_REASONS)[number]
  | "provider_result_input_invalid";

/**
 * 解析値と固定拒否理由を型で区別する。
 * @responsibility 結果値、Turn観測と非秘密の実行観測を搬送する。
 * @trace ARCH-000015
 * @shape confirmedでは値、blockedではエラーを持つ。
 * @invariant 解析成功はSchema成立・Process終了・回収完了を意味しない。
 * @boundary AI Adapterと結果SchemaのOwner。
 * @security 生Envelopeを公開観測へ複製しない。
 * @compatibility 既存の観測値・判定順序を維持する。
 */
export type ProviderResultParseResult<
  K extends "advice" | "task" = "advice" | "task",
> = Readonly<
  {
    providerReportedTurns: number | null;
    codexExecutionObservation: Readonly<Record<string, unknown>> | null;
    rawOutputReported: false;
  } & (
    | {
        status: "confirmed";
        value: K extends "advice" ? string : unknown;
        error: null;
      }
    | {
        status: "blocked";
        value: null;
        error: Readonly<{
          provider: AiProvider | null;
          reason: ProviderResultReason;
        }>;
      }
  )
>;

/**
 * 助言又はTaskの出力を共通の解析結果へ変換する。
 * @responsibility 用途を照合し、既存の抽出・拒否・観測を保持する。
 * @trace ARCH-000015
 * @input input: Provider、用途、未信頼出力とTask固有の受理条件。
 * @returns 解析値又は固定理由。Schema判断は含まない。
 * @precondition 呼出し側がTaskの受理Turn上限を共通Scope評価から導出する。
 * @postcondition 拒否では結果本文を返さない。
 * @effect N/A: 同期の解析だけを行う。
 * @failure 不正用途・Provider・入力又は既存抽出条件の不成立を拒否する。
 * @invariant 成功通知から実Process終了や回収を推定しない。
 * @boundary CLI出力と上位の結果Schema評価。
 * @security 生Provider出力・秘密値を診断へ公開しない。
 * @concurrency N/A: 状態・資源を所有しない。
 */
export function parseProviderResult<const I extends ProviderResultInput>(
  candidate: I,
): ProviderResultParseResult<I["purpose"]> {
  const snapshot =
    snapshotPlainRecord(candidate, new Set(["provider", "purpose", "raw"])) ??
    snapshotPlainRecord(
      candidate,
      new Set([
        "provider",
        "purpose",
        "raw",
        "taskRole",
        "resultAcceptanceMaximumTurns",
      ]),
    );
  if (
    !snapshot ||
    (snapshot.provider !== "codex" && snapshot.provider !== "claude")
  ) {
    return Object.freeze({
      status: "blocked",
      value: null,
      error: Object.freeze({
        provider: null,
        reason: "provider_result_input_invalid",
      }),
      providerReportedTurns: null,
      codexExecutionObservation: null,
      rawOutputReported: false,
    });
  }
  const input = snapshot as I;
  const { provider, purpose } = input;
  let reason: ProviderResultReason | null = null;
  let value: unknown = null;
  let providerReportedTurns: number | null = null;
  let codexExecutionObservation: Readonly<Record<string, unknown>> | null =
    null;
  if (
    (provider !== "codex" && provider !== "claude") ||
    (purpose !== "advice" && purpose !== "task")
  ) {
    reason = "provider_result_input_invalid";
  } else if (purpose === "advice") {
    if ("taskRole" in snapshot)
      return Object.freeze({
        status: "blocked",
        value: null,
        error: Object.freeze({
          provider,
          reason: "provider_result_input_invalid",
        }),
        providerReportedTurns: null,
        codexExecutionObservation: null,
        rawOutputReported: false,
      });
    const extracted = extractWorkbenchAiAdviceProviderOutput(
      provider,
      input.raw,
    );
    reason = extracted.reason;
    value = extracted.adviceJson;
  } else if (
    typeof input.raw !== "string" ||
    Buffer.byteLength(input.raw, "utf8") > TASK_MAXIMUM_RAW_BYTES ||
    (input.taskRole !== "executor" && input.taskRole !== "reviewer") ||
    !Number.isInteger(input.resultAcceptanceMaximumTurns) ||
    input.resultAcceptanceMaximumTurns < 0
  ) {
    reason = "provider_task_result_json_invalid";
  } else {
    const extracted = extractProviderTaskEnvelope(
      provider,
      input.taskRole,
      input.resultAcceptanceMaximumTurns,
      input.raw,
    );
    reason = extracted.reason;
    value = extracted.value;
    providerReportedTurns =
      "providerReportedTurns" in extracted
        ? (extracted.providerReportedTurns ?? null)
        : null;
    codexExecutionObservation =
      "codexExecutionObservation" in extracted
        ? (extracted.codexExecutionObservation ?? null)
        : null;
    if (value === null && reason === null)
      reason = "provider_task_result_json_invalid";
  }
  const observation = {
    providerReportedTurns,
    codexExecutionObservation,
    rawOutputReported: false as const,
  };
  return (
    reason === null
      ? Object.freeze({
          ...observation,
          status: "confirmed",
          value,
          error: null,
        })
      : Object.freeze({
          ...observation,
          status: "blocked",
          value: null,
          error: Object.freeze({ provider, reason }),
        })
  ) as ProviderResultParseResult<I["purpose"]>;
}

/**
 * JSON値が配列でないobjectかを判定する。
 *
 * @responsibility EnvelopeのPropertyを読む前にnull・primitive・配列を除外する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns 配列でない非null objectだけtrueとなる型述語。
 * @precondition 判定値はJSON parserが返した値である。
 * @postcondition object判定をEnvelope内容の検証済みへ昇格しない。
 * @effect N/A: isTaskEnvelopeRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isTaskEnvelopeRecordは独自の失敗分岐を所有しない。
 * @invariant isTaskEnvelopeRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isTaskEnvelopeRecordはProcess内の同一Subsystemで完結する。
 * @security isTaskEnvelopeRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isTaskEnvelopeRecordは共有非同期状態を持たない同期処理である。
 */
function isTaskEnvelopeRecord(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * 固定CLIのTask Envelopeから共通判定用の値と実行観測を抽出する。
 *
 * @responsibility Codex JSONLとClaude Resultの搬送形式・Turns・Usageを解釈し、Task採否を行わない。
 * @trace ARCH-000015
 * @input provider: "codex" | "claude"、taskRole: "executor" | "reviewer"、resultAcceptanceMaximumTurns: number、raw: string
 * @returns 構造化入力、固定拒否理由、報告Turn数と本文非公開のCodex実行観測。
 * @precondition 呼出し側がProvider・Role・受理Turn上限と出力全体のbyte上限を検証している。
 * @postcondition 共通Executor／Reviewer Schemaの判定は呼出し側へ残す。
 * @effect N/A: 文字列の純粋解析だけを行う。
 * @failure 不正JSONL、失敗Envelope、Turn超過、不正課金情報とReviewer搬送不正を区別して拒否する。
 * @invariant CLI完了通知だけから実Process終了・cleanup成立を主張しない。
 * @boundary AI Adapterの出力解釈とCoordinatorの共通結果判定の間。
 * @security 生イベント・Command・Pathを観測項目へ複製せず、Authorityを発行しない。
 * @concurrency N/A: 状態と資源を所有しない同期解析である。
 */
function extractProviderTaskEnvelope(
  provider: "codex" | "claude",
  taskRole: "executor" | "reviewer",
  resultAcceptanceMaximumTurns: number,
  raw: string,
) {
  let parsed = parseUnambiguousJsonDocument(raw);
  let codexExecutionObservation: Readonly<Record<string, unknown>> | null =
    null;
  if (provider === "codex" && parsed === null) {
    const events = raw
      .split(/\r?\n/u)
      .filter((line) => line.length > 0)
      .map((line) => parseUnambiguousJsonDocument(line));
    if (
      events.length === 0 ||
      events.length > 4_096 ||
      events.some((event) => !isTaskEnvelopeRecord(event))
    )
      return Object.freeze({
        value: null,
        reason: "provider_task_result_json_invalid" as const,
      });
    const records = events as Record<string, unknown>[];
    const itemEvents = records.filter(
      (event) =>
        (event.type === "item.started" || event.type === "item.completed") &&
        isTaskEnvelopeRecord(event.item),
    );
    const finalMessages = itemEvents.filter(
      (event) =>
        event.type === "item.completed" &&
        (event.item as Record<string, unknown>).type === "agent_message" &&
        typeof (event.item as Record<string, unknown>).text === "string",
    );
    const turnCompletedCount = records.filter(
      (event) => event.type === "turn.completed",
    ).length;
    const turnFailedCount = records.filter(
      (event) => event.type === "turn.failed" || event.type === "error",
    ).length;
    const finalText = (
      finalMessages.at(-1)?.item as Record<string, unknown> | undefined
    )?.text;
    if (
      turnCompletedCount !== 1 ||
      turnFailedCount !== 0 ||
      typeof finalText !== "string"
    )
      return Object.freeze({
        value: null,
        reason: "provider_task_result_json_invalid" as const,
      });
    parsed = parseUnambiguousJsonDocument(finalText);
    const countItems = (itemType: string, status?: string) =>
      itemEvents.filter((event) => {
        const item = event.item as Record<string, unknown>;
        return (
          item.type === itemType &&
          event.type === (status ? "item.completed" : "item.started") &&
          (status === undefined || item.status === status)
        );
      }).length;
    const completedCommandExecutions = itemEvents
      .filter(
        (event) =>
          event.type === "item.completed" &&
          (event.item as Record<string, unknown>).type === "command_execution",
      )
      .map((event) => event.item as Record<string, unknown>);
    const countCommandExitCode = (exitCode: number) =>
      completedCommandExecutions.filter((item) => item.exit_code === exitCode)
        .length;
    const commandExecutionOtherNonzeroExitCodeCount =
      completedCommandExecutions.filter(
        (item) =>
          Number.isSafeInteger(item.exit_code) &&
          (item.exit_code as number) !== 0 &&
          (item.exit_code as number) !== 1 &&
          (item.exit_code as number) !== 126 &&
          (item.exit_code as number) !== 127,
      ).length;
    const commandExecutionMissingExitCodeCount =
      completedCommandExecutions.filter(
        (item) => !Number.isSafeInteger(item.exit_code),
      ).length;
    const commandText = (item: Record<string, unknown>) =>
      typeof item.command === "string" ? item.command.toLowerCase() : "";
    const commandOutputText = (item: Record<string, unknown>) =>
      typeof item.aggregated_output === "string"
        ? item.aggregated_output.toLowerCase()
        : typeof item.output === "string"
          ? item.output.toLowerCase()
          : "";
    const countCommandFamily = (pattern: RegExp) =>
      completedCommandExecutions.filter((item) =>
        pattern.test(commandText(item)),
      ).length;
    const failedCommandExecutions = completedCommandExecutions.filter(
      (item) => item.status === "failed",
    );
    const countFailureClass = (pattern: RegExp) =>
      failedCommandExecutions.filter((item) =>
        pattern.test(commandOutputText(item)),
      ).length;
    const classifiedFailures = new Set(
      failedCommandExecutions.filter((item) =>
        /permission denied|operation not permitted|read-only file system|no such file or directory|not found|syntax error|sandbox|bwrap|landlock/.test(
          commandOutputText(item),
        ),
      ),
    );
    codexExecutionObservation = Object.freeze({
      transport: "fixed_cli_jsonl_v0_149_1",
      turnCompleted: true,
      commandExecutionStartedCount: countItems("command_execution"),
      commandExecutionCompletedCount: countItems(
        "command_execution",
        "completed",
      ),
      commandExecutionFailedCount: countItems("command_execution", "failed"),
      commandExecutionDeclinedCount: countItems(
        "command_execution",
        "declined",
      ),
      commandExecutionExitCode0Count: countCommandExitCode(0),
      commandExecutionExitCode1Count: countCommandExitCode(1),
      commandExecutionExitCode126Count: countCommandExitCode(126),
      commandExecutionExitCode127Count: countCommandExitCode(127),
      commandExecutionOtherNonzeroExitCodeCount,
      commandExecutionMissingExitCodeCount,
      commandFamilyPythonCount: countCommandFamily(
        /(^|[\s;&|])python(?:3)?(?:[\s;&|]|$)/,
      ),
      commandFamilyPosixTextCount: countCommandFamily(
        /(^|[\s;&|])(cat|sed|grep|perl|awk)(?:[\s;&|]|$)/,
      ),
      commandFamilyGitCount: countCommandFamily(/(^|[\s;&|])git(?:[\s;&|]|$)/),
      commandFamilyApplyPatchCount: countCommandFamily(
        /(^|[\s;&|])apply_patch(?:[\s;&|]|$)/,
      ),
      commandFailurePermissionCount: countFailureClass(
        /permission denied|operation not permitted/,
      ),
      commandFailureReadOnlyFilesystemCount: countFailureClass(
        /read-only file system/,
      ),
      commandFailureMissingPathCount: countFailureClass(
        /no such file or directory/,
      ),
      commandFailureCommandNotFoundCount: countFailureClass(
        /command not found|: not found/,
      ),
      commandFailureSyntaxCount: countFailureClass(/syntax error/),
      commandFailureSandboxCount: countFailureClass(/sandbox|bwrap|landlock/),
      commandFailureUnclassifiedCount: failedCommandExecutions.filter(
        (item) => !classifiedFailures.has(item),
      ).length,
      fileChangeStartedCount: countItems("file_change"),
      fileChangeCompletedCount: countItems("file_change", "completed"),
      fileChangeFailedCount: countItems("file_change", "failed"),
      fileChangeDeclinedCount: countItems("file_change", "declined"),
      rawEventReported: false,
      commandReported: false,
      pathReported: false,
      providerTextReported: false,
    });
  }
  if (provider === "codex")
    return Object.freeze({
      value: parsed,
      reason: null,
      providerReportedTurns: null,
      codexExecutionObservation,
    });
  if (!isTaskEnvelopeRecord(parsed))
    return Object.freeze({
      value: null,
      reason: "provider_task_result_json_invalid" as const,
    });
  if (parsed.type === "result" && parsed.subtype === "error_max_turns")
    return Object.freeze({
      value: null,
      reason: "provider_turn_limit_exceeded" as const,
    });
  if (
    parsed.type === "result" &&
    parsed.subtype === "error_max_structured_output_retries"
  )
    return Object.freeze({
      value: null,
      reason: "provider_structured_output_retry_exhausted" as const,
    });
  const numberOfTurns = parsed.num_turns;
  const cost = parsed.total_cost_usd;
  if (
    parsed.type !== "result" ||
    parsed.subtype !== "success" ||
    parsed.is_error !== false
  ) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_envelope_status_invalid" as const,
    });
  }
  if (
    typeof numberOfTurns !== "number" ||
    !Number.isInteger(numberOfTurns) ||
    numberOfTurns < 1
  ) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_turn_count_invalid" as const,
    });
  }
  if (numberOfTurns > resultAcceptanceMaximumTurns) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_turn_limit_mismatch" as const,
    });
  }
  if (typeof cost !== "number" || !Number.isFinite(cost) || cost < 0) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_cost_metadata_invalid" as const,
    });
  }
  if (taskRole === "executor")
    return Object.freeze({
      value: parsed.structured_output,
      reason: null,
      providerReportedTurns: numberOfTurns,
    });
  if (
    typeof parsed.result !== "string" ||
    Buffer.byteLength(parsed.result, "utf8") > TASK_MAXIMUM_RAW_BYTES
  )
    return Object.freeze({
      value: null,
      reason: "provider_task_reviewer_result_transport_invalid" as const,
    });
  const reviewerValue = parseUnambiguousJsonDocument(parsed.result);
  return Object.freeze({
    value: reviewerValue,
    providerReportedTurns: numberOfTurns,
    reason:
      reviewerValue === null
        ? ("provider_task_result_json_invalid" as const)
        : null,
  });
}

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

const ADVICE_MAXIMUM_RAW_BYTES = 262_144;
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
function extractWorkbenchAiAdviceProviderOutput(
  provider: "codex" | "claude",
  raw: unknown,
) {
  if (
    typeof raw !== "string" ||
    raw.length === 0 ||
    Buffer.byteLength(raw, "utf8") > ADVICE_MAXIMUM_RAW_BYTES
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
  if (events.some((event) => !isAdviceEnvelopeRecord(event)))
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
        !isAdviceEnvelopeRecord(event.item) ||
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
  if (!message || !isAdviceEnvelopeRecord(message.item))
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
  if (!isAdviceEnvelopeRecord(envelope))
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
  if (!isAdviceEnvelopeRecord(envelope.structured_output))
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
function isAdviceEnvelopeRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
