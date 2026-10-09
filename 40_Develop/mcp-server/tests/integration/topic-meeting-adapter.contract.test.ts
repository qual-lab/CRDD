/**
 * mcp:integration:topic-meetingの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility mcp:integration:topic-meetingが宣言する検証責務と終了後条件を所有する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @level IT
 * @scope mcp、contract、node_process
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
 * @boundary CPR-IT-012=Direct Boundary: MCP Tool Call→Domain保存故障の公開応答
 */
import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";

import { createTopicOperations } from "../../../domain-model/src/index.ts";
import { createMeetingOperations } from "../../../domain-model/src/index.ts";
import {
  routeMcpRequest,
  getMcpTopicMeetingToolDefinitions,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  MCP_MEETING_TREAT_OUTCOME_TOOL,
  MCP_MEETING_CREATE_TOOL,
  MCP_MEETING_UPDATE_TOOL,
  MCP_TOPIC_CREATE_TOOL,
  MCP_TOPIC_GET_TOOL,
  MCP_TOPIC_LIST_TOOL,
  MCP_TOPIC_PROMOTE_TOOL,
  MCP_TOPIC_UPDATE_TOOL,
} from "../../src/index.ts";

const META = Object.freeze({
  "io.modelcontextprotocol/protocolVersion": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
});

/**
 * MCPの入力拒否と保存中故障の返却を分離する。
 *
 * @responsibility 公開Schema、一覧の意味拒否、内部故障を別々に観測する。
 * @trace CPR-IT-012
 * @precondition 検証済みRepositoryの自己生成試験領域にTopic操作を構成する。
 * @stimulus 不正入力、一覧条件、保存前および保存後の例外をTool Callへ渡す。
 * @observation Protocol code、固定本文、呼出し件数、保存後Revisionを確認する。
 * @oracle 入力拒否は-32602、未知例外は-32603で秘密を公開せず、保存後変更をEffect 0へ丸めない。
 * @cleanup 自己生成Rootだけをfinallyで回収する。
 * @boundary MCP Tool Call→Domain操作→Repository保存のDirect Boundary。
 */
test("MCPは入力拒否と保存中の内部故障を区別する", async () => {
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    import.meta.dirname,
  );
  const testArea = path.join(repositoryRoot, ".crdd", "tests");
  for (const directory of [path.join(repositoryRoot, ".crdd"), testArea]) {
    if (existsSync(directory)) {
      const entry = lstatSync(directory);
      assert.equal(entry.isSymbolicLink(), false);
      assert.equal(entry.isDirectory(), true);
    } else mkdirSync(directory);
  }
  const root = mkdtempSync(path.join(testArea, "mcp-record-failure-"));
  try {
    const topics = createTopicOperations(root);
    const meetings = createMeetingOperations(root);
    let calls = 0;
    const dependencies = {
      projectContext: {
        readPortfolio: async () =>
          Object.freeze({
            projects: Object.freeze([]),
            retainedAsSourceOfTruth: false,
          }),
      },
      topicMeeting: {
        topic: {
          ...topics,
          list: (input: Parameters<typeof topics.list>[0]) => {
            calls++;
            return topics.list(input);
          },
          getDocument: (id: string) => {
            calls++;
            return topics.getDocument(id);
          },
          create: (_markdown: string) => {
            calls++;
            throw new Error("secret-token C:/private/failure");
          },
          update: (input: Parameters<typeof topics.update>[0]) => {
            calls++;
            assert.equal(topics.update(input).status, "completed");
            throw new Error("project_operation_list_query_invalid");
          },
          promoteTopic: (input: Parameters<typeof topics.promoteTopic>[0]) => {
            calls++;
            return topics.promoteTopic(input);
          },
        },
        meeting: {
          ...meetings,
          create: (markdown: string) => {
            calls++;
            return meetings.create(markdown);
          },
          update: (input: Parameters<typeof meetings.update>[0]) => {
            calls++;
            return meetings.update(input);
          },
          treatMeetingOutcome: (
            input: Parameters<typeof meetings.treatMeetingOutcome>[0],
          ) => {
            calls++;
            return meetings.treatMeetingOutcome(input);
          },
        },
      },
    };
    for (const [name, args] of [
      [MCP_TOPIC_GET_TOOL, { id: "bad-id" }],
      [MCP_TOPIC_GET_TOOL, { id: "MTG-000042" }],
      [MCP_TOPIC_LIST_TOOL, { limit: 0 }],
      [MCP_TOPIC_LIST_TOOL, { limit: 1.5 }],
      [MCP_TOPIC_LIST_TOOL, { limit: 101 }],
      [
        MCP_TOPIC_LIST_TOOL,
        { states: ["open", "open", "open", "open", "open"] },
      ],
      [
        MCP_TOPIC_UPDATE_TOOL,
        { id: "TOPIC-000042", expectedRevision: 0, markdown: topic(2) },
      ],
      [MCP_TOPIC_CREATE_TOOL, { markdown: 42 }],
      [MCP_TOPIC_CREATE_TOOL, { markdown: "invalid" }],
      [MCP_MEETING_CREATE_TOOL, { markdown: "invalid" }],
      [
        MCP_TOPIC_UPDATE_TOOL,
        { id: "TOPIC-000042", expectedRevision: 1, markdown: "invalid" },
      ],
      [
        MCP_MEETING_UPDATE_TOOL,
        { id: "MTG-000042", expectedRevision: 1, markdown: "invalid" },
      ],
      [
        MCP_TOPIC_PROMOTE_TOOL,
        {
          topicId: "TOPIC-000042",
          expectedRevision: 1,
          changeId: "bad",
          reason: "promote",
          remainingResponsibility: "close",
        },
      ],
      ...(["topic", "change"] as const).map(
        (targetKind) =>
          [
            MCP_MEETING_TREAT_OUTCOME_TOOL,
            {
              meetingId: "MTG-000042",
              expectedRevision: 1,
              outcomeId: "OUT-001",
              disposition: targetKind === "topic" ? "transferred" : "promoted",
              owner: "PM",
              reviewTrigger: "next",
              targetKind,
              targetReference: "bad",
              treatment: "transfer",
              completionCondition: "complete",
              result: "pending",
              closeMeeting: false,
            },
          ] as const,
      ),
    ] as const) {
      const response = await routeMcpRequest(call(name, args), dependencies);
      assert.deepEqual(response, {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32602, message: "Invalid params" },
      });
      assert.equal(calls, 0);
    }
    for (const args of [
      { sort: "bad-sort" },
      { cursor: "broken" },
      { relation: "bad-relation" },
    ]) {
      const previous = calls;
      const response = await routeMcpRequest(
        call(MCP_TOPIC_LIST_TOOL, args),
        dependencies,
      );
      assert.deepEqual(response, {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32602, message: "Invalid params" },
      });
      assert.equal(calls, previous + 1);
    }
    const previous = calls;
    const failed = await routeMcpRequest(
      call(MCP_TOPIC_CREATE_TOOL, { markdown: topic(1) }),
      dependencies,
    );
    assert.deepEqual(failed, {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "Internal error" },
    });
    assert.equal(calls, previous + 1);
    assert.equal(topics.get("TOPIC-000042"), null);
    assert.equal(topics.create(topic(1)).status, "completed");
    assert.equal(meetings.create(meeting()).status, "completed");
    for (const [name, args] of [
      [
        MCP_TOPIC_PROMOTE_TOOL,
        {
          topicId: "TOPIC-000042",
          expectedRevision: 1,
          changeId: "bad",
          reason: "promote",
          remainingResponsibility: "close",
        },
      ],
      ...(["topic", "change"] as const).map(
        (targetKind) =>
          [
            MCP_MEETING_TREAT_OUTCOME_TOOL,
            {
              meetingId: "MTG-000042",
              expectedRevision: 1,
              outcomeId: "OUT-001",
              disposition: targetKind === "topic" ? "transferred" : "promoted",
              owner: "PM",
              reviewTrigger: "next",
              targetKind,
              targetReference: "bad",
              treatment: "transfer",
              completionCondition: "complete",
              result: "pending",
              closeMeeting: false,
            },
          ] as const,
      ),
    ] as const) {
      const response = await routeMcpRequest(call(name, args), dependencies);
      assert.deepEqual(response, {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32602, message: "Invalid params" },
      });
      assert.equal(calls, previous + 1);
    }
    const updated = await routeMcpRequest(
      call(MCP_TOPIC_UPDATE_TOOL, {
        id: "TOPIC-000042",
        expectedRevision: 1,
        markdown: topic(2),
      }),
      dependencies,
    );
    assert.deepEqual(updated, {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "Internal error" },
    });
    assert.equal(calls, previous + 2);
    assert.equal(topics.get("TOPIC-000042")?.revision, 2);
    const listFailure = await routeMcpRequest(call(MCP_TOPIC_LIST_TOOL, {}), {
      ...dependencies,
      topicMeeting: {
        ...dependencies.topicMeeting,
        topic: {
          ...topics,
          list: () => {
            throw new Error("secret-list C:/private/list");
          },
        },
      },
    });
    assert.deepEqual(listFailure, {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "Internal error" },
    });
    for (const definition of getMcpTopicMeetingToolDefinitions()) {
      const properties = definition.inputSchema.properties;
      if ("id" in properties) {
        const schema = properties.id as { pattern: string };
        assert.equal(
          new RegExp(schema.pattern, "u").test(
            definition.name.includes("meeting") ? "MTG-000042" : "TOPIC-000042",
          ),
          true,
        );
        assert.equal(new RegExp(schema.pattern, "u").test("bad-id"), false);
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * call用の試験入力または観測処理を提供する。
 *
 * @responsibility call用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus callの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
 * @boundary CPR-IT-012=Direct Boundary: MCP Tool Call→Domain保存故障の公開応答
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
 * @trace CPR-IT-010
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus resultの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
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
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus topicの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
 * @boundary CPR-IT-012=Direct Boundary: MCP Tool Call→Domain保存故障の公開応答
 */
function topic(revision: number, state = "open") {
  return `# Topic MCP\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`PRJ-001\`\n状態: \`${state}\`\n改訂: \`${revision}\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\nMCP接続を検証する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | \`N/A: 関係なし\` | fixture |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: open／waitingでは未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
}

/**
 * meeting用の試験入力または観測処理を提供する。
 *
 * @responsibility meeting用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus meetingの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
 * @boundary CPR-IT-012=Direct Boundary: MCP Tool Call→Domain保存故障の公開応答
 */
function meeting() {
  return `# MCP Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`PRJ-001\`\n状態: \`recorded\`\n開催日時: \`2026-09-27 10:00 JST\`\n改訂: \`1\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\nMCP Outcome処置を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 確認する | \`pending\` | PM | 次回 | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: Outcome処置後に評価する\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正ではない\` |\n| 残る影響 | |\n`;
}

/**
 * MCPからTopicを登録・一覧・取得・更新するを検証する。
 *
 * @responsibility MCPからTopicを登録・一覧・取得・更新するを検証するの検証責務を所有する。
 * @trace CPR-IT-010
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus MCPからTopicを登録・一覧・取得・更新するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPからTopicを登録・一覧・取得・更新する", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-mcp-topic-"));
  try {
    const topicMeeting = Object.freeze({
      topic: createTopicOperations(root),
      meeting: createMeetingOperations(root),
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
    const created = await routeMcpRequest(
      call(MCP_TOPIC_CREATE_TOOL, { markdown: topic(1) }),
      dependencies,
    );
    assert.equal(result(created).result.isError, false);
    const listed = await routeMcpRequest(
      call(MCP_TOPIC_LIST_TOOL, { limit: 20 }),
      dependencies,
    );
    assert.equal(result(listed).result.structuredContent.records?.length, 1);
    const fetched = await routeMcpRequest(
      call(MCP_TOPIC_GET_TOOL, { id: "TOPIC-000042" }),
      dependencies,
    );
    assert.match(
      String(result(fetched).result.structuredContent.markdown),
      /MCP接続を検証/u,
    );
    const updated = await routeMcpRequest(
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
 * @trace CPR-IT-010
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus MCPからMeeting Outcomeを処置してCloseするの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPからMeeting Outcomeを処置してCloseする", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-mcp-meeting-outcome-"));
  try {
    const topicMeeting = Object.freeze({
      topic: createTopicOperations(root),
      meeting: createMeetingOperations(root),
    });
    topicMeeting.meeting.create(meeting());
    const response = await routeMcpRequest(
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
 * @trace CPR-IT-010
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus MCPからTopicを実在CHGへ昇格接続するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: mcp Test Source→対象契約
 */
test("MCPからTopicを実在CHGへ昇格接続する", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-mcp-topic-promote-"));
  try {
    const topicMeeting = Object.freeze({
      topic: createTopicOperations(root),
      meeting: createMeetingOperations(root),
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
    const response = await routeMcpRequest(
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
