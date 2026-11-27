/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import crypto, { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  readManagementState,
  readManagementStateSnapshot,
  readManagementUsersForDisplay,
} from "../../../src/authorization/management.ts";
import { describeManagementPermissions } from "../../../src/permission/validation.ts";
import { saveUserRole } from "../../../src/role/assign.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import { saveUserName } from "../../../src/user/crud.ts";
import {
  bytes,
  managementFixture,
  observeFixtureDirectory,
  prepare,
  saveUserRegistrationFixture,
  removeKnownStoppedTestLock,
} from "../storage/fixture.ts";

test("管理画面には操作許可を同じ改訂で返し、通常一覧には加えない", (t) => {
  const f = managementFixture(t);
  const newUser = {
    userId: crypto.randomUUID(),
    username: "未紐付け",
    role: "developer" as const,
  };
  f.state.users.push(newUser);
  fs.writeFileSync(
    path.join(f.directory, "access-management.json"),
    bytes(f.state),
  );
  assert.equal(describeManagementPermissions("developer").openSession, false);
  assert.deepEqual(describeManagementPermissions("manager").registerRoles, [
    "developer",
    "manager",
  ]);
  const manager = readManagementUsersForDisplay(f.root, f.principals.manager);
  const administrator = readManagementUsersForDisplay(
    f.root,
    f.principals.administrator,
  );
  assert.ok(
    manager.status === "completed" && "users" in manager && manager.users,
  );
  assert.ok(
    administrator.status === "completed" &&
      "users" in administrator &&
      administrator.users,
  );
  assert.equal(administrator.revision, manager.revision);
  assert.ok(!manager.users.some(({ role }) => role === "administrator"));
  for (const [view, canRenew] of [
    [manager, false],
    [administrator, true],
  ] as const) {
    const pending = view.users.find(({ userId }) => userId === newUser.userId);
    assert.deepEqual(pending && "actions" in pending && pending.actions, {
      rename: true,
      changeRoles: canRenew ? ["manager", "administrator"] : ["manager"],
      renewInvitation: canRenew,
    });
    const linked = view.users.find(
      ({ userId }) => userId === f.principals.developer.userId,
    );
    assert.ok(linked && "actions" in linked && linked.actions);
    assert.equal(linked.actions.renewInvitation, false);
  }
  const ordinary = readManagementState(
    f.root,
    f.principals.administrator,
    "users",
  );
  assert.ok(
    ordinary.status === "completed" && "users" in ordinary && ordinary.users,
  );
  assert.ok(ordinary.users.every((user) => !Object.hasOwn(user, "actions")));
});

/**
 * 二つの管理対象のRole別表示を完全なDTOへ照合する。
 * @responsibility 管理対象間の情報混在と登録・公開の混同を拒否する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @precondition 三Role資格と設定なし・空・二範囲の登録を自己生成Rootへ保存する。
 * @stimulus 三Roleで二つの管理対象を読み、Role変更後に次要求を実行する。
 * @observation 同改訂の全field・全行・凍結・current bytes。
 * @oracle manager・adminは許可された一覧だけ、developerは全拒否。Root・資格・種類外情報0。
 * @cleanup Fixtureが自己生成Rootを回収する。
 * @boundary 管理読取り公開Root→現在認証・対象認可→保存・DTO。
 */
test("管理readは利用者と登録済みリポジトリの現在一覧だけを返す", (t) => {
  const f = managementFixture(t);
  for (const id of ["unset", "empty", "both"]) {
    const root = path.resolve(f.directory, id);
    const normalized = process.platform === "win32" ? root.toLowerCase() : root;
    f.state.registeredRepositories.push({
      repositoryId: id,
      repositoryRoot: root,
      hostedRepository: observeFixtureDirectory(root).hostedRepository,
      bindingId: `binding-${createHash("sha256").update(`${id}\n${normalized}`).digest("hex").slice(0, 32)}`,
    });
  }
  const current = path.join(f.directory, "access-management.json");
  assert.equal(parseAccessManagementState(bytes(f.state)).status, "parsed");
  fs.writeFileSync(current, bytes(f.state));
  const before = fs.readFileSync(current);
  for (const role of ["developer", "manager", "administrator"] as const) {
    for (const kind of ["users", "registeredRepositories"] as const) {
      const result = readManagementStateSnapshot(
        f.root,
        f.principals[role],
        kind,
      );
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
      assert.equal(dto.revision, 2);
      assert.equal(dto.kind, kind);
      switch (dto.kind) {
        case "users":
          assert.deepEqual(Object.keys(dto).sort(), [
            "kind",
            "revision",
            "users",
          ]);
          assert.deepEqual(
            dto.users,
            f.state.users
              .filter(
                (user) =>
                  role === "administrator" || user.role !== "administrator",
              )
              .map(({ userId, username, role }) => ({
                userId,
                username,
                role,
              })),
          );
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
  assert.deepEqual(
    readManagementStateSnapshot(f.root, f.principals.manager, "users"),
    {
      status: "unavailable",
      reason: "management_state_read_rejected",
    },
  );
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
    "roleContentAccess",
    "exposure",
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
    assert.deepEqual(
      readManagementStateSnapshot(f.root, f.principals.manager, kind),
      {
        status: "unavailable",
        reason: "management_state_read_rejected",
      },
    );
  assert.equal(opened, 0);
  assert.equal(converted, 0);
  fs.openSync = open;
  assert.deepEqual(
    readManagementStateSnapshot(f.root, "invalid-principal" as never, "users"),
    {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    },
  );
  assert.deepEqual(
    readManagementStateSnapshot(f.root, f.principals.developer, "users"),
    {
      status: "unavailable",
      reason: "management_state_read_rejected",
    },
  );
  assert.equal(fs.readFileSync(pending, "utf8"), "{");
  assert.deepEqual(
    readManagementStateSnapshot(f.root, f.principals.manager, "users"),
    {
      status: "unavailable",
      reason: "management_state_cleanup_pending",
    },
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
    removeKnownStoppedTestLock(f.directory, process.pid);
  });
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.pending.json"))
      throw new Error("injected");
    return remove(target, options);
  };
  assert.deepEqual(
    readManagementStateSnapshot(
      f.root,
      f.principals.manager,
      "registeredRepositories",
    ),
    {
      status: "unavailable",
      reason: "management_state_cleanup_pending",
    },
  );
  fs.rmSync = remove;
  removeKnownStoppedTestLock(f.directory, process.pid);
  assert.deepEqual(
    readManagementStateSnapshot(
      f.root,
      f.principals.manager,
      "registeredRepositories",
    ),
    {
      status: "completed",
      snapshot: {
        revision: 2,
        kind: "registeredRepositories",
        repositories: [],
      },
    },
  );
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.state.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  assert.deepEqual(
    readManagementStateSnapshot(f.root, f.principals.manager, "users"),
    {
      status: "unavailable",
      reason: "management_state_release_unknown",
    },
  );
  fs.rmSync = remove;
  removeKnownStoppedTestLock(f.directory, process.pid);
  assert.equal(
    readManagementStateSnapshot(f.root, f.principals.manager, "users").status,
    "completed",
  );
  fs.writeFileSync(path.join(f.directory, "access-management.json"), "{");
  assert.deepEqual(
    readManagementStateSnapshot(
      f.root,
      f.principals.manager,
      "registeredRepositories",
    ),
    {
      status: "unavailable",
      reason: "management_state_observation_unknown",
    },
  );
});

/**
 * 三Role・対象三Role・ユーザー管理3操作の実保存分担を全数確認する。
 * @responsibility 純粋判定だけでなく現在資格から保存までの27組を照合する。
 * @trace RFD-IT-021
 * @precondition 三Role資格の自己生成Store。
 * @stimulus 各組の前状態を復元し登録・名前変更・Role変更を呼ぶ。
 * @observation completed／固定拒否、current差分、改訂、対象外集合、材料不存在。
 * @oracle developer全拒否、managerはadministrator登録・表示名変更・Role変更を拒否、administratorは全許可。
 * @cleanup FixtureがRoot不存在を確認する。
 * @boundary 現在の資格とRoleによる認可から実保存まで。
 */
test("三Roleと対象三Roleのユーザー管理は27組の保存分担を守る", (t) => {
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
            saveUserRegistrationFixture(
              f.root,
              f.principals[actorRole],
              2,
              operationId,
              "登録",
              target.role,
            ),
        },
        {
          requiresAdministrator: target.role === "administrator",
          invoke: () =>
            saveUserName(
              f.root,
              f.principals[actorRole],
              2,
              operationId,
              target.userId,
              "変更",
            ),
        },
        {
          requiresAdministrator: target.role === "administrator",
          invoke: () =>
            saveUserRole(
              f.root,
              f.principals[actorRole],
              2,
              operationId,
              target.userId,
              target.role,
              target.role === "developer" ? "manager" : "developer",
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
          assert.equal(saved.revision, 3);
          for (const field of [
            "initialization",
            "registeredRepositories",
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
