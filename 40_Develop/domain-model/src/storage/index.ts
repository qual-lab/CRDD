/**
 * 用途限定Store Root、Runtime保存領域と一時操作の公開境界。
 * @packageDocumentation
 * @responsibility 検証済みRoot内の保存領域確保、保存排他と一時操作の終了・回復を公開する。
 * @trace ARCH-000011
 * @boundary Repository保存領域と利用側の境界。
 * @effect 公開された保存操作だけが宣言Root内のEffectを発行する。
 * @security 任意PathやFilesystem記録だけから保存Authorityを生成しない。
 */
export {
  createFilesystemStoreRoot,
  type FilesystemStoreLockOwnerAbsenceProof,
  type FilesystemStoreRoot,
  observeFilesystemStoreLockOwnerAbsence,
  recoverFilesystemStoreLock,
  resolveFilesystemStorePath,
  withFilesystemStoreLock,
} from "./filesystem-store-root.ts";
export {
  createCoordinatorRuntimeDataArea,
  ensureRepositoryRuntimeDataArea,
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
} from "./runtime-data-area.ts";
export {
  createTemporaryOperation,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  verifyTemporaryOperationEvidencePromotion,
} from "./temporary-operation-store.ts";
export type {
  TemporaryEvidencePromotionReceipt,
  TemporaryOperationCapability,
  TemporaryOperationRecoveryReference,
} from "./types.ts";
