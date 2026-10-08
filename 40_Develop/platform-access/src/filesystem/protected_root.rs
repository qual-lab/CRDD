//! 固定Provider HomeとRuntime所有NamespaceをWindows APIで観測する。
//!
//! @responsibility 固定親、実体、保護条件と主体Bindingを照合し、用途限定の観測結果だけを返す。
//! @trace ARCH-000008
//! @trace ARCH-000011

use crate::filesystem::protection::{
    ACCESS_ALLOWED_ACE_TYPE, CONTAINER_INHERIT_ACE, DirectoryIdentity, INHERITED_ACE,
    OBJECT_INHERIT_ACE, OwnedHandle, access_allowed, bounded_ace_sid, directory_identity,
    directory_identity_bytes, open_directory, root_information, security_descriptor, sha256,
};
use crate::filesystem::windows_directory::{MAXIMUM_KNOWN_FOLDER_CODE_UNITS, local_app_data_path};
use crate::process::principal::{
    TokenBindingObservation, copy_sid_bytes, local_system_sid_bytes, local_user_binding_hash,
    process_tokens, selected_user_token_binding, token_user_sid_bytes,
};
use crate::protocol::access::{
    PROVIDER_HOME_DACL_PROTECTED, PROVIDER_HOME_DIRECTORY, PROVIDER_HOME_FIXED_VOLUME,
    PROVIDER_HOME_NO_REPARSE_CHAIN, PROVIDER_HOME_OWNER_SELECTED_USER,
    PROVIDER_HOME_SELECTED_USER_FULL_CONTROL, PROVIDER_HOME_STABLE_IDENTITY,
    PROVIDER_HOME_SYSTEM_FULL_CONTROL, PROVIDER_HOME_WRITERS_RESTRICTED, ProviderHomeReason,
    ProviderHomeRequest, ProviderHomeResponse,
};
use std::ffi::c_void;
use std::mem::size_of;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::{ERROR_ALREADY_EXISTS, GetLastError, HANDLE};
use windows_sys::Win32::Security::{
    ACCESS_ALLOWED_ACE, ACL, ACL_REVISION, ACL_SIZE_INFORMATION, AclSizeInformation,
    AddAccessAllowedAceEx, GENERIC_MAPPING, GetAce, GetAclInformation,
    GetSecurityDescriptorControl, GetSecurityDescriptorDacl, GetSecurityDescriptorOwner,
    InitializeAcl, InitializeSecurityDescriptor, MapGenericMask, PSECURITY_DESCRIPTOR,
    SE_DACL_PROTECTED, SECURITY_ATTRIBUTES, SECURITY_DESCRIPTOR, SetSecurityDescriptorControl,
    SetSecurityDescriptorDacl, SetSecurityDescriptorOwner,
};
use windows_sys::Win32::Storage::FileSystem::{
    CreateDirectoryW, FILE_ALL_ACCESS, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_GENERIC_EXECUTE, FILE_GENERIC_READ, FILE_GENERIC_WRITE, GetDriveTypeW,
    GetFinalPathNameByHandleW,
};

const PROVIDER_HOME_SEGMENTS: [&str; 3] = ["Qual-Lab", "CRDD", "ProviderHomes"];
const CANDIDATE_STORE_SEGMENTS: [&str; 3] = ["Qual-Lab", "CRDD", "CandidateStore"];
const RUNTIME_STATE_SEGMENTS: [&str; 3] = ["Qual-Lab", "CRDD", "RuntimeState"];
pub(crate) const DRIVE_FIXED: u32 = 3;
const MAXIMUM_SECURITY_DESCRIPTOR_BYTES: usize = 65_536;

/// Windows Root・Provider Home観測で使用するProviderHomeChain契約を表す。
///
/// @responsibility ProviderHomeChainが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
struct ProviderHomeChain {
    handles: Vec<OwnedHandle>,
    identities: Vec<DirectoryIdentity>,
}

/// Windows Root・Provider Home観測で使用するProviderHomeProtectionObservation契約を表す。
///
/// @responsibility ProviderHomeProtectionObservationが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
struct ProviderHomeProtectionObservation {
    protection_hash: [u8; 32],
    home_flags: u32,
}

/// Windows Root・Provider Home観測で使用するProviderHomeChainError契約を表す。
///
/// @responsibility ProviderHomeChainErrorが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape enumとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
enum ProviderHomeChainError {
    KnownFolderUnavailable,
    HomeUnavailable,
    ReparseRejected,
    MountSourceMismatch,
}

/// Windows Root・Provider Home観測のblocked provider home責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のblocked provider home責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
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

/// Windows Root・Provider Home観測のinitialize runtime owned directory if missing責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のinitialize runtime owned directory if missing責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
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

/// provider home chainを固定Identityで開く。
///
/// @responsibility provider home chainを固定Identityで開く責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn open_provider_home_chain(
    request: &ProviderHomeRequest,
) -> Result<ProviderHomeChain, ProviderHomeChainError> {
    let mut current =
        local_app_data_path().ok_or(ProviderHomeChainError::KnownFolderUnavailable)?;
    let mut paths = Vec::with_capacity(PROVIDER_HOME_SEGMENTS.len() + 2);
    paths.push(current.clone());
    if matches!(
        request.provider,
        crate::protocol::access::Provider::CandidateStore
            | crate::protocol::access::Provider::RuntimeState
    ) {
        let segments = if request.provider == crate::protocol::access::Provider::CandidateStore {
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

/// Windows Root・Provider Home観測のprovider home on fixed volume責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のprovider home on fixed volume責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
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

/// Windows Root・Provider Home観測のprovider home chain stable責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のprovider home chain stable責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
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

/// Windows Root・Provider Home観測のstable logical home binding hash責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のstable logical home binding hash責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn stable_logical_home_binding_hash(
    provider: crate::protocol::access::Provider,
    primary_token: HANDLE,
) -> Option<[u8; 32]> {
    const DOMAIN: &[u8] = b"CRDD\0LOGICAL-PROVIDER-HOME-LEASE\0V1\0";
    let user_sid = token_user_sid_bytes(primary_token)?;
    sha256(&[DOMAIN, &[provider as u8], &user_sid])
}

/// Windows Root・Provider Home観測のprovider home identity hash責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のprovider home identity hash責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn provider_home_identity_hash(
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

/// Windows Root・Provider Home観測のprovider home mount source hash責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のprovider home mount source hash責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn provider_home_mount_source_hash(
    request: &ProviderHomeRequest,
    path: &Path,
) -> Option<[u8; 32]> {
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

/// provider home protectionを候補と確定結果を分けて観測する。
///
/// @responsibility provider home protectionを候補と確定結果を分けて観測する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
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

/// provider homeを候補と確定結果を分けて観測する。
///
/// @responsibility provider homeを候補と確定結果を分けて観測する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
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
            crate::protocol::access::Provider::CandidateStore => &CANDIDATE_STORE_SEGMENTS,
            crate::protocol::access::Provider::RuntimeState => &RUNTIME_STATE_SEGMENTS,
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
