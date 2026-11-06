//! Namespace初期化のhandle・実体・保護操作を所有する。
//! @responsibility 終端記録の保存・公開・読取りは提供しない。
//! @trace ARCH-000008
//! @trace ARCH-000011
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
use windows_sys::Win32::Foundation::{CloseHandle, HANDLE, INVALID_HANDLE_VALUE, LocalFree};
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
    CreateFileW, FILE_ALL_ACCESS, FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS,
    FILE_FLAG_OPEN_REPARSE_POINT, OPEN_EXISTING,
};

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
