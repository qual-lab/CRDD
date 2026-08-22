use std::io::{self, Read, Write};

pub const PROTOCOL_REVISION: u16 = 3;
pub const MAXIMUM_REQUEST_BYTES: usize = 65_536;
pub const MAXIMUM_PATH_BYTES: usize = 4_096;
const REQUEST_MAGIC: &[u8; 8] = b"CRDDPA03";
const RESPONSE_MAGIC: &[u8; 8] = b"CRDDPR03";
const REQUEST_HEADER_BYTES: usize = 60;
const RESPONSE_BYTES: usize = 86;

pub const PRINCIPAL_PRIMARY_TOKEN: u32 = 1 << 0;
pub const PRINCIPAL_INTERACTIVE_GROUP: u32 = 1 << 1;
pub const PRINCIPAL_SERVICE_GROUP: u32 = 1 << 2;
pub const PRINCIPAL_BATCH_GROUP: u32 = 1 << 3;
pub const PRINCIPAL_NETWORK_GROUP: u32 = 1 << 4;
pub const PRINCIPAL_RESTRICTED_TOKEN: u32 = 1 << 5;
pub const PRINCIPAL_APP_CONTAINER: u32 = 1 << 6;
pub const PRINCIPAL_NONZERO_SESSION: u32 = 1 << 7;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
#[repr(u8)]
pub enum RootRole {
    Runtime = 1,
    Authority = 2,
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
pub struct Response {
    pub root_role: RootRole,
    pub nonce: [u8; 32],
    pub is_candidate: bool,
    pub reason: Reason,
    pub access_mask: u32,
    pub runtime_principal_identity_hash: [u8; 32],
    pub principal_observation_flags: u32,
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

fn is_reserved_windows_basename(segment: &str) -> bool {
    let basename = reserved_name_limited_uppercase(
        segment
            .split('.')
            .next()
            .unwrap_or("")
            .trim_end_matches(['.', ' ']),
    );
    matches!(
        basename.as_str(),
        "CON" | "PRN" | "AUX" | "NUL" | "CLOCK$" | "CONIN$" | "CONOUT$"
    ) || ["COM", "LPT"].iter().any(|prefix| {
        basename.strip_prefix(prefix).is_some_and(|suffix| {
            matches!(
                suffix,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
            )
        })
    })
}

fn reserved_name_limited_uppercase(value: &str) -> String {
    let mut normalized = String::new();
    for character in value.chars() {
        match character {
            'a'..='z' => normalized.push(
                char::from_u32(u32::from(character) - 0x20)
                    .expect("ASCII lowercase mapping must remain valid"),
            ),
            'ß' => normalized.push_str("SS"),
            'ı' => normalized.push('I'),
            'ſ' => normalized.push('S'),
            'K' => normalized.push('K'),
            'ﬀ' => normalized.push_str("FF"),
            'ﬁ' => normalized.push_str("FI"),
            'ﬂ' => normalized.push_str("FL"),
            'ﬃ' => normalized.push_str("FFI"),
            'ﬄ' => normalized.push_str("FFL"),
            'ﬅ' | 'ﬆ' => normalized.push_str("ST"),
            _ => normalized.push(character),
        }
    }
    normalized
}

fn is_supported_windows_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    if bytes.len() < 3
        || bytes[0] < b'A'
        || bytes[0] > b'Z'
        || bytes[1] != b':'
        || bytes[2] != b'\\'
    {
        return false;
    }
    if bytes.len() == 3 {
        return true;
    }
    if path.ends_with('\\') {
        return false;
    }
    path[3..].split('\\').all(|segment| {
        !segment.is_empty()
            && segment != "."
            && segment != ".."
            && !segment.ends_with(['.', ' '])
            && !segment.chars().any(|character| {
                character <= '\u{001f}'
                    || character == '\u{007f}'
                    || matches!(character, '<' | '>' | ':' | '"' | '/' | '|' | '?' | '*')
            })
            && !is_reserved_windows_basename(segment)
    })
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

pub fn read_request() -> io::Result<Vec<u8>> {
    let mut bytes = Vec::new();
    io::stdin()
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

pub fn write_response(response: Response) -> io::Result<()> {
    io::stdout().write_all(&encode_response(response))
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
    fn reserved_name_mapping_is_repository_owned_and_exact() {
        for (lowercase, uppercase) in ('a'..='z').zip('A'..='Z') {
            assert_eq!(
                reserved_name_limited_uppercase(&lowercase.to_string()),
                uppercase.to_string()
            );
        }
        for (source, expected) in [
            ("ß", "SS"),
            ("ı", "I"),
            ("ſ", "S"),
            ("K", "K"),
            ("ﬀ", "FF"),
            ("ﬁ", "FI"),
            ("ﬂ", "FL"),
            ("ﬃ", "FFI"),
            ("ﬄ", "FFL"),
            ("ﬅ", "ST"),
            ("ﬆ", "ST"),
        ] {
            assert_eq!(reserved_name_limited_uppercase(source), expected);
        }
        assert_eq!(reserved_name_limited_uppercase("通常"), "通常");
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
}
