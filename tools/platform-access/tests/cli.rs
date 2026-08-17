#![cfg(windows)]

use std::ffi::OsStr;
use std::io::Write;
use std::os::windows::ffi::OsStrExt;
use std::process::{Command, Stdio};
use std::ptr::{null, null_mut};
use std::time::{SystemTime, UNIX_EPOCH};

use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateFileW, FILE_FLAG_BACKUP_SEMANTICS,
    FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ,
    FILE_SHARE_WRITE, GetFileInformationByHandle, OPEN_EXISTING,
};

const BINARY: &str = env!("CARGO_BIN_EXE_crdd-platform-access");

fn directory_identity(path: &OsStr) -> [u32; 3] {
    let mut wide: Vec<u16> = path.encode_wide().collect();
    wide.push(0);
    // SAFETY: wide is NUL-terminated and the returned handle is closed below.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            FILE_READ_ATTRIBUTES,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    assert_ne!(handle, INVALID_HANDLE_VALUE);
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
    // SAFETY: information is writable and handle is valid until CloseHandle.
    assert_ne!(
        unsafe { GetFileInformationByHandle(handle, &mut information) },
        0
    );
    // SAFETY: this test exclusively owns the valid handle.
    unsafe { CloseHandle(handle) };
    [
        information.dwVolumeSerialNumber,
        information.nFileIndexHigh,
        information.nFileIndexLow,
    ]
}

fn request(path: &str, identity: [u32; 3], nonce: [u8; 32]) -> Vec<u8> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"CRDDPA02");
    bytes.extend_from_slice(&2_u16.to_le_bytes());
    bytes.push(1);
    bytes.push(2);
    bytes.extend_from_slice(&nonce);
    for value in identity {
        bytes.extend_from_slice(&value.to_le_bytes());
    }
    bytes.extend_from_slice(&u32::try_from(path.len()).unwrap().to_le_bytes());
    bytes.extend_from_slice(path.as_bytes());
    bytes
}

fn invoke(input: &[u8]) -> std::process::Output {
    let mut child = Command::new(BINARY)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .unwrap();
    child.stdin.take().unwrap().write_all(input).unwrap();
    child.wait_with_output().unwrap()
}

#[test]
fn binary_reports_candidate_blocked_and_invalid_requests() {
    let unique = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!(
        "crdd-platform-access-cli-{}-{unique}",
        std::process::id()
    ));
    std::fs::create_dir(&root).unwrap();
    let path = root.to_str().unwrap();
    let identity = directory_identity(root.as_os_str());
    let nonce = [6_u8; 32];

    let candidate = invoke(&request(path, identity, nonce));
    assert!(candidate.status.success());
    assert!(candidate.stderr.is_empty());
    assert_eq!(candidate.stdout.len(), 82);
    assert_eq!(&candidate.stdout[..8], b"CRDDPR02");
    assert_eq!(candidate.stdout[11], 1);
    assert_eq!(&candidate.stdout[12..44], &nonce);
    assert_eq!(
        u16::from_le_bytes(candidate.stdout[44..46].try_into().unwrap()),
        100
    );
    assert!(candidate.stdout[50..82].iter().any(|byte| *byte != 0));
    let repeated = invoke(&request(path, identity, nonce));
    assert!(repeated.status.success());
    assert_eq!(&candidate.stdout[50..82], &repeated.stdout[50..82]);

    let blocked = invoke(&request(path, [0, 0, 0], nonce));
    assert_eq!(blocked.status.code(), Some(2));
    assert_eq!(blocked.stdout.len(), 82);
    assert_eq!(blocked.stdout[11], 0);
    assert_eq!(
        u16::from_le_bytes(blocked.stdout[44..46].try_into().unwrap()),
        4
    );

    let invalid = invoke(b"invalid");
    assert_eq!(invalid.status.code(), Some(2));
    assert_eq!(invalid.stdout.len(), 82);
    assert_eq!(invalid.stdout[11], 0);
    assert_eq!(
        u16::from_le_bytes(invalid.stdout[44..46].try_into().unwrap()),
        2
    );
    std::fs::remove_dir(root).unwrap();
}
