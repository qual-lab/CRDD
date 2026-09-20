import type { DomainIssue } from "../outcome.ts";
import { createRealityDomainIssue } from "./domain-issue.ts";
import type { RealitySymbol } from "./symbol-manifest-model.ts";

export type RealitySymbolAnnotations = Readonly<{
  archIds: ReadonlySet<string>;
  qaIds: ReadonlySet<string>;
}>;

export function extractRealitySymbolAnnotations(
  source: string,
): RealitySymbolAnnotations {
  const archIds = new Set<string>();
  const qaIds = new Set<string>();
  for (const match of source.matchAll(
    /^\s*\/\/\s*@crdd\s+(ARCH-[0-9]{6}|QA-[0-9]{6})\s*$/gmu,
  )) {
    const identity = match[1];
    if (identity?.startsWith("ARCH-")) archIds.add(identity);
    else if (identity?.startsWith("QA-")) qaIds.add(identity);
  }
  return { archIds, qaIds };
}

function equalIdentitySets(
  actual: ReadonlySet<string>,
  expectedIdentities: readonly string[],
): boolean {
  return (
    actual.size === expectedIdentities.length &&
    expectedIdentities.every((identity) => actual.has(identity))
  );
}

export function validateRealitySymbolAnnotations(
  symbol: RealitySymbol,
  source: string,
  manifestPath: string,
): readonly DomainIssue[] {
  const annotations = extractRealitySymbolAnnotations(source);
  const issues: DomainIssue[] = [];
  const isTestSymbol =
    symbol.kind === "test-suite" || symbol.kind === "test-case";
  if (!isTestSymbol && annotations.qaIds.size > 0)
    issues.push(
      createRealityDomainIssue(
        "annotation.relation.domain-invalid",
        manifestPath,
        symbol.symbolId,
        "implementation_must_not_use_quality_annotation",
        { symbolId: symbol.symbolId },
      ),
    );
  if (isTestSymbol && annotations.archIds.size > 0)
    issues.push(
      createRealityDomainIssue(
        "annotation.relation.domain-invalid",
        manifestPath,
        symbol.symbolId,
        "test_must_not_use_architecture_annotation",
        { symbolId: symbol.symbolId },
      ),
    );
  if (
    !isTestSymbol &&
    annotations.archIds.size > 0 &&
    !equalIdentitySets(annotations.archIds, symbol.archIds)
  )
    issues.push(
      createRealityDomainIssue(
        "annotation.architecture.relation-mismatch",
        manifestPath,
        symbol.symbolId,
        "architecture_annotation_differs_from_manifest",
        { symbolId: symbol.symbolId },
      ),
    );
  if (
    isTestSymbol &&
    annotations.qaIds.size > 0 &&
    !equalIdentitySets(annotations.qaIds, symbol.qaIds)
  )
    issues.push(
      createRealityDomainIssue(
        "annotation.quality.relation-mismatch",
        manifestPath,
        symbol.symbolId,
        "quality_annotation_differs_from_manifest",
        { symbolId: symbol.symbolId },
      ),
    );
  return issues;
}
