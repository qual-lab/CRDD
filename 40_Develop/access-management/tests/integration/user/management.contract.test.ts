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
import { readManagementStateSnapshot as readManagementState } from "../../../src/authorization/management.ts";
import { authenticateCredential } from "../../../src/credential/authentication.ts";
import { createCredentialMaterial } from "../../../src/credential/token.ts";
import { evaluateAiProfileManagementPermission } from "../../../src/index.ts";
import { createInitialCredential } from "../../../src/initialization/execution.ts";
import {
  saveUserRole as updateUserRole,
  saveRoleContentAccess as updateRoleContentAccess,
} from "../../../src/role/assign.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import {
  saveUserRegistration as registerUser,
  saveUserName as updateUserName,
} from "../../../src/user/crud.ts";
import {
  bytes,
  fixture,
  managementFixture,
  prepare,
  prepareInitialUser,
} from "../storage/fixture.ts";

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
      evaluateAiProfileManagementPermission(f.root, f.tokens[role]),
      role === "developer" ? "denied" : "allowed",
    );
  assert.deepEqual(fs.readFileSync(current), original);
  const manager = f.state.users.find((user) => user.role === "manager");
  assert.ok(manager);
  manager.role = "developer";
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    evaluateAiProfileManagementPermission(f.root, f.tokens.manager),
    "denied",
  );
  manager.role = "administrator";
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    evaluateAiProfileManagementPermission(f.root, f.tokens.manager),
    "allowed",
  );
  const credential = f.state.credentials.find(
    (item) => item.userId === manager.userId,
  );
  assert.ok(credential);
  credential.revoked = true;
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    evaluateAiProfileManagementPermission(f.root, f.tokens.manager),
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
    evaluateAiProfileManagementPermission(f.root, f.tokens.manager),
    "unavailable",
  );
  assert.equal(
    evaluateAiProfileManagementPermission(f.root, "invalid"),
    "unavailable",
  );
  fs.writeFileSync(current, "{}");
  assert.equal(
    evaluateAiProfileManagementPermission(f.root, f.tokens.manager),
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
            updateUserRole(
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
