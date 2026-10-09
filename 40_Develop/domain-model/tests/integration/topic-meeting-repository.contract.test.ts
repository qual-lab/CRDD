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
 * 所有した短命Fileの部分書込み・close失敗を公開更新から検証する。
 *
 * @responsibility open成功後だけ回収し、一次失敗・cleanup・正本保持を共同確認する。
 * @trace CPR-IT-011
 * @precondition 検証済みRepository内の非link親に自己生成Rootを用意する。
 * @stimulus Topic／Meeting登録・更新へ部分write、undefined、close、unlink、EEXISTを限定注入する。
 * @observation descriptor回収、rename／読戻し到達、例外Identity、残存Fileと正本bytesを照合する。
 * @oracle 失敗時は公開せず、所有Fileだけを回収し、他者Fileと既存正本を保持する。
 * @cleanup mockを復元し、自己生成Rootをexactに回収して不存在を確認する。
 * @boundary 公開CRUD→同期Filesystem。close注入は実close後の故障報告で実OS故障の証明ではない。
 */
test("部分書込みの失敗は所有tmpだけを回収し正本を保持する", (t) => {
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
  const originalOpen = fs.openSync;
  const originalWrite = fs.writeFileSync;
  const originalClose = fs.closeSync;
  const originalUnlink = fs.unlinkSync;
  const originalRead = fs.readFileSync;
  const originalRename = fs.renameSync;
  for (const kind of ["topic", "meeting"] as const) {
    for (const operation of ["create", "update"] as const) {
      for (const mode of [
        "write",
        "undefined",
        "write-close",
        "write-unlink",
        "close",
        "exists",
      ] as const) {
        const root = fs.mkdtempSync(path.join(parent, "topic-meeting-write-"));
        try {
          const repository = createTopicMeetingRepository(root);
          const id = kind === "topic" ? "TOPIC-000042" : "MTG-000042";
          const markdown = kind === "topic" ? topic : meeting;
          const file = path.join(
            root,
            kind === "topic" ? "22_Topics" : "23_Meetings",
            id,
            `${kind}.md`,
          );
          if (operation === "update")
            assert.equal(
              repository.create(kind, markdown(1)).status,
              "completed",
            );
          const before = operation === "update" ? originalRead(file) : null;
          const primary = new Error("fixed_partial_write_failure");
          const closeFailure = new Error("fixed_temporary_close_failure");
          const unlinkFailure = new Error("fixed_temporary_unlink_failure");
          const existsFailure = Object.assign(
            new Error("fixed_temporary_exists"),
            { code: "EEXIST" },
          );
          let temporary: string | undefined;
          let descriptor: number | undefined;
          let openHandles = 0;
          let renameCalls = 0;
          let readbackCalls = 0;
          let unlinkCalls = 0;
          let thrown = false;
          let failure: unknown;
          const openMock = t.mock.method(
            fs,
            "openSync",
            (input: fs.PathLike, flags: fs.OpenMode, permissions?: fs.Mode) => {
              if (String(input).endsWith(".tmp")) {
                temporary = String(input);
                if (mode === "exists") {
                  const otherDescriptor = originalOpen(input, "wx");
                  try {
                    originalWrite(otherDescriptor, "not_owned");
                  } finally {
                    originalClose(otherDescriptor);
                  }
                  throw existsFailure;
                }
                descriptor = originalOpen(input, flags, permissions);
                openHandles++;
                return descriptor;
              }
              return originalOpen(input, flags, permissions);
            },
          );
          const writeMock = t.mock.method(
            fs,
            "writeFileSync",
            (
              input: fs.PathOrFileDescriptor,
              data: string | NodeJS.ArrayBufferView,
              options?: fs.WriteFileOptions,
            ) => {
              if (
                typeof input === "number" &&
                input === descriptor &&
                mode !== "close"
              ) {
                originalWrite(input, "partial");
                if (mode === "undefined") throw undefined;
                throw primary;
              }
              return originalWrite(input, data, options);
            },
          );
          const closeMock = t.mock.method(fs, "closeSync", (input: number) => {
            originalClose(input);
            if (input === descriptor && openHandles > 0) {
              openHandles--;
              if (mode === "close" || mode === "write-close")
                throw closeFailure;
            }
          });
          const unlinkMock = t.mock.method(
            fs,
            "unlinkSync",
            (input: fs.PathLike) => {
              if (String(input) === temporary) {
                unlinkCalls++;
                if (mode === "write-unlink") throw unlinkFailure;
              }
              return originalUnlink(input);
            },
          );
          const renameMock = t.mock.method(
            fs,
            "renameSync",
            (source: fs.PathLike, target: fs.PathLike) => {
              renameCalls++;
              return originalRename(source, target);
            },
          );
          const readMock = t.mock.method(
            fs,
            "readFileSync",
            (input: fs.PathOrFileDescriptor) => {
              if (String(input) === file && temporary !== undefined)
                readbackCalls++;
              return originalRead(input);
            },
          );
          syncBuiltinESMExports();
          try {
            if (operation === "create") repository.create(kind, markdown(1));
            else repository.update(kind, id, 1, markdown(2));
          } catch (error) {
            thrown = true;
            failure = error;
          } finally {
            openMock.mock.restore();
            writeMock.mock.restore();
            closeMock.mock.restore();
            unlinkMock.mock.restore();
            renameMock.mock.restore();
            readMock.mock.restore();
            syncBuiltinESMExports();
            if (openHandles > 0 && descriptor !== undefined)
              originalClose(descriptor);
          }
          assert.ok(thrown, `${kind}/${operation}/${mode}`);
          assert.equal(openHandles, 0);
          assert.equal(renameCalls, 0);
          assert.equal(readbackCalls, 0);
          assert.equal(unlinkCalls, mode === "exists" ? 0 : 1);
          if (mode === "write-close" || mode === "write-unlink") {
            assert.ok(failure instanceof AggregateError);
            assert.equal(failure.cause, primary);
            assert.deepEqual(failure.errors, [
              mode === "write-close" ? closeFailure : unlinkFailure,
            ]);
          } else
            assert.equal(
              failure,
              mode === "undefined"
                ? undefined
                : mode === "exists"
                  ? existsFailure
                  : mode === "close"
                    ? closeFailure
                    : primary,
            );
          assert.ok(temporary);
          const observedTemporary = temporary;
          if (mode === "exists" || mode === "write-unlink")
            assert.equal(
              originalRead(temporary, "utf8"),
              mode === "exists" ? "not_owned" : "partial",
            );
          else
            assert.throws(() => fs.lstatSync(observedTemporary), {
              code: "ENOENT",
            });
          if (before !== null) {
            assert.deepEqual(originalRead(file), before);
            assert.equal(repository.get(kind, id)?.revision, 1);
          } else assert.equal(repository.get(kind, id), null);
          const lock = path.join(
            root,
            kind === "topic" ? "22_Topics" : "23_Meetings",
            `.${id}.lock`,
          );
          assert.throws(() => fs.lstatSync(lock), { code: "ENOENT" });
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
          assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
        }
      }
    }
  }
});

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
 * @trace CPR-IT-011
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus meetingの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary Repository試験入力→登録・更新と保存後失敗照合のDirect Boundary。
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
  const originalOpen = fs.openSync;
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
      let lockDescriptor: number | undefined;
      const openMock = t.mock.method(
        fs,
        "openSync",
        (file: fs.PathLike, flags: fs.OpenMode, mode?: fs.Mode) => {
          const descriptor = originalOpen(file, flags, mode);
          if (String(file) === lockPath) lockDescriptor = descriptor;
          return descriptor;
        },
      );
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
        originalClose(descriptor);
        if (descriptor === lockDescriptor) {
          attempts.push("close");
          if (lockFails) throw closeFailure;
        }
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
        openMock.mock.restore();
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

/**
 * 登録・更新の同一読戻しと保存後失敗を照合する。
 *
 * @responsibility TopicとMeetingの保存済みbytes・Identity・改訂と公開成功／例外を相関する。
 * @trace CPR-IT-010
 * @trace CPR-IT-011
 * @precondition 検証済みRepositoryの非link試験親に自己生成Rootを用意する。
 * @stimulus create／updateを実保存し、保存後読取りの欠落・故障・内容差とLock回収故障を限定注入する。
 * @observation rename後の読取り回数、Lock存在、実bytes・改訂、一次例外とcleanupを観測する。
 * @oracle 一致時だけ成功し、保存後失敗は実保存を残したまま内部例外を返す。不正UTF-8を同一文字列として受理しない。
 * @cleanup 注入を復元して自己生成Rootを回収し、Root不存在を確認する。
 * @boundary 同期Repository保存→同一File読戻し。電源断・親差替え・実Process競合は対象外。
 */
test("登録・更新はLock内の同一読戻しを確認し保存後失敗を隠さない", (t) => {
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
  const originalRead = fs.readFileSync;
  const originalRename = fs.renameSync;
  const originalExists = fs.existsSync;
  const originalUnlink = fs.unlinkSync;
  for (const kind of ["topic", "meeting"] as const) {
    for (const operation of ["create", "update"] as const) {
      for (const mode of [
        "normal",
        "read-error",
        "missing",
        "bytes",
        "identity",
        "revision",
        "project",
        "utf8",
        "parse",
        "cleanup",
      ] as const) {
        const root = fs.mkdtempSync(
          path.join(parent, "topic-meeting-readback-"),
        );
        try {
          const repository = createTopicMeetingRepository(root);
          const id = kind === "topic" ? "TOPIC-000042" : "MTG-000042";
          const directory = path.join(
            root,
            kind === "topic" ? "22_Topics" : "23_Meetings",
          );
          const file = path.join(directory, id, `${kind}.md`);
          const lock = path.join(directory, `.${id}.lock`);
          const fixture = kind === "topic" ? topic : meeting;
          if (operation === "update")
            assert.equal(
              repository.create(kind, fixture(1)).status,
              "completed",
            );
          const revision = operation === "create" ? 1 : 2;
          const markdown = fixture(revision).replace(
            "### 結論",
            "### 結論\n\n置換文字: \uFFFD",
          );
          const readFailure = new Error("fixed_readback_failure");
          const cleanupFailure = new Error("fixed_readback_cleanup_failure");
          let published = false;
          let readCount = 0;
          const renameMock = t.mock.method(
            fs,
            "renameSync",
            (source: fs.PathLike, destination: fs.PathLike) => {
              const result = originalRename(source, destination);
              published = true;
              return result;
            },
          );
          const existsMock = t.mock.method(
            fs,
            "existsSync",
            (target: fs.PathLike) =>
              published && String(target) === file && mode === "missing"
                ? false
                : originalExists(target),
          );
          const readMock = t.mock.method(
            fs,
            "readFileSync",
            (...args: Parameters<typeof fs.readFileSync>) => {
              if (!published || String(args[0]) !== file)
                return originalRead(...args);
              readCount++;
              assert.ok(originalExists(lock));
              assert.equal(args[1], undefined);
              if (mode === "read-error" || mode === "cleanup")
                throw readFailure;
              let observed = originalRead(file);
              if (mode === "bytes") observed = Buffer.from(`${markdown}\n`);
              if (mode === "identity")
                observed = Buffer.from(
                  markdown.replace(id, id.replace("042", "043")),
                );
              if (mode === "revision")
                observed = Buffer.from(
                  markdown.replace(`改訂: \`${revision}\``, "改訂: `3`"),
                );
              if (mode === "project")
                observed = Buffer.from(markdown.replace("PRJ-001", "PRJ-002"));
              if (mode === "parse") observed = Buffer.from("not a record");
              if (mode === "utf8") {
                const offset = observed.indexOf(Buffer.from("\uFFFD"));
                assert.ok(offset >= 0);
                observed = Buffer.concat([
                  observed.subarray(0, offset),
                  Buffer.from([0xff]),
                  observed.subarray(offset + 3),
                ]);
                assert.equal(observed.toString("utf8"), markdown);
              }
              return observed;
            },
          );
          const unlinkMock = t.mock.method(
            fs,
            "unlinkSync",
            (target: fs.PathLike) => {
              if (mode === "cleanup" && String(target) === lock)
                throw cleanupFailure;
              return originalUnlink(target);
            },
          );
          syncBuiltinESMExports();
          try {
            /**
             * 今回の登録または更新を一度実行する。
             *
             * @responsibility 同じ入力を正常返却と例外観測の両経路へ与える。
             * @trace CPR-IT-010
             * @trace CPR-IT-011
             * @precondition 対象種別・ID・期待改訂と限定注入が設定済みである。
             * @stimulus 選択したRepository create／updateを一度呼ぶ。
             * @observation 返却結果または保存後の一次例外を呼出し側へ渡す。
             * @oracle 外側のassertionで実保存・読戻し・cleanupとの相関を判定する。
             * @cleanup 外側のfinallyが注入と自己生成Rootを回収する。
             * @boundary Repository公開CRUD→実Filesystem保存と注入観測。
             */
            const attemptRecordWrite = () =>
              operation === "create"
                ? repository.create(kind, markdown)
                : repository.update(kind, id, 1, markdown);
            if (mode === "normal") {
              const result = attemptRecordWrite();
              assert.equal(result.status, "completed");
              assert.equal(result.record?.revision, revision);
            } else {
              assert.throws(attemptRecordWrite, (error: unknown) => {
                if (mode === "read-error") assert.equal(error, readFailure);
                else if (mode === "cleanup") {
                  assert.ok(error instanceof AggregateError);
                  assert.equal(error.cause, readFailure);
                  assert.deepEqual(error.errors, [cleanupFailure]);
                } else {
                  assert.ok(error instanceof Error);
                  if (mode !== "parse")
                    assert.equal(
                      error.message,
                      mode === "missing"
                        ? "project_operation_record_readback_missing"
                        : "project_operation_record_readback_mismatch",
                    );
                }
                return true;
              });
            }
            assert.ok(published);
            assert.equal(readCount, mode === "missing" ? 0 : 1);
          } finally {
            renameMock.mock.restore();
            readMock.mock.restore();
            existsMock.mock.restore();
            unlinkMock.mock.restore();
            syncBuiltinESMExports();
          }
          assert.deepEqual(originalRead(file), Buffer.from(markdown));
          assert.equal(repository.get(kind, id)?.revision, revision);
          assert.equal(originalExists(lock), mode === "cleanup");
          assert.deepEqual(fs.readdirSync(path.dirname(file)), [`${kind}.md`]);
        } finally {
          fs.rmSync(root, { recursive: true, force: true });
          assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
        }
      }
    }
  }
});
