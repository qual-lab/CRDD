//! Host終端記録の同一実体への書込みと非置換公開を所有する。
//!
//! @responsibility 私有する同期handleと親chainを保持し、既発行Effectと確認済み結果を分ける。公開Protocol・回収Authorityは提供しない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use super::*;
use std::path::Component;
use windows_sys::Wdk::Storage::FileSystem::{
    FILE_RENAME_INFORMATION, FileRenameInformation, NtSetInformationFile,
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
/// @shape 参照、各処置の発行、最終NTSTATUS、stage不存在・public照合とreader/writer終了の確認。
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
    rename_issued: bool,
    rename_nt_status: Option<i32>,
    stage_absence_verified: bool,
    publication_verified: bool,
    reader_close_confirmed: Option<bool>,
    record_handle_close_confirmed: Option<bool>,
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
/// @shape 親借用、唯一のwriter handle、参照由来のstage/public名、五field Identity、単調receipt。
/// @invariant handleを外へ出さず、同じwriterのshareREADと同期modeを公開照合後も維持する。
/// @boundary Windows記録部品。唯一の現在consumerは自己生成fixture。
/// @security DELETE accessはrenameの内部前提であり公開削除Authorityではない。
/// @compatibility 旧hardlink二名の移行、caller耐久接続・公開Native Protocolは未接続。
struct TerminalStage<'a> {
    directory: &'a TerminalDirectory,
    handle: OwnedHandle,
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
            rename_issued: false,
            rename_nt_status: None,
            stage_absence_verified: false,
            publication_verified: false,
            reader_close_confirmed: None,
            record_handle_close_confirmed: None,
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

    /// 同じwriterを保持したまま非置換renameし、公開名を照合する。
    ///
    /// @responsibility rename要求・返却・stage不存在・public相関を別receiptへ保持する。
    /// @trace ARCH-000008
    /// @input 自己所有stageと作成時と同じ期待bytes。
    /// @returns 完全照合、または同じ参照と発行済み処置付き失敗。
    /// @precondition 同期writer/親chain生存、callerの同じ参照と容量予約が有効。
    /// @postcondition class10/ReplaceIfExists=false/同Directoryの単純leafに限定する。
    /// @effect 同handleのrenameを一回要求し、公開名をfresh readbackする。
    /// @failure NTSTATUS、stage存在/観測不能、Identity/bytes、reader close不明で停止する。
    /// @invariant 失敗後の再rename、復元、別参照、清掃とRoot/marker処置をしない。
    /// @boundary Native→NtSetInformationFile/Windows metadata/readback。
    /// @security Ex/POSIX/Bypass/置換を使わず、writerを閉じて名前を収束させない。
    /// @concurrency 同期handleとrequest memoryを実終端まで保持する。不存在は観測時点の事実。
    fn publish(&mut self, bytes: &[u8]) -> Result<(), TerminalFailure> {
        let result = (|| {
            if self.receipt.rename_issued {
                return Err("terminal_rename_already_issued");
            }
            self.directory.verify()?;
            self.verify_identity()?;
            if read_terminal_bytes(self.handle.0)? != bytes {
                return Err("terminal_bytes_mismatch");
            }
            let name: Vec<u16> = self.public_name.encode_utf16().collect();
            let offset = std::mem::offset_of!(FILE_RENAME_INFORMATION, FileName);
            let length = size_of::<FILE_RENAME_INFORMATION>()
                .checked_add(
                    name.len()
                        .checked_mul(2)
                        .ok_or("terminal_rename_size_invalid")?,
                )
                .ok_or("terminal_rename_size_invalid")?;
            let mut storage = vec![0_usize; length.div_ceil(size_of::<usize>())];
            let pointer = storage.as_mut_ptr().cast::<FILE_RENAME_INFORMATION>();
            // SAFETY: aligned, zeroed SDK struct plus the complete bounded UTF-16 leaf.
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
            self.receipt.rename_issued = true;
            // SAFETY: private synchronous handle; simple leaf stays in its existing Directory.
            // Request storage and IO_STATUS stay alive until actual completion.
            let status = unsafe {
                NtSetInformationFile(
                    self.handle.0,
                    &mut io_status,
                    pointer.cast(),
                    length as u32,
                    FileRenameInformation,
                )
            };
            let completion = if status == STATUS_PENDING {
                // SAFETY: same handle owns its only pending request; no hard deadline is claimed.
                if unsafe { WaitForSingleObject(self.handle.0, INFINITE) } != WAIT_OBJECT_0 {
                    std::process::abort();
                }
                // SAFETY: the signalled handle has settled the request.
                let completed = unsafe { io_status.Anonymous.Status };
                if completed == STATUS_PENDING {
                    std::process::abort();
                }
                completed
            } else {
                status
            };
            self.receipt.rename_nt_status = Some(completion);
            if completion != 0 {
                return Err("terminal_rename_not_verified");
            }
            match std::fs::symlink_metadata(self.directory.path.join(&self.stage_name)) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    self.receipt.stage_absence_verified = true;
                }
                Ok(_) => return Err("terminal_stage_still_present"),
                Err(_) => return Err("terminal_stage_absence_unknown"),
            }
            let mut reader = open_terminal_handle(
                &self.directory.path.join(&self.public_name),
                FILE_GENERIC_READ | READ_CONTROL,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )?;
            let observed = (|| {
                if terminal_identity(reader.0)? != self.identity {
                    return Err("terminal_public_identity_mismatch");
                }
                verify_terminal_protection(reader.0, &self.directory.user, &self.directory.system)?;
                if read_terminal_bytes(reader.0)? != bytes {
                    return Err("terminal_public_bytes_mismatch");
                }
                Ok(())
            })();
            let reader_closed = close_terminal_handle(&mut reader);
            self.receipt.reader_close_confirmed = Some(reader_closed);
            if !reader_closed {
                return Err("terminal_reader_close_unknown");
            }
            observed?;
            self.verify_identity()?;
            self.directory.verify()?;
            match std::fs::symlink_metadata(self.directory.path.join(&self.stage_name)) {
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Ok(_) => return Err("terminal_stage_still_present"),
                Err(_) => return Err("terminal_stage_absence_unknown"),
            }
            self.receipt.publication_verified = true;
            Ok(())
        })();
        result.map_err(|reason| TerminalFailure {
            reason,
            receipt: self.receipt.clone(),
        })
    }

    /// 保持fileの実体と保護を再確認する。
    ///
    /// @responsibility 同じfileへのwrite/rename/readbackの相関を確認する。
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
    /// @postcondition 公開照合readerの既知結果とwriterの個別close/総合値をreceiptへ保持する。
    /// @effect 初回だけ唯一のwriterへCloseHandleを発行する。reader不明を総合成功にしない。
    /// @failure unknownはfalseのまま保持する。
    /// @invariant stage/public名を削除しない。
    /// @boundary Native→CloseHandle。
    /// @security 削除・元Task再開を許可しない。
    /// @concurrency 一意所有者だけが呼ぶ。
    fn close(&mut self) -> bool {
        if let Some(closed) = self.receipt.handle_close_confirmed {
            return closed;
        }
        let record_closed = close_terminal_handle(&mut self.handle);
        self.receipt.record_handle_close_confirmed = Some(record_closed);
        let closed = record_closed & self.receipt.reader_close_confirmed.unwrap_or(true);
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

/// 準備名と公開名の現在観測を区別する。
///
/// @responsibility 履歴の要求済み状態を推測せず、唯一存在する名前だけを分類する。
/// @trace ARCH-000008
/// @shape PreparedまたはPublishedの閉じた二状態。
/// @invariant 二名、両不存在および観測不能を成功状態へ含めない。
/// @boundary 私有Native読取り→将来のcaller再入場。
/// @security 状態は削除Authorityや元Task成功を表さない。
/// @compatibility 旧hardlink二名を自動移行しない。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum TerminalObservedState {
    Prepared,
    Published,
}

/// 読取りの取得・失敗・終了を同じ参照へ保持する。
///
/// @responsibility 取得後失敗のclose不明を取得前拒否へ畳まない。
/// @trace ARCH-000008
/// @shape 同じ参照、固定理由、今回open要求/取得と個別closeの確認。
/// @invariant 過去のcreate/write/flush/rename receiptを復元しない。
/// @boundary 私有Native読取り→呼出し元。
/// @security 非Authorityの参照と閉じた理由だけを返す。
/// @compatibility 公開Protocolとcaller耐久接続は未成立。
#[derive(Debug)]
struct TerminalObservationFailure {
    reference: String,
    reason: &'static str,
    open_issued: bool,
    opened: bool,
    close_confirmed: Option<bool>,
}

/// fresh照合済み記録を読取りguardで保持する。
///
/// @responsibility 同じfile objectのIdentity/保護/全bytesを確認し、書込みと削除の共有を拒否する。
/// @trace ARCH-000008
/// @shape Directory借用、参照、現在の名前状態、私有readerと単調close結果。
/// @invariant rename、write、清掃およびAuthority発行を行わない。
/// @boundary Windows内部記録。現在consumerは自己生成fixtureだけ。
/// @security shareREADとACL観測をWRITE_DAC防御や非使用証明へ昇格しない。
/// @compatibility Known入口はcaller既知の五field/属性と独立した期待bytesを必要とする。CurrentCandidateは旧Identityを要求せず今回Identityを返し、両方式とも期待bytesを対象記録自身から生成しない。
struct TerminalObservedRecord<'a> {
    directory: &'a TerminalDirectory,
    reference: String,
    state: TerminalObservedState,
    handle: OwnedHandle,
    close_confirmed: Option<bool>,
}

/// 過去の実体照合と現在候補の観測を区別する。
///
/// @responsibility 現在取得したIdentityを過去の期待Identityへ付け替えない。
/// @trace ARCH-000008
/// @shape caller既知Identity、または現在候補の観測だけ。
/// @invariant CurrentCandidateは元fileの連続性を保証しない。
/// @boundary 私有readerの照合方針。
/// @security Authority、非使用または処置許可を発行しない。
/// @compatibility 既存strict readerはKnownだけを使用する。
#[derive(Clone, Copy)]
enum TerminalIdentityCheck {
    Known(DirectoryIdentity),
    CurrentCandidate,
}

/// 独立保持した内容と一致する現在記録を保持する。
///
/// @responsibility 返却喪失後にも同じ参照の現在実体を観測し、履歴証明とは分離する。
/// @trace ARCH-000008
/// @shape 私有readerと今回観測した五field・属性Identity。
/// @invariant bytes一致を元file連続性、過去receiptまたは清掃成功にしない。
/// @boundary 私有Native観測→限定候補consumer。本番Protocolは未接続。
/// @security callerの完全intentと対象bindingの確認、fresh Authorityと非使用は別責務。
/// @compatibility strict readerへ現在Identityを過去の期待値として渡さない。
struct TerminalCurrentCandidate<'a> {
    record: TerminalObservedRecord<'a>,
    current_identity: DirectoryIdentity,
}

impl<'a> TerminalCurrentCandidate<'a> {
    /// 同じ参照の現在記録を独立した全bytesと照合する。
    ///
    /// @responsibility 名前だけの探索と過去成功の復元を行わず、現在実体を返す。
    /// @trace ARCH-000008
    /// @input 検証済みDirectory guard、caller-known参照、独立保持した1..8192bytes。
    /// @returns 現在候補guard、または同じ参照と今回open・close失敗。
    /// @precondition callerが完全intentのSchema・producer・対象bindingを別に検証する。
    /// @postcondition 唯一名、現在Identity、保護、全bytes、他名不存在と親を確認する。
    /// @effect OPEN_EXISTINGの読取りだけ。作成・公開・復元・清掃は0。
    /// @failure 二名、両不存在、内容・保護・実体不一致、unknownは停止する。
    /// @invariant 現在Identityを旧期待値へ変換せず、履歴receiptを生成しない。
    /// @boundary Native→Windows記録観測。公開回復入口ではない。
    /// @security 同じ利用者とACL一致を元producerのlineageやAuthorityにしない。
    /// @concurrency 保持中はshareREAD。close後の不変性と非使用は保証しない。
    fn open(
        directory: &'a TerminalDirectory,
        reference: &str,
        bytes: &[u8],
    ) -> Result<Self, TerminalObservationFailure> {
        TerminalObservedRecord::open_checked(
            directory,
            reference,
            TerminalIdentityCheck::CurrentCandidate,
            bytes,
        )
        .map(|(record, current_identity)| Self {
            record,
            current_identity,
        })
    }

    /// 今回の候補readerだけを明示closeする。
    ///
    /// @responsibility 最初のclose結果を保持し、候補観測と資源終了を区別する。
    /// @trace ARCH-000011
    /// @input 自己所有する現在候補guard。
    /// @returns 今回readerの最初のclose結果。
    /// @precondition 同期readの実終端済み。
    /// @postcondition falseを後続呼出しでtrueへ変更しない。
    /// @effect 自己所有reader一件のcloseだけ。
    /// @failure close失敗は同じ参照へ保持する。
    /// @invariant 元producerのhandle終了、Root回収または記録清掃を主張しない。
    /// @boundary Native→Windows CloseHandle。
    /// @security 記録名・内容を変更せず、Authorityを発行しない。
    /// @concurrency 一意所有readerの同期終了。
    fn close(&mut self) -> bool {
        self.record.close()
    }
}

/// 直接観測の明示不存在だけをfalseとする。
///
/// @responsibility 不明を空または不存在へ畳まない。
/// @trace ARCH-000011
/// @input 保持Directory内の参照由来leaf。
/// @returns 現在存在ならtrue、明示NotFoundならfalse、その他は固定失敗。
/// @precondition 固定内部名と全親chainを確認済み。
/// @postcondition 観測時点だけの事実を返す。
/// @effect metadataの読取りだけ。
/// @failure 欠測/権限/その他のOS失敗はunknown。
/// @invariant Directory保持を後続child新規作成禁止へ読み替えない。
/// @boundary Native→Windows metadata。
/// @security 任意Pathを公開入力にしない。
/// @concurrency 別名の再観測をhandle取得後にも行う。
fn observe_terminal_presence(path: &Path) -> Result<bool, &'static str> {
    terminal_presence_result(std::fs::symlink_metadata(path))
}

/// metadata失敗を不存在へ畳まない判定を固定する。
///
/// @responsibility OS観測結果の解釈だけを所有する。
/// @trace ARCH-000011
/// @input 実metadataまたはIO error。
/// @returns present、明示不存在またはunknown。
/// @precondition 入力は呼出し元の直接観測結果。
/// @postcondition NotFound以外を不存在にしない。
/// @effect N/A: 局所判定だけ。
/// @failure 不明は固定理由で停止。
/// @invariant 合成入力の試験をOS実故障観測へ昇格しない。
/// @boundary OS観測→内部判定。
/// @security 成功をAuthorityにしない。
/// @concurrency N/A: 共有状態なし。
fn terminal_presence_result(
    observed: std::io::Result<std::fs::Metadata>,
) -> Result<bool, &'static str> {
    match observed {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("terminal_presence_unknown"),
    }
}

impl<'a> TerminalObservedRecord<'a> {
    /// 同じ参照の唯一存在する記録をfresh照合して保持する。
    ///
    /// @responsibility caller既知Identity/bytesへ結合し、cold読取りと履歴/Authorityを分離する。
    /// @trace ARCH-000008
    /// @input Directory guard、既知参照、五field/属性Identity、1..8192の期待bytes。
    /// @returns 私有reader、または同じ参照と今回取得/closeの失敗。
    /// @precondition callerの耐久参照、producer版、Schema/容量/権限は上位が確認する。現在はfixtureのみ。
    /// @postcondition 唯一名、実体、二ACE/owner、全bytes、他名不存在と親をfresh確認する。
    /// @effect OPEN_EXISTINGの読取りhandleとmetadata取得。write/rename/removeは0。
    /// @failure 二名/両なし/unknown、実体/保護/bytes不一致、close不明を保持して停止する。
    /// @invariant 過去の要求/成功を補完せず、別参照/移行/清掃を発行しない。
    /// @boundary Native→Windows file観測。
    /// @security nonreparse、READ|READ_CONTROL、shareREADだけ。名前を削除許可にしない。
    /// @concurrency reader生存中のwrite/delete共有を拒否する。close後不変性は主張しない。
    fn open(
        directory: &'a TerminalDirectory,
        reference: &str,
        expected: DirectoryIdentity,
        bytes: &[u8],
    ) -> Result<Self, TerminalObservationFailure> {
        Self::open_checked(
            directory,
            reference,
            TerminalIdentityCheck::Known(expected),
            bytes,
        )
        .map(|(record, _)| record)
    }

    /// 一つの読取り経路で既知実体照合と現在候補観測を分ける。
    ///
    /// @responsibility 両方式で同じ保護・内容・今回終端確認を維持する。
    /// @trace ARCH-000008
    /// @input Directory guard、同参照、明示照合方針、独立保持した期待bytes。
    /// @returns readerと今回Identity、または同参照の取得・close失敗。
    /// @precondition 既知方針の期待Identityはcaller由来。現在候補をその期待値にしない。
    /// @postcondition 同じ保持実体の前後一致、保護、全bytes、唯一名を確認する。
    /// @effect 読取りhandleとmetadataだけ。write・rename・removeは0。
    /// @failure 入力・名前・実体・保護・内容・close不明を区別して停止する。
    /// @invariant 現在候補の受理から過去write・flush・closeを推定しない。
    /// @boundary 私有Native reader→Windows。
    /// @security 再公開・清掃Authorityを作らない。
    /// @concurrency 保持中shareREAD、親chain借用。未知の別主体との排他は主張しない。
    fn open_checked(
        directory: &'a TerminalDirectory,
        reference: &str,
        check: TerminalIdentityCheck,
        bytes: &[u8],
    ) -> Result<(Self, DirectoryIdentity), TerminalObservationFailure> {
        let mut failure = TerminalObservationFailure {
            reference: reference.to_owned(),
            reason: "terminal_observation_unconfirmed",
            open_issued: false,
            opened: false,
            close_confirmed: None,
        };
        let names = (|| {
            let names = terminal_names(reference)?;
            if bytes.is_empty() || bytes.len() > MAX_RECORD_BYTES {
                return Err("terminal_bytes_invalid");
            }
            directory.verify()?;
            Ok(names)
        })();
        let (stage, public) = match names {
            Ok(names) => names,
            Err(reason) => {
                failure.reason = reason;
                return Err(failure);
            }
        };
        let topology = (|| {
            let stage_present = observe_terminal_presence(&directory.path.join(&stage))?;
            let public_present = observe_terminal_presence(&directory.path.join(&public))?;
            match (stage_present, public_present) {
                (true, false) => Ok((TerminalObservedState::Prepared, &stage, &public)),
                (false, true) => Ok((TerminalObservedState::Published, &public, &stage)),
                (true, true) => Err("terminal_record_two_names"),
                (false, false) => Err("terminal_record_absent"),
            }
        })();
        let (state, selected, other) = match topology {
            Ok(topology) => topology,
            Err(reason) => {
                failure.reason = reason;
                return Err(failure);
            }
        };
        failure.open_issued = true;
        let handle = match open_terminal_handle(
            &directory.path.join(selected),
            FILE_GENERIC_READ | READ_CONTROL,
            FILE_SHARE_READ,
        ) {
            Ok(handle) => handle,
            Err(reason) => {
                failure.reason = reason;
                return Err(failure);
            }
        };
        failure.opened = true;
        let mut observed = Self {
            directory,
            reference: reference.to_owned(),
            state,
            handle,
            close_confirmed: None,
        };
        let verified = (|| {
            let current = terminal_identity(observed.handle.0)?;
            if matches!(check, TerminalIdentityCheck::Known(expected) if current != expected)
                || current.attributes & FILE_ATTRIBUTE_DIRECTORY != 0
            {
                return Err("terminal_observation_identity_mismatch");
            }
            verify_terminal_protection(observed.handle.0, &directory.user, &directory.system)?;
            if read_terminal_bytes(observed.handle.0)? != bytes {
                return Err("terminal_observation_bytes_mismatch");
            }
            if observe_terminal_presence(&directory.path.join(other))? {
                return Err("terminal_record_two_names");
            }
            directory.verify()?;
            if terminal_identity(observed.handle.0)? != current {
                return Err("terminal_observation_identity_mismatch");
            }
            Ok(current)
        })();
        match verified {
            Err(reason) => {
                failure.reason = reason;
                failure.close_confirmed = Some(observed.close());
                Err(failure)
            }
            Ok(identity) => Ok((observed, identity)),
        }
    }

    /// fresh読取りhandleの明示closeを単調保持する。
    ///
    /// @responsibility 履歴producerのhandle終了や清掃へ今回closeを流用しない。
    /// @trace ARCH-000011
    /// @input 一意所有するreader。
    /// @returns 最初のCloseHandle確認。
    /// @precondition 同期readが実終端済み。
    /// @postcondition 同じclose結果を保持する。
    /// @effect 自己所有reader一件だけへCloseHandle。
    /// @failure OS失敗をfalseで保持し、Dropで上書きしない。
    /// @invariant 記録名、内容、元Rootおよびmarkerを変更しない。
    /// @boundary Native→CloseHandle。
    /// @security closeは削除/回復許可を発行しない。
    /// @concurrency 一意所有とDirectory借用の内側だけ。
    fn close(&mut self) -> bool {
        if let Some(closed) = self.close_confirmed {
            return closed;
        }
        let closed = close_terminal_handle(&mut self.handle);
        preserve_terminal_close(&mut self.close_confirmed, closed)
    }
}

/// 最初の終了観測だけを単調保持する。
///
/// @responsibility 既知falseを後続trueやDropで上書きしない。
/// @trace ARCH-000011
/// @input 今回close slotと観測bool。
/// @returns 初回の観測値。
/// @precondition 実closeと合成判定試験を呼出し元が区別する。
/// @postcondition 初回以後slotを変更しない。
/// @effect N/A: 私有slotだけを更新する。
/// @failure falseを同じfalseとして保持する。
/// @invariant slotの値からOS全資源終了を推定しない。
/// @boundary 同じguardの内部結果保持。
/// @security Authorityを発行しない。
/// @concurrency 一意なmutable slot。
fn preserve_terminal_close(slot: &mut Option<bool>, observed: bool) -> bool {
    *slot.get_or_insert(observed)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    const REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3001";
    const COLLISION_REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3002";
    const UNUSED_REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3003";
    const RUN: &str = "publication.261003.219b9b53.r4";
    const PARENT: &str =
        "C:/project/CRDD/.crdd/verification/chg-000082-terminal-publication-261003";

    const COLD_RUN: &str = "cold.261003.219b9b53.r1";
    const COLD_PREPARED: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3004";
    const COLD_PUBLISHED: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3005";
    const COLD_COLLISION: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3006";
    const COLD_DIRECTORY: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3007";
    const COLD_ABSENT: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3008";
    const COLD_BINARY: &str = "C:/project/CRDD/.crdd/verification/chg-000082-terminal-publication-261003/target/x86_64-pc-windows-msvc/debug/deps/crdd_platform_access-d760b2b78c72e216.exe";

    /// 現在候補と過去の既知実体を別の型・Oracleで確認する。
    ///
    /// @responsibility 独立した内容の一致、現在Identity、strict拒否、closeと自作清掃を別に記録する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 固定run/cwd、Node Ownerとfreshなfixture-current-r1。旧fixtureと実残存は対象外。
    /// @stimulus prepared/public観測、二名/不存在/内容/Directory拒否、同bytes別実体と保持中変更拒否。
    /// @observation 今回Identity/名前、個別close、strict旧Identity拒否、清掃発行数と直接不存在。
    /// @oracle 現在候補の成功を履歴receipt/Authority/本番再入場へ昇格しない。全Oracle後だけ限定observed。
    /// @cleanup 全正常Oracleと全closeの後だけfreshな自作六file/空child/空Rootを非再帰清掃。不明で停止。
    /// @boundary 未署名Native自己生成fixture→Windows。Docker/Provider/旧三Rootは0。
    #[test]
    #[ignore = "Fixed current-candidate fixture; explicit Node owner required"]
    fn terminal_current_candidate_fixture() {
        const RUN: &str = "current.261003.73c9d18f.r1";
        const PREPARED: &str = "host-terminal.73c9d18f-6ab5-4e8c-945f-640b56003001";
        const PUBLISHED: &str = "host-terminal.73c9d18f-6ab5-4e8c-945f-640b56003002";
        const COLLISION: &str = "host-terminal.73c9d18f-6ab5-4e8c-945f-640b56003003";
        const REPLACED: &str = "host-terminal.73c9d18f-6ab5-4e8c-945f-640b56003004";
        const DIRECTORY: &str = "host-terminal.73c9d18f-6ab5-4e8c-945f-640b56003005";
        const ABSENT: &str = "host-terminal.73c9d18f-6ab5-4e8c-945f-640b56003006";
        assert_eq!(
            std::env::var("CRDD_TERMINAL_CURRENT_RUN").as_deref(),
            Ok(RUN)
        );
        assert_eq!(
            std::env::current_dir().unwrap(),
            Path::new("C:/project/CRDD")
        );
        let root = Path::new(PARENT).join("fixture-current-r1");
        let bytes = vec![b'c'; MAX_RECORD_BYTES];
        let mut phase = "preflight";
        let mut closes = Vec::new();
        let mut mutation_effect = false;
        let mut os_error = None;
        let mut cleanup_count = 0_u32;
        let mut fresh_reads = 0_u32;
        let mut rejected = 0_u32;
        let mut replacement_distinguished = false;
        let mut fixture_rename_issued = false;
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let parent = Path::new(PARENT);
            let parent_id = observe_fixture_identity(parent, &mut closes);
            assert_eq!(observe_terminal_presence(&root), Ok(false));
            phase = "tokens";
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            closes.push((
                "token_impersonation",
                close_terminal_handle(&mut impersonation),
            ));
            closes.push(("token_primary", close_terminal_handle(&mut primary)));
            assert!(closes.iter().all(|(_, closed)| *closed));
            phase = "create";
            let mut wide: Vec<u16> = root.as_os_str().encode_wide().collect();
            wide.push(0);
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: exact fresh repository-local fixture and live descriptor.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("current_fixture_create_failed");
                }
                Ok(())
            })
            .unwrap();
            let root_id = observe_fixture_identity(&root, &mut closes);
            let mut directory = TerminalDirectory::open(&root, root_id).unwrap();
            let mut records = Vec::new();
            for reference in [PREPARED, PUBLISHED, COLLISION, REPLACED] {
                let mut stage = TerminalStage::create(&directory, reference, &bytes).unwrap();
                if reference == PUBLISHED {
                    stage.publish(&bytes).unwrap();
                }
                records.push((reference, stage.identity));
                closes.push(("stage", stage.close()));
                assert!(closes.iter().all(|(_, closed)| *closed));
            }
            let (collision_stage, collision_public) = terminal_names(COLLISION).unwrap();
            let collision_id = create_collision_fixture(&directory, &collision_public, &mut closes);
            let (directory_name, _) = terminal_names(DIRECTORY).unwrap();
            let child_directory = root.join(&directory_name);
            let mut wide: Vec<u16> = child_directory.as_os_str().encode_wide().collect();
            wide.push(0);
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: exact self-owned fixture child, live descriptor.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("current_fixture_child_create_failed");
                }
                Ok(())
            })
            .unwrap();
            let child_id = observe_fixture_identity(&child_directory, &mut closes);
            phase = "current_read";
            for (reference, identity, state) in [
                (PREPARED, records[0].1, TerminalObservedState::Prepared),
                (PUBLISHED, records[1].1, TerminalObservedState::Published),
            ] {
                let mut candidate =
                    TerminalCurrentCandidate::open(&directory, reference, &bytes).unwrap();
                assert_eq!(candidate.record.reference, reference);
                assert_eq!(candidate.record.state, state);
                assert_eq!(candidate.current_identity, identity);
                let (stage, public) = terminal_names(reference).unwrap();
                assert_fixture_mutation_rejected(
                    &root.join(if state == TerminalObservedState::Prepared {
                        stage
                    } else {
                        public
                    }),
                    state == TerminalObservedState::Published,
                    &mut phase,
                    &mut os_error,
                    &mut closes,
                    &mut mutation_effect,
                );
                let closed = candidate.close();
                closes.push(("current_reader", closed));
                assert!(closed && candidate.close() == closed);
                fresh_reads += 1;
            }
            phase = "rejections";
            let oversized = vec![b'c'; MAX_RECORD_BYTES + 1];
            for (reference, data, reason, opened) in [
                (
                    COLLISION,
                    bytes.as_slice(),
                    "terminal_record_two_names",
                    false,
                ),
                (ABSENT, bytes.as_slice(), "terminal_record_absent", false),
                (
                    PREPARED,
                    b"wrong".as_slice(),
                    "terminal_observation_bytes_mismatch",
                    true,
                ),
                (
                    DIRECTORY,
                    bytes.as_slice(),
                    "terminal_observation_identity_mismatch",
                    true,
                ),
                (PREPARED, b"".as_slice(), "terminal_bytes_invalid", false),
                (
                    PREPARED,
                    oversized.as_slice(),
                    "terminal_bytes_invalid",
                    false,
                ),
                (
                    "host-terminal.invalid",
                    bytes.as_slice(),
                    "terminal_reference_invalid",
                    false,
                ),
            ] {
                let failure = TerminalCurrentCandidate::open(&directory, reference, data)
                    .err()
                    .expect("current_should_reject");
                assert_eq!(failure.reference, reference);
                assert_eq!(failure.reason, reason);
                assert_eq!(failure.open_issued, opened);
                assert_eq!(failure.opened, opened);
                assert_eq!(
                    failure.close_confirmed,
                    if opened { Some(true) } else { None }
                );
                if opened {
                    closes.push(("rejected_reader", failure.close_confirmed.unwrap()));
                }
                rejected += 1;
            }
            phase = "replacement";
            let (replaced_stage, _) = terminal_names(REPLACED).unwrap();
            let retired = root.join("retired-current-r1.stage");
            assert_eq!(observe_terminal_presence(&retired), Ok(false));
            assert_eq!(
                observe_fixture_identity(&root.join(&replaced_stage), &mut closes),
                records[3].1
            );
            assert_eq!(fs::read(root.join(&replaced_stage)).unwrap(), bytes);
            fixture_rename_issued = true;
            fs::rename(root.join(&replaced_stage), &retired).unwrap();
            let mut replacement = TerminalStage::create(&directory, REPLACED, &bytes).unwrap();
            let replacement_id = replacement.identity;
            assert_ne!(replacement_id, records[3].1);
            closes.push(("replacement_stage", replacement.close()));
            assert!(closes.iter().all(|(_, closed)| *closed));
            let failure = TerminalObservedRecord::open(&directory, REPLACED, records[3].1, &bytes)
                .err()
                .expect("strict_should_reject_replacement");
            assert_eq!(failure.reason, "terminal_observation_identity_mismatch");
            assert_eq!(failure.close_confirmed, Some(true));
            closes.push(("strict_rejection", failure.close_confirmed.unwrap()));
            let mut candidate =
                TerminalCurrentCandidate::open(&directory, REPLACED, &bytes).unwrap();
            assert_eq!(candidate.current_identity, replacement_id);
            assert_ne!(candidate.current_identity, records[3].1);
            assert_eq!(candidate.record.reference, REPLACED);
            closes.push(("replacement_reader", candidate.close()));
            replacement_distinguished = true;
            drop(candidate);
            drop(replacement);
            phase = "close";
            closes.push(("directory", directory.close()));
            assert!(closes.iter().all(|(_, closed)| *closed));
            drop(directory);
            let (prepared_name, _) = terminal_names(PREPARED).unwrap();
            let (_, published_name) = terminal_names(PUBLISHED).unwrap();
            phase = "cleanup";
            for (name, identity, data) in [
                (prepared_name.as_str(), records[0].1, bytes.as_slice()),
                (published_name.as_str(), records[1].1, bytes.as_slice()),
                (collision_stage.as_str(), records[2].1, bytes.as_slice()),
                (collision_public.as_str(), collision_id, b"prior".as_slice()),
                ("retired-current-r1.stage", records[3].1, bytes.as_slice()),
                (replaced_stage.as_str(), replacement_id, bytes.as_slice()),
            ] {
                assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
                assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
                let path = root.join(name);
                assert_eq!(observe_fixture_identity(&path, &mut closes), identity);
                assert_eq!(fs::read(&path).unwrap(), data);
                cleanup_count += 1;
                fs::remove_file(&path).unwrap();
                assert_eq!(observe_terminal_presence(&path), Ok(false));
            }
            assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
            assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
            assert_eq!(
                observe_fixture_identity(&child_directory, &mut closes),
                child_id
            );
            assert_eq!(fs::read_dir(&child_directory).unwrap().count(), 0);
            cleanup_count += 1;
            fs::remove_dir(&child_directory).unwrap();
            assert_eq!(observe_terminal_presence(&child_directory), Ok(false));
            assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
            assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
            assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
            cleanup_count += 1;
            fs::remove_dir(&root).unwrap();
            assert_eq!(observe_terminal_presence(&root), Ok(false));
            assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
            phase = "complete";
        }));
        let presence = match observe_terminal_presence(&root) {
            Ok(true) => "present",
            Ok(false) => "absent",
            Err(_) => "unknown",
        };
        let success = outcome.is_ok()
            && phase == "complete"
            && presence == "absent"
            && fresh_reads == 2
            && rejected == 7
            && replacement_distinguished
            && fixture_rename_issued
            && cleanup_count == 8
            && !mutation_effect
            && closes.iter().all(|(_, closed)| *closed);
        let close_rows: Vec<_> = closes
            .iter()
            .map(|(owner, confirmed)| {
                format!("{{\"owner\":\"{owner}\",\"confirmed\":{confirmed}}}")
            })
            .collect();
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-current-candidate-fixture\",\"contractRevision\":1,\"run\":\"{RUN}\",\"status\":\"{}\",\"phase\":\"{phase}\",\"currentReadsVerified\":{fresh_reads},\"rejectionChecksVerified\":{rejected},\"sameBytesReplacementDistinguished\":{replacement_distinguished},\"fixtureRenameIssued\":{fixture_rename_issued},\"checkedClosesConfirmed\":{},\"closeResults\":[{}],\"cleanupIssuedCount\":{cleanup_count},\"fixturePresence\":\"{presence}\",\"unexpectedMutationEffectIssued\":{mutation_effect},\"historicalReceiptRestored\":false,\"productionIntegrationVerified\":false,\"callerDurableReentryVerified\":false,\"schemaBindingVerified\":false,\"osFaultInjectionVerified\":false,\"strictDeadlineClaimed\":false}}",
            if success { "observed" } else { "unconfirmed" },
            closes.iter().all(|(_, closed)| *closed),
            close_rows.join(",")
        );
        assert!(success, "current_candidate_unconfirmed");
    }

    /// 既知Identityの六u32だけを固定Workerへ搬送する。
    ///
    /// @responsibility 非秘密の五field/属性を失わず、PathやAuthorityを生成しない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 自己生成cold-r1、固定run/cwd/実行物とcaller既知Identityだけ。
    /// @stimulus 固定順の十進文字列を作る。
    /// @observation six-field文字列。
    /// @oracle 同じ型の固定順だけ。
    /// @cleanup N/A: 局所変換。
    /// @boundary 未署名Native試験→Windows。実残存、Docker、Providerおよび公開Recoveryへ未接続。
    fn cold_identity_text(identity: DirectoryIdentity) -> String {
        format!(
            "{},{},{},{},{},{}",
            identity.volume_serial_number,
            identity.file_index_high,
            identity.file_index_low,
            identity.creation_time_low,
            identity.creation_time_high,
            identity.attributes
        )
    }

    /// 親が渡した固定IdentityをWorkerで復元する。
    ///
    /// @responsibility 欠落、余分、非正規値を受理せず、対象自身から期待値を作らない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 自己生成cold-r1、固定run/cwd/実行物とcaller既知Identityだけ。
    /// @stimulus 固定環境fieldを解析する。
    /// @observation 六u32と再encode一致。
    /// @oracle 全六件と正規表現だけを受理する。
    /// @cleanup N/A: 局所解析。
    /// @boundary 未署名Native試験→Windows。実残存、Docker、Providerおよび公開Recoveryへ未接続。
    fn cold_identity_environment(key: &str) -> DirectoryIdentity {
        let text = std::env::var(key).unwrap();
        let fields: Vec<u32> = text
            .split(',')
            .map(|field| field.parse().unwrap())
            .collect();
        assert_eq!(fields.len(), 6);
        let identity = DirectoryIdentity {
            volume_serial_number: fields[0],
            file_index_high: fields[1],
            file_index_low: fields[2],
            creation_time_low: fields[3],
            creation_time_high: fields[4],
            attributes: fields[5],
        };
        assert_eq!(cold_identity_text(identity), text);
        identity
    }

    /// 一度だけ固定Workerを起動し、期待exitと実終端を共同確認する。
    ///
    /// @responsibility timeoutとcleanup成立を期待Process終了に読み替えず、失敗行をcatch外へ保持する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 自己生成cold-r1、固定run/cwd/実行物とcaller既知Identityだけ。
    /// @stimulus 既存OwnedChildへ閉じた環境とexact testを渡す。
    /// @observation 起動、役割、exit、Process/Job終端。
    /// @oracle prepared71/published72とcleanup_confirmedの両方。
    /// @cleanup 所有Jobだけを既存lifecycleで回収。不明なら後続Worker/fixture清掃0。全Job handle checked-closeは主張しない。
    /// @boundary 未署名Native試験→Windows。実残存、Docker、Providerおよび公開Recoveryへ未接続。
    fn run_cold_worker(
        role: &'static str,
        root_id: DirectoryIdentity,
        record_id: DirectoryIdentity,
        cutoff: u64,
        rows: &mut Vec<(&'static str, &'static str, Option<u32>, bool)>,
    ) {
        use crate::windows_owned_child::{Completion, OwnedChild};
        let expected = match role {
            "prepared" => 71,
            "published" => 72,
            _ => panic!("cold_role_invalid"),
        };
        assert_eq!(std::env::current_exe().unwrap(), Path::new(COLD_BINARY));
        assert!(
            unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() } < cutoff
        );
        let command = format!(
            "\"{COLD_BINARY}\" --exact windows::terminal::tests::terminal_cold_fixture_worker --ignored --nocapture --test-threads=1"
        );
        let environment = format!(
            "CRDD_TERMINAL_COLD_RUN={COLD_RUN}\0CRDD_COLD_ROLE={role}\0CRDD_COLD_CUTOFF={cutoff}\0CRDD_COLD_ROOT_ID={}\0CRDD_COLD_RECORD_ID={}\0TEMP={PARENT}/tmp\0TMP={PARENT}/tmp\0\0",
            cold_identity_text(root_id),
            cold_identity_text(record_id)
        );
        let mut environment: Vec<u16> = environment.encode_utf16().collect();
        let child = match OwnedChild::spawn(
            Path::new(COLD_BINARY),
            std::ffi::OsStr::new(&command),
            &mut environment,
            Path::new("C:/project/CRDD"),
        ) {
            Ok(child) => child,
            Err(failure) => {
                rows.push((
                    role,
                    if failure.process_created {
                        "start_created_failed"
                    } else {
                        "start_not_created"
                    },
                    None,
                    failure.cleanup_confirmed,
                ));
                panic!("cold_worker_start_failed");
            }
        };
        let outcome = child.wait(std::time::Duration::from_secs(3), || false);
        let (state, code) = match outcome.completion {
            Completion::Exited(code) => ("exited", Some(code)),
            Completion::Cancelled => ("cancelled", None),
            Completion::TimedOut => ("timeout", None),
            Completion::ObservationFailed => ("observation_failed", None),
        };
        rows.push((role, state, code, outcome.cleanup_confirmed));
        assert!(outcome.cleanup_confirmed);
        assert_eq!(code, Some(expected));
    }

    /// 準備済みまたは公開済みの自己生成記録guardを保持したまま別Processを意図的に終了する。
    ///
    /// @responsibility exitは意図的なProcess終了だけを証明し、突然crash/rename途中/耐久caller再入場へ昇格しない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 自己生成cold-r1、固定run/cwd/実行物とcaller既知Identityだけ。
    /// @stimulus preparedはfresh reader、publishedはtest-only writer再取得と本体publishの後にprocess::exit。
    /// @observation 既知五field/属性、ACL、全bytes、状態、最終NTSTATUS。
    /// @oracle 全照合後だけ71/72。親は別途実Process/Job終端とfresh読取りを確認する。
    /// @cleanup 子はguardを意図的に明示closeしない。OS Process終了の観測は親所有。実処理終了許可へ拡張しない。
    /// @boundary 未署名Native試験→Windows。実残存、Docker、Providerおよび公開Recoveryへ未接続。
    #[test]
    #[ignore = "Fixed child of cold fixture only"]
    fn terminal_cold_fixture_worker() {
        assert_eq!(
            std::env::var("CRDD_TERMINAL_COLD_RUN").as_deref(),
            Ok(COLD_RUN)
        );
        assert_eq!(
            std::env::current_dir().unwrap(),
            Path::new("C:/project/CRDD")
        );
        assert_eq!(std::env::current_exe().unwrap(), Path::new(COLD_BINARY));
        let role = std::env::var("CRDD_COLD_ROLE").unwrap();
        let cutoff: u64 = std::env::var("CRDD_COLD_CUTOFF").unwrap().parse().unwrap();
        let now = unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() };
        assert!(now < cutoff && cutoff - now <= 10_000);
        let root_id = cold_identity_environment("CRDD_COLD_ROOT_ID");
        let record_id = cold_identity_environment("CRDD_COLD_RECORD_ID");
        let root = Path::new(PARENT).join("fixture-cold-r1");
        let directory = TerminalDirectory::open(&root, root_id).unwrap();
        let bytes = vec![b'y'; MAX_RECORD_BYTES];
        if role == "prepared" {
            let observed =
                TerminalObservedRecord::open(&directory, COLD_PREPARED, record_id, &bytes).unwrap();
            assert_eq!(observed.state, TerminalObservedState::Prepared);
            assert_eq!(observed.reference, COLD_PREPARED);
            observed.directory.verify().unwrap();
            std::process::exit(71);
        }
        assert_eq!(role, "published");
        let (stage_name, public_name) = terminal_names(COLD_PUBLISHED).unwrap();
        let handle = open_terminal_handle(
            &root.join(&stage_name),
            FILE_GENERIC_READ | FILE_GENERIC_WRITE | DELETE,
            FILE_SHARE_READ,
        )
        .unwrap();
        assert_eq!(terminal_identity(handle.0).unwrap(), record_id);
        verify_terminal_protection(handle.0, &directory.user, &directory.system).unwrap();
        assert_eq!(read_terminal_bytes(handle.0).unwrap(), bytes);
        directory.verify().unwrap();
        // This cfg(test) reconstruction is not a production writer reentry API or historical receipt.
        let mut stage = TerminalStage {
            directory: &directory,
            handle,
            stage_name,
            public_name,
            identity: record_id,
            receipt: TerminalReceipt {
                reference: COLD_PUBLISHED.to_owned(),
                stage_created: false,
                write_issued: false,
                flush_issued: false,
                rename_issued: false,
                rename_nt_status: None,
                stage_absence_verified: false,
                publication_verified: false,
                reader_close_confirmed: None,
                record_handle_close_confirmed: None,
                handle_close_confirmed: None,
            },
        };
        stage.publish(&bytes).unwrap();
        assert_eq!(stage.receipt.rename_nt_status, Some(0));
        assert!(stage.receipt.publication_verified && stage.receipt.stage_absence_verified);
        std::process::exit(72);
    }

    /// 意図的Process終了後のfresh読取りと拒否を一つの固定fixtureで確認する。
    ///
    /// @responsibility 現在の読取り/close、モデル判定、Worker終端と自己生成清掃を別の結果へ保存する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 自己生成cold-r1、固定run/cwd/実行物とcaller既知Identityだけ。
    /// @stimulus 二Worker終了、同じ既知参照/Identity/bytes読取り、二名/不存在/不一致/Directory拒否と判定モデル。
    /// @observation 実ACL、reader保持拒否、期待exit、checked-close、発行清掃数と直接不存在。
    /// @oracle 全実観測とmodel確認の後だけ限定observed。失敗/不明で追加処置を止める。
    /// @cleanup 全oracle/close/Worker終端成立後だけfresh照合済み四file、空childDirectory、空Rootを一件ずつ清掃する。途中不明は停止。
    /// @boundary 未署名Native試験→Windows。実残存、Docker、Providerおよび公開Recoveryへ未接続。
    #[test]
    #[ignore = "Fixed fresh cold fixture; run through its Node owner only"]
    fn terminal_cold_observation_fixture() {
        assert_eq!(
            std::env::var("CRDD_TERMINAL_COLD_RUN").as_deref(),
            Ok(COLD_RUN)
        );
        assert_eq!(
            std::env::current_dir().unwrap(),
            Path::new("C:/project/CRDD")
        );
        let root = Path::new(PARENT).join("fixture-cold-r1");
        let mut phase = "preflight";
        let mut closes = Vec::new();
        let mut workers = Vec::new();
        let mut os_error = None;
        let mut mutation_effect = false;
        let mut cleanup_count = 0_u32;
        let mut prepared_verified = false;
        let mut published_verified = false;
        let mut rejection_verified = false;
        let mut model_verified = false;
        let mut directory_rejected = false;
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let parent = Path::new(PARENT);
            let parent_id = observe_fixture_identity(parent, &mut closes);
            phase = "fixture_absence";
            assert_eq!(observe_terminal_presence(&root), Ok(false));
            phase = "tokens";
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            let closed = close_terminal_handle(&mut impersonation);
            closes.push(("token_impersonation", closed));
            let closed = close_terminal_handle(&mut primary);
            closes.push(("token_primary", closed));
            assert!(closes.iter().all(|(_, value)| *value));
            phase = "fixture_create";
            let mut wide: Vec<u16> = root.as_os_str().encode_wide().collect();
            wide.push(0);
            with_terminal_descriptor(&user, &system, |attributes| {
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("cold_root_create_failed");
                }
                Ok(())
            })
            .unwrap();
            let root_id = observe_fixture_identity(&root, &mut closes);
            let mut directory = TerminalDirectory::open(&root, root_id).unwrap();
            let bytes = vec![b'y'; MAX_RECORD_BYTES];
            phase = "record_create";
            let mut records = Vec::new();
            for reference in [COLD_PREPARED, COLD_PUBLISHED, COLD_COLLISION] {
                let data: &[u8] = if reference == COLD_COLLISION {
                    b"new"
                } else {
                    &bytes
                };
                let mut stage = TerminalStage::create(&directory, reference, data).unwrap();
                records.push((reference, stage.identity));
                let closed = stage.close();
                closes.push(("record_close", closed));
                assert!(closed);
            }
            let (collision_stage, collision_public) = terminal_names(COLD_COLLISION).unwrap();
            let collision_id = create_collision_fixture(&directory, &collision_public, &mut closes);
            let (directory_name, _) = terminal_names(COLD_DIRECTORY).unwrap();
            let child_directory = root.join(&directory_name);
            let mut wide: Vec<u16> = child_directory.as_os_str().encode_wide().collect();
            wide.push(0);
            with_terminal_descriptor(&user, &system, |attributes| {
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("cold_child_directory_create_failed");
                }
                Ok(())
            })
            .unwrap();
            let child_id = observe_fixture_identity(&child_directory, &mut closes);
            phase = "directory_close";
            let closed = directory.close();
            closes.push(("directory_close", closed));
            assert!(closed);
            drop(directory);
            phase = "workers";
            let cutoff =
                (unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() })
                    .checked_add(6000)
                    .unwrap();
            run_cold_worker("prepared", root_id, records[0].1, cutoff, &mut workers);
            run_cold_worker("published", root_id, records[1].1, cutoff, &mut workers);
            phase = "fresh_reader";
            let mut directory = TerminalDirectory::open(&root, root_id).unwrap();
            for (reference, identity, state) in [
                (COLD_PREPARED, records[0].1, TerminalObservedState::Prepared),
                (
                    COLD_PUBLISHED,
                    records[1].1,
                    TerminalObservedState::Published,
                ),
            ] {
                let mut observed =
                    TerminalObservedRecord::open(&directory, reference, identity, &bytes).unwrap();
                assert_eq!(observed.reference, reference);
                assert_eq!(observed.state, state);
                observed.directory.verify().unwrap();
                assert_eq!(terminal_identity(observed.handle.0).unwrap(), identity);
                assert_eq!(read_terminal_bytes(observed.handle.0).unwrap(), bytes);
                let (stage, public) = terminal_names(reference).unwrap();
                assert_fixture_mutation_rejected(
                    &root.join(if state == TerminalObservedState::Prepared {
                        stage
                    } else {
                        public
                    }),
                    state == TerminalObservedState::Published,
                    &mut phase,
                    &mut os_error,
                    &mut closes,
                    &mut mutation_effect,
                );
                let closed = observed.close();
                closes.push(("cold_reader", closed));
                assert!(closed);
                assert_eq!(observed.close(), closed);
                if state == TerminalObservedState::Prepared {
                    prepared_verified = true;
                } else {
                    published_verified = true;
                }
            }
            phase = "rejections";
            for (reference, identity, data, reason, opened) in [
                (
                    COLD_COLLISION,
                    records[2].1,
                    b"new".as_slice(),
                    "terminal_record_two_names",
                    false,
                ),
                (
                    COLD_ABSENT,
                    records[0].1,
                    bytes.as_slice(),
                    "terminal_record_absent",
                    false,
                ),
                (
                    COLD_PREPARED,
                    records[0].1,
                    b"wrong".as_slice(),
                    "terminal_observation_bytes_mismatch",
                    true,
                ),
                (
                    COLD_DIRECTORY,
                    child_id,
                    bytes.as_slice(),
                    "terminal_observation_identity_mismatch",
                    true,
                ),
                (
                    COLD_PREPARED,
                    DirectoryIdentity {
                        creation_time_low: records[0].1.creation_time_low ^ 1,
                        ..records[0].1
                    },
                    bytes.as_slice(),
                    "terminal_observation_identity_mismatch",
                    true,
                ),
            ] {
                let failure = TerminalObservedRecord::open(&directory, reference, identity, data)
                    .err()
                    .expect("cold_should_reject");
                assert_eq!(failure.reference, reference);
                assert_eq!(failure.reason, reason);
                assert_eq!(failure.open_issued, opened);
                assert_eq!(failure.opened, opened);
                assert_eq!(
                    failure.close_confirmed,
                    if opened { Some(true) } else { None }
                );
                if opened {
                    closes.push(("rejection_reader", failure.close_confirmed.unwrap()));
                }
                if reference == COLD_DIRECTORY {
                    directory_rejected = true;
                }
            }
            rejection_verified = true;
            phase = "decision_models";
            assert_eq!(
                terminal_presence_result(Err(std::io::Error::from(std::io::ErrorKind::NotFound))),
                Ok(false)
            );
            for kind in [
                std::io::ErrorKind::PermissionDenied,
                std::io::ErrorKind::Other,
            ] {
                assert_eq!(
                    terminal_presence_result(Err(std::io::Error::from(kind))),
                    Err("terminal_presence_unknown")
                );
            }
            let mut unknown = None;
            assert!(!preserve_terminal_close(&mut unknown, false));
            assert!(!preserve_terminal_close(&mut unknown, true));
            let mut confirmed = None;
            assert!(preserve_terminal_close(&mut confirmed, true));
            assert!(preserve_terminal_close(&mut confirmed, false));
            model_verified = true;
            phase = "directory_close";
            let closed = directory.close();
            closes.push(("directory_close", closed));
            assert!(closed && closes.iter().all(|(_, closed)| *closed));
            drop(directory);
            phase = "cleanup_file";
            let (prepared_name, _) = terminal_names(COLD_PREPARED).unwrap();
            let (_, published_name) = terminal_names(COLD_PUBLISHED).unwrap();
            for (name, identity, data) in [
                (&prepared_name, records[0].1, bytes.as_slice()),
                (&published_name, records[1].1, bytes.as_slice()),
                (&collision_stage, records[2].1, b"new".as_slice()),
                (&collision_public, collision_id, b"prior".as_slice()),
            ] {
                assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
                assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
                let path = root.join(name);
                assert_eq!(observe_fixture_identity(&path, &mut closes), identity);
                assert_eq!(fs::read(&path).unwrap(), data);
                cleanup_count += 1;
                fs::remove_file(&path).unwrap();
                assert_eq!(observe_terminal_presence(&path), Ok(false));
            }
            phase = "cleanup_directory";
            assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
            assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
            assert_eq!(
                observe_fixture_identity(&child_directory, &mut closes),
                child_id
            );
            assert_eq!(fs::read_dir(&child_directory).unwrap().count(), 0);
            cleanup_count += 1;
            fs::remove_dir(&child_directory).unwrap();
            assert_eq!(observe_terminal_presence(&child_directory), Ok(false));
            assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
            assert_eq!(observe_fixture_identity(&root, &mut closes), root_id);
            cleanup_count += 1;
            fs::remove_dir(&root).unwrap();
            assert_eq!(observe_terminal_presence(&root), Ok(false));
            assert_eq!(observe_fixture_identity(parent, &mut closes), parent_id);
            phase = "complete";
        }));
        let presence = match observe_terminal_presence(&root) {
            Ok(true) => "present",
            Ok(false) => "absent",
            Err(_) => "unknown",
        };
        let success = outcome.is_ok()
            && presence == "absent"
            && cleanup_count == 6
            && !mutation_effect
            && prepared_verified
            && published_verified
            && rejection_verified
            && model_verified
            && directory_rejected
            && closes.iter().all(|(_, closed)| *closed)
            && workers.len() == 2;
        let close_rows: Vec<_> = closes
            .iter()
            .map(|(owner, confirmed)| {
                format!("{{\"owner\":\"{owner}\",\"confirmed\":{confirmed}}}")
            })
            .collect();
        let worker_rows: Vec<_> = workers.iter().map(|(role, state, code, cleanup)| format!("{{\"role\":\"{role}\",\"state\":\"{state}\",\"exitCode\":{},\"cleanupConfirmed\":{cleanup}}}", code.map(|v| v.to_string()).unwrap_or_else(|| "null".to_owned()))).collect();
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-cold-observation-fixture\",\"contractRevision\":1,\"run\":\"{COLD_RUN}\",\"status\":\"{}\",\"phase\":\"{phase}\",\"preparedFreshReadVerified\":{prepared_verified},\"publishedFreshReadVerified\":{published_verified},\"rejectionChecksVerified\":{rejection_verified},\"modeledDecisionChecksVerified\":{model_verified},\"directoryRejected\":{directory_rejected},\"checkedClosesConfirmed\":{},\"closeResults\":[{}],\"workers\":[{}],\"cleanupIssuedCount\":{cleanup_count},\"fixturePresence\":\"{presence}\",\"unexpectedMutationEffectIssued\":{mutation_effect},\"productionIntegrationVerified\":false,\"callerDurableReentryVerified\":false,\"osFaultInjectionVerified\":false,\"strictDeadlineClaimed\":false}}",
            if success { "observed" } else { "unconfirmed" },
            closes.iter().all(|(_, closed)| *closed),
            close_rows.join(","),
            worker_rows.join(",")
        );
        assert!(success, "cold_observation_unconfirmed");
    }

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
        assert!(!*issued && !stage.receipt.rename_issued && !stage.receipt.publication_verified);
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
            assert!(closed && collision.receipt.record_handle_close_confirmed == Some(true));
            phase = "stage_close";
            let closed = stage.close();
            closes.push(("stage_close", closed));
            assert!(closed && stage.receipt.record_handle_close_confirmed == Some(true));
            assert!(!stage.receipt.rename_issued && !stage.receipt.publication_verified);
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

    /// 固定fixtureの同じ参照と部分receiptを閉packetへ搬送する。
    ///
    /// @responsibility panic後にも最後に取得した処置・確認を失わない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition fixtureの二つの固定UUID参照だけを扱う。
    /// @stimulus 取得済みreceiptを固定field順のJSONへ変換する。
    /// @observation 未取得と既知false/true、最終NTSTATUSとclose不明を区別する。
    /// @oracle 発行や確認の値を成功補完しない。
    /// @cleanup N/A: memory上の変換だけ。
    /// @boundary 私有試験receipt→Nodeの閉じた解析。
    fn fixture_receipt_json(receipt: &Option<TerminalReceipt>) -> String {
        let Some(receipt) = receipt else {
            return "null".to_owned();
        };
        assert!(terminal_names(&receipt.reference).is_ok());
        let optional_bool = |value: Option<bool>| {
            value
                .map(|v| v.to_string())
                .unwrap_or_else(|| "null".to_owned())
        };
        format!(
            "{{\"reference\":\"{}\",\"stageCreated\":{},\"writeIssued\":{},\"flushIssued\":{},\"renameIssued\":{},\"renameNtStatus\":{},\"stageAbsenceVerified\":{},\"publicationVerified\":{},\"readerCloseConfirmed\":{},\"recordHandleCloseConfirmed\":{},\"handleCloseConfirmed\":{}}}",
            receipt.reference,
            receipt.stage_created,
            receipt.write_issued,
            receipt.flush_issued,
            receipt.rename_issued,
            receipt
                .rename_nt_status
                .map(|v| v.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            receipt.stage_absence_verified,
            receipt.publication_verified,
            optional_bool(receipt.reader_close_confirmed),
            optional_bool(receipt.record_handle_close_confirmed),
            optional_bool(receipt.handle_close_confirmed)
        )
    }

    /// 自己生成実Windows対象でNative保存・公開primitiveを実行する。
    ///
    /// @responsibility 私有本体を通し、成功/拒否とhandle終端/fixture清掃を別に観測する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition exact cwd、r4 run参照、固定run親をNode Ownerが確認し、fixture-r4は明示不存在。r1/r2残存は変更しない。
    /// @stimulus 8192byte保存/公開、衝突、8193byte/空/不正参照拒否、保持中変更拒否。
    /// @observation 五field、全bytes、protected二ACE、発行receipt、error32、個別close、清掃発行数、現在の不存在/残存/不明。
    /// @oracle 全観測と全close後のfresh照合/清掃/不存在だけで限定observedを出す。Schema/Authority/本番Recoveryは主張しない。
    /// @cleanup 通常Oracleと全close成立後だけ自己生成三fileと空Directoryを一件ずつ処置する。途中失敗では既発行清掃を保持して追加処置0。
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
        let mut record_receipt: Option<TerminalReceipt> = None;
        let mut collision_receipt: Option<TerminalReceipt> = None;
        let root = Path::new(PARENT).join("fixture-r4");
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
            let created = TerminalStage::create(&directory, REFERENCE, &bytes);
            let mut stage = match created {
                Ok(stage) => stage,
                Err(failure) => {
                    record_receipt = Some(failure.receipt);
                    panic!("publication_stage_create_unconfirmed");
                }
            };
            record_receipt = Some(stage.receipt.clone());
            assert!(
                stage.receipt.stage_created
                    && stage.receipt.write_issued
                    && stage.receipt.flush_issued
            );
            assert!(!stage.receipt.rename_issued && !stage.receipt.publication_verified);
            phase = "stage_publish";
            let published = stage.publish(&bytes);
            record_receipt = Some(stage.receipt.clone());
            published.unwrap();
            assert!(stage.receipt.rename_issued && stage.receipt.publication_verified);
            assert_eq!(stage.receipt.rename_nt_status, Some(0));
            assert!(stage.receipt.stage_absence_verified);
            assert_eq!(stage.receipt.reader_close_confirmed, Some(true));
            let identity = stage.identity;
            let stage_name = stage.stage_name.clone();
            let public_name = stage.public_name.clone();
            assert_eq!(
                fs::symlink_metadata(root.join(&stage_name))
                    .err()
                    .map(|e| e.kind()),
                Some(std::io::ErrorKind::NotFound)
            );
            assert_fixture_mutation_rejected(
                &root.join(&public_name),
                true,
                &mut phase,
                &mut os_error,
                &mut closes,
                &mut mutation_effect,
            );
            phase = "repeated_publish";
            let repeated = stage.publish(&bytes).unwrap_err();
            assert_eq!(repeated.reason, "terminal_rename_already_issued");
            assert_eq!(repeated.receipt, stage.receipt);
            phase = "collision_stage_create";
            let created = TerminalStage::create(&directory, COLLISION_REFERENCE, b"new");
            let mut collision = match created {
                Ok(stage) => stage,
                Err(failure) => {
                    collision_receipt = Some(failure.receipt);
                    panic!("publication_collision_stage_unconfirmed");
                }
            };
            collision_receipt = Some(collision.receipt.clone());
            let collision_stage_id = collision.identity;
            phase = "collision_publish";
            let publication = collision.publish(b"new");
            collision_receipt = Some(collision.receipt.clone());
            let rejected = publication.unwrap_err();
            assert_eq!(rejected.reason, "terminal_rename_not_verified");
            assert!(
                rejected.receipt.stage_created
                    && rejected.receipt.rename_issued
                    && !rejected.receipt.publication_verified
            );
            assert_eq!(
                rejected.receipt.rename_nt_status,
                Some(windows_sys::Win32::Foundation::STATUS_OBJECT_NAME_COLLISION)
            );
            assert!(!rejected.receipt.stage_absence_verified);
            assert_eq!(rejected.receipt.reader_close_confirmed, None);
            assert_eq!(
                observe_fixture_identity(&root.join(&collision_stage), &mut closes),
                collision_stage_id
            );
            assert_eq!(read_terminal_bytes(collision.handle.0).unwrap(), b"new");
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
                        && !failure.receipt.rename_issued
                );
            }
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
            collision_receipt = Some(collision.receipt.clone());
            closes.push(("collision_close", closed));
            if let Some(value) = collision.receipt.record_handle_close_confirmed {
                closes.push(("collision_source_close", value));
            }
            assert!(closed);
            phase = "collision_close";
            let closed = collision.close();
            collision_receipt = Some(collision.receipt.clone());
            closes.push(("collision_close", closed));
            assert!(closed);
            assert_eq!(collision.receipt.handle_close_confirmed, Some(true));
            assert_eq!(collision.receipt.record_handle_close_confirmed, Some(true));
            assert_eq!(collision.receipt.reader_close_confirmed, None);
            phase = "stage_close";
            let closed = stage.close();
            record_receipt = Some(stage.receipt.clone());
            closes.push(("stage_close", closed));
            if let Some(value) = stage.receipt.reader_close_confirmed {
                closes.push(("stage_reader_close", value));
            }
            if let Some(value) = stage.receipt.record_handle_close_confirmed {
                closes.push(("stage_source_close", value));
            }
            assert!(closed);
            phase = "stage_close";
            let closed = stage.close();
            record_receipt = Some(stage.receipt.clone());
            closes.push(("stage_close", closed));
            assert!(closed);
            assert_eq!(stage.receipt.handle_close_confirmed, Some(true));
            assert_eq!(stage.receipt.record_handle_close_confirmed, Some(true));
            assert_eq!(stage.receipt.reader_close_confirmed, Some(true));
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
            "\n{{\"contract\":\"crdd-native/terminal-rename-publication-fixture\",\"status\":\"{}\",\"phase\":\"{}\",\"osError\":{},\"maximumBytes\":8192,\"noReplaceVerified\":{},\"heldMutationRejected\":{},\"allCheckedClosesConfirmed\":{},\"closeResults\":[{}],\"cleanupIssuedCount\":{},\"unexpectedMutationEffectIssued\":{},\"fixturePresence\":\"{}\",\"productionIntegrationVerified\":false,\"stageAbsenceWhileHeldVerified\":{},\"recordReceipt\":{},\"collisionReceipt\":{}}}",
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
            presence,
            success,
            fixture_receipt_json(&record_receipt),
            fixture_receipt_json(&collision_receipt)
        );
        assert!(success, "terminal_publication_unconfirmed");
    }
}
