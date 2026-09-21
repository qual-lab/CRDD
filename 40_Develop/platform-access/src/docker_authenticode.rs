//! callerがhandleで固定したDocker実行物のAuthenticode Publisherを検証する。
//!
//! @responsibility 再openせず署名chainと期待Publisherを評価し、offlineまたは不明なTrustを拒否する。
//! @trace ARCH-000014

use std::fs::File;
use std::mem::size_of;
use std::os::windows::io::AsRawHandle;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Security::Cryptography::{
    CERT_NAME_ATTR_TYPE, CertGetNameStringW, szOID_ORGANIZATION_NAME,
};
use windows_sys::Win32::Security::WinTrust::*;

/// No network retrieval, UI, process launch, or path reopening is requested.
///
/// @responsibility docker publisherを安全側に検証する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000014
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→WinTrust→Docker Publisher。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn verify_docker_publisher(file: &File) -> bool {
    let mut file_info = WINTRUST_FILE_INFO {
        cbStruct: size_of::<WINTRUST_FILE_INFO>() as u32,
        pcwszFilePath: null(),
        hFile: file.as_raw_handle(),
        pgKnownSubject: null_mut(),
    };
    let mut data = WINTRUST_DATA {
        cbStruct: size_of::<WINTRUST_DATA>() as u32,
        dwUIChoice: WTD_UI_NONE,
        fdwRevocationChecks: WTD_REVOKE_WHOLECHAIN,
        dwUnionChoice: WTD_CHOICE_FILE,
        Anonymous: WINTRUST_DATA_0 {
            pFile: &mut file_info,
        },
        dwStateAction: WTD_STATEACTION_VERIFY,
        dwProvFlags: WTD_CACHE_ONLY_URL_RETRIEVAL
            | WTD_REVOCATION_CHECK_CHAIN_EXCLUDE_ROOT
            | WTD_DISABLE_MD2_MD4,
        ..Default::default()
    };
    let mut action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
    // All pointers refer to live stack values or the caller-owned open file.
    let status = unsafe {
        WinVerifyTrust(
            -1_isize as _,
            &mut action,
            (&mut data as *mut WINTRUST_DATA).cast(),
        )
    };
    let trusted = status == 0 && verified_signer_is_docker(&data);
    // Close even failed verification states; never return before cleanup.
    data.dwStateAction = WTD_STATEACTION_CLOSE;
    let closed = unsafe {
        WinVerifyTrust(
            -1_isize as _,
            &mut action,
            (&mut data as *mut WINTRUST_DATA).cast(),
        )
    };
    trusted && closed == 0
}

/// Docker Authenticode Trustのverified signer is docker責務を実行する。
///
/// @responsibility Docker Authenticode Trustのverified signer is docker責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000014
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→WinTrust→Docker Publisher。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn verified_signer_is_docker(data: &WINTRUST_DATA) -> bool {
    if data.hWVTStateData.is_null() {
        return false;
    }
    // These pointers belong to WinTrust and remain valid until STATEACTION_CLOSE.
    unsafe {
        let provider = WTHelperProvDataFromStateData(data.hWVTStateData);
        if provider.is_null() {
            return false;
        }
        let signer = WTHelperGetProvSignerFromChain(provider, 0, 0, 0);
        if signer.is_null() {
            return false;
        }
        let certificate = WTHelperGetProvCertFromChain(signer, 0);
        if certificate.is_null() || (*certificate).pCert.is_null() {
            return false;
        }
        let mut name = [0_u16; 128];
        let length = CertGetNameStringW(
            (*certificate).pCert,
            CERT_NAME_ATTR_TYPE,
            0,
            szOID_ORGANIZATION_NAME.cast(),
            name.as_mut_ptr(),
            name.len() as u32,
        );
        let expected: Vec<u16> = "Docker Inc\0".encode_utf16().collect();
        length as usize == expected.len() && name[..expected.len()] == expected
    }
}

#[cfg(test)]
mod tests {
    use super::verify_docker_publisher;
    use std::fs::OpenOptions;
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_SHARE_READ;

    /// Rust Test Caseを検証する。
    ///
    /// @responsibility Rust Test Caseの合否判定を所有する。
    /// @trace AIT-UT-005
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus Rust Test Caseの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
    #[test]
    #[ignore = "Explicit read-only installed Docker signature observation"]
    fn installed_docker_desktop_has_verified_publisher() {
        let file = OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .open(r"C:\Program Files\Docker\Docker\Docker Desktop.exe")
            .expect("open installed Docker Desktop with writes and deletion denied");
        assert!(verify_docker_publisher(&file));
    }

    /// unsigned_manifest_is_not_a_verified_docker_executableを検証する。
    ///
    /// @responsibility unsigned_manifest_is_not_a_verified_docker_executableの合否判定を所有する。
    /// @trace AIT-UT-005
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus unsigned_manifest_is_not_a_verified_docker_executableの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Trust各軸の純粋判定規則は外部実行境界を持たない。
    #[test]
    fn unsigned_manifest_is_not_a_verified_docker_executable() {
        let file = OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .open(concat!(env!("CARGO_MANIFEST_DIR"), "/Cargo.toml"))
            .expect("open existing unsigned crate manifest");
        assert!(!verify_docker_publisher(&file));
    }
}
