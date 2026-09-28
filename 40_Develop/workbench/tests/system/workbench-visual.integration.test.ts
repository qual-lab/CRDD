/**
 * workbench:system:actual-browser-visualの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Workbench Production Serverの15 Logical ScreenをDesktop／Tablet／Mobileと100%／200%／400%で実Browser検証する。
 * @trace ERB-ST-022
 * @level ST
 * @scope workbench、actual-browser、logical-screen、responsive、zoom、focus、brand、cleanup
 * @boundary ERB-ST-022=System/E2E: Workbench Production Server→専用Chrome Profile→Rendered DOM→全資源終了
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  observeLocalListener,
  verifyLocalWebApplicationVisual,
} from "../../../visual-preview/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import { startWorkbench } from "../../src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * Visual System fixture内でGit Commandを実行する。
 *
 * @responsibility Production Visual Gate前後のRepository書込み差分を通常Git観測で比較する。
 * @trace ERB-ST-022
 * @input cwdに隔離Repository、argsに固定Git引数を受け取る。
 * @returns UTF-8 stdoutを返す。
 * @precondition cwdはRepository-local `.crdd/tests`配下の隔離Fixtureである。
 * @postcondition 子Processを残さない。
 * @effect Fixture Repositoryだけを読取り、初期化時だけIndexを更新する。
 * @failure 非0終了をSystem Test失敗として送出する。
 * @invariant 実CRDD RepositoryのIndexとWorktreeを変更しない。
 * @stimulus gitの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary ERB-ST-022=Direct Boundary: workbench Test Source→対象契約
 * @security shell、CredentialおよびRemote通信を使用しない。
 * @concurrency 同一Fixture内で直列実行する。
 */
function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd,
    windowsHide: true,
    encoding: "utf8",
  }).trim();
}

/**
 * Topic Detailを表示する最小Canonical fixtureを返す。
 *
 * @responsibility Logical Screen 05へ到達できる有効なTopicを決定論的に構築する。
 * @trace ERB-ST-022
 * @input N/A: 固定Fixture値を使用する。
 * @returns Topic Markdownを返す。
 * @precondition N/A: 外部状態を使用しない。
 * @postcondition TOPIC-000042、Revision 1、open状態を含む。
 * @effect N/A: 文字列を返すだけである。
 * @failure N/A: 固定文字列である。
 * @invariant Production正本へ保存しない。
 * @stimulus topicFixtureの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary ERB-ST-022=Direct Boundary: workbench Test Source→対象契約
 * @security 秘密値または実利用者情報を含まない。
 * @concurrency N/A: 同期純粋処理である。
 */
function topicFixture(): string {
  return `# Visual Topic\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`PRJ-001\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\n15画面の実Browser表示を確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n\n## 4. 次の行動\n\n| 行動 | Owner | 期限／再評価契機 | 完了条件 | 状態 |\n|---|---|---|---|---|\n| 表示確認 | QA | 現在Gate | 全Profile完了 | \`open\` |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: 検証中\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
}

/**
 * Meeting Detailを表示する最小Canonical fixtureを返す。
 *
 * @responsibility Logical Screen 07へ到達できる有効なMeetingを決定論的に構築する。
 * @trace ERB-ST-022
 * @input N/A: 固定Fixture値を使用する。
 * @returns Meeting Markdownを返す。
 * @precondition N/A: 外部状態を使用しない。
 * @postcondition MTG-000042、Revision 1、recorded状態を含む。
 * @effect N/A: 文字列を返すだけである。
 * @failure N/A: 固定文字列である。
 * @invariant Production正本へ保存しない。
 * @stimulus meetingFixtureの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary ERB-ST-022=Direct Boundary: workbench Test Source→対象契約
 * @security 秘密値または実利用者情報を含まない。
 * @concurrency N/A: 同期純粋処理である。
 */
function meetingFixture(): string {
  return `# Visual Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`PRJ-001\`\n状態: \`recorded\`\n開催日時: \`2026-09-28 09:00 JST\`\n改訂: \`1\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\n15画面の実Browser表示を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 表示確認 | \`pending\` | QA | 現在Gate | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: Outcome処置後に評価する\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正ではない\` |\n| 残る影響 | \`OUT-001\` |\n`;
}

/**
 * Workbench 15 Logical ScreenをProduction DOMで全Profile実測する。
 *
 * @responsibility Screen Target、Direction A、公式Logo、Responsive、Zoom、Focus、Overflowおよび終了後資源の最終合否を所有する。
 * @trace ERB-ST-022
 * @precondition `CRDD_WORKBENCH_VISUAL_E2E=1`で明示実行し、対応済みChromeを利用できる。
 * @stimulus Workbench Production Serverを起動し、3 Page×3 Profile×3 Zoomを専用Browser Profileで表示する。
 * @observation 15 Target、Viewport、DPR、文字、操作対象、画像、Overflow、Focus順、Process、Profile、ListenerおよびGit状態を観測する。
 * @oracle 全Targetが可視で、閾値違反と資源残存がなく、RepositoryのCanonical状態を変更しない。
 * @cleanup Workbench Listener、Browser Process Tree、専用Profileおよび隔離Fixtureを削除する。
 * @boundary ERB-ST-022=Direct Boundary: workbench Test Source→対象契約
 */
test("Workbench 15 Logical Screenを全表示Profileと実Browser Zoomで確認する", {
  skip: process.env.CRDD_WORKBENCH_VISUAL_E2E !== "1",
}, async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(
    path.join(testRoot, "workbench-visual-system-"),
  );
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  let listenerPort = 0;
  let result: Awaited<
    ReturnType<typeof verifyLocalWebApplicationVisual>
  > | null = null;
  let beforeStatus = "";
  let afterStatus = "";
  let listenerState: Awaited<ReturnType<typeof observeLocalListener>> =
    "unknown";
  try {
    await mkdir(path.join(fixture, "04_UI", "assets", "brand"), {
      recursive: true,
    });
    await mkdir(path.join(fixture, "22_Topics", "TOPIC-000042"), {
      recursive: true,
    });
    await mkdir(path.join(fixture, "23_Meetings", "MTG-000042"), {
      recursive: true,
    });
    await copyFile(
      path.join(
        repositoryRoot,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
      path.join(
        fixture,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    await writeFile(
      path.join(fixture, "22_Topics", "TOPIC-000042", "topic.md"),
      topicFixture(),
      "utf8",
    );
    await writeFile(
      path.join(fixture, "23_Meetings", "MTG-000042", "meeting.md"),
      meetingFixture(),
      "utf8",
    );
    git(fixture, "init", "--quiet", "--initial-branch=main");
    git(fixture, "add", ".");
    beforeStatus = git(fixture, "status", "--short");

    handle = await startWorkbench({ workingDirectory: fixture });
    listenerPort = Number(new URL(handle.baseUrl).port);
    result = await verifyLocalWebApplicationVisual({
      workingDirectory: fixture,
      baseUrl: `${handle.baseUrl}/`,
      targets: Object.freeze([
        Object.freeze({
          pageId: "workbench-main",
          pagePath: "/",
          targetIds: Object.freeze([
            "portfolio",
            "overview",
            "project-plan",
            "topics",
            "meetings",
            "quality",
            "documentation",
            "runtime-activity",
            "ai-request",
            "repository",
            "connection",
            "credential-administration",
            "ai-profiles",
          ]),
        }),
        Object.freeze({
          pageId: "topic-detail",
          pagePath: "/topic?id=TOPIC-000042",
          targetIds: Object.freeze(["topic-detail"]),
        }),
        Object.freeze({
          pageId: "meeting-detail",
          pagePath: "/meeting?id=MTG-000042",
          targetIds: Object.freeze(["meeting-detail"]),
        }),
      ]),
      profiles: Object.freeze([
        Object.freeze({
          name: "desktop",
          windowSize: Object.freeze({ width: 1440, height: 900 }),
        }),
        Object.freeze({
          name: "tablet",
          windowSize: Object.freeze({ width: 1024, height: 768 }),
        }),
        Object.freeze({
          name: "mobile",
          windowSize: Object.freeze({ width: 390, height: 844 }),
        }),
      ]),
      zoomFactors: Object.freeze([1, 2, 4]),
    });
    afterStatus = git(fixture, "status", "--short");
  } finally {
    await handle?.close();
    listenerState = await observeLocalListener(listenerPort);
    await rm(fixture, { recursive: true, force: true });
  }

  assert.ok(result !== null);
  assert.equal(listenerState, "absent");
  assert.equal(afterStatus, beforeStatus);
  assert.equal(result.measurements.length, 27);
  assert.equal(
    result.status,
    "passed",
    JSON.stringify(
      result.measurements
        .filter((measurement) => !measurement.passed)
        .map((measurement) => ({
          page: measurement.documentPath,
          profile: measurement.profileName,
          zoom: measurement.requestedZoomFactor,
          failures: measurement.failures,
          viewport: [measurement.innerWidth, measurement.innerHeight],
          scrollWidth: measurement.documentScrollWidth,
          minimumFont: measurement.minimumVisibleFontSize,
          minimumTarget: [
            measurement.minimumInteractiveWidth,
            measurement.minimumInteractiveHeight,
          ],
          minimumTargetKind: [
            measurement.minimumInteractiveWidthKind,
            measurement.minimumInteractiveHeightKind,
          ],
        })),
    ),
  );
  assert.equal(result.browserCleanupConfirmed, true);
  assert.equal(result.temporaryRootRemoved, true);
});
