//! Native CLIのProtocolと候補・拒否応答を固定binaryで確認する。
//!
//! @packageDocumentation
//! @responsibility 生成した入力をCLIへ搬送し、終了値・固定応答とnonce対応を判定する。
//! @trace ERB-IT-001
//! @trace ERB-IT-003
//! @level IT
//! @scope Provider Home観測Protocolの正常・不正・旧版拒否と、退役したStore／Runtime State・初期化要求のEffect前拒否。Host限定回復やProvider実行は対象外。
//! @boundary Native試験Process→固定CLI→Windows観測。Job終端、全handle不存在および例外時清掃は証明しない。

#![cfg(windows)]

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
        "--filesystem-entry",
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

    // 旧種別と初期化要求を、OS観測・Directory作成前に拒否する。
    for (provider, flags) in [
        (3, &[0, 1][..]),
        (4, &[0, 1][..]),
        (5, &[0, 1][..]),
        (1, &[1, 2, u8::MAX][..]),
        (2, &[1, 2, u8::MAX][..]),
    ] {
        for flag in flags {
            let mut request = provider_home_request(provider, nonce);
            request[11] = *flag;
            let rejected = invoke(&request);
            assert_eq!(rejected.status.code(), Some(2));
            assert!(rejected.stderr.is_empty());
            assert_eq!(rejected.stdout.len(), 182);
            assert_eq!(&rejected.stdout[..8], b"CRDDHO02");
            assert_eq!(rejected.stdout[11], 0);
            assert_eq!(
                u16::from_le_bytes(rejected.stdout[44..46].try_into().unwrap()),
                2
            );
            assert!(rejected.stdout[46..].iter().all(|byte| *byte == 0));
        }
    }
}
