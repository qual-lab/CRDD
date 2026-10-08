/**
 * port-resultに属する責務をまとめる。
 *
 * @responsibility OrchestratorPortResultを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * port-resultで使用するOrchestrator Port 結果の値契約を定義する。
 *
 * @responsibility Orchestrator Port 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorPortResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorPortResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorPortResultの宣言は外部境界を開かない。
 * @security N/A: OrchestratorPortResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorPortResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorPortResult<T> = Readonly<
  | { status: "completed"; reason: string; value: T }
  | {
      status: "blocked";
      reason: string;
      value: null;
      manualRecoveryRequired: boolean;
      recoveryId: string | null;
    }
>;
