/**
 * ProjectRuntimePortResultが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimePortResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimePortResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimePortResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimePortResultの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimePortResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimePortResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimePortResult<T> = Readonly<
  | { status: "completed"; reason: string; value: T }
  | {
      status: "blocked";
      reason: string;
      value: null;
      manualRecoveryRequired: boolean;
      recoveryId: string | null;
    }
>;
