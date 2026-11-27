/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @trace RFD-IT-019
 * @trace RFD-IT-021
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem、既存の保存Root・ロック、管理状態の保存と再入場。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  onAccessStatePublication,
  readCurrentAccess,
  readHostedAccessCandidates,
} from "../../../src/index.ts";
import { saveRepositoryRemoval } from "../../../src/repository/register.ts";
import { saveUserRole } from "../../../src/role/assign.ts";
import { locked } from "../../../src/storage/lock.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import {
  readAccessManagementState,
  readCurrent,
  updateAccessManagementState,
} from "../../../src/storage/store.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import { saveUserName } from "../../../src/user/crud.ts";
import type { UserRoleManagementResult } from "../../../src/user/types.ts";
import {
  bytes,
  contentFixture,
  fixture,
  hostedContentFixture,
  managementFixture,
  prepare,
  saveUserRegistrationFixture,
  seedRetiredInitialCredential,
  removeKnownStoppedTestLock,
} from "./fixture.ts";

test("管理状態を置換した後の通知は排他外で再観測でき、購読解除や他Rootへ漏れない", async (t) => {
  const f = hostedContentFixture(t);
  const other = hostedContentFixture(t);
  const id = f.target.manifest.repositoryId;
  const observations: string[] = [];
  const read = () => {
    const result = locked(f.root, () => {
      const { state } = readCurrent(f.root);
      return {
        status: "completed" as const,
        value: state.registeredRepositories.some(
          ({ repositoryId }) => repositoryId === id,
        ),
        revision: state.revision,
        cleanupConfirmed: true as const,
        publication: "not_attempted" as const,
      };
    });
    observations.push(
      result.status === "completed" && !result.value
        ? "registration_removed"
        : "unexpected_registration_observation",
    );
    return undefined;
  };
  const releaseFaulty = onAccessStatePublication(f.root, () => {
    throw new Error("independent_notification_failure");
  });
  const releaseOld = onAccessStatePublication(f.root, read);
  const releaseCurrent = onAccessStatePublication(f.root, read);
  const releaseOther = onAccessStatePublication(other.root, () => {
    observations.push("unexpected_other_root");
    return undefined;
  });
  try {
    assert.equal(
      saveRepositoryRemoval(
        f.root,
        f.principals.manager,
        f.state.revision - 1,
        crypto.randomUUID(),
        id,
      ).status,
      "unavailable",
    );
    await Promise.resolve();
    assert.deepEqual(observations, []);
    const rename = fs.renameSync;
    const interrupted = t.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof rename>) => {
        rename(...args);
        throw new Error("publication_result_unknown");
      },
    );
    try {
      assert.equal(
        saveRepositoryRemoval(
          f.root,
          f.principals.manager,
          f.state.revision,
          crypto.randomUUID(),
          id,
        ).status,
        "unavailable",
      );
      assert.deepEqual(observations, []);
      releaseOld();
    } finally {
      interrupted.mock.restore();
    }
    await Promise.resolve();
    assert.deepEqual(observations, ["registration_removed"]);
    assert.equal(
      readHostedAccessCandidates(f.root, f.principal).status,
      "unavailable",
    );
  } finally {
    releaseCurrent();
    releaseOld();
    releaseOther();
    releaseFaulty();
  }
});

/**
 * ユーザー管理の成功と変更対象の閉包を確認する。
 * @responsibility managerの通常許可と現在Role反映を実保存で検証する。
 * @trace RFD-IT-021
 * @precondition 三Role資格と完了初回の自己生成Store。
 * @stimulus 登録・admin名前変更・dev/manager Role変更を行う。
 * @observation 保存結果・完全byte・対象外field・次認証・所有材料不存在。
 * @oracle 各処置は一改訂、資格・初回・Repository登録・Exposure・交換は不変、内容0でも固定管理可。
 * @cleanup Fixtureが全Rootを削除し不存在確認する。
 * @boundary 公開管理API→現在認可→実Filesystem保存。
 */
test("通常のユーザー管理は現在認可で対象項目だけを保存する", (t) => {
  const f = managementFixture(t);
  const currentPath = path.join(f.directory, "access-management.json");
  const protectedFields = {
    initialization: f.state.initialization,
    registeredRepositories: f.state.registeredRepositories,
  };
  const manager = f.state.users[1];
  const developer = f.state.users[2];
  const administrator = f.state.users[0];
  assert.ok(manager && developer && administrator);
  let revision = 2;
  const operations = [
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        revision,
        crypto.randomUUID(),
        "追加",
        "developer",
      ),
    () =>
      saveUserName(
        f.root,
        f.principals.administrator,
        revision,
        crypto.randomUUID(),
        administrator.userId,
        "名前だけ変更",
      ),
    () =>
      saveUserRole(
        f.root,
        f.principals.manager,
        revision,
        crypto.randomUUID(),
        developer.userId,
        "developer",
        "manager",
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
  const next = readCurrentAccess(f.root, f.principals.developer);
  assert.equal(next.status, "completed");
  if (next.status === "completed") assert.equal(next.user.role, "manager");
  const name = readCurrentAccess(f.root, f.principals.administrator);
  assert.equal(name.status, "completed");
  if (name.status === "completed")
    assert.equal(name.user.username, "名前だけ変更");
  assert.equal(
    saveUserRegistrationFixture(
      f.root,
      f.principals.manager,
      revision,
      crypto.randomUUID(),
      "内容権限なしでも管理",
      "manager",
    ).status,
    "completed",
  );
});

/**
 * 通常管理の拒否を保存不明へ変換しない。
 * @responsibility 非開示拒否・現在Role・入力境界・UUID非生成を確認する。
 * @trace RFD-IT-021
 * @precondition 三Role資格の自己生成Store。
 * @stimulus 禁止対象、誤鍵、競合、不正値、途中初回を入力する。
 * @observation 固定結果・current完全byte・UUID件数・材料不存在。
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
  const operations = [
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.developer,
        2,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        2,
        operationId,
        "名前",
        "administrator",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        "invalid" as never,
        2,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        0,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        3,
        operationId,
        "名前",
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        2,
        "invalid",
        "名前",
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        2,
        operationId,
        " 名前",
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        2,
        operationId,
        "x".repeat(129),
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        2,
        operationId,
        "x".repeat(2_000_000),
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        2,
        operationId,
        "a\u0000",
        "developer",
      ),
    () =>
      saveUserRegistrationFixture(
        f.root,
        f.principals.manager,
        2,
        operationId,
        "a",
        "management",
      ),
    () =>
      saveUserName(
        f.root,
        f.principals.manager,
        2,
        operationId,
        "missing",
        "名前",
      ),
    () =>
      saveUserRole(
        f.root,
        f.principals.manager,
        2,
        operationId,
        administrator.userId,
        "administrator",
        "developer",
      ),
    () =>
      saveUserRole(
        f.root,
        f.principals.manager,
        2,
        operationId,
        administrator.userId,
        "developer",
        "manager",
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
  const revoked = structuredClone(f.state);
  const manager = revoked.users.find((entry) => entry.role === "manager");
  assert.ok(manager);
  delete manager.accountLinks;
  fs.writeFileSync(currentPath, bytes(revoked));
  assert.deepEqual(
    saveUserRegistrationFixture(
      f.root,
      f.principals.manager,
      2,
      operationId,
      "名前",
      "developer",
    ),
    { status: "unavailable", reason: "management_operation_rejected" },
  );
  assert.deepEqual(fs.readFileSync(currentPath), bytes(revoked));
  const initial = fixture(t);
  const issued = seedRetiredInitialCredential(initial);
  {
    const initialPath = path.join(initial.directory, "access-management.json");
    const saved = fs.readFileSync(initialPath);
    assert.deepEqual(
      saveUserRegistrationFixture(
        initial.root,
        issued.token as never,
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
          saveUserRegistrationFixture(
            f.root,
            "invalid" as never,
            current.revision,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          saveUserRegistrationFixture(
            f.root,
            f.principals.developer,
            current.revision,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          saveUserRegistrationFixture(
            f.root,
            f.principals.manager,
            current.revision + 1,
            operationId,
            "名前",
            "developer",
          ),
        () =>
          saveUserRole(
            f.root,
            f.principals.manager,
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
  next.revision = 3;
  next.operationId = "00000000-0000-4000-8000-000000000091";
  prepare(f, next);
  assert.deepEqual(
    saveUserName(
      f.root,
      f.principals.administrator,
      2,
      operationId,
      administrator.userId,
      "更新",
    ),
    {
      status: "unavailable",
      reason: "management_operation_unavailable",
      primaryFailure: "state_store_previous_pending_settled",
      operationId,
      expectedRevision: 2,
      observedRevision: 2,
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
    const collision = saveUserRegistrationFixture(
      f.root,
      f.principals.manager,
      2,
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
    const failed = saveUserName(
      f.root,
      f.principals.administrator,
      2,
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
    "access-management.state.lock",
  ]) {
    fs.writeFileSync(currentPath, bytes(f.state));
    fs.rmSync = (target, options) => {
      if (String(target).endsWith(suffix)) throw new Error("injected");
      return originalRm(target, options);
    };

    try {
      const failed = saveUserName(
        f.root,
        f.principals.administrator,
        2,
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
        assert.equal(failed.observedRevision, 3);
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
    if (suffix === "access-management.state.lock") {
      assert.equal(readAccessManagementState(f.root).status, "unavailable");
      removeKnownStoppedTestLock(f.directory, process.pid);
    }
    assert.equal(readAccessManagementState(f.root).status, "completed");
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  }
});

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
 * @stimulus 巨大な不正JSON bytes、改訂再利用、初回事実・資格・未解決交換・既存User IDの変更を返す。
 * @observation 状態byte・改訂・結果・材料不存在を別に確認する。
 * @oracle current不変・pending/replace不存在。
 * @cleanup Repository-localな自己生成試験Rootを削除し不存在を確認する。
 * @boundary Node FilesystemとAM内部保存Ownerの直接境界。
 */
test("不正JSON・不正候補・対象外変更は出版しない", (t) => {
  const f = fixture(t);
  f.state.users.push({
    userId: "00000000-0000-4000-8000-000000000009",
    username: "模擬開発者",
    role: "developer",
  });
  const administrator = f.state.users[0];
  assert.ok(administrator);
  f.state.revision = 2;
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  const before = fs.readFileSync(
    path.join(f.directory, "access-management.json"),
  );
  const bad = structuredClone(f.state);
  bad.revision = 3;
  bad.operationId = "00000000-0000-4000-8000-000000000005";
  bad.initialization.attemptId = bad.operationId;
  const account = structuredClone(bad);
  account.initialization = structuredClone(f.state.initialization);
  const linked = account.users[0]?.accountLinks?.[0];
  assert.ok(linked);
  linked.subject = "different-subject";
  const removedUser = structuredClone(account);
  removedUser.users[0] = structuredClone(administrator);
  removedUser.users.pop();
  for (const protectedChange of [bad, account, removedUser]) {
    assert.equal(
      parseAccessManagementState(bytes(protectedChange)).status,
      "parsed",
    );
  }
  for (const candidate of [
    Buffer.alloc(16_777_217),
    bytes(f.state),
    bytes(bad),
    bytes(account),
    bytes(removedUser),
  ]) {
    assert.equal(
      updateAccessManagementState(f.root, f.state.revision, () => candidate)
        .status,
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

/** 旧範囲の更新は通常出版・保存途中からの再入場のどちらでも採用しない。 */
test("退役した内容・公開範囲の変更と旧保存材料を採用しない", (t) => {
  for (const change of ["role", "exposure"] as const) {
    const f = contentFixture(t);
    const base = readCurrent(f.root).state;
    const next = structuredClone(base);
    next.revision++;
    next.operationId = crypto.randomUUID();
    if (change === "role") {
      Object.assign(next, { roleContentAccess: [] });
    } else {
      Object.assign(next, { exposure: [] });
    }
    assert.equal(parseAccessManagementState(bytes(next)).status, "invalid");
    const leaf = [
      "access-management.json",
      "access-management.pending.json",
      "access-management.replace.json",
    ].map((name) => path.join(f.directory, name));
    assert.equal(
      updateAccessManagementState(f.root, base.revision, () => bytes(next))
        .status,
      "unavailable",
    );
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    assert.deepEqual(readCurrent(f.root).bytes, bytes(base));

    prepare({ ...f, state: base }, next);
    const before = leaf.map((file) => fs.readFileSync(file));
    let calls = 0;
    const result = updateAccessManagementState(f.root, base.revision, () => {
      calls++;
      return bytes(next);
    });
    assert.equal(result.status, "unavailable");
    assert.equal(calls, 0);
    assert.deepEqual(
      leaf.map((file) => fs.readFileSync(file)),
      before,
    );
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
  prepare(f, next, "management", false);
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

for (const kind of ["credential", "initialization"] as const) {
  test(`退役した保存材料（${kind}）は現在値との一致にかかわらず保持して停止する`, (t) => {
    for (const stage of ["base", "published"]) {
      const f = fixture(t);
      const next = structuredClone(f.state);
      next.revision++;
      next.operationId = crypto.randomUUID();
      prepare(f, next, kind);
      const current = path.join(f.directory, "access-management.json");
      if (stage === "published") fs.writeFileSync(current, bytes(next));
      const filenames = fs.readdirSync(f.directory);
      const snapshots = filenames.map((file) =>
        fs.readFileSync(path.join(f.directory, file)),
      );
      const read = readAccessManagementState(f.root);
      assert.equal(read.status, "unavailable");
      assert.equal(read.publication, "not_attempted");
      const update = updateAccessManagementState(
        f.root,
        stage === "published" ? next.revision : f.state.revision,
        () => assert.fail("retired_material_must_not_start_a_write"),
      );
      assert.equal(update.status, "unavailable");
      assert.equal(update.publication, "not_attempted");
      assert.deepEqual(fs.readdirSync(f.directory), filenames);
      assert.deepEqual(
        filenames.map((file) => fs.readFileSync(path.join(f.directory, file))),
        snapshots,
      );
    }
  });
}

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
 * @responsibility 実Process終了・残存による停止・全試験利用者停止下の明示処置・base/nextの再観測を接続する。
 * @trace RFD-IT-021
 * @precondition Repository-localな模擬状態と実子Processだけを使用する。
 * @stimulus pending flush後、replace flush後、rename後でexit(23)する。
 * @observation 終了code、残存材料、次読取りの改訂と清掃を確認する。
 * @oracle 残存で一度停止し、自動回復0。明示処置後も前二者は改訂1、後者は改訂2を保持。子Processはjoin済み。
 * @cleanup 自己生成Rootと所有材料を削除し不存在を確認する。
 * @boundary Node子Process・Filesystem・既存Lockの直接保存境界。
 */
test("実子Process喪失後にbase/nextとLockを再観測する", (t) => {
  for (const phase of ["pending", "replace", "renamed"]) {
    const f = fixture(t);
    const domainUrl = new URL(
      "../../../src/initialization/root.ts",
      import.meta.url,
    ).href;
    const storeUrl = new URL("../../../src/storage/store.ts", import.meta.url)
      .href;
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
    const retained = fs.readFileSync(
      path.join(f.directory, "access-management.state.lock"),
    );
    assert.equal(readAccessManagementState(f.root).status, "unavailable");
    assert.deepEqual(
      fs.readFileSync(path.join(f.directory, "access-management.state.lock")),
      retained,
    );
    assert.ok(child.pid);
    removeKnownStoppedTestLock(f.directory, child.pid);
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
 * @oracle 候補不正を保持・出版0・解放未確認。復元後も残存で停止し、試験所有物の明示処置後だけ読み直せる。
 * @cleanup 差替えを復元し自己生成Rootを削除する。
 * @boundary AM保存結果と既存Lock回収の直接境界。
 */
test("主失敗をLock清掃失敗で上書きしない", (t) => {
  const f = fixture(t);
  const remove = fs.rmSync;
  t.after(() => {
    fs.rmSync = remove;
  });
  fs.rmSync = (target) => {
    if (String(target).endsWith("access-management.state.lock"))
      throw new Error("injected");
    return remove(target);
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
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  removeKnownStoppedTestLock(f.directory, process.pid);
  assert.equal(readAccessManagementState(f.root).status, "completed");
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});
