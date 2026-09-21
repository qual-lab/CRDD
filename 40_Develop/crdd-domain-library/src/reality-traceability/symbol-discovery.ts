/**
 * symbol-discoveryに属する責務をまとめる。
 *
 * @responsibility RealitySymbolDiscoverySourceを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import { createRealityDomainIssue } from "./domain-issue.ts";
import { validateRealitySymbolAnnotations } from "./symbol-annotation.ts";
import type { LoadedRealitySymbolManifest } from "./symbol-manifest-model.ts";
import { validateRealitySymbolManifest } from "./symbol-manifest-validator.ts";

/**
 * symbol-discoveryで使用するReality Symbol Discovery Sourceの値契約を定義する。
 *
 * @responsibility Reality Symbol Discovery SourceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolDiscoverySourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolDiscoverySourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolDiscoverySourceの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolDiscoverySourceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolDiscoverySourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolDiscoverySource = Readonly<{
  subsystem: string;
  subsystemPath: string;
  manifestPath: string;
  manifestSource: string;
  symbolSources: ReadonlyMap<string, string>;
}>;

/**
 * symbol-discoveryで使用するReality Symbol Discovery Requestの値契約を定義する。
 *
 * @responsibility Reality Symbol Discovery RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolDiscoveryRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolDiscoveryRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolDiscoveryRequestの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolDiscoveryRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolDiscoveryRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolDiscoveryRequest = Readonly<{
  sources: readonly RealitySymbolDiscoverySource[];
  prerequisiteIssues: readonly DomainIssue[];
}>;

/**
 * symbol-discoveryで使用するReality Symbol Discovery 結果の値契約を定義する。
 *
 * @responsibility Reality Symbol Discovery 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolDiscoveryResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolDiscoveryResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolDiscoveryResultの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolDiscoveryResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolDiscoveryResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolDiscoveryResult = Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
}>;

/**
 * Reality Symbolsを探索する。
 *
 * @responsibility Reality Symbolsの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000008
 * @input request: RealitySymbolDiscoveryRequest
 * @returns DomainOutcome<RealitySymbolDiscoveryResult>を返す。
 * @precondition 「request: RealitySymbolDiscoveryRequest」がdiscoverRealitySymbolsの入力契約を満たす。
 * @postcondition discoverRealitySymbolsの責務を完了した結果だけを返す。
 * @effect N/A: discoverRealitySymbolsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure discoverRealitySymbolsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discoverRealitySymbolsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: discoverRealitySymbolsはProcess内の同一Subsystemで完結する。
 * @security N/A: discoverRealitySymbolsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: discoverRealitySymbolsは共有非同期状態を持たない同期処理である。
 */
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
