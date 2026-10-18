/**
 * workbench:integration:project-surfaceの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Workbenchが共通Project Context Readerを利用し、未構成Capabilityを0件へ畳まないことを検証する。
 * @trace CPR-IT-008
 * @trace PPR-IT-019
 * @level IT
 * @scope workbench、project-context、topic、meeting、read-model
 * @boundary PPR-IT-019=Direct Boundary: Repository→Project Operation Reader→Workbench Project Surface
 */
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  parseRepositoryQualityProjectionMarkdown,
  parseRepositoryReleaseProjectionMarkdown,
} from "../../../domain-model/src/index.ts";
import {
  readWorkbenchProjectSurface,
  readWorkbenchOwnerArtifactCatalog,
  readWorkbenchOwnerArtifact,
} from "../../src/index.ts";

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
 * @boundary PPR-IT-019=Direct Boundary: workbench Test Source→対象契約
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
  assert.equal(surface.ownerArtifacts.state, "available");
  assert.equal(surface.plan.state, "available");
  const release = parseRepositoryReleaseProjectionMarkdown(
    await readFile(
      path.join(repositoryRoot, "99_Roadmap", "03_Releases.md"),
      "utf8",
    ),
  );
  assert.equal(release.targetVersion, "v0.22.0");
  assert.deepEqual(surface.plan.projection, release);
  assert.equal(surface.quality.state, "available");
  assert.equal(surface.quality.projection?.target, "v0.22.0");
  const quality = parseRepositoryQualityProjectionMarkdown(
    await readFile(
      path.join(repositoryRoot, "07_Quality", "01_Quality_Center.md"),
      "utf8",
    ),
  );
  assert.ok(quality.unobserved.length > 0);
  assert.deepEqual(surface.quality.projection, quality);
  assert.ok(
    surface.ownerArtifacts.artifacts.some(
      (artifact) => artifact.relativePath === "99_Roadmap/01_Roadmap.md",
    ),
  );
  assert.ok(
    surface.ownerArtifacts.artifacts.some(
      (artifact) => artifact.relativePath === "99_Roadmap/03_Releases.md",
    ),
  );
  assert.ok(
    surface.ownerArtifacts.artifacts.some(
      (artifact) => artifact.relativePath === "07_Quality/01_Quality_Center.md",
    ),
  );
  assert.ok(
    surface.ownerArtifacts.artifacts.some(
      (artifact) =>
        artifact.origin === "project_context" &&
        artifact.sourceSection === "1. 今どうなっているか",
    ),
  );
  assert.deepEqual(surface.meetings.items, []);
  assert.equal(surface.repository.state, "available");
  assert.equal(surface.repository.changeSet?.observationComplete, true);
  assert.equal(surface.repository.changeSet?.repositoryPathReported, false);
});

/**
 * 一覧の bounded 見出しと本文上限を別々に検証する。
 * @responsibility 巨大文書で一覧全体を失わず、本文拒否・読取り量・終了条件を維持する。
 * @trace PPR-IT-019
 * @precondition Repository内の自己生成通常Fileだけを使う。
 * @stimulus 容量境界、完全行／途中行、UTF-8途中、欠落、read／close失敗と実体差。
 * @observation Catalog状態、表示名、本文可否、実読取り量とclose回数。
 * @oracle 一覧は8KiB以下、本文は512KiB以下、観測不能はunknown。
 * @cleanup handleを終了し、代役を復元して自己生成Rootを回収する。
 * @boundary 実FilesystemからOwner Catalog／本文API。
 */
test("Owner一覧の見出し取得は巨大本文と独立し8KiBと終了条件を守る", async (t) => {
  const parent = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(parent, { recursive: true });
  const root = await mkdtemp(path.join(parent, "owner-header-"));
  const relative = "case.md";
  const file = path.join(root, relative);
  const originalOpen = fs.promises.open;
  let fault = "",
    reads = 0,
    closes = 0;
  const mocked = t.mock.method(
    fs.promises,
    "open",
    async (...args: Parameters<typeof originalOpen>) => {
      const handle = await originalOpen(...args);
      if (String(args[0]) !== file) return handle;
      const read = handle.read.bind(handle),
        close = handle.close.bind(handle);
      handle.read = (async (...parameters: unknown[]) => {
        if (fault === "read") throw new Error("synthetic_read");
        const result = await Reflect.apply(read, handle, parameters);
        reads += result.bytesRead;
        if (fault === "replace") {
          await fs.promises.rename(file, `${file}.old`);
          await writeFile(file, "# replacement\n");
        }
        return result;
      }) as typeof handle.read;
      handle.close = async () => {
        await close();
        closes++;
        if (fault === "close") throw new Error("synthetic_close");
      };
      return handle;
    },
  );
  syncBuiltinESMExports();
  try {
    for (const fixed of [
      "99_Roadmap/01_Roadmap.md",
      "99_Roadmap/03_Releases.md",
      "07_Quality/01_Quality_Center.md",
    ]) {
      await mkdir(path.dirname(path.join(root, fixed)), { recursive: true });
      await writeFile(path.join(root, fixed), "# fixed\n");
    }
    for (const [body, title, bodyAllowed] of [
      ["# small\n", "small", true],
      [`# exact\n${"x".repeat(524288 - 8)}`, "exact", true],
      [`# large\n${"x".repeat(524289)}`, "large", false],
      [`${"x".repeat(8192)}\n# late\n`, relative, true],
      [`${"\n".repeat(8190)}# long heading\n`, relative, true],
      [`${"\n".repeat(8188)}# あいう\n`, relative, true],
      [`${"\n".repeat(8188)}# a\nmore`, "a", true],
      ["no heading", relative, true],
    ] as const) {
      await writeFile(file, body);
      reads = closes = 0;
      const catalog = await readWorkbenchOwnerArtifactCatalog(
        root,
        `[case](${relative})`,
      );
      assert.equal(catalog.state, "available");
      assert.equal(
        catalog.artifacts.find((entry) => entry.relativePath === relative)
          ?.title,
        title,
      );
      assert.ok(reads <= 8192);
      assert.equal(closes, 1);
      assert.equal(
        (await readWorkbenchOwnerArtifact(root, catalog, relative)) !== null,
        bodyAllowed,
      );
    }
    for (fault of ["read", "close", "replace"]) {
      await writeFile(file, "# original\n");
      closes = 0;
      assert.equal(
        (await readWorkbenchOwnerArtifactCatalog(root, `[case](${relative})`))
          .state,
        "unknown",
        fault,
      );
      assert.equal(closes, 1, fault);
      if (fault === "replace") assert.equal(fs.existsSync(`${file}.old`), true);
    }
    fault = "";
    await rm(file);
    assert.equal(
      (await readWorkbenchOwnerArtifactCatalog(root, `[case](${relative})`))
        .state,
      "unknown",
    );
    await mkdir(file);
    assert.equal(
      (await readWorkbenchOwnerArtifactCatalog(root, `[case](${relative})`))
        .state,
      "unknown",
    );
  } finally {
    mocked.mock.restore();
    syncBuiltinESMExports();
    await rm(root, { recursive: true, force: true });
  }
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
 * @boundary CPR-IT-008=Direct Boundary: workbench Test Source→対象契約
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
    assert.equal(surface.plan.state, "not_configured");
    assert.equal(surface.quality.state, "not_configured");
    assert.equal(surface.repository.state, "unknown");
    assert.equal(surface.repository.changeSet, null);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
