/**
 * process-safety-portに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeProcessSafetyPortを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * Runtime-process recovery operations supplied by the owning Host Adapter.
 *
 * @responsibility Project Runtime Process Safety PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeProcessSafetyPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeProcessSafetyPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeProcessSafetyPortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeProcessSafetyPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeProcessSafetyPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeProcessSafetyPort = Readonly<{
  getProcessInstanceIdentity: () => string;
  createRecoveryIdentity: (attemptId: string, operationId: string) => string;
  inspectRecoveryIdentity: (
    value: unknown,
    attemptId: string,
    operationId: string,
  ) => Readonly<{ processIdentity: string; recoveryId: string }> | null;
  poisonAfterCleanupUnknown: () => void;
}>;
