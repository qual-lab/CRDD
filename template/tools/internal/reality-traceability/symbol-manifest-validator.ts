import path from "node:path";

import {
  realitySymbolKinds,
  type RealitySymbol,
  type RealitySymbolFinding,
  type RealitySymbolKind,
  type RealitySymbolManifest,
} from "./symbol-manifest-model.ts";

const SUBSYSTEM_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const SYMBOL_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const ARCH_ID_PATTERN = /^ARCH-[0-9]{6}$/u;
const QA_ID_PATTERN = /^QA-[0-9]{6}$/u;
const LOCAL_TEST_ID_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]{2,6}$/u;
const SEMANTIC_KEY_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeRelativePath(value: string): boolean {
  if (value.length === 0 || value.includes("\\") || path.isAbsolute(value))
    return false;
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

function readUniqueStrings(
  owner: Record<string, unknown>,
  property: string,
  pattern: RegExp,
  location: string,
  findings: RealitySymbolFinding[],
): readonly string[] {
  const value = owner[property];
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    findings.push({
      code: "symbol-manifest-property-invalid",
      path: location,
      message: `${property} must be an array of strings.`,
    });
    return [];
  }
  const values = value as string[];
  if (values.some((entry) => !pattern.test(entry)))
    findings.push({
      code: "symbol-manifest-identity-invalid",
      path: location,
      message: `${property} contains an invalid identity.`,
    });
  if (new Set(values).size !== values.length)
    findings.push({
      code: "symbol-manifest-array-duplicate",
      path: location,
      message: `${property} must not contain duplicates.`,
    });
  return values;
}

export function validateRealitySymbolManifest(
  value: unknown,
  manifestPath: string,
): Readonly<{
  manifest: RealitySymbolManifest | null;
  findings: readonly RealitySymbolFinding[];
}> {
  const findings: RealitySymbolFinding[] = [];
  if (!isRecord(value))
    return {
      manifest: null,
      findings: [
        {
          code: "symbol-manifest-root-invalid",
          path: manifestPath,
          message: "Symbol manifest must be a JSON object.",
        },
      ],
    };
  const allowedRootKeys = new Set([
    "contract",
    "contractRevision",
    "subsystem",
    "symbols",
  ]);
  for (const key of Object.keys(value))
    if (!allowedRootKeys.has(key))
      findings.push({
        code: "symbol-manifest-property-unknown",
        path: manifestPath,
        message: `Unknown root property: ${key}.`,
      });
  const isContractValid = value.contract === "crdd/reality-symbol-manifest";
  const isRevisionValid = value.contractRevision === 1;
  const subsystem = typeof value.subsystem === "string" ? value.subsystem : "";
  const isSubsystemValid = SUBSYSTEM_PATTERN.test(subsystem);
  const rawSymbols = Array.isArray(value.symbols) ? value.symbols : [];
  if (!isContractValid)
    findings.push({
      code: "symbol-manifest-contract-invalid",
      path: manifestPath,
      message: "contract must be crdd/reality-symbol-manifest.",
    });
  if (!isRevisionValid)
    findings.push({
      code: "symbol-manifest-revision-invalid",
      path: manifestPath,
      message: "contractRevision must be 1.",
    });
  if (!isSubsystemValid)
    findings.push({
      code: "symbol-manifest-subsystem-invalid",
      path: manifestPath,
      message: "subsystem must use lower kebab-case.",
    });
  if (!Array.isArray(value.symbols) || rawSymbols.length === 0)
    findings.push({
      code: "symbol-manifest-symbols-invalid",
      path: manifestPath,
      message: "symbols must be a non-empty array.",
    });

  const symbols: RealitySymbol[] = [];
  const allowedSymbolKeys = new Set([
    "symbolId",
    "kind",
    "path",
    "archIds",
    "qaIds",
    "localTestIds",
    "verifies",
    "implements",
  ]);
  for (const [index, rawSymbol] of rawSymbols.entries()) {
    const location = `${manifestPath}#symbols[${index}]`;
    if (!isRecord(rawSymbol)) {
      findings.push({
        code: "symbol-manifest-symbol-invalid",
        path: location,
        message: "Symbol entry must be an object.",
      });
      continue;
    }
    for (const key of Object.keys(rawSymbol))
      if (!allowedSymbolKeys.has(key))
        findings.push({
          code: "symbol-manifest-property-unknown",
          path: location,
          message: `Unknown symbol property: ${key}.`,
        });
    const symbolId =
      typeof rawSymbol.symbolId === "string" ? rawSymbol.symbolId : "";
    const kind = typeof rawSymbol.kind === "string" ? rawSymbol.kind : "";
    const symbolPath = typeof rawSymbol.path === "string" ? rawSymbol.path : "";
    if (!SYMBOL_ID_PATTERN.test(symbolId))
      findings.push({
        code: "symbol-manifest-symbol-id-invalid",
        path: location,
        message: "symbolId must be a dotted lower-case identity.",
      });
    if (!realitySymbolKinds.includes(kind as RealitySymbolKind))
      findings.push({
        code: "symbol-manifest-kind-invalid",
        path: location,
        message: `Unsupported symbol kind: ${kind || "(missing)"}.`,
      });
    if (!isSafeRelativePath(symbolPath))
      findings.push({
        code: "symbol-manifest-path-invalid",
        path: location,
        message: "path must be a safe subsystem-relative path.",
      });
    const archIds = readUniqueStrings(
      rawSymbol,
      "archIds",
      ARCH_ID_PATTERN,
      location,
      findings,
    );
    const qaIds = readUniqueStrings(
      rawSymbol,
      "qaIds",
      QA_ID_PATTERN,
      location,
      findings,
    );
    const localTestIds = readUniqueStrings(
      rawSymbol,
      "localTestIds",
      LOCAL_TEST_ID_PATTERN,
      location,
      findings,
    );
    const verifies = readUniqueStrings(
      rawSymbol,
      "verifies",
      SYMBOL_ID_PATTERN,
      location,
      findings,
    );
    const implementsMeanings = readUniqueStrings(
      rawSymbol,
      "implements",
      SEMANTIC_KEY_PATTERN,
      location,
      findings,
    );
    const isTestSymbol = kind === "test-suite" || kind === "test-case";
    if (isTestSymbol && (qaIds.length === 0 || verifies.length === 0))
      findings.push({
        code: "symbol-manifest-test-relation-missing",
        path: location,
        message: "Test symbols require qaIds and verifies relations.",
      });
    if (!isTestSymbol && archIds.length === 0)
      findings.push({
        code: "symbol-manifest-architecture-relation-missing",
        path: location,
        message:
          "Implementation symbols require at least one archIds relation.",
      });
    if (
      !isTestSymbol &&
      (qaIds.length > 0 || localTestIds.length > 0 || verifies.length > 0)
    )
      findings.push({
        code: "symbol-manifest-implementation-relation-invalid",
        path: location,
        message:
          "Implementation symbols must not own qaIds, localTestIds, or verifies relations.",
      });
    if (isTestSymbol && implementsMeanings.length > 0)
      findings.push({
        code: "symbol-manifest-test-meaning-relation-invalid",
        path: location,
        message: "Test symbols must not own implements relations.",
      });
    if (
      SYMBOL_ID_PATTERN.test(symbolId) &&
      realitySymbolKinds.includes(kind as RealitySymbolKind) &&
      isSafeRelativePath(symbolPath)
    )
      symbols.push({
        symbolId,
        kind: kind as RealitySymbolKind,
        path: symbolPath,
        archIds,
        qaIds,
        localTestIds,
        verifies,
        implements: implementsMeanings,
      });
  }
  return {
    manifest:
      findings.length === 0 &&
      isContractValid &&
      isRevisionValid &&
      isSubsystemValid
        ? {
            contract: "crdd/reality-symbol-manifest",
            contractRevision: 1,
            subsystem,
            symbols,
          }
        : null,
    findings,
  };
}
