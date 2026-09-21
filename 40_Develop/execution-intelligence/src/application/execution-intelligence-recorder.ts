/**
 * execution-intelligence-recorderに属する責務をまとめる。
 *
 * @responsibility ExecutionIntelligenceRecorderを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000007
 */
import {
  createTaskAttemptSettledEvent,
  type ExecutionIntelligenceEvent,
  type TaskAttemptSettledEventInput,
} from "../core/execution-intelligence.ts";
import {
  readExecutionIntelligence,
  writeExecutionIntelligenceEvent,
  type ExecutionIntelligencePublicationResult,
} from "../store/execution-intelligence-store.ts";
import { verifyExecutionIntelligenceRepositoryRoot } from "../store/verified-repository-root.ts";

/**
 * execution-intelligence-recorderで使用するExecution Intelligence Recorderの値契約を定義する。
 *
 * @responsibility Execution Intelligence RecorderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligenceRecorderが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligenceRecorderで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligenceRecorderの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligenceRecorderはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligenceRecorderの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionIntelligenceRecorder = Readonly<{
  recordTaskAttempt: (
    input: TaskAttemptSettledEventInput,
  ) => ReturnType<typeof writeExecutionIntelligenceEvent>;
  recordEvent: (
    event: ExecutionIntelligenceEvent,
  ) => ReturnType<typeof writeExecutionIntelligenceEvent>;
  read: () => ReturnType<typeof readExecutionIntelligence>;
}>;

/**
 * execution-intelligence-recorderで使用するExecution Intelligence Event Writerの値契約を定義する。
 *
 * @responsibility Execution Intelligence Event WriterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape ExecutionIntelligenceEventWriterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionIntelligenceEventWriterで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionIntelligenceEventWriterの宣言は外部境界を開かない。
 * @security N/A: ExecutionIntelligenceEventWriterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionIntelligenceEventWriterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ExecutionIntelligenceEventWriter = (
  root: Parameters<typeof writeExecutionIntelligenceEvent>[0],
  event: ExecutionIntelligenceEvent,
) => ExecutionIntelligencePublicationResult;

/**
 * Event Publicationを不正結果として構築する。
 *
 * @responsibility Event Publicationの不正理由、公開Property、結果境界を所有する。
 * @trace ARCH-000007
 * @input N/A: 実行時引数を受け取らない。
 * @returns ExecutionIntelligencePublicationResultを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinvalidEventPublicationの入力契約を満たす。
 * @postcondition invalidEventPublicationの責務を完了した結果だけを返す。
 * @effect N/A: invalidEventPublicationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: invalidEventPublicationは独自の失敗分岐を所有しない。
 * @invariant invalidEventPublicationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: invalidEventPublicationはProcess内の同一Subsystemで完結する。
 * @security N/A: invalidEventPublicationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: invalidEventPublicationは共有非同期状態を持たない同期処理である。
 */
function invalidEventPublication(): ExecutionIntelligencePublicationResult {
  return Object.freeze({
    status: "blocked" as const,
    reason: "execution_event_invalid",
    effectState: "no_effect" as const,
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed: true,
    retryAllowed: false,
    manualRecoveryRequired: false,
    residualArtifactIds: Object.freeze([]),
    recoveryReference: null,
  });
}

/**
 * Package-internal composition boundary. The writer argument is intentionally
 *
 * @responsibility Bound Execution Intelligence Recorderの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000007
 * @input capability: Parameters<typeof writeExecutionIntelligenceEvent>[0]、writeEvent: ExecutionIntelligenceEventWriter
 * @returns ExecutionIntelligenceRecorderを返す。
 * @precondition 「capability: Parameters<typeof writeExecutionIntelligenceEvent>[0]、writeEvent: ExecutionIntelligenceEventWriter」がcreateBoundExecutionIntelligenceRecorderの入力契約を満たす。
 * @postcondition createBoundExecutionIntelligenceRecorderの責務を完了した結果だけを返す。
 * @effect N/A: createBoundExecutionIntelligenceRecorderは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createBoundExecutionIntelligenceRecorderは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createBoundExecutionIntelligenceRecorderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBoundExecutionIntelligenceRecorderはProcess内の同一Subsystemで完結する。
 * @security createBoundExecutionIntelligenceRecorderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBoundExecutionIntelligenceRecorderは共有非同期状態を持たない同期処理である。
 */
export function createBoundExecutionIntelligenceRecorder(
  capability: Parameters<typeof writeExecutionIntelligenceEvent>[0],
  writeEvent: ExecutionIntelligenceEventWriter,
): ExecutionIntelligenceRecorder {
  return Object.freeze({
    recordTaskAttempt: (input: TaskAttemptSettledEventInput) => {
      let event: ExecutionIntelligenceEvent;
      try {
        event = createTaskAttemptSettledEvent(input);
      } catch {
        return invalidEventPublication();
      }
      return writeEvent(capability, event);
    },
    recordEvent: (event: ExecutionIntelligenceEvent) =>
      writeEvent(capability, event),
    read: () => readExecutionIntelligence(capability),
  });
}

/**
 * Execution Intelligence Recorderを構築する。
 *
 * @responsibility Execution Intelligence Recorderの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000007
 * @input repositoryRoot: string
 * @returns | Readonly<{ status: "completed"; reason: "execution_intelligence_recorder_ready"; recorder: ExecutionIntelligenceRecorder; }> | Readonly<{ status: "blocked"; reason: "execution_repository_root_invalid"; }>を返す。
 * @precondition 「repositoryRoot: string」がcreateExecutionIntelligenceRecorderの入力契約を満たす。
 * @postcondition createExecutionIntelligenceRecorderの責務を完了した結果だけを返す。
 * @effect N/A: createExecutionIntelligenceRecorderは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createExecutionIntelligenceRecorderは独自の失敗分岐を所有しない。
 * @invariant createExecutionIntelligenceRecorderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createExecutionIntelligenceRecorderはProcess内の同一Subsystemで完結する。
 * @security N/A: createExecutionIntelligenceRecorderはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createExecutionIntelligenceRecorderは共有非同期状態を持たない同期処理である。
 */
export function createExecutionIntelligenceRecorder(repositoryRoot: string):
  | Readonly<{
      status: "completed";
      reason: "execution_intelligence_recorder_ready";
      recorder: ExecutionIntelligenceRecorder;
    }>
  | Readonly<{
      status: "blocked";
      reason: "execution_repository_root_invalid";
    }> {
  const verified = verifyExecutionIntelligenceRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed") return verified;
  const recorder = createBoundExecutionIntelligenceRecorder(
    verified.root,
    writeExecutionIntelligenceEvent,
  );
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_intelligence_recorder_ready" as const,
    recorder,
  });
}
