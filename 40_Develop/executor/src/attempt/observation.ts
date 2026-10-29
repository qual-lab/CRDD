/**
 * 同じ試行の通知と終端objectを相関する。
 * @packageDocumentation
 * @responsibility 私有二WeakMapを同じ実行Runtimeだけが更新・照合する。
 * @trace ARCH-000008
 */
import type { DockerResourceCleanupObservation } from "../../../docker-isolation/src/index.ts";
import type {
  PrimaryFailureDiagnostic,
  RecoveryStartFailureDiagnostic,
} from "../result/types.ts";
/**
 * 一試行の非秘密診断を表す。
 * @responsibility 構成・回復開始失敗・終了観測を相関した閉じた通知へ限定する。
 * @trace ARCH-000008
 * @shape eventを判別子とするProvider・操作・試行と固定診断値。
 * @invariant 一次故障と清掃・終了観測を別fieldで保持する。
 * @boundary Executorから上位の診断Consumer。
 * @security 生出力・Command本文・認証値を含めない。
 * @compatibility 元の通知名・相関field・三値の意味を維持する。
 */
export type ProviderAttemptDiagnosticNotice =
  | Readonly<{
      event: "coordinator_provider_recovery_start_failed";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
      diagnostic: RecoveryStartFailureDiagnostic;
    }>
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
      networkPolicyHash: string | null;
      rootFilesystemReadOnlyConfigured: boolean;
      nonRootUserConfigured: boolean;
      workdirConfigured: boolean;
    }>
  | Readonly<{
      event: "coordinator_provider_boundary_settled";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      taskAttempt: 0 | 1;
      recoveryCorrelationId: string | null;
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
 * @shape ProviderProcessStartedNoticeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProviderProcessStartedNoticeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProviderProcessStartedNoticeの宣言は外部境界を開かない。
 * @security ProviderProcessStartedNoticeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ProviderProcessStartedNoticeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProviderProcessStartedNotice = Readonly<{
  event: "coordinator_provider_process_started";
  taskRole: "executor" | "reviewer" | null;
  provider: "codex" | "claude";
  operationId: string;
}>;

/**
 * 私有観測の値契約。
 * @responsibility 二つの既存WeakMapの値契約を維持する。
 * @trace ARCH-000008
 * @shape 元object・Owner・操作・回復参照の相関。
 * @invariant 永続化・復元しない。
 * @boundary N/A: 内部型のみ。
 * @security MapをRoot公開しない。
 * @compatibility 本番と候補は共有しない。
 */
type ObservationState = Readonly<{
  terminalObservations: WeakMap<
    object,
    Readonly<{
      managementCapability: object;
      operationId: string;
      recoveryId: string;
      resources: readonly DockerResourceCleanupObservation[];
      primaryFailure: PrimaryFailureDiagnostic | null;
      mountLeaseReleased: boolean;
      recoveryCompleted: boolean;
      homeLeaseReleased: boolean;
    }>
  >;
  submissionNotices: WeakMap<
    object,
    Readonly<{
      managementCapability: unknown;
      recoveryCapability: object;
      operationId: string;
      recoveryId: string;
      purpose: string;
      kind: "resource_not_issued" | "provider_submission";
    }>
  >;
}>;

/**
 * 同じ完了結果へ結合した終端観測を借用する。
 *
 * @responsibility Controller終了後も同じ操作・回復参照の非Authority観測を保持する。
 * @trace ARCH-000008
 * @input state、result、managementCapability、operationId、recoveryId: Ownerと照合対象。
 * @returns 資源・Mount・回復の観測、またはnull。
 * @precondition 同じControllerの元の完了結果と操作相関を渡す。
 * @postcondition コピー結果と別操作・別Ownerの借用を拒否する。
 * @effect N/A: 私有WeakMapの読取りだけを行う。
 * @failure 未登録・相関不一致ではnullを返す。
 * @invariant 借用はProvider起動、Host清掃、現在状態除去の許可を生成しない。
 * @boundary 完了結果から同じ操作の終端保存への搬送。
 * @security 管理Capabilityを返却観測へ複製しない。
 * @concurrency N/A: 同期照合であり外部待機を持たない。
 */
function borrowTerminalObservations(
  state: ObservationState,
  result: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  if (!result || typeof result !== "object") return null;
  const observation = state.terminalObservations.get(result);
  if (
    !observation ||
    observation.managementCapability !== managementCapability ||
    observation.operationId !== operationId ||
    observation.recoveryId !== recoveryId
  )
    return null;
  return Object.freeze({
    resources: observation.resources,
    primaryFailure: observation.primaryFailure,
    mountLeaseReleased: observation.mountLeaseReleased,
    recoveryCompleted: observation.recoveryCompleted,
    homeLeaseReleased: observation.homeLeaseReleased,
  });
}

/**
 * 作成予定後の取消が実要求前に確定した元通知を照合する。
 * @responsibility 同期保存callback中だけ有効な未発行根拠の出自を確認する。
 * @trace ARCH-000008
 * @input state: 実行Owner、notice: 元通知、recoveryCapability: 元回復Owner、managementCapability: 元操作Owner、purpose: 資源用途、operationId: 実操作、recoveryId: exact参照。
 * @returns 全結合と通知の有効期間が一致する場合だけtrue。
 * @precondition 要求予定保存後、startCommand呼出し前の取消をControllerが確認している。
 * @postcondition コピー、別Owner、別用途、保存callback後の再利用を拒否する。
 * @effect N/A: Process内の元通知照合だけ。
 * @failure 登録欠落または結合不一致はfalse。
 * @invariant 要求呼出し後の例外・handle欠測を未発行根拠にしない。
 * @boundary Controllerの同期待機なし処理と現在状態保存Owner。
 * @security 通知は新しい要求・削除・回復Authorityを発行しない。
 * @concurrency 元保存callbackの終了時に失効し、別Processで再構成しない。
 */
function verifyUnissuedNotice(
  state: ObservationState,
  notice: unknown,
  recoveryCapability: unknown,
  managementCapability: unknown,
  purpose: unknown,
  operationId: unknown,
  recoveryId: unknown,
  kind: "resource_not_issued" | "provider_submission" = "resource_not_issued",
) {
  const value =
    notice && typeof notice === "object"
      ? state.submissionNotices.get(notice)
      : null;
  return (
    !!value &&
    value.kind === kind &&
    value.recoveryCapability === recoveryCapability &&
    value.managementCapability === managementCapability &&
    value.purpose === purpose &&
    value.operationId === operationId &&
    value.recoveryId === recoveryId
  );
}

/**
 * 本番または一候補だけの観測Ownerを作成する。
 * @responsibility 二WeakMapを私有に保持し、登録・失効・照合だけを提供する。
 * @trace ARCH-000008
 * @input N/A: 外部入力なし。
 * @returns 独立した観測Owner。
 * @precondition Controller生成時に呼び出す。
 * @postcondition 別Ownerの元objectを拒否する。
 * @effect Process内の二WeakMapを生成する。
 * @failure N/A: 外部I/Oなし。
 * @invariant 通知は同期callback後に失効する。
 * @boundary Controllerと保存Owner。
 * @security Mapや新しいAuthorityを公開しない。
 * @concurrency 同期操作だけを提供する。
 */
export function createProviderObservationOwner() {
  const state: ObservationState = {
    terminalObservations: new WeakMap(),
    submissionNotices: new WeakMap(),
  };
  return Object.freeze({
    registerTerminal: (
      result: object,
      value: NonNullable<
        ReturnType<ObservationState["terminalObservations"]["get"]>
      >,
    ) => {
      state.terminalObservations.set(result, value);
    },
    registerSubmission: (
      notice: object,
      value: NonNullable<
        ReturnType<ObservationState["submissionNotices"]["get"]>
      >,
    ) => {
      state.submissionNotices.set(notice, value);
    },
    revokeSubmission: (notice: object) => {
      state.submissionNotices.delete(notice);
    },
    borrowTerminalObservations: (
      ...args: Parameters<typeof borrowTerminalObservations> extends [
        ObservationState,
        ...infer Rest,
      ]
        ? Rest
        : never
    ) => borrowTerminalObservations(state, ...args),
    verifyUnissuedNotice: (
      ...args: Parameters<typeof verifyUnissuedNotice> extends [
        ObservationState,
        ...infer Rest,
      ]
        ? Rest
        : never
    ) => verifyUnissuedNotice(state, ...args),
  });
}
