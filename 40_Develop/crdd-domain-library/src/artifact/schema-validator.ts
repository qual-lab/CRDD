/**
 * schema-validatorに属する責務をまとめる。
 *
 * @responsibility ArtifactSchemaを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import type { ArtifactModel } from "./artifact-model.ts";

/**
 * schema-validatorで使用するArtifact Schemaの値契約を定義する。
 *
 * @responsibility Artifact SchemaのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactSchemaが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactSchemaで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactSchemaの宣言は外部境界を開かない。
 * @security N/A: ArtifactSchemaはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactSchemaの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactSchema = Readonly<{
  id: string;
  matches: (artifact: ArtifactModel) => boolean;
  requiredProperties?: readonly (keyof Pick<
    ArtifactModel,
    "artifactType" | "canonicalId" | "status"
  >)[];
  requiredSections?: readonly string[];
  allowedStatuses?: readonly string[];
}>;

/**
 * schema-validatorで使用するArtifact Schema Validation 結果の値契約を定義する。
 *
 * @responsibility Artifact Schema Validation 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ArtifactSchemaValidationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactSchemaValidationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactSchemaValidationResultの宣言は外部境界を開かない。
 * @security N/A: ArtifactSchemaValidationResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactSchemaValidationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactSchemaValidationResult = DomainOutcome<ArtifactModel>;

/**
 * schema Issueを決定する。
 *
 * @responsibility schema Issueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input artifact: ArtifactModel、schemaId: string、kind: string、reason: string、details: DomainIssue["details"]
 * @returns DomainIssueを返す。
 * @precondition 「artifact: ArtifactModel、schemaId: string、kind: string、reason: string、details: DomainIssue["details"]」がschemaIssueの入力契約を満たす。
 * @postcondition schemaIssueの責務を完了した結果だけを返す。
 * @effect N/A: schemaIssueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: schemaIssueは独自の失敗分岐を所有しない。
 * @invariant schemaIssueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: schemaIssueはProcess内の同一Subsystemで完結する。
 * @security N/A: schemaIssueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: schemaIssueは共有非同期状態を持たない同期処理である。
 */
function schemaIssue(
  artifact: ArtifactModel,
  schemaId: string,
  kind: string,
  reason: string,
  details: DomainIssue["details"],
): DomainIssue {
  return {
    kind,
    targetIdentity: artifact.canonicalId ?? artifact.sourceLocation.path,
    location: artifact.sourceLocation,
    reason,
    details: { schemaId, ...details },
  };
}

/**
 * Artifact Schemaの契約を検証する。
 *
 * @responsibility Artifact Schemaの必須Property、拒否条件、検証結果の境界を所有する。
 * @trace ARCH-000008
 * @input artifact: ArtifactModel、schema: ArtifactSchema
 * @returns ArtifactSchemaValidationResultを返す。
 * @precondition 「artifact: ArtifactModel、schema: ArtifactSchema」がvalidateArtifactSchemaの入力契約を満たす。
 * @postcondition validateArtifactSchemaの責務を完了した結果だけを返す。
 * @effect N/A: validateArtifactSchemaは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validateArtifactSchemaは独自の失敗分岐を所有しない。
 * @invariant validateArtifactSchemaは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateArtifactSchemaはProcess内の同一Subsystemで完結する。
 * @security N/A: validateArtifactSchemaはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validateArtifactSchemaは共有非同期状態を持たない同期処理である。
 */
export function validateArtifactSchema(
  artifact: ArtifactModel,
  schema: ArtifactSchema,
): ArtifactSchemaValidationResult {
  const issues: DomainIssue[] = [];
  for (const property of schema.requiredProperties ?? [])
    if (!artifact[property])
      issues.push(
        schemaIssue(
          artifact,
          schema.id,
          "artifact.schema.property-missing",
          "required_property_missing",
          { property },
        ),
      );
  const sectionTitles = new Set(artifact.sections.map(({ title }) => title));
  for (const section of schema.requiredSections ?? [])
    if (!sectionTitles.has(section))
      issues.push(
        schemaIssue(
          artifact,
          schema.id,
          "artifact.schema.section-missing",
          "required_section_missing",
          { section },
        ),
      );
  if (
    schema.allowedStatuses &&
    artifact.status &&
    !schema.allowedStatuses.includes(artifact.status)
  )
    issues.push(
      schemaIssue(
        artifact,
        schema.id,
        "artifact.schema.status-invalid",
        "status_outside_declared_schema",
        { status: artifact.status },
      ),
    );
  return {
    status: issues.length === 0 ? "complete" : "invalid",
    result: issues.length === 0 ? artifact : null,
    issues,
  };
}
