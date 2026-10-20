/**
 * Repository固有の追加通信設定Readerを実Filesystemへ接続する。
 * @packageDocumentation
 * @responsibility 不在・不正・観測不能と値Snapshotを区別する。
 * @trace RDL-IT-001
 * @level IT
 * @scope Repository Root、固定設定Path、上限付き読取り。
 * @boundary 検証済みRootから自己生成Fileの読取り。通信許可・Docker操作なし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import test, { type TestContext } from "node:test";
import {
  readNetworkPolicy,
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
} from "../../src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";

/**
 * 現在Repository内だけに独立した試験Rootを作る。
 * @responsibility Root能力の発行とexactな清掃を試験へ提供する。
 * @trace RDL-IT-001
 * @precondition 現在Repository Rootを検証できる。
 * @stimulus tests領域に最小のGit境界を作る。
 * @observation 検証済みRoot、固定設定Pathを返す。
 * @oracle 親・兄弟Repositoryへ書き込まない。
 * @cleanup afterで同じRootの非Link・所在を確認して削除し不存在を確認する。
 * @boundary 試験だけが所有するRepository-local Root。
 */
function createNetworkPolicyFixture(t: TestContext) {
  const current = verifyRepositoryRoot(
    path.resolve(import.meta.dirname, "../../../.."),
  );
  if (current.status !== "completed") assert.fail("fixture_root_invalid");
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(current.capability, "tests"),
    "fixture_area_invalid",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "network-policy-"));
  t.after(() => {
    assert.equal(path.dirname(root), area.directory);
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verified = verifyRepositoryRoot(root);
  if (verified.status !== "completed") assert.fail("fixture_invalid");
  return {
    root,
    capability: verified.capability,
    config: path.join(root, ".crdd", "config"),
    file: path.join(root, ".crdd", "config", "network-policy.json"),
  };
}

/**
 * 真正不存在と明示設定のRepository間非共有を検証する。
 * @responsibility 既定値・空配列・未Commitの現在値を区別する。
 * @trace RDL-IT-001
 * @precondition 独立した二Rootを使用する。
 * @stimulus 親不在・File不在・現在値・変更後・別Rootを読む。
 * @observation source・Hash・深い凍結・Directory非作成を確認する。
 * @oracle 不在だけ既定値、別Rootへ追加Hostが漏れず既取得値も変わらない。
 * @cleanup fixtureのafterで両Rootを清掃する。
 * @boundary 公開Reader→実Filesystem。
 */
test("追加通信設定は現在Repositoryだけを読み不在と明示空を区別する", (t) => {
  const a = createNetworkPolicyFixture(t);
  const b = createNetworkPolicyFixture(t);
  const initial = readNetworkPolicy(a.capability);
  assert.equal(initial.status, "ready");
  if (initial.status !== "ready") assert.fail();
  const example = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../../template/.crdd/config/network-policy.example.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  assert.deepEqual(example, initial.policy);
  assert.deepEqual(initial, {
    status: "ready",
    source: "default",
    sourceFileHash: null,
    policy: {
      version: 1,
      allowedHosts: [
        "registry.npmjs.org",
        "pypi.org",
        "files.pythonhosted.org",
      ],
    },
  });
  assert.equal(fs.existsSync(path.join(a.root, ".crdd")), false);
  fs.mkdirSync(a.config, { recursive: true });
  assert.deepEqual(readNetworkPolicy(a.capability), initial);
  const text = '{"version":1,"allowedHosts":["a.example"]}';
  fs.writeFileSync(a.file, text);
  const first = readNetworkPolicy(a.capability);
  assert.equal(first.status, "ready");
  if (first.status !== "ready") assert.fail();
  assert.equal(first.source, "file");
  assert.equal(
    first.sourceFileHash,
    createHash("sha256").update(text).digest("hex"),
  );
  assert.ok(
    Object.isFrozen(first) &&
      Object.isFrozen(first.policy) &&
      Object.isFrozen(first.policy.allowedHosts),
  );
  fs.writeFileSync(a.file, '{"version":1,"allowedHosts":[]}');
  const empty = readNetworkPolicy(a.capability);
  assert.equal(empty.status, "ready");
  if (empty.status !== "ready") assert.fail();
  assert.deepEqual(empty.policy.allowedHosts, []);
  assert.deepEqual(first.policy.allowedHosts, ["a.example"]);
  assert.deepEqual(readNetworkPolicy(b.capability), initial);
  assert.equal(readNetworkPolicy({ ...a.capability }).status, "blocked");
});

/**
 * 不正内容を既定値へfallbackせず拒否する。
 * @responsibility 閉じたSchema・JSON文法・UTF-8・容量を確認する。
 * @trace RDL-IT-001
 * @precondition 実Fileの内容だけを順番に変更する。
 * @stimulus 重複・escape重複・版・要素・上限・文字コードを変える。
 * @observation invalidと正常な上限境界。
 * @oracle 不正からreadyを返さずPath・本文を公開しない。
 * @cleanup fixtureのafterで清掃する。
 * @boundary File本文と設定値。
 */
test("不正設定は重複key・型・UTF-8・容量を既定値へ畳まず拒否する", (t) => {
  const fixture = createNetworkPolicyFixture(t);
  fs.mkdirSync(fixture.config, { recursive: true });
  const invalid = [
    "",
    " ",
    "null",
    "[]",
    "{}",
    '{"version":2,"allowedHosts":[]}',
    '{"version":1,"allowedHosts":[],"extra":true}',
    '{"version":1,"version":1,"allowedHosts":[]}',
    '{"version":1,"\\u0076ersion":1,"allowedHosts":[]}',
    '{"version":1,"allowedHosts":[1]}',
    JSON.stringify({ version: 1, allowedHosts: new Array(33).fill("a") }),
    JSON.stringify({ version: 1, allowedHosts: ["a".repeat(254)] }),
    " ".repeat(16_385),
    Buffer.from([0xff, 0xfe]),
  ];
  for (const input of invalid) {
    fs.writeFileSync(fixture.file, input);
    assert.deepEqual(readNetworkPolicy(fixture.capability), {
      status: "blocked",
      reason: "network_policy_invalid",
    });
  }
  for (const hosts of [
    new Array(32).fill("a"),
    ["a".repeat(253)],
    ['a"b', "a\\b", "{}[]", ":"],
  ]) {
    fs.writeFileSync(
      fixture.file,
      JSON.stringify({ version: 1, allowedHosts: hosts }),
    );
    assert.equal(readNetworkPolicy(fixture.capability).status, "ready");
  }
  const valid = '{"version":1,"allowedHosts":[]}';
  fs.writeFileSync(
    fixture.file,
    valid + " ".repeat(16_384 - Buffer.byteLength(valid)),
  );
  assert.equal(readNetworkPolicy(fixture.capability).status, "ready");
});

/**
 * 読取り境界の観測不能と差替えを拒否する。
 * @responsibility File以外・hardlink・同容量別実体・親置換を扱う。
 * @trace RDL-IT-001
 * @precondition 自己生成Rootと局所metadata代役だけを使用する。
 * @stimulus nlink、File／親Identity、権限エラーを一軸ずつ変える。
 * @observation unavailable、値非公開と代役の復元。
 * @oracle 観測不能を不存在にしない。
 * @cleanup 各代役を復元しfixtureのafterで清掃する。
 * @boundary ReaderとOS metadata。
 */
test("観測不能・File以外・hardlink・前後Identity差は設定値を返さない", (t) => {
  const fixture = createNetworkPolicyFixture(t);
  fs.mkdirSync(fixture.config, { recursive: true });
  fs.mkdirSync(fixture.file);
  const unavailable = {
    status: "blocked",
    reason: "network_policy_unavailable",
  };
  assert.deepEqual(readNetworkPolicy(fixture.capability), unavailable);
  fs.rmdirSync(fixture.file);
  fs.writeFileSync(fixture.file, '{"version":1,"allowedHosts":[]}');
  const link = path.join(fixture.root, "linked.json");
  fs.linkSync(fixture.file, link);
  assert.deepEqual(readNetworkPolicy(fixture.capability), unavailable);
  fs.unlinkSync(link);
  for (const mode of [
    "denied",
    "file_identity",
    "parent_identity",
    "link",
  ] as const) {
    const original = fs.lstatSync;
    let fileReads = 0;
    let parentReads = 0;
    const mocked = t.mock.method(fs, "lstatSync", (...args: unknown[]) => {
      if (String(args[0]) === fixture.file && mode === "denied")
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      const stat = Reflect.apply(original, fs, args) as fs.BigIntStats;
      if (String(args[0]) === fixture.file && typeof stat.ino === "bigint") {
        fileReads += 1;
        if (mode === "file_identity" && fileReads > 1) stat.ino += 1n;
        if (mode === "link") stat.isSymbolicLink = () => true;
      }
      if (String(args[0]) === fixture.config && typeof stat.ino === "bigint") {
        parentReads += 1;
        if (mode === "parent_identity" && parentReads > 1) stat.ino += 1n;
      }
      return stat;
    });
    try {
      assert.deepEqual(
        readNetworkPolicy(fixture.capability),
        unavailable,
        mode,
      );
    } finally {
      mocked.mock.restore();
    }
  }
});

/**
 * 失敗時のFile descriptor終了と不在観測競合を確認する。
 * @responsibility read例外でもdescriptorを残さず、後着Fileを既定値へ畳まない。
 * @trace RDL-IT-001
 * @precondition 自己生成Fileの操作だけを局所的に差し替える。
 * @stimulus 開いた対象のread例外と、不在再確認前のFile出現。
 * @observation blocked、close回数と後着Fileの現存。
 * @oracle 取得したdescriptorを閉じ、出現競合はunavailable。
 * @cleanup 全代役を復元しfixtureのafterで清掃する。
 * @boundary 同期Readerの取得・読取り・終了。
 */
test("read故障でもdescriptorを閉じ、不在からの出現競合を拒否する", (t) => {
  const fixture = createNetworkPolicyFixture(t);
  fs.mkdirSync(fixture.config, { recursive: true });
  fs.writeFileSync(fixture.file, '{"version":1,"allowedHosts":[]}');
  const originalOpen = fs.openSync;
  const originalRead = fs.readSync;
  const originalClose = fs.closeSync;
  let descriptor: number | null = null;
  let closed = 0;
  const open = t.mock.method(fs, "openSync", (...args: unknown[]) => {
    const fd = Reflect.apply(originalOpen, fs, args) as number;
    if (String(args[0]) === fixture.file) descriptor = fd;
    return fd;
  });
  const read = t.mock.method(fs, "readSync", (...args: unknown[]) => {
    if (descriptor !== null && args[0] === descriptor)
      throw new Error("read_failed");
    return Reflect.apply(originalRead, fs, args);
  });
  const close = t.mock.method(fs, "closeSync", (fd: number) => {
    if (fd === descriptor) closed += 1;
    return originalClose(fd);
  });
  try {
    assert.deepEqual(readNetworkPolicy(fixture.capability), {
      status: "blocked",
      reason: "network_policy_unavailable",
    });
    assert.notEqual(descriptor, null);
    assert.equal(closed, 1);
  } finally {
    open.mock.restore();
    read.mock.restore();
    close.mock.restore();
  }
  fs.unlinkSync(fixture.file);
  const original = fs.lstatSync;
  let reads = 0;
  const observation = t.mock.method(fs, "lstatSync", (...args: unknown[]) => {
    if (String(args[0]) === fixture.file && ++reads === 2)
      fs.writeFileSync(fixture.file, '{"version":1,"allowedHosts":[]}');
    return Reflect.apply(original, fs, args);
  });
  try {
    assert.deepEqual(readNetworkPolicy(fixture.capability), {
      status: "blocked",
      reason: "network_policy_unavailable",
    });
  } finally {
    observation.mock.restore();
  }
});
