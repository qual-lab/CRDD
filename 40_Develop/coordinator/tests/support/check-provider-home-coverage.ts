/**
 * check-provider-home-coverageに属する責務をまとめる。
 *
 * @responsibility obligationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000010
 */
import { type SpawnSyncReturns, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  type CoverageObligation,
  parseExactTsCoverageLcov,
} from "./coverage.ts";

const MAXIMUM_LCOV_BYTES = 32 * 1024 * 1024;
export const PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION = "24.12.0";
const coordinatorRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");

export const PROVIDER_HOME_COVERAGE_SOURCES = Object.freeze([
  "40_Develop/coordinator/src/lifecycle/authentication.ts",
  "40_Develop/coordinator/src/lifecycle/validation.ts",
  "40_Develop/coordinator/src/lifecycle/environment.ts",
  "40_Develop/coordinator/tests/support/coverage.ts",
  "40_Develop/coordinator/tests/support/check-provider-home-coverage.ts",
]);

export const PROVIDER_HOME_COVERAGE_TESTS = Object.freeze([
  "40_Develop/coordinator/tests/unit/execution/root-path.contract.test.ts",
  "40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts",
  "40_Develop/coordinator/tests/unit/execution/provider-home.contract.test.ts",
  "40_Develop/coordinator/tests/unit/execution/provider-lifecycle.contract.test.ts",
  "40_Develop/coordinator/tests/unit/execution/diagnostics.contract.test.ts",
  "40_Develop/coordinator/tests/integration/coverage.contract.test.ts",
  "40_Develop/coordinator/tests/unit/provider-home-coverage.contract.test.ts",
]);

const NODE_OPTIONS = Object.freeze([
  "--experimental-test-coverage",
  "--test",
  "--test-concurrency=1",
  "--experimental-test-isolation=none",
  "--test-reporter=lcov",
]);

/**
 * obligationを決定する。
 *
 * @responsibility obligationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input reason: string、risk: string、alternativeVerification: string、recheck: string
 * @returns CoverageObligationを返す。
 * @precondition 「reason: string、risk: string、alternativeVerification: string、recheck: string」がobligationの入力契約を満たす。
 * @postcondition obligationの責務を完了した結果だけを返す。
 * @effect N/A: obligationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: obligationは独自の失敗分岐を所有しない。
 * @invariant obligationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: obligationはProcess内の同一Subsystemで完結する。
 * @security N/A: obligationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: obligationは共有非同期状態を持たない同期処理である。
 */
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

const coverageObligations = Object.freeze({
  "40_Develop/coordinator/src/lifecycle/authentication.ts": obligation(
    "認証の保存故障・回復・Home解放および両Providerの全短絡を同一runで到達していない",
    "認証完了・保存不明・排他の解放条件を稀な失敗時に誤分類する可能性",
    "両Providerのstatus／login契約、認証記録の保存・再入場とHome競合／解放不明の試験",
    "認証の準備・技術実行・回復記録・Home排他またはProvider集合の変更時",
  ),
  "40_Develop/coordinator/src/lifecycle/validation.ts": obligation(
    "reflection failureの稀な順序と、入れ子JSONの不正文法を全組合せでは通過しない",
    "動的入力を実行するか、重複キーや末尾データを含むJSONを受理する可能性",
    "record／arrayのshape、accessor、Proxy、reflection failureと上限、JSONの正例・重複キー・不正文法を直接確認",
    "入力値捕捉・相対Path・JSON解析の実装変更時",
  ),

  "40_Develop/coordinator/src/lifecycle/environment.ts": obligation(
    "合成候補の複合fail-closed述語の全短絡順序を同一runで到達していない／実Docker、全Git／Provider discovery形式および全cleanup failureを同一runで到達していない",
    "入力shapeまたは上限の稀な不正形を同じ固定reasonへ閉じる分岐の退行／private reportのProvider Home状態またはreason投影が稀な環境で不一致になる可能性",
    "Provider、mode、状態、入出力、deadline、cancel、結果、quotaおよび専用Home投影試験／passive／isolation、discovery、readiness、runtime request、Fake lifecycleおよびexact report contract試験",
    "Provider lifecycle、Provider Homeまたは実Provider binding変更時／doctor report、Provider Home投影またはproduction consumer追加時",
  ),

  "40_Develop/coordinator/tests/support/coverage.ts": obligation(
    "共有LCOV parserの全Filesystem／child process errorと全不正record組合せを同一runで到達していない",
    "品質記録の不正入力を稀な組合せで受理または誤分類する可能性",
    "exact母集団、LCOV grammar、summary、BRDA、上限およびserializerの正負・境界試験",
    "LCOV parser、Node coverage形式または固定母集団契約変更時",
  ),
  "40_Develop/coordinator/tests/support/check-provider-home-coverage.ts":
    obligation(
      "runnerのchild process失敗、非決定出力およびRepository Root差を意図的に全発火していない",
      "品質記録生成が環境差または失敗を安全に分類できない可能性",
      "固定source／test母集団、compact serializer、main guard、2回一致および実coverage command",
      "Provider Home coverage runner、母集団または実行環境変更時",
    ),
} satisfies Readonly<Record<string, CoverageObligation>>);

/**
 * fixed Environmentを決定する。
 *
 * @responsibility fixed Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns fixedEnvironmentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がfixedEnvironmentの入力契約を満たす。
 * @postcondition fixedEnvironmentの責務を完了した結果だけを返す。
 * @effect fixedEnvironmentは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure N/A: fixedEnvironmentは独自の失敗分岐を所有しない。
 * @invariant fixedEnvironmentは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: fixedEnvironmentはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: fixedEnvironmentは共有非同期状態を持たない同期処理である。
 */
function fixedEnvironment() {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    const value = process.env[name];
    if (value) environment[name] = value;
  }
  return environment;
}

/**
 * Supported Provider Home Coverage Node Versionかを判定する。
 *
 * @responsibility Supported Provider Home Coverage Node Versionの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000010
 * @input value: unknown
 * @returns isSupportedProviderHomeCoverageNodeVersionの計算結果を返す。
 * @precondition 「value: unknown」がisSupportedProviderHomeCoverageNodeVersionの入力契約を満たす。
 * @postcondition isSupportedProviderHomeCoverageNodeVersionの責務を完了した結果だけを返す。
 * @effect N/A: isSupportedProviderHomeCoverageNodeVersionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSupportedProviderHomeCoverageNodeVersionは独自の失敗分岐を所有しない。
 * @invariant isSupportedProviderHomeCoverageNodeVersionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSupportedProviderHomeCoverageNodeVersionはProcess内の同一Subsystemで完結する。
 * @security N/A: isSupportedProviderHomeCoverageNodeVersionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSupportedProviderHomeCoverageNodeVersionは共有非同期状態を持たない同期処理である。
 */
export function isSupportedProviderHomeCoverageNodeVersion(value: unknown) {
  if (typeof value !== "string") return false;
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return false;
  const versionParts = match.slice(1).map(Number);
  const minimumParts =
    PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION.split(".").map(Number);
  if (versionParts.some((part) => !Number.isSafeInteger(part))) return false;
  for (let index = 0; index < minimumParts.length; index += 1) {
    const currentPart = versionParts[index];
    const minimumPart = minimumParts[index];
    if (currentPart === undefined || minimumPart === undefined) return false;
    if (currentPart !== minimumPart) {
      return currentPart > minimumPart;
    }
  }
  return true;
}

/**
 * 計測子Processの完了と既知の型除去警告を区別する。
 * @responsibility 正常終了と、空のstderr又はNode.jsが出す固定の一件だけを受け付ける。
 * @trace ARCH-000010
 * @input result: 固定コマンドの終了結果。
 * @returns 検査前のLCOV本文。
 * @effect N/A: 終了結果の検査だけ。
 * @failure 非0、起動不能、Signal、未知・重複警告は拒否する。
 * @boundary Node.jsの終了結果とLCOV構文検査。
 */
export function requireProviderHomeCoverageOutput(
  result: Pick<
    SpawnSyncReturns<string>,
    "error" | "signal" | "status" | "stdout" | "stderr"
  >,
): string {
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 0 ||
    typeof result.stdout !== "string" ||
    typeof result.stderr !== "string"
  ) {
    throw new Error("Provider Home coverage command failed");
  }
  if (result.stderr !== "") {
    const [warning, help, end, ...extra] = result.stderr.split(/\r?\n/u);
    if (
      warning === undefined ||
      !/^\(node:[1-9][0-9]*\) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time$/u.test(
        warning,
      ) ||
      help !==
        "(Use `node --trace-warnings ...` to show where the warning was created)" ||
      end !== "" ||
      extra.length !== 0
    ) {
      throw new Error("Provider Home coverage command failed");
    }
  }
  return result.stdout;
}

/**
 * Onceを観測する。
 *
 * @responsibility Onceの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns inspectOnceの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinspectOnceの入力契約を満たす。
 * @postcondition inspectOnceの責務を完了した結果だけを返す。
 * @effect inspectOnceは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure inspectOnceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectOnceは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: inspectOnceはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectOnceは共有非同期状態を持たない同期処理である。
 */
function inspectOnce() {
  const result = spawnSync(
    process.execPath,
    [
      ...NODE_OPTIONS,
      ...PROVIDER_HOME_COVERAGE_SOURCES.map(
        (source) => `--test-coverage-include=${source}`,
      ),
      ...PROVIDER_HOME_COVERAGE_TESTS,
    ],
    {
      cwd: repositoryRoot,
      env: fixedEnvironment(),
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 120_000,
      maxBuffer: MAXIMUM_LCOV_BYTES,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const coverage = parseExactTsCoverageLcov(
    requireProviderHomeCoverageOutput(result),
    {
      sources: PROVIDER_HOME_COVERAGE_SOURCES,
      obligations: coverageObligations,
    },
  );
  if (result.stderr !== "") process.stderr.write(result.stderr);
  return coverage;
}

/**
 * Provider Home Coverageを観測する。
 *
 * @responsibility Provider Home Coverageの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000010
 * @input N/A: 実行時引数を受け取らない。
 * @returns inspectProviderHomeCoverageの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinspectProviderHomeCoverageの入力契約を満たす。
 * @postcondition inspectProviderHomeCoverageの責務を完了した結果だけを返す。
 * @effect inspectProviderHomeCoverageはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectProviderHomeCoverageは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectProviderHomeCoverageは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectProviderHomeCoverageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectProviderHomeCoverageは共有非同期状態を持たない同期処理である。
 */
export function inspectProviderHomeCoverage() {
  if (!isSupportedProviderHomeCoverageNodeVersion(process.versions.node)) {
    throw new Error("Provider Home coverage Node runtime unsupported");
  }
  const rootMetadata = fs.lstatSync(repositoryRoot);
  if (
    !rootMetadata.isDirectory() ||
    rootMetadata.isSymbolicLink() ||
    fs.realpathSync.native(repositoryRoot) !== repositoryRoot
  ) {
    throw new Error("coverage repository root invalid");
  }
  const first = inspectOnce();
  const second = inspectOnce();
  const payload = JSON.stringify(first);
  if (payload !== JSON.stringify(second)) {
    throw new Error("Provider Home coverage output is not deterministic");
  }
  return Object.freeze({
    runtime: Object.freeze({
      nodeVersion: process.version,
      minimumNodeVersion: PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION,
    }),
    sourcePopulation: PROVIDER_HOME_COVERAGE_SOURCES,
    testPopulation: PROVIDER_HOME_COVERAGE_TESTS,
    coverage: first,
    reproducibility: Object.freeze({
      consecutiveRuns: 2,
      payloadSha256: createHash("sha256").update(payload).digest("hex"),
    }),
  });
}

/**
 * Provider Home Coverageを固定byte表現へ直列化する。
 *
 * @responsibility Provider Home Coverageの入力値、直列化規則、出力境界を所有する。
 * @trace ARCH-000010
 * @input value: ReturnType<typeof inspectProviderHomeCoverage>
 * @returns serializeProviderHomeCoverageの計算結果を返す。
 * @precondition 「value: ReturnType<typeof inspectProviderHomeCoverage>」がserializeProviderHomeCoverageの入力契約を満たす。
 * @postcondition serializeProviderHomeCoverageの責務を完了した結果だけを返す。
 * @effect N/A: serializeProviderHomeCoverageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: serializeProviderHomeCoverageは独自の失敗分岐を所有しない。
 * @invariant serializeProviderHomeCoverageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: serializeProviderHomeCoverageはProcess内の同一Subsystemで完結する。
 * @security N/A: serializeProviderHomeCoverageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: serializeProviderHomeCoverageは共有非同期状態を持たない同期処理である。
 */
export function serializeProviderHomeCoverage(
  value: ReturnType<typeof inspectProviderHomeCoverage>,
) {
  return `${JSON.stringify(value)}\n`;
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    serializeProviderHomeCoverage(inspectProviderHomeCoverage()),
  );
}
