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
import { readCurrentAccessState as readCurrentAccess } from "../../../src/authorization/current.ts";
import { authenticateCredential } from "../../../src/credential/authentication.ts";
import { createCredentialMaterial } from "../../../src/credential/token.ts";
import { authenticateNormalConnection } from "../../../src/index.ts";
import { createInitialCredential } from "../../../src/initialization/execution.ts";
import type { AccessManagementState } from "../../../src/storage/types.ts";
import {
  bytes,
  fixture,
  managementFixture,
  prepare,
  prepareInitialUser,
} from "../storage/fixture.ts";

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
