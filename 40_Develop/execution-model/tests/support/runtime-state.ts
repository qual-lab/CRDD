/**
 * 管理Taskの合成値を新Schemaの定義・技術行へ分けて試験入力を作る。
 * @packageDocumentation
 * @responsibility 試験の組立てだけを行い、旧保存Fileの読取りや移行は提供しない。
 * @trace PRL-UT-006
 * @level UT
 * @scope メモリ内の明示合成値。
 * @boundary 不正fieldを補正せず、新codec自身へ拒否させる。
 */
import { hashRuntimeProjectDefinition } from "../../src/state/validation.ts";
import type { RuntimeProjectDefinition } from "../../src/state/types.ts";

/**
 * 結合して組み立てた試験Projectを正本の二区画へ配置する。
 * @responsibility 全fieldを保持して分配し、欠測・未知fieldを検査から隠さない。
 * @trace PRL-UT-006
 * @precondition 自己生成した通常Objectだけを渡す。保存byte列は渡さない。
 * @stimulus 定義と技術値を分離して同じTask IDで結ぶ。
 * @observation 新形式のprojectsとmanagedExecutions。
 * @oracle Schemaは変更せず、未知fieldや欠測は正規codecへ残す。
 * @cleanup N/A: メモリ内だけ。
 * @boundary fixture組立てのみ。製品APIや互換Readerではない。
 */
export function createManagedRuntimeSnapshotFixture(input: unknown) {
  const value = input as Record<string, unknown> & {
    projects: Record<string, unknown>[];
  };
  if (Object.hasOwn(value, "managedExecutions")) return value;
  if (
    value.projects.every(
      (project) => project.contract === "crdd-domain/project-state/v1",
    )
  )
    return value;
  const managedExecutions: unknown[] = [];
  const projects = value.projects.map((project) => {
    const {
      taskExecutionSelections,
      ownerGeneration,
      maximumConcurrency,
      tasks,
      contract: _contract,
      ...core
    } = project;
    const rows = tasks as Record<string, unknown>[];
    const definition = {
      ...core,
      contract: "crdd-domain/project-state/v1" as const,
      tasks: rows.map((task) => task.definition),
    };
    managedExecutions.push({
      projectId: project.projectId,
      milestoneId: project.milestoneId,
      definitionHash: hashRuntimeProjectDefinition(
        definition as unknown as RuntimeProjectDefinition,
      ),
      ...(Object.hasOwn(project, "taskExecutionSelections")
        ? { taskExecutionSelections }
        : {}),
      ...(Object.hasOwn(project, "ownerGeneration") ? { ownerGeneration } : {}),
      ...(Object.hasOwn(project, "maximumConcurrency")
        ? { maximumConcurrency }
        : {}),
      tasks: rows.map(({ definition: taskDefinition, ...row }) => ({
        ...row,
        taskId: (taskDefinition as { id: unknown }).id,
      })),
    });
    return definition;
  });
  return { ...value, projects, managedExecutions };
}
