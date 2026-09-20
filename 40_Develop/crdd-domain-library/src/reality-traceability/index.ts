/**
 * 実装・試験Symbolを発見して関係Graphへ接続する公開境界。
 * @packageDocumentation
 * @responsibility Canonicalな意味と現在の実装Realityを追跡可能にする。
 * @trace ARCH-000008
 */
export {
  realitySymbolKinds,
  type LoadedRealitySymbolManifest,
  type RealitySymbol,
  type RealitySymbolKind,
  type RealitySymbolManifest,
} from "./symbol-manifest-model.ts";
export {
  type RealitySymbolGraph,
  type RealitySymbolNode,
  createRealitySymbolGraph,
} from "./symbol-graph.ts";
export { validateRealitySymbolManifest } from "./symbol-manifest-validator.ts";
export {
  type RealitySymbolDiscoveryRequest,
  type RealitySymbolDiscoveryResult,
  type RealitySymbolDiscoverySource,
  discoverRealitySymbols,
} from "./symbol-discovery.ts";
