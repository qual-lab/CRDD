/**
 * RESTとMCPを既存のアクセス管理へ接続する。
 * @packageDocumentation
 * @responsibility アクセス管理操作と現在許可されたRepositoryの実体を接続する。認可の判断・保存はAccess Managementが所有する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @trace ARCH-000017
 * @boundary 通信受付の当該要求とAccess Management・Version Control。
 */
import { randomUUID } from "node:crypto";
import type { PortfolioProjection } from "@qual-lab/crdd-document-model";
import type { CredentialAdministrationSnapshot } from "@qual-lab/crdd-access-management";
import {
  readCredentialAdministrationState,
  issueCredential,
  revokeCredential,
  exchangeCredentials,
  finishKeyExchange,
  updateCredentialPresentationState,
  resolveConnectionAuthentication,
  confirmInitialConnection,
  resolveRepositoryAccess,
  registerRepository,
  registerUser,
  unregisterRepository,
  updateExposure,
  updateRoleContentAccess,
  updateUserName,
  updateUserRole,
  type FilesystemStoreRoot,
  type ManagementOperationOutcome,
  type CurrentAccessOutcome,
  type ManagementReadOutcome,
} from "@qual-lab/crdd-access-management";
import {
  getRepository,
  readRepositoryLocation,
  resolveVerifiedRepositoryRoot,
} from "@qual-lab/crdd-version-control";

/**
 * 認可済みの登録要求からexact Git Rootを確認する。
 * @responsibility Gitの配置と現在性はServer側で観測し、AMにはディレクトリと照合処理だけを渡す。
 * @trace ARCH-000013
 * @input AMが現在認可・期待改訂と照合した登録Path。
 * @returns 正規ディレクトリと同じ対象の再確認、又はnull。
 * @precondition AMの登録観測から同期的に呼ばれる。
 * @postcondition Git識別値と技術能力をAMの保存値に含めない。
 * @effect Git配置の読取りだけ。対象Repositoryを書き換えない。
 * @failure 不正・不明はnull、再確認不能はfalse。
 * @invariant 親Repositoryを代替にしない。
 * @boundary Serverの登録接続とVC。
 * @security 要求値によって観測方法を変更しない。
 * @concurrency 最後の照合は初回と同じ対象をfresh観測する。
 */
export function observeRegistrationDirectory(directory: string) {
  const location = readRepositoryLocation(directory);
  if (location === null) return null;
  const root = location.directory;
  return {
    directory: root,
    isCurrent: () => readRepositoryLocation(root)?.directory === root,
  };
}

/**
 * 同Processの管理Rootと現在Bearerを明示する。
 * @responsibility Remote接続や過去の認可Snapshotを管理Authorityへ転用させない。
 * @trace ARCH-000013
 * @shape root、token。
 * @invariant tokenは当該要求のServer memoryだけで、各操作がfresh認可する。CROSのログイン状態としてProcess全体へ保持しない。
 * @boundary 信頼したWorkbench構成Ownerから内部管理Consumer。
 * @security Rootは内部構成だけ。Bearerは検査済み専用接続POST、単一Authorization Header、または限定構成から要求memoryへ渡し、公開結果へ含めない。
 * @compatibility 新AMだけ。旧CROS Registryとの併用・fallbackなし。
 */
export type CredentialAdministration = Readonly<{
  root: FilesystemStoreRoot;
  token: string;
}>;

/**
 * 初回限定資格を確認し、現在の通常接続資格を確定する。
 * @responsibility 初回限定候補だけをAMの確認保存へ接続し、通常認証を取り直す。
 * @trace ARCH-000013
 * @input 信頼した管理Root、受付済み資格、要求Signal。
 * @returns 当該要求内だけで使用する管理Rootと接続資格。内容への認可結果ではない。
 * @precondition 呼出し元が入力形式と接続の利用条件を検査済み。
 * @postcondition 初回相関は内容Authorityへ変換しない。
 * @effect 初回候補だけ確認保存と再認証を行う。
 * @failure 認証・保存不成立または取消は固定例外で拒否する。
 * @invariant 新Session・資格発行・自動再送を追加しない。
 * @boundary 接続受付とAM。
 * @security 秘密・内部Rootを例外やログへ含めない。
 * @concurrency 保存前後の取消を確認し、保存後取消をrollbackとみなさない。
 */
export function confirmLocalCredentialConnection(
  root: FilesystemStoreRoot,
  token: string,
  signal: AbortSignal,
): CredentialAdministration {
  if (signal.aborted) throw new Error("workbench_local_connection_cancelled");
  let authentication = resolveConnectionAuthentication(root, token);
  if (authentication.status === "initial") {
    const confirmed = confirmInitialConnection(
      root,
      token,
      authentication.binding,
      signal,
    );
    if (signal.aborted) throw new Error("workbench_local_connection_cancelled");
    if (confirmed.status !== "completed")
      throw new Error("workbench_local_connection_unavailable");
    authentication = resolveConnectionAuthentication(root, token);
  }
  if (signal.aborted) throw new Error("workbench_local_connection_cancelled");
  if (authentication.status !== "normal")
    throw new Error("workbench_local_connection_unavailable");
  return Object.freeze({ root, token });
}

/**
 * 資格管理操作の結果を表す。
 * @responsibility 鍵提示候補と記録終了・拒否を区別する。
 * @trace ARCH-000013
 * @shape status、operation、reason、非秘密相関。presentingだけtoken。
 * @invariant presentingは保存済み鍵の出力要求で、提示確認・交換全体完了・本人受領ではない。
 * @boundary 許可された送信処理だけに渡し、汎用画面状態へ入れない。
 * @security 秘密はpresentingの一応答だけ。保存・再取得・MCP公開0。
 * @compatibility 最新のissue／revoke／exchange-user／exchange-all契約。
 */
export type CredentialActionResult = Readonly<{
  operation: "issue" | "revoke" | "exchange-user" | "exchange-all";
  reason: string;
  operationId: string;
  userId: string;
  credentialId?: string;
  recoveryId?: string;
  publication?: "not_attempted" | "unconfirmed" | "confirmed";
  cleanupConfirmed?: boolean;
  firstFailure?: string;
  secondaryFailure?: string | null;
  observedRevision?: number | null;
  lastConfirmedOperationId?: string | null;
  lastConfirmedStage?: string;
}> &
  (
    | Readonly<{ status: "presenting"; token: string; credentialId: string }>
    | Readonly<{ status: "completed" | "blocked"; token?: never }>
  );

/**
 * 受付済みの資格管理操作を表す。
 * @responsibility Formや各通信方式の情報を操作に持ち込まない。
 * @trace ARCH-000013
 * @shape 操作、期待改訂、対象User、必要な既存の鍵と確認項目。
 * @invariant 期待改訂と操作対象はAMの現在状態で照合する。
 * @boundary 受付と資格管理操作の間だけ。
 * @security 秘密・管理Rootを入力へ含めない。
 * @compatibility 現行の発行・失効・個別交換・全員交換。
 */
export type CredentialActionCommand = Readonly<{
  operation: CredentialActionResult["operation"];
  expectedRevision: number;
  userId: string;
  oldIds: string[];
  confirmed: boolean;
  credentialId: string;
  previousRecoveryId: string | undefined;
}>;

/**
 * 保存Ownerの未完了事実を非秘密の応答fieldへ写す。
 * @responsibility 最初の失敗と後続清掃不明を分離し、全内部結果を透過しない。
 * @trace ARCH-000013
 * @input 内部保存Ownerの型確認済み結果だけ。
 * @returns 出版・清掃・主副失敗・既知相関の存在するfieldだけ。
 * @precondition arbitrary入力や例外本文を渡さない。
 * @postcondition token・Root・内部Pathを返さない。
 * @effect N/A: 局所投影だけ。
 * @failure N/A: 存在する型fieldだけを選択する。
 * @invariant unavailableから未保存・rollback・Effect0を推定しない。
 * @boundary AM結果と管理POSTの非秘密失敗情報。
 * @security 既存固定理由だけ。例外文字列の公開0。
 * @concurrency 当該要求の結果だけで、共有状態へ蓄積しない。
 */
function credentialFailureFacts(
  result: Readonly<{
    status: string;
    publication?: "not_attempted" | "unconfirmed" | "confirmed";
    cleanupConfirmed?: boolean;
    primaryFailure?: string;
    firstFailure?: string;
    secondaryReason?: string;
    secondaryFailure?: string | null;
    observedRevision?: number | null;
    lastConfirmedOperationId?: string | null;
    lastConfirmedStage?: string;
  }>,
) {
  return {
    ...(result.publication !== undefined
      ? { publication: result.publication }
      : {}),
    ...(result.cleanupConfirmed !== undefined
      ? { cleanupConfirmed: result.cleanupConfirmed }
      : {}),
    ...(result.firstFailure || result.primaryFailure
      ? { firstFailure: result.firstFailure ?? result.primaryFailure }
      : {}),
    ...(result.secondaryFailure !== undefined ||
    result.secondaryReason !== undefined
      ? {
          secondaryFailure:
            result.secondaryFailure ?? result.secondaryReason ?? null,
        }
      : {}),
    ...(result.observedRevision !== undefined
      ? { observedRevision: result.observedRevision }
      : {}),
    ...(result.lastConfirmedOperationId !== undefined
      ? { lastConfirmedOperationId: result.lastConfirmedOperationId }
      : {}),
    ...(result.lastConfirmedStage !== undefined
      ? { lastConfirmedStage: result.lastConfirmedStage }
      : {}),
  };
}

/**
 * 明示した鍵操作と一度限りの提示をAMへ接続する。
 * @responsibility 最新改訂と現在認可をAMへ渡し、送信完了後の提示確認・交換終了まで待つ。
 * @trace ARCH-000013
 * @input 同Process管理資格、受付済み操作、取消Signal、送信結果を返す当該要求の関数。
 * @returns N/A: 一応答と開始済み後処置を完了する。
 * @precondition 呼出し元が受付条件と応答可否を検査済み。送信側は完了を観測した場合だけtrueを返す。
 * @postcondition 汎用状態に秘密なし、再表示なし。保存後不明は既知Effectを保持する。
 * @effect AM保存・提示前後の別出版、用途限定の一応答、交換だけrecord整理。
 * @failure 認可／競合／保存不明は非秘密停止、提示未確認ではconfirmed／finish0。
 * @invariant 提示は元相関、終了は操作対象に応じた有効管理者鍵でfresh認証する。Hostへのfallback0。
 * @boundary 信頼された内部受付、AM保存Owner、当該要求の送信処理。
 * @security 生鍵をServer共有変数・Log・GETへ保持しない。
 * @concurrency 新要求を自動再実行せず、取消後に新Effectを開始しない。
 */
export async function executeCredentialAction(
  administration: CredentialAdministration,
  command: CredentialActionCommand,
  signal: AbortSignal,
  deliver: (value: CredentialActionResult) => Promise<boolean>,
): Promise<void> {
  if (command.operation === "exchange-all" && !command.confirmed)
    throw new Error("workbench_credential_confirmation_required");
  if (signal.aborted) return;
  const observed = readCredentialAdministrationState(
    administration.root,
    administration.token,
  );
  if (
    observed.status !== "completed" ||
    observed.snapshot.revision !== command.expectedRevision ||
    !observed.snapshot.users.some(
      (user) =>
        user.userId === command.userId &&
        (command.operation !== "exchange-all" || user.role === "administrator"),
    )
  )
    throw new Error("workbench_credential_state_unavailable");
  const previous = observed.snapshot.exchange;
  const operationId =
    command.operation.startsWith("exchange-") &&
    previous &&
    previous.stage !== "credential_stored"
      ? previous.operationId
      : randomUUID();
  const base = {
    operation: command.operation,
    operationId,
    userId: command.userId,
  };
  let token: string | null = null,
    credentialId: string | null = null,
    recoveryId: string | null = null;
  let completionToken: string | null = null;
  let revision = command.expectedRevision;
  try {
    if (command.operation === "revoke") {
      const result = revokeCredential(
        administration.root,
        administration.token,
        revision,
        operationId,
        command.userId,
        command.credentialId,
      );
      await deliver({
        ...base,
        status: result.status === "completed" ? "completed" : "blocked",
        reason:
          result.status === "completed"
            ? "credential_revoked"
            : "credential_action_unconfirmed",
        credentialId: command.credentialId,
        ...(result.status !== "completed"
          ? credentialFailureFacts(result)
          : {}),
      });
      return;
    }
    if (command.operation === "issue") {
      const result = issueCredential(
        administration.root,
        administration.token,
        revision,
        operationId,
        command.userId,
      );
      if (
        result.status !== "completed" ||
        result.operation !== "issueCredential"
      ) {
        await deliver({
          ...base,
          status: "blocked",
          reason: "credential_action_unconfirmed",
          ...credentialFailureFacts(result),
        });
        return;
      }
      token = result.token;
      credentialId = result.credentialId;
      revision = result.revision;
    } else {
      if (
        previous?.stage === "credential_stored" &&
        previous.presentation === "confirmed"
      ) {
        const finished = finishKeyExchange(
          administration.root,
          administration.token,
          revision,
          operationId,
          previous.recoveryId,
        );
        await deliver({
          ...base,
          status: finished.status === "completed" ? "completed" : "blocked",
          reason:
            finished.status === "completed"
              ? "previous_exchange_record_closed_no_new_exchange"
              : "credential_action_unconfirmed",
          recoveryId: previous.recoveryId,
          userId: previous.recipientUserId,
          ...(finished.status !== "completed"
            ? credentialFailureFacts(finished)
            : {}),
        });
        return;
      }
      const result = exchangeCredentials(
        administration.root,
        administration.token,
        revision,
        operationId,
        command.operation === "exchange-all" ? "all" : "targeted",
        command.userId,
        command.oldIds,
        command.confirmed,
        command.previousRecoveryId,
      );
      if (result.status !== "completed" || result.token === null) {
        await deliver({
          ...base,
          status: "blocked",
          reason: "credential_action_unconfirmed",
          ...credentialFailureFacts(result),
          ...("recoveryId" in result && result.recoveryId
            ? { recoveryId: result.recoveryId }
            : {}),
        });
        return;
      }
      token = result.token;
      credentialId = result.credentialId;
      recoveryId = result.recoveryId;
      revision = result.revision;
      completionToken =
        command.operation === "exchange-all" ||
        command.userId === observed.snapshot.actorUserId
          ? result.token
          : administration.token;
    }
    if (signal.aborted) return;
    const started = updateCredentialPresentationState(administration.root, {
      credentialId,
      issuanceOperationId: operationId,
      expectedRevision: revision,
      target: "unconfirmed",
    });
    if (started.status !== "completed") {
      await deliver({
        ...base,
        status: "blocked",
        reason: "credential_presentation_not_started",
        ...credentialFailureFacts(started),
        credentialId,
        ...(recoveryId ? { recoveryId } : {}),
      });
      return;
    }
    const pending = deliver({
      ...base,
      status: "presenting",
      reason: "stored_key_response",
      credentialId,
      token,
      ...(recoveryId ? { recoveryId } : {}),
    });
    token = null;
    if (!(await pending) || signal.aborted) return;
    const confirmed = updateCredentialPresentationState(administration.root, {
      credentialId,
      issuanceOperationId: operationId,
      expectedRevision: started.value.revision,
      target: "confirmed",
      presentationOperationId: started.value.presentationOperationId,
    });
    if (confirmed.status !== "completed" || signal.aborted || !recoveryId)
      return;
    if (completionToken !== null)
      finishKeyExchange(
        administration.root,
        completionToken,
        confirmed.value.revision,
        randomUUID(),
        recoveryId,
      );
  } finally {
    token = null;
    completionToken = null;
  }
}

/**
 * 管理readの対象を固定する。
 * @responsibility 本人と他ユーザー管理の種類を混同しない。
 * @trace ARCH-000013
 * @shape current／users／roles／repositories／exposure。
 * @invariant 鍵と初回状態を含めない。
 * @boundary 表示GETと管理Reader。
 * @security 任意Pathを対象指定にしない。
 * @compatibility 現行本人と四管理readだけ。
 */
export type ManagementView =
  | "current"
  | "users"
  | "roles"
  | "repositories"
  | "exposure";
/**
 * AM共通結果とTransportだけの未取得を表示へ渡す。
 * @responsibility 意味Ownerの型を再利用し、Transport非提供を成功にしない。
 * @trace ARCH-000013
 * @shape AM三結果Unionと未構成。
 * @invariant Transport理由をAM保存結果へ戻さない。
 * @boundary 非秘密の管理表示。
 * @security 新しい秘密・回復参照なし。
 * @compatibility AM共通結果の現行版だけ。
 */
export type ManagementResult =
  | CurrentAccessOutcome
  | ManagementReadOutcome
  | ManagementOperationOutcome
  | Readonly<{
      status: "unavailable";
      reason: "management_not_configured";
    }>;

export type ManagementWriteOperation =
  | "registerUser"
  | "updateUserName"
  | "updateUserRole"
  | "updateRoleContentAccess"
  | "registerRepository"
  | "unregisterRepository"
  | "updateExposure";

/**
 * 受付済みの操作をAccess Managementへ一回委譲する。
 * @responsibility 相関ID・期待改訂・操作結果を変更せず、通信固有の認可・取消を増減しない。
 * @trace ARCH-000013
 * @boundary Rootと資格は構成元が確定済み。Repository登録を公開する入口はHTTPだけ。
 */
export function executeManagementOperation(
  { root, token }: Readonly<{ root: FilesystemStoreRoot; token: string }>,
  operation: ManagementWriteOperation,
  args: Readonly<Record<string, unknown>>,
  expectedRevision: number,
  operationId: string,
): ManagementOperationOutcome {
  switch (operation) {
    case "registerUser":
      return registerUser(
        root,
        token,
        expectedRevision,
        operationId,
        args.username as string,
        args.plannedRole,
      );
    case "updateUserName":
      return updateUserName(
        root,
        token,
        expectedRevision,
        operationId,
        args.userId as string,
        args.username as string,
      );
    case "updateUserRole":
      return updateUserRole(
        root,
        token,
        expectedRevision,
        operationId,
        args.userId as string,
        args.currentRole,
        args.nextRole,
      );
    case "updateRoleContentAccess":
      return updateRoleContentAccess(
        root,
        token,
        expectedRevision,
        operationId,
        args.targetRole,
        args.workspaceIds,
      );
    case "registerRepository":
      return registerRepository(
        root,
        token,
        expectedRevision,
        operationId,
        args.repositoryId,
        args.repositoryRoot,
        observeRegistrationDirectory,
      );
    case "unregisterRepository":
      return unregisterRepository(
        root,
        token,
        expectedRevision,
        operationId,
        args.repositoryId,
      );
    case "updateExposure":
      return updateExposure(
        root,
        token,
        expectedRevision,
        operationId,
        args.repositoryId,
        args.workspaceIds,
      );
  }
}

/**
 * 共有接続の開発対象と同じ対象を再確認する関数を返す。
 * @responsibility development認可とRepository実体の現在性を結び付ける。
 * @trace ARCH-000012
 * @trace ARCH-000017
 * @boundary 要求専用。通信の取消・応答とCoordinatorによる処置は各操作が担当する。
 */
export function resolveSharedDevelopmentAccess(
  root: FilesystemStoreRoot,
  token: string,
  repositoryId: string,
  signal: AbortSignal,
) {
  const initial = resolveRepositoryAccess(
    root,
    token,
    repositoryId,
    "development",
  );
  if (initial.status !== "completed") return null;
  const ownerRoot = initial.access.root;
  const repository = getRepository(ownerRoot);
  if (repository.status !== "completed") return null;
  return {
    ownerRoot,
    projectId: initial.access.manifest.projectId,
    revision: initial.access.revision,
    authorize: () => {
      const fresh = resolveRepositoryAccess(
        root,
        token,
        repositoryId,
        "development",
      );
      return (
        !signal.aborted &&
        fresh.status === "completed" &&
        fresh.access.revision === initial.access.revision &&
        fresh.access.bindingId === initial.access.bindingId &&
        JSON.stringify(fresh.access.manifest) ===
          JSON.stringify(initial.access.manifest) &&
        fresh.access.root === ownerRoot &&
        resolveVerifiedRepositoryRoot(repository.capability) === ownerRoot
      );
    },
  };
}

/**
 * 現在管理者の非秘密資格管理投影を画面へ取得する。
 * @responsibility 同Process AMへ委譲し、未構成と現在未取得を区別する。
 * @trace ARCH-000013
 * @input 同Processの検証済みRootとServer memoryの接続資格、または未構成。
 * @returns availabilityと非秘密Snapshot。
 * @precondition 要求専用の認可済みReaderだけを構成する。
 * @postcondition 生鍵・内部保存情報を画面Modelへ入れない。
 * @effect AM既存Readerの排他・現在認証・既知材料処置。
 * @failure 認証・清掃・解放不明はSnapshot nullのunavailable。
 * @invariant 空一覧を取得失敗や操作Authorityの代替にしない。
 * @boundary AM保存OwnerとBrowser通常GET。
 * @security Secret・Root・資格材料を公開しない。
 * @concurrency 各GETで現在認可を再評価し、過去投影をcacheしない。
 */
export function readCredentialAdministrationView(
  administration: CredentialAdministration | undefined,
): CredentialAdministrationView {
  if (administration === undefined)
    return Object.freeze({
      state: "not_configured",
      snapshot: null,
    });
  const listed = readCredentialAdministrationState(
    administration.root,
    administration.token,
  );
  if (listed.status !== "completed")
    return Object.freeze({
      state: "unavailable",
      snapshot: null,
    });
  return Object.freeze({
    state: "available",
    snapshot: listed.snapshot,
  });
}

/**
 * 資格管理の非秘密表示だけを汎用画面へ渡す。
 * @responsibility 一改訂の対象候補と交換相関を表示し、鍵提示応答を保持しない。
 * @trace ARCH-000013
 * @shape state、snapshot。未構成／未取得はsnapshot null。
 * @invariant snapshotは操作Authorityでも過去完了証明でもない。
 * @boundary AM非秘密投影とBrowser通常GET。
 * @security 生鍵・Verifier・salt・Root・Remote Bearerなし。
 * @compatibility 最新User／Role結合だけ。旧profile/systemAdmin契約は廃止する。
 */
export type CredentialAdministrationView = Readonly<{
  state: "not_configured" | "unavailable" | "available";
  snapshot: CredentialAdministrationSnapshot | null;
}>;

/**
 * 現在の接続と公開可能な表示情報を接続画面へ投影する。
 * @responsibility HTTPの受付・応答を扱わず、既存の資格管理表示だけを観測する。
 * @trace ARCH-000012
 * @boundary 渡された接続に限定。資格や認可結果を公開しない。
 */
export function createAccessViewResponse(
  actionToken: string,
  notice: string | null,
  portfolio: PortfolioProjection | null,
  credentialAdministration: CredentialAdministration | undefined,
): AccessViewResponse {
  return Object.freeze({
    contract: "crdd/workbench/view/v1",
    view: "access",
    actionToken,
    authenticated: credentialAdministration !== undefined,
    notice,
    portfolio,
    credentials: readCredentialAdministrationView(credentialAdministration),
  });
}

/**
 * Local CROSの接続と管理だけを表示するModel。
 * @responsibility 未認証や内容未選択を架空のRepository主画面へ変換しない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @shape access判別子、非秘密接続状態、Portfolioと資格管理投影。
 * @invariant 未認証時はPortfolioなし・資格一覧なし。
 * @boundary Workbench接続用JSONとCSR画面。
 * @security 入力済み鍵、Host Root、Verifierを保持しない。
 * @compatibility 現行client-model/v1内の追加variant。
 */
export type AccessViewResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "access";
  actionToken: string;
  authenticated: boolean;
  notice: string | null;
  portfolio: PortfolioProjection | null;
  credentials: CredentialAdministrationView;
}>;
