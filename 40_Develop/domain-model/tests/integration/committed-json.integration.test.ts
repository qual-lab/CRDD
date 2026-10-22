/**
 * 共通JSON保存の確定・拒否・中断を実Filesystemで検証する。
 * @packageDocumentation
 * @responsibility 本文とsidecarの同一性、未知状態の保持と試験Rootの境界を確認する。
 * @trace PRL-IT-013
 * @level IT
 * @scope 共通保存と自己生成試験領域。
 * @boundary ローカルFilesystemと自己生成子Process。Docker・認証・外部AIなし。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import {
  getJsonCommitName,
  readCommittedJson,
  writeCommittedJson,
  removeCommittedJson,
} from "../../src/index.ts";

/**
 * 試験Rootの作成・清掃が現在Repositoryへ閉じることを確認する。
 *
 * @responsibility CWD・一時領域環境値に依存しない作成と兄弟保全を反証する。
 * @trace PRL-IT-013
 * @precondition 現在Repositoryの実Rootを読み取れる。
 * @stimulus CWDとTEMP系環境を変えて二つの試験Rootを作り一方を清掃する。
 * @observation 生成先、兄弟本文、対象の不存在、二重清掃の拒否。
 * @oracle 二Rootは同じ.crdd/tests直下で、対象だけが消え兄弟本文は不変。
 * @cleanup 作成handleで両Rootを回収し、CWD・環境を元値へ復元する。
 * @boundary Repository-localの実Filesystem。Docker・外部AIは使わない。
 */
test("recovery test directories ignore ambient roots and preserve siblings", () => {
  const repositoryRoot = fs.realpathSync.native(
    path.resolve(import.meta.dirname, "../../../.."),
  );
  const previousCwd = process.cwd();
  const previousEnvironment = ["TEMP", "TMP", "TMPDIR"].map(
    (name) => [name, process.env[name]] as const,
  );
  let first: ReturnType<typeof createRepositoryTestDirectory> | null = null;
  let sibling: ReturnType<typeof createRepositoryTestDirectory> | null = null;
  try {
    const packageDirectory = path.join(
      repositoryRoot,
      "40_Develop",
      "coordinator",
    );
    assert.equal(fs.lstatSync(packageDirectory).isSymbolicLink(), false);
    process.chdir(packageDirectory);
    assert.notEqual(process.cwd(), repositoryRoot);
    for (const [name] of previousEnvironment)
      process.env[name] = path.join(repositoryRoot, "not-created-ambient-temp");
    first = createRepositoryTestDirectory("crdd-journal-root-oracle-");
    sibling = createRepositoryTestDirectory("crdd-journal-sibling-oracle-");
    assert.equal(
      path.dirname(first.path),
      path.join(repositoryRoot, ".crdd", "tests"),
    );
    assert.equal(path.dirname(sibling.path), path.dirname(first.path));
    const marker = path.join(sibling.path, "marker.txt");
    fs.writeFileSync(marker, "sibling remains");
    first.cleanup();
    assert.throws(() => fs.lstatSync(first?.path as string), {
      code: "ENOENT",
    });
    assert.throws(() => first?.cleanup(), { code: "ENOENT" });
    first = null;
    assert.equal(fs.readFileSync(marker, "utf8"), "sibling remains");
  } finally {
    process.chdir(previousCwd);
    for (const [name, value] of previousEnvironment) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    first?.cleanup();
    sibling?.cleanup();
  }
});

/**
 * 試験Directory helperの実本文を故障Filesystemへ接続する。
 *
 * @responsibility 作成前拒否と清掃前拒否を要求回数で分離する。
 * @trace PRL-IT-013
 * @precondition 本番と独立した閉じたFilesystem模型を使う。
 * @stimulus prefix、Repository確認、祖先、実体または観測を一軸変更する。
 * @observation mkdtemp／rm回数と保持されたDirectory集合。
 * @oracle 不正な作成前提はmkdtemp0、清掃実体差はrm0、正常だけ一回削除。
 * @cleanup N/A: VM内の局所模型だけで実Filesystemへ書き込まない。
 * @boundary 実helper本文→注入Filesystem。実Docker・Processは発行しない。
 */
test("recovery test directory rejects uncertain roots before creation or deletion", () => {
  const sourceDirectory = path.resolve(import.meta.dirname, "../support");
  const repositoryRoot = path.resolve(sourceDirectory, "../../../..");
  const source = fs.readFileSync(
    path.join(sourceDirectory, "repository-test-directory.ts"),
    "utf8",
  );
  const functionText = source
    .slice(source.indexOf("export function createRepositoryTestDirectory"))
    .replace("export function", "function")
    .replaceAll("import.meta.dirname", JSON.stringify(sourceDirectory));
  const javascript = stripTypeScriptTypes(functionText);
  for (const scenario of [
    "normal",
    "invalid-prefix",
    "invalid-repository",
    "ancestor-file",
    "ancestor-link",
    "ancestor-alias",
    "ancestor-unreadable",
    "missing-ancestors",
    "root-replaced",
    "parent-replaced",
    "root-link",
    "cleanup-unreadable",
  ]) {
    const parent = path.join(repositoryRoot, ".crdd", "tests");
    const root = path.join(parent, "crdd-oracle-ABCDEF");
    const directories = new Map([
      [repositoryRoot, 1n],
      [path.dirname(parent), 2n],
      [parent, 3n],
    ]);
    if (scenario === "missing-ancestors") {
      directories.delete(parent);
      directories.delete(path.dirname(parent));
    }
    let creates = 0;
    let removals = 0;
    let cleaning = false;
    /**
     * 模型のDirectory実体と観測故障を返す。
     * @responsibility 実Filesystemに触れず対象別の状態を供給する。
     * @trace PRL-IT-013
     * @precondition シナリオ固有のDirectory集合を保持している。
     * @stimulus 実helperからPathを照会する。
     * @observation 実体属性または明示的なENOENT／EACCES。
     * @oracle 存在しないPathと観測不能を別の例外にする。
     * @cleanup N/A: 局所Mapだけを参照する。
     * @boundary 試験模型内の同期読取り。
     */
    const lstatSync = (directory: string) => {
      if (directory === parent && scenario === "ancestor-unreadable")
        throw Object.assign(new Error("unreadable"), { code: "EACCES" });
      if (cleaning && directory === root && scenario === "cleanup-unreadable")
        throw Object.assign(new Error("unreadable"), { code: "EACCES" });
      const ino = directories.get(directory);
      if (ino === undefined)
        throw Object.assign(new Error("absent"), { code: "ENOENT" });
      return {
        dev: 1n,
        ino,
        birthtimeNs: ino,
        isDirectory: () =>
          !(directory === parent && scenario === "ancestor-file"),
        isSymbolicLink: () =>
          (directory === parent && scenario === "ancestor-link") ||
          (cleaning && directory === root && scenario === "root-link"),
      };
    };
    const context = vm.createContext({
      Error,
      Object,
      path,
      verifyRepositoryRoot: () =>
        scenario === "invalid-repository"
          ? { status: "blocked" }
          : { status: "completed", capability: {} },
      resolveVerifiedRepositoryRoot: () => repositoryRoot,
      fs: {
        lstatSync,
        realpathSync: {
          native: (directory: string) =>
            directory === parent && scenario === "ancestor-alias"
              ? `${directory}-alias`
              : directory,
        },
        mkdirSync: (directory: string) => {
          directories.set(directory, 20n);
        },
        mkdtempSync: (prefix: string) => {
          assert.equal(prefix, path.join(parent, "crdd-oracle-"));
          creates += 1;
          directories.set(root, 4n);
          return root;
        },
        rmSync: (directory: string) => {
          assert.equal(directory, root);
          removals += 1;
          directories.delete(directory);
        },
      },
    });
    const create = vm.runInContext(
      `${javascript}\ncreateRepositoryTestDirectory`,
      context,
    ) as (prefix: string) => ReturnType<typeof createRepositoryTestDirectory>;
    const beforeCreationFailure = [
      "invalid-prefix",
      "invalid-repository",
      "ancestor-file",
      "ancestor-link",
      "ancestor-alias",
      "ancestor-unreadable",
    ].includes(scenario);
    if (beforeCreationFailure) {
      for (const prefix of scenario === "invalid-prefix"
        ? [
            "",
            "../escape-",
            "..",
            "/absolute-",
            "C:\\escape-",
            "nested/name-",
            "nested\\name-",
          ]
        : ["crdd-oracle-"])
        assert.throws(() => create(prefix));
      assert.equal(creates, 0, scenario);
      assert.equal(removals, 0, scenario);
      continue;
    }
    const fixture = create("crdd-oracle-");
    cleaning = true;
    if (scenario === "root-replaced") directories.set(root, 9n);
    if (scenario === "parent-replaced") directories.set(parent, 9n);
    if (scenario === "normal" || scenario === "missing-ancestors") {
      fixture.cleanup();
      assert.equal(removals, 1, scenario);
      assert.equal(directories.has(root), false, scenario);
      assert.equal(directories.has(parent), true, scenario);
      assert.throws(() => fixture.cleanup());
      assert.equal(removals, 1, scenario);
    } else {
      assert.throws(() => fixture.cleanup());
      assert.equal(removals, 0, scenario);
      assert.equal(directories.has(root), true, scenario);
    }
    assert.equal(creates, 1, scenario);
  }
});

/**
 * 指定切断点で自己生成子を終了し残存を親へ返す。
 * @responsibility fsyncと二段renameを実Processの終了で反証する。
 * @trace PRL-IT-013
 * @precondition 同じ試験が生成した空Directory。
 * @stimulus 合成JSON保存の指定境界で子自身を終了する。
 * @observation 子の終了状態と本文・sidecar。
 * @oracle 呼出し側が不完全組の保持と完全組だけの受理を判定する。
 * @cleanup 子終了を同期確認し、Directoryは呼出し側が回収する。
 * @boundary 専用子とローカルFilesystem。外部Runtimeなし。
 */
function crashWriter(directory: string, point: string) {
  const url = new URL("../../src/storage/committed-json.ts", import.meta.url)
    .href;
  const script = [
    'import fs from "node:fs";',
    "const originalFsync = fs.fsyncSync, originalRename = fs.renameSync; let syncCount = 0, renameCount = 0;",
    "fs.fsyncSync = (...args) => {const r=originalFsync(...args); if(++syncCount===1 && " +
      JSON.stringify(point) +
      '==="fsync") process.kill(process.pid,"SIGKILL"); return r;};',
    "fs.renameSync = (...args) => {const r=originalRename(...args); if(" +
      JSON.stringify(point) +
      '==="rename-"+(++renameCount)) process.kill(process.pid,"SIGKILL"); return r;};',
    `const store = await import(${JSON.stringify(url)});`,
    "store.writeCommittedJson(" +
      JSON.stringify(directory) +
      ',"record.json","record.json",{schema:"fixture/v1",value:true});',
  ].join("\n");
  return spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 10_000,
    windowsHide: true,
  });
}

/**
 * 四操作のbyte・相関と成功時の対象限定削除を確認する。
 * @responsibility commit Schema・Hash・Identity・logicalKey・改行を固定する。
 * @trace PRL-IT-013
 * @precondition 自己生成Directoryと合成JSONのみ。
 * @stimulus 保存、読戻し、誤key拒否、削除を実行する。
 * @observation 本文・marker・返却値と削除後一覧。
 * @oracle 既存形式に一致し対象外Fileは不変。
 * @cleanup 同じRootを実体限定helperで回収する。
 * @boundary Domain Root APIと実Filesystem。
 */
test("共通保存四操作はbyte・Hash・logicalKeyと対象外Fileを維持する", () => {
  const f = createRepositoryTestDirectory("committed-json-");
  try {
    fs.writeFileSync(path.join(f.path, "other.txt"), "unchanged");
    const value = { schema: "fixture/v1", value: true };
    const written = writeCommittedJson(
      f.path,
      "record.json",
      "record-key",
      value,
    );
    const bytes = `${JSON.stringify(value)}\n`;
    assert.equal(fs.readFileSync(written.target, "utf8"), bytes);
    assert.equal(
      written.hash,
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(
      getJsonCommitName("record.json"),
      "record.json.crdd-commit.json",
    );
    assert.deepEqual(JSON.parse(fs.readFileSync(written.commit, "utf8")), {
      schema: "crdd-coordinator-durable-json-commit/v1",
      logicalKey: "record-key",
      contentHash: written.hash,
      contentIdentity: written.identityText,
      contentBytes: Buffer.byteLength(bytes),
    });
    assert.deepEqual(
      readCommittedJson(written.target, "record-key").value,
      value,
    );
    assert.throws(() => readCommittedJson(written.target, "wrong-key"));
    assert.throws(() =>
      writeCommittedJson(f.path, "record.json", "record-key", {}),
    );
    assert.equal(fs.readFileSync(written.target, "utf8"), bytes);
    assert.equal(removeCommittedJson(written.target, "record-key"), true);
    assert.deepEqual(fs.readdirSync(f.path), ["other.txt"]);
    assert.equal(
      fs.readFileSync(path.join(f.path, "other.txt"), "utf8"),
      "unchanged",
    );
  } finally {
    f.cleanup();
  }
});

/**
 * symlink経由の本文を保存対象へ読み替えない。
 * @responsibility lstatによる既存拒否と対象外本文の保持を確認する。
 * @trace PRL-IT-013
 * @precondition 正常組と同じRoot内の自己生成symlink。
 * @stimulus alias名をread／removeへ渡す。
 * @observation 両操作の失敗と元pair・aliasの残存。
 * @oracle 拒否後に本文・sidecarへ変更を出さない。
 * @cleanup 自己生成Rootだけを回収する。
 * @boundary 実Filesystem。alias全探索は保証しない。
 */
test("symlink経由の読取りと削除は元pairを変更せず拒否する", () => {
  const f = createRepositoryTestDirectory("committed-json-symlink-");
  try {
    const r = writeCommittedJson(f.path, "record.json", "record.json", {
      ok: true,
    });
    const alias = path.join(f.path, "alias.json");
    fs.symlinkSync(r.target, alias, "file");
    const bytes = fs.readFileSync(r.target),
      marker = fs.readFileSync(r.commit);
    assert.throws(() => readCommittedJson(alias));
    assert.throws(() => removeCommittedJson(alias));
    assert.deepEqual(fs.readFileSync(r.target), bytes);
    assert.deepEqual(fs.readFileSync(r.commit), marker);
    assert.equal(fs.lstatSync(alias).isSymbolicLink(), true);
  } finally {
    f.cleanup();
  }
});

/**
 * File種類・長さ・JSON上限の拒否を維持する。
 * @responsibility 不正本文を成功へ補正せず保存物を保持する。
 * @trace PRL-IT-013
 * @precondition 各刺激で新品の正常組を生成する。
 * @stimulus 空、上限超過、不正JSON、Directoryへ本文を変える。
 * @observation read／removeの例外と変更後状態の保持。
 * @oracle 不正入力では削除intentすら発行しない。
 * @cleanup 自己生成Rootのみを回収する。
 * @boundary 公開保存APIと実Filesystem。
 */
test("空・上限超過・不正JSON・Directoryは保存本文として受理しない", () => {
  for (const mode of ["empty", "oversize", "json", "directory"]) {
    const f = createRepositoryTestDirectory("committed-json-size-");
    try {
      const r = writeCommittedJson(f.path, "record.json", "record.json", {
        ok: true,
      });
      if (mode === "directory") {
        fs.rmSync(r.target);
        fs.mkdirSync(r.target);
      } else
        fs.writeFileSync(
          r.target,
          mode === "empty" ? "" : mode === "json" ? "{" : "x".repeat(262145),
        );
      assert.throws(() => readCommittedJson(r.target));
      assert.throws(() => removeCommittedJson(r.target));
      assert.deepEqual(
        fs.readdirSync(f.path).sort(),
        ["record.json", getJsonCommitName("record.json")].sort(),
      );
      assert.equal(fs.lstatSync(r.target).isDirectory(), mode === "directory");
    } finally {
      f.cleanup();
    }
  }
});

/**
 * 削除intentの各不正fieldを処置前に拒否する。
 * @responsibility sidecarから捕捉したnamed pairの相関を全数維持する。
 * @trace PRL-IT-013
 * @precondition 各自己生成子で正常組を作成する。
 * @stimulus intentの確定直後に一fieldだけ不正化する。
 * @observation 削除失敗と元本文・sidecarの残存。
 * @oracle 不正intentから削除へ進まず、旧回復APIも使わない。
 * @cleanup 子終了を確認し自己生成Rootのみを回収する。
 * @boundary 公開削除と限定Filesystem故障注入。
 */
test("削除intentの不正Schema・実体・各pair要素は処置前に拒否する", () => {
  for (const field of [
    "schema",
    "parentIdentity",
    "pair",
    "extra",
    "logicalKey",
    "contentName",
    "contentSerialized",
    "contentHash",
    "contentIdentity",
    "contentBytes",
    "commitName",
    "commitSerialized",
    "commitHash",
    "commitIdentity",
    "commitBytes",
    "commitSchema",
  ]) {
    const f = createRepositoryTestDirectory("committed-json-intent-");
    try {
      const url = new URL(
        "../../src/storage/committed-json.ts",
        import.meta.url,
      ).href;
      const script = [
        'import fs from "node:fs";import {createHash} from "node:crypto";',
        "const store=await import(" +
          JSON.stringify(url) +
          "); const r=store.writeCommittedJson(" +
          JSON.stringify(f.path) +
          ',"record.json","record.json",{ok:true});',
        `const rename=fs.renameSync;const field=${JSON.stringify(field)};`,
        'fs.renameSync=(...a)=>{const result=rename(...a);if(String(a[1]).includes(".crdd-delete-")&&!String(a[1]).endsWith(".pending")){const v=JSON.parse(fs.readFileSync(a[1],"utf8"));',
        'if(field==="schema"||field==="parentIdentity")v[field]="invalid";else if(field==="pair")v.pair=null;else if(field==="extra")v.pair.unexpected=true;',
        'else if(field==="commitSchema"){const c=JSON.parse(v.pair.commitSerialized);c.schema="invalid";v.pair.commitSerialized=JSON.stringify(c)+"\\n";v.pair.commitHash=createHash("sha256").update(v.pair.commitSerialized).digest("hex");v.pair.commitBytes=Buffer.byteLength(v.pair.commitSerialized);}',
        'else v.pair[field]=field.endsWith("Bytes")?-1:field.endsWith("Name")?"../outside":"invalid";fs.writeFileSync(a[1],JSON.stringify(v)+"\\n");}return result;};',
        'try{store.removeCommittedJson(r.target);process.stdout.write("unexpected_success");}catch{process.stdout.write("blocked");}',
      ].join("\n");
      const child = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", script],
        {
          encoding: "utf8",
          timeout: 10_000,
          windowsHide: true,
        },
      );
      assert.equal(child.error, undefined, field);
      assert.equal(child.status, 0, child.stderr);
      assert.equal(child.stdout, "blocked", field);
      assert.equal(
        fs.readFileSync(path.join(f.path, "record.json"), "utf8"),
        '{"ok":true}\n',
        field,
      );
      assert.equal(
        fs.existsSync(path.join(f.path, getJsonCommitName("record.json"))),
        true,
        field,
      );
    } finally {
      f.cleanup();
    }
  }
});

/**
 * 削除途中の四組合せを公開操作から確認する。
 * @responsibility 私有分類の全入力を実処置と保持へ接続する。
 * @trace PRL-IT-013
 * @precondition 各子が正常組を作成し、同じintentを確定する。
 * @stimulus intent確定直後に既知の内容／sidecar不存在を注入する。
 * @observation 完了またはthird stateと残るPath。
 * @oracle contentだけが残る不整合は保持し、既知三状態だけ対象を閉じる。
 * @cleanup 子終了後の自己生成Rootだけを回収する。
 * @boundary 実削除APIと有限な状態注入。
 */
test("削除の全四状態は既知三形の完了と不整合保持へ接続する", () => {
  for (const mode of ["both", "commit_only", "neither", "content_only"]) {
    const f = createRepositoryTestDirectory("committed-json-delete-");
    try {
      const url = new URL(
        "../../src/storage/committed-json.ts",
        import.meta.url,
      ).href;
      const script = [
        'import fs from "node:fs";const store=await import(' +
          JSON.stringify(url) +
          ");",
        "const r=store.writeCommittedJson(" +
          JSON.stringify(f.path) +
          ',"record.json","record.json",{ok:true});',
        `const rename=fs.renameSync;const mode=${JSON.stringify(mode)};`,
        'fs.renameSync=(...a)=>{const result=rename(...a);if(String(a[1]).includes(".crdd-delete-")&&!String(a[1]).endsWith(".pending")){if(mode==="commit_only"||mode==="neither")fs.rmSync(r.target);if(mode==="content_only"||mode==="neither")fs.rmSync(r.commit);}return result;};',
        'try{store.removeCommittedJson(r.target);process.stdout.write("completed");}catch(e){process.stdout.write(e.message);}',
      ].join("\n");
      const child = spawnSync(
        process.execPath,
        ["--input-type=module", "-e", script],
        {
          encoding: "utf8",
          timeout: 10_000,
          windowsHide: true,
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.status, 0, child.stderr);
      if (mode === "content_only") {
        assert.equal(child.stdout, "docker_recovery_delete_intent_third_state");
        assert.equal(fs.existsSync(path.join(f.path, "record.json")), true);
        assert.equal(
          fs.readdirSync(f.path).some((n) => n.startsWith(".crdd-delete-")),
          true,
        );
      } else {
        assert.equal(child.stdout, "completed", mode);
        assert.deepEqual(fs.readdirSync(f.path), [], mode);
      }
    } finally {
      f.cleanup();
    }
  }
});

/**
 * 本文とmarkerの相関欠損を不変で拒否する。
 * @responsibility Schema・Hash・Identity・長さ・正規byteの検査を維持する。
 * @trace PRL-IT-013
 * @precondition 各刺激で新品の正常組を生成する。
 * @stimulus 組の一要素だけを不正にする。
 * @observation read／removeの例外と拒否後のbyte。
 * @oracle 不正組を採用・削除しない。
 * @cleanup 自己生成Rootだけを回収する。
 * @boundary 共通保存と実Filesystem。
 */
test("不正Schema・Hash・Identity・長さ・非正規本文は保持して拒否する", () => {
  for (const field of [
    "schema",
    "contentHash",
    "contentIdentity",
    "contentBytes",
    "noncanonical",
  ]) {
    const f = createRepositoryTestDirectory("committed-json-invalid-");
    try {
      const record = writeCommittedJson(f.path, "record.json", "record.json", {
        ok: true,
      });
      if (field === "noncanonical") fs.appendFileSync(record.target, " ");
      else {
        const marker = JSON.parse(fs.readFileSync(record.commit, "utf8"));
        marker[field] =
          field === "contentBytes" ? marker[field] + 1 : "invalid";
        fs.writeFileSync(record.commit, `${JSON.stringify(marker)}\n`);
      }
      const before = fs.readFileSync(record.target),
        marker = fs.readFileSync(record.commit);
      assert.throws(() => readCommittedJson(record.target), field);
      assert.throws(() => removeCommittedJson(record.target), field);
      assert.deepEqual(fs.readFileSync(record.target), before);
      assert.deepEqual(fs.readFileSync(record.commit), marker);
    } finally {
      f.cleanup();
    }
  }
});

/**
 * hardlinkが存在しても削除対象を指定名へ限定する。
 * @responsibility 別名の本文を再書込み・削除しない既存範囲を確認する。
 * @trace PRL-IT-013
 * @precondition 自己生成の正常組。
 * @stimulus 同じRoot内へhardlinkを作る。
 * @observation 指定pairの削除、別名のbyteとdev／ino。
 * @oracle 別名を保持する。unlinkで変わるlink数の不変は要求しない。
 * @cleanup 自己生成Rootだけを回収する。
 * @boundary 実Filesystem。Repository外への書込みなし。
 */
test("hardlink別名を残して指定本文と確定記録だけを削除する", () => {
  const f = createRepositoryTestDirectory("committed-json-link-");
  try {
    const r = writeCommittedJson(f.path, "record.json", "record.json", {
      ok: true,
    });
    const alias = path.join(f.path, "alias.json");
    fs.linkSync(r.target, alias);
    const before = fs.statSync(alias, { bigint: true });
    assert.deepEqual(readCommittedJson(r.target).value, { ok: true });
    assert.throws(
      () => readCommittedJson(alias),
      /docker_task_recovery_commit_missing/u,
    );
    assert.equal(removeCommittedJson(r.target), true);
    assert.equal(fs.existsSync(alias), true);
    assert.equal(fs.existsSync(r.target), false);
    assert.equal(fs.existsSync(r.commit), false);
    assert.deepEqual(fs.readdirSync(f.path), ["alias.json"]);
    assert.equal(fs.readFileSync(alias, "utf8"), '{"ok":true}\n');
    const after = fs.statSync(alias, { bigint: true });
    assert.equal(after.dev, before.dev);
    assert.equal(after.ino, before.ino);
  } finally {
    f.cleanup();
  }
});

/**
 * 確定途中の中断を完成へ補正しない。
 * @responsibility fsync・本文rename・commit renameの三境界を区別する。
 * @trace PRL-IT-013
 * @precondition 境界ごとに新品Rootを使う。
 * @stimulus 保存中の実子Processを子自身が終了する。
 * @observation 子終了・本文・sidecar・読戻し。
 * @oracle 不完全組は保持・拒否し、完全組だけ読める。
 * @cleanup 子終了後、同じRootを回収する。
 * @boundary 実保存と自己生成子。停電保証は主張しない。
 */
test("fsyncと二段renameの中断で不完全組と完全組を区別する", () => {
  for (const point of ["fsync", "rename-1", "rename-2"]) {
    const f = createRepositoryTestDirectory("committed-json-crash-");
    try {
      const child = crashWriter(f.path, point);
      assert.equal(child.error, undefined);
      assert.notEqual(child.status, 0);
      const target = path.join(f.path, "record.json"),
        marker = path.join(f.path, getJsonCommitName("record.json"));
      if (point === "fsync") {
        assert.equal(fs.existsSync(target), false);
        assert.equal(fs.existsSync(marker), false);
        assert.equal(fs.readdirSync(f.path).length, 1);
      } else if (point === "rename-1") {
        assert.equal(fs.existsSync(target), true);
        assert.equal(fs.existsSync(marker), false);
        const before = fs.readFileSync(target);
        assert.throws(
          () => readCommittedJson(target),
          /docker_task_recovery_commit_missing/u,
        );
        assert.throws(() =>
          writeCommittedJson(f.path, "record.json", "record.json", {}),
        );
        assert.deepEqual(fs.readFileSync(target), before);
      } else
        assert.deepEqual(readCommittedJson(target).value, {
          schema: "fixture/v1",
          value: true,
        });
    } finally {
      f.cleanup();
    }
  }
});

/**
 * 削除後の観測不能を明示不存在へ縮退させない。
 * @responsibility 失敗理由と残るsidecar／intentを保持する。
 * @trace PRL-IT-013
 * @precondition 自己生成Rootと子内の限定fs代役。
 * @stimulus 本文削除後だけlstatをEACCESにする。
 * @observation 固定失敗理由とsidecar／intentの残存。
 * @oracle 不明を成功へ変換せず旧directory回復を呼ばない。
 * @cleanup 子終了後、自己生成Rootだけを回収する。
 * @boundary 実公開削除APIと故障注入。新しい回復APIなし。
 */
test("削除後の観測不能は失敗理由とintentを保持する", () => {
  const f = createRepositoryTestDirectory("committed-json-unknown-");
  try {
    const url = new URL("../../src/storage/committed-json.ts", import.meta.url)
      .href;
    const script = [
      'import fs from "node:fs";const store=await import(' +
        JSON.stringify(url) +
        ");",
      "const r=store.writeCommittedJson(" +
        JSON.stringify(f.path) +
        ',"record.json","record.json",{ok:true});',
      "const rm=fs.rmSync,stat=fs.lstatSync;let removed=false;",
      "fs.rmSync=(...a)=>{const v=rm(...a);if(a[0]===r.target)removed=true;return v;};",
      'fs.lstatSync=(...a)=>{if(removed&&a[0]===r.target)throw Object.assign(new Error("synthetic"),{code:"EACCES"});return stat(...a);};',
      'try{store.removeCommittedJson(r.target);process.stdout.write("unexpected_success");}catch(e){process.stdout.write(e.message);}',
    ].join("\n");
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0, child.stderr);
    assert.equal(child.stdout, "docker_recovery_path_observation_unknown");
    assert.equal(
      fs.existsSync(path.join(f.path, getJsonCommitName("record.json"))),
      true,
    );
    assert.equal(
      fs.readdirSync(f.path).some((n) => n.startsWith(".crdd-delete-")),
      true,
    );
  } finally {
    f.cleanup();
  }
});
