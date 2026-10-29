/**
 * 合成診断の最初のCodex説明文だけを、元結果を変えず確認する。
 * @packageDocumentation
 * @responsibility 試験Process限定の観測・本文検査・終了後破棄を所有する。
 * @trace ERB-IT-002
 * @boundary 製品APIではない。Module計測付き診断で、通常E2Eの成立根拠にしない。
 */
import { mock } from "node:test";
import * as original from "../src/result/task.ts";
import { parseProviderResult } from "../../ai-adapter/src/index.ts";
import { containsRecognizedSecretMaterial } from "../../domain-model/src/index.ts";

type Dependencies = Readonly<{
  normalize: typeof original.normalizeProviderTaskStructuredResult;
  parse: typeof parseProviderResult;
  secret: typeof containsRecognizedSecretMaterial;
}>;
type Trace = {
  provider: unknown;
  taskRole: unknown;
  taskAttempt: unknown;
  operationId: unknown;
  recoveryCorrelationId: unknown;
  recoveryId: unknown;
  cleanupConfirmed: unknown;
  processTreeTerminationObserved: unknown;
  containersAbsentObserved: unknown;
  networksAbsentObserved: unknown;
};
type TrialReport = {
  instrumentedDiagnostic?: unknown;
  sourceUnchanged?: unknown;
  resources?: { status?: unknown };
  resultWriteFailure?: unknown;
  fixtureRootsRemoved?: unknown;
  fixtureCleanupFailures?: unknown;
  fixtureRemovalGates?: {
    mode?: unknown;
    eligible?: unknown;
    reason?: unknown;
  }[];
  results?: {
    mode: unknown;
    closeConfirmed: unknown;
    runtimeClean: unknown;
    workspaceClean: unknown;
    requestId: unknown;
    task?: {
      requestId: unknown;
      cleanupConfirmed: unknown;
      recoveryIds: unknown;
    };
    stageDiagnostic?: { events?: Trace[] };
    boundaryDiagnostic?: { events?: Trace[] };
  }[];
};

/** 元関数を一回だけ呼び、検査済み説明文一件だけをTask終了まで保持する。
 * @trace ERB-IT-002
 * @effect 構築・観測はメモリのみ。finishの明示呼出しだけが表示を試みる。
 * @failure 観測故障は元return／例外を変えず、表示だけ拒否する。
 */
export function createTaskSummaryObservation(dependencies: Dependencies) {
  let candidate: string | null = null;
  let reason = "summary_missing";
  let invalid = false;
  let finished = false;
  const calls: string[] = [];
  const wrapped: typeof original.normalizeProviderTaskStructuredResult = (
    ...args
  ) => {
    let result: ReturnType<
      typeof original.normalizeProviderTaskStructuredResult
    >;
    try {
      result = dependencies.normalize(...args);
    } catch (error) {
      invalid = true;
      candidate = null;
      throw error;
    }
    try {
      if (finished || calls.length >= 4)
        throw Error("summary_call_sequence_invalid");
      calls.push(`${args[0]}:${args[1]}`);
      if (calls.length !== 1) return result;
      if (
        args[0] !== "codex" ||
        args[1] !== "executor" ||
        result.status !== "confirmed"
      )
        throw Error("summary_first_call_invalid");
      const parsed = dependencies.parse({
        provider: "codex",
        purpose: "task",
        taskRole: "executor",
        raw: args[3] as string,
      });
      if (
        parsed.status !== "confirmed" ||
        !parsed.value ||
        typeof parsed.value !== "object"
      )
        throw Error("summary_parse_unconfirmed");
      const descriptor = Object.getOwnPropertyDescriptor(
        parsed.value,
        "summary",
      );
      const text: unknown =
        descriptor && "value" in descriptor ? descriptor.value : null;
      if (
        typeof text !== "string" ||
        text.length === 0 ||
        Buffer.byteLength(text, "utf8") > 2048 ||
        /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(text) ||
        /(?:^|[\s"'`(])(?:[a-zA-Z]:[\\/]|\/|~[\\/]|\\\\|\.\.[\\/])|https?:\/\//u.test(
          text,
        ) ||
        dependencies.secret("summary.txt", text) !== false
      )
        throw Error("summary_text_rejected");
      candidate = text;
      reason = "summary_captured";
    } catch {
      invalid = true;
      candidate = null;
      reason = "summary_inspection_rejected";
    }
    return result;
  };
  return {
    wrapped,
    /** 外側の単一Task終了と順序を確認して一回だけ表示する。本文は返さない。
     * @trace ERB-IT-002
     * @effect 許可したdisplay一回だけ。結果・Fileには本文を含めない。
     */
    finish(report: unknown, display: (text: string) => void) {
      if (finished)
        return { displayed: false, reason: "summary_already_finished" };
      finished = true;
      try {
        if (invalid || candidate === null) return { displayed: false, reason };
        const value = report as TrialReport;
        const rows = value?.results;
        if (
          !Array.isArray(rows) ||
          rows.length !== 1 ||
          value.instrumentedDiagnostic !== true ||
          value.sourceUnchanged !== true ||
          value.resources?.status !== "verified" ||
          value.resultWriteFailure !== undefined
        )
          throw Error("summary_outer_result_invalid");
        const gates = value.fixtureRemovalGates;
        const failures = value.fixtureCleanupFailures;
        if (
          !Array.isArray(gates) ||
          gates.length !== 1 ||
          gates[0]?.mode !== "direct" ||
          typeof gates[0].eligible !== "boolean" ||
          gates[0].reason !==
            (gates[0].eligible
              ? "fixture_closed_and_unreferenced"
              : "fixture_cleanup_unconfirmed") ||
          typeof value.fixtureRootsRemoved !== "boolean" ||
          !Array.isArray(failures) ||
          (value.fixtureRootsRemoved
            ? !gates[0].eligible || failures.length !== 0
            : failures.length !== 1 ||
              failures[0] !== "direct_fixture_removal_failed")
        )
          throw Error("summary_fixture_disposition_unconfirmed");
        const row = rows[0];
        if (
          row?.mode !== "direct" ||
          row.closeConfirmed !== true ||
          row.runtimeClean !== true ||
          row.workspaceClean !== true ||
          !row.requestId ||
          row.task?.requestId !== row.requestId ||
          row.task.cleanupConfirmed !== true ||
          !Array.isArray(row.task.recoveryIds) ||
          row.task.recoveryIds.length !== 0
        )
          throw Error("summary_task_unsettled");
        const stages = row.stageDiagnostic?.events;
        const boundaries = row.boundaryDiagnostic?.events;
        if (
          !Array.isArray(stages) ||
          ![2, 4].includes(stages.length) ||
          !Array.isArray(boundaries) ||
          boundaries.length !== stages.length
        )
          throw Error("summary_stages_unconfirmed");
        const expected = stages.map((_, i) =>
          i % 2 === 0 ? "codex:executor" : "claude:reviewer",
        );
        if (JSON.stringify(calls) !== JSON.stringify(expected))
          throw Error("summary_sequence_mismatch");
        const operation = stages[0]?.operationId,
          correlation = stages[0]?.recoveryCorrelationId;
        if (typeof operation !== "string" || typeof correlation !== "string")
          throw Error("summary_identity_missing");
        for (let i = 0; i < stages.length; i++) {
          const stage = stages[i],
            boundary = boundaries[i];
          if (
            !stage ||
            !boundary ||
            `${stage.provider}:${stage.taskRole}` !== expected[i] ||
            stage.taskAttempt !== Math.floor(i / 2) ||
            stage.operationId !== operation ||
            stage.recoveryCorrelationId !== correlation ||
            boundary.operationId !== operation ||
            boundary.recoveryCorrelationId !== correlation ||
            boundary.provider !== stage.provider ||
            boundary.taskRole !== stage.taskRole ||
            boundary.taskAttempt !== stage.taskAttempt ||
            typeof boundary.recoveryId !== "string" ||
            boundary.cleanupConfirmed !== true ||
            boundary.processTreeTerminationObserved !== true ||
            boundary.containersAbsentObserved !== true ||
            boundary.networksAbsentObserved !== true
          )
            throw Error("summary_identity_or_cleanup_invalid");
        }
        display(candidate);
        return {
          displayed: true,
          reason: "summary_displayed_after_task_close",
        };
      } catch {
        return {
          displayed: false,
          reason: "summary_display_or_correlation_unconfirmed",
        };
      } finally {
        candidate = null;
      }
    },
    clear() {
      candidate = null;
      finished = true;
    },
  };
}

/** consumer import前に試験Module観測を設置する。復元の終点は専用子Process終了。
 * @trace ERB-IT-002
 * @effect このProcessのModule参照だけを計測する。製品Fileは変更しない。
 */
export function installTaskSummaryObservation() {
  const observation = createTaskSummaryObservation({
    normalize: original.normalizeProviderTaskStructuredResult,
    parse: parseProviderResult,
    secret: containsRecognizedSecretMaterial,
  });
  const replacement = mock.module(
    new URL("../src/result/task.ts", import.meta.url).href,
    {
      namedExports: {
        ...original,
        normalizeProviderTaskStructuredResult: observation.wrapped,
      },
    },
  );
  return {
    finish: observation.finish,
    close() {
      observation.clear();
      replacement.restore();
    },
  };
}
