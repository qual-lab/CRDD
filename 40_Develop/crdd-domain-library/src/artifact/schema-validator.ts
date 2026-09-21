import type { DomainIssue, DomainOutcome } from "../outcome.ts";
import type { ArtifactModel } from "./artifact-model.ts";

/**
 * ArtifactSchemaが扱う値の構造を表す。
 *
 * @responsibility ArtifactSchemaに必要な値と制約を一つの型契約として保持する。
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
 * ArtifactSchemaValidationResultが扱う値の構造を表す。
 *
 * @responsibility ArtifactSchemaValidationResultに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape ArtifactSchemaValidationResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ArtifactSchemaValidationResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ArtifactSchemaValidationResultの宣言は外部境界を開かない。
 * @security N/A: ArtifactSchemaValidationResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ArtifactSchemaValidationResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ArtifactSchemaValidationResult = DomainOutcome<ArtifactModel>;

/**
 * schemaIssueの処理を実行する。
 *
 * @responsibility schemaIssueに対応する入力処理と結果生成を所有する。
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
 * validateArtifactSchemaの処理を実行する。
 *
 * @responsibility validateArtifactSchemaに対応する入力処理と結果生成を所有する。
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
