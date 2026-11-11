/** 同じ検索対象から事実だけを集計する。欠測、単位、推定値を混同しない。 */
import { selectExecutions } from "./query.ts";
import type {
  ExecutionQuery,
  ExecutionSummary,
  Observation,
  ReadResult,
  StoreOptions,
} from "./types.ts";
export function summarizeExecutions(
  store: StoreOptions,
  query: ExecutionQuery = {},
): ReadResult<ExecutionSummary> {
  const selected = selectExecutions(store, query);
  if (selected.status !== "completed") return selected;
  const executions = selected.value;
  const count = (s: string) =>
    executions.filter((e) => e.completion?.outcome.status === s).length;
  const completedCount = count("completed"),
    failedCount = count("failed"),
    blockedCount = count("blocked"),
    cancelledCount = count("cancelled"),
    unknownCount = count("unknown");
  const denominator =
    completedCount + failedCount + blockedCount + cancelledCount;
  const measurements: Record<
    string,
    {
      observedCount: number;
      missingCount: number;
      notApplicableCount: number;
      total: number | null;
    }
  > = {};
  const costs: {
    unit: string;
    kind: "currency" | "credit";
    source: "reported" | "estimated";
    observedCount: number;
    total: number;
  }[] = [];
  let costMissingCount = 0,
    costNotApplicableCount = 0;
  try {
    for (const key of [
      "elapsedMs",
      "providerDurationMs",
      "inputTokens",
      "outputTokens",
      "cacheReadTokens",
      "cacheWriteTokens",
    ] as const) {
      const result = {
        observedCount: 0,
        missingCount: 0,
        notApplicableCount: 0,
        total: null as number | null,
      };
      for (const e of executions) {
        const observed: Observation<number> | undefined =
          key === "elapsedMs" || key === "providerDurationMs"
            ? e.completion?.[key]
            : e.completion?.usage?.[key];
        if (observed?.state === "observed") {
          result.observedCount++;
          result.total = (result.total ?? 0) + observed.value;
          if (
            !Number.isFinite(result.total) ||
            result.total > Number.MAX_SAFE_INTEGER
          )
            throw Error("summary_overflow");
        } else if (observed?.state === "not_applicable")
          result.notApplicableCount++;
        else result.missingCount++;
      }
      measurements[key] = result;
    }
    for (const e of executions) {
      const observed = e.completion?.usage?.cost;
      if (observed?.state === "not_applicable") {
        costNotApplicableCount++;
        continue;
      }
      if (observed?.state !== "observed") {
        costMissingCount++;
        continue;
      }
      const c = observed.value;
      let entry = costs.find(
        (v) => v.unit === c.unit && v.kind === c.kind && v.source === c.source,
      );
      if (!entry) {
        entry = {
          unit: c.unit,
          kind: c.kind,
          source: c.source,
          observedCount: 0,
          total: 0,
        };
        costs.push(entry);
      }
      entry.observedCount++;
      entry.total += c.amount;
      if (
        !Number.isFinite(entry.total) ||
        entry.total > Number.MAX_SAFE_INTEGER
      )
        throw Error("summary_overflow");
    }
    return {
      status: "completed",
      value: {
        executionCount: executions.length,
        openCount: executions.filter((e) => e.state === "open").length,
        completedCount,
        failedCount,
        blockedCount,
        cancelledCount,
        unknownCount,
        successDenominator: denominator,
        successRate: denominator ? completedCount / denominator : null,
        measurements,
        costs,
        costMissingCount,
        costNotApplicableCount,
      },
    };
  } catch {
    return { status: "blocked", reason: "summary_overflow" };
  }
}
