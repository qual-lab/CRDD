/**
 * indexに属する責務をまとめる。
 *
 * @responsibility このFileに属する実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
export {
  type SemanticIr,
  type SemanticIrMeaning,
  type SemanticSourceDocument,
  compileSemanticIr,
} from "./semantic-ir-compiler.ts";
export {
  type QualitySemanticRelation,
  compileQualitySemanticRelations,
} from "./quality-semantic-relation.ts";
