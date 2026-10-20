//! Windowsの固定フォルダ・実体観測を接続する。
//!
//! @responsibility 宣言したWindows OS責務だけを同Package内の専用Moduleへ接続する。
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @boundary Native WorkerとWindows APIの間。

#[cfg(windows)]
#[path = "windows/entry_observation.rs"]
pub(crate) mod entry_observation;
#[cfg(windows)]
#[path = "windows/protected_root.rs"]
pub(crate) mod protected_root;
#[cfg(windows)]
#[path = "windows/protection.rs"]
pub(crate) mod protection;
#[allow(dead_code)]
#[cfg(windows)]
#[path = "windows/root_observation.rs"]
pub(crate) mod root_observation;
#[cfg(windows)]
#[path = "windows/windows_directory.rs"]
pub(crate) mod windows_directory;
