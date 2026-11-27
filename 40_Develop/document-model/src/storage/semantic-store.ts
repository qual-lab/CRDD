/**
 * filesystem-semantic-bundle-publisherに属する責務をまとめる。
 *
 * @responsibility SemanticBundlePublishRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import path from "node:path";

import {
  createFilesystemRepositoryObservationPort,
  observeDocumentRoot,
} from "../repository/create-observer.ts";

/**
 * Filesystemへ公開するBundle本文とRepository相対Pathを表す。
 *
 * @responsibility 公開Effectの入力を限定する。
 * @trace ARCH-000008
 * @shape SemanticBundlePublishRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticBundlePublishRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticBundlePublishRequestの宣言は外部境界を開かない。
 * @security N/A: SemanticBundlePublishRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticBundlePublishRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticBundlePublishRequest = Readonly<{
  outputRelativePath: string;
  content: string;
  existingContract?: string;
}>;

/**
 * Bundle公開後に観測した出力情報を表す。
 *
 * @responsibility 公開Pathと書込みbyte数を利用側へ返す。
 * @trace ARCH-000008
 * @shape SemanticBundlePublishReceiptが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticBundlePublishReceiptで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticBundlePublishReceiptの宣言は外部境界を開かない。
 * @security N/A: SemanticBundlePublishReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticBundlePublishReceiptの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticBundlePublishReceipt = Readonly<{
  outputRelativePath: string;
  byteLength: number;
}>;

/**
 * 原子的置換直前を試験で観測するHookを表す。
 *
 * @responsibility Production Flowを変えず置換前競合を再現可能にする。
 * @trace ARCH-000008
 * @shape SemanticBundleWriterHooksが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticBundleWriterHooksで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticBundleWriterHooksの宣言は外部境界を開かない。
 * @security N/A: SemanticBundleWriterHooksはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticBundleWriterHooksの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticBundleWriterHooks = Readonly<{
  beforePublish?: (temporaryPath: string, targetPath: string) => void;
}>;

/**
 * 対象Pathが検証済みRootの内側か判定する。
 *
 * @responsibility Repository外への公開をPath境界で拒否する。
 * @trace ARCH-000008
 * @input root: string、target: string
 * @returns booleanを返す。
 * @precondition root: string、target: stringがisContainedの入力契約を満たす。
 * @postcondition isContainedの責務を完了した結果だけを返す。
 * @effect N/A: isContainedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isContainedは独自の失敗分岐を所有しない。
 * @invariant isContainedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Repository Filesystemの包含境界。
 * @security N/A: isContainedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isContainedは共有非同期状態を持たない同期処理である。
 */
function isContained(root: string, target: string): boolean {
  const relativePath = path.relative(root, target);
  return (
    relativePath === "" ||
    (relativePath !== ".." &&
      !relativePath.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativePath))
  );
}

/**
 * BundleをRepository内へStageし検証後に原子的公開する。
 *
 * @responsibility 一時Fileの作成、同期、内容確認、置換および全経路cleanupを所有する。
 * @trace ARCH-000008
 * @input repositoryRoot: 出力用の絶対Directory、request: Bundleと相対出力Path、hooks: 試験用注入。
 * @returns SemanticBundlePublishReceiptを返す。
 * @precondition 呼出し元が対象と許可された出力領域を選定済み。
 * @postcondition publishSemanticCoverageBundleWithHooksの責務を完了した結果だけを返す。
 * @effect 検証済みRepository内の指定Bundleを置換する。
 * @failure 部分書込みやRoot外Pathでは既存Snapshotを維持する。
 * @invariant 終了時に当該Operationの一時Fileを残さない。
 * @boundary Repository Filesystemへの書込み境界。
 * @security N/A: publishSemanticCoverageBundleWithHooksはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: publishSemanticCoverageBundleWithHooksは共有非同期状態を持たない同期処理である。
 */
export function publishSemanticCoverageBundleWithHooks(
  repositoryRoot: string | null,
  request: SemanticBundlePublishRequest,
  hooks: SemanticBundleWriterHooks = {},
): SemanticBundlePublishReceipt {
  const { outputRelativePath, content: serializedBundle } = request;
  if (repositoryRoot === null || !observeDocumentRoot(repositoryRoot))
    throw new Error("Document output root directory is unavailable.");
  const repository = createFilesystemRepositoryObservationPort(repositoryRoot);
  const outputDirectoryRelativePath = path.posix.dirname(outputRelativePath);
  const outputDirectory = repository.observeDirectory(
    outputDirectoryRelativePath,
  );
  if (outputDirectory.status !== "resolved")
    throw new Error(
      `Semantic coverage output directory is invalid: ${outputDirectory.reason}`,
    );

  const targetPath = path.join(
    outputDirectory.targetPath,
    path.posix.basename(outputRelativePath),
  );
  const canonicalRepositoryRoot = fs.realpathSync.native(repositoryRoot);
  if (!isContained(canonicalRepositoryRoot, targetPath))
    throw new Error("Semantic coverage output is outside the repository.");
  if (fs.existsSync(targetPath)) {
    const targetMetadata = fs.lstatSync(targetPath);
    if (targetMetadata.isSymbolicLink() || !targetMetadata.isFile())
      throw new Error("Semantic coverage output is not a regular file.");
    if (request.existingContract !== undefined) {
      const existing: unknown = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      if (
        existing === null ||
        typeof existing !== "object" ||
        !("contract" in existing) ||
        existing.contract !== request.existingContract
      )
        throw new Error(
          "Semantic coverage output does not own the existing file.",
        );
    }
  }

  const temporaryPath = path.join(
    outputDirectory.targetPath,
    `.semantic-coverage-pilot.${process.pid}.${Date.now()}.tmp`,
  );
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(temporaryPath, "wx", 0o600);
    fs.writeFileSync(descriptor, serializedBundle, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = null;
    if (fs.readFileSync(temporaryPath, "utf8") !== serializedBundle)
      throw new Error("Semantic coverage staging verification failed.");
    hooks.beforePublish?.(temporaryPath, targetPath);
    fs.renameSync(temporaryPath, targetPath);
    return {
      outputRelativePath,
      byteLength: Buffer.byteLength(serializedBundle, "utf8"),
    };
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
    if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
  }
}
