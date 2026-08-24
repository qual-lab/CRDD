use std::ffi::{OsString, c_void};
use std::mem::size_of;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
use std::path::{Path, PathBuf};
use std::ptr::{null, null_mut};

use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_ALREADY_EXISTS, ERROR_INSUFFICIENT_BUFFER, GetLastError, HANDLE,
    INVALID_HANDLE_VALUE, LocalFree,
};
use windows_sys::Win32::Security::Authorization::{GetSecurityInfo, SE_FILE_OBJECT};
use windows_sys::Win32::Security::Cryptography::{
    BCRYPT_ALG_HANDLE, BCRYPT_HASH_HANDLE, BCRYPT_SHA256_ALGORITHM, BCryptCloseAlgorithmProvider,
    BCryptCreateHash, BCryptDestroyHash, BCryptFinishHash, BCryptHashData,
    BCryptOpenAlgorithmProvider,
};
use windows_sys::Win32::Security::{
    ACCESS_ALLOWED_ACE, ACL, ACL_REVISION, ACL_SIZE_INFORMATION, AccessCheck, AclSizeInformation,
    AddAccessAllowedAceEx, CheckTokenMembership, CreateWellKnownSid, DACL_SECURITY_INFORMATION,
    DuplicateToken, GENERIC_MAPPING, GROUP_SECURITY_INFORMATION, GetAce, GetAclInformation,
    GetLengthSid, GetSecurityDescriptorControl, GetSecurityDescriptorDacl,
    GetSecurityDescriptorOwner, GetTokenInformation, InitializeAcl, InitializeSecurityDescriptor,
    IsTokenRestricted, IsValidSid, MapGenericMask, OWNER_SECURITY_INFORMATION, PRIVILEGE_SET,
    PSECURITY_DESCRIPTOR, PSID, SE_DACL_PROTECTED, SECURITY_ATTRIBUTES, SECURITY_DESCRIPTOR,
    SecurityImpersonation, SetSecurityDescriptorControl, SetSecurityDescriptorDacl,
    SetSecurityDescriptorOwner, TOKEN_DUPLICATE, TOKEN_QUERY, TOKEN_STATISTICS, TOKEN_USER,
    TokenIsAppContainer, TokenPrimary, TokenSessionId, TokenStatistics, TokenType, TokenUser,
    WinBatchSid, WinInteractiveSid, WinLocalSystemSid, WinNetworkSid, WinServiceSid,
};
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateDirectoryW, CreateFileW, DELETE, FILE_ADD_FILE,
    FILE_ADD_SUBDIRECTORY, FILE_ALL_ACCESS, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_DELETE_CHILD, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
    FILE_GENERIC_EXECUTE, FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_LIST_DIRECTORY,
    FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_TRAVERSE,
    FILE_WRITE_ATTRIBUTES, FILE_WRITE_EA, GetDriveTypeW, GetFileInformationByHandle,
    GetFinalPathNameByHandleW, OPEN_EXISTING, READ_CONTROL, WRITE_DAC, WRITE_OWNER,
};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
use windows_sys::core::GUID;

use crate::protocol::{
    FileIdentity, PRINCIPAL_APP_CONTAINER, PRINCIPAL_BATCH_GROUP, PRINCIPAL_INTERACTIVE_GROUP,
    PRINCIPAL_NETWORK_GROUP, PRINCIPAL_NONZERO_SESSION, PRINCIPAL_PRIMARY_TOKEN,
    PRINCIPAL_RESTRICTED_TOKEN, PRINCIPAL_SERVICE_GROUP, PROVIDER_HOME_DACL_PROTECTED,
    PROVIDER_HOME_DIRECTORY, PROVIDER_HOME_FIXED_VOLUME, PROVIDER_HOME_NO_REPARSE_CHAIN,
    PROVIDER_HOME_OWNER_SELECTED_USER, PROVIDER_HOME_SELECTED_USER_FULL_CONTROL,
    PROVIDER_HOME_STABLE_IDENTITY, PROVIDER_HOME_SYSTEM_FULL_CONTROL,
    PROVIDER_HOME_WRITERS_RESTRICTED, ProviderHomeReason, ProviderHomeRequest,
    ProviderHomeResponse, Reason, Request, Response,
};

#[link(name = "shell32")]
unsafe extern "system" {
    fn SHGetKnownFolderPath(
        folder_id: *const GUID,
        flags: u32,
        token: HANDLE,
        path: *mut *mut u16,
    ) -> i32;
}

#[link(name = "ole32")]
unsafe extern "system" {
    fn CoTaskMemFree(memory: *const c_void);
}

pub const ACCESS_READ_TRAVERSE: u32 = 1 << 0;
pub const ACCESS_ADD_FILE: u32 = 1 << 1;
pub const ACCESS_ADD_SUBDIRECTORY: u32 = 1 << 2;
pub const ACCESS_WRITE_EA: u32 = 1 << 3;
pub const ACCESS_WRITE_ATTRIBUTES: u32 = 1 << 4;
pub const ACCESS_DELETE_CHILD: u32 = 1 << 5;
pub const ACCESS_DELETE_ON_ROOT_OBJECT: u32 = 1 << 6;
pub const ACCESS_WRITE_DAC: u32 = 1 << 7;
pub const ACCESS_WRITE_OWNER: u32 = 1 << 8;

const REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS: u32 =
    PRINCIPAL_PRIMARY_TOKEN | PRINCIPAL_INTERACTIVE_GROUP | PRINCIPAL_NONZERO_SESSION;
const FORBIDDEN_SELECTED_USER_PRINCIPAL_FLAGS: u32 = PRINCIPAL_SERVICE_GROUP
    | PRINCIPAL_BATCH_GROUP
    | PRINCIPAL_NETWORK_GROUP
    | PRINCIPAL_RESTRICTED_TOKEN
    | PRINCIPAL_APP_CONTAINER;
const PROVIDER_HOME_SEGMENTS: [&str; 3] = ["Qual-Lab", "CRDD", "ProviderHomes"];
const CANDIDATE_STORE_SEGMENTS: [&str; 3] = ["Qual-Lab", "CRDD", "CandidateStore"];
const RUNTIME_STATE_SEGMENTS: [&str; 3] = ["Qual-Lab", "CRDD", "RuntimeState"];
const DRIVE_FIXED: u32 = 3;
const ACCESS_ALLOWED_ACE_TYPE: u8 = 0;
const INHERITED_ACE: u8 = 0x10;
const OBJECT_INHERIT_ACE: u8 = 0x01;
const CONTAINER_INHERIT_ACE: u8 = 0x02;
const MAXIMUM_SECURITY_DESCRIPTOR_BYTES: usize = 65_536;
const MAXIMUM_KNOWN_FOLDER_CODE_UNITS: usize = 32_767;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct TokenBindingObservation {
    principal_identity_hash: [u8; 32],
    principal_flags: u32,
    authentication_id: [u8; 8],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
struct DirectoryIdentity {
    volume_serial_number: u32,
    file_index_high: u32,
    file_index_low: u32,
    creation_time_low: u32,
    creation_time_high: u32,
    attributes: u32,
}

struct ProviderHomeChain {
    handles: Vec<OwnedHandle>,
    identities: Vec<DirectoryIdentity>,
}

struct ProviderHomeProtectionObservation {
    protection_hash: [u8; 32],
    home_flags: u32,
}

enum ProviderHomeChainError {
    KnownFolderUnavailable,
    HomeUnavailable,
    ReparseRejected,
    MountSourceMismatch,
}

struct OwnedHandle(HANDLE);

impl Drop for OwnedHandle {
    fn drop(&mut self) {
        if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
            // SAFETY: this type exclusively owns the valid Windows handle.
            unsafe { CloseHandle(self.0) };
        }
    }
}

struct OwnedSecurityDescriptor(PSECURITY_DESCRIPTOR);

impl Drop for OwnedSecurityDescriptor {
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: GetSecurityInfo allocates this descriptor with LocalAlloc.
            unsafe { LocalFree(self.0.cast::<c_void>()) };
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

fn blocked(request: &Request, reason: Reason) -> Response {
    Response {
        root_role: request.root_role,
        nonce: request.nonce,
        is_candidate: false,
        reason,
        access_mask: 0,
        runtime_principal_identity_hash: [0_u8; 32],
        principal_observation_flags: 0,
    }
}

fn blocked_provider_home(
    request: &ProviderHomeRequest,
    reason: ProviderHomeReason,
) -> ProviderHomeResponse {
    ProviderHomeResponse {
        provider: request.provider,
        nonce: request.nonce,
        is_candidate: false,
        reason,
        principal_observation_flags: 0,
        home_observation_flags: 0,
        provider_home_identity_hash: [0_u8; 32],
        provider_home_protection_hash: [0_u8; 32],
        local_user_binding_hash: [0_u8; 32],
        stable_logical_home_binding_hash: [0_u8; 32],
    }
}

fn directory_identity(information: &BY_HANDLE_FILE_INFORMATION) -> DirectoryIdentity {
    DirectoryIdentity {
        volume_serial_number: information.dwVolumeSerialNumber,
        file_index_high: information.nFileIndexHigh,
        file_index_low: information.nFileIndexLow,
        creation_time_low: information.ftCreationTime.dwLowDateTime,
        creation_time_high: information.ftCreationTime.dwHighDateTime,
        attributes: information.dwFileAttributes,
    }
}

fn directory_identity_bytes(identity: DirectoryIdentity) -> [u8; 24] {
    let mut bytes = [0_u8; 24];
    for (offset, value) in [
        identity.volume_serial_number,
        identity.file_index_high,
        identity.file_index_low,
        identity.creation_time_low,
        identity.creation_time_high,
        identity.attributes,
    ]
    .into_iter()
    .enumerate()
    {
        let start = offset * 4;
        bytes[start..start + 4].copy_from_slice(&value.to_le_bytes());
    }
    bytes
}

fn open_root(path: &str) -> Option<OwnedHandle> {
    let mut wide: Vec<u16> = Path::new(path).as_os_str().encode_wide().collect();
    wide.push(0);
    // SAFETY: wide is NUL-terminated, all pointer arguments remain valid for the call,
    // and the returned handle is immediately transferred to OwnedHandle.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_READ_ATTRIBUTES | READ_CONTROL,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    (handle != INVALID_HANDLE_VALUE).then_some(OwnedHandle(handle))
}

fn open_directory(path: &Path) -> Option<OwnedHandle> {
    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    if wide.is_empty() || wide.len() >= MAXIMUM_KNOWN_FOLDER_CODE_UNITS || wide.contains(&0) {
        return None;
    }
    wide.push(0);
    // SAFETY: wide is an owned NUL-terminated path buffer and the returned handle is owned.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_READ_ATTRIBUTES | READ_CONTROL,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    (handle != INVALID_HANDLE_VALUE).then_some(OwnedHandle(handle))
}

fn local_app_data_path() -> Option<PathBuf> {
    const FOLDER_ID_LOCAL_APP_DATA: GUID = GUID {
        data1: 0xf1b32785,
        data2: 0x6fba,
        data3: 0x4fcf,
        data4: [0x9d, 0x55, 0x7b, 0x8e, 0x7f, 0x15, 0x70, 0x91],
    };
    let folder_id = FOLDER_ID_LOCAL_APP_DATA;
    let mut raw_path = null_mut();
    // SAFETY: raw_path is writable. On success, Shell allocates a NUL-terminated UTF-16 path
    // that remains owned until CoTaskMemFree below.
    if unsafe { SHGetKnownFolderPath(&raw const folder_id, 0, null_mut(), &mut raw_path) } != 0
        || raw_path.is_null()
    {
        return None;
    }
    let mut length = 0_usize;
    // SAFETY: SHGetKnownFolderPath returned a NUL-terminated string. The explicit maximum keeps
    // scanning bounded before copying it into an owned OsString.
    while length < MAXIMUM_KNOWN_FOLDER_CODE_UNITS && unsafe { *raw_path.add(length) } != 0 {
        length += 1;
    }
    let result = if length == 0 || length == MAXIMUM_KNOWN_FOLDER_CODE_UNITS {
        None
    } else {
        // SAFETY: the bounded scan established that length readable UTF-16 code units precede NUL.
        let units = unsafe { std::slice::from_raw_parts(raw_path, length) };
        Some(PathBuf::from(OsString::from_wide(units)))
    };
    // SAFETY: raw_path was allocated by SHGetKnownFolderPath and has not been freed yet.
    unsafe { CoTaskMemFree(raw_path.cast()) };
    result
}

fn initialize_runtime_owned_directory_if_missing(
    primary_token: HANDLE,
    segments: &[&str; 3],
) -> bool {
    let mut candidate_store = match local_app_data_path() {
        Some(value) => value,
        None => return false,
    };
    for segment in segments {
        candidate_store.push(segment);
    }
    let user_sid = match token_user_sid_bytes(primary_token) {
        Some(value) => value,
        None => return false,
    };
    let system_sid = match local_system_sid_bytes() {
        Some(value) => value,
        None => return false,
    };
    let ace_bytes = |sid_length: usize| {
        size_of::<ACCESS_ALLOWED_ACE>()
            .checked_sub(size_of::<u32>())?
            .checked_add(sid_length)
    };
    let acl_bytes = match size_of::<ACL>()
        .checked_add(ace_bytes(user_sid.len()).unwrap_or(usize::MAX))
        .and_then(|value| value.checked_add(ace_bytes(system_sid.len()).unwrap_or(usize::MAX)))
    {
        Some(value) if value <= MAXIMUM_SECURITY_DESCRIPTOR_BYTES => value,
        _ => return false,
    };
    let mut acl_storage = vec![0_u32; acl_bytes.div_ceil(size_of::<u32>())];
    let acl = acl_storage.as_mut_ptr().cast::<ACL>();
    let acl_length = match u32::try_from(acl_bytes) {
        Ok(value) => value,
        Err(_) => return false,
    };
    // SAFETY: acl points to an aligned writable allocation of acl_length bytes.
    if unsafe { InitializeAcl(acl, acl_length, ACL_REVISION) } == 0 {
        return false;
    }
    let ace_flags = u32::from(OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE);
    // SAFETY: both SID buffers contain values copied from validated Windows token/well-known SID
    // sources and remain alive through CreateDirectoryW.
    if unsafe {
        AddAccessAllowedAceEx(
            acl,
            ACL_REVISION,
            ace_flags,
            FILE_ALL_ACCESS,
            user_sid.as_ptr().cast_mut().cast(),
        )
    } == 0
        || unsafe {
            AddAccessAllowedAceEx(
                acl,
                ACL_REVISION,
                ace_flags,
                FILE_ALL_ACCESS,
                system_sid.as_ptr().cast_mut().cast(),
            )
        } == 0
    {
        return false;
    }
    let mut descriptor = SECURITY_DESCRIPTOR::default();
    let descriptor_pointer = (&raw mut descriptor).cast::<c_void>();
    // SAFETY: descriptor is a writable absolute security descriptor and all referenced buffers
    // remain alive until the synchronous CreateDirectoryW call returns.
    if unsafe { InitializeSecurityDescriptor(descriptor_pointer, 1) } == 0
        || unsafe {
            SetSecurityDescriptorOwner(descriptor_pointer, user_sid.as_ptr().cast_mut().cast(), 0)
        } == 0
        || unsafe { SetSecurityDescriptorDacl(descriptor_pointer, 1, acl, 0) } == 0
        || unsafe {
            SetSecurityDescriptorControl(descriptor_pointer, SE_DACL_PROTECTED, SE_DACL_PROTECTED)
        } == 0
    {
        return false;
    }
    let mut wide: Vec<u16> = candidate_store.as_os_str().encode_wide().collect();
    if wide.is_empty() || wide.len() >= MAXIMUM_KNOWN_FOLDER_CODE_UNITS {
        return false;
    }
    wide.push(0);
    let attributes = SECURITY_ATTRIBUTES {
        nLength: u32::try_from(size_of::<SECURITY_ATTRIBUTES>()).unwrap_or(0),
        lpSecurityDescriptor: descriptor_pointer,
        bInheritHandle: 0,
    };
    // SAFETY: wide and attributes are valid for the duration of this synchronous call.
    if unsafe { CreateDirectoryW(wide.as_ptr(), &raw const attributes) } != 0 {
        return true;
    }
    // An existing object is never repaired here. The following read-only observation must prove
    // that it is the exact protected directory before any caller may use it.
    (unsafe { GetLastError() }) == ERROR_ALREADY_EXISTS
}

fn open_provider_home_chain(
    request: &ProviderHomeRequest,
) -> Result<ProviderHomeChain, ProviderHomeChainError> {
    let mut current =
        local_app_data_path().ok_or(ProviderHomeChainError::KnownFolderUnavailable)?;
    let mut paths = Vec::with_capacity(PROVIDER_HOME_SEGMENTS.len() + 2);
    paths.push(current.clone());
    if matches!(
        request.provider,
        crate::protocol::Provider::CandidateStore | crate::protocol::Provider::RuntimeState
    ) {
        let segments = if request.provider == crate::protocol::Provider::CandidateStore {
            &CANDIDATE_STORE_SEGMENTS
        } else {
            &RUNTIME_STATE_SEGMENTS
        };
        for segment in segments {
            current.push(segment);
            paths.push(current.clone());
        }
    } else {
        for segment in PROVIDER_HOME_SEGMENTS {
            current.push(segment);
            paths.push(current.clone());
        }
        current.push(request.provider.directory_name());
        paths.push(current);
    }
    let mount_source_hash = paths
        .last()
        .and_then(|path| provider_home_mount_source_hash(request, path))
        .ok_or(ProviderHomeChainError::KnownFolderUnavailable)?;
    if mount_source_hash != request.mount_source_hash {
        return Err(ProviderHomeChainError::MountSourceMismatch);
    }

    let mut handles = Vec::with_capacity(paths.len());
    let mut identities = Vec::with_capacity(paths.len());
    for path in paths {
        let handle = open_directory(&path).ok_or(ProviderHomeChainError::HomeUnavailable)?;
        let information =
            root_information(handle.0).ok_or(ProviderHomeChainError::HomeUnavailable)?;
        if information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
            return Err(ProviderHomeChainError::HomeUnavailable);
        }
        if information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return Err(ProviderHomeChainError::ReparseRejected);
        }
        identities.push(directory_identity(&information));
        handles.push(handle);
    }
    Ok(ProviderHomeChain {
        handles,
        identities,
    })
}

fn provider_home_on_fixed_volume(chain: &ProviderHomeChain) -> bool {
    let Some(home) = chain.handles.last() else {
        return false;
    };
    let mut final_path = [0_u16; 32_768];
    // SAFETY: home is a valid directory handle and final_path is a writable bounded buffer.
    let length = unsafe {
        GetFinalPathNameByHandleW(
            home.0,
            final_path.as_mut_ptr(),
            u32::try_from(final_path.len()).unwrap_or(0),
            0,
        )
    };
    let Ok(length) = usize::try_from(length) else {
        return false;
    };
    if length < 7
        || length >= final_path.len()
        || final_path[..4]
            != [
                u16::from(b'\\'),
                u16::from(b'\\'),
                u16::from(b'?'),
                u16::from(b'\\'),
            ]
        || !matches!(final_path[4], 0x41..=0x5a | 0x61..=0x7a)
        || final_path[5] != u16::from(b':')
        || final_path[6] != u16::from(b'\\')
    {
        return false;
    }
    let volume_root = [final_path[4], u16::from(b':'), u16::from(b'\\'), 0];
    // SAFETY: volume_root is a fixed NUL-terminated DOS drive root derived from the opened handle.
    (unsafe { GetDriveTypeW(volume_root.as_ptr()) }) == DRIVE_FIXED
}

fn provider_home_chain_stable(chain: &ProviderHomeChain) -> bool {
    chain.handles.len() == chain.identities.len()
        && chain
            .handles
            .iter()
            .zip(&chain.identities)
            .all(|(handle, expected)| {
                root_information(handle.0)
                    .map(|information| directory_identity(&information) == *expected)
                    .unwrap_or(false)
            })
}

fn root_information(handle: HANDLE) -> Option<BY_HANDLE_FILE_INFORMATION> {
    let mut information = BY_HANDLE_FILE_INFORMATION {
        dwFileAttributes: 0,
        ftCreationTime: Default::default(),
        ftLastAccessTime: Default::default(),
        ftLastWriteTime: Default::default(),
        dwVolumeSerialNumber: 0,
        nFileSizeHigh: 0,
        nFileSizeLow: 0,
        nNumberOfLinks: 0,
        nFileIndexHigh: 0,
        nFileIndexLow: 0,
    };
    // SAFETY: information is a valid writable output and handle remains owned by caller.
    let succeeded = unsafe { GetFileInformationByHandle(handle, &mut information) } != 0;
    succeeded.then_some(information)
}

fn identity_matches(information: &BY_HANDLE_FILE_INFORMATION, expected: FileIdentity) -> bool {
    information.dwVolumeSerialNumber == expected.volume_serial_number
        && information.nFileIndexHigh == expected.file_index_high
        && information.nFileIndexLow == expected.file_index_low
}

fn security_descriptor(handle: HANDLE) -> Option<OwnedSecurityDescriptor> {
    let mut descriptor = null_mut();
    // SAFETY: handle is a valid file handle. Only owner and DACL information are requested,
    // and descriptor is released by OwnedSecurityDescriptor.
    let result = unsafe {
        GetSecurityInfo(
            handle,
            SE_FILE_OBJECT,
            OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            &mut descriptor,
        )
    };
    (result == 0 && !descriptor.is_null()).then_some(OwnedSecurityDescriptor(descriptor))
}

fn process_tokens() -> Option<(OwnedHandle, OwnedHandle)> {
    let mut primary = null_mut();
    // SAFETY: GetCurrentProcess returns a process pseudo-handle and primary is writable.
    if unsafe {
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY | TOKEN_DUPLICATE,
            &mut primary,
        )
    } == 0
    {
        return None;
    }
    let primary = OwnedHandle(primary);
    let mut impersonation = null_mut();
    // SAFETY: primary owns a token with TOKEN_DUPLICATE and output is writable.
    if unsafe { DuplicateToken(primary.0, SecurityImpersonation, &mut impersonation) } == 0 {
        return None;
    }
    Some((primary, OwnedHandle(impersonation)))
}

fn sha256(parts: &[&[u8]]) -> Option<[u8; 32]> {
    let mut algorithm = null_mut();
    // SAFETY: algorithm is writable and SHA-256 requires no provider-specific input.
    if unsafe { BCryptOpenAlgorithmProvider(&mut algorithm, BCRYPT_SHA256_ALGORITHM, null(), 0) }
        < 0
    {
        return None;
    }
    let algorithm = OwnedAlgorithm(algorithm);
    let mut hash = null_mut();
    // SAFETY: the algorithm handle is valid; reusable object storage and secret are unused.
    if unsafe { BCryptCreateHash(algorithm.0, &mut hash, null_mut(), 0, null(), 0, 0) } < 0 {
        return None;
    }
    let hash = OwnedHash(hash);
    for part in parts {
        let length = u32::try_from(part.len()).ok()?;
        // SAFETY: part remains valid for the duration of the call.
        if unsafe { BCryptHashData(hash.0, part.as_ptr(), length, 0) } < 0 {
            return None;
        }
    }
    let mut output = [0_u8; 32];
    // SAFETY: output is a writable SHA-256-sized buffer and hash remains valid.
    if unsafe { BCryptFinishHash(hash.0, output.as_mut_ptr(), 32, 0) } < 0 {
        return None;
    }
    Some(output)
}

fn copy_sid_bytes(sid: PSID) -> Option<Vec<u8>> {
    if sid.is_null() || unsafe { IsValidSid(sid) } == 0 {
        return None;
    }
    let sid_length = usize::try_from(unsafe { GetLengthSid(sid) }).ok()?;
    if !(8..=68).contains(&sid_length) {
        return None;
    }
    // SAFETY: IsValidSid succeeded and GetLengthSid returned the readable SID length.
    Some(unsafe { std::slice::from_raw_parts(sid.cast::<u8>(), sid_length) }.to_vec())
}

fn token_user_sid_bytes(token: HANDLE) -> Option<Vec<u8>> {
    let mut required = 0_u32;
    // SAFETY: the null query obtains the required TOKEN_USER buffer length.
    unsafe { GetTokenInformation(token, TokenUser, null_mut(), 0, &mut required) };
    if required == 0 || required > 65_536 {
        return None;
    }
    let words = usize::try_from(required).ok()?.div_ceil(size_of::<usize>());
    let mut buffer = vec![0_usize; words];
    // SAFETY: buffer is aligned and at least required bytes long.
    if unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            buffer.as_mut_ptr().cast::<c_void>(),
            required,
            &mut required,
        )
    } == 0
    {
        return None;
    }
    // SAFETY: successful TokenUser output begins with an aligned valid TOKEN_USER structure.
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    copy_sid_bytes(user.User.Sid)
}

fn runtime_principal_identity_hash(token: HANDLE) -> Option<[u8; 32]> {
    let sid = token_user_sid_bytes(token)?;
    const DOMAIN: &[u8] = b"CRDD\0WINDOWS-RUNTIME-PRINCIPAL\0V1\0";
    let length = u64::try_from(sid.len()).ok()?.to_be_bytes();
    sha256(&[DOMAIN, &length, &sid])
}

fn token_authentication_id(token: HANDLE) -> Option<[u8; 8]> {
    let mut statistics = TOKEN_STATISTICS::default();
    let mut returned = 0_u32;
    // SAFETY: statistics is a correctly sized writable TOKEN_STATISTICS buffer.
    if unsafe {
        GetTokenInformation(
            token,
            TokenStatistics,
            (&raw mut statistics).cast::<c_void>(),
            u32::try_from(size_of::<TOKEN_STATISTICS>()).ok()?,
            &mut returned,
        )
    } == 0
        || returned != u32::try_from(size_of::<TOKEN_STATISTICS>()).ok()?
    {
        return None;
    }
    let mut bytes = [0_u8; 8];
    bytes[..4].copy_from_slice(&statistics.AuthenticationId.LowPart.to_le_bytes());
    bytes[4..].copy_from_slice(&statistics.AuthenticationId.HighPart.to_le_bytes());
    Some(bytes)
}

fn token_u32_information(token: HANDLE, information_class: i32) -> Option<u32> {
    let mut value = 0_u32;
    let mut returned = 0_u32;
    // SAFETY: value is a writable DWORD-sized buffer and token has TOKEN_QUERY access.
    if unsafe {
        GetTokenInformation(
            token,
            information_class,
            (&raw mut value).cast::<c_void>(),
            u32::try_from(size_of::<u32>()).ok()?,
            &mut returned,
        )
    } == 0
        || returned != u32::try_from(size_of::<u32>()).ok()?
    {
        return None;
    }
    Some(value)
}

fn well_known_membership(token: HANDLE, sid_type: i32) -> Option<bool> {
    let mut sid_words = [0_usize; 9];
    let mut sid_bytes = u32::try_from(size_of_val(&sid_words)).ok()?;
    // SAFETY: sid_words is aligned writable storage large enough for a maximum Windows SID.
    if unsafe {
        CreateWellKnownSid(
            sid_type,
            null_mut(),
            sid_words.as_mut_ptr().cast::<c_void>(),
            &mut sid_bytes,
        )
    } == 0
    {
        return None;
    }
    let mut is_member = 0;
    // SAFETY: the SID was produced by CreateWellKnownSid and token is an impersonation token.
    if unsafe {
        CheckTokenMembership(
            token,
            sid_words.as_mut_ptr().cast::<c_void>(),
            &mut is_member,
        )
    } == 0
    {
        return None;
    }
    Some(is_member != 0)
}

fn principal_observation_flags(primary: HANDLE, impersonation: HANDLE) -> Option<u32> {
    if token_u32_information(primary, TokenType)? != u32::try_from(TokenPrimary).ok()? {
        return None;
    }
    let mut flags = PRINCIPAL_PRIMARY_TOKEN;
    for (sid_type, flag) in [
        (WinInteractiveSid, PRINCIPAL_INTERACTIVE_GROUP),
        (WinServiceSid, PRINCIPAL_SERVICE_GROUP),
        (WinBatchSid, PRINCIPAL_BATCH_GROUP),
        (WinNetworkSid, PRINCIPAL_NETWORK_GROUP),
    ] {
        if well_known_membership(impersonation, sid_type)? {
            flags |= flag;
        }
    }
    if unsafe { IsTokenRestricted(primary) } != 0 {
        flags |= PRINCIPAL_RESTRICTED_TOKEN;
    }
    if token_u32_information(primary, TokenIsAppContainer)? != 0 {
        flags |= PRINCIPAL_APP_CONTAINER;
    }
    if token_u32_information(primary, TokenSessionId)? != 0 {
        flags |= PRINCIPAL_NONZERO_SESSION;
    }
    Some(flags)
}

fn selected_user_token_binding(
    primary: HANDLE,
    impersonation: HANDLE,
) -> Option<TokenBindingObservation> {
    let principal_flags = principal_observation_flags(primary, impersonation)?;
    if principal_flags & REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS
        != REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS
        || principal_flags & FORBIDDEN_SELECTED_USER_PRINCIPAL_FLAGS != 0
    {
        return None;
    }
    Some(TokenBindingObservation {
        principal_identity_hash: runtime_principal_identity_hash(primary)?,
        principal_flags,
        authentication_id: token_authentication_id(primary)?,
    })
}

fn local_user_binding_hash(binding: TokenBindingObservation) -> Option<[u8; 32]> {
    const DOMAIN: &[u8] = b"CRDD\0LOCAL-USER-BINDING\0V1\0";
    sha256(&[
        DOMAIN,
        &binding.principal_identity_hash,
        &binding.authentication_id,
        &binding.principal_flags.to_le_bytes(),
    ])
}

fn stable_logical_home_binding_hash(
    provider: crate::protocol::Provider,
    primary_token: HANDLE,
) -> Option<[u8; 32]> {
    const DOMAIN: &[u8] = b"CRDD\0LOGICAL-PROVIDER-HOME-LEASE\0V1\0";
    let user_sid = token_user_sid_bytes(primary_token)?;
    sha256(&[DOMAIN, &[provider as u8], &user_sid])
}

fn access_allowed(
    descriptor: PSECURITY_DESCRIPTOR,
    token: HANDLE,
    requested_access: u32,
) -> Option<bool> {
    let mapping = GENERIC_MAPPING {
        GenericRead: FILE_GENERIC_READ,
        GenericWrite: FILE_GENERIC_WRITE,
        GenericExecute: FILE_GENERIC_EXECUTE,
        GenericAll: FILE_ALL_ACCESS,
    };
    let mut desired_access = requested_access;
    // SAFETY: desired_access and mapping are valid for the duration of the call.
    unsafe { MapGenericMask(&mut desired_access, &mapping) };

    let mut privilege_length = u32::try_from(size_of::<PRIVILEGE_SET>()).ok()?;
    let initial_words = usize::try_from(privilege_length)
        .ok()?
        .div_ceil(size_of::<usize>());
    let mut privilege_words = vec![0_usize; initial_words];
    let mut granted_access = 0_u32;
    let mut access_status = 0_i32;
    // SAFETY: all buffers have the declared size; token is an impersonation token and
    // descriptor/mapping remain valid throughout the access check.
    let mut succeeded = unsafe {
        AccessCheck(
            descriptor,
            token,
            desired_access,
            &mapping,
            privilege_words.as_mut_ptr().cast::<PRIVILEGE_SET>(),
            &mut privilege_length,
            &mut granted_access,
            &mut access_status,
        )
    };
    if succeeded == 0
        && unsafe { windows_sys::Win32::Foundation::GetLastError() } == ERROR_INSUFFICIENT_BUFFER
    {
        let capacity_bytes = usize::try_from(privilege_length).ok()?;
        if capacity_bytes > 65_536 {
            return None;
        }
        let capacity_words = capacity_bytes.div_ceil(size_of::<usize>());
        privilege_words.resize(capacity_words, 0);
        // SAFETY: the buffer was resized to the length requested by AccessCheck.
        succeeded = unsafe {
            AccessCheck(
                descriptor,
                token,
                desired_access,
                &mapping,
                privilege_words.as_mut_ptr().cast::<PRIVILEGE_SET>(),
                &mut privilege_length,
                &mut granted_access,
                &mut access_status,
            )
        };
    }
    if succeeded == 0 {
        return None;
    }
    Some(access_status != 0)
}

fn local_system_sid_bytes() -> Option<Vec<u8>> {
    let mut storage = [0_usize; 9];
    let mut byte_length = u32::try_from(size_of_val(&storage)).ok()?;
    // SAFETY: storage is aligned writable memory large enough for a maximum Windows SID.
    if unsafe {
        CreateWellKnownSid(
            WinLocalSystemSid,
            null_mut(),
            storage.as_mut_ptr().cast::<c_void>(),
            &mut byte_length,
        )
    } == 0
    {
        return None;
    }
    copy_sid_bytes(storage.as_mut_ptr().cast::<c_void>())
}

fn bounded_ace_sid(ace: *const u8, ace_size: usize, sid_offset: usize) -> Option<Vec<u8>> {
    if ace.is_null() || sid_offset.checked_add(8)? > ace_size {
        return None;
    }
    // SAFETY: the caller established that the fixed SID header is contained in the ACE.
    let sid_header = unsafe { std::slice::from_raw_parts(ace.add(sid_offset), 8) };
    if sid_header[0] != 1 || sid_header[1] > 15 {
        return None;
    }
    let sid_length = 8_usize.checked_add(usize::from(sid_header[1]).checked_mul(4)?)?;
    if sid_offset.checked_add(sid_length)? > ace_size {
        return None;
    }
    // SAFETY: the length was derived from the bounded SID header and fits inside this ACE.
    Some(unsafe { std::slice::from_raw_parts(ace.add(sid_offset), sid_length) }.to_vec())
}

fn provider_home_identity_hash(
    request: &ProviderHomeRequest,
    identity: DirectoryIdentity,
) -> Option<[u8; 32]> {
    const DOMAIN: &[u8] = b"CRDD\0PROVIDER-HOME-IDENTITY\0V1\0";
    sha256(&[
        DOMAIN,
        &[request.provider as u8],
        &directory_identity_bytes(identity),
    ])
}

fn provider_home_mount_source_hash(request: &ProviderHomeRequest, path: &Path) -> Option<[u8; 32]> {
    const DOMAIN: &[u8] = b"CRDD\0PROVIDER-HOME-MOUNT-SOURCE\0V1\0";
    let mut path_bytes = Vec::new();
    for unit in path.as_os_str().encode_wide() {
        path_bytes.extend_from_slice(&unit.to_le_bytes());
    }
    if path_bytes.is_empty() || path_bytes.len() > 65_534 {
        return None;
    }
    sha256(&[DOMAIN, &[request.provider as u8], &path_bytes])
}

fn observe_provider_home_protection(
    request: &ProviderHomeRequest,
    descriptor: PSECURITY_DESCRIPTOR,
    primary_token: HANDLE,
    impersonation_token: HANDLE,
    binding: TokenBindingObservation,
    identity_hash: [u8; 32],
) -> Result<ProviderHomeProtectionObservation, ProviderHomeReason> {
    let user_sid =
        token_user_sid_bytes(primary_token).ok_or(ProviderHomeReason::PrincipalUnavailable)?;
    let system_sid = local_system_sid_bytes().ok_or(ProviderHomeReason::HomeSecurityUnavailable)?;

    let mut owner = null_mut();
    let mut owner_defaulted = 0;
    // SAFETY: descriptor is owned by the caller for this function and outputs are writable.
    if unsafe { GetSecurityDescriptorOwner(descriptor, &mut owner, &mut owner_defaulted) } == 0
        || owner_defaulted != 0
        || copy_sid_bytes(owner) != Some(user_sid.clone())
    {
        return Err(ProviderHomeReason::HomeOwnerMismatch);
    }

    let mut control = 0_u16;
    let mut revision = 0_u32;
    // SAFETY: descriptor remains valid and both scalar outputs are writable.
    if unsafe { GetSecurityDescriptorControl(descriptor, &mut control, &mut revision) } == 0
        || revision == 0
        || control & SE_DACL_PROTECTED == 0
    {
        return Err(ProviderHomeReason::HomeDaclNotProtected);
    }

    let mut dacl_present = 0;
    let mut dacl = null_mut();
    let mut dacl_defaulted = 0;
    // SAFETY: descriptor remains valid and the DACL outputs are writable.
    if unsafe {
        GetSecurityDescriptorDacl(
            descriptor,
            &mut dacl_present,
            &mut dacl,
            &mut dacl_defaulted,
        )
    } == 0
        || dacl_present == 0
        || dacl.is_null()
        || dacl_defaulted != 0
    {
        return Err(ProviderHomeReason::HomeDaclNotRestricted);
    }

    let mut acl_information = ACL_SIZE_INFORMATION::default();
    // SAFETY: dacl points inside the valid descriptor and acl_information is writable.
    if unsafe {
        GetAclInformation(
            dacl,
            (&raw mut acl_information).cast::<c_void>(),
            u32::try_from(size_of::<ACL_SIZE_INFORMATION>()).unwrap_or(0),
            AclSizeInformation,
        )
    } == 0
        || acl_information.AceCount != 2
        || usize::try_from(acl_information.AclBytesInUse).unwrap_or(usize::MAX)
            > MAXIMUM_SECURITY_DESCRIPTOR_BYTES
        || usize::from(unsafe { (*dacl).AclSize })
            < usize::try_from(acl_information.AclBytesInUse).unwrap_or(usize::MAX)
    {
        return Err(ProviderHomeReason::HomeDaclNotRestricted);
    }

    let mut user_ace = false;
    let mut system_ace = false;
    for ace_index in 0..acl_information.AceCount {
        let mut raw_ace = null_mut();
        // SAFETY: dacl is valid and raw_ace is a writable output for an in-range ACE index.
        if unsafe { GetAce(dacl, ace_index, &mut raw_ace) } == 0 || raw_ace.is_null() {
            return Err(ProviderHomeReason::HomeDaclNotRestricted);
        }
        let ace = raw_ace.cast::<u8>();
        // SAFETY: GetAce returned at least an ACE_HEADER for a valid ACL entry.
        let header = unsafe { &*raw_ace.cast::<windows_sys::Win32::Security::ACE_HEADER>() };
        let ace_size = usize::from(header.AceSize);
        if header.AceType != ACCESS_ALLOWED_ACE_TYPE
            || header.AceFlags & INHERITED_ACE != 0
            || header.AceFlags & (OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE)
                != OBJECT_INHERIT_ACE | CONTAINER_INHERIT_ACE
            || ace_size < size_of::<ACCESS_ALLOWED_ACE>()
        {
            return Err(ProviderHomeReason::HomeDaclNotRestricted);
        }
        // SAFETY: the ACE type and size were checked against ACCESS_ALLOWED_ACE.
        let allowed = unsafe { &*raw_ace.cast::<ACCESS_ALLOWED_ACE>() };
        let mut mask = allowed.Mask;
        let mapping = GENERIC_MAPPING {
            GenericRead: FILE_GENERIC_READ,
            GenericWrite: FILE_GENERIC_WRITE,
            GenericExecute: FILE_GENERIC_EXECUTE,
            GenericAll: FILE_ALL_ACCESS,
        };
        // SAFETY: mask and mapping are valid scalar values.
        unsafe { MapGenericMask(&mut mask, &mapping) };
        if mask & FILE_ALL_ACCESS != FILE_ALL_ACCESS {
            return Err(ProviderHomeReason::HomeDaclNotRestricted);
        }
        let sid_offset = std::mem::offset_of!(ACCESS_ALLOWED_ACE, SidStart);
        let Some(ace_sid) = bounded_ace_sid(ace, ace_size, sid_offset) else {
            return Err(ProviderHomeReason::HomeDaclNotRestricted);
        };
        if ace_sid == user_sid && !user_ace {
            user_ace = true;
        } else if ace_sid == system_sid && !system_ace {
            system_ace = true;
        } else {
            return Err(ProviderHomeReason::HomeDaclNotRestricted);
        }
    }
    if !user_ace || !system_ace {
        return Err(ProviderHomeReason::HomeDaclNotRestricted);
    }
    if access_allowed(descriptor, impersonation_token, FILE_ALL_ACCESS) != Some(true) {
        return Err(ProviderHomeReason::HomeAccessInsufficient);
    }

    let acl_bytes_in_use = usize::try_from(acl_information.AclBytesInUse)
        .map_err(|_| ProviderHomeReason::HomeSecurityUnavailable)?;
    // SAFETY: GetAclInformation verified AclBytesInUse within the descriptor-owned ACL.
    let acl_bytes = unsafe { std::slice::from_raw_parts(dacl.cast::<u8>(), acl_bytes_in_use) };
    const DOMAIN: &[u8] = b"CRDD\0PROVIDER-HOME-PROTECTION\0V1\0";
    let acl_length = u64::try_from(acl_bytes.len())
        .map_err(|_| ProviderHomeReason::HomeSecurityUnavailable)?
        .to_be_bytes();
    let protection_hash = sha256(&[
        DOMAIN,
        &[request.provider as u8],
        &identity_hash,
        &binding.principal_identity_hash,
        &binding.principal_flags.to_le_bytes(),
        &acl_length,
        acl_bytes,
    ])
    .ok_or(ProviderHomeReason::HomeSecurityUnavailable)?;
    Ok(ProviderHomeProtectionObservation {
        protection_hash,
        home_flags: PROVIDER_HOME_OWNER_SELECTED_USER
            | PROVIDER_HOME_DACL_PROTECTED
            | PROVIDER_HOME_WRITERS_RESTRICTED
            | PROVIDER_HOME_SELECTED_USER_FULL_CONTROL
            | PROVIDER_HOME_SYSTEM_FULL_CONTROL,
    })
}

pub fn observe_provider_home(request: &ProviderHomeRequest) -> ProviderHomeResponse {
    let Some((primary_token, impersonation_token)) = process_tokens() else {
        return blocked_provider_home(request, ProviderHomeReason::PrincipalUnavailable);
    };
    let Some(initial_binding) = selected_user_token_binding(primary_token.0, impersonation_token.0)
    else {
        return blocked_provider_home(request, ProviderHomeReason::PrincipalNotSelectedLocalUser);
    };
    if request.initialize_if_missing {
        let segments = match request.provider {
            crate::protocol::Provider::CandidateStore => &CANDIDATE_STORE_SEGMENTS,
            crate::protocol::Provider::RuntimeState => &RUNTIME_STATE_SEGMENTS,
            _ => return blocked_provider_home(request, ProviderHomeReason::InvalidRequest),
        };
        if !initialize_runtime_owned_directory_if_missing(primary_token.0, segments) {
            return blocked_provider_home(request, ProviderHomeReason::HomeUnavailable);
        }
    }
    let chain = match open_provider_home_chain(request) {
        Ok(value) => value,
        Err(ProviderHomeChainError::KnownFolderUnavailable) => {
            return blocked_provider_home(request, ProviderHomeReason::KnownFolderUnavailable);
        }
        Err(ProviderHomeChainError::HomeUnavailable) => {
            return blocked_provider_home(request, ProviderHomeReason::HomeUnavailable);
        }
        Err(ProviderHomeChainError::ReparseRejected) => {
            return blocked_provider_home(request, ProviderHomeReason::HomeReparseRejected);
        }
        Err(ProviderHomeChainError::MountSourceMismatch) => {
            return blocked_provider_home(request, ProviderHomeReason::MountSourceMismatch);
        }
    };
    if !provider_home_on_fixed_volume(&chain) {
        return blocked_provider_home(request, ProviderHomeReason::HomeNotFixedVolume);
    }
    let Some(home_handle) = chain.handles.last() else {
        return blocked_provider_home(request, ProviderHomeReason::HomeUnavailable);
    };
    let Some(home_identity) = chain.identities.last().copied() else {
        return blocked_provider_home(request, ProviderHomeReason::HomeUnavailable);
    };
    let Some(identity_hash) = provider_home_identity_hash(request, home_identity) else {
        return blocked_provider_home(request, ProviderHomeReason::HomeSecurityUnavailable);
    };
    let Some(descriptor) = security_descriptor(home_handle.0) else {
        return blocked_provider_home(request, ProviderHomeReason::HomeSecurityUnavailable);
    };
    let protection = match observe_provider_home_protection(
        request,
        descriptor.0,
        primary_token.0,
        impersonation_token.0,
        initial_binding,
        identity_hash,
    ) {
        Ok(value) => value,
        Err(reason) => return blocked_provider_home(request, reason),
    };
    let Some(final_binding) = selected_user_token_binding(primary_token.0, impersonation_token.0)
    else {
        return blocked_provider_home(request, ProviderHomeReason::PrincipalUnavailable);
    };
    if final_binding != initial_binding || !provider_home_chain_stable(&chain) {
        return blocked_provider_home(request, ProviderHomeReason::HomeIdentityChanged);
    }
    let Some(binding_hash) = local_user_binding_hash(initial_binding) else {
        return blocked_provider_home(request, ProviderHomeReason::HomeSecurityUnavailable);
    };
    let Some(stable_logical_home_binding_hash) =
        stable_logical_home_binding_hash(request.provider, primary_token.0)
    else {
        return blocked_provider_home(request, ProviderHomeReason::HomeSecurityUnavailable);
    };
    ProviderHomeResponse {
        provider: request.provider,
        nonce: request.nonce,
        is_candidate: true,
        reason: ProviderHomeReason::ObservationCandidate,
        principal_observation_flags: initial_binding.principal_flags,
        home_observation_flags: PROVIDER_HOME_DIRECTORY
            | PROVIDER_HOME_FIXED_VOLUME
            | PROVIDER_HOME_NO_REPARSE_CHAIN
            | PROVIDER_HOME_STABLE_IDENTITY
            | protection.home_flags,
        provider_home_identity_hash: identity_hash,
        provider_home_protection_hash: protection.protection_hash,
        local_user_binding_hash: binding_hash,
        stable_logical_home_binding_hash,
    }
}

pub fn observe(request: &Request) -> Response {
    let Some(root) = open_root(&request.path) else {
        return blocked(request, Reason::RootOpenFailed);
    };
    let Some(initial_information) = root_information(root.0) else {
        return blocked(request, Reason::RootOpenFailed);
    };
    if initial_information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
        return blocked(request, Reason::RootOpenFailed);
    }
    if initial_information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return blocked(request, Reason::RootReparseRejected);
    }
    if !identity_matches(&initial_information, request.expected_identity) {
        return blocked(request, Reason::RootIdentityMismatch);
    }
    let Some(descriptor) = security_descriptor(root.0) else {
        return blocked(request, Reason::SecurityDescriptorUnavailable);
    };
    let Some((primary_token, impersonation_token)) = process_tokens() else {
        return blocked(request, Reason::ProcessTokenUnavailable);
    };
    let Some(principal_identity_hash) = runtime_principal_identity_hash(primary_token.0) else {
        return blocked(request, Reason::ProcessTokenUnavailable);
    };
    let Some(principal_flags) = principal_observation_flags(primary_token.0, impersonation_token.0)
    else {
        return blocked(request, Reason::ProcessTokenUnavailable);
    };
    let checks = [
        (
            ACCESS_READ_TRAVERSE,
            FILE_LIST_DIRECTORY | FILE_TRAVERSE | FILE_READ_ATTRIBUTES,
        ),
        (ACCESS_ADD_FILE, FILE_ADD_FILE),
        (ACCESS_ADD_SUBDIRECTORY, FILE_ADD_SUBDIRECTORY),
        (ACCESS_WRITE_EA, FILE_WRITE_EA),
        (ACCESS_WRITE_ATTRIBUTES, FILE_WRITE_ATTRIBUTES),
        (ACCESS_DELETE_CHILD, FILE_DELETE_CHILD),
        (ACCESS_DELETE_ON_ROOT_OBJECT, DELETE),
        (ACCESS_WRITE_DAC, WRITE_DAC),
        (ACCESS_WRITE_OWNER, WRITE_OWNER),
    ];
    let mut access_mask = 0_u32;
    for (flag, requested_access) in checks {
        let Some(is_allowed) =
            access_allowed(descriptor.0, impersonation_token.0, requested_access)
        else {
            return blocked(request, Reason::AccessCheckFailed);
        };
        if is_allowed {
            access_mask |= flag;
        }
    }
    let Some(final_information) = root_information(root.0) else {
        return blocked(request, Reason::RootOpenFailed);
    };
    if !identity_matches(&final_information, request.expected_identity)
        || final_information.dwFileAttributes != initial_information.dwFileAttributes
    {
        return blocked(request, Reason::RootIdentityMismatch);
    }
    Response {
        root_role: request.root_role,
        nonce: request.nonce,
        is_candidate: true,
        reason: Reason::ObservationCandidate,
        access_mask,
        runtime_principal_identity_hash: principal_identity_hash,
        principal_observation_flags: principal_flags,
    }
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::protocol::RootRole;

    #[test]
    fn observes_current_process_access_without_mutating_root() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root_path = std::env::temp_dir().join(format!(
            "crdd-platform-access-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&root_path).unwrap();
        let identity = {
            let root = open_root(root_path.to_str().unwrap()).unwrap();
            let information = root_information(root.0).unwrap();
            FileIdentity {
                volume_serial_number: information.dwVolumeSerialNumber,
                file_index_high: information.nFileIndexHigh,
                file_index_low: information.nFileIndexLow,
            }
        };
        let request = Request {
            root_role: RootRole::Authority,
            nonce: [9_u8; 32],
            expected_identity: identity,
            path: root_path.to_str().unwrap().to_owned(),
        };
        let response = observe(&request);
        assert!(response.is_candidate, "{response:?}");
        assert_eq!(response.reason, Reason::ObservationCandidate);
        assert_eq!(response.nonce, request.nonce);
        assert!(root_path.is_dir());
        fs::remove_dir(root_path).unwrap();
    }

    #[test]
    fn blocks_missing_non_directory_and_identity_mismatch() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temporary_root = std::env::temp_dir().join(format!(
            "crdd-platform-access-negative-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&temporary_root).unwrap();
        let file_path = temporary_root.join("regular-file");
        fs::write(&file_path, b"not a directory").unwrap();
        let missing_path = temporary_root.join("missing");
        let expected_identity = FileIdentity {
            volume_serial_number: 0,
            file_index_high: 0,
            file_index_low: 0,
        };
        for path in [&missing_path, &file_path] {
            let request = Request {
                root_role: RootRole::Runtime,
                nonce: [4_u8; 32],
                expected_identity,
                path: path.to_str().unwrap().to_owned(),
            };
            let response = observe(&request);
            assert!(!response.is_candidate);
            assert_eq!(response.reason, Reason::RootOpenFailed);
            assert_eq!(response.access_mask, 0);
        }
        let mismatch_request = Request {
            root_role: RootRole::Runtime,
            nonce: [5_u8; 32],
            expected_identity,
            path: temporary_root.to_str().unwrap().to_owned(),
        };
        let mismatch_response = observe(&mismatch_request);
        assert!(!mismatch_response.is_candidate);
        assert_eq!(mismatch_response.reason, Reason::RootIdentityMismatch);
        assert_eq!(mismatch_response.access_mask, 0);
        fs::remove_file(file_path).unwrap();
        fs::remove_dir(temporary_root).unwrap();
    }

    #[test]
    fn provider_home_hash_domains_bind_provider_identity_and_login_session() {
        let codex = ProviderHomeRequest {
            provider: crate::protocol::Provider::Codex,
            initialize_if_missing: false,
            nonce: [1_u8; 32],
            mount_source_hash: [2_u8; 32],
        };
        let claude = ProviderHomeRequest {
            provider: crate::protocol::Provider::Claude,
            initialize_if_missing: false,
            nonce: [1_u8; 32],
            mount_source_hash: [2_u8; 32],
        };
        let identity = DirectoryIdentity {
            volume_serial_number: 1,
            file_index_high: 2,
            file_index_low: 3,
            creation_time_low: 4,
            creation_time_high: 5,
            attributes: FILE_ATTRIBUTE_DIRECTORY,
        };
        assert_ne!(
            provider_home_identity_hash(&codex, identity),
            provider_home_identity_hash(&claude, identity)
        );
        assert_ne!(
            provider_home_mount_source_hash(&codex, Path::new(r"C:\ProviderHomes\codex")),
            provider_home_mount_source_hash(&claude, Path::new(r"C:\ProviderHomes\claude"))
        );

        let binding = TokenBindingObservation {
            principal_identity_hash: [7_u8; 32],
            principal_flags: REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS,
            authentication_id: [8_u8; 8],
        };
        let mut next_login = binding;
        next_login.authentication_id[0] ^= 1;
        assert_ne!(
            local_user_binding_hash(binding),
            local_user_binding_hash(next_login)
        );
    }

    #[test]
    fn bounded_ace_sid_rejects_truncated_or_noncanonical_sid() {
        let valid = [1_u8, 1, 0, 0, 0, 0, 0, 5, 18, 0, 0, 0];
        assert_eq!(
            bounded_ace_sid(valid.as_ptr(), valid.len(), 0),
            Some(valid.to_vec())
        );
        assert_eq!(bounded_ace_sid(valid.as_ptr(), valid.len() - 1, 0), None);
        let mut wrong_revision = valid;
        wrong_revision[0] = 2;
        assert_eq!(
            bounded_ace_sid(wrong_revision.as_ptr(), wrong_revision.len(), 0),
            None
        );
        let mut too_many_subauthorities = valid;
        too_many_subauthorities[1] = 16;
        assert_eq!(
            bounded_ace_sid(
                too_many_subauthorities.as_ptr(),
                too_many_subauthorities.len(),
                0
            ),
            None
        );
    }
}
