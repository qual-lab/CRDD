#[path = "../src/native_bootstrap_core.rs"]
mod native_bootstrap_core;

fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().collect()
}

#[test]
fn accepts_only_the_revision_two_raw_command_line_grammar() {
    for value in [
        r"C:\release\coordinator.exe provision",
        r#""C:\release path\coordinator.exe" provision"#,
        "\t\"C:\\日本語 path\\coordinator.exe\"\tprovision\t",
    ] {
        assert!(native_bootstrap_core::exact_provision_command_line(&wide(
            value
        )));
    }
    for value in [
        "",
        "   ",
        r"C:\release\coordinator.exe",
        r"C:\release\coordinator.exe doctor",
        r"C:\release\coordinator.exe provision extra",
        r"C:\release\coordinator.exe provisioning",
        r#""C:\release path\coordinator.exe provision"#,
        r#""" provision"#,
        r#""C:\release path\coordinator.exe" "provision""#,
        r#"C:\release\"coordinator.exe provision"#,
        "C:\\release\\coordinator.exe pro\u{ff56}ision",
    ] {
        assert!(!native_bootstrap_core::exact_provision_command_line(&wide(
            value
        )));
    }
}

#[test]
fn selects_fixed_non_authority_result_only_for_invalid_input() {
    assert_eq!(
        native_bootstrap_core::response_for_invalid_command_line(&wide(
            r"C:\release\coordinator.exe provision"
        )),
        None,
    );
    assert_eq!(
        native_bootstrap_core::response_for_invalid_command_line(&wide(
            r"C:\release\coordinator.exe doctor"
        )),
        Some(native_bootstrap_core::ARGUMENTS_BLOCKED),
    );
}

#[test]
fn fixed_failure_results_distinguish_each_fail_closed_stage() {
    for (response, reason) in [
        (
            native_bootstrap_core::RELEASE_LAYOUT_BLOCKED,
            "native_provision_fixed_release_layout_invalid",
        ),
        (
            native_bootstrap_core::PROFILE_BLOCKED,
            "native_provision_appcontainer_profile_unavailable",
        ),
        (
            native_bootstrap_core::PROCESS_BLOCKED,
            "native_provision_appcontainer_process_unavailable",
        ),
        (
            native_bootstrap_core::ISOLATION_BLOCKED,
            "native_provision_appcontainer_isolation_unavailable",
        ),
        (
            native_bootstrap_core::RELEASE_TRUST_BLOCKED,
            "native_provision_release_trust_invalid",
        ),
        (
            native_bootstrap_core::WORKER_ARTIFACT_IDENTITY_BLOCKED,
            "native_provision_worker_artifact_identity_invalid",
        ),
        (
            native_bootstrap_core::MANIFEST_ARTIFACT_IDENTITY_BLOCKED,
            "native_provision_manifest_artifact_identity_invalid",
        ),
        (
            native_bootstrap_core::LOCAL_APP_DATA_IDENTITY_BLOCKED,
            "native_provision_local_app_data_identity_invalid",
        ),
        (
            native_bootstrap_core::AUTHENTICODE_TRUST_BLOCKED,
            "native_provision_authenticode_trust_invalid",
        ),
        (
            native_bootstrap_core::SIGNED_MANIFEST_BLOCKED,
            "native_provision_signed_manifest_invalid",
        ),
        (
            native_bootstrap_core::REGISTRY_EFFECT_BLOCKED,
            "native_provision_registry_effect_unavailable",
        ),
        (
            native_bootstrap_core::REQUEST_BLOCKED,
            "native_provision_request_invalid",
        ),
        (
            native_bootstrap_core::WORKER_PRECONNECTION_EXIT_BLOCKED,
            "native_provision_worker_exited_before_connection",
        ),
        (
            native_bootstrap_core::WORKER_ARGUMENTS_BLOCKED,
            "native_provision_worker_arguments_rejected",
        ),
        (
            native_bootstrap_core::WORKER_PIPE_OPEN_BLOCKED,
            "native_provision_worker_pipe_open_failed",
        ),
        (
            native_bootstrap_core::WORKER_CONNECTION_TIMEOUT_BLOCKED,
            "native_provision_worker_connection_timeout",
        ),
        (
            native_bootstrap_core::WORKER_CONNECTION_IDENTITY_BLOCKED,
            "native_provision_worker_connection_identity_invalid",
        ),
        (
            native_bootstrap_core::WORKER_REQUEST_BLOCKED,
            "native_provision_worker_request_write_failed",
        ),
        (
            native_bootstrap_core::WORKER_WAIT_BLOCKED,
            "native_provision_worker_completion_unavailable",
        ),
        (
            native_bootstrap_core::WORKER_RESPONSE_BLOCKED,
            "native_provision_worker_response_invalid",
        ),
        (
            native_bootstrap_core::SELECTED_USER_UNAVAILABLE_BLOCKED,
            "native_provision_selected_user_unavailable",
        ),
        (
            native_bootstrap_core::SELECTED_USER_MISMATCH_BLOCKED,
            "native_provision_selected_user_mismatch",
        ),
        (
            native_bootstrap_core::SELECTED_USER_REOBSERVATION_UNAVAILABLE_BLOCKED,
            "native_provision_selected_user_reobservation_unavailable",
        ),
        (
            native_bootstrap_core::SELECTED_USER_REOBSERVATION_MISMATCH_BLOCKED,
            "native_provision_selected_user_reobservation_mismatch",
        ),
        (
            native_bootstrap_core::PROCESS_CREATED_BLOCKED,
            "native_provision_created_process_rejected",
        ),
        (
            native_bootstrap_core::PROCESS_MANUAL_RECOVERY_BLOCKED,
            "native_provision_process_tree_recovery_unconfirmed",
        ),
        (
            native_bootstrap_core::WORKER_MANUAL_RECOVERY_BLOCKED,
            "native_provision_process_tree_recovery_unconfirmed",
        ),
        (
            native_bootstrap_core::REGISTRY_PRECONDITION_MANUAL_RECOVERY_BLOCKED,
            "native_provision_registry_recovery_unconfirmed",
        ),
        (
            native_bootstrap_core::REGISTRY_PROCESS_MANUAL_RECOVERY_BLOCKED,
            "native_provision_registry_recovery_unconfirmed",
        ),
        (
            native_bootstrap_core::REGISTRY_CREATED_PROCESS_MANUAL_RECOVERY_BLOCKED,
            "native_provision_registry_recovery_unconfirmed",
        ),
        (
            native_bootstrap_core::REGISTRY_WORKER_MANUAL_RECOVERY_BLOCKED,
            "native_provision_registry_recovery_unconfirmed",
        ),
        (
            native_bootstrap_core::SUPERVISOR_IMAGE_BLOCKED,
            "native_provision_supervisor_loaded_image_binding_unavailable",
        ),
    ] {
        let response = std::str::from_utf8(response).expect("fixed response is UTF-8");
        assert!(response.contains("\"contractRevision\":2"));
        assert!(response.contains(reason));
        assert!(response.contains("\"runtimeAuthorityConferred\":false"));
        assert!(response.ends_with('\n'));
    }
}

#[test]
fn platform_access_frame_requires_exact_declared_length() {
    let mut request = vec![0_u8; 63];
    request[..8].copy_from_slice(b"CRDDPA03");
    request[8..10].copy_from_slice(&3_u16.to_le_bytes());
    request[10] = 1;
    request[11] = 2;
    request[12..44].copy_from_slice(&[7_u8; 32]);
    request[56..60].copy_from_slice(&3_u32.to_le_bytes());
    request[60..].copy_from_slice(b"C:\\");
    assert!(native_bootstrap_core::exact_platform_access_frame(&request));

    for invalid in [
        &request[..59],
        &request[..62],
        &[request.as_slice(), &[0]].concat(),
    ] {
        assert!(!native_bootstrap_core::exact_platform_access_frame(invalid));
    }
    request[..8].copy_from_slice(b"CRDDPA02");
    assert!(!native_bootstrap_core::exact_platform_access_frame(
        &request
    ));
}

#[test]
fn supervisor_and_worker_share_the_exact_windows_path_subset() {
    for path in [
        "C:\\CON",
        "C:\\con.txt",
        "C:\\CLOCK$",
        "C:\\CONIN$.txt",
        "C:\\COM9.log",
        "C:\\LPT¹.txt",
        "C:\\CONıN$",
        "C:\\CLOCK$.log",
        "C:\\root\\..",
        "C:\\root\\child ",
    ] {
        assert!(!native_bootstrap_core::supported_windows_path_bytes(
            path.as_bytes()
        ));
        let mut request = vec![0_u8; 60 + path.len()];
        request[..8].copy_from_slice(b"CRDDPA03");
        request[8..10].copy_from_slice(&3_u16.to_le_bytes());
        request[10] = 1;
        request[11] = 2;
        request[12..44].copy_from_slice(&[7_u8; 32]);
        request[56..60].copy_from_slice(&(path.len() as u32).to_le_bytes());
        request[60..].copy_from_slice(path.as_bytes());
        assert!(native_bootstrap_core::parse_platform_access_frame(&request).is_none());
    }
    for path in ["C:\\", "C:\\root", "C:\\通常", "C:\\CONSOLE"] {
        assert!(native_bootstrap_core::supported_windows_path_bytes(
            path.as_bytes()
        ));
    }
}

#[test]
fn response_is_exactly_bound_to_request_and_exit_state() {
    let request = native_bootstrap_core::RequestBinding {
        root_role: 2,
        nonce: [7_u8; 32],
    };
    let mut response = [0_u8; 86];
    response[..8].copy_from_slice(b"CRDDPR03");
    response[8..10].copy_from_slice(&3_u16.to_le_bytes());
    response[10] = request.root_role;
    response[11] = 1;
    response[12..44].copy_from_slice(&request.nonce);
    response[44..46].copy_from_slice(&100_u16.to_le_bytes());
    response[46..50].copy_from_slice(&0x1ff_u32.to_le_bytes());
    response[50..82].copy_from_slice(&[8_u8; 32]);
    response[82..86].copy_from_slice(&1_u32.to_le_bytes());
    assert!(native_bootstrap_core::exact_platform_access_response(
        &response, request, 0
    ));

    for offset in [8, 10, 11, 12, 44, 49, 83] {
        let mut changed = response;
        changed[offset] ^= 1;
        assert!(!native_bootstrap_core::exact_platform_access_response(
            &changed, request, 0
        ));
    }
    let mut zero_hash = response;
    zero_hash[50..82].fill(0);
    assert!(!native_bootstrap_core::exact_platform_access_response(
        &zero_hash, request, 0
    ));
    let mut trailing = response.to_vec();
    trailing.push(0);
    assert!(!native_bootstrap_core::exact_platform_access_response(
        &trailing, request, 0
    ));
    assert!(!native_bootstrap_core::exact_platform_access_response(
        &response, request, 2
    ));
}
