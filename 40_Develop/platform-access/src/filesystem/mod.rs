//! Windowsの固定フォルダ・実体観測を接続する。
//!
//! @responsibility 宣言したWindows OS責務だけを同Package内の専用Moduleへ接続する。
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @boundary Native WorkerとWindows APIの間。

pub(crate) mod host_namespace;
// 旧windows Moduleに適用されていたfixture専用処理の許容を移管先へ保持する。
#[allow(dead_code)]
pub(crate) mod host_record;
pub(crate) mod protected_file;
pub(crate) mod protection;
pub(crate) mod protected_root;
#[allow(dead_code)]
pub(crate) mod root_observation;
pub(crate) mod windows_directory;
