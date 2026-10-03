//! Host終端記録の同一実体への書込みと非置換公開を所有する。
//!
//! @responsibility 私有する同期handleと親chainを保持し、既発行Effectと確認済み結果を分ける。公開Protocol・回収Authorityは提供しない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use super::*;
use std::path::Component;
use windows_sys::Wdk::Storage::FileSystem::{
    FILE_LINK_INFORMATION, FileLinkInformation, NtSetInformationFile,
};
use windows_sys::Win32::Foundation::{STATUS_PENDING, WAIT_OBJECT_0};
use windows_sys::Win32::Storage::FileSystem::{
    CREATE_NEW, FILE_BEGIN, FlushFileBuffers, GetFileSizeEx, ReadFile, SetFilePointerEx, WriteFile,
};
use windows_sys::Win32::System::IO::IO_STATUS_BLOCK;
use windows_sys::Win32::System::Threading::{INFINITE, WaitForSingleObject};

const MAX_RECORD_BYTES: usize = 8192;

/// 同じ参照の作成・書込み・公開要求と確認を区別する。
///
/// @responsibility 失敗後にも発行済み処置を保持する。
/// @trace ARCH-000008
/// @shape 参照、各処置の発行、公開名guard取得、公開照合、二handleと総合終了の確認。
/// @invariant 発行済みの値を未発行へ戻さず、公開照合を回復成功にしない。
/// @boundary 私有Native記録処理→呼出し元の耐久接続。
/// @security 参照は非Authorityであり秘密値を持たない。
/// @compatibility 既存の三field Protocol Identityとは相互変換しない内部型。
#[derive(Clone, Debug, Eq, PartialEq)]
struct TerminalReceipt {
    reference: String,
    stage_created: bool,
    write_issued: bool,
    flush_issued: bool,
    link_issued: bool,
    public_guard_acquired: bool,
    link_verified: bool,
    public_guard_close_confirmed: Option<bool>,
    stage_handle_close_confirmed: Option<bool>,
    handle_close_confirmed: Option<bool>,
}

/// 失敗理由とその時点の発行済み処置を保持する。
///
/// @responsibility 作成後失敗を処置前拒否へ畳まない。
/// @trace ARCH-000008
/// @shape 固定理由と同じ参照のreceipt。
/// @invariant reasonは生のOS出力やPathではなく閉じた診断値。
/// @boundary Native内部→将来のCoordinator Adapter。
/// @security Authority、元Task Token、削除許可を含めない。
/// @compatibility 公開Protocolへの接続は別の未成立条件。
#[derive(Debug)]
struct TerminalFailure {
    reason: &'static str,
    receipt: TerminalReceipt,
}

/// 記録Directoryとその全祖先を保持する。
///
/// @responsibility Pathの祖先差替えを防ぎ、最後のDirectoryの保護と実体を固定する。
/// @trace ARCH-000011
/// @shape 一意所有handle集合、最終Directory Identity、選択利用者とSYSTEM SID。
/// @invariant Directory保持だけをchildの書込み防止または非使用証明にしない。
/// @boundary Windows local diskの内部部品。任意Pathの公開入口ではない。
/// @security 最終Directoryのownerとprotected二ACEを確認する。固定OS namespaceとAuthorityは上位Ownerの責務。
/// @compatibility 五fieldと属性の内部Identityを使用し、Node metadataと同一視しない。
struct TerminalDirectory {
    path: PathBuf,
    handles: Vec<OwnedHandle>,
    identity: DirectoryIdentity,
    user: Vec<u8>,
    system: Vec<u8>,
    close_confirmed: Option<bool>,
}

/// CREATE_NEWで作った同期記録fileを保持する。
///
/// @responsibility 書込みから公開照合まで同じfile objectを保持する。
/// @trace ARCH-000008
/// @shape 親借用、stage handle、追加公開名のread guard、参照由来の二名、五field Identity、単調receipt。
/// @invariant handleを外へ出さず、stageのshareREADと同期modeを変更しない。公開照合前に公開名guardを取得する。
/// @boundary Windows記録部品。唯一の現在consumerは自己生成fixture。
/// @security DELETE accessはlinkの内部前提であり公開削除Authorityではない。
/// @compatibility stage除去・caller耐久接続・公開Native Protocolは未接続。
struct TerminalStage<'a> {
    directory: &'a TerminalDirectory,
    handle: OwnedHandle,
    public_handle: Option<OwnedHandle>,
    stage_name: String,
    public_name: String,
    identity: DirectoryIdentity,
    receipt: TerminalReceipt,
}

/// 私有handleの終了を一回明示確認する。
///
/// @responsibility Dropの試行を終了成功と扱わない。
/// @trace ARCH-000011
/// @input 一意所有の有効handle。
/// @returns CloseHandleが成功した場合だけtrue。
/// @precondition 呼出し元は保留I/Oの実終端を確認している。
/// @postcondition 成功時だけ所有slotを空にする。
/// @effect 対象handleへCloseHandleを発行する。
/// @failure 不正slotまたはOS失敗はfalse。
/// @invariant 失敗を後のDropで成功へ上書きしない。
/// @boundary Native→Windows handle API。
/// @security 別handleへ解放を拡張しない。
/// @concurrency 一意所有者の同期処理。
fn close_terminal_handle(handle: &mut OwnedHandle) -> bool {
    if handle.0.is_null() || handle.0 == INVALID_HANDLE_VALUE {
        return false;
    }
    // SAFETY: caller owns this handle and no request is pending.
    if unsafe { CloseHandle(handle.0) } == 0 {
        return false;
    }
    handle.0 = null_mut();
    true
}

/// 同期・非reparse観測handleを固定共有modeで開く。
///
/// @responsibility Pathを観測する私有handleを一意所有へ移す。
/// @trace ARCH-000011
/// @input 内部で固定したPath、access、share。
/// @returns 私有handleまたは固定失敗。
/// @precondition 公開入力を直接渡さず、親chainまたはfixture境界を確認する。
/// @postcondition OVERLAPPEDとhandle継承を有効にしない。
/// @effect 読取りまたは保持handleを取得する。file作成はしない。
/// @failure 不正Path、open失敗は停止する。
/// @invariant reparse対象を追従して保証を出さない。
/// @boundary Native→CreateFileW。
/// @security 生PathやOS errorを公開しない。
/// @concurrency 固定shareが既存openと両方向に互換である場合だけ成功。
fn open_terminal_handle(path: &Path, access: u32, share: u32) -> Result<OwnedHandle, &'static str> {
    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    if wide.is_empty() || wide.len() >= 32767 || wide.contains(&0) {
        return Err("terminal_path_invalid");
    }
    wide.push(0);
    // SAFETY: bounded NUL-terminated path, synchronous flags, immediate ownership.
    let handle = unsafe {
        CreateFileW(
            wide.as_ptr(),
            access,
            share,
            null(),
            OPEN_EXISTING,
            FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err("terminal_open_failed");
    }
    Ok(OwnedHandle(handle))
}

/// 私有handleの五fieldと属性を読み取る。
///
/// @responsibility 明示実体と観測不能を区別する。
/// @trace ARCH-000011
/// @input 継続保持する同期handle。
/// @returns creation timeを含むIdentityまたは固定失敗。
/// @precondition handleの所有者が生存を保証する。
/// @postcondition reparse属性を受理しない。
/// @effect 読取りだけで対象を変更しない。
/// @failure 情報取得不能またはreparseで停止。
/// @invariant 三field Protocol Identityへの縮約をしない。
/// @boundary Native→GetFileInformationByHandle。
/// @security IdentityからAuthorityを発行しない。
/// @concurrency 保持handleの実体を観測する。
fn terminal_identity(handle: HANDLE) -> Result<DirectoryIdentity, &'static str> {
    let information = root_information(handle).ok_or("terminal_identity_unknown")?;
    if information.dwFileAttributes & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
        return Err("terminal_reparse_rejected");
    }
    Ok(directory_identity(&information))
}

/// ownerとprotected二ACEを同じhandleから確認する。
///
/// @responsibility 最終Directory/fileの保護を明示観測し、mode値で代替しない。
/// @trace ARCH-000011
/// @input 保持handleと取得済みの利用者/SYSTEM SID。
/// @returns 完全一致か固定失敗。
/// @precondition READ_CONTROLを持つ有効handle。
/// @postcondition descriptorの明示freeも確認する。
/// @effect security descriptorを読取り、観測用memoryを解放する。
/// @failure owner、ACE、protected不一致または観測/free不明で停止。
/// @invariant ACL一致を別主体への完全防御や非使用証明にしない。
/// @boundary Native→Windows ACL API。
/// @security WRITE_DAC/owner変更への連続防御は別の未保証条件。
/// @concurrency 処置の前後でfreshに再観測する。
fn verify_terminal_protection(
    handle: HANDLE,
    user: &[u8],
    system: &[u8],
) -> Result<(), &'static str> {
    let mut descriptor = security_descriptor(handle).ok_or("terminal_descriptor_unknown")?;
    let result = (|| {
        let mut owner = null_mut();
        let mut defaulted = 0;
        let mut control = 0;
        let mut revision = 0;
        let mut present = 0;
        let mut dacl = null_mut();
        // SAFETY: descriptor is owned and every output is writable local storage.
        if unsafe { GetSecurityDescriptorOwner(descriptor.0, &mut owner, &mut defaulted) } == 0
            || defaulted != 0
            || copy_sid_bytes(owner).as_deref() != Some(user)
            || unsafe { GetSecurityDescriptorControl(descriptor.0, &mut control, &mut revision) }
                == 0
            || control & SE_DACL_PROTECTED == 0
            || unsafe {
                GetSecurityDescriptorDacl(descriptor.0, &mut present, &mut dacl, &mut defaulted)
            } == 0
            || present == 0
            || dacl.is_null()
            || defaulted != 0
        {
            return Err("terminal_descriptor_mismatch");
        }
        let mut information = ACL_SIZE_INFORMATION::default();
        // SAFETY: OS-returned DACL and sized local output.
        if unsafe {
            GetAclInformation(
                dacl,
                (&raw mut information).cast(),
                size_of::<ACL_SIZE_INFORMATION>() as u32,
                AclSizeInformation,
            )
        } == 0
            || information.AceCount != 2
        {
            return Err("terminal_ace_count_mismatch");
        }
        for (index, expected) in [user, system].into_iter().enumerate() {
            let mut raw = null_mut();
            // SAFETY: bounded index in the observed ACL.
            if unsafe { GetAce(dacl, index as u32, &mut raw) } == 0 || raw.is_null() {
                return Err("terminal_ace_unknown");
            }
            // SAFETY: GetAce returned an ACE header; inspect length before larger access.
            let header = unsafe { &*raw.cast::<windows_sys::Win32::Security::ACE_HEADER>() };
            let length = usize::from(header.AceSize);
            if header.AceType != ACCESS_ALLOWED_ACE_TYPE
                || header.AceFlags != 0
                || length < size_of::<ACCESS_ALLOWED_ACE>()
            {
                return Err("terminal_ace_shape_mismatch");
            }
            // SAFETY: type and bounded ACE length were checked.
            if unsafe { (*raw.cast::<ACCESS_ALLOWED_ACE>()).Mask } != FILE_ALL_ACCESS
                || bounded_ace_sid(
                    raw.cast(),
                    length,
                    std::mem::offset_of!(ACCESS_ALLOWED_ACE, SidStart),
                )
                .as_deref()
                    != Some(expected)
            {
                return Err("terminal_ace_access_mismatch");
            }
        }
        Ok(())
    })();
    // SAFETY: uniquely owned allocation from GetSecurityInfo.
    if !unsafe { LocalFree(descriptor.0.cast()) }.is_null() {
        return Err("terminal_descriptor_free_unknown");
    }
    descriptor.0 = null_mut();
    result
}

/// protected owner/二ACEのdescriptorを生成し、同期の作成へ借用する。
///
/// @responsibility Descriptor/SID/ACLの全storageを作成APIの返却まで保持する。
/// @trace ARCH-000011
/// @input 取得済み二SIDと一回の内部作成closure。
/// @returns closureの実返却またはdescriptor作成失敗。
/// @precondition SIDはWindowsから検証済みで、closureはpointerを保持しない。
/// @postcondition 継承を禁止し、ownerとDACLを作成時から設定する。
/// @effect closureが発行した作成だけ。Descriptor構築は局所memory。
/// @failure 構築失敗ではclosureを実行しない。
/// @invariant 後付けACLで作成時の無保護時間を隠さない。
/// @boundary 私有記録作成→Windows Security/Create API。
/// @security 利用者とSYSTEMの非継承full-control二ACEだけ。
/// @concurrency memoryを他threadへ渡さない同期借用。
fn with_terminal_descriptor<T>(
    user: &[u8],
    system: &[u8],
    effect: impl FnOnce(&SECURITY_ATTRIBUTES) -> Result<T, &'static str>,
) -> Result<T, &'static str> {
    let length = size_of::<ACL>()
        + 2 * (size_of::<ACCESS_ALLOWED_ACE>() - size_of::<u32>())
        + user.len()
        + system.len();
    let mut storage = vec![0_u32; length.div_ceil(size_of::<u32>())];
    let acl = storage.as_mut_ptr().cast::<ACL>();
    let mut descriptor = SECURITY_DESCRIPTOR::default();
    let pointer = (&raw mut descriptor).cast::<c_void>();
    // SAFETY: aligned allocations and OS-validated SID bytes stay live through effect.
    if unsafe { InitializeAcl(acl, length as u32, ACL_REVISION) } == 0
        || unsafe {
            AddAccessAllowedAceEx(
                acl,
                ACL_REVISION,
                0,
                FILE_ALL_ACCESS,
                user.as_ptr().cast_mut().cast(),
            )
        } == 0
        || unsafe {
            AddAccessAllowedAceEx(
                acl,
                ACL_REVISION,
                0,
                FILE_ALL_ACCESS,
                system.as_ptr().cast_mut().cast(),
            )
        } == 0
        || unsafe { InitializeSecurityDescriptor(pointer, 1) } == 0
        || unsafe { SetSecurityDescriptorOwner(pointer, user.as_ptr().cast_mut().cast(), 0) } == 0
        || unsafe { SetSecurityDescriptorDacl(pointer, 1, acl, 0) } == 0
        || unsafe { SetSecurityDescriptorControl(pointer, SE_DACL_PROTECTED, SE_DACL_PROTECTED) }
            == 0
    {
        return Err("terminal_descriptor_creation_failed");
    }
    effect(&SECURITY_ATTRIBUTES {
        nLength: size_of::<SECURITY_ATTRIBUTES>() as u32,
        lpSecurityDescriptor: pointer,
        bInheritHandle: 0,
    })
}

impl TerminalDirectory {
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
    fn open(path: &Path, expected: DirectoryIdentity) -> Result<Self, &'static str> {
        let mut guard = Self {
            path: path.to_path_buf(),
            handles: Vec::new(),
            identity: expected,
            user: Vec::new(),
            system: Vec::new(),
            close_confirmed: None,
        };
        let observed = (|| {
            let (mut primary, mut impersonation) =
                process_tokens().ok_or("terminal_token_unknown")?;
            let user = token_user_sid_bytes(primary.0);
            let system = local_system_sid_bytes();
            let token_closed =
                close_terminal_handle(&mut impersonation) & close_terminal_handle(&mut primary);
            if !token_closed {
                return Err("terminal_token_close_unknown");
            }
            guard.user = user.ok_or("terminal_user_unknown")?;
            guard.system = system.ok_or("terminal_system_unknown")?;
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
            if terminal_identity(handle)? != expected {
                return Err("terminal_directory_identity_mismatch");
            }
            verify_terminal_protection(handle, &guard.user, &guard.system)
        })();
        if let Err(reason) = observed {
            return Err(if guard.close() {
                reason
            } else {
                "terminal_directory_close_unknown"
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
    fn verify(&self) -> Result<(), &'static str> {
        let handle = self.handles.last().ok_or("terminal_directory_closed")?.0;
        if terminal_identity(handle)? != self.identity {
            return Err("terminal_directory_identity_mismatch");
        }
        verify_terminal_protection(handle, &self.user, &self.system)
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
    fn close(&mut self) -> bool {
        if let Some(closed) = self.close_confirmed {
            return closed;
        }
        let mut closed = true;
        for handle in self.handles.iter_mut().rev() {
            if !handle.0.is_null() {
                closed &= close_terminal_handle(handle);
            }
        }
        self.close_confirmed = Some(closed);
        closed
    }
}

/// 参照から二つの単純leafを決定する。
///
/// @responsibility Path、未知文字、別参照を名前へ混入させない。
/// @trace ARCH-000008
/// @input host-terminalとlowercase UUIDv4の参照。
/// @returns stage/public名、または固定失敗。
/// @precondition callerが最初の記録Effect前に同じ非Authority参照を耐久接続する。
/// @postcondition stage末尾は.stage、公開先は.jsonへ一意に決まる。
/// @effect N/A: 局所文字列検査だけ。
/// @failure 形式不一致は作成前に拒否する。
/// @invariant 新しい参照を発行しない。
/// @boundary 内部参照→Native leaf名。
/// @security 参照は権限を含まない。
/// @concurrency N/A: 共有状態を持たない。
fn terminal_names(reference: &str) -> Result<(String, String), &'static str> {
    let uuid = reference
        .strip_prefix("host-terminal.")
        .ok_or("terminal_reference_invalid")?
        .as_bytes();
    if uuid.len() != 36
        || uuid[14] != b'4'
        || !b"89ab".contains(&uuid[19])
        || uuid.iter().enumerate().any(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                *c != b'-'
            } else {
                !c.is_ascii_digit() && !(b'a'..=b'f').contains(c)
            }
        })
    {
        return Err("terminal_reference_invalid");
    }
    Ok((format!("{reference}.stage"), format!("{reference}.json")))
}

impl<'a> TerminalStage<'a> {
    /// bounded文書をCREATE_NEWの私有同期fileへ保存する。
    ///
    /// @responsibility 完全write/flush/readbackを同じfile objectへ結び、途中Effectを保持する。
    /// @trace ARCH-000008
    /// @input 親guard、既知参照、1..8192の検証済み非秘密bytes。
    /// @returns stage guard、または同じ参照/Effect/close確認付き失敗。
    /// @precondition Schema/producer/Authority/容量/caller耐久性は上位Ownerが別に確認する。現在はfixtureだけ。
    /// @postcondition CREATE_NEW・同期・shareREAD・明示DACLを固定する。
    /// @effect stage作成、bounded write、file flush。
    /// @failure 衝突、部分write、進捗0、flush/照合不明は停止し、stageを勝手に削除しない。
    /// @invariant 公開、Root/marker処置、参照再発行を行わない。
    /// @boundary Native→Windows filesystem。
    /// @security handle/Pathを公開せず、作成時からowner/protected二ACE。
    /// @concurrency &mutの一意writerと全親chainを保持する。
    fn create(
        directory: &'a TerminalDirectory,
        reference: &str,
        bytes: &[u8],
    ) -> Result<Self, TerminalFailure> {
        let mut receipt = TerminalReceipt {
            reference: reference.to_owned(),
            stage_created: false,
            write_issued: false,
            flush_issued: false,
            link_issued: false,
            public_guard_acquired: false,
            link_verified: false,
            public_guard_close_confirmed: None,
            stage_handle_close_confirmed: None,
            handle_close_confirmed: None,
        };
        let prepared = (|| {
            let names = terminal_names(reference)?;
            if bytes.is_empty() || bytes.len() > MAX_RECORD_BYTES {
                return Err("terminal_bytes_invalid");
            }
            directory.verify()?;
            Ok(names)
        })();
        let (stage_name, public_name) = prepared.map_err(|reason| TerminalFailure {
            reason,
            receipt: receipt.clone(),
        })?;
        let path = directory.path.join(&stage_name);
        let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        wide.push(0);
        let created = with_terminal_descriptor(&directory.user, &directory.system, |attributes| {
            // SAFETY: verified held ancestor chain, generated leaf, live explicit descriptor.
            let handle = unsafe {
                CreateFileW(
                    wide.as_ptr(),
                    FILE_GENERIC_READ | FILE_GENERIC_WRITE | DELETE,
                    FILE_SHARE_READ,
                    attributes,
                    CREATE_NEW,
                    FILE_FLAG_OPEN_REPARSE_POINT,
                    null_mut(),
                )
            };
            if handle == INVALID_HANDLE_VALUE {
                return Err("terminal_stage_create_failed");
            }
            Ok(OwnedHandle(handle))
        })
        .map_err(|reason| TerminalFailure {
            reason,
            receipt: receipt.clone(),
        })?;
        receipt.stage_created = true;
        let mut stage = Self {
            directory,
            handle: created,
            public_handle: None,
            stage_name,
            public_name,
            identity: directory.identity,
            receipt,
        };
        let stored = (|| {
            stage.identity = terminal_identity(stage.handle.0)?;
            if stage.identity.attributes & FILE_ATTRIBUTE_DIRECTORY != 0 {
                return Err("terminal_stage_not_file");
            }
            verify_terminal_protection(stage.handle.0, &directory.user, &directory.system)?;
            let mut offset = 0;
            while offset < bytes.len() {
                let mut written = 0;
                stage.receipt.write_issued = true;
                // SAFETY: synchronous owned handle, bounded slice/output and no overlapped request.
                if unsafe {
                    WriteFile(
                        stage.handle.0,
                        bytes[offset..].as_ptr(),
                        (bytes.len() - offset) as u32,
                        &mut written,
                        null_mut(),
                    )
                } == 0
                    || written == 0
                    || written as usize > bytes.len() - offset
                {
                    return Err("terminal_write_unconfirmed");
                }
                offset += written as usize;
            }
            stage.receipt.flush_issued = true;
            // SAFETY: same synchronous handle has write access; return is observed separately.
            if unsafe { FlushFileBuffers(stage.handle.0) } == 0 {
                return Err("terminal_flush_unconfirmed");
            }
            if read_terminal_bytes(stage.handle.0)? != bytes {
                return Err("terminal_bytes_mismatch");
            }
            stage.verify_identity()?;
            directory.verify()
        })();
        if let Err(reason) = stored {
            stage.close();
            return Err(TerminalFailure {
                reason,
                receipt: stage.receipt.clone(),
            });
        }
        Ok(stage)
    }

    /// 同じ保持fileに同Directoryの非置換linkを追加し、二名を照合する。
    ///
    /// @responsibility 公開要求と公開照合を別receiptにする。
    /// @trace ARCH-000008
    /// @input 自己所有stageと作成時と同じ期待bytes。
    /// @returns 完全照合か同じ参照/発行済み処置付き失敗。
    /// @precondition stage同期handle/親chain生存、caller側の同じ参照と容量予約が有効。
    /// @postcondition class11/ReplaceIfExists=false/同Directoryの単純leafのみ。公開名read guardはshareREAD|WRITEでDELETE shareを与えない。
    /// @effect exact fileへのlink作成を一回要求し、二名をreadbackする。
    /// @failure NTSTATUS、close、Identity/bytes不明は失敗。別名再発行や削除をしない。
    /// @invariant stageの除去とRoot/marker処置は実装しない。公開名guard取得前のgapを成功や連続した名前保護へ昇格しない。
    /// @boundary Native→NtSetInformationFile/Windows file readback。
    /// @security 置換/Ex/POSIX/Bypassを使わず既存公開先を上書きしない。
    /// @concurrency 同期handleとrequest memoryを実終端まで保持する。
    fn publish(&mut self, bytes: &[u8]) -> Result<(), TerminalFailure> {
        let result = (|| {
            if self.receipt.link_issued {
                return Err("terminal_link_already_issued");
            }
            self.directory.verify()?;
            self.verify_identity()?;
            if read_terminal_bytes(self.handle.0)? != bytes {
                return Err("terminal_bytes_mismatch");
            }
            let name: Vec<u16> = self.public_name.encode_utf16().collect();
            let offset = std::mem::offset_of!(FILE_LINK_INFORMATION, FileName);
            let length = offset
                .checked_add(
                    name.len()
                        .checked_mul(2)
                        .ok_or("terminal_link_size_invalid")?,
                )
                .ok_or("terminal_link_size_invalid")?
                .max(size_of::<FILE_LINK_INFORMATION>());
            let mut storage = vec![0_usize; length.div_ceil(size_of::<usize>())];
            let pointer = storage.as_mut_ptr().cast::<FILE_LINK_INFORMATION>();
            // SAFETY: usize alignment satisfies HANDLE/LONG alignment; zero allocation is large enough.
            unsafe {
                (*pointer).Anonymous.ReplaceIfExists = false;
                (*pointer).RootDirectory = null_mut();
                (*pointer).FileNameLength = (name.len() * 2) as u32;
                std::ptr::copy_nonoverlapping(
                    name.as_ptr(),
                    storage.as_mut_ptr().cast::<u8>().add(offset).cast::<u16>(),
                    name.len(),
                );
            }
            let mut io_status = IO_STATUS_BLOCK::default();
            self.receipt.link_issued = true;
            // SAFETY: private synchronous source handle; simple leaf resolves in its existing directory.
            // Buffer and IO_STATUS stay alive through any unexpected pending completion.
            let status = unsafe {
                NtSetInformationFile(
                    self.handle.0,
                    &mut io_status,
                    pointer.cast(),
                    length as u32,
                    FileLinkInformation,
                )
            };
            let completion = if status == STATUS_PENDING {
                // SAFETY: same request/handle are held; no hard OS-I/O deadline is claimed.
                if unsafe { WaitForSingleObject(self.handle.0, INFINITE) } != WAIT_OBJECT_0 {
                    std::process::abort();
                }
                // SAFETY: signalled I/O handle has completed its only request.
                let completed = unsafe { io_status.Anonymous.Status };
                if completed == STATUS_PENDING {
                    std::process::abort();
                }
                completed
            } else {
                status
            };
            if completion != 0 {
                return Err("terminal_link_not_verified");
            }
            // Publication is still provisional. Original shareREAD protects bytes,
            // but does not by itself prove protection of this added link name.
            // Existing writer needs shareWRITE in this new reader's sharing mode.
            let public_guard = open_terminal_handle(
                &self.directory.path.join(&self.public_name),
                FILE_GENERIC_READ | READ_CONTROL,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
            )?;
            self.public_handle = Some(public_guard);
            self.receipt.public_guard_acquired = true;
            let public_handle = self.public_handle.as_ref().unwrap().0;
            if terminal_identity(public_handle)? != self.identity {
                return Err("terminal_public_guard_identity_mismatch");
            }
            verify_terminal_protection(
                public_handle,
                &self.directory.user,
                &self.directory.system,
            )?;
            if read_terminal_bytes(public_handle)? != bytes {
                return Err("terminal_public_guard_bytes_mismatch");
            }
            for name in [&self.stage_name, &self.public_name] {
                let mut reader = open_terminal_handle(
                    &self.directory.path.join(name),
                    FILE_GENERIC_READ | READ_CONTROL,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                )?;
                let observed = (|| {
                    if terminal_identity(reader.0)? != self.identity {
                        return Err("terminal_link_identity_mismatch");
                    }
                    verify_terminal_protection(
                        reader.0,
                        &self.directory.user,
                        &self.directory.system,
                    )?;
                    if read_terminal_bytes(reader.0)? != bytes {
                        return Err("terminal_link_bytes_mismatch");
                    }
                    Ok(())
                })();
                if !close_terminal_handle(&mut reader) {
                    return Err("terminal_reader_close_unknown");
                }
                observed?;
            }
            self.verify_identity()?;
            self.directory.verify()?;
            self.receipt.link_verified = true;
            Ok(())
        })();
        result.map_err(|reason| TerminalFailure {
            reason,
            receipt: self.receipt.clone(),
        })
    }

    /// 保持fileの実体と保護を再確認する。
    ///
    /// @responsibility 同じfileへのwrite/link/readbackの相関を確認する。
    /// @trace ARCH-000011
    /// @input 私有stage。
    /// @returns 一致または固定失敗。
    /// @precondition stageが有効handleを一意保持中。
    /// @postcondition 不明を一致にしない。
    /// @effect read-only観測。
    /// @failure Identity/属性/保護不一致で停止。
    /// @invariant 観測結果からAuthorityを発行しない。
    /// @boundary Native→Identity/ACL。
    /// @security close後の不変性を主張しない。
    /// @concurrency &mut writerと同時実行しない。
    fn verify_identity(&self) -> Result<(), &'static str> {
        if terminal_identity(self.handle.0)? != self.identity {
            return Err("terminal_stage_identity_mismatch");
        }
        verify_terminal_protection(self.handle.0, &self.directory.user, &self.directory.system)
    }

    /// 記録handleの終了を単調に保存する。
    ///
    /// @responsibility 解放失敗後の再試行を成功oracleにしない。
    /// @trace ARCH-000011
    /// @input 一意所有stage。
    /// @returns 初回終了確認の値。
    /// @precondition 保留I/Oの実終端を確認済み。
    /// @postcondition 二handleそれぞれの成功/unknownと総合値をreceiptへ保持する。
    /// @effect 初回だけ公開名guard→stageの順にCloseHandleを発行する。前段失敗でも後段を試行する。
    /// @failure unknownはfalseのまま保持する。
    /// @invariant stage/public名を削除しない。
    /// @boundary Native→CloseHandle。
    /// @security 削除・元Task再開を許可しない。
    /// @concurrency 一意所有者だけが呼ぶ。
    fn close(&mut self) -> bool {
        if let Some(closed) = self.receipt.handle_close_confirmed {
            return closed;
        }
        let public_closed = if let Some(handle) = self.public_handle.as_mut() {
            let closed = close_terminal_handle(handle);
            self.receipt.public_guard_close_confirmed = Some(closed);
            closed
        } else {
            true
        };
        let stage_closed = close_terminal_handle(&mut self.handle);
        self.receipt.stage_handle_close_confirmed = Some(stage_closed);
        let closed = public_closed & stage_closed;
        self.receipt.handle_close_confirmed = Some(closed);
        closed
    }
}

/// 同期handleからboundedな長さと全bytesを読み取る。
///
/// @responsibility 部分read、進捗0、余分なbytesを完全記録へ畳まない。
/// @trace ARCH-000008
/// @input 一意に借用する同期file handle。
/// @returns 1..8192bytesまたは固定失敗。
/// @precondition 呼出し元はhandleと書込み/削除防止を保持する。
/// @postcondition EOFと実長の一致を確認する。
/// @effect file位置を移動して読取る。file内容の変更0。
/// @failure OS失敗、不正長、部分read、EOF不一致は停止。
/// @invariant lengthだけを完全bytesの代替にしない。
/// @boundary Native→GetFileSizeEx/SetFilePointerEx/ReadFile。
/// @security bytesを外部出力しない。
/// @concurrency file位置を他の処理と共有しない。
fn read_terminal_bytes(handle: HANDLE) -> Result<Vec<u8>, &'static str> {
    let mut length = 0_i64;
    // SAFETY: synchronous handle, valid local output, bounded allocation follows.
    if unsafe { GetFileSizeEx(handle, &mut length) } == 0
        || length <= 0
        || length > MAX_RECORD_BYTES as i64
    {
        return Err("terminal_length_invalid");
    }
    if unsafe { SetFilePointerEx(handle, 0, null_mut(), FILE_BEGIN) } == 0 {
        return Err("terminal_seek_failed");
    }
    let mut bytes = vec![0; length as usize];
    let mut offset = 0;
    while offset < bytes.len() {
        let mut read = 0;
        // SAFETY: bounded writable slice, synchronous handle, no OVERLAPPED.
        if unsafe {
            ReadFile(
                handle,
                bytes[offset..].as_mut_ptr(),
                (bytes.len() - offset) as u32,
                &mut read,
                null_mut(),
            )
        } == 0
            || read == 0
            || read as usize > bytes.len() - offset
        {
            return Err("terminal_read_unconfirmed");
        }
        offset += read as usize;
    }
    let mut extra = 0_u8;
    let mut read = 0;
    // SAFETY: one-byte local output and synchronous request.
    if unsafe { ReadFile(handle, &mut extra, 1, &mut read, null_mut()) } == 0 || read != 0 {
        return Err("terminal_eof_unconfirmed");
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    const REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3001";
    const COLLISION_REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3002";
    const UNUSED_REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3003";
    const RUN: &str = "publication.261003.219b9b53.r3";
    const PARENT: &str =
        "C:/project/CRDD/.crdd/verification/chg-000082-terminal-publication-261003";

    /// fixture名をNativeでread-only再観測し明示closeする。
    ///
    /// @responsibility 未観測を不存在またはIdentity一致へ畳まない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 固定run親と自己生成対象だけを渡す。
    /// @stimulus 観測handleを取得する。
    /// @observation 五field、属性、CloseHandle。
    /// @oracle 観測とcloseの両方が成功。
    /// @cleanup 観測handleを一回明示closeする。
    /// @boundary 試験→Windows metadata。
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

    /// 保護済み衝突先だけを試験の前提として作る。
    ///
    /// @responsibility Native公開処理を別実装で検証せず、既存先の不変性を独立oracleにする。
    /// @trace ERB-IT-002
    /// @precondition 自己生成guardと閉じた参照由来のpublic名を使う。
    /// @stimulus CREATE_NEW、既知fixture bytes書込み、flush、close。
    /// @observation 実体、全bytes、close返却。
    /// @oracle 完全な衝突先の生成だけが成立。
    /// @cleanup 作成対象はfixture終端まで保持し、ここでは削除しない。
    /// @boundary 試験→Windows filesystem。
    fn create_collision_fixture(
        directory: &TerminalDirectory,
        public_name: &str,
        closes: &mut Vec<(&'static str, bool)>,
    ) -> DirectoryIdentity {
        let path = directory.path.join(public_name);
        let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        wide.push(0);
        let mut handle =
            with_terminal_descriptor(&directory.user, &directory.system, |attributes| {
                // SAFETY: exact generated fixture name under its held parent.
                let created = unsafe {
                    CreateFileW(
                        wide.as_ptr(),
                        FILE_GENERIC_READ | FILE_GENERIC_WRITE,
                        FILE_SHARE_READ,
                        attributes,
                        CREATE_NEW,
                        FILE_FLAG_OPEN_REPARSE_POINT,
                        null_mut(),
                    )
                };
                if created == INVALID_HANDLE_VALUE {
                    return Err("fixture_collision_create_failed");
                }
                Ok(OwnedHandle(created))
            })
            .unwrap();
        let mut written = 0;
        // SAFETY: owned synchronous handle, bounded known fixture data.
        assert_ne!(
            unsafe { WriteFile(handle.0, b"prior".as_ptr(), 5, &mut written, null_mut()) },
            0
        );
        assert_eq!(written, 5);
        assert_ne!(unsafe { FlushFileBuffers(handle.0) }, 0);
        verify_terminal_protection(handle.0, &directory.user, &directory.system).unwrap();
        assert_eq!(read_terminal_bytes(handle.0).unwrap(), b"prior");
        let identity = terminal_identity(handle.0).unwrap();
        let closed = close_terminal_handle(&mut handle);
        closes.push(("collision_fixture", closed));
        assert!(closed);
        identity
    }

    /// 保持中の同じfileへのwrite/deleteを明示errorで反証する。
    ///
    /// @responsibility open失敗一般をshare拒否の証明にしない。
    /// @trace ERB-IT-002
    /// @precondition stage guardと親chainが生存中。
    /// @stimulus WRITE/DELETE open、rename、unlink。
    /// @observation 各exact返却とWindows error32。固定段階・OS error・予想外handle closeをcatch外へ残す。
    /// @oracle 全件sharing violationであり追加file変更0。
    /// @cleanup 拒否された要求はhandleを返さない。予想外openは明示closeを記録し、予想外変更では追加処置せず停止する。
    /// @boundary 同一試験Process→Windows filesystem。別Processは今回未検証。
    fn assert_fixture_mutation_rejected(
        path: &Path,
        public: bool,
        phase: &mut &'static str,
        os_error: &mut Option<u32>,
        closes: &mut Vec<(&'static str, bool)>,
        mutation_effect: &mut bool,
    ) {
        let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        wide.push(0);
        let renamed = path.with_extension("renamed");
        *phase = if public {
            "public_destination_absence"
        } else {
            "stage_destination_absence"
        };
        assert_eq!(
            fs::symlink_metadata(&renamed).err().map(|e| e.kind()),
            Some(std::io::ErrorKind::NotFound)
        );
        for access in [FILE_GENERIC_WRITE, DELETE] {
            *phase = match (public, access == DELETE) {
                (false, false) => "stage_write_open",
                (false, true) => "stage_delete_open",
                (true, false) => "public_write_open",
                (true, true) => "public_delete_open",
            };
            // SAFETY: exact held self-created source; no write is issued.
            let handle = unsafe {
                CreateFileW(
                    wide.as_ptr(),
                    access,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                    null(),
                    OPEN_EXISTING,
                    FILE_FLAG_OPEN_REPARSE_POINT,
                    null_mut(),
                )
            };
            if handle != INVALID_HANDLE_VALUE {
                *os_error = None;
                let mut unexpected = OwnedHandle(handle);
                let closed = close_terminal_handle(&mut unexpected);
                closes.push(("unexpected_mutation_open", closed));
                panic!("fixture_mutation_access_unexpected");
            }
            *os_error = Some(unsafe { GetLastError() });
            assert_eq!(*os_error, Some(32));
            *os_error = None;
        }
        *phase = if public {
            "public_remove"
        } else {
            "stage_remove"
        };
        let removed = fs::remove_file(path);
        *mutation_effect |= removed.is_ok();
        *os_error = removed
            .err()
            .and_then(|e| e.raw_os_error())
            .and_then(|e| u32::try_from(e).ok());
        assert_eq!(*os_error, Some(32));
        *phase = if public {
            "public_rename_no_replace"
        } else {
            "stage_rename_no_replace"
        };
        let mut next: Vec<u16> = renamed.as_os_str().encode_wide().collect();
        next.push(0);
        // SAFETY: self-created source and checked sibling; flags0 never replaces an existing target.
        let renamed_ok = unsafe {
            windows_sys::Win32::Storage::FileSystem::MoveFileExW(wide.as_ptr(), next.as_ptr(), 0)
        } != 0;
        *mutation_effect |= renamed_ok;
        *os_error = if renamed_ok {
            None
        } else {
            Some(unsafe { GetLastError() })
        };
        assert!(!renamed_ok);
        assert_eq!(*os_error, Some(32));
        *os_error = None;
    }

    /// 前回停止した自作fixtureを変更せず再読取りする。
    ///
    /// @responsibility 保存・公開後の現在観測と前回実行の失敗原因を区別する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 固定run/cwdと既存自作fixtureだけ。元Identityの継承や削除許可は作らない。
    /// @stimulus 親/三fileをread-onlyで開き、ACL/全既知bytes/二名の同じIdentityを読む。
    /// @observation 固定理由、成功読取り件数、現在Identityの相関、checked-close。
    /// @oracle 三件の現在読取りと全closeだけをobservedとし、前回の保持中保護や実Recoveryを主張しない。
    /// @cleanup 観測handleを明示closeし、fixture名/内容を一切処置しない。
    /// @boundary 固定Native診断→Windows read-only観測。旧三Root/Docker/Providerへ未接続。
    #[test]
    #[ignore = "Read-only diagnosis of the retained self-created fixture"]
    fn terminal_retained_readback_fixture() {
        assert_eq!(
            std::env::var("CRDD_TERMINAL_PUBLICATION_RUN").as_deref(),
            Ok("publication.261003.219b9b53.readback")
        );
        assert_eq!(
            std::env::current_dir().unwrap(),
            Path::new("C:/project/CRDD")
        );
        let root = Path::new(PARENT).join("fixture");
        let mut directory = None;
        let mut closed = true;
        let mut count = 0;
        let mut first = None;
        let mut same_pair = false;
        let mut pair_attributes = false;
        let mut rows = Vec::new();
        let observed = (|| {
            let mut root_reader = open_terminal_handle(
                &root,
                FILE_READ_ATTRIBUTES,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )?;
            let root_id = terminal_identity(root_reader.0);
            closed &= close_terminal_handle(&mut root_reader);
            let guard = TerminalDirectory::open(&root, root_id?)?;
            directory = Some(guard);
            let guard = directory.as_ref().unwrap();
            let (stage, public) = terminal_names(REFERENCE)?;
            let (_, collision) = terminal_names(COLLISION_REFERENCE)?;
            for (index, name) in [&stage, &public, &collision].into_iter().enumerate() {
                let mut reader = open_terminal_handle(
                    &root.join(name),
                    FILE_GENERIC_READ | READ_CONTROL,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                )?;
                let id_observation = terminal_identity(reader.0);
                let protection = verify_terminal_protection(reader.0, &guard.user, &guard.system);
                let bytes_observation = read_terminal_bytes(reader.0);
                let id_packet = match id_observation.as_ref() {
                    Ok(id) => format!(
                        "[{}, {}, {}, {}, {}]",
                        id.volume_serial_number,
                        id.file_index_high,
                        id.file_index_low,
                        id.creation_time_low,
                        id.creation_time_high
                    ),
                    Err(_) => "null".to_owned(),
                };
                let attributes = id_observation
                    .as_ref()
                    .map(|id| id.attributes.to_string())
                    .unwrap_or_else(|_| "null".to_owned());
                let readback = (|| {
                    let id = id_observation?;
                    if id.attributes & FILE_ATTRIBUTE_DIRECTORY != 0 {
                        return Err("retained_not_file");
                    }
                    protection?;
                    let bytes = bytes_observation?;
                    if (index < 2 && bytes != vec![b'x'; MAX_RECORD_BYTES])
                        || (index == 2 && bytes != b"prior")
                    {
                        return Err("retained_bytes_mismatch");
                    }
                    if index == 0 {
                        first = Some(id);
                    } else if index == 1 {
                        pair_attributes = first.map(|prior: DirectoryIdentity| prior.attributes)
                            == Some(id.attributes);
                        same_pair = first.map(|prior| DirectoryIdentity {
                            attributes: 0,
                            ..prior
                        }) == Some(DirectoryIdentity {
                            attributes: 0,
                            ..id
                        });
                        if !same_pair {
                            return Err("retained_pair_identity_mismatch");
                        }
                    } else if first.map(|prior| DirectoryIdentity {
                        attributes: 0,
                        ..prior
                    }) == Some(DirectoryIdentity {
                        attributes: 0,
                        ..id
                    }) {
                        return Err("retained_collision_identity_reused");
                    }
                    Ok(())
                })();
                let reader_closed = close_terminal_handle(&mut reader);
                closed &= reader_closed;
                rows.push(format!(
                    "{{\"item\":{},\"identity\":{},\"attributes\":{},\"reason\":\"{}\",\"readbackVerified\":{},\"closeConfirmed\":{}}}",
                    index, id_packet, attributes, readback.as_ref().err().copied().unwrap_or("none"),
                    readback.is_ok(), reader_closed
                ));
                readback?;
                count += 1;
            }
            guard.verify()
        })();
        if let Some(guard) = directory.as_mut() {
            closed &= guard.close();
        }
        let reason = observed.err().unwrap_or(if closed {
            "none"
        } else {
            "retained_close_unknown"
        });
        let success = reason == "none" && count == 3 && same_pair && closed;
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-retained-readback-fixture\",\"status\":\"{}\",\"reason\":\"{}\",\"readbackCount\":{},\"samePairIdentity\":{},\"pairAttributesEqual\":{},\"items\":[{}],\"checkedClosesConfirmed\":{},\"fixtureRetained\":true,\"freshObservationOnly\":true,\"mutationVerified\":false,\"originalRunFailureIdentified\":false}}",
            if success { "observed" } else { "unconfirmed" },
            reason,
            count,
            same_pair,
            pair_attributes,
            rows.join(","),
            closed
        );
        assert!(success, "retained_readback_unconfirmed");
    }

    /// 既存自作stageだけで保持中の拒否境界を一回診断する。
    ///
    /// @responsibility 各要求の実返却を終端closeと分け、期待外なら後続要求を止める。
    /// @trace ERB-IT-002
    /// @precondition 固定cwd/run、前回read-only観測の五field/属性/全bytes/ACL、改名先直接不存在。
    /// @stimulus 同じ実体をREAD/WRITE/DELETE shareREADで保持し、write-open、DELETE-open、remove、非置換renameを順に一度だけ試す。
    /// @observation 各固定operationの成功/OS error/予想外handle close、最終checked-close。
    /// @oracle 全件error32と全closeだけを限定observedとし、32以外を先に許容しない。
    /// @cleanup closeだけ。期待外の削除/改名成功時も復元、再試行、fixture清掃をしない。
    /// @boundary 自己生成第一stageの限定反証。public名/実Recovery/旧Root/Docker/Providerへ接続しない。
    #[test]
    #[ignore = "One held-stage diagnostic after retained read-only observation"]
    fn terminal_retained_mutation_fixture() {
        assert_eq!(
            std::env::var("CRDD_TERMINAL_PUBLICATION_RUN").as_deref(),
            Ok("publication.261003.219b9b53.mutation")
        );
        assert_eq!(
            std::env::current_dir().unwrap(),
            Path::new("C:/project/CRDD")
        );
        let root = Path::new(PARENT).join("fixture");
        let path = root.join(format!("{REFERENCE}.stage"));
        let renamed = root.join(format!("{REFERENCE}.renamed"));
        let mut directory = None;
        let mut held = None;
        let mut closed = true;
        let mut steps = Vec::new();
        let mut unexpected_effect = false;
        let observed = (|| {
            match fs::symlink_metadata(&renamed) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => (),
                _ => return Err("mutation_destination_not_absent"),
            }
            let mut root_reader = open_terminal_handle(
                &root,
                FILE_READ_ATTRIBUTES,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )?;
            let root_id = terminal_identity(root_reader.0);
            closed &= close_terminal_handle(&mut root_reader);
            directory = Some(TerminalDirectory::open(&root, root_id?)?);
            let guard = directory.as_ref().unwrap();
            held = Some(open_terminal_handle(
                &path,
                FILE_GENERIC_READ | FILE_GENERIC_WRITE | DELETE,
                FILE_SHARE_READ,
            )?);
            let handle = held.as_ref().unwrap().0;
            let expected = DirectoryIdentity {
                volume_serial_number: 1687905628,
                file_index_high: 7405568,
                file_index_low: 3090653,
                creation_time_low: 2471899880,
                creation_time_high: 31281919,
                attributes: 32,
            };
            if terminal_identity(handle)? != expected {
                return Err("mutation_identity_mismatch");
            }
            verify_terminal_protection(handle, &guard.user, &guard.system)?;
            if read_terminal_bytes(handle)? != vec![b'x'; MAX_RECORD_BYTES] {
                return Err("mutation_bytes_mismatch");
            }
            let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
            wide.push(0);
            for (operation, access) in [("write_open", FILE_GENERIC_WRITE), ("delete_open", DELETE)]
            {
                // SAFETY: fixed self-created file and held chain; no write is issued.
                let raw = unsafe {
                    CreateFileW(
                        wide.as_ptr(),
                        access,
                        FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                        null(),
                        OPEN_EXISTING,
                        FILE_FLAG_OPEN_REPARSE_POINT,
                        null_mut(),
                    )
                };
                let success = raw != INVALID_HANDLE_VALUE;
                let error = if success {
                    None
                } else {
                    Some(unsafe { GetLastError() })
                };
                let unexpected_closed = if success {
                    let mut unexpected = OwnedHandle(raw);
                    let value = close_terminal_handle(&mut unexpected);
                    closed &= value;
                    Some(value)
                } else {
                    None
                };
                steps.push(format!(
                    "{{\"operation\":\"{}\",\"success\":{},\"error\":{},\"unexpectedHandleCloseConfirmed\":{}}}",
                    operation, success, error.map(|value| value.to_string()).unwrap_or_else(|| "null".to_owned()),
                    unexpected_closed.map(|value| value.to_string()).unwrap_or_else(|| "null".to_owned())
                ));
                if success || error != Some(32) {
                    return Err("mutation_open_rejection_unexpected");
                }
            }
            let removed = fs::remove_file(&path);
            let remove_success = removed.is_ok();
            unexpected_effect |= remove_success;
            let remove_error = removed.err().and_then(|error| error.raw_os_error());
            steps.push(format!(
                "{{\"operation\":\"remove\",\"success\":{},\"error\":{},\"unexpectedHandleCloseConfirmed\":null}}",
                remove_success, remove_error.map(|value| value.to_string()).unwrap_or_else(|| "null".to_owned())
            ));
            if remove_success || remove_error != Some(32) {
                return Err("mutation_remove_rejection_unexpected");
            }
            // SAFETY: fixed self-created source and generated target; flags0 rejects existing destination.
            // Native no-replace avoids Rust rename's replace-existing semantics in a diagnostic.
            let mut next: Vec<u16> = renamed.as_os_str().encode_wide().collect();
            next.push(0);
            let rename_success = unsafe {
                windows_sys::Win32::Storage::FileSystem::MoveFileExW(
                    wide.as_ptr(),
                    next.as_ptr(),
                    0,
                )
            } != 0;
            let rename_error = if rename_success {
                None
            } else {
                Some(unsafe { GetLastError() })
            };
            unexpected_effect |= rename_success;
            steps.push(format!(
                "{{\"operation\":\"rename_no_replace\",\"success\":{},\"error\":{},\"unexpectedHandleCloseConfirmed\":null}}",
                rename_success, rename_error.map(|value| value.to_string()).unwrap_or_else(|| "null".to_owned())
            ));
            if rename_success || rename_error != Some(32) {
                return Err("mutation_rename_rejection_unexpected");
            }
            if terminal_identity(handle)? != expected
                || read_terminal_bytes(handle)? != vec![b'x'; MAX_RECORD_BYTES]
            {
                return Err("mutation_postcondition_mismatch");
            }
            guard.verify()
        })();
        if let Some(handle) = held.as_mut() {
            closed &= close_terminal_handle(handle);
        }
        if let Some(guard) = directory.as_mut() {
            closed &= guard.close();
        }
        let reason = observed.err().unwrap_or("none");
        let success = reason == "none" && closed && steps.len() == 4 && !unexpected_effect;
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-retained-mutation-fixture\",\"status\":\"{}\",\"reason\":\"{}\",\"steps\":[{}],\"checkedClosesConfirmed\":{},\"unexpectedFilesystemEffectIssued\":{},\"cleanupIssued\":false,\"fixtureRetained\":true,\"fullRecoveryVerified\":false}}",
            if success { "observed" } else { "unconfirmed" },
            reason,
            steps.join(","),
            closed,
            unexpected_effect
        );
        assert!(success, "retained_mutation_unconfirmed");
    }

    /// 同じstage handleの非置換rename候補を一回要求する。
    ///
    /// @responsibility production公開方式を変更せず、class10の実返却を試験へ搬送する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 未公開の自己生成stage、同期RW/DELETE handleと親guardが生存。
    /// @stimulus 同Directoryの閉じたpublic leafへReplaceIfExists=falseでNtSetInformationFileを一回発行する。
    /// @observation 要求発行済みとNTSTATUSを区別し、LastErrorへ読み替えない。
    /// @oracle 候補の受理だけを返し、名前保護・直接不存在・本番成立は呼出し側の別観測。
    /// @cleanup Pending時のmemory/IO_STATUS/handleを実終端まで保持し、待機不能ではabortする。
    /// @boundary 試験内のみ→Windows Native rename。Ex/POSIX/force/bypassは使わない。
    fn request_fixture_rename(stage: &TerminalStage<'_>, issued: &mut bool) -> i32 {
        use windows_sys::Wdk::Storage::FileSystem::{
            FILE_RENAME_INFORMATION, FileRenameInformation,
        };
        assert!(!*issued && !stage.receipt.link_issued && stage.public_handle.is_none());
        let (expected_stage, expected_public) = terminal_names(&stage.receipt.reference).unwrap();
        assert_eq!(stage.stage_name, expected_stage);
        assert_eq!(stage.public_name, expected_public);
        let name: Vec<u16> = expected_public.encode_utf16().collect();
        let length = size_of::<FILE_RENAME_INFORMATION>() + name.len() * 2;
        let mut storage = vec![0_usize; length.div_ceil(size_of::<usize>())];
        let pointer = storage.as_mut_ptr().cast::<FILE_RENAME_INFORMATION>();
        let offset = std::mem::offset_of!(FILE_RENAME_INFORMATION, FileName);
        // SAFETY: zeroed, aligned storage includes SDK struct and the entire UTF-16 leaf.
        unsafe {
            (*pointer).Anonymous.ReplaceIfExists = false;
            (*pointer).RootDirectory = null_mut();
            (*pointer).FileNameLength = (name.len() * 2) as u32;
            std::ptr::copy_nonoverlapping(
                name.as_ptr(),
                storage.as_mut_ptr().cast::<u8>().add(offset).cast::<u16>(),
                name.len(),
            );
        }
        let mut io_status = IO_STATUS_BLOCK::default();
        *issued = true;
        // SAFETY: same private synchronous handle; request storage stays alive until actual completion.
        let status = unsafe {
            NtSetInformationFile(
                stage.handle.0,
                &mut io_status,
                pointer.cast(),
                length as u32,
                FileRenameInformation,
            )
        };
        if status != STATUS_PENDING {
            return status;
        }
        // SAFETY: only this request is pending on the held synchronous handle.
        if unsafe { WaitForSingleObject(stage.handle.0, INFINITE) } != WAIT_OBJECT_0 {
            std::process::abort();
        }
        let completed = unsafe { io_status.Anonymous.Status };
        if completed == STATUS_PENDING {
            std::process::abort();
        }
        completed
    }

    /// 同じwriter保持中の改名候補を自己生成対象だけで反証する。
    ///
    /// @responsibility writerをcloseして名前が消えた結果を連続保護へ昇格しない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 専用run/cwdとfixture-rename-r1の直接不存在をNode Ownerも確認する。
    /// @stimulus 8192bytesのstageを同handleで一回改名し、公開名の四変更拒否と別stageの既存先衝突を観測する。
    /// @observation NTSTATUS、stage直接不存在、fresh五field/ACL/全bytes、個別close、清掃要求数と終了後不存在。
    /// @oracle 元guard保持中の限定観測と全明示close/自作清掃だけで候補observedを返す。
    /// @cleanup 通常Oracleと全close後だけ自作三fileと空Directoryを限定清掃する。失敗後の追加処置0。
    /// @boundary test-only Native候補→Windows。現在のproduction保存契約・旧Root・Docker・Providerは不変。
    #[test]
    #[ignore = "Test-only rename candidate; fixed Node owner required"]
    fn terminal_rename_candidate_fixture() {
        assert_eq!(
            std::env::var("CRDD_TERMINAL_PUBLICATION_RUN").as_deref(),
            Ok("rename.261003.219b9b53.r1")
        );
        assert_eq!(
            std::env::current_dir().unwrap(),
            Path::new("C:/project/CRDD")
        );
        let mut phase = "preflight";
        let mut os_error = None;
        let mut rename_status = None;
        let mut collision_status = None;
        let mut rename_issued = false;
        let mut collision_issued = false;
        let mut stage_absent_held = false;
        let mut closes = Vec::new();
        let mut cleanup_count = 0_u32;
        let mut mutation_effect = false;
        let root = Path::new(PARENT).join("fixture-rename-r1");
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let parent = Path::new(PARENT);
            let parent_id = observe_fixture_identity(parent, &mut closes);
            phase = "fixture_absence";
            assert_eq!(
                fs::symlink_metadata(&root).err().map(|e| e.kind()),
                Some(std::io::ErrorKind::NotFound)
            );
            phase = "tokens";
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            let closed = close_terminal_handle(&mut impersonation);
            closes.push(("token_impersonation", closed));
            let other_closed = close_terminal_handle(&mut primary);
            closes.push(("token_primary", other_closed));
            assert!(closed & other_closed);
            let mut wide: Vec<u16> = root.as_os_str().encode_wide().collect();
            wide.push(0);
            phase = "fixture_create";
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: exact fresh repository-local fixture with held descriptor.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("rename_fixture_directory_create_failed");
                }
                Ok(())
            })
            .unwrap();
            let root_id = observe_fixture_identity(&root, &mut closes);
            phase = "directory_open";
            let mut directory = TerminalDirectory::open(&root, root_id).unwrap();
            let (collision_stage, collision_public) = terminal_names(COLLISION_REFERENCE).unwrap();
            phase = "collision_fixture_create";
            let collision_id = create_collision_fixture(&directory, &collision_public, &mut closes);
            let bytes = vec![b'x'; MAX_RECORD_BYTES];
            phase = "stage_create";
            let mut stage = TerminalStage::create(&directory, REFERENCE, &bytes).unwrap();
            let identity = stage.identity;
            let stage_name = stage.stage_name.clone();
            let public_name = stage.public_name.clone();
            stage.verify_identity().unwrap();
            assert_eq!(read_terminal_bytes(stage.handle.0).unwrap(), bytes);
            phase = "same_handle_rename";
            rename_status = Some(request_fixture_rename(&stage, &mut rename_issued));
            assert_eq!(rename_status, Some(0));
            phase = "stage_absence_while_held";
            directory.verify().unwrap();
            assert_eq!(
                fs::symlink_metadata(root.join(&stage_name))
                    .err()
                    .map(|e| e.kind()),
                Some(std::io::ErrorKind::NotFound)
            );
            stage_absent_held = true;
            phase = "public_readback_while_held";
            let mut reader = open_terminal_handle(
                &root.join(&public_name),
                FILE_GENERIC_READ | READ_CONTROL,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )
            .unwrap();
            let readback = || {
                assert_eq!(terminal_identity(reader.0).unwrap(), identity);
                verify_terminal_protection(reader.0, &directory.user, &directory.system).unwrap();
                assert_eq!(read_terminal_bytes(reader.0).unwrap(), bytes);
            };
            let observed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(readback));
            let closed = close_terminal_handle(&mut reader);
            closes.push(("rename_reader", closed));
            assert!(closed && observed.is_ok());
            stage.verify_identity().unwrap();
            directory.verify().unwrap();
            assert_fixture_mutation_rejected(
                &root.join(&public_name),
                true,
                &mut phase,
                &mut os_error,
                &mut closes,
                &mut mutation_effect,
            );
            phase = "collision_stage_create";
            let mut collision =
                TerminalStage::create(&directory, COLLISION_REFERENCE, b"new").unwrap();
            let collision_stage_id = collision.identity;
            phase = "collision_rename";
            collision_status = Some(request_fixture_rename(&collision, &mut collision_issued));
            assert_eq!(
                collision_status,
                Some(windows_sys::Win32::Foundation::STATUS_OBJECT_NAME_COLLISION)
            );
            assert_eq!(
                observe_fixture_identity(&root.join(&collision_public), &mut closes),
                collision_id
            );
            assert_eq!(fs::read(root.join(&collision_public)).unwrap(), b"prior");
            assert_eq!(
                observe_fixture_identity(&root.join(&collision_stage), &mut closes),
                collision_stage_id
            );
            assert_eq!(read_terminal_bytes(collision.handle.0).unwrap(), b"new");
            phase = "created_names";
            let mut observed_names: Vec<_> = fs::read_dir(&root)
                .unwrap()
                .map(|e| e.unwrap().file_name())
                .collect();
            observed_names.sort();
            let mut expected_names: Vec<_> = [&public_name, &collision_stage, &collision_public]
                .into_iter()
                .map(OsString::from)
                .collect();
            expected_names.sort();
            assert_eq!(observed_names, expected_names);
            phase = "collision_close";
            let closed = collision.close();
            closes.push(("collision_close", closed));
            assert!(closed && collision.receipt.stage_handle_close_confirmed == Some(true));
            phase = "stage_close";
            let closed = stage.close();
            closes.push(("stage_close", closed));
            assert!(closed && stage.receipt.stage_handle_close_confirmed == Some(true));
            assert!(
                stage.public_handle.is_none()
                    && !stage.receipt.link_issued
                    && !stage.receipt.link_verified
            );
            drop(collision);
            drop(stage);
            phase = "directory_close";
            let closed = directory.close();
            closes.push(("directory_close", closed));
            assert!(closed);
            drop(directory);
            phase = "cleanup_file";
            for (name, expected_id, expected_bytes) in [
                (&public_name, identity, bytes.as_slice()),
                (&collision_stage, collision_stage_id, b"new".as_slice()),
                (&collision_public, collision_id, b"prior".as_slice()),
            ] {
                assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
                assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
                let path = root.join(name);
                assert_eq!(observe_fixture_identity(&path, &mut closes), expected_id);
                assert_eq!(fs::read(&path).unwrap(), expected_bytes);
                cleanup_count += 1;
                fs::remove_file(&path).unwrap();
                assert_eq!(
                    fs::symlink_metadata(&path).err().map(|e| e.kind()),
                    Some(std::io::ErrorKind::NotFound)
                );
            }
            assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
            assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
            phase = "cleanup_directory";
            cleanup_count += 1;
            fs::remove_dir(&root).unwrap();
            assert_eq!(
                fs::symlink_metadata(&root).err().map(|e| e.kind()),
                Some(std::io::ErrorKind::NotFound)
            );
            assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
            phase = "complete";
        }));
        let presence = match fs::symlink_metadata(&root) {
            Ok(_) => "present",
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => "absent",
            Err(_) => "unknown",
        };
        let success = outcome.is_ok()
            && presence == "absent"
            && cleanup_count == 4
            && !mutation_effect
            && closes.iter().all(|(_, value)| *value);
        let close_rows: Vec<_> = closes
            .iter()
            .map(|(owner, confirmed)| {
                format!("{{\"owner\":\"{}\",\"confirmed\":{}}}", owner, confirmed)
            })
            .collect();
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-rename-candidate-fixture\",\"status\":\"{}\",\"phase\":\"{}\",\"osError\":{},\"renameNtStatus\":{},\"collisionNtStatus\":{},\"renameIssued\":{},\"collisionRenameIssued\":{},\"stageAbsentWhileHeldVerified\":{},\"maximumBytes\":8192,\"noReplaceVerified\":{},\"heldMutationRejected\":{},\"allCheckedClosesConfirmed\":{},\"closeResults\":[{}],\"cleanupIssuedCount\":{},\"unexpectedMutationEffectIssued\":{},\"fixturePresence\":\"{}\",\"productionIntegrationVerified\":false}}",
            if success { "observed" } else { "unconfirmed" },
            phase,
            os_error
                .map(|v| v.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            rename_status
                .map(|v| v.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            collision_status
                .map(|v| v.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            rename_issued,
            collision_issued,
            stage_absent_held,
            success,
            success,
            if success { "true" } else { "null" },
            close_rows.join(","),
            cleanup_count,
            mutation_effect,
            presence
        );
        assert!(success, "terminal_rename_candidate_unconfirmed");
    }

    /// 自己生成実Windows対象でNative保存・公開primitiveを実行する。
    ///
    /// @responsibility 私有本体を通し、成功/拒否とhandle終端/fixture清掃を別に観測する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition exact cwd、r3 run参照、固定run親をNode Ownerが確認し、fixture-r3は明示不存在。r1/r2残存は変更しない。
    /// @stimulus 8192byte保存/公開、衝突、8193byte/空/不正参照拒否、保持中変更拒否。
    /// @observation 五field、全bytes、protected二ACE、発行receipt、error32、個別close、清掃発行数、現在の不存在/残存/不明。
    /// @oracle 全観測と全close後のfresh照合/清掃/不存在だけで限定observedを出す。Schema/Authority/本番Recoveryは主張しない。
    /// @cleanup 通常Oracleと全close成立後だけ自己生成四fileと空Directoryを一件ずつ処置する。途中失敗では既発行清掃を保持して追加処置0。
    /// @boundary 固定test binary→Windows local filesystem。署名/公開入口/旧Root/Docker/Providerは未接続。
    #[test]
    #[ignore = "Fixed repository-local fixture; run through its Node owner only"]
    fn terminal_publication_fixture() {
        assert_eq!(
            std::env::var("CRDD_TERMINAL_PUBLICATION_RUN").as_deref(),
            Ok(RUN)
        );
        assert_eq!(
            std::env::current_dir().unwrap(),
            Path::new("C:/project/CRDD")
        );
        let mut phase = "preflight";
        let mut os_error = None;
        let mut closes = Vec::new();
        let mut cleanup_count = 0_u32;
        let mut mutation_effect = false;
        let root = Path::new(PARENT).join("fixture-r3");
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let parent = Path::new(PARENT);
            let parent_id = observe_fixture_identity(parent, &mut closes);
            phase = "fixture_absence";
            assert_eq!(
                fs::symlink_metadata(&root).err().map(|e| e.kind()),
                Some(std::io::ErrorKind::NotFound)
            );
            phase = "tokens";
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            let closed = close_terminal_handle(&mut impersonation);
            closes.push(("token_impersonation", closed));
            let other_closed = close_terminal_handle(&mut primary);
            closes.push(("token_primary", other_closed));
            assert!(closed & other_closed);
            let mut wide: Vec<u16> = root.as_os_str().encode_wide().collect();
            wide.push(0);
            phase = "fixture_create";
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: exact self-created fixture directory, explicit descriptor alive.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("fixture_directory_create_failed");
                }
                Ok(())
            })
            .unwrap();
            let root_id = observe_fixture_identity(&root, &mut closes);
            phase = "directory_open";
            let mut directory = TerminalDirectory::open(&root, root_id).unwrap();
            let (collision_stage, collision_public) = terminal_names(COLLISION_REFERENCE).unwrap();
            phase = "collision_fixture_create";
            let collision_id = create_collision_fixture(&directory, &collision_public, &mut closes);
            let bytes = vec![b'x'; MAX_RECORD_BYTES];
            phase = "stage_create";
            let mut stage = TerminalStage::create(&directory, REFERENCE, &bytes).unwrap();
            assert!(
                stage.receipt.stage_created
                    && stage.receipt.write_issued
                    && stage.receipt.flush_issued
            );
            assert!(!stage.receipt.link_issued && !stage.receipt.link_verified);
            phase = "stage_publish";
            stage.publish(&bytes).unwrap();
            assert!(stage.receipt.link_issued && stage.receipt.link_verified);
            assert!(stage.receipt.public_guard_acquired && stage.public_handle.is_some());
            let identity = stage.identity;
            let stage_name = stage.stage_name.clone();
            let public_name = stage.public_name.clone();
            for (public, name) in [(false, &stage_name), (true, &public_name)] {
                assert_fixture_mutation_rejected(
                    &root.join(name),
                    public,
                    &mut phase,
                    &mut os_error,
                    &mut closes,
                    &mut mutation_effect,
                );
            }
            phase = "repeated_publish";
            let repeated = stage.publish(&bytes).unwrap_err();
            assert_eq!(repeated.reason, "terminal_link_already_issued");
            assert_eq!(repeated.receipt, stage.receipt);
            phase = "collision_stage_create";
            let mut collision =
                TerminalStage::create(&directory, COLLISION_REFERENCE, b"new").unwrap();
            let collision_stage_id = collision.identity;
            phase = "collision_publish";
            let rejected = collision.publish(b"new").unwrap_err();
            assert_eq!(rejected.reason, "terminal_link_not_verified");
            assert!(
                rejected.receipt.stage_created
                    && rejected.receipt.link_issued
                    && !rejected.receipt.link_verified
            );
            assert!(!rejected.receipt.public_guard_acquired && collision.public_handle.is_none());
            assert_eq!(
                observe_fixture_identity(&root.join(&collision_public), &mut closes),
                collision_id
            );
            assert_eq!(fs::read(root.join(&collision_public)).unwrap(), b"prior");
            phase = "invalid_input_rejection";
            for (reference, data) in [
                (UNUSED_REFERENCE, vec![0; MAX_RECORD_BYTES + 1]),
                (UNUSED_REFERENCE, Vec::new()),
                ("../invalid", vec![1]),
            ] {
                let failure = TerminalStage::create(&directory, reference, &data)
                    .err()
                    .expect("fixture_preflight_should_fail");
                assert!(
                    !failure.receipt.stage_created
                        && !failure.receipt.write_issued
                        && !failure.receipt.flush_issued
                        && !failure.receipt.link_issued
                );
            }
            phase = "created_names";
            let mut observed_names: Vec<_> = fs::read_dir(&root)
                .unwrap()
                .map(|e| e.unwrap().file_name())
                .collect();
            observed_names.sort();
            let mut expected_names: Vec<_> = [
                &stage_name,
                &public_name,
                &collision_stage,
                &collision_public,
            ]
            .into_iter()
            .map(OsString::from)
            .collect();
            expected_names.sort();
            assert_eq!(observed_names, expected_names);
            phase = "collision_close";
            let closed = collision.close();
            closes.push(("collision_close", closed));
            if let Some(value) = collision.receipt.stage_handle_close_confirmed {
                closes.push(("collision_source_close", value));
            }
            assert!(closed);
            phase = "collision_close";
            let closed = collision.close();
            closes.push(("collision_close", closed));
            assert!(closed);
            assert_eq!(collision.receipt.handle_close_confirmed, Some(true));
            assert_eq!(collision.receipt.stage_handle_close_confirmed, Some(true));
            assert_eq!(collision.receipt.public_guard_close_confirmed, None);
            phase = "stage_close";
            let closed = stage.close();
            closes.push(("stage_close", closed));
            if let Some(value) = stage.receipt.public_guard_close_confirmed {
                closes.push(("stage_public_guard_close", value));
            }
            if let Some(value) = stage.receipt.stage_handle_close_confirmed {
                closes.push(("stage_source_close", value));
            }
            assert!(closed);
            phase = "stage_close";
            let closed = stage.close();
            closes.push(("stage_close", closed));
            assert!(closed);
            assert_eq!(stage.receipt.handle_close_confirmed, Some(true));
            assert_eq!(stage.receipt.stage_handle_close_confirmed, Some(true));
            assert_eq!(stage.receipt.public_guard_close_confirmed, Some(true));
            drop(collision);
            drop(stage);
            phase = "directory_close";
            let closed = directory.close();
            closes.push(("directory_close", closed));
            assert!(closed);
            phase = "directory_close";
            let closed = directory.close();
            closes.push(("directory_close", closed));
            assert!(closed);
            drop(directory);
            phase = "cleanup_file";
            for (name, expected_id, expected_bytes) in [
                (&stage_name, identity, bytes.as_slice()),
                (&public_name, identity, bytes.as_slice()),
                (&collision_stage, collision_stage_id, b"new".as_slice()),
                (&collision_public, collision_id, b"prior".as_slice()),
            ] {
                assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
                assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
                let path = root.join(name);
                assert_eq!(observe_fixture_identity(&path, &mut closes), expected_id);
                assert_eq!(fs::read(&path).unwrap(), expected_bytes);
                cleanup_count += 1;
                fs::remove_file(&path).unwrap();
                assert_eq!(
                    fs::symlink_metadata(&path).err().map(|e| e.kind()),
                    Some(std::io::ErrorKind::NotFound)
                );
            }
            assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
            assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
            phase = "cleanup_directory";
            cleanup_count += 1;
            fs::remove_dir(&root).unwrap();
            assert_eq!(
                fs::symlink_metadata(&root).err().map(|e| e.kind()),
                Some(std::io::ErrorKind::NotFound)
            );
            assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
            phase = "complete";
        }));
        let presence = match fs::symlink_metadata(&root) {
            Ok(_) => "present",
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => "absent",
            Err(_) => "unknown",
        };
        let success = outcome.is_ok()
            && presence == "absent"
            && cleanup_count == 5
            && !mutation_effect
            && closes.iter().all(|(_, value)| *value);
        let close_rows: Vec<_> = closes
            .iter()
            .map(|(owner, confirmed)| {
                format!("{{\"owner\":\"{}\",\"confirmed\":{}}}", owner, confirmed)
            })
            .collect();
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-publication-fixture\",\"status\":\"{}\",\"phase\":\"{}\",\"osError\":{},\"maximumBytes\":8192,\"noReplaceVerified\":{},\"heldMutationRejected\":{},\"allCheckedClosesConfirmed\":{},\"closeResults\":[{}],\"cleanupIssuedCount\":{},\"unexpectedMutationEffectIssued\":{},\"fixturePresence\":\"{}\",\"productionIntegrationVerified\":false,\"stageUnlinkWhileHeldVerified\":false}}",
            if success { "observed" } else { "unconfirmed" },
            phase,
            os_error
                .map(|value| value.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            success,
            success,
            if success { "true" } else { "null" },
            close_rows.join(","),
            cleanup_count,
            mutation_effect,
            presence
        );
        assert!(success, "terminal_publication_unconfirmed");
    }
}
