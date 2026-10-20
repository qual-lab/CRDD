/**
 * 検査対象のFile状態とPath構成要素を同期観測する。
 *
 * @responsibility 不存在と観測失敗を区別し、既存の字句境界・Link検出を提供する。
 * @trace ARCH-000001
 */
import fs from "node:fs";
import path from "node:path";
import { observeDeclaredNestedRepositoryPaths } from "../../../version-control/src/index.ts";

/**
 * error Codeを決定する。
 *
 * @responsibility error Codeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000001
 * @input error: unknown
 * @returns string | nullを返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: errorCodeはProcess内の同一Subsystemで完結する。
 * @security N/A: errorCodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
export function errorCode(error: unknown): string | null {
  if (error === null || typeof error !== "object") return null;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : null;
}

/**
 * File自体の状態を読み、不存在だけをnullで返す。
 *
 * @responsibility Linkを辿らない同期観測とENOENTだけの不存在変換を所有する。
 * @trace ARCH-000001
 * @input target: string
 * @returns fs.Stats | nullを返す。
 * @precondition 「target: string」がlstatIfPresentの入力契約を満たす。
 * @postcondition lstatIfPresentの責務を完了した結果だけを返す。
 * @effect Filesystemのmetadataを同期読取りする。書込みは行わない。
 * @failure ENOENT以外の例外は同じObjectを伝播する。観測不能を不存在へ変換しない。
 * @invariant lstatIfPresentは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: lstatIfPresentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: lstatIfPresentは共有非同期状態を持たない同期処理である。
 */
export function lstatIfPresent(target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

/**
 * Root配下のPath構成要素にLinkがあるかを順に観測する。
 *
 * @responsibility Rootを除く構成要素の同期lstatと、既存の途中停止条件を所有する。
 * @trace ARCH-000001
 * @input root: string、target: string
 * @returns booleanを返す。
 * @precondition 呼出し元が選択したRootと対象を渡す。Root自身の実体確認は呼出し元が行う。
 * @postcondition pathContainsSymbolicLinkの責務を完了した結果だけを返す。
 * @effect Filesystemの構成要素を同期読取りする。書込み・実体の固定は行わない。
 * @failure 非ENOENT観測失敗は伝播する。
 * @invariant Root同一・字句上Root外・途中不存在はfalse。falseは安全性の証明ではない。
 * @boundary Path字句判定とFilesystem metadata観測。Hardlinkや競合後の状態は保証しない。
 * @security N/A: pathContainsSymbolicLinkはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathContainsSymbolicLinkは共有非同期状態を持たない同期処理である。
 */
export function pathContainsSymbolicLink(
  root: string,
  target: string,
): boolean {
  if (!isWithin(root, target)) return false;
  const relation = path.relative(root, target);
  if (!relation) return false;
  let current = root;
  for (const part of relation.split(path.sep)) {
    current = path.join(current, part);
    const stat = lstatIfPresent(current);
    if (!stat) return false;
    if (stat.isSymbolicLink()) return true;
  }
  return false;
}

/**
 * 二つのPathの字句上の包含関係を判定する。
 *
 * @responsibility relative結果が空、または非絶対かつ先頭が二点でないという既存条件を所有する。
 * @trace ARCH-000001
 * @input parent: string、child: string
 * @returns booleanを返す。
 * @precondition 「parent: string、child: string」がisWithinの入力契約を満たす。
 * @postcondition isWithinの責務を完了した結果だけを返す。
 * @effect N/A: isWithinは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isWithinは独自の失敗分岐を所有しない。
 * @invariant isWithinは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: 字句のみ。Link解決・実体同一性・Root認可は行わない。
 * @security N/A: isWithinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isWithinは共有非同期状態を持たない同期処理である。
 */
export function isWithin(parent: string, child: string): boolean {
  const relation = path.relative(parent, child);
  return (
    relation === "" ||
    (!relation.startsWith("..") && !path.isAbsolute(relation))
  );
}

/**
 * Pathが同一かを判定する。
 *
 * @responsibility Pathの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000001
 * @input left: string、right: string
 * @returns booleanを返す。
 * @precondition 「left: string、right: string」がsamePathの入力契約を満たす。
 * @postcondition samePathの責務を完了した結果だけを返す。
 * @effect N/A: samePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: samePathは独自の失敗分岐を所有しない。
 * @invariant samePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: samePathはProcess内の同一Subsystemで完結する。
 * @security N/A: samePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: samePathは共有非同期状態を持たない同期処理である。
 */
export function samePath(left: string, right: string): boolean {
  return path.relative(path.resolve(left), path.resolve(right)) === "";
}

/**
 * Git Config Valueを検証済み値へ復号する。
 *
 * @responsibility Git Config Valueの入力形式、復号結果、不正byte列の拒否境界を所有する。
 * @trace ARCH-000001
 * @input value: string
 * @returns string | nullを返す。
 * @precondition 「value: string」がdecodeGitConfigValueの入力契約を満たす。
 * @postcondition decodeGitConfigValueの責務を完了した結果だけを返す。
 * @effect N/A: decodeGitConfigValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: decodeGitConfigValueは独自の失敗分岐を所有しない。
 * @invariant decodeGitConfigValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: decodeGitConfigValueはProcess内の同一Subsystemで完結する。
 * @security N/A: decodeGitConfigValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodeGitConfigValueは共有非同期状態を持たない同期処理である。
 */
function decodeGitConfigValue(value: string): string | null {
  const trimmed = value.trim();
  let result = "";
  let isQuoted = false;
  for (let index = 0; index < trimmed.length; index += 1) {
    const character = trimmed[index];
    if (character === "\\") {
      const escaped = trimmed[index + 1];
      if (escaped === undefined) return null;
      const replacements: Record<string, string> = {
        b: "\b",
        n: "\n",
        t: "\t",
        "\\": "\\",
        '"': '"',
        "#": "#",
        ";": ";",
      };
      if (!(escaped in replacements)) return null;
      result += replacements[escaped];
      index += 1;
      continue;
    }
    if (character === '"') {
      isQuoted = !isQuoted;
      continue;
    }
    if (!isQuoted && (character === "#" || character === ";")) break;
    result += character;
  }
  if (isQuoted) return null;
  return result.trim();
}

/**
 * fallback Declared Submodule Pathsを決定する。
 *
 * @responsibility fallback Declared Submodule Pathsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000001
 * @input file: string
 * @returns Readonly<{ paths: string[]; readable: boolean; }>を返す。
 * @precondition 「file: string」がfallbackDeclaredSubmodulePathsの入力契約を満たす。
 * @postcondition fallbackDeclaredSubmodulePathsの責務を完了した結果だけを返す。
 * @effect 通常File・Link境界を確認後に.gitmodules本文を同期読取りする。書込みなし。
 * @failure fallbackDeclaredSubmodulePathsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant fallbackDeclaredSubmodulePathsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: fallbackDeclaredSubmodulePathsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: fallbackDeclaredSubmodulePathsは共有非同期状態を持たない同期処理である。
 */
function fallbackDeclaredSubmodulePaths(
  root: string,
  file: string,
): Readonly<{
  paths: string[];
  readable: boolean;
}> {
  const stat = lstatIfPresent(file);
  if (stat?.isFile() !== true || pathContainsSymbolicLink(root, file)) {
    return {
      paths: [],
      readable: !stat,
    };
  }
  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return {
      paths: [],
      readable: false,
    };
  }
  let isInSubmoduleSection = false;
  const submodulePaths = [];
  for (const line of content.split(/\r?\n/u)) {
    const section = line.match(
      /^\s*\[\s*([^\]\s]+)(?:\s+[^\]]+)?\]\s*(?:[;#].*)?$/u,
    );
    if (section) {
      isInSubmoduleSection = section[1].toLowerCase() === "submodule";
      continue;
    }
    if (!isInSubmoduleSection) continue;
    const assignment = line.match(/^\s*path\s*=\s*(.*?)\s*$/iu);
    if (!assignment) continue;
    const value = decodeGitConfigValue(assignment[1]);
    if (value !== null && value !== "") submodulePaths.push(value);
  }
  return {
    paths: [...new Set(submodulePaths)],
    readable: true,
  };
}

/**
 * 初期Root内の基準版候補とRepository形態を観測する。
 *
 * @responsibility .gitmodules・基準版候補・公式ひな型の同じ観測順を保持する。
 * @trace ARCH-000001
 * @input root: CLIが初回の通常Directory確認を終えたRoot。
 * @returns 宣言済み入れ子、基準版候補、三値の宣言状態と現在形態。
 * @precondition Root選択と初回Link拒否は呼出し元が完了している。
 * @postcondition Git一覧の探索より前の観測値だけを返す。
 * @effect Filesystemのmetadata・.gitmodules本文とVersion Control公開操作を同期読取りする。書込みなし。
 * @failure 読取り不能の宣言は元のunknown判定を維持し、その他の観測失敗を伝播する。
 * @invariant 先読み、再観測、新しいRoot認可を追加しない。
 * @boundary Checker内部のRoot初期観測と後続探索の境界。
 * @security 形態の判定はRoot検証や権限発行を意味しない。
 * @concurrency N/A: 同じ起動内の同期観測。
 */
export function observeRepositoryLayout(root: string) {
  const gitmodules = path.join(root, ".gitmodules");
  const fallbackGitmodules = fallbackDeclaredSubmodulePaths(root, gitmodules);
  const gitmodulesStat = lstatIfPresent(gitmodules);
  const isGitmodulesReadableFile =
    gitmodulesStat?.isFile() === true &&
    !pathContainsSymbolicLink(root, gitmodules);
  const declaredNestedRepositories = isGitmodulesReadableFile
    ? observeDeclaredNestedRepositoryPaths(gitmodules)
    : null;
  const isGitmodulesParsed =
    !gitmodulesStat ||
    (isGitmodulesReadableFile &&
      declaredNestedRepositories?.status === "completed");
  const declaredSubmodules = isGitmodulesParsed
    ? (declaredNestedRepositories?.paths ?? [])
    : fallbackGitmodules.paths;
  const hasDeclaredBaselineSubmodule = declaredSubmodules.some(
    (item) => item.replaceAll("\\", "/") === "00_CRDD",
  );
  const isBaselineDeclared = isGitmodulesParsed
    ? hasDeclaredBaselineSubmodule
    : null;
  const baselineCandidateRoot = path.join(root, "00_CRDD");
  const baselineEntryStat = lstatIfPresent(baselineCandidateRoot);
  const hasBaselineEntry = Boolean(baselineEntryStat);
  const isBaselineEntryDirectory =
    baselineEntryStat?.isDirectory() === true &&
    baselineEntryStat.isSymbolicLink() === false;
  const isBaselineDeclarationCandidate =
    hasDeclaredBaselineSubmodule || (!isGitmodulesParsed && hasBaselineEntry);
  const officialTemplateRoot = path.join(root, "template");
  const hasOfficialRepositorySignals =
    Boolean(lstatIfPresent(officialTemplateRoot)) &&
    Boolean(lstatIfPresent(path.join(root, "01_Principles.md")));
  const repositoryMode =
    hasBaselineEntry || isBaselineDeclarationCandidate
      ? "adopter"
      : hasOfficialRepositorySignals
        ? "official"
        : "generic";
  const adoptedBaselineRoot =
    repositoryMode === "adopter" ? baselineCandidateRoot : null;

  return {
    declaredSubmodules,
    baselineCandidateRoot,
    isBaselineDeclared,
    isBaselineDeclarationCandidate,
    isBaselineEntryDirectory,
    repositoryMode,
    adoptedBaselineRoot,
  };
}
