import {
  createSemanticBundle,
  type SemanticCoverageGraph,
  type SemanticIr,
} from "../../domain/semantic-coverage/index.ts";
import type {
  SemanticBundlePublishReceipt,
  SemanticBundlePublisher,
} from "../../repository/index.ts";

export type PublishSemanticCoverageRequest = Readonly<{
  outputRelativePath: string;
  semanticIrs: readonly SemanticIr[];
  coverage: SemanticCoverageGraph;
}>;

export type PublishSemanticCoverageResult = SemanticBundlePublishReceipt;

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
