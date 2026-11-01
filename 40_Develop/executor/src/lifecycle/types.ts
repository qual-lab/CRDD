/**
 * 共通Lifecycleの実装契約と資源観測・回収の型を定義する。
 * @responsibility 技術契約だけを保持し、判断・保存・期限を所有しない。
 * @trace ARCH-000008
 */

import type {
  DockerContainerConfigurationExpectation,
  DockerResourceCleanupObservation,
  DockerResourceReceipts,
  DockerRuntimeDirectoryInspectionInput,
  DockerRuntimeRepairDisposalInput,
} from "../../../docker-isolation/src/index.ts";
import type {
  CompletionResult as AttemptCompletionResult,
  AttemptExecutor,
  AttemptRecordProjection,
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
export type ExecutorRequest<K extends ExecutionKind = "attempt"> =
  ExecutorRequests[K];
interface ExecutorRequests {
  attempt: AttemptRequest;
  authentication: AuthenticationRequest;
  isolation_probe: IsolationProbeRequest;
}

/**
 * 実在する記録投影だけを公開する。固定Probeには架空の投影を作らない。
 * @responsibility RecordProjectionの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape 用途別投影。固定Probeはnever。
 * @invariant 投影を実行権限や保存確定と扱わない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type RecordProjection<K extends ExecutionKind = "attempt"> =
  RecordProjections[K];
interface RecordProjections {
  attempt: AttemptRecordProjection;
  authentication: AuthenticationProjection;
  isolation_probe: never;
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
export type StartInput<K extends ExecutionKind = "attempt"> = StartInputs[K];
interface StartInputs {
  attempt: Readonly<{
    managementCapability: unknown;
    reference: AttemptReference;
    callbacks?: ExecutorCallbacks;
  }>;
  authentication: AuthenticationStartContext &
    Readonly<{ callbacks?: ExecutorCallbacks<"authentication"> }>;
  isolation_probe: Readonly<{
    callbacks?: ExecutorCallbacks<"isolation_probe">;
  }>;
}

/**
 * 取消でも元Controlと現在管理参照を維持する。用途に不要な参照は要求しない。
 * @responsibility CancelInputの用途相関を既存所有型へ接続する。
 * @trace ARCH-000008
 * @shape Attemptは二参照、認証と固定Probeは空Object。
 * @invariant 取消要求を技術終了の証明にしない。
 * @boundary 上位利用側と単発技術実行。
 * @security 許可・対象の実体検査を型定義で代替しない。
 * @compatibility 旧用途別公開名から共通名へ移行し、保存Schemaは変更しない。
 */
export type CancelInput<K extends ExecutionKind = "attempt"> = CancelInputs[K];
interface CancelInputs {
  attempt: Readonly<{
    controlCapability: unknown;
    managementCapability: unknown;
  }>;
  authentication: Readonly<Record<string, never>>;
  isolation_probe: Readonly<Record<string, never>>;
}

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
export type CompletionResult<K extends ExecutionKind = "attempt"> =
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
export type StartResult<K extends ExecutionKind = "attempt"> =
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
  cancel(input: CancelInput<K>): Promise<CancelResult>;
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
export type Executor<K extends ExecutionKind = "attempt"> = Executors[K];
interface Executors {
  attempt: AttemptExecutor;
  authentication: AuthenticationExecution;
  isolation_probe: ExecutorLifecycle<"isolation_probe">;
}

/**
 * 準備済みの固有構成を共通制御へ接続する通常の操作契約。
 * @responsibility 実行・技術清掃・結果解釈を分け、通知や保存依頼を混在させない。
 * @trace ARCH-000008
 * @shape 固有Contextと型付き結果の三操作。
 * @invariant Contextは同一実行内だけ。新しい永続状態・Registryを作らない。
 * @boundary 各operationsと共通Lifecycle。
 * @security cleanup不能・一次失敗はcreateResultへ保持し成功へ補完しない。
 * @compatibility 各用途の結果型を再利用し共通Envelopeへ包まない。
 */
export interface LifecycleOperation<TContext, TResult> {
  execute(context: TContext): Promise<void>;
  cleanup(context: TContext): Promise<void>;
  createResult(
    context: TContext,
    failure: unknown,
    failed: boolean,
  ): TResult | Promise<TResult>;
}

/** 元認証構成の単独回収。上位が現在Owner・終了確認と同じReceiptを提供する。 */
export type AuthenticationResourceTarget = AuthenticationStartContext &
  Readonly<{
    kind: "authentication";
    request: AuthenticationRequest;
    callbacks?: ExecutorCallbacks<"authentication">;
  }>;

/**
 * 上位で選定済みの単一Containerと、作成時の同じ技術構成。
 * @responsibility 用途・保持・保存を知らず元構成と現在Owner確認だけを借用する。
 * @trace ARCH-000008
 * @shape container種別、作成構成、借用管理領域と同期現在性確認。
 * @invariant IDだけで処置せず各要求直前にOwnerを再確認する。
 * @boundary 上位の対象選定と既存資源API。
 * @security 任意Path削除や構成検査の省略を公開しない。
 * @compatibility 保存Schema・用途種別・既存Attempt契約を変更しない。
 */
export type ContainerResourceTarget = Readonly<{
  kind: "container";
  configuration: DockerContainerConfigurationExpectation;
  managementDirectory: string;
  assertOwner: () => boolean;
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
}>;

/**
 * 上位が選定・検査した一つのAttemptの回収対象。
 * @responsibility 保存Schemaを持たず、既存技術投影と現在Ownerの確認だけを借用する。
 * @trace ARCH-000008
 * @shape attempt種別、元ID、技術投影、Receipt、config領域と現在確認。
 * @invariant IDだけで処置を許可せず、各要求直前のOwner確認を必須とする。
 * @boundary 上位で選定済みの対象とExecutor資源API。
 * @security 生の削除Path・権限発行・保存操作を公開しない。
 * @compatibility kindはAPI内の分岐だけで、保存Schemaへ加えない。
 */
export type AttemptRecoveryTarget = Readonly<{
  kind: "attempt";
  operationId: string;
  recoveryId: string;
  projection: AttemptRecordProjection &
    Readonly<{
      workspaceProtected?: boolean;
      workspaceProtection?: AttemptRequest["target"]["workspaceProtection"];
    }>;
  receipts: DockerResourceReceipts;
  previouslyAbsent?: readonly (keyof DockerResourceReceipts)[];
  managementDirectory: string | null;
  assertOwner: () => boolean;
}>;

/**
 * 診断だけで得た技術資源の観測。
 * @responsibility 存在・不存在・不明とconfig終了を区別する。
 * @trace ARCH-000008
 * @shape 元ID、資源別観測、理由とconfig終了確認。
 * @invariant 診断の成功を削除許可・保存確定へ昇格しない。
 * @boundary 同期のAttempt観測結果から上位判断。
 * @security 認証内容・生出力・操作権限を含めない。
 * @compatibility 既存Attempt観測の値と同期返却を維持する。
 */
export type AttemptResourceInspection = Readonly<{
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  configCleanupConfirmed: boolean;
  resources: readonly Readonly<{
    purpose: keyof DockerResourceReceipts;
    plannedResourceName: string;
    dockerId: string | null;
    observation: "not_requested" | "present" | "absent" | "unknown";
    absenceObservations: readonly ("absent" | "unknown")[];
  }>[];
}>;

/**
 * Attempt資源の技術回収結果。
 * @responsibility 資源別観測とconfig終了を元のAttemptへ結合して返す。
 * @trace ARCH-000008
 * @shape 元ID、技術回収とconfig終了の個別結果、資源観測。
 * @invariant Docker回収とTask完了・Host清掃・履歴確定を混同しない。
 * @boundary 同期のAttempt回収から上位保存・判断。
 * @security 元参照を削除権限へ昇格しない。
 * @compatibility Directory結果のために既存fieldや意味を変更しない。
 */
export type AttemptCleanupResult = Readonly<{
  status: "completed" | "blocked";
  operationId: string;
  recoveryId: string;
  reason: string;
  dockerCleanupConfirmed: boolean;
  configCleanupConfirmed: boolean;
  resources: readonly DockerResourceCleanupObservation[];
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
