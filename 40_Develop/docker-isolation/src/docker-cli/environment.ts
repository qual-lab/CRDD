/**
 * Docker専用の子Process環境を明示したオンメモリ設定から構築する。
 * @responsibility Host所在と固定環境Policyを分離する。
 * @trace ARCH-000008
 * @boundary 呼出し元の所在を信頼し、OSの独立した所在証明は行わない。
 */
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";

/** Hostの所在だけを保持する。Provider Home・一時領域ではない。 */
export type IsolationSettings = Readonly<{
  windowsDirectory: string;
  userHomeDirectory: string;
}>;

const NEUTRAL_NAMES = [
  "ALL_PROXY",
  "APPDATA",
  "COMSPEC",
  "GIT_ASKPASS",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_SSH",
  "GIT_SSH_COMMAND",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "LOCALAPPDATA",
  "LOGONSERVER",
  "NODE_EXTRA_CA_CERTS",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_V8_COVERAGE",
  "NO_PROXY",
  "PATH",
  "PATHEXT",
  "SSH_AGENT_PID",
  "SSH_AUTH_SOCK",
  "SYSTEMDRIVE",
  "TEMP",
  "TMP",
  "USERDOMAIN",
  "USERNAME",
  "USERPROFILE",
] as const;

/** 操作入口で二つの所在をコピーし、可変入力やgetterを実行中へ持ち越さない。 */
export function captureIsolationSettings(
  input: IsolationSettings,
): IsolationSettings {
  if (
    !input ||
    typeof input !== "object" ||
    types.isProxy(input) ||
    (Object.getPrototypeOf(input) !== Object.prototype &&
      Object.getPrototypeOf(input) !== null) ||
    Reflect.ownKeys(input).length !== 2
  )
    throw Error("isolation_settings_invalid");
  const values: string[] = [];
  for (const key of ["windowsDirectory", "userHomeDirectory"] as const) {
    const descriptor = Object.getOwnPropertyDescriptor(input, key);
    if (
      !descriptor ||
      !("value" in descriptor) ||
      typeof descriptor.value !== "string" ||
      !/^[a-z]:\\/iu.test(descriptor.value) ||
      descriptor.value.includes("\0")
    )
      throw Error("isolation_settings_invalid");
    const value = path.win32.normalize(descriptor.value);
    if (value === path.win32.parse(value).root)
      throw Error("isolation_settings_invalid");
    values.push(value);
  }
  const windowsDirectory = values[0],
    userHomeDirectory = values[1];
  if (!windowsDirectory || !userHomeDirectory)
    throw Error("isolation_settings_invalid");
  return Object.freeze({ windowsDirectory, userHomeDirectory });
}

/**
 * 呼出し元が確定したHost所在を検査し、コピーして凍結する。
 * @input windowsDirectory: Windows配置先、userHomeDirectory: HostユーザーHome。
 * @returns 非Windows、不正入力、実体確認不能はnull。
 * @effect Filesystem読取りのみ。環境変数・Native・Dockerを参照／起動しない。
 * @invariant グローバル登録、永続化、Provider Homeの推測は行わない。
 * @security NodeのPath・Link確認はSID／DACL・Native所在証明と同等ではない。
 */
export function initializeIsolation(
  input: IsolationSettings,
): IsolationSettings | null {
  try {
    if (process.platform !== "win32") return null;
    const settings = captureIsolationSettings(input);
    for (const value of [
      settings.windowsDirectory,
      settings.userHomeDirectory,
    ]) {
      const info = fs.lstatSync(value);
      if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        fs.realpathSync.native(value).toLowerCase() !== value.toLowerCase()
      )
        return null;
    }
    const { windowsDirectory, userHomeDirectory } = settings;
    const kernel = path.win32.join(
      windowsDirectory,
      "System32",
      "kernel32.dll",
    );
    const info = fs.lstatSync(kernel);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      fs.realpathSync.native(kernel).toLowerCase() !== kernel.toLowerCase()
    )
      return null;
    return Object.freeze({ windowsDirectory, userHomeDirectory });
  } catch {
    return null;
  }
}

/** Docker CLI用の固定環境。親環境を継承せず、個別管理領域だけ追加する。 */
export function createDockerCliEnvironment(
  settings: IsolationSettings,
  options: Readonly<{ dockerConfig: string | null; dockerHome: string | null }>,
): Readonly<Record<string, string>> | null {
  settings = captureIsolationSettings(settings);
  const { dockerConfig, dockerHome } = options;
  if (
    (dockerConfig === null) !== (dockerHome === null) ||
    [dockerConfig, dockerHome].some(
      (value) =>
        value !== null &&
        (!path.win32.isAbsolute(value) || value.includes("\0")),
    )
  )
    return null;
  const result: Record<string, string> = Object.create(null);
  for (const name of NEUTRAL_NAMES) result[name] = "";
  result.SystemRoot = settings.windowsDirectory;
  result.WINDIR = settings.windowsDirectory;
  result.DOCKER_CLI_HINTS = "false";
  if (dockerConfig !== null && dockerHome !== null) {
    result.DOCKER_CONFIG = dockerConfig;
    result.HOME = dockerHome;
    result.USERPROFILE = dockerHome;
  }
  return Object.freeze(result);
}

/** 固定WSL観測・停止に使用するHost HomeとDriveを投影する。 */
export function createDockerDesktopRepairHelperEnvironment(
  settings: IsolationSettings,
): Readonly<Record<string, string>> {
  return Object.freeze({
    ...createDockerProcessEnvironment(settings),
    USERPROFILE: settings.userHomeDirectory,
    SYSTEMDRIVE: settings.windowsDirectory.slice(0, 2),
  });
}

/** 個別管理領域を持たないDocker Process用環境。 */
export function createDockerProcessEnvironment(
  settings: IsolationSettings,
): Readonly<Record<string, string>> {
  const environment = createDockerCliEnvironment(settings, {
    dockerConfig: null,
    dockerHome: null,
  });
  if (!environment) throw new Error("docker_effect_environment_unavailable");
  return environment;
}

/** 署名検査用の固定五項目だけを投影する。親PATH・Proxy等は継承しない。 */
export function createWindowsPowerShellAuthenticodeEnvironment(
  settings: IsolationSettings,
): Readonly<Record<string, string>> {
  settings = captureIsolationSettings(settings);
  const windowsDirectory = settings.windowsDirectory;
  const system32 = path.win32.join(windowsDirectory, "System32");
  return Object.freeze({
    SystemRoot: windowsDirectory,
    WINDIR: windowsDirectory,
    USERPROFILE: settings.userHomeDirectory,
    PATH: [
      system32,
      windowsDirectory,
      path.win32.join(system32, "WindowsPowerShell", "v1.0"),
    ].join(";"),
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
  });
}
