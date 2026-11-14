/**
 * DIの固定ArtifactとDirectoryの実体観測を検証する。
 * @packageDocumentation
 * @responsibility Seccomp実物の照合とDirectory置換・Link・不存在を区別する。
 * @trace ERB-IT-004
 * @level IT
 * @boundary Artifact読取りと当該試験が作るRepository内Directoryだけ。実Docker・AI・過去保持物は操作しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { observeDockerDirectoryIdentity } from "../../src/docker-cli/config.ts";

/**
 * 移管した固定Seccomp Resolverの実物と全拒否条件を確認する。
 * @responsibility 同じArtifactの読取り順と差替え拒否を保持する。
 * @trace ERB-IT-004
 * @precondition 正常は固定実物、異常は同じ実関数本文とFilesystem代役を使う。
 * @stimulus file/link・容量・realpath・Hash・読取り例外・前後Identity差を一軸ずつ与える。
 * @observation 戻りPath/nullと読取り回数。
 * @oracle 全条件が一致する実物だけを返し、失敗はnullで書込み／Docker0。
 * @cleanup N/A: 固定実物は読取りだけ、VMはメモリだけ。
 * @boundary DI固定Artifactと呼出し元の期待Identity。
 */
test("Seccomp Resolverは同じ固定実物を読みlinkと前後差を拒否する", () => {
  const artifact = fileURLToPath(
    new URL("../../src/execution/codex-executor-seccomp.json", import.meta.url),
  );
  const bytes = fs.readFileSync(artifact);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const source = fs.readFileSync(
    new URL("../../src/execution/plan.ts", import.meta.url),
    "utf8",
  );
  const declaration = "function resolveFixedCodexExecutorSeccompProfile(";
  assert.equal(source.split(declaration).length, 2);
  const begin = source.indexOf(declaration);
  const end = source.indexOf("\n}\n", begin) + 3;
  assert.ok(end > begin);
  const body = stripTypeScriptTypes(
    source.slice(begin, end).replace("export function", "function"),
  );
  for (const mode of [
    "normal",
    "file",
    "link",
    "bytes",
    "realpath",
    "read",
    "dev",
    "ino",
    "size",
    "mtimeNs",
    "hash",
  ]) {
    let stats = 0,
      reads = 0;
    const resolve = runInNewContext(
      `${body}\nresolveFixedCodexExecutorSeccompProfile`,
      {
        executorSeccompProfilePath: artifact,
        createHash,
        BigInt,
        fs: {
          lstatSync: (location: string) => {
            assert.equal(location, artifact);
            stats++;
            const metadata: Record<string, unknown> = {
              isFile: () => mode !== "file",
              isSymbolicLink: () => mode === "link",
              dev: 1n,
              ino: 2n,
              size: BigInt(bytes.length),
              mtimeNs: 3n,
            };
            if (mode === "bytes") metadata.size = 0n;
            if (stats === 2 && ["dev", "ino", "size", "mtimeNs"].includes(mode))
              metadata[mode] = 999999n;
            return metadata;
          },
          realpathSync: {
            native: () =>
              mode === "realpath" ? "different-artifact" : artifact,
          },
          readFileSync: () => {
            reads++;
            if (mode === "read") throw new Error("private-read-failure");
            return mode === "hash" ? Buffer.from("wrong") : bytes;
          },
        },
      },
    ) as (hash: string, size: number) => string | null;
    assert.equal(
      resolve(hash, bytes.length),
      mode === "normal" ? artifact : null,
      mode,
    );
    if (["file", "link", "bytes", "realpath"].includes(mode))
      assert.equal(reads, 0, mode);
    if (mode === "normal") {
      assert.equal(stats, 2);
      assert.equal(reads, 1);
    }
  }
});

/** 元実体の同Path差替えとjunctionを、Repository内の自己生成Directoryで反証する。 */
test("Directory実体観測は同Path差替え・不存在・junctionを区別する", (t) => {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  assert.ok(fs.existsSync(path.join(repository, ".git")));
  const tests = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(tests, { recursive: true });
  const root = fs.mkdtempSync(path.join(tests, "di-fixed-paths-"));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(tests));
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  const directory = path.join(root, "source");
  fs.mkdirSync(directory);
  const original = observeDockerDirectoryIdentity(directory);
  fs.renameSync(directory, path.join(root, "previous"));
  assert.throws(() => observeDockerDirectoryIdentity(directory));
  fs.mkdirSync(directory);
  assert.notEqual(observeDockerDirectoryIdentity(directory), original);
  const link = path.join(root, "link");
  fs.symlinkSync(
    directory,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.throws(() => observeDockerDirectoryIdentity(link));
});
