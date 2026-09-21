/**
 * finding-modelに属する責務をまとめる。
 *
 * @responsibility CheckerFindingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000001
 */
/**
 * finding-modelで使用するChecker Findingの値契約を定義する。
 *
 * @responsibility Checker FindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape CheckerFindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CheckerFindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerFindingの宣言は外部境界を開かない。
 * @security N/A: CheckerFindingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CheckerFindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CheckerFinding = Readonly<{
  severity: "error" | "warning";
  code: string;
  path: string;
  rule: string;
  message: string;
  evidence?: readonly string[];
}>;

/**
 * finding-modelで使用するFinding Sinkの値契約を定義する。
 *
 * @responsibility Finding SinkのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000001
 * @shape FindingSinkが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FindingSinkで宣言した値と責務の対応を維持する。
 * @boundary N/A: FindingSinkの宣言は外部境界を開かない。
 * @security N/A: FindingSinkはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FindingSinkの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FindingSink = (finding: CheckerFinding) => void;

/**
 * Finding Collectorを構築する。
 *
 * @responsibility Finding Collectorの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000001
 * @input N/A: 実行時引数を受け取らない。
 * @returns Readonly<{ findings: CheckerFinding[]; add: FindingSink; }>を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateFindingCollectorの入力契約を満たす。
 * @postcondition createFindingCollectorの責務を完了した結果だけを返す。
 * @effect N/A: createFindingCollectorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createFindingCollectorは独自の失敗分岐を所有しない。
 * @invariant createFindingCollectorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createFindingCollectorはProcess内の同一Subsystemで完結する。
 * @security N/A: createFindingCollectorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createFindingCollectorは共有非同期状態を持たない同期処理である。
 */
export function createFindingCollector(): Readonly<{
  findings: CheckerFinding[];
  add: FindingSink;
}> {
  const findings: CheckerFinding[] = [];
  return {
    findings,
    add: (finding) => findings.push(finding),
  };
}
