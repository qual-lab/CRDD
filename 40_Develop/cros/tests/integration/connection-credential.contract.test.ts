/**
 * CROS Connection Credentialの発行、照合、失効および競合を検証する。
 *
 * @packageDocumentation
 * @responsibility 固定Profileから明示Grantを生成し、Bearer Secretを保存せずRequest Access Contextへ変換する契約を検証する。
 * @trace RFD-IT-013
 * @level IT
 * @scope cros、credential、authentication、workspace、revocation
 * @boundary RFD-IT-013=Direct Boundary: 管理Access→Credential Registry→Bearer認証→Request Access Context。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCredentialAccessRecovery,
  authenticateConnectionCredential,
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  listConnectionCredentials,
  planCredentialAccessRecovery,
  resolveCredentialProfileDefaults,
  revokeConnectionCredential,
  rotateConnectionCredential,
  updateConnectionCredentialAccess,
  type ConnectionCredentialRegistry,
  type CredentialAccessRecoveryRecorder,
  type CredentialRandomBytes,
  type RequestAccessContext,
} from "../../src/index.ts";

const ADMINISTRATOR: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});

/**
 * 決定論的なCredential乱数Providerを作成する。
 *
 * @responsibility 試験ごとに再現可能かつ各要求で異なるbyte列を返す。
 * @trace RFD-IT-013
 * @input N/A: 内部counterだけを初期化する。
 * @returns 要求byte数を満たすCredentialRandomBytes関数。
 * @precondition 本Providerを本番へ渡さない。
 * @stimulus 要求byte数を指定してProviderを呼び出す。
 * @observation 返却byte列と内部counterの進行を観測する。
 * @oracle 同じ開始状態では同じ順序となり、呼出し間ではbyte列が異なる。
 * @cleanup N/A: Process内counter以外の資源を生成しない。
 * @postcondition 呼出しごとにcounterが一つ進む。
 * @effect 試験Process内counterだけを更新する。
 * @failure N/A: 正のbyte数に対して必ずBufferを返す。
 * @invariant 同じ試験実行では同じ順序のbyte列を返す。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 * @security 本番Secret生成には使用しない。
 * @concurrency node:testの直列実行内でだけ使用する。
 */
function createDeterministicRandom(): CredentialRandomBytes {
  let counter = 1;
  return (size: number) => {
    const value = Buffer.alloc(size, counter);
    counter += 1;
    return value;
  };
}

/**
 * Credential Access Recovery試験用の秘密非保持Recorderを作成する。
 *
 * @responsibility prepareとsettleの呼出しを受理し、Recovery Applicationの正常経路を局所検証可能にする。
 * @trace RFD-IT-013
 * @input N/A: 外部状態を持たないRecorderを生成する。
 * @returns 両操作を成功させるCredentialAccessRecoveryRecorder。
 * @precondition 本Recorderを本番の耐久記録へ使用しない。
 * @stimulus prepareとsettleへ試験用入力を渡す。
 * @observation 各操作の成功結果を観測する。
 * @oracle 両操作がtrueを返し、秘密値または入力を保存しない。
 * @cleanup N/A: 共有資源を生成しない。
 * @postcondition 入力plan／resultを保存しない。
 * @effect N/A: 呼出しごとにtrueを返すだけである。
 * @failure N/A: 失敗を注入しない。
 * @invariant Token、saltおよびVerifierを受理しない型契約を維持する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 * @security 本番Evidenceとして使用しない。
 * @concurrency 共有状態を持たない。
 */
function createRecoveryRecorder(): CredentialAccessRecoveryRecorder {
  return Object.freeze({
    prepare: () => true,
    settle: () => true,
  });
}

/**
 * 三Profileの初期Grantが権限階層を作らないことを検証する。
 *
 * @responsibility Administratorの管理可否とManagement／DeveloperのContent Grantを分離して観測する。
 * @trace RFD-IT-013
 * @precondition 固定三Profileを入力する。
 * @stimulus 各Profileの推奨初期値を解決する。
 * @observation workspaceIdsとsystemAdminを観測する。
 * @oracle AdministratorはContent Grantなし、Managementは二Workspace、DeveloperはDevelopmentだけを持つ。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("三Profileを明示Grantへ変換し権限階層を作らない", () => {
  assert.deepEqual(resolveCredentialProfileDefaults("administrator"), {
    workspaceIds: [],
    systemAdmin: true,
  });
  assert.deepEqual(resolveCredentialProfileDefaults("management"), {
    workspaceIds: ["development", "management"],
    systemAdmin: false,
  });
  assert.deepEqual(resolveCredentialProfileDefaults("developer"), {
    workspaceIds: ["development"],
    systemAdmin: false,
  });
});

/**
 * Credentialを発行して現在RecordからRequest Access Contextを生成することを検証する。
 *
 * @responsibility Secret一度表示、Verifier保存およびRequest単位認証を一つの縦断Contractで観測する。
 * @trace RFD-IT-013
 * @precondition 空Registry、Administrator Accessおよび決定論的乱数を用意する。
 * @stimulus Management Credentialを発行し、返されたTokenを照合する。
 * @observation 発行結果、保存RecordおよびAccess Contextを観測する。
 * @oracle RegistryへTokenを保存せずDevelopment／Management Grantだけを返す。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Secretを一度だけ返し現在RecordからAccess Contextを生成する", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(
    registry,
    ADMINISTRATOR,
    { profile: "management" },
    createDeterministicRandom(),
  );
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") assert.fail("credential must be issued");
  assert.match(issued.token, /^cros\.v1\.[0-9a-f]+\.[A-Za-z0-9_-]+$/);
  assert.equal("tokenSalt" in issued.record, false);
  assert.equal("tokenVerifier" in issued.record, false);
  const stored = registry.inspect().records[0];
  assert.ok(stored);
  assert.equal(JSON.stringify(stored).includes(issued.token), false);
  assert.equal("token" in stored, false);
  assert.deepEqual(authenticateConnectionCredential(registry, issued.token), {
    status: "available",
    reason: "connection_credential_authenticated",
    access: {
      credentialId: issued.record.credentialId,
      profile: "management",
      workspaceIds: ["development", "management"],
      systemAdmin: false,
      credentialRegistryRevision: 1,
    },
  });
});

/**
 * 不正Tokenと非管理Credentialによる発行をEffect 0で拒否することを検証する。
 *
 * @responsibility 認証Oracleと管理Authority昇格を防ぐ。
 * @trace RFD-IT-013
 * @precondition 空RegistryとDeveloper Access Contextを用意する。
 * @stimulus 不正Tokenを照合し、DeveloperからCredential発行を要求する。
 * @observation 公開reason、Access Context、Record件数を観測する。
 * @oracle 不正Tokenは詳細非開示、非管理発行はblocked、Registryは空のままとなる。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("不正Tokenと非管理発行を情報非開示かつEffect 0で拒否する", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  assert.deepEqual(authenticateConnectionCredential(registry, "invalid"), {
    status: "blocked",
    reason: "connection_credential_invalid",
    access: null,
  });
  const result = issueConnectionCredential(
    registry,
    {
      credentialId: "developer",
      profile: "developer",
      workspaceIds: ["development"],
      systemAdmin: false,
      credentialRegistryRevision: 0,
    },
    { profile: "developer" },
    createDeterministicRandom(),
  );
  assert.equal(result.status, "blocked");
  assert.equal(registry.inspect().records.length, 0);
});

/**
 * 失効を次Requestから反映しProduct Dataを変更しないことを検証する。
 *
 * @responsibility Credential失効前後の認証結果を同じTokenで比較する。
 * @trace RFD-IT-013
 * @precondition 有効なDeveloper Credentialを一件発行する。
 * @stimulus 認証、失効、同じTokenで再認証を順に行う。
 * @observation Registry revision、Record状態および認証結果を観測する。
 * @oracle 失効前はavailable、失効後はrevokedとなり、他のStore Effectを要求しない。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("失効を次Requestから反映する", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(
    registry,
    ADMINISTRATOR,
    { profile: "developer" },
    createDeterministicRandom(),
  );
  if (issued.status !== "completed") assert.fail("credential must be issued");
  assert.equal(
    authenticateConnectionCredential(registry, issued.token).status,
    "available",
  );
  assert.deepEqual(
    revokeConnectionCredential(
      registry,
      { ...ADMINISTRATOR, credentialRegistryRevision: 1 },
      issued.record.credentialId,
    ),
    {
      status: "completed",
      reason: "connection_credential_revoked",
      registryEffectCount: 1,
    },
  );
  assert.deepEqual(authenticateConnectionCredential(registry, issued.token), {
    status: "blocked",
    reason: "connection_credential_revoked",
    access: null,
  });
});

/**
 * ローテーションで旧Tokenを失効し新Tokenだけを一度返すことを検証する。
 *
 * @responsibility 旧失効と新発行が同じRegistry revisionで不可分に公開されることを観測する。
 * @trace RFD-IT-013
 * @precondition 有効なManagement Credentialを一件発行する。
 * @stimulus Administratorが対象Credentialをローテーションする。
 * @observation 旧・新Tokenの認証結果、Record集合および明示Grantを観測する。
 * @oracle 旧Tokenはrevoked、新Tokenは同じ明示Grantでavailable、Registryには二Recordが残る。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("旧失効と新発行を一つのRegistry更新でローテーションする", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const random = createDeterministicRandom();
  const issued = issueConnectionCredential(
    registry,
    ADMINISTRATOR,
    { profile: "management" },
    random,
  );
  if (issued.status !== "completed") assert.fail("credential must be issued");
  const rotated = rotateConnectionCredential(
    registry,
    { ...ADMINISTRATOR, credentialRegistryRevision: 1 },
    issued.record.credentialId,
    random,
  );
  assert.equal(rotated.status, "completed");
  if (rotated.status !== "completed") assert.fail("credential must rotate");
  assert.deepEqual(authenticateConnectionCredential(registry, issued.token), {
    status: "blocked",
    reason: "connection_credential_revoked",
    access: null,
  });
  const next = authenticateConnectionCredential(registry, rotated.token);
  assert.equal(next.status, "available");
  if (next.status !== "available")
    assert.fail("rotated token must authenticate");
  assert.deepEqual(next.access.workspaceIds, ["development", "management"]);
  assert.equal(registry.inspect().records.length, 2);
});

/**
 * 管理一覧が認証材料を除外し、明示Grant更新を次Requestへ反映することを検証する。
 *
 * @responsibility 管理表示とGrant編集がProfile推定やVerifier公開なしに成立することを観測する。
 * @trace RFD-IT-013
 * @precondition 有効なDeveloper Credentialを一件発行する。
 * @stimulus 管理一覧を取得し、Workspace集合をmanagementだけへ更新して同じTokenを再認証する。
 * @observation Metadata field、Registry revisionおよび更新後Access Contextを観測する。
 * @oracle 一覧に認証材料がなく、Profileはdeveloperのまま、実効Grantだけが明示更新される。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("管理Metadataだけを表示し明示Grant更新を次Requestへ反映する", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(
    registry,
    ADMINISTRATOR,
    { profile: "developer" },
    createDeterministicRandom(),
  );
  if (issued.status !== "completed") assert.fail("credential must be issued");
  const listed = listConnectionCredentials(registry, {
    ...ADMINISTRATOR,
    credentialRegistryRevision: 1,
  });
  assert.equal(listed.status, "available");
  if (listed.status !== "available") assert.fail("metadata must be available");
  assert.equal("tokenSalt" in (listed.credentials[0] ?? {}), false);
  assert.equal("tokenVerifier" in (listed.credentials[0] ?? {}), false);
  assert.deepEqual(
    updateConnectionCredentialAccess(
      registry,
      { ...ADMINISTRATOR, credentialRegistryRevision: 1 },
      issued.record.credentialId,
      { workspaceIds: ["management"], systemAdmin: false },
    ),
    {
      status: "completed",
      reason: "connection_credential_access_updated",
      registryEffectCount: 1,
    },
  );
  const authenticated = authenticateConnectionCredential(
    registry,
    issued.token,
  );
  assert.equal(authenticated.status, "available");
  if (authenticated.status !== "available")
    assert.fail("updated credential must authenticate");
  assert.equal(authenticated.access.profile, "developer");
  assert.deepEqual(authenticated.access.workspaceIds, ["management"]);
});

/**
 * 非管理CredentialへCredential一覧を開示しないことを検証する。
 *
 * @responsibility 管理能力不足を空一覧や件数0と誤認させずblockedへ変換する。
 * @trace RFD-IT-013
 * @precondition 空RegistryとDeveloper Access Contextを用意する。
 * @stimulus Credential一覧を要求する。
 * @observation status、reason、revisionおよびcredentialsを観測する。
 * @oracle blocked、revision=null、空の公開配列となり、実件数を主張しない。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("非管理CredentialへCredential Identityと件数を開示しない", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  assert.deepEqual(
    listConnectionCredentials(registry, {
      credentialId: "developer",
      profile: "developer",
      workspaceIds: ["development"],
      systemAdmin: false,
      credentialRegistryRevision: 0,
    }),
    {
      status: "blocked",
      reason: "connection_credential_admin_required",
      registryRevision: null,
      credentials: [],
    },
  );
});

/**
 * Registry競合時に発行を自動再試行しないことを検証する。
 *
 * @responsibility publish競合をSecret再生成や重複Recordへ変換しない。
 * @trace RFD-IT-013
 * @precondition publishを常に拒否するRegistry Portを用意する。
 * @stimulus AdministratorからDeveloper Credentialを発行する。
 * @observation 結果reasonと公開Record／Tokenを観測する。
 * @oracle registry_conflictかつRecord／Tokenなしで終了する。
 * @cleanup N/A: Registry Effectは発生しない。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Registry競合を自動再試行せずTokenを公開しない", () => {
  const conflicting: ConnectionCredentialRegistry = {
    inspect: () => ({ revision: 2, records: [] }),
    publish: () => false,
  };
  assert.deepEqual(
    issueConnectionCredential(
      conflicting,
      ADMINISTRATOR,
      { profile: "developer" },
      createDeterministicRandom(),
    ),
    {
      status: "blocked",
      reason: "connection_credential_registry_conflict",
      record: null,
      token: null,
    },
  );
});

/**
 * Host Recoveryで旧管理Credentialだけを失効し通常Credentialを保持することを検証する。
 *
 * @responsibility Administrator Recoveryの対象選択、明示確認、不可分Registry更新およびContent GrantなしBootstrapを観測する。
 * @trace RFD-IT-013
 * @precondition 有効なAdministratorとDeveloper Credentialを同じRegistryへ発行する。
 * @stimulus Host AuthorityでRecoveryを計画し、表示内容を確認して適用する。
 * @observation 失効対象、保持対象、Registry revision、旧・新Tokenの認証結果を観測する。
 * @oracle 旧Administratorだけが失効し、Developerは維持され、新AdministratorはworkspaceIdsを持たない。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Administrator Recoveryを一revisionで適用し通常Credentialを保持する", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const random = createDeterministicRandom();
  const oldAdmin = issueConnectionCredential(
    registry,
    ADMINISTRATOR,
    { profile: "administrator" },
    random,
  );
  const developer = issueConnectionCredential(
    registry,
    { ...ADMINISTRATOR, credentialRegistryRevision: 1 },
    { profile: "developer" },
    random,
  );
  if (oldAdmin.status !== "completed" || developer.status !== "completed")
    assert.fail("credentials must be issued");
  const planned = planCredentialAccessRecovery(
    registry,
    {
      hostAuthorityConfirmed: true,
      mode: "administrator_recovery",
      recoveryId: "credential-access-recovery.11111111111111111111111111111111",
    },
    random,
  );
  assert.equal(planned.status, "ready");
  if (planned.status !== "ready") assert.fail("recovery plan must be ready");
  assert.deepEqual(planned.plan.revokeCredentialIds, [
    oldAdmin.record.credentialId,
  ]);
  assert.deepEqual(planned.plan.preserveCredentialIds, [
    developer.record.credentialId,
  ]);
  assert.equal(planned.plan.productDataEffect, false);
  const recovered = applyCredentialAccessRecovery(
    registry,
    planned.plan,
    true,
    createRecoveryRecorder(),
    random,
  );
  assert.equal(recovered.status, "completed");
  if (recovered.status !== "completed") assert.fail("recovery must complete");
  assert.equal(registry.inspect().revision, 3);
  assert.equal(
    authenticateConnectionCredential(registry, oldAdmin.token).status,
    "blocked",
  );
  assert.equal(
    authenticateConnectionCredential(registry, developer.token).status,
    "available",
  );
  const nextAdmin = authenticateConnectionCredential(registry, recovered.token);
  assert.equal(nextAdmin.status, "available");
  if (nextAdmin.status !== "available")
    assert.fail("bootstrap administrator must authenticate");
  assert.deepEqual(nextAdmin.access.workspaceIds, []);
  assert.equal(nextAdmin.access.systemAdmin, true);
});

/**
 * Full Access Resetと確認前Effect 0を検証する。
 *
 * @responsibility 全Credential失効の強いRecoveryを確認なしで実行せず、確認後だけ新管理入口を作る。
 * @trace RFD-IT-013
 * @precondition 有効なManagement Credentialを一件発行してFull Access Reset計画を固定する。
 * @stimulus 未確認適用の後、同じ計画を確認済みで適用する。
 * @observation 各結果、Registry revision、旧Tokenおよび新Tokenの認証結果を観測する。
 * @oracle 未確認時はEffect 0、確認後は旧Credential失効と新Administrator発行が一revisionで成立する。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Full Access Resetを明示確認後だけ適用する", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const random = createDeterministicRandom();
  const management = issueConnectionCredential(
    registry,
    ADMINISTRATOR,
    { profile: "management" },
    random,
  );
  if (management.status !== "completed")
    assert.fail("management credential must be issued");
  const planned = planCredentialAccessRecovery(
    registry,
    {
      hostAuthorityConfirmed: true,
      mode: "full_access_reset",
      recoveryId: "credential-access-recovery.22222222222222222222222222222222",
    },
    random,
  );
  if (planned.status !== "ready") assert.fail("recovery plan must be ready");
  const unconfirmed = applyCredentialAccessRecovery(
    registry,
    planned.plan,
    false,
    createRecoveryRecorder(),
    random,
  );
  assert.equal(
    unconfirmed.reason,
    "credential_access_recovery_confirmation_required",
  );
  assert.equal(registry.inspect().revision, 1);
  const recovered = applyCredentialAccessRecovery(
    registry,
    planned.plan,
    true,
    createRecoveryRecorder(),
    random,
  );
  assert.equal(recovered.status, "completed");
  if (recovered.status !== "completed") assert.fail("full reset must complete");
  assert.equal(
    authenticateConnectionCredential(registry, management.token).status,
    "blocked",
  );
  assert.equal(
    authenticateConnectionCredential(registry, recovered.token).status,
    "available",
  );
});

/**
 * Recovery計画後のRegistry変更を古い確認結果で上書きしないことを検証する。
 *
 * @responsibility Humanが確認した対象集合と適用時Registryが異なる場合にEffect 0で停止する。
 * @trace RFD-IT-013
 * @precondition 空Registry revision 0でAdministrator Recovery計画を固定する。
 * @stimulus 計画後に別Credentialを発行し、古い計画を適用する。
 * @observation blocked reason、Registry revisionおよびRecord件数を観測する。
 * @oracle plan_staleで停止し、Recoveryによる追加revisionやTokenを作らない。
 * @cleanup Memory Registryを試験終了時に破棄する。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("古いRecovery計画をEffect 0で拒否する", () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const random = createDeterministicRandom();
  const planned = planCredentialAccessRecovery(
    registry,
    {
      hostAuthorityConfirmed: true,
      mode: "administrator_recovery",
      recoveryId: "credential-access-recovery.33333333333333333333333333333333",
    },
    random,
  );
  if (planned.status !== "ready") assert.fail("recovery plan must be ready");
  issueConnectionCredential(
    registry,
    ADMINISTRATOR,
    { profile: "developer" },
    random,
  );
  const result = applyCredentialAccessRecovery(
    registry,
    planned.plan,
    true,
    createRecoveryRecorder(),
    random,
  );
  assert.equal(result.reason, "credential_access_recovery_plan_stale");
  assert.equal(result.registryEffectCount, 0);
  assert.equal(registry.inspect().revision, 1);
});
