//! Host終端記録の同一実体への書込みと非置換公開を所有する。
//!
//! @responsibility 私有する同期handleと親chainを保持し、既発行Effectと確認済み結果を分ける。専用観測・記録保存へ接続するが、回収Authorityは提供しない。
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @trace ARCH-000015
use crate::filesystem::host_namespace::{
    CAPACITY_SETTLEMENT_UNKNOWN, TerminalDirectory, TerminalNamespaceIdentity,
    TerminalTargetFailure, TerminalTargetObservation, TerminalTargetSnapshot,
    observe_known_file_terminal_target, observe_terminal_target, terminal_identity_fields,
};
#[cfg(test)]
use crate::filesystem::host_namespace::{
    TERMINAL_TARGET_CHILDREN, TerminalKnownFileSnapshot, finish_terminal_target_observation,
    observe_terminal_known_file, validate_terminal_target_identities,
    validate_terminal_target_names,
};
use crate::filesystem::protected_file::{
    TerminalReceipt, TerminalStage, close_terminal_handle, observe_terminal_presence,
    open_terminal_handle, terminal_identity, terminal_names, verify_terminal_object_protection,
    verify_terminal_protection, with_terminal_access_descriptor, with_terminal_descriptor,
};

#[cfg(test)]
use crate::filesystem::host_namespace::{
    HostNamespaceChild, create_host_namespace_child, host_namespace_at_parent,
};
#[cfg(test)]
use crate::filesystem::host_namespace::{
    decode_terminal_temporary_parent, validate_terminal_namespace,
};
#[cfg(test)]
use crate::filesystem::protected_file::terminal_presence_result;
#[cfg(test)]
use crate::filesystem::protection::root_information;
#[cfg(test)]
use crate::filesystem::protection::{ACCESS_ALLOWED_ACE_TYPE, bounded_ace_sid};
use crate::filesystem::protection::{DirectoryIdentity, OwnedHandle, sha256};
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
#[path = "../../tests/fixtures/host_namespace_creation.rs"]
mod host_namespace_creation_tests;

#[cfg(test)]
#[path = "../../tests/fixtures/windows_protection.rs"]
mod protection_tests;

#[cfg(test)]
use crate::filesystem::protected_file::{
    MAX_HOST_MARKER_OBSERVATION_BYTES, read_terminal_bounded_bytes,
};
use crate::filesystem::protected_file::{MAX_RECORD_BYTES, read_terminal_bytes};
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
mod tests {
    use super::*;
    use std::fs;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_DISPOSITION_INFO, FileDispositionInfo, SetFileInformationByHandle,
    };

    /// 自己生成試験のOwnerが渡したRepository-local実領域と実行物を照合する。
    ///
    /// @responsibility 書込み前にcwd、Git境界、UUID run、祖先と実行物位置を固定する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition Ownerが実Directoryのfresh runと通常target試験実行物を用意する。
    /// @stimulus CRDD_TERMINAL_FIXTURE_ROOTとcwd/current_exeを読取る。
    /// @observation Git marker、各祖先の種別/reparse属性、UUIDと実行物位置。
    /// @oracle 検証済みcwd直下の.crdd/tests/native-terminal-UUIDだけを返す。
    /// @cleanup 読取りだけで作成・変更・削除しない。
    /// @boundary cfg(test)の自己生成試験専用。歴史診断とproduction入口へ適用しない。
    fn terminal_fixture_context() -> (PathBuf, PathBuf, PathBuf) {
        use std::os::windows::fs::MetadataExt;
        let repository = std::env::current_dir().unwrap();
        let git_marker = fs::symlink_metadata(repository.join(".git")).unwrap();
        assert!(git_marker.is_dir() || git_marker.is_file());
        assert_eq!(git_marker.file_attributes() & 0x400, 0);
        let run = PathBuf::from(
            std::env::var("CRDD_TERMINAL_FIXTURE_ROOT").expect("fixture run root required"),
        );
        assert_eq!(run.parent().unwrap(), repository.join(".crdd/tests"));
        let name = run.file_name().unwrap().to_str().unwrap();
        let uuid = name.strip_prefix("native-terminal-").unwrap();
        assert_eq!(uuid.len(), 36);
        assert!(uuid.bytes().enumerate().all(|(index, byte)| {
            if [8, 13, 18, 23].contains(&index) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        }));
        for ancestor in run.ancestors() {
            let metadata = fs::symlink_metadata(ancestor).unwrap();
            assert!(metadata.is_dir());
            assert_eq!(metadata.file_attributes() & 0x400, 0);
            if ancestor != repository && ancestor.starts_with(&repository) {
                assert!(matches!(
                    fs::symlink_metadata(ancestor.join(".git")),
                    Err(error) if error.kind() == std::io::ErrorKind::NotFound
                ));
            }
        }
        let binary = std::env::current_exe().unwrap();
        assert_eq!(
            binary.parent().unwrap(),
            repository.join("40_Develop/platform-access/target/x86_64-pc-windows-msvc/debug/deps")
        );
        for ancestor in binary.parent().unwrap().ancestors() {
            let metadata = fs::symlink_metadata(ancestor).unwrap();
            assert!(metadata.is_dir());
            assert_eq!(metadata.file_attributes() & 0x400, 0);
        }
        let metadata = fs::symlink_metadata(&binary).unwrap();
        assert!(metadata.is_file());
        assert_eq!(metadata.file_attributes() & 0x400, 0);
        (repository, run, binary)
    }

    /// 自己生成した旧世代名だけでKernel排他の競合と終端を実測する。
    ///
    /// @responsibility 排他取得を実領域の非使用や処置Authorityへ昇格しない。
    /// @trace ERB-IT-001
    /// @precondition Windows試験Processの二tokenからSIDを読取り、先に明示closeする。
    /// @stimulus fresh UUIDの固定pipeを取得し、同世代の再取得、別世代の取得、解放後再取得と名前不一致を与える。
    /// @observation 各取得結果、同handleの保護、個別closeの実返却値。
    /// @oracle 同世代の重複だけ拒否し、別世代と解放後は取得可能。全所有handleを明示closeする。
    /// @cleanup 試験で作成したKernel handleのみ終了。Filesystem、実残存、DockerとProviderへ接続しない。
    /// @boundary Native→実Windows Named Pipe。Node旧Supervisorとの相互運用は別の確認を要する。
    #[test]
    fn terminal_generation_exclusion_and_release() {
        let (mut primary, mut impersonation) = process_tokens().unwrap();
        let user = token_user_sid_bytes(primary.0).unwrap();
        let system = local_system_sid_bytes().unwrap();
        let token_closes = [
            close_terminal_handle(&mut impersonation),
            close_terminal_handle(&mut primary),
        ];
        assert_eq!(token_closes, [true; 2]);
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let unique = sha256(&[&now.to_le_bytes(), &std::process::id().to_le_bytes()]).unwrap();
        let hex = |bytes: &[u8]| {
            bytes
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>()
        };
        let nonce = format!(
            "{}-{}-4{}-a{}-{}",
            hex(&unique[..4]),
            hex(&unique[4..6]),
            &hex(&unique[6..8])[1..],
            &hex(&unique[8..10])[1..],
            hex(&unique[10..16]),
        );
        let root = format!("crdd-coordinator-doctor-{nonce}");
        let marker = format!("host-{}.json", hex(&sha256(&[nonce.as_bytes()]).unwrap()));
        assert_eq!(
            open_terminal_generation(&user, &system, &root, "host-invalid.json").err(),
            Some("terminal_generation_binding_invalid"),
        );
        let mut first = open_terminal_generation(&user, &system, &root, &marker).unwrap();
        let protection = verify_terminal_protection(first.0, &user, &system);
        let duplicate = open_terminal_generation(&user, &system, &root, &marker);
        let mut other_nonce = nonce.clone();
        other_nonce.replace_range(0..1, if &nonce[..1] == "0" { "1" } else { "0" });
        let other_root = format!("crdd-coordinator-doctor-{other_nonce}");
        let other_marker = format!(
            "host-{}.json",
            hex(&sha256(&[other_nonce.as_bytes()]).unwrap())
        );
        let mut other =
            open_terminal_generation(&user, &system, &other_root, &other_marker).unwrap();
        let other_close = close_terminal_handle(&mut other);
        let first_close = close_terminal_handle(&mut first);
        assert_eq!(protection, Ok(()));
        assert_eq!(
            duplicate.err(),
            Some("terminal_generation_acquisition_unconfirmed")
        );
        assert!(other_close && first_close);
        let mut reacquired = open_terminal_generation(&user, &system, &root, &marker).unwrap();
        assert!(close_terminal_handle(&mut reacquired));
    }

    /// 既存Node実装とNative実装の同世代排他を双方向に確認する。
    ///
    /// @responsibility 同じ名前への結合だけでなく、実取得の競合と解放後の再取得を観測する。
    /// @trace ERB-IT-001
    /// @precondition 専用Ownerが固定Node実体とSHA-256を指定し、静的検査を完了する。
    /// @stimulus fresh UUIDで同期Worker・非同期SupervisorとNativeの取得を両方向で試す。
    /// @observation 固定返答、childのexit、Nativeの個別closeと解放後の再取得。
    /// @oracle 両方向の競合だけ拒否し、保持終了後は両実装で再取得できる。
    /// @cleanup Nodeは制御EOFまたは10秒期限で解放し、Ownerはchild終了と全Native closeを確認する。
    /// @boundary 固定Nodeの本番Worker・Supervisorと実Windows Named Pipe。既存三Rootは対象外。
    #[test]
    #[ignore = "fixed Node identity and dedicated interoperation owner required"]
    fn terminal_generation_node_interoperation() {
        use std::io::{BufRead, Read, Write};
        use std::process::{Command, Stdio};

        let node = std::path::PathBuf::from(
            std::env::var("CRDD_TEST_NODE_BINARY").expect("fixed Node binary required"),
        );
        let expected_hash =
            std::env::var("CRDD_TEST_NODE_SHA256").expect("fixed Node binary hash required");
        assert!(node.is_absolute());
        assert!(fs::symlink_metadata(&node).unwrap().is_file());
        let hex = |bytes: &[u8]| {
            bytes
                .iter()
                .map(|byte| format!("{byte:02x}"))
                .collect::<String>()
        };
        let node_hash = hex(&sha256(&[&fs::read(&node).unwrap()]).unwrap());
        assert_eq!(node_hash, expected_hash);
        let source = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../coordinator/tests/fixtures/host-terminal-generation-worker.ts")
            .canonicalize()
            .unwrap();
        // Node CLI does not accept Rust's Windows verbatim path as a script path.
        let source_argument = source
            .to_str()
            .and_then(|value| value.strip_prefix(r"\\?\"))
            .filter(|value| {
                value.as_bytes().get(1) == Some(&b':') && value.as_bytes().get(2) == Some(&b'\\')
            })
            .expect("canonical local-drive fixture path required");
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let unique = sha256(&[&now.to_le_bytes(), &std::process::id().to_le_bytes()]).unwrap();
        let nonce = format!(
            "{}-{}-4{}-a{}-{}",
            hex(&unique[..4]),
            hex(&unique[4..6]),
            &hex(&unique[6..8])[1..],
            &hex(&unique[8..10])[1..],
            hex(&unique[10..16]),
        );
        let root = format!("crdd-coordinator-doctor-{nonce}");
        let marker = format!("host-{}.json", hex(&sha256(&[nonce.as_bytes()]).unwrap()));
        let (mut primary, mut impersonation) = process_tokens().unwrap();
        let user = token_user_sid_bytes(primary.0).unwrap();
        let system = local_system_sid_bytes().unwrap();
        let token_closes = [
            close_terminal_handle(&mut impersonation),
            close_terminal_handle(&mut primary),
        ];
        assert_eq!(token_closes, [true; 2]);
        let command = |mode: &str| {
            let mut command = Command::new(&node);
            command
                .env_clear()
                .arg(source_argument)
                .arg(&root)
                .arg(&nonce)
                .arg(mode)
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::null());
            for key in ["SystemRoot", "WINDIR"] {
                if let Some(value) = std::env::var_os(key) {
                    command.env(key, value);
                }
            }
            command
        };

        for (once_mode, hold_mode) in [("once", "hold"), ("supervisor-once", "supervisor-hold")] {
            let mut native = open_terminal_generation(&user, &system, &root, &marker).unwrap();
            let node_blocked = command(once_mode).output();
            let native_closed = close_terminal_handle(&mut native);
            let node_blocked = node_blocked.unwrap();
            assert!(native_closed);
            assert!(node_blocked.status.success());
            assert_eq!(node_blocked.stdout, b"busy\n");

            let node_after_native = command(once_mode).output().unwrap();
            assert!(node_after_native.status.success());
            assert_eq!(node_after_native.stdout, b"released\n");

            let mut child = command(hold_mode).spawn().unwrap();
            let mut reader = std::io::BufReader::new(child.stdout.take().unwrap());
            let mut ready = String::new();
            let ready_result = reader.read_line(&mut ready);
            let mut native_during_node = if ready_result.is_ok() && ready == "held\n" {
                open_terminal_generation(&user, &system, &root, &marker)
            } else {
                Err("terminal_node_fixture_not_held")
            };
            let unexpected_close = native_during_node.as_mut().ok().map(close_terminal_handle);
            let control_result = child.stdin.take().unwrap().write_all(b"release\n");
            let mut tail = String::new();
            let tail_result = reader.take(256).read_to_string(&mut tail);
            let child_status = child.wait().unwrap();
            assert!(ready_result.is_ok() && control_result.is_ok() && tail_result.is_ok());
            assert_eq!(ready, "held\n");
            assert_eq!(unexpected_close, None);
            assert_eq!(
                native_during_node.err(),
                Some("terminal_generation_acquisition_unconfirmed")
            );
            assert!(child_status.success());
            assert_eq!(tail, "released\n");

            let mut native_after_node =
                open_terminal_generation(&user, &system, &root, &marker).unwrap();
            assert!(close_terminal_handle(&mut native_after_node));
        }
        assert_eq!(
            hex(&sha256(&[&fs::read(&node).unwrap()]).unwrap()),
            node_hash
        );
    }

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

    /// 対象名、十一位置の種別と全pair重複を純値で確認する。
    ///
    /// @responsibility 値の反例を実reparse/OS終了故障の証拠にしない。
    /// @trace ERB-IT-002
    /// @precondition OS資源を取得しない。
    /// @stimulus 名前境界、全位置の種別/reparse、全五十五pairのalias。
    /// @observation 本番の値検査Helperの返却。
    /// @oracle 固定名・正常位置だけ受理し全反例を拒否する。
    /// @cleanup N/A: 値検査のみ。
    /// @boundary 私有Nativeの準備処理。公開Authorityと実OS故障は未検証。
    #[test]
    fn terminal_target_value_contract() {
        let marker = format!("host-{}.json", "a".repeat(64));
        for suffix in ["a".to_owned(), "A_1-".to_owned(), "a".repeat(96)] {
            assert_eq!(
                validate_terminal_target_names(
                    &format!("crdd-coordinator-doctor-{suffix}"),
                    &marker
                ),
                Ok(())
            );
        }
        for root in [
            "crdd-coordinator-doctor-".to_owned(),
            format!("crdd-coordinator-doctor-{}", "a".repeat(97)),
            "crdd-coordinator-doctor-../x".to_owned(),
            "crdd-coordinator-doctor-a\\b".to_owned(),
            "crdd-coordinator-doctor-日本語".to_owned(),
            "C:/crdd-coordinator-doctor-x".to_owned(),
        ] {
            assert_eq!(
                validate_terminal_target_names(&root, &marker),
                Err("terminal_target_name_invalid")
            );
        }
        for invalid in [
            format!("host-{}.json", "A".repeat(64)),
            format!("host-{}.json", "a".repeat(63)),
            format!("host-{}.json", "a".repeat(65)),
            format!("host-{}.json", "g".repeat(64)),
            format!("../host-{}.json", "a".repeat(64)),
        ] {
            assert_eq!(
                validate_terminal_target_names("crdd-coordinator-doctor-x", &invalid),
                Err("terminal_target_name_invalid")
            );
        }
        let identities = std::array::from_fn(|position| DirectoryIdentity {
            volume_serial_number: 1,
            file_index_high: 0,
            file_index_low: position as u32 + 1,
            creation_time_low: 2,
            creation_time_high: 3,
            attributes: if position == 4 {
                windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL
            } else {
                FILE_ATTRIBUTE_DIRECTORY
            },
        });
        assert_eq!(validate_terminal_target_identities(&identities), Ok(()));
        for position in 0..11 {
            let mut invalid = identities;
            invalid[position].attributes ^= FILE_ATTRIBUTE_DIRECTORY;
            assert_eq!(
                validate_terminal_target_identities(&invalid),
                Err("terminal_target_type_invalid")
            );
            invalid = identities;
            invalid[position].attributes |= FILE_ATTRIBUTE_REPARSE_POINT;
            assert_eq!(
                validate_terminal_target_identities(&invalid),
                Err("terminal_target_type_invalid")
            );
        }
        for left in 0..11 {
            for right in left + 1..11 {
                let mut invalid = identities;
                invalid[right].volume_serial_number = invalid[left].volume_serial_number;
                invalid[right].file_index_high = invalid[left].file_index_high;
                invalid[right].file_index_low = invalid[left].file_index_low;
                invalid[right].creation_time_low = 999;
                assert_eq!(
                    validate_terminal_target_identities(&invalid),
                    Err("terminal_target_identity_duplicate")
                );
            }
        }
    }

    /// 自作十一実体で対象一式のCurrent/Knownと部分取得終了を観測する。
    ///
    /// @responsibility 実読取り、fixture変更、終了モデルを分けて結果へ保存する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 固定Node Ownerと新しいrepo-local親。TEMP/TMPをtarget-r3へ結び、通常利用者Tokenで一回実行する。
    /// @stimulus 正常十一観測、全位置五field/属性、Hash/利用者、八位置欠落/種別、marker長境界。
    /// @observation 独立Identity・元bytes Hash、八個別close、部分取得数と失敗位置。
    /// @oracle 独立Knownだけ一致し、反例の取得済み全handleを明示終了する。
    /// @cleanup 自作対象を実体再照合後に非再帰清掃。不明時は固定fixtureだけ保持する。
    /// @boundary unsigned私有Native。原子的Snapshot、非使用、実reparse/close/read故障、公開Recoveryは未検証。
    #[test]
    #[ignore = "Fixed target fixture; explicit Node owner required"]
    fn terminal_target_fixture() {
        const RUN: &str = "target.261004.9da03fb1.r3";
        const ROOT_NAME: &str = "crdd-coordinator-doctor-fixture_9da03fb1";
        assert_eq!(
            std::env::var("CRDD_TERMINAL_TARGET_RUN").as_deref(),
            Ok(RUN)
        );
        let (_, run_root, _) = terminal_fixture_context();
        let parent_path = run_root.join("target-r3");
        let parent = parent_path.as_path();
        let mut temporary_buffer = [0_u16; 4097];
        // SAFETY: bounded writable buffer; validate the real namespace transport before fixture Effect.
        let temporary_length =
            unsafe { GetTempPathW(temporary_buffer.len() as u32, temporary_buffer.as_mut_ptr()) };
        assert_eq!(
            decode_terminal_temporary_parent(&temporary_buffer, temporary_length).unwrap(),
            parent,
            "fixture temporary namespace must match target-r3"
        );
        let recovery = parent.join("crdd-coordinator-recovery-v1");
        let terminal = recovery.join("terminal-v1");
        let root = parent.join(ROOT_NAME);
        let marker_name = format!("host-{}.json", "b".repeat(64));
        let marker = recovery.join(&marker_name);
        let bytes = b"{\"fixture\":\"opaque LF bytes, not authority\"}\n";
        let mut paths = vec![
            parent.to_path_buf(),
            recovery,
            terminal,
            root.clone(),
            marker.clone(),
        ];
        paths.extend(TERMINAL_TARGET_CHILDREN.map(|name| root.join(name)));
        let mut phase = "preflight";
        let mut closes = Vec::new();
        let mut rejects = Vec::<TerminalTargetFailure>::new();
        let mut created = 0;
        let mut cleaned = 0;
        let mut replacements_created = 0;
        let mut replacements_cleaned = 0;
        let mut replacement_cleanup_model_cases = 0;
        let mut settlement_model_cases = 0;
        let mut normal = 0;
        let mut maximum_verified = false;
        let mut settlement_model_verified = false;
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_eq!(observe_terminal_presence(parent), Ok(false));
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            let binding = selected_user_token_binding(primary.0, impersonation.0);
            closes.push((
                "fixture_token_impersonation",
                close_terminal_handle(&mut impersonation),
            ));
            closes.push(("fixture_token_primary", close_terminal_handle(&mut primary)));
            assert!(closes.iter().all(|(_, closed)| *closed));
            let selected_user = binding
                .expect("fixture selected-user profile unavailable")
                .principal_identity_hash;
            phase = "create";
            for (position, path) in paths.iter().enumerate() {
                assert_eq!(observe_terminal_presence(path), Ok(false));
                if position == 4 {
                    let mut file = fs::OpenOptions::new()
                        .write(true)
                        .create_new(true)
                        .open(path)
                        .unwrap();
                    std::io::Write::write_all(&mut file, bytes).unwrap();
                    file.sync_all().unwrap();
                    drop(file);
                } else {
                    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
                    wide.push(0);
                    with_terminal_descriptor(&user, &system, |attributes| {
                        // SAFETY: fresh fixed fixture child, live descriptor.
                        if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                            return Err("fixture_directory_create_failed");
                        }
                        Ok(())
                    })
                    .unwrap();
                }
                created += 1;
            }
            let identities: [DirectoryIdentity; 11] = paths
                .iter()
                .map(|path| observe_fixture_identity(path, &mut closes))
                .collect::<Vec<_>>()
                .try_into()
                .unwrap();
            let namespace = TerminalNamespaceIdentity {
                parent: identities[0],
                recovery: identities[1],
                terminal: identities[2],
                selected_user,
            };
            let expected = TerminalTargetSnapshot {
                root_name: ROOT_NAME.to_owned(),
                marker_name: marker_name.clone(),
                identities,
                selected_user,
                marker_sha256: sha256(&[bytes]).unwrap(),
            };
            phase = "normal";
            let request = crate::protocol::host_record::TerminalRequest {
                nonce: [9; 32],
                root_name: ROOT_NAME.to_owned(),
                marker_name: marker_name.clone(),
                namespace: None,
                selected_user: None,
            };
            let captured = observe_target_request(&request);
            assert_eq!(captured.phase, 0);
            assert_eq!(captured.reason, "terminal_target_observed");
            assert_eq!(captured.nonce, [9; 32]);
            assert_eq!(captured.target_acquired, 8);
            assert_eq!(captured.tokens_acquired, 2);
            assert_eq!(captured.token_closes, [true; 2]);
            assert_eq!(captured.target_closes, [true; 8]);
            assert_eq!(
                captured.directory_closes.len(),
                captured.directories_acquired
            );
            assert!(captured.directory_closes.iter().all(|closed| *closed));
            let snapshot = captured.snapshot.unwrap();
            assert_eq!(snapshot.selected_user, selected_user);
            assert_eq!(snapshot.marker_sha256, expected.marker_sha256);
            for (position, actual) in snapshot.identities.iter().enumerate() {
                let identity = identities[position];
                assert_eq!(
                    *actual,
                    [
                        identity.volume_serial_number,
                        identity.file_index_high,
                        identity.file_index_low,
                        identity.creation_time_low,
                        identity.creation_time_high,
                        identity.attributes
                    ]
                );
            }
            closes.push(("current_protocol_namespace_chain", true));
            normal += 1;
            phase = "known_file_twelve_entities";
            let file_path = root.join("workspace").join("fixture.txt");
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&file_path)
                .unwrap();
            std::io::Write::write_all(&mut file, b"BEFORE\n").unwrap();
            file.sync_all().unwrap();
            drop(file);
            let file_identity = observe_fixture_identity(&file_path, &mut closes);
            let known_file = crate::protocol::host_record::KnownFileTerminalSnapshot {
                identities: std::array::from_fn(|position| {
                    terminal_identity_fields(if position == 11 {
                        file_identity
                    } else {
                        identities[position]
                    })
                }),
                selected_user,
                marker_sha256: expected.marker_sha256,
                file_byte_length: 7,
                file_link_count: 1,
                file_sha256: KNOWN_FIXTURE_SHA256,
            };
            let dedicated = crate::protocol::host_record::KnownFileTerminalRequest {
                target: request.clone(),
            };
            for namespace_known in [false, true] {
                let mut dedicated = dedicated.clone();
                if namespace_known {
                    dedicated.target.namespace = Some(
                        [namespace.parent, namespace.recovery, namespace.terminal]
                            .map(terminal_identity_fields),
                    );
                    dedicated.target.selected_user = Some(selected_user);
                }
                let response = observe_known_file_target_request(&dedicated);
                assert_eq!(response.nonce, [9; 32]);
                assert_eq!(response.target_acquired, 9);
                assert_eq!(response.target_closes, [true; 9]);
                assert_eq!(response.token_closes, [true; 2]);
                assert!(response.directory_closes.iter().all(|closed| *closed));
                let encoded =
                    crate::protocol::host_record::encode_known_file_response(&response).unwrap();
                assert_eq!(&encoded[..8], b"CRDDKR03");
                let snapshot = response.snapshot.unwrap();
                assert_eq!(
                    snapshot.identities[11],
                    terminal_identity_fields(file_identity)
                );
                assert_eq!(
                    snapshot.identities[..11],
                    identities.map(terminal_identity_fields)
                );
                assert_eq!(snapshot.file_byte_length, 7);
                assert_eq!(snapshot.file_link_count, 1);
                assert_eq!(snapshot.file_sha256, KNOWN_FIXTURE_SHA256);
                assert_eq!(snapshot.marker_sha256, expected.marker_sha256);
                assert_eq!(snapshot.selected_user, selected_user);
                closes.push(("known_file_nine_and_outer_handles", true));
                normal += 1;
            }
            phase = "known_file_all_known";
            let mut known_directory = TerminalDirectory::open_fixed_namespace(namespace).unwrap();
            let exact = observe_known_file_terminal_target(
                &known_directory,
                ROOT_NAME,
                &marker_name,
                Some(&known_file),
            )
            .unwrap();
            assert_eq!(exact.snapshot.identities, known_file.identities);
            assert_eq!(exact.closes, [true; 9]);
            normal += 1;
            for position in 0..12 {
                for field in 0..6 {
                    let mut changed = known_file.clone();
                    changed.identities[position][field] ^= 1;
                    let failure = observe_known_file_terminal_target(
                        &known_directory,
                        ROOT_NAME,
                        &marker_name,
                        Some(&changed),
                    )
                    .unwrap_err();
                    assert_eq!(failure.position, Some(position));
                    assert_eq!(failure.handles_acquired, 9);
                    assert_eq!(failure.closes, [true; 9]);
                    rejects.push(failure);
                }
            }
            for field in 0..5 {
                let mut changed = known_file.clone();
                match field {
                    0 => changed.selected_user[0] ^= 1,
                    1 => changed.marker_sha256[0] ^= 1,
                    2 => changed.file_byte_length += 1,
                    3 => changed.file_link_count += 1,
                    _ => changed.file_sha256[0] ^= 1,
                }
                let failure = observe_known_file_terminal_target(
                    &known_directory,
                    ROOT_NAME,
                    &marker_name,
                    Some(&changed),
                )
                .unwrap_err();
                assert_eq!(
                    failure.position,
                    match field {
                        0 => None,
                        1 => Some(4),
                        _ => Some(11),
                    }
                );
                assert_eq!(failure.handles_acquired, 9);
                assert_eq!(failure.closes, [true; 9]);
                rejects.push(failure);
            }
            assert!(known_directory.close());
            closes.push(("known_file_all_known_namespace_chain", true));
            fs::write(&file_path, b"AFTER!\n").unwrap();
            let refused = observe_known_file_target_request(&dedicated);
            assert!(refused.snapshot.is_none());
            assert_eq!(refused.position, Some(11));
            assert_eq!(refused.target_acquired, 9);
            assert_eq!(refused.target_closes, [true; 9]);
            assert!(refused.directory_closes.iter().all(|closed| *closed));
            assert!(crate::protocol::host_record::encode_known_file_response(&refused).is_some());
            fs::remove_file(&file_path).unwrap();
            assert_eq!(observe_terminal_presence(&file_path), Ok(false));
            let missing = observe_known_file_target_request(&dedicated);
            assert!(missing.snapshot.is_none());
            assert_eq!(missing.position, Some(11));
            assert_eq!(missing.target_acquired, 8);
            assert_eq!(missing.target_closes, [true; 8]);
            assert_eq!(missing.token_closes, [true; 2]);
            assert!(missing.directory_closes.iter().all(|closed| *closed));
            assert!(crate::protocol::host_record::encode_known_file_response(&missing).is_some());
            let mut directory = TerminalDirectory::open_fixed_namespace(namespace).unwrap();
            for known in [None, Some(&expected)] {
                let result =
                    observe_terminal_target(&directory, ROOT_NAME, &marker_name, known).unwrap();
                assert_eq!(result.snapshot, expected);
                assert_eq!(result.closes, vec![true; 8]);
                normal += 1;
            }
            phase = "known_reject";
            for position in 0..11 {
                for field in 0..6 {
                    let mut changed = expected.clone();
                    let identity = &mut changed.identities[position];
                    match field {
                        0 => identity.volume_serial_number ^= 0x80000000,
                        1 => identity.file_index_high ^= 0x80000000,
                        2 => identity.file_index_low ^= 0x80000000,
                        3 => identity.creation_time_low ^= 0x80000000,
                        4 => identity.creation_time_high ^= 0x80000000,
                        _ => {
                            identity.attributes ^=
                                windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_ARCHIVE
                        }
                    }
                    let failure = observe_terminal_target(
                        &directory,
                        ROOT_NAME,
                        &marker_name,
                        Some(&changed),
                    )
                    .unwrap_err();
                    assert_eq!(failure.reason, "terminal_target_known_mismatch");
                    assert_eq!(failure.handles_acquired, 8);
                    assert_eq!(failure.closes, vec![true; 8]);
                    rejects.push(failure);
                }
            }
            for field in 0..2 {
                let mut changed = expected.clone();
                if field == 0 {
                    changed.marker_sha256[0] ^= 1;
                } else {
                    changed.selected_user[0] ^= 1;
                }
                let failure =
                    observe_terminal_target(&directory, ROOT_NAME, &marker_name, Some(&changed))
                        .unwrap_err();
                assert_eq!(failure.reason, "terminal_target_known_mismatch");
                rejects.push(failure);
            }
            let mut changed = expected.clone();
            changed.root_name.push('x');
            let failure =
                observe_terminal_target(&directory, ROOT_NAME, &marker_name, Some(&changed))
                    .unwrap_err();
            assert_eq!(failure.reason, "terminal_target_known_name_mismatch");
            assert_eq!(failure.handles_acquired, 0);
            rejects.push(failure);
            assert!(directory.close());
            closes.push(("known_namespace_chain", true));
            phase = "missing_type_reject";
            for position in 3..11 {
                assert_eq!(
                    observe_fixture_identity(&paths[position], &mut closes),
                    identities[position]
                );
                let held =
                    paths[position].with_file_name(format!("target-fixture-held-{position}"));
                assert_eq!(observe_terminal_presence(&held), Ok(false));
                fs::rename(&paths[position], &held).unwrap();
                assert_eq!(
                    observe_fixture_identity(&held, &mut closes),
                    identities[position]
                );
                let mut directory = TerminalDirectory::open_fixed_namespace(namespace).unwrap();
                let failure =
                    observe_terminal_target(&directory, ROOT_NAME, &marker_name, None).unwrap_err();
                assert_eq!(failure.reason, "terminal_open_failed");
                assert_eq!(failure.position, Some(position));
                assert_eq!(failure.handles_acquired, position - 3);
                rejects.push(failure);
                if position == 4 {
                    fs::create_dir(&paths[position]).unwrap();
                } else {
                    fs::write(&paths[position], b"wrong type").unwrap();
                }
                replacements_created += 1;
                let replacement_identity = observe_fixture_identity(&paths[position], &mut closes);
                let failure =
                    observe_terminal_target(&directory, ROOT_NAME, &marker_name, None).unwrap_err();
                assert_eq!(failure.reason, "terminal_target_type_invalid");
                assert_eq!(failure.position, Some(position));
                assert_eq!(failure.handles_acquired, position - 2);
                rejects.push(failure);
                assert!(directory.close());
                closes.push(("rejection_namespace_chain", true));
                validate_fixture_cleanup_identity(
                    replacement_identity,
                    Ok(observe_fixture_identity(&paths[position], &mut closes)),
                )
                .unwrap();
                if position == 4 {
                    assert!(fs::read_dir(&paths[position]).unwrap().next().is_none());
                    fs::remove_dir(&paths[position]).unwrap();
                } else {
                    assert_eq!(fs::read(&paths[position]).unwrap(), b"wrong type");
                    fs::remove_file(&paths[position]).unwrap();
                }
                replacements_cleaned += 1;
                assert_eq!(observe_terminal_presence(&paths[position]), Ok(false));
                assert_eq!(
                    observe_fixture_identity(&held, &mut closes),
                    identities[position]
                );
                fs::rename(&held, &paths[position]).unwrap();
                assert_eq!(observe_terminal_presence(&held), Ok(false));
                assert_eq!(
                    observe_fixture_identity(&paths[position], &mut closes),
                    identities[position]
                );
            }
            phase = "marker_length";
            for length in [
                0,
                MAX_HOST_MARKER_OBSERVATION_BYTES,
                MAX_HOST_MARKER_OBSERVATION_BYTES + 1,
            ] {
                fs::write(&marker, vec![b'x'; length]).unwrap();
                let mut directory = TerminalDirectory::open_fixed_namespace(namespace).unwrap();
                let result = observe_terminal_target(&directory, ROOT_NAME, &marker_name, None);
                if length == MAX_HOST_MARKER_OBSERVATION_BYTES {
                    let observation = result.unwrap();
                    assert_eq!(observation.closes, vec![true; 8]);
                    assert_eq!(
                        observation.snapshot.marker_sha256,
                        sha256(&[&vec![b'x'; length]]).unwrap()
                    );
                    maximum_verified = true;
                } else {
                    let failure = result.unwrap_err();
                    assert_eq!(failure.reason, "terminal_length_invalid");
                    assert_eq!(failure.position, Some(4));
                    assert_eq!(failure.handles_acquired, 8);
                    rejects.push(failure);
                }
                assert!(directory.close());
                closes.push(("length_namespace_chain", true));
            }
            fs::write(&marker, bytes).unwrap();
            phase = "cleanup";
            assert!(
                rejects
                    .iter()
                    .all(|failure| Some(failure.reason) == failure.operation_reason
                        && failure.closes.len() == failure.handles_acquired
                        && failure.closes.iter().all(|closed| *closed))
            );
            assert_eq!(rejects.len(), 87 + 12 * 6 + 5);
            for position in (0..11).rev() {
                assert_eq!(
                    observe_fixture_identity(&paths[position], &mut closes),
                    identities[position]
                );
                if position == 4 {
                    assert_eq!(fs::read(&paths[position]).unwrap(), bytes);
                    fs::remove_file(&paths[position]).unwrap();
                } else {
                    assert!(fs::read_dir(&paths[position]).unwrap().next().is_none());
                    fs::remove_dir(&paths[position]).unwrap();
                }
                cleaned += 1;
                assert_eq!(observe_terminal_presence(&paths[position]), Ok(false));
            }
            phase = "settlement_model";
            // All OS work is complete before these models poison the process-local flag.
            let normal_model =
                finish_terminal_target_observation(Ok(expected.clone()), None, 8, vec![true; 8])
                    .unwrap();
            assert_eq!(normal_model.snapshot, expected);
            settlement_model_cases += 1;
            for model_closes in [
                vec![true, true, true, true, true, true, true, false],
                vec![true; 7],
            ] {
                let model = finish_terminal_target_observation(
                    Ok(expected.clone()),
                    None,
                    8,
                    model_closes.clone(),
                )
                .unwrap_err();
                assert_eq!(model.reason, "terminal_target_close_unknown");
                assert_eq!(model.operation_reason, None);
                assert_eq!(model.position, None);
                assert_eq!(model.handles_acquired, 8);
                assert_eq!(model.closes, model_closes);
                settlement_model_cases += 1;
            }
            let model = finish_terminal_target_observation(
                Err("fixture_original_read_failure"),
                Some(4),
                2,
                vec![true, false],
            )
            .unwrap_err();
            assert_eq!(model.reason, "terminal_target_close_unknown");
            assert_eq!(
                model.operation_reason,
                Some("fixture_original_read_failure")
            );
            assert_eq!(model.position, Some(4));
            assert_eq!(model.handles_acquired, 2);
            assert_eq!(model.closes, vec![true, false]);
            assert!(CAPACITY_SETTLEMENT_UNKNOWN.load(std::sync::atomic::Ordering::SeqCst));
            settlement_model_cases += 1;
            let mut mismatch = identities[3];
            mismatch.creation_time_low ^= 1;
            for (observed, may_delete) in [
                (Ok(identities[3]), true),
                (Ok(mismatch), false),
                (Err("fixture_identity_observation_unknown"), false),
            ] {
                let mut deletion_path_entered = false;
                if validate_fixture_cleanup_identity(identities[3], observed).is_ok() {
                    deletion_path_entered = true;
                }
                assert_eq!(deletion_path_entered, may_delete);
                replacement_cleanup_model_cases += 1;
            }
            settlement_model_verified = true;
            phase = "complete";
        }));
        let rows = rejects.iter().map(|failure| format!("{{\"reason\":\"{}\",\"operationReason\":{},\"position\":{},\"handlesAcquired\":{},\"closes\":{:?}}}", failure.reason, failure.operation_reason.map_or("null".to_owned(), |reason| format!("\"{reason}\"")), failure.position.map(|value| value.to_string()).unwrap_or_else(|| "null".to_owned()), failure.handles_acquired, failure.closes)).collect::<Vec<_>>().join(",");
        let presence = match observe_terminal_presence(parent) {
            Ok(false) => "absent",
            Ok(true) => "present",
            Err(_) => "unknown",
        };
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-target-fixture\",\"contractRevision\":2,\"run\":\"{RUN}\",\"observed\":{},\"phase\":\"{phase}\",\"normalObservations\":{normal},\"createdEntities\":{created},\"cleanupEntities\":{cleaned},\"replacementsCreated\":{replacements_created},\"replacementsCleaned\":{replacements_cleaned},\"replacementCleanupModelCases\":{replacement_cleanup_model_cases},\"settlementModelCases\":{settlement_model_cases},\"checkedCloses\":{},\"checkedClosesConfirmed\":{},\"fixturePresence\":\"{presence}\",\"maximumMarkerVerified\":{maximum_verified},\"settlementModelVerified\":{settlement_model_verified},\"rejections\":[{rows}],\"recordSaves\":0,\"productionIntegrationVerified\":false,\"osFaultInjectionVerified\":false}}",
            outcome.is_ok(),
            closes.len(),
            closes.iter().all(|(_, value)| *value)
        );
        assert!(outcome.is_ok(), "target fixture stopped: {phase}");
    }

    std::thread_local! {
        static SAVE_PAUSE: std::cell::RefCell<Option<(std::sync::mpsc::Sender<()>, std::sync::mpsc::Receiver<()>)>> = const { std::cell::RefCell::new(None) };
    }

    /// 自己生成保存Caseのstage保持中だけ競合観測を待つ。
    ///
    /// @responsibility 本番では存在しない一回同期で保存区間の保持を反証する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 同threadの固定fixtureが一組のchannelだけを設定する。
    /// @stimulus stage作成後に開始通知し、最大四秒で競合終了通知を待つ。
    /// @observation 通知の受理と有限待機。
    /// @oracle 一回消費後に本体のpublishへ戻る。
    /// @cleanup channel値は一回消費し破棄する。OS handle清掃成功は主張しない。
    /// @boundary cfg(test)の同Process Caseだけ。production hookではない。
    pub(super) fn pause_terminal_save() {
        if let Some((started, finished)) = SAVE_PAUSE.take() {
            started.send(()).unwrap();
            finished
                .recv_timeout(std::time::Duration::from_secs(4))
                .unwrap();
        }
    }

    /// 実保存が使う同じ予約判定の上限とoverflowを反証する。
    ///
    /// @responsibility 大規模実file列挙と純値の境界確認を区別する。
    /// @trace ERB-IT-002
    /// @precondition 私有Helperだけを呼び、OS資源を取得しない。
    /// @stimulus 0/1/8192/8193byte、1023/1024entry、8MiB前後と整数最大値。
    /// @observation 本体判定HelperのOkまたは固定理由。
    /// @oracle 正常境界だけ受理し、超過/overflow/不正文書を拒否する。
    /// @cleanup N/A: file/handle/Processを取得しない。
    /// @boundary Native内部の純値検査。物理1024file/8MiB、保存と公開Recoveryの成立は主張しない。
    #[test]
    fn terminal_reservation_contract() {
        assert_eq!(
            check_terminal_reservation(0, 0, 0),
            Err("terminal_bytes_invalid")
        );
        assert_eq!(check_terminal_reservation(0, 0, 1), Ok(()));
        assert_eq!(check_terminal_reservation(0, 0, MAX_RECORD_BYTES), Ok(()));
        assert_eq!(
            check_terminal_reservation(0, 0, MAX_RECORD_BYTES + 1),
            Err("terminal_bytes_invalid")
        );
        assert_eq!(check_terminal_reservation(1023, 0, 1), Ok(()));
        assert_eq!(
            check_terminal_reservation(1024, 0, 1),
            Err("terminal_entry_capacity_full")
        );
        assert_eq!(
            check_terminal_reservation(1, MAX_TOTAL_RECORD_BYTES - 1, 1),
            Ok(())
        );
        assert_eq!(
            check_terminal_reservation(1, MAX_TOTAL_RECORD_BYTES, 1),
            Err("terminal_byte_capacity_full")
        );
        assert_eq!(
            check_terminal_reservation(u32::MAX, 0, 1),
            Err("terminal_entry_count_overflow")
        );
        assert_eq!(
            check_terminal_reservation(0, u64::MAX, 1),
            Err("terminal_byte_count_overflow")
        );
        let (stage, public) = terminal_names(REFERENCE).unwrap();
        assert_eq!(terminal_inventory_leaf(&stage), Ok((REFERENCE, false)));
        assert_eq!(terminal_inventory_leaf(&public), Ok((REFERENCE, true)));
        assert_eq!(
            terminal_inventory_leaf("unrelated.txt"),
            Err("terminal_inventory_unknown_entry")
        );
        assert!(terminal_inventory_leaf(&stage.to_uppercase()).is_err());
        assert!(terminal_inventory_leaf("host-terminal.invalid.json").is_err());
        assert!(terminal_inventory_leaf(&format!("../{stage}")).is_err());
    }

    /// 新自己生成領域で計数から保存終了までを実観測する。
    ///
    /// @responsibility 排他中競合、物理名計数、処置前拒否と終了後の不存在を区別する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 固定Node Owner、cwd/run、不存在のsave-r1だけ。
    /// @stimulus 三保存、保持writer、同参照、未知名、空publicとDirectory。
    /// @observation 各実receipt、再計数、close、競合thread joinと清掃後不存在。
    /// @oracle 拒否時に新stageなし、通常保存の全終了確認後だけ成功。
    /// @cleanup 全oracle/close後、実体と既知bytesを再確認し自作対象だけ非再帰清掃。不明時保持。
    /// @boundary 同Process未署名Native試験。全producer、別session、公開Recovery、実OS故障は未検証。
    #[test]
    #[ignore = "Fixed save fixture; explicit Node owner required"]
    fn terminal_save_fixture() {
        const RUN: &str = "save.261003.c8d1092a.r1";
        assert_eq!(std::env::var("CRDD_TERMINAL_SAVE_RUN").as_deref(), Ok(RUN));
        let (_, run_root, _) = terminal_fixture_context();
        let root_path = run_root.join("save-r1");
        let root = root_path.as_path();
        let mut phase = "preflight";
        let mut closes = Vec::new();
        let mut saves = Vec::new();
        let mut rejections = Vec::new();
        let mut inventories = Vec::new();
        let mut cleanup_files = 0_u32;
        let mut cleanup_directories = 0_u32;
        let mut worker_joined = false;
        let mut directory_created = false;
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_eq!(observe_terminal_presence(root), Ok(false));
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            closes.push((
                "token_impersonation",
                close_terminal_handle(&mut impersonation),
            ));
            closes.push(("token_primary", close_terminal_handle(&mut primary)));
            assert!(closes.iter().all(|(_, closed)| *closed));
            let mut wide: Vec<u16> = root.as_os_str().encode_wide().collect();
            wide.push(0);
            phase = "create";
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: fixed absent self-generated root and live protected descriptor.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("fixture_directory_create_failed");
                }
                directory_created = true;
                Ok(())
            })
            .unwrap();
            let identity = observe_fixture_identity(root, &mut closes);
            let mut directory = TerminalDirectory::open(root, identity).unwrap();
            let refs: Vec<String> = (1..=8)
                .map(|n| format!("host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec30{n:02}"))
                .collect();
            let bytes = vec![b'x'; MAX_RECORD_BYTES];
            let (started_tx, started_rx) = std::sync::mpsc::channel();
            let (finished_tx, finished_rx) = std::sync::mpsc::channel();
            SAVE_PAUSE.set(Some((started_tx, finished_rx)));
            let competing_ref = refs[7].clone();
            let worker_root = root.to_path_buf();
            let worker = std::thread::spawn(move || {
                started_rx
                    .recv_timeout(std::time::Duration::from_secs(4))
                    .unwrap();
                let mut other = TerminalDirectory::open(&worker_root, identity).unwrap();
                let failure = save_terminal_record(&other, &competing_ref, b"q").unwrap_err();
                let closed = other.close();
                finished_tx.send(()).unwrap();
                (failure, closed)
            });
            phase = "save_competition";
            let saved = save_terminal_record(&directory, &refs[0], &bytes);
            let joined = worker.join();
            worker_joined = joined.is_ok();
            let (failure, worker_closed) = joined.unwrap();
            closes.push(("worker_directory", worker_closed));
            assert!(worker_closed);
            assert_eq!(failure.reason, "terminal_capacity_timeout");
            assert_eq!(failure.receipt.reference, refs[7]);
            assert!(failure.receipt.record.is_none() && failure.receipt.inventory.is_none());
            assert!(
                !failure.receipt.capacity.action_started
                    && !failure.receipt.capacity.ownership_acquired
            );
            assert_eq!(failure.receipt.capacity.close_confirmed, Some(true));
            rejections.push(failure);
            saves.push(saved.unwrap());
            assert_eq!(saves[0].inventory.as_ref().unwrap().entries, 0);
            assert!(saves[0].inventory.as_ref().unwrap().enumeration_complete);
            let (_, a_public) = terminal_names(&refs[0]).unwrap();
            let a_id = observe_fixture_identity(&root.join(&a_public), &mut closes);

            phase = "seed_names";
            let (zero_name, _) = terminal_names(&refs[1]).unwrap();
            let zero_path = root.join(&zero_name);
            let mut zero_wide: Vec<u16> = zero_path.as_os_str().encode_wide().collect();
            zero_wide.push(0);
            let mut zero = with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: exact generated canonical stage; CREATE_NEW never replaces.
                let h = unsafe {
                    CreateFileW(
                        zero_wide.as_ptr(),
                        FILE_GENERIC_READ | FILE_GENERIC_WRITE,
                        FILE_SHARE_READ,
                        attributes,
                        CREATE_NEW,
                        FILE_FLAG_OPEN_REPARSE_POINT,
                        null_mut(),
                    )
                };
                if h == INVALID_HANDLE_VALUE {
                    return Err("fixture_zero_create_failed");
                }
                Ok(OwnedHandle(h))
            })
            .unwrap();
            let zero_id = terminal_identity(zero.0).unwrap();
            closes.push(("zero_writer", close_terminal_handle(&mut zero)));
            assert!(closes.last().unwrap().1);
            let mut pair = TerminalStage::create(&directory, &refs[2], b"abc").unwrap();
            let pair_id = pair.identity;
            closes.push(("pair_writer", pair.close()));
            assert!(closes.last().unwrap().1);
            drop(pair);
            let (pair_stage, pair_public) = terminal_names(&refs[2]).unwrap();
            fs::hard_link(root.join(&pair_stage), root.join(&pair_public)).unwrap();
            with_terminal_capacity(&directory, || {
                let observed = inventory_terminal_records(&directory, &refs[7]).unwrap();
                assert_eq!((observed.entries, observed.bytes), (4, 8198));
                assert_eq!((observed.readers_opened, observed.readers_closed), (4, 4));
                assert!(observed.enumeration_complete && !observed.reference_present);
                assert_eq!(observed.search_close_confirmed, Some(true));
                inventories.push(observed);
                Ok(())
            })
            .unwrap();
            phase = "save_recount";
            saves.push(save_terminal_record(&directory, &refs[3], b"d").unwrap());
            assert_eq!(saves[1].inventory.as_ref().unwrap().entries, 4);
            let (_, d_public) = terminal_names(&refs[3]).unwrap();
            let d_id = observe_fixture_identity(&root.join(&d_public), &mut closes);
            let failure = save_terminal_record(&directory, &refs[3], b"e").unwrap_err();
            assert_eq!(failure.reason, "terminal_record_already_present");
            assert!(failure.receipt.record.is_none());
            rejections.push(failure);
            phase = "held_writer";
            let mut held = TerminalStage::create(&directory, &refs[4], b"ee").unwrap();
            let held_id = held.identity;
            let failure = save_terminal_record(&directory, &refs[5], b"f").unwrap_err();
            assert_eq!(failure.reason, "terminal_open_failed");
            assert!(failure.receipt.record.is_none());
            assert_eq!(
                failure
                    .inventory_failure
                    .as_ref()
                    .unwrap()
                    .receipt
                    .search_close_confirmed,
                Some(true)
            );
            rejections.push(failure);
            closes.push(("held_writer", held.close()));
            assert!(closes.last().unwrap().1);
            drop(held);
            saves.push(save_terminal_record(&directory, &refs[5], b"f").unwrap());
            phase = "unknown_name";
            let unknown_path = root.join("unrelated.fixture");
            assert_eq!(observe_terminal_presence(&unknown_path), Ok(false));
            fs::rename(root.join(&pair_stage), &unknown_path).unwrap();
            let failure = save_terminal_record(&directory, &refs[6], b"g").unwrap_err();
            assert_eq!(failure.reason, "terminal_inventory_unknown_entry");
            assert!(failure.receipt.record.is_none());
            rejections.push(failure);
            fs::rename(&unknown_path, root.join(&pair_stage)).unwrap();
            phase = "empty_public";
            let (_, f_public) = terminal_names(&refs[5]).unwrap();
            let f_id = observe_fixture_identity(&root.join(&f_public), &mut closes);
            fs::write(root.join(&f_public), []).unwrap();
            let failure = save_terminal_record(&directory, &refs[6], b"g").unwrap_err();
            assert_eq!(failure.reason, "terminal_inventory_size_invalid");
            assert!(failure.receipt.record.is_none());
            rejections.push(failure);
            fs::write(root.join(&f_public), b"f").unwrap();
            phase = "directory_entry";
            let (child_name, _) = terminal_names(&refs[6]).unwrap();
            let child = root.join(child_name);
            let mut child_wide: Vec<u16> = child.as_os_str().encode_wide().collect();
            child_wide.push(0);
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: absent child under self-generated held root.
                if unsafe { CreateDirectoryW(child_wide.as_ptr(), attributes) } == 0 {
                    return Err("fixture_child_create_failed");
                }
                Ok(())
            })
            .unwrap();
            let child_id = observe_fixture_identity(&child, &mut closes);
            let failure = save_terminal_record(&directory, &refs[7], b"h").unwrap_err();
            assert_eq!(failure.reason, "terminal_inventory_not_file");
            assert!(failure.receipt.record.is_none());
            rejections.push(failure);
            assert_eq!(observe_fixture_identity(&child, &mut closes), child_id);
            assert_eq!(fs::read_dir(&child).unwrap().count(), 0);
            fs::remove_dir(&child).unwrap();
            cleanup_directories += 1;
            assert_eq!(observe_terminal_presence(&child), Ok(false));
            phase = "final_inventory";
            with_terminal_capacity(&directory, || {
                let observed = inventory_terminal_records(&directory, &refs[7]).unwrap();
                assert_eq!((observed.entries, observed.bytes), (7, 8202));
                assert_eq!((observed.readers_opened, observed.readers_closed), (7, 7));
                assert!(observed.enumeration_complete && !observed.reference_present);
                assert_eq!(observed.search_close_confirmed, Some(true));
                inventories.push(observed);
                Ok(())
            })
            .unwrap();
            for saved in &saves {
                assert!(saved.capacity.action_started && saved.capacity.ownership_acquired);
                assert_eq!(saved.capacity.release_confirmed, Some(true));
                assert_eq!(saved.capacity.close_confirmed, Some(true));
                let record = saved.record.as_ref().unwrap();
                assert!(
                    record.stage_created
                        && record.write_issued
                        && record.flush_issued
                        && record.rename_issued
                );
                assert!(record.stage_absence_verified && record.publication_verified);
                assert_eq!(record.reader_close_confirmed, Some(true));
                assert_eq!(record.record_handle_close_confirmed, Some(true));
                assert_eq!(record.handle_close_confirmed, Some(true));
            }
            for rejected in &rejections[1..] {
                assert_eq!(rejected.receipt.capacity.release_confirmed, Some(true));
                assert_eq!(rejected.receipt.capacity.close_confirmed, Some(true));
            }
            closes.push(("directory", directory.close()));
            assert!(closes.iter().all(|(_, closed)| *closed));
            drop(directory);
            phase = "cleanup";
            let (held_name, _) = terminal_names(&refs[4]).unwrap();
            for (name, expected_id, expected_bytes) in [
                (a_public, a_id, bytes.as_slice()),
                (zero_name, zero_id, b"".as_slice()),
                (pair_stage, pair_id, b"abc".as_slice()),
                (pair_public, pair_id, b"abc".as_slice()),
                (d_public, d_id, b"d".as_slice()),
                (held_name, held_id, b"ee".as_slice()),
                (f_public, f_id, b"f".as_slice()),
            ] {
                assert_eq!(observe_fixture_identity(root, &mut closes), identity);
                let path = root.join(name);
                assert_eq!(observe_fixture_identity(&path, &mut closes), expected_id);
                assert_eq!(fs::read(&path).unwrap(), expected_bytes);
                assert!(closes.iter().all(|(_, closed)| *closed));
                fs::remove_file(&path).unwrap();
                cleanup_files += 1;
                assert_eq!(observe_terminal_presence(&path), Ok(false));
            }
            assert_eq!(observe_fixture_identity(root, &mut closes), identity);
            assert_eq!(fs::read_dir(root).unwrap().count(), 0);
            fs::remove_dir(root).unwrap();
            cleanup_directories += 1;
            phase = "complete";
        }));
        let presence = match observe_terminal_presence(root) {
            Ok(false) => "absent",
            Ok(true) => "present",
            Err(_) => "unknown",
        };
        let confirmed = outcome.is_ok()
            && worker_joined
            && presence == "absent"
            && saves.len() == 3
            && rejections.len() == 6
            && inventories.len() == 2
            && cleanup_files == 7
            && cleanup_directories == 2
            && closes.iter().all(|(_, c)| *c);
        let save_rows: Vec<_> = saves.iter().map(|s| {
            let i = s.inventory.as_ref().unwrap();
            let r = s.record.as_ref().unwrap();
            format!("{{\"reference\":\"{}\",\"beforeEntries\":{},\"beforeBytes\":{},\"readersOpened\":{},\"readersClosed\":{},\"enumerationComplete\":{},\"searchAcquired\":{},\"searchClose\":{},\"stageCreated\":{},\"writeIssued\":{},\"flushIssued\":{},\"renameIssued\":{},\"stageAbsent\":{},\"publicVerified\":{},\"readerClose\":{},\"writerClose\":{},\"recordClose\":{},\"capacityAction\":{},\"capacityRelease\":{},\"capacityClose\":{}}}",
                s.reference, i.entries, i.bytes, i.readers_opened, i.readers_closed, i.enumeration_complete, i.search_acquired,
                i.search_close_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()),
                r.stage_created, r.write_issued, r.flush_issued, r.rename_issued, r.stage_absence_verified, r.publication_verified,
                r.reader_close_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()),
                r.record_handle_close_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()),
                r.handle_close_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()),
                s.capacity.action_started,
                s.capacity.release_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()),
                s.capacity.close_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()))
        }).collect();
        let reject_rows: Vec<_> = rejections.iter().map(|f| format!("{{\"reference\":\"{}\",\"reason\":\"{}\",\"recordPresent\":{},\"inventoryPresent\":{},\"capacityAction\":{},\"capacityRelease\":{},\"capacityClose\":{}}}",
            f.receipt.reference, f.reason, f.receipt.record.is_some(), f.receipt.inventory.is_some(), f.receipt.capacity.action_started,
            f.receipt.capacity.release_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()),
            f.receipt.capacity.close_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()))).collect();
        let inventory_rows: Vec<_> = inventories.iter().map(|i| format!("{{\"entries\":{},\"bytes\":{},\"readersOpened\":{},\"readersClosed\":{},\"complete\":{},\"searchClose\":{}}}",
            i.entries, i.bytes, i.readers_opened, i.readers_closed, i.enumeration_complete,
            i.search_close_confirmed.map(|b| b.to_string()).unwrap_or_else(|| "null".to_owned()))).collect();
        let close_rows: Vec<_> = closes
            .iter()
            .map(|(role, closed)| format!("{{\"role\":\"{role}\",\"confirmed\":{closed}}}"))
            .collect();
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-save-fixture\",\"contractRevision\":1,\"run\":\"{RUN}\",\"status\":\"{}\",\"phase\":\"{phase}\",\"directoryCreated\":{directory_created},\"workerJoined\":{worker_joined},\"savesVerified\":{},\"rejectionsVerified\":{},\"inventoriesVerified\":{},\"cleanupFiles\":{cleanup_files},\"cleanupDirectories\":{cleanup_directories},\"checkedClosesConfirmed\":{},\"fixturePresence\":\"{presence}\",\"saves\":[{}],\"rejections\":[{}],\"inventories\":[{}],\"closes\":[{}],\"productionIntegrationVerified\":false,\"osFaultInjectionVerified\":false}}",
            if confirmed { "observed" } else { "unconfirmed" },
            saves.len(),
            rejections.len(),
            inventories.len(),
            closes.iter().all(|(_, c)| *c),
            save_rows.join(","),
            reject_rows.join(","),
            inventory_rows.join(","),
            close_rows.join(",")
        );
        assert!(confirmed, "terminal_save_unconfirmed");
    }

    const REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3001";
    const COLLISION_REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3002";
    const UNUSED_REFERENCE: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3003";
    const RUN: &str = "publication.261003.219b9b53.r4";

    const COLD_RUN: &str = "cold.261003.219b9b53.r1";
    const COLD_PREPARED: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3004";
    const COLD_PUBLISHED: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3005";
    const COLD_COLLISION: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3006";
    const COLD_DIRECTORY: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3007";
    const COLD_ABSENT: &str = "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3008";

    std::thread_local! {
        static PERMISSION_PAUSE: std::cell::RefCell<Option<(
            std::sync::Arc<std::sync::Barrier>,
            std::sync::Arc<std::sync::Barrier>,
        )>> = const { std::cell::RefCell::new(None) };
    }

    /// testだけで最終許可の直前に別threadのpoison確定を待つ。
    ///
    /// @responsibility 取得前の拒否と、所有取得後・許可前の拒否を区別する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition cfg(test)の一回fixtureだけが同threadの二barrierを設定する。
    /// @stimulus 取得・fresh確認後に到達通知し、別threadの確定後に再開する。
    /// @observation 許可判定前の順序。OS終端失敗は合成しない。
    /// @oracle hookは一回消費し、poisonの本番resetを提供しない。
    /// @cleanup 両threadをjoinしてから自己生成対象だけを清掃する。Ownerの15秒で未確認を拒否する。
    /// @boundary cfg(test)同Process thread間。Production binaryには存在しない。
    pub(super) fn pause_capacity_permission() {
        let pause = PERMISSION_PAUSE.with(|slot| slot.borrow_mut().take());
        if let Some((arrived, resume)) = pause {
            arrived.wait();
            resume.wait();
        }
    }

    /// 自己生成Directoryに限って共通排他と停止条件を観測する。
    ///
    /// @responsibility 取得・競合・abandoned・保護拒否・個別終端と合成失敗を分ける。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 固定cwd/runの専用Owner、freshなr3-beforeまたはr3-after。実残存と旧fixtureは対象外。
    /// @stimulus 同thread再帰、別thread timeout、thread喪失、属性差、descriptor不一致と同名Event。
    /// @observation callback開始、wait返却、release/close、Hash名一致、自己生成Directory清掃後不存在。
    /// @oracle 通常取得だけcallback一回。拒否のcallback0、abandoned所有取得と明示終端を区別する。
    /// @cleanup 全Oracleと全close後だけ自作空Directoryを非再帰削除。不明時は保持する。
    /// @boundary 未署名Native→Windows Mutex。別Process/session・容量・署名・公開Recoveryは未検証。
    #[test]
    #[ignore = "Fixed capacity fixture; explicit Node owner required"]
    fn terminal_capacity_fixture() {
        let (run, root_path, permission_mode) =
            match std::env::var("CRDD_TERMINAL_CAPACITY_RUN").as_deref() {
                Ok("capacity.261003.c8d1092a.r3-before") => (
                    "capacity.261003.c8d1092a.r3-before",
                    "capacity-r3-before",
                    "before",
                ),
                Ok("capacity.261003.c8d1092a.r3-after") => (
                    "capacity.261003.c8d1092a.r3-after",
                    "capacity-r3-after",
                    "after",
                ),
                _ => panic!("fixture_run_invalid"),
            };
        let (_, run_root, _) = terminal_fixture_context();
        let root_path = run_root.join(root_path);
        let root = root_path.as_path();
        let mut phase = "preflight";
        let mut closes = Vec::new();
        let mut directory_created = false;
        let mut cleanup_issued = false;
        let mut cleanup_directory_count = 0_u32;
        let mut gate_operation_reason = None;
        let mut combined_failure_cases = 0_u32;
        let mut prior_rejection_verified = false;
        let mut receipts = Vec::new();
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_eq!(observe_terminal_presence(root), Ok(false));
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            closes.push((
                "token_impersonation",
                close_terminal_handle(&mut impersonation),
            ));
            closes.push(("token_primary", close_terminal_handle(&mut primary)));
            assert!(closes.iter().all(|(_, closed)| *closed));
            let mut wide: Vec<u16> = root.as_os_str().encode_wide().collect();
            wide.push(0);
            phase = "directory_create";
            with_terminal_descriptor(&user, &system, |attributes| {
                // SAFETY: exact fresh Repository-local fixture and live protected descriptor.
                if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                    return Err("fixture_directory_create_failed");
                }
                directory_created = true;
                Ok(())
            })
            .unwrap();
            let identity = observe_fixture_identity(root, &mut closes);
            let mut directory = TerminalDirectory::open(root, identity).unwrap();
            let name = terminal_capacity_name(&user, identity).unwrap();
            let mut changed = identity;
            changed.creation_time_low ^= 1;
            changed.attributes ^= 0x20;
            assert_eq!(name, terminal_capacity_name(&user, changed).unwrap());
            changed.file_index_low ^= 1;
            assert_ne!(name, terminal_capacity_name(&user, changed).unwrap());
            phase = "normal_recursive_and_competition";
            let receipt = with_terminal_capacity(&directory, || {
                let recursive = with_terminal_capacity(&directory, || Ok(())).unwrap_err();
                assert_eq!(recursive.reason, "terminal_capacity_recursive_acquisition");
                assert!(!recursive.receipt.create_issued && !recursive.receipt.action_started);
                let worker_root = root.to_path_buf();
                let worker = std::thread::spawn(move || {
                    let mut other = TerminalDirectory::open(&worker_root, identity).unwrap();
                    let failure = with_terminal_capacity(&other, || Ok(())).unwrap_err();
                    assert_eq!(failure.reason, "terminal_capacity_timeout");
                    assert_eq!(failure.receipt.wait_result, Some(WAIT_TIMEOUT));
                    assert!(!failure.receipt.action_started && !failure.receipt.ownership_acquired);
                    assert_eq!(failure.receipt.close_confirmed, Some(true));
                    assert!(other.close());
                    failure.receipt
                });
                receipts.push(worker.join().unwrap());
                Ok(())
            })
            .unwrap();
            assert!(receipt.action_started && receipt.ownership_acquired);
            assert_eq!(receipt.release_confirmed, Some(true));
            assert_eq!(receipt.close_confirmed, Some(true));
            receipts.push(receipt);
            phase = "closure_failure";
            let failure =
                with_terminal_capacity(&directory, || Err::<(), _>("fixture_action_failed"))
                    .unwrap_err();
            assert_eq!(failure.reason, "fixture_action_failed");
            assert!(failure.receipt.action_started);
            assert_eq!(failure.receipt.release_confirmed, Some(true));
            assert_eq!(failure.receipt.close_confirmed, Some(true));
            receipts.push(failure.receipt);
            phase = "descriptor_mismatch";
            let mut bad_directory =
                create_capacity_child_fixture(&directory, "bad-descriptor", &mut closes);
            let bad_name = terminal_capacity_name(&user, bad_directory.identity).unwrap();
            assert_ne!(bad_name, name);
            let bad_access = MUTEX_ALL_ACCESS & !WRITE_OWNER;
            let mut wrong =
                with_terminal_access_descriptor(&user, &system, bad_access, |attributes| {
                    // SAFETY: new fixture identity; known deficient DACL permits requested access.
                    let raw = unsafe {
                        CreateMutexExW(
                            attributes,
                            bad_name.as_ptr(),
                            0,
                            READ_CONTROL | SYNCHRONIZE | MUTEX_MODIFY_STATE,
                        )
                    };
                    // SAFETY: capture the creation discriminator before another API.
                    let existed = unsafe { GetLastError() }
                        == windows_sys::Win32::Foundation::ERROR_ALREADY_EXISTS;
                    if raw.is_null() {
                        return Err("fixture_mutex_create_failed");
                    }
                    let mut handle = OwnedHandle(raw);
                    if existed {
                        assert!(close_terminal_handle(&mut handle));
                        return Err("fixture_mutex_already_exists");
                    }
                    Ok(handle)
                })
                .unwrap();
            verify_terminal_object_protection(
                wrong.0,
                &user,
                &system,
                SE_KERNEL_OBJECT,
                bad_access,
            )
            .unwrap();
            let failure = with_terminal_capacity(&bad_directory, || Ok(())).unwrap_err();
            assert_eq!(failure.reason, "terminal_ace_access_mismatch");
            assert!(!failure.receipt.action_started && failure.receipt.wait_result.is_none());
            assert_eq!(failure.receipt.close_confirmed, Some(true));
            receipts.push(failure.receipt);
            closes.push(("wrong_descriptor_mutex", close_terminal_handle(&mut wrong)));
            assert!(closes.last().unwrap().1);
            assert!(bad_directory.close());
            closes.push(("bad_descriptor_directory", true));
            phase = "same_name_other_object";
            let mut event_directory =
                create_capacity_child_fixture(&directory, "other-object", &mut closes);
            assert_ne!(
                (
                    bad_directory.identity.volume_serial_number,
                    bad_directory.identity.file_index_high,
                    bad_directory.identity.file_index_low
                ),
                (
                    event_directory.identity.volume_serial_number,
                    event_directory.identity.file_index_high,
                    event_directory.identity.file_index_low
                ),
            );
            let event_name = terminal_capacity_name(&user, event_directory.identity).unwrap();
            assert_ne!(event_name, name);
            assert_ne!(event_name, bad_name);
            let mut event = with_terminal_access_descriptor(
                &user,
                &system,
                windows_sys::Win32::System::Threading::EVENT_ALL_ACCESS,
                |attributes| {
                    // SAFETY: fixed fixture-only name, no existing object; non-signaled Event negative case.
                    let handle = unsafe {
                        windows_sys::Win32::System::Threading::CreateEventW(
                            attributes,
                            0,
                            0,
                            event_name.as_ptr(),
                        )
                    };
                    // SAFETY: observe create outcome before another API changes last error.
                    let existed = unsafe { GetLastError() }
                        == windows_sys::Win32::Foundation::ERROR_ALREADY_EXISTS;
                    if handle.is_null() {
                        return Err("fixture_event_create_failed");
                    }
                    let mut handle = OwnedHandle(handle);
                    if existed {
                        assert!(close_terminal_handle(&mut handle));
                        return Err("fixture_event_already_exists");
                    }
                    Ok(handle)
                },
            )
            .unwrap();
            let failure = with_terminal_capacity(&event_directory, || Ok(())).unwrap_err();
            assert_eq!(failure.reason, "terminal_capacity_create_failed");
            assert!(!failure.receipt.handle_acquired && !failure.receipt.action_started);
            receipts.push(failure.receipt);
            closes.push(("same_name_event", close_terminal_handle(&mut event)));
            assert!(closes.last().unwrap().1);
            assert!(event_directory.close());
            closes.push(("other_object_directory", true));
            phase = "abandoned_owner_thread";
            let worker_user = user.clone();
            let worker_system = system.clone();
            let worker_name = name.clone();
            let raw = std::thread::spawn(move || {
                let mut handle = with_terminal_access_descriptor(
                    &worker_user,
                    &worker_system,
                    MUTEX_ALL_ACCESS,
                    |attributes| {
                        // SAFETY: private fixture name and live descriptor; initial ownership not requested.
                        let raw = unsafe {
                            CreateMutexExW(attributes, worker_name.as_ptr(), 0, MUTEX_ALL_ACCESS)
                        };
                        if raw.is_null() {
                            return Err("fixture_mutex_create_failed");
                        }
                        Ok(OwnedHandle(raw))
                    },
                )
                .unwrap();
                // SAFETY: fixture owns this handle and deliberately loses only the owning thread.
                assert_eq!(
                    unsafe { WaitForSingleObject(handle.0, CAPACITY_WAIT_MS) },
                    WAIT_OBJECT_0
                );
                let raw = handle.0 as usize;
                handle.0 = null_mut(); // transfer unique handle to parent; preserve object after thread exit.
                raw
            })
            .join()
            .unwrap();
            let mut keeper = OwnedHandle(raw as HANDLE);
            let failure = with_terminal_capacity(&directory, || Ok(())).unwrap_err();
            assert_eq!(failure.reason, "terminal_capacity_abandoned");
            assert!(failure.receipt.ownership_acquired && !failure.receipt.action_started);
            assert_eq!(failure.receipt.wait_result, Some(WAIT_ABANDONED));
            assert_eq!(failure.receipt.release_confirmed, Some(true));
            assert_eq!(failure.receipt.close_confirmed, Some(true));
            receipts.push(failure.receipt);
            closes.push(("abandoned_keeper", close_terminal_handle(&mut keeper)));
            assert!(closes.last().unwrap().1);
            phase = "combined_failure_matrix";
            for (operation, ownership, released, closed) in [
                ("fixture_action_failed", true, Some(false), Some(true)),
                ("fixture_action_failed", true, Some(true), Some(false)),
                ("fixture_action_failed", true, Some(false), Some(false)),
                ("fixture_observation_failed", false, None, Some(false)),
            ] {
                let expected = TerminalCapacityReceipt {
                    handle_acquired: true,
                    ownership_acquired: ownership,
                    action_started: operation == "fixture_action_failed",
                    release_confirmed: released,
                    close_confirmed: closed,
                    ..Default::default()
                };
                let failure =
                    finish_terminal_capacity(Err(operation), false, expected.clone()).unwrap_err();
                assert_eq!(failure.reason, "terminal_capacity_settlement_unknown");
                assert_eq!(failure.operation_reason, Some(operation));
                assert_eq!(failure.receipt, expected);
                combined_failure_cases += 1;
            }
            phase = "permission_poison_boundary";
            if permission_mode == "before" {
                let arrived = std::sync::Arc::new(std::sync::Barrier::new(2));
                let resume = std::sync::Arc::new(std::sync::Barrier::new(2));
                PERMISSION_PAUSE.with(|slot| {
                    *slot.borrow_mut() = Some((arrived.clone(), resume.clone()));
                });
                let poison = std::thread::spawn(move || {
                    arrived.wait();
                    CAPACITY_SETTLEMENT_UNKNOWN.store(true, std::sync::atomic::Ordering::SeqCst);
                    resume.wait();
                });
                let failure = with_terminal_capacity(&directory, || Ok(())).unwrap_err();
                poison.join().unwrap();
                assert_eq!(failure.reason, "terminal_capacity_prior_settlement_unknown");
                assert_eq!(failure.operation_reason, Some(failure.reason));
                assert!(failure.receipt.ownership_acquired && !failure.receipt.action_started);
                assert_eq!(failure.receipt.release_confirmed, Some(true));
                assert_eq!(failure.receipt.close_confirmed, Some(true));
                gate_operation_reason = failure.operation_reason;
                receipts.push(failure.receipt);
            } else {
                let receipt = with_terminal_capacity(&directory, || {
                    std::thread::spawn(|| {
                        CAPACITY_SETTLEMENT_UNKNOWN
                            .store(true, std::sync::atomic::Ordering::SeqCst);
                    })
                    .join()
                    .unwrap();
                    assert!(CAPACITY_SETTLEMENT_UNKNOWN.load(std::sync::atomic::Ordering::SeqCst));
                    Ok(())
                })
                .unwrap();
                assert!(receipt.ownership_acquired && receipt.action_started);
                assert_eq!(receipt.release_confirmed, Some(true));
                assert_eq!(receipt.close_confirmed, Some(true));
                receipts.push(receipt);
            }
            let denied = with_terminal_capacity(&directory, || Ok(())).unwrap_err();
            assert_eq!(denied.reason, "terminal_capacity_prior_settlement_unknown");
            assert_eq!(denied.operation_reason, Some(denied.reason));
            assert!(!denied.receipt.create_issued && !denied.receipt.action_started);
            prior_rejection_verified = true;
            phase = "directory_close_and_cleanup";
            for child in [&bad_directory, &event_directory] {
                assert_eq!(
                    observe_fixture_identity(&child.path, &mut closes),
                    child.identity
                );
                assert_eq!(fs::read_dir(&child.path).unwrap().count(), 0);
                cleanup_issued = true;
                fs::remove_dir(&child.path).unwrap();
                cleanup_directory_count += 1;
                assert_eq!(observe_terminal_presence(&child.path), Ok(false));
            }
            assert!(directory.close());
            closes.push(("directory", true));
            assert_eq!(observe_fixture_identity(root, &mut closes), identity);
            assert_eq!(fs::read_dir(root).unwrap().count(), 0);
            cleanup_issued = true;
            fs::remove_dir(root).unwrap();
            cleanup_directory_count += 1;
            assert_eq!(observe_terminal_presence(root), Ok(false));
            phase = "synthetic_settlement_failure";
            let mut invalid = OwnedHandle(null_mut());
            let mut receipt = TerminalCapacityReceipt {
                ownership_acquired: true,
                ..Default::default()
            };
            assert!(!settle_terminal_capacity(&mut invalid, &mut receipt));
            assert_eq!(receipt.release_confirmed, Some(false));
            assert_eq!(receipt.close_confirmed, Some(false));
            assert!(!settle_terminal_capacity(&mut invalid, &mut receipt));
            let failure = with_terminal_capacity(&directory, || Ok(())).unwrap_err();
            assert_eq!(failure.reason, "terminal_capacity_prior_settlement_unknown");
            assert!(!failure.receipt.create_issued && !failure.receipt.action_started);
            // Separate before/after test processes end here; production has no poison reset path.
            phase = "completed";
        }));
        let receipt_json = receipts.iter().map(|r| format!(
            "{{\"createIssued\":{},\"handleAcquired\":{},\"waitResult\":{},\"ownershipAcquired\":{},\"actionStarted\":{},\"releaseConfirmed\":{},\"closeConfirmed\":{}}}",
            r.create_issued, r.handle_acquired, r.wait_result.map_or("null".to_owned(), |v| v.to_string()),
            r.ownership_acquired, r.action_started,
            r.release_confirmed.map_or("null".to_owned(), |v| v.to_string()),
            r.close_confirmed.map_or("null".to_owned(), |v| v.to_string()),
        )).collect::<Vec<_>>().join(",");
        let close_json = closes
            .iter()
            .map(|(owner, confirmed)| {
                format!("{{\"owner\":\"{owner}\",\"confirmed\":{confirmed}}}")
            })
            .collect::<Vec<_>>()
            .join(",");
        let presence = match observe_terminal_presence(root) {
            Ok(false) => "absent",
            Ok(true) => "present",
            Err(_) => "unknown",
        };
        let gate_reason_json =
            gate_operation_reason.map_or("null".to_owned(), |reason| format!("\"{reason}\""));
        println!(
            "{{\"contract\":\"crdd-native/terminal-capacity-fixture\",\"run\":\"{run}\",\"phase\":\"{phase}\",\"permissionMode\":\"{permission_mode}\",\"gateOperationReason\":{gate_reason_json},\"combinedFailureCases\":{combined_failure_cases},\"priorRejectionVerified\":{prior_rejection_verified},\"observed\":{},\"directoryCreated\":{directory_created},\"cleanupIssued\":{cleanup_issued},\"cleanupDirectoryCount\":{cleanup_directory_count},\"fixturePresence\":\"{presence}\",\"actualRecordSaves\":0,\"receipts\":[{receipt_json}],\"closes\":[{close_json}]}}",
            result.is_ok()
        );
        if let Err(panic) = result {
            std::panic::resume_unwind(panic);
        }
    }

    /// 容量排他の負例に一意な自己生成Directoryを用意する。
    ///
    /// @responsibility 親と別実体の名前を使い、先行Mutexの寿命を負例へ混入させない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @trace ERB-IT-003
    /// @precondition 保持済みの自己生成容量fixture親と固定leaf。実残存は対象外。
    /// @stimulus fresh不存在確認後に保護済み空Directoryを作成し、同実体guardを保持する。
    /// @observation volume/file-index三fieldの親との差と五field。
    /// @oracle 同一実体、不明、再利用または保護不成立を拒否する。
    /// @cleanup 呼出し元が全Oracle・close・fresh実体照合後に空Directoryだけを非再帰清掃する。
    /// @boundary 自己生成fixture→Windows File API。既存fixtureと旧三Rootは対象外。
    fn create_capacity_child_fixture(
        parent: &TerminalDirectory,
        leaf: &str,
        closes: &mut Vec<(&'static str, bool)>,
    ) -> TerminalDirectory {
        assert!(["bad-descriptor", "other-object"].contains(&leaf));
        parent.verify().unwrap();
        let path = parent.path.join(leaf);
        assert_eq!(observe_terminal_presence(&path), Ok(false));
        let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
        wide.push(0);
        with_terminal_descriptor(&parent.user, &parent.system, |attributes| {
            // SAFETY: fresh fixture-only child, parent held and live protected descriptor.
            if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                return Err("fixture_child_create_failed");
            }
            Ok(())
        })
        .unwrap();
        let identity = observe_fixture_identity(&path, closes);
        assert_ne!(
            (
                identity.volume_serial_number,
                identity.file_index_high,
                identity.file_index_low
            ),
            (
                parent.identity.volume_serial_number,
                parent.identity.file_index_high,
                parent.identity.file_index_low
            ),
        );
        TerminalDirectory::open(&path, identity).unwrap()
    }

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
        let (_, parent_path, _) = terminal_fixture_context();
        let root = parent_path.join("fixture-current-r1");
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
            let parent = parent_path.as_path();
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
        use crate::process::owned_child::{Completion, OwnedChild};
        let expected = match role {
            "prepared" => 71,
            "published" => 72,
            _ => panic!("cold_role_invalid"),
        };
        let (repository, parent, binary) = terminal_fixture_context();
        assert!(
            unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() } < cutoff
        );
        let command = format!(
            "\"{}\" --exact filesystem::host_record::tests::terminal_cold_fixture_worker --ignored --nocapture --test-threads=1",
            binary.display()
        );
        let environment = format!(
            "CRDD_TERMINAL_COLD_RUN={COLD_RUN}\0CRDD_TERMINAL_FIXTURE_ROOT={}\0CRDD_COLD_ROLE={role}\0CRDD_COLD_CUTOFF={cutoff}\0CRDD_COLD_ROOT_ID={}\0CRDD_COLD_RECORD_ID={}\0TEMP={}\0TMP={}\0\0",
            parent.display(),
            cold_identity_text(root_id),
            cold_identity_text(record_id),
            parent.join("tmp").display(),
            parent.join("tmp").display()
        );
        let mut environment: Vec<u16> = environment.encode_utf16().collect();
        let child = match OwnedChild::spawn(
            &binary,
            std::ffi::OsStr::new(&command),
            &mut environment,
            &repository,
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
        let (_, parent, _) = terminal_fixture_context();
        let role = std::env::var("CRDD_COLD_ROLE").unwrap();
        let cutoff: u64 = std::env::var("CRDD_COLD_CUTOFF").unwrap().parse().unwrap();
        let now = unsafe { windows_sys::Win32::System::SystemInformation::GetTickCount64() };
        assert!(now < cutoff && cutoff - now <= 10_000);
        let root_id = cold_identity_environment("CRDD_COLD_ROOT_ID");
        let record_id = cold_identity_environment("CRDD_COLD_RECORD_ID");
        let root = parent.join("fixture-cold-r1");
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
        let (_, parent_path, _) = terminal_fixture_context();
        let root = parent_path.join("fixture-cold-r1");
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
            let parent = parent_path.as_path();
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

    /// 自作代替対象の作成receiptと清掃直前の実体を照合する。
    ///
    /// @responsibility 不一致と観測不能で削除経路へ進めない。
    /// @trace ERB-IT-002
    /// @precondition 自己生成fixtureの独立した作成Identityを保持している。
    /// @stimulus fresh Native Identityまたは観測不能を渡す。
    /// @observation 五fieldと属性の完全一致。
    /// @oracle 一致だけOk。不明または不一致では対象と退避元を保持する。
    /// @cleanup N/A: このHelperは削除を発行しない。
    /// @boundary 試験内の値判定。原子的清掃と本番Authorityは主張しない。
    fn validate_fixture_cleanup_identity(
        expected: DirectoryIdentity,
        observed: Result<DirectoryIdentity, &'static str>,
    ) -> Result<(), &'static str> {
        if observed? != expected {
            return Err("fixture_cleanup_identity_mismatch");
        }
        Ok(())
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
        let (_, parent_path, _) = terminal_fixture_context();
        let root = parent_path.join("fixture-rename-r1");
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let parent = parent_path.as_path();
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
        let mut phase = "preflight";
        let mut os_error = None;
        let mut closes = Vec::new();
        let mut cleanup_count = 0_u32;
        let mut mutation_effect = false;
        let mut record_receipt: Option<TerminalReceipt> = None;
        let mut collision_receipt: Option<TerminalReceipt> = None;
        let (_, parent_path, _) = terminal_fixture_context();
        let root = parent_path.join("fixture-r4");
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let parent = parent_path.as_path();
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

    /// 自己所有試験handleへ通常dispositionを一回だけ要求する。
    ///
    /// @responsibility 削除要求の受理と失敗時のOS errorを保持し、closeや不存在を返さない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 呼出し元が固定fixture内の同期DELETE handleを一意保持している。
    /// @stimulus FileDispositionInfoのDeleteFile=trueを同じhandleへ指定する。
    /// @observation Win32 BOOLと、false直後の同thread GetLastError。
    /// @oracle 成功はacceptedのみ、失敗は実errorのみを返し、対象を再取得しない。
    /// @cleanup N/A: handleの明示closeと直接不存在は試験Ownerが別に行う。
    /// @boundary cfg(test)→Windows File API。公開操作・Path受付・Authorityは持たない。
    fn request_fixture_disposition(handle: HANDLE) -> (bool, Option<u32>) {
        let disposition = FILE_DISPOSITION_INFO { DeleteFile: true };
        // SAFETY: fixture-owned synchronous DELETE handle; sized private input is live for this call.
        let accepted = unsafe {
            SetFileInformationByHandle(
                handle,
                FileDispositionInfo,
                (&raw const disposition).cast(),
                size_of::<FILE_DISPOSITION_INFO>() as u32,
            )
        } != 0;
        let error = if accepted {
            None
        } else {
            // SAFETY: reads this thread's last error immediately after the failed request.
            Some(unsafe { GetLastError() })
        };
        (accepted, error)
    }

    /// 自己生成した空領域だけで同handle削除・不存在・世代解放の順を実測する。
    ///
    /// @responsibility 要求受理、handle終了と直接不存在を別に観測し、本番清掃許可を発行しない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 固定cwd・run指定・freshなRepository-local親を確認し、全対象をこの試験が作る。
    /// @stimulus 通常FileDispositionInfoだけで非空拒否、六空child、Root、markerと互換reader残存を処置する。
    /// @observation 要求の成否・OS error、個別close、各直接不存在、Root/marker処置中の同世代排他。
    /// @oracle 非空は拒否し、Root不存在後だけmarker処置、reader終端後の不存在後だけ世代を解放する。
    /// @cleanup 成功時だけ空の自作親を非再帰清掃。失敗時は自己handle終了を試し、物理対象を保持する。
    /// @boundary cfg(test) Native→実Windows。旧三件、固定OS保存先、本番ProtocolとAuthorityは対象外。
    #[test]
    #[ignore = "Fixed self-owned disposition fixture; explicit owner required"]
    fn terminal_disposition_fixture() {
        const RUN: &str = "disposition.261004.61d28f4a.r3";
        const NONCE: &str = "61d28f4a-a831-437f-b06c-7d8f896e01b4";
        assert_eq!(
            std::env::var("CRDD_TERMINAL_DISPOSITION_RUN").as_deref(),
            Ok(RUN)
        );
        let (_, run_root, _) = terminal_fixture_context();
        let parent_path = run_root.join("disposition-r3");
        let parent = parent_path.as_path();
        let root_name = format!("crdd-coordinator-doctor-{NONCE}");
        let root = parent.join(&root_name);
        let nonce_hash = sha256(&[NONCE.as_bytes()]).unwrap();
        let marker_name = format!(
            "host-{}.json",
            nonce_hash
                .iter()
                .map(|value| format!("{value:02x}"))
                .collect::<String>()
        );
        let marker = parent.join(&marker_name);
        let extra = root.join("workspace").join("self-owned.txt");
        let bytes = b"self-owned disposition fixture\n";
        let mut handles = Vec::<OwnedHandle>::new();
        let mut guard = None::<TerminalDirectory>;
        let mut generation = None::<OwnedHandle>;
        let mut reader = None::<OwnedHandle>;
        let mut extra_handle = None::<OwnedHandle>;
        let mut closes = Vec::<(&'static str, bool)>::new();
        let mut attempts = Vec::<(bool, Option<u32>)>::new();
        let mut phase = "preflight";
        let mut absences = 0;
        let mut nonempty_rejected = false;
        let mut reader_pending = false;
        let mut generation_reacquired = false;
        let mut parent_removed = false;
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_eq!(observe_terminal_presence(parent), Ok(false));
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            closes.push(("impersonation", close_terminal_handle(&mut impersonation)));
            closes.push(("primary", close_terminal_handle(&mut primary)));
            assert!(closes.iter().all(|(_, closed)| *closed));
            let folders = std::iter::once(parent.to_path_buf())
                .chain(std::iter::once(root.clone()))
                .chain(TERMINAL_TARGET_CHILDREN.map(|name| root.join(name)));
            phase = "create_self_owned";
            generation =
                Some(open_terminal_generation(&user, &system, &root_name, &marker_name).unwrap());
            for path in folders {
                assert_eq!(observe_terminal_presence(&path), Ok(false));
                let wide: Vec<u16> = path
                    .as_os_str()
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();
                with_terminal_descriptor(&user, &system, |attributes| {
                    // SAFETY: fixed, absent, self-owned fixture directory with live descriptor.
                    if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                        return Err("fixture_directory_create_failed");
                    }
                    Ok(())
                })
                .unwrap();
            }
            fs::write(&marker, bytes).unwrap();
            fs::write(&extra, b"test-only\n").unwrap();
            let parent_identity = observe_fixture_identity(parent, &mut closes);
            guard = Some(TerminalDirectory::open(parent, parent_identity).unwrap());
            let paths = std::iter::once(root.clone())
                .chain(std::iter::once(marker.clone()))
                .chain(TERMINAL_TARGET_CHILDREN.map(|name| root.join(name)))
                .collect::<Vec<_>>();
            let known = paths
                .iter()
                .map(|path| observe_fixture_identity(path, &mut closes))
                .collect::<Vec<_>>();
            for (index, path) in paths.iter().enumerate() {
                handles.push(
                    open_terminal_handle(
                        path,
                        FILE_GENERIC_READ | READ_CONTROL | DELETE,
                        FILE_SHARE_READ,
                    )
                    .unwrap(),
                );
                assert_eq!(terminal_identity(handles[index].0).unwrap(), known[index]);
            }
            extra_handle = Some(
                open_terminal_handle(&extra, FILE_GENERIC_READ | DELETE, FILE_SHARE_READ).unwrap(),
            );
            phase = "reject_nonempty";
            let nonempty = request_fixture_disposition(handles[2].0);
            attempts.push(nonempty);
            assert_eq!(
                nonempty,
                (
                    false,
                    Some(windows_sys::Win32::Foundation::ERROR_DIR_NOT_EMPTY)
                )
            );
            assert_eq!(fs::read(&extra).unwrap(), b"test-only\n");
            assert_eq!(terminal_identity(handles[2].0).unwrap(), known[2]);
            nonempty_rejected = true;
            let extra_request = request_fixture_disposition(extra_handle.as_ref().unwrap().0);
            attempts.push(extra_request);
            assert_eq!(extra_request, (true, None));
            closes.push((
                "extra",
                close_terminal_handle(extra_handle.as_mut().unwrap()),
            ));
            assert!(closes.last().unwrap().1);
            assert_eq!(observe_terminal_presence(&extra), Ok(false));
            absences += 1;
            phase = "delete_six_children";
            for index in 2..8 {
                guard.as_ref().unwrap().verify().unwrap();
                assert_eq!(terminal_identity(handles[index].0).unwrap(), known[index]);
                assert_eq!(fs::read_dir(&paths[index]).unwrap().count(), 0);
                let request = request_fixture_disposition(handles[index].0);
                attempts.push(request);
                assert_eq!(request, (true, None));
                closes.push(("child", close_terminal_handle(&mut handles[index])));
                assert!(closes.last().unwrap().1);
                assert_eq!(observe_terminal_presence(&paths[index]), Ok(false));
                absences += 1;
            }
            phase = "delete_root";
            assert!(open_terminal_generation(&user, &system, &root_name, &marker_name).is_err());
            guard.as_ref().unwrap().verify().unwrap();
            assert_eq!(terminal_identity(handles[0].0).unwrap(), known[0]);
            assert_eq!(fs::read_dir(&root).unwrap().count(), 0);
            let root_request = request_fixture_disposition(handles[0].0);
            attempts.push(root_request);
            assert_eq!(root_request, (true, None));
            closes.push(("root", close_terminal_handle(&mut handles[0])));
            assert!(closes.last().unwrap().1);
            assert_eq!(observe_terminal_presence(&root), Ok(false));
            absences += 1;
            phase = "marker_reader_pending";
            assert!(open_terminal_generation(&user, &system, &root_name, &marker_name).is_err());
            reader = Some(
                open_terminal_handle(
                    &marker,
                    FILE_GENERIC_READ,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                )
                .unwrap(),
            );
            guard.as_ref().unwrap().verify().unwrap();
            assert_eq!(terminal_identity(handles[1].0).unwrap(), known[1]);
            assert_eq!(
                read_terminal_bounded_bytes(handles[1].0, MAX_HOST_MARKER_OBSERVATION_BYTES)
                    .unwrap(),
                bytes
            );
            let marker_request = request_fixture_disposition(handles[1].0);
            attempts.push(marker_request);
            assert_eq!(marker_request, (true, None));
            closes.push(("marker_writer", close_terminal_handle(&mut handles[1])));
            assert!(closes.last().unwrap().1);
            assert_ne!(observe_terminal_presence(&marker), Ok(false));
            reader_pending = true;
            closes.push((
                "marker_reader",
                close_terminal_handle(reader.as_mut().unwrap()),
            ));
            assert!(closes.last().unwrap().1);
            assert_eq!(observe_terminal_presence(&marker), Ok(false));
            absences += 1;
            phase = "release_generation";
            closes.push((
                "generation",
                close_terminal_handle(generation.as_mut().unwrap()),
            ));
            assert!(closes.last().unwrap().1);
            let mut reacquired =
                open_terminal_generation(&user, &system, &root_name, &marker_name).unwrap();
            closes.push((
                "reacquired_generation",
                close_terminal_handle(&mut reacquired),
            ));
            assert!(closes.last().unwrap().1);
            generation_reacquired = true;
            phase = "close_parent";
            guard.as_ref().unwrap().verify().unwrap();
            closes.push(("parent_chain", guard.as_mut().unwrap().close()));
            assert!(closes.last().unwrap().1);
            assert_eq!(
                observe_fixture_identity(parent, &mut closes),
                parent_identity
            );
            fs::remove_dir(parent).unwrap();
            assert_eq!(observe_terminal_presence(parent), Ok(false));
            parent_removed = true;
            absences += 1;
            phase = "completed";
        }));
        if outcome.is_err() {
            for handle in handles.iter_mut().rev() {
                closes.push(("failed_target_close", close_terminal_handle(handle)));
            }
            for (owner, handle) in [
                ("failed_extra_close", &mut extra_handle),
                ("failed_reader_close", &mut reader),
                ("failed_generation_close", &mut generation),
            ] {
                if let Some(handle) = handle {
                    closes.push((owner, close_terminal_handle(handle)));
                }
            }
            if let Some(guard) = &mut guard {
                closes.push(("failed_parent_close", guard.close()));
            }
        }
        let success = outcome.is_ok()
            && nonempty_rejected
            && reader_pending
            && generation_reacquired
            && parent_removed
            && absences == 10
            && closes.iter().all(|(_, closed)| *closed);
        let attempt_rows = attempts
            .iter()
            .map(|(accepted, error)| {
                format!(
                    "{{\"accepted\":{accepted},\"osError\":{}}}",
                    error
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "null".to_owned())
                )
            })
            .collect::<Vec<_>>();
        let close_rows = closes
            .iter()
            .map(|(owner, confirmed)| {
                format!("{{\"owner\":\"{owner}\",\"confirmed\":{confirmed}}}")
            })
            .collect::<Vec<_>>();
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-disposition-fixture\",\"status\":\"{}\",\"phase\":\"{phase}\",\"attempts\":[{}],\"closes\":[{}],\"directAbsenceCount\":{absences},\"nonemptyRejected\":{nonempty_rejected},\"readerPendingNotAbsence\":{reader_pending},\"generationReacquired\":{generation_reacquired},\"parentRemoved\":{parent_removed},\"productionIntegrationVerified\":false,\"legacyRootsTouched\":false}}",
            if success { "observed" } else { "unconfirmed" },
            attempt_rows.join(","),
            close_rows.join(",")
        );
        assert!(success, "terminal_disposition_unconfirmed");
    }

    /// 自己生成workspaceの固定fileを観測し、初回closeも返す。
    ///
    /// @responsibility file観測失敗と終了不明を分離し、親guardの保持を維持する。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition この試験が作成したworkspaceと全親chainのguardだけ。
    /// @stimulus 固定fixture.txtをshareREADの同期read handleで開き、私有観測を実行する。
    /// @observation 今回Snapshotまたは元失敗、初回明示close、親guard再照合。
    /// @oracle open失敗を取得後closeへ補完せず、取得後は観測失敗でもcloseを試す。
    /// @cleanup このhelperはhandleだけ終了しfileや親を変更しない。
    /// @boundary 自己生成fixture→私有Native Reader。公開Recoveryではない。
    fn observe_known_file_fixture(
        workspace: &TerminalDirectory,
        known: Option<&TerminalKnownFileSnapshot>,
    ) -> Result<(Result<TerminalKnownFileSnapshot, &'static str>, bool), &'static str> {
        workspace.verify()?;
        let mut handle = open_terminal_handle(
            &workspace.path.join("fixture.txt"),
            FILE_GENERIC_READ | READ_CONTROL,
            FILE_SHARE_READ,
        )?;
        let observed = observe_terminal_known_file(&handle, known);
        let closed = close_terminal_handle(&mut handle);
        workspace.verify()?;
        Ok((observed, closed))
    }

    /// 既知7bytesの同handle観測と反例を自己生成対象で実測する。
    ///
    /// @responsibility 実読取りと初回closeを確認し、非使用・十二実体共同成立を主張しない。
    /// @trace ERB-IT-001
    /// @trace ERB-IT-002
    /// @precondition 固定run/cwd、Repository-local試験Rootの直接不存在、全対象の自己生成。
    /// @stimulus 正常、内容/長さ、Known差、Directory、hardlink、write/delete競合、互換reader、reparseを与える。
    /// @observation 実Snapshot、固定拒否理由、個別close、reparse適用結果と自作Rootの直接不存在。
    /// @oracle 7bytes・固定Hash・リンク数1・前後Identity/EOF一致だけ成功。互換reader成功を非使用としない。
    /// @cleanup 成功時だけ同じ自作Identityを再確認して非再帰清掃。失敗時はguard終了後に物理対象を保持する。
    /// @boundary cfg(test)→実Windows File API。旧三Root・固定OS保存先・Provider・公開処置は対象外。
    #[test]
    #[ignore = "Fixed self-owned known-file fixture; explicit owner required"]
    fn terminal_known_file_fixture() {
        const RUN: &str = "known-file.261004.f17052e1.r1";
        assert_eq!(
            std::env::var("CRDD_TERMINAL_KNOWN_FILE_RUN").as_deref(),
            Ok(RUN)
        );
        let (_, run_root, _) = terminal_fixture_context();
        let parent_path = run_root.join("known-file-r1");
        let parent = parent_path.as_path();
        let workspace = parent.join("workspace");
        let file = workspace.join("fixture.txt");
        let alias = workspace.join("hardlink.txt");
        let destination = workspace.join("known-target.txt");
        let mut guard = None::<TerminalDirectory>;
        let mut closes = Vec::<(&'static str, bool)>::new();
        let mut rejections = Vec::<&'static str>::new();
        let mut reparse_result = "not_evaluated";
        let mut reparse_error = None::<i32>;
        let mut identity_rows = Vec::<(PathBuf, DirectoryIdentity)>::new();
        let mut normal_verified = false;
        let mut compatible_reader_observed = false;
        let mut absence_verified = false;
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert_eq!(observe_terminal_presence(parent), Ok(false));
            let (mut primary, mut impersonation) = process_tokens().unwrap();
            let user = token_user_sid_bytes(primary.0).unwrap();
            let system = local_system_sid_bytes().unwrap();
            closes.push(("impersonation", close_terminal_handle(&mut impersonation)));
            closes.push(("primary", close_terminal_handle(&mut primary)));
            assert!(closes.iter().all(|(_, closed)| *closed));
            for path in [parent.to_path_buf(), workspace.clone()] {
                let wide: Vec<u16> = path
                    .as_os_str()
                    .encode_wide()
                    .chain(std::iter::once(0))
                    .collect();
                with_terminal_descriptor(&user, &system, |attributes| {
                    // SAFETY: absent self-owned directory under the fixed repository-local fixture boundary.
                    if unsafe { CreateDirectoryW(wide.as_ptr(), attributes) } == 0 {
                        return Err("known_file_fixture_create_failed");
                    }
                    Ok(())
                })
                .unwrap();
                identity_rows.push((path.clone(), observe_fixture_identity(&path, &mut closes)));
            }
            guard = Some(TerminalDirectory::open(&workspace, identity_rows[1].1).unwrap());
            let held = guard.as_ref().unwrap();
            assert_eq!(
                observe_known_file_fixture(held, None).unwrap_err(),
                "terminal_open_failed"
            );
            rejections.push("missing");
            std::fs::write(&file, b"BEFORE\n").unwrap();
            let file_identity = observe_fixture_identity(&file, &mut closes);
            let (normal, closed) = observe_known_file_fixture(held, None).unwrap();
            closes.push(("normal_reader", closed));
            let snapshot = normal.unwrap();
            assert_eq!(snapshot.identity, file_identity);
            assert_eq!(snapshot.byte_length, 7);
            assert_eq!(snapshot.sha256, KNOWN_FIXTURE_SHA256);
            assert_eq!(snapshot.link_count, 1);
            let (known, closed) = observe_known_file_fixture(held, Some(&snapshot)).unwrap();
            closes.push(("known_reader", closed));
            assert_eq!(known, Ok(snapshot.clone()));
            let mut mismatch = snapshot.clone();
            mismatch.identity.file_index_low ^= 1;
            let (known, closed) = observe_known_file_fixture(held, Some(&mismatch)).unwrap();
            closes.push(("mismatched_known_reader", closed));
            assert_eq!(known, Err("terminal_known_file_known_mismatch"));
            rejections.push("known_identity");
            normal_verified = true;
            for (bytes, reason) in [
                (
                    b"AFTER!\n".as_slice(),
                    "terminal_known_file_content_invalid",
                ),
                (b"SHORT\n".as_slice(), "terminal_known_file_length_invalid"),
                (
                    b"TOOLONG\n".as_slice(),
                    "terminal_known_file_length_invalid",
                ),
            ] {
                std::fs::write(&file, bytes).unwrap();
                let (observed, closed) = observe_known_file_fixture(held, None).unwrap();
                closes.push(("rejected_reader", closed));
                assert_eq!(observed, Err(reason));
                rejections.push(reason);
            }
            std::fs::write(&file, b"BEFORE\n").unwrap();
            std::fs::hard_link(&file, &alias).unwrap();
            let (observed, closed) = observe_known_file_fixture(held, None).unwrap();
            closes.push(("hardlink_reader", closed));
            assert_eq!(observed, Err("terminal_known_file_links_invalid"));
            rejections.push("hardlink");
            assert_eq!(observe_fixture_identity(&alias, &mut closes), file_identity);
            std::fs::remove_file(&alias).unwrap();
            for access in [FILE_GENERIC_WRITE, DELETE] {
                let mut competitor = open_terminal_handle(
                    &file,
                    access,
                    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                )
                .unwrap();
                assert_eq!(
                    observe_known_file_fixture(held, None).unwrap_err(),
                    "terminal_open_failed"
                );
                rejections.push(if access == DELETE {
                    "delete_competition"
                } else {
                    "write_competition"
                });
                closes.push(("competitor", close_terminal_handle(&mut competitor)));
            }
            let mut compatible = open_terminal_handle(
                &file,
                FILE_GENERIC_READ,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            )
            .unwrap();
            let (observed, closed) = observe_known_file_fixture(held, None).unwrap();
            closes.push(("compatible_observation_reader", closed));
            assert_eq!(observed, Ok(snapshot));
            compatible_reader_observed = true;
            closes.push(("compatible_reader", close_terminal_handle(&mut compatible)));
            assert_eq!(observe_fixture_identity(&file, &mut closes), file_identity);
            std::fs::remove_file(&file).unwrap();
            std::fs::create_dir(&file).unwrap();
            let directory_identity = observe_fixture_identity(&file, &mut closes);
            let (observed, closed) = observe_known_file_fixture(held, None).unwrap();
            closes.push(("directory_reader", closed));
            assert_eq!(observed, Err("terminal_known_file_type_invalid"));
            rejections.push("directory");
            assert_eq!(
                observe_fixture_identity(&file, &mut closes),
                directory_identity
            );
            std::fs::remove_dir(&file).unwrap();
            std::fs::write(&destination, b"BEFORE\n").unwrap();
            let destination_identity = observe_fixture_identity(&destination, &mut closes);
            match std::os::windows::fs::symlink_file(&destination, &file) {
                Ok(()) => {
                    let (observed, closed) = observe_known_file_fixture(held, None).unwrap();
                    closes.push(("reparse_reader", closed));
                    assert_eq!(observed, Err("terminal_known_file_type_invalid"));
                    rejections.push("reparse");
                    reparse_result = "rejected";
                    // This name was just created by this fixture and has no open readers.
                    std::fs::remove_file(&file).unwrap();
                }
                Err(error) => {
                    reparse_error = error.raw_os_error();
                    reparse_result = "creation_unavailable";
                    assert_eq!(observe_terminal_presence(&file), Ok(false));
                }
            }
            assert_eq!(
                observe_fixture_identity(&destination, &mut closes),
                destination_identity
            );
            std::fs::remove_file(&destination).unwrap();
            closes.push(("workspace_guard", guard.as_mut().unwrap().close()));
            assert!(closes.iter().all(|(_, closed)| *closed));
            for (path, expected) in identity_rows.iter().rev() {
                assert_eq!(observe_fixture_identity(path, &mut closes), *expected);
                std::fs::remove_dir(path).unwrap();
                assert_eq!(observe_terminal_presence(path), Ok(false));
            }
            absence_verified = true;
        }));
        if outcome.is_err()
            && let Some(guard) = &mut guard
        {
            closes.push(("failed_workspace_guard", guard.close()));
        }
        let success = outcome.is_ok()
            && normal_verified
            && compatible_reader_observed
            && absence_verified
            && closes.iter().all(|(_, closed)| *closed);
        let rows = rejections
            .iter()
            .map(|reason| format!("\"{reason}\""))
            .collect::<Vec<_>>();
        let close_rows = closes
            .iter()
            .map(|(owner, closed)| format!("{{\"owner\":\"{owner}\",\"confirmed\":{closed}}}"))
            .collect::<Vec<_>>();
        println!(
            "\n{{\"contract\":\"crdd-native/terminal-known-file-fixture\",\"status\":\"{}\",\"normalVerified\":{normal_verified},\"rejections\":[{}],\"reparseResult\":\"{reparse_result}\",\"reparseCreationOsError\":{},\"compatibleReaderObserved\":{compatible_reader_observed},\"closes\":[{}],\"directRootAbsence\":{absence_verified},\"nonUseVerified\":false,\"twelveEntityProtocolVerified\":false,\"productionRecoveryVerified\":false,\"legacyRootsTouched\":false}}",
            if success { "observed" } else { "unconfirmed" },
            rows.join(","),
            reparse_error
                .map(|value| value.to_string())
                .unwrap_or_else(|| "null".to_owned()),
            close_rows.join(",")
        );
        assert!(success, "terminal_known_file_fixture_unconfirmed");
    }
}
