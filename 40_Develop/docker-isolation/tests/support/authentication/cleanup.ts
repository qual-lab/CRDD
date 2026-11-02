/**
 * 認証で用いた元技術資源の通常・単独回収を一つの処理へ集約する。
 * @responsibility 終了確認と元Receipt・固定構成を照合し、保存方式を知らず通知を順序付ける。
 * @trace ARCH-000010
 */
import { types } from "node:util";
import {
  planDockerAuthenticationResourceRecovery,
  type DockerAuthenticationPlan,
  type DockerAuthenticationCommand,
} from "./plan.ts";
import type { DockerAuthenticationExecution } from "./execute.ts";
import { captureAuthenticationResources } from "../../../src/cleanup/plan.ts";
import type {
  DockerAuthenticationResources,
  AuthenticationCleanupResult,
  DockerAuthenticationCleanupCallbacks,
} from "../../../src/cleanup/types.ts";

/**
 * Docker資源名を正規表現literalへ変換する。
 *
 * @responsibility 固定資源名をstderr exact照合で安全に使用できる形へ変換する。
 * @trace ARCH-000010
 * @input value: 固定Planから得たDocker資源名
 * @returns 正規表現meta文字をescapeした文字列を返す。
 * @precondition valueはCommand末尾から取得した文字列である。
 * @postcondition 返却値を正規表現へ埋めても元文字列のliteral一致になる。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure N/A: 任意文字列を決定論的にescapeする。
 * @invariant 文字を削除または意味変換しない。
 * @boundary Docker資源Identityとstderr parserの表現境界。
 * @security 正規表現注入を防ぐ。
 * @concurrency N/A: 共有状態を変更しない同期変換である。
 */
function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Docker結果が対象資源の明示不存在を示すか判定する。
 *
 * @responsibility exit、stdout、stderrおよびexact資源名の積で不存在を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: 不存在確認Command、result: その実行観測
 * @returns 明示不存在をすべて確認した場合だけtrueを返す。
 * @precondition commandは固定PlanのabsenceCommands要素である。
 * @postcondition 観測不能、任意stdoutまたは別資源の結果を不存在へ畳まない。
 * @effect N/A: 入力値だけを読み取る。
 * @failure 不正結果や未知形式はfalseへ閉じる。
 * @invariant status 1と固定stderrの両方を必要とする。
 * @boundary Docker CLI観測から資源不存在Domain判定への境界。
 * @security stderr全体を公開せず固定形式だけを判定する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function explicitDockerAbsence(
  command: DockerAuthenticationCommand,
  result: DockerAuthenticationExecution,
) {
  const normalizedStdout = result.stdout.trim();
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 1 ||
    (normalizedStdout.length !== 0 && normalizedStdout !== "[]")
  )
    return false;
  const resourceName = command.argv.at(-1);
  if (!resourceName) return false;
  const exactName = escapeRegularExpression(resourceName);
  const normalized = result.stderr.trim();
  if (command.purpose.includes("network"))
    return new RegExp(
      `^(?:Error response from daemon: )?(?:network ${exactName} not found|No such network: ${exactName})$`,
      "u",
    ).test(normalized);
  return new RegExp(
    `^(?:(?:Error response from daemon|Error): )?No such (?:object|container): ${exactName}$`,
    "u",
  ).test(normalized);
}

/**
 * 固定認証資源を各操作の保存通知後に照合・回収する。
 * @responsibility 実IDと名前の不存在を分離し、保存不明・終了不明では次Effectを止める。
 * @trace ARCH-000010
 * @input plan: 固定操作列、run: 内部技術接続、resources: 確定資源列、signal/processConfirmed: 取消と技術終了、callbacks: 同期通知。
 * @returns 資源回収とProcess終了の個別結果。
 * @precondition 上位がHome排他と現在の回収対象を確認済み。
 * @postcondition 保存やHome解放を技術成功へ補完しない。
 * @effect 固定inspect/remove/absenceをDIで逐次実行する。
 * @failure 所有不一致・保存拒否・終了不明・観測不能は未確認。
 * @invariant 明示取消と操作前後の必須通知を省略しない。
 * @boundary 固定認証Runtimeと上位保存通知。
 * @security 既知実IDと名前の双方を照合し生出力を返さない。
 * @concurrency 同じRuntimeで一操作ずつ完了し次へ進む。
 */
export async function cleanupDockerAuthenticationResources(
  plan: DockerAuthenticationPlan,
  run: (
    command: DockerAuthenticationCommand,
    live: () => boolean,
  ) => Promise<DockerAuthenticationExecution>,
  resources: DockerAuthenticationResources | null,
  signal: AbortSignal | undefined,
  processConfirmed: boolean,
  callbacks: DockerAuthenticationCleanupCallbacks,
): Promise<AuthenticationCleanupResult> {
  const captured = captureAuthenticationResources(plan.resources, resources);
  if (!captured || !processConfirmed)
    return Object.freeze({
      confirmed: false,
      processCompletionConfirmed: processConfirmed,
    });
  const select = (index: number) => {
    const receipt = captured[index],
      absence = plan.absenceCommands[index];
    if (!receipt || !absence) return null;
    return receipt.dockerId === null
      ? {
          ownershipCommand: absence,
          cleanupCommand: null,
          absenceCommand: absence,
          identityAbsenceCommand: undefined,
        }
      : planDockerAuthenticationResourceRecovery(
          plan,
          receipt.name,
          receipt.dockerId,
        );
  };
  const isActive = () => !signal?.aborted;
  let cleanupConfirmed = true,
    processCompletionConfirmed = true,
    recordingConfirmed = true;
  /**
   * 一つの回収操作の通知・終了観測を結合する。
   * @responsibility 終了不明後にidle通知や次処置を発行しない。
   * @trace ARCH-000010
   * @input command: 同じPlanの固定操作。
   * @returns 同じProcessの終了観測。
   * @precondition 呼出し元の許可と元Process終了を確認済み。
   * @postcondition 保存・終了不明は呼出し内でstickyに保持する。
   * @effect 操作前後通知と固定DI一要求。
   * @failure 通知失敗、明示取消、終了不明は例外。
   * @invariant 次Effect前に必要通知が完了する。
   * @boundary 回収ループと同じ技術Runtime。
   * @security 任意Commandを上位から受け取らない。
   * @concurrency 直列実行で同じRecord相関を維持する。
   */
  async function execute(
    command: DockerAuthenticationCommand,
  ): Promise<DockerAuthenticationExecution> {
    if (!isActive() || !recordingConfirmed || !processCompletionConfirmed)
      throw Error("provider_authentication_cleanup_stopped");
    try {
      notifyAuthentication(callbacks.onCommandSubmitting, command.purpose);
    } catch {
      recordingConfirmed = false;
      throw Error("provider_authentication_cleanup_intent_unconfirmed");
    }
    let result: DockerAuthenticationExecution;
    try {
      result = await run(command, isActive);
    } catch {
      processCompletionConfirmed = false;
      throw Error("provider_authentication_process_completion_unconfirmed");
    }
    if (result.processCompletionConfirmed === false) {
      processCompletionConfirmed = false;
      throw Error("provider_authentication_process_completion_unconfirmed");
    }
    if (!isActive()) {
      recordingConfirmed = false;
      throw Error("provider_authentication_cleanup_permit_lost");
    }
    try {
      notifyAuthentication(callbacks.onCommandCompleted);
    } catch {
      recordingConfirmed = false;
      throw Error("provider_authentication_cleanup_settlement_unconfirmed");
    }
    return result;
  }
  for (let index = 0; index < plan.cleanupCommands.length; index += 1) {
    if (!isActive() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    const selected = select(index);
    if (!selected) {
      cleanupConfirmed = false;
      break;
    }
    const {
      ownershipCommand,
      cleanupCommand,
      absenceCommand,
      identityAbsenceCommand,
    } = selected;
    try {
      const ownership = await execute(ownershipCommand);
      const alreadyAbsent = explicitDockerAbsence(ownershipCommand, ownership);
      if (alreadyAbsent && !identityAbsenceCommand) continue;
      if (
        !alreadyAbsent &&
        (ownership.error ||
          ownership.signal !== null ||
          ownership.status !== 0 ||
          ownership.stderr.trim().length !== 0 ||
          ownership.stdout.trim() !== plan.ownershipLabel.split("=")[1])
      ) {
        cleanupConfirmed = false;
        continue;
      }
      if (!alreadyAbsent) {
        if (!cleanupCommand) {
          cleanupConfirmed = false;
          continue;
        }
        const removed = await execute(cleanupCommand);
        if (removed.error || removed.signal !== null || removed.status !== 0)
          cleanupConfirmed = false;
      }
    } catch {
      cleanupConfirmed = false;
    }
    if (!isActive() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    try {
      if (identityAbsenceCommand) {
        const identityResult = await execute(identityAbsenceCommand);
        if (!explicitDockerAbsence(identityAbsenceCommand, identityResult))
          cleanupConfirmed = false;
      }
      const result = await execute(absenceCommand);
      if (!explicitDockerAbsence(absenceCommand, result))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  return Object.freeze({
    confirmed:
      cleanupConfirmed &&
      recordingConfirmed &&
      processCompletionConfirmed &&
      isActive() &&
      processConfirmed,
    processCompletionConfirmed: processCompletionConfirmed && processConfirmed,
  });
}

function notifyAuthentication(
  notify: ((...args: never[]) => void) | undefined,
  argument?: unknown,
): void {
  if (!notify) return;
  if (types.isAsyncFunction(notify))
    throw Error("provider_authentication_notification_unconfirmed");
  const result: unknown = Reflect.apply(
    notify,
    undefined,
    argument === undefined ? [] : [argument],
  );
  if (result !== undefined) {
    if (types.isPromise(result))
      void Promise.prototype.then.call(
        result,
        () => undefined,
        () => undefined,
      );
    throw Error("provider_authentication_notification_unconfirmed");
  }
}
