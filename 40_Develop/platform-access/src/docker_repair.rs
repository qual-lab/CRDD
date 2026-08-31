use std::ffi::{OsStr, OsString, c_void};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::mem::size_of;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::os::windows::fs::OpenOptionsExt;
use std::os::windows::io::AsRawHandle;
use std::path::PathBuf;
use std::ptr::{null, null_mut};

use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_ALREADY_EXISTS, ERROR_NO_MORE_FILES, FILETIME, GetLastError, HANDLE,
    INVALID_HANDLE_VALUE, STILL_ACTIVE, WAIT_OBJECT_0,
};
use windows_sys::Win32::Security::Cryptography::{
    BCRYPT_ALG_HANDLE, BCRYPT_HASH_HANDLE, BCRYPT_SHA256_ALGORITHM, BCryptCloseAlgorithmProvider,
    BCryptCreateHash, BCryptDestroyHash, BCryptFinishHash, BCryptHashData,
    BCryptOpenAlgorithmProvider,
};
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_OPEN_REPARSE_POINT,
    FILE_SHARE_READ, GetFileInformationByHandle, GetFinalPathNameByHandleW,
};
use windows_sys::Win32::System::Diagnostics::ToolHelp::{
    CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW, TH32CS_SNAPPROCESS,
};
use windows_sys::Win32::System::SystemInformation::GetWindowsDirectoryW;
use windows_sys::Win32::System::Threading::{
    CREATE_UNICODE_ENVIRONMENT, CreateMutexW, CreateProcessW, GetExitCodeProcess, GetProcessTimes,
    OpenProcess, PROCESS_INFORMATION, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE,
    QueryFullProcessImageNameW, STARTUPINFOW, TerminateProcess, WaitForSingleObject,
};

const POLICY_BYTES: &[u8] =
    include_bytes!("../../coordinator/policies/windows-docker-desktop-4.41.2.policy");
const POLICY_MAGIC: &str = "CRDD_WINDOWS_DOCKER_DESKTOP_REPAIR_POLICY_V1";
const RESPONSE_MAGIC: &[u8; 8] = b"CRDDDR04";
const RESPONSE_BYTES: usize = 41;
const MAXIMUM_POLICY_BYTES: usize = 16_384;
const MAXIMUM_ARTIFACT_BYTES: u64 = 512 * 1024 * 1024;
const MAXIMUM_PROCESS_ENTRIES: usize = 4_096;
const PROCESS_WAIT_MS: u32 = 10_000;
const SYNCHRONIZE_ACCESS: u32 = 0x0010_0000;

struct OwnedHandle(HANDLE);

impl Drop for OwnedHandle {
    fn drop(&mut self) {
        if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
            // SAFETY: this type exclusively owns the valid Windows handle.
            unsafe { CloseHandle(self.0) };
        }
    }
}

struct OwnedAlgorithm(BCRYPT_ALG_HANDLE);

impl Drop for OwnedAlgorithm {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: this type exclusively owns the algorithm provider handle.
            unsafe { BCryptCloseAlgorithmProvider(self.0, 0) };
        }
    }
}

struct OwnedHash(BCRYPT_HASH_HANDLE);

impl Drop for OwnedHash {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: this type exclusively owns the hash handle.
            unsafe { BCryptDestroyHash(self.0) };
        }
    }
}

#[derive(Clone)]
struct PolicyArtifact {
    role: String,
    path: PathBuf,
    bytes: u64,
    sha256: [u8; 32],
}

struct LockedArtifact {
    policy: PolicyArtifact,
    file: File,
    information: BY_HANDLE_FILE_INFORMATION,
}

struct VerifiedProcess {
    handle: OwnedHandle,
    process_id: u32,
    creation: u64,
}

enum ProcessInventory {
    Absent,
    Verified(Vec<VerifiedProcess>),
    Unknown,
}

fn hex_nibble(value: u8) -> Option<u8> {
    match value {
        b'0'..=b'9' => Some(value - b'0'),
        b'A'..=b'F' => Some(value - b'A' + 10),
        _ => None,
    }
}

fn parse_sha256(value: &str) -> Option<[u8; 32]> {
    let bytes = value.as_bytes();
    if bytes.len() != 64 {
        return None;
    }
    let mut output = [0_u8; 32];
    for index in 0..32 {
        output[index] = (hex_nibble(bytes[index * 2])? << 4) | hex_nibble(bytes[index * 2 + 1])?;
    }
    Some(output)
}

fn parse_policy() -> Option<Vec<PolicyArtifact>> {
    if POLICY_BYTES.is_empty()
        || POLICY_BYTES.len() > MAXIMUM_POLICY_BYTES
        || !POLICY_BYTES.ends_with(b"\n")
        || POLICY_BYTES.contains(&b'\r')
        || POLICY_BYTES.contains(&0)
    {
        return None;
    }
    let source = std::str::from_utf8(POLICY_BYTES).ok()?;
    let mut lines = source.trim_end_matches('\n').split('\n');
    if lines.next()? != POLICY_MAGIC
        || lines.next()? != "version|4.41.2"
        || lines.next()? != "engine|28.1.1"
    {
        return None;
    }
    let expected_roles = [
        "docker_cli",
        "desktop_cli",
        "launcher",
        "frontend",
        "backend",
        "build",
        "dev_envs",
    ];
    let mut artifacts = Vec::with_capacity(expected_roles.len());
    for expected_role in expected_roles {
        let mut fields = lines.next()?.split('|');
        let role = fields.next()?;
        let path = fields.next()?;
        let bytes = fields.next()?.parse::<u64>().ok()?;
        let sha256 = parse_sha256(fields.next()?)?;
        if fields.next().is_some()
            || role != expected_role
            || !path.starts_with("C:\\")
            || path.contains('\0')
            || !(1..=MAXIMUM_ARTIFACT_BYTES).contains(&bytes)
        {
            return None;
        }
        artifacts.push(PolicyArtifact {
            role: role.to_owned(),
            path: PathBuf::from(path),
            bytes,
            sha256,
        });
    }
    if lines.next().is_some() {
        return None;
    }
    Some(artifacts)
}

fn begin_sha256() -> Option<(OwnedAlgorithm, OwnedHash)> {
    let mut algorithm = null_mut();
    // SAFETY: algorithm is writable and SHA-256 requires no provider-specific input.
    if unsafe { BCryptOpenAlgorithmProvider(&mut algorithm, BCRYPT_SHA256_ALGORITHM, null(), 0) }
        < 0
    {
        return None;
    }
    let algorithm = OwnedAlgorithm(algorithm);
    let mut hash = null_mut();
    // SAFETY: the algorithm handle is valid; object storage and secret are unused.
    if unsafe { BCryptCreateHash(algorithm.0, &mut hash, null_mut(), 0, null(), 0, 0) } < 0 {
        return None;
    }
    Some((algorithm, OwnedHash(hash)))
}

fn sha256_bytes(bytes: &[u8]) -> Option<[u8; 32]> {
    let (_algorithm, hash) = begin_sha256()?;
    let length = u32::try_from(bytes.len()).ok()?;
    // SAFETY: bytes remains readable for the duration of the synchronous call.
    if unsafe { BCryptHashData(hash.0, bytes.as_ptr(), length, 0) } < 0 {
        return None;
    }
    let mut output = [0_u8; 32];
    // SAFETY: output is a writable SHA-256-sized buffer.
    if unsafe { BCryptFinishHash(hash.0, output.as_mut_ptr(), 32, 0) } < 0 {
        return None;
    }
    Some(output)
}

fn sha256_file(file: &mut File, expected_bytes: u64) -> Option<[u8; 32]> {
    file.seek(SeekFrom::Start(0)).ok()?;
    let (_algorithm, hash) = begin_sha256()?;
    let mut total = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let count = file.read(&mut buffer).ok()?;
        if count == 0 {
            break;
        }
        total = total.checked_add(u64::try_from(count).ok()?)?;
        if total > expected_bytes {
            return None;
        }
        let length = u32::try_from(count).ok()?;
        // SAFETY: the initialized prefix remains readable for the duration of the call.
        if unsafe { BCryptHashData(hash.0, buffer.as_ptr(), length, 0) } < 0 {
            return None;
        }
    }
    if total != expected_bytes {
        return None;
    }
    let mut output = [0_u8; 32];
    // SAFETY: output is a writable SHA-256-sized buffer.
    if unsafe { BCryptFinishHash(hash.0, output.as_mut_ptr(), 32, 0) } < 0 {
        return None;
    }
    Some(output)
}

fn handle_information(handle: HANDLE) -> Option<BY_HANDLE_FILE_INFORMATION> {
    let mut information = BY_HANDLE_FILE_INFORMATION {
        dwFileAttributes: 0,
        ftCreationTime: FILETIME::default(),
        ftLastAccessTime: FILETIME::default(),
        ftLastWriteTime: FILETIME::default(),
        dwVolumeSerialNumber: 0,
        nFileSizeHigh: 0,
        nFileSizeLow: 0,
        nNumberOfLinks: 0,
        nFileIndexHigh: 0,
        nFileIndexLow: 0,
    };
    // SAFETY: handle remains valid and information is writable.
    (unsafe { GetFileInformationByHandle(handle, &mut information) } != 0).then_some(information)
}

fn same_file(left: &BY_HANDLE_FILE_INFORMATION, right: &BY_HANDLE_FILE_INFORMATION) -> bool {
    left.dwVolumeSerialNumber == right.dwVolumeSerialNumber
        && left.nFileIndexHigh == right.nFileIndexHigh
        && left.nFileIndexLow == right.nFileIndexLow
        && left.ftCreationTime.dwLowDateTime == right.ftCreationTime.dwLowDateTime
        && left.ftCreationTime.dwHighDateTime == right.ftCreationTime.dwHighDateTime
        && left.nFileSizeHigh == right.nFileSizeHigh
        && left.nFileSizeLow == right.nFileSizeLow
        && left.dwFileAttributes == right.dwFileAttributes
}

fn final_dos_path(handle: HANDLE) -> Option<PathBuf> {
    let mut units = vec![0_u16; 32_768];
    // SAFETY: units is writable and handle is valid for the duration of the call.
    let length = usize::try_from(unsafe {
        GetFinalPathNameByHandleW(handle, units.as_mut_ptr(), 32_768, 0)
    })
    .ok()?;
    if length < 7 || length >= units.len() {
        return None;
    }
    units.truncate(length);
    let value = OsString::from_wide(&units);
    let source = value.to_str()?;
    let stripped = source.strip_prefix(r"\\?\")?;
    Some(PathBuf::from(stripped))
}

fn filetime_value(value: FILETIME) -> u64 {
    (u64::from(value.dwHighDateTime) << 32) | u64::from(value.dwLowDateTime)
}

fn lock_artifacts(policy: &[PolicyArtifact]) -> Option<Vec<LockedArtifact>> {
    let mut result = Vec::with_capacity(policy.len());
    for entry in policy {
        let mut file = OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(&entry.path)
            .ok()?;
        let handle = file.as_raw_handle().cast::<c_void>();
        let information = handle_information(handle)?;
        let length =
            (u64::from(information.nFileSizeHigh) << 32) | u64::from(information.nFileSizeLow);
        if information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
            || length != entry.bytes
            || !final_dos_path(handle)?
                .to_string_lossy()
                .eq_ignore_ascii_case(&entry.path.to_string_lossy())
            || sha256_file(&mut file, entry.bytes)? != entry.sha256
        {
            return None;
        }
        let after = handle_information(handle)?;
        if !same_file(&information, &after) {
            return None;
        }
        result.push(LockedArtifact {
            policy: entry.clone(),
            file,
            information,
        });
    }
    Some(result)
}

fn verify_locked_artifacts(artifacts: &mut [LockedArtifact]) -> bool {
    artifacts.iter_mut().all(|artifact| {
        let handle = artifact.file.as_raw_handle().cast::<c_void>();
        let Some(current) = handle_information(handle) else {
            return false;
        };
        same_file(&artifact.information, &current)
            && final_dos_path(handle)
                .map(|value| {
                    value
                        .to_string_lossy()
                        .eq_ignore_ascii_case(&artifact.policy.path.to_string_lossy())
                })
                .unwrap_or(false)
            && sha256_file(&mut artifact.file, artifact.policy.bytes)
                .map(|value| value == artifact.policy.sha256)
                .unwrap_or(false)
            && handle_information(handle)
                .map(|value| same_file(&artifact.information, &value))
                .unwrap_or(false)
    })
}

fn mutex_name() -> Option<Vec<u16>> {
    let identity = crate::windows::current_selected_user_identity_hash()?;
    let mut text = String::from(r"Global\CRDD.Coordinator.DockerDesktopRepair.");
    for byte in &identity[..16] {
        text.push_str(&format!("{byte:02x}"));
    }
    let mut wide: Vec<u16> = OsStr::new(&text).encode_wide().collect();
    wide.push(0);
    Some(wide)
}

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

fn process_basename(entry: &PROCESSENTRY32W) -> Option<String> {
    let length = entry
        .szExeFile
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(entry.szExeFile.len());
    (length > 0).then(|| {
        OsString::from_wide(&entry.szExeFile[..length])
            .to_string_lossy()
            .into()
    })
}

fn managed_process_artifacts<'a>(
    name: &str,
    artifacts: &'a [LockedArtifact],
) -> Vec<&'a LockedArtifact> {
    artifacts
        .iter()
        .filter(|artifact| {
            !matches!(artifact.policy.role.as_str(), "docker_cli" | "desktop_cli")
                && artifact
                    .policy
                    .path
                    .file_name()
                    .map(|value| value.to_string_lossy().eq_ignore_ascii_case(name))
                    .unwrap_or(false)
        })
        .collect()
}

fn process_path(handle: HANDLE) -> Option<PathBuf> {
    let mut units = vec![0_u16; 32_768];
    let mut length = u32::try_from(units.len()).ok()?;
    // SAFETY: units and length are writable; handle remains valid during the call.
    if unsafe { QueryFullProcessImageNameW(handle, 0, units.as_mut_ptr(), &mut length) } == 0 {
        return None;
    }
    let length = usize::try_from(length).ok()?;
    if length == 0 || length >= units.len() {
        return None;
    }
    units.truncate(length);
    Some(PathBuf::from(OsString::from_wide(&units)))
}

fn process_creation(handle: HANDLE) -> Option<u64> {
    let mut creation = FILETIME::default();
    let mut exit = FILETIME::default();
    let mut kernel = FILETIME::default();
    let mut user = FILETIME::default();
    // SAFETY: all FILETIME outputs are writable and handle remains valid.
    if unsafe { GetProcessTimes(handle, &mut creation, &mut exit, &mut kernel, &mut user) } == 0 {
        return None;
    }
    Some(filetime_value(creation))
}

fn inventory_processes(artifacts: &[LockedArtifact]) -> ProcessInventory {
    // SAFETY: no process ID filter is used and the returned snapshot is owned below.
    let snapshot = unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) };
    if snapshot == INVALID_HANDLE_VALUE {
        return ProcessInventory::Unknown;
    }
    let snapshot = OwnedHandle(snapshot);
    let mut entry = PROCESSENTRY32W {
        dwSize: u32::try_from(size_of::<PROCESSENTRY32W>()).unwrap_or(0),
        ..unsafe { std::mem::zeroed() }
    };
    let mut observed = 0_usize;
    let mut processes = Vec::new();
    // SAFETY: entry is initialized with the required size and snapshot is valid.
    let mut has_entry = unsafe { Process32FirstW(snapshot.0, &mut entry) } != 0;
    while has_entry {
        observed += 1;
        if observed > MAXIMUM_PROCESS_ENTRIES {
            return ProcessInventory::Unknown;
        }
        let Some(name) = process_basename(&entry) else {
            return ProcessInventory::Unknown;
        };
        let candidates = managed_process_artifacts(&name, artifacts);
        if !candidates.is_empty() {
            // SAFETY: requested rights are bounded to identity observation, wait, and exact process termination.
            let handle = unsafe {
                OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_TERMINATE | SYNCHRONIZE_ACCESS,
                    0,
                    entry.th32ProcessID,
                )
            };
            if handle.is_null() {
                return ProcessInventory::Unknown;
            }
            let handle = OwnedHandle(handle);
            let Some(path) = process_path(handle.0) else {
                return ProcessInventory::Unknown;
            };
            let Some(artifact) = candidates.into_iter().find(|candidate| {
                path.to_string_lossy()
                    .eq_ignore_ascii_case(&candidate.policy.path.to_string_lossy())
            }) else {
                return ProcessInventory::Unknown;
            };
            let Some(creation) = process_creation(handle.0) else {
                return ProcessInventory::Unknown;
            };
            let file_write = filetime_value(artifact.information.ftLastWriteTime);
            let mut exit_code = 0_u32;
            // SAFETY: exit_code is writable and handle has query access.
            if creation < file_write
                || unsafe { GetExitCodeProcess(handle.0, &mut exit_code) } == 0
                || exit_code != u32::try_from(STILL_ACTIVE).unwrap_or(u32::MAX)
            {
                return ProcessInventory::Unknown;
            }
            processes.push(VerifiedProcess {
                handle,
                process_id: entry.th32ProcessID,
                creation,
            });
        }
        // SAFETY: entry remains writable and snapshot remains valid.
        has_entry = unsafe { Process32NextW(snapshot.0, &mut entry) } != 0;
    }
    // SAFETY: Process32NextW failed and GetLastError immediately observes why.
    if unsafe { GetLastError() } != ERROR_NO_MORE_FILES {
        return ProcessInventory::Unknown;
    }
    if processes.is_empty() {
        ProcessInventory::Absent
    } else {
        ProcessInventory::Verified(processes)
    }
}

fn terminate_processes(artifacts: &[LockedArtifact]) -> u8 {
    let processes = match inventory_processes(artifacts) {
        ProcessInventory::Absent => return b'A',
        ProcessInventory::Verified(value) => value,
        ProcessInventory::Unknown => return b'N',
    };
    let mut effect_issued = false;
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
        // SAFETY: handle has synchronize access and remains valid.
        if unsafe { WaitForSingleObject(process.handle.0, PROCESS_WAIT_MS) } != WAIT_OBJECT_0 {
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

fn exact_artifact<'a>(role: &str, artifacts: &'a [LockedArtifact]) -> Option<&'a LockedArtifact> {
    let mut matches = artifacts.iter().filter(|value| value.policy.role == role);
    let result = matches.next()?;
    matches.next().is_none().then_some(result)
}

fn append_environment_entry(environment: &mut Vec<u16>, name: &str, value: &OsStr) -> Option<()> {
    environment.extend(name.encode_utf16());
    environment.push(u16::from(b'='));
    environment.extend(value.encode_wide());
    environment.push(0);
    Some(())
}

struct LauncherContext {
    environment: Vec<u16>,
    current_directory: PathBuf,
}

fn launcher_context() -> Option<LauncherContext> {
    let local_app_data = crate::windows::local_app_data_path()?;
    let profile = crate::windows::user_profile_path()?;
    let roaming_app_data = crate::windows::roaming_app_data_path()?;
    let program_data = crate::windows::program_data_path()?;
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
        usize::try_from(unsafe { GetWindowsDirectoryW(windows.as_mut_ptr(), 32_768) }).ok()?;
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

fn write_response(writer: &mut impl Write, status: u8, policy_hash: &[u8; 32]) -> bool {
    let mut response = [0_u8; RESPONSE_BYTES];
    response[..8].copy_from_slice(RESPONSE_MAGIC);
    response[8] = status;
    response[9..].copy_from_slice(policy_hash);
    writer.write_all(&response).is_ok() && writer.flush().is_ok()
}

pub(crate) fn run(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    let Some(policy_hash) = sha256_bytes(POLICY_BYTES) else {
        return 2;
    };
    let Some(_mutex) = acquire_mutex() else {
        let _ = write_response(writer, b'L', &policy_hash);
        return 2;
    };
    let Some(policy) = parse_policy() else {
        let _ = write_response(writer, b'U', &policy_hash);
        return 2;
    };
    let Some(mut artifacts) = lock_artifacts(&policy) else {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn embedded_policy_is_strict_and_complete() {
        let policy = parse_policy().unwrap();
        assert_eq!(policy.len(), 7);
        assert_eq!(policy[0].role, "docker_cli");
        assert_eq!(policy[6].role, "dev_envs");
        assert!(POLICY_BYTES.len() < MAXIMUM_POLICY_BYTES);
    }

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
        let profile = crate::windows::user_profile_path().unwrap();
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
            crate::windows::roaming_app_data_path().unwrap().display()
        )));
        assert!(text.contains(&format!(
            "ProgramData={}\0",
            crate::windows::program_data_path().unwrap().display()
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

    #[test]
    fn launcher_context_is_observed_inside_real_child() {
        let executable = std::env::current_exe().unwrap();
        let arguments = OsString::from(format!(
            "\"{}\" --exact docker_repair::tests::launcher_child_context_probe --ignored",
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
        let observed_program_data = crate::windows::program_data_path().unwrap();
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
            std::fs::canonicalize(crate::windows::program_data_path().unwrap()).unwrap()
        );
    }

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
