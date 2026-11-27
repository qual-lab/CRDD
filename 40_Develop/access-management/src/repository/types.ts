/**
 * Repositoryの接続・公開操作・認可済み集合の型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { RepositoryManifest } from "@qual-lab/crdd-configuration-model";

/** 共有内容への認可で照会する外部ホストの安定した対象ID。Git履歴・Path・資格は含めない。 */
export type GitHostLinkedRepository = Readonly<{
  provider: string;
  host: string;
  repositoryId: string;
  providerData: Readonly<Record<string, string>>;
}>;

/** 外部ホストで権限を確認するための候補。アクセス可能なPathや本文は含まない。 */
export type GitHostLinkedAccessCandidate = Readonly<{
  repositoryId: string;
  bindingId: string;
  hostedRepository: GitHostLinkedRepository;
}>;

/**
 * 同じ要求で許可されたリポジトリの対象を保持する。
 * @responsibility リポジトリ・登録と実ディレクトリを結び付ける。
 * @trace ARCH-000013
 * @shape repositoryId、bindingId、manifest、rootと外部ホストの識別子。
 * @invariant 管理改訂は集合側で保持し、本文の版と混同しない。
 * @boundary 信頼した同Processの今回要求だけ。
 * @security 保存・cache・TransportへのRoot公開を禁止する。
 * @compatibility 次要求では現在認可を再評価する。
 */
export type AuthorizedRepository = Readonly<{
  repositoryId: string;
  bindingId: string;
  manifest: RepositoryManifest;
  root: string;
  hostedRepository: GitHostLinkedRepository;
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
 * 登録／公開管理の非秘密な保存結果。
 * @responsibility 認可前拒否と認可後の既知出版を分離する。
 * @trace ARCH-000013
 * @shape 完了、固定拒否、認可後未完了の閉じた共用体。
 * @invariant 先行操作を今回の出版へ帰属しない。
 * @boundary AM保存と内部Consumer。
 * @security 全Snapshot・秘密・内部Pathを含めない。
 * @compatibility Transport公開の採用ではない。
 */
export type RepositoryManagementResult =
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
