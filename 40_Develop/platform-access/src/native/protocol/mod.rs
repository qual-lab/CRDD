//! Native Workerの固定要求・応答形式を責務別に接続する。
//!
//! @responsibility 退役要求の有界読取りと固定拒否だけを接続する。
//! @trace ARCH-000004
//! @trace ARCH-000008
//! @trace ARCH-000011
//! @boundary CoordinatorとNative Workerの固定binary Protocolの間。

pub(crate) mod access;
