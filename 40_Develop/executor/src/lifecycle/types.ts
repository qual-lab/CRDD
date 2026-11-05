/**
 * Executorの公開契約・用途別型対応と短命Controlを定義する。
 * @packageDocumentation
 * @responsibility 上位の判断・永続化とDIの技術実行を再実装しない。
 * @trace ARCH-000008
 */
import type {
  IsolationRequest,
  IsolationExecutionResult,
  ResourceSnapshot,
  prepareIsolation,
  executeIsolation,
} from "../../../docker-isolation/src/index.ts";
import type {
  ModelSelection as AiModelSelection,
  Provider as AiProvider,
  ExecutionResult as ProviderResultParseResult,
  TurnCountDiagnostic as ProviderTurnCountDiagnostic,
  ExecutionPlan,
  ExecutionResult,
} from "../../../ai-adapter/src/index.ts";
import type { ATTEMPT_COMPLETION_REASONS, PURPOSES } from "./attempt.ts";

/**
 * 単発実行の用途。Providerへ送るprobeと合成隔離Probeは混同しない。
 * @responsibility ExecutionKindの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape 三用途の文字列集合。
 * @invariant 用途の識別だけで実行許可を発行しない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type ExecutionKind = "attempt" | "authentication" | "isolation_probe";

/**
 * 構成要求も既存Ownerの型を再利用し、用途との相関だけを共通化する。
 * @responsibility ExecutorRequestの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape 用途Kに対応する既存要求型。
 * @invariant Provider内容と技術構成の正本を複製しない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type ExecutorRequest<K extends ExecutionKind = ExecutionKind> =
  ExecutorRequests[K];

interface ExecutorRequests {
  attempt: AttemptRequest;
  authentication: AuthenticationRequest;
  isolation_probe: IsolationProbeRequest;
}

/**
 * 記録投影を持つ用途を二種類へ限定する。
 * @responsibility ProjectionKindの対象を実在する投影Ownerへ限定する。
 * @trace ARCH-000008
 * @shape attempt又はauthenticationの文字列集合。
 * @invariant 投影を実行権限や保存確定と扱わない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type ProjectionKind = "attempt" | "authentication";

/**
 * 実在する記録投影を用途別に選択する公開契約。
 * @responsibility 元の投影型を再利用し、保存Schemaを変更しない。
 * @trace ARCH-000008
 * @shape Attempt又はAuthenticationの既存投影。
 * @invariant Probeの架空投影を定義しない。
 * @boundary Executor準備と上位の記録Owner。
 * @security 投影は実行や回収の権限ではない。
 * @compatibility 用途を二種類に限定し、無指定はそのUnionとする。
 */
export type RecordProjection<K extends ProjectionKind = ProjectionKind> =
  RecordProjections[K];

interface RecordProjections {
  attempt: AttemptRecordProjection;
  authentication: AuthenticationProjection;
}

/**
 * 入力は一つのObjectにまとめるが、用途に必要な現在Owner・元参照を省略しない。
 * @responsibility StartInputの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape 用途別の名前付き開始入力と通知。
 * @invariant Attemptの元管理参照と認証の現在Owner検査を維持する。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type StartInput<K extends ExecutionKind = ExecutionKind> =
  StartInputs[K];

interface StartInputs {
  attempt: Readonly<{
    managementCapability: unknown;
    reference: AttemptReference;
    callbacks?: ExecutorCallbacks<"attempt">;
  }>;
  authentication: AuthenticationStartContext &
    Readonly<{ callbacks?: ExecutorCallbacks<"authentication"> }>;
  isolation_probe: Readonly<{
    callbacks?: ExecutorCallbacks<"isolation_probe">;
  }>;
}

/**
 * 取消でも元Controlと現在管理参照を維持する。用途に不要な参照は要求しない。
 * @responsibility CancelArgumentsの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape Attemptだけ一つの入力引数、認証／固定Probeは引数なし。
 * @invariant 取消要求を技術終了の証明にしない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type CancelArguments<K extends ExecutionKind = ExecutionKind> =
  K extends "attempt" ? [input: AttemptCancelInput] : [];

/**
 * 取消要求の配送結果。技術終了と回収は元completionで別に確認する。
 * @responsibility CancelResultの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape 要求拒否又は要求配送と終了観測の判別Union。
 * @invariant 未観測のProcess終了をtrueへ補完しない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type CancelResult = Readonly<
  | { status: "blocked"; reason: "invalid" | "duplicate" }
  | {
      status: "requested";
      reason: "provider_cancellation_requested";
      cancellationRequested: true;
      processTerminationObserved: true;
    }
  | {
      status: "requested";
      reason: "provider_cancellation_grace_exceeded" | "cancellation_requested";
      cancellationRequested: true;
      processTerminationObserved: false;
    }
>;

/**
 * 共通名の終了結果。用途固有の事実は既存Ownerの型を再利用する。
 * @responsibility CompletionResultの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape kindで識別する用途別の型付き結果。
 * @invariant 回収不明・一次故障を成功へ丸めない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type CompletionResult<K extends ExecutionKind = ExecutionKind> =
  CompletionResults[K];

interface CompletionResults {
  attempt: AttemptCompletionResult;
  authentication: AuthenticationCompletionResult;
  isolation_probe: IsolationProbeResult;
}

/**
 * 開始済みをEffect成立と同一視しない。共通部以外は用途の既存結果を保つ。
 * @responsibility StartResultの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape 開始拒否又は同一実行completionを返す判別Union。
 * @invariant 開始受付はProcess開始や回収成立を意味しない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type StartResult<K extends ExecutionKind = ExecutionKind> =
  K extends "attempt"
    ? AttemptStartResult
    : Readonly<
        | {
            kind: K;
            status: "started";
            completion: Promise<CompletionResult<K>>;
          }
        | { kind: K; status: "blocked"; reason: string; completion: null }
      >;

/**
 * 全用途で同じ開始・取消の形を使い、用途と入出力の対応を型で保持する。
 * @responsibility ExecutorLifecycleの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape kind、start、cancelの共通制御Interface。
 * @invariant 用途別の通知同期性と元終了Promiseを維持する。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export interface ExecutorLifecycle<K extends ExecutionKind> {
  readonly kind: K;
  start(input: StartInput<K>): StartResult<K>;
  cancel(...args: CancelArguments<K>): Promise<CancelResult>;
}

/** 認証の記録投影は実在する用途だけに保持する。 */
interface AuthenticationExecution extends ExecutorLifecycle<"authentication"> {
  readonly recordProjection: AuthenticationProjection;
}

/**
 * 共通Executor。Attempt固有の明示解放だけを既存Ownerへ残す。
 * @responsibility Executorの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape 共通制御と用途に実在する投影・明示解放。
 * @invariant Attempt専用abandonを他用途へ架空実装しない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type Executor<K extends ExecutionKind = ExecutionKind> = Executors[K];

interface Executors {
  attempt: AttemptExecutor;
  authentication: AuthenticationExecution;
  isolation_probe: ExecutorLifecycle<"isolation_probe">;
}

/**
 * 単一実行の開始・取消・終端とSignalを共通Ownerへ保持する。
 * @responsibility 短命制御だけを定義し、Capability照合・資源処置・保存を所有しない。
 * @trace ARCH-000008
 * @shape 一回開始、Signal、取消一回配送、終端と元Process接続。
 * @invariant Contextは同一実行内だけ。新しい永続状態・Registryを作らない。
 * @boundary 各operationsと共通Lifecycle。
 * @security cleanup不能・一次失敗はcreateResultへ保持し成功へ補完しない。
 * @compatibility 各用途の結果型を再利用し共通Envelopeへ包まない。
 */
export interface LifecycleControl {
  readonly signal: AbortSignal;
  readonly finished: boolean;
  readonly cancellationRequested: boolean;
  start(signal?: AbortSignal): boolean;
  cancel(): Promise<CancelResult>;
  bind(
    session: import("../../../docker-isolation/src/index.ts").IsolationExecution,
  ): void;
  finish(): void;
}

/**
 * 結果固定後の任意通知。必須終端保存にはcompletionの結果を使う。
 * @responsibility 同じ確定結果を通知し、通知失敗で結果を変えない。
 * @trace ARCH-000008
 * @shape 結果と用途に実在する補足引数。
 * @invariant 通知のreturnは上位保存確定を意味しない。
 * @boundary 単発実行から受動利用側。
 * @security 生出力や新しい権限を追加しない。
 * @compatibility 同期例外と非同期Rejectを捕捉し、待機しない。
 */
export interface CompletionCallbacks<
  TResult,
  TObservation extends unknown[] = [],
> {
  onCompleted?(
    result: TResult,
    ...observation: TObservation
  ): void | Promise<void>;
}

/**
 * 通常実行と回収で観測した技術資源を通知する。
 * @responsibility 同期回収APIと通常実行の既存通知順序を維持する。
 * @trace ARCH-000008
 * @shape 実IDと二段階終了観測。
 * @invariant 回収APIの同期通知は保存完了後にreturnする。
 * @boundary 技術回収と上位保存Owner。
 * @security 通知だけで不存在・Home解放を証明しない。
 * @compatibility 通常実行の終了通知はPromise完了を待つ。
 */
/**
 * 通常実行と再入場の資源観測通知。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 同期voidの観測開始・実ID発見と、void／Promise<void>の資源終了・回収完了。
 * @invariant 必要な同期性は利用契約で固定し、通知発行だけを回収成功にしない。
 * @boundary DIの技術事実からExecutorと上位記録。
 * @security 保存方法・許可を返す操作ではなく、生出力も渡さない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export interface ResourceCleanupCallbacks<Observation> {
  onResourceIdentified?(
    key: string,
    resources: ResourcePreparation,
  ): void | Promise<void>;
  onResourcesClosed?(observation: Observation): void | Promise<void>;
  onCleanupCompleted?(observation: Observation): void | Promise<void>;
}

/**
 * 各用途が所有する通知interfaceの対応。
 * @responsibility 同じ公開名から用途の通知契約を選ぶ。
 * @trace ARCH-000008
 * @shape 用途Kと既存引数・同期性を持つinterface。
 * @invariant 非該当Propertyをneverで削る方式を使わない。
 * @boundary 公開型と各用途の通知Owner。
 * @security 必須保存通知を受動通知へ変えない。
 * @compatibility 公開型引数と既存通知名を維持する。
 */
export type ExecutorCallbacks<K extends ExecutionKind = ExecutionKind> =
  Callbacks[K];

interface Callbacks {
  attempt: AttemptCallbacks;
  authentication: AuthenticationCallbacks;
  isolation_probe: IsolationProbeCallbacks;
}

type TaskResult = NonNullable<
  ProviderResultParseResult<"task">["normalizedResult"]
>;

type AdviceResult = NonNullable<
  ProviderResultParseResult<"advice">["normalizedResult"]
>;

type TaskReviewFinding = NonNullable<
  ProviderResultParseResult<"task">["reviewFindings"]
>[number];

/**
 * 通常Attemptの必須通知と受動完了通知を定義する。
 * @responsibility 用途に実在する通知引数と完了条件だけを所有する。
 * @trace ARCH-000008
 * @shape 共通完了通知と用途固有のイベントハンドラー。
 * @invariant 必須通知の失敗後は後続Effectを停止する。
 * @boundary 技術実行と上位の記録・観測。
 * @security Credential・生出力を通知へ追加しない。
 * @compatibility 必須通知の既存同期性と任意完了通知の非待機を維持する。
 */
/** 同じDI準備から保存へ渡す非秘密断面。実IDの正本はSnapshotだけに置く。 */
export type ResourcePreparation = Readonly<{
  snapshot: ResourceSnapshot;
  cleanup: Pick<
    IsolationRequest,
    | "cleanupOrder"
    | "setupTimeoutMs"
    | "unreceiptedAbsence"
    | "verifyLabelAbsence"
  >;
}>;

export interface AttemptCallbacks
  extends ResourceCleanupCallbacks<AttemptTerminalObservation>,
    CompletionCallbacks<AttemptCompletionResult, [AttemptTerminalObservation]> {
  onCommandSubmitting?(
    purpose: AttemptCommandPurpose,
    resources: ResourcePreparation,
  ): void | Promise<void>;
  onCommandNotIssued?(
    purpose: AttemptCommandPurpose,
    resources: ResourcePreparation,
  ): void | Promise<void>;
  onProviderSubmitting?(): void | Promise<void>;
  onResourceCreated?(
    purpose: AttemptCommandPurpose,
    dockerId: string,
    resources: ResourcePreparation,
  ): void | Promise<void>;
  onStarted?(notice: ProcessStartedNotice): void | Promise<void>;
  onDiagnostic?(notice: AttemptDiagnosticNotice): void | Promise<void>;
}

/**
 * docker-process-controllerで使用するExecution 記録の値契約を定義する。
 *
 * @responsibility Execution 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ExecutionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionRecordの宣言は外部境界を開かない。
 * @security ExecutionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionRecord = {
  homeLease: HomeLease;
  homeLeaseReleased: boolean;
  homeLeaseReleaseAttempted: boolean;
  lifecycle: LifecycleControl;
  controlCapability: object;
  recovery: AttemptReference;
  managementCapability: object;
};

/**
 * docker-process-controllerで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RuntimeState = Readonly<{
  acquireHomeLease(bindingHash: string): HomeLease | null;
  prepareIsolation: typeof prepareIsolation;
  executeIsolation: typeof executeIsolation;
  callbacks: AttemptCallbacks;
  controls: WeakMap<object, ExecutionRecord>;
}>;

/**
 * 上位の保存Ownerが確定した参照を単発実行へ借用する内部契約。
 * @responsibility 記録の作成・回復許可を所有せず、結果と技術資源へ同じ参照を搬送する。
 * @trace ARCH-000008
 */
export type AttemptReference = Readonly<{
  recoveryId: string;
  recoveryCapability: object;
}>;

/**
 * 上位が照合した単発実行の対象・選定・内容をまとめる。
 * @responsibility 技術Path・Home同一性と用途別本文を受け、GrantやTaskを管理しない。
 * @trace ARCH-000015
 */
export type AttemptRequest = Readonly<{
  kind: "attempt";
  selection: AiModelSelection;
  target: Readonly<{
    operationId: string;
    grantRef: string;
    provider: string;
    workspaceSourcePath: string;
    temporarySourcePath: string;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
    providerHomeSourcePath: string;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    activeMountCapability: object;
  }>;
}> &
  (
    | Readonly<{ purpose: "probe" }>
    | Readonly<{
        purpose: "task";
        input: string;
        taskRole: "executor" | "reviewer";
        taskWorkload?: unknown;
        additionalHosts: readonly string[];
      }>
    | Readonly<{
        purpose: "advice";
        input: string;
        additionalHosts: readonly string[] | null;
        allowedReferences: readonly string[];
      }>
  );

/**
 * Factory内部だけが保持する一試行の技術構成。
 * @responsibility AI Adapterの実行指定と固定済みIsolationRequestを結合し、上位へ往復させない。
 * @trace ARCH-000008
 * @invariant 業務Authorityと記録保存は上位が所有する。
 */
export type AttemptPlan = AttemptRecordProjection &
  Readonly<{
    additionalHosts: readonly string[] | null;
    provider: AiProvider;
    operationId: string;
    grantRef: string;
    executionSelection: AiModelSelection;
    activeMountCapability: object;
    providerHomeSourcePath: string;
    providerHomeIdentityHash: string;
    providerHomeProtectionHash: string;
    localUserBindingHash: string;
    stableLogicalHomeBindingHash: string;
    taskRole: "executor" | "reviewer" | null;
    taskWorkload?: unknown;
    adviceAllowedReferences?: readonly string[] | null;
    providerInput: string | null;
    workspaceSourcePath: string | null;
    workspaceProtection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
    isolationRequest: IsolationRequest;
    providerPlan: ExecutionPlan;
  }>;

/**
 * 一試行の非秘密診断を表す。
 * @responsibility 構成・技術終了観測を相関した閉じた通知へ限定する。
 * @trace ARCH-000008
 * @shape eventを判別子とするProvider・操作・試行と固定診断値。
 * @invariant 一次故障と清掃・終了観測を別fieldで保持する。
 * @boundary Executorから上位の診断Consumer。
 * @security 生出力・Command本文・認証値を含めない。
 * @compatibility 元の通知名・相関field・三値の意味を維持する。
 */
export type AttemptDiagnosticNotice =
  | Readonly<{
      event: "coordinator_provider_boundary_configured";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      approvalModeConfigured:
        | "approve_for_me"
        | "never"
        | "not_applicable"
        | "other";
      sandboxModeConfigured:
        | "read_only"
        | "implicit"
        | "not_applicable"
        | "other";
      workspaceMountModeConfigured: "read_write" | "read_only" | null;
      rootFilesystemReadOnlyConfigured: boolean;
      nonRootUserConfigured: boolean;
      workdirConfigured: boolean;
    }>
  | Readonly<{
      event: "coordinator_provider_boundary_settled";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      recoveryId: string;
      providerContainerCreatedObserved: boolean;
      providerProcessStartedObserved: boolean;
      providerProcessCompletionObserved: boolean;
      providerProcessExitStatusClass:
        | "zero"
        | "one"
        | "one_two_six"
        | "one_two_seven"
        | "other_nonzero"
        | "signal"
        | "not_observed";
      processTreeTerminationObserved: boolean;
      containersAbsentObserved: boolean;
      networksAbsentObserved: boolean;
      cleanupConfirmed: boolean;
      primaryFailure: PrimaryFailureDiagnostic | null;
    }>;

/**
 * docker-process-controllerで使用するProvider Process Started Noticeの値契約を定義する。
 *
 * @responsibility Provider Process Started NoticeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ProcessStartedNoticeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProcessStartedNoticeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProcessStartedNoticeの宣言は外部境界を開かない。
 * @security ProcessStartedNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProcessStartedNoticeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProcessStartedNotice = Readonly<{
  event: "coordinator_provider_process_started";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
}>;

/**
 * 用途別内容を同じ試行結果へ載せる。
 * @responsibility Task・Advice・Probeの検査済み内容を型付きで返す。
 * @trace ARCH-000015
 * @shape 用途ごとの既存結果形のunion。
 * @invariant 内容と技術終了・回収状態を同一視しない。
 * @boundary Executorのcompletion結果。
 * @security 生Envelope・所見本文を追加しない。
 * @compatibility 内容fieldを用途間で無理に共通化しない。
 */
export type AttemptContent =
  | TaskResult
  | AdviceResult
  | NonNullable<ProviderResultParseResult<"probe">["normalizedResult"]>;

/**
 * 開始成功・拒否ごとに必要な組立て入力を表す。
 * @responsibility 元Control・Promise又は拒否と回復義務を受け、準備内部状態を受け取らない。
 * @trace ARCH-000008
 * @invariant 選択情報は準備Ownerが確定済みの三値だけを受け取る。
 */
export type StartResultInput = Readonly<
  {
    selection?: Readonly<{
      notice: string | null;
      model: string | null;
      effort: string | null;
    }>;
  } & (
    | {
        status: "started";
        controlCapability: object;
        completion: Promise<AttemptCompletionResult>;
        operationId: string;
        recoveryId: string;
        preparationFailed?: false;
      }
    | {
        status: "blocked";
        reason: string;
        cleanupConfirmed?: boolean;
        recoveryId?: string | null;
        manualRecoveryRequired?: boolean;
        preparationFailed?: boolean;
      }
  )
>;

/**
 * 一試行の終端状態と技術観測を受け取る組立て入力。
 * @responsibility 清掃・結果内容・診断を名前で識別できる形で受け取る。
 * @trace ARCH-000008
 * @invariant 各観測の成立は実行Ownerが確認し、Factoryは既存の公開相関を適用する。
 */
export type CompletionResultInput = Readonly<{
  resourceSnapshot?: ResourceSnapshot | null;
  status: "completed" | "blocked" | "cancelled";
  reason: AttemptResultReason;
  operationId: string;
  recoveryId: string;
  providerRequestStarted: boolean;
  cancellationRequested: boolean;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  homeLeaseReleased: boolean;
  resultSha256: string | null;
  resultBytes: number;
  normalizedResult: AttemptContent | null;
  reviewFindings?: readonly TaskReviewFinding[] | null;
  providerExecutionObservation?: AttemptCompletionResult["providerExecutionObservation"];
  providerTurnObservation?: AttemptCompletionResult["providerTurnObservation"];
  subscriptionAuthConfirmed: boolean;
}>;

/**
 * Attemptの取消に必要な元Controlと現在の管理参照。
 * @responsibility 共通取消へ進む前の照合入力を定義する。
 * @trace ARCH-000008
 * @shape controlCapabilityとmanagementCapabilityの二参照。
 * @invariant 空入力や別Ownerで正規取消を消費しない。
 * @boundary 利用側と元Control表の照合。
 * @security 対象識別だけで新しい取消権限を発行しない。
 * @compatibility 既存の二参照の照合条件を維持する。
 */
export type AttemptCancelInput = Readonly<{
  controlCapability: unknown;
  managementCapability: unknown;
}>;

/**
 * Attempt固有の記録投影と終了後Home解放を共通制御へ加える。
 * @responsibility 同じ実行への開始・取消・明示解放だけを提供する。
 * @trace ARCH-000008
 * @shape 共通制御と投影、abandon。
 * @invariant 型抽出を正本にせず、実行状態を再定義しない。
 * @boundary 利用側とAttempt固有の技術実行。
 * @security 元Control・management・Home解放条件を維持する。
 * @compatibility 用途固有の必要な操作だけを追加する。
 */
export interface AttemptExecutor extends ExecutorLifecycle<"attempt"> {
  readonly recordProjection: AttemptRecordProjection;
  abandon(
    input: Readonly<{
      recoveryCapability: unknown;
      managementCapability: unknown;
    }>,
  ): boolean;
}

/**
 * 一試行の開始結果。開始済みと拒否で必要な項目を区別する。
 * @responsibility 利用側がstatusで制御・完了Promiseと回復義務を判断できる契約を定義する。
 * @trace ARCH-000008
 * @invariant 受付・開始とProvider開始・最終結果を混同しない。
 */
export type AttemptStartResult = Readonly<
  {
    kind: "attempt";
    providerRequestStarted: false;
    normalizedResult: null;
    rawOutputReported: false;
    untrustedProviderTextReported: false;
    credentialAbsenceVerified: false;
    hostPathReported: false;
    proxyCredentialReported: false;
  } & (
    | {
        selectionNotice: string | null;
        selectedModel: string | null;
        selectedEffort: string | null;
      }
    | { selectionNotice?: never; selectedModel?: never; selectedEffort?: never }
  ) &
    (
      | {
          status: "started";
          reason: "docker_process_controller_started";
          controlCapability: object;
          completion: Promise<AttemptCompletionResult>;
          operationId: string;
          recoveryId: string;
          dockerEffectStarted: true;
          normalizedResultReportedAfterCleanupOnly: true;
          preparationFailed?: false;
        }
      | {
          status: "blocked";
          reason: string;
          controlCapability: null;
          completion: null;
          operationId: null;
          recoveryId: string | null;
          cleanupConfirmed: boolean;
          manualRecoveryRequired: boolean;
          dockerEffectStarted: false;
          preparationFailed?: boolean;
        }
    )
>;

/**
 * 清掃を含む一試行の明示的な最終結果契約。
 * @responsibility 内容・診断・清掃・回復の観測を区別して利用側へ返す。
 * @trace ARCH-000008
 * @invariant Factoryがこの型を満たし、資源観測の相関条件は既存の組立てで維持する。
 */
export type AttemptCompletionResult = Readonly<{
  resourceSnapshot: ResourceSnapshot | null;
  kind: "attempt";
  status: "completed" | "blocked" | "cancelled";
  reason: AttemptResultReason | "docker_process_controller_cleanup_unconfirmed";
  operationId: string;
  recoveryId: string | null;
  manualRecoveryRequired: boolean;
  dockerEffectStarted: true;
  providerRequestStarted: boolean;
  cancellationRequested: boolean;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  homeLeaseReleased: boolean;
  cleanupConfirmed: boolean;
  resultSha256: string | null;
  resultBytes: number;
  normalizedResult: AttemptContent | null;
  providerExecutionObservation: NonNullable<
    ProviderResultParseResult<"task">["providerExecutionObservation"]
  > | null;
  providerTurnObservation: Readonly<Record<string, unknown>> | null;
  reviewFindings: readonly TaskReviewFinding[] | null;
  subscriptionAuthConfirmed: boolean;
  rawOutputReported: false;
  untrustedProviderTextReported: false;
  credentialAbsenceVerified: false;
  hostPathReported: boolean;
  proxyCredentialReported: false;
}>;

/**
 * 固定コールバックへ直接渡す非秘密の終端観測。
 * @responsibility 実行結果と清掃・回復の観測を元操作へ結合する。
 * @trace ARCH-000008
 * @shape 操作ID、回復参照、資源観測と解放状態。
 * @invariant object原本照会や新しいAuthorityを必要としない。
 * @boundary Executorと信頼したHostの内部callback。
 * @security 外部DTOの受付形式として公開しない。
 * @compatibility 既存終端観測と同じ事実だけを搬送する。
 */
export type AttemptTerminalObservation = Readonly<{
  resourceSnapshot: ResourceSnapshot | null;
  operationId: string;
  recoveryId: string;
  resources: IsolationExecutionResult["cleanup"]["observations"] | null;
  processTreeTerminationConfirmed: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  primaryFailure: PrimaryFailureDiagnostic | null;
  homeLeaseReleased: boolean;
}>;

/**
 * Docker Process Controllerの最終理由を表す。
 *
 * @responsibility 公開失敗理由と完了・取消理由の閉じた型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定公開理由へ完了と取消の二状態を加えた文字列unionである。
 * @invariant 未知理由またはProvider生出力を含まない。
 * @boundary Docker Process Controller内部結果から最終公開結果への境界。
 * @security 固定理由だけを公開する。
 * @compatibility 利用側は宣言済みの最終理由だけへ依存する。
 */
export type AttemptResultReason =
  | AttemptFailureReason
  | "provider_operation_completed"
  | "provider_operation_cancelled";

/**
 * 最初の失敗を後続の清掃結果と分けて説明する。
 *
 * @responsibility 固定段階と理由、要求・応答・記録の異なる観測を保持する。
 * @trace ARCH-000008
 * @shape 固定用途、段階、理由、例外分類と三つの観測値。
 * @invariant Handle取得をDocker受理、応答を記録成功と同一視しない。
 * @boundary Controllerから受動診断の利用側への搬送。
 * @security 自由文、Path、argv、Provider出力や秘密値を含めない。
 * @compatibility 診断は実行・清掃・Recoveryの判定を変更しない。
 */
export type PrimaryFailureDiagnostic = Readonly<{
  /** DIの元停止点。既存の上位理由を置換せず、非秘密の技術診断を保持する。 */
  isolationFailure?: IsolationExecutionResult["failure"];
  purpose: string | null;
  stage:
    | "submission_record"
    | "command_restriction"
    | "command_start"
    | "provider_start_observation"
    | "command_wait"
    | "execution_classification"
    | "resource_receipt_record"
    | "subscription_auth_verification"
    | "provider_result_normalization";
  reason: AttemptResultReason;
  exceptionCode: string | null;
  commandHandleObtained: boolean;
  responseObserved: boolean;
  receiptRecorded: boolean;
  /** 診断専用。confirmedでも非0終了を実行許可へ変換しない。 */
  authenticationStatus?: "confirmed" | "unconfirmed" | "unknown";
  /** Claude助言のTurn拒否だけに付く非秘密metadata。 */
  turnCountDiagnostic?: ProviderTurnCountDiagnostic;
  commandObservation: Readonly<{
    exitCode: number | null;
    stdoutBytes: number;
    stderrBytes: number;
  }> | null;
}>;

/**
 * Docker Process Controllerが公開できる完了理由を表す。
 *
 * @responsibility 清掃後に上位へ公開できる固定理由の型境界を所有する。
 * @trace ARCH-000008
 * @shape 固定Registry要素だけからなる文字列unionである。
 * @invariant Provider生出力や未登録理由を含まない。
 * @boundary Docker Process Controller結果から上位Coordinator結果への投影境界。
 * @security 固定語彙だけを許可し、秘密値や自由文を搬送しない。
 * @compatibility 利用側は公開Registryに含まれる理由だけへ依存する。
 */
export type AttemptFailureReason = (typeof ATTEMPT_COMPLETION_REASONS)[number];

/**
 * 上位が選定した一つの技術資源集合の回収対象。
 * @responsibility 保存Schemaを持たず、既存技術投影と取消Signalだけを借用する。
 * @trace ARCH-000008
 * @shape resource_set種別、元ID、技術投影、Receipt、config領域と取消Signal。
 * @invariant IDだけで処置を許可せず、明示取消後は新しい処置を開始しない。
 * @boundary 上位で選定済みの対象とExecutor資源API。
 * @security 生の削除Path・権限発行・保存操作を公開しない。
 * @compatibility kindはAPI内の分岐だけで、保存Schemaへ加えない。
 */
/**
 * 元実行から保存へ搬送する非秘密の技術構成。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 五資源名・所有Label・固定Image・実行／Mount方式。
 * @invariant Task状態・保存場所・過去Effectの成否を定義しない。
 * @boundary Executorの元構成、上位保存と再入場。
 * @security この投影は処置権限でなく、実資源との照合が別に必要。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export type AttemptRecordProjection = Readonly<{
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  workspaceMountMode: "read_write" | "read_only" | null;
}>;

/**
 * 本番隔離Runtimeへ渡す確定済み所在だけを表す。
 * @responsibility 既存依存契約の必要断面を再利用する。
 * @trace ARCH-000008
 * @invariant Process primitiveやCLI構成を上位へ公開しない。
 */
export type DockerIsolationRuntimeOptions = Readonly<{
  paths: Readonly<{ tmp: string; management: string }>;
}>;

/**
 * 同じAttemptのHome技術排他を一回解放するHandle。
 * @responsibility 取得済み排他の同期解放結果だけを搬送する。
 * @trace ARCH-000008
 * @invariant 上位のTask状態や保存方式を所有しない。
 */
export type HomeLease = Readonly<{
  assertLive: () => boolean;
  release: () => boolean;
}>;

/**
 * Container内起動payloadと隔離資源の構築入力。
 *
 * @responsibility Dockerの技術構成だけを保持し、Task・許可・モデルの意味を所有しない。
 * @trace ARCH-000004
 * @shape 三Container、二Network、固定Image、Mount、起動payload、Proxy接続構成。
 * @invariant Docker argv全体や任意Host環境は入力にしない。
 * @boundary 上位の検証済み起動記述から隔離計画への境界。
 * @security 認証値はContainer環境へ搬送するだけで診断へ公開しない。
 * @compatibility 既存九purposeと固定Docker flagの順序を維持する。
 */
export type DockerIsolationCommandInput = Readonly<{
  authenticationContainerName: string;
  executionContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  executionImageDigest: string;
  proxyImageDigest: string;
  homeSourcePath: string;
  temporarySourcePath: string;
  workspace: Readonly<{
    sourcePath: string;
    readOnly: boolean;
    protection?: Readonly<{
      gitSourcePath: string;
      internalSourcePath: string;
    }>;
  }> | null;
  authentication: Readonly<{
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
  }>;
  execution: Readonly<{
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
    interactive: boolean;
    initRequired: boolean;
    seccompProfile: Readonly<{ sha256: string; bytes: number }> | null;
  }>;
  proxy: Readonly<{
    profile: string;
    token: string;
    port: number;
    extendedProxyEnvironment: boolean;
    additionalHosts?: readonly string[] | null;
  }>;
}>;

/**
 * 元技術構成から得た回収順と構成候補。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape 五つの作成purposeと同用途の技術期待値列。
 * @invariant 元実IDはReceiptから結合し、期待値だけで資源存在や処置許可を示さない。
 * @boundary 通常Session／再入場とDI共通回収。
 * @security 任意コマンド・保存API・上位Ownerを搬送しない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
/** 単一Attemptが発行する固定技術操作の識別子。 */
export type AttemptCommandPurpose = (typeof PURPOSES)[number];

/**
 * 認証の技術構成入力。
 * @responsibility 選択済みHomeと固定用途をExecutorへ渡す。
 * @trace ARCH-000010
 * @shape Provider、status/login、Home、安定suffixとlogin時の短命Proxy token。
 * @invariant Repository・Workspace・任意CLIを受け取らない。
 * @boundary 上位の許可・選定と固定認証構成。
 * @security Providerの認証値を読み取らず、Proxy tokenを通知しない。
 * @compatibility 固定Imageと既存認証条件を維持する。
 */
/**
 * 認証の同期必須通知と受動完了通知を定義する。
 * @responsibility 用途に実在する通知引数と完了条件だけを所有する。
 * @trace ARCH-000008
 * @shape 共通完了通知と用途固有のイベントハンドラー。
 * @invariant 必須通知の失敗後は後続Effectを停止する。
 * @boundary 技術実行と上位の記録・観測。
 * @security Credential・生出力を通知へ追加しない。
 * @compatibility 必須通知の既存同期性と任意完了通知の非待機を維持する。
 */
export interface AuthenticationCallbacks
  extends CompletionCallbacks<AuthenticationCompletionResult>,
    DockerAuthenticationCleanupCallbacks {
  onResourceIdentified?(key: string, resources: ResourcePreparation): void;
  onCommandNotIssued?(
    purpose: string,
    resources: ResourcePreparation,
    key: string,
  ): void;
  onResourceCreated?(
    receipt: Readonly<{ key: string; name: string; dockerId: string }>,
    resources: ResourcePreparation,
  ): void;
}

/** 選定済みの認証構成。kindで他用途から区別する。 */
export type AuthenticationRequest = Readonly<{
  kind: "authentication";
  provider: AiProvider;
  action: "status" | "login";
  providerHomeSourcePath: string;
  suffix: string;
  proxyToken: string | null;
}>;

/** 上位が排他を保持し、start前に実体を用意する借用管理領域。 */
export type AuthenticationOptions = Readonly<{ managementDirectory: string }>;

/**
 * 上位記録に必要な認証資源の投影。
 * @responsibility 固定資源名と所有相関だけを公開する。
 * @trace ARCH-000010
 * @shape Provider、操作、所有Label、順序付き資源名・種類。
 * @invariant Command・Proxy token・保存先を返さない。
 * @boundary Executor準備と上位Recovery記録。
 * @security 投影値自体は処置権限ではない。
 * @compatibility 既存の資源順序と記録Schemaを維持する。
 */
export type AuthenticationProjection = Readonly<{
  provider: AiProvider;
  action: "status" | "login";
  ownershipLabel: string;
}>;

/**
 * 認証実行の非秘密な技術結果。
 * @responsibility 認証三値、一次理由、発行観測とProcess終了を分離する。
 * @trace ARCH-000010
 * @shape reason、authenticationStatus、確認フラグと技術終了。
 * @invariant 正規未ログインを成功扱いするのはstatusだけ。
 * @boundary AI Adapterの結果解析と上位の進行判断。
 * @security stdout・stderr・認証値を返さない。
 * @compatibility 既存理由とunknownを維持し自動再試行しない。
 */
export type AuthenticationResult = Readonly<{
  reason: string;
  authenticationStatus: ExecutionResult<"authentication">["status"];
  authenticationConfirmed: boolean;
  providerEffectIssued: boolean;
  processCompletionConfirmed: boolean;
}>;

/** 認証の明示取消。必要な保存は上位が通知先で完了する。 */
export type AuthenticationStartContext = Readonly<{
  signal?: AbortSignal;
}>;

/** 認証の観測事実と、同じ実行の清掃結果。上位保存の完了とは区別する。 */
export type AuthenticationCompletionResult = AuthenticationResult &
  Readonly<{
    kind: "authentication";
    status: "completed" | "blocked" | "cancelled";
    cleanupConfirmed: boolean;
    resourceSnapshot: ResourceSnapshot | null;
    resourceObservations: IsolationExecutionResult["cleanup"]["observations"];
  }>;

/**
 * 認証資源回収と同じ技術Processの終了観測。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape confirmedとprocessCompletionConfirmedを分離した結果。
 * @invariant 終了不明を不存在や成功へ補完しない。
 * @boundary DI技術回収からExecutorの結果集約。
 * @security 保存・Home解放・Task完了の成立を含めない。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
export interface DockerAuthenticationCleanupCallbacks {
  onCommandSubmitting?(
    purpose: string,
    resources: ResourcePreparation,
    key: string,
  ): void;
  onCommandCompleted?(): void;
}

/**
 * 認証で作成した資源の順序・名前と受領済み実ID。
 * @responsibility 元技術資源の値と観測条件を所有し、上位の保存・採用判断を持たない。
 * @trace ARCH-000008
 * @shape container／network、固定名、64桁実ID又はnullの不変列。
 * @invariant 元計画と順序・種類・名前を照合し、ID欠測を削除許可にしない。
 * @boundary 認証実行と同じDI通常／単独回収。
 * @security accessor・Proxy・別資源のID混入を拒否する。
 * @compatibility 既存の資源値・通知同期性・保存Schemaを維持する。
 */
/** 固定合成診断の選択。製品Requestに任意payloadを追加しない。 */
export type IsolationProbeProfile =
  | "normal"
  | "timeout"
  | "output_limit"
  | "invalid_output"
  | "nonzero_exit"
  | "cancellation";

/** 生出力を含まない固定合成診断の評価。技術回収・Host清掃と分離する。 */
export type IsolationProbeFacts = Readonly<{
  isolation: Readonly<{ status: "confirmed" | "blocked"; reason: string }>;
  lifecycleStatus: "candidate" | "blocked";
  lifecycleReason: string;
  elapsedMs: number | null;
  stdoutBytes: number;
  stderrBytes: number;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
}>;

/**
 * 固定合成Probeの相関。Provider・Model・任意Scriptを指定しない。
 * @responsibility 合成診断とProviderへ送信するProbeの要求を分離する。
 * @trace ARCH-000008
 * @shape 固定kindとUUID v4のProbe ID。
 * @invariant IDは対象識別であり実行許可ではない。
 * @boundary 上位の診断選択とExecutor。
 * @security 任意Script・Image・Credentialを受け取らない。
 * @compatibility 通常AttemptRequestの形式は変えない。
 */
/**
 * 固定Probeの同期必須通知と受動完了通知を定義する。
 * @responsibility 用途に実在する通知引数と完了条件だけを所有する。
 * @trace ARCH-000008
 * @shape 共通完了通知と用途固有のイベントハンドラー。
 * @invariant 必須通知の失敗後は後続Effectを停止する。
 * @boundary 技術実行と上位の記録・観測。
 * @security Credential・生出力を通知へ追加しない。
 * @compatibility 必須通知の既存同期性と任意完了通知の非待機を維持する。
 */
export interface IsolationProbeCallbacks
  extends CompletionCallbacks<IsolationProbeResult> {
  onCommandSubmitting?(purpose: string): void;
  onResourceCreated?(dockerId: string): void;
}

/** 固定Probe要求。任意ScriptやProvider指定を受け取らない。 */
export type IsolationProbeRequest = Readonly<{
  kind: "isolation_probe";
  probeId: string;
}>;

/**
 * 上位が利用許可を確認した、同じ操作の固定所在。
 * @responsibility 通知と不変の構成値を分ける。
 * @trace ARCH-000008
 * @shape managementと三Mountの固定所在。
 * @invariant 後発変更を新しい許可として採用しない。
 * @boundary Host所有確認と技術操作。
 * @security 保存Writer・Root権限・認証値を含めない。
 * @compatibility 既存Hostの四所在と実体確認を利用する。
 */
export type IsolationProbeMounts = Readonly<{
  management: string;
  workspace: string;
  providerHome: string;
  tmp: string;
}>;

/** 上位が利用許可を確認した固定四所在。 */
export type IsolationProbeOptions = Readonly<{
  mounts: IsolationProbeMounts;
}>;

/**
 * 技術観測と回収の結果。Host清掃・最終判断を含まない。
 * @responsibility 作成要求・実ID・技術事実・close・回収を分けて搬送する。
 * @trace ARCH-000008
 * @shape 固定理由、要求事実、nullable実ID／DI事実と独立した終了観測。
 * @invariant cleanupConfirmedからHost清掃やTask成功を推測しない。
 * @boundary 技術結果と上位の保存・最終判断。
 * @security Provider本文や例外本文は公開しない。
 * @compatibility DIの既存事実型を再利用し、上位保存Schemaは変えない。
 */
export type IsolationProbeResult = Readonly<{
  kind: "isolation_probe";
  status: "completed" | "blocked" | "cancelled";
  reason: string | null;
  creationAttempted: boolean;
  containerId: string | null;
  facts: IsolationProbeFacts | null;
  resourceSnapshot: ResourceSnapshot | null;
  cleanupConfirmed: boolean;
  processCompletionConfirmed: boolean;
  cancelled: boolean;
}>;
