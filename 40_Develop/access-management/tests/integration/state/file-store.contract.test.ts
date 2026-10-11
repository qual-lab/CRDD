/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @trace RFD-IT-013
 * @trace RFD-IT-001
 * @trace RFD-IT-002
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常User／Role認可。実Host・通常鍵処置・Surfaceは対象外。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto, { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";
import {
  createFilesystemStoreRoot,
  type FilesystemStoreRoot,
} from "../../../../domain-model/src/index.ts";
import {
  type AccessManagementState,
  type UserRoleManagementResult,
  registerRepository,
  unregisterRepository,
  updateExposure,
  authenticateCredential,
  readCurrentAccess,
  readManagementState,
  resolveRepositoryAccess,
  createCredentialMaterial,
  registerUser,
  updateUserName,
  changeUserRole,
  updateRoleContentAccess,
  createInitialAdministrator,
  createInitialCredential,
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
    schemaRevision: 1,
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
      delivery: "confirmed",
      receipt: "confirmed",
      normalConnection: "confirmed",
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
    delivery: "confirmed",
    receipt: "confirmed",
    normalConnection: "confirmed",
  };
  credential.delivery = "confirmed";
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
      delivery: "confirmed",
      receipt: "confirmed",
      normalConnection: "confirmed",
    };
    credential.delivery = "confirmed";
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
    assert.equal(credential.delivery, "not_attempted");
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
      delivery: "confirmed",
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
      role === "developer" ? 0 : role === "manager" ? 14 : 24,
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
        new Promise<string>((resolve, reject) => {
          const child = spawn(
            process.execPath,
            [
              "--eval",
              `import {createFilesystemStoreRoot} from ${JSON.stringify(domainUrl)}; import {createInitialAdministrator} from ${JSON.stringify(storeUrl)}; console.log(JSON.stringify(createInitialAdministrator(createFilesystemStoreRoot(${JSON.stringify(f.directory)}),${JSON.stringify(attempt)},${JSON.stringify(name)})));`,
            ],
            { timeout: 10000 },
          );
          let output = "";
          child.stdout.on("data", (data) => {
            output += String(data);
          });
          child.on("error", reject);
          child.on("close", (code) => {
            if (code === 0) resolve(output);
            else reject(new Error("child_failed"));
          });
        }),
    ),
  );
  const results = joined.map((result) => {
    assert.equal(result.status, "fulfilled");
    if (result.status !== "fulfilled") throw new Error("child_failed");
    return JSON.parse(result.value);
  });
  assert.equal(
    results.filter(
      (result) => result.status === "completed" && result.value.created,
    ).length,
    1,
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
    delivery: "confirmed",
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
