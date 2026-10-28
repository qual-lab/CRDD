/**
 * 状態照会と実行履歴の投影型を定義する。
 *
 * @responsibility 現在状態・履歴・Cursorの搬送構造を定義し、保存や実行を発行しない。
 * @trace ARCH-000004
 */

import type { CoordinatorState } from "../../../domain-model/src/index.ts";

/**
 * stateで使用する状態 結果の値契約を定義する。
 *
 * @responsibility 状態 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StateResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StateResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StateResultの宣言は外部境界を開かない。
 * @security N/A: StateResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility StateResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StateResult =
  | Readonly<{
      status: "completed";
      reason: string;
      state: CoordinatorState;
      taskIds: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      state: CoordinatorState | null;
      taskIds: readonly string[];
    }>;
