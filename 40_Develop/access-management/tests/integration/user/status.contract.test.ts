/**
 * ユーザー有効状態の現在取得と非開示境界を検証する。
 * @packageDocumentation
 * @responsibility 現在の判定方法を鍵一覧APIへ漏らさず、確認不能と無効を分ける。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @level IT
 * @scope 自己生成のAM保存・現在認証・既存ユーザー閲覧範囲。
 * @boundary 合成資格とFilesystem。実Host・MCP・Browser・外部AIなし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { readUserStatus } from "../../../src/index.ts";
import { parseAccessManagementState } from "../../../src/storage/parse.ts";
import { createInitialCredential } from "../../../src/initialization/execution.ts";
import {
  bytes,
  managementFixture,
  prepareInitialUser,
} from "../storage/fixture.ts";

const unavailable = {
  status: "unavailable",
  reason: "user_status_unavailable",
};

/**
 * 鍵0件・全失効・混在をユーザー状態へ導出する。
 * @responsibility 鍵数や提示状態をAPIへ漏らさず現在状態を判定する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 三Roleの合成管理状態を使う。
 * @stimulus 同じ対象の非失効鍵を2件、1件、0件とし、未提示と資格自体の不存在も与える。
 * @observation 同改訂のenabledと現在値byteの不変。
 * @oracle 非失効鍵が残る間だけtrue、0件はfalseで、Secret・資格情報は返さない。
 * @cleanup Fixtureが自己生成Rootだけを回収する。
 * @boundary Package API→実保存読取り。
 */
test("ユーザー状態は非失効鍵の有無から導出し提示状態や鍵詳細を返さない", (t) => {
  const f = managementFixture(t);
  const target =
    f.state.users.find((user) => user.role === "developer") ??
    assert.fail("developer_fixture_missing");
  const administratorId = (
    f.state.users[0] ?? assert.fail("admin_fixture_missing")
  ).userId;
  const keys = f.state.credentials.filter(
    (item) => item.userId !== administratorId,
  );
  for (const item of keys) {
    item.userId = target.userId;
    item.presentation = "unconfirmed";
  }
  const current = path.join(f.directory, "access-management.json");
  for (const count of [2, 1, 0]) {
    keys.forEach((item, index) => {
      item.revoked = index >= count;
    });
    const before = bytes(f.state);
    fs.writeFileSync(current, before);
    assert.deepEqual(
      readUserStatus(f.root, f.tokens.administrator, target.userId),
      {
        status: "completed",
        revision: f.state.revision,
        userId: target.userId,
        enabled: count > 0,
      },
    );
    assert.deepEqual(fs.readFileSync(current), before);
  }
  f.state.credentials = f.state.credentials.filter(
    (item) => item.userId !== target.userId,
  );
  fs.writeFileSync(current, bytes(f.state));
  assert.equal(
    readUserStatus(f.root, f.tokens.administrator, target.userId).status,
    "completed",
  );
  assert.deepEqual(
    readUserStatus(f.root, f.tokens.administrator, target.userId),
    {
      status: "completed",
      revision: f.state.revision,
      userId: target.userId,
      enabled: false,
    },
  );
});

/**
 * 既存ユーザー閲覧範囲と初回・認証境界を維持する。
 * @responsibility 不在・不可視・失効・初回途中を無効ユーザーへ変換しない。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 三Roleと合成資格を持つ現在状態。
 * @stimulus manager/developer、未知ID、失効Actor、初回途中を順に照会する。
 * @observation 許可された対象だけcompleted、その他は同じ非開示unavailable。
 * @oracle 対象存在・Role・鍵数を拒否結果から判別できない。
 * @cleanup FixtureがRootを回収する。
 * @boundary 現在認証→既存管理可視集合→ユーザー状態。
 */
test("ユーザー状態取得は既存の管理閲覧範囲を広げない", (t) => {
  const f = managementFixture(t);
  const admin =
    f.state.users.find((user) => user.role === "administrator") ??
    assert.fail("admin_fixture_missing");
  const dev =
    f.state.users.find((user) => user.role === "developer") ??
    assert.fail("developer_fixture_missing");
  assert.equal(
    readUserStatus(f.root, f.tokens.manager, dev.userId).status,
    "completed",
  );
  assert.equal(
    readUserStatus(f.root, f.tokens.manager, admin.userId).status,
    "completed",
  );
  assert.deepEqual(
    readUserStatus(f.root, f.tokens.developer, dev.userId),
    unavailable,
  );
  assert.deepEqual(
    readUserStatus(
      f.root,
      f.tokens.administrator,
      "00000000-0000-4000-8000-000000000999",
    ),
    unavailable,
  );
  const current = path.join(f.directory, "access-management.json");
  const adminCredential =
    f.state.credentials.find((item) => item.userId === admin.userId) ??
    assert.fail("credential_fixture_missing");
  adminCredential.revoked = true;
  fs.writeFileSync(current, bytes(f.state));
  assert.deepEqual(
    readUserStatus(f.root, f.tokens.administrator, dev.userId),
    unavailable,
  );
  const issued = createInitialCredential(f.root, prepareInitialUser(f));
  if (issued.status !== "completed" || !issued.value.token)
    assert.fail("initial_fixture_unavailable");
  const initial = parseAccessManagementState(fs.readFileSync(current));
  if (initial.status !== "parsed") assert.fail("initial_fixture_invalid");
  assert.deepEqual(
    readUserStatus(
      f.root,
      issued.value.token,
      (initial.state.users[0] ?? assert.fail("initial_fixture_missing")).userId,
    ),
    unavailable,
  );
});

/**
 * 保存・pending・Lock解放不明を確認不能として保持する。
 * @responsibility 観測不能をdisabledへ畳まず、例外詳細も返さない。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace RFD-IT-024
 * @precondition 自己生成Storeと、正しい管理者資格。
 * @stimulus 読取り破損、孤立pending、Lock解放故障、不正入力を与える。
 * @observation 固定unavailableと不正入力時のRoot観測0。
 * @oracle 解放前の一時成功値を外へ返さない。
 * @cleanup Mock復元後Fixtureが自己生成Rootだけを回収する。
 * @boundary 現在値・既存保存排他→公開結果。
 */
test("読取りや清掃やLock解放の不明を無効ユーザーとして返さない", (t) => {
  const f = managementFixture(t);
  const userId = (f.state.users[0] ?? assert.fail("user_fixture_missing"))
    .userId;
  const current = path.join(f.directory, "access-management.json");
  fs.writeFileSync(current, "{");
  assert.deepEqual(
    readUserStatus(f.root, f.tokens.administrator, userId),
    unavailable,
  );
  fs.writeFileSync(current, bytes(f.state));
  const pending = path.join(f.directory, "access-management.pending.json");
  fs.writeFileSync(pending, "{");
  assert.deepEqual(
    readUserStatus(f.root, f.tokens.administrator, userId),
    unavailable,
  );
  fs.rmSync(pending);
  const remove = fs.rmSync;
  try {
    fs.rmSync = (target, options) => {
      if (String(target).endsWith("access-management.lock"))
        throw new Error("private detail");
      return remove(target, options);
    };
    assert.deepEqual(
      readUserStatus(f.root, f.tokens.administrator, userId),
      unavailable,
    );
  } finally {
    fs.rmSync = remove;
  }
  assert.equal(
    readUserStatus(f.root, f.tokens.administrator, userId).status,
    "completed",
  );
  let rootObservations = 0;
  const root = new Proxy(
    {},
    {
      get() {
        rootObservations++;
        throw new Error("must_not_read");
      },
    },
  ) as never;
  assert.deepEqual(readUserStatus(root, "invalid", userId), unavailable);
  assert.deepEqual(
    readUserStatus(root, f.tokens.administrator, {}),
    unavailable,
  );
  assert.equal(rootObservations, 0);
});
