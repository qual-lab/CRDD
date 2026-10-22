/**
 * Controllerの元結果・短命通知を同じOwner内で照合する。
 * @responsibility 既存の非耐久観測を実行調整から分離する。
 * @trace ARCH-000008
 */
import type { DockerResourceCleanupObservation } from "../../../docker-isolation/src/index.ts";
import type { PrimaryFailureDiagnostic } from "./provider-controller.ts";
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
const runtimeOwnedProviderObservationOwner = createProviderObservationOwner();

/**
 * 本番Controllerの元終端結果を登録する。
 * @responsibility 元結果と観測の結合を保持する。
 * @trace ARCH-000008
 * @input result、value: 元結果と観測。
 * @returns N/A: 戻り値なし。
 * @precondition Controllerの終端位置から呼ぶ。
 * @postcondition 元objectへ結合する。
 * @effect 私有WeakMapを更新する。
 * @failure N/A: 外部I/Oなし。
 * @invariant 永続状態を更新しない。
 * @boundary Controllerの観測登録。
 * @security 新Authorityを生成しない。
 * @concurrency 同期登録。
 */
export function registerRuntimeOwnedProviderTerminalObservation(
  ...args: Parameters<
    ReturnType<typeof createProviderObservationOwner>["registerTerminal"]
  >
) {
  runtimeOwnedProviderObservationOwner.registerTerminal(...args);
}

/**
 * 本番Controllerの同期保存通知を登録する。
 * @responsibility callback中だけの相関を保持する。
 * @trace ARCH-000008
 * @input notice、value: 元通知と相関。
 * @returns N/A: 戻り値なし。
 * @precondition Controllerのcallback直前に呼ぶ。
 * @postcondition 元通知だけを照合可能にする。
 * @effect 私有WeakMapを更新する。
 * @failure N/A: 外部I/Oなし。
 * @invariant callback後に失効する。
 * @boundary Controllerの通知登録。
 * @security 新Authorityを生成しない。
 * @concurrency 同期登録。
 */
export function registerRuntimeOwnedProviderSubmissionNotice(
  ...args: Parameters<
    ReturnType<typeof createProviderObservationOwner>["registerSubmission"]
  >
) {
  runtimeOwnedProviderObservationOwner.registerSubmission(...args);
}

/**
 * 本番Controllerの同期保存通知を失効する。
 * @responsibility 正常・false・throw後の再利用を防ぐ。
 * @trace ARCH-000008
 * @input notice: 元通知。
 * @returns N/A: 戻り値なし。
 * @precondition 同期callbackのfinallyから呼ぶ。
 * @postcondition 同じ通知の照合はfalseとなる。
 * @effect 私有WeakMapから通知を除く。
 * @failure N/A: 外部I/Oなし。
 * @invariant 耐久記録を変更しない。
 * @boundary callback終了と通知寿命。
 * @security 通知を再生成しない。
 * @concurrency 同期失効。
 */
export function revokeRuntimeOwnedProviderSubmissionNotice(notice: object) {
  runtimeOwnedProviderObservationOwner.revokeSubmission(notice);
}
/**
 * 本番Controllerの元未発行通知を保存Ownerへ照合する。
 * @responsibility isolated試験の通知を本番根拠に混入させない。
 * @trace ARCH-000008
 * @input notice: 元通知、recoveryCapability: 元回復Owner、managementCapability: 元操作Owner、purpose: 用途、operationId: 実操作、recoveryId: exact参照。
 * @returns 本番の同期callback中に全結合が一致する場合だけtrue。
 * @precondition 本番Controllerの未発行保存callback中に呼び出す。
 * @postcondition callback後、コピーと別操作の通知はfalse。
 * @effect N/A: Process内の非Authority照合だけ。
 * @failure 根拠不在はfalse。保存・要求を再発行しない。
 * @invariant 過去unknownから未発行を推論しない。
 * @boundary 本番Controllerと現在状態Writer。
 * @security 返却値は操作Authorityではない。
 * @concurrency 同期callbackの寿命だけを使用する。
 */
export function verifyRuntimeOwnedDockerUnissuedNotice(
  notice: unknown,
  recoveryCapability: unknown,
  managementCapability: unknown,
  purpose: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  return runtimeOwnedProviderObservationOwner.verifyUnissuedNotice(
    notice,
    recoveryCapability,
    managementCapability,
    purpose,
    operationId,
    recoveryId,
  );
}
/**
 * Provider要求直前だけ有効な元通知を照合する。
 * @responsibility 実行評価の保存根拠を同じController・操作・回復参照へ限定する。
 * @trace ARCH-000008
 * @input notice: 元通知、recoveryCapability: 元Owner、managementCapability: 操作Owner、operationId: 操作ID、recoveryId: exact参照。
 * @returns 本番の同期保存中に全相関が一致する場合だけtrue。
 * @precondition Provider要求をまだ発行していない同じControllerから呼び出す。
 * @postcondition コピー・別操作・失効通知と未発行通知の流用を拒否する。
 * @effect N/A: 既存私有通知の照合だけ。
 * @failure 根拠不在・相関不一致はfalse。
 * @invariant 保存予定をProvider実開始・外部送信成立と同一視しない。
 * @boundary Controllerと現在状態保存Owner。
 * @security 通知から実行・回復Authorityを発行しない。
 * @concurrency 同期保存callback終了時に失効する。
 */
export function verifyRuntimeOwnedDockerProviderSubmissionNotice(
  notice: unknown,
  recoveryCapability: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  return runtimeOwnedProviderObservationOwner.verifyUnissuedNotice(
    notice,
    recoveryCapability,
    managementCapability,
    "start_provider_attached",
    operationId,
    recoveryId,
    "provider_submission",
  );
}
/**
 * 本番Controllerの同じ完了結果から終端観測を借用する。
 *
 * @responsibility 本番の終端観測と同じ操作・回復参照の照合を所有する。
 * @trace ARCH-000008
 * @input result、managementCapability、operationId、recoveryId: 本番結果と対象。
 * @returns 保持中の非Authority観測、またはnull。
 * @precondition 同じ本番Controllerの元の結果を渡す。
 * @postcondition 模擬Runtime・コピー・別操作の結果を拒否する。
 * @effect N/A: 本番Ownerの私有保持値だけを読む。
 * @failure 未登録・相関不一致ではnullへ閉じる。
 * @invariant 終端観測を清掃・保存・削除Authorityへ昇格しない。
 * @boundary Controller完了から同じ操作の終端保存への内部搬送。
 * @security 管理CapabilityやProvider本文を返さない。
 * @concurrency N/A: 同期照合だけであり外部待機を行わない。
 */
export function borrowRuntimeOwnedDockerTerminalObservations(
  result: unknown,
  managementCapability: unknown,
  operationId: unknown,
  recoveryId: unknown,
) {
  return runtimeOwnedProviderObservationOwner.borrowTerminalObservations(
    result,
    managementCapability,
    operationId,
    recoveryId,
  );
}
