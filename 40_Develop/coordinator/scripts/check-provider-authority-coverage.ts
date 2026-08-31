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

export const PROVIDER_AUTHORITY_COVERAGE_SOURCES = Object.freeze([
  "40_Develop/coordinator/src/security/provider-isolation-profile.ts",
  "40_Develop/coordinator/src/security/authority-grant-verifier.ts",
  "40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts",
  "40_Develop/coordinator/src/security/local-personal-authority-runtime.ts",
  "40_Develop/coordinator/src/security/provider-authority-runtime.ts",
  "40_Develop/coordinator/src/security/plain-data-snapshot.ts",
]);

export const PROVIDER_AUTHORITY_COVERAGE_TESTS = Object.freeze([
  "40_Develop/coordinator/tests/plain-data-snapshot.contract.test.ts",
  "40_Develop/coordinator/tests/provider-isolation-profile.contract.test.ts",
  "40_Develop/coordinator/tests/authority-grant-verifier.contract.test.ts",
  "40_Develop/coordinator/tests/authority-trust-loader.contract.test.ts",
  "40_Develop/coordinator/tests/authority-file-bundle.contract.test.ts",
  "40_Develop/coordinator/tests/authority-prelaunch-verifier.contract.test.ts",
  "40_Develop/coordinator/tests/egress-proxy-policy.contract.test.ts",
  "40_Develop/coordinator/tests/local-personal-authority-runtime.contract.test.ts",
  "40_Develop/coordinator/tests/provider-authority-runtime.contract.test.ts",
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
  "40_Develop/coordinator/src/security/provider-isolation-profile.ts":
    obligation(
      "複合fail-closed述語の全短絡順序と防御的catchを同一runで到達していない",
      "Profile shapeまたは専用Homeマウント許可参照の稀な不正形を同じ固定reasonへ閉じる分岐の退行",
      "Profile revision 3、旧revision、namespace、Provider・Profile・Operation結合、上限および動的入力の正負・境界試験",
      "Profile Schema、専用Homeマウント許可またはplain-data境界変更時",
    ),
  "40_Develop/coordinator/src/security/authority-grant-verifier.ts": obligation(
    "複合fail-closed述語の全短絡順序と防御的catchを同一runで到達していない",
    "Registry、Grant、contextまたは四者結合の稀な不正形を同じ固定reasonへ閉じる分岐の退行",
    "Registry revision 3、参照重複、時刻、Provider・Profile・Operation・Scope・mount参照結合および上限試験",
    "Registry Schema、Authority context、Grant評価またはplain-data境界変更時",
  ),
  "40_Develop/coordinator/src/security/authority-prelaunch-verifier.ts":
    obligation(
      "Runtime時計failure、全Bundle failureおよび全context短絡を同一runで到達していない",
      "起動直前のAuthority contextまたはBundle結合の稀なfailureを誤分類する可能性",
      "Provider・Profile・Operation・Scope・mount参照の正負・境界、Bundle不一致、失効Grantおよび動的入力試験",
      "Prelaunch context、Runtime時計、File BundleまたはProvider launch結合変更時",
    ),
  "40_Develop/coordinator/src/security/provider-authority-runtime.ts":
    obligation(
      "防御的catch、乱数衝突および全ての不正shape短絡を同一runで到達していない",
      "短命Capabilityの発行・消費・失効または再検証の稀なfailureを誤分類する可能性",
      "発行・一回消費・失効、5秒境界、時計後退、Authority差替え、Mount失効、binding不一致およびproduction停止試験",
      "Runtime Authority lifetime、Authority source loader、Mount inspectionまたはProvider Effect結合変更時",
    ),
  "40_Develop/coordinator/src/security/local-personal-authority-runtime.ts":
    obligation(
      "署名済み配布物の実production成功分岐と暗号乱数失敗をcomponent coverageで到達していない",
      "公式署名Releaseへの結合または短命Local Personal Bundle生成の稀なfailureを誤分類する可能性",
      "隔離dependencyによるRelease確認、固定Profile、source期限、Grant期限、Provider差、時計差およびproduction source checkout停止試験",
      "Release manifest verifier、固定Profile、Authority source lifetimeまたはLocal Personal Trust境界変更時",
    ),
  "40_Develop/coordinator/src/security/plain-data-snapshot.ts": obligation(
    "未到達分岐なし",
    "現固定版では追加残存riskなし",
    "record／arrayのshape、accessor、Proxy、reflection failureおよび上限試験",
    "plain-data snapshot実装変更時",
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

function inspectOnce() {
  const result = spawnSync(
    process.execPath,
    [
      ...NODE_OPTIONS,
      ...PROVIDER_AUTHORITY_COVERAGE_SOURCES.map(
        (source) => `--test-coverage-include=${source}`,
      ),
      ...PROVIDER_AUTHORITY_COVERAGE_TESTS,
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
    throw new Error("provider authority coverage command failed");
  }
  return parseExactTsCoverageLcov(result.stdout, {
    sources: PROVIDER_AUTHORITY_COVERAGE_SOURCES,
    obligations: coverageObligations,
  });
}

export function inspectProviderAuthorityCoverage() {
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
    throw new Error("provider authority coverage output is not deterministic");
  }
  return Object.freeze({
    sourcePopulation: PROVIDER_AUTHORITY_COVERAGE_SOURCES,
    testPopulation: PROVIDER_AUTHORITY_COVERAGE_TESTS,
    coverage: first,
    reproducibility: Object.freeze({
      consecutiveRuns: 2,
      payloadSha256: createHash("sha256").update(payload).digest("hex"),
    }),
  });
}

export function serializeProviderAuthorityCoverage(
  value: ReturnType<typeof inspectProviderAuthorityCoverage>,
) {
  return `${JSON.stringify(value)}\n`;
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  import.meta.url === pathToFileURL(path.resolve(invokedPath)).href
) {
  process.stdout.write(
    serializeProviderAuthorityCoverage(inspectProviderAuthorityCoverage()),
  );
}
