import path from "node:path";

import type { DomainIssue } from "../outcome.ts";

/**
 * RealityIssueDetailsが扱う値の構造を表す。
 *
 * @responsibility RealityIssueDetailsに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RealityIssueDetailsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealityIssueDetailsで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealityIssueDetailsの宣言は外部境界を開かない。
 * @security N/A: RealityIssueDetailsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealityIssueDetailsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * RealityIssueKindが扱う値の構造を表す。
 *
 * @responsibility RealityIssueKindに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RealityIssueKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealityIssueKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealityIssueKindの宣言は外部境界を開かない。
 * @security N/A: RealityIssueKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealityIssueKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealityIssueKind = keyof RealityIssueDetails;

/**
 * isSafeDomainLocationの処理を実行する。
 *
 * @responsibility isSafeDomainLocationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input candidate: string
 * @returns booleanを返す。
 * @precondition 「candidate: string」がisSafeDomainLocationの入力契約を満たす。
 * @postcondition isSafeDomainLocationの責務を完了した結果だけを返す。
 * @effect N/A: isSafeDomainLocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSafeDomainLocationは独自の失敗分岐を所有しない。
 * @invariant isSafeDomainLocationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSafeDomainLocationはProcess内の同一Subsystemで完結する。
 * @security N/A: isSafeDomainLocationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSafeDomainLocationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createRealityDomainIssueの処理を実行する。
 *
 * @responsibility createRealityDomainIssueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input kind: K、location: string、targetIdentity: string、reason: string、details: RealityIssueDetails[K]
 * @returns DomainIssueを返す。
 * @precondition 「kind: K、location: string、targetIdentity: string、reason: string、details: RealityIssueDetails[K]」がcreateRealityDomainIssueの入力契約を満たす。
 * @postcondition createRealityDomainIssueの責務を完了した結果だけを返す。
 * @effect N/A: createRealityDomainIssueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRealityDomainIssueは独自の失敗分岐を所有しない。
 * @invariant createRealityDomainIssueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRealityDomainIssueはProcess内の同一Subsystemで完結する。
 * @security N/A: createRealityDomainIssueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRealityDomainIssueは共有非同期状態を持たない同期処理である。
 */
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

/**
 * invalidDomainLocationIssueの処理を実行する。
 *
 * @responsibility invalidDomainLocationIssueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns DomainIssueを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がinvalidDomainLocationIssueの入力契約を満たす。
 * @postcondition invalidDomainLocationIssueの責務を完了した結果だけを返す。
 * @effect N/A: invalidDomainLocationIssueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: invalidDomainLocationIssueは独自の失敗分岐を所有しない。
 * @invariant invalidDomainLocationIssueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: invalidDomainLocationIssueはProcess内の同一Subsystemで完結する。
 * @security N/A: invalidDomainLocationIssueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: invalidDomainLocationIssueは共有非同期状態を持たない同期処理である。
 */
export function invalidDomainLocationIssue(): DomainIssue {
  return createRealityDomainIssue(
    "input.location.not-repository-relative",
    "",
    "reality-input",
    "repository_relative_path_required",
    {},
  );
}
