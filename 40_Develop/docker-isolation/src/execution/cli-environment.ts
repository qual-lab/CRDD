/**
 * Docker用途に限定したHost子Process環境を構成する。
 *
 * @packageDocumentation
 * @responsibility 共通OS観測とDocker固有の固定設定を分離し、任意環境入力を拒否する。
 * @trace ARCH-000008
 * @boundary Platform Accessの用途固定環境→Docker CLI／Desktop明示修復。実行許可は発行しない。
 */
import path from "node:path";
import {
  createInteractiveConsoleReaderEnvironment,
  createWindowsNativeHelperEnvironment,
  deriveWindowsSystemDrive,
} from "../../../platform-access/src/index.ts";

/**
 * Windows Docker Cli Environmentを構築する。
 *
 * @responsibility Windows Docker Cli Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input options: Readonly<{ dockerConfig: string | null; dockerHome: string | null; }>
 * @returns createDockerCliEnvironmentの計算結果を返す。
 * @precondition 「options: Readonly<{ dockerConfig: string | null; dockerHome: string | null; }>」がcreateDockerCliEnvironmentの入力契約を満たす。
 * @postcondition createDockerCliEnvironmentの責務を完了した結果だけを返す。
 * @effect 共通OS環境の固定Native／Filesystem読取り。Docker要求は発行しない。
 * @failure config／Homeの組合せ、絶対Path、NULまたは共通OS観測の不成立はnull。
 * @invariant createDockerCliEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Platform Accessの用途固定環境→Docker専用固定key構成。
 * @security 親ambient値や任意keyを追加せず、環境候補を実行許可へ昇格しない。
 * @concurrency N/A: createDockerCliEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createDockerCliEnvironment(
  options: Readonly<{
    dockerConfig: string | null;
    dockerHome: string | null;
  }>,
): Readonly<Record<string, string>> | null {
  const { dockerConfig, dockerHome } = options;
  if (
    (dockerConfig === null) !== (dockerHome === null) ||
    (dockerConfig !== null &&
      (!path.win32.isAbsolute(dockerConfig) || dockerConfig.includes("\0"))) ||
    (dockerHome !== null &&
      (!path.win32.isAbsolute(dockerHome) || dockerHome.includes("\0")))
  ) {
    return null;
  }
  const environment = createInteractiveConsoleReaderEnvironment("win32");
  if (!environment) return null;
  const result: Record<string, string> = Object.assign(
    Object.create(null),
    environment,
    {
      DOCKER_CLI_HINTS: "false",
      ...(dockerConfig === null || dockerHome === null
        ? {}
        : {
            DOCKER_CONFIG: dockerConfig,
            HOME: dockerHome,
            USERPROFILE: dockerHome,
          }),
    },
  );
  return Object.freeze(result);
}

/**
 * Windows Docker Desktop Repair Helper Environmentを構築する。
 *
 * @responsibility Windows Docker Desktop Repair Helper Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns Readonly< Record<string, string> > | nullを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateDockerDesktopRepairHelperEnvironmentの入力契約を満たす。
 * @postcondition createDockerDesktopRepairHelperEnvironmentの責務を完了した結果だけを返す。
 * @effect 共通OS環境の固定Native／OS情報／Filesystem読取り。修復処置は発行しない。
 * @failure 一般Native環境またはローカルDriveが取得不能ならnull。
 * @invariant createDockerDesktopRepairHelperEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Platform Accessの一般Native環境→Desktop修復専用Drive付与。
 * @security 一般Native環境を変更せず、Drive候補を修復許可にしない。
 * @concurrency N/A: createDockerDesktopRepairHelperEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createDockerDesktopRepairHelperEnvironment(): Readonly<
  Record<string, string>
> | null {
  const environment = createWindowsNativeHelperEnvironment();
  if (!environment) return null;
  const systemDrive = deriveWindowsSystemDrive(environment.SystemRoot);
  if (!systemDrive) return null;
  return Object.freeze({ ...environment, SYSTEMDRIVE: systemDrive });
}

/**
 * Docker Process Environmentを構築する。
 *
 * @responsibility Docker Process Environmentの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns createDockerProcessEnvironmentの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateDockerProcessEnvironmentの入力契約を満たす。
 * @postcondition createDockerProcessEnvironmentの責務を完了した結果だけを返す。
 * @effect 共通OS環境の固定Native／Filesystem読取り。Docker Processの起動は行わない。
 * @failure createDockerProcessEnvironmentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createDockerProcessEnvironmentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createDockerProcessEnvironmentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createDockerProcessEnvironmentは共有非同期状態を持たない同期処理である。
 */
export function createDockerProcessEnvironment() {
  const environment = createDockerCliEnvironment({
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment) throw new Error("docker_effect_environment_unavailable");
  return environment;
}
