//! Windows system directoryのread-only観測境界を提供する。
//!
//! @responsibility OS APIが返すsystem directoryを固定応答へ変換し、Filesystem変更やAuthority発行を行わない。
//! @trace ARCH-000008

use std::io::Write;
use windows_sys::Win32::System::SystemInformation::GetSystemWindowsDirectoryW;

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
