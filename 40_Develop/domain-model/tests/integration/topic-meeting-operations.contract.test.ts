/**
 * project-operation:integration:topic-meeting-applicationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility project-operation:integration:topic-meeting-applicationが宣言する検証責務と終了後条件を所有する。
 * @trace CPR-IT-008
 * @level IT
 * @scope project-operation、contract、local_component_boundary
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createTopicMeetingOperations } from "../../src/activity/operations.ts";
import { createTopicMeetingRepository } from "../../src/storage/topic-meeting-store.ts";
import { createTopicOperations } from "../../src/topic/create-operations.ts";
import { createMeetingOperations } from "../../src/meeting/create-operations.ts";

/**
 * 公開CRUD面がTopicとMeetingの種別を固定することを確認する。
 *
 * @responsibility 共通実体の保存結果を保ち、別種別の専用操作と種別選択を公開しないことを検証する。
 * @trace CPR-IT-008
 * @precondition 空の試験Repositoryに両種別の公開Applicationを生成する。
 * @stimulus 各公開面から登録、一覧、取得および反対種別Markdownの登録を試みる。
 * @observation 正本の種別、結果、一覧と公開操作名を確認する。
 * @oracle 両登録が完了し、専用操作は相互非公開、誤種別登録は拒否される。
 * @cleanup 作成した試験Rootをfinallyで削除する。
 * @boundary Topic／Meeting公開面から同一Repository FilesystemへのDirect Boundary。
 */
test("公開CRUDは生成した種別だけを操作する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-scoped-activity-"));
  try {
    const topics = createTopicOperations(root);
    const meetings = createMeetingOperations(root);
    assert.equal(topics.create(topic("TOPIC-000001")).status, "completed");
    assert.equal(meetings.create(meeting()).status, "completed");
    assert.equal(topics.list({}).records.length, 1);
    assert.equal(meetings.list({}).records.length, 1);
    assert.ok(topics.get("TOPIC-000001"));
    assert.ok(meetings.get("MTG-000001"));
    assert.throws(
      () => topics.get("MTG-000001"),
      /project_operation_record_id_invalid/u,
    );
    assert.throws(
      () => meetings.get("TOPIC-000001"),
      /project_operation_record_id_invalid/u,
    );
    assert.equal("treatMeetingOutcome" in topics, false);
    assert.equal("promoteTopic" in meetings, false);
    assert.throws(
      () => topics.create(meeting()),
      /project_operation_record_metadata_invalid/u,
    );
    assert.throws(
      () => meetings.create(topic("TOPIC-000002")),
      /project_operation_record_metadata_invalid/u,
    );
    assert.equal(topics.list({}).records.length, 1);
    assert.equal(meetings.list({}).records.length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * topic用の試験入力または観測処理を提供する。
 *
 * @responsibility topic用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus topicの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
function topic(
  id: string,
  input: Readonly<{
    state?: "open" | "waiting" | "promoted" | "closed";
    owner?: string;
    title?: string;
    relation?: string;
  }> = {},
) {
  return `# ${input.title ?? id}\n\n成果物種別: Topic\nTopic ID: \`${id}\`\nProject ID: \`PRJ-001\`\n状態: \`${input.state ?? "open"}\`\n改訂: \`1\`\n維持責任者: \`${input.owner ?? "Project Operator"}\`\n\n## 1. 現在の論点\n\n### 結論\n\n${id}を確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | \`${input.relation ?? "N/A: 関係なし"}\` | fixture |\n\n## 4. 次の行動\n\n| 行動 | Owner | 期限／再評価契機 | 完了条件 | 状態 |\n|---|---|---|---|---|\n| 確認する | PM | 次回 | 判断する | \`open\` |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: open／waitingでは未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
}

/**
 * meeting用の試験入力または観測処理を提供する。
 *
 * @responsibility meeting用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus meetingの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
function meeting(
  outcomes: readonly string[] = ["OUT-001"],
  input: Readonly<{ id?: string; occurredAt?: string }> = {},
) {
  const outcomeRows = outcomes
    .map(
      (id) =>
        `| \`${id}\` | Action | ${id}を追跡する | \`pending\` | PM | 次回確認 | \`N/A: 未移管\` |`,
    )
    .join("\n");
  const actionRows = outcomes.map((id) => `| \`${id}\` | | | | |`).join("\n");
  return `# 定例会議

成果物種別: Meeting
Meeting ID: \`${input.id ?? "MTG-000001"}\`
Project ID: \`PRJ-001\`
状態: \`recorded\`
開催日時: \`${input.occurredAt ?? "2026-09-27 10:00 JST"}\`
改訂: \`1\`
維持責任者: \`PM\`

## 1. 目的と要約

### 結論

Outcomeを処置する。

## 4. Outcome

| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |
|---|---|---|---|---|---|---|
${outcomeRows}

## 5. Actionと移管

| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |
|---|---|---|---|---|
${actionRows}

## 6. Close・訂正

| 項目 | 内容 |
|---|---|
| Close判定 | \`OPEN: Outcome処置後に評価する\` |
| 未処置Outcome | \`${outcomes.join("、")}\` |
| 訂正元／訂正先 | \`N/A: 訂正ではない\` |
| 残る影響 | |
`;
}

/**
 * ID CursorでTopic一覧を欠落なく分割するを検証する。
 *
 * @responsibility ID CursorでTopic一覧を欠落なく分割するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus ID CursorでTopic一覧を欠落なく分割するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("ID CursorでTopic一覧を欠落なく分割する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-topic-page-"));
  try {
    const application = createTopicMeetingOperations(
      createTopicMeetingRepository(root),
    );
    for (const id of ["TOPIC-000001", "TOPIC-000002", "TOPIC-000003"])
      assert.equal(application.create("topic", topic(id)).status, "completed");
    const first = application.list({ kind: "topic", limit: 2 });
    assert.deepEqual(
      first.records.map((record) =>
        "topicId" in record ? record.topicId : record.meetingId,
      ),
      ["TOPIC-000001", "TOPIC-000002"],
    );
    assert.equal(first.nextCursor, "TOPIC-000002");
    const second = application.list({
      kind: "topic",
      cursor: first.nextCursor ?? undefined,
      limit: 2,
    });
    assert.equal(second.records.length, 1);
    assert.equal(second.nextCursor, null);
    assert.throws(
      () => application.list({ kind: "topic", limit: 101 }),
      /project_operation_list_limit_invalid/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * TopicとMeetingを検索・絞込み・並び順付きCursorで取得するを検証する。
 *
 * @responsibility TopicとMeetingを検索・絞込み・並び順付きCursorで取得するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus TopicとMeetingを検索・絞込み・並び順付きCursorで取得するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("TopicとMeetingを検索・絞込み・並び順付きCursorで取得する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-topic-filter-"));
  try {
    const application = createTopicMeetingOperations(
      createTopicMeetingRepository(root),
    );
    application.create(
      "topic",
      topic("TOPIC-000001", {
        state: "waiting",
        owner: "PM",
        title: "認証の判断",
        relation: "CHG-000010",
      }),
    );
    application.create(
      "topic",
      topic("TOPIC-000002", {
        state: "open",
        owner: "Developer",
        title: "Runtime確認",
        relation: "CHG-000011",
      }),
    );
    application.create(
      "topic",
      topic("TOPIC-000003", {
        state: "waiting",
        owner: "PM",
        title: "配布判断",
        relation: "CHG-000010",
      }),
    );
    const filtered = application.list({
      kind: "topic",
      limit: 1,
      query: {
        states: ["waiting"],
        owner: "PM",
        relation: "CHG-000010",
        sort: "title_asc",
      },
    });
    assert.equal(filtered.records[0]?.title, "認証の判断");
    assert.ok(filtered.nextCursor);
    if (filtered.nextCursor === null) throw new Error("cursor_missing");
    const next = application.list({
      kind: "topic",
      cursor: filtered.nextCursor,
      limit: 1,
      query: {
        states: ["waiting"],
        owner: "PM",
        relation: "CHG-000010",
        sort: "title_asc",
      },
    });
    assert.equal(next.records[0]?.title, "配布判断");
    assert.throws(
      () =>
        application.list({
          kind: "topic",
          cursor: filtered.nextCursor ?? "",
          query: { states: ["open"], sort: "title_asc" },
        }),
      /project_operation_list_cursor_invalid/u,
    );

    application.create(
      "meeting",
      meeting([], {
        id: "MTG-000002",
        occurredAt: "2026-09-20 10:00 JST",
      }),
    );
    application.create(
      "meeting",
      meeting(["OUT-001"], {
        id: "MTG-000003",
        occurredAt: "2026-09-28 10:00 JST",
      }),
    );
    const meetings = application.list({
      kind: "meeting",
      query: {
        occurredFrom: "2026-09-25",
        pendingOnly: true,
        sort: "occurred_desc",
      },
    });
    assert.deepEqual(
      meetings.records.map((record) =>
        "meetingId" in record ? record.meetingId : record.topicId,
      ),
      ["MTG-000003"],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Topic／Meeting／CHG Relationを安定IDと存在状態へ解決するを検証する。
 *
 * @responsibility Topic／Meeting／CHG Relationを安定IDと存在状態へ解決するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Topic／Meeting／CHG Relationを安定IDと存在状態へ解決するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("Topic／Meeting／CHG Relationを安定IDと存在状態へ解決する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-topic-relations-"));
  try {
    const application = createTopicMeetingOperations(
      createTopicMeetingRepository(root),
    );
    application.create("meeting", meeting([]));
    application.create(
      "topic",
      topic("TOPIC-000001", {
        relation: "MTG-000001 / CHG-000010 / TOPIC-999999",
      }),
    );
    const changeDirectory = path.join(
      root,
      "99_Roadmap",
      "Changes",
      "CHG-000010",
    );
    mkdirSync(changeDirectory, { recursive: true });
    writeFileSync(
      path.join(changeDirectory, "change.md"),
      "# Change\n",
      "utf8",
    );

    assert.deepEqual(application.relations("topic", "TOPIC-000001"), [
      { id: "CHG-000010", kind: "change", state: "available" },
      { id: "MTG-000001", kind: "meeting", state: "available" },
      { id: "TOPIC-999999", kind: "topic", state: "not_found" },
    ]);
    assert.deepEqual(application.relations("topic", "TOPIC-999999"), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Topicを実在CHGへ昇格し状態・Relation・改訂を同時更新するを検証する。
 *
 * @responsibility Topicを実在CHGへ昇格し状態・Relation・改訂を同時更新するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Topicを実在CHGへ昇格し状態・Relation・改訂を同時更新するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("Topicを実在CHGへ昇格し状態・Relation・改訂を同時更新する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-topic-promote-"));
  try {
    const application = createTopicMeetingOperations(
      createTopicMeetingRepository(root),
    );
    application.create("topic", topic("TOPIC-000001"));
    const missing = application.promoteTopic({
      topicId: "TOPIC-000001",
      expectedRevision: 1,
      changeId: "CHG-000010",
      reason: "具体的な変更を採用した",
      remainingResponsibility: "CHG完了後にTopic Closeを判断する",
    });
    assert.equal(missing.status, "blocked");
    assert.equal(missing.reason, "topic_promotion_target_not_found");
    assert.equal(missing.filesystemEffectCount, 0);

    const changeDirectory = path.join(
      root,
      "99_Roadmap",
      "Changes",
      "CHG-000010",
    );
    mkdirSync(changeDirectory, { recursive: true });
    writeFileSync(
      path.join(changeDirectory, "change.md"),
      "# Change\n",
      "utf8",
    );
    const promoted = application.promoteTopic({
      topicId: "TOPIC-000001",
      expectedRevision: 1,
      changeId: "CHG-000010",
      reason: "具体的な変更を採用した",
      remainingResponsibility: "CHG完了後にTopic Closeを判断する",
    });
    assert.equal(promoted.status, "completed");
    assert.equal(promoted.reason, "topic_promoted");
    assert.equal(promoted.record?.revision, 2);
    assert.equal(promoted.record?.state, "promoted");
    const document = application.getDocument("topic", "TOPIC-000001");
    assert.match(document?.markdown ?? "", /\| promoted-to \| `CHG-000010`/u);
    assert.match(document?.markdown ?? "", /\| 昇格先 \| `CHG-000010` \|/u);
    assert.match(
      document?.markdown ?? "",
      /\| 残る影響 \| CHG完了後にTopic Closeを判断する \|/u,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Meeting OutcomeをTopicへ移管し全件処置後にCloseするを検証する。
 *
 * @responsibility Meeting OutcomeをTopicへ移管し全件処置後にCloseするを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Meeting OutcomeをTopicへ移管し全件処置後にCloseするの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("Meeting OutcomeをTopicへ移管し全件処置後にCloseする", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-meeting-outcome-"));
  try {
    const application = createTopicMeetingOperations(
      createTopicMeetingRepository(root),
    );
    application.create("topic", topic("TOPIC-000001"));
    application.create("meeting", meeting());
    const result = application.treatMeetingOutcome({
      meetingId: "MTG-000001",
      expectedRevision: 1,
      outcomeId: "OUT-001",
      disposition: "transferred",
      owner: "Project Operator",
      reviewTrigger: "TOPIC更新時",
      target: { kind: "topic", reference: "TOPIC-000001" },
      treatment: "継続論点として移管",
      completionCondition: "Topicで結論を記録する",
      result: "Topicへ移管済み",
      closeMeeting: true,
    });
    assert.equal(result.status, "completed");
    assert.equal(result.reason, "meeting_outcome_treated");
    assert.equal(result.record && "state" in result.record, true);
    const document = application.getDocument("meeting", "MTG-000001");
    assert.equal(document?.record.revision, 2);
    assert.equal("state" in (document?.record ?? {}), true);
    assert.match(document?.markdown ?? "", /状態: `closed`/u);
    assert.match(
      document?.markdown ?? "",
      /`transferred` \| Project Operator \| TOPIC更新時 \| `TOPIC-000001`/u,
    );
    assert.match(document?.markdown ?? "", /`N\/A: pending Outcomeなし`/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Outcome移管先不存在と未処置Outcomeを残すCloseをEffect 0で拒否するを検証する。
 *
 * @responsibility Outcome移管先不存在と未処置Outcomeを残すCloseをEffect 0で拒否するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Outcome移管先不存在と未処置Outcomeを残すCloseをEffect 0で拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("Outcome移管先不存在と未処置Outcomeを残すCloseをEffect 0で拒否する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-meeting-outcome-block-"));
  try {
    const application = createTopicMeetingOperations(
      createTopicMeetingRepository(root),
    );
    application.create("meeting", meeting(["OUT-001", "OUT-002"]));
    const absent = application.treatMeetingOutcome({
      meetingId: "MTG-000001",
      expectedRevision: 1,
      outcomeId: "OUT-001",
      disposition: "transferred",
      owner: "PM",
      reviewTrigger: "次回確認",
      target: { kind: "topic", reference: "TOPIC-999999" },
      treatment: "移管",
      completionCondition: "Topicで処置する",
      result: "移管予定",
      closeMeeting: false,
    });
    assert.deepEqual(
      [absent.status, absent.reason, absent.filesystemEffectCount],
      ["blocked", "meeting_outcome_target_not_found", 0],
    );
    const prematureClose = application.treatMeetingOutcome({
      meetingId: "MTG-000001",
      expectedRevision: 1,
      outcomeId: "OUT-001",
      disposition: "completed",
      owner: "PM",
      reviewTrigger: "処置済み",
      target: { kind: "none", reference: "N/A: 完了" },
      treatment: "完了",
      completionCondition: "確認済み",
      result: "完了",
      closeMeeting: true,
    });
    assert.deepEqual(
      [
        prematureClose.status,
        prematureClose.reason,
        prematureClose.filesystemEffectCount,
      ],
      ["blocked", "meeting_outcome_invalid", 0],
    );
    assert.equal(application.get("meeting", "MTG-000001")?.revision, 1);

    mkdirSync(path.join(root, "99_Roadmap", "Changes", "CHG-000001"), {
      recursive: true,
    });
    writeFileSync(
      path.join(root, "99_Roadmap", "Changes", "CHG-000001", "change.md"),
      "# CHG-000001\n",
      "utf8",
    );
    const promoted = application.treatMeetingOutcome({
      meetingId: "MTG-000001",
      expectedRevision: 1,
      outcomeId: "OUT-001",
      disposition: "promoted",
      owner: "Change Owner",
      reviewTrigger: "CHG完了時",
      target: { kind: "change", reference: "CHG-000001" },
      treatment: "採用済み変更として昇格",
      completionCondition: "CHGの受入条件を満たす",
      result: "CHGへ昇格済み",
      closeMeeting: false,
    });
    assert.equal(promoted.status, "completed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
