//! Docker Desktopの実行物検証と限定Host操作を所有する。
//!
//! @responsibility 固定Docker artifactのPublisher検証と限定Host修復・再起動を責務別Moduleへ接続する。
//! @trace ARCH-000008
//! @trace ARCH-000014
//! @boundary Native WorkerとWindows署名検証APIの間。

mod identity;
pub(crate) mod publisher;
pub(crate) mod repair;
