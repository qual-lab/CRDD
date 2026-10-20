//! Host終端記録の同一実体への書込みと非置換公開を所有する。
//!
//! @responsibility 私有する同期handleと親chainを保持し、既発行Effectと確認済み結果を分ける。専用観測・記録保存へ接続するが、回収Authorityは提供しない。
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @trace ARCH-000015
#[cfg(test)]
use crate::host_record::host_namespace::validate_terminal_target_names;
use crate::host_record::host_namespace::{
    CAPACITY_SETTLEMENT_UNKNOWN, TerminalDirectory, TerminalNamespaceIdentity,
    terminal_identity_fields,
};
use crate::host_record::protected_file::{
    TerminalReceipt, TerminalStage, close_terminal_handle, observe_terminal_presence,
    open_terminal_handle, terminal_identity, terminal_names, verify_terminal_object_protection,
    verify_terminal_protection, with_terminal_access_descriptor, with_terminal_descriptor,
};
#[cfg(test)]
use crate::host_record::terminal_target::{
    TERMINAL_TARGET_CHILDREN, TerminalKnownFileSnapshot, finish_terminal_target_observation,
    observe_terminal_known_file, validate_terminal_target_identities,
};
use crate::host_record::terminal_target::{
    TerminalTargetFailure, TerminalTargetObservation, TerminalTargetSnapshot,
    observe_known_file_terminal_target, observe_terminal_target,
};

#[cfg(test)]
use crate::filesystem::protection::root_information;
#[cfg(test)]
use crate::filesystem::protection::{ACCESS_ALLOWED_ACE_TYPE, bounded_ace_sid};
use crate::filesystem::protection::{DirectoryIdentity, OwnedHandle, sha256};
#[cfg(test)]
use crate::host_record::host_namespace::{
    HostNamespaceChild, create_host_namespace_child, host_namespace_at_parent,
};
#[cfg(test)]
use crate::host_record::host_namespace::{
    decode_terminal_temporary_parent, validate_terminal_namespace,
};
#[cfg(test)]
use crate::host_record::protected_file::terminal_presence_result;
#[cfg(test)]
use crate::process::principal::copy_sid_bytes;
#[cfg(test)]
use crate::process::principal::process_tokens;
#[cfg(test)]
use crate::process::principal::{
    local_system_sid_bytes, selected_user_token_binding, token_user_sid_bytes,
};
#[cfg(test)]
use std::ffi::OsString;
#[cfg(test)]
use std::ffi::c_void;
#[cfg(test)]
use std::mem::size_of;
use std::os::windows::ffi::OsStrExt;
#[cfg(test)]
use std::path::Path;
#[cfg(test)]
use std::path::PathBuf;
#[cfg(test)]
use std::ptr::null;
#[cfg(test)]
use std::ptr::null_mut;
#[cfg(test)]
use windows_sys::Win32::Storage::FileSystem::WRITE_OWNER;
#[cfg(test)]
use windows_sys::Win32::Storage::FileSystem::{CreateDirectoryW, GetTempPathW};

#[cfg(test)]
use windows_sys::Wdk::Storage::FileSystem::NtSetInformationFile;
#[cfg(test)]
use windows_sys::Win32::Foundation::STATUS_PENDING;
#[cfg(test)]
use windows_sys::Win32::Foundation::{CloseHandle, LocalFree};
use windows_sys::Win32::Foundation::{
    ERROR_FILE_NOT_FOUND, ERROR_NO_MORE_FILES, WAIT_ABANDONED, WAIT_OBJECT_0, WAIT_TIMEOUT,
};
use windows_sys::Win32::Foundation::{GetLastError, HANDLE, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Security::Authorization::SE_KERNEL_OBJECT;
#[cfg(test)]
use windows_sys::Win32::Security::{
    ACCESS_ALLOWED_ACE, ACL, ACL_REVISION, ACL_SIZE_INFORMATION, AclSizeInformation,
    AddAccessAllowedAceEx, GetAce, GetAclInformation, GetSecurityDescriptorControl,
    GetSecurityDescriptorDacl, GetSecurityDescriptorOwner, InitializeAcl,
    InitializeSecurityDescriptor, SE_DACL_PROTECTED, SECURITY_ATTRIBUTES, SECURITY_DESCRIPTOR,
    SetSecurityDescriptorControl, SetSecurityDescriptorDacl, SetSecurityDescriptorOwner,
};
#[cfg(test)]
use windows_sys::Win32::Storage::FileSystem::{
    CREATE_NEW, CreateFileW, DELETE, FILE_FLAG_OPEN_REPARSE_POINT, FILE_GENERIC_WRITE,
    FILE_SHARE_DELETE, FILE_SHARE_WRITE, FlushFileBuffers, WriteFile,
};
#[cfg(test)]
use windows_sys::Win32::Storage::FileSystem::{
    FILE_ALL_ACCESS, FILE_FLAG_BACKUP_SEMANTICS, OPEN_EXISTING,
};
use windows_sys::Win32::Storage::FileSystem::{
    FILE_ATTRIBUTE_DIRECTORY, FILE_GENERIC_READ, FILE_SHARE_READ, READ_CONTROL,
};
#[cfg(test)]
use windows_sys::Win32::Storage::FileSystem::{FILE_ATTRIBUTE_REPARSE_POINT, FILE_READ_ATTRIBUTES};
use windows_sys::Win32::Storage::FileSystem::{
    FILE_FLAG_FIRST_PIPE_INSTANCE, FindClose, FindFirstFileW, FindNextFileW, GetFileSizeEx,
    PIPE_ACCESS_DUPLEX, SYNCHRONIZE, WIN32_FIND_DATAW,
};
#[cfg(test)]
use windows_sys::Win32::System::IO::IO_STATUS_BLOCK;
use windows_sys::Win32::System::Pipes::{CreateNamedPipeW, PIPE_REJECT_REMOTE_CLIENTS};
#[cfg(test)]
use windows_sys::Win32::System::Threading::INFINITE;
use windows_sys::Win32::System::Threading::{
    CreateMutexExW, MUTEX_ALL_ACCESS, MUTEX_MODIFY_STATE, ReleaseMutex, WaitForSingleObject,
};

#[cfg(test)]
#[path = "../../../../tests/fixtures/host_namespace_creation.rs"]
mod host_namespace_creation_tests;

#[cfg(test)]
#[path = "../../../../tests/fixtures/windows_protection.rs"]
mod protection_tests;

#[cfg(test)]
use crate::host_record::protected_file::{
    MAX_HOST_MARKER_OBSERVATION_BYTES, read_terminal_bounded_bytes,
};
use crate::host_record::protected_file::{MAX_RECORD_BYTES, read_terminal_bytes};
#[cfg(test)]
use crate::protocol::host_record::KNOWN_FIXTURE_SHA256;
const MAX_RECORD_ENTRIES: u32 = 1024;
const MAX_TOTAL_RECORD_BYTES: u64 = 8 * 1024 * 1024;
const CAPACITY_WAIT_MS: u32 = 2000;
std::thread_local! {
    static CAPACITY_ACTION_ACTIVE: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// 保存排他の取得・同期処置・終端を別に保持する。
///
/// @responsibility Mutex取得だけを保存完了または資源不存在にしない。
/// @trace ARCH-000011
/// @shape create発行、handle取得、wait返却、所有取得、closure開始、release/close初回確認。
/// @invariant 取得済みと処置許可を分け、終了falseを後の成功で上書きしない。
/// @boundary Native同期保存区間の内部結果。
/// @security Path、自由Mutex名、Authorityを公開しない。
/// @compatibility 公開Protocolへ未接続の私有型。
#[derive(Clone, Debug, Default, Eq, PartialEq)]
struct TerminalCapacityReceipt {
    create_issued: bool,
    handle_acquired: bool,
    wait_result: Option<u32>,
    ownership_acquired: bool,
    action_started: bool,
    release_confirmed: Option<bool>,
    close_confirmed: Option<bool>,
}

/// 排他区間の失敗と発行済み処置を保持する。
///
/// @responsibility 終了不明を処置前拒否へ畳まない。
/// @trace ARCH-000011
/// @shape 支配する固定理由、取得／処置の元理由と今回receipt。
/// @invariant 保存closure開始は終了不明でも保持する。
/// @boundary 内部Native→未接続の上位保存処理。
/// @security 失敗から別参照や削除Authorityを発行しない。
/// @compatibility 生のOS errorを持たない私有型。
#[derive(Debug)]
struct TerminalCapacityFailure {
    reason: &'static str,
    operation_reason: Option<&'static str>,
    receipt: TerminalCapacityReceipt,
}

/// 利用者と保持Directoryの不変部分から排他名を決める。
///
/// @responsibility session・日時・属性の変化で同じ保存先を別排他に分断しない。
/// @trace ARCH-000011
/// @input OS取得SIDと保持Directoryの五field/属性Identity。
/// @returns 用途固定Global名、またはhash観測不能。
/// @precondition Directory guardが実体を保持する。
/// @postcondition hashへvolume/file-index三fieldだけを含める。
/// @effect BCryptによる局所hash。記録作成0。
/// @failure hash資源/計算不明は停止する。
/// @invariant creation timeと属性は別のfresh照合条件である。
/// @boundary Native→Windows BCryptとKernel namespace。
/// @security 利用者SIDやPathはnameへ平文にしない。
/// @concurrency 同じ利用者・Directoryなら全sessionで同じ名になる。
fn terminal_capacity_name(
    user: &[u8],
    identity: DirectoryIdentity,
) -> Result<Vec<u16>, &'static str> {
    let length = u64::try_from(user.len())
        .map_err(|_| "terminal_capacity_name_invalid")?
        .to_be_bytes();
    let volume = identity.volume_serial_number.to_be_bytes();
    let high = identity.file_index_high.to_be_bytes();
    let low = identity.file_index_low.to_be_bytes();
    let digest = sha256(&[
        b"CRDD\0HOST-TERMINAL-CAPACITY\0V1\0",
        &length,
        user,
        &volume,
        &high,
        &low,
    ])
    .ok_or("terminal_capacity_hash_unknown")?;
    let mut name = String::from("Global\\CRDD.HostTerminal.Capacity.v1.");
    for byte in digest {
        name.push_str(&format!("{byte:02x}"));
    }
    let mut wide: Vec<u16> = name.encode_utf16().collect();
    wide.push(0);
    Ok(wide)
}

/// 同threadのMutex所有と自己handleを一回ずつ終端させる。
///
/// @responsibility release失敗をclose成功で正常化しない。
/// @trace ARCH-000011
/// @input 私有handleと今回receipt。
/// @returns ownership解放とhandle終了がともに確認できたか。
/// @precondition wait返却後、同threadで保留処置がなく、closureの利用が終端している。
/// @postcondition 初回結果を単調保持し、不明ならProcessの追加保存を拒否する。
/// @effect 所有取得時だけReleaseMutex、続いて自己CloseHandle。
/// @failure 各API失敗を別falseとして保持する。
/// @invariant Global objectや全Process資源の不存在を主張しない。
/// @boundary Native→Windows synchronization API。
/// @security 他thread、他handleまたはFilesystemの削除を行わない。
/// @concurrency same-thread ownershipの一回終端。
fn settle_terminal_capacity(
    handle: &mut OwnedHandle,
    receipt: &mut TerminalCapacityReceipt,
) -> bool {
    if receipt.ownership_acquired && receipt.release_confirmed.is_none() {
        // SAFETY: the same synchronous thread acquired this private mutex once.
        receipt.release_confirmed = Some(unsafe { ReleaseMutex(handle.0) } != 0);
    }
    if receipt.close_confirmed.is_none() {
        receipt.close_confirmed = Some(close_terminal_handle(handle));
    }
    let settled = (!receipt.ownership_acquired || receipt.release_confirmed == Some(true))
        && receipt.close_confirmed == Some(true);
    if !settled {
        CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
    }
    settled
}

/// Directory保持中の一つの同期区間を同じNative threadで排他する。
///
/// @responsibility 取得、fresh保護、同期処置、明示終端を同じOwnerへ結ぶ。
/// @trace ARCH-000011
/// @input 保持Directoryと、戻り値をResult<()>へ限定した同期closure。捕捉資源の移出防止と実終端は利用側が別途保証する。
/// @returns 同期処置の今回receipt、または固定理由とreceipt。
/// @precondition 上位のcaller耐久参照/Authority/固定namespaceは別途成立している。
/// @postcondition 正常取得後だけclosureへ進み、終了不明を成功へ畳まない。
/// @effect 用途限定Mutexのcreate/open/wait/release/closeとclosureの限定処置。
/// @failure timeout、abandoned、保護不明、closure失敗と終了不明を区別する。
/// @invariant Mutexを容量適合、非使用または削除許可へ昇格しない。
/// @boundary 私有Native→Windows Kernel object。
/// @security 初期所有指定0、固定access、既存objectにもfresh protected二ACE照合。
/// @concurrency raw handleを外へ渡さず、同thread同期closureを実終端まで保持する。
fn with_terminal_capacity(
    directory: &TerminalDirectory,
    action: impl FnOnce() -> Result<(), &'static str>,
) -> Result<TerminalCapacityReceipt, TerminalCapacityFailure> {
    let mut receipt = TerminalCapacityReceipt::default();
    let prepared = (|| {
        if CAPACITY_SETTLEMENT_UNKNOWN.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("terminal_capacity_prior_settlement_unknown");
        }
        if CAPACITY_ACTION_ACTIVE.get() {
            return Err("terminal_capacity_recursive_acquisition");
        }
        directory.verify()?;
        terminal_capacity_name(&directory.user, directory.identity)
    })();
    let name = prepared.map_err(|reason| TerminalCapacityFailure {
        reason,
        operation_reason: Some(reason),
        receipt: receipt.clone(),
    })?;
    let created = with_terminal_access_descriptor(
        &directory.user,
        &directory.system,
        MUTEX_ALL_ACCESS,
        |attributes| {
            receipt.create_issued = true;
            // SAFETY: fixed bounded name, live descriptor; initial ownership is not requested.
            let handle = unsafe {
                CreateMutexExW(
                    attributes,
                    name.as_ptr(),
                    0,
                    READ_CONTROL | SYNCHRONIZE | MUTEX_MODIFY_STATE,
                )
            };
            if handle.is_null() {
                return Err("terminal_capacity_create_failed");
            }
            Ok(OwnedHandle(handle))
        },
    );
    let mut handle = created.map_err(|reason| TerminalCapacityFailure {
        reason,
        operation_reason: Some(reason),
        receipt: receipt.clone(),
    })?;
    receipt.handle_acquired = true;
    let observed = (|| {
        verify_terminal_object_protection(
            handle.0,
            &directory.user,
            &directory.system,
            SE_KERNEL_OBJECT,
            MUTEX_ALL_ACCESS,
        )?;
        // SAFETY: owned valid synchronization handle; no concurrent close; finite single wait.
        let result = unsafe { WaitForSingleObject(handle.0, CAPACITY_WAIT_MS) };
        receipt.wait_result = Some(result);
        receipt.ownership_acquired = result == WAIT_OBJECT_0 || result == WAIT_ABANDONED;
        match result {
            WAIT_OBJECT_0 => {
                verify_terminal_object_protection(
                    handle.0,
                    &directory.user,
                    &directory.system,
                    SE_KERNEL_OBJECT,
                    MUTEX_ALL_ACCESS,
                )?;
                directory.verify()?;
                #[cfg(test)]
                tests::pause_capacity_permission();
                // This read is the permission decision; already permitted actions are not cancelled.
                if CAPACITY_SETTLEMENT_UNKNOWN.load(std::sync::atomic::Ordering::SeqCst) {
                    return Err("terminal_capacity_prior_settlement_unknown");
                }
                Ok(())
            }
            WAIT_ABANDONED => Err("terminal_capacity_abandoned"),
            WAIT_TIMEOUT => Err("terminal_capacity_timeout"),
            _ => Err("terminal_capacity_wait_unknown"),
        }
    })();
    if let Err(reason) = observed {
        let settled = settle_terminal_capacity(&mut handle, &mut receipt);
        return finish_terminal_capacity(Err(reason), settled, receipt);
    }
    receipt.action_started = true;
    CAPACITY_ACTION_ACTIVE.set(true);
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(action));
    let settled = settle_terminal_capacity(&mut handle, &mut receipt);
    CAPACITY_ACTION_ACTIVE.set(false);
    let result = match outcome {
        Ok(result) => result,
        Err(panic) => std::panic::resume_unwind(panic),
    };
    finish_terminal_capacity(result, settled, receipt)
}

/// 取得／処置と終端の同時失敗を分けて返す。
///
/// @responsibility 終端不明を支配理由にしても元の失敗原因を消さない。
/// @trace ARCH-000011
/// @input 同期処置または取得後観測の結果、終端確認と単調receipt。
/// @returns 両方成立したreceipt、または別fieldに保持した二原因。
/// @precondition 所有者が同じ同期区間の終端を試した後である。
/// @postcondition 発行済み処置と初回終端結果をそのまま保持する。
/// @effect N/A: 私有する値の合成のみ。
/// @failure 取得／処置失敗と終端失敗の双方を区別する。
/// @invariant この合成でProcess poisonを解除しない。
/// @boundary 私有Native同期区間→その呼出し元。
/// @security 生Path、API出力とAuthorityを追加しない。
/// @concurrency 終端後の一意所有値だけを消費する。
fn finish_terminal_capacity(
    result: Result<(), &'static str>,
    settled: bool,
    receipt: TerminalCapacityReceipt,
) -> Result<TerminalCapacityReceipt, TerminalCapacityFailure> {
    let operation_reason = result.err();
    if !settled {
        return Err(TerminalCapacityFailure {
            reason: "terminal_capacity_settlement_unknown",
            operation_reason,
            receipt,
        });
    }
    match operation_reason {
        None => Ok(receipt),
        Some(reason) => Err(TerminalCapacityFailure {
            reason,
            operation_reason,
            receipt,
        }),
    }
}

/// 容量計数の観測と各取得資源の終了を保持する。
///
/// @responsibility 部分計数と完全列挙を区別し、終了不明を保存許可にしない。
/// @trace ARCH-000011
/// @shape 物理名数、総byte、同参照の存在、列挙完了、search取得/終了、reader取得/終了件数と終了不明。
/// @invariant 二名が同実体でも二entryとして数え、close不明を後の成功で消さない。
/// @boundary 私有Native計数→同期保存Owner。
/// @security Schema適合、非使用、削除Authorityを表さない。
/// @compatibility 公開Protocol未接続。全producerの容量保証ではない。
#[derive(Clone, Debug, Default, Eq, PartialEq)]
struct TerminalInventoryReceipt {
    entries: u32,
    bytes: u64,
    reference_present: bool,
    enumeration_complete: bool,
    search_acquired: bool,
    search_close_confirmed: Option<bool>,
    readers_opened: u32,
    readers_closed: u32,
    reader_close_unknown: bool,
}

/// 計数失敗とその前後の取得・終了を分ける。
///
/// @responsibility 観測失敗と資源終了失敗が重なっても元理由を保持する。
/// @trace ARCH-000011
/// @shape 支配理由、元観測理由、部分inventory receipt。
/// @invariant 部分集計から新stage作成を許可しない。
/// @boundary Native inventory→同じ保存区間。
/// @security 生Pathとfile内容を外へ出さない。
/// @compatibility 私有型。公開Recovery結果ではない。
#[derive(Debug)]
struct TerminalInventoryFailure {
    reason: &'static str,
    operation_reason: Option<&'static str>,
    receipt: TerminalInventoryReceipt,
}

/// FindClose専用の列挙handleを一意所有する。
///
/// @responsibility Kernel CloseHandleと列挙終了を混同しない。
/// @trace ARCH-000011
/// @shape search handleと初回FindClose結果。
/// @invariant 初回falseをDropの成功へ書き換えない。
/// @boundary Windows列挙API→私有Owner。
/// @security 別のhandleや対象fileを処置しない。
/// @compatibility OwnedHandleへ変換しない。
struct TerminalSearch {
    handle: HANDLE,
    close_confirmed: Option<bool>,
}

impl TerminalSearch {
    /// 自己所有search handleの終了を一回確認する。
    ///
    /// @responsibility 列挙失敗時もFindCloseを試し、未確認では追加保存を止める。
    /// @trace ARCH-000011
    /// @input 有効な自己所有search handle。
    /// @returns 初回FindCloseの成否。
    /// @precondition FindNextFileWが保留していない同期区間である。
    /// @postcondition 初回結果を保持し、成功時だけslotを空にする。
    /// @effect このsearch handleだけへFindClose。
    /// @failure falseではProcess容量poisonを設定する。
    /// @invariant Dropや後続終了で初回不明を正常化しない。
    /// @boundary Native→Windows FindClose。
    /// @security file削除、別参照とAuthorityを発行しない。
    /// @concurrency 一意所有の同期処理だけ。
    fn close(&mut self) -> bool {
        if let Some(closed) = self.close_confirmed {
            return closed;
        }
        // SAFETY: unique valid search handle; no pending enumeration call.
        let closed = unsafe { FindClose(self.handle) } != 0;
        self.close_confirmed = Some(closed);
        if closed {
            self.handle = INVALID_HANDLE_VALUE;
        } else {
            CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
        }
        closed
    }
}

impl Drop for TerminalSearch {
    /// 明示終了へ到達しなかった列挙だけの終了を試す。
    ///
    /// @responsibility unwind中も未終了の自己handleだけを扱う。
    /// @trace ARCH-000011
    /// @input 一意所有search。
    /// @returns N/A: Dropは値を返さない。
    /// @precondition 同期列挙呼出しは返却済みである。
    /// @postcondition 初回結果を上書きしない。
    /// @effect 未評価時だけFindCloseを試す。
    /// @failure close不明はProcess poison。公開成功の根拠にしない。
    /// @invariant 明示終了成功やpanic時の実観測を捏造しない。
    /// @boundary Native Owner→Windows search handle。
    /// @security 他資源とfile内容へ処置しない。
    /// @concurrency 一意所有の破棄時だけ。
    fn drop(&mut self) {
        if self.close_confirmed.is_none() {
            self.close();
        }
    }
}

/// 新規一物理名を予約できるか固定上限で判定する。
///
/// @responsibility 文書、entryとbyteの各上限・overflowを作成前に拒否する。
/// @trace ARCH-000008
/// @input 完全計数後のentry/byteと新文書byte数。
/// @returns 固定上限内だけOk。
/// @precondition 実計数は同じMutex内で完了済みで、全参加writerが同排他を使う。
/// @postcondition 1024entry/8MiBを超える予約を認めない。
/// @effect N/A: 値の検査だけ。
/// @failure 0/8192超文書、加算overflowと上限超過。
/// @invariant 容量超過から削除・参照変更・Authorityを発行しない。
/// @boundary Native inventory→stage作成前Gate。
/// @security この判定を既存文書のSchema適合へ昇格しない。
/// @concurrency 実計数からwriter終了まで同じ同期排他が必要。
fn check_terminal_reservation(
    entries: u32,
    bytes: u64,
    new_bytes: usize,
) -> Result<(), &'static str> {
    if new_bytes == 0 || new_bytes > MAX_RECORD_BYTES {
        return Err("terminal_bytes_invalid");
    }
    let entries = entries
        .checked_add(1)
        .ok_or("terminal_entry_count_overflow")?;
    let bytes = bytes
        .checked_add(new_bytes as u64)
        .ok_or("terminal_byte_count_overflow")?;
    if entries > MAX_RECORD_ENTRIES {
        return Err("terminal_entry_capacity_full");
    }
    if bytes > MAX_TOTAL_RECORD_BYTES {
        return Err("terminal_byte_capacity_full");
    }
    Ok(())
}

/// canonicalな二種類の物理名だけを計数対象にする。
///
/// @responsibility 列挙された自由leafをPathや別用途fileへ解釈しない。
/// @trace ARCH-000008
/// @input 列挙済みleaf文字列。
/// @returns 同じ参照とstage/publicの別。
/// @precondition UTF-16の終端とUTF-8変換を厳格に確認済み。
/// @postcondition UUIDv4・lowercase・単純leafだけを認める。
/// @effect N/A: 文字列検査だけ。
/// @failure 未知suffix、参照不正と非canonical名は拒否。
/// @invariant 二名を同一entryへ畳まない。
/// @boundary Windows列挙名→私有計数。
/// @security slash/colon/aliasを名前として受理しない。
/// @concurrency N/A: 私有値だけ。
fn terminal_inventory_leaf(leaf: &str) -> Result<(&str, bool), &'static str> {
    let (reference, public) = if let Some(reference) = leaf.strip_suffix(".stage") {
        (reference, false)
    } else if let Some(reference) = leaf.strip_suffix(".json") {
        (reference, true)
    } else {
        return Err("terminal_inventory_unknown_entry");
    };
    let (stage, published) = terminal_names(reference)?;
    if leaf != if public { &published } else { &stage } {
        return Err("terminal_inventory_name_invalid");
    }
    Ok((reference, public))
}

/// 同じ保持Directoryの物理名とfreshなfileサイズを計数する。
///
/// @responsibility 列挙完了、各file保護と全観測資源終了を共同条件にする。
/// @trace ARCH-000011
/// @input 保持Directoryとcaller既知の同参照。
/// @returns 完全inventory、または部分receiptと両失敗理由。
/// @precondition 共通Mutexを保持する同期保存区間。固定namespace/全producerは別接続。
/// @postcondition stage0byteも数え、公開0byte・過大fileと不明を拒否する。
/// @effect FindFirst/Next/Close、read-only file open/metadata/closeだけ。
/// @failure 初回空集合と正常終端以外のerror、未知entry、保護/共有/サイズ/終了不明。
/// @invariant 列挙値をfresh属性にせず、容量からSchema/回復/非使用を推定しない。
/// @boundary 私有Native→Windows file enumeration/metadata。
/// @security childは同handleのnonreparse/owner/protected二ACEへ照合する。
/// @concurrency 非参加producerの変更防止は未成立で、観測を連続保証にしない。
fn inventory_terminal_records(
    directory: &TerminalDirectory,
    reference: &str,
) -> Result<TerminalInventoryReceipt, TerminalInventoryFailure> {
    let mut receipt = TerminalInventoryReceipt::default();
    let prepared = (|| {
        terminal_names(reference)?;
        directory.verify()?;
        let mut pattern: Vec<u16> = directory.path.join("*").as_os_str().encode_wide().collect();
        if pattern.is_empty() || pattern.len() >= 32767 || pattern.contains(&0) {
            return Err("terminal_path_invalid");
        }
        pattern.push(0);
        Ok(pattern)
    })();
    let pattern = prepared.map_err(|reason| TerminalInventoryFailure {
        reason,
        operation_reason: Some(reason),
        receipt: receipt.clone(),
    })?;
    let mut data = WIN32_FIND_DATAW::default();
    // SAFETY: bounded pattern and writable SDK output; search handle is immediately owned.
    let found = unsafe { FindFirstFileW(pattern.as_ptr(), &mut data) };
    if found == INVALID_HANDLE_VALUE {
        // SAFETY: capture the error directly after the failed enumeration request.
        let error = unsafe { GetLastError() };
        let empty = if error == ERROR_FILE_NOT_FOUND {
            directory.verify()
        } else {
            Err("terminal_inventory_start_unknown")
        };
        return match empty {
            Ok(()) => {
                receipt.enumeration_complete = true;
                Ok(receipt)
            }
            Err(reason) => Err(TerminalInventoryFailure {
                reason,
                operation_reason: Some(reason),
                receipt,
            }),
        };
    }
    receipt.search_acquired = true;
    let mut search = TerminalSearch {
        handle: found,
        close_confirmed: None,
    };
    let mut original_reason = None;
    let observed = (|| {
        let mut names = std::collections::BTreeSet::new();
        loop {
            let length = data
                .cFileName
                .iter()
                .position(|c| *c == 0)
                .ok_or("terminal_inventory_name_unterminated")?;
            let leaf = String::from_utf16(&data.cFileName[..length])
                .map_err(|_| "terminal_inventory_name_invalid")?;
            if leaf != "." && leaf != ".." {
                let (entry_reference, public) = terminal_inventory_leaf(&leaf)?;
                if !names.insert(leaf.clone()) {
                    return Err("terminal_inventory_duplicate_name");
                }
                if names.len() > MAX_RECORD_ENTRIES as usize {
                    return Err("terminal_entry_capacity_full");
                }
                receipt.reference_present |= entry_reference == reference;
                let mut reader = open_terminal_handle(
                    &directory.path.join(&leaf),
                    FILE_GENERIC_READ | READ_CONTROL,
                    FILE_SHARE_READ,
                )?;
                receipt.readers_opened += 1;
                let size = (|| {
                    let identity = terminal_identity(reader.0)?;
                    if identity.attributes & FILE_ATTRIBUTE_DIRECTORY != 0 {
                        return Err("terminal_inventory_not_file");
                    }
                    verify_terminal_protection(reader.0, &directory.user, &directory.system)?;
                    let mut size = 0_i64;
                    // SAFETY: uniquely owned synchronous file handle and writable local output.
                    if unsafe { GetFileSizeEx(reader.0, &mut size) } == 0
                        || size < 0
                        || size > MAX_RECORD_BYTES as i64
                        || (public && size == 0)
                    {
                        return Err("terminal_inventory_size_invalid");
                    }
                    if terminal_identity(reader.0)? != identity {
                        return Err("terminal_inventory_identity_mismatch");
                    }
                    Ok(size as u64)
                })();
                if !close_terminal_handle(&mut reader) {
                    receipt.reader_close_unknown = true;
                    original_reason = size.err();
                    CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
                    return Err("terminal_inventory_reader_close_unknown");
                }
                receipt.readers_closed += 1;
                let size = size?;
                receipt.entries = receipt
                    .entries
                    .checked_add(1)
                    .ok_or("terminal_entry_count_overflow")?;
                receipt.bytes = receipt
                    .bytes
                    .checked_add(size)
                    .ok_or("terminal_byte_count_overflow")?;
            }
            // SAFETY: valid unique search handle and writable output; synchronous enumeration.
            if unsafe { FindNextFileW(search.handle, &mut data) } == 0 {
                // SAFETY: capture directly after the failed call; only NO_MORE_FILES is normal.
                let error = unsafe { GetLastError() };
                if error != ERROR_NO_MORE_FILES {
                    return Err("terminal_inventory_next_unknown");
                }
                receipt.enumeration_complete = true;
                break;
            }
        }
        directory.verify()
    })();
    let closed = search.close();
    receipt.search_close_confirmed = Some(closed);
    let operation_reason = original_reason.or(observed.as_ref().err().copied());
    if !closed {
        return Err(TerminalInventoryFailure {
            reason: "terminal_inventory_search_close_unknown",
            operation_reason,
            receipt,
        });
    }
    observed
        .map(|()| receipt.clone())
        .map_err(|reason| TerminalInventoryFailure {
            reason,
            operation_reason,
            receipt,
        })
}

/// 一つの同期区間に結んだ保存の部分結果を保持する。
///
/// @responsibility 排他取得、計数、記録Effectとwriter終端を別々に保存する。
/// @trace ARCH-000008
/// @shape 同参照、任意の部分inventory/record receipt、capacity receipt。
/// @invariant Noneを不存在や処置前成功へ読み替えない。
/// @boundary 私有Native保存Owner→未接続の上位。
/// @security 回復/削除Authorityを含まない。
/// @compatibility 公開Protocol未接続の内部型。
#[derive(Clone, Debug)]
struct TerminalSaveReceipt {
    reference: String,
    inventory: Option<TerminalInventoryReceipt>,
    record: Option<TerminalReceipt>,
    capacity: TerminalCapacityReceipt,
}

/// 計数、記録処置と終了の共同失敗を保持する。
///
/// @responsibility 元の公開失敗をwriter/Mutex終了不明で消さない。
/// @trace ARCH-000008
/// @shape 支配理由、区間の元理由、inventory失敗、記録元理由、同参照の部分receipt。
/// @invariant 失敗後に清掃/別参照/再公開を自動実行しない。
/// @boundary 同期保存区間→内部consumer。
/// @security 生Path/bytes/Authorityを結果へ含めない。
/// @compatibility 公開Recoveryの成功結果ではない。
#[derive(Debug)]
struct TerminalSaveFailure {
    reason: &'static str,
    operation_reason: Option<&'static str>,
    inventory_failure: Option<TerminalInventoryFailure>,
    record_reason: Option<&'static str>,
    receipt: TerminalSaveReceipt,
}

/// 計数から公開writer終了まで同じ排他で保存する。
///
/// @responsibility writerを区間外へ移出せず、全条件成立時だけ保存成功を返す。
/// @trace ARCH-000008
/// @input 保持Directory、耐久接続済みの同参照、検証済み非秘密bytes。
/// @returns 完全保存receipt、または同参照の部分Effectと複数失敗理由。
/// @precondition Schema/producer/Authority/caller耐久性/固定namespaceは上位Ownerの責務。
/// @postcondition 共通Mutex内で列挙→予約→stage→公開照合→writer終了を行う。
/// @effect 用途限定排他と一件のcreate/write/flush/no-replace renameだけ。
/// @failure 上限、既参照、不明、公開/reader/writer/Mutex終了失敗で停止する。
/// @invariant 全producer接続前にRepository全体の容量保証を宣言しない。
/// @boundary 私有保存Owner→Windows記録primitive。
/// @security 別参照、任意Path、清掃またはAuthorityを発行しない。
/// @concurrency 全観測reader終了後の値は共通Mutex参加writerの範囲でだけ有効。
fn save_terminal_record(
    directory: &TerminalDirectory,
    reference: &str,
    bytes: &[u8],
) -> Result<TerminalSaveReceipt, Box<TerminalSaveFailure>> {
    save_terminal_record_checked(directory, reference, bytes, || Ok(()))
}

/// 保存排他内のstage作成直前に呼出し側のKnown再照合を行う。
///
/// @responsibility 既存の容量・非置換公開・終端を保持し、対象差替え時の記録作成を拒否する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 保護済み保存Directory、同参照、完全bytes、Known照合closure。
/// @returns 保存receipt、または全部分結果を保持した失敗。
/// @precondition 本番closureは十一実体・marker Hash・全対象closeを確認する。
/// @postcondition 再照合失敗はstage作成前に停止する。
/// @effect 保存排他、容量読取りと承認済み用途のcreate/write/flush/非置換rename。
/// @failure 再照合、容量、記録または資源終端の不明は停止。
/// @invariant 保存記録を非使用・削除Authority・過去Task成功へ昇格しない。
/// @boundary 専用保存入口→既存Native保存Owner。
/// @security 自由Pathや再試行を導入しない。
/// @concurrency 共通Mutexを保持した同じ同期保存区間で照合する。
fn save_terminal_record_checked(
    directory: &TerminalDirectory,
    reference: &str,
    bytes: &[u8],
    check_target: impl FnOnce() -> Result<(), &'static str>,
) -> Result<TerminalSaveReceipt, Box<TerminalSaveFailure>> {
    let mut receipt = TerminalSaveReceipt {
        reference: reference.to_owned(),
        inventory: None,
        record: None,
        capacity: TerminalCapacityReceipt::default(),
    };
    let mut inventory_failure = None;
    let mut record_reason = None;
    let result = with_terminal_capacity(directory, || {
        terminal_names(reference)?;
        if bytes.is_empty() || bytes.len() > MAX_RECORD_BYTES {
            return Err("terminal_bytes_invalid");
        }
        let inventory = match inventory_terminal_records(directory, reference) {
            Ok(inventory) => inventory,
            Err(failure) => {
                receipt.inventory = Some(failure.receipt.clone());
                let reason = failure.reason;
                inventory_failure = Some(failure);
                return Err(reason);
            }
        };
        receipt.inventory = Some(inventory.clone());
        if inventory.reference_present {
            return Err("terminal_record_already_present");
        }
        check_terminal_reservation(inventory.entries, inventory.bytes, bytes.len())?;
        check_target()?;
        let mut stage = match TerminalStage::create(directory, reference, bytes) {
            Ok(stage) => stage,
            Err(failure) => {
                record_reason = Some(failure.reason);
                if failure.receipt.handle_close_confirmed == Some(false) {
                    CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
                }
                receipt.record = Some(failure.receipt);
                return Err(failure.reason);
            }
        };
        #[cfg(test)]
        tests::pause_terminal_save();
        let published = stage.publish(bytes);
        record_reason = published.as_ref().err().map(|failure| failure.reason);
        let closed = stage.close();
        receipt.record = Some(stage.receipt.clone());
        if !closed {
            CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
            return Err("terminal_record_close_unknown");
        }
        published.map_err(|failure| failure.reason)
    });
    finish_terminal_save(receipt, result, inventory_failure, record_reason)
}

/// 同じ保存区間の部分結果と排他終了を合成する。
///
/// @responsibility 支配理由、計数失敗、公開元理由と各初回終了を共同保持する。
/// @trace ARCH-000008
/// @input 同じ参照の部分receipt、排他返却、任意の計数失敗と記録元理由。
/// @returns 全区間成功または複数理由と同参照の失敗。
/// @precondition 実保存本体がwriter終了とMutex終了を試した後だけ呼ぶ。
/// @postcondition 入力の元理由や発行済みreceiptを消さない。
/// @effect N/A: 私有値の合成だけ。
/// @failure 失敗を公開成功へ変換せず、そのまま保持する。
/// @invariant 参照、Root、marker、Authorityを新規生成しない。
/// @boundary 私有保存Owner→未接続のconsumer。
/// @security file内容や生Pathを結果へ含めない。
/// @concurrency 終了後の一意所有値を消費する。
fn finish_terminal_save(
    mut receipt: TerminalSaveReceipt,
    result: Result<TerminalCapacityReceipt, TerminalCapacityFailure>,
    inventory_failure: Option<TerminalInventoryFailure>,
    record_reason: Option<&'static str>,
) -> Result<TerminalSaveReceipt, Box<TerminalSaveFailure>> {
    match result {
        Ok(capacity) => {
            receipt.capacity = capacity;
            Ok(receipt)
        }
        Err(failure) => {
            receipt.capacity = failure.receipt;
            Err(Box::new(TerminalSaveFailure {
                reason: failure.reason,
                operation_reason: failure.operation_reason,
                inventory_failure,
                record_reason,
                receipt,
            }))
        }
    }
}

/// 専用要求を現在観測と資源終了の共同結果へ接続する。
///
/// @responsibility 外側namespaceと対象八handleの初回終了を応答前に集約する。
/// @trace ARCH-000011
/// @input 三独立期待実体、選択利用者、Root/markerの固定名。
/// @returns 全資源終了済みの現在Snapshot、または部分取得・元理由を持つ失敗。
/// @precondition 専用要求parserが形状・名前・上限を検証済み。
/// @postcondition 外側close不明でも元観測理由を消さず、成功値を返さない。
/// @effect 固定namespace、Root、marker、六childの読取りhandleを取得・終了する。
/// @failure 取得、実体・保護・利用者不一致、読取りまたはclose不明で停止する。
/// @invariant 現在観測を非使用、過去Task結合、保存または削除許可へ昇格しない。
/// @boundary Native用途限定入口→私有Windows観測→専用応答。
/// @security marker元bytesはHashだけ返し、PathやSIDは公開しない。
/// @concurrency 同期guardと対象handleを明示終了してから値を返す。
pub(crate) fn observe_target_request(
    request: &crate::protocol::host_record::TerminalRequest,
) -> crate::protocol::host_record::TerminalResponse {
    let mut directory = match open_target_namespace(request) {
        Ok(directory) => directory,
        Err(response) => return *response,
    };
    let observed =
        observe_terminal_target(&directory, &request.root_name, &request.marker_name, None);
    finish_target_response(request.nonce, &mut directory, Some(observed))
}

/// 既知fileを九handleの継続保持と専用応答へ接続する。
///
/// @responsibility file値・個別終了・外側終了を落とさず同じnonceへ結合する。
/// @trace ARCH-000011
/// @input revision 3専用要求。独立期待値はnamespaceだけである。
/// @returns 十二実体応答、または元理由と部分終了を持つ拒否。
/// @precondition 専用parserが名前と要求shapeを検証済み。
/// @postcondition 全九対象と外側終了の共同成立前にSnapshotを返さない。
/// @effect 固定対象へのread-only取得と明示close。変更・保存・削除0。
/// @failure 欠落、型・内容差、alias、使用競合、close不明を保持停止する。
/// @invariant 観測を他entry不存在・非使用・清掃許可へ昇格しない。
/// @boundary 専用Native mode→保持Windows観測→専用応答。
/// @security 自由Path・本文・SID・Authorityを返さない。
/// @concurrency 同期取得／読取り／終了。最終清掃の継続保持は別契約である。
pub(crate) fn observe_known_file_target_request(
    request: &crate::protocol::host_record::KnownFileTerminalRequest,
) -> crate::protocol::host_record::TerminalResponse<
    crate::protocol::host_record::KnownFileTerminalSnapshot,
> {
    let request = &request.target;
    let mut directory = match open_target_namespace(request) {
        Ok(directory) => directory,
        Err(response) => return *response,
    };
    let observed = observe_known_file_terminal_target(
        &directory,
        &request.root_name,
        &request.marker_name,
        None,
    );
    finish_target_response_core(
        request.nonce,
        &mut directory,
        Some(observed),
        9,
        |snapshot| snapshot,
    )
}

/// 共通の固定namespace取得と部分終了失敗を型ごとに保持する。
///
/// @responsibility Currentとnamespace-Knownの違いを保持して外側guardを取得する。
/// @trace ARCH-000011
/// @input nonce、固定名と三namespace／利用者の独立期待値。
/// @returns guard、または対象未取得の型付き失敗。
/// @precondition 専用parserからだけ呼び出す。
/// @postcondition 取得失敗の初回closeと元理由を失わない。
/// @effect 固定namespace／Tokenの取得・失敗時closeだけ。
/// @failure 期待値の部分欠落、実体・利用者・保護差、close不明は停止。
/// @invariant 成功から対象全体Knownを捏造しない。
/// @boundary 私有同期要求→Windows namespace。
/// @security 初期化、DACL変更、清掃、Authorityの発行0。
/// @concurrency guardの所有を呼出し元へ一回だけ移す。
fn open_target_namespace<S>(
    request: &crate::protocol::host_record::TerminalRequest,
) -> Result<TerminalDirectory, Box<crate::protocol::host_record::TerminalResponse<S>>> {
    use crate::protocol::host_record::TerminalResponse;
    let identity = |fields: [u32; 6]| DirectoryIdentity {
        volume_serial_number: fields[0],
        file_index_high: fields[1],
        file_index_low: fields[2],
        creation_time_low: fields[3],
        creation_time_high: fields[4],
        attributes: fields[5],
    };
    let opened = match (request.namespace, request.selected_user) {
        (Some(namespace), Some(selected_user)) => {
            TerminalDirectory::open_fixed_namespace(TerminalNamespaceIdentity {
                parent: identity(namespace[0]),
                recovery: identity(namespace[1]),
                terminal: identity(namespace[2]),
                selected_user,
            })
        }
        (None, None) => TerminalDirectory::capture_fixed_namespace(),
        _ => {
            return Err(Box::new(crate::protocol::host_record::rejected(
                request.nonce,
                "terminal_request_invalid",
                1,
            )));
        }
    };
    match opened {
        Ok(directory) => Ok(directory),
        Err(failure) => Err(Box::new(TerminalResponse {
            nonce: request.nonce,
            snapshot: None,
            phase: if failure.token_closes.contains(&false)
                || failure.directory_closes.contains(&false)
            {
                4
            } else {
                2
            },
            reason: failure.reason,
            operation_reason: Some(failure.operation_reason),
            position: None,
            target_acquired: 0,
            tokens_acquired: failure.tokens_acquired,
            directories_acquired: failure.directories_acquired,
            token_closes: failure.token_closes,
            directory_closes: failure.directory_closes,
            target_closes: Vec::new(),
        })),
    }
}

/// 対象観測の結果と外側guardの初回終了を結合する。
///
/// @responsibility 保存入口でも同じ資源返却契約を使い、未試行を成功へ変換しない。
/// @trace ARCH-000011
/// @input 相関nonce、保持Directory、観測の有無と部分結果。
/// @returns 外側closeを含む専用観測応答。
/// @precondition 保存処理がある場合は保存・Mutex終了後に呼ぶ。
/// @postcondition 外側close不明ではSnapshotを返さず元観測理由を保持する。
/// @effect 保持済みDirectory handleの明示closeのみ。
/// @failure 対象・Token・Directory終了不明を保持する。
/// @invariant 未試行を不存在、非使用またはEffect 0へ読み替えない。
/// @boundary Native同期Owner→閉応答。
/// @security Path、SID、本文、清掃許可を公開しない。
/// @concurrency 保持guardを一回だけ明示終了する。
fn finish_target_response(
    nonce: [u8; 32],
    directory: &mut TerminalDirectory,
    observed: Option<Result<TerminalTargetObservation, TerminalTargetFailure>>,
) -> crate::protocol::host_record::TerminalResponse {
    finish_target_response_core(nonce, directory, observed, 8, |snapshot| {
        crate::protocol::host_record::TerminalSnapshot {
            identities: snapshot.identities.map(terminal_identity_fields),
            selected_user: snapshot.selected_user,
            marker_sha256: snapshot.marker_sha256,
        }
    })
}

/// 同期対象結果と外側guard終了の相関を二入口で維持する。
///
/// @responsibility Snapshotの型を変換せず専用入口の終端結果を構築する。
/// @trace ARCH-000011
/// @input 型付き観測、内部の取得数、型ごとの搬送変換。
/// @returns 全close確認済みSnapshot、または元理由・部分結果。
/// @precondition 内部の旧八／新九対象入口だけが呼び出す。
/// @postcondition 外側終了不明では型にかかわらずSnapshotを出さない。
/// @effect 外側guardの明示closeのみ。
/// @failure 元観測失敗と外側close不明を共同保持する。
/// @invariant 型の縮約や成功値からの非使用認定をしない。
/// @boundary 私有Windows観測→用途限定応答。
/// @security Path・本文・SID・Authorityを出さない。
/// @concurrency 各資源の初回close列を一回だけ移す。
fn finish_target_response_core<S, T>(
    nonce: [u8; 32],
    directory: &mut TerminalDirectory,
    observed: Option<Result<TerminalTargetObservation<T>, TerminalTargetFailure>>,
    target_count: usize,
    convert: fn(T) -> S,
) -> crate::protocol::host_record::TerminalResponse<S> {
    use crate::protocol::host_record::TerminalResponse;
    let outer_closed = directory.close() && !directory.token_closes.contains(&false);
    let (snapshot, phase, reason, operation_reason, position, target_acquired, target_closes) =
        match observed {
            Some(Ok(observation)) => {
                let snapshot = outer_closed.then(|| convert(observation.snapshot));
                (
                    snapshot,
                    if outer_closed { 0 } else { 4 },
                    if outer_closed {
                        "terminal_target_observed"
                    } else {
                        "terminal_directory_close_unknown"
                    },
                    None,
                    None,
                    target_count,
                    observation.closes,
                )
            }
            Some(Err(failure)) => {
                let target_closed = failure.closes.len() == failure.handles_acquired
                    && !failure.closes.contains(&false);
                (
                    None,
                    if outer_closed && target_closed { 3 } else { 4 },
                    if outer_closed {
                        failure.reason
                    } else {
                        "terminal_directory_close_unknown"
                    },
                    if outer_closed {
                        failure.operation_reason
                    } else {
                        Some(failure.reason)
                    },
                    failure.position,
                    failure.handles_acquired,
                    failure.closes,
                )
            }
            None => (
                None,
                if outer_closed { 2 } else { 4 },
                if outer_closed {
                    "terminal_target_not_attempted"
                } else {
                    "terminal_directory_close_unknown"
                },
                None,
                None,
                0,
                Vec::new(),
            ),
        };
    TerminalResponse {
        nonce,
        snapshot,
        phase,
        reason,
        operation_reason,
        position,
        target_acquired,
        tokens_acquired: directory.token_closes.len(),
        directories_acquired: directory.handles.len(),
        token_closes: std::mem::take(&mut directory.token_closes),
        directory_closes: std::mem::take(&mut directory.directory_closes),
        target_closes,
    }
}

/// 六fieldの独立期待値をOS比較値へ変換する。
///
/// @responsibility Identityの全fieldを順序どおり保持する。
/// @trace ARCH-000011
/// @input parser確認済みの六u32。
/// @returns 対応するDirectoryIdentity。
/// @precondition 型・相異は専用parserが確認済み。
/// @postcondition fieldを省略・現在値で補完しない。
/// @effect N/A: 値の変換のみ。
/// @failure N/A: 固定長配列の全fieldをそのまま移す。
/// @invariant 値から由来・非使用・Authorityを推定しない。
/// @boundary 専用Protocol→私有OS期待値。
/// @security 自由Path・SIDを作らない。
/// @concurrency N/A: 所有値の純変換。
fn terminal_identity_from_fields(fields: [u32; 6]) -> DirectoryIdentity {
    DirectoryIdentity {
        volume_serial_number: fields[0],
        file_index_high: fields[1],
        file_index_low: fields[2],
        creation_time_low: fields[3],
        creation_time_high: fields[4],
        attributes: fields[5],
    }
}

/// 記録クラスから三namespaceの独立期待値だけを取り出す。
///
/// @responsibility 対象Knownと保存先namespaceの責務を区別する。
/// @trace ARCH-000011
/// @input 内部の十一または十二実体配列と選択利用者Hash。
/// @returns 固定namespaceの期待値。
/// @precondition 内部wrapperはN=11または12を固定しparser検査済み。
/// @postcondition 最初の三実体と利用者だけをnamespace取得へ渡す。
/// @effect N/A: 値構築だけ。
/// @failure N/A: 固定配列から取得する。
/// @invariant namespace一致を対象全体Known一致にしない。
/// @boundary 専用記録wrapper→固定namespace Owner。
/// @security 新規namespace・Authority・自由Pathを作らない。
/// @concurrency N/A: 不変配列だけ。
fn terminal_record_namespace<const N: usize>(
    identities: &[[u32; 6]; N],
    selected_user: [u8; 32],
) -> TerminalNamespaceIdentity {
    TerminalNamespaceIdentity {
        parent: terminal_identity_from_fields(identities[0]),
        recovery: terminal_identity_from_fields(identities[1]),
        terminal: terminal_identity_from_fields(identities[2]),
        selected_user,
    }
}

/// 全Known対象のfresh照合から同参照の保護済み保存までを実行する。
///
/// @responsibility 対象・容量・保存・外側終了を一応答へ保持し、部分成功を全体成功にしない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 専用parserが検証した完全bytesと十一対象のKnown期待値。
/// @returns 保存共同成立、または同参照と全部分receiptを持つ停止。
/// @precondition Node Ownerがcaller canonicalのfresh読取りとSchema・bindingsを照合済み。
/// @postcondition bytes Hash、固定namespace、stage直前Known、全closeを共同確認する。
/// @effect BCrypt Hash、固定namespaceの読取り、共通Mutexと一記録の保存。対象Root変更0。
/// @failure Hash差、対象差・未知、容量・公開・終端不明は停止。再送しない。
/// @invariant 保存成功は回復・非使用・削除・Runtime Authorityを意味しない。
/// @boundary 専用Native保存mode→既存Windows保存Owner。
/// @security namespace初期化、ACL修復、自由Path、Process停止または清掃を行わない。
/// @concurrency 同じMutex区間でfresh再照合し、外側guardを保存終了まで保持する。
pub(crate) fn save_target_request(
    request: &crate::protocol::host_record::TerminalSaveRequest,
) -> crate::protocol::host_record::TerminalSaveResponse {
    let known = TerminalTargetSnapshot {
        root_name: request.root_name.clone(),
        marker_name: request.marker_name.clone(),
        identities: request.known.identities.map(terminal_identity_from_fields),
        selected_user: request.known.selected_user,
        marker_sha256: request.known.marker_sha256,
    };
    save_record_request_core(
        request,
        terminal_record_namespace(&request.known.identities, request.known.selected_user),
        |directory| {
            observe_terminal_target(
                directory,
                &request.root_name,
                &request.marker_name,
                Some(&known),
            )
        },
        8,
        |snapshot| crate::protocol::host_record::TerminalSnapshot {
            identities: snapshot.identities.map(terminal_identity_fields),
            selected_user: snapshot.selected_user,
            marker_sha256: snapshot.marker_sha256,
        },
    )
}

/// 全十二Knownの照合を保存直前Gateへ接続する。
///
/// @responsibility fileを含む独立期待値の全一致前にはstageを作らない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 専用parserが確認した十二実体要求と完全bytes。
/// @returns 同参照・部分receipt・九対象終了を保持した保存結果。
/// @precondition caller本文Schemaと耐久性はCoordinatorが確認済み。
/// @postcondition 十二Known差・file差・close不明では保存を止める。
/// @effect 固定namespaceへの一記録保存。対象Root変更0。
/// @failure Hash、対象、容量、公開、終了不明は同参照で停止する。
/// @invariant Current／namespace-Knownを全対象Knownへ補完しない。
/// @boundary 専用保存mode→既存容量／writer Owner。
/// @security 自由Path・namespace修復・清掃・Authority発行なし。
/// @concurrency 同じ保存Mutex内で九handle観測を完了する。
pub(crate) fn save_known_file_target_request(
    request: &crate::protocol::host_record::TerminalSaveRequest<
        crate::protocol::host_record::KnownFileTerminalSnapshot,
    >,
) -> crate::protocol::host_record::TerminalSaveResponse<
    crate::protocol::host_record::KnownFileTerminalSnapshot,
> {
    save_record_request_core(
        request,
        terminal_record_namespace(&request.known.identities, request.known.selected_user),
        |directory| {
            observe_known_file_terminal_target(
                directory,
                &request.root_name,
                &request.marker_name,
                Some(&request.known),
            )
        },
        9,
        |snapshot| snapshot,
    )
}

/// 二対象クラスの保存を同じ容量・公開・終了Ownerへ接続する。
///
/// @responsibility 型付きGateをstage前に評価し全部分結果を保持する。
/// @trace ARCH-000008
/// @input 完全要求、独立namespace、クラス固有観測と搬送変換。
/// @returns 保存共同成立、または部分receipt付き停止。
/// @precondition 専用wrapperだけがGate・取得数・変換を固定する。
/// @postcondition body HashをOS取得前に照合し、同参照を維持する。
/// @effect 固定namespace読取り、共通Mutex、一記録保存と各close。
/// @failure 元保存失敗・観測失敗・終了不明を失わない。
/// @invariant 既存writerの非置換・容量制限を緩めない。
/// @boundary 私有同期保存Owner。
/// @security 対象の変更・削除・権限修復は行わない。
/// @concurrency 既存Mutexを保存終了まで保持する。
fn save_record_request_core<S, T>(
    request: &crate::protocol::host_record::TerminalSaveRequest<S>,
    namespace: TerminalNamespaceIdentity,
    observe: impl FnOnce(
        &TerminalDirectory,
    ) -> Result<TerminalTargetObservation<T>, TerminalTargetFailure>,
    target_count: usize,
    convert: fn(T) -> S,
) -> crate::protocol::host_record::TerminalSaveResponse<S> {
    use crate::protocol::host_record::{TerminalResponse, TerminalSaveResponse};
    let refused = |reason| TerminalSaveResponse {
        reference: Some(request.reference.clone()),
        saved: false,
        reasons: [reason, "", "", "", ""],
        observation: crate::protocol::host_record::rejected(request.nonce, reason, 1),
        receipt: None,
    };
    if sha256(&[&request.bytes]) != Some(request.bytes_sha256) {
        return refused("terminal_save_bytes_hash_unconfirmed");
    }
    let mut directory = match TerminalDirectory::open_fixed_namespace(namespace) {
        Ok(directory) => directory,
        Err(failure) => {
            return TerminalSaveResponse {
                reference: Some(request.reference.clone()),
                saved: false,
                reasons: [failure.reason, failure.operation_reason, "", "", ""],
                receipt: None,
                observation: TerminalResponse {
                    nonce: request.nonce,
                    snapshot: None,
                    phase: if failure.token_closes.contains(&false)
                        || failure.directory_closes.contains(&false)
                    {
                        4
                    } else {
                        2
                    },
                    reason: failure.reason,
                    operation_reason: Some(failure.operation_reason),
                    position: None,
                    target_acquired: 0,
                    tokens_acquired: failure.tokens_acquired,
                    directories_acquired: failure.directories_acquired,
                    token_closes: failure.token_closes,
                    directory_closes: failure.directory_closes,
                    target_closes: Vec::new(),
                },
            };
        }
    };
    let mut observed = None;
    let result =
        save_terminal_record_checked(&directory, &request.reference, &request.bytes, || {
            let value = observe(&directory);
            let outcome = value.as_ref().map(|_| ()).map_err(|failure| failure.reason);
            observed = Some(value);
            outcome
        });
    let observation = finish_target_response_core(
        request.nonce,
        &mut directory,
        observed,
        target_count,
        convert,
    );
    let mut reasons = ["terminal_record_saved", "", "", "", ""];
    let is_saved = result.is_ok() && observation.snapshot.is_some();
    let receipt = match result {
        Ok(receipt) => receipt,
        Err(failure) => {
            reasons = [
                failure.reason,
                failure.operation_reason.unwrap_or(""),
                failure.record_reason.unwrap_or(""),
                failure
                    .inventory_failure
                    .as_ref()
                    .map_or("", |value| value.reason),
                failure
                    .inventory_failure
                    .as_ref()
                    .and_then(|value| value.operation_reason)
                    .unwrap_or(""),
            ];
            failure.receipt
        }
    };
    TerminalSaveResponse {
        reference: Some(request.reference.clone()),
        saved: is_saved,
        reasons,
        observation,
        receipt: Some(encode_terminal_save_receipt(&receipt)),
    }
}

/// 同じcaller bytesに一致する現在記録だけを読戻す。
///
/// @responsibility Root/marker消失後も記録の現在観測と今回終了を保持する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 同参照、独立完全bytes/Hash、namespace三Known実体と選択利用者。
/// @returns 現在Prepared/Published、記録Identityと個別終了、または部分結果付き停止。
/// @precondition caller canonicalのSchema・bindingsをNode Ownerがfresh確認済み。
/// @postcondition 記録の唯一名・保護・完全bytesと現在Identityを確認し全guardを終了する。
/// @effect 固定namespaceと記録の読取り、同世代Kernel排他の取得・解放。Filesystem作成・保存・対象取得・削除は0。
/// @failure 内容/保護/実体不一致、二名、欠落、unknown・close不明は停止する。
/// @invariant 対象未試行は対象不存在・非使用ではなく、記録観測はAuthorityではない。
/// @boundary 専用読戻しmode→既存Windows現在候補Reader。
/// @security 自由Path、元Token再発行、ACL修復、復元、再公開を行わない。
/// @concurrency 同世代排他と同期reader保持内で照合し、close後不変性を主張しない。
pub(crate) fn read_record_request(
    request: &crate::protocol::host_record::TerminalSaveRequest,
) -> crate::protocol::host_record::TerminalReadResponse {
    read_record_request_core(
        request,
        terminal_record_namespace(&request.known.identities, request.known.selected_user),
    )
}

/// 十二実体のcaller記録を対象Root消失後も読戻す。
///
/// @responsibility file期待値を本文結合として保持し対象を再取得しない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 同参照・独立完全bytes・専用十二実体要求。
/// @returns 現在記録とReader／外側／世代排他終了の部分結果。
/// @precondition Coordinatorがcaller Schemaとbindingsを確認済み。
/// @postcondition Root／marker／六child／fileの取得0を保持する。
/// @effect 固定namespace・現在記録の読取りと同世代排他だけ。
/// @failure 不一致・欠落・取得／終了不明は同参照で停止する。
/// @invariant 読取り成功を清掃成功・非使用・Authorityにしない。
/// @boundary 専用読取りmode→既存現在記録Reader。
/// @security 保存・復元・再公開・削除・初期化なし。
/// @concurrency Readerと世代排他をこの同期処理内で終了する。
pub(crate) fn read_known_file_record_request(
    request: &crate::protocol::host_record::TerminalSaveRequest<
        crate::protocol::host_record::KnownFileTerminalSnapshot,
    >,
) -> crate::protocol::host_record::TerminalReadResponse<
    crate::protocol::host_record::KnownFileTerminalSnapshot,
> {
    read_record_request_core(
        request,
        terminal_record_namespace(&request.known.identities, request.known.selected_user),
    )
}

/// 同参照の記録読戻しを対象クラスに依存せず実行する。
///
/// @responsibility namespaceと現在記録だけを取得し同じ終了条件を守る。
/// @trace ARCH-000008
/// @input 型付き要求、独立namespace期待値。
/// @returns 専用型の対象未試行応答と現在Reader結果。
/// @precondition 専用parserとNode Schema検査から呼び出す。
/// @postcondition 独立bytesを前提に唯一名・現在Identityを照合する。
/// @effect 固定namespace／Reader／Kernel排他の取得と終了のみ。
/// @failure 元理由・部分取得・初回close不明を保持する。
/// @invariant 対象のKnown期待値を対象存在前提へ変更しない。
/// @boundary 私有記録Reader。
/// @security Filesystem作成・削除・権限修復0。
/// @concurrency 同世代排他をReaderと外側終了後に解放する。
fn read_record_request_core<S>(
    request: &crate::protocol::host_record::TerminalSaveRequest<S>,
    namespace: TerminalNamespaceIdentity,
) -> crate::protocol::host_record::TerminalReadResponse<S> {
    use crate::protocol::host_record::{TerminalReadResponse, TerminalResponse};
    let mut response = TerminalReadResponse {
        reference: Some(request.reference.clone()),
        observed: false,
        state: 0,
        reason: "terminal_read_bytes_hash_unconfirmed",
        operation_reason: None,
        record_identity: None,
        open_issued: false,
        opened: false,
        reader_close: None,
        generation_acquired: false,
        generation_close: None,
        observation: crate::protocol::host_record::rejected(
            request.nonce,
            "terminal_read_bytes_hash_unconfirmed",
            1,
        ),
    };
    if sha256(&[&request.bytes]) != Some(request.bytes_sha256) {
        return response;
    }
    let mut directory = match TerminalDirectory::open_fixed_namespace(namespace) {
        Ok(directory) => directory,
        Err(failure) => {
            response.reason = failure.reason;
            response.operation_reason = Some(failure.operation_reason);
            response.observation = TerminalResponse {
                nonce: request.nonce,
                snapshot: None,
                phase: if failure.token_closes.contains(&false)
                    || failure.directory_closes.contains(&false)
                {
                    4
                } else {
                    2
                },
                reason: failure.reason,
                operation_reason: Some(failure.operation_reason),
                position: None,
                target_acquired: 0,
                tokens_acquired: failure.tokens_acquired,
                directories_acquired: failure.directories_acquired,
                token_closes: failure.token_closes,
                directory_closes: failure.directory_closes,
                target_closes: Vec::new(),
            };
            return response;
        }
    };
    let mut generation = match open_terminal_generation(
        &directory.user,
        &directory.system,
        &request.root_name,
        &request.marker_name,
    ) {
        Ok(handle) => handle,
        Err(reason) => {
            response.reason = reason;
            response.observation = finish_target_response_core(
                request.nonce,
                &mut directory,
                None,
                0,
                |snapshot: S| snapshot,
            );
            return response;
        }
    };
    response.generation_acquired = true;
    match TerminalCurrentCandidate::open(&directory, &request.reference, &request.bytes) {
        Ok(mut candidate) => {
            let current = candidate.current_identity;
            response.state = match candidate.record.state {
                TerminalObservedState::Prepared => 1,
                TerminalObservedState::Published => 2,
            };
            response.record_identity = Some([
                current.volume_serial_number,
                current.file_index_high,
                current.file_index_low,
                current.creation_time_low,
                current.creation_time_high,
                current.attributes,
            ]);
            response.open_issued = true;
            response.opened = true;
            let closed = candidate.close();
            response.reader_close = Some(closed);
            response.reason = if closed {
                "terminal_record_observed"
            } else {
                "terminal_record_reader_close_unknown"
            };
        }
        Err(failure) => {
            response.reason = failure.reason;
            response.open_issued = failure.open_issued;
            response.opened = failure.opened;
            response.reader_close = failure.close_confirmed;
        }
    }
    response.observation =
        finish_target_response_core(request.nonce, &mut directory, None, 0, |snapshot: S| {
            snapshot
        });
    let generation_closed = close_terminal_handle(&mut generation);
    response.generation_close = Some(generation_closed);
    if !generation_closed {
        response.operation_reason = Some(response.reason);
        response.reason = "terminal_generation_close_unknown";
    }
    response.observed = response.reason == "terminal_record_observed"
        && generation_closed
        && response.observation.phase == 2
        && response.observation.reason == "terminal_target_not_attempted";
    response
}

/// 旧世代の排他を、処置を所有するNative自身で保持する。
///
/// @responsibility Node親の喪失で別Processが排他だけを先に解放する構造を避ける。
/// @trace ARCH-000008
/// @trace ARCH-000015
/// @input 保持namespaceの二SID、固定Root名と対応marker名。
/// @returns 唯一所有する同期pipe handle、または固定拒否。
/// @precondition 名前以外の非使用・由来・人間承認は別条件として確認する。
/// @postcondition 既存HostOperationと同じHashへ結合し、継承・remote client・二番目のinstanceを許可しない。
/// @effect 用途限定Kernel pipe一個の作成。Connect/Read/Write待機とFilesystem変更は0。
/// @failure 名前対応、Hash、descriptorまたはCreateNamedPipe不明・競合で停止する。
/// @invariant 排他取得は当初Process終了、対象非使用、元Authorityまたは清掃許可ではない。
/// @boundary Native同期Owner→Windows Kernel namespace。
/// @security caller指定pipe名を受け付けず、作成時から選択利用者とSYSTEMだけの非継承DACLを持つ。
/// @concurrency FIRST_PIPE_INSTANCEと一instanceを要求し、借用終了まで同じhandleを保持する。
fn open_terminal_generation(
    user: &[u8],
    system: &[u8],
    root_name: &str,
    marker_name: &str,
) -> Result<OwnedHandle, &'static str> {
    let nonce = root_name
        .strip_prefix("crdd-coordinator-doctor-")
        .filter(|value| {
            crate::protocol::host_record::valid_reference(&format!("host-terminal.{value}"))
        })
        .ok_or("terminal_generation_binding_invalid")?;
    let nonce_hash = sha256(&[nonce.as_bytes()]).ok_or("terminal_generation_hash_unknown")?;
    let hex = |bytes: &[u8]| {
        bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    };
    if marker_name != format!("host-{}.json", hex(&nonce_hash)) {
        return Err("terminal_generation_binding_invalid");
    }
    let binding = sha256(&[
        b"crdd-host-operation-generation-v1\0",
        root_name.as_bytes(),
        b"\0",
        nonce.as_bytes(),
    ])
    .ok_or("terminal_generation_hash_unknown")?;
    let name = format!(
        r"\\.\pipe\CRDD.Coordinator.HostOperation.{}",
        hex(&binding[..16])
    );
    let wide: Vec<u16> = name.encode_utf16().chain(std::iter::once(0)).collect();
    with_terminal_descriptor(user, system, |attributes| {
        // SAFETY: fixed bounded name, live descriptor, no inheritable or pending I/O handle.
        let handle = unsafe {
            CreateNamedPipeW(
                wide.as_ptr(),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_REJECT_REMOTE_CLIENTS,
                1,
                1,
                1,
                0,
                attributes,
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            return Err("terminal_generation_acquisition_unconfirmed");
        }
        Ok(OwnedHandle(handle))
    })
}

/// 保存の既発行Effectと個別終端を固定52bytesへ保持する。
///
/// @responsibility Mutex・計数・記録の未試行とfalseを分け、部分結果を欠落させない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 同じ保存Ownerが取得した部分receipt。
/// @returns capacity 11、inventory 26、record 15bytesの閉形式。
/// @precondition 同参照と元理由は外側応答が所有する。
/// @postcondition boolは0/1、Option<bool>は0/1/2、Optional数値はpresence＋値で表す。
/// @effect N/A: memory上のcopyのみ。
/// @failure N/A: 型と固定配列が長さを保証する。
/// @invariant 未取得・未試行を成功や不存在へ畳まない。
/// @boundary 私有Windows receipt→専用Protocol。
/// @security 生Path、SID、本文またはAuthorityは含めない。
/// @concurrency N/A: 終了後の不変借用。
fn encode_terminal_save_receipt(
    receipt: &TerminalSaveReceipt,
) -> [u8; crate::protocol::host_record::SAVE_RECEIPT_BYTES] {
    let mut bytes = [0; crate::protocol::host_record::SAVE_RECEIPT_BYTES];
    let optional = |value: Option<bool>| value.map_or(2, u8::from);
    let capacity = &receipt.capacity;
    bytes[..4].copy_from_slice(&[
        u8::from(capacity.create_issued),
        u8::from(capacity.handle_acquired),
        u8::from(capacity.ownership_acquired),
        u8::from(capacity.action_started),
    ]);
    bytes[4] = u8::from(capacity.wait_result.is_some());
    bytes[5..9].copy_from_slice(&capacity.wait_result.unwrap_or(0).to_le_bytes());
    bytes[9] = optional(capacity.release_confirmed);
    bytes[10] = optional(capacity.close_confirmed);
    if let Some(inventory) = &receipt.inventory {
        bytes[11] = 1;
        bytes[12..16].copy_from_slice(&inventory.entries.to_le_bytes());
        bytes[16..24].copy_from_slice(&inventory.bytes.to_le_bytes());
        bytes[24..27].copy_from_slice(&[
            u8::from(inventory.reference_present),
            u8::from(inventory.enumeration_complete),
            u8::from(inventory.search_acquired),
        ]);
        bytes[27] = optional(inventory.search_close_confirmed);
        bytes[28..32].copy_from_slice(&inventory.readers_opened.to_le_bytes());
        bytes[32..36].copy_from_slice(&inventory.readers_closed.to_le_bytes());
        bytes[36] = u8::from(inventory.reader_close_unknown);
    }
    if let Some(record) = &receipt.record {
        bytes[37] = 1;
        bytes[38..44].copy_from_slice(&[
            u8::from(record.stage_created),
            u8::from(record.write_issued),
            u8::from(record.flush_issued),
            u8::from(record.rename_issued),
            u8::from(record.stage_absence_verified),
            u8::from(record.publication_verified),
        ]);
        bytes[44] = u8::from(record.rename_nt_status.is_some());
        bytes[45..49].copy_from_slice(&record.rename_nt_status.unwrap_or(0).to_le_bytes());
        bytes[49] = optional(record.reader_close_confirmed);
        bytes[50] = optional(record.record_handle_close_confirmed);
        bytes[51] = optional(record.handle_close_confirmed);
    }
    bytes
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
#[path = "../../../../tests/integration/host-record.rs"]
mod tests;
