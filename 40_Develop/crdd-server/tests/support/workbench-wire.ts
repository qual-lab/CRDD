/**
 * Serverが実際に返したHTTP応答の外形を確かめる。
 * @packageDocumentation
 * @responsibility 予期しない公開項目と別画面への誤配送を検出する。
 * @trace ERB-IT-021
 * @level IT
 * @boundary HTTP producerの試験用。Browserの受理規則や実行の許可判定に使わない。
 */
import assert from "node:assert/strict";
import type {
  ManagementResult,
  ManagementView,
  ViewResponse,
} from "../../src/app.ts";

const fieldsByView = {
  access: [
    "actionToken",
    "authenticated",
    "notice",
    "portfolio",
    "credentials",
  ],
  artifact: ["repositoryId", "selectedRepositoryId", "artifact"],
  "project-detail": ["project"],
  "record-detail": [
    "actionToken",
    "repositoryId",
    "record",
    "recordActionsConfigured",
  ],
  main: [
    "actionToken",
    "projectData",
    "portfolio",
    "portfolioPage",
    "connection",
    "topicPage",
    "topicQuery",
    "meetingPage",
    "meetingQuery",
    "recordDocuments",
    "recordActionResult",
    "selectedRepositoryId",
    "recordActionsConfigured",
    "repositoryActionsConfigured",
    "repositoryResult",
    "worktree",
    "credentials",
    "aiSelection",
    "aiSelectionManagement",
    "aiRequest",
    "executionActivity",
  ],
} as const satisfies {
  [View in ViewResponse["view"]]: readonly Exclude<
    keyof Extract<ViewResponse, { view: View }>,
    "contract" | "view"
  >[];
};

/** 管理Wireの公開Identityを、操作で指定した値又は固定文法と照合する。 @trace ERB-IT-021 */
function assertManagementId(value: unknown, kind: "repository" | "uuid"): void {
  assert.equal(typeof value, "string");
  assert.match(
    String(value),
    kind === "repository"
      ? /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u
      : /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
  );
}

/** 接続の公開範囲を重複や未知値なしで返す。 @trace ERB-IT-021 */
function assertManagementScope(value: unknown): void {
  assert.ok(Array.isArray(value));
  assert.ok(
    value.every((scope) => scope === "development" || scope === "management"),
  );
  assert.equal(new Set(value).size, value.length);
}

/** 実HTTP上の管理一覧を、閉じたキーと項目Identityで確認する。 @trace ERB-IT-021 */
function assertManagementRows(
  items: unknown,
  view: "users" | "roles" | "repositories" | "exposure" | "permitted",
): void {
  assert.ok(Array.isArray(items));
  const expected = {
    users: "role,userId,username",
    roles: "role,workspaceIds",
    repositories: "repositoryId",
    exposure: "repositoryId,workspaceIds",
    permitted: "repositoryId,workspaceIds",
  };
  const identities = new Set<unknown>();
  for (const item of items) {
    assert.ok(item !== null && typeof item === "object");
    assert.equal(Object.keys(item).sort().join(","), expected[view]);
    const identity =
      view === "users"
        ? item.userId
        : view === "roles"
          ? item.role
          : item.repositoryId;
    assert.ok(!identities.has(identity));
    identities.add(identity);
    if (view === "users" || view === "roles")
      assert.ok(["developer", "manager", "administrator"].includes(item.role));
    if (view === "users") {
      assertManagementId(item.userId, "uuid");
      assert.equal(typeof item.username, "string");
      assert.equal(item.username.trim(), item.username);
      assert.ok(
        item.username.length <= 256 &&
          [...item.username].length > 0 &&
          [...item.username].length <= 128,
      );
      assert.doesNotMatch(item.username, /[\p{Cc}\p{Cs}]/u);
    }
    if (view !== "users" && view !== "roles")
      assertManagementId(item.repositoryId, "repository");
    if (
      view === "roles" ||
      view === "permitted" ||
      (view === "exposure" && item.workspaceIds !== null)
    )
      assertManagementScope(item.workspaceIds);
  }
}

/** 返却された画面の共通契約と判別子を取得する。個々の値は利用する試験が確かめる。 @trace ERB-IT-021 */
export function assertViewResponse(value: unknown): ViewResponse {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.ok("contract" in value && value.contract === "crdd/workbench/view/v1");
  assert.ok("view" in value && typeof value.view === "string");
  assert.ok(Object.hasOwn(fieldsByView, value.view));
  const fields = fieldsByView[value.view as keyof typeof fieldsByView];
  assert.deepEqual(
    Object.keys(value).sort(),
    ["contract", "view", ...fields].sort(),
  );
  return value as ViewResponse;
}

/** 管理操作の公開項目と改訂の相関を比較する。 @trace ERB-IT-021 */
export function assertManagementResponse(
  value: unknown,
  view: ManagementView | "mutation",
): ManagementResult {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.ok("status" in value);
  const keySets = Object.keys(value).sort().join(",");
  if (value.status === "completed") {
    assert.ok(
      "revision" in value &&
        Number.isSafeInteger(value.revision) &&
        Number(value.revision) > 0,
    );
    if (view === "mutation") {
      const target = "repositoryId" in value ? "repositoryId" : "userId";
      assert.equal(
        keySets,
        [
          "status",
          "operationId",
          "revision",
          "expectedRevision",
          "publication",
          "cleanupConfirmed",
          target,
        ]
          .sort()
          .join(","),
      );
      assert.ok(
        "expectedRevision" in value &&
          Number.isSafeInteger(value.expectedRevision) &&
          Number(value.expectedRevision) > 0,
      );
      assert.equal(value.revision, Number(value.expectedRevision) + 1);
      assert.ok("publication" in value && value.publication === "confirmed");
      assert.ok("cleanupConfirmed" in value && value.cleanupConfirmed === true);
      const result = value as Record<string, unknown>;
      assertManagementId(result.operationId, "uuid");
      if (target === "repositoryId")
        assertManagementId(result.repositoryId, "repository");
      else if (result.userId !== null)
        assertManagementId(result.userId, "uuid");
    } else if (view === "current") {
      assert.equal(
        keySets,
        "contentAccess,permittedRepositories,revision,status,user",
      );
      const result = value as Record<string, unknown>;
      assertManagementRows([result.user], "users");
      assertManagementRows(result.permittedRepositories, "permitted");
      assert.ok(
        result.contentAccess &&
          typeof result.contentAccess === "object" &&
          "workspaceIds" in result.contentAccess,
      );
      assert.deepEqual(Object.keys(result.contentAccess), ["workspaceIds"]);
      assertManagementScope(result.contentAccess.workspaceIds);
    } else {
      const field = view === "exposure" ? "repositories" : view;
      assert.equal(keySets, [field, "status", "revision"].sort().join(","));
      assertManagementRows((value as Record<string, unknown>)[field], view);
    }
  } else {
    assert.ok(
      value.status === "unavailable" ||
        (view === "mutation" && value.status === "rejected"),
    );
    assert.ok("reason" in value && typeof value.reason === "string");
    if (
      view === "mutation" &&
      value.status === "unavailable" &&
      value.reason === "management_operation_unavailable"
    ) {
      assert.equal(
        keySets,
        "cleanupConfirmed,expectedRevision,observedRevision,operationId,primaryFailure,publication,reason,status",
      );
      const result = value as Record<string, unknown>;
      assertManagementId(result.operationId, "uuid");
      assert.ok(
        Number.isSafeInteger(result.expectedRevision) &&
          Number(result.expectedRevision) > 0,
      );
      assert.ok(
        result.observedRevision === null ||
          (Number.isSafeInteger(result.observedRevision) &&
            Number(result.observedRevision) > 0),
      );
      assert.equal(typeof result.cleanupConfirmed, "boolean");
      assert.ok(typeof result.publication === "string");
      assert.ok(typeof result.primaryFailure === "string");
      assert.ok(
        ["not_attempted", "unconfirmed", "confirmed"].includes(
          result.publication,
        ),
      );
      assert.ok(
        [
          "previous_materials_settled",
          "previous_materials_unavailable",
          "identity_generation_failed",
          "candidate_invalid",
          "repository_validation_failed",
          "prepare_failed",
          "publication_failed",
          "readback_failed",
          "cleanup_failed",
          "release_unknown",
          "storage_unavailable",
        ].includes(result.primaryFailure),
      );
    } else {
      assert.equal(keySets, "reason,status");
      const allowed =
        value.status === "rejected"
          ? ["management_request_rejected"]
          : [
              "management_not_configured",
              ...(view === "current"
                ? [
                    "current_access_authentication_rejected",
                    "current_access_lock_unavailable",
                    "current_access_cleanup_pending",
                    "current_access_observation_unknown",
                    "current_access_release_unknown",
                  ]
                : view === "mutation"
                  ? []
                  : [
                      "management_read_rejected",
                      "management_read_unavailable",
                    ]),
            ];
      assert.ok(allowed.includes(value.reason));
    }
  }
  return value as ManagementResult;
}
