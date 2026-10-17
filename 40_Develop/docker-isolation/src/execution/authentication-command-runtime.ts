/**
 * 生成済み認証操作を固定Docker Engineと共通Process Ownerで実行する。
 * @responsibility 上位の許可生存を観測し、対話非捕捉・上限・tree終端を技術結果として返す。
 * @trace ARCH-000008
 */
import {
  dockerAuthenticationCommandBelongsToPlan,
  dockerAuthenticationPlanIsPlanned,
  dockerAuthenticationRecoveryCommandMetadata,
  type DockerAuthenticationCommand,
  type DockerAuthenticationPlan,
} from "./authentication-command-plan.ts";
import fs from "node:fs";
import path from "node:path";
import { captureDockerProcessEnvironment } from "./process-environment.ts";
import { createDockerProcessEnvironment } from "./cli-environment.ts";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./cli-trust.ts";
import { startOwnedWindowsProcess } from "./owned-windows-process.ts";
import { dockerAuthenticationResourceConfigurationMatches } from "../cleanup/resource-configuration.ts";

/**
 * 認証操作のProcess終了観測。
 * @responsibility 一次失敗とProcess終了確認を別fieldで保持する。
 * @trace ARCH-000008
 * @shape Status、Signal、限定出力、固定errorと終了確認。
 * @invariant errorや終了要求だけで終了確認を肯定しない。
 * @boundary 下位Processと上位認証Lifecycle。
 * @security 認証意味・Recovery Authority・秘密値を公開結果へ生成しない。
 * @compatibility 上位の既存実行結果へ技術終了確認を追加する。
 */
export type DockerAuthenticationExecution = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
  processCompletionConfirmed: boolean;
  resourceCreationConfirmed?: boolean;
  resourceConfigurationConfirmed?: boolean;
  resourceReceipt?: Readonly<{ name: string; dockerId: string }>;
}>;

/**
 * 元計画のCommandだけを許可生存中に実行する。
 * @responsibility 固定Engineと元Commandを結合し、終了不明を上位へ返す。
 * @trace ARCH-000008
 * @input binding: fresh CLI／環境と固定cwd。command: 元Command。permitLive: 上位許可の同期生存観測。
 * @returns 一次失敗と元子／補助子の終了観測。
 * @precondition 上位がHome許可・対話端末・Recovery Intentを確認済み。
 * @postcondition 終了不明を成功や次操作の許可にしない。
 * @effect 固定Docker CLIを開始し、取消／期限／許可喪失時にtree終端する。
 * @failure 元Command欠落、環境／CLI不明は開始前拒否。終端不明は別fieldで返す。
 * @invariant 新State、Lock、認証／回復管理を作らない。
 * @boundary Docker CLIと上位許可生存。
 * @security 対話はinheritで捕捉0、非対話は最大1MiB、shell=false。
 * @concurrency 監視・期限・Process結果を単一呼出しへ収束しTimerを回収する。
 */
async function executeDockerAuthenticationCommand(
  binding: Readonly<{
    verifyCli: () => string;
    environment: () => Readonly<Record<string, string>>;
    workingDirectory: string;
  }>,
  command: DockerAuthenticationCommand,
  permitLive: () => boolean,
  plan: DockerAuthenticationPlan,
): Promise<DockerAuthenticationExecution> {
  if (!dockerAuthenticationCommandBelongsToPlan(command, plan))
    throw Error("docker_authentication_command_not_planned");
  const permits = () => {
    try {
      return permitLive() === true;
    } catch {
      return false;
    }
  };
  const empty = { status: null, signal: null, stdout: "", stderr: "" } as const;
  if (!permits())
    return Object.freeze({
      ...empty,
      error: Error("docker_execution_permit_lost"),
      processCompletionConfirmed: true,
    });
  const environment = captureDockerProcessEnvironment(binding.environment());
  const executable = binding.verifyCli();
  if (!permits())
    return Object.freeze({
      ...empty,
      error: Error("docker_execution_permit_lost"),
      processCompletionConfirmed: true,
    });
  const handle = startOwnedWindowsProcess(
    executable,
    ["-H", "npipe:////./pipe/dockerDesktopLinuxEngine", ...command.argv],
    environment,
    null,
    {
      interactive: command.interactive,
      workingDirectory: binding.workingDirectory,
      stderrLimitBytes: 1_048_576,
    },
  );
  let terminalError: Error | undefined;
  let signalStop: () => void = () => undefined;
  const stopped = new Promise<null>((resolve) => {
    signalStop = () => resolve(null);
  });
  const stop = (reason: string) => {
    terminalError ??= Error(reason);
    signalStop();
  };
  const monitor = setInterval(() => {
    if (!permits()) stop("docker_execution_permit_lost");
  }, 250);
  const deadline = command.interactive
    ? null
    : setTimeout(() => stop("docker_effect_timeout"), 30_000);
  try {
    const result = await Promise.race([handle.wait(2_147_483_647), stopped]);
    if (result?.outputExceeded)
      terminalError ??= Error("docker_effect_output_too_large");
    if (result?.status === null && !terminalError)
      terminalError = Error("docker_effect_execution_failed");
    const closed = handle.closed() || (await handle.terminateAndWait(5_000));
    const observed = result ?? (closed ? await handle.wait(1) : null);
    const recovery = dockerAuthenticationRecoveryCommandMetadata(command);
    const sourceCommand = recovery?.create ?? command;
    if (
      (command.purpose.startsWith("create_") || recovery?.role === "observe") &&
      closed &&
      observed?.status === 0 &&
      !terminalError &&
      observed.signal === null &&
      observed.stderr.trim() === ""
    ) {
      const dockerId = recovery?.dockerId ?? observed.stdout.trim();
      const observationCommand = recovery
        ? command
        : plan.creationObservationCommands.find(
            (item) =>
              item.purpose ===
              command.purpose.replace("create_", "inspect_created_"),
          );
      let observation: DockerAuthenticationExecution | null = null;
      let configuration: unknown = null;
      let imageMetadata: Record<string, unknown> | null = null;
      if (recovery) {
        observation = Object.freeze({
          ...observed,
          processCompletionConfirmed: closed,
        });
        try {
          const values: unknown = JSON.parse(observed.stdout);
          if (Array.isArray(values) && values.length === 1)
            configuration = values[0];
        } catch {
          configuration = null;
        }
      }
      if (
        !recovery &&
        /^[a-f0-9]{64}$/u.test(dockerId) &&
        observationCommand &&
        permits()
      ) {
        observation = await executeDockerAuthenticationCommand(
          binding,
          observationCommand,
          permitLive,
          plan,
        );
        if (
          observation.processCompletionConfirmed &&
          observation.status === 0 &&
          !observation.error &&
          observation.signal === null &&
          observation.stderr.trim() === ""
        ) {
          try {
            const values: unknown = JSON.parse(observation.stdout);
            if (Array.isArray(values) && values.length === 1)
              configuration = values[0];
          } catch {
            configuration = null;
          }
        }
      }
      const imageCommand = plan.creationImageCommands.find(
        (item) =>
          item.purpose ===
          sourceCommand.purpose.replace("create_", "inspect_image_"),
      );
      if (imageCommand && configuration && permits()) {
        const imageObservation = await executeDockerAuthenticationCommand(
          binding,
          imageCommand,
          permitLive,
          plan,
        );
        if (!imageObservation.processCompletionConfirmed)
          return Object.freeze({
            ...observed,
            error: Error("docker_authentication_creation_unconfirmed"),
            resourceCreationConfirmed: false,
            processCompletionConfirmed: false,
          });
        if (
          imageObservation.status === 0 &&
          !imageObservation.error &&
          imageObservation.signal === null &&
          imageObservation.stderr.trim() === ""
        ) {
          try {
            const images: unknown = JSON.parse(imageObservation.stdout);
            if (
              Array.isArray(images) &&
              images.length === 1 &&
              images[0]?.Id === imageCommand.argv.at(-1) &&
              images[0]?.Config &&
              typeof images[0].Config === "object"
            )
              imageMetadata = images[0].Config;
          } catch {
            imageMetadata = null;
          }
        }
      }
      const confirmed =
        !terminalError &&
        permits() &&
        dockerAuthenticationResourceConfigurationMatches(
          configuration,
          sourceCommand,
          dockerId,
          false,
          imageMetadata,
        );
      const recoveryConfirmed =
        confirmed ||
        (recovery?.role === "observe" &&
          sourceCommand.purpose === "create_proxy" &&
          !terminalError &&
          permits() &&
          dockerAuthenticationResourceConfigurationMatches(
            configuration,
            sourceCommand,
            dockerId,
            true,
            imageMetadata,
          ));
      if (recovery)
        return Object.freeze({
          ...observed,
          processCompletionConfirmed:
            observation?.processCompletionConfirmed ?? closed,
          resourceConfigurationConfirmed: recoveryConfirmed,
          ...(!recoveryConfirmed
            ? {
                error:
                  terminalError ??
                  observation?.error ??
                  Error("docker_authentication_configuration_unconfirmed"),
              }
            : {}),
        });
      return Object.freeze({
        ...observed,
        processCompletionConfirmed:
          observation?.processCompletionConfirmed ?? closed,
        resourceCreationConfirmed: confirmed,
        ...(confirmed && observationCommand
          ? {
              resourceReceipt: Object.freeze({
                name: observationCommand.argv.at(-1) as string,
                dockerId,
              }),
            }
          : { error: Error("docker_authentication_creation_unconfirmed") }),
      });
    }
    return Object.freeze({
      ...(observed ?? empty),
      ...(terminalError ? { error: terminalError } : {}),
      processCompletionConfirmed: closed,
      ...(command.purpose.startsWith("create_")
        ? { resourceCreationConfirmed: false }
        : {}),
    });
  } finally {
    clearInterval(monitor);
    if (deadline) clearTimeout(deadline);
  }
}

/**
 * 一つの元認証技術計画に実行入口を結合する。
 * @responsibility 別計画の操作を同じRuntimeへ受け入れない。
 * @trace ARCH-000008
 * @input binding: fresh CLIと最小環境。plan: 元技術計画。
 * @returns 同じ計画だけを実行する入口。
 * @precondition Home許可と回復Intentは上位が所有する。
 * @postcondition 生成だけではProcessを開始しない。
 * @effect N/A: 局所結合のみ。
 * @failure Planコピー・不正値は拒否する。
 * @invariant 新Registry・Lock・永続Stateを作らない。
 * @boundary 元Planと固定実行入口。
 * @security 任意argvを受け取らない。
 * @concurrency 同じ元Planへclosureで結合する。
 */
export function createDockerAuthenticationRuntimeUsing(
  binding: Parameters<typeof executeDockerAuthenticationCommand>[0],
  plan: DockerAuthenticationPlan,
) {
  if (!dockerAuthenticationPlanIsPlanned(plan))
    throw Error("docker_authentication_plan_not_planned");
  const approvedRemovals = new WeakSet<object>();
  return Object.freeze({
    execute: async (
      command: DockerAuthenticationCommand,
      permitLive: () => boolean,
    ) => {
      const metadata = dockerAuthenticationRecoveryCommandMetadata(command);
      if (
        command.purpose.startsWith("remove_") &&
        (metadata?.role !== "remove" || !approvedRemovals.has(command))
      )
        throw Error("docker_authentication_removal_not_observed");
      if (metadata?.role === "remove") approvedRemovals.delete(command);
      const result = await executeDockerAuthenticationCommand(
        binding,
        command,
        permitLive,
        plan,
      );
      if (
        metadata?.role === "observe" &&
        result.resourceConfigurationConfirmed === true &&
        result.processCompletionConfirmed
      )
        approvedRemovals.add(metadata.removal);
      return result;
    },
  });
}

/**
 * 認証操作へ固定CLIと最小環境を結合するFactoryを生成する。
 * @responsibility 上位にOS・実行物・cwdの選択を要求しない本番構成を所有する。
 * @trace ARCH-000008
 * @input N/A: 固定の現在実行環境を観測する。
 * @returns 元技術計画から認証Runtimeを生成する同期関数。
 * @precondition 対応環境のCLIとSystemRootを観測できる。
 * @postcondition 同Factoryの全Runtimeが元snapshotを各実行直前に再検証する。
 * @effect 構築時にCLI・環境と固定cwdを読み取る。Processは開始しない。
 * @failure CLI・環境不明は元例外、cwd不明は固定理由で停止する。
 * @invariant 元snapshotを再取得せず、上位の保存・許可・認証意味を所有しない。
 * @boundary 上位の認証構成とDocker技術実行。
 * @security 任意Runner・環境・実行Pathを受け取らない。
 * @concurrency 各Runtimeの終了・回収・一回の削除確認は既存の所有者を維持する。
 */
export function createDockerAuthenticationRuntimeFactory() {
  const dockerCli = observeTrustedDockerCli();
  const environment = createDockerProcessEnvironment();
  const systemRoot = environment.SystemRoot;
  if (!systemRoot)
    throw new Error("docker_effect_working_directory_unavailable");
  const workingDirectory = path.win32.join(systemRoot, "System32");
  if (!fs.statSync(workingDirectory).isDirectory())
    throw new Error("docker_effect_working_directory_unavailable");
  return (plan: DockerAuthenticationPlan) =>
    createDockerAuthenticationRuntimeUsing(
      {
        verifyCli: () => verifyTrustedDockerCliSnapshot(dockerCli),
        environment: () => environment,
        workingDirectory,
      },
      plan,
    );
}
