//! Host Namespaceの保護付き初期化をWindows実装へ接続する。
//!
//! @responsibility 固定Nativeの技術契約だけを所有し、清掃の許可判断を行わない。
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @boundary Native WorkerとWindows APIの間。

#[cfg(windows)]
#[path = "windows/host_namespace.rs"]
#[allow(dead_code)]
pub(crate) mod host_namespace;
#[cfg(windows)]
#[path = "windows/protected_file.rs"]
#[allow(dead_code)]
pub(crate) mod protected_file;
