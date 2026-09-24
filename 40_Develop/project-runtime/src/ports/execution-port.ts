/**
 * execution-portに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeSingleTaskAttemptInputを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
export const PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT =
  "crdd-coordinator/project-runtime-single-task-adapter" as const;
export const PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT_REVISION = 2;

/**
 * execution-portで使用するProject Runtime Single Task Attempt 入力の値契約を定義する。
 *
 * @responsibility Project Runtime Single Task Attempt 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeSingleTaskAttemptInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeSingleTaskAttemptInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeSingleTaskAttemptInputの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeSingleTaskAttemptInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeSingleTaskAttemptInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeSingleTaskAttemptInput = Readonly<{
  attemptId: string;
  operationId: string;
  authorityBindingId: string;
  repositoryRevision: string;
  runtimeExecutionCapability: object;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
}>;

/**
 * execution-portで使用するProject Runtime Single Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Project Runtime Single Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeSingleTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeSingleTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeSingleTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeSingleTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeSingleTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeSingleTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

/**
 * execution-portで使用するProject Runtime Single Task 結果の値契約を定義する。
 *
 * @responsibility Project Runtime Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeSingleTaskResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeSingleTaskResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeSingleTaskResultの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeSingleTaskResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeSingleTaskResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeSingleTaskResult = Readonly<{
  contract: typeof PROJECT_RUNTIME_SINGLE_TASK_ADAPTER_CONTRACT;
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
  recoveryObligations?: readonly ProjectRuntimeSingleTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
}>;

/**
 * execution-portで使用するProject Runtime Execution Portの値契約を定義する。
 *
 * @responsibility Project Runtime Execution PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeExecutionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeExecutionPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeExecutionPortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeExecutionPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeExecutionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeExecutionPort = Readonly<{
  runSingleTaskAttempt: (
    input: ProjectRuntimeSingleTaskAttemptInput,
  ) => Promise<ProjectRuntimeSingleTaskResult>;
}>;
