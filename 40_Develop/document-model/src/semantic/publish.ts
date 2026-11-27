/**
 * semantic-bundleに属する責務をまとめる。
 *
 * @responsibility PublishSemanticCoverageRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */

import {
  publishSemanticCoverageBundleWithHooks,
  type SemanticBundlePublishReceipt,
} from "../storage/semantic-store.ts";
import {
  createSemanticBundle,
  type SemanticCoverageGraph,
} from "./coverage.ts";
import type { SemanticIr } from "./ir.ts";

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
 * IRとCoverageを直列化して指定Repositoryへ公開する。
 *
 * @responsibility Domain Bundle生成とFilesystem Effectの呼出し順を所有する。
 * @trace ARCH-000008
 * @input request: PublishSemanticCoverageRequest、root: 呼出し元が確定した出力Root。
 * @returns PublishSemanticCoverageResultを返す。
 * @precondition 呼出し元が対象と出力先を選定済み。
 * @postcondition publishSemanticCoverageの責務を完了した結果だけを返す。
 * @effect 既存Storeの公開Effectを一回だけ要求する。
 * @failure Bundle生成と既存Writerの例外を伝播し、書込み結果を成功へ補完しない。
 * @invariant publishSemanticCoverageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済みRepositoryと既存StoreのFilesystem出版境界。
 * @security 上位の認可を代行せず、WriterのPath・実体確認を維持する。
 * @concurrency N/A: publishSemanticCoverageは共有非同期状態を持たない同期処理である。
 */
export function publishSemanticCoverage(
  request: PublishSemanticCoverageRequest,
  root: string | null,
): PublishSemanticCoverageResult {
  const bundle = createSemanticBundle(request.semanticIrs, request.coverage);
  return publishSemanticCoverageBundleWithHooks(root, {
    outputRelativePath: request.outputRelativePath,
    content: `${JSON.stringify(bundle, null, 2)}\n`,
    existingContract: bundle.contract,
  });
}
