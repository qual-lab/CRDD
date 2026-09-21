/**
 * 検証済みRepository Rootを副作用なく観測する公開境界。
 *
 * @packageDocumentation
 * @responsibility FileとDirectoryの観測契約、およびFilesystem Adapterの公開範囲を所有する。
 * @trace ARCH-000008
 * @boundary 検証済みRepository RootとCRDD Domain利用側の間で、読取り専用の観測結果だけを公開する。
 */

/**
 * Repository内容を副作用なしで観測する公開境界。
 *
 * @responsibility 検証済みRoot内のEntryとFile内容を構造化して返す。
 * @trace ARCH-000008
 * @shape RepositoryEntryKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryEntryKindで宣言した値と責務の対応を維持する。
 * @boundary Version Control AdapterとDomain利用側の間の観測境界。
 * @security N/A: RepositoryEntryKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryEntryKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryEntryKind =
  | "file"
  | "directory"
  | "symbolic-link"
  | "other";

/**
 * indexで使用するRepository Directory Entryの値契約を定義する。
 *
 * @responsibility Repository Directory EntryのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryDirectoryEntryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryDirectoryEntryで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryDirectoryEntryの宣言は外部境界を開かない。
 * @security N/A: RepositoryDirectoryEntryはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryDirectoryEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryDirectoryEntry = Readonly<{
  name: string;
  kind: RepositoryEntryKind;
}>;

/**
 * indexで使用するRepository File Observationの値契約を定義する。
 *
 * @responsibility Repository File ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryFileObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryFileObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryFileObservationの宣言は外部境界を開かない。
 * @security N/A: RepositoryFileObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryFileObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * indexで使用するRepository Directory Observationの値契約を定義する。
 *
 * @responsibility Repository Directory ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryDirectoryObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryDirectoryObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryDirectoryObservationの宣言は外部境界を開かない。
 * @security N/A: RepositoryDirectoryObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryDirectoryObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * indexで使用するRepository Observation Portの値契約を定義する。
 *
 * @responsibility Repository Observation PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryObservationPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryObservationPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryObservationPortの宣言は外部境界を開かない。
 * @security N/A: RepositoryObservationPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryObservationPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryObservationPort = Readonly<{
  observeFile: (repositoryRelativePath: string) => RepositoryFileObservation;
  observeDirectory: (
    repositoryRelativePath: string,
  ) => RepositoryDirectoryObservation;
}>;

/**
 * indexで使用するRepository Root Capabilityの値契約を定義する。
 *
 * @responsibility Repository Root CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000009
 * @shape RepositoryRootCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRootCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRootCapabilityの宣言は外部境界を開かない。
 * @security N/A: RepositoryRootCapabilityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRootCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRootCapability = VerifiedRepositoryRoot;

/**
 * Filesystem Repository Observation Portを構築する。
 *
 * @responsibility Filesystem Repository Observation Portの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000009
 * @input capability: VerifiedRepositoryRoot
 * @returns RepositoryObservationPortを返す。
 * @precondition 「capability: VerifiedRepositoryRoot」がcreateFilesystemRepositoryObservationPortの入力契約を満たす。
 * @postcondition createFilesystemRepositoryObservationPortの責務を完了した結果だけを返す。
 * @effect N/A: createFilesystemRepositoryObservationPortは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createFilesystemRepositoryObservationPortは独自の失敗分岐を所有しない。
 * @invariant createFilesystemRepositoryObservationPortは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createFilesystemRepositoryObservationPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createFilesystemRepositoryObservationPortは共有非同期状態を持たない同期処理である。
 */
export function createFilesystemRepositoryObservationPort(
  capability: VerifiedRepositoryRoot,
): RepositoryObservationPort {
  const root = resolveVerifiedRepositoryRoot(capability);
  if (root === null)
    return {
      observeFile: (repositoryRelativePath) => ({
        status: "unobservable",
        repositoryRelativePath,
        reason: "verified repository root capability is unavailable",
      }),
      observeDirectory: (repositoryRelativePath) => ({
        status: "unobservable",
        repositoryRelativePath,
        reason: "verified repository root capability is unavailable",
      }),
    };
  return createFilesystemRepositoryObservationPortFromRootBinding({
    absolutePath: root,
    canonicalPath: root,
    pathFlavor: path.sep === "\\" ? "win32" : "posix",
  });
}
import path from "node:path";

import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-identity/index.ts";
import { createFilesystemRepositoryObservationPortFromRootBinding } from "./filesystem-repository-observer.ts";
export {
  type RealityRepositoryObservationIssue,
  type RealitySymbolRepositoryObservation,
  observeRealitySymbolRepository,
} from "./reality-symbol-repository-observer.ts";
