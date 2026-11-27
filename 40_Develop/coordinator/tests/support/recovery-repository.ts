/**
 * 回復に渡すGit観測をアプリケーション層の試験で準備する。
 * @packageDocumentation
 * @responsibility 上位の確定済み保存先と既存の現在性判定だけを試験へ渡す。
 * @trace ERB-IT-014
 * @boundary 試験専用。製品の許可や保存は行わない。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";
import { types } from "node:util";
import * as versionControl from "@qual-lab/crdd-version-control";
import { createRepositoryTestDirectory } from "../../../execution-model/tests/support/repository-test-directory.ts";

/**
 * 現行Hostの作業先となる試験専用Gitリポジトリを用意する。
 * @trace ERB-IT-003
 * @boundary 操作対象は既存fixtureが作成した試験Rootだけ。
 */
export function createHostNamespaceFixture(t: TestContext) {
  const directory = createRepositoryTestDirectory("node-host-namespace-");
  t.after(directory.cleanup);
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", directory.path, ...args], { windowsHide: true });
  git("init", "--quiet");
  git(
    "-c",
    "user.name=CRDD Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "--allow-empty",
    "--quiet",
    "-m",
    "fixture",
  );
  const verified = versionControl.getRepository(directory.path);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw Error("fixture_repository_invalid");
  return {
    root: directory.path,
    parent: path.join(directory.path, ".crdd", "coordinator"),
    input: {
      root: verified.capability,
      purpose: "isolation_probe" as const,
      recordingCurrent: () => true,
    },
  };
}

/**
 * Host試験の共有Home親を今回の新品Rootへ限定する。
 * @responsibility 実ユーザーの設定・保持物に依存せず、同じ所在から排他を導出する。
 * @trace ERB-IT-014
 * @precondition rootは現在Caseが作成した専用Repositoryである。
 * @stimulus 所在取得元を自己所有Rootに設定し、既存の候補所在だけを作成する。
 * @observation 既存Home排他と回復準備の結果をCaseが検証する。
 * @oracle 実Homeの有無を試験前提にしない。
 * @cleanup 元設定を復元し、Caseの既存hookがRoot全体を回収する。
 * @boundary 試験Process内の設定と自己所有Filesystemのみ。
 */
export function useFixtureProviderHomeDirectory(
  t: TestContext,
  root: string,
  readCandidate: () => string | null,
) {
  const previous = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = root;
  t.after(() => {
    if (previous === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous;
  });
  const directory = readCandidate();
  assert.ok(directory);
  const relative = path.relative(root, directory);
  assert.ok(
    relative && !relative.startsWith("..") && !path.isAbsolute(relative),
  );
  fs.mkdirSync(directory, { recursive: true });
}

/**
 * 合成Repositoryに対する上位の回復受付を試験内で組み立てる。
 * @trace ERB-IT-014
 * @precondition Caseが生成したRepository参照、又は同じ参照に結合した保持設定だけを渡す。
 * @boundary Gitの観測は試験の準備。製品の回復Writerへは保存先と同期確認だけを渡す。
 */
export function prepareFixtureRecovery(input: unknown) {
  const value = (source: unknown, name: string): unknown => {
    if (!source || typeof source !== "object" || types.isProxy(source))
      return undefined;
    const field = Object.getOwnPropertyDescriptor(source, name);
    return field && "value" in field ? field.value : undefined;
  };
  const days = value(input, "historyRetentionDays");
  const capability = (
    days === undefined ? input : value(input, "root")
  ) as versionControl.Repository;
  const directory = versionControl.resolveVerifiedRepositoryRoot(capability);
  if (!directory) return null;
  const initial = versionControl.readRepositoryRevision(capability);
  if (!initial) return null;
  const retain = value(input, "revalidate");
  return {
    purpose: "recovery" as const,
    root: { directory },
    historyRetentionDays: typeof days === "number" ? days : null,
    revalidate(expected?: number) {
      const fresh = versionControl.readRepositoryRevision(capability);
      return (
        (expected === undefined ||
          (typeof retain === "function" && retain(expected) === true)) &&
        fresh !== null &&
        fresh.repositoryForm === initial.repositoryForm &&
        fresh.repositoryIdentity === initial.repositoryIdentity &&
        fresh.repositoryInstanceIdentity ===
          initial.repositoryInstanceIdentity &&
        fresh.revisionIdentity === initial.revisionIdentity
      );
    },
  };
}
