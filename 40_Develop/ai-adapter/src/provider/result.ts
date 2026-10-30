/**
 * Task・助言・ProbeのProvider出力を共通結果へ抽出する。
 *
 * @responsibility 用途ごとの容量・Envelope・拒否順序を区別し、生出力を公開しない。
 * @trace ARCH-000015
 */
import type { AiProvider, ProviderTurnCountDiagnostic } from "./types.ts";
export const PROVIDER_ADVICE_OUTPUT_REASONS = Object.freeze([
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
import { inspectCodexExecutionObservation } from "../codex/observation.ts";
import { parseUnambiguousJsonDocument } from "./json.ts";

import { snapshotPlainRecord } from "./input.ts";
import {
  inspectTaskResultContent,
  type TaskResult,
  type TaskReviewFinding,
} from "./task-result.ts";
import { parseAdviceResult, type AdviceResult } from "./advice-result.ts";
import { evaluateProviderTaskScope } from "./plan.ts";
import { normalizeCodexStructuredResult } from "../codex/result.ts";
import { normalizeClaudeStructuredResult } from "../claude/result.ts";
const TASK_MAXIMUM_RAW_BYTES = 65_536;

/**
 * 用途別の結果解析入力を表す。
 * @responsibility 用途別入力とTaskだけの役割を区別する。
 * @trace ARCH-000015
 * @shape purposeで識別する閉じた入力。
 * @invariant 用途ごとの容量・受理条件を共有しない。
 * @boundary Provider出力と共通解析入口。
 * @security 入力は未信頼の値として検証する。
 * @compatibility Task／助言のEnvelope・Schema境界を維持し、報告回数を要求上限と比較しない。
 */
export type ProviderEnvelopeInput =
  | Readonly<{ provider: AiProvider; purpose: "probe"; raw: unknown }>
  | Readonly<{ provider: AiProvider; purpose: "advice"; raw: unknown }>
  | Readonly<{
      provider: AiProvider;
      purpose: "task";
      taskRole: "executor" | "reviewer";
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
export type ProviderEnvelopeReason =
  | "codex_structured_result_invalid"
  | "claude_structured_result_invalid"
  | Exclude<ReturnType<typeof extractProviderTaskEnvelope>["reason"], null>
  | (typeof PROVIDER_ADVICE_OUTPUT_REASONS)[number]
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
export type ProviderEnvelopeResult<
  K extends "advice" | "task" | "probe" = "advice" | "task" | "probe",
> = Readonly<
  {
    providerReportedTurns: number | null;
    codexExecutionObservation: ReturnType<
      typeof inspectCodexExecutionObservation
    >;
    rawOutputReported: false;
    turnCountDiagnostic?: ProviderTurnCountDiagnostic;
  } & (
    | {
        status: "confirmed";
        value: K extends "advice"
          ? string
          : K extends "probe"
            ? Readonly<{ status: true }>
            : unknown;
        error: null;
      }
    | {
        status: "blocked";
        value: null;
        error: Readonly<{
          provider: AiProvider | null;
          reason: ProviderEnvelopeReason;
        }>;
      }
  )
>;

/**
 * 用途別出力を共通の解析結果へ変換する。
 * @responsibility 用途を照合し、既存の抽出・拒否・観測を保持する。
 * @trace ARCH-000015
 * @input input: Provider、用途、未信頼出力とTask固有の受理条件。
 * @returns 解析値又は固定理由。Schema判断は含まない。
 * @precondition 呼出し側がTask役割とProviderを確定する。
 * @postcondition 拒否では結果本文を返さない。
 * @effect N/A: 同期の解析だけを行う。
 * @failure 不正用途・Provider・入力又は既存抽出条件の不成立を拒否する。
 * @invariant 成功通知から実Process終了や回収を推定しない。
 * @boundary CLI出力と上位の結果Schema評価。
 * @security 生Provider出力・秘密値を診断へ公開しない。
 * @concurrency N/A: 状態・資源を所有しない。
 */
export function extractProviderResult<const I extends ProviderEnvelopeInput>(
  candidate: I,
): ProviderEnvelopeResult<I["purpose"]> {
  const snapshot =
    snapshotPlainRecord(candidate, new Set(["provider", "purpose", "raw"])) ??
    snapshotPlainRecord(
      candidate,
      new Set(["provider", "purpose", "raw", "taskRole"]),
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
  let reason: ProviderEnvelopeReason | null = null;
  let value: unknown = null;
  let providerReportedTurns: number | null = null;
  let turnCountDiagnostic: ProviderTurnCountDiagnostic | undefined;
  let codexExecutionObservation: ReturnType<
    typeof inspectCodexExecutionObservation
  > = null;
  if (
    (provider !== "codex" && provider !== "claude") ||
    (purpose !== "advice" && purpose !== "task" && purpose !== "probe")
  ) {
    reason = "provider_result_input_invalid";
  } else if (purpose === "probe") {
    if ("taskRole" in snapshot) reason = "provider_result_input_invalid";
    else {
      const parsed =
        provider === "codex"
          ? normalizeCodexStructuredResult(input.raw)
          : normalizeClaudeStructuredResult(input.raw);
      if (parsed.status === "confirmed") value = parsed.normalizedResult;
      else
        reason =
          "reason" in parsed ? parsed.reason : "provider_result_input_invalid";
    }
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
    turnCountDiagnostic =
      "turnCountDiagnostic" in extracted
        ? extracted.turnCountDiagnostic
        : undefined;
  } else if (
    typeof input.raw !== "string" ||
    Buffer.byteLength(input.raw, "utf8") > TASK_MAXIMUM_RAW_BYTES ||
    (input.taskRole !== "executor" && input.taskRole !== "reviewer")
  ) {
    reason = "provider_task_result_json_invalid";
  } else {
    const extracted = extractProviderTaskEnvelope(
      provider,
      input.taskRole,
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
    ...(turnCountDiagnostic === undefined ? {} : { turnCountDiagnostic }),
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
  ) as ProviderEnvelopeResult<I["purpose"]>;
}

/**
 * Provider Task Structured 結果を固定Schemaへ正規化する。
 *
 * @responsibility Provider Task Structured 結果の入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000015
 * @input provider: unknown、taskRole: unknown、selectedEffort: unknown、raw: unknown、taskWorkload: unknown
 * @returns confirmed時のRole別結果又は固定理由付きblocked。拒否では内容を返さない。
 * @precondition 未信頼値を受け取り、Provider・Role・推論設定・容量・作業量を検査する。
 * @postcondition Envelope・Role別内容が成立した場合だけ正規形を返す。
 * @effect N/A: 解析結果の値を結合するのみ。
 * @failure 不正入力・Envelope・形・所見・Path・容量を固定理由で拒否する。
 * @invariant 是正許可は固定Hostを通じCoordinatorが所有する。
 * @boundary 未信頼Provider出力から上位で扱う型付き結果への境界。
 * @security parseTaskContentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: parseTaskContentは共有非同期状態を持たない同期処理である。
 */
export function parseTaskContent(
  provider: unknown,
  taskRole: unknown,
  selectedEffort: unknown,
  raw: unknown,
  taskWorkload?: unknown,
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (taskRole !== "executor" && taskRole !== "reviewer") ||
    (selectedEffort !== "low" &&
      selectedEffort !== "medium" &&
      selectedEffort !== "high") ||
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > TASK_MAXIMUM_RAW_BYTES
  ) {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_task_result_input_invalid" as const,
      normalizedResult: null,
    });
  }
  const turnBudget =
    provider === "claude"
      ? evaluateProviderTaskScope("claude", taskRole, taskWorkload)
      : null;
  if (provider === "claude" && turnBudget?.status !== "candidate") {
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_task_result_input_invalid" as const,
      normalizedResult: null,
    });
  }
  const extracted = extractProviderResult({
    provider,
    purpose: "task",
    taskRole,
    raw,
  });
  if (extracted.status !== "confirmed" || extracted.value === null) {
    return Object.freeze({
      status: "blocked" as const,
      reason:
        extracted.error?.reason ??
        ("provider_task_result_json_invalid" as const),
      normalizedResult: null,
      rawOutputReported: false,
      untrustedProviderTextReported: false,
      credentialAbsenceVerified: false,
    });
  }
  const value = extracted.value;
  const result = inspectTaskResultContent(value, taskRole);
  return result.normalizedResult
    ? Object.freeze({
        status: "confirmed" as const,
        provider,
        taskRole,
        reviewFindings:
          "reviewFindings" in result ? result.reviewFindings : null,
        normalizedResult: result.normalizedResult,
        ...(provider === "codex" &&
        "codexExecutionObservation" in extracted &&
        extracted.codexExecutionObservation
          ? {
              providerExecutionObservation: extracted.codexExecutionObservation,
            }
          : {}),
        ...(provider === "claude" &&
        turnBudget?.status === "candidate" &&
        typeof extracted.providerReportedTurns === "number"
          ? {
              providerTurnObservation: Object.freeze({
                provider: "claude" as const,
                taskRole,
                requestedMaximumTurns: turnBudget.maximumTurns,
                providerReportedTurns: extracted.providerReportedTurns,
              }),
            }
          : {}),
        rawOutputReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      })
    : Object.freeze({
        status: "blocked" as const,
        reason: result.reason,
        normalizedResult: null,
        rawOutputReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      });
}

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
 * @boundary AI Adapter内の共通解析から用途別内容Ownerへの接続。
 * @security 生出力・認証値を保存しない。
 * @concurrency N/A: 共有状態なし。
 */
export function parseAdviceContent(
  provider: "codex" | "claude",
  stdout: string,
  allowedReferences: readonly string[],
) {
  const extracted = extractProviderResult({
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

/** 用途別のProvider応答と内容を同じ入口で検査する入力。
 * @responsibility 内容検査に必要な用途・役割・許可参照だけを受け取る。
 * @trace ARCH-000015
 * @invariant 保存・実行・清掃のAuthorityを含めない。
 */
export type ProviderResultInput =
  | Readonly<{ provider: AiProvider; purpose: "probe"; raw: unknown }>
  | Readonly<{
      provider: AiProvider;
      purpose: "task";
      taskRole: unknown;
      selectedEffort: unknown;
      taskWorkload?: unknown;
      raw: unknown;
    }>
  | Readonly<{
      provider: AiProvider;
      purpose: "advice";
      allowedReferences: readonly string[];
      raw: unknown;
    }>;

/**
 * Provider差の抽出から用途別内容検査までを完了する。
 * @responsibility Task・Advice・Probeの内容と非秘密観測を区別して返す。
 * @trace ARCH-000015
 * @input 用途、Provider、生応答と用途別検査条件。
 * @returns 検査済み内容又は内容なしの固定理由。
 * @precondition 未信頼入力を閉形式で捕捉する。
 * @postcondition 生Envelope、実行許可、清掃成功を内容に混入させない。
 * @effect N/A: メモリ内の解析だけ。
 * @failure 不正入力・搬送・内容は既存理由で拒否する。
 * @invariant 内容検査成功は実行や採用の成立を意味しない。
 * @boundary Provider応答と型付き内容。
 * @security 生出力を返さない。
 * @concurrency N/A: 状態を保持しない。
 */
export function parseProviderResult<const I extends ProviderResultInput>(
  candidate: I,
): ProviderResultParseResult<I["purpose"]>;
export function parseProviderResult(
  candidate: ProviderResultInput,
): ProviderResultParseResult {
  const input =
    snapshotPlainRecord(candidate, new Set(["provider", "purpose", "raw"])) ??
    snapshotPlainRecord(
      candidate,
      new Set(["provider", "purpose", "raw", "allowedReferences"]),
    ) ??
    snapshotPlainRecord(
      candidate,
      new Set([
        "provider",
        "purpose",
        "raw",
        "taskRole",
        "selectedEffort",
        "taskWorkload",
      ]),
    ) ??
    snapshotPlainRecord(
      candidate,
      new Set(["provider", "purpose", "raw", "taskRole", "selectedEffort"]),
    );
  if (!input || (input.provider !== "codex" && input.provider !== "claude"))
    return Object.freeze({
      status: "blocked" as const,
      reason: "provider_result_input_invalid",
      normalizedResult: null,
    });
  const provider = input.provider;
  if (input.purpose === "task" && !Object.hasOwn(input, "allowedReferences"))
    return parseTaskContent(
      provider,
      input.taskRole,
      input.selectedEffort,
      input.raw,
      input.taskWorkload,
    );
  if (
    input.purpose === "advice" &&
    Object.hasOwn(input, "allowedReferences") &&
    !Object.hasOwn(input, "taskRole")
  ) {
    if (typeof input.raw !== "string")
      return Object.freeze({
        status: "blocked" as const,
        reason: "workbench_ai_provider_output_invalid",
        normalizedResult: null,
      });
    return parseAdviceContent(
      provider,
      input.raw,
      input.allowedReferences as readonly string[],
    );
  }
  if (input.purpose === "probe" && Object.keys(input).length === 3) {
    const parsed = extractProviderResult({
      provider,
      purpose: "probe",
      raw: input.raw,
    });
    return parsed.status === "confirmed"
      ? Object.freeze({
          status: "confirmed" as const,
          normalizedResult: parsed.value,
        })
      : Object.freeze({
          status: "blocked" as const,
          reason: parsed.error.reason,
          normalizedResult: null,
        });
  }
  return Object.freeze({
    status: "blocked" as const,
    reason: "provider_result_input_invalid",
    normalizedResult: null,
  });
}

/** Provider共通解析の実返却型。
 * @trace ARCH-000015
 * @invariant 別の結果構造を重複定義しない。
 */
export type ProviderResultParseResult<
  K extends ProviderResultInput["purpose"] = ProviderResultInput["purpose"],
> = Readonly<
  {
    providerExecutionObservation?: NonNullable<
      ReturnType<typeof inspectCodexExecutionObservation>
    >;
    providerTurnObservation?: Readonly<Record<string, unknown>>;
    turnCountDiagnostic?: ProviderTurnCountDiagnostic;
    reviewFindings?: readonly TaskReviewFinding[] | null;
    rawOutputReported?: false;
    untrustedProviderTextReported?: false;
    credentialAbsenceVerified?: false;
  } & (
    | {
        status: "confirmed";
        normalizedResult: K extends "task"
          ? TaskResult
          : K extends "advice"
            ? AdviceResult
            : Readonly<{ status: true }>;
      }
    | {
        status: "blocked";
        reason: ProviderResultReason;
        normalizedResult: null;
      }
  )
>;

/** 内容・搬送の検査拒否理由。
 * @trace ARCH-000015
 * @invariant Provider本文を理由に含めない。
 */
export type ProviderResultReason =
  | ProviderEnvelopeReason
  | Extract<
      ReturnType<typeof parseTaskContent>,
      { status: "blocked" }
    >["reason"]
  | Extract<
      ReturnType<typeof parseAdviceContent>,
      { status: "blocked" }
    >["reason"];

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
 * @input provider: "codex" | "claude"、taskRole: "executor" | "reviewer"、raw: string
 * @returns 構造化入力、固定拒否理由、報告Turn数と本文非公開のCodex実行観測。
 * @precondition 呼出し側がProvider・Roleと出力全体のbyte上限を検証している。
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
  raw: string,
) {
  let parsed = parseUnambiguousJsonDocument(raw);
  let codexExecutionObservation: ReturnType<
    typeof inspectCodexExecutionObservation
  > = null;
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
    // 語句の観測だけを残す。発生段階・因果関係や実行可否へ昇格しない。
    const itemErrorMessages = itemEvents
      .filter(
        (event) =>
          event.type === "item.completed" &&
          (event.item as Record<string, unknown>).type === "error",
      )
      .map((event) => {
        const message = (event.item as Record<string, unknown>).message;
        return typeof message === "string" ? message : "";
      });
    const itemErrorPatterns = {
      itemErrorHostMentionCount: /\bhost\b/iu,
      itemErrorSpawnMentionCount:
        /\bspawn(?:ing|ed)?\b|failed to (?:start|launch)|could not (?:start|launch)/iu,
      itemErrorProtocolMentionCount: /\bhandshake\b|\bprotocol\b/iu,
      itemErrorConnectionMentionCount:
        /\bdisconnect(?:ed|ion)?\b|connection (?:closed|reset|refused)|broken pipe|\beof\b/iu,
      itemErrorToolMentionCount: /\btools?\b|\bdelegat(?:e|ed|ion)\b/iu,
      itemErrorPermissionMentionCount:
        /permission denied|operation not permitted|access denied|read-only file system/iu,
      itemErrorMissingPathMentionCount:
        /no such file or directory|file not found|executable not found/iu,
      itemErrorTimeoutMentionCount: /\btimeout\b|timed out|deadline exceeded/iu,
    };
    const itemErrorMentions = Object.fromEntries(
      Object.entries(itemErrorPatterns).map(([key, pattern]) => [
        key,
        itemErrorMessages.filter((message) => pattern.test(message)).length,
      ]),
    );
    // 固定0.164.0のWarning文面との一致だけ。元通知種別や非故障を証明しない。
    const knownWarningTextPatterns = [
      /^Under-development features enabled: [a-z][a-z0-9_]*(?:, [a-z][a-z0-9_]*)*\. Under-development features are incomplete and may behave unpredictably\. To suppress this warning, set `suppress_unstable_features_warning = true` in .+\.$/u,
      /^Code Mode is enabled in configuration, but model `[a-z0-9][a-z0-9._-]{0,127}` does not advertise Code Mode support\. This may degrade model performance\. Disable `features\.code_mode` and `features\.code_mode_only`, or select a model whose metadata enables Code Mode\.$/u,
    ];
    codexExecutionObservation = Object.freeze({
      transport: "fixed_cli_jsonl_v0_164_0",
      turnCompleted: true,
      itemErrorCount: itemEvents.filter(
        (event) =>
          event.type === "item.completed" &&
          (event.item as Record<string, unknown>).type === "error",
      ).length,
      itemErrorCodeModeCount: itemEvents.filter(
        (event) =>
          event.type === "item.completed" &&
          (event.item as Record<string, unknown>).type === "error" &&
          typeof (event.item as Record<string, unknown>).message === "string" &&
          /code[ _-]?mode/iu.test(
            (event.item as Record<string, unknown>).message as string,
          ),
      ).length,
      ...itemErrorMentions,
      itemErrorKnownWarningTextCount: itemErrorMessages.filter(
        (message) =>
          message.length <= 4096 &&
          !/[\r\n\u2028\u2029]/u.test(message) &&
          knownWarningTextPatterns.some((pattern) => pattern.test(message)),
      ).length,
      itemErrorUnclassifiedCount: itemErrorMessages.filter(
        (message) =>
          !Object.values(itemErrorPatterns).some((pattern) =>
            pattern.test(message),
          ),
      ).length,
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
  if (provider === "codex" && codexExecutionObservation !== null) {
    const inspected = inspectCodexExecutionObservation(
      codexExecutionObservation,
    );
    if (!inspected)
      return Object.freeze({
        value: null,
        reason: "provider_task_result_json_invalid" as const,
        providerReportedTurns: null,
        codexExecutionObservation: null,
      });
    codexExecutionObservation = inspected;
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
    !Number.isSafeInteger(numberOfTurns) ||
    numberOfTurns < 1
  ) {
    return Object.freeze({
      value: null,
      reason: "provider_task_result_turn_count_invalid" as const,
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

export const PROVIDER_ADVICE_OUTPUT_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-provider-output";
export const PROVIDER_ADVICE_OUTPUT_CONTRACT_REVISION = 1;

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
 * @responsibility 正の安全整数のTurn metadata、非Error、有限Cost metadataおよびstructured_outputの通常Recordを確認し、最初の不成立層だけを固定理由で返す。
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
    !Number.isSafeInteger(envelope.num_turns) ||
    envelope.num_turns < 1
  )
    return blocked(
      "workbench_ai_claude_turn_count_invalid",
      Object.freeze({
        valueType: !Object.hasOwn(envelope, "num_turns")
          ? "missing"
          : envelope.num_turns === null
            ? "null"
            : Array.isArray(envelope.num_turns)
              ? "array"
              : (typeof envelope.num_turns as ProviderTurnCountDiagnostic["valueType"]),
        numberText:
          typeof envelope.num_turns === "number" &&
          Number.isFinite(envelope.num_turns)
            ? String(envelope.num_turns)
            : null,
      }),
    );
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
  reason: (typeof PROVIDER_ADVICE_OUTPUT_REASONS)[number],
  turnCountDiagnostic?: ProviderTurnCountDiagnostic,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    adviceJson: null,
    rawOutputReported: false as const,
    ...(turnCountDiagnostic === undefined ? {} : { turnCountDiagnostic }),
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
