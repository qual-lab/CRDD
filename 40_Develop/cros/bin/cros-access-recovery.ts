/**
 * CROS Credential Access RecoveryのHost対話CLI Entry Point。
 *
 * @packageDocumentation
 * @responsibility CLI引数とOS Known Folderを検証済みApplication入力へ変換し、exact Recovery ID確認をTerminalで行う。
 * @trace ARCH-000013
 * @boundary Host Terminal／Process EnvironmentとCROS Recovery Applicationの境界。
 * @effect 人間確認後に限りOS管理CROS Runtime RootのRecovery EventとCredential Registryを更新する。
 * @security Bearer TokenやRemote Credentialを入力に要求せず、新管理Tokenを成功時に一度だけ表示する。
 */

import { createInterface } from "node:readline/promises";

import type { CrosRootInput } from "../../runtime-data/src/index.ts";
import {
  runCredentialAccessRecoveryCli,
  type CredentialAccessRecoveryCliIo,
} from "../src/credential-access-recovery-cli.ts";
import type {
  CredentialAccessRecoveryMode,
  CredentialAccessRecoveryPlan,
} from "../src/credential-access-recovery.ts";

const mode = parseMode(process.argv.slice(2));
const rootInput = resolveRootInput(process.env);
if (!mode || !rootInput) {
  process.stderr.write(
    `${JSON.stringify({ status: "blocked", reason: "credential_access_recovery_cli_input_invalid" })}\n`,
  );
  process.exitCode = 64;
} else {
  process.exitCode = await runCredentialAccessRecoveryCli(
    rootInput,
    mode,
    createTerminalIo(),
  );
}

/**
 * CLI引数からRecovery modeを検証する。
 *
 * @responsibility 二つの許可mode以外をApplicationへ渡さない。
 * @trace ARCH-000013
 * @input Process argument配列。
 * @returns 許可modeまたはnull。
 * @precondition argsを信頼しない。
 * @postcondition 不明flagや値を拒否する。
 * @effect N/A: 配列を読むだけである。
 * @failure 不正入力はnullで返す。
 * @invariant mode以外の動作切替を持たない。
 * @boundary Process argvとRecovery Applicationの境界。
 * @security Remote AuthorityやTokenを引数から受理しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function parseMode(
  args: readonly string[],
): CredentialAccessRecoveryMode | null {
  if (args.length !== 2 || args[0] !== "--mode") return null;
  if (args[1] === "administrator-recovery") return "administrator_recovery";
  if (args[1] === "full-access-reset") return "full_access_reset";
  return null;
}

/**
 * Process EnvironmentからCROS Runtime Root入力を構成する。
 *
 * @responsibility OS Known Folderと明示Trust DomainだけをRoot Resolverへ渡す。
 * @trace ARCH-000013
 * @input Process environment key/value集合。
 * @returns CrosRootInputまたはnull。
 * @precondition CROS_TRUST_DOMAIN_IDを明示し、OS Known Folderを環境から取得できる。
 * @postcondition caller supplied absolute output Pathを受理しない。
 * @effect N/A: Environmentを読むだけである。
 * @failure 不足値または未対応Platformをnullで返す。
 * @invariant publisher=qual-lab、application=crosを固定する。
 * @boundary Process EnvironmentとRuntime Data Resolverの境界。
 * @security Secret環境変数を読取らない。
 * @concurrency N/A: Process開始時の値だけを使う。
 */
function resolveRootInput(
  environment: NodeJS.ProcessEnv,
): CrosRootInput | null {
  const trustDomainId = environment.CROS_TRUST_DOMAIN_ID;
  if (!trustDomainId) return null;
  if (process.platform === "win32") {
    if (!environment.LOCALAPPDATA) return null;
    return Object.freeze({
      platform: "win32",
      trustDomainId,
      publisher: "qual-lab",
      application: "cros",
      localAppData: environment.LOCALAPPDATA,
    });
  }
  if (process.platform === "linux") {
    if (!environment.HOME) return null;
    return Object.freeze({
      platform: "linux",
      trustDomainId,
      publisher: "qual-lab",
      application: "cros",
      homeDirectory: environment.HOME,
      ...(environment.XDG_CONFIG_HOME
        ? { xdgConfigHome: environment.XDG_CONFIG_HOME }
        : {}),
      ...(environment.XDG_STATE_HOME
        ? { xdgStateHome: environment.XDG_STATE_HOME }
        : {}),
      ...(environment.XDG_RUNTIME_DIR
        ? { xdgRuntimeDirectory: environment.XDG_RUNTIME_DIR }
        : {}),
    });
  }
  return null;
}

/**
 * Host Terminal用Recovery I/O Adapterを作成する。
 *
 * @responsibility JSON line出力とexact Recovery ID入力をApplication Portへ実装する。
 * @trace ARCH-000013
 * @input N/A: Process stdin／stdoutを使用するAdapterを生成する。
 * @returns CredentialAccessRecoveryCliIo。
 * @precondition 対話可能なHost Terminalから実行する。
 * @postcondition confirm完了後にreadline Handleを閉じる。
 * @effect stdoutへ計画／結果を表示し、stdinから一行を読む。
 * @failure 入力不一致をfalseとして返す。
 * @invariant 表示したRecovery IDとの完全一致だけを確認とする。
 * @boundary Host TerminalとRecovery CLI Applicationの境界。
 * @security 入力echoを抑制するSecret promptではなく、非秘密Recovery IDを要求する。
 * @concurrency 一回のCLI実行で一つの質問だけを直列処理する。
 */
function createTerminalIo(): CredentialAccessRecoveryCliIo {
  return Object.freeze({
    write: (value: unknown) =>
      process.stdout.write(`${JSON.stringify(value)}\n`),
    confirm: async (plan: CredentialAccessRecoveryPlan) => {
      const terminal = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      try {
        const answer = await terminal.question(
          `CROS Serverが停止済みで、上記対象だけを処置する場合はRecovery IDを入力してください:\n${plan.recoveryId}\n> `,
        );
        return answer.trim() === plan.recoveryId;
      } finally {
        terminal.close();
      }
    },
  });
}
