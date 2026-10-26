/**
 * Coordinatorの正式操作を利用側へ接続する。
 * @packageDocumentation
 * @responsibility 公開要求を既存Ownerへ接続し、状態・保存・再試行を追加しない。
 * @trace ARCH-000004
 * @boundary CLI／Workbench／MCP等と内部実行Owner。
 * @security Provider Homeの所在・認証情報を公開要求や結果へ含めない。
 */
import { runProviderAuthenticationRequest } from "./execution/authority.ts";
import { readExecutionCancellation } from "./execution/authority.ts";
import { runDoctor } from "./execution/diagnostics.ts";
import {
  inspectRuntimeOwnedDockerTaskAdmission,
  resumeRuntimeOwnedExecution,
  restartRuntimeOwnedDockerForRecovery,
  repairRuntimeOwnedDockerRuntime,
  projectRuntimeRepairObservation,
} from "./execution/recovery.ts";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../version-control/src/index.ts";
import { snapshotPlainRecord } from "../../domain-model/src/index.ts";
import type { ProviderAuthenticationRequest as AuthenticationRequest } from "./execution/authority.ts";
export type { ProviderAuthenticationRequest as AuthenticationRequest } from "./execution/authority.ts";

/**
 * Providerの現在認証状態を隔離環境で確認する。
 * @responsibility 状態確認要求を既存の非対話Lifecycleへ渡す。
 * @trace ARCH-000004
 * @input request: Provider、signal: 取消。
 * @returns 認証済み・未認証・不明と回収結果。
 * @precondition 固定Imageと検証済みHomeが利用可能。
 * @postcondition ログイン・外部通信・認証情報の変更を行わない。
 * @effect 既存Home観測と読取り専用の使い捨てContainerを使用する。
 * @failure 観測不能を未認証へ丸めない。
 * @invariant 状態確認からログインを自動実行しない。
 * @boundary 公開APIと認証実行Owner。
 * @security 認証本文・生出力・Pathを返さない。
 * @concurrency 同じHomeの既存排他へ従う。
 */
export function getAuthenticationStatus(
  request: AuthenticationRequest,
  signal?: AbortSignal,
) {
  return runProviderAuthenticationRequest("status", request, signal);
}

/**
 * Providerの公式対話認証を明示実行する。
 * @responsibility ログイン要求を既存の対話Lifecycleへ渡す。
 * @trace ARCH-000004
 * @input request: Provider、signal: 取消。
 * @returns 認証確認と回収を区別した操作結果。
 * @precondition 呼出し元が対話端末と人間の明示操作を確保する。
 * @postcondition 完了には認証確認・Process終了・資源不存在・保存・Lock解放が必要。
 * @effect 公式認証通信と専用HomeのOAuth更新を既存Ownerへ委譲する。
 * @failure 失敗を再試行せず同じ回復参照を返す。
 * @invariant APIキー・別Offeringへfallbackしない。
 * @boundary 公開APIと認証実行Owner。
 * @security 秘密入力を取得・記録・再表示しない。
 * @concurrency 同じHomeの既存排他へ従う。
 */
export function authenticateProvider(
  request: AuthenticationRequest,
  signal?: AbortSignal,
) {
  return runProviderAuthenticationRequest("login", request, signal);
}

export {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "./storage/ai-selection.ts";
export type {
  AiSelectionReadResult,
  AiSelectionSaveResult,
} from "./storage/ai-selection.ts";
export type {
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionRole,
  AiSelectionSnapshot,
  ExecutionSelection,
} from "./selection/types.ts";
export type { SingleTaskCommand } from "./task/requests.ts";

export { inspectAiSelectionChoice } from "./selection/validation.ts";
export {
  openTaskSession,
  runTask,
  inspectSingleTaskCommand,
} from "./task/requests.ts";
export type {
  TaskSessionContext,
  TaskSession,
  TaskRunResult,
} from "./task/requests.ts";
export { initializeProject } from "./state/initialize.ts";
export type { ProjectInitializationRequest } from "./state/initialize.ts";
export { runCoordinatorPublicObjective as runObjective } from "./objective/composition.ts";
export { runCoordinatorPublicDecision as submitDecision } from "./decision/lifecycle.ts";
export { runCoordinatorPublicAcceptanceDecision as acceptResult } from "./decision/acceptance.ts";
export { runCoordinatorPublicStateQuery as queryState } from "./state/query.ts";
export { executeWorkspaceCommand as executeWorkspace } from "./workspace/commands.ts";
export { readAuthorizedRuntimeActivity as queryActivity } from "./state/observation.ts";

/**
 * 信頼したHost入口が渡す実行対象。
 * @responsibility 任意Pathでなく検証済みRoot権限を既存Ownerへ結合する。
 * @trace ARCH-000004
 * @shape 検証済みRootだけ。
 * @invariant JSONから権限を生成しない。
 * @boundary 正式Package操作とローカル実行Owner。
 * @security 内部Pathや資格を結果へ返さない。
 * @compatibility 保存契約とは別のProcess-local Context。
 */
export type ExecutionContext = Readonly<{
  rootCapability: VerifiedRepositoryRoot;
}>;

/**
 * 明示回復する元参照を指定する。
 * @responsibility 対象の作成・回復Authorityを要求値から発行しない。
 * @trace ARCH-000004
 * @shape recoveryId一項目。
 * @invariant 別参照や名前推測へ切り替えない。
 * @boundary 公開回復操作とexact対象確認。
 * @security 参照は非Authorityであり現在Rootとの照合を必要とする。
 * @compatibility 旧参照を自動変換しない。
 */
export type RecoveryRequest = Readonly<{ recoveryId: string }>;

/**
 * 診断だけか、明示した隔離確認を含むかを指定する。
 * @responsibility 修復・再起動・認証・AI依頼を診断へ混入しない。
 * @trace ARCH-000004
 * @shape 任意のactiveIsolationだけ。
 * @invariant 診断成功を実Providerの利用可能性とみなさない。
 * @boundary 正式操作と既存診断Owner。
 * @security Rootは別の検証済みContextで渡す。
 * @compatibility 既存診断の意味と結果を維持する。
 */
export type EnvironmentRequest = Readonly<{ activeIsolation?: boolean }>;

/**
 * 公開回復要求から参照だけを安全に取り出す。
 * @responsibility accessor・Proxy・余分なfieldを実処置より前に拒否する。
 * @trace ARCH-000004
 * @input request: 未信頼要求。
 * @returns boundedな元参照。
 * @precondition 対象所有権は後続Ownerが再確認する。
 * @postcondition 入力のgetterを呼ばない。
 * @effect N/A: 値検査だけ。
 * @failure 不正要求は固定Errorで停止。
 * @invariant 形式受理を回復権限としない。
 * @boundary 公開DTOと既存回復Owner。
 * @security 本文やPathを解釈しない。
 * @concurrency 同期処理。
 */
function recoveryReference(request: RecoveryRequest): string {
  const value = snapshotPlainRecord(request, new Set(["recoveryId"]));
  if (
    !value ||
    typeof value.recoveryId !== "string" ||
    value.recoveryId.length === 0 ||
    value.recoveryId.length > 4096 ||
    /[\u0000-\u001f\u007f]/u.test(value.recoveryId)
  )
    throw new Error("coordinator_recovery_request_invalid");
  return value.recoveryId;
}

/**
 * 呼出し元が渡した検証済みRootを確認する。
 * @responsibility Source側の権限型を任意Path入力へ置き換えない。
 * @trace ARCH-000004
 * @input context: 信頼したSurfaceのContext。
 * @returns 現在の検証済みRoot。
 * @precondition Context自体はHTTP／JSONから生成しない。
 * @postcondition 不明な権限を後続へ渡さない。
 * @effect 既存Root検証だけ。
 * @failure 不明は固定Errorで停止。
 * @invariant 新しいAuthorityを生成しない。
 * @boundary 正式APIとVersion ControlのRoot権限。
 * @security Rootは内部接続だけに使用し結果へ含めない。
 * @concurrency 実処置前後の再検査は実Ownerが維持する。
 */
function executionRoot(context: ExecutionContext): string {
  const root = resolveVerifiedRepositoryRoot(context.rootCapability);
  if (root === null) throw new Error("coordinator_execution_context_invalid");
  return root;
}

/**
 * 実効果を発行する前に組込み取消Signalのbrandを確認する。
 * @responsibility 偽Signalとaccessorを未取消へ丸めない。
 * @trace ARCH-000004
 * @input signal: 呼出し元の取消Signal。
 * @returns 同じSignal。
 * @precondition 取消済みの処置は実Ownerが既存の結果へ投影する。
 * @postcondition 不正Signalでは下位を呼ばない。
 * @effect N/A: 値検査だけ。
 * @failure 不正は固定Errorで停止。
 * @invariant 新しい取消Ownerを作らない。
 * @boundary 公開APIと既存実行Owner。
 * @security getter／Proxyを実行しない。
 * @concurrency 同じ組込みSignalを後続へ渡す。
 */
function executionSignal(signal: AbortSignal): AbortSignal {
  if (signal === undefined || readExecutionCancellation(signal) === null)
    throw new Error("coordinator_execution_signal_invalid");
  return signal;
}

/**
 * 現在Rootの診断と回復受付状況を既存Ownerで観測する。
 * @responsibility 診断とTask受付の現在観測を同じRootへ結合する。
 * @trace ARCH-000004
 * @input request: 隔離確認の明示指定、context: 検証済みRoot。
 * @returns 既存診断とTask回復受付の報告。
 * @precondition activeIsolationは別途許可された場合だけtrueにする。
 * @postcondition 診断だけで修復・再起動・Provider依頼を発行しない。
 * @effect 一時Operation領域とCommand／Git観測。隔離指定時だけ既存の限定試験。
 * @failure 不正要求・Root不明は開始前停止。清掃不明は既存報告に保持する。
 * @invariant passive診断を厳密なEffect 0と表示しない。
 * @boundary 正式操作と既存診断／受付観測Owner。
 * @security 秘密値を取得・複製しない。
 * @concurrency 同期診断の既存寿命を維持する。
 */
export function diagnoseEnvironment(
  request: EnvironmentRequest,
  context: ExecutionContext,
) {
  const value =
    snapshotPlainRecord(request, new Set(["activeIsolation"])) ??
    snapshotPlainRecord(request, new Set());
  if (
    !value ||
    (value.activeIsolation !== undefined &&
      typeof value.activeIsolation !== "boolean")
  )
    throw new Error("doctor_options_invalid");
  const root = executionRoot(context);
  return Object.freeze({
    ...runDoctor({
      activeIsolation: value.activeIsolation ?? false,
      cwd: root,
    }),
    dockerTaskRecovery: inspectRuntimeOwnedDockerTaskAdmission(root),
  });
}

/**
 * 元参照と現在Rootに限定して正式回復を再入場する。
 * @responsibility 種類別の対象・処置判断を既存実行Ownerへ渡す。
 * @trace ARCH-000004
 * @input request: 元参照、context: 現在Root、signal: 取消。
 * @returns 元参照を保持した回復結果。
 * @precondition 呼出し元が今回の回復を明示許可している。
 * @postcondition 新しいTaskやProvider依頼を作らない。
 * @effect 既存回復の観測・保存・exact対象回収だけ。
 * @failure 相関不明・取消・回収不明は既存結果に保持する。
 * @invariant 再起動を通常回復へ暗黙追加しない。
 * @boundary 正式APIと既存回復Owner。
 * @security 内部の相関Rootを公開しない。
 * @concurrency 同じSignalと元Ownerのjoinを維持する。
 */
export function recoverExecution(
  request: RecoveryRequest,
  context: ExecutionContext,
  signal: AbortSignal,
) {
  const id = recoveryReference(request);
  executionRoot(context);
  return resumeRuntimeOwnedExecution(
    id,
    context.rootCapability,
    executionSignal(signal),
  );
}

/**
 * 元Task回復参照へ結合したDocker再起動を明示実行する。
 * @responsibility 既存の範囲照合・再起動・settleを同じOwnerへ渡す。
 * @trace ARCH-000004
 * @input request: exact参照、context: 現在Root、signal: 取消。
 * @returns 再起動とTask回復の完了を分離した既存結果。
 * @precondition 他Docker作業への影響を含め今回の再起動が許可済みである。
 * @postcondition 新しいProvider依頼や永続データ削除を追加しない。
 * @effect 既存の検証付きDocker再起動と記録。
 * @failure 対象・範囲・取消・終了不明は元結果に保持する。
 * @invariant 再起動成功をTask回復成功と同一視しない。
 * @boundary 正式操作と既存再起動Owner。
 * @security Rootや再起動Authorityを結果へ公開しない。
 * @concurrency 同じSignalと既存の排他を維持する。
 */
export function restartDockerForRecovery(
  request: RecoveryRequest,
  context: ExecutionContext,
  signal: AbortSignal,
) {
  const id = recoveryReference(request);
  executionRoot(context);
  return restartRuntimeOwnedDockerForRecovery(
    id,
    executionSignal(signal),
    context.rootCapability,
  );
}

/**
 * 明示したDocker Runtime修復を既存Ownerで実行する。
 * @responsibility 新規又は元参照の修復を固定purposeで接続する。
 * @trace ARCH-000004
 * @input request: 元参照又は新規null、context: 現在Root、signal: 取消。
 * @returns 修復・保存・回収を分離した既存結果。
 * @precondition 今回の修復が明示許可済みである。
 * @postcondition 通常Taskへ自動修復を追加しない。
 * @effect 既存の使い捨てRuntime修復と記録だけ。
 * @failure 観測不能・処置不明は元参照を保持する。
 * @invariant 保持判断へpurposeを暗黙切替しない。
 * @boundary 正式操作と修復Owner。
 * @security 内部Root・checkpointを新たに公開しない。
 * @concurrency 既存排他と同じSignalを用いる。
 */
export async function repairDockerRuntime(
  request: RecoveryRequest | null,
  context: ExecutionContext,
  signal: AbortSignal,
) {
  const id = request === null ? null : recoveryReference(request);
  executionRoot(context);
  return projectRuntimeRepairObservation(
    await repairRuntimeOwnedDockerRuntime(
      context.rootCapability,
      executionSignal(signal),
      id,
      "repair",
    ),
    id,
  );
}

/**
 * 元の修復退避物を調査用に明示保持する。
 * @responsibility 保持を回収完了や削除許可と区別する。
 * @trace ARCH-000004
 * @input request: 元修復参照、context: 現在Root、signal: 取消。
 * @returns 期限と保存・完了を分離した既存結果。
 * @precondition 今回の保持判断が明示済みである。
 * @postcondition 新規の修復・新しい保持Registryを作らない。
 * @effect 同じ修復Ownerの既存保持記録だけ。
 * @failure 不正・別参照・観測不能ではOwnerが停止する。
 * @invariant 既定7日と既存の再確認条件を変更しない。
 * @boundary 正式操作と既存保持Owner。
 * @security 保持物の内部Pathを新たに公開しない。
 * @concurrency 同じSignalと保存排他を維持する。
 */
export async function retainRepair(
  request: RecoveryRequest,
  context: ExecutionContext,
  signal: AbortSignal,
) {
  const id = recoveryReference(request);
  executionRoot(context);
  return projectRuntimeRepairObservation(
    await repairRuntimeOwnedDockerRuntime(
      context.rootCapability,
      executionSignal(signal),
      id,
      "retain",
    ),
    id,
  );
}

export { PROVIDER_AUTHENTICATION_INPUT_NOTICE } from "./execution/authority.ts";

export { inspectCoordinatorDecisionRequest } from "./decision/request.ts";
export { inspectCoordinatorObjectiveRequest } from "./objective/request.ts";
export { inspectCoordinatorWorkspaceResults } from "./objective/execute.ts";
export { inspectCoordinatorStateQuery } from "./state/request.ts";
export { inspectCoordinatorStateQueryResult } from "./state/projection.ts";
export { isCoordinatorObjectiveProjectionCorrelationValid } from "./state/projection.ts";
export { isCoordinatorProjectionSemanticallyValid } from "./state/projection.ts";
export { COORDINATOR_HUMAN_DECISION_CONTRACT } from "./decision/request.ts";
export { COORDINATOR_MAXIMUM_OBJECTIVES } from "./state/validation.ts";
export { COORDINATOR_MAXIMUM_TASKS } from "./state/validation.ts";
export { COORDINATOR_OBJECTIVE_INTAKE_CONTRACT } from "./objective/plan.ts";
export { COORDINATOR_PUBLIC_RUNTIME_CONTRACT } from "./state/result.ts";
export type { CoordinatorProjection } from "./state/types.ts";
export type { CoordinatorWorkspaceResult } from "./execution/result.ts";
export type { WorkspaceCommand } from "./workspace/commands.ts";
export type { WorkspaceView } from "./workspace/commands.ts";
export { inspectWorkspaceCommand } from "./workspace/commands.ts";
export { parseRuntimeActivityObservation } from "./state/projection.ts";
export { inspectRuntimeActivityObservation } from "./state/projection.ts";
export type { ActivityRepository } from "./state/types.ts";
export type { ActivitySource } from "./state/types.ts";
export type { RuntimeActivityEvent } from "./state/types.ts";
export type { RuntimeActivityObservation } from "./state/types.ts";
export type { RuntimeActivityRequest } from "./state/types.ts";
export { readRepositoryNetworkPolicies } from "./decision/external-send-policy.ts";
export type { RepositoryNetworkPolicies } from "./decision/external-send-policy.ts";
export type { CoordinatorObjectiveRequest } from "./objective/request.ts";
export type { CoordinatorDecisionRequest } from "./decision/request.ts";
export type { CoordinatorStateQuery } from "./state/types.ts";
export type { CoordinatorStateQueryResult } from "./state/types.ts";
export { observeRuntimeOwnedProjectClientPrincipal as observeClientPrincipal } from "./decision/lifecycle.ts";
export {
  isSupportedCoordinatorNodeRuntime as isSupportedNodeRuntime,
  getCoordinatorCapabilities as getCapabilities,
} from "./execution/diagnostics.ts";

/**
 * 正式認証操作の完了・不明・回収を識別する結果。
 * @responsibility 実Ownerの固定結果を新しい万能Envelopeへ変換しない。
 * @trace ARCH-000004
 * @shape 認証状態、固定理由と回収確認。
 * @invariant 表示・認証確認・cleanupを同一視しない。
 * @boundary 正式認証APIと利用側。
 * @security 秘密値・Provider Homeを含めない。
 * @compatibility 保存・通信Schemaから独立した公開型。
 */
export type AuthenticationResult = Awaited<
  ReturnType<typeof runProviderAuthenticationRequest>
>;

/**
 * 公開診断の既存観測結果。
 * @responsibility 現在診断と回復受付を同じ型で提供する。
 * @trace ARCH-000004
 * @shape 公開診断関数から導出した読取り専用の結果。
 * @invariant 診断結果から修復・実行Authorityを生成しない。
 * @boundary 診断表示と実行Owner。
 * @security 生出力・秘密値を含めない。
 * @compatibility 内部の保存型は公開しない。
 */
export type EnvironmentResult = ReturnType<typeof diagnoseEnvironment>;

/**
 * 公開回復の元参照と処置結果。
 * @responsibility 種類別の完了条件を一つのsuccessへ畳まない。
 * @trace ARCH-000004
 * @shape 元参照・固定理由と各Ownerの確認値。
 * @invariant 回収不明を成功化しない。
 * @boundary 回復Ownerと利用側。
 * @security Root・Authorityを含めない。
 * @compatibility 旧参照の意味を変更しない。
 */
export type RecoveryResult = Awaited<ReturnType<typeof recoverExecution>>;

/**
 * 公開修復の縮約した観測結果。
 * @responsibility 内部publication等を公開せず既存確認値を保持する。
 * @trace ARCH-000004
 * @shape 状態・元参照・保持期限・保存・回収確認。
 * @invariant 修復、保持、保存、回収の共同条件を省略しない。
 * @boundary 修復Ownerと利用側。
 * @security 内部Rootやcheckpointを含めない。
 * @compatibility CLIと同じ固定fieldだけ。
 */
export type RuntimeRepairResult = Awaited<
  ReturnType<typeof repairDockerRuntime>
>;
