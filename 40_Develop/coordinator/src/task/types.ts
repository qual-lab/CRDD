/**
 * Task完了観測のProcess内データ契約を定義する。
 *
 * @responsibility 観測済みと観測不能を別の型として保持する。
 * @trace ARCH-000004
 */

/**
 * 完了Promiseの観測結果を表す。
 *
 * @responsibility 未検証の完了値と取消搬送事実、完了拒否を区別する。
 * @trace ARCH-000004
 * @shape observedはrawCompletionとcancellationTransferred、unknownは観測不能だけを保持する。
 * @invariant observedはTask成功や資源回収の成立を意味しない。
 * @boundary Process内の完了観測と上位結果検証の境界。
 * @security rawCompletionを公開結果やログへ直接搬送しない。
 */
export type TaskCompletionObservation =
  | Readonly<{
      status: "observed";
      rawCompletion: unknown;
      cancellationTransferred: boolean;
    }>
  | Readonly<{ status: "unknown" }>;

/**
 * execution-portで使用するProject Runtime Single Task Attempt 入力の値契約を定義する。
 *
 * @responsibility Project Runtime Single Task Attempt 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskAttemptInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskAttemptInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskAttemptInputの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskAttemptInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskAttemptInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskAttemptInput = Readonly<{
  operationId: string;
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
 * @shape CoordinatorTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskRecoveryObligation = Readonly<{
  kind: "host" | "docker" | "candidate" | "candidate_store";
  recoveryId: string;
}>;

/**
 * execution-portで使用するProject Runtime Single Task 結果の値契約を定義する。
 *
 * @responsibility Project Runtime Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskAttemptResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskAttemptResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskAttemptResultの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskAttemptResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskAttemptResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskAttemptResult = Readonly<{
  contract: "crdd-coordinator/task-attempt";
  operationId: string | null;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  effectState: "no_effect" | "settled" | "unknown";
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
}>;
