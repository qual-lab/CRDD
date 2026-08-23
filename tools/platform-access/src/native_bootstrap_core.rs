pub const ISOLATION_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_appcontainer_isolation_unavailable\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const RELEASE_LAYOUT_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_fixed_release_layout_invalid\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const PROFILE_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_appcontainer_profile_unavailable\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const PROCESS_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_appcontainer_process_unavailable\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const PROCESS_CREATED_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_created_process_rejected\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const PROCESS_MANUAL_RECOVERY_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_process_tree_recovery_unconfirmed\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":true,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const WORKER_MANUAL_RECOVERY_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_process_tree_recovery_unconfirmed\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":true,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const REGISTRY_PRECONDITION_MANUAL_RECOVERY_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_registry_recovery_unconfirmed\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":true,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const REGISTRY_PROCESS_MANUAL_RECOVERY_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_registry_recovery_unconfirmed\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":true,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const REGISTRY_CREATED_PROCESS_MANUAL_RECOVERY_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_registry_recovery_unconfirmed\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":true,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const REGISTRY_WORKER_MANUAL_RECOVERY_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_registry_recovery_unconfirmed\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":true,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const REQUEST_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_request_invalid\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const WORKER_PRECONNECTION_EXIT_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_worker_exited_before_connection\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const WORKER_CONNECTION_TIMEOUT_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_worker_connection_timeout\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const WORKER_CONNECTION_IDENTITY_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_worker_connection_identity_invalid\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const WORKER_REQUEST_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_worker_request_write_failed\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const WORKER_WAIT_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_worker_completion_unavailable\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const WORKER_RESPONSE_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_worker_response_invalid\",\"observationAttempted\":false,\"workerSpawnAttempts\":1,\"processEffectIssued\":true,\"helperProcessSpawned\":true,\"helperProcessResumed\":true,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":true,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const ARGUMENTS_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_supervisor_arguments_invalid\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
// Reserved for revision 2 result compatibility. The Coordinator Runtime 1.0
// Minimum Trust Boundary production entrypoint no longer assigns this stage.
pub const SUPERVISOR_IMAGE_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":2,\"status\":\"blocked\",\"reason\":\"native_provision_supervisor_loaded_image_binding_unavailable\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"helperProcessResumed\":false,\"helperExchangeCompleted\":false,\"processTreeTerminationConfirmed\":false,\"manualRecoveryRequired\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";

const PROVISION: &[u16] = &[112, 114, 111, 118, 105, 115, 105, 111, 110];
const REQUEST_HEADER_BYTES: usize = 60;
const MAXIMUM_PATH_BYTES: usize = 4_096;
const RESPONSE_BYTES: usize = 86;
const KNOWN_ACCESS_MASK: u32 = 0x1ff;
const KNOWN_PRINCIPAL_MASK: u32 = 0xff;
const PRINCIPAL_PRIMARY_TOKEN: u32 = 1;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct RequestBinding {
    pub root_role: u8,
    pub nonce: [u8; 32],
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

pub fn supported_windows_path_bytes(path: &[u8]) -> bool {
    let Ok(path_text) = core::str::from_utf8(path) else {
        return false;
    };
    path.len() >= 3
        && path[0].is_ascii_uppercase()
        && path[1] == b':'
        && path[2] == b'\\'
        && (path.len() == 3 || path.last() != Some(&b'\\'))
        && !path.contains(&0)
        && (path.len() == 3
            || path_text[3..].split('\\').all(|segment| {
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

const fn is_separator(value: u16) -> bool {
    value == 0x20 || value == 0x09
}

pub fn exact_provision_command_line(command_line: &[u16]) -> bool {
    let mut offset = 0;
    while offset < command_line.len() && is_separator(command_line[offset]) {
        offset += 1;
    }
    if offset == command_line.len() {
        return false;
    }

    if command_line[offset] == 0x22 {
        offset += 1;
        let program_start = offset;
        while offset < command_line.len() && command_line[offset] != 0x22 {
            offset += 1;
        }
        if offset == program_start || offset == command_line.len() {
            return false;
        }
        offset += 1;
        if offset < command_line.len() && !is_separator(command_line[offset]) {
            return false;
        }
    } else {
        let program_start = offset;
        while offset < command_line.len() && !is_separator(command_line[offset]) {
            if command_line[offset] == 0x22 {
                return false;
            }
            offset += 1;
        }
        if offset == program_start {
            return false;
        }
    }

    while offset < command_line.len() && is_separator(command_line[offset]) {
        offset += 1;
    }
    for expected in PROVISION {
        if offset == command_line.len() || command_line[offset] != *expected {
            return false;
        }
        offset += 1;
    }
    if offset < command_line.len() && !is_separator(command_line[offset]) {
        return false;
    }
    while offset < command_line.len() && is_separator(command_line[offset]) {
        offset += 1;
    }
    offset == command_line.len()
}

pub fn response_for_invalid_command_line(command_line: &[u16]) -> Option<&'static [u8]> {
    (!exact_provision_command_line(command_line)).then_some(ARGUMENTS_BLOCKED)
}

pub fn parse_platform_access_frame(bytes: &[u8]) -> Option<RequestBinding> {
    if bytes.len() < REQUEST_HEADER_BYTES
        || bytes.get(..8) != Some(b"CRDDPA03")
        || read_u16(bytes, 8)? != 3
        || bytes.get(10) != Some(&1)
        || !matches!(bytes.get(11), Some(1 | 2))
    {
        return None;
    }
    let path_length = usize::try_from(read_u32(bytes, 56)?).ok()?;
    if path_length == 0
        || path_length > MAXIMUM_PATH_BYTES
        || bytes.len() != REQUEST_HEADER_BYTES.checked_add(path_length)?
        || !supported_windows_path_bytes(bytes.get(REQUEST_HEADER_BYTES..)?)
    {
        return None;
    }
    Some(RequestBinding {
        root_role: *bytes.get(11)?,
        nonce: bytes.get(12..44)?.try_into().ok()?,
    })
}

#[allow(dead_code)]
pub fn exact_platform_access_frame(bytes: &[u8]) -> bool {
    parse_platform_access_frame(bytes).is_some()
}

pub fn exact_platform_access_response(
    bytes: &[u8],
    request: RequestBinding,
    exit_code: u32,
) -> bool {
    if bytes.len() != RESPONSE_BYTES
        || bytes.get(..8) != Some(b"CRDDPR03")
        || read_u16(bytes, 8) != Some(3)
        || bytes.get(10) != Some(&request.root_role)
        || bytes.get(12..44) != Some(&request.nonce)
    {
        return false;
    }
    let Some(status) = bytes.get(11).copied() else {
        return false;
    };
    let Some(reason) = read_u16(bytes, 44) else {
        return false;
    };
    let Some(access) = read_u32(bytes, 46) else {
        return false;
    };
    let Some(flags) = read_u32(bytes, 82) else {
        return false;
    };
    let hash = &bytes[50..82];
    match (status, exit_code) {
        (1, 0) => {
            reason == 100
                && access & !KNOWN_ACCESS_MASK == 0
                && flags & !KNOWN_PRINCIPAL_MASK == 0
                && flags & PRINCIPAL_PRIMARY_TOKEN != 0
                && hash.iter().any(|byte| *byte != 0)
        }
        (0, 2) => {
            (2..=8).contains(&reason)
                && access == 0
                && flags == 0
                && hash.iter().all(|byte| *byte == 0)
        }
        _ => false,
    }
}
