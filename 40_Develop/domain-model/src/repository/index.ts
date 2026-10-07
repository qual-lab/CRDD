/**
 * 検証済みRepositoryの読取り専用公開境界。
 * @packageDocumentation
 * @responsibility Repository観測の型と操作だけを明示公開する。
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @boundary Repository Rootと読取り利用側の境界。
 */
export type {
  RepositoryDirectoryEntry,
  RepositoryDirectoryObservation,
  RepositoryEntryKind,
  RepositoryFileObservation,
  RepositoryObservationPort,
  RepositoryRootCapability,
} from "./types.ts";
export { createFilesystemRepositoryObservationPort } from "./repository-observation.ts";
export type {
  RepositoryRuntimeArea,
  RepositoryRuntimeDataAreaObservation,
  CrosRootInput,
} from "./types.ts";
export {
  resolveRepositoryRuntimeDataPaths,
  resolveRepositoryRuntimeDataPathsFromWorkingDirectory,
  observeRepositoryRuntimeDataArea,
  resolveCrosRuntimeRoots,
} from "./runtime-data-path-resolver.ts";
export {
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
} from "./runtime-area-result.ts";
export {
  type RealityRepositoryObservationIssue,
  type RealitySymbolRepositoryObservation,
  observeRealitySymbolRepository,
} from "./reality-symbol-repository-observer.ts";
