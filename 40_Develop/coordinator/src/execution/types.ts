/**
 * Task完了観測のProcess内データ契約を定義する。
 *
 * @responsibility 観測済みと観測不能を別の型として保持する。
 * @trace ARCH-000004
 */
import type { BorrowedExecutionTarget } from "./borrowed-tree.ts";
/**
 * 完了Promiseの観測結果を表す。
 *
 * @responsibility 未検証の完了値と取消搬送事実、完了拒否を区別する。
 * @trace ARCH-000004
 * @shape observedはrawCompletionとcancellationTransferred、unknownは観測不能だけを保持する。
 * @invariant observedはTask成功や資源回収の成立を意味しない。
 * @boundary Process内の完了観測と上位結果検証の境界。
 * @security rawCompletionを公開結果やログへ直接搬送しない。
 * @compatibility 利用側はstatusで分岐し、未検証値を正式なTask結果として扱わない。
 */
export type TaskCompletionObservation =
  | Readonly<{
      status: "observed";
      rawCompletion: unknown;
      cancellationTransferred: boolean;
    }>
  | Readonly<{ status: "unknown" }>;

/**
 * execution-portで使用するCoordinator Single Task Attempt 入力の値契約を定義する。
 *
 * @responsibility Coordinator Single Task Attempt 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskAttemptInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskAttemptInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskAttemptInputの宣言は外部境界を開かない。
 * @security N/A: CoordinatorTaskAttemptInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorTaskAttemptInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskAttemptInput = Readonly<{
  operationId: string;
  taskRequest: unknown;
  repositoryRoot: unknown;
  cancellationSignal: AbortSignal;
  observeStarted?: () => Promise<boolean>;
  workspaceTarget?: BorrowedExecutionTarget;
}>;

/**
 * execution-portで使用するCoordinator Single Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Coordinator Single Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
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
 * execution-portで使用するCoordinator Single Task 結果の値契約を定義する。
 *
 * @responsibility Coordinator Single Task 結果のProperty、Identity、状態制約を型境界として所有する。
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
  workspaceResult?: CoordinatorWorkspaceResult;
}>;

/**
 * 借用Treeの開始後変更について観測できた範囲を返す。
 * @responsibility 欠測と変更なし、採用と観測を混同しない。
 * @trace ARCH-000004
 * @shape Workspace ID、変更Path又はnull、所属Tree変更、帰属未確定、削除非発行。
 * @invariant 内容・Host Path・新しいAuthorityを含めない。
 * @boundary Task完了から上位Attempt。
 * @security 相対Pathだけを認可済み利用側へ渡す。
 * @compatibility 非借用の旧結果では省略する。
 */
export type CoordinatorWorkspaceResult = Readonly<{
  workspaceId: string | null;
  changedPaths: readonly string[] | null;
  canonicalRepositoryChanged: boolean | null;
  changeAttribution: "unattributed";
  workspaceDeletionIssued: false;
}>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestModeの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestMode = "read_only_advice";

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestInputの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestInput = Readonly<{
  mode: CoordinatorAiRequestMode;
  profileId: string;
  prompt: string;
  contextReferences: readonly string[];
  allowedPaths: readonly string[];
  externalSendConfirmed: boolean;
  expectedNetworkPolicyHash: string;
}>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiResultItemの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestResultの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestResult = Readonly<{
  status: "completed" | "blocked" | "unknown";
  reason: string | null;
  facts: readonly CoordinatorAiResultItem[];
  sharedAnalysis: readonly CoordinatorAiResultItem[];
  additionalInferences: readonly CoordinatorAiResultItem[];
  nextOptions: readonly CoordinatorAiResultItem[];
  candidate: null;
}>;

/**
 * 単発AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestExecutorの構造を固定する。
 *
 * @responsibility 単発AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestExecutor = (
  request: CoordinatorAiRequestInput,
  cancellationSignal: AbortSignal,
) => Promise<CoordinatorAiRequestResult>;
