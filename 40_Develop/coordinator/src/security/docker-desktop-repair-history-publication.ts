export type RepairHistoryPublicationFaultPoint =
  | "after_link_before_directory_commit"
  | "after_first_directory_commit_before_unlink"
  | "at_unlink"
  | "after_unlink_before_directory_commit";

export type RepairHistoryPublicationOperations = Readonly<{
  present: (value: string) => boolean | null;
  stableBytes: (value: string) => Buffer | null;
  sameRegularFileIdentity: (left: string, right: string) => boolean;
  openExclusive: (value: string) => number;
  write: (descriptor: number, bytes: Buffer) => void;
  sync: (descriptor: number) => void;
  close: (descriptor: number) => void;
  link: (source: string, target: string) => void;
  unlink: (value: string) => void;
  commitDirectory: (directory: string) => void;
  observeBeforeLink: () => void;
  injectFault: (point: RepairHistoryPublicationFaultPoint) => void;
}>;

export function publishRepairHistoryFileUsingOperations(
  operations: RepairHistoryPublicationOperations,
  directory: string,
  target: string,
  preparation: string,
  bytes: Buffer,
  maximumBytes: number,
): boolean {
  if (bytes.length > maximumBytes) return false;
  try {
    const targetPresent = operations.present(target);
    const preparationPresent = operations.present(preparation);
    if (targetPresent === null || preparationPresent === null) return false;
    if (targetPresent) {
      if (operations.stableBytes(target)?.equals(bytes) !== true) return false;
      if (!preparationPresent) {
        operations.commitDirectory(directory);
        return operations.stableBytes(target)?.equals(bytes) === true;
      }
      if (
        operations.stableBytes(preparation)?.equals(bytes) !== true ||
        !operations.sameRegularFileIdentity(target, preparation)
      )
        return false;
      operations.commitDirectory(directory);
      operations.injectFault("after_first_directory_commit_before_unlink");
      operations.injectFault("at_unlink");
      operations.unlink(preparation);
      operations.injectFault("after_unlink_before_directory_commit");
      operations.commitDirectory(directory);
      return (
        operations.present(preparation) === false &&
        operations.stableBytes(target)?.equals(bytes) === true
      );
    }
    if (preparationPresent) {
      if (operations.stableBytes(preparation)?.equals(bytes) !== true)
        return false;
    } else {
      const descriptor = operations.openExclusive(preparation);
      try {
        operations.write(descriptor, bytes);
        operations.sync(descriptor);
      } finally {
        operations.close(descriptor);
      }
    }
    if (operations.stableBytes(preparation)?.equals(bytes) !== true)
      return false;
    operations.observeBeforeLink();
    try {
      operations.link(preparation, target);
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !["EEXIST", "EPERM"].includes(String(Reflect.get(error, "code"))) ||
        operations.stableBytes(target)?.equals(bytes) !== true
      )
        return false;
    }
    operations.injectFault("after_link_before_directory_commit");
    operations.commitDirectory(directory);
    if (
      operations.stableBytes(target)?.equals(bytes) !== true ||
      !operations.sameRegularFileIdentity(target, preparation)
    )
      return false;
    operations.injectFault("after_first_directory_commit_before_unlink");
    operations.injectFault("at_unlink");
    operations.unlink(preparation);
    operations.injectFault("after_unlink_before_directory_commit");
    operations.commitDirectory(directory);
    return operations.stableBytes(target)?.equals(bytes) === true;
  } catch {
    return false;
  }
}
