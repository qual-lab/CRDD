/**
 * 公開APIの最小集合と非秘密結果を確認する。
 * @packageDocumentation
 * @responsibility 保存内部・暗号材料・CLI処理の非公開と拒否時のEffect0を検証する。
 * @trace RFD-UT-020
 * @level UT
 * @scope Access ManagementのPackage Root公開境界。
 * @boundary 不正入力とメモリ内のRoot代役だけ。実Host・Filesystem書込みなし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as access from "../../../src/index.ts";

/**
 * Rootから内部操作を取得できないことを確認する。
 * @responsibility 操作を実行せずRuntime公開集合を検査する。
 * @trace RFD-UT-020
 * @precondition 現行Package Rootを読込み済み。
 * @stimulus 内部保存・暗号・CLI・投影関数の有無を照会する。
 * @observation Rootのown propertyの有無。
 * @oracle 列挙した内部操作はすべて非公開。
 * @cleanup N/A: 外部資源なし。
 * @boundary 同ProcessのESM公開境界。
 */
test("公開APIは保存内部・鍵材料・CLI受付を提供しない", () => {
  assert.equal(typeof access.readUserStatus, "function");
  for (const name of [
    "readAccessManagementState",
    "updateAccessManagementState",
    "parseAccessManagementState",
    "createCredentialMaterial",
    "verifyCredentialToken",
    "readCredentialId",
    "runHostAccessCommand",
    "createInitialAdministrator",
    "createInitialCredential",
    "initializeAccessManagementState",
    "projectCurrentAccessResult",
    "projectManagementOperationResult",
    "projectManagementReadResult",
    "changeUserRole",
    "resolveAiProfileManagementAccess",
    "recordCredentialPresentation",
  ])
    assert.equal(Object.hasOwn(access, name), false, name);
});

/**
 * 公開操作の不正入力拒否と非秘密結果を確認する。
 * @responsibility 保存前拒否を利用側の追加投影なしで取得する。
 * @trace RFD-UT-020
 * @precondition property参照を拒否するRoot代役と不正鍵を使用する。
 * @stimulus User・Role・登録・公開・本人・管理読取りを呼ぶ。
 * @observation 閉じた拒否結果とRoot観測回数。
 * @oracle 固定拒否だけを返しRoot観測0。新Authority・保存Effect0。
 * @cleanup N/A: 実Filesystem・認証情報・外部資源なし。
 * @boundary 公開APIと入力拒否の直接境界。
 */
test("公開操作は拒否を直接返しRootを観測・変更しない", () => {
  let observations = 0;
  const root = new Proxy(
    {},
    {
      get() {
        observations++;
        throw new Error("root_must_not_be_observed");
      },
    },
  ) as never;
  const denied = { status: "rejected", reason: "management_request_rejected" };
  const operation = "00000000-0000-4000-8000-000000000001";
  assert.deepEqual(
    access.registerUser(root, "invalid", 1, operation, "name", "developer"),
    denied,
  );
  assert.deepEqual(
    access.updateUserRole(
      root,
      "invalid",
      1,
      operation,
      operation,
      "developer",
      "manager",
    ),
    denied,
  );
  assert.deepEqual(
    access.registerRepository(
      root,
      "invalid",
      1,
      operation,
      "repo",
      "untrusted",
    ),
    denied,
  );
  assert.deepEqual(
    access.updateExposure(root, "invalid", 1, operation, "repo", []),
    denied,
  );
  assert.deepEqual(access.readCurrentAccess(root, "invalid"), {
    status: "unavailable",
    reason: "current_access_authentication_rejected",
  });
  assert.deepEqual(access.readManagementState(root, "invalid", "unknown"), {
    status: "unavailable",
    reason: "management_read_rejected",
  });
  assert.equal(observations, 0);
});
