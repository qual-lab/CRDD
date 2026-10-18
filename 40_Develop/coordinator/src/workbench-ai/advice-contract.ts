/**
 * 読取り助言の入力・結果を実行Ownerから分離する。
 *
 * @packageDocumentation
 * @responsibility 固定Contextを使う助言の値契約だけを所有し、受付・状態・取消を所有しない。
 * @trace ARCH-000015
 * @trace ARCH-000010
 * @boundary 単発Task OwnerとCoordinatorの読取り助言Executor。
 * @effect 型定義だけであり、外部Effectを発行しない。
 * @security Promptと結果を永続化またはlog出力せず、依頼種別とProfile IDを暗黙に読み替えない。
 */
/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestModeの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type CoordinatorAiRequestMode = "read_only_advice";

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestInputの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
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
}>;

/**
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiResultItemの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
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
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestResultの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
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
 * Workbench AI依頼の開始・観測・取消境界で使用するCoordinatorAiRequestExecutorの構造を固定する。
 *
 * @responsibility Workbench AI依頼の開始・観測・取消境界が受け渡す値、状態および制約を一つの型契約として保持する。
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
