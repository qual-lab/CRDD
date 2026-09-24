/**
 * Checker向けRepository観測Adapterの公開境界。
 * @packageDocumentation
 * @responsibility Checkerが必要とする読取り観測だけをVersion Control境界から公開する。
 * @trace ARCH-000002
 * @boundary CheckerとGit Repository観測の境界。
 */
export {
  observeDeclaredNestedRepositoryPaths,
  observeNestedRepository,
  observeRepositoryEntries,
  readFixedSnapshotText,
  type RepositoryEntryObservation,
  resolveRevisionIdentity,
} from "../git/checker-repository-observation-adapter.ts";
