//! Windows上のRepository／Runtime RootをOS APIで観測する。
//!
//! @responsibility handleに固定したIdentity、Protection、PrincipalおよびMount情報を取得し、観測不能を候補へ昇格しない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use crate::filesystem::protection::{
    access_allowed, identity_matches, open_root, root_information, security_descriptor,
};
use crate::process::principal::{
    principal_observation_flags, process_tokens, runtime_principal_identity_hash,
};
use crate::protocol::access::{Reason, Request, Response};
pub const ACCESS_READ_TRAVERSE: u32 = 1 << 0;
pub const ACCESS_ADD_FILE: u32 = 1 << 1;
pub const ACCESS_ADD_SUBDIRECTORY: u32 = 1 << 2;
pub const ACCESS_WRITE_EA: u32 = 1 << 3;
pub const ACCESS_WRITE_ATTRIBUTES: u32 = 1 << 4;
pub const ACCESS_DELETE_CHILD: u32 = 1 << 5;
pub const ACCESS_DELETE_ON_ROOT_OBJECT: u32 = 1 << 6;
pub const ACCESS_WRITE_DAC: u32 = 1 << 7;
pub const ACCESS_WRITE_OWNER: u32 = 1 << 8;
use windows_sys::Win32::Storage::FileSystem::{
    DELETE, FILE_ADD_FILE, FILE_ADD_SUBDIRECTORY, FILE_ATTRIBUTE_DIRECTORY,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_DELETE_CHILD, FILE_LIST_DIRECTORY, FILE_READ_ATTRIBUTES,
    FILE_TRAVERSE, FILE_WRITE_ATTRIBUTES, FILE_WRITE_EA, WRITE_DAC, WRITE_OWNER,
};

/// Windows Root・Provider Home観測のblocked責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のblocked責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn blocked(request: &Request, reason: Reason) -> Response {
    Response {
        root_role: request.root_role,
        nonce: request.nonce,
        is_candidate: false,
        reason,
        access_mask: 0,
        runtime_principal_identity_hash: [0_u8; 32],
        principal_observation_flags: 0,
    }
}

/// Windows Root・Provider Home観測のobserve責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のobserve責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub fn observe(request: &Request) -> Response {
    let Some(root) = open_root(&request.path) else {
        return blocked(request, Reason::RootOpenFailed);
    };
    let Some(initial_information) = root_information(root.0) else {
        return blocked(request, Reason::RootOpenFailed);
    };
    if initial_information.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
        return blocked(request, Reason::RootOpenFailed);
    }
    if initial_information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return blocked(request, Reason::RootReparseRejected);
    }
    if !identity_matches(&initial_information, request.expected_identity) {
        return blocked(request, Reason::RootIdentityMismatch);
    }
    let Some(descriptor) = security_descriptor(root.0) else {
        return blocked(request, Reason::SecurityDescriptorUnavailable);
    };
    let Some((primary_token, impersonation_token)) = process_tokens() else {
        return blocked(request, Reason::ProcessTokenUnavailable);
    };
    let Some(principal_identity_hash) = runtime_principal_identity_hash(primary_token.0) else {
        return blocked(request, Reason::ProcessTokenUnavailable);
    };
    let Some(principal_flags) = principal_observation_flags(primary_token.0, impersonation_token.0)
    else {
        return blocked(request, Reason::ProcessTokenUnavailable);
    };
    let checks = [
        (
            ACCESS_READ_TRAVERSE,
            FILE_LIST_DIRECTORY | FILE_TRAVERSE | FILE_READ_ATTRIBUTES,
        ),
        (ACCESS_ADD_FILE, FILE_ADD_FILE),
        (ACCESS_ADD_SUBDIRECTORY, FILE_ADD_SUBDIRECTORY),
        (ACCESS_WRITE_EA, FILE_WRITE_EA),
        (ACCESS_WRITE_ATTRIBUTES, FILE_WRITE_ATTRIBUTES),
        (ACCESS_DELETE_CHILD, FILE_DELETE_CHILD),
        (ACCESS_DELETE_ON_ROOT_OBJECT, DELETE),
        (ACCESS_WRITE_DAC, WRITE_DAC),
        (ACCESS_WRITE_OWNER, WRITE_OWNER),
    ];
    let mut access_mask = 0_u32;
    for (flag, requested_access) in checks {
        let Some(is_allowed) =
            access_allowed(descriptor.0, impersonation_token.0, requested_access)
        else {
            return blocked(request, Reason::AccessCheckFailed);
        };
        if is_allowed {
            access_mask |= flag;
        }
    }
    let Some(final_information) = root_information(root.0) else {
        return blocked(request, Reason::RootOpenFailed);
    };
    if !identity_matches(&final_information, request.expected_identity)
        || final_information.dwFileAttributes != initial_information.dwFileAttributes
    {
        return blocked(request, Reason::RootIdentityMismatch);
    }
    Response {
        root_role: request.root_role,
        nonce: request.nonce,
        is_candidate: true,
        reason: Reason::ObservationCandidate,
        access_mask,
        runtime_principal_identity_hash: principal_identity_hash,
        principal_observation_flags: principal_flags,
    }
}

#[cfg(test)]
mod tests {
    use crate::filesystem::protected_root::{
        provider_home_identity_hash, provider_home_mount_source_hash,
    };
    use crate::filesystem::protection::{DirectoryIdentity, bounded_ace_sid};
    use crate::process::principal::REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS;
    use crate::process::principal::{TokenBindingObservation, local_user_binding_hash};
    use crate::protocol::access::{FileIdentity, ProviderHomeRequest};
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::*;
    use crate::protocol::access::RootRole;

    /// observes_current_process_access_without_mutating_rootを検証する。
    ///
    /// @responsibility observes_current_process_access_without_mutating_rootの合否判定を所有する。
    /// @trace RDL-UT-005
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus observes_current_process_access_without_mutating_rootの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
    #[test]
    fn observes_current_process_access_without_mutating_root() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root_path = std::env::temp_dir().join(format!(
            "crdd-platform-access-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&root_path).unwrap();
        let identity = {
            let root = open_root(root_path.to_str().unwrap()).unwrap();
            let information = root_information(root.0).unwrap();
            FileIdentity {
                volume_serial_number: information.dwVolumeSerialNumber,
                file_index_high: information.nFileIndexHigh,
                file_index_low: information.nFileIndexLow,
            }
        };
        let request = Request {
            root_role: RootRole::Authority,
            nonce: [9_u8; 32],
            expected_identity: identity,
            path: root_path.to_str().unwrap().to_owned(),
        };
        let response = observe(&request);
        assert!(response.is_candidate, "{response:?}");
        assert_eq!(response.reason, Reason::ObservationCandidate);
        assert_eq!(response.nonce, request.nonce);
        assert!(root_path.is_dir());
        fs::remove_dir(root_path).unwrap();
    }

    /// blocks_missing_non_directory_and_identity_mismatchを検証する。
    ///
    /// @responsibility blocks_missing_non_directory_and_identity_mismatchの合否判定を所有する。
    /// @trace RDL-UT-005
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus blocks_missing_non_directory_and_identity_mismatchの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
    #[test]
    fn blocks_missing_non_directory_and_identity_mismatch() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let temporary_root = std::env::temp_dir().join(format!(
            "crdd-platform-access-negative-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&temporary_root).unwrap();
        let file_path = temporary_root.join("regular-file");
        fs::write(&file_path, b"not a directory").unwrap();
        let missing_path = temporary_root.join("missing");
        let expected_identity = FileIdentity {
            volume_serial_number: 0,
            file_index_high: 0,
            file_index_low: 0,
        };
        for path in [&missing_path, &file_path] {
            let request = Request {
                root_role: RootRole::Runtime,
                nonce: [4_u8; 32],
                expected_identity,
                path: path.to_str().unwrap().to_owned(),
            };
            let response = observe(&request);
            assert!(!response.is_candidate);
            assert_eq!(response.reason, Reason::RootOpenFailed);
            assert_eq!(response.access_mask, 0);
        }
        let mismatch_request = Request {
            root_role: RootRole::Runtime,
            nonce: [5_u8; 32],
            expected_identity,
            path: temporary_root.to_str().unwrap().to_owned(),
        };
        let mismatch_response = observe(&mismatch_request);
        assert!(!mismatch_response.is_candidate);
        assert_eq!(mismatch_response.reason, Reason::RootIdentityMismatch);
        assert_eq!(mismatch_response.access_mask, 0);
        fs::remove_file(file_path).unwrap();
        fs::remove_dir(temporary_root).unwrap();
    }

    /// provider_home_hash_domains_bind_provider_identity_and_login_sessionを検証する。
    ///
    /// @responsibility provider_home_hash_domains_bind_provider_identity_and_login_sessionの合否判定を所有する。
    /// @trace RDL-UT-005
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus provider_home_hash_domains_bind_provider_identity_and_login_sessionの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
    #[test]
    fn provider_home_hash_domains_bind_provider_identity_and_login_session() {
        let codex = ProviderHomeRequest {
            provider: crate::protocol::access::Provider::Codex,
            initialize_if_missing: false,
            nonce: [1_u8; 32],
            mount_source_hash: [2_u8; 32],
        };
        let claude = ProviderHomeRequest {
            provider: crate::protocol::access::Provider::Claude,
            initialize_if_missing: false,
            nonce: [1_u8; 32],
            mount_source_hash: [2_u8; 32],
        };
        let identity = DirectoryIdentity {
            volume_serial_number: 1,
            file_index_high: 2,
            file_index_low: 3,
            creation_time_low: 4,
            creation_time_high: 5,
            attributes: FILE_ATTRIBUTE_DIRECTORY,
        };
        assert_ne!(
            provider_home_identity_hash(&codex, identity),
            provider_home_identity_hash(&claude, identity)
        );
        assert_ne!(
            provider_home_mount_source_hash(&codex, Path::new(r"C:\ProviderHomes\codex")),
            provider_home_mount_source_hash(&claude, Path::new(r"C:\ProviderHomes\claude"))
        );

        let binding = TokenBindingObservation {
            principal_identity_hash: [7_u8; 32],
            principal_flags: REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS,
            authentication_id: [8_u8; 8],
        };
        let mut next_login = binding;
        next_login.authentication_id[0] ^= 1;
        assert_ne!(
            local_user_binding_hash(binding),
            local_user_binding_hash(next_login)
        );
    }

    /// bounded_ace_sid_rejects_truncated_or_noncanonical_sidを検証する。
    ///
    /// @responsibility bounded_ace_sid_rejects_truncated_or_noncanonical_sidの合否判定を所有する。
    /// @trace RDL-UT-005
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus bounded_ace_sid_rejects_truncated_or_noncanonical_sidの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Path分類、保持、清掃、回復判定規則は外部実行境界を持たない。
    #[test]
    fn bounded_ace_sid_rejects_truncated_or_noncanonical_sid() {
        let valid = [1_u8, 1, 0, 0, 0, 0, 0, 5, 18, 0, 0, 0];
        assert_eq!(
            bounded_ace_sid(valid.as_ptr(), valid.len(), 0),
            Some(valid.to_vec())
        );
        assert_eq!(bounded_ace_sid(valid.as_ptr(), valid.len() - 1, 0), None);
        let mut wrong_revision = valid;
        wrong_revision[0] = 2;
        assert_eq!(
            bounded_ace_sid(wrong_revision.as_ptr(), wrong_revision.len(), 0),
            None
        );
        let mut too_many_subauthorities = valid;
        too_many_subauthorities[1] = 16;
        assert_eq!(
            bounded_ace_sid(
                too_many_subauthorities.as_ptr(),
                too_many_subauthorities.len(),
                0
            ),
            None
        );
    }
}
