/**
 * compile-semantic-coverage-pilotに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { verifyRepositoryRoot } from "../../version-control/src/repository-identity/index.ts";
import { observeRealitySymbolRepository } from "../../crdd-domain-library/src/repository-observation/index.ts";
import {
  compileQualitySemanticRelationsFromRepository,
  compileSemanticIrFromRepository,
  createFilesystemSemanticBundlePublisher,
  createSemanticBundle,
  createSemanticCoverageGraph,
  publishSemanticCoverage,
} from "../src/index.ts";

const semanticCoverageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(semanticCoverageRoot, "../..");
const verifiedRepository = verifyRepositoryRoot(repositoryRoot);
if (verifiedRepository.status !== "completed")
  throw new Error(
    `semantic_coverage_repository_root_unverified:${verifiedRepository.reason}`,
  );
const pilots = [
  {
    subsystem: "coordinator",
    sourceDocument: "06_Architecture/Details/coordinator/01_Architecture.md",
  },
  {
    subsystem: "project-runtime",
    sourceDocument:
      "06_Architecture/Details/project-runtime/02_Detailed_Design.md",
  },
] as const;
const qualitySources = [
  "07_Quality/Definitions/QA-000003/quality_definition.md",
  "07_Quality/Definitions/QA-000004/quality_definition.md",
  "07_Quality/Definitions/QA-000005/quality_definition.md",
  "07_Quality/Definitions/QA-000006/quality_definition.md",
  "07_Quality/Definitions/QA-000010/quality_definition.md",
] as const;

const OUTPUT_RELATIVE_PATH = "07_Quality/Registry/semantic-coverage-pilot.json";
const symbolDiscovery = observeRealitySymbolRepository(
  verifiedRepository.capability,
);
const results = pilots.map((pilot) => ({
  ...pilot,
  result: compileSemanticIrFromRepository(
    verifiedRepository.capability,
    pilot.sourceDocument,
    pilot.subsystem,
    symbolDiscovery.knownArchIds,
  ),
}));
const findings = results.flatMap(({ result }) => result.findings);
const semanticIrs = results
  .map(({ result }) => result.ir)
  .filter((ir) => ir !== null);
const qualityRelations = compileQualitySemanticRelationsFromRepository(
  verifiedRepository.capability,
  qualitySources,
  semanticIrs,
);
const coverage = createSemanticCoverageGraph(
  semanticIrs,
  symbolDiscovery.manifests,
  qualityRelations.relations ?? [],
  [
    ...symbolDiscovery.repositoryIssues.map(({ code, path, reason }) => ({
      code,
      path,
      message: reason,
    })),
    ...symbolDiscovery.domainIssues.map((issue) => ({
      code: issue.kind,
      path: issue.location.path,
      message: issue.reason,
    })),
    ...qualityRelations.findings,
  ],
);
const allFindings = [...findings, ...coverage.findings];
if (allFindings.length > 0) {
  process.stderr.write(
    `${JSON.stringify({ findings: allFindings }, null, 2)}\n`,
  );
  process.exitCode = 1;
} else if (process.argv.includes("--write")) {
  if (!coverage.graph)
    throw new Error("Semantic coverage graph is unavailable");
  publishSemanticCoverage(
    {
      outputRelativePath: OUTPUT_RELATIVE_PATH,
      semanticIrs,
      coverage: coverage.graph,
    },
    createFilesystemSemanticBundlePublisher(verifiedRepository.capability),
  );
  process.stdout.write(
    `${JSON.stringify({ status: "created", count: results.length }, null, 2)}\n`,
  );
} else {
  process.stdout.write(
    `${JSON.stringify(
      {
        semanticIrs: results.map(({ result }) => result.ir),
        coverage: coverage.graph
          ? createSemanticBundle(semanticIrs, coverage.graph).coverage
          : null,
      },
      null,
      2,
    )}\n`,
  );
}
