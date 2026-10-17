/**
 * 用途を固定したWindows子Process環境を導出する。
 *
 * @responsibility OS由来の所在を検証し、親ambient環境を採用せずConsole・Native・Host終端の環境を構成する。
 * @trace ARCH-000008 ARCH-000011
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { observeSystemWindowsDirectory } from "./system-directory.ts";

export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT =
  "crdd-coordinator/windows-child-environment";
export const WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION = 10;
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
 * Console reader用に親環境を継承しない環境を導出する。
 *
 * @responsibility Windowsの中立環境と非Windowsの固定空集合を用途に合わせて返す。
 * @trace ARCH-000008
 * @input platform: 呼出し元のConsole実装が扱うNode Platform。既定は現在OS。
 * @returns 凍結した環境、Windowsで観測不能ならnull。
 * @precondition 呼出し元がConsole実装に合うPlatformを選択する。
 * @postcondition WindowsではOS由来Directoryと中立値、他Platformでは空集合となる。
 * @effect Windowsでは固定Native・Filesystem観測。非Windowsでは値の構成だけ。
 * @failure WindowsのOS観測不成立はnull。
 * @invariant process.envを環境として返さない。
 * @boundary Console実装の選択→用途固定のOS環境。
 * @security 環境選択は実行物や外部送信のAuthorityを発行しない。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
export function createInteractiveConsoleReaderEnvironment(
  platform: NodeJS.Platform = process.platform,
) {
  if (platform === "win32") return fixedWindowsEnvironment(Object.freeze({}));
  return Object.freeze({});
}

/**
 * Windows Console readerの用途固定環境を取得する。
 *
 * @responsibility Console readerのWindows Profileを既存の共通構成へ結ぶ。
 * @trace ARCH-000008
 * @input N/A: 用途とPlatformは固定。
 * @returns Windowsの凍結した中立環境、またはnull。
 * @precondition 現在Windowsの固定OS観測が成立する。
 * @postcondition 親ambient値を継承しない。
 * @effect 固定Native・Filesystem観測を共通構成から使用する。
 * @failure Windows環境の取得不能はnull。
 * @invariant Profileや任意envを入力として受け付けない。
 * @boundary Windows Console reader→共通OS環境。
 * @security readerの起動許可と環境候補を分離する。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
export function createWindowsNodeConsoleReaderEnvironment() {
  return createInteractiveConsoleReaderEnvironment("win32");
}

/**
 * Windows Host監視子の用途固定環境を取得する。
 *
 * @responsibility Host監視子を親ambient環境から分離する。
 * @trace ARCH-000008
 * @input N/A: 用途とPlatformは固定。
 * @returns 凍結したWindows中立環境、またはnull。
 * @precondition 現在Windowsの固定OS観測が成立する。
 * @postcondition USERPROFILE・TMP／TEMPを任意値で補完しない。
 * @effect 固定Native・Filesystem観測を共通構成から使用する。
 * @failure Windows環境の取得不能はnull。
 * @invariant 環境候補はLockやHost操作のAuthorityではない。
 * @boundary Host監視子→共通OS環境。
 * @security 監視対象と操作許可は上位Ownerが別に検証する。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
export function createWindowsHostOperationSupervisorEnvironment() {
  return createInteractiveConsoleReaderEnvironment("win32");
}

/**
 * 検証済みProfileをNative補助子の最小環境へ結ぶ。
 *
 * @responsibility 一般Native補助子だけにOS由来USERPROFILEを設定する。
 * @trace ARCH-000008
 * @input N/A: OS由来ProfileとDirectoryを取得する。
 * @returns 凍結した最小環境、またはnull。
 * @precondition 現在WindowsのDirectory／Profile所在を検証できる。
 * @postcondition USERPROFILE以外のambient名は中立値を維持する。
 * @effect 固定Native、OS利用者情報とFilesystem読取り。
 * @failure 非Windows、ProfileまたはDirectory不能はnull。
 * @invariant TMP／TEMPとSYSTEMDRIVEは一般Native環境で付与しない。
 * @boundary OS由来所在→一般Native補助の用途固定環境。
 * @security Profile候補をRoot書込み・初期化・Native操作のAuthorityへ昇格しない。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
export function createWindowsNativeHelperEnvironment() {
  if (process.platform !== "win32") return null;
  const userProfile = observedWindowsUserProfileFromOs();
  if (!userProfile) return null;
  return fixedWindowsEnvironment(Object.freeze({ USERPROFILE: userProfile }));
}

/**
 * Host終端専用の一時所在候補を既存作成Ownerと同じ方法で解決する。
 *
 * @responsibility 空のTMP／TEMPでWin32の所在取得を壊さず、Host境界だけへ候補を搬送する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @input N/A: 既存producerと同じos.tmpdir候補を採用し、自由Pathを受け付けない。
 * @returns TMP／TEMPを同じcanonical候補へ結んだ不変環境、またはnull。
 * @precondition 候補はAuthorityではない。Nativeと上位Ownerが親実体・由来を別に確認する。
 * @postcondition 他の中立化fieldと一般Native helper環境は変更しない。
 * @effect 既存のOS所在検証と一時親のmetadata／realpath読取りだけ。作成・修復・削除0。
 * @failure 所在、型、canonical化、通常Directory確認が不明ならfallbackせず停止する。
 * @invariant 親候補を元対象の親Identity・非使用・処置許可へ昇格しない。
 * @boundary Host終端Adapter→Native GetTempPathWの所在候補。
 * @security 任意設定、秘密値と別場所への自動移行を追加しない。
 * @concurrency 所在を一回解決する。処理中の差替えはNative保持handleとKnown照合で確認する。
 */
export function createWindowsHostTerminalHelperEnvironment() {
  const environment = createWindowsNativeHelperEnvironment();
  if (!environment) return null;
  try {
    const candidate = os.tmpdir();
    if (
      typeof candidate !== "string" ||
      candidate.includes("\0") ||
      !/^[A-Za-z]:\\[^\\]/u.test(candidate)
    )
      return null;
    const metadata = fs.lstatSync(candidate);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) return null;
    const parent = fs.realpathSync(candidate);
    if (
      !/^[A-Za-z]:\\[^\\]/u.test(parent) ||
      parent.includes("\0") ||
      path.win32.normalize(parent) !== parent ||
      path.win32.parse(parent).root === parent
    )
      return null;
    const parentMetadata = fs.lstatSync(parent);
    if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink())
      return null;
    return Object.freeze({ ...environment, TMP: parent, TEMP: parent });
  } catch {
    return null;
  }
}

/**
 * 固定PowerShell初期化に必要な五項目を導出する。
 *
 * @responsibility 中立環境と区別し、OS由来Directory／Profileから固定PATH・PATHEXTを構成する。
 * @trace ARCH-000008
 * @input N/A: 現在WindowsのDirectory／Profileを取得する。
 * @returns 五項目の凍結した環境、またはnull。
 * @precondition WindowsのDirectory／Profile所在を検証できる。
 * @postcondition SystemRoot・WINDIR・USERPROFILE・PATH・PATHEXTだけを返す。
 * @effect 固定Native、OS利用者情報とFilesystem読取り。
 * @failure 非Windowsまたは所在観測不能はnull。
 * @invariant 親PATH・Node注入・Proxy設定を採用しない。
 * @boundary OS観測→固定PowerShell初期化環境。
 * @security Publisher／署名・実行許可の判断は利用側が所有し、本関数は行わない。
 * @concurrency 同期処理。返却する環境は凍結した値であり、実行時の実体確認は利用側が所有する。
 */
export function createWindowsPowerShellAuthenticodeEnvironment(): Readonly<
  Record<string, string>
> | null {
  if (process.platform !== "win32") return null;
  const windowsDirectory = observedWindowsDirectoryFromNative();
  const userProfile = observedWindowsUserProfileFromOs();
  if (!windowsDirectory || !userProfile) return null;
  const system32 = path.win32.join(windowsDirectory, "System32");
  const powerShellDirectory = path.win32.join(
    system32,
    "WindowsPowerShell",
    "v1.0",
  );
  return Object.freeze({
    SystemRoot: windowsDirectory,
    WINDIR: windowsDirectory,
    USERPROFILE: userProfile,
    PATH: [system32, windowsDirectory, powerShellDirectory].join(";"),
    PATHEXT: ".COM;.EXE;.BAT;.CMD",
  });
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

/**
 * 用途固定環境の構成・Consumerとの照合契約を記述する。
 *
 * @responsibility 既存の環境Profileと非Authority境界を固定値で説明する。
 * @trace ARCH-000008
 * @input N/A: 固定契約を返す。
 * @returns 環境Profile・Consumer・非Authority条件の凍結した記述。
 * @precondition N/A: 動的状態を読み取らない。
 * @postcondition 実環境取得や実行成功を主張せず記述だけを返す。
 * @effect N/A: 固定値の構成だけ。
 * @failure N/A: 固定値を返し独立した失敗分岐を持たない。
 * @invariant 記述の存在を実観測・Authority・終了確認へ昇格しない。
 * @boundary 固定環境契約→照合用記述。
 * @security 秘密値・現在の所在・認証情報を記述へ含めない。
 * @concurrency N/A: 外部資源や共有状態を持たない同期処理。
 */
export function describeWindowsChildEnvironmentContract() {
  return Object.freeze({
    contract: WINDOWS_CHILD_ENVIRONMENT_CONTRACT,
    contractRevision: WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION,
    provenance: WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE,
    ambientNames: "fixed_neutral_values",
    callerEnvironmentAccepted: false,
    parentEnvironmentAuthority: false,
    nativeHelperUserProfile: "os_user_info_validated_profile_path",
    nativeHelperConsumers: Object.freeze([
      "provider_home_observation",
      "candidate_store_observation",
      "candidate_store_initialization",
      "runtime_state_observation",
      "runtime_state_initialization",
      "docker_desktop_runtime_repair_native_helper",
    ]),
    nodeChildConsumers: Object.freeze([
      "interactive_console_reader",
      "host_operation_lock_supervisor",
    ]),
    dockerCliConsumers: Object.freeze([
      "docker_effect_runtime",
      "docker_recovery_runtime",
      "docker_desktop_runtime_repair",
    ]),
    powerShellAuthenticodeConsumers: Object.freeze([
      "docker_cli_authenticode_inspection",
    ]),
    powerShellAuthenticodeEnvironment:
      "native_os_directory_and_validated_user_profile_minimal_powershell_initialization_block",
    dockerDesktopLauncherConsumers: Object.freeze([]),
    dockerRepairHelperSystemDrive:
      "native_system_windows_directory_local_drive",
    dockerDesktopLauncherEnvironment:
      "native_helper_known_folder_and_loaded_os_directory_minimal_unicode_block",
    userProfileEnvironmentAuthority: false,
    userProfileInitializationAuthority: false,
    actualChildObservationRequired: true,
  });
}
