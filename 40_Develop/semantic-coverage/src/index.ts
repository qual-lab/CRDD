/**
 * Canonical設計からSemantic Coverageを生成する公開境界。
 * @packageDocumentation
 * @responsibility Semantic IR、Quality Relation、Coverage Graphを決定論的に生成する。
 * @trace ARCH-000008
 * @boundary 検証済みRepository入力と生成Bundle公開先のFilesystem境界。
 * @effect 完全なSemantic Coverage Bundleを原子的に公開し得る。
 * @concurrency 同一入力集合と一時Fileの公開Operationを一回の実行へ結合する。
 * @security 検証済みRepository Root外の読取りと公開を拒否する。
 */
export {
  compileQualitySemanticRelations,
  type QualitySemanticRelation,
} from "./compilation/compile-quality-relations.ts";
export {
  compileSemanticIr,
  type SemanticIr,
  type SemanticIrMeaning,
  type SemanticSourceDocument,
} from "./compilation/compile-ir.ts";
export {
  createSemanticBundle,
  type SemanticBundleContent,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
  type SemanticCoverageProjection,
} from "./coverage/graph-and-bundle.ts";
export {
  compileQualitySemanticRelationsFromRepository,
  compileSemanticIrFromRepository,
  createSemanticCoverageGraphResult,
  mapSemanticDomainIssueToDiagnostic,
  type SemanticCoverageDiagnostic,
} from "./compilation/from-repository.ts";
export {
  publishSemanticCoverage,
  type PublishSemanticCoverageRequest,
  type PublishSemanticCoverageResult,
} from "./bundle/publish.ts";
export {
  createFilesystemSemanticBundlePublisher,
  publishSemanticCoverageBundleWithHooks,
  type SemanticBundlePublisher,
  type SemanticBundlePublishReceipt,
  type SemanticBundlePublishRequest,
  type SemanticBundleWriterHooks,
} from "./bundle/filesystem-publisher.ts";
