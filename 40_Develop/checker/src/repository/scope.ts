/**
 * 検査対象の範囲を選び、一段の直接参照だけを拡張する。
 *
 * @responsibility 既存のRoot・Link・基準版境界と未検査集合を維持する。
 * @trace ARCH-000001
 */
import fs from "node:fs";
import path from "node:path";
import { isWithin, pathContainsSymbolicLink, samePath } from "./observe.ts";
import type { LinkRecord } from "./types.ts";

/**
 * 指定範囲の検証と既存の対象選択を行う。
 *
 * @responsibility 読取り順・例外・対象集合の既存条件を維持する。
 * @trace ARCH-000001
 * @input input: 同じ起動で観測したRoot・対象・参照・基準版情報。cliError: 既存の受付拒否。
 * @returns 選択結果と現在起動に限った局所集合。
 * @precondition Rootの初回確認・File探索が完了している。
 * @postcondition 入力の参照順を保持して対象を返す。
 * @effect Filesystemを同期読取りし、必要時に既存拒否callbackを呼ぶ。書込みなし。
 * @failure 観測失敗と拒否callbackの例外を伝播する。
 * @invariant Root外・Link・基準版例外の受理集合を変更しない。
 * @boundary Checker内部の観測とCLI拒否の境界。
 * @security 観測失敗を安全と見なさない。
 * @concurrency N/A: 起動内の同期処理。
 */
export function selectDocumentScope(
  input: Readonly<{
    root: string;
    scopeValues: readonly string[];
    allMarkdownFiles: readonly string[];
    allFileSet: ReadonlySet<string>;
    linkRecords: readonly LinkRecord[];
    gitlinkRoots: readonly string[];
    isBaselineSubmodule: boolean;
    adoptedBaselineRoot: string | null;
    uncheckedDescriptions: readonly string[];
  }>,
  cliError: (message: string) => never,
): {
  requestedScopes: string[];
  uncheckedItems: Set<string>;
  checkedFiles: Set<string>;
  markdownFiles: string[];
} {
  const {
    root,
    scopeValues,
    allMarkdownFiles,
    allFileSet,
    linkRecords,
    gitlinkRoots,
    isBaselineSubmodule,
    adoptedBaselineRoot,
    uncheckedDescriptions,
  } = input;
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const gitlinkRootFor = (target: string) =>
    gitlinkRoots.find((item) => isWithin(item, target)) ?? null;
  const requestedScopes = scopeValues.map((value) => path.resolve(root, value));
  for (const scope of requestedScopes) {
    if (!isWithin(root, scope)) {
      cliError(`--scope must stay under the target root: ${scope}`);
    }
    if (pathContainsSymbolicLink(root, scope)) {
      cliError(`--scope must not traverse a symbolic link: ${relative(scope)}`);
    }
    const scopeGitlink = gitlinkRootFor(scope);
    const scopeIsInAdoptedBaseline =
      scopeGitlink &&
      isBaselineSubmodule &&
      adoptedBaselineRoot &&
      samePath(scopeGitlink, adoptedBaselineRoot);
    if (scopeGitlink && !scopeIsInAdoptedBaseline) {
      cliError(
        `--scope points into a Gitlink submodule. Run the checker with --root ${relative(scopeGitlink)} after initializing that submodule.`,
      );
    }
    if (!fs.existsSync(scope)) {
      cliError(`--scope does not exist: ${scope}`);
    }
    if (
      isBaselineSubmodule &&
      adoptedBaselineRoot &&
      isWithin(adoptedBaselineRoot, scope)
    ) {
      cliError(
        `--scope points into the adopted CRDD baseline submodule. Run the checker with --root ${relative(adoptedBaselineRoot)} to inspect the baseline itself.`,
      );
    }
  }

  const uncheckedItems = new Set(uncheckedDescriptions);
  const checkedFiles = new Set<string>();
  if (requestedScopes.length === 0) {
    for (const file of allMarkdownFiles) checkedFiles.add(file);
  } else {
    for (const file of allMarkdownFiles) {
      if (requestedScopes.some((scope) => isWithin(scope, file)))
        checkedFiles.add(file);
    }
    const initial = new Set(checkedFiles);
    for (const record of linkRecords) {
      if (
        record.external ||
        !record.target ||
        record.outsideRoot ||
        !allFileSet.has(record.target)
      ) {
        continue;
      }
      if (initial.has(record.source)) {
        checkedFiles.add(record.target);
      }
      if (initial.has(record.target)) {
        checkedFiles.add(record.source);
      }
    }
  }

  const markdownFiles = allMarkdownFiles.filter((file) =>
    checkedFiles.has(file),
  );

  return { requestedScopes, uncheckedItems, checkedFiles, markdownFiles };
}
