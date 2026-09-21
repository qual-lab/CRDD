/**
 * indexに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
export {
  type SemanticBundleContent,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
  type SemanticCoverageProjection,
  createSemanticBundle,
  createSemanticCoverageGraph,
} from "./semantic-coverage-graph.ts";
