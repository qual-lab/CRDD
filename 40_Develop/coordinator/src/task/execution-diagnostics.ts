/**
 * 実行と回復の直列診断・終了契約と既存Reporterを所有する。
 * @responsibility 実行と回復の直列診断・終了契約と既存Reporterを所有する。
 * @trace ARCH-000004
 */
import type { Writable } from "node:stream";
import type { OrchestratorExecutionPublicationObservation } from "./execution-contract.ts";

export const ORCHESTRATOR_RECOVERY_LIFECYCLE_PREFIX =
  "[Orchestrator recovery] " as const;

export const ORCHESTRATOR_EXECUTION_INTELLIGENCE_PREFIX =
  "[Orchestrator execution intelligence] " as const;

const ORCHESTRATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS = 5_000;

/**
 * 回復診断の書込み終端を表す値契約を定義する。
 *
 * @responsibility Orchestrator 回復 Diagnostic OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorRecoveryDiagnosticOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorRecoveryDiagnosticOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorRecoveryDiagnosticOutcomeの宣言は外部境界を開かない。
 * @security N/A: OrchestratorRecoveryDiagnosticOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorRecoveryDiagnosticOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorRecoveryDiagnosticOutcome =
  | "success"
  | "callback_error"
  | "stream_error"
  | "stream_close"
  | "timeout"
  | "unavailable"
  | "throw";

/**
 * Orchestrator Internal Diagnostic Reporterを構築する。
 *
 * @responsibility Orchestrator Internal Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>
 * @returns createOrchestratorInternalDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、input: Readonly<{ prefix: string; event: string; timeoutMs: number; }>」がcreateOrchestratorInternalDiagnosticReporterの入力契約を満たす。
 * @postcondition createOrchestratorInternalDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect 構築時は診断値を書かず、返却Reporterが呼ばれた時だけ指定Writableへ直列書込みする。
 * @failure createOrchestratorInternalDiagnosticReporterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createOrchestratorInternalDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 返却Reporterが内部診断値→指定Writableの出力境界を所有する。
 * @security N/A: createOrchestratorInternalDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 返却Reporterはcallback・error・close・timeoutを一度の終端へ収束させ、失敗後の追加書込みを止める。
 */
function createOrchestratorInternalDiagnosticReporter(
  stream: Writable,
  input: Readonly<{
    prefix: string;
    event: string;
    timeoutMs: number;
  }>,
) {
  let isUnavailable = !stream.writable || stream.destroyed;
  let isDisposed = false;
  let pending:
    | ((outcome: OrchestratorRecoveryDiagnosticOutcome) => void)
    | null = null;
  let tail = Promise.resolve();
  const onError = () => {
    isUnavailable = true;
    pending?.("stream_error");
  };
  const onClose = () => {
    isUnavailable = true;
    pending?.("stream_close");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  stream.on("error", onError);
  stream.on("close", onClose);

  const writeOne = (event: object) =>
    new Promise<OrchestratorRecoveryDiagnosticOutcome>((resolve) => {
      if (isDisposed || isUnavailable || !stream.writable || stream.destroyed) {
        resolve("unavailable");
        return;
      }
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const settle = (
        outcome: OrchestratorRecoveryDiagnosticOutcome,
        isDisable = false,
      ) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        timer = null;
        pending = null;
        if (isDisable) isUnavailable = true;
        resolve(outcome);
      };
      pending = (outcome) => settle(outcome, true);
      timer = setTimeout(() => settle("timeout", true), input.timeoutMs);
      try {
        stream.write(
          `${input.prefix}${JSON.stringify({
            ...event,
            event: input.event,
          })}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle("success");
            else settle("callback_error", true);
          },
        );
      } catch {
        settle("throw", true);
      }
    });

  const report = (event: object) => {
    const result = tail.then(() => writeOne(event));
    tail = result.then(() => undefined);
    return result;
  };
  const dispose = () => {
    if (isDisposed) return;
    isDisposed = true;
    isUnavailable = true;
    pending?.("unavailable");
    stream.off("error", onError);
    stream.off("close", onClose);
  };
  return Object.freeze({ report, dispose });
}

/**
 * Orchestrator 回復 Diagnostic Reporterを構築する。
 *
 * @responsibility Orchestrator 回復 Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createOrchestratorRecoveryDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateOrchestratorRecoveryDiagnosticReporterの入力契約を満たす。
 * @postcondition createOrchestratorRecoveryDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect 構築時は診断値を書かず、返却Reporterが呼ばれた時だけ指定Writableへ直列書込みする。
 * @failure N/A: createOrchestratorRecoveryDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createOrchestratorRecoveryDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 返却Reporterが内部診断値→指定Writableの出力境界を所有する。
 * @security N/A: createOrchestratorRecoveryDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 返却Reporterはcallback・error・close・timeoutを一度の終端へ収束させ、失敗後の追加書込みを止める。
 */
export function createOrchestratorRecoveryDiagnosticReporter(
  stream: Writable,
  timeoutMs = ORCHESTRATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createOrchestratorInternalDiagnosticReporter(stream, {
    prefix: ORCHESTRATOR_RECOVERY_LIFECYCLE_PREFIX,
    event: "orchestrator_recovery_transition",
    timeoutMs,
  });
}

/**
 * Orchestrator Execution Intelligence Diagnostic Reporterを構築する。
 *
 * @responsibility Orchestrator Execution Intelligence Diagnostic Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input stream: Writable、timeoutMs
 * @returns createOrchestratorExecutionIntelligenceDiagnosticReporterの計算結果を返す。
 * @precondition 「stream: Writable、timeoutMs」がcreateOrchestratorExecutionIntelligenceDiagnosticReporterの入力契約を満たす。
 * @postcondition createOrchestratorExecutionIntelligenceDiagnosticReporterの責務を完了した結果だけを返す。
 * @effect 構築時は診断値を書かず、返却Reporterが呼ばれた時だけ指定Writableへ直列書込みする。
 * @failure N/A: createOrchestratorExecutionIntelligenceDiagnosticReporterは独自の失敗分岐を所有しない。
 * @invariant createOrchestratorExecutionIntelligenceDiagnosticReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 返却Reporterが内部診断値→指定Writableの出力境界を所有する。
 * @security N/A: createOrchestratorExecutionIntelligenceDiagnosticReporterはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 返却Reporterはcallback・error・close・timeoutを一度の終端へ収束させ、失敗後の追加書込みを止める。
 */
export function createOrchestratorExecutionIntelligenceDiagnosticReporter(
  stream: Writable,
  timeoutMs = ORCHESTRATOR_RECOVERY_DIAGNOSTIC_TIMEOUT_MS,
) {
  return createOrchestratorInternalDiagnosticReporter(stream, {
    prefix: ORCHESTRATOR_EXECUTION_INTELLIGENCE_PREFIX,
    event: "orchestrator_execution_intelligence_publication",
    timeoutMs,
  });
}

const productionRecoveryDiagnosticReporter =
  createOrchestratorRecoveryDiagnosticReporter(process.stderr);

const productionExecutionIntelligenceDiagnosticReporter =
  createOrchestratorExecutionIntelligenceDiagnosticReporter(process.stderr);

/**
 * Orchestrator 回復 Diagnosticを書き込む。
 *
 * @responsibility Orchestrator 回復 Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input event: object
 * @returns N/A: writeOrchestratorRecoveryDiagnosticは戻り値を返さない。
 * @precondition 「event: object」がwriteOrchestratorRecoveryDiagnosticの入力契約を満たす。
 * @postcondition writeOrchestratorRecoveryDiagnosticの責務を完了して呼出し元へ制御を戻す。
 * @effect 既存Singleton Reporterへ診断値を渡し、指定Writableへ書き込む。
 * @failure N/A: writeOrchestratorRecoveryDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeOrchestratorRecoveryDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 内部診断値→Singleton Reporter→指定Writableの出力境界へ接続する。
 * @security N/A: writeOrchestratorRecoveryDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency Reporterの非同期完了・失敗を呼出し側へ返し、書込み順序を維持する。
 */
export async function writeOrchestratorRecoveryDiagnostic(event: object) {
  await productionRecoveryDiagnosticReporter.report(event);
}

/**
 * Orchestrator Execution Intelligence Diagnosticを書き込む。
 *
 * @responsibility Orchestrator Execution Intelligence Diagnosticの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000004
 * @input observation: OrchestratorExecutionPublicationObservation
 * @returns 戻り値なし。書込み完了は呼出し側へ返さない。
 * @precondition 「observation: OrchestratorExecutionPublicationObservation」がwriteOrchestratorExecutionIntelligenceDiagnosticの入力契約を満たす。
 * @postcondition completed観測は出力せず、それ以外をReporterへ委譲して即時復帰する。
 * @effect 既存Singleton Reporterへ診断値を渡し、指定Writableへ書き込む。
 * @failure N/A: writeOrchestratorExecutionIntelligenceDiagnosticは独自の失敗分岐を所有しない。
 * @invariant writeOrchestratorExecutionIntelligenceDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 内部診断値→Singleton Reporter→指定Writableの出力境界へ接続する。
 * @security N/A: writeOrchestratorExecutionIntelligenceDiagnosticはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency 呼出し側は書込みを待たない。直列化と失敗後停止はReporterが所有する。
 */
export function writeOrchestratorExecutionIntelligenceDiagnostic(
  observation: OrchestratorExecutionPublicationObservation,
) {
  if (observation.status === "completed") return;
  void productionExecutionIntelligenceDiagnosticReporter.report(observation);
}
