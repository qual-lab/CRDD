/**
 * symbol-graphに属する責務をまとめる。
 *
 * @responsibility RealitySymbolNodeを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import {
  createRealityDomainIssue,
  invalidDomainLocationIssue,
  isSafeDomainLocation,
} from "./domain-issue.ts";
import type {
  LoadedRealitySymbolManifest,
  RealitySymbol,
} from "./symbol-manifest-model.ts";

/**
 * symbol-graphで使用するReality Symbol Nodeの値契約を定義する。
 *
 * @responsibility Reality Symbol NodeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolNodeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolNodeで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolNodeの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolNodeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolNodeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolNode = Readonly<{
  subsystem: string;
  subsystemRoot: string;
  manifestPath: string;
  symbol: RealitySymbol;
}>;

/**
 * symbol-graphで使用するReality Symbol Graphの値契約を定義する。
 *
 * @responsibility Reality Symbol GraphのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolGraphが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolGraphで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolGraphの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolGraphはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolGraphの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolGraph = Readonly<{
  symbolsById: ReadonlyMap<string, RealitySymbolNode>;
  symbolsByArchId: ReadonlyMap<string, readonly RealitySymbolNode[]>;
  symbolsByQaId: ReadonlyMap<string, readonly RealitySymbolNode[]>;
  testsByImplementationId: ReadonlyMap<string, readonly RealitySymbolNode[]>;
}>;

/**
 * To Indexを追記する。
 *
 * @responsibility To Indexの追記対象、順序、書込み失敗境界を所有する。
 * @trace ARCH-000008
 * @input index: Map<string, RealitySymbolNode[]>、key: string、value: RealitySymbolNode
 * @returns N/A: appendToIndexは戻り値を返さない。
 * @precondition 「index: Map<string, RealitySymbolNode[]>、key: string、value: RealitySymbolNode」がappendToIndexの入力契約を満たす。
 * @postcondition appendToIndexの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: appendToIndexは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: appendToIndexは独自の失敗分岐を所有しない。
 * @invariant appendToIndexは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: appendToIndexはProcess内の同一Subsystemで完結する。
 * @security N/A: appendToIndexはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: appendToIndexは共有非同期状態を持たない同期処理である。
 */
function appendToIndex(
  index: Map<string, RealitySymbolNode[]>,
  key: string,
  value: RealitySymbolNode,
): void {
  const values = index.get(key) ?? [];
  values.push(value);
  index.set(key, values);
}

/**
 * Reality Symbol Graphを構築する。
 *
 * @responsibility Reality Symbol Graphの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input loadedManifests: readonly LoadedRealitySymbolManifest[]、knownArchIds: ReadonlySet<string>、knownQaIds: ReadonlySet<string>、knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>、registeredTestsByPath: ReadonlyMap< string, Readonly<{ owner: string; testId: string }> > | null、prerequisiteIssues: readonly DomainIssue[]
 * @returns DomainOutcome<RealitySymbolGraph>を返す。
 * @precondition 「loadedManifests: readonly LoadedRealitySymbolManifest[]、knownArchIds: ReadonlySet<string>、knownQaIds: ReadonlySet<string>、knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>、registeredTestsByPath: ReadonlyMap< string, Readonly<{ owner: string; testId: string }> > | null、prerequisiteIssues: readonly DomainIssue[]」がcreateRealitySymbolGraphの入力契約を満たす。
 * @postcondition createRealitySymbolGraphの責務を完了した結果だけを返す。
 * @effect N/A: createRealitySymbolGraphは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRealitySymbolGraphは独自の失敗分岐を所有しない。
 * @invariant createRealitySymbolGraphは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRealitySymbolGraphはProcess内の同一Subsystemで完結する。
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
  prerequisiteIssues: readonly DomainIssue[],
): DomainOutcome<RealitySymbolGraph> {
  if (
    loadedManifests.some(
      (loadedManifest) => !isSafeDomainLocation(loadedManifest.manifestPath),
    )
  )
    return {
      status: "invalid",
      result: null,
      issues: [invalidDomainLocationIssue()],
    };
  if (prerequisiteIssues.length > 0)
    return {
      status: "invalid",
      result: null,
      issues: prerequisiteIssues,
    };
  if (registeredTestsByPath === null)
    return {
      status: "invalid",
      result: null,
      issues: [
        createRealityDomainIssue(
          "graph.input.snapshot-unavailable",
          "07_Quality/Registry/test-catalog.json",
          "test-catalog",
          "test_catalog_snapshot_required",
          {},
        ),
      ],
    };

  const issues: DomainIssue[] = [];
  const symbolsById = new Map<string, RealitySymbolNode>();
  const symbolsByArchId = new Map<string, RealitySymbolNode[]>();
  const symbolsByQaId = new Map<string, RealitySymbolNode[]>();
  const testsByImplementationId = new Map<string, RealitySymbolNode[]>();
  for (const loadedManifest of loadedManifests)
    for (const symbol of loadedManifest.manifest.symbols) {
      const node = {
        subsystem: loadedManifest.manifest.subsystem,
        subsystemRoot: loadedManifest.subsystemRoot,
        manifestPath: loadedManifest.manifestPath,
        symbol,
      };
      if (symbolsById.has(symbol.symbolId))
        issues.push(
          createRealityDomainIssue(
            "graph.symbol.identity-duplicate",
            loadedManifest.manifestPath,
            symbol.symbolId,
            "symbol_identity_not_unique",
            { symbolId: symbol.symbolId },
          ),
        );
      else symbolsById.set(symbol.symbolId, node);

      for (const archId of symbol.archIds) {
        appendToIndex(symbolsByArchId, archId, node);
        if (!knownArchIds.has(archId))
          issues.push(
            createRealityDomainIssue(
              "graph.architecture.identity-unresolved",
              loadedManifest.manifestPath,
              archId,
              "architecture_identity_unresolved",
              { identity: archId },
            ),
          );
      }
      for (const qaId of symbol.qaIds) {
        appendToIndex(symbolsByQaId, qaId, node);
        if (!knownQaIds.has(qaId))
          issues.push(
            createRealityDomainIssue(
              "graph.quality.identity-unresolved",
              loadedManifest.manifestPath,
              qaId,
              "quality_identity_unresolved",
              { identity: qaId },
            ),
          );
      }

      const knownQaIdsForSymbols = symbol.qaIds.filter((qaId) =>
        knownQaIds.has(qaId),
      );
      if (symbol.kind === "test-suite" || symbol.kind === "test-case") {
        const testPath = `40_Develop/${loadedManifest.manifest.subsystem}/${symbol.path}`;
        const registeredTest = registeredTestsByPath.get(testPath);
        if (!registeredTest)
          issues.push(
            createRealityDomainIssue(
              "graph.test.catalog-registration-missing",
              loadedManifest.manifestPath,
              symbol.symbolId,
              "test_catalog_registration_missing",
              { symbolId: symbol.symbolId },
            ),
          );
        else if (registeredTest.owner !== loadedManifest.manifest.subsystem)
          issues.push(
            createRealityDomainIssue(
              "graph.test.catalog-owner-mismatch",
              loadedManifest.manifestPath,
              symbol.symbolId,
              "test_catalog_owner_mismatch",
              {
                symbolId: symbol.symbolId,
                actualOwner: registeredTest.owner,
                expectedOwner: loadedManifest.manifest.subsystem,
              },
            ),
          );
      }
      for (const localTestId of symbol.localTestIds) {
        const owners = knownQaIdsForSymbols.filter((qaId) =>
          knownLocalTestIdsByQaId.get(qaId)?.has(localTestId),
        );
        if (knownQaIdsForSymbols.length > 0 && owners.length === 0)
          issues.push(
            createRealityDomainIssue(
              "graph.quality.local-test-identity-unresolved",
              loadedManifest.manifestPath,
              localTestId,
              "local_test_identity_unresolved",
              { localTestId, symbolId: symbol.symbolId },
            ),
          );
      }
    }

  for (const node of symbolsById.values())
    for (const targetId of node.symbol.verifies) {
      const target = symbolsById.get(targetId);
      if (!target) {
        issues.push(
          createRealityDomainIssue(
            "graph.verification.target-unresolved",
            node.manifestPath,
            node.symbol.symbolId,
            "verification_target_unresolved",
            { symbolId: node.symbol.symbolId, targetId },
          ),
        );
        continue;
      }
      if (
        target.symbol.kind === "test-suite" ||
        target.symbol.kind === "test-case"
      ) {
        issues.push(
          createRealityDomainIssue(
            "graph.verification.target-domain-invalid",
            node.manifestPath,
            node.symbol.symbolId,
            "verification_target_must_be_implementation",
            { symbolId: node.symbol.symbolId },
          ),
        );
        continue;
      }
      appendToIndex(testsByImplementationId, targetId, node);
    }

  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result:
      issues.length === 0
        ? {
            symbolsById,
            symbolsByArchId,
            symbolsByQaId,
            testsByImplementationId,
          }
        : null,
    issues,
  };
}
