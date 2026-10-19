/**
 * Repositoryの接続・公開操作・認可済み集合の型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { RepositoryManifest } from "../../../domain-model/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/index.ts";

/**
 * 今回要求で使用する検証済みRepositoryを相関する。
 * @responsibility 管理改訂・内容範囲・登録Bindingと技術的Rootを一つに閉じる。
 * @trace ARCH-000013
 * @shape revision、repositoryId、workspaceId、bindingId、manifest、root。
 * @invariant rootは技術的能力であり、次要求の認可証明ではない。
 * @boundary AMから信頼した同Processの内容Consumerへだけ渡す。
 * @security 保存・cache・Transport応答化を禁止し、別要求は再認可する。
 * @compatibility 型による失効機構はなく、Consumer固有lifecycleの現在要求だけに使用する。
 */
export type RepositoryAccess = Readonly<{
  revision: number;
  repositoryId: string;
  workspaceId: "development" | "management";
  bindingId: string;
  manifest: RepositoryManifest;
  root: VerifiedRepositoryRoot;
}>;

/**
 * 内容要求の拒否と許可後の観測不成立を分ける。
 * @responsibility 不明時に内部Root・例外・資格を返さない。
 * @trace ARCH-000013
 * @shape completedはaccess、unavailableは固定reasonだけ。
 * @invariant 未許可対象と未登録対象の存在を区別しない。
 * @boundary Package内部利用結果。MCP／HTTPの公開DTOではない。
 * @security capabilityを外部へ返さず、解放不明ではaccessなし。
 * @compatibility 本番Consumerによる要求限定使用の検証を別途必要とする。
 */
export type RepositoryAccessResult =
  | Readonly<{ status: "completed"; access: RepositoryAccess }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "repository_access_rejected"
        | "repository_access_lock_unavailable"
        | "repository_access_cleanup_pending"
        | "repository_access_observation_unknown"
        | "repository_access_release_unknown";
    }>;

/**
 * 同じ要求で許可されたRepositoryと全内容範囲を保持する。
 * @responsibility Repositoryを一意にし、複数の許可範囲を落とさない。
 * @trace ARCH-000013
 * @shape repositoryId、workspaceIds、bindingId、manifest、root。
 * @invariant 管理改訂は集合側で保持し、本文の版と混同しない。
 * @boundary 信頼した同Processの今回要求だけ。
 * @security 保存・cache・TransportへのRoot公開を禁止する。
 * @compatibility 次要求では現在認可を再評価する。
 */
export type AuthorizedRepository = Readonly<{
  repositoryId: string;
  workspaceIds: readonly ("development" | "management")[];
  bindingId: string;
  manifest: RepositoryManifest;
  root: VerifiedRepositoryRoot;
}>;

/**
 * 同改訂の許可集合と取得不能を区別する。
 * @responsibility 認証済み空集合だけを成功とし、部分観測を成功にしない。
 * @trace ARCH-000013
 * @shape completedはmanagementRevisionとrepositories、unavailableは固定reason。
 * @invariant managementRevisionはContext本文の版ではない。
 * @boundary AM内部Consumer向け。外部応答DTOではない。
 * @security 失敗時はRoot・対象一覧・資格情報を返さない。
 * @compatibility 同じ要求だけで使う短命値であり失効機構ではない。
 */
export type RepositoryAccessCollectionResult =
  | Readonly<{
      status: "completed";
      managementRevision: number;
      repositories: readonly AuthorizedRepository[];
    }>
  | Extract<RepositoryAccessResult, { status: "unavailable" }>;

/**
 * 登録／公開管理の非秘密な保存結果。
 * @responsibility 認可前拒否と認可後の既知出版を分離する。
 * @trace ARCH-000013
 * @shape 完了、固定拒否、認可後未完了の閉じた共用体。
 * @invariant 先行操作を今回の出版へ帰属しない。
 * @boundary AM保存と内部Consumer。
 * @security 全Snapshot・秘密・内部Pathを含めない。
 * @compatibility Transport公開の採用ではない。
 */
export type RepositoryExposureManagementResult =
  | Readonly<{
      status: "completed";
      operationId: string;
      expectedRevision: number;
      revision: number;
      repositoryId: string;
      publication: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{ status: "unavailable"; reason: "management_operation_rejected" }>
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
