use std::io::{self, Read, Write};

pub const PROTOCOL_REVISION: u16 = 3;
pub const PROVIDER_HOME_PROTOCOL_REVISION: u16 = 3;
pub const MAXIMUM_REQUEST_BYTES: usize = 65_536;
pub const MAXIMUM_PATH_BYTES: usize = 4_096;
const REQUEST_MAGIC: &[u8; 8] = b"CRDDPA03";
const RESPONSE_MAGIC: &[u8; 8] = b"CRDDPR03";
const PROVIDER_HOME_REQUEST_MAGIC: &[u8; 8] = b"CRDDPH02";
const PROVIDER_HOME_RESPONSE_MAGIC: &[u8; 8] = b"CRDDHO02";
const REQUEST_HEADER_BYTES: usize = 60;
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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum RootRole {
    Runtime = 1,
    Authority = 2,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum Provider {
    Codex = 1,
    Claude = 2,
    CandidateStore = 3,
    RuntimeState = 4,
}

impl Provider {
    fn parse(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::Codex),
            2 => Some(Self::Claude),
            3 => Some(Self::CandidateStore),
            4 => Some(Self::RuntimeState),
            _ => None,
        }
    }

    pub fn directory_name(self) -> &'static str {
        match self {
            Self::Codex => "codex",
            Self::Claude => "claude",
            Self::CandidateStore => "CandidateStore",
            Self::RuntimeState => "RuntimeState",
        }
    }
}

impl RootRole {
    fn parse(value: u8) -> Option<Self> {
        match value {
            1 => Some(Self::Runtime),
            2 => Some(Self::Authority),
            _ => None,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FileIdentity {
    pub volume_serial_number: u32,
    pub file_index_high: u32,
    pub file_index_low: u32,
}

#[derive(Debug, Eq, PartialEq)]
pub struct Request {
    pub root_role: RootRole,
    pub nonce: [u8; 32],
    pub expected_identity: FileIdentity,
    pub path: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ProviderHomeRequest {
    pub provider: Provider,
    pub initialize_if_missing: bool,
    pub nonce: [u8; 32],
    pub mount_source_hash: [u8; 32],
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u16)]
pub enum Reason {
    #[cfg(not(windows))]
    UnsupportedPlatform = 1,
    InvalidRequest = 2,
    RootOpenFailed = 3,
    RootIdentityMismatch = 4,
    RootReparseRejected = 5,
    SecurityDescriptorUnavailable = 6,
    ProcessTokenUnavailable = 7,
    AccessCheckFailed = 8,
    ObservationCandidate = 100,
}

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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Response {
    pub root_role: RootRole,
    pub nonce: [u8; 32],
    pub is_candidate: bool,
    pub reason: Reason,
    pub access_mask: u32,
    pub runtime_principal_identity_hash: [u8; 32],
    pub principal_observation_flags: u32,
}

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

fn read_u16(bytes: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_le_bytes(
        bytes.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn read_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_le_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

fn limited_uppercase_units(character: char) -> &'static [char] {
    match character {
        'a' => &['A'],
        'b' => &['B'],
        'c' => &['C'],
        'd' => &['D'],
        'e' => &['E'],
        'f' => &['F'],
        'g' => &['G'],
        'h' => &['H'],
        'i' => &['I'],
        'j' => &['J'],
        'k' => &['K'],
        'l' => &['L'],
        'm' => &['M'],
        'n' => &['N'],
        'o' => &['O'],
        'p' => &['P'],
        'q' => &['Q'],
        'r' => &['R'],
        's' => &['S'],
        't' => &['T'],
        'u' => &['U'],
        'v' => &['V'],
        'w' => &['W'],
        'x' => &['X'],
        'y' => &['Y'],
        'z' => &['Z'],
        'ß' => &['S', 'S'],
        'ı' => &['I'],
        'ſ' => &['S'],
        'K' => &['K'],
        'ﬀ' => &['F', 'F'],
        'ﬁ' => &['F', 'I'],
        'ﬂ' => &['F', 'L'],
        'ﬃ' => &['F', 'F', 'I'],
        'ﬄ' => &['F', 'F', 'L'],
        'ﬅ' | 'ﬆ' => &['S', 'T'],
        _ => &[],
    }
}

fn limited_uppercase_equals(value: &str, expected: &str) -> bool {
    let mut expected = expected.chars();
    for character in value.chars() {
        let mapped = limited_uppercase_units(character);
        if mapped.is_empty() {
            if expected.next() != Some(character) {
                return false;
            }
        } else {
            for unit in mapped {
                if expected.next() != Some(*unit) {
                    return false;
                }
            }
        }
    }
    expected.next().is_none()
}

fn reserved_windows_basename(segment: &str) -> bool {
    let basename = segment
        .split('.')
        .next()
        .unwrap_or("")
        .trim_end_matches(['.', ' ']);
    [
        "CON", "PRN", "AUX", "NUL", "CLOCK$", "CONIN$", "CONOUT$", "COM1", "COM2", "COM3", "COM4",
        "COM5", "COM6", "COM7", "COM8", "COM9", "COM¹", "COM²", "COM³", "LPT1", "LPT2", "LPT3",
        "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9", "LPT¹", "LPT²", "LPT³",
    ]
    .iter()
    .any(|expected| limited_uppercase_equals(basename, expected))
}

fn is_supported_windows_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_uppercase()
        && bytes[1] == b':'
        && bytes[2] == b'\\'
        && (bytes.len() == 3 || bytes.last() != Some(&b'\\'))
        && !bytes.contains(&0)
        && (bytes.len() == 3
            || path[3..].split('\\').all(|segment| {
                !segment.is_empty()
                    && segment != "."
                    && segment != ".."
                    && !segment.ends_with(['.', ' '])
                    && !segment.chars().any(|character| {
                        character <= '\u{001f}'
                            || character == '\u{007f}'
                            || matches!(character, '<' | '>' | ':' | '"' | '/' | '|' | '?' | '*')
                    })
                    && !reserved_windows_basename(segment)
            }))
}

pub fn parse_request(bytes: &[u8]) -> Option<Request> {
    if bytes.len() < REQUEST_HEADER_BYTES
        || bytes.len() > MAXIMUM_REQUEST_BYTES
        || bytes.get(..8)? != REQUEST_MAGIC
        || read_u16(bytes, 8)? != PROTOCOL_REVISION
        || *bytes.get(10)? != 1
    {
        return None;
    }
    let root_role = RootRole::parse(*bytes.get(11)?)?;
    let nonce = bytes.get(12..44)?.try_into().ok()?;
    let expected_identity = FileIdentity {
        volume_serial_number: read_u32(bytes, 44)?,
        file_index_high: read_u32(bytes, 48)?,
        file_index_low: read_u32(bytes, 52)?,
    };
    let path_length = usize::try_from(read_u32(bytes, 56)?).ok()?;
    if path_length == 0
        || path_length > MAXIMUM_PATH_BYTES
        || bytes.len() != REQUEST_HEADER_BYTES.checked_add(path_length)?
    {
        return None;
    }
    let path = std::str::from_utf8(bytes.get(REQUEST_HEADER_BYTES..)?)
        .ok()?
        .to_owned();
    if path.contains('\0') || !is_supported_windows_path(&path) {
        return None;
    }
    Some(Request {
        root_role,
        nonce,
        expected_identity,
        path,
    })
}

pub fn parse_provider_home_request(bytes: &[u8]) -> Option<ProviderHomeRequest> {
    if bytes.len() != PROVIDER_HOME_REQUEST_BYTES
        || bytes.get(..8)? != PROVIDER_HOME_REQUEST_MAGIC
        || read_u16(bytes, 8)? != PROVIDER_HOME_PROTOCOL_REVISION
    {
        return None;
    }
    let request = ProviderHomeRequest {
        provider: Provider::parse(*bytes.get(10)?)?,
        initialize_if_missing: match *bytes.get(11)? {
            0 => false,
            1 => true,
            _ => return None,
        },
        nonce: bytes.get(12..44)?.try_into().ok()?,
        mount_source_hash: bytes.get(44..76)?.try_into().ok()?,
    };
    (request.mount_source_hash != [0_u8; 32]
        && (!request.initialize_if_missing
            || matches!(
                request.provider,
                Provider::CandidateStore | Provider::RuntimeState
            )))
    .then_some(request)
}

pub fn encode_response(response: Response) -> [u8; RESPONSE_BYTES] {
    let mut bytes = [0_u8; RESPONSE_BYTES];
    bytes[..8].copy_from_slice(RESPONSE_MAGIC);
    bytes[8..10].copy_from_slice(&PROTOCOL_REVISION.to_le_bytes());
    bytes[10] = response.root_role as u8;
    bytes[11] = u8::from(response.is_candidate);
    bytes[12..44].copy_from_slice(&response.nonce);
    bytes[44..46].copy_from_slice(&(response.reason as u16).to_le_bytes());
    bytes[46..50].copy_from_slice(&response.access_mask.to_le_bytes());
    bytes[50..82].copy_from_slice(&response.runtime_principal_identity_hash);
    bytes[82..86].copy_from_slice(&response.principal_observation_flags.to_le_bytes());
    bytes
}

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

pub fn read_framed_request_from(reader: &mut impl Read) -> io::Result<Vec<u8>> {
    let mut bytes = vec![0_u8; REQUEST_HEADER_BYTES];
    reader.read_exact(&mut bytes)?;
    let path_length = usize::try_from(u32::from_le_bytes(
        bytes[56..60].try_into().expect("fixed request header"),
    ))
    .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "path length"))?;
    if path_length == 0 || path_length > MAXIMUM_PATH_BYTES {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "path length"));
    }
    bytes.resize(
        REQUEST_HEADER_BYTES
            .checked_add(path_length)
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "request size"))?,
        0,
    );
    reader.read_exact(&mut bytes[REQUEST_HEADER_BYTES..])?;
    Ok(bytes)
}

pub fn write_response_to(writer: &mut impl Write, response: Response) -> io::Result<()> {
    writer.write_all(&encode_response(response))
}

pub fn write_provider_home_response_to(
    writer: &mut impl Write,
    response: ProviderHomeResponse,
) -> io::Result<()> {
    writer.write_all(&encode_provider_home_response(response))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request_bytes(path: &[u8]) -> Vec<u8> {
        let mut bytes = Vec::with_capacity(REQUEST_HEADER_BYTES + path.len());
        bytes.extend_from_slice(REQUEST_MAGIC);
        bytes.extend_from_slice(&PROTOCOL_REVISION.to_le_bytes());
        bytes.push(1);
        bytes.push(RootRole::Authority as u8);
        bytes.extend_from_slice(&[7_u8; 32]);
        bytes.extend_from_slice(&11_u32.to_le_bytes());
        bytes.extend_from_slice(&12_u32.to_le_bytes());
        bytes.extend_from_slice(&13_u32.to_le_bytes());
        bytes.extend_from_slice(&u32::try_from(path.len()).unwrap().to_le_bytes());
        bytes.extend_from_slice(path);
        bytes
    }

    fn provider_home_request_bytes(provider: u8) -> [u8; PROVIDER_HOME_REQUEST_BYTES] {
        let mut bytes = [0_u8; PROVIDER_HOME_REQUEST_BYTES];
        bytes[..8].copy_from_slice(PROVIDER_HOME_REQUEST_MAGIC);
        bytes[8..10].copy_from_slice(&PROVIDER_HOME_PROTOCOL_REVISION.to_le_bytes());
        bytes[10] = provider;
        bytes[12..44].copy_from_slice(&[6_u8; 32]);
        bytes[44..76].copy_from_slice(&[7_u8; 32]);
        bytes
    }

    #[test]
    fn parses_exact_request() {
        let request = parse_request(&request_bytes(b"C:\\root")).unwrap();
        assert_eq!(request.root_role, RootRole::Authority);
        assert_eq!(request.nonce, [7_u8; 32]);
        assert_eq!(request.expected_identity.volume_serial_number, 11);
        assert_eq!(request.expected_identity.file_index_high, 12);
        assert_eq!(request.expected_identity.file_index_low, 13);
        assert_eq!(request.path, "C:\\root");
    }

    #[test]
    fn rejects_exact_revision_two_request_without_aliasing() {
        let mut legacy = request_bytes(b"C:\\root");
        legacy[..8].copy_from_slice(b"CRDDPA02");
        legacy[8..10].copy_from_slice(&2_u16.to_le_bytes());
        assert!(parse_request(&legacy).is_none());
    }

    #[test]
    fn rejects_unsupported_or_oversized_request_framing() {
        let mut trailing = request_bytes(b"C:\\root");
        trailing.push(0);
        assert!(parse_request(&trailing).is_none());
        assert!(parse_request(&request_bytes(b"")).is_none());
        assert!(parse_request(&request_bytes(b"C:\0root")).is_none());
        assert!(parse_request(&request_bytes(b"c:\\root")).is_none());
        assert!(parse_request(&request_bytes(b"\\\\server\\share")).is_none());
        assert!(parse_request(&request_bytes(b"C:/root")).is_none());
        assert!(parse_request(&request_bytes(b"C:\\root\\\\child")).is_none());
        for path in [
            "C:\\root\\",
            "C:\\root\\.",
            "C:\\root\\..",
            "C:\\root\\child.",
            "C:\\root\\child ",
            "C:\\root:stream",
            "C:\\root<child",
            "C:\\root\u{007f}child",
            "C:\\CON",
            "C:\\con.txt",
            "C:\\CLOCK$",
            "C:\\CONIN$.txt",
            "C:\\CONOUT$",
            "C:\\COM9.log",
            "C:\\LPT¹.txt",
            "C:\\CON .txt",
            "C:\\COM1 .log",
            "C:\\LPT¹ .x",
            "C:\\CONıN$",
            "C:\\CONıN$ .txt",
            "C:\\CLOCK$.log",
        ] {
            assert!(parse_request(&request_bytes(path.as_bytes())).is_none());
        }
        let maximum_path = format!("C:\\{}", "a".repeat(MAXIMUM_PATH_BYTES - 3));
        assert_eq!(maximum_path.len(), MAXIMUM_PATH_BYTES);
        assert!(parse_request(&request_bytes(maximum_path.as_bytes())).is_some());
        let oversized_path = format!("{maximum_path}a");
        assert!(parse_request(&request_bytes(oversized_path.as_bytes())).is_none());
        assert!(parse_request(&request_bytes("C:\\通常".as_bytes())).is_some());
        assert!(parse_request(&request_bytes("C:\\CONSOLE".as_bytes())).is_some());
    }

    #[test]
    fn response_is_fixed_size_and_does_not_echo_path() {
        let response = encode_response(Response {
            root_role: RootRole::Runtime,
            nonce: [3_u8; 32],
            is_candidate: true,
            reason: Reason::ObservationCandidate,
            access_mask: 0x1ff,
            runtime_principal_identity_hash: [4_u8; 32],
            principal_observation_flags: PRINCIPAL_PRIMARY_TOKEN | PRINCIPAL_INTERACTIVE_GROUP,
        });
        assert_eq!(response.len(), RESPONSE_BYTES);
        assert_eq!(&response[..8], RESPONSE_MAGIC);
        assert_eq!(&response[12..44], &[3_u8; 32]);
        assert_eq!(&response[50..82], &[4_u8; 32]);
        assert_eq!(
            u32::from_le_bytes(response[82..86].try_into().unwrap()),
            PRINCIPAL_PRIMARY_TOKEN | PRINCIPAL_INTERACTIVE_GROUP
        );
        assert!(!response.windows(3).any(|window| window == b"C:\\"));
    }

    #[test]
    fn blocked_response_has_zero_status_reason_and_access_mask() {
        let response = encode_response(Response {
            root_role: RootRole::Authority,
            nonce: [8_u8; 32],
            is_candidate: false,
            reason: Reason::RootIdentityMismatch,
            access_mask: 0,
            runtime_principal_identity_hash: [0_u8; 32],
            principal_observation_flags: 0,
        });
        assert_eq!(response[10], RootRole::Authority as u8);
        assert_eq!(response[11], 0);
        assert_eq!(&response[12..44], &[8_u8; 32]);
        assert_eq!(u16::from_le_bytes(response[44..46].try_into().unwrap()), 4);
        assert_eq!(u32::from_le_bytes(response[46..50].try_into().unwrap()), 0);
        assert_eq!(&response[50..82], &[0_u8; 32]);
        assert_eq!(&response[82..86], &[0_u8; 4]);
    }

    #[test]
    fn provider_home_request_accepts_only_fixed_provider_and_frame() {
        let request = parse_provider_home_request(&provider_home_request_bytes(2)).unwrap();
        assert_eq!(request.provider, Provider::Claude);
        assert!(!request.initialize_if_missing);
        assert_eq!(request.nonce, [6_u8; 32]);
        assert_eq!(request.mount_source_hash, [7_u8; 32]);
        let mut candidate_store = provider_home_request_bytes(3);
        candidate_store[11] = 1;
        let candidate_store = parse_provider_home_request(&candidate_store).unwrap();
        assert_eq!(candidate_store.provider, Provider::CandidateStore);
        assert!(candidate_store.initialize_if_missing);
        let mut runtime_state = provider_home_request_bytes(4);
        runtime_state[11] = 1;
        let runtime_state = parse_provider_home_request(&runtime_state).unwrap();
        assert_eq!(runtime_state.provider, Provider::RuntimeState);
        assert!(runtime_state.initialize_if_missing);
        for provider in [0, 5, u8::MAX] {
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
