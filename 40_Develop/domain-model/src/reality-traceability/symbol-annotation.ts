/**
 * symbol-annotationに属する責務をまとめる。
 *
 * @responsibility RealitySymbolAnnotationsを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import { createRealityDomainIssue } from "./domain-issue.ts";
import type { RealitySymbol } from "./symbol-manifest-model.ts";

/**
 * symbol-annotationで使用するReality Symbol Annotationsの値契約を定義する。
 *
 * @responsibility Reality Symbol AnnotationsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolAnnotationsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolAnnotationsで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolAnnotationsの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolAnnotationsはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolAnnotationsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolAnnotations = Readonly<{
  archIds: ReadonlySet<string>;
  qaIds: ReadonlySet<string>;
}>;

/**
 * extract Reality Symbol Annotationsを決定する。
 *
 * @responsibility extract Reality Symbol Annotationsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input source: string
 * @returns RealitySymbolAnnotationsを返す。
 * @precondition 「source: string」がextractRealitySymbolAnnotationsの入力契約を満たす。
 * @postcondition extractRealitySymbolAnnotationsの責務を完了した結果だけを返す。
 * @effect N/A: extractRealitySymbolAnnotationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: extractRealitySymbolAnnotationsは独自の失敗分岐を所有しない。
 * @invariant extractRealitySymbolAnnotationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: extractRealitySymbolAnnotationsはProcess内の同一Subsystemで完結する。
 * @security N/A: extractRealitySymbolAnnotationsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: extractRealitySymbolAnnotationsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * Identity Setsが等しいか判定する。
 *
 * @responsibility Identity Setsの比較Property、一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input actual: ReadonlySet<string>、expectedIdentities: readonly string[]
 * @returns booleanを返す。
 * @precondition 「actual: ReadonlySet<string>、expectedIdentities: readonly string[]」がequalIdentitySetsの入力契約を満たす。
 * @postcondition equalIdentitySetsの責務を完了した結果だけを返す。
 * @effect N/A: equalIdentitySetsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: equalIdentitySetsは独自の失敗分岐を所有しない。
 * @invariant equalIdentitySetsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: equalIdentitySetsはProcess内の同一Subsystemで完結する。
 * @security N/A: equalIdentitySetsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: equalIdentitySetsは共有非同期状態を持たない同期処理である。
 */
function equalIdentitySets(
  actual: ReadonlySet<string>,
  expectedIdentities: readonly string[],
): boolean {
  return (
    actual.size === expectedIdentities.length &&
    expectedIdentities.every((identity) => actual.has(identity))
  );
}

/**
 * Reality Symbol Annotationsの契約を検証する。
 *
 * @responsibility Reality Symbol Annotationsの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input symbol: RealitySymbol、source: string、manifestPath: string
 * @returns readonly DomainIssue[]を返す。
 * @precondition 「symbol: RealitySymbol、source: string、manifestPath: string」がvalidateRealitySymbolAnnotationsの入力契約を満たす。
 * @postcondition validateRealitySymbolAnnotationsの責務を完了した結果だけを返す。
 * @effect N/A: validateRealitySymbolAnnotationsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateRealitySymbolAnnotationsは独自の失敗分岐を所有しない。
 * @invariant validateRealitySymbolAnnotationsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateRealitySymbolAnnotationsはProcess内の同一Subsystemで完結する。
 * @security N/A: validateRealitySymbolAnnotationsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateRealitySymbolAnnotationsは共有非同期状態を持たない同期処理である。
 */
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
