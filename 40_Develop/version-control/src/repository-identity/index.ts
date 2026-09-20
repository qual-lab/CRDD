/**
 * 検証済みRepository Rootを取得する公開境界。
 * @packageDocumentation
 * @responsibility Repository IdentityとRoot検証結果を利用側へ提供する。
 * @trace ARCH-000002
 * @boundary Filesystem上の開始位置と検証済みRepository Rootの境界。
 */
export {
  describeRepositoryLocationContract,
  REPOSITORY_LOCATION_CONTRACT,
  REPOSITORY_LOCATION_CONTRACT_REVISION,
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  type VerifiedRepositoryRoot,
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../repository-location.ts";
