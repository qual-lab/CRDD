import type {
  RealitySymbol,
  RealitySymbolFinding,
} from "./symbol-manifest-model.ts";

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
): readonly RealitySymbolFinding[] {
  const annotations = extractRealitySymbolAnnotations(source);
  const findings: RealitySymbolFinding[] = [];
  const isTestSymbol =
    symbol.kind === "test-suite" || symbol.kind === "test-case";
  if (!isTestSymbol && annotations.qaIds.size > 0)
    findings.push({
      code: "reality-symbol-annotation-domain-invalid",
      path: manifestPath,
      message: `${symbol.symbolId} is an implementation symbol and must not use Quality annotations.`,
    });
  if (isTestSymbol && annotations.archIds.size > 0)
    findings.push({
      code: "reality-symbol-annotation-domain-invalid",
      path: manifestPath,
      message: `${symbol.symbolId} is a test symbol and must not use Architecture annotations.`,
    });
  if (
    !isTestSymbol &&
    annotations.archIds.size > 0 &&
    !equalIdentitySets(annotations.archIds, symbol.archIds)
  )
    findings.push({
      code: "reality-symbol-annotation-architecture-mismatch",
      path: manifestPath,
      message: `${symbol.symbolId} has Architecture annotations that differ from symbol.json.`,
    });
  if (
    isTestSymbol &&
    annotations.qaIds.size > 0 &&
    !equalIdentitySets(annotations.qaIds, symbol.qaIds)
  )
    findings.push({
      code: "reality-symbol-annotation-quality-mismatch",
      path: manifestPath,
      message: `${symbol.symbolId} has Quality annotations that differ from symbol.json.`,
    });
  return findings;
}
