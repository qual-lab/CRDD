/**
 * execution-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorSingleTaskAttemptInputを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { captureRuntimeOwnedCoordinatorTaskResultDelivery } from "../../../coordinator/src/task/execution.ts";

/**
 * 同Processで捕捉した元Taskの結果配送だけを表す。
 * @responsibility 結果読取りと耐久受理後の整理を内部利用側へ型接続する。
 * @trace ARCH-000004
 * @shape 元Task閉包の読取りと終了操作。公開値ではない。
 * @invariant 開始・取消権限や新しいOwnerを追加しない。
 * @boundary OrchestratorからCoordinatorへの内部呼出し。
 * @security JSON要求・公開結果・永続Stateに格納しない。
 * @compatibility 現行の同Process配送契約だけを利用する。
 */
export type OrchestratorTaskResultDelivery = NonNullable<
  ReturnType<typeof captureRuntimeOwnedCoordinatorTaskResultDelivery>
>;

export const ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT =
  "crdd-coordinator/orchestrator-single-task-adapter" as const;
export const ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION = 2;

/**
 * execution-portで使用するOrchestrator Single Task Attempt 入力の値契約を定義する。
 *
 * @responsibility Orchestrator Single Task Attempt 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorSingleTaskAttemptInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorSingleTaskAttemptInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorSingleTaskAttemptInputの宣言は外部境界を開かない。
 * @security N/A: OrchestratorSingleTaskAttemptInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorSingleTaskAttemptInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorSingleTaskAttemptInput = Readonly<{
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  runtimeExecutionCapability: object;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
  observeResultDelivery?: (
    delivery: OrchestratorTaskResultDelivery | null,
  ) => void;
}>;

/**
 * execution-portで使用するOrchestrator Single Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Orchestrator Single Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorSingleTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorSingleTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorSingleTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: OrchestratorSingleTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorSingleTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorSingleTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

/**
 * execution-portで使用するOrchestrator Single Task 結果の値契約を定義する。
 *
 * @responsibility Orchestrator Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorSingleTaskResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorSingleTaskResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorSingleTaskResultの宣言は外部境界を開かない。
 * @security N/A: OrchestratorSingleTaskResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorSingleTaskResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorSingleTaskResult = Readonly<{
  contract: typeof ORCHESTRATOR_SINGLE_TASK_ADAPTER_CONTRACT;
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
  recoveryObligations?: readonly OrchestratorSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
}>;

/**
 * execution-portで使用するOrchestrator Execution Portの値契約を定義する。
 *
 * @responsibility Orchestrator Execution PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorExecutionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionPortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorExecutionPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorExecutionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionPort = Readonly<{
  runSingleTaskAttempt: (
    input: OrchestratorSingleTaskAttemptInput,
  ) => Promise<OrchestratorSingleTaskResult>;
}>;
