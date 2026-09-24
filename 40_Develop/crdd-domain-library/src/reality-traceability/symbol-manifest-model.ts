/**
 * symbol-manifest-modelに属する責務をまとめる。
 *
 * @responsibility RealitySymbolKindを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
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
 * symbol-manifest-modelで使用するReality Symbol Kindの値契約を定義する。
 *
 * @responsibility Reality Symbol KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolKindの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolKind = (typeof realitySymbolKinds)[number];

/**
 * symbol-manifest-modelで使用するReality Symbolの値契約を定義する。
 *
 * @responsibility Reality SymbolのProperty、Identity、状態制約を型境界として所有する。
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
 * symbol-manifest-modelで使用するReality Symbol Manifestの値契約を定義する。
 *
 * @responsibility Reality Symbol ManifestのProperty、Identity、状態制約を型境界として所有する。
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
 * symbol-manifest-modelで使用するLoaded Reality Symbol Manifestの値契約を定義する。
 *
 * @responsibility Loaded Reality Symbol ManifestのProperty、Identity、状態制約を型境界として所有する。
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
