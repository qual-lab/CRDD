/**
 * 通常管理状態の実Filesystem保存と再入場を検証する。
 * @packageDocumentation
 * @responsibility 純粋Schemaと保存境界を分離し、部分成立を管理操作全体のPassにしない。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @level IT
 * @scope access-management/state、直接保存境界
 * @boundary Node Filesystem・既存Root/Lock・通常認可・鍵発行／独立失効／交換保存・提示状態保存と局所TTY代役。実Host・交換の本番提示・実Surface出力は対象外。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  readCurrentAccess,
  readCurrentAccessState,
} from "../../../src/authorization/current.ts";
import {
  managementFixture,
  prepare,
  removeKnownStoppedTestLock,
} from "../storage/fixture.ts";

test("本人読取りは現在のアカウント紐付け・期限・ロールだけを返す", (t) => {
  const f = managementFixture(t);
  for (const role of ["administrator", "manager", "developer"] as const) {
    const principal = f.principals[role];
    const current = readCurrentAccess(f.root, principal);
    if (current.status !== "completed")
      assert.fail("fixture account unavailable");
    assert.equal(current.user.userId, principal.userId);
    assert.equal(current.user.role, role);
    assert.equal(
      readCurrentAccess(f.root, { ...principal, expiresAt: Date.now() }).status,
      "unavailable",
    );
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
  const wrong = { ...f.principals.manager, bindingId: crypto.randomUUID() };
  assert.deepEqual(readCurrentAccessState(f.root, wrong), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  assert.deepEqual(fs.readFileSync(pending), before);
  fs.writeFileSync(pending, "{");
  assert.deepEqual(readCurrentAccessState(f.root, f.principals.manager), {
    status: "unavailable",
    reason: "current_access_cleanup_pending",
  });
  fs.writeFileSync(pending, before);
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
  assert.deepEqual(readCurrentAccessState(f.root, f.principals.manager), {
    status: "unavailable",
    reason: "current_access_cleanup_pending",
  });
  fs.rmSync = remove;
  removeKnownStoppedTestLock(f.directory, process.pid);
  assert.equal(
    readCurrentAccessState(f.root, f.principals.manager).status,
    "completed",
  );
  fs.rmSync = (target, options) => {
    if (String(target).endsWith("access-management.state.lock"))
      throw new Error("injected");
    return remove(target, options);
  };
  assert.deepEqual(readCurrentAccessState(f.root, f.principals.manager), {
    status: "unavailable",
    reason: "current_access_release_unknown",
  });
  fs.rmSync = remove;
  removeKnownStoppedTestLock(f.directory, process.pid);
  assert.equal(
    readCurrentAccessState(f.root, f.principals.manager).status,
    "completed",
  );
});
