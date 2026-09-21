import type { DomainIssue } from "../../../crdd-domain-library/src/index.ts";
import {
  createRealitySymbolGraph as createDomainRealitySymbolGraph,
  type LoadedRealitySymbolManifest,
  type RealitySymbolGraph,
  validateRealitySymbolManifest as validateDomainRealitySymbolManifest,
} from "../../../crdd-domain-library/src/reality-traceability/index.ts";
import { observeRealitySymbolRepository } from "../../../crdd-domain-library/src/repository-observation/index.ts";
import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";

/**
 * CheckerRealityFindingが扱う値の構造を表す。
 *
 * @responsibility CheckerRealityFindingに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000001
 * @shape CheckerRealityFindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckerRealityFindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerRealityFindingの宣言は外部境界を開かない。
 * @security N/A: CheckerRealityFindingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerRealityFindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerRealityFinding = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

/**
 * mapRealityDomainIssueToCheckerFindingの処理を実行する。
 *
 * @responsibility mapRealityDomainIssueToCheckerFindingに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000001
 * @input issue: DomainIssue
 * @returns CheckerRealityFindingを返す。
 * @precondition 「issue: DomainIssue」がmapRealityDomainIssueToCheckerFindingの入力契約を満たす。
 * @postcondition mapRealityDomainIssueToCheckerFindingの責務を完了した結果だけを返す。
 * @effect N/A: mapRealityDomainIssueToCheckerFindingは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure mapRealityDomainIssueToCheckerFindingは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mapRealityDomainIssueToCheckerFindingは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mapRealityDomainIssueToCheckerFindingはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: mapRealityDomainIssueToCheckerFindingは共有非同期状態を持たない同期処理である。
 */
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

/**
 * validateRealitySymbolManifestの処理を実行する。
 *
 * @responsibility validateRealitySymbolManifestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000001
 * @input value: unknown、manifestPath: string
 * @returns validateRealitySymbolManifestの計算結果を返す。
 * @precondition 「value: unknown、manifestPath: string」がvalidateRealitySymbolManifestの入力契約を満たす。
 * @postcondition validateRealitySymbolManifestの責務を完了した結果だけを返す。
 * @effect N/A: validateRealitySymbolManifestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateRealitySymbolManifestは独自の失敗分岐を所有しない。
 * @invariant validateRealitySymbolManifestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: validateRealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateRealitySymbolManifestは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createRealitySymbolGraphの処理を実行する。
 *
 * @responsibility createRealitySymbolGraphに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000001
 * @input loadedManifests: readonly LoadedRealitySymbolManifest[]、knownArchIds: ReadonlySet<string>、knownQaIds: ReadonlySet<string>、knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>、registeredTestsByPath: ReadonlyMap< string, Readonly<{ owner: string; testId: string }> > | null、prerequisiteFindings: readonly CheckerRealityFinding[]
 * @returns Readonly<{ graph: RealitySymbolGraph | null; findings: readonly CheckerRealityFinding[]; }>を返す。
 * @precondition 「loadedManifests: readonly LoadedRealitySymbolManifest[]、knownArchIds: ReadonlySet<string>、knownQaIds: ReadonlySet<string>、knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>、registeredTestsByPath: ReadonlyMap< string, Readonly<{ owner: string; testId: string }> > | null、prerequisiteFindings: readonly CheckerRealityFinding[]」がcreateRealitySymbolGraphの入力契約を満たす。
 * @postcondition createRealitySymbolGraphの責務を完了した結果だけを返す。
 * @effect N/A: createRealitySymbolGraphは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRealitySymbolGraphは独自の失敗分岐を所有しない。
 * @invariant createRealitySymbolGraphは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: createRealitySymbolGraphはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRealitySymbolGraphは共有非同期状態を持たない同期処理である。
 */
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

/**
 * discoverRealitySymbolManifestsの処理を実行する。
 *
 * @responsibility discoverRealitySymbolManifestsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000001
 * @input capability: VerifiedRepositoryRoot
 * @returns Readonly<{ manifests: readonly LoadedRealitySymbolManifest[]; knownArchIds: ReadonlySet<string>; knownQaIds: ReadonlySet<string>; knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>; findings: readonly CheckerRealityFinding[]; }>を返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がdiscoverRealitySymbolManifestsの入力契約を満たす。
 * @postcondition discoverRealitySymbolManifestsの責務を完了した結果だけを返す。
 * @effect N/A: discoverRealitySymbolManifestsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: discoverRealitySymbolManifestsは独自の失敗分岐を所有しない。
 * @invariant discoverRealitySymbolManifestsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security discoverRealitySymbolManifestsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discoverRealitySymbolManifestsは共有非同期状態を持たない同期処理である。
 */
export function discoverRealitySymbolManifests(
  capability: VerifiedRepositoryRoot,
): Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
  knownArchIds: ReadonlySet<string>;
  knownQaIds: ReadonlySet<string>;
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  findings: readonly CheckerRealityFinding[];
}> {
  const observed = observeRealitySymbolRepository(capability);
  return {
    manifests: observed.manifests,
    knownArchIds: observed.knownArchIds,
    knownQaIds: observed.knownQaIds,
    knownLocalTestIdsByQaId: observed.knownLocalTestIdsByQaId,
    findings: [
      ...observed.repositoryIssues.map(({ code, path, reason }) => ({
        code,
        path,
        message: reason,
      })),
      ...observed.domainIssues.map(mapRealityDomainIssueToCheckerFinding),
    ],
  };
}
