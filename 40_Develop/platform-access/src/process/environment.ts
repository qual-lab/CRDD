/**
 * OS差とProfile条件を吸収する共通子Process環境を導出する。
 *
 * @responsibility OS由来の所在を検証し、親ambient環境を採用せず共通の中立環境を構成する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { observeSystemWindowsDirectory } from "../filesystem/system-directory.ts";

export const WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE =
  "native_system_windows_directory_and_os_user_info_validated_profile_path_with_other_ambient_names_fixed_neutral_parent_environment_not_authority";

// Windows may populate these names even when Node receives an empty env map.
// Keep the names present with fixed neutral values so the child cannot observe
// ambient user, path, proxy, credential-helper, or Node injection state.
const NEUTRAL_NAMES = Object.freeze([
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
] as const);

/**
 * OS由来Directoryと内部の用途固定値から中立環境を構成する。
 *
 * @responsibility 親環境を継承せず、Directoryを固定して検証済み内部値だけを追加する。
 * @trace ARCH-000008
 * @input additions: このModule内部が構成した用途固定の文字列map。任意入力用APIではない。
 * @returns 凍結したnull-prototype環境、またはnull。
 * @precondition Windowsで固定NativeによるDirectory観測が成立する。
 * @postcondition SystemRoot／WINDIRを観測値へ結び、危険なambient名は中立値へ固定する。
 * @effect 固定Native観測とFilesystem読取り。作成・変更・Docker要求は行わない。
 * @failure 非Windows、Directory不能、名前・NUL・固定値との衝突はnull。
 * @invariant 不成立時に親環境へfallbackしない。
 * @boundary 固定OS観測→内部の用途限定環境構成。
 * @security 任意additions builderとして公開せず、値の取得を実行Authorityへ昇格しない。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
function fixedWindowsEnvironment(additions: Readonly<Record<string, string>>) {
  if (process.platform !== "win32") return null;
  const windowsDirectory = observedWindowsDirectoryFromNative();
  if (!windowsDirectory) return null;
  const environment: Record<string, string> = Object.create(null);
  for (const name of NEUTRAL_NAMES) environment[name] = "";
  environment.SystemRoot = windowsDirectory;
  environment.WINDIR = windowsDirectory;
  for (const [name, value] of Object.entries(additions)) {
    const matchingName = Object.keys(environment).find(
      (existing) =>
        existing.toLocaleLowerCase("en-US") === name.toLocaleLowerCase("en-US"),
    );
    if (
      name.length === 0 ||
      name.includes("=") ||
      name.includes("\0") ||
      value.includes("\0") ||
      (matchingName !== undefined && environment[matchingName] !== "")
    ) {
      return null;
    }
    if (matchingName && matchingName !== name) delete environment[matchingName];
    environment[name] = value;
  }
  return Object.freeze(environment);
}

/**
 * Native取得DirectoryとSystem32／kernel32の実体を読み取り確認する。
 *
 * @responsibility 環境変数ではなくOS由来の所在を使い、alias・型不正を拒否する。
 * @trace ARCH-000008
 * @input N/A: 固定Nativeと現在OSを観測する。
 * @returns 検証済みDirectory文字列、またはnull。
 * @precondition 固定Native成果物の同一性とDirectory取得が成立する。
 * @postcondition Directory・System32・kernel32の型、非linkとcanonical所在を確認した値だけを返す。
 * @effect 固定Native ProcessとFilesystem metadata／realpathの読取り。
 * @failure 取得不能、型・link・canonical不一致、例外はnull。
 * @invariant 親SystemRoot／WINDIRから所在を補完しない。
 * @boundary Native Directory観測→Filesystem確認。
 * @security 所在確認だけでRoot利用・Process実行の許可を発行しない。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
function observedWindowsDirectoryFromNative() {
  try {
    const directory = observeSystemWindowsDirectory();
    if (!directory) return null;
    const kernel32 = path.win32.join(directory, "System32", "kernel32.dll");
    const system32 = path.win32.dirname(kernel32);
    const windowsDirectory = path.win32.dirname(system32);
    const rootMetadata = fs.lstatSync(windowsDirectory);
    const system32Metadata = fs.lstatSync(system32);
    const kernelMetadata = fs.lstatSync(kernel32);
    if (
      !rootMetadata.isDirectory() ||
      rootMetadata.isSymbolicLink() ||
      !system32Metadata.isDirectory() ||
      system32Metadata.isSymbolicLink() ||
      !kernelMetadata.isFile() ||
      kernelMetadata.isSymbolicLink() ||
      fs.realpathSync.native(windowsDirectory).toLocaleLowerCase("en-US") !==
        windowsDirectory.toLocaleLowerCase("en-US") ||
      fs.realpathSync.native(kernel32).toLocaleLowerCase("en-US") !==
        kernel32.toLocaleLowerCase("en-US")
    ) {
      return null;
    }
    return windowsDirectory;
  } catch {
    return null;
  }
}

/**
 * OS由来の利用者Profile所在を読み取り確認する。
 *
 * @responsibility USERPROFILE環境変数を根拠にせず、通常Directoryとcanonical所在を確認する。
 * @trace ARCH-000008
 * @input N/A: os.userInfoとFilesystemを読み取る。
 * @returns 検証済みProfile所在、またはnull。
 * @precondition 現在OSから利用者Profile候補を取得できる。
 * @postcondition 絶対Path・非Root・非NUL・通常Directory・非link・canonical一致だけを返す。
 * @effect OS利用者情報とFilesystem metadata／realpathの読取り。
 * @failure 取得例外または所在・型・Identity条件の不成立はnull。
 * @invariant 親USERPROFILEへfallbackしない。
 * @boundary OS利用者情報→Profile所在候補の確認。
 * @security 所在候補を書込み・初期化Authorityとして扱わない。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
function observedWindowsUserProfileFromOs() {
  try {
    const candidate = path.win32.normalize(os.userInfo().homedir);
    if (
      !path.win32.isAbsolute(candidate) ||
      candidate.includes("\0") ||
      path.win32.parse(candidate).root === candidate
    ) {
      return null;
    }
    const metadata = fs.lstatSync(candidate);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(candidate).toLocaleLowerCase("en-US") !==
        candidate.toLocaleLowerCase("en-US")
    ) {
      return null;
    }
    return candidate;
  } catch {
    return null;
  }
}

/**
 * Node子Processへ渡す環境を、実OS差と検証済みProfileの要否だけで構成する。
 * @responsibility 同値の用途別入口を持たず、任意環境・任意Profileを受け付けない。
 * @trace ARCH-000008
 * @input options: 選択するPlatformと、OS由来USERPROFILEの付与要否。
 * @returns 凍結した環境。Windowsの所在取得不能はnull。
 * @precondition 呼出しOwnerが必要なOSとProfileの差分を選択する。
 * @postcondition Windows固定は取得不能時にnull、他OSの既定は空環境。
 * @effect Windowsでは既存のNative所在・Filesystem読取りのみ。
 * @failure Windows固定選択を非Windowsの空環境へfallbackしない。
 * @invariant 親環境の中立化・Profile検査・返却値は従来どおり。
 * @boundary Nodeのspawn環境と既存OS所在観測。
 * @security 任意環境・Profile値と実行Authorityを入力・返却しない。
 * @concurrency 同期の値構築。Processの起動・終了は利用Ownerが管理する。
 */
export function createChildProcessEnvironment(
  options: Readonly<{ platform?: NodeJS.Platform; userProfile?: boolean }> = {},
): Readonly<Record<string, string>> | null {
  const platform = options.platform ?? process.platform;
  if (platform !== "win32")
    return options.userProfile ? null : Object.freeze({});
  if (!options.userProfile) return fixedWindowsEnvironment(Object.freeze({}));
  if (process.platform !== "win32") return null;
  const userProfile = observedWindowsUserProfileFromOs();
  return userProfile
    ? fixedWindowsEnvironment(Object.freeze({ USERPROFILE: userProfile }))
    : null;
}

// Pure path validation; callers must obtain the directory from the OS observer.
// This does not turn a caller-supplied path into an execution capability.
/**
 * 正規のローカルWindows Directory文字列からDriveを導出する。
 *
 * @responsibility 曖昧所在やUNCをDriveとして受理しない純粋検査を行う。
 * @trace ARCH-000008
 * @input windowsDirectory: 取得元を利用側が検証する所在候補。
 * @returns 元の大文字小文字を保つDriveとcolon、またはnull。
 * @precondition 入力値自体はAuthorityではない。
 * @postcondition ローカル絶対Path・非NUL・正規表記だけを受理する。
 * @effect N/A: 入力文字列だけを判定する。
 * @failure 型不正・非ローカル・NUL・非正規表記はnull。
 * @invariant Filesystem確認やOS取得を行ったと主張しない。
 * @boundary 所在候補文字列→Drive候補。
 * @security 任意文字列をOS由来の所在や実行Authorityへ昇格しない。
 * @concurrency N/A: 入力値に閉じる同期判定で共有状態を持たない。
 */
export function deriveWindowsSystemDrive(windowsDirectory: unknown) {
  if (
    typeof windowsDirectory !== "string" ||
    !/^[A-Za-z]:\\[^\\]/u.test(windowsDirectory) ||
    windowsDirectory.includes("\0") ||
    path.win32.normalize(windowsDirectory) !== windowsDirectory
  )
    return null;
  return windowsDirectory.slice(0, 2);
}
