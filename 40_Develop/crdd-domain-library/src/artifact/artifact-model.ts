/**
 * artifact-modelに属する責務をまとめる。
 *
 * @responsibility SourceLocationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
/**
 * artifact-modelで使用するSource Locationの値契約を定義する。
 *
 * @responsibility Source LocationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape SourceLocationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SourceLocationで宣言した値と責務の対応を維持する。
 * @boundary N/A: SourceLocationの宣言は外部境界を開かない。
 * @security N/A: SourceLocationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SourceLocationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SourceLocation = Readonly<{
  path: string;
  line: number;
}>;

/**
 * artifact-modelで使用するArtifact Sectionの値契約を定義する。
 *
 * @responsibility Artifact SectionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactSectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactSectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactSectionの宣言は外部境界を開かない。
 * @security N/A: ArtifactSectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactSectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactSection = Readonly<{
  level: number;
  title: string;
  body: string;
  location: SourceLocation;
}>;

/**
 * artifact-modelで使用するArtifact Relationの値契約を定義する。
 *
 * @responsibility Artifact RelationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactRelationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactRelationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactRelationの宣言は外部境界を開かない。
 * @security N/A: ArtifactRelationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactRelationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactRelation = Readonly<{
  type: string;
  target: string;
  location: SourceLocation;
}>;

/**
 * artifact-modelで使用するChecklist 結果の値契約を定義する。
 *
 * @responsibility Checklist 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ChecklistResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ChecklistResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ChecklistResultの宣言は外部境界を開かない。
 * @security N/A: ChecklistResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ChecklistResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ChecklistResult = Readonly<{
  result: "passed" | "unchecked" | "open" | "failed" | "not_applicable";
  text: string;
  reason: string | null;
  location: SourceLocation;
}>;

/**
 * artifact-modelで使用するArtifact Modelの値契約を定義する。
 *
 * @responsibility Artifact ModelのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactModelが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactModelで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactModelの宣言は外部境界を開かない。
 * @security N/A: ArtifactModelはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactModelの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactModel = Readonly<{
  artifactType: string | null;
  canonicalId: string | null;
  status: string | null;
  formalInputs: readonly string[];
  provenance: readonly string[];
  sections: readonly ArtifactSection[];
  relations: readonly ArtifactRelation[];
  checklist: readonly ChecklistResult[];
  sourceLocation: SourceLocation;
}>;

/**
 * artifact-modelで使用するArtifact Sourceの値契約を定義する。
 *
 * @responsibility Artifact SourceのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactSourceが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactSourceで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactSourceの宣言は外部境界を開かない。
 * @security N/A: ArtifactSourceはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactSourceの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactSource = Readonly<{
  path: string;
  content: string;
}>;
