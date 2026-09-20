/**
 * CRDD Artifactの解析と関係Graphを扱う公開境界。
 * @packageDocumentation
 * @responsibility Markdown成果物を機械可読なArtifact Modelへ変換する。
 * @trace ARCH-000008
 */
export type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistResult,
  SourceLocation,
} from "./artifact-model.ts";
export type {
  ArtifactGraph,
  ArtifactGraphResult,
  BuildArtifactGraphRequest,
} from "./artifact-graph.ts";
export { buildArtifactGraph } from "./artifact-graph.ts";
export { parseMarkdownArtifact } from "./markdown-artifact-parser.ts";
export type {
  ArtifactSchema,
  ArtifactSchemaValidationResult,
} from "./schema-validator.ts";
export { validateArtifactSchema } from "./schema-validator.ts";
