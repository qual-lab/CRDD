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
  compileSemanticIr,
  type QualitySemanticRelation,
  type SemanticIr,
  type SemanticIrMeaning,
  type SemanticSourceDocument,
} from "./compilation/index.ts";
export {
  createSemanticBundle,
  type SemanticBundleContent,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
  type SemanticCoverageProjection,
} from "./coverage/index.ts";
export {
  compileQualitySemanticRelationsFromRepository,
  compileSemanticIrFromRepository,
  createSemanticCoverageGraph,
  mapSemanticDomainIssueToDiagnostic,
  type SemanticCoverageDiagnostic,
} from "./application/semantic-coverage.ts";
export {
  publishSemanticCoverage,
  type PublishSemanticCoverageRequest,
  type PublishSemanticCoverageResult,
} from "./application/semantic-bundle.ts";
export {
  createFilesystemSemanticBundlePublisher,
  publishSemanticCoverageBundleWithHooks,
  type SemanticBundlePublisher,
  type SemanticBundlePublishReceipt,
  type SemanticBundlePublishRequest,
  type SemanticBundleWriterHooks,
} from "./infrastructure/filesystem-semantic-bundle-publisher.ts";
