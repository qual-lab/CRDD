/**
 * check-dynamic-fake-provider-coverageに属する責務をまとめる。
 *
 * @responsibility obligationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  type CoverageObligation,
  parseExactTsCoverageLcov,
} from "./check-platform-access-ts-coverage.ts";

const MAXIMUM_LCOV_BYTES = 32 * 1024 * 1024;
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");

export const DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES = Object.freeze([
  "40_Develop/coordinator/src/security/docker-isolation.ts",
  "40_Develop/coordinator/src/security/provider-lifecycle.ts",
  "40_Develop/coordinator/src/security/execution-environment.ts",
  "40_Develop/coordinator/src/security/host-recovery-record.ts",
  "40_Develop/coordinator/src/security/plain-data-snapshot.ts",
  "40_Develop/coordinator/src/core/doctor.ts",
  "40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts",
  "40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts",
  "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts",
  "40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts",
]);

export const DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS = Object.freeze([
  "40_Develop/coordinator/tests/unit/doctor.contract.test.ts",
  "40_Develop/coordinator/tests/system/dynamic-fake-provider-failure-verification.contract.test.ts",
  "40_Develop/coordinator/tests/system/dynamic-fake-provider-cancellation-verification.contract.test.ts",
  "40_Develop/coordinator/tests/unit/provider-lifecycle.contract.test.ts",
  "40_Develop/coordinator/tests/unit/plain-data-snapshot.contract.test.ts",
  "40_Develop/coordinator/tests/integration/platform-access-ts-coverage.contract.test.ts",
  "40_Develop/coordinator/tests/unit/dynamic-fake-provider-coverage.contract.test.ts",
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
 * @trace ARCH-000004
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
  "40_Develop/coordinator/src/security/docker-isolation.ts": obligation(
    "実Docker、敵対的置換、全recovery分岐および同期process errorの全短絡をunit runで到達していない",
    "稀なDocker failureでcontainer不存在またはHost cleanupを誤分類する可能性",
    "Docker normalizer、Identity、inspect、submission、3軸absence、cleanupおよびrecoveryの正負・境界試験と固定環境integration",
    "Docker CLI／image／mount／lifecycle／recovery変更時",
  ),
  "40_Develop/coordinator/src/security/provider-lifecycle.ts": obligation(
    "合成候補の複合fail-closed述語の全短絡順序を同一runで到達していない",
    "入力shapeまたは上限の稀な不正形を同じ固定reasonへ閉じる分岐の退行",
    "Provider、mode、状態、入出力、deadline、cancel、結果およびquotaの正負・境界試験",
    "Provider lifecycle contractまたは上限変更時",
  ),
  "40_Develop/coordinator/src/security/execution-environment.ts": obligation(
    "OS別link／junction、回復recordおよび全cleanup failureを同一runで到達していない",
    "mount元置換または部分回復時に所有外entryへ影響する可能性",
    "owned root／child Identity、unknown entry、link置換、部分削除およびHost recovery試験",
    "Operation directory、mount capabilityまたはcleanup変更時",
  ),
  "40_Develop/coordinator/src/security/host-recovery-record.ts": obligation(
    "全Filesystem errorとrecord置換競合を同一runで到達していない",
    "回復状態またはrecord Identityの稀な差を誤分類する可能性",
    "record canonicality、Hash、state transition、置換、失敗および再利用拒否試験",
    "Host recovery schemaまたは遷移変更時",
  ),
  "40_Develop/coordinator/src/security/plain-data-snapshot.ts": obligation(
    "未到達分岐がある場合はreflection failureの稀な順序である",
    "動的入力の一部を実行する可能性",
    "record／arrayのshape、accessor、Proxy、reflection failureおよび上限試験",
    "plain-data snapshot実装変更時",
  ),
  "40_Develop/coordinator/src/core/doctor.ts": obligation(
    "実Docker成功、全Git／Provider discovery形式および全cleanup failureを同一runで到達していない",
    "private reportの状態またはreason投影が稀な環境で不一致になる可能性",
    "passive／isolation、CLI discovery、readiness、runtime request、Fake lifecycleおよびexact report contract試験",
    "doctor report、check、Provider投影またはDocker接続変更時",
  ),
  "40_Develop/coordinator/scripts/verify-dynamic-fake-provider-failures.ts":
    obligation(
      "実Docker Engine不成立、scenario mismatchおよびmain guard failureをunit coverageで全到達していない",
      "専用verificationが失敗結果または残留を誤って成功へ集約する可能性",
      "固定scenario母集団、期待reason、cleanup、Effect、Authority非発行および実Docker E2E",
      "failure scenario、Docker lifecycleまたはverification出力変更時",
    ),
  "40_Develop/coordinator/scripts/verify-dynamic-fake-provider-cancellation.ts":
    obligation(
      "実Docker取消verificationの正常経路はunit coverage runで発火しない",
      "固定Fake取消の実環境差をunit結果へ誤投影する可能性",
      "固定Docker Engine上の明示verification command、三軸container不存在およびHost cleanup確認",
      "Docker CLI、固定image、取消signalまたはcleanup変更時",
    ),
  "40_Develop/coordinator/scripts/check-platform-access-ts-coverage.ts":
    obligation(
      "共有LCOV parserの全Filesystem／child process errorと全不正record組合せを同一runで到達していない",
      "品質記録の不正入力を稀な組合せで受理または誤分類する可能性",
      "exact source母集団、LCOV grammar、summary、BRDA、上限およびserializerの正負・境界試験",
      "LCOV parser、Node coverage形式または固定母集団契約変更時",
    ),
  "40_Develop/coordinator/scripts/check-dynamic-fake-provider-coverage.ts":
    obligation(
      "runnerのchild process失敗、非決定出力およびRepository root差を実runで意図的に発火していない",
      "品質記録生成が環境差または失敗を安全に分類できない可能性",
      "固定source／test母集団、compact serializer、main guardおよび2回一致のcontract試験と実coverage command",
      "dynamic Fake Provider coverage runner、母集団または実行環境変更時",
    ),
} satisfies Readonly<Record<string, CoverageObligation>>);

/**
 * fixed Environmentを決定する。
 *
 * @responsibility fixed Environmentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
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
 * Onceを観測する。
 *
 * @responsibility Onceの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
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
      ...DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES.map(
        (source) => `--test-coverage-include=${source}`,
      ),
      ...DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS,
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
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 0 ||
    typeof result.stdout !== "string" ||
    typeof result.stderr !== "string" ||
    result.stderr.length !== 0
  ) {
    throw new Error("dynamic Fake Provider coverage command failed");
  }
  return parseExactTsCoverageLcov(result.stdout, {
    sources: DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES,
    obligations: coverageObligations,
  });
}

/**
 * Dynamic Fake Provider Coverageを観測する。
 *
 * @responsibility Dynamic Fake Provider Coverageの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns inspectDynamicFakeProviderCoverageの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinspectDynamicFakeProviderCoverageの入力契約を満たす。
 * @postcondition inspectDynamicFakeProviderCoverageの責務を完了した結果だけを返す。
 * @effect inspectDynamicFakeProviderCoverageはFilesystemの読取りまたは書込みを実行する。
 * @failure inspectDynamicFakeProviderCoverageは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDynamicFakeProviderCoverageは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: inspectDynamicFakeProviderCoverageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectDynamicFakeProviderCoverageは共有非同期状態を持たない同期処理である。
 */
export function inspectDynamicFakeProviderCoverage() {
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
    throw new Error(
      "dynamic Fake Provider coverage output is not deterministic",
    );
  }
  return Object.freeze({
    sourcePopulation: DYNAMIC_FAKE_PROVIDER_COVERAGE_SOURCES,
    testPopulation: DYNAMIC_FAKE_PROVIDER_COVERAGE_TESTS,
    coverage: first,
    reproducibility: Object.freeze({
      consecutiveRuns: 2,
      payloadSha256: createHash("sha256").update(payload).digest("hex"),
    }),
  });
}

/**
 * Dynamic Fake Provider Coverageを固定byte表現へ直列化する。
 *
 * @responsibility Dynamic Fake Provider Coverageの入力値、直列化規則、出力境界を所有する。
 * @trace ARCH-000004
 * @input value: ReturnType<typeof inspectDynamicFakeProviderCoverage>
 * @returns serializeDynamicFakeProviderCoverageの計算結果を返す。
 * @precondition 「value: ReturnType<typeof inspectDynamicFakeProviderCoverage>」がserializeDynamicFakeProviderCoverageの入力契約を満たす。
 * @postcondition serializeDynamicFakeProviderCoverageの責務を完了した結果だけを返す。
 * @effect N/A: serializeDynamicFakeProviderCoverageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: serializeDynamicFakeProviderCoverageは独自の失敗分岐を所有しない。
 * @invariant serializeDynamicFakeProviderCoverageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: serializeDynamicFakeProviderCoverageはProcess内の同一Subsystemで完結する。
 * @security N/A: serializeDynamicFakeProviderCoverageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: serializeDynamicFakeProviderCoverageは共有非同期状態を持たない同期処理である。
 */
export function serializeDynamicFakeProviderCoverage(
  value: ReturnType<typeof inspectDynamicFakeProviderCoverage>,
) {
  return `${JSON.stringify(value)}\n`;
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    serializeDynamicFakeProviderCoverage(inspectDynamicFakeProviderCoverage()),
  );
}
