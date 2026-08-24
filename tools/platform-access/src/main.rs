mod protocol;

#[allow(dead_code)]
mod native_bootstrap_core;

#[cfg(windows)]
mod windows;

use std::ffi::OsStr;
use std::fs::OpenOptions;
use std::io::{Read, Write};

use protocol::{
    Reason, Response, RootRole, parse_request, read_framed_request_from, read_request_from,
    write_response_to,
};

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

fn execute_bytes(request_bytes: &[u8], writer: &mut impl Write) -> i32 {
    let Some(request) = parse_request(request_bytes) else {
        let _ = write_response_to(writer, invalid_response());
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

fn appcontainer_pipe_argument() -> Result<Option<String>, ()> {
    let mut arguments = std::env::args_os().skip(1);
    let Some(mode) = arguments.next() else {
        return Ok(None);
    };
    if mode != OsStr::new("--appcontainer-pipe") {
        return Err(());
    }
    let Some(pipe) = arguments.next().and_then(|value| value.into_string().ok()) else {
        return Err(());
    };
    if arguments.next().is_some() || !valid_appcontainer_pipe_name(&pipe) {
        return Err(());
    }
    Ok(Some(pipe))
}

fn main() {
    let exit_code = match appcontainer_pipe_argument() {
        Ok(None) => execute(&mut std::io::stdin(), &mut std::io::stdout(), false),
        Ok(Some(pipe_name)) => match OpenOptions::new().read(true).write(true).open(pipe_name) {
            Ok(mut pipe) => match pipe.try_clone() {
                Ok(mut reader) => execute(&mut reader, &mut pipe, true),
                Err(_) => 3,
            },
            Err(_) => 3,
        },
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
