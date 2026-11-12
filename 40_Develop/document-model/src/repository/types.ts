/**
 * 文書Repositoryの内容観測に必要な値契約。
 * @responsibility File・Directoryの観測と観測不能を区別し、Runtime保存領域を所有しない。
 * @trace ARCH-000008
 * @boundary 文書モデルのRepository観測。
 */
export type RepositoryEntryKind =
  | "file"
  | "directory"
  | "symbolic-link"
  | "other";

export type RepositoryDirectoryEntry = Readonly<{
  name: string;
  kind: RepositoryEntryKind;
}>;

export type RepositoryFileObservation = Readonly<
  | {
      status: "resolved";
      repositoryRelativePath: string;
      targetPath: string;
      source: string;
    }
  | {
      status: "invalid" | "unobservable";
      repositoryRelativePath: string;
      reason: string;
    }
>;

export type RepositoryDirectoryObservation = Readonly<
  | {
      status: "resolved";
      repositoryRelativePath: string;
      targetPath: string;
      entries: readonly RepositoryDirectoryEntry[];
    }
  | {
      status: "invalid" | "unobservable";
      repositoryRelativePath: string;
      reason: string;
    }
>;

export type RepositoryObservationPort = Readonly<{
  observeFile: (repositoryRelativePath: string) => RepositoryFileObservation;
  observeDirectory: (
    repositoryRelativePath: string,
  ) => RepositoryDirectoryObservation;
}>;
