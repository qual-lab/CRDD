/**
 * mcp:integration:topic-meetingの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility mcp:integration:topic-meetingが宣言する検証責務と終了後条件を所有する。
 * @trace CPR-IT-008
 * @level IT
 * @scope mcp、contract、node_process
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createTopicApplication } from "../../../domain-model/src/topic/index.ts";
import { createMeetingApplication } from "../../../domain-model/src/meeting/index.ts";
import {
  handleMcpApplicationRequest,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  MCP_MEETING_TREAT_OUTCOME_TOOL,
  MCP_TOPIC_CREATE_TOOL,
  MCP_TOPIC_GET_TOOL,
  MCP_TOPIC_LIST_TOOL,
  MCP_TOPIC_PROMOTE_TOOL,
  MCP_TOPIC_UPDATE_TOOL,
} from "../../src/index.ts";

const META = Object.freeze({
  "io.modelcontextprotocol/protocolVersion":
    MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
});

/**
 * call用の試験入力または観測処理を提供する。
 *
 * @responsibility call用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus callの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
function call(name: string, args: Readonly<Record<string, unknown>>) {
  return Object.freeze({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: Object.freeze({ _meta: META, name, arguments: args }),
  });
}

/**
 * result用の試験入力または観測処理を提供する。
 *
 * @responsibility result用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus resultの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
function result(response: unknown) {
  return response as Readonly<{
    result: Readonly<{
      isError: boolean;
      structuredContent: Readonly<{
        records?: readonly unknown[];
        markdown?: unknown;
      }>;
    }>;
  }>;
}

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
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
function topic(revision: number, state = "open") {
  return `# Topic MCP\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`PRJ-001\`\n状態: \`${state}\`\n改訂: \`${revision}\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\nMCP接続を検証する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | \`N/A: 関係なし\` | fixture |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: open／waitingでは未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
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
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
function meeting() {
  return `# MCP Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`PRJ-001\`\n状態: \`recorded\`\n開催日時: \`2026-09-27 10:00 JST\`\n改訂: \`1\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\nMCP Outcome処置を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 確認する | \`pending\` | PM | 次回 | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: Outcome処置後に評価する\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正ではない\` |\n| 残る影響 | |\n`;
}

/**
 * MCPからTopicを登録・一覧・取得・更新するを検証する。
 *
 * @responsibility MCPからTopicを登録・一覧・取得・更新するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus MCPからTopicを登録・一覧・取得・更新するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPからTopicを登録・一覧・取得・更新する", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-mcp-topic-"));
  try {
    const topicMeeting = Object.freeze({
      topic: createTopicApplication(root),
      meeting: createMeetingApplication(root),
    });
    const dependencies = {
      projectContext: {
        readPortfolio: async () =>
          Object.freeze({
            projects: Object.freeze([]),
            retainedAsSourceOfTruth: false,
          }),
      },
      topicMeeting,
    };
    const created = await handleMcpApplicationRequest(
      call(MCP_TOPIC_CREATE_TOOL, { markdown: topic(1) }),
      dependencies,
    );
    assert.equal(result(created).result.isError, false);
    const listed = await handleMcpApplicationRequest(
      call(MCP_TOPIC_LIST_TOOL, { limit: 20 }),
      dependencies,
    );
    assert.equal(result(listed).result.structuredContent.records?.length, 1);
    const fetched = await handleMcpApplicationRequest(
      call(MCP_TOPIC_GET_TOOL, { id: "TOPIC-000042" }),
      dependencies,
    );
    assert.match(
      String(result(fetched).result.structuredContent.markdown),
      /MCP接続を検証/u,
    );
    const updated = await handleMcpApplicationRequest(
      call(MCP_TOPIC_UPDATE_TOOL, {
        id: "TOPIC-000042",
        expectedRevision: 1,
        markdown: topic(2, "waiting"),
      }),
      dependencies,
    );
    assert.equal(result(updated).result.isError, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * MCPからMeeting Outcomeを処置してCloseするを検証する。
 *
 * @responsibility MCPからMeeting Outcomeを処置してCloseするを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus MCPからMeeting Outcomeを処置してCloseするの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPからMeeting Outcomeを処置してCloseする", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-mcp-meeting-outcome-"));
  try {
    const topicMeeting = Object.freeze({
      topic: createTopicApplication(root),
      meeting: createMeetingApplication(root),
    });
    topicMeeting.meeting.create(meeting());
    const response = await handleMcpApplicationRequest(
      call(MCP_MEETING_TREAT_OUTCOME_TOOL, {
        meetingId: "MTG-000042",
        expectedRevision: 1,
        outcomeId: "OUT-001",
        disposition: "completed",
        owner: "PM",
        reviewTrigger: "処置済み",
        targetKind: "none",
        targetReference: "N/A: 完了",
        treatment: "完了",
        completionCondition: "確認済み",
        result: "完了",
        closeMeeting: true,
      }),
      {
        projectContext: {
          readPortfolio: async () =>
            Object.freeze({
              projects: Object.freeze([]),
              retainedAsSourceOfTruth: false,
            }),
        },
        topicMeeting,
      },
    );
    assert.equal(result(response).result.isError, false);
    assert.equal(topicMeeting.meeting.get("MTG-000042")?.state, "closed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * MCPからTopicを実在CHGへ昇格接続するを検証する。
 *
 * @responsibility MCPからTopicを実在CHGへ昇格接続するを検証するの検証責務を所有する。
 * @trace CPR-IT-008
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus MCPからTopicを実在CHGへ昇格接続するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPからTopicを実在CHGへ昇格接続する", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-mcp-topic-promote-"));
  try {
    const topicMeeting = Object.freeze({
      topic: createTopicApplication(root),
      meeting: createMeetingApplication(root),
    });
    topicMeeting.topic.create(topic(1));
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
    const response = await handleMcpApplicationRequest(
      call(MCP_TOPIC_PROMOTE_TOOL, {
        topicId: "TOPIC-000042",
        expectedRevision: 1,
        changeId: "CHG-000010",
        reason: "変更を採用した",
        remainingResponsibility: "CHG完了後にCloseを判断する",
      }),
      {
        projectContext: {
          readPortfolio: async () =>
            Object.freeze({
              projects: Object.freeze([]),
              retainedAsSourceOfTruth: false,
            }),
        },
        topicMeeting,
      },
    );
    assert.equal(result(response).result.isError, false);
    assert.equal(topicMeeting.topic.get("TOPIC-000042")?.state, "promoted");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
