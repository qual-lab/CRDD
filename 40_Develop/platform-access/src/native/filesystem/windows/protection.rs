//! WindowsのHandle所有、Filesystem実体と保護条件を観測する。
//!
//! @responsibility 所有Handle・security descriptor・hash resourceの解放、Directory Identity、同一実体とACL AccessCheckを提供する。Provider選択や回復判断を所有しない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use crate::filesystem::windows_directory::MAXIMUM_KNOWN_FOLDER_CODE_UNITS;
use crate::protocol::access::FileIdentity;
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
    AccessCheck, DACL_SECURITY_INFORMATION, GENERIC_MAPPING, GROUP_SECURITY_INFORMATION,
    MapGenericMask, OWNER_SECURITY_INFORMATION, PRIVILEGE_SET, PSECURITY_DESCRIPTOR,
};
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateFileW, FILE_ALL_ACCESS, FILE_FLAG_BACKUP_SEMANTICS,
    FILE_FLAG_OPEN_REPARSE_POINT, FILE_GENERIC_EXECUTE, FILE_GENERIC_READ, FILE_GENERIC_WRITE,
    FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    GetFileInformationByHandle, OPEN_EXISTING, READ_CONTROL,
};

/// Windows Root・Provider Home観測で使用するDirectoryIdentity契約を表す。
///
/// @responsibility DirectoryIdentityが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct DirectoryIdentity {
    pub(crate) volume_serial_number: u32,
    pub(crate) file_index_high: u32,
    pub(crate) file_index_low: u32,
    pub(crate) creation_time_low: u32,
    pub(crate) creation_time_high: u32,
    pub(crate) attributes: u32,
}

/// Windows Root・Provider Home観測で使用するOwnedHandle契約を表す。
///
/// @responsibility OwnedHandleが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
pub(crate) struct OwnedHandle(pub(crate) HANDLE);

impl Drop for OwnedHandle {
    /// Windows Root・Provider Home観測が所有するNative Resourceを解放する。
    ///
    /// @responsibility 一意に所有するOS HandleまたはNative Contextを一回だけ解放する。
    /// @trace ARCH-000011
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
    /// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Native Worker→Windows Identity／ACL API。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
    fn drop(&mut self) {
        if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
            // SAFETY: this type exclusively owns the valid Windows handle.
            unsafe { CloseHandle(self.0) };
        }
    }
}

/// Windows Root・Provider Home観測で使用するOwnedSecurityDescriptor契約を表す。
///
/// @responsibility OwnedSecurityDescriptorが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
pub(crate) struct OwnedSecurityDescriptor(pub(crate) PSECURITY_DESCRIPTOR);

impl Drop for OwnedSecurityDescriptor {
    /// Windows Root・Provider Home観測が所有するNative Resourceを解放する。
    ///
    /// @responsibility 一意に所有するOS HandleまたはNative Contextを一回だけ解放する。
    /// @trace ARCH-000011
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
    /// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Native Worker→Windows Identity／ACL API。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: GetSecurityInfo allocates this descriptor with LocalAlloc.
            unsafe { LocalFree(self.0.cast::<c_void>()) };
        }
    }
}

/// Windows Root・Provider Home観測で使用するOwnedAlgorithm契約を表す。
///
/// @responsibility OwnedAlgorithmが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
struct OwnedAlgorithm(BCRYPT_ALG_HANDLE);

impl Drop for OwnedAlgorithm {
    /// Windows Root・Provider Home観測が所有するNative Resourceを解放する。
    ///
    /// @responsibility 一意に所有するOS HandleまたはNative Contextを一回だけ解放する。
    /// @trace ARCH-000011
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
    /// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Native Worker→Windows Identity／ACL API。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: this type exclusively owns the algorithm provider handle.
            unsafe { BCryptCloseAlgorithmProvider(self.0, 0) };
        }
    }
}

/// Windows Root・Provider Home観測で使用するOwnedHash契約を表す。
///
/// @responsibility OwnedHashが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
struct OwnedHash(BCRYPT_HASH_HANDLE);

impl Drop for OwnedHash {
    /// Windows Root・Provider Home観測が所有するNative Resourceを解放する。
    ///
    /// @responsibility 一意に所有するOS HandleまたはNative Contextを一回だけ解放する。
    /// @trace ARCH-000011
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
    /// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Native Worker→Windows Identity／ACL API。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: this type exclusively owns the hash handle.
            unsafe { BCryptDestroyHash(self.0) };
        }
    }
}

/// Windows Root・Provider Home観測のdirectory identity責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のdirectory identity責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn directory_identity(information: &BY_HANDLE_FILE_INFORMATION) -> DirectoryIdentity {
    DirectoryIdentity {
        volume_serial_number: information.dwVolumeSerialNumber,
        file_index_high: information.nFileIndexHigh,
        file_index_low: information.nFileIndexLow,
        creation_time_low: information.ftCreationTime.dwLowDateTime,
        creation_time_high: information.ftCreationTime.dwHighDateTime,
        attributes: information.dwFileAttributes,
    }
}

/// Windows Root・Provider Home観測のdirectory identity bytes責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のdirectory identity bytes責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn directory_identity_bytes(identity: DirectoryIdentity) -> [u8; 24] {
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

/// rootを固定Identityで開く。
///
/// @responsibility rootを固定Identityで開く責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn open_root(path: &str) -> Option<OwnedHandle> {
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

/// directoryを固定Identityで開く。
///
/// @responsibility directoryを固定Identityで開く責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn open_directory(path: &Path) -> Option<OwnedHandle> {
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

/// Windows Root・Provider Home観測のroot information責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のroot information責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn root_information(handle: HANDLE) -> Option<BY_HANDLE_FILE_INFORMATION> {
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

/// Windows Root・Provider Home観測のidentity matches責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のidentity matches責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn identity_matches(
    information: &BY_HANDLE_FILE_INFORMATION,
    expected: FileIdentity,
) -> bool {
    information.dwVolumeSerialNumber == expected.volume_serial_number
        && information.nFileIndexHigh == expected.file_index_high
        && information.nFileIndexLow == expected.file_index_low
}

/// Windows Root・Provider Home観測のsecurity descriptor責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のsecurity descriptor責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn security_descriptor(handle: HANDLE) -> Option<OwnedSecurityDescriptor> {
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

/// sha256を固定した入力から計算する。
///
/// @responsibility sha256を固定した入力から計算する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn sha256(parts: &[&[u8]]) -> Option<[u8; 32]> {
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

/// Windows Root・Provider Home観測のaccess allowed責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のaccess allowed責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn access_allowed(
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

pub(crate) const ACCESS_ALLOWED_ACE_TYPE: u8 = 0;
pub(crate) const INHERITED_ACE: u8 = 0x10;
pub(crate) const OBJECT_INHERIT_ACE: u8 = 0x01;
pub(crate) const CONTAINER_INHERIT_ACE: u8 = 0x02;

/// Windows Root・Provider Home観測のbounded ace sid責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のbounded ace sid責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn bounded_ace_sid(
    ace: *const u8,
    ace_size: usize,
    sid_offset: usize,
) -> Option<Vec<u8>> {
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
