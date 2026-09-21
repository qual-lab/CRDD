/**
 * ProjectRuntimeClockReadingが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeClockReadingに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeClockReadingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeClockReadingで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeClockReadingの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeClockReadingはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeClockReadingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeClockReading = Readonly<{
  monotonicMs: number;
  iso: string;
}>;

/**
 * Host-supplied clock and deterministic identity operations.
 *
 * @responsibility ProjectRuntimeClockIdentityPortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeClockIdentityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeClockIdentityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeClockIdentityPortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeClockIdentityPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeClockIdentityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeClockIdentityPort = Readonly<{
  now: () => ProjectRuntimeClockReading;
  createStableId: (prefix: string, parts: readonly string[]) => string;
  createContentHash: (content: string) => string;
}>;
