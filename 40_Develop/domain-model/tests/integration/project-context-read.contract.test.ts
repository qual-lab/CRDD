/**
 * 固定Project Contextの実Root読取りを検証する。
 * @packageDocumentation
 * @responsibility 本文観測・解析・Identity照合と失敗非開示を接続する。
 * @trace PPR-IT-019
 * @trace PPR-IT-002
 * @level IT
 * @scope domain-model、project-context、実Filesystem
 * @boundary 固定PROJECT_CONTEXT.md→Reader→中立Source／Portfolio。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test, { type TestContext } from "node:test";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  inspectRepositoryManifest,
  readRepositoryProjectContext,
  createPortfolioProjection,
} from "../../src/index.ts";

/**
 * 自己生成Git Repositoryと固定本文を用意する。
 * @responsibility 実Hostと分離した固定Identity・読取り入力を構築する。
 * @trace PPR-IT-019
 * @precondition Current Repositoryの.crdd/testsだけへ作成する。
 * @stimulus 固有Directoryでgit initと固定本文生成を行う。
 * @observation Root検証・解析済みmanifest・本文Pathを取得する。
 * @oracle 完全なGit Rootと三Identityが一致する。
 * @cleanup hookで自己生成Directoryを削除し、不存在を確認する。
 * @boundary 実Git／Filesystem→Domain公開Reader。
 */
function fixture(t: TestContext) {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.mkdtempSync(path.join(parent, "domain-context-read-"));
  t.after(() => {
    assert.ok(directory.startsWith(`${parent}${path.sep}`));
    fs.rmSync(directory, { recursive: true, force: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const git = spawnSync("git", ["init", "--quiet", directory], {
    encoding: "utf8",
  });
  assert.equal(git.status, 0, git.stderr);
  const verified = verifyRepositoryRoot(directory);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("fixture_root_failed");
  const manifest = inspectRepositoryManifest({
    schema: "crdd/repository-manifest/v2",
    projectId: "p-a",
    repositoryId: "r-a",
    displayName: "試験",
    repositoryRole: "development",
    capabilities: [],
    contextSurfaces: [],
    externalSendPolicy: null,
  });
  assert.ok(manifest);
  const source = [
    "# Project Context",
    "Project ID: p-a",
    "Repository ID: r-a",
    "Repository Role: development",
    ...[
      "1. 今どうなっているか",
      "2. 何が危ない、または止まっているか",
      "3. 今、人間が決めることは何か",
      "4. なぜこの状態・判断になったか",
      "5. 次に何をすべきか",
    ].map(
      (heading) =>
        `## ${heading}\n\n### 結論\n\n固定。\n\n| 項目 | 状態 |\n|---|---|\n| 固定 | 確認済み |`,
    ),
  ].join("\n\n");
  const target = path.join(directory, "PROJECT_CONTEXT.md");
  fs.writeFileSync(target, source);
  return { directory, target, source, manifest, root: verified.capability };
}

/**
 * 三Identity一致時だけ解析済みContextを集約へ渡す。
 * @responsibility 実読取りとSource化を同じ観測へ接続する。
 * @trace PPR-IT-019
 * @trace PPR-IT-002
 * @precondition 自己生成Rootと今回の期待manifestを使う。
 * @stimulus 公開Readerの結果を中立Sourceとして集約し、同一textと空白変更を再観測する。
 * @observation 結果の閉集合・freeze・五場面・集約状態・本文相関revision。
 * @oracle 完全一致だけcompleted。同一textは同revision、同じ解析結果でもtext変更は別revision。認可成立は対象外。
 * @cleanup Fixture hookが全自己生成領域を回収する。
 * @boundary 実本文→Reader→Source→Portfolio。
 */
test("固定本文を解析し三Identity一致のContextだけを集約する", (t) => {
  const f = fixture(t);
  const result = readRepositoryProjectContext(f.root, f.manifest);
  assert.equal(result.status, "completed");
  assert.ok(Object.isFrozen(result));
  if (result.status !== "completed") return;
  assert.deepEqual(Object.keys(result).sort(), [
    "context",
    "revision",
    "status",
  ]);
  assert.match(result.revision, /^context-text-sha256:[0-9a-f]{64}$/);
  assert.equal(
    result.revision,
    `context-text-sha256:${createHash("sha256").update(f.source, "utf8").digest("hex")}`,
  );
  assert.deepEqual(readRepositoryProjectContext(f.root, f.manifest), result);
  assert.equal(result.context.scenes.length, 5);
  assert.ok(Object.isFrozen(result.context));
  const portfolio = createPortfolioProjection([
    {
      projectId: f.manifest.projectId,
      repositoryId: f.manifest.repositoryId,
      state: "complete",
      revision: result.revision,
      context: result.context,
    },
  ]);
  assert.equal(portfolio.projects[0]?.state, "complete");
  assert.equal(fs.readFileSync(f.target, "utf8"), f.source);
  assert.equal(portfolio.projects[0]?.sources[0]?.revision, result.revision);
  fs.appendFileSync(f.target, "\n\n");
  const changed = readRepositoryProjectContext(f.root, f.manifest);
  assert.equal(changed.status, "completed");
  if (changed.status !== "completed")
    throw new Error("changed context unavailable");
  assert.deepEqual(changed.context, result.context);
  assert.notEqual(changed.revision, result.revision);
  assert.equal(
    changed.revision,
    `context-text-sha256:${createHash("sha256")
      .update(`${f.source}\n\n`, "utf8")
      .digest("hex")}`,
  );
  for (const key of ["projectId", "repositoryId", "repositoryRole"] as const)
    assert.deepEqual(
      readRepositoryProjectContext(f.root, { ...f.manifest, [key]: "other" }),
      {
        status: "conflicting",
        reason: "project_context_identity_mismatch",
      },
    );
});

/**
 * 不存在・不正・容量超過を空成功へ変換しない。
 * @responsibility Readerの全失敗結果を固定理由へ限定する。
 * @trace PPR-IT-019
 * @precondition 自己生成Git Root内の本文だけを変更する。
 * @stimulus 本文削除・Directory・Junction・容量境界・不正Markdownを作る。
 * @observation 結果のstatus/reasonと未返却情報を全件確認する。
 * @oracle 観測不成立はunavailable、原文・Path・Context・missingはなし。
 * @cleanup Fixture hookと各境界の自己生成対象を回収する。
 * @boundary 実Filesystem異常→固定Reader結果。
 */
test("本文の不存在・種類・容量・解析失敗を固定unavailableへ閉じる", (t) => {
  const f = fixture(t);
  const unavailable = {
    status: "unavailable",
    reason: "project_context_observation_unavailable",
  };
  fs.rmSync(f.target);
  assert.deepEqual(
    readRepositoryProjectContext(f.root, f.manifest),
    unavailable,
  );
  fs.mkdirSync(f.target);
  assert.deepEqual(
    readRepositoryProjectContext(f.root, f.manifest),
    unavailable,
  );
  fs.rmSync(f.target, { recursive: true });
  const linkTarget = path.join(f.directory, "link-target");
  fs.mkdirSync(linkTarget);
  fs.symlinkSync(linkTarget, f.target, "junction");
  assert.deepEqual(
    readRepositoryProjectContext(f.root, f.manifest),
    unavailable,
  );
  fs.rmSync(f.target);
  fs.writeFileSync(
    f.target,
    f.source + " ".repeat(1_048_576 - Buffer.byteLength(f.source)),
  );
  assert.equal(
    readRepositoryProjectContext(f.root, f.manifest).status,
    "completed",
  );
  fs.appendFileSync(f.target, " ");
  assert.deepEqual(
    readRepositoryProjectContext(f.root, f.manifest),
    unavailable,
  );
  fs.writeFileSync(f.target, "internal-path-and-raw-fixture");
  assert.deepEqual(readRepositoryProjectContext(f.root, f.manifest), {
    status: "unavailable",
    reason: "project_context_read_unavailable",
  });
  const git = path.join(f.directory, ".git");
  const heldGit = path.join(f.directory, "git-held");
  fs.renameSync(git, heldGit);
  try {
    assert.deepEqual(readRepositoryProjectContext(f.root, f.manifest), {
      status: "blocked",
      reason: "project_context_repository_unavailable",
    });
  } finally {
    fs.renameSync(heldGit, git);
  }
});

/**
 * descriptor取得後の例外と読取り途中変更を拒否して終了する。
 * @responsibility Reader固有の結合でhandle回収・下位例外非透過を観測する。
 * @trace PPR-IT-019
 * @precondition 直列試験内でfs関数を一時差替えしfinallyで復元する。
 * @stimulus 本文descriptor読取りで例外・書換え・Root不成立を発生させる。
 * @observation 全取得descriptorのcloseと固定結果を確認する。
 * @oracle completedなし、Path／例外本文なし、取得descriptor残存0。
 * @cleanup fs関数を復元しFixture hookで自己生成領域を回収する。
 * @boundary 実descriptor→既存Observer→公開Reader。
 */
test("途中変更と下位読取り例外でもdescriptorを終了する", (t) => {
  const f = fixture(t);
  const originalRead = fs.readSync;
  const originalOpen = fs.openSync;
  const originalClose = fs.closeSync;
  const descriptors = new Set<number>();
  const targetDescriptors = new Set<number>();
  let mode: "throw" | "change" | "root" = "throw";
  let hit = false;
  try {
    fs.openSync = ((...args: Parameters<typeof fs.openSync>) => {
      const fd = originalOpen(...args);
      descriptors.add(fd);
      if (String(args[0]) === f.target) targetDescriptors.add(fd);
      return fd;
    }) as typeof fs.openSync;
    fs.closeSync = (fd) => {
      originalClose(fd);
      descriptors.delete(fd);
      targetDescriptors.delete(fd);
    };
    fs.readSync = ((...args: Parameters<typeof fs.readSync>) => {
      if (!hit && targetDescriptors.has(args[0])) {
        hit = true;
        if (mode === "throw")
          throw new Error("internal-path-and-secret-fixture");
        if (mode === "root")
          fs.renameSync(
            path.join(f.directory, ".git"),
            path.join(f.directory, "git-held"),
          );
        else fs.appendFileSync(f.target, "changed");
      }
      return originalRead(...args);
    }) as typeof fs.readSync;
    for (mode of ["throw", "change", "root"] as const) {
      hit = false;
      fs.writeFileSync(f.target, f.source);
      assert.deepEqual(readRepositoryProjectContext(f.root, f.manifest), {
        status: mode === "root" ? "blocked" : "unavailable",
        reason:
          mode === "root"
            ? "project_context_repository_unavailable"
            : "project_context_observation_unavailable",
      });
      assert.equal(hit, true);
      assert.equal(descriptors.size, 0);
    }
  } finally {
    fs.readSync = originalRead;
    fs.openSync = originalOpen;
    fs.closeSync = originalClose;
    const heldGit = path.join(f.directory, "git-held");
    if (fs.existsSync(heldGit))
      fs.renameSync(heldGit, path.join(f.directory, ".git"));
  }
});
