/**
 * Topic／Meeting Repository CRUD契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 登録・編集・削除・一覧・取得、改訂競合およびRelation付き削除拒否を実Filesystemで確認する。
 * @trace CPR-IT-010
 * @trace CPR-IT-011
 * @level IT
 * @scope project-operation、topic、meeting、crud、repository
 * @boundary Application CRUD→Repository Filesystem→Canonical Markdown
 */
import assert from "node:assert/strict";
import fs, { mkdtempSync, rmSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";

import { createTopicMeetingRepository } from "../../src/storage/topic-meeting-store.ts";

/**
 * topic用の試験入力または観測処理を提供する。
 *
 * @responsibility topic用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-010
 * @trace CPR-IT-011
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus topicの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary Repository試験入力→保存・失敗相関のDirect Boundary。
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

/**
 * meeting用の試験入力または観測処理を提供する。
 *
 * @responsibility meeting用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-010
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus meetingの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: Repository Test Source→CRUD契約
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
 * @trace CPR-IT-010
 * @precondition 空の検証用Repository Rootを作る。
 * @stimulus TopicとMeetingを登録し、Topicを更新して一覧・取得する。
 * @observation 結果、改訂およびFilesystem Effect件数を観測する。
 * @oracle 各正本は固定Pathへ一件だけ存在し、競合更新はEffect 0となる。
 * @cleanup 検証用Rootを削除する。
 * @boundary CPR-IT-010=Direct Boundary: Repository Test Source→CRUD契約
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
 * @trace CPR-IT-010
 * @precondition Topicと、そのIDを参照するMeetingを作成する。
 * @stimulus 未確認削除、Relation付き削除、Relation解消後の確認済み削除を順に要求する。
 * @observation 拒否理由、Relation Path、Effect件数および残存Recordを観測する。
 * @oracle Relation中はEffect 0で、解消後の誤登録理由＋明示確認だけが対象Topicを削除する。
 * @cleanup 検証用Rootを削除する。
 * @boundary CPR-IT-010=Direct Boundary: Repository Test Source→CRUD契約
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

/**
 * 保存の一次失敗とLock・短命File回収の失敗を独立に保持する。
 *
 * @responsibility 標準Filesystem APIへの限定注入で例外Identity・cause・cleanup順序と実改訂を照合する。
 * @trace CPR-IT-011
 * @precondition 検証済みRepository内の非link試験親へ自己生成RootとRevision 1を用意する。
 * @stimulus rename、短命File unlink、Lock close・unlinkへ対象限定の故障を注入する。
 * @observation 一次例外、AggregateErrorのcause／errors、両cleanup試行と保存済みRevisionを確認する。
 * @oracle 一次失敗は上書きされず、close失敗でもunlinkを試み、保存後故障をEffect 0へ変換しない。
 * @cleanup mockを復元して実Handleと自己生成Rootを回収し、Root不存在を確認する。
 * @boundary Repository公開更新→同期Filesystem保存・cleanup。実OS故障の網羅証明ではない。
 */
test("保存とcleanupの失敗を上書きせず実改訂と照合する", (t) => {
  const verified = resolveVerifiedRepositoryRootFromWorkingDirectory(
    import.meta.dirname,
  );
  const parent = path.join(verified, ".crdd", "tests");
  for (const directory of [path.dirname(parent), parent]) {
    try {
      const stat = fs.lstatSync(directory);
      assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      fs.mkdirSync(directory);
    }
  }
  const originalRename = fs.renameSync;
  const originalClose = fs.closeSync;
  const originalUnlink = fs.unlinkSync;
  for (const mode of [
    "primary",
    "undefined",
    "lock",
    "temporary",
    "temporary-absent",
    "nested",
    "published",
  ] as const) {
    const root = fs.mkdtempSync(path.join(parent, "topic-meeting-failure-"));
    try {
      const repository = createTopicMeetingRepository(root);
      assert.equal(repository.create("topic", topic(1)).status, "completed");
      const lockPath = path.join(root, "22_Topics", ".TOPIC-000042.lock");
      fs.writeFileSync(lockPath, "owned_conflict", { flag: "wx" });
      assert.equal(
        repository.update("topic", "TOPIC-000042", 1, topic(2)).reason,
        "record_revision_conflict",
      );
      assert.equal(repository.get("topic", "TOPIC-000042")?.revision, 1);
      fs.unlinkSync(lockPath);
      const primary = new Error("fixed_rename_failure");
      const closeFailure = new Error("fixed_close_failure");
      const lockFailure = new Error("fixed_lock_unlink_failure");
      const temporaryFailure = new Error("fixed_temporary_unlink_failure");
      const attempts: string[] = [];
      const lockFails = ["lock", "nested", "published"].includes(mode);
      const temporaryFails = ["temporary", "nested"].includes(mode);
      let thrown = false;
      let failure: unknown;
      const renameMock = t.mock.method(
        fs,
        "renameSync",
        (source: fs.PathLike, destination: fs.PathLike) => {
          if (mode === "published") return originalRename(source, destination);
          if (mode === "temporary-absent") originalUnlink(source);
          if (mode === "undefined") throw undefined;
          throw primary;
        },
      );
      const closeMock = t.mock.method(fs, "closeSync", (descriptor: number) => {
        attempts.push("close");
        originalClose(descriptor);
        if (lockFails) throw closeFailure;
      });
      const unlinkMock = t.mock.method(
        fs,
        "unlinkSync",
        (file: fs.PathLike) => {
          const lock = String(file).endsWith(".lock");
          attempts.push(lock ? "lock-unlink" : "temporary-unlink");
          if (lock && lockFails) throw lockFailure;
          if (!lock && temporaryFails) throw temporaryFailure;
          return originalUnlink(file);
        },
      );
      syncBuiltinESMExports();
      try {
        repository.update("topic", "TOPIC-000042", 1, topic(2, "waiting"));
      } catch (error) {
        thrown = true;
        failure = error;
      } finally {
        renameMock.mock.restore();
        closeMock.mock.restore();
        unlinkMock.mock.restore();
        syncBuiltinESMExports();
      }
      assert.ok(thrown, mode);
      assert.deepEqual(attempts.slice(-2), ["close", "lock-unlink"]);
      if (mode === "primary" || mode === "temporary-absent")
        assert.equal(failure, primary);
      else if (mode === "undefined") assert.equal(failure, undefined);
      else {
        assert.ok(failure instanceof AggregateError);
        if (lockFails)
          assert.deepEqual(failure.errors, [closeFailure, lockFailure]);
        else assert.deepEqual(failure.errors, [temporaryFailure]);
        if (mode === "published")
          assert.equal(Object.hasOwn(failure, "cause"), false);
        else if (mode === "nested") {
          assert.ok(failure.cause instanceof AggregateError);
          assert.equal(failure.cause.cause, primary);
          assert.deepEqual(failure.cause.errors, [temporaryFailure]);
        } else assert.equal(failure.cause, primary);
      }
      assert.equal(
        repository.get("topic", "TOPIC-000042")?.revision,
        mode === "published" ? 2 : 1,
      );
      const directory = path.join(root, "22_Topics", "TOPIC-000042");
      assert.equal(
        fs.readdirSync(directory).filter((file) => file.endsWith(".tmp"))
          .length,
        temporaryFails ? 1 : 0,
      );
      assert.equal(
        fs.existsSync(path.join(root, "22_Topics", ".TOPIC-000042.lock")),
        lockFails,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
      assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
    }
  }
});
