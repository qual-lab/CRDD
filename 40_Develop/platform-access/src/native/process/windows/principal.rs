//! Windowsの実行主体と選択ユーザーのToken・SIDを観測する。
//!
//! @responsibility OS Tokenから主体・所属・認証Sessionを照合し、観測不能を許可へ変換しない。Provider Homeの選択、保存、Process停止を所有しない。
//! @trace ARCH-000008
//! @trace ARCH-000011

use crate::filesystem::protection::{OwnedHandle, sha256};
use crate::protocol::access::{
    PRINCIPAL_APP_CONTAINER, PRINCIPAL_BATCH_GROUP, PRINCIPAL_INTERACTIVE_GROUP,
    PRINCIPAL_NETWORK_GROUP, PRINCIPAL_NONZERO_SESSION, PRINCIPAL_PRIMARY_TOKEN,
    PRINCIPAL_RESTRICTED_TOKEN, PRINCIPAL_SERVICE_GROUP,
};
use std::ffi::c_void;
use std::mem::size_of;
use std::ptr::null_mut;
use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::Security::{
    CheckTokenMembership, CreateWellKnownSid, DuplicateToken, GetLengthSid, GetTokenInformation,
    IsTokenRestricted, IsValidSid, PSID, SecurityImpersonation, TOKEN_DUPLICATE, TOKEN_QUERY,
    TOKEN_STATISTICS, TOKEN_USER, TokenIsAppContainer, TokenPrimary, TokenSessionId,
    TokenStatistics, TokenType, TokenUser, WinBatchSid, WinInteractiveSid, WinLocalSystemSid,
    WinNetworkSid, WinServiceSid,
};
use windows_sys::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};

pub(crate) const REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS: u32 =
    PRINCIPAL_PRIMARY_TOKEN | PRINCIPAL_INTERACTIVE_GROUP | PRINCIPAL_NONZERO_SESSION;

pub(crate) const FORBIDDEN_SELECTED_USER_PRINCIPAL_FLAGS: u32 = PRINCIPAL_SERVICE_GROUP
    | PRINCIPAL_BATCH_GROUP
    | PRINCIPAL_NETWORK_GROUP
    | PRINCIPAL_RESTRICTED_TOKEN
    | PRINCIPAL_APP_CONTAINER;

/// Windows Root・Provider Home観測で使用するTokenBindingObservation契約を表す。
///
/// @responsibility TokenBindingObservationが保持するWindows Root・Provider Home観測の値、状態または分類境界を定義する。
/// @trace ARCH-000011
/// @shape structとしてWindows Root・Provider Home観測のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) struct TokenBindingObservation {
    pub(crate) principal_identity_hash: [u8; 32],
    pub(crate) principal_flags: u32,
    pub(crate) authentication_id: [u8; 8],
}

/// Windows Root・Provider Home観測のprocess tokens責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のprocess tokens責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn process_tokens() -> Option<(OwnedHandle, OwnedHandle)> {
    let mut primary = null_mut();
    // SAFETY: GetCurrentProcess returns a process pseudo-handle and primary is writable.
    if unsafe {
        OpenProcessToken(
            GetCurrentProcess(),
            TOKEN_QUERY | TOKEN_DUPLICATE,
            &mut primary,
        )
    } == 0
    {
        return None;
    }
    let primary = OwnedHandle(primary);
    let mut impersonation = null_mut();
    // SAFETY: primary owns a token with TOKEN_DUPLICATE and output is writable.
    if unsafe { DuplicateToken(primary.0, SecurityImpersonation, &mut impersonation) } == 0 {
        return None;
    }
    Some((primary, OwnedHandle(impersonation)))
}

/// Windows Root・Provider Home観測のcurrent selected user identity hash責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のcurrent selected user identity hash責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn current_selected_user_identity_hash() -> Option<[u8; 32]> {
    let (primary, impersonation) = process_tokens()?;
    let flags = principal_observation_flags(primary.0, impersonation.0)?;
    if flags & REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS != REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS
        || flags & FORBIDDEN_SELECTED_USER_PRINCIPAL_FLAGS != 0
    {
        return None;
    }
    runtime_principal_identity_hash(primary.0)
}

/// Windows Root・Provider Home観測のcopy sid bytes責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のcopy sid bytes責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn copy_sid_bytes(sid: PSID) -> Option<Vec<u8>> {
    if sid.is_null() || unsafe { IsValidSid(sid) } == 0 {
        return None;
    }
    let sid_length = usize::try_from(unsafe { GetLengthSid(sid) }).ok()?;
    if !(8..=68).contains(&sid_length) {
        return None;
    }
    // SAFETY: IsValidSid succeeded and GetLengthSid returned the readable SID length.
    Some(unsafe { std::slice::from_raw_parts(sid.cast::<u8>(), sid_length) }.to_vec())
}

/// Windows Root・Provider Home観測のtoken user sid bytes責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のtoken user sid bytes責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn token_user_sid_bytes(token: HANDLE) -> Option<Vec<u8>> {
    let mut required = 0_u32;
    // SAFETY: the null query obtains the required TOKEN_USER buffer length.
    unsafe { GetTokenInformation(token, TokenUser, null_mut(), 0, &mut required) };
    if required == 0 || required > 65_536 {
        return None;
    }
    let words = usize::try_from(required).ok()?.div_ceil(size_of::<usize>());
    let mut buffer = vec![0_usize; words];
    // SAFETY: buffer is aligned and at least required bytes long.
    if unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            buffer.as_mut_ptr().cast::<c_void>(),
            required,
            &mut required,
        )
    } == 0
    {
        return None;
    }
    // SAFETY: successful TokenUser output begins with an aligned valid TOKEN_USER structure.
    let user = unsafe { &*buffer.as_ptr().cast::<TOKEN_USER>() };
    copy_sid_bytes(user.User.Sid)
}

/// Windows Root・Provider Home観測のruntime principal identity hash責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のruntime principal identity hash責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn runtime_principal_identity_hash(token: HANDLE) -> Option<[u8; 32]> {
    let sid = token_user_sid_bytes(token)?;
    const DOMAIN: &[u8] = b"CRDD\0WINDOWS-RUNTIME-PRINCIPAL\0V1\0";
    let length = u64::try_from(sid.len()).ok()?.to_be_bytes();
    sha256(&[DOMAIN, &length, &sid])
}

/// Windows Root・Provider Home観測のtoken authentication id責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のtoken authentication id責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn token_authentication_id(token: HANDLE) -> Option<[u8; 8]> {
    let mut statistics = TOKEN_STATISTICS::default();
    let mut returned = 0_u32;
    // SAFETY: statistics is a correctly sized writable TOKEN_STATISTICS buffer.
    if unsafe {
        GetTokenInformation(
            token,
            TokenStatistics,
            (&raw mut statistics).cast::<c_void>(),
            u32::try_from(size_of::<TOKEN_STATISTICS>()).ok()?,
            &mut returned,
        )
    } == 0
        || returned != u32::try_from(size_of::<TOKEN_STATISTICS>()).ok()?
    {
        return None;
    }
    let mut bytes = [0_u8; 8];
    bytes[..4].copy_from_slice(&statistics.AuthenticationId.LowPart.to_le_bytes());
    bytes[4..].copy_from_slice(&statistics.AuthenticationId.HighPart.to_le_bytes());
    Some(bytes)
}

/// Windows Root・Provider Home観測のtoken u32 information責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のtoken u32 information責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn token_u32_information(token: HANDLE, information_class: i32) -> Option<u32> {
    let mut value = 0_u32;
    let mut returned = 0_u32;
    // SAFETY: value is a writable DWORD-sized buffer and token has TOKEN_QUERY access.
    if unsafe {
        GetTokenInformation(
            token,
            information_class,
            (&raw mut value).cast::<c_void>(),
            u32::try_from(size_of::<u32>()).ok()?,
            &mut returned,
        )
    } == 0
        || returned != u32::try_from(size_of::<u32>()).ok()?
    {
        return None;
    }
    Some(value)
}

/// Windows Root・Provider Home観測のwell known membership責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のwell known membership責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn well_known_membership(token: HANDLE, sid_type: i32) -> Option<bool> {
    let mut sid_words = [0_usize; 9];
    let mut sid_bytes = u32::try_from(size_of_val(&sid_words)).ok()?;
    // SAFETY: sid_words is aligned writable storage large enough for a maximum Windows SID.
    if unsafe {
        CreateWellKnownSid(
            sid_type,
            null_mut(),
            sid_words.as_mut_ptr().cast::<c_void>(),
            &mut sid_bytes,
        )
    } == 0
    {
        return None;
    }
    let mut is_member = 0;
    // SAFETY: the SID was produced by CreateWellKnownSid and token is an impersonation token.
    if unsafe {
        CheckTokenMembership(
            token,
            sid_words.as_mut_ptr().cast::<c_void>(),
            &mut is_member,
        )
    } == 0
    {
        return None;
    }
    Some(is_member != 0)
}

/// Windows Root・Provider Home観測のprincipal observation flags責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のprincipal observation flags責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn principal_observation_flags(primary: HANDLE, impersonation: HANDLE) -> Option<u32> {
    if token_u32_information(primary, TokenType)? != u32::try_from(TokenPrimary).ok()? {
        return None;
    }
    let mut flags = PRINCIPAL_PRIMARY_TOKEN;
    for (sid_type, flag) in [
        (WinInteractiveSid, PRINCIPAL_INTERACTIVE_GROUP),
        (WinServiceSid, PRINCIPAL_SERVICE_GROUP),
        (WinBatchSid, PRINCIPAL_BATCH_GROUP),
        (WinNetworkSid, PRINCIPAL_NETWORK_GROUP),
    ] {
        if well_known_membership(impersonation, sid_type)? {
            flags |= flag;
        }
    }
    if unsafe { IsTokenRestricted(primary) } != 0 {
        flags |= PRINCIPAL_RESTRICTED_TOKEN;
    }
    if token_u32_information(primary, TokenIsAppContainer)? != 0 {
        flags |= PRINCIPAL_APP_CONTAINER;
    }
    if token_u32_information(primary, TokenSessionId)? != 0 {
        flags |= PRINCIPAL_NONZERO_SESSION;
    }
    Some(flags)
}

/// Windows Root・Provider Home観測のselected user token binding責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のselected user token binding責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn selected_user_token_binding(
    primary: HANDLE,
    impersonation: HANDLE,
) -> Option<TokenBindingObservation> {
    let principal_flags = principal_observation_flags(primary, impersonation)?;
    if principal_flags & REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS
        != REQUIRED_SELECTED_USER_PRINCIPAL_FLAGS
        || principal_flags & FORBIDDEN_SELECTED_USER_PRINCIPAL_FLAGS != 0
    {
        return None;
    }
    Some(TokenBindingObservation {
        principal_identity_hash: runtime_principal_identity_hash(primary)?,
        principal_flags,
        authentication_id: token_authentication_id(primary)?,
    })
}

/// Windows Root・Provider Home観測のlocal user binding hash責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のlocal user binding hash責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
pub(crate) fn local_user_binding_hash(binding: TokenBindingObservation) -> Option<[u8; 32]> {
    const DOMAIN: &[u8] = b"CRDD\0LOCAL-USER-BINDING\0V1\0";
    sha256(&[
        DOMAIN,
        &binding.principal_identity_hash,
        &binding.authentication_id,
        &binding.principal_flags.to_le_bytes(),
    ])
}

/// Windows Root・Provider Home観測のlocal system sid bytes責務を実行する。
///
/// @responsibility Windows Root・Provider Home観測のlocal system sid bytes責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000011
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Native Worker→Windows Identity／ACL API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub(crate) fn local_system_sid_bytes() -> Option<Vec<u8>> {
    let mut storage = [0_usize; 9];
    let mut byte_length = u32::try_from(size_of_val(&storage)).ok()?;
    // SAFETY: storage is aligned writable memory large enough for a maximum Windows SID.
    if unsafe {
        CreateWellKnownSid(
            WinLocalSystemSid,
            null_mut(),
            storage.as_mut_ptr().cast::<c_void>(),
            &mut byte_length,
        )
    } == 0
    {
        return None;
    }
    copy_sid_bytes(storage.as_mut_ptr().cast::<c_void>())
}
