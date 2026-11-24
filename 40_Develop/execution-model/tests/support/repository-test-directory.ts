/**
 * Repository-localの試験Directoryと回復入力を準備する。
 *
 * @packageDocumentation
 * @responsibility 自己生成Rootの作成・清掃を同じ実体へ結合し、回復試験へ保存先と同期確認を渡す。
 * @trace PRL-IT-013
 * @trace ERP-IT-001
 * @trace EST-IT-004
 * @trace ERB-IT-014
 * @level IT
 * @scope Repository-local試験のFilesystem準備、清掃、回復入力。
 * @boundary ディレクトリ操作は検証済みRepositoryの.crdd/tests直下だけ。回復入力は自己生成した試験Repositoryだけ。
 */
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";

/**
 * 確定済み試験ディレクトリと呼出し元の再確認を回復入力にする。
 * @trace ERB-IT-014
 * @precondition Caseが生成した絶対ディレクトリだけを渡す。
 * @boundary 回復Writerの入力。Git配置や改訂を解決しない。
 */
export function prepareFixtureRecovery(
  input: unknown,
  observeCurrent: () => boolean = () => true,
) {
  const value = (source: unknown, name: string): unknown => {
    if (!source || typeof source !== "object" || types.isProxy(source))
      return undefined;
    const field = Object.getOwnPropertyDescriptor(source, name);
    return field && "value" in field ? field.value : undefined;
  };
  const days = value(input, "historyRetentionDays");
  const directory = days === undefined ? input : value(input, "root");
  if (typeof directory !== "string" || !path.isAbsolute(directory)) return null;
  const retain = value(input, "revalidate");
  return {
    purpose: "recovery" as const,
    root: { directory },
    historyRetentionDays: typeof days === "number" ? days : null,
    revalidate(expected?: number) {
      return (
        (expected === undefined ||
          (typeof retain === "function" && retain(expected) === true)) &&
        observeCurrent()
      );
    },
  };
}

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
  const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
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
