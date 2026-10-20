//! Platform Access Native Workerへ固定Build Identityを埋め込む。
//!
//! @responsibility Release workflowが渡すNative Worker hashをcompile-time環境へ結合し、未指定開発Buildでは非Release値を使用する。
//! @trace ARCH-000008

/// Release Build Identityの実行入口を開始する。
///
/// @responsibility Release Build Identityの実行入口を開始する責務を所有し、観測不能または不正な入力を成功へ畳まない。
/// @trace ARCH-000008
/// @input N/A: 呼出し引数を持たない。
/// @returns N/A: 戻り値を公開せず、終了状態またはProcess exitで結果を示す。
/// @precondition 固定Build／Runtime構成が成立している。
/// @postcondition 入力以外のAuthorityを新設せず、判定結果を安全側に確定する。
/// @effect N/A: 局所変換だけを行い、外部または共有Effectを発行しない。
/// @failure 不正入力、OS API失敗または観測不能を成功値へ畳まず、拒否または失敗として返す。
/// @invariant 検証していないPath、Handle、PublisherまたはProcessへAuthorityを拡張しない。
/// @boundary Cargo Build→固定Native Worker Identity。
/// @security 秘密値を出力せず、IdentityとAuthorityを別の観測として扱う。
/// @concurrency N/A: 共有可変状態を持たない同期処理である。
fn main() {
    println!("cargo:rerun-if-env-changed=CRDD_NATIVE_WORKER_SHA256");
    if std::env::var_os("CRDD_NATIVE_WORKER_SHA256").is_none() {
        println!(
            "cargo:rustc-env=CRDD_NATIVE_WORKER_SHA256={}",
            "0".repeat(64)
        );
    }
}
