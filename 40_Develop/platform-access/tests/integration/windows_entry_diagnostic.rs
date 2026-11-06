//! 明示されたDocker Desktop退避領域のWindowsメタデータを診断する。
//!
//! @packageDocumentation
//! @responsibility 読取りAPIの失敗段階を観測し、削除・復旧の許可は決定しない。
//! @trace ERB-IT-001
//! @level IT
//! @scope 明示された実障害領域と通常Directoryの読取り専用比較。
//! @boundary 試験Process→Windows API。Native CLI・Docker操作は実行しない。

#![cfg(windows)]

/// 明示した退避領域のWindows観測失敗段階を読取り専用で確認する。
/// @responsibility open・基本情報・tag情報の失敗を区別し、削除可否を判定しない。
/// @trace ERB-IT-001
/// @precondition CRDD_ENTRY_OBSERVATION_ROOTに今回の退避領域を明示する。
/// @stimulus 同じ非追従flagsで属性権限と権限0を比較する。
/// @observation 各APIの成否・直後のエラー値・固定メタデータ・close結果。
/// @oracle 通常Directoryを陽性対照とし、失敗段階を保持する。成功を削除許可にしない。
/// @cleanup 取得したhandleを各一回closeする。試験物を作成しない。
/// @boundary Windowsメタデータ照会のみ。内容・接続・ACL・削除は扱わない。
#[test]
#[ignore = "明示した実障害領域だけを読取り専用で診断する"]
fn retained_runtime_entry_observation_diagnostic() {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::{CloseHandle, GetLastError, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, CreateFileW, FILE_ATTRIBUTE_TAG_INFO,
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES,
        FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, FileAttributeTagInfo, FindClose,
        FindFirstFileW, GetFileInformationByHandle, GetFileInformationByHandleEx, OPEN_EXISTING,
        WIN32_FIND_DATAW,
    };
    let root = std::path::PathBuf::from(std::env::var_os("CRDD_ENTRY_OBSERVATION_ROOT").unwrap());
    let parent = std::path::PathBuf::from(std::env::var_os("LOCALAPPDATA").unwrap()).join("Docker");
    assert_eq!(root.parent(), Some(parent.as_path()));
    let name = root.file_name().unwrap().to_str().unwrap();
    let suffix = name.strip_prefix("run.crdd-stale-").unwrap();
    assert_eq!(suffix.len(), 32);
    assert!(suffix.bytes().all(|b| b.is_ascii_hexdigit()));
    let before = std::fs::symlink_metadata(&root).unwrap();
    assert!(before.is_dir() && !before.file_type().is_symlink());
    for leaf in [
        "",
        "dockerEthernetVfkit",
        "dockerInference",
        "sailor-ingest.sock",
        "userAnalyticsOtlpHttp.sock",
    ] {
        let path = if leaf.is_empty() {
            root.clone()
        } else {
            root.join(leaf)
        };
        let units: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        // SAFETY: exact path (no wildcard), initialized output buffer and synchronous metadata query.
        let mut found: WIN32_FIND_DATAW = unsafe { std::mem::zeroed() };
        let search = unsafe { FindFirstFileW(units.as_ptr(), &mut found) };
        if search == INVALID_HANDLE_VALUE {
            // SAFETY: capture directly after the failed query.
            let error = unsafe { GetLastError() };
            println!("entry={leaf:?} stage=find error={error}");
        } else {
            // SAFETY: this test owns the search handle and closes it once.
            let closed = unsafe { FindClose(search) };
            println!(
                "entry={leaf:?} stage=find attrs={} reparse_tag=0x{:08x} closed={closed}",
                found.dwFileAttributes, found.dwReserved0
            );
            assert_ne!(closed, 0);
        }
        for access in [FILE_READ_ATTRIBUTES, 0] {
            // SAFETY: fixed read-only flags, NUL-terminated path and synchronous calls.
            let handle = unsafe {
                CreateFileW(
                    units.as_ptr(),
                    access,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                    std::ptr::null(),
                    OPEN_EXISTING,
                    FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS,
                    std::ptr::null_mut(),
                )
            };
            if handle == INVALID_HANDLE_VALUE {
                // SAFETY: capture immediately after the failed call.
                let error = unsafe { GetLastError() };
                println!("entry={leaf:?} access={access} stage=open error={error}");
                assert!(!leaf.is_empty(), "陽性対照のDirectoryをopenできない");
                continue;
            }
            // SAFETY: Win32 output structures allow zero initialization.
            let (mut info, mut tag): (BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_TAG_INFO) =
                unsafe { (std::mem::zeroed(), std::mem::zeroed()) };
            // SAFETY: owned live handle and exact output buffer sizes.
            let basic = unsafe { GetFileInformationByHandle(handle, &mut info) };
            let basic_error = if basic == 0 {
                unsafe { GetLastError() }
            } else {
                0
            };
            let tagged = unsafe {
                GetFileInformationByHandleEx(
                    handle,
                    FileAttributeTagInfo,
                    (&mut tag as *mut FILE_ATTRIBUTE_TAG_INFO).cast(),
                    std::mem::size_of::<FILE_ATTRIBUTE_TAG_INFO>() as u32,
                )
            };
            let tag_error = if tagged == 0 {
                unsafe { GetLastError() }
            } else {
                0
            };
            // SAFETY: this test closes its owned handle exactly once, even after query failure.
            let closed = unsafe { CloseHandle(handle) };
            let close_error = if closed == 0 {
                unsafe { GetLastError() }
            } else {
                0
            };
            println!(
                "entry={leaf:?} access={access} basic={basic} basic_error={basic_error} tag_ok={tagged} tag_error={tag_error} attrs={} tag_attrs={} tag={} volume={} index={} created={} links={} closed={closed} close_error={close_error}",
                info.dwFileAttributes,
                tag.FileAttributes,
                tag.ReparseTag,
                info.dwVolumeSerialNumber,
                (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
                (u64::from(info.ftCreationTime.dwHighDateTime) << 32)
                    | u64::from(info.ftCreationTime.dwLowDateTime),
                info.nNumberOfLinks
            );
            assert_ne!(closed, 0);
            if leaf.is_empty() {
                assert_ne!(basic, 0, "陽性対照の基本情報を取得できない");
                assert_ne!(tagged, 0, "陽性対照のtag情報を取得できない");
                assert_eq!(info.dwFileAttributes, tag.FileAttributes);
                assert_eq!(tag.ReparseTag, 0);
            }
        }
    }
    let after = std::fs::symlink_metadata(&root).unwrap();
    assert!(after.is_dir() && !after.file_type().is_symlink());
    assert_eq!(before.created().unwrap(), after.created().unwrap());
}
