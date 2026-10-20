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
import {
  projectManagementOperationResult,
  projectManagementReadResult,
} from "../../../src/authorization/management.ts";
import { projectCurrentAccessResult } from "../../../src/authorization/current.ts";

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

/**
 * 管理内部結果から秘密・自由理由を除くOwner側の変換を確認する。
 * @responsibility MCPから移した内部理由変換の検証をAMの公開投影Ownerへ接続する。
 * @trace RFD-UT-020
 * @precondition 保存や認証を呼ばない合成の完了済み内部結果を使用する。
 * @stimulus 既知・未知・prototype名の理由、内部Path、secondary、本人管理情報を投影する。
 * @observation 公開結果の全fieldと内部値の不存在。
 * @oracle 固定理由と許可fieldだけを返し、publicationとcleanupの観測を維持する。
 * @cleanup N/A: メモリ上の合成値だけ。
 * @boundary AM内部保存結果と公開Outcomeの純粋変換。
 */
test("公開投影は内部理由と非公開fieldを閉じた結果へ変換する", () => {
  const operationId = "00000000-0000-4000-8000-000000000001";
  const mappings = [
    ["state_store_previous_pending_settled", "previous_materials_settled"],
    ["state_store_pending_failed", "previous_materials_unavailable"],
    ["state_store_capacity_exceeded", "capacity_exceeded"],
    ["state_store_identity_failed", "identity_generation_failed"],
    ["state_store_candidate_failed", "candidate_invalid"],
    ["state_store_repository_binding_failed", "repository_validation_failed"],
    ["state_store_prepare_failed", "prepare_failed"],
    ["state_store_publish_failed", "publication_failed"],
    ["state_store_read_back_failed", "readback_failed"],
    ["state_store_cleanup_failed", "cleanup_failed"],
    ["state_store_lock_unknown", "release_unknown"],
    [
      "filesystem_store_lock_operation_completed_cleanup_unknown",
      "release_unknown",
    ],
    ["fixture-private-reason", "storage_unavailable"],
    ["toString", "storage_unavailable"],
  ] as const;
  for (const [primaryFailure, expected] of mappings) {
    const internal = {
      status: "unavailable" as const,
      reason: "management_operation_unavailable" as const,
      operationId,
      expectedRevision: 7,
      observedRevision: 8,
      publication: "confirmed" as const,
      cleanupConfirmed: false,
      primaryFailure,
      secondaryFailure: "fixture-private-secondary",
      path: "fixture-private-path",
    };
    assert.deepEqual(projectManagementOperationResult(internal), {
      status: "unavailable",
      reason: "management_operation_unavailable",
      operationId,
      expectedRevision: 7,
      observedRevision: 8,
      publication: "confirmed",
      cleanupConfirmed: false,
      primaryFailure: expected,
    });
  }
  for (const reason of [
    "management_state_read_rejected",
    "management_state_authentication_rejected",
    "management_state_observation_unknown",
  ] as const) {
    assert.deepEqual(
      projectManagementReadResult({ status: "unavailable", reason }),
      {
        status: "unavailable",
        reason:
          reason === "management_state_observation_unknown"
            ? "management_read_unavailable"
            : "management_read_rejected",
      },
    );
  }
  const user = {
    userId: operationId,
    username: "本人",
    role: "developer" as const,
  };
  const internalCurrent = {
    status: "completed" as const,
    snapshot: {
      revision: 8,
      user,
      contentAccess: { workspaceIds: [] },
      permittedRepositories: [],
      managementOperations: [{ operation: "issueCredential" as const }],
      path: "fixture-private-path",
    },
  };
  assert.deepEqual(projectCurrentAccessResult(internalCurrent), {
    status: "completed",
    revision: 8,
    user,
    contentAccess: { workspaceIds: [] },
    permittedRepositories: [],
  });
});
