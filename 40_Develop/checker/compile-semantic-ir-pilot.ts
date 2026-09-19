import path from "node:path";
import { fileURLToPath } from "node:url";

import { compileSemanticIrPilot } from "../../template/tools/internal/semantic-coverage/semantic-ir-compiler.ts";
import {
  createSemanticCoveragePilotBundle,
  createSemanticCoveragePilotGraph,
  projectSemanticCoveragePilot,
} from "../../template/tools/internal/semantic-coverage/semantic-coverage-graph.ts";
import { publishSemanticCoverageBundle } from "../../template/tools/internal/semantic-coverage/semantic-bundle-writer.ts";
import { compileQualitySemanticRelations } from "../../template/tools/internal/semantic-coverage/quality-semantic-relation.ts";
import { discoverRealitySymbolManifests } from "../../template/tools/internal/reality-traceability/symbol-discovery.ts";

const checkerRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(checkerRoot, "../..");
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
const results = pilots.map((pilot) => ({
  ...pilot,
  result: compileSemanticIrPilot(
    repositoryRoot,
    pilot.sourceDocument,
    pilot.subsystem,
  ),
}));
const findings = results.flatMap(({ result }) => result.findings);
const semanticIrs = results
  .map(({ result }) => result.ir)
  .filter((ir) => ir !== null);
const qualityRelations = compileQualitySemanticRelations(
  repositoryRoot,
  qualitySources,
  semanticIrs,
);
const symbolDiscovery = discoverRealitySymbolManifests(repositoryRoot);
const coverage = createSemanticCoveragePilotGraph(
  semanticIrs,
  symbolDiscovery.manifests,
  qualityRelations.relations ?? [],
  [...symbolDiscovery.findings, ...qualityRelations.findings],
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
  const bundle = createSemanticCoveragePilotBundle(
    semanticIrs,
    projectSemanticCoveragePilot(coverage.graph),
  );
  publishSemanticCoverageBundle(
    repositoryRoot,
    OUTPUT_RELATIVE_PATH,
    `${JSON.stringify(bundle, null, 2)}\n`,
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
          ? projectSemanticCoveragePilot(coverage.graph)
          : null,
      },
      null,
      2,
    )}\n`,
  );
}
