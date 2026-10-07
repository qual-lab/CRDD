/**
 * CROS Credential Access Recoveryの秘密非保持記録をOS管理Runtime Rootへ保存する。
 *
 * @packageDocumentation
 * @responsibility 固定Recovery計画と適用結果を同じRecovery Identityの不変Eventとして耐久記録する。
 * @trace ARCH-000013
 * @boundary Runtime Data Root Resolver、FilesystemおよびCredential Access Recovery Recorderの境界。
 * @effect CROS state Root内のcredential-access-recovery Directoryへ不変JSON Eventを作成する。
 * @security 生Token、salt、VerifierおよびProduct Dataを保存しない。
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import {
  resolveCrosRuntimeRoots,
  type CrosRootInput,
} from "../../domain-model/src/repository/index.ts";

import type { CredentialAccessRecoveryRecorder } from "./credential-access-recovery.ts";

const RECOVERY_ID = /^credential-access-recovery\.[a-f0-9]{32}$/u;

/**
 * File Recovery Recorderの生成結果を定義する。
 *
 * @responsibility Runtime Root解決失敗と利用可能Recorderを区別する。
 * @trace ARCH-000013
 * @shape readyとblockedの判別Union。
 * @invariant readyだけがrecorderを持つ。
 * @boundary CROS構成RootとRecovery Applicationの境界。
 * @security Host絶対Pathを公開結果へ含めない。
 * @compatibility blocked reasonは安定した機械値として扱う。
 */
export type CredentialAccessRecoveryFileAdapterResult = Readonly<
  | {
      status: "ready";
      reason: "credential_access_recovery_file_adapter_ready";
      recorder: CredentialAccessRecoveryRecorder;
    }
  | {
      status: "blocked";
      reason: "credential_access_recovery_runtime_root_invalid";
      recorder: null;
    }
>;

/**
 * OS管理CROS Runtime RootへCredential Access Recovery Recorderを構成する。
 *
 * @responsibility 任意Path入力を受けず、共通Resolverが確定したTrust Domain Rootだけを記録先にする。
 * @trace ARCH-000013
 * @input Runtime Data契約のCrosRootInput。
 * @returns readyなRecorderまたはEffect 0のblocked結果。
 * @precondition Publisher、Application、Trust DomainおよびOS Rootを明示する。
 * @postcondition ready時も最初のprepareまでDirectoryを作成しない。
 * @effect 構成時はFilesystem Effectを発行しない。
 * @failure Root不正をPath非開示のblockedへ変換する。
 * @invariant Repository-local .crddまたはcaller指定の任意Pathを使用しない。
 * @boundary Runtime Data Resolver→Credential Access Recovery File Adapter。
 * @security 解決したRootを公開結果へ返さない。
 * @concurrency 同じRecovery Event Pathへの排他的作成で競合を決める。
 */
export function createCredentialAccessRecoveryFileAdapter(
  input: CrosRootInput,
): CredentialAccessRecoveryFileAdapterResult {
  const roots = resolveCrosRuntimeRoots(input);
  if (!roots)
    return Object.freeze({
      status: "blocked",
      reason: "credential_access_recovery_runtime_root_invalid",
      recorder: null,
    });
  const directory = path.join(roots.state, "credential-access-recovery");
  return Object.freeze({
    status: "ready",
    reason: "credential_access_recovery_file_adapter_ready",
    recorder: createFileRecorder(directory),
  });
}

/**
 * 解決済みDirectoryへFile Recovery Recorderを構成する。
 *
 * @responsibility prepareとsettleをRecovery Identity別の不変Eventへ変換する。
 * @trace ARCH-000013
 * @input Runtime Data Resolverから得たRecovery記録Directory。
 * @returns CredentialAccessRecoveryRecorder。
 * @precondition directoryはCROS state Root直下から導出済みである。
 * @postcondition prepare完了前にsettleを受理しない。
 * @effect prepare／settleごとに一つの不変JSON fileを作成する。
 * @failure 作成・flush・read-back失敗をfalseへ変換する。
 * @invariant 同じIdentityとphaseの異なる内容を上書きしない。
 * @boundary Recovery Recorder PortとFilesystemの内部境界。
 * @security 型で許可した秘密非保持fieldだけをJSON化する。
 * @concurrency 排他的file作成に成功したWriterまたは同一内容の再入場だけを成功とする。
 */
function createFileRecorder(
  directory: string,
): CredentialAccessRecoveryRecorder {
  return Object.freeze({
    prepare: (plan) =>
      writeImmutableEvent(directory, plan.recoveryId, "prepare", {
        contract: "crdd-cros/credential-access-recovery",
        contractRevision: 1,
        phase: "prepared",
        plan,
      }),
    settle: (recoveryId, result) => {
      if (!RECOVERY_ID.test(recoveryId)) return false;
      const preparePath = eventPath(directory, recoveryId, "prepare");
      if (!existsSync(preparePath)) return false;
      return writeImmutableEvent(directory, recoveryId, "settle", {
        contract: "crdd-cros/credential-access-recovery",
        contractRevision: 1,
        phase: "settled",
        recoveryId,
        result,
      });
    },
  });
}

/**
 * Recovery Eventを排他的に作成し同一内容だけ再入場可能にする。
 *
 * @responsibility 不変Eventの作成、flush、read-backおよびexact retryを一つの処理へ集約する。
 * @trace ARCH-000013
 * @input Directory、Recovery Identity、phaseおよび秘密非保持payload。
 * @returns 新規作成または既存同一内容を確認できた場合だけtrue。
 * @precondition payloadはRecovery型契約から構成し、生Secretを含まない。
 * @postcondition true時は完全な改行終端JSONを同じPathから再読取りできる。
 * @effect Directoryと一つのEvent fileを作成し得る。
 * @failure 不正Identity、異内容競合、I/O失敗またはread-back不一致をfalseにする。
 * @invariant 既存Eventを置換・削除しない。
 * @boundary Recovery File Adapter内部の永続化境界。
 * @security errorやpayloadを外部へ投げず、Pathを公開結果へ含めない。
 * @concurrency wxによる排他的作成をlinearization pointとする。
 */
function writeImmutableEvent(
  directory: string,
  recoveryId: string,
  phase: "prepare" | "settle",
  payload: unknown,
): boolean {
  if (!RECOVERY_ID.test(recoveryId)) return false;
  const target = eventPath(directory, recoveryId, phase);
  const content = `${JSON.stringify(payload)}\n`;
  try {
    mkdirSync(directory, { recursive: true });
    if (existsSync(target)) return readFileSync(target, "utf8") === content;
    const handle = openSync(target, "wx", 0o600);
    try {
      writeFileSync(handle, content, "utf8");
      fsyncSync(handle);
    } finally {
      closeSync(handle);
    }
    return readFileSync(target, "utf8") === content;
  } catch {
    return false;
  }
}

/**
 * Recovery Identityとphaseから閉じたEvent Pathを導出する。
 *
 * @responsibility Path要素を検証済みIdentityと固定phaseだけから構成する。
 * @trace ARCH-000013
 * @input 解決済みDirectory、Recovery Identityおよびphase。
 * @returns Directory直下のJSON file Path。
 * @precondition recoveryIdはRECOVERY_IDに一致する。
 * @postcondition 親Directoryを逸脱するPathを作らない。
 * @effect N/A: Path文字列を計算するだけである。
 * @failure N/A: 呼出し元がIdentityを検証する。
 * @invariant phaseはprepareまたはsettleに限定する。
 * @boundary File Adapter内部のPath構成境界。
 * @security caller supplied absolute Pathを受理しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function eventPath(
  directory: string,
  recoveryId: string,
  phase: "prepare" | "settle",
): string {
  return path.join(directory, `${recoveryId}-${phase}.json`);
}
