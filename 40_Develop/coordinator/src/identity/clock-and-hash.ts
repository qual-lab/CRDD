/**
 * clock-identity-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorClockReadingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * clock-identity-portで使用するOrchestrator Clock Readingの値契約を定義する。
 *
 * @responsibility Orchestrator Clock ReadingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorClockReadingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorClockReadingで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorClockReadingの宣言は外部境界を開かない。
 * @security N/A: OrchestratorClockReadingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorClockReadingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorClockReading = Readonly<{
  monotonicMs: number;
  iso: string;
}>;

/**
 * Host-supplied clock and deterministic identity operations.
 *
 * @responsibility Orchestrator Clock Identity PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorClockIdentityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorClockIdentityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorClockIdentityPortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorClockIdentityPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorClockIdentityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorClockIdentityPort = Readonly<{
  now: () => OrchestratorClockReading;
  createStableId: (prefix: string, parts: readonly string[]) => string;
  createContentHash: (content: string) => string;
}>;
