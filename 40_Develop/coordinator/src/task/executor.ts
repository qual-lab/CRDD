/**
 * execution-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorSingleTaskAttemptInputを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { CoordinatorWorkspaceResult } from "../execution/types.ts";

/**
 * 同Processで捕捉した元Taskの結果配送だけを表す。
 * @responsibility 結果読取りと耐久受理後の整理を内部利用側へ型接続する。
 * @trace ARCH-000004
 * @shape 元Task閉包の読取りと終了操作。公開値ではない。
 * @invariant 開始・取消権限や新しいOwnerを追加しない。
 * @boundary CoordinatorからCoordinatorへの内部呼出し。
 * @security JSON要求・公開結果・永続Stateに格納しない。
 * @compatibility 現行の同Process配送契約だけを利用する。
 */
export type CoordinatorTaskResultDelivery = Readonly<{
  readResults: () =>
    | Readonly<{ status: "blocked" | "not_required"; results: null }>
    | Readonly<{
        status: "completed";
        results: readonly Readonly<{
          repositoryBinding: string;
          operationId: string;
          recoveryId: string;
          resultId: string;
          consumer: "orchestrator";
        }>[];
      }>;
  complete: (
    recoveryId: unknown,
    readProjectAcceptance: unknown,
  ) => Readonly<{
    status: "completed" | "blocked";
    reason: string | null;
    filesystemEffectIssued: boolean;
    snapshotConfirmed: boolean;
    lockReleased: boolean;
  }>;
}>;

export const COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT =
  "crdd-coordinator/orchestrator-single-task-adapter" as const;
export const COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION = 3;

/**
 * execution-portで使用するCoordinator Single Task Attempt 入力の値契約を定義する。
 *
 * @responsibility Coordinator Single Task Attempt 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorSingleTaskAttemptInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorSingleTaskAttemptInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorSingleTaskAttemptInputの宣言は外部境界を開かない。
 * @security N/A: CoordinatorSingleTaskAttemptInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorSingleTaskAttemptInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorSingleTaskAttemptInput = Readonly<{
  workspaceId?: string | null;
  ownerRepositoryRoot?: string;
  executionTree?: string;
  workspaceBaseCommit?: string | null;
  workspaceHead?: string | null;
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
  observeResultDelivery?: (
    delivery: CoordinatorTaskResultDelivery | null,
  ) => void;
}>;

/**
 * execution-portで使用するCoordinator Single Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Coordinator Single Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorSingleTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorSingleTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorSingleTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorSingleTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorSingleTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorSingleTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

/**
 * execution-portで使用するCoordinator Single Task 結果の値契約を定義する。
 *
 * @responsibility Coordinator Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorSingleTaskResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorSingleTaskResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorSingleTaskResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorSingleTaskResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorSingleTaskResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorSingleTaskResult = Readonly<{
  contract: typeof COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT;
  attemptId: string | null;
  operationId: string | null;
  authorityBindingId: string | null;
  repositoryRevision: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations?: readonly CoordinatorSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
  workspaceResult?: CoordinatorWorkspaceResult;
}>;

/**
 * execution-portで使用するCoordinator Execution Portの値契約を定義する。
 *
 * @responsibility Coordinator Execution PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorExecutionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorExecutionPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorExecutionPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorExecutionPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorExecutionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorExecutionPort = Readonly<{
  runSingleTaskAttempt: (
    input: CoordinatorSingleTaskAttemptInput,
  ) => Promise<CoordinatorSingleTaskResult>;
}>;
