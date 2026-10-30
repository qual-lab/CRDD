/**
 * 搬送段階の有限試験と限定診断に使う試験専用入口。
 * @packageDocumentation
 * @responsibility 製品Rootから分離したEnvelope抽出の確認だけを許す。
 * @trace ARCH-000015
 * @boundary 製品の内容検査完了APIではなく、試験・診断だけの接続。
 */
export { inspectCodexExecutionObservation } from "../src/codex/observation.ts";
export {
  extractProviderResult,
  type ProviderEnvelopeInput,
} from "../src/provider/result.ts";
