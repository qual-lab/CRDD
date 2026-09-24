/**
 * current-profileに属する責務をまとめる。
 *
 * @responsibility CurrentProfileRuleCallbacksを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */
import type { CheckerRule } from "./rule-registry.ts";

/**
 * current-profileで使用するCurrent Profile Rule Callbacksの値契約を定義する。
 *
 * @responsibility Current Profile Rule CallbacksのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape CurrentProfileRuleCallbacksが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CurrentProfileRuleCallbacksで宣言した値と責務の対応を維持する。
 * @boundary N/A: CurrentProfileRuleCallbacksの宣言は外部境界を開かない。
 * @security N/A: CurrentProfileRuleCallbacksはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CurrentProfileRuleCallbacksの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CurrentProfileRuleCallbacks = Readonly<{
  workLifecycle: () => void;
  discovery: () => void;
  ux: () => void;
  ia: () => void;
  ui: () => void;
  spec: () => void;
  architecture: () => void;
  quality: () => void;
  phaseDiagrams: () => void;
}>;

/**
 * current Profile Rulesを決定する。
 *
 * @responsibility current Profile Rulesの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000001
 * @input callbacks: CurrentProfileRuleCallbacks
 * @returns readonly CheckerRule[]を返す。
 * @precondition 「callbacks: CurrentProfileRuleCallbacks」がcurrentProfileRulesの入力契約を満たす。
 * @postcondition currentProfileRulesの責務を完了した結果だけを返す。
 * @effect N/A: currentProfileRulesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: currentProfileRulesは独自の失敗分岐を所有しない。
 * @invariant currentProfileRulesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: currentProfileRulesはProcess内の同一Subsystemで完結する。
 * @security N/A: currentProfileRulesはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: currentProfileRulesは共有非同期状態を持たない同期処理である。
 */
export function currentProfileRules(
  callbacks: CurrentProfileRuleCallbacks,
): readonly CheckerRule[] {
  const orderedRules: ReadonlyArray<readonly [string, () => void]> = [
    ["01-work-lifecycle", callbacks.workLifecycle],
    ["02-discovery", callbacks.discovery],
    ["03-ux", callbacks.ux],
    ["04-ia", callbacks.ia],
    ["05-ui", callbacks.ui],
    ["06-spec", callbacks.spec],
    ["07-architecture", callbacks.architecture],
    ["08-quality", callbacks.quality],
    ["09-phase-diagrams", callbacks.phaseDiagrams],
  ];
  return orderedRules.map(([id, executeRule]) => ({
    id: `current-profile.${id}`,
    stage: "special-rules" as const,
    run: executeRule,
  }));
}
