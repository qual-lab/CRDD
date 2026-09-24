/**
 * project-runtime-integration-record-adapterに属する責務をまとめる。
 *
 * @responsibility IntegrationRecordBindingを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000005
 */
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  PROJECT_RUNTIME_INTEGRATION_CONTRACT,
  type ProjectRuntimeIntegrationRecordPort,
  type ProjectRuntimePortResult,
} from "../../../project-runtime/src/index.ts";
import { resolveRepositoryRuntimeDataPathsFromWorkingDirectory } from "../../../runtime-data/src/index.ts";

/**
 * project-runtime-integration-record-adapterで使用するIntegration 記録 Bindingの値契約を定義する。
 *
 * @responsibility Integration 記録 BindingのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000005
 * @shape IntegrationRecordBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant IntegrationRecordBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: IntegrationRecordBindingの宣言は外部境界を開かない。
 * @security IntegrationRecordBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility IntegrationRecordBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type IntegrationRecordBinding = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
}>;

const RECORD_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const BINDING_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

/**
 * completedを決定する。
 *
 * @responsibility completedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000005
 * @input N/A: 実行時引数を受け取らない。
 * @returns ProjectRuntimePortResult<Readonly<{ written: true }>>を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcompletedの入力契約を満たす。
 * @postcondition completedの責務を完了した結果だけを返す。
 * @effect N/A: completedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completedは独自の失敗分岐を所有しない。
 * @invariant completedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security completedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completedは共有非同期状態を持たない同期処理である。
 */
function completed(): ProjectRuntimePortResult<Readonly<{ written: true }>> {
  return Object.freeze({
    status: "completed",
    reason: "project_runtime_integration_record_written",
    value: Object.freeze({ written: true as const }),
  });
}

/**
 * project-runtime-integration-record-adapterを停止結果として構築する。
 *
 * @responsibility project-runtime-integration-record-adapterの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000005
 * @input N/A: 実行時引数を受け取らない。
 * @returns ProjectRuntimePortResult<Readonly<{ written: true }>>を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(): ProjectRuntimePortResult<Readonly<{ written: true }>> {
  return Object.freeze({
    status: "blocked",
    reason: "project_runtime_integration_record_unknown",
    value: null,
    manualRecoveryRequired: true,
    recoveryId: null,
  });
}

/**
 * Bind Repository paths and immutable publication mechanics outside the Application Core.
 *
 * @responsibility Project Runtime Integration 記録 Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000005
 * @input binding: IntegrationRecordBinding
 * @returns ProjectRuntimeIntegrationRecordPortを返す。
 * @precondition 「binding: IntegrationRecordBinding」がcreateProjectRuntimeIntegrationRecordAdapterの入力契約を満たす。
 * @postcondition createProjectRuntimeIntegrationRecordAdapterの責務を完了した結果だけを返す。
 * @effect createProjectRuntimeIntegrationRecordAdapterはFilesystemの読取りまたは書込みを実行する。
 * @failure createProjectRuntimeIntegrationRecordAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProjectRuntimeIntegrationRecordAdapterは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createProjectRuntimeIntegrationRecordAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeIntegrationRecordAdapterは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeIntegrationRecordAdapter(
  binding: IntegrationRecordBinding,
): ProjectRuntimeIntegrationRecordPort {
  const runtimePaths = resolveRepositoryRuntimeDataPathsFromWorkingDirectory(
    binding.workingDirectory,
  );
  if (!runtimePaths)
    throw new Error("project_runtime_integration_repository_root_invalid");
  return Object.freeze({
    write: (record) => {
      try {
        if (
          (record.kind !== "integration" && record.kind !== "adoption") ||
          !RECORD_IDENTITY.test(record.identity) ||
          !BINDING_IDENTITY.test(binding.repositoryBindingId) ||
          !BINDING_IDENTITY.test(binding.projectId) ||
          !BINDING_IDENTITY.test(binding.milestoneId) ||
          !BINDING_IDENTITY.test(binding.queueId)
        )
          return blocked();
        const directory = path.join(
          runtimePaths.projectRuntime,
          "results",
          record.kind,
          binding.projectId,
        );
        fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
        const payload = `${JSON.stringify({
          contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
          kind: record.kind,
          repositoryBindingId: binding.repositoryBindingId,
          projectId: binding.projectId,
          milestoneId: binding.milestoneId,
          queueId: binding.queueId,
          identity: record.identity,
          contentHash: createHash("sha256")
            .update(JSON.stringify(record.value))
            .digest("hex"),
          value: record.value,
        })}\n`;
        const target = path.join(directory, `${record.identity}.json`);
        if (fs.existsSync(target))
          return fs.readFileSync(target, "utf8") === payload
            ? completed()
            : blocked();
        const temporary = path.join(directory, `.pending-${randomUUID()}.tmp`);
        const descriptor = fs.openSync(
          temporary,
          fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL,
          0o600,
        );
        try {
          fs.writeFileSync(descriptor, payload, "utf8");
          fs.fsyncSync(descriptor);
        } finally {
          fs.closeSync(descriptor);
        }
        try {
          fs.renameSync(temporary, target);
        } catch (error) {
          fs.rmSync(temporary, { force: true });
          if (
            !fs.existsSync(target) ||
            fs.readFileSync(target, "utf8") !== payload
          )
            throw error;
        }
        return fs.readFileSync(target, "utf8") === payload
          ? completed()
          : blocked();
      } catch {
        return blocked();
      }
    },
  });
}
