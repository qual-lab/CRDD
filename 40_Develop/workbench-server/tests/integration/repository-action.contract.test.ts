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
import {
  validateRepositoryActionForm,
  inspectRepositoryActionResult,
} from "../../src/project/repository-action.ts";

/**
 * 対象と確認を閉Formから一意に確定する。
 * @responsibility 正規四操作と不正・重複・余剰・未確認を検査する。
 * @trace RFD-IT-014
 * @trace EST-IT-002
 * @precondition 未検査のForm値。
 * @stimulus 共有／単体の正常入力を一fieldずつ変更する。
 * @observation 返却要求と固定拒否を観測する。
 * @oracle 不正を補完せず、共有対象と確認がexactに保存される。
 * @effect N/A: 純粋検査。
 * @cleanup N/A: 資源を取得しない。
 * @postcondition 実Git・認可・Filesystem呼出し0。
 * @boundary 閉じたFormとGit結果DTOの純粋検査。実認可・Git・Filesystemを呼ばない。
 */
test("Repository操作Formは対象と操作ごとの閉集合を保持する", () => {
  const revision = "a".repeat(40);
  for (const [operation, fields] of [
    ["prepare", { path: "src/work.txt" }],
    ["unprepare", { path: "src/work.txt" }],
    ["create_revision", { message: "確認済み変更" }],
    [
      "publish_revision",
      {
        destination: "origin",
        branch: "main",
        revisionIdentity: revision,
        humanConfirmed: "true",
      },
    ],
  ] as const) {
    const form = new URLSearchParams({
      operation,
      actionToken: "token",
      repositoryId: "repo.a",
      ...fields,
    });
    const observed = validateRepositoryActionForm(form, "token", true);
    assert.equal(observed.repositoryId, "repo.a");
    assert.equal(observed.request.operation, operation);
    assert.throws(() => validateRepositoryActionForm(form, "other", true));
    for (const key of [...form.keys()]) {
      const duplicate = new URLSearchParams(form);
      duplicate.append(key, form.get(key) ?? "");
      assert.throws(() =>
        validateRepositoryActionForm(duplicate, "token", true),
      );
      const missing = new URLSearchParams(form);
      missing.delete(key);
      assert.throws(() => validateRepositoryActionForm(missing, "token", true));
    }
    const extra = new URLSearchParams(form);
    extra.set("force", "true");
    assert.throws(() => validateRepositoryActionForm(extra, "token", true));
    assert.throws(() => validateRepositoryActionForm(form, "token", false));
    const standalone = new URLSearchParams(form);
    standalone.delete("repositoryId");
    assert.equal(
      validateRepositoryActionForm(standalone, "token", false).repositoryId,
      null,
    );
  }
  for (const selectedPath of [
    "../a",
    "/a",
    "C:/a",
    "--all",
    "a\\b",
    "a//b",
    "a\0b",
    "",
  ]) {
    assert.throws(() =>
      validateRepositoryActionForm(
        new URLSearchParams({
          operation: "prepare",
          actionToken: "token",
          repositoryId: "repo.a",
          path: selectedPath,
        }),
        "token",
        true,
      ),
    );
  }
  for (const humanConfirmed of ["false", "on", ""]) {
    assert.throws(() =>
      validateRepositoryActionForm(
        new URLSearchParams({
          operation: "publish_revision",
          actionToken: "token",
          repositoryId: "repo.a",
          destination: "origin",
          branch: "main",
          revisionIdentity: revision,
          humanConfirmed,
        }),
        "token",
        true,
      ),
    );
  }
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
    const form = new URLSearchParams({
      operation,
      actionToken: "token",
      repositoryId: "repo.a",
      ...(operation === "prepare" || operation === "unprepare"
        ? { path: "a" }
        : operation === "create_revision"
          ? { message: "commit" }
          : {
              destination: "origin",
              branch: "main",
              revisionIdentity: revision,
              humanConfirmed: "true",
            }),
    });
    const { request } = validateRepositoryActionForm(form, "token", true);
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
