//! Platform Access Native Workerのbinary protocolを定義する。
//!
//! @responsibility request／responseのrevision、上限、decode、encodeおよびPath受理集合を固定する。
//! @trace ARCH-000008

use std::io::{self, Read, Write};

pub const PROTOCOL_REVISION: u16 = 3;
pub const PROVIDER_HOME_PROTOCOL_REVISION: u16 = 3;
pub const MAXIMUM_REQUEST_BYTES: usize = 65_536;
const RESPONSE_MAGIC: &[u8; 8] = b"CRDDPR03";
const PROVIDER_HOME_REQUEST_MAGIC: &[u8; 8] = b"CRDDPH02";
const PROVIDER_HOME_RESPONSE_MAGIC: &[u8; 8] = b"CRDDHO02";
const RESPONSE_BYTES: usize = 86;
pub const PROVIDER_HOME_REQUEST_BYTES: usize = 76;
pub const PROVIDER_HOME_RESPONSE_BYTES: usize = 182;

pub const PRINCIPAL_PRIMARY_TOKEN: u32 = 1 << 0;
pub const PRINCIPAL_INTERACTIVE_GROUP: u32 = 1 << 1;
pub const PRINCIPAL_SERVICE_GROUP: u32 = 1 << 2;
pub const PRINCIPAL_BATCH_GROUP: u32 = 1 << 3;
pub const PRINCIPAL_NETWORK_GROUP: u32 = 1 << 4;
pub const PRINCIPAL_RESTRICTED_TOKEN: u32 = 1 << 5;
pub const PRINCIPAL_APP_CONTAINER: u32 = 1 << 6;
pub const PRINCIPAL_NONZERO_SESSION: u32 = 1 << 7;

pub const PROVIDER_HOME_DIRECTORY: u32 = 1 << 0;
pub const PROVIDER_HOME_FIXED_VOLUME: u32 = 1 << 1;
pub const PROVIDER_HOME_NO_REPARSE_CHAIN: u32 = 1 << 2;
pub const PROVIDER_HOME_STABLE_IDENTITY: u32 = 1 << 3;
pub const PROVIDER_HOME_OWNER_SELECTED_USER: u32 = 1 << 4;
pub const PROVIDER_HOME_DACL_PROTECTED: u32 = 1 << 5;
pub const PROVIDER_HOME_WRITERS_RESTRICTED: u32 = 1 << 6;
pub const PROVIDER_HOME_SELECTED_USER_FULL_CONTROL: u32 = 1 << 7;
pub const PROVIDER_HOME_SYSTEM_FULL_CONTROL: u32 = 1 << 8;

/// 固定Binary Protocolで使用するProvider契約を表す。
///
/// @responsibility Providerが保持する固定Binary Protocolの値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape enumとして固定Binary Protocolのfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum Provider {
    Codex = 1,
    Claude = 2,
}

impl Provider {
    /// 固定Binary Protocolのparse責務を実行する。
    ///
    /// @responsibility 固定Binary Protocolのparse責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
    /// @trace ARCH-000008
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
    /// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency N/A: 共有可変状態を持たない同期処理である。
    fn parse(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::Codex),
            2 => Some(Self::Claude),
            _ => None,
        }
    }

    /// 固定Binary Protocolのdirectory name責務を実行する。
    ///
    /// @responsibility 固定Binary Protocolのdirectory name責務を実行する責務を所有し、観測不能または不正な入力を成功へ畳まない。
    /// @trace ARCH-000008
    /// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
    /// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
    /// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
    /// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
    /// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
    /// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
    /// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
    /// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
    /// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
    /// @concurrency N/A: 共有可変状態を持たない同期処理である。
    pub fn directory_name(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
        }
    }
}

/// 固定Binary Protocolで使用するProviderHomeRequest契約を表す。
///
/// @responsibility ProviderHomeRequestが保持する固定Binary Protocolの値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとして固定Binary Protocolのfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProviderHomeRequest {
    pub provider: Provider,
    pub nonce: [u8; 32],
    pub mount_source_hash: [u8; 32],
}

/// 固定Binary Protocolで使用するProviderHomeReason契約を表す。
///
/// @responsibility ProviderHomeReasonが保持する固定Binary Protocolの値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape enumとして固定Binary Protocolのfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u16)]
pub enum ProviderHomeReason {
    #[cfg(not(windows))]
    UnsupportedPlatform = 1,
    InvalidRequest = 2,
    PrincipalUnavailable = 3,
    PrincipalNotSelectedLocalUser = 4,
    KnownFolderUnavailable = 5,
    HomeUnavailable = 6,
    HomeReparseRejected = 7,
    HomeNotFixedVolume = 8,
    HomeIdentityChanged = 9,
    HomeSecurityUnavailable = 10,
    HomeOwnerMismatch = 11,
    HomeDaclNotProtected = 12,
    HomeDaclNotRestricted = 13,
    HomeAccessInsufficient = 14,
    MountSourceMismatch = 15,
    ObservationCandidate = 100,
}

/// 固定Binary Protocolで使用するProviderHomeResponse契約を表す。
///
/// @responsibility ProviderHomeResponseが保持する固定Binary Protocolの値、状態または分類境界を定義する。
/// @trace ARCH-000008
/// @shape structとして固定Binary Protocolのfield、variantまたはRelationを保持する。
/// @invariant 不正、未観測および確定済みの状態を同一値へ畳まない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密またはAuthorityを暗黙に保持せず、公開可能な値だけを表す。
/// @compatibility crate内の固定Protocol revisionとRust型境界で利用し、fieldまたはvariantを黙って再解釈しない。
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProviderHomeResponse {
    pub provider: Provider,
    pub nonce: [u8; 32],
    pub is_candidate: bool,
    pub reason: ProviderHomeReason,
    pub principal_observation_flags: u32,
    pub home_observation_flags: u32,
    pub provider_home_identity_hash: [u8; 32],
    pub provider_home_protection_hash: [u8; 32],
    pub local_user_binding_hash: [u8; 32],
    pub stable_logical_home_binding_hash: [u8; 32],
}

/// u16を上限付きで読み取る。
///
/// @responsibility u16を上限付きで読み取る責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn read_u16(bytes: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_le_bytes(
        bytes.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

/// provider home requestを検証済みの値へ変換する。
///
/// @responsibility provider home requestを検証済みの値へ変換する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub fn parse_provider_home_request(bytes: &[u8]) -> Option<ProviderHomeRequest> {
    if bytes.len() != PROVIDER_HOME_REQUEST_BYTES
        || bytes.get(..8)? != PROVIDER_HOME_REQUEST_MAGIC
        || read_u16(bytes, 8)? != PROVIDER_HOME_PROTOCOL_REVISION
        || *bytes.get(11)? != 0
    {
        return None;
    }
    let request = ProviderHomeRequest {
        provider: Provider::parse(*bytes.get(10)?)?,
        nonce: bytes.get(12..44)?.try_into().ok()?,
        mount_source_hash: bytes.get(44..76)?.try_into().ok()?,
    };
    (request.mount_source_hash != [0_u8; 32]).then_some(request)
}

/// provider home responseを固定Protocolへ符号化する。
///
/// @responsibility provider home responseを固定Protocolへ符号化する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub fn encode_provider_home_response(
    response: ProviderHomeResponse,
) -> [u8; PROVIDER_HOME_RESPONSE_BYTES] {
    let mut bytes = [0_u8; PROVIDER_HOME_RESPONSE_BYTES];
    bytes[..8].copy_from_slice(PROVIDER_HOME_RESPONSE_MAGIC);
    bytes[8..10].copy_from_slice(&PROVIDER_HOME_PROTOCOL_REVISION.to_le_bytes());
    bytes[10] = response.provider as u8;
    bytes[11] = u8::from(response.is_candidate);
    bytes[12..44].copy_from_slice(&response.nonce);
    bytes[44..46].copy_from_slice(&(response.reason as u16).to_le_bytes());
    bytes[46..50].copy_from_slice(&response.principal_observation_flags.to_le_bytes());
    bytes[50..54].copy_from_slice(&response.home_observation_flags.to_le_bytes());
    bytes[54..86].copy_from_slice(&response.provider_home_identity_hash);
    bytes[86..118].copy_from_slice(&response.provider_home_protection_hash);
    bytes[118..150].copy_from_slice(&response.local_user_binding_hash);
    bytes[150..182].copy_from_slice(&response.stable_logical_home_binding_hash);
    bytes
}

/// request fromを上限付きで読み取る。
///
/// @responsibility request fromを上限付きで読み取る責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input 宣言された引数を、呼出し側が固定した値またはHandleとして受け取る。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 呼出し側が入力の範囲、Identityおよびlifetimeを検証している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub fn read_request_from(reader: &mut impl Read) -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    reader
        .take(u64::try_from(MAXIMUM_REQUEST_BYTES + 1).unwrap_or(u64::MAX))
        .read_to_end(&mut bytes)?;
    if bytes.len() > MAXIMUM_REQUEST_BYTES {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "request too large",
        ));
    }
    Ok(bytes)
}

/// 不正要求を既存の固定拒否frameで返す。Root観測は受け付けない。
/// @responsibility 観測値やPathを含まない拒否だけを搬送する。
/// @trace ARCH-000008
pub fn write_response_to(writer: &mut impl Write) -> io::Result<()> {
    let mut bytes = [0_u8; RESPONSE_BYTES];
    bytes[..8].copy_from_slice(RESPONSE_MAGIC);
    bytes[8..10].copy_from_slice(&PROTOCOL_REVISION.to_le_bytes());
    bytes[10] = 1;
    bytes[44..46].copy_from_slice(&2_u16.to_le_bytes());
    writer.write_all(&bytes)
}

/// provider home response toを固定形式で書き込む。
///
/// @responsibility provider home response toを固定形式で書き込む責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns 成功、拒否または観測不能を呼出し側が区別できる戻り値を返す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary TypeScript Adapter→固定Binary Protocol→Native Worker。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
pub fn write_provider_home_response_to(
    writer: &mut impl Write,
    response: ProviderHomeResponse,
) -> io::Result<()> {
    writer.write_all(&encode_provider_home_response(response))
}

#[cfg(test)]
mod tests {
    /// 共通入力上限と拒否応答の書込み失敗を維持する。
    /// @trace RCM-UT-016
    #[test]
    fn shared_input_limit_and_rejection_delivery_are_preserved() {
        assert!(read_request_from(&mut &b""[..]).is_ok());
        assert!(read_request_from(&mut &vec![0; MAXIMUM_REQUEST_BYTES][..]).is_ok());
        assert!(read_request_from(&mut &vec![0; MAXIMUM_REQUEST_BYTES + 1][..]).is_err());
        let mut output = Vec::new();
        write_response_to(&mut output).unwrap();
        assert_eq!(output.len(), RESPONSE_BYTES);
        assert_eq!(&output[..8], RESPONSE_MAGIC);
        assert_eq!(output[11], 0);
        assert_eq!(&output[44..46], &2_u16.to_le_bytes());
        let mut unavailable = &mut [][..];
        assert!(write_response_to(&mut unavailable).is_err());
    }
    use super::*;

    fn provider_home_request_bytes(provider: u8) -> [u8; PROVIDER_HOME_REQUEST_BYTES] {
        let mut bytes = [0_u8; PROVIDER_HOME_REQUEST_BYTES];
        bytes[..8].copy_from_slice(PROVIDER_HOME_REQUEST_MAGIC);
        bytes[8..10].copy_from_slice(&PROVIDER_HOME_PROTOCOL_REVISION.to_le_bytes());
        bytes[10] = provider;
        bytes[12..44].copy_from_slice(&[6_u8; 32]);
        bytes[44..76].copy_from_slice(&[7_u8; 32]);
        bytes
    }

    /// provider_home_request_accepts_only_fixed_provider_and_frameを検証する。
    ///
    /// @responsibility provider_home_request_accepts_only_fixed_provider_and_frameの合否判定を所有する。
    /// @trace RCM-UT-016
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus provider_home_request_accepts_only_fixed_provider_and_frameの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
    #[test]
    fn provider_home_request_accepts_only_fixed_provider_and_frame() {
        let request = parse_provider_home_request(&provider_home_request_bytes(2)).unwrap();
        assert_eq!(request.provider, Provider::Claude);
        assert_eq!(request.nonce, [6_u8; 32]);
        assert_eq!(request.mount_source_hash, [7_u8; 32]);
        // 退役したStore・Runtime State値は再解釈せず、初期化bitも拒否する。
        for provider in [1, 2, 3, 4] {
            for flag in [1, 2, u8::MAX] {
                let mut request = provider_home_request_bytes(provider);
                request[11] = flag;
                assert!(parse_provider_home_request(&request).is_none());
            }
        }
        for provider in [0, 3, 4, 5, u8::MAX] {
            assert!(parse_provider_home_request(&provider_home_request_bytes(provider)).is_none());
        }
        let mut trailing = provider_home_request_bytes(1).to_vec();
        trailing.push(0);
        assert!(parse_provider_home_request(&trailing).is_none());
        let mut reserved = provider_home_request_bytes(1);
        reserved[11] = 1;
        assert!(parse_provider_home_request(&reserved).is_none());
        let mut invalid_action = provider_home_request_bytes(3);
        invalid_action[11] = 2;
        assert!(parse_provider_home_request(&invalid_action).is_none());
        let mut legacy = provider_home_request_bytes(1);
        legacy[..8].copy_from_slice(b"CRDDPH00");
        legacy[8..10].copy_from_slice(&0_u16.to_le_bytes());
        assert!(parse_provider_home_request(&legacy).is_none());
        let mut zero_source = provider_home_request_bytes(1);
        zero_source[44..76].fill(0);
        assert!(parse_provider_home_request(&zero_source).is_none());
    }

    /// provider_home_response_is_fixed_and_discloses_no_pathを検証する。
    ///
    /// @responsibility provider_home_response_is_fixed_and_discloses_no_pathの合否判定を所有する。
    /// @trace RCM-UT-016
    /// @precondition Test moduleが構築するfixtureと入力を使用する。
    /// @stimulus provider_home_response_is_fixed_and_discloses_no_pathの対象操作を実行する。
    /// @observation 結果、状態、Effectおよび終了後条件を観測する。
    /// @oracle Test本文のassertionが期待条件を満たす。
    /// @cleanup Test本文またはDrop実装が作成資源を清掃する。
    /// @boundary N/A: Domain Outcome／IssueとSurface Adapterは外部実行境界を持たない。
    #[test]
    fn provider_home_response_is_fixed_and_discloses_no_path() {
        let response = encode_provider_home_response(ProviderHomeResponse {
            provider: Provider::Codex,
            nonce: [5_u8; 32],
            is_candidate: true,
            reason: ProviderHomeReason::ObservationCandidate,
            principal_observation_flags: PRINCIPAL_PRIMARY_TOKEN,
            home_observation_flags: PROVIDER_HOME_DIRECTORY | PROVIDER_HOME_DACL_PROTECTED,
            provider_home_identity_hash: [1_u8; 32],
            provider_home_protection_hash: [2_u8; 32],
            local_user_binding_hash: [3_u8; 32],
            stable_logical_home_binding_hash: [4_u8; 32],
        });
        assert_eq!(response.len(), PROVIDER_HOME_RESPONSE_BYTES);
        assert_eq!(&response[..8], PROVIDER_HOME_RESPONSE_MAGIC);
        assert_eq!(&response[12..44], &[5_u8; 32]);
        assert_eq!(&response[54..86], &[1_u8; 32]);
        assert_eq!(&response[86..118], &[2_u8; 32]);
        assert_eq!(&response[118..150], &[3_u8; 32]);
        assert_eq!(&response[150..182], &[4_u8; 32]);
        assert!(!response.windows(3).any(|window| window == b"C:\\"));
    }
}
