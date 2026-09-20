import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import { createRealityDomainIssue } from "./domain-issue.ts";
import { validateRealitySymbolAnnotations } from "./symbol-annotation.ts";
import type { LoadedRealitySymbolManifest } from "./symbol-manifest-model.ts";
import { validateRealitySymbolManifest } from "./symbol-manifest-validator.ts";

export type RealitySymbolDiscoverySource = Readonly<{
  subsystem: string;
  subsystemPath: string;
  manifestPath: string;
  manifestSource: string;
  symbolSources: ReadonlyMap<string, string>;
}>;

export type RealitySymbolDiscoveryRequest = Readonly<{
  sources: readonly RealitySymbolDiscoverySource[];
  prerequisiteIssues: readonly DomainIssue[];
}>;

export type RealitySymbolDiscoveryResult = Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
}>;

export function discoverRealitySymbols(
  request: RealitySymbolDiscoveryRequest,
): DomainOutcome<RealitySymbolDiscoveryResult> {
  if (request.prerequisiteIssues.length > 0)
    return {
      status: "unobservable",
      result: null,
      issues: request.prerequisiteIssues,
    };

  const issues: DomainIssue[] = [];
  const manifests: LoadedRealitySymbolManifest[] = [];
  for (const source of [...request.sources].sort((left, right) =>
    left.subsystem.localeCompare(right.subsystem, "en"),
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(source.manifestSource);
    } catch {
      issues.push(
        createRealityDomainIssue(
          "discovery.manifest.json-invalid",
          source.manifestPath,
          source.subsystem,
          "manifest_source_is_not_valid_json",
          { subsystem: source.subsystem },
        ),
      );
      continue;
    }
    const validated = validateRealitySymbolManifest(
      parsed,
      source.manifestPath,
    );
    issues.push(...validated.issues);
    if (!validated.result) continue;
    if (validated.result.subsystem !== source.subsystem) {
      issues.push(
        createRealityDomainIssue(
          "discovery.manifest.subsystem-mismatch",
          source.manifestPath,
          source.subsystem,
          "manifest_subsystem_differs_from_discovered_subsystem",
          {
            expectedSubsystem: source.subsystem,
            actualSubsystem: validated.result.subsystem,
          },
        ),
      );
      continue;
    }
    let sourceComplete = true;
    for (const symbol of validated.result.symbols) {
      const symbolSource = source.symbolSources.get(symbol.path);
      if (symbolSource === undefined) {
        issues.push(
          createRealityDomainIssue(
            "discovery.symbol.source-unobservable",
            source.manifestPath,
            symbol.symbolId,
            "declared_symbol_source_was_not_observed",
            { symbolId: symbol.symbolId, symbolPath: symbol.path },
          ),
        );
        sourceComplete = false;
        continue;
      }
      const annotationIssues = validateRealitySymbolAnnotations(
        symbol,
        symbolSource,
        source.manifestPath,
      );
      issues.push(...annotationIssues);
      if (annotationIssues.length > 0) sourceComplete = false;
    }
    if (sourceComplete)
      manifests.push({
        manifestPath: source.manifestPath,
        subsystemRoot: source.subsystemPath,
        manifest: validated.result,
      });
  }

  return issues.length === 0
    ? { status: "complete", result: { manifests }, issues: [] }
    : { status: "invalid", result: null, issues };
}
