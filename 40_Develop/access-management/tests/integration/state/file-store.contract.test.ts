/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-021
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock。実Host・鍵発行・認可は対象外。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";
import {
  createFilesystemStoreRoot,
  type FilesystemStoreRoot,
} from "../../../../domain-model/src/index.ts";
import {
  type AccessManagementState,
  parseAccessManagementState,
  readAccessManagementState,
  updateAccessManagementState,
} from "../../../src/index.ts";

/**
 * 完了済み初回記録を持つ模擬現在状態を作る。
 * @responsibility 現在Userと歴史的資格IDを分ける。
 * @trace RFD-IT-021
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
 * 非秘密fixtureを固定byte化する。
 * @responsibility Source serializerから独立した期待byteを構築する。
 * @trace RFD-IT-021
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
