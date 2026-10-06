/**
 * Repository固有のツール設定を読取り専用で収集する。
 * @responsibility 設定の閉じた値契約と安全な読取りを所有し、削除判断は所有しない。
 * @trace ARCH-000011
 */
import fs from "node:fs";
import path from "node:path";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-location.ts";
import { resolveRepositoryRuntimeDataPathsForInternalUse } from "./runtime-data-path-resolver.ts";

const DAY_MS = 86_400_000;

/**
 * 一つのツール所有者の期間設定を固定する。
 * @responsibility 非秘密の期間だけを収集する。
 * @trace ARCH-000011
 * @shape schemaRevisionとhistoryRetentionDays。
 * @invariant 期間は正の安全な整数でミリ秒変換できる。
 * @boundary Repository設定。
 * @security AuthorityやPathを含めない。
 * @compatibility 設定File不存在だけ30日、存在するFileは全Property必須。
 */
export type ToolRuntimeConfig = Readonly<{
  schemaRevision: 1;
  historyRetentionDays: number;
}>;

/**
 * 設定の観測成功と停止を区別する。
 * @responsibility 不正設定を既定値へ畳まない。
 * @trace ARCH-000011
 * @shape readyはsourceとconfig、blockedはreason。
 * @invariant blockedは期間を返さない。
 * @boundary 設定読取りの公開結果。
 * @security 設定本文とPathを失敗理由へ複製しない。
 * @compatibility 不存在だけがdefaultとなる。
 */
export type ToolRuntimeConfigResult =
  | Readonly<{
      status: "ready";
      source: "default" | "file";
      config: ToolRuntimeConfig;
    }>
  | Readonly<{ status: "blocked"; reason: "tool_runtime_config_invalid" }>;

/**
 * Propertyの過不足を拒否する。
 * @responsibility JSON値の閉集合を確認する。
 * @trace ARCH-000011
 * @input JSON値と必須Property集合。
 * @returns 検証済みObject。
 * @precondition 未検証のJSON値。
 * @postcondition 全Keyが一致する。
 * @effect N/A: 局所値のみ。
 * @failure 不一致で例外。
 * @invariant 未知Propertyを無視しない。
 * @boundary JSON入力。
 * @security 許可外設定を採用しない。
 * @concurrency N/A: 同期処理。
 */
function closed(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("shape");
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !==
    JSON.stringify([...keys].sort())
  )
    throw new Error("keys");
  return record;
}

/**
 * 期間を安全なミリ秒へ変換できる正整数として確認する。
 * @responsibility 数値の意味を固定する。
 * @trace ARCH-000011
 * @input ComponentのJSON値。
 * @returns 不変の期間設定。
 * @precondition 未検証値。
 * @postcondition 期間は正の安全な整数。
 * @effect N/A: 局所値のみ。
 * @failure 不正値で例外。
 * @invariant 任意の件数上限を期間へ持ち込まない。
 * @boundary 設定値。
 * @security 不正値を既定値にしない。
 * @concurrency N/A: 同期処理。
 */
function component(value: unknown) {
  const days = value;
  if (
    typeof days !== "number" ||
    !Number.isSafeInteger(days) ||
    days <= 0 ||
    !Number.isSafeInteger(days * DAY_MS)
  )
    throw new Error("days");
  return days;
}

/**
 * 検証済みRootの保持期間を読取り専用で取得する。
 * @responsibility 不存在、破損、alias、観測不能を区別する。
 * @trace ARCH-000011
 * @input 発行済みVerifiedRepositoryRootと固定ツール名。
 * @returns 既定値または検証済み設定、あるいはblocked。
 * @precondition 設定を利用する履歴所有者が自身の排他を保持する。
 * @postcondition 存在するFileと親Directoryの同一性を再確認する。
 * @effect Fileの読取りhandleをfinallyで閉じる。作成・変更は行わない。
 * @failure Root不正、未知値、alias、置換、観測不能ではblocked。
 * @invariant 期間設定は削除許可や未解決義務の解除ではない。
 * @boundary 検証済みRepositoryのconfig領域。
 * @security symbolic link、hard link、Root越境を拒否する。
 * @concurrency 一回の呼出しで不変Snapshotを返し、利用側が処理全体へ適用する。
 */
function readToolRuntimeConfig(
  capability: VerifiedRepositoryRoot,
  tool: "project-runtime" | "execution-intelligence",
): ToolRuntimeConfigResult {
  try {
    const paths = resolveRepositoryRuntimeDataPathsForInternalUse(capability);
    if (!paths) throw new Error("root");
    const parents = [paths.root, paths.config];
    const observations: { file: string; stat: fs.Stats }[] = [];
    let isAbsent = false;
    for (const file of parents) {
      try {
        const stat = fs.lstatSync(file);
        if (
          !stat.isDirectory() ||
          stat.isSymbolicLink() ||
          fs.realpathSync.native(file) !== file
        )
          throw new Error("directory");
        observations.push({ file, stat });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        isAbsent = true;
        break;
      }
    }
    const file = path.join(paths.config, `${tool}.json`);
    let config: ToolRuntimeConfig;
    let source: "default" | "file" = "default";
    let before: fs.Stats | null = null;
    if (!isAbsent) {
      try {
        before = fs.lstatSync(file);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (before) {
      if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
        throw new Error("file");
      const fd = fs.openSync(file, "r");
      try {
        const opened = fs.fstatSync(fd);
        if (
          opened.ino !== before.ino ||
          opened.dev !== before.dev ||
          opened.nlink !== 1
        )
          throw new Error("identity");
        const parsed: unknown = JSON.parse(fs.readFileSync(fd, "utf8"));
        const value = closed(parsed, [
          "schemaRevision",
          "historyRetentionDays",
        ]);
        if (value.schemaRevision !== 1) throw new Error("revision");
        config = Object.freeze({
          schemaRevision: 1,
          historyRetentionDays: component(value.historyRetentionDays),
        });
        const after = fs.lstatSync(file);
        const end = fs.fstatSync(fd);
        for (const stat of [after, end])
          if (
            !stat.isFile() ||
            stat.isSymbolicLink() ||
            stat.nlink !== 1 ||
            stat.ino !== before.ino ||
            stat.dev !== before.dev ||
            stat.size !== before.size ||
            stat.mtimeMs !== before.mtimeMs ||
            stat.ctimeMs !== before.ctimeMs
          )
            throw new Error("changed");
      } finally {
        fs.closeSync(fd);
      }
      source = "file";
    } else {
      config = Object.freeze({
        schemaRevision: 1,
        historyRetentionDays: 30,
      });
      const missing = isAbsent ? parents[observations.length] : file;
      if (!missing) throw new Error("missing_boundary");
      try {
        fs.lstatSync(missing);
        throw new Error("appeared");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    for (const { file: parent, stat } of observations) {
      const after = fs.lstatSync(parent);
      if (
        !after.isDirectory() ||
        after.isSymbolicLink() ||
        after.ino !== stat.ino ||
        after.dev !== stat.dev ||
        fs.realpathSync.native(parent) !== parent
      )
        throw new Error("changed");
    }
    if (
      resolveRepositoryRuntimeDataPathsForInternalUse(capability)
        ?.repositoryRoot !== paths.repositoryRoot
    )
      throw new Error("root_changed");
    return Object.freeze({ status: "ready", source, config });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "tool_runtime_config_invalid",
    });
  }
}

/**
 * Project Runtime専用の設定を取得する。
 * @responsibility 他ツールの不正設定でProject Runtimeを停止させない。
 * @trace ARCH-000011
 * @input 検証済みRoot Capability。
 * @returns 自ツールの設定Snapshotまたはblocked。
 * @precondition Project Runtime所有者が必要な排他を保持する。
 * @postcondition project-runtime.jsonだけを読取り済み。
 * @effect 読取りのみ。設定を作成・修正しない。
 * @failure 不正設定・観測不能はblocked。
 * @invariant 他ツールの設定を読まない。
 * @boundary Repository-local config。
 * @security 秘密値とAuthorityを扱わない。
 * @concurrency Snapshotを一処理内で固定する。
 */
export function readProjectRuntimeConfig(
  capability: VerifiedRepositoryRoot,
): ToolRuntimeConfigResult {
  return readToolRuntimeConfig(capability, "project-runtime");
}

/**
 * Execution Intelligence専用の設定を取得する。
 * @responsibility 他ツールの不正設定で実行履歴を停止させない。
 * @trace ARCH-000011
 * @input 検証済みRoot Capability。
 * @returns 自ツールの設定Snapshotまたはblocked。
 * @precondition 履歴所有者が必要な排他を保持する。
 * @postcondition execution-intelligence.jsonだけを読取り済み。
 * @effect 読取りのみ。設定を作成・修正しない。
 * @failure 不正設定・観測不能はblocked。
 * @invariant 他ツールの設定を読まない。
 * @boundary Repository-local config。
 * @security 秘密値とAuthorityを扱わない。
 * @concurrency Snapshotを一処理内で固定する。
 */
export function readExecutionIntelligenceConfig(
  capability: VerifiedRepositoryRoot,
): ToolRuntimeConfigResult {
  return readToolRuntimeConfig(capability, "execution-intelligence");
}
