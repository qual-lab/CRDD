#!/usr/bin/env node

/**
 * CRDDの決定論的な文書・配置確認。
 *
 * このツールは文書監査、準拠監査、不足／影響監査、専門品質確認を
 * 代替しない。人間やAIが意味を評価する前に、機械判定できる不整合を
 * 除去するための任意の補助実装である。
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  observeDeclaredNestedRepositoryPaths,
  observeNestedRepository,
  observeRepositoryEntries,
  readFixedSnapshotText,
  resolveRevisionIdentity,
} from "./internal/version-control-runtime.ts";

type Finding = Readonly<{
  severity: string;
  code: string;
  path: string;
  message: string;
}>;

type BaselineSubmoduleState = Readonly<{
  declared: boolean | null;
  gitlink_indexed: boolean | null;
  gitlink_conflicted: boolean | null;
  gitlink_oid: string | null;
  worktree_present: boolean | null;
  gitdir_accessible: boolean | null;
  head_readable: boolean | null;
  head_oid: string | null;
  head_matches_gitlink: boolean | null;
}>;

type Discovery = Readonly<{
  files: string[];
  source: string;
  git_failure: string | null;
  gitlink_detection: string;
  gitlinks: string[];
  baseline_submodule: boolean;
  baseline_submodule_initialized: boolean | null;
  baseline_submodule_state: BaselineSubmoduleState;
  exclusions: string[];
  unchecked: string[];
}>;

type GitlinkEntry = Readonly<{ path: string; oid: string }>;
type MarkdownEntry = {
  index: number;
  text: string;
  outside: boolean;
  fenceId: number | null;
};
type MarkdownFence = {
  id: number;
  marker: string;
  length: number;
  language: string;
  start: number;
  end: number | null;
  closed: boolean;
  contents: MarkdownEntry[];
};
type ReleaseSection = Readonly<{
  start: number;
  end: number;
  entries: MarkdownEntry[];
}>;
type LocalLinkResolution = Readonly<{
  external: false;
  target: string;
  anchor: string;
  targetText: string;
  decodeError: boolean;
  outsideRoot: boolean;
  symbolicBoundary: boolean;
}>;
type LinkResolution =
  | LocalLinkResolution
  | Readonly<{
      external: true;
      target: null;
      anchor: string;
      targetText: string;
      decodeError: boolean;
      outsideRoot: false;
    }>;
type LinkRecord = LinkResolution &
  Readonly<{
    source: string;
    raw: string;
    fixedHistoricalReference: boolean;
    historicalTargetExists: boolean;
    historicalAnchorExists: boolean | null;
  }>;

function errorCode(error: unknown): string | null {
  if (error === null || typeof error !== "object") return null;
  const code = Reflect.get(error, "code");
  return typeof code === "string" ? code : null;
}

const startedAt = new Date();
const startedAtMs = Date.now();
const args = process.argv.slice(2);
let shouldOutputJson = false;
let shouldOutputSummary = false;
let rootValue = process.cwd();
const scopeValues: string[] = [];
let referencesValue: string | null = null;

function cliError(message: string): never {
  console.error(message);
  process.exit(2);
}

for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--json") {
    shouldOutputJson = true;
    continue;
  }
  if (argument === "--summary") {
    shouldOutputSummary = true;
    continue;
  }
  if (["--root", "--scope", "--references"].includes(argument)) {
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      cliError(`${argument} requires a path.`);
    }
    if (argument === "--root") rootValue = value;
    if (argument === "--scope") scopeValues.push(value);
    if (argument === "--references") referencesValue = value;
    index += 1;
    continue;
  }
  cliError(`Unknown option: ${argument}`);
}

const root = path.resolve(rootValue);
const rootStat = lstatIfPresent(root);
if (!rootStat) cliError(`--root does not exist: ${root}`);
if (rootStat.isSymbolicLink()) {
  cliError(`--root must not be a symbolic link or junction: ${root}`);
}
if (!rootStat.isDirectory()) {
  cliError(`--root is not a directory: ${root}`);
}

function lstatIfPresent(target: string): fs.Stats | null {
  try {
    return fs.lstatSync(target);
  } catch (error) {
    if (errorCode(error) === "ENOENT") return null;
    throw error;
  }
}

function pathContainsSymbolicLink(target: string): boolean {
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

function samePath(left: string, right: string): boolean {
  return path.relative(path.resolve(left), path.resolve(right)) === "";
}

function isInitializedBaselineWithoutGit(baselineRoot: string): boolean {
  const gitMarker = path.join(baselineRoot, ".git");
  if (pathContainsSymbolicLink(gitMarker)) return false;
  const markerStat = lstatIfPresent(gitMarker);
  if (!markerStat) return false;
  if (markerStat.isDirectory()) return true;
  if (!markerStat.isFile()) return false;
  const content = fs.readFileSync(gitMarker, "utf8");
  const match = content.match(/^\s*gitdir:\s*(.+?)\s*$/mu);
  if (!match) return false;
  const gitDirectory = path.resolve(baselineRoot, match[1]);
  if (!isWithin(root, gitDirectory)) return false;
  if (pathContainsSymbolicLink(gitDirectory)) return false;
  return lstatIfPresent(gitDirectory)?.isDirectory() === true;
}

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

function fallbackDeclaredSubmodulePaths(file: string): Readonly<{
  paths: string[];
  readable: boolean;
}> {
  const stat = lstatIfPresent(file);
  if (stat?.isFile() !== true || pathContainsSymbolicLink(file)) {
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

const gitmodules = path.join(root, ".gitmodules");
const fallbackGitmodules = fallbackDeclaredSubmodulePaths(gitmodules);
const gitmodulesStat = lstatIfPresent(gitmodules);
const isGitmodulesReadableFile =
  gitmodulesStat?.isFile() === true && !pathContainsSymbolicLink(gitmodules);
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
let repositoryMode =
  hasBaselineEntry || isBaselineDeclarationCandidate
    ? "adopter"
    : hasOfficialRepositorySignals
      ? "official"
      : "generic";
let adoptedBaselineRoot =
  repositoryMode === "adopter" ? baselineCandidateRoot : null;
const findings: Finding[] = [];
const add = (severity: string, code: string, file: string, message: string) =>
  findings.push({ severity, code, path: file, message });
const relative = (file: string) =>
  path.relative(root, file).replaceAll("\\", "/") || ".";
const read = (file: string) => fs.readFileSync(file, "utf8");

function checkWorkLifecycleNavigation(): void {
  if (repositoryMode === "generic") return;
  for (const legacyPath of [
    "90_Release",
    "07_Quality/Verification_Results",
    "template/90_Release",
    "template/07_Quality/Verification_Results",
  ]) {
    if (fs.existsSync(path.join(root, legacyPath)))
      add(
        "error",
        "legacy-work-lifecycle-path-present",
        legacyPath,
        "A legacy Work Lifecycle or centralized verification-results path must not be recreated.",
      );
  }
  const changesRoot = path.join(root, "99_Roadmap", "Changes");
  const changeIndexPath = path.join(root, "99_Roadmap", "02_Changes.md");
  if (
    !lstatIfPresent(changesRoot)?.isDirectory() ||
    !fs.existsSync(changeIndexPath)
  )
    return;
  const aggregateIds = fs
    .readdirSync(changesRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && /^CHG-[0-9]{6}$/u.test(entry.name),
    )
    .filter((entry) =>
      lstatIfPresent(path.join(changesRoot, entry.name, "change.md"))?.isFile(),
    )
    .map((entry) => entry.name)
    .sort();
  for (const aggregateId of aggregateIds) {
    const changePath = path.join(changesRoot, aggregateId, "change.md");
    const change = read(changePath);
    const impactHeadings = change.match(/^### 影響ファイル$/gmu) ?? [];
    if (impactHeadings.length !== 1) {
      add(
        "error",
        "change-impact-files-section-mismatch",
        relative(changePath),
        "Every canonical Change must contain exactly one '### 影響ファイル' section.",
      );
      continue;
    }
    const impactBlock = change.match(
      /^### 影響ファイル\r?\n\r?\n<details>\r?\n<summary>全ファイルを表示<\/summary>\r?\n([\s\S]*?)\r?\n<\/details>$/mu,
    )?.[1];
    const impactLines = impactBlock
      ?.split(/\r?\n/u)
      .filter((line) => line.trim().length > 0);
    const impactLinePattern =
      /^- (?:\[[^\]]+\]\([^)]+\)|`[^`]+`（(?:削除|削除または旧Path)）|`[^`]+` → \[[^\]]+\]\([^)]+\))$/u;
    if (
      !impactLines ||
      impactLines.length === 0 ||
      impactLines.some((line) => !impactLinePattern.test(line))
    ) {
      add(
        "error",
        "change-impact-files-contract-invalid",
        relative(changePath),
        "The impact-file section must use the canonical disclosure label and contain only flat affected-path, deletion, or move entries.",
      );
    }
    if (/^### 主な反映ファイル$/mu.test(change)) {
      add(
        "error",
        "legacy-change-impact-heading",
        relative(changePath),
        "The legacy representative-file heading must not remain in a canonical Change.",
      );
    }
  }
  if (repositoryMode === "official") {
    const changeTemplatePath = path.join(
      root,
      "template",
      "99_Roadmap",
      "Changes",
      "CHG-XXXXXX",
      "change.md",
    );
    if (lstatIfPresent(changeTemplatePath)?.isFile()) {
      const changeTemplate = read(changeTemplatePath);
      if (
        !/^### 影響ファイル$/mu.test(changeTemplate) ||
        !/^<summary>全ファイルを表示<\/summary>$/mu.test(changeTemplate) ||
        /^### 主な反映ファイル$/mu.test(changeTemplate)
      ) {
        add(
          "error",
          "change-impact-files-template-mismatch",
          relative(changeTemplatePath),
          "The official Change template must expose the canonical exhaustive impact-file section.",
        );
      }
    }
  }
  const index = read(changeIndexPath);
  const aggregateIndex =
    index.match(
      /<!-- crdd-change-aggregate-index:start -->([\s\S]*?)<!-- crdd-change-aggregate-index:end -->/u,
    )?.[1] ?? "";
  const indexedIds = [
    ...aggregateIndex.matchAll(/\.\/Changes\/(CHG-[0-9]{6})\/change\.md/gu),
  ]
    .map((match) => match[1])
    .sort();
  const uniqueIndexedIds = new Set(indexedIds);
  if (
    indexedIds.length !== uniqueIndexedIds.size ||
    aggregateIds.length !== uniqueIndexedIds.size ||
    aggregateIds.some((id) => !uniqueIndexedIds.has(id))
  )
    add(
      "error",
      "change-navigation-population-mismatch",
      relative(changeIndexPath),
      "The Change navigation must reference every ID-only Change aggregate exactly once and no unknown aggregate.",
    );

  const releaseIndexPath = path.join(root, "99_Roadmap", "03_Releases.md");
  const releasesRoot = path.join(root, "99_Roadmap", "Releases");
  if (
    !fs.existsSync(releaseIndexPath) ||
    !lstatIfPresent(releasesRoot)?.isDirectory()
  )
    return;
  const releaseIndex = read(releaseIndexPath);
  const evidencePaths: string[] = [];
  for (const version of fs.readdirSync(releasesRoot, { withFileTypes: true })) {
    if (!version.isDirectory()) continue;
    const evidenceRoot = path.join(releasesRoot, version.name, "Evidence");
    if (!lstatIfPresent(evidenceRoot)?.isDirectory()) continue;
    for (const evidence of fs.readdirSync(evidenceRoot, {
      withFileTypes: true,
    })) {
      if (evidence.isFile())
        evidencePaths.push(
          `./Releases/${version.name}/Evidence/${evidence.name}`,
        );
    }
  }
  if (
    evidencePaths.some(
      (evidencePath) => releaseIndex.split(evidencePath).length - 1 !== 1,
    )
  )
    add(
      "error",
      "release-evidence-navigation-incomplete",
      relative(releaseIndexPath),
      "Every Release-owned Evidence file must have one exact navigation link.",
    );
}

checkWorkLifecycleNavigation();

const discoveryRootChecklistItemTexts = [
  "すべての探索記録と採用要求を台帳から一意に辿れる。",
  "採用済みの判断、探索中の候補、保留、棄却および未確認事項を区別した。",
  "複数探索の関係、競合または合流候補を、個別記録の第二の正本を作らず示した。",
  "Version別の作業予定や未完了TaskをDiscoveryの判断として複製していない。",
  "基本図を現行図、既存参照、理由付き非該当または作成不能として処置した。",
  "UXその他へ渡す現在の判断、保持条件およびDiscoveryへ戻す条件が分かる。",
  "人間理解の確認が必要な探索について、理解確認と要求採用を区別した。",
  "補足情報や台帳が個別探索・要求定義の第二の正本になっていない。",
];

const discoveryExplorationChecklistItemTexts = [
  "情報源と、情報源から確認できる範囲を示した。",
  "確認できた事実と、そこから導いた解釈・仮説を区別した。",
  "解決策ではなく、本質的な問題を説明した。",
  "技術名称を除いても、誰が何に困っているか理解できる。",
  "影響を受ける人または判断する人を特定した。",
  "どのような変化を期待するか説明した。",
  "原因と解決に関する仮説を、事実として扱っていない。",
  "未確認事項と不確実性を明示した。",
  "人間による確認または判断が必要かを評価した。",
  "情報不足をAIの推測だけで補っていない。",
  "失敗、リスク、制約および対象外を評価した。",
  "採用、不採用、保留を区別した。",
  "次工程が保持すべき問題、変化および条件を示した。",
  "情報不足時にDiscoveryへ戻す条件を示した。",
  "因果、比較または時系列を図示する必要性を判定し、作成または理由付きN/Aとして処置した。",
  "補足分析へ必須情報を退避していない。",
];

const discoveryRequirementChecklistItemTexts = [
  "要求だけを読んでも、必要な変化を理解できる。",
  "探索元と採用判断を一意に辿れる。",
  "対象、利用状況、問題および望ましい変化を説明した。",
  "特定の画面、実装または技術方式へ不要に固定していない。",
  "要求として採用した理由と主要な代替を示した。",
  "正常時の成立条件を判定可能な形で示した。",
  "不完全・異常・境界時にも守る条件を示した。",
  "成立主張を破る反証条件を示した。",
  "失敗、リスクおよび制約を評価した。",
  "対象外を明示した。",
  "未確認事項と人間確認の必要性を評価した。",
  "情報不足をAIの推測だけで補っていない。",
  "検証意図を、具体的な試験項目を先取りせず説明した。",
  "UXが探索記録を直接読まず、この定義だけから分析を開始できる。",
  "下流工程の結論をDiscoveryへ逆輸入していない。",
  "補足分析へ必須情報を退避していない。",
];

const uxIndexChecklistItemTexts = [
  "誰の何をなぜ良くする製品かを冒頭から短時間で理解できる",
  "全REQに個別分析とUX処置があり全UX定義へ到達できる",
  "UX成果と入力REQの関係および網羅状況を説明できる",
  "個別分析と横断合成の詳細を複製せず関係と現在状態を示した",
  "想定利用者、利用の流れ、提供責務および品質期待の横断成果物へ到達できる",
  "未確認事項、戻り先および工程移行判断を区別した",
  "IAへの正式な引き渡しを明示した",
  "Quality Analysis / UXへの伴走入力を明示した",
  "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
  "基本図を作成、既存参照、非該当または作成不能として理由付きで処置した",
  "横断成果物が個別Definitionの第二の正本になっていない",
  "補足へ台帳、網羅状況または必須の引き渡しを退避していない",
];

const uxPersonasChecklistItemTexts = [
  "利用者像を個別UX分析から横断合成した",
  "全UX IDの主要な利用者を処置した",
  "役割と利用者の目的を混同していない",
  "目的、困りごと、利用状況および判断責任に意味のある差で分けた",
  "架空の属性、根拠のない能力差または役職だけで利用者像を作っていない",
  "共通性と要求固有の差を混同していない",
  "根拠、確信度および未確認範囲を示した",
  "利用者分類をUIの権限設計へ先取りしていない",
  "個別UX Definitionと矛盾していない",
  "補足へ利用者一覧や必須の差を退避していない",
];

const uxExperienceMapChecklistItemTexts = [
  "個別UX分析から仕事の起点、理解、判断および継続を横断合成した",
  "全UX IDを利用の流れへ処置した",
  "画面遷移や内部処理ではなく利用者の時間軸と得られる結果を主語にした",
  "各段階の目的と得られる結果を追跡できる",
  "利用者、目的または結果が変わる主要分岐を示した",
  "重要場面、失敗および回復を必要な範囲で処置した",
  "各流れから関係するREQ、UXおよび個別分析へ戻れる",
  "未確認範囲を確認済みの流れへ混ぜていない",
  "UI Navigationを先取りしていない",
  "補足へ主要な流れまたは分岐を退避していない",
];

const uxServiceBlueprintChecklistItemTexts = [
  "個別UX分析の利用者接点、提供責務、失敗および回復を横断合成した",
  "全UX IDについてサービス提供の流れの適用を処置した",
  "利用者成果とサービス側の責任の対応を追跡できる",
  "利用者、接点、提供側、運用・根拠の責任と可視境界を区別した",
  "人間、AIおよびシステムの責任を必要な範囲で区別した",
  "完了時と失敗時に誰へ何が返るかを示した",
  "返却後に誰が何を判断できるかを示した",
  "Architecture Componentへ提供責務を固定していない",
  "UI部品、Protocol、Class等の下流方式を先取りしていない",
  "未確認の責任境界を確定した提供責務へ混ぜていない",
  "補足へ主要な責任境界を退避していない",
];

const uxQualityExpectationsChecklistItemTexts = [
  "個別UX分析で見つかった品質期待を製品全体で横断合成した",
  "全UX IDの品質期待を処置した",
  "品質を内部特性でなく利用者や運用者に現れる状態として示した",
  "各品質が利用者成果の成立に必要な理由を説明できる",
  "重要場面、避ける失敗および関係REQ／UXを接続した",
  "Quality Analysis / UXへ渡す検証義務を識別した",
  "両立が難しい品質と現在の優先判断を隠していない",
  "数値条件、状態Schema、Protocolまたは実現方式を先取りしていない",
  "未確認範囲を確認済みの品質期待へ混ぜていない",
  "補足へ主要な品質期待を退避していない",
];

const uxAnalysisChecklistItemTexts = [
  "同じREQのDiscovery定義を正式入力として一意に特定した",
  "REQの問題、望ましい変化、制約および未確認事項を保持した",
  "REQにない意味をAIの推測だけで追加していない",
  "利用者、判断する人および関係する利用者を必要な範囲で特定した",
  "利用場面と前後の状況を特定した",
  "現在の体験、困りごとまたは回避方法を説明した",
  "目的を解決策の操作ではなく利用者の目的として表現した",
  "利用前後の仕事、理解、判断または行動の変化を説明した",
  "得られる結果を独立した利用者成果として定義した",
  "重要場面を評価した",
  "避ける失敗を評価した",
  "体験品質への期待を評価した",
  "人間による評価または確認が必要な事項を評価した",
  "IA、UI、SPECまたはArchitectureの結論を先取りしていない",
  "New、SameまたはNot Applicableを利用者成果の同一性から判断した",
  "統合判断の理由を追跡できる",
  "未確認事項と影響を明示した",
  "IAへの正式な引き渡しを明示した",
  "Quality Analysis / UXへの伴走入力を明示した",
  "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
  "DiscoveryまたはUXへ戻す条件を明示した",
  "補足分析へ必須情報を退避していない",
];

const uxDefinitionChecklistItemTexts = [
  "UX IDと表題から独立した利用者成果を識別できる",
  "定義単独で利用者、利用場面および前後の状況を理解できる",
  "利用者の目的を理解できる",
  "得られる結果をUI操作ではなく独立した利用者成果として表現した",
  "利用前後の変化を必要な範囲で説明した",
  "成立条件を観察可能な意味で説明した",
  "重要場面を処置した",
  "重要な失敗を処置した",
  "体験品質への期待と必要性を処置した",
  "必要な情報をIAへ引き渡せる",
  "UXが所有する責任と下流へ残す判断を区別した",
  "制約と対象外を保持した",
  "未確認事項と影響を明示した",
  "人間による評価または確認の必要性を評価した",
  "検証意図を具体的なTest Caseへ先取りせず定義した",
  "IAへの正式な引き渡しを明示した",
  "Quality Analysis / UXへの伴走入力を明示した",
  "UIとSPECが後続で保持するUX ContractをIAへの工程移行と区別した",
  "IAがUX Analysisを読み直さずDefinitionから開始できる",
  "下流成果物、Architectureまたは現行実装をUXへ逆輸入していない",
  "DiscoveryまたはUX分析へ戻す条件を明示した",
  "補足定義へ必須情報を退避していない",
];

function checklistItemText(line: string): string | null {
  const checked = /^- \[x\] (?<text>\S.*)$/u.exec(line);
  if (checked?.groups?.text) return checked.groups.text;
  const result = /^- (?:N\/A|OPEN|FAIL): \S.*? — (?<text>\S.*)$/u.exec(line);
  return result?.groups?.text ?? null;
}

function completedVisibleChecklistError(
  markdown: string,
  expectedItems: readonly string[],
): string | null {
  const visible = visibleMarkdownStructure(markdown);
  const sections = [...visible.matchAll(/^## Checklist\s*$/gmu)];
  if (sections.length !== 1) return "missing_or_duplicate";
  const start = sections[0]?.index ?? -1;
  const body = visible.slice(start).replace(/^## Checklist\s*$\r?\n?/mu, "");
  const bodyLines = body.split(/\r?\n/u).map((line) => line.trim());
  if (bodyLines.some((line) => line.length > 0 && !line.startsWith("- ")))
    return "content_after_or_between_items";
  const lines = bodyLines.filter((line) => line.startsWith("- "));
  if (lines.length === 0) return "empty";
  if (lines.some((line) => /^- \[ \]/u.test(line))) return "unevaluated";
  if (
    lines.some(
      (line) =>
        !/^- \[x\] \S/u.test(line) && !/^- (?:N\/A|OPEN|FAIL): \S/u.test(line),
    )
  )
    return "invalid_result";
  const actualItems = lines.map(checklistItemText);
  if (
    actualItems.some((item) => item === null) ||
    actualItems.length !== expectedItems.length ||
    actualItems.some((item, index) => item !== expectedItems[index])
  )
    return "item_set_mismatch";
  return null;
}

function templateVisibleChecklistError(
  markdown: string,
  expectedItems: readonly string[],
): string | null {
  const visible = visibleMarkdownStructure(markdown);
  const sections = [...visible.matchAll(/^## Checklist\s*$/gmu)];
  if (sections.length !== 1) return "missing_or_duplicate";
  const start = sections[0]?.index ?? -1;
  const body = visible.slice(start).replace(/^## Checklist\s*$\r?\n?/mu, "");
  if (!/^- \[ \] \S/mu.test(body)) return "unevaluated_item_missing";
  for (const token of ["[x]", "[ ]", "OPEN", "FAIL", "N/A"]) {
    if (!body.includes(token)) return "result_guidance_missing";
  }
  const bodyLines = body.split(/\r?\n/u).map((line) => line.trim());
  const firstItemIndex = bodyLines.findIndex((line) =>
    line.startsWith("- [ ] "),
  );
  if (
    bodyLines
      .slice(0, firstItemIndex)
      .some(
        (line) => /^#{1,6}(?:\s|$)/u.test(line) || /^(?:=+|-+)\s*$/u.test(line),
      )
  )
    return "nested_or_following_heading";
  if (
    bodyLines
      .slice(firstItemIndex)
      .some((line) => line.length > 0 && !line.startsWith("- [ ] "))
  )
    return "content_after_or_between_items";
  const actualItems = bodyLines
    .filter((line) => line.startsWith("- [ ] "))
    .map((line) => line.slice("- [ ] ".length));
  if (
    actualItems.length !== expectedItems.length ||
    actualItems.some((item, index) => item !== expectedItems[index])
  )
    return "item_set_mismatch";
  if (!body.includes("理由")) return "result_guidance_missing";
  return null;
}

function checkUxRequirementAnalysis(): void {
  if (repositoryMode !== "official") return;
  const discoveryPath = path.join(
    root,
    "01_Discovery",
    "01_Product_Discovery.md",
  );
  const uxIndexPath = path.join(root, "02_UX", "01_User_Experience.md");
  const discoveryDefinitionsRoot = path.join(
    root,
    "01_Discovery",
    "Definitions",
  );
  const discoveryAnalysisRoot = path.join(root, "01_Discovery", "Analysis");
  const requirementsRoot = path.join(root, "02_UX", "Analysis");
  const uxDefinitionsRoot = path.join(root, "02_UX", "Definitions");
  const experienceMapPath = path.join(root, "02_UX", "03_Experience_Map.md");
  const uxHandoffTargets = [
    "IA（直後工程への正式な引き渡し）",
    "Quality Analysis / UX（伴走）",
    "UI（後続Contract Relation）",
    "SPEC（後続Contract Relation）",
  ] as const;
  const uxHandoffTargetSetIsExact = (source: string, heading: string) => {
    const visible = visibleMarkdownStructure(source);
    const start = visible.indexOf(heading);
    if (start < 0) return false;
    const tail = visible.slice(start + heading.length);
    const boundary = tail.search(/^#{2,3} /mu);
    const section = boundary < 0 ? tail : tail.slice(0, boundary);
    const targets = section
      .split(/\r?\n/u)
      .flatMap((line) => {
        const match = line.match(/^\| (?<target>[^|]+) \|/u);
        const target = match?.groups?.target?.trim();
        return target && target !== "接続先" && target !== "引き渡し先"
          ? [target]
          : [];
      })
      .filter((target) => !/^-+$/u.test(target));
    return (
      targets.length === uxHandoffTargets.length &&
      targets.every((target, index) => target === uxHandoffTargets[index])
    );
  };
  const uxRootHandoffIsValid = (source: string, heading: string) => {
    const visible = visibleMarkdownStructure(source);
    const start = visible.indexOf(heading);
    if (start < 0) return false;
    const tail = visible.slice(start + heading.length);
    const boundary = tail.search(/^## /mu);
    const section = boundary < 0 ? tail : tail.slice(0, boundary);
    const labels = section.split(/\r?\n/u).flatMap((line) => {
      const match = line.match(/^\| (?<label>[^|]+) \|/u);
      const label = match?.groups?.label?.trim();
      return label && label !== "項目" && !/^-+$/u.test(label) ? [label] : [];
    });
    const requiredLabels = [
      "IAへの正式な引き渡し",
      "Quality Analysis / UXへの伴走入力",
      "UI／SPECが後続で保持するUX Contract",
    ];
    const handoffLabels = labels.filter((label) =>
      /(引き渡し|伴走入力|UX Contract|Handoff|直接接続|後続Relation)/u.test(
        label,
      ),
    );
    return (
      handoffLabels.length === requiredLabels.length &&
      handoffLabels.every((label, index) => label === requiredLabels[index])
    );
  };
  if (
    !lstatIfPresent(discoveryPath)?.isFile() ||
    !lstatIfPresent(uxIndexPath)?.isFile()
  )
    return;
  if (!lstatIfPresent(requirementsRoot)?.isDirectory()) {
    add(
      "error",
      "ux-requirement-analysis-root-missing",
      relative(requirementsRoot),
      "The official UX profile must retain the requirement-analysis root.",
    );
    return;
  }
  const discoveryRootChecklistError = completedVisibleChecklistError(
    read(discoveryPath),
    discoveryRootChecklistItemTexts,
  );
  if (discoveryRootChecklistError)
    add(
      "error",
      "discovery-checklist-contract-invalid",
      relative(discoveryPath),
      `The canonical Discovery entry must contain one visible, fully evaluated artifact-specific Checklist (${discoveryRootChecklistError}).`,
    );
  if (lstatIfPresent(discoveryAnalysisRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(discoveryAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^EXP-[0-9]{6}$/u.test(entry.name)) continue;
      const analysisPath = path.join(
        discoveryAnalysisRoot,
        entry.name,
        "exploration.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      const analysis = read(analysisPath);
      if (
        !analysis.includes("成果物種別: Discovery分析") ||
        !analysis.includes(`探索ID: \`${entry.name}\``)
      )
        add(
          "error",
          "discovery-analysis-contract-invalid",
          relative(analysisPath),
          "Each Discovery analysis must declare its phase-owned artifact type and matching exploration ID.",
        );
      const checklistError = completedVisibleChecklistError(
        analysis,
        discoveryExplorationChecklistItemTexts,
      );
      if (checklistError)
        add(
          "error",
          "discovery-checklist-contract-invalid",
          relative(analysisPath),
          `Each canonical Discovery analysis must contain one visible, fully evaluated artifact-specific Checklist (${checklistError}).`,
        );
    }
  }
  for (const [discoveryTemplatePath, checklistItems] of [
    [
      path.join(root, "template", "01_Discovery", "01_Product_Discovery.md"),
      discoveryRootChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "01_Discovery",
        "Analysis",
        "EXP-XXXXXX",
        "exploration.md",
      ),
      discoveryExplorationChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "01_Discovery",
        "Definitions",
        "REQ-XXXXXX",
        "requirement.md",
      ),
      discoveryRequirementChecklistItemTexts,
    ],
  ] as const) {
    if (!lstatIfPresent(discoveryTemplatePath)?.isFile()) continue;
    const checklistError = templateVisibleChecklistError(
      read(discoveryTemplatePath),
      checklistItems,
    );
    if (checklistError)
      add(
        "error",
        "discovery-checklist-template-invalid",
        relative(discoveryTemplatePath),
        `Each Discovery template must expose one visible artifact-specific Checklist with unevaluated items and result guidance (${checklistError}).`,
      );
  }
  for (const [uxArtifactPath, checklistItems] of [
    [uxIndexPath, uxIndexChecklistItemTexts],
    [path.join(root, "02_UX", "02_Personas.md"), uxPersonasChecklistItemTexts],
    [experienceMapPath, uxExperienceMapChecklistItemTexts],
    [
      path.join(root, "02_UX", "04_Service_Blueprint.md"),
      uxServiceBlueprintChecklistItemTexts,
    ],
    [
      path.join(root, "02_UX", "05_Quality_Expectations.md"),
      uxQualityExpectationsChecklistItemTexts,
    ],
  ] as const) {
    if (!lstatIfPresent(uxArtifactPath)?.isFile()) {
      add(
        "error",
        "ux-canonical-projection-missing",
        relative(uxArtifactPath),
        "The official UX profile must retain all five canonical projection artifacts.",
      );
      continue;
    }
    const checklistError = completedVisibleChecklistError(
      read(uxArtifactPath),
      checklistItems,
    );
    if (checklistError)
      add(
        "error",
        "ux-checklist-contract-invalid",
        relative(uxArtifactPath),
        `Each canonical UX projection must contain one visible, fully evaluated artifact-specific Checklist (${checklistError}).`,
      );
  }
  for (const [uxTemplatePath, checklistItems] of [
    [
      path.join(root, "template", "02_UX", "01_User_Experience.md"),
      uxIndexChecklistItemTexts,
    ],
    [
      path.join(root, "template", "02_UX", "02_Personas.md"),
      uxPersonasChecklistItemTexts,
    ],
    [
      path.join(root, "template", "02_UX", "03_Experience_Map.md"),
      uxExperienceMapChecklistItemTexts,
    ],
    [
      path.join(root, "template", "02_UX", "04_Service_Blueprint.md"),
      uxServiceBlueprintChecklistItemTexts,
    ],
    [
      path.join(root, "template", "02_UX", "05_Quality_Expectations.md"),
      uxQualityExpectationsChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Analysis",
        "REQ-XXXXXX",
        "ux_analysis.md",
      ),
      uxAnalysisChecklistItemTexts,
    ],
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Definitions",
        "UX-XXXXXX",
        "ux_definition.md",
      ),
      uxDefinitionChecklistItemTexts,
    ],
  ] as const) {
    if (!lstatIfPresent(uxTemplatePath)?.isFile()) {
      add(
        "error",
        "ux-template-missing",
        relative(uxTemplatePath),
        "The official distribution must retain all seven UX templates.",
      );
      continue;
    }
    const checklistError = templateVisibleChecklistError(
      read(uxTemplatePath),
      checklistItems,
    );
    if (checklistError)
      add(
        "error",
        "ux-checklist-template-invalid",
        relative(uxTemplatePath),
        `Each UX template must expose one visible artifact-specific Checklist with unevaluated items and result guidance (${checklistError}).`,
      );
  }
  for (const [uxTemplatePath, heading] of [
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Analysis",
        "REQ-XXXXXX",
        "ux_analysis.md",
      ),
      "## 6. 下流への引き渡し",
    ],
    [
      path.join(
        root,
        "template",
        "02_UX",
        "Definitions",
        "UX-XXXXXX",
        "ux_definition.md",
      ),
      "## 下流への引き渡し",
    ],
  ] as const) {
    if (
      lstatIfPresent(uxTemplatePath)?.isFile() &&
      !uxHandoffTargetSetIsExact(read(uxTemplatePath), heading)
    )
      add(
        "error",
        "ux-direct-downstream-handoff-reintroduced",
        relative(uxTemplatePath),
        "UX handoff templates must contain exactly IA, Quality Analysis / UX, UI, and SPEC with their formal boundary labels; no direct Architecture or Verification target is allowed.",
      );
  }
  const templatePath = path.join(
    root,
    "template",
    "02_UX",
    "Analysis",
    "REQ-XXXXXX",
    "ux_analysis.md",
  );
  if (!lstatIfPresent(templatePath)?.isFile())
    add(
      "error",
      "ux-requirement-analysis-template-missing",
      relative(templatePath),
      "The official distribution must include the UX requirement-analysis template.",
    );
  const adoptedRequirements = new Set(
    read(discoveryPath)
      .split(/\r?\n/u)
      .filter(
        (line) =>
          /^\| (?:`|\[)REQ-[0-9]{6}/u.test(line) &&
          line.includes("| 要求採用 |"),
      )
      .map((line) => line.match(/REQ-[0-9]{6}/u)?.[0])
      .filter((value): value is string => Boolean(value)),
  );
  const actualRequirements = new Set<string>();
  const uxIndex = read(uxIndexPath);
  const canonicalUxIds = new Set(
    uxIndex
      .split(/\r?\n/u)
      .map((line) => line.match(/^\| (?:`|\[)(?<id>UX-[0-9]{6})/u)?.groups?.id)
      .filter((value): value is string => Boolean(value)),
  );
  for (const [projectionPath, heading] of [
    [path.join(root, "02_UX", "02_Personas.md"), "## 3. UX成果との対応"],
    [experienceMapPath, "## 3. UX成果との対応"],
    [
      path.join(root, "02_UX", "04_Service_Blueprint.md"),
      "## 3. UX成果への適用",
    ],
    [
      path.join(root, "02_UX", "05_Quality_Expectations.md"),
      "## 3. UX成果との対応",
    ],
  ] as const) {
    if (!lstatIfPresent(projectionPath)?.isFile()) continue;
    const source = visibleMarkdownStructure(read(projectionPath));
    const start = source.indexOf(heading);
    const tail = start < 0 ? "" : source.slice(start + heading.length);
    const next = tail.search(/^## /mu);
    const projection = next < 0 ? tail : tail.slice(0, next);
    const projectedIds = [
      ...projection.matchAll(/^\| \[(UX-[0-9]{6})\]\(/gmu),
    ].map((match) => match[1]);
    const projectedSet = new Set(projectedIds);
    if (
      start < 0 ||
      projectedIds.length !== projectedSet.size ||
      projectedSet.size !== canonicalUxIds.size ||
      [...canonicalUxIds].some((id) => !projectedSet.has(id))
    )
      add(
        "error",
        "ux-cross-cutting-projection-incomplete",
        relative(projectionPath),
        "Each cross-cutting UX projection must process every canonical UX ID exactly once in its dedicated mapping section.",
      );
  }
  for (const [artifactPath, forbiddenParts] of [
    [uxIndexPath, ["IA／UI／SPEC／Verification", "UIへは", "SPECへは"]],
    [
      path.join(root, "02_UX", "05_Quality_Expectations.md"),
      ["- Architectureは", "- Verificationは"],
    ],
    [
      path.join(root, "template", "02_UX", "01_User_Experience.md"),
      ["IA／UI／SPEC／Verification"],
    ],
  ] as const) {
    if (!lstatIfPresent(artifactPath)?.isFile()) continue;
    const source = visibleMarkdownStructure(read(artifactPath));
    if (forbiddenParts.some((part) => source.includes(part)))
      add(
        "error",
        "ux-direct-downstream-handoff-reintroduced",
        relative(artifactPath),
        "UX must hand off formally to IA, accompany Quality Analysis / UX, and leave UI/SPEC as post-IA contract relations; it must not hand off directly to Architecture or Verification.",
      );
  }
  for (const [artifactPath, heading] of [
    [uxIndexPath, "## 4. 現在状態と次工程への引き渡し"],
    [
      path.join(root, "template", "02_UX", "01_User_Experience.md"),
      "## 6. 現在状態と次工程への引き渡し",
    ],
  ] as const) {
    if (
      lstatIfPresent(artifactPath)?.isFile() &&
      !uxRootHandoffIsValid(read(artifactPath), heading)
    )
      add(
        "error",
        "ux-direct-downstream-handoff-reintroduced",
        relative(artifactPath),
        "The UX entry must expose IA as its only immediate phase handoff, Quality Analysis / UX as its accompanying analysis, and UI/SPEC as post-IA contract relations without a direct Architecture or Verification target.",
      );
  }
  const canonicalRelationPairs = new Set(
    uxIndex.split(/\r?\n/u).flatMap((line) => {
      const uxId = line.match(/^\| (?:`|\[)(?<id>UX-[0-9]{6})/u)?.groups?.id;
      if (!uxId) return [];
      const requirementCell = line.split("|")[2] ?? "";
      return [...requirementCell.matchAll(/REQ-[0-9]{6}/gu)].map(
        (match) => `${match[0]}|${uxId}`,
      );
    }),
  );
  const analysisRelationPairs = new Set<string>();
  const canonicalJourneyPairs = new Set<string>();
  if (lstatIfPresent(experienceMapPath)?.isFile()) {
    for (const line of read(experienceMapPath).split(/\r?\n/u)) {
      const cells = line.split("|").map((cell) => cell.trim());
      if (cells.length < 7 || cells[1] === "Journey" || /^-+$/u.test(cells[1]))
        continue;
      for (const match of cells[5].matchAll(/REQ-[0-9]{6}/gu))
        canonicalJourneyPairs.add(`${match[0]}|${cells[1]}`);
    }
  }
  const analysisJourneyPairs = new Set<string>();
  for (const entry of fs.readdirSync(requirementsRoot, {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory() || !/^REQ-[0-9]{6}$/u.test(entry.name)) continue;
    const analysisPath = path.join(
      requirementsRoot,
      entry.name,
      "ux_analysis.md",
    );
    if (!lstatIfPresent(analysisPath)?.isFile()) continue;
    actualRequirements.add(entry.name);
    const analysis = read(analysisPath);
    const discoveryDefinitionPath = path.join(
      discoveryDefinitionsRoot,
      entry.name,
      "requirement.md",
    );
    const expectedDefinitionLink = new RegExp(
      `^分析対象: \\[${entry.name} [^\\]]+\\]\\(\\.\\.\\/\\.\\.\\/\\.\\.\\/01_Discovery/Definitions/${entry.name}/requirement\\.md\\)$`,
      "mu",
    );
    const definition = lstatIfPresent(discoveryDefinitionPath)?.isFile()
      ? read(discoveryDefinitionPath)
      : "";
    const structuralAnalysis = withoutFencedCode(analysis).replace(
      /<!--[\s\S]*?-->/gu,
      "",
    );
    const formalInputHeaders =
      structuralAnalysis.match(/^分析対象:.*$/gmu) ?? [];
    const formalInputTargets = uxFormalInputTargets(analysis);
    const analysisTargets = formalInputTargets
      .map(({ target }) => resolveLocalTarget(analysisPath, target))
      .filter(
        (resolved): resolved is LocalLinkResolution => !resolved.external,
      );
    const discoveryDefinitionLinks = analysisTargets.filter((resolved) =>
      /^01_Discovery\/Definitions\/REQ-[0-9]{6}\/requirement\.md$/u.test(
        relative(resolved.target).replaceAll("\\", "/"),
      ),
    );
    const sourceAnalysisLinks = analysisTargets.filter((resolved) =>
      /^01_Discovery\/Analysis\/EXP-[0-9]{6}\/exploration\.md$/u.test(
        relative(resolved.target).replaceAll("\\", "/"),
      ),
    );
    const invalidDiscoveryInputLinks = analysisTargets.filter((resolved) => {
      const normalized = relative(resolved.target).replaceAll("\\", "/");
      return (
        /(?:^|\/)01_Discovery\/(?:Analysis|Definitions)\//u.test(
          resolved.targetText.replaceAll("\\", "/"),
        ) &&
        !/^01_Discovery\/(?:Analysis\/EXP-[0-9]{6}\/exploration\.md|Definitions\/REQ-[0-9]{6}\/requirement\.md)$/u.test(
          normalized,
        )
      );
    });
    if (
      !definition ||
      formalInputHeaders.length !== 1 ||
      !expectedDefinitionLink.test(structuralAnalysis) ||
      discoveryDefinitionLinks.length !== 1 ||
      !samePath(
        discoveryDefinitionLinks[0]?.target ?? "",
        discoveryDefinitionPath,
      ) ||
      sourceAnalysisLinks.length > 0 ||
      invalidDiscoveryInputLinks.length > 0 ||
      formalInputTargets.some((target) => target.invalidEntity) ||
      analysisTargets.some(
        (resolved) =>
          resolved.decodeError ||
          resolved.outsideRoot ||
          resolved.symbolicBoundary,
      ) ||
      /^判断根拠:|^探索元:/mu.test(analysis)
    )
      add(
        "error",
        "ux-requirement-formal-input-invalid",
        relative(analysisPath),
        "Each UX requirement analysis must use only its matching Discovery Definition as the formal input; an incomplete Definition must return to Discovery instead of being supplemented from Source Analysis.",
      );
    const requiredParts = [
      "成果物種別: UX分析",
      `分析対象: [${entry.name} `,
      "## 1. 要求の一次分析",
      "| 解決する問題 |",
      "| 利用者に必要なこと |",
      "## 2. 利用者・目標・成果",
      "| 主な想定利用者 |",
      "| 目的 |",
      "| 得られる結果 |",
      "## 3. 利用者に起きる変化",
      "## 4. 利用者成果への統合",
      "| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |",
      "## 5. 重要な体験",
      "### この要求での利用の流れ",
      "### サービス提供の流れの処置",
      "処置:",
      "### 製品全体の整理への接続",
      "- 利用の流れの統合先:",
      "- サービス提供の流れの統合先:",
      "### この要求での責任境界",
      "| 担い手 | この要求で担うこと | 越えてはならない境界 |",
      "### 補足する品質",
      "## 6. 下流への引き渡し",
      "IA（直後工程への正式な引き渡し）",
      "Quality Analysis / UX（伴走）",
      "UI（後続Contract Relation）",
      "SPEC（後続Contract Relation）",
      "### 妥当性確認と未確認事項",
      "現在判定:",
      "確認事項:",
      "判断者:",
      "未確認時の影響:",
      "Discoveryへ戻す条件",
    ];
    const hasExperienceChange =
      /```text\r?\n変更前\r?\n[\s\S]+?\r?\n変更後\r?\n/u.test(analysis);
    if (
      requiredParts.some((part) => !analysis.includes(part)) ||
      !hasExperienceChange ||
      uxIndex.split(`Analysis/${entry.name}/ux_analysis.md`).length - 1 !== 1
    )
      add(
        "error",
        "ux-requirement-analysis-contract-invalid",
        relative(analysisPath),
        "Each UX requirement analysis must declare its REQ and preserve the six-stage visual-first analysis contract from problem and user outcome through synthesis, critical experience, validation, and downstream handoff, with one registry link.",
      );
    const analysisChecklistError = completedVisibleChecklistError(
      analysis,
      uxAnalysisChecklistItemTexts,
    );
    if (
      analysis.includes("### 後続工程が保持する義務") ||
      analysis.includes("UXからArchitectureまたは検証への直接Handoff") ||
      !uxHandoffTargetSetIsExact(analysis, "## 6. 下流への引き渡し")
    )
      add(
        "error",
        "ux-direct-downstream-handoff-reintroduced",
        relative(analysisPath),
        "Requirement-specific UX analysis must preserve downstream meaning through IA, Quality Analysis / UX, and post-IA UI/SPEC relations rather than a direct Architecture or Verification handoff.",
      );
    if (analysisChecklistError)
      add(
        "error",
        "ux-checklist-contract-invalid",
        relative(analysisPath),
        `Each canonical UX analysis must contain one visible, fully evaluated artifact-specific Checklist (${analysisChecklistError}).`,
      );
    const relationRows = analysis
      .split(/\r?\n/u)
      .filter((line) =>
        /^\| [^|]+ \| `(New|Same) → UX-[0-9]{6}` \|/u.test(line),
      );
    const relationDiagramSection = analysis
      .split("## 4. 利用者成果への統合")[1]
      ?.split("| 利用者成果 | 処置 | 判断理由 | この要求が補う内容 |")[0];
    const relationDiagramEntries = [
      ...(relationDiagramSection?.matchAll(
        /(?:├|└)─ (?<mode>New|Same)\s+→ (?<id>UX-[0-9]{6})\b/gu,
      ) ?? []),
    ].flatMap((match) =>
      match.groups?.mode && match.groups.id
        ? [`${match.groups.mode}|${match.groups.id}`]
        : [],
    );
    const relationTableEntries = relationRows.flatMap((line) => {
      const match = line.match(/`(?<mode>New|Same) → (?<id>UX-[0-9]{6})`/u);
      return match?.groups?.mode && match.groups.id
        ? [`${match.groups.mode}|${match.groups.id}`]
        : [];
    });
    const doesRelationDiagramMatchTable =
      relationDiagramEntries.length === relationTableEntries.length &&
      [...relationDiagramEntries]
        .sort()
        .every(
          (value, index) => value === [...relationTableEntries].sort()[index],
        );
    const responsibilitySectionMatches = [
      ...analysis.matchAll(/^### この要求での責任境界\s*$/gmu),
    ];
    const responsibilitySection = analysis
      .split(/^### この要求での責任境界\s*$/mu)[1]
      ?.split(/^### |^## /mu)[0];
    const responsibilityHeaders = (responsibilitySection ?? "")
      .split(/\r?\n/u)
      .filter((line, index, lines) => {
        const next = lines[index + 1] ?? "";
        return /^\|.*\|$/u.test(line) && /^\|(?:\s*:?-+:?\s*\|)+$/u.test(next);
      });
    const hasExactResponsibilityHeader =
      responsibilitySectionMatches.length === 1 &&
      responsibilityHeaders.length === 1 &&
      responsibilityHeaders[0] ===
        "| 担い手 | この要求で担うこと | 越えてはならない境界 |";
    const notApplicableRows = analysis
      .split(/\r?\n/u)
      .filter((line) => /^\| [^|]+ \| `Not Applicable` \|/u.test(line));
    const sameRelationIds = relationRows.flatMap((line) => {
      const match = line.match(/`Same → (?<id>UX-[0-9]{6})`/u);
      return match?.groups?.id ? [match.groups.id] : [];
    });
    const hasCompleteSameComparison = sameRelationIds.every((uxId) => {
      const block = analysis.match(
        new RegExp(
          `^#### [^\\r\\n]+\\r?\\n\\r?\\n比較対象: \`${uxId}\`\\r?\\n(?<body>[\\s\\S]*?)(?=^#### |^## |(?![\\s\\S]))`,
          "mu",
        ),
      )?.groups?.body;
      if (!block?.includes("統合理由:")) return false;
      return ["担い手", "利用のきっかけ", "得られる結果", "避ける失敗"].every(
        (axis) =>
          new RegExp(
            `^\\| ${axis} \\| [^|]+ \\| [^|]+ \\| [^|]+ \\|$`,
            "mu",
          ).test(block),
      );
    });
    for (const line of relationRows) {
      const match = line.match(/`(?:New|Same) → (?<id>UX-[0-9]{6})`/u);
      if (match?.groups?.id)
        analysisRelationPairs.add(`${entry.name}|${match.groups.id}`);
    }
    const journeyLine = analysis
      .split(/\r?\n/u)
      .find((line) => line.startsWith("- 利用の流れの統合先:"));
    for (const match of journeyLine?.matchAll(
      /\[([^\]]+)\]\([^)]*03_Experience_Map\.md#[^)]+\)/gu,
    ) ?? [])
      analysisJourneyPairs.add(`${entry.name}|${match[1]}`);
    const blueprintSection = analysis
      .split("### サービス提供の流れの処置")[1]
      ?.split("### 製品全体の整理への接続")[0];
    const blueprintDisposition =
      blueprintSection?.match(/^処置: `(作成|非該当)`$/mu)?.[1];
    const isBlueprintDispositionInvalid =
      !blueprintDisposition ||
      (blueprintDisposition === "作成" &&
        (!/```text\r?\n[\s\S]+?\r?\n```/u.test(blueprintSection ?? "") ||
          ![
            "【利用者・責任者】",
            "【利用者接点】",
            "【提供側】",
            "【回復・判断する人】",
            "可視境界",
            "時間差:",
            "完了時:",
            "失敗時:",
            "次の行動:",
          ].every((label) => blueprintSection?.includes(label)))) ||
      (blueprintDisposition === "非該当" &&
        !/再評価/u.test(blueprintSection ?? ""));
    if (
      relationRows.length + notApplicableRows.length === 0 ||
      relationRows.some(
        (line) =>
          !/^\| [^|]+ \| `(New|Same) → UX-[0-9]{6}` \| [^|]+ \| [^|]+ \|$/u.test(
            line,
          ),
      ) ||
      notApplicableRows.some(
        (line) =>
          !/^\| [^|]+ \| `Not Applicable` \| [^|]+ \| [^|]+ \|$/u.test(line),
      ) ||
      !hasCompleteSameComparison ||
      !doesRelationDiagramMatchTable
    )
      add(
        "error",
        "ux-requirement-analysis-relation-invalid",
        relative(analysisPath),
        "Each UX requirement analysis must connect every candidate to a canonical UX outcome and explain New or Same with requirement-specific reasoning.",
      );
    if (!hasExactResponsibilityHeader)
      add(
        "error",
        "ux-requirement-analysis-responsibility-header-invalid",
        relative(analysisPath),
        "Each UX requirement analysis must declare exactly one responsibility boundary table with the canonical three-column header.",
      );
    if (isBlueprintDispositionInvalid)
      add(
        "error",
        "ux-requirement-analysis-blueprint-disposition-invalid",
        relative(analysisPath),
        "Each UX requirement analysis must create a requirement-specific Service Blueprint when handoffs shape the experience, or state a reason and reevaluation condition when it is not applicable.",
      );
  }
  if (
    adoptedRequirements.size !== actualRequirements.size ||
    [...adoptedRequirements].some((id) => !actualRequirements.has(id))
  )
    add(
      "error",
      "ux-requirement-analysis-coverage-mismatch",
      relative(uxIndexPath),
      "Every adopted Discovery requirement must have exactly one UX requirement-analysis directory, regardless of its primary related domains.",
    );
  const discoveryDefinitionIds = new Set<string>();
  if (lstatIfPresent(discoveryDefinitionsRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(discoveryDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^REQ-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        discoveryDefinitionsRoot,
        entry.name,
        "requirement.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      discoveryDefinitionIds.add(entry.name);
      const definition = read(definitionPath);
      const requiredDefinitionSections = [
        "## 対象と利用状況",
        "## 解く問題と望ましい変化",
        "## 採用理由と比較",
        "## 成立条件",
        "## 検証意図",
        "## 関係",
      ];
      const hasPlaceholder =
        /REQ-XXXXXX|EXP-XXXXXX|UX-XXXXXX|TODO|TBD|（要求名）|（探索名）/u.test(
          definition,
        );
      const sourceRelation = definition.match(
        /元の探索記録: \[(EXP-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/(EXP-[0-9]{6})\/exploration\.md\)/u,
      );
      if (
        !definition.includes(`要求ID: \`${entry.name}\``) ||
        !definition.includes("成果物種別: Discovery定義") ||
        !definition.includes("## 要求") ||
        requiredDefinitionSections.some(
          (heading) => !definition.includes(heading),
        ) ||
        !/## (?:制約|失敗・リスク・制約)/u.test(definition) ||
        !/## (?:工程引渡し|UXへの引き渡し)/u.test(definition) ||
        hasPlaceholder ||
        !sourceRelation ||
        sourceRelation[1] !== sourceRelation[2]
      )
        add(
          "error",
          "discovery-requirement-definition-contract-invalid",
          relative(definitionPath),
          "Each adopted Discovery requirement must have a self-contained canonical definition.",
        );
      const checklistError = completedVisibleChecklistError(
        definition,
        discoveryRequirementChecklistItemTexts,
      );
      if (checklistError)
        add(
          "error",
          "discovery-checklist-contract-invalid",
          relative(definitionPath),
          `Each canonical Discovery requirement must contain one visible, fully evaluated artifact-specific Checklist (${checklistError}).`,
        );
    }
  }
  if (
    adoptedRequirements.size !== discoveryDefinitionIds.size ||
    [...adoptedRequirements].some((id) => !discoveryDefinitionIds.has(id))
  )
    add(
      "error",
      "discovery-requirement-definition-coverage-mismatch",
      relative(discoveryPath),
      "Every adopted Discovery requirement must have exactly one canonical requirement definition.",
    );
  const uxDefinitionIds = new Set<string>();
  if (lstatIfPresent(uxDefinitionsRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(uxDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UX-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        uxDefinitionsRoot,
        entry.name,
        "ux_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      uxDefinitionIds.add(entry.name);
      const definition = read(definitionPath);
      const stateHeaders = definition.match(/^状態:.*$/gmu) ?? [];
      if (
        !definition.includes(`UX ID: \`${entry.name}\``) ||
        !definition.includes("成果物種別: UX定義") ||
        stateHeaders.length !== 1 ||
        !/^状態: (Canonical|Superseded)$/u.test(stateHeaders[0] ?? "") ||
        !definition.includes("## 利用者成果") ||
        !definition.includes("## 利用者に起きる変化") ||
        !definition.includes("## 成立条件") ||
        !definition.includes("## 重要な体験・失敗・品質期待") ||
        !definition.includes("### 重要な失敗") ||
        !definition.includes("### 体験品質への期待") ||
        !definition.includes("## 責任境界・制約・対象外") ||
        !definition.includes("## 未確認事項と戻り条件") ||
        !definition.includes("現在判定:") ||
        !definition.includes("確認事項:") ||
        !definition.includes("判断者:") ||
        !definition.includes("未確認時の影響:") ||
        !definition.includes("## 検証意図") ||
        !definition.includes("IA（直後工程への正式な引き渡し）") ||
        !definition.includes("Quality Analysis / UX（伴走）") ||
        !definition.includes("UI（後続Contract Relation）") ||
        !definition.includes("SPEC（後続Contract Relation）") ||
        !definition.includes("## 関係")
      )
        add(
          "error",
          "ux-definition-contract-invalid",
          relative(definitionPath),
          "Each canonical UX outcome must have a self-contained definition.",
        );
      const definitionChecklistError = completedVisibleChecklistError(
        definition,
        uxDefinitionChecklistItemTexts,
      );
      if (
        definition.includes("### 要求固有の後続義務") ||
        definition.includes("UXからArchitectureまたは検証への直接Handoff") ||
        !uxHandoffTargetSetIsExact(definition, "## 下流への引き渡し")
      )
        add(
          "error",
          "ux-direct-downstream-handoff-reintroduced",
          relative(definitionPath),
          "Canonical UX definitions must not directly assign Architecture or Verification work; those obligations flow through IA, UI/SPEC, and Quality Analysis / UX.",
        );
      if (definitionChecklistError)
        add(
          "error",
          "ux-checklist-contract-invalid",
          relative(definitionPath),
          `Each canonical UX definition must contain one visible, fully evaluated artifact-specific Checklist (${definitionChecklistError}).`,
        );
    }
  }
  if (
    canonicalUxIds.size !== uxDefinitionIds.size ||
    [...canonicalUxIds].some((id) => !uxDefinitionIds.has(id))
  )
    add(
      "error",
      "ux-definition-coverage-mismatch",
      relative(uxIndexPath),
      "Every canonical UX outcome must have exactly one UX definition.",
    );
  const legacyRoots = [
    path.join(root, "01_Discovery", "Explorations"),
    path.join(root, "02_UX", "Requirements"),
    path.join(root, "template", "01_Discovery", "Evidence"),
    path.join(root, "template", "02_UX", "Evidence"),
  ];
  for (const legacyRoot of legacyRoots)
    if (lstatIfPresent(legacyRoot))
      add(
        "error",
        "phase-repository-legacy-root-present",
        relative(legacyRoot),
        "The current phase repository pattern must not retain a legacy or empty common root.",
      );
  if (
    canonicalUxIds.size === 0 ||
    [...canonicalRelationPairs].some(
      (pair) => !analysisRelationPairs.has(pair),
    ) ||
    [...analysisRelationPairs].some((pair) => !canonicalRelationPairs.has(pair))
  )
    add(
      "error",
      "ux-outcome-relation-closure-mismatch",
      relative(uxIndexPath),
      "Canonical UX outcomes and requirement-analysis New/Same relations must form an exact, bidirectional (REQ, UX) pair set.",
    );
  if (
    canonicalJourneyPairs.size === 0 ||
    [...canonicalJourneyPairs].some(
      (pair) => !analysisJourneyPairs.has(pair),
    ) ||
    [...analysisJourneyPairs].some((pair) => !canonicalJourneyPairs.has(pair))
  )
    add(
      "error",
      "ux-journey-relation-closure-mismatch",
      relative(experienceMapPath),
      "The Experience Map and requirement analyses must form an exact, bidirectional (REQ, Journey) pair set.",
    );
}

checkUxRequirementAnalysis();

function checkIaReconstruction(): void {
  if (repositoryMode !== "official") return;
  const uxDefinitionsRoot = path.join(root, "02_UX", "Definitions");
  const iaIndexPath = path.join(
    root,
    "03_IA",
    "01_Information_Architecture.md",
  );
  const iaAnalysisRoot = path.join(root, "03_IA", "Analysis");
  const iaDefinitionsRoot = path.join(root, "03_IA", "Definitions");
  if (!lstatIfPresent(iaIndexPath)?.isFile()) return;

  const requiredTemplates = [
    path.join(
      root,
      "template",
      "03_IA",
      "Analysis",
      "UX-XXXXXX",
      "ia_analysis.md",
    ),
    path.join(
      root,
      "template",
      "03_IA",
      "Definitions",
      "IA-XXXXXX",
      "ia_definition.md",
    ),
  ];
  for (const templatePath of requiredTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "ia-reconstruction-template-missing",
        relative(templatePath),
        "The official IA profile must include paired analysis and definition templates.",
      );
  for (const sharedEvidenceRoot of [
    path.join(root, "05_SPEC", "Evidence"),
    path.join(root, "template", "05_SPEC", "Evidence"),
  ])
    if (lstatIfPresent(sharedEvidenceRoot)?.isDirectory())
      add(
        "error",
        "spec-shared-evidence-root-forbidden",
        relative(sharedEvidenceRoot),
        "SPEC-specific evidence belongs under its SPEC ID; cross-SPEC execution evidence belongs to Change or Release.",
      );

  const uxIds = new Set<string>();
  if (lstatIfPresent(uxDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uxDefinitionsRoot, {
      withFileTypes: true,
    }))
      if (
        entry.isDirectory() &&
        /^UX-[0-9]{6}$/u.test(entry.name) &&
        lstatIfPresent(
          path.join(uxDefinitionsRoot, entry.name, "ux_definition.md"),
        )?.isFile()
      )
        uxIds.add(entry.name);

  const iaIndex = visibleMarkdownStructure(read(iaIndexPath));
  const registryPairs = new Set<string>();
  const registryPairKeys: string[] = [];
  const indexedIaIds = new Set<string>();
  let isIaRegistryRowInvalid = false;
  for (const line of iaIndex.split(/\r?\n/u)) {
    const row = line.match(
      /^\| \[(IA-[0-9]{6})\]\(Definitions\/\1\/ia_definition\.md\) \| [^|]+ \| (?<uxCell>[^|]+) \|$/u,
    );
    if (!row?.groups?.uxCell) continue;
    const iaId = row[1];
    const inputUxIds = [...row.groups.uxCell.matchAll(/UX-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    if (
      inputUxIds.length === 0 ||
      new Set(inputUxIds).size !== inputUxIds.length
    )
      isIaRegistryRowInvalid = true;
    indexedIaIds.add(iaId);
    for (const uxId of inputUxIds) {
      const pair = `${uxId}|${iaId}`;
      registryPairKeys.push(pair);
      registryPairs.add(pair);
    }
  }
  const exactSecondLevelSection = (source: string, heading: string) => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const headings = [
      ...source.matchAll(new RegExp(`^## ${escaped}\\s*$`, "gmu")),
    ];
    if (headings.length !== 1) return null;
    const start = (headings[0].index ?? 0) + headings[0][0].length;
    const remaining = source.slice(start);
    const nextHeading = remaining.search(/^## /mu);
    return nextHeading < 0 ? remaining : remaining.slice(0, nextHeading);
  };
  const analysisPairs = new Set<string>();
  const analysisPairKeys: string[] = [];
  const actualAnalysisIds = new Set<string>();
  if (lstatIfPresent(iaAnalysisRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(iaAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UX-[0-9]{6}$/u.test(entry.name)) continue;
      const analysisPath = path.join(
        iaAnalysisRoot,
        entry.name,
        "ia_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      actualAnalysisIds.add(entry.name);
      const analysis = visibleMarkdownStructure(read(analysisPath));
      const source = analysis.match(
        /分析対象: \[(UX-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/02_UX\/Definitions\/(UX-[0-9]{6})\/ux_definition\.md\)/u,
      );
      const receivedMeaningSection = exactSecondLevelSection(
        analysis,
        "1. UXから受け取る意味",
      );
      const dispositionSection = exactSecondLevelSection(analysis, "5. IA処置");
      for (const match of dispositionSection?.matchAll(
        /\[(IA-[0-9]{6})\]\(\.\.\/\.\.\/Definitions\/\1\/ia_definition\.md\)/gu,
      ) ?? []) {
        const pair = `${entry.name}|${match[1]}`;
        analysisPairKeys.push(pair);
        analysisPairs.add(pair);
      }
      if (
        !analysis.includes("成果物種別: IA分析") ||
        !source ||
        source[1] !== entry.name ||
        source[2] !== entry.name ||
        !receivedMeaningSection ||
        ![
          "利用者",
          "場面",
          "目的",
          "得たい結果",
          "重要場面",
          "避ける失敗",
          "守る品質",
        ].every((axis) =>
          new RegExp(`^\\| ${axis} \\| [^|]+ \\|$`, "mu").test(
            receivedMeaningSection,
          ),
        ) ||
        !analysis.includes("## 2. 情報候補と関係") ||
        !analysis.includes("| 候補 | 利用者にとっての意味 | 識別・関係 |") ||
        !analysis.includes("## 3. 状態・可視性・導線・責任") ||
        !analysis.includes("| 状態 |") ||
        !analysis.includes("| 可視性 |") ||
        !analysis.includes("| 導線 |") ||
        !analysis.includes("| 責任 |") ||
        !analysis.includes("## 4. 現行文書・実装との照合") ||
        !dispositionSection ||
        ![...analysisPairs].some((pair) => pair.startsWith(`${entry.name}|`))
      )
        add(
          "error",
          "ia-analysis-contract-invalid",
          relative(analysisPath),
          "Each UX definition must have one self-contained IA analysis with at least one canonical IA disposition.",
        );
    }
  }
  if (
    uxIds.size !== actualAnalysisIds.size ||
    [...uxIds].some((id) => !actualAnalysisIds.has(id))
  )
    add(
      "error",
      "ia-analysis-coverage-mismatch",
      relative(iaIndexPath),
      "Every canonical UX definition must have exactly one IA analysis.",
    );

  const actualIaIds = new Set<string>();
  const definitionPairs = new Set<string>();
  const definitionPairKeys: string[] = [];
  if (lstatIfPresent(iaDefinitionsRoot)?.isDirectory()) {
    for (const entry of fs.readdirSync(iaDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^IA-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        iaDefinitionsRoot,
        entry.name,
        "ia_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualIaIds.add(entry.name);
      const definition = visibleMarkdownStructure(read(definitionPath));
      const sourceSection = exactSecondLevelSection(definition, "情報源");
      for (const match of sourceSection?.matchAll(
        /\[(UX-[0-9]{6})のIA分析\]\(\.\.\/\.\.\/Analysis\/(UX-[0-9]{6})\/ia_analysis\.md\)/gu,
      ) ?? [])
        if (match[1] === match[2]) {
          const pair = `${match[1]}|${entry.name}`;
          definitionPairKeys.push(pair);
          definitionPairs.add(pair);
        }
      if (
        !definition.includes("成果物種別: IA定義") ||
        !definition.includes(`IA ID: \`${entry.name}\``) ||
        !definition.includes("## 意味と利用者成果") ||
        !definition.includes("## 対象・識別・関係") ||
        !definition.includes("## 状態と可視性") ||
        !definition.includes("## 導線と責任") ||
        !definition.includes("## 制約") ||
        !definition.includes("## 下流への引き渡し") ||
        !sourceSection ||
        ![...definitionPairs].some((pair) => pair.endsWith(`|${entry.name}`))
      )
        add(
          "error",
          "ia-definition-contract-invalid",
          relative(definitionPath),
          "Each canonical IA unit must be self-contained and cite at least one source IA analysis.",
        );
    }
  }
  if (
    isIaRegistryRowInvalid ||
    indexedIaIds.size !== actualIaIds.size ||
    [...indexedIaIds].some((id) => !actualIaIds.has(id)) ||
    [...actualIaIds].some((id) => !indexedIaIds.has(id))
  )
    add(
      "error",
      "ia-definition-index-coverage-mismatch",
      relative(iaIndexPath),
      "The IA registry and canonical definition directories must be an exact set.",
    );
  if (
    registryPairKeys.length !== registryPairs.size ||
    analysisPairKeys.length !== analysisPairs.size ||
    definitionPairKeys.length !== definitionPairs.size ||
    [...registryPairs].some((pair) => !analysisPairs.has(pair)) ||
    [...analysisPairs].some((pair) => !registryPairs.has(pair)) ||
    [...analysisPairs].some((pair) => !definitionPairs.has(pair)) ||
    [...definitionPairs].some((pair) => !analysisPairs.has(pair))
  )
    add(
      "error",
      "ia-analysis-definition-closure-mismatch",
      relative(iaIndexPath),
      "The IA registry, analysis dispositions, and definition source relations must form the same exact, duplicate-free (UX, IA) pair set in their canonical sections.",
    );
}

checkIaReconstruction();

function checkUiReconstruction(): void {
  if (repositoryMode !== "official") return;
  const uxDefinitionsRoot = path.join(root, "02_UX", "Definitions");
  const iaDefinitionsRoot = path.join(root, "03_IA", "Definitions");
  const uiIndexPath = path.join(root, "04_UI", "01_User_Interface.md");
  const uiAnalysisRoot = path.join(root, "04_UI", "Analysis");
  const uiDefinitionsRoot = path.join(root, "04_UI", "Definitions");
  if (!lstatIfPresent(uiIndexPath)?.isFile()) return;

  const requiredTemplates = [
    path.join(
      root,
      "template",
      "04_UI",
      "Analysis",
      "UX-XXXXXX",
      "ui_analysis.md",
    ),
    path.join(
      root,
      "template",
      "04_UI",
      "Analysis",
      "IA-XXXXXX",
      "ui_analysis.md",
    ),
    path.join(
      root,
      "template",
      "04_UI",
      "Definitions",
      "UI-XXXXXX",
      "ui_definition.md",
    ),
  ];
  for (const templatePath of requiredTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "ui-reconstruction-template-missing",
        relative(templatePath),
        "The official UI profile must include separate UX-view and IA-view analysis templates plus the integrated UI definition template.",
      );

  const exactSecondLevelSection = (sourceText: string, heading: string) => {
    const escaped = heading.replace(/[.*+?^$()|[\]{}\\]/gu, "\\$&");
    const headings = [
      ...sourceText.matchAll(new RegExp(`^## ${escaped}\\s*$`, "gmu")),
    ];
    if (headings.length !== 1) return null;
    const sectionStart = (headings[0].index ?? 0) + headings[0][0].length;
    const remaining = sourceText.slice(sectionStart);
    const nextHeading = remaining.search(/^## /mu);
    return nextHeading < 0 ? remaining : remaining.slice(0, nextHeading);
  };

  const canonicalIds = (
    definitionsRoot: string,
    prefix: "UX" | "IA",
    file: string,
  ) => {
    const ids = new Set<string>();
    if (!lstatIfPresent(definitionsRoot)?.isDirectory()) return ids;
    for (const entry of fs.readdirSync(definitionsRoot, {
      withFileTypes: true,
    }))
      if (
        entry.isDirectory() &&
        new RegExp(`^${prefix}-[0-9]{6}$`, "u").test(entry.name) &&
        lstatIfPresent(path.join(definitionsRoot, entry.name, file))?.isFile()
      )
        ids.add(entry.name);
    return ids;
  };
  const uxIds = canonicalIds(uxDefinitionsRoot, "UX", "ux_definition.md");
  const iaIds = canonicalIds(iaDefinitionsRoot, "IA", "ia_definition.md");

  const registryUiIds = new Set<string>();
  const registryUxUiKeys: string[] = [];
  const registryIaUiKeys: string[] = [];
  const registryUxUi = new Set<string>();
  const registryIaUi = new Set<string>();
  const uiIndex = visibleMarkdownStructure(read(uiIndexPath));
  for (const line of uiIndex.split(/\r?\n/u)) {
    const row = line.match(
      /^\| \[(UI-[0-9]{6})\]\(Definitions\/\1\/ui_definition\.md\) \| [^|]+ \| (?<uxCell>[^|]+) \| (?<iaCell>[^|]+) \|$/u,
    );
    if (!row?.groups?.uxCell || !row.groups.iaCell) continue;
    const uiId = row[1];
    registryUiIds.add(uiId);
    const rowUxIds = [...row.groups.uxCell.matchAll(/UX-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    const rowIaIds = [...row.groups.iaCell.matchAll(/IA-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    if (rowUxIds.length === 0 || rowIaIds.length === 0)
      add(
        "error",
        "ui-registry-row-invalid",
        relative(uiIndexPath),
        "Each UI registry row must identify at least one UX-view and IA-view input.",
      );
    for (const uxId of rowUxIds) {
      const key = `${uxId}|${uiId}`;
      registryUxUiKeys.push(key);
      registryUxUi.add(key);
    }
    for (const iaId of rowIaIds) {
      const key = `${iaId}|${uiId}`;
      registryIaUiKeys.push(key);
      registryIaUi.add(key);
    }
  }

  const analysisUxIds = new Set<string>();
  const analysisIaIds = new Set<string>();
  const analysisUxUiKeys: string[] = [];
  const analysisIaUiKeys: string[] = [];
  const analysisUxUi = new Set<string>();
  const analysisIaUi = new Set<string>();
  if (lstatIfPresent(uiAnalysisRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uiAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^(UX|IA)-[0-9]{6}$/u.test(entry.name))
        continue;
      const analysisPath = path.join(
        uiAnalysisRoot,
        entry.name,
        "ui_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      const analysis = visibleMarkdownStructure(read(analysisPath));
      const inputSection = exactSecondLevelSection(analysis, "1. 正式入力");
      const dispositionSection = exactSecondLevelSection(analysis, "5. UI処置");
      const isUxView = entry.name.startsWith("UX-");
      const sourcePattern = isUxView
        ? /UX定義: \[(UX-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/\.\.\/02_UX\/Definitions\/(UX-[0-9]{6})\/ux_definition\.md\)/u
        : /IA定義: \[(IA-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/\.\.\/03_IA\/Definitions\/(IA-[0-9]{6})\/ia_definition\.md\)/u;
      const sourceInput = inputSection?.match(sourcePattern);
      const oppositeInputPattern = isUxView
        ? /03_IA\/Definitions|IA-[0-9]{6}/u
        : /02_UX\/Definitions|UX-[0-9]{6}/u;
      const viewPairs = isUxView ? analysisUxUi : analysisIaUi;
      const viewPairKeys = isUxView ? analysisUxUiKeys : analysisIaUiKeys;
      for (const match of dispositionSection?.matchAll(
        /\[(UI-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/Definitions\/\1\/ui_definition\.md\)/gu,
      ) ?? []) {
        const key = `${entry.name}|${match[1]}`;
        viewPairKeys.push(key);
        viewPairs.add(key);
      }
      if (isUxView) analysisUxIds.add(entry.name);
      else analysisIaIds.add(entry.name);
      const requiredViewSections = isUxView
        ? [
            "## 2. UIへ引き継ぐ利用者成果",
            "## 3. 必要な認識・操作・Feedback",
            "## 4. 状況による体験差",
            "## 6. IA観点との統合時に確認すること",
          ]
        : [
            "## 2. UIへ引き継ぐ情報構造",
            "## 3. 表示の優先順位とNavigation",
            "## 4. 表示差と開示境界",
            "## 6. UX観点との統合時に確認すること",
          ];
      if (
        !analysis.includes(
          isUxView
            ? "成果物種別: UI分析（UX観点）"
            : "成果物種別: UI分析（IA観点）",
        ) ||
        !analysis.includes(`分析単位: \u0060${entry.name}\u0060`) ||
        !inputSection ||
        !sourceInput ||
        sourceInput[1] !== entry.name ||
        sourceInput[2] !== entry.name ||
        oppositeInputPattern.test(inputSection) ||
        /01_Discovery|REQ-[0-9]{6}/u.test(inputSection) ||
        !requiredViewSections.every((heading) => analysis.includes(heading)) ||
        !dispositionSection ||
        ![...viewPairs].some((key) => key.startsWith(`${entry.name}|`))
      )
        add(
          "error",
          isUxView
            ? "ui-ux-analysis-contract-invalid"
            : "ui-ia-analysis-contract-invalid",
          relative(analysisPath),
          "Each UI input must be analyzed independently from exactly its own UX or IA definition and must identify at least one UI disposition.",
        );
    }

  if (
    uxIds.size !== analysisUxIds.size ||
    [...uxIds].some((id) => !analysisUxIds.has(id)) ||
    [...analysisUxIds].some((id) => !uxIds.has(id))
  )
    add(
      "error",
      "ui-ux-analysis-coverage-mismatch",
      relative(uiIndexPath),
      "Every canonical UX definition must have exactly one UX-view UI analysis.",
    );
  if (
    iaIds.size !== analysisIaIds.size ||
    [...iaIds].some((id) => !analysisIaIds.has(id)) ||
    [...analysisIaIds].some((id) => !iaIds.has(id))
  )
    add(
      "error",
      "ui-ia-analysis-coverage-mismatch",
      relative(uiIndexPath),
      "Every canonical IA definition must have exactly one IA-view UI analysis.",
    );

  const actualUiIds = new Set<string>();
  const definitionUxUiKeys: string[] = [];
  const definitionIaUiKeys: string[] = [];
  const definitionUxUi = new Set<string>();
  const definitionIaUi = new Set<string>();
  if (lstatIfPresent(uiDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uiDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UI-[0-9]{6}$/u.test(entry.name)) continue;
      const definitionPath = path.join(
        uiDefinitionsRoot,
        entry.name,
        "ui_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualUiIds.add(entry.name);
      const definition = visibleMarkdownStructure(read(definitionPath));
      const uxSection = exactSecondLevelSection(definition, "UX観点の入力");
      const iaSection = exactSecondLevelSection(definition, "IA観点の入力");
      for (const match of uxSection?.matchAll(
        /\[(UX-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/ui_analysis\.md\)/gu,
      ) ?? []) {
        const key = `${match[1]}|${entry.name}`;
        definitionUxUiKeys.push(key);
        definitionUxUi.add(key);
      }
      for (const match of iaSection?.matchAll(
        /\[(IA-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/ui_analysis\.md\)/gu,
      ) ?? []) {
        const key = `${match[1]}|${entry.name}`;
        definitionIaUiKeys.push(key);
        definitionIaUi.add(key);
      }
      if (
        !definition.includes("成果物種別: UI定義") ||
        !definition.includes(`UI ID: \u0060${entry.name}\u0060`) ||
        !definition.includes("## 利用者成果") ||
        !uxSection ||
        !iaSection ||
        !definition.includes("## 両観点の統合判断") ||
        !definition.includes("## 表示面と情報の優先順位") ||
        !definition.includes("## 操作とFeedback") ||
        !definition.includes("## 状態と表示差") ||
        !definition.includes("## 視覚表現とアクセシビリティ") ||
        !definition.includes("## 制約") ||
        !definition.includes("## UI／SPEC対応レビューへ渡す項目") ||
        ![...definitionUxUi].some((key) => key.endsWith(`|${entry.name}`)) ||
        ![...definitionIaUi].some((key) => key.endsWith(`|${entry.name}`))
      )
        add(
          "error",
          "ui-definition-contract-invalid",
          relative(definitionPath),
          "Each canonical UI definition must integrate at least one UX-view analysis and one IA-view analysis.",
        );
    }

  if (
    registryUiIds.size !== actualUiIds.size ||
    [...registryUiIds].some((id) => !actualUiIds.has(id)) ||
    [...actualUiIds].some((id) => !registryUiIds.has(id))
  )
    add(
      "error",
      "ui-definition-index-coverage-mismatch",
      relative(uiIndexPath),
      "The UI registry and canonical UI definition directories must be an exact set.",
    );

  if (
    registryUxUiKeys.length !== registryUxUi.size ||
    registryIaUiKeys.length !== registryIaUi.size ||
    analysisUxUiKeys.length !== analysisUxUi.size ||
    analysisIaUiKeys.length !== analysisIaUi.size ||
    definitionUxUiKeys.length !== definitionUxUi.size ||
    definitionIaUiKeys.length !== definitionIaUi.size ||
    [...registryUxUi].some(
      (key) => !analysisUxUi.has(key) || !definitionUxUi.has(key),
    ) ||
    [...analysisUxUi].some(
      (key) => !registryUxUi.has(key) || !definitionUxUi.has(key),
    ) ||
    [...definitionUxUi].some(
      (key) => !registryUxUi.has(key) || !analysisUxUi.has(key),
    ) ||
    [...registryIaUi].some(
      (key) => !analysisIaUi.has(key) || !definitionIaUi.has(key),
    ) ||
    [...analysisIaUi].some(
      (key) => !registryIaUi.has(key) || !definitionIaUi.has(key),
    ) ||
    [...definitionIaUi].some(
      (key) => !registryIaUi.has(key) || !analysisIaUi.has(key),
    )
  )
    add(
      "error",
      "ui-analysis-definition-closure-mismatch",
      relative(uiIndexPath),
      "The UI registry, separate UX-view and IA-view analyses, and integrated UI definitions must form exact duplicate-free (UX, UI) and (IA, UI) relation sets.",
    );
}

checkUiReconstruction();

function checkSpecReconstruction(): void {
  if (repositoryMode !== "official") return;
  const sectionBody = (source: string, heading: string): string => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return (
      source.match(
        new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
      )?.[1] ?? ""
    );
  };
  const hasDuplicate = (values: string[]): boolean =>
    new Set(values).size !== values.length;
  const specIndexPath = path.join(
    root,
    "05_SPEC",
    "01_Behavior_Specification.md",
  );
  if (!lstatIfPresent(specIndexPath)?.isFile()) return;
  const specAnalysisRoot = path.join(root, "05_SPEC", "Analysis");
  const specDefinitionsRoot = path.join(root, "05_SPEC", "Definitions");
  const requiredTemplates = [
    path.join(
      root,
      "template",
      "05_SPEC",
      "Analysis",
      "UX-XXXXXX",
      "spec_analysis.md",
    ),
    path.join(
      root,
      "template",
      "05_SPEC",
      "Analysis",
      "IA-XXXXXX",
      "spec_analysis.md",
    ),
    path.join(
      root,
      "template",
      "05_SPEC",
      "Definitions",
      "SPEC-XXXXXX",
      "spec_definition.md",
    ),
  ];
  for (const templatePath of requiredTemplates)
    if (!lstatIfPresent(templatePath)?.isFile())
      add(
        "error",
        "spec-reconstruction-template-missing",
        relative(templatePath),
        "The official SPEC profile must include separate UX-view and IA-view analyses plus the integrated SPEC definition template.",
      );

  const definitionIds = (base: string, prefix: "UX" | "IA", file: string) => {
    const result = new Set<string>();
    if (!lstatIfPresent(base)?.isDirectory()) return result;
    for (const entry of fs.readdirSync(base, { withFileTypes: true }))
      if (
        entry.isDirectory() &&
        new RegExp(`^${prefix}-[0-9]{6}$`, "u").test(entry.name) &&
        lstatIfPresent(path.join(base, entry.name, file))?.isFile()
      )
        result.add(entry.name);
    return result;
  };
  const uxIds = definitionIds(
    path.join(root, "02_UX", "Definitions"),
    "UX",
    "ux_definition.md",
  );
  const iaIds = definitionIds(
    path.join(root, "03_IA", "Definitions"),
    "IA",
    "ia_definition.md",
  );
  const analyzedUx = new Set<string>();
  const analyzedIa = new Set<string>();
  const analysisRelationOccurrences: string[] = [];

  if (lstatIfPresent(specAnalysisRoot)?.isDirectory())
    for (const entry of fs.readdirSync(specAnalysisRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^(UX|IA)-[0-9]{6}$/u.test(entry.name))
        continue;
      const analysisPath = path.join(
        specAnalysisRoot,
        entry.name,
        "spec_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) continue;
      const source = visibleMarkdownStructure(read(analysisPath));
      const isUx = entry.name.startsWith("UX-");
      if (isUx) analyzedUx.add(entry.name);
      else analyzedIa.add(entry.name);
      const expectedInput = isUx
        ? `../../../02_UX/Definitions/${entry.name}/ux_definition.md`
        : `../../../03_IA/Definitions/${entry.name}/ia_definition.md`;
      const requiredHeadings = isUx
        ? [
            "## 2. 振る舞いへ引き継ぐ利用者成果",
            "## 3. 観測可能にする契機・結果・失敗",
            "## 4. 受入条件と適用範囲",
            "## 5. SPEC処置",
            "## 6. IA観点との統合時に確認すること",
          ]
        : [
            "## 2. 利用場面ごとに保持する意味",
            "## 3. 対象・識別・関係",
            "## 4. 状態・可視性・時間的意味",
            "## 5. 導線・責任・失敗時の保持",
            "## 6. SPEC処置",
            "## 7. UX観点との統合時に確認すること",
          ];
      const inputSection =
        source.match(/^## 1\. 正式入力\s*$([\s\S]*?)(?=^## )/mu)?.[1] ?? "";
      const dispositionSection = sectionBody(
        source,
        isUx ? "## 5. SPEC処置" : "## 6. SPEC処置",
      );
      const currentRelations: string[] = [];
      for (const match of dispositionSection.matchAll(
        /\[(SPEC-[0-9]{6})[^\]]*\]\(\.\.\/\.\.\/Definitions\/\1\/spec_definition\.md\)/gu,
      ))
        currentRelations.push(`${entry.name}|${match[1]}`);
      analysisRelationOccurrences.push(...currentRelations);
      if (
        !source.includes(
          isUx
            ? "成果物種別: SPEC分析（UX観点）"
            : "成果物種別: SPEC分析（IA観点）",
        ) ||
        !source.includes(`分析単位: \u0060${entry.name}\u0060`) ||
        !inputSection.includes(expectedInput) ||
        (isUx
          ? /03_IA\/Definitions|IA-[0-9]{6}|REQ-[0-9]{6}/u
          : /02_UX\/Definitions|UX-[0-9]{6}|REQ-[0-9]{6}/u
        ).test(inputSection) ||
        !requiredHeadings.every((heading) => source.includes(heading)) ||
        currentRelations.length === 0 ||
        hasDuplicate(currentRelations)
      )
        add(
          "error",
          isUx
            ? "spec-ux-analysis-contract-invalid"
            : "spec-ia-analysis-contract-invalid",
          relative(analysisPath),
          "Each SPEC input must be analyzed independently from exactly its own UX or IA definition and must identify at least one SPEC disposition.",
        );
    }

  if (
    uxIds.size !== analyzedUx.size ||
    [...uxIds].some((id) => !analyzedUx.has(id)) ||
    [...analyzedUx].some((id) => !uxIds.has(id))
  )
    add(
      "error",
      "spec-ux-analysis-coverage-mismatch",
      relative(specIndexPath),
      "Every canonical UX definition must have exactly one UX-view SPEC analysis.",
    );

  const analysisRelations = new Set(analysisRelationOccurrences);
  if (hasDuplicate(analysisRelationOccurrences))
    add(
      "error",
      "spec-analysis-relation-duplicate",
      relative(specAnalysisRoot),
      "A SPEC disposition relation must appear exactly once in its canonical analysis section.",
    );
  if (
    iaIds.size !== analyzedIa.size ||
    [...iaIds].some((id) => !analyzedIa.has(id)) ||
    [...analyzedIa].some((id) => !iaIds.has(id))
  )
    add(
      "error",
      "spec-ia-analysis-coverage-mismatch",
      relative(specIndexPath),
      "Every canonical IA definition must have exactly one IA-view SPEC analysis.",
    );

  const registryIds = new Set<string>();
  const registryIdOccurrences: string[] = [];
  const registryRelations = new Set<string>();
  const registryRelationOccurrences: string[] = [];
  const registryUiPairs = new Set<string>();
  const registryUiPairOccurrences: string[] = [];
  const index = visibleMarkdownStructure(read(specIndexPath));
  for (const line of index.split(/\r?\n/u)) {
    const row = line.match(
      /^\| \[(SPEC-[0-9]{6})\]\(Definitions\/\1\/spec_definition\.md\) \| [^|]+ \| (?<ux>[^|]+) \| (?<ia>[^|]+) \| (?<ui>[^|]+) \|$/u,
    );
    if (!row?.groups) continue;
    const specId = row[1];
    registryIdOccurrences.push(specId);
    registryIds.add(specId);
    for (const id of row.groups.ux.match(/UX-[0-9]{6}/gu) ?? []) {
      const relation = `${id}|${specId}`;
      registryRelationOccurrences.push(relation);
      registryRelations.add(relation);
    }
    for (const id of row.groups.ia.match(/IA-[0-9]{6}/gu) ?? []) {
      const relation = `${id}|${specId}`;
      registryRelationOccurrences.push(relation);
      registryRelations.add(relation);
    }
    for (const id of row.groups.ui.match(/UI-[0-9]{6}/gu) ?? []) {
      const relation = `${id}|${specId}`;
      registryUiPairOccurrences.push(relation);
      registryUiPairs.add(relation);
    }
  }

  if (
    hasDuplicate(registryIdOccurrences) ||
    hasDuplicate(registryRelationOccurrences) ||
    hasDuplicate(registryUiPairOccurrences)
  )
    add(
      "error",
      "spec-registry-relation-duplicate",
      relative(specIndexPath),
      "SPEC registry IDs and UX/IA/UI relations must each appear exactly once.",
    );

  const actualIds = new Set<string>();
  const definitionRelations = new Set<string>();
  const definitionRelationOccurrences: string[] = [];
  const definitionUiPairs = new Set<string>();
  const definitionUiPairOccurrences: string[] = [];
  if (lstatIfPresent(specDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(specDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^SPEC-[0-9]{6}$/u.test(entry.name))
        continue;
      const definitionPath = path.join(
        specDefinitionsRoot,
        entry.name,
        "spec_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualIds.add(entry.name);
      const source = visibleMarkdownStructure(read(definitionPath));
      const uxInputSection = sectionBody(source, "## UX観点の入力");
      const iaInputSection = sectionBody(source, "## IA観点の入力");
      for (const match of `${uxInputSection}\n${iaInputSection}`.matchAll(
        /\[(UX|IA)-([0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1-\2\/spec_analysis\.md\)/gu,
      )) {
        const relation = `${match[1]}-${match[2]}|${entry.name}`;
        definitionRelationOccurrences.push(relation);
        definitionRelations.add(relation);
      }
      const uiSection = sectionBody(source, "## 対応するUI");
      const uiPairLine =
        uiSection.match(/^- pairs_with:\s*(.+)$/mu)?.[1]?.trim() ?? "";
      for (const match of uiPairLine.matchAll(
        /\[(UI-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/04_UI\/Definitions\/\1\/ui_definition\.md\)/gu,
      )) {
        const relation = `${match[1]}|${entry.name}`;
        definitionUiPairOccurrences.push(relation);
        definitionUiPairs.add(relation);
      }
      const isNoDirectUi = uiPairLine === "Not Applicable";
      const hasMixedUiDisposition =
        uiPairLine.includes("Not Applicable") && !isNoDirectUi;
      const isNoDirectUiComplete =
        isNoDirectUi &&
        /^- 理由:\s*\S+/mu.test(uiSection) &&
        /^- 運用Feedback:\s*\S+/mu.test(uiSection) &&
        /^- 人間確認:\s*\S+/mu.test(uiSection);
      const requiredTokens = [
        "成果物種別: SPEC定義",
        `SPEC ID: \u0060${entry.name}\u0060`,
        "## 振る舞いの目的",
        "## UX観点の入力",
        "## IA観点の入力",
        "## 両観点の統合判断",
        "## 契機・事前条件・Authority",
        "## 振る舞い・状態・結果",
        "## 失敗・回復・副作用",
        "## 受入条件と検証義務",
        "## 対応するUI",
        "## 制約",
      ];
      if (
        !requiredTokens.every((token) => source.includes(token)) ||
        (!isNoDirectUi &&
          definitionUiPairOccurrences.filter((pair) =>
            pair.endsWith(`|${entry.name}`),
          ).length === 0) ||
        (isNoDirectUi && !isNoDirectUiComplete) ||
        (isNoDirectUi && /\[UI-[0-9]{6}\]/u.test(uiPairLine)) ||
        hasMixedUiDisposition
      )
        add(
          "error",
          "spec-definition-contract-invalid",
          relative(definitionPath),
          "Each SPEC definition must integrate UX-view and IA-view inputs into an observable behavior contract.",
        );
    }

  if (
    hasDuplicate(definitionRelationOccurrences) ||
    hasDuplicate(definitionUiPairOccurrences)
  )
    add(
      "error",
      "spec-definition-relation-duplicate",
      relative(specDefinitionsRoot),
      "SPEC input and pairs_with relations must each appear exactly once in their canonical sections.",
    );

  if (
    registryIds.size !== actualIds.size ||
    [...registryIds].some((id) => !actualIds.has(id)) ||
    [...actualIds].some((id) => !registryIds.has(id))
  )
    add(
      "error",
      "spec-definition-index-coverage-mismatch",
      relative(specIndexPath),
      "The SPEC registry and definition directories must be an exact set.",
    );
  if (
    [...registryRelations].some(
      (r) => !analysisRelations.has(r) || !definitionRelations.has(r),
    ) ||
    [...analysisRelations].some(
      (r) => !registryRelations.has(r) || !definitionRelations.has(r),
    ) ||
    [...definitionRelations].some(
      (r) => !registryRelations.has(r) || !analysisRelations.has(r),
    )
  )
    add(
      "error",
      "spec-analysis-definition-closure-mismatch",
      relative(specIndexPath),
      "The SPEC registry, separate analyses, and definitions must form the same UX/IA-to-SPEC relation set.",
    );

  const uiPairs = new Set<string>();
  const uiPairOccurrences: string[] = [];
  const uiDefinitionsRoot = path.join(root, "04_UI", "Definitions");
  if (lstatIfPresent(uiDefinitionsRoot)?.isDirectory())
    for (const entry of fs.readdirSync(uiDefinitionsRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^UI-[0-9]{6}$/u.test(entry.name)) continue;
      const file = path.join(uiDefinitionsRoot, entry.name, "ui_definition.md");
      if (!lstatIfPresent(file)?.isFile()) continue;
      const source = visibleMarkdownStructure(read(file));
      const pairSection = sectionBody(source, "## 対応するSPEC");
      const pairLine =
        pairSection.match(/^- pairs_with:\s*(.+)$/mu)?.[1]?.trim() ?? "";
      for (const match of pairLine.matchAll(
        /\[(SPEC-[0-9]{6})\]\(\.\.\/\.\.\/\.\.\/05_SPEC\/Definitions\/\1\/spec_definition\.md\)/gu,
      )) {
        const relation = `${entry.name}|${match[1]}`;
        uiPairOccurrences.push(relation);
        uiPairs.add(relation);
      }
    }
  if (hasDuplicate(uiPairOccurrences))
    add(
      "error",
      "ui-spec-pair-duplicate",
      relative(uiDefinitionsRoot),
      "Each UI-to-SPEC pairs_with relation must appear exactly once in its canonical section.",
    );
  if (
    [...registryUiPairs].some(
      (r) => !definitionUiPairs.has(r) || !uiPairs.has(r),
    ) ||
    [...definitionUiPairs].some(
      (r) => !registryUiPairs.has(r) || !uiPairs.has(r),
    ) ||
    [...uiPairs].some(
      (r) => !registryUiPairs.has(r) || !definitionUiPairs.has(r),
    )
  )
    add(
      "error",
      "ui-spec-pair-closure-mismatch",
      relative(specIndexPath),
      "UI and SPEC definitions plus the SPEC registry must expose the same duplicate-free pairs_with relation set.",
    );
}

checkSpecReconstruction();

function checkArchitectureReconstruction(): void {
  if (repositoryMode !== "official") return;
  const architectureIndexPath = path.join(
    root,
    "06_Architecture",
    "01_Architecture.md",
  );
  if (!lstatIfPresent(architectureIndexPath)?.isFile()) return;

  const sectionBody = (source: string, heading: string): string => {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    return (
      source.match(
        new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
      )?.[1] ?? ""
    );
  };
  const definitionIds = (
    phase: "04_UI" | "05_SPEC",
    prefix: "UI" | "SPEC",
    file: string,
  ): Set<string> => {
    const result = new Set<string>();
    const base = path.join(root, phase, "Definitions");
    if (!lstatIfPresent(base)?.isDirectory()) return result;
    for (const entry of fs.readdirSync(base, { withFileTypes: true }))
      if (
        entry.isDirectory() &&
        new RegExp(`^${prefix}-[0-9]{6}$`, "u").test(entry.name) &&
        lstatIfPresent(path.join(base, entry.name, file))?.isFile()
      )
        result.add(entry.name);
    return result;
  };
  const uiIds = definitionIds("04_UI", "UI", "ui_definition.md");
  const specIds = definitionIds("05_SPEC", "SPEC", "spec_definition.md");
  const analysisRoot = path.join(root, "06_Architecture", "Analysis");
  const analysisRelations = new Set<string>();
  const analyzedUi = new Set<string>();
  const analyzedSpec = new Set<string>();
  const actualAnalysisIds = new Set<string>();

  if (lstatIfPresent(analysisRoot)?.isDirectory())
    for (const entry of fs.readdirSync(analysisRoot, { withFileTypes: true }))
      if (
        entry.isDirectory() &&
        /^(?:UI|SPEC)-[0-9]{6}$/u.test(entry.name) &&
        lstatIfPresent(
          path.join(analysisRoot, entry.name, "architecture_analysis.md"),
        )?.isFile()
      )
        actualAnalysisIds.add(entry.name);

  for (const [kind, ids] of [
    ["UI", uiIds],
    ["SPEC", specIds],
  ] as const)
    for (const id of ids) {
      const analysisPath = path.join(
        analysisRoot,
        id,
        "architecture_analysis.md",
      );
      if (!lstatIfPresent(analysisPath)?.isFile()) {
        add(
          "error",
          "architecture-analysis-missing",
          relative(analysisPath),
          `Every canonical ${kind} definition must have exactly one Architecture analysis.`,
        );
        continue;
      }
      const source = visibleMarkdownStructure(read(analysisPath));
      const inputSection = sectionBody(source, "## 1. 正式入力");
      const expectedInput =
        kind === "UI"
          ? `../../../04_UI/Definitions/${id}/ui_definition.md`
          : `../../../05_SPEC/Definitions/${id}/spec_definition.md`;
      const forbiddenInput =
        kind === "UI"
          ? /01_Discovery|02_UX|03_IA|05_SPEC|40_Develop/u
          : /01_Discovery|02_UX|03_IA|04_UI|40_Develop/u;
      const requiredHeadings =
        kind === "UI"
          ? [
              "## 2. Architectureへ引き継ぐUI契約",
              "## 3. Architecture観点の分析",
              "## 4. Architecture処置",
              "## 5. SPEC観点との統合時に確認すること",
            ]
          : [
              "## 2. Architectureへ引き継ぐSPEC契約",
              "## 3. Architecture観点の分析",
              "## 4. Architecture処置",
              "## 5. UI観点との統合時に確認すること",
            ];
      const disposition = sectionBody(source, "## 4. Architecture処置");
      const relations = [
        ...disposition.matchAll(
          /\]\(\.\.\/\.\.\/Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
        ),
      ].map((match) => `${id}|${match[1]}`);
      if (kind === "UI") analyzedUi.add(id);
      else analyzedSpec.add(id);
      for (const relation of relations) analysisRelations.add(relation);
      if (
        !source.includes(`成果物種別: Architecture分析（${kind}観点）`) ||
        !source.includes(`分析単位: \u0060${id}\u0060`) ||
        !inputSection.includes(expectedInput) ||
        forbiddenInput.test(inputSection) ||
        !requiredHeadings.every((heading) => source.includes(heading)) ||
        relations.length === 0 ||
        new Set(relations).size !== relations.length
      )
        add(
          "error",
          "architecture-analysis-contract-invalid",
          relative(analysisPath),
          "Each Architecture analysis must use exactly its own UI or SPEC definition as formal input and identify one or more duplicate-free responsibility definitions.",
        );
    }

  if (analyzedUi.size !== uiIds.size || analyzedSpec.size !== specIds.size)
    add(
      "error",
      "architecture-analysis-coverage-mismatch",
      relative(architectureIndexPath),
      "Architecture must analyze every canonical UI and SPEC definition exactly once.",
    );
  const expectedAnalysisIds = new Set([...uiIds, ...specIds]);
  if (
    actualAnalysisIds.size !== expectedAnalysisIds.size ||
    [...actualAnalysisIds].some((id) => !expectedAnalysisIds.has(id)) ||
    [...expectedAnalysisIds].some((id) => !actualAnalysisIds.has(id))
  )
    add(
      "error",
      "architecture-analysis-directory-coverage-mismatch",
      relative(analysisRoot),
      "Architecture analysis directories and canonical UI/SPEC definitions must be an exact set.",
    );

  const index = visibleMarkdownStructure(read(architectureIndexPath));
  const crossModelSection = sectionBody(index, "## Architecture横断モデル");
  const crossModels: ReadonlyArray<{
    file: string;
    headings: readonly string[];
    sectionStructures: ReadonlyArray<readonly [string, readonly string[]]>;
  }> = [
    {
      file: "02_Component_and_Responsibility_Model.md",
      headings: [
        "## 2. 全体ブロック図",
        "## 3. Component責務表",
        "## 5. QAへ渡す検証単位",
      ],
      sectionStructures: [
        ["## 2. 全体ブロック図", ["```text"]],
        [
          "## 3. Component責務表",
          [
            "| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 所有しないこと |",
          ],
        ],
      ],
    },
    {
      file: "03_Boundary_and_Interface_Model.md",
      headings: [
        "## 2. 境界表",
        "## 3. 型とPortの関係",
        "## 4. 主要なブロック間シーケンス",
        "## 6. Qualityへの引渡し",
      ],
      sectionStructures: [
        [
          "## 2. 境界表",
          ["| 境界 | 呼出し側 | 受け側 | 越えるもの | 越えないもの | 不明時 |"],
        ],
        ["## 3. 型とPortの関係", ["```text"]],
        [
          "## 5. Schema責務",
          ["| 情報 | Canonical Owner | Writer | Reader | 所有禁止 |"],
        ],
      ],
    },
    {
      file: "04_Runtime_and_Data_Flow_Model.md",
      headings: [
        "## 2. 主要データフロー",
        "## 3. 横断状態遷移",
        "## 4. 概念Entity関係",
        "## 6. Qualityへの引渡し",
      ],
      sectionStructures: [
        ["## 2. 主要データフロー", ["<<E", "(P", "[(D"]],
        [
          "## 3. 横断状態遷移",
          [
            "[S",
            "| 現在状態 | 契機 | 事前条件 | 処置 | Effect | 次状態 | 失敗時 | cleanup・Recovery | 終了後観測 |",
          ],
        ],
        ["## 4. 概念Entity関係", ["[ER"]],
        ["## 5. 整合条件", ["| 対象 | 必須の相関 | 禁止する畳み込み |"]],
      ],
    },
    {
      file: "05_Failure_Recovery_and_Resilience_Model.md",
      headings: [
        "## 2. 故障と回復の全体図",
        "## 3. Failure Matrix",
        "## 4. 回復の不変条件",
        "## 6. Qualityへの引渡し",
      ],
      sectionStructures: [
        ["## 2. 故障と回復の全体図", ["```text"]],
        [
          "## 3. Failure Matrix",
          [
            "| 故障領域 | 対象Component | 守る対象 | 即時処置 | 回復／終了条件 |",
          ],
        ],
      ],
    },
    {
      file: "06_Deployment_and_Execution_Model.md",
      headings: [
        "## 2. 論理配置図",
        "## 3. 実行単位とResource",
        "## 4. 段階的な結合単位",
        "## 5. Reality Auditへの引渡し",
        "## 6. Qualityへの引渡し",
      ],
      sectionStructures: [
        ["## 2. 論理配置図", ["```text"]],
        [
          "## 3. 実行単位とResource",
          ["| 論理単位 | 主なResource | 並行性の境界 | 終了条件 |"],
        ],
        ["## 4. 段階的な結合単位", ["| 段階 | 主な目的 | 対象境界 |"]],
        [
          "## 5. Reality Auditへの引渡し",
          ["| 照合対象 | 確認すること | 参照先 |"],
        ],
      ],
    },
  ];
  if (crossModelSection.trim().length === 0)
    add(
      "error",
      "architecture-cross-model-section-missing",
      relative(architectureIndexPath),
      "The official Architecture reconstruction must register all cross-cutting models before Architecture Ready.",
    );
  else {
    for (const model of crossModels) {
      const modelPath = path.join(root, "06_Architecture", model.file);
      if (!lstatIfPresent(modelPath)?.isFile()) {
        add(
          "error",
          "architecture-cross-model-missing",
          relative(modelPath),
          "Every declared Architecture cross-cutting model must exist before Architecture Ready.",
        );
        continue;
      }
      const rawModelSource = visibleMarkdownIncludingFencedCode(
        read(modelPath),
      );
      const modelSource = visibleMarkdownStructure(rawModelSource);
      if (
        !crossModelSection.includes(`](${model.file})`) ||
        !model.headings.every((heading) => modelSource.includes(heading)) ||
        !model.sectionStructures.every(([heading, structures]) => {
          const body = sectionBody(rawModelSource, heading);
          return structures.every((structure) => body.includes(structure));
        })
      )
        add(
          "error",
          "architecture-cross-model-contract-invalid",
          relative(modelPath),
          "Architecture cross-cutting models must be registered and expose their required responsibility, boundary, flow, failure, deployment, and Quality handoff structures.",
        );
    }
  }
  const registrySection = sectionBody(index, "## Architecture定義台帳");
  const registryDefinitions = new Set<string>();
  const registryDefinitionEntries: string[] = [];
  const registryRelationEntries: string[] = [];
  for (const line of registrySection.split(/\r?\n/u)) {
    const definition = line.match(
      /\]\(Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/u,
    )?.[1];
    if (!definition) continue;
    registryDefinitionEntries.push(definition);
    registryDefinitions.add(definition);
    for (const input of line.matchAll(/(?:UI|SPEC)-[0-9]{6}/gu))
      registryRelationEntries.push(`${input[0]}|${definition}`);
  }
  const registryRelations = new Set(registryRelationEntries);

  const definitionRoot = path.join(root, "06_Architecture", "Definitions");
  const actualDefinitions = new Set<string>();
  const definitionRelations = new Set<string>();
  const definitionRelationEntries: string[] = [];
  if (lstatIfPresent(definitionRoot)?.isDirectory())
    for (const entry of fs.readdirSync(definitionRoot, {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || !/^ARCH-[0-9]{6}$/u.test(entry.name))
        continue;
      const definitionPath = path.join(
        definitionRoot,
        entry.name,
        "architecture_definition.md",
      );
      if (!lstatIfPresent(definitionPath)?.isFile()) continue;
      actualDefinitions.add(entry.name);
      const source = visibleMarkdownStructure(read(definitionPath));
      const uiSection = sectionBody(source, "## 2. UI観点の入力");
      const specSection = sectionBody(source, "## 3. SPEC観点の入力");
      const relations = [
        ...`${uiSection}\n${specSection}`.matchAll(
          /\[((?:UI|SPEC)-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/architecture_analysis\.md\)/gu,
        ),
      ].map((match) => `${match[1]}|${entry.name}`);
      for (const relation of relations) {
        definitionRelationEntries.push(relation);
        definitionRelations.add(relation);
      }
      const requiredHeadings = [
        "## 1. 責務と境界",
        "## 2. UI観点の入力",
        "## 3. SPEC観点の入力",
        "## 4. 両観点の統合判断",
        "## 5. 構造と依存方向",
        "## 6. データ・状態・Interface",
        "## 7. 失敗・回復・観測",
        "## 8. 品質・保護・運用",
        "## 9. 互換性・移行・成立済み能力",
        "## 10. 実装と検証への引き渡し",
        "## 11. 情報源と現行照合",
      ];
      const requiredStructures = [
        "| 状態Owner |",
        "| 所有する責務 |",
        "| 所有しない責務 |",
        "| 主な外部境界 |",
        "| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |",
        "| 入力 | State Owner | Authority | Effect／非該当 |",
        "| 入力 | 保護する失敗境界 | 検証可能性 |",
        "| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |",
      ];
      const hasPlaceholderOnlySection = requiredHeadings.some((heading) => {
        const body = sectionBody(source, heading).trim();
        const firstParagraph = body.split(/\n\s*\n/u)[0]?.trim() ?? "";
        return /^(?:責務|統合|構造|状態|失敗|品質|移行|引渡し|照合)[。.]?$/u.test(
          firstParagraph,
        );
      });
      if (
        !source.includes("成果物種別: Architecture定義") ||
        !source.includes(`Architecture ID: \u0060${entry.name}\u0060`) ||
        !requiredHeadings.every((heading) => source.includes(heading)) ||
        !requiredStructures.every((fragment) => source.includes(fragment)) ||
        hasPlaceholderOnlySection ||
        !/UI-[0-9]{6}/u.test(uiSection) ||
        !/SPEC-[0-9]{6}/u.test(specSection)
      )
        add(
          "error",
          "architecture-definition-contract-invalid",
          relative(definitionPath),
          "Each Architecture definition must integrate at least one UI analysis and one SPEC analysis into a self-contained responsibility definition.",
        );
    }

  if (
    registryDefinitionEntries.length !== registryDefinitions.size ||
    registryDefinitions.size !== actualDefinitions.size ||
    [...registryDefinitions].some((id) => !actualDefinitions.has(id)) ||
    [...actualDefinitions].some((id) => !registryDefinitions.has(id))
  )
    add(
      "error",
      "architecture-definition-index-coverage-mismatch",
      relative(architectureIndexPath),
      "The Architecture registry and responsibility definition directories must be an exact set.",
    );

  const componentModelPath = path.join(
    root,
    "06_Architecture",
    "02_Component_and_Responsibility_Model.md",
  );
  if (lstatIfPresent(componentModelPath)?.isFile()) {
    const componentSource = visibleMarkdownStructure(read(componentModelPath));
    const componentSection = sectionBody(
      componentSource,
      "## 3. Component責務表",
    );
    const componentDefinitionEntries = [
      ...componentSection.matchAll(
        /\]\(Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
      ),
    ].map((match) => match[1]);
    const componentDefinitions = new Set(componentDefinitionEntries);
    if (
      componentDefinitionEntries.length !== componentDefinitions.size ||
      componentDefinitions.size !== actualDefinitions.size ||
      [...componentDefinitions].some((id) => !actualDefinitions.has(id)) ||
      [...actualDefinitions].some((id) => !componentDefinitions.has(id))
    )
      add(
        "error",
        "architecture-component-definition-coverage-mismatch",
        relative(componentModelPath),
        "The Component responsibility table must link every Architecture definition exactly once, without unknown or duplicate definitions.",
      );
  }

  const detailMapPath = path.join(
    root,
    "06_Architecture",
    "07_Detail_Architecture_Map.md",
  );
  const detailRoot = path.join(root, "06_Architecture", "Details");
  const detailMapRelations = new Set<string>();
  const detailMapClosureRelations = new Set<string>();
  const detailDocumentRelations = new Set<string>();
  const detailCoveredDefinitions = new Set<string>();
  const registeredDetailAreas = new Set<string>();
  const actualDetailAreas = new Set<string>();
  const isArchitectureReady = /Status:\s*Architecture Ready\b/u.test(index);
  if (!lstatIfPresent(detailMapPath)?.isFile())
    add(
      "error",
      "architecture-detail-map-missing",
      relative(detailMapPath),
      "Architecture must map every ARCH-ID to one or more detailed design areas before Architecture Ready.",
    );
  else {
    const source = visibleMarkdownStructure(read(detailMapPath));
    const areaSection = sectionBody(source, "## 2. 詳細設計領域");
    const closureSection = sectionBody(source, "## 3. Architecture定義の閉包");
    for (const line of areaSection.split(/\r?\n/u)) {
      const area = line.match(
        /\]\(Details\/([a-z0-9-]+)\/01_Architecture\.md\)/u,
      )?.[1];
      if (!area) continue;
      registeredDetailAreas.add(area);
      for (const id of line.matchAll(/ARCH-[0-9]{6}/gu))
        detailMapRelations.add(`${area}|${id[0]}`);
    }
    const closureIds = new Set(
      [...closureSection.matchAll(/\| (ARCH-[0-9]{6}) \|/gu)].map(
        (match) => match[1],
      ),
    );
    for (const line of closureSection.split(/\r?\n/u)) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      const id = cells[0]?.match(/^ARCH-[0-9]{6}$/u)?.[0];
      if (!id || !cells[2]) continue;
      for (const area of cells[2].split("、").map((item) => item.trim()))
        if (/^[a-z0-9-]+$/u.test(area))
          detailMapClosureRelations.add(`${area}|${id}`);
    }
    if (
      !areaSection.includes(
        "| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |",
      ) ||
      !closureSection.includes(
        "| Architecture定義 | 基本設計 | 接続する詳細設計領域 |",
      ) ||
      closureIds.size !== actualDefinitions.size ||
      [...actualDefinitions].some((id) => !closureIds.has(id))
    )
      add(
        "error",
        "architecture-detail-map-contract-invalid",
        relative(detailMapPath),
        "The detail map must expose the area registry and close every canonical ARCH-ID exactly once in its definition closure table.",
      );
  }
  if (lstatIfPresent(detailRoot)?.isDirectory())
    for (const entry of fs.readdirSync(detailRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^[a-z0-9-]+$/u.test(entry.name)) continue;
      actualDetailAreas.add(entry.name);
      const detailPath = path.join(
        detailRoot,
        entry.name,
        "01_Architecture.md",
      );
      if (!lstatIfPresent(detailPath)?.isFile()) {
        add(
          "error",
          "architecture-detail-document-missing",
          relative(detailPath),
          "Every detailed design area must have one self-contained 01_Architecture.md.",
        );
        continue;
      }
      const source = visibleMarkdownStructure(read(detailPath));
      const relationSection = sectionBody(source, "## 基本設計との関係");
      let areaRelationCount = 0;
      let hasInvalidRelation = false;
      const areaRelationIds = new Set<string>();
      for (const match of relationSection.matchAll(
        /\]\(\.\.\/\.\.\/Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
      )) {
        detailDocumentRelations.add(`${entry.name}|${match[1]}`);
        areaRelationCount += 1;
        if (areaRelationIds.has(match[1])) hasInvalidRelation = true;
        areaRelationIds.add(match[1]);
      }
      for (const line of relationSection.split(/\r?\n/u)) {
        if (!/^\| \[ARCH-[0-9]{6}\]/u.test(line)) continue;
        const cells = line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
        if (
          cells.length !== 3 ||
          !cells[1] ||
          !["Covered", "Partial", "Missing"].includes(cells[2] ?? "")
        )
          hasInvalidRelation = true;
        const relationId = cells[0]?.match(/ARCH-[0-9]{6}/u)?.[0];
        if (relationId && cells[2] === "Covered")
          detailCoveredDefinitions.add(relationId);
      }
      const applicability = sectionBody(source, "## 詳細成果物の適用判断");
      const concerns = sectionBody(source, "## Engineering Concern評価");
      const qualityHandoff = sectionBody(source, "## Qualityへの引渡し");
      const applicabilityRows = applicability
        .split(/\r?\n/u)
        .filter((line) => /^\| [^|-]/u.test(line));
      const concernRows = concerns
        .split(/\r?\n/u)
        .filter((line) => /^\| [^|-]/u.test(line));
      const expectedApplicability = new Set([
        "Component Model",
        "Interface Model",
        "Data Flow",
        "State Model",
        "Sequence",
        "Failure／Recovery",
        "Deployment",
        "Observability",
        "Security Boundary",
      ]);
      const expectedConcerns = new Set([
        "Concurrency",
        "Timing",
        "Resource Lifecycle",
        "External Boundary",
        "Failure／Recovery",
      ]);
      const applicabilityNames = applicabilityRows
        .slice(1)
        .map((line) => line.split("|").slice(1, -1)[0]?.trim() ?? "");
      const concernNames = concernRows
        .slice(1)
        .map((line) => line.split("|").slice(1, -1)[0]?.trim() ?? "");
      const hasInvalidApplicability = applicabilityRows
        .slice(1)
        .some((line) => {
          const cells = line
            .split("|")
            .slice(1, -1)
            .map((cell) => cell.trim());
          return (
            cells.length !== 4 ||
            !["Required", "N/A"].includes(cells[1] ?? "") ||
            !cells[2] ||
            !cells[3] ||
            (cells[1] === "Required" &&
              !/\]\([^)]*(?:\.md)?#[^)]+\)/u.test(cells[3]))
          );
        });
      const hasInvalidConcern = concernRows.slice(1).some((line) => {
        const cells = line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim());
        return (
          cells.length !== 4 ||
          !["PASS", "N/A", "OPEN", "FAIL"].includes(cells[1] ?? "") ||
          !cells[2] ||
          !cells[3]
        );
      });
      const hasInvalidQualityHandoff =
        !qualityHandoff.includes(
          "| 検証単位 | 対象 | 正常条件 | 反証する失敗 | 観測 | 終了後条件 | 未確認 |",
        ) ||
        !qualityHandoff
          .split(/\r?\n/u)
          .filter((line) => /^\| [^|-]/u.test(line))
          .slice(1)
          .some((line) => {
            const cells = line
              .split("|")
              .slice(1, -1)
              .map((cell) => cell.trim());
            return cells.length === 7 && cells.every(Boolean);
          });
      const hasIncompleteApplicability =
        applicabilityNames.length !== expectedApplicability.size ||
        new Set(applicabilityNames).size !== expectedApplicability.size ||
        [...expectedApplicability].some(
          (name) => !applicabilityNames.includes(name),
        );
      const hasIncompleteConcerns =
        concernNames.length !== expectedConcerns.size ||
        new Set(concernNames).size !== expectedConcerns.size ||
        [...expectedConcerns].some((name) => !concernNames.includes(name));
      const hasUnresolvedWhenReady =
        isArchitectureReady &&
        (relationSection.includes("| Missing |") ||
          concernRows
            .slice(1)
            .some((line) => /\| (?:OPEN|FAIL) \|/u.test(line)));
      if (
        !source.includes("成果物種別: Architecture詳細設計") ||
        !source.includes(`詳細設計領域: ${entry.name}`) ||
        !source.includes("## Qualityへの引渡し") ||
        !source.includes("## 現行実装との照合") ||
        !applicability.includes(
          "| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |",
        ) ||
        !concerns.includes(
          "| Concern | Result | Rationale | Evidence／Related ID |",
        ) ||
        areaRelationCount === 0 ||
        hasInvalidRelation ||
        hasIncompleteApplicability ||
        hasIncompleteConcerns ||
        hasInvalidApplicability ||
        hasInvalidConcern ||
        hasInvalidQualityHandoff ||
        hasUnresolvedWhenReady
      )
        add(
          "error",
          "architecture-detail-contract-invalid",
          relative(detailPath),
          "Each detailed design area must expose unique relation states, all nine applicability decisions, all five concern decisions, a structured Quality handoff, and no unresolved item when Architecture Ready.",
        );
    }
  if (
    registeredDetailAreas.size !== actualDetailAreas.size ||
    [...registeredDetailAreas].some((area) => !actualDetailAreas.has(area)) ||
    [...actualDetailAreas].some((area) => !registeredDetailAreas.has(area))
  )
    add(
      "error",
      "architecture-detail-area-coverage-mismatch",
      relative(detailMapPath),
      "The detailed design registry and Details directories must be an exact set.",
    );
  if (
    detailMapRelations.size !== detailDocumentRelations.size ||
    [...detailMapRelations].some(
      (relation) => !detailDocumentRelations.has(relation),
    ) ||
    [...detailDocumentRelations].some(
      (relation) => !detailMapRelations.has(relation),
    ) ||
    detailMapRelations.size !== detailMapClosureRelations.size ||
    [...detailMapRelations].some(
      (relation) => !detailMapClosureRelations.has(relation),
    ) ||
    [...detailMapClosureRelations].some(
      (relation) => !detailMapRelations.has(relation),
    ) ||
    [...actualDefinitions].some(
      (id) =>
        ![...detailMapRelations].some((relation) =>
          relation.endsWith(`|${id}`),
        ),
    )
  )
    add(
      "error",
      "architecture-detail-relation-closure-mismatch",
      relative(detailMapPath),
      "The detail map and area documents must expose the same many-to-many ARCH-ID relation set, covering every definition.",
    );
  if (
    isArchitectureReady &&
    [...actualDefinitions].some((id) => !detailCoveredDefinitions.has(id))
  )
    add(
      "error",
      "architecture-detail-covered-owner-missing",
      relative(detailMapPath),
      "Every canonical ARCH-ID must have at least one Covered detailed-design owner before Architecture Ready; Partial relations may only support that owner.",
    );
  if (
    registryRelationEntries.length !== registryRelations.size ||
    definitionRelationEntries.length !== definitionRelations.size
  )
    add(
      "error",
      "architecture-relation-duplicate",
      relative(architectureIndexPath),
      "Architecture registry and responsibility definitions must not repeat the same input-to-responsibility relation.",
    );
  if (
    analysisRelations.size !== definitionRelations.size ||
    [...analysisRelations].some(
      (relation) => !definitionRelations.has(relation),
    ) ||
    [...definitionRelations].some(
      (relation) => !analysisRelations.has(relation),
    )
  )
    add(
      "error",
      "architecture-analysis-definition-closure-mismatch",
      relative(architectureIndexPath),
      "UI/SPEC analyses and Architecture definitions must expose the same duplicate-free input-to-responsibility relation set.",
    );
  if (
    registryRelations.size !== analysisRelations.size ||
    [...registryRelations].some(
      (relation) => !analysisRelations.has(relation),
    ) ||
    [...analysisRelations].some((relation) => !registryRelations.has(relation))
  )
    add(
      "error",
      "architecture-registry-relation-closure-mismatch",
      relative(architectureIndexPath),
      "The Architecture registry must expose the same UI/SPEC-to-responsibility relation set as the analyses and definitions.",
    );
}

checkArchitectureReconstruction();

function checkQualityReconstruction(): void {
  if (repositoryMode !== "official") return;

  const qualityRoot = path.join(root, "07_Quality");
  const analysisRoot = path.join(qualityRoot, "Analysis");
  const phaseAnalysisSpecs = ["REQ", "UX", "IA", "UI", "SPEC", "ARCH"] as const;
  const phaseAnalysisPaths = phaseAnalysisSpecs.map((prefix) =>
    path.join(analysisRoot, prefix, "quality_analysis.md"),
  );
  const analysisPath = path.join(qualityRoot, "04_Quality_Integration.md");
  const architectureIndexPath = path.join(
    root,
    "06_Architecture",
    "01_Architecture.md",
  );
  if (!lstatIfPresent(architectureIndexPath)?.isFile()) return;
  if (
    !lstatIfPresent(analysisPath)?.isFile() ||
    phaseAnalysisPaths.some((phasePath) => !lstatIfPresent(phasePath)?.isFile())
  ) {
    add(
      "error",
      "quality-canonical-mapping-missing",
      relative(analysisRoot),
      "The official repository must keep one origin-based Quality analysis for REQ, UX, IA, UI, SPEC, and ARCH plus one Quality Integration result.",
    );
    return;
  }

  const templateQualityRoot = path.join(root, "template", "07_Quality");
  const requiredQualityFiles = [
    "01_Quality_Center.md",
    "02_Quality_Strategy.md",
    "03_Verification_Design.md",
    "04_Quality_Integration.md",
    "05_Current_Implementation_Reality_Audit.md",
  ] as const;
  const requiredTemplateQualityFiles = [
    ...requiredQualityFiles,
    "99_Verification_Result_Format.md",
  ] as const;
  for (const [qualityStructureRoot, requiredFiles] of [
    [qualityRoot, requiredQualityFiles],
    [templateQualityRoot, requiredTemplateQualityFiles],
  ] as const) {
    for (const fileName of requiredFiles) {
      const filePath = path.join(qualityStructureRoot, fileName);
      if (
        !lstatIfPresent(filePath)?.isFile() ||
        pathContainsSymbolicLink(filePath)
      )
        add(
          "error",
          "quality-current-profile-file-missing",
          relative(filePath),
          "The CRDD official current profile must keep the complete numbered Quality root file set and the template-only 99 verification-result helper.",
        );
    }
    const requiredDirectories =
      qualityStructureRoot === qualityRoot
        ? ["Analysis", "Definitions", "Registry"]
        : ["Analysis", "Definitions"];
    for (const directoryName of requiredDirectories) {
      const directoryPath = path.join(qualityStructureRoot, directoryName);
      const stat = lstatIfPresent(directoryPath);
      if (!stat?.isDirectory() || pathContainsSymbolicLink(directoryPath))
        add(
          "error",
          "quality-repository-structure-invalid",
          relative(directoryPath),
          "Quality Analysis, Definitions, and the official machine-consumer Registry must remain in their current-profile directories.",
        );
    }
  }
  for (const registryFileName of [
    "test-catalog.json",
    "coordinator-runtime-traceability.json",
    "project-runtime-design-traceability.json",
  ]) {
    const registryFilePath = path.join(
      qualityRoot,
      "Registry",
      registryFileName,
    );
    if (
      !lstatIfPresent(registryFilePath)?.isFile() ||
      pathContainsSymbolicLink(registryFilePath)
    )
      add(
        "error",
        "quality-current-profile-registry-missing",
        relative(registryFilePath),
        "The CRDD official repository currently has machine consumers for all three Quality Registry contracts.",
      );
  }
  for (const legacyRelativePath of [
    "07_Quality/04_Test_Catalog.json",
    "07_Quality/05_Coordinator_Runtime_Traceability.json",
    "07_Quality/06_Project_Runtime_Design_Traceability.json",
    "07_Quality/Analysis/canonical-definition-mapping",
    "07_Quality/Analysis/current-implementation-reality",
    "template/07_Quality/04_Verification_Result_Format.md",
    "template/07_Quality/Analysis/_Template",
    "template/07_Quality/Definitions/_Template",
    "template/07_Quality/Evidence",
  ]) {
    const legacyPath = path.join(root, legacyRelativePath);
    if (lstatIfPresent(legacyPath))
      add(
        "error",
        "quality-legacy-layout-reintroduced",
        relative(legacyPath),
        "The CRDD official current profile must not reintroduce a superseded Quality path or shared Evidence container.",
      );
  }

  const phaseAnalyses = phaseAnalysisPaths.map((phasePath) => read(phasePath));
  const analysis = read(analysisPath);
  const mappingSections = phaseAnalyses.map(
    (phaseAnalysis) =>
      phaseAnalysis.match(/^## 2\. 全件処置\s*$([\s\S]*?)(?=^##\s)/mu)?.[1],
  );
  if (mappingSections.some((section) => !section)) {
    add(
      "error",
      "quality-canonical-mapping-section-missing",
      relative(analysisRoot),
      "Every phase Quality analysis must expose its canonical sources in the '全件処置' section instead of satisfying coverage through IDs mentioned elsewhere.",
    );
    return;
  }
  const mappingSection = mappingSections.join("\n");

  const canonicalDefinitionSpecs = [
    ["01_Discovery", "REQ", "requirement.md"],
    ["02_UX", "UX", "ux_definition.md"],
    ["03_IA", "IA", "ia_definition.md"],
    ["04_UI", "UI", "ui_definition.md"],
    ["05_SPEC", "SPEC", "spec_definition.md"],
    ["06_Architecture", "ARCH", "architecture_definition.md"],
  ] as const;
  const canonicalIds = new Set<string>();
  for (const [
    phaseDirectory,
    prefix,
    definitionFile,
  ] of canonicalDefinitionSpecs) {
    const definitionsRoot = path.join(root, phaseDirectory, "Definitions");
    if (!lstatIfPresent(definitionsRoot)?.isDirectory()) continue;
    for (const entry of fs.readdirSync(definitionsRoot, {
      withFileTypes: true,
    }))
      if (
        entry.isDirectory() &&
        new RegExp(`^${prefix}-[0-9]{6}$`, "u").test(entry.name) &&
        lstatIfPresent(
          path.join(definitionsRoot, entry.name, definitionFile),
        )?.isFile()
      )
        canonicalIds.add(entry.name);
  }

  const mappingRows = mappingSection
    .split(/\r?\n/u)
    .filter((line) =>
      /^\|\s*\[(?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6}\]\(/u.test(line),
    );
  const mappedIds = new Set(
    mappingRows.flatMap((line) => {
      const match = line.match(
        /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\(/u,
      );
      return match ? [match[1]] : [];
    }),
  );
  const summarySourceGoalRelations = new Set<string>();
  const summarySourceGoalRelationEntries: string[] = [];
  const summarySourceLevels = new Map<string, Set<string>>();
  const goalLabelToSlug = new Map<string, string>();
  for (const line of mappingRows) {
    const sourceId = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\(/u,
    )?.[1];
    if (!sourceId) continue;
    const mappingCells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    const requestedLevels = new Set(
      Array.from(
        mappingCells[4]?.matchAll(/UT|IT|ST|UAT/gu) ?? [],
        (match) => match[0],
      ),
    );
    for (const goal of line.matchAll(
      /\[([^\]]+)\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
    )) {
      goalLabelToSlug.set(goal[1], goal[2]);
      const relation = `${sourceId}|${goal[2]}`;
      summarySourceGoalRelationEntries.push(relation);
      summarySourceGoalRelations.add(relation);
      const sourceLevels =
        summarySourceLevels.get(sourceId) ?? new Set<string>();
      for (const requestedLevel of requestedLevels)
        sourceLevels.add(requestedLevel);
      summarySourceLevels.set(sourceId, sourceLevels);
    }
  }
  if (
    canonicalIds.size !== mappedIds.size ||
    [...canonicalIds].some((id) => !mappedIds.has(id)) ||
    [...mappedIds].some((id) => !canonicalIds.has(id))
  )
    add(
      "error",
      "quality-canonical-mapping-coverage-mismatch",
      relative(analysisPath),
      "The Quality mapping must explicitly process every canonical REQ, UX, IA, UI, SPEC, and ARCH definition without adding an unknown ID.",
    );

  if (new Set(mappingRows).size !== mappingRows.length)
    add(
      "error",
      "quality-canonical-mapping-duplicate-row",
      relative(analysisPath),
      "The Quality mapping must not repeat an identical source-to-objective relation row.",
    );
  if (
    summarySourceGoalRelationEntries.length !== summarySourceGoalRelations.size
  )
    add(
      "error",
      "quality-canonical-source-goal-duplicate",
      relative(analysisPath),
      "The summary mapping must not repeat the same Source ID to verification-goal relation through a different row description.",
    );

  const sourceRelationSections = phaseAnalyses.map(
    (phaseAnalysis) =>
      phaseAnalysis.match(
        /^## 3\. 検証目標への統合\s*$([\s\S]*?)(?=^##\s)/mu,
      )?.[1],
  );
  if (sourceRelationSections.some((section) => !section))
    add(
      "error",
      "quality-source-local-relation-section-missing",
      relative(analysisRoot),
      "Every phase Quality analysis must expose Source ID, QA-ID, preserved condition, test level, and Local Item relations in its canonical integration section.",
    );
  const sourceRelationSection = sourceRelationSections.join("\n");
  const analysisSourceRelations = new Set<string>();
  const analysisSourceGoalRelations = new Set<string>();
  const analysisSourceRelationEntries: string[] = [];
  const analysisSourceGoalRelationEntries: string[] = [];
  const analysisSourceConditions = new Map<string, string>();
  const analysisSourceGoalLevels = new Map<string, Set<string>>();
  const normalizeQualityCondition = (value: string): string =>
    value.trim().replace(/\s+/gu, " ");
  for (const line of (sourceRelationSection ?? "").split(/\r?\n/u)) {
    const relation = line.match(
      /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\([^)]+\)\s*\|\s*\[[^\]]+\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
    );
    if (!relation) continue;
    const [, sourceId, goalSlug, condition, levelCell, localCell] = relation;
    const requestedLevels = new Set(
      Array.from(levelCell.matchAll(/UT|IT|ST|UAT/gu), (match) => match[0]),
    );
    const localIds = Array.from(
      localCell.matchAll(/`([A-Z][A-Z0-9]*-[0-9]{2,})`/gu),
      (match) => match[1],
    );
    const sourceGoalRelation = `${sourceId}|${goalSlug}`;
    analysisSourceGoalRelationEntries.push(sourceGoalRelation);
    analysisSourceGoalRelations.add(sourceGoalRelation);
    analysisSourceConditions.set(
      sourceGoalRelation,
      normalizeQualityCondition(condition),
    );
    analysisSourceGoalLevels.set(sourceGoalRelation, requestedLevels);
    if (
      condition.trim().length === 0 ||
      requestedLevels.size === 0 ||
      localIds.length === 0
    )
      add(
        "error",
        "quality-source-local-relation-incomplete",
        relative(analysisPath),
        "Every Source-to-goal relation must preserve a non-empty source-specific condition and connect it to one or more Local Items.",
      );
    for (const localId of localIds) {
      const sourceLocalRelation = `${sourceId}|${goalSlug}|${localId}`;
      analysisSourceRelationEntries.push(sourceLocalRelation);
      analysisSourceRelations.add(sourceLocalRelation);
    }
  }
  if (analysisSourceGoalRelations.size === 0)
    add(
      "error",
      "quality-source-local-relation-section-missing",
      relative(analysisPath),
      "The Quality analysis must expose Source ID, verification goal, preserved condition, and Local Item relations in its canonical relation section.",
    );
  if (
    analysisSourceGoalRelationEntries.length !==
      analysisSourceGoalRelations.size ||
    analysisSourceRelationEntries.length !== analysisSourceRelations.size
  )
    add(
      "error",
      "quality-source-relation-duplicate",
      relative(analysisPath),
      "The canonical Source relation section must not repeat a Source-to-goal or Source-to-goal-to-Local-Item relation with alternate prose.",
    );
  if (
    summarySourceGoalRelations.size !== analysisSourceGoalRelations.size ||
    [...summarySourceGoalRelations].some(
      (relation) => !analysisSourceGoalRelations.has(relation),
    ) ||
    [...analysisSourceGoalRelations].some(
      (relation) => !summarySourceGoalRelations.has(relation),
    )
  )
    add(
      "error",
      "quality-source-goal-relation-closure-mismatch",
      relative(analysisPath),
      "The summary mapping and canonical Source-specific relation table must expose the same duplicate-free Source ID to verification-goal relation set.",
    );

  const linkedDefinitionPaths = new Set(
    Array.from(
      mappingSection.matchAll(
        /\]\(\.\.\/\.\.\/Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
      ),
      (match) =>
        path.join(
          qualityRoot,
          "Definitions",
          match[1],
          "quality_definition.md",
        ),
    ),
  );
  if (linkedDefinitionPaths.size === 0)
    add(
      "error",
      "quality-definition-closure-missing",
      relative(analysisPath),
      "The Quality mapping must connect its verification obligations to meaningful verification definitions.",
    );
  for (const definitionPath of linkedDefinitionPaths) {
    if (!lstatIfPresent(definitionPath)?.isFile())
      add(
        "error",
        "quality-definition-missing",
        relative(definitionPath),
        "Every verification definition linked by the canonical Quality mapping must exist.",
      );
  }

  const definitionsRoot = path.join(qualityRoot, "Definitions");
  const physicalDefinitionPaths = new Set(
    lstatIfPresent(definitionsRoot)?.isDirectory()
      ? fs
          .readdirSync(definitionsRoot, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() &&
              /^QA-[0-9]{6}$/u.test(entry.name) &&
              lstatIfPresent(
                path.join(definitionsRoot, entry.name, "quality_definition.md"),
              )?.isFile(),
          )
          .map((entry) =>
            path.join(definitionsRoot, entry.name, "quality_definition.md"),
          )
      : [],
  );
  if (
    physicalDefinitionPaths.size !== linkedDefinitionPaths.size ||
    [...physicalDefinitionPaths].some(
      (definitionPath) => !linkedDefinitionPaths.has(definitionPath),
    ) ||
    [...linkedDefinitionPaths].some(
      (definitionPath) => !physicalDefinitionPaths.has(definitionPath),
    )
  )
    add(
      "error",
      "quality-definition-set-mismatch",
      relative(definitionsRoot),
      "The verification definitions on disk must exactly match the objective set linked from the canonical Quality mapping; orphan and unknown objectives are not allowed.",
    );

  const crossModelSection = analysis.match(
    /^## 2\. Architecture横断モデルの処置\s*$([\s\S]*?)(?=^##\s)/mu,
  )?.[1];
  const expectedCrossModelPaths = new Set(
    [
      "02_Component_and_Responsibility_Model.md",
      "03_Boundary_and_Interface_Model.md",
      "04_Runtime_and_Data_Flow_Model.md",
      "05_Failure_Recovery_and_Resilience_Model.md",
      "06_Deployment_and_Execution_Model.md",
    ].map((fileName) => path.join(root, "06_Architecture", fileName)),
  );
  const linkedCrossModelPaths = new Set(
    Array.from(
      (crossModelSection ?? "").matchAll(
        /\]\((\.\.\/06_Architecture\/[A-Za-z0-9_]+\.md)\)/gu,
      ),
      (match) => path.resolve(path.dirname(analysisPath), match[1]),
    ),
  );
  if (
    linkedCrossModelPaths.size !== expectedCrossModelPaths.size ||
    [...expectedCrossModelPaths].some(
      (modelPath) => !linkedCrossModelPaths.has(modelPath),
    ) ||
    [...linkedCrossModelPaths].some(
      (modelPath) => !expectedCrossModelPaths.has(modelPath),
    )
  )
    add(
      "error",
      "quality-architecture-cross-model-coverage-mismatch",
      relative(analysisPath),
      "The Quality mapping must explicitly process the exact five canonical Architecture cross-model documents.",
    );

  const crossModelRows = (crossModelSection ?? "")
    .split(/\r?\n/u)
    .filter((line) => /^\|\s*[^|]+\|/u.test(line))
    .filter((line) => !/^\|\s*(?:検証目標|---)/u.test(line));
  const crossModelGoals = new Set<string>();
  for (const line of crossModelRows) {
    const cells = line
      .slice(1, line.lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    const goalSlug = goalLabelToSlug.get(cells[0]);
    if (!goalSlug || cells.length !== 6) {
      add(
        "error",
        "quality-cross-model-row-invalid",
        relative(analysisPath),
        "Every verification goal must have exactly one Architecture cross-model row with five dispositions.",
      );
      continue;
    }
    if (crossModelGoals.has(goalSlug))
      add(
        "error",
        "quality-cross-model-goal-duplicate",
        relative(analysisPath),
        `Architecture cross-model disposition is duplicated for ${goalSlug}.`,
      );
    crossModelGoals.add(goalSlug);
    for (const disposition of cells.slice(1))
      if (disposition !== "Required" && !/^N\/A:\s*\S.+/u.test(disposition))
        add(
          "error",
          "quality-cross-model-disposition-invalid",
          relative(analysisPath),
          "Each Architecture cross-model disposition must be Required or a reasoned N/A.",
        );
  }
  const goalSlugs = new Set(goalLabelToSlug.values());
  if (
    crossModelGoals.size !== goalSlugs.size ||
    [...goalSlugs].some((goalSlug) => !crossModelGoals.has(goalSlug)) ||
    [...crossModelGoals].some((goalSlug) => !goalSlugs.has(goalSlug))
  )
    add(
      "error",
      "quality-cross-model-goal-coverage-mismatch",
      relative(analysisPath),
      "The Architecture cross-model matrix must process every verification goal exactly once across all five models.",
    );

  const detailSection = analysis.match(
    /^## 3\. Architecture詳細設計領域の処置\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  )?.[1];
  const detailRoot = path.join(root, "06_Architecture", "Details");
  const physicalDetailPaths = new Set(
    lstatIfPresent(detailRoot)?.isDirectory()
      ? fs
          .readdirSync(detailRoot, { withFileTypes: true })
          .filter(
            (entry) =>
              entry.isDirectory() &&
              lstatIfPresent(
                path.join(detailRoot, entry.name, "01_Architecture.md"),
              )?.isFile(),
          )
          .map((entry) =>
            path.join(detailRoot, entry.name, "01_Architecture.md"),
          )
      : [],
  );
  const linkedDetailPaths = new Set(
    Array.from(
      (detailSection ?? "").matchAll(
        /\]\((\.\.\/06_Architecture\/Details\/[a-z0-9-]+\/01_Architecture\.md)\)/gu,
      ),
      (match) => path.resolve(path.dirname(analysisPath), match[1]),
    ),
  );
  const analysisDetailGoalRelations = new Set<string>();
  const analysisDetailGoalRelationEntries: string[] = [];
  for (const line of (detailSection ?? "").split(/\r?\n/u)) {
    const detailSlug = line.match(
      /^\|\s*\[([a-z0-9-]+)\]\([^)]*\/Details\/\1\/01_Architecture\.md\)\s*\|/u,
    )?.[1];
    if (!detailSlug) continue;
    for (const goal of line.matchAll(
      /\[[^\]]+\]\(Definitions\/(QA-[0-9]{6})\/quality_definition\.md\)/gu,
    )) {
      const relation = `${detailSlug}|${goal[1]}`;
      analysisDetailGoalRelationEntries.push(relation);
      analysisDetailGoalRelations.add(relation);
    }
  }
  if (analysisDetailGoalRelations.size === 0)
    add(
      "error",
      "quality-architecture-detail-goal-relation-missing",
      relative(analysisPath),
      "Each Architecture detail area must connect to one or more canonical verification goals.",
    );
  if (
    analysisDetailGoalRelationEntries.length !==
    analysisDetailGoalRelations.size
  )
    add(
      "error",
      "quality-architecture-detail-goal-relation-duplicate",
      relative(analysisPath),
      "The Architecture detail to verification-goal relation set must be duplicate-free.",
    );
  if (
    linkedDetailPaths.size !== physicalDetailPaths.size ||
    [...physicalDetailPaths].some(
      (detailPath) => !linkedDetailPaths.has(detailPath),
    ) ||
    [...linkedDetailPaths].some(
      (detailPath) => !physicalDetailPaths.has(detailPath),
    )
  )
    add(
      "error",
      "quality-architecture-detail-coverage-mismatch",
      relative(analysisPath),
      "The Quality mapping must explicitly process every current Architecture detail area without adding an unknown area.",
    );

  const localItemOwners = new Map<string, string>();
  const definitionSourceRelations = new Set<string>();
  const definitionSourceRelationEntries: string[] = [];
  const definitionSourceConditions = new Map<string, string>();
  const definitionSourceGoalLevels = new Map<string, Set<string>>();
  const definitionDetailGoalRelations = new Set<string>();
  const definitionDetailGoalRelationEntries: string[] = [];
  const definitionGoalLocalRelations = new Set<string>();
  const definitionGoalLocalRelationEntries: string[] = [];
  const localItemLevels = new Map<string, string>();
  for (const definitionPath of physicalDefinitionPaths) {
    const definition = read(definitionPath);
    const goalSlug = path.basename(path.dirname(definitionPath));
    const declaredQualityId = definition.match(
      /^Quality ID:\s*`(QA-[0-9]{6})`\s*$/mu,
    )?.[1];
    if (
      declaredQualityId !== goalSlug ||
      !new RegExp(`^# ${goalSlug}\\s+\\S`, "mu").test(definition)
    )
      add(
        "error",
        "quality-definition-identity-mismatch",
        relative(definitionPath),
        "Each Quality definition directory, H1, and Quality ID field must expose the same QA-XXXXXX canonical identity.",
      );
    const coverageSection = definition.match(
      /^## 1\. 情報源と網羅条件\s*$([\s\S]*?)(?=^##\s)/mu,
    )?.[1];
    if (!coverageSection)
      add(
        "error",
        "quality-definition-source-coverage-missing",
        relative(definitionPath),
        "Each verification definition must expose its Source-specific conditions and Local Item relations in the canonical information-source section.",
      );
    for (const line of (coverageSection ?? "").split(/\r?\n/u)) {
      const relation = line.match(
        /^\|\s*\[((?:REQ|UX|IA|UI|SPEC|ARCH)-[0-9]{6})\]\([^)]+\)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
      );
      if (!relation) continue;
      const [, sourceId, condition, levelCell, localCell] = relation;
      const requestedLevels = new Set(
        Array.from(levelCell.matchAll(/UT|IT|ST|UAT/gu), (match) => match[0]),
      );
      const localIds = Array.from(
        localCell.matchAll(/`([A-Z][A-Z0-9]*-[0-9]{2,})`/gu),
        (match) => match[1],
      );
      if (
        condition.trim().length === 0 ||
        requestedLevels.size === 0 ||
        localIds.length === 0
      )
        add(
          "error",
          "quality-definition-source-local-relation-incomplete",
          relative(definitionPath),
          "Every verification-definition source row must preserve a condition and connect it to one or more Local Items.",
        );
      definitionSourceConditions.set(
        `${sourceId}|${goalSlug}`,
        normalizeQualityCondition(condition),
      );
      definitionSourceGoalLevels.set(
        `${sourceId}|${goalSlug}`,
        requestedLevels,
      );
      for (const localId of localIds) {
        const relation = `${sourceId}|${goalSlug}|${localId}`;
        definitionSourceRelationEntries.push(relation);
        definitionSourceRelations.add(relation);
      }
    }
    const detailCoverageSection = definition.match(
      /^### Architecture詳細設計入力\s*$([\s\S]*?)(?=^##\s)/mu,
    )?.[1];
    if (!detailCoverageSection)
      add(
        "error",
        "quality-definition-detail-coverage-missing",
        relative(definitionPath),
        "Each verification definition must expose the Architecture detail areas that contribute its structural verification conditions.",
      );
    for (const detail of (detailCoverageSection ?? "").matchAll(
      /\[([a-z0-9-]+)\]\(\.\.\/\.\.\/\.\.\/06_Architecture\/Details\/\1\/01_Architecture\.md\)/gu,
    )) {
      const relation = `${detail[1]}|${goalSlug}`;
      definitionDetailGoalRelationEntries.push(relation);
      definitionDetailGoalRelations.add(relation);
    }
    const itemSection = definition.match(
      /^## [0-9]+\. 検証項目\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    )?.[1];
    const expectedItemColumns = [
      "Local ID",
      "分類",
      "試験段階",
      "試験種別",
      "対象／境界",
      "外部境界の段階",
      "事前状態／入力",
      "操作／刺激",
      "観測と期待結果",
      "終了後条件",
      "実行形態",
    ];
    const itemTableLines = (itemSection ?? "")
      .split(/\r?\n/u)
      .filter((line) => /^\|.*\|\s*$/u.test(line));
    const localItemLevelStages: Array<{
      level: string;
      externalBoundaryStage: string;
    }> = [];
    const itemHeaderCells = itemTableLines[0]
      ?.slice(1, itemTableLines[0].lastIndexOf("|"))
      .split("|")
      .map((cell) => cell.trim());
    if (
      !itemHeaderCells ||
      itemHeaderCells.length !== expectedItemColumns.length ||
      itemHeaderCells.some((cell, index) => cell !== expectedItemColumns[index])
    )
      add(
        "error",
        "quality-verification-item-schema-invalid",
        relative(definitionPath),
        "The verification-item table must use the exact eleven canonical axes, including test level, test type, target/boundary, and staged external-boundary reach.",
      );
    for (const itemLine of itemTableLines.slice(2)) {
      if (!/^\|\s*`[A-Z][A-Z0-9]*-[0-9]{2,}`\s*\|/u.test(itemLine)) continue;
      const cells = itemLine
        .slice(1, itemLine.lastIndexOf("|"))
        .split("|")
        .map((cell) => cell.trim());
      if (cells.length === expectedItemColumns.length)
        localItemLevelStages.push({
          level: cells[2],
          externalBoundaryStage: cells[5],
        });
      if (cells.length === expectedItemColumns.length) {
        const localId = cells[0].match(/^`([A-Z][A-Z0-9]*-[0-9]{2,})`$/u)?.[1];
        if (localId) localItemLevels.set(localId, cells[2]);
      }
      if (
        cells.length !== expectedItemColumns.length ||
        cells.some((cell) => cell.length === 0)
      )
        add(
          "error",
          "quality-verification-item-axis-missing",
          relative(definitionPath),
          "Every verification item must populate all eleven canonical axes so the intended level, boundary, failure, and completion condition can be reconstructed.",
        );
      if (
        cells.length === expectedItemColumns.length &&
        !["UT", "IT", "ST", "UAT"].includes(cells[2])
      )
        add(
          "error",
          "quality-verification-item-test-level-invalid",
          relative(definitionPath),
          "Verification-item test level must be exactly UT, IT, ST, or UAT; create separate Local Items when independently observable levels are required.",
        );
      if (
        cells.length === expectedItemColumns.length &&
        ![
          "N/A",
          "Direct Boundary",
          "Adjacent 1 Block",
          "Related 2 Blocks",
          "System/E2E",
          "User Acceptance",
        ].includes(cells[5])
      )
        add(
          "error",
          "quality-verification-item-external-boundary-stage-invalid",
          relative(definitionPath),
          "Verification-item external-boundary stage must use the canonical staged-integration values.",
        );
      if (
        cells.length === expectedItemColumns.length &&
        !["Automated", "Manual", "Hybrid"].includes(cells[10])
      )
        add(
          "error",
          "quality-verification-item-execution-mode-invalid",
          relative(definitionPath),
          "Verification-item execution mode must be exactly Automated, Manual, or Hybrid; test level and reviewer role belong to their own contracts.",
        );
    }
    const applicabilitySection = definition.match(
      /^## [0-9]+\. 試験段階と外部境界の適用\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    )?.[1];
    const applicabilityRows = new Map<
      string,
      { applicability: string; externalBoundaryReach: string }
    >();
    for (const line of (applicabilitySection ?? "").split(/\r?\n/u)) {
      const row = line.match(
        /^\|\s*(UT|IT|ST|UAT)\s*\|\s*(Required|Conditional|N\/A)\s*\|\s*([^|]+)\|\s*(N\/A|Direct Boundary|Adjacent 1 Block|Related 2 Blocks|System\/E2E|User Acceptance)\s*\|\s*([^|]+)\|\s*$/u,
      );
      if (!row) continue;
      applicabilityRows.set(row[1], {
        applicability: row[2],
        externalBoundaryReach: row[4],
      });
    }
    if (
      applicabilityRows.size !== 4 ||
      ["UT", "IT", "ST", "UAT"].some((level) => !applicabilityRows.has(level))
    )
      add(
        "error",
        "quality-test-level-applicability-incomplete",
        relative(definitionPath),
        "Each verification definition must explicitly decide UT, IT, ST, and UAT applicability with scope, staged external-boundary reach, and rationale.",
      );
    const requiredLevelDisplay = new Map([
      ["UT", "Unit"],
      ["IT", "Integration"],
      ["ST", "System"],
      ["UAT", "User Acceptance"],
    ]);
    const primaryLevelText =
      definition.match(/^主な試験段階:\s*(.+?)\s*$/mu)?.[1];
    const expectedPrimaryLevels = ["UT", "IT", "ST", "UAT"]
      .filter(
        (level) => applicabilityRows.get(level)?.applicability === "Required",
      )
      .map((level) => requiredLevelDisplay.get(level));
    if (
      !primaryLevelText ||
      primaryLevelText
        .split("／")
        .map((level) => level.trim())
        .join("／") !== expectedPrimaryLevels.join("／")
    )
      add(
        "error",
        "quality-primary-test-level-summary-mismatch",
        relative(definitionPath),
        "The human-readable primary-test-level summary must exactly equal the ordered set of Required UT, IT, ST, and UAT applicability rows.",
      );

    const additionalTypeSection = definition.match(
      /^## 追加試験種別の適用\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
    )?.[1];
    const additionalTypeRows = new Map<
      string,
      { applicability: string; authorization: string }
    >();
    for (const line of (additionalTypeSection ?? "").split(/\r?\n/u)) {
      const row = line.match(
        /^\|\s*(RT|PT|LT)\s*\|\s*(Required|Conditional|N\/A)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$/u,
      );
      if (!row) continue;
      additionalTypeRows.set(row[1], {
        applicability: row[2],
        authorization: row[4].trim(),
      });
    }
    if (
      additionalTypeRows.size !== 3 ||
      ["RT", "PT", "LT"].some((type) => !additionalTypeRows.has(type))
    )
      add(
        "error",
        "quality-additional-test-type-applicability-incomplete",
        relative(definitionPath),
        "Each Quality definition must explicitly decide RT, PT, and LT applicability and explain non-applicability.",
      );
    for (const type of ["PT", "LT"]) {
      const row = additionalTypeRows.get(type);
      if (
        row &&
        ((row.applicability === "N/A" && row.authorization !== "N/A") ||
          (row.applicability !== "N/A" &&
            row.authorization !== "Human Explicit Authorization"))
      )
        add(
          "error",
          "quality-expensive-test-authorization-invalid",
          relative(definitionPath),
          "PT and LT must require Human Explicit Authorization when applicable and must use N/A authorization when non-applicable.",
        );
    }
    const externalBoundaryStageOrder = new Map([
      ["N/A", 0],
      ["Direct Boundary", 1],
      ["Adjacent 1 Block", 2],
      ["Related 2 Blocks", 3],
      ["System/E2E", 4],
      ["User Acceptance", 5],
    ]);
    for (const level of ["UT", "IT", "ST", "UAT"]) {
      const applicability = applicabilityRows.get(level);
      if (!applicability) continue;
      const localItems = localItemLevelStages.filter(
        (item) => item.level === level,
      );
      const declaredReach = externalBoundaryStageOrder.get(
        applicability.externalBoundaryReach,
      );
      const hasItemBeyondDeclaredReach = localItems.some((item) => {
        const itemReach = externalBoundaryStageOrder.get(
          item.externalBoundaryStage,
        );
        return (
          declaredReach !== undefined &&
          itemReach !== undefined &&
          itemReach > declaredReach
        );
      });
      if (
        (applicability.applicability === "Required" &&
          localItems.length === 0) ||
        (applicability.applicability === "N/A" && localItems.length > 0) ||
        hasItemBeyondDeclaredReach
      )
        add(
          "error",
          "quality-test-level-applicability-conflict",
          relative(definitionPath),
          "Test-level applicability must agree with its Local Items: Required has an item, N/A has none, and no item exceeds the declared external-boundary reach.",
        );
    }
    const localIds = Array.from(
      (itemSection ?? "").matchAll(
        /^\|\s*`([A-Z][A-Z0-9]*-[0-9]{2,})`\s*\|/gmu,
      ),
      (match) => match[1],
    );
    if (localIds.length === 0)
      add(
        "error",
        "quality-definition-verification-items-missing",
        relative(definitionPath),
        "Each verification definition must contain at least one locally identified verification item in its canonical '検証項目' section.",
      );
    for (const localId of localIds) {
      const goalLocalRelation = `${goalSlug}|${localId}`;
      definitionGoalLocalRelationEntries.push(goalLocalRelation);
      definitionGoalLocalRelations.add(goalLocalRelation);
      const previousOwner = localItemOwners.get(localId);
      if (previousOwner)
        add(
          "error",
          "quality-local-verification-id-duplicate",
          relative(definitionPath),
          `Local verification ID ${localId} is already owned by ${previousOwner}.`,
        );
      else localItemOwners.set(localId, relative(definitionPath));
    }
  }

  if (definitionSourceRelationEntries.length !== definitionSourceRelations.size)
    add(
      "error",
      "quality-definition-source-relation-duplicate",
      relative(definitionsRoot),
      "Verification definitions must not repeat the same Source ID, goal, and Local Item relation with different descriptions.",
    );
  if (
    definitionGoalLocalRelationEntries.length !==
    definitionGoalLocalRelations.size
  )
    add(
      "error",
      "quality-definition-goal-local-relation-duplicate",
      relative(definitionsRoot),
      "Verification definitions must not repeat the same verification-goal to Local Item relation.",
    );
  if (
    definitionDetailGoalRelationEntries.length !==
    definitionDetailGoalRelations.size
  )
    add(
      "error",
      "quality-definition-detail-goal-relation-duplicate",
      relative(definitionsRoot),
      "Verification definitions must not repeat the same Architecture detail to goal relation.",
    );
  if (
    analysisDetailGoalRelations.size !== definitionDetailGoalRelations.size ||
    [...analysisDetailGoalRelations].some(
      (relation) => !definitionDetailGoalRelations.has(relation),
    ) ||
    [...definitionDetailGoalRelations].some(
      (relation) => !analysisDetailGoalRelations.has(relation),
    )
  )
    add(
      "error",
      "quality-detail-goal-relation-closure-mismatch",
      relative(analysisPath),
      "The Quality analysis and verification definitions must expose the same duplicate-free Architecture-detail-to-goal relation set.",
    );

  if (
    analysisSourceRelations.size !== definitionSourceRelations.size ||
    [...analysisSourceRelations].some(
      (relation) => !definitionSourceRelations.has(relation),
    ) ||
    [...definitionSourceRelations].some(
      (relation) => !analysisSourceRelations.has(relation),
    )
  )
    add(
      "error",
      "quality-source-local-relation-closure-mismatch",
      relative(analysisPath),
      "The Quality analysis and verification definitions must expose the same duplicate-free Source ID, goal, and Local Item relation set.",
    );
  for (const [
    sourceGoalRelation,
    requestedLevels,
  ] of analysisSourceGoalLevels) {
    const relatedLocalIds = Array.from(analysisSourceRelations)
      .filter((relation) => relation.startsWith(`${sourceGoalRelation}|`))
      .map((relation) => relation.slice(sourceGoalRelation.length + 1));
    const relatedLevels = new Set(
      relatedLocalIds.flatMap((localId) => {
        const level = localItemLevels.get(localId);
        return level ? [level] : [];
      }),
    );
    for (const requestedLevel of requestedLevels)
      if (!relatedLevels.has(requestedLevel))
        add(
          "error",
          "quality-source-test-level-coverage-mismatch",
          relative(analysisPath),
          "Every test level requested by a canonical Source-to-goal mapping must be represented by a related Local Item of that same level.",
        );
  }
  for (const [sourceId, requestedLevels] of summarySourceLevels) {
    const decomposedLevels = new Set<string>();
    for (const [sourceGoalRelation, levels] of analysisSourceGoalLevels)
      if (sourceGoalRelation.startsWith(`${sourceId}|`))
        for (const level of levels) decomposedLevels.add(level);
    if (
      requestedLevels.size !== decomposedLevels.size ||
      [...requestedLevels].some((level) => !decomposedLevels.has(level))
    )
      add(
        "error",
        "quality-source-test-level-decomposition-mismatch",
        relative(analysisPath),
        "Each canonical Source summary level set must equal the union of its Source-to-goal level sets.",
      );
  }
  if (
    analysisSourceGoalLevels.size !== definitionSourceGoalLevels.size ||
    [...analysisSourceGoalLevels].some(([relation, levels]) => {
      const definitionLevels = definitionSourceGoalLevels.get(relation);
      return (
        !definitionLevels ||
        levels.size !== definitionLevels.size ||
        [...levels].some((level) => !definitionLevels.has(level))
      );
    })
  )
    add(
      "error",
      "quality-definition-source-test-level-closure-mismatch",
      relative(analysisPath),
      "The Quality analysis and verification definitions must expose the same Source-to-goal test-level sets.",
    );
  if (
    analysisSourceConditions.size !== definitionSourceConditions.size ||
    [...analysisSourceConditions].some(
      ([relation, condition]) =>
        definitionSourceConditions.get(relation) !== condition,
    ) ||
    [...definitionSourceConditions].some(
      ([relation, condition]) =>
        analysisSourceConditions.get(relation) !== condition,
    )
  )
    add(
      "error",
      "quality-source-condition-closure-mismatch",
      relative(analysisPath),
      "The Quality mapping and verification definitions must preserve the same normalized source-specific condition for every Source ID to verification-goal relation.",
    );

  const localItemSection = analysis.match(
    /^## 4\. 検証項目の閉包\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
  )?.[1];
  const listedLocalIds = new Set<string>();
  const listedGoalLocalRelations = new Set<string>();
  const listedGoalLocalRelationEntries: string[] = [];
  for (const line of (localItemSection ?? "").split(/\r?\n/u)) {
    const goalSlug = line.match(
      /^\|\s*\[[^\]]+\]\(Definitions\/([A-Z0-9-]+)\/quality_definition\.md\)\s*\|/u,
    )?.[1];
    if (!goalSlug) continue;
    for (const localMatch of line.matchAll(/`([A-Z][A-Z0-9]*-[0-9]{2,})`/gu)) {
      listedLocalIds.add(localMatch[1]);
      const relation = `${goalSlug}|${localMatch[1]}`;
      listedGoalLocalRelationEntries.push(relation);
      listedGoalLocalRelations.add(relation);
    }
  }
  if (
    listedLocalIds.size !== localItemOwners.size ||
    [...listedLocalIds].some((localId) => !localItemOwners.has(localId)) ||
    [...localItemOwners].some(([localId]) => !listedLocalIds.has(localId))
  )
    add(
      "error",
      "quality-local-verification-item-closure-mismatch",
      relative(analysisPath),
      "The canonical Quality mapping must list the exact Local Item set owned by all current verification definitions.",
    );
  if (listedGoalLocalRelationEntries.length !== listedGoalLocalRelations.size)
    add(
      "error",
      "quality-goal-local-relation-duplicate",
      relative(analysisPath),
      "The canonical Quality mapping must not repeat the same verification-goal to Local Item relation.",
    );
  if (
    listedGoalLocalRelations.size !== definitionGoalLocalRelations.size ||
    [...listedGoalLocalRelations].some(
      (relation) => !definitionGoalLocalRelations.has(relation),
    ) ||
    [...definitionGoalLocalRelations].some(
      (relation) => !listedGoalLocalRelations.has(relation),
    )
  )
    add(
      "error",
      "quality-goal-local-relation-closure-mismatch",
      relative(analysisPath),
      "The canonical Quality mapping must preserve the exact verification-goal to Local Item relation set owned by the verification definitions; a globally equal Local ID set is not sufficient.",
    );

  for (const sharedEvidencePath of [
    path.join(qualityRoot, "Evidence"),
    path.join(qualityRoot, "Verification_Results"),
  ])
    if (lstatIfPresent(sharedEvidencePath))
      add(
        "error",
        "quality-shared-evidence-box-forbidden",
        relative(sharedEvidencePath),
        "Quality must keep result ownership with the relevant verification definition or release/change evidence owner instead of recreating a shared catch-all Evidence box.",
      );
}

checkQualityReconstruction();

let workLifecycleRoots = [
  path.join(root, "99_Roadmap"),
  ...(repositoryMode === "official"
    ? [path.join(root, "template", "99_Roadmap")]
    : []),
];
let recognizedChangeTracePatterns = [
  "99_Roadmap/Changes/CHG-*/change.md",
  ...(repositoryMode === "official"
    ? ["template/99_Roadmap/Changes/CHG-*/change.md"]
    : []),
];

function changeTraceRootFor(file: string): string | null {
  for (const workLifecycleRoot of workLifecycleRoots) {
    if (!isWithin(workLifecycleRoot, file)) continue;
    const relativeParts = path
      .relative(workLifecycleRoot, file)
      .split(path.sep);
    if (
      relativeParts.length !== 3 ||
      relativeParts[0] !== "Changes" ||
      !/^(?:CHG-[0-9]{6}|CHG-XXXXXX)$/u.test(relativeParts[1]) ||
      relativeParts[2] !== "change.md"
    )
      continue;
    return path.join(workLifecycleRoot, "Changes", relativeParts[1]);
  }
  return null;
}
function isEvidenceFile(file: string): boolean {
  return path
    .relative(root, file)
    .split(path.sep)
    .slice(0, -1)
    .some((part) => part.toLocaleLowerCase("en-US") === "evidence");
}

function declaredChangeTraceId(file: string): string | null {
  const header = read(file).split(/\r?\n/u).slice(0, 40).join("\n");
  return (
    header.match(
      /^(?:Change ID|変更(?:トレース)?ID|change_id)\s*[:：]\s*`?(CHG-[A-Za-z0-9-]+)/imu,
    )?.[1] || null
  );
}

function hasChangeTraceDefinitionSignature(file: string): boolean {
  const header = read(file).split(/\r?\n/u).slice(0, 40).join("\n");
  const hasStandardHeading =
    /^#\s*(?:Change Trace(?=$|[:：(（])|変更トレース(?=$|[:：(（]))/imu.test(
      header,
    );
  return Boolean(declaredChangeTraceId(file) && hasStandardHeading);
}

function walk(
  directory: string,
  predicate: (file: string) => boolean,
  excludedDirectories: ReadonlySet<string> = new Set<string>(),
  excludedPaths: string[] = [],
  excludedLinks: string[] = [],
  unavailableDirectories: Set<string> = new Set<string>(),
  excludedDirectoryPaths: ReadonlySet<string> = new Set<string>(),
): string[] {
  function fail(code: string, message: string): null {
    const target = relative(directory);
    add("error", code, target, message);
    unavailableDirectories.add(`${target}: ${message}`);
    return null;
  }

  function inspectDirectory(): fs.Stats | null {
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(directory);
    } catch (error) {
      if (errorCode(error) === "ENOENT") {
        return fail(
          "discovery-directory-missing",
          "The directory disappeared during fallback discovery.",
        );
      }
      if (errorCode(error) === "ENOTDIR") {
        return fail(
          "discovery-directory-invalid",
          "The fallback discovery target is no longer a directory.",
        );
      }
      return fail(
        "discovery-directory-metadata-failed",
        `Could not inspect the directory during fallback discovery: ${errorCode(error) || "unknown error"}.`,
      );
    }
    if (stat.isSymbolicLink()) {
      return fail(
        "discovery-directory-symbolic",
        "The directory became a symbolic link or junction during fallback discovery.",
      );
    }
    if (!stat.isDirectory()) {
      return fail(
        "discovery-directory-invalid",
        "The fallback discovery target is no longer a directory.",
      );
    }
    return stat;
  }

  const before = inspectDirectory();
  if (!before) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (errorCode(error) === "ENOENT") {
      fail(
        "discovery-directory-missing",
        "The directory disappeared while fallback discovery was reading it.",
      );
    } else if (errorCode(error) === "ENOTDIR") {
      fail(
        "discovery-directory-invalid",
        "The fallback discovery target was replaced by a non-directory.",
      );
    } else {
      fail(
        "discovery-directory-list-failed",
        `Could not read the directory during fallback discovery: ${errorCode(error) || "unknown error"}.`,
      );
    }
    return [];
  }
  const after = inspectDirectory();
  if (!after) return [];
  if (before.dev !== after.dev || before.ino !== after.ino) {
    fail(
      "discovery-directory-replaced",
      "The directory was replaced while fallback discovery was reading it.",
    );
    return [];
  }
  const discoveredFiles: string[] = [];
  for (const entry of entries) {
    const current = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      excludedLinks.push(relative(current));
      continue;
    }
    if (
      entry.isDirectory() &&
      excludedDirectoryPaths.has(path.resolve(current))
    ) {
      excludedPaths.push(relative(current));
      continue;
    }
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) {
      excludedPaths.push(relative(current));
      continue;
    }
    if (entry.isDirectory()) {
      discoveredFiles.push(
        ...walk(
          current,
          predicate,
          excludedDirectories,
          excludedPaths,
          excludedLinks,
          unavailableDirectories,
          excludedDirectoryPaths,
        ),
      );
    } else if (predicate(current)) discoveredFiles.push(current);
  }
  return discoveredFiles.sort();
}

function discoverProjectFiles(): Discovery {
  const repositoryEntries = observeRepositoryEntries(root);
  const gitFailure: string | null =
    repositoryEntries.status === "unavailable"
      ? repositoryEntries.reason === "version_control_not_installed"
        ? "not-installed"
        : repositoryEntries.reason === "repository_not_found"
          ? "not-repository"
          : repositoryEntries.reason ===
                "repository_entries_observation_failed" ||
              repositoryEntries.reason === "repository_entries_output_invalid"
            ? "list-failed"
            : "repository-check-failed"
      : null;
  if (repositoryEntries.status === "completed") {
    const isStagedOutputValid =
      repositoryEntries.nestedRepositoryObservationComplete;
    const nestedEntries = repositoryEntries.entries.filter(
      (entry) => entry.kind === "nested_repository",
    );
    const gitlinkEntries: GitlinkEntry[] = nestedEntries
      .filter((entry) => !entry.conflicted && entry.contentIdentity !== null)
      .map((entry) => ({
        path: path.resolve(root, entry.relativePath),
        oid: entry.contentIdentity ?? "",
      }));
    const conflictedGitlinks = nestedEntries
      .filter((entry) => entry.conflicted)
      .map((entry) => path.resolve(root, entry.relativePath));
    const declaredGitlinkCandidates = declaredSubmodules
      .map((item) => path.resolve(root, item))
      .filter((item) => isWithin(root, item));
    const gitlinks = [
      ...new Set(
        isStagedOutputValid
          ? [
              ...gitlinkEntries.map((entry) => entry.path),
              ...conflictedGitlinks,
            ]
          : declaredGitlinkCandidates,
      ),
    ].sort();
    const baselineGitlink =
      gitlinkEntries.find((entry) =>
        samePath(entry.path, baselineCandidateRoot),
      ) ?? null;
    const isBaselineGitlinkConflicted = conflictedGitlinks.some((entry) =>
      samePath(entry, baselineCandidateRoot),
    );
    const isBaselineGitlinkIndexed =
      isStagedOutputValid && !isBaselineGitlinkConflicted
        ? Boolean(baselineGitlink)
        : null;
    const isBaselineSubmodule =
      isBaselineDeclarationCandidate ||
      isBaselineGitlinkIndexed === true ||
      isBaselineGitlinkConflicted;
    const isBaselineWorktreePresent = isBaselineSubmodule
      ? isBaselineEntryDirectory &&
        !pathContainsSymbolicLink(baselineCandidateRoot)
      : null;
    const baselineObservation =
      isBaselineWorktreePresent === true
        ? observeNestedRepository(root, "00_CRDD")
        : null;
    const isBaselineOwnRepository =
      baselineObservation?.exactRepository === true;
    const isBaselineGitDirectoryAccessible =
      isBaselineOwnRepository &&
      baselineObservation?.metadataAccessible === true;
    const baselineHeadOid = isBaselineOwnRepository
      ? (baselineObservation?.revisionIdentity ?? null)
      : null;
    const isBaselineHeadReadable = baselineHeadOid !== null;
    const baselineGitlinkOid = baselineGitlink?.oid?.toLowerCase() ?? null;
    const isBaselineHeadMatchingGitlink =
      isBaselineHeadReadable && baselineGitlinkOid
        ? baselineHeadOid === baselineGitlinkOid
        : null;
    const isBaselineSubmoduleInitialized = !isBaselineSubmodule
      ? null
      : isBaselineGitlinkIndexed === true && isBaselineWorktreePresent === false
        ? false
        : isBaselineGitDirectoryAccessible && isBaselineHeadReadable
          ? true
          : null;
    const baselineSubmoduleState = {
      declared: isBaselineSubmodule ? isBaselineDeclared : null,
      gitlink_indexed: isBaselineSubmodule ? isBaselineGitlinkIndexed : null,
      gitlink_conflicted: isBaselineSubmodule
        ? isBaselineGitlinkConflicted
        : null,
      gitlink_oid: isBaselineSubmodule ? baselineGitlinkOid : null,
      worktree_present: isBaselineWorktreePresent,
      gitdir_accessible:
        isBaselineWorktreePresent === true
          ? isBaselineGitDirectoryAccessible
          : isBaselineWorktreePresent === false
            ? false
            : null,
      head_readable:
        isBaselineWorktreePresent === true
          ? isBaselineHeadReadable
          : isBaselineWorktreePresent === false
            ? false
            : null,
      head_oid: baselineHeadOid,
      head_matches_gitlink: isBaselineHeadMatchingGitlink,
    };
    const skippedSymbolicLinks: string[] = [];
    const files = repositoryEntries.entries
      .filter((entry) => entry.kind === "file")
      .map((entry) => path.resolve(root, entry.relativePath))
      .filter((item) => {
        if (!isWithin(root, item)) return false;
        if (pathContainsSymbolicLink(item)) {
          skippedSymbolicLinks.push(relative(item));
          return false;
        }
        return lstatIfPresent(item)?.isFile() ?? false;
      })
      .sort();
    return {
      files,
      source: "git",
      git_failure: null,
      gitlink_detection: isStagedOutputValid
        ? conflictedGitlinks.length > 0
          ? "git-index-conflicted"
          : "git-index"
        : "unavailable",
      gitlinks,
      baseline_submodule: isBaselineSubmodule,
      baseline_submodule_initialized: isBaselineSubmoduleInitialized,
      baseline_submodule_state: baselineSubmoduleState,
      exclusions: [
        "Git-ignored files",
        ...(skippedSymbolicLinks.length > 0
          ? ["Symbolic links and junctions"]
          : []),
        ...(isBaselineSubmodule
          ? ["Adopted CRDD baseline submodule contents"]
          : []),
        ...(gitlinks.length > 0 ? ["Gitlink submodule contents"] : []),
      ],
      unchecked: [
        "Git-ignored files",
        ...(isStagedOutputValid
          ? gitlinks.map(
              (item) => `Gitlink submodule boundary: ${relative(item)}`,
            )
          : [
              "Gitlink detection unavailable: repository entry kinds were not read",
            ]),
        ...(isBaselineSubmodule
          ? [
              "Adopted CRDD baseline submodule contents, except baseline version headers and targets directly referenced by project documents",
            ]
          : []),
        ...skippedSymbolicLinks.map(
          (item) => `Symbolic link excluded: ${item}`,
        ),
      ],
    };
  }

  const excludedNames = new Set<string>([
    ".git",
    ".cache",
    ".next",
    ".nuxt",
    ".pytest_cache",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "venv",
    "vendor",
  ]);
  const fallbackGitlinks = declaredSubmodules
    .map((item) => path.resolve(root, item))
    .filter((item) => isWithin(root, item));
  const fallbackGitlinkPaths = new Set<string>(fallbackGitlinks);
  const excludedPaths: string[] = [];
  const excludedLinks: string[] = [];
  const unavailableDirectories = new Set<string>();
  const isFallbackBaselineInitialized =
    isBaselineDeclarationCandidate &&
    isBaselineEntryDirectory &&
    !pathContainsSymbolicLink(baselineCandidateRoot) &&
    isInitializedBaselineWithoutGit(baselineCandidateRoot);
  const fallbackBaselineState = {
    declared: isBaselineDeclarationCandidate ? isBaselineDeclared : null,
    gitlink_indexed: null,
    gitlink_conflicted: null,
    gitlink_oid: null,
    worktree_present: isBaselineDeclarationCandidate
      ? isBaselineEntryDirectory &&
        !pathContainsSymbolicLink(baselineCandidateRoot)
      : null,
    gitdir_accessible: isBaselineDeclarationCandidate
      ? isFallbackBaselineInitialized
      : null,
    head_readable: null,
    head_oid: null,
    head_matches_gitlink: null,
  };
  return {
    files: walk(
      root,
      () => true,
      excludedNames,
      excludedPaths,
      excludedLinks,
      unavailableDirectories,
      fallbackGitlinkPaths,
    ),
    source: "walk-fallback",
    git_failure: gitFailure,
    gitlink_detection: "unavailable",
    gitlinks: fallbackGitlinks,
    baseline_submodule: isBaselineDeclarationCandidate,
    baseline_submodule_initialized: null,
    baseline_submodule_state: fallbackBaselineState,
    exclusions: [
      ...[...excludedNames].sort(),
      ...(excludedLinks.length > 0 ? ["Symbolic links and junctions"] : []),
    ],
    unchecked:
      excludedPaths.length > 0 ||
      excludedLinks.length > 0 ||
      unavailableDirectories.size > 0
        ? [
            "Gitlink detection unavailable: Git index modes were not read",
            ...excludedPaths.map((item) => `Fallback excluded: ${item}`),
            ...excludedLinks.map((item) => `Symbolic link excluded: ${item}`),
            ...[...unavailableDirectories].map(
              (item) => `Fallback discovery unavailable: ${item}`,
            ),
          ]
        : [
            "Git file selection unavailable; fallback directory exclusions applied.",
            "Gitlink detection unavailable: Git index modes were not read",
          ],
  };
}

function markdownCodePointBefore(value: string, index: number): string {
  return Array.from(value.slice(0, index)).at(-1) ?? "";
}

function markdownCodePointAfter(value: string, index: number): string {
  return Array.from(value.slice(index)).at(0) ?? "";
}

function markdownWhitespace(value: string): boolean {
  return value === "" || /[\t\n\f\r\p{Zs}]/u.test(value);
}

function markdownPunctuation(value: string): boolean {
  return (
    value !== "" &&
    (/\p{P}/u.test(value) ||
      /[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/u.test(value))
  );
}

function underscoreFlanking(value: string, index: number, length: number) {
  const previous = markdownCodePointBefore(value, index);
  const next = markdownCodePointAfter(value, index + length);
  const isPreviousWhitespace = markdownWhitespace(previous);
  const isNextWhitespace = markdownWhitespace(next);
  const isPreviousPunctuation = markdownPunctuation(previous);
  const isNextPunctuation = markdownPunctuation(next);
  return {
    left:
      !isNextWhitespace &&
      (!isNextPunctuation || isPreviousWhitespace || isPreviousPunctuation),
    right:
      !isPreviousWhitespace &&
      (!isPreviousPunctuation || isNextWhitespace || isNextPunctuation),
    isPreviousPunctuation,
    isNextPunctuation,
  };
}

function underscoreCanOpen(
  value: string,
  index: number,
  length: number,
): boolean {
  const flanking = underscoreFlanking(value, index, length);
  return flanking.left && (!flanking.right || flanking.isPreviousPunctuation);
}

function underscoreCanClose(
  value: string,
  index: number,
  length: number,
): boolean {
  const flanking = underscoreFlanking(value, index, length);
  return flanking.right && (!flanking.left || flanking.isNextPunctuation);
}

function delimiterRunLength(
  value: string,
  start: number,
  character: string,
): number {
  let end = start;
  while (value[end] === character) end += 1;
  return end - start;
}

function closingDelimiter(
  value: string,
  delimiter: string,
  start: number,
): number {
  const isUnderscore = delimiter.startsWith("_");
  let index = value.indexOf(delimiter, start);
  while (index >= 0) {
    const isExactRun =
      !isUnderscore ||
      delimiterRunLength(value, index, "_") === delimiter.length;
    if (
      isExactRun &&
      (!isUnderscore || underscoreCanClose(value, index, delimiter.length))
    ) {
      return index;
    }
    index = value.indexOf(delimiter, index + 1);
  }
  return -1;
}

function backtickRunLength(value: string, start: number): number {
  let end = start;
  while (value[end] === "`") end += 1;
  return end - start;
}

function closingBackticks(
  value: string,
  start: number,
  length: number,
): number {
  let index = start;
  while (index < value.length) {
    if (value[index] !== "`") {
      index += 1;
      continue;
    }
    const candidateLength = backtickRunLength(value, index);
    if (candidateLength === length) return index;
    index += candidateLength;
  }
  return -1;
}

function normalizedCodeSpan(value: string): string {
  const normalized = value.replace(/[ \t\r\n]+/gu, " ");
  if (/^ \S(?:.*\S)? $/u.test(normalized)) {
    return normalized.slice(1, -1);
  }
  return normalized;
}

function githubHeadingText(value: string): string {
  let result = "";
  let index = 0;
  while (index < value.length) {
    if (
      value[index] === "\\" &&
      index + 1 < value.length &&
      /[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/u.test(value[index + 1])
    ) {
      result += value[index + 1];
      index += 2;
      continue;
    }

    if (value[index] === "`") {
      const length = backtickRunLength(value, index);
      const close = closingBackticks(value, index + length, length);
      if (close >= 0) {
        result += normalizedCodeSpan(value.slice(index + length, close));
        index = close + length;
        continue;
      }
    }

    const html = value.slice(index).match(/^<\/?[A-Za-z][^>]*>/u);
    if (html) {
      index += html[0].length;
      continue;
    }

    const isImage = value.startsWith("![", index);
    if (isImage || value[index] === "[") {
      const labelStart = index + (isImage ? 2 : 1);
      const labelEnd = value.indexOf("]", labelStart);
      if (labelEnd >= 0) {
        const targetStart = labelEnd + 1;
        const targetOpen = value[targetStart];
        const targetClose =
          targetOpen === "(" ? ")" : targetOpen === "[" ? "]" : "";
        const targetEnd = targetClose
          ? value.indexOf(targetClose, targetStart + 1)
          : -1;
        if (targetEnd >= 0) {
          result += githubHeadingText(value.slice(labelStart, labelEnd));
          index = targetEnd + 1;
          continue;
        }
      }
    }

    let delimiter = "";
    if (value[index] === "_") {
      const length = delimiterRunLength(value, index, "_");
      if (length > 2) {
        result += value.slice(index, index + length);
        index += length;
        continue;
      }
      delimiter = "_".repeat(length);
    } else {
      delimiter =
        ["**", "~~", "*"].find((item) => value.startsWith(item, index)) ?? "";
    }
    if (
      delimiter &&
      (!delimiter.startsWith("_") ||
        underscoreCanOpen(value, index, delimiter.length))
    ) {
      const close = closingDelimiter(
        value,
        delimiter,
        index + delimiter.length,
      );
      if (close >= 0) {
        result += githubHeadingText(
          value.slice(index + delimiter.length, close),
        );
        index = close + delimiter.length;
        continue;
      }
    }

    result += value[index];
    index += 1;
  }
  return result;
}

function githubAnchor(value: string): string {
  return githubHeadingText(value)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}_\- ]/gu, "")
    .replaceAll(" ", "-");
}

function anchorsFor(file: string): Set<string> {
  return anchorsForText(read(file));
}

function anchorsForText(content: string): Set<string> {
  const text = withoutFencedCode(content);
  const anchors = new Set<string>();
  for (const match of text.matchAll(/<a\s+id=["']([^"']+)["']\s*>\s*<\/a>/gi)) {
    anchors.add(match[1]);
  }
  const generated = new Set<string>();
  const occurrences = new Map<string, number>();
  for (const match of text.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const base = githubAnchor(match[1]);
    if (!base) continue;
    let count = occurrences.get(base) ?? 0;
    let anchor = count === 0 ? base : `${base}-${count}`;
    while (generated.has(anchor)) {
      count += 1;
      anchor = `${base}-${count}`;
    }
    occurrences.set(base, count + 1);
    generated.add(anchor);
    anchors.add(anchor);
  }
  return anchors;
}

function withoutFencedCode(text: string): string {
  let fence:
    | Readonly<{
        marker: "`" | "~";
        length: number;
      }>
    | undefined;
  return text
    .split(/\r?\n/u)
    .map((line) => {
      if (fence) {
        const closing = line.match(/^\s{0,3}(?<marker>`+|~+)\s*$/u);
        if (
          closing?.groups?.marker?.startsWith(fence.marker) &&
          closing.groups.marker.length >= fence.length
        )
          fence = undefined;
        return "";
      }
      const opening = line.match(/^\s{0,3}(?<marker>`{3,}|~{3,})/u);
      if (opening?.groups?.marker) {
        fence = {
          marker: opening.groups.marker[0] as "`" | "~",
          length: opening.groups.marker.length,
        };
        return "";
      }
      return line;
    })
    .join("\n");
}

function visibleMarkdownStructure(text: string): string {
  let fence:
    | Readonly<{
        marker: "`" | "~";
        length: number;
      }>
    | undefined;
  let isInHtmlComment = false;

  return text
    .split(/\r?\n/u)
    .map((line) => {
      if (fence) {
        const closing = line.match(/^\s{0,3}(?<marker>`+|~+)\s*$/u);
        if (
          closing?.groups?.marker?.startsWith(fence.marker) &&
          closing.groups.marker.length >= fence.length
        )
          fence = undefined;
        return "";
      }

      let visible = "";
      let cursor = 0;
      while (cursor < line.length) {
        if (isInHtmlComment) {
          const commentEnd = line.indexOf("-->", cursor);
          if (commentEnd < 0) {
            visible += " ".repeat(line.length - cursor);
            cursor = line.length;
            continue;
          }
          visible += " ".repeat(commentEnd + 3 - cursor);
          cursor = commentEnd + 3;
          isInHtmlComment = false;
          continue;
        }

        const commentStart = line.indexOf("<!--", cursor);
        if (commentStart < 0) {
          visible += line.slice(cursor);
          cursor = line.length;
          continue;
        }
        visible += line.slice(cursor, commentStart);
        visible += " ".repeat(4);
        cursor = commentStart + 4;
        isInHtmlComment = true;
      }

      const opening = visible.match(/^\s{0,3}(?<marker>`{3,}|~{3,})/u);
      if (opening?.groups?.marker) {
        fence = {
          marker: opening.groups.marker[0] as "`" | "~",
          length: opening.groups.marker.length,
        };
        return "";
      }
      return visible;
    })
    .join("\n");
}

function visibleMarkdownIncludingFencedCode(text: string): string {
  let fence:
    | Readonly<{
        marker: "`" | "~";
        length: number;
      }>
    | undefined;
  let isInHtmlComment = false;

  return text
    .split(/\r?\n/u)
    .map((line) => {
      if (fence) {
        const closing = line.match(/^\s{0,3}(?<marker>`+|~+)\s*$/u);
        if (
          closing?.groups?.marker?.startsWith(fence.marker) &&
          closing.groups.marker.length >= fence.length
        )
          fence = undefined;
        return line;
      }

      let visible = "";
      let cursor = 0;
      while (cursor < line.length) {
        if (isInHtmlComment) {
          const commentEnd = line.indexOf("-->", cursor);
          if (commentEnd < 0) {
            visible += " ".repeat(line.length - cursor);
            cursor = line.length;
            continue;
          }
          visible += " ".repeat(commentEnd + 3 - cursor);
          cursor = commentEnd + 3;
          isInHtmlComment = false;
          continue;
        }
        const commentStart = line.indexOf("<!--", cursor);
        if (commentStart < 0) {
          visible += line.slice(cursor);
          cursor = line.length;
          continue;
        }
        visible += line.slice(cursor, commentStart);
        visible += " ".repeat(4);
        cursor = commentStart + 4;
        isInHtmlComment = true;
      }

      const opening = visible.match(/^\s{0,3}(?<marker>`{3,}|~{3,})/u);
      if (opening?.groups?.marker)
        fence = {
          marker: opening.groups.marker[0] as "`" | "~",
          length: opening.groups.marker.length,
        };
      return visible;
    })
    .join("\n");
}

function markdownLinkTargets(text: string): string[] {
  const content = withoutFencedCode(text);
  const definitions = new Map<string, string>();
  for (const match of content.matchAll(
    /^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|\S+)(?:\s+(?:["'(].*)?)?$/gmu,
  )) {
    definitions.set(normalizeReferenceLabel(match[1]), match[2]);
  }
  const targets = [...content.matchAll(/(?<!!)\[[^\]]+\]\(([^)\n]+)\)/gu)].map(
    (match) => match[1],
  );
  for (const match of content.matchAll(/(?<!!)\[([^\]]+)\]\[([^\]]*)\]/gu)) {
    const label = normalizeReferenceLabel(match[2] || match[1]);
    const target = definitions.get(label);
    if (target) targets.push(target);
  }
  for (const match of content.matchAll(/(?<!!)\[([^\]\n]+)\](?!\[|\()/gu)) {
    const matchEnd = (match.index ?? 0) + match[0].length;
    if (content[matchEnd] === ":") continue;
    const target = definitions.get(normalizeReferenceLabel(match[1]));
    if (target) targets.push(target);
  }
  return targets;
}

type FormalInputTarget = Readonly<{
  target: string;
  invalidEntity: boolean;
}>;

function uxFormalInputTargets(text: string): FormalInputTarget[] {
  const content = withoutFencedCode(text)
    .replace(/<!--[\s\S]*?-->/gu, "")
    .replace(/\\\[[^\]\n]+\](?:\([^\n)]*\)|\[[^\]\n]*\])?/gu, "")
    .replace(
      /\\(?=(?:\.\.[\\/])+01_Discovery[\\/])(?:\.\.[\\/])+01_Discovery[\\/](?:Analysis|Definitions)[\\/][^\s"'<>`()#]+(?:#[^\s"'<>`()#]+)?/gu,
      "",
    );
  const targets = new Map<string, FormalInputTarget>();
  const addCandidate = (
    candidate: string,
    isDiscoveryShapeRequired = false,
    predecoded?: Readonly<{ value: string; invalid: boolean }>,
  ): void => {
    const decoded = predecoded ?? decodeHtmlEntitiesOnce(candidate);
    const isPathRelevant = isDiscoveryPathCandidate(candidate, decoded.value);
    if (isDiscoveryShapeRequired && !isPathRelevant) return;
    const current = targets.get(decoded.value);
    targets.set(decoded.value, {
      target: decoded.value,
      invalidEntity: Boolean(
        current?.invalidEntity || (decoded.invalid && isPathRelevant),
      ),
    });
  };
  for (const candidate of markdownLinkTargets(content)) addCandidate(candidate);
  for (const match of content.matchAll(
    /<a\s+[^>]*\bhref\s*=\s*(?:"(?<double>[^"]*)"|'(?<single>[^']*)'|(?<unquoted>[^\s"'=<>]+))[^>]*>/giu,
  ))
    for (const candidate of [
      match.groups?.double,
      match.groups?.single,
      match.groups?.unquoted,
    ]) {
      if (!candidate) continue;
      addCandidate(candidate);
    }
  for (const match of content.matchAll(
    /(?<![\\/\p{L}\p{N}_])(?<target>(?:(?:[A-Za-z]:[\\/]|\/)(?:[^\s"'<>`]+[\\/])*|(?:\.[\\/])?(?:\.\.[\\/])+|(?:\.[\\/]))?01_Discovery[\\/](?:Analysis|Definitions)[\\/][^\s"'<>`()#]+(?:#[^\s"'<>`()#]+)?)/gu,
  ))
    if (match.groups?.target)
      addCandidate(
        /^01_Discovery[\\/]/u.test(match.groups.target)
          ? path.join(root, match.groups.target)
          : match.groups.target,
      );
  for (const token of content.match(/[^\s"'<>`()]+/gu) ?? []) {
    const candidate = rawEntityPathCandidate(token);
    if (candidate) addCandidate(candidate.value, true, candidate);
  }
  return [...targets.values()];
}

function rawEntityPathCandidate(
  token: string,
): Readonly<{ value: string; invalid: boolean }> | null {
  const escapedPathMarker = "\u{e001}";
  const escapedNonPathMarker = "\u{e002}";
  let masked = token.replace(
    /\\&(?<name>#[xX]?[0-9A-Fa-f]*|[A-Za-z][A-Za-z0-9]*);?/gu,
    (_match, ...args: unknown[]) => {
      const groups = args.at(-1) as Readonly<{ name?: string }> | undefined;
      return /^(?:sol|bsol)$/iu.test(groups?.name ?? "")
        ? escapedPathMarker
        : escapedNonPathMarker;
    },
  );
  if (/^\\(?=[./\\0])/u.test(masked))
    masked = `${escapedPathMarker}${masked.slice(1)}`;
  const decoded = decodeHtmlEntitiesOnce(masked);

  for (const rootMatch of decoded.value.matchAll(/0(?:1|&)/gu)) {
    const rootIndex = rootMatch.index ?? 0;
    const precedingMarker = decoded.value.lastIndexOf(
      escapedPathMarker,
      rootIndex,
    );
    if (precedingMarker >= 0) {
      const between = decoded.value.slice(precedingMarker + 1, rootIndex);
      if (!/[^A-Za-z0-9._/\\-]/u.test(between)) continue;
    }
    const candidate = decoded.value.slice(rootIndex);
    if (
      decoded.invalid ||
      /[\u{e001}\u{e002}]/u.test(candidate) ||
      candidate !== token.slice(rootIndex)
    )
      return { value: candidate, invalid: decoded.invalid };
  }
  return null;
}

function isDiscoveryPathCandidate(raw: string, decoded: string): boolean {
  const entityLike = /&(?:#[xX]?[0-9A-Fa-f]*|[A-Za-z][A-Za-z0-9]*);?/gu;
  const entityMarker = "\u{e000}";
  const candidates = [raw, decoded];
  const directPathSkeleton =
    /(?:^|[\\/])01_Discovery[\\/](?:Analysis|Definitions)[\\/](?:REQ|EXP)-[0-9]/iu;
  const possibleEntityPathSkeleton =
    /(?:^|[\\/\u{e000}])0\u{e000}*1\u{e000}*(?:_|\u{e000})\u{e000}*D\u{e000}*i\u{e000}*s\u{e000}*c\u{e000}*o\u{e000}*v\u{e000}*e\u{e000}*r\u{e000}*y[\\/\u{e000}]+(?:A\u{e000}*n\u{e000}*a\u{e000}*l\u{e000}*y\u{e000}*s\u{e000}*i\u{e000}*s|D\u{e000}*e\u{e000}*f\u{e000}*i\u{e000}*n\u{e000}*i\u{e000}*t\u{e000}*i\u{e000}*o\u{e000}*n\u{e000}*s)[\\/\u{e000}]+(?:R\u{e000}*E\u{e000}*Q|E\u{e000}*X\u{e000}*P)\u{e000}*-\u{e000}*[0-9]/iu;
  return candidates.some(
    (candidate) =>
      directPathSkeleton.test(candidate) ||
      possibleEntityPathSkeleton.test(
        candidate.replace(entityLike, entityMarker),
      ),
  );
}

function decodeHtmlEntitiesOnce(
  value: string,
): Readonly<{ value: string; invalid: boolean }> {
  let isInvalid = false;
  const decoded = value.replace(
    /&(?:#(?<decimal>[0-9]+)|#x(?<hex>[0-9A-Fa-f]+)|(?<named>[A-Za-z][A-Za-z0-9]*));/gu,
    (match, ...args: unknown[]) => {
      const groups = args.at(-1) as
        | Readonly<{
            decimal?: string;
            hex?: string;
            named?: string;
          }>
        | undefined;
      const numeric = groups?.decimal ?? groups?.hex;
      if (numeric) {
        const point = Number.parseInt(numeric, groups?.decimal ? 10 : 16);
        if (
          !Number.isSafeInteger(point) ||
          point < 0 ||
          point > 0x10ffff ||
          (point >= 0xd800 && point <= 0xdfff)
        ) {
          isInvalid = true;
          return match;
        }
        return String.fromCodePoint(point);
      }
      const named = {
        amp: "&",
        quot: '"',
        apos: "'",
        lt: "<",
        gt: ">",
        sol: "/",
        bsol: "\\",
        lowbar: "_",
        period: ".",
      }[groups?.named ?? ""];
      if (named === undefined) {
        isInvalid = true;
        return match;
      }
      return named;
    },
  );
  if (/&(?:#[xX]?[0-9A-Fa-f]+|[A-Za-z][A-Za-z0-9]*);?/u.test(decoded))
    isInvalid = true;
  return { value: decoded, invalid: isInvalid };
}

function normalizeReferenceLabel(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLowerCase();
}

function markdownTableCells(line: string): string[] | null {
  const value = line.trim();
  if (!value.includes("|")) return null;
  const cells = [""];
  let codeDelimiter = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\" && index + 1 < value.length) {
      cells[cells.length - 1] += value[index + 1];
      index += 1;
      continue;
    }
    if (value[index] === "`") {
      let length = 1;
      while (value[index + length] === "`") length += 1;
      if (codeDelimiter === 0) codeDelimiter = length;
      else if (codeDelimiter === length) codeDelimiter = 0;
      cells[cells.length - 1] += "`".repeat(length);
      index += length - 1;
      continue;
    }
    if (value[index] === "|" && codeDelimiter === 0) {
      cells.push("");
      continue;
    }
    cells[cells.length - 1] += value[index];
  }
  if (value.startsWith("|")) cells.shift();
  if (value.endsWith("|") && !value.endsWith("\\|")) cells.pop();
  return cells.map((cell) => cell.trim().replaceAll("`", ""));
}

function markdownTableSeparator(line: string, expectedCells: number): boolean {
  const cells = markdownTableCells(line);
  return (
    cells !== null &&
    cells.length === expectedCells &&
    cells.every((cell) => /^:?-+:?$/u.test(cell))
  );
}

function safeDecode(
  value: string,
): Readonly<{ value: string; error: boolean }> {
  try {
    return { value: decodeURIComponent(value), error: false };
  } catch {
    return { value, error: true };
  }
}

function splitLink(raw: string) {
  let value = raw.trim();
  if (value.startsWith("<") && value.includes(">")) {
    value = value.slice(1, value.indexOf(">"));
  } else {
    value = value.split(/\s+["']/u, 1)[0];
  }
  const index = value.indexOf("#");
  const target = index >= 0 ? value.slice(0, index) : value;
  const anchor = index >= 0 ? value.slice(index + 1) : "";
  const decodedTarget = safeDecode(target);
  const decodedAnchor = safeDecode(anchor);
  return {
    target: decodedTarget.value,
    anchor: decodedAnchor.value,
    decodeError: decodedTarget.error || decodedAnchor.error,
  };
}

function isWithin(parent: string, child: string): boolean {
  const relation = path.relative(parent, child);
  return (
    relation === "" ||
    (!relation.startsWith("..") && !path.isAbsolute(relation))
  );
}

function resolveLocalTarget(source: string, raw: string): LinkResolution {
  const parsed = splitLink(raw);
  const targetText = parsed.target;
  const anchor = parsed.anchor;
  if (/^(?:https?|mailto|tel):/i.test(targetText)) {
    return {
      external: true,
      target: null,
      anchor,
      targetText,
      decodeError: parsed.decodeError,
      outsideRoot: false,
    };
  }
  let target = targetText
    ? path.resolve(path.dirname(source), targetText)
    : source;
  if (!isWithin(root, target)) {
    return {
      external: false,
      target,
      anchor,
      targetText,
      decodeError: parsed.decodeError,
      outsideRoot: true,
      symbolicBoundary: false,
    };
  }
  if (pathContainsSymbolicLink(target)) {
    return {
      external: false,
      target,
      anchor,
      targetText,
      decodeError: parsed.decodeError,
      outsideRoot: false,
      symbolicBoundary: true,
    };
  }
  const templateCrdd = path.join(root, "template", "00_CRDD");
  if (
    !fs.existsSync(target) &&
    source.startsWith(path.join(root, "template") + path.sep) &&
    target.startsWith(templateCrdd + path.sep)
  ) {
    const distributedName = path.relative(templateCrdd, target);
    const canonicalTarget = path.join(root, distributedName);
    if (
      !pathContainsSymbolicLink(canonicalTarget) &&
      fs.existsSync(canonicalTarget)
    ) {
      target = canonicalTarget;
    }
  }
  return {
    external: false,
    target,
    anchor,
    targetText,
    decodeError: parsed.decodeError,
    outsideRoot: false,
    symbolicBoundary: pathContainsSymbolicLink(target),
  };
}

type WorkLifecycleMigrationEntry = Readonly<{
  source: string;
  target: string;
  sourceSha256: string;
  targetSha256: string;
  currentnessAtMigration: string;
}>;

function isCanonicalRepositoryRelativePath(value: string): boolean {
  return (
    value !== "" &&
    value === value.replaceAll("\\", "/") &&
    !value.startsWith("/") &&
    !/^[A-Za-z]:/u.test(value) &&
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function loadFixedHistoryMigration(): Readonly<{
  byCurrentPath: ReadonlyMap<string, WorkLifecycleMigrationEntry>;
  byHistoricalPath: ReadonlyMap<string, WorkLifecycleMigrationEntry>;
  sourceCommit: string | null;
}> {
  const empty = {
    byCurrentPath: new Map<string, WorkLifecycleMigrationEntry>(),
    byHistoricalPath: new Map<string, WorkLifecycleMigrationEntry>(),
    sourceCommit: null,
  };
  if (repositoryMode !== "official") return empty;
  const manifestPath = path.join(
    root,
    "99_Roadmap",
    "Changes",
    "CHG-000070",
    "Evidence",
    "260912-2142_migration-map.json",
  );
  if (!fs.existsSync(manifestPath)) return empty;
  try {
    const parsed = JSON.parse(read(manifestPath)) as {
      contract?: unknown;
      entries?: unknown;
      sourceCommit?: unknown;
    };
    if (
      parsed.contract !== "crdd/work-lifecycle-migration-map" ||
      !Array.isArray(parsed.entries) ||
      typeof parsed.sourceCommit !== "string" ||
      !/^[0-9a-f]{40,64}$/iu.test(parsed.sourceCommit)
    )
      throw new Error("contract or entries is invalid");
    const byCurrentPath = new Map<string, WorkLifecycleMigrationEntry>();
    const byHistoricalPath = new Map<string, WorkLifecycleMigrationEntry>();
    const sources = new Set<string>();
    const targets = new Set<string>();
    for (const value of parsed.entries) {
      if (!value || typeof value !== "object")
        throw new Error("entry is not an object");
      const entry = value as Partial<WorkLifecycleMigrationEntry>;
      if (
        typeof entry.source !== "string" ||
        typeof entry.target !== "string" ||
        typeof entry.sourceSha256 !== "string" ||
        typeof entry.targetSha256 !== "string" ||
        typeof entry.currentnessAtMigration !== "string"
      )
        throw new Error("entry fields are invalid");
      if (
        !isCanonicalRepositoryRelativePath(entry.source) ||
        !isCanonicalRepositoryRelativePath(entry.target)
      )
        throw new Error("entry path is not canonical repository-relative");
      if (
        !/^[0-9a-f]{64}$/iu.test(entry.sourceSha256) ||
        !/^[0-9a-f]{64}$/iu.test(entry.targetSha256)
      )
        throw new Error("entry hash is invalid");
      if (
        !new Set(["current", "fixed_history"]).has(entry.currentnessAtMigration)
      )
        throw new Error("entry currentness is invalid");
      if (sources.has(entry.source) || targets.has(entry.target))
        throw new Error("entry source or target is duplicated");
      sources.add(entry.source);
      targets.add(entry.target);
      if (
        entry.currentnessAtMigration !== "fixed_history" ||
        !entry.target.replaceAll("\\", "/").includes("/Evidence/")
      )
        continue;
      byCurrentPath.set(
        entry.target.replaceAll("\\", "/"),
        entry as WorkLifecycleMigrationEntry,
      );
      byHistoricalPath.set(
        entry.source.replaceAll("\\", "/"),
        entry as WorkLifecycleMigrationEntry,
      );
    }
    return {
      byCurrentPath,
      byHistoricalPath,
      sourceCommit: parsed.sourceCommit,
    };
  } catch (error) {
    add(
      "error",
      "fixed-history-migration-map-invalid",
      relative(manifestPath),
      error instanceof Error ? error.message : String(error),
    );
    return empty;
  }
}

const fixedHistoryMigration = loadFixedHistoryMigration();
const historicalContentCache = new Map<string, string | null>();

function historicalContent(relativePath: string): string | null {
  if (!fixedHistoryMigration.sourceCommit) return null;
  const normalized = relativePath.replaceAll("\\", "/");
  if (historicalContentCache.has(normalized))
    return historicalContentCache.get(normalized) ?? null;
  const content = readFixedSnapshotText(
    root,
    fixedHistoryMigration.sourceCommit,
    normalized,
  );
  historicalContentCache.set(normalized, content);
  return content;
}

function resolveLinkWithFixedHistory(source: string, raw: string): LinkRecord {
  const currentSourcePath = relative(source);
  const migration = fixedHistoryMigration.byCurrentPath.get(currentSourcePath);
  if (!migration)
    return {
      source,
      raw,
      fixedHistoricalReference: false,
      historicalTargetExists: false,
      historicalAnchorExists: null,
      ...resolveLocalTarget(source, raw),
    };

  const actualSha256 = createHash("sha256")
    .update(fs.readFileSync(source))
    .digest("hex");
  if (actualSha256 !== migration.targetSha256)
    add(
      "error",
      "fixed-history-content-mismatch",
      currentSourcePath,
      `Expected ${migration.targetSha256}; observed ${actualSha256}.`,
    );

  const historicalSource = path.resolve(root, migration.source);
  const historical = resolveLocalTarget(historicalSource, raw);
  if (historical.external)
    return {
      source,
      raw,
      fixedHistoricalReference: true,
      historicalTargetExists: false,
      historicalAnchorExists: null,
      ...historical,
    };
  const historicalTargetPath = relative(historical.target);
  const content = historical.outsideRoot
    ? null
    : historicalContent(historicalTargetPath);
  const successor =
    fixedHistoryMigration.byHistoricalPath.get(historicalTargetPath);
  const target = successor
    ? path.resolve(root, successor.target)
    : historical.target;
  return {
    ...historical,
    source,
    raw,
    fixedHistoricalReference: true,
    target,
    outsideRoot: !isWithin(root, target),
    symbolicBoundary:
      isWithin(root, target) && pathContainsSymbolicLink(target),
    historicalTargetExists: content !== null,
    historicalAnchorExists:
      content === null || historical.anchor === ""
        ? null
        : anchorsForText(content).has(historical.anchor),
  };
}

const discovery = discoverProjectFiles();
if (discovery.baseline_submodule && repositoryMode !== "adopter") {
  repositoryMode = "adopter";
  adoptedBaselineRoot = baselineCandidateRoot;
  workLifecycleRoots = [path.join(root, "99_Roadmap")];
  recognizedChangeTracePatterns = ["99_Roadmap/Changes/CHG-*/change.md"];
}
const gitlinkRoots = discovery.gitlinks;
function gitlinkRootFor(target: string): string | null {
  return gitlinkRoots.find((item) => isWithin(item, target)) ?? null;
}
const baselineState = discovery.baseline_submodule_state;
if (discovery.baseline_submodule) {
  if (baselineState.declared === null) {
    add(
      "error",
      "baseline-submodule-unverified",
      "00_CRDD",
      "The checker could not verify the .gitmodules declaration for the adopted baseline.",
    );
  } else if (baselineState.gitlink_indexed === false) {
    add(
      "error",
      "baseline-gitlink-missing",
      "00_CRDD",
      "The adopted baseline is declared in .gitmodules, but the parent Git index does not contain a mode 160000 gitlink at 00_CRDD.",
    );
  } else if (baselineState.gitlink_indexed === null) {
    add(
      "error",
      "baseline-submodule-unverified",
      "00_CRDD",
      "The checker could not verify a normal mode 160000 parent-index gitlink for the adopted baseline. Resolve index conflicts or metadata access failures and run the check again.",
    );
  } else {
    if (baselineState.declared === false) {
      add(
        "error",
        "baseline-submodule-declaration-missing",
        "00_CRDD",
        "The parent Git index contains a mode 160000 gitlink at 00_CRDD, but .gitmodules does not declare that path.",
      );
    }
    if (baselineState.worktree_present === false) {
      add(
        "error",
        "baseline-submodule-not-initialized",
        "00_CRDD",
        "Initialize the adopted CRDD baseline submodule before checking the project.",
      );
    } else if (
      baselineState.gitdir_accessible !== true ||
      baselineState.head_readable !== true
    ) {
      add(
        "error",
        "baseline-submodule-unverified",
        "00_CRDD",
        "The baseline worktree exists, but the checker could not verify that it is the 00_CRDD Git worktree or read its Git directory and HEAD. Fix access to the repository metadata and run the check again.",
      );
    } else if (baselineState.head_matches_gitlink === false) {
      add(
        "error",
        "baseline-submodule-revision-mismatch",
        "00_CRDD",
        `The baseline worktree HEAD ${baselineState.head_oid} does not match the parent-index gitlink ${baselineState.gitlink_oid}.`,
      );
    }
  }
}
const allFiles = discovery.files;
const allFileSet = new Set(allFiles);
const allMarkdownFiles = allFiles.filter((file) =>
  file.toLowerCase().endsWith(".md"),
);

const phaseDiagramDispositions = [
  "`作成`",
  "`既存参照`",
  "`非該当`",
  "`作成不能`",
] as const;
const phaseDiagramTemplateProfiles = new Map<string, readonly string[]>([
  [
    "template/01_Discovery/01_Product_Discovery.md",
    [
      "課題・根拠・機会の関係",
      "業務範囲／入出力（SIPOC）",
      "担い手別の仕事の流れ（Swimlane）",
      "価値が届くまでの流れ",
      "現状／変更後",
      "項目間全体像",
    ],
  ],
  [
    "template/02_UX/01_User_Experience.md",
    ["利用の流れ", "重要場面・失敗／回復体験図", "サービス提供の流れ"],
  ],
  [
    "template/03_IA/01_Information_Architecture.md",
    [
      "オブジェクト／関係図",
      "情報階層図",
      "Navigation図",
      "可視性／状態概念図",
    ],
  ],
  [
    "template/04_UI/01_User_Interface.md",
    [
      "論理画面／領域構成図",
      "画面／操作Flow",
      "表示状態／Variant図",
      "主要Component関係図",
      "UI／SPEC対応図",
    ],
  ],
  [
    "template/05_SPEC/01_Behavior_Specification.md",
    [
      "Use Case／振る舞いFlow",
      "状態遷移表／状態遷移図",
      "Actor／System間Sequence図",
      "Error／Effect分岐図",
      "UI／SPEC対応図",
    ],
  ],
  [
    "template/06_Architecture/01_Architecture.md",
    [
      "全体／内部ブロック図",
      "状態遷移表／状態遷移図",
      "ブロック間シーケンス図",
      "クラス／型関係図",
      "データフロー図（DFD）",
      "エンティティ関係図（ER図）",
      "スキーマ責務図（Schema Responsibility Map）",
    ],
  ],
  [
    "template/07_Quality/03_Verification_Design.md",
    [
      "検証義務・試験Level／Boundary対応図",
      "状態・分岐・Block別Coverage図",
      "検証結果・判断接続図",
    ],
  ],
]);

function checkPhaseDiagramDispositionContracts(): void {
  if (repositoryMode !== "official") return;
  const expectedHeaders = [
    "基本図",
    "対象",
    "目的",
    "処置",
    "現行図／一意な参照／理由",
    "投影元改訂版",
    "現在状態",
    "未確認範囲",
    "次の処置・再評価契機",
  ];
  const allowedDispositions = new Set([
    "",
    "作成",
    "既存参照",
    "非該当",
    "作成不能",
  ]);
  const cells = (line: string): string[] =>
    line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`|`$/gu, ""));
  for (const [relativePath, diagrams] of phaseDiagramTemplateProfiles) {
    const file =
      allFiles.find((candidate) => relative(candidate) === relativePath) ??
      path.join(root, ...relativePath.split("/"));
    if (!fs.existsSync(file)) continue;
    const content = read(file);
    const missingItems: string[] = [];
    if (
      relativePath === "template/01_Discovery/01_Product_Discovery.md" &&
      (!content.includes("## 人間理解の確認") ||
        !content.includes("| 発火判定と理由 |") ||
        !content.includes("| 人間の確認または修正 |"))
    )
      missingItems.push("human-understanding-confirmation");
    const sectionHeading = /^## (?:[0-9]+\.\s+)?基本図の処置$/mu.exec(content);
    const sectionStart = sectionHeading?.index ?? -1;
    if (sectionStart < 0) missingItems.push("section");
    for (const disposition of phaseDiagramDispositions)
      if (!content.includes(disposition)) missingItems.push(disposition);
    const section = sectionStart < 0 ? "" : content.slice(sectionStart);
    const lines = section.split(/\r?\n/u);
    const headerIndex = lines.findIndex((line) =>
      line.startsWith("| 基本図 |"),
    );
    const headerCells = headerIndex < 0 ? [] : cells(lines[headerIndex] ?? "");
    if (
      headerCells.length !== expectedHeaders.length ||
      headerCells.some((value, index) => value !== expectedHeaders[index])
    )
      missingItems.push("header");
    const rows = new Map<string, string[]>();
    if (headerIndex >= 0) {
      for (const line of lines.slice(headerIndex + 2)) {
        if (!line.startsWith("|")) break;
        const rowCells = cells(line);
        if (rowCells[0]) rows.set(rowCells[0], rowCells);
      }
    }
    for (const diagram of diagrams) {
      const rowCells = rows.get(diagram);
      if (!rowCells) {
        missingItems.push(diagram);
        continue;
      }
      if (rowCells.length !== expectedHeaders.length)
        missingItems.push(`${diagram}:columns`);
      const disposition = rowCells[3] ?? "";
      if (!allowedDispositions.has(disposition))
        missingItems.push(`${diagram}:disposition=${disposition}`);
    }
    if (missingItems.length > 0)
      add(
        "error",
        "phase_diagram_disposition_contract_invalid",
        relativePath,
        `工程の基本図処置契約が不完全です: ${missingItems.join(", ")}`,
      );
  }
}

checkPhaseDiagramDispositionContracts();

const linkRecords: LinkRecord[] = [];
for (const source of allMarkdownFiles) {
  for (const raw of markdownLinkTargets(read(source))) {
    linkRecords.push(resolveLinkWithFixedHistory(source, raw));
  }
}

const requestedScopes = scopeValues.map((value) => path.resolve(root, value));
for (const scope of requestedScopes) {
  if (!isWithin(root, scope)) {
    console.error(`--scope must stay under the target root: ${scope}`);
    process.exit(2);
  }
  if (pathContainsSymbolicLink(scope)) {
    cliError(`--scope must not traverse a symbolic link: ${relative(scope)}`);
  }
  const scopeGitlink = gitlinkRootFor(scope);
  const scopeIsInAdoptedBaseline =
    scopeGitlink &&
    discovery.baseline_submodule &&
    adoptedBaselineRoot &&
    samePath(scopeGitlink, adoptedBaselineRoot);
  if (scopeGitlink && !scopeIsInAdoptedBaseline) {
    cliError(
      `--scope points into a Gitlink submodule. Run the checker with --root ${relative(scopeGitlink)} after initializing that submodule.`,
    );
  }
  if (!fs.existsSync(scope)) {
    console.error(`--scope does not exist: ${scope}`);
    process.exit(2);
  }
  if (
    discovery.baseline_submodule &&
    adoptedBaselineRoot &&
    isWithin(adoptedBaselineRoot, scope)
  ) {
    cliError(
      `--scope points into the adopted CRDD baseline submodule. Run the checker with --root ${relative(adoptedBaselineRoot)} to inspect the baseline itself.`,
    );
  }
}

const uncheckedItems = new Set(discovery.unchecked);
const checkedFiles = new Set();
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

const markdownFiles = allMarkdownFiles.filter((file) => checkedFiles.has(file));
const anchorCache = new Map<string, Set<string>>();
let checkedLocalLinks = 0;
let checkedAnchors = 0;
for (const record of linkRecords) {
  if (!checkedFiles.has(record.source) || record.external) continue;
  const { source, raw, target, anchor } = record;
  if (record.decodeError) {
    add("warning", "malformed-link-encoding", relative(source), raw);
    uncheckedItems.add(
      `Malformed link encoding in ${relative(source)}: ${raw}`,
    );
    continue;
  }
  if (record.outsideRoot) {
    add("warning", "outside-root-link", relative(source), raw);
    uncheckedItems.add(
      `Outside-root local link from ${relative(source)}: ${raw}`,
    );
    continue;
  }
  if (record.symbolicBoundary) {
    add("warning", "symbolic-link-target", relative(source), raw);
    uncheckedItems.add(`Symbolic link target from ${relative(source)}: ${raw}`);
    continue;
  }
  if (record.fixedHistoricalReference) {
    checkedLocalLinks += 1;
    if (anchor && record.historicalTargetExists) {
      checkedAnchors += 1;
      if (record.historicalAnchorExists === false)
        add(
          "error",
          "broken-anchor",
          relative(source),
          `${raw} -> historical #${anchor}`,
        );
    }
    continue;
  }
  const targetGitlink = gitlinkRootFor(target);
  const targetIsInAdoptedBaseline =
    targetGitlink &&
    discovery.baseline_submodule &&
    adoptedBaselineRoot &&
    samePath(targetGitlink, adoptedBaselineRoot);
  if (targetGitlink && !targetIsInAdoptedBaseline) {
    add("warning", "gitlink-target-unchecked", relative(source), raw);
    uncheckedItems.add(
      `Gitlink target not inspected from ${relative(source)}: ${raw}`,
    );
    continue;
  }
  if (
    !allFileSet.has(target) &&
    fs.existsSync(target) &&
    !fs.statSync(target).isDirectory() &&
    !(
      discovery.baseline_submodule &&
      adoptedBaselineRoot &&
      isWithin(adoptedBaselineRoot, target)
    )
  ) {
    add("warning", "excluded-local-link", relative(source), raw);
    uncheckedItems.add(
      `Excluded local link target from ${relative(source)}: ${raw}`,
    );
    continue;
  }
  if (!fs.existsSync(target)) {
    checkedLocalLinks += 1;
    add("error", "broken-link", relative(source), raw);
    continue;
  }
  checkedLocalLinks += 1;
  if (anchor && target.toLowerCase().endsWith(".md")) {
    checkedAnchors += 1;
    const knownAnchors = anchorCache.get(target) ?? anchorsFor(target);
    anchorCache.set(target, knownAnchors);
    if (!knownAnchors.has(anchor)) {
      add("error", "broken-anchor", relative(source), `${raw} -> #${anchor}`);
    }
  }
}

const requestedDocsRoot =
  repositoryMode === "adopter" ? path.join(root, "00_CRDD") : root;
const requestedDocsRootStat = lstatIfPresent(requestedDocsRoot);
let docsRoot: string | null = null;
if (pathContainsSymbolicLink(requestedDocsRoot)) {
  add(
    "error",
    "symbolic-document-root",
    relative(requestedDocsRoot),
    "The canonical document root must not be a symbolic link or junction.",
  );
} else if (!requestedDocsRootStat) {
  add(
    "error",
    "missing-document-root",
    relative(requestedDocsRoot),
    "The canonical document root does not exist.",
  );
} else if (!requestedDocsRootStat.isDirectory()) {
  add(
    "error",
    "invalid-document-root",
    relative(requestedDocsRoot),
    "The canonical document root must be a directory.",
  );
} else {
  docsRoot = requestedDocsRoot;
}
function parseCanonicalDocumentHeader(content: string): string {
  const headerLines: string[] = [];
  let hasFields = false;
  let hasTitle = false;
  for (const line of content.replace(/^\uFEFF/u, "").split(/\r?\n/u)) {
    if (line.trim() === "") continue;
    if (!hasFields && /^<a id="[^"]+"><\/a>$/u.test(line)) continue;
    if (!hasFields && !hasTitle && /^#\s+\S/u.test(line)) {
      hasTitle = true;
      continue;
    }
    if (!/^[A-Za-z][A-Za-z ]*:[ \t]*.*$/u.test(line)) break;
    hasFields = true;
    headerLines.push(line);
  }
  return headerLines.join("\n");
}

const versionedDocuments = [];
const canonicalDocumentStates = [];
if (docsRoot) {
  for (const name of fs.readdirSync(docsRoot)) {
    if (!/^\d{2}_.+\.md$/u.test(name)) continue;
    const file = path.join(docsRoot, name);
    if (pathContainsSymbolicLink(file)) {
      add(
        "error",
        "symbolic-canonical-document",
        relative(file),
        "Canonical documents must not be symbolic links.",
      );
      continue;
    }
    if (!lstatIfPresent(file)?.isFile()) continue;
    const content = parseCanonicalDocumentHeader(read(file));
    const match = content.match(/^Version:\s*(v[0-9]\S*)\s*$/m);
    if (match) versionedDocuments.push([file, match[1]]);
    canonicalDocumentStates.push({
      file,
      version: match?.[1] ?? null,
      status: content.match(/^Status:\s*(\S.*)\s*$/m)?.[1]?.trim() ?? null,
      releasedBaseline:
        content.match(/^Released Baseline:\s*(v[0-9]\S*)\s*$/m)?.[1] ?? null,
    });
  }
}
if (repositoryMode === "official") {
  const canonicalTitleContracts = new Map([
    ["99_Roadmap/01_Roadmap.md", "# CRDD Roadmap"],
  ]);
  for (const [relativePath, expectedTitle] of canonicalTitleContracts) {
    const file = path.join(root, relativePath);
    if (!lstatIfPresent(file)?.isFile() || pathContainsSymbolicLink(file)) {
      continue;
    }
    const actualTitle = read(file)
      .replace(/^\uFEFF/u, "")
      .split(/\r?\n/u)
      .find((line) => /^#\s+\S/u.test(line));
    if (actualTitle !== expectedTitle) {
      add(
        "error",
        "canonical-document-title-mismatch",
        relativePath,
        `Expected canonical title ${JSON.stringify(expectedTitle)}; found ${JSON.stringify(actualTitle ?? "missing")}.`,
      );
    }
  }
}
const versions = new Set(versionedDocuments.map(([, version]) => version));
if (versions.size > 1) {
  for (const [file, version] of versionedDocuments) {
    add(
      "error",
      "version-mismatch",
      relative(file),
      `Version: ${version}; found ${JSON.stringify([...versions].sort())}`,
    );
  }
}
const candidateDocuments = canonicalDocumentStates.filter(
  ({ status }) => status === "Candidate",
);
for (const { file, status, releasedBaseline } of canonicalDocumentStates) {
  if (status !== "Candidate" && releasedBaseline) {
    add(
      "error",
      "released-baseline-outside-candidate",
      relative(file),
      `Released Baseline is only valid for Status: Candidate; found Status: ${status ?? "missing"}.`,
    );
  }
}
let candidateReleasedBaseline: string | null = null;
if (candidateDocuments.length > 0) {
  if (candidateDocuments.length !== canonicalDocumentStates.length) {
    for (const { file, status } of canonicalDocumentStates) {
      add(
        "error",
        "candidate-status-mismatch",
        relative(file),
        `Status: ${status ?? "missing"}; all canonical documents must be Candidate together.`,
      );
    }
  }
  const baselines = new Set(
    candidateDocuments
      .map(({ releasedBaseline }) => releasedBaseline)
      .filter((value): value is string => typeof value === "string"),
  );
  if (
    baselines.size !== 1 ||
    candidateDocuments.some(({ releasedBaseline }) => !releasedBaseline)
  ) {
    for (const { file, releasedBaseline } of candidateDocuments) {
      add(
        "error",
        "candidate-released-baseline-mismatch",
        relative(file),
        `Released Baseline: ${releasedBaseline ?? "missing"}; found ${JSON.stringify([...baselines].sort())}`,
      );
    }
  } else {
    const [releasedBaseline] = baselines;
    if (releasedBaseline === undefined) {
      throw new Error("candidate_released_baseline_missing");
    }
    candidateReleasedBaseline = releasedBaseline;
    if (versions.has(releasedBaseline)) {
      for (const { file } of candidateDocuments) {
        add(
          "error",
          "candidate-version-equals-released-baseline",
          relative(file),
          `Candidate Version and Released Baseline must differ: ${candidateReleasedBaseline}.`,
        );
      }
    }
  }
}

const stableDocuments = canonicalDocumentStates.filter(
  ({ status }) => status === "Stable",
);
function candidateVersionFromHeader(header: string): string | null {
  return (
    header.match(/^Status: Candidate \((v[^,、)\s]+)/mu)?.[1] ??
    header.match(/^状態: Candidate（(v[^,、）\s]+)/mu)?.[1] ??
    header.match(/^Version: \*\*(v[^*\s]+) Candidate\*\*$/mu)?.[1] ??
    null
  );
}
if (
  repositoryMode === "official" &&
  scopeValues.length === 0 &&
  canonicalDocumentStates.length > 1 &&
  stableDocuments.length > 0 &&
  new Set(stableDocuments.map(({ version }) => version)).size === 1 &&
  stableDocuments.every(({ version }) => version !== null) &&
  versions.size === 1
) {
  const stableVersion = [...versions][0];
  if (stableVersion === undefined) {
    throw new Error("stable_release_version_missing");
  }
  for (const document of canonicalDocumentStates) {
    if (document.status === "Stable" && document.version === stableVersion) {
      continue;
    }
    add(
      "error",
      "stable-release-canonical-status-mismatch",
      relative(document.file),
      `Every canonical document must be Version: ${stableVersion} and Status: Stable for the final release candidate.`,
    );
  }

  const stableTagCommit = resolveRevisionIdentity(
    root,
    `refs/tags/${stableVersion}^{commit}`,
  );
  const currentHeadCommit = resolveRevisionIdentity(root, "HEAD");
  const hasDifferentCandidateVersion = allMarkdownFiles.some((file) => {
    const header = read(file).split(/\r?\n/u).slice(0, 16).join("\n");
    const candidateVersion = candidateVersionFromHeader(header);
    return candidateVersion !== null && candidateVersion !== stableVersion;
  });
  if (
    !hasDifferentCandidateVersion &&
    stableTagCommit !== null &&
    currentHeadCommit !== null &&
    stableTagCommit !== currentHeadCommit
  ) {
    add(
      "error",
      "stable-release-tag-identity-mismatch",
      relative(path.join(root, ".git")),
      `Official ${stableVersion} tag must resolve to the checked HEAD commit.`,
    );
  }
  const readmePath = path.join(root, "README.md");
  const readme = lstatIfPresent(readmePath)?.isFile() ? read(readmePath) : "";
  if (!readme.includes(`Version: **${stableVersion}**`)) {
    add(
      "error",
      "stable-release-readme-version-mismatch",
      relative(readmePath),
      `README must expose Version: **${stableVersion}**.`,
    );
  }
  const readmeHeader = readme.split(/\r?\n/u).slice(0, 20).join("\n");
  if (/\bCandidate\b|^Released Baseline:/mu.test(readmeHeader)) {
    add(
      "error",
      "stable-release-readme-candidate-residue",
      relative(readmePath),
      "Stable release README must not retain Candidate or Released Baseline display.",
    );
  }

  const changelogPath = path.join(root, "CHANGELOG.md");
  const changelog = lstatIfPresent(changelogPath)?.isFile()
    ? read(changelogPath)
    : "";
  const escapedStableVersion = stableVersion.replace(
    /[.*+?^${}()|[\]\\]/gu,
    "\\$&",
  );
  const releaseHeadingMatches = [
    ...changelog.matchAll(
      new RegExp(
        `^### ${escapedStableVersion} — (\\d{4}-\\d{2}-\\d{2})$`,
        "gmu",
      ),
    ),
  ];
  const releaseDates = new Set(
    releaseHeadingMatches.map((match) => match[1]).filter(Boolean),
  );
  if (releaseHeadingMatches.length !== 2 || releaseDates.size !== 1) {
    add(
      "error",
      "stable-release-changelog-bilingual-closure-mismatch",
      relative(changelogPath),
      `Expected exactly two dated ${stableVersion} release headings with one shared date; found ${releaseHeadingMatches.length} headings and ${releaseDates.size} dates.`,
    );
  }

  for (const file of allMarkdownFiles) {
    const header = read(file).split(/\r?\n/u).slice(0, 16).join("\n");
    if (candidateVersionFromHeader(header) === stableVersion) {
      add(
        "error",
        "stable-release-candidate-residue",
        relative(file),
        `Current Markdown entry point still exposes ${stableVersion} as Candidate.`,
      );
    }
    const isChangeTraceForStableRelease =
      /^99_Roadmap\/Changes\/CHG-[0-9]{6}\/change\.md$/u.test(relative(file));
    if (!isChangeTraceForStableRelease) continue;
    if (!header.includes(`対象版: \`${stableVersion}\``)) continue;
    const isReadyForRelease = /^状態: `Ready for Release Handoff`$/mu.test(
      header,
    );
    const released = /^状態: `Released`$/mu.test(header);
    if (!isReadyForRelease && !released) {
      add(
        "error",
        "stable-release-change-trace-not-ready",
        relative(file),
        `Change trace for ${stableVersion} must be Ready for Release Handoff or Released before integration and tagging.`,
      );
    }
    if (released && stableTagCommit === null) {
      add(
        "error",
        "stable-release-change-trace-premature-release",
        relative(file),
        `Change trace for ${stableVersion} must not claim Released before the official tag exists.`,
      );
    }
  }
}
function parseMarkdownStructure(lines: readonly string[]) {
  const entries: MarkdownEntry[] = [];
  const fences: MarkdownFence[] = [];
  let activeFence: MarkdownFence | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (activeFence) {
      const closing = line.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/u);
      if (
        closing &&
        closing[1][0] === activeFence.marker &&
        closing[1].length >= activeFence.length
      ) {
        entries.push({
          index,
          text: line,
          outside: false,
          fenceId: activeFence.id,
        });
        activeFence.end = index;
        activeFence.closed = true;
        activeFence = null;
      } else {
        const entry = {
          index,
          text: line,
          outside: false,
          fenceId: activeFence.id,
        };
        entries.push(entry);
        activeFence.contents.push(entry);
      }
      continue;
    }
    const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/u);
    const isValidOpening =
      opening && !(opening[1][0] === "`" && opening[2].includes("`"));
    if (!isValidOpening) {
      entries.push({ index, text: line, outside: true, fenceId: null });
      continue;
    }
    const fence: MarkdownFence = {
      id: fences.length,
      marker: opening[1][0],
      length: opening[1].length,
      language: opening[2].trim().split(/\s+/u)[0].toLowerCase(),
      start: index,
      end: null,
      closed: false,
      contents: [],
    };
    fences.push(fence);
    activeFence = fence;
    entries.push({ index, text: line, outside: false, fenceId: fence.id });
  }
  return { entries, fences };
}

function checkDiscoveryIdentityLinkOwnership(): void {
  for (const file of allMarkdownFiles) {
    const relativePath = relative(file);
    if (
      relativePath.startsWith("99_Roadmap/Changes/") ||
      relativePath.includes("/Evidence/")
    )
      continue;
    const markdown = parseMarkdownStructure(
      read(file)
        .replace(/^\uFEFF/u, "")
        .split(/\r?\n/u),
    );
    for (const entry of markdown.entries) {
      if (!entry.outside) continue;
      for (const match of entry.text.matchAll(
        /\[`?(REQ-[0-9]{6})`?\]\(([^)]+)\)/gu,
      )) {
        const target = match[2].replaceAll("\\", "/");
        if (!target.includes("01_Discovery/Analysis/EXP-")) continue;
        add(
          "error",
          "discovery-identity-link-owner-mismatch",
          relativePath,
          `${match[1]} must link to its Discovery definition, not an EXP analysis.`,
        );
      }
    }
  }
}

checkDiscoveryIdentityLinkOwnership();

function parseReadmeVersion(content: string): string | null {
  const markdown = parseMarkdownStructure(
    content.replace(/^\uFEFF/u, "").split(/\r?\n/u),
  );
  let hasTitle = false;
  for (const entry of markdown.entries) {
    if (!entry.outside) continue;
    const line = entry.text;
    if (line.trim() === "" || /^<a id="[^"]+"><\/a>$/u.test(line)) continue;
    if (!hasTitle && /^#\s+\S/u.test(line)) {
      hasTitle = true;
      continue;
    }
    if (/^\*\*[^*]+\*\*[ \t]*$/u.test(line)) continue;
    const match = line.match(
      /^(?:Version|Status):[ \t]*(?:\*\*(v[0-9][^\s*]*)(?:[ \t]+[^*]*)?\*\*|(v[0-9][^\s*]*)(?:[ \t]+[^*]*)?)[ \t]*$/u,
    );
    return match?.[1] ?? match?.[2] ?? null;
  }
  return null;
}

const readme = path.join(root, "README.md");
if (
  lstatIfPresent(readme)?.isFile() &&
  !pathContainsSymbolicLink(readme) &&
  versions.size === 1 &&
  repositoryMode === "official"
) {
  const readmeVersion = parseReadmeVersion(read(readme));
  const expectedVersion = versions.values().next().value;
  if (readmeVersion && readmeVersion !== expectedVersion) {
    add(
      "error",
      "readme-version-mismatch",
      "README.md",
      `README=${readmeVersion}, canonical=${expectedVersion}`,
    );
  }
}

const changelog = path.join(root, "CHANGELOG.md");
if (
  lstatIfPresent(changelog)?.isFile() &&
  !pathContainsSymbolicLink(changelog) &&
  versions.size === 1 &&
  repositoryMode === "official"
) {
  const currentVersion = candidateReleasedBaseline ?? [...versions][0];
  const lines = read(changelog).split(/\r?\n/u);
  // Parse isFenced code once so headings, declarations, and migration-note
  // categories all use the same Markdown structure boundary. Only fence-free
  // lines and data inside a closed yaml/yml fence can be semantic inputs.
  const markdown = parseMarkdownStructure(lines);
  const outsideEntries = markdown.entries.filter((entry) => entry.outside);
  const releaseSections = (
    languageHeading: string,
  ): Readonly<{
    languageCount: number;
    releases: ReleaseSection[];
  }> => {
    const languageStarts = outsideEntries.filter(
      (entry) => entry.text === `## ${languageHeading}`,
    );
    if (languageStarts.length !== 1) {
      return { languageCount: languageStarts.length, releases: [] };
    }
    const languageStart = languageStarts[0].index;
    let languageEnd = lines.length;
    for (const entry of outsideEntries) {
      if (entry.index > languageStart && /^##\s+/u.test(entry.text)) {
        languageEnd = entry.index;
        break;
      }
    }
    const starts = outsideEntries
      .filter(
        (entry) =>
          entry.index > languageStart &&
          entry.index < languageEnd &&
          entry.text.startsWith(`### ${currentVersion} `),
      )
      .map((entry) => entry.index);
    const releases = starts.map((releaseStart) => {
      let releaseEnd = languageEnd;
      for (const entry of outsideEntries) {
        if (
          entry.index > releaseStart &&
          entry.index < languageEnd &&
          /^###\s+/u.test(entry.text)
        ) {
          releaseEnd = entry.index;
          break;
        }
      }
      return {
        start: releaseStart,
        end: releaseEnd,
        entries: markdown.entries.filter(
          (entry) => entry.index >= releaseStart && entry.index < releaseEnd,
        ),
      };
    });
    return { languageCount: 1, releases };
  };
  // Only a complete bullet inline-code declaration or a key inside a closed
  // yaml/yml fence is data. Prose, block quotes, other fences, and prior
  // release sections are intentionally not declarations.
  const declarations = (
    section: ReleaseSection,
    key: string,
    validValues: readonly string[],
  ):
    | Readonly<{ valid: false; reason: string }>
    | Readonly<{ valid: true; value: string }> => {
    const attempts: string[] = [];
    for (const entry of section.entries.filter(
      (candidate) => candidate.outside,
    )) {
      const match = entry.text.match(
        new RegExp(`^\\s*[-*+]\\s+\`${key}:\\s*([^\`]*)\`\\s*$`, "u"),
      );
      if (match) attempts.push(match[1].trim());
    }
    const yamlFences = markdown.fences.filter(
      (fence) =>
        fence.start >= section.start &&
        fence.start < section.end &&
        ["yaml", "yml"].includes(fence.language),
    );
    if (yamlFences.some((fence) => !fence.closed)) {
      return { valid: false, reason: "unclosed-yaml-fence" };
    }
    for (const fence of yamlFences) {
      for (const entry of fence.contents) {
        const match = entry.text.match(
          new RegExp(`^\\s*${key}:\\s*([^#\\s]+)\\s*(?:#.*)?$`, "u"),
        );
        if (match) attempts.push(match[1].trim());
      }
    }
    if (attempts.length !== 1 || !validValues.includes(attempts[0])) {
      return {
        valid: false,
        reason: attempts.length === 0 ? "missing" : "invalid-or-multiple",
      };
    }
    return { valid: true, value: attempts[0] };
  };
  const requiredMigrationMarkers: Readonly<
    Record<string, readonly (readonly [RegExp, string])[]>
  > = {
    English: [
      [/^\s*[-*+]\s+Required(?:\s+for\s+[^:]+)?:/u, "Required"],
      [/^\s*[-*+]\s+Conditional(?:\s+[^:]+)?:/u, "Conditional"],
      [/^\s*[-*+]\s+Not required(?: for adopting projects)?:/u, "Not required"],
      [/^\s*[-*+]\s+Rollback \/ recovery:/u, "Rollback / recovery"],
      [/^\s*[-*+]\s+Known risk if deferred:/u, "Known risk if deferred"],
      [/^\s*[-*+]\s+Verification:/u, "Verification"],
      [/^\s*[-*+]\s+Known limitation:/u, "Known limitation"],
    ],
    日本語: [
      [/^\s*[-*+]\s+(?:[^:]+で)?必須:/u, "必須"],
      [/^\s*[-*+]\s+条件付き(?:[^:]*)?:/u, "条件付き"],
      [/^\s*[-*+]\s+(?:不要|採用プロジェクトでは不要):/u, "不要"],
      [/^\s*[-*+]\s+(?:復旧|切戻し／復旧):/u, "復旧"],
      [/^\s*[-*+]\s+延期時の既知リスク:/u, "延期時の既知リスク"],
      [/^\s*[-*+]\s+検証:/u, "検証"],
      [/^\s*[-*+]\s+既知の(?:制限|限界):/u, "既知の制限"],
    ],
  };
  const sections: Record<string, ReleaseSection> = {};
  for (const languageHeading of Object.keys(requiredMigrationMarkers)) {
    const located = releaseSections(languageHeading);
    if (located.languageCount !== 1) {
      add(
        "error",
        "current-changelog-release-missing",
        "CHANGELOG.md",
        `${languageHeading}: expected exactly one language section; found ${located.languageCount}.`,
      );
      continue;
    }
    if (located.releases.length !== 1) {
      add(
        "error",
        "current-changelog-release-missing",
        "CHANGELOG.md",
        `${languageHeading}: expected exactly one ${currentVersion} release section; found ${located.releases.length}.`,
      );
      continue;
    }
    sections[languageHeading] = located.releases[0];
  }
  const migration: Record<string, string> = {};
  for (const [languageHeading, section] of Object.entries(sections)) {
    const parsed = declarations(section, "migration_required", [
      "true",
      "false",
    ]);
    if (!parsed.valid) {
      add(
        "error",
        "migration-status-undetermined",
        "CHANGELOG.md",
        `${languageHeading}: ${currentVersion} migration_required is ${parsed.reason}.`,
      );
      continue;
    }
    migration[languageHeading] = parsed.value;
  }
  if (
    Object.keys(migration).length === 2 &&
    migration.English !== migration.日本語
  ) {
    add(
      "error",
      "migration-status-mismatch",
      "CHANGELOG.md",
      `English=${migration.English}, 日本語=${migration.日本語}.`,
    );
  } else if (migration.English === "true" && migration.日本語 === "true") {
    const classifications: Record<string, string> = {};
    for (const [languageHeading, section] of Object.entries(sections)) {
      const parsed = declarations(section, "change_classification", [
        "editorial",
        "clarification",
        "additive",
        "normative",
        "breaking",
      ]);
      if (!parsed.valid) {
        add(
          "error",
          "migration-status-undetermined",
          "CHANGELOG.md",
          `${languageHeading}: ${currentVersion} change_classification is ${parsed.reason}.`,
        );
        continue;
      }
      classifications[languageHeading] = parsed.value;
    }
    if (
      Object.keys(classifications).length === 2 &&
      classifications.English !== classifications.日本語
    ) {
      add(
        "error",
        "migration-status-mismatch",
        "CHANGELOG.md",
        `English classification=${classifications.English}, 日本語 classification=${classifications.日本語}.`,
      );
    }
    for (const [languageHeading, markers] of Object.entries(
      requiredMigrationMarkers,
    )) {
      const section = sections[languageHeading];
      const sectionLines = section.entries
        .filter((entry) => entry.outside)
        .map((entry) => entry.text);
      const missingMarkers = markers
        .filter(
          ([pattern]) =>
            !sectionLines.some((line) => {
              const match = line.match(pattern);
              return Boolean(match && line.slice(match[0].length).trim());
            }),
        )
        .map(([, label]) => label);
      if (missingMarkers.length === 0) continue;
      add(
        "error",
        "migration-note-incomplete",
        "CHANGELOG.md",
        `${languageHeading}: ${currentVersion} migration note is missing ${missingMarkers.join(", ")}.`,
      );
    }
  }
}

let relatedBlocks = 0;
for (const file of markdownFiles) {
  const lines = read(file).split(/\r?\n/u);
  const related = lines.indexOf("Related:");
  if (related < 0) continue;
  relatedBlocks += 1;
  const numbers = [];
  for (const line of lines.slice(related + 1)) {
    if (!line.startsWith("- ")) break;
    const match = line.match(
      /^-\s+\[[^\]]+\]\((\d{2})_[^)]+\.md(?:#[^)]+)?\)\s*$/u,
    );
    if (match) numbers.push(Number(match[1]));
  }
  const sortedNumbers = [...numbers].sort((a, b) => a - b);
  if (numbers.some((value, index) => value !== sortedNumbers[index])) {
    add(
      "warning",
      "related-order",
      relative(file),
      `${JSON.stringify(numbers)} is not ascending`,
    );
  }
}

const STABLE_ID_PATTERN = /\b(?:REQ|UX|IA|UI|SPEC)-\d{6}\b/gu;
const MANUAL_STABLE_ID_REVISION_PATTERN =
  /\b(?:REQ|UX|IA|UI|SPEC)-\d{6}@\d+\b/gu;
const stableIdOccurrences = new Map();
const stableIdDefinitions = new Map();
for (const file of allMarkdownFiles) {
  const text = read(file);
  for (const match of text.matchAll(STABLE_ID_PATTERN)) {
    const items = stableIdOccurrences.get(match[0]) ?? [];
    items.push(relative(file));
    stableIdOccurrences.set(match[0], items);
  }
  if (
    repositoryMode === "adopter" &&
    isWithin(path.join(root, "00_CRDD"), file)
  ) {
    continue;
  }
  const meaningfulText = withoutFencedCode(text);
  for (const match of meaningfulText.matchAll(
    MANUAL_STABLE_ID_REVISION_PATTERN,
  )) {
    add(
      "error",
      "stable-id-manual-revision",
      relative(file),
      `${match[0]}: keep the stable ID unchanged and identify the content state with an artifact revision, Change Trace, or superseding ID.`,
    );
  }
  const definitionLines = meaningfulText.split(/\r?\n/u);
  for (let lineIndex = 0; lineIndex < definitionLines.length; lineIndex += 1) {
    const line = definitionLines[lineIndex];
    const match =
      line.match(
        /^\s*(?:id|context_id):\s*((?:REQ|UX|IA|UI|SPEC)-\d{6})\s*$/u,
      ) ?? line.match(/^#{1,6}\s+((?:REQ|UX|IA|UI|SPEC)-\d{6})(?:\s|$)/u);
    if (!match) continue;
    const definitions = stableIdDefinitions.get(match[1]) ?? [];
    definitions.push(`${relative(file)}:${lineIndex + 1}`);
    stableIdDefinitions.set(match[1], definitions);
  }
  if (relative(file) === "02_UX/01_User_Experience.md") {
    for (
      let lineIndex = 0;
      lineIndex < definitionLines.length;
      lineIndex += 1
    ) {
      const match = definitionLines[lineIndex].match(
        /^\| `(UX-[0-9]{6})`\s+[^|]+\|/u,
      );
      if (!match) continue;
      const definitions = stableIdDefinitions.get(match[1]) ?? [];
      definitions.push(`${relative(file)}:${lineIndex + 1}`);
      stableIdDefinitions.set(match[1], definitions);
    }
  }
}
for (const [stableId, definitions] of stableIdDefinitions) {
  if (definitions.length > 1) {
    add(
      "error",
      "duplicate-stable-id-definition",
      definitions.join(", "),
      stableId,
    );
  }
}

let numericRowsChecked = 0;
for (const file of allMarkdownFiles) {
  const lines = withoutFencedCode(read(file)).split(/\r?\n/u);
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = markdownTableCells(lines[index]);
    if (!headers) continue;
    const numeratorIndex = headers.findIndex((header) =>
      ["到達分岐数（分子）", "Covered Branches (Numerator)"].includes(header),
    );
    const denominatorIndex = headers.findIndex((header) =>
      ["対象分岐数（分母）", "Total Branches (Denominator)"].includes(header),
    );
    const percentageIndex = headers.findIndex((header) =>
      ["実測率", "Measured Rate"].includes(header),
    );
    if (
      numeratorIndex < 0 ||
      denominatorIndex < 0 ||
      percentageIndex < 0 ||
      !markdownTableSeparator(lines[index + 1], headers.length)
    ) {
      continue;
    }
    for (let row = index + 2; row < lines.length; row += 1) {
      const cells = markdownTableCells(lines[row]);
      if (!cells) break;
      const values = [
        cells[numeratorIndex] ?? "",
        cells[denominatorIndex] ?? "",
        cells[percentageIndex] ?? "",
      ].map((value) => value.trim());
      if (values.every((value) => value === "")) continue;
      const marker =
        /^(?:N\/A|TBD|Not Applicable|Not Measured|対象外|未測定)$/iu;
      if (values.filter(Boolean).every((value) => marker.test(value))) {
        continue;
      }
      const countPattern = /^-?\d+(?:,\d{3})*$/u;
      const percentagePattern = /^-?\d+(?:\.\d+)?%?$/u;
      if (
        !countPattern.test(values[0]) ||
        !countPattern.test(values[1]) ||
        !percentagePattern.test(values[2])
      ) {
        add(
          "error",
          "branch-coverage-value",
          relative(file),
          `line ${row + 1}: numerator, denominator, and percentage must all be numeric when measurement values are present.`,
        );
        continue;
      }
      const numerator = Number(values[0].replaceAll(",", ""));
      const denominator = Number(values[1].replaceAll(",", ""));
      const percentage = Number(
        values[2].replaceAll(",", "").replace(/%$/u, ""),
      );
      numericRowsChecked += 1;
      if (
        !Number.isInteger(numerator) ||
        !Number.isInteger(denominator) ||
        numerator < 0 ||
        denominator <= 0 ||
        percentage < 0 ||
        percentage > 100
      ) {
        add(
          "error",
          "branch-coverage-range",
          relative(file),
          `line ${row + 1}: counts must be non-negative integers, denominator must be greater than zero, and percentage must be 0-100.`,
        );
        continue;
      }
      if (numerator > denominator) {
        add(
          "error",
          "branch-coverage-count",
          relative(file),
          `line ${row + 1}: numerator ${numerator} exceeds denominator ${denominator}.`,
        );
      }
      const expected = (numerator / denominator) * 100;
      if (Math.abs(expected - percentage) > 0.11) {
        add(
          "error",
          "branch-coverage-percentage",
          relative(file),
          `line ${row + 1}: ${numerator}/${denominator} is ${expected.toFixed(2)}%, not ${percentage}%.`,
        );
      }
    }
  }
}

const remediationHeaderAliases = {
  progress: ["処置進捗", "Remediation Progress"],
  blocker: ["阻害状態", "Remediation Blocker State", "Blocker State"],
  resolution: ["解消判定", "Remediation Resolution Verdict", "Resolution"],
  acceptance: ["受入条件", "Acceptance"],
  oracle: ["判定方法", "Oracle"],
  evidence: ["根拠", "Evidence"],
  review: ["独立再レビュー", "Independent Review"],
  current: ["現在状態への反映", "Current Projection"],
  blockerReason: ["阻害理由", "Blocker Reason"],
  requiredInput: ["必要事項", "Required Input"],
  owner: ["担当責任者", "Owner"],
  restart: ["再開条件", "Restart Condition"],
};
type RemediationColumn = keyof typeof remediationHeaderAliases;
const REMEDIATION_PLACEHOLDER =
  /^(?:|[-—–]|N\/A|TBD|TODO|None|なし|未定|未取得|未確認|対象外)$/iu;
let remediationRowsChecked = 0;
for (const file of allMarkdownFiles) {
  const lines = withoutFencedCode(read(file)).split(/\r?\n/u);
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = markdownTableCells(lines[index]);
    if (!headers) continue;
    const column = (name: RemediationColumn): number =>
      headers.findIndex((header) =>
        remediationHeaderAliases[name].includes(header),
      );
    const progressIndex = column("progress");
    const blockerIndex = column("blocker");
    const resolutionIndex = column("resolution");
    const stateColumnIndexes = [progressIndex, blockerIndex, resolutionIndex];
    const stateColumnCount = stateColumnIndexes.filter(
      (target) => target >= 0,
    ).length;
    let precedingHeading = "";
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (/^\s*#{1,6}\s+/u.test(lines[previous])) {
        precedingHeading = lines[previous];
        break;
      }
    }
    const hasExplicitRemediationContext =
      /(?:是正|remediation)/iu.test(precedingHeading) ||
      headers.some((header) =>
        ["是正対象", "Remediation Target"].includes(header),
      );
    if (
      (stateColumnCount !== 3 &&
        !(stateColumnCount >= 1 && hasExplicitRemediationContext)) ||
      !markdownTableSeparator(lines[index + 1], headers.length)
    ) {
      continue;
    }
    const stateColumns: Array<readonly [RemediationColumn, number]> = [
      ["progress", progressIndex],
      ["blocker", blockerIndex],
      ["resolution", resolutionIndex],
    ];
    const missingStateColumns = stateColumns.filter(([, target]) => target < 0);
    if (missingStateColumns.length > 0) {
      add(
        "error",
        "remediation-state-columns-missing",
        relative(file),
        `line ${index + 1}: missing ${missingStateColumns.map(([name]) => remediationHeaderAliases[name][0]).join(", ")}.`,
      );
    }
    const optionalColumns = new Map<RemediationColumn, number>();
    for (const name of Object.keys(remediationHeaderAliases)) {
      if (name in remediationHeaderAliases) {
        const knownName =
          name === "progress" ||
          name === "blocker" ||
          name === "resolution" ||
          name === "acceptance" ||
          name === "oracle" ||
          name === "evidence" ||
          name === "review" ||
          name === "current" ||
          name === "blockerReason" ||
          name === "requiredInput" ||
          name === "owner" ||
          name === "restart"
            ? name
            : null;
        if (knownName !== null)
          optionalColumns.set(knownName, column(knownName));
      }
    }
    for (let row = index + 2; row < lines.length; row += 1) {
      const cells = markdownTableCells(lines[row]);
      if (!cells) break;
      if (cells.every((cell) => cell === "")) continue;
      remediationRowsChecked += 1;
      const progress = progressIndex >= 0 ? (cells[progressIndex] ?? "") : "";
      const blocker = blockerIndex >= 0 ? (cells[blockerIndex] ?? "") : "";
      const resolution =
        resolutionIndex >= 0 ? (cells[resolutionIndex] ?? "") : "";
      const location = `line ${row + 1}`;
      if (/^fixed$/iu.test(progress) || /^fixed$/iu.test(resolution)) {
        add(
          "error",
          "ambiguous-remediation-state",
          relative(file),
          `${location}: fixed must not be used as a remediation progress or resolution value.`,
        );
      }
      if (
        progressIndex >= 0 &&
        !["Identified", "Planned", "Applied", "Self-checked"].includes(progress)
      ) {
        add(
          "error",
          "remediation-progress-value",
          relative(file),
          `${location}: remediation progress must be Identified, Planned, Applied, or Self-checked.`,
        );
      }
      if (blockerIndex >= 0 && !["None", "Blocked"].includes(blocker)) {
        add(
          "error",
          "remediation-blocker-value",
          relative(file),
          `${location}: blocker state must be None or Blocked.`,
        );
      }
      if (resolutionIndex >= 0 && !["Open", "Resolved"].includes(resolution)) {
        add(
          "error",
          "remediation-resolution-value",
          relative(file),
          `${location}: resolution must be Open or Resolved.`,
        );
      }
      const requireValues = (
        names: readonly RemediationColumn[],
        code: string,
        shouldRequireValues: boolean,
      ): void => {
        if (!shouldRequireValues) return;
        const missingNames = names.filter((name) => {
          const targetIndex = optionalColumns.get(name) ?? -1;
          return (
            targetIndex < 0 ||
            REMEDIATION_PLACEHOLDER.test(cells[targetIndex] ?? "")
          );
        });
        if (missingNames.length > 0) {
          add(
            "error",
            code,
            relative(file),
            `${location}: missing ${missingNames.map((name) => remediationHeaderAliases[name][0]).join(", ")}.`,
          );
        }
      };
      requireValues(
        ["acceptance", "oracle", "evidence", "review", "current"],
        "premature-remediation-resolution",
        resolution === "Resolved",
      );
      if (
        resolution === "Resolved" &&
        (progress !== "Self-checked" || blocker !== "None")
      ) {
        add(
          "error",
          "inconsistent-remediation-state",
          relative(file),
          `${location}: Resolved requires Self-checked progress and a None blocker state.`,
        );
      }
      requireValues(
        ["blockerReason", "requiredInput", "owner", "restart"],
        "incomplete-remediation-blocker",
        blocker === "Blocked",
      );
    }
  }
}

for (const file of allFiles) {
  const stableId = path.basename(file).match(STABLE_ID_PATTERN)?.[0];
  if (stableId) {
    add(
      "error",
      "stable-id-in-filename",
      relative(file),
      `${stableId}: use the ID inside the owning artifact, not as a filename.`,
    );
  }
  if (/^CHG-[^.]+\.md$/u.test(path.basename(file))) {
    add(
      "error",
      "legacy-change-trace-layout",
      relative(file),
      "Flat CHG Markdown files are not canonical. Use 99_Roadmap/Changes/<CHG-ID>/change.md.",
    );
  }
  if (path.basename(file) === "change.md") {
    if (isEvidenceFile(file)) {
      if (hasChangeTraceDefinitionSignature(file)) {
        add(
          "error",
          "change-trace-placement",
          relative(file),
          "A file under Evidence contains a Change Trace header. " +
            "Move the Change Trace definition into its owning Changes tree, " +
            "or remove the Change Trace header from supporting evidence.",
        );
      }
      continue;
    }
    const aggregateRoot = changeTraceRootFor(file);
    if (!aggregateRoot) {
      add(
        "error",
        "change-trace-placement",
        relative(file),
        `The checker cannot recognize this Change Trace path in repository mode ${repositoryMode}. ` +
          `Recognized inspection paths: ${recognizedChangeTracePatterns.join(", ")}.`,
      );
      continue;
    }
    const aggregateId = path
      .basename(aggregateRoot)
      .match(/^CHG-(?:[0-9]{6}|XXXXXX)/u)?.[0];
    const declaredId = declaredChangeTraceId(file);
    if (!aggregateId || !declaredId || aggregateId !== declaredId) {
      add(
        "error",
        "change-trace-aggregate-identity-mismatch",
        relative(file),
        "The aggregate directory ID and the Change ID declared by change.md must match exactly.",
      );
    }
  }
  if (isEvidenceFile(file) && isWithin(path.join(root, "99_Roadmap"), file)) {
    const evidenceName = path.basename(file);
    if (
      !/^\d{6}(?:-\d{4})?_[a-z0-9]+(?:-[a-z0-9]+)*(?:-\d{2})?\.(?:md|json|tap|txt|log)$/u.test(
        evidenceName,
      )
    ) {
      add(
        "error",
        "noncanonical-evidence-filename",
        relative(file),
        "Evidence filenames must use YYMMDD[-HHmm]_<type> with a collision suffix only when needed.",
      );
    }
  }
}

const requestedStructureRoot =
  repositoryMode === "adopter"
    ? root
    : repositoryMode === "official"
      ? path.join(root, "template")
      : null;
let structureRoot = null;
if (requestedStructureRoot) {
  const requestedStructureRootStat = lstatIfPresent(requestedStructureRoot);
  if (pathContainsSymbolicLink(requestedStructureRoot)) {
    add(
      "error",
      "symbolic-structure-root",
      relative(requestedStructureRoot),
      "The CRDD structure root must not be a symbolic link or junction.",
    );
  } else if (!requestedStructureRootStat) {
    add(
      "error",
      "missing-structure-root",
      relative(requestedStructureRoot),
      "The CRDD structure root does not exist.",
    );
  } else if (!requestedStructureRootStat.isDirectory()) {
    add(
      "error",
      "invalid-structure-root",
      relative(requestedStructureRoot),
      "The CRDD structure root must be a directory.",
    );
  } else {
    structureRoot = requestedStructureRoot;
  }
}
if (structureRoot) {
  const requiredFolders = [
    "00_CRDD",
    "01_Discovery",
    "02_UX",
    "03_IA",
    "04_UI",
    "05_SPEC",
    "06_Architecture",
    "07_Quality",
    "19_Workflows",
    "40_Develop",
    "99_Roadmap",
  ];
  for (const name of requiredFolders) {
    const requiredPath = path.join(structureRoot, name);
    const requiredStat = lstatIfPresent(requiredPath);
    if (pathContainsSymbolicLink(requiredPath)) {
      add(
        "error",
        "symbolic-structure-entry",
        relative(requiredPath),
        "CRDD structure entries must not be symbolic links or junctions.",
      );
    } else if (!requiredStat) {
      if (gitlinkRootFor(requiredPath) === requiredPath) {
        uncheckedItems.add(
          `Required structure entry is an uninitialized Gitlink submodule: ${relative(requiredPath)}`,
        );
        continue;
      }
      add("error", "missing-crdd-folder", relative(structureRoot), name);
    } else if (!requiredStat.isDirectory()) {
      add(
        "error",
        "invalid-structure-entry",
        relative(requiredPath),
        "CRDD structure entries must be directories.",
      );
    }
  }
  for (const name of [
    "07_Workflows",
    "08_Workflows",
    "08_Quality",
    "90_Release",
  ]) {
    if (lstatIfPresent(path.join(structureRoot, name))) {
      add("error", "legacy-crdd-folder", relative(structureRoot), name);
    }
  }
  for (const entry of fs.readdirSync(structureRoot)) {
    const match = entry.match(/^(\d{2})_/u);
    const number = match ? Number(match[1]) : -1;
    if (number >= 8 && number <= 18) {
      add(
        repositoryMode === "official" ? "error" : "warning",
        "reserved-crdd-folder",
        relative(path.join(structureRoot, entry)),
        repositoryMode === "official"
          ? "08-18 are reserved by the CRDD standard template."
          : "08-18 are reserved for future CRDD use. Confirm that this is an explicit project-specific extension with documented responsibility and migration handling.",
      );
    }
  }
  const develop = path.join(structureRoot, "40_Develop");
  for (const file of allFiles.filter(
    (item) => isWithin(develop, item) && item.toLowerCase().endsWith(".md"),
  )) {
    add(
      "warning",
      "develop-markdown",
      relative(file),
      "Confirm this is implementation-local documentation, not CRDD management Markdown.",
    );
  }
}

for (const name of ["Evidence", "Decision", "Decisions"]) {
  if (lstatIfPresent(path.join(root, name))) {
    add("error", "central-root-folder", name, "Use the nearest owner.");
  }
}

findings.sort(
  (a, b) =>
    a.severity.localeCompare(b.severity) ||
    a.code.localeCompare(b.code) ||
    a.path.localeCompare(b.path) ||
    a.message.localeCompare(b.message),
);

let referenceMap: Readonly<{
  target: string;
  inbound: ReadonlyArray<
    Readonly<{
      source: string;
      count: number;
      links: string[];
    }>
  >;
  outbound: ReadonlyArray<
    Readonly<{
      target: string;
      anchor: string | null;
      count: number;
    }>
  >;
}> | null = null;
if (referencesValue) {
  const referenceTarget = path.resolve(root, referencesValue);
  if (!isWithin(root, referenceTarget)) {
    cliError("--references must stay under the target root.");
  }
  if (pathContainsSymbolicLink(referenceTarget)) {
    cliError(
      `--references must not traverse a symbolic link: ${relative(referenceTarget)}`,
    );
  }
  const referenceGitlink = gitlinkRootFor(referenceTarget);
  const referenceIsInAdoptedBaseline =
    referenceGitlink &&
    discovery.baseline_submodule &&
    adoptedBaselineRoot &&
    samePath(referenceGitlink, adoptedBaselineRoot);
  if (referenceGitlink && !referenceIsInAdoptedBaseline) {
    cliError(
      `--references points into a Gitlink submodule. Run the checker with --root ${relative(referenceGitlink)} after initializing that submodule.`,
    );
  }
  if (!fs.existsSync(referenceTarget)) {
    cliError(`--references does not exist: ${referencesValue}`);
  }
  const referenceStat = fs.statSync(referenceTarget);
  if (!referenceStat.isFile() && !referenceStat.isDirectory()) {
    cliError(`--references is not a file or directory: ${referencesValue}`);
  }
  const referenceIsInBaselineSubmodule =
    discovery.baseline_submodule &&
    adoptedBaselineRoot &&
    isWithin(adoptedBaselineRoot, referenceTarget);
  if (referenceStat.isFile() && !allFileSet.has(referenceTarget)) {
    if (!referenceIsInBaselineSubmodule) {
      cliError(
        `--references is outside the project file set: ${referencesValue}`,
      );
    }
  }
  if (referenceIsInBaselineSubmodule) {
    uncheckedItems.add(
      "Outbound references inside the adopted CRDD baseline submodule",
    );
  }
  const isTargetDirectory = referenceStat.isDirectory();
  const inbound = new Map<
    string,
    {
      source: string;
      count: number;
      links: Set<string>;
    }
  >();
  const outbound = new Map<
    string,
    {
      target: string;
      anchor: string | null;
      count: number;
    }
  >();
  for (const record of linkRecords) {
    if (record.external) continue;
    if (
      record.target === referenceTarget ||
      (isTargetDirectory && isWithin(referenceTarget, record.target))
    ) {
      const source = relative(record.source);
      const item = inbound.get(source) ?? {
        source,
        count: 0,
        links: new Set(),
      };
      item.count += 1;
      item.links.add(record.raw);
      inbound.set(source, item);
    }
    if (
      record.source === referenceTarget ||
      (isTargetDirectory && isWithin(referenceTarget, record.source))
    ) {
      const target = relative(record.target);
      const key = `${target}#${record.anchor}`;
      const item = outbound.get(key) ?? {
        target,
        anchor: record.anchor || null,
        count: 0,
      };
      item.count += 1;
      outbound.set(key, item);
    }
  }
  referenceMap = {
    target: relative(referenceTarget),
    inbound: [...inbound.values()].map((item) => ({
      ...item,
      links: [...item.links],
    })),
    outbound: [...outbound.values()],
  };
}

const errors = findings.filter((item) => item.severity === "error").length;
const warnings = findings.filter((item) => item.severity === "warning").length;
const report = {
  check_mode: requestedScopes.length === 0 ? "full" : "scoped",
  repository_mode: repositoryMode,
  gitlink_detection: discovery.gitlink_detection,
  gitlink_boundaries: gitlinkRoots.map(relative),
  change_trace_layout: "hierarchy-tolerant",
  recognized_change_trace_paths: recognizedChangeTracePatterns,
  discovery_source: discovery.source,
  discovery_git_failure: discovery.git_failure,
  baseline_submodule: discovery.baseline_submodule,
  baseline_submodule_initialized: discovery.baseline_submodule_initialized,
  baseline_submodule_state: discovery.baseline_submodule_state,
  discovery_exclusions: discovery.exclusions,
  root,
  requested_scope: requestedScopes.map(relative),
  expanded_scope:
    requestedScopes.length === 0
      ? ["."]
      : markdownFiles.slice(0, 100).map(relative),
  expanded_scope_file_count: markdownFiles.length,
  expanded_scope_truncated:
    requestedScopes.length > 0 && markdownFiles.length > 100,
  global_checks: [
    "canonical document versions",
    "current bilingual release and migration-note completeness",
    "repository structure",
    "legacy and reserved folders",
    "central root folders",
    "stable ID filename prohibition",
    "manual stable ID revision prohibition",
    "explicit stable ID definition uniqueness",
    "Change Trace inspection-path recognition (not canonical placement validation)",
    "branch coverage arithmetic where numeric values are present",
    "remediation state and early-resolution fields in recognizable tables",
    "Gitlink submodule boundary recognition",
    "symbolic link and junction boundary",
  ],
  unchecked: [
    ...uncheckedItems,
    ...(requestedScopes.length === 0
      ? []
      : ["Markdown link, anchor, and Related checks outside expanded_scope"]),
  ],
  executed_at: startedAt.toISOString(),
  duration_ms: Date.now() - startedAtMs,
  metrics: {
    files_discovered: allFiles.length,
    markdown_files_discovered: allMarkdownFiles.length,
    markdown_files_checked: markdownFiles.length,
    local_links_checked: checkedLocalLinks,
    anchors_checked: checkedAnchors,
    related_blocks_checked: relatedBlocks,
    versioned_documents_checked: versionedDocuments.length,
    stable_ids_observed: stableIdOccurrences.size,
    gitlinks_observed: gitlinkRoots.length,
    explicit_stable_id_definitions: stableIdDefinitions.size,
    numeric_rows_checked: numericRowsChecked,
    remediation_rows_checked: remediationRowsChecked,
    errors,
    warnings,
  },
  findings,
  references: referenceMap,
};

if (shouldOutputJson && shouldOutputSummary) {
  console.log(JSON.stringify(report, null, 2));
} else if (shouldOutputJson) {
  console.log(JSON.stringify(findings, null, 2));
} else {
  for (const item of findings) {
    console.log(
      `${item.severity.toUpperCase().padEnd(7)} ${item.code.padEnd(28)} ${item.path}: ${item.message}`,
    );
  }
  console.log(`CRDD check: ${errors} error(s), ${warnings} warning(s)`);
  if (shouldOutputSummary) {
    console.log(
      `Mode=${report.check_mode}; Markdown=${report.metrics.markdown_files_checked}/${report.metrics.markdown_files_discovered}; local links=${checkedLocalLinks}; anchors=${checkedAnchors}; stable IDs=${report.metrics.stable_ids_observed}; ${report.duration_ms} ms`,
    );
    console.log(`Executed=${report.executed_at}`);
    console.log(
      `Repository=${report.repository_mode}; discovery=${report.discovery_source}; git_failure=${report.discovery_git_failure ?? "none"}`,
    );
    console.log(`Unchecked=${JSON.stringify(report.unchecked)}`);
    if (referenceMap) {
      console.log(JSON.stringify(referenceMap, null, 2));
    }
  }
}

process.exitCode = findings.some((item) => item.severity === "error") ? 1 : 0;
