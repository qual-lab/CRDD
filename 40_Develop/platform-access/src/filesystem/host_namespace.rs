//! 固定Host保存境界の期待実体・所在候補と保持Directory chainを検査する。
//!
//! @responsibility Namespaceの相異・非Reparse条件、対象名・所在候補、親chainの取得・照合・明示終了と期待値付き固定child初期化を所有し、値の一致をAuthorityへ昇格しない。
//! @trace ARCH-000011

use crate::filesystem::protected_file::{
    MAX_HOST_MARKER_OBSERVATION_BYTES, close_terminal_handle, observe_terminal_presence,
    open_terminal_handle, read_terminal_bounded_bytes, terminal_identity,
    verify_terminal_protection, with_terminal_descriptor,
};
use crate::filesystem::protection::{
    DirectoryIdentity, OwnedHandle, directory_identity, root_information, sha256,
};
use crate::filesystem::protected_root::DRIVE_FIXED;
use crate::process::principal::{
    local_system_sid_bytes, selected_user_token_binding, token_user_sid_bytes,
};
use crate::protocol::host_record::KNOWN_FIXTURE_SHA256;
use std::ffi::OsString;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::ffi::OsStringExt;
use std::path::Path;
use std::path::{Component, PathBuf};
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::{ERROR_ALREADY_EXISTS, GetLastError};
use windows_sys::Win32::Security::{
    DuplicateToken, SecurityImpersonation, TOKEN_DUPLICATE, TOKEN_QUERY,
};
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, CreateDirectoryW, FILE_ATTRIBUTE_DIRECTORY,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_GENERIC_READ, FILE_TYPE_DISK, GetFileSizeEx, GetFileType,
};
use windows_sys::Win32::Storage::FileSystem::{
    FILE_READ_ATTRIBUTES, FILE_SHARE_READ, GetDriveTypeW, GetTempPathW, READ_CONTROL,
};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

pub(super) static CAPACITY_SETTLEMENT_UNKNOWN: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// 記録Directoryとその全祖先を保持する。
///
/// @responsibility Pathの祖先差替えを防ぎ、最後のDirectoryの保護と実体を固定する。
/// @trace ARCH-000011
/// @shape 一意所有handle集合、最終Directory Identity、選択利用者とSYSTEM SID。
/// @invariant Directory保持だけをchildの書込み防止または非使用証明にしない。
/// @boundary Windows local diskの内部部品。任意Pathの公開入口ではない。
/// @security 最終Directoryのownerとprotected二ACEを確認する。固定OS namespaceとAuthorityは上位Ownerの責務。
/// @compatibility 五fieldと属性の内部Identityを使用し、Node metadataと同一視しない。
pub(super) struct TerminalDirectory {
    pub(super) path: PathBuf,
    pub(super) handles: Vec<OwnedHandle>,
    pub(super) identity: DirectoryIdentity,
    pub(super) user: Vec<u8>,
    pub(super) system: Vec<u8>,
    pub(super) selected_user: Option<[u8; 32]>,
    pub(super) close_confirmed: Option<bool>,
    pub(super) token_closes: Vec<bool>,
    pub(super) directory_closes: Vec<bool>,
    pub(super) namespace: Option<TerminalNamespaceIdentity>,
}

/// 部分openの元理由と取得済み資源の初回終了を保持する。
///
/// @responsibility close不明で観測失敗の原因を消さない。
/// @trace ARCH-000011
/// @shape 支配理由、元理由、取得Token数と個別close、Directory数と個別close。
/// @invariant close結果の長さだけから未取得資源や全Process不存在を推定しない。
/// @boundary 内部chain取得→私有呼出し元。
/// @security 生Path、SID、削除Authorityを返さない。
/// @compatibility 既存string wrapperは支配理由だけを維持する。
#[derive(Debug)]
pub(super) struct TerminalDirectoryOpenFailure {
    pub(super) reason: &'static str,
    pub(super) operation_reason: &'static str,
    pub(super) tokens_acquired: usize,
    pub(super) token_closes: Vec<bool>,
    pub(super) directories_acquired: usize,
    pub(super) directory_closes: Vec<bool>,
}

impl TerminalDirectory {
    /// OS一時所在候補の固定二childだけを開く。
    ///
    /// @responsibility 任意保存Pathを受け付けず、独立期待実体へ結ぶ。
    /// @trace ARCH-000011
    /// @input 三Directoryの独立五field・属性と現在選択利用者Hash。
    /// @returns 全chain保持guard、または取得・個別closeを含む失敗。
    /// @precondition 上位が期待値の由来・許可境界を確認する。専用観測Protocolとfixtureが利用する。
    /// @postcondition parent/recovery/terminalと二protected ACLを保持handleで照合する。
    /// @effect GetTempPathWとread-only handle取得。mkdir・保存・削除0。
    /// @failure 不正期待値、所在候補不明、namespace欠落・差替え・保護不一致は停止。
    /// @invariant TEMP/TMP値や同じ実体の観測からAuthorityを作らない。
    /// @boundary 固定私有namespace→Windows temporary pathとFile API。
    /// @security fallback、自由suffix、SID出力、旧Task再開を行わない。
    /// @concurrency 全祖先保持後、後続verifyも同じ三実体・二ACLを再確認する。
    pub(super) fn open_fixed_namespace(
        expected: TerminalNamespaceIdentity,
    ) -> Result<Self, TerminalDirectoryOpenFailure> {
        let prepared = (|| {
            validate_terminal_namespace(expected)?;
            let mut buffer = [0_u16; 4097];
            // SAFETY: bounded writable buffer; no pointer escapes the synchronous call.
            let length = unsafe { GetTempPathW(buffer.len() as u32, buffer.as_mut_ptr()) };
            let parent = decode_terminal_temporary_parent(&buffer, length)?;
            Ok(parent
                .join("crdd-coordinator-recovery-v1")
                .join("terminal-v1"))
        })();
        match prepared {
            Ok(path) => Self::open_observed(&path, Some(expected.terminal), Some(expected)),
            Err(reason) => Err(TerminalDirectoryOpenFailure {
                reason,
                operation_reason: reason,
                tokens_acquired: 0,
                token_closes: Vec::new(),
                directories_acquired: 0,
                directory_closes: Vec::new(),
            }),
        }
    }

    /// 固定保存場所の実体と保護を初回観測する。
    ///
    /// @responsibility 未取得の期待値を捏造せず、CurrentからKnownへの入力を取得する。
    /// @trace ARCH-000011
    /// @input N/A: 固定OS所在と固定二childだけを使用する。
    /// @returns 全chain・二保護・選択利用者を確認したguard、または取得と終了を持つ失敗。
    /// @precondition 上位はCurrentを過去の連続性や非使用へ昇格しない。
    /// @postcondition 三実体を保持handleから取得し、型・相異・二ACLを確認する。
    /// @effect 読取りhandleとTokenの取得・終了だけ。作成・修復・削除0。
    /// @failure 所在・欠落・保護・利用者・close不明は停止する。
    /// @invariant 旧namespace未指定primitiveとは異なり、両Directoryの保護を必須とする。
    /// @boundary 固定OS所在→Native初回保存境界。
    /// @security 自由Path、SID出力、削除Authorityを追加しない。
    /// @concurrency 全chain保持中に現在値を採取し、取得後も同じ実体で再照合する。
    pub(super) fn capture_fixed_namespace() -> Result<Self, TerminalDirectoryOpenFailure> {
        let mut buffer = [0_u16; 4097];
        // SAFETY: bounded writable buffer and synchronous observation only.
        let length = unsafe { GetTempPathW(buffer.len() as u32, buffer.as_mut_ptr()) };
        match decode_terminal_temporary_parent(&buffer, length) {
            Ok(parent) => Self::open_observed(
                &parent
                    .join("crdd-coordinator-recovery-v1")
                    .join("terminal-v1"),
                None,
                None,
            ),
            Err(reason) => Err(TerminalDirectoryOpenFailure {
                reason,
                operation_reason: reason,
                tokens_acquired: 0,
                token_closes: Vec::new(),
                directories_acquired: 0,
                directory_closes: Vec::new(),
            }),
        }
    }

    /// 保持済みの固定三実体と二Directory保護を再確認する。
    ///
    /// @responsibility 最終Directoryだけの照合をnamespace全体の成立にしない。
    /// @trace ARCH-000011
    /// @input guard内の独立期待値と保持handle。
    /// @returns 三実体・二ACL一致、または閉じた失敗。
    /// @precondition 全chainを取得済み。旧primitiveはnamespaceを宣言しない。
    /// @postcondition 属性・日時の差から重複実体を相異と扱わない。
    /// @effect 同じ保持handleのmetadata・ACL読取りだけ。
    /// @failure 欠落、Identity不一致または保護不明で停止。
    /// @invariant 現在値を期待値へ書き戻さない。
    /// @boundary Native chain guard→Windows metadata/ACL。
    /// @security 非使用、削除許可、Root/marker成立を主張しない。
    /// @concurrency 一意guardの同期借用だけ。
    pub(super) fn verify_namespace(&self) -> Result<(), &'static str> {
        let Some(expected) = self.namespace else {
            return Ok(());
        };
        validate_terminal_namespace(expected)?;
        let length = self.handles.len();
        if length < 4 {
            return Err("terminal_namespace_chain_missing");
        }
        for (offset, identity) in [
            (3, expected.parent),
            (2, expected.recovery),
            (1, expected.terminal),
        ] {
            let handle = self.handles[length - offset].0;
            if terminal_identity(handle)? != identity {
                return Err("terminal_namespace_identity_mismatch");
            }
            if offset != 3 {
                verify_terminal_protection(handle, &self.user, &self.system)?;
            }
        }
        Ok(())
    }

    /// local diskの全祖先を保持し、最後のDirectoryを照合する。
    ///
    /// @responsibility 相関済みDirectoryだけをstage作成へ渡す。
    /// @trace ARCH-000011
    /// @input 内部Path、期待する五field/属性Identity。
    /// @returns 私有guard、または全close確認を含む失敗。
    /// @precondition 上位が固定保存境界と許可範囲を確認する。現consumerは自己生成fixtureだけ。
    /// @postcondition 全祖先非reparseと最後の保護を確認して保持する。
    /// @effect 読取り/保持handleとTokenを取得する。Filesystem変更0。
    /// @failure 不正/UNC/相対Path、open、Identity、保護、close不明で停止。
    /// @invariant Directory保持をchild file保護へ昇格しない。
    /// @boundary Native→Windows local directory chain。
    /// @security ownerは現在Tokenの利用者。公開Path受付ではない。
    /// @concurrency 全chainのshareREADをguard生存中保持する。
    #[cfg(test)]
    pub(super) fn open(path: &Path, expected: DirectoryIdentity) -> Result<Self, &'static str> {
        Self::open_observed(path, Some(expected), None).map_err(|failure| failure.reason)
    }

    /// 全chainの取得と失敗時の個別終了を共同保持する。
    ///
    /// @responsibility 旧私有入口と固定namespace入口で取得・終了の意味を揃える。
    /// @trace ARCH-000011
    /// @input 内部Path、Known時だけ独立した最終実体とnamespace。Current時は両方None。
    /// @returns 保持guard、または元理由と全取得済み資源の初回close結果。
    /// @precondition Pathは公開入力ではなく内部Ownerが決定している。
    /// @postcondition 受理時は全chain非reparse・最終保護・適用するnamespaceを確認する。
    /// @effect TokenとDirectoryの読取りhandle取得。Filesystem変更0。
    /// @failure 部分取得、利用者・実体・ACL不一致とclose不明を共同保持する。
    /// @invariant Dropを明示closeの代替にせず、Currentの取得値を過去の期待値にしない。
    /// @boundary 私有Native→Windows Token/File API。
    /// @security 元Task TokenやAuthorityを発行しない。
    /// @concurrency 同threadの全chain保持と同期取得だけ。
    pub(super) fn open_observed(
        path: &Path,
        expected: Option<DirectoryIdentity>,
        namespace: Option<TerminalNamespaceIdentity>,
    ) -> Result<Self, TerminalDirectoryOpenFailure> {
        Self::open_guard(path, expected, namespace, false)
    }

    /// 保護付き作成前の一時親だけを全祖先とともに保持する。
    ///
    /// @responsibility 未作成childの保護を親の保護から推定しない。
    /// @trace ARCH-000011
    /// @input 内部Ownerが固定した一時親と独立した実体期待値。
    /// @returns 作成前の親guardまたは個別終了を持つ失敗。
    /// @precondition 公開Path受付ではなく、固定OS親または自己生成fixtureのOwnerが呼ぶ。
    /// @postcondition 全chainは非reparse、通常Directory、同じ期待実体である。
    /// @effect Tokenと読取りDirectory handle取得のみ。
    /// @failure 期待差、型・chain・取得またはclose不明で停止。
    /// @invariant 一時親へDACLを要求・変更せず、保存用guardへ昇格しない。
    /// @boundary 私有初期化→Windows親chain。
    /// @security 同じ現在TokenからuserとSYSTEMを取得する。
    /// @concurrency shareREADを保ち、child作成競合を別にfresh検証する。
    #[cfg(test)]
    pub(super) fn open_bootstrap_parent(
        path: &Path,
        expected: DirectoryIdentity,
    ) -> Result<Self, TerminalDirectoryOpenFailure> {
        Self::open_guard(path, Some(expected), None, true)
    }

    /// 通常保存と作成前の親取得で同じchain取得・終了を使用する。
    ///
    /// @responsibility 作成前の親だけに最終ACL検査の非適用を限定する。
    /// @trace ARCH-000011
    /// @input 内部Path、独立期待値、保存時namespace、私有bootstrap指定。
    /// @returns 全取得guardまたは元理由と個別close。
    /// @precondition bootstrapはnamespaceなしの固定一時親。期待値なしは読取り専用の現在値採取だけ。
    /// @postcondition 既存保存入口の最終ACL・namespace検査は省略しない。
    /// @effect 読取りToken・Directory取得だけ。
    /// @failure 不正組合せ、chain・実体・保護または終了不明を停止。
    /// @invariant bootstrap guardは終端記録の保存Authorityではない。
    /// @boundary 私有Native chain取得。
    /// @security 元Token、ACL修復、作成または清掃許可を返さない。
    /// @concurrency 同期Ownerのchain取得と逆順解放。
    pub(super) fn open_guard(
        path: &Path,
        expected: Option<DirectoryIdentity>,
        namespace: Option<TerminalNamespaceIdentity>,
        bootstrap: bool,
    ) -> Result<Self, TerminalDirectoryOpenFailure> {
        let mut guard = Self {
            path: path.to_path_buf(),
            handles: Vec::new(),
            identity: expected.unwrap_or(DirectoryIdentity {
                volume_serial_number: 0,
                file_index_high: 0,
                file_index_low: 0,
                creation_time_low: 0,
                creation_time_high: 0,
                attributes: 0,
            }),
            user: Vec::new(),
            system: Vec::new(),
            selected_user: None,
            close_confirmed: None,
            token_closes: Vec::new(),
            directory_closes: Vec::new(),
            namespace,
        };
        let mut acquisition_reason = None;
        let observed = (|| {
            if bootstrap && namespace.is_some() {
                return Err("terminal_bootstrap_context_invalid");
            }
            let components: Vec<_> = path.components().collect();
            if !matches!(components.first(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), std::path::Prefix::Disk(_)))
                || components.get(1) != Some(&Component::RootDir)
                || components.len() < 3
                || components[2..]
                    .iter()
                    .any(|c| !matches!(c, Component::Normal(_)))
            {
                return Err("terminal_directory_path_invalid");
            }
            if components.len() - 1 > crate::protocol::host_record::MAX_CHAIN_HANDLES {
                return Err("terminal_directory_chain_too_large");
            }
            let mut primary = null_mut();
            // SAFETY: current process pseudo-handle and writable private output.
            if unsafe {
                OpenProcessToken(
                    GetCurrentProcess(),
                    TOKEN_QUERY | TOKEN_DUPLICATE,
                    &mut primary,
                )
            } == 0
            {
                return Err("terminal_token_unknown");
            }
            let mut primary = OwnedHandle(primary);
            let mut impersonation = null_mut();
            // SAFETY: primary has duplication access; output is private.
            if unsafe { DuplicateToken(primary.0, SecurityImpersonation, &mut impersonation) } == 0
            {
                let closed = close_terminal_handle(&mut primary);
                guard.token_closes.push(closed);
                acquisition_reason = Some("terminal_token_duplicate_unknown");
                return Err(if closed {
                    "terminal_token_duplicate_unknown"
                } else {
                    "terminal_token_close_unknown"
                });
            }
            let mut impersonation = OwnedHandle(impersonation);
            let token_observed = (|| {
                let user = token_user_sid_bytes(primary.0).ok_or("terminal_user_unknown")?;
                let system = local_system_sid_bytes().ok_or("terminal_system_unknown")?;
                let selected = if guard.namespace.is_some() || expected.is_none() || bootstrap {
                    let binding = selected_user_token_binding(primary.0, impersonation.0)
                        .ok_or("terminal_selected_user_unknown")?;
                    if guard.namespace.is_some_and(|namespace| {
                        binding.principal_identity_hash != namespace.selected_user
                    }) {
                        return Err("terminal_selected_user_mismatch");
                    }
                    Some(binding.principal_identity_hash)
                } else {
                    None
                };
                Ok((user, system, selected))
            })();
            guard
                .token_closes
                .push(close_terminal_handle(&mut impersonation));
            guard.token_closes.push(close_terminal_handle(&mut primary));
            if guard.token_closes.contains(&false) {
                acquisition_reason = token_observed.as_ref().err().copied();
                return Err("terminal_token_close_unknown");
            }
            let (user, system, selected) = token_observed?;
            guard.user = user;
            guard.system = system;
            guard.selected_user = selected;
            let mut current = PathBuf::new();
            for (index, component) in components.iter().enumerate() {
                current.push(component.as_os_str());
                if index == 0 {
                    continue;
                }
                if index == 1 {
                    let mut drive: Vec<u16> = current.as_os_str().encode_wide().collect();
                    drive.push(0);
                    // SAFETY: NUL-terminated local drive root; observation only.
                    if unsafe { GetDriveTypeW(drive.as_ptr()) } != DRIVE_FIXED {
                        return Err("terminal_volume_not_fixed");
                    }
                }
                let handle = open_terminal_handle(
                    &current,
                    FILE_READ_ATTRIBUTES | READ_CONTROL,
                    FILE_SHARE_READ,
                )?;
                guard.handles.push(handle);
                let identity = terminal_identity(guard.handles.last().unwrap().0)?;
                if identity.attributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
                    return Err("terminal_not_directory");
                }
            }
            let handle = guard.handles.last().ok_or("terminal_directory_missing")?.0;
            let current_identity = terminal_identity(handle)?;
            if expected.is_some_and(|expected| current_identity != expected) {
                return Err("terminal_directory_identity_mismatch");
            }
            guard.identity = current_identity;
            if expected.is_none() && !bootstrap {
                let length = guard.handles.len();
                if length < 4 {
                    return Err("terminal_namespace_chain_missing");
                }
                guard.namespace = Some(TerminalNamespaceIdentity {
                    parent: terminal_identity(guard.handles[length - 3].0)?,
                    recovery: terminal_identity(guard.handles[length - 2].0)?,
                    terminal: current_identity,
                    selected_user: selected.ok_or("terminal_selected_user_unknown")?,
                });
            }
            if bootstrap {
                Ok(())
            } else {
                verify_terminal_protection(handle, &guard.user, &guard.system)?;
                guard.verify_namespace()
            }
        })();
        if let Err(reason) = observed {
            let closed = guard.close();
            if !closed || guard.token_closes.contains(&false) {
                CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
            }
            return Err(TerminalDirectoryOpenFailure {
                reason: if closed {
                    reason
                } else {
                    "terminal_directory_close_unknown"
                },
                operation_reason: acquisition_reason.unwrap_or(reason),
                tokens_acquired: guard.token_closes.len(),
                token_closes: guard.token_closes,
                directories_acquired: guard.handles.len(),
                directory_closes: guard.directory_closes,
            });
        }
        Ok(guard)
    }

    /// 保持Directoryの実体と保護を再確認する。
    ///
    /// @responsibility 処置直前と直後の保護観測を同じ実体へ結ぶ。
    /// @trace ARCH-000011
    /// @input 自己所有guard。
    /// @returns 一致または固定失敗。
    /// @precondition guardが全chainを保持中。
    /// @postcondition 不明から処置許可を作らない。
    /// @effect 読取りのみ。
    /// @failure close後、Identity/保護不一致で停止。
    /// @invariant 書込みやRoot削除を発行しない。
    /// @boundary Native→Identity/ACL。
    /// @security 権限や非使用の判定ではない。
    /// @concurrency private guard借用中にcloseしない。
    pub(super) fn verify(&self) -> Result<(), &'static str> {
        let handle = self.handles.last().ok_or("terminal_directory_closed")?.0;
        if terminal_identity(handle)? != self.identity {
            return Err("terminal_directory_identity_mismatch");
        }
        verify_terminal_protection(handle, &self.user, &self.system)?;
        self.verify_namespace()
    }

    /// 全保持handleの終了を逆順に明示確認する。
    ///
    /// @responsibility 一つの解放失敗も正常終了へ畳まない。
    /// @trace ARCH-000011
    /// @input 一意所有guard。
    /// @returns 全終了確認かfalse。
    /// @precondition stageと保留I/Oが終端済み。
    /// @postcondition 成功slotだけ空にする。
    /// @effect 全自己所有handleへcloseを試行する。
    /// @failure 一件でもunknownならfalseを維持する。
    /// @invariant Dropや空配列を先行close成功の代替にしない。
    /// @boundary Native→CloseHandle。
    /// @security 別Processや対象fileを削除しない。
    /// @concurrency 子stageの借用終了後だけ実行する。
    pub(super) fn close(&mut self) -> bool {
        if let Some(closed) = self.close_confirmed {
            return closed;
        }
        let mut closed = true;
        for handle in self.handles.iter_mut().rev() {
            if !handle.0.is_null() {
                let observed = close_terminal_handle(handle);
                self.directory_closes.push(observed);
                closed &= observed;
            }
        }
        self.close_confirmed = Some(closed);
        if !closed {
            CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
        }
        closed
    }
}

/// 保護付き初期化が扱える固定childを区別する。
///
/// @responsibility 共有管理先と終端保存先の作成を同じ自由Path操作にしない。
/// @trace ARCH-000011
/// @shape RecoveryとTerminalの閉じた二variant。
/// @invariant 既存ACL移行または任意名を表すvariantは持たない。
/// @boundary 私有Native初期化Owner。
/// @security 観測・保存の要求から暗黙発火しない。
/// @compatibility 現行の固定二child名を維持する。
#[derive(Clone, Copy)]
pub(super) enum HostNamespaceChild {
    Recovery,
    Terminal,
}

/// 初期化の発行・観測・部分終了を保持する。
///
/// @responsibility 作成後失敗をEffect 0またはrollback済みへ畳まない。
/// @trace ARCH-000011
/// @shape 作成発行、作成API結果、fresh Identity、child handle取得と明示close結果。
/// @invariant created=Noneは作成結果不明。正常時のchild closeは親guardの終端で確認する。
/// @boundary Native私有初期化→後続Owner。
/// @security Path、SID、清掃・移行Authorityを含まない。
/// @compatibility 既存記録保存receiptとは別の管理Effectである。
#[derive(Debug)]
pub(super) struct HostNamespaceCreationReceipt {
    pub(super) create_issued: bool,
    pub(super) created: Option<bool>,
    pub(super) identity: Option<DirectoryIdentity>,
    pub(super) child_handle_acquired: bool,
    pub(super) child_close_confirmed: Option<bool>,
}

/// 初期化失敗と発行済み管理Effectを返す。
///
/// @responsibility 元理由と部分結果を共同保持する。
/// @trace ARCH-000011
/// @shape 固定理由と同じ初期化receipt。
/// @invariant 失敗結果を共有Directory削除または自動再試行の許可にしない。
/// @boundary 私有初期化Owner内。
/// @security 生OS出力・Path・SIDを含まない。
/// @compatibility 旧記録・元Taskの回復参照を発行しない。
#[derive(Debug)]
pub(super) struct HostNamespaceCreationFailure {
    pub(super) reason: &'static str,
    pub(super) operation_reason: &'static str,
    pub(super) receipt: HostNamespaceCreationReceipt,
}

/// 保持した親の固定childだけを作成または保護再検証する。
///
/// @responsibility 作成時の保護、存在競合、fresh実体・ACLと部分Effectを共同保持する。
/// @trace ARCH-000011
/// @input 私有の親guardと閉じたRecovery/Terminal種別。
/// @returns 同じguardへ追加したchild receipt、または元理由と部分receipt。
/// @precondition 上位Ownerが親の所在、独立実体、作成許可と実行物を確認する。
/// @postcondition 正常時だけ通常Directory・非reparse・protected二ACEのchildを保持する。
/// @effect 明示不存在の固定childへ保護付きCreateDirectoryW。一時親・既存ACL・markerは変更しない。
/// @failure 存在不明、作成・型・ACL・取得・close不明を部分結果とともに停止する。
/// @invariant 既存不適合を修復せず、共有Directoryをrollbackで削除しない。
/// @boundary 私有Native初期化→Windows Directory/ACL API。
/// @security 任意Path・SID・mask、汎用mkdirまたは権限移行の公開入口ではない。
/// @concurrency 親chainを保持し、作成競合後もfreshなchild handleで照合する。
pub(super) fn create_host_namespace_child(
    parent: &mut TerminalDirectory,
    child: HostNamespaceChild,
) -> Result<HostNamespaceCreationReceipt, HostNamespaceCreationFailure> {
    let mut receipt = HostNamespaceCreationReceipt {
        create_issued: false,
        created: Some(false),
        identity: None,
        child_handle_acquired: false,
        child_close_confirmed: None,
    };
    let mut operation_reason = None;
    let result = (|| {
        if parent.close_confirmed.is_some()
            || parent.namespace.is_some()
            || parent.selected_user.is_none()
        {
            return Err("terminal_bootstrap_parent_invalid");
        }
        let parent_handle = parent.handles.last().ok_or("terminal_directory_missing")?.0;
        if terminal_identity(parent_handle)? != parent.identity {
            return Err("terminal_directory_identity_mismatch");
        }
        for handle in &parent.handles {
            if terminal_identity(handle.0)?.attributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
                return Err("terminal_not_directory");
            }
        }
        let leaf = match child {
            HostNamespaceChild::Recovery => "crdd-coordinator-recovery-v1",
            HostNamespaceChild::Terminal => {
                if parent.path.file_name()
                    != Some(std::ffi::OsStr::new("crdd-coordinator-recovery-v1"))
                {
                    return Err("terminal_bootstrap_parent_invalid");
                }
                verify_terminal_protection(parent_handle, &parent.user, &parent.system)?;
                "terminal-v1"
            }
        };
        let target = parent.path.join(leaf);
        if !observe_terminal_presence(&target)? {
            let mut wide: Vec<u16> = target.as_os_str().encode_wide().collect();
            if wide.is_empty() || wide.len() >= 32767 || wide.contains(&0) {
                return Err("terminal_path_invalid");
            }
            wide.push(0);
            with_terminal_descriptor(&parent.user, &parent.system, |attributes| {
                receipt.create_issued = true;
                receipt.created = None;
                // SAFETY: fixed child of a held chain; descriptor lives through this synchronous call.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } != 0 {
                    receipt.created = Some(true);
                    return Ok(());
                }
                // SAFETY: immediately reads the result of the same-thread failed create.
                if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
                    receipt.created = Some(false);
                    return Ok(());
                }
                Err("terminal_namespace_create_unconfirmed")
            })?;
        }
        let mut handle = open_terminal_handle(
            &target,
            FILE_READ_ATTRIBUTES | READ_CONTROL,
            FILE_SHARE_READ,
        )?;
        receipt.child_handle_acquired = true;
        let verified = (|| {
            let identity = terminal_identity(handle.0)?;
            receipt.identity = Some(identity);
            if identity.attributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
                return Err("terminal_not_directory");
            }
            if terminal_identity(parent_handle)? != parent.identity {
                return Err("terminal_directory_identity_mismatch");
            }
            verify_terminal_protection(handle.0, &parent.user, &parent.system)?;
            Ok(identity)
        })();
        let identity = match verified {
            Ok(identity) => identity,
            Err(reason) => {
                operation_reason = Some(reason);
                let closed = close_terminal_handle(&mut handle);
                receipt.child_close_confirmed = Some(closed);
                if !closed {
                    CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
                }
                return Err(if closed {
                    reason
                } else {
                    "terminal_directory_close_unknown"
                });
            }
        };
        parent.handles.push(handle);
        parent.path = target;
        parent.identity = identity;
        Ok(())
    })();
    match result {
        Ok(()) => Ok(receipt),
        Err(reason) => Err(HostNamespaceCreationFailure {
            reason,
            operation_reason: operation_reason.unwrap_or(reason),
            receipt,
        }),
    }
}

/// OSが示す固定親を読取り確認し、期待値付き要求だけ保護付き初期化する。
///
/// @responsibility 現在観測と作成許可を分け、部分処置・元理由・全終了を同じ要求へ保持する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 専用parserのnonceと作成時だけ独立親Identity・利用者Hash。
/// @returns 親観測、三境界確認、または停止と部分receipt。
/// @precondition 上位が署名実行物と呼出し許可を確認する。
/// @postcondition 両childの保護・三実体相異・全終了を確認して初期化完了を返す。
/// @effect GetTempPathW、Token・祖先handle観測、作成要求時だけ固定childの作成。
/// @failure 所在・実体・利用者・作成・保護・終了の不明を停止する。
/// @invariant 既存不適合ACLを修復せず、共有境界をrollbackしない。
/// @boundary 固定Native mode→Windows管理境界。
/// @security 自由Path、SID、mask、削除Authorityを受け付けない。
/// @concurrency 全祖先を保持し、競合作成後も同じchainでfresh保護を検証する。
pub(crate) fn host_recovery_namespace_request(
    request: &crate::protocol::host_namespace::NamespaceRequest,
) -> crate::protocol::host_namespace::NamespaceResponse {
    let mut buffer = [0_u16; 4097];
    // SAFETY: bounded writable buffer; synchronous path observation only.
    let length = unsafe { GetTempPathW(buffer.len() as u32, buffer.as_mut_ptr()) };
    match decode_terminal_temporary_parent(&buffer, length) {
        Ok(parent) => host_namespace_at_parent(request, &parent),
        Err(reason) => crate::protocol::host_namespace::blocked(request.nonce, reason),
    }
}

/// 固定親の私有処理を自己生成fixtureと同じ本体で実行する。
///
/// @responsibility 本番の親所在解決と試験用の自己生成親を分離し、初期化の判定を共用する。
/// @trace ARCH-000011
/// @input 専用要求と上位Ownerが解決した親。
/// @returns 同nonceの部分結果と個別終了。
/// @precondition 本番はGetTempPathW固定親、試験はRepository内の自作fixtureだけ。
/// @postcondition 期待値一致前はchild作成0。成功でも記録保存Authorityを持たない。
/// @effect 読取りchainと、期待値付き要求時だけ固定二childを作成する。
/// @failure 取得・期待差・子作成・検証・終了不明を停止結果へ保持する。
/// @invariant 失敗後も初期化receiptを捨てず、共有物を削除しない。
/// @boundary 私有Native Owner→Windows。
/// @security このPath受付は公開CLIまたはProtocolではない。
/// @concurrency 同期処置の終端で全自己handleを逆順解放する。
pub(super) fn host_namespace_at_parent(
    request: &crate::protocol::host_namespace::NamespaceRequest,
    parent: &Path,
) -> crate::protocol::host_namespace::NamespaceResponse {
    use crate::protocol::host_namespace::{ChildReceipt, blocked};
    let mut response = blocked(request.nonce, "terminal_namespace_observation_failed");
    let expected = request.expected.map(|(fields, _)| DirectoryIdentity {
        volume_serial_number: fields[0],
        file_index_high: fields[1],
        file_index_low: fields[2],
        creation_time_low: fields[3],
        creation_time_high: fields[4],
        attributes: fields[5],
    });
    let opened = TerminalDirectory::open_guard(parent, expected, None, true);
    let mut guard = match opened {
        Ok(guard) => guard,
        Err(failure) => {
            response.reason = failure.reason;
            response.operation_reason = Some(failure.operation_reason);
            response.token_closes = failure.token_closes;
            response.directory_closes = failure.directory_closes;
            return response;
        }
    };
    response.identities[0] = Some(terminal_identity_fields(guard.identity));
    response.selected_user = guard.selected_user;
    let parent_slot = guard.handles.len() - 1;
    let mut held_slots = [None; 2];
    let mut recovery_identity = None;
    let result = (|| {
        let selected_user = guard
            .selected_user
            .ok_or("terminal_selected_user_unknown")?;
        if let Some((_, expected_user)) = request.expected {
            if selected_user != expected_user {
                return Err("terminal_selected_user_mismatch");
            }
            if guard.handles.len() > crate::protocol::host_record::MAX_CHAIN_HANDLES - 2 {
                return Err("terminal_namespace_chain_limit");
            }
            for (index, child) in [HostNamespaceChild::Recovery, HostNamespaceChild::Terminal]
                .into_iter()
                .enumerate()
            {
                let slot = guard.handles.len();
                let (receipt, failure) = match create_host_namespace_child(&mut guard, child) {
                    Ok(receipt) => (receipt, None),
                    Err(failure) => {
                        response.operation_reason = Some(failure.operation_reason);
                        (failure.receipt, Some(failure.reason))
                    }
                };
                response.identities[index + 1] = receipt.identity.map(terminal_identity_fields);
                if index == 0 {
                    recovery_identity = receipt.identity;
                }
                response.children[index] = Some(ChildReceipt {
                    create_issued: receipt.create_issued,
                    created: receipt.created,
                    handle_acquired: receipt.child_handle_acquired,
                    close: receipt.child_close_confirmed,
                });
                if let Some(reason) = failure {
                    return Err(reason);
                }
                held_slots[index] = Some(slot);
            }
            guard.verify()?;
            if terminal_identity(guard.handles[parent_slot].0)?
                != expected.ok_or("terminal_bootstrap_parent_invalid")?
            {
                return Err("terminal_directory_identity_mismatch");
            }
            let recovery_slot = held_slots[0].ok_or("terminal_directory_missing")?;
            if terminal_identity(guard.handles[recovery_slot].0)?
                != recovery_identity.ok_or("terminal_directory_identity_unknown")?
            {
                return Err("terminal_directory_identity_mismatch");
            }
            verify_terminal_protection(guard.handles[recovery_slot].0, &guard.user, &guard.system)?;
            validate_terminal_namespace(TerminalNamespaceIdentity {
                parent: expected.ok_or("terminal_bootstrap_parent_invalid")?,
                recovery: recovery_identity.ok_or("terminal_directory_identity_unknown")?,
                terminal: guard.identity,
                selected_user,
            })?;
            response.status = 2;
            response.reason = "terminal_namespace_initialized";
        } else {
            response.status = 1;
            response.reason = "terminal_namespace_parent_observed";
        }
        Ok(())
    })();
    if let Err(reason) = result {
        response.status = 0;
        response.reason = reason;
    }
    let closed = guard.close();
    for (index, slot) in held_slots.into_iter().enumerate() {
        if let Some(slot) = slot
            && let Some(receipt) = &mut response.children[index]
        {
            receipt.close = guard
                .directory_closes
                .get(guard.handles.len() - 1 - slot)
                .copied();
        }
    }
    if !closed {
        response.operation_reason = Some(response.operation_reason.unwrap_or(response.reason));
        response.reason = "terminal_directory_close_unknown";
        response.status = 0;
    }
    response.token_closes = guard.token_closes;
    response.directory_closes = guard.directory_closes;
    response
}

/// 保持された実体IdentityをProtocolの六u32へ損失なく変換する。
///
/// @responsibility 五識別値と属性を同じ順序で搬送する。
/// @trace ARCH-000011
/// @input 同handleから取得済みのIdentity。
/// @returns 六fieldの固定tuple。
/// @precondition 観測Ownerが取得成功を確認済み。
/// @postcondition 属性・日時を省略しない。
/// @effect N/A: Copy値の変換だけ。
/// @failure N/A: 固定型からの全field転記である。
/// @invariant 変換からAuthorityや独立期待値を生成しない。
/// @boundary 私有OS値→専用Protocol値。
/// @security Path・SID・本文を含めない。
/// @concurrency N/A: 不変Copy値のみ。
pub(super) fn terminal_identity_fields(value: DirectoryIdentity) -> [u32; 6] {
    [
        value.volume_serial_number,
        value.file_index_high,
        value.file_index_low,
        value.creation_time_low,
        value.creation_time_high,
        value.attributes,
    ]
}

pub(super) const TERMINAL_TARGET_CHILDREN: [&str; 6] = [
    "workspace",
    "provider-home",
    "tmp",
    "events",
    "projection",
    "management",
];

/// 名前と同じhandleから観測した対象一式を保持する。
///
/// @responsibility 現在観測を削除Authorityや原子的Snapshotへ昇格しない。
/// @trace ARCH-000011
/// @shape Root名、marker名、parent/recovery/terminal/Root/marker/六childの五fieldと属性、利用者と元bytes Hash。
/// @invariant 十一実体はvolume/file-indexで相異なる。marker内容は正規化しない。
/// @boundary 私有Native読取り。耐久codec・公開Protocolへ未接続。
/// @security 生Path、SID、元Task Token、非使用判定を含めない。
/// @compatibility 旧Node三fieldへ暗黙変換しない。intent revision 2への搬送でも全十一属性を保持する。
#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct TerminalTargetSnapshot {
    pub(super) root_name: String,
    pub(super) marker_name: String,
    pub(super) identities: [DirectoryIdentity; 11],
    pub(super) selected_user: [u8; 32],
    pub(super) marker_sha256: [u8; 32],
}

/// 保持fileの今回観測だけを表す。
///
/// @responsibility 固定内容・リンク数・実体を十二実体搬送へ接続できる値で保持する。
/// @trace ARCH-000011
/// @shape 同handleの六u32 Identity、固定7bytes、固定SHA-256、リンク数1。
/// @invariant 本文、非使用、人間承認、処置済みまたは終了成功を含めない。
/// @boundary 私有Native読取りから専用十二実体Protocolへ接続する。保存・公開処置は未接続。
/// @security 固定file以外の内容やPathを公開しない。
/// @compatibility 十一実体Snapshotへ黙って除外・合成しない。
#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct TerminalKnownFileSnapshot {
    pub(super) identity: DirectoryIdentity,
    pub(super) byte_length: u32,
    pub(super) sha256: [u8; 32],
    pub(super) link_count: u32,
}

/// 対象観測とクラス固有handleの初回終了を共同保持する。
///
/// @responsibility 全close確認前にSnapshotを公開しない。
/// @trace ARCH-000011
/// @shape 十一実体Snapshotは八、十二実体Snapshotは九対象の逆取得順close結果。
/// @invariant 外側namespace/Token/Processの終了をこの値から推定しない。
/// @boundary 私有同期読取り→私有consumer。
/// @security 回収、保存、Authorityを発行しない。
/// @compatibility 本番公開結果へ未接続。
#[derive(Debug)]
pub(super) struct TerminalTargetObservation<S = TerminalTargetSnapshot> {
    pub(super) snapshot: S,
    pub(super) closes: Vec<bool>,
}

/// 対象一式の部分取得と元失敗・初回終了を保持する。
///
/// @responsibility close不明で元の観測失敗と失敗位置を消さない。
/// @trace ARCH-000011
/// @shape 支配理由、観測Errだけの元理由、クラス固有の失敗位置、取得済み対象の部分数と逆順close。十二実体では位置11と最大九handleを保持する。
/// @invariant 不明終了はSnapshotを返さず、追加保存を停止する。
/// @boundary 私有読取り→私有consumer。外側guardは別Owner。
/// @security 生Path、marker本文、削除許可を出力しない。
/// @compatibility 元Taskの回復参照や結果を再構成しない。
#[derive(Debug)]
pub(super) struct TerminalTargetFailure {
    pub(super) reason: &'static str,
    pub(super) operation_reason: Option<&'static str>,
    pub(super) position: Option<usize>,
    pub(super) handles_acquired: usize,
    pub(super) closes: Vec<bool>,
}

/// 十一対象の種別と実体の相異を検査する。
///
/// @responsibility 属性や日時の違いで同じ実体を別対象へ見せない。
/// @trace ARCH-000011
/// @input 固定位置の五field/属性Identity一式。
/// @returns marker以外Directory、全非reparse、相異ならOk。
/// @precondition 観測不能はこの配列を生成しない。
/// @postcondition 全pairのvolume/file-index三field重複を拒否する。
/// @effect N/A: 値比較のみ。
/// @failure 種別、reparse、重複を拒否する。
/// @invariant marker本文の意味・関係をこの判定から推定しない。
/// @boundary Native観測/独立期待値→私有照合。
/// @security Identityから回収Authorityを発行しない。
/// @concurrency N/A: Copy値の局所検査。
pub(super) fn validate_terminal_target_identities(
    identities: &[DirectoryIdentity; 11],
) -> Result<(), &'static str> {
    for (position, identity) in identities.iter().enumerate() {
        if identity.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
            || (identity.attributes & FILE_ATTRIBUTE_DIRECTORY != 0) != (position != 4)
        {
            return Err("terminal_target_type_invalid");
        }
        for other in &identities[..position] {
            if (
                identity.volume_serial_number,
                identity.file_index_high,
                identity.file_index_low,
            ) == (
                other.volume_serial_number,
                other.file_index_high,
                other.file_index_low,
            ) {
                return Err("terminal_target_identity_duplicate");
            }
        }
    }
    Ok(())
}

/// 同期観測と逆順closeを一つの結果へ収束する。
///
/// @responsibility 部分取得と初回終了不明を観測成功へ畳まない。
/// @trace ARCH-000011
/// @input 観測結果、失敗位置、取得済み数、実close結果。
/// @returns 全八終了確認後のSnapshot、または観測Errの場合だけ元理由を持つ失敗。
/// @precondition 呼出し元が取得済みhandleへ逆順の明示closeを実行済み。
/// @postcondition close不明は追加保存停止へ反映しSnapshotを出さない。
/// @effect 終了不明時だけProcess内停止flagを単調設定する。
/// @failure close数不一致、一件unknown、観測失敗を区別する。
/// @invariant 外側guardやProcessの終了はここで主張しない。
/// @boundary 私有read-only観測→内部結果。
/// @security cleanupや新Authorityを発行しない。
/// @concurrency Atomic停止flagは後続保存を拒否する。局所resultは同期所有。
#[cfg(test)]
pub(super) fn finish_terminal_target_observation(
    observed: Result<TerminalTargetSnapshot, &'static str>,
    position: Option<usize>,
    handles_acquired: usize,
    closes: Vec<bool>,
) -> Result<TerminalTargetObservation, TerminalTargetFailure> {
    finish_terminal_observation_core(observed, position, handles_acquired, closes, 8)
}

/// 八／九対象の明示終了と観測値を共同判定する。
///
/// @responsibility 専用入口の全取得数と初回closeが一致する場合だけ型付き値を返す。
/// @trace ARCH-000011
/// @input 観測値、位置、取得数、実close列、内部固定の期待数。
/// @returns 型付き観測、または元理由と終了不明。
/// @precondition 取得済みhandleへ逆順の明示closeを全て試行済み。
/// @postcondition 終了不明はProcess内追加保存停止へ結合する。
/// @effect 終了不明時だけ単調停止flagを設定する。
/// @failure 数不一致、取得不足、close不明、観測失敗を区別する。
/// @invariant Dropや外側guardの存在を全終了証明にしない。
/// @boundary 私有同期観測→私有終端値。
/// @security Authorityや削除許可を発行しない。
/// @concurrency 局所一意結果とAtomic停止flagだけを扱う。
pub(super) fn finish_terminal_observation_core<S>(
    observed: Result<S, &'static str>,
    position: Option<usize>,
    handles_acquired: usize,
    closes: Vec<bool>,
    expected_count: usize,
) -> Result<TerminalTargetObservation<S>, TerminalTargetFailure> {
    let closed = closes.len() == handles_acquired && closes.iter().all(|value| *value);
    if !closed {
        CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    let operation_reason = observed.as_ref().err().copied();
    if closed
        && handles_acquired == expected_count
        && let Ok(snapshot) = observed
    {
        return Ok(TerminalTargetObservation { snapshot, closes });
    }
    Err(TerminalTargetFailure {
        reason: if closed {
            operation_reason.unwrap_or("terminal_target_acquisition_incomplete")
        } else {
            "terminal_target_close_unknown"
        },
        operation_reason,
        position,
        handles_acquired,
        closes,
    })
}

/// 固定namespaceに結合したRoot・marker・六childを同じhandleで再確認する。
///
/// @responsibility 現在観測と独立したKnown期待値を区別し、八handle終了前に値を返さない。
/// @trace ARCH-000011
/// @input 保持namespace、単純Root/marker名、Known時だけ別に保持した全Snapshot。
/// @returns 十一実体とmarker元bytes Hash、または位置・部分取得・個別closeを持つ失敗。
/// @precondition 固定三実体と利用者を照合済み。現在値から削除許可を作らない。
/// @postcondition 同じ十一Identity、二ACL、marker全bytes/EOF/前後実長を再確認する。
/// @effect 読取りhandle八件とfile位置変更だけ。作成・保存・削除0。
/// @failure 名、Known形、欠落、種別、実体、marker上限/読取不明、close不明で停止する。
/// @invariant 原子的Snapshot、未知child不存在、非使用、host_only意味を主張しない。
/// @boundary 私有同期Native→Windows File API。公開Recovery consumerは未接続。
/// @security 自由Path、SID出力、旧Token復元、marker再正規化を行わない。
/// @concurrency shareREADで八実体を継続保持し、借用中は外側guardをcloseしない。
pub(super) fn observe_terminal_target(
    directory: &TerminalDirectory,
    root_name: &str,
    marker_name: &str,
    known: Option<&TerminalTargetSnapshot>,
) -> Result<TerminalTargetObservation, TerminalTargetFailure> {
    observe_terminal_target_core(directory, root_name, marker_name, known, false, None).map(
        |observed| TerminalTargetObservation {
            snapshot: observed.snapshot.0,
            closes: observed.closes,
        },
    )
}

/// 同じ九handle保持中のfile観測を十二実体Snapshotへ接続する。
///
/// @responsibility 旧値の縮約ではなく専用十二実体と固定file値を構築する。
/// @trace ARCH-000011
/// @input 保持namespace、固定Root／marker名、指定時だけ十二対象の独立Known。
/// @returns 全九close確認後の十二実体、または位置付き失敗。
/// @precondition 外側guardが生存し、namespaceを確認済み。
/// @postcondition fileは位置11に入り、全実体相異と全bytes照合、指定された全Knownとの共同一致を保持する。
/// @effect 九対象の読取り取得・file位置変更・明示closeだけ。
/// @failure file欠落、内容・リンク・型差、alias、Known差、close不明で停止。
/// @invariant KnownなしのCurrentやnamespace-Knownを全対象Knownの成立へ昇格しない。他entry不存在や非使用を主張しない。
/// @boundary 私有Windows観測→専用Snapshot。
/// @security 任意fileや処置Authorityを受理しない。
/// @concurrency fileとRoot／marker／六childを読取り・再照合中に同時保持する。
pub(super) fn observe_known_file_terminal_target(
    directory: &TerminalDirectory,
    root_name: &str,
    marker_name: &str,
    known: Option<&crate::protocol::host_record::KnownFileTerminalSnapshot>,
) -> Result<
    TerminalTargetObservation<crate::protocol::host_record::KnownFileTerminalSnapshot>,
    TerminalTargetFailure,
> {
    let observed =
        observe_terminal_target_core(directory, root_name, marker_name, None, true, known)?;
    let (base, file) = observed.snapshot;
    let Some(file) = file else {
        return Err(TerminalTargetFailure {
            reason: "terminal_known_file_acquisition_incomplete",
            operation_reason: None,
            position: Some(11),
            handles_acquired: 9,
            closes: observed.closes,
        });
    };
    Ok(TerminalTargetObservation {
        snapshot: crate::protocol::host_record::KnownFileTerminalSnapshot {
            identities: std::array::from_fn(|position| {
                terminal_identity_fields(if position == 11 {
                    file.identity
                } else {
                    base.identities[position]
                })
            }),
            selected_user: base.selected_user,
            marker_sha256: base.marker_sha256,
            file_byte_length: file.byte_length,
            file_link_count: file.link_count,
            file_sha256: file.sha256,
        },
        closes: observed.closes,
    })
}

/// 固定対象の八実体と専用クラスのfileだけを同時保持して読む。
///
/// @responsibility 取得・読取り・再照合・個別closeを同じ同期区間へ閉じる。
/// @trace ARCH-000011
/// @input 保持namespace、固定名、クラス別の全Known、内部fileクラス選択。
/// @returns 基本Snapshotと専用file値、または部分取得とclose列。
/// @precondition 呼出し元は旧／新専用入口だけ。クラスをまたぐKnownは拒否する。
/// @postcondition 新クラスはfileを別open後に捨てず九handleを同時保持する。
/// @effect 読取り取得・位置変更・逆順closeだけ。変更、保存、削除0。
/// @failure 型、相異、欠落、読取り、Known差、競合または終了不明は停止。
/// @invariant Currentを独立期待値や非使用へ昇格しない。
/// @boundary 内部二クラス→Windows同期handle。
/// @security file名・位置・長さ・Hashを外部指定させない。
/// @concurrency 外側guardを借用し、全対象を再照合まで保持する。
pub(super) fn observe_terminal_target_core(
    directory: &TerminalDirectory,
    root_name: &str,
    marker_name: &str,
    known: Option<&TerminalTargetSnapshot>,
    includes_known_file: bool,
    known_file: Option<&crate::protocol::host_record::KnownFileTerminalSnapshot>,
) -> Result<
    TerminalTargetObservation<(TerminalTargetSnapshot, Option<TerminalKnownFileSnapshot>)>,
    TerminalTargetFailure,
> {
    let mut handles = Vec::<OwnedHandle>::new();
    let mut position = None;
    let observed = (|| {
        validate_terminal_target_names(root_name, marker_name)?;
        if (includes_known_file && known.is_some())
            || (!includes_known_file && known_file.is_some())
        {
            return Err("terminal_target_known_class_mismatch");
        }
        if let Some(expected) = known {
            validate_terminal_target_names(&expected.root_name, &expected.marker_name)?;
            validate_terminal_target_identities(&expected.identities)?;
            if expected.root_name != root_name || expected.marker_name != marker_name {
                return Err("terminal_target_known_name_mismatch");
            }
        }
        let namespace = directory
            .namespace
            .ok_or("terminal_target_namespace_required")?;
        directory.verify()?;
        let recovery = directory
            .path
            .parent()
            .ok_or("terminal_target_namespace_required")?;
        let parent = recovery
            .parent()
            .ok_or("terminal_target_namespace_required")?;
        let root = parent.join(root_name);
        let paths = std::iter::once(root.clone())
            .chain(std::iter::once(recovery.join(marker_name)))
            .chain(TERMINAL_TARGET_CHILDREN.map(|name| root.join(name)));
        let chain_length = directory.handles.len();
        let mut identities = Vec::new();
        for offset in [3, 2, 1] {
            position = Some(3 - offset);
            identities.push(terminal_identity(
                directory.handles[chain_length - offset].0,
            )?);
        }
        for (index, path) in paths.enumerate() {
            position = Some(index + 3);
            let access = if index == 1 {
                FILE_GENERIC_READ | READ_CONTROL
            } else {
                FILE_READ_ATTRIBUTES | READ_CONTROL
            };
            handles.push(open_terminal_handle(&path, access, FILE_SHARE_READ)?);
            let identity = terminal_identity(handles.last().unwrap().0)?;
            if (identity.attributes & FILE_ATTRIBUTE_DIRECTORY != 0) != (index != 1) {
                return Err("terminal_target_type_invalid");
            }
            identities.push(identity);
        }
        let identities: [DirectoryIdentity; 11] = identities
            .try_into()
            .map_err(|_| "terminal_target_acquisition_incomplete")?;
        validate_terminal_target_identities(&identities)?;
        let file = if includes_known_file {
            position = Some(11);
            handles.push(open_terminal_handle(
                &root.join("workspace").join("fixture.txt"),
                FILE_GENERIC_READ | READ_CONTROL,
                FILE_SHARE_READ,
            )?);
            let file = observe_terminal_known_file(&handles[8], None)?;
            let file_key = terminal_identity_fields(file.identity);
            if identities
                .iter()
                .any(|identity| terminal_identity_fields(*identity)[..3] == file_key[..3])
            {
                return Err("terminal_known_file_identity_duplicate");
            }
            Some(file)
        } else {
            None
        };
        position = Some(4);
        let bytes = read_terminal_bounded_bytes(handles[1].0, MAX_HOST_MARKER_OBSERVATION_BYTES)?;
        let marker_sha256 = sha256(&[&bytes]).ok_or("terminal_target_marker_hash_unknown")?;
        let second = read_terminal_bounded_bytes(handles[1].0, MAX_HOST_MARKER_OBSERVATION_BYTES)?;
        if second != bytes {
            return Err("terminal_target_marker_changed");
        }
        let mut final_length = 0_i64;
        // SAFETY: held synchronous marker handle and private size output.
        if unsafe { GetFileSizeEx(handles[1].0, &mut final_length) } == 0
            || final_length != bytes.len() as i64
        {
            return Err("terminal_target_marker_length_changed");
        }
        for (index, handle) in handles.iter().take(8).enumerate() {
            position = Some(index + 3);
            if terminal_identity(handle.0)? != identities[index + 3] {
                return Err("terminal_target_identity_changed");
            }
        }
        if let Some(file) = &file {
            position = Some(11);
            observe_terminal_known_file(&handles[8], Some(file))?;
        }
        position = None;
        directory.verify()?;
        let snapshot = TerminalTargetSnapshot {
            root_name: root_name.to_owned(),
            marker_name: marker_name.to_owned(),
            identities,
            selected_user: namespace.selected_user,
            marker_sha256,
        };
        if known.is_some_and(|expected| *expected != snapshot) {
            return Err("terminal_target_known_mismatch");
        }
        if let Some(expected) = known_file {
            for (index, actual) in snapshot.identities.iter().enumerate() {
                position = Some(index);
                if terminal_identity_fields(*actual) != expected.identities[index] {
                    return Err("terminal_target_known_mismatch");
                }
            }
            position = None;
            if expected.selected_user != snapshot.selected_user {
                return Err("terminal_target_known_user_mismatch");
            }
            position = Some(4);
            if expected.marker_sha256 != snapshot.marker_sha256 {
                return Err("terminal_target_known_marker_mismatch");
            }
            position = Some(11);
            let actual = file
                .as_ref()
                .ok_or("terminal_known_file_acquisition_incomplete")?;
            if expected.identities[11] != terminal_identity_fields(actual.identity)
                || expected.file_byte_length != actual.byte_length
                || expected.file_link_count != actual.link_count
                || expected.file_sha256 != actual.sha256
            {
                return Err("terminal_known_file_known_mismatch");
            }
            position = None;
        }
        Ok((snapshot, file))
    })();
    let handles_acquired = handles.len();
    let closes = handles
        .iter_mut()
        .rev()
        .map(close_terminal_handle)
        .collect();
    finish_terminal_observation_core(
        observed,
        position,
        handles_acquired,
        closes,
        if includes_known_file { 9 } else { 8 },
    )
}

/// 同じ保持fileの種別・実長・リンク数を検査する。
///
/// @responsibility 通常fileとhardlinkを区別し、欠測を固定値へ補完しない。
/// @trace ARCH-000011
/// @input 同handleから実取得したBY_HANDLE_FILE_INFORMATION。
/// @returns 五識別値と属性、または固定条件差の拒否。
/// @precondition 呼出し元がGetFileTypeでdisk fileを確認する。
/// @postcondition サイズ7、リンク数1、非Directory・非reparseだけ受理する。
/// @effect N/A: 私有観測値の検査のみ。
/// @failure 属性、実長またはリンク数の不一致は固定理由で拒否する。
/// @invariant 観測値の受理を非使用や削除許可へ変換しない。
/// @boundary Win32観測値→私有file Snapshot。
/// @security 未知を0や1へ畳まない。
/// @concurrency N/A: 同期Copy値の検査。
pub(super) fn validate_terminal_known_file_information(
    information: &BY_HANDLE_FILE_INFORMATION,
) -> Result<DirectoryIdentity, &'static str> {
    if information.dwFileAttributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT) != 0
    {
        return Err("terminal_known_file_type_invalid");
    }
    if information.nFileSizeHigh != 0 || information.nFileSizeLow != 7 {
        return Err("terminal_known_file_length_invalid");
    }
    if information.nNumberOfLinks != 1 {
        return Err("terminal_known_file_links_invalid");
    }
    Ok(directory_identity(information))
}

/// 借用した同handleで既知7bytes・EOF・実体を前後確認する。
///
/// @responsibility 固定fileの今回観測を所有し、取得・終了は借用元Ownerへ残す。
/// @trace ARCH-000011
/// @input 親workspaceとその祖先を検証・保持したOwnerの同期read handle、Known時だけ別に保持したSnapshot。
/// @returns 固定file Snapshot、または実体・内容・リンク数の拒否。
/// @precondition 固定workspace/fixture.txtだけを非reparse・shareREADで開き、handleと親chainを終了まで保持する。局所fixtureは自己生成境界だけで利用する。
/// @postcondition 同handleのdisk種別、Identity、リンク数、実長を前後確認し、二回の全bytes・EOF・固定Hashが一致する。
/// @effect 同期readとfile位置変更だけ。open、保存、削除0。
/// @failure 情報取得、読取り・EOF・Hash、前後差またはKnown差は拒否する。
/// @invariant 互換readerの不存在、十二実体共同Snapshot、非使用、清掃完了を主張しない。
/// @boundary 借用元Owner→Windows File API。旧十一実体入口へ接続しない。
/// @security bytes・Path・Authorityを返さない。実対象の許可は上位Ownerが照合する。
/// @concurrency 借用元がfile位置を一意所有し、write/delete競合をshare条件で拒否する。終了と部分失敗は借用元が記録する。
pub(super) fn observe_terminal_known_file(
    handle: &OwnedHandle,
    known: Option<&TerminalKnownFileSnapshot>,
) -> Result<TerminalKnownFileSnapshot, &'static str> {
    // SAFETY: borrowed synchronous live handle; no ownership transfer or filesystem effect.
    if unsafe { GetFileType(handle.0) } != FILE_TYPE_DISK {
        return Err("terminal_known_file_type_invalid");
    }
    let before = root_information(handle.0).ok_or("terminal_known_file_information_unknown")?;
    let identity = validate_terminal_known_file_information(&before)?;
    let bytes = read_terminal_bounded_bytes(handle.0, 7)?;
    let digest = sha256(&[&bytes]).ok_or("terminal_known_file_hash_unknown")?;
    if bytes.len() != 7 || digest != KNOWN_FIXTURE_SHA256 {
        return Err("terminal_known_file_content_invalid");
    }
    let second = read_terminal_bounded_bytes(handle.0, 7)?;
    if second != bytes {
        return Err("terminal_known_file_content_changed");
    }
    let after = root_information(handle.0).ok_or("terminal_known_file_information_unknown")?;
    if validate_terminal_known_file_information(&after)? != identity {
        return Err("terminal_known_file_identity_changed");
    }
    let snapshot = TerminalKnownFileSnapshot {
        identity,
        byte_length: after.nFileSizeLow,
        sha256: digest,
        link_count: after.nNumberOfLinks,
    };
    if known.is_some_and(|expected| *expected != snapshot) {
        return Err("terminal_known_file_known_mismatch");
    }
    Ok(snapshot)
}

/// 固定保存境界の独立期待値を保持する。
///
/// @responsibility 観測値をその場で期待値へ付け替えない。
/// @trace ARCH-000011
/// @shape parent/recovery/terminalの五fieldと属性、選択利用者Hash。
/// @invariant 三対象はvolume/file-indexで相異なる。
/// @boundary 私有Native固定境界。公開Protocolへ未接続。
/// @security Path、SID、Authorityを入力値へ含めない。
/// @compatibility 旧三field Protocolとは非互換。
#[derive(Clone, Copy, Debug)]
pub(super) struct TerminalNamespaceIdentity {
    pub(super) parent: DirectoryIdentity,
    pub(super) recovery: DirectoryIdentity,
    pub(super) terminal: DirectoryIdentity,
    pub(super) selected_user: [u8; 32],
}

/// 固定三Directoryの形と相異を処置前に確認する。
///
/// @responsibility 同じfile-indexを日時・属性差で別対象へ見せない。
/// @trace ARCH-000011
/// @input 私有namespaceの独立期待値。
/// @returns Directory・非reparse・三実体相異ならOk。
/// @precondition Identity取得の由来と許可は上位Ownerが確認する。
/// @postcondition 不正期待値からOS handleを取得しない。
/// @effect N/A: 値の検査だけ。
/// @failure file/reparse期待値、三field実体の重複を拒否する。
/// @invariant 五fieldのゼロ値を未観測の代替値として発行しない。
/// @boundary 内部期待値→固定namespace Gate。
/// @security selected-user HashをAuthorityへ昇格しない。
/// @concurrency N/A: Copy値の局所比較。
pub(super) fn validate_terminal_namespace(
    expected: TerminalNamespaceIdentity,
) -> Result<(), &'static str> {
    let identities = [expected.parent, expected.recovery, expected.terminal];
    for (index, identity) in identities.iter().enumerate() {
        if identity.attributes & FILE_ATTRIBUTE_DIRECTORY == 0
            || identity.attributes & FILE_ATTRIBUTE_REPARSE_POINT != 0
        {
            return Err("terminal_namespace_expected_invalid");
        }
        for other in &identities[..index] {
            if (
                identity.volume_serial_number,
                identity.file_index_high,
                identity.file_index_low,
            ) == (
                other.volume_serial_number,
                other.file_index_high,
                other.file_index_low,
            ) {
                return Err("terminal_namespace_expected_duplicate");
            }
        }
    }
    Ok(())
}

/// 対象の単純名を八handle取得前に検査する。
///
/// @responsibility traversal、自由suffix、別位置の名前を対象にしない。
/// @trace ARCH-000011
/// @input Root名とmarker名。Pathではない。
/// @returns 固定名形の一致または拒否。
/// @precondition Rootは親直下、markerはrecovery直下でのみ使用する。
/// @postcondition ASCIIの単純leafだけを受理する。
/// @effect N/A: 値検査のみ。
/// @failure prefix/長さ/文字種不正を拒否する。
/// @invariant 名前一致を由来や非使用の証明にしない。
/// @boundary 私有consumer→対象open準備。
/// @security 任意絶対Pathや環境値を受け付けない。
/// @concurrency N/A: 不変borrowの純検査。
pub(super) fn validate_terminal_target_names(root: &str, marker: &str) -> Result<(), &'static str> {
    if !crate::protocol::host_record::valid_target_names(root, marker) {
        return Err("terminal_target_name_invalid");
    }
    Ok(())
}

/// OS一時所在候補を切詰めず固定Drive絶対Pathへ変換する。
///
/// @responsibility API返却を存在・ACL・Authorityの保証にしない。
/// @trace ARCH-000011
/// @input bounded UTF-16 bufferとGetTempPathW返却長。
/// @returns 検証対象となる所在候補、または閉じた拒否。
/// @precondition bufferは今回の同期呼出しから独立所有した値。
/// @postcondition NUL終端、UTF-16、local disk絶対形、normal成分だけを受理する。
/// @effect N/A: 値変換だけ。存在・Drive種別は後続guardが確認する。
/// @failure 0/不足長/切詰め、embedded NUL、不正UTF-16、UNC/相対/特殊成分を拒否する。
/// @invariant 不明ならfallbackや別所在への再試行を行わない。
/// @boundary Windows API返却→私有固定namespace解決。
/// @security 環境値から書込み許可を作らずPathを公開結果へ返さない。
/// @concurrency N/A: 私有bufferの純変換。
pub(super) fn decode_terminal_temporary_parent(
    buffer: &[u16],
    length: u32,
) -> Result<PathBuf, &'static str> {
    let length = length as usize;
    if length == 0
        || length >= buffer.len()
        || buffer[length] != 0
        || buffer[..length].contains(&0)
        || String::from_utf16(&buffer[..length]).is_err()
    {
        return Err("terminal_temporary_parent_unknown");
    }
    let path = PathBuf::from(OsString::from_wide(&buffer[..length]));
    let components: Vec<_> = path.components().collect();
    if !matches!(components.first(), Some(Component::Prefix(prefix)) if matches!(prefix.kind(), std::path::Prefix::Disk(_)))
        || components.get(1) != Some(&Component::RootDir)
        || components.len() < 3
        || components[2..]
            .iter()
            .any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err("terminal_temporary_parent_invalid");
    }
    Ok(path)
}
