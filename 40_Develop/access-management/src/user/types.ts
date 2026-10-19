/**
 * ユーザー管理入力・候補・保存結果の内部型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { AccessManagementState } from "../storage/types.ts";

/**
 * 通常管理4操作の内部入力を表す。
 * @responsibility 操作別に必要な値を区別する。
 * @trace ARCH-000013
 * @shape 登録、名前変更、Role変更、内容範囲更新の判別共用体。
 * @invariant 外部値は検査前のunknownで、資格・保存状態を含めない。
 * @boundary AM内部の専用保存入口と純粋な変更判断。
 * @security 入力だけでは現在認可を成立させない。
 * @compatibility 通常管理4操作だけ。鍵・登録接続・公開設定は含まない。
 */
export type UserRoleChange =
  | { operation: "registerUser"; username: unknown; plannedRole: unknown }
  | { operation: "updateUserName"; userId: unknown; username: unknown }
  | {
      operation: "updateUserRole";
      userId: unknown;
      currentRole: unknown;
      nextRole: unknown;
    }
  | {
      operation: "updateRoleContentAccess";
      targetRole: unknown;
      workspaceIds: unknown;
    };

/**
 * 現在管理許可と対象照合を通過した変更候補を表す。
 * @responsibility 登録UUID生成前の固定長候補と変更対象を結合する。
 * @trace ARCH-000013
 * @shape 所有済みnext状態、登録有無、対象userId。
 * @invariant 登録placeholderは採用Identityではなく保存・公開しない。
 * @boundary 同じLock区間の保存Ownerだけが使用する。
 * @security 内部Snapshotを含むためPackage Rootへ公開しない。
 * @compatibility 完了初期化の通常更新だけ。
 */
export type PreparedUserRoleChange = {
  next: AccessManagementState;
  registersUser: boolean;
  userId: string | null;
};

/**
 * ユーザー・Role管理の非秘密結果を表す。
 * @responsibility 認可前拒否と今回操作の保存観測を分離する。
 * @trace ARCH-000013
 * @shape completedは操作・期待改訂・採用改訂・対象、unavailableは非開示拒否または認可後の保存観測。
 * @invariant completedは今回出版と全清掃確認を要求する。
 * @boundary Package管理APIから内部Consumerへ渡す結果。
 * @security 生鍵・salt・Verifier・全状態・内部Path・Lock回復参照を含めない。
 * @compatibility 通常4操作専用。HTTP／MCP Schemaの採用ではない。
 */
export type UserRoleManagementResult =
  | Readonly<{
      status: "completed";
      operationId: string;
      expectedRevision: number;
      revision: number;
      userId: string | null;
      publication: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "management_operation_rejected";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "management_operation_unavailable";
      primaryFailure: string;
      operationId: string;
      expectedRevision: number;
      observedRevision: number | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
    }>;
