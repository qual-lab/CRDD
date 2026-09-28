/**
 * version-control:integration:change-publicationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 選択差分の準備、解除、Revision作成、確認済み通常公開および失敗分類を実Git境界で検証する。
 * @trace RFD-IT-014
 * @level IT
 * @scope version-control、git-adapter、local-repository、bare-remote
 * @boundary RFD-IT-014=Related 2 Blocks: Version Control Port→Git Adapter→Local bare Remote
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createGitChangePublicationAdapter,
  executeChangePublication,
  gitChangePublicationAdapter,
  gitChangePublicationTargetObservationAdapter,
  observeChangePublicationTarget,
  verifyRepositoryRoot,
} from "../../src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../src/repository-location.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 試験用Git Commandを固定作業Directoryで実行する。
 *
 * @responsibility Fixture構築と終了状態観測に必要なGit操作だけを同期実行する。
 * @trace RFD-IT-014
 * @input cwd、Git引数および任意の出力符号化を受け取る。
 * @returns stdout文字列を返す。
 * @precondition cwdはRepository-local試験領域内である。
 * @postcondition Commandは完了し子Processを残さない。
 * @effect 試験Fixture Repositoryまたはbare Remoteを変更し得る。
 * @failure 非0終了を試験失敗として送出する。
 * @invariant 実CRDD Repositoryを変更しない。
 * @stimulus gitの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-IT-014=Direct Boundary: version-control Test Source→対象契約
 * @security shellを使わずCredentialを扱わない。
 * @concurrency 各Fixture内で直列実行する。
 */
function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

/**
 * 選択差分だけをRevision化し確認済みRemoteへ通常公開できることを検証する。
 *
 * @responsibility prepare／unprepare、Local RevisionおよびRemote反映を別々に観測する。
 * @trace RFD-IT-014
 * @precondition Repository-local一時領域にLocal Repositoryとbare Remoteを構築する。
 * @stimulus 二ファイルのうち一方だけをprepareし、Revision作成後に確認済み対象へpublishする。
 * @observation 準備領域、Revision Identity、Remote Branchおよび残る作業差分を観測する。
 * @oracle 選択ファイルだけがRevisionとRemoteへ入り、未選択変更は作業領域に残る。
 * @cleanup finallyでLocal／Remote Fixtureを再帰削除する。
 * @boundary RFD-IT-014=Direct Boundary: version-control Test Source→対象契約
 */
test("選択差分だけをRevision化し確認済みRemoteへ通常公開する", async () => {
  const root = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(root, { recursive: true });
  const fixture = await mkdtemp(path.join(root, "change-publication-"));
  const local = path.join(fixture, "local");
  const remote = path.join(fixture, "remote.git");
  try {
    await mkdir(local);
    git(local, "init", "--initial-branch=main");
    git(local, "config", "user.name", "CRDD Test");
    git(local, "config", "user.email", "crdd-test@example.invalid");
    await writeFile(path.join(local, "selected.txt"), "base\n", "utf8");
    await writeFile(path.join(local, "remaining.txt"), "base\n", "utf8");
    git(local, "add", "--", "selected.txt", "remaining.txt");
    git(local, "commit", "--quiet", "--message", "base");
    git(fixture, "init", "--bare", remote);
    git(local, "remote", "add", "origin", remote);
    git(local, "push", "--quiet", "--set-upstream", "origin", "main");

    await writeFile(path.join(local, "selected.txt"), "selected\n", "utf8");
    await writeFile(path.join(local, "remaining.txt"), "remaining\n", "utf8");
    const verified = verifyRepositoryRoot(local);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") return;
    const target = observeChangePublicationTarget(
      verified.capability,
      gitChangePublicationTargetObservationAdapter,
    );
    assert.equal(target.status, "available");
    assert.equal(target.destination, "origin");
    assert.equal(target.branch, "main");
    assert.equal(target.revisionIdentity, git(local, "rev-parse", "HEAD"));

    const prepared = executeChangePublication(
      verified.capability,
      { operation: "prepare", paths: ["selected.txt", "remaining.txt"] },
      gitChangePublicationAdapter,
    );
    assert.equal(prepared.status, "completed");
    const unprepared = executeChangePublication(
      verified.capability,
      { operation: "unprepare", paths: ["remaining.txt"] },
      gitChangePublicationAdapter,
    );
    assert.equal(unprepared.status, "completed");
    const revision = executeChangePublication(
      verified.capability,
      { operation: "create_revision", message: "selected change" },
      gitChangePublicationAdapter,
    );
    assert.equal(revision.status, "completed");
    assert.ok(revision.revisionIdentity);
    const publication = executeChangePublication(
      verified.capability,
      {
        operation: "publish_revision",
        destination: "origin",
        branch: "main",
        revisionIdentity: revision.revisionIdentity,
        humanConfirmed: true,
      },
      gitChangePublicationAdapter,
    );
    assert.equal(publication.status, "completed");
    assert.equal(publication.effectConfirmed, true);
    assert.equal(publication.automaticRetryIssued, false);
    assert.equal(publication.forcePublicationIssued, false);
    assert.equal(git(local, "diff", "--name-only"), "remaining.txt");
    assert.equal(
      git(fixture, "--git-dir", remote, "rev-parse", "refs/heads/main"),
      revision.revisionIdentity,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * 確認後にRevisionが変わった場合はRemote Effectを発行しないことを検証する。
 *
 * @responsibility 確認対象Revisionと現在HEADの競合を公開前に拒否する。
 * @trace RFD-IT-014
 * @precondition 実Git Repositoryを持つが存在しないRevision Identityを確認値として使う。
 * @stimulus publish_revisionを一度要求する。
 * @observation status、reason、Effect発行および再送／Force fieldを観測する。
 * @oracle blockedかつEffect 0、自動再送0、Force公開0となる。
 * @cleanup N/A: Effect前拒否でRepositoryを変更しない。
 * @boundary RFD-IT-014=Direct Boundary: version-control Test Source→対象契約
 */
test("確認後にRevisionが変われば公開Effect前に拒否する", () => {
  const verified = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const result = executeChangePublication(
    verified.capability,
    {
      operation: "publish_revision",
      destination: "origin",
      branch: "main",
      revisionIdentity: "0".repeat(40),
      humanConfirmed: true,
    },
    gitChangePublicationAdapter,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "publication_revision_changed");
  assert.equal(result.effectIssued, false);
  assert.equal(result.automaticRetryIssued, false);
  assert.equal(result.forcePublicationIssued, false);
});

/**
 * 通常公開の通信断と反映再観測不能を成功へ畳まず再送しないことを検証する。
 *
 * @responsibility Push要求とRemote反映観測の失敗段階を区別し、同じ公開Effectを自動再送しないことを検証する。
 * @trace RFD-IT-014
 * @precondition 固定Revisionを返し、公開または再観測だけを失敗させる差替Runnerを用意する。
 * @stimulus 通信断ScenarioとRemote観測不能Scenarioを各一回実行する。
 * @observation status、reason、Effect発行・確認、Command回数および再送fieldを観測する。
 * @oracle 両Scenarioはunknownとなり、Effect発行段階を保持し、自動再送とForce公開は0である。
 * @cleanup N/A: 差替Runnerは実RepositoryとRemoteを変更しない。
 * @boundary RFD-IT-014=Direct Boundary: version-control Test Source→対象契約
 */
test("通常公開の通信断と反映再観測不能を成功へ畳まず再送しない", () => {
  const verified = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const revisionIdentity = "1".repeat(40);
  const request = {
    operation: "publish_revision" as const,
    destination: "origin",
    branch: "main",
    revisionIdentity,
    humanConfirmed: true as const,
  };

  const communicationCalls: readonly string[][] = [];
  const communicationRunner = (
    _repositoryRoot: string,
    args: readonly string[],
  ) => {
    (communicationCalls as string[][]).push([...args]);
    return args[0] === "rev-parse"
      ? { error: undefined, status: 0, stdout: Buffer.from(revisionIdentity) }
      : {
          error: new Error("simulated communication loss"),
          status: null,
          stdout: Buffer.alloc(0),
        };
  };
  const communication = executeChangePublication(
    verified.capability,
    request,
    createGitChangePublicationAdapter(communicationRunner),
  );
  assert.equal(communication.status, "unknown");
  assert.equal(communication.reason, "publication_result_unknown");
  assert.equal(communication.effectIssued, true);
  assert.equal(communication.effectConfirmed, false);
  assert.equal(communication.automaticRetryIssued, false);
  assert.equal(communication.forcePublicationIssued, false);
  assert.equal(communicationCalls.length, 2);

  const observationCalls: string[][] = [];
  const observationRunner = (
    _repositoryRoot: string,
    args: readonly string[],
  ) => {
    observationCalls.push([...args]);
    if (args[0] === "rev-parse")
      return {
        error: undefined,
        status: 0,
        stdout: Buffer.from(revisionIdentity),
      };
    if (args[0] === "push")
      return { error: undefined, status: 0, stdout: Buffer.alloc(0) };
    return { error: undefined, status: 1, stdout: Buffer.alloc(0) };
  };
  const observation = executeChangePublication(
    verified.capability,
    request,
    createGitChangePublicationAdapter(observationRunner),
  );
  assert.equal(observation.status, "unknown");
  assert.equal(observation.reason, "publication_observation_unknown");
  assert.equal(observation.effectIssued, true);
  assert.equal(observation.effectConfirmed, false);
  assert.equal(observation.automaticRetryIssued, false);
  assert.equal(observation.forcePublicationIssued, false);
  assert.equal(observationCalls.length, 3);
});
