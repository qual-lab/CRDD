//! Docker Desktop修復で必要なNative Process観測と限定操作を提供する。
//!
//! @responsibility 固定したPolicy ArtifactとProcess Identityを検証し、許可されたProcess操作・終了観測・資源回収だけを実行する。
//! @trace ARCH-000008

#[cfg(test)]
use super::identity::is_cli_role;
use super::identity::{
    LockedArtifact, OwnedHandle, ProcessInventory, filetime_value, inventory_process_scope,
    inventory_processes, lock_current_artifacts, process_creation, process_path, sha256_bytes,
    verify_locked_artifacts,
};
use std::ffi::{OsStr, OsString};
use std::io::{Read, Write};
use std::mem::size_of;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::path::PathBuf;
use std::ptr::{null, null_mut};
use std::time::{Duration, Instant};
use windows_sys::Win32::System::Console::{GetStdHandle, STD_INPUT_HANDLE};
use windows_sys::Win32::System::Pipes::PeekNamedPipe;

use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_ALREADY_EXISTS, GetLastError, HANDLE, INVALID_HANDLE_VALUE, STILL_ACTIVE,
    WAIT_OBJECT_0,
};
use windows_sys::Win32::System::SystemInformation::GetSystemWindowsDirectoryW;
use windows_sys::Win32::System::Threading::{
    CREATE_UNICODE_ENVIRONMENT, CreateMutexW, CreateProcessW, GetExitCodeProcess,
    PROCESS_INFORMATION, STARTUPINFOW, TerminateProcess, WaitForSingleObject,
};

const RESPONSE_MAGIC: &[u8; 8] = b"CRDDDR05";
const RESPONSE_BYTES: usize = 41;
const PROCESS_WAIT_MS: u32 = 10_000;
const PROCESS_TERMINATION_TOTAL_WAIT_MS: u32 = 45_000;
const RESTART_POLICY: &[u8] = b"CRDD_DOCKER_RESTART_TRUST_V1|official-fixed-paths|Docker Inc|cache-only|deny-write-delete|optional-dev-envs";
const RESTART_RESPONSE_MAGIC: &[u8; 8] = b"CRDDDS01";

/// Docker Desktop修復のmutex name責務を実行する。
///
/// @responsibility Docker Desktop修復のmutex name責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn mutex_name() -> Option<Vec<u16>> {
    let identity = crate::process::principal::current_selected_user_identity_hash()?;
    let mut text = String::from(r"Global\CRDD.Coordinator.DockerDesktopRepair.");
    for byte in &identity[..16] {
        text.push_str(&format!("{byte:02x}"));
    }
    let mut wide: Vec<u16> = OsStr::new(&text).encode_wide().collect();
    wide.push(0);
    Some(wide)
}

/// Docker Desktop修復のacquire mutex責務を実行する。
///
/// @responsibility Docker Desktop修復のacquire mutex責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn acquire_mutex() -> Option<OwnedHandle> {
    let name = mutex_name()?;
    // SAFETY: name is NUL-terminated and the returned handle is transferred to OwnedHandle.
    let handle = unsafe { CreateMutexW(null(), 1, name.as_ptr()) };
    if handle.is_null() {
        return None;
    }
    if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
        unsafe { CloseHandle(handle) };
        return None;
    }
    Some(OwnedHandle(handle))
}

/// terminate processesを終了し終了後状態を観測する。
///
/// @responsibility terminate processesを終了し終了後状態を観測する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
/// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
fn terminate_processes(artifacts: &[LockedArtifact]) -> u8 {
    let processes = match inventory_processes(artifacts) {
        ProcessInventory::Absent => return b'A',
        ProcessInventory::Verified(value) => value,
        ProcessInventory::Unknown => return b'N',
    };
    let mut effect_issued = false;
    let termination_started = Instant::now();
    for process in &processes {
        if process_creation(process.handle.0) != Some(process.creation) {
            return if effect_issued { b'P' } else { b'N' };
        }
        let mut exit_code = 0_u32;
        // SAFETY: handle is the same verified kernel process object and has query access.
        if unsafe { GetExitCodeProcess(process.handle.0, &mut exit_code) } == 0
            || exit_code != u32::try_from(STILL_ACTIVE).unwrap_or(u32::MAX)
        {
            return if effect_issued { b'P' } else { b'N' };
        }
        // SAFETY: handle is the same verified kernel process object and has terminate access.
        if unsafe { TerminateProcess(process.handle.0, 1) } == 0 {
            return if effect_issued { b'P' } else { b'N' };
        }
        effect_issued = true;
        let elapsed_ms = termination_started.elapsed().as_millis();
        let total_wait_ms = u128::from(PROCESS_TERMINATION_TOTAL_WAIT_MS);
        if elapsed_ms >= total_wait_ms {
            return b'P';
        }
        let remaining_wait_ms = u32::try_from(total_wait_ms - elapsed_ms)
            .unwrap_or(PROCESS_TERMINATION_TOTAL_WAIT_MS)
            .min(PROCESS_WAIT_MS);
        // SAFETY: handle has synchronize access and remains valid.
        if unsafe { WaitForSingleObject(process.handle.0, remaining_wait_ms) } != WAIT_OBJECT_0 {
            return b'P';
        }
        // Process ID is retained only as identity evidence; it is never reused as kill authority.
        let _ = process.process_id;
    }
    match inventory_processes(artifacts) {
        ProcessInventory::Absent => b'T',
        _ => b'P',
    }
}

/// Docker Desktop修復のexact artifact責務を実行する。
///
/// @responsibility Docker Desktop修復のexact artifact責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn exact_artifact<'a>(role: &str, artifacts: &'a [LockedArtifact]) -> Option<&'a LockedArtifact> {
    let mut matches = artifacts.iter().filter(|value| value.policy.role == role);
    let result = matches.next()?;
    matches.next().is_none().then_some(result)
}

/// Docker Desktop修復のappend environment entry責務を実行する。
///
/// @responsibility Docker Desktop修復のappend environment entry責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn append_environment_entry(environment: &mut Vec<u16>, name: &str, value: &OsStr) -> Option<()> {
    environment.extend(name.encode_utf16());
    environment.push(u16::from(b'='));
    environment.extend(value.encode_wide());
    environment.push(0);
    Some(())
}

/// Docker Desktop修復で使用するLauncherContext契約を表す。
///
/// @responsibility LauncherContextが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
struct LauncherContext {
    environment: Vec<u16>,
    current_directory: PathBuf,
}

/// launcher contextを検証済み入力から生成する。
///
/// @responsibility launcher contextを検証済み入力から生成する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
/// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
fn launcher_context() -> Option<LauncherContext> {
    let local_app_data = crate::filesystem::windows_directory::local_app_data_path()?;
    let profile = crate::filesystem::windows_directory::user_profile_path()?;
    let roaming_app_data = crate::filesystem::windows_directory::roaming_app_data_path()?;
    let program_data = crate::filesystem::windows_directory::program_data_path()?;
    let temporary = local_app_data.join("Temp");
    for target in [
        &profile,
        &roaming_app_data,
        &local_app_data,
        &program_data,
        &temporary,
    ] {
        let metadata = std::fs::symlink_metadata(target).ok()?;
        let canonical = std::fs::canonicalize(target).ok()?;
        let canonical_text = canonical.to_string_lossy();
        let canonical_text = canonical_text
            .strip_prefix(r"\\?\")
            .unwrap_or(&canonical_text);
        if !metadata.is_dir()
            || metadata.file_type().is_symlink()
            || !canonical_text.eq_ignore_ascii_case(&target.to_string_lossy())
        {
            return None;
        }
    }
    let mut windows = vec![0_u16; 32_768];
    // SAFETY: windows is a writable bounded UTF-16 buffer.
    let length =
        usize::try_from(unsafe { GetSystemWindowsDirectoryW(windows.as_mut_ptr(), 32_768) })
            .ok()?;
    if length == 0 || length >= windows.len() {
        return None;
    }
    windows.truncate(length);
    let windows_directory = OsString::from_wide(&windows);
    let system_drive = system_drive_from_windows_directory(&windows_directory)?;
    let neutral = [
        "ALL_PROXY",
        "COMSPEC",
        "GIT_ASKPASS",
        "GIT_CONFIG_GLOBAL",
        "GIT_CONFIG_SYSTEM",
        "GIT_SSH",
        "GIT_SSH_COMMAND",
        "HOMEDRIVE",
        "HOMEPATH",
        "HTTP_PROXY",
        "HTTPS_PROXY",
        "LOGONSERVER",
        "NODE_EXTRA_CA_CERTS",
        "NODE_OPTIONS",
        "NODE_PATH",
        "NO_PROXY",
        "PATH",
        "PATHEXT",
        "SSH_AGENT_PID",
        "SSH_AUTH_SOCK",
        "USERDOMAIN",
        "USERNAME",
    ];
    let mut entries: Vec<(String, OsString)> = neutral
        .into_iter()
        .map(|name| (name.to_owned(), OsString::new()))
        .collect();
    entries.extend([
        ("APPDATA".to_owned(), roaming_app_data.into_os_string()),
        ("HOME".to_owned(), profile.clone().into_os_string()),
        ("USERPROFILE".to_owned(), profile.clone().into_os_string()),
        (
            "DOCKER_CONFIG".to_owned(),
            profile.join(".docker").into_os_string(),
        ),
        ("LOCALAPPDATA".to_owned(), local_app_data.into_os_string()),
        ("ProgramData".to_owned(), program_data.into_os_string()),
        ("SystemRoot".to_owned(), windows_directory.clone()),
        ("SYSTEMDRIVE".to_owned(), system_drive),
        ("TEMP".to_owned(), temporary.clone().into_os_string()),
        ("TMP".to_owned(), temporary.into_os_string()),
        ("WINDIR".to_owned(), windows_directory),
    ]);
    entries.sort_by_key(|(name, _)| name.to_ascii_lowercase());
    let mut environment = Vec::with_capacity(4096);
    for (name, value) in entries {
        append_environment_entry(&mut environment, &name, &value)?;
    }
    environment.push(0);
    (environment.len() <= 32_767).then_some(LauncherContext {
        environment,
        current_directory: profile,
    })
}

/// Docker Desktop修復のsystem drive from windows directory責務を実行する。
///
/// @responsibility Docker Desktop修復のsystem drive from windows directory責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn system_drive_from_windows_directory(directory: &OsStr) -> Option<OsString> {
    let units: Vec<u16> = directory.encode_wide().collect();
    if units.len() <= 3
        || !((u16::from(b'A')..=u16::from(b'Z')).contains(&units[0])
            || (u16::from(b'a')..=u16::from(b'z')).contains(&units[0]))
        || units[1] != u16::from(b':')
        || units[2] != u16::from(b'\\')
        || units.contains(&0)
        || units.contains(&u16::from(b'/'))
    {
        return None;
    }
    let text = String::from_utf16(&units).ok()?;
    if text[3..]
        .split('\\')
        .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return None;
    }
    Some(OsString::from_wide(&units[..2]))
}

/// create exact processを検証済み入力から生成する。
///
/// @responsibility create exact processを検証済み入力から生成する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
/// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
fn create_exact_process(
    executable: &std::path::Path,
    arguments: &OsStr,
    minimum_creation_time: u64,
    context: &mut LauncherContext,
) -> (u8, Option<OwnedHandle>) {
    let mut application: Vec<u16> = executable.as_os_str().encode_wide().collect();
    application.push(0);
    let mut command: Vec<u16> = arguments.encode_wide().collect();
    command.push(0);
    let mut current_directory: Vec<u16> = context
        .current_directory
        .as_os_str()
        .encode_wide()
        .collect();
    current_directory.push(0);
    let startup = STARTUPINFOW {
        cb: u32::try_from(size_of::<STARTUPINFOW>()).unwrap_or(0),
        ..unsafe { std::mem::zeroed() }
    };
    let mut process: PROCESS_INFORMATION = unsafe { std::mem::zeroed() };
    // SAFETY: all pointers refer to live writable/readable buffers; no handles are inherited.
    if unsafe {
        CreateProcessW(
            application.as_ptr(),
            command.as_mut_ptr(),
            null(),
            null(),
            0,
            CREATE_UNICODE_ENVIRONMENT,
            context.environment.as_mut_ptr().cast(),
            current_directory.as_ptr(),
            &startup,
            &mut process,
        )
    } == 0
    {
        return (b'N', None);
    }
    let thread = OwnedHandle(process.hThread);
    let process_handle = OwnedHandle(process.hProcess);
    let path_matches = process_path(process_handle.0)
        .map(|value| {
            value
                .to_string_lossy()
                .eq_ignore_ascii_case(&executable.to_string_lossy())
        })
        .unwrap_or(false);
    let creation_valid = process_creation(process_handle.0)
        .map(|value| value >= minimum_creation_time)
        .unwrap_or(false);
    drop(thread);
    if path_matches && creation_valid {
        (b'S', Some(process_handle))
    } else {
        // CreateProcessW already issued the Process Effect. A later identity
        // observation failure must not erase that fact.
        (b'P', Some(process_handle))
    }
}

/// launch desktopを検証済み入力から生成する。
///
/// @responsibility launch desktopを検証済み入力から生成する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
/// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
fn launch_desktop(artifacts: &mut [LockedArtifact]) -> u8 {
    if !verify_locked_artifacts(artifacts) {
        return b'N';
    }
    let Some(launcher) = exact_artifact("launcher", artifacts) else {
        return b'N';
    };
    let quoted = format!("\"{}\" --minimized", launcher.policy.path.display());
    let mut context = match launcher_context() {
        Some(value) => value,
        None => return b'N',
    };
    create_exact_process(
        &launcher.policy.path,
        OsStr::new(&quoted),
        filetime_value(launcher.information.ftLastWriteTime),
        &mut context,
    )
    .0
}

/// responseを固定形式で書き込む。
///
/// @responsibility responseを固定形式で書き込む責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn write_response(writer: &mut impl Write, status: u8, policy_hash: &[u8; 32]) -> bool {
    let mut response = [0_u8; RESPONSE_BYTES];
    response[..8].copy_from_slice(RESPONSE_MAGIC);
    response[8] = status;
    response[9..].copy_from_slice(policy_hash);
    writer.write_all(&response).is_ok() && writer.flush().is_ok()
}

/// Docker Desktop修復のrun責務を実行する。
///
/// @responsibility Docker Desktop修復のrun責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn run(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    let Some(policy_hash) = sha256_bytes(RESTART_POLICY) else {
        return 2;
    };
    let Some(_mutex) = acquire_mutex() else {
        let _ = write_response(writer, b'L', &policy_hash);
        return 2;
    };
    let Some(mut artifacts) = lock_current_artifacts() else {
        let _ = write_response(writer, b'U', &policy_hash);
        return 2;
    };
    if !write_response(writer, b'R', &policy_hash) {
        return 3;
    }
    loop {
        let mut command = [0_u8; 1];
        match reader.read_exact(&mut command) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => return 0,
            Err(_) => return 3,
        }
        let status = match command[0] {
            b'V' => {
                if verify_locked_artifacts(&mut artifacts) {
                    b'V'
                } else {
                    b'U'
                }
            }
            b'I' => match inventory_processes(&artifacts) {
                ProcessInventory::Absent => b'A',
                ProcessInventory::Verified(_) => b'V',
                ProcessInventory::Unknown => b'U',
            },
            b'S' => {
                if stdin_cancelled() {
                    b'N'
                } else {
                    let (status, cleanup_confirmed) = stop_desktop(&mut artifacts, stdin_cancelled);
                    if !cleanup_confirmed {
                        let _ = write_response(writer, status, &policy_hash);
                        return 3;
                    }
                    status
                }
            }
            b'K' => terminate_processes(&artifacts),
            b'L' => launch_desktop(&mut artifacts),
            b'Q' => {
                return if write_response(writer, b'C', &policy_hash) {
                    0
                } else {
                    3
                };
            }
            _ => return 2,
        };
        if !write_response(writer, status, &policy_hash) {
            return 3;
        }
    }
}

/// Separate trust contract for restart; legacy repair records keep their policy.
///
/// @responsibility Docker Desktop修復のstdin cancelled責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn stdin_cancelled() -> bool {
    // SAFETY: borrowed standard handle, never closed here.
    let input = unsafe { GetStdHandle(STD_INPUT_HANDLE) };
    pipe_cancelled(input)
}

/// Docker Desktop修復のpipe cancelled責務を実行する。
///
/// @responsibility Docker Desktop修復のpipe cancelled責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn pipe_cancelled(input: HANDLE) -> bool {
    if input.is_null() || input == INVALID_HANDLE_VALUE {
        return true;
    }
    let mut available = 0;
    // SAFETY: read-only pipe state query. EOF/error or unsolicited input cancels the in-flight operation.
    (unsafe { PeekNamedPipe(input, null_mut(), 0, null_mut(), &mut available, null_mut()) }) == 0
        || available != 0
}

/// stop desktopを終了し終了後状態を観測する。
///
/// @responsibility stop desktopを終了し終了後状態を観測する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
/// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
fn stop_desktop(
    artifacts: &mut [LockedArtifact],
    mut cancelled: impl FnMut() -> bool,
) -> (u8, bool) {
    if !verify_locked_artifacts(artifacts) {
        return (b'N', true);
    }
    let Some(plugin) = exact_artifact("desktop_plugin", artifacts) else {
        return (b'N', true);
    };
    let Some(mut context) = launcher_context() else {
        return (b'N', true);
    };
    let command = format!(
        "\"{}\" desktop stop --timeout 30",
        plugin.policy.path.display()
    );
    if cancelled() {
        return (b'N', true);
    }
    let child = match crate::process::owned_child::OwnedChild::spawn(
        &plugin.policy.path,
        OsStr::new(&command),
        &mut context.environment,
        &context.current_directory,
    ) {
        Ok(child) => child,
        Err(failure) => {
            return (
                if failure.process_created { b'P' } else { b'N' },
                failure.cleanup_confirmed,
            );
        }
    };
    let result = child.wait(Duration::from_secs(35), cancelled);
    if result.completion == crate::process::owned_child::Completion::Exited(0)
        && result.cleanup_confirmed
    {
        (b'T', true)
    } else {
        (b'P', result.cleanup_confirmed)
    }
}

/// Docker Desktop修復のrestart command is allowed責務を実行する。
///
/// @responsibility Docker Desktop修復のrestart command is allowed責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
/// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
fn restart_command_is_allowed(command: u8) -> bool {
    matches!(command, b'V' | b'B' | b'I' | b'S' | b'L' | b'Q')
}

/// Docker Desktop修復のrun restart責務を実行する。
///
/// @responsibility Docker Desktop修復のrun restart責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
/// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
pub(crate) fn run_restart<R: Read, W: Write>(reader: &mut R, writer: &mut W) -> i32 {
    let Some(policy_hash) = sha256_bytes(RESTART_POLICY) else {
        return 2;
    };
    let respond = |writer: &mut W, status: u8| -> bool {
        let mut frame = [0_u8; RESPONSE_BYTES];
        frame[..8].copy_from_slice(RESTART_RESPONSE_MAGIC);
        frame[8] = status;
        frame[9..].copy_from_slice(&policy_hash);
        writer.write_all(&frame).is_ok() && writer.flush().is_ok()
    };
    let Some(_mutex) = acquire_mutex() else {
        let _ = respond(writer, b'L');
        return 2;
    };
    let Some(mut artifacts) = lock_current_artifacts() else {
        let _ = respond(writer, b'U');
        return 2;
    };
    if !respond(writer, b'R') {
        return 3;
    }
    loop {
        let mut command = [0_u8; 1];
        match reader.read_exact(&mut command) {
            Ok(()) => (),
            Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => return 0,
            Err(_) => return 3,
        }
        if !restart_command_is_allowed(command[0]) {
            return 2;
        }
        if command[0] == b'Q' {
            return if respond(writer, b'C') { 0 } else { 3 };
        }
        if !verify_locked_artifacts(&mut artifacts) {
            let _ = respond(writer, b'U');
            return 2;
        }
        let status = match command[0] {
            b'V' => b'V',
            b'B' => match inventory_process_scope(&artifacts, true) {
                ProcessInventory::Absent => b'A',
                ProcessInventory::Verified(_) => b'V',
                ProcessInventory::Unknown => b'U',
            },
            b'I' => match inventory_processes(&artifacts) {
                ProcessInventory::Absent => b'A',
                ProcessInventory::Verified(_) => b'V',
                ProcessInventory::Unknown => b'U',
            },
            b'S' => {
                if stdin_cancelled() {
                    b'N'
                } else {
                    let (status, cleanup_confirmed) = stop_desktop(&mut artifacts, stdin_cancelled);
                    if !cleanup_confirmed {
                        // Never acknowledge a later Q as clean after unresolved child ownership.
                        let _ = respond(writer, status);
                        return 3;
                    }
                    status
                }
            }
            b'L' => launch_desktop(&mut artifacts),
            _ => return 2,
        };
        if !respond(writer, status) {
            return 3;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// eof_during_owned_child_wait_cancels_and_joins_childを検証する。
    ///
    /// @responsibility eof_during_owned_child_wait_cancels_and_joins_childの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus eof_during_owned_child_wait_cancels_and_joins_childの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn eof_during_owned_child_wait_cancels_and_joins_child() {
        let mut read = null_mut();
        let mut write = null_mut();
        // SAFETY: two output handles, no inheritance and default bounded pipe.
        assert_ne!(
            unsafe {
                windows_sys::Win32::System::Pipes::CreatePipe(&mut read, &mut write, null(), 0)
            },
            0
        );
        let read = OwnedHandle(read);
        let mut write = Some(OwnedHandle(write));
        assert!(!pipe_cancelled(read.0));
        let exe = std::env::current_exe().unwrap();
        let command = format!(
            "\"{}\" --exact process::owned_child::tests::sleep_child --ignored",
            exe.display()
        );
        let child = crate::process::owned_child::OwnedChild::spawn(
            &exe,
            OsStr::new(&command),
            &mut [0, 0],
            exe.parent().unwrap(),
        )
        .unwrap_or_else(|error| panic!("{error:?}"));
        let result = child.wait(Duration::from_secs(3), || {
            write.take();
            pipe_cancelled(read.0)
        });
        assert_eq!(
            result.completion,
            crate::process::owned_child::Completion::Cancelled
        );
        assert!(result.cleanup_confirmed);
    }

    /// cli_inventory_scope_never_expands_managed_termination_rolesを検証する。
    ///
    /// @responsibility cli_inventory_scope_never_expands_managed_termination_rolesの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus cli_inventory_scope_never_expands_managed_termination_rolesの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn cli_inventory_scope_never_expands_managed_termination_roles() {
        for role in ["docker_cli", "desktop_cli"] {
            assert!(is_cli_role(role));
        }
        for role in [
            "backend",
            "desktop",
            "service",
            "dev_envs",
            "",
            "docker_cli_extra",
        ] {
            assert!(!is_cli_role(role));
        }
    }

    /// Rust Test Caseを検証する。
    ///
    /// @responsibility Rust Test Caseの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus Rust Test Caseの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    #[ignore = "Explicit installed Docker read-only CLI inventory probe"]
    fn restart_cli_inventory_is_read_only_and_closed() {
        let mut input = std::io::Cursor::new(b"BQ");
        let mut output = Vec::new();
        assert_eq!(run_restart(&mut input, &mut output), 0);
        assert_eq!(output.len(), RESPONSE_BYTES * 3);
        assert_eq!(output[8], b'R');
        assert!(matches!(output[RESPONSE_BYTES + 8], b'A' | b'V' | b'U'));
        println!(
            "restart_cli_inventory_status={}",
            char::from(output[RESPONSE_BYTES + 8])
        );
        assert_eq!(output[2 * RESPONSE_BYTES + 8], b'C');
    }

    /// Rust Test Caseを検証する。
    ///
    /// @responsibility Rust Test Caseの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus Rust Test Caseの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    #[ignore = "Explicit installed Docker read-only restart trust probe"]
    fn restart_trust_accepts_current_installation_without_process_effects() {
        let mut input = std::io::Cursor::new(b"VQ");
        let mut output = Vec::new();
        assert_eq!(run_restart(&mut input, &mut output), 0);
        assert_eq!(output.len(), RESPONSE_BYTES * 3);
        for (frame, status) in output.chunks_exact(RESPONSE_BYTES).zip([b'R', b'V', b'C']) {
            assert_eq!(&frame[..8], RESTART_RESPONSE_MAGIC);
            assert_eq!(frame[8], status);
            assert_eq!(&frame[9..], sha256_bytes(RESTART_POLICY).unwrap());
        }
    }

    /// Rust Test Caseを検証する。
    ///
    /// @responsibility Rust Test Caseの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus Rust Test Caseの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    #[ignore = "Explicit installed Docker read-only repair trust probe"]
    fn repair_trust_accepts_current_installation_without_process_effects() {
        let mut input = std::io::Cursor::new(b"VQ");
        let mut output = Vec::new();
        assert_eq!(run(&mut input, &mut output), 0);
        assert_eq!(output.len(), RESPONSE_BYTES * 3);
        for (frame, status) in output.chunks_exact(RESPONSE_BYTES).zip([b'R', b'V', b'C']) {
            assert_eq!(&frame[..8], RESPONSE_MAGIC);
            assert_eq!(frame[8], status);
            assert_eq!(&frame[9..], sha256_bytes(RESTART_POLICY).unwrap());
        }
    }

    /// restart_protocol_rejects_force_termination_commandを検証する。
    ///
    /// @responsibility restart_protocol_rejects_force_termination_commandの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus restart_protocol_rejects_force_termination_commandの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn restart_protocol_rejects_force_termination_command() {
        assert!(!restart_command_is_allowed(b'K'));
        for command in [b'V', b'B', b'I', b'S', b'L', b'Q'] {
            assert!(restart_command_is_allowed(command));
        }
    }

    /// fixed_response_does_not_report_path_or_process_idを検証する。
    ///
    /// @responsibility fixed_response_does_not_report_path_or_process_idの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus fixed_response_does_not_report_path_or_process_idの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn fixed_response_does_not_report_path_or_process_id() {
        let mut bytes = Vec::new();
        let hash = [7_u8; 32];
        assert!(write_response(&mut bytes, b'R', &hash));
        assert_eq!(bytes.len(), RESPONSE_BYTES);
        assert_eq!(&bytes[..8], RESPONSE_MAGIC);
        assert_eq!(&bytes[9..], &hash);
        assert!(!bytes.windows(3).any(|window| window == b"C:\\"));
    }

    /// launcher_environment_is_known_folder_derived_and_proxy_neutralを検証する。
    ///
    /// @responsibility launcher_environment_is_known_folder_derived_and_proxy_neutralの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus launcher_environment_is_known_folder_derived_and_proxy_neutralの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn launcher_environment_is_known_folder_derived_and_proxy_neutral() {
        let context = launcher_context().unwrap();
        let environment = context.environment;
        assert_eq!(environment.last(), Some(&0));
        let text = String::from_utf16_lossy(&environment);
        assert!(text.contains("LOCALAPPDATA="));
        assert!(text.contains("SystemRoot="));
        assert!(text.contains("TEMP="));
        assert!(text.contains("TMP="));
        assert!(text.contains("WINDIR="));
        assert!(text.contains("HTTP_PROXY=\0"));
        assert!(text.contains("HTTPS_PROXY=\0"));
        assert!(text.contains("PATH=\0"));
        assert!(text.ends_with("\0\0"));
        let profile = crate::filesystem::windows_directory::user_profile_path().unwrap();
        assert_eq!(context.current_directory, profile);
        for name in ["HOME", "USERPROFILE"] {
            assert!(text.contains(&format!("{name}={}\0", profile.display())));
        }
        assert!(text.contains(&format!(
            "DOCKER_CONFIG={}\0",
            profile.join(".docker").display()
        )));
        assert!(text.contains(&format!(
            "APPDATA={}\0",
            crate::filesystem::windows_directory::roaming_app_data_path().unwrap().display()
        )));
        assert!(text.contains(&format!(
            "ProgramData={}\0",
            crate::filesystem::windows_directory::program_data_path().unwrap().display()
        )));
        let names: Vec<_> = text
            .split('\0')
            .filter(|entry| !entry.is_empty())
            .map(|entry| entry.split_once('=').unwrap().0.to_ascii_lowercase())
            .collect();
        assert!(names.windows(2).all(|pair| pair[0] < pair[1]));
    }

    fn wait_for_test_child(process: OwnedHandle) {
        // SAFETY: the handle is exclusively owned and refers to the exact test child.
        let wait = unsafe { WaitForSingleObject(process.0, PROCESS_WAIT_MS) };
        if wait != WAIT_OBJECT_0 {
            // SAFETY: only the test child created above is terminated on timeout, never Docker.
            unsafe {
                TerminateProcess(process.0, 99);
                WaitForSingleObject(process.0, PROCESS_WAIT_MS);
            }
        }
        assert_eq!(wait, WAIT_OBJECT_0);
        let mut exit_code = STILL_ACTIVE as u32;
        // SAFETY: the process handle is live and exit_code is writable.
        assert_ne!(unsafe { GetExitCodeProcess(process.0, &mut exit_code) }, 0);
        assert_eq!(exit_code, 0);
    }

    /// exact_launcher_primitive_observes_the_created_child_handleを検証する。
    ///
    /// @responsibility exact_launcher_primitive_observes_the_created_child_handleの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus exact_launcher_primitive_observes_the_created_child_handleの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn exact_launcher_primitive_observes_the_created_child_handle() {
        let executable = std::env::current_exe().unwrap();
        let arguments = OsString::from(format!("\"{}\" --list", executable.display()));
        let mut context = launcher_context().unwrap();
        for (minimum_creation_time, expected) in [(0, b'S'), (u64::MAX, b'P')] {
            let (status, process) =
                create_exact_process(&executable, &arguments, minimum_creation_time, &mut context);
            assert_eq!(status, expected);
            wait_for_test_child(process.unwrap());
        }
    }

    /// launcher_context_is_observed_inside_real_childを検証する。
    ///
    /// @responsibility launcher_context_is_observed_inside_real_childの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus launcher_context_is_observed_inside_real_childの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn launcher_context_is_observed_inside_real_child() {
        // LLVM's instrumented Windows test executable reconstructs its own
        // bootstrap environment before the Rust test body runs. That makes it
        // unsuitable for observing CreateProcessW's exact environment block.
        // The ordinary native test remains mandatory and exercises this full
        // assertion; coverage measures the remaining branches.
        if std::env::var_os("LLVM_PROFILE_FILE").is_some() {
            return;
        }
        let executable = std::env::current_exe().unwrap();
        let arguments = OsString::from(format!(
            "\"{}\" --exact docker_desktop::repair::tests::launcher_child_context_probe --ignored",
            executable.display()
        ));
        let mut context = launcher_context().unwrap();
        let text = String::from_utf16(&context.environment).unwrap();
        let mut entries: std::collections::BTreeMap<_, _> = text
            .split('\0')
            .filter(|entry| !entry.is_empty())
            .map(|entry| {
                let (name, value) = entry.split_once('=').unwrap();
                (name.to_ascii_lowercase(), OsString::from(value))
            })
            .collect();
        let expected_hash = environment_hash(&entries);
        entries.insert(
            "crdd_test_launch_env_sha256".to_owned(),
            expected_hash.into(),
        );
        context.environment.clear();
        for (name, value) in entries {
            append_environment_entry(&mut context.environment, &name, &value).unwrap();
        }
        context.environment.push(0);
        let (status, process) = create_exact_process(&executable, &arguments, 0, &mut context);
        assert_eq!(status, b'S');
        wait_for_test_child(process.unwrap());
    }

    /// Rust Test Caseを検証する。
    ///
    /// @responsibility Rust Test Caseの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus Rust Test Caseの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    #[ignore = "invoked only by the real-child context test"]
    fn launcher_child_context_probe() {
        let actual: std::collections::BTreeMap<_, _> = std::env::vars_os()
            .map(|(name, value)| (name.to_string_lossy().to_ascii_lowercase(), value))
            .filter(|(name, _)| name != "crdd_test_launch_env_sha256")
            .collect();
        // Do not print environment values even on mismatch.
        assert!(
            environment_hash(&actual) == std::env::var("CRDD_TEST_LAUNCH_ENV_SHA256").unwrap(),
            "child environment differs from the explicit profile"
        );
        assert!(
            std::fs::canonicalize(std::env::current_dir().unwrap()).unwrap()
                == std::fs::canonicalize(actual.get("home").unwrap()).unwrap()
        );
        assert!(actual.get("home") == actual.get("userprofile"));
        // Docker Desktop's settings loader requires ProgramData, independently of
        // the user's home. A round-trip hash alone cannot detect an omitted input.
        let program_data = actual.get("programdata").expect("ProgramData is required");
        assert!(!program_data.is_empty());
        assert!(std::path::Path::new(program_data).is_absolute());
        assert!(std::path::Path::new(program_data).is_dir());
        let observed_program_data =
            crate::filesystem::windows_directory::program_data_path().unwrap();
        assert!(observed_program_data.is_absolute());
        let observed_canonical = std::fs::canonicalize(&observed_program_data).unwrap();
        assert!(
            observed_canonical
                .to_string_lossy()
                .strip_prefix(r"\\?\")
                .unwrap()
                .eq_ignore_ascii_case(&observed_program_data.to_string_lossy())
        );
        assert_eq!(
            actual.get("systemdrive"),
            system_drive_from_windows_directory(actual.get("systemroot").unwrap()).as_ref()
        );
        assert_eq!(
            std::fs::canonicalize(program_data).unwrap(),
            std::fs::canonicalize(
                crate::filesystem::windows_directory::program_data_path().unwrap()
            )
            .unwrap()
        );
    }

    /// system_drive_requires_canonical_local_windows_directoryを検証する。
    ///
    /// @responsibility system_drive_requires_canonical_local_windows_directoryの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus system_drive_requires_canonical_local_windows_directoryの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn system_drive_requires_canonical_local_windows_directory() {
        assert_eq!(
            system_drive_from_windows_directory(OsStr::new(r"D:\Windows")),
            Some(OsString::from("D:"))
        );
        for value in [
            r"C:",
            r"C:\",
            r"C:Windows",
            r"\Windows",
            r"\\host\Windows",
            r"C:\a\..\Windows",
            "C:/Windows",
            "C:\\Windows\0",
        ] {
            assert!(system_drive_from_windows_directory(OsStr::new(value)).is_none());
        }
    }

    fn environment_hash(entries: &std::collections::BTreeMap<String, OsString>) -> String {
        let mut wide = Vec::new();
        for (name, value) in entries {
            append_environment_entry(&mut wide, name, value).unwrap();
        }
        let bytes: Vec<u8> = wide.into_iter().flat_map(u16::to_le_bytes).collect();
        sha256_bytes(&bytes)
            .unwrap()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect()
    }

    /// launcher_invalid_directory_does_not_fall_back_to_parent_directoryを検証する。
    ///
    /// @responsibility launcher_invalid_directory_does_not_fall_back_to_parent_directoryの合否判定を所有する。
    /// @trace PRL-UT-006
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus launcher_invalid_directory_does_not_fall_back_to_parent_directoryの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
    #[test]
    fn launcher_invalid_directory_does_not_fall_back_to_parent_directory() {
        let executable = std::env::current_exe().unwrap();
        let arguments = OsString::from(format!("\"{}\" --list", executable.display()));
        let mut context = launcher_context().unwrap();
        context.current_directory = executable; // A file cannot be a working directory.
        let (status, process) = create_exact_process(
            &std::env::current_exe().unwrap(),
            &arguments,
            0,
            &mut context,
        );
        assert_eq!(status, b'N');
        assert!(process.is_none());
    }
}
