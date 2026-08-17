mod protocol;

#[cfg(windows)]
mod windows;

use protocol::{Reason, Response, RootRole, parse_request, read_request, write_response};

fn invalid_response() -> Response {
    Response {
        root_role: RootRole::Runtime,
        nonce: [0_u8; 32],
        is_candidate: false,
        reason: Reason::InvalidRequest,
        access_mask: 0,
        runtime_principal_identity_hash: [0_u8; 32],
    }
}

fn main() {
    let request_bytes = match read_request() {
        Ok(bytes) => bytes,
        Err(_) => {
            let _ = write_response(invalid_response());
            std::process::exit(2);
        }
    };
    let Some(request) = parse_request(&request_bytes) else {
        let _ = write_response(invalid_response());
        std::process::exit(2);
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
    };

    if write_response(response).is_err() {
        std::process::exit(3);
    }
    if !response.is_candidate {
        std::process::exit(2);
    }
}
