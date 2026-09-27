/**
 * CROS接続Credentialの発行、照合、失効およびローテーションを提供する。
 *
 * @packageDocumentation
 * @responsibility 生Secretを保存せず、固定Credential Profileと明示GrantからRequest Access Contextを生成する。
 * @trace ARCH-000013
 * @boundary Shared CROSの管理入口およびRemote Request認証境界。
 * @effect Credential Registryをrevision付きで更新する。
 * @security 生Secretは発行結果へ一度だけ返し、Registryにはsalt付きVerifierだけを保存する。
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const TOKEN_PREFIX = "cros.v1";
const VERIFIER_BYTES = 32;

/**
 * Credential発行時に選択する固定Profileを定義する。
 *
 * @responsibility 運用表示と安全な初期Grantを揃え、権限階層としては扱わない。
 * @trace ARCH-000013
 * @shape administrator、management、developerの閉じた文字列集合。
 * @invariant 実効権限は保存済みworkspaceIdsとsystemAdminから決まり、Profile名から再推定しない。
 * @boundary Credential管理画面／CLIとCredential Registryの境界。
 * @security Human IdentityまたはUser Accountを表さない。
 * @compatibility v0.22の固定Profile集合として扱う。
 */
export type ConnectionCredentialProfile =
  | "administrator"
  | "management"
  | "developer";

/**
 * Credential Registryへ保存する非秘密Recordを定義する。
 *
 * @responsibility Credential Identity、Verifier、明示Grant、管理可否および失効状態を保持する。
 * @trace ARCH-000013
 * @shape credentialId、Profile、workspaceIds、systemAdmin、revoked、salt、verifierおよびrevision。
 * @invariant 生Secretを含まず、workspaceIdsに重複を持たない。
 * @boundary Credential Registry Portと認証Applicationの境界。
 * @security salt付きscrypt Verifierだけを保持する。
 * @compatibility tokenVersion=1のRecordだけを本実装で照合する。
 */
export type ConnectionCredentialRecord = Readonly<{
  credentialId: string;
  profile: ConnectionCredentialProfile;
  workspaceIds: readonly string[];
  systemAdmin: boolean;
  revoked: boolean;
  tokenVersion: 1;
  tokenSalt: string;
  tokenVerifier: string;
  revision: number;
}>;

/**
 * 管理Surfaceへ公開できるCredential Metadataを定義する。
 *
 * @responsibility 管理に必要なIdentity、Profile、明示Grantおよび状態だけを公開する。
 * @trace ARCH-000013
 * @shape Credential RecordからsaltとVerifierを除いた値。
 * @invariant 生Token、tokenSaltおよびtokenVerifierを含まない。
 * @boundary Credential Applicationと管理CLI／Workbenchの公開境界。
 * @security 認証材料を管理表示へ搬送しない。
 * @compatibility Record revisionを保持して競合判断へ利用できる。
 */
export type ConnectionCredentialMetadata = Readonly<{
  credentialId: string;
  profile: ConnectionCredentialProfile;
  workspaceIds: readonly string[];
  systemAdmin: boolean;
  revoked: boolean;
  revision: number;
}>;

/**
 * 一Requestで利用する検証済みAccess Contextを定義する。
 *
 * @responsibility 現在のCredential RecordからContent Grantと管理可否を秘密値なしで搬送する。
 * @trace ARCH-000013
 * @shape credentialId、Profile、workspaceIds、systemAdminおよびRegistry revision。
 * @invariant Profile名を実効権限の判定へ使用しない。
 * @boundary Bearer Credential VerifierとWorkspace Resolverの境界。
 * @security Token、saltおよびVerifierを含まない。
 * @compatibility Requestごとに現在Recordから再生成する。
 */
export type RequestAccessContext = Readonly<{
  credentialId: string;
  profile: ConnectionCredentialProfile;
  workspaceIds: readonly string[];
  systemAdmin: boolean;
  registryRevision: number;
}>;

/**
 * Credential Registryの一貫したSnapshotを定義する。
 *
 * @responsibility Registry revisionと全Recordを同じ観測単位に固定する。
 * @trace ARCH-000013
 * @shape 単調増加revisionとCredential Record集合。
 * @invariant 同じcredentialIdを二件含まない。
 * @boundary Registry AdapterとCredential Applicationの境界。
 * @security 生Secretを含まない。
 * @compatibility 永続化方式に依存しない。
 */
export type ConnectionCredentialRegistrySnapshot = Readonly<{
  revision: number;
  records: readonly ConnectionCredentialRecord[];
}>;

/**
 * Credential Registryの保存境界を定義する。
 *
 * @responsibility Snapshot観測とrevision一致時だけの不変publishを提供する。
 * @trace ARCH-000013
 * @shape inspectとpublishの二操作。
 * @invariant publish成功時だけrevisionを一つ進める。
 * @boundary Credential ApplicationとMemory／File／DB Adapterの境界。
 * @security Adapterも生Secretを受け取らない。
 * @compatibility 物理保存方式を差し替え可能にする。
 */
export type ConnectionCredentialRegistry = Readonly<{
  inspect(): ConnectionCredentialRegistrySnapshot;
  publish(
    expectedRevision: number,
    records: readonly ConnectionCredentialRecord[],
  ): boolean;
}>;

/**
 * Credential発行結果を定義する。
 *
 * @responsibility 公開Recordと一度だけ表示するBearer Tokenを同じ発行結果へ結合する。
 * @trace ARCH-000013
 * @shape status、reason、recordおよびtoken。
 * @invariant completedだけがtokenを持つ。
 * @boundary Credential Applicationと管理CLI／Workbenchの境界。
 * @security tokenを再取得できる保存参照を含めない。
 * @compatibility blocked時はEffect 0を表す。
 */
export type ConnectionCredentialIssueResult = Readonly<
  | {
      status: "completed";
      reason: "connection_credential_issued";
      record: ConnectionCredentialMetadata;
      token: string;
    }
  | {
      status: "blocked";
      reason:
        | "connection_credential_admin_required"
        | "connection_credential_registry_conflict"
        | "connection_credential_input_invalid";
      record: null;
      token: null;
    }
>;

/**
 * Bearer Token照合結果を定義する。
 *
 * @responsibility 利用可能、無効、失効および競合を情報漏えいなしに区別する。
 * @trace ARCH-000013
 * @shape status、reasonおよびAccess Context。
 * @invariant availableだけがAccess Contextを持つ。
 * @boundary Remote Request認証とWorkspace Resolutionの境界。
 * @security 無効TokenへCredentialの存在や状態を返さない。
 * @compatibility Token version不一致をinvalidとして扱う。
 */
export type ConnectionCredentialAuthenticationResult = Readonly<
  | {
      status: "available";
      reason: "connection_credential_authenticated";
      access: RequestAccessContext;
    }
  | {
      status: "blocked";
      reason:
        | "connection_credential_invalid"
        | "connection_credential_revoked"
        | "connection_credential_registry_conflicting";
      access: null;
    }
>;

/**
 * Credential状態変更結果を定義する。
 *
 * @responsibility 失効またはローテーションの成否とRegistry Effect件数を表す。
 * @trace ARCH-000013
 * @shape status、reasonおよびregistryEffectCount。
 * @invariant completedのEffect件数は1、blockedは0である。
 * @boundary Credential Applicationと管理CLI／Workbenchの境界。
 * @security CredentialのVerifierまたは生Secretを含まない。
 * @compatibility 競合時は自動再試行しない。
 */
export type ConnectionCredentialChangeResult = Readonly<{
  status: "completed" | "blocked";
  reason:
    | "connection_credential_revoked"
    | "connection_credential_access_updated"
    | "connection_credential_admin_required"
    | "connection_credential_not_found"
    | "connection_credential_input_invalid"
    | "connection_credential_registry_conflict";
  registryEffectCount: 0 | 1;
}>;

/**
 * Credential管理用の読取り結果を定義する。
 *
 * @responsibility 認証材料を除いたCredential Metadata集合だけを管理者へ返す。
 * @trace ARCH-000013
 * @shape status、reason、Registry revisionおよびMetadata集合。
 * @invariant availableだけが現在Metadataを持つ。
 * @boundary Credential Registryと管理CLI／Workbenchの読取り境界。
 * @security 非管理者へCredential Identity、件数または状態を開示しない。
 * @compatibility MetadataはcredentialId昇順で安定する。
 */
export type ConnectionCredentialListResult = Readonly<
  | {
      status: "available";
      reason: "connection_credentials_observed";
      registryRevision: number;
      credentials: readonly ConnectionCredentialMetadata[];
    }
  | {
      status: "blocked";
      reason: "connection_credential_admin_required";
      registryRevision: null;
      credentials: readonly [];
    }
>;

/**
 * Credentialローテーション結果を定義する。
 *
 * @responsibility 旧Credential失効と新Credential発行を一つのRegistry更新および一度表示Tokenへ結合する。
 * @trace ARCH-000013
 * @shape status、reason、previousCredentialId、recordおよびtoken。
 * @invariant completedだけが新Recordとtokenを持つ。
 * @boundary Credential Applicationと管理CLI／Workbenchの境界。
 * @security 旧Secretおよび新Secretの再表示参照を含めない。
 * @compatibility blocked時はRegistry Effect 0を表す。
 */
export type ConnectionCredentialRotationResult = Readonly<
  | {
      status: "completed";
      reason: "connection_credential_rotated";
      previousCredentialId: string;
      record: ConnectionCredentialMetadata;
      token: string;
    }
  | {
      status: "blocked";
      reason:
        | "connection_credential_admin_required"
        | "connection_credential_not_found"
        | "connection_credential_registry_conflict";
      previousCredentialId: string;
      record: null;
      token: null;
    }
>;

/**
 * 試験可能なCredential用乱数境界を定義する。
 *
 * @responsibility Credential Identity、Secretおよびsaltに必要な暗号学的byteを供給する。
 * @trace ARCH-000013
 * @shape 要求byte数からBufferを返す関数。
 * @invariant 本番既定はnode:cryptoのrandomBytesを使用する。
 * @boundary Credential Applicationと暗号学的乱数Providerの境界。
 * @security 予測可能なProviderを本番へ使用しない。
 * @compatibility 試験Adapterは要求byte数を満たす。
 */
export type CredentialRandomBytes = (size: number) => Buffer;

/**
 * Memory上のCredential Registryを作成する。
 *
 * @responsibility 同一Process内Pilotと契約試験へrevision付きRegistry Portを提供する。
 * @trace ARCH-000013
 * @input initialRecords: 初期Record集合。省略時は空集合。
 * @returns inspectとpublishを実装するRegistry Port。
 * @precondition credentialIdは重複せず、生Secretを含まない。
 * @postcondition 初期revision 0の独立Registryを返す。
 * @effect Process memoryだけを更新し、Filesystem Effectを発行しない。
 * @failure 重複credentialIdは例外で拒否する。
 * @invariant publish成功時だけrevisionを一つ進める。
 * @boundary Credential Applicationと同一Process Memory Adapterの境界。
 * @security Recordをcloneし、外部可変参照を保持しない。
 * @concurrency revision競合を拒否し、自動再試行しない。
 */
export function createMemoryConnectionCredentialRegistry(
  initialRecords: readonly ConnectionCredentialRecord[] = [],
): ConnectionCredentialRegistry {
  if (
    new Set(initialRecords.map((record) => record.credentialId)).size !==
    initialRecords.length
  )
    throw new Error("connection_credential_registry_duplicate_id");
  let revision = 0;
  let records = initialRecords.map((record) => Object.freeze({ ...record }));
  return Object.freeze({
    inspect: () =>
      Object.freeze({ revision, records: Object.freeze([...records]) }),
    publish: (expectedRevision, nextRecords) => {
      if (expectedRevision !== revision) return false;
      if (
        new Set(nextRecords.map((record) => record.credentialId)).size !==
        nextRecords.length
      )
        return false;
      records = nextRecords.map((record) => Object.freeze({ ...record }));
      revision += 1;
      return true;
    },
  });
}

/**
 * 固定Credential Profileの推奨初期Grantを返す。
 *
 * @responsibility 発行時の単純な選択を明示Grantへ変換する。
 * @trace ARCH-000013
 * @input profile: administrator、managementまたはdeveloper。
 * @returns workspaceIdsとsystemAdminの推奨初期値。
 * @precondition profileは閉じた型集合に含まれる。
 * @postcondition administratorへContent Accessを自動付与しない。
 * @effect N/A: 値を計算するだけである。
 * @failure N/A: 閉じた型入力だけを受ける。
 * @invariant developer < management < administratorという階層を作らない。
 * @boundary 管理UI／CLIのProfile選択とCredential Record作成の境界。
 * @security Profileから保存後の実効権限を再推定しない。
 * @concurrency N/A: 状態を持たない純粋関数である。
 */
export function resolveCredentialProfileDefaults(
  profile: ConnectionCredentialProfile,
): Readonly<{ workspaceIds: readonly string[]; systemAdmin: boolean }> {
  if (profile === "administrator")
    return Object.freeze({
      workspaceIds: Object.freeze([]),
      systemAdmin: true,
    });
  if (profile === "management")
    return Object.freeze({
      workspaceIds: Object.freeze(["development", "management"]),
      systemAdmin: false,
    });
  return Object.freeze({
    workspaceIds: Object.freeze(["development"]),
    systemAdmin: false,
  });
}

/**
 * 管理Credentialへ現在のCredential Metadata一覧を返す。
 *
 * @responsibility 管理画面に必要なIdentity、Profile、明示Grantおよび状態を安全に投影する。
 * @trace ARCH-000013
 * @input registryと現在RequestのAccess Context。
 * @returns credentialId昇順のMetadata一覧または情報非開示のblocked結果。
 * @precondition actorは現在Requestで検証済みである。
 * @postcondition RegistryとCredential状態を変更しない。
 * @effect N/A: Registry Snapshotを読取るだけである。
 * @failure 管理可否不足を件数0ではなくblockedへ変換する。
 * @invariant Profile名から追加情報または権限を生成しない。
 * @boundary Credential Registry→管理CLI／Workbench。
 * @security Token、salt、Verifierおよび非管理者向け件数を返さない。
 * @concurrency 一回のRegistry Snapshotだけを一覧へ使用する。
 */
export function listConnectionCredentials(
  registry: ConnectionCredentialRegistry,
  actor: RequestAccessContext,
): ConnectionCredentialListResult {
  if (!actor.systemAdmin)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_admin_required",
      registryRevision: null,
      credentials: Object.freeze([] as const),
    });
  const snapshot = registry.inspect();
  return Object.freeze({
    status: "available",
    reason: "connection_credentials_observed",
    registryRevision: snapshot.revision,
    credentials: Object.freeze(
      snapshot.records
        .map(toMetadata)
        .sort((left, right) =>
          left.credentialId.localeCompare(right.credentialId),
        ),
    ),
  });
}

/**
 * 管理Credentialから対象Credentialの明示Grantを更新する。
 *
 * @responsibility Workspace集合と管理可否の変更を次Requestへ反映する一つのRegistry更新として公開する。
 * @trace ARCH-000013
 * @input registry、管理Access Context、対象credentialId、新workspaceIdsおよびsystemAdmin。
 * @returns Effect件数を含む構造化変更結果。
 * @precondition actor.systemAdmin=trueで、対象Recordが一意に存在する。
 * @postcondition 成功時は対象Record revisionが一つ進み、ProfileとVerifierは変わらない。
 * @effect Credential Recordを一件更新する。
 * @failure Authority不足、不明対象、不正WorkspaceまたはRegistry競合をEffect 0で返す。
 * @invariant Profile名からGrantを再推定せず、RepositoryとProject Contextを変更しない。
 * @boundary 管理CLI／Workbench→Credential Application→Registry。
 * @security 生Token、saltまたはVerifierを公開結果へ返さない。
 * @concurrency inspectしたrevisionとpublish時revisionの一致を要求し、自動再試行しない。
 */
export function updateConnectionCredentialAccess(
  registry: ConnectionCredentialRegistry,
  actor: RequestAccessContext,
  credentialId: string,
  input: Readonly<{
    workspaceIds: readonly string[];
    systemAdmin: boolean;
  }>,
): ConnectionCredentialChangeResult {
  if (!actor.systemAdmin)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_admin_required",
      registryEffectCount: 0,
    });
  const workspaceIds = [...new Set(input.workspaceIds)].sort();
  if (workspaceIds.some((workspaceId) => workspaceId.trim().length === 0))
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_input_invalid",
      registryEffectCount: 0,
    });
  const snapshot = registry.inspect();
  const index = snapshot.records.findIndex(
    (record) => record.credentialId === credentialId,
  );
  const current = index < 0 ? undefined : snapshot.records[index];
  if (!current)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_not_found",
      registryEffectCount: 0,
    });
  const records = [...snapshot.records];
  records[index] = Object.freeze({
    ...current,
    workspaceIds: Object.freeze(workspaceIds),
    systemAdmin: input.systemAdmin,
    revision: current.revision + 1,
  });
  if (!registry.publish(snapshot.revision, records))
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_registry_conflict",
      registryEffectCount: 0,
    });
  return Object.freeze({
    status: "completed",
    reason: "connection_credential_access_updated",
    registryEffectCount: 1,
  });
}

/**
 * 管理Credentialから新しいConnection Credentialを発行する。
 *
 * @responsibility Profile初期値または明示GrantをRecordへ固定し、生Tokenを一度だけ返す。
 * @trace ARCH-000013
 * @input registry、管理Access Context、Profile、任意の明示workspaceIds／systemAdmin、乱数Provider。
 * @returns 発行Recordと一度表示Token、またはEffect 0のblocked結果。
 * @precondition actor.systemAdmin=trueで、workspace IDは空でない一意文字列である。
 * @postcondition 成功時だけRegistry revisionが一つ進み、生SecretはRegistryへ保存されない。
 * @effect Credential Recordを一件追加する。
 * @failure Authority不足、不正入力またはrevision競合をblockedへ変換する。
 * @invariant Profile名ではなく保存したworkspaceIdsとsystemAdminが実効権限を所有する。
 * @boundary 管理CLI／Workbench→Credential Application→Registry。
 * @security salt付きscrypt Verifierだけを保存し、Tokenは結果へ一度だけ返す。
 * @concurrency inspectしたrevisionとpublish時revisionの一致を要求し、自動再試行しない。
 */
export function issueConnectionCredential(
  registry: ConnectionCredentialRegistry,
  actor: RequestAccessContext,
  input: Readonly<{
    profile: ConnectionCredentialProfile;
    workspaceIds?: readonly string[];
    systemAdmin?: boolean;
  }>,
  random: CredentialRandomBytes = randomBytes,
): ConnectionCredentialIssueResult {
  if (!actor.systemAdmin)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_admin_required",
      record: null,
      token: null,
    });
  const defaults = resolveCredentialProfileDefaults(input.profile);
  const workspaceIds = [
    ...new Set(input.workspaceIds ?? defaults.workspaceIds),
  ].sort();
  if (workspaceIds.some((workspaceId) => workspaceId.trim().length === 0))
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_input_invalid",
      record: null,
      token: null,
    });
  const snapshot = registry.inspect();
  const credentialId = random(12).toString("hex");
  const secret = random(32).toString("base64url");
  const salt = random(16).toString("hex");
  const verifier = deriveVerifier(secret, salt);
  const record: ConnectionCredentialRecord = Object.freeze({
    credentialId,
    profile: input.profile,
    workspaceIds: Object.freeze(workspaceIds),
    systemAdmin: input.systemAdmin ?? defaults.systemAdmin,
    revoked: false,
    tokenVersion: 1,
    tokenSalt: salt,
    tokenVerifier: verifier,
    revision: 1,
  });
  if (!registry.publish(snapshot.revision, [...snapshot.records, record]))
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_registry_conflict",
      record: null,
      token: null,
    });
  return Object.freeze({
    status: "completed",
    reason: "connection_credential_issued",
    record: toMetadata(record),
    token: `${TOKEN_PREFIX}.${credentialId}.${secret}`,
  });
}

/**
 * Bearer Tokenを現在のCredential Registryへ照合する。
 *
 * @responsibility Requestごとに現在Record、失効およびVerifierを確認してAccess Contextを生成する。
 * @trace ARCH-000013
 * @input registryとAuthorization Bearer値から抽出したtoken。
 * @returns 利用可能なAccess Contextまたは情報非開示のblocked結果。
 * @precondition tokenは外部入力として信頼しない。
 * @postcondition Registry、RepositoryまたはSessionを変更しない。
 * @effect N/A: Registryを読取るだけである。
 * @failure 形式不正、不明ID、Verifier不一致、失効または重複Recordを安全に拒否する。
 * @invariant Profile名からGrantを再生成せず現在Recordの明示値を使う。
 * @boundary Remote Bearer認証→Request Access Context。
 * @security 比較はtimingSafeEqualを用い、無効TokenへCredential状態を開示しない。
 * @concurrency 一回のRegistry Snapshotだけを照合に使用する。
 */
export function authenticateConnectionCredential(
  registry: ConnectionCredentialRegistry,
  token: string,
): ConnectionCredentialAuthenticationResult {
  const parts = token.split(".");
  const snapshot = registry.inspect();
  if (parts.length !== 4 || `${parts[0]}.${parts[1]}` !== TOKEN_PREFIX)
    return invalidAuthentication();
  const credentialId = parts[2] ?? "";
  const secret = parts[3] ?? "";
  const matches = snapshot.records.filter(
    (record) => record.credentialId === credentialId,
  );
  if (matches.length > 1)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_registry_conflicting",
      access: null,
    });
  const record = matches[0];
  if (!record || !verifySecret(secret, record)) return invalidAuthentication();
  if (record.revoked)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_revoked",
      access: null,
    });
  return Object.freeze({
    status: "available",
    reason: "connection_credential_authenticated",
    access: Object.freeze({
      credentialId: record.credentialId,
      profile: record.profile,
      workspaceIds: Object.freeze([...record.workspaceIds]),
      systemAdmin: record.systemAdmin,
      registryRevision: snapshot.revision,
    }),
  });
}

/**
 * 管理Credentialから対象Credentialを失効する。
 *
 * @responsibility 次Requestから対象Credentialを拒否する現在状態をRegistryへ公開する。
 * @trace ARCH-000013
 * @input registry、管理Access Contextおよび対象credentialId。
 * @returns Effect件数を含む構造化変更結果。
 * @precondition actor.systemAdmin=trueで対象Recordが一意に存在する。
 * @postcondition 成功時は対象Recordのrevoked=trueかつrevisionが一つ進む。
 * @effect Credential Recordを一件更新する。
 * @failure Authority不足、不明対象またはRegistry競合をEffect 0で返す。
 * @invariant Repository、Project Contextおよび他Credentialを変更しない。
 * @boundary 管理CLI／Workbench→Credential Application→Registry。
 * @security 生Token、saltまたはVerifierを結果へ返さない。
 * @concurrency inspectしたrevisionとpublish時revisionの一致を要求し、自動再試行しない。
 */
export function revokeConnectionCredential(
  registry: ConnectionCredentialRegistry,
  actor: RequestAccessContext,
  credentialId: string,
): ConnectionCredentialChangeResult {
  if (!actor.systemAdmin)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_admin_required",
      registryEffectCount: 0,
    });
  const snapshot = registry.inspect();
  const index = snapshot.records.findIndex(
    (record) => record.credentialId === credentialId,
  );
  if (index < 0)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_not_found",
      registryEffectCount: 0,
    });
  const current = snapshot.records[index];
  if (!current)
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_not_found",
      registryEffectCount: 0,
    });
  const records = [...snapshot.records];
  records[index] = Object.freeze({
    ...current,
    revoked: true,
    revision: current.revision + 1,
  });
  if (!registry.publish(snapshot.revision, records))
    return Object.freeze({
      status: "blocked",
      reason: "connection_credential_registry_conflict",
      registryEffectCount: 0,
    });
  return Object.freeze({
    status: "completed",
    reason: "connection_credential_revoked",
    registryEffectCount: 1,
  });
}

/**
 * 対象Credentialを失効し、同じ明示Grantを持つ新Credentialへローテーションする。
 *
 * @responsibility 旧Credentialの再利用停止と新Tokenの一度表示を一つの不変Registry publishで成立させる。
 * @trace ARCH-000013
 * @input registry、管理Access Context、対象credentialIdおよび乱数Provider。
 * @returns 旧Credential ID、新Recordおよび一度表示Token、またはEffect 0のblocked結果。
 * @precondition actor.systemAdmin=trueで、対象Recordが一意かつ現在有効である。
 * @postcondition 成功時は旧Recordが失効し、同じProfile／明示Grantの新Recordが一件追加される。
 * @effect Credential Registryを一回publishする。
 * @failure Authority不足、不明・失効済み対象またはrevision競合をblockedへ変換する。
 * @invariant 旧Tokenを再表示せず、ProfileからGrantを再推定しない。
 * @boundary 管理CLI／Workbench→Credential Application→Registry。
 * @security 新Tokenだけを結果へ一度返し、Registryにはsalt付きVerifierだけを保存する。
 * @concurrency 旧失効と新発行を同じexpected revisionのpublishへ閉じ、自動再試行しない。
 */
export function rotateConnectionCredential(
  registry: ConnectionCredentialRegistry,
  actor: RequestAccessContext,
  credentialId: string,
  random: CredentialRandomBytes = randomBytes,
): ConnectionCredentialRotationResult {
  if (!actor.systemAdmin)
    return blockedRotation(
      "connection_credential_admin_required",
      credentialId,
    );
  const snapshot = registry.inspect();
  const index = snapshot.records.findIndex(
    (record) => record.credentialId === credentialId && !record.revoked,
  );
  const current = index < 0 ? undefined : snapshot.records[index];
  if (!current)
    return blockedRotation("connection_credential_not_found", credentialId);
  const nextCredentialId = random(12).toString("hex");
  const secret = random(32).toString("base64url");
  const salt = random(16).toString("hex");
  const next: ConnectionCredentialRecord = Object.freeze({
    credentialId: nextCredentialId,
    profile: current.profile,
    workspaceIds: Object.freeze([...current.workspaceIds]),
    systemAdmin: current.systemAdmin,
    revoked: false,
    tokenVersion: 1,
    tokenSalt: salt,
    tokenVerifier: deriveVerifier(secret, salt),
    revision: 1,
  });
  const records = [...snapshot.records];
  records[index] = Object.freeze({
    ...current,
    revoked: true,
    revision: current.revision + 1,
  });
  records.push(next);
  if (!registry.publish(snapshot.revision, records))
    return blockedRotation(
      "connection_credential_registry_conflict",
      credentialId,
    );
  return Object.freeze({
    status: "completed",
    reason: "connection_credential_rotated",
    previousCredentialId: credentialId,
    record: toMetadata(next),
    token: `${TOKEN_PREFIX}.${nextCredentialId}.${secret}`,
  });
}

/**
 * Secretから固定長Verifierを導出する。
 *
 * @responsibility scryptの設定を一箇所へ閉じ、発行と照合で同じ導出を使用する。
 * @trace ARCH-000013
 * @input secretとhex salt。
 * @returns 32byte Verifierのhex表現。
 * @precondition secretは空でなくsaltは発行時に生成した16byte値である。
 * @postcondition 入力を変更せず固定長文字列を返す。
 * @effect N/A: CPU内で導出するだけである。
 * @failure 暗号Runtimeの失敗は呼出し側へ例外として返る。
 * @invariant 生Secretを返値へ含めない。
 * @boundary Credential ApplicationとNode暗号Runtimeの境界。
 * @security scryptを使用し高速な単純HashだけでTokenを保存しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function deriveVerifier(secret: string, salt: string): string {
  return scryptSync(secret, Buffer.from(salt, "hex"), VERIFIER_BYTES).toString(
    "hex",
  );
}

/**
 * 入力Secretと保存Verifierを一定時間比較する。
 *
 * @responsibility Token Secretの一致だけをbooleanへ変換する。
 * @trace ARCH-000013
 * @input secretと保存済みCredential Record。
 * @returns Verifierが一致する場合だけtrue。
 * @precondition record.tokenVersion=1である。
 * @postcondition RecordとSecretを保存・変更しない。
 * @effect N/A: CPU内で照合するだけである。
 * @failure 不正Verifier長または導出失敗をfalseへ閉じる。
 * @invariant 比較前に同じbyte長を確認する。
 * @boundary Credential Verifier内部境界。
 * @security timingSafeEqualで比較する。
 * @concurrency N/A: 共有状態を持たない。
 */
function verifySecret(
  secret: string,
  record: ConnectionCredentialRecord,
): boolean {
  try {
    const actual = Buffer.from(deriveVerifier(secret, record.tokenSalt), "hex");
    const expected = Buffer.from(record.tokenVerifier, "hex");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

/**
 * 無効Credentialの共通非開示結果を返す。
 *
 * @responsibility 形式不正、不明IdentityおよびVerifier不一致を同じ公開結果へ畳む。
 * @trace ARCH-000013
 * @input N/A: 固定結果だけを返す。
 * @returns connection_credential_invalidのblocked結果。
 * @precondition 呼出し側が詳細理由を外部公開してはならない失敗を検出済みである。
 * @postcondition Access Contextを返さない。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 常に固定結果を返す。
 * @invariant Credentialの存在、状態またはProfileを含めない。
 * @boundary Credential Verifier内部とRemote公開結果の境界。
 * @security 認証Oracleとなる詳細理由を公開しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function invalidAuthentication(): ConnectionCredentialAuthenticationResult {
  return Object.freeze({
    status: "blocked",
    reason: "connection_credential_invalid",
    access: null,
  });
}

/**
 * 保存Recordを管理公開用Metadataへ縮小する。
 *
 * @responsibility Credential管理に不要なVerifierとsaltを公開境界から除外する。
 * @trace ARCH-000013
 * @input 保存済みConnectionCredentialRecord。
 * @returns freezeしたConnectionCredentialMetadata。
 * @precondition recordはRegistry Schemaを満たす。
 * @postcondition 認証材料を含まない新しい値を返す。
 * @effect N/A: 値を投影するだけである。
 * @failure N/A: 完全なRecord型だけを受ける。
 * @invariant Identity、Profile、明示Grant、状態およびrevisionの意味を変えない。
 * @boundary Credential Registry内部値と管理公開結果の境界。
 * @security tokenSalt、tokenVerifierおよび生Tokenを返さない。
 * @concurrency N/A: 一つの不変Recordを読む。
 */
function toMetadata(
  record: ConnectionCredentialRecord,
): ConnectionCredentialMetadata {
  return Object.freeze({
    credentialId: record.credentialId,
    profile: record.profile,
    workspaceIds: Object.freeze([...record.workspaceIds]),
    systemAdmin: record.systemAdmin,
    revoked: record.revoked,
    revision: record.revision,
  });
}

/**
 * ローテーション失敗の共通Effect 0結果を返す。
 *
 * @responsibility 失敗理由と対象Credential IDをTokenなしの固定形へ揃える。
 * @trace ARCH-000013
 * @input reasonとpreviousCredentialId。
 * @returns Record／Tokenを持たないblocked結果。
 * @precondition reasonは公開可能な管理操作理由である。
 * @postcondition Registryを変更しない。
 * @effect N/A: 固定結果を返すだけである。
 * @failure N/A: 閉じた理由型だけを受ける。
 * @invariant Secret、saltまたはVerifierを含めない。
 * @boundary Credential Application内部と管理公開結果の境界。
 * @security 対象IDは認証済み管理者へだけ返す前提である。
 * @concurrency N/A: 共有状態を持たない。
 */
function blockedRotation(
  reason:
    | "connection_credential_admin_required"
    | "connection_credential_not_found"
    | "connection_credential_registry_conflict",
  previousCredentialId: string,
): ConnectionCredentialRotationResult {
  return Object.freeze({
    status: "blocked",
    reason,
    previousCredentialId,
    record: null,
    token: null,
  });
}
