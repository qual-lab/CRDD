//! 共有管理フォルダの保護付き作成を自己生成fixtureだけで確認する。
//!
//! @packageDocumentation
//! @responsibility 作成時保護・無変更再利用・既存不適合停止を実Windowsで反証する。
//! @trace ERB-IT-003
//! @level IT
//! @scope 固定Repository内の自己生成対象で、新規作成・無変更再利用・既存不適合の拒否を確認するignored局所試験。
//! @boundary cfg(test)の私有作成部品→Windows File API。実共有保存領域、旧三件、署名Runtimeと公開Recoveryは対象外。

use super::*;
use std::fs;

/// 自作fixtureの同handle実体と明示終了を観測する。
///
/// @responsibility Path metadataだけから実体一致やcloseを推定しない。
/// @trace ERB-IT-003
/// @precondition 呼出し元が固定Repository内の自己生成Pathだけを指定する。
/// @stimulus 非reparse読取りhandleを取得しIdentityを読む。
/// @observation 五識別値・属性とCloseHandleの実結果。
/// @oracle Identity取得と明示closeの両方が成功する。
/// @cleanup 自己所有の読取りhandleを明示終了する。
/// @boundary cfg(test)→Windows File API。実OS保存境界は対象外。
fn fixture_identity(path: &Path) -> DirectoryIdentity {
    let mut handle =
        open_terminal_handle(path, FILE_READ_ATTRIBUTES | READ_CONTROL, FILE_SHARE_READ).unwrap();
    let identity = terminal_identity(handle.0);
    let closed = close_terminal_handle(&mut handle);
    assert!(closed);
    identity.unwrap()
}

/// 正常作成、無変更再利用と既存不適合の拒否を確認する。
///
/// @responsibility 私有作成部品の成立を署名済みproducer・ACL移行・公開Recoveryへ昇格しない。
/// @trace ERB-IT-003
/// @precondition 固定cwd・run、自己生成Rootの明示不存在、先行静的検査をOwnerが確認する。
/// @stimulus 固定二childの新規作成と再利用、継承ACLの既存Directory、同名fileを与える。
/// @observation 作成発行、API結果、fresh Identity・ACL、個別close、拒否前後の実体・bytes。
/// @oracle 作成はprotected二ACE、再利用は作成Effect 0、不適合はACL変更0で元理由を保持する。
/// @cleanup 正常oracle完了後、自作物をfresh Identity確認して非再帰清掃する。不明・失敗時は保持する。
/// @boundary unsigned Native私有部品→実Windows。実共有Directory、旧三件、署名配布物は触らない。
#[test]
#[ignore = "repository-local self-generated namespace fixture; explicit owner required"]
fn host_namespace_creation_fixture() {
    assert_eq!(
        std::env::var("CRDD_HOST_NAMESPACE_FIXTURE").as_deref(),
        Ok("host-namespace.261004.r3")
    );
    assert_eq!(
        std::env::current_dir().unwrap(),
        Path::new("C:/project/CRDD")
    );
    // Resolve and close the selected-user observation before the first fixture creation.
    let (mut primary, mut impersonation) = process_tokens().unwrap();
    let selected = selected_user_token_binding(primary.0, impersonation.0);
    let token_closes = [
        close_terminal_handle(&mut impersonation),
        close_terminal_handle(&mut primary),
    ];
    assert_eq!(token_closes, [true, true]);
    assert!(selected.is_some(), "fixture_selected_user_unavailable");
    let root = Path::new("C:/project/CRDD/.crdd/tests/host-namespace-protected-261004-r3");
    assert_eq!(observe_terminal_presence(root), Ok(false));
    assert!(root.parent().unwrap().is_dir());
    fs::create_dir(root).unwrap();
    let root_identity = fixture_identity(root);
    let mut cleanup = vec![(root.to_path_buf(), root_identity)];

    let normal = root.join("normal");
    fs::create_dir(&normal).unwrap();
    let normal_identity = fixture_identity(&normal);
    cleanup.push((normal.clone(), normal_identity));
    let mut guard = TerminalDirectory::open_bootstrap_parent(&normal, normal_identity).unwrap();
    assert!(guard.selected_user.is_some());
    assert_eq!(guard.token_closes, [true, true]);
    let recovery = create_host_namespace_child(&mut guard, HostNamespaceChild::Recovery).unwrap();
    assert!(recovery.create_issued);
    assert_eq!(recovery.created, Some(true));
    assert!(recovery.child_handle_acquired);
    assert_eq!(recovery.child_close_confirmed, None);
    guard.verify().unwrap();
    cleanup.push((guard.path.clone(), recovery.identity.unwrap()));
    let terminal = create_host_namespace_child(&mut guard, HostNamespaceChild::Terminal).unwrap();
    assert!(terminal.create_issued);
    assert_eq!(terminal.created, Some(true));
    guard.verify().unwrap();
    let terminal_path = guard.path.clone();
    cleanup.push((terminal_path.clone(), terminal.identity.unwrap()));
    assert!(guard.close());
    assert!(guard.directory_closes.iter().all(|closed| *closed));
    assert_eq!(guard.directory_closes.len(), guard.handles.len());

    // Existing observation retains its original mandatory recovery and terminal protection checks.
    let mut observed = TerminalDirectory::open_observed(&terminal_path, None, None).unwrap();
    observed.verify().unwrap();
    assert!(observed.close());
    let mut reused = TerminalDirectory::open_bootstrap_parent(&normal, normal_identity).unwrap();
    let existing = create_host_namespace_child(&mut reused, HostNamespaceChild::Recovery).unwrap();
    assert!(!existing.create_issued);
    assert_eq!(existing.created, Some(false));
    assert_eq!(existing.identity, recovery.identity);
    let existing_terminal =
        create_host_namespace_child(&mut reused, HostNamespaceChild::Terminal).unwrap();
    assert!(!existing_terminal.create_issued);
    assert_eq!(existing_terminal.identity, terminal.identity);
    assert!(reused.close());

    // Run the same connected Owner with a self-generated parent, not the real OS namespace.
    let connected_parent = root.join("connected");
    fs::create_dir(&connected_parent).unwrap();
    let connected_identity = fixture_identity(&connected_parent);
    cleanup.push((connected_parent.clone(), connected_identity));
    let capture_request = crate::protocol::host_namespace::NamespaceRequest {
        nonce: [7; 32],
        expected: None,
    };
    let captured = host_namespace_at_parent(&capture_request, &connected_parent);
    assert_eq!(captured.status, 1);
    assert_eq!(
        captured.identities[0],
        Some(terminal_identity_fields(connected_identity))
    );
    assert!(crate::protocol::host_namespace::encode_response(&captured).is_some());
    let initialize_request = crate::protocol::host_namespace::NamespaceRequest {
        nonce: [8; 32],
        expected: Some((
            captured.identities[0].unwrap(),
            captured.selected_user.unwrap(),
        )),
    };
    let initialized = host_namespace_at_parent(&initialize_request, &connected_parent);
    assert_eq!(initialized.status, 2);
    assert!(
        initialized.children.iter().all(|receipt| receipt
            .as_ref()
            .is_some_and(|receipt| receipt.create_issued
                && receipt.created == Some(true)
                && receipt.close == Some(true)))
    );
    assert!(crate::protocol::host_namespace::encode_response(&initialized).is_some());
    let connected_recovery = connected_parent.join("crdd-coordinator-recovery-v1");
    let connected_terminal = connected_recovery.join("terminal-v1");
    for (index, target) in [connected_recovery, connected_terminal]
        .into_iter()
        .enumerate()
    {
        let identity = fixture_identity(&target);
        assert_eq!(
            Some(terminal_identity_fields(identity)),
            initialized.identities[index + 1]
        );
        cleanup.push((target, identity));
    }
    let reused = host_namespace_at_parent(&initialize_request, &connected_parent);
    assert_eq!(reused.status, 2);
    assert!(
        reused.children.iter().all(|receipt| receipt
            .as_ref()
            .is_some_and(|receipt| !receipt.create_issued
                && receipt.created == Some(false)
                && receipt.close == Some(true)))
    );
    assert!(crate::protocol::host_namespace::encode_response(&reused).is_some());
    for changed in [true, false] {
        let mut bad_request = crate::protocol::host_namespace::NamespaceRequest {
            nonce: [9; 32],
            expected: initialize_request.expected,
        };
        let expected = bad_request.expected.as_mut().unwrap();
        if changed {
            expected.0[2] ^= 1;
        } else {
            expected.1[0] ^= 1;
        }
        let rejected = host_namespace_at_parent(&bad_request, &connected_parent);
        assert_eq!(rejected.status, 0);
        assert_eq!(
            rejected.reason,
            if changed {
                "terminal_directory_identity_mismatch"
            } else {
                "terminal_selected_user_mismatch"
            }
        );
        assert!(rejected.children.iter().all(Option::is_none));
        assert!(crate::protocol::host_namespace::encode_response(&rejected).is_some());
    }

    for (case, is_file) in [("incompatible", false), ("file", true)] {
        let parent = root.join(case);
        fs::create_dir(&parent).unwrap();
        let parent_identity = fixture_identity(&parent);
        cleanup.push((parent.clone(), parent_identity));
        let target = parent.join("crdd-coordinator-recovery-v1");
        if is_file {
            fs::write(&target, b"BEFORE\n").unwrap();
        } else {
            fs::create_dir(&target).unwrap();
        }
        let before = fixture_identity(&target);
        let mut rejected =
            TerminalDirectory::open_bootstrap_parent(&parent, parent_identity).unwrap();
        let failure =
            create_host_namespace_child(&mut rejected, HostNamespaceChild::Recovery).unwrap_err();
        assert_eq!(
            failure.reason,
            if is_file {
                "terminal_not_directory"
            } else {
                "terminal_descriptor_mismatch"
            }
        );
        assert_eq!(failure.reason, failure.operation_reason);
        assert!(!failure.receipt.create_issued);
        assert_eq!(failure.receipt.created, Some(false));
        assert_eq!(failure.receipt.identity, Some(before));
        assert_eq!(failure.receipt.child_close_confirmed, Some(true));
        assert!(rejected.close());
        assert_eq!(fixture_identity(&target), before);
        let request = crate::protocol::host_namespace::NamespaceRequest {
            nonce: [10; 32],
            expected: None,
        };
        let captured = host_namespace_at_parent(&request, &parent);
        assert_eq!(captured.status, 1);
        let request = crate::protocol::host_namespace::NamespaceRequest {
            nonce: [11; 32],
            expected: Some((
                captured.identities[0].unwrap(),
                captured.selected_user.unwrap(),
            )),
        };
        let rejected = host_namespace_at_parent(&request, &parent);
        assert_eq!(rejected.status, 0);
        assert_eq!(rejected.reason, failure.reason);
        assert!(
            rejected.children[0]
                .as_ref()
                .is_some_and(|receipt| !receipt.create_issued && receipt.close == Some(true))
        );
        assert!(crate::protocol::host_namespace::encode_response(&rejected).is_some());
        assert_eq!(fixture_identity(&target), before);
        if is_file {
            assert_eq!(fs::read(&target).unwrap(), b"BEFORE\n");
            fs::remove_file(&target).unwrap();
            assert_eq!(observe_terminal_presence(&target), Ok(false));
        } else {
            cleanup.push((target, before));
        }
    }
    for (path, expected) in cleanup.into_iter().rev() {
        assert!(path.starts_with(root));
        assert_eq!(fixture_identity(&path), expected);
        assert_eq!(fs::read_dir(&path).unwrap().count(), 0);
        fs::remove_dir(&path).unwrap();
        assert_eq!(observe_terminal_presence(&path), Ok(false));
    }
    println!(
        "HOST_NAMESPACE_FIXTURE=protected_create_connected_owner_reuse_and_rejection_verified"
    );
}
