//! Verifies the signer of an already opened, caller-pinned executable.
//! The caller must deny writes/deletion and retain the file through its use.

use std::fs::File;
use std::mem::size_of;
use std::os::windows::io::AsRawHandle;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Security::Cryptography::{
    CERT_NAME_ATTR_TYPE, CertGetNameStringW, szOID_ORGANIZATION_NAME,
};
use windows_sys::Win32::Security::WinTrust::*;

/// No network retrieval, UI, process launch, or path reopening is requested.
/// Missing/offline trust evidence is a rejection, not an unsigned fallback.
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
