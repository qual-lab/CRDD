/**
 * WorkbenchのRepository操作要求を定義する。
 * @responsibility UI／HTTPの操作名を所有し、Git技術APIへ業務上の操作集合を持ち込まない。
 * @trace ARCH-000009
 * @trace ARCH-000012
 * @boundary 既存Form／JSONの形状を維持する。新しい実行許可を発行しない。
 */
export type RepositoryActionRequest =
  | Readonly<{ operation: "prepare"; paths: readonly string[] }>
  | Readonly<{ operation: "unprepare"; paths: readonly string[] }>
  | Readonly<{ operation: "create_revision"; message: string }>
  | Readonly<{
      operation: "publish_revision";
      destination: string;
      branch: string;
      revisionIdentity: string;
      humanConfirmed: true;
    }>;
