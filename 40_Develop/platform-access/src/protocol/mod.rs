//! Native Workerの固定要求・応答形式を責務別に接続する。
//!
//! @responsibility Root・Homeアクセス、Host Namespace、Host記録の閉じた搬送形式を分ける。
//! @trace ARCH-000004
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @boundary CoordinatorとNative Workerの固定binary Protocolの間。

pub(crate) mod access;
pub(crate) mod host_namespace;
pub(crate) mod host_record;
