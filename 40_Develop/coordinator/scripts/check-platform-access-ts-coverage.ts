import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAXIMUM_LCOV_BYTES = 32 * 1024 * 1024;
// Node's V8 coverage counter is an execution count, not a bounded test-case
// count. Filesystem and parser loops can legitimately exceed one million while
// the LCOV payload remains bounded separately. Preserve the exact integer and
// reject only values JavaScript cannot represent without loss.
const MAXIMUM_COVERAGE_COUNT = Number.MAX_SAFE_INTEGER;
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");

export const PLATFORM_ACCESS_TS_COVERAGE_SOURCES = Object.freeze([
  "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
  "40_Develop/coordinator/scripts/release-staging-manifest.ts",
  "40_Develop/coordinator/scripts/release-manifest-promotion.ts",
  "40_Develop/coordinator/scripts/promote-release-manifest.ts",
  "40_Develop/coordinator/scripts/sign-release-manifest.ts",
  "40_Develop/coordinator/src/core/doctor.ts",
  "40_Develop/coordinator/src/security/authority-root-path-lexical.ts",
  "40_Develop/coordinator/src/security/bounded-file-snapshot.ts",
  "40_Develop/coordinator/src/security/platform-access-adapter.ts",
  "40_Develop/coordinator/src/security/platform-access-release.ts",
  "40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts",
  "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts",
  "40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts",
  "40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts",
  "40_Develop/coordinator/src/security/root-observation.ts",
]);

export const PLATFORM_ACCESS_TS_COVERAGE_TESTS = Object.freeze([
  "40_Develop/coordinator/tests/authority-root-path-lexical.contract.test.ts",
  "40_Develop/coordinator/tests/bounded-file-snapshot.contract.test.ts",
  "40_Develop/coordinator/tests/doctor.contract.test.ts",
  "40_Develop/coordinator/tests/platform-access-adapter.contract.test.ts",
  "40_Develop/coordinator/tests/platform-access-release.contract.test.ts",
  "40_Develop/coordinator/tests/platform-access-ts-coverage.contract.test.ts",
  "40_Develop/coordinator/tests/platform-provisioner-manifest-loader.contract.test.ts",
  "40_Develop/coordinator/tests/platform-provisioner-package-filesystem.contract.test.ts",
  "40_Develop/coordinator/tests/platform-provisioner-release-identity.contract.test.ts",
  "40_Develop/coordinator/tests/platform-provisioner-trust-core.contract.test.ts",
  "40_Develop/coordinator/tests/root-observation.contract.test.ts",
  "40_Develop/coordinator/tests/release-manifest-promotion.contract.test.ts",
  "40_Develop/coordinator/tests/sign-release-manifest.contract.test.ts",
]);

export const PLATFORM_ACCESS_TS_COVERAGE_NODE_OPTIONS = Object.freeze([
  "--experimental-test-coverage",
  "--test",
  "--test-concurrency=1",
  "--experimental-test-isolation=none",
  "--test-reporter=lcov",
]);

type Counter = Readonly<{ covered: number; total: number }>;
type Branch = Readonly<{
  line: number;
  block: number;
  branch: number;
  taken: number | null;
}>;
type SourceCoverage = Readonly<{
  source: string;
  lines: Counter;
  functions: Counter;
  branches: Counter;
  uncoveredBranches: readonly Branch[];
}>;

export type CoverageObligation = Readonly<{
  status: "Not Verified";
  reason: string;
  risk: string;
  alternativeVerification: string;
  owner: "Qual-Lab";
  humanDecision: "not_required";
  recheck: string;
}>;

const sourceCoverageObligations: Readonly<Record<string, CoverageObligation>> =
  Object.freeze({
    "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts":
      obligation(
        "集計器のmain guard、OS I/O failureおよび全LCOV不正組合せを同一runで到達していない",
        "品質根拠の誤拒否または不正入力の誤受理",
        "exact source/test母集団、LCOV grammar負例および連続出力一致",
        "LCOV grammar、Node coverageまたは固定母集団の変更時",
      ),
    "40_Develop/coordinator/scripts/release-staging-manifest.ts": obligation(
      "全descriptor failureと全置換timingを同一runで到達していない",
      "稀なFilesystem failureのEffect分類漏れ",
      "opaque session、同一fd byte/EOF、置換拒否および失敗Root非削除試験",
      "実Release stagingまたはFilesystem API変更時",
    ),
    "40_Develop/coordinator/scripts/release-manifest-promotion.ts": obligation(
      "全Filesystem API failureと同一ユーザーによる全置換timingを同一runで到達していない",
      "署名済みManifestのbyte変化、部分file公開または別file誤採用",
      "末尾改行なしのbyte一致、既存先・偽造token・source差替え拒否、atomic link／source unlink後の再入場および別Identity拒否試験",
      "Manifest昇格、Filesystem APIまたはcleanup契約変更時",
    ),
    "40_Develop/coordinator/scripts/promote-release-manifest.ts": obligation(
      "本番固定鍵で署名した実stagingの成功入口を試験用Trustへ開放していない",
      "署名・Tree・Native・HEADの結合漏れまたは昇格後検証の見落とし",
      "production固定検証、同じ合成順序を実行する開発契約試験、昇格Coreの中断再入場試験およびRelease Candidateでの実昇格",
      "Release handoff、Manifest SchemaまたはSource A/B契約変更時",
    ),
    "40_Develop/coordinator/scripts/sign-release-manifest.ts": obligation(
      "本番固定鍵と実Release stagingの正常入口を試験用Trustへ開放していない",
      "実署名時だけ現れる入力またはI/O failureの見落とし",
      "固定Trust source検査、署名不一致負例および配置helper契約試験",
      "本番署名E2EまたはRelease handoff着手時",
    ),
    "40_Develop/coordinator/src/core/doctor.ts": obligation(
      "既存doctor全分岐を本変更専用coverage母集団で再到達していない",
      "状態投影の稀なblocked理由の回帰",
      "doctor契約試験、公開情報最小化試験および全Coordinator test",
      "doctor投影、blockerまたはevidence母集団変更時",
    ),
    "40_Develop/coordinator/src/security/authority-root-path-lexical.ts":
      obligation(
        "host OS dispatcherの反対側分岐を単一OS runで到達していない",
        "OS別dispatcherとpure字句判定の接続差",
        "Windows/POSIX pure validatorの正負・境界契約試験",
        "対応OS、字句subsetまたはdispatcher変更時",
      ),
    "40_Develop/coordinator/src/security/bounded-file-snapshot.ts": obligation(
      "close failureと全Filesystem raceを同一coverage runで到達していない",
      "成果物のgrowth、truncate、leafまたはparent差替えの誤受理",
      "上限exact／+1、growth、truncate、同長leaf／parent replacement契約試験とproduction caller試験",
      "読取り上限、Filesystem API、Identity fieldまたはcaller変更時",
    ),
    "40_Develop/coordinator/src/security/platform-access-adapter.ts":
      obligation(
        "入力正規化の全failure形を同一runで到達していない",
        "wire不正値の誤受理",
        "revision、nonce、role、全bit、主体HashおよびProxy負例",
        "wire protocolまたはproduction process再導入時",
      ),
    "40_Develop/coordinator/src/security/platform-access-release.ts":
      obligation(
        "成果物観測の全OS例外とIdentity failureを同一runで到達していない",
        "Release artifact差替えの検出漏れ",
        "同一handle観測、同長上書き、短縮、追記およびRoot差試験",
        "Release artifactまたはFilesystem API変更時",
      ),
    "40_Develop/coordinator/src/security/platform-provisioner-manifest-loader.ts":
      obligation(
        "全read failure、上限およびIdentity差を同一runで到達していない",
        "manifest loaderのfail-closed回帰",
        "canonical byte、上限、同一handleおよびIdentity差契約試験",
        "manifest Schemaまたはloader変更時",
      ),
    "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts":
      obligation(
        "全inventory、descriptorおよびFilesystem failureを同一runで到達していない",
        "package closureまたは同一handle検証の見落とし",
        "余分・欠落・改変・link・Identity差の契約試験",
        "package inventoryまたはstaging copy実装時",
      ),
    "40_Develop/coordinator/src/security/platform-provisioner-release-identity.ts":
      obligation(
        "全Git object、FilesystemおよびIdentity failureを同一runで到達していない",
        "署名Release Identityと配布Treeの不一致見落とし",
        "Root Tree再計算、除外Path、改変およびIdentity差契約試験",
        "Release archiveまたはIdentity contract変更時",
      ),
    "40_Develop/coordinator/src/security/platform-provisioner-trust-core.ts":
      obligation(
        "manifest exact Schemaと署名Coreの一部failure branchを未到達とする",
        "不正署名payloadまたは未知fieldの誤受理",
        "全field差、固定公開鍵、専用Rust成果物および署名domain契約試験",
        "manifest Schema、署名domainまたはTrust変更時",
      ),
    "40_Develop/coordinator/src/security/root-observation.ts": obligation(
      "Rust結果からRoot観測へのproduction写像は未実装である",
      "未確認主体またはProtection値の補完",
      "selected-user binding必須、exact inputおよび固定blocked契約試験",
      "Root観測mapping実装時",
    ),
  });

function obligation(
  reason: string,
  risk: string,
  alternativeVerification: string,
  recheck: string,
): CoverageObligation {
  return Object.freeze({
    status: "Not Verified",
    reason,
    risk,
    alternativeVerification,
    owner: "Qual-Lab",
    humanDecision: "not_required",
    recheck,
  });
}

function count(raw: string, label: string) {
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) {
    throw new Error(`invalid ${label}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAXIMUM_COVERAGE_COUNT) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

function positiveCount(raw: string, label: string) {
  const value = count(raw, label);
  if (value < 1) throw new Error(`invalid ${label}`);
  return value;
}

function oneValue(lines: readonly string[], prefix: string) {
  const values = lines.filter((line) => line.startsWith(prefix));
  if (values.length !== 1) throw new Error(`invalid ${prefix} count`);
  return count(values[0]?.slice(prefix.length) ?? "", prefix);
}

function normalizeSource(raw: string, expectedSources: readonly string[]) {
  if (raw.length === 0 || raw.includes("\0") || path.isAbsolute(raw)) {
    throw new Error("invalid LCOV source");
  }
  const normalized = raw.replaceAll("\\", "/");
  const resolved = path.resolve(repositoryRoot, ...normalized.split("/"));
  const relative = path
    .relative(repositoryRoot, resolved)
    .replaceAll("\\", "/");
  if (
    relative !== normalized ||
    relative.startsWith("../") ||
    !expectedSources.includes(relative)
  ) {
    throw new Error("unexpected LCOV source");
  }
  return relative;
}

function branchRecords(lines: readonly string[]) {
  const identities = new Set<string>();
  const branches: Branch[] = [];
  for (const line of lines) {
    if (!line.startsWith("BRDA:")) continue;
    const fields = line.slice(5).split(",");
    if (fields.length !== 4) throw new Error("invalid BRDA");
    const branch = Object.freeze({
      line: positiveCount(fields[0] ?? "", "BRDA line"),
      block: count(fields[1] ?? "", "BRDA block"),
      branch: count(fields[2] ?? "", "BRDA branch"),
      taken: fields[3] === "-" ? null : count(fields[3] ?? "", "BRDA taken"),
    });
    const identity = `${branch.line}:${branch.block}:${branch.branch}`;
    if (identities.has(identity)) throw new Error("duplicate BRDA");
    identities.add(identity);
    branches.push(branch);
  }
  return branches;
}

function validateLineRecords(
  lines: readonly string[],
  expectedTotal: number,
  expectedCovered: number,
) {
  const lineNumbers = new Set<number>();
  let covered = 0;
  let total = 0;
  for (const line of lines) {
    if (!line.startsWith("DA:")) continue;
    const fields = line.slice(3).split(",");
    if (fields.length !== 2) throw new Error("invalid DA");
    const lineNumber = positiveCount(fields[0] ?? "", "DA line");
    if (lineNumbers.has(lineNumber)) throw new Error("duplicate DA");
    lineNumbers.add(lineNumber);
    const executions = count(fields[1] ?? "", "DA executions");
    total += 1;
    if (executions > 0) covered += 1;
  }
  if (total !== expectedTotal || covered !== expectedCovered) {
    throw new Error("inconsistent DA summary");
  }
}

function validateFunctionRecords(
  lines: readonly string[],
  expectedTotal: number,
  expectedCovered: number,
) {
  const definitions = new Map<string, number>();
  const executions = new Map<string, number>();
  for (const line of lines) {
    if (line.startsWith("FN:")) {
      const separator = line.indexOf(",", 3);
      if (separator < 0) throw new Error("invalid FN");
      const lineNumber = positiveCount(line.slice(3, separator), "FN line");
      const name = line.slice(separator + 1);
      if (name.length === 0 || definitions.has(name)) {
        throw new Error("duplicate FN");
      }
      definitions.set(name, lineNumber);
    }
    if (line.startsWith("FNDA:")) {
      const separator = line.indexOf(",", 5);
      if (separator < 0) throw new Error("invalid FNDA");
      const executionCount = count(line.slice(5, separator), "FNDA executions");
      const name = line.slice(separator + 1);
      if (name.length === 0 || executions.has(name)) {
        throw new Error("duplicate FNDA");
      }
      executions.set(name, executionCount);
    }
  }
  if (
    definitions.size !== expectedTotal ||
    executions.size !== expectedTotal ||
    [...definitions.keys()].some((name) => !executions.has(name)) ||
    [...executions.keys()].some((name) => !definitions.has(name)) ||
    [...executions.values()].filter((value) => value > 0).length !==
      expectedCovered
  ) {
    throw new Error("inconsistent function records");
  }
}

const allowedLcovTags = Object.freeze(
  new Set([
    "TN",
    "SF",
    "FN",
    "FNDA",
    "DA",
    "BRDA",
    "LF",
    "LH",
    "FNF",
    "FNH",
    "BRF",
    "BRH",
  ]),
);

function lcovRecords(raw: string) {
  const records: string[][] = [];
  let currentLines: string[] = [];
  const lines = raw.replaceAll("\r\n", "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line === "end_of_record") {
      if (currentLines.length === 0) throw new Error("duplicate end_of_record");
      records.push(currentLines);
      currentLines = [];
      continue;
    }
    if (
      line.length === 0 &&
      index === lines.length - 1 &&
      currentLines.length === 0
    ) {
      continue;
    }
    if (line.length === 0) throw new Error("invalid empty LCOV line");
    const separator = line.indexOf(":");
    const tag = separator < 0 ? "" : line.slice(0, separator);
    if (!allowedLcovTags.has(tag)) throw new Error("unknown LCOV record");
    currentLines.push(line);
  }
  if (currentLines.length !== 0) throw new Error("missing end_of_record");
  return records;
}

export function parseExactTsCoverageLcov(
  raw: unknown,
  configuration: Readonly<{
    sources: readonly string[];
    obligations: Readonly<Record<string, CoverageObligation>>;
  }>,
) {
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_LCOV_BYTES
  ) {
    throw new Error("invalid LCOV input");
  }
  const records = lcovRecords(raw);
  const sources = new Map<string, SourceCoverage>();
  for (const lines of records) {
    const testNames = lines.filter((line) => line.startsWith("TN:"));
    if (testNames.length > 1 || testNames.some((line) => line !== "TN:")) {
      throw new Error("invalid TN count");
    }
    const sourceLines = lines.filter((line) => line.startsWith("SF:"));
    if (sourceLines.length !== 1) throw new Error("invalid SF count");
    const source = normalizeSource(
      sourceLines[0]?.slice(3) ?? "",
      configuration.sources,
    );
    if (sources.has(source)) throw new Error("duplicate SF");
    const lineTotals = Object.freeze({
      covered: oneValue(lines, "LH:"),
      total: oneValue(lines, "LF:"),
    });
    const functionTotals = Object.freeze({
      covered: oneValue(lines, "FNH:"),
      total: oneValue(lines, "FNF:"),
    });
    const branchTotals = Object.freeze({
      covered: oneValue(lines, "BRH:"),
      total: oneValue(lines, "BRF:"),
    });
    if (
      lineTotals.covered > lineTotals.total ||
      functionTotals.covered > functionTotals.total ||
      branchTotals.covered > branchTotals.total
    ) {
      throw new Error("invalid LCOV summary");
    }
    validateLineRecords(lines, lineTotals.total, lineTotals.covered);
    validateFunctionRecords(
      lines,
      functionTotals.total,
      functionTotals.covered,
    );
    const branches = branchRecords(lines);
    if (
      branches.length !== branchTotals.total ||
      branches.filter((branch) => (branch.taken ?? 0) > 0).length !==
        branchTotals.covered
    ) {
      throw new Error("inconsistent branch summary");
    }
    sources.set(
      source,
      Object.freeze({
        source,
        lines: lineTotals,
        functions: functionTotals,
        branches: branchTotals,
        uncoveredBranches: Object.freeze(
          branches.filter((branch) => (branch.taken ?? 0) === 0),
        ),
      }),
    );
  }
  if (
    sources.size !== configuration.sources.length ||
    configuration.sources.some((source) => !sources.has(source))
  ) {
    throw new Error("LCOV source population mismatch");
  }
  const orderedSources = configuration.sources.map((source) => {
    const value = sources.get(source);
    if (!value) throw new Error("LCOV source population mismatch");
    return value;
  });
  if (
    Object.keys(configuration.obligations).length !==
      configuration.sources.length ||
    configuration.sources.some((source) => !configuration.obligations[source])
  ) {
    throw new Error("coverage obligation population mismatch");
  }
  const total = (key: "lines" | "functions" | "branches") =>
    Object.freeze(
      orderedSources.reduce(
        (result, source) => ({
          covered: result.covered + source[key].covered,
          total: result.total + source[key].total,
        }),
        { covered: 0, total: 0 },
      ),
    );
  return Object.freeze({
    sources: Object.freeze(orderedSources),
    uncoveredBranchObligations: Object.freeze(
      orderedSources.flatMap((source) =>
        source.uncoveredBranches.map((branch) =>
          Object.freeze({
            source: source.source,
            line: branch.line,
            block: branch.block,
            branch: branch.branch,
            obligation: configuration.obligations[source.source],
          }),
        ),
      ),
    ),
    totals: Object.freeze({
      lines: total("lines"),
      functions: total("functions"),
      branches: total("branches"),
    }),
  });
}

export function parsePlatformAccessTsCoverageLcov(raw: unknown) {
  return parseExactTsCoverageLcov(raw, {
    sources: PLATFORM_ACCESS_TS_COVERAGE_SOURCES,
    obligations: sourceCoverageObligations,
  });
}

function fixedEnvironment() {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    const value = process.env[name];
    if (value) environment[name] = value;
  }
  return environment;
}

export function inspectPlatformAccessTsCoverage() {
  const rootMetadata = fs.lstatSync(repositoryRoot);
  if (
    !rootMetadata.isDirectory() ||
    rootMetadata.isSymbolicLink() ||
    fs.realpathSync.native(repositoryRoot) !== repositoryRoot
  ) {
    throw new Error("coverage repository root invalid");
  }
  const result = spawnSync(
    process.execPath,
    [
      ...PLATFORM_ACCESS_TS_COVERAGE_NODE_OPTIONS,
      ...PLATFORM_ACCESS_TS_COVERAGE_SOURCES.map(
        (source) => `--test-coverage-include=${source}`,
      ),
      ...PLATFORM_ACCESS_TS_COVERAGE_TESTS,
    ],
    {
      cwd: repositoryRoot,
      env: fixedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 60_000,
      maxBuffer: MAXIMUM_LCOV_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 0 ||
    typeof result.stdout !== "string" ||
    typeof result.stderr !== "string" ||
    result.stderr.length !== 0
  ) {
    throw new Error("TypeScript coverage command failed");
  }
  return parsePlatformAccessTsCoverageLcov(result.stdout);
}

export function serializePlatformAccessTsCoverage(
  value: ReturnType<typeof inspectPlatformAccessTsCoverage>,
) {
  return `${JSON.stringify(value)}\n`;
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    serializePlatformAccessTsCoverage(inspectPlatformAccessTsCoverage()),
  );
}
