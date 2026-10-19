/**
 * 管理状態の完全Snapshotと保存結果の内部型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { AccessRole } from "../role/types.ts";

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

/**
 * 初回の現在参照と終了時の歴史的参照を分ける。
 * @responsibility 保存された初回事実の段階別形状を保持する。
 * @trace ARCH-000013
 * @shape correlated、user_stored、credential_stored、completedの判別共用体。
 * @invariant 途中のIDは現在参照、完了後のIDは歴史的参照。
 * @boundary Access Management保存内部。公開DTOではない。
 * @security 秘密値・認可Authorityを含まない。
 * @compatibility 新state schemaRevision 2のみ。旧形式fallbackなし。
 */
export type InitializationRecord =
  | { stage: "correlated"; attemptId: string }
  | { stage: "user_stored"; attemptId: string; userId: string }
  | {
      stage: "credential_stored";
      attemptId: string;
      userId: string;
      initialCredentialId: string;
      confirmationCredentialId: string;
    }
  | {
      stage: "completed";
      attemptId: string;
      initialUserId: string;
      initialCredentialId: string;
      confirmationCredentialId: string;
      connection: "confirmed";
    };

/**
 * 交換対象・発行先と保存済み段階を表す。
 * @responsibility 未解決交換だけを現在状態に保持する。
 * @trace ARCH-000013
 * @shape 固定対象集合とprepared／revoked／credential_storedの共用体。
 * @invariant newCredentialIdは資格保存後だけ存在する。
 * @boundary Access Management保存内部。
 * @security Recovery参照はAuthorityではなく、Secretを含まない。
 * @compatibility 新state schemaRevision 2のみ。
 */
export type KeyExchangeRecord = {
  recoveryId: string;
  operationId: string;
  entry: "workbench" | "host";
  scope: "targeted" | "all";
  recipientUserId: string;
  oldCredentialIds: string[];
} & (
  | { stage: "prepared" | "revoked" }
  | { stage: "credential_stored"; newCredentialId: string }
);

/**
 * 単一改訂の管理状態を表す。
 * @responsibility User・資格・登録・公開・初回・未解決交換を同じ閉集合へ結合する。
 * @trace ARCH-000013
 * @shape 固定包絡と7項目。資格のsalt／Verifierを含む内部型。
 * @invariant 現在参照は実在し、各IDは一意。通常Receiptと一般履歴は含まない。
 * @boundary 保存内部。返却値を公開DTOとして使用しない。
 * @security 生Secret非保存。Verifierは公開・log・Evidenceへ出さない。
 * @compatibility crdd-access-management/state、schemaRevision 2。
 */
export type AccessManagementState = {
  contract: "crdd-access-management/state";
  schemaRevision: 2;
  revision: number;
  operationId: string;
  users: { userId: string; username: string; role: AccessRole }[];
  roleContentAccess: {
    role: AccessRole;
    workspaceIds: ("development" | "management")[];
  }[];
  credentials: {
    credentialId: string;
    userId: string;
    tokenVersion: 1;
    tokenSalt: string;
    tokenVerifier: string;
    revoked: boolean;
    operationId: string;
    presentation: "not_attempted" | "unconfirmed" | "confirmed";
  }[];
  registeredRepositories: {
    repositoryId: string;
    repositoryRoot: string;
    bindingId: string;
  }[];
  exposure: {
    repositoryId: string;
    workspaceIds: ("development" | "management")[];
  }[];
  initialization: InitializationRecord;
  unresolvedKeyExchanges: KeyExchangeRecord[];
};
