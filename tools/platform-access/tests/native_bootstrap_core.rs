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
fn selects_only_fixed_non_authority_result_bytes() {
    assert_eq!(
        native_bootstrap_core::response_for_command_line(&wide(
            r"C:\release\coordinator.exe provision"
        )),
        native_bootstrap_core::PROVISION_BLOCKED,
    );
    assert_eq!(
        native_bootstrap_core::response_for_command_line(&wide(
            r"C:\release\coordinator.exe doctor"
        )),
        native_bootstrap_core::ARGUMENTS_BLOCKED,
    );
}
