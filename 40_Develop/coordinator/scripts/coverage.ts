/**
 * 複数の検証Toolが使うexact LCOV解析を所有する。
 *
 * @responsibility Counterを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import path from "node:path";

// Node.jsのV8 coverage counterは試験件数でなく実行回数である。
// Filesystemやparserの反復は正当に百万回を超え得るため、
// 正確な整数を保持し、JavaScriptで無損失に表現できない値だけ拒否する。
const maximumCoverageCount = Number.MAX_SAFE_INTEGER;
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");

/**
 * coverageで使用するCounterの値契約を定義する。
 *
 * @responsibility CounterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Counterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Counterで宣言した値と責務の対応を維持する。
 * @boundary N/A: Counterの宣言は外部境界を開かない。
 * @security N/A: CounterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Counterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Counter = Readonly<{ covered: number; total: number }>;
/**
 * coverageで使用するBranchの値契約を定義する。
 *
 * @responsibility BranchのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Branchが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Branchで宣言した値と責務の対応を維持する。
 * @boundary N/A: Branchの宣言は外部境界を開かない。
 * @security N/A: BranchはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility Branchの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Branch = Readonly<{
  line: number;
  block: number;
  branch: number;
  taken: number | null;
}>;
/**
 * coverageで使用するSource Coverageの値契約を定義する。
 *
 * @responsibility Source CoverageのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape SourceCoverageが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SourceCoverageで宣言した値と責務の対応を維持する。
 * @boundary N/A: SourceCoverageの宣言は外部境界を開かない。
 * @security N/A: SourceCoverageはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SourceCoverageの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type SourceCoverage = Readonly<{
  source: string;
  lines: Counter;
  functions: Counter;
  branches: Counter;
  uncoveredBranches: readonly Branch[];
}>;

/** 未到達分岐の根拠と再確認条件。割合だけで未確認を解消しない。 */
export type CoverageObligation = Readonly<{
  status: "Not Verified";
  reason: string;
  risk: string;
  alternativeVerification: string;
  owner: "Qual-Lab";
  humanDecision: "not_required";
  recheck: string;
}>;

/**
 * coverageの件数を算出する。
 *
 * @responsibility coverageの計数対象、集計規則、件数結果境界を所有する。
 * @trace ARCH-000004
 * @input raw: string、label: string
 * @returns countの計算結果を返す。
 * @precondition 「raw: string、label: string」がcountの入力契約を満たす。
 * @postcondition countの責務を完了した結果だけを返す。
 * @effect N/A: countは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure countは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant countは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: countはProcess内の同一Subsystemで完結する。
 * @security N/A: countはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: countは共有非同期状態を持たない同期処理である。
 */
function count(raw: string, label: string) {
  if (!/^(?:0|[1-9]\d*)$/u.test(raw)) {
    throw new Error(`invalid ${label}`);
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximumCoverageCount) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

/**
 * Countが正数か検証する。
 *
 * @responsibility Countの数値条件、拒否条件、検証済み結果境界を所有する。
 * @trace ARCH-000004
 * @input raw: string、label: string
 * @returns positiveCountの計算結果を返す。
 * @precondition 「raw: string、label: string」がpositiveCountの入力契約を満たす。
 * @postcondition positiveCountの責務を完了した結果だけを返す。
 * @effect N/A: positiveCountは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure positiveCountは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant positiveCountは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: positiveCountはProcess内の同一Subsystemで完結する。
 * @security N/A: positiveCountはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: positiveCountは共有非同期状態を持たない同期処理である。
 */
function positiveCount(raw: string, label: string) {
  const value = count(raw, label);
  if (value < 1) throw new Error(`invalid ${label}`);
  return value;
}

/**
 * one Valueを決定する。
 *
 * @responsibility one Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input lines: readonly string[]、prefix: string
 * @returns oneValueの計算結果を返す。
 * @precondition 「lines: readonly string[]、prefix: string」がoneValueの入力契約を満たす。
 * @postcondition oneValueの責務を完了した結果だけを返す。
 * @effect N/A: oneValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure oneValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant oneValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: oneValueはProcess内の同一Subsystemで完結する。
 * @security N/A: oneValueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: oneValueは共有非同期状態を持たない同期処理である。
 */
function oneValue(lines: readonly string[], prefix: string) {
  const values = lines.filter((line) => line.startsWith(prefix));
  if (values.length !== 1) throw new Error(`invalid ${prefix} count`);
  return count(values[0]?.slice(prefix.length) ?? "", prefix);
}

/**
 * Sourceを固定Schemaへ正規化する。
 *
 * @responsibility Sourceの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: string、expectedSources: readonly string[]
 * @returns normalizeSourceの計算結果を返す。
 * @precondition 「raw: string、expectedSources: readonly string[]」がnormalizeSourceの入力契約を満たす。
 * @postcondition normalizeSourceの責務を完了した結果だけを返す。
 * @effect N/A: normalizeSourceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure normalizeSourceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant normalizeSourceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeSourceはProcess内の同一Subsystemで完結する。
 * @security N/A: normalizeSourceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: normalizeSourceは共有非同期状態を持たない同期処理である。
 */
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

/**
 * branch Recordsを決定する。
 *
 * @responsibility branch Recordsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input lines: readonly string[]
 * @returns branchRecordsの計算結果を返す。
 * @precondition 「lines: readonly string[]」がbranchRecordsの入力契約を満たす。
 * @postcondition branchRecordsの責務を完了した結果だけを返す。
 * @effect N/A: branchRecordsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure branchRecordsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant branchRecordsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: branchRecordsはProcess内の同一Subsystemで完結する。
 * @security N/A: branchRecordsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: branchRecordsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Line Recordsの契約を検証する。
 *
 * @responsibility Line Recordsの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000004
 * @input lines: readonly string[]、expectedTotal: number、expectedCovered: number
 * @returns N/A: validateLineRecordsは戻り値を返さない。
 * @precondition 「lines: readonly string[]、expectedTotal: number、expectedCovered: number」がvalidateLineRecordsの入力契約を満たす。
 * @postcondition validateLineRecordsの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: validateLineRecordsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateLineRecordsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateLineRecordsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateLineRecordsはProcess内の同一Subsystemで完結する。
 * @security N/A: validateLineRecordsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateLineRecordsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Function Recordsの契約を検証する。
 *
 * @responsibility Function Recordsの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000004
 * @input lines: readonly string[]、expectedTotal: number、expectedCovered: number
 * @returns N/A: validateFunctionRecordsは戻り値を返さない。
 * @precondition 「lines: readonly string[]、expectedTotal: number、expectedCovered: number」がvalidateFunctionRecordsの入力契約を満たす。
 * @postcondition validateFunctionRecordsの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: validateFunctionRecordsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateFunctionRecordsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateFunctionRecordsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateFunctionRecordsはProcess内の同一Subsystemで完結する。
 * @security N/A: validateFunctionRecordsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateFunctionRecordsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * lcov Recordsを決定する。
 *
 * @responsibility lcov Recordsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: string
 * @returns lcovRecordsの計算結果を返す。
 * @precondition 「raw: string」がlcovRecordsの入力契約を満たす。
 * @postcondition lcovRecordsの責務を完了した結果だけを返す。
 * @effect N/A: lcovRecordsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure lcovRecordsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant lcovRecordsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: lcovRecordsはProcess内の同一Subsystemで完結する。
 * @security N/A: lcovRecordsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: lcovRecordsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Exact Ts Coverage Lcovを構造化値へ解析する。
 *
 * @responsibility Exact Ts Coverage Lcovの入力文法、解析結果、不正文法の拒否境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、configuration: Readonly<{ sources: readonly string[]; obligations: Readonly<Record<string, CoverageObligation>>; }>
 * @returns parseExactTsCoverageLcovの計算結果を返す。
 * @precondition 「raw: unknown、configuration: Readonly<{ sources: readonly string[]; obligations: Readonly<Record<string, CoverageObligation>>; }>」がparseExactTsCoverageLcovの入力契約を満たす。
 * @postcondition parseExactTsCoverageLcovの責務を完了した結果だけを返す。
 * @effect N/A: parseExactTsCoverageLcovは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure parseExactTsCoverageLcovは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant parseExactTsCoverageLcovは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseExactTsCoverageLcovはProcess内の同一Subsystemで完結する。
 * @security N/A: parseExactTsCoverageLcovはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseExactTsCoverageLcovは共有非同期状態を持たない同期処理である。
 */
export function parseExactTsCoverageLcov(
  raw: unknown,
  configuration: Readonly<{
    sources: readonly string[];
    obligations: Readonly<Record<string, CoverageObligation>>;
  }>,
) {
  if (typeof raw !== "string") {
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
