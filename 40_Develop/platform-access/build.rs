fn main() {
    println!("cargo:rerun-if-env-changed=CRDD_NATIVE_WORKER_SHA256");
    if std::env::var_os("CRDD_NATIVE_WORKER_SHA256").is_none() {
        println!(
            "cargo:rustc-env=CRDD_NATIVE_WORKER_SHA256={}",
            "0".repeat(64)
        );
    }
}
