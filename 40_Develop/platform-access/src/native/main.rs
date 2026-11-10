//! Platform Access Native Workerの固定Protocol入口を提供する。
//!
//! @responsibility framed requestを分類し、許可されたWindows観測・限定操作へdispatchして構造化応答を返す。
//! @trace ARCH-000004
//! @trace ARCH-000008
//! @trace ARCH-000011

mod protocol;

#[cfg(windows)]
mod filesystem;

#[allow(dead_code)]
#[cfg(windows)]
mod process;

use std::ffi::OsStr;
use std::io::{Read, Write};

use protocol::access::{
    Provider, ProviderHomeReason, ProviderHomeResponse, parse_provider_home_request,
    read_request_from, write_provider_home_response_to, write_response_to,
};

/// Native Worker入口のinvalid provider home response責務を実行する。
///
/// @responsibility Native Worker入口のinvalid provider home response責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→Native Worker→Windows API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn invalid_provider_home_response() -> ProviderHomeResponse {
    ProviderHomeResponse {
        provider: Provider::Codex,
        nonce: [0_u8; 32],
        is_candidate: false,
        reason: ProviderHomeReason::InvalidRequest,
        principal_observation_flags: 0,
        home_observation_flags: 0,
        provider_home_identity_hash: [0_u8; 32],
        provider_home_protection_hash: [0_u8; 32],
        local_user_binding_hash: [0_u8; 32],
        stable_logical_home_binding_hash: [0_u8; 32],
    }
}

/// Native Worker入口のexecute bytes責務を実行する。
///
/// @responsibility Native Worker入口のexecute bytes責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→Native Worker→Windows API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn execute_bytes(request_bytes: &[u8], writer: &mut impl Write) -> i32 {
    if let Some(request) = parse_provider_home_request(request_bytes) {
        #[cfg(windows)]
        let response = filesystem::protected_root::observe_provider_home(&request);

        #[cfg(not(windows))]
        let response = ProviderHomeResponse {
            provider: request.provider,
            nonce: request.nonce,
            is_candidate: false,
            reason: ProviderHomeReason::UnsupportedPlatform,
            principal_observation_flags: 0,
            home_observation_flags: 0,
            provider_home_identity_hash: [0_u8; 32],
            provider_home_protection_hash: [0_u8; 32],
            local_user_binding_hash: [0_u8; 32],
            stable_logical_home_binding_hash: [0_u8; 32],
        };

        if write_provider_home_response_to(writer, response).is_err() {
            return 3;
        }
        return if response.is_candidate { 0 } else { 2 };
    }
    if request_bytes.get(..6) == Some(b"CRDDPH") {
        let _ = write_provider_home_response_to(writer, invalid_provider_home_response());
    } else {
        let _ = write_response_to(writer);
    }
    2
}

/// Native Worker入口のexecute責務を実行する。
///
/// @responsibility Native Worker入口のexecute責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→Native Worker→Windows API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn execute(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    let request_bytes = read_request_from(reader);
    match request_bytes {
        Ok(bytes) => execute_bytes(&bytes, writer),
        Err(_) => {
            let _ = write_response_to(writer);
            2
        }
    }
}

/// Native Worker入口で使用するInvocationMode契約を表す。
///
/// @responsibility InvocationModeが保持するNative Worker入口の値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape enumとしてNative Worker入口のfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary Coordinator→Native Worker→Windows API。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
enum InvocationMode {
    WindowsDirectory,
    FilesystemEntry(std::ffi::OsString),
    Standard,
}

/// Native Worker入口のinvocation mode責務を実行する。
///
/// @responsibility Native Worker入口のinvocation mode責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→Native Worker→Windows API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn invocation_mode() -> Result<InvocationMode, ()> {
    let mut arguments = std::env::args_os().skip(1);
    let Some(mode) = arguments.next() else {
        return Ok(InvocationMode::Standard);
    };
    if mode == OsStr::new("--filesystem-entry") {
        let path = arguments.next().ok_or(())?;
        return if arguments.next().is_none() {
            Ok(InvocationMode::FilesystemEntry(path))
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--system-windows-directory") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::WindowsDirectory)
        } else {
            Err(())
        };
    }

    Err(())
}

/// Native Worker入口の実行入口を開始する。
///
/// @responsibility Native Worker入口の実行入口を開始する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect OS APIからread-only観測を取得する。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Coordinator→Native Worker→Windows API。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn main() {
    let exit_code = match invocation_mode() {
        Ok(InvocationMode::FilesystemEntry(path)) => {
            #[cfg(windows)]
            {
                filesystem::entry_observation::run(&path, &mut std::io::stdout())
            }
            #[cfg(not(windows))]
            {
                let _ = path;
                2
            }
        }
        Ok(InvocationMode::WindowsDirectory) => {
            #[cfg(windows)]
            {
                filesystem::windows_directory::run(&mut std::io::stdout())
            }
            #[cfg(not(windows))]
            {
                2
            }
        }
        Ok(InvocationMode::Standard) => execute(&mut std::io::stdin(), &mut std::io::stdout()),

        Err(()) => {
            let _ = write_response_to(&mut std::io::stdout());
            2
        }
    };
    if exit_code != 0 {
        std::process::exit(exit_code);
    }
}
