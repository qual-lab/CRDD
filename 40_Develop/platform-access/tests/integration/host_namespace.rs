//! Namespaceの値契約と明示Owner限定の実境界を確認する。
//! @packageDocumentation
//! @responsibility 記録退役後のNamespace反証を維持する。
//! @trace ERB-IT-001
//! @trace ERB-IT-002
//! @trace ERB-IT-003
//! @level IT
//! @scope 純粋契約と既存ignored自己生成fixture。
//! @boundary 過去保持物と実共有領域は操作しない。
use crate::filesystem::protection::DirectoryIdentity;
use crate::host_record::host_namespace::{
    TerminalNamespaceIdentity, decode_terminal_temporary_parent, validate_terminal_namespace,
};
use crate::host_record::protected_file::terminal_presence_result;
use std::path::Path;
use windows_sys::Win32::Storage::FileSystem::{
    FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT,
};

/// 固定保存境界の期待値とOS返却値の純境界を確認する。
///
/// @responsibility 純値の反例を実Directory/ACL故障の観測にしない。
/// @trace ERB-IT-002
/// @precondition OS handle・file・Processを取得しない。
/// @stimulus 二実体の重複・属性不正とUTF-16/length/Pathの不正。
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
        selected_user: [7; 32],
    };
    assert_eq!(validate_terminal_namespace(expected), Ok(()));
    for position in 0..2 {
        for attributes in [0, FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT] {
            let mut changed = expected;
            match position {
                0 => changed.parent.attributes = attributes,
                _ => changed.recovery.attributes = attributes,
            }
            assert_eq!(
                validate_terminal_namespace(changed),
                Err("terminal_namespace_expected_invalid")
            );
        }
    }
    for (left, right) in [(0, 1)] {
        let mut ids = [expected.parent, expected.recovery];
        ids[right] = DirectoryIdentity {
            creation_time_low: 999,
            ..ids[left]
        };
        let changed = TerminalNamespaceIdentity {
            parent: ids[0],
            recovery: ids[1],
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
