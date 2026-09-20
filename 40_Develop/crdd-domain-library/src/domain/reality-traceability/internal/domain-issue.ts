import path from "node:path";

import type { DomainIssue } from "../../result/index.ts";

export type RealityIssueDetails = Readonly<{
  "discovery.manifest.json-invalid": { subsystem: string };
  "discovery.manifest.subsystem-mismatch": {
    expectedSubsystem: string;
    actualSubsystem: string;
  };
  "discovery.symbol.source-unobservable": {
    symbolId: string;
    symbolPath: string;
  };
  "manifest.root.value-shape": Record<string, never>;
  "manifest.property.not-declared": {
    scope: "root" | "symbol";
    property: string;
  };
  "manifest.contract.not-supported": Record<string, never>;
  "manifest.revision.not-supported": Record<string, never>;
  "manifest.subsystem.identity-shape": Record<string, never>;
  "manifest.symbols.value-shape": Record<string, never>;
  "manifest.symbol.value-shape": Record<string, never>;
  "manifest.symbol.identity-shape": Record<string, never>;
  "manifest.symbol.kind-not-supported": { kind: string };
  "manifest.symbol.path-not-safe": Record<string, never>;
  "manifest.relation.value-shape": { property: string };
  "manifest.relation.identity-shape": { property: string };
  "manifest.relation.identity-duplicate": { property: string };
  "manifest.test.relation-missing": Record<string, never>;
  "manifest.implementation.architecture-relation-missing": Record<
    string,
    never
  >;
  "manifest.implementation.relation-domain-invalid": Record<string, never>;
  "manifest.test.meaning-relation-domain-invalid": Record<string, never>;
  "graph.symbol.identity-duplicate": { symbolId: string };
  "graph.architecture.identity-unresolved": { identity: string };
  "graph.quality.identity-unresolved": { identity: string };
  "graph.test.catalog-registration-missing": { symbolId: string };
  "graph.test.catalog-owner-mismatch": {
    symbolId: string;
    actualOwner: string;
    expectedOwner: string;
  };
  "graph.quality.local-test-identity-unresolved": {
    localTestId: string;
    symbolId: string;
  };
  "graph.verification.target-unresolved": {
    symbolId: string;
    targetId: string;
  };
  "graph.verification.target-domain-invalid": { symbolId: string };
  "graph.input.snapshot-unavailable": Record<string, never>;
  "annotation.relation.domain-invalid": { symbolId: string };
  "annotation.architecture.relation-mismatch": { symbolId: string };
  "annotation.quality.relation-mismatch": { symbolId: string };
  "input.location.not-repository-relative": Record<string, never>;
}>;

export type RealityIssueKind = keyof RealityIssueDetails;

export function isSafeDomainLocation(candidate: string): boolean {
  const repositoryPath = candidate.split("#", 1)[0];
  if (
    !repositoryPath ||
    repositoryPath.includes("\\") ||
    path.posix.isAbsolute(repositoryPath) ||
    path.win32.isAbsolute(repositoryPath) ||
    /^[A-Za-z]:/u.test(repositoryPath)
  )
    return false;
  const segments = repositoryPath.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

export function createRealityDomainIssue<K extends RealityIssueKind>(
  kind: K,
  location: string,
  targetIdentity: string,
  reason: string,
  details: RealityIssueDetails[K],
): DomainIssue {
  return {
    kind,
    targetIdentity,
    location: { path: location },
    reason,
    details,
  };
}

export function invalidDomainLocationIssue(): DomainIssue {
  return createRealityDomainIssue(
    "input.location.not-repository-relative",
    "",
    "reality-input",
    "repository_relative_path_required",
    {},
  );
}
