/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace RFD-IT-001
 * @trace RFD-IT-002
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import { resolveAiProfileManagementAccess } from "../../../src/index.ts";
import fs from "node:fs";
import path from "node:path";
import crypto, { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";
import { Writable } from "node:stream";
import {
  createFilesystemStoreRoot,
  readRepositoryProjectContext,
  createPortfolioProjection,
  type ProjectContextSource,
  type FilesystemStoreRoot,
} from "../../../../domain-model/src/index.ts";
import {
  type AccessManagementState,
  type UserRoleManagementResult,
  type CredentialManagementResult,
  type KeyExchangeResult,
  exchangeCredentials,
  exchangeCredentialsFromHost,
  readCredentialIssuance,
  registerRepository,
  unregisterRepository,
  updateExposure,
  authenticateCredential,
  authenticateNormalConnection,
  readCurrentAccess,
  readManagementState,
  resolveRepositoryAccess,
  resolveRepositoryAccessCollection,
  createCredentialMaterial,
  issueCredential,
  revokeCredential,
  registerUser,
  updateUserName,
  changeUserRole,
  updateRoleContentAccess,
  createInitialAdministrator,
  createInitialCredential,
  recordCredentialPresentation,
  initializeFromHost,
  readHostInitializationState,
  resolveConnectionAuthentication,
  confirmInitialConnection,
  verifyCredentialToken,
  initializeAccessManagementState,
  parseAccessManagementState,
  readAccessManagementState,
  updateAccessManagementState,
} from "../../../src/index.ts";

/**
 * 完了済み初回記録を持つ模擬現在状態を作る。
 * @responsibility 現在Userと歴史的資格IDを分ける。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 固定JSON値を作る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 生Secret・実Credentialは含まない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
function baseline(): AccessManagementState {
  return {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [
      {
        userId: "00000000-0000-4000-8000-000000000003",
        username: "模擬管理者",
        role: "administrator",
      },
    ],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    credentials: [],
    registeredRepositories: [],
    exposure: [],
    unresolvedKeyExchanges: [],
    initialization: {
      stage: "completed",
      attemptId: "00000000-0000-4000-8000-000000000002",
      initialUserId: "00000000-0000-4000-8000-000000000003",
      initialCredentialId: "0123456789abcdef01234567",
      confirmationCredentialId: "0123456789abcdef01234567",
      connection: "confirmed",
    },
  };
}

/**
 * 初回資格保存の前状態を作る。
 * @responsibility 本番と同じ相関・User保存を通して前状態を構築する。
 * @trace RFD-IT-024
 * @precondition 自己生成の試験Root。
 * @stimulus 初回相関と管理者を保存する。
 * @observation 両保存のcompletedを確認する。
 * @oracle 資格生成前のuser_storedに到達する。
 * @cleanup 呼出元FixtureがRoot不存在を確認する。
 * @boundary 初回保存と実Filesystem。
 */
function prepareInitialUser(f: ReturnType<typeof fixture>): string {
  fs.rmSync(path.join(f.directory, "access-management.json"));
  const attempt = "00000000-0000-4000-8000-000000000099";
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  assert.equal(
    createInitialAdministrator(f.root, attempt, "管理者").status,
    "completed",
  );
  return attempt;
}

/**
 * Host再入場は保存済み元試行と段階だけを再観測する。
 * @responsibility 不存在・相関・User・資格・提示・完了を追加生成せず搬送する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 自己生成Root。旧Host入力不存在は本試験の保証外。
 * @stimulus 最新AM入力を空にして初回各保存APIを順に呼び、各段階を読む。
 * @observation 段階・exact ID・改訂・秘密field不存在・current byteと材料。
 * @oracle freshは非Authority。元試行と生成済みIDを保持し、User/資格追加0・Secret再取得0。
 * @cleanup Fixtureがexact Rootを回収する。
 * @boundary 既存保存API→Host専用Reader。TTY・本番Hostは対象外。
 */
test("Host初回Readerはfreshから保存段階を非Authorityで再観測する", (t) => {
  const f = fixture(t),
    current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  assert.deepEqual(readHostInitializationState(f.root), { status: "fresh" });
  assert.equal(fs.existsSync(current), false);
  const attemptId = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(f.root, attemptId, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  assert.deepEqual(readHostInitializationState(f.root), {
    status: "in_progress",
    attemptId,
    revision: 1,
    stage: "correlated",
  });
  const user = createInitialAdministrator(f.root, attemptId, "管理者");
  assert.ok(user.status === "completed");
  assert.deepEqual(readHostInitializationState(f.root), {
    status: "in_progress",
    attemptId,
    revision: 2,
    stage: "user_stored",
    userId: user.value.userId,
  });
  const again = createInitialAdministrator(f.root, attemptId, "再入場の名前");
  assert.ok(again.status === "completed");
  assert.equal(again.value.userId, user.value.userId);
  const issued = createInitialCredential(f.root, attemptId);
  assert.ok(issued.status === "completed" && issued.value.token);
  const expected = {
    status: "in_progress",
    attemptId,
    revision: issued.value.revision,
    stage: "credential_stored",
    userId: user.value.userId,
    initialCredentialId: issued.value.credentialId,
    confirmationCredentialId: issued.value.credentialId,
    presentation: "not_attempted",
    unresolvedExchange: false,
  };
  assert.deepEqual(readHostInitializationState(f.root), expected);
  const reentered = createInitialCredential(f.root, attemptId);
  assert.ok(reentered.status === "completed");
  assert.equal(reentered.value.token, null);
  const start = recordCredentialPresentation(f.root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attemptId,
    expectedRevision: issued.value.revision,
    target: "unconfirmed",
  });
  assert.ok(start.status === "completed");
  assert.deepEqual(readHostInitializationState(f.root), {
    ...expected,
    revision: start.value.revision,
    presentation: "unconfirmed",
  });
  const completed = recordCredentialPresentation(f.root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attemptId,
    expectedRevision: start.value.revision,
    presentationOperationId: start.value.presentationOperationId,
    target: "confirmed",
  });
  assert.ok(completed.status === "completed");
  assert.deepEqual(readHostInitializationState(f.root), {
    ...expected,
    revision: completed.value.revision,
    presentation: "confirmed",
  });
  const binding = resolveConnectionAuthentication(f.root, issued.value.token);
  assert.ok(binding.status === "initial");
  assert.equal(
    confirmInitialConnection(
      f.root,
      issued.value.token,
      binding.binding,
      new AbortController().signal,
    ).status,
    "completed",
  );
  const before = fs.readFileSync(current);
  assert.deepEqual(readHostInitializationState(f.root), { status: "existing" });
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 部分材料や保存・Lock不明をfreshへ戻さない。
 * @responsibility Host初期化の再観測を固定unknownへ閉じ、残存材料を保持する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 自己生成Rootと限定した保存故障。
 * @stimulus current欠測＋pending/replace、破損current、初回base材料、Lock解放故障を与える。
 * @observation 固定unknown、currentと材料byte、Root一覧。
 * @oracle 不明は追加生成0・初期化許可0、Secret/Root/回復参照なし。
 * @cleanup hook復元とfixture回収。
 * @boundary Readerの実Filesystem負観測と既存排他。
 */
test("Host初回Readerは材料・状態・Lock不明をfreshへ丸めない", (t) => {
  const unknown = {
    status: "unknown",
    reason: "host_initialization_state_unavailable",
  };
  for (const material of [
    "access-management.pending.json",
    "access-management.replace.json",
  ]) {
    const f = fixture(t),
      current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    const target = path.join(f.directory, material);
    fs.writeFileSync(target, "{partial fixture");
    assert.deepEqual(readHostInitializationState(f.root), unknown);
    assert.equal(fs.readFileSync(target, "utf8"), "{partial fixture");
    assert.equal(fs.existsSync(current), false);
  }
  const f = fixture(t),
    current = path.join(f.directory, "access-management.json");
  const valid = fs.readFileSync(current);
  fs.writeFileSync(current, "{}");
  assert.deepEqual(readHostInitializationState(f.root), unknown);
  assert.equal(fs.readFileSync(current, "utf8"), "{}");
  fs.writeFileSync(current, valid);
  const remove = fs.rmSync;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("fixture unlock");
    return remove(target, options);
  };
  try {
    assert.deepEqual(readHostInitializationState(f.root), unknown);
  } finally {
    fs.rmSync = remove;
  }
  assert.deepEqual(readHostInitializationState(f.root), { status: "existing" });
  assert.deepEqual(fs.readFileSync(current), valid);
  const initial = fixture(t),
    initialPath = path.join(initial.directory, "access-management.json");
  fs.rmSync(initialPath);
  const attemptId = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(initial.root, attemptId, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const before = fs.readFileSync(initialPath),
    rename = fs.renameSync;
  fs.renameSync = (from, to) => {
    if (String(to) === initialPath) throw new Error("fixture rename");
    rename(from, to);
  };
  try {
    assert.equal(
      createInitialAdministrator(initial.root, attemptId, "管理者").status,
      "unavailable",
    );
  } finally {
    fs.renameSync = rename;
  }
  const pending = path.join(
    initial.directory,
    "access-management.pending.json",
  );
  const pendingBytes = fs.readFileSync(pending);
  assert.deepEqual(readHostInitializationState(initial.root), unknown);
  assert.deepEqual(fs.readFileSync(initialPath), before);
  assert.deepEqual(fs.readFileSync(pending), pendingBytes);
});

/**
 * User出版後の実Process喪失からHostが元試行を取り直す。
 * @responsibility 出版済み材料とLockのexact処置後に同Userを再開する。
 * @trace RFD-IT-025
 * @precondition 自己生成の相関済みRootと子Process。
 * @stimulus Userのcurrent置換直後に子Processをexit(23)する。
 * @observation 子終了code・stdout空、Readerのattempt/User、同ID再入場と材料不存在。
 * @oracle 保存済みUserを保持し、追加UUID0・Secret0、次資格だけ同試行へ結合。
 * @cleanup 子join済み、FixtureがRootを回収する。
 * @boundary 実子Process→保存→Host内部Reader→同元試行の既存Writer。
 */
test("Host初回ReaderはProcess喪失後の元試行とUserを再開できる", (t) => {
  const f = fixture(t),
    current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attemptId = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(f.root, attemptId, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const domainUrl = new URL(
    "../../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
  const script = `
    import fs from "node:fs";
    import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)};
    import {createInitialAdministrator} from ${JSON.stringify(storeUrl)};
    const rename = fs.renameSync;
    fs.renameSync = (a,b) => { rename(a,b); if(String(b)===${JSON.stringify(current)})process.exit(23); };
    createInitialAdministrator(createFilesystemStoreRoot(${JSON.stringify(f.directory)}), ${JSON.stringify(attemptId)}, "模擬管理者");
  `;
  const child = spawnSync(process.execPath, ["--eval", script], {
    timeout: 10_000,
    encoding: "utf8",
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 23, child.stderr);
  assert.equal(child.stdout, "");
  const observed = readHostInitializationState(f.root);
  assert.ok(
    observed.status === "in_progress" && observed.stage === "user_stored",
  );
  assert.equal(observed.attemptId, attemptId);
  const before = fs.readFileSync(current);
  const user = createInitialAdministrator(f.root, observed.attemptId, "別名");
  assert.ok(user.status === "completed");
  assert.equal(user.value.userId, observed.userId);
  assert.deepEqual(fs.readFileSync(current), before);
  const issued = createInitialCredential(f.root, observed.attemptId);
  assert.ok(issued.status === "completed");
  const state = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  assert.equal(state.users.length, 1);
  assert.equal(state.credentials.length, 1);
  assert.equal(state.credentials[0]?.userId, observed.userId);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 提示の先行記録と観測後記録を別改訂へ保存する。
 * @responsibility 一度提示の非秘密Bindingと対象外不変を実保存で確認する。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 自己生成Rootに未提示の初回資格を一回保存する。
 * @stimulus not_attempted→unconfirmed→confirmed、同状態再入場を要求する。
 * @observation 保存改訂、提示Operation ID、全結果field、対象外状態と材料不存在。
 * @oracle 各遷移は一出版。same-stateは拒否・byte不変、結果にSecret・Verifier・Snapshotなし。
 * @cleanup FixtureがRootを回収して不存在を確認する。
 * @boundary AM内部提示保存→実Filesystem。実TTY／HTTP出力は未接続。
 */
test("提示の先行記録と確認は別改訂・exact Bindingで一回だけ保存する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed")
    throw new Error("fixture issuance unavailable");
  const current = path.join(f.directory, "access-management.json");
  const before = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  const start = {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: issued.value.revision,
    target: "unconfirmed" as const,
  };
  const prepared = recordCredentialPresentation(f.root, start);
  assert.equal(prepared.status, "completed");
  if (prepared.status !== "completed")
    throw new Error("presentation preparation unavailable");
  assert.equal(prepared.value.revision, start.expectedRevision + 1);
  assert.equal(
    prepared.value.presentationOperationId,
    prepared.value.operationId,
  );
  assert.deepEqual(Object.keys(prepared.value).sort(), [
    "credentialId",
    "issuanceOperationId",
    "operationId",
    "presentation",
    "presentationOperationId",
    "revision",
  ]);
  const first = fs.readFileSync(current);
  assert.equal(
    recordCredentialPresentation(f.root, start).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), first);
  const finish = {
    credentialId: start.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: prepared.value.revision,
    presentationOperationId: prepared.value.presentationOperationId,
    target: "confirmed" as const,
  };
  const confirmed = recordCredentialPresentation(f.root, finish);
  assert.equal(confirmed.status, "completed");
  if (confirmed.status !== "completed")
    throw new Error("presentation confirmation unavailable");
  assert.equal(confirmed.value.revision, prepared.value.revision + 1);
  assert.notEqual(confirmed.value.operationId, prepared.value.operationId);
  assert.equal(
    confirmed.value.presentationOperationId,
    prepared.value.presentationOperationId,
  );
  const saved = fs.readFileSync(current);
  assert.equal(
    recordCredentialPresentation(f.root, finish).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), saved);
  const after = JSON.parse(saved.toString("utf8")) as AccessManagementState;
  after.revision = before.revision;
  after.operationId = before.operationId;
  const credential = after.credentials[0];
  assert.ok(credential);
  credential.presentation = "not_attempted";
  assert.deepEqual(after, before);
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.pending.json")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.replace.json")),
    false,
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.lock")),
    false,
  );
});

/**
 * 不正提示入力をRoot観測前に拒否する。
 * @responsibility accessor・Proxy・余分field・未知targetを実行しない。
 * @trace RFD-IT-017
 * @precondition 副作用を計測する入力getterとRoot Proxy。
 * @stimulus 閉入力の欠損・余分・型不正・未知target・accessor／Proxyを渡す。
 * @observation Root／getter呼出し0、固定拒否、publication not_attempted。
 * @oracle 全不正入力はLock・保存・出力許可を作らない。
 * @cleanup N/A: Rootを生成せず副作用0を測定する。
 * @boundary 提示入力→保存入口、入力不正時はFilesystem未到達。
 */
test("不正な提示入力はgetter・Proxy・Rootを観測せず拒否する", () => {
  let calls = 0;
  const root = new Proxy(
    {},
    {
      get: () => {
        calls++;
        throw new Error("root accessed");
      },
    },
  ) as FilesystemStoreRoot;
  const valid = {
    credentialId: "0123456789abcdef01234567",
    issuanceOperationId: "00000000-0000-4000-8000-000000000002",
    expectedRevision: 3,
    target: "unconfirmed",
  };
  const accessor = Object.defineProperty({ ...valid }, "target", {
    get: () => {
      calls++;
      return "unconfirmed";
    },
  });
  const proxy = new Proxy(valid, {
    ownKeys: () => {
      calls++;
      throw new Error("input accessed");
    },
  });
  for (const input of [
    null,
    proxy,
    accessor,
    { ...valid, extra: true },
    { ...valid, target: "not_attempted" },
    { ...valid, expectedRevision: Number.MAX_SAFE_INTEGER },
    { ...valid, target: "confirmed" },
    { ...valid, presentationOperationId: valid.issuanceOperationId },
  ]) {
    assert.deepEqual(recordCredentialPresentation(root, input), {
      status: "unavailable",
      reason: "state_store_presentation_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    });
  }
  assert.equal(calls, 0);
});

/**
 * 遅延提示通知を現在の相関・失効と再照合する。
 * @responsibility ID・発行・提示Operation・改訂の不一致と失効後更新を拒否する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-024
 * @precondition 保存済みunconfirmedと非秘密Binding。
 * @stimulus Binding各軸を一つずつ変更し、失効後に元通知を渡す。
 * @observation 固定拒否とcurrent byte・Directory一覧の不変。
 * @oracle 全不一致・失効は出版0、confirmedへ戻さない。
 * @cleanup Fixtureが所有Rootを回収する。
 * @boundary 非秘密の遅延入力→同Lock fresh保存検査。
 */
test("遅延提示確認は各Binding不一致と失効を拒否する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.ok(issued.status === "completed");
  const prepared = recordCredentialPresentation(f.root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: issued.value.revision,
    target: "unconfirmed",
  });
  assert.ok(prepared.status === "completed");
  const valid = {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: prepared.value.revision,
    presentationOperationId: prepared.value.presentationOperationId,
    target: "confirmed" as const,
  };
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  const names = fs.readdirSync(f.directory).sort();
  for (const update of [
    { ...valid, credentialId: "abcdef0123456789abcdef01" },
    { ...valid, issuanceOperationId: "00000000-0000-4000-8000-000000000011" },
    { ...valid, expectedRevision: valid.expectedRevision - 1 },
    {
      ...valid,
      presentationOperationId: "00000000-0000-4000-8000-000000000012",
    },
  ]) {
    assert.equal(
      recordCredentialPresentation(f.root, update).status,
      "unavailable",
    );
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory).sort(), names);
  }
  const state = JSON.parse(before.toString("utf8")) as AccessManagementState;
  const credential = state.credentials[0];
  assert.ok(credential);
  credential.revoked = true;
  state.unresolvedKeyExchanges = [
    {
      stage: "revoked",
      entry: "host",
      scope: "targeted",
      recipientUserId: credential.userId,
      operationId: "00000000-0000-4000-8000-000000000013",
      recoveryId:
        "access-management.key-exchange.00000000-0000-4000-8000-000000000013",
      oldCredentialIds: [credential.credentialId],
    },
  ];
  fs.writeFileSync(current, bytes(state));
  const revoked = fs.readFileSync(current);
  assert.equal(
    recordCredentialPresentation(f.root, valid).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), revoked);
});

/**
 * 提示三状態と二更新先の全組合せを実保存で判定する。
 * @responsibility same-stateや逆向き更新を単調保存から除く。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 同じ自己生成初回資格の独立したSnapshot変種。
 * @stimulus not_attempted／unconfirmed／confirmed×二targetを渡す。
 * @observation completedの有無、改訂、拒否時byte不変。
 * @oracle 先行未確認と観測後確認の二遷移だけ成功する。
 * @cleanup Fixtureが各Rootを回収する。
 * @boundary 提示状態判断→実Filesystem。
 */
test("提示三状態と二targetは二つの単調遷移だけ保存する", (t) => {
  for (const presentation of [
    "not_attempted",
    "unconfirmed",
    "confirmed",
  ] as const) {
    for (const target of ["unconfirmed", "confirmed"] as const) {
      const f = fixture(t);
      const attempt = prepareInitialUser(f);
      const issued = createInitialCredential(f.root, attempt);
      assert.ok(issued.status === "completed");
      const current = path.join(f.directory, "access-management.json");
      const state = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      const credential = state.credentials[0];
      assert.ok(credential);
      credential.presentation = presentation;
      fs.writeFileSync(current, bytes(state));
      const before = fs.readFileSync(current);
      const result = recordCredentialPresentation(f.root, {
        credentialId: credential.credentialId,
        issuanceOperationId: attempt,
        expectedRevision: state.revision,
        target,
        ...(target === "confirmed"
          ? { presentationOperationId: state.operationId }
          : {}),
      });
      const allowed =
        (presentation === "not_attempted" && target === "unconfirmed") ||
        (presentation === "unconfirmed" && target === "confirmed");
      assert.equal(result.status === "completed", allowed);
      if (!allowed) assert.deepEqual(fs.readFileSync(current), before);
    }
  }
});

/**
 * 未解決交換中の新資格だけへ提示結果を保存する。
 * @responsibility prepared／revokedと旧資格を拒否し、初回歴史IDを保持する。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 初回または完了後の単一交換Snapshot。
 * @stimulus 二初回状態×Host／Workbench入口と3交換段階、旧／新資格を渡す。
 * @observation 拒否時byte、成功対象、初回歴史的参照。
 * @oracle 初回Hostおよび完了後両入口の新資格保存段階だけ更新可。prepared／revoked・旧対象は不可。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 完全Schema→提示対象判断→実保存。鍵交換Writerの成立ではない。
 */
test("交換中の提示は保存済み新資格だけを対象にする", (t) => {
  for (const completed of [false, true]) {
    for (const entry of ["host", "workbench"] as const) {
      const f = fixture(t);
      const attempt = prepareInitialUser(f);
      const issued = createInitialCredential(f.root, attempt);
      assert.ok(issued.status === "completed");
      const current = path.join(f.directory, "access-management.json");
      const state = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      const old = state.credentials[0];
      const initial = state.initialization;
      assert.ok(old && initial.stage === "credential_stored");
      old.presentation = completed ? "confirmed" : "not_attempted";
      if (completed)
        state.initialization = {
          stage: "completed",
          attemptId: attempt,
          initialUserId: initial.userId,
          initialCredentialId: old.credentialId,
          confirmationCredentialId: old.credentialId,
          connection: "confirmed",
        };
      const operationId = "00000000-0000-4000-8000-000000000014";
      const exchange = {
        stage: "prepared" as const,
        entry,
        scope: "targeted" as const,
        recipientUserId: old.userId,
        operationId,
        recoveryId: `access-management.key-exchange.${operationId}`,
        oldCredentialIds: [old.credentialId],
      };
      const oldUpdate = {
        credentialId: old.credentialId,
        issuanceOperationId: attempt,
        expectedRevision: state.revision,
        target: completed ? "confirmed" : "unconfirmed",
        ...(completed ? { presentationOperationId: state.operationId } : {}),
      };
      for (const stage of ["prepared", "revoked"] as const) {
        old.revoked = stage === "revoked";
        state.unresolvedKeyExchanges = [{ ...exchange, stage }];
        fs.writeFileSync(current, bytes(state));
        const before = fs.readFileSync(current);
        assert.equal(
          recordCredentialPresentation(f.root, oldUpdate).status,
          "unavailable",
        );
        assert.deepEqual(fs.readFileSync(current), before);
      }
      const newId = "abcdef0123456789abcdef01";
      state.credentials.push({
        ...old,
        credentialId: newId,
        operationId,
        revoked: false,
        presentation: "not_attempted",
      });
      state.unresolvedKeyExchanges = [
        { ...exchange, stage: "credential_stored", newCredentialId: newId },
      ];
      if (!completed) initial.confirmationCredentialId = newId;
      fs.writeFileSync(current, bytes(state));
      const before = fs.readFileSync(current);
      assert.equal(
        recordCredentialPresentation(f.root, oldUpdate).status,
        "unavailable",
      );
      assert.deepEqual(fs.readFileSync(current), before);
      const result = recordCredentialPresentation(f.root, {
        credentialId: newId,
        issuanceOperationId: operationId,
        expectedRevision: state.revision,
        target: "unconfirmed",
      });
      assert.equal(
        result.status === "completed",
        completed || entry === "host",
      );
      const saved = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      assert.deepEqual(saved.initialization, state.initialization);
    }
  }
});

/**
 * 提示前出版の故障で一度出力の許可を返さない。
 * @responsibility 既知出版と清掃／解放不明を分離し、再入場を再表示にしない。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 未提示資格、自己生成Root、限定した保存故障注入。
 * @stimulus rename・読戻し・pending清掃・Lock解放の各故障と再入場。
 * @observation status、publication、value不存在、保存presentation、再入場結果。
 * @oracle 全故障はcompleted/提示Bindingなし。出版済みはunconfirmedを保持し、再開始も許可しない。
 * @cleanup 注入をfinallyで解除し、FixtureがRootを回収する。
 * @boundary 実Filesystem出版・読戻し・清掃・Lock終了。
 */
test("提示前保存の故障は出力Bindingを返さず再表示も許可しない", (t) => {
  for (const failure of ["rename", "readback", "pending", "lock"] as const) {
    const f = fixture(t);
    const attempt = prepareInitialUser(f);
    const issued = createInitialCredential(f.root, attempt);
    assert.ok(issued.status === "completed");
    const input = {
      credentialId: issued.value.credentialId,
      issuanceOperationId: attempt,
      expectedRevision: issued.value.revision,
      target: "unconfirmed",
    };
    const rename = fs.renameSync,
      open = fs.openSync,
      remove = fs.rmSync;
    let published = false;
    fs.renameSync = (from, to) => {
      if (failure === "rename") throw new Error("injected rename");
      rename(from, to);
      published = true;
    };
    fs.openSync = (target, flags, mode) => {
      if (
        failure === "readback" &&
        published &&
        String(target).endsWith("access-management.json")
      )
        throw new Error("injected readback");
      return open(target, flags, mode);
    };
    fs.rmSync = (target, options) => {
      if (
        failure === "pending" &&
        String(target).endsWith("access-management.pending.json")
      )
        throw new Error("injected pending cleanup");
      if (
        failure === "lock" &&
        String(target).endsWith("access-management.lock")
      )
        throw new Error("injected lock release");
      return remove(target, options);
    };
    try {
      const result = recordCredentialPresentation(f.root, input);
      assert.equal(result.status, "unavailable");
      assert.equal("value" in result, false);
      if (failure === "pending" || failure === "lock")
        assert.equal(result.publication, "confirmed");
    } finally {
      fs.renameSync = rename;
      fs.openSync = open;
      fs.rmSync = remove;
    }
    const state = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(
      state.credentials[0]?.presentation,
      failure === "rename" ? "not_attempted" : "unconfirmed",
    );
    const currentPath = path.join(f.directory, "access-management.json");
    const pendingPath = path.join(
      f.directory,
      "access-management.pending.json",
    );
    const replacePath = path.join(
      f.directory,
      "access-management.replace.json",
    );
    const lockPath = path.join(f.directory, "access-management.lock");
    const before = fs.readFileSync(currentPath);
    const pendingBefore = fs.existsSync(pendingPath)
      ? fs.readFileSync(pendingPath)
      : null;
    const replaceBefore = fs.existsSync(replacePath)
      ? fs.readFileSync(replacePath)
      : null;
    const retry = recordCredentialPresentation(f.root, input);
    assert.equal(retry.status, "unavailable");
    assert.equal("value" in retry, false);
    assert.deepEqual(fs.readFileSync(currentPath), before);
    if (failure === "readback" || failure === "pending") {
      assert.equal(retry.cleanupConfirmed, true);
      assert.equal(retry.reason, "state_store_previous_pending_settled");
      assert.equal(fs.existsSync(pendingPath), false);
      assert.equal(fs.existsSync(replacePath), false);
      assert.equal(fs.existsSync(lockPath), false);
      const repeated = recordCredentialPresentation(f.root, input);
      assert.equal(repeated.status, "unavailable");
      assert.equal("value" in repeated, false);
      assert.equal(repeated.cleanupConfirmed, true);
      assert.deepEqual(fs.readFileSync(currentPath), before);
    } else {
      if (failure === "rename") {
        assert.equal(retry.cleanupConfirmed, false);
        assert.ok(pendingBefore);
        assert.ok(replaceBefore);
        assert.deepEqual(fs.readFileSync(pendingPath), pendingBefore);
        assert.deepEqual(fs.readFileSync(replacePath), replaceBefore);
      } else {
        assert.equal(retry.cleanupConfirmed, true);
        assert.equal(fs.existsSync(lockPath), false);
        assert.equal(fs.existsSync(pendingPath), false);
        assert.equal(fs.existsSync(replacePath), false);
      }
    }
  }
});

/**
 * 初回Host交換の失効途中を認証成功へ昇格しない。
 * @responsibility 保存Schemaの受理と有効資格・通常接続の成立を区別する。
 * @trace RFD-IT-013
 * @trace RFD-IT-024
 * @precondition 自己生成Rootにv2初回資格を保存する。
 * @stimulus 同資格をHost交換のrevoked段階へ構成し、公開readと両認証入口を呼ぶ。
 * @observation read結果、固定認証拒否、current byteとDirectory一覧。
 * @oracle 途中記録は読取り可能だが失効資格の本人・通常認証は拒否。状態を修復・初期化・再発行しない。
 * @cleanup Fixtureが所有Rootを削除し不存在を確認する。
 * @boundary v2 Parser→実Filesystem Reader→AM認証。Host交換Writerの成立は主張しない。
 */
test("初回Host交換のrevoked参照は保存可能でも認証を許可しない", (t) => {
  const f = fixture(t);
  const issued = createInitialCredential(f.root, prepareInitialUser(f));
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token)
    throw new Error("fixture credential unavailable");
  const current = path.join(f.directory, "access-management.json");
  const state = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  const initial = state.initialization;
  const credential = state.credentials[0];
  assert.ok(initial.stage === "credential_stored" && credential);
  assert.equal(state.schemaRevision, 2);
  assert.equal(initial.initialCredentialId, credential.credentialId);
  assert.equal(initial.confirmationCredentialId, credential.credentialId);
  credential.revoked = true;
  const operationId = "00000000-0000-4000-8000-000000000077";
  state.unresolvedKeyExchanges = [
    {
      stage: "revoked",
      operationId,
      recoveryId: `access-management.key-exchange.${operationId}`,
      entry: "host",
      scope: "targeted",
      recipientUserId: initial.userId,
      oldCredentialIds: [credential.credentialId],
    },
  ];
  assert.equal(parseAccessManagementState(bytes(state)).status, "parsed");
  fs.writeFileSync(current, bytes(state));
  const before = fs.readFileSync(current);
  const names = fs.readdirSync(f.directory).sort();
  assert.equal(readAccessManagementState(f.root).status, "completed");
  for (const authenticate of [
    authenticateCredential,
    authenticateNormalConnection,
  ]) {
    assert.deepEqual(authenticate(f.root, issued.value.token), {
      status: "unavailable",
      reason: "credential_authentication_rejected",
    });
  }
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory).sort(), names);
});

/**
 * 初回途中の有効資格を通常接続へ昇格しない。
 * @responsibility 本人確認の成功と通常Surfaceの認証拒否を区別する。
 * @trace RFD-IT-013
 * @trace RFD-IT-024
 * @precondition 自己生成Rootに初回資格を保存する。
 * @stimulus 有効資格で両認証入口を呼び、未完了時に不正pending／孤立replaceも置く。
 * @observation 結果全field、current・pending・replace byte、Directory一覧。
 * @oracle 本人確認だけ成功。通常接続は固定拒否で材料不変更、本人・対象情報なし。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary AM公開認証入口と実保存Lock。公開MCPは後続試験。
 */
test("通常接続は初回途中の有効資格を拒否して材料を保持する", (t) => {
  const f = fixture(t);
  const issued = createInitialCredential(f.root, prepareInitialUser(f));
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token)
    throw new Error("fixture credential unavailable");
  assert.equal(
    authenticateCredential(f.root, issued.value.token).status,
    "completed",
  );
  const current = path.join(f.directory, "access-management.json");
  const pending = path.join(f.directory, "access-management.pending.json");
  const replace = path.join(f.directory, "access-management.replace.json");
  fs.writeFileSync(pending, "incomplete fixture");
  fs.writeFileSync(replace, "orphan fixture");
  const before = fs.readFileSync(current);
  const pendingBefore = fs.readFileSync(pending);
  const replaceBefore = fs.readFileSync(replace);
  const names = fs.readdirSync(f.directory).sort();
  assert.deepEqual(authenticateNormalConnection(f.root, issued.value.token), {
    status: "unavailable",
    reason: "credential_authentication_rejected",
  });
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readFileSync(pending), pendingBefore);
  assert.deepEqual(fs.readFileSync(replace), replaceBefore);
  assert.deepEqual(fs.readdirSync(f.directory).sort(), names);
});

/**
 * 通常認証が現在資格・Roleと保存終了を毎回確認する。
 * @responsibility 初回完了だけを受理し、失効・未知・状態不明を成功へ畳まない。
 * @trace RFD-IT-013
 * @precondition 完了済み初回と三Roleの自己生成管理Store。
 * @stimulus 三Role認証、失効・未知・形式不正時のpending／replace、不正current／pendingとLock解放故障を与える。
 * @observation 本人投影全field、固定拒否・状態未確認、current・pending・replace byte、Directory一覧。
 * @oracle 現在有効な資格だけが既存本人投影と一致。失敗結果にsnapshotなし。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary AM公開通常認証と既存保存・暗号境界。
 */
test("通常接続認証は現在資格と完了状態だけを返す", (t) => {
  const f = managementFixture(t);
  const current = path.join(f.directory, "access-management.json");
  const saved = fs.readFileSync(current);
  for (const role of ["administrator", "manager", "developer"] as const)
    assert.deepEqual(
      authenticateNormalConnection(f.root, f.tokens[role]),
      authenticateCredential(f.root, f.tokens[role]),
    );
  const state = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  const credential = state.credentials[0];
  assert.ok(credential);
  credential.revoked = true;
  fs.writeFileSync(current, bytes(state));
  const revoked = fs.readFileSync(current);
  const pending = path.join(f.directory, "access-management.pending.json");
  const replace = path.join(f.directory, "access-management.replace.json");
  fs.writeFileSync(pending, "incomplete fixture");
  fs.writeFileSync(replace, "orphan fixture");
  const pendingBefore = fs.readFileSync(pending);
  const replaceBefore = fs.readFileSync(replace);
  const names = fs.readdirSync(f.directory).sort();
  for (const token of [
    f.tokens.administrator,
    createCredentialMaterial().token,
    "invalid",
  ]) {
    assert.deepEqual(authenticateNormalConnection(f.root, token), {
      status: "unavailable",
      reason: "credential_authentication_rejected",
    });
    assert.deepEqual(fs.readFileSync(current), revoked);
    assert.deepEqual(fs.readFileSync(pending), pendingBefore);
    assert.deepEqual(fs.readFileSync(replace), replaceBefore);
    assert.deepEqual(fs.readdirSync(f.directory).sort(), names);
  }
  fs.rmSync(pending);
  fs.rmSync(replace);
  fs.writeFileSync(current, "incomplete fixture");
  assert.deepEqual(authenticateNormalConnection(f.root, f.tokens.developer), {
    status: "unavailable",
    reason: "credential_authentication_state_unavailable",
  });
  fs.writeFileSync(current, saved);
  fs.writeFileSync(pending, "{}");
  assert.deepEqual(authenticateNormalConnection(f.root, f.tokens.developer), {
    status: "unavailable",
    reason: "credential_authentication_state_unavailable",
  });
  assert.equal(fs.readFileSync(pending, "utf8"), "{}");
  fs.rmSync(pending);
  const remove = fs.rmSync;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  try {
    assert.deepEqual(authenticateNormalConnection(f.root, f.tokens.developer), {
      status: "unavailable",
      reason: "credential_authentication_state_unavailable",
    });
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(
    authenticateNormalConnection(f.root, f.tokens.developer).status,
    "completed",
  );
  assert.deepEqual(fs.readFileSync(current), saved);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 保存資格から同一改訂の本人だけを解決する。
 * @responsibility 現在Role再評価と初回完了への非昇格を区別する。
 * @trace RFD-IT-013
 * @trace RFD-IT-024
 * @precondition 初回資格を自己生成Rootに保存する。
 * @stimulus 同資格の認証、通常状態のRole変更後に次認証を行う。
 * @observation 固定投影・改訂・所有配列・完全byte・材料不存在。
 * @oracle 初回は状態不変更、次要求だけ現在Role、秘密・他User・管理許可0。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 認証公開Root・保存・Node暗号。
 */
test("資格認証は同一改訂の本人と現在Roleだけを投影する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  assert.ok(issued.value.token);
  const token = issued.value.token;
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  const result = authenticateCredential(f.root, token);
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.deepEqual(Object.keys(result.snapshot).sort(), [
    "credentialId",
    "revision",
    "role",
    "userId",
    "username",
    "workspaceIds",
  ]);
  assert.equal(result.snapshot.revision, 3);
  assert.equal(result.snapshot.role, "administrator");
  assert.deepEqual(result.snapshot.workspaceIds, []);
  assert.equal(Object.isFrozen(result.snapshot), true);
  assert.equal(Object.isFrozen(result.snapshot.workspaceIds), true);
  assert.deepEqual(fs.readFileSync(current), before);
  const next = JSON.parse(before.toString()) as AccessManagementState;
  const user = next.users[0];
  const credential = next.credentials[0];
  assert.ok(user && credential);
  assert.equal(next.initialization.stage, "credential_stored");
  next.initialization = {
    stage: "completed",
    attemptId: attempt,
    initialUserId: user.userId,
    initialCredentialId: credential.credentialId,
    confirmationCredentialId: credential.credentialId,
    connection: "confirmed",
  };
  credential.presentation = "confirmed";
  user.role = "manager";
  next.revision++;
  next.operationId = crypto.randomUUID();
  fs.writeFileSync(current, bytes(next));
  const again = authenticateCredential(f.root, token);
  assert.equal(again.status, "completed");
  if (again.status === "completed") {
    assert.equal(again.snapshot.revision, 4);
    assert.equal(again.snapshot.role, "manager");
    assert.deepEqual(again.snapshot.workspaceIds, [
      "development",
      "management",
    ]);
    assert.notEqual(
      again.snapshot.workspaceIds,
      next.roleContentAccess[1]?.workspaceIds,
    );
  }
  assert.equal(result.snapshot.role, "administrator");
  assert.deepEqual(result.snapshot.workspaceIds, []);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 不成立認証と保存・排他不明で本人情報を返さない。
 * @responsibility 不正資格・破損・未確認解放を非開示結果へ閉じる。
 * @trace RFD-IT-013
 * @precondition 自己生成の初回資格状態。
 * @stimulus 形式・ID・Secret・失効・User/Role欠測・材料不正・Lock解放故障を与える。
 * @observation 結果field閉包、KDF境界、保存byteとcleanup後の材料不存在。
 * @oracle unavailableにsnapshot・改訂・対象ID・Lock参照なし。
 * @cleanup 差替え復元、自己生成材料回収、Fixture削除。
 * @boundary 認証・現在状態・Lock終了境界。
 */
test("資格認証は失効・破損・排他不明を本人情報なしで拒否する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  assert.ok(issued.value.token);
  const token = issued.value.token;
  const current = path.join(f.directory, "access-management.json");
  const saved = fs.readFileSync(current);
  const unknown = `cros.v1.${"0".repeat(24)}.${token.split(".")[3]}`;
  const wrong = `cros.v1.${issued.value.credentialId}.${Buffer.alloc(32).toString("base64url")}`;
  for (const value of ["invalid", unknown, wrong, wrong, wrong]) {
    assert.deepEqual(authenticateCredential(f.root, value), {
      status: "unavailable",
      reason: "credential_authentication_rejected",
    });
    assert.deepEqual(fs.readFileSync(current), saved);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
  for (const change of ["revoked", "missingUser", "missingRole"]) {
    const state = JSON.parse(saved.toString()) as AccessManagementState;
    const credential = state.credentials[0];
    assert.ok(credential);
    state.initialization = {
      stage: "completed",
      attemptId: attempt,
      initialUserId: credential.userId,
      initialCredentialId: credential.credentialId,
      confirmationCredentialId: credential.credentialId,
      connection: "confirmed",
    };
    credential.presentation = "confirmed";
    if (change === "revoked") credential.revoked = true;
    if (change === "missingUser") state.users = [];
    if (change === "missingRole") state.roleContentAccess = [];
    fs.writeFileSync(current, bytes(state));
    const result = authenticateCredential(f.root, token);
    assert.equal(result.status, "unavailable");
    assert.deepEqual(Object.keys(result).sort(), ["reason", "status"]);
    if (change === "revoked")
      assert.deepEqual(result, {
        status: "unavailable",
        reason: "credential_authentication_rejected",
      });
  }
  fs.writeFileSync(current, saved);
  const pending = path.join(f.directory, "access-management.pending.json");
  fs.writeFileSync(pending, "{}");
  assert.deepEqual(authenticateCredential(f.root, token), {
    status: "unavailable",
    reason: "credential_authentication_state_unavailable",
  });
  assert.equal(fs.existsSync(pending), true);
  fs.rmSync(pending);
  const remove = fs.rmSync;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  try {
    assert.deepEqual(authenticateCredential(f.root, token), {
      status: "unavailable",
      reason: "credential_authentication_state_unavailable",
    });
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(authenticateCredential(f.root, token).status, "completed");
  assert.deepEqual(fs.readFileSync(current), saved);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 初回鍵の一生成・保存・再表示禁止を確認する。
 * @responsibility 短命鍵と保存照合値を別に観測する。
 * @trace RFD-IT-024
 * @precondition 保存済み初回User。
 * @stimulus 初回鍵保存と同元試行の再入場。
 * @observation 乱数件数、token照合、保存byte、材料不存在。
 * @oracle 再入場は生成0・token null、保存に生鍵なし。
 * @cleanup 差替え復元とFixture削除。
 * @boundary Node暗号・Filesystem。
 */
test("初回資格は一回生成し保存後の再入場で再表示しない", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const random = crypto.randomBytes;
  let calls = 0;
  crypto.randomBytes = ((size: number) => {
    calls++;
    return random(size);
  }) as typeof random;
  try {
    const first = createInitialCredential(f.root, attempt);
    assert.equal(first.status, "completed");
    if (first.status !== "completed") return;
    assert.equal(first.value.created, true);
    assert.equal(calls, 3);
    assert.ok(first.value.token);
    const saved = fs.readFileSync(
      path.join(f.directory, "access-management.json"),
    );
    assert.equal(saved.includes(first.value.token), false);
    const secret = first.value.token.split(".")[3];
    assert.ok(secret);
    assert.equal(saved.includes(secret), false);
    const state = JSON.parse(saved.toString()) as AccessManagementState;
    assert.equal(state.credentials.length, 1);
    const credential = state.credentials[0];
    assert.ok(credential);
    assert.equal(verifyCredentialToken(first.value.token, credential), true);
    assert.equal(credential.operationId, attempt);
    assert.equal(credential.presentation, "not_attempted");
    const again = createInitialCredential(f.root, attempt);
    assert.equal(again.status, "completed");
    if (again.status === "completed")
      assert.deepEqual(again.value, {
        revision: 3,
        credentialId: first.value.credentialId,
        created: false,
        token: null,
      });
    assert.equal(calls, 3);
    assert.deepEqual(
      fs.readFileSync(path.join(f.directory, "access-management.json")),
      saved,
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  } finally {
    crypto.randomBytes = random;
  }
});

/**
 * 不正な初回状態を鍵生成前に拒否する。
 * @responsibility 別試行・状態改変から鍵を発行しない。
 * @trace RFD-IT-024
 * @precondition 初回Userの自己生成保存Root。
 * @stimulus 別試行と初期Role改変を渡す。
 * @observation 暗号乱数件数0と保存byte不変。
 * @oracle unavailable、未生成、既存User不変更。
 * @cleanup 暗号差替え復元とFixture削除。
 * @boundary 初回状態と乱数生成境界。
 */
test("初回資格の別試行と非canonical状態は生成前に拒否する", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const current = path.join(f.directory, "access-management.json");
  const saved = fs.readFileSync(current);
  const random = crypto.randomBytes;
  let calls = 0;
  crypto.randomBytes = ((size: number) => {
    calls++;
    return random(size);
  }) as typeof random;
  try {
    assert.equal(
      createInitialCredential(f.root, "00000000-0000-4000-8000-000000000098")
        .status,
      "unavailable",
    );
    assert.deepEqual(fs.readFileSync(current), saved);
    const modified = JSON.parse(saved.toString()) as AccessManagementState;
    const developer = modified.roleContentAccess[0];
    assert.ok(developer);
    developer.workspaceIds = [];
    fs.writeFileSync(current, bytes(modified));
    const before = fs.readFileSync(current);
    const rejected = createInitialCredential(f.root, attempt);
    assert.equal(rejected.status, "unavailable");
    assert.equal(rejected.cleanupConfirmed, true);
    assert.deepEqual(fs.readFileSync(current), before);
    assert.equal(calls, 0);
  } finally {
    crypto.randomBytes = random;
  }
});

/**
 * 保存途中のProcess喪失を資格生成の再試行へ畳まない。
 * @responsibility base保持と出版済み同資格再観測を区別する。
 * @trace RFD-IT-024
 * @precondition 初回Userと一回性子Process。
 * @stimulus pending・replace確定後またはrename後に子を終了する。
 * @observation 子終了・保存材料・再入場の乱数0・token非返却。
 * @oracle baseは停止保持、nextだけ同資格で清掃完了。
 * @cleanup 子Process終了とFixture削除。
 * @boundary 実ProcessとFilesystem。
 */
test("初回資格のProcess喪失は再生成せず保存段階を保持する", (t) => {
  for (const phase of ["pending", "replace", "renamed"]) {
    const f = fixture(t);
    const attempt = prepareInitialUser(f);
    const current = path.join(f.directory, "access-management.json");
    const before = fs.readFileSync(current);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
    const child = spawnSync(
      process.execPath,
      [
        "--eval",
        `
      import fs from 'node:fs';
      import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)};
      import {createInitialCredential} from ${JSON.stringify(storeUrl)};
      let n=0; const flush=fs.fsyncSync;
      fs.fsyncSync=fd=>{flush(fd); n++; if((${JSON.stringify(phase)}==='pending'&&n===2)||(${JSON.stringify(phase)}==='replace'&&n===3)) process.exit(23);};
      const rename=fs.renameSync;
      fs.renameSync=(a,b)=>{rename(a,b); if(${JSON.stringify(phase)}==='renamed') process.exit(23);};
      createInitialCredential(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)});
    `,
      ],
      { timeout: 10_000, encoding: "utf8" },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    assert.equal(child.stdout, "");
    const random = crypto.randomBytes;
    let calls = 0;
    crypto.randomBytes = ((size: number) => {
      calls++;
      return random(size);
    }) as typeof random;
    try {
      const result = createInitialCredential(f.root, attempt);
      assert.equal(calls, 0);
      if (phase === "renamed") {
        assert.equal(result.status, "completed");
        if (result.status === "completed") {
          assert.equal(result.value.created, false);
          assert.equal(result.value.token, null);
        }
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
      } else {
        assert.equal(result.status, "unavailable");
        assert.equal(result.cleanupConfirmed, false);
        assert.deepEqual(fs.readFileSync(current), before);
        assert.ok(
          fs.existsSync(
            path.join(f.directory, "access-management.pending.json"),
          ),
        );
        assert.equal(
          fs.existsSync(
            path.join(f.directory, "access-management.replace.json"),
          ),
          phase === "replace",
        );
      }
    } finally {
      crypto.randomBytes = random;
    }
  }
});

/**
 * 出版後Lock解放不明では生鍵を返さない。
 * @responsibility 保存成功と配送可能な完了を分離する。
 * @trace RFD-IT-024
 * @precondition 初回User保存済みの自己生成Root。
 * @stimulus 資格出版後のLock削除を拒否する。
 * @observation confirmed出版・unavailable・value非存在と再入場token null。
 * @oracle 未確認清掃でSecret搬送なし、追加鍵生成なし。
 * @cleanup 差替え復元・既存Lock再入場・Fixture削除。
 * @boundary 保存結果と既存Lock終了。
 */
test("初回資格のLock解放不明は短命鍵を外へ返さない", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const remove = fs.rmSync;
  let failed: ReturnType<typeof createInitialCredential>;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  try {
    failed = createInitialCredential(f.root, attempt);
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "confirmed");
  assert.equal(failed.cleanupConfirmed, false);
  assert.equal("value" in failed, false);
  const again = createInitialCredential(f.root, attempt);
  assert.equal(again.status, "completed");
  if (again.status === "completed") {
    assert.equal(again.value.created, false);
    assert.equal(again.value.token, null);
  }
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 非秘密fixtureを固定byte化する。
 * @responsibility Source serializerから独立した期待byteを構築する。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus Object keyを辞書順でJSON化し改行を付ける。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle UTF-8正確byteをHashと比較へ使う。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
function bytes(value: unknown): Buffer {
  return Buffer.from(
    `${JSON.stringify(value, (_key, item: unknown) =>
      item !== null && typeof item === "object" && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([a], [b]) =>
              a < b ? -1 : a > b ? 1 : 0,
            ),
          )
        : item,
    )}\n`,
  );
}

/**
 * Repository内の一回性保存Fixtureを構築する。
 * @responsibility RootCapabilityと試験作成物を限定する。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 検証したRepository直下に試験Rootと模擬currentを作る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 試験Root以外・Host管理領域へ書込み0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
function fixture(t: TestContext): {
  directory: string;
  root: FilesystemStoreRoot;
  state: AccessManagementState;
} {
  const repository = path.resolve(import.meta.dirname, "../../../../..");
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(
    path.join(parent, "access-management-store-"),
  );
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  const state = baseline();
  fs.writeFileSync(
    path.join(directory, "access-management.json"),
    bytes(state),
  );
  return { directory, root, state };
}

/**
 * Host初回compositionの保存順と一度提示を接続する。
 * @responsibility write falseでも一回だけ出力し、提示と通常認証を別観測する。
 * @trace RFD-IT-024
 * @precondition 自己生成RootとNode Writableの局所TTY代役。
 * @stimulus freshから実保存APIと一write、同鍵初回確認を順に実行する。
 * @observation 書込み前unconfirmed、提示confirmed、段階、Listenerと次認証。
 * @oracle 初回接続前は通常認証0、一提示・同鍵確認後だけ通常認証。
 * @cleanup Fixture回収と当該Listener不存在。共有streamを閉じない。
 * @boundary 注入TTY→Host composition→実保存。実Host TTYの証明ではない。
 */
test("Host初回compositionは保存確定後に一度提示して接続待ちになる", async (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.directory, "access-management.json"));
  let writes = 0;
  let key = "";
  let previousReads = 0;
  const terminal = Object.assign(
    new Writable({
      highWaterMark: 1,
      write(chunk, _encoding, callback) {
        writes++;
        const observed = readHostInitializationState(f.root);
        assert.equal(observed.status, "in_progress");
        assert.equal(
          observed.status === "in_progress" &&
            observed.stage === "credential_stored" &&
            observed.presentation,
          "unconfirmed",
        );
        key = chunk.toString("utf8").split("\n")[1];
        setImmediate(callback);
      },
    }),
    { isTTY: true },
  ) as unknown as NodeJS.WriteStream;
  const controller = new AbortController();
  const result = await initializeFromHost(
    f.root,
    "管理者",
    true,
    () => {
      previousReads++;
      return ["uninitialized", "absent"];
    },
    terminal,
    controller.signal,
  );
  assert.deepEqual(result, {
    status: "awaiting_connection",
    reason: "host_key_presented",
  });
  assert.equal(writes, 1);
  assert.equal(previousReads, 2);
  assert.equal(terminal.writable, true);
  assert.equal(terminal.destroyed, false);
  assert.equal(terminal.listenerCount("error"), 0);
  assert.equal(terminal.listenerCount("close"), 0);
  const observed = readHostInitializationState(f.root);
  assert.equal(
    observed.status === "in_progress" &&
      observed.stage === "credential_stored" &&
      observed.presentation,
    "confirmed",
  );
  assert.equal(authenticateNormalConnection(f.root, key).status, "unavailable");
  const binding = resolveConnectionAuthentication(f.root, key);
  assert.equal(binding.status, "initial");
  if (binding.status !== "initial") return;
  assert.equal(
    confirmInitialConnection(f.root, key, binding.binding, controller.signal)
      .status,
    "completed",
  );
  assert.equal(authenticateNormalConnection(f.root, key).status, "completed");
  const saved = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
    "utf8",
  );
  assert.equal(saved.includes(key), false);
  assert.equal(JSON.stringify(result).includes(key), false);
  key = "";
});

/**
 * 保存済み初回段階では追加試行や保存済み鍵の再表示を行わない。
 * @responsibility 段階別の再入場と次行動を元相関へ結ぶ。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition correlated／user_stored／credential_storedの自己生成前状態。
 * @stimulus 同Host入口へ再入場し保存済み段階を読む。
 * @observation 元attempt/User、資格件数、write件数と次行動。
 * @oracle 資格保存前だけ同試行を進め、保存後は再表示0。
 * @cleanup Fixtureが各Rootの不存在を確認する。
 * @boundary 初回composition→保存。TTYは局所代役。
 */
test("Host初回compositionは途中の元試行を使い保存済み鍵を再表示しない", async (t) => {
  for (const stage of [
    "correlated",
    "user_stored",
    "not_attempted",
    "unconfirmed",
    "confirmed",
  ] as const) {
    const f = fixture(t);
    fs.rmSync(path.join(f.directory, "access-management.json"));
    const attempt = crypto.randomUUID();
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, () => [
        "uninitialized",
        "absent",
      ]).status,
      "completed",
    );
    if (stage !== "correlated")
      assert.equal(
        createInitialAdministrator(f.root, attempt, "元の管理者").status,
        "completed",
      );
    if (stage !== "correlated" && stage !== "user_stored") {
      const issued = createInitialCredential(f.root, attempt);
      assert.equal(issued.status, "completed");
      if (issued.status !== "completed") return;
      if (stage !== "not_attempted") {
        const started = recordCredentialPresentation(f.root, {
          credentialId: issued.value.credentialId,
          issuanceOperationId: attempt,
          expectedRevision: issued.value.revision,
          target: "unconfirmed",
        });
        assert.equal(started.status, "completed");
        if (stage === "confirmed" && started.status === "completed")
          assert.equal(
            recordCredentialPresentation(f.root, {
              credentialId: started.value.credentialId,
              issuanceOperationId: attempt,
              expectedRevision: started.value.revision,
              presentationOperationId: started.value.presentationOperationId,
              target: "confirmed",
            }).status,
            "completed",
          );
      }
    }
    const before = readAccessManagementState(f.root);
    let writes = 0;
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    const result = await initializeFromHost(
      f.root,
      "再入場名",
      true,
      () => {
        throw new Error("old_observer_must_not_run");
      },
      terminal,
      new AbortController().signal,
    );
    assert.equal(
      result.status,
      stage === "confirmed" || stage === "correlated" || stage === "user_stored"
        ? "awaiting_connection"
        : "key_exchange_required",
    );
    assert.equal(
      writes,
      stage === "correlated" || stage === "user_stored" ? 1 : 0,
    );
    const after = readAccessManagementState(f.root);
    assert.equal(after.status, "completed");
    if (after.status !== "completed" || before.status !== "completed") return;
    assert.equal(after.value.initialization.attemptId, attempt);
    assert.equal(after.value.users.length, 1);
    assert.equal(after.value.credentials.length, 1);
    if (before.value.users[0])
      assert.equal(after.value.users[0]?.userId, before.value.users[0].userId);
    if (stage !== "correlated" && stage !== "user_stored")
      assert.deepEqual(after.value, before.value);
  }
});

/**
 * 旧入力・対話条件・開始前取消が不成立なら新規Effectを開始しない。
 * @responsibility 不明をfreshや暗黙承認へ変換しない。
 * @trace RFD-IT-025
 * @precondition AM入力を持たない自己生成Rootと計数Writer。
 * @stimulus 旧観測不正／throw、非TTY、明示なし、取消済みを与える。
 * @observation current不存在とwrite件数、結果非秘密。
 * @oracle 新相関・User・資格・TTY出力0。
 * @cleanup Fixtureによるexact Root回収。
 * @boundary Host内部入力と保存開始境界。
 */
test("Host初回compositionは不成立前提で相関と出力を作らない", async (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  let writes = 0;
  const terminal = Object.assign(
    new Writable({
      write(_chunk, _encoding, callback) {
        writes++;
        callback();
      },
    }),
    { isTTY: true },
  ) as unknown as NodeJS.WriteStream;
  for (const previous of [
    ["existing", "absent"],
    ["uninitialized", "unknown"],
    ["unknown", "absent"],
  ] as const) {
    const result = await initializeFromHost(
      f.root,
      "管理者",
      true,
      () => previous,
      terminal,
      new AbortController().signal,
    );
    assert.equal(result.status, "blocked");
    assert.equal(fs.existsSync(current), false);
  }
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => {
          throw new Error("observation_failure");
        },
        terminal,
        new AbortController().signal,
      )
    ).status,
    "blocked",
  );
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        false,
        () => ["uninitialized", "absent"],
        terminal,
        new AbortController().signal,
      )
    ).status,
    "blocked",
  );
  terminal.isTTY = false as unknown as true;
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => ["uninitialized", "absent"],
        terminal,
        new AbortController().signal,
      )
    ).status,
    "blocked",
  );
  terminal.isTTY = true;
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    (
      await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => ["uninitialized", "absent"],
        terminal,
        controller.signal,
      )
    ).status,
    "cancelled",
  );
  assert.equal(fs.existsSync(current), false);
  assert.equal(writes, 0);
});

/**
 * TTYの保留中取消と故障は遅延callbackで成功へ戻さない。
 * @responsibility callback joinとListener回収を保存confirmedとは別に観測する。
 * @trace RFD-IT-025
 * @precondition Node Writableの保留callback、取消Signal、実保存Root。
 * @stimulus abort／write errorをcallback前に与え、遅れて完了させる。
 * @observation Promise保留、一write、unconfirmed維持、既存Listener保持。
 * @oracle callback join前の完了0、遅延成功でconfirmed保存0。
 * @cleanup 当該Listenerだけ回収。FixtureがRootを削除する。
 * @boundary 局所TTY callbackとAM保存。実Host TTY未評価。
 */
test("Host初回TTYは取消と故障後のcallbackをjoinして再表示しない", async (t) => {
  for (const mode of ["abort", "error"] as const) {
    const f = fixture(t);
    fs.rmSync(path.join(f.directory, "access-management.json"));
    let complete: ((error?: Error | null) => void) | undefined;
    let writes = 0;
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          complete = callback;
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    const existingErrorListener = () => {};
    terminal.on("error", existingErrorListener);
    const controller = new AbortController();
    let settled = false;
    const running = initializeFromHost(
      f.root,
      "管理者",
      true,
      () => ["uninitialized", "absent"],
      terminal,
      controller.signal,
    ).then((result) => {
      settled = true;
      return result;
    });
    assert.ok(complete);
    if (mode === "abort") controller.abort();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    complete(mode === "error" ? new Error("synthetic_write_failure") : null);
    const result = await running;
    assert.equal(result.status, mode === "abort" ? "cancelled" : "blocked");
    assert.equal(writes, 1);
    assert.deepEqual(terminal.listeners("error"), [existingErrorListener]);
    assert.equal(terminal.listenerCount("close"), 0);
    const observed = readHostInitializationState(f.root);
    assert.equal(
      observed.status === "in_progress" &&
        observed.stage === "credential_stored" &&
        observed.presentation,
      "unconfirmed",
    );
    const replay = await initializeFromHost(
      f.root,
      "再入場",
      true,
      () => ["uninitialized", "absent"],
      Object.assign(
        new Writable({
          write() {
            assert.fail("replay_write");
          },
        }),
        { isTTY: true },
      ) as unknown as NodeJS.WriteStream,
      new AbortController().signal,
    );
    assert.equal(replay.status, "key_exchange_required");
  }
});

/**
 * TTYの通知順・重複・同期throwを一writeに閉じる。
 * @responsibility callbackをjoinし失敗固定と当該Listener回収を独立観測する。
 * @trace RFD-IT-025
 * @precondition 実Writableに限定した局所write通知注入と自己生成Root。
 * @stimulus close／error先行、同期throw、重複callbackとfalse返却を与える。
 * @observation 結果、提示状態、write件数、Listenerとstream非終了。
 * @oracle 先行失敗はunconfirmed、重複成功は一confirmed、再表示0。
 * @cleanup Fixture回収、当該Listener不存在。共有streamを閉じない。
 * @boundary 通知注入試験。実TTYの動作保証ではない。
 */
test("Host初回TTYは先行通知と重複callbackを一度だけ処置する", async (t) => {
  for (const mode of [
    "close",
    "error",
    "late-close",
    "late-error",
    "throw",
    "duplicate",
  ] as const) {
    const f = fixture(t);
    fs.rmSync(path.join(f.directory, "access-management.json"));
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    let writes = 0;
    terminal.write = ((
      _chunk: unknown,
      callback: (error?: Error | null) => void,
    ) => {
      writes++;
      if (mode === "throw") throw new Error("synthetic_throw");
      if (mode === "close" || mode === "error")
        terminal.emit(mode, new Error("synthetic_notification"));
      setImmediate(() => {
        callback();
        if (mode === "late-close") terminal.emit("close");
        if (mode === "late-error")
          terminal.emit("error", new Error("synthetic_late_notification"));
        if (mode === "duplicate") callback();
      });
      return false;
    }) as typeof terminal.write;
    const result = await initializeFromHost(
      f.root,
      "管理者",
      true,
      () => ["uninitialized", "absent"],
      terminal,
      new AbortController().signal,
    );
    assert.equal(
      result.status,
      mode === "duplicate" ? "awaiting_connection" : "blocked",
    );
    assert.equal(writes, 1);
    assert.equal(terminal.listenerCount("error"), 0);
    assert.equal(terminal.listenerCount("close"), 0);
    assert.equal(terminal.writable, true);
    assert.equal(terminal.destroyed, false);
    const observed = readHostInitializationState(f.root);
    assert.equal(
      observed.status === "in_progress" &&
        observed.stage === "credential_stored" &&
        observed.presentation,
      mode === "duplicate" ? "confirmed" : "unconfirmed",
    );
  }
});

/**
 * 提示前／提示後の保存故障を再表示や正常完了へ変換しない。
 * @responsibility unconfirmed確定前の出力0と確定後の故障保持を確認する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 自己生成Rootとcurrent exact rename故障。
 * @stimulus unconfirmedまたはconfirmedの出版でrenameを失敗させる。
 * @observation TTY回数、保存presentation、元相関、非秘密結果と残存材料。
 * @oracle unconfirmed出版失敗なら出力0、confirmed失敗なら一度出力後も未完了。
 * @cleanup 注入をfinallyで戻しFixtureがexact Rootを回収する。
 * @boundary Host composition→実保存／局所TTY代役。
 */
test("Host初回提示の保存故障は出力順と未完了を保持する", async (t) => {
  for (const failedPublication of [3, 4]) {
    const f = fixture(t);
    const current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    let writes = 0;
    let publications = 0;
    const rename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (String(to) === current && ++publications === failedPublication)
        throw new Error("synthetic_publication_failure");
      return rename(from, to);
    };
    const terminal = Object.assign(
      new Writable({
        write(_chunk, _encoding, callback) {
          writes++;
          callback();
        },
      }),
      { isTTY: true },
    ) as unknown as NodeJS.WriteStream;
    try {
      const result = await initializeFromHost(
        f.root,
        "管理者",
        true,
        () => ["uninitialized", "absent"],
        terminal,
        new AbortController().signal,
      );
      assert.equal(result.status, "blocked");
      assert.equal(writes, failedPublication === 3 ? 0 : 1);
      const state = parseAccessManagementState(fs.readFileSync(current));
      assert.equal(state.status, "parsed");
      if (state.status !== "parsed") return;
      assert.equal(
        state.state.credentials[0]?.presentation,
        failedPublication === 3 ? "not_attempted" : "unconfirmed",
      );
      assert.equal(state.state.users.length, 1);
      assert.equal(state.state.credentials.length, 1);
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
        true,
      );
      assert.equal(terminal.listenerCount("error"), 0);
      assert.equal(terminal.listenerCount("close"), 0);
    } finally {
      fs.renameSync = rename;
    }
  }
});

/**
 * 三Roleの資格を持つ通常管理前状態を作る。
 * @responsibility 実Hostと分離した現在認証とUser対象を準備する。
 * @trace RFD-IT-021
 * @precondition 自己生成試験Rootだけを使用する。
 * @stimulus 最小Userと一回性資格材料を保存する。
 * @observation 完全Schemaとcurrent byteを確認する。
 * @oracle 生鍵は短命メモリだけ、Storeにはsalt／Verifierだけ。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 公開暗号部品と自己生成Filesystem。
 */
function managementFixture(t: TestContext) {
  const f = fixture(t);
  const tokens = { administrator: "", manager: "", developer: "" };
  for (const [index, role] of (
    ["administrator", "manager", "developer"] as const
  ).entries()) {
    const userId = `00000000-0000-4000-8000-${String(index + 3).padStart(12, "0")}`;
    if (index > 0) f.state.users.push({ userId, username: role, role });
    const material = createCredentialMaterial();
    tokens[role] = material.token;
    f.state.credentials.push({
      credentialId: material.credentialId,
      userId,
      tokenVersion: 1,
      tokenSalt: material.tokenSalt,
      tokenVerifier: material.tokenVerifier,
      revoked: false,
      operationId: crypto.randomUUID(),
      presentation: "confirmed",
    });
  }
  assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  return { ...f, tokens };
}

/**
 * Profile管理は同じ鍵でも現在Roleを再観測する。
 * @responsibility 認証不成立・状態不明をdeveloperの管理拒否と分離する。
 * @trace RFD-IT-013
 * @precondition 自己生成Storeに三Role資格と初回完了状態を保存する。
 * @stimulus 三Role、同TokenのRole変更、資格失効、初回未完了、破損状態を順に解決する。
 * @observation 閉じた三判定と保存前後byte、Role変更の反映。
 * @oracle manager/adminはallowed、developerだけdenied、失効・未完了・破損はunavailable。資格・Catalog・対象Repositoryを変更しない。
 * @cleanup Fixture所有Rootを回収し不存在を確認する。
 * @boundary 実AM保存・通常認証→Profile管理の用途限定判定。
 */
test("Profile現在認可は同TokenのRole変更と認証不能を分離する", (t) => {
  const f = managementFixture(t);
  const current = path.join(f.directory, "access-management.json");
  const original = fs.readFileSync(current);
  for (const role of ["developer", "manager", "administrator"] as const)
    assert.equal(
      resolveAiProfileManagementAccess(f.root, f.tokens[role]),
      role === "developer" ? "denied" : "allowed",
    );
  assert.deepEqual(fs.readFileSync(current), original);
  const manager = f.state.users.find((user) => user.role === "manager");
  assert.ok(manager);
  manager.role = "developer";
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    resolveAiProfileManagementAccess(f.root, f.tokens.manager),
    "denied",
  );
  manager.role = "administrator";
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    resolveAiProfileManagementAccess(f.root, f.tokens.manager),
    "allowed",
  );
  const credential = f.state.credentials.find(
    (item) => item.userId === manager.userId,
  );
  assert.ok(credential);
  credential.revoked = true;
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    resolveAiProfileManagementAccess(f.root, f.tokens.manager),
    "unavailable",
  );
  credential.revoked = false;
  f.state.users = [manager];
  f.state.credentials = [credential];
  f.state.initialization = {
    stage: "credential_stored",
    attemptId: credential.operationId,
    userId: manager.userId,
    initialCredentialId: credential.credentialId,
    confirmationCredentialId: credential.credentialId,
  };
  assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    resolveAiProfileManagementAccess(f.root, f.tokens.manager),
    "unavailable",
  );
  assert.equal(
    resolveAiProfileManagementAccess(f.root, "invalid"),
    "unavailable",
  );
  fs.writeFileSync(current, "{}");
  assert.equal(
    resolveAiProfileManagementAccess(f.root, f.tokens.manager),
    "unavailable",
  );
});

/**
 * 四管理対象のRole別表示を完全なDTOへ照合する。
 * @responsibility 管理対象間の情報混在と登録・公開の混同を拒否する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @precondition 三Role資格と設定なし・空・二範囲の登録を自己生成Rootへ保存する。
 * @stimulus 三Roleで四kindを読み、Role変更後に次要求を実行する。
 * @observation 同改訂の全field・全行・凍結・current bytes。
 * @oracle managerのRole設定は二Roleだけ、adminは三Role。developerは全拒否。Root・資格・種類外情報0。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 管理読取り公開Root→現在認証・対象認可→保存・DTO。
 */
test("管理readは四対象と三Roleの現在範囲だけを返す", (t) => {
  const f = managementFixture(t);
  for (const id of ["unset", "empty", "both"]) {
    const root = path.resolve(f.directory, id);
    const normalized = process.platform === "win32" ? root.toLowerCase() : root;
    f.state.registeredRepositories.push({
      repositoryId: id,
      repositoryRoot: root,
      bindingId: `binding-${createHash("sha256").update(`${id}\n${normalized}`).digest("hex").slice(0, 32)}`,
    });
  }
  f.state.exposure = [
    { repositoryId: "empty", workspaceIds: [] },
    { repositoryId: "both", workspaceIds: ["development", "management"] },
  ];
  const current = path.join(f.directory, "access-management.json");
  assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
  fs.writeFileSync(current, bytes(f.state));
  const before = fs.readFileSync(current);
  for (const role of ["developer", "manager", "administrator"] as const) {
    for (const kind of [
      "users",
      "roleContentAccess",
      "registeredRepositories",
      "exposure",
    ] as const) {
      const result = readManagementState(f.root, f.tokens[role], kind);
      if (role === "developer") {
        assert.deepEqual(result, {
          status: "unavailable",
          reason: "management_state_read_rejected",
        });
        continue;
      }
      assert.equal(result.status, "completed");
      if (result.status !== "completed") continue;
      const dto = result.snapshot;
      assert.equal(dto.revision, 1);
      assert.equal(dto.kind, kind);
      switch (dto.kind) {
        case "users":
          assert.deepEqual(Object.keys(dto).sort(), [
            "kind",
            "revision",
            "users",
          ]);
          assert.deepEqual(dto.users, f.state.users);
          for (const user of dto.users) {
            assert.equal(Object.isFrozen(user), true);
            assert.deepEqual(Object.keys(user).sort(), [
              "role",
              "userId",
              "username",
            ]);
          }
          assert.equal(Object.isFrozen(dto.users), true);
          break;
        case "roleContentAccess":
          assert.deepEqual(Object.keys(dto).sort(), [
            "kind",
            "revision",
            "roles",
          ]);
          assert.deepEqual(
            dto.roles,
            f.state.roleContentAccess.filter(
              (item) =>
                role === "administrator" || item.role !== "administrator",
            ),
          );
          assert.equal(Object.isFrozen(dto.roles), true);
          for (const item of dto.roles) {
            assert.deepEqual(Object.keys(item).sort(), [
              "role",
              "workspaceIds",
            ]);
            assert.equal(Object.isFrozen(item), true);
            assert.equal(Object.isFrozen(item.workspaceIds), true);
          }
          break;
        case "registeredRepositories":
          assert.deepEqual(Object.keys(dto).sort(), [
            "kind",
            "repositories",
            "revision",
          ]);
          assert.deepEqual(
            dto.repositories,
            f.state.registeredRepositories.map((item) => ({
              repositoryId: item.repositoryId,
              bindingId: item.bindingId,
            })),
          );
          for (const item of dto.repositories) {
            assert.deepEqual(Object.keys(item).sort(), [
              "bindingId",
              "repositoryId",
            ]);
            assert.equal(Object.isFrozen(item), true);
          }
          assert.equal(Object.isFrozen(dto.repositories), true);
          break;
        case "exposure":
          assert.deepEqual(Object.keys(dto).sort(), [
            "kind",
            "repositories",
            "revision",
          ]);
          assert.deepEqual(dto.repositories, [
            { repositoryId: "unset", workspaceIds: null },
            { repositoryId: "empty", workspaceIds: [] },
            {
              repositoryId: "both",
              workspaceIds: ["development", "management"],
            },
          ]);
          for (const item of dto.repositories) {
            assert.deepEqual(Object.keys(item).sort(), [
              "repositoryId",
              "workspaceIds",
            ]);
            assert.equal(Object.isFrozen(item), true);
            if (item.workspaceIds)
              assert.equal(Object.isFrozen(item.workspaceIds), true);
          }
          assert.equal(Object.isFrozen(dto.repositories), true);
          break;
      }
      assert.equal(Object.isFrozen(dto), true);
    }
  }
  assert.deepEqual(fs.readFileSync(current), before);
  const manager = f.state.users[1];
  assert.ok(manager);
  manager.role = "developer";
  f.state.revision++;
  f.state.operationId = crypto.randomUUID();
  fs.writeFileSync(current, bytes(f.state));
  assert.deepEqual(readManagementState(f.root, f.tokens.manager, "users"), {
    status: "unavailable",
    reason: "management_state_read_rejected",
  });
});

/**
 * 認証・対象許可前は短命材料に処置しない。
 * @responsibility 不正kind・誤鍵・developer・初回途中の拒否を状態観測や清掃から分離する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 通常管理の三Roleと破損pending、初回資格保存段階を用意する。
 * @stimulus 不正kind、誤鍵、developer、初回途中readを与える。
 * @observation 入力変換回数、Filesystem呼出し、材料bytes、公開field。
 * @oracle 不正kindはLock・I/O0、他拒否はpending不変・非開示。許可主体だけ材料不明へ到達する。
 * @cleanup 差替えを復元しFixtureがRootを回収する。
 * @boundary 管理読取り入力・現在資格・対象認可・既存保存材料。
 */
test("管理read拒否は材料保持と不正kindの観測0を守る", (t) => {
  const f = managementFixture(t);
  const pending = path.join(f.directory, "access-management.pending.json");
  fs.writeFileSync(pending, "{");
  const open = fs.openSync;
  let opened = 0;
  let converted = 0;
  fs.openSync = (...args: Parameters<typeof fs.openSync>) => {
    opened++;
    return open(...args);
  };
  t.after(() => {
    fs.openSync = open;
  });
  for (const kind of [
    null,
    undefined,
    "credentials",
    "",
    1,
    {},
    new Proxy(
      {},
      {
        get() {
          converted++;
          throw new Error("unexpected");
        },
      },
    ),
  ])
    assert.deepEqual(readManagementState(f.root, f.tokens.manager, kind), {
      status: "unavailable",
      reason: "management_state_read_rejected",
    });
  assert.equal(opened, 0);
  assert.equal(converted, 0);
  fs.openSync = open;
  assert.deepEqual(
    readManagementState(f.root, createCredentialMaterial().token, "users"),
    {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    },
  );
  assert.deepEqual(readManagementState(f.root, f.tokens.developer, "users"), {
    status: "unavailable",
    reason: "management_state_read_rejected",
  });
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.deepEqual(readManagementState(f.root, f.tokens.manager, "users"), {
    status: "unavailable",
    reason: "management_state_cleanup_pending",
  });
  const initial = fixture(t);
  const attempt = prepareInitialUser(initial);
  const issued = createInitialCredential(initial.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token) return;
  fs.writeFileSync(
    path.join(initial.directory, "access-management.pending.json"),
    "{",
  );
  assert.deepEqual(
    readManagementState(initial.root, issued.value.token, "users"),
    { status: "unavailable", reason: "management_state_read_rejected" },
  );
  assert.equal(
    fs.readFileSync(
      path.join(initial.directory, "access-management.pending.json"),
      "utf8",
    ),
    "{",
  );
});

/**
 * 管理readの材料清掃・Lock終了不明を成功一覧へ畳まない。
 * @responsibility 許可済み読取りでも終了条件未成立ならDTOを隠すことを検証する。
 * @trace RFD-IT-021
 * @precondition 自己生成Rootの三Role状態と通常出版前材料を用意する。
 * @stimulus pending削除失敗、Lock削除失敗、current破損を順に注入する。
 * @observation 固定結果・材料残存・復元後の同改訂・空一覧成功。
 * @oracle cleanup／解放／観測不明はSnapshot0、復元後は確認済み0件を返す。
 * @cleanup 差替え復元後にFixtureが所有Rootを回収する。
 * @boundary 管理投影と保存Ownerの終了確認。
 */
test("管理readは清掃・解放・観測不明で一覧を返さない", (t) => {
  const f = managementFixture(t);
  const next = structuredClone(f.state);
  next.revision++;
  next.operationId = crypto.randomUUID();
  prepare(f, next);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return remove(target, options);
  };
  assert.deepEqual(readManagementState(f.root, f.tokens.manager, "exposure"), {
    status: "unavailable",
    reason: "management_state_cleanup_pending",
  });
  fs.rmSync = remove;
  assert.deepEqual(readManagementState(f.root, f.tokens.manager, "exposure"), {
    status: "completed",
    snapshot: { revision: 1, kind: "exposure", repositories: [] },
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  assert.deepEqual(readManagementState(f.root, f.tokens.manager, "users"), {
    status: "unavailable",
    reason: "management_state_release_unknown",
  });
  fs.rmSync = remove;
  assert.equal(
    readManagementState(f.root, f.tokens.manager, "users").status,
    "completed",
  );
  fs.writeFileSync(path.join(f.directory, "access-management.json"), "{");
  assert.deepEqual(readManagementState(f.root, f.tokens.manager, "exposure"), {
    status: "unavailable",
    reason: "management_state_observation_unknown",
  });
});

/**
 * 三Roleの本人表示と内容・公開範囲の交差を確認する。
 * @responsibility 固定管理候補を内容閲覧・現在実行許可へ転用しないことを検証する。
 * @trace RFD-IT-013
 * @precondition 三Role資格と複数登録・公開範囲を自己生成Rootに保存する。
 * @stimulus 各資格で本人読取り後、Role内容範囲を変更して再読取りする。
 * @observation DTO全field、対象制約、交差集合、凍結状態、current byte。
 * @oracle 本人以外・内部Path・資格材料0、空交差0、改訂一致、保存不変更。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 公開本人読取り→現在認証・保存Lock→非秘密DTO。
 */
test("本人権限は管理候補と内容・Exposure交差を分離する", (t) => {
  const f = managementFixture(t);
  for (const [id, workspaces] of [
    ["dev", ["development"]],
    ["mgmt", ["management"]],
    ["both", ["development", "management"]],
    ["empty", []],
  ] as const) {
    const root = path.resolve(f.directory, id);
    const normalized = process.platform === "win32" ? root.toLowerCase() : root;
    f.state.registeredRepositories.push({
      repositoryId: id,
      repositoryRoot: root,
      bindingId: `binding-${createHash("sha256").update(`${id}\n${normalized}`).digest("hex").slice(0, 32)}`,
    });
    f.state.exposure.push({ repositoryId: id, workspaceIds: [...workspaces] });
  }
  const current = path.join(f.directory, "access-management.json");
  fs.writeFileSync(current, bytes(f.state));
  const before = fs.readFileSync(current);
  for (const role of ["developer", "manager", "administrator"] as const) {
    const result = readCurrentAccess(f.root, f.tokens[role]);
    assert.equal(result.status, "completed");
    if (result.status !== "completed") continue;
    const dto = result.snapshot;
    assert.deepEqual(Object.keys(dto).sort(), [
      "contentAccess",
      "managementOperations",
      "permittedRepositories",
      "revision",
      "user",
    ]);
    assert.equal(dto.user.role, role);
    assert.deepEqual(Object.keys(dto.user).sort(), [
      "role",
      "userId",
      "username",
    ]);
    assert.equal(dto.revision, 1);
    assert.deepEqual(
      dto.contentAccess.workspaceIds,
      f.state.roleContentAccess.find((item) => item.role === role)
        ?.workspaceIds,
    );
    assert.deepEqual(
      dto.permittedRepositories,
      role === "developer"
        ? [
            { repositoryId: "dev", workspaceIds: ["development"] },
            { repositoryId: "both", workspaceIds: ["development"] },
          ]
        : role === "manager"
          ? [
              { repositoryId: "dev", workspaceIds: ["development"] },
              { repositoryId: "mgmt", workspaceIds: ["management"] },
              {
                repositoryId: "both",
                workspaceIds: ["development", "management"],
              },
            ]
          : [],
    );
    for (const repository of dto.permittedRepositories)
      assert.deepEqual(Object.keys(repository).sort(), [
        "repositoryId",
        "workspaceIds",
      ]);
    assert.equal(
      dto.managementOperations.length,
      role === "developer" ? 0 : role === "manager" ? 15 : 25,
    );
    const expected = [];
    if (role !== "developer") {
      const allRoles = ["developer", "manager", "administrator"];
      const editableRoles =
        role === "manager" ? allRoles.slice(0, 2) : allRoles;
      for (const targetRole of allRoles)
        expected.push({ operation: "updateUserName", targetRole });
      for (const targetRole of editableRoles) {
        expected.push(
          { operation: "registerUser", plannedRole: targetRole },
          { operation: "updateRoleContentAccess", targetRole },
        );
        for (const nextRole of editableRoles)
          expected.push({
            operation: "changeUserRole",
            currentRole: targetRole,
            nextRole,
          });
      }
      for (const operation of [
        "registerRepository",
        "unregisterRepository",
        "updateExposure",
        "manageAiProfiles",
      ])
        expected.push({ operation });
      if (role === "administrator")
        for (const operation of [
          "issueCredential",
          "revokeCredential",
          "exchangeCredentials",
        ])
          expected.push({ operation });
    }
    assert.deepEqual(
      dto.managementOperations.map((item) => JSON.stringify(item)).sort(),
      expected.map((item) => JSON.stringify(item)).sort(),
    );
    if (role === "manager") {
      assert.ok(
        dto.managementOperations.some(
          (item) =>
            item.operation === "updateUserName" &&
            item.targetRole === "administrator",
        ),
      );
      assert.ok(
        dto.managementOperations.every(
          (item) =>
            item.operation !== "issueCredential" &&
            item.operation !== "revokeCredential" &&
            item.operation !== "exchangeCredentials" &&
            (item.operation !== "changeUserRole" ||
              (item.currentRole !== "administrator" &&
                item.nextRole !== "administrator")) &&
            (item.operation !== "updateRoleContentAccess" ||
              item.targetRole !== "administrator") &&
            (item.operation !== "registerUser" ||
              item.plannedRole !== "administrator"),
        ),
      );
    }
    for (const value of [
      dto,
      dto.user,
      dto.managementOperations,
      dto.contentAccess,
      dto.contentAccess.workspaceIds,
      dto.permittedRepositories,
      ...dto.managementOperations,
      ...dto.permittedRepositories,
      ...dto.permittedRepositories.map((item) => item.workspaceIds),
    ])
      assert.equal(Object.isFrozen(value), true);
  }
  assert.deepEqual(fs.readFileSync(current), before);
  const manager = f.state.users[1];
  assert.ok(manager);
  manager.role = "developer";
  f.state.revision = 2;
  f.state.operationId = crypto.randomUUID();
  fs.writeFileSync(current, bytes(f.state));
  const changed = readCurrentAccess(f.root, f.tokens.manager);
  assert.equal(changed.status, "completed");
  if (changed.status === "completed") {
    assert.equal(changed.snapshot.revision, 2);
    assert.equal(changed.snapshot.user.role, "developer");
    assert.deepEqual(changed.snapshot.managementOperations, []);
  }
});

/**
 * 本人拒否と後続清掃・解放不明を非開示結果へ閉じる。
 * @responsibility 認証前材料保持と成功投影の終了条件を検証する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @precondition 自己生成Rootと出版前材料を用意する。
 * @stimulus 誤鍵、破損pending、清掃失敗、Lock解放失敗を順に与える。
 * @observation 結果field、材料bytes、状態bytes、復元後再入場。
 * @oracle 拒否は材料不変更、未確認結果はSnapshot・内部回復参照0。
 * @cleanup 差替えを復元しFixtureがRoot不存在を確認する。
 * @boundary 現在認証・材料清掃・Lock解放の直接Filesystem境界。
 */
test("本人読取りは拒否・材料不明・解放不明でDTOを返さない", (t) => {
  const f = managementFixture(t);
  const next = structuredClone(f.state);
  next.revision++;
  next.operationId = crypto.randomUUID();
  prepare(f, next);
  const pending = path.join(f.directory, "access-management.pending.json");
  const before = fs.readFileSync(pending);
  const wrong =
    f.tokens.manager.slice(0, -1) +
    (f.tokens.manager.endsWith("A") ? "B" : "A");
  assert.deepEqual(readCurrentAccess(f.root, wrong), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  assert.deepEqual(fs.readFileSync(pending), before);
  fs.writeFileSync(pending, "{");
  assert.deepEqual(readCurrentAccess(f.root, f.tokens.manager), {
    status: "unavailable",
    reason: "current_access_cleanup_pending",
  });
  fs.writeFileSync(pending, before);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return remove(target, options);
  };
  assert.deepEqual(readCurrentAccess(f.root, f.tokens.manager), {
    status: "unavailable",
    reason: "current_access_cleanup_pending",
  });
  fs.rmSync = remove;
  assert.equal(readCurrentAccess(f.root, f.tokens.manager).status, "completed");
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  assert.deepEqual(readCurrentAccess(f.root, f.tokens.manager), {
    status: "unavailable",
    reason: "current_access_release_unknown",
  });
  fs.rmSync = remove;
  assert.equal(readCurrentAccess(f.root, f.tokens.manager).status, "completed");
});

/**
 * 初回途中の本人表示を初回完成や管理操作へ昇格しない。
 * @responsibility 本人読取りの非更新と拒否・観測不能の非開示を確認する。
 * @trace RFD-IT-013
 * @trace RFD-IT-024
 * @precondition 自己生成Rootで初回資格保存まで進める。
 * @stimulus 本人read、通常管理、未知／失効鍵、破損currentを順に試す。
 * @observation 初回段階・current bytes・公開結果field・通常操作結果。
 * @oracle 初回不変更、通常管理拒否、拒否と観測不能でSnapshotなし。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 初回資格・本人読取り・現在保存Owner。
 */
test("初回途中の本人readは非更新で不成立状態を開示しない", (t) => {
  const f = fixture(t);
  const attempt = prepareInitialUser(f);
  const issued = createInitialCredential(f.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token) return;
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  assert.equal(
    readCurrentAccess(f.root, issued.value.token).status,
    "completed",
  );
  assert.deepEqual(fs.readFileSync(current), before);
  assert.equal(
    registerUser(
      f.root,
      issued.value.token,
      3,
      crypto.randomUUID(),
      "追加",
      "developer",
    ).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), before);
  const unknown = createCredentialMaterial().token;
  assert.deepEqual(readCurrentAccess(f.root, unknown), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  const state = JSON.parse(before.toString()) as AccessManagementState;
  const credential = state.credentials[0];
  assert.ok(credential);
  credential.revoked = true;
  fs.writeFileSync(current, bytes(state));
  assert.deepEqual(readCurrentAccess(f.root, issued.value.token), {
    status: "unavailable",
    reason: "current_access_observation_unknown",
  });
  const normal = managementFixture(t);
  const normalCredential = normal.state.credentials[1];
  assert.ok(normalCredential);
  normalCredential.revoked = true;
  assert.equal(
    parseAccessManagementState(bytes(normal.state)).status,
    "parsed",
  );
  fs.writeFileSync(
    path.join(normal.directory, "access-management.json"),
    bytes(normal.state),
  );
  assert.deepEqual(readCurrentAccess(normal.root, normal.tokens.manager), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  fs.writeFileSync(current, "{");
  assert.deepEqual(readCurrentAccess(f.root, issued.value.token), {
    status: "unavailable",
    reason: "current_access_observation_unknown",
  });
  assert.deepEqual(readCurrentAccess(f.root, "invalid"), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
});

/**
 * 管理4操作の成功と変更対象の閉包を確認する。
 * @responsibility managerの通常許可と現在Role反映を実保存で検証する。
 * @trace RFD-IT-021
 * @precondition 三Role資格と完了初回の自己生成Store。
 * @stimulus 登録・admin名前変更・dev/manager Role変更・内容範囲変更を公開Rootから行う。
 * @observation 保存結果・完全byte・対象外field・次認証・所有材料不存在。
 * @oracle 各処置は一改訂、資格・初回・Repository登録・Exposure・交換は不変、内容0でも固定管理可。
 * @cleanup Fixtureが全Rootを削除し不存在確認する。
 * @boundary 公開管理API→現在認可→実Filesystem保存。
 */
test("通常管理4操作は現在認可で対象fieldだけ保存する", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const protectedFields = {
    credentials: f.state.credentials,
    initialization: f.state.initialization,
    registeredRepositories: f.state.registeredRepositories,
    exposure: f.state.exposure,
    unresolvedKeyExchanges: f.state.unresolvedKeyExchanges,
  };
  const manager = f.state.users[1];
  const developer = f.state.users[2];
  const administrator = f.state.users[0];
  assert.ok(manager && developer && administrator);
  let revision = 1;
  const operations = [
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        "追加",
        "developer",
      ),
    () =>
      updateUserName(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        administrator.userId,
        "名前だけ変更",
      ),
    () =>
      changeUserRole(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        developer.userId,
        "developer",
        "manager",
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        revision,
        crypto.randomUUID(),
        "manager",
        [],
      ),
  ];
  for (const operation of operations) {
    const before = JSON.parse(
      fs.readFileSync(currentPath, "utf8"),
    ) as AccessManagementState;
    const result = operation();
    assert.equal(result.status, "completed");
    if (result.status !== "completed") return;
    assert.equal(result.expectedRevision, revision);
    assert.equal(result.revision, ++revision);
    const after = JSON.parse(
      fs.readFileSync(currentPath, "utf8"),
    ) as AccessManagementState;
    for (const [field, value] of Object.entries(protectedFields))
      assert.deepEqual(after[field as keyof AccessManagementState], value);
    assert.equal(after.operationId, result.operationId);
    assert.equal(
      after.users.filter((user) => user.userId === manager.userId).length,
      1,
    );
    assert.equal(
      after.users.find((user) => user.userId === manager.userId)?.username,
      manager.username,
    );
    assert.ok(
      after.users.length === before.users.length ||
        after.users.length === before.users.length + 1,
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    assert.equal(JSON.stringify(result).includes(f.tokens.manager), false);
  }
  const next = authenticateCredential(f.root, f.tokens.developer);
  assert.equal(next.status, "completed");
  if (next.status === "completed") assert.equal(next.snapshot.role, "manager");
  const name = authenticateCredential(f.root, f.tokens.administrator);
  assert.equal(name.status, "completed");
  if (name.status === "completed")
    assert.equal(name.snapshot.username, "名前だけ変更");
  assert.equal(
    registerUser(
      f.root,
      f.tokens.manager,
      revision,
      crypto.randomUUID(),
      "内容権限なしでも管理",
      "manager",
    ).status,
    "completed",
  );
});

/**
 * 三Role・対象三Role・管理4操作の実保存分担を全数確認する。
 * @responsibility 純粋判定だけでなく現在資格から保存までの36組を照合する。
 * @trace RFD-IT-021
 * @precondition 三Role資格の自己生成Store。
 * @stimulus 各組の前状態を復元し4公開操作を呼ぶ。
 * @observation completed／固定拒否、current差分、改訂、対象外集合、材料不存在。
 * @oracle developer全拒否、managerはadmin登録・Role／内容変更だけ拒否、admin全許可。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 公開管理4操作→現在資格・Role→実保存。
 */
test("三Roleと対象三Roleの通常4操作は36組の保存分担を守る", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const original = bytes(f.state);
  const operationId = "00000000-0000-4000-8000-000000000090";
  for (const actorRole of ["administrator", "manager", "developer"] as const) {
    for (const target of f.state.users) {
      const operations = [
        {
          requiresAdministrator: target.role === "administrator",
          invoke: () =>
            registerUser(
              f.root,
              f.tokens[actorRole],
              1,
              operationId,
              "登録",
              target.role,
            ),
        },
        {
          requiresAdministrator: false,
          invoke: () =>
            updateUserName(
              f.root,
              f.tokens[actorRole],
              1,
              operationId,
              target.userId,
              "変更",
            ),
        },
        {
          requiresAdministrator: target.role === "administrator",
          invoke: () =>
            changeUserRole(
              f.root,
              f.tokens[actorRole],
              1,
              operationId,
              target.userId,
              target.role,
              target.role === "developer" ? "manager" : "developer",
            ),
        },
        {
          requiresAdministrator: target.role === "administrator",
          invoke: () =>
            updateRoleContentAccess(
              f.root,
              f.tokens[actorRole],
              1,
              operationId,
              target.role,
              [],
            ),
        },
      ];
      for (const operation of operations) {
        fs.writeFileSync(currentPath, original);
        const expected =
          actorRole === "administrator" ||
          (actorRole === "manager" && !operation.requiresAdministrator);
        const result = operation.invoke();
        assert.equal(result.status, expected ? "completed" : "unavailable");
        if (!expected) {
          assert.deepEqual(result, {
            status: "unavailable",
            reason: "management_operation_rejected",
          });
          assert.deepEqual(fs.readFileSync(currentPath), original);
        } else {
          const saved = JSON.parse(
            fs.readFileSync(currentPath, "utf8"),
          ) as AccessManagementState;
          assert.equal(saved.revision, 2);
          for (const field of [
            "credentials",
            "initialization",
            "registeredRepositories",
            "exposure",
            "unresolvedKeyExchanges",
          ] as const)
            assert.deepEqual(saved[field], f.state[field]);
        }
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
      }
    }
  }
});

/**
 * 登録UUIDの生成前に正確な容量境界で停止する。
 * @responsibility 上限内currentから上限超過nextを作る前処置を確認する。
 * @trace RFD-IT-021
 * @precondition Schema-validな上限直前Snapshotを自己生成Rootに置く。
 * @stimulus 128文字の新User登録を要求する。
 * @observation current byte容量、UUID件数、固定容量失敗、byte不変、材料不存在。
 * @oracle UUID生成0、出版0、上限の引上げ・入力切捨てなし。
 * @cleanup 差替えを復元しFixtureがRoot不存在を確認する。
 * @boundary 公開登録→容量予約→実保存前停止。
 */
test("User登録の容量超過はUUID生成前に拒否する", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const repository = {
    repositoryId: "capacity-fixture",
    repositoryRoot: `${path.parse(f.directory).root.replaceAll("\\", "/")}x`,
    bindingId: `binding-${"0".repeat(32)}`,
  };
  f.state.registeredRepositories.push(repository);
  repository.repositoryRoot += "x".repeat(
    16_777_216 - 64 - bytes(f.state).byteLength,
  );
  const normalized = path
    .resolve(repository.repositoryRoot)
    .replace(/[\\/]+$/u, "");
  repository.bindingId = `binding-${createHash("sha256")
    .update(
      `${repository.repositoryId}\n${process.platform === "win32" ? normalized.toLowerCase() : normalized}`,
      "utf8",
    )
    .digest("hex")
    .slice(0, 32)}`;
  const before = bytes(f.state);
  assert.equal(before.byteLength, 16_777_216 - 64);
  assert.equal(parseAccessManagementState(before).status, "parsed");
  fs.writeFileSync(currentPath, before);
  const originalUUID = crypto.randomUUID;
  let generated = 0;
  crypto.randomUUID = () => {
    generated++;
    return originalUUID();
  };
  try {
    const result = registerUser(
      f.root,
      f.tokens.manager,
      1,
      "00000000-0000-4000-8000-000000000090",
      "x".repeat(128),
      "developer",
    );
    assert.equal(result.status, "unavailable");
    if (
      result.status === "unavailable" &&
      result.reason === "management_operation_unavailable"
    ) {
      assert.equal(result.primaryFailure, "state_store_capacity_exceeded");
      assert.equal(result.publication, "not_attempted");
      assert.equal(result.cleanupConfirmed, true);
    } else assert.fail("容量拒否が欠落した");
    assert.equal(generated, 0);
    assert.deepEqual(fs.readFileSync(currentPath), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  } finally {
    crypto.randomUUID = originalUUID;
  }
});

/**
 * 通常管理の拒否を保存不明へ変換しない。
 * @responsibility 非開示拒否・現在Role・入力境界・UUID非生成を確認する。
 * @trace RFD-IT-021
 * @precondition 三Role資格の自己生成Store。
 * @stimulus 禁止対象、誤鍵、競合、不正値、Proxy／accessor、途中初回を入力する。
 * @observation 固定結果・current完全byte・UUID件数・材料不存在・getter件数。
 * @oracle 拒否時は対象情報0、生成・出版0、入力を暗黙変換しない。
 * @cleanup 差替えを復元しFixtureがRoot不存在を確認する。
 * @boundary 公開管理API→認証・入力・固定管理許可→実保存前停止。
 */
test("通常管理拒否は非開示・UUID0・保存0", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(currentPath);
  const administrator = f.state.users[0];
  assert.ok(administrator);
  const originalUUID = crypto.randomUUID;
  let generated = 0;
  crypto.randomUUID = () => {
    generated++;
    return originalUUID();
  };
  t.after(() => {
    crypto.randomUUID = originalUUID;
  });
  const operationId = "00000000-0000-4000-8000-000000000090";
  let invoked = 0;
  const accessor: unknown[] = [];
  Object.defineProperty(accessor, "0", {
    get() {
      invoked++;
      return "development";
    },
  });
  const proxy = new Proxy([], {
    get() {
      invoked++;
      throw new Error("not_allowed");
    },
  });
  const operations = [
    () =>
      registerUser(
        f.root,
        f.tokens.developer,
        1,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "名前",
        "administrator",
      ),
    () => registerUser(f.root, "invalid", 1, operationId, "名前", "developer"),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        0,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        2,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      registerUser(f.root, f.tokens.manager, 1, "invalid", "名前", "developer"),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        " 名前",
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "x".repeat(129),
        "developer",
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "x".repeat(2_000_000),
        "developer",
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        Array(100_000).fill("development"),
      ),
    () =>
      registerUser(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "a\u0000",
        "developer",
      ),
    () =>
      registerUser(f.root, f.tokens.manager, 1, operationId, "a", "management"),
    () =>
      updateUserName(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "missing",
        "名前",
      ),
    () =>
      changeUserRole(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        administrator.userId,
        "administrator",
        "developer",
      ),
    () =>
      changeUserRole(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        administrator.userId,
        "developer",
        "manager",
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "administrator",
        [],
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        ["unknown"],
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        ["development", "development"],
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        accessor,
      ),
    () =>
      updateRoleContentAccess(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        "developer",
        proxy,
      ),
  ];
  for (const operation of operations) {
    assert.deepEqual(operation(), {
      status: "unavailable",
      reason: "management_operation_rejected",
    });
    assert.deepEqual(fs.readFileSync(currentPath), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
  assert.equal(generated, 0);
  assert.equal(invoked, 0);
  const revoked = structuredClone(f.state);
  const credential = revoked.credentials[1];
  assert.ok(credential);
  credential.revoked = true;
  fs.writeFileSync(currentPath, bytes(revoked));
  assert.deepEqual(
    registerUser(f.root, f.tokens.manager, 1, operationId, "名前", "developer"),
    { status: "unavailable", reason: "management_operation_rejected" },
  );
  assert.deepEqual(fs.readFileSync(currentPath), bytes(revoked));
  const initial = fixture(t);
  const attempt = prepareInitialUser(initial);
  const issued = createInitialCredential(initial.root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status === "completed" && issued.value.token) {
    const initialPath = path.join(initial.directory, "access-management.json");
    const saved = fs.readFileSync(initialPath);
    assert.deepEqual(
      registerUser(
        initial.root,
        issued.value.token,
        3,
        operationId,
        "名前",
        "developer",
      ),
      { status: "unavailable", reason: "management_operation_rejected" },
    );
    assert.deepEqual(fs.readFileSync(initialPath), saved);
  }
});

/**
 * 非認可要求は先行保存材料を処置しない。
 * @responsibility base／next一致の材料も現在認可前は保持する。
 * @trace RFD-IT-021
 * @precondition 三Role資格と先行pending／replaceを持つ自己生成Store。
 * @stimulus 誤鍵・developer・改訂競合・managerの禁止対象を要求する。
 * @observation current／pending／replaceの完全byte、UUID生成と材料削除件数。
 * @oracle 固定非開示拒否で状態・材料不変、UUID生成0・材料削除0。
 * @cleanup 差替えを復元してFixtureがRoot不存在を確認する。
 * @boundary 公開通常管理入口と認可前のFilesystem境界。
 */
test("非認可の通常管理はbase／nextの先行保存材料を保持する", (t) => {
  const f = managementFixture(t);
  const administrator = f.state.users[0];
  assert.ok(administrator);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000091";
  const operationId = "00000000-0000-4000-8000-000000000090";
  const originalUUID = crypto.randomUUID;
  const originalRemove = fs.rmSync;
  let generated = 0;
  let removed = 0;
  crypto.randomUUID = () => {
    generated++;
    return originalUUID();
  };
  fs.rmSync = (target, options) => {
    if (
      String(target).endsWith("access-management.pending.json") ||
      String(target).endsWith("access-management.replace.json")
    )
      removed++;
    return originalRemove(target, options);
  };
  try {
    for (const current of [f.state, next]) {
      prepare(f, next);
      fs.writeFileSync(
        path.join(f.directory, "access-management.json"),
        bytes(current),
      );
      const names = [
        "access-management.json",
        "access-management.pending.json",
        "access-management.replace.json",
      ];
      const before = names.map((name) =>
        fs.readFileSync(path.join(f.directory, name)),
      );
      const operations: (() => UserRoleManagementResult)[] = [
        () =>
          registerUser(
            f.root,
            "invalid",
            current.revision,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          registerUser(
            f.root,
            f.tokens.developer,
            current.revision,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          registerUser(
            f.root,
            f.tokens.manager,
            current.revision + 1,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          changeUserRole(
            f.root,
            f.tokens.manager,
            current.revision,
            operationId,
            administrator.userId,
            "administrator",
            "developer",
          ),
      ];
      for (const operation of operations) {
        assert.deepEqual(operation(), {
          status: "unavailable",
          reason: "management_operation_rejected",
        });
        names.forEach((name, index) => {
          assert.deepEqual(
            fs.readFileSync(path.join(f.directory, name)),
            before[index],
          );
        });
        assert.deepEqual(fs.readdirSync(f.directory).sort(), [...names].sort());
      }
    }
    assert.equal(generated, 0);
    assert.equal(removed, 0);
  } finally {
    crypto.randomUUID = originalUUID;
    fs.rmSync = originalRemove;
  }
});

/**
 * Canonical Identityを持つ自己生成Repositoryを用意する。
 * @responsibility 実Hostと分離したGit境界・manifest・表示投影を作る。
 * @trace RFD-IT-001
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus git initと固定文書を生成する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 正本と表示Identityが同じ。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
function repositoryFixture(t: TestContext) {
  const f = fixture(t);
  const git = spawnSync("git", ["init", "--quiet", f.directory], {
    encoding: "utf8",
  });
  assert.equal(git.status, 0, git.stderr);
  const manifest = {
    schema: "crdd/repository-manifest/v2",
    projectId: "project.fixture",
    repositoryId: "repository.fixture",
    displayName: "試験",
    repositoryRole: "development",
    capabilities: [],
    contextSurfaces: [],
    externalSendPolicy: null,
  };
  fs.mkdirSync(path.join(f.directory, ".crdd", "config"), { recursive: true });
  const manifestPath = path.join(
    f.directory,
    ".crdd",
    "config",
    "repository-manifest.json",
  );
  fs.writeFileSync(manifestPath, JSON.stringify(manifest));
  const headings = [
    "今どうなっているか",
    "何が危ない、または止まっているか",
    "今、人間が決めることは何か",
    "なぜこの状態・判断になったか",
    "次に何をすべきか",
  ];
  const context =
    "# Project Context\n\nProject ID: project.fixture\nRepository ID: repository.fixture\nRepository Role: development\n" +
    headings
      .map(
        (heading, i) =>
          `\n## ${i + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
      )
      .join("");
  fs.writeFileSync(path.join(f.directory, "PROJECT_CONTEXT.md"), context);
  return { ...f, manifest, manifestPath, context };
}

/**
 * 公開済みRepositoryと三Roleの内容要求前状態を構築する。
 * @responsibility 登録・Exposureの公開入口を通して内容認可の前提を作る。
 * @trace RFD-IT-013
 * @precondition 自己生成管理StoreとGit Repositoryだけを使う。
 * @stimulus managerで登録とdevelopment公開を確定する。
 * @observation 各管理結果と完全現在状態を確認する。
 * @oracle 登録改訂2、公開改訂3。管理者の内容範囲は空のまま。
 * @cleanup 既存Fixtureが全自己生成Rootを削除する。
 * @boundary AM公開管理入口と実Git／Filesystem。
 */
function contentFixture(t: TestContext) {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  assert.equal(
    registerRepository(
      f.root,
      f.tokens.manager,
      1,
      crypto.randomUUID(),
      target.manifest.repositoryId,
      target.directory,
    ).status,
    "completed",
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      2,
      crypto.randomUUID(),
      target.manifest.repositoryId,
      ["development"],
    ).status,
    "completed",
  );
  return { ...f, target };
}

/**
 * 同改訂の許可集合を全範囲と一意な実体へ結合する。
 * @responsibility 複数範囲を落とさず、認証済み空集合と次要求の再認可を確認する。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @precondition 自己生成管理Storeと二つのGit Repository。
 * @stimulus 複数範囲公開・三Role読取り・公開解除を行う。
 * @observation 集合改訂・全範囲・要素一意性・manifest open回数・凍結を確認する。
 * @oracle 各許可Repositoryは一回観測。空内容範囲は認証済み空集合。次要求は変更を反映する。
 * @cleanup 既存Fixtureが全自己生成Rootを削除し不存在確認する。
 * @boundary AM公開入口と実Git／Filesystem。
 */
test("許可Repository集合は同改訂・全範囲・一意な実体を保持", (t) => {
  const f = contentFixture(t),
    second = repositoryFixture(t);
  const secondManifest = {
    ...second.manifest,
    repositoryId: "repository.second",
  };
  fs.writeFileSync(second.manifestPath, JSON.stringify(secondManifest));
  fs.writeFileSync(
    path.join(second.directory, "PROJECT_CONTEXT.md"),
    second.context.replaceAll("repository.fixture", "repository.second"),
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      3,
      crypto.randomUUID(),
      f.target.manifest.repositoryId,
      ["development", "management"],
    ).status,
    "completed",
  );
  assert.equal(
    registerRepository(
      f.root,
      f.tokens.manager,
      4,
      crypto.randomUUID(),
      secondManifest.repositoryId,
      second.directory,
    ).status,
    "completed",
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      5,
      crypto.randomUUID(),
      secondManifest.repositoryId,
      ["management"],
    ).status,
    "completed",
  );
  const open = fs.openSync,
    counts = new Map<string, number>();
  t.after(() => {
    fs.openSync = open;
  });
  fs.openSync = (target, flags, mode) => {
    const name = String(target);
    if ([f.target.manifestPath, second.manifestPath].includes(name))
      counts.set(name, (counts.get(name) ?? 0) + 1);
    return open(target, flags, mode);
  };
  try {
    const developer = resolveRepositoryAccessCollection(
      f.root,
      f.tokens.developer,
    );
    assert.equal(developer.status, "completed");
    if (developer.status !== "completed")
      throw new Error("collection unavailable");
    assert.equal(developer.managementRevision, 6);
    assert.deepEqual(
      developer.repositories.map((item) => [
        item.repositoryId,
        item.workspaceIds,
      ]),
      [["repository.fixture", ["development"]]],
    );
    assert.equal(counts.get(f.target.manifestPath), 1);
    assert.equal(counts.has(second.manifestPath), false);
    counts.clear();
    const manager = resolveRepositoryAccessCollection(f.root, f.tokens.manager);
    assert.equal(manager.status, "completed");
    if (manager.status !== "completed")
      throw new Error("collection unavailable");
    assert.equal(manager.managementRevision, 6);
    assert.deepEqual(
      manager.repositories.map((item) => [
        item.repositoryId,
        item.workspaceIds,
      ]),
      [
        ["repository.fixture", ["development", "management"]],
        ["repository.second", ["management"]],
      ],
    );
    assert.ok(Object.isFrozen(manager));
    assert.ok(Object.isFrozen(manager.repositories));
    for (const item of manager.repositories) {
      assert.ok(Object.isFrozen(item));
      assert.ok(Object.isFrozen(item.workspaceIds));
      assert.deepEqual(Object.keys(item).sort(), [
        "bindingId",
        "manifest",
        "repositoryId",
        "root",
        "workspaceIds",
      ]);
    }
    assert.equal(counts.get(f.target.manifestPath), 1);
    assert.equal(counts.get(second.manifestPath), 1);
    counts.clear();
    assert.deepEqual(
      resolveRepositoryAccessCollection(f.root, f.tokens.administrator),
      { status: "completed", managementRevision: 6, repositories: [] },
    );
    assert.equal(counts.size, 0);
  } finally {
    fs.openSync = open;
  }
  fs.rmSync(second.manifestPath);
  assert.deepEqual(
    resolveRepositoryAccessCollection(f.root, f.tokens.manager),
    { status: "unavailable", reason: "repository_access_observation_unknown" },
  );
  assert.equal(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer).status,
    "completed",
  );
  fs.writeFileSync(second.manifestPath, JSON.stringify(secondManifest));
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      6,
      crypto.randomUUID(),
      f.target.manifest.repositoryId,
      [],
    ).status,
    "completed",
  );
  assert.deepEqual(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer),
    { status: "completed", managementRevision: 7, repositories: [] },
  );
  const manager = resolveRepositoryAccessCollection(f.root, f.tokens.manager);
  assert.equal(manager.status, "completed");
  if (manager.status === "completed")
    assert.deepEqual(
      manager.repositories.map((item) => item.repositoryId),
      ["repository.second"],
    );
});

/**
 * 現在許可集合から実本文を一回読み中立Sourceへ搬送する。
 * @responsibility 管理改訂と本文版を分離し、許可外RootをReaderへ渡さない。
 * @trace RFD-IT-019
 * @precondition 公開済み一Repositoryと管理者の空内容範囲。
 * @stimulus 各Roleの現在集合を取得して固定本文を読み集約し、本文欠測も観測する。
 * @observation Reader対象open回数、4項目Source、本文版、Portfolio、固定取得不能結果。
 * @oracle developerだけ対象本文一回、administrator空集合は本文0。本文不明は版なしでnull／missingを作らない。
 * @cleanup Hook復元と既存Fixtureによる自己生成Root不存在確認。
 * @boundary AM実認可→Domain実本文Reader→Source→Portfolio。本番Surfaceの完成は対象外。
 */
test("許可集合の実本文と本文版を中立Sourceへ渡す", (t) => {
  const f = contentFixture(t),
    target = path.join(f.target.directory, "PROJECT_CONTEXT.md");
  const open = fs.openSync;
  let opened = 0;
  t.after(() => {
    fs.openSync = open;
  });
  fs.openSync = (file, flags, mode) => {
    if (String(file) === target) opened++;
    return open(file, flags, mode);
  };
  try {
    for (const role of ["developer", "administrator"] as const) {
      opened = 0;
      const collection = resolveRepositoryAccessCollection(
        f.root,
        f.tokens[role],
      );
      assert.equal(collection.status, "completed");
      if (collection.status !== "completed")
        throw new Error("collection unavailable");
      const sources: ProjectContextSource[] = [];
      for (const repository of collection.repositories) {
        const read = readRepositoryProjectContext(
          repository.root,
          repository.manifest,
        );
        assert.equal(read.status, "completed");
        if (read.status !== "completed") throw new Error("context unavailable");
        sources.push(
          Object.freeze({
            projectId: repository.manifest.projectId,
            repositoryId: repository.repositoryId,
            revision: read.revision,
            context: read.context,
          }),
        );
      }
      const portfolio = createPortfolioProjection(sources);
      assert.equal(opened, role === "developer" ? 1 : 0);
      if (role === "developer") {
        assert.deepEqual(Object.keys(sources[0] ?? {}).sort(), [
          "context",
          "projectId",
          "repositoryId",
          "revision",
        ]);
        assert.equal(portfolio.projects[0]?.state, "complete");
        assert.equal(
          portfolio.projects[0]?.sources[0]?.revision,
          `context-text-sha256:${createHash("sha256").update(f.target.context, "utf8").digest("hex")}`,
        );
        assert.notEqual(
          sources[0]?.revision,
          String(collection.managementRevision),
        );
      } else assert.deepEqual(portfolio.projects, []);
    }
    fs.rmSync(target);
    const collection = resolveRepositoryAccessCollection(
      f.root,
      f.tokens.developer,
    );
    assert.equal(collection.status, "completed");
    if (collection.status !== "completed")
      throw new Error("collection unavailable");
    const repository = collection.repositories[0];
    assert.ok(repository);
    const read = readRepositoryProjectContext(
      repository.root,
      repository.manifest,
    );
    assert.deepEqual(read, {
      status: "unavailable",
      reason: "project_context_observation_unavailable",
    });
    assert.equal(Object.hasOwn(read, "revision"), false);
    assert.equal(Object.hasOwn(read, "context"), false);
  } finally {
    fs.openSync = open;
  }
});

/**
 * 集合取得の拒否・清掃・対象観測・解放不明を区別する。
 * @responsibility 未認証観測と失敗時の部分集合公開を防ぐ。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @precondition 公開済みRepositoryとcredential_storedの有効資格を持つ自己生成Root。
 * @stimulus 初回未完了の有効資格で集合を要求し、不正資格・pending・manifest欠測・解放失敗も注入する。
 * @observation 初回stage、current／pending／replace完全byte・Directory一覧、対象観測数、再入場結果。
 * @oracle 初回未完了は材料処置前に固定拒否・能力0。拒否・清掃不明は対象観測0、対象・解放不明は集合非返却。
 * @cleanup Hookを復元し、既存Fixtureが全自己生成Rootを削除する。
 * @boundary 現在認証・保存Lock・対象Filesystem。
 */
test("許可集合の不明は空成功や部分成功へ変換しない", (t) => {
  const f = contentFixture(t),
    pending = path.join(f.directory, "access-management.pending.json");
  const initial = fixture(t);
  const issued = createInitialCredential(
    initial.root,
    prepareInitialUser(initial),
  );
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token)
    throw new Error("initial credential unavailable");
  assert.equal(
    authenticateCredential(initial.root, issued.value.token).status,
    "completed",
  );
  const initialCurrent = path.join(initial.directory, "access-management.json");
  assert.equal(
    JSON.parse(fs.readFileSync(initialCurrent, "utf8")).initialization.stage,
    "credential_stored",
  );
  const initialPending = path.join(
    initial.directory,
    "access-management.pending.json",
  );
  const initialReplace = path.join(
    initial.directory,
    "access-management.replace.json",
  );
  fs.writeFileSync(initialPending, "{");
  fs.writeFileSync(initialReplace, "untrusted replacement");
  const initialFiles = [initialCurrent, initialPending, initialReplace];
  const initialBytes = initialFiles.map((file) => fs.readFileSync(file));
  const initialNames = fs.readdirSync(initial.directory);
  fs.writeFileSync(pending, "{");
  const lstat = fs.lstatSync;
  let observed = 0;
  t.after(() => {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
  });
  Object.defineProperty(fs, "lstatSync", {
    value: (target: fs.PathLike, options?: never) => {
      if (String(target).startsWith(f.target.directory)) observed++;
      return lstat(target, options);
    },
  });
  try {
    assert.deepEqual(
      resolveRepositoryAccessCollection(initial.root, issued.value.token),
      { status: "unavailable", reason: "repository_access_rejected" },
    );
    assert.equal(observed, 0);
    assert.deepEqual(
      initialFiles.map((file) => fs.readFileSync(file)),
      initialBytes,
    );
    assert.deepEqual(fs.readdirSync(initial.directory), initialNames);
    for (const token of ["invalid", createCredentialMaterial().token])
      assert.deepEqual(resolveRepositoryAccessCollection(f.root, token), {
        status: "unavailable",
        reason: "repository_access_rejected",
      });
    assert.equal(observed, 0);
    assert.equal(fs.readFileSync(pending, "utf8"), "{");
    assert.deepEqual(
      resolveRepositoryAccessCollection(f.root, f.tokens.developer),
      { status: "unavailable", reason: "repository_access_cleanup_pending" },
    );
    assert.equal(observed, 0);
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
  }
  fs.rmSync(pending);
  const manifest = fs.readFileSync(f.target.manifestPath);
  fs.rmSync(f.target.manifestPath);
  assert.deepEqual(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer),
    { status: "unavailable", reason: "repository_access_observation_unknown" },
  );
  fs.writeFileSync(f.target.manifestPath, manifest);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected private detail");
    return remove(target, options);
  };
  try {
    assert.deepEqual(
      resolveRepositoryAccessCollection(f.root, f.tokens.developer),
      { status: "unavailable", reason: "repository_access_release_unknown" },
    );
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(
    resolveRepositoryAccessCollection(f.root, f.tokens.developer).status,
    "completed",
  );
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.lock")),
    false,
  );
});

/**
 * 現在内容認可と実体検証を同要求へ相関する。
 * @responsibility 管理能力と内容許可を分離し、次要求の再認可を確認する。
 * @trace RFD-IT-013
 * @precondition 公開済み自己生成Repositoryと三Role資格。
 * @stimulus 三Roleの取得、Context削除、公開解除後の次取得を行う。
 * @observation 内部結果の改訂・Binding・manifest・Rootと対象外不変。
 * @oracle developer／managerだけ成功、Context欠測でもRoot解決成功、公開解除後は拒否。
 * @cleanup 既存Fixtureが全自己生成Rootを削除する。
 * @boundary 現在資格→Role内容→Exposure→VC／Domain実体観測。
 */
test("内容認可と実Rootを相関し次要求で公開解除を反映", (t) => {
  const f = contentFixture(t),
    id = f.target.manifest.repositoryId;
  for (const role of ["developer", "manager"] as const) {
    const result = resolveRepositoryAccess(
      f.root,
      f.tokens[role],
      id,
      "development",
    );
    assert.equal(result.status, "completed");
    if (result.status !== "completed") continue;
    assert.equal(result.access.revision, 3);
    assert.equal(result.access.repositoryId, id);
    assert.equal(result.access.workspaceId, "development");
    assert.deepEqual(result.access.manifest, f.target.manifest);
    assert.ok(result.access.bindingId.startsWith("binding-"));
    assert.ok(Object.isFrozen(result.access));
    assert.ok(Object.isFrozen(result.access.manifest));
    assert.deepEqual(Object.keys(result.access.root), ["contract"]);
  }
  assert.deepEqual(
    resolveRepositoryAccess(f.root, f.tokens.administrator, id, "development"),
    { status: "unavailable", reason: "repository_access_rejected" },
  );
  fs.rmSync(path.join(f.target.directory, "PROJECT_CONTEXT.md"));
  assert.equal(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development")
      .status,
    "completed",
  );
  assert.equal(
    updateExposure(f.root, f.tokens.manager, 3, crypto.randomUUID(), id, [])
      .status,
    "completed",
  );
  assert.deepEqual(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development"),
    { status: "unavailable", reason: "repository_access_rejected" },
  );
});

/**
 * 非許可と材料不明で対象Repositoryを観測しない。
 * @responsibility 拒否前の清掃・存在漏洩・未知入力の実行を防ぐ。
 * @trace RFD-IT-013
 * @precondition 公開済み対象と破損pendingを準備する。
 * @stimulus 誤鍵・未知ID・範囲外・Proxy・許可後材料不明を要求する。
 * @observation 対象Rootのlstat回数、Proxy trap、pending byteと固定結果。
 * @oracle 全要求の対象Root観測0、拒否ではpending不変、許可後はcleanup_pending。
 * @cleanup 観測差替えを復元しFixtureを清掃する。
 * @boundary AM認可・材料処置と外部Root観測の前境界。
 */
test("内容拒否とpending異常では対象Repository観測0", (t) => {
  const f = contentFixture(t),
    id = f.target.manifest.repositoryId;
  const pending = path.join(f.directory, "access-management.pending.json");
  fs.writeFileSync(pending, "{");
  const lstat = fs.lstatSync;
  let observations = 0,
    traps = 0;
  t.after(() => {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
  });
  const observedLstat: typeof fs.lstatSync = ((target, ...args) => {
    if (String(target).startsWith(f.target.directory)) observations++;
    return lstat(target, ...args);
  }) as typeof fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", { value: observedLstat });
  const proxy = new Proxy(
    {},
    {
      get() {
        traps++;
        throw new Error("not invoked");
      },
    },
  );
  for (const [token, repositoryId, workspaceId] of [
    ["bad", id, "development"],
    [f.tokens.developer, "unknown.repository", "development"],
    [f.tokens.developer, id, "management"],
    [f.tokens.administrator, id, "development"],
    [f.tokens.developer, proxy, "development"],
    [f.tokens.developer, id, proxy],
  ]) {
    assert.deepEqual(
      resolveRepositoryAccess(
        f.root,
        token as string,
        repositoryId,
        workspaceId,
      ),
      { status: "unavailable", reason: "repository_access_rejected" },
    );
    assert.equal(fs.readFileSync(pending, "utf8"), "{");
  }
  assert.deepEqual(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development"),
    { status: "unavailable", reason: "repository_access_cleanup_pending" },
  );
  assert.equal(observations, 0);
  assert.equal(traps, 0);
  fs.rmSync(pending);
  assert.equal(
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development")
      .status,
    "completed",
  );
  assert.ok(observations > 0);
  Object.defineProperty(fs, "lstatSync", { value: lstat });
});

/**
 * 実体不成立とLock解放不明で能力を返さない。
 * @responsibility 登録時の成功やRoot観測だけを現在完了へ流用しない。
 * @trace RFD-IT-013
 * @precondition 公開済み自己生成Repository。
 * @stimulus manifest欠測・不正・ID差・容量超過・Git消失と解放失敗を注入する。
 * @observation 固定結果、内部値非返却、復元後成功とLock不存在。
 * @oracle 各不成立はobservation_unknown、解放不明はrelease_unknown、Path／例外なし。
 * @cleanup 差替えを復元しFixtureが全Rootを削除する。
 * @boundary AM実体検証と既存Lock終了。
 */
test("内容実体不成立と解放不明は能力非返却", (t) => {
  const f = contentFixture(t),
    id = f.target.manifest.repositoryId;
  const request = () =>
    resolveRepositoryAccess(f.root, f.tokens.developer, id, "development");
  const expected = {
    status: "unavailable",
    reason: "repository_access_observation_unknown",
  };
  const currentPath = path.join(f.directory, "access-management.json");
  const currentBytes = fs.readFileSync(currentPath);
  const tampered = JSON.parse(currentBytes.toString("utf8"));
  tampered.registeredRepositories[0].bindingId =
    "binding-00000000000000000000000000000000";
  const tamperedBytes = bytes(tampered);
  assert.equal(parseAccessManagementState(tamperedBytes).status, "invalid");
  fs.writeFileSync(currentPath, tamperedBytes);
  const lstat = fs.lstatSync;
  let targetObservations = 0;
  const observe: typeof fs.lstatSync = ((target, ...args) => {
    if (String(target).startsWith(f.target.directory)) targetObservations++;
    return lstat(target, ...args);
  }) as typeof fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", { value: observe });
  try {
    assert.deepEqual(request(), expected);
    assert.equal(targetObservations, 0);
    assert.ok(fs.readFileSync(currentPath).equals(tamperedBytes));
    assert.equal(
      fs.existsSync(path.join(f.directory, "access-management.pending.json")),
      false,
    );
    assert.equal(
      fs.existsSync(path.join(f.directory, "access-management.replace.json")),
      false,
    );
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: lstat });
    fs.writeFileSync(currentPath, currentBytes);
  }
  const original = fs.readFileSync(f.target.manifestPath);
  fs.rmSync(f.target.manifestPath);
  assert.deepEqual(request(), expected);
  for (const content of [
    "{",
    JSON.stringify({ ...f.target.manifest, repositoryId: "other.repository" }),
    " ".repeat(1_048_577),
  ]) {
    fs.writeFileSync(f.target.manifestPath, content);
    assert.deepEqual(request(), expected);
  }
  fs.writeFileSync(f.target.manifestPath, original);
  const git = path.join(f.target.directory, ".git"),
    backup = path.join(f.target.directory, "git-backup");
  fs.renameSync(git, backup);
  assert.deepEqual(request(), expected);
  fs.renameSync(backup, git);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected secret/path must not escape");
    return remove(target, options);
  };
  assert.deepEqual(request(), {
    status: "unavailable",
    reason: "repository_access_release_unknown",
  });
  fs.rmSync = remove;
  assert.equal(request().status, "completed");
  assert.equal(
    fs.existsSync(path.join(f.directory, "access-management.lock")),
    false,
  );
});

/**
 * 通常登録・明示公開・解除の別責務を確認する。
 * @responsibility managerとadministratorで現在改訂を更新し対象外を保持する。
 * @trace RFD-IT-021
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus 登録→範囲設定→空範囲→Git消失後解除。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 登録は公開0、解除は両管理情報除去・本文不変。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
test("Repository登録と公開は独立し旧Root不成立でも解除できる", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const before = structuredClone(f.state);
  const op = (n: number) =>
    `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const registered = registerRepository(
    f.root,
    f.tokens.manager,
    1,
    op(90),
    target.manifest.repositoryId,
    target.directory,
  );
  assert.equal(registered.status, "completed");
  let current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.equal(current.value.registeredRepositories.length, 1);
  assert.deepEqual(current.value.exposure, []);
  assert.deepEqual(current.value.users, before.users);
  assert.deepEqual(current.value.credentials, before.credentials);
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.manager,
      2,
      op(91),
      target.manifest.repositoryId,
      ["development"],
    ).status,
    "completed",
  );
  assert.equal(
    updateExposure(
      f.root,
      f.tokens.administrator,
      3,
      op(92),
      target.manifest.repositoryId,
      [],
    ).status,
    "completed",
  );
  current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.deepEqual(current.value.exposure, [
    { repositoryId: target.manifest.repositoryId, workspaceIds: [] },
  ]);
  fs.rmSync(path.join(target.directory, ".git"), { recursive: true });
  const contextBefore = fs.readFileSync(
    path.join(target.directory, "PROJECT_CONTEXT.md"),
  );
  const manifestBefore = fs.readFileSync(target.manifestPath);
  assert.equal(
    unregisterRepository(
      f.root,
      f.tokens.manager,
      4,
      op(93),
      target.manifest.repositoryId,
    ).status,
    "completed",
  );
  current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status !== "completed") return;
  assert.deepEqual(current.value.registeredRepositories, []);
  assert.deepEqual(current.value.exposure, []);
  assert.deepEqual(current.value.users, before.users);
  assert.deepEqual(current.value.credentials, before.credentials);
  assert.deepEqual(current.value.initialization, before.initialization);
  assert.deepEqual(
    fs.readFileSync(path.join(target.directory, "PROJECT_CONTEXT.md")),
    contextBefore,
  );
  assert.deepEqual(fs.readFileSync(target.manifestPath), manifestBefore);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 登録拒否の外部Root観測0とIdentity不一致を確認する。
 * @responsibility 不許可・競合・不正対象の拒否が外部観測を発火しない。
 * @trace RFD-IT-002
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus 誤鍵・developer・改訂競合・不正ID、正本と表示の不一致を要求する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 認可前は観測0・保存0、認可後Identity不正も保存0。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
test("登録は認可前にRootを観測せずIdentity差を保存しない", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(currentPath);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const originalStat = fs.lstatSync;
  let observed = 0;
  Object.defineProperty(fs, "lstatSync", {
    value: ((...args: Parameters<typeof fs.lstatSync>) => {
      if (String(args[0]).startsWith(target.directory)) observed++;
      return originalStat(...args);
    }) as typeof fs.lstatSync,
    configurable: true,
    writable: true,
  });
  try {
    for (const [token, revision, id] of [
      ["invalid", 1, target.manifest.repositoryId],
      [f.tokens.developer, 1, target.manifest.repositoryId],
      [f.tokens.manager, 2, target.manifest.repositoryId],
      [f.tokens.manager, 1, "invalid id"],
    ] as const) {
      assert.deepEqual(
        registerRepository(
          f.root,
          token,
          revision,
          operationId,
          id,
          target.directory,
        ),
        { status: "unavailable", reason: "management_operation_rejected" },
      );
      assert.deepEqual(fs.readFileSync(currentPath), before);
    }
    assert.equal(observed, 0);
    assert.deepEqual(
      registerRepository(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        target.manifest.repositoryId,
        `${target.directory}/${"x".repeat(32_769)}`,
      ),
      {
        status: "unavailable",
        reason: "management_operation_rejected",
      },
    );
    assert.equal(observed, 0, "Root長超過はPath観測前に拒否する");
    assert.equal(
      registerRepository(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        target.manifest.repositoryId,
        target.directory,
      ).status,
      "completed",
    );
    assert.ok(observed > 0, "観測計測が許可例で発火する");
    fs.writeFileSync(currentPath, before);
  } finally {
    Object.defineProperty(fs, "lstatSync", {
      value: originalStat,
      configurable: true,
      writable: true,
    });
  }
  for (const variant of ["id", "manifest", "context", "git"]) {
    fs.writeFileSync(
      target.manifestPath,
      JSON.stringify(
        variant === "manifest"
          ? { ...target.manifest, projectId: "other.project" }
          : target.manifest,
      ),
    );
    fs.writeFileSync(
      path.join(target.directory, "PROJECT_CONTEXT.md"),
      variant === "context"
        ? target.context.replace(
            "Repository Role: development",
            "Repository Role: management",
          )
        : target.context,
    );
    if (variant === "git")
      fs.rmSync(path.join(target.directory, ".git"), { recursive: true });
    const result = registerRepository(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      variant === "id" ? "other.repository" : target.manifest.repositoryId,
      target.directory,
    );
    assert.equal(result.status, "unavailable");
    assert.deepEqual(fs.readFileSync(currentPath), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 登録固定Fileの容量上限とdescriptor解放を確認する。
 * @responsibility manifestとContextの個別超過で出版しない。
 * @trace RFD-IT-002
 * @precondition 非秘密の自己生成StoreとGit Repository。
 * @stimulus 各固定Fileを1 MiB+1とし、Contextの1 MiB正常例も比較する。
 * @observation current完全byte、pending／replace、開閉descriptor件数。
 * @oracle 超過はpublication not_attempted・保存0、上限内正常例は登録成功。
 * @cleanup 観測関数を復元しFixtureが自己生成Rootを削除する。
 * @boundary AM公開登録とDomain上限付き実File観測。
 */
test("登録固定Fileは各1 MiB上限と開閉の一致を守る", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(currentPath);
  const contextPath = path.join(target.directory, "PROJECT_CONTEXT.md");
  const op = "00000000-0000-4000-8000-000000000090";
  const originalOpen = fs.openSync,
    originalClose = fs.closeSync;
  const live = new Set<number>();
  let opened = 0,
    closed = 0;
  Object.defineProperty(fs, "openSync", {
    configurable: true,
    writable: true,
    value: ((...args: Parameters<typeof fs.openSync>) => {
      const fd = originalOpen(...args);
      if (String(args[0]).startsWith(target.directory)) {
        opened++;
        live.add(fd);
      }
      return fd;
    }) as typeof fs.openSync,
  });
  fs.closeSync = (fd) => {
    originalClose(fd);
    if (live.delete(fd)) closed++;
  };
  try {
    for (const file of [target.manifestPath, contextPath]) {
      fs.writeFileSync(target.manifestPath, JSON.stringify(target.manifest));
      fs.writeFileSync(contextPath, target.context);
      fs.writeFileSync(file, "x".repeat(1_048_577));
      const result = registerRepository(
        f.root,
        f.tokens.manager,
        1,
        op,
        target.manifest.repositoryId,
        target.directory,
      );
      assert.equal(result.status, "unavailable");
      if (
        result.status === "unavailable" &&
        result.reason === "management_operation_unavailable"
      )
        assert.equal(result.publication, "not_attempted");
      else assert.fail("容量拒否が欠測");
      assert.deepEqual(fs.readFileSync(currentPath), before);
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
      assert.equal(live.size, 0);
      assert.equal(opened, closed);
    }
    fs.writeFileSync(target.manifestPath, JSON.stringify(target.manifest));
    fs.writeFileSync(
      contextPath,
      target.context +
        " ".repeat(1_048_576 - Buffer.byteLength(target.context, "utf8")),
    );
    assert.equal(
      registerRepository(
        f.root,
        f.tokens.manager,
        1,
        op,
        target.manifest.repositoryId,
        target.directory,
      ).status,
      "completed",
    );
    assert.ok(opened > 0);
    assert.equal(live.size, 0);
    assert.equal(opened, closed);
  } finally {
    Object.defineProperty(fs, "openSync", {
      value: originalOpen,
      configurable: true,
      writable: true,
    });
    fs.closeSync = originalClose;
  }
});

/**
 * Exposure拒否と出版後清掃失敗を分離する。
 * @responsibility 未登録・不正範囲を保存せず既知出版を失わない。
 * @trace RFD-IT-021
 * @precondition Repository-localな自己生成StoreとGit Repository。
 * @stimulus 登録後の不許可・未知範囲・重複を入力しpending削除失敗を注入する。
 * @observation 完全byte・相関結果・対象外情報と実Filesystemを確認する。
 * @oracle 拒否はcurrent不変、出版後故障はconfirmedの未完了。
 * @cleanup Fixtureが自己生成Rootを削除し不存在を確認する。
 * @boundary Package公開管理入口と実Git／Filesystem。
 */
test("Exposure入力拒否と出版後清掃不明を区別する", (t) => {
  const f = managementFixture(t),
    target = repositoryFixture(t);
  const id = target.manifest.repositoryId;
  const op = "00000000-0000-4000-8000-000000000090",
    nextOp = "00000000-0000-4000-8000-000000000091";
  assert.equal(
    registerRepository(
      f.root,
      f.tokens.administrator,
      1,
      op,
      id,
      target.directory,
    ).status,
    "completed",
  );
  const currentPath = path.join(f.directory, "access-management.json"),
    before = fs.readFileSync(currentPath);
  for (const [token, repo, ranges] of [
    [f.tokens.developer, id, []],
    [f.tokens.manager, "missing", []],
    [f.tokens.manager, id, ["unknown"]],
    [f.tokens.manager, id, ["development", "development"]],
  ] as const) {
    assert.deepEqual(updateExposure(f.root, token, 2, nextOp, repo, ranges), {
      status: "unavailable",
      reason: "management_operation_rejected",
    });
    assert.deepEqual(fs.readFileSync(currentPath), before);
  }
  assert.deepEqual(
    registerRepository(
      f.root,
      f.tokens.manager,
      2,
      nextOp,
      id,
      target.directory,
    ),
    { status: "unavailable", reason: "management_operation_rejected" },
  );
  const originalRemove = fs.rmSync;
  fs.rmSync = (p, options) => {
    if (String(p).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return originalRemove(p, options);
  };
  let result: ReturnType<typeof updateExposure>;
  try {
    result = updateExposure(f.root, f.tokens.manager, 2, nextOp, id, [
      "management",
    ]);
  } finally {
    fs.rmSync = originalRemove;
  }
  assert.equal(result.status, "unavailable");
  if (
    result.status === "unavailable" &&
    result.reason === "management_operation_unavailable"
  ) {
    assert.equal(result.publication, "confirmed");
    assert.equal(result.observedRevision, 3);
    assert.equal(result.cleanupConfirmed, false);
  } else assert.fail("出版後失敗が欠測");
  const current = readAccessManagementState(f.root);
  assert.equal(current.status, "completed");
  if (current.status === "completed") {
    assert.deepEqual(current.value.exposure, [
      { repositoryId: id, workspaceIds: ["management"] },
    ]);
    const next = structuredClone(current.value);
    next.revision = 4;
    next.operationId = "00000000-0000-4000-8000-000000000092";
    prepare({ ...f, state: current.value }, next);
    const materialNames = [
      "access-management.json",
      "access-management.pending.json",
      "access-management.replace.json",
    ];
    const materialBytes = materialNames.map((name) =>
      fs.readFileSync(path.join(f.directory, name)),
    );
    for (const [token, revision] of [
      [f.tokens.developer, 3],
      ["invalid", 3],
      [f.tokens.manager, 2],
    ] as const) {
      assert.deepEqual(updateExposure(f.root, token, revision, op, id, []), {
        status: "unavailable",
        reason: "management_operation_rejected",
      });
      materialNames.forEach((name, index) => {
        assert.deepEqual(
          fs.readFileSync(path.join(f.directory, name)),
          materialBytes[index],
        );
      });
    }
    const settled = updateExposure(f.root, f.tokens.manager, 3, op, id, []);
    assert.equal(settled.status, "unavailable");
    if (
      settled.status === "unavailable" &&
      settled.reason === "management_operation_unavailable"
    ) {
      assert.equal(
        settled.primaryFailure,
        "state_store_previous_pending_settled",
      );
      assert.equal(settled.publication, "not_attempted");
    } else assert.fail("先行清掃の相関が欠測");
    assert.deepEqual(fs.readFileSync(currentPath), materialBytes[0]);
  }
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 前操作の清掃と今回出版・解放故障を分離する。
 * @responsibility 相関誤帰属と保存済みEffectの喪失を拒否する。
 * @trace RFD-IT-021
 * @precondition 三Role資格の自己生成Store。
 * @stimulus 先行pending、登録UUID衝突、rename故障、出版後pending／Lock削除故障を作る。
 * @observation 操作相関・改訂・publication・current・材料・生成件数。
 * @oracle 先行清掃で今回更新0、生成再試行0、出版後故障はconfirmed保持・未完了。
 * @cleanup 注入を復元し既存入口で材料回収後、FixtureがRoot不存在を確認する。
 * @boundary 公開管理API・Node Filesystem故障・既存Lock。
 */
test("通常管理は先行材料と今回出版・清掃不明を分離する", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const administrator = f.state.users[0];
  assert.ok(administrator);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000091";
  prepare(f, next);
  assert.deepEqual(
    updateUserName(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      administrator.userId,
      "更新",
    ),
    {
      status: "unavailable",
      reason: "management_operation_unavailable",
      primaryFailure: "state_store_previous_pending_settled",
      operationId,
      expectedRevision: 1,
      observedRevision: 1,
      publication: "not_attempted",
      cleanupConfirmed: true,
    },
  );
  assert.deepEqual(fs.readFileSync(currentPath), bytes(f.state));
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  const originalUUID = crypto.randomUUID;
  let generated = 0;
  crypto.randomUUID = () => {
    generated++;
    return administrator.userId as `${string}-${string}-${string}-${string}-${string}`;
  };
  try {
    const collision = registerUser(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      "衝突",
      "developer",
    );
    assert.equal(collision.status, "unavailable");
    if (
      collision.status === "unavailable" &&
      collision.reason === "management_operation_unavailable"
    ) {
      assert.equal(collision.publication, "not_attempted");
      assert.equal(collision.cleanupConfirmed, true);
    } else assert.fail("認可後生成故障が欠落した");
    assert.equal(generated, 1);
  } finally {
    crypto.randomUUID = originalUUID;
  }
  const originalRename = fs.renameSync;
  fs.renameSync = () => {
    throw new Error("injected");
  };
  try {
    const failed = updateUserName(
      f.root,
      f.tokens.manager,
      1,
      operationId,
      administrator.userId,
      "更新",
    );
    assert.equal(failed.status, "unavailable");
    if (
      failed.status === "unavailable" &&
      failed.reason === "management_operation_unavailable"
    ) {
      assert.equal(failed.publication, "unconfirmed");
      assert.equal(failed.primaryFailure, "state_store_publish_failed");
    } else assert.fail("出版故障が欠落した");
    assert.deepEqual(fs.readFileSync(currentPath), bytes(f.state));
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(readAccessManagementState(f.root).status, "completed");
  const originalRm = fs.rmSync;
  for (const suffix of [
    "access-management.pending.json",
    "access-management.lock",
  ]) {
    fs.writeFileSync(currentPath, bytes(f.state));
    fs.rmSync = (target, options) => {
      if (String(target).endsWith(suffix)) throw new Error("injected");
      return originalRm(target, options);
    };
    try {
      const failed = updateUserName(
        f.root,
        f.tokens.manager,
        1,
        operationId,
        administrator.userId,
        "保存済み",
      );
      assert.equal(failed.status, "unavailable");
      if (
        failed.status === "unavailable" &&
        failed.reason === "management_operation_unavailable"
      ) {
        assert.equal(failed.publication, "confirmed");
        assert.equal(failed.observedRevision, 2);
        assert.equal(failed.cleanupConfirmed, false);
        assert.equal("lockRecoveryId" in failed, false);
      } else assert.fail("既知出版が欠落した");
      assert.equal(
        (
          JSON.parse(
            fs.readFileSync(currentPath, "utf8"),
          ) as AccessManagementState
        ).users[0]?.username,
        "保存済み",
      );
    } finally {
      fs.rmSync = originalRm;
    }
    assert.equal(readAccessManagementState(f.root).status, "completed");
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 初回Userを一度保存し再要求で増殖しないことを確認する。
 * @responsibility 保存済みUserの再観測と名前更新を分離する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootに初回相関だけを保存する。
 * @stimulus 初回User保存後、同じ名前と別名で再要求する。
 * @observation UUID件数・完全byte・User・空Credentialを確認する。
 * @oracle UUIDは初回の2個だけ。再要求では保存名とIDを返す。
 * @cleanup 差替えを復元し自己生成Rootを削除する。
 * @boundary 初回User保存と実Filesystem。
 */
test("初回管理者を保存し同Userへ再入場する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attempt = "00000000-0000-4000-8000-000000000099";
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const random = crypto.randomUUID;
  let calls = 0;
  crypto.randomUUID = () => {
    calls++;
    return random();
  };
  t.after(() => {
    crypto.randomUUID = random;
  });
  const first = createInitialAdministrator(f.root, attempt, "管理者");
  assert.equal(first.status, "completed");
  if (first.status !== "completed") return;
  assert.equal(first.value.created, true);
  assert.equal(calls, 2);
  const saved = fs.readFileSync(current);
  for (const name of ["管理者", "別名"]) {
    const again = createInitialAdministrator(f.root, attempt, name);
    assert.equal(again.status, "completed");
    if (again.status !== "completed") continue;
    assert.deepEqual(again.value, { ...first.value, created: false });
    assert.deepEqual(fs.readFileSync(current), saved);
  }
  assert.equal(calls, 2);
  const state = JSON.parse(saved.toString());
  assert.equal(state.users.length, 1);
  assert.deepEqual(state.credentials, []);
  assert.equal(state.initialization.stage, "user_stored");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 初回Userの保存途中終了と出版後再入場を確認する。
 * @responsibility 過去の途中材料を再出版せず保存済みUserだけ再観測する。
 * @trace RFD-IT-024
 * @precondition 初回相関を持つ自己生成Rootと一回性子Process。
 * @stimulus pending確定・replace確定・rename直後で子Processを終了する。
 * @observation 子Process終了、current byte、再入場時UUID生成0と材料を確認する。
 * @oracle base材料は保持停止、next材料は清掃して同Userを返す。
 * @cleanup 子Process終了と自己生成Root削除を確認する。
 * @boundary Node Process・Filesystem・既存Lock。
 */
test("初回UserのProcess喪失はbase保持とnext再観測を区別する", (t) => {
  for (const phase of ["pending", "replace", "renamed"]) {
    const f = fixture(t);
    const current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    const attempt = "00000000-0000-4000-8000-000000000099";
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, () => [
        "uninitialized",
        "absent",
      ]).status,
      "completed",
    );
    const before = fs.readFileSync(current);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
    const child = spawnSync(
      process.execPath,
      [
        "--eval",
        `
      import fs from "node:fs";
      import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
      import { createInitialAdministrator } from ${JSON.stringify(storeUrl)};
      let flushes=0; const flush=fs.fsyncSync;
      fs.fsyncSync=fd=>{flush(fd); flushes++; if((${JSON.stringify(phase)}==="pending" && flushes===2)||(${JSON.stringify(phase)}==="replace" && flushes===3)) process.exit(23);};
      const rename=fs.renameSync;
      fs.renameSync=(a,b)=>{rename(a,b); if(${JSON.stringify(phase)}==="renamed") process.exit(23);};
      createInitialAdministrator(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)},"管理者");
    `,
      ],
      { timeout: 10_000, encoding: "utf8" },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    const saved = fs.readFileSync(current);
    const random = crypto.randomUUID;
    let calls = 0;
    crypto.randomUUID = () => {
      calls++;
      return random();
    };
    let result: ReturnType<typeof createInitialAdministrator>;
    try {
      result = createInitialAdministrator(f.root, attempt, "別名");
    } finally {
      crypto.randomUUID = random;
    }
    assert.deepEqual(fs.readFileSync(current), saved);
    assert.equal(calls, 0);
    if (phase === "renamed") {
      assert.equal(result.status, "completed");
      if (result.status === "completed") {
        assert.equal(result.value.created, false);
        assert.equal(result.value.username, "管理者");
      }
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    } else {
      assert.equal(result.status, "unavailable");
      assert.deepEqual(saved, before);
      assert.ok(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
      );
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.replace.json")),
        phase === "replace",
      );
      assert.equal(result.cleanupConfirmed, false);
    }
  }
});

/**
 * 初回入力とcanonical相関の拒否を確認する。
 * @responsibility Schema妥当だけの改変状態からUserを生成しない。
 * @trace RFD-IT-024
 * @precondition 初回相関を持つ自己生成Root。
 * @stimulus 不正primitive、別試行、Role・操作ID改変、途中材料を与える。
 * @observation UUID生成0とcurrent byte不変を確認する。
 * @oracle 不正・途中状態は未完了で保持し、getterを実行しない。
 * @cleanup 差替えを復元し自己生成Rootを削除する。
 * @boundary 入力・相関・Filesystem。
 */
test("初回管理者の不正入力と非canonical状態を生成前に拒否する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attempt = "00000000-0000-4000-8000-000000000099";
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const saved = fs.readFileSync(current);
  const random = crypto.randomUUID;
  let calls = 0;
  crypto.randomUUID = () => {
    calls++;
    return random();
  };
  t.after(() => {
    crypto.randomUUID = random;
  });
  let getterCalls = 0;
  const bad = {
    get toJSON() {
      getterCalls++;
      throw new Error("getter");
    },
  };
  for (const name of ["", " name", "x\n", bad]) {
    assert.equal(
      createInitialAdministrator(f.root, attempt, name as string).status,
      "unavailable",
    );
    assert.equal(calls, 0);
  }
  assert.equal(getterCalls, 0);
  assert.equal(
    createInitialAdministrator(
      f.root,
      "00000000-0000-4000-8000-000000000098",
      "管理者",
    ).status,
    "unavailable",
  );
  assert.equal(calls, 0);
  for (const mutation of ["operation", "role", "revision"]) {
    const state = JSON.parse(saved.toString());
    if (mutation === "operation")
      state.operationId = "00000000-0000-4000-8000-000000000098";
    if (mutation === "role") state.roleContentAccess[0].workspaceIds = [];
    if (mutation === "revision") state.revision = 2;
    fs.writeFileSync(current, bytes(state));
    const before = fs.readFileSync(current);
    const rejected = createInitialAdministrator(f.root, attempt, "管理者");
    assert.equal(rejected.status, "unavailable");
    assert.equal(rejected.publication, "not_attempted");
    assert.equal(rejected.revision, state.revision);
    assert.equal(rejected.cleanupConfirmed, true);
    assert.equal(calls, 0);
    assert.deepEqual(fs.readFileSync(current), before);
  }
  fs.writeFileSync(current, saved);
  for (const name of [
    "access-management.pending.json",
    "access-management.replace.json",
  ]) {
    fs.writeFileSync(path.join(f.directory, name), "{");
    const rejected = createInitialAdministrator(f.root, attempt, "管理者");
    assert.equal(rejected.status, "unavailable");
    assert.equal(rejected.cleanupConfirmed, false);
    assert.equal(calls, 0);
    assert.deepEqual(fs.readFileSync(current), saved);
    assert.equal(fs.readFileSync(path.join(f.directory, name), "utf8"), "{");
    fs.rmSync(path.join(f.directory, name));
  }
});

/**
 * 初回Userの二Process競合と出版後Lock故障を確認する。
 * @responsibility 単一Userと出版・解放の独立した事実を観測する。
 * @trace RFD-IT-024
 * @precondition canonical初回相関を持つ自己生成Root。
 * @stimulus 別名の二Processを開始し、別Rootでは出版後のLock削除を失敗させる。
 * @observation 全Processのjoin、created件数、保存User、回復参照と再入場UUID件数。
 * @oracle 新規生成は一件、再入場は同User。解放不明でも出版確定を保持する。
 * @cleanup 差替えを復元し全Process終了とRoot不存在を確認する。
 * @boundary Node Process・Filesystem・既存Lock。
 */
test("初回User競合は一生成だけ採用し出版後Lock不明を保持する", async (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  const attempt = "00000000-0000-4000-8000-000000000099";
  fs.rmSync(current);
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const domainUrl = new URL(
    "../../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
  const joined = await Promise.allSettled(
    ["管理者A", "管理者B"].map(
      (name) =>
        new Promise<{
          output: string;
          code: number | null;
          signal: string | null;
          stderrBytes: number;
        }>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--eval",
              `import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)}; import {createInitialAdministrator} from ${JSON.stringify(storeUrl)}; console.log(JSON.stringify(createInitialAdministrator(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)},${JSON.stringify(name)})));`,
            ],
            { timeout: 10000 },
          );
          let output = "";
          let stderrBytes = 0;
          child.stdout.on("data", (data) => {
            output += String(data);
          });
          child.stderr.on("data", (data: Buffer) => {
            stderrBytes += data.byteLength;
          });
          child.on("error", reject);
          child.on("close", (code, signal) => {
            resolve({ output, code, signal, stderrBytes });
          });
        }),
    ),
  );
  const results = joined.map((result) => {
    assert.equal(result.status, "fulfilled");
    if (result.status !== "fulfilled") throw new Error("child_failed");
    assert.equal(
      result.value.code,
      0,
      JSON.stringify({
        code: result.value.code,
        signal: result.value.signal,
        stderrBytes: result.value.stderrBytes,
      }),
    );
    return JSON.parse(result.value.output);
  });
  assert.equal(
    results.filter(
      (result) => result.status === "completed" && result.value.created,
    ).length,
    1,
    JSON.stringify(
      results.map((result, index) => {
        const child = joined[index];
        return {
          status: result.status,
          reason: result.reason,
          publication: result.publication,
          cleanupConfirmed: result.cleanupConfirmed,
          revision: result.revision,
          created: result.value?.created,
          child:
            child?.status === "fulfilled"
              ? {
                  code: child.value.code,
                  signal: child.value.signal,
                  stderrBytes: child.value.stderrBytes,
                }
              : { status: "unjoined" },
        };
      }),
    ),
  );
  const saved = JSON.parse(fs.readFileSync(current, "utf8"));
  assert.equal(saved.users.length, 1);
  for (const result of results) {
    if (result.status === "completed") {
      assert.equal(result.value.userId, saved.users[0].userId);
      assert.equal(result.value.username, saved.users[0].username);
    } else {
      assert.equal(result.publication, "not_attempted");
      const reentered = createInitialAdministrator(f.root, attempt, "再要求名");
      assert.equal(reentered.status, "completed");
      if (reentered.status === "completed") {
        assert.equal(reentered.value.created, false);
        assert.equal(reentered.value.userId, saved.users[0].userId);
        assert.equal(reentered.value.username, saved.users[0].username);
      }
    }
  }
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  const g = fixture(t);
  fs.rmSync(path.join(g.directory, "access-management.json"));
  assert.equal(
    initializeAccessManagementState(g.root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  const remove = fs.rmSync;
  let failed: ReturnType<typeof createInitialAdministrator>;
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  try {
    failed = createInitialAdministrator(g.root, attempt, "管理者");
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "confirmed");
  assert.equal(failed.revision, 2);
  assert.equal(failed.cleanupConfirmed, false);
  if (failed.status === "unavailable") assert.ok(failed.lockRecoveryId);
  const random = crypto.randomUUID;
  let calls = 0;
  crypto.randomUUID = () => {
    calls++;
    return random();
  };
  let again: ReturnType<typeof createInitialAdministrator>;
  try {
    again = createInitialAdministrator(g.root, attempt, "別名");
  } finally {
    crypto.randomUUID = random;
  }
  assert.equal(calls, 0);
  assert.equal(again.status, "completed");
  if (again.status === "completed") assert.equal(again.value.created, false);
  assert.deepEqual(fs.readdirSync(g.directory), ["access-management.json"]);
});

/**
 * 初回相関の新規保存と同元試行の再読取りを確認する。
 * @responsibility 相関保存をUser・鍵の生成完了と区別する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootにcurrentが存在しない。
 * @stimulus 明示開始で一度保存し同元試行・別元試行を再要求する。
 * @observation callback件数、結果、current完全内容とbyteを確認する。
 * @oracle revision1・固定Role・空集合。同元試行は再作成0、別試行は拒否。
 * @cleanup 自己生成Rootを削除し不存在確認。
 * @boundary Node FilesystemとAM初回相関保存。
 */
test("初回相関を排他作成しexact再入場する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  let called = 0;
  const observe = () => {
    called++;
    return ["uninitialized", "absent"] as const;
  };
  const attempt = "00000000-0000-4000-8000-000000000020";
  const result = initializeAccessManagementState(
    f.root,
    attempt,
    true,
    observe,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  assert.equal(result.value.created, true);
  assert.equal(called, 1);
  const before = fs.readFileSync(current);
  const state = readAccessManagementState(f.root);
  assert.equal(state.status, "completed");
  if (state.status !== "completed") return;
  assert.deepEqual(state.value.initialization, {
    stage: "correlated",
    attemptId: attempt,
  });
  assert.deepEqual(state.value.roleContentAccess, f.state.roleContentAccess);
  for (const field of [
    "users",
    "credentials",
    "registeredRepositories",
    "exposure",
    "unresolvedKeyExchanges",
  ] as const)
    assert.deepEqual(state.value[field], []);
  const reentry = initializeAccessManagementState(
    f.root,
    attempt,
    true,
    observe,
  );
  assert.equal(reentry.status, "completed");
  if (reentry.status === "completed")
    assert.equal(reentry.value.created, false);
  assert.equal(called, 1);
  assert.equal(
    initializeAccessManagementState(f.root, f.state.operationId, true, observe)
      .status,
    "unavailable",
  );
  assert.ok(fs.readFileSync(current).equals(before));
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 初回開始の拒否母集団を直接保存境界へ接続する。
 * @responsibility 明示開始・旧観測・残存材料を新作成へ丸めない。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootと非秘密の旧観測分類。
 * @stimulus false・不正ID・既存／途中／不明／不正／throw・残存Pathを与える。
 * @observation current不存在、callback件数、既存byteを確認する。
 * @oracle 新作成0、残存不変、callbackはLock内一回以下。
 * @cleanup 自己生成Rootを削除し不存在確認。
 * @boundary Node Filesystemと初回開始条件。
 */
test("初回拒否で新作成せず不明材料を保持する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  fs.rmSync(current);
  const attempt = f.state.operationId;
  let called = 0;
  const observe = () => {
    called++;
    return ["uninitialized", "absent"] as const;
  };
  assert.equal(
    initializeAccessManagementState(f.root, attempt, false, observe).status,
    "unavailable",
  );
  assert.equal(
    initializeAccessManagementState(f.root, "invalid", true, observe).status,
    "unavailable",
  );
  assert.equal(called, 0);
  let inputExecuted = 0;
  const invalidInput = {
    get toJSON() {
      inputExecuted++;
      return () => {
        inputExecuted++;
        return attempt;
      };
    },
  };
  assert.equal(
    initializeAccessManagementState(
      f.root,
      invalidInput as unknown as string,
      true,
      observe,
    ).status,
    "unavailable",
  );
  assert.equal(
    initializeAccessManagementState(
      f.root,
      attempt,
      true,
      undefined as unknown as typeof observe,
    ).status,
    "unavailable",
  );
  assert.equal(inputExecuted, 0);
  assert.equal(called, 0);
  assert.deepEqual(fs.readdirSync(f.directory), []);
  for (const observation of [
    ["existing", "absent"],
    ["same_attempt", "confirmed"],
    ["unknown", "unknown"],
    [],
  ]) {
    let count = 0;
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, () => {
        count++;
        return observation as [unknown, unknown];
      }).status,
      "unavailable",
    );
    assert.equal(count, 1);
    assert.equal(fs.existsSync(current), false);
  }
  assert.equal(
    initializeAccessManagementState(f.root, attempt, true, () => {
      throw new Error("injected");
    }).status,
    "unavailable",
  );
  for (const name of [
    "access-management.json",
    "access-management.pending.json",
    "access-management.replace.json",
  ]) {
    const target = path.join(f.directory, name);
    fs.writeFileSync(target, "{");
    assert.equal(
      initializeAccessManagementState(f.root, attempt, true, observe).status,
      "unavailable",
    );
    assert.equal(fs.readFileSync(target, "utf8"), "{");
    assert.equal(called, 0);
    fs.rmSync(target);
  }
  assert.deepEqual(fs.readdirSync(f.directory), []);
});

/**
 * 初回書込み途中・close後の実Process喪失を確認する。
 * @responsibility partial保持停止と完全相関再観測を分離する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootと一回性Node子Process。
 * @stimulus current一部write後とclose後readback前にProcess終了する。
 * @observation 終了join、残存current、同元試行再入場、callback件数。
 * @oracle partialは不変で拒否、完全baselineは作成なしで読戻し成功。
 * @cleanup 子Process終了と自己生成Root削除を確認する。
 * @boundary 実Node Process・Filesystem・既存Lock。
 */
test("初回Process喪失のpartialと完全相関を再観測する", (t) => {
  for (const phase of ["partial", "closed"]) {
    const f = fixture(t);
    const current = path.join(f.directory, "access-management.json");
    fs.rmSync(current);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
    const script = `
      import fs from "node:fs";
      import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
      import { initializeAccessManagementState } from ${JSON.stringify(storeUrl)};
      let target;
      const open = fs.openSync, write = fs.writeSync, close = fs.closeSync;
      fs.openSync = (p,...args) => { const fd = open(p,...args); if (String(p).endsWith("access-management.json")) target=fd; return fd; };
      fs.writeSync = (fd,...args) => { if(fd===target && ${JSON.stringify(phase)}==="partial") { write(fd, Buffer.from("{")); process.exit(23); } return write(fd,...args); };
      fs.closeSync = fd => { close(fd); if(fd===target && ${JSON.stringify(phase)}==="closed") process.exit(23); };
      initializeAccessManagementState(createFilesystemStoreRoot(${JSON.stringify(f.directory)}), ${JSON.stringify(f.state.operationId)}, true, () => ["uninitialized","absent"]);
    `;
    const child = spawnSync(process.execPath, ["--eval", script], {
      timeout: 10000,
      encoding: "utf8",
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    const before = fs.readFileSync(current);
    let count = 0;
    const result = initializeAccessManagementState(
      f.root,
      f.state.operationId,
      true,
      () => {
        count++;
        return ["uninitialized", "absent"];
      },
    );
    assert.equal(
      result.status,
      phase === "partial" ? "unavailable" : "completed",
    );
    if (result.status === "completed")
      assert.equal(result.value.created, false);
    assert.equal(count, 0);
    assert.ok(fs.readFileSync(current).equals(before));
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 二Process初回競合と解放不明を確認する。
 * @responsibility 採用一件と既知出版・清掃未確認を別に観測する。
 * @trace RFD-IT-024
 * @precondition 自己生成Rootにcurrentがない。
 * @stimulus 別元試行の二子Processを開始し、別fixtureでLock削除失敗を注入する。
 * @observation 子Processjoin、採用件数、改訂、回復参照。
 * @oracle 採用一件、Lock清掃失敗時unavailableかつconfirmed出版を保持。
 * @cleanup 差替え復元・子Process終了・自己生成Root削除。
 * @boundary Node Process競合と既存Lock。
 */
test("初回競合は一件だけ採用し解放不明を保持する", async (t) => {
  const f = fixture(t);
  fs.rmSync(path.join(f.directory, "access-management.json"));
  const domainUrl = new URL(
    "../../../../domain-model/src/index.ts",
    import.meta.url,
  ).href;
  const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
  const results = await Promise.all(
    [f.state.operationId, "00000000-0000-4000-8000-000000000025"].map(
      (attempt) =>
        new Promise<string>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--eval",
              `import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)}; import {initializeAccessManagementState} from ${JSON.stringify(storeUrl)}; const r=initializeAccessManagementState(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)},true,()=>["uninitialized","absent"]); console.log(r.status);`,
            ],
            { timeout: 10000 },
          );
          let output = "";
          child.stdout.on("data", (data) => {
            output += String(data);
          });
          child.on("error", reject);
          child.on("close", (code) => {
            if (code !== 0) reject(new Error("child_failed"));
            else resolve(output.trim());
          });
        }),
    ),
  );
  assert.equal(results.filter((status) => status === "completed").length, 1);
  assert.equal(readAccessManagementState(f.root).status, "completed");
  const g = fixture(t);
  fs.rmSync(path.join(g.directory, "access-management.json"));
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  const failed = initializeAccessManagementState(
    g.root,
    g.state.operationId,
    true,
    () => ["uninitialized", "absent"],
  );
  fs.rmSync = remove;
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "confirmed");
  assert.equal(failed.cleanupConfirmed, false);
  if (failed.status === "unavailable") assert.ok(failed.lockRecoveryId);
  assert.equal(readAccessManagementState(g.root).status, "completed");
});

/**
 * 途中出版の独立Fixtureを生成する。
 * @responsibility 基準Hash・次Hash・改訂・操作IDを模擬保存材料へ保持する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus pendingと任意のreplaceを作る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle nextSnapshotはobjectであり二重encodeしない。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
function prepare(
  f: ReturnType<typeof fixture>,
  next: AccessManagementState,
  kind = "management",
  replace = true,
): void {
  const digest = (value: Buffer) =>
    createHash("sha256").update(value).digest("hex");
  fs.writeFileSync(
    path.join(f.directory, "access-management.pending.json"),
    bytes({
      contract: "crdd-access-management/pending",
      schemaRevision: 1,
      kind,
      baseRevision: f.state.revision,
      baseSha256: digest(bytes(f.state)),
      nextRevision: next.revision,
      nextSha256: digest(bytes(next)),
      operationId: next.operationId,
      nextSnapshot: next,
    }),
  );
  if (replace)
    fs.writeFileSync(
      path.join(f.directory, "access-management.replace.json"),
      bytes(next),
    );
}

/**
 * 通常更新と改訂競合を確認する。
 * @responsibility 現在値とcallback、出版、清掃を実境界で照合する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 名前変更を保存し、旧期待改訂で再要求する。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 一回だけ出版・読戻しし、競合時callback0・短命材料0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("通常保存・読戻し・改訂競合", (t) => {
  const f = fixture(t);
  const result = updateAccessManagementState(f.root, 1, (current) => {
    assert.equal(current.users[0]?.username, "模擬管理者");
    current.revision++;
    current.operationId = "00000000-0000-4000-8000-000000000004";
    const user = current.users[0];
    assert.ok(user);
    user.username = "更新後";
    return bytes(current);
  });
  assert.equal(result.status, "completed");
  assert.equal(result.publication, "confirmed");
  const read = readAccessManagementState(f.root);
  assert.equal(read.status, "completed");
  if (read.status !== "completed") return;
  assert.equal(read.value.users[0]?.username, "更新後");
  let called = 0;
  const conflict = updateAccessManagementState(f.root, 1, () => {
    called++;
    return Buffer.alloc(0);
  });
  assert.equal(conflict.status, "unavailable");
  assert.equal(called, 0);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 不正候補と対象外の鍵変更を拒否する。
 * @responsibility 検査前の準備File作成を防ぐ。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus 巨大bytes、改訂再利用、初回事実・資格・未解決交換・既存User IDの変更を返す。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle current不変・pending/replace不存在。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("不正候補・容量超過・対象外変更は出版しない", (t) => {
  const f = fixture(t);
  f.state.users.push({
    userId: "00000000-0000-4000-8000-000000000009",
    username: "模擬開発者",
    role: "developer",
  });
  const administrator = f.state.users[0];
  assert.ok(administrator);
  f.state.credentials.push({
    credentialId: "0123456789abcdef01234567",
    userId: administrator.userId,
    tokenVersion: 1,
    tokenSalt: "a".repeat(32),
    tokenVerifier: "b".repeat(64),
    revoked: false,
    operationId: f.state.initialization.attemptId,
    presentation: "confirmed",
  });
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const before = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
  );
  const bad = structuredClone(f.state);
  bad.revision = 2;
  bad.operationId = "00000000-0000-4000-8000-000000000005";
  bad.initialization = {
    stage: "correlated",
    attemptId: bad.initialization.attemptId,
  };
  const credential = structuredClone(f.state);
  credential.revision = 2;
  credential.operationId = bad.operationId;
  const changedCredential = credential.credentials[0];
  const originalCredential = f.state.credentials[0];
  assert.ok(changedCredential && originalCredential);
  changedCredential.tokenVerifier = "c".repeat(64);
  const exchange = structuredClone(credential);
  exchange.credentials = structuredClone(f.state.credentials);
  exchange.unresolvedKeyExchanges = [
    {
      stage: "prepared",
      recoveryId: `access-management.key-exchange.${bad.operationId}`,
      operationId: bad.operationId,
      entry: "host",
      scope: "targeted",
      recipientUserId: administrator.userId,
      oldCredentialIds: [originalCredential.credentialId],
    },
  ];
  const removedUser = structuredClone(credential);
  removedUser.credentials = structuredClone(f.state.credentials);
  removedUser.users.pop();
  for (const protectedChange of [credential, exchange, removedUser]) {
    assert.equal(
      parseAccessManagementState(bytes(protectedChange)).status,
      "parsed",
    );
  }
  for (const candidate of [
    Buffer.alloc(16_777_217),
    bytes(f.state),
    bytes(bad),
    bytes(credential),
    bytes(exchange),
    bytes(removedUser),
  ]) {
    assert.equal(
      updateAccessManagementState(f.root, 1, () => candidate).status,
      "unavailable",
    );
    assert.ok(
      fs
        .readFileSync(path.join(f.directory, "access-management.json"))
        .equals(before),
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 未出版材料の再入場を確認する。
 * @responsibility 通常更新だけを破棄し、新更新を同時に実行しない。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus base一致pendingとreplaceから更新入口へ入る。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 旧材料だけ回収・current不変・新callback0・元結果不明。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("base一致は通常材料だけ整理して新更新しない", (t) => {
  const f = fixture(t);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000006";
  prepare(f, next);
  let called = 0;
  const result = updateAccessManagementState(f.root, 1, () => {
    called++;
    return bytes(next);
  });
  assert.equal(result.status, "unavailable");
  assert.equal(called, 0);
  assert.equal(result.publication, "not_attempted");
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(f.state)),
  );
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  prepare(f, next, "credential", false);
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  assert.ok(
    fs.existsSync(path.join(f.directory, "access-management.pending.json")),
  );
});

/**
 * 出版済み材料の再入場を確認する。
 * @responsibility 保存済み事実と清掃を別に確認する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus current=nextでpendingを残し読み直す。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle confirmed出版を保持・短命材料だけ回収・改訂再出版0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("next一致は既知出版を保持して清掃する", (t) => {
  const f = fixture(t);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000007";
  prepare(f, next, "credential", false);
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(next),
  );
  const result = readAccessManagementState(f.root);
  assert.equal(result.status, "completed");
  assert.equal(result.publication, "confirmed");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(next)),
  );
});

/**
 * 破損・孤立材料・current欠測を停止する。
 * @responsibility 名前だけの清掃と未初期化推定を拒否する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus partial pending、partial replace、孤立replace、破損currentを順に用意する。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 不明材料は保持し、修復・出版・追加作成0。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("partial・孤立replace・current欠測を保持停止", (t) => {
  const f = fixture(t);
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000008";
  const pending = path.join(f.directory, "access-management.pending.json");
  fs.writeFileSync(pending, "{");
  let called = 0;
  const partial = updateAccessManagementState(f.root, 1, () => {
    called++;
    return bytes(next);
  });
  assert.equal(partial.status, "unavailable");
  assert.equal(partial.publication, "not_attempted");
  assert.equal(called, 0);
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(f.state)),
  );
  assert.deepEqual(fs.readdirSync(f.directory).sort(), [
    "access-management.json",
    "access-management.pending.json",
  ]);
  fs.rmSync(pending);
  prepare(f, next);
  const replacement = path.join(f.directory, "access-management.replace.json");
  fs.writeFileSync(replacement, "{");
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  assert.equal(fs.readFileSync(replacement, "utf8"), "{");
  fs.rmSync(path.join(f.directory, "access-management.pending.json"));
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  fs.rmSync(path.join(f.directory, "access-management.json"));
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  assert.ok(fs.existsSync(replacement));
});

/**
 * 出版要求失敗と後続清掃失敗を区別する。
 * @responsibility 失敗後のcurrentと既知出版を直接観測する。
 * @trace RFD-IT-021
 * @precondition 実Hostとは分離した自己生成試験領域と非秘密fixtureを使用する。
 * @stimulus rename失敗、出版後pending削除失敗を注入する。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle 前者current不変、後者confirmed出版保持・未完了。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("rename失敗と出版後清掃失敗の事実を保持", (t) => {
  const f = fixture(t);
  const originalRename = fs.renameSync;
  const originalRemove = fs.rmSync;
  t.after(() => {
    fs.renameSync = originalRename;
    fs.rmSync = originalRemove;
  });
  const next = structuredClone(f.state);
  next.revision = 2;
  next.operationId = "00000000-0000-4000-8000-000000000009";
  fs.renameSync = () => {
    throw new Error("injected");
  };
  const failed = updateAccessManagementState(f.root, 1, () => bytes(next));
  assert.equal(failed.status, "unavailable");
  assert.equal(failed.publication, "unconfirmed");
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(f.state)),
  );
  fs.renameSync = originalRename;
  assert.equal(readAccessManagementState(f.root).status, "completed");
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return originalRemove(target, options);
  };
  const cleanup = updateAccessManagementState(f.root, 1, () => bytes(next));
  assert.equal(cleanup.status, "unavailable");
  assert.equal(cleanup.publication, "confirmed");
  assert.equal(cleanup.revision, 2);
  assert.ok(
    fs
      .readFileSync(path.join(f.directory, "access-management.json"))
      .equals(bytes(next)),
  );
  fs.rmSync = originalRemove;
  assert.equal(readAccessManagementState(f.root).status, "completed");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 保存途中の子Process喪失から新Processで再入場する。
 * @responsibility 実Process終了・残存Lockのexact回収・base/nextの処置を接続する。
 * @trace RFD-IT-021
 * @precondition Repository-localな模擬状態と実子Processだけを使用する。
 * @stimulus pending flush後、replace flush後、rename後でexit(23)する。
 * @observation 終了code、残存材料、次読取りの改訂と清掃を確認する。
 * @oracle 前二者は改訂1のまま、後者は改訂2を保持。自動再出版0、子Processはjoin済み。
 * @cleanup 自己生成Rootと所有材料を削除し不存在を確認する。
 * @boundary Node子Process・Filesystem・既存Lockの直接保存境界。
 */
test("実子Process喪失後にbase/nextとLockを再観測する", (t) => {
  for (const phase of ["pending", "replace", "renamed"]) {
    const f = fixture(t);
    const domainUrl = new URL(
      "../../../../domain-model/src/index.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL("../../../src/index.ts", import.meta.url).href;
    const script = `
      import fs from "node:fs";
      import { createFilesystemStoreRoot } from ${JSON.stringify(domainUrl)};
      import { updateAccessManagementState } from ${JSON.stringify(storeUrl)};
      let flushes = 0;
      const flush = fs.fsyncSync;
      fs.fsyncSync = fd => {
        flush(fd); flushes++;
        if ((${JSON.stringify(phase)} === "pending" && flushes === 2) ||
            (${JSON.stringify(phase)} === "replace" && flushes === 3)) process.exit(23);
      };
      const rename = fs.renameSync;
      fs.renameSync = (a,b) => { rename(a,b); if (${JSON.stringify(phase)} === "renamed") process.exit(23); };
      const root = createFilesystemStoreRoot(${JSON.stringify(f.directory)});
      updateAccessManagementState(root, 1, current => {
        current.revision = 2;
        current.operationId = "00000000-0000-4000-8000-000000000010";
        return Buffer.from(JSON.stringify(current));
      });
    `;
    const child = spawnSync(process.execPath, ["--eval", script], {
      timeout: 10_000,
      encoding: "utf8",
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    const result = readAccessManagementState(f.root);
    assert.equal(result.status, "completed");
    if (result.status !== "completed") continue;
    assert.equal(result.value.revision, phase === "renamed" ? 2 : 1);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 主失敗と後続のLock解放不明を分ける。
 * @responsibility 候補拒否をcleanup結果で上書きせずexact回収参照を保持する。
 * @trace RFD-IT-021
 * @precondition 自己生成Rootと不正候補を使用する。
 * @stimulus 候補拒否後のLock削除を失敗させ、復元後同じRootを読み直す。
 * @observation primary reason、secondary reason、回復参照、現状態を確認する。
 * @oracle 候補不正を保持・出版0・解放未確認。復元後既存exact回収で正常読取りできる。
 * @cleanup 差替えを復元し自己生成Rootを削除する。
 * @boundary AM保存結果と既存Lock回収の直接境界。
 */
test("主失敗をLock清掃失敗で上書きしない", (t) => {
  const f = fixture(t);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  const result = updateAccessManagementState(f.root, 1, () =>
    Buffer.from("{}"),
  );
  fs.rmSync = remove;
  assert.equal(result.status, "unavailable");
  if (result.status !== "unavailable") return;
  assert.equal(result.reason, "state_store_candidate_invalid");
  assert.equal(result.publication, "not_attempted");
  assert.equal(result.cleanupConfirmed, false);
  assert.ok(result.lockRecoveryId?.startsWith("filesystem-store-lock."));
  assert.equal(
    result.secondaryReason,
    "filesystem_store_lock_operation_completed_cleanup_unknown",
  );
  assert.equal(readAccessManagementState(f.root).status, "completed");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 通常発行と独立失効を実保存へ接続する。
 * @responsibility 一資格追加とexact一資格失効、元発行保持を別に観測する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成Rootと試験専用の管理者資格。
 * @stimulus 発行、同発行再要求、失効、同失効再要求と次要求認証。
 * @observation 保存改訂・対象／他資格・提示状態・短命Secret有無。
 * @oracle 旧資格保持、新規だけ発行。既失効再出版0・元要求completed推定0。
 * @cleanup Fixtureが自己生成Rootを回収し不存在確認。
 * @boundary Package公開APIと実Filesystem。Workbench出力ではない。
 */
test("通常鍵発行と独立失効はexact対象と再要求の限界を保持する", (t) => {
  const f = fixture(t);
  const current = path.join(f.directory, "access-management.json");
  const actor = createCredentialMaterial();
  const userId = f.state.users[0]?.userId;
  assert.ok(userId);
  f.state.credentials.push({
    credentialId: actor.credentialId,
    userId,
    tokenVersion: 1,
    tokenSalt: actor.tokenSalt,
    tokenVerifier: actor.tokenVerifier,
    revoked: false,
    operationId: "00000000-0000-4000-8000-000000000007",
    presentation: "confirmed",
  });
  fs.writeFileSync(current, bytes(f.state));
  const issued = issueCredential(
    f.root,
    actor.token,
    1,
    "00000000-0000-4000-8000-000000000008",
    userId,
  );
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  assert.equal(typeof issued.token, "string");
  assert.equal(issued.operation, "issueCredential");
  if (issued.operation !== "issueCredential") return;
  const saved = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  assert.equal(saved.revision, 2);
  assert.equal(saved.credentials.length, 2);
  assert.deepEqual(saved.credentials[0], f.state.credentials[0]);
  const added = saved.credentials[1];
  assert.ok(added);
  assert.equal(added.operationId, issued.operationId);
  assert.equal(added.presentation, "not_attempted");
  assert.equal(added.revoked, false);
  assert.equal(Object.hasOwn(added, "token"), false);
  assert.equal(verifyCredentialToken(issued.token, added), true);
  assert.deepEqual(
    issueCredential(f.root, actor.token, 2, issued.operationId, userId),
    {
      status: "unavailable",
      reason: "credential_management_rejected",
    },
  );
  const revoked = revokeCredential(
    f.root,
    actor.token,
    2,
    "00000000-0000-4000-8000-000000000009",
    userId,
    issued.credentialId,
  );
  assert.equal(revoked.status, "completed");
  assert.equal(Object.hasOwn(revoked, "token"), false);
  const after = JSON.parse(
    fs.readFileSync(current, "utf8"),
  ) as AccessManagementState;
  assert.equal(after.revision, 3);
  assert.deepEqual(after.credentials[0], f.state.credentials[0]);
  assert.deepEqual(after.credentials[1], { ...added, revoked: true });
  assert.equal(
    authenticateNormalConnection(f.root, issued.token).status,
    "unavailable",
  );
  const unchanged = fs.readFileSync(current);
  for (const operationId of [
    "00000000-0000-4000-8000-000000000009",
    "00000000-0000-4000-8000-000000000010",
  ])
    assert.deepEqual(
      revokeCredential(
        f.root,
        actor.token,
        3,
        operationId,
        userId,
        issued.credentialId,
      ),
      {
        status: "unavailable",
        reason: "credential_management_rejected",
      },
    );
  assert.deepEqual(fs.readFileSync(current), unchanged);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 非管理者と対象不一致の鍵変更をEffect前に拒否する。
 * @responsibility 拒否で資格生成・失効・保存が行われないことを観測する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 三Roleの試験専用資格と自己生成Root。
 * @stimulus 非管理者、未知User、改訂差、User／資格結合差を渡す。
 * @observation randomBytes回数、state byteと固定非開示結果。
 * @oracle 生成乱数0・新資格0・新失効0・state不変。
 * @cleanup 乱数差替えをfinally復元しFixtureがRootを回収する。
 * @boundary 同Lock現在認可とexact対象。
 */
test("通常鍵変更の非管理者・対象差・改訂差は生成と保存0", (t) => {
  for (const role of ["developer", "manager", "administrator"] as const) {
    const f = fixture(t);
    const actor = createCredentialMaterial();
    const user = f.state.users[0];
    assert.ok(user);
    user.role = role;
    f.state.credentials.push({
      credentialId: actor.credentialId,
      userId: user.userId,
      tokenVersion: 1,
      tokenSalt: actor.tokenSalt,
      tokenVerifier: actor.tokenVerifier,
      revoked: false,
      operationId: "00000000-0000-4000-8000-000000000007",
      presentation: "confirmed",
    });
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    let calls = 0;
    crypto.randomBytes = (() => {
      calls++;
      throw new Error("unexpected_generation");
    }) as typeof crypto.randomBytes;
    try {
      const target =
        role === "administrator"
          ? "00000000-0000-4000-8000-000000000999"
          : user.userId;
      assert.equal(
        issueCredential(
          f.root,
          actor.token,
          1,
          "00000000-0000-4000-8000-000000000008",
          target,
        ).status,
        "unavailable",
      );
      assert.equal(
        revokeCredential(
          f.root,
          actor.token,
          1,
          "00000000-0000-4000-8000-000000000009",
          target,
          actor.credentialId,
        ).status,
        "unavailable",
      );
      assert.equal(
        issueCredential(
          f.root,
          actor.token,
          2,
          "00000000-0000-4000-8000-000000000010",
          user.userId,
        ).status,
        "unavailable",
      );
      assert.equal(calls, 0);
    } finally {
      crypto.randomBytes = random;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 発行の保存故障で短命鍵を返さない。
 * @responsibility 保存済み事実と未確認出版・清掃不明を分離する。
 * @trace RFD-IT-017
 * @precondition 実Hostと分離した管理前状態。
 * @stimulus current rename・読戻し・pending削除・Lock削除を故障させる。
 * @observation 結果Secret不存在・出版観測・実current・再要求生成件数。
 * @oracle 故障結果token0、nextが保存済みなら保持、同元発行再生成0。
 * @cleanup 差替えをfinally復元してFixtureがRootを回収する。
 * @boundary Node Filesystemの実保存と故障後の公開内部結果。
 */
test("通常鍵発行の保存・読戻し・清掃故障はSecretを返さない", (t) => {
  for (const mode of ["rename", "read_back", "cleanup", "lock"] as const) {
    const f = managementFixture(t);
    const current = path.join(f.directory, "access-management.json");
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const operationId = "00000000-0000-4000-8000-000000000090";
    const rename = fs.renameSync;
    const open = fs.openSync;
    const remove = fs.rmSync;
    let published = false;
    fs.renameSync = (source, destination) => {
      if (String(destination) === current && mode === "rename")
        throw new Error("injected_rename");
      rename(source, destination);
      if (String(destination) === current) published = true;
    };
    fs.openSync = (file, flags, permissions) => {
      if (mode === "read_back" && published && String(file) === current)
        throw Object.assign(new Error("injected_read_back"), {
          code: "EACCES",
        });
      return open(file, flags, permissions);
    };
    fs.rmSync = (target, options) => {
      if (
        (mode === "cleanup" &&
          String(target) ===
            path.join(f.directory, "access-management.pending.json")) ||
        (mode === "lock" &&
          String(target) === path.join(f.directory, "access-management.lock"))
      )
        throw new Error("injected_cleanup");
      return remove(target, options);
    };
    let result: ReturnType<typeof issueCredential>;
    try {
      result = issueCredential(
        f.root,
        f.tokens.administrator,
        1,
        operationId,
        userId,
      );
    } finally {
      fs.renameSync = rename;
      fs.openSync = open;
      fs.rmSync = remove;
    }
    assert.equal(result.status, "unavailable");
    assert.equal(Object.hasOwn(result, "token"), false);
    if (
      result.status === "unavailable" &&
      result.reason === "credential_management_unavailable"
    ) {
      assert.equal(
        result.publication,
        mode === "rename" || mode === "read_back" ? "unconfirmed" : "confirmed",
      );
      assert.equal(result.cleanupConfirmed, false);
    } else assert.fail("故障の保存観測が欠落した");
    const observed = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    assert.equal(observed.revision, mode === "rename" ? 1 : 2);
    assert.deepEqual(observed.credentials.slice(0, 3), f.state.credentials);
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    let generated = 0;
    crypto.randomBytes = (() => {
      generated++;
      throw new Error("unexpected_regeneration");
    }) as typeof crypto.randomBytes;
    try {
      const retried = issueCredential(
        f.root,
        f.tokens.administrator,
        observed.revision,
        operationId,
        userId,
      );
      assert.equal(retried.status, "unavailable");
      assert.equal(Object.hasOwn(retried, "token"), false);
      assert.equal(generated, 0);
    } finally {
      crypto.randomBytes = random;
    }
    assert.deepEqual(fs.readFileSync(current), before);
  }
});

/**
 * 未解決交換と先行材料がある通常鍵変更を止める。
 * @responsibility 未解決の固定資格集合を別操作から変えない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 管理資格と保存済みprepared交換、または不正pending。
 * @stimulus 同対象への通常発行・独立失効。
 * @observation current byte、生成乱数件数、交換／pendingの保持。
 * @oracle 新発行・新失効・再出版0。元材料を清掃成功にしない。
 * @cleanup 乱数差替え復元とFixture回収。
 * @boundary 既存交換の保全と通常保存Gate。
 */
test("通常鍵変更は未解決交換と先行材料を保持する", (t) => {
  for (const mode of ["exchange", "pending"] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    const credentialId = f.state.credentials[0]?.credentialId;
    assert.ok(userId && credentialId);
    if (mode === "exchange") {
      const operationId = "00000000-0000-4000-8000-000000000091";
      f.state.unresolvedKeyExchanges.push({
        recoveryId: `access-management.key-exchange.${operationId}`,
        operationId,
        entry: "workbench",
        scope: "all",
        recipientUserId: userId,
        oldCredentialIds: f.state.credentials.map((item) => item.credentialId),
        stage: "prepared",
      });
      assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
    } else
      fs.writeFileSync(
        path.join(f.directory, "access-management.pending.json"),
        "{",
      );
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    let generated = 0;
    crypto.randomBytes = (() => {
      generated++;
      throw new Error("unexpected_generation");
    }) as typeof crypto.randomBytes;
    try {
      assert.equal(
        issueCredential(
          f.root,
          f.tokens.administrator,
          1,
          "00000000-0000-4000-8000-000000000092",
          userId,
        ).status,
        "unavailable",
      );
      assert.equal(
        revokeCredential(
          f.root,
          f.tokens.administrator,
          1,
          "00000000-0000-4000-8000-000000000093",
          userId,
          credentialId,
        ).status,
        "unavailable",
      );
      assert.equal(generated, 0);
    } finally {
      crypto.randomBytes = random;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    if (mode === "pending")
      assert.equal(
        fs.readFileSync(
          path.join(f.directory, "access-management.pending.json"),
          "utf8",
        ),
        "{",
      );
  }
});

/**
 * 管理者自身の最後の資格も指定どおり失効する。
 * @responsibility 未採用の最後の管理資格保持guardを追加しない。
 * @trace RFD-IT-018
 * @precondition 管理者の有効資格が一つだけの模擬状態。
 * @stimulus 自身の資格失効と同鍵の次要求認証、遅延提示通知。
 * @observation 失効出版、生成0、次認証拒否、提示更新0。
 * @oracle 指定失効を完了し、再有効化・新発行・追加改訂0。
 * @cleanup Fixture回収と差替え復元。
 * @boundary 独立失効と次要求・提示通知のfresh照合。
 */
test("通常鍵失効は最後の管理資格も失効し遅延提示で復活しない", (t) => {
  const f = managementFixture(t);
  const target = f.state.credentials[0];
  assert.ok(target);
  target.presentation = "unconfirmed";
  const current = path.join(f.directory, "access-management.json");
  fs.writeFileSync(current, bytes(f.state));
  const result = revokeCredential(
    f.root,
    f.tokens.administrator,
    1,
    "00000000-0000-4000-8000-000000000090",
    target.userId,
    target.credentialId,
  );
  assert.equal(result.status, "completed");
  assert.equal(Object.hasOwn(result, "token"), false);
  assert.equal(
    authenticateNormalConnection(f.root, f.tokens.administrator).status,
    "unavailable",
  );
  const before = fs.readFileSync(current);
  const delayed = recordCredentialPresentation(f.root, {
    credentialId: target.credentialId,
    issuanceOperationId: target.operationId,
    expectedRevision: 2,
    target: "confirmed",
    presentationOperationId: "00000000-0000-4000-8000-000000000001",
  });
  assert.equal(delayed.status, "unavailable");
  assert.deepEqual(fs.readFileSync(current), before);
});

/**
 * 発行の容量予約と生成故障を実保存前に反証する。
 * @responsibility 予約前生成0と生成失敗後の保存0を分ける。
 * @trace RFD-IT-017
 * @precondition 自己生成Rootと管理資格。容量例は有効な最大近傍Snapshot。
 * @stimulus 容量超過、乱数例外、生成KDF例外、資格ID衝突。
 * @observation randomBytes回数、固定失敗、current byteと材料不存在。
 * @oracle 容量時生成0、その他は再試行0・Secret返却0・current不変。
 * @cleanup crypto差替えをfinally復元しFixture回収。
 * @boundary Node crypto生成と既存保存容量Gate。
 */
test("通常鍵発行は容量前生成0と生成故障後保存0を保持する", (t) => {
  for (const mode of ["capacity", "random", "kdf", "collision"] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    if (mode === "capacity") {
      const repository = {
        repositoryId: "capacity-fixture",
        repositoryRoot: `${path.parse(f.directory).root.replaceAll("\\", "/")}x`,
        bindingId: `binding-${"0".repeat(32)}`,
      };
      f.state.registeredRepositories.push(repository);
      repository.repositoryRoot += "x".repeat(
        16_777_216 - 64 - bytes(f.state).byteLength,
      );
      const normalized = path
        .resolve(repository.repositoryRoot)
        .replace(/[\\/]+$/u, "");
      repository.bindingId = `binding-${createHash("sha256")
        .update(
          `${repository.repositoryId}\n${process.platform === "win32" ? normalized.toLowerCase() : normalized}`,
          "utf8",
        )
        .digest("hex")
        .slice(0, 32)}`;
      assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
    }
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    const scrypt = crypto.scryptSync;
    let generated = 0;
    let kdfCalls = 0;
    crypto.randomBytes = ((size: number) => {
      generated++;
      if (mode === "random" || mode === "capacity")
        throw new Error("injected_random");
      if (mode === "collision" && size === 12)
        return Buffer.from(f.state.credentials[0]?.credentialId ?? "", "hex");
      return random(size);
    }) as typeof crypto.randomBytes;
    crypto.scryptSync = ((password, salt, length, options) => {
      kdfCalls++;
      if (mode === "kdf" && kdfCalls > 1)
        throw new Error("injected_generation_kdf");
      return scrypt(password, salt, length, options);
    }) as typeof crypto.scryptSync;
    try {
      const result = issueCredential(
        f.root,
        f.tokens.administrator,
        1,
        "00000000-0000-4000-8000-000000000090",
        userId,
      );
      assert.equal(result.status, "unavailable");
      assert.equal(Object.hasOwn(result, "token"), false);
      if (mode === "capacity") assert.equal(generated, 0);
      else assert.ok(generated > 0 && generated <= 3);
    } finally {
      crypto.randomBytes = random;
      crypto.scryptSync = scrypt;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 二Processの鍵変更を同じ期待改訂で競合させる。
 * @responsibility 既存Lockだけで一採用と対象外資格保持を確認する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 試験専用Bearerと自己生成Root、通常資格三件。
 * @stimulus 発行／発行、発行／失効、失効／失効を同時開始する。
 * @observation 子Process終了、閉じた非秘密結果、採用改訂・資格集合。
 * @oracle 一採用だけ、敗者の生成0・追加失効0、対象外不変。
 * @cleanup 全子ProcessをcloseまでjoinしてFixture回収。
 * @boundary 実Node Processと同じFilesystem Lock。
 */
test("通常鍵変更の二Process競合は一採用だけに閉じる", async (t) => {
  for (const operations of [
    ["issue", "issue"],
    ["issue", "revoke"],
    ["revoke", "revoke"],
  ] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[1]?.userId;
    const credentialId = f.state.credentials[1]?.credentialId;
    assert.ok(userId && credentialId);
    const worker = path.resolve(
      import.meta.dirname,
      "../../fixtures/credential-management-worker.ts",
    );
    const joined = await Promise.allSettled(
      operations.map(
        (operation, index) =>
          new Promise<{ status: string; generated: number }>(
            (resolve, reject) => {
              const child = spawn(process.execPath, [worker], {
                timeout: 10000,
              });
              let output = "";
              let childFailed = false;
              let inputFailed = false;
              child.stdout.on("data", (chunk) => {
                output += String(chunk);
              });
              child.stderr.resume();
              child.on("error", () => {
                childFailed = true;
              });
              child.stdin.on("error", () => {
                inputFailed = true;
              });
              child.stdin.end(
                JSON.stringify({
                  directory: f.directory,
                  token: f.tokens.administrator,
                  operationId: `00000000-0000-4000-8000-00000000009${index}`,
                  userId,
                  credentialId,
                  operation,
                }),
              );
              child.on("close", (code, signal) => {
                if (code !== 0 || childFailed || inputFailed)
                  reject(new Error(`child_failed:${code}:${signal}`));
                else {
                  try {
                    resolve(JSON.parse(output));
                  } catch {
                    reject(new Error("child_result_invalid"));
                  }
                }
              });
            },
          ),
      ),
    );
    const results = joined.map((result) => {
      assert.equal(
        result.status,
        "fulfilled",
        result.status === "rejected" && result.reason instanceof Error
          ? result.reason.message
          : "child_join",
      );
      if (result.status !== "fulfilled") throw new Error("child_failed");
      return result.value;
    });
    assert.equal(
      results.filter((result) => result.status === "completed").length,
      1,
      JSON.stringify(results),
    );
    for (const result of results)
      if (result.status !== "completed") assert.equal(result.generated, 0);
    const saved = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.revision, 2);
    assert.deepEqual(saved.credentials[0], f.state.credentials[0]);
    assert.deepEqual(saved.credentials[2], f.state.credentials[2]);
    assert.equal(
      saved.credentials.length + Number(saved.credentials[1]?.revoked),
      4,
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 初回履歴Identityを通常鍵要求へ再利用しない。
 * @responsibility 歴史的資格record不在でも安定した元試行を保護する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 初回completed・歴史的初資格record不在・別管理資格あり。
 * @stimulus 初回attemptをissue／revokeの受付IDへ渡す。
 * @observation 生成乱数・認証／生成KDF件数、固定拒否、state byteと材料。
 * @oracle 両拒否、乱数／KDF0、current不変・新材料0。
 * @cleanup crypto差替え復元とFixture回収。
 * @boundary 安定した初期化Identityと通常受付Identity。
 */
test("通常鍵変更は歴史的初回attemptの再利用を認証前に拒否する", (t) => {
  const f = managementFixture(t);
  const initial = f.state.initialization;
  assert.equal(initial.stage, "completed");
  if (initial.stage !== "completed") return;
  assert.equal(
    f.state.credentials.some(
      (item) => item.credentialId === initial.initialCredentialId,
    ),
    false,
  );
  const userId = f.state.users[0]?.userId;
  const credentialId = f.state.credentials[0]?.credentialId;
  assert.ok(userId && credentialId);
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  const random = crypto.randomBytes;
  const scrypt = crypto.scryptSync;
  let generated = 0;
  let kdf = 0;
  crypto.randomBytes = (() => {
    generated++;
    throw new Error("unexpected_random");
  }) as typeof crypto.randomBytes;
  crypto.scryptSync = (() => {
    kdf++;
    throw new Error("unexpected_kdf");
  }) as typeof crypto.scryptSync;
  try {
    assert.deepEqual(
      issueCredential(
        f.root,
        f.tokens.administrator,
        1,
        initial.attemptId,
        userId,
      ),
      { status: "unavailable", reason: "credential_management_rejected" },
    );
    assert.deepEqual(
      revokeCredential(
        f.root,
        f.tokens.administrator,
        1,
        initial.attemptId,
        userId,
        credentialId,
      ),
      { status: "unavailable", reason: "credential_management_rejected" },
    );
    assert.equal(generated, 0);
    assert.equal(kdf, 0);
  } finally {
    crypto.randomBytes = random;
    crypto.scryptSync = scrypt;
  }
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 公開結果型の操作別Secret境界を固定する。
 * @responsibility 型検査の拒否と実行時の資格処置を混同しない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 型検査を含む正式Package試験入口。
 * @stimulus 正しい二結果と、発行の鍵欠落／失効の鍵混入を型へ代入する。
 * @observation 型検査の期待エラーとメモリ値のown-token。
 * @oracle issueはtoken必須、revokeはtoken禁止。保存／提示は本Caseでは検証しない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary Package公開Typeの補助契約。IT全体成立ではない。
 */
test("通常鍵結果型は操作別のSecret必須と禁止を区別する", () => {
  const common = {
    status: "completed" as const,
    operationId: "00000000-0000-4000-8000-000000000090",
    expectedRevision: 1,
    revision: 2,
    userId: "00000000-0000-4000-8000-000000000003",
    credentialId: "f".repeat(24),
    publication: "confirmed" as const,
    cleanupConfirmed: true as const,
  };
  const issued: CredentialManagementResult = {
    ...common,
    operation: "issueCredential",
    token: "synthetic-type-value",
  };
  const revoked: CredentialManagementResult = {
    ...common,
    operation: "revokeCredential",
  };
  // @ts-expect-error 発行成功には短命tokenが必須。
  const missing: CredentialManagementResult = {
    ...common,
    operation: "issueCredential",
  };
  const excessive: CredentialManagementResult = {
    ...common,
    operation: "revokeCredential",
    // @ts-expect-error 独立失効の結果へtokenを混入できない。
    token: "synthetic-type-value",
  };
  assert.equal(Object.hasOwn(issued, "token"), true);
  assert.equal(Object.hasOwn(revoked, "token"), false);
  assert.equal(Object.hasOwn(missing, "token"), false);
  assert.equal(Object.hasOwn(excessive, "token"), true);
});

/**
 * 元発行IDから提示三状態と現在失効だけを観測する。
 * @responsibility 非秘密の現在事実をSecret再取得や成功Receiptにしない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成管理Rootと通常発行済み資格。
 * @stimulus 発行、提示前記録、提示確認、失効を順に保存し同元発行IDを読む。
 * @observation 六fieldの閉じた投影、凍結、Role拒否・別User・未知ID。
 * @oracle 現在提示／失効だけを返し、Secret・salt・Verifier・元失効Receiptなし。
 * @cleanup FixtureがRootを回収して不存在を確認する。
 * @boundary 専用Readerと実保存。Workbench／MCP本番接続ではない。
 */
test("資格発行事実Readerは提示三状態と失効を非秘密で観測する", (t) => {
  const f = managementFixture(t);
  const userId = f.state.users[1]?.userId;
  assert.ok(userId);
  const operationId = "00000000-0000-4000-8000-000000000090";
  const issued = issueCredential(
    f.root,
    f.tokens.administrator,
    1,
    operationId,
    userId,
  );
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const first = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(first.status, "observed");
  if (first.status !== "observed") return;
  assert.deepEqual(first.snapshot, {
    revision: 2,
    credentialId: issued.credentialId,
    userId,
    issuanceOperationId: operationId,
    presentation: "not_attempted",
    revoked: false,
  });
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.snapshot), true);
  const pending = recordCredentialPresentation(f.root, {
    credentialId: issued.credentialId,
    issuanceOperationId: operationId,
    expectedRevision: 2,
    target: "unconfirmed",
  });
  assert.equal(pending.status, "completed");
  if (pending.status !== "completed") return;
  const unconfirmed = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(
    unconfirmed.status === "observed" && unconfirmed.snapshot.presentation,
    "unconfirmed",
  );
  assert.equal(
    recordCredentialPresentation(f.root, {
      credentialId: issued.credentialId,
      issuanceOperationId: operationId,
      expectedRevision: 3,
      target: "confirmed",
      presentationOperationId: pending.value.presentationOperationId,
    }).status,
    "completed",
  );
  const confirmed = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(
    confirmed.status === "observed" && confirmed.snapshot.presentation,
    "confirmed",
  );
  assert.equal(
    revokeCredential(
      f.root,
      f.tokens.administrator,
      4,
      "00000000-0000-4000-8000-000000000091",
      userId,
      issued.credentialId,
    ).status,
    "completed",
  );
  const revoked = readCredentialIssuance(
    f.root,
    f.tokens.administrator,
    operationId,
    userId,
  );
  assert.equal(revoked.status, "observed");
  if (revoked.status === "observed")
    assert.deepEqual(revoked.snapshot, {
      ...first.snapshot,
      revision: 5,
      presentation: "confirmed",
      revoked: true,
    });
  const current = path.join(f.directory, "access-management.json");
  const before = fs.readFileSync(current);
  for (const token of [f.tokens.manager, f.tokens.developer, "invalid"])
    assert.deepEqual(
      readCredentialIssuance(f.root, token, operationId, userId),
      { status: "unavailable", reason: "credential_issuance_unavailable" },
    );
  assert.equal(
    readCredentialIssuance(
      f.root,
      f.tokens.administrator,
      operationId,
      f.state.users[0]?.userId ?? "",
    ).status,
    "unavailable",
  );
  assert.equal(
    readCredentialIssuance(
      f.root,
      f.tokens.administrator,
      "00000000-0000-4000-8000-000000000999",
      userId,
    ).status,
    "unavailable",
  );
  assert.deepEqual(fs.readFileSync(current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * Readerは材料処置・破損・Lock解放不明で事実を返さない。
 * @responsibility 先行候補の処置とfreshな次要求の観測を分ける。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成の完全管理状態と実pending／Lock。
 * @stimulus base／出版済み一致pending、破損pending、Lock削除故障を与える。
 * @observation fact有無、current byte、材料保持／清掃と次要求。
 * @oracle 材料処置要求はfact0、次要求だけfresh事実。破損／解放不明はfact0。
 * @cleanup Hook復元とFixture回収。
 * @boundary 同Lockの現在認可・材料処置・解放後結果。
 */
test("資格発行事実Readerは材料処置と解放不明で事実を返さない", (t) => {
  for (const mode of ["pending", "published", "corrupt", "lock"] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const current = path.join(f.directory, "access-management.json");
    if (mode === "pending" || mode === "published") {
      const next = structuredClone(f.state);
      next.revision = 2;
      next.operationId = "00000000-0000-4000-8000-000000000090";
      const actor = next.users[0];
      assert.ok(actor);
      if (mode === "pending") actor.role = "manager";
      prepare(f, next);
      if (mode === "published") fs.writeFileSync(current, bytes(next));
    } else if (mode === "corrupt")
      fs.writeFileSync(
        path.join(f.directory, "access-management.pending.json"),
        "{",
      );
    const before = fs.readFileSync(current);
    const remove = fs.rmSync;
    if (mode === "lock")
      fs.rmSync = (targetPath, options) => {
        if (
          String(targetPath) ===
          path.join(f.directory, "access-management.lock")
        )
          throw new Error("injected_lock_cleanup");
        return remove(targetPath, options);
      };
    try {
      assert.deepEqual(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ),
        { status: "unavailable", reason: "credential_issuance_unavailable" },
      );
    } finally {
      fs.rmSync = remove;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    if (mode === "published")
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    if (mode !== "corrupt") {
      assert.equal(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ).status,
        "observed",
      );
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    } else
      assert.equal(
        fs.readFileSync(
          path.join(f.directory, "access-management.pending.json"),
          "utf8",
        ),
        "{",
      );
  }
});

/**
 * Readerの形式不正・初回途中・現在失効・record不在を反証する。
 * @responsibility 未取得を未発行や古い本人Authorityへ変換しない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成管理状態と初回途中の模擬状態。
 * @stimulus 不正相関、認証資格失効、既存record整理、初回未完了を渡す。
 * @observation 固定未取得、形式不正時のopen0、current byteと材料。
 * @oracle 事実field0、状態不変、Secret復元0。
 * @cleanup open差替え復元とFixture回収。
 * @boundary 専用読取りの入力・現在認証・現在record。
 */
test("資格発行事実Readerは不正・未完了・失効・整理済みを未取得に閉じる", (t) => {
  const f = managementFixture(t);
  const target = f.state.credentials[1];
  assert.ok(target);
  const unavailable = {
    status: "unavailable",
    reason: "credential_issuance_unavailable",
  };
  const open = fs.openSync;
  let opened = 0;
  fs.openSync = ((...args) => {
    opened++;
    return open(...args);
  }) as typeof fs.openSync;
  try {
    assert.deepEqual(
      readCredentialIssuance(
        f.root,
        f.tokens.administrator,
        "invalid",
        target.userId,
      ),
      unavailable,
    );
    assert.deepEqual(
      readCredentialIssuance(
        f.root,
        f.tokens.administrator,
        target.operationId,
        "invalid",
      ),
      unavailable,
    );
    assert.equal(opened, 0);
  } finally {
    fs.openSync = open;
  }
  const current = path.join(f.directory, "access-management.json");
  for (const mode of ["actor_revoked", "record_removed"] as const) {
    const state = structuredClone(f.state);
    if (mode === "actor_revoked") {
      const actor = state.credentials[0];
      assert.ok(actor);
      actor.revoked = true;
    } else
      state.credentials = state.credentials.filter(
        (item) => item.credentialId !== target.credentialId,
      );
    fs.writeFileSync(current, bytes(state));
    const before = fs.readFileSync(current);
    assert.deepEqual(
      readCredentialIssuance(
        f.root,
        f.tokens.administrator,
        target.operationId,
        target.userId,
      ),
      unavailable,
    );
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
  const initial = fixture(t);
  const attempt = prepareInitialUser(initial);
  const credential = createInitialCredential(initial.root, attempt);
  assert.equal(credential.status, "completed");
  if (credential.status !== "completed" || !credential.value.token) return;
  const initialCurrent = path.join(initial.directory, "access-management.json");
  const state = JSON.parse(
    fs.readFileSync(initialCurrent, "utf8"),
  ) as AccessManagementState;
  const userId = state.users[0]?.userId;
  assert.ok(userId);
  const before = fs.readFileSync(initialCurrent);
  assert.deepEqual(
    readCredentialIssuance(
      initial.root,
      credential.value.token,
      attempt,
      userId,
    ),
    unavailable,
  );
  assert.deepEqual(fs.readFileSync(initialCurrent), before);
});

/**
 * 先行出版と読取り・清掃故障で古い資格事実を返さない。
 * @responsibility 現在Roleと材料の処置結果を旧投影に混ぜない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition 自己生成Rootと保存済み元発行相関。
 * @stimulus Actor降格済みnext、base／出版済みpending削除故障、current open故障、孤立replace。
 * @observation fixed未取得、current保持、材料保持、故障解除後のfresh観測。
 * @oracle 旧Authorityや未確認清掃によるfact0。自動出版0。
 * @cleanup Hook復元とFixture回収。
 * @boundary current読取り・認可・先行材料・結果搬送の相関。
 */
test("資格発行事実Readerは先行出版と読取り・清掃故障で古い事実を返さない", (t) => {
  for (const mode of [
    "published_role",
    "published_cleanup",
    "cleanup",
    "read",
    "replace",
  ] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[1];
    assert.ok(target);
    const current = path.join(f.directory, "access-management.json");
    const next = structuredClone(f.state);
    next.revision = 2;
    next.operationId = "00000000-0000-4000-8000-000000000090";
    const actor = next.users[0];
    assert.ok(actor);
    if (mode !== "published_cleanup") actor.role = "manager";
    if (
      mode === "published_role" ||
      mode === "published_cleanup" ||
      mode === "cleanup"
    ) {
      prepare(f, next);
      if (mode === "published_role" || mode === "published_cleanup")
        fs.writeFileSync(current, bytes(next));
    } else if (mode === "replace")
      fs.writeFileSync(
        path.join(f.directory, "access-management.replace.json"),
        "{",
      );
    const before = fs.readFileSync(current);
    const open = fs.openSync;
    const remove = fs.rmSync;
    if (mode === "read")
      fs.openSync = (file, flags, permissions) => {
        if (String(file) === current)
          throw Object.assign(new Error("injected_read"), { code: "EACCES" });
        return open(file, flags, permissions);
      };
    if (mode === "cleanup" || mode === "published_cleanup")
      fs.rmSync = (file, options) => {
        if (
          String(file) ===
          path.join(f.directory, "access-management.pending.json")
        )
          throw new Error("injected_cleanup");
        return remove(file, options);
      };
    try {
      assert.deepEqual(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ),
        { status: "unavailable", reason: "credential_issuance_unavailable" },
      );
    } finally {
      fs.openSync = open;
      fs.rmSync = remove;
    }
    assert.deepEqual(fs.readFileSync(current), before);
    if (mode === "published_role") {
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.pending.json")),
        true,
      );
      assert.equal(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ).status,
        "unavailable",
      );
    } else if (
      mode === "read" ||
      mode === "cleanup" ||
      mode === "published_cleanup"
    ) {
      if (mode === "published_cleanup")
        assert.deepEqual(fs.readdirSync(f.directory).sort(), [
          "access-management.json",
          "access-management.pending.json",
        ]);
      if (mode === "cleanup" || mode === "published_cleanup") {
        assert.equal(
          readCredentialIssuance(
            f.root,
            f.tokens.administrator,
            target.operationId,
            target.userId,
          ).status,
          "unavailable",
        );
        assert.deepEqual(fs.readFileSync(current), before);
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
      }
      assert.equal(
        readCredentialIssuance(
          f.root,
          f.tokens.administrator,
          target.operationId,
          target.userId,
        ).status,
        "observed",
      );
    } else
      assert.equal(
        fs.readFileSync(
          path.join(f.directory, "access-management.replace.json"),
          "utf8",
        ),
        "{",
      );
  }
});

/**
 * 四経路を同Lockの三出版と一生成へ接続する。
 * @responsibility 自己／全員失効後の同要求再認証をせず、別要求では再認可する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 自己生成Rootと三Role資格。指定対象は管理者自身。
 * @stimulus Workbench／Host×指定／全員とstoredのexact再入場。
 * @observation 改訂・固定旧集合・失効・新Verifier、KDF／乱数、token、未解決recordと非対象情報。
 * @oracle 三出版で一新資格。新規成功だけtoken、旧鍵拒否、Host再入場はtoken null・生成0。
 * @cleanup crypto復元とFixture回収。
 * @boundary 実保存・現在認証・暗号生成。提示本番入口ではない。
 */
test("鍵交換保存は四経路で自己失効後も同要求だけを完了する", (t) => {
  for (const entry of ["workbench", "host"] as const)
    for (const scope of ["targeted", "all"] as const) {
      const f = managementFixture(t);
      const userId = f.state.users[0]?.userId;
      assert.ok(userId);
      const ids = f.state.credentials
        .filter((c) => scope === "all" || c.userId === userId)
        .map((c) => c.credentialId);
      const operationId = "00000000-0000-4000-8000-000000000090";
      const random = crypto.randomBytes;
      const scrypt = crypto.scryptSync;
      let generated = 0;
      let kdf = 0;
      crypto.randomBytes = ((size: number) => {
        generated++;
        return random(size);
      }) as typeof crypto.randomBytes;
      crypto.scryptSync = ((...args) => {
        kdf++;
        return scrypt(...args);
      }) as typeof crypto.scryptSync;
      let result: KeyExchangeResult;
      try {
        result =
          entry === "workbench"
            ? exchangeCredentials(
                f.root,
                f.tokens.administrator,
                1,
                operationId,
                scope,
                userId,
                ids,
                scope === "all",
              )
            : exchangeCredentialsFromHost(
                f.root,
                1,
                operationId,
                scope,
                userId,
                ids,
                true,
              );
        assert.equal(generated, 3);
        assert.equal(kdf, entry === "host" ? 1 : 2);
      } finally {
        crypto.randomBytes = random;
        crypto.scryptSync = scrypt;
      }
      assert.equal(result.status, "completed");
      if (result.status !== "completed") continue;
      assert.equal(result.revision, 4);
      assert.equal(result.lastConfirmedStage, "credential_stored");
      assert.equal(typeof result.token, "string");
      const saved = JSON.parse(
        fs.readFileSync(
          path.join(f.directory, "access-management.json"),
          "utf8",
        ),
      ) as AccessManagementState;
      assert.equal(saved.revision, 4);
      assert.equal(saved.unresolvedKeyExchanges.length, 1);
      assert.deepEqual(saved.unresolvedKeyExchanges[0], {
        stage: "credential_stored",
        recoveryId: result.recoveryId,
        operationId,
        entry,
        scope,
        recipientUserId: userId,
        oldCredentialIds: ids,
        newCredentialId: result.credentialId,
      });
      for (const credential of saved.credentials.slice(0, 3))
        assert.equal(credential.revoked, ids.includes(credential.credentialId));
      const issued = saved.credentials[3];
      assert.ok(issued && result.token);
      assert.equal(issued.presentation, "not_attempted");
      assert.equal(verifyCredentialToken(result.token, issued), true);
      assert.equal(
        fs
          .readFileSync(
            path.join(f.directory, "access-management.json"),
            "utf8",
          )
          .includes(result.token),
        false,
      );
      assert.deepEqual(saved.users, f.state.users);
      assert.deepEqual(saved.roleContentAccess, f.state.roleContentAccess);
      assert.deepEqual(
        saved.registeredRepositories,
        f.state.registeredRepositories,
      );
      assert.deepEqual(saved.exposure, f.state.exposure);
      assert.deepEqual(saved.initialization, f.state.initialization);
      assert.equal(
        authenticateNormalConnection(f.root, f.tokens.administrator).status,
        "unavailable",
      );
      generated = 0;
      crypto.randomBytes = (() => {
        generated++;
        throw new Error("unexpected_generation");
      }) as typeof crypto.randomBytes;
      try {
        const observed = exchangeCredentialsFromHost(
          f.root,
          4,
          operationId,
          scope,
          userId,
          ids,
          true,
        );
        assert.equal(observed.status, "completed");
        if (observed.status === "completed") {
          assert.equal(observed.token, null);
          assert.equal(observed.entry, entry);
          assert.equal(observed.revision, 4);
        }
        assert.equal(generated, 0);
      } finally {
        crypto.randomBytes = random;
      }
      assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    }
});

/**
 * 三出版のprepare・rename・読戻し・清掃故障を分ける。
 * @responsibility 意図したnextから確定段階やRecoveryを推定しない。
 * @trace RFD-IT-017
 * @precondition 実Rootと三Role資格。各出版位置に一故障を注入する。
 * @stimulus prepared／revoked／credential_stored×prepare／publish／read_back／cleanup。
 * @observation 最初の失敗、最後の確認段階、Recovery、Secret0、実currentとpending、再入場。
 * @oracle base材料は保持停止、next材料処置要求は停止し次要求だけ継続、stored再生成0。
 * @cleanup fs／crypto差替え復元とFixture回収。
 * @boundary 三出版・耐久現在状態・短命材料と結果返却。
 */
test("鍵交換保存は三出版の故障と確定済み段階を分離する", (t) => {
  for (const phase of [1, 2, 3])
    for (const fault of [
      "prepare",
      "publish",
      "read_back",
      "cleanup",
    ] as const) {
      const f = managementFixture(t);
      const userId = f.state.users[0]?.userId;
      assert.ok(userId);
      const ids = [f.state.credentials[0]?.credentialId];
      assert.ok(ids[0]);
      const operationId = "00000000-0000-4000-8000-000000000090";
      const current = path.join(f.directory, "access-management.json");
      const pending = path.join(f.directory, "access-management.pending.json");
      const rename = fs.renameSync;
      const open = fs.openSync;
      const remove = fs.rmSync;
      const random = crypto.randomBytes;
      let renames = 0;
      let preparations = 0;
      let generated = 0;
      fs.renameSync = (from, to) => {
        renames++;
        if (fault === "publish" && renames === phase)
          throw new Error("injected_publish");
        return rename(from, to);
      };
      fs.openSync = (file, flags, mode) => {
        if (String(file) === pending && flags === "wx") {
          preparations++;
          if (fault === "prepare" && preparations === phase)
            throw new Error("injected_prepare");
        }
        if (
          fault === "read_back" &&
          String(file) === current &&
          renames === phase
        )
          throw new Error("injected_readback");
        return open(file, flags, mode);
      };
      fs.rmSync = (file, options) => {
        if (
          fault === "cleanup" &&
          String(file) === pending &&
          renames === phase
        )
          throw new Error("injected_cleanup");
        return remove(file, options);
      };
      crypto.randomBytes = ((size: number) => {
        generated++;
        return random(size);
      }) as typeof crypto.randomBytes;
      let result: KeyExchangeResult;
      try {
        result = exchangeCredentialsFromHost(
          f.root,
          1,
          operationId,
          "targeted",
          userId,
          ids,
          true,
        );
      } finally {
        fs.renameSync = rename;
        fs.openSync = open;
        fs.rmSync = remove;
        crypto.randomBytes = random;
      }
      assert.equal(result.status, "unavailable");
      assert.equal(Object.hasOwn(result, "token"), false);
      if (
        result.status !== "unavailable" ||
        result.reason !== "key_exchange_unavailable"
      )
        continue;
      assert.equal(result.firstFailure, fault);
      assert.equal(result.secondaryFailure, null);
      const stages = [
        "not_started",
        "prepared",
        "revoked",
        "credential_stored",
      ];
      assert.equal(
        result.lastConfirmedStage,
        stages[fault === "cleanup" ? phase : phase - 1],
      );
      assert.equal(
        result.recoveryId === null,
        phase === 1 && fault !== "cleanup",
      );
      assert.equal(generated, phase === 3 ? 3 : 0);
      const saved = JSON.parse(
        fs.readFileSync(current, "utf8"),
      ) as AccessManagementState;
      assert.equal(
        saved.revision,
        (fault === "read_back" || fault === "cleanup" ? phase : phase - 1) + 1,
      );
      const before = fs.readFileSync(current);
      if (fault === "publish") {
        let retried = 0;
        crypto.randomBytes = (() => {
          retried++;
          throw new Error("unexpected_generation");
        }) as typeof crypto.randomBytes;
        try {
          const stopped = exchangeCredentialsFromHost(
            f.root,
            saved.revision,
            operationId,
            "targeted",
            userId,
            ids,
            true,
          );
          assert.equal(stopped.status, "unavailable");
          assert.equal(retried, 0);
        } finally {
          crypto.randomBytes = random;
        }
        assert.deepEqual(fs.readFileSync(current), before);
        assert.equal(fs.existsSync(pending), true);
      } else {
        if (fault === "read_back" || fault === "cleanup") {
          assert.equal(
            exchangeCredentialsFromHost(
              f.root,
              saved.revision,
              operationId,
              "targeted",
              userId,
              ids,
              true,
            ).status,
            "unavailable",
          );
          assert.deepEqual(fs.readFileSync(current), before);
          assert.deepEqual(fs.readdirSync(f.directory), [
            "access-management.json",
          ]);
        }
        const resumed = exchangeCredentialsFromHost(
          f.root,
          saved.revision,
          operationId,
          "targeted",
          userId,
          ids,
          true,
        );
        assert.equal(resumed.status, "completed");
        if (
          resumed.status === "completed" &&
          (fault === "read_back" || fault === "cleanup") &&
          phase === 3
        )
          assert.equal(resumed.token, null);
      }
    }
});

/**
 * 認可拒否Actorに先行材料を処置させない。
 * @responsibility 現在Role・確認・相関をpending清掃より前に検査する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition 三Roleとbase／next一致の模擬通常pending。
 * @stimulus 非管理者と確認欠落、不正表示配列を渡す。
 * @observation 固定拒否・current／pending／replace byte・生成0。
 * @oracle 拒否時材料不変、鍵・資格Effect0。
 * @cleanup Fixture回収。
 * @boundary 現在認可と既存材料処置。
 */
test("鍵交換保存は拒否Actorの先行材料処置と生成を行わない", (t) => {
  for (const published of [false, true]) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const next = structuredClone(f.state);
    next.revision = 2;
    next.operationId = "00000000-0000-4000-8000-000000000089";
    prepare(f, next);
    if (published)
      fs.writeFileSync(
        path.join(f.directory, "access-management.json"),
        bytes(next),
      );
    const before = fs
      .readdirSync(f.directory)
      .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]);
    for (const token of [f.tokens.manager, f.tokens.developer])
      assert.deepEqual(
        exchangeCredentials(
          f.root,
          token,
          published ? 2 : 1,
          "00000000-0000-4000-8000-000000000090",
          "targeted",
          userId,
          [f.state.credentials[0]?.credentialId],
          false,
        ),
        { status: "unavailable", reason: "key_exchange_rejected" },
      );
    assert.deepEqual(
      fs
        .readdirSync(f.directory)
        .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]),
      before,
    );
  }
});

/**
 * 初回Host指定と完了後の歴史ID保持を実保存で反証する。
 * @responsibility 新資格と最新確認Bindingを同改訂へ保存する。
 * @trace RFD-IT-017
 * @trace RFD-IT-024
 * @precondition 一管理者の初回資格段階。
 * @stimulus 元資格へのHost指定交換を実行する。
 * @observation 三段階保存、新確認ID・元初資格・元試行・旧失効。
 * @oracle 新確認だけ結替え、初回completed／通常Authorityは未成立。
 * @cleanup Fixture回収。
 * @boundary 交換保存と初回確認のBinding。
 */
test("鍵交換保存は初回Host指定の確認対象だけを結替える", (t) => {
  const f = managementFixture(t);
  const admin = f.state.users[0];
  const old = f.state.credentials[0];
  assert.ok(admin && old);
  f.state.users = [admin];
  f.state.credentials = [old];
  old.operationId = f.state.initialization.attemptId;
  f.state.initialization = {
    stage: "credential_stored",
    attemptId: old.operationId,
    userId: admin.userId,
    initialCredentialId: old.credentialId,
    confirmationCredentialId: old.credentialId,
  };
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const result = exchangeCredentialsFromHost(
    f.root,
    1,
    "00000000-0000-4000-8000-000000000090",
    "targeted",
    admin.userId,
    [old.credentialId],
    true,
  );
  assert.equal(result.status, "completed");
  if (result.status !== "completed") return;
  const saved = JSON.parse(
    fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
  ) as AccessManagementState;
  assert.equal(saved.initialization.stage, "credential_stored");
  if (saved.initialization.stage !== "credential_stored") return;
  assert.equal(saved.initialization.attemptId, old.operationId);
  assert.equal(saved.initialization.initialCredentialId, old.credentialId);
  assert.equal(
    saved.initialization.confirmationCredentialId,
    result.credentialId,
  );
  assert.equal(saved.credentials[0]?.revoked, true);
  assert.equal(
    authenticateNormalConnection(f.root, result.token ?? "").status,
    "unavailable",
  );
});

/**
 * 最初の出版故障をLock解放不明で上書きしない。
 * @responsibility 保存Failureと資源解放の別事実を保持する。
 * @trace RFD-IT-017
 * @precondition prepared出版後の自己生成Root。
 * @stimulus revoked rename失敗とLock削除失敗、またはstored後のLock削除失敗。
 * @observation first／secondary Failure、最後の確認段階、token0。
 * @oracle 主失敗を保持し、stored既知でも解放不明ならtokenを返さない。
 * @cleanup Hook復元とFixture回収。
 * @boundary 出版結果と外側Lockの解放。
 */
test("鍵交換保存は主Failureと解放不明を分離する", (t) => {
  for (const publishFailure of [false, true]) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const rename = fs.renameSync;
    const remove = fs.rmSync;
    let renames = 0;
    fs.renameSync = (from, to) => {
      renames++;
      if (publishFailure && renames === 2) throw new Error("injected_publish");
      return rename(from, to);
    };
    fs.rmSync = (file, options) => {
      if (String(file) === path.join(f.directory, "access-management.lock"))
        throw new Error("injected_release");
      return remove(file, options);
    };
    let result: KeyExchangeResult;
    try {
      result = exchangeCredentialsFromHost(
        f.root,
        1,
        "00000000-0000-4000-8000-000000000090",
        "targeted",
        userId,
        [f.state.credentials[0]?.credentialId],
        true,
      );
    } finally {
      fs.renameSync = rename;
      fs.rmSync = remove;
    }
    assert.equal(result.status, "unavailable");
    assert.equal(Object.hasOwn(result, "token"), false);
    if (
      result.status !== "unavailable" ||
      result.reason !== "key_exchange_unavailable"
    )
      continue;
    assert.equal(result.firstFailure, publishFailure ? "publish" : "release");
    assert.equal(result.secondaryFailure, publishFailure ? "release" : null);
    assert.equal(
      result.lastConfirmedStage,
      publishFailure ? "prepared" : "credential_stored",
    );
    assert.equal(result.cleanupConfirmed, false);
  }
});

/**
 * 失効確定後の容量・生成故障を保存前に閉じる。
 * @responsibility 固定revoked事実を新資格成功や未失効へ変えない。
 * @trace RFD-IT-017
 * @precondition 自己生成currentにexact revoked交換を保存済み。
 * @stimulus 容量超過、乱数故障、KDF故障、資格ID衝突。
 * @observation current byte、乱数／KDF回数、Failure、Secretと新材料0。
 * @oracle 容量は生成0、生成失敗は再試行0、旧失効・同Recoveryを保持する。
 * @cleanup 暗号Hook復元とFixture回収。
 * @boundary 失効後の予約・生成・出版前。
 */
test("鍵交換保存は失効確定後の容量と生成故障を保持する", (t) => {
  for (const mode of ["capacity", "random", "kdf", "collision"] as const) {
    const f = managementFixture(t);
    const target = f.state.credentials[0];
    assert.ok(target);
    target.revoked = true;
    f.state.revision = 3;
    const operationId = "00000000-0000-4000-8000-000000000090";
    f.state.operationId = operationId;
    f.state.unresolvedKeyExchanges = [
      {
        stage: "revoked",
        recoveryId: `access-management.key-exchange.${operationId}`,
        operationId,
        entry: "workbench",
        scope: "targeted",
        recipientUserId: target.userId,
        oldCredentialIds: [target.credentialId],
      },
    ];
    if (mode === "capacity") {
      const repository = {
        repositoryId: "capacity-fixture",
        repositoryRoot: `${path.parse(f.directory).root.replaceAll("\\", "/")}x`,
        bindingId: `binding-${"0".repeat(32)}`,
      };
      f.state.registeredRepositories.push(repository);
      repository.repositoryRoot += "x".repeat(
        16_777_216 - 64 - bytes(f.state).byteLength,
      );
      const normalized = path
        .resolve(repository.repositoryRoot)
        .replace(/[\\/]+$/u, "");
      repository.bindingId = `binding-${createHash("sha256")
        .update(
          `${repository.repositoryId}\n${process.platform === "win32" ? normalized.toLowerCase() : normalized}`,
          "utf8",
        )
        .digest("hex")
        .slice(0, 32)}`;
    }
    assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const before = fs.readFileSync(current);
    const random = crypto.randomBytes;
    const scrypt = crypto.scryptSync;
    let generated = 0;
    let kdf = 0;
    crypto.randomBytes = ((size: number) => {
      generated++;
      if (mode === "random" || mode === "capacity")
        throw new Error("injected_random");
      if (mode === "collision" && size === 12)
        return Buffer.from(target.credentialId, "hex");
      return random(size);
    }) as typeof crypto.randomBytes;
    crypto.scryptSync = ((...args) => {
      kdf++;
      if (mode === "kdf") throw new Error("injected_kdf");
      return scrypt(...args);
    }) as typeof crypto.scryptSync;
    let result: KeyExchangeResult;
    try {
      result = exchangeCredentialsFromHost(
        f.root,
        3,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        true,
      );
    } finally {
      crypto.randomBytes = random;
      crypto.scryptSync = scrypt;
    }
    assert.equal(result.status, "unavailable");
    assert.equal(Object.hasOwn(result, "token"), false);
    if (
      result.status !== "unavailable" ||
      result.reason !== "key_exchange_unavailable"
    )
      continue;
    assert.equal(
      result.firstFailure,
      mode === "capacity" ? "capacity" : "generation",
    );
    assert.equal(result.lastConfirmedStage, "revoked");
    assert.equal(
      result.recoveryId,
      f.state.unresolvedKeyExchanges[0]?.recoveryId,
    );
    if (mode === "capacity") {
      assert.equal(generated, 0);
      assert.equal(kdf, 0);
    } else assert.ok(generated > 0 && generated <= 3);
    assert.deepEqual(fs.readFileSync(current), before);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

/**
 * 別要求の旧資格拒否と現在別管理者／Hostのexact継続を検証する。
 * @responsibility 同要求admissionを次要求へ持ち越さない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @precondition Workbench起点の自己交換をrevoked清掃故障で停止する。
 * @stimulus 失効した旧鍵、別管理者、Hostを同じ交換へ再入場させる。
 * @observation 材料不変、起点entry／旧集合／Recovery、新生成と提示未成立。
 * @oracle 旧鍵拒否、材料処置要求停止、次fresh要求だけstored。Hostが起点を変更しない。
 * @cleanup Hook復元とFixture回収。
 * @boundary 新要求の認可と保存済み交換。
 */
test("鍵交換保存は別要求を現在別管理者またはHostだけで再開する", (t) => {
  for (const useHost of [false, true]) {
    const f = managementFixture(t);
    if (!useHost) {
      const actor = f.state.users[1];
      assert.ok(actor);
      actor.role = "administrator";
    }
    const target = f.state.credentials[0];
    assert.ok(target);
    const operationId = "00000000-0000-4000-8000-000000000090";
    const current = path.join(f.directory, "access-management.json");
    fs.writeFileSync(current, bytes(f.state));
    const remove = fs.rmSync;
    let removals = 0;
    fs.rmSync = (file, options) => {
      if (
        String(file) ===
          path.join(f.directory, "access-management.pending.json") &&
        ++removals === 2
      )
        throw new Error("injected_revoked_cleanup");
      return remove(file, options);
    };
    let failed: KeyExchangeResult;
    try {
      failed = exchangeCredentials(
        f.root,
        f.tokens.administrator,
        1,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        false,
      );
    } finally {
      fs.rmSync = remove;
    }
    assert.equal(failed.status, "unavailable");
    const before = fs
      .readdirSync(f.directory)
      .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]);
    assert.deepEqual(
      exchangeCredentials(
        f.root,
        f.tokens.administrator,
        3,
        operationId,
        "targeted",
        target.userId,
        [target.credentialId],
        false,
      ),
      { status: "unavailable", reason: "key_exchange_rejected" },
    );
    assert.deepEqual(
      fs
        .readdirSync(f.directory)
        .map((file) => [file, fs.readFileSync(path.join(f.directory, file))]),
      before,
    );
    const first = useHost
      ? exchangeCredentialsFromHost(
          f.root,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        )
      : exchangeCredentials(
          f.root,
          f.tokens.manager,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          false,
        );
    assert.equal(first.status, "unavailable");
    const resumed = useHost
      ? exchangeCredentialsFromHost(
          f.root,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        )
      : exchangeCredentials(
          f.root,
          f.tokens.manager,
          3,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          false,
        );
    assert.equal(resumed.status, "completed");
    if (resumed.status !== "completed") continue;
    assert.equal(resumed.entry, "workbench");
    assert.equal(
      resumed.recoveryId,
      `access-management.key-exchange.${operationId}`,
    );
    assert.deepEqual(resumed.oldCredentialIds, [target.credentialId]);
    assert.equal(resumed.revision, 4);
  }
});

/**
 * 鍵を全て失った既存ユーザーへHost指定で再発行する。
 * @responsibility 旧集合0件を未登録や新ユーザー生成へ変換しない。
 * @trace RFD-IT-017
 * @precondition 完了済み管理状態と全失効資格。
 * @stimulus 既存管理者のHost指定・空旧集合を確認する。
 * @observation 三出版・同userId新資格・旧失効保持。
 * @oracle 新User・Role変更0で一資格保存。未解決recordは残る。
 * @cleanup Fixture回収。
 * @boundary 既存Host回復と交換保存。
 */
test("鍵交換保存は旧資格0件のHost指定を同ユーザーへ閉じる", (t) => {
  const f = managementFixture(t);
  for (const credential of f.state.credentials) credential.revoked = true;
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const userId = f.state.users[0]?.userId;
  assert.ok(userId);
  const result = exchangeCredentialsFromHost(
    f.root,
    1,
    "00000000-0000-4000-8000-000000000090",
    "targeted",
    userId,
    [],
    true,
  );
  assert.equal(result.status, "completed");
  const saved = JSON.parse(
    fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
  ) as AccessManagementState;
  assert.deepEqual(saved.users, f.state.users);
  assert.equal(saved.credentials.filter((c) => !c.revoked).length, 1);
  assert.equal(saved.credentials[3]?.userId, userId);
});

/**
 * 実Process喪失後に三出版のbase／nextを分けて再入場する。
 * @responsibility 過去Ownerの不明を新生成や名前だけの削除へ変換しない。
 * @trace RFD-IT-017
 * @precondition 自己生成Rootと試験専用worker、Host代役の入力。
 * @stimulus 三出版のrename前／後に子を実終了する。
 * @observation Exit71、current段階、材料、exact既存Lock回収と次要求。
 * @oracle base保持停止・生成0、next処置要求停止→fresh継続、stored Secret再取得0。
 * @cleanup 子終了確認とFixture回収。
 * @boundary 実Node Process、Filesystem出版、既存Owner不存在確認。
 */
test("鍵交換保存は実Process喪失後も三段階のbaseとnextを分ける", (t) => {
  for (const phase of [1, 2, 3])
    for (const timing of ["before", "after"] as const) {
      const f = managementFixture(t);
      const target = f.state.credentials[0];
      assert.ok(target);
      const operationId = "00000000-0000-4000-8000-000000000090";
      const worker = path.resolve(
        import.meta.dirname,
        "../../fixtures/credential-management-worker.ts",
      );
      const child = spawnSync(process.execPath, [worker], {
        input: JSON.stringify({
          directory: f.directory,
          token: "",
          operationId,
          userId: target.userId,
          credentialId: "",
          operation: "host_exchange",
          scope: "targeted",
          displayedOldCredentialIds: [target.credentialId],
          crashPhase: phase,
          crashTiming: timing,
        }),
        timeout: 10000,
        maxBuffer: 1_048_576,
      });
      assert.equal(child.status, 71);
      assert.equal(child.error, undefined);
      assert.equal(child.stdout.byteLength, 0);
      const current = path.join(f.directory, "access-management.json");
      const before = fs.readFileSync(current);
      const saved = JSON.parse(
        before.toString("utf8"),
      ) as AccessManagementState;
      assert.equal(saved.revision, timing === "after" ? phase + 1 : phase);
      const random = crypto.randomBytes;
      let generated = 0;
      crypto.randomBytes = (() => {
        generated++;
        throw new Error("unexpected_generation");
      }) as typeof crypto.randomBytes;
      let result: KeyExchangeResult;
      try {
        result = exchangeCredentialsFromHost(
          f.root,
          saved.revision,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        );
      } finally {
        crypto.randomBytes = random;
      }
      assert.equal(result.status, "unavailable");
      assert.equal(generated, 0);
      assert.deepEqual(fs.readFileSync(current), before);
      assert.equal(
        fs.existsSync(path.join(f.directory, "access-management.lock")),
        false,
      );
      if (timing === "before") {
        assert.equal(
          fs.existsSync(
            path.join(f.directory, "access-management.pending.json"),
          ),
          true,
        );
        assert.equal(
          fs.existsSync(
            path.join(f.directory, "access-management.replace.json"),
          ),
          true,
        );
      } else {
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
        const resumed = exchangeCredentialsFromHost(
          f.root,
          saved.revision,
          operationId,
          "targeted",
          target.userId,
          [target.credentialId],
          true,
        );
        assert.equal(resumed.status, "completed");
        if (resumed.status === "completed") {
          assert.equal(
            resumed.recoveryId,
            `access-management.key-exchange.${operationId}`,
          );
          if (phase === 3) assert.equal(resumed.token, null);
        }
      }
    }
});

/**
 * 二Processの同一／別交換要求を既存Lockで競合させる。
 * @responsibility 同一受付の重複生成と別対象への暗黙拡張を拒否する。
 * @trace RFD-IT-017
 * @precondition 同じRoot・期待改訂の現在管理資格。
 * @stimulus 同ID指定同士、別ID指定同士、全員と指定を同時開始する。
 * @observation 両close、非秘密結果、生成回数、改訂・資格・未解決record。
 * @oracle 一保存だけ、敗者生成0、新資格一件・record一件、対象外保持。
 * @cleanup 全子closeのjoin後にFixture回収。
 * @boundary 実Processと同じFilesystem Lock。
 */
test("鍵交換保存は二Processの同一と別対象競合を一採用へ閉じる", async (t) => {
  for (const mode of ["same", "different", "all_targeted"] as const) {
    const f = managementFixture(t);
    const userId = f.state.users[0]?.userId;
    assert.ok(userId);
    const worker = path.resolve(
      import.meta.dirname,
      "../../fixtures/credential-management-worker.ts",
    );
    const joined = await Promise.allSettled(
      [0, 1].map(
        (index) =>
          new Promise<{ status: string; generated: number }>(
            (resolve, reject) => {
              const child = spawn(process.execPath, [worker], {
                timeout: 10000,
              });
              let output = "";
              let childFailed = false;
              let inputFailed = false;
              child.stdout.on("data", (chunk) => {
                output += String(chunk);
              });
              child.stderr.resume();
              child.on("error", () => {
                childFailed = true;
              });
              child.stdin.on("error", () => {
                inputFailed = true;
              });
              const scope =
                mode === "all_targeted" && index === 0 ? "all" : "targeted";
              const recipientUserId =
                mode === "different" && index === 1
                  ? (f.state.users[1]?.userId ?? "")
                  : userId;
              child.stdin.end(
                JSON.stringify({
                  directory: f.directory,
                  token: f.tokens.administrator,
                  operationId: `00000000-0000-4000-8000-00000000009${mode === "same" ? 0 : index}`,
                  userId: recipientUserId,
                  credentialId: "",
                  operation: "exchange",
                  scope,
                  displayedOldCredentialIds: f.state.credentials
                    .filter(
                      (c) => scope === "all" || c.userId === recipientUserId,
                    )
                    .map((c) => c.credentialId),
                }),
              );
              child.on("close", (code, signal) => {
                if (code !== 0 || childFailed || inputFailed)
                  reject(new Error(`child_failed:${code}:${signal}`));
                else {
                  try {
                    resolve(JSON.parse(output));
                  } catch {
                    reject(new Error("child_result_invalid"));
                  }
                }
              });
            },
          ),
      ),
    );
    const results = joined.map((result) => {
      assert.equal(result.status, "fulfilled");
      if (result.status !== "fulfilled") throw new Error("child_join_failed");
      return result.value;
    });
    assert.equal(
      results.filter((result) => result.status === "completed").length,
      1,
    );
    for (const result of results)
      assert.equal(result.generated, result.status === "completed" ? 3 : 0);
    const saved = JSON.parse(
      fs.readFileSync(path.join(f.directory, "access-management.json"), "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.revision, 4);
    assert.equal(saved.credentials.length, 4);
    assert.equal(saved.unresolvedKeyExchanges.length, 1);
    assert.deepEqual(saved.users, f.state.users);
    assert.deepEqual(saved.initialization, f.state.initialization);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});
