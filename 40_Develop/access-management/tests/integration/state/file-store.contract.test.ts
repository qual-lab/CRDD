/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @trace RFD-IT-013
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
  authenticateCredential,
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
