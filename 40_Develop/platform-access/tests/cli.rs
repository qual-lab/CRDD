//! Native CLIのProtocolと候補・拒否応答を固定binaryで確認する。
//!
//! @packageDocumentation
//! @responsibility 生成した入力をCLIへ搬送し、終了値・固定応答とnonce対応を判定する。
//! @trace ERB-IT-001
//! @trace ERB-IT-003
//! @level IT
//! @scope Repository／Provider Home観測Protocolの正常・不正・旧版拒否と、専用管理フォルダ初期化要求の不正・混用を取得前に拒否する確認。正常な共有フォルダ初期化、Host限定回復やProvider実行は対象外。
//! @boundary Native試験Process→固定CLI→Windows観測。Job終端、全handle不存在および例外時清掃は証明しない。

#![cfg(windows)]

/// 専用初期化CLIの不正・混用要求を実Processで拒否する。
///
/// @responsibility 新しいmodeの誤作成を取得前のframe拒否で反証する。
/// @trace ERB-IT-003
/// @precondition Cargo固定binary。正しい作成要求と実共有境界は使用しない。
/// @stimulus 欠落、別modeの正しい読取りframe、余分argvを与える。
/// @observation exit2、stderrなし、空実体・receipt・closeの専用拒否。
/// @oracle 全不正要求は固定拒否であり作成・handle取得0。
/// @cleanup child入力を閉じ、wait_with_outputでjoinする。
/// @boundary 試験Process→固定CLI。不正入力以外のOS初期化は未確認。
#[test]
fn dedicated_namespace_modes_reject_before_os_effect() {
    let mut capture = b"CRDDNC01".to_vec();
    capture.extend_from_slice(&1_u16.to_le_bytes());
    capture.extend_from_slice(&[7; 32]);
    for (arguments, input) in [
        (
            vec!["--host-recovery-namespace-observe"],
            b"CRDDNC01".as_slice(),
        ),
        (
            vec!["--host-recovery-namespace-initialize"],
            capture.as_slice(),
        ),
        (
            vec!["--host-recovery-namespace-initialize", "extra"],
            capture.as_slice(),
        ),
    ] {
        let mut child = Command::new(BINARY)
            .args(&arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(input).unwrap();
        let output = child.wait_with_output().unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stderr.is_empty());
        if arguments.len() == 1 {
            assert_eq!(&output.stdout[..8], b"CRDDNR01");
            assert_eq!(&output.stdout[42..49], &[0, 34, 0, 0, 0, 0, 0]);
            assert_eq!(&output.stdout[49..59], &[0, 0, 2, 0, 2, 0, 0, 2, 0, 2]);
            assert_eq!(&output.stdout[59..], b"terminal_namespace_request_invalid");
        } else {
            assert_eq!(&output.stdout[..8], b"CRDDPR03");
        }
    }
}

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

/// Host確認の専用CLIが不正要求を無取得で拒否する。
///
/// @responsibility 専用modeと既存modeを混在させず、実Processの応答形式を確認する。
/// @trace ERB-IT-001
/// @precondition Cargoが構築した固定試験binary。OS対象の正常観測は行わない。
/// @stimulus 専用modeへ不正bytesを渡し、余分argvと標準modeの混用も試す。
/// @observation 実exit、stdout/stderr、専用応答の資源取得数。
/// @oracle 専用不正入力はexit2・phase1・取得0。混用は成功せず標準拒否形式になる。
/// @cleanup 全自己所有childをwait_with_outputでjoinする。対象Directoryは作らない。
/// @boundary 試験Process→専用Native CLI。不正要求はWindows対象取得前に停止する。
#[test]
fn dedicated_host_observation_rejects_invalid_input_without_acquisition() {
    for arguments in [
        vec!["--host-terminal-observe"],
        vec!["--host-terminal-observe", "extra"],
        vec!["--host-terminal-known-file-observe"],
        vec!["--host-terminal-known-file-observe", "extra"],
        vec![],
    ] {
        let mut child = Command::new(BINARY)
            .args(&arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(b"CRDDHT02").unwrap();
        let output = child.wait_with_output().unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stderr.is_empty());
        if arguments.len() == 1 {
            assert_eq!(
                &output.stdout[..8],
                if arguments[0] == "--host-terminal-observe" {
                    b"CRDDHR02"
                } else {
                    b"CRDDKR03"
                }
            );
            assert_eq!(&output.stdout[42..45], &[0, 1, 24]);
            assert_eq!(&output.stdout[47..53], &[0; 6]);
            assert_eq!(&output.stdout[53..], b"terminal_request_invalid");
        } else {
            assert_eq!(&output.stdout[..8], b"CRDDPR03");
        }
    }
}

/// 専用保存CLIが不正要求とmode混用を実Processで拒否する。
///
/// @responsibility 保存入口の取得前拒否を既存観測入口から区別する。
/// @trace ERB-IT-001
/// @precondition Cargoが構築した固定binary。正常保存要求は発行しない。
/// @stimulus 不完全保存frame、観測frame混用および余分argvを渡す。
/// @observation 実exit、stderr、専用frameと内部観測の資源取得0。
/// @oracle 専用拒否はexit2・receiptなし・phase1・取得0。余分argvは標準拒否。
/// @cleanup 全自己所有childをwait_with_outputでjoinする。Directoryや記録は作らない。
/// @boundary Test→専用保存CLI。実保存・保護・清掃成立は主張しない。
#[test]
fn dedicated_host_save_rejects_invalid_input_without_record_effect() {
    for (arguments, input) in [
        (vec!["--host-terminal-save"], b"CRDDHS01".as_slice()),
        (vec!["--host-terminal-save"], b"CRDDHT02".as_slice()),
        (
            vec!["--host-terminal-save", "extra"],
            b"CRDDHS01".as_slice(),
        ),
    ] {
        let mut child = Command::new(BINARY)
            .args(&arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(input).unwrap();
        let output = child.wait_with_output().unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stderr.is_empty());
        if arguments.len() == 1 {
            assert_eq!(&output.stdout[..8], b"CRDDHW01");
            assert_eq!(output.stdout[42], 0);
            assert_eq!(output.stdout[43], 0);
            assert_eq!(output.stdout[51], 0);
            let offset = 52
                + output.stdout[44..49]
                    .iter()
                    .map(|byte| usize::from(*byte))
                    .sum::<usize>();
            assert_eq!(&output.stdout[offset..offset + 8], b"CRDDHR02");
            assert_eq!(output.stdout[offset + 43], 1);
            assert_eq!(&output.stdout[offset + 47..offset + 53], &[0; 6]);
        } else {
            assert_eq!(&output.stdout[..8], b"CRDDPR03");
        }
    }
}

/// 十二実体専用CLIを資源取得前の拒否まで実搬送する。
///
/// @responsibility 新旧・保存／読取り混用と独立本文Hash差を専用dispatchで止める。
/// @trace ERB-IT-001
/// @precondition Cargoの固定binary。正常な固定OS namespaceへの保存は対象外。
/// @stimulus 欠落・旧frame・逆mode・余分argv・正形状の本文Hash差を与える。
/// @observation 実exit、nonce／同参照保持、内包frame、全資源取得0とreceipt欠落。
/// @oracle exit2、専用revision 3拒否、取得0。余分argvは標準拒否。
/// @cleanup childをjoinしstdin／stdoutを終了する。OS保存・削除0。
/// @boundary 試験Process→十二実体専用Native dispatch→本文Hash Gate。
#[test]
fn known_file_record_cli_rejects_mixed_frames_and_body_hash_before_os_acquisition() {
    let reference = b"host-terminal.12345678-1234-4234-8234-123456789abc";
    let root = b"crdd-coordinator-doctor-12345678-1234-4234-8234-123456789abc";
    let marker = format!("host-{}.json", "a".repeat(64));
    let mut complete = b"CRDDKS03\x03\x00".to_vec();
    complete.extend_from_slice(&[1; 32]);
    complete.extend_from_slice(&[50, 60, 74]);
    complete.extend_from_slice(&2_u16.to_le_bytes());
    for index in 0..12_u32 {
        for field in [
            1,
            0,
            index + 1,
            9,
            10,
            if [4, 11].contains(&index) { 0x80 } else { 0x10 },
        ] {
            complete.extend_from_slice(&field.to_le_bytes());
        }
    }
    complete.extend_from_slice(&[2; 32]);
    complete.extend_from_slice(&[3; 32]);
    complete.extend_from_slice(&7_u32.to_le_bytes());
    complete.extend_from_slice(&1_u32.to_le_bytes());
    complete.extend_from_slice(&[
        0xbe, 0x93, 0x51, 0x74, 0x1a, 0x81, 0x55, 0xd0, 0x1f, 0xd0, 0x28, 0xd1, 0x58, 0x54, 0x6f,
        0x10, 0x05, 0xe7, 0x3c, 0xee, 0xb0, 0xbb, 0x2d, 0x09, 0x33, 0x35, 0xfe, 0xac, 0x41, 0x44,
        0xe4, 0x50,
    ]);
    complete.extend_from_slice(&[4; 32]);
    assert_eq!(complete.len(), 471);
    complete.extend_from_slice(reference);
    complete.extend_from_slice(root);
    complete.extend_from_slice(marker.as_bytes());
    complete.extend_from_slice(b"{}");
    for (mode, magic, response_magic, header, reason) in [
        (
            "--host-terminal-known-file-save",
            b"CRDDKS03",
            b"CRDDKW03",
            52,
            "terminal_save_bytes_hash_unconfirmed",
        ),
        (
            "--host-terminal-known-file-read",
            b"CRDDKL03",
            b"CRDDKB03",
            55,
            "terminal_read_bytes_hash_unconfirmed",
        ),
    ] {
        complete[..8].copy_from_slice(magic);
        for (input, extra) in [
            (b"CRDDHS01".as_slice(), false),
            (b"CRDDKS03".as_slice(), false),
            (complete.as_slice(), true),
            (complete.as_slice(), false),
        ] {
            let mut command = Command::new(BINARY);
            command.arg(mode);
            if extra {
                command.arg("extra");
            }
            let mut child = command
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .spawn()
                .unwrap();
            child.stdin.take().unwrap().write_all(input).unwrap();
            let output = child.wait_with_output().unwrap();
            assert_eq!(output.status.code(), Some(2));
            assert!(output.stderr.is_empty());
            if extra {
                assert_eq!(&output.stdout[..8], b"CRDDPR03");
                continue;
            }
            assert_eq!(&output.stdout[..8], response_magic);
            assert_eq!(&output.stdout[8..10], &3_u16.to_le_bytes());
            let complete_input = input.len() > 471;
            assert_eq!(
                &output.stdout[10..42],
                &[if complete_input { 1 } else { 0 }; 32]
            );
            let offset = if header == 52 {
                assert_eq!(output.stdout[42], 0);
                assert_eq!(output.stdout[43], if complete_input { 50 } else { 0 });
                assert_eq!(output.stdout[51], 0);
                52 + usize::from(output.stdout[43])
                    + output.stdout[44..49]
                        .iter()
                        .map(|byte| usize::from(*byte))
                        .sum::<usize>()
            } else {
                assert_eq!(output.stdout[42], 0);
                assert_eq!(output.stdout[43], 0);
                assert_eq!(output.stdout[44], if complete_input { 50 } else { 0 });
                assert_eq!(&output.stdout[49..55], &[0, 0, 0, 2, 0, 2]);
                55 + usize::from(output.stdout[44])
                    + usize::from(output.stdout[45])
                    + usize::from(output.stdout[46])
            };
            assert_eq!(&output.stdout[offset..offset + 10], b"CRDDKR03\x03\x00");
            assert_eq!(&output.stdout[offset + 47..offset + 53], &[0; 6]);
            if complete_input {
                assert_eq!(&output.stdout[header..header + 50], reference);
                assert_eq!(
                    &output.stdout[header + 50..header + 50 + reason.len()],
                    reason.as_bytes()
                );
            }
        }
    }
}

/// 専用読戻しCLIを不正入力で取得前停止させる。
///
/// @responsibility 保存modeと読取りmodeの混用を実Processで拒否する。
/// @trace ERB-IT-001
/// @precondition Cargo固定binary。正常な実OS記録は対象外。
/// @stimulus 不完全read frame、save frame、余分argvを渡す。
/// @observation 実exit、専用応答、参照/記録/外側取得の欠落。
/// @oracle exit2、取得0、専用read拒否。余分argvは既存標準拒否。
/// @cleanup 自己所有childをjoinする。保存場所や記録を作らない。
/// @boundary 試験Process→専用Native read dispatch。
#[test]
fn dedicated_host_read_rejects_invalid_input_without_mutation() {
    for (arguments, input) in [
        (vec!["--host-terminal-read"], b"CRDDHL01".as_slice()),
        (vec!["--host-terminal-read"], b"CRDDHS01".as_slice()),
        (
            vec!["--host-terminal-read", "extra"],
            b"CRDDHL01".as_slice(),
        ),
    ] {
        let mut child = Command::new(BINARY)
            .args(&arguments)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .unwrap();
        child.stdin.take().unwrap().write_all(input).unwrap();
        let output = child.wait_with_output().unwrap();
        assert_eq!(output.status.code(), Some(2));
        assert!(output.stderr.is_empty());
        if arguments.len() == 1 {
            assert_eq!(&output.stdout[..8], b"CRDDHB01");
            assert_eq!(&output.stdout[8..10], &2_u16.to_le_bytes());
            assert_eq!(&output.stdout[42..45], &[0; 3]);
            assert_eq!(&output.stdout[49..55], &[0, 0, 0, 2, 0, 2]);
            let offset = 55 + usize::from(output.stdout[45]) + usize::from(output.stdout[46]);
            assert_eq!(&output.stdout[offset..offset + 8], b"CRDDHR02");
            assert_eq!(output.stdout[offset + 43], 1);
            assert_eq!(&output.stdout[offset + 47..offset + 53], &[0; 6]);
        } else {
            assert_eq!(&output.stdout[..8], b"CRDDPR03");
        }
    }
}

/// 試験用Directoryの三field Identityを取得する。
///
/// @responsibility CLI入力へ使うvolumeとfile indexを同じhandleから取得する。
/// @trace ERB-IT-001
/// @precondition Caseが自己生成したDirectoryを渡す。
/// @stimulus OPEN_REPARSE_POINTを指定してhandleを開き、同handleで実体情報を問い合わせる。
/// @observation volume serialとfile indexの二fieldを返す。
/// @oracle openと情報取得の失敗をassertionで拒否する。値は処置Authorityではない。
/// @cleanup 自己所有handleへCloseHandleを一回要求するが返却値は未確認。Directory清掃はCaseが所有する。
/// @boundary 試験Helper→Windowsの読取りAPI。終了成功・残存ゼロは証明しない。
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

/// Repository観測の固定Protocol入力を構成する。
///
/// @responsibility Path、三field Identityとnonceをrevision 3のbyte順へ配置する。
/// @trace ERB-IT-001
/// @precondition Caseが正常値または意図した拒否入力を指定する。
/// @stimulus 固定magic、revisionと入力値をlittle-endianで連結する。
/// @observation CLIへ渡す所有byte列を返す。
/// @oracle 長さがu32へ変換できない入力はpanicで拒否し、CaseがCLI応答を判定する。
/// @cleanup N/A: memory上のbyte列だけを作り外部資源を取得しない。
/// @boundary 試験の値→Repository観測Protocol。構成だけを実観測にしない。
fn request(path: &str, identity: [u32; 3], nonce: [u8; 32]) -> Vec<u8> {
    let mut bytes = Vec::new();
    bytes.extend_from_slice(b"CRDDPA03");
    bytes.extend_from_slice(&3_u16.to_le_bytes());
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

/// binary_reports_candidate_blocked_and_invalid_requestsを検証する。
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
    assert_eq!(candidate.stdout.len(), 86);
    assert_eq!(&candidate.stdout[..8], b"CRDDPR03");
    assert_eq!(candidate.stdout[11], 1);
    assert_eq!(&candidate.stdout[12..44], &nonce);
    assert_eq!(
        u16::from_le_bytes(candidate.stdout[44..46].try_into().unwrap()),
        100
    );
    assert!(candidate.stdout[50..82].iter().any(|byte| *byte != 0));
    assert_ne!(
        u32::from_le_bytes(candidate.stdout[82..86].try_into().unwrap()) & 1,
        0
    );
    let repeated = invoke(&request(path, identity, nonce));
    assert!(repeated.status.success());
    assert_eq!(&candidate.stdout[50..82], &repeated.stdout[50..82]);

    let blocked = invoke(&request(path, [0, 0, 0], nonce));
    assert_eq!(blocked.status.code(), Some(2));
    assert_eq!(blocked.stdout.len(), 86);
    assert_eq!(blocked.stdout[11], 0);
    assert_eq!(
        u16::from_le_bytes(blocked.stdout[44..46].try_into().unwrap()),
        4
    );

    let invalid = invoke(b"invalid");
    assert_eq!(invalid.status.code(), Some(2));
    assert_eq!(invalid.stdout.len(), 86);
    assert_eq!(invalid.stdout[11], 0);
    assert_eq!(
        u16::from_le_bytes(invalid.stdout[44..46].try_into().unwrap()),
        2
    );

    let mut revision_two = request(path, identity, nonce);
    revision_two[..8].copy_from_slice(b"CRDDPA02");
    revision_two[8..10].copy_from_slice(&2_u16.to_le_bytes());
    let legacy = invoke(&revision_two);
    assert_eq!(legacy.status.code(), Some(2));
    assert!(legacy.stderr.is_empty());
    assert_eq!(legacy.stdout.len(), 86);
    assert_eq!(&legacy.stdout[..8], b"CRDDPR03");
    assert_eq!(
        u16::from_le_bytes(legacy.stdout[8..10].try_into().unwrap()),
        3
    );
    assert_eq!(legacy.stdout[11], 0);
    assert_eq!(
        u16::from_le_bytes(legacy.stdout[44..46].try_into().unwrap()),
        2
    );

    let provider_home = invoke(&provider_home_request(2, nonce));
    assert!(matches!(provider_home.status.code(), Some(0 | 2)));
    assert!(provider_home.stderr.is_empty());
    assert_eq!(provider_home.stdout.len(), 182);
    assert_eq!(&provider_home.stdout[..8], b"CRDDHO02");
    assert_eq!(provider_home.stdout[10], 2);
    assert_eq!(&provider_home.stdout[12..44], &nonce);

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
    std::fs::remove_dir(root).unwrap();
}
