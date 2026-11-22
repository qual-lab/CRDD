/**
 * symbol-manifest-modelに属する責務をまとめる。
 *
 * @responsibility RealitySymbolKindを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
export const realitySymbolKinds = [
  "package",
  "module",
  "file",
  "class",
  "function",
  "config",
  "schema",
  "migration",
  "resource",
  "verification-tool",
  "test-suite",
  "test-case",
] as const;

/**
 * symbol-manifest-modelで使用するReality Symbol Kindの値契約を定義する。
 *
 * @responsibility Reality Symbol KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolKindの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolKind = (typeof realitySymbolKinds)[number];

/**
 * symbol-manifest-modelで使用するReality Symbolの値契約を定義する。
 *
 * @responsibility Reality SymbolのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbol = Readonly<{
  symbolId: string;
  kind: RealitySymbolKind;
  path: string;
  archIds: readonly string[];
  qaIds: readonly string[];
  localTestIds: readonly string[];
  verifies: readonly string[];
  verificationTarget?: "environment";
  implements?: readonly string[];
}>;

/**
 * symbol-manifest-modelで使用するReality Symbol Manifestの値契約を定義する。
 *
 * @responsibility Reality Symbol ManifestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolManifestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolManifestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolManifestの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolManifestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolManifest = Readonly<{
  contract: "crdd/reality-symbol-manifest";
  contractRevision: 1;
  subsystem: string;
  symbols: readonly RealitySymbol[];
}>;

/**
 * symbol-manifest-modelで使用するLoaded Reality Symbol Manifestの値契約を定義する。
 *
 * @responsibility Loaded Reality Symbol ManifestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape LoadedRealitySymbolManifestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LoadedRealitySymbolManifestで宣言した値と責務の対応を維持する。
 * @boundary N/A: LoadedRealitySymbolManifestの宣言は外部境界を開かない。
 * @security N/A: LoadedRealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LoadedRealitySymbolManifestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LoadedRealitySymbolManifest = Readonly<{
  manifestPath: string;
  subsystemRoot: string;
  manifest: RealitySymbolManifest;
}>;

import path from "node:path";

import type { DocumentIssue, ParseResult } from "../artifact/types.ts";
import {
  createRealityDomainIssue,
  invalidDomainLocationIssue,
  isSafeDomainLocation,
} from "./issue.ts";

const SUBSYSTEM_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;
const SYMBOL_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const ARCH_ID_PATTERN = /^ARCH-[0-9]{6}$/u;
const QA_ID_PATTERN = /^QA-[0-9]{6}$/u;
const LOCAL_TEST_ID_PATTERN = /^[A-Z][A-Z0-9]*-(?:UT|IT|ST|UAT)-[0-9]{3}$/u;
const SEMANTIC_KEY_PATTERN =
  /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)+$/u;

/**
 * 記録かを判定する。
 *
 * @responsibility 記録の判定条件とtrue／false境界を所有する。
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
 * Safe Relative Pathかを判定する。
 *
 * @responsibility Safe Relative Pathの判定条件とtrue／false境界を所有する。
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
 * Unique Stringsを読み取る。
 *
 * @responsibility Unique Stringsの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input owner: Record<string, unknown>、property: string、pattern: RegExp、location: string、issues: DocumentIssue[]
 * @returns readonly string[]を返す。
 * @precondition 「owner: Record<string, unknown>、property: string、pattern: RegExp、location: string、issues: DocumentIssue[]」がreadUniqueStringsの入力契約を満たす。
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
  issues: DocumentIssue[],
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
 * Reality Symbol Manifestの契約を検証する。
 *
 * @responsibility Reality Symbol Manifestの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、manifestPath: string
 * @returns DocumentResult<RealitySymbolManifest>を返す。
 * @precondition 「value: unknown、manifestPath: string」がparseRealitySymbolManifestの入力契約を満たす。
 * @postcondition parseRealitySymbolManifestの責務を完了した結果だけを返す。
 * @effect N/A: parseRealitySymbolManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseRealitySymbolManifestは独自の失敗分岐を所有しない。
 * @invariant parseRealitySymbolManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseRealitySymbolManifestはProcess内の同一Subsystemで完結する。
 * @security N/A: parseRealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseRealitySymbolManifestは共有非同期状態を持たない同期処理である。
 */
export function parseRealitySymbolManifest(
  value: unknown,
  manifestPath: string,
): ParseResult<RealitySymbolManifest> {
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

  const issues: DocumentIssue[] = [];
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
    "verificationTarget",
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
    const isVerificationTool = kind === "verification-tool";
    if (
      isVerificationTool &&
      (!/^(?:scripts\/|tests\/(?:fixtures|support|system\/manual)\/).+/u.test(
        symbolPath,
      ) ||
        !["qaIds", "localTestIds", "verifies"].every(
          (key) =>
            Object.hasOwn(rawSymbol, key) && Array.isArray(rawSymbol[key]),
        ) ||
        qaIds.length === 0 ||
        localTestIds.length === 0 ||
        archIds.length > 0 ||
        verifies.length > 0 ||
        implementsMeanings.length > 0 ||
        Object.hasOwn(rawSymbol, "verificationTarget"))
    )
      issues.push(
        createRealityDomainIssue(
          "manifest.verification-tool.relation-domain-invalid",
          location,
          symbolId || location,
          "verification_tool_requires_quality_relations_and_owned_tool_path",
          {},
        ),
      );
    const environmentTest =
      Object.hasOwn(rawSymbol, "verificationTarget") &&
      rawSymbol.verificationTarget === "environment";
    if (
      Object.hasOwn(rawSymbol, "verificationTarget") &&
      (!environmentTest ||
        !isTestSymbol ||
        !Object.hasOwn(rawSymbol, "verifies") ||
        !Array.isArray(rawSymbol.verifies) ||
        verifies.length !== 0 ||
        localTestIds.length === 0)
    )
      issues.push(
        createRealityDomainIssue(
          "manifest.test.relation-missing",
          location,
          symbolId || location,
          "environment_test_requires_empty_implementation_relation",
          {},
        ),
      );
    if (
      isTestSymbol &&
      (qaIds.length === 0 || (!environmentTest && verifies.length === 0))
    )
      issues.push(
        createRealityDomainIssue(
          "manifest.test.relation-missing",
          location,
          symbolId || location,
          "test_relations_required",
          {},
        ),
      );
    if (!isTestSymbol && !isVerificationTool && archIds.length === 0)
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
      !isVerificationTool &&
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
        ...(environmentTest
          ? { verificationTarget: "environment" as const }
          : {}),
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
