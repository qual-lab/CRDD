/**
 * 実行記録の通常データ抽出・構造・識別子・観測整合を検査する。
 * @responsibility 実行記録の通常データ抽出・構造・識別子・観測整合を検査する。
 * @trace ARCH-000007
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { EXECUTION_INTELLIGENCE_EVENT_CONTRACT } from "./types.ts";
import type {
  TaskAttemptExecutionIntelligenceEvent,
  OperationExecutionIntelligenceEvent,
  ExecutionDiagnostic,
  ExecutionUsage,
  ExecutionObservation,
  ExecutionIntelligenceEvent,
} from "./types.ts";

/**
 * plain-data-snapshotで使用するArray Snapshotの値契約を定義する。
 *
 * @responsibility Array SnapshotのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ArraySnapshotが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArraySnapshotで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArraySnapshotの宣言は外部境界を開かない。
 * @security N/A: ArraySnapshotはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArraySnapshotの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ArraySnapshot<T> =
  | Readonly<{ status: "ok"; value: readonly T[] }>
  | Readonly<{ status: "blocked"; value: null }>;

/**
 * Plain 記録かを判定する。
 *
 * @responsibility Plain 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainRecordの入力契約を満たす。
 * @postcondition isPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: isPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isPlainRecordは共有非同期状態を持たない同期処理である。
 */
function isPlainRecord(value: unknown): value is object {
  try {
    if (
      value === null ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Data Descriptorかを判定する。
 *
 * @responsibility Data Descriptorの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000007
 * @input descriptor: PropertyDescriptor | undefined、shouldBeEnumerable
 * @returns descriptor is PropertyDescriptor & { value: unknown }を返す。
 * @precondition 「descriptor: PropertyDescriptor | undefined、shouldBeEnumerable」がisDataDescriptorの入力契約を満たす。
 * @postcondition isDataDescriptorの責務を完了した結果だけを返す。
 * @effect N/A: isDataDescriptorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDataDescriptorは独自の失敗分岐を所有しない。
 * @invariant isDataDescriptorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDataDescriptorはProcess内の同一Subsystemで完結する。
 * @security N/A: isDataDescriptorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDataDescriptorは共有非同期状態を持たない同期処理である。
 */
function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
  shouldBeEnumerable = true,
): descriptor is PropertyDescriptor & { value: unknown } {
  return Boolean(
    descriptor !== undefined &&
      "value" in descriptor &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      (!shouldBeEnumerable || descriptor.enumerable === true),
  );
}

/**
 * Plain 記録を所有Snapshotへ変換する。
 *
 * @responsibility Plain 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown、expectedKeys: ReadonlySet<K>、optionalKeys: ReadonlySet<K>。
 * @returns Readonly<Record<K, unknown>> | nullを返す。
 * @precondition 「value: unknown、expectedKeys: ReadonlySet<K>」がsnapshotPlainRecordの入力契約を満たす。
 * @postcondition snapshotPlainRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotPlainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotPlainRecordは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainRecord<const K extends string>(
  value: unknown,
  expectedKeys: ReadonlySet<K>,
  optionalKeys: ReadonlySet<K> = new Set<K>(),
): Readonly<Record<K, unknown>> | null {
  try {
    if (!isPlainRecord(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length < expectedKeys.size ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          (!expectedKeys.has(key as K) && !optionalKeys.has(key as K)),
      )
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of expectedKeys) {
      const descriptor = descriptors[key];
      if (!isDataDescriptor(descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    for (const key of optionalKeys) {
      const descriptor = descriptors[key];
      if (descriptor === undefined) continue;
      if (!isDataDescriptor(descriptor)) return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * Plain Arrayを所有Snapshotへ変換する。
 *
 * @responsibility Plain Arrayの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000007
 * @input value: unknown、maximumLength: number
 * @returns ArraySnapshot<T>を返す。
 * @precondition 「value: unknown、maximumLength: number」がsnapshotPlainArrayの入力契約を満たす。
 * @postcondition snapshotPlainArrayの責務を完了した結果だけを返す。
 * @effect N/A: snapshotPlainArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotPlainArrayは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotPlainArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotPlainArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotPlainArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotPlainArrayは共有非同期状態を持たない同期処理である。
 */
export function snapshotPlainArray<T = unknown>(
  value: unknown,
  maximumLength: number,
): ArraySnapshot<T> {
  try {
    if (
      !Array.isArray(value) ||
      utilTypes.isProxy(value) ||
      Object.getPrototypeOf(value) !== Array.prototype ||
      !Number.isSafeInteger(maximumLength) ||
      maximumLength < 0
    )
      return Object.freeze({ status: "blocked", value: null });
    const initialLength = Object.getOwnPropertyDescriptor(value, "length");
    if (
      !isDataDescriptor(initialLength, false) ||
      !Number.isSafeInteger(initialLength.value) ||
      initialLength.value < 0 ||
      initialLength.value > maximumLength
    )
      return Object.freeze({ status: "blocked", value: null });
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    const currentLength = (
      descriptors as unknown as Record<string, PropertyDescriptor | undefined>
    ).length;
    if (
      keys.length !== initialLength.value + 1 ||
      !isDataDescriptor(currentLength, false) ||
      currentLength.value !== initialLength.value
    )
      return Object.freeze({ status: "blocked", value: null });
    const snapshotItems: T[] = [];
    for (let index = 0; index < initialLength.value; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!isDataDescriptor(descriptor))
        return Object.freeze({ status: "blocked", value: null });
      snapshotItems.push(descriptor.value as T);
    }
    return Object.freeze({ status: "ok", value: Object.freeze(snapshotItems) });
  } catch {
    return Object.freeze({ status: "blocked", value: null });
  }
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
export function identity(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}

export const taskAttemptIdentityKeys = new Set([
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
export function taskAttemptEventId(
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
export function operationEventId(
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
export function count(value: unknown): value is number {
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
