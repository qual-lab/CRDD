/**
 * 固定Commitの公開読取り・コピーを実Gitと限定FS故障で検証する。
 * @packageDocumentation
 * @responsibility Commit固定、出力境界、入力検査、部分Effectと回収不明を確認する。
 * @trace RCM-IT-003 RFD-IT-008
 * @level IT
 * @scope version-control、fixed-snapshot、candidate、cleanup
 * @boundary 固定Commit→公開File操作→Repository内出力。外部AI・Dockerなし。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  readCommitFile,
  getRepository,
  type CommitFileReadRequest,
} from "../../src/index.ts";
import { copyCommitFiles } from "../../src/repository/files.ts";
import type { CommitFilesCopyRequest } from "../../src/repository/types.ts";

const parent = path.resolve(
  import.meta.dirname,
  "../../../../.crdd/tests/vc-copy",
);

/** 自己生成のRepositoryだけへ固定準備操作を発行する。 */
function git(root: string, args: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

/** Repository-localに作成し、同じRootだけを試験終了時に回収する。 */
function fixture(t: TestContext, first = "first\n") {
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "case-"));
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "a.txt"), first);
  fs.writeFileSync(path.join(root, "docs", "fixed.txt"), "fixed\n");
  git(root, ["add", "--", "a.txt", "docs/fixed.txt"]);
  git(root, ["commit", "--quiet", "-m", "fixed"]);
  const commit = git(root, ["rev-parse", "HEAD"]);
  const tree = git(root, ["rev-parse", "HEAD^{tree}"]);
  const target = getRepository(root);
  if (target.status !== "completed") throw Error("fixture_root_invalid");
  const output = path.join(root, ".crdd", "output");
  fs.mkdirSync(output, { recursive: true });
  const request = {
    commit,
    outputRepository: target.capability,
    relativeDirectory: ".crdd/output",
    paths: null,
    inspectContent: null,
  };
  return { root, commit, tree, output, repository: target.capability, request };
}

/** HEADや作業Fileの変更と、固定Commitの内容を混同しない。 */
test("固定CommitのFileと選択コピーはHEAD・通常Indexを変更しない", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, "docs", "fixed.txt"), "new-head\n");
  git(f.root, ["add", "--", "docs/fixed.txt"]);
  git(f.root, ["commit", "--quiet", "-m", "new-head"]);
  const head = git(f.root, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(f.root, "docs", "fixed.txt"), "working\n");
  const index = fs.readFileSync(path.join(f.root, ".git", "index"));
  const read = readCommitFile(f.repository, {
    commit: f.commit,
    path: "docs/fixed.txt",
  });
  assert.equal(read?.bytes.toString("utf8"), "fixed\n");
  assert.equal(read?.mode, "100644");
  assert.equal(read?.revisionIdentity, f.commit);
  assert.equal(
    readCommitFile(f.repository, {
      commit: f.commit,
      path: "docs/fixed.txt",
      extra: 3,
    } as CommitFileReadRequest),
    null,
  );
  const selected = ["docs/fixed.txt"];
  const result = copyCommitFiles(f.repository, {
    ...f.request,
    paths: selected,
    inspectContent: (_name, bytes) => {
      selected[0] = "a.txt";
      bytes.fill(65);
      return false;
    },
  });
  assert.equal(result?.status, "materialized");
  if (result?.status !== "materialized") return;
  assert.equal(result.baseRevisionIdentity, f.commit);
  assert.equal(result.baseSnapshotIdentity, f.tree);
  assert.equal(result.fileCount, 1);
  assert.equal(
    fs.readFileSync(path.join(f.output, "docs", "fixed.txt"), "utf8"),
    "fixed\n",
  );
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
  assert.deepEqual(fs.readFileSync(path.join(f.root, ".git", "index")), index);
  assert.equal(JSON.stringify(result).includes(f.root), false);
});

/** 固定内容の別Repositoryへの選択コピーはVC内で検証する。 @trace RFD-IT-008 */
test("packedの固定Commitから別Repositoryへ選択した本文だけをコピーする", (t) => {
  const source = fixture(t, "packed source\n");
  const target = fixture(t);
  assert.notEqual(source.commit, target.commit);
  git(source.root, ["repack", "-ad"]);
  git(source.root, ["prune-packed"]);
  assert.equal(
    fs.existsSync(
      path.join(
        source.root,
        ".git",
        "objects",
        source.commit.slice(0, 2),
        source.commit.slice(2),
      ),
    ),
    false,
  );
  const result = copyCommitFiles(source.repository, {
    ...target.request,
    commit: source.commit,
    paths: ["a.txt"],
    inspectContent: (file, bytes) => {
      assert.equal(file, "a.txt");
      assert.equal(Buffer.from(bytes).toString("utf8"), "packed source\n");
      return false;
    },
  });
  assert.equal(result?.status, "materialized");
  if (result?.status !== "materialized") assert.fail("selected copy failed");
  assert.equal(result.baseRevisionIdentity, source.commit);
  assert.equal(result.fileCount, 1);
  assert.deepEqual(fs.readdirSync(target.output), ["a.txt"]);
  assert.equal(
    fs.readFileSync(path.join(target.output, "a.txt"), "utf8"),
    "packed source\n",
  );
});

/**
 * 固定Commit一つから旧Reviewer件数を超える全Fileをコピーする。
 * @responsibility 候補Commitの反復なしで固定Treeからの全量搬送を確認する。
 * @trace RCM-IT-003 RFD-IT-008
 * @precondition 自己生成Repositoryに選択対象と対象外Fileがある。
 * @stimulus 257Fileを一括固定し、対象Directoryだけをコピーする。
 * @observation コピーした名前・本文・件数・Byte数と元GitのHEAD・Index。
 * @oracle 選択の欠落・混入・切詰めなし、元HEAD・Index不変。
 * @cleanup 既存fixtureで自己生成Rootを回収する。
 * @boundary 実Git・Filesystem。外部AI・Dockerなし。
 */
test("固定Commitから選択した257ファイルを切り詰めずにコピーする", (t) => {
  const f = fixture(t);
  const input = path.join(f.root, "bulk");
  fs.mkdirSync(input);
  const files = Array.from({ length: 257 }, (_, index) => ({
    name: `file-${String(index).padStart(3, "0")}.txt`,
    content: `fixture ${index}\n`,
  }));
  for (const { name, content } of files)
    fs.writeFileSync(path.join(input, name), content);
  git(f.root, ["add", "--", "bulk"]);
  git(f.root, ["commit", "--quiet", "-m", "bulk"]);
  const commit = git(f.root, ["rev-parse", "HEAD"]);
  const index = fs.readFileSync(path.join(f.root, ".git", "index"));
  const result = copyCommitFiles(f.repository, {
    ...f.request,
    commit,
    paths: ["bulk/"],
  });
  assert.ok(result?.status === "materialized");
  assert.equal(result.fileCount, files.length);
  assert.equal(
    result.byteLength,
    files.reduce((bytes, file) => bytes + Buffer.byteLength(file.content), 0),
  );
  assert.deepEqual(fs.readdirSync(f.output), ["bulk"]);
  const output = path.join(f.output, "bulk");
  assert.deepEqual(
    fs.readdirSync(output).sort(),
    files.map(({ name }) => name),
  );
  for (const { name, content } of files)
    assert.equal(fs.readFileSync(path.join(output, name), "utf8"), content);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), commit);
  assert.deepEqual(fs.readFileSync(path.join(f.root, ".git", "index")), index);
});

/** 原本・Commit・Path・未知fieldとAccessorを、Effect前に検査する。 */
test("固定File読取りは偽Root・不正入力・Accessorを拒否する", (t) => {
  const f = fixture(t);
  assert.equal(
    readCommitFile({ ...f.repository }, { commit: f.commit, path: "a.txt" }),
    null,
  );
  assert.equal(
    readCommitFile(f.repository, { commit: "f".repeat(40), path: "a.txt" }),
    null,
  );
  assert.equal(
    readCommitFile(f.repository, { commit: f.commit, path: "../a.txt" }),
    null,
  );
  assert.equal(
    readCommitFile(f.repository, {
      commit: f.commit,
      path: "a.txt",
      extra: Infinity,
    } as CommitFileReadRequest),
    null,
  );
  let wasInvoked = false;
  const accessor = Object.defineProperty({ path: "a.txt" }, "commit", {
    get() {
      wasInvoked = true;
      return f.commit;
    },
  });
  assert.equal(
    readCommitFile(f.repository, accessor as CommitFileReadRequest),
    null,
  );
  assert.equal(wasInvoked, false);
  const proxied = new Proxy(
    { commit: f.commit, path: "a.txt" },
    {
      ownKeys() {
        wasInvoked = true;
        return [];
      },
    },
  );
  assert.equal(readCommitFile(f.repository, proxied), null);
  assert.equal(wasInvoked, false);
  const selected: string[] = [];
  Object.defineProperty(selected, "0", {
    get() {
      wasInvoked = true;
      return "a.txt";
    },
  });
  assert.equal(
    copyCommitFiles(f.repository, { ...f.request, paths: selected })?.status,
    "blocked",
  );
  assert.equal(wasInvoked, false);
  assert.deepEqual(fs.readdirSync(f.output), []);
});

/** true=拒否を維持し、発行しなかった空出力先の回収を確認する。 */
test("内容拒否と不明Commitは成功へ丸めず同じ空出力先を回収する", (t) => {
  const f = fixture(t);
  const rejected = copyCommitFiles(f.repository, {
    ...f.request,
    inspectContent: () => true,
  });
  assert.equal(rejected?.status, "blocked");
  if (rejected?.status !== "blocked") return;
  assert.equal(rejected.reason, "fixed_snapshot_content_policy_rejected");
  assert.equal(rejected.effectIssued, false);
  assert.equal(rejected.cleanupConfirmed, true);
  assert.equal(fs.existsSync(f.output), false);
  fs.mkdirSync(f.output);
  const missing = copyCommitFiles(f.repository, {
    ...f.request,
    commit: "f".repeat(40),
  });
  assert.equal(missing?.status, "blocked");
  assert.equal(fs.existsSync(f.output), false);
});

/** 実書込み後の故障と回収故障を分け、残存を成功扱いしない。 */
test("部分コピーと回収失敗はEffect・Cleanupを別に返す", async (t) => {
  for (const cleanupFails of [false, true])
    await t.test(String(cleanupFails), (st) => {
      const f = fixture(st);
      const write = fs.writeFileSync,
        remove = fs.rmSync;
      let writes = 0;
      st.mock.method(
        fs,
        "writeFileSync",
        (...args: Parameters<typeof fs.writeFileSync>) => {
          if (
            typeof args[0] === "string" &&
            args[0].startsWith(f.output + path.sep) &&
            ++writes === 2
          )
            throw Error("synthetic_write_failure");
          return write(...args);
        },
      );
      if (cleanupFails)
        st.mock.method(
          fs,
          "rmSync",
          (...args: Parameters<typeof fs.rmSync>) => {
            if (args[0] === f.output) throw Error("synthetic_cleanup_failure");
            return remove(...args);
          },
        );
      const result = copyCommitFiles(f.repository, f.request);
      assert.equal(result?.status, "blocked");
      if (result?.status !== "blocked") return;
      assert.equal(result.effectIssued, true);
      assert.equal(result.cleanupConfirmed, !cleanupFails);
      assert.equal(result.effectStateUnknown, true);
      assert.equal(fs.existsSync(f.output), cleanupFails);
    });
});

/** 別Repository・管理Path・偽原本を任意Pathの処置へ開放しない。 */
test("コピー先は指定Repository内の空Directoryと同じ境界に限定する", (t) => {
  const f = fixture(t);
  for (const relativeDirectory of ["", "../outside", ".git/objects"]) {
    assert.equal(
      copyCommitFiles(f.repository, { ...f.request, relativeDirectory })
        ?.status,
      "blocked",
    );
  }
  assert.equal(
    copyCommitFiles(f.repository, {
      ...f.request,
      outputRepository: { ...f.repository },
    })?.status,
    "blocked",
  );
  fs.writeFileSync(path.join(f.output, "existing.txt"), "keep\n");
  assert.equal(copyCommitFiles(f.repository, f.request)?.status, "blocked");
  assert.equal(
    fs.readFileSync(path.join(f.output, "existing.txt"), "utf8"),
    "keep\n",
  );
  const nested = path.join(f.root, ".crdd", "nested");
  git(f.root, ["init", "--quiet", nested]);
  fs.mkdirSync(path.join(nested, "out"));
  const result = copyCommitFiles(f.repository, {
    ...f.request,
    relativeDirectory: ".crdd/nested/out",
  });
  assert.equal(result?.status, "blocked");
  assert.equal(fs.existsSync(path.join(nested, "out")), true);
});

/** 同期内容検査で差し替えられても、新実体を消さず不明を返す。 */
test("内容検査後の出力・親差替えを再確認して後続書込みと誤回収を止める", async (t) => {
  for (const shouldReplaceParent of [false, true])
    await t.test(String(shouldReplaceParent), (st) => {
      const f = fixture(st);
      let isChanged = false;
      const result = copyCommitFiles(f.repository, {
        ...f.request,
        inspectContent: () => {
          if (!isChanged) {
            isChanged = true;
            const from = shouldReplaceParent
              ? path.dirname(f.output)
              : f.output;
            fs.renameSync(from, from + "-original");
            fs.mkdirSync(f.output, { recursive: true });
            fs.writeFileSync(path.join(f.output, "foreign.txt"), "keep\n");
          }
          return false;
        },
      });
      assert.equal(result?.status, "blocked");
      if (result?.status !== "blocked") return;
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.effectStateUnknown, true);
      assert.equal(
        fs.readFileSync(path.join(f.output, "foreign.txt"), "utf8"),
        "keep\n",
      );
      assert.deepEqual(fs.readdirSync(f.output), ["foreign.txt"]);
    });
});

/** 書込み後の空状態を、過去Effectなしの証明として使わない。 */
test("書込み後にFileが消えても発行可能性と不明を回収成功で消さない", (t) => {
  const f = fixture(t);
  const write = fs.writeFileSync;
  let effectIssued = false;
  t.mock.method(
    fs,
    "writeFileSync",
    (...args: Parameters<typeof fs.writeFileSync>) => {
      const result = write(...args);
      if (args[0] === path.join(f.output, "a.txt")) {
        effectIssued = true;
        fs.unlinkSync(args[0]);
        throw Error("synthetic_write_then_disappear");
      }
      return result;
    },
  );
  const result = copyCommitFiles(f.repository, f.request);
  assert.equal(effectIssued, true);
  assert.equal(result?.status, "blocked");
  if (result?.status !== "blocked") return;
  assert.equal(result.effectIssued, true);
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(fs.existsSync(f.output), false);
});

/** 非同期の判断値を受理せず、PromiseのRejectもProcessへ漏らさない。 */
test("同期内容検査のPromise返却はコピーせずRejectを捕捉する", async (t) => {
  const f = fixture(t);
  let unhandled = 0,
    writes = 0;
  const onUnhandled = () => {
    unhandled++;
  };
  process.on("unhandledRejection", onUnhandled);
  t.after(() => process.removeListener("unhandledRejection", onUnhandled));
  const write = fs.writeFileSync;
  t.mock.method(
    fs,
    "writeFileSync",
    (...args: Parameters<typeof fs.writeFileSync>) => {
      if (
        typeof args[0] === "string" &&
        args[0].startsWith(f.output + path.sep)
      )
        writes++;
      return write(...args);
    },
  );
  for (const inspectContent of [
    async () => {
      throw Error("synthetic_async_query_reject");
    },
    () => Promise.reject(Error("synthetic_query_promise_reject")),
  ]) {
    if (!fs.existsSync(f.output)) fs.mkdirSync(f.output);
    const result = copyCommitFiles(f.repository, {
      ...f.request,
      inspectContent:
        inspectContent as unknown as CommitFilesCopyRequest["inspectContent"],
    });
    assert.equal(result?.status, "blocked");
    if (result?.status !== "blocked") throw Error("expected_blocked");
    assert.equal(result.effectIssued, false);
    assert.equal(writes, 0);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(unhandled, 0);
  }
});
