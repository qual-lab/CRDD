//! Windows system directoryと固定Known Folderのread-only観測境界を提供する。
//!
//! @responsibility OS APIが返すsystem directoryを固定応答へ変換し、Filesystem変更やAuthority発行を行わない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use std::ffi::{OsString, c_void};
use std::io::Write;
use std::os::windows::ffi::{OsStrExt, OsStringExt};
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
    write_directory_frame(b"CRDDWD01", units, writer)
}

/// 固定LocalAppDataをOS Known Folderから読取り専用frameへ変換する。
/// @responsibility 既存Known Folder取得を使い、環境値や旧RuntimeStateへ依存しない。
/// @trace ARCH-000008
/// @input writer: 固定応答の出力先。利用者・GUID・Pathは指定不可。
/// @returns 0はframe完了、2は観測不能、3は出力失敗。
/// @precondition 現在Processの利用者をOSが識別する。
/// @postcondition Path取得はRoot Authorityや意図した利用者との一致を保証しない。
/// @effect SHGetKnownFolderPathの読取りと応答出力のみ。
/// @failure 観測失敗・不正UTF-16・出力失敗は非0。
/// @invariant Directory作成・ACL変更・環境fallbackを行わない。
/// @boundary Nativeの固定modeとWindows Known Folder API。
/// @security 任意GUIDや利用者tokenを受け取らない。
/// @concurrency 同期読取りのみで共有Runtime状態を保持しない。
pub fn run_local_app_data(writer: &mut impl Write) -> i32 {
    let Some(directory) = local_app_data_path() else {
        return 2;
    };
    let units: Vec<u16> = directory.as_os_str().encode_wide().collect();
    write_directory_frame(b"CRDDLA01", &units, writer)
}

/// 二つの固定Directory観測の有界応答を出力する。
/// @responsibility 用途magic・UTF-16単位数・全本文を一つのframeとして確定する。
/// @trace ARCH-000008
/// @input magic: 内部固定用途、units: OS観測、writer: 応答出力。
/// @returns 0は出力完了、2は不正値、3はwrite／flush失敗。
/// @precondition 外部からmagicや任意Pathを選択させない。
/// @postcondition 不正値では出力0、成功では全本文とflushを完了する。
/// @effect 有界frameの出力だけ。
/// @failure 空・上限・NUL・不正UTF-16と部分出力を成功にしない。
/// @invariant System Directoryの既存magicとframe文法を維持する。
/// @boundary OS観測値と固定応答stream。
/// @security 環境・秘密・Authorityを応答に追加しない。
/// @concurrency N/A: 同期値変換と出力のみ。
fn write_directory_frame(magic: &[u8; 8], units: &[u16], writer: &mut impl Write) -> i32 {
    if units.is_empty()
        || units.len() >= 32_768
        || units.contains(&0)
        || String::from_utf16(units).is_err()
    {
        return 2;
    }
    let length = units.len() as u32;
    let mut frame = Vec::with_capacity(12 + units.len() * 2);
    frame.extend_from_slice(magic);
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

    /// 有界frameの不正値と出力失敗を反証する。
    /// @responsibility writeとflushの失敗を出力完了に丸めない。
    /// @trace ERB-UT-035
    /// @precondition メモリ内writerだけを使う。
    /// @stimulus 空・NUL・不正UTF-16・上限とwrite／flush拒否。
    /// @observation 戻り値、出力byte数と用途magic。
    /// @oracle 不正値は2／出力0、出力失敗は3、上限内は0。
    /// @cleanup N/A: 外部資源を作らない。
    /// @boundary N/A: 値境界とメモリwriterの確認。
    #[test]
    fn directory_frame_rejects_invalid_units_and_output_failure() {
        for units in [vec![], vec![0], vec![0xd800], vec![b'a' as u16; 32_768]] {
            let mut output = Vec::new();
            assert_eq!(
                super::write_directory_frame(b"CRDDLA01", &units, &mut output),
                2
            );
            assert!(output.is_empty());
        }
        let mut output = Vec::new();
        assert_eq!(
            super::write_directory_frame(b"CRDDLA01", &vec![b'a' as u16; 32_767], &mut output),
            0
        );
        assert_eq!(output.len(), 65_546);
        assert_eq!(&output[..8], b"CRDDLA01");
        assert_eq!(&output[8..12], &32_767_u32.to_le_bytes());
        assert!(
            output[12..]
                .chunks_exact(2)
                .all(|pair| pair == [0x61, 0x00])
        );
        let mut no_capacity: &mut [u8] = &mut [];
        assert_eq!(
            super::write_directory_frame(b"CRDDLA01", &[b'a' as u16], &mut no_capacity),
            3
        );
        let mut flush_failure = std::io::BufWriter::with_capacity(1024, no_capacity);
        assert_eq!(
            super::write_directory_frame(b"CRDDLA01", &[b'a' as u16], &mut flush_failure),
            3
        );
    }
}
