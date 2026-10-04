//! Host対象観測の用途限定binary搬送を定義する。
//!
//! @responsibility 名前・独立namespace期待値・現在Snapshot・初回close結果を閉形式で搬送する。
//! @trace ARCH-000008
//! @trace ARCH-000011

pub(crate) const MAX_CHAIN_HANDLES: usize = 64;
pub(crate) const MAX_RESPONSE_BYTES: usize = 1024;
pub(crate) const MAX_SAVE_REQUEST_BYTES: usize = 8841;
pub(crate) const MAX_KNOWN_FILE_RECORD_REQUEST_BYTES: usize = 8847;
pub(crate) const MAX_SAVE_RESPONSE_BYTES: usize = 2048;
pub(crate) const SAVE_RECEIPT_BYTES: usize = 52;
const REQUEST_HEADER_BYTES: usize = 148;
const RESPONSE_HEADER_BYTES: usize = 53;
pub(crate) const KNOWN_FIXTURE_SHA256: [u8; 32] = [
    0xbe, 0x93, 0x51, 0x74, 0x1a, 0x81, 0x55, 0xd0, 0x1f, 0xd0, 0x28, 0xd1, 0x58, 0x54, 0x6f, 0x10,
    0x05, 0xe7, 0x3c, 0xee, 0xb0, 0xbb, 0x2d, 0x09, 0x33, 0x35, 0xfe, 0xac, 0x41, 0x44, 0xe4, 0x50,
];

/// 観測frameの二クラスを内部で区別する。
///
/// @responsibility 旧十一実体と既知file十二実体の上限・magicを固定する。
/// @trace ARCH-000011
/// @shape ElevenまたはKnownFileの閉集合。
/// @invariant 外部から任意の上限・magicを指定させない。
/// @boundary 内部parser／encoderだけ。
/// @security Authorityや自由Pathを含めない。
/// @compatibility 旧revision 2と候補revision 3を相互変換しない。
#[derive(Clone, Copy)]
enum ObservationClass {
    Eleven,
    KnownFile,
}

/// 固定対象観測の要求を保持する。
///
/// @responsibility 固定観測Protocolの値と相関を保持する。
/// @trace ARCH-000011
/// @shape nonce、Root/marker単純名、Known時だけ三実体の六u32と選択利用者Hash。
/// @invariant 現在観測とAuthority、未取得と終了不明を区別する。
/// @boundary Coordinatorの用途限定Adapter→Native Worker。
/// @security 自由Path、SID、marker本文、清掃許可を含めない。
/// @compatibility CRDDHC01 revision 1とCRDDHT02 revision 2、応答はCRDDHR02 revision 2。既存Root Protocolへ混ぜない。
#[derive(Clone, Debug)]
pub(crate) struct TerminalRequest {
    pub nonce: [u8; 32],
    pub root_name: String,
    pub marker_name: String,
    pub namespace: Option<[[u32; 6]; 3]>,
    pub selected_user: Option<[u8; 32]>,
}

/// 現在の十一実体を搬送する。
///
/// @responsibility 固定観測Protocolの値と相関を保持する。
/// @trace ARCH-000011
/// @shape 十一位置の六u32、選択利用者Hash、元marker bytes Hash。
/// @invariant 現在観測とAuthority、未取得と終了不明を区別する。
/// @boundary Coordinatorの用途限定Adapter→Native Worker。
/// @security 自由Path、SID、marker本文、清掃許可を含めない。
/// @compatibility CRDDHT02/CRDDHR02のrevision 2専用。既存Root Protocolへ混ぜない。
#[derive(Clone, Debug)]
pub(crate) struct TerminalSnapshot {
    pub identities: [[u32; 6]; 11],
    pub selected_user: [u8; 32],
    pub marker_sha256: [u8; 32],
}

/// 既知fileを含む専用要求を旧入口から分離する。
///
/// @responsibility namespaceだけのKnown期待値と新しい対象クラスを保持する。
/// @trace ARCH-000011
/// @shape 固定名、nonce、任意の三namespace実体と利用者Hash。
/// @invariant namespace-Knownを十二対象全体のKnownへ昇格しない。
/// @boundary 専用revision 3要求→Native観測。
/// @security 観測要求を清掃Authorityにしない。
/// @compatibility CRDDKC03／CRDDKT03専用。旧要求への暗黙変換はない。
#[derive(Clone, Debug)]
pub(crate) struct KnownFileTerminalRequest {
    pub target: TerminalRequest,
}

/// 既知fileを落とさず十二実体として搬送する。
///
/// @responsibility fileのIdentity・長さ・リンク数・全bytes Hashを同じ観測へ結合する。
/// @trace ARCH-000011
/// @shape 十二位置の六u32、利用者／marker Hash、file長／リンク数／Hash。
/// @invariant file位置11は通常file、固定7bytes・リンク数1・固定Hash。
/// @boundary 専用Native観測→Coordinator。
/// @security 本文、SID、自由Path、非使用認定または処置許可を含めない。
/// @compatibility CRDDKR03 revision 3だけ。十一実体へ縮約しない。
#[derive(Clone, Debug)]
pub(crate) struct KnownFileTerminalSnapshot {
    pub identities: [[u32; 6]; 12],
    pub selected_user: [u8; 32],
    pub marker_sha256: [u8; 32],
    pub file_byte_length: u32,
    pub file_link_count: u32,
    pub file_sha256: [u8; 32],
}

/// 初回結果と取得・終了を共同保持する。
///
/// @responsibility 固定観測Protocolの値と相関を保持する。
/// @trace ARCH-000011
/// @shape nonce、Snapshotまたは失敗、元phase/reason、位置、三資源集合の取得数とclose列。
/// @invariant 現在観測とAuthority、未取得と終了不明を区別する。
/// @boundary Coordinatorの用途限定Adapter→Native Worker。
/// @security 自由Path、SID、marker本文、清掃許可を含めない。
/// @compatibility 十一実体はCRDDHR02 revision 2、十二実体はCRDDKR03 revision 3として別encoderへ渡す。既存Root Protocolへ混ぜない。
#[derive(Clone, Debug)]
pub(crate) struct TerminalResponse<S = TerminalSnapshot> {
    pub nonce: [u8; 32],
    pub snapshot: Option<S>,
    pub phase: u8,
    pub reason: &'static str,
    pub operation_reason: Option<&'static str>,
    pub position: Option<usize>,
    pub target_acquired: usize,
    pub tokens_acquired: usize,
    pub directories_acquired: usize,
    pub token_closes: Vec<bool>,
    pub directory_closes: Vec<bool>,
    pub target_closes: Vec<bool>,
}

/// 同じcaller記録と専用クラスの全対象へ結合した保存要求を保持する。
///
/// @responsibility 保存場所だけでなく対象全体のKnown期待値を記録Effect前へ渡す。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @shape nonce、既知参照、固定名、十一または十二実体の専用Known型、完全bytesとHash。
/// @invariant bytesのSchema・caller耐久性はNode Ownerが確認し、Nativeは推測補完しない。
/// @boundary Coordinatorの専用保存Adapter→固定Native。
/// @security 自由Path、SID、元Tokenまたは削除許可を含めない。
/// @compatibility 旧CRDDHS01／CRDDHL01は十一型、新CRDDKS03／CRDDKL03は十二型。相互縮約と観測要求への混用はない。
#[derive(Clone, Debug)]
pub(crate) struct TerminalSaveRequest<S = TerminalSnapshot> {
    pub nonce: [u8; 32],
    pub reference: String,
    pub root_name: String,
    pub marker_name: String,
    pub known: S,
    pub bytes_sha256: [u8; 32],
    pub bytes: Vec<u8>,
}

/// 同参照の現在記録を読戻した結果を保持する。
///
/// @responsibility 記録観測、今回reader終了と外側終了を別に保持する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @shape 参照、観測成立、現在state/Identity、取得/close、元理由と外側観測。
/// @invariant 現在記録の存在を過去成功・対象存在・非使用または清掃権限にしない。
/// @boundary Native専用読取り→Coordinator。
/// @security 本文・Path・SID・旧Tokenを返さない。
/// @compatibility 十一型はCRDDHB01 revision 2、十二型はCRDDKB03 revision 3。state 0=不明、1=Prepared、2=Published。旧応答を新型へ補完しない。
pub(crate) struct TerminalReadResponse<S = TerminalSnapshot> {
    pub reference: Option<String>,
    pub observed: bool,
    pub state: u8,
    pub reason: &'static str,
    pub operation_reason: Option<&'static str>,
    pub record_identity: Option<[u32; 6]>,
    pub open_issued: bool,
    pub opened: bool,
    pub reader_close: Option<bool>,
    pub generation_acquired: bool,
    pub generation_close: Option<bool>,
    pub observation: TerminalResponse<S>,
}

/// 保存の部分結果と対象・外側資源の終了を共同搬送する。
///
/// @responsibility 公開後の終了不明でも同参照・保存receipt・元理由を失わない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @shape nonce、参照、保存共同成立、五固定理由、観測応答と52bytesの部分receipt。
/// @invariant 保存成功は清掃成功・非使用・Authorityを意味しない。
/// @boundary 固定Native→Coordinatorの用途限定保存Adapter。
/// @security Path、SID、記録本文、秘密または処置Authorityを返さない。
/// @compatibility 十一型はCRDDHW01 revision 1、十二型はCRDDKW03 revision 3。未知・未試行はreceipt欠落またはoption値で区別する。
pub(crate) struct TerminalSaveResponse<S = TerminalSnapshot> {
    pub reference: Option<String>,
    pub saved: bool,
    pub reasons: [&'static str; 5],
    pub observation: TerminalResponse<S>,
    pub receipt: Option<[u8; SAVE_RECEIPT_BYTES]>,
}

/// 保存参照をPath成分なしのUUIDv4へ限定する。
///
/// @responsibility 同じ非Authority参照から固定二leafだけを導出可能にする。
/// @trace ARCH-000008
/// @input 未検証の参照文字列。
/// @returns lowercase UUIDv4の固定参照ならtrue。
/// @precondition N/A: 値検査だけ。
/// @postcondition 参照の新規発行や書換えをしない。
/// @effect N/A: bytes検査のみ。
/// @failure 形式・長さ・version・variant不正はfalse。
/// @invariant 名前から由来、非使用またはAuthorityを推定しない。
/// @boundary 専用保存要求→Native固定leaf名。
/// @security traversal・引用符・自由suffixを拒否する。
/// @concurrency N/A: 不変borrowの純検査。
pub(crate) fn valid_reference(value: &str) -> bool {
    value.strip_prefix("host-terminal.").is_some_and(|uuid| {
        let uuid = uuid.as_bytes();
        uuid.len() == 36
            && uuid[14] == b'4'
            && b"89ab".contains(&uuid[19])
            && uuid.iter().enumerate().all(|(index, byte)| {
                if [8, 13, 18, 23].contains(&index) {
                    *byte == b'-'
                } else {
                    byte.is_ascii_digit() || (b'a'..=b'f').contains(byte)
                }
            })
    })
}

/// 保存要求の全期待値と完全bytesを余剰なしで解析する。
///
/// @responsibility Shape・名前・上限・全十一型と相異を資源取得前に検査する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 最大8841bytesのCRDDHS01要求。
/// @returns 閉じた保存要求、またはNone。
/// @precondition bytes Hashの実照合は後続が保存場所取得前に行う。
/// @postcondition 欠落・未知形式・自由Pathを拒否し、Knownを保持する。
/// @effect N/A: 所有memoryの解析のみ。
/// @failure 長さ、revision、nonce、参照、型、重複またはゼロHash不正はNone。
/// @invariant opaque本文をNativeでAI解釈・補完しない。
/// @boundary 専用stdin→用途限定保存処理。
/// @security 要求から清掃Authority、旧Task Tokenまたはnamespace修復許可を作らない。
/// @concurrency N/A: 一要求の同期解析。
pub(crate) fn parse_save_request(bytes: &[u8]) -> Option<TerminalSaveRequest> {
    parse_record_request(bytes, b"CRDDHS01")
}

/// 読取り専用要求を保存要求と同じ閉形状へ解析する。
///
/// @responsibility 異なるmodeの要求を誤って保存へ渡さない。
/// @trace ARCH-000008
/// @input 最大8841bytesのCRDDHL01要求。
/// @returns 同参照・独立完全bytes・Known値、またはNone。
/// @precondition 保存との区別は専用dispatchとmagicで固定する。
/// @postcondition 全入力検査を保存parserと共通化するが記録Effectを発行しない。
/// @effect N/A: 所有memoryの解析のみ。
/// @failure 不正形状、Hash、名前、余剰bytesはNone。
/// @invariant KnownのRoot等は記録内容の結合値であり、この読取りで再観測しない。
/// @boundary 読取り専用stdin→Native。
/// @security Authorityや自由Pathを受理しない。
/// @concurrency N/A: 一要求の純解析。
pub(crate) fn parse_read_request(bytes: &[u8]) -> Option<TerminalSaveRequest> {
    parse_record_request(bytes, b"CRDDHL01")
}

/// 十二実体を保持した専用保存要求を解析する。
///
/// @responsibility fileの期待値を旧十一実体へ縮約せず受理する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 最大8847bytesのCRDDKS03 revision 3要求。
/// @returns 十二実体の固定要求、またはNone。
/// @precondition 本文Schemaとcaller耐久性はCoordinatorが確認する。
/// @postcondition 不正field・旧frame・読取りframeを取得前に拒否する。
/// @effect N/A: memory解析のみ。
/// @failure 名前・型・相異・固定file値・上限不正はNone。
/// @invariant 解析成功は保存・非使用・Authorityを意味しない。
/// @boundary 専用stdin→Native保存Owner。
/// @security 自由Pathや旧Tokenを受付けない。
/// @concurrency N/A: 不変bytesの同期検査。
pub(crate) fn parse_known_file_save_request(
    bytes: &[u8],
) -> Option<TerminalSaveRequest<KnownFileTerminalSnapshot>> {
    parse_known_file_record_request(bytes, b"CRDDKS03")
}

/// 十二実体の独立本文を同参照の読戻しへ結合する。
///
/// @responsibility 保存frameを読取りframeへ暗黙変換しない。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 最大8847bytesのCRDDKL03 revision 3要求。
/// @returns 十二実体の読取り要求、またはNone。
/// @precondition 本文SchemaはCoordinatorが確認済みである。
/// @postcondition Root／file存在を解析の前提にしない。
/// @effect N/A: 純解析だけ。
/// @failure 混用・欠落・未知値はNone。
/// @invariant Known値を対象の現在観測へ読み替えない。
/// @boundary 専用stdin→現在記録Reader。
/// @security 記録変更・清掃Authorityを発行しない。
/// @concurrency N/A: 不変bytesだけ。
pub(crate) fn parse_known_file_read_request(
    bytes: &[u8],
) -> Option<TerminalSaveRequest<KnownFileTerminalSnapshot>> {
    parse_known_file_record_request(bytes, b"CRDDKL03")
}

/// 専用記録の十二期待値と独立本文を閉形状で保持する。
///
/// @responsibility 九対象handleに対応する十二Identityと固定file条件を検査する。
/// @trace ARCH-000011
/// @input 完全frameと内部の保存／読取りmagic。
/// @returns 専用型の要求、またはNone。
/// @precondition magicは二つの固定literalだけ。
/// @postcondition 旧型への変換なしで全値を保持する。
/// @effect N/A: memoryのみ。
/// @failure 長さ・nonce・名前・相異・型・ゼロHash・file値不正はNone。
/// @invariant 本文Hashの実照合はOS Effect前のNative Ownerが行う。
/// @boundary bounded frame→同期記録Owner。
/// @security UUIDv4 Rootと固定marker名だけ受理する。
/// @concurrency N/A: 一要求の純検査。
fn parse_known_file_record_request(
    bytes: &[u8],
    magic: &[u8; 8],
) -> Option<TerminalSaveRequest<KnownFileTerminalSnapshot>> {
    const HEADER: usize = 471;
    if bytes.len() < HEADER
        || bytes.len() > MAX_KNOWN_FILE_RECORD_REQUEST_BYTES
        || bytes.get(..8)? != magic
        || bytes.get(8..10)? != 3_u16.to_le_bytes()
    {
        return None;
    }
    let nonce = bytes.get(10..42)?.try_into().ok()?;
    let reference_len = usize::from(bytes[42]);
    let root_len = usize::from(bytes[43]);
    let marker_len = usize::from(bytes[44]);
    let body_len = usize::from(u16::from_le_bytes(bytes.get(45..47)?.try_into().ok()?));
    if nonce == [0; 32]
        || !(1..=8192).contains(&body_len)
        || bytes.len() != HEADER + reference_len + root_len + marker_len + body_len
    {
        return None;
    }
    let mut identities = [[0_u32; 6]; 12];
    for (index, identity) in identities.iter_mut().enumerate() {
        for (field, value) in identity.iter_mut().enumerate() {
            let offset = 47 + index * 24 + field * 4;
            *value = u32::from_le_bytes(bytes.get(offset..offset + 4)?.try_into().ok()?);
        }
    }
    validate_snapshot_identities(&identities, &[4, 11])?;
    let selected_user = bytes.get(335..367)?.try_into().ok()?;
    let marker_sha256 = bytes.get(367..399)?.try_into().ok()?;
    let file_byte_length = u32::from_le_bytes(bytes.get(399..403)?.try_into().ok()?);
    let file_link_count = u32::from_le_bytes(bytes.get(403..407)?.try_into().ok()?);
    let file_sha256 = bytes.get(407..439)?.try_into().ok()?;
    let bytes_sha256 = bytes.get(439..471)?.try_into().ok()?;
    if selected_user == [0; 32]
        || marker_sha256 == [0; 32]
        || bytes_sha256 == [0; 32]
        || file_byte_length != 7
        || file_link_count != 1
        || file_sha256 != KNOWN_FIXTURE_SHA256
    {
        return None;
    }
    let reference_end = HEADER + reference_len;
    let root_end = reference_end + root_len;
    let marker_end = root_end + marker_len;
    let reference = std::str::from_utf8(bytes.get(HEADER..reference_end)?).ok()?;
    let root_name = std::str::from_utf8(bytes.get(reference_end..root_end)?).ok()?;
    let marker_name = std::str::from_utf8(bytes.get(root_end..marker_end)?).ok()?;
    let uuid = root_name.strip_prefix("crdd-coordinator-doctor-")?;
    if !valid_reference(reference)
        || !valid_reference(&format!("host-terminal.{uuid}"))
        || !valid_target_names(root_name, marker_name)
    {
        return None;
    }
    Some(TerminalSaveRequest {
        nonce,
        reference: reference.to_owned(),
        root_name: root_name.to_owned(),
        marker_name: marker_name.to_owned(),
        known: KnownFileTerminalSnapshot {
            identities,
            selected_user,
            marker_sha256,
            file_byte_length,
            file_link_count,
            file_sha256,
        },
        bytes_sha256,
        bytes: bytes.get(marker_end..)?.to_vec(),
    })
}

/// 専用記録要求の共通形状だけを解析する。
///
/// @responsibility 保存と読戻しの入力検査を同じbounded規則へ閉じる。
/// @trace ARCH-000008
/// @input 完全bytesとdispatch固有magic。
/// @returns 固定record要求またはNone。
/// @precondition magicは内部の二固定literalだけ。
/// @postcondition 未知field・差替え・不正Identityを拒否する。
/// @effect N/A: memoryのみ。
/// @failure 長さ、名前、型、Hash不正はNone。
/// @invariant 解析から記録作成・削除を発行しない。
/// @boundary 専用frame→内部値。
/// @security 任意Pathや旧Task Authorityを生成しない。
/// @concurrency N/A: 不変borrowのみ。
fn parse_record_request(bytes: &[u8], magic: &[u8; 8]) -> Option<TerminalSaveRequest> {
    const HEADER: usize = 407;
    if bytes.len() < HEADER
        || bytes.len() > MAX_SAVE_REQUEST_BYTES
        || bytes.get(..8)? != magic
        || bytes.get(8..10)? != 1_u16.to_le_bytes()
    {
        return None;
    }
    let nonce = bytes.get(10..42)?.try_into().ok()?;
    let reference_len = usize::from(bytes[42]);
    let root_len = usize::from(bytes[43]);
    let marker_len = usize::from(bytes[44]);
    let body_len = usize::from(u16::from_le_bytes(bytes.get(45..47)?.try_into().ok()?));
    if nonce == [0; 32]
        || !(1..=8192).contains(&body_len)
        || bytes.len() != HEADER + reference_len + root_len + marker_len + body_len
    {
        return None;
    }
    let mut identities = [[0_u32; 6]; 11];
    for (index, identity) in identities.iter_mut().enumerate() {
        for (field, value) in identity.iter_mut().enumerate() {
            let offset = 47 + index * 24 + field * 4;
            *value = u32::from_le_bytes(bytes.get(offset..offset + 4)?.try_into().ok()?);
        }
    }
    for (index, identity) in identities.iter().enumerate() {
        if identity[5] & 0x400 != 0
            || (identity[5] & 0x10 != 0) != (index != 4)
            || identities[..index]
                .iter()
                .any(|other| identity[..3] == other[..3])
        {
            return None;
        }
    }
    let selected_user = bytes.get(311..343)?.try_into().ok()?;
    let marker_sha256 = bytes.get(343..375)?.try_into().ok()?;
    let bytes_sha256 = bytes.get(375..407)?.try_into().ok()?;
    if selected_user == [0; 32] || marker_sha256 == [0; 32] || bytes_sha256 == [0; 32] {
        return None;
    }
    let reference_end = HEADER + reference_len;
    let root_end = reference_end + root_len;
    let marker_end = root_end + marker_len;
    let reference = std::str::from_utf8(bytes.get(HEADER..reference_end)?).ok()?;
    let root_name = std::str::from_utf8(bytes.get(reference_end..root_end)?).ok()?;
    let marker_name = std::str::from_utf8(bytes.get(root_end..marker_end)?).ok()?;
    if !valid_reference(reference) || !valid_target_names(root_name, marker_name) {
        return None;
    }
    Some(TerminalSaveRequest {
        nonce,
        reference: reference.to_owned(),
        root_name: root_name.to_owned(),
        marker_name: marker_name.to_owned(),
        known: TerminalSnapshot {
            identities,
            selected_user,
            marker_sha256,
        },
        bytes_sha256,
        bytes: bytes.get(marker_end..)?.to_vec(),
    })
}

/// 専用保存結果を切詰めない固定上限frameへ変換する。
///
/// @responsibility 同参照、全観測終了と保存の部分receiptを一つの返却に保持する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 閉じた理由、観測結果と既定長receipt。
/// @returns 最大2048bytesの完全応答、またはNone。
/// @precondition 保存と外側guard終了を全て試行済みである。
/// @postcondition 上限内で全fieldを保持し、過大値を切り捨てない。
/// @effect N/A: 所有値のencodeのみ。
/// @failure 不正参照・理由・観測形状または成功相関差を拒否する。
/// @invariant 保存後の応答失敗は上位がEffect不明として扱う。
/// @boundary Native保存Owner→専用stdout。
/// @security 固定理由・参照・bool/数値だけで、本文・Path・SIDは含めない。
/// @concurrency N/A: 終端後の同期構築。
pub(crate) fn encode_save_response(response: &TerminalSaveResponse) -> Option<Vec<u8>> {
    encode_record_save_response(response, b"CRDDHW01", 1, encode_response)
}

/// 十二実体の保存結果を専用frameへ保持する。
///
/// @responsibility 同参照・九handle観測・部分receiptを共同搬送する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 十二実体の保存終端結果。
/// @returns 最大2048bytesのCRDDKW03 revision 3、またはNone。
/// @precondition 保存と全guard終了を試行済みである。
/// @postcondition CRDDKR03を内包し旧十一実体へ縮約しない。
/// @effect N/A: memory encodeのみ。
/// @failure 成功相関・理由・参照・観測形状不正はNone。
/// @invariant 部分receiptを保存共同成立へ補完しない。
/// @boundary 専用Native保存結果→Coordinator。
/// @security 本文・Path・SID・清掃許可を出さない。
/// @concurrency N/A: 終端値の純変換。
pub(crate) fn encode_known_file_save_response(
    response: &TerminalSaveResponse<KnownFileTerminalSnapshot>,
) -> Option<Vec<u8>> {
    encode_record_save_response(response, b"CRDDKW03", 3, encode_known_file_response)
}

/// 二記録クラスの保存相関を同じ規則へ閉じる。
///
/// @responsibility 共通receipt検査とクラス固有観測encoderを結合する。
/// @trace ARCH-000008
/// @input 型付き保存結果と内部固定magic／revision／encoder。
/// @returns 完全frame、またはNone。
/// @precondition 外部から搬送クラスを選択させない。
/// @postcondition 元理由・参照・receiptを欠落させない。
/// @effect N/A: memory encodeだけ。
/// @failure 不正相関または過大frameはNone。
/// @invariant 保存Effect不明をEffect 0へ変更しない。
/// @boundary 私有frame構築。
/// @security 自由Path・本文・Authorityを返さない。
/// @concurrency N/A: 不変borrowのみ。
fn encode_record_save_response<S>(
    response: &TerminalSaveResponse<S>,
    magic: &[u8; 8],
    revision: u16,
    encode_observation: fn(&TerminalResponse<S>) -> Option<Vec<u8>>,
) -> Option<Vec<u8>> {
    let reference = response.reference.as_deref().unwrap_or("");
    if (!reference.is_empty() && !valid_reference(reference))
        || response.reasons[0].is_empty()
        || response.reasons.iter().any(|reason| {
            reason.len() > 96
                || (!reason.is_empty() && !reason.starts_with("terminal_"))
                || !reason
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
        })
        || (response.saved
            && (reference.is_empty()
                || response.receipt.is_none()
                || response.observation.snapshot.is_none()
                || response.reasons[0] != "terminal_record_saved"))
    {
        return None;
    }
    let observation = encode_observation(&response.observation)?;
    let mut bytes = Vec::with_capacity(MAX_SAVE_RESPONSE_BYTES);
    bytes.extend_from_slice(magic);
    bytes.extend_from_slice(&revision.to_le_bytes());
    bytes.extend_from_slice(&response.observation.nonce);
    bytes.push(u8::from(response.saved));
    bytes.push(reference.len() as u8);
    for reason in response.reasons {
        bytes.push(reason.len() as u8);
    }
    bytes.extend_from_slice(&(observation.len() as u16).to_le_bytes());
    bytes.push(u8::from(response.receipt.is_some()));
    bytes.extend_from_slice(reference.as_bytes());
    for reason in response.reasons {
        bytes.extend_from_slice(reason.as_bytes());
    }
    bytes.extend_from_slice(&observation);
    if let Some(receipt) = response.receipt {
        bytes.extend_from_slice(&receipt);
    }
    if bytes.len() > MAX_SAVE_RESPONSE_BYTES {
        return None;
    }
    Some(bytes)
}

/// 現在記録の読戻しを部分結果ごと切詰めず搬送する。
///
/// @responsibility 取得・現在Identity・個別closeと外側終了を同参照へ結合する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 固定理由、今回記録結果と外側receipt。
/// @returns 最大2048bytesのCRDDHB01完全frame、またはNone。
/// @precondition reader・namespace・token終了を試行済み。
/// @postcondition 未観測値を成功や不存在へ変換しない。
/// @effect N/A: memory encodeのみ。
/// @failure 不正参照・理由・stateまたは成功相関を拒否する。
/// @invariant Root/marker取得なしをRoot/marker不存在の主張にしない。
/// @boundary Native読取りOwner→専用stdout。
/// @security 本文、Path、SID、Authorityを含めない。
/// @concurrency N/A: 終端結果の同期encode。
pub(crate) fn encode_read_response(response: &TerminalReadResponse) -> Option<Vec<u8>> {
    encode_record_read_response(response, b"CRDDHB01", 2, encode_response)
}

/// 十二実体に結合した現在記録の読戻し結果を搬送する。
///
/// @responsibility 対象未試行と今回Reader／世代排他終了を別々に保持する。
/// @trace ARCH-000008
/// @trace ARCH-000011
/// @input 十二実体用読戻し結果。
/// @returns 最大2048bytesのCRDDKB03 revision 3、またはNone。
/// @precondition 記録・外側guard・世代排他の終了を試行済みである。
/// @postcondition 対象消失後も現在記録を搬送でき、旧frameを生成しない。
/// @effect N/A: memory encodeだけ。
/// @failure 相関・名前・状態・終了情報不正はNone。
/// @invariant 取得0を対象不存在・非使用へ読み替えない。
/// @boundary Native現在Reader→Coordinator。
/// @security 本文・Path・SID・清掃Authorityを返さない。
/// @concurrency N/A: 終端値の純変換。
pub(crate) fn encode_known_file_read_response(
    response: &TerminalReadResponse<KnownFileTerminalSnapshot>,
) -> Option<Vec<u8>> {
    if response.observation.snapshot.is_some()
        || response.observation.target_acquired != 0
        || !response.observation.target_closes.is_empty()
    {
        return None;
    }
    encode_record_read_response(response, b"CRDDKB03", 3, encode_known_file_response)
}

/// 二クラスの読戻し相関を共通検査する。
///
/// @responsibility 観測成功と今回資源終了の共同条件を維持する。
/// @trace ARCH-000008
/// @input 型付き結果と内部固定frame構成。
/// @returns 完全frame、またはNone。
/// @precondition クラスごとの専用wrapperだけが呼び出す。
/// @postcondition 未観測・部分取得・終了不明を保存する。
/// @effect N/A: memory encodeのみ。
/// @failure 成功相関・理由・上限不正を拒否する。
/// @invariant reader成功を過去保存成功や清掃成功へ昇格しない。
/// @boundary 私有読戻しframe構築。
/// @security 本文・Path・Authorityなし。
/// @concurrency N/A: 不変borrowだけ。
fn encode_record_read_response<S>(
    response: &TerminalReadResponse<S>,
    magic: &[u8; 8],
    revision: u16,
    encode_observation: fn(&TerminalResponse<S>) -> Option<Vec<u8>>,
) -> Option<Vec<u8>> {
    let reference = response.reference.as_deref().unwrap_or("");
    let operation_reason = response.operation_reason.unwrap_or("");
    if (!reference.is_empty() && !valid_reference(reference))
        || response.reason.is_empty()
        || response.state > 2
        || [response.reason, operation_reason].iter().any(|reason| {
            reason.len() > 96
                || (!reason.is_empty() && !reason.starts_with("terminal_"))
                || !reason
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
        })
        || (response.opened && !response.open_issued)
        || (response.record_identity.is_some() && !response.opened)
        || (!response.generation_acquired && response.generation_close.is_some())
        || (!response.generation_acquired && response.open_issued)
        || (response.observed
            && (reference.is_empty()
                || response.state == 0
                || response.record_identity.is_none()
                || !response.opened
                || response.reader_close != Some(true)
                || !response.generation_acquired
                || response.generation_close != Some(true)
                || response.reason != "terminal_record_observed"))
    {
        return None;
    }
    let observation = encode_observation(&response.observation)?;
    let mut bytes = Vec::with_capacity(MAX_SAVE_RESPONSE_BYTES);
    bytes.extend_from_slice(magic);
    bytes.extend_from_slice(&revision.to_le_bytes());
    bytes.extend_from_slice(&response.observation.nonce);
    bytes.extend_from_slice(&[
        u8::from(response.observed),
        response.state,
        reference.len() as u8,
        response.reason.len() as u8,
        operation_reason.len() as u8,
    ]);
    bytes.extend_from_slice(&(observation.len() as u16).to_le_bytes());
    bytes.extend_from_slice(&[
        u8::from(response.record_identity.is_some()),
        u8::from(response.open_issued),
        u8::from(response.opened),
        response.reader_close.map(u8::from).unwrap_or(2),
        u8::from(response.generation_acquired),
        response.generation_close.map(u8::from).unwrap_or(2),
    ]);
    bytes.extend_from_slice(reference.as_bytes());
    bytes.extend_from_slice(response.reason.as_bytes());
    bytes.extend_from_slice(operation_reason.as_bytes());
    bytes.extend_from_slice(&observation);
    if let Some(identity) = response.record_identity {
        for value in identity {
            bytes.extend_from_slice(&value.to_le_bytes());
        }
    }
    (bytes.len() <= MAX_SAVE_RESPONSE_BYTES).then_some(bytes)
}

/// Root/markerの固定単純名を確認する。
///
/// @responsibility Pathと自由suffixを取得前に拒否する。
/// @trace ARCH-000011
/// @input Root/marker名。
/// @returns 固定名形に適合するか。
/// @precondition N/A: 未検証文字列を受け取る。
/// @postcondition ASCIIの固定名だけ受理する。
/// @effect N/A: 値検査のみ。
/// @failure 長さ、prefix、文字種、Path指定はfalse。
/// @invariant 名前から由来・非使用を推定しない。
/// @boundary 閉要求→Native対象名。
/// @security 自由Path、traversal、環境値を受け付けない。
/// @concurrency N/A: 不変borrowの純検査。
pub(crate) fn valid_target_names(root: &str, marker: &str) -> bool {
    let root_valid = root
        .strip_prefix("crdd-coordinator-doctor-")
        .is_some_and(|suffix| {
            (1..=96).contains(&suffix.len())
                && suffix
                    .bytes()
                    .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
        });
    let marker_valid = marker
        .strip_prefix("host-")
        .and_then(|v| v.strip_suffix(".json"))
        .is_some_and(|hash| {
            hash.len() == 64
                && hash
                    .bytes()
                    .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
        });
    root_valid && marker_valid
}

/// 専用要求を余分bytesなしで解析する。
///
/// @responsibility 全fieldと名前をOS取得前に検証する。
/// @trace ARCH-000011
/// @input 最大342bytesの完全要求。
/// @returns 閉じた要求、またはNone。
/// @precondition 標準/Provider Home modeでは呼び出さない。
/// @postcondition nonce・固定名と、Known時だけ三独立実体・選択利用者を保持する。
/// @effect N/A: memory解析のみ。
/// @failure magic、revision、長さ、UTF-8、型・相異・Hash不正を拒否する。
/// @invariant 現在値やゼロで期待値を補完しない。
/// @boundary 用途限定stdin→Native要求。
/// @security nonceは相関用でありRecovery Authorityではない。
/// @concurrency N/A: 所有byte列の同期解析。
pub(crate) fn parse_request(bytes: &[u8]) -> Option<TerminalRequest> {
    parse_observation_request(bytes, ObservationClass::Eleven)
}

/// 十二実体専用要求を旧frameとの混用なしで解析する。
///
/// @responsibility 固定fileクラスと三namespaceだけの独立期待値を保持する。
/// @trace ARCH-000011
/// @input 最大342bytesの候補revision 3要求。
/// @returns 専用要求、またはNone。
/// @precondition 専用観測dispatchだけが使用する。
/// @postcondition 欠落、余剰、旧magic／revisionを取得前に拒否する。
/// @effect N/A: 所有bytesの純解析。
/// @failure 共通形状・固定名・相異・利用者Hash不正はNone。
/// @invariant namespace期待値を全十二対象の既知値へ補完しない。
/// @boundary 専用stdin→私有要求context。
/// @security Authority、自由Path、file本文を受理しない。
/// @concurrency N/A: 一要求の同期解析。
pub(crate) fn parse_known_file_request(bytes: &[u8]) -> Option<KnownFileTerminalRequest> {
    parse_observation_request(bytes, ObservationClass::KnownFile)
        .map(|target| KnownFileTerminalRequest { target })
}

/// 二クラスだけの観測header検査を共通化する。
///
/// @responsibility クラス固有magic／revisionを保持して共通fieldを検証する。
/// @trace ARCH-000011
/// @input bounded bytesと内部閉集合のクラス。
/// @returns 共通要求値、またはNone。
/// @precondition クラスは内部の二固定値だけである。
/// @postcondition 同じ名前・nonce・namespace検査を維持する。
/// @effect N/A: memory解析のみ。
/// @failure 他クラス・不正形状・相異違反はNone。
/// @invariant 相互変換や期待値の捏造をしない。
/// @boundary 私有parserの内部共通処理。
/// @security magic、上限、対象名を外部から変更させない。
/// @concurrency N/A: 不変borrowのみ。
fn parse_observation_request(bytes: &[u8], class: ObservationClass) -> Option<TerminalRequest> {
    let (current_magic, known_magic, current_revision, known_revision) = match class {
        ObservationClass::Eleven => (b"CRDDHC01", b"CRDDHT02", 1_u16, 2_u16),
        ObservationClass::KnownFile => (b"CRDDKC03", b"CRDDKT03", 3_u16, 3_u16),
    };
    let current = bytes.get(..8)? == current_magic;
    let header = if current { 44 } else { REQUEST_HEADER_BYTES };
    if bytes.len() < header
        || bytes.len() > 342
        || (!current && bytes.get(..8)? != known_magic)
        || bytes.get(8..10)?
            != (if current {
                current_revision
            } else {
                known_revision
            })
            .to_le_bytes()
    {
        return None;
    }
    let nonce: [u8; 32] = bytes.get(10..42)?.try_into().ok()?;
    let root_len = usize::from(bytes[42]);
    let marker_len = usize::from(bytes[43]);
    if bytes.len() != header + root_len + marker_len || nonce == [0; 32] {
        return None;
    }
    let mut namespace = [[0_u32; 6]; 3];
    for (index, identity) in namespace.iter_mut().enumerate().filter(|_| !current) {
        for (field, value) in identity.iter_mut().enumerate() {
            let start = 44 + index * 24 + field * 4;
            *value = u32::from_le_bytes(bytes.get(start..start + 4)?.try_into().ok()?);
        }
    }
    for (index, identity) in namespace.iter().enumerate().filter(|_| !current) {
        if identity[5] & 0x10 == 0
            || identity[5] & 0x400 != 0
            || namespace[..index]
                .iter()
                .any(|other| identity[..3] == other[..3])
        {
            return None;
        }
    }
    let selected_user: [u8; 32] = if current {
        [0; 32]
    } else {
        bytes.get(116..148)?.try_into().ok()?
    };
    if !current && selected_user == [0; 32] {
        return None;
    }
    let root_name = std::str::from_utf8(bytes.get(header..header + root_len)?).ok()?;
    let marker_name = std::str::from_utf8(bytes.get(header + root_len..)?).ok()?;
    if !valid_target_names(root_name, marker_name) {
        return None;
    }
    Some(TerminalRequest {
        nonce,
        root_name: root_name.to_owned(),
        marker_name: marker_name.to_owned(),
        namespace: (!current).then_some(namespace),
        selected_user: (!current).then_some(selected_user),
    })
}

/// 不正要求または非対応環境の無取得結果を構成する。
///
/// @responsibility 未実行とclose不明を区別する。
/// @trace ARCH-000011
/// @input 相関nonce、閉reason、phase。
/// @returns snapshotなし・取得0の応答。
/// @precondition reasonはNative自身の固定literal。
/// @postcondition AuthorityとFilesystem Effectを発行しない。
/// @effect N/A: 局所値の構築のみ。
/// @failure 後続encodeが不正reason/phaseを拒否する。
/// @invariant 空close列を取得済み資源の終了証明にしない。
/// @boundary 要求拒否→閉応答。
/// @security Path・秘密・旧Task Tokenを持たない。
/// @concurrency N/A: 同期値構築。
pub(crate) fn rejected<S>(nonce: [u8; 32], reason: &'static str, phase: u8) -> TerminalResponse<S> {
    TerminalResponse {
        nonce,
        snapshot: None,
        phase,
        reason,
        operation_reason: None,
        position: None,
        target_acquired: 0,
        tokens_acquired: 0,
        directories_acquired: 0,
        token_closes: Vec::new(),
        directory_closes: Vec::new(),
        target_closes: Vec::new(),
    }
}

/// 相関した応答をbounded bytesへ変換する。
///
/// @responsibility 成功相関と取得/終了全数対応を搬送前に要求する。
/// @trace ARCH-000011
/// @input 初回資源結果と現在Snapshot。
/// @returns 最大1024bytesの専用応答、またはNone。
/// @precondition 外側namespaceの明示close後だけ構築する。
/// @postcondition 失敗ではsnapshotを出さず、元理由と部分closeを維持する。
/// @effect N/A: memory上のencodeのみ。
/// @failure 上限、phase、取得/close数、不正literal、成功相関崩れを拒否する。
/// @invariant 切詰め、ゼロ補完、close不明から成功化しない。
/// @boundary Native結果→Coordinator用途限定Adapter。
/// @security 固定理由・Identity/Hashだけ。Path、SID、marker本文はない。
/// @concurrency N/A: 一意応答の同期構築。
pub(crate) fn encode_response(response: &TerminalResponse) -> Option<Vec<u8>> {
    let mut bytes = encode_observation_header(response, ObservationClass::Eleven)?;
    if let Some(snapshot) = &response.snapshot {
        validate_snapshot_identities(&snapshot.identities, &[4])?;
        if snapshot.selected_user == [0; 32] {
            return None;
        }
        for identity in snapshot.identities {
            for field in identity {
                bytes.extend_from_slice(&field.to_le_bytes());
            }
        }
        bytes.extend_from_slice(&snapshot.selected_user);
        bytes.extend_from_slice(&snapshot.marker_sha256);
    }
    (bytes.len() <= MAX_RESPONSE_BYTES).then_some(bytes)
}

/// 十二実体の成功相関とfile固定値を専用frameへ搬送する。
///
/// @responsibility 九handle・外側終了・十二相異と固定file値が揃った場合だけ成功を出す。
/// @trace ARCH-000011
/// @input 専用Snapshotまたは部分失敗の応答。
/// @returns 最大1024bytes、成功payload392bytesのframe、またはNone。
/// @precondition 個別closeと外側終了を全て試行済み。
/// @postcondition fileを削除・縮約せず、旧frameを生成しない。
/// @effect N/A: 終端値の同期encode。
/// @failure 型、相異、長さ、リンク数、Hash、取得／close不一致を拒否する。
/// @invariant 観測成立を非使用・保存・清掃成功にしない。
/// @boundary 専用Native結果→Coordinator搬送。
/// @security 固定値とIdentityだけで本文・Path・SIDを含めない。
/// @concurrency N/A: 一意結果の純変換。
pub(crate) fn encode_known_file_response(
    response: &TerminalResponse<KnownFileTerminalSnapshot>,
) -> Option<Vec<u8>> {
    let mut bytes = encode_observation_header(response, ObservationClass::KnownFile)?;
    if let Some(snapshot) = &response.snapshot {
        validate_snapshot_identities(&snapshot.identities, &[4, 11])?;
        if snapshot.selected_user == [0; 32]
            || snapshot.marker_sha256 == [0; 32]
            || snapshot.file_byte_length != 7
            || snapshot.file_link_count != 1
            || snapshot.file_sha256 != KNOWN_FIXTURE_SHA256
        {
            return None;
        }
        for identity in snapshot.identities {
            for field in identity {
                bytes.extend_from_slice(&field.to_le_bytes());
            }
        }
        bytes.extend_from_slice(&snapshot.selected_user);
        bytes.extend_from_slice(&snapshot.marker_sha256);
        bytes.extend_from_slice(&snapshot.file_byte_length.to_le_bytes());
        bytes.extend_from_slice(&snapshot.file_link_count.to_le_bytes());
        bytes.extend_from_slice(&snapshot.file_sha256);
    }
    (bytes.len() <= MAX_RESPONSE_BYTES).then_some(bytes)
}

/// 閉じたSnapshot位置の型・非reparse・実体相異を検査する。
///
/// @responsibility file位置とDirectory位置を区別してaliasを拒否する。
/// @trace ARCH-000011
/// @input 内部固定長のIdentity列と固定file位置。
/// @returns 全条件成立ならSome、違反ならNone。
/// @precondition file位置は内部の旧／新クラスだけが指定する。
/// @postcondition 現在値を独立期待値またはAuthorityへ変換しない。
/// @effect N/A: 値検査のみ。
/// @failure Directory/file、reparse、重複実体を拒否する。
/// @invariant 日時差を別の実体の根拠にしない。
/// @boundary 私有Snapshot→frame検証。
/// @security 自由Pathや操作を扱わない。
/// @concurrency N/A: 不変列の検査。
fn validate_snapshot_identities(identities: &[[u32; 6]], files: &[usize]) -> Option<()> {
    for (position, identity) in identities.iter().enumerate() {
        if identity[5] & 0x400 != 0
            || (identity[5] & 0x10 != 0) == files.contains(&position)
            || identities[..position]
                .iter()
                .any(|other| identity[..3] == other[..3])
        {
            return None;
        }
    }
    Some(())
}

/// 二クラスの共通headerと終了相関だけを検査する。
///
/// @responsibility 固定した位置・handle上限と全close条件を維持する。
/// @trace ARCH-000011
/// @input 型ごとの応答と内部閉集合のクラス。
/// @returns 53bytes header・理由・close列、またはNone。
/// @precondition 専用encoderだけから呼び出す。
/// @postcondition payloadは専用encoderの責務として未追加のまま返す。
/// @effect N/A: memory構築のみ。
/// @failure 不正理由・位置・取得数・close数・成功相関を拒否する。
/// @invariant 旧クラスは九handleやfile位置11を受理しない。
/// @boundary 私有frame共通処理。
/// @security 任意クラス・上限・magicを受け付けない。
/// @concurrency N/A: 一結果の純変換。
fn encode_observation_header<S>(
    response: &TerminalResponse<S>,
    class: ObservationClass,
) -> Option<Vec<u8>> {
    let (magic, revision, target_count, last_position) = match class {
        ObservationClass::Eleven => (b"CRDDHR02", 2_u16, 8, 10),
        ObservationClass::KnownFile => (b"CRDDKR03", 3_u16, 9, 11),
    };
    let reason = response.reason.as_bytes();
    let operation_reason = response.operation_reason.unwrap_or("").as_bytes();
    if reason.is_empty()
        || reason.len() > 96
        || operation_reason.len() > 96
        || !reason
            .iter()
            .chain(operation_reason)
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || *byte == b'_')
        || !response.reason.starts_with("terminal_")
        || response
            .operation_reason
            .is_some_and(|value| !value.starts_with("terminal_"))
        || response.phase > 5
        || response
            .position
            .is_some_and(|position| position > last_position)
        || response.target_acquired > target_count
        || response.tokens_acquired > 2
        || response.directories_acquired > MAX_CHAIN_HANDLES
        || response.token_closes.len() != response.tokens_acquired
        || response.directory_closes.len() != response.directories_acquired
        || response.target_closes.len() != response.target_acquired
    {
        return None;
    }
    let all_closed = response
        .token_closes
        .iter()
        .chain(&response.directory_closes)
        .chain(&response.target_closes)
        .all(|value| *value);
    if response.snapshot.is_some()
        && (response.phase != 0
            || response.reason != "terminal_target_observed"
            || response.operation_reason.is_some()
            || response.position.is_some()
            || !all_closed
            || response.tokens_acquired != 2
            || response.directories_acquired < 4
            || response.target_acquired != target_count
            || response.nonce == [0; 32])
    {
        return None;
    }
    if response.snapshot.is_none() && response.phase == 0 {
        return None;
    }
    let mut bytes = Vec::with_capacity(MAX_RESPONSE_BYTES);
    bytes.extend_from_slice(magic);
    bytes.extend_from_slice(&revision.to_le_bytes());
    bytes.extend_from_slice(&response.nonce);
    bytes.extend_from_slice(&[
        u8::from(response.snapshot.is_some()),
        response.phase,
        reason.len() as u8,
        operation_reason.len() as u8,
        response.position.map_or(255, |p| p as u8),
        response.target_acquired as u8,
        response.tokens_acquired as u8,
        response.directories_acquired as u8,
        response.token_closes.len() as u8,
        response.directory_closes.len() as u8,
        response.target_closes.len() as u8,
    ]);
    debug_assert_eq!(bytes.len(), RESPONSE_HEADER_BYTES);
    bytes.extend_from_slice(reason);
    bytes.extend_from_slice(operation_reason);
    for closed in response
        .token_closes
        .iter()
        .chain(&response.directory_closes)
        .chain(&response.target_closes)
    {
        bytes.push(u8::from(*closed));
    }
    Some(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 専用十二実体要求の混用・欠落・期待値差を取得前に拒否する。
    ///
    /// @responsibility 旧入口と新入口の相互拒否、Currentとnamespace-Knownの差を確認する。
    /// @trace PRL-UT-006
    /// @precondition 既存正常要求fixtureを用いる純bytes試験。
    /// @stimulus 新magic／revision、短縮、余剰、ゼロ、alias、reparseを一条件ずつ与える。
    /// @observation 専用parserの値とSome／None。
    /// @oracle 新形式だけ受理し、Knownは三namespaceだけ、Currentは期待値なし。
    /// @cleanup N/A: OS資源を取得しない。
    /// @boundary 専用frameの局所解析。
    #[test]
    fn known_file_request_keeps_namespace_scope_and_rejects_old_frames() {
        let old = request_bytes();
        assert!(parse_known_file_request(&old).is_none());
        let mut bytes = old.clone();
        bytes[..8].copy_from_slice(b"CRDDKT03");
        bytes[8..10].copy_from_slice(&3_u16.to_le_bytes());
        assert!(parse_request(&bytes).is_none());
        let parsed = parse_known_file_request(&bytes).unwrap();
        assert_eq!(parsed.target.namespace.unwrap().len(), 3);
        assert_eq!(parsed.target.selected_user, Some([2; 32]));
        for length in [0, 8, 147, bytes.len() - 1] {
            assert!(parse_known_file_request(&bytes[..length]).is_none());
        }
        for position in [0, 8, 42, 43, 148] {
            let mut changed = bytes.clone();
            changed[position] ^= 0xff;
            assert!(parse_known_file_request(&changed).is_none());
        }
        for (start, end) in [(10, 42), (116, 148)] {
            let mut changed = bytes.clone();
            changed[start..end].fill(0);
            assert!(parse_known_file_request(&changed).is_none());
        }
        let mut duplicate = bytes.clone();
        duplicate.copy_within(44..56, 68);
        assert!(parse_known_file_request(&duplicate).is_none());
        let mut reparse = bytes.clone();
        reparse[64..68].copy_from_slice(&0x410_u32.to_le_bytes());
        assert!(parse_known_file_request(&reparse).is_none());
        let mut extra = bytes.clone();
        extra.push(0);
        assert!(parse_known_file_request(&extra).is_none());
        let mut current = bytes[..44].to_vec();
        current[..8].copy_from_slice(b"CRDDKC03");
        current.extend_from_slice(&bytes[148..]);
        let parsed = parse_known_file_request(&current).unwrap();
        assert!(parsed.target.namespace.is_none());
        assert!(parsed.target.selected_user.is_none());
        assert!(parse_request(&current).is_none());
        current[8..10].copy_from_slice(&1_u16.to_le_bytes());
        assert!(parse_known_file_request(&current).is_none());
    }

    /// 十二実体成功の全fieldと九close相関を搬送する。
    ///
    /// @responsibility file属性・固定値・実体相異と外側終了を共同検証する。
    /// @trace PRL-UT-006
    /// @precondition 非Authorityの合成Snapshotと終了列。
    /// @stimulus 正常、file属性／alias／固定値、nonce、close数・不明を変更する。
    /// @observation 392bytes payloadと専用magic、失敗時の位置11・部分close。
    /// @oracle 正常だけ成功をencodeし、失敗の全fieldを保持、旧encoderは九handleを拒否。
    /// @cleanup N/A: memoryだけ。
    /// @boundary 専用応答の局所符号化。実OS終了は別試験。
    #[test]
    fn known_file_response_preserves_twelve_entities_and_rejects_false_success() {
        let snapshot = KnownFileTerminalSnapshot {
            identities: std::array::from_fn(|position| {
                [
                    1,
                    0,
                    position as u32 + 1,
                    9,
                    10,
                    if [4, 11].contains(&position) {
                        0x80
                    } else {
                        0x10
                    },
                ]
            }),
            selected_user: [2; 32],
            marker_sha256: [3; 32],
            file_byte_length: 7,
            file_link_count: 1,
            file_sha256: KNOWN_FIXTURE_SHA256,
        };
        let response = TerminalResponse {
            nonce: [1; 32],
            snapshot: Some(snapshot),
            phase: 0,
            reason: "terminal_target_observed",
            operation_reason: None,
            position: None,
            target_acquired: 9,
            tokens_acquired: 2,
            directories_acquired: 4,
            token_closes: vec![true; 2],
            directory_closes: vec![true; 4],
            target_closes: vec![true; 9],
        };
        let encoded = encode_known_file_response(&response).unwrap();
        let payload = 53 + response.reason.len() + 15;
        assert_eq!(&encoded[..8], b"CRDDKR03");
        assert_eq!(&encoded[8..10], &3_u16.to_le_bytes());
        assert_eq!(&encoded[10..42], &response.nonce);
        assert_eq!(encoded.len(), payload + 392);
        assert_eq!(&encoded[payload + 352..payload + 356], &7_u32.to_le_bytes());
        assert_eq!(&encoded[payload + 356..payload + 360], &1_u32.to_le_bytes());
        assert_eq!(&encoded[payload + 360..], &KNOWN_FIXTURE_SHA256);
        for case in 0..13 {
            let mut changed = response.clone();
            let snapshot = changed.snapshot.as_mut().unwrap();
            match case {
                0 => snapshot.file_byte_length = 8,
                1 => snapshot.file_link_count = 2,
                2 => snapshot.file_sha256[0] ^= 1,
                3 => snapshot.identities[11] = snapshot.identities[4],
                4 => snapshot.identities[11][5] = 0x10,
                5 => snapshot.identities[11][5] |= 0x400,
                6 => changed.nonce = [0; 32],
                7 => changed.target_closes[8] = false,
                8 => {
                    changed.target_closes.pop();
                }
                9 => changed.directory_closes[0] = false,
                10 => changed.token_closes[0] = false,
                11 => changed.target_acquired = 8,
                12 => snapshot.marker_sha256 = [0; 32],
                _ => unreachable!(),
            }
            assert!(
                encode_known_file_response(&changed).is_none(),
                "case {case}"
            );
        }
        let mut partial: TerminalResponse<KnownFileTerminalSnapshot> =
            rejected([1; 32], "terminal_known_file_read_failed", 3);
        partial.position = Some(11);
        partial.target_acquired = 9;
        partial.target_closes = vec![true; 9];
        let frame = encode_known_file_response(&partial).unwrap();
        assert_eq!(&frame[46..48], &[11, 9]);
        assert_eq!(frame[42], 0);
        assert_eq!(frame.len(), 53 + partial.reason.len() + 9);
        partial.position = Some(12);
        assert!(encode_known_file_response(&partial).is_none());
        let mut old: TerminalResponse = rejected([1; 32], "terminal_target_close_unknown", 4);
        old.target_acquired = 9;
        old.target_closes = vec![true; 9];
        assert!(encode_response(&old).is_none());
        old.target_acquired = 8;
        old.target_closes.pop();
        old.position = Some(11);
        assert!(encode_response(&old).is_none());
    }

    /// 保存要求の全十一期待値を局所bytesへ固定する。
    ///
    /// @responsibility 実OS取得なしに専用保存parserの正常・拒否母集団を構成する。
    /// @trace PRL-UT-006
    /// @precondition N/A: memory fixtureだけを生成する。
    /// @stimulus 同参照、固定名、十一型・相異と完全本文をencodeする。
    /// @observation 専用要求の元bytes。
    /// @oracle parserが受理し、変更Caseは一条件ずつ不正化できる。
    /// @cleanup N/A: OS資源を作らない。
    /// @boundary Native要求parserだけ。本文Hashの実照合は主張しない。
    fn save_request_bytes() -> Vec<u8> {
        let reference = b"host-terminal.12345678-1234-4234-8234-123456789abc";
        let root = b"crdd-coordinator-doctor-fixture";
        let marker = format!("host-{}.json", "a".repeat(64));
        let mut bytes = b"CRDDHS01".to_vec();
        bytes.extend_from_slice(&1_u16.to_le_bytes());
        bytes.extend_from_slice(&[1; 32]);
        bytes.extend_from_slice(&[reference.len() as u8, root.len() as u8, marker.len() as u8]);
        bytes.extend_from_slice(&2_u16.to_le_bytes());
        for index in 0..11_u32 {
            for field in [1, 0, index + 1, 9, 10, if index == 4 { 0x80 } else { 0x10 }] {
                bytes.extend_from_slice(&field.to_le_bytes());
            }
        }
        bytes.extend_from_slice(&[2; 32]);
        bytes.extend_from_slice(&[3; 32]);
        bytes.extend_from_slice(&[4; 32]);
        assert_eq!(bytes.len(), 407);
        bytes.extend_from_slice(reference);
        bytes.extend_from_slice(root);
        bytes.extend_from_slice(marker.as_bytes());
        bytes.extend_from_slice(b"{}");
        bytes
    }

    /// 十二実体の専用保存・読戻しframeを構築する。
    ///
    /// @responsibility parser検証用に独立な固定offset・型・file値を与える。
    /// @trace PRL-UT-006
    /// @precondition OS処置を発行しない合成値だけ。
    /// @stimulus 指定長のopaque本文を付ける。
    /// @observation 471bytes headerと三固定名・本文の完全frame。
    /// @oracle 全十二期待値を順序どおり保持する。
    /// @cleanup N/A: memoryだけ。
    /// @boundary 専用Protocolの合成入力。
    fn known_file_record_request_bytes(body_len: usize) -> Vec<u8> {
        let reference = b"host-terminal.12345678-1234-4234-8234-123456789abc";
        let root = b"crdd-coordinator-doctor-12345678-1234-4234-8234-123456789abc";
        let marker = format!("host-{}.json", "a".repeat(64));
        let mut bytes = b"CRDDKS03".to_vec();
        bytes.extend_from_slice(&3_u16.to_le_bytes());
        bytes.extend_from_slice(&[1; 32]);
        bytes.extend_from_slice(&[reference.len() as u8, root.len() as u8, marker.len() as u8]);
        bytes.extend_from_slice(&(body_len as u16).to_le_bytes());
        for index in 0..12_u32 {
            for field in [
                1,
                0,
                index + 1,
                9,
                10,
                if [4, 11].contains(&index) { 0x80 } else { 0x10 },
            ] {
                bytes.extend_from_slice(&field.to_le_bytes());
            }
        }
        bytes.extend_from_slice(&[2; 32]);
        bytes.extend_from_slice(&[3; 32]);
        bytes.extend_from_slice(&7_u32.to_le_bytes());
        bytes.extend_from_slice(&1_u32.to_le_bytes());
        bytes.extend_from_slice(&KNOWN_FIXTURE_SHA256);
        bytes.extend_from_slice(&[4; 32]);
        assert_eq!(bytes.len(), 471);
        bytes.extend_from_slice(reference);
        bytes.extend_from_slice(root);
        bytes.extend_from_slice(marker.as_bytes());
        bytes.resize(bytes.len() + body_len, b'x');
        bytes
    }

    /// 十二実体とfile条件を専用記録frameに結合する。
    ///
    /// @responsibility クラス・mode混用、file欠落、alias、型差と上限差を拒否する。
    /// @trace PRL-UT-006
    /// @precondition 本文の実Hash照合は後続Native Ownerの責務である。
    /// @stimulus 各mode、全十二型・alias、全40file bytes、全prefix欠落、本文境界を変える。
    /// @observation 専用parserの全値と拒否結果。
    /// @oracle 正常は全十二値保持、不正はNone、最大8847bytesだけ受理する。
    /// @cleanup N/A: 純解析。OS資源取得0。
    /// @boundary 専用記録Protocol。実保存・清掃は対象外。
    #[test]
    fn known_file_record_frames_preserve_twelve_targets_and_reject_cross_class_inputs() {
        let bytes = known_file_record_request_bytes(2);
        let request = parse_known_file_save_request(&bytes).unwrap();
        assert_eq!(request.known.identities[11], [1, 0, 12, 9, 10, 0x80]);
        assert_eq!(request.known.file_byte_length, 7);
        assert_eq!(request.known.file_link_count, 1);
        assert_eq!(request.known.file_sha256, KNOWN_FIXTURE_SHA256);
        assert_eq!(request.bytes, b"xx");
        assert!(parse_known_file_read_request(&bytes).is_none());
        assert!(parse_save_request(&bytes).is_none());
        assert!(parse_read_request(&bytes).is_none());
        assert!(parse_known_file_request(&bytes).is_none());
        assert!(parse_known_file_save_request(&save_request_bytes()).is_none());
        let mut read = bytes.clone();
        read[..8].copy_from_slice(b"CRDDKL03");
        assert!(parse_known_file_read_request(&read).is_some());
        assert!(parse_known_file_save_request(&read).is_none());
        for length in 0..bytes.len() {
            assert!(parse_known_file_save_request(&bytes[..length]).is_none());
        }
        for position in 399..439 {
            let mut changed = bytes.clone();
            changed[position] ^= 1;
            assert!(parse_known_file_save_request(&changed).is_none());
        }
        for (start, end) in [(10, 42), (335, 367), (367, 399), (439, 471)] {
            let mut changed = bytes.clone();
            changed[start..end].fill(0);
            assert!(parse_known_file_save_request(&changed).is_none());
        }
        for position in 0..12 {
            let mut changed = bytes.clone();
            let attributes = 47 + position * 24 + 20;
            changed[attributes] ^= 0x10;
            assert!(parse_known_file_save_request(&changed).is_none());
            changed = bytes.clone();
            let identity = 47 + position * 24;
            changed[identity..identity + 12].copy_from_slice(
                &bytes[47 + ((position + 1) % 12) * 24..59 + ((position + 1) % 12) * 24],
            );
            assert!(parse_known_file_save_request(&changed).is_none());
        }
        for position in [0, 8, 42, 43, 44, 45, 471, 471 + 50 + 14 + 24] {
            let mut changed = bytes.clone();
            changed[position] ^= 0xff;
            assert!(parse_known_file_save_request(&changed).is_none());
        }
        let mut extra = bytes.clone();
        extra.push(0);
        assert!(parse_known_file_save_request(&extra).is_none());
        let maximum = known_file_record_request_bytes(8192);
        assert_eq!(maximum.len(), MAX_KNOWN_FILE_RECORD_REQUEST_BYTES);
        assert!(parse_known_file_save_request(&maximum).is_some());
        assert!(parse_known_file_save_request(&known_file_record_request_bytes(8193)).is_none());
        assert!(parse_known_file_save_request(&known_file_record_request_bytes(0)).is_none());
        assert!(parse_known_file_save_request(&known_file_record_request_bytes(1)).is_some());
    }

    /// 十二実体の保存・読戻し結果を縮約せず搬送する。
    ///
    /// @responsibility 専用frame・九対象終了・file payload・対象未試行を区別する。
    /// @trace PRL-UT-006
    /// @precondition OS処置や過去成功を主張しない合成結果だけ。
    /// @stimulus 保存観測、部分receipt、読戻し完了と終了不明・対象混入をencodeする。
    /// @observation magic／revision、内包frame、全field、拒否結果。
    /// @oracle 専用観測は392bytes、読戻しの対象取得は0、矛盾する成功は拒否。
    /// @cleanup N/A: memory値だけ。
    /// @boundary 専用結果Protocol。実保存・読戻し成功は対象外。
    #[test]
    fn known_file_record_responses_preserve_class_and_read_without_target_acquisition() {
        let request = parse_known_file_save_request(&known_file_record_request_bytes(2)).unwrap();
        let observation = TerminalResponse {
            nonce: request.nonce,
            snapshot: Some(request.known),
            phase: 0,
            reason: "terminal_target_observed",
            operation_reason: None,
            position: None,
            target_acquired: 9,
            tokens_acquired: 2,
            directories_acquired: 4,
            token_closes: vec![true; 2],
            directory_closes: vec![true; 4],
            target_closes: vec![true; 9],
        };
        let nested = encode_known_file_response(&observation).unwrap();
        assert_eq!(
            nested.len(),
            53 + "terminal_target_observed".len() + 15 + 392
        );
        let mut save = TerminalSaveResponse {
            reference: Some(request.reference.clone()),
            saved: false,
            reasons: ["terminal_record_publish_failed", "", "", "", ""],
            observation: observation.clone(),
            receipt: Some([0; SAVE_RECEIPT_BYTES]),
        };
        let frame = encode_known_file_save_response(&save).unwrap();
        assert_eq!(&frame[..10], b"CRDDKW03\x03\x00");
        let offset = 52 + request.reference.len() + save.reasons[0].len();
        assert_eq!(&frame[offset..offset + nested.len()], &nested);
        assert!(frame.len() <= MAX_SAVE_RESPONSE_BYTES);
        save.saved = true;
        assert!(encode_known_file_save_response(&save).is_none());
        save.reasons[0] = "terminal_record_saved";
        assert!(encode_known_file_save_response(&save).is_some());
        save.observation.target_closes[8] = false;
        assert!(encode_known_file_save_response(&save).is_none());

        let mut read = TerminalReadResponse {
            reference: Some(request.reference),
            observed: true,
            state: 2,
            reason: "terminal_record_observed",
            operation_reason: None,
            record_identity: Some([1, 0, 99, 1, 2, 0x80]),
            open_issued: true,
            opened: true,
            reader_close: Some(true),
            generation_acquired: true,
            generation_close: Some(true),
            observation: TerminalResponse {
                nonce: [1; 32],
                snapshot: None,
                phase: 2,
                reason: "terminal_target_not_attempted",
                operation_reason: None,
                position: None,
                target_acquired: 0,
                tokens_acquired: 2,
                directories_acquired: 4,
                token_closes: vec![true; 2],
                directory_closes: vec![true; 4],
                target_closes: Vec::new(),
            },
        };
        let frame = encode_known_file_read_response(&read).unwrap();
        assert_eq!(&frame[..10], b"CRDDKB03\x03\x00");
        let offset = 55 + read.reference.as_ref().unwrap().len() + read.reason.len();
        assert_eq!(&frame[offset..offset + 10], b"CRDDKR03\x03\x00");
        assert_eq!(frame[offset + 47], 0);
        read.generation_close = Some(false);
        assert!(encode_known_file_read_response(&read).is_none());
        read.generation_close = Some(true);
        read.observation = observation;
        assert!(encode_known_file_read_response(&read).is_none());
    }

    /// 保存要求へ対象全体を結合し、混用・欠落・重複を取得前に拒否する。
    ///
    /// @responsibility 三namespaceだけの要求や余剰本文を保存入口へ通さない。
    /// @trace PRL-UT-006
    /// @precondition 合成要求と現在のproduction parser。
    /// @stimulus 正常、異なるmagic/revision、各欠落、Hashゼロ、実体重複とPathを与える。
    /// @observation 解析結果と同参照・Known全十一実体・完全本文。
    /// @oracle 正常だけ受理し、本文Hashの実照合・保存成功は主張しない。
    /// @cleanup N/A: memory解析だけ。資源取得0。
    /// @boundary 専用保存Protocolの局所受付。
    #[test]
    fn save_request_binds_all_known_targets_and_rejects_mixed_frames() {
        let bytes = save_request_bytes();
        let parsed = parse_save_request(&bytes).unwrap();
        assert!(valid_reference(&parsed.reference));
        assert_eq!(parsed.known.identities[10], [1, 0, 11, 9, 10, 0x10]);
        assert_eq!(parsed.bytes, b"{}");
        assert!(parse_request(&bytes).is_none());
        assert!(parse_save_request(&request_bytes()).is_none());
        for length in [0, 8, 406, bytes.len() - 1] {
            assert!(parse_save_request(&bytes[..length]).is_none());
        }
        for position in [0, 8, 42, 43, 44, 45, 407] {
            let mut changed = bytes.clone();
            changed[position] ^= 0xff;
            assert!(parse_save_request(&changed).is_none());
        }
        for (start, end) in [(10, 42), (311, 343), (343, 375), (375, 407)] {
            let mut changed = bytes.clone();
            changed[start..end].fill(0);
            assert!(parse_save_request(&changed).is_none());
        }
        let mut duplicate = bytes.clone();
        duplicate.copy_within(47..59, 47 + 24 * 8);
        assert!(parse_save_request(&duplicate).is_none());
        let mut wrong_type = bytes.clone();
        wrong_type[47 + 4 * 24 + 20..47 + 5 * 24].copy_from_slice(&0x10_u32.to_le_bytes());
        assert!(parse_save_request(&wrong_type).is_none());
        let mut extra = bytes.clone();
        extra.push(0);
        assert!(parse_save_request(&extra).is_none());
        assert!(!valid_reference("host-terminal../fixture"));
    }

    /// 保存と外側終了の部分結果を同じ参照で完全搬送する。
    ///
    /// @responsibility 終了不明でも記録receiptや元失敗を消さず、上限が事前固定されることを確認する。
    /// @trace PRL-UT-006
    /// @precondition OS処置を主張しない合成receiptと観測拒否。
    /// @stimulus 五元理由、部分receiptと外側close不明をencodeする。
    /// @observation 完全bytes、参照、全理由、receiptおよび既知最大形状。
    /// @oracle 全fieldが保持され、欠落成功は拒否され、最大1758bytesで2048以下。
    /// @cleanup N/A: 値構築のみ。
    /// @boundary 専用保存応答の局所搬送。実保存・実close成功は対象外。
    #[test]
    fn save_response_retains_partial_receipts_and_has_a_fixed_upper_bound() {
        let reference = "host-terminal.12345678-1234-4234-8234-123456789abc";
        let mut receipt = [0; SAVE_RECEIPT_BYTES];
        receipt[38..42].fill(1);
        receipt[51] = 2;
        let mut response = TerminalSaveResponse {
            reference: Some(reference.to_owned()),
            saved: false,
            reasons: [
                "terminal_capacity_release_unknown",
                "terminal_record_read_failed",
                "terminal_record_write_failed",
                "terminal_inventory_read_failed",
                "terminal_inventory_close_unknown",
            ],
            observation: rejected([1; 32], "terminal_directory_close_unknown", 4),
            receipt: Some(receipt),
        };
        let encoded = encode_save_response(&response).unwrap();
        assert_eq!(&encoded[..8], b"CRDDHW01");
        assert_eq!(&encoded[10..42], &[1; 32]);
        assert_eq!(&encoded[52..52 + reference.len()], reference.as_bytes());
        assert_eq!(&encoded[encoded.len() - SAVE_RECEIPT_BYTES..], &receipt);
        for reason in response.reasons {
            assert!(
                encoded
                    .windows(reason.len())
                    .any(|bytes| bytes == reason.as_bytes())
            );
        }
        const {
            assert!(
                52 + 50 + 5 * 96 + MAX_RESPONSE_BYTES + SAVE_RECEIPT_BYTES
                    <= MAX_SAVE_RESPONSE_BYTES
            );
        }
        response.saved = true;
        assert!(encode_save_response(&response).is_none());
        response.saved = false;
        response.reference = Some("other".to_owned());
        assert!(encode_save_response(&response).is_none());
    }

    /// 専用要求の局所fixtureを構築する。
    ///
    /// @responsibility OSを使わず独立期待値の搬送入力を固定する。
    /// @trace PRL-UT-006
    /// @precondition N/A: memory fixtureだけを生成する。
    /// @stimulus 固定名、相異なる三実体、nonceと利用者Hashを符号化する。
    /// @observation 専用要求の元bytes。
    /// @oracle production parserが受理でき、各拒否Caseが一条件だけ変更できる。
    /// @cleanup N/A: OS資源や共有状態を作らない。
    /// @boundary N/A: bytesの局所構築。
    fn request_bytes() -> Vec<u8> {
        let root = b"crdd-coordinator-doctor-fixture";
        let marker = format!("host-{}.json", "a".repeat(64));
        let mut bytes = b"CRDDHT02".to_vec();
        bytes.extend_from_slice(&2_u16.to_le_bytes());
        bytes.extend_from_slice(&[1; 32]);
        bytes.extend_from_slice(&[root.len() as u8, marker.len() as u8]);
        for index in 0..3_u32 {
            for field in [1, 0, index + 1, 9, 10, 0x10] {
                bytes.extend_from_slice(&field.to_le_bytes());
            }
        }
        bytes.extend_from_slice(&[2; 32]);
        bytes.extend_from_slice(root);
        bytes.extend_from_slice(marker.as_bytes());
        bytes
    }

    /// 専用要求の境界と未知入力を取得前に拒否する。
    ///
    /// @responsibility magic/revision/余剰/欠落/nonce/利用者/実体/名前の受付を確認する。
    /// @trace PRL-UT-006
    /// @precondition 固定bytes fixtureと現在のproduction parser。
    /// @stimulus 一条件ずつ不正化した要求を解析する。
    /// @observation Some/Noneと正常時のfield。
    /// @oracle 正常入力だけ受理し、不正要求とPath指定を拒否する。
    /// @cleanup N/A: 値解析だけでOS取得0。
    /// @boundary 専用Protocol受付の局所代替。
    #[test]
    fn rejects_malformed_terminal_requests_before_acquisition() {
        let bytes = request_bytes();
        let parsed = parse_request(&bytes).unwrap();
        assert_eq!(parsed.nonce, [1; 32]);
        assert_eq!(parsed.selected_user, Some([2; 32]));
        assert_eq!(parsed.namespace.unwrap()[2], [1, 0, 3, 9, 10, 0x10]);
        let mut extra = bytes.clone();
        extra.push(0);
        assert!(parse_request(&extra).is_none());
        for length in [0, 8, 147, bytes.len() - 1] {
            assert!(parse_request(&bytes[..length]).is_none());
        }
        for position in [0, 8, 42, 43, 148] {
            let mut changed = bytes.clone();
            changed[position] ^= 0xff;
            assert!(parse_request(&changed).is_none());
        }
        for (start, end) in [(10, 42), (116, 148)] {
            let mut changed = bytes.clone();
            changed[start..end].fill(0);
            assert!(parse_request(&changed).is_none());
        }
        let mut duplicate = bytes.clone();
        duplicate.copy_within(44..56, 68);
        assert!(parse_request(&duplicate).is_none());
        let mut reparse = bytes.clone();
        reparse[64..68].copy_from_slice(&0x410_u32.to_le_bytes());
        assert!(parse_request(&reparse).is_none());
        assert!(!valid_target_names("../fixture", &parsed.marker_name));
        assert!(!valid_target_names(&parsed.root_name, "host-any.json"));
    }

    /// 読戻し要求を保存要求と分離し現在結果を完全搬送する。
    ///
    /// @responsibility 現在stateと部分closeを履歴や対象観測へ変換しない。
    /// @trace PRL-UT-006
    /// @precondition 合成frameのみ。実OS資源を取得しない。
    /// @stimulus 読取りmagic、正常Prepared/Published、reader終了不明と相関差をencodeする。
    /// @observation parse受理/拒否と全固定field。
    /// @oracle 保存magicは拒否、同参照/current Identityと元理由を保持、偽成功は拒否。
    /// @cleanup N/A: memoryのみ。
    /// @boundary 専用読戻し搬送の純値試験。
    #[test]
    fn readback_separates_current_record_from_target_and_history() {
        let saved = save_request_bytes();
        assert!(parse_read_request(&saved).is_none());
        let mut request = saved.clone();
        request[..8].copy_from_slice(b"CRDDHL01");
        assert!(parse_save_request(&request).is_none());
        let parsed = parse_read_request(&request).unwrap();
        assert_eq!(
            parsed.reference,
            parse_save_request(&saved).unwrap().reference
        );
        request.push(0);
        assert!(parse_read_request(&request).is_none());
        let mut outer = rejected([1; 32], "terminal_target_not_attempted", 2);
        outer.tokens_acquired = 2;
        outer.token_closes = vec![true; 2];
        outer.directories_acquired = 4;
        outer.directory_closes = vec![true; 4];
        let mut response = TerminalReadResponse {
            reference: Some(parsed.reference),
            observed: true,
            state: 1,
            reason: "terminal_record_observed",
            operation_reason: None,
            record_identity: Some([1, 0, 99, 9, 10, 0x80]),
            open_issued: true,
            opened: true,
            reader_close: Some(true),
            generation_acquired: true,
            generation_close: Some(true),
            observation: outer,
        };
        for state in [1, 2] {
            response.state = state;
            let frame = encode_read_response(&response).unwrap();
            assert_eq!(&frame[..8], b"CRDDHB01");
            assert_eq!(&frame[8..10], &2_u16.to_le_bytes());
            assert_eq!(&frame[42..45], &[1, state, 50]);
            assert_eq!(&frame[49..55], &[1, 1, 1, 1, 1, 1]);
            assert!(frame.len() <= MAX_SAVE_RESPONSE_BYTES);
        }
        response.generation_close = Some(false);
        assert!(encode_read_response(&response).is_none());
        response.observed = false;
        let generation_partial = encode_read_response(&response).unwrap();
        assert_eq!(&generation_partial[53..55], &[1, 0]);
        response.generation_acquired = false;
        assert!(encode_read_response(&response).is_none());
        response.generation_close = None;
        assert!(encode_read_response(&response).is_none());
        response.state = 0;
        response.record_identity = None;
        response.open_issued = false;
        response.opened = false;
        response.reader_close = None;
        let generation_not_acquired = encode_read_response(&response).unwrap();
        assert_eq!(&generation_not_acquired[53..55], &[0, 2]);
        response.state = 2;
        response.record_identity = Some([1, 0, 99, 9, 10, 0x80]);
        response.open_issued = true;
        response.opened = true;
        response.generation_acquired = true;
        response.generation_close = Some(true);
        response.observed = true;
        response.reader_close = Some(false);
        assert!(encode_read_response(&response).is_none());
        response.observed = false;
        response.reason = "terminal_record_reader_close_unknown";
        let partial = encode_read_response(&response).unwrap();
        assert_eq!(partial[43], 2);
        assert_eq!(partial[49], 1);
        assert_eq!(partial[52], 0);
        response.observation.phase = 4;
        response.observation.reason = "terminal_directory_close_unknown";
        response.observation.directory_closes[0] = false;
        assert!(encode_read_response(&response).is_some());
    }

    /// 初回要求で未知の期待値を生成しない。
    ///
    /// @responsibility Current要求とKnown要求の閉形式を別に確認する。
    /// @trace PRL-UT-006
    /// @precondition 正常Known要求の名前とnonceを持つ局所bytes。
    /// @stimulus Current headerへ変換し、旧revision・余剰・欠落を与える。
    /// @observation 解析値の期待値欠落とSome/None。
    /// @oracle Currentはnamespace／利用者がNoneであり、不正形式は拒否する。
    /// @cleanup N/A: byte列だけ。OS資源を取得しない。
    /// @boundary 専用Protocol受付の局所試験。
    #[test]
    fn current_request_does_not_invent_expected_identities() {
        let known = request_bytes();
        let mut current = known[..44].to_vec();
        current[..8].copy_from_slice(b"CRDDHC01");
        current[8..10].copy_from_slice(&1_u16.to_le_bytes());
        current.extend_from_slice(&known[148..]);
        let parsed = parse_request(&current).unwrap();
        assert!(parsed.namespace.is_none());
        assert!(parsed.selected_user.is_none());
        assert_eq!(parsed.root_name, parse_request(&known).unwrap().root_name);
        assert!(parse_request(&current[..current.len() - 1]).is_none());
        current.push(0);
        assert!(parse_request(&current).is_none());
        current.pop();
        current[8..10].copy_from_slice(&2_u16.to_le_bytes());
        assert!(parse_request(&current).is_none());
    }

    /// 成功相関と部分取得・終了不明の応答を確認する。
    ///
    /// @responsibility Snapshotと全closeの共同条件が崩れた成功を搬送しない。
    /// @trace PRL-UT-006
    /// @precondition OS観測を主張しない合成応答。
    /// @stimulus 成功、部分取得、close不明、元理由なしの外側close不明をencodeする。
    /// @observation 応答bytesとencode拒否。
    /// @oracle 不正成功はNone、失敗は取得数と元理由の有無を保持しSnapshotを出さない。
    /// @cleanup N/A: memory値だけでhandleを取得しない。
    /// @boundary Native結果搬送の局所代替。実OS close故障の証明ではない。
    #[test]
    fn preserves_partial_results_without_false_success() {
        let snapshot = TerminalSnapshot {
            identities: std::array::from_fn(|index| {
                [
                    1,
                    0,
                    index as u32 + 1,
                    9,
                    10,
                    if index == 4 { 0x80 } else { 0x10 },
                ]
            }),
            selected_user: [2; 32],
            marker_sha256: [3; 32],
        };
        let mut response = TerminalResponse {
            nonce: [1; 32],
            snapshot: Some(snapshot),
            phase: 0,
            reason: "terminal_target_observed",
            operation_reason: None,
            position: None,
            target_acquired: 8,
            tokens_acquired: 2,
            directories_acquired: 4,
            token_closes: vec![true; 2],
            directory_closes: vec![true; 4],
            target_closes: vec![true; 8],
        };
        let encoded = encode_response(&response).unwrap();
        assert_eq!(&encoded[..8], b"CRDDHR02");
        assert_eq!(encoded[42], 1);
        assert_eq!(encoded.len(), 53 + response.reason.len() + 14 + 328);
        response.target_closes[7] = false;
        assert!(encode_response(&response).is_none());
        response.target_closes[7] = true;
        response.directory_closes.pop();
        assert!(encode_response(&response).is_none());
        response.directory_closes.push(true);
        response.snapshot.as_mut().unwrap().identities[1] =
            response.snapshot.as_ref().unwrap().identities[0];
        assert!(encode_response(&response).is_none());
        response.snapshot = None;
        response.phase = 4;
        response.reason = "terminal_directory_close_unknown";
        response.directory_closes[0] = false;
        let failed = encode_response(&response).unwrap();
        assert_eq!(failed[42], 0);
        assert_eq!(failed[43], 4);
        assert_eq!(failed[45], 0);
        response.phase = 3;
        response.reason = "terminal_target_open_failed";
        response.operation_reason = Some("terminal_target_open_failed");
        response.position = Some(5);
        response.directory_closes.fill(true);
        response.target_acquired = 2;
        response.target_closes = vec![true; 2];
        let partial = encode_response(&response).unwrap();
        assert_eq!(partial[46], 5);
        assert_eq!(partial[47], 2);
        assert_eq!(partial[52], 2);
        response.target_acquired = 3;
        assert!(encode_response(&response).is_none());
    }
}
