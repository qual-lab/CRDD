/**
 * 所属Repositoryと借用する実行Treeを照合する。
 * @responsibility 短命な操作結合と固定保護Mountの材料だけを保持する。
 * @trace ARCH-000004 ARCH-000008
 * @boundary 永続WorkspaceのOwnerはOrchestrator。削除・Git更新は行わない。
 */
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import { checkRepositoryRuntimeDataProtectionDirectory } from "../../../domain-model/src/index.ts";
import {
  verifyRepositoryRoot,
  inspectGitRepositoryLayoutCandidate,
} from "../../../version-control/src/index.ts";
import { inspectRepositoryIdentityCandidate } from "../../../version-control/src/index.ts";
import { verifyOwnedOperationManagementMountBinding } from "./operation.ts";

/**
 * 借用先の内部入力を表す。
 * @responsibility 上位が解決した所属Root、実行先、期待改訂を受け取る。
 * @trace ARCH-000004
 * @shape workspaceIdは上位の非Authority相関値。実行先は実PathとGit同一性で検査する。
 * @invariant PathやIDだけでは実行許可にならない。
 * @boundary Orchestratorから単発実行への内部入力。
 * @security 外部SurfaceへHost Pathを返さない。
 * @compatibility 旧複製入口とは明示的に区別する。
 */
export type BorrowedExecutionTarget = Readonly<{
  workspaceId: string | null;
  ownerRepositoryRoot: string;
  executionTree: string;
  baseCommit: string | null;
  head: string | null;
}>;

/**
 * 一つの実行中Operationに限る借用対象を保持する。
 * @responsibility 元Treeの同一性と自己所有の保護Mount材料を結合する。
 * @trace ARCH-000004
 * @shape 対象、Filesystem同一性、二つの空placeholder。
 * @invariant 永続状態と清掃所有集合を追加しない。
 * @boundary Operation内だけ。
 * @security Host Pathは公開しない。
 * @compatibility 新Workspace入口の短命データ。
 */
type BorrowedBinding = Readonly<{
  target: BorrowedExecutionTarget;
  dev: number;
  ino: number;
  protection: Readonly<{ gitSourcePath: string; internalSourcePath: string }>;
}>;
const borrowed = new WeakMap<object, BorrowedBinding>();
const commit = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

/**
 * 実行前の対象を読取りだけで検証する。
 * @responsibility arbitrary Path・不明なGit所属・HEAD差を拒否する。
 * @trace ARCH-000004
 * @input ownerRootと内部対象。
 * @returns 固定した対象又はnull。
 * @precondition 上位が既存の利用調停を保持する。
 * @postcondition dirtyを消さず、Sourceを書き換えない。
 * @effect GitとFilesystemの読取りのみ。
 * @failure 欠測・link・別HEAD・別Rootはnull。
 * @invariant 新しいRegistry・排他・回復を生成しない。
 * @boundary Owner Rootと実行Tree。
 * @security getter・Proxyを評価しない。
 * @concurrency 呼出しの都度freshに検証する。
 */
export function inspectBorrowedExecutionTarget(
  ownerRoot: unknown,
  raw: unknown,
): BorrowedExecutionTarget | null {
  try {
    if (
      typeof ownerRoot !== "string" ||
      !raw ||
      typeof raw !== "object" ||
      types.isProxy(raw) ||
      Array.isArray(raw)
    )
      return null;
    const keys = [
      "workspaceId",
      "ownerRepositoryRoot",
      "executionTree",
      "baseCommit",
      "head",
    ] as const;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (
      Reflect.ownKeys(raw).length !== keys.length ||
      keys.some(
        (key) => !descriptors[key] || !Object.hasOwn(descriptors[key], "value"),
      )
    )
      return null;
    const target = Object.fromEntries(
      keys.map((key) => [key, descriptors[key]?.value]),
    ) as BorrowedExecutionTarget;
    if (
      target.ownerRepositoryRoot !== ownerRoot ||
      typeof target.executionTree !== "string"
    )
      return null;
    const root = verifyRepositoryRoot(ownerRoot);
    const layout = inspectGitRepositoryLayoutCandidate({
      repositoryRoot: ownerRoot,
    });
    if (
      root.status !== "completed" ||
      layout.status !== "candidate" ||
      layout.layout?.kind === "linked_worktree"
    )
      return null;
    // Workspace IDは上位の相関値だけ。配置検索・方式選択には使わない。
    if (
      !(
        target.workspaceId === null || typeof target.workspaceId === "string"
      ) ||
      !(
        target.baseCommit === null ||
        (typeof target.baseCommit === "string" &&
          commit.test(target.baseCommit))
      ) ||
      !(
        target.head === null ||
        (typeof target.head === "string" && commit.test(target.head))
      )
    )
      return null;
    const executionLayout = inspectGitRepositoryLayoutCandidate({
      repositoryRoot: target.executionTree,
    });
    const identity = inspectRepositoryIdentityCandidate(target.executionTree);
    const ownerIdentity = inspectRepositoryIdentityCandidate(ownerRoot);
    if (
      executionLayout.status !== "candidate" ||
      !executionLayout.layout ||
      !layout.layout ||
      !ownerIdentity ||
      identity?.logicalRepositoryIdentity !==
        ownerIdentity.logicalRepositoryIdentity ||
      !identity ||
      (target.head !== null && identity.commit !== target.head) ||
      (target.executionTree !== ownerRoot && target.head === null) ||
      (target.executionTree !== ownerRoot &&
        !target.executionTree.startsWith(ownerRoot + path.sep))
    )
      return null;
    const tree = fs.lstatSync(target.executionTree);
    const git = fs.lstatSync(path.join(target.executionTree, ".git"));
    if (
      !tree.isDirectory() ||
      tree.isSymbolicLink() ||
      fs.realpathSync.native(target.executionTree) !== target.executionTree ||
      git.isSymbolicLink() ||
      !(git.isDirectory() || git.isFile())
    )
      return null;
    const executionRoot = verifyRepositoryRoot(target.executionTree);
    if (
      executionRoot.status !== "completed" ||
      checkRepositoryRuntimeDataProtectionDirectory(
        executionRoot.capability,
        "observe",
      ) === "blocked"
    )
      return null;
    return Object.freeze(target);
  } catch {
    return null;
  }
}

/**
 * 元Operationへ借用対象と自己所有placeholderを短期結合する。
 * @responsibility 清掃先を変更せず、Provider用実行先だけを提供する。
 * @trace ARCH-000004 ARCH-000008
 * @input 正真正の管理・Mount参照と検証対象。
 * @returns 対象又はnull。
 * @precondition 通常Sourceの走査が別途成立する。
 * @postcondition 借用TreeをOperationの所有集合へ登録しない。
 * @effect Operation所有projection内に空placeholderを作る。
 * @failure 不明な対象・既存placeholder・作成失敗は拒否。
 * @invariant Workspaceの作成・削除・Git変更なし。
 * @boundary Host一時物と借用Tree。
 * @security 認証Homeや共有GitをMountしない。
 * @concurrency 既存Operation一件に一対象。
 */
export function bindBorrowedExecutionTarget(
  management: object,
  mount: object,
  ownerRoot: string,
  raw: unknown,
) {
  const target = inspectBorrowedExecutionTarget(ownerRoot, raw);
  if (!target || borrowed.has(management)) return null;
  const binding = verifyOwnedOperationManagementMountBinding(management, mount);
  // 空のMount先だけを初期化する。状態・履歴をこのTreeへ保存しない。
  const executionRoot = verifyRepositoryRoot(target.executionTree);
  if (
    executionRoot.status !== "completed" ||
    checkRepositoryRuntimeDataProtectionDirectory(
      executionRoot.capability,
      "prepare",
    ) !== "ready"
  )
    return null;
  const directory = path.join(binding.mounts.projection, "workspace-masks");
  fs.mkdirSync(directory);
  const gitSourcePath = path.join(directory, "git");
  const internalSourcePath = path.join(directory, "internal");
  if (fs.lstatSync(path.join(target.executionTree, ".git")).isDirectory())
    fs.mkdirSync(gitSourcePath);
  else fs.writeFileSync(gitSourcePath, "", { flag: "wx" });
  fs.mkdirSync(internalSourcePath);
  const metadata = fs.lstatSync(target.executionTree);
  borrowed.set(
    management,
    Object.freeze({
      target,
      dev: metadata.dev,
      ino: metadata.ino,
      protection: Object.freeze({ gitSourcePath, internalSourcePath }),
    }),
  );
  return target;
}

/**
 * Provider使用直前に同じ借用対象を再観測する。
 * @responsibility 旧一時workspaceへ戻らず、元実体とGit相関を確認する。
 * @trace ARCH-000004
 * @input 元管理参照。
 * @returns 未結合はnull、失効は例外、結合済みは内部対象。
 * @precondition 管理参照の生存は呼出し元が別途確認する。
 * @postcondition Pathや新しい実体で古い結合を上書きしない。
 * @effect Filesystem／Git読取り。
 * @failure 失効・観測不能はthrow。
 * @invariant 保存Root・削除集合を変更しない。
 * @boundary CoordinatorからProvider計画。
 * @security 所在は内部だけで使う。
 * @concurrency キャッシュだけで実行へ進まない。
 */
export function readBorrowedExecutionBinding(
  management: object,
  verifyProtection = false,
) {
  const record = borrowed.get(management);
  if (!record) return null;
  const target = inspectBorrowedExecutionTarget(
    record.target.ownerRepositoryRoot,
    record.target,
  );
  const stat = target ? fs.lstatSync(target.executionTree) : null;
  if (!target || stat?.dev !== record.dev || stat.ino !== record.ino)
    throw new Error("coordinator_workspace_target_changed");
  if (verifyProtection) {
    const git = fs.lstatSync(record.protection.gitSourcePath);
    const internal = fs.lstatSync(record.protection.internalSourcePath);
    const targetGit = fs.lstatSync(path.join(target.executionTree, ".git"));
    if (
      git.isSymbolicLink() ||
      internal.isSymbolicLink() ||
      git.isDirectory() !== targetGit.isDirectory() ||
      (git.isDirectory()
        ? fs.readdirSync(record.protection.gitSourcePath).length !== 0
        : !git.isFile() || git.size !== 0) ||
      !internal.isDirectory() ||
      fs.readdirSync(record.protection.internalSourcePath).length !== 0
    )
      throw new Error("coordinator_workspace_protection_changed");
  }
  return record;
}
