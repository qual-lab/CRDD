/**
 * 実行Event Sourceから対象Projectの事実と評価候補を分離したProjectionを生成する。
 *
 * @responsibility Project・Attempt相関、観測不能記録の隔離および事実と非Authority候補の分離を所有する。
 * @trace ARCH-000007
 * @boundary Event SourceからProjectorへ渡る直接境界とCandidate分類の隣接境界。
 * @effect N/A: 入力Eventと対象Projectを変更せず、読取り結果だけを返す。
 */
import {
  inspectExecutionIntelligenceEvent,
  proposeExecutionImprovementCandidates,
  type ExecutionIntelligenceEvent,
} from "../core/execution-intelligence.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const MAXIMUM_EVENTS = 4_224;
const MAXIMUM_ATTEMPTS = 128;

/**
 * 実行記録Projectionの入力契約を定義する。
 *
 * @responsibility 対象Project、許可するAttemptおよびEvent Sourceの入力を型として固定する。
 * @trace ARCH-000007
 * @shape ExecutionRecordProjectionInputの相関IdentityとEvent集合を固定する。
 * @invariant ProjectとAttemptの双方が一致するEventだけを事実へ含める。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側は宣言済み相関Identityだけへ依存する。
 */
export type ExecutionRecordProjectionInput = Readonly<{
  projectId: string;
  attemptIds: readonly string[];
  events: readonly unknown[];
}>;

/**
 * 実行記録Projectionの結果契約を定義する。
 *
 * @responsibility 相関済み事実、対象外・不明記録および未採用評価候補を別fieldで保持する。
 * @trace ARCH-000007
 * @shape ExecutionRecordProjectionResultのfacts、excludedおよびevaluationを固定する。
 * @invariant 候補を事実または採用判断へ昇格せず、unknownを対象外へ畳まない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority、秘密値または信頼判断を扱わない。
 * @compatibility 利用側はfactsとevaluationを独立した結果として扱う。
 */
export type ExecutionRecordProjectionResult = Readonly<{
  projectId: string;
  facts: readonly ExecutionIntelligenceEvent[];
  excluded: readonly Readonly<{
    eventId: string | null;
    state: "outside_project" | "outside_attempt" | "unknown";
    reason: string;
  }>[];
  evaluation: NonNullable<
    ReturnType<typeof proposeExecutionImprovementCandidates>
  >;
  authorityConferred: false;
}>;

/**
 * Event Sourceを対象Projectの事実と評価候補へ投影する。
 *
 * @responsibility Project・Attempt相関を検査し、観測不能Eventをunknownとして隔離して、事実と評価候補を分離する。
 * @trace ARCH-000007
 * @input value: ExecutionRecordProjectionInput
 * @returns 有効な入力のExecutionRecordProjectionResult、入力集合契約不正ならnullを返す。
 * @precondition projectIdとattemptIdsが対象Projectionの相関境界を表す。
 * @postcondition 対象外Eventをfactsへ含めず、評価候補へAuthorityを付与しない。
 * @effect N/A: Source、Task、ProjectおよびProviderを変更しない。
 * @failure 不正Eventはunknownへ隔離し、重複Attemptや空入力契約はnullで拒否する。
 * @invariant 別Project・別Attempt・観測時点不明のEventを対象事実へ混在させない。
 * @boundary Event Source→Projectorの直接境界と事実Store／Candidate分類の隣接境界。
 * @security N/A: 値を公開せず相関結果だけを返し、Authorityを発行しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function projectExecutionRecords(
  value: unknown,
): ExecutionRecordProjectionResult | null {
  const input = snapshotPlainRecord(
    value,
    new Set(["attemptIds", "events", "projectId"] as const),
  );
  const attemptIds = input
    ? snapshotPlainArray<string>(input.attemptIds, MAXIMUM_ATTEMPTS)
    : { status: "blocked" as const, value: null };
  const events = input
    ? snapshotPlainArray(input.events, MAXIMUM_EVENTS)
    : { status: "blocked" as const, value: null };
  if (
    !input ||
    typeof input.projectId !== "string" ||
    !ID.test(input.projectId) ||
    attemptIds.status !== "ok" ||
    attemptIds.value.length === 0 ||
    !attemptIds.value.every((entry) => ID.test(entry)) ||
    new Set(attemptIds.value).size !== attemptIds.value.length ||
    events.status !== "ok"
  )
    return null;
  const facts: ExecutionIntelligenceEvent[] = [];
  const excludedEvents: Array<{
    eventId: string | null;
    state: "outside_project" | "outside_attempt" | "unknown";
    reason: string;
  }> = [];
  for (const event of events.value) {
    const inspected = inspectExecutionIntelligenceEvent(event);
    if (!inspected) {
      excludedEvents.push({
        eventId: null,
        state: "unknown",
        reason: "event_contract_or_observed_at_unknown",
      });
      continue;
    }
    if (inspected.identity.projectId !== input.projectId) {
      excludedEvents.push({
        eventId: inspected.eventId,
        state: "outside_project",
        reason: "project_identity_mismatch",
      });
      continue;
    }
    if (!attemptIds.value.includes(inspected.identity.attemptId)) {
      excludedEvents.push({
        eventId: inspected.eventId,
        state: "outside_attempt",
        reason: "attempt_identity_mismatch",
      });
      continue;
    }
    facts.push(inspected);
  }
  const evaluation = proposeExecutionImprovementCandidates(facts);
  if (!evaluation) return null;
  return Object.freeze({
    projectId: input.projectId,
    facts: Object.freeze(facts),
    excluded: Object.freeze(
      excludedEvents.map((entry) => Object.freeze(entry)),
    ),
    evaluation,
    authorityConferred: false,
  });
}
