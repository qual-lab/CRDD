/**
 * 実行観測から非Authorityの改善候補を導出する。
 *
 * @packageDocumentation
 * @responsibility 観測済み事実と欠測に基づく改善候補と根拠Eventを返す。
 * @trace ARCH-000007
 * @boundary 検査済み実行Eventと提案評価の境界。
 * @effect N/A: 入力から提案を構成するだけで書込みや採用は行わない。
 * @security 提案に実行・採用Authorityを付与しない。
 */
import {
  inspectExecutionIntelligenceEvent,
  summarizeExecutionIntelligence,
  type ExecutionIntelligenceEvent,
} from "../record/event-and-summary.ts";

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
