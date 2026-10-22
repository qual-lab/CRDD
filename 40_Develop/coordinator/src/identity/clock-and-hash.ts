/**
 * clock-identity-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorClockReadingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * clock-identity-portで使用するCoordinator Clock Readingの値契約を定義する。
 *
 * @responsibility Coordinator Clock ReadingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorClockReadingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorClockReadingで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorClockReadingの宣言は外部境界を開かない。
 * @security N/A: CoordinatorClockReadingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorClockReadingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorClockReading = Readonly<{
  monotonicMs: number;
  iso: string;
}>;

/**
 * Host-supplied clock and deterministic identity operations.
 *
 * @responsibility Coordinator Clock Identity PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorClockIdentityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorClockIdentityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorClockIdentityPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorClockIdentityPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorClockIdentityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorClockIdentityPort = Readonly<{
  now: () => CoordinatorClockReading;
  createStableId: (prefix: string, parts: readonly string[]) => string;
  createContentHash: (content: string) => string;
}>;
