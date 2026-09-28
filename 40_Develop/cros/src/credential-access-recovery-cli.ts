/**
 * CROS Credential Access RecoveryをHost対話CLIへ接続する。
 *
 * @packageDocumentation
 * @responsibility 検証済みRuntime Root、秘密非保持Recovery計画、人間のexact確認および一度表示TokenをCLIへ搬送する。
 * @trace ARCH-000013
 * @boundary Host Terminal、Runtime Data AdapterおよびCredential Recovery Applicationの境界。
 * @effect 確認済みの場合だけRecovery EventとCredential Registryを更新する。
 * @security Remote Transportへ公開せず、生Tokenを完了時のTerminalへ一度だけ表示する。
 */

import type { CrosRootInput } from "../../runtime-data/src/index.ts";

import {
  applyCredentialAccessRecovery,
  planCredentialAccessRecovery,
  type CredentialAccessRecoveryMode,
  type CredentialAccessRecoveryPlan,
  type CredentialAccessRecoveryResult,
} from "./credential-access-recovery.ts";
import { createCredentialAccessRecoveryFileAdapter } from "./credential-access-recovery-file-adapter.ts";
import { createCredentialRegistryFileAdapter } from "./credential-registry-file-adapter.ts";

/**
 * Host Recovery CLIが利用する対話境界を定義する。
 *
 * @responsibility 計画表示、人間確認および結果表示をApplicationからTerminal方式へ分離する。
 * @trace ARCH-000013
 * @shape writeとconfirmの二操作。
 * @invariant confirmは表示済みplanを入力とし、秘密値を受け取らない。
 * @boundary Recovery CLI ApplicationとTerminal Adapterの境界。
 * @security Token入力やRemote Credential入力を要求しない。
 * @compatibility 対話方式を試験Adapterへ差し替え可能にする。
 */
export type CredentialAccessRecoveryCliIo = Readonly<{
  write(value: unknown): void;
  confirm(plan: CredentialAccessRecoveryPlan): Promise<boolean>;
}>;

/**
 * Host限定Credential Access Recovery CLIを実行する。
 *
 * @responsibility Adapter構成、Recovery計画表示、exact確認、不可分適用および結果表示を順序付ける。
 * @trace ARCH-000013
 * @input Runtime Root入力、Recovery modeおよびTerminal I/O Port。
 * @returns Process exit codeとして0、2または64を返す。
 * @precondition CROS Serverを停止し、Host所有者のOS Sessionから実行する。
 * @postcondition 0のときだけ新管理Tokenを一度表示し、2は安全なblocked／recovery_required、64は構成不正を表す。
 * @effect 人間が表示済み計画を確認した場合だけRecovery EventとCredential Registryを更新する。
 * @failure Root不正、確認拒否、古いplan、競合または記録不能を成功へ畳まない。
 * @invariant Product Data、Workspace ExposureおよびRepository内容を変更しない。
 * @boundary Host Terminal→File Adapters→Credential Recovery Application。
 * @security 生Tokenはcompleted結果にだけ含まれ、耐久Eventへ渡さない。
 * @concurrency plan revisionとRegistry publishの楽観的排他を使用し、自動再試行しない。
 */
export async function runCredentialAccessRecoveryCli(
  rootInput: CrosRootInput,
  mode: CredentialAccessRecoveryMode,
  io: CredentialAccessRecoveryCliIo,
): Promise<0 | 2 | 64> {
  const registryAdapter = createCredentialRegistryFileAdapter(rootInput);
  const recorderAdapter = createCredentialAccessRecoveryFileAdapter(rootInput);
  if (
    registryAdapter.status !== "ready" ||
    recorderAdapter.status !== "ready"
  ) {
    io.write({
      status: "blocked",
      reason: "credential_access_recovery_runtime_root_invalid",
      effectIssued: false,
    });
    return 64;
  }
  const planned = planCredentialAccessRecovery(registryAdapter.registry, {
    hostAuthorityConfirmed: true,
    mode,
  });
  io.write(planned);
  if (planned.status !== "ready") return 2;
  const confirmed = await io.confirm(planned.plan);
  const result = applyCredentialAccessRecovery(
    registryAdapter.registry,
    planned.plan,
    confirmed,
    recorderAdapter.recorder,
  );
  io.write(publicResult(result));
  return result.status === "completed" ? 0 : 2;
}

/**
 * Recovery結果をCLI公開値へ変換する。
 *
 * @responsibility completed時の一度表示Tokenを保持し、それ以外では秘密値なしの状態だけを返す。
 * @trace ARCH-000013
 * @input Credential Access Recovery result。
 * @returns JSON直列化可能な公開結果。
 * @precondition resultはRecovery Applicationの閉じた結果型である。
 * @postcondition blocked／recovery_requiredへtoken fieldを追加しない。
 * @effect N/A: 値を変換するだけである。
 * @failure N/A: 閉じた型入力だけを受ける。
 * @invariant completedのTokenを改変せず、再取得参照を作らない。
 * @boundary Recovery ApplicationとTerminal出力の内部境界。
 * @security Tokenはcompleted時だけ一度表示する。
 * @concurrency N/A: 共有状態を持たない。
 */
function publicResult(result: CredentialAccessRecoveryResult): unknown {
  if (result.status === "completed") return result;
  const { token: ignoredToken, ...publicFields } = result;
  void ignoredToken;
  return publicFields;
}
