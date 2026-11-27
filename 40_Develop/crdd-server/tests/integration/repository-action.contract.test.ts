/**
 * Repository操作の入力・結果境界を検証する。
 * @packageDocumentation
 * @responsibility 操作ごとの閉fieldとEffect／Revision相関を反証する。
 * @trace RFD-IT-014
 * @trace EST-IT-002
 * @level IT
 * @scope Form→Version Control要求と結果→表示前検査。実Gitと現在認可は別試験。
 * @boundary HTTP入力とVersion Control結果。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { inspectRepositoryActionResult } from "../../src/service/repository.ts";
import { readRepositoryWrite } from "../../src/transport/api-server.ts";

test("Git書込みの操作・リポジトリ・送信するコミットはHTTP経路だけで確定する", () => {
  const base = "/api/repositories/repo.a";
  const revision = "a".repeat(40);
  assert.deepEqual(
    readRepositoryWrite("POST", `${base}/staging`, { path: "src/work.txt" }),
    {
      repositoryId: "repo.a",
      request: { operation: "prepare", paths: ["src/work.txt"] },
    },
  );
  assert.equal(
    readRepositoryWrite("DELETE", `${base}/staging`, { path: "src/work.txt" })
      .request.operation,
    "unprepare",
  );
  assert.deepEqual(
    readRepositoryWrite("POST", `${base}/revisions`, {
      message: "確認済み変更",
    }).request,
    { operation: "create_revision", message: "確認済み変更" },
  );
  const publication = {
    destination: "origin",
    branch: "main",
    humanConfirmed: true,
  };
  const publish = `${base}/revisions/${revision}/publication`;
  assert.deepEqual(readRepositoryWrite("POST", publish, publication).request, {
    operation: "publish_revision",
    revisionIdentity: revision,
    ...publication,
  });
  assert.throws(() =>
    readRepositoryWrite("POST", publish, {
      ...publication,
      revisionIdentity: revision,
    }),
  );
  assert.throws(() =>
    readRepositoryWrite("POST", publish, {
      ...publication,
      humanConfirmed: "true",
    }),
  );
  assert.throws(() =>
    readRepositoryWrite(
      "POST",
      `${base}/revisions/main/publication`,
      publication,
    ),
  );
  assert.throws(() =>
    readRepositoryWrite("POST", `${base}/staging`, {
      path: "src/work.txt",
      repositoryId: "repo.b",
    }),
  );
  assert.throws(() =>
    readRepositoryWrite("POST", `${base}/staging`, {
      path: "src/work.txt",
      operation: "unprepare",
    }),
  );
  assert.throws(() =>
    readRepositoryWrite("POST", `${base}/staging`, { path: "../work.txt" }),
  );
  assert.throws(() =>
    readRepositoryWrite("PUT", `${base}/staging`, { path: "src/work.txt" }),
  );
});

/** 不正値と欠落はGitへ配送する前に拒否する。 */
test("Git書込みは不正パス、欠けた入力、未確認の送信を拒否する", () => {
  const base = "/api/repositories/repo.a";
  for (const path of [
    "../a",
    "/a",
    "C:/a",
    "--all",
    "a\\b",
    "a//b",
    "a\0b",
    "",
  ])
    assert.throws(() =>
      readRepositoryWrite("POST", `${base}/staging`, { path }),
    );
  for (const body of [{}, { path: null }, { path: "a", force: true }])
    assert.throws(() => readRepositoryWrite("POST", `${base}/staging`, body));
  for (const body of [{}, { message: "" }, { message: "a\0b" }])
    assert.throws(() => readRepositoryWrite("POST", `${base}/revisions`, body));
  const publication = `${base}/revisions/${"a".repeat(40)}/publication`;
  for (const humanConfirmed of [false, "on", "", undefined])
    assert.throws(() =>
      readRepositoryWrite("POST", publication, {
        destination: "origin",
        branch: "main",
        humanConfirmed,
      }),
    );
});

/**
 * 完了・拒否・不明と処置発行を操作へ相関する。
 * @responsibility blockedの発行済みEffectを維持し、不整合結果を拒否する。
 * @trace RFD-IT-014
 * @trace EST-IT-002
 * @precondition 正規Version Control要求と未知の結果。
 * @stimulus 全理由の正例と状態・Effect・Revision・余剰fieldの反例。
 * @observation 閉結果または拒否。
 * @oracle 未確認を成功／未処置へ変換せず、他操作の結果を受理しない。
 * @effect N/A: 純粋検査。
 * @cleanup N/A: 資源を取得しない。
 * @postcondition 再送・Git呼出し0。
 * @boundary 閉じたFormとGit結果DTOの純粋検査。実認可・Git・Filesystemを呼ばない。
 */
test("Repository操作結果は理由とEffectを操作へ相関する", () => {
  const revision = "a".repeat(40);
  const cases = [
    ["prepare", "prepare_completed", "completed", true, true, null],
    ["prepare", "prepare_rejected", "blocked", true, false, null],
    [
      "prepare",
      "prepare_external_filter_unavailable",
      "blocked",
      false,
      false,
      null,
    ],
    ["prepare", "repository_effect_unknown", "unknown", true, false, null],
    ["unprepare", "unprepare_completed", "completed", true, true, null],
    ["unprepare", "unprepare_rejected", "blocked", true, false, null],
    ["unprepare", "repository_effect_unknown", "unknown", true, false, null],
    ["create_revision", "revision_created", "completed", true, true, revision],
    [
      "create_revision",
      "revision_creation_rejected",
      "blocked",
      true,
      false,
      null,
    ],
    [
      "create_revision",
      "revision_creation_unknown",
      "unknown",
      true,
      false,
      null,
    ],
    [
      "create_revision",
      "revision_identity_unknown",
      "unknown",
      true,
      false,
      null,
    ],
    [
      "publish_revision",
      "publication_revision_changed",
      "blocked",
      false,
      false,
      null,
    ],
    [
      "publish_revision",
      "publication_rejected",
      "blocked",
      true,
      false,
      revision,
    ],
    [
      "publish_revision",
      "publication_result_unknown",
      "unknown",
      true,
      false,
      revision,
    ],
    [
      "publish_revision",
      "publication_observation_unknown",
      "unknown",
      true,
      false,
      revision,
    ],
    [
      "publish_revision",
      "publication_confirmed",
      "completed",
      true,
      true,
      revision,
    ],
  ] as const;
  for (const [
    operation,
    reason,
    status,
    effectIssued,
    effectConfirmed,
    revisionIdentity,
  ] of cases) {
    const base = "/api/repositories/repo.a";
    const { request } =
      operation === "prepare" || operation === "unprepare"
        ? readRepositoryWrite(
            operation === "prepare" ? "POST" : "DELETE",
            `${base}/staging`,
            { path: "a" },
          )
        : operation === "create_revision"
          ? readRepositoryWrite("POST", `${base}/revisions`, {
              message: "commit",
            })
          : readRepositoryWrite(
              "POST",
              `${base}/revisions/${revision}/publication`,
              {
                destination: "origin",
                branch: "main",
                humanConfirmed: true,
              },
            );
    const value = {
      status,
      reason,
      effectIssued,
      effectConfirmed,
      revisionIdentity,
      automaticRetryIssued: false,
      forcePublicationIssued: false,
    };
    assert.deepEqual(inspectRepositoryActionResult(request, value), value);
    if (operation === "publish_revision" && revisionIdentity !== null)
      assert.throws(() =>
        inspectRepositoryActionResult(request, {
          ...value,
          revisionIdentity: "b".repeat(40),
        }),
      );
    assert.throws(() =>
      inspectRepositoryActionResult(request, {
        ...value,
        reason:
          operation === "prepare"
            ? "unprepare_completed"
            : operation === "unprepare"
              ? "prepare_completed"
              : operation === "create_revision"
                ? "publication_confirmed"
                : "revision_created",
      }),
    );
    for (const extra of [
      { reason: "unknown_reason" },
      { rawOutput: "forbidden" },
      { effectIssued: !effectIssued },
      { effectConfirmed: !effectConfirmed },
      { status: status === "completed" ? "blocked" : "completed" },
      { automaticRetryIssued: true },
      { forcePublicationIssued: true },
      { revisionIdentity: revisionIdentity === null ? revision : null },
    ])
      assert.throws(() =>
        inspectRepositoryActionResult(request, { ...value, ...extra }),
      );
    for (const key of Object.keys(value)) {
      const incomplete = { ...value } as Record<string, unknown>;
      delete incomplete[key];
      assert.throws(() => inspectRepositoryActionResult(request, incomplete));
    }
  }
});
