/**
 * Topic／Meeting Repository CRUD契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 登録・編集・削除・一覧・取得、改訂競合およびRelation付き削除拒否を実Filesystemで確認する。
 * @trace CPR-IT-008
 * @level IT
 * @scope project-operation、topic、meeting、crud、repository
 * @boundary Application CRUD→Repository Filesystem→Canonical Markdown
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createTopicMeetingRepository } from "../../src/index.ts";

/** Topic Fixtureを指定Revisionで構築する。 */
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
function topic(revision: number, state = "open") {
  return `# 認証方式の選択

成果物種別: Topic
Topic ID: \`TOPIC-000042\`
Project ID: \`PRJ-001\`
状態: \`${state}\`
改訂: \`${revision}\`
維持責任者: \`Project Operator\`

## 1. 現在の論点

### 結論

利用環境別の認証方式を確定する。
`;
}

/** Meeting Fixtureを指定Revisionで構築する。 */
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
function meeting(revision: number) {
  return `# Weekly Sync

成果物種別: Meeting
Meeting ID: \`MTG-000042\`
Project ID: \`PRJ-001\`
状態: \`recorded\`
開催日時: \`2026-09-27 10:00 JST\`
改訂: \`${revision}\`
維持責任者: \`Project Operator\`

## 1. 目的と要約

### 結論

認証方式の継続検討を確認した。

## 4. Outcome

| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |
|---|---|---|---|---|---|---|
| \`OUT-001\` | Action | 運用担当へ確認 | \`transferred\` | PM | 次回会議 | \`TOPIC-000042\` |
`;
}

/**
 * TopicとMeetingのCRUDを同じRepository契約で処理する。
 *
 * @responsibility CRUD結果、RevisionおよびCanonical Pathを検証する。
 * @trace CPR-IT-008
 * @precondition 空の検証用Repository Rootを作る。
 * @stimulus TopicとMeetingを登録し、Topicを更新して一覧・取得する。
 * @observation 結果、改訂およびFilesystem Effect件数を観測する。
 * @oracle 各正本は固定Pathへ一件だけ存在し、競合更新はEffect 0となる。
 * @cleanup 検証用Rootを削除する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("TopicとMeetingの登録・編集・一覧・取得を同じ契約で処理する", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-topic-meeting-"));
  try {
    const repository = createTopicMeetingRepository(root);
    assert.equal(repository.list("topic").status, "not_configured");
    assert.equal(repository.create("topic", topic(1)).status, "completed");
    assert.equal(repository.create("meeting", meeting(1)).status, "completed");
    assert.equal(repository.list("topic").records.length, 1);
    assert.equal(repository.get("meeting", "MTG-000042")?.revision, 1);

    const updated = repository.update(
      "topic",
      "TOPIC-000042",
      1,
      topic(2, "waiting"),
    );
    assert.equal(updated.status, "completed");
    assert.equal(repository.get("topic", "TOPIC-000042")?.revision, 2);
    const conflicted = repository.update("topic", "TOPIC-000042", 1, topic(2));
    assert.equal(conflicted.reason, "record_revision_conflict");
    assert.equal(conflicted.filesystemEffectCount, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * Relation付きRecordを確認なしで物理削除しない。
 *
 * @responsibility 影響表示、Relation解消、明示確認および対象限定削除を検証する。
 * @trace CPR-IT-008
 * @precondition Topicと、そのIDを参照するMeetingを作成する。
 * @stimulus 未確認削除、Relation付き削除、Relation解消後の確認済み削除を順に要求する。
 * @observation 拒否理由、Relation Path、Effect件数および残存Recordを観測する。
 * @oracle Relation中はEffect 0で、解消後の誤登録理由＋明示確認だけが対象Topicを削除する。
 * @cleanup 検証用Rootを削除する。
 * @boundary CPR-IT-008=Direct Boundary: project-operation Test Source→対象契約
 */
test("Relation解消と明示確認なしに物理削除しない", () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-topic-delete-"));
  try {
    const repository = createTopicMeetingRepository(root);
    repository.create("topic", topic(1));
    repository.create("meeting", meeting(1));
    const impact = repository.inspectDeletion("topic", "TOPIC-000042");
    assert.deepEqual(impact.relationPaths, [
      "23_Meetings/MTG-000042/meeting.md",
    ]);
    const blocked = repository.delete({
      kind: "topic",
      id: "TOPIC-000042",
      expectedRevision: 1,
      confirmed: true,
      reason: "mistaken_registration",
    });
    assert.equal(blocked.reason, "record_relations_require_resolution");
    assert.equal(blocked.filesystemEffectCount, 0);

    rmSync(path.join(root, "23_Meetings"), { recursive: true });
    const confirmationRequired = repository.delete({
      kind: "topic",
      id: "TOPIC-000042",
      expectedRevision: 1,
      confirmed: false,
      reason: "mistaken_registration",
    });
    assert.equal(
      confirmationRequired.reason,
      "record_delete_confirmation_required",
    );
    const deleted = repository.delete({
      kind: "topic",
      id: "TOPIC-000042",
      expectedRevision: 1,
      confirmed: true,
      reason: "mistaken_registration",
    });
    assert.equal(deleted.reason, "record_deleted");
    assert.equal(repository.get("topic", "TOPIC-000042"), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
