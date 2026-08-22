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
export const PROVIDER_HOME_COVERAGE_MINIMUM_NODE_VERSION = "24.12.0";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");

export const PROVIDER_HOME_COVERAGE_SOURCES = Object.freeze([
  "tools/coordinator/src/security/authority-root-path-lexical.ts",
  "tools/coordinator/src/security/plain-data-snapshot.ts",
  "tools/coordinator/src/security/provider-home.ts",
  "tools/coordinator/src/security/provider-home-mount-grant.ts",
  "tools/coordinator/src/security/provider-home-mount-grant-store.ts",
  "tools/coordinator/src/security/provider-lifecycle.ts",
  "tools/coordinator/src/core/doctor.ts",
  "tools/coordinator/scripts/check-platform-access-ts-coverage.ts",
  "tools/coordinator/scripts/check-provider-home-coverage.ts",
]);

export const PROVIDER_HOME_COVERAGE_TESTS = Object.freeze([
  "tools/coordinator/tests/authority-root-path-lexical.contract.test.ts",
  "tools/coordinator/tests/plain-data-snapshot.contract.test.ts",
  "tools/coordinator/tests/provider-home.contract.test.ts",
  "tools/coordinator/tests/provider-home-mount-grant.contract.test.ts",
  "tools/coordinator/tests/provider-home-mount-grant-store.contract.test.ts",
  "tools/coordinator/tests/provider-lifecycle.contract.test.ts",
  "tools/coordinator/tests/doctor.contract.test.ts",
  "tools/coordinator/tests/platform-access-ts-coverage.contract.test.ts",
  "tools/coordinator/tests/provider-home-coverage.contract.test.ts",
]);

const NODE_OPTIONS = Object.freeze([
  "--experimental-test-coverage",
  "--test",
  "--test-concurrency=1",
  "--experimental-test-isolation=none",
  "--test-reporter=lcov",
]);

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
  "tools/coordinator/src/security/authority-root-path-lexical.ts": obligation(
    "実行OSと反対側のplatform dispatchおよび全複合短絡を同一runで到達していない",
    "将来のPath規則変更で反対OSのdispatchまたは稀な不正segmentを誤分類する可能性",
    "Windows／POSIXの正負・境界fixture、予約名限定mapping全件およびProvider HomeのWindows利用側試験",
    "Path lexical規則、platform dispatchまたはProvider Home Root source変更時",
  ),
  "tools/coordinator/src/security/plain-data-snapshot.ts": obligation(
    "未到達分岐がある場合はreflection failureの稀な順序である",
    "動的入力の一部を実行する可能性",
    "record／arrayのshape、accessor、Proxy、reflection failureおよび上限試験",
    "plain-data snapshot実装変更時",
  ),
  "tools/coordinator/src/security/provider-home.ts": obligation(
    "未到達分岐なし",
    "現固定版のpure配置候補には追加残存riskなし",
    "Codex／Claude、Root境界、Path非出力、長さ、動的入力および非昇格試験",
    "Provider Home layout、Root source、Provider集合または保護Effect着手時",
  ),
  "tools/coordinator/src/security/provider-home-mount-grant.ts": obligation(
    "未到達分岐なしを目標に専用coverageで別途確認する",
    "一回限り遷移、bindingまたは期限判定の退行",
    "全状態、正規遷移、再利用拒否、binding差、期限境界、動的入力および非Effect試験",
    "Mount Grant record、遷移、利用判定またはEffect Adapter変更時",
  ),
  "tools/coordinator/src/security/provider-home-mount-grant-store.ts":
    obligation(
      "Filesystem障害、lock残留および時刻競合の全組合せは同一runで発火しない",
      "Grantの安全な一回消費または失効が稀なFilesystem障害で停止する可能性",
      "発行、一回消費、二重消費拒否、失効、観測差、重複storeおよび無効Capability試験",
      "Mount Grant store、clock、issuer、消費、失効またはmount統合変更時",
    ),
  "tools/coordinator/src/security/provider-lifecycle.ts": obligation(
    "合成候補の複合fail-closed述語の全短絡順序を同一runで到達していない",
    "入力shapeまたは上限の稀な不正形を同じ固定reasonへ閉じる分岐の退行",
    "Provider、mode、状態、入出力、deadline、cancel、結果、quotaおよび専用Home投影試験",
    "Provider lifecycle、Provider Homeまたは実Provider binding変更時",
  ),
  "tools/coordinator/src/core/doctor.ts": obligation(
    "実Docker、全Git／Provider discovery形式および全cleanup failureを同一runで到達していない",
    "private reportのProvider Home状態またはreason投影が稀な環境で不一致になる可能性",
    "passive／isolation、discovery、readiness、runtime request、Fake lifecycleおよびexact report contract試験",
    "doctor report、Provider Home投影またはproduction consumer追加時",
  ),
  "tools/coordinator/scripts/check-platform-access-ts-coverage.ts": obligation(
    "共有LCOV parserの全Filesystem／child process errorと全不正record組合せを同一runで到達していない",
    "品質記録の不正入力を稀な組合せで受理または誤分類する可能性",
    "exact母集団、LCOV grammar、summary、BRDA、上限およびserializerの正負・境界試験",
    "LCOV parser、Node coverage形式または固定母集団契約変更時",
  ),
  "tools/coordinator/scripts/check-provider-home-coverage.ts": obligation(
    "runnerのchild process失敗、非決定出力およびRepository Root差を意図的に全発火していない",
    "品質記録生成が環境差または失敗を安全に分類できない可能性",
    "固定source／test母集団、compact serializer、main guard、2回一致および実coverage command",
    "Provider Home coverage runner、母集団または実行環境変更時",
  ),
} satisfies Readonly<Record<string, CoverageObligation>>);

function fixedEnvironment() {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of ["SYSTEMROOT", "SystemRoot", "WINDIR", "TEMP", "TMP"]) {
    const value = process.env[name];
    if (value) environment[name] = value;
  }
  return environment;
}

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
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 0 ||
    typeof result.stdout !== "string" ||
    typeof result.stderr !== "string" ||
    result.stderr.length !== 0
  ) {
    throw new Error("Provider Home coverage command failed");
  }
  return parseExactTsCoverageLcov(result.stdout, {
    sources: PROVIDER_HOME_COVERAGE_SOURCES,
    obligations: coverageObligations,
  });
}

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
