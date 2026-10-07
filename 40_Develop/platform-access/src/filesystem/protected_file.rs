//! 固定Host記録の保護付きFile操作をWindows APIへ接続する。
//!
//! @responsibility 同期Handleの取得・保護照合・Descriptor借用・保存Stageのwrite/flush/非置換公開・明示終了を所有し、Namespace選択や回復判断を行わない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use crate::filesystem::host_namespace::TerminalDirectory;
use crate::filesystem::protection::{
    ACCESS_ALLOWED_ACE_TYPE, DirectoryIdentity, OwnedHandle, OwnedSecurityDescriptor,
    bounded_ace_sid, directory_identity, root_information,
};
use crate::process::principal::copy_sid_bytes;
use std::ffi::c_void;
use std::mem::size_of;
use std::os::windows::ffi::OsStrExt;
use std::path::Path;
use std::ptr::{null, null_mut};
use windows_sys::Wdk::Storage::FileSystem::{
    FILE_RENAME_INFORMATION, FileRenameInformation, NtSetInformationFile,
};
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE, LocalFree};
use windows_sys::Win32::Foundation::{STATUS_PENDING, WAIT_OBJECT_0};
use windows_sys::Win32::Security::Authorization::{
    GetSecurityInfo, SE_FILE_OBJECT, SE_OBJECT_TYPE,
};
use windows_sys::Win32::Security::{
    ACCESS_ALLOWED_ACE, ACL, ACL_REVISION, ACL_SIZE_INFORMATION, AclSizeInformation,
    AddAccessAllowedAceEx, DACL_SECURITY_INFORMATION, GROUP_SECURITY_INFORMATION, GetAce,
    GetAclInformation, GetSecurityDescriptorControl, GetSecurityDescriptorDacl,
    GetSecurityDescriptorOwner, InitializeAcl, InitializeSecurityDescriptor,
    OWNER_SECURITY_INFORMATION, SE_DACL_PROTECTED, SECURITY_ATTRIBUTES, SECURITY_DESCRIPTOR,
    SetSecurityDescriptorControl, SetSecurityDescriptorDacl, SetSecurityDescriptorOwner,
};
use windows_sys::Win32::Storage::FileSystem::{
    CREATE_NEW, CreateFileW, DELETE, FILE_ALL_ACCESS, FILE_ATTRIBUTE_DIRECTORY,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_BEGIN, FILE_FLAG_BACKUP_SEMANTICS,
    FILE_FLAG_OPEN_REPARSE_POINT, FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_SHARE_DELETE,
    FILE_SHARE_READ, FILE_SHARE_WRITE, FlushFileBuffers, GetFileSizeEx, OPEN_EXISTING,
    READ_CONTROL, ReadFile, SetFilePointerEx, WriteFile,
};
use windows_sys::Win32::System::IO::IO_STATUS_BLOCK;
use windows_sys::Win32::System::Threading::{INFINITE, WaitForSingleObject};

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
pub(super) struct TerminalReceipt {
    pub(super) reference: String,
    pub(super) stage_created: bool,
    pub(super) write_issued: bool,
    pub(super) flush_issued: bool,
    pub(super) rename_issued: bool,
    pub(super) rename_nt_status: Option<i32>,
    pub(super) stage_absence_verified: bool,
    pub(super) publication_verified: bool,
    pub(super) reader_close_confirmed: Option<bool>,
    pub(super) record_handle_close_confirmed: Option<bool>,
    pub(super) handle_close_confirmed: Option<bool>,
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
pub(super) struct TerminalFailure {
    pub(super) reason: &'static str,
    pub(super) receipt: TerminalReceipt,
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
pub(super) struct TerminalStage<'a> {
    pub(super) directory: &'a TerminalDirectory,
    pub(super) handle: OwnedHandle,
    pub(super) stage_name: String,
    pub(super) public_name: String,
    pub(super) identity: DirectoryIdentity,
    pub(super) receipt: TerminalReceipt,
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
pub(super) fn terminal_names(reference: &str) -> Result<(String, String), &'static str> {
    if !crate::protocol::host_record::valid_reference(reference) {
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
    pub(super) fn create(
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
    pub(super) fn publish(&mut self, bytes: &[u8]) -> Result<(), TerminalFailure> {
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
    pub(super) fn verify_identity(&self) -> Result<(), &'static str> {
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
    pub(super) fn close(&mut self) -> bool {
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
pub(super) fn observe_terminal_presence(path: &Path) -> Result<bool, &'static str> {
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
pub(super) fn terminal_presence_result(
    observed: std::io::Result<std::fs::Metadata>,
) -> Result<bool, &'static str> {
    match observed {
        Ok(_) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("terminal_presence_unknown"),
    }
}

pub(super) const MAX_RECORD_BYTES: usize = 8192;
pub(super) const MAX_HOST_MARKER_OBSERVATION_BYTES: usize = 64 * 1024;

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
pub(super) fn close_terminal_handle(handle: &mut OwnedHandle) -> bool {
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
pub(super) fn open_terminal_handle(
    path: &Path,
    access: u32,
    share: u32,
) -> Result<OwnedHandle, &'static str> {
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
pub(super) fn terminal_identity(handle: HANDLE) -> Result<DirectoryIdentity, &'static str> {
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
pub(super) fn verify_terminal_protection(
    handle: HANDLE,
    user: &[u8],
    system: &[u8],
) -> Result<(), &'static str> {
    verify_terminal_object_protection(handle, user, system, SE_FILE_OBJECT, FILE_ALL_ACCESS)
}

/// OS object種別とaccess maskを固定して同handleの保護を観測する。
///
/// @responsibility FileとMutexのdescriptorを混同せず、観測memoryの終了も確認する。
/// @trace ARCH-000011
/// @input 保持handle、二SID、内部で固定したobject種別とmask。
/// @returns owner/protected二ACEの一致または固定失敗。
/// @precondition READ_CONTROLを持つhandleと有効SIDを同じ同期Ownerが保持する。
/// @postcondition descriptorの明示freeを確認する。
/// @effect OS保護の読取りと観測用memoryの解放。
/// @failure 取得、不一致またはfree不明で停止する。
/// @invariant File wrapperの種別とmaskを変えない。
/// @boundary Native→GetSecurityInfo/ACL。
/// @security 既存named objectの作成descriptorを現在保護の証明にしない。
/// @concurrency 同handleでfreshに観測し、変更不能性は主張しない。
pub(super) fn verify_terminal_object_protection(
    handle: HANDLE,
    user: &[u8],
    system: &[u8],
    object_type: SE_OBJECT_TYPE,
    access: u32,
) -> Result<(), &'static str> {
    let mut raw_descriptor = null_mut();
    // SAFETY: caller holds the typed object and READ_CONTROL; output is owned below.
    let observed = unsafe {
        GetSecurityInfo(
            handle,
            object_type,
            OWNER_SECURITY_INFORMATION | GROUP_SECURITY_INFORMATION | DACL_SECURITY_INFORMATION,
            null_mut(),
            null_mut(),
            null_mut(),
            null_mut(),
            &mut raw_descriptor,
        )
    };
    if observed != 0 || raw_descriptor.is_null() {
        return Err("terminal_descriptor_unknown");
    }
    let mut descriptor = OwnedSecurityDescriptor(raw_descriptor);
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
            if unsafe { (*raw.cast::<ACCESS_ALLOWED_ACE>()).Mask } != access
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
pub(super) fn with_terminal_descriptor<T>(
    user: &[u8],
    system: &[u8],
    effect: impl FnOnce(&SECURITY_ATTRIBUTES) -> Result<T, &'static str>,
) -> Result<T, &'static str> {
    with_terminal_access_descriptor(user, system, FILE_ALL_ACCESS, effect)
}

/// 用途別のmaskを持つprotected二ACEを同期作成へ借用する。
///
/// @responsibility FileとKernelの権利を区別し、全descriptor storageを返却まで保持する。
/// @trace ARCH-000011
/// @input OS取得済み二SID、内部固定mask、同期作成closure。
/// @returns closureの結果または構築失敗。
/// @precondition 外部入力のmaskやpointer保持closureを渡さない。
/// @postcondition ownerとprotected DACLを作成時から設定する。
/// @effect descriptorは局所memory。closureの限定作成だけを発行する。
/// @failure 構築不明ではclosureを呼ばない。
/// @invariant File用wrapperはFILE_ALL_ACCESSを保持する。
/// @boundary Native→Windows Security/Create API。
/// @security 二SID以外のACE、継承または後付け保護を使わない。
/// @concurrency 同threadの同期借用だけ。
pub(super) fn with_terminal_access_descriptor<T>(
    user: &[u8],
    system: &[u8],
    access: u32,
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
                access,
                user.as_ptr().cast_mut().cast(),
            )
        } == 0
        || unsafe {
            AddAccessAllowedAceEx(
                acl,
                ACL_REVISION,
                0,
                access,
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
pub(super) fn read_terminal_bytes(handle: HANDLE) -> Result<Vec<u8>, &'static str> {
    read_terminal_bounded_bytes(handle, MAX_RECORD_BYTES)
}

/// 固定用途の上限以内で全bytesとEOFを同期読取りする。
///
/// @responsibility markerの64KiBと終端記録の8KiBを混同しない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 保持同期handle、内部Ownerが固定する上限。
/// @returns 非空全bytes、または長さ/seek/read/EOF失敗。
/// @precondition 上限は1..65536。任意公開値ではない。handle位置は一意借用。
/// @postcondition 部分readを継続し実長分とEOFを確認する。
/// @effect file位置変更と同期読取りのみ。
/// @failure 不正上限、0/超過/観測不能長、無進捗/OS失敗/EOF不一致を拒否する。
/// @invariant 既存終端記録wrapperの8192byte契約と失敗理由を維持する。
/// @boundary 私有Reader→Windows GetFileSizeEx/ReadFile。
/// @security marker本文を出力せず、由来・状態・Authorityを推論しない。
/// @concurrency 同じhandleを並行Readerへ渡さない。
pub(super) fn read_terminal_bounded_bytes(
    handle: HANDLE,
    maximum: usize,
) -> Result<Vec<u8>, &'static str> {
    if maximum == 0 || maximum > MAX_HOST_MARKER_OBSERVATION_BYTES {
        return Err("terminal_read_limit_invalid");
    }
    let mut length = 0_i64;
    // SAFETY: synchronous handle, valid local output, bounded allocation follows.
    if unsafe { GetFileSizeEx(handle, &mut length) } == 0 || length <= 0 || length > maximum as i64
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
