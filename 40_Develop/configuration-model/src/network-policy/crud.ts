/**
 * 選択Repositoryの現在の追加通信設定だけを読み取る。
 * @responsibility 固定Path・実体・不存在と障害を確認する。
 * @trace ARCH-000011
 */

import type { NetworkPolicyReadResult } from "./types.ts";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Repository } from "../../../version-control/src/index.ts";
import {
  DEFAULT_NETWORK_POLICY,
  parseNetworkPolicyDocument,
} from "./validation.ts";
import { configurationPaths } from "../storage/store.ts";
import { readStableFileSnapshot } from "../storage/store.ts";

/**
 * 検証済みRootの現在設定を一回固定する。
 * @responsibility 親chain・nlink・開いたFile・Rootの前後同一性を確認する。
 * @trace ARCH-000011
 * @input capability: 発行済みRepository Root。
 * @returns 不変設定・由来または固定停止理由。
 * @precondition 選択Repositoryの能力を渡す。
 * @postcondition 別Repositoryの値をCache・継承しない。
 * @effect 固定PathのmetadataとFileを読み、descriptorを閉じる。書込みは0。
 * @failure 不正内容はinvalid、読取り・実体確認不能はunavailable。
 * @invariant 不在だけ既定値。設定の取得は利用許可ではない。
 * @boundary 検証済みRepository内のconfigだけ。
 * @security Link・hardlink・差替え・任意Path入力を拒否する。
 * @concurrency 観測後の変更を返却済みSnapshotへ反映しない。
 */
export function readNetworkPolicy(
  capability: Repository,
): NetworkPolicyReadResult {
  try {
    const paths = configurationPaths(capability);
    if (!paths) throw new Error("root");
    const parents: { file: string; stat: fs.BigIntStats }[] = [];
    let missing: string | null = null;
    for (const file of [paths.root, paths.config]) {
      try {
        const stat = fs.lstatSync(file, { bigint: true });
        if (
          !stat.isDirectory() ||
          stat.isSymbolicLink() ||
          fs.realpathSync.native(file) !== file
        )
          throw new Error("parent");
        parents.push({ file, stat });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        missing = file;
        break;
      }
    }
    const file = path.join(paths.config, "network-policy.json");
    let before: fs.BigIntStats | null = null;
    if (missing === null) {
      try {
        before = fs.lstatSync(file, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        missing = file;
      }
    }
    let policy = DEFAULT_NETWORK_POLICY;
    let sourceFileHash: string | null = null;
    if (before) {
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n)
        throw new Error("file");
      if (before.size === 0n)
        return Object.freeze({
          status: "blocked",
          reason: "network_policy_invalid",
        });
      const snapshot = readStableFileSnapshot(file);
      const after = fs.lstatSync(file, { bigint: true });
      if (
        after.nlink !== 1n ||
        after.dev !== before.dev ||
        after.ino !== before.ino ||
        after.birthtimeNs !== before.birthtimeNs ||
        after.ctimeNs !== before.ctimeNs ||
        after.mtimeNs !== before.mtimeNs ||
        after.size !== before.size
      )
        throw new Error("changed");
      let decoded: string;
      try {
        decoded = new TextDecoder("utf-8", { fatal: true }).decode(
          snapshot.bytes,
        );
      } catch {
        return Object.freeze({
          status: "blocked",
          reason: "network_policy_invalid",
        });
      }
      const parsed = parseNetworkPolicyDocument(decoded);
      if (!parsed)
        return Object.freeze({
          status: "blocked",
          reason: "network_policy_invalid",
        });
      policy = parsed;
      sourceFileHash = createHash("sha256")
        .update(snapshot.bytes)
        .digest("hex");
    } else {
      if (missing === null) throw new Error("missing");
      try {
        fs.lstatSync(missing);
        throw new Error("appeared");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    for (const { file: parent, stat } of parents) {
      const after = fs.lstatSync(parent, { bigint: true });
      if (
        !after.isDirectory() ||
        after.isSymbolicLink() ||
        after.dev !== stat.dev ||
        after.ino !== stat.ino ||
        after.birthtimeNs !== stat.birthtimeNs ||
        fs.realpathSync.native(parent) !== parent
      )
        throw new Error("parent_changed");
    }
    if (configurationPaths(capability)?.repositoryRoot !== paths.repositoryRoot)
      throw new Error("root_changed");
    return sourceFileHash === null
      ? Object.freeze({
          status: "ready",
          source: "default",
          policy,
          sourceFileHash: null,
        })
      : Object.freeze({
          status: "ready",
          source: "file",
          policy,
          sourceFileHash,
        });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "network_policy_unavailable",
    });
  }
}
