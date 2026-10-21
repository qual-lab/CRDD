/**
 * Worktreeの作成・観測・明示破棄を合成Repositoryの実Gitで確認する。
 * @packageDocumentation
 * @responsibility dirty非継承、残存回収、対象拘束と途中失敗の反証。
 * @trace RFD-IT-029
 * @level IT
 * @scope Version Control技術APIのみ。上位Task・Merge判断・Dockerは対象外。
 * @boundary Repository-local試験領域とローカル実Git。
 */
import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { devNull } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  createRepositoryWorktree,
  disposeRepositoryWorktree,
  observeRepositoryWorktree,
  verifyRepositoryRoot,
  freezeWorkspaceCandidate,
  mergeWorkspaceCandidate,
  removeWorkspaceCandidate,
  validWorkspaceDisplayName,
  inspectWorkspaceInventory,
  readWorkspaceFileContent,
  isWorkspaceRelativePath,
  type WorkspaceCandidateRequest,
} from "../../src/index.ts";

const repository = path.resolve(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
const testsRoot = path.join(repository, ".crdd", "tests");
const empty = process.platform === "win32" ? "NUL" : devNull;

/**
 * 実Treeのdirty・未追跡・削除と安定読取りを確認する。
 * @responsibility 上位から移管した読取りがGit操作や内容採用を発行しないことを反証する。
 * @trace RFD-IT-029
 * @precondition 自己生成Repositoryだけを使用する。
 * @stimulus 内容変更・未追跡追加・削除と容量上限を観測する。
 * @observation inventory、bytes、HEADとIndex。
 * @oracle dirty内容を読め、保護領域を除外し、容量超過を拒否してHEADとIndexは不変。
 * @cleanup fixtureのafterで自己生成Rootのみ回収する。
 * @boundary ローカルGit／Filesystem。Docker・Providerなし。
 */
test("借用Tree観測はdirtyと未追跡を読みGit状態を変更しない", (t) => {
  const f = fixture(t);
  const index = fs.readFileSync(path.join(f.root, ".git", "index"));
  fs.mkdirSync(path.join(f.root, ".crdd"));
  fs.writeFileSync(path.join(f.root, ".crdd", "state.json"), "private");
  fs.writeFileSync(path.join(f.root, "source.txt"), "dirty\n");
  fs.writeFileSync(path.join(f.root, "untracked.txt"), "new\n");
  const first = inspectWorkspaceInventory(f.root, true);
  assert.equal(
    first.some((entry) => entry.relativePath.startsWith(".git/")),
    false,
  );
  assert.equal(
    first.some((entry) => entry.relativePath.startsWith(".crdd/")),
    false,
  );
  assert.ok(first.some((entry) => entry.relativePath === "untracked.txt"));
  const read = readWorkspaceFileContent(path.join(f.root, "source.txt"), 6);
  assert.equal(read.content.toString(), "dirty\n");
  assert.throws(
    () => readWorkspaceFileContent(path.join(f.root, "source.txt"), 5),
    /repository_workspace_file_invalid/u,
  );
  fs.rmSync(path.join(f.root, "untracked.txt"));
  assert.equal(
    inspectWorkspaceInventory(f.root, true).some(
      (entry) => entry.relativePath === "untracked.txt",
    ),
    false,
  );
  assert.equal(isWorkspaceRelativePath("../outside"), false);
  assert.equal(isWorkspaceRelativePath(".git/index"), false);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.deepEqual(fs.readFileSync(path.join(f.root, ".git", "index")), index);
});

/**
 * 自己生成fixtureへ準備用Gitを発行する。
 * @responsibility 実験の対照とCommit操作を製品入口から区別する。
 * @trace RFD-IT-029
 * @precondition rootは本試験所有領域。
 * @stimulus 明示したGit引数。
 * @observation stdoutと終了値。
 * @oracle 正常終了だけを返す。
 * @cleanup fixture終了時にまとめて回収。
 * @boundary 実Git、外部通信なし。
 */
function git(root: string, args: string[], hooks = false) {
  return execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "commit.gpgSign=false",
      ...(!hooks ? ["-c", `core.hooksPath=${empty}`] : []),
      ...args,
    ],
    {
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
        ),
        GIT_CONFIG_GLOBAL: empty,
        GIT_CONFIG_SYSTEM: empty,
        GIT_TERMINAL_PROMPT: "0",
      },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    },
  ).trim();
}

/**
 * 固定Root内に合成Repositoryと回収hookを用意する。
 * @responsibility 全生成物をRepository-localへ閉じる。
 * @trace RFD-IT-029
 * @precondition testsRootは実Directoryである。
 * @stimulus 最小Commitとignoreを生成。
 * @observation Base Commitと検証済みRoot。
 * @oracle 検証成功、試験終了後Root不存在。
 * @cleanup 自己生成Rootのみをafterで削除。
 * @boundary 本体Git・認証・Dockerには触れない。
 */
function fixture(t: TestContext) {
  assert.equal(fs.lstatSync(testsRoot).isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(testsRoot), testsRoot);
  const root = fs.mkdtempSync(path.join(testsRoot, "worktree-management-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  git(root, ["init", "--initial-branch=main", "--template="]);
  git(root, ["config", "user.name", "Synthetic Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(
    path.join(root, ".gitignore"),
    ".crdd/\nignored.txt\n.env\n",
  );
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("fixture_root_invalid");
  /**
   * 所有Worktreeの固定相対配置を試験Rootへ結合する。
   * @responsibility 所有Worktreeの固定相対配置を試験Rootへ結合する。
   * @trace RFD-IT-029
   * @precondition fixtureのRepo Rootと試験UUID。
   * @stimulus 固定workspaces配置へidを結合する。
   * @observation 期待するWorktree絶対Path。
   * @oracle 作成・観測・削除の結果を同じ対象Pathへ照合する。
   * @cleanup 実WorktreeとRefは呼出し元が正式処理で回収する。
   * @boundary 試験の期待Path計算のみ。資源は生成しない。
   */
  const target = (id: string) =>
    path.join(root, ".crdd", "workspaces", id, "worktree");
  return { root, base, capability: verified.capability, target };
}

/**
 * 確認したraw bytesをGit Blob IDと明示選択へ結合する。
 * @responsibility Stageではなく現在file全体を確認する。
 * @trace RFD-IT-029
 * @precondition 作成済み自己生成Worktree。
 * @stimulus hash-objectの読取り。
 * @observation Base、Workspace HEAD、選択Blob。
 * @oracle 呼出し前の内容だけを固定入力にする。
 * @cleanup fixtureのafter。
 * @boundary 実Git、外部通信なし。
 */
function candidateInput(
  f: ReturnType<typeof fixture>,
  id: string,
): WorkspaceCandidateRequest {
  return {
    workspaceId: id,
    operationId: randomUUID(),
    baseCommit: f.base,
    expectedWorkspaceHead: git(f.target(id), ["rev-parse", "HEAD"]),
    selection: [
      {
        path: "source.txt",
        mode: "100644",
        blobId: git(f.target(id), [
          "hash-object",
          "--no-filters",
          "source.txt",
        ]),
      },
    ],
    workspaceName: "継続作業",
    candidateName: "選択した改善",
    relatedChangeIds: ["CHG-000082"],
  };
}

/**
 * Object発行後の故障と未完了Mergeの正規再入場を反証する。
 * @responsibility 要求Effect計数と元Commit再利用、Tree未一致拒否。
 * @trace RFD-IT-029
 * @precondition 新品Workspaceと削除又は通常候補。
 * @stimulus Ref作成拒否、Commit拒否、偽二親Tree。
 * @observation 元OID、MERGE_HEAD、親／Tree、通常index。
 * @oracle 再Merge・別候補生成0、不一致は停止。
 * @cleanup spawn差替えを戻しfixtureを回収。
 * @boundary 実Git、故障通知だけ有限代役。
 */
test("CandidateのObject後故障・未完了Merge・偽二親Treeを同対象で判別する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  const source = candidateInput(f, id);
  fs.unlinkSync(path.join(f.target(id), "source.txt"));
  const input = {
    ...source,
    selection: [{ path: "source.txt", mode: null, blobId: null }],
  };
  const spawn = childProcess.spawnSync;
  let failRef = true;
  let commitRequests = 0;
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    const command = args[1];
    if (Array.isArray(command) && command.includes("commit-tree"))
      commitRequests++;
    if (failRef && Array.isArray(command) && command.includes("update-ref"))
      return {
        pid: 0,
        output: [null, "", ""],
        stdout: "",
        stderr: "synthetic",
        status: 1,
        signal: null,
      };
    return Reflect.apply(spawn, childProcess, args);
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  let failed: ReturnType<typeof freezeWorkspaceCandidate>;
  try {
    failed = freezeWorkspaceCandidate(f.capability, input);
  } finally {
    childProcess.spawnSync = spawn;
    syncBuiltinESMExports();
  }
  assert.equal(failed.status, "blocked");
  assert.equal(failed.effectIssued, true);
  assert.ok(failed.candidateCommit);
  assert.equal(commitRequests, 1);
  failRef = false;
  const fixed = freezeWorkspaceCandidate(
    f.capability,
    input,
    failed.candidateCommit,
  );
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  assert.equal(fixed.candidateCommit, failed.candidateCommit);
  const candidateCommit = fixed.candidateCommit;
  assert.ok(candidateCommit);
  const target = {
    candidateCommit,
    targetBranch: "main",
    expectedTargetHead: f.base,
  };
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    if (Array.isArray(args[1]) && args[1].includes("commit"))
      return {
        pid: 0,
        output: [null, "", ""],
        stdout: "",
        stderr: "synthetic",
        status: 1,
        signal: null,
      };
    return Reflect.apply(spawn, childProcess, args);
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  let interrupted: ReturnType<typeof mergeWorkspaceCandidate>;
  try {
    interrupted = mergeWorkspaceCandidate(f.capability, input, target);
  } finally {
    childProcess.spawnSync = spawn;
    syncBuiltinESMExports();
  }
  assert.equal(interrupted.reason, "candidate_merge_commit_failed");
  assert.equal(interrupted.effectIssued, true);
  assert.equal(git(f.root, ["rev-parse", "MERGE_HEAD"]), candidateCommit);
  const mergeHeadFile = path.join(f.root, ".git", "MERGE_HEAD");
  fs.writeFileSync(mergeHeadFile, `${candidateCommit}\n${f.base}\n`);
  assert.equal(
    mergeWorkspaceCandidate(f.capability, input, target).reason,
    "candidate_merge_in_progress",
  );
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  fs.writeFileSync(mergeHeadFile, `${candidateCommit}\n`);
  const resumed = mergeWorkspaceCandidate(f.capability, input, target);
  assert.equal(resumed.status, "completed", JSON.stringify(resumed));
  assert.ok(resumed.mergeCommit);
  const fake = git(f.root, [
    "commit-tree",
    `${f.base}^{tree}`,
    "-p",
    f.base,
    "-p",
    candidateCommit,
    "-m",
    "wrong content",
  ]);
  git(f.root, ["update-ref", "refs/heads/main", fake, resumed.mergeCommit]);
  const denied = mergeWorkspaceCandidate(f.capability, input, target);
  assert.equal(denied.reason, "candidate_merge_tree_mismatch");
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), fake);
});

/**
 * 一時index回収の失敗を同じ参照で再入場する。
 * @responsibility Ref既存を一時物清掃成功へ代用しない。
 * @trace RFD-IT-029
 * @precondition 新品Workspaceと選択済みfile。
 * @stimulus 自己生成indexの削除だけを拒否する。
 * @observation 元Commit・一時実体・兄弟fileと清掃後不存在。
 * @oracle 失敗中は同参照を保持し回復時に同OIDで完了。
 * @cleanup 差替え復元後にfixtureだけを回収。
 * @boundary 実Git、清掃失敗だけ有限代役。
 */
test("Candidate一時indexの回収失敗は同参照を保持し既存Refでも再確認する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "selected\n");
  const input = candidateInput(f, id);
  const sibling = path.join(path.dirname(f.target(id)), "unrelated.txt");
  fs.writeFileSync(sibling, "untouched");
  const remove = fs.rmSync;
  fs.rmSync = ((target, options) => {
    if (String(target).includes("candidate-index-"))
      throw new Error("synthetic");
    return remove(target, options);
  }) as typeof fs.rmSync;
  let first: ReturnType<typeof freezeWorkspaceCandidate>;
  try {
    first = freezeWorkspaceCandidate(f.capability, input);
    assert.equal(first.status, "blocked");
    assert.equal(first.cleanupConfirmed, false);
    assert.ok(first.temporary);
    const retry = freezeWorkspaceCandidate(
      f.capability,
      input,
      first.candidateCommit,
      first.temporary,
    );
    assert.equal(retry.status, "blocked");
    assert.equal(retry.cleanupConfirmed, false);
    assert.deepEqual(retry.temporary, first.temporary);
  } finally {
    fs.rmSync = remove;
  }
  const recovered = freezeWorkspaceCandidate(
    f.capability,
    input,
    first.candidateCommit,
    first.temporary,
  );
  assert.equal(recovered.status, "completed", JSON.stringify(recovered));
  assert.equal(recovered.candidateCommit, first.candidateCommit);
  assert.equal(recovered.temporary, null);
  assert.equal(
    fs.existsSync(path.join(f.root, first.temporary.relativePath)),
    false,
  );
  assert.equal(fs.readFileSync(sibling, "utf8"), "untouched");
});

/**
 * 一時領域作成直後の実体欠測も清掃済みにしない。
 * @responsibility 作成成功と観測成功を区別する。
 * @trace RFD-IT-029
 * @precondition 新品Workspaceと確認済み選択。
 * @stimulus mkdtemp実成功後のlstatだけ拒否。
 * @observation 元Path・identity不明・通常indexと兄弟内容。
 * @oracle 未確認参照を保持し再入場も自動削除しない。
 * @cleanup 差替えを戻し自己生成fixtureだけを回収。
 * @boundary 実GitとFilesystem、観測故障だけ有限代役。
 */
test("Candidate一時領域の作成直後欠測はPathと清掃未確認を保持する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "candidate\n");
  const input = candidateInput(f, id);
  const index = fs.readFileSync(path.join(f.root, ".git", "index"));
  const inspect = fs.lstatSync;
  Object.defineProperty(fs, "lstatSync", {
    value: ((...args: Parameters<typeof fs.lstatSync>) => {
      if (path.basename(String(args[0])).startsWith("candidate-index-"))
        throw Object.assign(new Error("synthetic"), { code: "EACCES" });
      return Reflect.apply(inspect, fs, args);
    }) as typeof fs.lstatSync,
  });
  let failed: ReturnType<typeof freezeWorkspaceCandidate>;
  try {
    failed = freezeWorkspaceCandidate(f.capability, input);
  } finally {
    Object.defineProperty(fs, "lstatSync", { value: inspect });
  }
  assert.equal(failed.status, "blocked");
  assert.equal(failed.cleanupConfirmed, false);
  assert.ok(failed.temporary);
  assert.equal(failed.temporary.identity, null);
  assert.equal(
    fs.existsSync(path.join(f.root, failed.temporary.relativePath)),
    true,
  );
  const retry = freezeWorkspaceCandidate(
    f.capability,
    input,
    null,
    failed.temporary,
  );
  assert.equal(retry.status, "blocked");
  assert.equal(retry.cleanupConfirmed, false);
  assert.deepEqual(retry.temporary, failed.temporary);
  assert.deepEqual(fs.readFileSync(path.join(f.root, ".git", "index")), index);
});

/**
 * 候補固定が過去Commit・通常index・未選択変更を混入させない。
 * @responsibility Base単一親・選択Tree・同操作再入場を反証する。
 * @trace RFD-IT-029
 * @precondition 未選択の過去CommitとStageを持つWorkspace。
 * @stimulus 一fileだけの明示固定と同要求再送。
 * @observation 両HEAD、index bytes、固定TreeとRef。
 * @oracle 選択内容だけで固定し元OIDを再利用する。
 * @cleanup fixtureのafter。
 * @boundary 実Git、合成データのみ。
 */
test("Candidateは明示Baseから選択だけを固定し通常indexと過去Commitを混入しない", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  fs.writeFileSync(path.join(f.target(id), "past.txt"), "unselected history\n");
  git(f.target(id), ["add", "past.txt"]);
  git(f.target(id), ["commit", "-m", "not selected"]);
  fs.writeFileSync(path.join(f.target(id), "stage.txt"), "unselected staged\n");
  git(f.target(id), ["add", "stage.txt"]);
  fs.writeFileSync(
    path.join(f.target(id), "source.txt"),
    Buffer.from([0, 255, 13, 10, 1]),
  );
  const request = candidateInput(f, id);
  const index = git(f.target(id), [
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "index",
  ]);
  const bytes = fs.readFileSync(index);
  const fixed = freezeWorkspaceCandidate(f.capability, request);
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  assert.ok(fixed.candidateCommit);
  assert.equal(
    git(f.root, ["rev-list", "--parents", "-n", "1", fixed.candidateCommit]),
    `${fixed.candidateCommit} ${f.base}`,
  );
  assert.deepEqual(fixed.changedPaths, ["source.txt"]);
  assert.equal(
    git(f.root, ["ls-tree", "--name-only", fixed.candidateCommit]).includes(
      "past.txt",
    ),
    false,
  );
  assert.deepEqual(fs.readFileSync(index), bytes);
  assert.equal(
    git(f.target(id), ["rev-parse", "HEAD"]),
    request.expectedWorkspaceHead,
  );
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "later task\n");
  assert.equal(
    freezeWorkspaceCandidate(f.capability, request).candidateCommit,
    fixed.candidateCommit,
  );
  assert.equal(
    removeWorkspaceCandidate(f.capability, request, fixed.candidateCommit)
      .status,
    "completed",
  );
  assert.equal(
    removeWorkspaceCandidate(f.capability, request, fixed.candidateCommit)
      .reason,
    "candidate_ref_absent",
  );
  assert.equal(observeRepositoryWorktree(f.capability, id).status, "completed");
});

/**
 * 固定前の内容変更・不正選択・明示削除を確認する。
 * @responsibility 誤った候補Refを作らない。
 * @trace RFD-IT-029
 * @precondition 同BaseのWorkspace。
 * @stimulus 不一致内容、管理Path、改行名、明示不存在。
 * @observation 理由、Ref集合、固定Tree。
 * @oracle 不正は拒否、明示削除だけがTreeへ入る。
 * @cleanup fixtureのafter。
 * @boundary 実Git。
 */
test("固定は内容変更・管理Path・不正名を拒否し削除は明示入力に限定する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  const input = candidateInput(f, id);
  fs.writeFileSync(
    path.join(f.target(id), "source.txt"),
    "changed after confirmation\n",
  );
  assert.equal(
    freezeWorkspaceCandidate(f.capability, input).reason,
    "candidate_content_changed",
  );
  assert.equal(
    freezeWorkspaceCandidate(f.capability, {
      ...input,
      candidateName: "line\nbreak",
    }).reason,
    "candidate_input_invalid",
  );
  assert.equal(
    freezeWorkspaceCandidate(f.capability, {
      ...input,
      selection: [{ path: ".git/config", blobId: null, mode: null }],
    }).reason,
    "candidate_input_invalid",
  );
  assert.equal(validWorkspaceDisplayName(null), true);
  assert.equal(validWorkspaceDisplayName("改善"), true);
  for (const invalid of ["", " a", "\u2028", "x".repeat(121)])
    assert.equal(validWorkspaceDisplayName(invalid), false);
  fs.unlinkSync(path.join(f.target(id), "source.txt"));
  const deleted = freezeWorkspaceCandidate(f.capability, {
    ...input,
    selection: [{ path: "source.txt", blobId: null, mode: null }],
  });
  assert.equal(deleted.status, "completed", JSON.stringify(deleted));
  assert.ok(deleted.candidateCommit);
  assert.equal(
    git(f.root, ["ls-tree", "--name-only", deleted.candidateCommit]).includes(
      "source.txt",
    ),
    false,
  );
  assert.deepEqual(fs.readdirSync(path.dirname(f.target(id))), ["worktree"]);
});

/**
 * FF可能時も二親Mergeを残し、再入場と独立Ref回収を確認する。
 * @responsibility 名前snapshot・非衝突dirty保全・二重Merge拒否。
 * @trace RFD-IT-029
 * @precondition Base先端と固定候補、別fileの人間dirty。
 * @stimulus 明示Merge、同操作再入場、候補Ref回収。
 * @observation 親順序、Message、元dirty、他Branch。
 * @oracle 二親完全一致、名前保持、新Merge追加0。
 * @cleanup fixtureのafter。
 * @boundary 実Git、採否は試験側で明示。
 */
test("FF可能でも二親Mergeし名前を記録、dirty保全して二重取込しない", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "selected\n");
  const input = candidateInput(f, id);
  const fixed = freezeWorkspaceCandidate(f.capability, input);
  assert.equal(fixed.status, "completed", JSON.stringify(fixed));
  assert.ok(fixed.candidateCommit);
  fs.appendFileSync(path.join(f.root, ".gitignore"), "human-dirty\n");
  const index = fs.readFileSync(path.join(f.root, ".git", "index"));
  const target = {
    candidateCommit: fixed.candidateCommit,
    targetBranch: "main",
    expectedTargetHead: f.base,
  };
  const merged = mergeWorkspaceCandidate(f.capability, input, target);
  assert.equal(merged.status, "completed", JSON.stringify(merged));
  assert.ok(merged.mergeCommit);
  assert.equal(
    git(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]),
    `${merged.mergeCommit} ${f.base} ${fixed.candidateCommit}`,
  );
  const message = git(f.root, ["log", "-1", "--format=%B"]);
  assert.ok(message.includes("Merge Candidate: 選択した改善"));
  assert.ok(message.includes("Workspace: 継続作業"));
  assert.ok(message.includes(`Workspace-ID: ${id}`));
  assert.ok(
    fs
      .readFileSync(path.join(f.root, ".gitignore"), "utf8")
      .endsWith("human-dirty\n"),
  );
  assert.equal(
    mergeWorkspaceCandidate(f.capability, input, target).reason,
    "candidate_merge_existing",
  );
  assert.equal(
    mergeWorkspaceCandidate(f.capability, input, {
      ...target,
      expectedTargetHead: merged.mergeCommit,
    }).reason,
    "candidate_already_integrated",
  );
  assert.notDeepEqual(
    fs.readFileSync(path.join(f.root, ".git", "index")),
    index,
  );
  assert.equal(
    removeWorkspaceCandidate(f.capability, input, fixed.candidateCommit).status,
    "completed",
  );
  assert.equal(fs.existsSync(f.target(id)), true);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), merged.mergeCommit);
});

/**
 * 分岐Mergeと競合拒否、Ref改変時の削除0を確認する。
 * @responsibility 非正常条件を通常成功へ畳まない。
 * @trace RFD-IT-029
 * @precondition それぞれ新品の分岐fixture。
 * @stimulus 独立変更又は同file衝突、Ref差替え。
 * @observation Merge結果、元HEAD／index、候補Ref。
 * @oracle 分岐正常は二親、衝突は共有Tree不変、Ref差は削除0。
 * @cleanup fixtureのafter。
 * @boundary 実Gitのみ。
 */
test("分岐の通常MergeとConflict停止、Ref変更拒否を確認する", (t) => {
  for (const conflict of [false, true]) {
    const f = fixture(t);
    const id = randomUUID();
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    });
    fs.writeFileSync(path.join(f.target(id), "source.txt"), "candidate\n");
    const input = candidateInput(f, id);
    const fixed = freezeWorkspaceCandidate(f.capability, input);
    assert.ok(fixed.candidateCommit, JSON.stringify(fixed));
    assert.ok(fixed.candidateRef);
    fs.writeFileSync(
      path.join(f.root, conflict ? "source.txt" : "human.txt"),
      "target\n",
    );
    git(f.root, ["add", conflict ? "source.txt" : "human.txt"]);
    git(f.root, ["commit", "-m", "target branch"]);
    const head = git(f.root, ["rev-parse", "HEAD"]);
    const beforeIndex = fs.readFileSync(path.join(f.root, ".git", "index"));
    const merged = mergeWorkspaceCandidate(f.capability, input, {
      candidateCommit: fixed.candidateCommit,
      targetBranch: "main",
      expectedTargetHead: head,
    });
    if (conflict) {
      assert.equal(merged.reason, "candidate_conflict");
      assert.equal(git(f.root, ["rev-parse", "HEAD"]), head);
      assert.deepEqual(
        fs.readFileSync(path.join(f.root, ".git", "index")),
        beforeIndex,
      );
    } else {
      assert.equal(merged.status, "completed", JSON.stringify(merged));
      assert.equal(
        git(f.root, ["rev-list", "--parents", "-n", "1", "HEAD"]),
        `${merged.mergeCommit} ${head} ${fixed.candidateCommit}`,
      );
    }
    git(f.root, ["update-ref", fixed.candidateRef, head]);
    assert.equal(
      removeWorkspaceCandidate(f.capability, input, fixed.candidateCommit)
        .reason,
      "candidate_ref_mismatch",
    );
    assert.equal(git(f.root, ["rev-parse", fixed.candidateRef]), head);
  }
});

/**
 * 共有dirty非継承、linked起動、明示破棄と全不存在への再入場を確認する。
 * @responsibility 既存Treeと他Workspace保全、dirty等の削除許可を検証。
 * @trace RFD-IT-029
 * @precondition 固定Baseと二つのUUID。
 * @stimulus 作成、linkedから二件目作成、未採用変更を破棄。
 * @observation Tree内容、登録、専用Ref、元dirty。
 * @oracle 対象だけ消え、他作業は残る。
 * @cleanup fixtureのafter。
 * @boundary 実Git技術API、上位採否は代役。
 */
test("dirty共有Treeから独立作成し、明示破棄でWorktreeと未mergeBranchを残さない", (t) => {
  const f = fixture(t);
  const first = randomUUID();
  const second = randomUUID();
  fs.writeFileSync(path.join(f.root, "source.txt"), "human dirty\n");
  git(f.root, ["add", "source.txt"]);
  const originalIndex = fs.readFileSync(path.join(f.root, ".git", "index"));
  const created = createRepositoryWorktree(f.capability, {
    workspaceId: first,
    baseCommit: f.base,
  });
  assert.equal(created.status, "completed", JSON.stringify(created));
  assert.equal(
    fs.readFileSync(path.join(f.target(first), "source.txt"), "utf8"),
    "base\n",
  );
  const linked = verifyRepositoryRoot(f.target(first));
  assert.equal(linked.status, "completed");
  if (linked.status !== "completed") return;
  const other = createRepositoryWorktree(linked.capability, {
    workspaceId: second,
    baseCommit: f.base,
  });
  assert.equal(other.status, "completed", JSON.stringify(other));
  assert.equal(fs.existsSync(path.join(f.target(first), ".crdd")), false);
  fs.writeFileSync(
    path.join(f.target(first), "source.txt"),
    "rejected staged\n",
  );
  git(f.target(first), ["add", "source.txt"]);
  git(f.target(first), ["commit", "-m", "rejected commit"]);
  const head = git(f.target(first), ["rev-parse", "HEAD"]);
  fs.writeFileSync(
    path.join(f.target(first), "source.txt"),
    "rejected dirty\n",
  );
  fs.writeFileSync(path.join(f.target(first), "untracked.txt"), "untracked\n");
  fs.writeFileSync(path.join(f.target(first), "ignored.txt"), "generated\n");
  fs.writeFileSync(
    path.join(f.target(first), ".env"),
    "SYNTHETIC=not-a-credential\n",
  );
  const denied = disposeRepositoryWorktree(f.capability, {
    workspaceId: first,
    expectedHead: head,
  });
  assert.equal(denied.reason, "worktree_changes_not_discarded");
  assert.equal(denied.effectIssued, false);
  const disposed = disposeRepositoryWorktree(linked.capability, {
    workspaceId: first,
    expectedHead: head,
    discardChanges: true,
  });
  assert.equal(disposed.status, "completed", JSON.stringify(disposed));
  assert.equal(disposed.worktreeRemoved, true);
  assert.equal(disposed.branchRemoved, true);
  assert.equal(disposed.workspaceDirectoryRetained, false);
  assert.equal(fs.existsSync(path.dirname(f.target(first))), false);
  assert.equal(
    observeRepositoryWorktree(f.capability, first).observation?.branchHead,
    null,
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: first,
      expectedHead: head,
    }).status,
    "completed",
  );
  assert.equal(
    observeRepositoryWorktree(f.capability, second).observation?.registered,
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "human dirty\n",
  );
  assert.deepEqual(
    fs.readFileSync(path.join(f.root, ".git", "index")),
    originalIndex,
  );
  assert.equal(git(f.root, ["branch", "--show-current"]), "main");
  assert.equal(git(f.root, ["cat-file", "-t", head]), "commit");
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: second,
      expectedHead: f.base,
    }).status,
    "completed",
  );
});

/**
 * 採用取込後の不要WorktreeとBranchを回収する。
 * @responsibility 取込成果保全と親判断資料のOwner境界を検証。
 * @trace RFD-IT-029
 * @precondition 合成mainへfast-forward済み。
 * @stimulus 対象の明示終了。
 * @observation main内容、Refと親資料。
 * @oracle 採用成果・資料が残り、専用TreeとBranchは消える。
 * @cleanup fixtureのafter。
 * @boundary 採用判断は試験が代役、Git削除は製品API。
 */
test("採用取込後は成果をmainへ残し専用資源だけ削除する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "adopted\n");
  git(f.target(id), ["add", "source.txt"]);
  git(f.target(id), ["commit", "-m", "adopted"]);
  const head = git(f.target(id), ["rev-parse", "HEAD"]);
  git(f.root, ["merge", "--ff-only", `crdd/workspace/${id}`]);
  const record = path.join(path.dirname(f.target(id)), "merge-result.md");
  fs.writeFileSync(record, "synthetic adoption record\n");
  const result = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: head,
  });
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(result.workspaceDirectoryRetained, true);
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "adopted\n",
  );
  assert.equal(fs.existsSync(record), true);
  assert.equal(fs.existsSync(f.target(id)), false);
});

/**
 * 衝突・期待HEAD・lock・入れ子Git・祖先linkを拒否する。
 * @responsibility 明示破棄でも技術対象の確認を省略しない。
 * @trace RFD-IT-029
 * @precondition 自己生成Worktreeと別Repository。
 * @stimulus 不正ID、既存対象、lock、gitlink、入れ子Git。
 * @observation Effect発行なしと資源保持。
 * @oracle Direct通常Branch・別対象の破壊0。
 * @cleanup fixtureのafter。
 * @boundary 実Git／Filesystem。
 */
test("衝突・lock・別HEAD・入れ子Gitは明示破棄でも拒否する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: "../main",
      baseCommit: f.base,
    }).reason,
    "worktree_id_invalid",
  );
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: "main",
    }).effectIssued,
    false,
  );
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).reason,
    "worktree_target_exists",
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: "0".repeat(40),
      discardChanges: true,
    }).reason,
    "worktree_head_changed",
  );
  git(f.root, ["worktree", "lock", f.target(id)]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_locked",
  );
  git(f.root, ["worktree", "unlock", f.target(id)]);
  const nested = path.join(f.target(id), "nested");
  fs.mkdirSync(nested);
  git(nested, ["init", "--template="]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_nested_repository_unsupported",
  );
  fs.rmSync(nested, { recursive: true, force: true });
  git(f.target(id), [
    "update-index",
    "--add",
    "--cacheinfo",
    `160000,${f.base},module`,
  ]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_nested_repository_unsupported",
  );
  git(f.target(id), ["update-index", "--force-remove", "module"]);
  const moved = path.join(f.root, ".crdd", "moved");
  git(f.root, ["worktree", "move", f.target(id), moved]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_branch_in_use",
  );
  git(f.root, ["worktree", "move", moved, f.target(id)]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).status,
    "completed",
  );
  assert.equal(git(f.root, ["branch", "--show-current"]), "main");
});

/**
 * 実作成後の通知喪失とBranch削除失敗を同対象で再入場する。
 * @responsibility 過去のunknownを成功化せず現在状態から終了する。
 * @trace RFD-IT-029
 * @precondition 固定Gitの実処理に限定したProcess代役。
 * @stimulus 作成実行後timeout、Worktree除去後Ref失敗。
 * @observation 返却段階と実Git登録・Ref。
 * @oracle 同IDで再観測・回収、別ID再試行なし。
 * @cleanup Process差替えを必ず復元しfixture回収。
 * @boundary 実Git＋失敗通知代役。実時間timeoutの実証ではない。
 */
test("部分作成とWorktree削除後のBranch失敗は同じ対象で収束する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    const result = Reflect.apply(original, childProcess, args);
    if (
      Array.isArray(args[1]) &&
      args[1].includes("add") &&
      args[1].includes("worktree")
    )
      return {
        ...result,
        error: Object.assign(new Error("synthetic timeout"), {
          code: "ETIMEDOUT",
        }),
      };
    return result;
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  const created = createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  assert.equal(created.reason, "worktree_git_outcome_unknown");
  assert.equal(created.effectIssued, true);
  assert.equal(created.workspaceId, id);
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  assert.equal(
    observeRepositoryWorktree(f.capability, id).observation?.registered,
    true,
  );
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    if (Array.isArray(args[1]) && args[1].includes("update-ref"))
      return {
        pid: 0,
        output: [],
        stdout: "",
        stderr: "synthetic",
        status: 1,
        signal: null,
      };
    return Reflect.apply(original, childProcess, args);
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  const disposed = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  assert.equal(disposed.reason, "worktree_branch_remove_failed");
  assert.equal(disposed.worktreeRemoved, true);
  assert.equal(disposed.branchRemoved, null);
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  const middle = observeRepositoryWorktree(f.capability, id);
  assert.deepEqual(middle.observation, {
    registered: false,
    directoryPresent: false,
    branchHead: f.base,
    head: null,
    locked: false,
    prunable: false,
    dirty: null,
  });
  const retried = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  assert.equal(retried.status, "completed", JSON.stringify(retried));
  assert.equal(retried.branchRemoved, true);
});

/**
 * 外部filter設定を拒否し、checkout hookを起動しない。
 * @responsibility 版展開は読取りdiffと別境界として反証する。
 * @trace RFD-IT-029
 * @precondition 無害なmarkerの発火対照。
 * @stimulus post-checkout hookとsmudge設定。
 * @observation markerとAPI結果。
 * @oracle 対照は発火、本番は非発火／要求前拒否。
 * @cleanup fixtureのafter。
 * @boundary 実Gitと合成shell hookのみ。外部通信なし。
 */
test("checkout hookを抑止しclean・smudge・process設定を拒否する", (t) => {
  const f = fixture(t);
  const marker = path.join(f.root, ".crdd", "hook-marker");
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  const hook = path.join(f.root, ".git", "hooks", "post-checkout");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(
    hook,
    `#!/bin/sh\nprintf fired > '${marker.replaceAll("\\", "/")}'\n`,
    { mode: 0o755 },
  );
  git(f.root, ["checkout", "main"], true);
  assert.equal(fs.existsSync(marker), true);
  fs.unlinkSync(marker);
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  assert.equal(fs.existsSync(marker), false);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
    }).status,
    "completed",
  );
  for (const type of ["clean", "smudge", "process"]) {
    git(f.root, ["config", `filter.synthetic.${type}`, "must-not-execute"]);
    const result = createRepositoryWorktree(f.capability, {
      workspaceId: randomUUID(),
      baseCommit: f.base,
    });
    assert.equal(result.reason, "worktree_external_filter_unsupported");
    assert.equal(result.effectIssued, false);
    git(f.root, ["config", "--unset", `filter.synthetic.${type}`]);
  }
  // 実checkoutがsmudgeを起動する対照を作り、本番拒否の根拠とする。
  fs.writeFileSync(
    path.join(f.root, ".gitattributes"),
    "source.txt filter=synthetic\n",
  );
  git(f.root, ["add", ".gitattributes"]);
  git(f.root, ["commit", "-m", "attribute"]);
  const current = git(f.root, ["rev-parse", "HEAD"]);
  const filterMarker = path.join(f.root, ".crdd", "filter-marker");
  const script = path.join(f.root, ".crdd", "filter.ts");
  fs.writeFileSync(
    script,
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(filterMarker)}, 'fired'); process.stdout.write(fs.readFileSync(0));`,
  );
  git(f.root, [
    "config",
    "filter.synthetic.smudge",
    `"${process.execPath.replaceAll("\\", "/")}" "${script.replaceAll("\\", "/")}"`,
  ]);
  const control = path.join(f.root, ".crdd", "control");
  git(f.root, ["worktree", "add", "--detach", control, current]);
  assert.equal(fs.existsSync(filterMarker), true);
  fs.unlinkSync(filterMarker);
  const rejected = createRepositoryWorktree(f.capability, {
    workspaceId: randomUUID(),
    baseCommit: current,
  });
  assert.equal(rejected.reason, "worktree_external_filter_unsupported");
  assert.equal(rejected.effectIssued, false);
  assert.equal(fs.existsSync(filterMarker), false);
  git(f.root, ["worktree", "remove", "--force", control]);
});

/**
 * 祖先junction／symlinkと既存Branchは衝突として停止する。
 * @responsibility 別Pathへの作成・削除0を実Filesystemで反証する。
 * @trace RFD-IT-029
 * @precondition 自己生成Directory間のlink。
 * @stimulus workspaces祖先差替えと専用Branchだけの残存。
 * @observation blocked、marker、Ref。
 * @oracle link先非変更、既存Branch非変更。
 * @cleanup fixtureのafter。
 * @boundary ローカル合成Filesystemのみ。
 */
test("祖先linkと既存Branchを上書きしない", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  fs.mkdirSync(path.join(f.root, ".crdd"));
  const elsewhere = path.join(f.root, "elsewhere");
  fs.mkdirSync(elsewhere);
  const link = path.join(f.root, ".crdd", "workspaces");
  fs.symlinkSync(
    elsewhere,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  assert.equal(linked.reason, "worktree_path_invalid");
  assert.equal(linked.effectIssued, false);
  assert.deepEqual(fs.readdirSync(elsewhere), []);
  fs.unlinkSync(link);
  git(f.root, ["branch", `crdd/workspace/${id}`, f.base]);
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).reason,
    "worktree_target_exists",
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
    }).status,
    "completed",
  );
});

/**
 * Base gitlink、ignoredのみ、削除直前dirty化を個別に反証する。
 * @responsibility 同時刺激で隠れる拒否条件を独立Oracleにする。
 * @trace RFD-IT-029
 * @precondition 各刺激前は条件外のclean状態。
 * @stimulus gitlink Base、ignored一件、二観測間の合成変更。
 * @observation Effect発行、remove要求数、元内容とRef。
 * @oracle 各拒否と対象保全。直前dirtyではremove要求0。
 * @cleanup Process差替え復元、自己生成fixture回収。
 * @boundary 実Gitと二観測間の変更を発生させる代役。
 */
test("Base gitlinkとignored残存と削除直前dirtyを個別に拒否する", (t) => {
  const f = fixture(t);
  const invalidId = randomUUID();
  git(f.root, [
    "update-index",
    "--add",
    "--cacheinfo",
    `160000,${f.base},module`,
  ]);
  git(f.root, ["commit", "-m", "gitlink base"]);
  const gitlinkBase = git(f.root, ["rev-parse", "HEAD"]);
  const rejectedBase = createRepositoryWorktree(f.capability, {
    workspaceId: invalidId,
    baseCommit: gitlinkBase,
  });
  assert.equal(rejectedBase.reason, "worktree_nested_repository_unsupported");
  assert.equal(rejectedBase.effectIssued, false);
  assert.equal(fs.existsSync(path.dirname(f.target(invalidId))), false);
  assert.equal(
    observeRepositoryWorktree(f.capability, invalidId).observation?.branchHead,
    null,
  );
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  const ignored = path.join(f.target(id), "ignored.txt");
  fs.writeFileSync(ignored, "keep until explicit discard\n");
  const refused = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  assert.equal(refused.reason, "worktree_changes_not_discarded");
  assert.equal(refused.effectIssued, false);
  assert.equal(
    fs.readFileSync(ignored, "utf8"),
    "keep until explicit discard\n",
  );
  fs.unlinkSync(ignored);
  const original = childProcess.spawnSync;
  let statusCount = 0;
  let removes = 0;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    if (Array.isArray(args[1]) && args[1].includes("remove")) removes++;
    const result = Reflect.apply(original, childProcess, args);
    if (
      Array.isArray(args[1]) &&
      args[1].includes("status") &&
      ++statusCount === 1
    )
      fs.writeFileSync(ignored, "late ignored\n");
    return result;
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  const late = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  assert.equal(statusCount, 2);
  assert.equal(removes, 0);
  assert.equal(late.reason, "worktree_changes_not_discarded");
  assert.equal(late.effectIssued, false);
  assert.equal(fs.readFileSync(ignored, "utf8"), "late ignored\n");
  assert.equal(
    observeRepositoryWorktree(f.capability, id).observation?.registered,
    true,
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).status,
    "completed",
  );
});
