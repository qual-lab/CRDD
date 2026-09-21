export const realitySymbolKinds = [
  "package",
  "module",
  "file",
  "class",
  "function",
  "config",
  "schema",
  "migration",
  "resource",
  "test-suite",
  "test-case",
] as const;

/**
 * RealitySymbolKindが扱う値の構造を表す。
 *
 * @responsibility RealitySymbolKindに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RealitySymbolKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolKindの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolKind = (typeof realitySymbolKinds)[number];

/**
 * RealitySymbolが扱う値の構造を表す。
 *
 * @responsibility RealitySymbolに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RealitySymbolが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbol = Readonly<{
  symbolId: string;
  kind: RealitySymbolKind;
  path: string;
  archIds: readonly string[];
  qaIds: readonly string[];
  localTestIds: readonly string[];
  verifies: readonly string[];
  implements?: readonly string[];
}>;

/**
 * RealitySymbolManifestが扱う値の構造を表す。
 *
 * @responsibility RealitySymbolManifestに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape RealitySymbolManifestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolManifestで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolManifestの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolManifestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolManifest = Readonly<{
  contract: "crdd/reality-symbol-manifest";
  contractRevision: 1;
  subsystem: string;
  symbols: readonly RealitySymbol[];
}>;

/**
 * LoadedRealitySymbolManifestが扱う値の構造を表す。
 *
 * @responsibility LoadedRealitySymbolManifestに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape LoadedRealitySymbolManifestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant LoadedRealitySymbolManifestで宣言した値と責務の対応を維持する。
 * @boundary N/A: LoadedRealitySymbolManifestの宣言は外部境界を開かない。
 * @security N/A: LoadedRealitySymbolManifestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility LoadedRealitySymbolManifestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type LoadedRealitySymbolManifest = Readonly<{
  manifestPath: string;
  subsystemRoot: string;
  manifest: RealitySymbolManifest;
}>;
