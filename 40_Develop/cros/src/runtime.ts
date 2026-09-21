/**
 * CROSの接続資格を定義する。
 *
 * @responsibility 接続資格Identity、Workspace Grant、管理能力および失効状態を固定する。
 * @trace ARCH-000013
 * @shape Credential ID、Workspace集合、systemAdminおよびrevokedを表す。
 * @invariant systemAdminはContent Accessを生成しない。
 * @boundary Credential VerifierとRequest Access Contextの境界。
 * @security Secret値を保持せず検証済みCredential Recordだけを扱う。
 * @compatibility Workspace Grantの変更は次Sessionから反映する。
 */
export type CrosCredential = Readonly<{
  credentialId: string;
  workspaceIds: readonly string[];
  systemAdmin: boolean;
  revoked: boolean;
}>;

/**
 * CROSへ登録したRepositoryを定義する。
 *
 * @responsibility Project、Repository、Binding、Revisionおよび読取り投影を同じ登録記録へ閉じる。
 * @trace ARCH-000009
 * @shape Repositoryの論理Identityと検証済みBinding情報を表す。
 * @invariant Pathや表示名だけからIdentityを再構成しない。
 * @boundary Repository Binding VerifierとFederationの境界。
 * @security contentは許可済みSessionへだけ返す。
 * @compatibility repositoryIdとbindingIdは登録Revision中で安定する。
 */
export type CrosRepository = Readonly<{
  projectId: string;
  repositoryId: string;
  bindingId: string;
  revision: string;
  content: Readonly<Record<string, unknown>>;
}>;

/**
 * WorkspaceからRepositoryへの公開関係を定義する。
 *
 * @responsibility Workspace IDとRepository IDの明示Exposureを固定する。
 * @trace ARCH-000013
 * @shape workspaceId、repositoryIdおよびExposure Revisionを表す。
 * @invariant Repository登録だけではExposureを生成しない。
 * @boundary Workspace RegistryとRepository Resolverの境界。
 * @security Grant外WorkspaceのExposureを利用側へ開示しない。
 * @compatibility Exposure Revision不一致は利用不能として扱う。
 */
export type CrosExposure = Readonly<{
  workspaceId: string;
  repositoryId: string;
  revision: number;
  active: boolean;
}>;

/**
 * 一Requestで利用するCROS Sessionを定義する。
 *
 * @responsibility 検証済みCredential GrantとSession lifecycleを同じIdentityへ結合する。
 * @trace ARCH-000013
 * @shape Session ID、Credential ID、Workspace集合、管理能力およびactive状態を表す。
 * @invariant close後はRepositoryを解決しない。
 * @boundary AuthenticationとWorkspace Resolutionの境界。
 * @security Credential Secretを保持せず、Workspace Grantだけを持つ。
 * @compatibility Sessionは作成時Credential Snapshotへ固定する。
 */
export type CrosSession = Readonly<{
  sessionId: string;
  credentialId: string;
  workspaceIds: readonly string[];
  systemAdmin: boolean;
  active: boolean;
}>;

/**
 * Context Packageへ含める一項目を定義する。
 *
 * @responsibility 値、Source、Revision、Scopeおよび取得状態を同じ項目へ閉じる。
 * @trace ARCH-000015
 * @shape key、value、sourceId、revision、scopeおよびstateを表す。
 * @invariant 欠測・競合・制限をcompleteへ変換しない。
 * @boundary Repository ProjectionとContext Packageの境界。
 * @security restrictedではvalueとsourceIdをnullにする。
 * @compatibility state語彙を利用側で再定義しない。
 */
export type ContextItem = Readonly<{
  key: string;
  value: unknown | null;
  sourceId: string | null;
  revision: string | null;
  scope: string;
  state: "complete" | "missing" | "restricted" | "conflicting";
}>;

/**
 * 目的限定Context Packageを定義する。
 *
 * @responsibility Package Identity、目的、項目および消費状態を保持する。
 * @trace ARCH-000015
 * @shape packageId、purpose、itemsおよびretainedAsSourceOfTruthを表す。
 * @invariant Packageを永続正本として扱わない。
 * @boundary FederationとConsumerの境界。
 * @security 許可された最小項目だけを含める。
 * @compatibility ConsumerはSourceへ戻れるRelationを保持する。
 */
export type ContextPackage = Readonly<{
  packageId: string;
  purpose: string;
  items: readonly ContextItem[];
  retainedAsSourceOfTruth: false;
}>;

/**
 * CROS Handoffを定義する。
 *
 * @responsibility Task／Project／Revision／Authority／必須Contextを同じHandoff Identityへ固定する。
 * @trace ARCH-000015
 * @shape handoffId、Task、Project、Revision、Authority、ContextおよびSource状態を表す。
 * @invariant DestinationはSource Authorityを拡大しない。
 * @boundary Source RuntimeとDestination Runtimeの境界。
 * @security Credential Secretや未許可Contextを含めない。
 * @compatibility 再入場時もhandoffIdとRevisionを維持する。
 */
export type CrosHandoff = Readonly<{
  handoffId: string;
  taskId: string;
  projectId: string;
  revision: string;
  authorities: readonly string[];
  requiredContext: Readonly<Record<string, string>>;
  sourceActive: false;
}>;

/**
 * 検証済みCredentialからRequest Sessionを作成する。
 *
 * @responsibility 失効していないCredentialのWorkspace GrantだけをSession Snapshotへ搬送する。
 * @trace ARCH-000013
 * @input sessionId: 新Session Identity、credential: 検証済みCredential Record。
 * @returns activeなCrosSession、または不正入力時null。
 * @precondition sessionIdとcredentialIdが空でない。
 * @postcondition Sessionは作成時Workspace集合の不変copyを持つ。
 * @effect N/A: Process内の不変Session値だけを作成する。
 * @failure 失効または不正Credentialはnullで拒否する。
 * @invariant systemAdminからWorkspaceを追加しない。
 * @boundary Credential Verifier→Request Access Context。
 * @security SecretをSessionへ保存しない。
 * @concurrency N/A: 一つのCredential Snapshotを同期変換する。
 */
export function createCrosSession(
  sessionId: string,
  credential: CrosCredential,
): CrosSession | null {
  if (!sessionId || !credential.credentialId || credential.revoked) return null;
  return Object.freeze({
    sessionId,
    credentialId: credential.credentialId,
    workspaceIds: Object.freeze([...new Set(credential.workspaceIds)]),
    systemAdmin: credential.systemAdmin,
    active: true,
  });
}

/**
 * CROS Sessionを失効させる。
 *
 * @responsibility Session Grantを同じIdentityのinactive状態へ遷移させる。
 * @trace ARCH-000013
 * @input session: 現在のSession Snapshot。
 * @returns active=falseのSession。
 * @precondition Session Identityが空でない。
 * @postcondition Workspace集合を保持するが利用可能性は失う。
 * @effect N/A: Process内の不変値だけを置換する。
 * @failure N/A: 有効なSession型は常に閉じられる。
 * @invariant close後にGrantを再発行しない。
 * @boundary Session lifecycleの終了境界。
 * @security close後のContent Accessを拒否できる状態を返す。
 * @concurrency N/A: 呼出し側がSession Snapshot交換を所有する。
 */
export function closeCrosSession(session: CrosSession): CrosSession {
  return Object.freeze({ ...session, active: false });
}

/**
 * Session GrantとExposureからRepositoryを解決する。
 *
 * @responsibility Content Access、Exposure、Repository登録を順番に検証し、非開示拒否を返す。
 * @trace ARCH-000013
 * @input session: Request Session、requestedRepositoryId: 対象Identity、exposures: 公開関係、repositories: 登録集合。
 * @returns availableなRepository、またはIdentityを含まないrestricted結果。
 * @precondition Resolver入力は同じRegistry Snapshotから取得する。
 * @postcondition 許可済みRepositoryだけを返す。
 * @effect N/A: Registry Snapshotを読取り、変更しない。
 * @failure inactive、Grant外、Exposure外、未登録を同じrestrictedへ閉じる。
 * @invariant systemAdminだけではContent Accessを許可しない。
 * @boundary Session→Workspace→Exposure→Repository Projection。
 * @security 拒否結果へRepository名、Path、存在または件数を含めない。
 * @concurrency Registry Revisionは呼出し側Snapshotで固定する。
 */
export function resolveRepository(
  session: CrosSession,
  requestedRepositoryId: string,
  exposures: readonly CrosExposure[],
  repositories: readonly CrosRepository[],
):
  | Readonly<{ status: "available"; repository: CrosRepository }>
  | Readonly<{ status: "restricted" }> {
  if (!session.active) return Object.freeze({ status: "restricted" });
  const isExposed = exposures.some(
    (entry) =>
      entry.active &&
      entry.repositoryId === requestedRepositoryId &&
      session.workspaceIds.includes(entry.workspaceId),
  );
  const repository = isExposed
    ? repositories.find((entry) => entry.repositoryId === requestedRepositoryId)
    : undefined;
  return repository
    ? Object.freeze({ status: "available", repository })
    : Object.freeze({ status: "restricted" });
}

/**
 * 目的限定Context Packageを生成する。
 *
 * @responsibility 許可済みScopeだけを複製し、欠測・競合・制限とprovenanceを保持する。
 * @trace ARCH-000015
 * @input packageId: Package Identity、purpose: 目的、allowedScopes: 許可範囲、items: Projection項目。
 * @returns 永続正本ではないContextPackage。
 * @precondition Identity、目的およびScopeが空でない。
 * @postcondition restricted項目のvalueとsourceIdはnullとなる。
 * @effect N/A: 入力Snapshotから一時的な不変値を生成する。
 * @failure 不正入力は例外で拒否し、部分Packageを返さない。
 * @invariant Scope外項目と推測補完値を含めない。
 * @boundary Repository Projection→Context Package→Consumer。
 * @security 許可されないScopeおよびrestricted Source Identityを除外する。
 * @concurrency N/A: 不変Snapshotの同期変換である。
 */
export function createContextPackage(
  packageId: string,
  purpose: string,
  allowedScopes: readonly string[],
  items: readonly ContextItem[],
): ContextPackage {
  if (!packageId || !purpose || allowedScopes.some((scope) => !scope))
    throw new Error("cros_context_package_input_invalid");
  const includedItems = items
    .filter((item) => allowedScopes.includes(item.scope))
    .map((item) =>
      item.state === "restricted"
        ? Object.freeze({
            ...item,
            value: null,
            sourceId: null,
            revision: null,
          })
        : Object.freeze({ ...item }),
    );
  return Object.freeze({
    packageId,
    purpose,
    items: Object.freeze(includedItems),
    retainedAsSourceOfTruth: false,
  });
}

/**
 * Source RuntimeからHandoff Recordを発行する。
 *
 * @responsibility 同じTask／Project／Revisionと許可済みAuthorityを固定し、Source所有を終了する。
 * @trace ARCH-000015
 * @input Handoff Identity、Task、Project、Revision、Authorityおよび必須Context。
 * @returns sourceActive=falseのCrosHandoff。
 * @precondition Identity、Revisionおよび必須Contextが欠落しない。
 * @postcondition AuthorityとContextは不変copyとなる。
 * @effect N/A: 搬送Recordを構築するだけでDestination Effectを発行しない。
 * @failure 欠落入力は例外で拒否する。
 * @invariant SourceとDestinationの二重所有を許可しない。
 * @boundary Source Runtime→Handoff Record。
 * @security Credential Secretを受け取らずAuthority名だけを搬送する。
 * @concurrency Handoff Identityは呼出し側が一意に発行する。
 */
export function createHandoff(
  handoffId: string,
  taskId: string,
  projectId: string,
  revision: string,
  authorities: readonly string[],
  requiredContext: Readonly<Record<string, string>>,
): CrosHandoff {
  if (
    !handoffId ||
    !taskId ||
    !projectId ||
    !revision ||
    Object.keys(requiredContext).length === 0 ||
    Object.values(requiredContext).some((value) => !value)
  )
    throw new Error("cros_handoff_input_invalid");
  return Object.freeze({
    handoffId,
    taskId,
    projectId,
    revision,
    authorities: Object.freeze([...new Set(authorities)]),
    requiredContext: Object.freeze({ ...requiredContext }),
    sourceActive: false,
  });
}

/**
 * Destination RuntimeでHandoffへ再入場する。
 *
 * @responsibility Identity、Revision、必須ContextおよびAuthority非拡大を照合して再開可否を返す。
 * @trace ARCH-000015
 * @input handoff: 搬送Record、destination: Destinationが観測した期待値。
 * @returns resumedまたはblockedと、同じhandoffIdおよびEffect有無。
 * @precondition Destinationは独立したRuntime Snapshotで照合する。
 * @postcondition 正常時だけDestination Effectを一回許可する。
 * @effect resumed時だけDestination開始Effectを許可する結果を返す。
 * @failure 不一致、欠落またはAuthority追加をblockedかつEffect 0へ閉じる。
 * @invariant Handoff IdentityとRevisionを再発行・補完しない。
 * @boundary Handoff Record→Destination Runtime。
 * @security SourceにないAuthorityをDestinationへ付与しない。
 * @concurrency 同じHandoffの重複消費防止はDestination Storeが所有する。
 */
export function resumeHandoff(
  handoff: CrosHandoff,
  destination: Readonly<{
    taskId: string;
    projectId: string;
    revision: string;
    authorities: readonly string[];
    requiredContext: Readonly<Record<string, string>>;
  }>,
): Readonly<{
  status: "resumed" | "blocked";
  handoffId: string;
  reason:
    | "cros_handoff_resumed"
    | "cros_handoff_context_mismatch"
    | "cros_handoff_authority_expansion";
  destinationEffectIssued: boolean;
}> {
  const isAuthorityExpanded = destination.authorities.some(
    (authority) => !handoff.authorities.includes(authority),
  );
  if (isAuthorityExpanded)
    return Object.freeze({
      status: "blocked",
      handoffId: handoff.handoffId,
      reason: "cros_handoff_authority_expansion",
      destinationEffectIssued: false,
    });
  const contextMatches =
    destination.taskId === handoff.taskId &&
    destination.projectId === handoff.projectId &&
    destination.revision === handoff.revision &&
    Object.entries(handoff.requiredContext).every(
      ([key, value]) => destination.requiredContext[key] === value,
    );
  return contextMatches
    ? Object.freeze({
        status: "resumed",
        handoffId: handoff.handoffId,
        reason: "cros_handoff_resumed",
        destinationEffectIssued: true,
      })
    : Object.freeze({
        status: "blocked",
        handoffId: handoff.handoffId,
        reason: "cros_handoff_context_mismatch",
        destinationEffectIssued: false,
      });
}

/**
 * Repository-local操作を任意CROS状態から独立して実行する。
 *
 * @responsibility CROS未設定・停止・利用可能の全状態を同じRepository操作Contractへ接続する。
 * @trace ARCH-000009
 * @input crosState: 任意接続状態、operationId: 操作Identity、currentValue: 現在値、nextValue: 更新値。
 * @returns 同じ操作Contractと更新値、CROS Effect有無を返す。
 * @precondition operationIdが空でない。
 * @postcondition 全CROS状態で同じrepositoryResultを返す。
 * @effect Repository-local値だけを更新し、CROS Effectは発行しない。
 * @failure 不正Identityは例外で拒否する。
 * @invariant CROS可用性をRepository-local作業の成立条件にしない。
 * @boundary Repository-local入口→任意CROS接続→同一Repository契約。
 * @security CROS接続状態から追加Authorityを生成しない。
 * @concurrency N/A: 固定入力の同期変換である。
 */
export function executeRepositoryLocalOperation(
  crosState: "unconfigured" | "stopped" | "available",
  operationId: string,
  currentValue: string,
  nextValue: string,
): Readonly<{
  contract: "crdd/repository-local-operation";
  operationId: string;
  repositoryResult: string;
  crosState: "unconfigured" | "stopped" | "available";
  crosEffectIssued: false;
  outsideRepositoryEffectIssued: false;
}> {
  if (!operationId) throw new Error("repository_local_operation_id_invalid");
  return Object.freeze({
    contract: "crdd/repository-local-operation",
    operationId,
    repositoryResult: currentValue === nextValue ? currentValue : nextValue,
    crosState,
    crosEffectIssued: false,
    outsideRepositoryEffectIssued: false,
  });
}

/**
 * AI入口固有制約とCanonical Sourceから行動計画を解決する。
 *
 * @responsibility 複数AI入口を同じCanonical Revisionへ接続し、差を入口固有Constraintだけへ限定する。
 * @trace ARCH-000009
 * @input entryId: AI入口、sourceId: Canonical Source、revision: 対象Revision、commonSteps: 共通計画、entryConstraints: 入口固有制約。
 * @returns Canonical Relationと入口固有差分を分離した計画。
 * @precondition IdentityとRevisionが空でない。
 * @postcondition commonStepsは全入口で同じ順序を保つ。
 * @effect N/A: 読取り計画だけを返し、Repositoryを変更しない。
 * @failure 不正Identityは例外で拒否する。
 * @invariant 共通規範を入口内で再定義しない。
 * @boundary AI入口→共通規範→Canonical Source→行動計画。
 * @security 計画解決から実行Authorityを発行しない。
 * @concurrency N/A: 不変入力の同期変換である。
 */
export function resolveAiOperatingPlan(
  entryId: string,
  sourceId: string,
  revision: string,
  commonSteps: readonly string[],
  entryConstraints: readonly string[],
): Readonly<{
  entryId: string;
  sourceId: string;
  revision: string;
  commonSteps: readonly string[];
  entryConstraints: readonly string[];
  authorityIssued: false;
  canonicalSourceEffectIssued: false;
}> {
  if (!entryId || !sourceId || !revision)
    throw new Error("cros_ai_operating_plan_input_invalid");
  return Object.freeze({
    entryId,
    sourceId,
    revision,
    commonSteps: Object.freeze([...commonSteps]),
    entryConstraints: Object.freeze([...entryConstraints]),
    authorityIssued: false,
    canonicalSourceEffectIssued: false,
  });
}
