/**
 * execution-intelligenceに属する責務をまとめる。
 *
 * @responsibility ExecutionObservationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
import { createHash } from "node:crypto";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";

export const EXECUTION_INTELLIGENCE_EVENT_CONTRACT =
  "crdd/execution-intelligence-event/v2" as const;

/**
 * execution-intelligenceで使用するExecution Observationの値契約を定義する。
 *
 * @responsibility Execution ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionObservationの宣言は外部境界を開かない。
 * @security N/A: ExecutionObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionObservation<T> =
  | Readonly<{ state: "observed"; value: T; source: string }>
  | Readonly<{ state: "not_observed"; reason: string }>
  | Readonly<{ state: "not_applicable"; reason: string }>;

/**
 * execution-intelligenceで使用するExecution Usageの値契約を定義する。
 *
 * @responsibility Execution UsageのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionUsageが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionUsageで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionUsageの宣言は外部境界を開かない。
 * @security N/A: ExecutionUsageはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionUsageの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionUsage = Readonly<{
  inputTokens: ExecutionObservation<number>;
  outputTokens: ExecutionObservation<number>;
  cacheReadTokens: ExecutionObservation<number>;
  cacheWriteTokens: ExecutionObservation<number>;
  costOrCredits: ExecutionObservation<
    Readonly<{ amount: number; unit: string }>
  >;
}>;

/**
 * execution-intelligenceで使用するExecution Intelligence Eventの値契約を定義する。
 *
 * @responsibility Execution Intelligence EventのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligenceEventが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligenceEventで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligenceEventの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligenceEventはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligenceEventの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TaskAttemptExecutionIntelligenceEvent = Readonly<{
  contract: typeof EXECUTION_INTELLIGENCE_EVENT_CONTRACT;
  eventId: string;
  eventType: "task_attempt_settled";
  occurredAt: string;
  identity: Readonly<{
    projectId: string;
    milestoneId: string;
    objectiveId: string;
    taskId: string;
    attemptId: string;
    operationId: string;
  }>;
  execution: Readonly<{
    role: string;
    provider: ExecutionObservation<string>;
    model: ExecutionObservation<string>;
    inputStrategyRef: ExecutionObservation<string>;
    durationMs: ExecutionObservation<number>;
    usage: ExecutionUsage;
    humanActiveMs: ExecutionObservation<number>;
    profileId: ExecutionObservation<string>;
    profileRevision: ExecutionObservation<string>;
    reasoningEffort: ExecutionObservation<string>;
    overrideApplied: ExecutionObservation<boolean>;
    parentExecutionId: ExecutionObservation<string>;
    diagnostic: ExecutionObservation<ExecutionDiagnostic>;
  }>;
  outcome: Readonly<{
    status: "completed" | "blocked" | "cancelled" | "unknown";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
  }>;
  quality: ExecutionObservation<
    Readonly<{
      result: "accepted" | "rejected";
      evidenceIds: readonly string[];
    }>
  >;
}>;

/**
 * Taskを持たないOperationの実行記録を定義する。
 * @responsibility 任意Operationへ架空のTask Identityを要求しない。
 * @trace ARCH-000007
 * @shape project、operation、executionのIdentityと共通観測を保持する。
 * @invariant Task専用のIdentityを持たない。
 * @boundary N/A: 値契約だけを定義する。
 * @security Authorityを含まない。
 * @compatibility v2のoperation_settledだけに適用する。
 */
export type OperationExecutionIntelligenceEvent = Omit<
  TaskAttemptExecutionIntelligenceEvent,
  "eventType" | "identity"
> &
  Readonly<{
    eventType: "operation_settled";
    identity: Readonly<{
      projectId: string;
      operationId: string;
      executionId: string;
    }>;
  }>;

/**
 * 実行知の二つのIdentity母集団を明示的に区別する。
 * @responsibility Taskと任意Operationを同じ観測契約へ接続する。
 * @trace ARCH-000007
 * @shape eventTypeで識別する閉じたunion。
 * @invariant Task IdentityをOperationへ補完しない。
 * @boundary N/A: 値契約だけを定義する。
 * @security Authorityを発行しない。
 * @compatibility v1の保存済み記録を受理しない。
 */
export type ExecutionIntelligenceEvent =
  | TaskAttemptExecutionIntelligenceEvent
  | OperationExecutionIntelligenceEvent;

/**
 * 生応答を複製しない診断の許可値を定義する。
 * @responsibility 停止段階と安全な分類だけを共有する。
 * @trace ARCH-000007
 * @shape stage、categoryと任意の閉じた補足値。
 * @invariant 任意本文、Header、Path、messageを持たない。
 * @boundary Producerが安全化した値の受理境界。
 * @security typeとcodeは静的許可値に限定する。
 * @compatibility 未対応値を推定または自由文へ変換しない。
 */
export type ExecutionDiagnostic = Readonly<{
  stage:
    | "transport"
    | "http"
    | "refusal"
    | "output_limit"
    | "json_parse"
    | "schema_validation"
    | "identity_validation"
    | "semantic_validation"
    | "completed";
  category:
    | "rate_limit"
    | "quota"
    | "billing"
    | "authentication"
    | "permission"
    | "unavailable"
    | "invalid_response"
    | "refused"
    | "output_limit"
    | "none";
  httpStatus: number | null;
  type:
    | "rate_limit_error"
    | "insufficient_quota"
    | "billing_error"
    | "authentication_error"
    | "permission_error"
    | "server_error"
    | "invalid_request_error"
    | null;
  code:
    | "rate_limit_exceeded"
    | "insufficient_quota"
    | "billing_hard_limit_reached"
    | "invalid_api_key"
    | "permission_denied"
    | "server_error"
    | "context_length_exceeded"
    | null;
  finishReason:
    | "completed"
    | "stop"
    | "length"
    | "max_output_tokens"
    | "content_filter"
    | "refusal"
    | null;
  refusal: boolean | null;
}>;

/**
 * execution-intelligenceで使用するTask Attempt Settled Event 入力の値契約を定義する。
 *
 * @responsibility Task Attempt Settled Event 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape TaskAttemptSettledEventInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskAttemptSettledEventInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskAttemptSettledEventInputの宣言は外部境界を開かない。
 * @security N/A: TaskAttemptSettledEventInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility TaskAttemptSettledEventInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TaskAttemptSettledEventInput = Readonly<{
  occurredAt: string;
  identity: TaskAttemptExecutionIntelligenceEvent["identity"];
  execution: Omit<
    ExecutionIntelligenceEvent["execution"],
    | "profileId"
    | "profileRevision"
    | "reasoningEffort"
    | "overrideApplied"
    | "parentExecutionId"
    | "diagnostic"
  > &
    Partial<
      Pick<
        ExecutionIntelligenceEvent["execution"],
        | "profileId"
        | "profileRevision"
        | "reasoningEffort"
        | "overrideApplied"
        | "parentExecutionId"
        | "diagnostic"
      >
    >;
  outcome: ExecutionIntelligenceEvent["outcome"];
  quality: ExecutionIntelligenceEvent["quality"];
}>;

/**
 * 任意Operationの構築入力を定義する。
 * @responsibility 実行Identityと共通観測を受け取る。
 * @trace ARCH-000007
 * @shape Task入力と同じ観測、Operation固有Identity。
 * @invariant Taskを偽造しない。
 * @boundary N/A: 型宣言のみ。
 * @security Authorityや生応答を含まない。
 * @compatibility 省略した追加観測は未観測として構築する。
 */
export type OperationSettledEventInput = Omit<
  TaskAttemptSettledEventInput,
  "identity"
> &
  Readonly<{ identity: OperationExecutionIntelligenceEvent["identity"] }>;

/**
 * observedを決定する。
 *
 * @responsibility observedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: T、source: string
 * @returns ExecutionObservation<T>を返す。
 * @precondition 「value: T、source: string」がobservedの入力契約を満たす。
 * @postcondition observedの責務を完了した結果だけを返す。
 * @effect N/A: observedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observedは独自の失敗分岐を所有しない。
 * @invariant observedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observedはProcess内の同一Subsystemで完結する。
 * @security N/A: observedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observedは共有非同期状態を持たない同期処理である。
 */
export function observed<T>(value: T, source: string): ExecutionObservation<T> {
  return Object.freeze({ state: "observed" as const, value, source });
}

/**
 * not Observedを決定する。
 *
 * @responsibility not Observedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input reason: string
 * @returns ExecutionObservation<never>を返す。
 * @precondition 「reason: string」がnotObservedの入力契約を満たす。
 * @postcondition notObservedの責務を完了した結果だけを返す。
 * @effect N/A: notObservedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: notObservedは独自の失敗分岐を所有しない。
 * @invariant notObservedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: notObservedはProcess内の同一Subsystemで完結する。
 * @security N/A: notObservedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: notObservedは共有非同期状態を持たない同期処理である。
 */
export function notObserved(reason: string): ExecutionObservation<never> {
  return Object.freeze({ state: "not_observed" as const, reason });
}

/**
 * not Applicableを決定する。
 *
 * @responsibility not Applicableの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input reason: string
 * @returns ExecutionObservation<never>を返す。
 * @precondition 「reason: string」がnotApplicableの入力契約を満たす。
 * @postcondition notApplicableの責務を完了した結果だけを返す。
 * @effect N/A: notApplicableは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: notApplicableは独自の失敗分岐を所有しない。
 * @invariant notApplicableは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: notApplicableはProcess内の同一Subsystemで完結する。
 * @security N/A: notApplicableはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: notApplicableは共有非同期状態を持たない同期処理である。
 */
export function notApplicable(reason: string): ExecutionObservation<never> {
  return Object.freeze({ state: "not_applicable" as const, reason });
}

/**
 * usage Not Observedを決定する。
 *
 * @responsibility usage Not Observedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input reason: string
 * @returns ExecutionUsageを返す。
 * @precondition 「reason: string」がusageNotObservedの入力契約を満たす。
 * @postcondition usageNotObservedの責務を完了した結果だけを返す。
 * @effect N/A: usageNotObservedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: usageNotObservedは独自の失敗分岐を所有しない。
 * @invariant usageNotObservedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: usageNotObservedはProcess内の同一Subsystemで完結する。
 * @security N/A: usageNotObservedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: usageNotObservedは共有非同期状態を持たない同期処理である。
 */
export function usageNotObserved(reason: string): ExecutionUsage {
  return Object.freeze({
    inputTokens: notObserved(reason),
    outputTokens: notObserved(reason),
    cacheReadTokens: notObserved(reason),
    cacheWriteTokens: notObserved(reason),
    costOrCredits: notObserved(reason),
  });
}

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
/**
 * execution-intelligenceを表示文字列へ変換する。
 *
 * @responsibility execution-intelligenceの入力値、文字列表現、機密を含めない結果境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown、maximum
 * @returns value is stringを返す。
 * @precondition 「value: unknown、maximum」がtextの入力契約を満たす。
 * @postcondition textの責務を完了した結果だけを返す。
 * @effect N/A: textは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: textは独自の失敗分岐を所有しない。
 * @invariant textは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: textはProcess内の同一Subsystemで完結する。
 * @security N/A: textはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: textは共有非同期状態を持たない同期処理である。
 */
function text(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !value.includes("\0")
  );
}

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identityは独自の失敗分岐を所有しない。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityはProcess内の同一Subsystemで完結する。
 * @security N/A: identityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

const taskAttemptIdentityKeys = new Set([
  "attemptId",
  "milestoneId",
  "objectiveId",
  "operationId",
  "projectId",
  "taskId",
] as const);

/**
 * task Attempt Event Idを決定する。
 *
 * @responsibility task Attempt Event Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: ExecutionIntelligenceEvent["identity"]
 * @returns stringを返す。
 * @precondition 「value: ExecutionIntelligenceEvent["identity"]」がtaskAttemptEventIdの入力契約を満たす。
 * @postcondition taskAttemptEventIdの責務を完了した結果だけを返す。
 * @effect N/A: taskAttemptEventIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: taskAttemptEventIdは独自の失敗分岐を所有しない。
 * @invariant taskAttemptEventIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: taskAttemptEventIdはProcess内の同一Subsystemで完結する。
 * @security N/A: taskAttemptEventIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: taskAttemptEventIdは共有非同期状態を持たない同期処理である。
 */
function taskAttemptEventId(
  value: TaskAttemptExecutionIntelligenceEvent["identity"],
): string {
  return `execution-${createHash("sha256")
    .update(
      [
        value.projectId,
        value.milestoneId,
        value.objectiveId,
        value.taskId,
        value.attemptId,
        value.operationId,
      ].join("\0"),
    )
    .digest("hex")}`;
}

/**
 * 任意OperationのイベントIdentityを決定的に導出する。
 * @responsibility Taskイベントと異なるhash領域で実行を相関する。
 * @trace ARCH-000007
 * @input Operationの検査済みIdentity。
 * @returns 決定的なイベントID。
 * @precondition Identityは閉じた3項目である。
 * @postcondition 同一入力は同一IDを返す。
 * @effect N/A: 純粋なhash計算。
 * @failure N/A: 検査後の固定入力だけを受け取る。
 * @invariant Taskのhash領域と混同しない。
 * @boundary N/A: 同一process内計算。
 * @security Authorityを含まない。
 * @concurrency N/A: 共有状態を持たない。
 */
function operationEventId(
  value: OperationExecutionIntelligenceEvent["identity"],
): string {
  return `execution-${createHash("sha256").update(["operation_settled", value.projectId, value.operationId, value.executionId].join("\0")).digest("hex")}`;
}

/**
 * 診断の静的許可値と完全なshapeを検査する。
 * @responsibility 任意のProvider本文や追加fieldを拒否する。
 * @trace ARCH-000007
 * @input 未信頼の診断値。
 * @returns 安全化された閉じた診断、またはnull。
 * @precondition N/A: 未信頼値を受け付ける。
 * @postcondition 許可値以外を保持しない。
 * @effect N/A: 局所検査のみ。
 * @failure shapeまたは値が不正ならnull。
 * @invariant 機密値を診断へ複製しない。
 * @boundary Producerから観測への値境界。
 * @security 自由文と任意Headerを受理しない。
 * @concurrency N/A: 同期局所検査。
 */
function inspectExecutionDiagnostic(
  value: unknown,
): ExecutionDiagnostic | null {
  const entry = snapshotPlainRecord(
    value,
    new Set([
      "stage",
      "category",
      "httpStatus",
      "type",
      "code",
      "finishReason",
      "refusal",
    ]),
  );
  if (
    !entry ||
    typeof entry.stage !== "string" ||
    ![
      "transport",
      "http",
      "refusal",
      "output_limit",
      "json_parse",
      "schema_validation",
      "identity_validation",
      "semantic_validation",
      "completed",
    ].includes(entry.stage) ||
    typeof entry.category !== "string" ||
    ![
      "rate_limit",
      "quota",
      "billing",
      "authentication",
      "permission",
      "unavailable",
      "invalid_response",
      "refused",
      "output_limit",
      "none",
    ].includes(entry.category) ||
    !(
      entry.httpStatus === null ||
      (typeof entry.httpStatus === "number" &&
        Number.isInteger(entry.httpStatus) &&
        entry.httpStatus >= 100 &&
        entry.httpStatus <= 599)
    ) ||
    !(
      entry.type === null ||
      (typeof entry.type === "string" &&
        [
          "rate_limit_error",
          "insufficient_quota",
          "billing_error",
          "authentication_error",
          "permission_error",
          "server_error",
          "invalid_request_error",
        ].includes(entry.type))
    ) ||
    !(
      entry.code === null ||
      (typeof entry.code === "string" &&
        [
          "rate_limit_exceeded",
          "insufficient_quota",
          "billing_hard_limit_reached",
          "invalid_api_key",
          "permission_denied",
          "server_error",
          "context_length_exceeded",
        ].includes(entry.code))
    ) ||
    !(
      entry.finishReason === null ||
      (typeof entry.finishReason === "string" &&
        [
          "completed",
          "stop",
          "length",
          "max_output_tokens",
          "content_filter",
          "refusal",
        ].includes(entry.finishReason))
    ) ||
    !(entry.refusal === null || typeof entry.refusal === "boolean")
  )
    return null;
  return Object.freeze({
    stage: entry.stage as ExecutionDiagnostic["stage"],
    category: entry.category as ExecutionDiagnostic["category"],
    httpStatus: entry.httpStatus,
    type: entry.type as ExecutionDiagnostic["type"],
    code: entry.code as ExecutionDiagnostic["code"],
    finishReason: entry.finishReason as ExecutionDiagnostic["finishReason"],
    refusal: entry.refusal,
  });
}

/**
 * 使用量5項目の欠測を残した完全性を導出する。
 * @responsibility 非該当と未観測を区別し、費用を推定しない。
 * @trace ARCH-000007
 * @input 検査済み使用量。
 * @returns 非該当、未観測、一部、完全の分類。
 * @precondition 各fieldは観測契約を満たす。
 * @postcondition 未観測を0や無課金へ変換しない。
 * @effect N/A: 局所計算のみ。
 * @failure N/A: 検査済み値を分類する。
 * @invariant 全field非該当を完全として数えない。
 * @boundary N/A: process内計算。
 * @security 金額や単価を補完しない。
 * @concurrency N/A: 共有状態なし。
 */
export function classifyExecutionUsageCompleteness(
  usage: ExecutionUsage,
): "complete" | "partial" | "not_observed" | "not_applicable" {
  const applicableUsageObservations = Object.values(usage).filter(
    (entry) => entry.state !== "not_applicable",
  );
  if (applicableUsageObservations.length === 0) return "not_applicable";
  const observedCount = applicableUsageObservations.filter(
    (entry) => entry.state === "observed",
  ).length;
  return observedCount === 0
    ? "not_observed"
    : observedCount === applicableUsageObservations.length
      ? "complete"
      : "partial";
}

/**
 * execution-intelligenceの件数を算出する。
 *
 * @responsibility execution-intelligenceの計数対象、集計規則、件数結果境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns value is numberを返す。
 * @precondition 「value: unknown」がcountの入力契約を満たす。
 * @postcondition countの責務を完了した結果だけを返す。
 * @effect N/A: countは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: countは独自の失敗分岐を所有しない。
 * @invariant countは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: countはProcess内の同一Subsystemで完結する。
 * @security N/A: countはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: countは共有非同期状態を持たない同期処理である。
 */
function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Numberが0以上か検証する。
 *
 * @responsibility Numberの数値条件、拒否条件、検証済み結果境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns value is numberを返す。
 * @precondition 「value: unknown」がnonnegativeNumberの入力契約を満たす。
 * @postcondition nonnegativeNumberの責務を完了した結果だけを返す。
 * @effect N/A: nonnegativeNumberは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: nonnegativeNumberは独自の失敗分岐を所有しない。
 * @invariant nonnegativeNumberは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: nonnegativeNumberはProcess内の同一Subsystemで完結する。
 * @security N/A: nonnegativeNumberはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: nonnegativeNumberは共有非同期状態を持たない同期処理である。
 */
function nonnegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * observationを決定する。
 *
 * @responsibility observationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown、inspectObserved: (observed: unknown) => T | null
 * @returns ExecutionObservation<T> | nullを返す。
 * @precondition 「value: unknown、inspectObserved: (observed: unknown) => T | null」がobservationの入力契約を満たす。
 * @postcondition observationの責務を完了した結果だけを返す。
 * @effect N/A: observationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observationは独自の失敗分岐を所有しない。
 * @invariant observationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observationはProcess内の同一Subsystemで完結する。
 * @security N/A: observationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: observationは共有非同期状態を持たない同期処理である。
 */
function observation<T>(
  value: unknown,
  inspectObserved: (observed: unknown) => T | null,
): ExecutionObservation<T> | null {
  const observedSnapshot = snapshotPlainRecord(
    value,
    new Set(["source", "state", "value"] as const),
  );
  if (
    observedSnapshot?.state === "observed" &&
    text(observedSnapshot.source, 128)
  ) {
    const inspected = inspectObserved(observedSnapshot.value);
    return inspected === null
      ? null
      : Object.freeze({
          state: "observed" as const,
          value: inspected,
          source: observedSnapshot.source,
        });
  }
  const absentSnapshot = snapshotPlainRecord(
    value,
    new Set(["reason", "state"] as const),
  );
  return absentSnapshot &&
    (absentSnapshot.state === "not_observed" ||
      absentSnapshot.state === "not_applicable") &&
    text(absentSnapshot.reason, 256)
    ? Object.freeze({
        state: absentSnapshot.state,
        reason: absentSnapshot.reason,
      })
    : null;
}

/**
 * Execution Intelligence Eventを観測する。
 *
 * @responsibility Execution Intelligence Eventの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns ExecutionIntelligenceEvent | nullを返す。
 * @precondition 「value: unknown」がinspectExecutionIntelligenceEventの入力契約を満たす。
 * @postcondition inspectExecutionIntelligenceEventの責務を完了した結果だけを返す。
 * @effect N/A: inspectExecutionIntelligenceEventは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectExecutionIntelligenceEventは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectExecutionIntelligenceEventは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectExecutionIntelligenceEventはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectExecutionIntelligenceEventはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectExecutionIntelligenceEventは共有非同期状態を持たない同期処理である。
 */
export function inspectExecutionIntelligenceEvent(
  value: unknown,
): ExecutionIntelligenceEvent | null {
  try {
    const event = snapshotPlainRecord(
      value,
      new Set([
        "contract",
        "eventId",
        "eventType",
        "execution",
        "identity",
        "occurredAt",
        "outcome",
        "quality",
      ] as const),
    );
    if (
      !event ||
      typeof event.eventType !== "string" ||
      !["task_attempt_settled", "operation_settled"].includes(event.eventType)
    )
      return null;
    const identitySnapshot = snapshotPlainRecord(
      event.identity,
      event.eventType === "task_attempt_settled"
        ? taskAttemptIdentityKeys
        : new Set(["projectId", "operationId", "executionId"]),
    );
    const executionSnapshot = snapshotPlainRecord(
      event.execution,
      new Set([
        "durationMs",
        "humanActiveMs",
        "inputStrategyRef",
        "model",
        "provider",
        "role",
        "usage",
        "profileId",
        "profileRevision",
        "reasoningEffort",
        "overrideApplied",
        "parentExecutionId",
        "diagnostic",
      ] as const),
    );
    const outcomeSnapshot = snapshotPlainRecord(
      event.outcome,
      new Set([
        "cleanupConfirmed",
        "effectState",
        "manualRecoveryRequired",
        "processRestartRequired",
        "reason",
        "status",
      ] as const),
    );
    if (!identitySnapshot || !executionSnapshot || !outcomeSnapshot)
      return null;
    const usageSnapshot = snapshotPlainRecord(
      executionSnapshot.usage,
      new Set([
        "cacheReadTokens",
        "cacheWriteTokens",
        "costOrCredits",
        "inputTokens",
        "outputTokens",
      ] as const),
    );
    if (!usageSnapshot) return null;
    const profileId = observation(executionSnapshot.profileId, (entry) =>
      identity(entry) ? entry : null,
    );
    const profileRevision = observation(
      executionSnapshot.profileRevision,
      (entry) => (identity(entry) ? entry : null),
    );
    const reasoningEffort = observation(
      executionSnapshot.reasoningEffort,
      (entry) => (identity(entry) ? entry : null),
    );
    const overrideApplied = observation(
      executionSnapshot.overrideApplied,
      (entry) => (typeof entry === "boolean" ? entry : null),
    );
    const parentExecutionId = observation(
      executionSnapshot.parentExecutionId,
      (entry) => (identity(entry) ? entry : null),
    );
    const diagnostic = observation(
      executionSnapshot.diagnostic,
      inspectExecutionDiagnostic,
    );
    const provider = observation(executionSnapshot.provider, (entry) =>
      identity(entry) ? entry : null,
    );
    const model = observation(executionSnapshot.model, (entry) =>
      text(entry, 128) ? entry : null,
    );
    const inputStrategyRef = observation(
      executionSnapshot.inputStrategyRef,
      (entry) => (text(entry, 256) ? entry : null),
    );
    const durationMs = observation(executionSnapshot.durationMs, (entry) =>
      count(entry) ? entry : null,
    );
    const humanActiveMs = observation(
      executionSnapshot.humanActiveMs,
      (entry) => (count(entry) ? entry : null),
    );
    const inputTokens = observation(usageSnapshot.inputTokens, (entry) =>
      count(entry) ? entry : null,
    );
    const outputTokens = observation(usageSnapshot.outputTokens, (entry) =>
      count(entry) ? entry : null,
    );
    const cacheReadTokens = observation(
      usageSnapshot.cacheReadTokens,
      (entry) => (count(entry) ? entry : null),
    );
    const cacheWriteTokens = observation(
      usageSnapshot.cacheWriteTokens,
      (entry) => (count(entry) ? entry : null),
    );
    const costOrCredits = observation(usageSnapshot.costOrCredits, (entry) => {
      const cost = snapshotPlainRecord(
        entry,
        new Set(["amount", "unit"] as const),
      );
      return cost && nonnegativeNumber(cost.amount) && identity(cost.unit)
        ? Object.freeze({ amount: cost.amount, unit: cost.unit })
        : null;
    });
    const quality = observation(event.quality, (entry) => {
      const qualitySnapshot = snapshotPlainRecord(
        entry,
        new Set(["evidenceIds", "result"] as const),
      );
      if (
        !qualitySnapshot ||
        (qualitySnapshot.result !== "accepted" &&
          qualitySnapshot.result !== "rejected")
      )
        return null;
      const evidence = snapshotPlainArray(qualitySnapshot.evidenceIds, 64);
      if (evidence.status !== "ok" || !evidence.value.every(identity))
        return null;
      return Object.freeze({
        result: qualitySnapshot.result,
        evidenceIds: Object.freeze([...evidence.value]),
      });
    });
    if (
      event.contract !== EXECUTION_INTELLIGENCE_EVENT_CONTRACT ||
      !identity(event.eventId) ||
      !text(event.occurredAt, 64) ||
      Number.isNaN(Date.parse(event.occurredAt)) ||
      !Object.values(identitySnapshot).every(identity) ||
      !identity(executionSnapshot.role) ||
      !provider ||
      !model ||
      !inputStrategyRef ||
      !durationMs ||
      !humanActiveMs ||
      !inputTokens ||
      !outputTokens ||
      !cacheReadTokens ||
      !cacheWriteTokens ||
      !costOrCredits ||
      !quality ||
      !profileId ||
      !profileRevision ||
      !reasoningEffort ||
      !overrideApplied ||
      !parentExecutionId ||
      !diagnostic ||
      typeof outcomeSnapshot.status !== "string" ||
      !["completed", "blocked", "cancelled", "unknown"].includes(
        outcomeSnapshot.status,
      ) ||
      typeof outcomeSnapshot.effectState !== "string" ||
      !["no_effect", "settled", "unknown"].includes(
        outcomeSnapshot.effectState,
      ) ||
      !text(outcomeSnapshot.reason, 512) ||
      typeof outcomeSnapshot.cleanupConfirmed !== "boolean" ||
      typeof outcomeSnapshot.manualRecoveryRequired !== "boolean" ||
      typeof outcomeSnapshot.processRestartRequired !== "boolean"
    )
      return null;
    const canonicalIdentity = Object.freeze({
      ...identitySnapshot,
    }) as ExecutionIntelligenceEvent["identity"];
    const expectedEventId =
      event.eventType === "task_attempt_settled"
        ? taskAttemptEventId(
            canonicalIdentity as TaskAttemptExecutionIntelligenceEvent["identity"],
          )
        : operationEventId(
            canonicalIdentity as OperationExecutionIntelligenceEvent["identity"],
          );
    if (event.eventId !== expectedEventId) return null;
    if (
      event.eventType === "operation_settled" &&
      parentExecutionId.state === "observed" &&
      parentExecutionId.value ===
        (canonicalIdentity as OperationExecutionIntelligenceEvent["identity"])
          .executionId
    )
      return null;
    return Object.freeze({
      contract: EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
      eventId: event.eventId,
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      identity: canonicalIdentity,
      execution: Object.freeze({
        role: executionSnapshot.role,
        provider,
        model,
        inputStrategyRef,
        durationMs,
        usage: Object.freeze({
          inputTokens,
          outputTokens,
          cacheReadTokens,
          cacheWriteTokens,
          costOrCredits,
        }),
        humanActiveMs,
        profileId,
        profileRevision,
        reasoningEffort,
        overrideApplied,
        parentExecutionId,
        diagnostic,
      }) as ExecutionIntelligenceEvent["execution"],
      outcome: Object.freeze({
        status:
          outcomeSnapshot.status as ExecutionIntelligenceEvent["outcome"]["status"],
        reason: outcomeSnapshot.reason,
        effectState:
          outcomeSnapshot.effectState as ExecutionIntelligenceEvent["outcome"]["effectState"],
        cleanupConfirmed: outcomeSnapshot.cleanupConfirmed,
        manualRecoveryRequired: outcomeSnapshot.manualRecoveryRequired,
        processRestartRequired: outcomeSnapshot.processRestartRequired,
      }),
      quality,
    }) as ExecutionIntelligenceEvent;
  } catch {
    return null;
  }
}

/**
 * Task Attempt Settled Eventを構築する。
 *
 * @responsibility Task Attempt Settled Eventの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000007
 * @input input: TaskAttemptSettledEventInput
 * @returns ExecutionIntelligenceEventを返す。
 * @precondition 「input: TaskAttemptSettledEventInput」がcreateTaskAttemptSettledEventの入力契約を満たす。
 * @postcondition createTaskAttemptSettledEventの責務を完了した結果だけを返す。
 * @effect N/A: createTaskAttemptSettledEventは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createTaskAttemptSettledEventは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createTaskAttemptSettledEventは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createTaskAttemptSettledEventはProcess内の同一Subsystemで完結する。
 * @security N/A: createTaskAttemptSettledEventはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createTaskAttemptSettledEventは共有非同期状態を持たない同期処理である。
 */
export function createTaskAttemptSettledEvent(
  input: TaskAttemptSettledEventInput,
): TaskAttemptExecutionIntelligenceEvent {
  const inputSnapshot = snapshotPlainRecord(
    input,
    new Set(["execution", "identity", "occurredAt", "outcome", "quality"]),
  );
  if (!inputSnapshot) throw new Error("execution_intelligence_event_invalid");
  const identitySnapshot = snapshotPlainRecord(
    inputSnapshot.identity,
    taskAttemptIdentityKeys,
  );
  if (!identitySnapshot || !Object.values(identitySnapshot).every(identity))
    throw new Error("execution_intelligence_event_invalid");
  const canonicalIdentity = Object.freeze({
    ...identitySnapshot,
  }) as TaskAttemptExecutionIntelligenceEvent["identity"];
  const event = {
    contract: EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
    eventId: taskAttemptEventId(canonicalIdentity),
    eventType: "task_attempt_settled" as const,
    occurredAt: inputSnapshot.occurredAt,
    identity: canonicalIdentity,
    execution: completeExecutionObservations(inputSnapshot.execution),
    outcome: inputSnapshot.outcome,
    quality: inputSnapshot.quality,
  };
  const inspected = inspectExecutionIntelligenceEvent(event);
  if (inspected?.eventType !== "task_attempt_settled")
    throw new Error("execution_intelligence_event_invalid");
  return inspected;
}

/**
 * 構築入力の省略された追加観測を明示的な未観測へ変換する。
 * @responsibility 旧constructor入力をv2の完全shapeへ接続する。
 * @trace ARCH-000007
 * @input 未信頼execution入力。
 * @returns 検査前の完全shapeまたはnull。
 * @precondition N/A: 任意値を受け取る。
 * @postcondition 値を推定せず未観測理由を保持する。
 * @effect N/A: 局所コピーのみ。
 * @failure accessorや追加fieldは拒否する。
 * @invariant 保存済みv1記録の互換Readerではない。
 * @boundary 公開constructorの値境界。
 * @security getterを実行しない。
 * @concurrency N/A: 同期処理。
 */
function completeExecutionObservations(value: unknown): unknown {
  const entry = snapshotPlainRecord(
    value,
    new Set([
      "role",
      "provider",
      "model",
      "inputStrategyRef",
      "durationMs",
      "usage",
      "humanActiveMs",
    ]),
    new Set([
      "profileId",
      "profileRevision",
      "reasoningEffort",
      "overrideApplied",
      "parentExecutionId",
      "diagnostic",
    ]),
  );
  if (!entry) return null;
  return {
    ...entry,
    profileId: Object.hasOwn(entry, "profileId")
      ? entry.profileId
      : notObserved("profile_not_reported"),
    profileRevision: Object.hasOwn(entry, "profileRevision")
      ? entry.profileRevision
      : notObserved("profile_revision_not_reported"),
    reasoningEffort: Object.hasOwn(entry, "reasoningEffort")
      ? entry.reasoningEffort
      : notObserved("reasoning_effort_not_reported"),
    overrideApplied: Object.hasOwn(entry, "overrideApplied")
      ? entry.overrideApplied
      : notObserved("override_not_reported"),
    parentExecutionId: Object.hasOwn(entry, "parentExecutionId")
      ? entry.parentExecutionId
      : notObserved("parent_execution_not_reported"),
    diagnostic: Object.hasOwn(entry, "diagnostic")
      ? entry.diagnostic
      : notObserved("diagnostic_not_reported"),
  };
}

/**
 * Taskを捏造せず任意Operationの終端観測を構築する。
 * @responsibility 任意Operation入力をv2の検査へ接続する。
 * @trace ARCH-000007
 * @input OperationSettledEventInput。
 * @returns 検査済みOperationイベント。
 * @precondition 3つのIdentityと共通観測が有効である。
 * @postcondition 新Identityだけを持つ不変イベントを返す。
 * @effect N/A: 値構築のみ。
 * @failure 不正入力はexecution_intelligence_event_invalid。
 * @invariant Task Identityを追加しない。
 * @boundary 公開constructorの値境界。
 * @security 生出力やAuthorityを保持しない。
 * @concurrency N/A: 共有状態なし。
 */
export function createOperationSettledEvent(
  input: OperationSettledEventInput,
): OperationExecutionIntelligenceEvent {
  const entry = snapshotPlainRecord(
    input,
    new Set(["execution", "identity", "occurredAt", "outcome", "quality"]),
  );
  const ids = entry
    ? snapshotPlainRecord(
        entry.identity,
        new Set(["projectId", "operationId", "executionId"]),
      )
    : null;
  if (!entry || !ids || !Object.values(ids).every(identity))
    throw new Error("execution_intelligence_event_invalid");
  const canonicalIdentity = Object.freeze({
    ...ids,
  }) as OperationExecutionIntelligenceEvent["identity"];
  const inspected = inspectExecutionIntelligenceEvent({
    contract: EXECUTION_INTELLIGENCE_EVENT_CONTRACT,
    eventType: "operation_settled",
    eventId: operationEventId(canonicalIdentity),
    occurredAt: entry.occurredAt,
    identity: canonicalIdentity,
    execution: completeExecutionObservations(entry.execution),
    outcome: entry.outcome,
    quality: entry.quality,
  });
  if (inspected?.eventType !== "operation_settled")
    throw new Error("execution_intelligence_event_invalid");
  return inspected;
}

/**
 * execution-intelligenceで使用するExecution Intelligence Summaryの値契約を定義する。
 *
 * @responsibility Execution Intelligence SummaryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligenceSummaryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligenceSummaryで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligenceSummaryの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligenceSummaryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligenceSummaryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionIntelligenceSummary = Readonly<{
  contract: "crdd/execution-intelligence-summary/v1";
  eventCount: number;
  completedCount: number;
  blockedCount: number;
  cancelledCount: number;
  unknownCount: number;
  observedDurationCount: number;
  totalObservedDurationMs: number | null;
  providerObservationCount: number;
  usageObservedEventCount: number;
  usageFullyObservedEventCount: number;
  observedUsageFieldCount: number;
  humanActiveObservationCount: number;
  qualityObservationCount: number;
  diagnosticObservationCount: number;
  assignmentFullyObservedEventCount: number;
  usageCompleteEventCount: number;
  usagePartialEventCount: number;
  usageNotApplicableEventCount: number;
  costObservationCount: number;
  missingnessPreserved: true;
}>;

/**
 * Execution Intelligenceを要約する。
 *
 * @responsibility Execution Intelligenceの集計対象、要約規則、公開結果境界を所有する。
 * @trace ARCH-000007
 * @input values: readonly unknown[]
 * @returns ExecutionIntelligenceSummary | nullを返す。
 * @precondition 「values: readonly unknown[]」がsummarizeExecutionIntelligenceの入力契約を満たす。
 * @postcondition summarizeExecutionIntelligenceの責務を完了した結果だけを返す。
 * @effect N/A: summarizeExecutionIntelligenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: summarizeExecutionIntelligenceは独自の失敗分岐を所有しない。
 * @invariant summarizeExecutionIntelligenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: summarizeExecutionIntelligenceはProcess内の同一Subsystemで完結する。
 * @security N/A: summarizeExecutionIntelligenceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: summarizeExecutionIntelligenceは共有非同期状態を持たない同期処理である。
 */
export function summarizeExecutionIntelligence(
  values: readonly unknown[],
): ExecutionIntelligenceSummary | null {
  const events = values.map(inspectExecutionIntelligenceEvent);
  if (events.some((entry) => entry === null)) return null;
  const validEvents = events as ExecutionIntelligenceEvent[];
  if (
    new Set(validEvents.map((event) => event.eventId)).size !==
    validEvents.length
  )
    return null;
  const durationValues = validEvents.flatMap((event) =>
    event.execution.durationMs.state === "observed"
      ? [event.execution.durationMs.value]
      : [],
  );
  const statusCount = (
    status: ExecutionIntelligenceEvent["outcome"]["status"],
  ) => validEvents.filter((event) => event.outcome.status === status).length;
  let totalObservedDurationMs: number | null = null;
  if (durationValues.length > 0) {
    let total = 0;
    for (const value of durationValues) {
      const next: number = total + value;
      if (!Number.isSafeInteger(next)) return null;
      total = next;
    }
    totalObservedDurationMs = total;
  }
  return Object.freeze({
    contract: "crdd/execution-intelligence-summary/v1" as const,
    eventCount: validEvents.length,
    completedCount: statusCount("completed"),
    blockedCount: statusCount("blocked"),
    cancelledCount: statusCount("cancelled"),
    unknownCount: statusCount("unknown"),
    observedDurationCount: durationValues.length,
    totalObservedDurationMs,
    providerObservationCount: validEvents.filter(
      (event) => event.execution.provider.state === "observed",
    ).length,
    usageObservedEventCount: validEvents.filter((event) =>
      Object.values(event.execution.usage).some(
        (entry) => entry.state === "observed",
      ),
    ).length,
    usageFullyObservedEventCount: validEvents.filter((event) =>
      Object.values(event.execution.usage).every(
        (entry) => entry.state === "observed",
      ),
    ).length,
    observedUsageFieldCount: validEvents.reduce(
      (count, event) =>
        count +
        Object.values(event.execution.usage).filter(
          (entry) => entry.state === "observed",
        ).length,
      0,
    ),
    humanActiveObservationCount: validEvents.filter(
      (event) => event.execution.humanActiveMs.state === "observed",
    ).length,
    qualityObservationCount: validEvents.filter(
      (event) => event.quality.state === "observed",
    ).length,
    diagnosticObservationCount: validEvents.filter(
      (event) => event.execution.diagnostic.state === "observed",
    ).length,
    assignmentFullyObservedEventCount: validEvents.filter((event) =>
      [
        event.execution.provider,
        event.execution.model,
        event.execution.profileId,
        event.execution.profileRevision,
        event.execution.reasoningEffort,
        event.execution.overrideApplied,
      ].every((entry) => entry.state === "observed"),
    ).length,
    usageCompleteEventCount: validEvents.filter(
      (event) =>
        classifyExecutionUsageCompleteness(event.execution.usage) ===
        "complete",
    ).length,
    usagePartialEventCount: validEvents.filter(
      (event) =>
        classifyExecutionUsageCompleteness(event.execution.usage) === "partial",
    ).length,
    usageNotApplicableEventCount: validEvents.filter(
      (event) =>
        classifyExecutionUsageCompleteness(event.execution.usage) ===
        "not_applicable",
    ).length,
    costObservationCount: validEvents.filter(
      (event) => event.execution.usage.costOrCredits.state === "observed",
    ).length,
    missingnessPreserved: true as const,
  });
}

/**
 * propose Execution Improvement Candidatesを決定する。
 *
 * @responsibility propose Execution Improvement Candidatesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000007
 * @input events: readonly unknown[]
 * @returns proposeExecutionImprovementCandidatesの計算結果を返す。
 * @precondition 「events: readonly unknown[]」がproposeExecutionImprovementCandidatesの入力契約を満たす。
 * @postcondition proposeExecutionImprovementCandidatesの責務を完了した結果だけを返す。
 * @effect N/A: proposeExecutionImprovementCandidatesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: proposeExecutionImprovementCandidatesは独自の失敗分岐を所有しない。
 * @invariant proposeExecutionImprovementCandidatesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: proposeExecutionImprovementCandidatesはProcess内の同一Subsystemで完結する。
 * @security N/A: proposeExecutionImprovementCandidatesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: proposeExecutionImprovementCandidatesは共有非同期状態を持たない同期処理である。
 */
export function proposeExecutionImprovementCandidates(
  events: readonly unknown[],
) {
  const inspectedEvents = events.map(inspectExecutionIntelligenceEvent);
  if (inspectedEvents.some((event) => event === null)) return null;
  const validEvents = inspectedEvents as ExecutionIntelligenceEvent[];
  const summary = summarizeExecutionIntelligence(validEvents);
  if (!summary) return null;
  const candidates: Array<
    Readonly<{ kind: string; basis: string; basisEventIds: readonly string[] }>
  > = [];
  if (summary.blockedCount + summary.unknownCount > 0)
    candidates.push(
      Object.freeze({
        kind: "investigate_noncompleted_attempts",
        basis: "blocked_or_unknown_attempt_observed",
        basisEventIds: Object.freeze(
          validEvents
            .filter(
              (event) =>
                event.outcome.status === "blocked" ||
                event.outcome.status === "unknown",
            )
            .map((event) => event.eventId),
        ),
      }),
    );
  if (summary.providerObservationCount < summary.eventCount)
    candidates.push(
      Object.freeze({
        kind: "improve_provider_observation",
        basis: "provider_identity_not_observed_for_all_attempts",
        basisEventIds: Object.freeze(
          validEvents
            .filter((event) => event.execution.provider.state !== "observed")
            .map((event) => event.eventId),
        ),
      }),
    );
  return Object.freeze({
    contract: "crdd/execution-improvement-candidates/v1" as const,
    status: "proposal" as const,
    authorityConferred: false as const,
    automaticChangeAllowed: false as const,
    summary,
    candidates: Object.freeze(candidates),
  });
}
