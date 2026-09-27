/**
 * project-operation:test:topic-meeting-recordの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Topic現在状態とMeeting時点記録の固定Markdown Reader契約を検証する。
 * @trace CPR-IT-008
 * @level IT
 * @scope project-operation、topic、meeting、record-reader、outcome-close
 * @boundary CPR-IT-008=Direct Boundary: Topic・Meeting Markdown→Project Operation Reader→Consumer Read Model
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseMeetingMarkdown, parseTopicMarkdown } from "../../src/index.ts";

const topicMarkdown = `# 認証方式の選択

成果物種別: Topic
Topic ID: \`TOPIC-000042\`
Project ID: \`PRJ-001\`
状態: \`waiting\`
改訂: \`3\`
維持責任者: \`Project Operator\`

## 1. 現在の論点

### 結論

利用環境別の認証方式を確定するため、運用担当者の回答を待っている。
`;

const meetingMarkdown = (
  state: "recorded" | "closed",
  outcomeState: string,
) => `# Weekly Sync

成果物種別: Meeting
Meeting ID: \`MTG-000042\`
Project ID: \`PRJ-001\`
状態: \`${state}\`
開催日時: \`2026-09-27 10:00 JST\`
改訂: \`2\`
維持責任者: \`Project Operator\`

## 1. 目的と要約

### 結論

認証方式は継続検討とし、担当者へ確認を移管した。

## 4. Outcome

| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |
|---|---|---|---|---|---|---|
| \`OUT-001\` | Action | 運用担当へ確認 | \`${outcomeState}\` | PM | 次回会議 | \`TOPIC-000042\` |
`;

/**
 * TopicとMeetingを別のRead Modelへ変換することを検証する。
 *
 * @responsibility Topic Lifecycle状態とMeeting時点・Outcome状態を混同しない判定を所有する。
 * @trace CPR-IT-008
 * @precondition 固定Metadataと先行要約を持つTopic／Meeting Markdownを用意する。
 * @stimulus 各Readerへ正常Recordを入力する。
 * @observation Identity、状態、改訂、要約、開催日時およびpending Outcome件数を観測する。
 * @oracle Topicはwaitingを保持し、recorded Meetingはpending Outcomeを1件として返す。
 * @cleanup N/A: 文字列解析だけである。
 * @boundary CPR-IT-008=Direct Boundary: Topic・Meeting Markdown→Project Operation Reader→Consumer Read Model
 */
test("Topic現在状態とMeeting時点記録を分けて読む", () => {
  assert.deepEqual(parseTopicMarkdown(topicMarkdown), {
    topicId: "TOPIC-000042",
    projectId: "PRJ-001",
    state: "waiting",
    revision: 3,
    owner: "Project Operator",
    title: "認証方式の選択",
    summary:
      "利用環境別の認証方式を確定するため、運用担当者の回答を待っている。",
  });
  const meeting = parseMeetingMarkdown(meetingMarkdown("recorded", "pending"));
  assert.equal(meeting.meetingId, "MTG-000042");
  assert.equal(meeting.state, "recorded");
  assert.equal(meeting.pendingOutcomeCount, 1);
  assert.equal(meeting.occurredAt, "2026-09-27 10:00 JST");
});

/**
 * pending Outcomeを持つMeetingをclosedとして受理しないことを検証する。
 *
 * @responsibility Meeting Close前のOutcome全件処置不変条件を判定する。
 * @trace CPR-IT-008
 * @precondition closed状態とpending Outcomeを同時に持つ反例を用意する。
 * @stimulus Meeting Readerへ反例を入力する。
 * @observation 拒否理由を観測する。
 * @oracle meeting_record_pending_outcomeで拒否し、完了Recordを返さない。
 * @cleanup N/A: 文字列解析だけである。
 * @boundary CPR-IT-008=Direct Boundary: Topic・Meeting Markdown→Project Operation Reader→Consumer Read Model
 */
test("pending Outcomeを持つMeeting Closeを拒否する", () => {
  assert.throws(
    () => parseMeetingMarkdown(meetingMarkdown("closed", "pending")),
    /meeting_record_pending_outcome/u,
  );
  assert.equal(
    parseMeetingMarkdown(meetingMarkdown("closed", "transferred"))
      .pendingOutcomeCount,
    0,
  );
});
