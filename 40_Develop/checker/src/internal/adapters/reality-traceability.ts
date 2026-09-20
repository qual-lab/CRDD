import type { DomainIssue } from "../../../../crdd-domain-library/src/domain/result/index.ts";
import {
  createRealitySymbolGraph as createDomainRealitySymbolGraph,
  discoverRealitySymbols as discoverDomainRealitySymbols,
  type LoadedRealitySymbolManifest,
  type RealitySymbolGraph,
  validateRealitySymbolManifest as validateDomainRealitySymbolManifest,
} from "../../../../crdd-domain-library/src/domain/reality-traceability/index.ts";
import { createFilesystemRepositoryObservationPort } from "../../../../crdd-domain-library/src/repository/index.ts";
import type { VerifiedRepositoryRoot } from "../../../../version-control/src/index.ts";

export type CheckerRealityFinding = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export function mapRealityDomainIssueToCheckerFinding(
  issue: DomainIssue,
): CheckerRealityFinding {
  const value = (name: string) => {
    const candidate = issue.details[name];
    if (typeof candidate !== "string" || candidate.length === 0)
      throw new Error(
        `invalid_reality_domain_issue_details:${issue.kind}:${name}`,
      );
    return candidate;
  };
  const mappedFindingFields = (() => {
    switch (issue.kind) {
      case "discovery.manifest.json-invalid":
        return [
          "reality-symbol-manifest-json-invalid",
          `Subsystem ${value("subsystem")} symbol.json must contain valid JSON.`,
        ];
      case "discovery.manifest.subsystem-mismatch":
        return [
          "reality-symbol-subsystem-mismatch",
          `Manifest subsystem ${value("actualSubsystem")} does not match ${value("expectedSubsystem")}.`,
        ];
      case "discovery.symbol.source-unobservable":
        return [
          "reality-symbol-path-observation-failed",
          `${value("symbolId")} path ${value("symbolPath")} was not observed from the repository snapshot.`,
        ];
      case "manifest.root.value-shape":
        return [
          "symbol-manifest-root-invalid",
          "Symbol manifest must be a JSON object.",
        ];
      case "manifest.property.not-declared":
        return [
          "symbol-manifest-property-unknown",
          `Unknown ${value("scope")} property: ${value("property")}.`,
        ];
      case "manifest.contract.not-supported":
        return [
          "symbol-manifest-contract-invalid",
          "contract must be crdd/reality-symbol-manifest.",
        ];
      case "manifest.revision.not-supported":
        return [
          "symbol-manifest-revision-invalid",
          "contractRevision must be 1.",
        ];
      case "manifest.subsystem.identity-shape":
        return [
          "symbol-manifest-subsystem-invalid",
          "subsystem must use lower kebab-case.",
        ];
      case "manifest.symbols.value-shape":
        return [
          "symbol-manifest-symbols-invalid",
          "symbols must be a non-empty array.",
        ];
      case "manifest.symbol.value-shape":
        return [
          "symbol-manifest-symbol-invalid",
          "Symbol entry must be an object.",
        ];
      case "manifest.symbol.identity-shape":
        return [
          "symbol-manifest-symbol-id-invalid",
          "symbolId must be a dotted lower-case identity.",
        ];
      case "manifest.symbol.kind-not-supported":
        return [
          "symbol-manifest-kind-invalid",
          `Unsupported symbol kind: ${value("kind")}.`,
        ];
      case "manifest.symbol.path-not-safe":
        return [
          "symbol-manifest-path-invalid",
          "path must be a safe subsystem-relative path.",
        ];
      case "manifest.relation.value-shape":
        return [
          "symbol-manifest-property-invalid",
          `${value("property")} must be an array of strings.`,
        ];
      case "manifest.relation.identity-shape":
        return [
          "symbol-manifest-identity-invalid",
          `${value("property")} contains an invalid identity.`,
        ];
      case "manifest.relation.identity-duplicate":
        return [
          "symbol-manifest-array-duplicate",
          `${value("property")} must not contain duplicates.`,
        ];
      case "manifest.test.relation-missing":
        return [
          "symbol-manifest-test-relation-missing",
          "Test symbols require qaIds and verifies relations.",
        ];
      case "manifest.implementation.architecture-relation-missing":
        return [
          "symbol-manifest-architecture-relation-missing",
          "Implementation symbols require at least one archIds relation.",
        ];
      case "manifest.implementation.relation-domain-invalid":
        return [
          "symbol-manifest-implementation-relation-invalid",
          "Implementation symbols must not own qaIds, localTestIds, or verifies relations.",
        ];
      case "manifest.test.meaning-relation-domain-invalid":
        return [
          "symbol-manifest-test-meaning-relation-invalid",
          "Test symbols must not own implements relations.",
        ];
      case "graph.symbol.identity-duplicate":
        return [
          "reality-symbol-id-duplicate",
          `Duplicate symbolId: ${value("symbolId")}.`,
        ];
      case "graph.architecture.identity-unresolved":
        return [
          "reality-symbol-architecture-id-unknown",
          `Unknown Architecture identity: ${value("identity")}.`,
        ];
      case "graph.quality.identity-unresolved":
        return [
          "reality-symbol-quality-id-unknown",
          `Unknown Quality identity: ${value("identity")}.`,
        ];
      case "graph.test.catalog-registration-missing":
        return [
          "reality-symbol-test-catalog-registration-missing",
          `${value("symbolId")} is not registered by exact path in the Test Catalog.`,
        ];
      case "graph.test.catalog-owner-mismatch":
        return [
          "reality-symbol-test-catalog-owner-mismatch",
          `${value("symbolId")} is owned by ${value("actualOwner")} in the Test Catalog, not ${value("expectedOwner")}.`,
        ];
      case "graph.quality.local-test-identity-unresolved":
        return [
          "reality-symbol-local-test-id-unknown",
          `${value("localTestId")} is not defined by any Quality identity on ${value("symbolId")}.`,
        ];
      case "graph.verification.target-unresolved":
        return [
          "reality-symbol-verifies-target-missing",
          `${value("symbolId")} verifies missing symbol ${value("targetId")}.`,
        ];
      case "graph.verification.target-domain-invalid":
        return [
          "reality-symbol-verifies-target-invalid",
          `${value("symbolId")} must verify an implementation symbol.`,
        ];
      case "graph.input.snapshot-unavailable":
        return [
          "reality-symbol-graph-input-invalid",
          "Global Symbol Graph requires one valid Test Catalog snapshot.",
        ];
      case "annotation.relation.domain-invalid":
        if (
          issue.reason !== "implementation_must_not_use_quality_annotation" &&
          issue.reason !== "test_must_not_use_architecture_annotation"
        )
          throw new Error(
            `invalid_reality_domain_issue_reason:${issue.kind}:${issue.reason}`,
          );
        return [
          "reality-symbol-annotation-domain-invalid",
          issue.reason === "implementation_must_not_use_quality_annotation"
            ? `${value("symbolId")} is an implementation symbol and must not use Quality annotations.`
            : `${value("symbolId")} is a test symbol and must not use Architecture annotations.`,
        ];
      case "annotation.architecture.relation-mismatch":
        return [
          "reality-symbol-annotation-architecture-mismatch",
          `${value("symbolId")} has Architecture annotations that differ from symbol.json.`,
        ];
      case "annotation.quality.relation-mismatch":
        return [
          "reality-symbol-annotation-quality-mismatch",
          `${value("symbolId")} has Quality annotations that differ from symbol.json.`,
        ];
      case "input.location.not-repository-relative":
        return [
          "reality-domain-location-invalid",
          "Reality Domain input requires a repository-relative location.",
        ];
      default:
        throw new Error(`unknown_reality_domain_issue:${issue.kind}`);
    }
  })();
  return {
    code: mappedFindingFields[0],
    path: issue.location.path,
    message: mappedFindingFields[1],
  };
}

export function validateRealitySymbolManifest(
  value: unknown,
  manifestPath: string,
) {
  const outcome = validateDomainRealitySymbolManifest(value, manifestPath);
  return {
    manifest: outcome.result,
    findings: outcome.issues.map(mapRealityDomainIssueToCheckerFinding),
  };
}

export function createRealitySymbolGraph(
  loadedManifests: readonly LoadedRealitySymbolManifest[],
  knownArchIds: ReadonlySet<string>,
  knownQaIds: ReadonlySet<string>,
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>,
  registeredTestsByPath: ReadonlyMap<
    string,
    Readonly<{ owner: string; testId: string }>
  > | null,
  prerequisiteFindings: readonly CheckerRealityFinding[],
): Readonly<{
  graph: RealitySymbolGraph | null;
  findings: readonly CheckerRealityFinding[];
}> {
  if (prerequisiteFindings.length > 0)
    return { graph: null, findings: prerequisiteFindings };
  const outcome = createDomainRealitySymbolGraph(
    loadedManifests,
    knownArchIds,
    knownQaIds,
    knownLocalTestIdsByQaId,
    registeredTestsByPath,
    [],
  );
  return {
    graph: outcome.result,
    findings: outcome.issues.map(mapRealityDomainIssueToCheckerFinding),
  };
}

function observationFinding(
  code: string,
  path: string,
  reason: string,
): CheckerRealityFinding {
  return { code, path, message: reason };
}

export function discoverRealitySymbolManifests(
  capability: VerifiedRepositoryRoot,
): Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
  knownArchIds: ReadonlySet<string>;
  knownQaIds: ReadonlySet<string>;
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  findings: readonly CheckerRealityFinding[];
}> {
  const repository = createFilesystemRepositoryObservationPort(capability);
  const findings: CheckerRealityFinding[] = [];
  const identities = (directoryPath: string, pattern: RegExp) => {
    const observed = repository.observeDirectory(directoryPath);
    if (observed.status !== "resolved") {
      findings.push(
        observationFinding(
          "reality-symbol-canonical-definitions-unobservable",
          directoryPath,
          observed.reason,
        ),
      );
      return new Set<string>();
    }
    return new Set(
      observed.entries
        .filter(({ kind, name }) => kind === "directory" && pattern.test(name))
        .map(({ name }) => name),
    );
  };
  const knownArchIds = identities(
    "06_Architecture/Definitions",
    /^ARCH-[0-9]{6}$/u,
  );
  const knownQaIds = identities("07_Quality/Definitions", /^QA-[0-9]{6}$/u);
  const knownLocalTestIdsByQaId = new Map<string, ReadonlySet<string>>();
  for (const qaId of [...knownQaIds].sort()) {
    const definitionPath = `07_Quality/Definitions/${qaId}/quality_definition.md`;
    const observed = repository.observeFile(definitionPath);
    if (observed.status !== "resolved") {
      findings.push(
        observationFinding(
          "reality-symbol-quality-definition-unobservable",
          definitionPath,
          observed.reason,
        ),
      );
      continue;
    }
    const heading = /^## [0-9]+\. 検証項目\s*$/mu.exec(observed.source);
    const remainder = heading
      ? observed.source.slice(heading.index + heading[0].length)
      : "";
    const nextHeading = remainder.search(/^##\s/mu);
    const section =
      nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder;
    const localIds = new Set<string>();
    for (const line of section.split(/\r?\n/u)) {
      const match = /^\|\s*`([^`]+)`\s*\|/u.exec(line);
      if (match?.[1]) localIds.add(match[1]);
    }
    knownLocalTestIdsByQaId.set(qaId, localIds);
  }

  const develop = repository.observeDirectory("40_Develop");
  if (develop.status !== "resolved")
    return {
      manifests: [],
      knownArchIds,
      knownQaIds,
      knownLocalTestIdsByQaId,
      findings: [
        ...findings,
        observationFinding(
          "reality-symbol-develop-unobservable",
          "40_Develop",
          develop.reason,
        ),
      ],
    };

  const sources = [];
  for (const entry of develop.entries) {
    if (entry.kind === "symbolic-link") {
      findings.push(
        observationFinding(
          "reality-symbol-subsystem-boundary-invalid",
          `40_Develop/${entry.name}`,
          "Subsystem is a symbolic link or junction.",
        ),
      );
      continue;
    }
    if (entry.kind !== "directory") continue;
    const subsystemPath = `40_Develop/${entry.name}`;
    const subsystem = repository.observeDirectory(subsystemPath);
    if (subsystem.status !== "resolved") {
      findings.push(
        observationFinding(
          "reality-symbol-subsystem-observation-failed",
          subsystemPath,
          subsystem.reason,
        ),
      );
      continue;
    }
    const manifestPath = `${subsystemPath}/symbol.json`;
    if (!subsystem.entries.some(({ name }) => name === "symbol.json")) {
      findings.push(
        observationFinding(
          "reality-symbol-manifest-missing",
          manifestPath,
          `Subsystem ${entry.name} does not provide symbol.json.`,
        ),
      );
      continue;
    }
    const manifest = repository.observeFile(manifestPath);
    if (manifest.status !== "resolved") {
      findings.push(
        observationFinding(
          "reality-symbol-manifest-observation-failed",
          manifestPath,
          manifest.reason,
        ),
      );
      continue;
    }
    const symbolSources = new Map<string, string>();
    try {
      const validated = validateDomainRealitySymbolManifest(
        JSON.parse(manifest.source),
        manifestPath,
      );
      for (const symbol of validated.result?.symbols ?? []) {
        const observed = repository.observeFile(
          `${subsystemPath}/${symbol.path}`,
        );
        if (observed.status === "resolved")
          symbolSources.set(symbol.path, observed.source);
      }
    } catch {
      // The Domain discovery reports invalid JSON without fabricating symbols.
    }
    sources.push({
      subsystem: entry.name,
      subsystemPath,
      manifestPath,
      manifestSource: manifest.source,
      symbolSources,
    });
  }
  const discovered = discoverDomainRealitySymbols({
    sources,
    prerequisiteIssues: [],
  });
  return {
    manifests: discovered.result?.manifests ?? [],
    knownArchIds,
    knownQaIds,
    knownLocalTestIdsByQaId,
    findings: [
      ...findings,
      ...discovered.issues.map(mapRealityDomainIssueToCheckerFinding),
    ],
  };
}
