import path from "node:path";

import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import {
  createRealityDomainIssue,
  invalidDomainLocationIssue,
  isSafeDomainLocation,
} from "./domain-issue.ts";
import {
  realitySymbolKinds,
  type RealitySymbol,
  type RealitySymbolKind,
  type RealitySymbolManifest,
} from "./symbol-manifest-model.ts";

const SUBSYSTEM_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const SYMBOL_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const ARCH_ID_PATTERN = /^ARCH-[0-9]{6}$/u;
const QA_ID_PATTERN = /^QA-[0-9]{6}$/u;
const LOCAL_TEST_ID_PATTERN = /^[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}$/u;
const SEMANTIC_KEY_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/u;

/**
 * isRecordの処理を実行する。
 *
 * @responsibility isRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is Record<string, unknown>を返す。
 * @precondition 「value: unknown」がisRecordの入力契約を満たす。
 * @postcondition isRecordの責務を完了した結果だけを返す。
 * @effect N/A: isRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isRecordは独自の失敗分岐を所有しない。
 * @invariant isRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isRecordは共有非同期状態を持たない同期処理である。
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * isSafeRelativePathの処理を実行する。
 *
 * @responsibility isSafeRelativePathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns booleanを返す。
 * @precondition 「value: string」がisSafeRelativePathの入力契約を満たす。
 * @postcondition isSafeRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: isSafeRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSafeRelativePathは独自の失敗分岐を所有しない。
 * @invariant isSafeRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSafeRelativePathはProcess内の同一Subsystemで完結する。
 * @security N/A: isSafeRelativePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSafeRelativePathは共有非同期状態を持たない同期処理である。
 */
function isSafeRelativePath(value: string): boolean {
  if (
    value.length === 0 ||
    value.includes("\\") ||
    path.posix.isAbsolute(value) ||
    path.win32.isAbsolute(value)
  )
    return false;
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0 && segment !== "." && segment !== "..",
  );
}

/**
 * readUniqueStringsの処理を実行する。
 *
 * @responsibility readUniqueStringsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input owner: Record<string, unknown>、property: string、pattern: RegExp、location: string、issues: DomainIssue[]
 * @returns readonly string[]を返す。
 * @precondition 「owner: Record<string, unknown>、property: string、pattern: RegExp、location: string、issues: DomainIssue[]」がreadUniqueStringsの入力契約を満たす。
 * @postcondition readUniqueStringsの責務を完了した結果だけを返す。
 * @effect N/A: readUniqueStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readUniqueStringsは独自の失敗分岐を所有しない。
 * @invariant readUniqueStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readUniqueStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: readUniqueStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readUniqueStringsは共有非同期状態を持たない同期処理である。
 */
function readUniqueStrings(
  owner: Record<string, unknown>,
  property: string,
  pattern: RegExp,
  location: string,
  issues: DomainIssue[],
): readonly string[] {
  const value = owner[property];
  if (value === undefined) return [];
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    issues.push(
      createRealityDomainIssue(
        "manifest.relation.value-shape",
        location,
        property,
        "relation_must_be_string_array",
        { property },
      ),
    );
    return [];
  }
  const values = value as string[];
  if (values.some((entry) => !pattern.test(entry)))
    issues.push(
      createRealityDomainIssue(
        "manifest.relation.identity-shape",
        location,
        property,
        "relation_contains_invalid_identity",
        { property },
      ),
    );
  if (new Set(values).size !== values.length)
    issues.push(
      createRealityDomainIssue(
        "manifest.relation.identity-duplicate",
        location,
        property,
        "relation_contains_duplicate_identity",
        { property },
      ),
    );
  return values;
}

/**
 * validateRealitySymbolManifestの処理を実行する。
 *
 * @responsibility validateRealitySymbolManifestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown、manifestPath: string
 * @returns DomainOutcome<RealitySymbolManifest>を返す。
 * @precondition 「value: unknown、manifestPath: string」がvalidateRealitySymbolManifestの入力契約を満たす。
 * @postcondition validateRealitySymbolManifestの責務を完了した結果だけを返す。
 * @effect N/A: validateRealitySymbolManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateRealitySymbolManifestは独自の失敗分岐を所有しない。
 * @invariant validateRealitySymbolManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateRealitySymbolManifestはProcess内の同一Subsystemで完結する。
 * @security N/A: validateRealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateRealitySymbolManifestは共有非同期状態を持たない同期処理である。
 */
export function validateRealitySymbolManifest(
  value: unknown,
  manifestPath: string,
): DomainOutcome<RealitySymbolManifest> {
  if (!isSafeDomainLocation(manifestPath))
    return {
      status: "invalid",
      result: null,
      issues: [invalidDomainLocationIssue()],
    };
  if (!isRecord(value))
    return {
      status: "invalid",
      result: null,
      issues: [
        createRealityDomainIssue(
          "manifest.root.value-shape",
          manifestPath,
          manifestPath,
          "manifest_root_must_be_record",
          {},
        ),
      ],
    };

  const issues: DomainIssue[] = [];
  const allowedRootKeys = new Set([
    "contract",
    "contractRevision",
    "subsystem",
    "symbols",
  ]);
  for (const key of Object.keys(value))
    if (!allowedRootKeys.has(key))
      issues.push(
        createRealityDomainIssue(
          "manifest.property.not-declared",
          manifestPath,
          key,
          "root_property_not_declared",
          { scope: "root", property: key },
        ),
      );

  const isContractValid = value.contract === "crdd/reality-symbol-manifest";
  const isRevisionValid = value.contractRevision === 1;
  const subsystem = typeof value.subsystem === "string" ? value.subsystem : "";
  const isSubsystemValid = SUBSYSTEM_PATTERN.test(subsystem);
  const rawSymbols = Array.isArray(value.symbols) ? value.symbols : [];
  if (!isContractValid)
    issues.push(
      createRealityDomainIssue(
        "manifest.contract.not-supported",
        manifestPath,
        manifestPath,
        "manifest_contract_not_supported",
        {},
      ),
    );
  if (!isRevisionValid)
    issues.push(
      createRealityDomainIssue(
        "manifest.revision.not-supported",
        manifestPath,
        manifestPath,
        "manifest_revision_not_supported",
        {},
      ),
    );
  if (!isSubsystemValid)
    issues.push(
      createRealityDomainIssue(
        "manifest.subsystem.identity-shape",
        manifestPath,
        subsystem,
        "subsystem_identity_invalid",
        {},
      ),
    );
  if (!Array.isArray(value.symbols) || rawSymbols.length === 0)
    issues.push(
      createRealityDomainIssue(
        "manifest.symbols.value-shape",
        manifestPath,
        manifestPath,
        "symbols_must_be_non_empty_array",
        {},
      ),
    );

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
      issues.push(
        createRealityDomainIssue(
          "manifest.symbol.value-shape",
          location,
          location,
          "symbol_must_be_record",
          {},
        ),
      );
      continue;
    }
    for (const key of Object.keys(rawSymbol))
      if (!allowedSymbolKeys.has(key))
        issues.push(
          createRealityDomainIssue(
            "manifest.property.not-declared",
            location,
            key,
            "symbol_property_not_declared",
            { scope: "symbol", property: key },
          ),
        );

    const symbolId =
      typeof rawSymbol.symbolId === "string" ? rawSymbol.symbolId : "";
    const kind = typeof rawSymbol.kind === "string" ? rawSymbol.kind : "";
    const symbolPath = typeof rawSymbol.path === "string" ? rawSymbol.path : "";
    if (!SYMBOL_ID_PATTERN.test(symbolId))
      issues.push(
        createRealityDomainIssue(
          "manifest.symbol.identity-shape",
          location,
          symbolId,
          "symbol_identity_invalid",
          {},
        ),
      );
    if (!realitySymbolKinds.includes(kind as RealitySymbolKind))
      issues.push(
        createRealityDomainIssue(
          "manifest.symbol.kind-not-supported",
          location,
          symbolId || location,
          "symbol_kind_not_supported",
          { kind: kind || "(missing)" },
        ),
      );
    if (!isSafeRelativePath(symbolPath))
      issues.push(
        createRealityDomainIssue(
          "manifest.symbol.path-not-safe",
          location,
          symbolId || location,
          "symbol_path_not_safe",
          {},
        ),
      );

    const archIds = readUniqueStrings(
      rawSymbol,
      "archIds",
      ARCH_ID_PATTERN,
      location,
      issues,
    );
    const qaIds = readUniqueStrings(
      rawSymbol,
      "qaIds",
      QA_ID_PATTERN,
      location,
      issues,
    );
    const localTestIds = readUniqueStrings(
      rawSymbol,
      "localTestIds",
      LOCAL_TEST_ID_PATTERN,
      location,
      issues,
    );
    const verifies = readUniqueStrings(
      rawSymbol,
      "verifies",
      SYMBOL_ID_PATTERN,
      location,
      issues,
    );
    const implementsMeanings = readUniqueStrings(
      rawSymbol,
      "implements",
      SEMANTIC_KEY_PATTERN,
      location,
      issues,
    );
    const isTestSymbol = kind === "test-suite" || kind === "test-case";
    if (isTestSymbol && (qaIds.length === 0 || verifies.length === 0))
      issues.push(
        createRealityDomainIssue(
          "manifest.test.relation-missing",
          location,
          symbolId || location,
          "test_relations_required",
          {},
        ),
      );
    if (!isTestSymbol && archIds.length === 0)
      issues.push(
        createRealityDomainIssue(
          "manifest.implementation.architecture-relation-missing",
          location,
          symbolId || location,
          "implementation_architecture_relation_required",
          {},
        ),
      );
    if (
      !isTestSymbol &&
      (qaIds.length > 0 || localTestIds.length > 0 || verifies.length > 0)
    )
      issues.push(
        createRealityDomainIssue(
          "manifest.implementation.relation-domain-invalid",
          location,
          symbolId || location,
          "implementation_relation_domain_invalid",
          {},
        ),
      );
    if (isTestSymbol && implementsMeanings.length > 0)
      issues.push(
        createRealityDomainIssue(
          "manifest.test.meaning-relation-domain-invalid",
          location,
          symbolId || location,
          "test_meaning_relation_domain_invalid",
          {},
        ),
      );

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
    status: issues.length === 0 ? "complete" : "invalid",
    result:
      issues.length === 0 &&
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
    issues,
  };
}
