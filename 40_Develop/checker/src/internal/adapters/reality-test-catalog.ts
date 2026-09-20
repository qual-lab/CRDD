import {
  createFilesystemRepositoryObservationPort,
  type RepositoryObservationPort,
} from "../../../../crdd-domain-library/src/repository/index.ts";
import type { VerifiedRepositoryRoot } from "../../../../version-control/src/index.ts";

import type { CheckerRealityFinding } from "./reality-traceability.ts";

export type RegisteredRealityTest = Readonly<{
  owner: string;
  testId: string;
}>;

export function readRegisteredRealityTests(
  capability: VerifiedRepositoryRoot,
): ReturnType<typeof readRegisteredRealityTestsFromRepository> {
  return readRegisteredRealityTestsFromRepository(
    createFilesystemRepositoryObservationPort(capability),
  );
}

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
