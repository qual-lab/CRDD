#![cfg_attr(not(test), no_std)]
#![cfg_attr(not(test), no_main)]
#![cfg_attr(test, allow(dead_code))]

use core::ffi::c_void;
use core::mem::size_of;
#[cfg(not(test))]
use core::panic::PanicInfo;
use core::ptr::{null, null_mut};
use core::sync::atomic::{AtomicBool, AtomicU8, Ordering};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use windows_sys::Win32::Foundation::{FILETIME, SYSTEMTIME};
use windows_sys::Win32::Security::Isolation::DeriveAppContainerSidFromAppContainerName;
use windows_sys::Win32::Security::SECURITY_CAPABILITIES;
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateFileW, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES,
    FILE_SHARE_READ, GetDriveTypeW, GetFileInformationByHandle, OPEN_EXISTING,
};
use windows_sys::Win32::System::JobObjects::{
    CreateJobObjectW, JOB_OBJECT_LIMIT_ACTIVE_PROCESS, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
    JOBOBJECT_BASIC_ACCOUNTING_INFORMATION, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JobObjectBasicAccountingInformation, JobObjectExtendedLimitInformation,
    QueryInformationJobObject, SetInformationJobObject, TerminateJobObject,
};
use windows_sys::Win32::System::SystemInformation::GetSystemTime;
use windows_sys::Win32::System::Threading::{
    CreateProcessW, PROCESS_INFORMATION, QueryFullProcessImageNameW, ResumeThread, STARTUPINFOEXW,
    STARTUPINFOW,
};

#[path = "../native_bootstrap_core.rs"]
mod native_bootstrap_core;

type Handle = *mut c_void;
type Psid = *mut c_void;

const MAXIMUM_CODE_UNITS: usize = 32_767;
const INVALID_HANDLE: Handle = (-1_isize) as Handle;
const EXTENDED_STARTUPINFO_PRESENT: u32 = 0x0008_0000;
const CREATE_SUSPENDED: u32 = 0x0000_0004;
const CREATE_UNICODE_ENVIRONMENT: u32 = 0x0000_0400;
const ATTRIBUTE_SECURITY_CAPABILITIES: usize = 0x0002_0009;
const ATTRIBUTE_MITIGATION_POLICY: usize = 0x0002_0007;
const ATTRIBUTE_JOB_LIST: usize = 0x0002_000d;
const WORKER_MITIGATION_POLICY: u64 =
    (1_u64 << 32) | (1_u64 << 36) | (1_u64 << 52) | (1_u64 << 56) | (1_u64 << 60);
const MAXIMUM_REQUEST_BYTES: usize = 4_156;
const RESPONSE_BYTES: usize = 86;
const WORKER_TIMEOUT_MILLISECONDS: u32 = 15_000;
const PIPE_ACCESS_DUPLEX: u32 = 0x0000_0003;
const FILE_FLAG_FIRST_PIPE_INSTANCE: u32 = 0x0008_0000;
const PIPE_NOWAIT: u32 = 0x0000_0001;
const PIPE_TYPE_MESSAGE: u32 = 0x0000_0004;
const PIPE_READMODE_MESSAGE: u32 = 0x0000_0002;
const ERROR_PIPE_CONNECTED: u32 = 535;
const PIPE_SECURITY_SDDL: &[u8] = b"D:P(A;;GA;;;OW)(A;;GA;;;SY)(A;;GRGW;;;AC)S:(ML;;NW;;;LW)";
const HEAP_ZERO_MEMORY: u32 = 0x0000_0008;
const GENERIC_READ: u32 = 0x8000_0000;
const KEY_QUERY_VALUE: u32 = 0x0001;
const KEY_SET_VALUE: u32 = 0x0002;
const REG_BINARY: u32 = 3;
const REG_DWORD: u32 = 4;
const ERROR_FILE_NOT_FOUND: u32 = 2;
const WAIT_OBJECT_0: u32 = 0;
const WAIT_ABANDONED: u32 = 128;
const HKEY_CURRENT_USER: Handle = (-2_147_483_647_isize) as Handle;
const RECOVERY_RECORD_BYTES: usize = 64;

static mut WORKER_PATH: [u16; MAXIMUM_CODE_UNITS] = [0; MAXIMUM_CODE_UNITS];
static mut SUPERVISOR_PATH: [u16; MAXIMUM_CODE_UNITS] = [0; MAXIMUM_CODE_UNITS];
static mut MANIFEST_PATH: [u16; MAXIMUM_CODE_UNITS] = [0; MAXIMUM_CODE_UNITS];
static mut LOADED_IMAGE_PATH: [u16; MAXIMUM_CODE_UNITS] = [0; MAXIMUM_CODE_UNITS];
static mut WORKER_COMMAND_LINE: [u16; MAXIMUM_CODE_UNITS] = [0; MAXIMUM_CODE_UNITS];
static mut PIPE_NAME: [u16; 64] = [0; 64];
static mut SECURITY_DESCRIPTOR_SDDL: [u16; 64] = [0; 64];
static mut REQUEST_BUFFER: [u8; MAXIMUM_REQUEST_BYTES + 1] = [0; MAXIMUM_REQUEST_BYTES + 1];
static mut RESPONSE_BUFFER: [u8; RESPONSE_BYTES + 1] = [0; RESPONSE_BYTES + 1];
static mut FILE_HASH_BUFFER: [u8; 65_536] = [0; 65_536];
static mut MANIFEST_BUFFER: [u8; 128 * 1024 + 1] = [0; 128 * 1024 + 1];
static mut SIGNATURE_MESSAGE_BUFFER: [u8; 128 * 1024 + 128] = [0; 128 * 1024 + 128];
static mut LOCAL_APP_DATA_PATH: [u16; MAXIMUM_CODE_UNITS] = [0; MAXIMUM_CODE_UNITS];
static mut MINIMUM_ENVIRONMENT: [u16; MAXIMUM_CODE_UNITS + 16] = [0; MAXIMUM_CODE_UNITS + 16];
static FAILURE_STAGE: AtomicU8 = AtomicU8::new(0);
static MANUAL_RECOVERY_REQUIRED: AtomicBool = AtomicBool::new(false);
static REGISTRY_RECOVERY_REQUIRED: AtomicBool = AtomicBool::new(false);
#[used]
#[unsafe(link_section = ".rdata$CRDD")]
static WORKER_BINDING: &str = concat!("CRDD-WORKER-SHA256-V1:", env!("CRDD_NATIVE_WORKER_SHA256"));

#[repr(C)]
struct SecurityAttributes {
    length: u32,
    security_descriptor: *mut c_void,
    inherit_handle: i32,
}

#[repr(C)]
struct Guid {
    data1: u32,
    data2: u16,
    data3: u16,
    data4: [u8; 8],
}

#[repr(C)]
struct WintrustFileInfo {
    size: u32,
    file_path: *const u16,
    file: Handle,
    known_subject: *const Guid,
}

#[repr(C)]
struct WintrustData {
    size: u32,
    policy_callback_data: *mut c_void,
    sip_client_data: *mut c_void,
    ui_choice: u32,
    revocation_checks: u32,
    union_choice: u32,
    file_info: *const WintrustFileInfo,
    state_action: u32,
    state_data: Handle,
    url_reference: *const u16,
    provider_flags: u32,
    ui_context: u32,
    signature_settings: *mut c_void,
}

#[repr(C)]
struct FileTime {
    low: u32,
    high: u32,
}

#[repr(C)]
struct CryptProviderCert {
    size: u32,
    certificate: *const c_void,
}

#[repr(C)]
struct CryptProviderSigner {
    size: u32,
    verify_as_of: FileTime,
    certificate_count: u32,
    certificates: *const CryptProviderCert,
}

const _: () = {
    assert!(size_of::<WintrustFileInfo>() == 32);
    assert!(size_of::<WintrustData>() == 88);
    assert!(core::mem::offset_of!(WintrustData, file_info) == 40);
    assert!(core::mem::offset_of!(WintrustData, state_data) == 56);
    assert!(core::mem::offset_of!(CryptProviderCert, certificate) == 8);
    assert!(core::mem::offset_of!(CryptProviderSigner, certificates) == 16);
};

#[link(name = "kernel32")]
unsafe extern "system" {
    fn GetCommandLineW() -> *const u16;
    fn GetModuleFileNameW(module: Handle, filename: *mut u16, size: u32) -> u32;
    fn GetStdHandle(kind: u32) -> Handle;
    fn CreateNamedPipeW(
        name: *const u16,
        open_mode: u32,
        pipe_mode: u32,
        maximum_instances: u32,
        output_buffer_size: u32,
        input_buffer_size: u32,
        default_timeout: u32,
        attributes: *const SecurityAttributes,
    ) -> Handle;
    fn ConnectNamedPipe(pipe: Handle, overlapped: *mut c_void) -> i32;
    fn DisconnectNamedPipe(pipe: Handle) -> i32;
    fn GetNamedPipeClientProcessId(pipe: Handle, client_process_id: *mut u32) -> i32;
    fn GetLastError() -> u32;
    fn GetCurrentProcessId() -> u32;
    fn CreateMutexW(attributes: *const c_void, initial_owner: i32, name: *const u16) -> Handle;
    fn ReleaseMutex(mutex: Handle) -> i32;
    fn Sleep(milliseconds: u32);
    fn LocalFree(memory: *mut c_void) -> *mut c_void;
    fn GetProcessHeap() -> Handle;
    fn HeapAlloc(heap: Handle, flags: u32, bytes: usize) -> *mut c_void;
    fn HeapFree(heap: Handle, flags: u32, memory: *mut c_void) -> i32;
    fn ReadFile(
        file: Handle,
        buffer: *mut c_void,
        length: u32,
        read: *mut u32,
        overlapped: *mut c_void,
    ) -> i32;
    fn InitializeProcThreadAttributeList(
        list: *mut c_void,
        count: u32,
        flags: u32,
        size: *mut usize,
    ) -> i32;
    fn UpdateProcThreadAttribute(
        list: *mut c_void,
        flags: u32,
        attribute: usize,
        value: *const c_void,
        size: usize,
        previous: *mut c_void,
        return_size: *const usize,
    ) -> i32;
    fn DeleteProcThreadAttributeList(list: *mut c_void);
    fn WaitForSingleObject(handle: Handle, milliseconds: u32) -> u32;
    fn GetExitCodeProcess(handle: Handle, exit_code: *mut u32) -> i32;
    fn CloseHandle(handle: Handle) -> i32;
    fn WriteFile(
        file: Handle,
        buffer: *const c_void,
        length: u32,
        written: *mut u32,
        overlapped: *mut c_void,
    ) -> i32;
    fn ExitProcess(exit_code: u32) -> !;
}

#[link(name = "shell32")]
unsafe extern "system" {
    fn SHGetKnownFolderPath(
        folder_id: *const Guid,
        flags: u32,
        token: Handle,
        path: *mut *mut u16,
    ) -> i32;
}

#[link(name = "ole32")]
unsafe extern "system" {
    fn CoTaskMemFree(memory: *const c_void);
}

#[link(name = "wintrust")]
unsafe extern "system" {
    fn WinVerifyTrust(window: Handle, action: *const Guid, data: *mut WintrustData) -> i32;
    fn WTHelperProvDataFromStateData(state: Handle) -> *mut c_void;
    fn WTHelperGetProvSignerFromChain(
        provider_data: *mut c_void,
        signer_index: u32,
        counter_signer: i32,
        counter_signer_index: u32,
    ) -> *mut CryptProviderSigner;
}

#[link(name = "crypt32")]
unsafe extern "system" {
    fn CertGetCertificateContextProperty(
        certificate: *const c_void,
        property_id: u32,
        data: *mut c_void,
        data_bytes: *mut u32,
    ) -> i32;
}

#[link(name = "bcrypt")]
unsafe extern "system" {
    fn BCryptOpenAlgorithmProvider(
        algorithm: *mut Handle,
        algorithm_id: *const u16,
        implementation: *const u16,
        flags: u32,
    ) -> i32;
    fn BCryptGetProperty(
        object: Handle,
        property: *const u16,
        output: *mut u8,
        output_bytes: u32,
        result_bytes: *mut u32,
        flags: u32,
    ) -> i32;
    fn BCryptCreateHash(
        algorithm: Handle,
        hash: *mut Handle,
        hash_object: *mut u8,
        hash_object_bytes: u32,
        secret: *const u8,
        secret_bytes: u32,
        flags: u32,
    ) -> i32;
    fn BCryptHashData(hash: Handle, input: *const u8, input_bytes: u32, flags: u32) -> i32;
    fn BCryptFinishHash(hash: Handle, output: *mut u8, output_bytes: u32, flags: u32) -> i32;
    fn BCryptDestroyHash(hash: Handle) -> i32;
    fn BCryptCloseAlgorithmProvider(algorithm: Handle, flags: u32) -> i32;
}

#[link(name = "advapi32")]
unsafe extern "system" {
    fn FreeSid(sid: Psid) -> *mut c_void;
    fn ConvertStringSecurityDescriptorToSecurityDescriptorW(
        descriptor: *const u16,
        revision: u32,
        security_descriptor: *mut *mut c_void,
        security_descriptor_size: *mut u32,
    ) -> i32;
    fn RegOpenKeyExW(
        key: Handle,
        subkey: *const u16,
        options: u32,
        access: u32,
        result: *mut Handle,
    ) -> u32;
    fn RegCloseKey(key: Handle) -> u32;
    fn RegQueryValueExW(
        key: Handle,
        value_name: *const u16,
        reserved: *const u32,
        value_type: *mut u32,
        data: *mut u8,
        data_bytes: *mut u32,
    ) -> u32;
    fn RegSetValueExW(
        key: Handle,
        value_name: *const u16,
        reserved: u32,
        value_type: u32,
        data: *const u8,
        data_bytes: u32,
    ) -> u32;
    fn RegDeleteValueW(key: Handle, value_name: *const u16) -> u32;
    fn RegFlushKey(key: Handle) -> u32;
    fn RegQueryInfoKeyW(
        key: Handle,
        class: *mut u16,
        class_length: *mut u32,
        reserved: *const u32,
        subkeys: *mut u32,
        maximum_subkey_length: *mut u32,
        maximum_class_length: *mut u32,
        values: *mut u32,
        maximum_value_name_length: *mut u32,
        maximum_value_length: *mut u32,
        security_descriptor_length: *mut u32,
        last_write_time: *mut FILETIME,
    ) -> u32;
}

#[cfg(not(test))]
#[link(name = "vcruntime")]
unsafe extern "C" {}

#[cfg(not(test))]
#[unsafe(no_mangle)]
unsafe extern "C" fn memset(destination: *mut c_void, value: i32, count: usize) -> *mut c_void {
    // SAFETY: the linker calls this intrinsic only with a writable destination valid for `count`;
    // the loop neither retains the pointer nor reads beyond that caller-owned range.
    let bytes = destination.cast::<u8>();
    let mut offset = 0;
    while offset < count {
        unsafe { bytes.add(offset).write_volatile(value as u8) };
        offset += 1;
    }
    destination
}

#[cfg(not(test))]
#[unsafe(no_mangle)]
unsafe extern "C" fn memcpy(
    destination: *mut c_void,
    source: *const c_void,
    count: usize,
) -> *mut c_void {
    // SAFETY: the linker intrinsic contract supplies non-overlapping source and destination ranges
    // valid for `count`; neither pointer is retained after the volatile byte copy.
    let destination_bytes = destination.cast::<u8>();
    let source_bytes = source.cast::<u8>();
    let mut offset = 0;
    while offset < count {
        unsafe {
            destination_bytes
                .add(offset)
                .write_volatile(source_bytes.add(offset).read_volatile())
        };
        offset += 1;
    }
    destination
}

#[cfg(not(test))]
#[unsafe(no_mangle)]
unsafe extern "C" fn memcmp(left: *const c_void, right: *const c_void, count: usize) -> i32 {
    // SAFETY: compiler-generated calls provide two readable ranges of `count` bytes. The first
    // differing byte determines ordering and neither pointer escapes this function.
    let left = left.cast::<u8>();
    let right = right.cast::<u8>();
    let mut offset = 0;
    while offset < count {
        let left_byte = unsafe { left.add(offset).read_volatile() };
        let right_byte = unsafe { right.add(offset).read_volatile() };
        if left_byte != right_byte {
            return i32::from(left_byte) - i32::from(right_byte);
        }
        offset += 1;
    }
    0
}

unsafe fn command_line() -> Option<&'static [u16]> {
    // SAFETY: GetCommandLineW returns process-lifetime storage. Reads stop at its documented NUL
    // within the Windows maximum; the returned slice is immutable and releases no caller memory.
    let pointer = unsafe { GetCommandLineW() };
    if pointer.is_null() {
        return None;
    }
    let mut length = 0;
    while length < MAXIMUM_CODE_UNITS {
        if unsafe { *pointer.add(length) } == 0 {
            return Some(unsafe { core::slice::from_raw_parts(pointer, length) });
        }
        length += 1;
    }
    None
}

fn equal_windows_ascii(left: u16, right: u8) -> bool {
    let left = if (u16::from(b'A')..=u16::from(b'Z')).contains(&left) {
        left + 0x20
    } else {
        left
    };
    let right = if right.is_ascii_uppercase() {
        u16::from(right + 0x20)
    } else {
        u16::from(right)
    };
    left == right
}

fn append_ascii(buffer: &mut [u16], length: &mut usize, value: &[u8]) -> bool {
    if *length + value.len() + 1 > buffer.len() {
        return false;
    }
    for byte in value {
        buffer[*length] = u16::from(*byte);
        *length += 1;
    }
    buffer[*length] = 0;
    true
}

unsafe fn fixed_release_paths(
    supervisor: &mut [u16; MAXIMUM_CODE_UNITS],
    worker: &mut [u16; MAXIMUM_CODE_UNITS],
) -> Option<(usize, usize, usize)> {
    // SAFETY: GetModuleFileNameW writes at most the supplied capacity into caller-owned storage.
    // The module handle is null for the current image and no borrowed OS pointer escapes.
    const SUPERVISOR_SUFFIX: &[u8] =
        b"\\90_Release\\coordinator\\x86_64-pc-windows-msvc\\coordinator.exe";
    const WORKER_SUFFIX: &[u8] =
        b"\\90_Release\\platform-access\\x86_64-pc-windows-msvc\\crdd-platform-access.exe";
    let supervisor_length = unsafe {
        GetModuleFileNameW(
            null_mut(),
            supervisor.as_mut_ptr(),
            MAXIMUM_CODE_UNITS as u32,
        )
    } as usize;
    if supervisor_length <= SUPERVISOR_SUFFIX.len() || supervisor_length >= supervisor.len() {
        return None;
    }
    let suffix_start = supervisor_length - SUPERVISOR_SUFFIX.len();
    if !supervisor[suffix_start..supervisor_length]
        .iter()
        .zip(SUPERVISOR_SUFFIX)
        .all(|(left, right)| equal_windows_ascii(*left, *right))
    {
        return None;
    }
    worker[..suffix_start].copy_from_slice(&supervisor[..suffix_start]);
    let mut worker_length = suffix_start;
    if !append_ascii(worker, &mut worker_length, WORKER_SUFFIX) {
        return None;
    }
    Some((supervisor_length, worker_length, suffix_start))
}

fn append_decimal(buffer: &mut [u16], length: &mut usize, mut value: u32) -> bool {
    if value == 0 {
        return false;
    }
    let mut reversed = [0_u8; 10];
    let mut digits = 0;
    while value > 0 {
        reversed[digits] = b'0' + (value % 10) as u8;
        value /= 10;
        digits += 1;
    }
    if *length + digits + 1 > buffer.len() {
        return false;
    }
    while digits > 0 {
        digits -= 1;
        buffer[*length] = u16::from(reversed[digits]);
        *length += 1;
    }
    buffer[*length] = 0;
    true
}

fn fixed_pipe_name(pipe: &mut [u16], process_id: u32) -> Option<usize> {
    let mut length = 0;
    if !append_ascii(pipe, &mut length, b"\\\\.\\pipe\\LOCAL\\CRDD.Coordinator.")
        || !append_decimal(pipe, &mut length, process_id)
    {
        return None;
    }
    Some(length)
}

fn worker_command_line(
    path: &[u16],
    path_length: usize,
    pipe: &[u16],
    pipe_length: usize,
    command: &mut [u16],
) -> bool {
    const MODE: &[u8] = b" --appcontainer-pipe ";
    if path_length + pipe_length + MODE.len() + 3 > command.len() {
        return false;
    }
    command[0] = u16::from(b'"');
    let mut offset = 0;
    while offset < path_length {
        command[offset + 1] = path[offset];
        offset += 1;
    }
    command[path_length + 1] = u16::from(b'"');
    let mut length = path_length + 2;
    if !append_ascii(command, &mut length, MODE) {
        return false;
    }
    offset = 0;
    while offset < pipe_length {
        command[length] = pipe[offset];
        length += 1;
        offset += 1;
    }
    command[length] = 0;
    true
}

unsafe fn close_handles(handles: &[Handle]) {
    // SAFETY: every non-null, non-sentinel handle in this slice is uniquely owned by the caller and
    // is passed here exactly once on the selected cleanup path.
    for handle in handles {
        if !handle.is_null() && *handle != INVALID_HANDLE {
            unsafe { CloseHandle(*handle) };
        }
    }
}

fn same_file_identity(
    left: &BY_HANDLE_FILE_INFORMATION,
    right: &BY_HANDLE_FILE_INFORMATION,
) -> bool {
    left.dwVolumeSerialNumber == right.dwVolumeSerialNumber
        && left.nFileIndexHigh == right.nFileIndexHigh
        && left.nFileIndexLow == right.nFileIndexLow
}

fn equal_u16_exact(left: &[u16], right: &[u16]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut offset = 0;
    while offset < left.len() {
        // Volatile reads prevent the no-CRT release build from lowering slice equality to memcmp.
        if unsafe { left.as_ptr().add(offset).read_volatile() }
            != unsafe { right.as_ptr().add(offset).read_volatile() }
        {
            return false;
        }
        offset += 1;
    }
    true
}

fn equal_u8_exact(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut offset = 0;
    while offset < left.len() {
        if unsafe { left.as_ptr().add(offset).read_volatile() }
            != unsafe { right.as_ptr().add(offset).read_volatile() }
        {
            return false;
        }
        offset += 1;
    }
    true
}

unsafe fn open_non_link(
    path: *const u16,
    read_content: bool,
) -> Option<(Handle, BY_HANDLE_FILE_INFORMATION)> {
    // SAFETY: `path` identifies caller-owned NUL-terminated storage for the synchronous open. The
    // returned non-inheritable handle is uniquely transferred and no delete sharing is granted.
    let handle = unsafe {
        CreateFileW(
            path,
            FILE_READ_ATTRIBUTES | if read_content { GENERIC_READ } else { 0 },
            FILE_SHARE_READ,
            null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    if handle.is_null() || handle == INVALID_HANDLE {
        return None;
    }
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    if unsafe { GetFileInformationByHandle(handle, &mut information) } == 0
        || information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
    {
        unsafe { CloseHandle(handle) };
        return None;
    }
    Some((handle, information))
}

unsafe fn lock_local_path_chain(
    path: &mut [u16],
    length: usize,
    distribution_root_length: usize,
    handles: &mut [Handle],
    count: &mut usize,
) -> Option<BY_HANDLE_FILE_INFORMATION> {
    // SAFETY: the caller exclusively owns the mutable NUL-terminated path and handle array. Each
    // temporary terminator is restored before return; every accepted object stays open without
    // delete sharing until the caller closes the accumulated handles.
    if length >= path.len()
        || distribution_root_length < 3
        || distribution_root_length >= length
        || path.get(1) != Some(&u16::from(b':'))
        || path.get(2) != Some(&u16::from(b'\\'))
    {
        return None;
    }
    let volume = [path[0], u16::from(b':'), u16::from(b'\\'), 0];
    if unsafe { GetDriveTypeW(volume.as_ptr()) } != 3 {
        return None;
    }
    let mut boundary = 3;
    loop {
        if *count >= handles.len() {
            return None;
        }
        let saved = path[boundary];
        path[boundary] = 0;
        let opened = unsafe { open_non_link(path.as_ptr(), boundary == length) };
        path[boundary] = saved;
        let (handle, information) = opened?;
        handles[*count] = handle;
        *count += 1;
        if boundary == length {
            return Some(information);
        }
        boundary += 1;
        while boundary < length && path[boundary] != u16::from(b'\\') {
            boundary += 1;
        }
    }
}

unsafe fn loaded_image_matches(
    process: Handle,
    expected_path: &[u16],
    expected_length: usize,
    expected_identity: &BY_HANDLE_FILE_INFORMATION,
) -> bool {
    // SAFETY: the suspended process handle remains borrowed and open. Windows writes only into the
    // exclusive static path buffer; the loaded image handle is closed before this function returns.
    let loaded = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut LOADED_IMAGE_PATH).cast::<u16>(),
            MAXIMUM_CODE_UNITS,
        )
    };
    let mut length = MAXIMUM_CODE_UNITS as u32;
    if unsafe { QueryFullProcessImageNameW(process, 0, loaded.as_mut_ptr(), &mut length) } == 0
        || length as usize != expected_length
        || !equal_u16_exact(
            &loaded[..expected_length],
            &expected_path[..expected_length],
        )
    {
        return false;
    }
    loaded[expected_length] = 0;
    let Some((handle, identity)) = (unsafe { open_non_link(loaded.as_ptr(), false) }) else {
        return false;
    };
    let matches = same_file_identity(expected_identity, &identity);
    unsafe { CloseHandle(handle) };
    matches
}

fn decode_hex_32(encoded: &[u8]) -> Option<[u8; 32]> {
    if encoded.len() != 64 {
        return None;
    }
    let mut digest = [0_u8; 32];
    let mut offset = 0;
    while offset < digest.len() {
        let nibble = |value: u8| match value {
            b'0'..=b'9' => Some(value - b'0'),
            b'a'..=b'f' => Some(value - b'a' + 10),
            _ => None,
        };
        digest[offset] = nibble(encoded[offset * 2])? << 4 | nibble(encoded[offset * 2 + 1])?;
        offset += 1;
    }
    Some(digest)
}

fn decode_expected_worker_sha256() -> Option<[u8; 32]> {
    decode_hex_32(WORKER_BINDING.as_bytes().get(22..)?)
}

fn decode_expected_authenticode_signer_sha256() -> Option<[u8; 32]> {
    decode_hex_32(option_env!("CRDD_AUTHENTICODE_SIGNER_SHA256")?.as_bytes())
}

unsafe fn file_sha256(file: Handle) -> Option<[u8; 32]> {
    // SAFETY: the file handle is the uniquely held, non-reparse worker opened at offset zero. CNG
    // objects and heap storage have single owners and are released after all synchronous calls.
    const SHA256_ALGORITHM: &[u16] = &[83, 72, 65, 50, 53, 54, 0];
    const OBJECT_LENGTH: &[u16] = &[79, 98, 106, 101, 99, 116, 76, 101, 110, 103, 116, 104, 0];
    let mut algorithm = null_mut();
    if unsafe { BCryptOpenAlgorithmProvider(&mut algorithm, SHA256_ALGORITHM.as_ptr(), null(), 0) }
        < 0
        || algorithm.is_null()
    {
        return None;
    }
    let mut object_bytes = 0_u32;
    let mut returned = 0_u32;
    if unsafe {
        BCryptGetProperty(
            algorithm,
            OBJECT_LENGTH.as_ptr(),
            (&raw mut object_bytes).cast(),
            size_of::<u32>() as u32,
            &mut returned,
            0,
        )
    } < 0
        || returned as usize != size_of::<u32>()
        || object_bytes == 0
    {
        unsafe { BCryptCloseAlgorithmProvider(algorithm, 0) };
        return None;
    }
    let heap = unsafe { GetProcessHeap() };
    let object = unsafe { HeapAlloc(heap, HEAP_ZERO_MEMORY, object_bytes as usize) }.cast::<u8>();
    let mut hash = null_mut();
    if object.is_null()
        || unsafe { BCryptCreateHash(algorithm, &mut hash, object, object_bytes, null(), 0, 0) } < 0
        || hash.is_null()
    {
        if !object.is_null() {
            unsafe { HeapFree(heap, 0, object.cast()) };
        }
        unsafe { BCryptCloseAlgorithmProvider(algorithm, 0) };
        return None;
    }
    let buffer = unsafe {
        core::slice::from_raw_parts_mut((&raw mut FILE_HASH_BUFFER).cast::<u8>(), 65_536)
    };
    let mut valid = true;
    loop {
        let mut read = 0;
        if unsafe {
            ReadFile(
                file,
                buffer.as_mut_ptr().cast(),
                buffer.len() as u32,
                &mut read,
                null_mut(),
            )
        } == 0
        {
            valid = false;
            break;
        }
        if read == 0 {
            break;
        }
        if read as usize > buffer.len()
            || unsafe { BCryptHashData(hash, buffer.as_ptr(), read, 0) } < 0
        {
            valid = false;
            break;
        }
    }
    let mut actual = [0_u8; 32];
    if !valid || unsafe { BCryptFinishHash(hash, actual.as_mut_ptr(), actual.len() as u32, 0) } < 0
    {
        valid = false;
    }
    unsafe { BCryptDestroyHash(hash) };
    unsafe { HeapFree(heap, 0, object.cast()) };
    unsafe { BCryptCloseAlgorithmProvider(algorithm, 0) };
    valid.then_some(actual)
}

fn file_size(information: &BY_HANDLE_FILE_INFORMATION) -> u64 {
    (u64::from(information.nFileSizeHigh) << 32) | u64::from(information.nFileSizeLow)
}

fn find_once(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    let first = haystack
        .windows(needle.len())
        .position(|part| part == needle)?;
    (!haystack[first + needle.len()..]
        .windows(needle.len())
        .any(|part| part == needle))
    .then_some(first)
}

fn decode_base64url_64(encoded: &[u8]) -> Option<[u8; 64]> {
    if encoded.len() != 86 {
        return None;
    }
    let value = |byte: u8| match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'-' => Some(62),
        b'_' => Some(63),
        _ => None,
    };
    let mut output = [0_u8; 64];
    let mut input = 0;
    let mut written = 0;
    let mut accumulator = 0_u32;
    let mut bits = 0_u8;
    while input < encoded.len() {
        accumulator = (accumulator << 6) | u32::from(value(encoded[input])?);
        bits += 6;
        input += 1;
        while bits >= 8 {
            bits -= 8;
            if written >= output.len() {
                return None;
            }
            output[written] = (accumulator >> bits) as u8;
            written += 1;
            accumulator &= (1_u32 << bits) - 1;
        }
    }
    (written == output.len() && bits == 4 && accumulator == 0).then_some(output)
}

fn consume_literal(bytes: &[u8], cursor: &mut usize, literal: &[u8]) -> bool {
    let Some(value) = bytes.get(*cursor..cursor.saturating_add(literal.len())) else {
        return false;
    };
    if !equal_u8_exact(value, literal) {
        return false;
    }
    *cursor += literal.len();
    true
}

fn consume_quoted<'a>(bytes: &'a [u8], cursor: &mut usize, prefix: &[u8]) -> Option<&'a [u8]> {
    if !consume_literal(bytes, cursor, prefix) {
        return None;
    }
    let start = *cursor;
    while *cursor < bytes.len() && bytes[*cursor] != b'"' {
        if bytes[*cursor] < 0x20 || bytes[*cursor] == b'\\' {
            return None;
        }
        *cursor += 1;
    }
    let value = bytes.get(start..*cursor)?;
    if !consume_literal(bytes, cursor, b"\"") {
        return None;
    }
    Some(value)
}

fn consume_decimal(bytes: &[u8], cursor: &mut usize, maximum: u64) -> Option<u64> {
    let start = *cursor;
    let mut value = 0_u64;
    while let Some(byte) = bytes.get(*cursor).copied().filter(u8::is_ascii_digit) {
        if *cursor != start && bytes[start] == b'0' {
            return None;
        }
        value = value.checked_mul(10)?.checked_add(u64::from(byte - b'0'))?;
        if value > maximum {
            return None;
        }
        *cursor += 1;
    }
    (*cursor > start).then_some(value)
}

fn exact_lower_hex(value: &[u8], lengths: &[usize]) -> bool {
    lengths.contains(&value.len())
        && value
            .iter()
            .all(|byte| byte.is_ascii_digit() || matches!(*byte, b'a'..=b'f'))
}

fn exact_version(value: &[u8], crdd: bool) -> bool {
    let value = if crdd {
        let Some(rest) = value.strip_prefix(b"v") else {
            return false;
        };
        rest
    } else {
        value
    };
    if value.is_empty() || value.len() > 95 {
        return false;
    }
    let mut dots = 0_u8;
    let mut in_suffix = false;
    let mut segment_start = true;
    for byte in value {
        match *byte {
            b'0'..=b'9' if !in_suffix => segment_start = false,
            b'.' if !in_suffix && !segment_start && dots < 2 => {
                dots += 1;
                segment_start = true;
            }
            b'-' if !in_suffix && dots == 2 && !segment_start => in_suffix = true,
            b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z' | b'.' | b'-' if in_suffix => {}
            _ => return false,
        }
    }
    dots == 2 && !segment_start && (!in_suffix || value.last() != Some(&b'-'))
}

fn leap_year(year: u16) -> bool {
    year.is_multiple_of(4) && (!year.is_multiple_of(100) || year.is_multiple_of(400))
}

fn decimal_at(value: &[u8], offset: usize, length: usize) -> Option<u16> {
    let mut result = 0_u16;
    for byte in value.get(offset..offset + length)? {
        result = result
            .checked_mul(10)?
            .checked_add(u16::from(byte.checked_sub(b'0')?))?;
        if *byte > b'9' {
            return None;
        }
    }
    Some(result)
}

fn canonical_utc(value: &[u8]) -> bool {
    if value.len() != 24
        || value[4] != b'-'
        || value[7] != b'-'
        || value[10] != b'T'
        || value[13] != b':'
        || value[16] != b':'
        || value[19] != b'.'
        || value[23] != b'Z'
    {
        return false;
    }
    let Some(year) = decimal_at(value, 0, 4) else {
        return false;
    };
    let Some(month) = decimal_at(value, 5, 2) else {
        return false;
    };
    let Some(day) = decimal_at(value, 8, 2) else {
        return false;
    };
    let Some(hour) = decimal_at(value, 11, 2) else {
        return false;
    };
    let Some(minute) = decimal_at(value, 14, 2) else {
        return false;
    };
    let Some(second) = decimal_at(value, 17, 2) else {
        return false;
    };
    if decimal_at(value, 20, 3).is_none() || year == 0 || !(1..=12).contains(&month) {
        return false;
    }
    let maximum_day = match month {
        2 if leap_year(year) => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    };
    (1..=maximum_day).contains(&day) && hour < 24 && minute < 60 && second < 60
}

fn put_decimal_fixed(output: &mut [u8], offset: usize, length: usize, mut value: u16) {
    let mut index = offset + length;
    while index > offset {
        index -= 1;
        output[index] = b'0' + (value % 10) as u8;
        value /= 10;
    }
}

unsafe fn current_canonical_utc() -> [u8; 24] {
    // SAFETY: GetSystemTime initializes the exclusive stack SYSTEMTIME synchronously.
    let mut system = SYSTEMTIME::default();
    unsafe { GetSystemTime(&raw mut system) };
    let mut output = *b"0000-00-00T00:00:00.000Z";
    put_decimal_fixed(&mut output, 0, 4, system.wYear);
    put_decimal_fixed(&mut output, 5, 2, system.wMonth);
    put_decimal_fixed(&mut output, 8, 2, system.wDay);
    put_decimal_fixed(&mut output, 11, 2, system.wHour);
    put_decimal_fixed(&mut output, 14, 2, system.wMinute);
    put_decimal_fixed(&mut output, 17, 2, system.wSecond);
    put_decimal_fixed(&mut output, 20, 3, system.wMilliseconds);
    output
}

fn filetime_value(value: &FILETIME) -> u64 {
    (u64::from(value.dwHighDateTime) << 32) | u64::from(value.dwLowDateTime)
}

unsafe fn registry_last_write(key: Handle) -> Option<u64> {
    // SAFETY: `key` remains open and borrowed while RegQueryInfoKeyW writes only the stack FILETIME.
    let mut value = FILETIME::default();
    (unsafe {
        RegQueryInfoKeyW(
            key,
            null_mut(),
            null_mut(),
            null(),
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            &mut value,
        )
    } == 0)
        .then(|| filetime_value(&value))
}

unsafe fn registry_dword(key: Handle, name: *const u16) -> Option<Option<u32>> {
    // SAFETY: `key` and the NUL-terminated name remain borrowed; Windows writes at most four bytes.
    let mut value_type = 0_u32;
    let mut data = [0_u8; 4];
    let mut bytes = data.len() as u32;
    let result = unsafe {
        RegQueryValueExW(
            key,
            name,
            null(),
            &mut value_type,
            data.as_mut_ptr(),
            &mut bytes,
        )
    };
    if result == ERROR_FILE_NOT_FOUND {
        return Some(None);
    }
    if result != 0 || value_type != REG_DWORD || bytes != 4 {
        return None;
    }
    Some(Some(u32::from_le_bytes(data)))
}

unsafe fn registry_binary_equals(key: Handle, name: *const u16, expected: &[u8]) -> bool {
    // SAFETY: the fixed stack buffer is at least as large as the expected bounded record and the
    // borrowed key/name remain valid through the synchronous query.
    if expected.len() > RECOVERY_RECORD_BYTES {
        return false;
    }
    let mut value_type = 0_u32;
    let mut data = [0_u8; RECOVERY_RECORD_BYTES];
    let mut bytes = data.len() as u32;
    (unsafe {
        RegQueryValueExW(
            key,
            name,
            null(),
            &mut value_type,
            data.as_mut_ptr(),
            &mut bytes,
        )
    }) == 0
        && value_type == REG_BINARY
        && bytes as usize == expected.len()
        && equal_u8_exact(&data[..expected.len()], expected)
}

unsafe fn registry_value_is_absent(key: Handle, name: *const u16) -> bool {
    // SAFETY: the borrowed key/name remain valid for the synchronous existence query. No value
    // data is requested or exposed.
    let mut value_type = 0_u32;
    let mut bytes = 0_u32;
    (unsafe { RegQueryValueExW(key, name, null(), &mut value_type, null_mut(), &mut bytes) })
        == ERROR_FILE_NOT_FOUND
}

fn recovery_record(
    phase: u8,
    preexisting: bool,
    pre_value: u32,
    pre_last_write: u64,
    post_last_write: u64,
) -> [u8; RECOVERY_RECORD_BYTES] {
    let mut record = [0_u8; RECOVERY_RECORD_BYTES];
    record[..8].copy_from_slice(b"CRDDLR01");
    record[8] = phase;
    record[9] = u8::from(preexisting);
    record[12..16].copy_from_slice(&pre_value.to_le_bytes());
    record[16..24].copy_from_slice(&pre_last_write.to_le_bytes());
    record[24..32].copy_from_slice(&post_last_write.to_le_bytes());
    record[32..36].copy_from_slice(&unsafe { GetCurrentProcessId() }.to_le_bytes());
    record[36..60].copy_from_slice(&unsafe { current_canonical_utc() });
    record
}

fn registry_restore_is_owned(
    observed_value: Option<Option<u32>>,
    observed_last_write: Option<u64>,
    expected_last_write: u64,
) -> bool {
    observed_value == Some(Some(1)) && observed_last_write == Some(expected_last_write)
}

struct LowBoxRegistryEffect {
    mutex: Handle,
    console: Handle,
    software: Handle,
    value_name: [u16; 21],
    record_name: [u16; 54],
    preexisting: bool,
    pre_value: u32,
    post_last_write: u64,
    record_written: bool,
    effect_applied: bool,
    closed: bool,
}

impl LowBoxRegistryEffect {
    unsafe fn restore(&mut self) -> bool {
        // SAFETY: all three handles remain uniquely owned until this method closes them. Restoration
        // occurs only when the target value and target-key last-write observation still match the
        // exact state written by this invocation.
        if self.closed {
            return true;
        }
        let mut restored = true;
        if self.effect_applied {
            restored = registry_restore_is_owned(
                unsafe { registry_dword(self.console, self.value_name.as_ptr()) },
                unsafe { registry_last_write(self.console) },
                self.post_last_write,
            );
            if restored {
                let result = if self.preexisting {
                    unsafe {
                        RegSetValueExW(
                            self.console,
                            self.value_name.as_ptr(),
                            0,
                            REG_DWORD,
                            self.pre_value.to_le_bytes().as_ptr(),
                            4,
                        )
                    }
                } else {
                    unsafe { RegDeleteValueW(self.console, self.value_name.as_ptr()) }
                };
                restored = result == 0
                    && unsafe { registry_dword(self.console, self.value_name.as_ptr()) }
                        == Some(if self.preexisting {
                            Some(self.pre_value)
                        } else {
                            None
                        })
                    && unsafe { RegFlushKey(self.console) } == 0;
            }
        }
        if restored && self.record_written {
            restored = unsafe { RegDeleteValueW(self.software, self.record_name.as_ptr()) } == 0
                && unsafe { registry_value_is_absent(self.software, self.record_name.as_ptr()) }
                && unsafe { RegFlushKey(self.software) } == 0;
        }
        if !restored {
            MANUAL_RECOVERY_REQUIRED.store(true, Ordering::Relaxed);
            REGISTRY_RECOVERY_REQUIRED.store(true, Ordering::Relaxed);
        }
        unsafe {
            RegCloseKey(self.console);
            RegCloseKey(self.software);
            ReleaseMutex(self.mutex);
            CloseHandle(self.mutex);
        }
        self.closed = true;
        restored
    }
}

impl Drop for LowBoxRegistryEffect {
    fn drop(&mut self) {
        if !self.closed {
            unsafe { self.restore() };
        }
    }
}

unsafe fn begin_lowbox_registry_effect() -> Option<LowBoxRegistryEffect> {
    // SAFETY: the fixed CurrentUser mutex serializes cooperating provision invocations. Registry
    // handles are non-inheritable and uniquely owned by the returned guard through verified restore.
    let mut mutex_name = [0_u16; 64];
    let mut mutex_name_length = 0;
    if !append_ascii(
        &mut mutex_name,
        &mut mutex_name_length,
        b"Local\\QualLab.CRDD.Coordinator.Provision.V1",
    ) {
        return None;
    }
    let mutex = unsafe { CreateMutexW(null(), 0, mutex_name.as_ptr()) };
    if mutex.is_null() || mutex == INVALID_HANDLE {
        return None;
    }
    let wait = unsafe { WaitForSingleObject(mutex, 0) };
    if wait != WAIT_OBJECT_0 && wait != WAIT_ABANDONED {
        unsafe { CloseHandle(mutex) };
        return None;
    }

    let mut console_name = [0_u16; 8];
    let mut console_name_length = 0;
    let mut software_name = [0_u16; 9];
    let mut software_name_length = 0;
    let mut value_name = [0_u16; 21];
    let mut value_name_length = 0;
    let mut record_name = [0_u16; 54];
    let mut record_name_length = 0;
    if !append_ascii(&mut console_name, &mut console_name_length, b"Console")
        || !append_ascii(&mut software_name, &mut software_name_length, b"Software")
        || !append_ascii(
            &mut value_name,
            &mut value_name_length,
            b"LowBoxConsoleEnabled",
        )
        || !append_ascii(
            &mut record_name,
            &mut record_name_length,
            b"QualLab.CRDD.Coordinator.ProvisionRecoveryV1",
        )
    {
        unsafe {
            ReleaseMutex(mutex);
            CloseHandle(mutex);
        }
        return None;
    }
    let mut console = null_mut();
    let mut software = null_mut();
    if unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            console_name.as_ptr(),
            0,
            KEY_QUERY_VALUE | KEY_SET_VALUE,
            &mut console,
        )
    } != 0
        || unsafe {
            RegOpenKeyExW(
                HKEY_CURRENT_USER,
                software_name.as_ptr(),
                0,
                KEY_QUERY_VALUE | KEY_SET_VALUE,
                &mut software,
            )
        } != 0
    {
        unsafe {
            if !console.is_null() {
                RegCloseKey(console);
            }
            if !software.is_null() {
                RegCloseKey(software);
            }
            ReleaseMutex(mutex);
            CloseHandle(mutex);
        }
        return None;
    }
    let mut existing_record_type = 0_u32;
    let mut existing_record_bytes = 0_u32;
    let existing_record = unsafe {
        RegQueryValueExW(
            software,
            record_name.as_ptr(),
            null(),
            &mut existing_record_type,
            null_mut(),
            &mut existing_record_bytes,
        )
    };
    if existing_record != ERROR_FILE_NOT_FOUND {
        MANUAL_RECOVERY_REQUIRED.store(true, Ordering::Relaxed);
        REGISTRY_RECOVERY_REQUIRED.store(true, Ordering::Relaxed);
        unsafe {
            RegCloseKey(console);
            RegCloseKey(software);
            ReleaseMutex(mutex);
            CloseHandle(mutex);
        }
        return None;
    }
    let (Some(pre), Some(pre_last_write)) = (
        unsafe { registry_dword(console, value_name.as_ptr()) },
        unsafe { registry_last_write(console) },
    ) else {
        unsafe {
            RegCloseKey(console);
            RegCloseKey(software);
            ReleaseMutex(mutex);
            CloseHandle(mutex);
        }
        return None;
    };
    let preexisting = pre.is_some();
    let pre_value = pre.unwrap_or(0);
    let mut effect = LowBoxRegistryEffect {
        mutex,
        console,
        software,
        value_name,
        record_name,
        preexisting,
        pre_value,
        post_last_write: pre_last_write,
        record_written: false,
        effect_applied: false,
        closed: false,
    };
    if pre == Some(1) {
        return Some(effect);
    }
    let prepared = recovery_record(1, preexisting, pre_value, pre_last_write, 0);
    let record_set = unsafe {
        RegSetValueExW(
            software,
            effect.record_name.as_ptr(),
            0,
            REG_BINARY,
            prepared.as_ptr(),
            prepared.len() as u32,
        )
    } == 0;
    effect.record_written = record_set;
    if !record_set
        || !unsafe { registry_binary_equals(software, effect.record_name.as_ptr(), &prepared) }
        || unsafe { RegFlushKey(software) } != 0
    {
        unsafe { effect.restore() };
        return None;
    }
    let enabled = 1_u32.to_le_bytes();
    if unsafe {
        RegSetValueExW(
            console,
            effect.value_name.as_ptr(),
            0,
            REG_DWORD,
            enabled.as_ptr(),
            enabled.len() as u32,
        )
    } != 0
    {
        unsafe { effect.restore() };
        return None;
    }
    effect.effect_applied = true;
    effect.post_last_write = unsafe { registry_last_write(console) }?;
    if unsafe { registry_dword(console, effect.value_name.as_ptr()) } != Some(Some(1)) {
        unsafe { effect.restore() };
        return None;
    }
    let applied = recovery_record(
        2,
        preexisting,
        pre_value,
        pre_last_write,
        effect.post_last_write,
    );
    if unsafe {
        RegSetValueExW(
            software,
            effect.record_name.as_ptr(),
            0,
            REG_BINARY,
            applied.as_ptr(),
            applied.len() as u32,
        )
    } != 0
        || !unsafe { registry_binary_equals(software, effect.record_name.as_ptr(), &applied) }
        || unsafe { RegFlushKey(software) } != 0
    {
        unsafe { effect.restore() };
        return None;
    }
    Some(effect)
}

unsafe fn local_app_data_environment() -> Option<(usize, usize)> {
    // SAFETY: SHGetKnownFolderPath returns COM task memory owned until CoTaskMemFree. The path is
    // copied into exclusive static storage before release and bounded before environment assembly.
    let folder_id_local_app_data = Guid {
        data1: 0xf1b32785,
        data2: 0x6fba,
        data3: 0x4fcf,
        data4: [0x9d, 0x55, 0x7b, 0x8e, 0x7f, 0x15, 0x70, 0x91],
    };
    let mut raw_path = null_mut();
    if unsafe {
        SHGetKnownFolderPath(
            &raw const folder_id_local_app_data,
            0,
            null_mut(),
            &mut raw_path,
        )
    } != 0
        || raw_path.is_null()
    {
        return None;
    }
    let path = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut LOCAL_APP_DATA_PATH).cast::<u16>(),
            MAXIMUM_CODE_UNITS,
        )
    };
    let mut path_length = 0;
    while path_length < path.len() && unsafe { *raw_path.add(path_length) } != 0 {
        path[path_length] = unsafe { *raw_path.add(path_length) };
        path_length += 1;
    }
    unsafe { CoTaskMemFree(raw_path.cast()) };
    if path_length < 4
        || path_length >= path.len()
        || path[1] != u16::from(b':')
        || path[2] != u16::from(b'\\')
    {
        return None;
    }
    path[path_length] = 0;
    let environment = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut MINIMUM_ENVIRONMENT).cast::<u16>(),
            MAXIMUM_CODE_UNITS + 16,
        )
    };
    let mut environment_length = 0;
    if !append_ascii(environment, &mut environment_length, b"LOCALAPPDATA=")
        || environment_length + path_length + 1 >= environment.len()
    {
        return None;
    }
    environment[environment_length..environment_length + path_length]
        .copy_from_slice(&path[..path_length]);
    environment_length += path_length;
    environment[environment_length] = 0;
    environment[environment_length + 1] = 0;
    Some((path_length, environment_length + 2))
}

fn consume_artifact(
    payload: &[u8],
    cursor: &mut usize,
    prefix: &[u8],
    middle: &[u8],
    expected_size: u64,
    expected_hash: &[u8; 32],
) -> bool {
    if !consume_literal(payload, cursor, prefix)
        || consume_decimal(payload, cursor, 512 * 1024 * 1024) != Some(expected_size)
        || !consume_literal(payload, cursor, middle)
    {
        return false;
    }
    let Some(hash_text) = payload.get(*cursor..cursor.saturating_add(64)) else {
        return false;
    };
    let Some(hash) = decode_hex_32(hash_text) else {
        return false;
    };
    *cursor += 64;
    equal_u8_exact(&hash, expected_hash)
        && consume_literal(
            payload,
            cursor,
            b"\",\"target\":\"x86_64-pc-windows-msvc\"}",
        )
}

fn exact_manifest_payload(
    payload: &[u8],
    supervisor_size: u64,
    supervisor_hash: &[u8; 32],
    worker_size: u64,
    worker_hash: &[u8; 32],
    now: &[u8; 24],
) -> bool {
    const PREFIX: &[u8] = b"{\"contract\":\"crdd-coordinator/platform-provisioner-package-manifest\",\"contractRevision\":2,";
    const NATIVE_PREFIX: &[u8] = b"\"nativeProvisionSupervisorArtifact\":{\"byteLength\":";
    const NATIVE_MIDDLE: &[u8] = b",\"entrypointContractRevision\":2,\"relativePath\":\"90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe\",\"rustToolchain\":\"1.94.1\",\"sha256\":\"";
    const WORKER_PREFIX: &[u8] = b"\"platformAccessArtifact\":{\"byteLength\":";
    const WORKER_MIDDLE: &[u8] = b",\"protocolRevision\":3,\"relativePath\":\"90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe\",\"rustToolchain\":\"1.94.1\",\"sha256\":\"";
    let mut cursor = 0_usize;
    if !consume_literal(payload, &mut cursor, PREFIX) {
        return false;
    }
    let Some(commit) = consume_quoted(payload, &mut cursor, b"\"crddCommit\":\"") else {
        return false;
    };
    let Some(tree) = consume_quoted(payload, &mut cursor, b",\"crddTree\":\"") else {
        return false;
    };
    let Some(version) = consume_quoted(payload, &mut cursor, b",\"crddVersion\":\"") else {
        return false;
    };
    let Some(expires) = consume_quoted(payload, &mut cursor, b",\"expiresAt\":\"") else {
        return false;
    };
    let Some(issued) = consume_quoted(payload, &mut cursor, b",\"issuedAt\":\"") else {
        return false;
    };
    let Some(key_policy) = consume_quoted(payload, &mut cursor, b",\"keyStoragePolicySha256\":\"")
    else {
        return false;
    };
    if !exact_lower_hex(commit, &[40, 64])
        || !exact_lower_hex(tree, &[40, 64])
        || !exact_version(version, true)
        || !canonical_utc(expires)
        || !canonical_utc(issued)
        || issued >= expires
        || !exact_lower_hex(key_policy, &[64])
        || !consume_literal(payload, &mut cursor, b",")
        || !consume_artifact(
            payload,
            &mut cursor,
            NATIVE_PREFIX,
            NATIVE_MIDDLE,
            supervisor_size,
            supervisor_hash,
        )
    {
        return false;
    }
    let Some(content_root) =
        consume_quoted(payload, &mut cursor, b",\"packageContentRootSha256\":\"")
    else {
        return false;
    };
    let Some(package_name) = consume_quoted(payload, &mut cursor, b",\"packageName\":\"") else {
        return false;
    };
    let Some(package_version) = consume_quoted(payload, &mut cursor, b",\"packageVersion\":\"")
    else {
        return false;
    };
    if !exact_lower_hex(content_root, &[64])
        || package_name != b"@qual-lab/crdd-coordinator"
        || !exact_version(package_version, false)
        || !consume_literal(payload, &mut cursor, b",")
        || !consume_artifact(
            payload,
            &mut cursor,
            WORKER_PREFIX,
            WORKER_MIDDLE,
            worker_size,
            worker_hash,
        )
        || !consume_literal(payload, &mut cursor, b",\"releaseSequence\":")
        || consume_decimal(payload, &mut cursor, 9_007_199_254_740_991)
            .is_none_or(|value| value < 1)
    {
        return false;
    }
    let Some(root_policy) =
        consume_quoted(payload, &mut cursor, b",\"rootProtectionPolicySha256\":\"")
    else {
        return false;
    };
    exact_lower_hex(root_policy, &[64])
        && consume_literal(payload, &mut cursor, b"}")
        && cursor == payload.len()
        && issued <= now.as_slice()
        && now.as_slice() < expires
}

unsafe fn signed_manifest_matches(
    manifest_file: Handle,
    manifest_information: &BY_HANDLE_FILE_INFORMATION,
    supervisor_file: Handle,
    supervisor_information: &BY_HANDLE_FILE_INFORMATION,
    worker_file: Handle,
    worker_information: &BY_HANDLE_FILE_INFORMATION,
) -> bool {
    const ENVELOPE_PREFIX: &[u8] = b"{\"contract\":\"crdd-coordinator/platform-provisioner-package-manifest-envelope\",\"contractRevision\":2,\"payload\":";
    const SIGNATURE_PREFIX: &[u8] = b",\"signatures\":[{\"algorithm\":\"Ed25519\",\"keyId\":\"6b250a21be0f8fd582907731a2cba6aae44b991cbff82234c4ee838548c5e95f\",\"signature\":\"";
    const DOMAIN: &[u8] = b"CRDD\0PLATFORM-PROVISIONER-PACKAGE-MANIFEST\0V2\0";
    const PUBLIC_KEY: [u8; 32] = [
        0x30, 0xc6, 0x9b, 0x37, 0x3d, 0x5e, 0x56, 0xcb, 0x0d, 0x54, 0xb6, 0x5f, 0xf6, 0x90, 0x29,
        0x60, 0x8d, 0x17, 0xc1, 0x0e, 0xe1, 0xad, 0xc1, 0x82, 0x7f, 0x1c, 0x6d, 0xec, 0x8f, 0xb9,
        0xcb, 0x01,
    ];
    let manifest_size = file_size(manifest_information);
    if manifest_size == 0 || manifest_size > 128 * 1024 {
        return false;
    }
    let bytes = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut MANIFEST_BUFFER).cast::<u8>(),
            manifest_size as usize + 1,
        )
    };
    if unsafe { read_bounded(manifest_file, bytes) } != manifest_size as usize {
        return false;
    }
    let mut manifest_after_read = BY_HANDLE_FILE_INFORMATION::default();
    if unsafe { GetFileInformationByHandle(manifest_file, &mut manifest_after_read) } == 0
        || !same_file_identity(manifest_information, &manifest_after_read)
        || file_size(&manifest_after_read) != manifest_size
    {
        return false;
    }
    let bytes = &bytes[..manifest_size as usize];
    if !bytes.starts_with(ENVELOPE_PREFIX) || !bytes.ends_with(b"\"}]}") {
        return false;
    }
    let Some(signature_prefix) = find_once(bytes, SIGNATURE_PREFIX) else {
        return false;
    };
    let payload = &bytes[ENVELOPE_PREFIX.len()..signature_prefix];
    if !payload.starts_with(b"{\"contract\":\"crdd-coordinator/platform-provisioner-package-manifest\",\"contractRevision\":2,")
        || !payload.ends_with(b"}")
        || payload.iter().any(|byte| matches!(*byte, b'\n' | b'\r' | b'\t'))
    {
        return false;
    }
    let signature_start = signature_prefix + SIGNATURE_PREFIX.len();
    let Some(signature_text) = bytes.get(signature_start..signature_start + 86) else {
        return false;
    };
    if bytes.get(signature_start + 86..) != Some(b"\"}]}".as_slice()) {
        return false;
    }
    let Some(supervisor_hash) = (unsafe { file_sha256(supervisor_file) }) else {
        return false;
    };
    let Some(worker_hash) = (unsafe { file_sha256(worker_file) }) else {
        return false;
    };
    if !decode_expected_worker_sha256()
        .is_some_and(|expected| equal_u8_exact(&worker_hash, &expected))
    {
        return false;
    }
    let now = unsafe { current_canonical_utc() };
    if !exact_manifest_payload(
        payload,
        file_size(supervisor_information),
        &supervisor_hash,
        file_size(worker_information),
        &worker_hash,
        &now,
    ) {
        return false;
    }
    let message_length = DOMAIN.len() + 8 + payload.len();
    let message = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut SIGNATURE_MESSAGE_BUFFER).cast::<u8>(),
            message_length,
        )
    };
    message[..DOMAIN.len()].copy_from_slice(DOMAIN);
    message[DOMAIN.len()..DOMAIN.len() + 8].copy_from_slice(&(payload.len() as u64).to_be_bytes());
    message[DOMAIN.len() + 8..].copy_from_slice(payload);
    let Some(signature) =
        decode_base64url_64(signature_text).map(|bytes| Signature::from_bytes(&bytes))
    else {
        return false;
    };
    VerifyingKey::from_bytes(&PUBLIC_KEY).is_ok_and(|key| key.verify(message, &signature).is_ok())
}

unsafe fn authenticode_trust_is_valid(path: *const u16, locked_file: Handle) -> bool {
    // SAFETY: the NUL-terminated path and both WinTrust structures remain live for the synchronous
    // cache-only verification. No state handle is requested and UI/network retrieval are disabled.
    const GENERIC_VERIFY_V2: Guid = Guid {
        data1: 0x00aa_c56b,
        data2: 0xcd44,
        data3: 0x11d0,
        data4: [0x8c, 0xc2, 0x00, 0xc0, 0x4f, 0xc2, 0x95, 0xee],
    };
    let action = GENERIC_VERIFY_V2;
    let file = WintrustFileInfo {
        size: size_of::<WintrustFileInfo>() as u32,
        file_path: path,
        file: locked_file,
        known_subject: null(),
    };
    let Some(expected_signer) = decode_expected_authenticode_signer_sha256() else {
        return false;
    };
    let mut data = WintrustData {
        size: size_of::<WintrustData>() as u32,
        policy_callback_data: null_mut(),
        sip_client_data: null_mut(),
        ui_choice: 2,
        revocation_checks: 1,
        union_choice: 1,
        file_info: &raw const file,
        state_action: 1,
        state_data: null_mut(),
        url_reference: null(),
        provider_flags: 0x0000_1000,
        ui_context: 0,
        signature_settings: null_mut(),
    };
    let verified = unsafe { WinVerifyTrust(null_mut(), &raw const action, &raw mut data) } == 0;
    let mut signer_hash = [0_u8; 32];
    let signer_matches = if verified && !data.state_data.is_null() {
        let provider = unsafe { WTHelperProvDataFromStateData(data.state_data) };
        let signer = if provider.is_null() {
            null_mut()
        } else {
            unsafe { WTHelperGetProvSignerFromChain(provider, 0, 0, 0) }
        };
        if signer.is_null()
            || unsafe { (*signer).certificate_count } == 0
            || unsafe { (*signer).certificates.is_null() }
        {
            false
        } else {
            let certificate = unsafe { (*(*signer).certificates).certificate };
            let mut bytes = signer_hash.len() as u32;
            !certificate.is_null()
                && unsafe {
                    CertGetCertificateContextProperty(
                        certificate,
                        107,
                        signer_hash.as_mut_ptr().cast(),
                        &mut bytes,
                    )
                } != 0
                && bytes as usize == signer_hash.len()
                && equal_u8_exact(&signer_hash, &expected_signer)
        }
    } else {
        false
    };
    if !data.state_data.is_null() {
        data.state_action = 2;
        let _ = unsafe { WinVerifyTrust(null_mut(), &raw const action, &raw mut data) };
    }
    signer_matches
}

unsafe fn read_bounded(handle: Handle, buffer: &mut [u8]) -> usize {
    // SAFETY: `handle` remains borrowed and open for the loop; each ReadFile target is the remaining
    // initialized caller-owned slice, and synchronous I/O retains no pointer after return.
    let mut offset = 0;
    while offset < buffer.len() {
        let mut read = 0;
        let success = unsafe {
            ReadFile(
                handle,
                buffer.as_mut_ptr().add(offset).cast(),
                u32::try_from(buffer.len() - offset).unwrap_or(u32::MAX),
                &mut read,
                null_mut(),
            )
        };
        if success == 0 || read == 0 {
            break;
        }
        if read as usize > buffer.len() - offset {
            return buffer.len();
        }
        offset += read as usize;
    }
    offset
}

unsafe fn write_handle(handle: Handle, bytes: &[u8]) -> bool {
    // SAFETY: `handle` remains borrowed and open for the loop; each WriteFile source is the remaining
    // immutable slice, and synchronous I/O retains no pointer after return.
    let mut offset = 0;
    while offset < bytes.len() {
        let remaining = match u32::try_from(bytes.len() - offset) {
            Ok(value) => value,
            Err(_) => return false,
        };
        let mut written = 0;
        if unsafe {
            WriteFile(
                handle,
                bytes.as_ptr().add(offset).cast(),
                remaining,
                &mut written,
                null_mut(),
            )
        } == 0
            || written == 0
            || written > remaining
        {
            return false;
        }
        offset += written as usize;
    }
    true
}

unsafe fn create_local_appcontainer_pipe(name: &[u16]) -> Option<Handle> {
    // SAFETY: both UTF-16 inputs are NUL-terminated in static caller-owned storage. Windows copies
    // the security descriptor during CreateNamedPipeW, so LocalFree occurs only after creation; the
    // returned pipe handle transfers uniquely to the caller.
    let sddl = unsafe {
        core::slice::from_raw_parts_mut((&raw mut SECURITY_DESCRIPTOR_SDDL).cast::<u16>(), 64)
    };
    let mut sddl_length = 0;
    if !append_ascii(sddl, &mut sddl_length, PIPE_SECURITY_SDDL) {
        return None;
    }
    let mut descriptor = null_mut();
    if unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            1,
            &mut descriptor,
            null_mut(),
        )
    } == 0
        || descriptor.is_null()
    {
        return None;
    }
    let attributes = SecurityAttributes {
        length: size_of::<SecurityAttributes>() as u32,
        security_descriptor: descriptor,
        inherit_handle: 0,
    };
    let pipe = unsafe {
        CreateNamedPipeW(
            name.as_ptr(),
            PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
            PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_NOWAIT,
            1,
            8_192,
            8_192,
            0,
            &raw const attributes,
        )
    };
    unsafe { LocalFree(descriptor) };
    (pipe != INVALID_HANDLE && !pipe.is_null()).then_some(pipe)
}

#[derive(Clone, Copy)]
enum ClientConnection {
    Connected,
    ArgumentsRejected,
    PipeOpenFailed,
    ProcessExited,
    TimedOut,
    IdentityInvalid,
}

unsafe fn connect_expected_client(
    pipe: Handle,
    process: Handle,
    expected_process_id: u32,
) -> ClientConnection {
    // SAFETY: both handles stay open and borrowed for this bounded poll. Output pointers target live
    // stack values, no OVERLAPPED pointer is retained, and this function closes neither handle.
    let mut attempts = 0;
    while attempts < 1_500 {
        let connected = unsafe { ConnectNamedPipe(pipe, null_mut()) } != 0;
        let error = if connected {
            0
        } else {
            unsafe { GetLastError() }
        };
        if connected || error == ERROR_PIPE_CONNECTED {
            let mut client_process_id = 0;
            return if unsafe { GetNamedPipeClientProcessId(pipe, &mut client_process_id) } != 0
                && client_process_id == expected_process_id
            {
                ClientConnection::Connected
            } else {
                ClientConnection::IdentityInvalid
            };
        }
        if unsafe { WaitForSingleObject(process, 0) } == 0 {
            let mut exit_code = u32::MAX;
            return if unsafe { GetExitCodeProcess(process, &mut exit_code) } == 0 {
                ClientConnection::ProcessExited
            } else {
                match exit_code {
                    2 => ClientConnection::ArgumentsRejected,
                    3 => ClientConnection::PipeOpenFailed,
                    _ => ClientConnection::ProcessExited,
                }
            };
        }
        unsafe { Sleep(10) };
        attempts += 1;
    }
    ClientConnection::TimedOut
}

unsafe fn create_single_process_job() -> Option<Handle> {
    // SAFETY: the unnamed job has no inheritable security attributes and transfers its unique handle
    // to the caller. The fully initialized fixed-size limit structure is borrowed only for this call.
    let job = unsafe { CreateJobObjectW(null(), null()) };
    if job.is_null() || job == INVALID_HANDLE {
        return None;
    }
    let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
    limits.BasicLimitInformation.LimitFlags =
        JOB_OBJECT_LIMIT_ACTIVE_PROCESS | JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    limits.BasicLimitInformation.ActiveProcessLimit = 1;
    if unsafe {
        SetInformationJobObject(
            job,
            JobObjectExtendedLimitInformation,
            (&raw const limits).cast(),
            size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
        )
    } == 0
    {
        unsafe { CloseHandle(job) };
        return None;
    }
    Some(job)
}

unsafe fn job_is_empty(job: Handle) -> bool {
    // SAFETY: `job` remains open and borrowed. Windows writes only the declared accounting structure
    // and optional returned byte count, both of which live through the synchronous call.
    let mut accounting = JOBOBJECT_BASIC_ACCOUNTING_INFORMATION::default();
    let mut returned = 0;
    (unsafe {
        QueryInformationJobObject(
            job,
            JobObjectBasicAccountingInformation,
            (&raw mut accounting).cast(),
            size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>() as u32,
            &mut returned,
        )
    }) != 0
        && returned as usize == size_of::<JOBOBJECT_BASIC_ACCOUNTING_INFORMATION>()
        && accounting.ActiveProcesses == 0
}

unsafe fn terminate_and_confirm_empty(job: Handle, process: Handle) -> bool {
    // SAFETY: both handles remain uniquely owned by the caller. Termination is bounded and the
    // result is accepted only when the worker handle is signalled and Job accounting reaches zero.
    let terminated = unsafe { TerminateJobObject(job, 3) } != 0;
    let waited = !process.is_null()
        && process != INVALID_HANDLE
        && unsafe { WaitForSingleObject(process, 5_000) } == 0;
    terminated && waited && unsafe { job_is_empty(job) }
}

unsafe fn cleanup_or_mark_manual_recovery(job: Handle, process: Handle) {
    if !unsafe { terminate_and_confirm_empty(job, process) } {
        MANUAL_RECOVERY_REQUIRED.store(true, Ordering::Relaxed);
    }
}

unsafe fn launch_worker() -> Option<u32> {
    // SAFETY: all static buffers are exclusively used by this single-threaded process entrypoint.
    // SID, security descriptor, attribute-list heap allocation, pipe and process/thread handles each
    // have an explicit unique owner and are released on every path after their final synchronous API
    // use. The child inherits zero handles; only the PID-verified pipe connection crosses processes.
    FAILURE_STAGE.store(1, Ordering::Relaxed);
    let path = unsafe {
        core::slice::from_raw_parts_mut((&raw mut WORKER_PATH).cast::<u16>(), MAXIMUM_CODE_UNITS)
    };
    let path: &mut [u16; MAXIMUM_CODE_UNITS] = path.try_into().ok()?;
    let supervisor_path = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut SUPERVISOR_PATH).cast::<u16>(),
            MAXIMUM_CODE_UNITS,
        )
    };
    let supervisor_path: &mut [u16; MAXIMUM_CODE_UNITS] = supervisor_path.try_into().ok()?;
    let (supervisor_path_length, path_length, distribution_root_length) =
        unsafe { fixed_release_paths(supervisor_path, path) }?;
    let manifest_path = unsafe {
        core::slice::from_raw_parts_mut((&raw mut MANIFEST_PATH).cast::<u16>(), MAXIMUM_CODE_UNITS)
    };
    manifest_path[..distribution_root_length]
        .copy_from_slice(&supervisor_path[..distribution_root_length]);
    let mut manifest_path_length = distribution_root_length;
    if !append_ascii(
        manifest_path,
        &mut manifest_path_length,
        b"\\90_Release\\coordinator-package-manifest.json",
    ) {
        return None;
    }
    let command = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut WORKER_COMMAND_LINE).cast::<u16>(),
            MAXIMUM_CODE_UNITS,
        )
    };
    let pipe_name =
        unsafe { core::slice::from_raw_parts_mut((&raw mut PIPE_NAME).cast::<u16>(), 64) };
    let pipe_name_length = fixed_pipe_name(pipe_name, unsafe { GetCurrentProcessId() })?;
    if !worker_command_line(path, path_length, pipe_name, pipe_name_length, command) {
        return None;
    }

    FAILURE_STAGE.store(2, Ordering::Relaxed);
    const PROFILE_NAME: &[u16] = &[
        81, 117, 97, 108, 76, 97, 98, 46, 67, 82, 68, 68, 46, 67, 111, 111, 114, 100, 105, 110, 97,
        116, 111, 114, 46, 80, 114, 111, 118, 105, 115, 105, 111, 110, 46, 86, 49, 0,
    ];
    let mut sid = null_mut();
    let derived =
        unsafe { DeriveAppContainerSidFromAppContainerName(PROFILE_NAME.as_ptr(), &mut sid) };
    if derived < 0 || sid.is_null() {
        return None;
    }

    FAILURE_STAGE.store(5, Ordering::Relaxed);
    let original_handles = [unsafe { GetStdHandle((-10_i32) as u32) }, unsafe {
        GetStdHandle((-11_i32) as u32)
    }];
    if original_handles
        .iter()
        .any(|handle| handle.is_null() || *handle == INVALID_HANDLE)
    {
        unsafe { FreeSid(sid) };
        return None;
    }
    let request = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut REQUEST_BUFFER).cast::<u8>(),
            MAXIMUM_REQUEST_BYTES + 1,
        )
    };
    let request_length = unsafe { read_bounded(original_handles[0], request) };
    let request_binding = (request_length <= MAXIMUM_REQUEST_BYTES)
        .then(|| native_bootstrap_core::parse_platform_access_frame(&request[..request_length]))
        .flatten();
    let Some(request_binding) = request_binding else {
        unsafe { FreeSid(sid) };
        return None;
    };
    let Some((local_app_data_length, _environment_length)) =
        (unsafe { local_app_data_environment() })
    else {
        unsafe { FreeSid(sid) };
        return None;
    };
    FAILURE_STAGE.store(4, Ordering::Relaxed);
    let Some(pipe) = (unsafe { create_local_appcontainer_pipe(pipe_name) }) else {
        unsafe { FreeSid(sid) };
        return None;
    };
    let Some(job) = (unsafe { create_single_process_job() }) else {
        unsafe { CloseHandle(pipe) };
        unsafe { FreeSid(sid) };
        return None;
    };

    let security = SECURITY_CAPABILITIES {
        AppContainerSid: sid.cast(),
        Capabilities: null_mut(),
        CapabilityCount: 0,
        Reserved: 0,
    };
    let mut required = 0_usize;
    unsafe { InitializeProcThreadAttributeList(null_mut(), 3, 0, &mut required) };
    let heap = unsafe { GetProcessHeap() };
    if required == 0 || heap.is_null() {
        unsafe { CloseHandle(job) };
        unsafe { CloseHandle(pipe) };
        unsafe { FreeSid(sid) };
        return None;
    }
    let attributes = unsafe { HeapAlloc(heap, HEAP_ZERO_MEMORY, required) };
    if attributes.is_null() {
        unsafe { CloseHandle(job) };
        unsafe { CloseHandle(pipe) };
        unsafe { FreeSid(sid) };
        return None;
    }
    if unsafe { InitializeProcThreadAttributeList(attributes, 3, 0, &mut required) } == 0 {
        unsafe { HeapFree(heap, 0, attributes) };
        unsafe { CloseHandle(job) };
        unsafe { CloseHandle(pipe) };
        unsafe { FreeSid(sid) };
        return None;
    }
    let security_set = unsafe {
        UpdateProcThreadAttribute(
            attributes,
            0,
            ATTRIBUTE_SECURITY_CAPABILITIES,
            (&raw const security).cast(),
            size_of::<SECURITY_CAPABILITIES>(),
            null_mut(),
            null(),
        )
    } != 0;
    let mitigation_policy = WORKER_MITIGATION_POLICY;
    let mitigation_set = unsafe {
        UpdateProcThreadAttribute(
            attributes,
            0,
            ATTRIBUTE_MITIGATION_POLICY,
            (&raw const mitigation_policy).cast(),
            size_of::<u64>(),
            null_mut(),
            null(),
        )
    } != 0;
    let job_list = [job];
    let job_set = unsafe {
        UpdateProcThreadAttribute(
            attributes,
            0,
            ATTRIBUTE_JOB_LIST,
            job_list.as_ptr().cast(),
            size_of::<Handle>(),
            null_mut(),
            null(),
        )
    } != 0;
    if !security_set || !mitigation_set || !job_set {
        unsafe { DeleteProcThreadAttributeList(attributes) };
        unsafe { HeapFree(heap, 0, attributes) };
        unsafe { CloseHandle(job) };
        unsafe { CloseHandle(pipe) };
        unsafe { FreeSid(sid) };
        return None;
    }

    let startup = STARTUPINFOEXW {
        StartupInfo: STARTUPINFOW {
            cb: size_of::<STARTUPINFOEXW>() as u32,
            lpReserved: null_mut(),
            lpDesktop: null_mut(),
            lpTitle: null_mut(),
            dwX: 0,
            dwY: 0,
            dwXSize: 0,
            dwYSize: 0,
            dwXCountChars: 0,
            dwYCountChars: 0,
            dwFillAttribute: 0,
            dwFlags: 0,
            wShowWindow: 0,
            cbReserved2: 0,
            lpReserved2: null_mut(),
            hStdInput: null_mut(),
            hStdOutput: null_mut(),
            hStdError: null_mut(),
        },
        lpAttributeList: attributes.cast(),
    };
    let mut process = PROCESS_INFORMATION {
        hProcess: null_mut(),
        hThread: null_mut(),
        dwProcessId: 0,
        dwThreadId: 0,
    };
    let mut locked_handles = [null_mut(); 128];
    let mut locked_handle_count = 0;
    let supervisor_identity = unsafe {
        lock_local_path_chain(
            supervisor_path,
            supervisor_path_length,
            distribution_root_length,
            &mut locked_handles,
            &mut locked_handle_count,
        )
    };
    let supervisor_leaf_index = locked_handle_count.checked_sub(1);
    let worker_identity = unsafe {
        lock_local_path_chain(
            path,
            path_length,
            distribution_root_length,
            &mut locked_handles,
            &mut locked_handle_count,
        )
    };
    let worker_leaf_index = locked_handle_count.checked_sub(1);
    let manifest_identity = unsafe {
        lock_local_path_chain(
            manifest_path,
            manifest_path_length,
            distribution_root_length,
            &mut locked_handles,
            &mut locked_handle_count,
        )
    };
    let manifest_leaf_index = locked_handle_count.checked_sub(1);
    let local_app_data = unsafe {
        core::slice::from_raw_parts_mut(
            (&raw mut LOCAL_APP_DATA_PATH).cast::<u16>(),
            MAXIMUM_CODE_UNITS,
        )
    };
    let local_app_data_identity = unsafe {
        lock_local_path_chain(
            local_app_data,
            local_app_data_length,
            3,
            &mut locked_handles,
            &mut locked_handle_count,
        )
    };
    if supervisor_identity.is_none()
        || worker_identity.is_none()
        || manifest_identity.is_none()
        || local_app_data_identity.is_none()
        || !unsafe {
            authenticode_trust_is_valid(
                supervisor_path.as_ptr(),
                locked_handles[supervisor_leaf_index.unwrap_or(locked_handles.len())],
            )
        }
        || !unsafe {
            signed_manifest_matches(
                locked_handles[manifest_leaf_index.unwrap_or(locked_handles.len())],
                manifest_identity.as_ref().unwrap(),
                locked_handles[supervisor_leaf_index.unwrap_or(locked_handles.len())],
                supervisor_identity.as_ref().unwrap(),
                locked_handles[worker_leaf_index.unwrap_or(locked_handles.len())],
                worker_identity.as_ref().unwrap(),
            )
        }
    {
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        unsafe { DeleteProcThreadAttributeList(attributes) };
        unsafe { HeapFree(heap, 0, attributes) };
        unsafe { CloseHandle(job) };
        unsafe { CloseHandle(pipe) };
        unsafe { FreeSid(sid) };
        return None;
    }
    let Some(mut registry_effect) = (unsafe { begin_lowbox_registry_effect() }) else {
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        unsafe { DeleteProcThreadAttributeList(attributes) };
        unsafe { HeapFree(heap, 0, attributes) };
        unsafe { CloseHandle(job) };
        unsafe { CloseHandle(pipe) };
        unsafe { FreeSid(sid) };
        return None;
    };
    FAILURE_STAGE.store(3, Ordering::Relaxed);
    let saved_distribution_root_terminator = supervisor_path[distribution_root_length];
    supervisor_path[distribution_root_length] = 0;
    let created = unsafe {
        CreateProcessW(
            path.as_ptr(),
            command.as_mut_ptr(),
            null(),
            null(),
            0,
            EXTENDED_STARTUPINFO_PRESENT | CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT,
            (&raw mut MINIMUM_ENVIRONMENT).cast(),
            supervisor_path.as_ptr(),
            &raw const startup.StartupInfo,
            &mut process,
        )
    } != 0;
    supervisor_path[distribution_root_length] = saved_distribution_root_terminator;
    unsafe { DeleteProcThreadAttributeList(attributes) };
    unsafe { HeapFree(heap, 0, attributes) };
    unsafe { FreeSid(sid) };
    if !created || process.hProcess.is_null() || process.hThread.is_null() {
        unsafe { CloseHandle(job) };
        unsafe { CloseHandle(pipe) };
        unsafe { close_handles(&[process.hProcess, process.hThread]) };
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        return None;
    }
    FAILURE_STAGE.store(7, Ordering::Relaxed);

    if !unsafe {
        loaded_image_matches(
            process.hProcess,
            path,
            path_length,
            worker_identity.as_ref()?,
        )
    } {
        unsafe { cleanup_or_mark_manual_recovery(job, process.hProcess) };
        unsafe { CloseHandle(pipe) };
        unsafe { close_handles(&[process.hProcess, process.hThread, job]) };
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        return None;
    }

    if unsafe { ResumeThread(process.hThread) } == u32::MAX {
        unsafe { cleanup_or_mark_manual_recovery(job, process.hProcess) };
        unsafe { close_handles(&[process.hThread, pipe, process.hProcess, job]) };
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        return None;
    }

    FAILURE_STAGE.store(8, Ordering::Relaxed);
    unsafe { CloseHandle(process.hThread) };
    let connection =
        unsafe { connect_expected_client(pipe, process.hProcess, process.dwProcessId) };
    if !matches!(connection, ClientConnection::Connected) {
        FAILURE_STAGE.store(
            match connection {
                ClientConnection::ArgumentsRejected => 8,
                ClientConnection::PipeOpenFailed => 9,
                ClientConnection::ProcessExited => 10,
                ClientConnection::TimedOut => 11,
                ClientConnection::IdentityInvalid => 12,
                ClientConnection::Connected => 0,
            },
            Ordering::Relaxed,
        );
        unsafe { cleanup_or_mark_manual_recovery(job, process.hProcess) };
        unsafe { DisconnectNamedPipe(pipe) };
        unsafe { close_handles(&[pipe, process.hProcess, job]) };
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        return None;
    }
    FAILURE_STAGE.store(13, Ordering::Relaxed);
    if !unsafe { write_handle(pipe, &request[..request_length]) } {
        unsafe { cleanup_or_mark_manual_recovery(job, process.hProcess) };
        unsafe { DisconnectNamedPipe(pipe) };
        unsafe { close_handles(&[pipe, process.hProcess, job]) };
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        return None;
    }
    FAILURE_STAGE.store(14, Ordering::Relaxed);
    let wait = unsafe { WaitForSingleObject(process.hProcess, WORKER_TIMEOUT_MILLISECONDS) };
    if wait != 0 {
        unsafe { cleanup_or_mark_manual_recovery(job, process.hProcess) };
        unsafe { DisconnectNamedPipe(pipe) };
        unsafe { close_handles(&[pipe, process.hProcess, job]) };
        unsafe { close_handles(&locked_handles[..locked_handle_count]) };
        return None;
    }
    FAILURE_STAGE.store(15, Ordering::Relaxed);
    let response = unsafe {
        core::slice::from_raw_parts_mut((&raw mut RESPONSE_BUFFER).cast::<u8>(), RESPONSE_BYTES + 1)
    };
    let response_length = unsafe { read_bounded(pipe, response) };
    unsafe { DisconnectNamedPipe(pipe) };
    unsafe { CloseHandle(pipe) };
    let mut exit_code = 3;
    let read = unsafe { GetExitCodeProcess(process.hProcess, &mut exit_code) } != 0;
    let mut process_tree_absent = unsafe { job_is_empty(job) };
    if !process_tree_absent {
        unsafe { cleanup_or_mark_manual_recovery(job, process.hProcess) };
        process_tree_absent =
            !MANUAL_RECOVERY_REQUIRED.load(Ordering::Relaxed) && unsafe { job_is_empty(job) };
    }
    unsafe { close_handles(&[process.hProcess, job]) };
    unsafe { close_handles(&locked_handles[..locked_handle_count]) };
    if !read
        || !process_tree_absent
        || !native_bootstrap_core::exact_platform_access_response(
            &response[..response_length],
            request_binding,
            exit_code,
        )
    {
        return None;
    }
    if !unsafe { registry_effect.restore() } {
        return None;
    }
    if !unsafe { write_handle(original_handles[1], &response[..response_length]) } {
        return None;
    }
    Some(exit_code)
}

unsafe fn write_stdout(bytes: &[u8]) -> bool {
    // SAFETY: stdout is a borrowed process handle. Each synchronous WriteFile reads only the live
    // immutable suffix and retains no pointer; this function never closes the borrowed handle.
    let output = unsafe { GetStdHandle((-11_i32) as u32) };
    if output.is_null() || output == INVALID_HANDLE {
        return false;
    }
    let mut offset = 0;
    while offset < bytes.len() {
        let remaining = match u32::try_from(bytes.len() - offset) {
            Ok(value) => value,
            Err(_) => return false,
        };
        let mut written = 0;
        if unsafe {
            WriteFile(
                output,
                bytes.as_ptr().add(offset).cast(),
                remaining,
                &mut written,
                null_mut(),
            )
        } == 0
            || written == 0
            || written > remaining
        {
            return false;
        }
        offset += written as usize;
    }
    true
}

#[cfg(not(test))]
#[unsafe(no_mangle)]
pub extern "system" fn crdd_coordinator_entry() -> ! {
    // SAFETY: this is the process's single native entrypoint. The called unsafe routines own their
    // Win32 resources through completion, and ExitProcess is used only after all owned handles close.
    let invalid = unsafe { command_line() }
        .and_then(native_bootstrap_core::response_for_invalid_command_line);
    let exit_code = if let Some(response) = invalid {
        if unsafe { write_stdout(response) } {
            2
        } else {
            3
        }
    } else {
        unsafe { launch_worker() }.unwrap_or_else(|| {
            let response = if REGISTRY_RECOVERY_REQUIRED.load(Ordering::Relaxed) {
                match FAILURE_STAGE.load(Ordering::Relaxed) {
                    3 => native_bootstrap_core::REGISTRY_PROCESS_MANUAL_RECOVERY_BLOCKED,
                    7 => native_bootstrap_core::REGISTRY_CREATED_PROCESS_MANUAL_RECOVERY_BLOCKED,
                    8.. => native_bootstrap_core::REGISTRY_WORKER_MANUAL_RECOVERY_BLOCKED,
                    _ => native_bootstrap_core::REGISTRY_PRECONDITION_MANUAL_RECOVERY_BLOCKED,
                }
            } else if MANUAL_RECOVERY_REQUIRED.load(Ordering::Relaxed) {
                if FAILURE_STAGE.load(Ordering::Relaxed) >= 8 {
                    native_bootstrap_core::WORKER_MANUAL_RECOVERY_BLOCKED
                } else {
                    native_bootstrap_core::PROCESS_MANUAL_RECOVERY_BLOCKED
                }
            } else {
                match FAILURE_STAGE.load(Ordering::Relaxed) {
                    1 => native_bootstrap_core::RELEASE_LAYOUT_BLOCKED,
                    2 => native_bootstrap_core::PROFILE_BLOCKED,
                    3 => native_bootstrap_core::PROCESS_BLOCKED,
                    // Reserved for revision 2 compatibility; the v1 Minimum
                    // Trust Boundary entrypoint no longer assigns stage 6.
                    6 => native_bootstrap_core::SUPERVISOR_IMAGE_BLOCKED,
                    5 => native_bootstrap_core::REQUEST_BLOCKED,
                    7 => native_bootstrap_core::PROCESS_CREATED_BLOCKED,
                    8 => native_bootstrap_core::WORKER_ARGUMENTS_BLOCKED,
                    9 => native_bootstrap_core::WORKER_PIPE_OPEN_BLOCKED,
                    10 => native_bootstrap_core::WORKER_PRECONNECTION_EXIT_BLOCKED,
                    11 => native_bootstrap_core::WORKER_CONNECTION_TIMEOUT_BLOCKED,
                    12 => native_bootstrap_core::WORKER_CONNECTION_IDENTITY_BLOCKED,
                    13 => native_bootstrap_core::WORKER_REQUEST_BLOCKED,
                    14 => native_bootstrap_core::WORKER_WAIT_BLOCKED,
                    15 => native_bootstrap_core::WORKER_RESPONSE_BLOCKED,
                    _ => native_bootstrap_core::ISOLATION_BLOCKED,
                }
            };
            if unsafe { write_stdout(response) } {
                2
            } else {
                3
            }
        })
    };
    unsafe { ExitProcess(exit_code) }
}

#[cfg(all(not(test), debug_assertions))]
#[unsafe(no_mangle)]
pub extern "C" fn main() -> i32 {
    crdd_coordinator_entry()
}

#[cfg(not(test))]
#[panic_handler]
fn panic(_information: &PanicInfo<'_>) -> ! {
    // SAFETY: panic is terminal in this no-unwind binary; no raw state is formatted or exposed.
    unsafe { ExitProcess(3) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recovery_record_and_restore_ownership_are_exact() {
        let record = recovery_record(2, true, 7, 11, 13);
        assert_eq!(&record[..8], b"CRDDLR01");
        assert_eq!(record[8], 2);
        assert_eq!(record[9], 1);
        assert_eq!(u32::from_le_bytes(record[12..16].try_into().unwrap()), 7);
        assert_eq!(u64::from_le_bytes(record[16..24].try_into().unwrap()), 11);
        assert_eq!(u64::from_le_bytes(record[24..32].try_into().unwrap()), 13);
        assert!(registry_restore_is_owned(Some(Some(1)), Some(13), 13));
        for (value, last_write) in [
            (Some(Some(0)), Some(13)),
            (Some(Some(1)), Some(12)),
            (Some(None), Some(13)),
            (None, Some(13)),
            (Some(Some(1)), None),
        ] {
            assert!(!registry_restore_is_owned(value, last_write, 13));
        }
    }

    #[test]
    fn known_folder_environment_contains_only_local_app_data() {
        let Some((path_length, environment_length)) = (unsafe { local_app_data_environment() })
        else {
            panic!("Local App Data known folder unavailable");
        };
        assert!(path_length > 3);
        let environment = unsafe {
            core::slice::from_raw_parts(
                (&raw const MINIMUM_ENVIRONMENT).cast::<u16>(),
                environment_length,
            )
        };
        let prefix = "LOCALAPPDATA=".encode_utf16().collect::<Vec<_>>();
        assert_eq!(&environment[..prefix.len()], prefix);
        assert_eq!(&environment[environment.len() - 2..], &[0, 0]);
        assert_eq!(
            environment
                .iter()
                .filter(|value| **value == u16::from(b'='))
                .count(),
            1
        );
    }

    #[test]
    fn pipe_security_descriptor_allows_only_declared_appcontainer_low_integrity_access() {
        assert_eq!(
            PIPE_SECURITY_SDDL,
            b"D:P(A;;GA;;;OW)(A;;GA;;;SY)(A;;GRGW;;;AC)S:(ML;;NW;;;LW)"
        );
        assert!(!PIPE_SECURITY_SDDL.windows(4).any(|value| value == b";;;WD"));
    }

    #[test]
    #[ignore = "mutates and restores the current-user LowBoxConsoleEnabled prerequisite"]
    fn lowbox_registry_effect_restores_exact_prestate() {
        MANUAL_RECOVERY_REQUIRED.store(false, Ordering::Relaxed);
        REGISTRY_RECOVERY_REQUIRED.store(false, Ordering::Relaxed);
        let mut effect = unsafe { begin_lowbox_registry_effect() }
            .expect("temporary LowBox registry effect unavailable");
        assert_eq!(
            unsafe { registry_dword(effect.console, effect.value_name.as_ptr()) },
            Some(Some(1))
        );
        assert!(effect.pre_value == 1 || effect.record_written);
        assert!(unsafe { effect.restore() });
        assert!(!MANUAL_RECOVERY_REQUIRED.load(Ordering::Relaxed));
        assert!(!REGISTRY_RECOVERY_REQUIRED.load(Ordering::Relaxed));
    }

    fn payload(issued: &str, expires: &str) -> Vec<u8> {
        format!(
            "{{\"contract\":\"crdd-coordinator/platform-provisioner-package-manifest\",\"contractRevision\":2,\"crddCommit\":\"{}\",\"crddTree\":\"{}\",\"crddVersion\":\"v0.18.0\",\"expiresAt\":\"{}\",\"issuedAt\":\"{}\",\"keyStoragePolicySha256\":\"{}\",\"nativeProvisionSupervisorArtifact\":{{\"byteLength\":100,\"entrypointContractRevision\":2,\"relativePath\":\"90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe\",\"rustToolchain\":\"1.94.1\",\"sha256\":\"{}\",\"target\":\"x86_64-pc-windows-msvc\"}},\"packageContentRootSha256\":\"{}\",\"packageName\":\"@qual-lab/crdd-coordinator\",\"packageVersion\":\"0.0.0-development\",\"platformAccessArtifact\":{{\"byteLength\":200,\"protocolRevision\":3,\"relativePath\":\"90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe\",\"rustToolchain\":\"1.94.1\",\"sha256\":\"{}\",\"target\":\"x86_64-pc-windows-msvc\"}},\"releaseSequence\":1,\"rootProtectionPolicySha256\":\"{}\"}}",
            "a".repeat(40),
            "b".repeat(64),
            expires,
            issued,
            "c".repeat(64),
            "01".repeat(32),
            "d".repeat(64),
            "02".repeat(32),
            "e".repeat(64),
        )
        .into_bytes()
    }

    #[test]
    fn native_manifest_payload_is_exact_and_current() {
        let now = *b"2026-08-23T00:00:00.000Z";
        let valid = payload("2000-01-01T00:00:00.000Z", "9999-12-31T23:59:59.999Z");
        assert!(exact_manifest_payload(
            &valid,
            100,
            &[1_u8; 32],
            200,
            &[2_u8; 32],
            &now,
        ));
        let not_before = payload("2026-08-23T00:00:00.000Z", "2026-08-23T00:00:00.002Z");
        assert!(exact_manifest_payload(
            &not_before,
            100,
            &[1_u8; 32],
            200,
            &[2_u8; 32],
            &now,
        ));
        let final_millisecond = *b"2026-08-23T00:00:00.001Z";
        assert!(exact_manifest_payload(
            &not_before,
            100,
            &[1_u8; 32],
            200,
            &[2_u8; 32],
            &final_millisecond,
        ));
        let exact_expiry = *b"2026-08-23T00:00:00.002Z";
        assert!(!exact_manifest_payload(
            &not_before,
            100,
            &[1_u8; 32],
            200,
            &[2_u8; 32],
            &exact_expiry,
        ));
        for invalid in [
            payload("2099-01-01T00:00:00.000Z", "2100-01-01T00:00:00.000Z"),
            payload("2000-01-01T00:00:00.000Z", "2001-01-01T00:00:00.000Z"),
            payload("2000-02-30T00:00:00.000Z", "9999-12-31T23:59:59.999Z"),
        ] {
            assert!(!exact_manifest_payload(
                &invalid,
                100,
                &[1_u8; 32],
                200,
                &[2_u8; 32],
                &now,
            ));
        }
        let mut extra = valid.clone();
        extra.pop();
        extra.extend_from_slice(b",\"unknown\":true}");
        assert!(!exact_manifest_payload(
            &extra,
            100,
            &[1_u8; 32],
            200,
            &[2_u8; 32],
            &now,
        ));
        assert!(!exact_manifest_payload(
            &valid,
            101,
            &[1_u8; 32],
            200,
            &[2_u8; 32],
            &now,
        ));
    }
}
