/**
 * 回復試験の一時Directoryを現在Repositoryへ限定する。
 *
 * @packageDocumentation
 * @responsibility 自己生成Rootの作成・清掃を同じ実体へ結合する。
 * @trace PRL-IT-013
 * @trace ERP-IT-001
 * @trace EST-IT-004
 * @level IT
 * @scope 回復試験のFilesystem準備と清掃
 * @boundary 検証済みRepositoryの.crdd/tests直下だけ。
 */
import fs from "node:fs";
import path from "node:path";
import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";

/**
 * Repository内へ一意な試験Rootと同実体限定の清掃操作を作る。
 *
 * @responsibility CWD・OS一時領域に依存せず作成と清掃の対象を固定する。
 * @trace PRL-IT-013
 * @trace ERP-IT-001
 * @trace EST-IT-004
 * @precondition 本Supportが検証可能なRepositoryのtests/supportに存在する。
 * @stimulus 固定basenameのprefixを指定する。
 * @observation 各祖先と生成Rootの実Path・実体、清掃後のENOENTを確認する。
 * @oracle 不正prefix・境界不明は作成0、実体差替えは削除0で拒否する。
 * @cleanup 呼出し元がcleanupを呼ぶ。拒否時は対象を保持し、共有基底は削除しない。
 * @boundary 試験用Filesystemのみ。製品の回復Authorityを発行しない。
 */
export function createRepositoryTestDirectory(prefix: string) {
  if (!/^[a-z][a-z0-9-]{0,79}-$/u.test(prefix))
    throw new Error("testing_directory_prefix_invalid");
  const candidate = path.resolve(import.meta.dirname, "../../../..");
  const verified = verifyRepositoryRoot(candidate);
  const repositoryRoot =
    verified.status === "completed"
      ? resolveVerifiedRepositoryRoot(verified.capability)
      : null;
  if (!repositoryRoot || repositoryRoot !== fs.realpathSync.native(candidate))
    throw new Error("testing_repository_root_invalid");
  const ancestors = [
    repositoryRoot,
    path.join(repositoryRoot, ".crdd"),
    path.join(repositoryRoot, ".crdd", "tests"),
  ];
  const identities = ancestors.map((directory, index) => {
    try {
      fs.lstatSync(directory);
    } catch (error) {
      if (
        index === 0 ||
        !(error instanceof Error) ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
      fs.mkdirSync(directory);
    }
    const identity = fs.lstatSync(directory, { bigint: true });
    if (
      !identity.isDirectory() ||
      identity.isSymbolicLink() ||
      fs.realpathSync.native(directory) !== directory
    )
      throw new Error("testing_directory_boundary_invalid");
    return identity;
  });
  const parent = ancestors[2] as string;
  const root = fs.mkdtempSync(path.join(parent, prefix));
  const identity = fs.lstatSync(root, { bigint: true });
  if (
    path.dirname(root) !== parent ||
    !path.basename(root).startsWith(prefix) ||
    !identity.isDirectory() ||
    identity.isSymbolicLink() ||
    fs.realpathSync.native(root) !== root
  )
    throw new Error("testing_directory_boundary_invalid");

  return Object.freeze({
    path: root,
    cleanup: () => {
      for (const [index, directory] of [...ancestors, root].entries()) {
        const expected =
          index < identities.length ? identities[index] : identity;
        const current = fs.lstatSync(directory, { bigint: true });
        if (
          !expected ||
          !current.isDirectory() ||
          current.isSymbolicLink() ||
          current.dev !== expected.dev ||
          current.ino !== expected.ino ||
          current.birthtimeNs !== expected.birthtimeNs ||
          fs.realpathSync.native(directory) !== directory
        )
          throw new Error("testing_directory_identity_changed");
      }
      fs.rmSync(root, { recursive: true, force: false });
      try {
        fs.lstatSync(root);
      } catch (error) {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        )
          return;
        throw error;
      }
      throw new Error("testing_directory_cleanup_unconfirmed");
    },
  });
}
