/**
 * Workbench読取り助言の生Provider出力を根拠付き結果へ正規化する。
 *
 * @packageDocumentation
 * @responsibility 単一JSON、閉じたSchema、四つの意味区分および許可済み参照集合への拘束を所有する。
 * @trace ARCH-000015
 * @boundary 生Provider出力とCoordinatorの読取り助言結果Modelの境界。
 * @effect N/A: 文字列を検証・正規化するだけで外部Effectを発行しない。
 * @security 生出力を公開せず、許可済み読取り投影にない参照を拒否する。
 */
import { parseUnambiguousJsonDocument } from "../../../ai-adapter/src/output/index.ts";

export const WORKBENCH_AI_ADVICE_RESULT_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-result";
export const WORKBENCH_AI_ADVICE_RESULT_CONTRACT_REVISION = 1;

const MAXIMUM_RAW_BYTES = 65_536;
const MAXIMUM_TEXT_BYTES = 8_192;
const MAXIMUM_REFERENCE_BYTES = 512;
const MAXIMUM_ITEMS_PER_SECTION = 64;
const MAXIMUM_REFERENCES_PER_ITEM = 16;
const resultKeys = [
  "contract",
  "contractRevision",
  "status",
  "facts",
  "sharedAnalysis",
  "additionalInferences",
  "nextOptions",
] as const;
const itemKeys = ["text", "references"] as const;

/**
 * Workbench助言結果の閉じたSchema検証境界で使用するWorkbenchAiAdviceResultItemの構造を固定する。
 *
 * @responsibility Workbench助言結果の閉じたSchema検証境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

/**
 * Workbench助言結果の閉じたSchema検証境界で使用するWorkbenchAiAdviceResultの構造を固定する。
 *
 * @responsibility Workbench助言結果の閉じたSchema検証境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceResult = Readonly<{
  status: "completed";
  reason: null;
  facts: readonly WorkbenchAiAdviceResultItem[];
  sharedAnalysis: readonly WorkbenchAiAdviceResultItem[];
  additionalInferences: readonly WorkbenchAiAdviceResultItem[];
  nextOptions: readonly WorkbenchAiAdviceResultItem[];
}>;

/**
 * 生Provider出力を読取り助言結果へ正規化する。
 *
 * @responsibility 曖昧でない単一JSONと許可済み参照集合だけを受理する。
 * @trace ARCH-000015
 * @input raw: 生Provider出力、allowedReferences: 読取り投影が許可したexact参照集合。
 * @returns confirmed時だけ正規化結果を返し、不正時は理由付きblockedを返す。
 * @precondition allowedReferencesはProviderへ渡した読取り投影から生成する。
 * @postcondition 全項目は本文と一件以上の許可済み参照を持つ。
 * @effect N/A: 入力検証と値の複製だけを行う。
 * @failure JSON、Schema、文字数または参照が不正なら生出力を含めずblockedにする。
 * @invariant 四つの結果区分と本文・参照の対応を変えない。
 * @boundary 生Provider出力とCoordinator読取り助言結果の境界。
 * @security 許可集合外参照、重複Key、余分なKeyおよび過大出力を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function normalizeWorkbenchAiAdviceResult(
  raw: unknown,
  allowedReferences: readonly string[],
) {
  const allowed = inspectAllowedReferences(allowedReferences);
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES ||
    allowed === null
  )
    return blocked("workbench_ai_advice_result_input_invalid");

  const value = parseUnambiguousJsonDocument(raw);
  if (!isExactRecord(value, resultKeys))
    return blocked("workbench_ai_advice_result_schema_invalid");
  if (
    value.contract !== WORKBENCH_AI_ADVICE_RESULT_CONTRACT ||
    value.contractRevision !== WORKBENCH_AI_ADVICE_RESULT_CONTRACT_REVISION ||
    value.status !== "completed"
  )
    return blocked("workbench_ai_advice_result_identity_invalid");

  const facts = inspectItems(value.facts, allowed);
  const sharedAnalysis = inspectItems(value.sharedAnalysis, allowed);
  const additionalInferences = inspectItems(
    value.additionalInferences,
    allowed,
  );
  const nextOptions = inspectItems(value.nextOptions, allowed);
  if (
    facts === null ||
    sharedAnalysis === null ||
    additionalInferences === null ||
    nextOptions === null ||
    facts.length +
      sharedAnalysis.length +
      additionalInferences.length +
      nextOptions.length ===
      0
  )
    return blocked("workbench_ai_advice_result_items_invalid");

  return Object.freeze({
    status: "confirmed" as const,
    reason: null,
    normalizedResult: Object.freeze({
      status: "completed" as const,
      reason: null,
      facts,
      sharedAnalysis,
      additionalInferences,
      nextOptions,
    }) satisfies WorkbenchAiAdviceResult,
    rawOutputReported: false as const,
  });
}

/**
 * 公開結果契約を返す。
 *
 * @responsibility Provider Adapterが固定すべきContract Identity、上限および非公開条件を宣言する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns 読取り助言結果の固定契約。
 * @precondition N/A: 定数だけを参照する。
 * @postcondition 実装と試験が同じ上限を参照できる。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant 生Provider出力を公開しない。
 * @boundary N/A: 契約説明で外部境界を開かない。
 * @security rawOutputReportedは常にfalseである。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function describeWorkbenchAiAdviceResultContract() {
  return Object.freeze({
    contract: WORKBENCH_AI_ADVICE_RESULT_CONTRACT,
    contractRevision: WORKBENCH_AI_ADVICE_RESULT_CONTRACT_REVISION,
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    maximumItemsPerSection: MAXIMUM_ITEMS_PER_SECTION,
    maximumReferencesPerItem: MAXIMUM_REFERENCES_PER_ITEM,
    duplicateKeysAllowed: false,
    outOfProjectionReferencesAllowed: false,
    rawOutputReported: false,
  });
}

/**
 * Workbench助言結果の閉じたSchema検証境界におけるinspectAllowedReferencesの処理境界を固定する。
 *
 * @responsibility Workbench助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function inspectAllowedReferences(
  values: readonly string[],
): ReadonlySet<string> | null {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    values.length > 1_024 ||
    values.some(
      (reference) => !validString(reference, MAXIMUM_REFERENCE_BYTES),
    ) ||
    new Set(values).size !== values.length
  )
    return null;
  return new Set(values);
}

/**
 * Workbench助言結果の閉じたSchema検証境界におけるinspectItemsの処理境界を固定する。
 *
 * @responsibility Workbench助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function inspectItems(
  value: unknown,
  allowedReferences: ReadonlySet<string>,
): readonly WorkbenchAiAdviceResultItem[] | null {
  if (!Array.isArray(value) || value.length > MAXIMUM_ITEMS_PER_SECTION)
    return null;
  const items: WorkbenchAiAdviceResultItem[] = [];
  for (const item of value) {
    if (
      !isExactRecord(item, itemKeys) ||
      !validString(item.text, MAXIMUM_TEXT_BYTES) ||
      !Array.isArray(item.references) ||
      item.references.length === 0 ||
      item.references.length > MAXIMUM_REFERENCES_PER_ITEM ||
      item.references.some(
        (reference) =>
          !validString(reference, MAXIMUM_REFERENCE_BYTES) ||
          !allowedReferences.has(reference),
      ) ||
      new Set(item.references).size !== item.references.length
    )
      return null;
    items.push(
      Object.freeze({
        text: item.text,
        references: Object.freeze([...item.references] as string[]),
      }),
    );
  }
  return Object.freeze(items);
}

/**
 * Workbench助言結果の閉じたSchema検証境界におけるblockedの処理境界を固定する。
 *
 * @responsibility Workbench助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    normalizedResult: null,
    rawOutputReported: false as const,
  });
}

/**
 * Workbench助言結果の閉じたSchema検証境界におけるvalidStringの処理境界を固定する。
 *
 * @responsibility Workbench助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function validString(value: unknown, maximumBytes: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.trim() === value &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}

/**
 * Workbench助言結果の閉じたSchema検証境界におけるisExactRecordの処理境界を固定する。
 *
 * @responsibility Workbench助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
 * @trace ARCH-000015
 * @input 宣言された引数だけを受け取る。
 * @returns 宣言された結果型を返す。
 * @precondition 呼出し元が型、IdentityおよびAuthorityの契約を満たす。
 * @postcondition 成功時だけ検証済みの結果を返す。
 * @effect 宣言または注入された依存以外へEffectを発行しない。
 * @failure 不正入力、依存失敗または観測不能を成功へ畳まない。
 * @invariant 入力のIdentity、AuthorityおよびScopeを暗黙に拡張しない。
 * @boundary 呼出し元と本Moduleの局所責務境界。
 * @security 秘密値と未許可情報を出力またはlogへ追加しない。
 * @concurrency 共有状態は宣言された所有者とlifecycleに従う。
 */

function isExactRecord<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => key in value);
}

const adviceResultSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({
    contract: Object.freeze({
      const: "crdd-coordinator/workbench-ai-advice-result",
    }),
    contractRevision: Object.freeze({ const: 1 }),
    status: Object.freeze({ const: "completed" }),
    facts: itemArraySchema(),
    sharedAnalysis: itemArraySchema(),
    additionalInferences: itemArraySchema(),
    nextOptions: itemArraySchema(),
  }),
  required: Object.freeze([
    "contract",
    "contractRevision",
    "status",
    "facts",
    "sharedAnalysis",
    "additionalInferences",
    "nextOptions",
  ]),
  additionalProperties: false,
});

/**
 * Providerの出力制約へ渡す共通助言結果Schemaを公開する。
 *
 * @responsibility 四区分の結果意味と項目制約をCoordinatorで所有し、ProviderのCLI計画には中立な値として渡す。
 * @trace ARCH-000015
 * @input N/A: 現行の固定結果契約を投影する。
 * @returns 不変な助言結果JSON Schema。
 * @precondition N/A: Authorityや外部入力を要求しない。
 * @postcondition 共通Normalizerと同じ結果契約・改訂・四区分を保持する。
 * @effect N/A: 固定Objectを返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Provider差によって結果の意味を変更しない。
 * @boundary Coordinatorの意味契約とAI AdapterのCLI出力制約の間。
 * @security 許可参照集合の最終確認はCoordinatorに残す。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeWorkbenchAiAdviceResultSchema() {
  return adviceResultSchema;
}

/**
 * 助言項目配列のJSON Schemaを生成する。
 *
 * @responsibility 四区分で共通利用する本文と根拠参照の閉じたSchemaを一か所で所有する。
 * @trace ARCH-000015
 * @input N/A: 固定Schemaだけを生成する。
 * @returns 助言項目配列のJSON Schema。
 * @precondition N/A: 呼出し条件を持たない。
 * @postcondition 余分Property、空参照および過大配列を許可しない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Result Normalizerより強い意味主張を追加しない。
 * @boundary ProviderのSchema制約とCoordinatorの最終検証の間。
 * @security 参照の許可集合確認はProviderでなくCoordinatorが所有する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function itemArraySchema() {
  return Object.freeze({
    type: "array",
    maxItems: 64,
    items: Object.freeze({
      type: "object",
      properties: Object.freeze({
        text: Object.freeze({ type: "string", minLength: 1, maxLength: 8192 }),
        references: Object.freeze({
          type: "array",
          minItems: 1,
          maxItems: 16,
          uniqueItems: true,
          items: Object.freeze({
            type: "string",
            minLength: 1,
            maxLength: 512,
          }),
        }),
      }),
      required: Object.freeze(["text", "references"]),
      additionalProperties: false,
    }),
  });
}
