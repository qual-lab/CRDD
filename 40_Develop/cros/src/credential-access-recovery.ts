/**
 * CROS Credential管理不能時のHost限定Access Recoveryを提供する。
 *
 * @packageDocumentation
 * @responsibility Credential Registryだけを対象に、Recovery計画、明示確認、旧Credential失効およびBootstrap管理Credential発行を不可分に処理する。
 * @trace ARCH-000013
 * @boundary Server Host Authority、Credential Registryおよび管理CLIの境界。
 * @effect 確認済みRecoveryでCredential Registryを一revisionだけ更新する。
 * @security Remote CredentialをRecovery Authorityにせず、生Tokenを成功結果へ一度だけ返す。
 */

import { randomBytes } from "node:crypto";

import {
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  type ConnectionCredentialMetadata,
  type ConnectionCredentialRecord,
  type ConnectionCredentialRegistry,
  type ConnectionCredentialRegistrySnapshot,
  type CredentialRandomBytes,
  type RequestAccessContext,
} from "./connection-credential.ts";

const RECOVERY_ID = /^credential-access-recovery\.[a-f0-9]{32}$/u;

/**
 * Credential Access Recoveryの処置範囲を定義する。
 *
 * @responsibility 管理Credentialだけの回復と全Credential失効を区別する。
 * @trace ARCH-000013
 * @shape administrator_recoveryまたはfull_access_reset。
 * @invariant どちらもProduct Data、WorkspaceまたはRepository Exposureを変更しない。
 * @boundary Host Recovery UI／CLIとRecovery Applicationの境界。
 * @security Remote利用者が選択できる権限Profileではない。
 * @compatibility v0.22の二つのHost Recovery modeを表す。
 */
export type CredentialAccessRecoveryMode =
  | "administrator_recovery"
  | "full_access_reset";

/**
 * 人間確認前に表示するCredential Access Recovery計画を定義する。
 *
 * @responsibility 対象Credential、保持Credentialおよび非対象Effectを秘密値なしで固定する。
 * @trace ARCH-000013
 * @shape Recovery Identity、mode、Registry revision、失効対象、保持対象および新管理CredentialのGrant。
 * @invariant Credential ID集合は昇順かつ重複なしで、生TokenやVerifierを含まない。
 * @boundary Recovery ApplicationとHost確認Surfaceの境界。
 * @security Credentialのsalt、VerifierおよびTokenを公開しない。
 * @compatibility 計画と適用時Snapshotの一致確認に利用する。
 */
export type CredentialAccessRecoveryPlan = Readonly<{
  recoveryId: string;
  mode: CredentialAccessRecoveryMode;
  registryRevision: number;
  revokeCredentialIds: readonly string[];
  preserveCredentialIds: readonly string[];
  bootstrapWorkspaceIds: readonly [];
  bootstrapSystemAdmin: true;
  productDataEffect: false;
}>;

/**
 * Credential Access Recovery計画の生成結果を定義する。
 *
 * @responsibility Host Authority不足、不正Identity、Registry観測不能および利用可能計画を区別する。
 * @trace ARCH-000013
 * @shape readyまたはblockedの判別Union。
 * @invariant readyだけが確認可能なplanを持つ。
 * @boundary Host Recovery入口とCredential Registry観測の境界。
 * @security blocked結果へCredential IdentityやHost Pathを含めない。
 * @compatibility blockedはEffect 0を表す。
 */
export type CredentialAccessRecoveryPlanResult = Readonly<
  | {
      status: "ready";
      reason: "credential_access_recovery_plan_ready";
      plan: CredentialAccessRecoveryPlan;
    }
  | {
      status: "blocked";
      reason:
        | "credential_access_recovery_host_authority_required"
        | "credential_access_recovery_identity_invalid"
        | "credential_access_recovery_registry_unavailable";
      plan: null;
    }
>;

/**
 * Credential Access Recovery適用結果を定義する。
 *
 * @responsibility Registry Effect、Bootstrap Credentialおよび再入場可否を同じ結果へ結合する。
 * @trace ARCH-000013
 * @shape completedまたはblockedとEffect件数、Recovery Identity、RecordおよびToken。
 * @invariant completedだけが一度表示Tokenを持ち、blockedはTokenを持たない。
 * @boundary Recovery ApplicationとHost CLI／Workbenchの境界。
 * @security Tokenを永続参照へ変換せず、Product Data情報を含めない。
 * @compatibility Registry競合と明示確認不足をEffect 0で返す。
 */
export type CredentialAccessRecoveryResult = Readonly<
  | {
      status: "completed";
      reason: "credential_access_recovery_completed";
      recoveryId: string;
      registryEffectCount: 1;
      revokedCredentialIds: readonly string[];
      record: ConnectionCredentialMetadata;
      token: string;
    }
  | {
      status: "blocked";
      reason:
        | "credential_access_recovery_confirmation_required"
        | "credential_access_recovery_plan_stale"
        | "credential_access_recovery_registry_unavailable"
        | "credential_access_recovery_record_unavailable"
        | "credential_access_recovery_registry_conflict";
      recoveryId: string;
      registryEffectCount: 0;
      revokedCredentialIds: readonly [];
      record: null;
      token: null;
    }
  | {
      status: "recovery_required";
      reason: "credential_access_recovery_record_unconfirmed";
      recoveryId: string;
      registryEffectCount: 1;
      revokedCredentialIds: readonly string[];
      record: null;
      token: null;
    }
>;

/**
 * Credential Access Recoveryの秘密を含まない耐久記録境界を定義する。
 *
 * @responsibility Registry Effect前の固定計画とEffect後の結果を同じRecovery Identityへ記録する。
 * @trace ARCH-000013
 * @shape prepareとsettleの二段階Port。
 * @invariant 生Token、saltおよびVerifierを受理しない。
 * @boundary Recovery ApplicationとOS管理Runtime記録の境界。
 * @security Credential MetadataはIDとEffect対象だけに限定する。
 * @compatibility 物理保存方式を差し替え可能にする。
 */
export type CredentialAccessRecoveryRecorder = Readonly<{
  prepare(plan: CredentialAccessRecoveryPlan): boolean;
  settle(
    recoveryId: string,
    result: Readonly<{
      status: "completed" | "blocked";
      reason: string;
      registryEffectCount: 0 | 1;
      revokedCredentialIds: readonly string[];
      issuedCredentialId: string | null;
    }>,
  ): boolean;
}>;

/**
 * Host限定Credential Access Recoveryの計画を生成する。
 *
 * @responsibility 現在Registryから失効対象と保持対象を決定し、人間確認可能な閉じた計画へ固定する。
 * @trace ARCH-000013
 * @input Registry、Host Authority確認、Recovery modeおよび任意のRecovery Identity／乱数Provider。
 * @returns 秘密値を含まないRecovery計画またはEffect 0のblocked結果。
 * @precondition CROS Serverを停止し、呼出し元がOS上のHost Authorityを別途確認する。
 * @postcondition Registryを変更せず、一つのSnapshot revisionだけを計画へ記録する。
 * @effect N/A: Registryを読取るだけである。
 * @failure Authority不足、不正IdentityまたはRegistry観測失敗をblockedへ変換する。
 * @invariant administrator_recoveryは未失効Adminだけ、full_access_resetは全未失効Credentialを対象にする。
 * @boundary Host Authority→Recovery Planning→Credential Registry。
 * @security Recovery Identityは秘密ではなく、生Tokenを生成しない。
 * @concurrency 計画revisionを適用時の楽観的排他条件として固定する。
 */
export function planCredentialAccessRecovery(
  registry: ConnectionCredentialRegistry,
  input: Readonly<{
    hostAuthorityConfirmed: boolean;
    mode: CredentialAccessRecoveryMode;
    recoveryId?: string;
  }>,
  random: CredentialRandomBytes = randomBytes,
): CredentialAccessRecoveryPlanResult {
  if (!input.hostAuthorityConfirmed)
    return blockedPlan("credential_access_recovery_host_authority_required");
  const recoveryId =
    input.recoveryId ??
    `credential-access-recovery.${random(16).toString("hex")}`;
  if (!RECOVERY_ID.test(recoveryId))
    return blockedPlan("credential_access_recovery_identity_invalid");
  let snapshot: ConnectionCredentialRegistrySnapshot;
  try {
    snapshot = registry.inspect();
  } catch {
    return blockedPlan("credential_access_recovery_registry_unavailable");
  }
  const activeRecords = snapshot.records.filter((record) => !record.revoked);
  const revokeCredentialIds = activeRecords
    .filter(
      (record) => input.mode === "full_access_reset" || record.systemAdmin,
    )
    .map((record) => record.credentialId)
    .sort();
  const revokeSet = new Set(revokeCredentialIds);
  const preserveCredentialIds = activeRecords
    .filter((record) => !revokeSet.has(record.credentialId))
    .map((record) => record.credentialId)
    .sort();
  return Object.freeze({
    status: "ready",
    reason: "credential_access_recovery_plan_ready",
    plan: Object.freeze({
      recoveryId,
      mode: input.mode,
      registryRevision: snapshot.revision,
      revokeCredentialIds: Object.freeze(revokeCredentialIds),
      preserveCredentialIds: Object.freeze(preserveCredentialIds),
      bootstrapWorkspaceIds: Object.freeze([] as const),
      bootstrapSystemAdmin: true,
      productDataEffect: false,
    }),
  });
}

/**
 * 確認済みCredential Access Recovery計画を一つのRegistry revisionで適用する。
 *
 * @responsibility 選択した旧Credential失効とContent Grantなしの新管理Credential発行を不可分に公開する。
 * @trace ARCH-000013
 * @input Registry、固定済みplan、人間確認結果およびCredential乱数Provider。
 * @returns 一度表示Tokenを含む完了結果またはEffect 0のblocked結果。
 * @precondition Host Authority確認済みのplanを人間が内容確認し、confirmed=trueを明示する。
 * @postcondition 成功時だけRegistry revisionが一つ進み、対象失効と新管理Credentialが同時に観測できる。
 * @effect Credential Registryを一revision更新する。
 * @failure 未確認、古いplan、Registry観測失敗またはpublish競合をToken非公開で拒否する。
 * @invariant Product Data、Workspace、Exposureおよび保持対象Credentialを変更しない。
 * @boundary Host確認→Recovery Application→Credential Registry。
 * @security 新CredentialはworkspaceIds=[]で、生Tokenは完了結果へ一度だけ返す。
 * @concurrency plan revisionと現在revisionが一致し、一回のreal Registry publishに成功した場合だけ完了する。
 */
export function applyCredentialAccessRecovery(
  registry: ConnectionCredentialRegistry,
  plan: CredentialAccessRecoveryPlan,
  confirmed: boolean,
  recorder: CredentialAccessRecoveryRecorder,
  random: CredentialRandomBytes = randomBytes,
): CredentialAccessRecoveryResult {
  if (!confirmed)
    return blockedResult(
      plan.recoveryId,
      "credential_access_recovery_confirmation_required",
    );
  let snapshot: ConnectionCredentialRegistrySnapshot;
  try {
    snapshot = registry.inspect();
  } catch {
    return blockedResult(
      plan.recoveryId,
      "credential_access_recovery_record_unavailable",
    );
  }
  if (
    snapshot.revision !== plan.registryRevision ||
    !sameRecoveryTargets(snapshot.records, plan)
  )
    return blockedResult(
      plan.recoveryId,
      "credential_access_recovery_plan_stale",
    );
  if (!recorder.prepare(plan))
    return blockedResult(
      plan.recoveryId,
      "credential_access_recovery_registry_unavailable",
    );

  const revokeSet = new Set(plan.revokeCredentialIds);
  const revokedRecords = snapshot.records.map((record) =>
    revokeSet.has(record.credentialId) && !record.revoked
      ? Object.freeze({
          ...record,
          revoked: true,
          revision: record.revision + 1,
        })
      : record,
  );
  const candidate = createMemoryConnectionCredentialRegistry(revokedRecords);
  const issued = issueConnectionCredential(
    candidate,
    hostRecoveryActor(),
    { profile: "administrator", workspaceIds: [], systemAdmin: true },
    random,
  );
  if (issued.status !== "completed")
    return blockedResult(
      plan.recoveryId,
      "credential_access_recovery_registry_unavailable",
    );
  if (!registry.publish(snapshot.revision, candidate.inspect().records)) {
    recorder.settle(plan.recoveryId, {
      status: "blocked",
      reason: "credential_access_recovery_registry_conflict",
      registryEffectCount: 0,
      revokedCredentialIds: [],
      issuedCredentialId: null,
    });
    return blockedResult(
      plan.recoveryId,
      "credential_access_recovery_registry_conflict",
    );
  }
  if (
    !recorder.settle(plan.recoveryId, {
      status: "completed",
      reason: "credential_access_recovery_completed",
      registryEffectCount: 1,
      revokedCredentialIds: plan.revokeCredentialIds,
      issuedCredentialId: issued.record.credentialId,
    })
  )
    return Object.freeze({
      status: "recovery_required",
      reason: "credential_access_recovery_record_unconfirmed",
      recoveryId: plan.recoveryId,
      registryEffectCount: 1,
      revokedCredentialIds: plan.revokeCredentialIds,
      record: null,
      token: null,
    });
  return Object.freeze({
    status: "completed",
    reason: "credential_access_recovery_completed",
    recoveryId: plan.recoveryId,
    registryEffectCount: 1,
    revokedCredentialIds: plan.revokeCredentialIds,
    record: issued.record,
    token: issued.token,
  });
}

/**
 * 現在Registryが固定Recovery計画の対象集合と一致するか判定する。
 *
 * @responsibility 計画後のCredential状態変化を古い確認結果で上書きしない。
 * @trace ARCH-000013
 * @input 現在Record集合と固定済みRecovery plan。
 * @returns modeから再計算した失効・保持対象が一致する場合だけtrue。
 * @precondition planはplanCredentialAccessRecoveryの出力である。
 * @postcondition Registryを変更しない。
 * @effect N/A: 集合比較だけを行う。
 * @failure N/A: 不一致はfalseで返す。
 * @invariant Record順序に依存せずactive Credentialだけを比較する。
 * @boundary Recovery計画と現在Registry Snapshotの内部境界。
 * @security Verifierやsaltを比較・公開しない。
 * @concurrency Snapshot内の値だけを使う。
 */
function sameRecoveryTargets(
  records: readonly ConnectionCredentialRecord[],
  plan: CredentialAccessRecoveryPlan,
): boolean {
  const activeRecords = records.filter((record) => !record.revoked);
  const recalculatedRevokeIds = activeRecords
    .filter((record) => plan.mode === "full_access_reset" || record.systemAdmin)
    .map((record) => record.credentialId)
    .sort();
  const revokeSet = new Set(recalculatedRevokeIds);
  const recalculatedPreserveIds = activeRecords
    .filter((record) => !revokeSet.has(record.credentialId))
    .map((record) => record.credentialId)
    .sort();
  return (
    JSON.stringify(recalculatedRevokeIds) ===
      JSON.stringify(plan.revokeCredentialIds) &&
    JSON.stringify(recalculatedPreserveIds) ===
      JSON.stringify(plan.preserveCredentialIds)
  );
}

/**
 * Host Recovery内部だけで使うSystem Admin Access Contextを作る。
 *
 * @responsibility 通常Remote Credentialを偽装せず、既存発行ContractへHost Recovery Authorityを局所接続する。
 * @trace ARCH-000013
 * @input N/A: 固定Host Recovery actorを生成する。
 * @returns Content GrantなしのSystem Admin Access Context。
 * @precondition 呼出し元がHost Authorityと人間確認を検証済みである。
 * @postcondition Registryへactor Recordを保存しない。
 * @effect N/A: 値を生成するだけである。
 * @failure N/A: 固定値だけを返す。
 * @invariant workspaceIds=[]で、Remote認証へ公開しない。
 * @boundary Host Recovery Applicationと通常Credential発行Contractの内部境界。
 * @security 恒久的なBootstrap IdentityまたはBearer Tokenを作らない。
 * @concurrency N/A: 共有状態を持たない。
 */
function hostRecoveryActor(): RequestAccessContext {
  return Object.freeze({
    credentialId: "host-access-recovery",
    profile: "administrator",
    workspaceIds: Object.freeze([]),
    systemAdmin: true,
    credentialRegistryRevision: 0,
  });
}

/**
 * Recovery計画生成のblocked結果を作る。
 *
 * @responsibility blocked shapeと秘密非公開を一か所へ揃える。
 * @trace ARCH-000013
 * @input 固定blocked reason。
 * @returns plan=nullのblocked結果。
 * @precondition reasonは閉じた型集合に含まれる。
 * @postcondition Registry Effectを示す値を含めない。
 * @effect N/A: 値を生成するだけである。
 * @failure N/A: 閉じた型入力だけを受ける。
 * @invariant Credential Identityを含めない。
 * @boundary Recovery内部の結果構築境界。
 * @security Host Path、Token、Verifierを含めない。
 * @concurrency N/A: 共有状態を持たない。
 */
function blockedPlan(
  reason: Extract<
    CredentialAccessRecoveryPlanResult,
    { status: "blocked" }
  >["reason"],
): CredentialAccessRecoveryPlanResult {
  return Object.freeze({ status: "blocked", reason, plan: null });
}

/**
 * Recovery適用のEffect 0 blocked結果を作る。
 *
 * @responsibility blocked shape、Recovery Identity保持およびToken非公開を一か所へ揃える。
 * @trace ARCH-000013
 * @input Recovery Identityと固定blocked reason。
 * @returns Effect 0、Tokenなしのblocked結果。
 * @precondition recoveryIdは確認済みplan由来である。
 * @postcondition Registryを変更しない。
 * @effect N/A: 値を生成するだけである。
 * @failure N/A: 閉じた型入力だけを受ける。
 * @invariant revokedCredentialIdsを空にし、未確認Effectを主張しない。
 * @boundary Recovery内部の結果構築境界。
 * @security Token、VerifierまたはCredential Metadataを含めない。
 * @concurrency N/A: 共有状態を持たない。
 */
function blockedResult(
  recoveryId: string,
  reason: Extract<
    CredentialAccessRecoveryResult,
    { status: "blocked" }
  >["reason"],
): CredentialAccessRecoveryResult {
  return Object.freeze({
    status: "blocked",
    reason,
    recoveryId,
    registryEffectCount: 0,
    revokedCredentialIds: Object.freeze([] as const),
    record: null,
    token: null,
  });
}
