//! Docker Desktopの固定実行物とProcessの同一性を観測する。
//!
//! @responsibility 固定Pathの実体・署名・ハッシュとProcess Path・作成時刻を照合し、観測不能を不存在へ変換しない。停止・起動処理は所有しない。
//! @trace ARCH-000008
//! @trace ARCH-000014

use std::ffi::{OsString, c_void};
use std::fs::{File, OpenOptions};
use std::io::{Read, Seek, SeekFrom};
use std::mem::size_of;
use std::os::windows::ffi::OsStringExt;
use std::os::windows::fs::OpenOptionsExt;
use std::os::windows::io::AsRawHandle;
use std::path::PathBuf;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_NO_MORE_FILES, FILETIME, GetLastError, HANDLE, INVALID_HANDLE_VALUE,
    STILL_ACTIVE,
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
use windows_sys::Win32::System::Threading::{
    GetExitCodeProcess, GetProcessTimes, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
    PROCESS_TERMINATE, QueryFullProcessImageNameW,
};

const MAXIMUM_ARTIFACT_BYTES: u64 = 512 * 1024 * 1024;
const MAXIMUM_PROCESS_ENTRIES: usize = 4_096;
const SYNCHRONIZE_ACCESS: u32 = 0x0010_0000;

/// Docker Desktop修復で使用するOwnedHandle契約を表す。
///
/// @responsibility OwnedHandleが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
pub(super) struct OwnedHandle(pub(super) HANDLE);

impl Drop for OwnedHandle {
    /// Docker Desktop修復が所有するNative Resourceを解放する。
    ///
    /// @responsibility 一意に所有するOS HandleまたはNative Contextを一回だけ解放する。
    /// @trace ARCH-000008
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
    /// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
    fn drop(&mut self) {
        if !self.0.is_null() && self.0 != INVALID_HANDLE_VALUE {
            // SAFETY: this type exclusively owns the valid Windows handle.
            unsafe { CloseHandle(self.0) };
        }
    }
}

/// Docker Desktop修復で使用するOwnedAlgorithm契約を表す。
///
/// @responsibility OwnedAlgorithmが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
struct OwnedAlgorithm(BCRYPT_ALG_HANDLE);

impl Drop for OwnedAlgorithm {
    /// Docker Desktop修復が所有するNative Resourceを解放する。
    ///
    /// @responsibility 一意に所有するOS HandleまたはNative Contextを一回だけ解放する。
    /// @trace ARCH-000008
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
    /// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: this type exclusively owns the algorithm provider handle.
            unsafe { BCryptCloseAlgorithmProvider(self.0, 0) };
        }
    }
}

/// Docker Desktop修復で使用するOwnedHash契約を表す。
///
/// @responsibility OwnedHashが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
struct OwnedHash(BCRYPT_HASH_HANDLE);

impl Drop for OwnedHash {
    /// Docker Desktop修復が所有するNative Resourceを解放する。
    ///
    /// @responsibility 一意に所有するOS HandleまたはNative Contextを一回だけ解放する。
    /// @trace ARCH-000008
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 完了または拒否後に、所有するResourceの状態を観測可能な形へ確定する。
    /// @effect 対象のNative ResourceまたはProcessだけへ限定Effectを発行する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency 所有Handleと終了観測を同じ呼出しlifecycleへ限定し、競合時は安全側に失敗する。
    fn drop(&mut self) {
        if !self.0.is_null() {
            // SAFETY: this type exclusively owns the hash handle.
            unsafe { BCryptDestroyHash(self.0) };
        }
    }
}

/// Docker Desktop修復で使用するPolicyArtifact契約を表す。
///
/// @responsibility PolicyArtifactが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
#[derive(Clone)]
pub(super) struct PolicyArtifact {
    pub(super) role: String,
    pub(super) path: PathBuf,
    pub(super) bytes: u64,
    pub(super) sha256: [u8; 32],
}

/// Docker Desktop修復で使用するLockedArtifact契約を表す。
///
/// @responsibility LockedArtifactが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
pub(super) struct LockedArtifact {
    pub(super) policy: PolicyArtifact,
    pub(super) file: File,
    pub(super) information: BY_HANDLE_FILE_INFORMATION,
}

/// Docker Desktop修復で使用するVerifiedProcess契約を表す。
///
/// @responsibility VerifiedProcessが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
pub(super) struct VerifiedProcess {
    pub(super) handle: OwnedHandle,
    pub(super) process_id: u32,
    pub(super) creation: u64,
}

/// Docker Desktop修復で使用するProcessInventory契約を表す。
///
/// @responsibility ProcessInventoryが保持するDocker Desktop修復の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape enumとしてDocker Desktop修復のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→固定Policy Artifact→Docker Desktop Process。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
pub(super) enum ProcessInventory {
    Absent,
    Verified(Vec<VerifiedProcess>),
    Unknown,
}

/// Docker Desktop修復のbegin sha256責務を実行する。
///
/// @responsibility Docker Desktop修復のbegin sha256責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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

/// sha256 bytesを固定した入力から計算する。
///
/// @responsibility sha256 bytesを固定した入力から計算する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn sha256_bytes(bytes: &[u8]) -> Option<[u8; 32]> {
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

/// sha256 fileを固定した入力から計算する。
///
/// @responsibility sha256 fileを固定した入力から計算する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn sha256_file(file: &mut File, expected_bytes: u64) -> Option<[u8; 32]> {
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

/// Docker Desktop修復のhandle information責務を実行する。
///
/// @responsibility Docker Desktop修復のhandle information責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn handle_information(handle: HANDLE) -> Option<BY_HANDLE_FILE_INFORMATION> {
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

/// Docker Desktop修復のsame file責務を実行する。
///
/// @responsibility Docker Desktop修復のsame file責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn same_file(
    left: &BY_HANDLE_FILE_INFORMATION,
    right: &BY_HANDLE_FILE_INFORMATION,
) -> bool {
    left.dwVolumeSerialNumber == right.dwVolumeSerialNumber
        && left.nFileIndexHigh == right.nFileIndexHigh
        && left.nFileIndexLow == right.nFileIndexLow
        && left.ftCreationTime.dwLowDateTime == right.ftCreationTime.dwLowDateTime
        && left.ftCreationTime.dwHighDateTime == right.ftCreationTime.dwHighDateTime
        && left.nFileSizeHigh == right.nFileSizeHigh
        && left.nFileSizeLow == right.nFileSizeLow
        && left.dwFileAttributes == right.dwFileAttributes
}

/// Docker Desktop修復のfinal dos path責務を実行する。
///
/// @responsibility Docker Desktop修復のfinal dos path責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn final_dos_path(handle: HANDLE) -> Option<PathBuf> {
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

/// Docker Desktop修復のfiletime value責務を実行する。
///
/// @responsibility Docker Desktop修復のfiletime value責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn filetime_value(value: FILETIME) -> u64 {
    (u64::from(value.dwHighDateTime) << 32) | u64::from(value.dwLowDateTime)
}

/// locked artifactsを安全側に検証する。
///
/// @responsibility locked artifactsを安全側に検証する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn verify_locked_artifacts(artifacts: &mut [LockedArtifact]) -> bool {
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

/// Docker Desktop修復のlock current artifacts責務を実行する。
///
/// @responsibility Docker Desktop修復のlock current artifacts責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn lock_current_artifacts() -> Option<Vec<LockedArtifact>> {
    let entries = [
        (
            "docker_cli",
            r"C:\Program Files\Docker\Docker\resources\bin\docker.exe",
            false,
        ),
        (
            "desktop_cli",
            r"C:\Program Files\Docker\Docker\DockerCli.exe",
            false,
        ),
        (
            "desktop_plugin",
            r"C:\Program Files\Docker\Docker\resources\cli-plugins\docker-desktop.exe",
            false,
        ),
        (
            "launcher",
            r"C:\Program Files\Docker\Docker\Docker Desktop.exe",
            false,
        ),
        (
            "frontend",
            r"C:\Program Files\Docker\Docker\frontend\Docker Desktop.exe",
            false,
        ),
        (
            "backend",
            r"C:\Program Files\Docker\Docker\resources\com.docker.backend.exe",
            false,
        ),
        (
            "build",
            r"C:\Program Files\Docker\Docker\resources\com.docker.build.exe",
            false,
        ),
        (
            "dev_envs",
            r"C:\Program Files\Docker\Docker\resources\com.docker.dev-envs.exe",
            true,
        ),
    ];
    let mut artifacts = Vec::new();
    for (role, source, optional) in entries {
        let path = PathBuf::from(source);
        let mut file = match OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(&path)
        {
            Ok(file) => file,
            Err(error) if optional && error.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => return None,
        };
        let handle = file.as_raw_handle().cast::<c_void>();
        let information = handle_information(handle)?;
        let bytes =
            (u64::from(information.nFileSizeHigh) << 32) | u64::from(information.nFileSizeLow);
        if information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
            || !(1..=MAXIMUM_ARTIFACT_BYTES).contains(&bytes)
            || !final_dos_path(handle)?
                .to_string_lossy()
                .eq_ignore_ascii_case(source)
            || !crate::docker_desktop::publisher::verify_docker_publisher(&file)
        {
            return None;
        }
        let sha256 = sha256_file(&mut file, bytes)?;
        if !same_file(&information, &handle_information(handle)?) {
            return None;
        }
        artifacts.push(LockedArtifact {
            policy: PolicyArtifact {
                role: role.to_owned(),
                path,
                bytes,
                sha256,
            },
            file,
            information,
        });
    }
    Some(artifacts)
}

/// Docker Desktop修復のprocess basename責務を実行する。
///
/// @responsibility Docker Desktop修復のprocess basename責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn process_basename(entry: &PROCESSENTRY32W) -> Option<String> {
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

/// Docker Desktop修復のmanaged process artifacts責務を実行する。
///
/// @responsibility Docker Desktop修復のmanaged process artifacts責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn managed_process_artifacts<'a>(
    name: &str,
    artifacts: &'a [LockedArtifact],
) -> Vec<&'a LockedArtifact> {
    artifacts
        .iter()
        .filter(|artifact| {
            !is_cli_role(artifact.policy.role.as_str())
                && artifact
                    .policy
                    .path
                    .file_name()
                    .map(|value| value.to_string_lossy().eq_ignore_ascii_case(name))
                    .unwrap_or(false)
        })
        .collect()
}

/// is cli roleの成立可否を判定する。
///
/// @responsibility is cli roleの成立可否を判定する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn is_cli_role(role: &str) -> bool {
    matches!(role, "docker_cli" | "desktop_cli" | "desktop_plugin")
}

/// Docker Desktop修復のcli process artifacts責務を実行する。
///
/// @responsibility Docker Desktop修復のcli process artifacts責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn cli_process_artifacts<'a>(
    name: &str,
    artifacts: &'a [LockedArtifact],
) -> Vec<&'a LockedArtifact> {
    artifacts
        .iter()
        .filter(|artifact| {
            is_cli_role(&artifact.policy.role)
                && artifact
                    .policy
                    .path
                    .file_name()
                    .map(|value| value.to_string_lossy().eq_ignore_ascii_case(name))
                    .unwrap_or(false)
        })
        .collect()
}

/// Docker Desktop修復のprocess path責務を実行する。
///
/// @responsibility Docker Desktop修復のprocess path責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn process_path(handle: HANDLE) -> Option<PathBuf> {
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

/// Docker Desktop修復のprocess creation責務を実行する。
///
/// @responsibility Docker Desktop修復のprocess creation責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn process_creation(handle: HANDLE) -> Option<u64> {
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

/// Docker Desktop修復のinventory processes責務を実行する。
///
/// @responsibility Docker Desktop修復のinventory processes責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn inventory_processes(artifacts: &[LockedArtifact]) -> ProcessInventory {
    inventory_process_scope(artifacts, false)
}

/// Docker Desktop修復のinventory process scope責務を実行する。
///
/// @responsibility Docker Desktop修復のinventory process scope責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(super) fn inventory_process_scope(
    artifacts: &[LockedArtifact],
    cli_only: bool,
) -> ProcessInventory {
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
        let candidates = if cli_only {
            cli_process_artifacts(&name, artifacts)
        } else {
            managed_process_artifacts(&name, artifacts)
        };
        // A removed optional executable must not hide a still-running old process.
        if !cli_only
            && candidates.is_empty()
            && name.eq_ignore_ascii_case("com.docker.dev-envs.exe")
        {
            return ProcessInventory::Unknown;
        }
        if !candidates.is_empty() {
            // SAFETY: CLI scope requests observation only; legacy managed scope also permits exact termination.
            let handle = unsafe {
                OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION
                        | SYNCHRONIZE_ACCESS
                        | if cli_only { 0 } else { PROCESS_TERMINATE },
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
