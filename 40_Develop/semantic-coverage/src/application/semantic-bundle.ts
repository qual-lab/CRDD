/**
 * semantic-bundleに属する責務をまとめる。
 *
 * @responsibility PublishSemanticCoverageRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
import {
  createSemanticBundle,
  type SemanticCoverageGraph,
} from "../coverage/index.ts";
import type { SemanticIr } from "../compilation/index.ts";
import type {
  SemanticBundlePublishReceipt,
  SemanticBundlePublisher,
} from "../infrastructure/filesystem-semantic-bundle-publisher.ts";

/**
 * Semantic Coverage Bundleの公開要求を表す。
 *
 * @responsibility 出力先と同一実行のIR／Coverageを一つの要求へ結合する。
 * @trace ARCH-000008
 * @shape PublishSemanticCoverageRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PublishSemanticCoverageRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: PublishSemanticCoverageRequestの宣言は外部境界を開かない。
 * @security N/A: PublishSemanticCoverageRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PublishSemanticCoverageRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PublishSemanticCoverageRequest = Readonly<{
  outputRelativePath: string;
  semanticIrs: readonly SemanticIr[];
  coverage: SemanticCoverageGraph;
}>;

/**
 * Bundle公開で確定した出力先とbyte数を表す。
 *
 * @responsibility Infrastructureの公開ReceiptをApplication結果として保持する。
 * @trace ARCH-000008
 * @shape PublishSemanticCoverageResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PublishSemanticCoverageResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: PublishSemanticCoverageResultの宣言は外部境界を開かない。
 * @security N/A: PublishSemanticCoverageResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility PublishSemanticCoverageResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type PublishSemanticCoverageResult = SemanticBundlePublishReceipt;

/**
 * IRとCoverageを直列化して指定Publisherへ公開する。
 *
 * @responsibility Domain Bundle生成とFilesystem Effectの呼出し順を所有する。
 * @trace ARCH-000008
 * @input request: PublishSemanticCoverageRequest、publisher: SemanticBundlePublisher
 * @returns PublishSemanticCoverageResultを返す。
 * @precondition request: PublishSemanticCoverageRequest、publisher: SemanticBundlePublisherがpublishSemanticCoverageの入力契約を満たす。
 * @postcondition publishSemanticCoverageの責務を完了した結果だけを返す。
 * @effect Publisherが所有する公開Effectを一回だけ要求する。
 * @failure N/A: publishSemanticCoverageは独自の失敗分岐を所有しない。
 * @invariant publishSemanticCoverageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: publishSemanticCoverageはProcess内の同一Subsystemで完結する。
 * @security N/A: publishSemanticCoverageはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: publishSemanticCoverageは共有非同期状態を持たない同期処理である。
 */
export function publishSemanticCoverage(
  request: PublishSemanticCoverageRequest,
  publisher: SemanticBundlePublisher,
): PublishSemanticCoverageResult {
  const bundle = createSemanticBundle(request.semanticIrs, request.coverage);
  return publisher.publish({
    outputRelativePath: request.outputRelativePath,
    content: `${JSON.stringify(bundle, null, 2)}\n`,
  });
}
