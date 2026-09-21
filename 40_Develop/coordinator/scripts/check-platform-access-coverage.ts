/**
 * check-platform-access-coverageに属する責務をまとめる。
 *
 * @responsibility executeCommandを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  assertCoverageRunRoot,
  createCoverageRunRoot,
} from "./platform-access-coverage-path.ts";

const TOOLCHAIN = "1.94.1-x86_64-pc-windows-msvc";
const TARGET = "x86_64-pc-windows-msvc";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const crateRoot = path.resolve(coordinatorRoot, "..", "platform-access");
const manifestPath = path.join(crateRoot, "Cargo.toml");
const coverageRunRoot = createCoverageRunRoot(crateRoot);
const { coverageRoot } = coverageRunRoot;
const buildRoot = path.join(coverageRoot, "build");
const rawProfilePattern = path.join(coverageRoot, "%p-%m.profraw");
const mergedProfile = path.join(coverageRoot, "coverage.profdata");
const summaryPath = path.join(coverageRoot, "coverage-summary.json");
const expectedSources = new Set(
  [
    path.join(crateRoot, "src", "main.rs"),
    path.join(crateRoot, "src", "protocol.rs"),
    path.join(crateRoot, "src", "windows.rs"),
    path.join(crateRoot, "src", "docker_repair.rs"),
    path.join(crateRoot, "tests", "cli.rs"),
  ].map(path.normalize),
);

/**
 * Commandを実行する。
 *
 * @responsibility Commandの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input command: string、commandArguments: readonly string[]、options
 * @returns executeCommandの計算結果を返す。
 * @precondition 「command: string、commandArguments: readonly string[]、options」がexecuteCommandの入力契約を満たす。
 * @postcondition executeCommandの責務を完了した結果だけを返す。
 * @effect executeCommandは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure executeCommandは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeCommandは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: executeCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: executeCommandは共有非同期状態を持たない同期処理である。
 */
function executeCommand(
  command: string,
  commandArguments: readonly string[],
  options = {},
) {
  const result = spawnSync(command, [...commandArguments], {
    cwd: coordinatorRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
    ...options,
  });
  if (result.error || result.status !== 0) {
    throw new Error(
      `${command} failed: ${result.error?.message ?? result.stderr ?? result.stdout}`,
    );
  }
  return result.stdout;
}

/**
 * Filesを収集する。
 *
 * @responsibility Filesの収集範囲、重複排除、欠落時の結果境界を所有する。
 * @trace ARCH-000004
 * @input root: string、suffix: string
 * @returns string[]を返す。
 * @precondition 「root: string、suffix: string」がcollectFilesの入力契約を満たす。
 * @postcondition collectFilesの責務を完了した結果だけを返す。
 * @effect collectFilesはFilesystemの読取りまたは書込みを実行する。
 * @failure collectFilesは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant collectFilesは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: collectFilesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: collectFilesは共有非同期状態を持たない同期処理である。
 */
function collectFiles(root: string, suffix: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`symbolic coverage entry: ${candidate}`);
    if (entry.isDirectory()) files.push(...collectFiles(candidate, suffix));
    else if (entry.isFile() && candidate.endsWith(suffix))
      files.push(candidate);
    else if (!entry.isFile())
      throw new Error(`unsupported coverage entry: ${candidate}`);
  }
  return files;
}

/**
 * llvm Toolを決定する。
 *
 * @responsibility llvm Toolの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input name: string
 * @returns stringを返す。
 * @precondition 「name: string」がllvmToolの入力契約を満たす。
 * @postcondition llvmToolの責務を完了した結果だけを返す。
 * @effect llvmToolはFilesystemの読取りまたは書込みを実行する。
 * @failure llvmToolは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant llvmToolは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: llvmToolはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: llvmToolは共有非同期状態を持たない同期処理である。
 */
function llvmTool(name: string): string {
  const targetLibrary = executeCommand("rustc", [
    `+${TOOLCHAIN}`,
    "--print",
    "target-libdir",
  ]).trim();
  const executable = path.resolve(targetLibrary, "..", "bin", `${name}.exe`);
  if (!fs.statSync(executable).isFile()) throw new Error(`${name} unavailable`);
  return executable;
}

assertCoverageRunRoot(coverageRunRoot);
executeCommand(
  "cargo",
  [
    `+${TOOLCHAIN}`,
    "test",
    "--manifest-path",
    manifestPath,
    "--locked",
    "--target",
    TARGET,
  ],
  {
    env: {
      ...process.env,
      CARGO_TARGET_DIR: buildRoot,
      LLVM_PROFILE_FILE: rawProfilePattern,
      RUSTFLAGS: "-C instrument-coverage",
    },
    stdio: ["ignore", "inherit", "inherit"],
  },
);
assertCoverageRunRoot(coverageRunRoot);

const rawProfiles = collectFiles(coverageRoot, ".profraw");
if (rawProfiles.length === 0) throw new Error("coverage profile missing");
executeCommand(llvmTool("llvm-profdata"), [
  "merge",
  "-sparse",
  ...rawProfiles,
  "-o",
  mergedProfile,
]);
const dependencyRoot = path.join(buildRoot, TARGET, "debug", "deps");
const testExecutables = collectFiles(dependencyRoot, ".exe").filter((file) =>
  /^(?:cli|crdd_platform_access)-[0-9a-f]+\.exe$/u.test(path.basename(file)),
);
if (testExecutables.length !== 2) {
  throw new Error(
    `expected two instrumented test executables, got ${testExecutables.length}`,
  );
}
const binaryExecutable = path.join(
  buildRoot,
  TARGET,
  "debug",
  "crdd-platform-access.exe",
);
if (!fs.statSync(binaryExecutable).isFile()) {
  throw new Error("instrumented platform-access binary missing");
}
const coverageObjects = [...testExecutables, binaryExecutable];
const firstCoverageObject = coverageObjects[0];
if (!firstCoverageObject) throw new Error("coverage object missing");
const exported = executeCommand(llvmTool("llvm-cov"), [
  "export",
  "--summary-only",
  "--instr-profile",
  mergedProfile,
  firstCoverageObject,
  ...coverageObjects.slice(1).flatMap((file) => ["--object", file]),
]);
const report: unknown = JSON.parse(exported);
if (!report || typeof report !== "object" || !("data" in report)) {
  throw new Error("invalid llvm-cov export");
}
const coverageDataEntries = (report as { data?: unknown }).data;
if (!Array.isArray(coverageDataEntries) || coverageDataEntries.length !== 1)
  throw new Error("invalid coverage data");
const files = (coverageDataEntries[0] as { files?: unknown }).files;
if (!Array.isArray(files)) throw new Error("coverage files missing");
const rawSourceCoverageEntries = files
  .map((entry) => {
    const candidate = entry as {
      filename?: unknown;
      summary?: Record<
        "branches" | "functions" | "lines" | "regions",
        { count?: unknown; covered?: unknown }
      >;
    };
    const filename =
      typeof candidate.filename === "string"
        ? path.normalize(candidate.filename)
        : "";
    if (!expectedSources.has(filename)) return null;
    const metric = (name: "functions" | "lines" | "regions") => {
      const count = candidate.summary?.[name]?.count;
      const covered = candidate.summary?.[name]?.covered;
      if (typeof count !== "number" || typeof covered !== "number") {
        throw new Error(`${name} coverage missing: ${filename}`);
      }
      return Object.freeze({ count, covered });
    };
    const branches = candidate.summary?.branches?.count;
    const coveredBranches = candidate.summary?.branches?.covered;
    if (typeof branches !== "number" || typeof coveredBranches !== "number") {
      throw new Error(`branch capability result missing: ${filename}`);
    }
    return Object.freeze({
      file: path.relative(crateRoot, filename).replaceAll("\\", "/"),
      regions: metric("regions"),
      functions: metric("functions"),
      lines: metric("lines"),
      branches: Object.freeze({ count: branches, covered: coveredBranches }),
    });
  })
  .filter((entry) => entry !== null);
const sourceCoverageEntries = [
  ...rawSourceCoverageEntries
    .reduce((entries, entry) => {
      const previous = entries.get(entry.file);
      if (!previous) {
        entries.set(entry.file, entry);
        return entries;
      }
      const sum = (name: "branches" | "functions" | "lines" | "regions") =>
        Object.freeze({
          count: previous[name].count + entry[name].count,
          covered: previous[name].covered + entry[name].covered,
        });
      entries.set(
        entry.file,
        Object.freeze({
          file: entry.file,
          regions: sum("regions"),
          functions: sum("functions"),
          lines: sum("lines"),
          branches: sum("branches"),
        }),
      );
      return entries;
    }, new Map<string, (typeof rawSourceCoverageEntries)[number]>())
    .values(),
];
if (
  sourceCoverageEntries.length !== expectedSources.size ||
  new Set(sourceCoverageEntries.map((entry) => entry.file)).size !==
    expectedSources.size
) {
  throw new Error("coverage source population mismatch");
}
const calculateCoverageTotal = (
  name: "branches" | "functions" | "lines" | "regions",
) => {
  const count = sourceCoverageEntries.reduce(
    (sum, entry) => sum + entry[name].count,
    0,
  );
  const covered = sourceCoverageEntries.reduce(
    (sum, entry) => sum + entry[name].covered,
    0,
  );
  if (count < 0 || covered < 0 || covered > count) {
    throw new Error(`invalid ${name} coverage totals`);
  }
  return Object.freeze({
    count,
    covered,
    percent: count === 0 ? null : Number(((covered / count) * 100).toFixed(2)),
  });
};
const totals = Object.freeze({
  regions: calculateCoverageTotal("regions"),
  functions: calculateCoverageTotal("functions"),
  lines: calculateCoverageTotal("lines"),
  branches: calculateCoverageTotal("branches"),
});
const summary = Object.freeze({
  toolchain: TOOLCHAIN,
  target: TARGET,
  sourceFiles: sourceCoverageEntries.sort((left, right) =>
    left.file.localeCompare(right.file),
  ),
  excludedSources: Object.freeze([]),
  totals,
  branchCoverageCapability:
    totals.branches.count === 0
      ? "not_available_in_fixed_stable_toolchain"
      : "available",
});
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
assertCoverageRunRoot(coverageRunRoot);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
