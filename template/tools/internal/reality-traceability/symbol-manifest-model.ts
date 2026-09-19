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

export type RealitySymbolKind = (typeof realitySymbolKinds)[number];

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

export type RealitySymbolManifest = Readonly<{
  contract: "crdd/reality-symbol-manifest";
  contractRevision: 1;
  subsystem: string;
  symbols: readonly RealitySymbol[];
}>;

export type RealitySymbolFinding = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type LoadedRealitySymbolManifest = Readonly<{
  manifestPath: string;
  subsystemRoot: string;
  manifest: RealitySymbolManifest;
}>;
