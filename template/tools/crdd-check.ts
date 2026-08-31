#!/usr/bin/env node
/**
 * CRDDの決定論的な文書・配置確認。
 *
 * このツールは文書監査、準拠監査、不足／影響監査、専門品質確認を
 * 代替しない。人間やAIが意味を評価する前に、機械判定できる不整合を
 * 除去するための任意の補助実装である。
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

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
type LinkRecord = LinkResolution & Readonly<{ source: string; raw: string }>;

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
const gitmodulesResult = isGitmodulesReadableFile
  ? spawnSync(
      "git",
      [
        "config",
        "-z",
        "--file",
        gitmodules,
        "--get-regexp",
        "^submodule\\..*\\.path$",
      ],
      { encoding: "utf8" },
    )
  : null;
let gitConfiguredSubmodules: string[] = [];
let isGitConfigOutputValid = gitmodulesResult?.status === 0;
if (gitmodulesResult?.status === 0) {
  for (const entry of gitmodulesResult.stdout.split("\0").filter(Boolean)) {
    const separator = entry.indexOf("\n");
    if (separator < 0) {
      isGitConfigOutputValid = false;
      gitConfiguredSubmodules = [];
      break;
    }
    gitConfiguredSubmodules.push(entry.slice(separator + 1));
  }
}
const isGitmodulesParsed =
  !gitmodulesStat ||
  (isGitmodulesReadableFile &&
    (gitmodulesResult?.status === 1 || isGitConfigOutputValid));
const declaredSubmodules = isGitmodulesParsed
  ? gitmodulesResult?.status === 0
    ? gitConfiguredSubmodules
    : []
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

let releaseRoots = [
  path.join(root, "90_Release"),
  ...(repositoryMode === "official"
    ? [path.join(root, "template", "90_Release")]
    : []),
];
let recognizedChangeTracePatterns = [
  "90_Release/**/Changes/**/CHG-*.md",
  ...(repositoryMode === "official"
    ? ["template/90_Release/**/Changes/**/CHG-*.md"]
    : []),
];

function changeTraceRootFor(file: string): string | null {
  for (const releaseRoot of releaseRoots) {
    if (!isWithin(releaseRoot, file)) continue;
    const parts = path.relative(releaseRoot, file).split(path.sep);
    const directories = parts.slice(0, -1);
    const changesIndex = directories.findIndex(
      (part) => part.toLocaleLowerCase("en-US") === "changes",
    );
    if (changesIndex < 0) continue;
    return path.join(releaseRoot, ...directories.slice(0, changesIndex + 1));
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
      /^(?:Change ID|変更ID|change_id)\s*[:：]\s*`?(CHG-[A-Za-z0-9-]+)/imu,
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

type ConsolidatedChangeTraceEntry = Readonly<{
  oldId: string;
  canonicalId: string;
  originalPath: string;
  anchor: string;
  commit: string;
  tree: string;
  bytes: number;
  sha256: string;
  evidencePaths: readonly string[];
}>;

type ConsolidationLedgerCheckResult = Readonly<{
  historicalReferenceCandidates: ReadonlySet<string>;
  historicalReferencePairs: ReadonlySet<string>;
  historicalReferencePhysicalTargets: ReadonlySet<string>;
  historicalReferenceIndexedTargets: ReadonlySet<string>;
  historicalReferenceSources: number;
  historicalReferenceTargets: number;
}>;

const emptyConsolidationLedgerCheckResult: ConsolidationLedgerCheckResult = {
  historicalReferenceCandidates: new Set<string>(),
  historicalReferencePairs: new Set<string>(),
  historicalReferencePhysicalTargets: new Set<string>(),
  historicalReferenceIndexedTargets: new Set<string>(),
  historicalReferenceSources: 0,
  historicalReferenceTargets: 0,
};

function historicalReferenceKey(source: string, target: string): string {
  return `${path.resolve(source)}\0${path.resolve(target)}`;
}

type ReleasedNavigationMigration = Readonly<{
  sourceSha256: string;
  replacements: readonly Readonly<{
    before: string;
    after: string;
    count: number;
  }>[];
}>;

function readReleasedNavigationMigrations(
  allFiles: readonly string[],
): Map<string, ReleasedNavigationMigration> {
  const result = new Map<string, ReleasedNavigationMigration>();
  const recordPath = path.join(
    root,
    "90_Release/Changes/CHG-000017_Tools_Coding_Standards.md",
  );
  if (!fs.existsSync(recordPath)) return result;
  const reject = () => {
    add(
      "error",
      "invalid-released-navigation-migration",
      relative(recordPath),
      "Expected one bounded record of exact released-source hashes and current-navigation replacements.",
    );
    return new Map<string, ReleasedNavigationMigration>();
  };
  if (
    !allFiles.includes(recordPath) ||
    !lstatIfPresent(recordPath)?.isFile() ||
    pathContainsSymbolicLink(recordPath)
  )
    return reject();
  const content = read(recordPath);
  const marker = "<!-- crdd-released-navigation-migration: 1 -->";
  if (!content.includes(marker)) return result;
  const blocks = [
    ...content.matchAll(
      /<!-- crdd-released-navigation-migration: 1 -->\s*```json\s*\n([\s\S]*?)\n```/gu,
    ),
  ];
  if (
    content.split(marker).length !== 2 ||
    blocks.length !== 1 ||
    blocks[0][1].length > 65_536
  )
    return reject();
  const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const hasKeys = (value: Record<string, unknown>, keys: readonly string[]) =>
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
  let record: unknown;
  try {
    record = JSON.parse(blocks[0][1]);
  } catch {
    return reject();
  }
  if (
    !isObject(record) ||
    !hasKeys(record, ["schemaRevision", "sources"]) ||
    record.schemaRevision !== 1 ||
    !Array.isArray(record.sources) ||
    record.sources.length < 1 ||
    record.sources.length > 32
  )
    return reject();
  for (const entry of record.sources) {
    if (
      !isObject(entry) ||
      !hasKeys(entry, ["sourcePath", "sourceSha256", "replacements"]) ||
      typeof entry.sourcePath !== "string" ||
      !/^90_Release\/Changes\/CHG-[0-9]{6}_[A-Za-z0-9_-]+\.md$/u.test(
        entry.sourcePath,
      ) ||
      typeof entry.sourceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(entry.sourceSha256) ||
      !Array.isArray(entry.replacements) ||
      entry.replacements.length < 1 ||
      entry.replacements.length > 8 ||
      result.has(entry.sourcePath)
    )
      return reject();
    const replacements: { before: string; after: string; count: number }[] = [];
    for (const replacement of entry.replacements) {
      if (
        !isObject(replacement) ||
        !hasKeys(replacement, ["before", "after", "count"]) ||
        typeof replacement.before !== "string" ||
        typeof replacement.after !== "string" ||
        !Number.isSafeInteger(replacement.count) ||
        typeof replacement.count !== "number" ||
        replacement.count < 1 ||
        replacement.count > 64
      )
        return reject();
      const match = replacement.before.match(
        /^\[`tools\/checker\/([a-z0-9.-]+\.ts)`\]\(\.\.\/\.\.\/tools\/checker\/\1\)$/u,
      );
      if (
        !match ||
        replacement.after !==
          replacement.before.replaceAll(
            "tools/checker/",
            "40_Develop/checker/",
          ) ||
        replacements.some((item) => item.before === replacement.before)
      )
        return reject();
      const successor = path.join(root, "40_Develop/checker", match[1]);
      if (
        !allFiles.includes(successor) ||
        !lstatIfPresent(successor)?.isFile() ||
        pathContainsSymbolicLink(successor)
      )
        return reject();
      replacements.push({
        before: replacement.before,
        after: replacement.after,
        count: replacement.count,
      });
    }
    result.set(entry.sourcePath, {
      sourceSha256: entry.sourceSha256,
      replacements,
    });
  }
  return result;
}

function checkConsolidatedChangeTraceLedger(
  allFiles: readonly string[],
): ConsolidationLedgerCheckResult {
  if (repositoryMode !== "official") return emptyConsolidationLedgerCheckResult;
  process.env.GIT_NO_REPLACE_OBJECTS = "1";
  const initialErrorCount = findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  const navigationMigrations = readReleasedNavigationMigrations(allFiles);
  const appliedNavigationSources = new Set<string>();
  const ledger = path.join(root, "90_Release", "Changes", "README.md");
  const ledgerStat = lstatIfPresent(ledger);
  if (!ledgerStat && !allFiles.some((file) => samePath(file, ledger))) {
    return emptyConsolidationLedgerCheckResult;
  }
  if (
    !ledgerStat?.isFile() ||
    ledgerStat.isSymbolicLink() ||
    pathContainsSymbolicLink(ledger) ||
    !allFiles.some((file) => samePath(file, ledger))
  ) {
    add(
      "error",
      "invalid-change-trace-consolidation-ledger-file",
      relative(ledger),
      "The official consolidation ledger must be one discovered regular file inside the repository root.",
    );
    return emptyConsolidationLedgerCheckResult;
  }
  const gitEnvironment = { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" };
  const gitText = (gitArguments: readonly string[]) =>
    spawnSync("git", ["-C", root, ...gitArguments], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 16 * 1_048_576,
      env: gitEnvironment,
    });
  const headStartResult = gitText(["rev-parse", "--verify", "HEAD^{commit}"]);
  const tagsStartResult = gitText([
    "for-each-ref",
    "--sort=refname",
    "--format=%(refname:short)|%(objectname)|%(objecttype)|%(*objectname)|%(*objecttype)",
    "refs/tags",
  ]);
  const shallowResult = gitText(["rev-parse", "--is-shallow-repository"]);
  const ledgerIndexResult = gitText([
    "ls-files",
    "--stage",
    "--",
    "90_Release/Changes/README.md",
  ]);
  const headStart = (headStartResult.stdout ?? "").trim();
  const tagsStart = (tagsStartResult.stdout ?? "")
    .replaceAll("\r\n", "\n")
    .trim();
  if (
    headStartResult.error ||
    headStartResult.status !== 0 ||
    (headStartResult.stderr ?? "").trim() ||
    !/^[0-9a-f]{40}$/u.test(headStart) ||
    tagsStartResult.error ||
    tagsStartResult.status !== 0 ||
    (tagsStartResult.stderr ?? "").trim() ||
    shallowResult.error ||
    shallowResult.status !== 0 ||
    (shallowResult.stderr ?? "").trim() ||
    (shallowResult.stdout ?? "").trim() !== "false" ||
    ledgerIndexResult.error ||
    ledgerIndexResult.status !== 0 ||
    (ledgerIndexResult.stderr ?? "").trim() ||
    !/^(?:100644|100755) [0-9a-f]{40} 0\t90_Release\/Changes\/README\.md$/mu.test(
      ledgerIndexResult.stdout ?? "",
    )
  ) {
    add(
      "error",
      "change-trace-ledger-git-snapshot-unavailable",
      relative(ledger),
      "The ledger requires a tracked regular file, a complete non-shallow Git repository, and one readable HEAD/tag snapshot.",
    );
  }
  const ledgerStartBytes = fs.readFileSync(ledger);

  const liveIds = new Map<string, string>();
  for (const file of allFiles) {
    if (isEvidenceFile(file) || !/^CHG-[^.]+\.md$/u.test(path.basename(file))) {
      continue;
    }
    if (!changeTraceRootFor(file)) continue;
    const id = declaredChangeTraceId(file);
    if (!id) continue;
    const previous = liveIds.get(id);
    if (previous) {
      add(
        "error",
        "duplicate-change-trace-id",
        relative(file),
        `${id}: also declared by ${previous}.`,
      );
    } else {
      liveIds.set(id, relative(file));
    }
  }

  const text = read(ledger);
  const machineSection = (heading: string): string => {
    const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const headingPattern = new RegExp(`^## ${escapedHeading}\\s*$`, "gmu");
    const headingMatches = [...text.matchAll(headingPattern)];
    if (headingMatches.length !== 1) return "";
    const start = headingMatches[0].index ?? 0;
    return text.slice(start).split(/\n(?=## )/u, 1)[0];
  };
  const validateMachineTable = (
    heading: string,
    header: string,
    separator: string,
    exactRowPattern: RegExp,
    expectedRows: number,
    code: string,
  ): void => {
    const section = machineSection(heading);
    const lines = section.split(/\r?\n/u);
    const tableLikeLines = lines.filter((line) => {
      if (!line.trim()) return false;
      if (/^[ \t]{0,3}\|/u.test(line)) return true;
      const trimmed = line.trimStart();
      return (
        !trimmed.startsWith("-") &&
        !trimmed.startsWith("#") &&
        trimmed.includes(" | ")
      );
    });
    const exactRows = tableLikeLines.filter((line) =>
      exactRowPattern.test(line),
    );
    const isExact =
      section.length > 0 &&
      lines.filter((line) => line === header).length === 1 &&
      lines.filter((line) => line === separator).length === 1 &&
      exactRows.length === expectedRows &&
      tableLikeLines.length === expectedRows + 2 &&
      tableLikeLines[0] === header &&
      tableLikeLines[1] === separator &&
      tableLikeLines.slice(2).every((line) => exactRowPattern.test(line));
    if (!isExact) {
      add(
        "error",
        code,
        relative(ledger),
        `${heading}: the machine-owned table must use one exact unindented header, separator, and serialized row block.`,
      );
    }
  };
  if (
    [...text.matchAll(/<!-- crdd-change-trace-ledger-schema:\s*1 -->/gu)]
      .length !== 1
  ) {
    add(
      "error",
      "invalid-change-trace-ledger-schema-revision",
      relative(ledger),
      "The machine-owned consolidation ledger requires exactly one schema revision 1 marker.",
    );
  }
  const integrationBaseCommitMatches = [
    ...text.matchAll(/^- 統合直前Commit:\s*`([0-9a-f]{40})`\s*$/gmu),
  ];
  const integrationBaseTreeMatches = [
    ...text.matchAll(/^- 統合直前Tree:\s*`([0-9a-f]{40})`\s*$/gmu),
  ];
  const integrationBaseCommit = integrationBaseCommitMatches[0]?.[1] ?? "";
  const integrationBaseTree = integrationBaseTreeMatches[0]?.[1] ?? "";
  const integrationCommitType = gitText([
    "cat-file",
    "-t",
    integrationBaseCommit,
  ]);
  const integrationCommitTree = gitText([
    "show",
    "-s",
    "--format=%T",
    integrationBaseCommit,
  ]);
  const integrationCommitAncestor = gitText([
    "merge-base",
    "--is-ancestor",
    integrationBaseCommit,
    headStart,
  ]);
  if (
    integrationBaseCommitMatches.length !== 1 ||
    integrationBaseTreeMatches.length !== 1 ||
    integrationCommitType.error ||
    integrationCommitType.status !== 0 ||
    (integrationCommitType.stderr ?? "").trim() ||
    (integrationCommitType.stdout ?? "").trim() !== "commit" ||
    integrationCommitTree.error ||
    integrationCommitTree.status !== 0 ||
    (integrationCommitTree.stderr ?? "").trim() ||
    (integrationCommitTree.stdout ?? "").trim() !== integrationBaseTree ||
    integrationCommitAncestor.error ||
    integrationCommitAncestor.status !== 0 ||
    (integrationCommitAncestor.stderr ?? "").trim() ||
    (integrationCommitAncestor.stdout ?? "").trim()
  ) {
    add(
      "error",
      "invalid-change-trace-integration-base",
      relative(ledger),
      "The exact integration-base Commit/Tree must resolve to one ancestor commit and its matching tree.",
    );
  }
  const marker =
    /<a id="consolidated-(chg-[0-9]{6})"><\/a>\s*\n\s*###\s+(CHG-[0-9]{6})\s+→\s+(CHG-[0-9]{6})/giu;
  const matches = [...text.matchAll(marker)];
  if (matches.length === 0) {
    add(
      "error",
      "empty-change-trace-consolidation-ledger",
      relative(ledger),
      "The consolidation ledger has no recognizable old-ID entries.",
    );
    return emptyConsolidationLedgerCheckResult;
  }

  const entries: ConsolidatedChangeTraceEntry[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const oldId = match[2];
    const canonicalId = match[3];
    const anchor = `consolidated-${match[1].toLocaleLowerCase("en-US")}`;
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? text.length;
    const section = text.slice(start, end);
    if (/^[ \t]+- [^:：\r\n]+[:：]/mu.test(section)) {
      add(
        "error",
        "invalid-change-trace-ledger-entry-schema",
        relative(ledger),
        `${oldId}: indented machine-looking fields are not allowed in a machine-owned entry.`,
      );
    }
    const machineFieldNames = [
      ...section.matchAll(/^- ([^:：\r\n]+)[:：]/gmu),
    ].map((field) => field[1].trim());
    const expectedMachineFieldNames = [
      "旧題名",
      "旧Path",
      "統合前判断",
      "変更分類",
      "移行／Release境界",
      "Canonical CHG",
      "統合理由",
      "固定原文",
      "関連Evidence",
      ...(oldId === "CHG-000030" && machineFieldNames.includes("棄却境界")
        ? ["棄却境界"]
        : []),
      "旧ID処置",
    ];
    if (
      machineFieldNames.length !== expectedMachineFieldNames.length ||
      machineFieldNames.some(
        (field, fieldIndex) => field !== expectedMachineFieldNames[fieldIndex],
      )
    ) {
      add(
        "error",
        "invalid-change-trace-ledger-entry-schema",
        relative(ledger),
        `${oldId}: machine-owned fields are missing, duplicated, unknown, or out of order.`,
      );
    }
    const originalPath =
      section.match(/^- 旧Path:\s*`([^`]+)`\s*$/mu)?.[1] ?? "";
    const fixedIdentity = section.match(
      /^- 固定原文:\s*Commit\s*`([0-9a-f]{40})`、Tree\s*`([0-9a-f]{40})`、([1-9][0-9]*) byte、SHA-256\s*`([0-9a-f]{64})`\s*$/mu,
    );
    const relatedEvidenceLine =
      section.match(/^- 関連Evidence:\s*(.+)$/mu)?.[1] ?? "";
    const evidencePaths = [
      ...relatedEvidenceLine.matchAll(/\]\(Evidence\/([^)#?]+\.md)\)/gu),
    ].map((evidence) => `90_Release/Changes/Evidence/${evidence[1]}`);

    if (anchor !== `consolidated-${oldId.toLocaleLowerCase("en-US")}`) {
      add(
        "error",
        "change-trace-ledger-anchor-mismatch",
        relative(ledger),
        `${oldId}: anchor ${anchor} does not match the old ID.`,
      );
    }
    if (seen.has(oldId)) {
      add(
        "error",
        "duplicate-consolidated-change-trace-id",
        relative(ledger),
        `${oldId}: the old ID occurs more than once in the consolidation ledger.`,
      );
    }
    seen.add(oldId);
    if (oldId === canonicalId) {
      add(
        "error",
        "self-consolidated-change-trace-id",
        relative(ledger),
        `${oldId}: an old ID cannot consolidate into itself.`,
      );
    }
    if (liveIds.has(oldId)) {
      add(
        "error",
        "reused-consolidated-change-trace-id",
        relative(ledger),
        `${oldId}: a consolidated old ID is still declared by ${liveIds.get(oldId)}.`,
      );
    }
    if (!liveIds.has(canonicalId)) {
      add(
        "error",
        "missing-canonical-change-trace-id",
        relative(ledger),
        `${oldId}: canonical ${canonicalId} is not a live Change Trace.`,
      );
    }
    if (
      !originalPath ||
      !new RegExp(`^90_Release/Changes/${oldId}_[A-Za-z0-9_]+\\.md$`, "u").test(
        originalPath,
      ) ||
      originalPath.includes("..") ||
      originalPath.includes("\\") ||
      originalPath.includes(":") ||
      originalPath.includes("\0")
    ) {
      add(
        "error",
        "invalid-consolidated-change-trace-path",
        relative(ledger),
        `${oldId}: the old Path must use the same old ID.`,
      );
    } else if (lstatIfPresent(path.join(root, ...originalPath.split("/")))) {
      add(
        "error",
        "physical-consolidated-change-trace-path",
        relative(ledger),
        `${oldId}: consolidated old Path must not remain as a file, stub, redirect, or symlink.`,
      );
    }
    if (
      !new RegExp(
        `^- Canonical CHG: \\[${canonicalId}\\]\\([^)]+\\)\\s*$`,
        "mu",
      ).test(section)
    ) {
      add(
        "error",
        "invalid-canonical-change-trace-link",
        relative(ledger),
        `${oldId}: the Canonical CHG link is missing or does not match ${canonicalId}.`,
      );
    }
    if (!/^- 統合理由:\s*\S.+$/mu.test(section)) {
      add(
        "error",
        "missing-change-trace-consolidation-reason",
        relative(ledger),
        `${oldId}: consolidation reason is missing.`,
      );
    }
    if (!fixedIdentity) {
      add(
        "error",
        "invalid-consolidated-change-trace-identity",
        relative(ledger),
        `${oldId}: fixed Commit, Tree, byte count, and SHA-256 are required.`,
      );
    }
    if (!/^- 関連Evidence:\s*\S.+$/mu.test(section)) {
      add(
        "error",
        "missing-consolidated-change-trace-evidence",
        relative(ledger),
        `${oldId}: exact Evidence links or an explicit no-Evidence statement is required.`,
      );
    }
    if (!/^- 旧ID処置:\s*統合済み・永久欠番\s*$/mu.test(section)) {
      add(
        "error",
        "invalid-consolidated-change-trace-reservation",
        relative(ledger),
        `${oldId}: the old ID must be reserved permanently.`,
      );
    }
    entries.push({
      oldId,
      canonicalId,
      originalPath,
      anchor,
      commit: fixedIdentity?.[1] ?? "",
      tree: fixedIdentity?.[2] ?? "",
      bytes: Number.parseInt(fixedIdentity?.[3] ?? "0", 10),
      sha256: fixedIdentity?.[4] ?? "",
      evidencePaths,
    });
  }

  const oldPathFieldCount = [...text.matchAll(/^- 旧Path:/gmu)].length;
  if (oldPathFieldCount !== entries.length) {
    add(
      "error",
      "orphan-change-trace-ledger-old-path",
      relative(ledger),
      `Observed ${oldPathFieldCount} old-Path fields for ${entries.length} recognized entries.`,
    );
  }

  const oldIds = new Set(entries.map((entry) => entry.oldId));
  for (const entry of entries) {
    if (
      entry.commit !== integrationBaseCommit ||
      entry.tree !== integrationBaseTree
    ) {
      add(
        "error",
        "change-trace-entry-base-mismatch",
        relative(ledger),
        `${entry.oldId}: fixed Commit/Tree must equal the immutable integration-base identity.`,
      );
    }
  }
  const reservedIdPattern = /^CHG-([0-9]{6})_.+\.md$/iu;
  const reservedPhysicalEntriesStart = new Set<string>();
  const inspectReservedEntries = (directory: string): void => {
    const directoryStat = lstatIfPresent(directory);
    if (!directoryStat?.isDirectory()) return;
    for (const directoryEntry of fs.readdirSync(directory, {
      withFileTypes: true,
    })) {
      const candidate = path.join(directory, directoryEntry.name);
      const candidateRelative = relative(candidate);
      const filenameMatch = directoryEntry.name.match(reservedIdPattern);
      if (
        filenameMatch &&
        oldIds.has(`CHG-${filenameMatch[1]}`) &&
        !isEvidenceFile(candidate)
      ) {
        reservedPhysicalEntriesStart.add(
          candidateRelative.toLocaleLowerCase("en-US"),
        );
        add(
          "error",
          "physical-consolidated-change-trace-id",
          candidateRelative,
          `${filenameMatch[0]} reuses a permanently reserved consolidated Change Trace ID.`,
        );
      }
      if (directoryEntry.isDirectory() && !directoryEntry.isSymbolicLink()) {
        inspectReservedEntries(candidate);
      }
    }
  };
  for (const releaseRoot of releaseRoots) {
    const changesDirectory = path.join(releaseRoot, "Changes");
    inspectReservedEntries(changesDirectory);
  }
  const indexEntries = gitText(["ls-files", "--stage", "-z"]);
  if (
    indexEntries.error ||
    indexEntries.status !== 0 ||
    (indexEntries.stderr ?? "").trim()
  ) {
    add(
      "error",
      "change-trace-index-inspection-failed",
      relative(ledger),
      "Could not inspect the Git index for reserved Change Trace IDs.",
    );
  } else {
    for (const indexEntry of (indexEntries.stdout ?? "").split("\0")) {
      const match = indexEntry.match(/^[0-9]{6} [0-9a-f]{40} [0-3]\t(.+)$/u);
      if (!match) continue;
      const indexedPath = match[1];
      const indexedAbsolute = path.join(root, ...indexedPath.split("/"));
      const filenameMatch = path.basename(indexedPath).match(reservedIdPattern);
      if (
        filenameMatch &&
        oldIds.has(`CHG-${filenameMatch[1]}`) &&
        !isEvidenceFile(indexedAbsolute) &&
        changeTraceRootFor(indexedAbsolute)
      ) {
        add(
          "error",
          "indexed-consolidated-change-trace-id",
          indexedPath,
          `${filenameMatch[0]} reuses a permanently reserved consolidated Change Trace ID in the Git index.`,
        );
      }
    }
  }
  for (const entry of entries) {
    if (oldIds.has(entry.canonicalId)) {
      add(
        "error",
        "cyclic-change-trace-consolidation",
        relative(ledger),
        `${entry.oldId}: canonical ${entry.canonicalId} is also a consolidated old ID.`,
      );
    }
  }

  const verifiedAncestors = new Set<string>();
  for (const entry of entries) {
    if (!entry.commit || !entry.tree || !entry.sha256 || entry.bytes < 1)
      continue;
    const commitType = spawnSync(
      "git",
      ["-C", root, "cat-file", "-t", entry.commit],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 1_048_576,
      },
    );
    if (
      commitType.error ||
      commitType.status !== 0 ||
      (commitType.stderr ?? "").trim() ||
      (commitType.stdout ?? "").trim() !== "commit"
    ) {
      add(
        "error",
        "invalid-consolidated-change-trace-commit",
        relative(ledger),
        `${entry.oldId}: fixed Commit is unavailable or is not a commit object.`,
      );
      continue;
    }
    const tree = spawnSync(
      "git",
      ["-C", root, "show", "-s", "--format=%T", entry.commit],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 1_048_576,
      },
    );
    if (
      tree.error ||
      tree.status !== 0 ||
      (tree.stderr ?? "").trim() ||
      (tree.stdout ?? "").trim() !== entry.tree
    ) {
      add(
        "error",
        "consolidated-change-trace-tree-mismatch",
        relative(ledger),
        `${entry.oldId}: fixed Tree does not match the Commit tree.`,
      );
      continue;
    }
    const objectSpec = `${entry.commit}:${entry.originalPath}`;
    const blobType = spawnSync(
      "git",
      ["-C", root, "cat-file", "-t", objectSpec],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 1_048_576,
      },
    );
    if (
      blobType.error ||
      blobType.status !== 0 ||
      (blobType.stderr ?? "").trim() ||
      (blobType.stdout ?? "").trim() !== "blob"
    ) {
      add(
        "error",
        "invalid-consolidated-change-trace-blob",
        relative(ledger),
        `${entry.oldId}: fixed old Path is unavailable or is not a blob.`,
      );
      continue;
    }
    const blob = spawnSync("git", ["-C", root, "show", objectSpec], {
      encoding: null,
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: 16 * 1_048_576,
    });
    const blobBytes = Buffer.isBuffer(blob.stdout)
      ? blob.stdout
      : Buffer.alloc(0);
    const blobStderr = Buffer.isBuffer(blob.stderr)
      ? blob.stderr.toString("utf8")
      : (blob.stderr ?? "");
    const blobSha256 = createHash("sha256").update(blobBytes).digest("hex");
    if (
      blob.error ||
      blob.status !== 0 ||
      blobStderr.trim() ||
      blobBytes.length !== entry.bytes ||
      blobSha256 !== entry.sha256
    ) {
      add(
        "error",
        "consolidated-change-trace-content-mismatch",
        relative(ledger),
        `${entry.oldId}: fixed old Path bytes do not match the declared identity.`,
      );
    }
    if (!verifiedAncestors.has(entry.commit)) {
      verifiedAncestors.add(entry.commit);
      const ancestor = spawnSync(
        "git",
        ["-C", root, "merge-base", "--is-ancestor", entry.commit, headStart],
        {
          encoding: "utf8",
          windowsHide: true,
          timeout: 5_000,
          maxBuffer: 1_048_576,
        },
      );
      if (
        ancestor.error ||
        ancestor.status !== 0 ||
        (ancestor.stderr ?? "").trim() ||
        (ancestor.stdout ?? "").trim()
      ) {
        add(
          "error",
          "consolidated-change-trace-base-not-ancestor",
          relative(ledger),
          `${entry.oldId}: fixed Commit must remain an ancestor of the current Release candidate HEAD.`,
        );
      }
    }
  }

  const unreleasedRange = text.match(
    /^- 統合前の未リリースCHG:\s*`CHG-([0-9]{6})`～`CHG-([0-9]{6})`の([0-9]+)件\s*$/mu,
  );
  const consolidatedSummary = text.match(
    /^- 統合後:\s*Canonical CHG ([0-9]+)件、統合済み旧ID ([0-9]+)件\s*$/mu,
  );
  const canonicalSummary = text.match(/^- Canonical CHG:\s*(.+)$/mu);
  if (!unreleasedRange || !consolidatedSummary || !canonicalSummary) {
    add(
      "error",
      "incomplete-change-trace-consolidation-set-declaration",
      relative(ledger),
      "The unreleased range, canonical count, old-ID count, and canonical ID set must be declared.",
    );
  } else {
    const first = Number.parseInt(unreleasedRange[1], 10);
    const last = Number.parseInt(unreleasedRange[2], 10);
    const declaredTotal = Number.parseInt(unreleasedRange[3], 10);
    const declaredCanonicalCount = Number.parseInt(consolidatedSummary[1], 10);
    const declaredOldCount = Number.parseInt(consolidatedSummary[2], 10);
    const canonicalIds = new Set(
      [...canonicalSummary[1].matchAll(/CHG-[0-9]{6}/gu)].map(
        (match) => match[0],
      ),
    );
    const calculatedTotal = last >= first ? last - first + 1 : 0;
    if (
      calculatedTotal !== declaredTotal ||
      canonicalIds.size !== declaredCanonicalCount ||
      oldIds.size !== declaredOldCount ||
      declaredCanonicalCount + declaredOldCount !== declaredTotal
    ) {
      add(
        "error",
        "invalid-change-trace-consolidation-set-arithmetic",
        relative(ledger),
        `Declared ${declaredTotal} total / ${declaredCanonicalCount} canonical / ${declaredOldCount} old IDs, observed range ${calculatedTotal} / canonical ${canonicalIds.size} / old ${oldIds.size}.`,
      );
    }

    for (let numericId = first; numericId <= last; numericId += 1) {
      const id = `CHG-${numericId.toString().padStart(6, "0")}`;
      const isOld = oldIds.has(id);
      const isLive = liveIds.has(id);
      if (isOld === isLive) {
        add(
          "error",
          "non-exclusive-change-trace-consolidation-mapping",
          relative(ledger),
          `${id}: expected exactly one of a live canonical or a consolidated old-ID entry.`,
        );
      }
      if (isLive && !canonicalIds.has(id)) {
        add(
          "error",
          "undeclared-canonical-change-trace-id",
          relative(ledger),
          `${id}: live Change Trace is not declared in the canonical ID set.`,
        );
      }
      if (isOld && canonicalIds.has(id)) {
        add(
          "error",
          "consolidated-id-declared-canonical",
          relative(ledger),
          `${id}: consolidated old ID is also declared canonical.`,
        );
      }
    }

    for (const id of canonicalIds) {
      const numericId = Number.parseInt(id.slice(4), 10);
      if (numericId < first || numericId > last || !liveIds.has(id)) {
        add(
          "error",
          "invalid-declared-canonical-change-trace-id",
          relative(ledger),
          `${id}: canonical ID must be a live Change Trace inside the declared unreleased range.`,
        );
      }
    }
  }

  type TagSnapshotRow = Readonly<{
    name: string;
    refOid: string;
    objectType: string;
    peeledCommitOid: string;
  }>;
  const tagSnapshotRows = tagsStart
    .split(/\n/u)
    .filter(Boolean)
    .map((line): TagSnapshotRow | null => {
      const [name, refOid, objectType, peeledOid, peeledType] = line.split("|");
      const peeledCommitOid =
        objectType === "commit"
          ? refOid
          : objectType === "tag" && peeledType === "commit"
            ? peeledOid
            : "";
      if (!name || !/^[0-9a-f]{40}$/u.test(refOid ?? "") || !objectType) {
        return null;
      }
      return { name, refOid, objectType, peeledCommitOid };
    });
  const tagSnapshotByName = new Map(
    tagSnapshotRows
      .filter((row): row is TagSnapshotRow => row !== null)
      .map((row) => [row.name, row]),
  );
  const fixedTagRows = new Map<
    string,
    Readonly<{
      objectType: string;
      refOid: string;
      peeledCommitOid: string;
      peeledTreeOid: string;
    }>
  >();
  const fixedTagMatches = [
    ...text.matchAll(
      /^\| `(v[0-9]+\.[0-9]+\.[0-9]+(?:-p[0-9]+)?)` \| `(tag|commit)` \| `([0-9a-f]{40})` \| `([0-9a-f]{40})` \| `([0-9a-f]{40})` \|$/gmu,
    ),
  ];
  for (const tagMatch of fixedTagMatches) {
    if (fixedTagRows.has(tagMatch[1])) {
      add(
        "error",
        "duplicate-published-tag-inventory-entry",
        relative(ledger),
        `${tagMatch[1]} occurs more than once in the fixed published-tag inventory.`,
      );
    }
    fixedTagRows.set(tagMatch[1], {
      objectType: tagMatch[2],
      refOid: tagMatch[3],
      peeledCommitOid: tagMatch[4],
      peeledTreeOid: tagMatch[5],
    });
  }
  validateMachineTable(
    "公式公開tag固定集合",
    "| Tag | Ref Object Type | Ref Object OID | Peeled Commit OID | Peeled Tree OID |",
    "|---|---|---|---|---|",
    /^\| `v[0-9]+\.[0-9]+\.[0-9]+(?:-p[0-9]+)?` \| `(tag|commit)` \| `[0-9a-f]{40}` \| `[0-9a-f]{40}` \| `[0-9a-f]{40}` \|$/u,
    fixedTagMatches.length,
    "invalid-published-tag-inventory-table-schema",
  );
  const fixedTagSummary = text.match(
    /^- 公式公開tag固定集合:\s*([0-9]+)件\s*$/mu,
  );
  const expectedFixedTagCount = Number.parseInt(
    fixedTagSummary?.[1] ?? "-1",
    10,
  );
  if (
    !fixedTagSummary ||
    expectedFixedTagCount < 0 ||
    fixedTagRows.size !== expectedFixedTagCount
  ) {
    add(
      "error",
      "incomplete-published-tag-inventory",
      relative(ledger),
      `Expected ${expectedFixedTagCount} fixed published tags, observed ${fixedTagRows.size}.`,
    );
  }
  const officialTagNamePattern = /^v[0-9]+\.[0-9]+\.[0-9]+(?:-p[0-9]+)?$/u;
  const observedOfficialTags = [...tagSnapshotByName].filter(([tagName]) =>
    officialTagNamePattern.test(tagName),
  );
  for (const [
    observedOfficialTagName,
    observedOfficialTag,
  ] of observedOfficialTags) {
    if (!observedOfficialTag.peeledCommitOid) {
      add(
        "error",
        "official-published-tag-not-commit",
        relative(ledger),
        `${observedOfficialTagName}: official Release tags must peel to a commit.`,
      );
    }
  }
  for (const [tagName, fixedTag] of fixedTagRows) {
    const observedTag = tagSnapshotByName.get(tagName);
    if (
      !observedTag ||
      observedTag.objectType !== fixedTag.objectType ||
      observedTag.refOid !== fixedTag.refOid ||
      observedTag.peeledCommitOid !== fixedTag.peeledCommitOid
    ) {
      add(
        "error",
        "published-tag-inventory-mismatch",
        relative(ledger),
        `${tagName}: ref object type/OID or peeled commit does not match the fixed inventory.`,
      );
      continue;
    }
    const tagTree = gitText([
      "show",
      "-s",
      "--format=%T",
      fixedTag.peeledCommitOid,
    ]);
    const tagAncestor = gitText([
      "merge-base",
      "--is-ancestor",
      fixedTag.peeledCommitOid,
      headStart,
    ]);
    if (
      tagTree.error ||
      tagTree.status !== 0 ||
      (tagTree.stderr ?? "").trim() ||
      (tagTree.stdout ?? "").trim() !== fixedTag.peeledTreeOid ||
      tagAncestor.error ||
      tagAncestor.status !== 0 ||
      (tagAncestor.stderr ?? "").trim() ||
      (tagAncestor.stdout ?? "").trim()
    ) {
      add(
        "error",
        "published-tag-identity-unavailable",
        relative(ledger),
        `${tagName}: fixed peeled commit/tree is unavailable, changed, or not an ancestor of the candidate HEAD.`,
      );
    }
  }
  const tagInspectionAvailable =
    tagsStartResult.status === 0 &&
    tagSnapshotRows.every((row) => row !== null) &&
    tagSnapshotByName.size === tagSnapshotRows.length;
  if (tagInspectionAvailable) {
    const tags = [...fixedTagRows.keys()];
    const tagPaths = new Map<string, string[]>();
    for (const tag of tags) {
      const tagSnapshot = tagSnapshotByName.get(tag);
      if (!tagSnapshot) continue;
      const treeResult = spawnSync(
        "git",
        [
          "-C",
          root,
          "ls-tree",
          "-r",
          "--name-only",
          tagSnapshot.peeledCommitOid,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          timeout: 5_000,
          maxBuffer: 16 * 1_048_576,
        },
      );
      if (
        treeResult.error ||
        treeResult.status !== 0 ||
        (treeResult.stderr ?? "").trim()
      ) {
        add(
          "error",
          "change-trace-tag-inspection-failed",
          relative(ledger),
          `Could not inspect published tag ${tag}.`,
        );
        continue;
      }
      for (const taggedPath of (treeResult.stdout ?? "").split(/\r?\n/u)) {
        if (!taggedPath) continue;
        const existingTags = tagPaths.get(taggedPath) ?? [];
        existingTags.push(tag);
        tagPaths.set(taggedPath, existingTags);
      }
    }

    for (const entry of entries) {
      const oldPathTagNames = tagPaths.get(entry.originalPath) ?? [];
      if (oldPathTagNames.length > 0) {
        add(
          "error",
          "released-change-trace-consolidated",
          relative(ledger),
          `${entry.oldId}: old Path is reachable from published tag(s) ${oldPathTagNames.join(", ")}.`,
        );
      }
    }

    const futureOfficialTagPaths = new Map<string, string[]>();
    for (const [tagName, tagSnapshot] of observedOfficialTags) {
      if (fixedTagRows.has(tagName) || !tagSnapshot.peeledCommitOid) continue;
      const treeResult = gitText([
        "ls-tree",
        "-r",
        "--name-only",
        tagSnapshot.peeledCommitOid,
      ]);
      if (
        treeResult.error ||
        treeResult.status !== 0 ||
        (treeResult.stderr ?? "").trim()
      ) {
        add(
          "error",
          "change-trace-tag-inspection-failed",
          relative(ledger),
          `Could not inspect future official tag ${tagName}.`,
        );
        continue;
      }
      for (const taggedPath of (treeResult.stdout ?? "").split(/\r?\n/u)) {
        if (!taggedPath) continue;
        const existingTags = futureOfficialTagPaths.get(taggedPath) ?? [];
        existingTags.push(tagName);
        futureOfficialTagPaths.set(taggedPath, existingTags);
      }
    }
    for (const entry of entries) {
      const futureTagNames =
        futureOfficialTagPaths.get(entry.originalPath) ?? [];
      if (futureTagNames.length > 0) {
        add(
          "error",
          "released-change-trace-consolidated",
          relative(ledger),
          `${entry.oldId}: old Path is reachable from future official tag(s) ${futureTagNames.join(", ")}.`,
        );
      }
    }

    const releasedRange = text.match(
      /^- 公開済み固定履歴:\s*`CHG-([0-9]{6})`～`CHG-([0-9]{6})`の([0-9]+)件[。\s]/mu,
    );
    if (releasedRange) {
      if (fixedTagRows.size === 0) {
        add(
          "error",
          "missing-published-tag-inventory",
          relative(ledger),
          "Released Change Traces require at least one fixed official published tag.",
        );
      }
      const fixedReleasedRows = new Map<
        string,
        Readonly<{
          path: string;
          commit: string;
          bytes: number;
          sha256: string;
        }>
      >();
      const fixedReleasedMatches = [
        ...text.matchAll(
          /^\| `(CHG-[0-9]{6})` \| `([^`]+)` \| `([0-9a-f]{40})` \| ([1-9][0-9]*) \| `([0-9a-f]{64})` \|$/gmu,
        ),
      ];
      for (const match of fixedReleasedMatches) {
        if (fixedReleasedRows.has(match[1])) {
          add(
            "error",
            "duplicate-released-change-trace-fixed-row",
            relative(ledger),
            `${match[1]} occurs more than once in the fixed released-history table.`,
          );
        }
        fixedReleasedRows.set(match[1], {
          path: match[2],
          commit: match[3],
          bytes: Number.parseInt(match[4], 10),
          sha256: match[5],
        });
      }
      validateMachineTable(
        "公開済み固定履歴",
        "| CHG | Path | 固定Commit | byte | SHA-256 |",
        "|---|---|---|---:|---|",
        /^\| `CHG-[0-9]{6}` \| `[^`]+` \| `[0-9a-f]{40}` \| [1-9][0-9]* \| `[0-9a-f]{64}` \|$/u,
        fixedReleasedMatches.length,
        "invalid-released-change-trace-table-schema",
      );
      const firstReleased = Number.parseInt(releasedRange[1], 10);
      const lastReleased = Number.parseInt(releasedRange[2], 10);
      const declaredReleased = Number.parseInt(releasedRange[3], 10);
      if (
        lastReleased < firstReleased ||
        lastReleased - firstReleased + 1 !== declaredReleased
      ) {
        add(
          "error",
          "invalid-released-change-trace-range",
          relative(ledger),
          "The declared released Change Trace range arithmetic is invalid.",
        );
      } else {
        for (
          let numericId = firstReleased;
          numericId <= lastReleased;
          numericId += 1
        ) {
          const id = `CHG-${numericId.toString().padStart(6, "0")}`;
          const candidates = allFiles.filter((file) => {
            if (isEvidenceFile(file) || !changeTraceRootFor(file)) return false;
            return path.basename(file).startsWith(`${id}_`);
          });
          if (candidates.length !== 1) {
            add(
              "error",
              "missing-released-change-trace-file",
              relative(ledger),
              `${id}: expected exactly one current Change Trace file, observed ${candidates.length}.`,
            );
            continue;
          }
          const currentFile = candidates[0];
          const currentRelativePath = relative(currentFile);
          const containingTags = tagPaths.get(currentRelativePath) ?? [];
          if (containingTags.length === 0) {
            add(
              "error",
              "released-change-trace-not-tagged",
              currentRelativePath,
              `${id}: declared released but not reachable from any repository tag.`,
            );
            continue;
          }
          const fixedRow = fixedReleasedRows.get(id);
          if (!fixedRow || fixedRow.path !== currentRelativePath) {
            add(
              "error",
              "missing-released-change-trace-fixed-identity",
              relative(ledger),
              `${id}: exact current Path, byte count, and SHA-256 must be fixed in the released-history table.`,
            );
            continue;
          }
          const fixedCommitType = gitText(["cat-file", "-t", fixedRow.commit]);
          const fixedCommitAncestor = gitText([
            "merge-base",
            "--is-ancestor",
            fixedRow.commit,
            headStart,
          ]);
          if (
            fixedCommitType.error ||
            fixedCommitType.status !== 0 ||
            (fixedCommitType.stderr ?? "").trim() ||
            (fixedCommitType.stdout ?? "").trim() !== "commit" ||
            fixedCommitAncestor.error ||
            fixedCommitAncestor.status !== 0 ||
            (fixedCommitAncestor.stderr ?? "").trim() ||
            (fixedCommitAncestor.stdout ?? "").trim()
          ) {
            add(
              "error",
              "invalid-released-change-trace-fixed-commit",
              relative(ledger),
              `${id}: fixed Commit must be a readable commit object and an ancestor of the candidate HEAD.`,
            );
            continue;
          }
          const fixedObject = spawnSync(
            "git",
            ["-C", root, "show", `${fixedRow.commit}:${fixedRow.path}`],
            {
              encoding: null,
              windowsHide: true,
              timeout: 5_000,
              maxBuffer: 16 * 1_048_576,
            },
          );
          const fixedBytes = Buffer.isBuffer(fixedObject.stdout)
            ? fixedObject.stdout
            : Buffer.alloc(0);
          const fixedStderr = Buffer.isBuffer(fixedObject.stderr)
            ? fixedObject.stderr.toString("utf8")
            : (fixedObject.stderr ?? "");
          const fixedSha256 = createHash("sha256")
            .update(fixedBytes)
            .digest("hex");
          if (
            fixedObject.error ||
            fixedObject.status !== 0 ||
            fixedStderr.trim() ||
            fixedBytes.length !== fixedRow.bytes ||
            fixedSha256 !== fixedRow.sha256
          ) {
            add(
              "error",
              "released-change-trace-fixed-identity-mismatch",
              relative(ledger),
              `${id}: recorded Commit, Path, byte count, and SHA-256 do not resolve to one exact blob.`,
            );
          }
          const currentObject = spawnSync(
            "git",
            ["-C", root, "show", `${headStart}:${currentRelativePath}`],
            {
              encoding: null,
              windowsHide: true,
              timeout: 5_000,
              maxBuffer: 16 * 1_048_576,
            },
          );
          const currentBytes = Buffer.isBuffer(currentObject.stdout)
            ? currentObject.stdout
            : Buffer.alloc(0);
          const currentStderr = Buffer.isBuffer(currentObject.stderr)
            ? currentObject.stderr.toString("utf8")
            : (currentObject.stderr ?? "");
          const currentSha256 = createHash("sha256")
            .update(currentBytes)
            .digest("hex");
          const worktreeDifference = spawnSync(
            "git",
            [
              "-C",
              root,
              "diff",
              "--quiet",
              headStart,
              "--",
              currentRelativePath,
            ],
            {
              encoding: "utf8",
              windowsHide: true,
              timeout: 5_000,
              maxBuffer: 1_048_576,
            },
          );
          const migration = navigationMigrations.get(currentRelativePath);
          let navigationMatches = false;
          if (migration) {
            appliedNavigationSources.add(currentRelativePath);
            let expectedText = fixedBytes.toString("utf8");
            let hasExactReplacements =
              migration.sourceSha256 === fixedRow.sha256;
            for (const replacement of migration.replacements) {
              if (
                expectedText.split(replacement.before).length - 1 !==
                replacement.count
              )
                hasExactReplacements = false;
              expectedText = expectedText.replaceAll(
                replacement.before,
                replacement.after,
              );
            }
            if (
              pathContainsSymbolicLink(currentFile) ||
              lstatIfPresent(currentFile)?.isFile() !== true
            ) {
              add(
                "error",
                "released-change-trace-content-changed",
                currentRelativePath,
                "Current released source is not a regular file inside the verified boundary.",
              );
              continue;
            }
            const worktreeText = fs.readFileSync(currentFile, "utf8");
            const normalizeLineEndings = (value: string) =>
              value.replaceAll("\r\n", "\n");
            navigationMatches =
              hasExactReplacements &&
              !pathContainsSymbolicLink(currentFile) &&
              lstatIfPresent(currentFile)?.isFile() === true &&
              (currentBytes.equals(fixedBytes) ||
                currentBytes.equals(Buffer.from(expectedText, "utf8"))) &&
              normalizeLineEndings(worktreeText) ===
                normalizeLineEndings(expectedText);
          }
          if (
            currentObject.error ||
            currentObject.status !== 0 ||
            currentStderr.trim() ||
            (migration
              ? !navigationMatches
              : currentBytes.length !== fixedRow.bytes ||
                currentSha256 !== fixedRow.sha256 ||
                worktreeDifference.error ||
                worktreeDifference.status !== 0)
          ) {
            add(
              "error",
              "released-change-trace-content-changed",
              currentRelativePath,
              `${id}: current bytes do not match the fixed released-history identity.`,
            );
          }
        }
      }
    }
  } else {
    add(
      "error",
      "change-trace-tag-inspection-failed",
      relative(ledger),
      "Could not enumerate repository tags for the official consolidation ledger.",
    );
  }

  const historicalReferenceMatches = [
    ...text.matchAll(
      /^\| `(90_Release\/Changes\/Evidence\/[^`]+\.md)` \| `(90_Release\/Changes\/CHG-[0-9]{6}_[A-Za-z0-9_]+\.md)` \|$/gmu,
    ),
  ];
  const historicalReferenceRows = historicalReferenceMatches.map((match) => ({
    source: match[1],
    target: match[2],
  }));
  validateMachineTable(
    "不変・非active歴史参照固定集合",
    "| Source Evidence | Target Old Path |",
    "|---|---|",
    /^\| `90_Release\/Changes\/Evidence\/[^`]+\.md` \| `90_Release\/Changes\/CHG-[0-9]{6}_[A-Za-z0-9_]+\.md` \|$/u,
    historicalReferenceMatches.length,
    "invalid-historical-reference-table-schema",
  );
  const historicalRowKeys = new Set(
    historicalReferenceRows.map((row) => `${row.source}\0${row.target}`),
  );
  const historicalSources = new Set(
    historicalReferenceRows.map((row) => row.source),
  );
  const historicalTargets = new Set(
    historicalReferenceRows.map((row) => row.target),
  );
  const historicalReferencePhysicalTargets = new Set(
    [...historicalTargets]
      .map((target) => path.join(root, ...target.split("/")))
      .filter((target) => lstatIfPresent(target))
      .map((target) => path.resolve(target)),
  );
  const indexedPaths = new Set(
    (indexEntries.stdout ?? "")
      .split("\0")
      .map((entry) => entry.match(/^[0-9]{6} [0-9a-f]{40} [0-3]\t(.+)$/u)?.[1])
      .filter((indexedPath): indexedPath is string => Boolean(indexedPath)),
  );
  const historicalReferenceIndexedTargets = new Set(
    [...historicalTargets]
      .filter((target) => indexedPaths.has(target))
      .map((target) => path.resolve(path.join(root, ...target.split("/")))),
  );
  const historicalReferenceSummary = text.match(
    /^- 不変・非active歴史参照固定集合:\s*([0-9]+) pair、([0-9]+) source、([0-9]+) target\s*$/mu,
  );
  const expectedHistoricalPairs = Number.parseInt(
    historicalReferenceSummary?.[1] ?? "-1",
    10,
  );
  const expectedHistoricalSources = Number.parseInt(
    historicalReferenceSummary?.[2] ?? "-1",
    10,
  );
  const expectedHistoricalTargets = Number.parseInt(
    historicalReferenceSummary?.[3] ?? "-1",
    10,
  );
  if (
    !historicalReferenceSummary ||
    historicalReferenceRows.length !== expectedHistoricalPairs ||
    historicalRowKeys.size !== expectedHistoricalPairs ||
    historicalSources.size !== expectedHistoricalSources ||
    historicalTargets.size !== expectedHistoricalTargets
  ) {
    add(
      "error",
      "invalid-historical-reference-set",
      relative(ledger),
      `Expected ${expectedHistoricalPairs} exact pairs / ${expectedHistoricalSources} sources / ${expectedHistoricalTargets} targets, observed ${historicalRowKeys.size} / ${historicalSources.size} / ${historicalTargets.size}.`,
    );
  }
  const historicalReferenceCandidates = new Set(
    historicalReferenceRows.map((row) =>
      historicalReferenceKey(
        path.join(root, ...row.source.split("/")),
        path.join(root, ...row.target.split("/")),
      ),
    ),
  );
  const verifiedHistoricalPairs = new Set<string>();
  const historicalSourceStartStates = new Map<
    string,
    Readonly<{
      bytes: Buffer;
      dev: number;
      ino: number;
      mode: number;
      size: number;
    }>
  >();
  const countExactHistoricalLinks = (
    sourceBytes: Buffer,
    sourceAbsolute: string,
    targetAbsolute: string,
  ): number =>
    [
      ...withoutFencedCode(sourceBytes.toString("utf8")).matchAll(
        /(?<!!)\[[^\]]+\]\(([^)]+)\)/g,
      ),
    ].filter((link) => {
      const resolution = resolveLocalTarget(sourceAbsolute, link[1]);
      return (
        !resolution.external &&
        !resolution.anchor &&
        !resolution.decodeError &&
        !resolution.outsideRoot &&
        samePath(resolution.target, targetAbsolute)
      );
    }).length;
  for (const row of historicalReferenceRows) {
    const sourceAbsolute = path.join(root, ...row.source.split("/"));
    const targetAbsolute = path.join(root, ...row.target.split("/"));
    const targetEntry = entries.find(
      (entry) => entry.originalPath === row.target,
    );
    const sourceStat = lstatIfPresent(sourceAbsolute);
    const isPathSetCanonical = [row.source, row.target].every(
      (candidate) =>
        !candidate.includes("\\") &&
        !candidate.includes("..") &&
        !candidate.includes(":") &&
        !candidate.includes("?") &&
        !candidate.includes("#") &&
        !path.isAbsolute(candidate) &&
        relative(path.join(root, ...candidate.split("/"))) === candidate,
    );
    if (
      !isPathSetCanonical ||
      !targetEntry?.evidencePaths.includes(row.source) ||
      !sourceStat?.isFile() ||
      sourceStat.isSymbolicLink() ||
      pathContainsSymbolicLink(sourceAbsolute) ||
      !allFiles.some((file) => samePath(file, sourceAbsolute)) ||
      lstatIfPresent(targetAbsolute)
    ) {
      add(
        "error",
        "invalid-historical-reference-pair",
        relative(ledger),
        `${row.source} -> ${row.target}: pair paths, related Evidence ownership, source identity, or missing target state are invalid.`,
      );
      continue;
    }
    const baseSource = spawnSync(
      "git",
      ["-C", root, "show", `${integrationBaseCommit}:${row.source}`],
      {
        encoding: null,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 16 * 1_048_576,
        env: gitEnvironment,
      },
    );
    const headSource = spawnSync(
      "git",
      ["-C", root, "show", `${headStart}:${row.source}`],
      {
        encoding: null,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 16 * 1_048_576,
        env: gitEnvironment,
      },
    );
    let worktreeBytes = Buffer.alloc(0);
    let worktreeReadFailed = false;
    try {
      worktreeBytes = fs.readFileSync(sourceAbsolute);
    } catch {
      worktreeReadFailed = true;
    }
    const baseBytes = Buffer.isBuffer(baseSource.stdout)
      ? baseSource.stdout
      : Buffer.alloc(0);
    const headBytes = Buffer.isBuffer(headSource.stdout)
      ? headSource.stdout
      : Buffer.alloc(0);
    const baseError = Buffer.isBuffer(baseSource.stderr)
      ? baseSource.stderr.toString("utf8")
      : (baseSource.stderr ?? "");
    const headError = Buffer.isBuffer(headSource.stderr)
      ? headSource.stderr.toString("utf8")
      : (headSource.stderr ?? "");
    const baseLinkCount = countExactHistoricalLinks(
      baseBytes,
      sourceAbsolute,
      targetAbsolute,
    );
    const worktreeLinkCount = countExactHistoricalLinks(
      worktreeBytes,
      sourceAbsolute,
      targetAbsolute,
    );
    if (
      baseSource.error ||
      baseSource.status !== 0 ||
      baseError.trim() ||
      headSource.error ||
      headSource.status !== 0 ||
      headError.trim() ||
      !baseBytes.equals(headBytes) ||
      worktreeReadFailed ||
      !baseBytes.equals(worktreeBytes) ||
      baseLinkCount !== 1 ||
      worktreeLinkCount !== 1
    ) {
      add(
        "error",
        "historical-reference-identity-mismatch",
        relative(ledger),
        `${row.source} -> ${row.target}: base/HEAD/worktree identity or exact Markdown link occurrence does not match.`,
      );
      continue;
    }
    historicalSourceStartStates.set(row.source, {
      bytes: worktreeBytes,
      dev: sourceStat.dev,
      ino: sourceStat.ino,
      mode: sourceStat.mode,
      size: sourceStat.size,
    });
    verifiedHistoricalPairs.add(
      historicalReferenceKey(sourceAbsolute, targetAbsolute),
    );
  }

  const headEndResult = gitText(["rev-parse", "--verify", "HEAD^{commit}"]);
  const tagsEndResult = gitText([
    "for-each-ref",
    "--sort=refname",
    "--format=%(refname:short)|%(objectname)|%(objecttype)|%(*objectname)|%(*objecttype)",
    "refs/tags",
  ]);
  let ledgerEndBytes = Buffer.alloc(0);
  let ledgerEndStat: fs.Stats | null = null;
  let ledgerEndReadFailed = false;
  try {
    ledgerEndStat = fs.lstatSync(ledger);
    ledgerEndBytes = fs.readFileSync(ledger);
  } catch {
    ledgerEndReadFailed = true;
  }
  const indexEndResult = gitText(["ls-files", "--stage", "-z"]);
  const collectReservedPhysicalEntries = (directory: string): string[] => {
    const observedPaths: string[] = [];
    const visit = (currentDirectory: string): void => {
      if (!lstatIfPresent(currentDirectory)?.isDirectory()) return;
      for (const entry of fs.readdirSync(currentDirectory, {
        withFileTypes: true,
      })) {
        const candidate = path.join(currentDirectory, entry.name);
        const filenameMatch = entry.name.match(reservedIdPattern);
        if (
          filenameMatch &&
          oldIds.has(`CHG-${filenameMatch[1]}`) &&
          !isEvidenceFile(candidate)
        ) {
          observedPaths.push(relative(candidate).toLocaleLowerCase("en-US"));
        }
        if (entry.isDirectory() && !entry.isSymbolicLink()) visit(candidate);
      }
    };
    visit(directory);
    return observedPaths.sort();
  };
  const endingReservedPhysicalEntries = releaseRoots
    .flatMap((releaseRoot) =>
      collectReservedPhysicalEntries(path.join(releaseRoot, "Changes")),
    )
    .sort();
  const didSourceChangeDuringCheck = [...historicalSourceStartStates].some(
    ([source, startState]) => {
      const sourceAbsolute = path.join(root, ...source.split("/"));
      try {
        const endStat = fs.lstatSync(sourceAbsolute);
        const endBytes = fs.readFileSync(sourceAbsolute);
        return (
          !endStat.isFile() ||
          endStat.isSymbolicLink() ||
          pathContainsSymbolicLink(sourceAbsolute) ||
          endStat.dev !== startState.dev ||
          endStat.ino !== startState.ino ||
          endStat.mode !== startState.mode ||
          endStat.size !== startState.size ||
          !endBytes.equals(startState.bytes)
        );
      } catch {
        return true;
      }
    },
  );
  if (
    headEndResult.error ||
    headEndResult.status !== 0 ||
    (headEndResult.stderr ?? "").trim() ||
    (headEndResult.stdout ?? "").trim() !== headStart ||
    tagsEndResult.error ||
    tagsEndResult.status !== 0 ||
    (tagsEndResult.stderr ?? "").trim() ||
    (tagsEndResult.stdout ?? "").replaceAll("\r\n", "\n").trim() !==
      tagsStart ||
    ledgerEndReadFailed ||
    !ledgerEndStat?.isFile() ||
    ledgerEndStat.isSymbolicLink() ||
    pathContainsSymbolicLink(ledger) ||
    ledgerEndStat.dev !== ledgerStat.dev ||
    ledgerEndStat.ino !== ledgerStat.ino ||
    ledgerEndStat.mode !== ledgerStat.mode ||
    ledgerEndStat.size !== ledgerStat.size ||
    !ledgerEndBytes.equals(ledgerStartBytes) ||
    indexEndResult.error ||
    indexEndResult.status !== 0 ||
    (indexEndResult.stderr ?? "").trim() ||
    (indexEndResult.stdout ?? "") !== (indexEntries.stdout ?? "") ||
    endingReservedPhysicalEntries.join("\0") !==
      [...reservedPhysicalEntriesStart].sort().join("\0") ||
    didSourceChangeDuringCheck
  ) {
    add(
      "error",
      "change-trace-ledger-snapshot-changed",
      relative(ledger),
      "HEAD, tag refs, Git index, ledger bytes, reserved old-Path entries, or fixed Evidence changed during the check; all historical-reference results are invalid.",
    );
  }

  if (appliedNavigationSources.size !== navigationMigrations.size) {
    add(
      "error",
      "invalid-released-navigation-migration",
      relative(ledger),
      "Navigation migration source is outside verified fixed released history.",
    );
  }
  const finalErrorCount = findings.filter(
    (finding) => finding.severity === "error",
  ).length;
  if (
    finalErrorCount !== initialErrorCount ||
    verifiedHistoricalPairs.size !== expectedHistoricalPairs
  ) {
    return {
      historicalReferenceCandidates,
      historicalReferencePairs: new Set<string>(),
      historicalReferencePhysicalTargets,
      historicalReferenceIndexedTargets,
      historicalReferenceSources: historicalSources.size,
      historicalReferenceTargets: historicalTargets.size,
    };
  }
  return {
    historicalReferenceCandidates,
    historicalReferencePairs: verifiedHistoricalPairs,
    historicalReferencePhysicalTargets,
    historicalReferenceIndexedTargets,
    historicalReferenceSources: historicalSources.size,
    historicalReferenceTargets: historicalTargets.size,
  };
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
  const gitRootResult = spawnSync(
    "git",
    ["-C", root, "rev-parse", "--show-toplevel"],
    { encoding: "utf8" },
  );
  let gitFailure: string | null = null;
  if (errorCode(gitRootResult.error) === "ENOENT") {
    gitFailure = "not-installed";
  } else if (
    gitRootResult.status !== 0 &&
    /not a git repository/iu.test(gitRootResult.stderr || "")
  ) {
    gitFailure = "not-repository";
  } else if (gitRootResult.status !== 0) {
    gitFailure = "repository-check-failed";
  }
  if (gitRootResult.status === 0) {
    const gitRoot = path.resolve(gitRootResult.stdout.trim());
    const relativeRoot = path.relative(gitRoot, root) || ".";
    const list = spawnSync(
      "git",
      [
        "-C",
        gitRoot,
        "ls-files",
        "--cached",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        relativeRoot,
      ],
      { encoding: "utf8" },
    );
    if (list.status === 0) {
      const staged = spawnSync(
        "git",
        ["-C", gitRoot, "ls-files", "--stage", "-z", "--", relativeRoot],
        { encoding: "utf8" },
      );
      let isStagedOutputValid = staged.status === 0;
      const parsedGitlinkEntries: GitlinkEntry[] = [];
      const conflictedGitlinkRoots = new Set<string>();
      if (staged.status === 0) {
        for (const entry of staged.stdout.split("\0").filter(Boolean)) {
          const separator = entry.indexOf("\t");
          const metadata =
            separator < 0
              ? null
              : entry
                  .slice(0, separator)
                  .match(/^(\d{6}) ([0-9a-f]{40,64}) ([0-3])$/iu);
          if (!metadata) {
            isStagedOutputValid = false;
            break;
          }
          const [, mode, oid, stageNumber] = metadata;
          if (mode !== "160000") continue;
          const target = path.resolve(gitRoot, entry.slice(separator + 1));
          if (!isWithin(root, target)) continue;
          if (stageNumber !== "0") {
            conflictedGitlinkRoots.add(target);
            continue;
          }
          parsedGitlinkEntries.push({
            path: target,
            oid: oid.toLowerCase(),
          });
        }
      }
      const gitlinkEntries = isStagedOutputValid
        ? parsedGitlinkEntries.sort((a, b) => a.path.localeCompare(b.path))
        : [];
      const conflictedGitlinks = isStagedOutputValid
        ? [...conflictedGitlinkRoots].sort()
        : [];
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
      const baselineTopLevel =
        isBaselineWorktreePresent === true
          ? spawnSync(
              "git",
              ["-C", baselineCandidateRoot, "rev-parse", "--show-toplevel"],
              { encoding: "utf8" },
            )
          : null;
      const isBaselineOwnRepository =
        baselineTopLevel?.status === 0 &&
        samePath(baselineTopLevel.stdout.trim(), baselineCandidateRoot);
      const baselineGitDirectory = isBaselineOwnRepository
        ? spawnSync(
            "git",
            ["-C", baselineCandidateRoot, "rev-parse", "--absolute-git-dir"],
            { encoding: "utf8" },
          )
        : null;
      const baselineHead = isBaselineOwnRepository
        ? spawnSync(
            "git",
            ["-C", baselineCandidateRoot, "rev-parse", "--verify", "HEAD"],
            { encoding: "utf8" },
          )
        : null;
      const isBaselineGitDirectoryAccessible =
        isBaselineOwnRepository && baselineGitDirectory?.status === 0;
      const isBaselineHeadReadable =
        isBaselineOwnRepository &&
        baselineHead?.status === 0 &&
        /^[0-9a-f]{40,64}$/iu.test(baselineHead.stdout.trim());
      const baselineHeadOid = isBaselineHeadReadable
        ? baselineHead.stdout.trim().toLowerCase()
        : null;
      const baselineGitlinkOid = baselineGitlink?.oid?.toLowerCase() ?? null;
      const isBaselineHeadMatchingGitlink =
        isBaselineHeadReadable && baselineGitlinkOid
          ? baselineHeadOid === baselineGitlinkOid
          : null;
      const isBaselineSubmoduleInitialized = !isBaselineSubmodule
        ? null
        : isBaselineGitlinkIndexed === true &&
            isBaselineWorktreePresent === false
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
      const files = list.stdout
        .split("\0")
        .filter(Boolean)
        .map((item) => path.resolve(gitRoot, item))
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
          ...(staged.status === 0
            ? gitlinks.map(
                (item) => `Gitlink submodule boundary: ${relative(item)}`,
              )
            : ["Gitlink detection unavailable: Git index modes were not read"]),
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
    gitFailure = "list-failed";
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

type ToolLayoutHistoricalReferences = Readonly<{
  pairs: ReadonlySet<string>;
  candidatePairs: ReadonlySet<string>;
  physicalTargets: ReadonlySet<string>;
  indexedTargets: ReadonlySet<string>;
  sources: number;
  targets: number;
}>;

function toolLayoutHistoricalKey(
  source: string,
  target: string,
  anchor: string | null,
): string {
  return `${historicalReferenceKey(source, target)}\0${anchor ?? ""}`;
}

function checkToolLayoutHistoricalReferences(
  files: readonly string[],
): ToolLayoutHistoricalReferences {
  const empty = {
    pairs: new Set<string>(),
    candidatePairs: new Set<string>(),
    physicalTargets: new Set<string>(),
    indexedTargets: new Set<string>(),
    sources: 0,
    targets: 0,
  };
  if (repositoryMode !== "official") return empty;
  const ledgerPath = path.join(
    root,
    "90_Release/Changes/CHG-000017_Tools_Coding_Standards.md",
  );
  if (!fs.existsSync(ledgerPath)) return empty;
  const fileSet = new Set(files.map((file) => path.resolve(file)));
  const isRegularFile = (file: string): boolean =>
    fileSet.has(path.resolve(file)) &&
    lstatIfPresent(file)?.isFile() === true &&
    !pathContainsSymbolicLink(file);
  const reject = (reason: string): ToolLayoutHistoricalReferences => {
    add(
      "error",
      "invalid-tool-layout-historical-references",
      relative(ledgerPath),
      reason,
    );
    return empty;
  };
  if (!isRegularFile(ledgerPath))
    return reject("Ledger is not a discovered regular file.");
  const content = read(ledgerPath);
  const marker = "<!-- crdd-tool-layout-historical-references: 1 -->";
  if (!content.includes(marker)) return empty;
  const blocks = [
    ...content.matchAll(
      /<!-- crdd-tool-layout-historical-references: 1 -->\s*```json\s*\n([\s\S]*?)\n```/gu,
    ),
  ];
  if (
    content.split(marker).length !== 2 ||
    blocks.length !== 1 ||
    blocks[0][1].length > 131_072
  ) {
    return reject("Expected one bounded historical-reference record.");
  }
  const isObject = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const hasKeys = (
    value: Record<string, unknown>,
    keys: readonly string[],
  ): boolean =>
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key));
  const isHash = (value: unknown): value is string =>
    typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
  const isOid = (value: unknown): value is string =>
    typeof value === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value);
  const isRelativePath = (value: unknown): value is string =>
    typeof value === "string" &&
    value.length <= 512 &&
    /^[A-Za-z0-9_./-]+$/u.test(value) &&
    !value.startsWith("/") &&
    value
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..");
  let record: unknown;
  try {
    record = JSON.parse(blocks[0][1]);
  } catch {
    return reject("Invalid record JSON.");
  }
  if (
    !isObject(record) ||
    !hasKeys(record, ["schemaRevision", "evidenceCommit", "references"]) ||
    record.schemaRevision !== 1 ||
    !isOid(record.evidenceCommit) ||
    !Array.isArray(record.references) ||
    record.references.length < 1 ||
    record.references.length > 64
  ) {
    return reject("Invalid record shape.");
  }
  const git = (args: readonly string[]) =>
    spawnSync("git", ["-C", root, ...args], {
      windowsHide: true,
      timeout: 10_000,
      maxBuffer: 16 * 1_048_576,
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: "1" },
    });
  const head = git(["rev-parse", "--verify", "HEAD^{commit}"]);
  if (head.status !== 0) return reject("Repository HEAD unavailable.");
  const headOid = head.stdout.toString("utf8").trim();
  const initialIndex = git(["ls-files", "--stage", "-z"]);
  if (initialIndex.status !== 0) return reject("Repository index unavailable.");
  const indexedPaths = new Set(
    initialIndex.stdout
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .map((line) => path.resolve(root, line.slice(line.indexOf("\t") + 1))),
  );
  const verifiedCommits = new Set<string>();
  const isHistoricalCommit = (commit: string): boolean => {
    if (verifiedCommits.has(commit)) return true;
    const resolved = git(["rev-parse", "--verify", `${commit}^{commit}`]);
    if (
      resolved.status !== 0 ||
      resolved.stdout.toString("utf8").trim() !== commit ||
      git(["merge-base", "--is-ancestor", commit, headOid]).status !== 0
    )
      return false;
    verifiedCommits.add(commit);
    return true;
  };
  if (!isHistoricalCommit(record.evidenceCommit))
    return reject("Evidence commit is unavailable or outside HEAD history.");
  const sha256 = (bytes: Uint8Array): string =>
    createHash("sha256").update(bytes).digest("hex");
  const pairs = new Set<string>();
  const sources = new Set<string>();
  const targets = new Set<string>();
  const physicalTargets = new Set<string>();
  const indexedTargets = new Set<string>();
  const sourceSnapshots = new Map<string, string>();
  const successorSnapshots = new Map<string, fs.Stats>();
  for (const entry of record.references) {
    if (
      !isObject(entry) ||
      !hasKeys(entry, [
        "sourcePath",
        "sourceSha256",
        "targetPath",
        "targetCommit",
        "targetBlobOid",
        "targetSha256",
        "successorPath",
        "anchor",
      ]) ||
      !isRelativePath(entry.sourcePath) ||
      !entry.sourcePath.startsWith("90_Release/Changes/Evidence/") ||
      !entry.sourcePath.endsWith(".md") ||
      !isRelativePath(entry.targetPath) ||
      !entry.targetPath.startsWith("tools/") ||
      !isRelativePath(entry.successorPath) ||
      !/^(?:40_Develop|06_Architecture)\//u.test(entry.successorPath) ||
      !isHash(entry.sourceSha256) ||
      !isHash(entry.targetSha256) ||
      !isOid(entry.targetCommit) ||
      !isOid(entry.targetBlobOid) ||
      !(
        entry.anchor === null ||
        (typeof entry.anchor === "string" &&
          entry.anchor.length > 0 &&
          entry.anchor.length <= 256 &&
          !/[\u0000-\u001f\u007f]/u.test(entry.anchor))
      )
    ) {
      return reject("Invalid reference entry.");
    }
    const source = path.join(root, entry.sourcePath);
    const target = path.join(root, entry.targetPath);
    const successor = path.join(root, entry.successorPath);
    const key = toolLayoutHistoricalKey(source, target, entry.anchor);
    if (
      pairs.has(key) ||
      !isRegularFile(source) ||
      !isRegularFile(successor) ||
      !isHistoricalCommit(entry.targetCommit)
    ) {
      return reject(
        "Duplicate reference, unsafe file boundary, or unavailable target commit.",
      );
    }
    const sourceBytes = fs.readFileSync(source);
    const historicalSource = git([
      "show",
      `${record.evidenceCommit}:${entry.sourcePath}`,
    ]);
    const targetObject = git([
      "rev-parse",
      "--verify",
      `${entry.targetCommit}:${entry.targetPath}`,
    ]);
    const targetType = git(["cat-file", "-t", entry.targetBlobOid]);
    const historicalTarget = git([
      "show",
      `${entry.targetCommit}:${entry.targetPath}`,
    ]);
    if (
      sha256(sourceBytes) !== entry.sourceSha256 ||
      historicalSource.status !== 0 ||
      sha256(historicalSource.stdout) !== entry.sourceSha256 ||
      targetObject.status !== 0 ||
      targetObject.stdout.toString("utf8").trim() !== entry.targetBlobOid ||
      targetType.status !== 0 ||
      targetType.stdout.toString("utf8").trim() !== "blob" ||
      historicalTarget.status !== 0 ||
      sha256(historicalTarget.stdout) !== entry.targetSha256
    ) {
      return reject("Historical source or target identity does not match.");
    }
    if (
      !linkRecords.some(
        (link) =>
          !link.external &&
          samePath(link.source, source) &&
          samePath(link.target, target) &&
          (link.anchor || null) === entry.anchor &&
          !link.decodeError &&
          !link.outsideRoot,
      ) ||
      (entry.anchor !== null &&
        (!entry.targetPath.endsWith(".md") ||
          !anchorsForText(historicalTarget.stdout.toString("utf8")).has(
            entry.anchor,
          )))
    ) {
      return reject("Reference pair or historical anchor does not match.");
    }
    pairs.add(key);
    sources.add(source);
    targets.add(target);
    if (lstatIfPresent(target) !== null || pathContainsSymbolicLink(target))
      physicalTargets.add(path.resolve(target));
    if (indexedPaths.has(path.resolve(target)))
      indexedTargets.add(path.resolve(target));
    sourceSnapshots.set(source, entry.sourceSha256);
    successorSnapshots.set(successor, fs.lstatSync(successor));
  }
  for (const [source, expectedHash] of sourceSnapshots) {
    if (
      !isRegularFile(source) ||
      sha256(fs.readFileSync(source)) !== expectedHash
    )
      return reject("Historical source changed during verification.");
  }
  for (const [successor, before] of successorSnapshots) {
    const after = lstatIfPresent(successor);
    if (
      !isRegularFile(successor) ||
      !after ||
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    )
      return reject("Successor changed during verification.");
  }
  for (const target of targets) {
    const isPhysicalTargetPresent =
      lstatIfPresent(target) !== null || pathContainsSymbolicLink(target);
    if (isPhysicalTargetPresent !== physicalTargets.has(path.resolve(target)))
      return reject("Historical target presence changed during verification.");
  }
  if (
    !isRegularFile(ledgerPath) ||
    fs.readFileSync(ledgerPath, "utf8") !== content
  )
    return reject("Historical-reference record changed during verification.");
  const finalHead = git(["rev-parse", "--verify", "HEAD^{commit}"]);
  const finalIndex = git(["ls-files", "--stage", "-z"]);
  if (
    finalHead.status !== 0 ||
    finalHead.stdout.toString("utf8").trim() !== headOid ||
    finalIndex.status !== 0 ||
    !finalIndex.stdout.equals(initialIndex.stdout)
  )
    return reject("Repository HEAD or index changed during verification.");
  const hasCurrentTargets = physicalTargets.size > 0 || indexedTargets.size > 0;
  if (hasCurrentTargets)
    add(
      "error",
      "invalid-tool-layout-historical-references",
      relative(ledgerPath),
      "Historical targets remain in the worktree or Git index.",
    );
  return {
    pairs: hasCurrentTargets ? new Set<string>() : pairs,
    candidatePairs: pairs,
    physicalTargets,
    indexedTargets,
    sources: sources.size,
    targets: targets.size,
  };
}

function withoutFencedCode(text: string): string {
  let isFenced = false;
  return text
    .split(/\r?\n/u)
    .map((line) => {
      if (/^\s*```/u.test(line)) {
        isFenced = !isFenced;
        return "";
      }
      return isFenced ? "" : line;
    })
    .join("\n");
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

const discovery = discoverProjectFiles();
if (discovery.baseline_submodule && repositoryMode !== "adopter") {
  repositoryMode = "adopter";
  adoptedBaselineRoot = baselineCandidateRoot;
  releaseRoots = [path.join(root, "90_Release")];
  recognizedChangeTracePatterns = ["90_Release/**/Changes/**/CHG-*.md"];
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
const linkRecords: LinkRecord[] = [];
for (const source of allMarkdownFiles) {
  const text = withoutFencedCode(read(source));
  for (const match of text.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)) {
    const raw = match[1];
    linkRecords.push({ source, raw, ...resolveLocalTarget(source, raw) });
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
const consolidationLedgerCheck = checkConsolidatedChangeTraceLedger(allFiles);
const toolLayoutHistoricalReferences =
  checkToolLayoutHistoricalReferences(allFiles);
let checkedLocalLinks = 0;
let checkedAnchors = 0;
let historicalReferencesObserved = 0;
let historicalReferencesVerified = 0;
let historicalReferencesActive = 0;
let historicalReferencesIndexed = 0;
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
  const historicalKey = historicalReferenceKey(source, target);
  const isToolLayoutHistoricalReference =
    toolLayoutHistoricalReferences.pairs.has(
      toolLayoutHistoricalKey(source, target, anchor ?? null),
    );
  const isHistoricalReferenceCandidate =
    toolLayoutHistoricalReferences.candidatePairs.has(
      toolLayoutHistoricalKey(source, target, anchor ?? null),
    ) ||
    (!anchor &&
      consolidationLedgerCheck.historicalReferenceCandidates.has(
        historicalKey,
      ));
  if (isHistoricalReferenceCandidate) {
    historicalReferencesObserved += 1;
    if (
      consolidationLedgerCheck.historicalReferencePhysicalTargets.has(
        path.resolve(target),
      ) ||
      toolLayoutHistoricalReferences.physicalTargets.has(path.resolve(target))
    ) {
      historicalReferencesActive += 1;
    }
    if (
      consolidationLedgerCheck.historicalReferenceIndexedTargets.has(
        path.resolve(target),
      ) ||
      toolLayoutHistoricalReferences.indexedTargets.has(path.resolve(target))
    ) {
      historicalReferencesIndexed += 1;
    }
  }
  if (record.symbolicBoundary) {
    add("warning", "symbolic-link-target", relative(source), raw);
    uncheckedItems.add(`Symbolic link target from ${relative(source)}: ${raw}`);
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
    if (
      isToolLayoutHistoricalReference ||
      (!anchor &&
        consolidationLedgerCheck.historicalReferencePairs.has(historicalKey))
    ) {
      historicalReferencesVerified += 1;
      continue;
    }
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
    const content = read(file);
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
const readme = path.join(root, "README.md");
if (
  lstatIfPresent(readme)?.isFile() &&
  !pathContainsSymbolicLink(readme) &&
  versions.size === 1 &&
  repositoryMode === "official"
) {
  const match = read(readme).match(/^Status:\s*\*\*(v[0-9]\S*)/m);
  const expectedVersion = versions.values().next().value;
  if (match && match[1] !== expectedVersion) {
    add(
      "error",
      "readme-version-mismatch",
      "README.md",
      `README=${match[1]}, canonical=${expectedVersion}`,
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
  const markdown = (() => {
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
  })();
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
      [/^\s*[-*+]\s+Not required:/u, "Not required"],
      [/^\s*[-*+]\s+Rollback \/ recovery:/u, "Rollback / recovery"],
      [/^\s*[-*+]\s+Known risk if deferred:/u, "Known risk if deferred"],
      [/^\s*[-*+]\s+Verification:/u, "Verification"],
      [/^\s*[-*+]\s+Known limitation:/u, "Known limitation"],
    ],
    日本語: [
      [/^\s*[-*+]\s+(?:[^:]+で)?必須:/u, "必須"],
      [/^\s*[-*+]\s+条件付き(?:[^:]*)?:/u, "条件付き"],
      [/^\s*[-*+]\s+不要:/u, "不要"],
      [/^\s*[-*+]\s+復旧:/u, "復旧"],
      [/^\s*[-*+]\s+延期時の既知リスク:/u, "延期時の既知リスク"],
      [/^\s*[-*+]\s+検証:/u, "検証"],
      [/^\s*[-*+]\s+既知の制限:/u, "既知の制限"],
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
        .filter(([pattern]) => !sectionLines.some((line) => pattern.test(line)))
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
    if (!changeTraceRootFor(file)) {
      add(
        "error",
        "change-trace-placement",
        relative(file),
        `The checker cannot recognize this Change Trace path in repository mode ${repositoryMode}. ` +
          `Recognized inspection paths: ${recognizedChangeTracePatterns.join(", ")}.`,
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
    "90_Release",
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
  for (const name of ["07_Workflows", "08_Workflows", "08_Quality"]) {
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
    "explicit stable ID definition uniqueness",
    "Change Trace inspection-path recognition (not canonical placement validation)",
    "unreleased Change Trace consolidation ledger identity and reservation",
    "immutable non-active historical reference identity and Git snapshot",
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
    historical_references_observed: historicalReferencesObserved,
    historical_references_identity_verified: historicalReferencesVerified,
    historical_references_active: historicalReferencesActive,
    historical_references_indexed: historicalReferencesIndexed,
    historical_reference_sources:
      consolidationLedgerCheck.historicalReferenceSources +
      toolLayoutHistoricalReferences.sources,
    historical_reference_targets:
      consolidationLedgerCheck.historicalReferenceTargets +
      toolLayoutHistoricalReferences.targets,
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
      `Mode=${report.check_mode}; Markdown=${report.metrics.markdown_files_checked}/${report.metrics.markdown_files_discovered}; local links=${checkedLocalLinks}; immutable non-active historical references=${historicalReferencesVerified}/${historicalReferencesObserved} active=${historicalReferencesActive} indexed=${historicalReferencesIndexed}; anchors=${checkedAnchors}; stable IDs=${report.metrics.stable_ids_observed}; ${report.duration_ms} ms`,
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
