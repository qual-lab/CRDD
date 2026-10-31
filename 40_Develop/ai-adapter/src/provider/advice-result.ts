/**
 * Provider助言応答の内容・JSON Schema・参照検査を所有する。
 * @packageDocumentation
 * @responsibility Provider Envelopeや実行状態を扱わず、四区分の内容だけを検査する。
 * @trace ARCH-000015
 */
import { parseUnambiguousJsonDocument } from "./json.ts";
import { snapshotPlainArray } from "./input.ts";
/**
 * 検査済み助言の一項目を表す。
 * @responsibility 説明本文と読取り投影の参照を一つの値契約へまとめる。
 * @trace ARCH-000015
 * @shape textとreferencesの読取り専用値。
 * @invariant 型付けだけでProvider内容を信頼済みとしない。
 * @boundary 正規化したProvider結果と上位表示結果。
 * @security Source本文・絶対Path・認証値の許可を拡張しない。
 * @compatibility 元の助言項目と同じ形を維持する。
 */
export type AdviceResultItem = Readonly<{
  text: string;
  references: readonly string[];
}>;

/**
 * 読取り助言結果の閉じたSchema検証境界で使用するAdviceResultの構造を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type AdviceResult = Readonly<{
  status: "completed";
  reason: null;
  facts: readonly AdviceResultItem[];
  sharedAnalysis: readonly AdviceResultItem[];
  additionalInferences: readonly AdviceResultItem[];
  nextOptions: readonly AdviceResultItem[];
}>;

/**
 * 助言内容検査の成功と拒否を区別する。
 * @responsibility 検査済み値の有無を成否へ対応付ける。
 * @trace ARCH-000015
 * @shape confirmedと値、又はblockedと固定理由。
 * @invariant 拒否時は部分的な内容を返さない。
 * @boundary AI Adapterの純粋な内容検査。
 * @security 実行許可・Provider認証を表さない。
 * @compatibility 移管前の内容検査の結果形を維持する。
 */
type NormalizedProviderResult<T> =
  | Readonly<{ status: "confirmed"; normalizedResult: T }>
  | Readonly<{ status: "blocked"; reason: string; normalizedResult: null }>;
const MAXIMUM_RAW_BYTES = 65_536;
/**
 * 助言項目に使用できる有限の文字列か判定する。
 * @responsibility 空値・周辺空白・NUL・byte超過を拒否する。
 * @trace ARCH-000015
 * @input value: 未検査値、maximumBytes: 内容契約の上限。
 * @returns 条件を満たす文字列だけtrue。
 * @precondition 上限は呼出し元の固定内容契約である。
 * @postcondition 入力を変更しない。
 * @effect N/A: 同期の値検査のみ。
 * @failure 不適合値はfalse。
 * @invariant 文字列の意味上の正しさを推定しない。
 * @boundary AI Adapterの内容検査内部。
 * @security 秘密不存在やアクセス許可を証明しない。
 * @concurrency N/A: 共有状態なし。
 */
function validString(value: unknown, maximumBytes: number): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    !value.includes("\0") &&
    Buffer.byteLength(value, "utf8") <= maximumBytes
  );
}
const MAXIMUM_TEXT_BYTES = 8_192;

const MAXIMUM_REFERENCE_BYTES = 512;

const MAXIMUM_ITEMS_PER_SECTION = 64;

const MAXIMUM_REFERENCES_PER_ITEM = 16;

const resultKeys = [
  "status",
  "facts",
  "sharedAnalysis",
  "additionalInferences",
  "nextOptions",
] as const;

const itemKeys = ["text", "references"] as const;

/**
 * 生Provider出力を読取り助言結果へ正規化する。
 *
 * @responsibility 曖昧でない単一JSONと許可済み参照集合だけを受理する。
 * @trace ARCH-000015
 * @input raw: 生Provider出力、allowedReferences: 読取り投影が許可したexact参照集合。
 * @returns confirmed時だけ正規化結果を返し、不正時は理由付きadviceResultRejectedを返す。
 * @precondition allowedReferencesはProviderへ渡した読取り投影から生成する。
 * @postcondition 全項目は本文と一件以上の許可済み参照を持つ。
 * @effect N/A: 入力検証と値の複製だけを行う。
 * @failure JSON、Schema、文字数または参照が不正なら生出力を含めずadviceResultRejectedにする。
 * @invariant 四つの結果区分と本文・参照の対応を変えない。
 * @boundary 生Provider出力と許可参照付きの読取り助言結果の境界。
 * @security 許可集合外参照、重複Key、余分なKeyおよび過大出力を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function parseAdviceResult(
  raw: unknown,
  allowedReferences: readonly string[],
) {
  const references = parseAdviceReferences(allowedReferences);
  const allowed =
    references.status === "confirmed" ? new Set(references.references) : null;
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw, "utf8") > MAXIMUM_RAW_BYTES ||
    allowed === null
  )
    return adviceResultRejected("workbench_ai_advice_result_input_invalid");

  const value = parseUnambiguousJsonDocument(raw);
  if (!isExactRecord(value, resultKeys))
    return adviceResultRejected("workbench_ai_advice_result_schema_invalid");
  if (value.status !== "completed")
    return adviceResultRejected("workbench_ai_advice_result_identity_invalid");

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
    return adviceResultRejected("workbench_ai_advice_result_items_invalid");

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
    }) satisfies AdviceResult,
    rawOutputReported: false as const,
  }) satisfies NormalizedProviderResult<AdviceResult>;
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
export function describeAdviceResultContract() {
  return Object.freeze({
    maximumRawBytes: MAXIMUM_RAW_BYTES,
    maximumItemsPerSection: MAXIMUM_ITEMS_PER_SECTION,
    maximumReferencesPerItem: MAXIMUM_REFERENCES_PER_ITEM,
    duplicateKeysAllowed: false,
    outOfProjectionReferencesAllowed: false,
    rawOutputReported: false,
  });
}

/**
 * 許可参照入力の確認済み配列と拒否を区別する。
 * @responsibility 成功時だけ不変の参照を返し、部分的な入力を搬送しない。
 * @trace ARCH-000015
 * @invariant 確認済みは参照の形式・固定の成立であり、実行やアクセスの許可ではない。
 */
export type AdviceReferencesResult =
  | Readonly<{
      status: "confirmed";
      reason: null;
      references: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: "workbench_ai_advice_result_input_invalid";
      references: null;
    }>;

/**
 * 助言で使用する許可参照を検査し、呼出し元から独立した値へ固定する。
 * @responsibility 参照数・文字列・重複の規則と不変な入力搬送を一箇所で所有する。
 * @trace ARCH-000015
 * @input 未検査の参照配列。許可集合の選択自体は上位が所有する。
 * @returns confirmedと凍結配列、又はblockedと固定理由。
 * @effect N/A: 既存plain-data検査とメモリ内のコピーのみ。
 * @failure 1024件超・空値・512byte超・周辺空白・重複・動的Propertyを固定理由へ閉じる。
 * @invariant getter・Proxyを評価せず、許可集合を拡張しない。
 * @boundary Executorの準備入力とAI Adapterの助言内容検査。
 */
export function parseAdviceReferences(value: unknown): AdviceReferencesResult {
  const snapshot = snapshotPlainArray(value, 1_024);
  const references = snapshot.status === "ok" ? snapshot.value : null;
  if (
    !references ||
    references.length === 0 ||
    !references.every((reference): reference is string =>
      validString(reference, MAXIMUM_REFERENCE_BYTES),
    ) ||
    new Set(references).size !== references.length
  )
    return Object.freeze({
      status: "blocked",
      reason: "workbench_ai_advice_result_input_invalid",
      references: null,
    });
  return Object.freeze({ status: "confirmed", reason: null, references });
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるinspectItemsの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
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
): readonly AdviceResultItem[] | null {
  if (!Array.isArray(value) || value.length > MAXIMUM_ITEMS_PER_SECTION)
    return null;
  const items: AdviceResultItem[] = [];
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
 * 読取り助言結果の閉じたSchema検証境界におけるadviceResultRejectedの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
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

function adviceResultRejected(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    normalizedResult: null,
    rawOutputReported: false as const,
  });
}

/**
 * 読取り助言結果の閉じたSchema検証境界におけるisExactRecordの処理境界を固定する。
 *
 * @responsibility 読取り助言結果の閉じたSchema検証境界に必要な入力処理、失敗分類および結果生成を所有する。
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
 * @boundary ProviderのSchema制約とExecutorの結果検証の間。
 * @security 許可参照集合は呼出し側が確定し、本Packageの検査へ渡す。
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

const adviceResultSchema = Object.freeze({
  type: "object",
  properties: Object.freeze({
    status: Object.freeze({ const: "completed" }),
    facts: itemArraySchema(),
    sharedAnalysis: itemArraySchema(),
    additionalInferences: itemArraySchema(),
    nextOptions: itemArraySchema(),
  }),
  required: Object.freeze([
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
 * @responsibility 四区分の結果意味と項目制約をAI Adapterで所有し、ProviderのCLI計画には中立な値として渡す。
 * @trace ARCH-000015
 * @input N/A: 現行の固定結果契約を投影する。
 * @returns 不変な助言結果JSON Schema。
 * @precondition N/A: Authorityや外部入力を要求しない。
 * @postcondition 共通Normalizerと同じ四区分と項目制約を保持し、形式名・版番号を要求しない。
 * @effect N/A: 固定Objectを返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Provider差によって結果の意味を変更しない。
 * @boundary AI Adapterの内容SchemaとExecutor／Coordinatorの計画・結果検査の間。
 * @security Schemaだけで参照を許可せず、呼出し側が渡す許可集合を結果検査で照合する。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeAdviceResultSchema() {
  return adviceResultSchema;
}
