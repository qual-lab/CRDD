//! 単一Filesystem entryの非追従メタデータ観測。
//!
//! @responsibility Windows固有の属性・tag・実体を返し、対象選択や削除を所有しない。
//! @trace ARCH-000008
//! @boundary 固定Native入口とWindows読取りAPI。

use std::ffi::OsStr;
use std::io::Write;
use std::mem::{size_of, zeroed};
use std::os::windows::ffi::OsStrExt;
use std::ptr::{null, null_mut};
use windows_sys::Win32::Foundation::{
    CloseHandle, ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND, GetLastError, HANDLE,
    INVALID_HANDLE_VALUE,
};
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateFileW, FILE_ATTRIBUTE_REPARSE_POINT, FILE_ATTRIBUTE_TAG_INFO,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_READ_ATTRIBUTES,
    FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, FileAttributeTagInfo,
    GetFileInformationByHandle, GetFileInformationByHandleEx, OPEN_EXISTING,
};

/// 単一のローカル絶対Pathを非追従で観測し固定41byte応答を返す。
/// @responsibility 不存在と観測不能を区別し、同じhandleの属性・実体・tagだけを出力する。
/// @trace ARCH-000008
/// @input path: 有界なローカル絶対Path一件、writer: 固定応答先。
/// @returns 0は完全応答、2は不正入力／観測不能、3は出力失敗。
/// @precondition 対象Scope・Owner・処置許可は利用側が別途確認する。
/// @postcondition handleを明示closeした後だけ応答を出す。
/// @effect 属性読取りhandleの取得・解放と固定frame出力のみ。
/// @failure open／query／close不明を不存在へ変換しない。
/// @invariant 内容・Path・handle・削除許可を応答へ含めない。
/// @boundary Native入口とWindows Filesystem。
/// @security UNC・device・相対Path・ADS・曖昧segmentを拒否し、ACLや内容を変更しない。
/// @concurrency 一呼出し一entry。観測後の実体不変・排他を保証しない。
pub(crate) fn run(path: &OsStr, writer: &mut impl Write) -> i32 {
    let Some(text) = path.to_str() else { return 2 };
    let bytes = text.as_bytes();
    if bytes.len() < 4
        || bytes.len() > 4096
        || !bytes[0].is_ascii_uppercase()
        || bytes[1..3] != *b":\\"
        || text[3..].split('\\').any(|part| {
            let basename = part
                .split('.')
                .next()
                .unwrap_or("")
                .trim_end_matches(' ')
                .to_uppercase();
            let reserved = matches!(
                basename.as_str(),
                "CON" | "PRN" | "AUX" | "NUL" | "CLOCK$" | "CONIN$" | "CONOUT$"
            ) || ["COM", "LPT"].iter().any(|prefix| {
                basename.strip_prefix(prefix).is_some_and(|suffix| {
                    matches!(
                        suffix,
                        "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
                    )
                })
            });
            part.is_empty()
                || reserved
                || part == "."
                || part == ".."
                || part.ends_with(['.', ' '])
                || part
                    .chars()
                    .any(|c| c.is_control() || "<>:\"/|?*".contains(c))
        })
    {
        return 2;
    }
    let mut units: Vec<u16> = path.encode_wide().collect();
    units.push(0);
    observe_entry(
        || {
            // SAFETY: units is NUL-terminated and lives through the synchronous call.
            let handle = unsafe {
                CreateFileW(
                    units.as_ptr(),
                    FILE_READ_ATTRIBUTES,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                    null(),
                    OPEN_EXISTING,
                    FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS,
                    null_mut(),
                )
            };
            if handle == INVALID_HANDLE_VALUE {
                // SAFETY: captured immediately after the failed Windows call.
                Err(unsafe { GetLastError() })
            } else {
                Ok(handle)
            }
        },
        |handle| {
            // SAFETY: these Win32 output structures permit zero initialization.
            let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { zeroed() };
            // SAFETY: same as above; no pointer fields are dereferenced.
            let mut tag: FILE_ATTRIBUTE_TAG_INFO = unsafe { zeroed() };
            // SAFETY: handle is valid and both output buffers have their exact declared sizes.
            let queried = unsafe {
                GetFileInformationByHandle(handle, &mut info) != 0
                    && GetFileInformationByHandleEx(
                        handle,
                        FileAttributeTagInfo,
                        (&mut tag as *mut FILE_ATTRIBUTE_TAG_INFO).cast(),
                        size_of::<FILE_ATTRIBUTE_TAG_INFO>() as u32,
                    ) != 0
            };
            let index = (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow);
            let created = (u64::from(info.ftCreationTime.dwHighDateTime) << 32)
                | u64::from(info.ftCreationTime.dwLowDateTime);
            if !queried
                || info.dwFileAttributes != tag.FileAttributes
                || info.dwVolumeSerialNumber == 0
                || index == 0
                || created == 0
                || info.nNumberOfLinks == 0
                || ((tag.FileAttributes & FILE_ATTRIBUTE_REPARSE_POINT == 0)
                    != (tag.ReparseTag == 0))
            {
                return None;
            }
            let mut payload = [0_u8; 32];
            payload[..4].copy_from_slice(&tag.FileAttributes.to_le_bytes());
            payload[4..8].copy_from_slice(&tag.ReparseTag.to_le_bytes());
            payload[8..12].copy_from_slice(&info.dwVolumeSerialNumber.to_le_bytes());
            payload[12..20].copy_from_slice(&index.to_le_bytes());
            payload[20..28].copy_from_slice(&created.to_le_bytes());
            payload[28..32].copy_from_slice(&info.nNumberOfLinks.to_le_bytes());
            Some(payload)
        },
        |handle| {
            // SAFETY: run owns this handle; observe_entry calls this closure exactly once.
            unsafe { CloseHandle(handle) != 0 }
        },
        writer,
    )
}

/// 単一handleの取得・照会・解放と応答確定を直列化する。
/// @responsibility query失敗でもcloseし、close成功前は応答を出さない。
/// @trace ARCH-000008
/// @input open／query／close: 内部固定OS処理、writer: 応答先。
/// @returns 0は完全応答、2は観測不能、3は出力失敗。
/// @precondition queryのSomeは既存相関検査を通過した32byte payloadのみ。
/// @postcondition open成功時はquery成否によらずcloseを一回実行する。
/// @effect 内部OS処理の実行と固定frame出力。
/// @failure query／close不明で出力0。出力失敗では部分frameを成功としない。
/// @invariant 不存在はopenのFILE_NOT_FOUND／PATH_NOT_FOUNDだけ。
/// @boundary privateな同期処理とOS Adapter。公開差替え入口は提供しない。
/// @security Path・内容・削除Authorityを新設しない。
/// @concurrency N/A: 同期FnOnceを固定順で一回ずつ実行する。
fn observe_entry(
    open: impl FnOnce() -> Result<HANDLE, u32>,
    query: impl FnOnce(HANDLE) -> Option<[u8; 32]>,
    close: impl FnOnce(HANDLE) -> bool,
    writer: &mut impl Write,
) -> i32 {
    let mut frame = [0_u8; 41];
    frame[..8].copy_from_slice(b"CRDDFE01");
    match open() {
        Err(ERROR_FILE_NOT_FOUND | ERROR_PATH_NOT_FOUND) => frame[8] = b'A',
        Err(_) => return 2,
        Ok(handle) => {
            let payload = query(handle);
            let closed = close(handle);
            let Some(payload) = payload.filter(|_| closed) else {
                return 2;
            };
            frame[8] = b'P';
            frame[9..].copy_from_slice(&payload);
        }
    }
    if writer.write_all(&frame).is_err() || writer.flush().is_err() {
        return 3;
    }
    0
}

#[cfg(test)]
mod tests {
    use super::{HANDLE, observe_entry};
    use std::cell::RefCell;
    use std::io::{Error, Result, Write};

    /// 固定応答の順序と部分出力を観測するメモリwriter。
    /// @responsibility 外部I/Oなしでwrite／flush失敗を一軸化する。
    /// @trace ERB-UT-039
    /// @shape 共有イベント列、出力bytes、固定故障mode。
    /// @invariant 同じ試験内の呼出し順を省略しない。
    /// @boundary メモリ内だけ。
    /// @security Path・handle・Authorityを取得しない。
    /// @compatibility 本試験の固定modeだけ。
    struct FrameWriter<'a> {
        events: &'a RefCell<Vec<&'static str>>,
        bytes: Vec<u8>,
        mode: &'static str,
    }

    impl Write for FrameWriter<'_> {
        /// writeの要求と部分出力を保存する。
        /// @responsibility 即時失敗と部分成功後の失敗を区別する。
        /// @trace ERB-UT-039
        /// @input buffer: 出力候補。
        /// @returns 書込み数または試験用エラー。
        /// @precondition 固定modeとメモリ領域だけ。
        /// @postcondition 受理したbytesだけを保存する。
        /// @effect メモリ更新だけ。
        /// @failure 固定write拒否ではErr。
        /// @invariant 実Filesystemを変更しない。
        /// @boundary 試験内writer。
        /// @security 秘密値を扱わない。
        /// @concurrency RefCellによる同期試験だけ。
        fn write(&mut self, buffer: &[u8]) -> Result<usize> {
            self.events.borrow_mut().push("write");
            if self.mode == "write" || (self.mode == "partial" && !self.bytes.is_empty()) {
                return Err(Error::other("fixture_write"));
            }
            let length = if self.mode == "partial" {
                5.min(buffer.len())
            } else {
                buffer.len()
            };
            self.bytes.extend_from_slice(&buffer[..length]);
            Ok(length)
        }

        /// flushの要求と失敗を観測する。
        /// @responsibility 全bytes受領をflush成功へ補完しない。
        /// @trace ERB-UT-039
        /// @input N/A: 保存済みmodeだけ。
        /// @returns 正常または試験用エラー。
        /// @precondition メモリwriterが存在する。
        /// @postcondition bytesを追加しない。
        /// @effect メモリのイベント追記だけ。
        /// @failure flush modeでErr。
        /// @invariant 完全frameがあっても失敗を返せる。
        /// @boundary 試験内writer。
        /// @security 外部I/Oなし。
        /// @concurrency 同期試験だけ。
        fn flush(&mut self) -> Result<()> {
            self.events.borrow_mut().push("flush");
            if self.mode == "flush" {
                Err(Error::other("fixture_flush"))
            } else {
                Ok(())
            }
        }
    }

    /// 取得・照会・解放・出力の独立故障を固定順序とbytesで反証する。
    /// @responsibility 不明を不存在へせず、close失敗前後の応答を区別する。
    /// @trace ERB-UT-039
    /// @precondition 固定closure・擬似handle・メモリwriterだけ。
    /// @stimulus 正常、二つの不存在、他open失敗、query／close／write／flush失敗。
    /// @observation 全イベント列、同handle搬送、exitと出力全文。
    /// @oracle query失敗でもclose一回、close不明は出力0、出力失敗はexit3。
    /// @cleanup N/A: OS資源は作成しない。
    /// @boundary N/A: private同期順序の純粋試験。実Win32は別IT。
    #[test]
    fn entry_failures_preserve_close_order_and_never_invent_absence() {
        let payload = [
            0x20, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0,
            1, 0, 0, 0,
        ];
        for (name, error, queried, closed, mode, exit, expected_events, length, status) in [
            (
                "normal",
                None,
                true,
                true,
                "normal",
                0,
                vec!["open", "query", "close", "write", "flush"],
                41,
                b'P',
            ),
            (
                "file_absent",
                Some(2),
                true,
                true,
                "normal",
                0,
                vec!["open", "write", "flush"],
                41,
                b'A',
            ),
            (
                "path_absent",
                Some(3),
                true,
                true,
                "normal",
                0,
                vec!["open", "write", "flush"],
                41,
                b'A',
            ),
            (
                "access_denied",
                Some(5),
                true,
                true,
                "normal",
                2,
                vec!["open"],
                0,
                b'P',
            ),
            (
                "share_violation",
                Some(32),
                true,
                true,
                "normal",
                2,
                vec!["open"],
                0,
                b'P',
            ),
            (
                "other_error",
                Some(1920),
                true,
                true,
                "normal",
                2,
                vec!["open"],
                0,
                b'P',
            ),
            (
                "zero_error",
                Some(0),
                true,
                true,
                "normal",
                2,
                vec!["open"],
                0,
                b'P',
            ),
            (
                "query",
                None,
                false,
                true,
                "normal",
                2,
                vec!["open", "query", "close"],
                0,
                b'P',
            ),
            (
                "close",
                None,
                true,
                false,
                "normal",
                2,
                vec!["open", "query", "close"],
                0,
                b'P',
            ),
            (
                "both",
                None,
                false,
                false,
                "normal",
                2,
                vec!["open", "query", "close"],
                0,
                b'P',
            ),
            (
                "write",
                None,
                true,
                true,
                "write",
                3,
                vec!["open", "query", "close", "write"],
                0,
                b'P',
            ),
            (
                "partial",
                None,
                true,
                true,
                "partial",
                3,
                vec!["open", "query", "close", "write", "write"],
                5,
                b'P',
            ),
            (
                "flush",
                None,
                true,
                true,
                "flush",
                3,
                vec!["open", "query", "close", "write", "flush"],
                41,
                b'P',
            ),
        ] {
            let events = RefCell::new(Vec::new());
            let handle = 7_usize as HANDLE;
            let mut writer = FrameWriter {
                events: &events,
                bytes: Vec::new(),
                mode,
            };
            let result = observe_entry(
                || {
                    events.borrow_mut().push("open");
                    error.map_or(Ok(handle), Err)
                },
                |value| {
                    events.borrow_mut().push("query");
                    assert_eq!(value, handle);
                    queried.then_some(payload)
                },
                |value| {
                    events.borrow_mut().push("close");
                    assert_eq!(value, handle);
                    closed
                },
                &mut writer,
            );
            assert_eq!(result, exit, "{name}");
            assert_eq!(*events.borrow(), expected_events, "{name}");
            let mut expected = Vec::from(*b"CRDDFE01");
            expected.push(status);
            expected.extend_from_slice(if status == b'A' { &[0; 32] } else { &payload });
            assert_eq!(writer.bytes, expected[..length], "{name}");
        }
    }
}
