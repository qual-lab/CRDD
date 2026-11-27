/**
 * 管理状態の完全Snapshotと保存結果の内部型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { AccessRole } from "../role/types.ts";
import type { GitHostLinkedRepository } from "../repository/types.ts";

/**
 * 保存観測結果（StateStoreResult）を定義する。
 * @responsibility 内部保存結果と公開DTOを分離する。
 * @trace ARCH-000013
 * @shape completedは検査・処置・Lock解放済み。unavailableは最初の理由・出版事実・内部Lock回復参照を保持する。
 * @invariant 未確認をcompletedへ畳まない。
 * @boundary 内部保存Ownerだけが利用する値契約。
 * @security 内部SnapshotをTransportへ透過しない。
 * @compatibility 最新Schemaだけを扱い、旧形式を補完しない。
 */
export type StateStoreResult<T> =
  | Readonly<{
      status: "completed";
      value: T;
      cleanupConfirmed: true;
      publication: "not_attempted" | "confirmed";
      revision: number | null;
    }>
  | Readonly<{
      status: "unavailable";
      reason: string;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      revision: number | null;
      cleanupConfirmed: boolean;
      lockRecoveryId?: string;
      secondaryReason?: string;
    }>;

/** 確定した最初の管理者と初回操作の非秘密な記録。 @trace ARCH-000013 */
export type InitializationRecord = {
  stage: "completed";
  attemptId: string;
  initialUserId: string;
  connection: "account_confirmed";
};

/**
 * 単一改訂の管理状態を表す。
 * @responsibility 利用者・登録・初回設定を同じ閉集合へ結合する。
 * @trace ARCH-000013
 * @shape 固定包絡と現在の管理項目。
 * @invariant 現在参照は実在し、各IDは一意。通常Receiptと一般履歴は含まない。
 * @boundary 保存内部。返却値を公開DTOとして使用しない。
 * @security 認証の秘密値を保持しない。
 * @compatibility crdd-access-management/state、schemaRevision 4。旧内容・公開範囲は保持しない。
 */
export type AccessManagementState = {
  contract: "crdd-access-management/state";
  schemaRevision: 4;
  revision: number;
  operationId: string;
  users: {
    userId: string;
    username: string;
    role: AccessRole;
    accountLinks?: { issuer: string; subject: string; bindingId: string }[];
    invitation?: { email: string; digest: string; expiresAt: number };
  }[];
  registeredRepositories: {
    repositoryId: string;
    repositoryRoot: string;
    bindingId: string;
    hostedRepository?: GitHostLinkedRepository;
  }[];
  initialization: InitializationRecord;
};
