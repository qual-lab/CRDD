/**
 * 固定Provider CLIのTask出力Envelopeを共通入力へ変換する。
 *
 * @packageDocumentation
 * @responsibility JSONL・Envelope・Turn・UsageのProvider差だけを解釈する。
 * @trace ARCH-000015
 * @boundary 未信頼のCLI出力と共通Task結果判定の間。
 */
import { parseUnambiguousJsonDocument } from "./unambiguous-json-document.ts";

const MAXIMUM_RAW_BYTES = 65_536;

/**
 * 記録かを判定する。
 *
 * @responsibility 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisRecordの入力契約を満たす。
 * @postcondition isRecordの責務を完了した結果だけを返す。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecordは独自の失敗分岐を所有しない。
 * @invariant isRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecordはProcess内の同一Subsystemで完結する。
 * @security isRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
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
export function extractProviderTaskEnvelope(
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
      events.some((event) => !isRecord(event))
    )
      return Object.freeze({
        value: null,
        reason: "provider_task_result_json_invalid" as const,
      });
    const records = events as Record<string, unknown>[];
    const itemEvents = records.filter(
      (event) =>
        (event.type === "item.started" || event.type === "item.completed") &&
        isRecord(event.item),
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
  if (!isRecord(parsed))
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
    Buffer.byteLength(parsed.result, "utf8") > MAXIMUM_RAW_BYTES
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
