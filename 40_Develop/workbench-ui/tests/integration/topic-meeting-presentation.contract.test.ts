/**
 * Topic／MeetingのBrowser搬送と結果相関を検証する。
 * @packageDocumentation
 * @responsibility 操作確認・対象選択・成功根拠の境界を反証する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @level IT
 * @scope 同Origin Form変換と結果表示検査。
 * @boundary 実Browserの取消・認可・保存試験は別に行う。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecordRequest,
  createTopicMeetingActionBody,
  inspectRecordResponse,
  inspectTopicMeetingActionResult,
} from "../../src/api/record.ts";
import { createSelectedWorkbenchViewUrl } from "../../src/api/view.ts";

/**
 * Form操作をRESTのリソース・メソッドへ固定する。
 * @trace CPR-IT-010
 * @boundary URLとJSONの搬送だけを検証し、保存はServer試験で確認する。
 */
test("内容操作は対象をURLに置き、確認値をJSONのbooleanとして送る", () => {
  const prefix = "/api/repositories/repository.one";
  for (const [action, kind, suffix, method] of [
    ["create", "topic", "/topics", "POST"],
    ["update", "meeting", "/meetings/MTG-000001", "PATCH"],
    ["delete", "topic", "/topics/TOPIC-000001", "DELETE"],
    ["promote-topic", "topic", "/topics/TOPIC-000001/promotion", "POST"],
    [
      "treat-outcome",
      "meeting",
      "/meetings/MTG-000001/outcomes/OUT-001/treatment",
      "PUT",
    ],
  ] as const) {
    const form = new URLSearchParams({
      operation: action,
      kind,
      repositoryId: "repository.one",
      actionToken: "not-sent",
      markdown: "fixture",
    });
    if (action !== "create") {
      form.set("id", kind === "topic" ? "TOPIC-000001" : "MTG-000001");
      form.set("expectedRevision", "2");
    }
    if (action === "promote-topic") form.set("changeId", "CHG-000001");
    if (action === "treat-outcome") form.set("outcomeId", "OUT-001");
    const request = createRecordRequest(form);
    assert.equal(request.path, `${prefix}${suffix}`);
    assert.equal(request.method, method);
    assert.equal(request.success, action === "create" ? 201 : 200);
    for (const key of [
      "operation",
      "kind",
      "repositoryId",
      "actionToken",
      "id",
      "outcomeId",
    ])
      assert.equal(Object.hasOwn(request.body, key), false);
    if (action !== "create")
      assert.equal(Reflect.get(request.body, "expectedRevision"), 2);
    if (action === "delete")
      assert.equal(Reflect.get(request.body, "confirmed"), false);
    if (action === "treat-outcome")
      assert.equal(Reflect.get(request.body, "closeMeeting"), false);
  }
});

/**
 * HTTP状態と記録の照合結果を保存確認に使う。
 * @trace CPR-IT-012
 * @boundary HTTP結果の相関だけを検証し、再取得はBrowser試験で確認する。
 */
test("異なる対象・不明な保存と確定した競合拒否を区別する", () => {
  const form = new URLSearchParams({
    kind: "topic",
    operation: "update",
    id: "TOPIC-000001",
    repositoryId: "repository.one",
  });
  const completed = {
    status: "completed",
    reason: "record_updated",
    record: { topicId: "TOPIC-000001" },
    relationPaths: [],
    filesystemEffectCount: 1,
  };
  assert.equal(
    inspectRecordResponse(form, completed, 200, 200).status,
    "completed",
  );
  assert.throws(() =>
    inspectRecordResponse(
      form,
      {
        ...completed,
        record: { topicId: "TOPIC-000002" },
      },
      200,
      200,
    ),
  );
  const conflict = {
    ...completed,
    status: "blocked",
    reason: "record_revision_conflict",
    record: null,
    filesystemEffectCount: 0,
  };
  assert.equal(
    inspectRecordResponse(form, conflict, 409, 200).status,
    "blocked",
  );
  assert.throws(() => inspectRecordResponse(form, conflict, 503, 200));
  assert.throws(() => inspectRecordResponse(form, completed, 409, 200));
});

/**
 * checkboxと選択対象を欠測・暗黙確認へ変換しない。
 * @responsibility 明示false一件と要求の対象拘束を確認する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition メモリ内の既存FormData。
 * @stimulus 未選択、選択、重複、対象差とToken差。
 * @observation URLSearchParamsと固定拒否。
 * @oracle booleanは一件だけ、未確認はfalse、対象差は拒否。
 * @cleanup N/A: Filesystem・通信を使用しない。
 * @boundary Browserの入力変換だけを検査する。
 */
test("内容Formはboolean一件と選択Repositoryを維持する", () => {
  for (const operation of ["delete", "treat-outcome"]) {
    const data = new FormData();
    for (const [key, value] of Object.entries({
      kind: "meeting",
      operation,
      repositoryId: "repo-a",
    }))
      data.set(key, value);
    const field = operation === "delete" ? "confirmed" : "closeMeeting";
    assert.deepEqual(
      createTopicMeetingActionBody(data, "repo-a").getAll(field),
      ["false"],
    );
    data.set(field, "true");
    assert.deepEqual(
      createTopicMeetingActionBody(data, "repo-a").getAll(field),
      ["true"],
    );
    assert.throws(() => createTopicMeetingActionBody(data, "repo-b"));
    data.append(field, "false");
    assert.throws(() => createTopicMeetingActionBody(data, "repo-a"));
  }
});

/**
 * 成功・拒否を送信操作とEffectへ結合する。
 * @responsibility 外形だけ正しい虚偽成功や別操作を拒否する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 一回送信したFormの非秘密値。
 * @stimulus 全操作の正規成功と矛盾する理由・種別・Effect・余剰field。
 * @observation 結果受理または固定拒否。
 * @oracle completedは対応理由とEffect1、blockedは対応理由とEffect0。
 * @cleanup N/A: メモリ内検査のみ。
 * @boundary 保存の実成立はServer結合試験が担当する。
 */
test("内容結果は五fieldと操作・種別・Effectを相関検査する", () => {
  for (const [operation, kind, reason] of [
    ["create", "topic", "record_created"],
    ["update", "meeting", "record_updated"],
    ["delete", "topic", "record_deleted"],
    ["promote-topic", "topic", "topic_promoted"],
    ["treat-outcome", "meeting", "meeting_outcome_treated"],
  ] as const) {
    const form = new URLSearchParams({
      operation,
      kind,
      repositoryId: "repo-a",
      confirmed: "true",
    });
    const valid = {
      status: "completed",
      reason,
      recordKind: kind,
      relationPaths: [],
      filesystemEffectCount: 1,
    };
    assert.equal(
      inspectTopicMeetingActionResult(form, valid).status,
      "completed",
    );
    for (const change of [
      { root: "hidden" },
      { recordKind: kind === "topic" ? "meeting" : "topic" },
      { reason: "unknown" },
      { filesystemEffectCount: 0 },
      { status: "unknown" },
    ])
      assert.throws(() =>
        inspectTopicMeetingActionResult(form, { ...valid, ...change }),
      );
    {
      const blocked = {
        ...valid,
        status: "blocked",
        reason: "record_revision_conflict",
        filesystemEffectCount: 0,
      };
      assert.equal(
        inspectTopicMeetingActionResult(form, blocked).status,
        "blocked",
      );
      assert.throws(() =>
        inspectTopicMeetingActionResult(form, {
          ...blocked,
          filesystemEffectCount: 1,
        }),
      );
    }
    if (operation === "delete") {
      assert.throws(() =>
        inspectTopicMeetingActionResult(form, { ...valid, recordKind: null }),
      );
      form.set("confirmed", "false");
      assert.throws(() => inspectTopicMeetingActionResult(form, valid));
    }
    assert.throws(() =>
      inspectTopicMeetingActionResult(form, {
        ...valid,
        relationPaths: ["unexpected"],
      }),
    );
    const blockedRelations = {
      ...valid,
      status: "blocked",
      reason: "record_revision_conflict",
      filesystemEffectCount: 0,
      relationPaths: ["unexpected"],
    };
    assert.throws(() =>
      inspectTopicMeetingActionResult(form, blockedRelations),
    );
    if (operation === "delete") {
      const linked = {
        ...blockedRelations,
        reason: "record_relations_require_resolution",
      };
      assert.equal(
        inspectTopicMeetingActionResult(form, linked).status,
        "blocked",
      );
    }
  }
});

/**
 * 再取得のroute・検索・Repositoryを保持する。
 * @responsibility 異なる選択への無言fallbackを防ぐ。
 * @trace CPR-IT-012
 * @precondition 同Origin画面の現在URL。
 * @stimulus 選択Main、Record Detail、重複IDと対象差。
 * @observation 相対API URLまたは固定拒否。
 * @oracle 既存queryとrouteが一致し、対象差は取得前拒否。
 * @cleanup N/A: URL値のみ。
 * @boundary 通信後の応答相関はCallerの確認対象。
 */
test("fresh表示URLは選択と検索条件を落とさない", () => {
  const current = new URL(
    "http://localhost/?repositoryId=repo-a&topicQuery=abc#topics",
  );
  const next = new URL(
    createSelectedWorkbenchViewUrl(current, "repo-a"),
    current,
  );
  assert.equal(next.pathname, "/api/workbench/overview");
  assert.equal(next.searchParams.get("repositoryId"), "repo-a");
  assert.equal(next.searchParams.has("route"), false);
  assert.equal(next.searchParams.get("topicQuery"), "abc");
  assert.throws(() => createSelectedWorkbenchViewUrl(current, "repo-b"));
  current.searchParams.append("repositoryId", "repo-a");
  assert.throws(() => createSelectedWorkbenchViewUrl(current, "repo-a"));
  assert.equal(
    new URL(
      createSelectedWorkbenchViewUrl(new URL("http://localhost/"), null),
      current,
    ).searchParams.get("route"),
    null,
  );
});
