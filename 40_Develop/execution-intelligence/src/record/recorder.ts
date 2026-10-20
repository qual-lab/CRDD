/**
 * Repositoryの検証と実行記録の保存・読取り操作を結合する。
 *
 * @responsibility 検証済みRootと既存WriterをRecorderへ結び、利用側へ記録操作を返す。
 * @trace ARCH-000007
 */
import {
  verifyRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";

import {
  createTaskAttemptSettledEvent,
  createOperationSettledEvent,
} from "./event.ts";
import type {
  ExecutionIntelligenceEvent,
  TaskAttemptSettledEventInput,
  OperationSettledEventInput,
} from "./types.ts";
import {
  readExecutionIntelligence,
  writeExecutionIntelligenceEvent,
} from "../storage/store.ts";
import type { ExecutionIntelligencePublicationResult } from "../storage/result.ts";
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
  recordOperation: (
    input: OperationSettledEventInput,
  ) => ReturnType<typeof writeExecutionIntelligenceEvent>;
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
 * 内部の保存接続を構成する。Writer注入はPackage Rootへ公開しない。
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
    recordOperation: (input: OperationSettledEventInput) => {
      let event: ExecutionIntelligenceEvent;
      try {
        event = createOperationSettledEvent(input);
      } catch {
        return invalidEventPublication();
      }
      return writeEvent(capability, event);
    },
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
 * @effect Version Controlを通じRepositoryのFilesystem・Git境界を読み取る。履歴の保存は行わない。
 * @failure N/A: createExecutionIntelligenceRecorderは独自の失敗分岐を所有しない。
 * @invariant createExecutionIntelligenceRecorderは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Version ControlのRepository検証とRecorder結合の境界。
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

/**
 * verified-repository-rootで使用するVerified Execution Repository Rootの値契約を定義する。
 *
 * @responsibility Verified Execution Repository RootのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000007
 * @shape VerifiedExecutionRepositoryRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedExecutionRepositoryRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedExecutionRepositoryRootの宣言は外部境界を開かない。
 * @security N/A: VerifiedExecutionRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility VerifiedExecutionRepositoryRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type VerifiedExecutionRepositoryRoot = VerifiedRepositoryRoot;

/**
 * Execution Intelligence Repository Rootを検証する。
 *
 * @responsibility Execution Intelligence Repository Rootの検証根拠、成立条件、観測不能時の拒否境界を所有する。
 * @trace ARCH-000007
 * @input candidate: string
 * @returns | Readonly<{ status: "completed"; reason: "execution_repository_root_verified"; root: VerifiedExecutionRepositoryRoot; }> | Readonly<{ status: "blocked"; reason: "execution_repository_root_invalid"; }>を返す。
 * @precondition 「candidate: string」がverifyExecutionIntelligenceRepositoryRootの入力契約を満たす。
 * @postcondition verifyExecutionIntelligenceRepositoryRootの責務を完了した結果だけを返す。
 * @effect Version Controlを通じFilesystem・Git境界を読み取る。書込みEffectは0。
 * @failure N/A: verifyExecutionIntelligenceRepositoryRootは独自の失敗分岐を所有しない。
 * @invariant verifyExecutionIntelligenceRepositoryRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: verifyExecutionIntelligenceRepositoryRootはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: verifyExecutionIntelligenceRepositoryRootは共有非同期状態を持たない同期処理である。
 */
export function verifyExecutionIntelligenceRepositoryRoot(candidate: string):
  | Readonly<{
      status: "completed";
      reason: "execution_repository_root_verified";
      root: VerifiedExecutionRepositoryRoot;
    }>
  | Readonly<{
      status: "blocked";
      reason: "execution_repository_root_invalid";
    }> {
  const verified = verifyRepositoryRoot(candidate);
  if (verified.status === "blocked")
    return Object.freeze({
      status: "blocked" as const,
      reason: "execution_repository_root_invalid" as const,
    });
  return Object.freeze({
    status: "completed" as const,
    reason: "execution_repository_root_verified" as const,
    root: verified.capability,
  });
}
