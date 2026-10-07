//! Windowsの所有子Processと終了観測を接続する。
//!
//! @responsibility 宣言したWindows OS責務だけを同Package内の専用Moduleへ接続する。
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @boundary Native WorkerとWindows APIの間。

pub(crate) mod owned_child;
pub(crate) mod principal;
