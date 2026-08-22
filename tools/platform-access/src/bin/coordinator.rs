use std::ffi::OsString;
use std::io::{self, Write};

const PROVISION_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":1,\"status\":\"blocked\",\"reason\":\"native_provision_supervisor_release_binding_not_implemented\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";
const ARGUMENTS_BLOCKED: &[u8] = b"{\"contract\":\"crdd-coordinator/native-provision-supervisor-result\",\"contractRevision\":1,\"status\":\"blocked\",\"reason\":\"native_provision_supervisor_arguments_invalid\",\"observationAttempted\":false,\"workerSpawnAttempts\":0,\"processEffectIssued\":false,\"helperProcessSpawned\":false,\"filesystemEffectIssued\":false,\"networkEffectIssued\":false,\"runtimeAuthorityConferred\":false,\"runtimeCapabilityIssued\":false}\n";

fn exact_provision_argument(mut arguments: impl Iterator<Item = OsString>) -> bool {
    arguments.next().is_some()
        && arguments.next().is_some_and(|value| value == "provision")
        && arguments.next().is_none()
}

fn main() {
    let response = if exact_provision_argument(std::env::args_os()) {
        PROVISION_BLOCKED
    } else {
        ARGUMENTS_BLOCKED
    };
    if io::stdout().write_all(response).is_err() {
        std::process::exit(3);
    }
    std::process::exit(2);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn arguments(values: &[&str]) -> impl Iterator<Item = OsString> {
        values
            .iter()
            .map(|value| OsString::from((*value).to_owned()))
            .collect::<Vec<_>>()
            .into_iter()
    }

    #[test]
    fn accepts_only_exact_provision_argument() {
        assert!(exact_provision_argument(arguments(&[
            "coordinator.exe",
            "provision"
        ])));
        for values in [
            vec![],
            vec!["coordinator.exe"],
            vec!["coordinator.exe", "doctor"],
            vec!["coordinator.exe", "provision", "extra"],
        ] {
            assert!(!exact_provision_argument(arguments(&values)));
        }
    }
}
