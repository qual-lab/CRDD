//! Windows system directoryと固定Known Folderのread-only観測境界を提供する。
//!
//! @responsibility OS APIが返すsystem directoryを固定応答へ変換し、Filesystem変更やAuthority発行を行わない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use std::ffi::{OsString, c_void};
use std::io::Write;
use std::os::windows::ffi::OsStringExt;
use std::path::PathBuf;
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::System::SystemInformation::GetSystemWindowsDirectoryW;
use windows_sys::core::GUID;

/// Read-only bootstrap observation. No environment, filesystem mutation or authority.
///
/// @responsibility Windows System Directory観測のrun責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows System Directory API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub fn run(writer: &mut impl Write) -> i32 {
    let mut buffer = vec![0_u16; 32_768];
    // SAFETY: writable UTF-16 buffer with the exact declared capacity.
    let length = unsafe { GetSystemWindowsDirectoryW(buffer.as_mut_ptr(), 32_768) };
    if length == 0 || length >= 32_768 {
        return 2;
    }
    let units = &buffer[..length as usize];
    if units.contains(&0) || String::from_utf16(units).is_err() {
        return 2;
    }
    let mut frame = Vec::with_capacity(12 + units.len() * 2);
    frame.extend_from_slice(b"CRDDWD01");
    frame.extend_from_slice(&length.to_le_bytes());
    for unit in units {
        frame.extend_from_slice(&unit.to_le_bytes());
    }
    if writer.write_all(&frame).is_err() || writer.flush().is_err() {
        return 3;
    }
    0
}

#[link(name = "shell32")]
unsafe extern "system" {
    /// Windows Root・Provider Home観測のSHGetKnownFolderPath責務を実行する。
    ///
    /// @responsibility Windows Root・Provider Home観測のSHGetKnownFolderPath責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
    fn SHGetKnownFolderPath(
        folder_id: *const GUID,
        flags: u32,
        token: HANDLE,
        path: *mut *mut u16,
    ) -> i32;
}

#[link(name = "ole32")]
unsafe extern "system" {
    /// Windows Root・Provider Home観測のCoTaskMemFree責務を実行する。
    ///
    /// @responsibility Windows Root・Provider Home観測のCoTaskMemFree責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
    /// @trace ARCH-000011
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
    /// @effect OS APIからread-only観測を取得する。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary Native Worker→Windows Identity／ACL API。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency N/A: 共有可変状態を持たない同期処理である。
    fn CoTaskMemFree(memory: *const c_void);
}

pub(crate) const MAXIMUM_KNOWN_FOLDER_CODE_UNITS: usize = 32_767;

/// Windows Root・Provider Home観測のlocal app data path責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のlocal app data path責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn local_app_data_path() -> Option<PathBuf> {
    const FOLDER_ID_LOCAL_APP_DATA: GUID = GUID {
        data1: 0xf1b32785,
        data2: 0x6fba,
        data3: 0x4fcf,
        data4: [0x9d, 0x55, 0x7b, 0x8e, 0x7f, 0x15, 0x70, 0x91],
    };
    known_folder_path(&FOLDER_ID_LOCAL_APP_DATA)
}

/// Windows Root・Provider Home観測のuser profile path責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のuser profile path責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn user_profile_path() -> Option<PathBuf> {
    const FOLDER_ID_PROFILE: GUID = GUID {
        data1: 0x5e6c858f,
        data2: 0x0e22,
        data3: 0x4760,
        data4: [0x9a, 0xfe, 0xea, 0x33, 0x17, 0xb6, 0x71, 0x73],
    };
    known_folder_path(&FOLDER_ID_PROFILE)
}

/// Windows Root・Provider Home観測のroaming app data path責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のroaming app data path責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn roaming_app_data_path() -> Option<PathBuf> {
    const FOLDER_ID_ROAMING_APP_DATA: GUID = GUID {
        data1: 0x3eb685db,
        data2: 0x65f9,
        data3: 0x4cf6,
        data4: [0xa0, 0x3a, 0xe3, 0xef, 0x65, 0x72, 0x9f, 0x3d],
    };
    known_folder_path(&FOLDER_ID_ROAMING_APP_DATA)
}

/// Windows Root・Provider Home観測のprogram data path責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のprogram data path責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn program_data_path() -> Option<PathBuf> {
    // FOLDERID_ProgramData, defined by the Windows SDK KnownFolders.h.
    const FOLDER_ID_PROGRAM_DATA: GUID = GUID {
        data1: 0x62ab5d82,
        data2: 0xfdc1,
        data3: 0x4dc3,
        data4: [0xa9, 0xdd, 0x07, 0x0d, 0x1d, 0x49, 0x5d, 0x97],
    };
    known_folder_path(&FOLDER_ID_PROGRAM_DATA)
}

/// Windows Root・Provider Home観測のknown folder path責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のknown folder path責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
fn known_folder_path(folder_id: &GUID) -> Option<PathBuf> {
    let mut raw_path = null_mut();
    // SAFETY: raw_path is writable. On success, Shell allocates a NUL-terminated UTF-16 path
    // that remains owned until CoTaskMemFree below.
    if unsafe { SHGetKnownFolderPath(folder_id, 0, null_mut(), &mut raw_path) } != 0
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

#[cfg(test)]
mod tests {
    /// directory_observation_has_exact_frame_lengthを検証する。
    ///
    /// @responsibility directory_observation_has_exact_frame_lengthの合否判定を所有する。
    /// @trace RDL-UT-005
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus directory_observation_has_exact_frame_lengthの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
    #[test]
    fn directory_observation_has_exact_frame_length() {
        let mut output = Vec::new();
        assert_eq!(super::run(&mut output), 0);
        assert_eq!(&output[..8], b"CRDDWD01");
        let length = u32::from_le_bytes(output[8..12].try_into().unwrap());
        assert!(length > 0 && length < 32_768);
        assert_eq!(output.len(), 12 + length as usize * 2);
    }
}
