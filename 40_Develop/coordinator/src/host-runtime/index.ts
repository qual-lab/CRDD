/**
 * 上位状態を読み込まないHost保存排他の公開入口。
 *
 * @packageDocumentation
 * @responsibility Orchestratorの保存Ownerへ既存OS排他を提供し、業務状態やWriterを所有しない。
 * @trace ARCH-000004
 */
export { acquireRuntimeOwnedProjectRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";
