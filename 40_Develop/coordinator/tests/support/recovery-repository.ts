/**
 * 回復に渡すGit観測をアプリケーション層の試験で準備する。
 * @packageDocumentation
 * @responsibility 上位の確定済み保存先と既存の現在性判定だけを試験へ渡す。
 * @trace ERB-IT-014
 * @boundary 試験専用。製品の許可や保存は行わない。
 */
import { types } from "node:util";
import * as versionControl from "../../../version-control/src/index.ts";

/**
 * 合成Repositoryに対する上位の回復受付を試験内で組み立てる。
 * @trace ERB-IT-014
 * @precondition Caseが生成したRepository参照、又は同じ参照に結合した保持設定だけを渡す。
 * @boundary Gitの観測は試験の準備。製品の回復Writerへは保存先と同期確認だけを渡す。
 */
export function prepareFixtureRecovery(input: unknown) {
  const value = (source: unknown, name: string): unknown => {
    if (!source || typeof source !== "object" || types.isProxy(source))
      return undefined;
    const field = Object.getOwnPropertyDescriptor(source, name);
    return field && "value" in field ? field.value : undefined;
  };
  const days = value(input, "historyRetentionDays");
  const capability = (
    days === undefined ? input : value(input, "root")
  ) as versionControl.Repository;
  const directory = versionControl.resolveVerifiedRepositoryRoot(capability);
  if (!directory) return null;
  const initial = versionControl.readRepositoryRevision(capability);
  if (!initial) return null;
  const retain = value(input, "revalidate");
  return {
    purpose: "recovery" as const,
    root: { directory },
    historyRetentionDays: typeof days === "number" ? days : null,
    revalidate(expected?: number) {
      const fresh = versionControl.readRepositoryRevision(capability);
      return (
        (expected === undefined ||
          (typeof retain === "function" && retain(expected) === true)) &&
        fresh !== null &&
        fresh.repositoryForm === initial.repositoryForm &&
        fresh.repositoryIdentity === initial.repositoryIdentity &&
        fresh.repositoryInstanceIdentity ===
          initial.repositoryInstanceIdentity &&
        fresh.revisionIdentity === initial.revisionIdentity
      );
    },
  };
}
