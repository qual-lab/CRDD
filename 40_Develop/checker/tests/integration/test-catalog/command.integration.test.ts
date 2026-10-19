/**
 * 公開CLIから試験台帳・変更集合・回帰計画への接続を検証する。
 * @packageDocumentation
 * @responsibility 試験を起動せず、計画・拒否・未実施の公開結果を確認する。
 * @trace CQS-IT-011
 * @trace CQS-IT-013
 * @level IT
 * @scope catalog、selection、git、public-cli
 * @boundary CQS-IT-011=Related 2 Blocks: Checker→DomainとVersion Control。 / CQS-IT-013=Direct Boundary: 引数→高負荷条件。
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runTestCatalog } from "../../../src/index.ts";
import {
  verifyRepositoryRoot,
  observeLocalChangeSet,
  changedPaths,
  gitLocalChangeSetAdapter,
} from "../../../../version-control/src/index.ts";

const root = path.resolve(import.meta.dirname, "../../../../..");
const cli = path.join(root, "40_Develop/checker/bin/checker.ts");

/**
 * 公開Processを計画専用で呼び出す。
 * @responsibility 同期子Processの結果を確認用に返す。
 * @trace CQS-IT-011
 * @precondition 引数は固定された非秘密の値。
 * @stimulus Checker CLIを起動する。
 * @observation 終了値とJSON。
 * @oracle 呼出し元が合否判定する。
 * @cleanup 同期子Processをjoinする。
 * @boundary Direct Boundary: Node→公開CLI。
 */
function invoke(args: readonly string[]) {
  const result = spawnSync(process.execPath, [cli, "--test-catalog", ...args], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  assert.equal(result.error, undefined);
  return result;
}

/**
 * 実台帳と公開Rootの接続を確認する。
 * @responsibility 検査成功を試験成功へ変換しない。
 * @trace CQS-IT-011
 * @precondition 現行Repositoryの台帳。
 * @stimulus 公開CLIで検査と選択を要求する。
 * @observation 対象ID、段階と未起動表示。
 * @oracle 全台帳が有効で、変更OwnerとConsumerを含む計画だけを返す。
 * @cleanup 生成物なし、CLI終了確認。
 * @boundary Related 2 Blocks: Checker→Domain→台帳／Source読取り。
 */
test("公開台帳入口は検査と選択を返すが試験を起動しない", () => {
  const inspection = invoke([]);
  assert.equal(inspection.status, 0, inspection.stderr + inspection.stdout);
  assert.equal(JSON.parse(inspection.stdout).status, "valid");
  const result = invoke([
    "--changed",
    "40_Develop/domain-model/src/test-catalog/inspect.ts",
  ]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.status, "planned");
  assert.equal(plan.testExecution, "not_started");
  assert.equal(plan.effectIssued, false);
  assert.ok(plan.testIds.length > 0);
  assert.ok(
    plan.stages.some((stage: { owners: string[] }) =>
      stage.owners.includes("checker"),
    ),
  );
  assert.equal("commands" in plan, false);
  assert.equal("results" in plan, false);
});

/**
 * 引数とRootの不成立を区別する。
 * @responsibility 不正な選択を外部Effect前に拒否する。
 * @trace CQS-IT-011
 * @precondition 不正引数・存在しないRoot。
 * @stimulus 公開APIへ渡す。
 * @observation 終了値と固定理由。
 * @oracle 引数64、Root2、標準出力なし。
 * @cleanup N/A: 作成なし。
 * @boundary Direct Boundary: 公開API→入力検査。
 */
test("台帳入口は不正引数と未検証Rootを拒否する", () => {
  for (const args of [
    ["--unknown"],
    ["--levels", "unknown"],
    ["--changed", "x", "--all"],
    ["--changed", "../outside"],
    ["--changed", "C:/outside"],
    ["--changed", "/outside"],
    ["--changed", "a//b"],
  ]) {
    const result = invoke(args);
    assert.equal(result.status, 64);
    assert.equal(result.stdout, "");
  }
  const missing = invoke([
    "--root",
    path.join(root, ".crdd/tests/not-created-catalog-root"),
  ]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /repository_root_unverified/);
});

/**
 * 高負荷の必須条件を公開要求へ接続する。
 * @responsibility 明示条件不足を許可済みへ補完しない。
 * @trace CQS-IT-013
 * @precondition 固定した高負荷計画要求。
 * @stimulus 許可条件と上限なしで要求する。
 * @observation 理由と不足項目、Effect表示。
 * @oracle 計画条件の不足を返し試験未起動を保持する。
 * @cleanup 同期CLIをjoinする。
 * @boundary Direct Boundary: 公開要求→Domain条件検査。
 */
test("高負荷計画の必須条件不足を固定結果で返す", () => {
  const result = invoke(["--all", "--levels", "longevity"]);
  assert.equal(result.status, 2);
  const value = JSON.parse(result.stdout);
  assert.equal(value.reason, "resource_intensive_test_authority_required");
  assert.ok(value.failures.includes("authorization_missing"));
  assert.ok(value.failures.includes("duration_cap_missing"));
  assert.equal(value.effectIssued, false);
});

/**
 * 人間確認・Windows専用・外部AIを計画条件のまま保持する。
 * @responsibility 必要条件を満たす前に実行済みへ丸めない。
 * @trace CQS-IT-011
 * @precondition 手動UATを含む全体選択。
 * @stimulus UATを含む計画を表示する。
 * @observation 人間入力条件と専用Profile。
 * @oracle 人間確認の段階を明示し、全試験未起動。
 * @cleanup CLI終了、生成物なし。
 * @boundary Related 2 Blocks: 公開CLI→Domain計画。
 */
test("全体計画は人間確認と専用実行条件を保持する", () => {
  const result = invoke([
    "--all",
    "--levels",
    "unit,integration,system,acceptance",
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const plan = JSON.parse(result.stdout);
  const catalog = JSON.parse(
    fs.readFileSync(
      path.join(root, "07_Quality/Registry/test-catalog.json"),
      "utf8",
    ),
  );
  assert.deepEqual(
    [...plan.testIds].sort(),
    catalog.tests
      .filter((entry: { level: string }) =>
        ["unit", "integration", "system", "acceptance"].includes(entry.level),
      )
      .map((entry: { id: string }) => entry.id)
      .sort(),
  );
  assert.deepEqual(plan.changedPaths, []);
  assert.equal(plan.selectionBasis, "all_catalog_tests");
  assert.ok(
    plan.executionConditions.some(
      (entry: { humanInput: boolean }) => entry.humanInput,
    ),
  );
  assert.ok(
    plan.stages.some(
      (entry: { execution: string }) =>
        entry.execution === "human_input_required",
    ),
  );
  assert.equal(plan.effectIssued, false);
  assert.equal(plan.testExecution, "not_started");
});

/**
 * Git差分の全成分を公開計画へ接続する。
 * @responsibility commit・index・worktree・未追跡とrename両側を失わない。
 * @trace CQS-IT-011
 * @precondition Repository内の自己生成Git試験領域。
 * @stimulus 各変更を作りbase指定で公開APIを呼ぶ。
 * @observation 公開changedPaths。
 * @oracle 各変更成分が存在し、試験起動0。
 * @cleanup 自己生成Rootだけを削除し不存在確認。
 * @boundary Related 2 Blocks: Checker→Version Control→実Git。
 */
test("公開計画はGit変更集合の全成分を保持する", () => {
  const parent = path.join(root, ".crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.lstatSync(path.join(root, ".crdd")).isSymbolicLink(), false);
  assert.equal(fs.lstatSync(parent).isSymbolicLink(), false);
  const fixture = fs.mkdtempSync(path.join(parent, "catalog-git-"));
  try {
    execFileSync("git", ["init", "--quiet", fixture], { windowsHide: true });
    // 現行台帳を検査可能なRootとして本体のbase観測を別途確認する。合成GitはVC入力の反証に限定する。
    /**
     * 合成Repositoryへ固定Git操作を発行する。
     * @responsibility 試験用Git履歴と変更成分だけを作成する。
     * @trace CQS-IT-011
     * @precondition 自己生成した合成Root。
     * @stimulus 固定Git引数を渡す。
     * @observation stdoutと終了値。
     * @oracle 呼出し元が変更集合を照合する。
     * @cleanup 外側finallyがRootを削除する。
     * @boundary Direct Boundary: 試験→Git。
     */
    const git = (...args: string[]) =>
      execFileSync(
        "git",
        [
          "-c",
          "user.name=CRDD Test",
          "-c",
          "user.email=test@example.invalid",
          ...args,
        ],
        { cwd: fixture, windowsHide: true },
      );
    for (const name of ["committed.txt", "old.txt", "working.txt"])
      fs.writeFileSync(path.join(fixture, name), "base\n");
    git("add", ".");
    git("commit", "--quiet", "-m", "base");
    const base = git("rev-parse", "HEAD").toString().trim();
    fs.writeFileSync(path.join(fixture, "committed.txt"), "next\n");
    git("add", "committed.txt");
    git("commit", "--quiet", "-m", "next");
    git("mv", "old.txt", "new.txt");
    fs.writeFileSync(path.join(fixture, "working.txt"), "dirty\n");
    fs.writeFileSync(path.join(fixture, "untracked.txt"), "untracked\n");
    const verified = verifyRepositoryRoot(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") return;
    const observed = changedPaths(
      observeLocalChangeSet(
        verified.capability,
        base,
        gitLocalChangeSetAdapter,
      ),
    );
    for (const expected of [
      "committed.txt",
      "old.txt",
      "new.txt",
      "working.txt",
      "untracked.txt",
    ])
      assert.ok(observed.includes(expected), expected);
    let output = "";
    const ownRoot = verifyRepositoryRoot(root);
    assert.equal(ownRoot.status, "completed");
    if (ownRoot.status !== "completed") return;
    const expectedPaths = changedPaths(
      observeLocalChangeSet(
        ownRoot.capability,
        "HEAD~1",
        gitLocalChangeSetAdapter,
      ),
    );
    const result = runTestCatalog({
      cwd: root,
      arguments: ["--base", "HEAD~1"],
      writeOutput: (value) => {
        output += value;
      },
      writeError: (value) => {
        throw new Error(value);
      },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(JSON.parse(output).effectIssued, false);
    assert.deepEqual(JSON.parse(output).changedPaths, expectedPaths);
  } finally {
    assert.equal(
      path.dirname(fs.realpathSync.native(fixture)),
      fs.realpathSync.native(parent),
    );
    fs.rmSync(fixture, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixture), false);
  }
});
