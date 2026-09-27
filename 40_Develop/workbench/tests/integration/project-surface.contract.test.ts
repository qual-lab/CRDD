/**
 * workbench:integration:project-surfaceの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Workbenchが共通Project Context Readerを利用し、未構成Capabilityを0件へ畳まないことを検証する。
 * @trace PPR-IT-019
 * @trace RFD-IT-005
 * @level IT
 * @scope workbench、project-context、topic、meeting、read-model
 * @boundary PPR-IT-019=Direct Boundary: Repository→Project Operation Reader→Workbench Project Surface
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import { readWorkbenchProjectSurface } from "../../src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * Project ContextとCapability状態を同じRepository Snapshotから取得できることを検証する。
 *
 * @responsibility Consumer固有Storeなしで五場面を取得し、未配置Topic／Meetingをnot_configuredとして保持する。
 * @trace PPR-IT-019
 * @precondition 現行RepositoryにPROJECT_CONTEXT.mdがあり、22_Topics／23_Meetingsは未配置である。
 * @stimulus 検証済みRepository RootからWorkbench Project Surfaceを読む。
 * @observation Identity、場面Key、Topic状態およびMeeting状態を観測する。
 * @oracle 五場面が同じ順序で返り、Topic／Meetingを0件またはavailableへ誤分類しない。
 * @cleanup N/A: 固定FileとMetadataの読取りだけである。
 * @boundary PPR-IT-019=Direct Boundary: Repository→Project Operation Reader→Workbench Project Surface
 */
test("共通Project Contextを読み未構成Capabilityを明示する", async () => {
  const surface = await readWorkbenchProjectSurface(repositoryRoot);

  assert.equal(surface.context.projectId, "qual-lab.crdd");
  assert.deepEqual(
    surface.context.scenes.map((scene) => scene.key),
    ["current", "risk", "decision", "reason", "next"],
  );
  assert.equal(surface.topics.state, "not_configured");
  assert.deepEqual(surface.topics.items, []);
  assert.equal(surface.meetings.state, "not_configured");
  assert.deepEqual(surface.meetings.items, []);
  assert.equal(surface.repository.state, "available");
  assert.equal(surface.repository.changeSet?.observationComplete, true);
  assert.equal(surface.repository.changeSet?.repositoryPathReported, false);
});

/**
 * Topic／Meeting正本をWorkbenchの検証済み一覧へ投影できることを検証する。
 *
 * @responsibility Directory Identityと本文Identityを照合し、実Recordを一覧へ接続する。
 * @trace CPR-IT-008
 * @precondition Repository-local試験領域にProject Contextと正しいTopic／Meeting正本を配置する。
 * @stimulus 一時Repository RootからWorkbench Project Surfaceを読む。
 * @observation Topic／Meetingの構成状態、Identity、状態およびpending Outcome数を観測する。
 * @oracle 両集合がavailableとなり、正本の値だけが一件ずつ返る。
 * @cleanup Repository-local試験領域をfinallyで再帰削除する。
 * @boundary CPR-IT-008=Direct Boundary: Topic／Meeting Markdown→Project Operation Reader→Workbench
 */
test("TopicとMeetingの正本を検証済み一覧へ投影する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixtureRoot = await mkdtemp(
    path.join(testRoot, "workbench-project-surface-"),
  );
  try {
    await writeFile(
      path.join(fixtureRoot, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    await mkdir(path.join(fixtureRoot, "22_Topics", "TOPIC-000042"), {
      recursive: true,
    });
    await writeFile(
      path.join(fixtureRoot, "22_Topics", "TOPIC-000042", "topic.md"),
      `# Workbench Topic\n\nTopic ID: \`TOPIC-000042\`\nProject ID: \`qual-lab.crdd\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`Product Owner\`\n\n### 結論\n\nWorkbenchの一覧投影を確認する。\n`,
      "utf8",
    );
    await mkdir(path.join(fixtureRoot, "23_Meetings", "MTG-000042"), {
      recursive: true,
    });
    await writeFile(
      path.join(fixtureRoot, "23_Meetings", "MTG-000042", "meeting.md"),
      `# Workbench Meeting\n\nMeeting ID: \`MTG-000042\`\nProject ID: \`qual-lab.crdd\`\n状態: \`recorded\`\n開催日時: \`2026-09-27 18:00 JST\`\n改訂: \`1\`\n維持責任者: \`Facilitator\`\n\n### 結論\n\nWorkbenchのMeeting投影を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | Reader確認 | \`pending\` | Developer | 次回確認 | \`TOPIC-000042\` |\n`,
      "utf8",
    );

    const surface = await readWorkbenchProjectSurface(fixtureRoot);

    assert.equal(surface.topics.state, "available");
    assert.equal(surface.topics.items[0]?.topicId, "TOPIC-000042");
    assert.equal(surface.meetings.state, "available");
    assert.equal(surface.meetings.items[0]?.meetingId, "MTG-000042");
    assert.equal(surface.meetings.items[0]?.pendingOutcomeCount, 1);
    assert.equal(surface.repository.state, "unknown");
    assert.equal(surface.repository.changeSet, null);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
