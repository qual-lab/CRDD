pub const PROVISION_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":1,\"status\":\"blocked\",\"reason\":\"native_provision_supervisor_release_binding_not_implemented\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
pub const ARGUMENTS_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":1,\"status\":\"blocked\",\"reason\":\"native_provision_supervisor_arguments_invalid\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";

const PROVISION: &[u16] = &[112, 114, 111, 118, 105, 115, 105, 111, 110];

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

pub fn response_for_command_line(command_line: &[u16]) -> &'static [u8] {
    if exact_provision_command_line(command_line) {
        PROVISION_BLOCKED
    } else {
        ARGUMENTS_BLOCKED
    }
}
