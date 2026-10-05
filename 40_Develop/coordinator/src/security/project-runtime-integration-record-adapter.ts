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
import { readStableBoundedFileSnapshot } from "./bounded-file-snapshot.ts";

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
export type IntegrationRecordBinding = Readonly<{
  workingDirectory: string;
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
}>;

const RECORD_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,511}$/u;
const BINDING_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;

/**
 * 旧公開結果の完全な保存値を定義する。
 *
 * @responsibility 候補公開と採用Receiptの結合・内容を移行入力として保持する。
 * @trace ARCH-000005
 * @shape contract、kind、四つの結合ID、identity、contentHash、value。
 * @invariant 保存成功を受領・既読へ読み替えない。
 * @boundary 既存結果保存から新版への移行入力。
 * @security 保護DecisionやAuthorityを追加しない。
 * @compatibility valueは既存PortのJSON値をそのまま保持する。
 */
export type LegacyResultRecord = Readonly<{
  contract: typeof PROJECT_RUNTIME_INTEGRATION_CONTRACT;
  kind: "integration" | "adoption";
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  identity: string;
  contentHash: string;
  value: unknown;
}>;

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
): value is LegacyResultRecord {
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

/**
 * 旧結果入力の全件と導出元を定義する。
 *
 * @responsibility 読取り検証と物理移行を区別する。
 * @trace ARCH-000005
 * @shape records、sourceRecords、migrationCommitted。
 * @invariant migrationCommittedは常にfalse。
 * @boundary 読取り専用の移行準備。
 * @security Hashを実適用・回復成立の証明にしない。
 * @compatibility 既存write Portを置換しない。
 */
type LegacyResultInputs = Readonly<{
  records: readonly LegacyResultRecord[];
  sourceRecords: readonly Readonly<{ relativePath: string; sha256: string }>[];
  migrationCommitted: false;
}>;

/**
 * 移行入力の親Directoryを順に確認する。
 *
 * @responsibility 真正の不存在と不正・観測不能を区別する。
 * @trace ARCH-000005
 * @input directory: 絶対Path。missingAllowed: 不存在を許すか。
 * @returns 実在する正規Directoryならtrue、許された不存在ならfalse。
 * @precondition 検証済みRootから子へ順番に呼ぶ。
 * @postcondition aliasや不正種別を空入力にしない。
 * @effect Filesystemを読み取るだけ。
 * @failure ENOENT以外の観測失敗・alias・非Directoryで例外。
 * @invariant 許可外Pathを列挙しない。
 * @boundary Repository-local Filesystem。
 * @security symlinkとjunctionを拒否する。
 * @concurrency Writer停止や一貫Snapshotを証明しない。
 */
function legacyDirectory(directory: string, missingAllowed: boolean): boolean {
  let recordInfo: fs.Stats;
  try {
    recordInfo = fs.lstatSync(directory);
  } catch (error) {
    if (missingAllowed && (error as NodeJS.ErrnoException).code === "ENOENT")
      return false;
    throw error;
  }
  if (
    !recordInfo.isDirectory() ||
    recordInfo.isSymbolicLink() ||
    fs.realpathSync.native(directory) !== directory
  )
    throw new Error("legacy_result_directory_invalid");
  return true;
}

/**
 * 既存公開結果を全件検証して移行入力へ抽出する。
 *
 * @responsibility 候補公開・採用Receiptを落とさず、破損・結合不一致を拒否する。
 * @trace ARCH-000005
 * @input workingDirectory: 対象Repository内の起点。
 * @returns 全結果と元Byte列Hash、または停止結果。
 * @precondition Version Control Rootが一意に検証できる。
 * @postcondition 全件検証成功時だけ入力を返し、移行済みとは表示しない。
 * @effect Filesystemの読取りのみ。作成・変更・削除・外部送信なし。
 * @failure 親alias、列挙後消失、観測不能、不正JSON・Hash・Identityを拒否する。
 * @invariant 結果の不存在を再適用許可にしない。
 * @boundary 旧results保存から移行準備。
 * @security 本文を診断出力へ複製せず、hardlinkを拒否する。
 * @concurrency 各Fileの安定読取りだけを確認し、旧Writer排他は別途必要。
 */
export function readLegacyProjectRuntimeResultInputs(
  workingDirectory: string,
): ProjectRuntimePortResult<LegacyResultInputs> {
  try {
    const paths =
      resolveRepositoryRuntimeDataPathsFromWorkingDirectory(workingDirectory);
    if (!paths) throw new Error("legacy_result_root_invalid");
    const root = fs.realpathSync.native(paths.repositoryRoot);
    if (root !== paths.repositoryRoot)
      throw new Error("legacy_result_root_alias");
    legacyDirectory(root, false);
    const records: LegacyResultRecord[] = [];
    const sourceRecords: { relativePath: string; sha256: string }[] = [];
    const result = () =>
      Object.freeze({
        status: "completed" as const,
        reason: "project_runtime_legacy_results_observed",
        value: Object.freeze({
          records: Object.freeze(records),
          sourceRecords: Object.freeze(sourceRecords),
          migrationCommitted: false as const,
        }),
      });
    const observedParents = [root];
    for (const parent of [
      path.join(root, ".crdd"),
      paths.projectRuntime,
      path.join(paths.projectRuntime, "results"),
    ]) {
      if (!legacyDirectory(parent, true)) {
        for (const observed of observedParents)
          legacyDirectory(observed, false);
        return result();
      }
      observedParents.push(parent);
    }
    const directory = path.join(paths.projectRuntime, "results");
    const kinds = fs.readdirSync(directory).sort();
    if (kinds.some((kind) => kind !== "integration" && kind !== "adoption"))
      throw new Error("legacy_result_kind_invalid");
    for (const kind of kinds) {
      const kindDirectory = path.join(directory, kind);
      legacyDirectory(kindDirectory, false);
      for (const project of fs.readdirSync(kindDirectory).sort()) {
        if (!BINDING_IDENTITY.test(project))
          throw new Error("legacy_result_project_invalid");
        const projectDirectory = path.join(kindDirectory, project);
        legacyDirectory(projectDirectory, false);
        for (const name of fs.readdirSync(projectDirectory).sort()) {
          const identity = name.endsWith(".json") ? name.slice(0, -5) : "";
          if (!RECORD_IDENTITY.test(identity))
            throw new Error("legacy_result_file_invalid");
          const location = path.join(projectDirectory, name);
          if (fs.lstatSync(location).nlink !== 1)
            throw new Error("legacy_result_link_invalid");
          const snapshot = readStableBoundedFileSnapshot(
            location,
            16 * 1024 * 1024,
          );
          const parsed: unknown = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(snapshot.bytes),
          );
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
            throw new Error("legacy_result_shape_invalid");
          const record = parsed as Record<string, unknown>;
          if (
            !validProjectRuntimeResultRecord(record) ||
            record.kind !== kind ||
            record.identity !== identity ||
            record.projectId !== project
          )
            throw new Error("legacy_result_binding_invalid");
          if (fs.lstatSync(location).nlink !== 1)
            throw new Error("legacy_result_link_changed");
          legacyDirectory(root, false);
          legacyDirectory(path.join(root, ".crdd"), false);
          legacyDirectory(paths.projectRuntime, false);
          legacyDirectory(directory, false);
          legacyDirectory(kindDirectory, false);
          legacyDirectory(projectDirectory, false);
          records.push(Object.freeze(record as LegacyResultRecord));
          sourceRecords.push(
            Object.freeze({
              relativePath: `results/${kind}/${project}/${name}`,
              sha256: createHash("sha256").update(snapshot.bytes).digest("hex"),
            }),
          );
        }
      }
    }
    return result();
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "project_runtime_legacy_results_invalid_or_unknown",
      value: null,
      manualRecoveryRequired: false,
      recoveryId: null,
    });
  }
}

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
