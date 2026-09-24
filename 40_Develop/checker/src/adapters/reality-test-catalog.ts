/**
 * reality-test-catalogに属する責務をまとめる。
 *
 * @responsibility RegisteredRealityTestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */
import {
  createFilesystemRepositoryObservationPort,
  type RepositoryObservationPort,
} from "../../../crdd-domain-library/src/repository-observation/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";

import type { CheckerRealityFinding } from "./reality-traceability.ts";

/**
 * reality-test-catalogで使用するRegistered Reality Testの値契約を定義する。
 *
 * @responsibility Registered Reality TestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape RegisteredRealityTestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RegisteredRealityTestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RegisteredRealityTestの宣言は外部境界を開かない。
 * @security N/A: RegisteredRealityTestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RegisteredRealityTestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RegisteredRealityTest = Readonly<{
  owner: string;
  testId: string;
}>;

/**
 * Registered Reality Testsを読み取る。
 *
 * @responsibility Registered Reality Testsの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000001
 * @input capability: VerifiedRepositoryRoot
 * @returns ReturnType<typeof readRegisteredRealityTestsFromRepository>を返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がreadRegisteredRealityTestsの入力契約を満たす。
 * @postcondition readRegisteredRealityTestsの責務を完了した結果だけを返す。
 * @effect N/A: readRegisteredRealityTestsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readRegisteredRealityTestsは独自の失敗分岐を所有しない。
 * @invariant readRegisteredRealityTestsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security readRegisteredRealityTestsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readRegisteredRealityTestsは共有非同期状態を持たない同期処理である。
 */
export function readRegisteredRealityTests(
  capability: VerifiedRepositoryRoot,
): ReturnType<typeof readRegisteredRealityTestsFromRepository> {
  return readRegisteredRealityTestsFromRepository(
    createFilesystemRepositoryObservationPort(capability),
  );
}

/**
 * Registered Reality Tests From Repositoryを読み取る。
 *
 * @responsibility Registered Reality Tests From Repositoryの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000001
 * @input repository: RepositoryObservationPort
 * @returns Readonly<{ testsByPath: ReadonlyMap<string, RegisteredRealityTest> | null; findings: readonly CheckerRealityFinding[]; }>を返す。
 * @precondition 「repository: RepositoryObservationPort」がreadRegisteredRealityTestsFromRepositoryの入力契約を満たす。
 * @postcondition readRegisteredRealityTestsFromRepositoryの責務を完了した結果だけを返す。
 * @effect N/A: readRegisteredRealityTestsFromRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readRegisteredRealityTestsFromRepositoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readRegisteredRealityTestsFromRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: readRegisteredRealityTestsFromRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRegisteredRealityTestsFromRepositoryは共有非同期状態を持たない同期処理である。
 */
export function readRegisteredRealityTestsFromRepository(
  repository: RepositoryObservationPort,
): Readonly<{
  testsByPath: ReadonlyMap<string, RegisteredRealityTest> | null;
  findings: readonly CheckerRealityFinding[];
}> {
  const catalogRelativePath = "07_Quality/Registry/test-catalog.json";
  const findings: CheckerRealityFinding[] = [];
  const testsByPath = new Map<string, RegisteredRealityTest>();
  const observation = repository.observeFile(catalogRelativePath);
  if (observation.status !== "resolved")
    return {
      testsByPath: null,
      findings: [
        {
          code:
            observation.status === "invalid"
              ? "reality-symbol-test-catalog-boundary-invalid"
              : "reality-symbol-test-catalog-unobservable",
          path: catalogRelativePath,
          message: `Test Catalog is not a repository-local regular file: ${observation.reason}.`,
        },
      ],
    };
  let value: unknown;
  try {
    value = JSON.parse(observation.source);
  } catch {
    return {
      testsByPath: null,
      findings: [
        {
          code: "reality-symbol-test-catalog-unobservable",
          path: catalogRelativePath,
          message: "Test Catalog could not be read as valid JSON.",
        },
      ],
    };
  }
  if (
    typeof value !== "object" ||
    value === null ||
    !("tests" in value) ||
    !Array.isArray(value.tests)
  )
    return {
      testsByPath: null,
      findings: [
        {
          code: "reality-symbol-test-catalog-invalid",
          path: catalogRelativePath,
          message: "Test Catalog must provide a tests array.",
        },
      ],
    };
  for (const entry of value.tests) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("id" in entry) ||
      typeof entry.id !== "string" ||
      !("owner" in entry) ||
      typeof entry.owner !== "string" ||
      !("path" in entry) ||
      typeof entry.path !== "string"
    ) {
      findings.push({
        code: "reality-symbol-test-catalog-entry-invalid",
        path: catalogRelativePath,
        message:
          "Every Test Catalog entry must provide string id, owner, and path.",
      });
      continue;
    }
    if (testsByPath.has(entry.path)) {
      findings.push({
        code: "reality-symbol-test-catalog-path-duplicate",
        path: catalogRelativePath,
        message: `Test path ${entry.path} is registered more than once.`,
      });
      continue;
    }
    testsByPath.set(entry.path, { owner: entry.owner, testId: entry.id });
  }
  return {
    testsByPath: findings.length === 0 ? testsByPath : null,
    findings,
  };
}
