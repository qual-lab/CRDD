/**
 * 候補公開・採用結果の固定保存値を検査する。
 *
 * @responsibility 結果Identity・結合・内容Hashを確認し、保存や実適用を発行しない。
 * @trace ARCH-000005
 */
import { createHash } from "node:crypto";
import { PROJECT_RUNTIME_INTEGRATION_CONTRACT } from "../public-contract/integration-result.ts";
import type { ProjectRuntimeResultRecord } from "./types.ts";

const RECORD_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/u;
const BINDING_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

/**
 * 公開結果の閉じた保存値を確認する。
 * @responsibility 旧入力と統合保存で同じ結果契約を検証する。
 * @trace ARCH-000005
 * @input value: JSONから復号した値。
 * @returns 既存結果Recordとして有効か。
 * @precondition getterやtoJSONを持たないJSON値を渡す。
 * @postcondition 結合ID、kind、Identity、内容Hashを確認する。
 * @effect N/A: 値の検証のみ。
 * @failure 不正形状はfalse。
 * @invariant 結果Recordの受理を実適用や既読へ読み替えない。
 * @boundary 保存JSONと既存結果契約。
 * @security Authorityを生成しない。
 * @concurrency N/A: 同期の純粋検証。
 */
export function validProjectRuntimeResultRecord(
  value: unknown,
): value is ProjectRuntimeResultRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    JSON.stringify(Object.keys(record).sort()) ===
      JSON.stringify(
        [
          "contract",
          "kind",
          "repositoryBindingId",
          "projectId",
          "milestoneId",
          "queueId",
          "identity",
          "contentHash",
          "value",
        ].sort(),
      ) &&
    record.contract === PROJECT_RUNTIME_INTEGRATION_CONTRACT &&
    (record.kind === "integration" || record.kind === "adoption") &&
    typeof record.identity === "string" &&
    RECORD_IDENTITY.test(record.identity) &&
    [
      record.repositoryBindingId,
      record.projectId,
      record.milestoneId,
      record.queueId,
    ].every((id) => typeof id === "string" && BINDING_IDENTITY.test(id)) &&
    record.contentHash ===
      createHash("sha256").update(JSON.stringify(record.value)).digest("hex")
  );
}
