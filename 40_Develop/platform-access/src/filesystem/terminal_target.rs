//! 固定Namespace内の終端対象を読取り・再照合し、取得handleを明示終了する。
//!
//! @responsibility 十一／十二実体の対象観測、部分取得、元失敗と逆順終了を所有し、Namespace初期化・記録保存・回収Authorityを所有しない。
//! @trace ARCH-000011

use crate::filesystem::host_namespace::{
    CAPACITY_SETTLEMENT_UNKNOWN, TerminalDirectory, terminal_identity_fields,
    validate_terminal_target_names,
};
use crate::filesystem::protected_file::{
    MAX_HOST_MARKER_OBSERVATION_BYTES, close_terminal_handle, open_terminal_handle,
    read_terminal_bounded_bytes, terminal_identity,
};
use crate::filesystem::protection::{
    DirectoryIdentity, OwnedHandle, directory_identity, root_information, sha256,
};
use crate::protocol::host_record::KNOWN_FIXTURE_SHA256;
use windows_sys::Win32::Storage::FileSystem::{
    BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY, FILE_ATTRIBUTE_REPARSE_POINT,
    FILE_GENERIC_READ, FILE_READ_ATTRIBUTES, FILE_SHARE_READ, FILE_TYPE_DISK, GetFileSizeEx,
    GetFileType, READ_CONTROL,
};

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
