/**
 * coordinator:integration:git-object-reader-contractの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:git-object-reader-contractが所有する検証責務を実行する。
 * @trace RFD-IT-012
 * @level IT
 * @scope git、object、reader
 * @boundary RFD-IT-012=Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { crc32, deflateSync } from "node:zlib";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";

import {
  readCommitFile,
  getRepository,
} from "../../../version-control/src/index.ts";

/**
 * 固定Snapshotの旧容量上限撤去と構造検査の維持を検証する。
 * @responsibility 旧64KiB・64MiBを超える正常Blobと不正入力を対照化する。
 * @trace RFD-IT-012
 * @precondition Repository-localの所有fixtureだけを使用する。
 * @stimulus 旧上限の前後の固定Blobを容量指定なしで要求する。
 * @observation byte数・Hash・mode、返却拒否、getter不実行を観測する。
 * @oracle 正常Blobは全量を返し、廃止field・不正入力はnull。
 * @cleanup exact所有Rootを確認して回収する。
 * @boundary RFD-IT-012=Direct Boundary: Fixed Snapshot Port→Git object Reader
 */
test("固定Snapshotは旧64KiB・64MiBを超えるBlobを容量指定なしで読み取る", (t) => {
  const repository = path.resolve(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  const testsRoot = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(testsRoot, { recursive: true });
  assert.equal(fs.realpathSync.native(testsRoot), testsRoot);
  const root = fs.mkdtempSync(path.join(testsRoot, "git-read-object-"));
  const commonDirectory = path.join(root, ".git");
  fs.mkdirSync(path.join(commonDirectory, "objects"), { recursive: true });
  fs.mkdirSync(path.join(commonDirectory, "refs", "heads"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(commonDirectory, "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(
    path.join(commonDirectory, "HEAD"),
    "ref: refs/heads/fixture\n",
  );
  t.after(() => {
    assert.equal(path.dirname(root), testsRoot);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  const sizes = [65_536, 65_537, 64 * 1024 * 1024 + 1];
  const entries = sizes.map((size) => {
    const oid = writeObject(commonDirectory, "blob", Buffer.alloc(size, 0x61));
    return treeEntry("100644", `input-${size}.bin`, oid);
  });
  const tree = writeObject(commonDirectory, "tree", Buffer.concat(entries));
  const revision = writeObject(
    commonDirectory,
    "commit",
    Buffer.from(
      `tree ${tree}\nauthor T <t@example.invalid> 0 +0000\ncommitter T <t@example.invalid> 0 +0000\n\nfixture\n`,
    ),
  );
  fs.writeFileSync(
    path.join(commonDirectory, "refs", "heads", "fixture"),
    `${revision}\n`,
  );
  const base = { commonDirectory, revision, relativePath: "input-65537.bin" };
  for (const size of sizes) {
    const read = readGitCommitFile({
      ...base,
      relativePath: `input-${size}.bin`,
    });
    assert.equal(read?.bytes.length, size);
    assert.equal(read?.mode, "100644");
    assert.equal(read?.revision, revision);
    assert.equal(
      read?.sha256,
      createHash("sha256").update(Buffer.alloc(size, 0x61)).digest("hex"),
    );
  }
  assert.equal(readGitCommitFile({ ...base, maximumBytes: 65_537 }), null);
  assert.equal(readGitCommitFile({ ...base, extra: true }), null);
  for (const key of [
    "commonDirectory",
    "revision",
    "relativePath",
    "maximumBytes",
  ] as const) {
    let getterCalls = 0;
    const accessor = Object.defineProperty({ ...base }, key, {
      get() {
        getterCalls += 1;
        return key === "maximumBytes" ? 65_537 : base[key];
      },
    });
    assert.equal(readGitCommitFile(accessor) === null, true, key);
    assert.equal(getterCalls, 0, key);
  }
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  assert.equal(
    readCommitFile(verified.capability, {
      commit: revision,
      path: base.relativePath,
    })?.bytes.length,
    65_537,
  );
  assert.equal(
    readCommitFile(
      verified.capability,
      Object.assign(
        {
          commit: revision,
          path: base.relativePath,
        },
        { maximumBytes: Infinity },
      ),
    ),
    null,
  );
});

import {
  describeGitObjectReaderContract,
  inspectGitCommitTree,
  copyGitCommitTree as materializeVersionControlTree,
  readGitCommitFile,
} from "../../../version-control/src/git/objects.ts";
import { containsRecognizedSecretMaterial } from "../../../domain-model/src/index.ts";

/**
 * copyGitCommitTreeのTest準備責務を実行する。
 *
 * @responsibility copyGitCommitTreeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus copyGitCommitTreeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function copyGitCommitTree(candidate: unknown) {
  return materializeVersionControlTree(
    candidate,
    containsRecognizedSecretMaterial,
  );
}

/**
 * temporaryFixtureのTest準備責務を実行する。
 *
 * @responsibility temporaryFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus temporaryFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function temporaryFixture(t: test.TestContext) {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "git-reader-"));
  const commonDirectory = path.join(root, ".git");
  const workspace = path.join(root, "workspace");
  fs.mkdirSync(path.join(commonDirectory, "objects", "pack"), {
    recursive: true,
  });
  fs.mkdirSync(workspace);
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  return Object.freeze({ commonDirectory, workspace });
}

/**
 * writeObjectのTest準備責務を実行する。
 *
 * @responsibility writeObjectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus writeObjectを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function writeObject(commonDirectory: string, type: string, bytes: Buffer) {
  const framed = Buffer.concat([
    Buffer.from(`${type} ${bytes.byteLength}\0`),
    bytes,
  ]);
  const objectId = createHash("sha1").update(framed).digest("hex");
  const target = path.join(
    commonDirectory,
    "objects",
    objectId.slice(0, 2),
    objectId.slice(2),
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, deflateSync(framed));
  return objectId;
}

/**
 * treeEntryのTest準備責務を実行する。
 *
 * @responsibility treeEntryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-012
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus treeEntryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
function treeEntry(mode: string, name: string, objectId: string) {
  return Buffer.concat([
    Buffer.from(`${mode} ${name}\0`),
    Buffer.from(objectId, "hex"),
  ]);
}

/**
 * 深いTreeと共有subtreeを旧深度quotaなしで読み取る。
 * @trace RFD-IT-012
 * @precondition Repository-localの自己生成Objectだけを使う。
 * @stimulus 70段Treeと別Pathから共有したsubtreeを読む。
 * @observation 完全Path・bytesと改ざんObjectの拒否を確認する。
 * @oracle 深い正常構造と共有subtreeは受理し、Hash不一致は拒否する。
 * @cleanup temporaryFixtureがexact所有Rootだけを回収する。
 * @boundary 固定GitObject→選択File読取り。
 */
test("Treeは70段と共有subtreeを受理し不正Hashを拒否する", (t) => {
  const f = temporaryFixture(t);
  const blob = writeObject(f.commonDirectory, "blob", Buffer.from("deep\n"));
  const shared = writeObject(
    f.commonDirectory,
    "tree",
    treeEntry("100644", "f.txt", blob),
  );
  let tree = shared;
  for (let index = 0; index < 70; index += 1)
    tree = writeObject(
      f.commonDirectory,
      "tree",
      treeEntry("40000", "d", tree),
    );
  const root = writeObject(
    f.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("40000", "deep", tree),
      treeEntry("40000", "left", shared),
      treeEntry("40000", "right", shared),
    ]),
  );
  const revision = writeObject(
    f.commonDirectory,
    "commit",
    Buffer.from(`tree ${root}\n\nfixture\n`),
  );
  for (const relativePath of [
    `deep/${"d/".repeat(70)}f.txt`,
    "left/f.txt",
    "right/f.txt",
  ])
    assert.equal(
      readGitCommitFile({
        commonDirectory: f.commonDirectory,
        revision,
        relativePath,
      })?.bytes.toString(),
      "deep\n",
    );
  const copied = copyGitCommitTree({
    commonDirectory: f.commonDirectory,
    revision,
    workspace: f.workspace,
  });
  assert.equal(copied?.status, "materialized");
  assert.equal(copied?.fileCount, 3);
  const blobPath = path.join(
    f.commonDirectory,
    "objects",
    blob.slice(0, 2),
    blob.slice(2),
  );
  fs.writeFileSync(blobPath, deflateSync(Buffer.from("blob 5\0wrong")));
  assert.equal(
    readGitCommitFile({
      commonDirectory: f.commonDirectory,
      revision,
      relativePath: "right/f.txt",
    }),
    null,
  );
});

/**
 * Tree祖先循環の直接拒否を、Hash照合の前提とは分離して反証する。
 * @trace RFD-IT-012
 * @precondition 実Sourceの私有parseTreeだけを既存構文解析補助で取り出す。
 * @stimulus 自己参照Tree、OFSの正距離・ゼロ距離・参照境界越えを入力する。
 * @observation 構造エラー理由、祖先集合解放、正常OFSのoffsetを確認する。
 * @oracle 循環を深度quotaやStack overflowで代用せず、不正offsetを直接拒否する。
 * @cleanup VMと代役Objectは同じProcess内だけで保持する。
 * @boundary 私有Tree走査の局所境界。正Hashの実Object成立を示す試験ではない。
 */
test("Tree祖先循環とOFS不正距離を直接拒否し正常構造を維持する", () => {
  const source = fs.readFileSync(
    new URL("../../../version-control/src/git/objects.ts", import.meta.url),
    "utf8",
  );
  const parse = runInNewContext(
    `${sourceDeclaration(source, "parseTree")};parseTree`,
    {
      Buffer,
      decodeTreeName: (bytes: Buffer) => bytes.toString("utf8"),
    },
  ) as (
    read: (id: string) => { type: string; bytes: Buffer },
    tree: string,
    parent: string,
    entries: unknown[],
    summary: { bytes: number; files: number },
    paths: null,
    ancestors: Set<string>,
  ) => void;
  const tree = "a".repeat(40);
  const ancestors = new Set<string>();
  assert.throws(
    () =>
      parse(
        () => ({ type: "tree", bytes: treeEntry("40000", "self", tree) }),
        tree,
        "",
        [],
        { bytes: 0, files: 0 },
        null,
        ancestors,
      ),
    /git_tree_cycle_detected/u,
  );
  assert.equal(ancestors.size, 0);
  parse(
    () => ({ type: "tree", bytes: Buffer.alloc(0) }),
    tree,
    "",
    [],
    { bytes: 0, files: 0 },
    null,
    ancestors,
  );
  assert.equal(ancestors.size, 0);
  const decode = runInNewContext(
    `${sourceDeclaration(source, "decodePackOffset")};decodePackOffset`,
    { Buffer },
  ) as (
    bytes: Buffer,
    start: number,
    offset: number,
    end: number,
  ) => {
    baseOffset: number;
    nextIndex: number;
  };
  const decoded = decode(Buffer.from([3]), 0, 20, 1);
  assert.equal(decoded.baseOffset, 17);
  assert.equal(decoded.nextIndex, 1);
  assert.throws(
    () => decode(Buffer.from([0]), 0, 20, 1),
    /git_pack_offset_invalid/u,
  );
  assert.throws(
    () => decode(Buffer.from([0x80, 0]), 0, 200, 1),
    /git_pack_offset_invalid/u,
  );
});

/**
 * 小さいPackだけで旧64段を越えるDeltaと形式不正を対照化する。
 * @trace RFD-IT-012
 * @precondition Repository-localに有効checksum付きの自己生成Packを置く。
 * @stimulus 70段のOFS／REF Deltaを読み、最後の参照だけを不正にする。
 * @observation 完全bytes・Hashと不正参照の拒否を確認する。
 * @oracle 正常chainは受理しOFS自己参照／REF循環は拒否する。
 * @cleanup temporaryFixtureがexact所有Rootだけを回収する。
 * @boundary Pack／Index→Git Object Reader。
 */
for (const kind of ["ofs", "ref"] as const) {
  test(`Packの70段${kind} Deltaは復元し自己参照は拒否する`, (t) => {
    const f = temporaryFixture(t);
    const header = Buffer.alloc(12);
    header.write("PACK");
    header.writeUInt32BE(2, 4);
    header.writeUInt32BE(71, 8);
    const chunks: Buffer[] = [];
    const entries: { id: Buffer; offset: number; bytes: Buffer }[] = [];
    let offset = 12;
    for (let index = 0; index <= 70; index += 1) {
      const body = Buffer.from(`value-${String(index).padStart(3, "0")}\n`);
      const id = createHash("sha1")
        .update(Buffer.from(`blob ${body.length}\0`))
        .update(body)
        .digest();
      const delta = Buffer.concat([
        Buffer.from([body.length, body.length, body.length]),
        body,
      ]);
      const payload = index === 0 ? body : delta;
      const code = index === 0 ? 3 : kind === "ofs" ? 6 : 7;
      const sizeHeader =
        payload.length < 16
          ? Buffer.from([(code << 4) | payload.length])
          : Buffer.from([
              (code << 4) | 0x80 | (payload.length & 15),
              payload.length >> 4,
            ]);
      const previous = entries[index - 1];
      const reference = !previous
        ? Buffer.alloc(0)
        : kind === "ref"
          ? previous.id
          : Buffer.from([offset - previous.offset]);
      assert.ok(!previous || kind === "ref" || offset - previous.offset < 128);
      const bytes = Buffer.concat([
        sizeHeader,
        reference,
        deflateSync(payload),
      ]);
      entries.push({ id, offset, bytes });
      chunks.push(bytes);
      offset += bytes.length;
    }
    const target = entries[70];
    assert.ok(target);
    const tree = writeObject(
      f.commonDirectory,
      "tree",
      treeEntry("100644", "deep.txt", target.id.toString("hex")),
    );
    const revision = writeObject(
      f.commonDirectory,
      "commit",
      Buffer.from(`tree ${tree}\n\nfixture\n`),
    );
    // IndexとPackを同じchecksumへ結び付け、破損時にも外枠checksumは正しく保つ。
    const publish = () => {
      const content = Buffer.concat([header, ...chunks]);
      const checksum = createHash("sha1").update(content).digest();
      const pack = Buffer.concat([content, checksum]);
      const sorted = [...entries].sort((a, b) => Buffer.compare(a.id, b.id));
      const prefix = Buffer.alloc(8 + 256 * 4);
      prefix.writeUInt32BE(0xff744f63, 0);
      prefix.writeUInt32BE(2, 4);
      for (let byte = 0; byte < 256; byte += 1)
        prefix.writeUInt32BE(
          sorted.filter((entry) => (entry.id[0] ?? 0) <= byte).length,
          8 + byte * 4,
        );
      const crcs = Buffer.alloc(entries.length * 4);
      const offsets = Buffer.alloc(entries.length * 4);
      sorted.forEach((entry, index) => {
        crcs.writeUInt32BE(crc32(entry.bytes), index * 4);
        offsets.writeUInt32BE(entry.offset, index * 4);
      });
      const index = Buffer.concat([
        prefix,
        ...sorted.map((entry) => entry.id),
        crcs,
        offsets,
        checksum,
      ]);
      const name = `pack-${checksum.toString("hex")}`;
      const directory = path.join(f.commonDirectory, "objects", "pack");
      for (const old of fs.readdirSync(directory))
        fs.unlinkSync(path.join(directory, old));
      fs.writeFileSync(path.join(directory, `${name}.pack`), pack);
      fs.writeFileSync(
        path.join(directory, `${name}.idx`),
        Buffer.concat([index, createHash("sha1").update(index).digest()]),
      );
    };
    publish();
    const input = {
      commonDirectory: f.commonDirectory,
      revision,
      relativePath: "deep.txt",
    };
    assert.equal(readGitCommitFile(input)?.bytes.toString(), "value-070\n");
    const referenceOffset = (target.bytes[0] ?? 0) & 0x80 ? 2 : 1;
    if (kind === "ofs") target.bytes[referenceOffset] = 0;
    else target.id.copy(target.bytes, referenceOffset);
    publish();
    assert.equal(readGitCommitFile(input), null);
  });
}

/**
 * Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否するを検証する。
 *
 * @responsibility Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Commit treeはheader先頭だけを採用し本文、欠落、重複と非Tree参照を拒否する", (t) => {
  const fixture = temporaryFixture(t);
  const treeId = writeObject(fixture.commonDirectory, "tree", Buffer.alloc(0));
  const otherTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry(
      "100644",
      "fixture.txt",
      writeObject(fixture.commonDirectory, "blob", Buffer.from("fixture\n")),
    ),
  );
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("not a tree\n"),
  );
  /**
   * inspectのTest準備責務を実行する。
   *
   * @responsibility inspectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RFD-IT-012
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus inspectを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
   */
  const inspect = (commitBytes: string) =>
    inspectGitCommitTree({
      commonDirectory: fixture.commonDirectory,
      revision: writeObject(
        fixture.commonDirectory,
        "commit",
        Buffer.from(commitBytes),
      ),
    });

  assert.equal(
    inspect(
      `author A <a@example.test> 0 +0000\ncommitter A <a@example.test> 0 +0000\n\nmessage\ntree ${treeId}\n`,
    ),
    null,
  );
  assert.equal(
    inspect(`tree ${treeId}\nauthor A <a@example.test> 0 +0000`),
    null,
  );
  assert.equal(
    inspect(`tree ${treeId}\ntree ${otherTreeId}\n\nmessage\n`),
    null,
  );
  assert.equal(inspect(`tree ${blobId}\n\nmessage\n`), null);

  const valid = inspect(
    `tree ${treeId}\nauthor A <a@example.test> 0 +0000\ncommitter A <a@example.test> 0 +0000\n\nmessage\ntree ${otherTreeId}\n`,
  );
  assert.equal(valid?.status, "candidate");
  assert.equal(valid?.tree, treeId);
});

/**
 * loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成するを検証する。
 *
 * @responsibility loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("loose Commit／Tree／BlobをGit CLIなしで隔離workspaceへ再構成する", (t) => {
  const fixture = temporaryFixture(t);
  const readmeId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("hello\n"),
  );
  const sourceId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("export const value = 1;\n"),
  );
  const sourceTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("100644", "index.ts", sourceId),
  );
  const rootTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "README.md", readmeId),
      treeEntry("40000", "src", sourceTreeId),
    ]),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(
      `tree ${rootTreeId}\nauthor A <a@example.test> 0 +0000\ncommitter A <a@example.test> 0 +0000\n\nfixture\n`,
    ),
  );

  const result = copyGitCommitTree({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
  });
  assert.equal(result?.status, "materialized");
  assert.equal(result?.baseCommit, commitId);
  assert.equal(result?.baseTree, rootTreeId);
  assert.equal(result?.fileCount, 2);
  assert.equal(result?.byteLength, 30);
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "README.md"), "utf8"),
    "hello\n",
  );
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "src", "index.ts"), "utf8"),
    "export const value = 1;\n",
  );
  assert.equal(result?.repositoryPathReported, false);
  assert.equal(result?.workspacePathReported, false);
  const fixedFile = readGitCommitFile({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    relativePath: "README.md",
  });
  assert.equal(fixedFile?.status, "read");
  assert.equal(fixedFile?.bytes.toString("utf8"), "hello\n");
  assert.equal(
    readGitCommitFile({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      relativePath: "missing.md",
    }),
    null,
  );
});

/**
 * 明示Read Projectionだけを隔離workspaceへ再構成するを検証する。
 *
 * @responsibility 明示Read Projectionだけを隔離workspaceへ再構成するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示Read Projectionだけを隔離workspaceへ再構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("明示Read Projectionだけを隔離workspaceへ再構成する", (t) => {
  const fixture = temporaryFixture(t);
  const visibleId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("visible\n"),
  );
  const hiddenId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("hidden\n"),
  );
  const sourceTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "visible.ts", visibleId),
      treeEntry("100644", "hidden.ts", hiddenId),
    ]),
  );
  const rootTreeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("40000", "src", sourceTreeId),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(`tree ${rootTreeId}\n\nfixture\n`),
  );

  const result = copyGitCommitTree({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
    readPaths: ["src/visible.ts"],
  });
  assert.equal(result?.status, "materialized");
  assert.equal(result?.fileCount, 1);
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "src", "visible.ts"), "utf8"),
    "visible\n",
  );
  assert.equal(
    fs.existsSync(path.join(fixture.workspace, "src", "hidden.ts")),
    false,
  );

  const exactDirectoryWorkspace = path.join(
    path.dirname(fixture.workspace),
    "exact-directory",
  );
  fs.mkdirSync(exactDirectoryWorkspace);
  const exactDirectory = copyGitCommitTree({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: exactDirectoryWorkspace,
    readPaths: ["src"],
  });
  assert.equal(exactDirectory?.status, "materialized");
  assert.equal(exactDirectory?.fileCount, 0);
  assert.deepEqual(fs.readdirSync(exactDirectoryWorkspace), []);
});

/**
 * 未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否するを検証する。
 *
 * @responsibility 未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("未選択の未対応modeだけを除外し、exact・祖先選択と全体展開は拒否する", (t) => {
  for (const mode of ["120000", "160000", "100664"] as const) {
    const fixture = temporaryFixture(t);
    const policyBytes = Buffer.from('{"policyId":"fixture"}\n');
    const policyId = writeObject(fixture.commonDirectory, "blob", policyBytes);
    const configTreeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("100644", "external-send-policy.json", policyId),
    );
    const policyTreeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("40000", "config", configTreeId),
    );
    const unsupportedObjectId =
      mode === "160000"
        ? writeObject(
            fixture.commonDirectory,
            "commit",
            Buffer.from(
              "tree 0000000000000000000000000000000000000000\n\nsubmodule\n",
            ),
          )
        : writeObject(
            fixture.commonDirectory,
            "blob",
            Buffer.from("unsupported\n"),
          );
    const rootTreeId = writeObject(
      fixture.commonDirectory,
      "tree",
      Buffer.concat([
        treeEntry("40000", ".crdd", policyTreeId),
        treeEntry(mode, "unsupported", unsupportedObjectId),
      ]),
    );
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${rootTreeId}\n\nfixture\n`),
    );

    const fixedFile = readGitCommitFile({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      relativePath: ".crdd/config/external-send-policy.json",
    });
    assert.equal(fixedFile?.status, "read");
    assert.deepEqual(fixedFile?.bytes, policyBytes);

    for (const relativePath of ["unsupported", "unsupported/child.txt"]) {
      assert.equal(
        readGitCommitFile({
          commonDirectory: fixture.commonDirectory,
          revision: commitId,
          relativePath,
        }),
        null,
      );
      const selectedWorkspace = path.join(
        path.dirname(fixture.workspace),
        `${mode}-${relativePath.includes("/") ? "descendant" : "exact"}`,
      );
      fs.mkdirSync(selectedWorkspace);
      assert.equal(
        copyGitCommitTree({
          commonDirectory: fixture.commonDirectory,
          revision: commitId,
          workspace: selectedWorkspace,
          readPaths: [relativePath],
        }),
        null,
      );
      assert.deepEqual(fs.readdirSync(selectedWorkspace), []);
    }

    const fullWorkspace = path.join(
      path.dirname(fixture.workspace),
      `${mode}-full`,
    );
    fs.mkdirSync(fullWorkspace);
    assert.equal(
      copyGitCommitTree({
        commonDirectory: fixture.commonDirectory,
        revision: commitId,
        workspace: fullWorkspace,
      }),
      null,
    );
  }
});

/**
 * 認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否するを検証する。
 *
 * @responsibility 認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("認識済みSecretを含むPathまたは内容はworkspaceへ書く前に拒否する", (t) => {
  for (const scenario of ["path", "content"] as const) {
    const fixture = temporaryFixture(t);
    const blobId = writeObject(
      fixture.commonDirectory,
      "blob",
      Buffer.from(
        scenario === "content"
          ? `OPENAI_API_KEY=sk-${"A".repeat(24)}\n`
          : "ordinary value\n",
      ),
    );
    const fileName = scenario === "path" ? ".env" : "source.ts";
    const treeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("100644", fileName, blobId),
    );
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${treeId}\n\nfixture\n`),
    );
    const materialized = copyGitCommitTree({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      workspace: fixture.workspace,
      readPaths: [fileName],
    });
    assert.equal(materialized?.status, "blocked");
    assert.equal(
      materialized?.status === "blocked" ? materialized.reason : null,
      "git_read_projection_recognized_secret_rejected",
    );
    assert.deepEqual(fs.readdirSync(fixture.workspace), []);
    const localRead = readGitCommitFile({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      relativePath: fileName,
    });
    assert.equal(localRead?.status, "read");
  }
});

/**
 * Secret名を使う通常のSource参照はRead Projectionを誤停止しないを検証する。
 *
 * @responsibility Secret名を使う通常のSource参照はRead Projectionを誤停止しないの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Secret名を使う通常のSource参照はRead Projectionを誤停止しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Secret名を使う通常のSource参照はRead Projectionを誤停止しない", (t) => {
  const fixture = temporaryFixture(t);
  const source = [
    "const password = options.password;",
    'const apiKey = process.env["API_KEY"];',
    'const sessionToken = os.environ["SESSION_TOKEN"];',
    "this.password = request.password;",
    "password=resolvedDatabasePassword;",
    "apiKey=applicationConfigurationKey;",
    "password = options!.password;",
    'password = options!.config?.["password"]!;',
    "const accessToken = oauth2Token;",
    "accessToken=resolvedOAuth2Token;",
    "password=resolvedPassword2;",
  ].join("\n");
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from(`${source}\n`),
  );
  const commonJsSource =
    "const accessToken = oauth2Token;\naccessToken=resolvedOAuth2Token;\n";
  const commonJsBlobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from(commonJsSource),
  );
  const treeId = writeObject(
    fixture.commonDirectory,
    "tree",
    Buffer.concat([
      treeEntry("100644", "oauth.cjs", commonJsBlobId),
      treeEntry("100644", "source.ts", blobId),
    ]),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(`tree ${treeId}\n\nfixture\n`),
  );
  const materialized = copyGitCommitTree({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
    readPaths: ["oauth.cjs", "source.ts"],
  });
  assert.equal(materialized?.status, "materialized");
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "source.ts"), "utf8"),
    `${source}\n`,
  );
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, "oauth.cjs"), "utf8"),
    commonJsSource,
  );
});

/**
 * 公開env例のplaceholderはRead Projectionを誤停止しないを検証する。
 *
 * @responsibility 公開env例のplaceholderはRead Projectionを誤停止しないの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開env例のplaceholderはRead Projectionを誤停止しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開env例のplaceholderはRead Projectionを誤停止しない", (t) => {
  const fixture = temporaryFixture(t);
  const source = `SESSION_TOKEN=placeholder_long_value\nSESSION_TOKEN=${"x".repeat(20)}\n`;
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from(source),
  );
  const treeId = writeObject(
    fixture.commonDirectory,
    "tree",
    treeEntry("100644", ".env.example", blobId),
  );
  const commitId = writeObject(
    fixture.commonDirectory,
    "commit",
    Buffer.from(`tree ${treeId}\n\nfixture\n`),
  );
  const materialized = copyGitCommitTree({
    commonDirectory: fixture.commonDirectory,
    revision: commitId,
    workspace: fixture.workspace,
    readPaths: [".env.example"],
  });
  assert.equal(materialized?.status, "materialized");
  assert.equal(
    fs.readFileSync(path.join(fixture.workspace, ".env.example"), "utf8"),
    source,
  );
});

/**
 * Source内CommentとStringの認識済みSecretはRead Projection前に拒否するを検証する。
 *
 * @responsibility Source内CommentとStringの認識済みSecretはRead Projection前に拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Source内CommentとStringの認識済みSecretはRead Projection前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("Source内CommentとStringの認識済みSecretはRead Projection前に拒否する", (t) => {
  for (const source of [
    "// password=Password123!\n",
    "//password=Password123!\n",
    "/* password=Password123! */\n",
    "/*password=Password123!*/\n",
    "/**password=Password123!*/\n",
    "/*!password=Password123!*/\n",
    "/*password=Password123!",
    "/**\n * docs\n *password=Password123!\n */\n",
    "/*docs\n*password=Password123!\n*/\n",
    "/*docs\r\n!password=Password123!\r\n*/\n",
    'const note = " password=Password123!";\n',
    'const note = "password=Password123!";\n',
    "const note = ` password=Password123!`;\n",
    "const re = /password=Password123!/;\n",
  ]) {
    const fixture = temporaryFixture(t);
    const blobId = writeObject(
      fixture.commonDirectory,
      "blob",
      Buffer.from(source),
    );
    const treeId = writeObject(
      fixture.commonDirectory,
      "tree",
      treeEntry("100644", "auth.ts", blobId),
    );
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${treeId}\n\nfixture\n`),
    );
    const materialized = copyGitCommitTree({
      commonDirectory: fixture.commonDirectory,
      revision: commitId,
      workspace: fixture.workspace,
      readPaths: ["auth.ts"],
    });
    assert.equal(materialized?.status, "blocked");
    assert.deepEqual(fs.readdirSync(fixture.workspace), []);
  }
});

/**
 * symlink、submodule、Windows case衝突と非empty workspaceを拒否するを検証する。
 *
 * @responsibility symlink、submodule、Windows case衝突と非empty workspaceを拒否するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus symlink、submodule、Windows case衝突と非empty workspaceを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("symlink、submodule、Windows case衝突と非empty workspaceを拒否する", (t) => {
  for (const scenario of [
    "symlink",
    "submodule",
    "case",
    "nonempty",
  ] as const) {
    const fixture = temporaryFixture(t);
    const blobId = writeObject(
      fixture.commonDirectory,
      "blob",
      Buffer.from("value"),
    );
    const treeBytes =
      scenario === "case"
        ? Buffer.concat([
            treeEntry("100644", "File.txt", blobId),
            treeEntry("100644", "file.txt", blobId),
          ])
        : treeEntry(
            scenario === "symlink"
              ? "120000"
              : scenario === "submodule"
                ? "160000"
                : "100644",
            "file.txt",
            blobId,
          );
    const treeId = writeObject(fixture.commonDirectory, "tree", treeBytes);
    const commitId = writeObject(
      fixture.commonDirectory,
      "commit",
      Buffer.from(`tree ${treeId}\n\nfixture\n`),
    );
    if (scenario === "nonempty") {
      fs.writeFileSync(path.join(fixture.workspace, "existing.txt"), "keep");
    }
    assert.equal(
      copyGitCommitTree({
        commonDirectory: fixture.commonDirectory,
        revision: commitId,
        workspace: fixture.workspace,
      }),
      null,
    );
  }
});

/**
 * object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにするを検証する。
 *
 * @responsibility object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにするの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("object改変、余分field、SHA-256 Repository IDと動的入力をfail closedにする", (t) => {
  const fixture = temporaryFixture(t);
  const blobId = writeObject(
    fixture.commonDirectory,
    "blob",
    Buffer.from("value"),
  );
  const blobPath = path.join(
    fixture.commonDirectory,
    "objects",
    blobId.slice(0, 2),
    blobId.slice(2),
  );
  fs.appendFileSync(blobPath, "x");
  for (const candidate of [
    {
      commonDirectory: fixture.commonDirectory,
      revision: "a".repeat(64),
      workspace: fixture.workspace,
    },
    {
      commonDirectory: fixture.commonDirectory,
      revision: "a".repeat(40),
      workspace: fixture.workspace,
      extra: true,
    },
    new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("must not execute");
        },
      },
    ),
  ]) {
    assert.equal(copyGitCommitTree(candidate), null);
  }
});

/**
 * 公開契約は限定Git object readerと非Authority境界を固定するを検証する。
 *
 * @responsibility 公開契約は限定Git object readerと非Authority境界を固定するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は限定Git object readerと非Authority境界を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-012=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開契約は限定Git object readerと非Authority境界を固定する", () => {
  const contract = describeGitObjectReaderContract();
  assert.equal(contract.contractRevision, 5);
  assert.equal("maximumWorkspaceFiles" in contract, false);
  assert.equal("maximumWorkspaceBytes" in contract, false);
  assert.equal(contract.fixedRevisionFileRead, "single_explicit_non_git_path");
  assert.equal(contract.objectFormat, "sha1_only");
  assert.equal(contract.externalGitCliUsed, false);
  assert.deepEqual(contract.rejectedTreeModes, ["120000", "160000", "unknown"]);
  assert.equal(
    contract.unsupportedModeProjection,
    "unselected_skipped_selected_or_full_rejected",
  );
  assert.equal(contract.windowsNameCollision, "fail_closed");
  assert.match(contract.recognizedSecretMaterial, /rejected/u);
  assert.equal(contract.completeSecretAbsenceVerified, false);
  assert.equal(contract.authorityEstablished, false);
});
