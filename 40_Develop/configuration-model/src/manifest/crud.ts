/**
 * Repository Manifestの固定配置と検証済み読取りを所有する。
 * @responsibility 同じ読取り本文から宣言と非Authorityの内容Identityを返す。
 * @trace ARCH-000011
 * @boundary 検証済みRepository内の固定config。読取りのみで作成・認可は行わない。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  configurationPaths,
  readStableFileSnapshot,
} from "../storage/store.ts";
import { inspectRepositoryManifest } from "./validation.ts";
import type { RepositoryManifestReadResult } from "./types.ts";

export const REPOSITORY_MANIFEST_RELATIVE_PATH =
  ".crdd/config/repository-manifest.json" as const;
export const EXTERNAL_SEND_POLICY_RELATIVE_PATH =
  ".crdd/config/external-send-policy.json" as const;

/**
 * 固定Manifestだけを読み、真正不存在・不正内容・観測不能を分離する。
 * @responsibility 親とFileの前後実体、EOF、UTF-8、既存Schemaを確認する。
 * @trace ARCH-000011
 * @input repository: VCが発行したRepository。
 * @returns readyはManifestとUTF-8復号本文のSHA256、その他は閉じた停止理由。
 * @precondition 利用許可と処置直前の再確認は呼出し元が所有する。
 * @postcondition 同じ読取りの値とHashだけを返し、状態をcacheしない。
 * @effect 読取りdescriptorを開閉するだけ。Directory・File・Lockを作成しない。
 * @failure ENOENTだけmissing、途中変更・close失敗・観測不能はblocked。
 * @invariant 旧UTF-8置換読取り・JSON.parse・既存宣言検査の受理条件を維持する。
 * @security Path・生本文・例外・認可を結果へ含めない。
 * @concurrency 観測後の変更は利用側が同じ入口を再読取りして確認する。
 */
export function readRepositoryManifest(
  repository: Repository,
): RepositoryManifestReadResult {
  try {
    const paths = configurationPaths(repository);
    if (!paths) throw new Error("root");
    const parents: { file: string; stat: fs.BigIntStats }[] = [];
    const unchanged = () => {
      for (const { file, stat } of parents) {
        const after = fs.lstatSync(file, { bigint: true });
        if (
          !after.isDirectory() ||
          after.isSymbolicLink() ||
          after.dev !== stat.dev ||
          after.ino !== stat.ino ||
          after.birthtimeNs !== stat.birthtimeNs ||
          fs.realpathSync.native(file) !== file
        )
          throw new Error("parent_changed");
      }
      if (
        configurationPaths(repository)?.repositoryRoot !== paths.repositoryRoot
      )
        throw new Error("root_changed");
    };
    const absent = (file: string): RepositoryManifestReadResult => {
      try {
        fs.lstatSync(file);
        throw new Error("appeared");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      unchanged();
      return Object.freeze({
        status: "missing",
        reason: "repository_manifest_missing",
      });
    };
    for (const file of [paths.repositoryRoot, paths.root, paths.config]) {
      let stat: fs.BigIntStats;
      try {
        stat = fs.lstatSync(file, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return absent(file);
        throw error;
      }
      if (
        !stat.isDirectory() ||
        stat.isSymbolicLink() ||
        fs.realpathSync.native(file) !== file
      )
        throw new Error("parent");
      parents.push({ file, stat });
    }
    const file = path.join(paths.config, "repository-manifest.json");
    let before: fs.BigIntStats;
    try {
      before = fs.lstatSync(file, { bigint: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return absent(file);
      throw error;
    }
    if (!before.isFile() || before.isSymbolicLink()) throw new Error("file");
    if (before.size === 0n) {
      unchanged();
      return Object.freeze({
        status: "blocked",
        reason: "repository_manifest_invalid",
      });
    }
    const snapshot = readStableFileSnapshot(file);
    const after = fs.lstatSync(file, { bigint: true });
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    )
      throw new Error("changed");
    unchanged();
    const source = snapshot.bytes.toString("utf8");
    let manifest: ReturnType<typeof inspectRepositoryManifest> = null;
    try {
      manifest = inspectRepositoryManifest(JSON.parse(source));
    } catch {
      manifest = null;
    }
    if (!manifest)
      return Object.freeze({
        status: "blocked",
        reason: "repository_manifest_invalid",
      });
    return Object.freeze({
      status: "ready",
      manifest,
      identity: createHash("sha256").update(source).digest("hex"),
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "repository_manifest_unavailable",
    });
  }
}
