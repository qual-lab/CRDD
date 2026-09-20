/**
 * Repository-localおよびCROS Runtime Dataの公開境界。
 * @packageDocumentation
 * @responsibility Runtime Path、Manifest、Trust Policy、一時Operationを安全に管理する。
 * @trace ARCH-000011
 * @boundary 検証済みRepository RootおよびOS管理Runtime Rootと利用側の境界。
 * @effect 許可されたRuntime Root内にDirectoryまたは一時Operationを作成・更新し得る。
 * @concurrency 同じOperation Identityの所有世代と排他状態を検証する。
 */
export {
  CROS_DIRECTORY_ID,
  CROS_TRUST_POLICY_SCHEMA,
  REPOSITORY_MANIFEST_SCHEMA,
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
  type CrosTrustPolicy,
  type RepositoryManifest,
} from "./core/runtime-data-contract.ts";
export {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
  VERIFICATION_RELATIVE_PATH,
  ensureRepositoryRuntimeDataArea,
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
  RepositoryRuntimeDataAreaBlockedError,
  resolveCrosRuntimeRoots,
  resolveRepositoryRuntimeDataPaths,
  resolveRepositoryRuntimeDataPathsFromWorkingDirectory,
  type RepositoryRuntimeArea,
} from "./platform/runtime-data-path-resolver.ts";
export {
  createTemporaryOperation,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  verifyTemporaryOperationEvidencePromotion,
  type TemporaryEvidencePromotionReceipt,
  type TemporaryOperationCapability,
  type TemporaryOperationRecoveryReference,
} from "./store/temporary-operation-store.ts";
