use std::ffi::c_void;
use std::mem::size_of;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::ptr::{null, null_mut};

use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_INSUFFICIENT_BUFFER, HANDLE, INVALID_HANDLE_VALUE, LocalFree,
};
use windows_sys::Win32::Security::Authorization::{GetSecurityInfo, SE_FILE_OBJECT};
use windows_sys::Win32::Security::Cryptography::{
    BCRYPT_ALG_HANDLE, BCRYPT_HASH_HANDLE, BCRYPT_SHA256_ALGORITHM, BCryptCloseAlgorithmProvider,
    BCryptCreateHash, BCryptDestroyHash, BCryptFinishHash, BCryptHashData,
    BCryptOpenAlgorithmProvider,
};
use windows_sys::Win32::Security::{
    AccessCheck, DACL_SECURITY_INFORMATION, DuplicateToken, GENERIC_MAPPING,
    GROUP_SECURITY_INFORMATION, GetLengthSid, GetTokenInformation, IsValidSid, MapGenericMask,
    OWNER_SECURITY_INFORMATION, PRIVILEGE_SET, PSECURITY_DESCRIPTOR, SecurityImpersonation,
    TOKEN_DUPLICATE, TOKEN_QUERY, TOKEN_USER, TokenUser,
};
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateFileW, DELETE, FILE_ADD_FILE, FILE_ADD_SUBDIRECTORY,
    FILE_ALL_ACCESS, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT, FILE_DELETE_CHILD,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_GENERIC_EXECUTE,
    FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_LIST_DIRECTORY, FILE_READ_ATTRIBUTES,
    FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, FILE_TRAVERSE, FILE_WRITE_ATTRIBUTES,
    FILE_WRITE_EA, GetFileInformationByHandle, OPEN_EXISTING, READ_CONTROL, WRITE_DAC, WRITE_OWNER,
};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

use crate::protocol::{FileIdentity, Reason, Request, Response};

pub const ACCESS_READ_TRAVERSE: u32 = 1 << 0;
pub const ACCESS_ADD_FILE: u32 = 1 << 1;
pub const ACCESS_ADD_SUBDIRECTORY: u32 = 1 << 2;
pub const ACCESS_WRITE_EA: u32 = 1 << 3;
pub const ACCESS_WRITE_ATTRIBUTES: u32 = 1 << 4;
pub const ACCESS_DELETE_CHILD: u32 = 1 << 5;
pub const ACCESS_DELETE_ON_ROOT_OBJECT: u32 = 1 << 6;
pub const ACCESS_WRITE_DAC: u32 = 1 << 7;
pub const ACCESS_WRITE_OWNER: u32 = 1 << 8;

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
    }
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

fn runtime_principal_identity_hash(token: HANDLE) -> Option<[u8; 32]> {
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
    // SAFETY: successful TokenUser output begins with a valid TOKEN_USER structure.
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    if user.User.Sid.is_null() || unsafe { IsValidSid(user.User.Sid) } == 0 {
        return None;
    }
    let sid_length = usize::try_from(unsafe { GetLengthSid(user.User.Sid) }).ok()?;
    if !(8..=68).contains(&sid_length) {
        return None;
    }
    // SAFETY: IsValidSid succeeded and GetLengthSid returned the readable SID length.
    let sid = unsafe { std::slice::from_raw_parts(user.User.Sid.cast::<u8>(), sid_length) };
    const DOMAIN: &[u8] = b"CRDD\0WINDOWS-RUNTIME-PRINCIPAL\0V1\0";
    let length = u64::try_from(sid.len()).ok()?.to_be_bytes();
    sha256(&[DOMAIN, &length, sid])
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
}
