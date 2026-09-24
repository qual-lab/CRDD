/**
 * docker-desktop-repair-history-publicationに属する責務をまとめる。
 *
 * @responsibility RepairHistoryPublicationFaultPointを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
/**
 * docker-desktop-repair-history-publicationで使用するRepair History Publication Fault Pointの値契約を定義する。
 *
 * @responsibility Repair History Publication Fault PointのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RepairHistoryPublicationFaultPointが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepairHistoryPublicationFaultPointで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepairHistoryPublicationFaultPointの宣言は外部境界を開かない。
 * @security RepairHistoryPublicationFaultPointはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RepairHistoryPublicationFaultPointの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepairHistoryPublicationFaultPoint =
  | "after_link_before_platform_confirmation"
  | "after_first_platform_confirmation_before_unlink"
  | "at_unlink"
  | "after_unlink_before_platform_confirmation";

/**
 * docker-desktop-repair-history-publicationで使用するRepair History Publication Operationsの値契約を定義する。
 *
 * @responsibility Repair History Publication OperationsのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RepairHistoryPublicationOperationsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepairHistoryPublicationOperationsで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepairHistoryPublicationOperationsの宣言は外部境界を開かない。
 * @security RepairHistoryPublicationOperationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RepairHistoryPublicationOperationsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
  captureDirectoryIdentity: (directory: string) => unknown | null;
  confirmPublicationSettlementForCurrentInvocation: (
    directory: string,
    initialDirectoryIdentity: unknown,
  ) => boolean;
  observeBeforeLink: () => void;
  injectFault: (point: RepairHistoryPublicationFaultPoint) => void;
}>;

/**
 * Repair History File Using Operationsを公開する。
 *
 * @responsibility Repair History File Using Operationsの公開条件、公開範囲、未確定内容の非公開境界を所有する。
 * @trace ARCH-000008
 * @input operations: RepairHistoryPublicationOperations、directory: string、target: string、preparation: string、bytes: Buffer、maximumBytes: number
 * @returns booleanを返す。
 * @precondition 「operations: RepairHistoryPublicationOperations、directory: string、target: string、preparation: string、bytes: Buffer、maximumBytes: number」がpublishRepairHistoryFileUsingOperationsの入力契約を満たす。
 * @postcondition publishRepairHistoryFileUsingOperationsの責務を完了した結果だけを返す。
 * @effect publishRepairHistoryFileUsingOperationsはFilesystemの読取りまたは書込みを実行する。
 * @failure publishRepairHistoryFileUsingOperationsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant publishRepairHistoryFileUsingOperationsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security publishRepairHistoryFileUsingOperationsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: publishRepairHistoryFileUsingOperationsは共有非同期状態を持たない同期処理である。
 */
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
    const initialDirectoryIdentity =
      operations.captureDirectoryIdentity(directory);
    if (initialDirectoryIdentity === null) return false;
    const completed = () =>
      operations.confirmPublicationSettlementForCurrentInvocation(
        directory,
        initialDirectoryIdentity,
      ) &&
      operations.stableBytes(target)?.equals(bytes) === true &&
      operations.present(preparation) === false;
    const targetPresent = operations.present(target);
    const preparationPresent = operations.present(preparation);
    if (targetPresent === null || preparationPresent === null) return false;
    if (targetPresent) {
      if (operations.stableBytes(target)?.equals(bytes) !== true) return false;
      if (!preparationPresent) return completed();
      if (
        operations.stableBytes(preparation)?.equals(bytes) !== true ||
        !operations.sameRegularFileIdentity(target, preparation)
      )
        return false;
      if (
        !operations.confirmPublicationSettlementForCurrentInvocation(
          directory,
          initialDirectoryIdentity,
        )
      )
        return false;
      operations.injectFault("after_first_platform_confirmation_before_unlink");
      operations.injectFault("at_unlink");
      operations.unlink(preparation);
      operations.injectFault("after_unlink_before_platform_confirmation");
      return completed();
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
    operations.injectFault("after_link_before_platform_confirmation");
    if (
      !operations.confirmPublicationSettlementForCurrentInvocation(
        directory,
        initialDirectoryIdentity,
      )
    )
      return false;
    if (
      operations.stableBytes(target)?.equals(bytes) !== true ||
      !operations.sameRegularFileIdentity(target, preparation)
    )
      return false;
    operations.injectFault("after_first_platform_confirmation_before_unlink");
    operations.injectFault("at_unlink");
    operations.unlink(preparation);
    operations.injectFault("after_unlink_before_platform_confirmation");
    return completed();
  } catch {
    return false;
  }
}
