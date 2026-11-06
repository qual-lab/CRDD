//! Namespaceの値契約と明示Owner限定の実境界を確認する。
//! @packageDocumentation
//! @responsibility 記録退役後のNamespace反証を維持する。
//! @trace ERB-IT-001
//! @trace ERB-IT-002
//! @trace ERB-IT-003
//! @level IT
//! @scope 純粋契約と既存ignored自己生成fixture。
//! @boundary 過去保持物と実共有領域は操作しない。
use super::*;
use crate::filesystem::protection::DirectoryIdentity;
use crate::host_record::host_namespace::{
    TerminalDirectory, TerminalNamespaceIdentity, decode_terminal_temporary_parent,
    validate_terminal_namespace,
};
use crate::host_record::protected_file::{
    close_terminal_handle, observe_terminal_presence, open_terminal_handle, terminal_identity,
    terminal_presence_result, with_terminal_descriptor,
};
use crate::process::principal::{
    local_system_sid_bytes, process_tokens, selected_user_token_binding, token_user_sid_bytes,
};
use std::fs;
use std::path::Path;
use windows_sys::Win32::Storage::FileSystem::{
    CreateDirectoryW, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT, FILE_READ_ATTRIBUTES,
    FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, GetTempPathW,
};

/// 固定保存境界の期待値とOS返却値の純境界を確認する。
///
/// @responsibility 純値の反例を実Directory/ACL故障の観測にしない。
/// @trace ERB-IT-002
/// @precondition OS handle・file・Processを取得しない。
/// @stimulus 三実体の重複・属性不正とUTF-16/length/Pathの不正。
/// @observation 本番と同じ検査Helperの固定理由。
/// @oracle 正常値だけ受理し、全位置の重複/file/reparseと不正API返却を拒否する。
/// @cleanup N/A: 純値だけ。
/// @boundary Native内部の値検査。OS親・三Root・公開Recoveryは未検証。
#[test]
fn terminal_namespace_value_contract() {
    let parent = DirectoryIdentity {
        volume_serial_number: 1,
        file_index_high: 0,
        file_index_low: 1,
        creation_time_low: 2,
        creation_time_high: 3,
        attributes: FILE_ATTRIBUTE_DIRECTORY,
    };
    let expected = TerminalNamespaceIdentity {
        parent,
        recovery: DirectoryIdentity {
            file_index_low: 2,
            ..parent
        },
        terminal: DirectoryIdentity {
            file_index_low: 3,
            ..parent
        },
        selected_user: [7; 32],
    };
    assert_eq!(validate_terminal_namespace(expected), Ok(()));
    for position in 0..3 {
        for attributes in [0, FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT] {
            let mut changed = expected;
            match position {
                0 => changed.parent.attributes = attributes,
                1 => changed.recovery.attributes = attributes,
                _ => changed.terminal.attributes = attributes,
            }
            assert_eq!(
                validate_terminal_namespace(changed),
                Err("terminal_namespace_expected_invalid")
            );
        }
    }
    for (left, right) in [(0, 1), (0, 2), (1, 2)] {
        let mut ids = [expected.parent, expected.recovery, expected.terminal];
        ids[right] = DirectoryIdentity {
            creation_time_low: 999,
            ..ids[left]
        };
        let changed = TerminalNamespaceIdentity {
            parent: ids[0],
            recovery: ids[1],
            terminal: ids[2],
            ..expected
        };
        assert_eq!(
            validate_terminal_namespace(changed),
            Err("terminal_namespace_expected_duplicate")
        );
    }
    let mut wide: Vec<u16> = "C:\\fixture\\".encode_utf16().collect();
    let length = wide.len() as u32;
    wide.push(0);
    assert_eq!(
        decode_terminal_temporary_parent(&wide, length).unwrap(),
        Path::new("C:/fixture")
    );
    for invalid_length in [0, wide.len() as u32, u32::MAX] {
        assert_eq!(
            decode_terminal_temporary_parent(&wide, invalid_length),
            Err("terminal_temporary_parent_unknown")
        );
    }
    assert_eq!(
        decode_terminal_temporary_parent(&[0xD800, 0], 1),
        Err("terminal_temporary_parent_unknown")
    );
    assert_eq!(
        decode_terminal_temporary_parent(&[65, 0, 66, 0], 3),
        Err("terminal_temporary_parent_unknown")
    );
    assert_eq!(
        decode_terminal_temporary_parent(&[65, 66], 1),
        Err("terminal_temporary_parent_unknown")
    );
    for invalid in [
        "fixture",
        "C:fixture",
        "\\\\server\\share\\fixture",
        "C:\\fixture\\..\\other",
        "\\\\?\\C:\\fixture",
    ] {
        let mut units: Vec<u16> = invalid.encode_utf16().collect();
        let length = units.len() as u32;
        units.push(0);
        assert_eq!(
            decode_terminal_temporary_parent(&units, length),
            Err("terminal_temporary_parent_invalid")
        );
    }
}

/// freshな固定二childでnamespace読取りと位置別拒否を観測する。
///
/// @responsibility fixture準備/清掃のEffectと本番private入口の読取りを区別する。
/// @trace ERB-IT-001
/// @trace ERB-IT-002
/// @trace ERB-IT-003
/// @precondition 固定Node Owner、fresh repo-local親、子TEMP/TMPだけを固定する。
/// @stimulus 正常open/verify、三位置五field不一致、利用者不一致、重複、二段階欠落。
/// @observation 各reject元理由・取得数・個別close、正常guard終端、fresh実体と空状態。
/// @oracle 不一致を拒否し、取得数と全個別closeが一致する。保存/削除Authorityなし。
/// @cleanup 全oracle後に自作空三Directoryだけを実体再照合して非再帰清掃。不明時保持。
/// @boundary unsigned私有Native。ACL故障/reparse/OS close故障、実OS親、全Recoveryは未観測。
#[test]
#[ignore = "Fixed namespace fixture; explicit Node owner required"]
fn terminal_namespace_fixture() {
    const RUN: &str = "namespace.261003.b17f28d1.r2";
    assert_eq!(
        std::env::var("CRDD_TERMINAL_NAMESPACE_RUN").as_deref(),
        Ok(RUN)
    );
    let repository = std::env::current_dir().unwrap();
    assert!(repository.join(".git").exists());
    let root_path = std::path::PathBuf::from(
        std::env::var("CRDD_TERMINAL_NAMESPACE_ROOT").expect("fixture root required"),
    );
    let parent = root_path.parent().unwrap();
    assert_eq!(root_path.file_name().unwrap(), "namespace-r2");
    assert_eq!(parent.parent().unwrap(), repository.join(".crdd/tests"));
    let name = parent.file_name().unwrap().to_str().unwrap();
    let suffix = name.strip_prefix("native-terminal-").unwrap();
    assert_eq!(suffix.len(), 36);
    assert!(suffix.bytes().enumerate().all(|(index, byte)| {
        if [8, 13, 18, 23].contains(&index) {
            byte == b'-'
        } else {
            byte.is_ascii_hexdigit()
        }
    }));
    use std::os::windows::fs::MetadataExt;
    for ancestor in [
        repository.clone(),
        repository.join(".crdd"),
        repository.join(".crdd/tests"),
        parent.to_path_buf(),
    ] {
        let metadata = fs::symlink_metadata(ancestor).unwrap();
        assert!(metadata.is_dir());
        assert_eq!(metadata.file_attributes() & 0x400, 0);
    }
    assert_eq!(
        std::env::current_exe().unwrap().parent().unwrap(),
        repository.join("40_Develop/platform-access/target/x86_64-pc-windows-msvc/debug/deps")
    );
    let root = root_path.as_path();
    let recovery = root.join("crdd-coordinator-recovery-v1");
    let terminal = recovery.join("terminal-v1");
    let paths = [root.to_path_buf(), recovery, terminal];
    let mut phase = "preflight";
    let mut closes = Vec::new();
    let mut rejects = Vec::new();
    let mut created = 0;
    let mut cleaned = 0;
    let mut normal_verified = false;
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        assert_eq!(observe_terminal_presence(root), Ok(false));
        let mut buffer = [0_u16; 4097];
        // SAFETY: bounded writable buffer; fixture observes real API with child env.
        let length = unsafe { GetTempPathW(buffer.len() as u32, buffer.as_mut_ptr()) };
        assert_eq!(
            decode_terminal_temporary_parent(&buffer, length).unwrap(),
            root
        );
        let (mut primary, mut impersonation) = process_tokens().unwrap();
        let user = token_user_sid_bytes(primary.0).unwrap();
        let system = local_system_sid_bytes().unwrap();
        let selected_user = selected_user_token_binding(primary.0, impersonation.0);
        closes.push((
            "fixture_token_impersonation",
            close_terminal_handle(&mut impersonation),
        ));
        closes.push(("fixture_token_primary", close_terminal_handle(&mut primary)));
        assert!(closes.iter().all(|(_, closed)| *closed));
        let selected_user = selected_user
            .expect("fixture selected-user profile unavailable")
            .principal_identity_hash;
        let mut identities = Vec::new();
        phase = "create";
        for path in &paths {
            assert_eq!(observe_terminal_presence(path), Ok(false));
            let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
            wide.push(0);
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: fixed fresh self-owned fixture child, live descriptor.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("fixture_directory_create_failed");
                }
                Ok(())
            })
            .unwrap();
            created += 1;
            identities.push(observe_fixture_identity(path, &mut closes));
        }
        let expected = TerminalNamespaceIdentity {
            parent: identities[0],
            recovery: identities[1],
            terminal: identities[2],
            selected_user,
        };
        phase = "normal";
        let mut directory = TerminalDirectory::open_fixed_namespace(expected).unwrap();
        directory.verify().unwrap();
        directory.verify().unwrap();
        assert_eq!(directory.token_closes, [true, true]);
        assert!(directory.close());
        assert_eq!(directory.directory_closes.len(), directory.handles.len());
        assert!(directory.directory_closes.iter().all(|closed| *closed));
        closes.push(("normal_directory_chain", true));
        normal_verified = true;
        phase = "identity_reject";
        for position in 0..3 {
            for field in 0..5 {
                let mut changed = expected;
                let identity = match position {
                    0 => &mut changed.parent,
                    1 => &mut changed.recovery,
                    _ => &mut changed.terminal,
                };
                match field {
                    0 => identity.volume_serial_number ^= 0x80000000,
                    1 => identity.file_index_high ^= 0x80000000,
                    2 => identity.file_index_low ^= 0x80000000,
                    3 => identity.creation_time_low ^= 0x80000000,
                    _ => identity.creation_time_high ^= 0x80000000,
                }
                let failure = TerminalDirectory::open_fixed_namespace(changed)
                    .err()
                    .unwrap();
                assert!(
                    [
                        "terminal_namespace_identity_mismatch",
                        "terminal_directory_identity_mismatch"
                    ]
                    .contains(&failure.reason)
                );
                assert_eq!(failure.reason, failure.operation_reason);
                assert_eq!(failure.tokens_acquired, 2);
                assert_eq!(failure.token_closes, [true, true]);
                assert_eq!(failure.directory_closes.len(), failure.directories_acquired);
                assert!(failure.directory_closes.iter().all(|closed| *closed));
                rejects.push(failure);
            }
        }
        phase = "user_duplicate_reject";
        let mut wrong_user = expected;
        wrong_user.selected_user[0] ^= 1;
        let failure = TerminalDirectory::open_fixed_namespace(wrong_user)
            .err()
            .unwrap();
        assert_eq!(failure.reason, "terminal_selected_user_mismatch");
        assert_eq!(failure.tokens_acquired, 2);
        assert_eq!(failure.token_closes, [true, true]);
        assert_eq!(failure.directories_acquired, 0);
        rejects.push(failure);
        let duplicate = TerminalNamespaceIdentity {
            recovery: expected.parent,
            ..expected
        };
        let failure = TerminalDirectory::open_fixed_namespace(duplicate)
            .err()
            .unwrap();
        assert_eq!(failure.reason, "terminal_namespace_expected_duplicate");
        assert_eq!(failure.tokens_acquired, 0);
        assert_eq!(failure.directories_acquired, 0);
        rejects.push(failure);
        phase = "cleanup_missing_reject";
        for position in (0..3).rev() {
            assert_eq!(
                observe_fixture_identity(&paths[position], &mut closes),
                identities[position]
            );
            assert!(fs::read_dir(&paths[position]).unwrap().next().is_none());
            assert!(closes.iter().all(|(_, closed)| *closed));
            fs::remove_dir(&paths[position]).unwrap();
            cleaned += 1;
            assert_eq!(observe_terminal_presence(&paths[position]), Ok(false));
            if position != 0 {
                let failure = TerminalDirectory::open_fixed_namespace(expected)
                    .err()
                    .unwrap();
                assert_eq!(failure.reason, "terminal_open_failed");
                assert_eq!(failure.tokens_acquired, 2);
                assert_eq!(failure.token_closes, [true, true]);
                assert_eq!(failure.directory_closes.len(), failure.directories_acquired);
                assert!(failure.directory_closes.iter().all(|closed| *closed));
                rejects.push(failure);
            }
        }
        assert_eq!(rejects.len(), 19);
        assert_eq!(observe_terminal_presence(root), Ok(false));
        phase = "complete";
    }));
    let rows = rejects.iter().map(|failure| format!("{{\"reason\":\"{}\",\"operationReason\":\"{}\",\"tokensAcquired\":{},\"tokenCloses\":{:?},\"directoriesAcquired\":{},\"directoryCloses\":{:?}}}", failure.reason, failure.operation_reason, failure.tokens_acquired, failure.token_closes, failure.directories_acquired, failure.directory_closes)).collect::<Vec<_>>().join(",");
    let closed = closes.iter().all(|(_, closed)| *closed);
    let presence = match observe_terminal_presence(root) {
        Ok(false) => "absent",
        Ok(true) => "present",
        Err(_) => "unknown",
    };
    println!(
        "\n{{\"contract\":\"crdd-native/terminal-namespace-fixture\",\"contractRevision\":1,\"run\":\"{RUN}\",\"observed\":{},\"phase\":\"{phase}\",\"normalVerified\":{normal_verified},\"createdDirectories\":{created},\"cleanupDirectories\":{cleaned},\"checkedCloses\":{},\"checkedClosesConfirmed\":{closed},\"fixturePresence\":\"{presence}\",\"rejections\":[{rows}],\"recordSaves\":0,\"productionIntegrationVerified\":false,\"osFaultInjectionVerified\":false}}",
        outcome.is_ok(),
        closes.len()
    );
    assert!(outcome.is_ok(), "namespace fixture stopped: {phase}");
}

#[test]
fn namespace_presence_unknown_is_not_absence() {
    assert_eq!(
        terminal_presence_result(Err(std::io::ErrorKind::NotFound.into())),
        Ok(false)
    );
    for kind in [
        std::io::ErrorKind::PermissionDenied,
        std::io::ErrorKind::Other,
    ] {
        assert_eq!(
            terminal_presence_result(Err(kind.into())),
            Err("terminal_presence_unknown")
        );
    }
}

fn observe_fixture_identity(
    path: &Path,
    closes: &mut Vec<(&'static str, bool)>,
) -> DirectoryIdentity {
    let mut handle = open_terminal_handle(
        path,
        FILE_READ_ATTRIBUTES,
        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
    )
    .unwrap();
    let observed = terminal_identity(handle.0);
    let closed = close_terminal_handle(&mut handle);
    closes.push(("identity_reader", closed));
    assert!(closed);
    observed.unwrap()
}
