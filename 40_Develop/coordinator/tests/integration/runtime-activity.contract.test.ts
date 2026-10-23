/**
 * 実保存からの活動投影と出所・継続位置を検証する。
 * @packageDocumentation
 * @responsibility 模擬Readerを使わず状態保存とEI履歴の読取りを反証する。
 * @trace PPR-IT-012
 * @level IT
 * @scope Coordinator活動Owner、実Filesystem、Git、状態保存、EI
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
import { taskExecutionSelections } from "../fixtures/ai-selection.ts";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  readAuthorizedRuntimeActivity,
  parseRuntimeActivityObservation,
  createCoordinatorState,
  initializeCoordinatorSnapshot,
} from "../../src/index.ts";
import { writeCoordinatorSnapshotState } from "../../src/storage/current-state.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/state/model.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import {
  createTaskAttemptSettledEvent,
  writeExecutionIntelligenceEvent,
  verifyExecutionIntelligenceRepositoryRoot,
  usageNotObserved,
} from "../../../execution-intelligence/src/index.ts";
import type { ActivityRepository } from "../../src/index.ts";
const projectId = "project-a";

/**
 * 実Git Repositoryを今回試験領域へ作る。
 * @responsibility 既存Root検証と試験終了後の清掃を一つのFixtureへ閉じる。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
function repository(t: test.TestContext, repositoryId: string, commit = true) {
  const base = path.resolve(import.meta.dirname, "../../../..");
  const checked = verifyRepositoryRoot(base);
  assert.equal(checked.status, "completed");
  if (checked.status !== "completed") throw new Error("fixture_root_invalid");
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(checked.capability, "tests"),
    "fixture_area_invalid",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "runtime-activity-"));
  t.after(() => {
    assert.ok(
      path.resolve(root).startsWith(path.resolve(area.directory) + path.sep),
    );
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  if (commit)
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=Activity Fixture",
        "-c",
        "user.email=activity@example.invalid",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { windowsHide: true },
    );
  const verification = verifyRepositoryRoot(root);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed")
    throw new Error("fixture_root_invalid");
  const input: ActivityRepository = Object.freeze({
    projectId,
    repositoryId,
    root: verification.capability,
  });
  return {
    root,
    input,
    revision: commit
      ? execFileSync("git", ["-C", root, "rev-parse", "HEAD"], {
          encoding: "utf8",
          windowsHide: true,
        }).trim()
      : null,
  };
}

/**
 * 実現在状態を保存する。
 * @responsibility 初期化と既存状態Writerを使い新版状態を準備する。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
function state(root: string, revision: string) {
  // 旧Composition式で保存し、新Reader側だけ新helperを使う片方向互換。
  const binding = `binding-${createHash("sha256").update(root).digest("hex").slice(0, 40)}`;
  assert.equal(
    initializeCoordinatorSnapshot(root, binding).status,
    "completed",
  );
  const created = createCoordinatorState({
    taskExecutionSelections: taskExecutionSelections(),
    projectId,
    milestoneId: "milestone-a",
    repositoryRevision: revision,
    maximumConcurrency: 1,
    milestoneAcceptanceCriteria: ["accepted"],
    objectives: [{ id: "objective-a", acceptanceCriteria: ["accepted"] }],
    tasks: [
      {
        id: "task-a",
        objectiveId: "objective-a",
        dependencies: [],
        allowedPaths: ["result.txt"],
        conflictKeys: [],
      },
    ],
    ownerGeneration: "owner-a",
  });
  assert.ok(created.state);
  assert.equal(
    writeCoordinatorSnapshotState(
      root,
      binding,
      JSON.stringify(created.state),
      0,
    ).status,
    "completed",
  );
}

/**
 * 非秘密Eventを実Storeへ記録する。
 * @responsibility EI正本の既存WriterでProject絞込み・出所反例を準備する。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
function event(
  root: string,
  taskId: string,
  occurredAt: string,
  project = projectId,
) {
  const value = createTaskAttemptSettledEvent({
    occurredAt,
    identity: {
      projectId: project,
      milestoneId: "milestone-a",
      objectiveId: "objective-a",
      taskId,
      attemptId: `attempt-${taskId}`,
      operationId: `operation-${taskId}`,
    },
    outcome: {
      status: "completed",
      reason: "task_completed",
      effectState: "settled",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
    },
    execution: {
      role: "executor",
      provider: { state: "not_observed", reason: "provider_not_reported" },
      model: { state: "not_observed", reason: "model_not_reported" },
      inputStrategyRef: { state: "not_observed", reason: "input_not_reported" },
      durationMs: { state: "not_observed", reason: "duration_not_reported" },
      usage: usageNotObserved("usage_not_reported"),
      humanActiveMs: {
        state: "not_observed",
        reason: "human_time_not_reported",
      },
    },
    quality: {
      state: "not_applicable",
      reason: "attempt_settlement_is_not_acceptance",
    },
  });
  const verified = verifyExecutionIntelligenceRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw new Error("fixture_ei_root_invalid");
  assert.equal(
    writeExecutionIntelligenceEvent(verified.root, value).status,
    "completed",
  );
  return value;
}

/**
 * 不存在・一現在Owner・競合を実保存から区別する。
 * @responsibility 同じSnapshotの投影と全Sourceの現在状態判定を確認する。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
test("実状態の不存在・単一Owner・複数競合・改訂差を区別する", async (t) => {
  const a = repository(t, "repo-a"),
    b = repository(t, "repo-b");
  let result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [b.input, a.input],
    limit: 20,
  });
  assert.equal(result.state, "absent");
  assert.equal(result.currentSourceRepositoryId, null);
  assert.deepEqual(
    result.sources.map((source) => source.repositoryId),
    ["repo-a", "repo-b"],
  );
  assert.ok(a.revision);
  state(a.root, a.revision);
  result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [a.input, b.input],
    limit: 20,
  });
  assert.equal(result.state, "observed");
  assert.equal(result.currentSourceRepositoryId, "repo-a");
  assert.equal(result.projection?.projectId, projectId);
  assert.ok(b.revision);
  state(b.root, b.revision);
  result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [a.input, b.input],
    limit: 20,
  });
  assert.equal(result.state, "unknown");
  assert.equal(result.projection, null);
  execFileSync(
    "git",
    [
      "-C",
      a.root,
      "-c",
      "user.name=Activity Fixture",
      "-c",
      "user.email=activity@example.invalid",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "next",
    ],
    { windowsHide: true },
  );
  result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [a.input],
    limit: 20,
  });
  assert.equal(result.state, "unknown");
  assert.equal(result.eventState, "observed");
});

/**
 * 全Source履歴を合成してからページ上限を適用する。
 * @responsibility 出所・時刻順・異Project非透過・Cursor相関を確認する。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
test("実履歴は出所を保って全体ページングし集合・改訂変更を拒否する", async (t) => {
  const a = repository(t, "repo-a"),
    b = repository(t, "repo-b");
  event(a.root, "task-old", "2026-10-12T00:00:01.000Z");
  event(b.root, "task-new", "2026-10-12T00:00:03.000Z");
  event(a.root, "task-other", "2026-10-12T00:00:04.000Z", "other-project");
  const request = { projectId, repositories: [b.input, a.input], limit: 1 };
  const first = await readAuthorizedRuntimeActivity(request);
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0]?.repositoryId, "repo-b");
  assert.ok(first.eventContinuation);
  const second = await readAuthorizedRuntimeActivity({
    ...request,
    cursor: first.eventContinuation,
  });
  assert.equal(second.events[0]?.taskId, "task-old");
  assert.equal(second.eventContinuation, null);
  await assert.rejects(
    readAuthorizedRuntimeActivity({
      ...request,
      repositories: [a.input],
      cursor: first.eventContinuation,
    }),
    /runtime_activity_cursor_invalid/,
  );
  execFileSync(
    "git",
    [
      "-C",
      b.root,
      "-c",
      "user.name=Activity Fixture",
      "-c",
      "user.email=activity@example.invalid",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "next",
    ],
    { windowsHide: true },
  );
  await assert.rejects(
    readAuthorizedRuntimeActivity({
      ...request,
      cursor: first.eventContinuation,
    }),
    /runtime_activity_cursor_invalid/,
  );
  assert.ok(parseRuntimeActivityObservation(first));
  assert.equal(
    parseRuntimeActivityObservation({ ...first, extra: "forbidden" }),
    null,
  );
});

/**
 * 一履歴の観測不能と重複Eventを部分成功にしない。
 * @responsibility 現在状態とEvent不成立を独立に保持する。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
test("履歴一件不明・出所重複と状態pendingを独立判定する", async (t) => {
  const a = repository(t, "repo-a"),
    b = repository(t, "repo-b");
  event(a.root, "task-same", "2026-10-12T00:00:01.000Z");
  event(b.root, "task-same", "2026-10-12T00:00:01.000Z");
  let result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [a.input, b.input],
    limit: 20,
  });
  assert.equal(result.state, "absent");
  assert.equal(result.eventState, "unknown");
  assert.equal(result.events.length, 0);
  fs.writeFileSync(
    path.join(b.root, ".crdd", "execution-intelligence", "history.jsonl"),
    "broken\n",
  );
  result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [a.input, b.input],
    limit: 20,
  });
  assert.equal(result.eventState, "unknown");
  assert.equal(result.events.length, 0);
  assert.ok(a.revision);
  state(a.root, a.revision);
  fs.writeFileSync(
    path.join(a.root, ".crdd", "coordinator", "state.pending.json"),
    "broken",
  );
  result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [a.input],
    limit: 20,
  });
  assert.equal(result.state, "unknown");
  assert.equal(result.eventState, "observed");
  assert.equal(result.events.length, 1);
});

/**
 * 改訂不明時に継続位置を発行・利用しない。
 * @responsibility null同士を改訂不変へ変換する反例を拒否する。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
test("Git改訂nullは第一Pageを保持して継続を拒否する", async (t) => {
  const a = repository(t, "repo-a", false);
  event(a.root, "task-1", "2026-10-12T00:00:01.000Z");
  event(a.root, "task-2", "2026-10-12T00:00:02.000Z");
  const request = { projectId, repositories: [a.input], limit: 1 };
  const result = await readAuthorizedRuntimeActivity(request);
  assert.equal(result.sources[0]?.revision, null);
  assert.equal(result.state, "unknown");
  assert.equal(result.eventState, "observed");
  assert.equal(result.events.length, 1);
  assert.equal(result.eventContinuation, null);
  const cursor = Buffer.from(
    JSON.stringify([
      "2026-10-12T00:00:02.000Z",
      `execution-${"a".repeat(64)}`,
      createHash("sha256")
        .update(JSON.stringify([projectId, result.sources]))
        .digest("hex"),
    ]),
    "utf8",
  ).toString("base64url");
  await assert.rejects(
    readAuthorizedRuntimeActivity({ ...request, cursor }),
    /runtime_activity_cursor_revision_unknown/,
  );
});

/**
 * 入力拒否・開始前取消を実Readerの前で止める。
 * @responsibility 空集合、余分認可field、異Project、偽Rootと取消を拒否する。
 * @trace PPR-IT-012
 * @precondition 検証済みRepository内の自己生成Fixtureだけを使用する。
 * @stimulus 対象操作へ固定入力と境界反例を渡す。
 * @observation 状態・履歴・出所・継続位置と終了後条件を取得する。
 * @oracle 本文のassertionで不明・競合・不存在の区別を確認する。
 * @cleanup 登録済みhookで今回Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 実Store Reader→活動投影。
 */
test("入力境界と開始前取消は内容読取りへ進まない", async (t) => {
  const a = repository(t, "repo-a");
  const request = { projectId, repositories: [a.input], limit: 20 };
  await assert.rejects(
    readAuthorizedRuntimeActivity({ ...request, repositories: [] }),
    /input_invalid/,
  );
  await assert.rejects(
    readAuthorizedRuntimeActivity({
      ...request,
      repositories: [a.input, a.input],
    }),
    /input_invalid/,
  );
  await assert.rejects(
    readAuthorizedRuntimeActivity({
      ...request,
      repositories: [{ ...a.input, projectId: "foreign" }],
    }),
    /input_invalid/,
  );
  await assert.rejects(
    readAuthorizedRuntimeActivity({
      ...request,
      bindingId: "am-binding",
    } as typeof request),
    /input_invalid/,
  );
  const fake = await readAuthorizedRuntimeActivity({
    ...request,
    repositories: [{ ...a.input, root: { contract: a.input.root.contract } }],
  });
  assert.equal(fake.state, "unknown");
  assert.equal(fake.eventState, "unknown");
  assert.equal(fake.events.length, 0);
  const controller = new AbortController();
  controller.abort();
  let reads = 0;
  const original = fs.lstatSync;
  const descriptor = Object.getOwnPropertyDescriptor(fs, "lstatSync");
  assert.ok(descriptor);
  Object.defineProperty(fs, "lstatSync", {
    ...descriptor,
    value: (...args: Parameters<typeof fs.lstatSync>) => {
      reads++;
      return original(...args);
    },
  });
  try {
    await assert.rejects(
      readAuthorizedRuntimeActivity(request, controller.signal),
      /runtime_activity_cancelled/,
    );
    assert.equal(reads, 0);
  } finally {
    Object.defineProperty(fs, "lstatSync", descriptor);
  }
});

/**
 * 公開結果の共同不変条件を独立に反証する。
 * @responsibility Project・Source・Owner・Event・Cursor・理由を単独変更して拒否を確認する。
 * @trace PPR-IT-012
 * @precondition 実保存から得た正常観測を基準とする。
 * @stimulus 共同fieldを一つずつ不整合にする。
 * @observation Parser結果、getter呼出し数と固定Binding値。
 * @oracle 不整合はnull、正常値は受理し、旧Bindingのbyteを維持する。
 * @cleanup 登録済みhookで所有Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 公開値検査と活動Reader。
 */
test("公開活動結果はProject・Source・Event・Cursor相関を閉じる", async (t) => {
  const a = repository(t, "repo-a"),
    b = repository(t, "repo-b");
  assert.ok(a.revision);
  state(a.root, a.revision);
  event(a.root, "task-1", "2026-10-12T00:00:01.000Z");
  event(a.root, "task-2", "2026-10-12T00:00:02.000Z");
  const result = await readAuthorizedRuntimeActivity({
    projectId,
    repositories: [a.input, b.input],
    limit: 20,
  });
  assert.equal(result.state, "observed");
  assert.ok(result.projection);
  assert.equal(result.projectId, projectId);
  assert.ok(parseRuntimeActivityObservation(result));
  const first = result.events[0],
    last = result.events.at(-1);
  assert.ok(first);
  assert.ok(last);
  const hash = createHash("sha256")
    .update(JSON.stringify([projectId, result.sources]))
    .digest("hex");
  const cursor = Buffer.from(
    JSON.stringify([last.occurredAt, last.eventId, hash]),
    "utf8",
  ).toString("base64url");
  assert.ok(
    parseRuntimeActivityObservation({ ...result, eventContinuation: cursor }),
  );
  const invalid: unknown[] = [
    { ...result, projectId: "foreign-project" },
    {
      ...result,
      projection: { ...result.projection, projectId: "foreign-project" },
    },
    { ...result, projectId: undefined },
    { ...result, sources: [...result.sources, result.sources[0]] },
    { ...result, sources: [...result.sources].reverse() },
    { ...result, currentSourceRepositoryId: "outside" },
    { ...result, currentSourceRepositoryId: null },
    {
      ...result,
      sources: result.sources.map((source) => ({ ...source, revision: null })),
    },
    { ...result, events: [{ ...first, repositoryId: "outside" }] },
    { ...result, events: [first, first] },
    { ...result, events: [...result.events].reverse() },
    {
      ...result,
      eventState: "unknown",
      eventReason: "runtime_activity_events_unknown",
    },
    {
      ...result,
      eventState: "unknown",
      eventReason: "runtime_activity_events_unknown",
      events: [],
      eventContinuation: cursor,
    },
    { ...result, events: [], eventContinuation: cursor },
    { ...result, projection: null },
    {
      ...result,
      state: "absent",
      reason: "runtime_activity_state_absent",
      currentSourceRepositoryId: null,
    },
    { ...result, reason: "wrong_reason" },
    { ...result, eventReason: "wrong_reason" },
    { ...result, events: [{ ...first, reason: "a".repeat(513) }] },
    {
      ...result,
      events: [
        { ...first, occurredAt: `2026-10-12T00:00:00Z${" ".repeat(45)}` },
      ],
    },
    {
      ...result,
      eventContinuation: Buffer.from(
        JSON.stringify([last.occurredAt, last.eventId, "0".repeat(64)]),
      ).toString("base64url"),
    },
    {
      ...result,
      eventContinuation: Buffer.from(
        JSON.stringify([first.occurredAt, first.eventId, hash]),
      ).toString("base64url"),
    },
    new Proxy(result, {}),
    { ...result, sources: new Proxy([...result.sources], {}) },
  ];
  for (const [index, value] of invalid.entries())
    assert.equal(parseRuntimeActivityObservation(value), null, `反例${index}`);
  let reads = 0;
  const accessor = Object.defineProperty({ ...result }, "reason", {
    enumerable: true,
    get: () => {
      reads++;
      return result.reason;
    },
  });
  assert.equal(parseRuntimeActivityObservation(accessor), null);
  assert.equal(reads, 0);
  assert.ok(
    parseRuntimeActivityObservation({
      ...result,
      events: [{ ...first, reason: "a".repeat(512) }],
      eventContinuation: null,
    }),
  );
});

/**
 * 保存Bindingの既知byte互換を確認する。
 * @responsibility 期待値を新helperから生成せず固定Goldenと照合する。
 * @trace PPR-IT-012
 * @precondition 実保存から得た正常観測を基準とする。
 * @stimulus 共同fieldを一つずつ不整合にする。
 * @observation Parser結果、getter呼出し数と固定Binding値。
 * @oracle 不整合はnull、正常値は受理し、旧Bindingのbyteを維持する。
 * @cleanup 登録済みhookで所有Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: 公開値検査と活動Reader。
 */
test("保存Bindingは既存の固定byte契約を維持する", () => {
  assert.equal(
    deriveCoordinatorRepositoryBindingId("C:/fixture/repository"),
    "binding-d5a79868193da147c72219dac4a616eb24f197c3",
  );
});

/**
 * offset付き時刻を実時刻順で比較し継続する。
 * @responsibility 同じinstant比較規則を並び順・Validator・Cursorへ接続する。
 * @trace PPR-IT-012
 * @precondition EIが受理するoffset付き日時を実Storeへ保存する。
 * @stimulus 文字列順と実時刻順が逆転する二Eventをlimit1で二Page取得する。
 * @observation Event順序・継続位置・ID集合とValidator結果。
 * @oracle 新旧を実時刻で判定し欠落・重複なし、同instantはID降順となる。
 * @cleanup 登録済みhookで所有Fixtureを削除し不存在を確認する。
 * @boundary PPR-IT-012=Adjacent 1 Block: EI実履歴→活動投影と継続。
 */
test("offset日時も実時刻順で並び同じ境界から継続する", async (t) => {
  const a = repository(t, "repo-a");
  const older = event(a.root, "task-offset-old", "2026-10-12T01:00:00+02:00");
  const newer = event(a.root, "task-utc-new", "2026-10-12T00:30:00Z");
  const request = { projectId, repositories: [a.input], limit: 1 };
  const first = await readAuthorizedRuntimeActivity(request);
  assert.equal(first.events[0]?.eventId, newer.eventId);
  assert.ok(first.eventContinuation);
  const second = await readAuthorizedRuntimeActivity({
    ...request,
    cursor: first.eventContinuation,
  });
  assert.equal(second.events[0]?.eventId, older.eventId);
  assert.equal(second.eventContinuation, null);
  assert.equal(
    new Set([...first.events, ...second.events].map((item) => item.eventId))
      .size,
    2,
  );
  const whole = await readAuthorizedRuntimeActivity({ ...request, limit: 20 });
  assert.ok(parseRuntimeActivityObservation(whole));
  assert.equal(
    parseRuntimeActivityObservation({
      ...whole,
      events: [...whole.events].reverse(),
    }),
    null,
  );
  const equivalent = event(
    a.root,
    "task-offset-equal",
    "2026-10-12T01:30:00+01:00",
  );
  const all = await readAuthorizedRuntimeActivity({ ...request, limit: 20 });
  assert.deepEqual(
    all.events.slice(0, 2).map((item) => item.eventId),
    [newer.eventId, equivalent.eventId].sort().reverse(),
  );
  assert.equal(all.events[2]?.eventId, older.eventId);
  assert.ok(parseRuntimeActivityObservation(all));
});
