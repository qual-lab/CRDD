/**
 * 共通Lifecycleの実装契約と資源観測・回収の型を定義する。
 * @responsibility 技術契約だけを保持し、判断・保存・期限を所有しない。
 * @trace ARCH-000008
 */

import type {
  DockerResourceProjection,
  DockerContainerConfigurationExpectation,
  DockerRuntimeDirectoryInspectionInput,
  DockerRuntimeRepairDisposalInput,
  ResourceSnapshot,
} from "../../../docker-isolation/src/index.ts";
import type {
  CompletionResult as AttemptCompletionResult,
  AttemptCancelInput,
  AttemptExecutor,
  AttemptReference,
  AttemptRequest,
  StartResult as AttemptStartResult,
} from "../attempt/types.ts";
import type {
  AuthenticationCompletionResult,
  AuthenticationProjection,
  AuthenticationRequest,
  AuthenticationStartContext,
} from "../authentication/types.ts";
import type {
  IsolationProbeRequest,
  IsolationProbeResult,
} from "../probe/types.ts";
import type { ExecutorCallbacks } from "./callbacks.ts";

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
  attempt: DockerResourceProjection;
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
export interface LifecycleOperations {
  readonly signal: AbortSignal;
  readonly finished: boolean;
  readonly cancellationRequested: boolean;
  start(signal?: AbortSignal): boolean;
  cancel(): Promise<CancelResult>;
  bindCancellation(handler: () => Promise<boolean>): void;
  finish(): void;
}

/**
 * 実行・清掃条件・受動完了通知を共通の順序へ接続する。
 * @responsibility 用途固有の処置と結果解釈を共通Runnerへ渡す。
 * @trace ARCH-000008
 * @shape Context、Execute、Cleanup条件、Cleanup、結果構築、任意通知。
 * @invariant Cleanup条件の否定を回収成功へ変換しない。
 * @boundary 共通実行順序と固有技術条件。
 * @security 一次失敗と未観測を結果Ownerへ保持する。
 * @compatibility 既存結果と通知の同期性を維持する。
 */
export interface LifecycleOperation<TContext, TResult> {
  shouldCleanup?(context: TContext): boolean;
  onCompleted?(result: TResult): void | Promise<void>;
  execute(context: TContext): Promise<void>;
  cleanup(context: TContext): Promise<void>;
  createResult(context: TContext, failure: unknown, failed: boolean): TResult;
}

/** 元認証構成の単独回収。上位が現在Owner・終了確認と同じReceiptを提供する。 */
export type AuthenticationResourceTarget = AuthenticationStartContext &
  Readonly<{
    kind: "authentication";
    managementDirectory: string;
    request: AuthenticationRequest;
    resources: AuthenticationProjection["resources"] | null;
    callbacks?: ExecutorCallbacks<"authentication">;
  }>;

/**
 * 上位で選定済みの単一Containerと、作成時の同じ技術構成。
 * @responsibility 用途・保持・保存を知らず元構成と取消状態だけを借用する。
 * @trace ARCH-000008
 * @shape container種別、作成構成、借用管理領域と取消Signal。
 * @invariant IDだけで処置せず資源の照合を維持し、取消後の前進処置を止める。
 * @boundary 上位の対象選定と既存資源API。
 * @security 任意Path削除や構成検査の省略を公開しない。
 * @compatibility 保存Schema・用途種別・既存Attempt契約を変更しない。
 */
export type ContainerResourceTarget = Readonly<{
  kind: "container";
  configuration:
    | DockerContainerConfigurationExpectation
    | Pick<
        DockerContainerConfigurationExpectation,
        "id" | "name" | "ownershipLabel"
      >;
  managementDirectory: string;
  signal?: AbortSignal;
}>;

/**
 * 単一Containerの現在観測。不明を不存在へ畳まない。
 * @responsibility Running肯定と不存在を分離する。
 * @trace ARCH-000008
 * @shape present・absent・unknownとRunning肯定。
 * @invariant 観測だけで保存完了や回収許可を確定しない。
 * @boundary DIの現在観測から上位の判断へ返す。
 * @security 生inspect・秘密・実行許可を含めない。
 * @compatibility Runningの否定を不存在に読み替えない。
 */
export type ContainerResourceInspection = Readonly<{
  observation: "present" | "absent" | "unknown";
  runningConfirmed: boolean;
  snapshot: ResourceSnapshot | null;
}>;

/**
 * 固定Docker runtime Directoryの観測対象。
 * @responsibility DIの固定入力を外側の資源種別へ結合する。
 * @trace ARCH-000008
 * @shape 固定kindとDI正本の元input。
 * @invariant 任意Path・保持期限・廃棄判断を含めない。
 * @boundary 共通資源APIからDIの二読取り。
 * @security 観測から処置権限を生成しない。
 * @compatibility kindをDIの閉形式inputへ混入しない。
 */
export type DirectoryResourceInspectionTarget = Readonly<{
  kind: "docker_runtime_directory";
  input: DockerRuntimeDirectoryInspectionInput;
}>;

/**
 * 固定用途のDirectory処置対象。
 * @responsibility DIの固定処置入力だけを種別へ結合する。
 * @trace ARCH-000008
 * @shape 固定kindとScope・用途・現在Queryを持つ元input。
 * @invariant 許可と用途Intentは上位が確認し、Executorは保存しない。
 * @boundary 共通資源APIからDIの元Promise。
 * @security 任意Path削除・期限による自動処置へ拡張しない。
 * @compatibility 元inputとSignal・Queryの参照を保持する。
 */
export type DirectoryResourceCleanupTarget = Readonly<{
  kind: "docker_runtime_directory";
  input: DockerRuntimeRepairDisposalInput;
}>;
