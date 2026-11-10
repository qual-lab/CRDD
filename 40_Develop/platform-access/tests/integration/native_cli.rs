//! Native CLIのProtocolと候補・拒否応答を固定binaryで確認する。
//!
//! @packageDocumentation
//! @responsibility 生成した入力をCLIへ搬送し、終了値・固定応答とnonce対応を判定する。
//! @trace ERB-IT-001
//! @trace ERB-IT-003
//! @level IT
//! @scope Provider Home観測Protocolの正常・不正・旧版拒否と、専用管理フォルダ初期化要求の不正・混用を取得前に拒否する確認。正常な共有フォルダ初期化、Host限定回復やProvider実行は対象外。
//! @boundary Native試験Process→固定CLI→Windows観測。Job終端、全handle不存在および例外時清掃は証明しない。

#![cfg(windows)]

/// raw entry modeの通常値・不存在と不正入力を実CLIで区別する。
/// @responsibility 非追従観測を内容読取りや変更へ拡張しない。
/// @trace ERB-IT-001
/// @precondition Cargoが生成した固定Native実行物と既存Source Directory。
/// @stimulus 通常file・Directory・不存在と不正Path／余分引数。
/// @observation exit、完全frame、raw属性、tagとNative実体。
/// @oracle 正常だけpresent、不存在だけzero payload、その他は拒否。
/// @cleanup 同期outputで子Processをjoin。試験物は作成しない。
/// @boundary ERB-IT-001=Direct Boundary: 固定CLI→Windows entry観測。
#[test]
fn filesystem_entry_observation_has_fixed_frame_and_no_path_fallback() {
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::IntoRawHandle;
    use windows_sys::Win32::Foundation::CloseHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_TAG_INFO, FILE_FLAG_BACKUP_SEMANTICS,
        FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
        FileAttributeTagInfo, GetFileInformationByHandle, GetFileInformationByHandleEx,
    };
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let source = root.join("Cargo.toml");
    let before = std::fs::read(&source).unwrap();
    let mut identities = Vec::new();
    for (directory, target) in [(false, source.as_path()), (true, root)] {
        let output = Command::new(BINARY)
            .arg("--filesystem-entry")
            .arg(target)
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(0));
        assert!(output.stderr.is_empty());
        assert_eq!(output.stdout.len(), 41);
        assert_eq!(&output.stdout[..9], b"CRDDFE01P");
        assert_eq!(&output.stdout[13..17], &[0; 4]);
        assert!(output.stdout[17..21].iter().any(|b| *b != 0));
        assert!(output.stdout[21..29].iter().any(|b| *b != 0));
        assert!(output.stdout[29..37].iter().any(|b| *b != 0));
        assert!(output.stdout[37..41].iter().any(|b| *b != 0));
        let handle = std::fs::OpenOptions::new()
            .access_mode(FILE_READ_ATTRIBUTES)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
            .open(target)
            .unwrap()
            .into_raw_handle();
        // SAFETY: Win32 output structures permit zero initialization; test owns this independent handle.
        let (mut info, mut tag): (BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_TAG_INFO) =
            unsafe { (std::mem::zeroed(), std::mem::zeroed()) };
        // SAFETY: both writable buffers have exact sizes and the handle remains open through the queries.
        let observed = unsafe {
            GetFileInformationByHandle(handle, &mut info) != 0
                && GetFileInformationByHandleEx(
                    handle,
                    FileAttributeTagInfo,
                    (&mut tag as *mut FILE_ATTRIBUTE_TAG_INFO).cast(),
                    std::mem::size_of::<FILE_ATTRIBUTE_TAG_INFO>() as u32,
                ) != 0
        };
        // SAFETY: this test owns the handle and closes it once even after a failed query.
        let closed = unsafe { CloseHandle(handle) } != 0;
        assert!(observed && closed);
        assert_eq!(info.dwFileAttributes, tag.FileAttributes);
        assert_eq!(info.dwFileAttributes & 0x10 != 0, directory);
        let mut expected = Vec::from(*b"CRDDFE01P");
        expected.extend_from_slice(&info.dwFileAttributes.to_le_bytes());
        expected.extend_from_slice(&tag.ReparseTag.to_le_bytes());
        expected.extend_from_slice(&info.dwVolumeSerialNumber.to_le_bytes());
        expected.extend_from_slice(
            &((u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow)).to_le_bytes(),
        );
        expected.extend_from_slice(
            &((u64::from(info.ftCreationTime.dwHighDateTime) << 32)
                | u64::from(info.ftCreationTime.dwLowDateTime))
            .to_le_bytes(),
        );
        expected.extend_from_slice(&info.nNumberOfLinks.to_le_bytes());
        assert_eq!(output.stdout, expected);
        let repeated = Command::new(BINARY)
            .arg("--filesystem-entry")
            .arg(target)
            .output()
            .unwrap();
        assert_eq!(repeated.status.code(), Some(0));
        assert!(repeated.stderr.is_empty());
        assert_eq!(repeated.stdout, output.stdout);
        identities.push(output.stdout[17..37].to_vec());
    }
    assert_ne!(identities[0], identities[1]);
    let absent = root
        .join("src")
        .join(format!("crdd-entry-absent-{}", std::process::id()));
    assert!(!absent.exists());
    let output = Command::new(BINARY)
        .arg("--filesystem-entry")
        .arg(absent)
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(0));
    assert_eq!(&output.stdout[..9], b"CRDDFE01A");
    assert_eq!(&output.stdout[9..], &[0; 32]);
    for args in [
        vec!["--filesystem-entry"],
        vec!["--filesystem-entry", "C:\\NUL"],
        vec!["--filesystem-entry", "relative"],
        vec!["--filesystem-entry", "C:\\path\\entry:stream"],
        vec!["--filesystem-entry", "C:\\path\\.\\entry"],
        vec!["--filesystem-entry", "C:\\path\\entry", "extra"],
    ] {
        let output = Command::new(BINARY).args(args).output().unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert!(!output.stdout.starts_with(b"CRDDFE01"));
    }
    assert_eq!(std::fs::read(source).unwrap(), before);
}

/// 退役したLocalAppData専用modeを読取り前に拒否する。
/// @responsibility 共用Known Folder処理を公開CLIへ露出しない。
/// @trace ERB-IT-001
/// @precondition Cargoが生成した固定Native実行物。
/// @stimulus 退役modeと余分なselectorを実Processへ渡す。
/// @observation exit、stderr、用途magicと有界frame長。
/// @oracle 全例exit2で専用frameを返さない。
/// @cleanup 同期outputで子Processをjoinする。
/// @boundary ERB-IT-001=Direct Boundary: 固定CLI→Windows Known Folder。
#[test]
fn retired_local_app_data_mode_is_not_available() {
    for arguments in [
        vec!["--local-app-data-directory"],
        vec!["--local-app-data-directory", "extra"],
    ] {
        let refused = Command::new(BINARY)
            .args(arguments)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert_eq!(refused.status.code(), Some(2));
        assert!(refused.stderr.is_empty());
        assert!(!refused.stdout.starts_with(b"CRDDLA01"));
    }
}

/// 退役したNamespace modeを一般の不正要求として拒否する。
/// @trace ERB-IT-003
/// @precondition Cargo固定binary。実共有領域は操作しない。
/// @stimulus 退役した二modeと余分argvを与える。
/// @observation exit2、stderrなし、一般の固定拒否frame。
/// @oracle Namespace専用受付へ配送しない。
/// @cleanup outputで子Process終了を待つ。
#[test]
fn retired_namespace_modes_are_not_available() {
    for arguments in [
        vec!["--host-recovery-namespace-observe"],
        vec!["--host-recovery-namespace-initialize"],
        vec!["--host-recovery-namespace-initialize", "extra"],
    ] {
        let output = Command::new(BINARY)
            .args(arguments)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stderr.is_empty());
        assert_eq!(&output.stdout[..8], b"CRDDPR03");
        assert_eq!(output.stdout[11], 0);
    }
}

use std::io::Write;
use std::process::{Command, Stdio};

const BINARY: &str = env!("CARGO_BIN_EXE_crdd-platform-access");

/// 旧Root要求とAppContainer入口をOS操作へ配送しない。
/// @trace ERB-IT-001
#[test]
fn retired_root_and_appcontainer_inputs_are_rejected() {
    let mut old_root = vec![0_u8; 64];
    old_root[..8].copy_from_slice(b"CRDDPA03");
    old_root[8..10].copy_from_slice(&3_u16.to_le_bytes());
    old_root[10] = 1;
    old_root[56..60].copy_from_slice(&4_u32.to_le_bytes());
    old_root[60..].copy_from_slice(b"C:\\x");
    for input in [old_root.as_slice(), b"invalid"] {
        let result = invoke(input);
        assert_eq!(result.status.code(), Some(2));
        assert!(result.stderr.is_empty());
        assert_eq!(&result.stdout[..8], b"CRDDPR03");
        assert_eq!(result.stdout[11], 0);
    }
    let result = Command::new(BINARY)
        .args(["--appcontainer-pipe", r"\\.\pipe\LOCAL\CRDD.NoConnection"])
        .stdin(Stdio::null())
        .output()
        .unwrap();
    assert_eq!(result.status.code(), Some(2));
    assert!(result.stderr.is_empty());
    assert_eq!(&result.stdout[..8], b"CRDDPR03");
}

#[test]
fn retired_terminal_modes_are_not_available() {
    for mode in [
        "--docker-desktop-repair-helper",
        "--docker-desktop-restart-helper",
        "--host-terminal-observe",
        "--host-terminal-save",
        "--host-terminal-read",
        "--host-terminal-known-file-observe",
        "--host-terminal-known-file-save",
        "--host-terminal-known-file-read",
    ] {
        let output = Command::new(BINARY)
            .arg(mode)
            .stdin(Stdio::null())
            .output()
            .unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert_eq!(&output.stdout[..8], b"CRDDPR03");
        assert!(output.stderr.is_empty());
    }
}

/// Provider Home観測の固定入力を構成する。
///
/// @responsibility 固定76bytesへProvider、revisionとnonceを配置する。
/// @trace ERB-IT-001
/// @precondition Caseが観測または拒否確認のProvider値を指定する。
/// @stimulus magic、revisionと固定binding値を所定offsetへ書く。
/// @observation CLIへ渡す所有byte配列を返す。
/// @oracle Caseが固定応答のProvider・nonce・理由を判定する。入力生成からHome正常を推定しない。
/// @cleanup N/A: memoryだけを使いCredential本文や外部資源を扱わない。
/// @boundary 試験の値→Provider Home観測Protocol。
fn provider_home_request(provider: u8, nonce: [u8; 32]) -> [u8; 76] {
    let mut bytes = [0_u8; 76];
    bytes[..8].copy_from_slice(b"CRDDPH02");
    bytes[8..10].copy_from_slice(&3_u16.to_le_bytes());
    bytes[10] = provider;
    bytes[12..44].copy_from_slice(&nonce);
    bytes[44..76].copy_from_slice(&[7_u8; 32]);
    bytes
}

/// 固定CLIへ入力を搬送し終了結果を受け取る。
///
/// @responsibility 試験binaryを起動しstdinの所有者を閉じてwait_with_outputへ結ぶ。
/// @trace ERB-IT-001
/// @precondition Cargoが指定した固定CLIが試験用に構築されている。
/// @stimulus 所有stdinへ全入力を書き、stdoutとstderrを回収する。
/// @observation Processの終了値と二つの出力byte列を返す。
/// @oracle spawn・入力搬送・待機の失敗をunwrapで拒否し、Caseが応答を判定する。
/// @cleanup 正常時はwait_with_outputで子をjoinする。硬期限、Job終端、全handle不存在、panic時清掃は保証しない。
/// @boundary Native試験Process→固定CLI子Process。Docker／Providerの依頼は発行しない。
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

/// binary_reports_provider_home_and_invalid_requestsを検証する。
///
/// @responsibility binary_reports_candidate_blocked_and_invalid_requestsの合否判定を所有する。
/// @trace ERB-IT-001
/// @precondition Test moduleが構築するfixtureと入力を使用する。
/// @stimulus binary_reports_candidate_blocked_and_invalid_requestsの対象操作を実行する。
/// @observation 結果、状態、Effectおよび終了後条件を観測する。
/// @oracle Test本文のassertionが期待条件を満たす。
/// @cleanup Test本文またはDrop実装が作成資源を清掃する。
/// @boundary Direct Boundary: Adapter→実CLI・Process・Container
#[test]
fn binary_reports_candidate_blocked_and_invalid_requests() {
    let nonce = [6_u8; 32];
    let provider_home = invoke(&provider_home_request(2, nonce));
    assert!(matches!(provider_home.status.code(), Some(0 | 2)));
    assert!(provider_home.stderr.is_empty());
    assert_eq!(provider_home.stdout.len(), 182);
    assert_eq!(&provider_home.stdout[..8], b"CRDDHO02");
    assert_eq!(provider_home.stdout[10], 2);
    assert_eq!(&provider_home.stdout[12..44], &nonce);

    // 廃止したStore種別3は初期化・Known Folder観測へ到達せず拒否する。
    let retired_store = invoke(&provider_home_request(3, nonce));
    assert_eq!(retired_store.status.code(), Some(2));
    assert!(retired_store.stderr.is_empty());
    assert_eq!(retired_store.stdout.len(), 182);
    assert_eq!(&retired_store.stdout[..8], b"CRDDHO02");
    assert_eq!(
        u16::from_le_bytes(retired_store.stdout[44..46].try_into().unwrap()),
        2
    );

    let mut invalid_provider_home = provider_home_request(5, nonce);
    invalid_provider_home[11] = 1;
    let invalid_provider_home = invoke(&invalid_provider_home);
    assert_eq!(invalid_provider_home.status.code(), Some(2));
    assert!(invalid_provider_home.stderr.is_empty());
    assert_eq!(invalid_provider_home.stdout.len(), 182);
    assert_eq!(&invalid_provider_home.stdout[..8], b"CRDDHO02");
    assert_eq!(
        u16::from_le_bytes(invalid_provider_home.stdout[44..46].try_into().unwrap()),
        2
    );
}
