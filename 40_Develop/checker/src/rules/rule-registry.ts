import type { ArtifactModel } from "../../../crdd-domain-library/src/artifact/index.ts";
import type { ArtifactGraph } from "../../../crdd-domain-library/src/artifact/index.ts";
import type { FindingSink } from "../findings/finding-model.ts";

export const checkerStages = [
  "repository-discovery",
  "markdown-parse",
  "artifact-model",
  "schema-validation",
  "relation-resolution",
  "cross-artifact-validation",
  "special-rules",
  "finding-report",
] as const;

/**
 * CheckerStageが扱う値の構造を表す。
 *
 * @responsibility CheckerStageに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000001
 * @shape CheckerStageが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckerStageで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerStageの宣言は外部境界を開かない。
 * @security N/A: CheckerStageはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerStageの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerStage = (typeof checkerStages)[number];
/**
 * CheckerRuleContextが扱う値の構造を表す。
 *
 * @responsibility CheckerRuleContextに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000001
 * @shape CheckerRuleContextが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckerRuleContextで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerRuleContextの宣言は外部境界を開かない。
 * @security N/A: CheckerRuleContextはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerRuleContextの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerRuleContext = Readonly<{
  artifacts: readonly ArtifactModel[];
  graph: ArtifactGraph;
  add: FindingSink;
}>;
/**
 * CheckerRuleが扱う値の構造を表す。
 *
 * @responsibility CheckerRuleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000001
 * @shape CheckerRuleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckerRuleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerRuleの宣言は外部境界を開かない。
 * @security N/A: CheckerRuleはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerRuleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerRule = Readonly<{
  id: string;
  stage: "cross-artifact-validation" | "special-rules";
  run: (context: CheckerRuleContext) => void;
}>;

/**
 * RuleRegistryが担う状態と操作を提供する。
 *
 * @responsibility RuleRegistryに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000001
 * @construction RuleRegistryの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle RuleRegistryが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: RuleRegistryの宣言自体は実行時Effectを発行しない。
 * @failure N/A: RuleRegistryの宣言自体は実行時失敗を所有しない。
 * @invariant RuleRegistryで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuleRegistryの宣言は外部境界を開かない。
 * @security N/A: RuleRegistryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: RuleRegistryは共有非同期状態を持たない同期処理である。
 */
export class RuleRegistry {
  readonly #rules = new Map<string, CheckerRule>();

  /**
   * registerの処理を実行する。
   *
   * @responsibility registerに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000001
   * @input rule: CheckerRule
   * @returns N/A: registerは戻り値を返さない。
   * @precondition 「rule: CheckerRule」がregisterの入力契約を満たす。
   * @postcondition registerの責務を完了して呼出し元へ制御を戻す。
   * @effect N/A: registerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure registerは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant registerは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: registerはProcess内の同一Subsystemで完結する。
   * @security N/A: registerはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: registerは共有非同期状態を持たない同期処理である。
   */
  register(rule: CheckerRule): void {
    if (this.#rules.has(rule.id))
      throw new Error(`Duplicate checker rule: ${rule.id}`);
    this.#rules.set(rule.id, rule);
  }

  /**
   * executeStageの処理を実行する。
   *
   * @responsibility executeStageに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000001
   * @input stage: CheckerRule["stage"]、context: CheckerRuleContext
   * @returns N/A: executeStageは戻り値を返さない。
   * @precondition 「stage: CheckerRule["stage"]、context: CheckerRuleContext」がexecuteStageの入力契約を満たす。
   * @postcondition executeStageの責務を完了して呼出し元へ制御を戻す。
   * @effect N/A: executeStageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: executeStageは独自の失敗分岐を所有しない。
   * @invariant executeStageは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: executeStageはProcess内の同一Subsystemで完結する。
   * @security N/A: executeStageはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: executeStageは共有非同期状態を持たない同期処理である。
   */
  executeStage(stage: CheckerRule["stage"], context: CheckerRuleContext): void {
    for (const rule of [...this.#rules.values()]
      .filter((candidate) => candidate.stage === stage)
      .sort((left, right) => left.id.localeCompare(right.id, "en")))
      rule.run(context);
  }
}
