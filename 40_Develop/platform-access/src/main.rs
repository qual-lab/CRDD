//! Platform Access Native Workerの固定Protocol入口を提供する。
//!
//! @responsibility framed requestを分類し、許可されたWindows観測・限定操作へdispatchして構造化応答を返す。
//! @trace ARCH-000004
//! @trace ARCH-000008
//! @trace ARCH-000011

mod host_namespace_protocol;
mod protocol;
mod terminal_protocol;

#[cfg(windows)]
mod windows_directory;

#[allow(dead_code)]
#[cfg(windows)]
mod windows;

#[cfg(windows)]
mod docker_repair;

#[cfg(windows)]
mod docker_authenticode;

#[allow(dead_code)]
#[cfg(windows)]
mod windows_owned_child;

use std::ffi::OsStr;
use std::fs::OpenOptions;
use std::io::{Read, Write};

use protocol::{
    Provider, ProviderHomeReason, ProviderHomeResponse, Reason, Response, RootRole,
    parse_provider_home_request, parse_request, read_framed_request_from, read_request_from,
    write_provider_home_response_to, write_response_to,
};

/// Native Worker入口のinvalid response責務を実行する。
///
/// @responsibility Native Worker入口のinvalid response責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
fn invalid_response() -> Response {
    Response {
        root_role: RootRole::Runtime,
        nonce: [0_u8; 32],
        is_candidate: false,
        reason: Reason::InvalidRequest,
        access_mask: 0,
        runtime_principal_identity_hash: [0_u8; 32],
        principal_observation_flags: 0,
    }
}

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
        let response = windows::observe_provider_home(&request);

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
    let Some(request) = parse_request(request_bytes) else {
        if request_bytes.get(..6) == Some(b"CRDDPH") {
            let _ = write_provider_home_response_to(writer, invalid_provider_home_response());
        } else {
            let _ = write_response_to(writer, invalid_response());
        }
        return 2;
    };

    #[cfg(windows)]
    let response = windows::observe(&request);

    #[cfg(not(windows))]
    let response = Response {
        root_role: request.root_role,
        nonce: request.nonce,
        is_candidate: false,
        reason: Reason::UnsupportedPlatform,
        access_mask: 0,
        runtime_principal_identity_hash: [0_u8; 32],
        principal_observation_flags: 0,
    };

    if write_response_to(writer, response).is_err() {
        return 3;
    }
    if response.is_candidate { 0 } else { 2 }
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
fn execute(reader: &mut impl Read, writer: &mut impl Write, framed: bool) -> i32 {
    let request_bytes = if framed {
        read_framed_request_from(reader)
    } else {
        read_request_from(reader)
    };
    match request_bytes {
        Ok(bytes) => execute_bytes(&bytes, writer),
        Err(_) => {
            let _ = write_response_to(writer, invalid_response());
            2
        }
    }
}

/// 固定共有管理境界の読取りと保護付き初期化を別modeで受け付ける。
///
/// @responsibility mode混用をOS取得前に拒否し、部分処置と終了を同じnonceへ搬送する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 最大98bytesの専用stdin、stdoutと固定dispatchのmode。
/// @returns 確認済み0、停止2、搬送失敗3。
/// @precondition 作成modeの呼出し側は署名配布物と許可範囲を確認する。
/// @postcondition 応答搬送失敗を未発行または作成完了と主張しない。
/// @effect 読取りmodeは固定親の取得のみ。作成modeは固定二childだけを保護付き作成する。
/// @failure frame、OS取得・作成・保護・終了または搬送不明は停止する。
/// @invariant ACL移行、共有Directory削除、元Task再実行を発行しない。
/// @boundary 専用stdin→Windows管理境界→専用stdout。
/// @security 自由Path、SID、maskまたは清掃Authorityを搬送しない。
/// @concurrency 同期一要求、全取得handleの明示終了後だけ応答する。
fn execute_host_recovery_namespace(
    reader: &mut impl Read,
    writer: &mut impl Write,
    initialize: bool,
) -> i32 {
    let mut bytes = Vec::new();
    let response = if reader
        .take((host_namespace_protocol::MAX_REQUEST_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .is_err()
    {
        host_namespace_protocol::blocked([0; 32], "terminal_namespace_request_read_failed")
    } else if let Some(request) = host_namespace_protocol::parse_request(&bytes, initialize) {
        #[cfg(windows)]
        let response = windows::host_recovery_namespace_request(&request);
        #[cfg(not(windows))]
        let response =
            host_namespace_protocol::blocked(request.nonce, "terminal_platform_unsupported");
        response
    } else {
        host_namespace_protocol::blocked([0; 32], "terminal_namespace_request_invalid")
    };
    let completed = response.status != 0;
    let Some(encoded) = host_namespace_protocol::encode_response(&response) else {
        return 3;
    };
    if writer
        .write_all(&encoded)
        .and_then(|()| writer.flush())
        .is_err()
    {
        return 3;
    }
    if completed { 0 } else { 2 }
}

/// 用途限定のHost対象確認を受け付ける。
///
/// @responsibility 確認専用要求を分類し、終了済みの観測結果だけを搬送する。
/// @trace ARCH-000011
/// @input 専用modeのstdinとstdout。
/// @returns 観測成功0、拒否2、応答搬送失敗3。
/// @precondition --host-terminal-observeだけで起動されている。
/// @postcondition 不正要求ではOS取得を行わず、応答失敗を成功にしない。
/// @effect 正常要求だけ固定namespaceの読取りhandleを取得する。Filesystem変更0。
/// @failure 入力読取り、不正frame、観測・close不明、応答write/flush失敗を区別する。
/// @invariant 観測成功から非使用認定や清掃Authorityを発行しない。
/// @boundary Coordinator用途限定Adapter→Native標準入出力→Windows観測。
/// @security 自由Path、SID、marker本文、元Task Tokenを搬送しない。
/// @concurrency 一要求を同期処理し、外側handleの終了後だけ応答する。
fn execute_host_terminal_observation(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    let mut bytes = Vec::new();
    let response = if reader.take(343).read_to_end(&mut bytes).is_err() {
        terminal_protocol::rejected([0; 32], "terminal_request_read_failed", 1)
    } else if let Some(request) = terminal_protocol::parse_request(&bytes) {
        #[cfg(windows)]
        let response = windows::observe_host_terminal_target(&request);
        #[cfg(not(windows))]
        let response =
            terminal_protocol::rejected(request.nonce, "terminal_platform_unsupported", 5);
        response
    } else {
        terminal_protocol::rejected([0; 32], "terminal_request_invalid", 1)
    };
    let completed = response.snapshot.is_some();
    let Some(encoded) = terminal_protocol::encode_response(&response) else {
        return 3;
    };
    if writer
        .write_all(&encoded)
        .and_then(|()| writer.flush())
        .is_err()
    {
        return 3;
    }
    if completed { 0 } else { 2 }
}

/// 既知fileの十二実体観測を旧modeと分離して受け付ける。
///
/// @responsibility 固定入力と全終了を検証し、専用payloadを損失なく搬送する。
/// @trace ARCH-000011
/// @input 専用modeのstdinとstdout。
/// @returns 観測成立0、拒否2、搬送失敗3。
/// @precondition --host-terminal-known-file-observeだけで起動されている。
/// @postcondition 不正要求はOS取得前に拒否する。
/// @effect 正常要求だけ固定対象へread-only取得。変更・保存・削除0。
/// @failure 要求不正、取得・読取り・終了不明、write／flush失敗を区別する。
/// @invariant 成功を非使用、保存、清掃Authorityへ昇格しない。
/// @boundary 専用stdin→Windows保持観測→専用stdout。
/// @security 自由Path、file本文、SID、秘密を搬送しない。
/// @concurrency 一要求の全終了試行後だけ結果を返す。
fn execute_known_file_host_terminal_observation(
    reader: &mut impl Read,
    writer: &mut impl Write,
) -> i32 {
    let mut bytes = Vec::new();
    let response = if reader.take(343).read_to_end(&mut bytes).is_err() {
        terminal_protocol::rejected([0; 32], "terminal_request_read_failed", 1)
    } else if let Some(request) = terminal_protocol::parse_known_file_request(&bytes) {
        #[cfg(windows)]
        let response = windows::observe_known_file_host_terminal_target(&request);
        #[cfg(not(windows))]
        let response =
            terminal_protocol::rejected(request.target.nonce, "terminal_platform_unsupported", 5);
        response
    } else {
        terminal_protocol::rejected([0; 32], "terminal_request_invalid", 1)
    };
    let completed = response.snapshot.is_some();
    let Some(encoded) = terminal_protocol::encode_known_file_response(&response) else {
        return 3;
    };
    if writer
        .write_all(&encoded)
        .and_then(|()| writer.flush())
        .is_err()
    {
        return 3;
    }
    if completed { 0 } else { 2 }
}

/// 同参照の対象確認付き保存を専用modeで実行する。
///
/// @responsibility 固定上限の要求と全部分receiptを搬送し、応答失敗をEffect 0にしない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 専用modeのstdinとstdout。
/// @returns 保存共同成立0、拒否2、応答搬送不明3。
/// @precondition --host-terminal-saveだけで起動されている。
/// @postcondition 不正frameは取得前拒否し、既知参照は結果へ保持する。
/// @effect 正常要求だけ固定namespaceの確認と一記録保存を実行する。
/// @failure 不正frame、対象差、保存・終了・搬送不明で停止する。
/// @invariant Process exitだけから記録Effect 0や清掃成功を主張しない。
/// @boundary Coordinator保存Adapter→専用stdin→Windows保存Owner。
/// @security 任意Path、namespace修復、Process停止、削除またはAuthorityを提供しない。
/// @concurrency 一要求を同期実行し、全終了試行後の完全frameだけ返す。
fn execute_host_terminal_save(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    execute_terminal_record_save(
        reader,
        writer,
        terminal_protocol::MAX_SAVE_REQUEST_BYTES,
        terminal_protocol::parse_save_request,
        terminal_protocol::encode_save_response,
        #[cfg(windows)]
        windows::save_host_terminal_target,
    )
}

/// 十二実体の専用保存frameだけを実行する。
///
/// @responsibility 新旧modeの混用を拒否して全期待値をNative Ownerへ渡す。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 専用stdin／stdout。
/// @returns 保存共同成立0、拒否2、搬送不明3。
/// @precondition 専用mode以外の引数はない。
/// @postcondition 同参照と部分receiptを保持する。
/// @effect 正常要求だけ固定namespaceに一記録を保存する。
/// @failure 不正frameは取得0、保存・終了・搬送不明は停止。
/// @invariant 本文SchemaをNativeで推測補完しない。
/// @boundary 専用dispatch→Windows保存Owner。
/// @security 任意Path・削除・権限修復なし。
/// @concurrency 一要求の同期処置だけ。
fn execute_known_file_host_terminal_save(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    execute_terminal_record_save(
        reader,
        writer,
        terminal_protocol::MAX_KNOWN_FILE_RECORD_REQUEST_BYTES,
        terminal_protocol::parse_known_file_save_request,
        terminal_protocol::encode_known_file_save_response,
        #[cfg(windows)]
        windows::save_known_file_host_terminal_target,
    )
}

/// 型付き専用保存をbounded搬送へ閉じる。
///
/// @responsibility クラス固有parser・実行・encoderを同じ入口へ接続する。
/// @trace ARCH-000008
/// @input 私有の固定構成と一要求のstdin／stdout。
/// @returns 共同成立0、拒否2、返却不明3。
/// @precondition 固定wrapperが型と上限を決定する。
/// @postcondition 全結果を切詰めず返却する。
/// @effect 正常frameだけ記録保存と全資源終了を発行する。
/// @failure 余剰・不正・取得・保存・終了・stdout不明は停止する。
/// @invariant stdout不明を保存Effect 0へ畳まない。
/// @boundary 私有stdin→Windows Owner→専用stdout。
/// @security 外部から任意mode・上限・encoderを渡せない。
/// @concurrency 同期一要求だけ。
fn execute_terminal_record_save<S>(
    reader: &mut impl Read,
    writer: &mut impl Write,
    maximum: usize,
    parse: fn(&[u8]) -> Option<terminal_protocol::TerminalSaveRequest<S>>,
    encode: fn(&terminal_protocol::TerminalSaveResponse<S>) -> Option<Vec<u8>>,
    #[cfg(windows)] perform: fn(
        &terminal_protocol::TerminalSaveRequest<S>,
    ) -> terminal_protocol::TerminalSaveResponse<S>,
) -> i32 {
    let mut bytes = Vec::new();
    let parsed = if reader
        .take((maximum + 1) as u64)
        .read_to_end(&mut bytes)
        .is_ok()
    {
        parse(&bytes)
    } else {
        None
    };
    let response = if let Some(request) = parsed {
        #[cfg(windows)]
        let response = perform(&request);
        #[cfg(not(windows))]
        let response = terminal_protocol::TerminalSaveResponse {
            reference: Some(request.reference),
            saved: false,
            reasons: ["terminal_platform_unsupported", "", "", "", ""],
            observation: terminal_protocol::rejected(
                request.nonce,
                "terminal_platform_unsupported",
                5,
            ),
            receipt: None,
        };
        response
    } else {
        terminal_protocol::TerminalSaveResponse {
            reference: None,
            saved: false,
            reasons: ["terminal_save_request_invalid", "", "", "", ""],
            observation: terminal_protocol::rejected([0; 32], "terminal_save_request_invalid", 1),
            receipt: None,
        }
    };
    let completed = response.saved;
    let Some(encoded) = encode(&response) else {
        return 3;
    };
    if writer
        .write_all(&encoded)
        .and_then(|()| writer.flush())
        .is_err()
    {
        return 3;
    }
    if completed { 0 } else { 2 }
}

/// 固定記録の現在読戻しを専用binary modeで行う。
///
/// @responsibility 保存と読取りを分離し、全部分結果を切詰めず返す。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input --host-terminal-readだけのstdin/ stdout。
/// @returns 現在観測共同成立0、拒否2、応答搬送不明3。
/// @precondition 専用modeで余剰引数がない。
/// @postcondition 不正入力は資源取得前に拒否し同参照を保持する。
/// @effect 正常要求の固定namespace/記録読取りのみ。
/// @failure 入力・観測・終了・搬送不明を停止する。
/// @invariant exitだけから対象非使用や清掃成功を主張しない。
/// @boundary Coordinator読戻しAdapter→Native。
/// @security 任意Path、初期化、再保存、復元、削除を行わない。
/// @concurrency 一要求を同期処置する。
fn execute_host_terminal_read(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    execute_terminal_record_read(
        reader,
        writer,
        terminal_protocol::MAX_SAVE_REQUEST_BYTES,
        terminal_protocol::parse_read_request,
        terminal_protocol::encode_read_response,
        #[cfg(windows)]
        windows::read_host_terminal_record,
    )
}

/// 十二実体の専用読戻しframeだけを実行する。
///
/// @responsibility 同参照・独立本文を保持して現在Readerへ渡す。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 専用stdin／stdout。
/// @returns 現在観測0、拒否2、搬送不明3。
/// @precondition 余剰引数がない専用modeである。
/// @postcondition 対象Root消失を読取り拒否条件にしない。
/// @effect 固定記録の読取りと同世代排他だけ。
/// @failure 不正・現在記録差・終了・搬送不明は停止する。
/// @invariant 対象未試行と対象不存在を区別する。
/// @boundary 専用dispatch→現在記録Reader。
/// @security 保存・復元・削除・権限修復なし。
/// @concurrency 一要求を同期的に終了する。
fn execute_known_file_host_terminal_read(reader: &mut impl Read, writer: &mut impl Write) -> i32 {
    execute_terminal_record_read(
        reader,
        writer,
        terminal_protocol::MAX_KNOWN_FILE_RECORD_REQUEST_BYTES,
        terminal_protocol::parse_known_file_read_request,
        terminal_protocol::encode_known_file_read_response,
        #[cfg(windows)]
        windows::read_known_file_host_terminal_record,
    )
}

/// 型付き読戻しをbounded搬送へ閉じる。
///
/// @responsibility 型とmodeを維持して同参照の部分結果を返す。
/// @trace ARCH-000008
/// @input 内部固定構成と専用stdin／stdout。
/// @returns 現在観測0、拒否2、返却不明3。
/// @precondition 専用wrapperだけがparser・encoderを選ぶ。
/// @postcondition 初回結果と各終了を保持する。
/// @effect 正常frameだけ固定記録の読取り・世代排他を取得する。
/// @failure 不正frameは取得0、未知・終了・搬送不明は停止する。
/// @invariant reader成功を清掃Authorityにしない。
/// @boundary 私有stdin→Native Reader→専用stdout。
/// @security 記録や対象を変更せず自由Pathを受理しない。
/// @concurrency 同期一要求だけ。
fn execute_terminal_record_read<S>(
    reader: &mut impl Read,
    writer: &mut impl Write,
    maximum: usize,
    parse: fn(&[u8]) -> Option<terminal_protocol::TerminalSaveRequest<S>>,
    encode: fn(&terminal_protocol::TerminalReadResponse<S>) -> Option<Vec<u8>>,
    #[cfg(windows)] perform: fn(
        &terminal_protocol::TerminalSaveRequest<S>,
    ) -> terminal_protocol::TerminalReadResponse<S>,
) -> i32 {
    let mut bytes = Vec::new();
    let parsed = if reader
        .take((maximum + 1) as u64)
        .read_to_end(&mut bytes)
        .is_ok()
    {
        parse(&bytes)
    } else {
        None
    };
    let rejected = |reference, nonce, reason, phase| terminal_protocol::TerminalReadResponse {
        reference,
        observed: false,
        state: 0,
        reason,
        operation_reason: None,
        record_identity: None,
        open_issued: false,
        opened: false,
        reader_close: None,
        generation_acquired: false,
        generation_close: None,
        observation: terminal_protocol::rejected(nonce, reason, phase),
    };
    let response = if let Some(request) = parsed {
        #[cfg(windows)]
        let response = perform(&request);
        #[cfg(not(windows))]
        let response = rejected(
            Some(request.reference),
            request.nonce,
            "terminal_platform_unsupported",
            5,
        );
        response
    } else {
        rejected(None, [0; 32], "terminal_read_request_invalid", 1)
    };
    let completed = response.observed;
    let Some(encoded) = encode(&response) else {
        return 3;
    };
    if writer
        .write_all(&encoded)
        .and_then(|()| writer.flush())
        .is_err()
    {
        return 3;
    }
    if completed { 0 } else { 2 }
}

/// Native Worker入口のvalid appcontainer pipe name責務を実行する。
///
/// @responsibility Native Worker入口のvalid appcontainer pipe name責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
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
fn valid_appcontainer_pipe_name(value: &str) -> bool {
    const PREFIX: &str = r"\\.\pipe\CRDD.Coordinator.";
    let Some(suffix) = value.strip_prefix(PREFIX) else {
        return false;
    };
    !suffix.is_empty()
        && suffix.len() <= 10
        && suffix.bytes().all(|byte| byte.is_ascii_digit())
        && !suffix.starts_with('0')
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
    Standard,
    AppContainer(String),
    DockerDesktopRepair,
    DockerDesktopRestart,
    HostTerminalObserve,
    HostTerminalKnownFileObserve,
    HostTerminalSave,
    HostTerminalRead,
    HostTerminalKnownFileSave,
    HostTerminalKnownFileRead,
    HostRecoveryNamespaceObserve,
    HostRecoveryNamespaceInitialize,
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
    if mode == OsStr::new("--system-windows-directory") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::WindowsDirectory)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--docker-desktop-repair-helper") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::DockerDesktopRepair)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--docker-desktop-restart-helper") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::DockerDesktopRestart)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-recovery-namespace-observe") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostRecoveryNamespaceObserve)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-recovery-namespace-initialize") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostRecoveryNamespaceInitialize)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-terminal-observe") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostTerminalObserve)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-terminal-save") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostTerminalSave)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-terminal-known-file-observe") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostTerminalKnownFileObserve)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-terminal-read") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostTerminalRead)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-terminal-known-file-save") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostTerminalKnownFileSave)
        } else {
            Err(())
        };
    }
    if mode == OsStr::new("--host-terminal-known-file-read") {
        return if arguments.next().is_none() {
            Ok(InvocationMode::HostTerminalKnownFileRead)
        } else {
            Err(())
        };
    }
    if mode != OsStr::new("--appcontainer-pipe") {
        return Err(());
    }
    let Some(pipe) = arguments.next().and_then(|value| value.into_string().ok()) else {
        return Err(());
    };
    if arguments.next().is_some() || !valid_appcontainer_pipe_name(&pipe) {
        return Err(());
    }
    Ok(InvocationMode::AppContainer(pipe))
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
        Ok(InvocationMode::WindowsDirectory) => {
            #[cfg(windows)]
            {
                windows_directory::run(&mut std::io::stdout())
            }
            #[cfg(not(windows))]
            {
                2
            }
        }
        Ok(InvocationMode::Standard) => {
            execute(&mut std::io::stdin(), &mut std::io::stdout(), false)
        }
        Ok(InvocationMode::AppContainer(pipe_name)) => {
            match OpenOptions::new().read(true).write(true).open(pipe_name) {
                Ok(mut pipe) => match pipe.try_clone() {
                    Ok(mut reader) => execute(&mut reader, &mut pipe, true),
                    Err(_) => 3,
                },
                Err(_) => 3,
            }
        }
        Ok(InvocationMode::DockerDesktopRepair) => {
            #[cfg(windows)]
            {
                docker_repair::run(&mut std::io::stdin(), &mut std::io::stdout())
            }
            #[cfg(not(windows))]
            {
                2
            }
        }
        Ok(InvocationMode::DockerDesktopRestart) => {
            #[cfg(windows)]
            {
                docker_repair::run_restart(&mut std::io::stdin(), &mut std::io::stdout())
            }
            #[cfg(not(windows))]
            {
                2
            }
        }
        Ok(InvocationMode::HostRecoveryNamespaceObserve) => {
            execute_host_recovery_namespace(&mut std::io::stdin(), &mut std::io::stdout(), false)
        }
        Ok(InvocationMode::HostRecoveryNamespaceInitialize) => {
            execute_host_recovery_namespace(&mut std::io::stdin(), &mut std::io::stdout(), true)
        }
        Ok(InvocationMode::HostTerminalKnownFileObserve) => {
            execute_known_file_host_terminal_observation(
                &mut std::io::stdin(),
                &mut std::io::stdout(),
            )
        }
        Ok(InvocationMode::HostTerminalObserve) => {
            execute_host_terminal_observation(&mut std::io::stdin(), &mut std::io::stdout())
        }
        Ok(InvocationMode::HostTerminalSave) => {
            execute_host_terminal_save(&mut std::io::stdin(), &mut std::io::stdout())
        }
        Ok(InvocationMode::HostTerminalRead) => {
            execute_host_terminal_read(&mut std::io::stdin(), &mut std::io::stdout())
        }
        Ok(InvocationMode::HostTerminalKnownFileSave) => {
            execute_known_file_host_terminal_save(&mut std::io::stdin(), &mut std::io::stdout())
        }
        Ok(InvocationMode::HostTerminalKnownFileRead) => {
            execute_known_file_host_terminal_read(&mut std::io::stdin(), &mut std::io::stdout())
        }
        Err(()) => {
            let _ = write_response_to(&mut std::io::stdout(), invalid_response());
            2
        }
    };
    if exit_code != 0 {
        std::process::exit(exit_code);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// accepts_only_fixed_local_appcontainer_pipe_namesを検証する。
    ///
    /// @responsibility accepts_only_fixed_local_appcontainer_pipe_namesの合否判定を所有する。
    /// @trace PRL-UT-014
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus accepts_only_fixed_local_appcontainer_pipe_namesの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
    #[test]
    fn accepts_only_fixed_local_appcontainer_pipe_names() {
        assert!(valid_appcontainer_pipe_name(
            r"\\.\pipe\CRDD.Coordinator.1234"
        ));
        for value in [
            r"\\.\pipe\LOCAL\CRDD.Coordinator.1234",
            r"\\.\pipe\CRDD.Coordinator.",
            r"\\.\pipe\CRDD.Coordinator.0",
            r"\\.\pipe\CRDD.Coordinator.0123",
            r"\\.\pipe\CRDD.Coordinator.1234.extra",
            r"\\.\pipe\Other.1234",
        ] {
            assert!(!valid_appcontainer_pipe_name(value));
        }
    }
}
