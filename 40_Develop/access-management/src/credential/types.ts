/**
 * 認証・資格操作・交換・初回接続の結果型を定義する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import type { AccessRole } from "../role/types.ts";
import type { KeyExchangeSnapshot } from "./exchange.ts";

/**
 * 一要求で観測した本人とRole内容範囲を表す。
 * @responsibility 内部資格材料を含めず現在改訂の相関だけを搬送する。
 * @trace ARCH-000013
 * @shape revision・credentialId・userId・username・role・workspaceIds。
 * @invariant 内容範囲は許可済みRepository集合・実アクセス・管理実行許可ではない。
 * @boundary AM内部認証から要求Consumerへの短命投影。
 * @security token・salt・Verifier・他User・内部Pathを含めない。
 * @compatibility 最新User結合・現在Role契約だけ。旧Credential Grantを使用しない。
 */
export type AuthenticatedRequest = Readonly<{
  revision: number;
  credentialId: string;
  userId: string;
  username: string;
  role: AccessRole;
  workspaceIds: readonly ("development" | "management")[];
}>;

/**
 * 認証成功と非開示拒否・状態未確認を区別する。
 * @responsibility 未確認cleanupや資格の状態を成功主体へ透過しない。
 * @trace ARCH-000013
 * @shape completedはsnapshot、unavailableは閉じたreasonのみ。
 * @invariant 失敗結果に対象ID・存在・状態・改訂を含めない。
 * @boundary Package認証入口。鍵管理・Transportの結果とは別。
 * @security 内部Lock回復参照・保存Path・資格材料を透過しない。
 * @compatibility 本番Consumer未接続の局所専用結果。
 */
export type CredentialAuthenticationResult =
  | Readonly<{ status: "completed"; snapshot: AuthenticatedRequest }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "credential_authentication_rejected"
        | "credential_authentication_state_unavailable";
    }>;

/**
 * 完全な限定要求の検査前後を結ぶ非秘密の初回相関。
 * @responsibility 元試行・本人・最新確認資格・判定時改訂を一つの値へ閉じる。
 * @trace ARCH-000013
 * @shape attemptId・userId・credentialId・expectedRevision。
 * @invariant 相関だけで通常Authorityや確認済み接続を表さない。
 * @boundary 内部要求判定Ownerから完全要求検査Ownerを経由した保存入力。
 * @security Secret・Role・内容・Rootを含めず、外部応答へ公開しない。
 * @compatibility v2初回記録専用。後続通常管理の改訂へ流用しない。
 */
export type InitialConnectionBinding = Readonly<{
  attemptId: string;
  userId: string;
  credentialId: string;
  expectedRevision: number;
}>;

/**
 * 要求内の通常本人と限定初回候補を区別する。
 * @responsibility 初回候補にはRole・内容権限を搬送しない。
 * @trace ARCH-000013
 * @shape normalは本人投影、initialは非Authority相関、unavailableは固定理由。
 * @invariant initialは初回接続成功でも通常認証成功でもない。
 * @boundary 保存OwnerからSurfaceの要求用途判定。
 * @security 拒否時に資格・User・状態の存在を開示しない。
 * @compatibility 公開Protocolではない。Consumerで固定応答へ変換する。
 */
export type ConnectionAuthenticationResult =
  | Readonly<{ status: "normal"; snapshot: AuthenticatedRequest }>
  | Readonly<{ status: "initial"; binding: InitialConnectionBinding }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "connection_authentication_rejected"
        | "connection_state_unavailable";
    }>;

/**
 * 現在管理者へ返す資格管理画面の非秘密Snapshotを表す。
 * @responsibility 対象選択・旧集合表示・未解決交換を一改訂へ結び、資格材料を除外する。
 * @trace ARCH-000013
 * @shape revision、actorUserId、users、credentials、exchange。
 * @invariant exchange nullは現在recordなしで、過去交換の完了証明ではない。
 * @boundary 同Process Workbench専用の内部公開API。MCP／Remoteへ公開しない。
 * @security Secret・salt・Verifier・Root・内容権限・Repository情報を含めない。
 * @compatibility 最新Schema v2のUser結合と交換相関だけ。
 */
export type CredentialAdministrationSnapshot = Readonly<{
  revision: number;
  actorUserId: string;
  users: readonly Readonly<{
    userId: string;
    username: string;
    role: AccessRole;
  }>[];
  credentials: readonly Omit<CredentialIssuanceSnapshot, "revision">[];
  exchange: KeyExchangeSnapshot | null;
}>;

/**
 * 資格管理の非秘密投影と取得不能を分ける。
 * @responsibility 認証・認可・材料処置・解放不明でSnapshotを返さない。
 * @trace ARCH-000013
 * @shape completedのsnapshot、または固定unavailableのreason。
 * @invariant 未取得は空一覧でも過去処理の失敗証明でもない。
 * @boundary AM保存Ownerから同Process Workbenchへ。
 * @security 拒否時に対象存在・件数・Role・保存Pathを開示しない。
 * @compatibility 一覧・表示専用。処置時には別のfresh認可を要求する。
 */
export type CredentialAdministrationStateResult =
  | Readonly<{
      status: "completed";
      snapshot: CredentialAdministrationSnapshot;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "credential_administration_unavailable";
    }>;

/**
 * 現在資格recordの非秘密な発行相関を表す。
 * @responsibility 保存済み事実を元要求の成功Receiptから分離する。
 * @trace ARCH-000013
 * @shape 改訂・資格ID・User ID・元発行ID・提示状態・現在失効。
 * @invariant revokedは元失効要求のcompletedを証明しない。
 * @boundary 管理者向けの短命読取り投影。
 * @security Secret・salt・Verifier・他資格・Root・Recoveryを含めない。
 * @compatibility 現Schema v2資格。未発行確定・履歴・再表示なし。
 */
export type CredentialIssuanceSnapshot = Readonly<{
  revision: number;
  credentialId: string;
  userId: string;
  issuanceOperationId: string;
  presentation: "not_attempted" | "unconfirmed" | "confirmed";
  revoked: boolean;
}>;

/**
 * 保存用照合値と一度の配送用生鍵を表す。
 * @responsibility 保存Ownerへ渡す照合値と短命鍵を混同しない。
 * @trace ARCH-000013
 * @shape credentialId・tokenSalt・tokenVerifier・token。
 * @invariant tokenを永続状態へ複製しない。
 * @boundary AM内部の発行準備結果。公開管理DTOではない。
 * @security 生鍵を含むためログ・Evidence・通常readへ使用禁止。
 * @compatibility cros.v1の固定長生成形式。
 */
export type CredentialMaterial = Readonly<{
  credentialId: string;
  tokenSalt: string;
  tokenVerifier: string;
  token: string;
}>;

/**
 * 通常鍵変更の内部結果を表す。
 * @responsibility 認可前拒否と今回の保存事実・一度の短命鍵を分離する。
 * @trace ARCH-000013
 * @shape completedは受付・対象・改訂、issueだけtoken。失敗は非秘密の出版観測。
 * @invariant 生鍵は保存・読戻し・材料清掃・Lock解放を確認した新規発行だけ。
 * @boundary 同Processの信頼済みWorkbench提示Owner。MCP結果ではない。
 * @security completedのtokenをlog・Evidence・通常readへ複製しない。
 * @compatibility 最新Schemaの通常発行・独立失効。交換・Host入口は別。
 */
export type CredentialManagementResult =
  | (Readonly<{
      status: "completed";
      operationId: string;
      expectedRevision: number;
      revision: number;
      userId: string;
      credentialId: string;
      publication: "confirmed";
      cleanupConfirmed: true;
    }> &
      (
        | Readonly<{ operation: "issueCredential"; token: string }>
        | Readonly<{ operation: "revokeCredential"; token?: never }>
      ))
  | Readonly<{
      status: "unavailable";
      reason: "credential_management_rejected";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "credential_management_unavailable";
      primaryFailure: string;
      operationId: string;
      expectedRevision: number;
      observedRevision: number | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
    }>;

/**
 * 現在資格観測の閉じた結果を表す。
 * @responsibility 現在の保存事実と元要求完了・未発行を区別する。
 * @trace ARCH-000013
 * @shape observedの非秘密snapshot、または固定unavailable。
 * @invariant unavailableは未発行・削除・元要求失敗の確定ではない。
 * @boundary 同Processの管理者向けConsumer。MCPに公開しない。
 * @security 秘密・内部Path・他資格・Recovery参照なし。
 * @compatibility 通常管理read四kindは不変更。
 */
export type CredentialIssuanceObservation =
  | Readonly<{ status: "observed"; snapshot: CredentialIssuanceSnapshot }>
  | Readonly<{
      status: "unavailable";
      reason: "credential_issuance_unavailable";
    }>;

/**
 * 鍵交換の保存済み段階と短命結果を分離する。
 * @responsibility core保存完了を提示・未解決record整理の完了にしない。
 * @trace ARCH-000013
 * @shape completedはcredential_storedの非秘密相関と新規時だけのtoken。拒否は固定理由、保存不明は最初の失敗と最後の確認段階。
 * @invariant 通常新規はprepared未確定でnull/null/not_started。引継ぎは旧record三値を新prepared確定後だけ新へ切替。失敗結果にtokenなし。
 * @boundary 同Process Workbench／信頼Hostの内部Consumer専用。
 * @security tokenは一回提示Ownerだけが扱い、MCP・log・履歴・一般DTOへ渡さない。
 * @compatibility 現Schema v2。提示Consumerは未接続、record終了は別内部入口。
 */
export type KeyExchangeResult =
  | Readonly<{
      status: "completed";
      operationId: string;
      recoveryId: string;
      entry: "workbench" | "host";
      scope: "targeted" | "all";
      userId: string;
      oldCredentialIds: readonly string[];
      credentialId: string;
      expectedRevision: number;
      revision: number;
      lastConfirmedStage: "credential_stored";
      token: string | null;
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_rejected";
      token?: never;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_unavailable";
      operationId: string;
      recoveryId: string | null;
      expectedRevision: number;
      observedRevision: number | null;
      lastConfirmedOperationId: string | null;
      lastConfirmedStage:
        | "not_started"
        | "prepared"
        | "revoked"
        | "credential_stored";
      firstFailure:
        | "read"
        | "pending"
        | "candidate"
        | "capacity"
        | "generation"
        | "prepare"
        | "publish"
        | "read_back"
        | "cleanup"
        | "release";
      secondaryFailure: "release" | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
      token?: never;
    }>;

/**
 * 交換終了の確定と保存不明を区別する。
 * @responsibility 失敗理由を後続解放不明で上書きせず、秘密と内部Pathを返さない。
 * @trace ARCH-000013
 * @shape completedは改訂・終了操作・交換参照・清掃確認。拒否は固定理由。admit後不明は出版観測と二失敗。
 * @invariant record不在から終了済みを再構成しない。
 * @boundary 同Process Workbench／信頼Host内部Consumer。
 * @security 生鍵・Verifier・内部Lock相関を含めない。
 * @compatibility 現Schemaの確認済み交換だけ。
 */
export type KeyExchangeCompletionResult =
  | Readonly<{
      status: "completed";
      revision: number;
      operationId: string;
      recoveryId: string;
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_completion_rejected";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_completion_unavailable";
      operationId: string;
      recoveryId: string;
      observedRevision: number | null;
      firstFailure:
        | "pending"
        | "prepare"
        | "publish"
        | "read_back"
        | "cleanup"
        | "capacity"
        | "release";
      secondaryFailure: "release" | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
    }>;

/**
 * 交換の非秘密観測と固定未取得を分離する。
 * @responsibility 記録不在・状態不明を過去の完了へ変換しない。
 * @trace ARCH-000013
 * @shape observedは現在投影、unavailableは固定理由だけ。
 * @invariant 読取りから失効・生成・提示・record終了を行わない。
 * @boundary 同Process Workbench／信頼Host Consumer。
 * @security 生鍵・内部Root・Lock回復情報を含めない。
 * @compatibility 現v2の交換参照のみ。MCP非公開。
 */
export type KeyExchangeObservation =
  | Readonly<{ status: "observed"; snapshot: KeyExchangeSnapshot }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_state_unavailable";
    }>;
