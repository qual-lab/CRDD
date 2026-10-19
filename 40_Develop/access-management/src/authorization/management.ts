/**
 * 管理操作の現在認可と対象別の非秘密結果を提供する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { types } from "node:util";
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  authenticateNormalConnection,
  resolveCredentialAuthentication,
} from "../credential/authentication.ts";
import { readCredentialId } from "../credential/token.ts";
import type { AuthenticatedRequest } from "../credential/types.ts";
import type {
  ManagementPermission,
  ManagementReadKind,
  ManagementReadOutcome,
  ManagementStateResult,
  ManagementStateSnapshot,
} from "../permission/types.ts";
import type { RepositoryExposureManagementResult } from "../repository/types.ts";
import type { AccessRole } from "../role/types.ts";
import { locked, readCurrent, settlePending } from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import type { UserRoleManagementResult } from "../user/types.ts";

/**
 * 管理要求の対象制約を含む固定Role判定を行う。
 *
 * @responsibility administrator専用境界とmanagerの通常管理範囲を、操作固有対象から判定する。
 * @trace ARCH-000013
 * @input 現要求で解決したactorRoleと、操作別の閉じたrequest。
 * @returns 固定分担のallowed、deniedまたは入力不正のinvalid。
 * @precondition 呼出し側は認証・現在改訂・対象存在を別に確認する。値の形式は本関数も検査する。
 * @postcondition 不明Role、余分field、accessor、Proxyを許可へ丸めない。
 * @effect N/A: 値を読む同期計算だけで、Filesystem・資格・Repositoryを操作しない。
 * @failure 不正入力はinvalid、有効入力の固定権限不足はdenied。外部故障を所有しない。
 * @invariant 内容権限設定、対象Identity、Host信頼をRoleの固定分担へ転用しない。
 * @boundary 通常管理の純粋判定と、現在認証・保存・実操作の呼出し側の境界。
 * @security allowedはCapabilityではない。処置時には現在認可と操作固有条件を再確認する。
 * @concurrency N/A: 共有状態を持たず、古いRoleの再利用可否は呼出し側が判定する。
 */
export function evaluateManagementPermission(
  actorRole: unknown,
  request: unknown,
): ManagementPermission {
  if (!isAccessRole(actorRole)) return "invalid";
  if (request === null || typeof request !== "object" || types.isProxy(request))
    return "invalid";
  const prototype = Object.getPrototypeOf(request);
  if (prototype !== Object.prototype && prototype !== null) return "invalid";
  const descriptors = Object.getOwnPropertyDescriptors(request);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) return "invalid";
  if (
    Object.values(descriptors).some(
      (descriptor) => !Object.hasOwn(descriptor, "value"),
    )
  )
    return "invalid";
  const operation: unknown = descriptors.operation?.value;
  let targetRequiresAdministrator = false;
  let expectedKeys: readonly string[];
  switch (operation) {
    case "registerUser": {
      const plannedRole: unknown = descriptors.plannedRole?.value;
      if (!isAccessRole(plannedRole)) return "invalid";
      expectedKeys = ["operation", "plannedRole"];
      targetRequiresAdministrator = plannedRole === "administrator";
      break;
    }
    case "updateUserName":
    case "updateRoleContentAccess": {
      const targetRole: unknown = descriptors.targetRole?.value;
      if (!isAccessRole(targetRole)) return "invalid";
      expectedKeys = ["operation", "targetRole"];
      targetRequiresAdministrator =
        operation === "updateRoleContentAccess" &&
        targetRole === "administrator";
      break;
    }
    case "updateUserRole": {
      const currentRole: unknown = descriptors.currentRole?.value;
      const nextRole: unknown = descriptors.nextRole?.value;
      if (!isAccessRole(currentRole) || !isAccessRole(nextRole))
        return "invalid";
      expectedKeys = ["operation", "currentRole", "nextRole"];
      targetRequiresAdministrator =
        currentRole === "administrator" || nextRole === "administrator";
      break;
    }
    case "registerRepository":
    case "unregisterRepository":
    case "updateExposure":
    case "manageAiProfiles":
      expectedKeys = ["operation"];
      break;
    case "issueCredential":
    case "revokeCredential":
    case "exchangeCredentials":
      expectedKeys = ["operation"];
      targetRequiresAdministrator = true;
      break;
    default:
      return "invalid";
  }
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => !expectedKeys.includes(key as string))
  )
    return "invalid";
  if (actorRole === "developer") return "denied";
  if (actorRole === "manager" && targetRequiresAdministrator) return "denied";
  return "allowed";
}

/**
 * 値が採用済み三Roleの識別子か判定する。
 *
 * @responsibility 未知Roleを既定Roleへ変換せず拒否する。
 * @trace ARCH-000013
 * @input 信頼していないRole値。
 * @returns 三Roleのいずれかである場合だけtrue。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 入力を変更・正規化しない。
 * @effect N/A: primitiveの等値比較だけを行う。
 * @failure N/A: 値比較に外部故障はない。
 * @invariant management等の旧識別子を互換受理しない。
 * @boundary 同FileのRole形式検査。
 * @security Roleの実在・認証・現在性は確認しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function isAccessRole(value: unknown): value is AccessRole {
  return (
    value === "developer" || value === "manager" || value === "administrator"
  );
}

/**
 * 現在Roleの許可・拒否と認証状態の観測不能を分ける。
 * @responsibility 認証不成立をdeveloper拒否に畳まず、非秘密の判定だけを返す。
 * @trace ARCH-000013
 * @shape allowed、denied、unavailableの閉じた判定値。
 * @invariant Catalog存在・User・Role・改訂・資格材料を含めない。
 * @boundary AM現在認可からProfile管理Consumer。
 * @security 値は次要求へ再利用可能なCapabilityではない。
 * @compatibility 旧systemAdmin契約へfallbackしない。
 */
export type AiProfileManagementPermission =
  | "allowed"
  | "denied"
  | "unavailable";

/**
 * 一要求の共有Profile管理可否を現在資格から解決する。
 * @responsibility 初回完了済みの現在資格・Roleを同じ管理改訂から照合する。
 * @trace ARCH-000013
 * @input 既存保存Ownerが検証した管理Rootと要求専用Bearer。
 * @returns manager／administratorはallowed、developerはdenied、認証・状態未確認はunavailable。
 * @precondition 呼出し元は完全入力検査・開始前取消を確認する。
 * @postcondition AM Lock解放確認後だけ判定を返し、Catalogには触れない。
 * @effect 既存通常認証の状態読取り・Lock・KDF・確認済み短命材料清掃のみ。
 * @failure 失効・不正資格・初回未完了・保存／解放不明はunavailable。
 * @invariant 管理許可から内容権限・鍵操作・Provider実行を生成しない。
 * @boundary AM通常認証→純粋Role判定。Catalog操作はConsumer側の別Owner。
 * @security Token・内部Path・本人情報を結果へ渡さない。
 * @concurrency 要求毎に再観測し、認可後のRole変更は次要求へ反映する。二Storeの原子性は保証しない。
 */
export function evaluateAiProfileManagementPermission(
  root: FilesystemStoreRoot,
  token: string,
): AiProfileManagementPermission {
  const authentication = authenticateNormalConnection(root, token);
  if (authentication.status !== "completed") return "unavailable";
  const permission = evaluateManagementPermission(
    authentication.snapshot.role,
    {
      operation: "manageAiProfiles",
    },
  );
  return permission === "invalid" ? "unavailable" : permission;
}

/**
 * 管理対象のprimitive識別子を検査する。
 * @responsibility 未知値・Proxy・暗黙変換を状態観測前に拒否する。
 * @trace ARCH-000013
 * @input 信頼しない対象種類値。
 * @returns 固定四literalだけtrue。
 * @precondition N/A: 任意値を検査する。
 * @postcondition getter・変換関数を実行せず入力を変更しない。
 * @effect N/A: primitive等値比較だけ。
 * @failure 不正値はfalse。外部故障を所有しない。
 * @invariant 対象種類を既定値で補完しない。
 * @boundary 管理読取りの入力検査。
 * @security trueは認証・参照許可ではない。
 * @concurrency N/A: 同期局所検査だけ。
 */
export function isManagementReadKind(
  value: unknown,
): value is ManagementReadKind {
  return (
    value === "users" ||
    value === "roleContentAccess" ||
    value === "registeredRepositories" ||
    value === "exposure"
  );
}

/**
 * 同一改訂の現在管理認可を対象別の所有DTOへ投影する。
 * @responsibility 固定対象Role判定を適用し管理範囲だけを返す。
 * @trace ARCH-000013
 * @input 完全検査済み状態、そこから認証した本人、検査済みkind。
 * @returns 許可対象の凍結済みDTO、または非開示拒否のnull。
 * @precondition 保存Ownerが同じLock下でSchema・本人改訂を検査済み。
 * @postcondition 内部User・配列・資格を共有せず、初回途中・developerへ情報を返さない。
 * @effect N/A: 所有メモリ値の計算だけでFilesystemを観測しない。
 * @failure 改訂不一致・未完了初回・現在参照不許可はnull。
 * @invariant 管理参照から内容実アクセスを許可しない。
 * @boundary AM管理認可・投影と保存Owner。
 * @security Root・秘密材料・種類外情報を返さない。
 * @concurrency 同じLock区間で取得した改訂だけ。後続操作は再認可する。
 */
export function projectManagementState(
  state: AccessManagementState,
  actor: AuthenticatedRequest,
  kind: ManagementReadKind,
): ManagementStateSnapshot | null {
  if (
    actor.revision !== state.revision ||
    state.initialization.stage !== "completed" ||
    actor.role === "developer"
  )
    return null;
  switch (kind) {
    case "users":
      return Object.freeze({
        revision: state.revision,
        kind,
        users: Object.freeze(
          state.users
            .filter(
              (user) =>
                evaluateManagementPermission(actor.role, {
                  operation: "updateUserName",
                  targetRole: user.role,
                }) === "allowed",
            )
            .map((user) =>
              Object.freeze({
                userId: user.userId,
                username: user.username,
                role: user.role,
              }),
            ),
        ),
      });
    case "roleContentAccess":
      return Object.freeze({
        revision: state.revision,
        kind,
        roles: Object.freeze(
          state.roleContentAccess
            .filter(
              (role) =>
                evaluateManagementPermission(actor.role, {
                  operation: "updateRoleContentAccess",
                  targetRole: role.role,
                }) === "allowed",
            )
            .map((role) =>
              Object.freeze({
                role: role.role,
                workspaceIds: Object.freeze([...role.workspaceIds]),
              }),
            ),
        ),
      });
    case "registeredRepositories":
      if (
        evaluateManagementPermission(actor.role, {
          operation: "registerRepository",
        }) !== "allowed"
      )
        return null;
      return Object.freeze({
        revision: state.revision,
        kind,
        repositories: Object.freeze(
          state.registeredRepositories.map((repository) =>
            Object.freeze({
              repositoryId: repository.repositoryId,
              bindingId: repository.bindingId,
            }),
          ),
        ),
      });
    case "exposure":
      if (
        evaluateManagementPermission(actor.role, {
          operation: "updateExposure",
        }) !== "allowed"
      )
        return null;
      return Object.freeze({
        revision: state.revision,
        kind,
        repositories: Object.freeze(
          state.registeredRepositories.map((repository) => {
            const exposure = state.exposure.find(
              (item) => item.repositoryId === repository.repositoryId,
            );
            return Object.freeze({
              repositoryId: repository.repositoryId,
              workspaceIds: exposure
                ? Object.freeze([...exposure.workspaceIds])
                : null,
            });
          }),
        ),
      });
  }
}

/**
 * 通常保存結果を固定した非秘密Unionへ写す。
 * @responsibility 最初の失敗分類と既知出版・清掃の事実を保持する。
 * @trace ARCH-000013
 * @input AMの通常管理Result。
 * @returns Workbench／MCPで共通利用する非秘密の閉管理結果。
 * @precondition AM公開入口が生成した値だけを受ける。
 * @postcondition 内部理由・Path・secondaryを転記しない。
 * @effect N/A: 値の投影のみ。
 * @failure 未列挙理由はstorage_unavailableへ閉じる。
 * @invariant 既知publicationをrollbackや成功へ変えない。
 * @boundary AM内部結果とTransport非依存の公開投影。
 * @security 自由文字列理由・秘密・回復参照を含めない。
 * @concurrency N/A: 同期の結果を一回投影する。
 */
export function projectManagementOperationResult(
  result: UserRoleManagementResult | RepositoryExposureManagementResult,
) {
  if (result.status === "completed") {
    return {
      status: "completed" as const,
      operationId: result.operationId,
      expectedRevision: result.expectedRevision,
      revision: result.revision,
      ...("userId" in result
        ? { userId: result.userId }
        : { repositoryId: result.repositoryId }),
      publication: result.publication,
      cleanupConfirmed: result.cleanupConfirmed,
    };
  }
  if (result.reason === "management_operation_rejected")
    return {
      status: "rejected" as const,
      reason: "management_request_rejected" as const,
    };
  const reasons: Readonly<Record<string, string>> = {
    state_store_previous_pending_settled: "previous_materials_settled",
    state_store_pending_failed: "previous_materials_unavailable",
    state_store_capacity_exceeded: "capacity_exceeded",
    state_store_identity_failed: "identity_generation_failed",
    state_store_candidate_failed: "candidate_invalid",
    state_store_repository_binding_failed: "repository_validation_failed",
    state_store_prepare_failed: "prepare_failed",
    state_store_publish_failed: "publication_failed",
    state_store_read_back_failed: "readback_failed",
    state_store_cleanup_failed: "cleanup_failed",
    state_store_lock_unknown: "release_unknown",
    filesystem_store_lock_operation_completed_cleanup_unknown:
      "release_unknown",
  };
  return {
    status: "unavailable" as const,
    reason: "management_operation_unavailable" as const,
    primaryFailure: Object.hasOwn(reasons, result.primaryFailure)
      ? (reasons[result.primaryFailure] ?? "storage_unavailable")
      : "storage_unavailable",
    operationId: result.operationId,
    expectedRevision: result.expectedRevision,
    observedRevision: result.observedRevision,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 管理対象別の投影を非秘密の閉結果へ変換する。
 * @responsibility 既存filterとnull／空を保持し、Bindingを結果から除く。
 * @trace ARCH-000013
 * @input AMの管理対象別read結果。
 * @returns 同改訂の対象専用結果または固定未取得。
 * @precondition AM公開Readerが生成した内部値だけを受ける。
 * @postcondition 別readの改訂を混合しない。
 * @effect N/A: 所有値の局所投影のみ。
 * @failure 拒否と観測不明を固定した別理由へ写す。
 * @invariant 未取得を空成功・設定なしにしない。
 * @boundary AM管理ReaderとTransport非依存表示。
 * @security 資格・Path・Binding・回復参照を含めない。
 * @concurrency 当該read改訂だけ。認可を後続要求へ保持しない。
 */
export function projectManagementReadResult(result: ManagementStateResult) {
  if (result.status === "unavailable")
    return {
      status: "unavailable" as const,
      reason:
        result.reason === "management_state_read_rejected" ||
        result.reason === "management_state_authentication_rejected"
          ? ("management_read_rejected" as const)
          : ("management_read_unavailable" as const),
    };
  const snapshot = result.snapshot;
  return {
    status: "completed" as const,
    revision: snapshot.revision,
    ...(snapshot.kind === "users"
      ? {
          users: snapshot.users.map(({ userId, username, role }) => ({
            userId,
            username,
            role,
          })),
        }
      : snapshot.kind === "roleContentAccess"
        ? {
            roles: snapshot.roles.map(({ role, workspaceIds }) => ({
              role,
              workspaceIds: [...workspaceIds],
            })),
          }
        : snapshot.kind === "registeredRepositories"
          ? {
              repositories: snapshot.repositories.map(({ repositoryId }) => ({
                repositoryId,
              })),
            }
          : {
              repositories: snapshot.repositories.map(
                ({ repositoryId, workspaceIds }) => ({
                  repositoryId,
                  workspaceIds:
                    workspaceIds === null ? null : [...workspaceIds],
                }),
              ),
            }),
  };
}

/**
 * 現在許可された管理対象を同じ改訂から読み取り返す。
 * @responsibility 対象別認可前に保存材料を清掃せず、終了確認後だけDTOを公開する。
 * @trace ARCH-000013
 * @input 検証済みRoot、信頼しないBearer、管理対象kind。
 * @returns 対象別投影、または情報を含まない固定拒否・未取得理由。
 * @precondition Rootは既存内部Ownerが検証済み。Transport入力境界はConsumerが担当する。
 * @postcondition 完全状態・認証・対象別管理許可・清掃・解放確認時だけcompleted。
 * @effect 既存Lock、current読取り、同期KDF、許可後の短命材料清掃。
 * @failure 不正kind・developer・初回途中は同じ参照拒否。清掃・解放不明はDTOなし。
 * @invariant 管理参照を内容閲覧・更新・鍵処置のAuthorityへ転用しない。
 * @boundary AM保存Ownerと通常管理の表示Consumer。
 * @security 生鍵・資格材料・内部Path・Lock回復ID・種類外情報を返さない。
 * @concurrency 同じLock内の現在認証・改訂。後続処置は別要求で再認可する。
 */
export function readManagementStateSnapshot(
  root: FilesystemStoreRoot,
  token: string,
  kind: unknown,
): ManagementStateResult {
  if (!isManagementReadKind(kind))
    return { status: "unavailable", reason: "management_state_read_rejected" };
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    };
  const result = locked<ManagementStateSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      if (!actor)
        return {
          status: "unavailable",
          reason: "management_state_authentication_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      const snapshot = projectManagementState(current.state, actor, kind);
      if (!snapshot)
        return {
          status: "unavailable",
          reason: "management_state_read_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "management_state_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
      return {
        status: "completed",
        value: snapshot,
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "management_state_observation_unknown",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  if (result.status === "completed")
    return { status: "completed", snapshot: result.value };
  if (
    result.secondaryReason ||
    result.reason ===
      "filesystem_store_lock_operation_completed_cleanup_unknown" ||
    result.reason === "state_store_lock_unknown"
  )
    return {
      status: "unavailable",
      reason: "management_state_release_unknown",
    };
  if (result.reason === "management_state_authentication_rejected")
    return {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    };
  if (result.reason === "management_state_read_rejected")
    return { status: "unavailable", reason: "management_state_read_rejected" };
  if (result.reason === "management_state_cleanup_pending")
    return {
      status: "unavailable",
      reason: "management_state_cleanup_pending",
    };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "management_state_lock_unavailable"
      : "management_state_observation_unknown",
  };
}

/**
 * 現在許可された管理対象を同じ改訂から読み取り返す。
 * @responsibility 対象別認可前に保存材料を清掃せず、終了確認後だけDTOを公開する。
 * @trace ARCH-000013
 * @input 検証済みRoot、信頼しないBearer、管理対象kind。
 * @returns 対象別投影、または情報を含まない固定拒否・未取得理由。
 * @precondition Rootは既存内部Ownerが検証済み。Transport入力境界はConsumerが担当する。
 * @postcondition 完全状態・認証・対象別管理許可・清掃・解放確認時だけcompleted。
 * @effect 既存Lock、current読取り、同期KDF、許可後の短命材料清掃。
 * @failure 不正kind・developer・初回途中は同じ参照拒否。清掃・解放不明はDTOなし。
 * @invariant 管理参照を内容閲覧・更新・鍵処置のAuthorityへ転用しない。
 * @boundary AM保存Ownerと通常管理の表示Consumer。
 * @security 生鍵・資格材料・内部Path・Lock回復ID・種類外情報を返さない。
 * @concurrency 同じLock内の現在認証・改訂。後続処置は別要求で再認可する。
 */
export function readManagementState(
  root: FilesystemStoreRoot,
  token: string,
  kind: unknown,
): ManagementReadOutcome {
  return projectManagementReadResult(
    readManagementStateSnapshot(root, token, kind),
  );
}
